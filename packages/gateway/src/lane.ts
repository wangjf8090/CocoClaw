/**
 * Lane Session Queue System
 * Serial execution to prevent race conditions
 */

import { v4 as uuidv4 } from 'uuid';
import { GatewayMessage, SessionState } from './types.js';

export class Lane {
  private queue: GatewayMessage[] = [];
  private processing = false;
  private sessionId: string;
  private state: SessionState;
  private onMessageHandler: (msg: GatewayMessage) => Promise<void>;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.state = {
      id: this.sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      isProcessing: false,
    };
    this.onMessageHandler = async () => {};
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getState(): SessionState {
    return { ...this.state };
  }

  onMessage(handler: (msg: GatewayMessage) => Promise<void>): void {
    this.onMessageHandler = handler;
  }

  /**
   * Enqueue a message for serial processing
   */
  enqueue(msg: GatewayMessage): void {
    const messageWithSession: GatewayMessage = {
      ...msg,
      sessionId: this.sessionId,
    };
    this.queue.push(messageWithSession);
    this.state.messages.push(messageWithSession);
    this.state.lastActivity = Date.now();
    this.processQueue();
  }

  /**
   * Process queue serially - one message at a time
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.state.isProcessing = true;

    try {
      const msg = this.queue.shift();
      if (msg) {
        await this.onMessageHandler(msg);
      }
    } finally {
      this.processing = false;
      this.state.isProcessing = false;
      // Process next message if queue is not empty
      if (this.queue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear the lane state
   */
  clear(): void {
    this.queue = [];
    this.state.messages = [];
  }
}

export class LaneManager {
  private lanes: Map<string, Lane> = new Map();

  createLane(sessionId?: string): Lane {
    const lane = new Lane(sessionId);
    this.lanes.set(lane.getSessionId(), lane);
    return lane;
  }

  getLane(sessionId: string): Lane | undefined {
    return this.lanes.get(sessionId);
  }

  getOrCreateLane(sessionId?: string): Lane {
    if (sessionId) {
      const existing = this.lanes.get(sessionId);
      if (existing) return existing;
    }
    return this.createLane(sessionId);
  }

  removeLane(sessionId: string): boolean {
    return this.lanes.delete(sessionId);
  }

  getAllLanes(): Lane[] {
    return Array.from(this.lanes.values());
  }

  getActiveCount(): number {
    return this.lanes.size;
  }
}
