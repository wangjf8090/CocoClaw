/**
 * Skill Observability - OpenTelemetry 标准化可观测性模块
 * P1-3: 对标 MAF OpenTelemetry 可观测性
 *
 * 实现轻量级 OTLP-compatible 数据模型：
 * - Span: Plan → Execute(per batch) → Verify 三层嵌套
 * - Metric: taskCount/successRate/duration/llmCallReduction
 * - TraceContext: 跨请求传播的 traceId
 *
 * OTLP 导出可选（OTEL_EXPORTER_OTLP_ENDPOINT），默认输出到日志
 */


// ============================================================================
// Types
// ============================================================================

/** Span 状态 */
export type OtelStatus = "ok" | "error";

/** 结构化 Span（OTLP 兼容） */
export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number; // unix ms
  endTime: number;
  duration: number; // ms
  status: OtelStatus;
  attributes: Record<string, string | number | boolean>;
  events: OtelSpanEvent[];
}

export interface OtelSpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

/** Metric 样本 */
export interface OtelMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  traceId?: string;
  attributes: Record<string, string | number | boolean>;
}

/** 单次编排的可观测数据 */
export interface OrchestrationTrace {
  traceId: string;
  spans: OtelSpan[];
  metrics: OtelMetric[];
  startTime: number;
  endTime: number;
}

// ============================================================================
// In-Memory Trace Store (Ring Buffer)
// ============================================================================

const TRACE_BUFFER_SIZE = 100;
const traces: OrchestrationTrace[] = [];

/** 生成 8 字节 hex traceId */
function generateTraceId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 生成 8 字节 hex spanId */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Tracing Helpers
// ============================================================================

/**
 * 创建并记录一个 Span
 */
function startSpan(
  traceId: string,
  parentSpanId: string | undefined,
  name: string,
  attributes: Record<string, string | number | boolean> = {}
): OtelSpan {
  const spanId = generateSpanId();
  const startTime = Date.now();

  return { traceId, spanId, parentSpanId, name, startTime, endTime: 0, duration: 0, status: "ok", attributes, events: [] };
}

/**
 * 结束 Span 并计算 duration
 */
function endSpan(span: OtelSpan, status: OtelStatus = "ok"): OtelSpan {
  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;
  return span;
}

/**
 * 生成 OTEL Metric（直方图风格）
 */
function makeMetric(
  name: string,
  value: number,
  unit: string,
  traceId: string,
  attrs: Record<string, string | number | boolean> = {}
): OtelMetric {
  return { name, value, unit, timestamp: Date.now(), traceId, attributes: attrs };
}

// ============================================================================
// Observability Wrapper
// ============================================================================

import type { OrchestrationResult } from "./skill-orchestrator.js";
import type { CodeActBatchRecord } from "./skill-orchestrator.js";

/**
 * 为编排结果生成完整的可观测数据（Plan→Execute→Verify 三阶段 Span + Metrics）
 *
 * 使用方式：
 * ```typescript
 * const result = await orchestrate(goal, tasks, constraints, config);
 * const trace = generateOrchestrationTrace(traceId, result);
 * ```
 */
export function generateOrchestrationTrace(
  traceId: string,
  result: OrchestrationResult
): OrchestrationTrace {
  const spans: OtelSpan[] = [];
  const metrics: OtelMetric[] = [];
  const startTime = result.createdAt ? new Date(result.createdAt).getTime() : Date.now() - result.totalDuration;
  const endTime = result.completedAt ? new Date(result.completedAt).getTime() : Date.now();

  // === Plan Span ===
  const planSpan = startSpan(traceId, undefined, "orchestrator.plan", {
    "goal": result.goal,
    "task_count": result.plan.tasks.length,
    "parallel_groups": result.plan.parallelGroups.length,
    "intent": result.plan.goalModel?.intent ?? "unknown",
    "complexity": result.plan.goalModel?.complexity ?? 0,
  });
  // Plan 无独立 duration，从 task 执行时间推断
  endSpan(planSpan);
  spans.push(planSpan);

  // === Execute Span（包含 CodeAct Batches）===
  const execSpan = startSpan(traceId, planSpan.spanId, "orchestrator.execute", {
    "task_count": result.plan.tasks.length,
    "parallel_groups": result.plan.parallelGroups.length,
  });
  execSpan.attributes["execution.success_count"] = result.execution.successCount;
  execSpan.attributes["execution.failed_count"] = result.execution.failedCount;
  execSpan.attributes["execution.skipped_count"] = result.execution.skippedCount;

  // CodeAct Batch 子 Span
  for (const batch of result.execution.codeActBatches) {
    const batchSpan = startSpan(traceId, execSpan.spanId, `execute.batch.${batch.taskType}`, {
      "batch_id": batch.batchId,
      "task_count": batch.taskIds.length,
      "llm_calls_before": batch.llmCallReduction.before,
      "llm_calls_after": batch.llmCallReduction.after,
      "llm_calls_saved": batch.llmCallReduction.before - batch.llmCallReduction.after,
    });
    endSpan(batchSpan, batch.success ? "ok" : "error");
    execSpan.events.push({ name: `batch:${batch.batchId}`, timestamp: batchSpan.startTime });
    spans.push(batchSpan);

    // CodeAct 节省量 Metric
    metrics.push(makeMetric(
      "orchestrator.llm_calls.saved",
      batch.llmCallReduction.before - batch.llmCallReduction.after,
      "calls",
      traceId,
      { batch_id: batch.batchId, task_type: batch.taskType }
    ));
    metrics.push(makeMetric(
      "orchestrator.batch.duration",
      batch.duration,
      "ms",
      traceId,
      { batch_id: batch.batchId, task_type: batch.taskType }
    ));
  }

  endSpan(execSpan);
  spans.push(execSpan);

  // === Verify Span ===
  const verifySpan = startSpan(traceId, execSpan.spanId, "orchestrator.verify", {
    "goal_achieved": result.verification.goalAchieved,
    "goal_score": result.verification.goalScore,
    "retry_needed_count": result.verification.retryNeeded.length,
  });
  endSpan(verifySpan);
  spans.push(verifySpan);

  // === 全局 Metrics ===
  metrics.push(makeMetric("orchestrator.tasks.total", result.plan.tasks.length, "tasks", traceId));
  metrics.push(makeMetric("orchestrator.tasks.success", result.execution.successCount, "tasks", traceId));
  metrics.push(makeMetric("orchestrator.tasks.failed", result.execution.failedCount, "tasks", traceId));
  metrics.push(makeMetric("orchestrator.duration.total", result.totalDuration, "ms", traceId));
  metrics.push(makeMetric("orchestrator.goal_score", result.verification.goalScore, "score", traceId, { status: result.status }));
  metrics.push(makeMetric("orchestrator.goal_achieved", result.verification.goalAchieved ? 1 : 0, "bool", traceId));

  // CodeAct 汇总
  const totalBefore = result.execution.codeActBatches.reduce((s, b) => s + b.llmCallReduction.before, 0);
  const totalAfter = result.execution.codeActBatches.reduce((s, b) => s + b.llmCallReduction.after, 0);
  metrics.push(makeMetric("orchestrator.llm_calls.total", totalBefore, "calls", traceId, { phase: "before" }));
  metrics.push(makeMetric("orchestrator.llm_calls.total", totalAfter, "calls", traceId, { phase: "after" }));
  if (totalBefore > 0) {
    metrics.push(makeMetric("orchestrator.llm_calls.reduction_ratio", (totalBefore - totalAfter) / totalBefore, "ratio", traceId));
  }

  const trace: OrchestrationTrace = { traceId, spans, metrics, startTime, endTime };

  // Ring buffer
  traces.push(trace);
  if (traces.length > TRACE_BUFFER_SIZE) traces.shift();

  return trace;
}

/**
 * 查询可观测数据
 */
export function queryTraces(filter?: {
  traceId?: string;
  limit?: number;
  since?: number; // unix ms
}): OrchestrationTrace[] {
  let result = [...traces];

  if (filter?.traceId) {
    result = result.filter(t => t.traceId === filter!.traceId);
  }
  if (filter?.since !== undefined) {
    result = result.filter(t => t.startTime >= (filter!.since as number));
  }
  if (filter?.limit) {
    result = result.slice(-filter.limit);
  } else {
    result = result.slice(-20); // 默认返回最近 20 条
  }

  return result;
}

/**
 * 导出 OTLP 兼容格式（可用于转发到真实 OTLP endpoint）
 */
export function exportOtlpFormat(): {
  resourceSpans: unknown[];
  resourceMetrics: unknown[];
} {
  const now = new Date().toISOString();

  const resourceSpans = traces.flatMap(t =>
    t.spans.map(s => ({
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      name: s.name,
      startTimeOffset: s.startTime - t.startTime,
      endTimeOffset: s.endTime - t.startTime,
      attributes: Object.entries(s.attributes).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
      status: { code: s.status === "ok" ? 1 : 2 },
      events: s.events.map(e => ({ timeOffset: e.timestamp - t.startTime, name: e.name })),
    }))
  );

  const resourceMetrics = traces.flatMap(t =>
    t.metrics.map(m => ({
      name: m.name,
      unit: m.unit,
      histogram: {
        dataPoints: [{
          time: m.timestamp,
          count: 1,
          sum: m.value,
          bucketCounts: [],
          explicitBounds: [],
        }],
      },
      attributes: Object.entries(m.attributes).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
    }))
  );

  return { resourceSpans, resourceMetrics };
}
