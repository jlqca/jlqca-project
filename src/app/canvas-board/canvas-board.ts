import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebSocketService, ConnectionStatus } from '../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-canvas-board',
  imports: [CommonModule, FormsModule],
  templateUrl: './canvas-board.html',
  styleUrl: './canvas-board.css',
  standalone: true
})
export class CanvasBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('drawingCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private isSelecting = false;

  // Ferramentas
  currentTool: 'pencil' | 'eraser' | 'select' = 'pencil';
  currentColor = '#000000';
  lineWidth = 2;

  // Seleção
  private selectionStart: { x: number; y: number } | null = null;
  private selectionEnd: { x: number; y: number } | null = null;
  private selectedImageData: ImageData | null = null;

  // Histórico para desfazer
  private history: ImageData[] = [];
  private historyStep = -1;

  // WebSocket
  connectionStatus: ConnectionStatus = { connected: false };
  roomId = 'default-room';
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private wsService: WebSocketService
  ) {}

  ngAfterViewInit() {
    this.initCanvas();
    this.connectWebSocket();
  }

  ngOnDestroy() {
    this.disconnectWebSocket();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Conectar ao WebSocket
  private connectWebSocket() {
    console.log('🔌 Iniciando conexão WebSocket...');

    // Conectar ao WebSocket
    this.wsService.connect(this.roomId);

    // Observar status da conexão
    const statusSub = this.wsService.getConnectionStatus().subscribe(status => {
      this.connectionStatus = status;
      console.log('Status da conexão:', status);
    });

    // Observar mensagens recebidas
    const messagesSub = this.wsService.getMessages().subscribe(message => {
      if (message) {
        console.log('Mensagem recebida:', message);
        // TODO: Implementar lógica de desenho colaborativo aqui
      }
    });

    this.subscriptions.push(statusSub, messagesSub);
  }

  // Desconectar WebSocket
  private disconnectWebSocket() {
    console.log('🔌 Desconectando WebSocket...');
    this.wsService.disconnect();
  }

  // Inicializar canvas
  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    this.ctx = ctx;

    // Configurar tamanho do canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Fundo branco
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Salvar estado inicial
    this.saveState();
  }

  // Eventos do mouse
  startDrawing(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.currentTool === 'select') {
      this.isSelecting = true;
      this.selectionStart = { x, y };
      this.selectionEnd = null;
    } else {
      this.isDrawing = true;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
    }
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing && !this.isSelecting) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isSelecting) {
      this.selectionEnd = { x, y };
      this.drawSelectionBox();
    } else if (this.isDrawing) {
      if (this.currentTool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.lineWidth = 20;
      } else {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
      }

      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveState();
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      if (this.selectionStart && this.selectionEnd) {
        this.captureSelection();
      }
    }
  }

  // Desenhar caixa de seleção
  private drawSelectionBox() {
    if (!this.selectionStart || !this.selectionEnd) return;

    // Redesenhar canvas
    this.restoreState();

    // Desenhar retângulo de seleção
    this.ctx.strokeStyle = '#0066ff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      this.selectionStart.x,
      this.selectionStart.y,
      this.selectionEnd.x - this.selectionStart.x,
      this.selectionEnd.y - this.selectionStart.y
    );
    this.ctx.setLineDash([]);
  }

  // Capturar área selecionada
  private captureSelection() {
    if (!this.selectionStart || !this.selectionEnd) return;

    const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

    this.selectedImageData = this.ctx.getImageData(x, y, width, height);

    // Resetar seleção
    this.selectionStart = null;
    this.selectionEnd = null;
    this.restoreState();
  }

  // Salvar estado para histórico
  private saveState() {
    const canvas = this.canvasRef.nativeElement;
    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remover estados futuros se estiver no meio do histórico
    this.history = this.history.slice(0, this.historyStep + 1);

    this.history.push(imageData);
    this.historyStep++;

    // Limitar histórico a 20 estados
    if (this.history.length > 20) {
      this.history.shift();
      this.historyStep--;
    }
  }

  // Restaurar último estado
  private restoreState() {
    if (this.historyStep >= 0 && this.history[this.historyStep]) {
      this.ctx.putImageData(this.history[this.historyStep], 0, 0);
    }
  }

  // Desfazer
  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.restoreState();
    }
  }

  // Refazer
  redo() {
    if (this.historyStep < this.history.length - 1) {
      this.historyStep++;
      this.restoreState();
    }
  }

  // Limpar canvas
  clearCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
  }

  // Selecionar ferramenta
  selectTool(tool: 'pencil' | 'eraser' | 'select') {
    this.currentTool = tool;
  }

  // Mudar cor
  changeColor(color: string) {
    this.currentColor = color;
    if (this.currentTool === 'eraser') {
      this.currentTool = 'pencil';
    }
  }

  // Mudar espessura
  changeLineWidth(width: number) {
    this.lineWidth = width;
  }

  // Baixar imagem
  downloadImage() {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = 'desenho.png';
    link.href = canvas.toDataURL();
    link.click();
  }

  // Voltar para home
  goBack() {
    this.router.navigate(['/']);
  }
}
