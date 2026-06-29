/**
 * 技能跨模型迁移 (M3 多模型路由增强)
 * 核心思想：技能卡是自然语言，模型无关
 *
 * 支持:
 * 1. 检查技能与目标模型的兼容性
 * 2. 使用 LLM 适配指令风格
 * 3. 生成迁移后的技能卡
 * 4. 迁移质量评估
 */

import type { SkillStandard } from '../../skills/src/skill-standard.js';

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 技能迁移配置
 */
export interface SkillMigrationConfig {
  /** 源模型名称 */
  sourceModel: string;
  /** 目标模型名称 */
  targetModel: string;
  /** 待迁移的技能名称 */
  skillName: string;
  /** 迁移选项 */
  options?: MigrationOptions;
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
  /** 是否自动适配指令风格（默认 true） */
  autoAdapt?: boolean;
  /** 是否验证迁移后技能的完整性（默认 true） */
  validateAfterMigration?: boolean;
  /** 最大重试次数（默认 2） */
  maxRetries?: number;
  /** 迁移质量阈值 0-1（默认 0.7） */
  qualityThreshold?: number;
  /** 是否保留原始 model_support（默认 true） */
  preserveOriginalSupport?: boolean;
}

/**
 * 迁移后的技能
 */
export interface MigratedSkill {
  /** 迁移后的技能标准 */
  skill: SkillStandard;
  /** 是否需要迁移（如果已兼容则不需要） */
  migrationRequired: boolean;
  /** 迁移详情 */
  details?: MigrationDetails;
}

/**
 * 迁移详情
 */
export interface MigrationDetails {
  /** 迁移前的 model_support */
  sourceModelSupport: string[];
  /** 迁移后的 model_support */
  targetModelSupport: string[];
  /** 指令是否被修改 */
  instructionsModified: boolean;
  /** 修改的指令条目列表 */
  instructionChanges: InstructionChange[];
  /** 迁移质量评分 0-1 */
  qualityScore: number;
  /** 迁移耗时 (ms) */
  durationMs: number;
  /** 迁移时间戳 */
  migratedAt: number;
}

/**
 * 指令变更记录
 */
export interface InstructionChange {
  /** 变更类型 */
  type: 'style_adaptation' | 'syntax_adjustment' | 'feature_removal' | 'feature_addition';
  /** 变更描述 */
  description: string;
  /** 原始片段 */
  before: string;
  /** 变更后片段 */
  after: string;
}

/**
 * 模型兼容性检查结果
 */
export interface CompatibilityCheck {
  /** 是否兼容 */
  compatible: boolean;
  /** 兼容性评分 0-1 */
  score: number;
  /** 不兼容的原因列表 */
  reasons: string[];
  /** 建议的适配操作 */
  suggestions: string[];
}

/**
 * 模型特征描述
 * 用于推断模型间的差异和适配需求
 */
export interface ModelProfile {
  /** 模型名称 */
  name: string;
  /** 提供商 */
  provider: string;
  /** 指令风格特征 */
  instructionStyle: {
    /** 偏好的系统提示词格式 */
    systemPromptFormat: 'markdown' | 'xml' | 'plain';
    /** 是否支持 function calling */
    functionCalling: boolean;
    /** 是否支持 JSON mode */
    jsonMode: boolean;
    /** 最大上下文长度 */
    maxContextTokens: number;
    /** 偏好的指令语言 */
    preferredLanguage?: string;
  };
  /** 已知限制 */
  limitations: string[];
  /** 已知优势 */
  strengths: string[];
}

/**
 * 迁移历史记录
 */
export interface MigrationRecord {
  /** 记录 ID */
  id: string;
  /** 源模型 */
  sourceModel: string;
  /** 目标模型 */
  targetModel: string;
  /** 技能名称 */
  skillName: string;
  /** 是否成功 */
  success: boolean;
  /** 迁移质量 */
  qualityScore: number;
  /** 迁移时间 */
  timestamp: number;
}

// ============================================================================
// 已知模型特征
// ============================================================================

/**
 * 预定义的模型特征
 */
export const MODEL_PROFILES: Record<string, ModelProfile> = {
  'gpt-4o': {
    name: 'gpt-4o',
    provider: 'openai',
    instructionStyle: {
      systemPromptFormat: 'markdown',
      functionCalling: true,
      jsonMode: true,
      maxContextTokens: 128000,
    },
    limitations: ['Occasional overly verbose responses', 'May follow instructions too literally'],
    strengths: ['Strong instruction following', 'Good at structured output', 'Reliable function calling'],
  },
  'gpt-4o-mini': {
    name: 'gpt-4o-mini',
    provider: 'openai',
    instructionStyle: {
      systemPromptFormat: 'markdown',
      functionCalling: true,
      jsonMode: true,
      maxContextTokens: 128000,
    },
    limitations: ['Less nuanced reasoning', 'Simpler task execution'],
    strengths: ['Fast and cost-effective', 'Good function calling support'],
  },
  'claude-3.7-sonnet': {
    name: 'claude-3.7-sonnet',
    provider: 'anthropic',
    instructionStyle: {
      systemPromptFormat: 'xml',
      functionCalling: true,
      jsonMode: false,
      maxContextTokens: 200000,
      preferredLanguage: 'en',
    },
    limitations: ['Prefers XML tags for structured output', 'No native JSON mode'],
    strengths: ['Excellent at long context', 'Strong reasoning', 'Good at following complex instructions'],
  },
  'claude-haiku': {
    name: 'claude-haiku',
    provider: 'anthropic',
    instructionStyle: {
      systemPromptFormat: 'xml',
      functionCalling: true,
      jsonMode: false,
      maxContextTokens: 200000,
    },
    limitations: ['Less capable with complex reasoning', 'Prefers XML format'],
    strengths: ['Very fast', 'Cost-effective for verification tasks'],
  },
  'qwen-3-max': {
    name: 'qwen-3-max',
    provider: 'dashscope',
    instructionStyle: {
      systemPromptFormat: 'markdown',
      functionCalling: true,
      jsonMode: true,
      maxContextTokens: 128000,
      preferredLanguage: 'zh',
    },
    limitations: ['May have instruction format differences from GPT/Claude'],
    strengths: ['Strong Chinese language support', 'Good structured output'],
  },
  'deepseek-v3': {
    name: 'deepseek-v3',
    provider: 'deepseek',
    instructionStyle: {
      systemPromptFormat: 'markdown',
      functionCalling: true,
      jsonMode: true,
      maxContextTokens: 128000,
    },
    limitations: ['May require more explicit instructions'],
    strengths: ['Strong reasoning capabilities', 'Good at code generation'],
  },
  'glm-5.2': {
    name: 'glm-5.2',
    provider: 'zhipu',
    instructionStyle: {
      systemPromptFormat: 'markdown',
      functionCalling: true,
      jsonMode: true,
      maxContextTokens: 128000,
      preferredLanguage: 'zh',
    },
    limitations: ['May have different instruction format expectations'],
    strengths: ['Strong Chinese language support', 'Good at structured output'],
  },
};

// ============================================================================
// SkillMigrator 类
// ============================================================================

/**
 * LLM 适配器接口（用于指令风格转换）
 * 外部注入，避免硬依赖
 */
export interface LLMAdapter {
  generate(prompt: string): Promise<string>;
}

/**
 * 默认的空 LLM 适配器（仅做规则化替换）
 */
export class RuleBasedAdapter implements LLMAdapter {
  async generate(prompt: string): Promise<string> {
    // 从 prompt 中提取原始指令和模型信息
    const sourceMatch = prompt.match(/为\s*(\S+)\s*编写的指令/);
    const targetMatch = prompt.match(/转换为适合\s*(\S+)\s*的版本/);
    const instructionsMatch = prompt.match(/原始指令：\n([\s\S]+?)\n\n要求/);

    if (!sourceMatch || !targetMatch || !instructionsMatch) {
      return instructionsMatch?.[1] ?? '';
    }

    const sourceModel = sourceMatch[1];
    const targetModel = targetMatch[1];
    const instructions = instructionsMatch[1];

    // 规则化适配
    return this.applyRules(instructions, sourceModel, targetModel);
  }

  /**
   * 基于规则的指令适配
   */
  private applyRules(instructions: string, sourceModel: string, targetModel: string): string {
    let adapted = instructions;
    const sourceProfile = MODEL_PROFILES[sourceModel];
    const targetProfile = MODEL_PROFILES[targetModel];

    if (!sourceProfile || !targetProfile) {
      return instructions; // 无法适配，返回原始
    }

    // 规则 1: 系统提示词格式转换
    if (sourceProfile.instructionStyle.systemPromptFormat === 'xml' &&
        targetProfile.instructionStyle.systemPromptFormat === 'markdown') {
      // XML → Markdown: 将 XML 标签转为 Markdown headers
      adapted = adapted.replace(/<(\w+)>([\s\S]*?)<\/\1>/g, (_, tag, content) => {
        return `### ${tag}\n${content.trim()}`;
      });
    } else if (sourceProfile.instructionStyle.systemPromptFormat === 'markdown' &&
               targetProfile.instructionStyle.systemPromptFormat === 'xml') {
      // Markdown → XML: 将 Markdown headers 转为 XML 标签
      adapted = adapted.replace(/^(#{1,3})\s+(.+)$/gm, (_, hashes, title) => {
        const tag = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        return `<${tag}>`;
      });
    }

    // 规则 2: JSON mode 提示
    if (!sourceProfile.instructionStyle.jsonMode && targetProfile.instructionStyle.jsonMode) {
      // 目标模型支持 JSON mode → 可以简化 JSON 格式指令
      adapted = adapted.replace(
        /请以\s*JSON\s*格式/g,
        '以 JSON 格式'
      );
    }

    // 规则 3: Function calling 提示
    if (!sourceProfile.instructionStyle.functionCalling && targetProfile.instructionStyle.functionCalling) {
      adapted += '\n\n注意：目标模型支持 function calling，可使用工具调用来完成复杂任务。';
    }

    return adapted;
  }
}

/**
 * 技能跨模型迁移器
 */
export class SkillMigrator {
  private llmAdapter: LLMAdapter;
  private migrationHistory: MigrationRecord[] = [];

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter ?? new RuleBasedAdapter();
  }

  /**
   * 迁移技能到目标模型
   *
   * @param config - 迁移配置
   * @param skill - 待迁移的技能标准对象
   * @returns 迁移结果
   */
  async migrate(config: SkillMigrationConfig, skill: SkillStandard): Promise<MigratedSkill> {
    const opts: Required<MigrationOptions> = {
      autoAdapt: true,
      validateAfterMigration: true,
      maxRetries: 2,
      qualityThreshold: 0.7,
      preserveOriginalSupport: true,
      ...config.options,
    };

    const startTime = Date.now();

    // 1. 检查模型兼容性
    const compatibility = this.checkCompatibility(skill, config.targetModel);

    if (compatibility.compatible && compatibility.score >= 0.9) {
      // 已经兼容，无需迁移
      return {
        skill: {
          ...skill,
          model_support: this.addModelSupport(skill.model_support, config.targetModel, opts.preserveOriginalSupport),
        },
        migrationRequired: false,
      };
    }

    // 2. 需要迁移
    if (!opts.autoAdapt) {
      // 不自动适配，仅更新 model_support
      return {
        skill: {
          ...skill,
          model_support: this.addModelSupport(skill.model_support, config.targetModel, opts.preserveOriginalSupport),
        },
        migrationRequired: true,
        details: {
          sourceModelSupport: skill.model_support ?? [],
          targetModelSupport: this.addModelSupport(skill.model_support, config.targetModel, opts.preserveOriginalSupport),
          instructionsModified: false,
          instructionChanges: [],
          qualityScore: compatibility.score,
          durationMs: Date.now() - startTime,
          migratedAt: Date.now(),
        },
      };
    }

    // 3. 适配指令
    const adaptedInstructions = await this.adaptInstructions(
      skill.instructions,
      config.sourceModel,
      config.targetModel,
    );

    // 4. 生成变更记录
    const instructionChanges = this.detectInstructionChanges(
      skill.instructions,
      adaptedInstructions,
    );

    // 5. 计算迁移质量
    const qualityScore = this.calculateQualityScore(
      skill.instructions,
      adaptedInstructions,
      instructionChanges,
    );

    // 6. 构建迁移后的技能
    const newModelSupport = this.addModelSupport(
      skill.model_support,
      config.targetModel,
      opts.preserveOriginalSupport,
    );

    const migratedSkill: SkillStandard = {
      ...skill,
      instructions: adaptedInstructions,
      model_support: newModelSupport,
    };

    const details: MigrationDetails = {
      sourceModelSupport: skill.model_support ?? [],
      targetModelSupport: newModelSupport,
      instructionsModified: skill.instructions !== adaptedInstructions,
      instructionChanges,
      qualityScore,
      durationMs: Date.now() - startTime,
      migratedAt: Date.now(),
    };

    // 7. 记录迁移历史
    this.recordMigration(config, qualityScore, true);

    return {
      skill: migratedSkill,
      migrationRequired: true,
      details,
    };
  }

  /**
   * 检查技能与目标模型的兼容性
   */
  checkCompatibility(skill: SkillStandard, targetModel: string): CompatibilityCheck {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // 检查 model_support
    if (skill.model_support && skill.model_support.length > 0) {
      if (skill.model_support.includes(targetModel)) {
        return { compatible: true, score: 1.0, reasons: [], suggestions: [] };
      }

      // 检查同提供商的其他模型
      const targetProfile = MODEL_PROFILES[targetModel];
      if (targetProfile) {
        const sameProvider = skill.model_support.some(m => {
          const profile = MODEL_PROFILES[m];
          return profile && profile.provider === targetProfile.provider;
        });

        if (sameProvider) {
          score -= 0.1;
          reasons.push(`技能支持同提供商的其他模型，但未明确支持 ${targetModel}`);
          suggestions.push(`检查 ${targetModel} 与已支持模型之间的指令风格差异`);
        } else {
          score -= 0.3;
          reasons.push(`技能不支持 ${targetModel} 所在提供商的任何模型`);
          suggestions.push(`需要适配指令格式和风格以匹配 ${targetProfile.provider} 的规范`);
        }
      }
    }

    // 检查指令中是否有模型特定格式
    const instructions = skill.instructions.toLowerCase();

    // 检测 XML 标签模式 (如 <step1>, <instructions>, <system> 等)
    const xmlTagPattern = /<\/?[a-zA-Z][\w-]*>/;
    if (xmlTagPattern.test(instructions)) {
      const targetProfile = MODEL_PROFILES[targetModel];
      if (targetProfile && targetProfile.instructionStyle.systemPromptFormat !== 'xml') {
        score -= 0.2;
        reasons.push('指令中包含 XML 标签，目标模型可能不偏好此格式');
        suggestions.push('将 XML 标签转为 Markdown headers');
      }
    }

    if (instructions.includes('function_call') || instructions.includes('tool_call')) {
      const targetProfile = MODEL_PROFILES[targetModel];
      if (targetProfile && !targetProfile.instructionStyle.functionCalling) {
        score -= 0.15;
        reasons.push('指令中包含 function calling 相关内容，目标模型可能不完全支持');
        suggestions.push('将 function calling 指令改为普通文本指令');
      }
    }

    if (instructions.includes('json_mode') || instructions.includes('json_object')) {
      const targetProfile = MODEL_PROFILES[targetModel];
      if (targetProfile && !targetProfile.instructionStyle.jsonMode) {
        score -= 0.1;
        reasons.push('指令中包含 JSON mode 相关内容，目标模型可能不支持');
        suggestions.push('改为在提示词中要求 JSON 输出');
      }
    }

    return {
      compatible: score >= 0.7,
      score: Math.max(0, score),
      reasons,
      suggestions,
    };
  }

  /**
   * 适配指令：使用 LLM/规则转换指令风格
   */
  private async adaptInstructions(
    instructions: string,
    sourceModel: string,
    targetModel: string,
  ): Promise<string> {
    const prompt = `你是一个 AI 指令转换专家。请将以下为 ${sourceModel} 编写的指令转换为适合 ${targetModel} 的版本。

原始指令：
${instructions}

要求：
1. 保持语义不变
2. 适配目标模型的表达习惯
3. 保持自然语言风格
4. 不要添加或删除关键信息

转换后的指令：`;

    try {
      const response = await this.llmAdapter.generate(prompt);
      return response.trim() || instructions;
    } catch {
      // LLM 调用失败时返回原始指令
      return instructions;
    }
  }

  /**
   * 检测指令变更
   */
  private detectInstructionChanges(
    before: string,
    after: string,
  ): InstructionChange[] {
    const changes: InstructionChange[] = [];

    if (before === after) return changes;

    // 检测 XML 标签转换
    if (before.includes('<') && after.includes('###')) {
      changes.push({
        type: 'style_adaptation',
        description: 'XML 标签格式转换为 Markdown headers',
        before: '<tag>content</tag>',
        after: '### tag\ncontent',
      });
    }

    // 检测 Markdown headers 转换
    if (/^#{1,3}\s/m.test(before) && after.includes('<')) {
      changes.push({
        type: 'style_adaptation',
        description: 'Markdown headers 转换为 XML 标签',
        before: '### section\ncontent',
        after: '<section>content</section>',
      });
    }

    // 检测 JSON mode 相关变更
    if (before.includes('json_mode') && !after.includes('json_mode')) {
      changes.push({
        type: 'feature_removal',
        description: '移除 JSON mode 相关指令',
        before: 'Use json_mode for output',
        after: 'Output in JSON format',
      });
    }

    // 如果没有检测到特定变更，记录通用变更
    if (changes.length === 0) {
      changes.push({
        type: 'style_adaptation',
        description: '指令风格已适配目标模型',
        before: before.slice(0, 100) + (before.length > 100 ? '...' : ''),
        after: after.slice(0, 100) + (after.length > 100 ? '...' : ''),
      });
    }

    return changes;
  }

  /**
   * 计算迁移质量评分
   */
  private calculateQualityScore(
    before: string,
    after: string,
    changes: InstructionChange[],
  ): number {
    if (before === after) return 1.0;

    let score = 0.8; // 基础分

    // 内容长度相似度
    const lengthRatio = Math.min(before.length, after.length) /
      Math.max(before.length, after.length);
    score *= (0.5 + 0.5 * lengthRatio);

    // 变更数量惩罚（变更越多，质量可能越低）
    const changePenalty = Math.min(changes.length * 0.05, 0.2);
    score -= changePenalty;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 添加模型支持
   */
  private addModelSupport(
    current: string[] | undefined,
    newModel: string,
    preserve: boolean,
  ): string[] {
    const list = preserve ? [...(current ?? [])] : [];
    if (!list.includes(newModel)) {
      list.push(newModel);
    }
    return list;
  }

  /**
   * 记录迁移历史
   */
  private recordMigration(
    config: SkillMigrationConfig,
    qualityScore: number,
    success: boolean,
  ): void {
    this.migrationHistory.push({
      id: `migration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceModel: config.sourceModel,
      targetModel: config.targetModel,
      skillName: config.skillName,
      success,
      qualityScore,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取迁移历史
   */
  getMigrationHistory(): MigrationRecord[] {
    return [...this.migrationHistory];
  }

  /**
   * 获取指定技能的迁移历史
   */
  getSkillMigrationHistory(skillName: string): MigrationRecord[] {
    return this.migrationHistory.filter(r => r.skillName === skillName);
  }
}
