/**
 * Memory Evolver
 * 记忆进化器
 *
 * Optimizes:
 * 1. Index structure parameters
 * 2. Important memory weight boosting
 * 3. Redundant memory cleanup
 */

import { MemoryManager } from '@selfclaw/memory';
import {
  MemoryEvolverConfig,
  EvolutionChange,
  MemoryStats,
} from './types.js';

export class MemoryEvolver {
  private config: MemoryEvolverConfig;
  private memoryManager: MemoryManager;
  private stats: MemoryStats = {
    totalMemories: 0,
    indexSize: 0,
    searchLatency: [],
    relevanceScore: [],
    redundancyRate: 0,
    hotCacheHitRate: 0,
  };
  private indexParams = {
    vectorDimensions: 1536,
    efConstruction: 128,
    efSearch: 64,
    M: 16,
  };

  constructor(memoryManager: MemoryManager, config: MemoryEvolverConfig) {
    this.memoryManager = memoryManager;
    this.config = config;
  }

  /**
   * Record search stats
   * 记录搜索统计
   */
  recordSearchStats(latencyMs: number, avgRelevance: number, cacheHit: boolean): void {
    this.stats.searchLatency.push(latencyMs);
    this.stats.relevanceScore.push(avgRelevance);

    // Keep last 100 samples
    if (this.stats.searchLatency.length > 100) {
      this.stats.searchLatency.shift();
      this.stats.relevanceScore.shift();
    }

    // Update cache hit rate (moving average)
    this.stats.hotCacheHitRate = this.stats.hotCacheHitRate * 0.9 + (cacheHit ? 1 : 0) * 0.1;
  }

  /**
   * Run memory evolution
   * 运行记忆进化
   */
  evolve(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // 1. Auto-tune index parameters
    if (this.config.autoTuneIndexParameters) {
      changes.push(...this.tuneIndexParameters());
    }

    // 2. Boost important memories
    if (this.config.autoBoostImportant) {
      changes.push(...this.boostImportantMemories());
    }

    // 3. Clean redundant memories
    if (this.config.autoCleanRedundant) {
      changes.push(...this.cleanRedundantMemories());
    }

    return changes;
  }

  /**
   * Tune vector index parameters
   * 调整向量索引参数
   */
  private tuneIndexParameters(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    if (this.stats.searchLatency.length < 20) return [];

    const avgLatency =
      this.stats.searchLatency.reduce((a, b) => a + b, 0) /
      this.stats.searchLatency.length;
    const avgRelevance =
      this.stats.relevanceScore.reduce((a, b) => a + b, 0) /
      this.stats.relevanceScore.length;

    // High latency, good relevance - can reduce quality for speed
    if (avgLatency > 100 && avgRelevance > 0.85) {
      const oldEfSearch = this.indexParams.efSearch;
      const newEfSearch = Math.max(16, Math.round(this.indexParams.efSearch * 0.75));

      changes.push({
        id: `mem-idx-${Date.now()}`,
        type: 'parameter',
        target: 'memory.index.efSearch',
        oldValue: oldEfSearch,
        newValue: newEfSearch,
        confidence: 0.8,
        reason: `High search latency (${avgLatency.toFixed(2)}ms) with good relevance, reducing search complexity`,
        rollbackable: true,
      });
      this.indexParams.efSearch = newEfSearch;
    }

    // Low relevance - improve search quality
    if (avgRelevance < 0.6 && avgLatency < 200) {
      const oldEfSearch = this.indexParams.efSearch;
      const newEfSearch = Math.min(256, Math.round(this.indexParams.efSearch * 1.5));

      changes.push({
        id: `mem-idx-${Date.now()}`,
        type: 'parameter',
        target: 'memory.index.efSearch',
        oldValue: oldEfSearch,
        newValue: newEfSearch,
        confidence: 0.85,
        reason: `Low search relevance (${(avgRelevance * 100).toFixed(1)}%), increasing search quality`,
        rollbackable: true,
      });
      this.indexParams.efSearch = newEfSearch;
    }

    return changes;
  }

  /**
   * Boost important memories
   * 提升重要记忆的权重
   */
  private boostImportantMemories(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // In a real implementation, this would:
    // 1. Analyze memory access frequency
    // 2. Detect frequently accessed memories
    // 3. Boost their weights or promote to hot cache

    changes.push({
      id: `mem-boost-${Date.now()}`,
      type: 'weight',
      target: 'memory.boostThreshold',
      oldValue: 0.5,
      newValue: this.config.importanceBoostThreshold,
      confidence: 0.75,
      reason: 'Configured importance boost threshold applied',
      rollbackable: true,
    });

    return changes;
  }

  /**
   * Clean redundant memories
   * 清理冗余记忆
   */
  private cleanRedundantMemories(): EvolutionChange[] {
    const changes: EvolutionChange[] = [];

    // In a real implementation, this would:
    // 1. Find memories with high content similarity (using embeddings)
    // 2. Mark very similar memories for removal
    // 3. Keep only the most relevant/complete version

    changes.push({
      id: `mem-clean-${Date.now()}`,
      type: 'structure',
      target: 'memory.redundancyThreshold',
      oldValue: 0.95,
      newValue: this.config.redundancyThreshold,
      confidence: 0.7,
      reason: 'Configured redundancy threshold applied for auto-cleanup',
      rollbackable: true,
    });

    return changes;
  }

  /**
   * Get memory stats
   * 获取记忆统计
   */
  getStats(): MemoryStats {
    return { ...this.stats };
  }

  /**
   * Get index parameters
   * 获取索引参数
   */
  getIndexParams(): typeof this.indexParams {
    return { ...this.indexParams };
  }

  /**
   * Apply evolution changes
   * 应用进化变更
   */
  applyChanges(changes: EvolutionChange[]): void {
    for (const change of changes) {
      console.log(`[MemoryEvolver] Applying change: ${change.target}: ${change.oldValue} -> ${change.newValue}`);
    }
  }
}
