/**
 * Skill Factory Core - 入口模块
 * 
 * 聚合垂类识别引擎、模板匹配器、封装构建器，
 * 提供一站式垂类 Skill 生成能力。
 * 
 * v3.6.0 新增模块
 */

export * from "./types.js";
export * from "./field-recognizer.js";
export * from "./template-matcher.js";
export * from "./wrapper-builder.js";

import type {
  FieldClassification,
  IntentRecognition,
  TemplateMatchResult,
  WrapperResult,
  CreateSkillRequest,
  CreateSkillResponse,
  ClassifyFieldRequest,
  ClassifyFieldResponse,
  MatchTemplateRequest,
  MatchTemplateResponse,
  WrapSkillRequest,
  WrapSkillResponse,
  SkillWrapperConfig,
} from "./types.js";
import {
  FieldRecognizer,
  classifyField,
  recognizeFieldIntent,
  estimateFieldComplexity,
} from "./field-recognizer.js";
import {
  TemplateMatcher,
  matchTemplate,
  matchAllTemplates,
  getDefaultPricing,
} from "./template-matcher.js";
import {
  WrapperBuilder,
  wrapSkill,
  generateSKILLPattern,
} from "./wrapper-builder.js";

// ============================================================================
// Skill Factory 主类
// ============================================================================

/**
 * Skill Factory
 * 
 * 聚合垂类识别、模板匹配、Skill 封装三大能力，
 * 提供端到端的垂类 Skill 生成服务。
 */
export class SkillFactory {
  private recognizer: FieldRecognizer;
  private matcher: TemplateMatcher;
  private builder: WrapperBuilder;

  /**
   * 创建 Skill Factory
   */
  constructor() {
    this.recognizer = new FieldRecognizer();
    this.matcher = new TemplateMatcher();
    this.builder = new WrapperBuilder();
  }

  /**
   * 创建垂类 Skill
   * 
   * 端到端流程：
   * 1. 垂类识别 → 2. 模板匹配 → 3. Skill 封装
   * 
   * @param request 创建请求
   * @returns 创建响应
   */
  async createSkill(request: CreateSkillRequest): Promise<CreateSkillResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 垂类识别
      const classification = this.recognizer.classify(request.description);
      
      // 2. 意图识别
      const intent = this.recognizer.recognizeIntent(request.description);
      
      // 3. 模板匹配
      const match = this.matcher.match(classification, intent, {
        templateId: request.templateId,
        preferredDataSources: request.dataSources?.map(ds => ds.id),
      });
      
      // 4. 构建 Skill 配置
      const config: SkillWrapperConfig = {
        name: request.name,
        description: request.description,
        template: match.template,
        domainModel: {
          provider: request.domainModel?.provider ?? "openai",
          model: request.domainModel?.model ?? "gpt-4o",
          systemPrompt: request.domainModel?.systemPrompt ?? this.generateSystemPrompt(match.template.field),
        },
        dataSources: request.dataSources ?? match.template.requiredDataSources,
        complianceRequirements: request.compliance ?? [],
        pricing: getDefaultPricing(match.template.field),
        version: "1.0.0",
      };
      
      // 5. 封装 Skill
      const result = await this.builder.build(config, {
        intent: intent.intent,
        subDomain: classification.subDomain,
        generatePattern: true,
      });
      
      return {
        skillId: `skill_${randomUUID().slice(0, 8)}`,
        status: "created",
        template: match.template.id,
        files: result.generatedFiles.map(f => f.path),
        auditScore: result.auditScores,
        estimatedDeployTime: result.estimatedDeployTime,
      };
    } catch (error) {
      return {
        skillId: "",
        status: "failed",
        template: request.templateId ?? "",
        files: [],
        estimatedDeployTime: "0",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 生成垂类系统提示词
   */
  private generateSystemPrompt(field: string): string {
    const prompts: Record<string, string> = {
      financial: "你是一位资深A股分析师，基于Wind金融终端数据提供专业的投资分析服务。注意：不提供投资建议，所有分析仅供参考。",
      medical: "你是一位专业医疗助手，基于中康科技医疗数据库提供医疗信息服务。注意：不提供最终诊断，所有建议仅供参考。",
      academic: "你是一位学术研究助手，基于PubMed生物医学数据库提供文献检索和分析服务。",
      legal: "你是一位法律合规顾问，基于GDPR等法规提供合规文书服务。注意：不提供法律意见，所有模板仅供参考。",
    };
    return prompts[field] ?? "你是一个专业的垂类助手。";
  }
}

// ============================================================================
// 快捷 API 函数
// ============================================================================

/**
 * 垂类识别 API
 */
export async function classifyFieldApi(
  request: ClassifyFieldRequest
): Promise<ClassifyFieldResponse> {
  const startTime = Date.now();
  
  const recognizer = new FieldRecognizer();
  const classification = recognizer.classify(request.userInput, request.metadata);
  const intent = recognizer.recognizeIntent(request.userInput);
  
  return {
    classification,
    intent,
    thresholds: {
      high: 0.8,
      medium: 0.5,
      low: 0.5,
    },
    processingTime: Date.now() - startTime,
  };
}

/**
 * 模板匹配 API
 */
export async function matchTemplateApi(
  request: MatchTemplateRequest
): Promise<MatchTemplateResponse> {
  const startTime = Date.now();
  
  const matcher = new TemplateMatcher();
  const match = matcher.match(request.classification, request.intent, request.preferences);
  
  // 获取备选
  const allMatches = matcher.matchAll(request.classification, request.intent);
  const alternatives = allMatches
    .filter(m => m.template.id !== match.template.id)
    .slice(0, 2);
  
  return {
    match,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    processingTime: Date.now() - startTime,
  };
}

/**
 * 封装 Skill API
 */
export async function wrapSkillApi(
  request: WrapSkillRequest
): Promise<WrapSkillResponse> {
  const startTime = Date.now();
  
  const builder = new WrapperBuilder();
  const result = await builder.build(request.config, {
    generatePattern: request.generatePattern,
  });
  
  return {
    result,
    apiEndpoint: `/api/skills/${request.config.name}`,
    processingTime: Date.now() - startTime,
  };
}

// ============================================================================
// 导出默认实例
// ============================================================================

/**
 * 创建默认 Skill Factory 实例
 */
export function createSkillFactory(): SkillFactory {
  return new SkillFactory();
}

/**
 * 默认 Skill Factory 实例
 */
export const defaultSkillFactory = new SkillFactory();
