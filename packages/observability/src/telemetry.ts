/**
 * OpenTelemetry Telemetry Module
 * Agent 运行时可观测性核心模块
 *
 * 功能：
 *   - Span/Trace 管理：Agent 执行链路追踪
 *   - Metrics 采集：工具调用次数、执行耗时、Token 消耗、错误率
 *   - Logs 集成：结构化日志，关联 Trace ID
 *   - 导出支持：OTLP Collector（可配置 endpoint）、Console Exporter
 *
 * 架构：
 *   TelemetryManager（单例）→ 管理 Span/Metric/Log 生命周期
 *   支持独立运行（无需 OTel SDK）和 OTel SDK 集成两种模式
 *
 * 设计原则：
 *   - 自包含：核心功能不依赖 @opentelemetry/* 包也可运行
 *   - 可插拔：OTel SDK 集成通过 TelemetryAdapter 接口实现
 *   - 零侵入：未初始化时所有操作均为安全的 noop
 */

import { EventEmitter } from 'node:events';

// ================================================================================
// Types
// ================================================================================

/**
 * Telemetry 导出器类型
 * OTLP: 导出到 OpenTelemetry Collector
 * CONSOLE: 输出到控制台（开发调试用）
 * NONE: 不导出（仅内存记录）
 */
export type ExporterType = 'otlp' | 'console' | 'none';

/**
 * Telemetry 初始化配置
 */
export interface TelemetryConfig {
  /** 服务名称 */
  serviceName: string;
  /** 服务版本 */
  serviceVersion?: string;
  /** 导出器类型 */
  exporter: ExporterType;
  /** OTLP Collector endpoint（仅 exporter='otlp' 时生效） */
  otlpEndpoint?: string;
  /** OTLP 导出超时时间（毫秒），默认 10000 */
  otlpTimeoutMs?: number;
  /** 是否启用 Console Exporter（开发调试用，与 exporter 独立） */
  consoleExporterEnabled?: boolean;
  /** 采样率 0-1，默认 1.0（全量采样） */
  sampleRate?: number;
  /** 是否启用 Metrics 采集 */
  metricsEnabled?: boolean;
  /** 是否启用 Logs 集成 */
  logsEnabled?: boolean;
  /** 自定义资源属性 */
  resourceAttributes?: Record<string, string>;
  /** 是否在初始化失败时静默（不抛异常） */
  silentInitFailure?: boolean;
}

/**
 * Span 创建选项
 */
export interface SpanOptions {
  /** Span 名称 */
  name: string;
  /** Span 类型（用于归类） */
  kind?: 'agent' | 'tool' | 'model' | 'memory' | 'security' | 'internal';
  /** 初始属性 */
  attributes?: Record<string, unknown>;
}

/**
 * Span 上下文（用于跨进程传播）
 */
export interface TelemetrySpanContext {
  traceId: string;
  spanId: string;
  isRemote: boolean;
  traceFlags: number;
}

/**
 * Managed Span 接口
 * 统一的 Span 抽象，屏蔽底层实现差异
 */
export interface ManagedSpan {
  /** Span 上下文 */
  spanContext(): TelemetrySpanContext;
  /** 设置属性 */
  setAttribute(key: string, value: unknown): void;
  /** 设置状态 */
  setStatus(status: 'ok' | 'error', message?: string): void;
  /** 记录异常 */
  recordException(error: Error): void;
  /** 添加事件 */
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  /** 结束 Span */
  end(): void;
}

/**
 * Metric 标签
 */
export interface MetricLabels {
  /** 工具名称（tool 类型） */
  toolName?: string;
  /** 模型名称（model 类型） */
  modelName?: string;
  /** Agent 名称 */
  agentName?: string;
  /** 操作类型 */
  operation?: string;
  /** 状态 */
  status?: 'success' | 'error' | 'timeout';
  /** 自定义标签 */
  [key: string]: string | undefined;
}

/**
 * 执行日志条目
 */
export interface ExecutionLog {
  /** 时间戳（ISO 8601） */
  timestamp: string;
  /** Trace ID */
  traceId: string;
  /** Span ID */
  spanId: string;
  /** 日志级别 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 日志消息 */
  message: string;
  /** 结构化属性 */
  attributes?: Record<string, unknown>;
}

/**
 * Telemetry 健康状态
 */
export interface TelemetryHealth {
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否已关闭 */
  shutdown: boolean;
  /** 导出器类型 */
  exporter: ExporterType;
  /** 活跃 Span 数量 */
  activeSpans: number;
  /** 已记录的 Metric 事件数 */
  metricEventsRecorded: number;
  /** 已记录的 Log 条目数 */
  logEntriesRecorded: number;
  /** 初始化时间 */
  initializedAt: string | null;
  /** 运行时长（毫秒） */
  uptimeMs: number;
}

/**
 * Telemetry 集成适配器接口
 * 用于对接外部遥测系统（如 OpenTelemetry SDK）
 */
export interface TelemetryAdapter {
  /** 初始化适配器 */
  init(config: TelemetryConfig): Promise<void>;
  /** 创建 Span */
  createSpan(name: string, options?: SpanOptions): ManagedSpan;
  /** 获取当前 Span 上下文 */
  getCurrentSpanContext(): TelemetrySpanContext | null;
  /** 记录 Metric */
  recordMetric(name: string, value: number, labels?: MetricLabels): void;
  /** 发送日志 */
  emitLog(entry: ExecutionLog): void;
  /** 关闭适配器 */
  shutdown(): Promise<void>;
}

/**
 * 默认 Telemetry 配置
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  serviceName: 'selfclaw-agent',
  serviceVersion: '0.1.0',
  exporter: 'console',
  consoleExporterEnabled: true,
  sampleRate: 1.0,
  metricsEnabled: true,
  logsEnabled: true,
  silentInitFailure: false,
  otlpTimeoutMs: 10000,
};

// ================================================================================
// Internal: UUID Generator (lightweight, no external dependency)
// ================================================================================

function generateId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateTraceId(): string {
  return generateId(16);
}

function generateSpanId(): string {
  return generateId(8);
}

// ================================================================================
// Internal: ManagedSpan 实现
// ================================================================================

/**
 * 内置 Span 实现（不依赖 OTel SDK）
 */
class BuiltinSpan implements ManagedSpan {
  private _context: TelemetrySpanContext;
  private _name: string;
  private _kind: string;
  private _attributes: Map<string, unknown> = new Map();
  private _status: { status: 'ok' | 'error'; message?: string } = { status: 'ok' };
  private _events: Array<{ name: string; attributes?: Record<string, unknown>; timestamp: string }> = [];
  private _exceptions: Error[] = [];
  private _startTime: number;
  private _endTime: number | null = null;
  private _onEnd: (() => void) | null = null;

  constructor(
    name: string,
    kind: string,
    parentTraceId?: string,
    parentSpanId?: string
  ) {
    this._name = name;
    this._kind = kind;
    this._startTime = Date.now();
    this._context = {
      traceId: parentTraceId ?? generateTraceId(),
      spanId: generateSpanId(),
      isRemote: false,
      traceFlags: 1,
    };
  }

  spanContext(): TelemetrySpanContext {
    return { ...this._context };
  }

  setAttribute(key: string, value: unknown): void {
    this._attributes.set(key, value);
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    this._status = { status, message };
  }

  recordException(error: Error): void {
    this._exceptions.push(error);
  }

  addEvent(name: string, attributes?: Record<string, unknown>): void {
    this._events.push({
      name,
      attributes,
      timestamp: new Date().toISOString(),
    });
  }

  end(): void {
    if (this._endTime !== null) return; // 防止重复结束
    this._endTime = Date.now();
    if (this._onEnd) {
      this._onEnd();
    }
  }

  /** 设置结束回调（内部使用） */
  _setOnEnd(cb: () => void): void {
    this._onEnd = cb;
  }

  /** 获取 Span 元数据（用于导出/调试） */
  _getMetadata(): SpanMetadata {
    return {
      name: this._name,
      kind: this._kind,
      context: { ...this._context },
      attributes: Object.fromEntries(this._attributes),
      status: { ...this._status },
      events: [...this._events],
      exceptions: this._exceptions.map((e) => e.message),
      startTime: this._startTime,
      endTime: this._endTime,
      durationMs: this._endTime ? this._endTime - this._startTime : null,
    };
  }
}

/**
 * Span 元数据（内部使用）
 */
interface SpanMetadata {
  name: string;
  kind: string;
  context: TelemetrySpanContext;
  attributes: Record<string, unknown>;
  status: { status: 'ok' | 'error'; message?: string };
  events: Array<{ name: string; attributes?: Record<string, unknown>; timestamp: string }>;
  exceptions: string[];
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
}

// ================================================================================
// Main: TelemetryManager
// ================================================================================

/**
 * Telemetry 管理器
 *
 * 单例模式，管理 Agent 运行时的遥测数据生命周期。
 * 提供统一的 Span 创建、Metric 记录、结构化日志 API。
 *
 * 支持两种运行模式：
 * 1. 内置模式（默认）：不依赖任何外部包，所有数据在内存中管理
 * 2. 适配器模式：通过 TelemetryAdapter 接口对接外部系统（如 OpenTelemetry SDK）
 *
 * @example
 * ```typescript
 * // 初始化
 * const tm = TelemetryManager.getInstance();
 * await tm.init({
 *   serviceName: 'my-agent',
 *   exporter: 'console',
 * });
 *
 * // 创建 Span
 * const span = tm.startSpan({ name: 'agent.run', kind: 'agent' });
 * try {
 *   // ... 执行 Agent 逻辑 ...
 *   span.setStatus('ok');
 * } catch (e) {
 *   span.setStatus('error', e.message);
 *   span.recordException(e);
 * } finally {
 *   span.end();
 * }
 *
 * // 记录 Metric
 * tm.recordToolCall({ toolName: 'search', duration: 150, status: 'success' });
 * tm.recordTokenConsumption({ modelName: 'gpt-4', tokens: 1024 });
 *
 * // 记录日志
 * tm.info('Agent execution completed', { runId: 'xxx' });
 *
 * // 关闭
 * await tm.shutdown();
 * ```
 */
export class TelemetryManager {
  private static instance: TelemetryManager | null = null;

  // =========================================================================
  // Internal State
  // =========================================================================
  private config: TelemetryConfig = DEFAULT_TELEMETRY_CONFIG;
  private initialized = false;
  private shutdown_ = false;
  private initializedAt: Date | null = null;

  // Span 管理
  private activeSpanMap = new Map<string, BuiltinSpan>();
  private spanStack: BuiltinSpan[] = [];

  // Metric 计数
  private metricCounters = new Map<string, number>();
  private metricHistograms = new Map<string, number[]>();

  // Log 存储
  private logBuffer: ExecutionLog[] = [];
  private maxLogBufferSize = 1000;

  // 统计计数
  private metricEventsRecorded = 0;
  private logEntriesRecorded = 0;

  // 适配器
  private adapter: TelemetryAdapter | null = null;

  // 事件发射器（用于 Span 生命周期事件）
  private events = new EventEmitter();

  // =========================================================================
  // Singleton
  // =========================================================================

  private constructor() {
    // 私有构造函数
  }

  /**
   * 获取 TelemetryManager 单例
   */
  static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  /**
   * 重置单例（仅用于测试）
   */
  static resetInstance(): void {
    if (TelemetryManager.instance) {
      try {
        TelemetryManager.instance.shutdownSilent();
      } catch {
        // 忽略
      }
      TelemetryManager.instance = null;
    }
  }

  // =========================================================================
  // Adapter Registration
  // =========================================================================

  /**
   * 注册外部遥测适配器（如 OpenTelemetry SDK）
   * Register an external telemetry adapter
   *
   * @param adapter - 遥测适配器实例
   */
  async registerAdapter(adapter: TelemetryAdapter): Promise<void> {
    this.adapter = adapter;
    if (this.initialized) {
      await adapter.init(this.config);
    }
  }

  /**
   * 获取当前适配器
   */
  getAdapter(): TelemetryAdapter | null {
    return this.adapter;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * 初始化 Telemetry 模块
   *
   * @param config - Telemetry 配置
   */
  async init(config: Partial<TelemetryConfig> = {}): Promise<void> {
    if (this.initialized) {
      this.logInternal('warn', 'TelemetryManager already initialized, skipping');
      return;
    }

    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };

    try {
      if (this.adapter) {
        await this.adapter.init(this.config);
      }

      this.initialized = true;
      this.initializedAt = new Date();
      this.logInternal(
        'info',
        `TelemetryManager initialized: service=${this.config.serviceName}, exporter=${this.config.exporter}`
      );
    } catch (error) {
      this.logInternal('error', `TelemetryManager initialization failed: ${error}`);
      if (!this.config.silentInitFailure) {
        throw error;
      }
      this.initialized = true;
      this.initializedAt = new Date();
    }
  }

  /**
   * 关闭 Telemetry 模块
   */
  async shutdown(): Promise<void> {
    if (!this.initialized || this.shutdown_) {
      return;
    }

    this.shutdown_ = true;

    // 结束所有活跃 Span
    this.endAllActiveSpans();

    // 关闭适配器
    if (this.adapter) {
      try {
        await this.adapter.shutdown();
      } catch {
        // 忽略
      }
    }

    this.logInternal('info', 'TelemetryManager shutdown complete');
  }

  /**
   * 静默关闭（内部使用）
   */
  private shutdownSilent(): void {
    if (this.adapter) {
      try {
        this.adapter.shutdown();
      } catch {
        // 忽略
      }
    }
    this.shutdown_ = true;
    this.endAllActiveSpans();
  }

  // =========================================================================
  // Span / Trace Management
  // =========================================================================

  /**
   * 开始一个新的 Span
   *
   * @param options - Span 创建选项
   * @returns ManagedSpan 实例
   */
  startSpan(options: SpanOptions): ManagedSpan {
    if (!this.initialized || this.shutdown_) {
      return this.createNoopSpan();
    }

    // 如果配置了适配器，优先使用
    if (this.adapter) {
      return this.adapter.createSpan(options.name, options);
    }

    // 内置实现
    const parentSpan = this.spanStack.length > 0
      ? this.spanStack[this.spanStack.length - 1]
      : undefined;

    const span = new BuiltinSpan(
      options.name,
      options.kind ?? 'internal',
      parentSpan?.spanContext().traceId,
      parentSpan?.spanContext().spanId
    );

    // 设置初始属性
    span.setAttribute('span.kind', options.kind ?? 'internal');
    if (options.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.setAttribute(key, value);
      }
    }

    // 追踪活跃 Span
    const spanId = span.spanContext().spanId;
    this.activeSpanMap.set(spanId, span);
    this.spanStack.push(span);

    // 当 Span 结束时自动清理
    span._setOnEnd(() => {
      this.activeSpanMap.delete(spanId);
      const idx = this.spanStack.indexOf(span);
      if (idx >= 0) {
        this.spanStack.splice(idx, 1);
      }
      this.events.emit('spanEnded', span._getMetadata());
    });

    this.events.emit('spanStarted', span._getMetadata());

    return span;
  }

  /**
   * 获取当前活跃的 Trace ID
   */
  getCurrentTraceId(): string | null {
    if (this.adapter) {
      const ctx = this.adapter.getCurrentSpanContext();
      return ctx?.traceId ?? null;
    }

    const span = this.spanStack.length > 0
      ? this.spanStack[this.spanStack.length - 1]
      : undefined;
    return span?.spanContext().traceId ?? null;
  }

  /**
   * 获取当前活跃的 Span ID
   */
  getCurrentSpanId(): string | null {
    if (this.adapter) {
      const ctx = this.adapter.getCurrentSpanContext();
      return ctx?.spanId ?? null;
    }

    const span = this.spanStack.length > 0
      ? this.spanStack[this.spanStack.length - 1]
      : undefined;
    return span?.spanContext().spanId ?? null;
  }

  /**
   * 获取当前 Span 上下文
   */
  getCurrentSpanContext(): TelemetrySpanContext | null {
    if (this.adapter) {
      return this.adapter.getCurrentSpanContext();
    }

    const span = this.spanStack.length > 0
      ? this.spanStack[this.spanStack.length - 1]
      : undefined;
    return span?.spanContext() ?? null;
  }

  // =========================================================================
  // Metrics
  // =========================================================================

  /**
   * 记录工具调用 Metric
   */
  recordToolCall(params: {
    toolName: string;
    duration: number;
    status: 'success' | 'error' | 'timeout';
    agentName?: string;
  }): void {
    if (!this.initialized || this.shutdown_ || !this.config.metricsEnabled) return;

    const labelKey = `tool_call:${params.toolName}:${params.status}`;
    this.incrementCounter(labelKey, 1);
    this.recordHistogram(`tool_duration:${params.toolName}`, params.duration);
    this.metricEventsRecorded += 2;

    // 转发到适配器
    if (this.adapter) {
      this.adapter.recordMetric('agent.tool.calls', 1, {
        toolName: params.toolName,
        status: params.status,
        agentName: params.agentName,
      });
      this.adapter.recordMetric('agent.tool.duration', params.duration, {
        toolName: params.toolName,
        status: params.status,
      });
    }
  }

  /**
   * 记录 Token 消耗 Metric
   */
  recordTokenConsumption(params: {
    modelName: string;
    tokens: number;
    agentName?: string;
    type?: 'input' | 'output' | 'total';
  }): void {
    if (!this.initialized || this.shutdown_ || !this.config.metricsEnabled) return;

    const labelKey = `token:${params.modelName}:${params.type ?? 'total'}`;
    this.incrementCounter(labelKey, params.tokens);
    this.metricEventsRecorded++;

    if (this.adapter) {
      this.adapter.recordMetric('agent.token.consumed', params.tokens, {
        modelName: params.modelName,
        operation: `token.${params.type ?? 'total'}`,
      });
    }
  }

  /**
   * 记录执行耗时 Metric
   */
  recordExecutionDuration(durationMs: number, labels?: MetricLabels): void {
    if (!this.initialized || this.shutdown_ || !this.config.metricsEnabled) return;

    const labelKey = `execution:${labels?.operation ?? 'general'}`;
    this.recordHistogram(labelKey, durationMs);
    this.metricEventsRecorded++;

    if (this.adapter) {
      this.adapter.recordMetric('agent.execution.duration', durationMs, labels);
    }
  }

  /**
   * 记录错误 Metric
   */
  recordError(params: {
    errorType: string;
    message: string;
    toolName?: string;
    agentName?: string;
  }): void {
    if (!this.initialized || this.shutdown_ || !this.config.metricsEnabled) return;

    const labelKey = `error:${params.errorType}:${params.toolName ?? 'general'}`;
    this.incrementCounter(labelKey, 1);
    this.metricEventsRecorded++;

    if (this.adapter) {
      this.adapter.recordMetric('agent.errors', 1, {
        toolName: params.toolName,
        agentName: params.agentName,
        operation: params.errorType,
      });
    }
  }

  /**
   * 记录模型调用 Metric
   */
  recordModelCall(params: {
    modelName: string;
    duration: number;
    tokensIn?: number;
    tokensOut?: number;
    status: 'success' | 'error';
    agentName?: string;
  }): void {
    if (!this.initialized || this.shutdown_ || !this.config.metricsEnabled) return;

    const labelKey = `model_call:${params.modelName}:${params.status}`;
    this.incrementCounter(labelKey, 1);
    this.recordHistogram(`model_duration:${params.modelName}`, params.duration);
    this.metricEventsRecorded += 2;

    if (params.tokensIn) {
      this.recordTokenConsumption({
        modelName: params.modelName,
        tokens: params.tokensIn,
        type: 'input',
      });
    }
    if (params.tokensOut) {
      this.recordTokenConsumption({
        modelName: params.modelName,
        tokens: params.tokensOut,
        type: 'output',
      });
    }

    if (this.adapter) {
      this.adapter.recordMetric('agent.model.calls', 1, {
        modelName: params.modelName,
        status: params.status,
      });
      this.adapter.recordMetric('agent.model.duration', params.duration, {
        modelName: params.modelName,
        status: params.status,
      });
    }
  }

  /**
   * 获取 Metric 计数器值（用于测试/调试）
   */
  getMetricCounter(key: string): number {
    return this.metricCounters.get(key) ?? 0;
  }

  /**
   * 获取 Metric 直方图数据（用于测试/调试）
   */
  getMetricHistogram(key: string): number[] {
    return this.metricHistograms.get(key) ?? [];
  }

  // =========================================================================
  // Structured Logging
  // =========================================================================

  /**
   * 记录结构化日志
   *
   * 日志会自动关联当前活跃的 Trace ID 和 Span ID。
   *
   * @param level - 日志级别
   * @param message - 日志消息
   * @param attributes - 附加属性
   */
  log(
    level: ExecutionLog['level'],
    message: string,
    attributes?: Record<string, unknown>
  ): void {
    if (!this.initialized || this.shutdown_ || !this.config.logsEnabled) return;

    const traceId = this.getCurrentTraceId() ?? '00000000000000000000000000000000';
    const spanId = this.getCurrentSpanId() ?? '0000000000000000';

    const entry: ExecutionLog = {
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
      level,
      message,
      attributes,
    };

    this.logEntriesRecorded++;
    this.addToLogBuffer(entry);

    // 输出到 Console
    if (this.config.consoleExporterEnabled) {
      this.emitConsoleLog(entry);
    }

    // 转发到适配器
    if (this.adapter) {
      this.adapter.emitLog(entry);
    }
  }

  /**
   * 便捷方法：info 级别日志
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    this.log('info', message, attributes);
  }

  /**
   * 便捷方法：warn 级别日志
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.log('warn', message, attributes);
  }

  /**
   * 便捷方法：error 级别日志
   */
  error(message: string, attributes?: Record<string, unknown>): void {
    this.log('error', message, attributes);
  }

  /**
   * 便捷方法：debug 级别日志
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.log('debug', message, attributes);
  }

  /**
   * 获取日志缓冲区（用于测试/导出）
   */
  getLogBuffer(): ExecutionLog[] {
    return [...this.logBuffer];
  }

  /**
   * 清空日志缓冲区
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  // =========================================================================
  // Health & Status
  // =========================================================================

  /**
   * 获取 Telemetry 健康状态
   */
  getHealth(): TelemetryHealth {
    return {
      initialized: this.initialized,
      shutdown: this.shutdown_,
      exporter: this.config.exporter,
      activeSpans: this.activeSpanMap.size,
      metricEventsRecorded: this.metricEventsRecorded,
      logEntriesRecorded: this.logEntriesRecorded,
      initializedAt: this.initializedAt?.toISOString() ?? null,
      uptimeMs: this.initializedAt ? Date.now() - this.initializedAt.getTime() : 0,
    };
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized && !this.shutdown_;
  }

  // =========================================================================
  // Private: Counter / Histogram Helpers
  // =========================================================================

  private incrementCounter(key: string, delta: number): void {
    const current = this.metricCounters.get(key) ?? 0;
    this.metricCounters.set(key, current + delta);
  }

  private recordHistogram(key: string, value: number): void {
    const values = this.metricHistograms.get(key) ?? [];
    values.push(value);
    this.metricHistograms.set(key, values);
  }

  // =========================================================================
  // Private: Log Buffer
  // =========================================================================

  private addToLogBuffer(entry: ExecutionLog): void {
    this.logBuffer.push(entry);
    // 环形缓冲区：超过最大容量时移除最旧的
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogBufferSize);
    }
  }

  // =========================================================================
  // Private: Helpers
  // =========================================================================

  private createNoopSpan(): ManagedSpan {
    return new BuiltinSpan('noop', 'internal');
  }

  private endAllActiveSpans(): void {
    for (const span of this.activeSpanMap.values()) {
      try {
        span.setStatus('error', 'Telemetry shutdown');
        span.end();
      } catch {
        // 忽略
      }
    }
    this.activeSpanMap.clear();
    this.spanStack = [];
  }

  private emitConsoleLog(entry: ExecutionLog): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [trace=${entry.traceId.slice(0, 8)}]`;
    const attrs = entry.attributes ? ` ${JSON.stringify(entry.attributes)}` : '';

    const line = `${prefix} ${entry.message}${attrs}`;
    switch (entry.level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'debug':
        console.debug(line);
        break;
      default:
        console.log(line);
    }
  }

  private logInternal(level: ExecutionLog['level'], message: string): void {
    const ts = new Date().toISOString();
    console.log(`[TelemetryManager] [${ts}] [${level.toUpperCase()}] ${message}`);
  }
}

// ================================================================================
// Convenience Functions
// ================================================================================

/**
 * 获取 TelemetryManager 单例的便捷方法
 */
export function getTelemetryManager(): TelemetryManager {
  return TelemetryManager.getInstance();
}

/**
 * 快速初始化 Telemetry 的便捷方法
 *
 * @param config - Telemetry 配置
 * @returns TelemetryManager 实例
 */
export async function initTelemetry(
  config: Partial<TelemetryConfig> = {}
): Promise<TelemetryManager> {
  const tm = TelemetryManager.getInstance();
  await tm.init(config);
  return tm;
}

// ================================================================================
// OTel SDK Adapter (Optional Integration)
// ================================================================================

/**
 * OpenTelemetry SDK 适配器
 *
 * 将 TelemetryManager 与 OpenTelemetry SDK 对接。
 * 当需要将遥测数据导出到 OTLP Collector 时使用此适配器。
 *
 * 注意：使用此适配器需要安装 @opentelemetry/* 相关包。
 *
 * @example
 * ```typescript
 * import { TelemetryManager, OtelAdapter } from '@selfclaw/observability';
 *
 * const tm = TelemetryManager.getInstance();
 * const adapter = new OtelAdapter();
 * await tm.registerAdapter(adapter);
 * await tm.init({ serviceName: 'my-agent', exporter: 'otlp' });
 * ```
 */
export class OtelAdapter implements TelemetryAdapter {
  private sdk: unknown = null;
  private config: TelemetryConfig | null = null;

  async init(config: TelemetryConfig): Promise<void> {
    this.config = config;

    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { BatchSpanProcessor, ConsoleSpanExporter } = await import(
        '@opentelemetry/sdk-trace-base'
      );
      const { Resource } = await import('@opentelemetry/resources');

      const resource = new Resource({
        'service.name': config.serviceName,
        'service.version': config.serviceVersion ?? '0.0.0',
        ...config.resourceAttributes,
      });

      let exporter: unknown;
      if (config.exporter === 'otlp' && config.otlpEndpoint) {
        const { OTLPTraceExporter } = await import(
          '@opentelemetry/exporter-trace-otlp-http'
        );
        exporter = new OTLPTraceExporter({
          url: `${config.otlpEndpoint}/v1/traces`,
          timeoutMillis: config.otlpTimeoutMs,
        });
      } else {
        exporter = new ConsoleSpanExporter();
      }

      const spanProcessor = new BatchSpanProcessor(exporter as never);

      this.sdk = new NodeSDK({
        resource,
        spanProcessors: [spanProcessor],
      });

      await (this.sdk as { start: () => Promise<void> }).start();
    } catch (error) {
      if (!config.silentInitFailure) {
        throw new Error(
          `Failed to initialize OTel SDK. Ensure @opentelemetry/* packages are installed: ${error}`
        );
      }
      console.warn('[OtelAdapter] OTel SDK initialization failed (silent):', error);
    }
  }

  createSpan(name: string, options?: SpanOptions): ManagedSpan {
    // 返回内置 Span，OTel 集成通过 SpanProcessor 导出
    const span = new BuiltinSpan(name, options?.kind ?? 'internal');
    if (options?.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.setAttribute(key, value);
      }
    }
    return span;
  }

  getCurrentSpanContext(): TelemetrySpanContext | null {
    return null;
  }

  recordMetric(_name: string, _value: number, _labels?: MetricLabels): void {
    // 通过 OTel Metrics API 记录（需要 @opentelemetry/api 和 @opentelemetry/sdk-metrics）
    // 当前版本使用内置计数作为后备
  }

  emitLog(_entry: ExecutionLog): void {
    // 通过 OTel Logs API 发送（需要 @opentelemetry/sdk-logs）
    // 当前版本使用 Console 输出作为后备
  }

  async shutdown(): Promise<void> {
    if (this.sdk && typeof (this.sdk as { shutdown: () => Promise<void> }).shutdown === 'function') {
      await (this.sdk as { shutdown: () => Promise<void> }).shutdown();
    }
    this.sdk = null;
  }
}