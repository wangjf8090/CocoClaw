/**
 * Skill Registry Tests
 * P1-2: 技能系统增强
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry, type SlashCommand, type SkillExecutor } from './skill-registry.js';
import { type SkillStandard } from './skill-standard.js';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  const sampleSkill: SkillStandard = {
    name: 'test-skill',
    description: 'A test skill for unit testing',
    version: '1.0.0',
    author: 'test',
    domain: 'testing',
    capability: 'unit-test',
    tags: ['test', 'unit-test'],
    instructions: 'Run the test suite and report results.',
    examples: ['Run tests for module X'],
  };

  const anotherSkill: SkillStandard = {
    name: 'data-analysis',
    description: 'Analyze data and generate insights',
    version: '2.0.0',
    domain: 'analytics',
    capability: 'data-processing',
    tags: ['data', 'analytics', 'reporting'],
    instructions: 'Process the input data and generate analysis report.',
    dependencies: ['test-skill'],
  };

  beforeEach(() => {
    registry = new SkillRegistry({
      maxSkills: 50,
      enableAliases: true,
    });
  });

  // ===========================================================================
  // 技能注册
  // ===========================================================================

  describe('register()', () => {
    it('should register a skill successfully', () => {
      const registered = registry.register(sampleSkill, 'built-in');
      expect(registered.standard.name).toBe('test-skill');
      expect(registered.source).toBe('built-in');
      expect(registered.useCount).toBe(0);
      expect(registry.size).toBe(1);
    });

    it('should throw on invalid skill standard', () => {
      const invalidSkill = { ...sampleSkill, name: '' };
      expect(() => registry.register(invalidSkill)).toThrow();
    });

    it('should update existing skill on re-register', () => {
      registry.register(sampleSkill);
      const updated = { ...sampleSkill, version: '2.0.0' };
      registry.register(updated);
      expect(registry.size).toBe(1);
      expect(registry.getSkill('test-skill')?.standard.version).toBe('2.0.0');
    });

    it('should enforce max skill limit', () => {
      const smallRegistry = new SkillRegistry({ maxSkills: 1 });
      smallRegistry.register(sampleSkill);
      expect(() => smallRegistry.register(anotherSkill)).toThrow('Maximum skill limit');
    });

    it('should register from markdown', () => {
      const markdown = `---
name: md-skill
description: A skill from markdown
version: 1.0.0
tags:
  - markdown
---

## Instructions

Do something useful.
`;
      const registered = registry.registerFromMarkdown(markdown);
      expect(registered.standard.name).toBe('md-skill');
      expect(registered.standard.instructions).toContain('Do something useful');
    });
  });

  // ===========================================================================
  // 技能注销
  // ===========================================================================

  describe('unregister()', () => {
    it('should unregister an existing skill', () => {
      registry.register(sampleSkill);
      expect(registry.unregister('test-skill')).toBe(true);
      expect(registry.size).toBe(0);
    });

    it('should return false for non-existent skill', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should also remove associated commands', () => {
      registry.register(sampleSkill);
      registry.unregister('test-skill');
      // Command should also be gone
      const parsed = registry.parseCommand('/test-skill');
      expect(parsed.error).toBeDefined();
    });
  });

  // ===========================================================================
  // 斜杠命令解析
  // ===========================================================================

  describe('parseCommand()', () => {
    beforeEach(() => {
      registry.register(sampleSkill);
    });

    it('should detect non-command input', () => {
      const result = registry.parseCommand('just a regular message');
      expect(result.isCommand).toBe(false);
    });

    it('should parse simple slash command', () => {
      const result = registry.parseCommand('/test-skill');
      expect(result.isCommand).toBe(true);
      expect(result.commandName).toBe('test-skill');
      expect(result.skillName).toBe('test-skill');
    });

    it('should parse command with arguments', () => {
      const result = registry.parseCommand('/test-skill arg1 arg2');
      expect(result.isCommand).toBe(true);
      expect(result.rawArgs).toBe('arg1 arg2');
    });

    it('should parse --key=value arguments', () => {
      const result = registry.parseCommand('/test-skill --format=json --verbose=true');
      expect(result.isCommand).toBe(true);
      expect(result.args.format).toBe('json');
      expect(result.args.verbose).toBe('true');
    });

    it('should handle unknown commands', () => {
      const result = registry.parseCommand('/unknown-cmd');
      expect(result.isCommand).toBe(true);
      expect(result.error).toContain('Unknown command');
    });

    it('should support command aliases', () => {
      // Register a command with aliases
      registry.registerCommand({
        name: 'test-skill',
        skillName: 'test-skill',
        description: 'Test',
        aliases: ['ts', 'test'],
      });

      const result = registry.parseCommand('/ts some args');
      expect(result.isCommand).toBe(true);
      expect(result.commandName).toBe('test-skill');
    });
  });

  // ===========================================================================
  // 命令执行
  // ===========================================================================

  describe('executeCommand()', () => {
    it('should execute a command with executor', async () => {
      const mockExecutor: SkillExecutor = async (input) => ({
        success: true,
        output: `Executed: ${input}`,
        latencyMs: 0,
      });

      registry.register(sampleSkill, 'built-in', mockExecutor);
      const result = await registry.executeCommand('/test-skill hello world');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Executed');
    });

    it('should fail for skill without executor', async () => {
      registry.register(sampleSkill);
      const result = await registry.executeCommand('/test-skill hello');
      expect(result.success).toBe(false);
      expect(result.error).toContain('no executor');
    });

    it('should track usage count', async () => {
      const mockExecutor: SkillExecutor = async () => ({
        success: true,
        output: 'done',
        latencyMs: 0,
      });

      registry.register(sampleSkill, 'built-in', mockExecutor);
      await registry.executeCommand('/test-skill run1');
      await registry.executeCommand('/test-skill run2');

      const skill = registry.getSkill('test-skill');
      expect(skill?.useCount).toBe(2);
      expect(skill?.lastUsedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // 搜索
  // ===========================================================================

  describe('search()', () => {
    beforeEach(() => {
      registry.register(sampleSkill);
      registry.register(anotherSkill);
    });

    it('should find skills by name', () => {
      const results = registry.search('test');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skill.standard.name).toBe('test-skill');
    });

    it('should find skills by description', () => {
      const results = registry.search('analyze data');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find skills by tag', () => {
      const results = registry.search('analytics');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by domain', () => {
      const results = registry.search('', { domain: 'testing' });
      expect(results.length).toBe(1);
      expect(results[0].skill.standard.domain).toBe('testing');
    });

    it('should sort by relevance', () => {
      const results = registry.search('test-skill');
      // Name match should score higher than description match
      expect(results[0].skill.standard.name).toBe('test-skill');
    });

    it('should respect limit', () => {
      const results = registry.search('', { limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 依赖解析
  // ===========================================================================

  describe('resolveDependencies()', () => {
    it('should resolve simple dependency chain', () => {
      registry.register(sampleSkill);
      registry.register(anotherSkill);
      
      const chain = registry.resolveDependencies('data-analysis');
      expect(chain).toEqual(['test-skill', 'data-analysis']);
    });

    it('should detect circular dependencies', () => {
      const skillA: SkillStandard = {
        name: 'skill-a',
        description: 'A',
        version: '1.0.0',
        instructions: 'Do A',
        dependencies: ['skill-b'],
      };
      const skillB: SkillStandard = {
        name: 'skill-b',
        description: 'B',
        version: '1.0.0',
        instructions: 'Do B',
        dependencies: ['skill-a'],
      };

      registry.register(skillA);
      registry.register(skillB);

      expect(() => registry.resolveDependencies('skill-a')).toThrow('Circular dependency');
    });

    it('should report missing dependencies', () => {
      registry.register(anotherSkill); // depends on test-skill which is not registered
      
      const { canExecute, missingDeps } = registry.canExecute('data-analysis');
      expect(canExecute).toBe(false);
      expect(missingDeps).toContain('test-skill');
    });
  });

  // ===========================================================================
  // 状态导出
  // ===========================================================================

  describe('exportState()', () => {
    it('should export registry state', () => {
      registry.register(sampleSkill);
      const state = registry.exportState();
      
      expect(state.skills.length).toBe(1);
      expect(state.skills[0].name).toBe('test-skill');
      expect(state.stats.totalSkills).toBe(1);
    });

    it('should clear registry', () => {
      registry.register(sampleSkill);
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});
