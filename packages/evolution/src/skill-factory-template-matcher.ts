/**
 * 模板匹配器 (Template Matcher)
 * 
 * 基于垂类识别结果和意图，为用户匹配最佳的行业 Skill 模板。
 * 
 * 核心能力：
 * 1. 模板注册表管理 - 支持 4 个垂类模板的注册和查询
 * 2. 智能匹配算法 - 基于垂类 + 意图 + 数据源的多维度匹配
 * 3. 备选模板推荐 - 当最佳模板不完全匹配时提供备选
 * 4. 缺失数据源提示 - 指出模板所需的额外数据源
 * 
 * 设计原则：
 * - 模板优先级可配置
 * - 支持多候选结果
 * - 与垂类识别引擎无缝集成
 * 
 * v3.6.0 新增模块
 */

import type {
  FieldType,
  FieldClassification,
  FieldIntent,
  IntentRecognition,
  FieldTemplate,
  DataSource,
  TemplateMatchResult,
  MatchPriority,
  SkillWrapperConfig,
  PricingConfig,
} from "./types.js";
import { DEFAULT_MATCH_PRIORITY } from "./types.js";

// ============================================================================
// 垂类模板内容（内联示例模板）
// ============================================================================

/**
 * 金融垂类模板：Wind 股票分析
 */
const FINANCIAL_TEMPLATE_CONTENT = `# SKILL: Wind Stock Analyzer（万得股票分析）

## 1. Scope（范围）

### 技能定义
基于万得（Wind）金融终端 API 的 A 股/港股/美股全品类数据分析 Skill，提供实时行情、财务数据、技术指标、研报摘要等能力。

### 核心能力
- **行情查询**：实时价格、涨跌幅、成交量、五档买卖盘
- **历史数据**：K线图（1分钟至月线）、复权处理、板块对比
- **财务分析**：资产负债表、利润表、现金流量表关键指标
- **估值分析**：PE/PB/PS、ROE、股息率、同行对比
- **公告速读**：年报/季报摘要、重大事项、分红配股

### 使用边界（不做什么）
- ❌ 不提供投资建议或买卖推荐
- ❌ 不预测股价走势或市场方向
- ❌ 不接入非 Wind 授权的数据源
- ❌ 不处理未上市公司或私募数据

### 触发短语
- "帮我查一下贵州茅台的实时行情"
- "分析一下宁德时代的财务数据"
- "对比苹果和微软的估值水平"
`;

/**
 * 医疗垂类模板：中康医疗助手
 */
const MEDICAL_TEMPLATE_CONTENT = `# SKILL: Zhongkang Medical Assistant（中康医疗助手）

## 1. Scope（范围）

### 技能定义
基于中康科技医疗数据库的智能医疗助手，整合 30万+ 药品说明书、19年医药产业数据、卓睦鸟医疗大模型，提供药品查询、疾病诊断参考、体检报告解读、科研文献检索等能力。

### 核心能力
- **药品服务**：适应症查询、用法用量、不良反应、药物相互作用
- **疾病辅助**：症状分析、鉴别诊断参考、诊疗指南摘要
- **体检解读**：指标异常分析、健康建议、分级评估
- **慢病管理**：糖尿病/高血压/高血脂跟踪管理
- **科研辅助**：医学文献检索、临床试验查询

### 使用边界（不做什么）
- ❌ 不提供最终诊断（仅作为辅助参考）
- ❌ 不开具处方
- ❌ 不替代专业医疗（紧急情况必须建议就医）

### 触发短语
- "查询阿司匹林的用法用量"
- "帮我解读一下这份体检报告"
- "二型糖尿病的诊疗指南是什么"
`;

/**
 * 学术垂类模板：PubMed 研究助手
 */
const ACADEMIC_TEMPLATE_CONTENT = `# SKILL: PubMed Research Assistant（PubMed 研究助手）

## 1. Scope（范围）

### 技能定义
基于 PubMed 生物医学文献数据库的智能学术助手，提供高级搜索、元数据提取、论文摘要、引用分析、研究趋势追踪等能力。

### 核心能力
- **智能搜索**：自然语言查询、自动扩展 MeSH 词、布尔逻辑支持
- **文献筛选**：影响因子加权、条件组合过滤（年份/期刊/语言）
- **摘要生成**：TLDR 摘要、结构化要点、关键发现提炼
- **元数据导出**：JSON/CSV/BibTeX 格式，支持 DOI/PMID/PMCID
- **引用分析**：被引次数追踪、高引文献识别

### 使用边界（不做什么）
- ❌ 不提供完整论文下载（仅提供摘要和元数据）
- ❌ 不替代学术评审（仅提供检索辅助）

### 触发短语
- "帮我搜索CAR-T细胞治疗的最新文献"
- "查找2024年发表在Nature Medicine上的文章"
- "导出近五年深度学习在医学影像应用的文献列表"
`;

/**
 * 法律垂类模板：法律合规文书助手
 */
const LEGAL_TEMPLATE_CONTENT = `# SKILL: Legal Compliance Documentor（法律合规文书助手）

## 1. Scope（范围）

### 技能定义
基于国际数据保护法规和企业合规最佳实践的智能法律文书助手，帮助企业生成 GDPR 合规文档、Cookie 政策、隐私政策、数据处理协议、免责声明等法律文件。

### 核心能力
- **隐私政策生成**：符合 GDPR/CCPA/COPPA 等多法规
- **Cookie 政策撰写**：分类说明、同意机制、拒绝选项
- **数据处理协议（DPA）**：数据控制者与处理者协议模板
- **服务条款起草**：用户协议、免责条款、知识产权声明
- **合规检查清单**：GDPR 7项原则、6项权利核查

### 使用边界（不做什么）
- ❌ 不提供法律咨询（仅提供文书模板）
- ❌ 不保证法律效力（模板需法务审核）

### 触发短语
- "帮我生成一个GDPR隐私政策"
- "我们的App需要什么Cookie政策"
- "起草一份数据处理协议"
`;

// ============================================================================
// 数据源定义
// ============================================================================

/**
 * 金融垂类数据源
 */
const FINANCIAL_DATA_SOURCES: DataSource[] = [
  {
    id: "wind-mcp",
    name: "Wind MCP Server",
    type: "mcp",
    connector: "wind-mcp",
    endpoints: ["stock.quote", "stock.history", "stock.financial", "market.index"],
    authType: "api_key",
    authEnvVar: "WIND_API_KEY",
    required: true,
  },
  {
    id: "eastmoney-api",
    name: "东方财富 API",
    type: "api",
    endpoints: ["finance.eastmoney.com"],
    authType: "api_key",
    authEnvVar: "EASTMONEY_API_KEY",
    required: false,
  },
];

/**
 * 医疗垂类数据源
 */
const MEDICAL_DATA_SOURCES: DataSource[] = [
  {
    id: "zhongkang-mcp",
    name: "中康科技 MCP Server",
    type: "mcp",
    connector: "zhongkang-mcp",
    endpoints: ["drug.search", "diagnosis.reference", "health.report"],
    authType: "oauth2",
    authEnvVar: "ZHONGKANG_CLIENT_ID",
    required: true,
  },
  {
    id: "pubmed-api",
    name: "PubMed E-utilities",
    type: "api",
    endpoints: ["eutils.ncbi.nlm.nih.gov"],
    authType: "api_key",
    authEnvVar: "PUBMED_API_KEY",
    required: false,
  },
];

/**
 * 学术垂类数据源
 */
const ACADEMIC_DATA_SOURCES: DataSource[] = [
  {
    id: "pubmed-mcp",
    name: "PubMed MCP Server",
    type: "mcp",
    connector: "pubmed-mcp",
    endpoints: ["search", "fetch_abstract", "citation_lookup"],
    authType: "api_key",
    authEnvVar: "PUBMED_API_KEY",
    required: true,
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar API",
    type: "api",
    endpoints: ["api.semanticscholar.org"],
    authType: "api_key",
    authEnvVar: "SEMANTIC_SCHOLAR_API_KEY",
    required: false,
  },
];

/**
 * 法律垂类数据源
 */
const LEGAL_DATA_SOURCES: DataSource[] = [
  {
    id: "gdpr-template",
    name: "GDPR 合规模板库",
    type: "file",
    endpoints: ["templates/gdpr/", "templates/ccpa/"],
    authType: "none",
    required: true,
  },
  {
    id: "legal-ref",
    name: "法律参考数据库",
    type: "database",
    endpoints: ["legal.reference.db"],
    authType: "api_key",
    authEnvVar: "LEGAL_REF_API_KEY",
    required: false,
  },
];

// ============================================================================
// 模板注册表
// ============================================================================

/**
 * 垂类模板注册表
 */
const TEMPLATE_REGISTRY: FieldTemplate[] = [
  {
    id: "financial-stock-analysis",
    name: "Wind Stock Analyzer",
    field: "financial",
    description: "基于万得API的A股/港股/美股全品类数据分析",
    supportedIntents: ["analyze", "monitor", "audit", "create"],
    requiredDataSources: FINANCIAL_DATA_SOURCES,
    templatePath: "./templates/financial-stock-analysis.md",
    content: FINANCIAL_TEMPLATE_CONTENT,
    version: "1.0.0",
    createdAt: "2026-06-12T00:00:00Z",
    updatedAt: "2026-06-12T00:00:00Z",
  },
  {
    id: "medical-assistant",
    name: "Zhongkang Medical Assistant",
    field: "medical",
    description: "基于中康科技医疗数据库的智能医疗助手",
    supportedIntents: ["analyze", "create", "manage", "audit"],
    requiredDataSources: MEDICAL_DATA_SOURCES,
    templatePath: "./templates/medical-assistant.md",
    content: MEDICAL_TEMPLATE_CONTENT,
    version: "1.0.0",
    createdAt: "2026-06-12T00:00:00Z",
    updatedAt: "2026-06-12T00:00:00Z",
  },
  {
    id: "academic-research",
    name: "PubMed Research Assistant",
    field: "academic",
    description: "基于PubMed的生物医学文献检索和分析",
    supportedIntents: ["analyze", "create", "monitor", "audit"],
    requiredDataSources: ACADEMIC_DATA_SOURCES,
    templatePath: "./templates/academic-research.md",
    content: ACADEMIC_TEMPLATE_CONTENT,
    version: "1.0.0",
    createdAt: "2026-06-12T00:00:00Z",
    updatedAt: "2026-06-12T00:00:00Z",
  },
  {
    id: "legal-compliance",
    name: "Legal Compliance Documentor",
    field: "legal",
    description: "基于GDPR等法规的法律合规文书助手",
    supportedIntents: ["create", "audit", "manage", "analyze"],
    requiredDataSources: LEGAL_DATA_SOURCES,
    templatePath: "./templates/legal-compliance.md",
    content: LEGAL_TEMPLATE_CONTENT,
    version: "1.0.0",
    createdAt: "2026-06-12T00:00:00Z",
    updatedAt: "2026-06-12T00:00:00Z",
  },
];

// ============================================================================
// 模板匹配器类
// ============================================================================

/**
 * 模板匹配器
 * 
 * 根据垂类识别结果和意图，匹配最佳模板。
 */
export class TemplateMatcher {
  private templates: Map<FieldType, FieldTemplate[]>;
  private priority: MatchPriority;
  private enableAlternatives: boolean;

  /**
   * 创建模板匹配器
   * 
   * @param config 配置
   * @param config.priority 匹配优先级配置
   * @param config.enableAlternatives 是否启用备选模板
   */
  constructor(config?: {
    priority?: MatchPriority;
    enableAlternatives?: boolean;
  }) {
    this.priority = config?.priority ?? DEFAULT_MATCH_PRIORITY;
    this.enableAlternatives = config?.enableAlternatives ?? true;
    this.templates = this.buildTemplateIndex();
  }

  /**
   * 构建模板索引
   */
  private buildTemplateIndex(): Map<FieldType, FieldTemplate[]> {
    const index = new Map<FieldType, FieldTemplate[]>();
    
    for (const template of TEMPLATE_REGISTRY) {
      const existing = index.get(template.field) ?? [];
      existing.push(template);
      index.set(template.field, existing);
    }
    
    return index;
  }

  /**
   * 匹配模板
   * 
   * @param classification 垂类识别结果
   * @param intent 意图识别结果
   * @param preferences 用户偏好
   * @returns 匹配结果
   */
  match(
    classification: FieldClassification,
    intent: IntentRecognition,
    preferences?: {
      templateId?: string;
      preferredDataSources?: string[];
    }
  ): TemplateMatchResult {
    // 1. 如果用户指定了模板 ID，直接返回该模板
    if (preferences?.templateId) {
      const specifiedTemplate = TEMPLATE_REGISTRY.find(t => t.id === preferences.templateId);
      if (specifiedTemplate) {
        return {
          template: specifiedTemplate,
          score: 1.0,
          reason: "用户指定模板",
          missingDataSources: [],
          suggestedFillers: {},
        };
      }
    }

    // 2. 获取垂类模板列表
    const fieldTemplates = this.templates.get(classification.field) ?? [];
    
    if (fieldTemplates.length === 0) {
      throw new Error(`未找到垂类 ${classification.field} 的模板`);
    }

    // 3. 计算每个模板的匹配分数
    const scoredTemplates = fieldTemplates.map(template => {
      const score = this.calculateMatchScore(template, classification, intent);
      const missingDataSources = this.findMissingDataSources(
        template,
        preferences?.preferredDataSources
      );
      const suggestedFillers = this.generateSuggestedFillers(
        template,
        classification,
        intent
      );
      
      return {
        template,
        score,
        missingDataSources,
        suggestedFillers,
      };
    });

    // 4. 按分数排序
    scoredTemplates.sort((a, b) => b.score - a.score);

    // 5. 返回最佳匹配
    const bestMatch = scoredTemplates[0];
    
    const result: TemplateMatchResult = {
      template: bestMatch.template,
      score: bestMatch.score,
      reason: this.generateMatchReason(bestMatch.template, classification, intent, bestMatch.score),
      missingDataSources: bestMatch.missingDataSources,
      suggestedFillers: bestMatch.suggestedFillers,
    };

    // 6. 如果启用备选，添加备选列表
    if (this.enableAlternatives && scoredTemplates.length > 1) {
      // 备选已在 scoredTemplates 中，按分数排序
      return result; // 主结果不包含备选，调用者需要用 matchAll 获取备选
    }

    return result;
  }

  /**
   * 匹配所有模板（返回排序后的列表）
   * 
   * @param classification 垂类识别结果
   * @param intent 意图识别结果
   * @returns 所有模板匹配结果（按分数排序）
   */
  matchAll(
    classification: FieldClassification,
    intent: IntentRecognition
  ): TemplateMatchResult[] {
    const fieldTemplates = this.templates.get(classification.field) ?? [];
    
    const scoredTemplates = fieldTemplates.map(template => {
      const score = this.calculateMatchScore(template, classification, intent);
      const missingDataSources = this.findMissingDataSources(template);
      const suggestedFillers = this.generateSuggestedFillers(template, classification, intent);
      
      return {
        template,
        score,
        missingDataSources,
        suggestedFillers,
      };
    });

    return scoredTemplates
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        template: item.template,
        score: item.score,
        reason: this.generateMatchReason(item.template, classification, intent, item.score),
        missingDataSources: item.missingDataSources,
        suggestedFillers: item.suggestedFillers,
      }));
  }

  /**
   * 获取指定垂类的所有模板
   * 
   * @param field 垂类
   * @returns 模板列表
   */
  getTemplates(field: FieldType): FieldTemplate[] {
    return this.templates.get(field) ?? [];
  }

  /**
   * 获取所有模板
   * 
   * @returns 所有模板
   */
  getAllTemplates(): FieldTemplate[] {
    return [...TEMPLATE_REGISTRY];
  }

  /**
   * 注册新模板
   * 
   * @param template 模板
   */
  registerTemplate(template: FieldTemplate): void {
    TEMPLATE_REGISTRY.push(template);
    this.templates = this.buildTemplateIndex();
  }

  /**
   * 计算匹配分数
   * 
   * @param template 模板
   * @param classification 垂类识别结果
   * @param intent 意图识别结果
   * @returns 匹配分数 0-1
   */
  private calculateMatchScore(
    template: FieldTemplate,
    classification: FieldClassification,
    intent: IntentRecognition
  ): number {
    // 1. 垂类匹配分数（精确匹配为 1）
    const fieldScore = template.field === classification.field ? 1 : 0;

    // 2. 意图匹配分数
    const intentScore = template.supportedIntents.includes(intent.intent) ? 1 : 
      (intent.intents?.some(i => template.supportedIntents.includes(i.intent)) ? 0.7 : 0.3);

    // 3. 子领域匹配分数
    const subDomainScore = this.calculateSubDomainScore(template, classification.subDomain);

    // 4. 综合分数
    const totalScore = 
      fieldScore * this.priority.field +
      intentScore * this.priority.intent +
      subDomainScore * this.priority.complexity;

    return Math.min(totalScore, 1);
  }

  /**
   * 计算子领域匹配分数
   * 
   * @param template 模板
   * @param subDomain 子领域
   * @returns 匹配分数
   */
  private calculateSubDomainScore(template: FieldTemplate, subDomain?: string): number {
    if (!subDomain) return 0.5; // 无子领域信息时给中等分数

    // 检查模板描述是否包含子领域关键词
    const description = template.description.toLowerCase();
    const subdomainKeywords: Record<string, string[]> = {
      financial: ["stock", "股票", "fund", "基金", "financial", "财务"],
      medical: ["drug", "药品", "diagnosis", "诊断", "medical", "医疗"],
      academic: ["research", "研究", "literature", "文献", "academic", "学术"],
      legal: ["legal", "法律", "compliance", "合规", "contract", "合同"],
    };

    const keywords = subdomainKeywords[template.field] ?? [];
    const matchCount = keywords.filter(kw => description.includes(kw)).length;
    
    return Math.min(matchCount / keywords.length + 0.3, 1);
  }

  /**
   * 查找缺失的数据源
   * 
   * @param template 模板
   * @param preferredDataSources 偏好数据源
   * @returns 缺失的数据源列表
   */
  private findMissingDataSources(
    template: FieldTemplate,
    preferredDataSources?: string[]
  ): DataSource[] {
    if (!preferredDataSources) {
      // 返回必需的数据源
      return template.requiredDataSources.filter(ds => ds.required);
    }

    return template.requiredDataSources.filter(ds => 
      ds.required && !preferredDataSources.includes(ds.id)
    );
  }

  /**
   * 生成建议填充内容
   * 
   * @param template 模板
   * @param classification 垂类识别结果
   * @param intent 意图识别结果
   * @returns 建议填充内容
   */
  private generateSuggestedFillers(
    template: FieldTemplate,
    classification: FieldClassification,
    intent: IntentRecognition
  ): Record<string, string> {
    const fillers: Record<string, string> = {};

    // 根据意图建议触发短语
    const triggerSuggestions: Record<FieldIntent, string[]> = {
      analyze: ["分析一下", "帮我查一下", "对比一下"],
      monitor: ["监控", "追踪", "实时更新"],
      audit: ["检查", "审计", "合规性验证"],
      create: ["生成", "创建", "起草"],
      optimize: ["优化", "改进", "精简"],
      deploy: ["部署", "发布", "上线"],
      manage: ["管理", "配置", "设置"],
      mixed: ["帮我处理"],
    };

    fillers.triggerPhrases = triggerSuggestions[intent.intent]?.join(" | ") ?? "";
    fillers.subDomain = classification.subDomain ?? "通用";
    fillers.requiredCapabilities = classification.requiredCapabilities.join(", ");

    return fillers;
  }

  /**
   * 生成匹配原因
   * 
   * @param template 模板
   * @param classification 垂类识别结果
   * @param intent 意图识别结果
   * @param score 分数
   * @returns 匹配原因
   */
  private generateMatchReason(
    template: FieldTemplate,
    classification: FieldClassification,
    intent: IntentRecognition,
    score: number
  ): string {
    const parts: string[] = [];

    parts.push(`垂类匹配: ${template.field}（${classification.confidence.toFixed(2)}）`);
    parts.push(`意图匹配: ${intent.intent}（${intent.confidence.toFixed(2)}）`);

    if (classification.subDomain) {
      parts.push(`子领域: ${classification.subDomain}`);
    }

    if (score >= 0.8) {
      parts.push("高度匹配");
    } else if (score >= 0.6) {
      parts.push("良好匹配");
    } else {
      parts.push("部分匹配，建议人工确认");
    }

    return parts.join(" | ");
  }
}

// ============================================================================
// 默认定价配置
// ============================================================================

/**
 * 各垂类默认定价
 */
export const DEFAULT_PRICING: Record<FieldType, PricingConfig> = {
  financial: {
    type: "subscription",
    price: 49.99,
    currency: "USD",
    period: "monthly",
    callsPerDay: 5000,
    callsPerMinute: 50,
  },
  medical: {
    type: "subscription",
    price: 39.99,
    currency: "USD",
    period: "monthly",
    callsPerDay: 2000,
    callsPerMinute: 20,
  },
  academic: {
    type: "free",
    callsPerDay: 100,
  },
  legal: {
    type: "subscription",
    price: 99.99,
    currency: "USD",
    period: "monthly",
    callsPerDay: 1000,
    callsPerMinute: 10,
  },
};

// ============================================================================
// 导出
// ============================================================================

/**
 * 创建默认模板匹配器实例
 */
export function createTemplateMatcher(config?: {
  priority?: MatchPriority;
  enableAlternatives?: boolean;
}): TemplateMatcher {
  return new TemplateMatcher(config);
}

/**
 * 快捷函数：匹配模板
 * 
 * @param classification 垂类识别结果
 * @param intent 意图识别结果
 * @returns 匹配结果
 */
export function matchTemplate(
  classification: FieldClassification,
  intent: IntentRecognition
): TemplateMatchResult {
  const matcher = createTemplateMatcher();
  return matcher.match(classification, intent);
}

/**
 * 快捷函数：匹配所有模板
 * 
 * @param classification 垂类识别结果
 * @param intent 意图识别结果
 * @returns 所有匹配结果
 */
export function matchAllTemplates(
  classification: FieldClassification,
  intent: IntentRecognition
): TemplateMatchResult[] {
  const matcher = createTemplateMatcher();
  return matcher.matchAll(classification, intent);
}

/**
 * 获取垂类默认定价
 * 
 * @param field 垂类
 * @returns 定价配置
 */
export function getDefaultPricing(field: FieldType): PricingConfig {
  return DEFAULT_PRICING[field] ?? { type: "free", callsPerDay: 50 };
}
