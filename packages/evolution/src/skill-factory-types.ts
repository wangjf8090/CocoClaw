/**
 * Skill Factory Core - 类型定义
 * 
 * 为垂类识别引擎、模板匹配器、封装构建器提供共享类型定义。
 * 
 * 设计原则：
 * - 与 SelfClaw v3.5.0 现有类型保持一致
 * - 复用 skill-orchestrator.ts 的 GoalIntent 类型
 * - 复用 skill-compliance.ts 的 IndustryCategory 类型
 * - 复用 skill-template.ts 的 SKILLPatternFormat 类型
 */

import type { GoalIntent } from "./skill-orchestrator.js";
import type { SKILLPatternFormat } from "./skill-template.js";

// ============================================================================
// 垂类识别类型
// ============================================================================

/**
 * 垂直领域分类
 * 
 * 支持 4 大垂直领域：
 * - financial: 金融（股票、基金、财报等）
 * - medical: 医疗（药品、诊断、体检等）
 * - academic: 学术（论文、文献、研究等）
 * - legal: 法律（合同、合规、隐私政策等）
 */
export type FieldType = "financial" | "medical" | "academic" | "legal";

/**
 * 垂类识别结果
 */
export interface FieldClassification {
  /** 识别出的垂类 */
  field: FieldType;
  /** 置信度 0-1 */
  confidence: number;
  /** 子领域（如"股票分析"、"药品检索"） */
  subDomain?: string;
  /** 所需能力列表 */
  requiredCapabilities: string[];
  /** 识别依据 */
  evidence: string[];
  /** 多个候选结果（置信度低于阈值时） */
  candidates?: FieldCandidate[];
}

/**
 * 垂类候选结果
 */
export interface FieldCandidate {
  field: FieldType;
  confidence: number;
  reason: string;
}

// ============================================================================
// 意图识别类型
// ============================================================================

/**
 * 意图继承自 v3.2.0 Orchestrator
 * 8 类意图：audit/optimize/deploy/analyze/manage/create/monitor/mixed
 */
export type FieldIntent = GoalIntent;

/**
 * 意图识别结果
 */
export interface IntentRecognition {
  /** 识别出的意图 */
  intent: FieldIntent;
  /** 置信度 0-1 */
  confidence: number;
  /** 匹配的关键词 */
  matchedKeywords: string[];
  /** 多个意图（混合意图时） */
  intents?: Array<{ intent: FieldIntent; confidence: number }>;
}

// ============================================================================
// 模板匹配类型
// ============================================================================

/**
 * 垂类模板元数据
 */
export interface FieldTemplate {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 所属垂类 */
  field: FieldType;
  /** 模板描述 */
  description: string;
  /** 适用意图列表 */
  supportedIntents: FieldIntent[];
  /** 所需数据源 */
  requiredDataSources: DataSource[];
  /** 模板文件路径 */
  templatePath: string;
  /** 模板内容 */
  content: string;
  /** 版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 数据源类型
 */
export interface DataSource {
  /** 数据源 ID */
  id: string;
  /** 数据源名称 */
  name: string;
  /** 数据源类型 */
  type: "mcp" | "api" | "database" | "file";
  /** 连接器/接口 */
  connector?: string;
  /** 端点列表 */
  endpoints: string[];
  /** 认证方式 */
  authType: "api_key" | "oauth2" | "none";
  /** 认证环境变量名 */
  authEnvVar?: string;
  /** 是否必需 */
  required: boolean;
}

/**
 * 模板匹配结果
 */
export interface TemplateMatchResult {
  /** 匹配到的模板 */
  template: FieldTemplate;
  /** 匹配分数 0-1 */
  score: number;
  /** 匹配原因 */
  reason: string;
  /** 缺失的数据源 */
  missingDataSources: DataSource[];
  /** 建议的填充内容 */
  suggestedFillers: Record<string, string>;
}

// ============================================================================
// 封装构建类型
// ============================================================================

/**
 * 行业大模型配置
 */
export interface DomainModelConfig {
  /** 提供商 */
  provider: "openai" | "anthropic" | "azure" | "custom";
  /** 模型名称 */
  model: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** API 密钥环境变量名 */
  apiKeyEnvVar?: string;
  /** API Base URL（自定义 provider 时） */
  apiBaseUrl?: string;
  /** 最大 token 数 */
  maxTokens?: number;
  /** temperature */
  temperature?: number;
}

/**
 * 垂类 Skill 包装配置
 */
export interface SkillWrapperConfig {
  /** Skill 名称（kebab-case） */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 垂类模板 */
  template: FieldTemplate;
  /** 领域大模型配置 */
  domainModel: DomainModelConfig;
  /** 数据源列表 */
  dataSources: DataSource[];
  /** 合规要求列表 */
  complianceRequirements: string[];
  /** 定价配置 */
  pricing?: PricingConfig;
  /** 作者 */
  author?: string;
  /** 版本 */
  version?: string;
}

/**
 * 定价配置
 */
export interface PricingConfig {
  /** 定价类型 */
  type: "free" | "subscription" | "per_call";
  /** 价格 */
  price?: number;
  /** 货币 */
  currency?: string;
  /** 周期（subscription 时） */
  period?: "monthly" | "yearly";
  /** 每日调用限制 */
  callsPerDay?: number;
  /** 每分钟调用限制 */
  callsPerMinute?: number;
}

/**
 * 包装结果
 */
export interface WrapperResult {
  /** 生成的 Skill 目录路径 */
  skillDir: string;
  /** 生成的文件列表 */
  generatedFiles: GeneratedFile[];
  /** SKILL.md 内容 */
  skillMdContent: string;
  /** SKILL Pattern 内容（6 章节） */
  skillPatternContent?: string;
  /** 元数据 */
  metadata: SkillMetadata;
  /** 审计评分 */
  auditScores?: {
    fme: number;
    as: number;
    hrb: number;
  };
  /** 预估部署时间 */
  estimatedDeployTime: string;
}

/**
 * 生成的文件
 */
export interface GeneratedFile {
  /** 文件路径（相对于 Skill 目录） */
  path: string;
  /** 文件名 */
  name: string;
  /** 文件类型 */
  type: "skill_md" | "index_ts" | "references" | "scripts" | "tests" | "config";
  /** 文件大小（字节） */
  size: number;
  /** 是否覆盖了已有文件 */
  overwritten: boolean;
}

/**
 * Skill 元数据
 */
export interface SkillMetadata {
  /** Skill 名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author?: string;
  /** 创建时间 */
  createdAt: string;
  /** 垂类 */
  field: FieldType;
  /** 支持的意图 */
  supportedIntents: FieldIntent[];
  /** 必需的能力 */
  requires: string[];
  /** 提供的能力 */
  capabilities: string[];
  /** 风险等级 */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** 定价 */
  pricing?: PricingConfig;
  /** 数据源 */
  dataSources: string[];
  /** 标签 */
  tags: string[];
}

// ============================================================================
// 置信度配置
// ============================================================================

/**
 * 置信度阈值配置
 */
export interface ConfidenceThresholds {
  /** 高置信度阈值（> 0.8 直接返回） */
  high: number;
  /** 中置信度阈值（0.5-0.8 返回 + 提示） */
  medium: number;
  /** 低置信度阈值（< 0.5 返回多个候选） */
  low: number;
}

/**
 * 默认置信度阈值
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: 0.8,
  medium: 0.5,
  low: 0.5
};

// ============================================================================
// 匹配优先级配置
// ============================================================================

/**
 * 模板匹配优先级权重
 */
export interface MatchPriority {
  /** 垂类权重 */
  field: number;
  /** 意图权重 */
  intent: number;
  /** 数据源权重 */
  dataSource: number;
  /** 复杂度权重 */
  complexity: number;
}

/**
 * 默认匹配优先级
 */
export const DEFAULT_MATCH_PRIORITY: MatchPriority = {
  field: 0.4,
  intent: 0.3,
  dataSource: 0.2,
  complexity: 0.1
};

// ============================================================================
// 垂类审计规则
// ============================================================================

/**
 * 垂类审计规则
 */
export interface DomainAuditRules {
  /** 垂类 */
  field: FieldType;
  /** 必需检查清单 */
  requiredChecklist: string[];
  /** 风险等级阈值 */
  riskLevelThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  /** 强制免责声明 */
  mandatoryDisclaimers: string[];
  /** 法规映射 */
  regulationMapping: Record<string, string>;
}

/**
 * 垂类审计规则配置
 */
export const DOMAIN_AUDIT_RULES: Record<FieldType, DomainAuditRules> = {
  financial: {
    field: "financial",
    requiredChecklist: [
      "SEC合规声明",
      "投资风险提示",
      "数据来源标注",
      "免责声明：'不构成投资建议'"
    ],
    riskLevelThresholds: {
      critical: 90,
      high: 75,
      medium: 60
    },
    mandatoryDisclaimers: [
      "本内容仅供参考，不构成投资建议",
      "投资有风险，入市需谨慎",
      "数据来源：Wind金融终端"
    ],
    regulationMapping: {
      "SEC Filings": "美股年报季报",
      "Insider Trading": "内幕交易风险"
    }
  },
  medical: {
    field: "medical",
    requiredChecklist: [
      "HIPAA合规声明",
      "患者数据脱敏",
      "诊断边界声明",
      "紧急症状响应",
      "免责声明：'仅供辅助参考'"
    ],
    riskLevelThresholds: {
      critical: 90,
      high: 75,
      medium: 60
    },
    mandatoryDisclaimers: [
      "本内容仅供医疗专业人员参考",
      "不构成诊疗建议",
      "紧急情况请立即就医",
      "数据来源：中康科技医疗数据库"
    ],
    regulationMapping: {
      "HIPAA": "患者数据保护",
      "Diagnosis Boundary": "诊断辅助边界"
    }
  },
  academic: {
    field: "academic",
    requiredChecklist: [
      "引用完整性",
      "DOI/PMID标注",
      "参考文献格式",
      "原创性声明"
    ],
    riskLevelThresholds: {
      critical: 90,
      high: 75,
      medium: 60
    },
    mandatoryDisclaimers: [
      "本内容仅供学术研究参考",
      "引用请注明来源",
      "数据来源：PubMed生物医学数据库"
    ],
    regulationMapping: {
      "Citation Format": "引用格式规范",
      "Plagiarism Check": "抄袭检测"
    }
  },
  legal: {
    field: "legal",
    requiredChecklist: [
      "GDPR合规（Art. 13-22）",
      "法律免责声明",
      "多司法管辖区",
      "政策版本控制"
    ],
    riskLevelThresholds: {
      critical: 90,
      high: 75,
      medium: 60
    },
    mandatoryDisclaimers: [
      "本模板仅供参考，不构成法律意见",
      "使用前请咨询专业律师",
      "具体合规要求因业务类型和地区而异"
    ],
    regulationMapping: {
      "GDPR Art. 13": "数据控制者信息",
      "GDPR Art. 15": "数据主体权利",
      "GDPR Art. 17": "被遗忘权"
    }
  }
};

// ============================================================================
// 能力建议映射
// ============================================================================

/**
 * 垂类能力建议映射
 */
export const FIELD_CAPABILITY_SUGGESTIONS: Record<FieldType, string[]> = {
  financial: [
    "Wind金融终端API",
    "实时行情数据",
    "财务报表分析",
    "技术指标计算",
    "研报摘要生成"
  ],
  medical: [
    "中康科技医疗数据库",
    "药品说明书查询",
    "诊断参考",
    "体检报告解读",
    "医学文献检索"
  ],
  academic: [
    "PubMed E-utilities API",
    "文献检索",
    "影响因子查询",
    "引用分析",
    "BibTeX导出"
  ],
  legal: [
    "GDPR合规模板",
    "Cookie政策生成",
    "隐私政策审查",
    "数据处理协议",
    "服务条款起草"
  ]
};

// ============================================================================
// 复杂度评估
// ============================================================================

/**
 * 复杂度等级
 */
export type ComplexityLevel = "simple" | "moderate" | "complex";

/**
 * 复杂度评估结果
 */
export interface ComplexityEstimate {
  /** 复杂度等级 */
  level: ComplexityLevel;
  /** 复杂度分数 1-5 */
  score: number;
  /** 复杂度原因 */
  reasons: string[];
  /** 预估 token 消耗 */
  estimatedTokens: number;
}

/**
 * 默认复杂度映射
 */
export const DEFAULT_COMPLEXITY_MAP: Record<FieldType, ComplexityLevel> = {
  financial: "moderate",
  medical: "complex",
  academic: "moderate",
  legal: "complex"
};

// ============================================================================
// API 请求/响应类型
// ============================================================================

/**
 * 垂类 Skill 创建请求
 */
export interface CreateSkillRequest {
  /** 垂类 */
  field: FieldType;
  /** Skill 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 模板 ID（可选） */
  templateId?: string;
  /** 数据源 */
  dataSources?: DataSource[];
  /** 领域模型配置 */
  domainModel?: Partial<DomainModelConfig>;
  /** 合规要求 */
  compliance?: string[];
}

/**
 * 垂类 Skill 创建响应
 */
export interface CreateSkillResponse {
  /** Skill ID */
  skillId: string;
  /** 状态 */
  status: "created" | "pending_audit" | "failed";
  /** 模板 ID */
  template: string;
  /** 生成的文件列表 */
  files: string[];
  /** 审计评分 */
  auditScore?: {
    fme: number;
    as: number;
    hrb: number;
  };
  /** 预估部署时间 */
  estimatedDeployTime: string;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 垂类识别请求
 */
export interface ClassifyFieldRequest {
  /** 用户输入 */
  userInput: string;
  /** 可选元数据 */
  metadata?: {
    /** 用户 ID */
    userId?: string;
    /** 会话 ID */
    sessionId?: string;
    /** 附加上下文 */
    context?: string;
  };
}

/**
 * 垂类识别响应
 */
export interface ClassifyFieldResponse {
  /** 识别结果 */
  classification: FieldClassification;
  /** 意图识别结果 */
  intent: IntentRecognition;
  /** 置信度阈值配置 */
  thresholds: ConfidenceThresholds;
  /** 处理时间（毫秒） */
  processingTime: number;
}

/**
 * 模板匹配请求
 */
export interface MatchTemplateRequest {
  /** 垂类识别结果 */
  classification: FieldClassification;
  /** 意图识别结果 */
  intent: IntentRecognition;
  /** 用户指定偏好（可选） */
  preferences?: {
    /** 偏好的模板 ID */
    templateId?: string;
    /** 偏好的数据源 */
    preferredDataSources?: string[];
  };
}

/**
 * 模板匹配响应
 */
export interface MatchTemplateResponse {
  /** 匹配结果 */
  match: TemplateMatchResult;
  /** 备选匹配（如果有） */
  alternatives?: TemplateMatchResult[];
  /** 处理时间（毫秒） */
  processingTime: number;
}

/**
 * 封装 Skill 请求
 */
export interface WrapSkillRequest {
  /** 模板匹配结果 */
  match: TemplateMatchResult;
  /** Skill 配置 */
  config: SkillWrapperConfig;
  /** 是否生成 SKILL Pattern */
  generatePattern?: boolean;
}

/**
 * 封装 Skill 响应
 */
export interface WrapSkillResponse {
  /** 封装结果 */
  result: WrapperResult;
  /** API 端点 */
  apiEndpoint?: string;
  /** 处理时间（毫秒） */
  processingTime: number;
}
