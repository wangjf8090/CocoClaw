/**
 * Reciprocal Rank Fusion (RRF) Algorithm
 * 多路检索结果融合算法
 * 支持向量、全文、图索引结果的并行执行和归一化
 */

import {
  FusionResult,
  RRFOptions,
  Memory,
  MemorySearchResult,
} from './types.js';

/**
 * 三路检索结果容器
 */
export interface SearchResults {
  vector: MemorySearchResult[];
  fulltext: MemorySearchResult[];
  graph: MemorySearchResult[];
}

export class RRFFusion {
  private k: number;
  private weights: {
    vector: number;
    fulltext: number;
    graph: number;
  };

  constructor(options: RRFOptions = {}) {
    this.k = options.k ?? 60;
    this.weights = options.weights || {
      vector: 1.0,
      fulltext: 1.0,
      graph: 1.0,
    };
  }

  /**
   * 融合多路检索结果
   * RRF公式: score = sum(1 / (k + rank)) 对每个来源
   */
  fuse(results: SearchResults, limit: number = 20): FusionResult[] {
    const memoryMap = new Map<string, Memory>();
    const scoreMap = new Map<string, {
      finalScore: number;
      vectorScore?: number;
      fulltextScore?: number;
      graphScore?: number;
      sources: Set<string>;
    }>();

    // 1. 处理向量检索结果
    this.processResultList(
      results.vector,
      'vector',
      memoryMap,
      scoreMap
    );

    // 2. 处理全文检索结果
    this.processResultList(
      results.fulltext,
      'fulltext',
      memoryMap,
      scoreMap
    );

    // 3. 处理图检索结果
    this.processResultList(
      results.graph,
      'graph',
      memoryMap,
      scoreMap
    );

    // 4. 构建最终结果
    const fusedResults: FusionResult[] = [];

    for (const [memoryId, scores] of scoreMap) {
      const memory = memoryMap.get(memoryId);
      if (!memory) continue;

      fusedResults.push({
        memoryId,
        memory,
        finalScore: scores.finalScore,
        vectorScore: scores.vectorScore,
        fulltextScore: scores.fulltextScore,
        graphScore: scores.graphScore,
        sources: Array.from(scores.sources),
      });
    }

    // 5. 按最终分数排序并限制数量
    return fusedResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  /**
   * 处理单路检索结果列表
   */
  private processResultList(
    results: MemorySearchResult[],
    source: 'vector' | 'fulltext' | 'graph',
    memoryMap: Map<string, Memory>,
    scoreMap: Map<string, {
      finalScore: number;
      vectorScore?: number;
      fulltextScore?: number;
      graphScore?: number;
      sources: Set<string>;
    }>
  ): void {
    const weight = this.weights[source];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const memoryId = result.memory.id;

      // 保存记忆对象
      if (!memoryMap.has(memoryId)) {
        memoryMap.set(memoryId, result.memory);
      }

      // 计算RRF分数
      const rank = i + 1; // rank从1开始
      const rrfScore = (1 / (this.k + rank)) * weight;

      // 更新分数映射
      const existing = scoreMap.get(memoryId);
      if (existing) {
        existing.finalScore += rrfScore;
        existing.sources.add(source);
        
        // 保存来源分数
        if (source === 'vector') existing.vectorScore = result.score;
        if (source === 'fulltext') existing.fulltextScore = result.score;
        if (source === 'graph') existing.graphScore = result.score;
      } else {
        scoreMap.set(memoryId, {
          finalScore: rrfScore,
          vectorScore: source === 'vector' ? result.score : undefined,
          fulltextScore: source === 'fulltext' ? result.score : undefined,
          graphScore: source === 'graph' ? result.score : undefined,
          sources: new Set([source]),
        });
      }
    }
  }

  /**
   * 归一化分数到0-1范围
   */
  normalizeScores(results: FusionResult[]): FusionResult[] {
    if (results.length === 0) return results;

    const maxScore = Math.max(...results.map(r => r.finalScore));
    const minScore = Math.min(...results.map(r => r.finalScore));

    if (maxScore === minScore) {
      return results.map(r => ({
        ...r,
        finalScore: 1.0,
      }));
    }

    return results.map(r => ({
      ...r,
      finalScore: (r.finalScore - minScore) / (maxScore - minScore),
    }));
  }

  /**
   * 去重结果（按memoryId）
   */
  deduplicate(results: FusionResult[]): FusionResult[] {
    const seen = new Set<string>();
    const unique: FusionResult[] = [];

    for (const result of results) {
      if (!seen.has(result.memoryId)) {
        seen.add(result.memoryId);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * 获取融合统计信息
   */
  getFusionStats(results: FusionResult[]): {
    total: number;
    vectorOnly: number;
    fulltextOnly: number;
    graphOnly: number;
    vectorFulltext: number;
    vectorGraph: number;
    fulltextGraph: number;
    allThree: number;
    avgSources: number;
  } {
    const stats = {
      total: results.length,
      vectorOnly: 0,
      fulltextOnly: 0,
      graphOnly: 0,
      vectorFulltext: 0,
      vectorGraph: 0,
      fulltextGraph: 0,
      allThree: 0,
      avgSources: 0,
    };

    let totalSources = 0;

    for (const result of results) {
      const sources = result.sources;
      totalSources += sources.length;

      const hasVector = sources.includes('vector');
      const hasFulltext = sources.includes('fulltext');
      const hasGraph = sources.includes('graph');

      if (hasVector && hasFulltext && hasGraph) {
        stats.allThree++;
      } else if (hasVector && hasFulltext) {
        stats.vectorFulltext++;
      } else if (hasVector && hasGraph) {
        stats.vectorGraph++;
      } else if (hasFulltext && hasGraph) {
        stats.fulltextGraph++;
      } else if (hasVector) {
        stats.vectorOnly++;
      } else if (hasFulltext) {
        stats.fulltextOnly++;
      } else if (hasGraph) {
        stats.graphOnly++;
      }
    }

    stats.avgSources = results.length > 0 ? totalSources / results.length : 0;

    return stats;
  }

  /**
   * 更新配置
   */
  setOptions(options: RRFOptions): void {
    if (options.k !== undefined) {
      this.k = options.k;
    }
    if (options.weights) {
      this.weights = { ...this.weights, ...options.weights };
    }
  }

  /**
   * 获取当前配置
   */
  getOptions(): RRFOptions {
    return {
      k: this.k,
      weights: { ...this.weights },
    };
  }
}

/**
 * 辅助函数：并行执行三路检索
 */
export async function parallelSearch<T>(
  vectorSearch: () => Promise<T[]>,
  fulltextSearch: () => Promise<T[]>,
  graphSearch: () => Promise<T[]>
): Promise<{
  vector: T[];
  fulltext: T[];
  graph: T[];
  timings: {
    vector: number;
    fulltext: number;
    graph: number;
    total: number;
  };
}> {
  const startTime = Date.now();

  // 并行执行三个检索
  const [vector, fulltext, graph] = await Promise.all([
    measureTime(vectorSearch),
    measureTime(fulltextSearch),
    measureTime(graphSearch),
  ]);

  const totalTime = Date.now() - startTime;

  return {
    vector: vector.result,
    fulltext: fulltext.result,
    graph: graph.result,
    timings: {
      vector: vector.time,
      fulltext: fulltext.time,
      graph: graph.time,
      total: totalTime,
    },
  };
}

/**
 * 测量执行时间
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const start = Date.now();
  const result = await fn();
  const time = Date.now() - start;
  return { result, time };
}

/**
 * 默认RRF实例
 */
export const defaultRRFFusion = new RRFFusion({
  k: 60,
  weights: {
    vector: 1.0,
    fulltext: 1.0,
    graph: 0.8, // 图检索权重稍低
  },
});
