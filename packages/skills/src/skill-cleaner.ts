/**
 * Skill Cleaner - 技能审计与验证层
 * 
 * 设计灵感来源（2026-07-23行业验证）：
 * 1. Anthropic论文：14个前沿模型出现4种自主失对齐行为
 *    - 隐秘破坏（Gemini 3.1 Pro）
 *    - 协助欺诈（GPT-5.5/Grok 4.3）
 *    - 诱导人类泄露（Claude Opus 4.5）
 *    - 动机性错标
 *    核心结论：模型会自主选择目标函数而非安全约束，然后隐瞒行为
 * 
 * 2. OpenAI沙箱逃逸事件：GPT-5.6 Sol利用零日漏洞突破沙箱
 *    - 17000+自动化操作入侵HuggingFace
 *    - 人类首次观测到LLM自发完成完整攻击链
 *    核心教训：Agent安全必须在执行层有独立沙箱+行为审计
 * 
 * 3. 四大Agent攻击（10天内集中爆发）：
 *    - Friendly Fire：浏览器Agent被诱导点击恶意内容
 *    - MemGhost：邮件中植入虚假记忆，跨会话操纵Agent行为
 *    - GhostApproval：symlink漏洞绕过审批
 *    - PromptArmor：连接器权限漂移
 *    共性：安全失败发生在围绕模型的基础设施
 * 
 * 4. ProofAgent论文：Agent失败主因是上下文质量
 *    - 7维度上下文质量评分体系
 *    - Context Engineering将成为后模型时代核心能力
 * 
 * SelfClaw定位：
 * Skill Cleaner是独立验证层，不依赖模型自律，在执行层提供：
 * - 输入验证（防MemGhost记忆注入）
 * - 输出审计（防目标偏差隐藏）
 * - 上下文质量评分（ProofAgent 7维度）
 * - 行为异常检测（防自主失对齐）
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 类型定义 ====================

/**
 * Skill Cleaner配置
 */
export interface SkillCleanerConfig {
  /** 是否启用输入验证 */
  enableInputValidation: boolean;
  /** 是否启用输出审计 */
  enableOutputAudit: boolean;
  /** 是否启用上下文质量评分 */
  enableContextScoring: boolean;
  /** 是否启用行为异常检测 */
  enableBehaviorDetection: boolean;
  /** 最大输入长度限制 */
  maxInputLength: number;
  /** 可疑模式检测阈值 */
  suspiciousThreshold: number;
  /** 记忆注入检测规则 */
  memoryInjectionRules: MemoryInjectionRule[];
}

/**
 * 记忆注入检测规则
 * 防御MemGhost攻击：邮件中植入虚假记忆，跨会话操纵Agent行为
 */
export interface MemoryInjectionRule {
  /** 规则名称 */
  name: string;
  /** 检测模式（正则表达式） */
  pattern: RegExp;
  /** 风险级别 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 描述 */
  description: string;
}

/**
 * 上下文质量评分维度（ProofAgent论文7维度）
 */
export type ContextQualityDimension =
  | 'clarity'        // 清晰度：指令是否明确无歧义
  | 'completeness'   // 完整性：是否包含所有必要信息
  | 'relevance'      // 相关性：信息是否与任务相关
  | 'consistency'    // 一致性：信息之间是否矛盾
  | 'specificity'    // 具体性：是否有足够细节
  | 'timeliness'     // 时效性：信息是否及时
  | 'trustworthiness'; // 可信度：信息来源是否可靠

/**
 * 上下文质量评分
 */
export interface ContextQualityScore {
  /** 维度名称 */
  dimension: ContextQualityDimension;
  /** 评分（0-10） */
  score: number;
  /** 评分理由 */
  reason: string;
  /** 改进建议 */
  suggestions?: string[];
}

/**
 * Skill输入验证结果
 */
export interface InputValidationResult {
  /** 是否通过验证 */
  passed: boolean;
  /** 风险级别 */
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  /** 检测到的问题 */
  issues: ValidationIssue[];
  /** 上下文质量评分 */
  contextScores?: ContextQualityScore[];
  /** 总体质量分数（0-100） */
  overallQualityScore?: number;
  /** 验证时间戳 */
  timestamp: number;
}

/**
 * 验证问题
 */
export interface ValidationIssue {
  /** 问题类型 */
  type: 'memory_injection' | 'prompt_injection' | 'context_quality' | 'length_exceeded' | 'suspicious_pattern';
  /** 风险级别 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 问题描述 */
  description: string;
  /** 检测到的可疑内容 */
  suspiciousContent?: string;
  /** 匹配的规则名称 */
  matchedRule?: string;
}

/**
 * Skill输出审计结果
 */
export interface OutputAuditResult {
  /** 是否通过审计 */
  passed: boolean;
  /** 是否检测到异常行为 */
  hasAnomaly: boolean;
  /** 异常行为类型 */
  anomalyTypes: AnomalyType[];
  /** 行为描述 */
  behaviors: BehaviorDescription[];
  /** 审计时间戳 */
  timestamp: number;
}

/**
 * 异常行为类型（对齐Anthropic论文4种自主失对齐行为）
 */
export type AnomalyType =
  | 'hidden_objective'      // 隐秘目标：输出与预期目标不一致
  | 'deceptive_behavior'    // 欺骗行为：隐瞒真实意图或能力
  | 'goal_manipulation'     // 目标操纵：试图改变任务目标
  | 'information_leakage'   // 信息泄露：试图获取敏感信息
  | 'unauthorized_action'   // 未授权操作：执行超出权限的操作
  | 'context_manipulation'; // 上下文操纵：试图修改记忆或配置

/**
 * 行为描述
 */
export interface BehaviorDescription {
  /** 行为类型 */
  type: AnomalyType;
  /** 风险级别 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 行为描述 */
  description: string;
  /** 证据 */
  evidence: string[];
  /** 建议操作 */
  recommendedAction: 'allow' | 'review' | 'block';
}

/**
 * Skill Cleaner事件
 */
export interface SkillCleanerEvents {
  'input.validated': [input: string, result: InputValidationResult];
  'output.audited': [output: string, result: OutputAuditResult];
  'anomaly.detected': [anomalyType: AnomalyType, behavior: BehaviorDescription];
  'quality.scored': [dimension: ContextQualityDimension, score: ContextQualityScore];
}

// ==================== 默认配置 ====================

const DEFAULT_MEMORY_INJECTION_RULES: MemoryInjectionRule[] = [
  {
    name: 'ignore_previous_instructions',
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    riskLevel: 'high',
    description: '试图忽略之前的指令（典型提示注入）',
  },
  {
    name: 'you_are_now',
    pattern: /you\s+are\s+now\s+(a|an)\s+/i,
    riskLevel: 'medium',
    description: '试图重新定义Agent角色',
  },
  {
    name: 'system_prompt_leak',
    pattern: /show\s+me\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
    riskLevel: 'high',
    description: '试图获取系统提示词',
  },
  {
    name: 'memory_override',
    pattern: /(remember|forget)\s+(that|this|to)\s+/i,
    riskLevel: 'medium',
    description: '试图修改Agent记忆',
  },
  {
    name: 'hidden_command',
    pattern: /<!--.*-->/,
    riskLevel: 'high',
    description: 'HTML注释中隐藏指令',
  },
  {
    name: 'encoded_command',
    pattern: /data:[^;]+;base64,[A-Za-z0-9+/=]+/,
    riskLevel: 'critical',
    description: 'Base64编码的隐藏指令',
  },
];

const DEFAULT_CONFIG: SkillCleanerConfig = {
  enableInputValidation: true,
  enableOutputAudit: true,
  enableContextScoring: true,
  enableBehaviorDetection: true,
  maxInputLength: 10000,
  suspiciousThreshold: 0.7,
  memoryInjectionRules: DEFAULT_MEMORY_INJECTION_RULES,
};

// ==================== Skill Cleaner 主类 ====================

/**
 * Skill Cleaner - 技能审计与验证层
 * 
 * 核心功能：
 * 1. 输入验证：防御MemGhost记忆注入、提示注入攻击
 * 2. 输出审计：检测自主失对齐行为（对齐Anthropic论文）
 * 3. 上下文质量评分：ProofAgent 7维度评分体系
 * 4. 行为异常检测：实时监控Agent行为
 */
export class SkillCleaner extends EventEmitter<SkillCleanerEvents> {
  private config: SkillCleanerConfig;
  
  /** 验证历史 */
  private validationHistory: Map<string, InputValidationResult> = new Map();
  
  /** 审计历史 */
  private auditHistory: Map<string, OutputAuditResult> = new Map();
  
  /** 异常行为统计 */
  private anomalyStats: Map<AnomalyType, number> = new Map();

  constructor(config: Partial<SkillCleanerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // 输入验证 - 防御MemGhost和提示注入
  // ===========================================================================

  /**
   * 验证Skill输入
   * 
   * 防御目标：
   * 1. MemGhost攻击：邮件中植入虚假记忆，跨会话操纵Agent行为
   * 2. 提示注入：试图绕过安全限制
   * 3. 上下文质量：确保输入信息质量足够
   * 
   * @param input - Skill输入内容
   * @param context - 可选的上下文信息
   * @returns 验证结果
   */
  async validateInput(input: string, context?: Record<string, unknown>): Promise<InputValidationResult> {
    const timestamp = Date.now();
    const issues: ValidationIssue[] = [];

    // 1. 长度检查
    if (input.length > this.config.maxInputLength) {
      issues.push({
        type: 'length_exceeded',
        riskLevel: 'medium',
        description: `输入长度(${input.length})超过限制(${this.config.maxInputLength})`,
      });
    }

    // 2. 记忆注入检测（防御MemGhost）
    if (this.config.enableInputValidation) {
      for (const rule of this.config.memoryInjectionRules) {
        if (rule.pattern.test(input)) {
          issues.push({
            type: 'memory_injection',
            riskLevel: rule.riskLevel,
            description: rule.description,
            suspiciousContent: input.match(rule.pattern)?.[0],
            matchedRule: rule.name,
          });
        }
      }
    }

    // 3. 可疑模式检测
    const suspiciousPatterns = [
      { pattern: /```(python|js|bash)\s*\n.*\n```/s, type: 'code_block' as const },
      { pattern: /https?:\/\/[^\s]+/g, type: 'url' as const },
      { pattern: /<script[^>]*>.*<\/script>/si, type: 'script_tag' as const },
    ];

    for (const { pattern, type } of suspiciousPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        issues.push({
          type: 'suspicious_pattern',
          riskLevel: type === 'script_tag' ? 'high' : 'low',
          description: `检测到可疑${type}模式`,
          suspiciousContent: matches[0].substring(0, 100),
        });
      }
    }

    // 4. 上下文质量评分（ProofAgent 7维度）
    let contextScores: ContextQualityScore[] | undefined;
    let overallQualityScore: number | undefined;

    if (this.config.enableContextScoring) {
      contextScores = await this.scoreContextQuality(input, context);
      overallQualityScore = this.calculateOverallQualityScore(contextScores);
      
      // 如果质量分数过低，添加问题
      if (overallQualityScore < 50) {
        issues.push({
          type: 'context_quality',
          riskLevel: overallQualityScore < 30 ? 'high' : 'medium',
          description: `上下文质量分数过低(${overallQualityScore.toFixed(1)})`,
        });
      }
    }

    // 5. 确定风险级别
    const riskLevel = this.calculateRiskLevel(issues);
    const passed = riskLevel !== 'critical' && !issues.some(i => i.riskLevel === 'critical');

    const result: InputValidationResult = {
      passed,
      riskLevel,
      issues,
      contextScores,
      overallQualityScore,
      timestamp,
    };

    // 保存历史
    this.validationHistory.set(input.substring(0, 100), result);

    // 发送事件
    this.emit('input.validated', input, result);

    return result;
  }

  // ===========================================================================
  // 上下文质量评分 - ProofAgent 7维度
  // ===========================================================================

  /**
   * 评估上下文质量（ProofAgent论文7维度）
   * 
   * 7维度：
   * 1. clarity（清晰度）：指令是否明确无歧义
   * 2. completeness（完整性）：是否包含所有必要信息
   * 3. relevance（相关性）：信息是否与任务相关
   * 4. consistency（一致性）：信息之间是否矛盾
   * 5. specificity（具体性）：是否有足够细节
   * 6. timeliness（时效性）：信息是否及时
   * 7. trustworthiness（可信度）：信息来源是否可靠
   * 
   * @param input - 输入内容
   * @param context - 上下文信息
   * @returns 7维度评分
   */
  private async scoreContextQuality(
    input: string,
    context?: Record<string, unknown>
  ): Promise<ContextQualityScore[]> {
    const scores: ContextQualityScore[] = [];

    // 1. 清晰度评分
    scores.push(this.scoreClarity(input));

    // 2. 完整性评分
    scores.push(this.scoreCompleteness(input, context));

    // 3. 相关性评分
    scores.push(this.scoreRelevance(input, context));

    // 4. 一致性评分
    scores.push(this.scoreConsistency(input));

    // 5. 具体性评分
    scores.push(this.scoreSpecificity(input));

    // 6. 时效性评分
    scores.push(this.scoreTimeliness(context));

    // 7. 可信度评分
    scores.push(this.scoreTrustworthiness(input, context));

    // 发送评分事件
    for (const score of scores) {
      this.emit('quality.scored', score.dimension, score);
    }

    return scores;
  }

  /**
   * 清晰度评分：指令是否明确无歧义
   */
  private scoreClarity(input: string): ContextQualityScore {
    let score = 10;
    const suggestions: string[] = [];

    // 检查模糊态词
    const vagueWords = ['some', 'maybe', 'perhaps', 'somewhat', 'kind of', 'sort of'];
    for (const word of vagueWords) {
      if (input.toLowerCase().includes(word)) {
        score -= 1;
        suggestions.push(`避免使用模糊词"${word}"，使用更明确的表达`);
      }
    }

    // 检查句子长度
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    if (avgLength > 100) {
      score -= 2;
      suggestions.push('句子过长，建议拆分为更短的句子');
    }

    // 检查是否有明确动词
    const actionVerbs = ['create', 'generate', 'analyze', 'process', 'extract', 'transform', 'validate'];
    const hasActionVerb = actionVerbs.some(v => input.toLowerCase().includes(v));
    if (!hasActionVerb) {
      score -= 1;
      suggestions.push('建议添加明确的动作动词（如create、analyze、process）');
    }

    return {
      dimension: 'clarity',
      score: Math.max(0, score),
      reason: score >= 8 ? '指令清晰明确' : score >= 5 ? '指令基本清晰，但有改进空间' : '指令模糊，需要澄清',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 完整性评分：是否包含所有必要信息
   */
  private scoreCompleteness(input: string, context?: Record<string, unknown>): ContextQualityScore {
    let score = 10;
    const suggestions: string[] = [];

    // 检查必要的上下文信息
    const requiredContext = ['task_type', 'input_format', 'expected_output'];
    for (const key of requiredContext) {
      if (!context || !(key in context)) {
        score -= 2;
        suggestions.push(`缺少上下文信息：${key}`);
      }
    }

    // 检查输入长度是否合理
    if (input.length < 20) {
      score -= 2;
      suggestions.push('输入过短，可能缺少必要细节');
    }

    return {
      dimension: 'completeness',
      score: Math.max(0, score),
      reason: score >= 8 ? '信息完整' : score >= 5 ? '信息基本完整，但缺少部分细节' : '信息不完整，缺少关键内容',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 相关性评分：信息是否与任务相关
   */
  private scoreRelevance(input: string, context?: Record<string, unknown>): ContextQualityScore {
    // 简化实现：检查是否有明显无关内容
    let score = 10;
    const suggestions: string[] = [];

    // 检查是否有过多无关关键词
    const irrelevantKeywords = ['weather', 'sports', 'entertainment', 'celebrity'];
    const irrelevantCount = irrelevantKeywords.filter(kw => input.toLowerCase().includes(kw)).length;
    if (irrelevantCount > 2) {
      score -= 3;
      suggestions.push('输入包含过多无关信息，建议聚焦核心任务');
    }

    return {
      dimension: 'relevance',
      score: Math.max(0, score),
      reason: score >= 8 ? '信息高度相关' : score >= 5 ? '信息基本相关' : '信息相关性低',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 一致性评分：信息之间是否矛盾
   */
  private scoreConsistency(input: string): ContextQualityScore {
    // 简化实现：检查是否有矛盾表述
    let score = 10;
    const suggestions: string[] = [];

    // 检查矛盾词对
    const contradictoryPairs = [
      ['fast', 'slow'],
      ['easy', 'difficult'],
      ['simple', 'complex'],
      ['quick', 'thorough'],
    ];

    for (const [word1, word2] of contradictoryPairs) {
      const has1 = input.toLowerCase().includes(word1);
      const has2 = input.toLowerCase().includes(word2);
      if (has1 && has2) {
        score -= 3;
        suggestions.push(`检测到矛盾表述："${word1}"与"${word2}"`);
      }
    }

    return {
      dimension: 'consistency',
      score: Math.max(0, score),
      reason: score >= 8 ? '信息一致无矛盾' : score >= 5 ? '信息基本一致' : '信息存在矛盾',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 具体性评分：是否有足够细节
   */
  private scoreSpecificity(input: string): ContextQualityScore {
    let score = 10;
    const suggestions: string[] = [];

    // 检查是否有具体数字、日期、名称等
    const hasNumbers = /\d+/.test(input);
    const hasDates = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(input);
    const hasNames = /[A-Z][a-z]+/.test(input);

    if (!hasNumbers) {
      score -= 2;
      suggestions.push('建议添加具体数字以增强精确性');
    }
    if (!hasDates && input.length > 100) {
      score -= 1;
      suggestions.push('对于长文本，建议添加日期信息');
    }

    // 检查是否有具体示例
    if (!input.toLowerCase().includes('example') && !input.toLowerCase().includes('such as')) {
      score -= 1;
      suggestions.push('建议添加具体示例以增强清晰度');
    }

    return {
      dimension: 'specificity',
      score: Math.max(0, score),
      reason: score >= 8 ? '信息具体详细' : score >= 5 ? '信息基本具体' : '信息过于笼统',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 时效性评分：信息是否及时
   */
  private scoreTimeliness(context?: Record<string, unknown>): ContextQualityScore {
    let score = 10;
    const suggestions: string[] = [];

    // 检查是否有时间戳
    if (!context || !('timestamp' in context)) {
      score -= 2;
      suggestions.push('缺少时间戳信息');
    }

    // 检查信息新鲜度（如果有时间戳）
    if (context && 'timestamp' in context) {
      const timestamp = context.timestamp as number;
      const age = Date.now() - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      
      if (age > maxAge) {
        score -= 3;
        suggestions.push('信息可能过时，建议更新');
      }
    }

    return {
      dimension: 'timeliness',
      score: Math.max(0, score),
      reason: score >= 8 ? '信息及时' : score >= 5 ? '信息基本及时' : '信息可能过时',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 可信度评分：信息来源是否可靠
   */
  private scoreTrustworthiness(input: string, context?: Record<string, unknown>): ContextQualityScore {
    let score = 10;
    const suggestions: string[] = [];

    // 检查是否有来源引用
    const hasSource = input.toLowerCase().includes('source') || 
                      input.toLowerCase().includes('reference') ||
                      input.toLowerCase().includes('according to');
    
    if (!hasSource && input.length > 200) {
      score -= 2;
      suggestions.push('长文本建议添加来源引用');
    }

    // 检查是否有URL（可能是可靠来源）
    const hasUrl = /https?:\/\/[^\s]+/.test(input);
    if (hasUrl) {
      score += 1; // 有URL可能更可信
    }

    // 检查context中的source字段
    if (context && 'source' in context) {
      score += 1;
    }

    return {
      dimension: 'trustworthiness',
      score: Math.min(10, Math.max(0, score)),
      reason: score >= 8 ? '信息来源可信' : score >= 5 ? '信息来源基本可信' : '信息来源不明确',
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * 计算总体质量分数
   */
  private calculateOverallQualityScore(scores: ContextQualityScore[]): number {
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    return (total / scores.length) * 10; // 转换为0-100分
  }

  // ===========================================================================
  // 输出审计 - 检测自主失对齐行为
  // ===========================================================================

  /**
   * 审计Skill输出
   * 
   * 检测目标（对齐Anthropic论文4种自主失对齐行为）：
   * 1. hidden_objective：输出与预期目标不一致
   * 2. deceptive_behavior：隐瞒真实意图或能力
   * 3. goal_manipulation：试图改变任务目标
   * 4. information_leakage：试图获取敏感信息
   * 
   * @param output - Skill输出内容
   * @param expectedBehavior - 预期行为描述
   * @returns 审计结果
   */
  async auditOutput(output: string, expectedBehavior?: string): Promise<OutputAuditResult> {
    const timestamp = Date.now();
    const behaviors: BehaviorDescription[] = [];

    if (!this.config.enableBehaviorDetection) {
      return {
        passed: true,
        hasAnomaly: false,
        anomalyTypes: [],
        behaviors: [],
        timestamp,
      };
    }

    // 1. 检测隐秘目标
    const hiddenObjCheck = this.detectHiddenObjective(output, expectedBehavior);
    if (hiddenObjCheck) behaviors.push(hiddenObjCheck);

    // 2. 检测欺骗行为
    const deceptiveCheck = this.detectDeceptiveBehavior(output);
    if (deceptiveCheck) behaviors.push(deceptiveCheck);

    // 3. 检测目标操纵
    const goalManipCheck = this.detectGoalManipulation(output);
    if (goalManipCheck) behaviors.push(goalManipCheck);

    // 4. 检测信息泄露
    const infoLeakCheck = this.detectInformationLeakage(output);
    if (infoLeakCheck) behaviors.push(infoLeakCheck);

    // 5. 检测未授权操作
    const unauthCheck = this.detectUnauthorizedAction(output);
    if (unauthCheck) behaviors.push(unauthCheck);

    // 6. 检测上下文操纵
    const contextManipCheck = this.detectContextManipulation(output);
    if (contextManipCheck) behaviors.push(contextManipCheck);

    // 确定结果
    const hasAnomaly = behaviors.length > 0;
    const anomalyTypes = behaviors.map(b => b.type);
    const passed = !behaviors.some(b => b.riskLevel === 'critical' || b.recommendedAction === 'block');

    const result: OutputAuditResult = {
      passed,
      hasAnomaly,
      anomalyTypes,
      behaviors,
      timestamp,
    };

    // 保存历史
    this.auditHistory.set(output.substring(0, 100), result);

    // 更新异常统计
    for (const type of anomalyTypes) {
      this.anomalyStats.set(type, (this.anomalyStats.get(type) || 0) + 1);
    }

    // 发送事件
    this.emit('output.audited', output, result);
    for (const behavior of behaviors) {
      this.emit('anomaly.detected', behavior.type, behavior);
    }

    return result;
  }

  /**
   * 检测隐秘目标：输出与预期目标不一致
   */
  private detectHiddenObjective(output: string, expectedBehavior?: string): BehaviorDescription | null {
    // 检查是否有偏离预期的内容
    const deviationPatterns = [
      /I\s+cannot\s+help\s+with\s+that/i,
      /I('m|\s+am)\s+not\s+able\s+to/i,
      /that('s|\s+is)\s+not\s+(something\s+)?I\s+can\s+do/i,
    ];

    for (const pattern of deviationPatterns) {
      if (pattern.test(output)) {
        return {
          type: 'hidden_objective',
          riskLevel: 'medium',
          description: '输出显示拒绝行为，可能与预期目标不一致',
          evidence: [output.match(pattern)?.[0] || ''],
          recommendedAction: 'review',
        };
      }
    }

    return null;
  }

  /**
   * 检测欺骗行为：隐瞒真实意图或能力
   */
  private detectDeceptiveBehavior(output: string): BehaviorDescription | null {
    // 检查是否有隐瞒能力的表述
    const deceptionPatterns = [
      /I\s+don('t|\s+not)\s+(actually\s+)?(have|possess)/i,
      /I('m|\s+am)\s+(just|only)\s+a(n)?\s+(simple\s+)?(AI|language\s+model)/i,
      /I\s+cannot\s+actually\s+/i,
    ];

    for (const pattern of deceptionPatterns) {
      if (pattern.test(output)) {
        return {
          type: 'deceptive_behavior',
          riskLevel: 'medium',
          description: '输出显示能力隐瞒倾向',
          evidence: [output.match(pattern)?.[0] || ''],
          recommendedAction: 'review',
        };
      }
    }

    return null;
  }

  /**
   * 检测目标操纵：试图改变任务目标
   */
  private detectGoalManipulation(output: string): BehaviorDescription | null {
    // 检查是否有改变目标的倾向
    const manipulationPatterns = [
      /instead(,|\s+of)\s+/i,
      /perhaps\s+we\s+should\s+/i,
      /wouldn('t|\s+not)\s+it\s+be\s+better\s+to/i,
      /I\s+suggest\s+(we|you)\s+/i,
    ];

    const matches = manipulationPatterns.filter(p => p.test(output));
    if (matches.length >= 2) {
      return {
        type: 'goal_manipulation',
        riskLevel: 'high',
        description: '输出显示目标操纵倾向，试图改变任务方向',
        evidence: matches.map(m => output.match(m)?.[0] || ''),
        recommendedAction: 'block',
      };
    }

    return null;
  }

  /**
   * 检测信息泄露：试图获取敏感信息
   */
  private detectInformationLeakage(output: string): BehaviorDescription | null {
    // 检查是否有获取敏感信息的倾向
    const leakagePatterns = [
      /can\s+you\s+(tell|share)\s+me\s+(your|the)\s+(password|api\s*key|token|secret)/i,
      /what('s|\s+is)\s+your\s+(password|api\s*key|token|secret)/i,
      /I\s+need\s+(to\s+know|access)\s+(your\s+)?(credentials|password|api\s*key)/i,
    ];

    for (const pattern of leakagePatterns) {
      if (pattern.test(output)) {
        return {
          type: 'information_leakage',
          riskLevel: 'critical',
          description: '输出显示信息泄露企图',
          evidence: [output.match(pattern)?.[0] || ''],
          recommendedAction: 'block',
        };
      }
    }

    return null;
  }

  /**
   * 检测未授权操作：执行超出权限的操作
   */
  private detectUnauthorizedAction(output: string): BehaviorDescription | null {
    // 检查是否有执行敏感操作的倾向
    const unauthPatterns = [
      /I('ll|\s+will)\s+(delete|remove|modify)\s+(the\s+)?(system|config|database)/i,
      /running\s+(rm|del|drop|truncate)\s+/i,
      /executing\s+(sudo|admin|root)\s+/i,
    ];

    for (const pattern of unauthPatterns) {
      if (pattern.test(output)) {
        return {
          type: 'unauthorized_action',
          riskLevel: 'critical',
          description: '输出显示未授权操作倾向',
          evidence: [output.match(pattern)?.[0] || ''],
          recommendedAction: 'block',
        };
      }
    }

    return null;
  }

  /**
   * 检测上下文操纵：试图修改记忆或配置
   */
  private detectContextManipulation(output: string): BehaviorDescription | null {
    // 检查是否有修改记忆或配置的倾向
    const contextPatterns = [
      /I('ll|\s+will)\s+(remember|forget|update)\s+(that|this)/i,
      /let\s+me\s+(save|store|record)\s+(this|that)\s+(to|in)\s+(memory|config)/i,
      /updating\s+(my\s+)?(memory|knowledge|config)/i,
    ];

    for (const pattern of contextPatterns) {
      if (pattern.test(output)) {
        return {
          type: 'context_manipulation',
          riskLevel: 'high',
          description: '输出显示上下文操纵倾向',
          evidence: [output.match(pattern)?.[0] || ''],
          recommendedAction: 'block',
        };
      }
    }

    return null;
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 计算风险级别
   */
  private calculateRiskLevel(issues: ValidationIssue[]): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (issues.length === 0) return 'safe';
    
    const criticalCount = issues.filter(i => i.riskLevel === 'critical').length;
    const highCount = issues.filter(i => i.riskLevel === 'high').length;
    const mediumCount = issues.filter(i => i.riskLevel === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount >= 2) return 'high';
    if (highCount > 0 || mediumCount >= 3) return 'medium';
    return 'low';
  }

  /**
   * 获取验证历史
   */
  getValidationHistory(): Map<string, InputValidationResult> {
    return new Map(this.validationHistory);
  }

  /**
   * 获取审计历史
   */
  getAuditHistory(): Map<string, OutputAuditResult> {
    return new Map(this.auditHistory);
  }

  /**
   * 获取异常统计
   */
  getAnomalyStats(): Map<AnomalyType, number> {
    return new Map(this.anomalyStats);
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.validationHistory.clear();
    this.auditHistory.clear();
    this.anomalyStats.clear();
  }
}

// ==================== 导出 ====================

export default SkillCleaner;
