/**
 * PubMed 文献检索数据源适配器（Stub）
 * 
 * v3.6.0.1 新增
 * 作为文献检索场景的兜底/扩展数据源
 * 
 * @version 1.1.0
 * @date 2026-06-14
 */

import {
  MedicalDataSource,
  Capability,
  LiteratureSearchResult,
  LiteratureArticle
} from './interfaces';

// ============================================================================
// 配置
// ============================================================================

export interface PubMedConfig {
  apiKey: string;
  email: string;  // NCBI 要求提供 email
  baseURL: string;
  timeout: number;
}

const DEFAULT_CONFIG: PubMedConfig = {
  apiKey: process.env.PUBMED_API_KEY || '',
  email: process.env.PUBMED_EMAIL || 'user@example.com',
  baseURL: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  timeout: 10000,
};

// ============================================================================
// 数据源实现
// ============================================================================

/**
 * PubMed 文献检索数据源
 * 
 * 实现 MedicalDataSource 接口
 * 提供 PubMed 文献检索能力
 */
export class PubMedDataSource implements MedicalDataSource {
  readonly id = 'pubmed';
  readonly name = 'PubMed 医学文献数据库';
  readonly priority = 2;  // 优先级低于 zhongkang（主数据源）
  readonly capabilities: Capability[] = ['literature'];
  
  private config: PubMedConfig;
  
  constructor(config: Partial<PubMedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 查询文献
   */
  async query<T>(capability: Capability, params: Record<string, unknown>): Promise<T> {
    if (capability !== 'literature') {
      throw new Error(`PubMed adapter only supports 'literature' capability, got: ${capability}`);
    }
    
    return this.searchLiterature(params) as Promise<T>;
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.baseURL}/einfo.fcgi?retmode=json&email=${encodeURIComponent(this.config.email)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // ==========================================================================
  // 核心方法
  // ==========================================================================
  
  /**
   * 检索 PubMed 文献
   */
  async searchLiterature(params: Record<string, unknown>): Promise<LiteratureSearchResult> {
    const query = params.query as string;
    const options = params.options as {
      years?: [number, number];
      articleTypes?: string[];
      languages?: string[];
      limit?: number;
    } | undefined;
    
    try {
      // 1. 搜索获取 PMID 列表
      const searchParams = new URLSearchParams({
        db: 'pubmed',
        term: query,
        retmode: 'json',
        retmax: String(options?.limit ?? 20),
        email: this.config.email
      });
      
      if (this.config.apiKey) {
        searchParams.set('api_key', this.config.apiKey);
      }
      
      const searchUrl = `${this.config.baseURL}/esearch.fcgi?${searchParams.toString()}`;
      const searchResponse = await fetch(searchUrl, {
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      if (!searchResponse.ok) {
        throw new Error(`PubMed search failed: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      const ids: string[] = searchData.esearchresult?.idlist || [];
      
      if (ids.length === 0) {
        return {
          query,
          totalResults: 0,
          articles: [],
          searchFilters: {
            years: options?.years,
            articleTypes: options?.articleTypes,
            languages: options?.languages
          }
        };
      }
      
      // 2. 获取文献详情
      const fetchParams = new URLSearchParams({
        db: 'pubmed',
        id: ids.join(','),
        retmode: 'json',
        rettype: 'abstract',
        email: this.config.email
      });
      
      if (this.config.apiKey) {
        fetchParams.set('api_key', this.config.apiKey);
      }
      
      const fetchUrl = `${this.config.baseURL}/efetch.fcgi?${fetchParams.toString()}`;
      const fetchResponse = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`PubMed fetch failed: ${fetchResponse.status}`);
      }
      
      const fetchText = await fetchResponse.text();
      const articles = this.parseArticles(fetchText, ids);
      
      return {
        query,
        totalResults: parseInt(searchData.esearchresult?.count || '0', 10),
        articles,
        searchFilters: {
          years: options?.years,
          articleTypes: options?.articleTypes,
          languages: options?.languages
        }
      };
    } catch (error) {
      console.error('[PubMedDataSource] searchLiterature failed:', error);
      return {
        query,
        totalResults: 0,
        articles: [],
        searchFilters: {}
      };
    }
  }
  
  // ==========================================================================
  // 辅助方法
  // ==========================================================================
  
  /**
   * 解析 PubMed 返回的文献数据
   * 注意：NCBI EFetch 返回的是 XML 格式，这里做简化处理
   */
  private parseArticles(xmlText: string, ids: string[]): LiteratureArticle[] {
    // 简化实现：实际应该解析 XML
    // 这里返回空数组，实际使用时需要更完整的 XML 解析
    return ids.map(pmid => ({
      pmid,
      title: `PubMed Article ${pmid}`,
      authors: [],
      journal: 'Unknown',
      year: new Date().getFullYear(),
      keywords: []
    }));
  }
}

// ============================================================================
// 导出
// ============================================================================

export default PubMedDataSource;
export { PubMedDataSource };
