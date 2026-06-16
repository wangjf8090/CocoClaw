/**
 * Zhongkang Medical Advisor MCP Adapter
 * 
 * 中康科技医疗数据库 + 卓睦鸟医疗大模型适配器
 * 支持药品查询、症状分析、体检报告解读、文献检索等医疗能力
 * 
 * @version 1.0.0
 * @date 2026-06-12
 * @author SelfClaw Architecture Team
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 药品信息
 */
export interface DrugInfo {
  id: string;
  genericName: string;        // 通用名
  brandName?: string;         // 商品名
  aliases?: string[];          // 别名
  dosageForm: string;         // 剂型
  specifications: string;     // 规格
  manufacturer: string;        // 生产企业
  indications: string[];      // 适应症
  usage: string;              // 用法用量
  contraindications: string[];// 禁忌症
  warnings: string[];         // 注意事项
  adverseReactions: string[]; // 不良反应
  interactions: DrugInteraction[];
  storage: string;           // 贮藏条件
  approvalNumber: string;     // 批准文号
}

/**
 * 药物相互作用
 */
export interface DrugInteraction {
  drugName: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
}

/**
 * 症状分析结果
 */
export interface SymptomAnalysis {
  symptoms: string[];
  possibleDiagnoses: PossibleDiagnosis[];
  recommendedTests: RecommendedTest[];
  urgency: 'info' | 'warning' | 'urgent';
  advice: string;
}

/**
 * 可能的诊断
 */
export interface PossibleDiagnosis {
  disease: string;
  icdCode?: string;          // ICD-10编码
  probability: number;        // 可能性 0-1
  description: string;
}

/**
 * 推荐检查
 */
export interface RecommendedTest {
  testName: string;
  purpose: string;
  urgency: 'routine' | 'urgent';
}

/**
 * 体检报告解读
 */
export interface ExamReportInterpretation {
  patientInfo?: {
    age?: number;
    gender?: string;
  };
  reportDate?: string;
  abnormalItems: ExamItem[];
  normalItems: ExamItem[];
  healthAdvice: HealthAdvice;
  followUpRecommendation: string;
}

/**
 * 体检项目
 */
export interface ExamItem {
  name: string;
  value: string | number;
  unit: string;
  referenceRange: {
    min: number;
    max: number;
  };
  status: 'normal' | 'borderline' | 'abnormal';
  severity?: 'mild' | 'moderate' | 'severe';
  interpretation: string;
}

/**
 * 健康建议
 */
export interface HealthAdvice {
  dietAdvice?: string[];
  exerciseAdvice?: string[];
  lifestyleAdvice?: string[];
  warningItems?: string[];
}

/**
 * 文献检索结果
 */
export interface LiteratureSearchResult {
  query: string;
  totalResults: number;
  articles: LiteratureArticle[];
  searchFilters: {
    years?: [number, number];
    articleTypes?: string[];
    languages?: string[];
  };
}

/**
 * 文献文章
 */
export interface LiteratureArticle {
  pmid?: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  abstract?: string;
  keywords: string[];
  doi?: string;
  citedBy?: number;
}

/**
 * 健康管理方案
 */
export interface HealthManagementPlan {
  condition: string;
  patientProfile: {
    age?: number;
    gender?: string;
    comorbidities?: string[];
  };
  goals: string[];
  medicationPlan?: MedicationPlan[];
  lifestylePlan: LifestylePlan;
  monitoringPlan: MonitoringPlan[];
  followUpSchedule: FollowUpSchedule[];
}

/**
 * 用药方案
 */
export interface MedicationPlan {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  purpose: string;
  sideEffects?: string[];
}

/**
 * 生活方式方案
 */
export interface LifestylePlan {
  diet: {
    recommendations: string[];
    restrictions: string[];
    mealPlan?: string;
  };
  exercise: {
    recommendations: string[];
    frequency: string;
    intensity: string;
  };
  sleep: {
    hoursPerNight: number;
    recommendations: string[];
  };
  other: string[];
}

/**
 * 监测方案
 */
export interface MonitoringPlan {
  indicator: string;
  frequency: string;
  targetRange: string;
  alertConditions: string[];
}

/**
 * 随访计划
 */
export interface FollowUpSchedule {
  timing: string;
  content: string;
  purpose: string;
}

/**
 * 医疗数据
 */
export interface MedicalData {
  type: 'statistics' | 'epidemiology' | 'market' | 'clinical';
  title: string;
  description: string;
  dataPoints: Record<string, any>;
  source: string;
  dateRange?: [string, string];
}

/**
 * API错误
 */
export interface MedicalAPIError {
  code: string;
  message: string;
  details?: string;
}

// ============================================================================
// API 配置
// ============================================================================

/**
 * Zhongkang API配置
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
  temperature: 0.3, // 医疗场景需要较低随机性
};

// ============================================================================
// 主适配器类
// ============================================================================

/**
 * Zhongkang Medical Advisor Adapter
 * 
 * 封装中康科技医疗数据库和卓睦鸟医疗大模型
 * 提供药品查询、症状分析、体检报告解读等医疗能力
 */
export class ZhongkangMedicalAdapter {
  private zhongkangConfig: ZhongkangAPIConfig;
  private zhuomuConfig: ZhuomuLLMConfig;
  private cache: Map<string, { data: any; expireTime: number }>;

  constructor(
    zhongkangConfig: Partial<ZhongkangAPIConfig> = {},
    zhuomuConfig: Partial<ZhuomuLLMConfig> = {}
  ) {
    this.zhongkangConfig = { ...DEFAULT_ZHONGKANG_CONFIG, ...zhongkangConfig };
    this.zhuomuConfig = { ...DEFAULT_ZHUOMU_CONFIG, ...zhuomuConfig };
    this.cache = new Map();
  }

  // ==========================================================================
  // 核心方法
  // ==========================================================================

  /**
   * 获取药品信息
   * 
   * 支持商品名、通用名、别名查询
   * 
   * @param drugName 药品名称
   * @param options 查询选项
   * @returns 药品详细信息
   * 
   * @example
   * ```typescript
   * const drug = await adapter.getDrugInfo('阿司匹林');
   * console.log(`适应症: ${drug.indications.join(', ')}`);
   * ```
   */
  async getDrugInfo(
    drugName: string,
    options: {
      includeInteractions?: boolean;
      userAllergies?: string[];
    } = {}
  ): Promise<DrugInfo> {
    const cacheKey = `drug:${drugName}`;
    const cached = this.getFromCache<DrugInfo>(cacheKey);
    if (cached) return cached;

    try {
      // 调用中康API获取药品信息
      const response = await this.callZhongkangAPI<DrugInfo>('/drug/search', {
        name: drugName,
        include_interactions: options.includeInteractions ?? true
      });

      // 检查过敏
      if (options.userAllergies?.length && response.allergens?.length) {
        const allergyWarning = this.checkAllergyMatch(
          response.allergens,
          options.userAllergies
        );
        if (allergyWarning) {
          return {
            ...response,
            warnings: [...response.warnings, allergyWarning]
          };
        }
      }

      this.setCache(cacheKey, response, 3600000); // 1小时缓存
      return response;

    } catch (error) {
      throw this.handleError(error, 'getDrugInfo', drugName);
    }
  }

  /**
   * 检查药物相互作用
   * 
   * @param drug1 药品1名称
   * @param drug2 药品2名称
   * @returns 相互作用分析结果
   */
  async checkDrugInteraction(
    drug1: string,
    drug2: string
  ): Promise<DrugInteraction[]> {
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
   * 
   * @param symptoms 症状描述数组
   * @param context 患者上下文
   * @returns 症状分析结果
   * 
   * @example
   * ```typescript
   * const analysis = await adapter.analyzeSymptoms(
   *   ['头痛', '发热', '乏力'],
   *   { age: 45, gender: 'male' }
   * );
   * ```
   */
  async analyzeSymptoms(
    symptoms: string[],
    context: {
      age?: number;
      gender?: 'male' | 'female';
      medicalHistory?: string[];
      currentMedications?: string[];
    } = {}
  ): Promise<SymptomAnalysis> {
    // 1. 检查紧急症状
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

    // 2. 调用中康API进行基础分析
    try {
      const basicAnalysis = await this.callZhongkangAPI<{
        possible_diagnoses: PossibleDiagnosis[];
        recommended_tests: RecommendedTest[];
      }>('/symptom/analyze', {
        symptoms,
        age: context.age,
        gender: context.gender,
        medical_history: context.medicalHistory
      });

      // 3. 调用卓睦鸟大模型进行增强分析
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
   * 
   * @param reportData 体检报告数据
   * @returns 解读结果
   * 
   * @example
   * ```typescript
   * const report = await adapter.interpretExamReport({
   *   items: [
   *     { name: '空腹血糖', value: 7.2, unit: 'mmol/L' },
   *     { name: '血压', value: '145/95', unit: 'mmHg' }
   *   ],
   *   patientAge: 55,
   *   gender: 'male'
   * });
   * ```
   */
  async interpretExamReport(
    reportData: {
      items: Array<{ name: string; value: string | number; unit?: string }>;
      patientAge?: number;
      gender?: string;
      reportDate?: string;
    }
  ): Promise<ExamReportInterpretation> {
    try {
      // 1. 调用中康API进行基础解读
      const basicInterpretation = await this.callZhongkangAPI<{
        abnormal_items: ExamItem[];
        normal_items: ExamItem[];
      }>('/exam/interpret', {
        items: reportData.items,
        age: reportData.patientAge,
        gender: reportData.gender
      });

      // 2. 调用卓睦鸟大模型进行综合建议
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
   * 检索医学文献
   * 
   * @param query 检索词
   * @param options 检索选项
   * @returns 文献检索结果
   * 
   * @example
   * ```typescript
   * const results = await adapter.searchLiterature(
   *   'CAR-T cell therapy lymphoma',
   *   { years: [2020, 2024], limit: 20 }
   * );
   * ```
   */
  async searchLiterature(
    query: string,
    options: {
      years?: [number, number];
      articleTypes?: string[];
      languages?: string[];
      impactFactorMin?: number;
      limit?: number;
    } = {}
  ): Promise<LiteratureSearchResult> {
    const cacheKey = `lit:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache<LiteratureSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.callZhongkangAPI<LiteratureSearchResult>(
        '/literature/search',
        {
          query,
          year_start: options.years?.[0],
          year_end: options.years?.[1],
          article_types: options.articleTypes,
          languages: options.languages,
          impact_factor_min: options.impactFactorMin,
          limit: options.limit ?? 20
        }
      );

      this.setCache(cacheKey, response, 1800000); // 30分钟缓存
      return response;

    } catch (error) {
      throw this.handleError(error, 'searchLiterature', query);
    }
  }

  /**
   * 生成健康管理方案
   * 
   * @param condition 疾病/健康状况
   * @param patientProfile 患者档案
   * @returns 个性化健康管理方案
   */
  async generateHealthPlan(
    condition: string,
    patientProfile: {
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
    }
  ): Promise<HealthManagementPlan> {
    try {
      // 调用中康API获取疾病指南
      const guidelines = await this.callZhongkangAPI<{
        treatment_guidelines: string[];
        medication_standards: any[];
        monitoring_standards: any[];
      }>('/disease/guidelines', { condition });

      // 调用卓睦鸟大模型生成个性化方案
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
   * 
   * @param type 数据类型
   * @param query 分析查询
   * @returns 分析结果
   */
  async analyzeMedicalData(
    type: 'statistics' | 'epidemiology' | 'market' | 'clinical',
    query: {
      disease?: string;
      drug?: string;
      region?: string;
      timeRange?: [string, string];
    }
  ): Promise<MedicalData> {
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
   * 调用中康科技API
   */
  private async callZhongkangAPI<T>(
    endpoint: string,
    params: Record<string, any>
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
        throw {
          code: 'NOT_FOUND',
          message: '未找到相关数据'
        };
      }
      throw {
        code: 'API_ERROR',
        message: `中康API调用失败: ${response.status}`
      };
    }

    return response.json() as T;
  }

  /**
   * 调用卓睦鸟医疗大模型
   */
  private async callZhuomuLLM<T>(
    endpoint: string,
    params: Record<string, any>
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
      throw {
        code: 'LLM_ERROR',
        message: `卓睦鸟大模型调用失败: ${response.status}`
      };
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

    if (hasUrgentKeyword && hasHighProbability) {
      return 'urgent';
    }

    if (hasUrgentKeyword || hasHighProbability) {
      return 'warning';
    }

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
  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expireTime: Date.now() + ttl
    });
  }

  /**
   * 错误处理
   */
  private handleError(error: any, method: string, context: string): MedicalAPIError {
    console.error(`[ZhongkangMedical] ${method} 失败 (${context}):`, error);

    if (error.code) {
      return error as MedicalAPIError;
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: `${method} 执行失败: ${error.message || '未知错误'}`
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export default ZhongkangMedicalAdapter;
export { ZhongkangMedicalAdapter };
