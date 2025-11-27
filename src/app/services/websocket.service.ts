import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface DrawEvent {
  type: 'draw' | 'erase' | 'clear';
  x?: number;
  y?: number;
  color?: string;
  width?: number;
  userId?: string;
  timestamp?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  connectionId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectInterval = 5000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Observables
  private connectionStatus$ = new BehaviorSubject<ConnectionStatus>({ connected: false });
  private messages$ = new BehaviorSubject<DrawEvent | null>(null);

  // WebSocket URL (será configurado após criar na AWS)
  private wsUrl = '';

  constructor() {}

  /**
   * Conectar ao WebSocket
   * @param roomId ID da sala para conectar
   */
  connect(roomId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket já está conectado');
      return;
    }

    // TODO: Substituir pela URL real após criar API Gateway
    // Formato: wss://your-api-id.execute-api.us-east-1.amazonaws.com/production
    this.wsUrl = `ws://localhost:8080?roomId=${roomId}`;

    console.log(`Conectando ao WebSocket: ${this.wsUrl}`);

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        console.log('✅ WebSocket conectado com sucesso!');
        this.reconnectAttempts = 0;
        this.connectionStatus$.next({ connected: true });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 Mensagem recebida:', data);
          this.messages$.next(data);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ Erro no WebSocket:', error);
        this.connectionStatus$.next({
          connected: false,
          error: 'Erro na conexão WebSocket'
        });
      };

      this.socket.onclose = (event) => {
        console.log('🔌 WebSocket desconectado:', event.code, event.reason);
        this.connectionStatus$.next({ connected: false });

        // Tentar reconectar automaticamente
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(roomId), this.reconnectInterval);
        } else {
          console.error('❌ Máximo de tentativas de reconexão atingido');
        }
      };

    } catch (error) {
      console.error('❌ Erro ao criar WebSocket:', error);
      this.connectionStatus$.next({
        connected: false,
        error: 'Falha ao criar conexão WebSocket'
      });
    }
  }

  /**
   * Enviar evento de desenho
   */
  sendDrawEvent(event: DrawEvent): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket não está conectado');
      return;
    }

    try {
      const message = JSON.stringify({
        action: 'draw',
        data: {
          ...event,
          timestamp: Date.now()
        }
      });

      this.socket.send(message);
      console.log('📤 Evento enviado:', event.type);
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
    }
  }

  /**
   * Desconectar WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket...');
      this.socket.close(1000, 'Desconexão normal');
      this.socket = null;
      this.connectionStatus$.next({ connected: false });
    }
  }

  /**
   * Observar status da conexão
   */
  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Observar mensagens recebidas
   */
  getMessages(): Observable<DrawEvent | null> {
    return this.messages$.asObservable();
  }

  /**
   * Verificar se está conectado
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Configurar URL do WebSocket (após criar na AWS)
   */
  setWebSocketUrl(url: string): void {
    this.wsUrl = url;
  }
}
