import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sqlQuery?: string;
  data?: any[];
  error?: string;
}

export interface ChatResponse {
  sqlQuery: string | null;
  response: string;
  data?: any[];
  needsQuery?: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  sendMessage(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, { message });
  }

  getHealthStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }

  getDatabaseSchema(): Observable<any> {
    return this.http.get(`${this.apiUrl}/debug/schema`);
  }
} 