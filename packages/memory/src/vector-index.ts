/**
 * Vector Index Engine
 * 使用简化的HNSW近似最近邻搜索
 * 支持本地嵌入模型和余弦相似度计算
 */

import {
  VectorDocument,
  VectorSearchResult,
  VectorIndexOptions,
} from './types.js';

export class VectorIndex {
  private dimensions: number;
  private documents: Map<string, VectorDocument> = new Map();
  private index: Map<string, number[]> = new Map(); // 简化的邻接表

  constructor(options: VectorIndexOptions = {}) {
    this.dimensions = options.dimensions || 384; // all-MiniLM-L6-v2 默认维度
  }

  /**
   * 添加文档到索引
   */
  add(doc: VectorDocument): void {
    if (doc.vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimensions}, got ${doc.vector.length}`
      );
    }
    this.documents.set(doc.id, doc);
    this.buildIndexForNode(doc.id, doc.vector);
  }

  /**
   * 批量添加文档
   */
  addBatch(docs: VectorDocument[]): void {
    for (const doc of docs) {
      this.add(doc);
    }
  }

  /**
   * 为节点构建简化索引（HNSW简化版）
   */
  private buildIndexForNode(id: string, vector: number[]): void {
    // 简化实现：找到最相似的K个节点作为邻居
    const neighbors: { id: string; similarity: number }[] = [];

    for (const [otherId, otherDoc] of this.documents) {
      if (otherId === id) continue;
      const similarity = this.cosineSimilarity(vector, otherDoc.vector);
      neighbors.push({ id: otherId, similarity });
    }

    // 取前16个最相似的作为邻居（M=16）
    const topNeighbors = neighbors
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 16)
      .map(n => n.id);

    this.index.set(id, topNeighbors);
  }

  /**
   * 余弦相似度计算
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions do not match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 搜索最相似的向量
   */
  search(queryVector: number[], limit: number = 10): VectorSearchResult[] {
    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.dimensions}, got ${queryVector.length}`
      );
    }

    const results: VectorSearchResult[] = [];

    for (const [id, doc] of this.documents) {
      const score = this.cosineSimilarity(queryVector, doc.vector);
      results.push({
        id,
        score,
        metadata: doc.metadata,
      });
    }

    // 按分数降序排列并限制数量
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * 使用贪心搜索（HNSW简化版）
   */
  greedySearch(queryVector: number[], limit: number = 10, ef: number = 20): VectorSearchResult[] {
    if (this.documents.size === 0) return [];

    // 随机选择起始点
    const ids = Array.from(this.documents.keys());
    let currentId = ids[Math.floor(Math.random() * ids.length)];
    let currentBest = this.cosineSimilarity(queryVector, this.documents.get(currentId)!.vector);
    
    const visited = new Set<string>([currentId]);
    const candidates: { id: string; score: number }[] = [{ id: currentId, score: currentBest }];

    // 贪心搜索找到局部最优
    let improved = true;
    while (improved) {
      improved = false;
      const neighbors = this.index.get(currentId) || [];
      
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        
        const neighbor = this.documents.get(neighborId);
        if (!neighbor) continue;
        
        const score = this.cosineSimilarity(queryVector, neighbor.vector);
        candidates.push({ id: neighborId, score });
        
        if (score > currentBest) {
          currentBest = score;
          currentId = neighborId;
          improved = true;
        }
      }
    }

    // 从候选集中返回最佳结果
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, ef))
      .map(c => ({
        id: c.id,
        score: c.score,
        metadata: this.documents.get(c.id)?.metadata || {},
      }));
  }

  /**
   * 删除文档
   */
  remove(id: string): boolean {
    const exists = this.documents.delete(id);
    this.index.delete(id);
    
    // 从其他节点的邻居列表中移除
    for (const neighbors of this.index.values()) {
      const idx = neighbors.indexOf(id);
      if (idx !== -1) neighbors.splice(idx, 1);
    }
    
    return exists;
  }

  /**
   * 更新文档向量
   */
  update(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    const doc = this.documents.get(id);
    if (!doc) {
      this.add({ id, vector, metadata: metadata || {} });
      return;
    }

    doc.vector = vector;
    if (metadata) {
      doc.metadata = { ...doc.metadata, ...metadata };
    }

    // 重新构建索引
    this.buildIndexForNode(id, vector);
  }

  /**
   * 获取文档数量
   */
  size(): number {
    return this.documents.size;
  }

  /**
   * 获取向量维度
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.documents.clear();
    this.index.clear();
  }

  /**
   * 导出索引数据
   */
  export(): { dimensions: number; documents: VectorDocument[] } {
    return {
      dimensions: this.dimensions,
      documents: Array.from(this.documents.values()),
    };
  }

  /**
   * 导入索引数据
   */
  import(data: { dimensions: number; documents: VectorDocument[] }): void {
    this.dimensions = data.dimensions;
    this.clear();
    this.addBatch(data.documents);
  }
}

/**
 * 简单的本地嵌入模拟器
 * 实际使用时应该替换为真正的 transformers.js 或 @xenova/transformers
 */
export class SimpleEmbedder {
  private dimensions: number;
  private vocab: Map<string, number> = new Map();

  constructor(dimensions: number = 384) {
    this.dimensions = dimensions;
    this.initializeVocab();
  }

  private initializeVocab(): void {
    // 简单的词袋模型
    const commonWords = [
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
      'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not',
      'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
      'there', 'then', 'once', 'where', 'when', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'know',
      'think', 'want', 'need', 'feel', 'try', 'help', 'use', 'find', 'make', 'create',
      'code', 'file', 'data', 'function', 'class', 'type', 'return', 'import', 'export',
      'const', 'let', 'var', 'if', 'else', 'for', 'while', 'switch', 'case', 'default',
    ];

    commonWords.forEach((word, i) => {
      this.vocab.set(word, i);
    });
  }

  /**
   * 生成文本嵌入向量（简化版）
   * 使用词袋 + TF-IDF 风格的简单向量
   */
  embed(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);

    if (words.length === 0) return vector;

    // 计算词频
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // 构建向量
    for (const [word, freq] of Object.entries(wordFreq)) {
      const hash = this.hashWord(word);
      const position = hash % this.dimensions;
      const tf = freq / words.length;
      const idf = Math.log(1 + 1 / (1 + (this.vocab.has(word) ? 0.5 : 0)));
      vector[position] += tf * idf;
      
      // 散布到相邻位置（平滑）
      for (let i = 1; i <= 3; i++) {
        const neighborPos = (position + i) % this.dimensions;
        vector[neighborPos] += tf * idf * (1 / (i + 1));
      }
    }

    // L2归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  private hashWord(word: string): number {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) + hash) ^ word.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  /**
   * 批量嵌入
   */
  embedBatch(texts: string[]): number[][] {
    return texts.map(text => this.embed(text));
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
