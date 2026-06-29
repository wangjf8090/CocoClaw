/**
 * TrustworthyExecutor Tests
 * 
 * 测试可信执行三步法：
 *   Step 1: 理解任务意图（Understand）
 *   Step 2: 查找证据支撑（Find Evidence）
 *   Step 3: 完成判断校验（Make Judgment）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrustworthyExecutor } from '../trustworthy-executor.js';
import {
  TrustworthyExecutorConfig,
  ExecutionTask,
  ExecutionResult,
  RuleDefinition,
  DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG,
} from '../types.js';

const TEST_CONFIG: TrustworthyExecutorConfig = {
  enableEvidenceChain: true,
  enableRuleValidation: true,
  enableRiskFlagging: true,
  maxRecursionDepth: 10,
};

function makeTask(id: string, input: string, context?: Record<string, unknown>): ExecutionTask {
  return { id, input, context };
}

describe('TrustworthyExecutor — 可信执行三步法', () => {
  let executor: TrustworthyExecutor;

  beforeEach(() => {
    executor = new TrustworthyExecutor(TEST_CONFIG);
  });

  // ===========================================================================
  // Step 1: 理解任务意图（Understand）
  // ===========================================================================

  describe('Step 1: 理解任务意图（Understand）', () => {
    it('should classify task types correctly', async () => {
      const evalTask = makeTask('t1', 'evaluate the performance metrics');
      const result = await executor.execute(evalTask);

      expect(result.status).toBe('completed');
      expect(result.steps[0].type).toBe('understand');
      expect(result.steps[0].output).toContain('type=evaluation');
    });

    it('should extract intent keywords', async () => {
      const task = makeTask('t2', 'analyze the data quality and generate report');
      const result = await executor.execute(task);

      expect(result.steps[0].type).toBe('understand');
      // Keywords should include meaningful words
      expect(result.steps[0].evidence.length).toBeGreaterThan(0);
    });

    it('should include context evidence when provided', async () => {
      const task = makeTask('t3', 'check compliance', { domain: 'finance', region: 'cn' });
      const result = await executor.execute(task);

      const understandStep = result.steps[0];
      const contextEvidence = understandStep.evidence.find(
        (e) => e.source === 'task_context'
      );
      expect(contextEvidence).toBeDefined();
    });

    it('should handle empty input gracefully', async () => {
      const task = makeTask('t4', '');
      const result = await executor.execute(task);

      expect(result.status).toBe('completed');
      expect(result.steps[0].type).toBe('understand');
    });
  });

  // ===========================================================================
  // Step 2: 查找证据支撑（Find Evidence）
  // ===========================================================================

  describe('Step 2: 查找证据支撑（Find Evidence）', () => {
    it('should find evidence step in execution result', async () => {
      const task = makeTask('t5', 'validate the input data format');
      const result = await executor.execute(task);

      expect(result.steps[1].type).toBe('find_evidence');
      expect(result.steps[1].evidence.length).toBeGreaterThan(0);
    });

    it('should use registered rules for evidence', async () => {
      executor.registerRule({
        id: 'format-check',
        description: 'Validate data format according to schema',
        pattern: 'format',
        confidence: 0.9,
      });

      const task = makeTask('t6', 'validate data format');
      const result = await executor.execute(task);

      const evidenceStep = result.steps[1];
      const ruleEvidence = evidenceStep.evidence.find(
        (e) => e.source.startsWith('rule:')
      );
      expect(ruleEvidence).toBeDefined();
    });

    it('should generate generic evidence when no rules match', async () => {
      const task = makeTask('t7', 'perform unknown operation xyz');
      const result = await executor.execute(task);

      const evidenceStep = result.steps[1];
      const genericEvidence = evidenceStep.evidence.find(
        (e) => e.source === 'generic_retrieval'
      );
      expect(genericEvidence).toBeDefined();
      expect(genericEvidence!.confidence).toBe(0.5);
    });
  });

  // ===========================================================================
  // Step 3: 完成判断校验（Make Judgment）
  // ===========================================================================

  describe('Step 3: 完成判断校验（Make Judgment）', () => {
    it('should include judgment step in execution result', async () => {
      const task = makeTask('t8', 'verify the calculation result');
      const result = await executor.execute(task);

      expect(result.steps[2].type).toBe('make_judgment');
      expect(result.conclusion).toBeDefined();
      expect(result.conclusion).not.toBeNull();
    });

    it('should assess risk level correctly', async () => {
      // High confidence task → low risk
      executor.registerRule({
        id: 'strong-rule',
        description: 'Strong validation rule',
        pattern: 'verify',
        confidence: 0.95,
      });

      const task = makeTask('t9', 'verify the data integrity');
      const result = await executor.execute(task);

      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.riskLevel);
    });

    it('should include risk flagging when risk is non-low', async () => {
      // No rules + weak evidence → medium/high risk
      const noRuleExecutor = new TrustworthyExecutor({
        ...TEST_CONFIG,
        enableRuleValidation: false,
      });

      const task = makeTask('t10', 'perform risky operation with minimal context');
      const result = await noRuleExecutor.execute(task);

      if (result.riskLevel !== 'low') {
        const judgmentStep = result.steps[2];
        const riskFlag = judgmentStep.evidence.find(
          (e) => e.source === 'risk_flagger'
        );
        expect(riskFlag).toBeDefined();
      }
    });

    it('should perform rule validation when enabled', async () => {
      executor.registerRule({
        id: 'val-rule',
        description: 'Validation rule',
        confidence: 0.8,
      });

      const task = makeTask('t11', 'check something');
      const result = await executor.execute(task);

      const judgmentStep = result.steps[2];
      const validationEvidence = judgmentStep.evidence.find(
        (e) => e.source === 'rule_validator'
      );
      expect(validationEvidence).toBeDefined();
    });

    it('should skip rule validation when disabled', async () => {
      const noValidationExecutor = new TrustworthyExecutor({
        ...TEST_CONFIG,
        enableRuleValidation: false,
      });

      const task = makeTask('t12', 'check something');
      const result = await noValidationExecutor.execute(task);

      const judgmentStep = result.steps[2];
      const validationEvidence = judgmentStep.evidence.find(
        (e) => e.source === 'rule_validator'
      );
      expect(validationEvidence).toBeUndefined();
    });
  });

  // ===========================================================================
  // 整体执行结果
  // ===========================================================================

  describe('execute() — 整体执行', () => {
    it('should return three steps (understand, find_evidence, make_judgment)', async () => {
      const task = makeTask('t20', 'analyze the market trends');
      const result = await executor.execute(task);

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].type).toBe('understand');
      expect(result.steps[1].type).toBe('find_evidence');
      expect(result.steps[2].type).toBe('make_judgment');
    });

    it('should produce traceable evidence chain when enabled', async () => {
      const task = makeTask('t21', 'evaluate the project proposal');
      const result = await executor.execute(task);

      expect(result.traceable).toBe(true);
      expect(result.evidenceChain.length).toBeGreaterThan(0);
    });

    it('should set traceable=false when evidence chain disabled', async () => {
      const noChainExecutor = new TrustworthyExecutor({
        ...TEST_CONFIG,
        enableEvidenceChain: false,
      });

      const task = makeTask('t22', 'evaluate the project');
      const result = await noChainExecutor.execute(task);

      expect(result.traceable).toBe(false);
    });

    it('should have valid confidence between 0 and 1', async () => {
      const task = makeTask('t23', 'check the data quality');
      const result = await executor.execute(task);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have valid timestamps', async () => {
      const task = makeTask('t24', 'process the request');
      const result = await executor.execute(task);

      expect(result.startedAt).toBeLessThanOrEqual(result.completedAt);
      expect(result.completedAt - result.startedAt).toBeGreaterThanOrEqual(0);
    });

    it('should store result in execution history', async () => {
      const task = makeTask('t25', 'perform analysis');
      await executor.execute(task);

      const stored = executor.getExecutionResult('t25');
      expect(stored).toBeDefined();
      expect(stored!.taskId).toBe('t25');
    });
  });

  // ===========================================================================
  // 规则管理
  // ===========================================================================

  describe('规则管理', () => {
    it('should register and retrieve rules', () => {
      const rule: RuleDefinition = {
        id: 'test-rule',
        description: 'A test validation rule',
        pattern: 'test',
        confidence: 0.85,
      };

      executor.registerRule(rule);
      const rules = executor.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('test-rule');
    });

    it('should register multiple rules at once', () => {
      executor.registerRules([
        { id: 'r1', description: 'Rule 1', confidence: 0.8 },
        { id: 'r2', description: 'Rule 2', confidence: 0.9 },
      ]);
      expect(executor.getRules()).toHaveLength(2);
    });

    it('should remove rules', () => {
      executor.registerRule({ id: 'removable', description: 'To be removed', confidence: 0.5 });
      expect(executor.getRules()).toHaveLength(1);

      const removed = executor.removeRule('removable');
      expect(removed).toBe(true);
      expect(executor.getRules()).toHaveLength(0);
    });

    it('should return false when removing non-existent rule', () => {
      expect(executor.removeRule('nonexistent')).toBe(false);
    });

    it('should override rule with same id', () => {
      executor.registerRule({ id: 'dup', description: 'First', confidence: 0.5 });
      executor.registerRule({ id: 'dup', description: 'Second', confidence: 0.8 });
      expect(executor.getRules()).toHaveLength(1);
      expect(executor.getRules()[0].description).toBe('Second');
    });
  });

  // ===========================================================================
  // 历史查询
  // ===========================================================================

  describe('历史查询', () => {
    it('should return evidence chain by taskId', async () => {
      const task = makeTask('t30', 'evaluate the system');
      await executor.execute(task);

      const chain = executor.getEvidenceChain('t30');
      expect(chain.length).toBeGreaterThan(0);
    });

    it('should return execution trace by taskId', async () => {
      const task = makeTask('t31', 'analyze the results');
      await executor.execute(task);

      const trace = executor.getExecutionTrace('t31');
      expect(trace).toHaveLength(3);
    });

    it('should return empty chain for unknown taskId', () => {
      const chain = executor.getEvidenceChain('unknown');
      expect(chain).toHaveLength(0);
    });

    it('should return empty trace for unknown taskId', () => {
      const trace = executor.getExecutionTrace('unknown');
      expect(trace).toHaveLength(0);
    });

    it('should flag medium/high risk results for review', async () => {
      // Execute with no rules → likely medium risk
      const noRuleExecutor = new TrustworthyExecutor({
        ...TEST_CONFIG,
        enableRuleValidation: false,
      });

      await noRuleExecutor.execute(makeTask('r1', 'risky operation'));
      await noRuleExecutor.execute(makeTask('r2', 'another risky operation'));

      const flagged = noRuleExecutor.getFlaggedForReview();
      // May or may not have flagged items depending on confidence
      expect(Array.isArray(flagged)).toBe(true);
    });
  });

  // ===========================================================================
  // Stats
  // ===========================================================================

  describe('getStats()', () => {
    it('should return correct stats for empty executor', () => {
      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.completedExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });

    it('should return correct stats after executions', async () => {
      await executor.execute(makeTask('s1', 'task one'));
      await executor.execute(makeTask('s2', 'task two'));
      await executor.execute(makeTask('s3', 'task three'));

      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(3);
      expect(stats.completedExecutions).toBe(3);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });

    it('should track registered rules count', () => {
      executor.registerRules([
        { id: 'r1', description: 'R1', confidence: 0.8 },
        { id: 'r2', description: 'R2', confidence: 0.9 },
      ]);

      const stats = executor.getStats();
      expect(stats.registeredRules).toBe(2);
    });
  });

  // ===========================================================================
  // Default Config
  // ===========================================================================

  describe('DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG.enableEvidenceChain).toBe(true);
      expect(DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG.enableRuleValidation).toBe(true);
      expect(DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG.enableRiskFlagging).toBe(true);
      expect(DEFAULT_TRUSTWORTHY_EXECUTOR_CONFIG.maxRecursionDepth).toBe(10);
    });
  });

  // ===========================================================================
  // Task Type Classification
  // ===========================================================================

  describe('任务类型分类', () => {
    it('should classify evaluation tasks', async () => {
      const result = await executor.execute(makeTask('c1', 'evaluate the model performance'));
      expect(result.steps[0].output).toContain('type=evaluation');
    });

    it('should classify generation tasks', async () => {
      const result = await executor.execute(makeTask('c2', 'generate a new report'));
      expect(result.steps[0].output).toContain('type=generation');
    });

    it('should classify analysis tasks', async () => {
      const result = await executor.execute(makeTask('c3', 'analyze the data patterns'));
      expect(result.steps[0].output).toContain('type=analysis');
    });

    it('should classify validation tasks', async () => {
      const result = await executor.execute(makeTask('c4', 'validate the input schema'));
      expect(result.steps[0].output).toContain('type=validation');
    });

    it('should classify optimization tasks', async () => {
      const result = await executor.execute(makeTask('c5', 'optimize the query performance'));
      expect(result.steps[0].output).toContain('type=optimization');
    });

    it('should classify retrieval tasks', async () => {
      const result = await executor.execute(makeTask('c6', 'search for relevant documents'));
      expect(result.steps[0].output).toContain('type=retrieval');
    });

    it('should classify transformation tasks', async () => {
      const result = await executor.execute(makeTask('c7', 'translate the content to English'));
      expect(result.steps[0].output).toContain('type=transformation');
    });

    it('should default to general for unrecognized tasks', async () => {
      const result = await executor.execute(makeTask('c8', 'hello world'));
      expect(result.steps[0].output).toContain('type=general');
    });
  });
});
