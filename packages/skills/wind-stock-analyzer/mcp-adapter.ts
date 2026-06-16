/**
 * Wind Stock Analyzer MCP Adapter
 * 
 * Wind金融终端API适配器，封装万得数据接口，支持A股/港股/美股全品类数据查询
 * 
 * @version 1.0.0
 * @date 2026-06-12
 * @author SelfClaw Architecture Team
 */

import { 
  StockQuote, 
  FinancialReport, 
  HistoricalData, 
  SectorAnalysis,
  NewsSentiment,
  ScreenerResult,
  WindAPIError,
  MarketType,
  AdjustmentType
} from './types.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 股票代码标准化结果
 */
export interface NormalizedStockCode {
  code: string;
  market: MarketType;
  exchange: 'SH' | 'SZ' | 'HK' | 'NYSE' | 'NASDAQ';
  original: string;
  normalized: boolean;
}

/**
 * 股票实时行情
 */
export interface StockQuote {
  code: string;
  name: string;
  exchange: string;
  board?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnover: number;
  marketCap: number;
  pe?: number;
  pb?: number;
  ps?: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  timestamp: string;
  suspended?: boolean;
  delisted?: boolean;
}

/**
 * 历史K线数据
 */
export interface KLine {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  changePercent?: number;
}

/**
 * 财务指标
 */
export interface FinancialIndicators {
  code: string;
  name: string;
  reportPeriod: string;
  // 盈利能力
  roe: number;
  roa: number;
  grossMargin: number;
  netMargin: number;
  // 偿债能力
  debtRatio: number;
  currentRatio: number;
  quickRatio: number;
  // 运营能力
  inventoryTurnover: number;
  receivablesTurnover: number;
  totalAssetTurnover: number;
  // 成长能力
  revenueGrowth: number;
  profitGrowth: number;
  // 估值
  pe_ttm: number;
  pb: number;
  ps_ttm: number;
  dividendYield: number;
}

/**
 * 财务报表
 */
export interface FinancialReport {
  code: string;
  name: string;
  period: string;
  type: 'annual' | 'quarter' | 'semi-annual';
  balanceSheet: Record<string, number>;
  incomeStatement: Record<string, number>;
  cashFlowStatement: Record<string, number>;
  auditOpinion?: string;
  timestamp: string;
}

/**
 * 板块分析
 */
export interface SectorAnalysis {
  sectorName: string;
  sectorCode: string;
  stocks: Array<{
    code: string;
    name: string;
    changePercent: number;
    marketCap: number;
    isLeader: boolean;
  }>;
  sectorIndex: {
    code: string;
    name: string;
    changePercent: number;
    pe: number;
    pb: number;
  };
}

/**
 * 新闻舆情
 */
export interface NewsSentiment {
  stockCode: string;
  stockName: string;
  newsCount: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -100 到 100
  keyThemes: string[];
  recentNews: Array<{
    title: string;
    source: string;
    timestamp: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    url?: string;
  }>;
}

/**
 * 筛选器结果
 */
export interface ScreenerResult {
  totalCount: number;
  stocks: Array<{
    code: string;
    name: string;
    price: number;
    changePercent: number;
    reason?: string;
  }>;
  filters: Record<string, any>;
  timestamp: string;
}

/**
 * API错误
 */
export interface WindAPIError {
  code: string;
  message: string;
  httpStatus?: number;
  retryAfter?: number;
  suggestion?: string;
}

// ============================================================================
// Wind API 配置
// ============================================================================

/**
 * Wind API配置
 */
export interface WindAPIConfig {
  apiKey: string;
  baseURL: string;
  timeout: number;
  maxRetries: number;
  cacheTTL: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: WindAPIConfig = {
  apiKey: process.env.WIND_API_KEY || '',
  baseURL: 'https://api.wind.com/v1',
  timeout: 10000,
  maxRetries: 3,
  cacheTTL: 30000, // 30秒缓存
};

// ============================================================================
// 缓存实现
// ============================================================================

/**
 * 简单内存缓存
 */
class CacheManager {
  private cache: Map<string, { data: any; expireTime: number }> = new Map();

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }

  /**
   * 设置缓存
   */
  set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expireTime: Date.now() + ttl
    });
  }

  /**
   * 清除过期缓存
   */
  clear(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireTime) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// Wind MCP Adapter 主类
// ============================================================================

/**
 * Wind MCP Adapter
 * 
 * 封装Wind金融终端API，提供股票行情、财务数据、板块分析等能力
 * 
 * @example
 * ```typescript
 * const adapter = new WindMCPAdapter();
 * const quote = await adapter.getStockQuote('600519.SH');
 * const financials = await adapter.getFinancialReport('600519.SH');
 * ```
 */
export class WindMCPAdapter {
  private config: WindAPIConfig;
  private cache: CacheManager;

  constructor(config: Partial<WindAPIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new CacheManager();
  }

  // ==========================================================================
  // 核心方法
  // ==========================================================================

  /**
   * 获取股票实时行情
   * 
   * 支持A股、港股、美股三类数据，自动识别股票代码类型
   * 
   * @param code 股票代码，支持格式：
   *   - A股: 600519.SH, 000001.SZ, 688981.SH, 300750.SZ
   *   - 港股: 00700.HK, 01810.HK
   *   - 美股: AAPL.O, GOOGL.O
   * @returns 股票实时行情
   * @throws WindAPIError 当API调用失败时
   * 
   * @example
   * ```typescript
   * const quote = await adapter.getStockQuote('600519.SH');
   * console.log(`贵州茅台当前价格: ${quote.price}`);
   * ```
   */
  async getStockQuote(code: string): Promise<StockQuote> {
    // 1. 标准化股票代码
    const normalized = this.normalizeStockCode(code);
    
    // 2. 检查缓存
    const cacheKey = `quote:${normalized.code}`;
    const cached = this.cache.get<StockQuote>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    try {
      // 3. 调用API
      const data = await this.callAPI<StockQuote>('/stock/quote', {
        code: normalized.code,
        market: normalized.market
      });

      // 4. 检查停牌状态
      if (data.suspended) {
        console.warn(`[WindMCP] 股票 ${normalized.code} 已停牌`);
      }

      // 5. 缓存结果
      this.cache.set(cacheKey, data, this.config.cacheTTL);

      return data;

    } catch (error) {
      // 6. 错误处理
      throw this.handleAPIError(error, 'getStockQuote', normalized.code);
    }
  }

  /**
   * 获取财务报表
   * 
   * @param code 股票代码
   * @param options 配置选项
   * @returns 财务报表
   * 
   * @example
   * ```typescript
   * const report = await adapter.getFinancialReport('600519.SH', { type: 'annual' });
   * ```
   */
  async getFinancialReport(
    code: string,
    options: {
      type?: 'annual' | 'quarter' | 'semi-annual';
      year?: number;
    } = {}
  ): Promise<FinancialReport> {
    const normalized = this.normalizeStockCode(code);
    const { type = 'annual', year } = options;

    const cacheKey = `financial:${normalized.code}:${type}:${year || 'latest'}`;
    const cached = this.cache.get<FinancialReport>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.callAPI<FinancialReport>('/stock/financial', {
        code: normalized.code,
        type,
        year
      });

      this.cache.set(cacheKey, data, this.config.cacheTTL * 2); // 财务数据缓存更长

      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'getFinancialReport', normalized.code);
    }
  }

  /**
   * 获取历史K线数据
   * 
   * @param code 股票代码
   * @param period 时间周期: 1d, 1w, 1m, 3m, 6m, 1y
   * @param adjust 复权类型: qfq(前复权), hfq(后复权), none(不复权)
   * @returns K线数据数组
   * 
   * @example
   * ```typescript
   * const klines = await adapter.getHistoricalData('600519.SH', '1y', 'qfq');
   * ```
   */
  async getHistoricalData(
    code: string,
    period: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' = '1m',
    adjust: AdjustmentType = 'qfq'
  ): Promise<KLine[]> {
    const normalized = this.normalizeStockCode(code);

    const cacheKey = `history:${normalized.code}:${period}:${adjust}`;
    const cached = this.cache.get<KLine[]>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.callAPI<KLine[]>('/stock/history', {
        code: normalized.code,
        period,
        adjust
      });

      this.cache.set(cacheKey, data, this.config.cacheTTL);

      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'getHistoricalData', normalized.code);
    }
  }

  /**
   * 获取板块分析
   * 
   * @param sectorCode 板块代码，支持Wind行业分类或概念板块
   * @returns 板块分析结果
   * 
   * @example
   * ```typescript
   * const analysis = await adapter.getIndustryCompare('半导体');
   * ```
   */
  async getIndustryCompare(sectorCode: string): Promise<SectorAnalysis> {
    const cacheKey = `sector:${sectorCode}`;
    const cached = this.cache.get<SectorAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.callAPI<SectorAnalysis>('/stock/sector', {
        sector: sectorCode
      });

      this.cache.set(cacheKey, data, this.config.cacheTTL);

      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'getIndustryCompare', sectorCode);
    }
  }

  /**
   * 获取新闻舆情
   * 
   * @param code 股票代码
   * @param options 配置选项
   * @returns 新闻舆情分析
   * 
   * @example
   * ```typescript
   * const sentiment = await adapter.getNewsSentiment('600519.SH', { days: 7 });
   * ```
   */
  async getNewsSentiment(
    code: string,
    options: { days?: number; limit?: number } = {}
  ): Promise<NewsSentiment> {
    const normalized = this.normalizeStockCode(code);
    const { days = 7, limit = 10 } = options;

    const cacheKey = `news:${normalized.code}:${days}`;
    const cached = this.cache.get<NewsSentiment>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.callAPI<NewsSentiment>('/stock/news', {
        code: normalized.code,
        days,
        limit
      });

      this.cache.set(cacheKey, data, this.config.cacheTTL);

      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'getNewsSentiment', normalized.code);
    }
  }

  /**
   * 股票筛选器
   * 
   * @param criteria 筛选条件
   * @returns 符合条件股票列表
   * 
   * @example
   * ```typescript
   * const result = await adapter.screenStocks({
   *   limitUp: true,
   *   period: '1d',
   *   market: 'A'
   * });
   * ```
   */
  async screenStocks(criteria: {
    limitUp?: boolean;
    limitDown?: boolean;
    period?: string;
    market?: 'A' | 'HK' | 'US';
    peMin?: number;
    peMax?: number;
    marketCapMin?: number;
    marketCapMax?: number;
  }): Promise<ScreenerResult> {
    try {
      const data = await this.callAPI<ScreenerResult>('/stock/screener', criteria);
      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'screenStocks', '');
    }
  }

  /**
   * 获取财务指标
   * 
   * @param code 股票代码
   * @param indicators 指标列表
   * @returns 财务指标
   * 
   * @example
   * ```typescript
   * const indicators = await adapter.getFinancialIndicators('600519.SH', ['pe_ttm', 'pb', 'roe']);
   * ```
   */
  async getFinancialIndicators(
    code: string,
    indicators: string[]
  ): Promise<FinancialIndicators> {
    const normalized = this.normalizeStockCode(code);

    const cacheKey = `indicators:${normalized.code}:${indicators.join(',')}`;
    const cached = this.cache.get<FinancialIndicators>(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.callAPI<FinancialIndicators>('/stock/indicators', {
        code: normalized.code,
        indicators
      });

      this.cache.set(cacheKey, data, this.config.cacheTTL * 2);

      return data;

    } catch (error) {
      throw this.handleAPIError(error, 'getFinancialIndicators', normalized.code);
    }
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 标准化股票代码
   * 
   * 支持多种输入格式，自动识别并转换为标准格式
   * 
   * @param code 原始股票代码
   * @returns 标准化结果
   */
  normalizeStockCode(code: string): NormalizedStockCode {
    const original = code.trim().toUpperCase();
    
    // A股上证
    if (/^6\d{5}$/.test(original)) {
      return {
        code: `${original}.SH`,
        market: 'A',
        exchange: 'SH',
        original,
        normalized: original !== original
      };
    }
    
    // A股深证
    if (/^(000|001|002|300)\d{3}$/.test(original)) {
      return {
        code: `${original}.SZ`,
        market: 'A',
        exchange: 'SZ',
        original,
        normalized: true
      };
    }
    
    // 科创板
    if (/^688\d{3}$/.test(original)) {
      return {
        code: `${original}.SH`,
        market: 'STAR',
        exchange: 'SH',
        original,
        normalized: true
      };
    }
    
    // 创业板
    if (/^300\d{3}$/.test(original)) {
      return {
        code: `${original}.SZ`,
        market: 'MOT',
        exchange: 'SZ',
        original,
        normalized: true
      };
    }
    
    // 港股
    if (/^\d{4,5}$/.test(original) && !original.includes('.')) {
      return {
        code: `${original.padStart(5, '0')}.HK`,
        market: 'HK',
        exchange: 'HK',
        original,
        normalized: true
      };
    }
    
    // 已经是标准格式
    if (/^\d+\.(SH|SZ|HK)$/.test(original)) {
      const [, exchange] = original.split('.');
      return {
        code: original,
        market: exchange === 'HK' ? 'HK' : 'A',
        exchange: exchange as 'SH' | 'SZ' | 'HK',
        original,
        normalized: true
      };
    }
    
    // 美股
    if (/^[A-Z]{1,5}\.(O|N)$/.test(original)) {
      const exchange = original.endsWith('.O') ? 'NASDAQ' : 'NYSE';
      return {
        code: original,
        market: 'US',
        exchange: exchange as 'NYSE' | 'NASDAQ',
        original,
        normalized: true
      };
    }
    
    // 未知格式
    throw {
      code: 'INVALID_CODE',
      message: `无法识别的股票代码格式: ${code}`,
      suggestion: '请使用标准格式，如 600519.SH, 00700.HK, AAPL.O'
    };
  }

  /**
   * 批量获取股票行情
   * 
   * @param codes 股票代码列表
   * @returns 行情映射表
   */
  async getBatchQuotes(codes: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    
    // 并发调用（限制并发数）
    const batchSize = 10;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const promises = batch.map(code => 
        this.getStockQuote(code)
          .then(quote => results.set(code, quote))
          .catch(error => {
            console.error(`[WindMCP] 获取 ${code} 失败:`, error.message);
          })
      );
      await Promise.all(promises);
    }
    
    return results;
  }

  /**
   * 比较股票
   * 
   * @param codes 股票代码列表
   * @param indicators 比较指标
   * @returns 对比结果
   */
  async compareStocks(
    codes: string[],
    indicators: string[]
  ): Promise<{
    stocks: StockQuote[];
    indicators: Map<string, FinancialIndicators>;
    comparison: Record<string, Record<string, number>>;
  }> {
    // 1. 批量获取行情
    const quotes = await this.getBatchQuotes(codes);
    
    // 2. 批量获取指标
    const indicatorPromises = codes.map(code => 
      this.getFinancialIndicators(code, indicators)
        .catch(() => null)
    );
    const indicatorResults = await Promise.all(indicatorPromises);
    
    const indicatorsMap = new Map<string, FinancialIndicators>();
    codes.forEach((code, i) => {
      if (indicatorResults[i]) {
        indicatorsMap.set(code, indicatorResults[i]);
      }
    });
    
    // 3. 构建对比表
    const comparison: Record<string, Record<string, number>> = {};
    for (const indicator of indicators) {
      comparison[indicator] = {};
      for (const [code, ind] of indicatorsMap.entries()) {
        (comparison[indicator] as any)[code] = (ind as any)[indicator];
      }
    }
    
    return {
      stocks: Array.from(quotes.values()),
      indicators: indicatorsMap,
      comparison
    };
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /**
   * 调用API
   */
  private async callAPI<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (response.status === 429) {
          // 限流
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          throw {
            code: 'RATE_LIMITED',
            message: 'API调用频率超限',
            retryAfter,
            httpStatus: 429
          };
        }

        if (response.status === 403) {
          throw {
            code: 'PERMISSION_DENIED',
            message: '权限不足，请检查API Key或升级服务',
            httpStatus: 403
          };
        }

        if (response.status === 404) {
          throw {
            code: 'NOT_FOUND',
            message: '数据未找到',
            httpStatus: 404
          };
        }

        if (!response.ok) {
          throw {
            code: 'API_ERROR',
            message: `API返回错误: ${response.status}`,
            httpStatus: response.status
          };
        }

        const data = await response.json() as T;
        return data;

      } catch (error: any) {
        lastError = error;

        // 不重试的错误
        if (error.code === 'PERMISSION_DENIED' || error.code === 'INVALID_CODE') {
          throw error;
        }

        // 等待后重试
        if (attempt < this.config.maxRetries - 1) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * 处理API错误
   */
  private handleAPIError(error: any, method: string, code: string): WindAPIError {
    console.error(`[WindMCP] ${method} 失败 (${code}):`, error);

    if (error.code) {
      return error as WindAPIError;
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: `${method} 调用失败: ${error.message || '未知错误'}`,
      suggestion: '请稍后重试或联系技术支持'
    };
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 导出
// ============================================================================

export default WindMCPAdapter;
export { WindMCPAdapter };
