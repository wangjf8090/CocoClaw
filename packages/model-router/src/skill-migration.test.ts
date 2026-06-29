/**
 * 技能跨模型迁移 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  SkillMigrator,
  RuleBasedAdapter,
  MODEL_PROFILES,
  type SkillMigrationConfig,
  type LLMAdapter,
} from './skill-migration.js';
import type { SkillStandard } from '../../skills/src/skill-standard.js';

// ============================================================================
// 测试用 SkillStandard
// ============================================================================

const testSkill: SkillStandard = {
  name: 'test-skill',
  description: 'A test skill',
  version: '1.0.0',
  model_support: ['gpt-4o'],
  instructions: 'Do something useful with the data.\n\nUse function_call to get results.',
  examples: ['Example 1'],
  limitations: ['Rate limited'],
};

const xmlSkill: SkillStandard = {
  name: 'xml-skill',
  description: 'A skill with XML instructions',
  version: '1.0.0',
  model_support: ['claude-3.7-sonnet'],
  instructions: '<instructions>\n<step1>First step</step1>\n<step2>Second step</step2>\n</instructions>',
};

// ============================================================================
// RuleBasedAdapter
// ============================================================================

describe('RuleBasedAdapter', () => {
  it('should apply XML to Markdown conversion rules', async () => {
    const adapter = new RuleBasedAdapter();
    const result = await adapter.generate(
      `你是一个 AI 指令转换专家。请将以下为 claude-3.7-sonnet 编写的指令转换为适合 gpt-4o 的版本。\n\n原始指令：\n<instructions>\n<step1>First</step1>\n</instructions>\n\n要求：\n1. 保持语义不变`
    );
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return original instructions when models are unknown', async () => {
    const adapter = new RuleBasedAdapter();
    const result = await adapter.generate('Some random prompt without expected format');
    expect(result).toBe('');
  });
});

// ============================================================================
// SkillMigrator - 兼容性检查
// ============================================================================

describe('SkillMigrator - Compatibility Check', () => {
  it('should return compatible for already supported model', () => {
    const migrator = new SkillMigrator();
    const result = migrator.checkCompatibility(testSkill, 'gpt-4o');
    expect(result.compatible).toBe(true);
    expect(result.score).toBe(1.0);
  });

  it('should return compatible for same provider model', () => {
    const migrator = new SkillMigrator();
    const result = migrator.checkCompatibility(testSkill, 'gpt-4o-mini');
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('should return lower score for different provider model', () => {
    const migrator = new SkillMigrator();
    const result = migrator.checkCompatibility(testSkill, 'claude-3.7-sonnet');
    expect(result.score).toBeLessThan(1.0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should detect XML format incompatibility', () => {
    const migrator = new SkillMigrator();
    const result = migrator.checkCompatibility(xmlSkill, 'gpt-4o');
    expect(result.score).toBeLessThan(1.0);
    expect(result.suggestions.some(s => s.includes('XML') || s.includes('Markdown'))).toBe(true);
  });

  it('should handle skills without model_support', () => {
    const migrator = new SkillMigrator();
    const noSupport: SkillStandard = {
      name: 'no-support',
      description: 'No model support listed',
      version: '1.0.0',
      instructions: 'Simple instructions',
    };
    const result = migrator.checkCompatibility(noSupport, 'gpt-4o');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// SkillMigrator - 迁移
// ============================================================================

describe('SkillMigrator - Migration', () => {
  it('should return migrationRequired=false for compatible model', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'gpt-4o',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.migrationRequired).toBe(false);
    expect(result.skill.model_support).toContain('gpt-4o');
  });

  it('should migrate and update model_support for new model', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.migrationRequired).toBe(true);
    expect(result.skill.model_support).toContain('claude-3.7-sonnet');
    expect(result.skill.model_support).toContain('gpt-4o'); // preserved
  });

  it('should provide migration details when migration is required', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.details).toBeDefined();
    expect(result.details!.sourceModelSupport).toEqual(['gpt-4o']);
    expect(result.details!.targetModelSupport).toContain('claude-3.7-sonnet');
    expect(result.details!.qualityScore).toBeGreaterThan(0);
    expect(result.details!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should skip auto-adapt when option is false', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
      options: { autoAdapt: false },
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.migrationRequired).toBe(true);
    expect(result.details!.instructionsModified).toBe(false);
  });

  it('should preserve original model support by default', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'qwen-3-max',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.skill.model_support).toContain('gpt-4o');
    expect(result.skill.model_support).toContain('qwen-3-max');
  });
});

// ============================================================================
// SkillMigrator - 自定义 LLM 适配器
// ============================================================================

describe('SkillMigrator - Custom LLM Adapter', () => {
  it('should use custom LLM adapter for instruction adaptation', async () => {
    const mockAdapter: LLMAdapter = {
      generate: async (prompt: string) => {
        return 'Adapted instructions for target model';
      },
    };

    const migrator = new SkillMigrator(mockAdapter);
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.skill.instructions).toBe('Adapted instructions for target model');
  });

  it('should fall back to original on LLM error', async () => {
    const errorAdapter: LLMAdapter = {
      generate: async () => {
        throw new Error('LLM unavailable');
      },
    };

    const migrator = new SkillMigrator(errorAdapter);
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
    };

    const result = await migrator.migrate(config, testSkill);
    expect(result.skill.instructions).toBe(testSkill.instructions);
  });
});

// ============================================================================
// SkillMigrator - 迁移历史
// ============================================================================

describe('SkillMigrator - Migration History', () => {
  it('should record migration history', async () => {
    const migrator = new SkillMigrator();
    const config: SkillMigrationConfig = {
      sourceModel: 'gpt-4o',
      targetModel: 'claude-3.7-sonnet',
      skillName: 'test-skill',
    };

    await migrator.migrate(config, testSkill);
    const history = migrator.getMigrationHistory();
    expect(history.length).toBe(1);
    expect(history[0].sourceModel).toBe('gpt-4o');
    expect(history[0].targetModel).toBe('claude-3.7-sonnet');
    expect(history[0].skillName).toBe('test-skill');
    expect(history[0].success).toBe(true);
  });

  it('should filter history by skill name', async () => {
    const migrator = new SkillMigrator();

    await migrator.migrate(
      { sourceModel: 'gpt-4o', targetModel: 'claude-3.7-sonnet', skillName: 'skill-a' },
      testSkill,
    );
    await migrator.migrate(
      { sourceModel: 'gpt-4o', targetModel: 'qwen-3-max', skillName: 'skill-b' },
      testSkill,
    );

    const historyA = migrator.getSkillMigrationHistory('skill-a');
    const historyB = migrator.getSkillMigrationHistory('skill-b');
    expect(historyA.length).toBe(1);
    expect(historyB.length).toBe(1);
    expect(historyA[0].skillName).toBe('skill-a');
    expect(historyB[0].skillName).toBe('skill-b');
  });
});

// ============================================================================
// MODEL_PROFILES
// ============================================================================

describe('MODEL_PROFILES', () => {
  it('should have profiles for all expected models', () => {
    const expectedModels = ['gpt-4o', 'gpt-4o-mini', 'claude-3.7-sonnet', 'claude-haiku', 'qwen-3-max', 'deepseek-v3', 'glm-5.2'];
    for (const model of expectedModels) {
      expect(MODEL_PROFILES[model]).toBeDefined();
      expect(MODEL_PROFILES[model].name).toBe(model);
      expect(MODEL_PROFILES[model].provider).toBeDefined();
      expect(MODEL_PROFILES[model].instructionStyle).toBeDefined();
    }
  });

  it('should have valid instruction styles', () => {
    for (const profile of Object.values(MODEL_PROFILES)) {
      expect(['markdown', 'xml', 'plain']).toContain(profile.instructionStyle.systemPromptFormat);
      expect(typeof profile.instructionStyle.functionCalling).toBe('boolean');
      expect(typeof profile.instructionStyle.jsonMode).toBe('boolean');
      expect(profile.instructionStyle.maxContextTokens).toBeGreaterThan(0);
    }
  });
});
