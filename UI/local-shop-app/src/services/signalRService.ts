import * as signalR from '@microsoft/signalr';
import { HUB_URL } from './apiConfig';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private isConnecting: boolean = false;

  public getConnection(): signalR.HubConnection {
    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();
    }
    return this.connection;
  }

  public async startConnection(): Promise<void> {
    const conn = this.getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected && !this.isConnecting) {
      this.isConnecting = true;
      try {
        await conn.start();
        console.log('SignalR connected successfully to', HUB_URL);
      } catch (err) {
        console.warn('SignalR connection failed (will retry automatically):', err);
      } finally {
        this.isConnecting = false;
      }
    }
  }

  public onNewOrder(callback: (order: any) => void): () => void {
    const conn = this.getConnection();
    conn.on('ReceiveNewOrder', callback);
    this.startConnection();
    return () => conn.off('ReceiveNewOrder', callback);
  }

  public onPriceQuote(callback: (data: { orderId: string; quoteAmount: number; order: any }) => void): () => void {
    const conn = this.getConnection();
    conn.on('ReceivePriceQuote', callback);
    this.startConnection();
    return () => conn.off('ReceivePriceQuote', callback);
  }

  public onOrderStatusUpdated(callback: (data: { orderId: string; status: string; order: any }) => void): () => void {
    const conn = this.getConnection();
    conn.on('OrderStatusUpdated', callback);
    this.startConnection();
    return () => conn.off('OrderStatusUpdated', callback);
  }

  public onOrderMessage(callback: (message: any) => void): () => void {
    const conn = this.getConnection();
    conn.on('ReceiveOrderMessage', callback);
    this.startConnection();
    return () => conn.off('ReceiveOrderMessage', callback);
  }
}

export const signalRService = new SignalRService();
