/**
 * Gateway WebSocket Server
 * Main server implementation
 */

import { WebSocketServer, WebSocket } from 'ws';
import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { GatewayConfig, DEFAULT_GATEWAY_CONFIG, GatewayMessage } from './types.js';
import { AuthMiddleware } from './auth.js';
import { LaneManager } from './lane.js';
import { MessageRouter } from './router.js';

export interface ServerEvents {
  clientConnected: (clientId: string, ws: WebSocket) => void;
  clientDisconnected: (clientId: string) => void;
  messageReceived: (msg: GatewayMessage, clientId: string) => void;
  error: (error: Error, clientId?: string) => void;
}

export class GatewayServer extends EventEmitter<ServerEvents> {
  private config: GatewayConfig;
  private wss: WebSocketServer;
  private auth: AuthMiddleware;
  private laneManager: LaneManager;
  private router: MessageRouter;
  private clients: Map<string, WebSocket> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private started = false;

  constructor(config?: Partial<GatewayConfig>) {
    super();
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.auth = new AuthMiddleware(this.config.authToken);
    this.laneManager = new LaneManager();
    this.router = new MessageRouter(this.laneManager);
    this.wss = new WebSocketServer({ noServer: true });
    this.setupDefaultHandlers();
  }

  /**
   * Set up default message handlers
   */
  private setupDefaultHandlers(): void {
    // Handle connect messages
    this.router.onMessage('connect', async (msg, context) => {
      this.sendToClient(context.clientId, {
        id: uuidv4(),
        type: 'hello',
        timestamp: Date.now(),
        payload: {
          status: 'ok',
          sessionId: context.sessionId,
          gatewayVersion: '0.1.0',
          uptime: process.uptime(),
        },
        sessionId: context.sessionId,
      });
    });

    // Handle heartbeat
    this.router.onMessage('heartbeat', async (msg, context) => {
      this.sendToClient(context.clientId, {
        id: uuidv4(),
        type: 'heartbeat',
        timestamp: Date.now(),
        payload: { status: 'alive' },
        sessionId: context.sessionId,
      });
    });

    // Handle presence
    this.router.onMessage('presence', async (msg, context) => {
      this.sendToClient(context.clientId, {
        id: uuidv4(),
        type: 'presence',
        timestamp: Date.now(),
        payload: {
          onlineClients: this.clients.size,
          activeSessions: this.laneManager.getActiveCount(),
        },
        sessionId: context.sessionId,
      });
    });
  }

  /**
   * Start the Gateway server
   */
  start(port?: number, host?: string): Promise<void> {
    return new Promise((resolve) => {
      const actualPort = port || this.config.port;
      const actualHost = host || this.config.host;

      // Create a new WebSocketServer with the correct options
      this.wss = new WebSocketServer({
        port: actualPort,
        host: actualHost,
      });

      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });

      this.wss.on('listening', () => {
        this.started = true;
        this.startHeartbeat();
        console.log(`Gateway server started on ws://${actualHost}:${actualPort}`);
        resolve();
      });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    // Extract token from query params or headers
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const token = url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');

    const authContext = this.auth.authenticate(token);

    if (!authContext.isAuthenticated) {
      ws.close(401, 'Unauthorized');
      return;
    }

    const clientId = authContext.clientId!;
    this.clients.set(clientId, ws);

    // Setup message handler
    ws.on('message', (data) => {
      try {
        const msg: GatewayMessage = JSON.parse(data.toString());
        this.emit('messageReceived', msg, clientId);
        this.router.route(msg, { clientId, sessionId: msg.sessionId });
      } catch (error) {
        this.sendError(clientId, 'Invalid message format');
        this.emit('error', error as Error, clientId);
      }
    });

    // Setup close handler
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId);
    });

    // Setup error handler
    ws.on('error', (error) => {
      this.emit('error', error, clientId);
    });

    this.emit('clientConnected', clientId, ws);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, msg: GatewayMessage): boolean {
    const ws = this.clients.get(clientId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(msg: GatewayMessage): number {
    let count = 0;
    for (const [clientId] of this.clients) {
      if (this.sendToClient(clientId, msg)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Send error message to client
   */
  sendError(clientId: string, message: string, code?: string): void {
    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'error',
      timestamp: Date.now(),
      payload: { message, code },
    });
  }

  /**
   * Start heartbeat to check client liveness
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const msg: GatewayMessage = {
        id: uuidv4(),
        type: 'heartbeat',
        timestamp: Date.now(),
        payload: { ping: Date.now() },
      };
      this.broadcast(msg);
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      // Close all client connections
      for (const [, ws] of this.clients) {
        ws.close(1001, 'Server shutting down');
      }
      this.clients.clear();
      // Close the server
      this.wss.close(() => {
        this.started = false;
        resolve();
      });
    });
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      started: this.started,
      config: this.config,
      connectedClients: this.clients.size,
      activeSessions: this.laneManager.getActiveCount(),
    };
  }

  /**
   * Get the message router for handler registration
   */
  getRouter(): MessageRouter {
    return this.router;
  }

  /**
   * Get the lane manager
   */
  getLaneManager(): LaneManager {
    return this.laneManager;
  }
}
