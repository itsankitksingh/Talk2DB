import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid h-100">
      <!-- Header -->
      <div class="card mb-3">
        <div class="card-header">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
              <i class="fas fa-database text-primary me-2 fs-4"></i>
              <h1 class="h4 mb-0 text-dark">Chat with Database</h1>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge" [class]="isConnected ? 'bg-success' : 'bg-danger'">
                <i class="fas" [class.fa-circle]="isConnected" [class.fa-times-circle]="!isConnected"></i>
                {{ isConnected ? 'Connected' : 'Disconnected' }}
              </span>
              <button class="btn btn-outline-primary btn-sm" (click)="checkDatabaseSchema()" title="Check Database Schema">
                <i class="fas fa-database"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Messages -->
      <div class="card flex-grow-1 mb-3" style="height: 60vh; overflow-y: auto;" #messagesContainer>
        <div class="card-body">
          <div *ngIf="messages.length === 0" class="text-center py-5">
            <i class="fas fa-comments text-muted" style="font-size: 3rem;"></i>
            <h3 class="mt-3 text-muted">Start chatting with your database</h3>
            <p class="text-muted">Ask questions about your data, like "Does this student exist?" or "Show me all users"</p>
          </div>
          
          <div *ngFor="let message of messages" class="mb-3">
            <div class="d-flex" [class.justify-content-end]="message.isUser">
              <div class="card" [class]="message.isUser ? 'bg-primary text-white' : 'bg-light'" style="max-width: 70%;">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center mb-2">
                    <i class="fas me-2" [class.fa-user]="message.isUser" [class.fa-robot]="!message.isUser"></i>
                    <small class="fw-bold">{{ message.isUser ? 'You' : 'Database Assistant' }}</small>
                    <small class="ms-auto opacity-75">{{ message.timestamp | date:'shortTime' }}</small>
                  </div>
                  
                  <div [innerHTML]="formatMessageText(message.text)"></div>
              
                  <!-- SQL Query Display -->
                  <div *ngIf="message.sqlQuery && !message.isUser" class="mt-3">
                    <div class="d-flex align-items-center mb-2">
                      <i class="fas fa-code me-2"></i>
                      <small class="fw-bold">Generated SQL Query</small>
                    </div>
                    <pre class="bg-dark text-light p-2 rounded small">{{ message.sqlQuery }}</pre>
                  </div>
              
                  <!-- Data Display -->
                  <div *ngIf="message.data && message.data.length > 0 && !message.isUser" class="mt-3">
                    <div class="d-flex align-items-center mb-2">
                      <i class="fas fa-table me-2"></i>
                      <small class="fw-bold">Query Results ({{ message.data.length }} rows)</small>
                    </div>
                    <div class="table-responsive">
                      <table class="table table-sm table-striped">
                        <thead class="table-dark">
                          <tr>
                            <th *ngFor="let key of getTableHeaders(message.data)">{{ key }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let row of message.data.slice(0, 10)">
                            <td *ngFor="let key of getTableHeaders(message.data)">{{ row[key] }}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div *ngIf="message.data.length > 10" class="text-muted small">
                        Showing first 10 rows of {{ message.data.length }} total rows
                      </div>
                    </div>
                  </div>
              
                  <!-- Error Display -->
                  <div *ngIf="message.error && !message.isUser" class="mt-3">
                    <div class="alert alert-danger d-flex align-items-center" role="alert">
                      <i class="fas fa-exclamation-triangle me-2"></i>
                      <div>{{ message.error }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Loading Message -->
          <div *ngIf="isLoading" class="mb-3">
            <div class="d-flex">
              <div class="card bg-light" style="max-width: 70%;">
                <div class="card-body p-3">
                  <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-robot me-2"></i>
                    <small class="fw-bold">Database Assistant</small>
                  </div>
                  <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div class="card">
        <div class="card-body">
          <form (ngSubmit)="sendMessage()" #chatForm="ngForm">
            <div class="input-group">
              <input
                type="text"
                [(ngModel)]="currentMessage"
                name="message"
                placeholder="Ask about your database..."
                class="form-control"
                [disabled]="isLoading || !isConnected"
                (keydown.enter)="sendMessage()"
                autocomplete="off"
              />
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="!currentMessage.trim() || isLoading || !isConnected"
              >
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  currentMessage = '';
  isLoading = false;
  isConnected = false;

  constructor(private chatService: ChatService) {}

  ngOnInit() {
    this.checkConnection();
    this.addWelcomeMessage();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private checkConnection() {
    this.chatService.getHealthStatus().subscribe({
      next: (response) => {
        this.isConnected = response.status === 'OK' && response.gemini && response.database;
      },
      error: () => {
        this.isConnected = false;
      }
    });
  }

  private addWelcomeMessage() {
    const welcomeMessage: ChatMessage = {
      id: this.generateId(),
      text: 'Hello! I\'m your database assistant. I can help you query your database using natural language. Try asking questions like "Does this student exist?" or "Show me all users".',
      isUser: false,
      timestamp: new Date()
    };
    this.messages.push(welcomeMessage);
  }

  sendMessage() {
    if (!this.currentMessage.trim() || this.isLoading || !this.isConnected) {
      return;
    }

    const userMessage: ChatMessage = {
      id: this.generateId(),
      text: this.currentMessage,
      isUser: true,
      timestamp: new Date()
    };

    this.messages.push(userMessage);
    const messageText = this.currentMessage;
    this.currentMessage = '';
    this.isLoading = true;

    this.chatService.sendMessage(messageText).subscribe({
      next: (response) => {
        // Use the response text from the server directly
        let responseText = response.response || 'I received your message but couldn\'t generate a response.';
        
        // Only add data preview if there's actual data and it's not already mentioned in the response
        if (response.data && response.data.length > 0 && !responseText.includes('result')) {
          responseText += `\n\nFound ${response.data.length} result(s).`;
        }
        
        const botMessage: ChatMessage = {
          id: this.generateId(),
          text: responseText,
          isUser: false,
          timestamp: new Date(),
          sqlQuery: response.sqlQuery || undefined,
          data: response.data,
          error: response.error
        };
        this.messages.push(botMessage);
        this.isLoading = false;
      },
      error: (error) => {
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          text: 'Sorry, I encountered an error while processing your request.',
          isUser: false,
          timestamp: new Date(),
          error: error.error?.details || error.message || 'Unknown error occurred'
        };
        this.messages.push(errorMessage);
        this.isLoading = false;
      }
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private scrollToBottom(): void {
    try {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (err) {}
  }

  getTableHeaders(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    
    // If the text contains JSON, format it nicely
    if (text.includes('{') && text.includes('}')) {
      try {
        // Try to parse and format JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          const formatted = JSON.stringify(parsed, null, 2);
          return text.replace(jsonStr, `<pre class="bg-dark text-light p-2 rounded small">${formatted}</pre>`);
        }
      } catch (e) {
        // If JSON parsing fails, return as is
      }
    }
    
    // Replace newlines with <br> tags for proper display
    return text.replace(/\n/g, '<br>');
  }

  checkDatabaseSchema() {
    this.chatService.getDatabaseSchema().subscribe({
      next: (response) => {
        const schemaMessage: ChatMessage = {
          id: this.generateId(),
          text: `Database Schema Information:\n\n${response.schema}`,
          isUser: false,
          timestamp: new Date()
        };
        this.messages.push(schemaMessage);
      },
      error: (error) => {
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          text: `Failed to get database schema: ${error.message}`,
          isUser: false,
          timestamp: new Date(),
          error: error.message
        };
        this.messages.push(errorMessage);
      }
    });
  }
} 