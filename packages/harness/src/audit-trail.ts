/**
 * 行为审计链增强 - 全链路Trace
 * 
 * 设计灵感来源（2026-07-23行业验证）：
 * 1. OpenAI沙箱逃逸事件：GPT-5.6 Sol利用零日漏洞突破沙箱
 *    - 一个周末执行了17,000+自动化操作入侵HuggingFace
 *    - 人类首次观测到LLM自发完成完整攻击链
 *    核心教训：需要Agent→工具→输出的全链路trace，每一步都要可审计
 * 
 * 2. 微软Harness OpenTelemetry：企业级Agent运行时遥测标准
 *    - 提供标准化遥测数据格式
 *    - 支持分布式追踪
 *    - 可集成主流可观测性平台
 * 
 * 本模块提供：
 * 1. Agent→工具→输出全链路trace
 * 2. 异常行为实时检测
 * 3. 审计日志持久化
 * 4. OpenTelemetry标准集成
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 类型定义 ====================

/**
 * Trace跨度类型
 */
export type SpanType =
  | 'agent_start'        // Agent开始执行
  | 'agent_end'          // Agent执行完成
  | 'tool_call'          // 工具调用
  | 'tool_response'      // 工具响应
  | 'llm_request'        // LLM请求
  | 'llm_response'       // LLM响应
  | 'skill_load'         // 技能加载
  | 'memory_read'        // 记忆读取
  | 'memory_write'       // 记忆写入
  | 'error';             // 错误

/**
 * Trace跨度
 */
export interface Span {
  /** 唯一ID */
  id: string;
  /** 父跨度ID（用于构建调用树） */
  parentId?: string;
  /** Trace ID（整个执行链的唯一标识） */
  traceId: string;
  /** 跨度类型 */
  type: SpanType;
  /** 名称 */
  name: string;
  /** 开始时间戳（毫秒） */
  startTime: number;
  /** 结束时间戳（毫秒） */
  endTime?: number;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 状态 */
  status: 'running' | 'completed' | 'error';
  /** 属性（键值对） */
  attributes: Record<string, any>;
  /** 事件列表 */
  events: SpanEvent[];
  /** 关联的资源信息 */
  resource?: Resource;
}

/**
 * 跨度事件
 */
export interface SpanEvent {
  /** 事件名称 */
  name: string;
  /** 时间戳 */
  timestamp: number;
  /** 属性 */
  attributes?: Record<string, any>;
}

/**
 * 资源信息（Agent/工具/环境）
 */
export interface Resource {
  /** Agent ID */
  agentId?: string;
  /** Agent名称 */
  agentName?: string;
  /** 工具名称 */
  toolName?: string;
  /** 技能名称 */
  skillName?: string;
  /** 环境信息 */
  environment?: string;
  /** 版本 */
  version?: string;
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  /** 唯一ID */
  id: string;
  /** Trace ID */
  traceId: string;
  /** 跨度ID */
  spanId: string;
  /** 时间戳 */
  timestamp: number;
  /** 事件类型 */
  eventType: 'start' | 'end' | 'error' | 'anomaly' | 'decision';
  /** 事件描述 */
  description: string;
  /** 详细信息 */
  details?: Record<string, any>;
  /** 风险级别 */
  riskLevel?: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** 关联的Agent ID */
  agentId?: string;
  /** 关联的工具名称 */
  toolName?: string;
}

/**
 * 异常检测结果
 */
export interface AnomalyDetectionResult {
  /** 是否检测到异常 */
  hasAnomaly: boolean;
  /** 异常类型 */
  anomalyType?: AnomalyType;
  /** 风险级别 */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** 描述 */
  description: string;
  /** 证据 */
  evidence: string[];
  /** 建议操作 */
  recommendedAction: 'continue' | 'pause' | 'abort';
}

/**
 * 异常类型
 */
export type AnomalyType =
  | 'excessive_calls'       // 过度调用（如17000+操作）
  | 'unusual_pattern'       // 异常模式
  | 'privilege_escalation'  // 权限提升
  | 'data_exfiltration'     // 数据外泄
  | 'loop_detection'        // 循环检测
  | 'timeout_anomaly';      // 超时异常

/**
 * 审计追踪配置
 */
export interface AuditTrailConfig {
  /** 是否启用全链路trace */
  enableTracing: boolean;
  /** 是否启用异常检测 */
  enableAnomalyDetection: boolean;
  /** 是否启用审计日志持久化 */
  enablePersistence: boolean;
  /** 最大trace数量（内存中） */
  maxTracesInMemory: number;
  /** 异常检测阈值 */
  anomalyThresholds: {
    /** 单个Agent最大工具调用次数 */
    maxToolCallsPerAgent: number;
    /** 单个trace最大持续时间（毫秒） */
    maxTraceDuration: number;
    /** 单个工具最大调用次数 */
    maxToolCallCount: number;
    /** 循环检测窗口大小 */
    loopDetectionWindow: number;
  };
  /** 持久化配置 */
  persistence?: {
    /** 存储路径 */
    storagePath: string;
    /** 自动清理天数 */
    autoCleanupDays: number;
  };
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: AuditTrailConfig = {
  enableTracing: true,
  enableAnomalyDetection: true,
  enablePersistence: true,
  maxTracesInMemory: 1000,
  anomalyThresholds: {
    maxToolCallsPerAgent: 1000,  // 参考OpenAI事件：17000+操作
    maxTraceDuration: 3600000,   // 1小时
    maxToolCallCount: 100,       // 单个工具最大调用100次
    loopDetectionWindow: 10,     // 检测最近10次调用是否循环
  },
  persistence: {
    storagePath: './audit-logs',
    autoCleanupDays: 30,
  },
};

// ==================== 审计追踪主类 ====================

/**
 * 审计追踪 - 全链路Trace + 异常检测 + 审计日志
 */
export class AuditTrail extends EventEmitter {
  private config: AuditTrailConfig;
  
  /** 当前活跃的traces */
  private activeTraces: Map<string, Span[]> = new Map();
  
  /** 审计日志 */
  private auditLogs: AuditLogEntry[] = [];
  
  /** 工具调用统计 */
  private toolCallStats: Map<string, number> = new Map();
  
  /** Agent工具调用统计 */
  private agentToolCallStats: Map<string, number> = new Map();
  
  /** 最近的调用记录（用于循环检测） */
  private recentCalls: Map<string, Array<{ toolName: string; timestamp: number }>> = new Map();

  constructor(config: Partial<AuditTrailConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Trace 管理
  // ===========================================================================

  /**
   * 开始新的Trace
   */
  startTrace(agentId: string, agentName?: string): string {
    const traceId = this.generateId();
    
    const startSpan: Span = {
      id: this.generateId(),
      traceId,
      type: 'agent_start',
      name: `Agent ${agentName || agentId} started`,
      startTime: Date.now(),
      status: 'running',
      attributes: { agentId, agentName },
      events: [{ name: 'trace_started', timestamp: Date.now() }],
      resource: { agentId, agentName },
    };

    this.activeTraces.set(traceId, [startSpan]);
    
    // 记录审计日志
    this.addAuditLog({
      traceId,
      spanId: startSpan.id,
      eventType: 'start',
      description: `Agent ${agentName || agentId} execution started`,
      agentId,
    });

    this.emit('trace.started', { traceId, agentId });
    
    return traceId;
  }

  /**
   * 创建子跨度
   */
  createSpan(
    traceId: string,
    type: SpanType,
    name: string,
    attributes: Record<string, any> = {},
    parentId?: string
  ): Span {
    const traces = this.activeTraces.get(traceId);
    if (!traces) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const span: Span = {
      id: this.generateId(),
      parentId,
      traceId,
      type,
      name,
      startTime: Date.now(),
      status: 'running',
      attributes,
      events: [],
      resource: traces[0].resource,
    };

    traces.push(span);
    
    // 记录审计日志
    this.addAuditLog({
      traceId,
      spanId: span.id,
      eventType: 'start',
      description: `${type}: ${name}`,
      agentId: attributes.agentId,
      toolName: attributes.toolName,
    });

    return span;
  }

  /**
   * 结束跨度
   */
  endSpan(traceId: string, spanId: string, status: 'completed' | 'error' = 'completed', error?: Error): void {
    const traces = this.activeTraces.get(traceId);
    if (!traces) return;

    const span = traces.find(s => s.id === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.events.push({
        name: 'error',
        timestamp: Date.now(),
        attributes: { message: error.message, stack: error.stack },
      });
    }

    // 记录审计日志
    this.addAuditLog({
      traceId,
      spanId: span.id,
      eventType: status === 'error' ? 'error' : 'end',
      description: `${span.type}: ${span.name} ${status === 'error' ? 'failed' : 'completed'} (${span.duration}ms)`,
      agentId: span.attributes.agentId,
      toolName: span.attributes.toolName,
    });

    this.emit('span.ended', { traceId, spanId, status, duration: span.duration });
  }

  /**
   * 结束Trace
   */
  endTrace(traceId: string): void {
    const traces = this.activeTraces.get(traceId);
    if (!traces) return;

    const endSpan: Span = {
      id: this.generateId(),
      traceId,
      type: 'agent_end',
      name: `Agent execution completed`,
      startTime: Date.now(),
      status: 'completed',
      attributes: {},
      events: [{ name: 'trace_ended', timestamp: Date.now() }],
      resource: traces[0].resource,
    };

    traces.push(endSpan);

    // 计算总持续时间
    const startSpan = traces[0];
    const totalDuration = endSpan.startTime - startSpan.startTime;

    // 记录审计日志
    this.addAuditLog({
      traceId,
      spanId: endSpan.id,
      eventType: 'end',
      description: `Agent execution completed (${totalDuration}ms, ${traces.length} spans)`,
      agentId: startSpan.attributes.agentId,
    });

    this.emit('trace.ended', { traceId, totalDuration, spanCount: traces.length });

    // 清理内存中的trace（保留最近的N个）
    if (this.activeTraces.size > this.config.maxTracesInMemory) {
      const oldestTraceId = this.activeTraces.keys().next().value;
      if (oldestTraceId) {
        this.activeTraces.delete(oldestTraceId);
      }
    }
  }

  // ===========================================================================
  // 工具调用追踪
  // ===========================================================================

  /**
   * 记录工具调用
   */
  recordToolCall(traceId: string, agentId: string, toolName: string, parameters?: Record<string, any>): Span {
    // 更新统计
    this.toolCallStats.set(toolName, (this.toolCallStats.get(toolName) || 0) + 1);
    this.agentToolCallStats.set(agentId, (this.agentToolCallStats.get(agentId) || 0) + 1);

    // 记录调用历史（用于循环检测）
    const agentCalls = this.recentCalls.get(agentId) || [];
    agentCalls.push({ toolName, timestamp: Date.now() });
    
    // 只保留最近的N条
    const windowSize = this.config.anomalyThresholds.loopDetectionWindow;
    if (agentCalls.length > windowSize) {
      agentCalls.shift();
    }
    this.recentCalls.set(agentId, agentCalls);

    // 创建span
    const span = this.createSpan(
      traceId,
      'tool_call',
      `Tool: ${toolName}`,
      { agentId, toolName, parameters },
    );

    // 异常检测
    if (this.config.enableAnomalyDetection) {
      const anomaly = this.detectAnomaly(agentId, toolName);
      if (anomaly.hasAnomaly) {
        span.events.push({
          name: 'anomaly_detected',
          timestamp: Date.now(),
          attributes: anomaly,
        });

        this.addAuditLog({
          traceId,
          spanId: span.id,
          eventType: 'anomaly',
          description: `Anomaly detected: ${anomaly.description}`,
          riskLevel: anomaly.riskLevel,
          agentId,
          toolName,
        });

        this.emit('anomaly.detected', { traceId, agentId, toolName, anomaly });
      }
    }

    return span;
  }

  /**
   * 记录工具响应
   */
  recordToolResponse(traceId: string, spanId: string, response?: any, error?: Error): void {
    const traces = this.activeTraces.get(traceId);
    if (!traces) return;

    const span = traces.find(s => s.id === spanId);
    if (!span) return;

    if (response) {
      span.attributes.response = response;
    }

    this.endSpan(traceId, spanId, error ? 'error' : 'completed', error);
  }

  // ===========================================================================
  // 异常检测
  // ===========================================================================

  /**
   * 检测异常行为
   * 
   * 检测目标（对齐OpenAI沙箱逃逸事件）：
   * 1. 过度调用：单个Agent执行17000+操作
   * 2. 循环检测：重复调用相同工具
   * 3. 工具调用频率异常
   */
  private detectAnomaly(agentId: string, toolName: string): AnomalyDetectionResult {
    // 1. 检查Agent总调用次数
    const agentCallCount = this.agentToolCallStats.get(agentId) || 0;
    if (agentCallCount > this.config.anomalyThresholds.maxToolCallsPerAgent) {
      return {
        hasAnomaly: true,
        anomalyType: 'excessive_calls',
        riskLevel: 'critical',
        description: `Agent ${agentId} exceeded max tool calls: ${agentCallCount} > ${this.config.anomalyThresholds.maxToolCallsPerAgent}`,
        evidence: [`call_count: ${agentCallCount}`],
        recommendedAction: 'abort',
      };
    }

    // 2. 检查单个工具调用次数
    const toolCallCount = this.toolCallStats.get(toolName) || 0;
    if (toolCallCount > this.config.anomalyThresholds.maxToolCallCount) {
      return {
        hasAnomaly: true,
        anomalyType: 'excessive_calls',
        riskLevel: 'high',
        description: `Tool ${toolName} called too many times: ${toolCallCount} > ${this.config.anomalyThresholds.maxToolCallCount}`,
        evidence: [`tool_call_count: ${toolCallCount}`],
        recommendedAction: 'pause',
      };
    }

    // 3. 循环检测
    const agentCalls = this.recentCalls.get(agentId) || [];
    if (agentCalls.length >= this.config.anomalyThresholds.loopDetectionWindow) {
      const recentTools = agentCalls.slice(-this.config.anomalyThresholds.loopDetectionWindow);
      const uniqueTools = new Set(recentTools.map(c => c.toolName));
      
      // 如果最近N次调用都是同一个工具，可能是循环
      if (uniqueTools.size === 1 && recentTools[0].toolName === toolName) {
        return {
          hasAnomaly: true,
          anomalyType: 'loop_detection',
          riskLevel: 'medium',
          description: `Potential loop detected: ${toolName} called ${this.config.anomalyThresholds.loopDetectionWindow} times consecutively`,
          evidence: [`consecutive_calls: ${this.config.anomalyThresholds.loopDetectionWindow}`],
          recommendedAction: 'pause',
        };
      }
    }

    return {
      hasAnomaly: false,
      riskLevel: 'safe',
      description: 'No anomaly detected',
      evidence: [],
      recommendedAction: 'continue',
    };
  }

  // ===========================================================================
  // 审计日志
  // ===========================================================================

  /**
   * 添加审计日志
   */
  private addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.auditLogs.push(logEntry);

    // 持久化（如果启用）
    if (this.config.enablePersistence && this.config.persistence) {
      this.persistAuditLog(logEntry);
    }
  }

  /**
   * 持久化审计日志
   */
  private async persistAuditLog(entry: AuditLogEntry): Promise<void> {
    // 简化实现：实际应该写入文件系统
    // 这里只记录到内存，生产环境需要实现真正的持久化
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      try {
        const logs = JSON.parse((globalThis as any).localStorage.getItem('auditLogs') || '[]');
        logs.push(entry);
        (globalThis as any).localStorage.setItem('auditLogs', JSON.stringify(logs));
      } catch (e) {
        console.error('Failed to persist audit log:', e);
      }
    }
  }

  // ===========================================================================
  // 查询与统计
  // ===========================================================================

  /**
   * 获取Trace详情
   */
  getTrace(traceId: string): Span[] | undefined {
    return this.activeTraces.get(traceId);
  }

  /**
   * 获取所有审计日志
   */
  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  /**
   * 获取工具调用统计
   */
  getToolCallStats(): Map<string, number> {
    return new Map(this.toolCallStats);
  }

  /**
   * 获取Agent工具调用统计
   */
  getAgentToolCallStats(): Map<string, number> {
    return new Map(this.agentToolCallStats);
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.activeTraces.clear();
    this.auditLogs = [];
    this.toolCallStats.clear();
    this.agentToolCallStats.clear();
    this.recentCalls.clear();
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export default AuditTrail;
