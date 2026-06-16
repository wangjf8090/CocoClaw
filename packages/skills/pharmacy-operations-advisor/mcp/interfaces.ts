/**
 * Pharmacy DataSource 接口定义
 * 
 * v3.7.0 M1 药店经营辅助 Skill
 * 基于卫健委公开数据 + 临床指南 + PubMed
 * 
 * @version 1.0.0
 * @date 2026-06-15
 */

// ============================================================================
// 能力类型定义
// ============================================================================

/**
 * 数据源支持的能力类型
 */
export type PharmacyCapability =
  | 'drug-info'           // 药品信息查询
  | 'medication-guidance' // 用药指导
  | 'inventory-analysis'  // 库存分析
  | 'compliance-check'    // 合规检查
  | 'drug-interaction'     // 药物相互作用
  | 'substitute-recommend'; // 同品替换建议

// ============================================================================
// 核心接口定义
// ============================================================================

/**
 * 药店数据源接口
 * 所有数据源适配器必须实现此接口
 */
export interface PharmacyDataSource {
  /** 数据源唯一标识 */
  id: string;
  
  /** 数据源名称 */
  name: string;
  
  /** 优先级（数字越小优先级越高） */
  priority: number;
  
  /** 支持的能力列表 */
  capabilities: PharmacyCapability[];
  
  /**
   * 查询数据
   * @param capability 能力类型
   * @param params 查询参数
   * @returns 查询结果
   */
  query<T>(capability: PharmacyCapability, params: Record<string, unknown>): Promise<T>;
  
  /**
   * 健康检查
   * @returns 是否可用
   */
  healthCheck?(): Promise<boolean>;
}

// ============================================================================
// 药店相关类型定义
// ============================================================================

/**
 * 药品信息
 */
export interface DrugInfo {
  id: string;
  genericName: string;           // 通用名
  brandName?: string;           // 商品名
  aliases?: string[];           // 别名
  dosageForm: string;           // 剂型
  specifications: string;       // 规格
  manufacturer: string;         // 生产企业
  approvalNumber: string;        // 批准文号
  
  // 经营相关
  category: 'OTC-A' | 'OTC-B' | 'Rx' | 'Special' | 'Prohibited';  // 药品分类
  prescriptionRequired: boolean; // 是否需要处方
  medicalInsurance: boolean;     // 是否在医保目录
  essentialMedicine: boolean;    // 是否基药
  
  // 药学信息
  indications: string[];        // 适应症
  usage: string;               // 用法用量
  contraindications: string[];  // 禁忌症
  warnings: string[];           // 注意事项
  adverseReactions: string[];   // 不良反应
  storage: string;              // 贮藏条件
  
  // 价格信息（参考）
  priceRange?: string;          // 价格区间
  medicalInsurancePrice?: string;  // 医保支付价
  
  // 经营信息
  inventoryLevel?: 'normal' | 'low' | 'out-of-stock';
  expiryDate?: string;
}

/**
 * 用药指导
 */
export interface MedicationGuidance {
  drugName: string;
  usage: string;                 // 用法
  dosage: string;                 // 剂量
  frequency: string;             // 频次
  duration?: string;              // 疗程
  timing?: string;                // 服药时间（餐前/餐中/餐后）
  
  // 人群指导
  adultGuidance?: string;
  childGuidance?: string;
  elderlyGuidance?: string;
  pregnantGuidance?: string;
  
  // 注意事项
  precautions: string[];
  sideEffects: string[];
  interactionWarnings: string[];
  
  // 特殊指导
  missedDose?: string;           // 漏服处理
  stopCriteria?: string;         // 停药指征
}

/**
 * 药物相互作用
 */
export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
  mechanism?: string;
}

/**
 * 库存分析结果
 */
export interface InventoryAnalysis {
  alerts: InventoryAlert[];
  summary: {
    totalItems: number;
    normalItems: number;
    warningItems: number;
    urgentItems: number;
  };
}

export interface InventoryAlert {
  drugName: string;
  type: 'expiry' | 'low-stock' | 'overstock' | 'expired' | 'slow-moving';
  severity: 'info' | 'warning' | 'urgent';
  description: string;
  recommendation: string;
  currentQuantity?: number;
  expiryDate?: string;
  dailySales?: number;
}

/**
 * 合规检查结果
 */
export interface ComplianceCheckResult {
  drugName: string;
  status: 'compliant' | 'warning' | 'violation';
  category: string;
  requirements: ComplianceRequirement[];
  recommendations: string[];
}

export interface ComplianceRequirement {
  type: 'prescription' | 'registration' | 'age-limit' | 'qualification' | 'prohibited';
  required: boolean;
  description: string;
  action?: string;
}

/**
 * 同品替换建议
 */
export interface SubstituteRecommendation {
  originalDrug: string;
  substitutes: SubstituteDrug[];
}

export interface SubstituteDrug {
  drugName: string;
  category: 'originator' | 'generic' | '集采' | '基药' | 'OTC';
  priceRange: string;
  medicalInsurancePrice?: string;
  advantages: string[];
  disadvantages?: string[];
  recommendation: string;
}

/**
 * 库存项
 */
export interface InventoryItem {
  drugName: string;
  genericName?: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  purchasePrice?: number;
  retailPrice?: number;
  dailySales?: number;
  lastRestockDate?: string;
  supplier?: string;
}

/**
 * 药店上下文
 */
export interface PharmacyContext {
  pharmacyId?: string;
  pharmacyName?: string;
  hasPrescription?: boolean;
  userRole?: 'pharmacist' | 'clerk' | 'manager';
  region?: string;  // 地区（影响医保目录等）
}

// ============================================================================
// 数据源注册表
// ============================================================================

/**
 * 药店数据源注册表接口
 */
export interface PharmacyDataSourceRegistry {
  /**
   * 注册数据源
   */
  register(source: PharmacyDataSource): void;
  
  /**
   * 解析最适合的数据源
   */
  resolve(capability: PharmacyCapability, context?: Record<string, unknown>): Promise<PharmacyDataSource>;
  
  /**
   * 列出所有已注册的数据源
   */
  list(): PharmacyDataSource[];
  
  /**
   * 移除数据源
   */
  unregister(id: string): void;
  
  /**
   * 获取数据源
   */
  get(id: string): PharmacyDataSource | undefined;
}

/**
 * 默认注册表实现
 */
export class DefaultPharmacyDataSourceRegistry implements PharmacyDataSourceRegistry {
  private sources: Map<string, PharmacyDataSource> = new Map();
  
  register(source: PharmacyDataSource): void {
    this.sources.set(source.id, source);
  }
  
  resolve(capability: PharmacyCapability, context?: Record<string, unknown>): Promise<PharmacyDataSource> {
    const candidates = Array.from(this.sources.values())
      .filter(s => s.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority);
    
    if (candidates.length === 0) {
      return Promise.reject(new Error(`No data source found for capability: ${capability}`));
    }
    
    return Promise.resolve(candidates[0]);
  }
  
  list(): PharmacyDataSource[] {
    return Array.from(this.sources.values())
      .sort((a, b) => a.priority - b.priority);
  }
  
  unregister(id: string): void {
    this.sources.delete(id);
  }
  
  get(id: string): PharmacyDataSource | undefined {
    return this.sources.get(id);
  }
}

// ============================================================================
// 导出
// ============================================================================

export default PharmacyDataSource;

export {
  PharmacyDataSource,
  PharmacyDataSourceRegistry,
  DefaultPharmacyDataSourceRegistry,
  DrugInfo,
  MedicationGuidance,
  DrugInteraction,
  InventoryAnalysis,
  InventoryAlert,
  InventoryItem,
  ComplianceCheckResult,
  ComplianceRequirement,
  SubstituteRecommendation,
  SubstituteDrug,
  PharmacyContext
};

// ============================================================================
// P3 预留标记（决策 20）
// ============================================================================
//
// 中医体质辨识是 v3.7.0 决策 20 的 P1 场景，心理健康是 P3 预留。
// 本 Skill（药店经营辅助）是 P0 核心场景。
// ---------------------------------------------------------------------------
