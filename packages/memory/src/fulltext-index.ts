/**
 * Full Text Index Engine
 * 使用 lunr.js + BM25排序算法
 * 支持中文分词和字段加权匹配
 */

import lunr from 'lunr';
import {
  FullTextDocument,
  FullTextSearchResult,
  MemoryType,
} from './types.js';

/**
 * 中文分词器（简化版）
 * 实际项目中可以使用 nodejieba 或 @node-rs/jieba
 */
class ChineseTokenizer {
  /**
   * 简单的中文分词 - 基于字符n-gram
   */
  tokenize(text: string): string[] {
    const tokens: string[] = [];
    
    // 分离中文和非中文字符
    const chineseRegex = /[\u4e00-\u9fa5]+/g;
    const englishRegex = /[a-zA-Z0-9_]+/g;
    
    // 提取英文单词
    const englishMatches = text.match(englishRegex) || [];
    tokens.push(...englishMatches.map(w => w.toLowerCase()));
    
    // 中文n-gram分词 (2-gram)
    const chineseMatches = text.match(chineseRegex) || [];
    for (const chineseText of chineseMatches) {
      // 单字
      for (let i = 0; i < chineseText.length; i++) {
        tokens.push(chineseText[i]);
      }
      // 双字
      for (let i = 0; i < chineseText.length - 1; i++) {
        tokens.push(chineseText.slice(i, i + 2));
      }
      // 三字
      for (let i = 0; i < chineseText.length - 2; i++) {
        tokens.push(chineseText.slice(i, i + 3));
      }
    }
    
    return [...new Set(tokens)]; // 去重
  }
}

/**
 * 支持中文的Lunr Pipeline扩展
 */
function registerChineseSupport(): void {
  const tokenizer = new ChineseTokenizer();
  
  // 注册中文管道
  lunr.Pipeline.registerFunction((token) => {
    const str = token.toString();
    
    // 如果包含中文，进行分词
    if (/[\u4e00-\u9fa5]/.test(str)) {
      const tokens = tokenizer.tokenize(str);
      return tokens.map(t => 
        new lunr.Token(t, { ...token.metadata, position: token.index })
      );
    }
    
    return token;
  }, 'chineseTokenizer');
}

export class FullTextIndex {
  private documents: Map<string, FullTextDocument> = new Map();
  private index!: lunr.Index;
  private fieldWeights: Record<string, number>;
  private chineseTokenizer: ChineseTokenizer;
  private dirty = false;

  constructor(fieldWeights?: Record<string, number>) {
    this.fieldWeights = fieldWeights || {
      title: 3,
      content: 1,
      type: 0.5,
    };
    this.chineseTokenizer = new ChineseTokenizer();
    this.initializeIndex();
  }

  /**
   * 初始化Lunr索引
   */
  private initializeIndex(): void {
    const self = this;
    
    this.index = lunr(function () {
      // 配置BM25参数
      this.k1(1.5); // BM25 k1 参数
      this.b(0.75); // BM25 b 参数
      
      // 定义字段和权重
      this.field('title', { boost: self.fieldWeights.title });
      this.field('content', { boost: self.fieldWeights.content });
      this.field('type', { boost: self.fieldWeights.type });
      this.ref('id');
    });
    
    this.dirty = false;
  }

  /**
   * 添加文档到索引
   */
  add(doc: FullTextDocument): void {
    this.documents.set(doc.id, doc);
    this.index.add({
      id: doc.id,
      title: doc.title || '',
      content: doc.content,
      type: doc.type,
    });
    this.dirty = true;
  }

  /**
   * 批量添加文档
   */
  addBatch(docs: FullTextDocument[]): void {
    for (const doc of docs) {
      this.add(doc);
    }
  }

  /**
   * 更新文档
   */
  update(doc: FullTextDocument): void {
    this.remove(doc.id);
    this.add(doc);
  }

  /**
   * 删除文档
   */
  remove(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);
    this.index.remove({ id } as lunr.Document);
    this.dirty = true;
    return true;
  }

  /**
   * 搜索（支持中文）
   */
  search(query: string, limit: number = 20, types?: MemoryType[]): FullTextSearchResult[] {
    // 预处理查询
    const processedQuery = this.preprocessQuery(query);
    
    // 执行搜索
    const results = this.index.search(processedQuery);
    
    // 过滤类型
    let filteredResults = results;
    if (types && types.length > 0) {
      filteredResults = results.filter(result => {
        const doc = this.documents.get(result.ref);
        return doc && types.includes(doc.type as MemoryType);
      });
    }
    
    // 转换结果格式
    return filteredResults.slice(0, limit).map((result, index) => ({
      id: result.ref,
      score: result.score,
      matchData: {
        position: index,
        terms: result.matchData?.terms || [],
        metadata: result.matchData?.metadata || {},
      },
    }));
  }

  /**
   * 预处理查询 - 增强中文支持
   */
  private preprocessQuery(query: string): string {
    const tokens = this.chineseTokenizer.tokenize(query);
    
    // 构建查询字符串，对重要词汇加权
    const queryTerms: string[] = [];
    
    // 长词优先加权
    for (const token of tokens) {
      if (token.length >= 2) {
        // 2字以上的词给予更高权重
        queryTerms.push(`${token}^${Math.min(token.length, 3)}`);
      } else {
        queryTerms.push(token);
      }
    }
    
    return queryTerms.join(' ');
  }

  /**
   * 高级搜索 - 支持字段限定
   */
  advancedSearch(
    options: {
      query?: string;
      title?: string;
      content?: string;
      type?: MemoryType;
      minScore?: number;
      limit?: number;
    }
  ): FullTextSearchResult[] {
    const queryParts: string[] = [];
    
    if (options.title) {
      queryParts.push(`title:(${options.title})`);
    }
    if (options.content) {
      queryParts.push(`content:(${options.content})`);
    }
    if (options.type) {
      queryParts.push(`type:${options.type}`);
    }
    if (options.query) {
      queryParts.push(this.preprocessQuery(options.query));
    }
    
    const query = queryParts.join(' ');
    if (!query) return [];
    
    let results = this.search(query, options.limit || 50);
    
    if (options.minScore !== undefined) {
      results = results.filter(r => r.score >= options.minScore!);
    }
    
    return results;
  }

  /**
   * 重建索引（当文档大量变更时使用）
   */
  rebuild(): void {
    const docs = Array.from(this.documents.values());
    this.initializeIndex();
    
    for (const doc of docs) {
      this.index.add({
        id: doc.id,
        title: doc.title || '',
        content: doc.content,
        type: doc.type,
      });
    }
    
    this.dirty = false;
    console.log(`Rebuilt fulltext index with ${docs.length} documents`);
  }

  /**
   * 获取文档数量
   */
  size(): number {
    return this.documents.size;
  }

  /**
   * 获取文档
   */
  getDocument(id: string): FullTextDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.documents.clear();
    this.initializeIndex();
  }

  /**
   * 导出索引
   */
  export(): { documents: FullTextDocument[]; fieldWeights: Record<string, number> } {
    return {
      documents: Array.from(this.documents.values()),
      fieldWeights: this.fieldWeights,
    };
  }

  /**
   * 导入索引
   */
  import(data: { documents: FullTextDocument[]; fieldWeights: Record<string, number> }): void {
    this.fieldWeights = data.fieldWeights;
    this.clear();
    this.addBatch(data.documents);
  }

  /**
   * 获取热门关键词
   */
  getTopTerms(limit: number = 20): { term: string; count: number }[] {
    const termCounts: Record<string, number> = {};
    
    for (const doc of this.documents.values()) {
      const tokens = this.chineseTokenizer.tokenize(doc.content);
      for (const token of tokens) {
        if (token.length >= 2) { // 只统计长度>=2的词
          termCounts[token] = (termCounts[token] || 0) + 1;
        }
      }
    }
    
    return Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

export { ChineseTokenizer };
