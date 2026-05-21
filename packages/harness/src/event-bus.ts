/**
 * SelfClaw Event Bus
 * 统一事件总线
 * 
 * 职责：
 * 1. 订阅 Runtime 事件
 * 2. 转发给 Evolution Circuits + Test Harness
 * 3. 缓冲、过滤、重放
 */

import { EventEmitter } from 'events';
import {
  ClawEvent,
  ClawEventType,
  EventSink,
  EventBusConfig,
  ToolInvocation,
} from './types';

/**
 * EventBus - 统一事件总线
 */
export class EventBus extends EventEmitter {
  private config: EventBusConfig;
  private buffer: ClawEvent[] = [];
  private subscriptions: Map<string, Set<(event: ClawEvent) => void>> = new Map();
  private toolInvocations: Map<string, ToolInvocation> = new Map();
  private eventCounter: number = 0;

  constructor(config?: Partial<EventBusConfig>) {
    super();
    this.config = {
      bufferSize: config?.bufferSize || 1000,
      flushIntervalMs: config?.flushIntervalMs || 5000,
      enableReplay: config?.enableReplay !== false,
    };

    // 初始化事件订阅映射
    this.initializeSubscriptions();
  }

  /**
   * 初始化事件订阅映射
   */
  private initializeSubscriptions(): void {
    // Run 级别事件订阅
    this.addSubscription('run_started', () => {});
    this.addSubscription('run_finished', () => {});
    this.addSubscription('run_failed', () => {});

    // Model 级别事件订阅
    this.addSubscription('model_call_started', () => {});
    this.addSubscription('model_call_finished', () => {});
    this.addSubscription('model_call_failed', () => {});

    // Tool 级别事件订阅
    this.addSubscription('tool_call_started', () => {});
    this.addSubscription('tool_call_finished', () => {});
    this.addSubscription('tool_call_failed', () => {});
    this.addSubscription('tool_call_blocked', () => {});

    // Memory 级别事件订阅
    this.addSubscription('memory_read', () => {});
    this.addSubscription('memory_write', () => {});
    this.addSubscription('memory_promoted', () => {});
    this.addSubscription('memory_evicted', () => {});

    // Policy / Safety 级别事件订阅
    this.addSubscription('policy_check_started', () => {});
    this.addSubscription('policy_check_passed', () => {});
    this.addSubscription('policy_check_failed', () => {});
    this.addSubscription('safety_gate_triggered', () => {});

    // Human / Control 级别事件订阅
    this.addSubscription('human_confirmation_requested', () => {});
    this.addSubscription('human_confirmation_received', () => {});
  }

  /**
   * 添加事件订阅
   */
  private addSubscription(eventType: ClawEventType, handler: (event: ClawEvent) => void): void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(handler);
  }

  /**
   * 发射事件（Runtime 调用）
   */
  async emit(event: ClawEvent): Promise<void> {
    // 缓冲
    this.buffer.push(event);
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer.shift();
    }

    // 处理 Tool 调用状态
    this.processToolInvocation(event);

    // 通知订阅者
    const handlers = this.subscriptions.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`Event handler error for ${event.type}:`, err);
        }
      }
    }

    // 触发通用事件
    this.emit('claw_event', event);
  }

  /**
   * 处理 Tool 调用状态
   */
  private processToolInvocation(event: ClawEvent): void {
    const { type, payload } = event;
    const toolName = payload.tool_name as string;
    const runId = event.run_id;

    if (type === 'tool_call_started') {
      this.toolInvocations.set(`${runId}:${toolName}`, {
        tool_name: toolName,
        input: payload.input,
        started_at: event.ts,
        status: 'started',
      });
    } else if (type === 'tool_call_finished') {
      const key = `${runId}:${toolName}`;
      const invocation = this.toolInvocations.get(key);
      if (invocation) {
        invocation.output = payload.output;
        invocation.finished_at = event.ts;
        invocation.status = 'finished';
      }
    } else if (type === 'tool_call_failed') {
      const key = `${runId}:${toolName}`;
      const invocation = this.toolInvocations.get(key);
      if (invocation) {
        invocation.error = payload.error as string;
        invocation.finished_at = event.ts;
        invocation.status = 'failed';
      }
    } else if (type === 'tool_call_blocked') {
      const key = `${runId}:${toolName}`;
      const invocation = this.toolInvocations.get(key);
      if (invocation) {
        invocation.status = 'blocked';
      }
    }
  }

  /**
   * 订阅特定类型事件
   */
  onEvent(eventType: ClawEventType, handler: (event: ClawEvent) => void): () => void {
    this.addSubscription(eventType, handler);
    return () => {
      this.subscriptions.get(eventType)?.delete(handler);
    };
  }

  /**
   * 订阅所有事件
   */
  onAll(handler: (event: ClawEvent) => void): () => void {
    this.on('claw_event', handler);
    return () => {
      this.off('claw_event', handler);
    };
  }

  /**
   * 获取缓冲的事件
   */
  getBuffer(): ClawEvent[] {
    return [...this.buffer];
  }

  /**
   * 按 run_id 获取事件流
   */
  getEventsByRunId(runId: string): ClawEvent[] {
    return this.buffer.filter(e => e.run_id === runId);
  }

  /**
   * 按 session_id 获取事件流
   */
  getEventsBySessionId(sessionId: string): ClawEvent[] {
    return this.buffer.filter(e => e.session_id === sessionId);
  }

  /**
   * 获取某次 Run 的 Tool 调用记录
   */
  getToolInvocations(runId: string): ToolInvocation[] {
    const invocations: ToolInvocation[] = [];
    for (const [key, invocation] of this.toolInvocations.entries()) {
      if (key.startsWith(`${runId}:`)) {
        invocations.push(invocation);
      }
    }
    return invocations;
  }

  /**
   * 清空缓冲
   */
  flush(): void {
    this.buffer = [];
    this.eventCounter = 0;
  }

  /**
   * 清空缓冲但保留最近 N 条
   */
  trimBuffer(keepLast: number = 100): void {
    if (this.buffer.length > keepLast) {
      this.buffer = this.buffer.slice(-keepLast);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    toolInvocations: number;
  } {
    const eventTypes: Record<string, number> = {};
    for (const event of this.buffer) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.buffer.length,
      eventTypes,
      toolInvocations: this.toolInvocations.size,
    };
  }

  /**
   * 创建事件接收器（用于 Runtime）
   */
  createEventSink(): EventSink {
    const bus = this;
    return {
      async emit(event: ClawEvent): Promise<void> {
        await bus.emit(event);
      },
      async flush(): Promise<void> {
        // no-op for direct sink
      },
    };
  }

  /**
   * 重放指定 run 的事件流
   */
  replay(runId: string, handler: (event: ClawEvent) => void): void {
    const events = this.getEventsByRunId(runId);
    for (const event of events) {
      handler(event);
    }
  }

  /**
   * 过滤事件
   */
  filterEvents(predicate: (event: ClawEvent) => boolean): ClawEvent[] {
    return this.buffer.filter(predicate);
  }

  /**
   * 获取最后 N 条事件
   */
  getLastEvents(n: number = 10): ClawEvent[] {
    return this.buffer.slice(-n);
  }
}

/**
 * EventBus 单例（全局事件总线）
 */
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  globalEventBus = null;
}
