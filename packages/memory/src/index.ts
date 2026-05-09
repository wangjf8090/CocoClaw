/**
 * SelfClaw Memory System
 * 三重混合记忆索引系统
 * 
 * 特性:
 * - 向量检索 (Vector Index) - 语义相似度匹配
 * - 全文检索 (Full Text Index) - BM25关键词匹配
 * - 图关系索引 (Graph Index) - 实体关系路径查询
 * - RRF结果融合 - 多路检索结果合并
 * - JSONL持久化 - 原子写入防丢失
 * - 热记忆缓存 - 最近访问缓存
 * - 记忆老化 - 重要性半衰期衰减
 */

export * from './types.js';
export * from './storage.js';
export * from './vector-index.js';
export * from './fulltext-index.js';
export * from './graph-index.js';
export * from './rrf-fusion.js';
export * from './memory-manager.js';

// 默认导出
import { MemoryManager } from './memory-manager.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';

export default MemoryManager;

/**
 * 创建默认配置的记忆管理器
 */
export function createMemoryManager(dataDir: string = './data/memory'): MemoryManager {
  return new MemoryManager({
    ...DEFAULT_MEMORY_CONFIG,
    storage: {
      ...DEFAULT_MEMORY_CONFIG.storage,
      dataDir,
    },
  });
}

/**
 * 版本信息
 */
export const VERSION = '0.1.0';

/**
 * 系统信息
 */
export const MEMORY_SYSTEM_INFO = {
  version: VERSION,
  indexes: ['vector', 'fulltext', 'graph'],
  fusionAlgorithm: 'RRF (Reciprocal Rank Fusion)',
  embeddingModel: 'SimpleEmbedder (replace with transformers.js for production)',
  storageFormat: 'JSONL + Markdown',
  features: [
    'Vector search (cosine similarity)',
    'Full text search (BM25)',
    'Graph search (PageRank, shortest path)',
    'RRF result fusion',
    'Hot memory cache',
    'Memory aging with half-life decay',
    'Atomic JSONL persistence',
    'Markdown export',
  ],
};
