# Talk2DB

A modern chat application that allows you to interact with your SQL database using natural language. Powered by Google's Gemini AI, this application provides an intuitive interface to query your database without writing SQL.

## Features

- 🤖 **AI-Powered Queries**: Uses Google Gemini AI to understand natural language and generate SQL queries
- 🎨 **Modern UI**: Beautiful, responsive Angular 19 interface with real-time chat
- 🔒 **Security**: Only allows SELECT queries for safety
- 📊 **Data Visualization**: Displays query results in formatted tables
- 🔍 **Schema Awareness**: Automatically discovers and understands your database structure
- 📱 **Responsive Design**: Works perfectly on desktop and mobile devices
- ⚡ **Real-time Status**: Shows connection status for both AI and database

## Screenshots

  <img width="1919" height="929" alt="Screenshot 2025-08-15 143956" src="https://github.com/user-attachments/assets/817db480-6651-4974-944c-f51981f72e02" />
  <img width="1919" height="924" alt="Screenshot 2025-08-15 144011" src="https://github.com/user-attachments/assets/b21d20f9-417d-4a1e-8138-08185531158c" />


## Tech Stack

- **Frontend**: Angular 19 with TypeScript
- **Backend**: Node.js with Express
- **AI**: Google Gemini API
- **Database**: MySQL (easily configurable for other SQL databases)
- **Styling**: Modern CSS with gradients and animations

## Prerequisites

- Node.js (v18 or higher)
- MySQL database
- Google Gemini API key

## Installation

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
DB_PORT=3306

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file

## Running the Application

### Development Mode

```bash
# Terminal 1: Start the backend server
npm run dev

# Terminal 2: Start the frontend
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:4200
- Backend API: http://localhost:3000

### Production Build

```bash
# Build the frontend
cd frontend
npm run build

# Start the production server
cd ..
npm start
```

## Usage Examples

Once the application is running, you can ask questions like:

### Basic Queries
- "Does this student exist in the database?"
- "Show me all users"
- "How many records are in the users table?"
- "Find all students with GPA above 3.5"

### Complex Queries
- "Show me the top 10 students by GPA"
- "Find all users who registered in the last 30 days"
- "What's the average age of students in the database?"
- "Show me students who are enrolled in Computer Science"

### Data Exploration
- "What tables are available in the database?"
- "Show me the structure of the students table"
- "List all columns in the users table"

## API Endpoints

### POST /api/chat
Send a message to the AI assistant.

**Request:**
```json
{
  "message": "Does this student exist?"
}
```

**Response:**
```json
{
  "sqlQuery": "SELECT * FROM students WHERE name = 'John Doe'",
  "response": "I found 1 student with that name in the database.",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

### GET /api/health
Check the health status of the application.

**Response:**
```json
{
  "status": "OK",
  "gemini": true,
  "database": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Security Features

- **Read-Only Queries**: Only SELECT statements are allowed
- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: API requests are rate-limited to prevent abuse
- **CORS Protection**: Configured for secure cross-origin requests
- **Error Handling**: Comprehensive error handling and logging

## Database Schema Discovery

The application automatically discovers your database schema and provides it to the AI, enabling it to:

- Understand table structures
- Know available columns and data types
- Generate accurate SQL queries
- Provide contextual responses

## Customization

### Adding New Database Support

To support other SQL databases (PostgreSQL, SQLite, etc.), modify the database connection in `server.js`:

```javascript
// For PostgreSQL
const { Pool } = require('pg');
dbPool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});
```

### Customizing the AI Prompt

Modify the system prompt in `server.js` to change how the AI behaves:

```javascript
const systemPrompt = `Your custom prompt here...`;
```

### Styling Customization

The frontend uses modern CSS with CSS custom properties. You can easily customize colors, fonts, and layouts by modifying `frontend/src/styles.css`.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check your database credentials in `.env`
   - Ensure MySQL is running
   - Verify the database exists

2. **Gemini API Errors**
   - Verify your API key is correct
   - Check your API quota and billing
   - Ensure the API key has proper permissions

3. **Frontend Not Loading**
   - Check if the backend is running on port 3000
   - Verify CORS settings
   - Check browser console for errors

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub

---

**Note**: This application is designed for development and testing purposes. For production use, consider additional security measures and proper deployment configurations. 
