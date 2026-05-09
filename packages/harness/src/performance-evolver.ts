/**
 * Performance Evolver
 * 性能进化器
 *
 * Optimizes:
 * 1. Token usage and context compression
 * 2. Hot memory cache strategy
 * 3. Parallelism tuning
 */

import {
  PerformanceEvolverConfig,
  EvolutionChange,
  PerformanceStats,
} from './types.js';

export class PerformanceEvolver {
  private config: PerformanceEvolverConfig;
  private stats: PerformanceStats = {
    tokenUsage: { perQuery: [], perTool: {} },
    latency: { perQuery: [], perTool: {} },
    cacheHitRate: 0,
    contextCompressionRatio: 0,
    parallelismUtilization: 0,
  };
  private currentSettings = {
    contextWindowSize: 4096,
    cacheSize: 100,
    maxParallelism: 4,
    compressionEnabled: false,
  };

  constructor(config: PerformanceEvolverConfig) {
    this.config = config;
  }

  /**
   * Record query stats
   * 记录查询统计
   */
  recordQueryStats(
    tokens: number,
    latencyMs: number,
    toolTokenUsages?: Record<string, number>
  ): void {
    this.stats.tokenUsage.perQuery.push(tokens);
    this.stats.latency.perQuery.push(latencyMs);

    // Keep only last 1000 samples
    if (this.stats.tokenUsage.perQuery.length > 1000) {
      this.stats.tokenUsage.perQuery.shift();
      this.stats.latency.perQuery.shift();
    }

    // Record tool-level stats
    if (toolTokenUsages) {
      for (const [tool, usage] of Object.entries(toolTokenUsages)) {
        if (!this.stats.tokenUsage.perTool[tool]) {
          this.stats.tokenUsage.perTool[tool] = [];
        }
        this.stats.tokenUsage.perTool[tool].push(usage);
      }
    }
  }

  /**
   * Record cache hit rate
   * 记录缓存命中率
   */
  recordCacheStats(hitRate: number): void {
    this.stats.cacheHitRate = hitRate;
  }

  /**
   * Run performance evolution
   * 运行性能进化
   */
  evolve(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 1. Auto-tune context window
    if (this.config.autoTuneContextWindow) {
      changes.push(...this.tuneContextWindow());
    }

    // 2. Optimize cache strategy
    if (this.config.autoOptimizeCacheStrategy) {
      changes.push(...this.optimizeCache());
    }

    // 3. Tune parallelism
    if (this.config.autoTuneParallelism) {
      changes.push(...this.tuneParallelism());
    }

    // 4. Token usage optimization
    if (this.config.tokenUsageOptimization) {
      changes.push(...this.optimizeTokenUsage());
    }

    return changes;
  }

  /**
   * Tune context window size based on token usage
   * 基于 token 使用量调整上下文窗口大小
   */
  private tuneContextWindow(): EvolutionChange[] {
    const tokens = this.stats.tokenUsage.perQuery;
    if (tokens.length < 20) return [];

    const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
    const avgLatency = this.stats.latency.perQuery.reduce((a, b) => a + b, 0) / tokens.length;

    const changes: EvolutionChange[] = [];

    // If average usage is low and latency is high, reduce window
    if (
      avgTokens < this.currentSettings.contextWindowSize * 0.5 &&
      avgLatency > this.config.targetLatencyMs
    ) {
      const newSize = Math.max(1024, Math.round(this.currentSettings.contextWindowSize * 0.75));
      changes.push({
        id: `perf-ctx-${Date.now()}`,
        type: 'parameter',
        target: 'performance.contextWindowSize',
        oldValue: this.currentSettings.contextWindowSize,
        newValue: newSize,
        confidence: 0.85,
        reason: `Low context utilization (${((avgTokens / this.currentSettings.contextWindowSize) * 100).toFixed(1)}%) and high latency (${avgLatency.toFixed(0)}ms)`,
        rollbackable: true,
      });
      this.currentSettings.contextWindowSize = newSize;
    }

    // If average usage is high, increase window
    if (avgTokens > this.currentSettings.contextWindowSize * 0.9) {
      const newSize = Math.round(this.currentSettings.contextWindowSize * 1.25);
      changes.push({
        id: `perf-ctx-${Date.now()}`,
        type: 'parameter',
        target: 'performance.contextWindowSize',
        oldValue: this.currentSettings.contextWindowSize,
        newValue: newSize,
        confidence: 0.9,
        reason: `High context utilization (${((avgTokens / this.currentSettings.contextWindowSize) * 100).toFixed(1)}%)`,
        rollbackable: true,
      });
      this.currentSettings.contextWindowSize = newSize;
    }

    return changes;
  }

  /**
   * Optimize cache strategy based on hit rate
   * 基于命中率优化缓存策略
   */
  private optimizeCache(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // Low cache hit rate - increase cache size
    if (this.stats.cacheHitRate < 0.5 && this.currentSettings.cacheSize < 500) {
      const newSize = Math.round(this.currentSettings.cacheSize * 1.5);
      changes.push({
        id: `perf-cache-${Date.now()}`,
        type: 'parameter',
        target: 'performance.cacheSize',
        oldValue: this.currentSettings.cacheSize,
        newValue: newSize,
        confidence: 0.75,
        reason: `Low cache hit rate (${(this.stats.cacheHitRate * 100).toFixed(1)}%)`,
        rollbackable: true,
      });
      this.currentSettings.cacheSize = newSize;
    }

    // Very high cache hit rate - could reduce size
    if (this.stats.cacheHitRate > 0.95 && this.currentSettings.cacheSize > 50) {
      const newSize = Math.round(this.currentSettings.cacheSize * 0.75);
      changes.push({
        id: `perf-cache-${Date.now()}`,
        type: 'parameter',
        target: 'performance.cacheSize',
        oldValue: this.currentSettings.cacheSize,
        newValue: newSize,
        confidence: 0.7,
        reason: `High cache hit rate (${(this.stats.cacheHitRate * 100).toFixed(1)}%), can reduce memory footprint`,
        rollbackable: true,
      });
      this.currentSettings.cacheSize = newSize;
    }

    return changes;
  }

  /**
   * Tune parallelism based on latency
   * 基于延迟调整并行度
   */
  private tuneParallelism(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    const avgLatency =
      this.stats.latency.perQuery.reduce((a, b) => a + b, 0) /
      (this.stats.latency.perQuery.length || 1);

    // High latency - increase parallelism
    if (
      avgLatency > this.config.targetLatencyMs * 2 &&
      this.currentSettings.maxParallelism < 16
    ) {
      const newParallelism = this.currentSettings.maxParallelism * 2;
      changes.push({
        id: `perf-par-${Date.now()}`,
        type: 'parameter',
        target: 'performance.maxParallelism',
        oldValue: this.currentSettings.maxParallelism,
        newValue: newParallelism,
        confidence: 0.8,
        reason: `High latency (${avgLatency.toFixed(0)}ms), increasing parallelism`,
        rollbackable: true,
      });
      this.currentSettings.maxParallelism = newParallelism;
    }

    // Very low latency - could decrease parallelism
    if (
      avgLatency < this.config.targetLatencyMs * 0.5 &&
      this.currentSettings.maxParallelism > 2
    ) {
      const newParallelism = Math.max(2, Math.round(this.currentSettings.maxParallelism / 2));
      changes.push({
        id: `perf-par-${Date.now()}`,
        type: 'parameter',
        target: 'performance.maxParallelism',
        oldValue: this.currentSettings.maxParallelism,
        newValue: newParallelism,
        confidence: 0.7,
        reason: `Low latency (${avgLatency.toFixed(0)}ms), reducing memory overhead`,
        rollbackable: true,
      });
      this.currentSettings.maxParallelism = newParallelism;
    }

    return changes;
  }

  /**
   * Optimize token usage with context compression
   * 使用上下文压缩优化 token 使用
   */
  private optimizeTokenUsage(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    const avgTokens =
      this.stats.tokenUsage.perQuery.reduce((a, b) => a + b, 0) /
      (this.stats.tokenUsage.perQuery.length || 1);

    // High token usage - enable compression
    if (avgTokens > 2000 && !this.currentSettings.compressionEnabled) {
      changes.push({
        id: `perf-comp-${Date.now()}`,
        type: 'parameter',
        target: 'performance.compressionEnabled',
        oldValue: false,
        newValue: true,
        confidence: this.config.compressionThreshold,
        reason: `High token usage (${avgTokens.toFixed(0)} tokens/query), enabling context compression`,
        rollbackable: true,
      });
      this.currentSettings.compressionEnabled = true;
    }

    return changes;
  }

  /**
   * Get current performance stats
   * 获取当前性能统计
   */
  getStats(): PerformanceStats {
    return { ...this.stats };
  }

  /**
   * Get current settings
   * 获取当前设置
   */
  getSettings(): typeof this.currentSettings {
    return { ...this.currentSettings };
  }

  /**
   * Apply evolution changes
   * 应用进化变更
   */
  applyChanges(changes: EvolutionChange[]): void {
    for (const change of changes) {
      console.log(`[PerformanceEvolver] Applying change: ${change.target}: ${change.oldValue} -> ${change.newValue}`);
    }
  }
}
