import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Connected to Voice Gateway');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Voice Gateway');
    });
    
    this.socket.on('connect_error', (err: any) => {
        console.error('Connection Error:', err);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
  
  public emit(event: string, data: any) {
      this.socket?.emit(event, data);
  }
  
  public on(event: string, callback: (...args: any[]) => void) {
      this.socket?.on(event, callback);
  }
  
  public off(event: string) {
      this.socket?.off(event);
  }
}

export const socketService = SocketService.getInstance();
