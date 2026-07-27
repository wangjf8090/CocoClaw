/**
 * @selfclaw/observability
 *
 * OpenTelemetry Observability Module - Agent 运行时可观测性
 *
 * 功能：
 *   - Span/Trace 管理：Agent 执行链路追踪
 *   - Metrics 采集：工具调用次数、执行耗时、Token 消耗、错误率
 *   - Logs 集成：结构化日志，关联 Trace ID
 *   - 导出支持：OTLP Collector（可配置 endpoint）、Console Exporter
 *   - 适配器模式：通过 TelemetryAdapter 接口对接外部遥测系统
 *
 * 快速开始：
 * ```typescript
 * import { initTelemetry } from '@selfclaw/observability';
 *
 * const tm = await initTelemetry({
 *   serviceName: 'my-agent',
 *   exporter: 'console',
 * });
 *
 * // 创建 Span
 * const span = tm.startSpan({ name: 'agent.run', kind: 'agent' });
 * // ... 执行逻辑 ...
 * span.end();
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
 *
 * 使用 OTel SDK 适配器：
 * ```typescript
 * import { TelemetryManager, OtelAdapter } from '@selfclaw/observability';
 *
 * const tm = TelemetryManager.getInstance();
 * const adapter = new OtelAdapter();
 * await tm.registerAdapter(adapter);
 * await tm.init({
 *   serviceName: 'my-agent',
 *   exporter: 'otlp',
 *   otlpEndpoint: 'http://localhost:4318',
 * });
 * ```
 */

// Core
export { TelemetryManager, getTelemetryManager, initTelemetry } from './telemetry.js';

// OTel Adapter
export { OtelAdapter } from './telemetry.js';

// Types
export type {
  ExporterType,
  TelemetryConfig,
  SpanOptions,
  MetricLabels,
  ExecutionLog,
  TelemetryHealth,
  TelemetrySpanContext,
  ManagedSpan,
  TelemetryAdapter,
} from './telemetry.js';

// Constants
export { DEFAULT_TELEMETRY_CONFIG } from './telemetry.js';