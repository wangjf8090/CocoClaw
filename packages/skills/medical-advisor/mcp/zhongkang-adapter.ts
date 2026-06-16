/**
 * 中康科技数据源适配器
 * 
 * 原 mcp-adapter.ts 重构为可插拔数据源
 * 封装中康科技医疗数据库和卓睦鸟医疗大模型
 * 
 * @version 1.1.0
 * @date 2026-06-14
 */

import {
  MedicalDataSource,
  Capability,
  DrugInfo,
  DrugInteraction,
  SymptomAnalysis,
  ExamReportInterpretation,
  LiteratureSearchResult,
  HealthManagementPlan,
  MedicalData,
  MedicalAPIError,
  PossibleDiagnosis,
  RecommendedTest,
  ExamItem,
  HealthAdvice
} from './interfaces';

// ============================================================================
// API 配置
// ============================================================================

/**
 * 中康 API 配置
 */
export interface ZhongkangAPIConfig {
  apiKey: string;
  baseURL: string;
  timeout: number;
  maxRetries: number;
}

/**
 * 卓睦鸟大模型配置
 */
export interface ZhuomuLLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
}

/**
 * 默认配置
 */
const DEFAULT_ZHONGKANG_CONFIG: ZhongkangAPIConfig = {
  apiKey: process.env.ZHONGKANG_API_KEY || '',
  baseURL: 'https://api.zhongkang.com/v1',
  timeout: 15000,
  maxRetries: 3,
};

const DEFAULT_ZHUOMU_CONFIG: ZhuomuLLMConfig = {
  apiKey: process.env.ZHUOMU_API_KEY || '',
  baseURL: 'https://api.zhuomu-bird.com/v1',
  model: 'zhuomu-medical-v2',
  temperature: 0.3,
};

// ============================================================================
// 数据源类
// ============================================================================

/**
 * 中康科技数据源适配器
 * 
 * 实现 MedicalDataSource 接口
 * 封装中康科技医疗数据库和卓睦鸟医疗大模型
 */
export class ZhongkangDataSource implements MedicalDataSource {
  readonly id = 'zhongkang';
  readonly name = '中康科技医疗数据库';
  readonly priority = 1;
  readonly capabilities: Capability[] = ['qa', 'drug', 'report', 'guideline'];
  
  private zhongkangConfig: ZhongkangAPIConfig;
  private zhuomuConfig: ZhuomuLLMConfig;
  private cache: Map<string, { data: unknown; expireTime: number }>;
  
  constructor(
    zhongkangConfig: Partial<ZhongkangAPIConfig> = {},
    zhuomuConfig: Partial<ZhuomuLLMConfig> = {}
  ) {
    this.zhongkangConfig = { ...DEFAULT_ZHONGKANG_CONFIG, ...zhongkangConfig };
    this.zhuomuConfig = { ...DEFAULT_ZHUOMU_CONFIG, ...zhuomuConfig };
    this.cache = new Map();
  }
  
  /**
   * 查询数据
   */
  async query<T>(capability: Capability, params: Record<string, unknown>): Promise<T> {
    switch (capability) {
      case 'drug':
        return this.getDrugInfo(params) as Promise<T>;
      case 'qa':
        return this.analyzeSymptoms(params) as Promise<T>;
      case 'report':
        return this.interpretExamReport(params) as Promise<T>;
      case 'literature':
        return this.searchLiterature(params) as Promise<T>;
      default:
        throw new Error(`Unsupported capability: ${capability}`);
    }
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.callZhongkangAPI('/health', {});
      return true;
    } catch {
      return false;
    }
  }
  
  // ==========================================================================
  // 核心方法
  // ==========================================================================
  
  /**
   * 获取药品信息
   */
  async getDrugInfo(params: Record<string, unknown>): Promise<DrugInfo> {
    const drugName = params.drugName as string;
    const cacheKey = `drug:${drugName}`;
    const cached = this.getFromCache<DrugInfo>(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await this.callZhongkangAPI<DrugInfo>('/drug/search', {
        name: drugName,
        include_interactions: params.includeInteractions ?? true
      });
      
      // 检查过敏
      if (params.userAllergies && Array.isArray(params.userAllergies) && response) {
        const allergyWarning = this.checkAllergyMatch(
          (response as unknown as { allergens?: string[] }).allergens || [],
          params.userAllergies as string[]
        );
        if (allergyWarning) {
          (response as DrugInfo).warnings = [...(response.warnings || []), allergyWarning];
        }
      }
      
      this.setCache(cacheKey, response, 3600000);
      return response;
    } catch (error) {
      throw this.handleError(error, 'getDrugInfo', drugName);
    }
  }
  
  /**
   * 检查药物相互作用
   */
  async checkDrugInteraction(params: Record<string, unknown>): Promise<DrugInteraction[]> {
    const drug1 = params.drug1 as string;
    const drug2 = params.drug2 as string;
    
    try {
      const response = await this.callZhongkangAPI<DrugInteraction[]>(
        '/drug/interactions',
        { drug1, drug2 }
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'checkDrugInteraction', `${drug1} + ${drug2}`);
    }
  }
  
  /**
   * 分析症状
   */
  async analyzeSymptoms(params: Record<string, unknown>): Promise<SymptomAnalysis> {
    const symptoms = params.symptoms as string[];
    const context = params.context as {
      age?: number;
      gender?: 'male' | 'female';
      medicalHistory?: string[];
      currentMedications?: string[];
    } | undefined;
    
    // 检查紧急症状
    const urgentKeywords = [
      '胸痛', '呼吸困难', '意识模糊', '大出血',
      '意识丧失', '抽搐', '严重过敏'
    ];
    
    const hasUrgent = symptoms.some(s =>
      urgentKeywords.some(k => s.includes(k))
    );
    
    if (hasUrgent) {
      return {
        symptoms,
        possibleDiagnoses: [],
        recommendedTests: [],
        urgency: 'urgent',
        advice: '您的症状可能需要紧急医疗处理，建议立即就医或拨打120'
      };
    }
    
    try {
      // 基础分析
      const basicAnalysis = await this.callZhongkangAPI<{
        possible_diagnoses: PossibleDiagnosis[];
        recommended_tests: RecommendedTest[];
      }>('/symptom/analyze', {
        symptoms,
        age: context?.age,
        gender: context?.gender,
        medical_history: context?.medicalHistory
      });
      
      // 增强分析
      const enhancedAnalysis = await this.callZhuomuLLM<{
        interpretation: string;
        advice: string;
      }>('/medical/symptom-analysis', {
        symptoms,
        context,
        basic_diagnoses: basicAnalysis.possible_diagnoses
      });
      
      return {
        symptoms,
        possibleDiagnoses: basicAnalysis.possible_diagnoses,
        recommendedTests: basicAnalysis.recommended_tests,
        urgency: this.assessUrgency(symptoms, basicAnalysis.possible_diagnoses),
        advice: enhancedAnalysis.advice
      };
    } catch (error) {
      throw this.handleError(error, 'analyzeSymptoms', symptoms.join(', '));
    }
  }
  
  /**
   * 解读体检报告
   */
  async interpretExamReport(params: Record<string, unknown>): Promise<ExamReportInterpretation> {
    const reportData = params.reportData as {
      items: Array<{ name: string; value: string | number; unit?: string }>;
      patientAge?: number;
      gender?: string;
      reportDate?: string;
    };
    
    try {
      // 基础解读
      const basicInterpretation = await this.callZhongkangAPI<{
        abnormal_items: ExamItem[];
        normal_items: ExamItem[];
      }>('/exam/interpret', {
        items: reportData.items,
        age: reportData.patientAge,
        gender: reportData.gender
      });
      
      // 综合建议
      const enhancedAdvice = await this.callZhuomuLLM<{
        health_advice: HealthAdvice;
        follow_up: string;
      }>('/medical/exam-analysis', {
        interpretation: basicInterpretation,
        patient_info: {
          age: reportData.patientAge,
          gender: reportData.gender
        }
      });
      
      return {
        patientInfo: {
          age: reportData.patientAge,
          gender: reportData.gender
        },
        reportDate: reportData.reportDate,
        abnormalItems: basicInterpretation.abnormal_items,
        normalItems: basicInterpretation.normal_items,
        healthAdvice: enhancedAdvice.health_advice,
        followUpRecommendation: enhancedAdvice.follow_up
      };
    } catch (error) {
      throw this.handleError(error, 'interpretExamReport', '');
    }
  }
  
  /**
   * 检索文献
   */
  async searchLiterature(params: Record<string, unknown>): Promise<LiteratureSearchResult> {
    const query = params.query as string;
    const options = params.options as {
      years?: [number, number];
      articleTypes?: string[];
      languages?: string[];
      impactFactorMin?: number;
      limit?: number;
    } | undefined;
    
    const cacheKey = `lit:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache<LiteratureSearchResult>(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await this.callZhongkangAPI<LiteratureSearchResult>(
        '/literature/search',
        {
          query,
          year_start: options?.years?.[0],
          year_end: options?.years?.[1],
          article_types: options?.articleTypes,
          languages: options?.languages,
          impact_factor_min: options?.impactFactorMin,
          limit: options?.limit ?? 20
        }
      );
      
      this.setCache(cacheKey, response, 1800000);
      return response;
    } catch (error) {
      throw this.handleError(error, 'searchLiterature', query);
    }
  }
  
  /**
   * 生成健康管理方案
   */
  async generateHealthPlan(params: Record<string, unknown>): Promise<HealthManagementPlan> {
    const condition = params.condition as string;
    const patientProfile = params.patientProfile as {
      age?: number;
      gender?: 'male' | 'female';
      weight?: number;
      height?: number;
      comorbidities?: string[];
      currentMedications?: string[];
      lifestyle?: {
        diet?: string;
        exercise?: string;
        smoking?: boolean;
        alcohol?: boolean;
      };
    };
    
    try {
      // 获取疾病指南
      const guidelines = await this.callZhongkangAPI<{
        treatment_guidelines: string[];
        medication_standards: unknown[];
        monitoring_standards: unknown[];
      }>('/disease/guidelines', { condition });
      
      // 生成个性化方案
      const personalizedPlan = await this.callZhuomuLLM<HealthManagementPlan>(
        '/medical/health-plan',
        {
          condition,
          patient_profile: patientProfile,
          guidelines
        }
      );
      
      return personalizedPlan;
    } catch (error) {
      throw this.handleError(error, 'generateHealthPlan', condition);
    }
  }
  
  /**
   * 医疗数据分析
   */
  async analyzeMedicalData(params: Record<string, unknown>): Promise<MedicalData> {
    const type = params.type as 'statistics' | 'epidemiology' | 'market' | 'clinical';
    const query = params.query as {
      disease?: string;
      drug?: string;
      region?: string;
      timeRange?: [string, string];
    };
    
    try {
      const response = await this.callZhongkangAPI<MedicalData>(
        `/data/${type}`,
        query
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'analyzeMedicalData', type);
    }
  }
  
  // ==========================================================================
  // 辅助方法
  // ==========================================================================
  
  /**
   * 调用中康 API
   */
  private async callZhongkangAPI<T>(
    endpoint: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.zhongkangConfig.baseURL}${endpoint}`;
    const queryString = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    
    const response = await fetch(`${url}?${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.zhongkangConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(this.zhongkangConfig.timeout)
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw { code: 'NOT_FOUND', message: '未找到相关数据' };
      }
      throw { code: 'API_ERROR', message: `中康API调用失败: ${response.status}` };
    }
    
    return response.json() as T;
  }
  
  /**
   * 调用卓睦鸟大模型
   */
  private async callZhuomuLLM<T>(
    endpoint: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.zhuomuConfig.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.zhuomuConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.zhuomuConfig.model,
        temperature: this.zhuomuConfig.temperature,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的医疗AI助手，只能提供医疗信息参考，不能替代医生诊断。'
          },
          {
            role: 'user',
            content: JSON.stringify(params)
          }
        ]
      }),
      signal: AbortSignal.timeout(this.zhongkangConfig.timeout)
    });
    
    if (!response.ok) {
      throw { code: 'LLM_ERROR', message: `卓睦鸟大模型调用失败: ${response.status}` };
    }
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content) as T;
  }
  
  /**
   * 检查过敏匹配
   */
  private checkAllergyMatch(
    allergens: string[],
    userAllergies: string[]
  ): string | null {
    for (const allergen of allergens) {
      if (userAllergies.some(a => 
        allergen.toLowerCase().includes(a.toLowerCase()) ||
        a.toLowerCase().includes(allergen.toLowerCase())
      )) {
        return `⚠️ 警告：该药含有${allergen}成分，与您的过敏史（${a}）可能冲突，请务必在医生指导下使用`;
      }
    }
    return null;
  }
  
  /**
   * 评估紧急程度
   */
  private assessUrgency(
    symptoms: string[],
    diagnoses: PossibleDiagnosis[]
  ): 'info' | 'warning' | 'urgent' {
    const urgentKeywords = ['持续', '严重', '加剧', '急性'];
    const hasUrgentKeyword = symptoms.some(s =>
      urgentKeywords.some(k => s.includes(k))
    );
    
    const hasHighProbability = diagnoses.some(d => d.probability > 0.7);
    
    if (hasUrgentKeyword && hasHighProbability) return 'urgent';
    if (hasUrgentKeyword || hasHighProbability) return 'warning';
    return 'info';
  }
  
  /**
   * 缓存读取
   */
  private getFromCache<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }
  
  /**
   * 缓存写入
   */
  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      expireTime: Date.now() + ttl
    });
  }
  
  /**
   * 错误处理
   */
  private handleError(error: unknown, method: string, context: string): MedicalAPIError {
    console.error(`[ZhongkangDataSource] ${method} 失败 (${context}):`, error);
    
    if (error && typeof error === 'object' && 'code' in error) {
      return error as MedicalAPIError;
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: `${method} 执行失败: ${(error as Error)?.message || '未知错误'}`
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export default ZhongkangDataSource;
export { ZhongkangDataSource };
