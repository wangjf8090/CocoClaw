/**
 * Message Router
 * Routes messages to appropriate handlers
 */

import EventEmitter from 'eventemitter3';
import { GatewayMessage, MessageType } from './types.js';
import { LaneManager } from './lane.js';

export type MessageHandler = (
  msg: GatewayMessage,
  context: { clientId: string; sessionId?: string }
) => Promise<void> | void;

export class MessageRouter extends EventEmitter {
  private handlers: Map<MessageType, MessageHandler[]> = new Map();
  private laneManager: LaneManager;

  constructor(laneManager: LaneManager) {
    super();
    this.laneManager = laneManager;
  }

  /**
   * Register a handler for a specific message type
   */
  onMessage(type: MessageType, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Route a message to appropriate handlers
   */
  async route(
    msg: GatewayMessage,
    context: { clientId: string; sessionId?: string }
  ): Promise<void> {
    const handlers = this.handlers.get(msg.type) || [];

    // Route through session lane for serial processing
    if (msg.type === 'chat' || msg.type === 'agent' || msg.type === 'tool_result') {
      const lane = this.laneManager.getOrCreateLane(context.sessionId);
      lane.enqueue(msg);

      lane.onMessage(async (message) => {
        for (const handler of handlers) {
          await handler(message, { ...context, sessionId: lane.getSessionId() });
        }
      });
    } else {
      // Immediate processing for other message types
      for (const handler of handlers) {
        await handler(msg, context);
      }
    }

    this.emit('routed', msg);
  }

  /**
   * Broadcast a message to all registered handlers
   */
  broadcast(type: MessageType, payload: Record<string, unknown>): GatewayMessage {
    const msg: GatewayMessage = {
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      payload,
    };
    this.emit('broadcast', msg);
    return msg;
  }
}
