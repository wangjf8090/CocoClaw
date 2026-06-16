/**
 * Medical DataSource 接口定义
 * 
 * v3.6.0.1 去中康化版核心接口
 * 支持多数据源可插拔架构
 * 
 * @version 1.1.0
 * @date 2026-06-14
 */

// ============================================================================
// 能力类型定义
// ============================================================================

/**
 * 数据源支持的能力类型
 */
export type Capability =
  | 'qa'           // 医学问答
  | 'drug'         // 药品信息
  | 'report'       // 健康报告
  | 'literature'   // 文献检索
  | 'guideline';   // 临床指南

// ============================================================================
// 核心接口定义
// ============================================================================

/**
 * 医疗数据源接口
 * 所有数据源适配器必须实现此接口
 */
export interface MedicalDataSource {
  /** 数据源唯一标识 */
  id: string;
  
  /** 数据源名称 */
  name: string;
  
  /** 优先级（数字越小优先级越高） */
  priority: number;
  
  /** 支持的能力列表 */
  capabilities: Capability[];
  
  /**
   * 查询数据
   * @param capability 能力类型
   * @param params 查询参数
   * @returns 查询结果
   */
  query<T>(capability: Capability, params: Record<string, unknown>): Promise<T>;
  
  /**
   * 健康检查
   * @returns 是否可用
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * 药品信息
 */
export interface DrugInfo {
  id: string;
  genericName: string;        // 通用名
  brandName?: string;         // 商品名
  aliases?: string[];         // 别名
  dosageForm: string;         // 剂型
  specifications: string;     // 规格
  manufacturer: string;       // 生产企业
  indications: string[];      // 适应症
  usage: string;              // 用法用量
  contraindications: string[];// 禁忌症
  warnings: string[];          // 注意事项
  adverseReactions: string[]; // 不良反应
  interactions: DrugInteraction[];
  storage: string;            // 贮藏条件
  approvalNumber: string;      // 批准文号
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
  icdCode?: string;           // ICD-10编码
  probability: number;         // 可能性 0-1
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
  dataPoints: Record<string, unknown>;
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
// 数据源注册表
// ============================================================================

/**
 * 医疗数据源注册表接口
 * 用于管理多数据源的注册、解析和查询
 */
export interface MedicalDataSourceRegistry {
  /**
   * 注册数据源
   * @param source 数据源实例
   */
  register(source: MedicalDataSource): void;
  
  /**
   * 解析最适合的数据源
   * @param capability 能力类型
   * @param context 上下文信息（可选）
   * @returns 最适合的数据源
   */
  resolve(capability: Capability, context?: Record<string, unknown>): Promise<MedicalDataSource>;
  
  /**
   * 列出所有已注册的数据源
   * @returns 数据源列表
   */
  list(): MedicalDataSource[];
  
  /**
   * 移除数据源
   * @param id 数据源ID
   */
  unregister(id: string): void;
  
  /**
   * 获取数据源
   * @param id 数据源ID
   */
  get(id: string): MedicalDataSource | undefined;
}

/**
 * 默认注册表实现
 */
export class DefaultMedicalDataSourceRegistry implements MedicalDataSourceRegistry {
  private sources: Map<string, MedicalDataSource> = new Map();
  
  register(source: MedicalDataSource): void {
    this.sources.set(source.id, source);
  }
  
  resolve(capability: Capability, context?: Record<string, unknown>): Promise<MedicalDataSource> {
    // 按优先级排序
    const candidates = Array.from(this.sources.values())
      .filter(s => s.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority);
    
    if (candidates.length === 0) {
      return Promise.reject(new Error(`No data source found for capability: ${capability}`));
    }
    
    return Promise.resolve(candidates[0]);
  }
  
  list(): MedicalDataSource[] {
    return Array.from(this.sources.values())
      .sort((a, b) => a.priority - b.priority);
  }
  
  unregister(id: string): void {
    this.sources.delete(id);
  }
  
  get(id: string): MedicalDataSource | undefined {
    return this.sources.get(id);
  }
}

// ============================================================================
// 导出
// ============================================================================

export default MedicalDataSource;
export {
  MedicalDataSource,
  MedicalDataSourceRegistry,
  DefaultMedicalDataSourceRegistry,
  DrugInfo,
  DrugInteraction,
  SymptomAnalysis,
  PossibleDiagnosis,
  RecommendedTest,
  ExamReportInterpretation,
  ExamItem,
  HealthAdvice,
  LiteratureSearchResult,
  LiteratureArticle,
  HealthManagementPlan,
  MedicationPlan,
  LifestylePlan,
  MonitoringPlan,
  FollowUpSchedule,
  MedicalData,
  MedicalAPIError
};

// ============================================================================
// P3 预留标记（决策 20 + 决策 24）
// ============================================================================
//
// 心理健康数据源是 v3.7.0 决策 20 的 P3 预留场景：
//   - 接口规范：见 ./mental-health-adapter.ts 的 MentalHealthDataSource
//   - 预留位置：见 ./config.ts DEFAULT_CONFIG.mentalHealthReserved
//   - 启用条件：v3.8.0 评估 + 主人决策升级
//
// 任何 MentalHealth 适配器方法调用都会抛 P3NotImplementedError。
// ---------------------------------------------------------------------------
