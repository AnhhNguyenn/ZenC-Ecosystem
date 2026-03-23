import { io, Socket } from 'socket.io-client';

/**
 * SocketService – Singleton managing the Socket.io connection to the
 * ZenC Gateway's /voice namespace.
 *
 * Design decisions:
 * - Singleton pattern prevents multiple connections from the same browser tab.
 * - Connects to the /voice namespace specifically (per gateway-server config).
 * - Token is passed as `auth.token` for JWT verification in the gateway's
 *   handleConnection lifecycle hook.
 */
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

  /**
   * Connect to the /voice namespace of the Gateway.
   * @param token - JWT access token from AuthContext/memory store.
   */
  public connect(token: string) {
    if (this.socket?.connected) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // FIX: Must connect to the /voice namespace as defined in VoiceGateway
    // @WebSocketGateway({ namespace: '/voice', transports: ['websocket'] })
    this.socket = io(`${baseUrl}/voice`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to /voice namespace');
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    this.socket.on('error', (data: { message: string; code?: string }) => {
      console.error('[Socket] Server error:', data.message);
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

  public emit(event: string, data: unknown) {
    this.socket?.emit(event, data);
  }

  public on(event: string, callback: (...args: unknown[]) => void) {
    this.socket?.on(event, callback);
  }

  public off(event: string, callback?: (...args: unknown[]) => void) {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }
}

export const socketService = SocketService.getInstance();
