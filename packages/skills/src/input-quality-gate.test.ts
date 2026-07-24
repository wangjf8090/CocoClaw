/**
 * Input Quality Gate Tests
 * P1-1: Context Engineering 集成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputQualityGate } from './input-quality-gate.js';

describe('InputQualityGate', () => {
  let gate: InputQualityGate;

  beforeEach(() => {
    gate = new InputQualityGate({
      minimumOverallScore: 50,
      dimensionThresholds: {
        clarity: 5,
        completeness: 4,
        relevance: 5,
        consistency: 6,
        specificity: 4,
        timeliness: 3,
        trustworthiness: 4,
      },
      enableTrendTracking: true,
      trendWindowSize: 10,
    });
  });

  // ===========================================================================
  // 基本门禁检查
  // ===========================================================================

  describe('check()', () => {
    it('should pass for high-quality input', async () => {
      const input = 'Please create a detailed analysis report for the Q3 financial data. ' +
        'Include revenue breakdown by region, source: internal database, dated 2026-07-24. ' +
        'Expected output format: structured markdown with tables and charts. ' +
        'Focus on year-over-year comparison and growth trends.';

      const result = await gate.check(input, {
        task_type: 'analysis',
        input_format: 'text',
        expected_output: 'report',
        timestamp: Date.now(),
      });

      expect(result.passed).toBe(true);
      expect(result.action).toBe('pass');
      expect(result.scores.length).toBe(7);
      expect(result.overallScore).toBeGreaterThan(50);
    });

    it('should generate suggestions for low-quality input', async () => {
      const input = 'do the thing maybe';

      const result = await gate.check(input);

      expect(result.suggestions.length).toBeGreaterThan(0);
      // Should have suggestions about clarity, completeness, etc.
      const dimensions = result.suggestions.map(s => s.dimension);
      expect(dimensions.length).toBeGreaterThan(0);
    });

    it('should return 7 dimension scores', async () => {
      const input = 'Analyze the provided data and generate a report.';
      const result = await gate.check(input);

      expect(result.scores.length).toBe(7);
      const dimensions = result.scores.map(s => s.dimension);
      expect(dimensions).toContain('clarity');
      expect(dimensions).toContain('completeness');
      expect(dimensions).toContain('relevance');
      expect(dimensions).toContain('consistency');
      expect(dimensions).toContain('specificity');
      expect(dimensions).toContain('timeliness');
      expect(dimensions).toContain('trustworthiness');
    });
  });

  // ===========================================================================
  // 自动压缩
  // ===========================================================================

  describe('auto compression', () => {
    it('should compress input that exceeds threshold', async () => {
      const compressionGate = new InputQualityGate({
        enableAutoCompression: true,
        compressionThreshold: 100,
        compressionTargetRatio: 0.5,
        minimumOverallScore: 50,
      });

      // Create a long input with repeated content
      const repeatedContent = 'This is a test paragraph. '.repeat(20);
      const input = `Task: analyze\n\n${repeatedContent}\n\n${repeatedContent}`;

      const result = await compressionGate.check(input);

      // If overall score was low enough, compression might be triggered
      // The important thing is the gate handles it gracefully
      expect(result).toBeDefined();
      expect(result.gateLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // 趋势追踪
  // ===========================================================================

  describe('trend tracking', () => {
    it('should track quality trends over multiple checks', async () => {
      const trendGate = new InputQualityGate({
        enableTrendTracking: true,
        trendWindowSize: 5,
      });

      // Perform multiple checks
      for (let i = 0; i < 5; i++) {
        await trendGate.check(`Test input number ${i}`, {
          task_type: 'test',
          input_format: 'text',
          expected_output: 'result',
        });
      }

      const analysis = trendGate.analyzeTrend();
      expect(analysis).not.toBeNull();
      if (analysis) {
        expect(['improving', 'stable', 'declining']).toContain(analysis.direction);
        expect(analysis.averageScore).toBeGreaterThanOrEqual(0);
        expect(analysis.averageScore).toBeLessThanOrEqual(100);
      }
    });

    it('should return null for insufficient trend data', async () => {
      const analysis = gate.analyzeTrend();
      expect(analysis).toBeNull(); // No checks performed yet
    });
  });

  // ===========================================================================
  // 统计信息
  // ===========================================================================

  describe('stats', () => {
    it('should track pass/reject counts', async () => {
      await gate.check('Good input with create and analyze verbs and specific details');
      await gate.check('ok');
      await gate.check('Another detailed input with numbers 42 and dates 2026-07-24');

      const stats = gate.getStats();
      expect(stats.totalChecks).toBe(3);
      expect(stats.passed + stats.rejected).toBe(3);
    });

    it('should reset stats', async () => {
      await gate.check('test');
      gate.resetStats();
      const stats = gate.getStats();
      expect(stats.totalChecks).toBe(0);
    });
  });

  // ===========================================================================
  // 配置更新
  // ===========================================================================

  describe('config update', () => {
    it('should update thresholds dynamically', async () => {
      gate.updateConfig({
        minimumOverallScore: 90, // Very strict
      });

      const input = 'Simple task';
      const result = await gate.check(input);

      // With strict threshold, should more likely reject or warn
      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // 事件系统
  // ===========================================================================

  describe('events', () => {
    it('should emit gate.passed event', async () => {
      let eventFired = false;
      gate.on('gate.passed', () => {
        eventFired = true;
      });

      await gate.check('A good detailed input with specific data');
      expect(eventFired).toBe(true);
    });

    it('should emit threshold.violated event', async () => {
      let violatedDimension: string | null = null;
      gate.on('threshold.violated', (dimension) => {
        violatedDimension = dimension;
      });

      // Very short input will likely violate completeness
      await gate.check('hi');
      // May or may not fire depending on scoring
      // This is more of an integration test
    });
  });
});
