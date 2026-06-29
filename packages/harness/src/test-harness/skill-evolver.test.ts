/**
 * SkillEvolver Tests
 * 
 * 测试四层递进式反馈机制：
 *   Layer 1: 复核判例（Case Review）
 *   Layer 2: 标准演进层（Standard Evolution）
 *   Layer 3: 评审思维链（Chain Review）
 *   Layer 4: 智慧模型层（Wisdom Model）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillEvolver } from '../skill-evolver.js';
import {
  SkillEvolverConfig,
  SkillCaseReview,
  SkillContext,
  DEFAULT_SKILL_EVOLVER_CONFIG,
  EvolutionCircuitType,
  EvolutionStatus,
} from '../types.js';

const TEST_CONFIG: SkillEvolverConfig = {
  caseWindow: 100,
  standardThreshold: 5,
  chainDepth: 3,
};

function makeCase(
  skillId: string,
  success: boolean,
  errorType?: SkillCaseReview['errorType'],
  timestamp?: Date
): SkillCaseReview {
  return {
    skillId,
    timestamp: timestamp ?? new Date(),
    success,
    errorType: success ? undefined : errorType,
    context: { environment: 'test' },
  };
}

describe('SkillEvolver — 四层递进式反馈机制', () => {
  let evolver: SkillEvolver;

  beforeEach(() => {
    evolver = new SkillEvolver(TEST_CONFIG);
  });

  // ===========================================================================
  // Layer 1: 复核判例（Case Review）
  // ===========================================================================

  describe('Layer 1: 复核判例（Case Review）', () => {
    it('should record a single case review', () => {
      evolver.recordCaseReview(makeCase('skill-a', true));
      const db = evolver.getCaseDatabase();
      expect(db).toHaveLength(1);
      expect(db[0].skillId).toBe('skill-a');
      expect(db[0].success).toBe(true);
    });

    it('should record multiple case reviews', () => {
      evolver.recordCaseReviews([
        makeCase('skill-a', true),
        makeCase('skill-b', false, 'format'),
        makeCase('skill-c', false, 'runtime'),
      ]);
      const db = evolver.getCaseDatabase();
      expect(db).toHaveLength(3);
    });

    it('should respect caseWindow limit', () => {
      const smallEvolver = new SkillEvolver({ ...TEST_CONFIG, caseWindow: 5 });
      for (let i = 0; i < 10; i++) {
        smallEvolver.recordCaseReview(makeCase(`skill-${i}`, true));
      }
      const db = smallEvolver.getCaseDatabase();
      expect(db).toHaveLength(5);
    });

    it('should track error type counts for failed cases', () => {
      evolver.recordCaseReviews([
        makeCase('s1', false, 'format'),
        makeCase('s2', false, 'format'),
        makeCase('s3', false, 'runtime'),
        makeCase('s4', true),
      ]);
      const stats = evolver.getStats();
      expect(stats.errorTypeDistribution['format']).toBe(2);
      expect(stats.errorTypeDistribution['runtime']).toBe(1);
    });
  });

  // ===========================================================================
  // Layer 2: 标准演进层（Standard Evolution）
  // ===========================================================================

  describe('Layer 2: 标准演进层（Standard Evolution）', () => {
    it('should detect when standard evolution should be triggered', () => {
      for (let i = 0; i < 5; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format'));
      }
      expect(evolver.shouldEvolveStandard('format')).toBe(true);
    });

    it('should not trigger standard evolution below threshold', () => {
      for (let i = 0; i < 4; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format'));
      }
      expect(evolver.shouldEvolveStandard('format')).toBe(false);
    });

    it('should produce standard evolution changes in evolve()', async () => {
      // Record 5 format errors to exceed threshold
      for (let i = 0; i < 5; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format'));
      }

      const ctx: SkillContext = { skillId: 's' };
      const result = await evolver.evolve(ctx);

      // Should have standard evolution changes
      const stdChanges = result.changes.filter((c) =>
        c.target.startsWith('skill.standard.')
      );
      expect(stdChanges.length).toBeGreaterThan(0);

      // Standards should be recorded
      const standards = evolver.getStandards();
      expect(standards.length).toBeGreaterThan(0);
      expect(standards[0].errorType).toBe('format');
    });

    it('should reset error counter after standard evolution', async () => {
      for (let i = 0; i < 5; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format'));
      }

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      // Counter should be reset
      expect(evolver.shouldEvolveStandard('format')).toBe(false);
    });
  });

  // ===========================================================================
  // Layer 3: 评审思维链（Chain Review）
  // ===========================================================================

  describe('Layer 3: 评审思维链（Chain Review）', () => {
    it('should generate chain-of-thought analyses for failed cases', async () => {
      evolver.recordCaseReviews([
        makeCase('s1', false, 'format', new Date('2026-01-01')),
        makeCase('s2', false, 'dependency', new Date('2026-01-02')),
        makeCase('s3', false, 'runtime', new Date('2026-01-03')),
      ]);

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const chains = evolver.getChainAnalyses();
      expect(chains.length).toBeGreaterThan(0);
      // Chain depth should match config
      expect(chains[0].depth).toBeGreaterThanOrEqual(1);
      expect(chains[0].depth).toBeLessThanOrEqual(TEST_CONFIG.chainDepth);
    });

    it('should produce structure changes for each depth level', async () => {
      evolver.recordCaseReviews([
        makeCase('s1', false, 'format'),
        makeCase('s2', false, 'runtime'),
      ]);

      const ctx: SkillContext = { skillId: 's' };
      const result = await evolver.evolve(ctx);

      const chainChanges = result.changes.filter((c) =>
        c.target.includes('chainOfThought')
      );
      expect(chainChanges.length).toBeGreaterThan(0);
    });

    it('should not generate chains when all cases succeed', async () => {
      evolver.recordCaseReviews([
        makeCase('s1', true),
        makeCase('s2', true),
      ]);

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const chains = evolver.getChainAnalyses();
      expect(chains).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Layer 4: 智慧模型层（Wisdom Model）
  // ===========================================================================

  describe('Layer 4: 智慧模型层（Wisdom Model）', () => {
    it('should not generate predictions with insufficient data', async () => {
      // Only 5 cases (< 10 threshold)
      for (let i = 0; i < 5; i++) {
        evolver.recordCaseReview(makeCase('s', true));
      }

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const predictions = evolver.getWisdomPredictions();
      // Should not have warning/improvement predictions (may have dominant error prediction)
      const trendPredictions = predictions.filter(
        (p) => p.type === 'warning' || p.type === 'improvement'
      );
      expect(trendPredictions).toHaveLength(0);
    });

    it('should detect declining success rate and generate warning', async () => {
      // 15 successes (early)
      for (let i = 0; i < 15; i++) {
        evolver.recordCaseReview(makeCase('s', true, undefined, new Date('2026-01-01')));
      }
      // 15 failures (recent) → recent success rate drops
      for (let i = 0; i < 15; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'runtime', new Date('2026-01-02')));
      }

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const predictions = evolver.getWisdomPredictions();
      const warnings = predictions.filter((p) => p.type === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].suggestedActions.length).toBeGreaterThan(0);
    });

    it('should detect improving success rate', async () => {
      // 10 failures (early)
      for (let i = 0; i < 10; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format', new Date('2026-01-01')));
      }
      // 20 successes (recent) → recent success rate improves
      for (let i = 0; i < 20; i++) {
        evolver.recordCaseReview(makeCase('s', true, undefined, new Date('2026-01-02')));
      }

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const predictions = evolver.getWisdomPredictions();
      const improvements = predictions.filter((p) => p.type === 'improvement');
      expect(improvements.length).toBeGreaterThan(0);
    });

    it('should generate dominant error prediction', async () => {
      // Need >= 10 cases and errors to trigger dominant prediction
      for (let i = 0; i < 12; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'runtime'));
      }

      const ctx: SkillContext = { skillId: 's' };
      await evolver.evolve(ctx);

      const predictions = evolver.getWisdomPredictions();
      const pred = predictions.filter((p) => p.type === 'prediction');
      expect(pred.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 主 evolve() 方法
  // ===========================================================================

  describe('evolve() — 整体进化', () => {
    it('should return EvolutionResult with SKILL circuit type', async () => {
      const ctx: SkillContext = { skillId: 'test-skill' };
      const result = await evolver.evolve(ctx);

      expect(result.circuit).toBe(EvolutionCircuitType.SKILL);
      expect(result.status).toBe(EvolutionStatus.COMPLETED);
      expect(result.changes).toBeDefined();
      expect(Array.isArray(result.changes)).toBe(true);
      expect(result.startedAt).toBeLessThanOrEqual(result.completedAt);
    });

    it('should use version from context when provided', async () => {
      const ctx: SkillContext = { skillId: 's', version: '2.0.0' };
      const result = await evolver.evolve(ctx);
      expect(result.version).toBe('2.0.0');
    });

    it('should default version to 1.0.0 when not provided', async () => {
      const ctx: SkillContext = { skillId: 's' };
      const result = await evolver.evolve(ctx);
      expect(result.version).toBe('1.0.0');
    });

    it('should produce changes across all four layers with failures', async () => {
      // Record failures to trigger all layers
      for (let i = 0; i < 8; i++) {
        evolver.recordCaseReview(makeCase('s', false, 'format'));
      }
      for (let i = 0; i < 12; i++) {
        evolver.recordCaseReview(makeCase('s', true));
      }

      const ctx: SkillContext = { skillId: 's' };
      const result = await evolver.evolve(ctx);

      // Should have changes from multiple layers
      expect(result.changes.length).toBeGreaterThan(0);

      // Check layer types exist
      const changeTypes = new Set(result.changes.map((c) => c.type));
      expect(changeTypes.has('rule')).toBe(true); // Layer 1 & 2
    });
  });

  // ===========================================================================
  // Stats & applyChanges
  // ===========================================================================

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      evolver.recordCaseReviews([
        makeCase('s1', true),
        makeCase('s2', false, 'format'),
        makeCase('s3', false, 'runtime'),
        makeCase('s4', true),
      ]);

      const stats = evolver.getStats();
      expect(stats.totalCases).toBe(4);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(2);
      expect(stats.successRate).toBeCloseTo(0.5, 2);
    });

    it('should return zero stats for empty evolver', () => {
      const stats = evolver.getStats();
      expect(stats.totalCases).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('applyChanges()', () => {
    it('should apply changes without error', () => {
      expect(() => {
        evolver.applyChanges([
          {
            id: 'test-change',
            type: 'rule',
            target: 'skill.test',
            oldValue: 'old',
            newValue: 'new',
            confidence: 0.9,
            reason: 'test',
            rollbackable: true,
          },
        ]);
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // Default Config
  // ===========================================================================

  describe('DEFAULT_SKILL_EVOLVER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SKILL_EVOLVER_CONFIG.caseWindow).toBe(100);
      expect(DEFAULT_SKILL_EVOLVER_CONFIG.standardThreshold).toBe(5);
      expect(DEFAULT_SKILL_EVOLVER_CONFIG.chainDepth).toBe(3);
    });
  });
});
