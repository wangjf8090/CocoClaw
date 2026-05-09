/**
 * Memory Manager
 * 统一的记忆查询接口
 * 自动索引更新
 * 记忆压缩和老化策略
 * 热记忆缓存机制
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  Memory,
  MemoryType,
  MemorySource,
  SearchOptions,
  MemoryConfig,
  DEFAULT_MEMORY_CONFIG,
  MemoryStats,
  MemoryEventType,
  MemoryEvent,
  MemoryManagerEmitter,
  FusionResult,
  Entity,
  EntityType,
  Relation,
  RelationType,
} from './types.js';
import { MemoryStorage } from './storage.js';
import { VectorIndex, SimpleEmbedder } from './vector-index.js';
import { FullTextIndex } from './fulltext-index.js';
import { GraphIndex } from './graph-index.js';
import { RRFFusion, SearchResults } from './rrf-fusion.js';

export class MemoryManager {
  private config: MemoryConfig;
  private emitter: MemoryManagerEmitter;
  private storage: MemoryStorage;
  private vectorIndex: VectorIndex;
  private fulltextIndex: FullTextIndex;
  private graphIndex: GraphIndex;
  private rrfFusion: RRFFusion;
  private embedder: SimpleEmbedder;
  
  // 热记忆缓存
  private hotCache: Map<string, { memory: Memory; accessedAt: number }> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.emitter = new EventEmitter() as MemoryManagerEmitter;
    
    this.storage = new MemoryStorage(this.config.storage);
    this.vectorIndex = new VectorIndex(this.config.vectorIndex);
    this.fulltextIndex = new FullTextIndex();
    this.graphIndex = new GraphIndex();
    this.rrfFusion = new RRFFusion(this.config.rrf);
    this.embedder = new SimpleEmbedder(this.config.vectorIndex.dimensions);
  }

  /**
   * 初始化记忆管理器
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    
    // 从存储加载所有记忆到索引
    const allMemories = this.storage.getAll();
    console.log(`Loading ${allMemories.length} memories into indexes...`);
    
    for (const memory of allMemories) {
      await this.addToIndexes(memory, false);
    }
    
    // 计算图的PageRank
    this.graphIndex.computePagerank();
    
    this.emit('memory_created', {
      message: 'Memory manager initialized',
      count: allMemories.length,
    });
  }

  /**
   * 创建新记忆
   */
  async createMemory(
    content: string,
    type: MemoryType,
    source: MemorySource,
    metadata: Record<string, unknown> = {},
    importance: number = 50
  ): Promise<Memory> {
    const now = Date.now();
    
    const memory: Memory = {
      id: uuidv4(),
      type,
      source,
      content,
      metadata,
      entities: [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      importance: Math.max(0, Math.min(100, importance)),
    };

    // 生成嵌入向量
    memory.embedding = this.embedder.embed(content);
    
    // 提取实体
    memory.entities = this.extractEntityIdsFromText(content);

    // 保存
    await this.storage.save(memory);
    await this.addToIndexes(memory, true);
    
    // 添加到缓存
    this.addToCache(memory);

    this.emit('memory_created', {
      memoryId: memory.id,
      type: memory.type,
    });

    return memory;
  }

  /**
   * 从文本中提取实体ID
   */
  private extractEntityIdsFromText(text: string): string[] {
    const entities = this.graphIndex.extractEntitiesFromText(text, '');
    return entities.map(e => e.id);
  }

  /**
   * 添加到所有索引
   */
  private async addToIndexes(memory: Memory, updateGraph: boolean): Promise<void> {
    // 添加到向量索引
    if (memory.embedding) {
      this.vectorIndex.add({
        id: memory.id,
        vector: memory.embedding,
        metadata: {
          type: memory.type,
          source: memory.source,
          createdAt: memory.createdAt,
        },
      });
    }

    // 添加到全文索引
    this.fulltextIndex.add({
      id: memory.id,
      title: memory.metadata.title as string || '',
      content: memory.content,
      type: memory.type,
      metadata: memory.metadata,
    });

    // 提取实体并添加到图索引
    if (updateGraph) {
      const entities = this.graphIndex.extractEntitiesFromText(memory.content, memory.id);
      for (const entity of entities) {
        // 创建记忆与实体的关系
        // （简化处理，实际应该更复杂）
      }
    }
  }

  /**
   * 获取记忆
   */
  getMemory(id: string): Memory | undefined {
    // 先查缓存
    const cached = this.hotCache.get(id);
    if (cached) {
      this.cacheHits++;
      cached.accessedAt = Date.now();
      return cached.memory;
    }

    this.cacheMisses++;
    
    // 从存储获取
    const memory = this.storage.get(id);
    if (memory) {
      this.addToCache(memory);
    }

    return memory;
  }

  /**
   * 添加到热缓存
   */
  private addToCache(memory: Memory): void {
    const { maxSize, ttl } = this.config.cache;

    // 清理过期缓存
    const now = Date.now();
    for (const [id, cached] of this.hotCache) {
      if (now - cached.accessedAt > ttl) {
        this.hotCache.delete(id);
      }
    }

    // 如果缓存已满，移除最久未访问的
    if (this.hotCache.size >= maxSize) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      
      for (const [id, cached] of this.hotCache) {
        if (cached.accessedAt < oldestTime) {
          oldestTime = cached.accessedAt;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        this.hotCache.delete(oldestId);
      }
    }

    this.hotCache.set(memory.id, {
      memory,
      accessedAt: now,
    });
  }

  /**
   * 混合搜索（使用RRF融合三路检索）
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<FusionResult[]> {
    const limit = options.limit || 20;
    const perIndexLimit = Math.ceil(limit * 2); // 每个索引返回更多结果用于融合

    // 1. 生成查询向量
    const queryVector = this.embedder.embed(query);

    // 2. 三路并行检索
    const vectorResults = this.vectorIndex.search(queryVector, perIndexLimit);
    const fulltextResults = this.fulltextIndex.search(query, perIndexLimit, options.types);
    const graphResults = this.graphIndex.search(query, perIndexLimit);

    // 3. 转换为MemorySearchResult格式
    const searchResults: SearchResults = {
      vector: vectorResults.map((r, i) => ({
        memory: this.storage.get(r.id)!,
        score: r.score,
        rank: i + 1,
        source: 'vector',
      })).filter(r => r.memory),

      fulltext: fulltextResults.map((r, i) => ({
        memory: this.storage.get(r.id)!,
        score: r.score,
        rank: i + 1,
        source: 'fulltext',
      })).filter(r => r.memory),

      graph: [], // 图搜索结果需要特殊处理
    };

    // 4. RRF融合
    let fused = this.rrfFusion.fuse(searchResults, limit);
    
    // 5. 归一化分数
    fused = this.rrfFusion.normalizeScores(fused);

    // 6. 应用阈值过滤
    if (options.threshold) {
      fused = fused.filter(r => r.finalScore >= options.threshold!);
    }

    this.emit('search_completed', {
      query,
      resultCount: fused.length,
      threshold: options.threshold,
    });

    return fused;
  }

  /**
   * 仅使用向量搜索
   */
  vectorSearch(query: string, options: SearchOptions = {}): FusionResult[] {
    const queryVector = this.embedder.embed(query);
    const results = this.vectorIndex.search(queryVector, options.limit || 20);

    return results
      .map(r => {
        const memory = this.storage.get(r.id);
        if (!memory) return null;
        return {
          memoryId: memory.id,
          memory,
          finalScore: r.score,
          vectorScore: r.score,
          sources: ['vector'] as string[],
        };
      })
      .filter((r): r is FusionResult => r !== null)
      .filter(r => !options.threshold || r.finalScore >= options.threshold);
  }

  /**
   * 仅使用全文搜索
   */
  fulltextSearch(query: string, options: SearchOptions = {}): FusionResult[] {
    const results = this.fulltextIndex.search(query, options.limit || 20, options.types);

    return results
      .map(r => {
        const memory = this.storage.get(r.id);
        if (!memory) return null;
        return {
          memoryId: memory.id,
          memory,
          finalScore: r.score,
          fulltextScore: r.score,
          sources: ['fulltext'] as string[],
        };
      })
      .filter((r): r is FusionResult => r !== null)
      .filter(r => !options.threshold || r.finalScore >= options.threshold);
  }

  /**
   * 更新记忆
   */
  async updateMemory(
    id: string,
    updates: Partial<Pick<Memory, 'content' | 'metadata' | 'importance' | 'entities'>>
  ): Promise<Memory | null> {
    const memory = this.storage.get(id);
    if (!memory) return null;

    if (updates.content !== undefined) {
      memory.content = updates.content;
      memory.embedding = this.embedder.embed(updates.content);
      memory.entities = this.extractEntityIdsFromText(updates.content);
    }
    if (updates.metadata !== undefined) {
      memory.metadata = { ...memory.metadata, ...updates.metadata };
    }
    if (updates.importance !== undefined) {
      memory.importance = Math.max(0, Math.min(100, updates.importance));
    }
    if (updates.entities !== undefined) {
      memory.entities = updates.entities;
    }

    memory.updatedAt = Date.now();

    // 更新存储和索引
    await this.storage.save(memory);
    this.vectorIndex.update(id, memory.embedding!, memory.metadata);
    this.fulltextIndex.update({
      id: memory.id,
      content: memory.content,
      type: memory.type,
      metadata: memory.metadata,
    });

    // 更新缓存
    this.addToCache(memory);

    this.emit('memory_updated', { memoryId: id });

    return memory;
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    this.vectorIndex.remove(id);
    this.fulltextIndex.remove(id);
    this.hotCache.delete(id);
    
    const result = await this.storage.delete(id);

    if (result) {
      this.emit('memory_deleted', { memoryId: id });
    }

    return result;
  }

  /**
   * 记忆老化 - 按半衰期降低重要性
   */
  applyAging(): void {
    const { halfLifeDays, minImportance } = this.config.aging;
    const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const allMemories = this.storage.getAll();
    let agedCount = 0;

    for (const memory of allMemories) {
      const timeSinceCreation = now - memory.createdAt;
      
      // 指数衰减: importance = initial * (1/2)^(time/halfLife)
      const decayFactor = Math.pow(0.5, timeSinceCreation / halfLifeMs);
      const newImportance = memory.importance * decayFactor;

      if (newImportance < minImportance) {
        // 重要性太低，考虑删除
        this.deleteMemory(memory.id).catch(console.error);
      } else if (newImportance < memory.importance - 1) {
        // 只有当变化超过1时才更新（减少写入）
        memory.importance = newImportance;
        this.storage.save(memory).catch(console.error);
        agedCount++;
      }
    }

    console.log(`Applied aging to ${agedCount} memories`);
  }

  /**
   * 获取统计信息
   */
  getStats(): MemoryStats {
    const storageStats = this.storage.getStats();
    const graphStats = this.graphIndex.getStats();
    const totalAccesses = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalAccesses > 0 ? this.cacheHits / totalAccesses : 0;

    const allMemories = this.storage.getAll();
    const byType = allMemories.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<MemoryType, number>) as Record<MemoryType, number>;

    return {
      totalMemories: storageStats.total,
      byType,
      vectorIndexSize: this.vectorIndex.size(),
      fulltextIndexSize: this.fulltextIndex.size(),
      graphEntities: graphStats.entities,
      graphRelations: graphStats.relations,
      cacheHitRate,
      lastUpdatedAt: Date.now(),
    };
  }

  // ==================== 图索引操作 ====================

  addEntity(entity: Entity): void {
    this.graphIndex.addEntity(entity);
    this.graphIndex.computePagerank();
  }

  addRelation(relation: Relation): void {
    this.graphIndex.addRelation(relation);
    this.graphIndex.computePagerank();
  }

  getEntity(entityId: string): Entity | undefined {
    return this.graphIndex.getAllEntities().find(e => e.id === entityId);
  }

  getRelatedMemories(entityId: string): Memory[] {
    return this.storage.getAll().filter(m => m.entities?.includes(entityId));
  }

  findEntityPath(sourceId: string, targetId: string): Entity[] | null {
    return this.graphIndex.findPath(sourceId, targetId);
  }

  getTopEntities(limit: number = 10, type?: EntityType): Entity[] {
    return this.graphIndex.getTopEntities(limit, type);
  }

  // ==================== 事件与生命周期 ====================

  on(event: MemoryEventType, handler: (event: MemoryEvent) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: MemoryEventType, handler: (event: MemoryEvent) => void): void {
    this.emitter.off(event, handler);
  }

  private emit(type: MemoryEventType, data: Record<string, unknown>): void {
    this.emitter.emit(type, {
      type,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * 关闭记忆管理器
   */
  async close(): Promise<void> {
    await this.storage.close();
    this.emitter.removeAllListeners();
    this.hotCache.clear();
  }
}

export { MemoryManager as default };
