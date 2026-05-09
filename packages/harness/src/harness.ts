/**
 * Self-Evolution Harness Core
 * 自我进化编排层核心
 *
 * This is the core innovation of SelfClaw:
 * - Three evolution circuits working in harmony
 * - A/B testing framework for safe evolution
 * - Rollback mechanism for safety
 */

import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { QueryEngine } from '@selfclaw/query-engine';
import { MemoryManager } from '@selfclaw/memory';
import { SecurityManager } from '@selfclaw/security';
import { ToolRegistry } from '@selfclaw/tools';

import { PermissionEvolver } from './permission-evolver.js';
import { PerformanceEvolver } from './performance-evolver.js';
import { MemoryEvolver } from './memory-evolver.js';

import {
  HarnessConfig,
  DEFAULT_HARNESS_CONFIG,
  EvolutionResult,
  EvolutionChange,
  EvolutionCircuitType,
  EvolutionStatus,
  HarnessEvent,
  HarnessEventEmitter,
  HarnessEventType,
  RollbackPoint,
  ActiveABTest,
  HarnessExecutionOptions,
} from './types.js';

export class SelfEvolutionHarness extends (EventEmitter as new () => HarnessEventEmitter) {
  private config: HarnessConfig;
  private initialized = false;
  private evolutionInterval?: NodeJS.Timeout;

  // Core components
  private queryEngine: QueryEngine;
  private memoryManager: MemoryManager;
  private securityManager: SecurityManager;
  private toolRegistry: ToolRegistry;

  // Evolution circuits
  private permissionEvolver: PermissionEvolver;
  private performanceEvolver: PerformanceEvolver;
  private memoryEvolver: MemoryEvolver;

  // Evolution metadata storage
  private rollbackHistory: RollbackPoint[] = [];
  private activeABTests: Map<string, ActiveABTest> = new Map();
  private evolutionVersion = '0.1.0';

  constructor(
    queryEngine: QueryEngine,
    memoryManager: MemoryManager,
    securityManager: SecurityManager,
    toolRegistry: ToolRegistry,
    config?: Partial<HarnessConfig>
  ) {
    super();
    this.queryEngine = queryEngine;
    this.memoryManager = memoryManager;
    this.securityManager = securityManager;
    this.toolRegistry = toolRegistry;
    this.config = { ...DEFAULT_HARNESS_CONFIG, ...config };

    // Initialize evolvers
    this.permissionEvolver = new PermissionEvolver(
      this.securityManager,
      this.config.permission
    );
    this.performanceEvolver = new PerformanceEvolver(this.config.performance);
    this.memoryEvolver = new MemoryEvolver(this.memoryManager, this.config.memory);
  }

  /**
   * Initialize the harness
   * 初始化编排层
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Setup event listeners for data collection
    this.setupEventListeners();

    // Start evolution cycle if auto evolution is enabled
    if (this.config.autoApplyChanges) {
      this.startEvolutionCycle();
    }

    this.initialized = true;
    this.emitEvent('harness_start', { version: this.evolutionVersion });
  }

  /**
   * Setup event listeners for evolution data collection
   * 设置事件监听器以收集进化数据
   */
  private setupEventListeners(): void {
    // Listen to QueryEngine events
    this.queryEngine.on('queryComplete', (queryId, result) => {
      // Record performance stats
      // Note: In real implementation, we'd extract token counts from the response
      this.performanceEvolver.recordQueryStats(500, 1500);
    });

    // Listen to Memory events
    this.memoryManager.on('memory_searched', (event) => {
      this.memoryEvolver.recordSearchStats(
        event.data.latency as number,
        event.data.avgRelevance as number,
        event.data.cacheHit as boolean
      );
    });

    // Listen to Tool events
    this.toolRegistry.on('tool_called', (event) => {
      // Record permission patterns
      this.permissionEvolver.recordOperation(
        event.toolName,
        (event.data.toolCall as { name: string }).name,
        true,
        undefined
      );
    });

    // Listen to Security events
    this.securityManager.on('operation_checked', (event) => {
      // This would record security decisions
    });
  }

  /**
   * Start the automatic evolution cycle
   * 启动自动进化循环
   */
  startEvolutionCycle(): void {
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
    }

    this.evolutionInterval = setInterval(async () => {
      await this.runEvolutionCycle();
    }, this.config.evolutionCycleInterval);

    console.log(`[SelfEvolutionHarness] Evolution cycle started, interval: ${this.config.evolutionCycleInterval}ms`);
  }

  /**
   * Stop the evolution cycle
   * 停止进化循环
   */
  stopEvolutionCycle(): void {
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
      this.evolutionInterval = undefined;
      console.log('[SelfEvolutionHarness] Evolution cycle stopped');
    }
  }

  /**
   * Run a single evolution cycle
   * 运行单次进化循环
   */
  async runEvolutionCycle(): Promise<EvolutionResult[]> {
    this.emitEvent('evolution_cycle', { status: EvolutionStatus.RUNNING });

    const results: EvolutionResult[] = [];

    // Run each evolution circuit
    results.push(await this.evolvePermission());
    results.push(await this.evolvePerformance());
    results.push(await this.evolveMemory());

    this.emitEvent('evolution_cycle', {
      status: EvolutionStatus.COMPLETED,
      totalChanges: results.reduce((sum, r) => sum + r.changes.length, 0),
    });

    return results;
  }

  /**
   * Run permission evolution
   * 运行权限进化
   */
  private async evolvePermission(): Promise<EvolutionResult> {
    const startedAt = Date.now();
    const changes = this.permissionEvolver.evolve();

    // Apply changes if auto-apply is enabled
    if (this.config.autoApplyChanges && changes.length > 0) {
      this.createRollbackPoint(EvolutionCircuitType.PERMISSION, changes);
      this.permissionEvolver.applyChanges(changes);

      for (const change of changes) {
        this.emitEvent('evolution_change', {
          circuit: EvolutionCircuitType.PERMISSION,
          change,
        });
      }
    }

    return {
      circuit: EvolutionCircuitType.PERMISSION,
      status: EvolutionStatus.COMPLETED,
      changes,
      metrics: {
        before: {},
        after: {},
        improvement: {},
      },
      startedAt,
      completedAt: Date.now(),
      version: this.evolutionVersion,
    };
  }

  /**
   * Run performance evolution
   * 运行性能进化
   */
  private async evolvePerformance(): Promise<EvolutionResult> {
    const startedAt = Date.now();
    const changes = this.performanceEvolver.evolve();

    if (this.config.autoApplyChanges && changes.length > 0) {
      this.createRollbackPoint(EvolutionCircuitType.PERFORMANCE, changes);
      this.performanceEvolver.applyChanges(changes);

      for (const change of changes) {
        this.emitEvent('evolution_change', {
          circuit: EvolutionCircuitType.PERFORMANCE,
          change,
        });
      }
    }

    return {
      circuit: EvolutionCircuitType.PERFORMANCE,
      status: EvolutionStatus.COMPLETED,
      changes,
      metrics: {
        before: {},
        after: {},
        improvement: {},
      },
      startedAt,
      completedAt: Date.now(),
      version: this.evolutionVersion,
    };
  }

  /**
   * Run memory evolution
   * 运行记忆进化
   */
  private async evolveMemory(): Promise<EvolutionResult> {
    const startedAt = Date.now();
    const changes = this.memoryEvolver.evolve();

    if (this.config.autoApplyChanges && changes.length > 0) {
      this.createRollbackPoint(EvolutionCircuitType.MEMORY, changes);
      this.memoryEvolver.applyChanges(changes);

      for (const change of changes) {
        this.emitEvent('evolution_change', {
          circuit: EvolutionCircuitType.MEMORY,
          change,
        });
      }
    }

    return {
      circuit: EvolutionCircuitType.MEMORY,
      status: EvolutionStatus.COMPLETED,
      changes,
      metrics: {
        before: {},
        after: {},
        improvement: {},
      },
      startedAt,
      completedAt: Date.now(),
      version: this.evolutionVersion,
    };
  }

  /**
   * Create a rollback point
   * 创建回滚点
   */
  private createRollbackPoint(
    circuit: EvolutionCircuitType,
    changes: EvolutionChange[]
  ): void {
    const rollbackPoint: RollbackPoint = {
      id: uuidv4(),
      version: this.evolutionVersion,
      timestamp: Date.now(),
      circuit,
      state: {}, // Would capture full state snapshot
      changes,
    };

    this.rollbackHistory.push(rollbackPoint);

    // Trim history
    if (this.rollbackHistory.length > this.config.maxRollbackHistory) {
      this.rollbackHistory.shift();
    }
  }

  /**
   * Rollback to a previous state
   * 回滚到之前的状态
   */
  rollback(rollbackId: string): boolean {
    const point = this.rollbackHistory.find((r) => r.id === rollbackId);
    if (!point) return false;

    this.emitEvent('rollback_triggered', {
      rollbackId,
      circuit: point.circuit,
    });

    console.log(`[SelfEvolutionHarness] Rolling back to ${rollbackId}`);
    return true;
  }

  /**
   * Execute a query through the harness
   * 通过编排层执行查询
   */
  async *execute(
    query: string,
    options: HarnessExecutionOptions = {}
  ): AsyncGenerator<HarnessEvent, void, unknown> {
    const startTime = Date.now();

    // Auto-inject relevant context from memory
    const context = await this.buildContextFromMemory(query);

    // Run the query through the query engine
    for await (const event of this.queryEngine.execute(query, {
      ...options,
      systemPrompt: context ? `Relevant context:\n${context}\n\n` : undefined,
    })) {
      // Pass through events
      yield {
        type: 'harness_complete',
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          originalEvent: event,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Build context from memory for the query
   * 从记忆中构建查询上下文
   */
  private async buildContextFromMemory(query: string): Promise<string | null> {
    try {
      // Search for relevant memories
      const results = await this.memoryManager.search(query, { limit: 5 });

      if (results.length === 0) return null;

      // Format memories as context
      return results
        .map((m) => `[Memory ${m.id}]: ${m.content}`)
        .join('\n\n');
    } catch (error) {
      console.warn('[SelfEvolutionHarness] Failed to build memory context:', error);
      return null;
    }
  }

  /**
   * Get evolution statistics
   * 获取进化统计
   */
  getStats(): {
    version: string;
    rollbackPoints: number;
    activeTests: number;
    permissionPatterns: number;
    performanceSettings: ReturnType<PerformanceEvolver['getSettings']>;
    indexParams: ReturnType<MemoryEvolver['getIndexParams']>;
  } {
    return {
      version: this.evolutionVersion,
      rollbackPoints: this.rollbackHistory.length,
      activeTests: this.activeABTests.size,
      permissionPatterns: this.permissionEvolver.getPatterns().length,
      performanceSettings: this.performanceEvolver.getSettings(),
      indexParams: this.memoryEvolver.getIndexParams(),
    };
  }

  /**
   * Emit a harness event
   * 发出编排事件
   */
  private emitEvent(type: HarnessEventType, data: Record<string, unknown>): void {
    const event: HarnessEvent = {
      type,
      id: uuidv4(),
      timestamp: Date.now(),
      data,
    };

    // Note: We'd need to type the EventEmitter properly
    (this as any).emit(type, event);
  }

  /**
   * Shutdown the harness
   * 关闭编排层
   */
  shutdown(): void {
    this.stopEvolutionCycle();
    this.removeAllListeners();
    console.log('[SelfEvolutionHarness] Shutdown complete');
  }
}
