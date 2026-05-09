/**
 * WebSocket 实时推送服务器
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../monitoring/logger';
import { metricsManager } from '../monitoring/metrics';

export interface WSMessage {
  type: string;
  payload?: any;
  id?: string;
}

export interface WSSubscription {
  clientId: string;
  topics: string[];
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, WSSubscription> = new Map();
  private topics: Map<string, Set<string>> = new Map();

  attach(server: Server, path: string = '/ws'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      metricsManager.setActiveConnections('websocket', this.clients.size);

      logger.debug('WebSocket client connected', { clientId });

      ws.on('message', (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message, ws);
        } catch (error) {
          logger.error('Error parsing WebSocket message', error instanceof Error ? error : new Error(String(error)));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', error);
        this.handleDisconnect(clientId);
      });

      // 发送欢迎消息
      this.sendToClient(clientId, {
        type: 'connected',
        payload: { clientId, timestamp: new Date().toISOString() }
      });
    });

    logger.info('WebSocket server attached', { path });
  }

  private handleMessage(clientId: string, message: WSMessage, ws: WebSocket): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', id: message.id });
        break;

      case 'subscribe':
        this.handleSubscribe(clientId, message.payload);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message.payload);
        break;

      default:
        logger.debug('Unknown WebSocket message type', { type: message.type });
    }
  }

  private handleSubscribe(clientId: string, payload: { topics: string[] }): void {
    const { topics } = payload;
    const subscription = this.subscriptions.get(clientId) || { clientId, topics: [] };

    for (const topic of topics) {
      if (!subscription.topics.includes(topic)) {
        subscription.topics.push(topic);
      }

      if (!this.topics.has(topic)) {
        this.topics.set(topic, new Set());
      }
      this.topics.get(topic)!.add(clientId);
    }

    this.subscriptions.set(clientId, subscription);

    logger.debug('Client subscribed to topics', { clientId, topics });
  }

  private handleUnsubscribe(clientId: string, payload: { topics: string[] }): void {
    const { topics } = payload;
    const subscription = this.subscriptions.get(clientId);

    if (subscription) {
      subscription.topics = subscription.topics.filter(t => !topics.includes(t));

      for (const topic of topics) {
        if (this.topics.has(topic)) {
          this.topics.get(topic)!.delete(clientId);
        }
      }
    }

    logger.debug('Client unsubscribed from topics', { clientId, topics });
  }

  private handleDisconnect(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);

    if (subscription) {
      for (const topic of subscription.topics) {
        if (this.topics.has(topic)) {
          this.topics.get(topic)!.delete(clientId);
        }
      }
    }

    this.clients.delete(clientId);
    this.subscriptions.delete(clientId);
    metricsManager.setActiveConnections('websocket', this.clients.size);

    logger.debug('WebSocket client disconnected', { clientId });
  }

  publish(topic: string, payload: any): void {
    const subscribers = this.topics.get(topic);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: WSMessage = {
      type: 'event',
      payload: {
        topic,
        data: payload,
        timestamp: new Date().toISOString()
      }
    };

    const messageStr = JSON.stringify(message);

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }

    metricsManager.incrementMetric('websocket_published');
  }

  broadcast(message: WSMessage): void {
    const messageStr = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  sendToClient(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId);

    if (!client || client.readyState !== WebSocket.OPEN) {
      return false;
    }

    client.send(JSON.stringify(message));
    return true;
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getTopics(): string[] {
    return Array.from(this.topics.keys());
  }

  getTopicSubscribers(topic: string): number {
    return this.topics.get(topic)?.size || 0;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

export const wsManager = new WebSocketManager();
export default WebSocketManager;
