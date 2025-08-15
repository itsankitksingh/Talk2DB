const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysql = require('mysql2/promise');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:4200'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Gemini AI
let geminiAI = null;
let model = null;

function initializeGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    return false;
  }

  try {
    geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    model = geminiAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    });
    console.log('Gemini AI initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Gemini client:', error);
    return false;
  }
}

// Database connection pool
let dbPool = null;

async function initializeDatabase() {
  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await dbPool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Get database schema information
async function getDatabaseSchema() {
  try {
    const connection = await dbPool.getConnection();
    
    // Get all tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [process.env.DB_NAME]);
    
    let schemaInfo = '';
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      // Get table structure
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [process.env.DB_NAME, tableName]);
      
      schemaInfo += `\nTable: ${tableName}\n`;
      schemaInfo += 'Columns:\n';
      
      columns.forEach(col => {
        const keyInfo = col.COLUMN_KEY ? ` (${col.COLUMN_KEY})` : '';
        schemaInfo += `  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${keyInfo}\n`;
      });
      
      schemaInfo += '\n';
    }
    
    connection.release();
    return schemaInfo;
  } catch (error) {
    console.error('Error getting database schema:', error);
    return '';
  }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!model) {
      return res.status(500).json({ error: 'Gemini AI not initialized' });
    }

    if (!dbPool) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    // Get database schema
    const schemaInfo = await getDatabaseSchema();
    
    // Prepare the system prompt
    const systemPrompt = `You are an expert SQL assistant that can help users query a database. 

Database Schema:
${schemaInfo}

Your job is to:
1. Understand the user's natural language question
2. Generate appropriate SQL queries using the EXACT table names from the schema
3. Execute the queries safely (only SELECT statements for security)
4. Provide a clear, natural language response

IMPORTANT RULES:
- Only use SELECT statements for security
- Never use INSERT, UPDATE, DELETE, DROP, or any destructive operations
- Always use the EXACT table names from the schema (students, users, courses, enrollments)
- If the user asks about "students", use the 'students' table
- If the user asks about "users", use the 'users' table
- If the user asks about "courses", use the 'courses' table
- If the user asks about "enrollments", use the 'enrollments' table
- Always validate and sanitize any user input
- If the user asks about data that doesn't exist, explain what information is available
- Be helpful and conversational in your responses
- If the user asks for "all table names" or "show tables", list the available tables: students, users, courses, enrollments
- If the user asks general questions about the database structure, provide helpful information about available tables and their purposes

You MUST respond with ONLY a valid JSON object in this exact format (no additional text before or after):
{
  "sqlQuery": "The SQL query you generated (or null if no query needed)",
  "response": "Natural language response to the user",
  "needsQuery": true/false
}`;

    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }] 
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
      }
    });

    const response = await result.response;
    let content = response.text() || '{}';
    
    // Clean up the response - remove any markdown formatting or extra text
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    if (content.startsWith('```')) {
      content = content.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    // Find JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    console.log('AI Response:', content);
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
      
      // Ensure required fields exist
      if (!parsedResponse.response) {
        parsedResponse.response = "I received your question but couldn't generate a proper response.";
      }
      if (!parsedResponse.hasOwnProperty('needsQuery')) {
        parsedResponse.needsQuery = !!parsedResponse.sqlQuery;
      }
    } catch (error) {
      console.error('JSON parsing failed:', error, 'Content:', content);
      
      // Try to extract useful information from the raw content
      let extractedQuery = null;
      const sqlMatch = content.match(/SELECT[\s\S]*?(?:;|$)/i);
      if (sqlMatch) {
        extractedQuery = sqlMatch[0].replace(/;$/, '').trim();
      }
      
      // Create a fallback response
      parsedResponse = {
        sqlQuery: extractedQuery,
        response: content || "I'm having trouble processing your request. Please try rephrasing your question.",
        needsQuery: !!extractedQuery
      };
    }

    // Execute the SQL query if one was generated and needed
    if (parsedResponse.needsQuery && parsedResponse.sqlQuery && parsedResponse.sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
      try {
        console.log('Executing SQL query:', parsedResponse.sqlQuery);
        const connection = await dbPool.getConnection();
        const [rows] = await connection.execute(parsedResponse.sqlQuery);
        connection.release();
        
        console.log('Query returned', rows.length, 'rows');
        parsedResponse.data = rows;
        
        // Update the response to include the number of results
        if (rows.length === 0) {
          parsedResponse.response = `No results found. ${parsedResponse.response}`;
        } else {
          parsedResponse.response = `Found ${rows.length} result(s). ${parsedResponse.response}`;
        }
      } catch (sqlError) {
        console.error('SQL execution error:', sqlError);
        parsedResponse.response = `I encountered an error while querying the database: ${sqlError.message}. Please check if the table names and column names are correct.`;
        parsedResponse.data = null;
        parsedResponse.error = sqlError.message;
      }
    } else if (parsedResponse.sqlQuery && !parsedResponse.sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
      console.log('Non-SELECT query blocked for security:', parsedResponse.sqlQuery);
      parsedResponse.response = 'For security reasons, I can only execute SELECT queries to retrieve data.';
      parsedResponse.data = null;
    } else {
      console.log('No query execution needed or no valid query provided');
      parsedResponse.data = null;
    }

    res.json(parsedResponse);
    
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    gemini: !!model, 
    database: !!dbPool,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check database schema
app.get('/api/debug/schema', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const schemaInfo = await getDatabaseSchema();
    res.json({ 
      schema: schemaInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get schema',
      details: error.message 
    });
  }
});

// Initialize services and start server
async function startServer() {
  console.log('Initializing services...');
  
  const geminiInitialized = initializeGemini();
  const dbInitialized = await initializeDatabase();
  
  if (!geminiInitialized) {
    console.error('Failed to initialize Gemini AI. Please check your API key.');
  }
  
  if (!dbInitialized) {
    console.error('Failed to connect to database. Please check your database configuration.');
  }
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer(); 