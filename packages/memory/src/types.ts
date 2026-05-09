/**
 * SelfClaw Memory System Types
 * 三重混合记忆索引系统类型定义
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 基础记忆类型 ====================

export type MemoryType =
  | 'conversation'    // 对话记忆
  | 'fact'           // 事实记忆
  | 'reflection'     // 反思记忆
  | 'skill'          // 技能记忆
  | 'entity'         // 实体记忆
  | 'system';        // 系统记忆

export type MemorySource =
  | 'user'           // 用户输入
  | 'assistant'      // AI回复
  | 'tool'           // 工具输出
  | 'reflection'     // 反思生成
  | 'system';        // 系统生成

export interface Memory {
  id: string;
  type: MemoryType;
  source: MemorySource;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  entities?: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  importance: number; // 0-100 重要性评分
  ttl?: number; // 过期时间戳，可选
}

export interface MemorySearchResult {
  memory: Memory;
  score: number; // 0-1 归一化分数
  rank: number;
  source: 'vector' | 'fulltext' | 'graph';
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  types?: MemoryType[];
  startTime?: number;
  endTime?: number;
  includeMetadata?: boolean;
}

// ==================== 向量索引类型 ====================

export interface VectorDocument {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorIndexOptions {
  dimensions?: number;
  maxElements?: number;
  efConstruction?: number;
  M?: number;
}

// ==================== 全文索引类型 ====================

export interface FullTextDocument {
  id: string;
  title?: string;
  content: string;
  type: MemoryType;
  metadata: Record<string, unknown>;
}

export interface FullTextSearchResult {
  id: string;
  score: number;
  matchData: Record<string, unknown>;
}

// ==================== 图索引类型 ====================

export type EntityType =
  | 'person'
  | 'organization'
  | 'project'
  | 'document'
  | 'concept'
  | 'skill'
  | 'tool'
  | 'other';

export type RelationType =
  | 'related_to'
  | 'mentions'
  | 'uses'
  | 'creates'
  | 'belongs_to'
  | 'depends_on'
  | 'references';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  metadata: Record<string, unknown>;
  importance: number;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface GraphSearchResult {
  entity: Entity;
  score: number;
  path?: Entity[];
  adjacentEntities?: Entity[];
  relatedMemories?: string[];
}

// ==================== RRF 融合类型 ====================

export interface RRFOptions {
  k?: number; // RRF k 参数，默认 60
  weights?: {
    vector: number;
    fulltext: number;
    graph: number;
  };
}

export interface FusionResult {
  memoryId: string;
  memory: Memory;
  finalScore: number;
  vectorScore?: number;
  fulltextScore?: number;
  graphScore?: number;
  sources: string[];
}

// ==================== 存储层类型 ====================

export interface StorageOptions {
  dataDir: string;
  memoryFile?: string;
  jsonlFile?: string;
  autoFlush?: boolean;
  flushInterval?: number;
}

export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  vectorIndexSize: number;
  fulltextIndexSize: number;
  graphEntities: number;
  graphRelations: number;
  cacheHitRate: number;
  lastUpdatedAt: number;
}

// ==================== 事件类型 ====================

export type MemoryEventType =
  | 'memory_created'
  | 'memory_updated'
  | 'memory_deleted'
  | 'memory_accessed'
  | 'index_updated'
  | 'search_completed'
  | 'error';

export interface MemoryEvent {
  type: MemoryEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface MemoryManagerEvents {
  [K in MemoryEventType]: (event: MemoryEvent) => void;
}

export type MemoryManagerEmitter = EventEmitter<MemoryManagerEvents>;

// ==================== 配置类型 ====================

export interface MemoryConfig {
  storage: StorageOptions;
  vectorIndex: VectorIndexOptions;
  rrf: RRFOptions;
  cache: {
    maxSize: number;
    ttl: number;
  };
  aging: {
    halfLifeDays: number; // 重要性半衰期（天）
    minImportance: number;
  };
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  storage: {
    dataDir: './data/memory',
    memoryFile: 'memories.jsonl',
    jsonlFile: 'transcripts.jsonl',
    autoFlush: true,
    flushInterval: 30000,
  },
  vectorIndex: {
    dimensions: 384, // all-MiniLM-L6-v2
    maxElements: 100000,
    efConstruction: 200,
    M: 16,
  },
  rrf: {
    k: 60,
    weights: {
      vector: 1.0,
      fulltext: 1.0,
      graph: 1.0,
    },
  },
  cache: {
    maxSize: 1000,
    ttl: 3600000, // 1小时
  },
  aging: {
    halfLifeDays: 30,
    minImportance: 10,
  },
};
