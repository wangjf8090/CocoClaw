/**
 * PerformanceEvolver Token Saving Metrics Tests
 * 
 * 测试 Token 节省可观测 Dashboard 功能
 * 对标 DuMate 75% Token 降耗工业级基准
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceEvolver } from '../performance-evolver.js';
import { PerformanceEvolverConfig } from '../types.js';

const DEFAULT_CONFIG: PerformanceEvolverConfig = {
  autoTuneContextWindow: true,
  autoOptimizeCacheStrategy: true,
  autoTuneParallelism: true,
  tokenUsageOptimization: true,
  targetLatencyMs: 1000,
  compressionThreshold: 0.7,
};

describe('PerformanceEvolver - Token Saving Metrics (M2 P0 #1)', () => {
  let evolver: PerformanceEvolver;

  beforeEach(() => {
    evolver = new PerformanceEvolver(DEFAULT_CONFIG);
  });

  describe('recordBaseline()', () => {
    it('should record baseline tokens on first call', () => {
      evolver.recordBaseline(1000);
      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.baselineTokens).toBe(1000);
    });

    it('should override baseline on repeated calls', () => {
      evolver.recordBaseline(1000);
      evolver.recordBaseline(2000);
      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.baselineTokens).toBe(2000);
    });
  });

  describe('getTokenSavingMetrics()', () => {
    it('should return savingRatio = 0 when no baseline is set', () => {
      evolver.recordQueryStats(500, 100);
      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.savingRatio).toBe(0);
      expect(metrics.baselineTokens).toBe(0);
    });

    it('should return savingRatio = 0 when baseline = 0 (avoid division by zero)', () => {
      evolver.recordBaseline(0);
      evolver.recordQueryStats(500, 100);
      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.savingRatio).toBe(0);
    });

    it('should calculate savingRatio correctly when tokens decreased', () => {
      // Baseline: 1000 tokens
      evolver.recordBaseline(1000);
      // After optimization: 250 tokens per query
      evolver.recordQueryStats(250, 100);
      evolver.recordQueryStats(250, 100);
      evolver.recordQueryStats(250, 100);
      evolver.recordQueryStats(250, 100);

      const metrics = evolver.getTokenSavingMetrics();
      // savingRatio = (1000 - 250) / 1000 = 0.75
      expect(metrics.savingRatio).toBeCloseTo(0.75, 2);
      expect(metrics.currentTokensAvg).toBeCloseTo(250, 2);
      expect(metrics.sampleCount).toBe(4);
    });

    it('should calculate savingRatio correctly when tokens increased (negative saving)', () => {
      // Baseline: 1000 tokens
      evolver.recordBaseline(1000);
      // After regression: 1500 tokens per query
      evolver.recordQueryStats(1500, 100);

      const metrics = evolver.getTokenSavingMetrics();
      // savingRatio = (1000 - 1500) / 1000 = -0.5
      expect(metrics.savingRatio).toBeCloseTo(-0.5, 2);
      expect(metrics.currentTokensAvg).toBeCloseTo(1500, 2);
    });

    it('should return savingRatio = 0 when current equals baseline', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(1000, 100);

      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.savingRatio).toBe(0);
    });

    it('should calculate perToolSaving correctly', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(600, 100, {
        'tool-a': 400,
        'tool-b': 200,
      });

      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.perToolSaving).toBeDefined();
      expect(metrics.perToolSaving!['tool-a']).toBeDefined();
      expect(metrics.perToolSaving!['tool-b']).toBeDefined();
    });

    it('should update lastUpdatedAt on each query', () => {
      evolver.recordBaseline(1000);
      const before = Date.now() - 10;
      evolver.recordQueryStats(500, 100);
      const metrics = evolver.getTokenSavingMetrics();
      expect(metrics.lastUpdatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getDashboard()', () => {
    it('should return valid JSON structure', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(500, 100);
      evolver.recordCacheStats(0.8);

      const dashboard = evolver.getDashboard();

      // Check top-level structure
      expect(dashboard).toHaveProperty('stats');
      expect(dashboard).toHaveProperty('tokenSaving');
      expect(dashboard).toHaveProperty('currentSettings');
      expect(dashboard).toHaveProperty('suggestions');
      expect(dashboard).toHaveProperty('generatedAt');

      // Check stats structure
      expect(dashboard.stats).toHaveProperty('tokenUsageAvg');
      expect(dashboard.stats).toHaveProperty('latencyAvg');
      expect(dashboard.stats).toHaveProperty('cacheHitRate');
      expect(dashboard.stats).toHaveProperty('sampleCount');

      // Check tokenSaving structure
      expect(dashboard.tokenSaving).toHaveProperty('baselineTokens');
      expect(dashboard.tokenSaving).toHaveProperty('currentTokensAvg');
      expect(dashboard.tokenSaving).toHaveProperty('savingRatio');
      expect(dashboard.tokenSaving).toHaveProperty('sampleCount');
      expect(dashboard.tokenSaving).toHaveProperty('lastUpdatedAt');

      // Check currentSettings structure
      expect(dashboard.currentSettings).toHaveProperty('contextWindowSize');
      expect(dashboard.currentSettings).toHaveProperty('cacheSize');
      expect(dashboard.currentSettings).toHaveProperty('maxParallelism');
      expect(dashboard.currentSettings).toHaveProperty('compressionEnabled');

      // Suggestions should be an array
      expect(Array.isArray(dashboard.suggestions)).toBe(true);
    });

    it('should calculate tokenUsageAvg correctly', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(400, 100);
      evolver.recordQueryStats(600, 100);

      const dashboard = evolver.getDashboard();
      expect(dashboard.stats.tokenUsageAvg).toBeCloseTo(500, 2);
    });

    it('should calculate latencyAvg correctly', () => {
      evolver.recordQueryStats(500, 100);
      evolver.recordQueryStats(500, 200);

      const dashboard = evolver.getDashboard();
      expect(dashboard.stats.latencyAvg).toBeCloseTo(150, 2);
    });

    it('should reflect cacheHitRate in dashboard', () => {
      evolver.recordCacheStats(0.85);
      evolver.recordQueryStats(500, 100);

      const dashboard = evolver.getDashboard();
      expect(dashboard.stats.cacheHitRate).toBeCloseTo(0.85, 2);
    });

    it('should suggest when baseline is not set', () => {
      evolver.recordQueryStats(500, 100);

      const dashboard = evolver.getDashboard();
      expect(dashboard.suggestions.some(s => s.includes('recordBaseline'))).toBe(true);
    });

    it('should suggest when savingRatio exceeds DuMate 75% benchmark', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(200, 100); // 80% saving

      const dashboard = evolver.getDashboard();
      expect(dashboard.suggestions.some(s => s.includes('75%') || s.includes('DuMate'))).toBe(true);
    });

    it('should suggest when cache hit rate is low', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(500, 100);
      evolver.recordCacheStats(0.3);

      const dashboard = evolver.getDashboard();
      expect(dashboard.suggestions.some(s => s.includes('缓存') || s.includes('cache'))).toBe(true);
    });

    it('should include currentSettings snapshot', () => {
      evolver.recordQueryStats(500, 100);

      const dashboard = evolver.getDashboard();
      expect(dashboard.currentSettings.contextWindowSize).toBe(4096);
      expect(dashboard.currentSettings.cacheSize).toBe(100);
      expect(dashboard.currentSettings.maxParallelism).toBe(4);
    });
  });

  describe('Backward Compatibility (v3.7.0 M1)', () => {
    it('should maintain existing recordQueryStats API', () => {
      expect(typeof evolver.recordQueryStats).toBe('function');
      evolver.recordQueryStats(500, 100);
      evolver.recordQueryStats(600, 150, { 'test-tool': 300 });
    });

    it('should maintain existing recordCacheStats API', () => {
      expect(typeof evolver.recordCacheStats).toBe('function');
      evolver.recordCacheStats(0.9);
    });

    it('should maintain existing evolve API', () => {
      expect(typeof evolver.evolve).toBe('function');
      const changes = evolver.evolve();
      expect(Array.isArray(changes)).toBe(true);
    });

    it('should maintain existing getStats API', () => {
      expect(typeof evolver.getStats).toBe('function');
      const stats = evolver.getStats();
      expect(stats).toHaveProperty('tokenUsage');
      expect(stats).toHaveProperty('latency');
      expect(stats).toHaveProperty('cacheHitRate');
    });

    it('should maintain existing getSettings API', () => {
      expect(typeof evolver.getSettings).toBe('function');
      const settings = evolver.getSettings();
      expect(settings).toHaveProperty('contextWindowSize');
      expect(settings).toHaveProperty('cacheSize');
    });

    it('should include tokenSaving in getStats() after baseline is set', () => {
      evolver.recordBaseline(1000);
      evolver.recordQueryStats(500, 100);

      const stats = evolver.getStats();
      expect(stats.tokenSaving).toBeDefined();
      expect(stats.tokenSaving!.baselineTokens).toBe(1000);
    });
  });
});
