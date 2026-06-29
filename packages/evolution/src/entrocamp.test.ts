/**
 * EntroCamp 进化学院 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  EntroCamp,
  CronScheduler,
  CourseGenerator,
  DEFAULT_ENTROCAMP_CONFIG,
  DEFAULT_CRON_CONFIG,
  type Weakness,
  type SkillStats,
  type EntroCampConfig,
} from './entrocamp.js';

// ============================================================================
// CronScheduler
// ============================================================================

describe('CronScheduler', () => {
  it('should start and stop', () => {
    const scheduler = new CronScheduler();
    let executed = false;

    scheduler.start(async () => { executed = true; });
    expect(scheduler.getStatus().running).toBe(true);

    scheduler.stop();
    expect(scheduler.getStatus().running).toBe(false);
  });

  it('should execute task immediately with executeNow', async () => {
    const scheduler = new CronScheduler();
    let executed = false;

    await scheduler.executeNow(async () => { executed = true; });

    expect(executed).toBe(true);
    expect(scheduler.getStatus().executionCount).toBe(1);
    expect(scheduler.getStatus().lastExecutionTime).not.toBeNull();
  });

  it('should track execution count', async () => {
    const scheduler = new CronScheduler();

    await scheduler.executeNow(async () => {});
    await scheduler.executeNow(async () => {});
    await scheduler.executeNow(async () => {});

    expect(scheduler.getStatus().executionCount).toBe(3);
  });

  it('should handle task errors gracefully', async () => {
    const scheduler = new CronScheduler();

    await scheduler.executeNow(async () => { throw new Error('Task failed'); });

    // Should still count the execution
    expect(scheduler.getStatus().executionCount).toBe(1);
  });

  it('should return correct status', () => {
    const scheduler = new CronScheduler({ enabled: true, timezone: 'UTC' });

    const status = scheduler.getStatus();
    expect(status.running).toBe(false);
    expect(status.executionCount).toBe(0);
    expect(status.lastExecutionTime).toBeNull();
    expect(status.config.timezone).toBe('UTC');
  });

  it('should not start twice', () => {
    const scheduler = new CronScheduler();
    scheduler.start(async () => {});
    scheduler.start(async () => {}); // Should be no-op
    expect(scheduler.getStatus().running).toBe(true);
    scheduler.stop();
  });
});

// ============================================================================
// CourseGenerator
// ============================================================================

describe('CourseGenerator', () => {
  const weaknesses: Weakness[] = [
    {
      skillName: 'medical-advisor',
      weaknessType: 'accuracy',
      severity: 0.4,
      description: 'Low accuracy in diagnosis',
      relatedCaseIds: ['case-1'],
    },
    {
      skillName: 'news-aggregator',
      weaknessType: 'reliability',
      severity: 0.6,
      description: 'Frequent timeout errors',
      relatedCaseIds: ['case-2', 'case-3'],
    },
  ];

  it('should generate courses from weaknesses', () => {
    const generator = new CourseGenerator();
    const courses = generator.generate(weaknesses);

    expect(courses.length).toBeGreaterThan(0);
    expect(courses.length).toBeLessThanOrEqual(DEFAULT_ENTROCAMP_CONFIG.maxCoursesPerDay);
  });

  it('should set correct skill name on courses', () => {
    const generator = new CourseGenerator();
    const courses = generator.generate(weaknesses);

    const skillNames = courses.map(c => c.skillName);
    expect(skillNames).toContain('medical-advisor');
    expect(skillNames).toContain('news-aggregator');
  });

  it('should set weakness type on courses', () => {
    const generator = new CourseGenerator();
    const courses = generator.generate(weaknesses);

    expect(courses[0].weaknessType).toBeDefined();
  });

  it('should generate exercises for each course', () => {
    const generator = new CourseGenerator();
    const courses = generator.generate(weaknesses);

    for (const course of courses) {
      expect(course.exercises.length).toBeGreaterThan(0);
      expect(course.exercises.length).toBeLessThanOrEqual(DEFAULT_ENTROCAMP_CONFIG.maxExercisesPerCourse);
    }
  });

  it('should generate different exercise types', () => {
    const generator = new CourseGenerator();
    const courses = generator.generate([{ 
      skillName: 'test', 
      weaknessType: 'accuracy', 
      severity: 0.8, 
      description: 'Test', 
      relatedCaseIds: [] 
    }]);

    const types = new Set(courses[0].exercises.map(e => e.type));
    expect(types.size).toBeGreaterThan(1); // At least 2 different types
  });

  it('should calculate difficulty based on severity', () => {
    const generator = new CourseGenerator();
    
    const highSeverity = generator.generate([{
      skillName: 'test', weaknessType: 'reliability', severity: 0.8, description: 'Critical', relatedCaseIds: []
    }]);
    const lowSeverity = generator.generate([{
      skillName: 'test', weaknessType: 'accuracy', severity: 0.1, description: 'Minor', relatedCaseIds: []
    }]);

    expect(highSeverity[0].difficulty).toBeGreaterThanOrEqual(lowSeverity[0].difficulty);
  });

  it('should respect maxCoursesPerDay limit', () => {
    const config: Partial<EntroCampConfig> = { maxCoursesPerDay: 2 };
    const generator = new CourseGenerator(config);

    const manyWeaknesses = Array.from({ length: 10 }, (_, i) => ({
      skillName: `skill-${i}`,
      weaknessType: 'accuracy' as const,
      severity: 0.5,
      description: `Weakness ${i}`,
      relatedCaseIds: [],
    }));

    const courses = generator.generate(manyWeaknesses);
    expect(courses.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// EntroCamp - 核心功能
// ============================================================================

describe('EntroCamp - Core', () => {
  it('should run daily evolution and generate report', async () => {
    const camp = new EntroCamp();

    // 注册一些有短板的技能
    camp.registerSkillStats('medical-advisor', {
      skillName: 'medical-advisor',
      successRate: 0.6,
      totalInvocations: 100,
      failureCount: 40,
      avgLatencyMs: 2000,
      errorTypeDistribution: { semantic: 25, runtime: 15 },
      lastEvaluatedAt: Date.now(),
    });

    camp.registerSkillStats('news-aggregator', {
      skillName: 'news-aggregator',
      successRate: 0.5,
      totalInvocations: 80,
      failureCount: 40,
      avgLatencyMs: 6000,
      errorTypeDistribution: { runtime: 30, format: 10 },
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-001');

    expect(report).toBeDefined();
    expect(report.agentId).toBe('agent-001');
    expect(report.id).toMatch(/^report-/);
    expect(report.totalExercises).toBeGreaterThan(0);
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.summary).toBeDefined();
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('should generate improvements in report', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('weak-skill', {
      skillName: 'weak-skill',
      successRate: 0.3,
      totalInvocations: 50,
      failureCount: 35,
      avgLatencyMs: 3000,
      errorTypeDistribution: { semantic: 20, runtime: 15 },
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-002');

    expect(report.totalExercises).toBeGreaterThan(0);
    expect(report.completedExercises).toBeGreaterThan(0);
  });

  it('should generate next steps', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('test-skill', {
      skillName: 'test-skill',
      successRate: 0.4,
      totalInvocations: 30,
      failureCount: 18,
      avgLatencyMs: 2000,
      errorTypeDistribution: { runtime: 18 },
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-003');
    expect(report.nextSteps).toBeDefined();
    expect(report.nextSteps.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// EntroCamp - 技能统计管理
// ============================================================================

describe('EntroCamp - Skill Stats', () => {
  it('should register and retrieve skill stats', () => {
    const camp = new EntroCamp();
    const stats: SkillStats = {
      skillName: 'test-skill',
      successRate: 0.9,
      totalInvocations: 100,
      failureCount: 10,
      avgLatencyMs: 1500,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    };

    camp.registerSkillStats('test-skill', stats);
    const retrieved = camp.getSkillStats('test-skill');
    expect(retrieved).toBeDefined();
    expect(retrieved!.successRate).toBe(0.9);
  });

  it('should batch register skill stats', () => {
    const camp = new EntroCamp();

    camp.registerSkillStatsBatch([
      { skillName: 'skill-a', successRate: 0.8, totalInvocations: 50, failureCount: 10, avgLatencyMs: 1000, errorTypeDistribution: {}, lastEvaluatedAt: Date.now() },
      { skillName: 'skill-b', successRate: 0.7, totalInvocations: 30, failureCount: 9, avgLatencyMs: 2000, errorTypeDistribution: {}, lastEvaluatedAt: Date.now() },
    ]);

    const allStats = camp.getAllSkillStats();
    expect(allStats.size).toBe(2);
  });

  it('should return undefined for unregistered skill', () => {
    const camp = new EntroCamp();
    expect(camp.getSkillStats('nonexistent')).toBeUndefined();
  });
});

// ============================================================================
// EntroCamp - 报告管理
// ============================================================================

describe('EntroCamp - Reports', () => {
  it('should store and retrieve reports', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('test-skill', {
      skillName: 'test-skill',
      successRate: 0.5,
      totalInvocations: 20,
      failureCount: 10,
      avgLatencyMs: 1000,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    });

    await camp.dailyEvolution('agent-001');
    await camp.dailyEvolution('agent-001');

    const reports = camp.getReports();
    expect(reports.length).toBe(2);
  });

  it('should return latest report', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('test-skill', {
      skillName: 'test-skill',
      successRate: 0.5,
      totalInvocations: 20,
      failureCount: 10,
      avgLatencyMs: 1000,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    });

    await camp.dailyEvolution('agent-001');

    const latest = camp.getLatestReport();
    expect(latest).toBeDefined();
    expect(latest!.agentId).toBe('agent-001');
  });

  it('should return undefined when no reports exist', () => {
    const camp = new EntroCamp();
    expect(camp.getLatestReport()).toBeUndefined();
  });
});

// ============================================================================
// EntroCamp - 定时调度
// ============================================================================

describe('EntroCamp - Scheduled Evolution', () => {
  it('should start and stop scheduled evolution', () => {
    const camp = new EntroCamp();

    camp.startScheduledEvolution('agent-001');
    expect(camp.getSchedulerStatus().running).toBe(true);

    camp.stopScheduledEvolution();
    expect(camp.getSchedulerStatus().running).toBe(false);
  });

  it('should trigger evolution manually', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('test-skill', {
      skillName: 'test-skill',
      successRate: 0.5,
      totalInvocations: 20,
      failureCount: 10,
      avgLatencyMs: 1000,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.triggerEvolution('agent-001');
    expect(report).toBeDefined();
    expect(report.agentId).toBe('agent-001');
  });
});

// ============================================================================
// EntroCamp - 配置
// ============================================================================

describe('EntroCamp - Configuration', () => {
  it('should use default config', () => {
    const camp = new EntroCamp();
    const config = camp.getConfig();
    expect(config.weaknessThreshold).toBe(DEFAULT_ENTROCAMP_CONFIG.weaknessThreshold);
    expect(config.maxCoursesPerDay).toBe(DEFAULT_ENTROCAMP_CONFIG.maxCoursesPerDay);
  });

  it('should accept custom config', () => {
    const camp = new EntroCamp({
      weaknessThreshold: 0.9,
      maxCoursesPerDay: 3,
    });
    const config = camp.getConfig();
    expect(config.weaknessThreshold).toBe(0.9);
    expect(config.maxCoursesPerDay).toBe(3);
  });
});

// ============================================================================
// 短板诊断
// ============================================================================

describe('EntroCamp - Weakness Diagnosis', () => {
  it('should diagnose accuracy weakness', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('skill-a', {
      skillName: 'skill-a',
      successRate: 0.55,
      totalInvocations: 100,
      failureCount: 45,
      avgLatencyMs: 1000,
      errorTypeDistribution: { semantic: 30 },
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-001');
    // Skill should have been identified as having a weakness
    expect(report.totalExercises).toBeGreaterThan(0);
  });

  it('should diagnose reliability weakness for many runtime errors', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('skill-b', {
      skillName: 'skill-b',
      successRate: 0.4,
      totalInvocations: 100,
      failureCount: 60,
      avgLatencyMs: 2000,
      errorTypeDistribution: { runtime: 40 },
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-001');
    expect(report).toBeDefined();
  });

  it('should diagnose efficiency weakness for high latency', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('skill-c', {
      skillName: 'skill-c',
      successRate: 0.6,
      totalInvocations: 50,
      failureCount: 20,
      avgLatencyMs: 8000,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-001');
    expect(report).toBeDefined();
  });

  it('should not generate courses when no weaknesses', async () => {
    const camp = new EntroCamp();

    camp.registerSkillStats('perfect-skill', {
      skillName: 'perfect-skill',
      successRate: 0.95,
      totalInvocations: 100,
      failureCount: 5,
      avgLatencyMs: 500,
      errorTypeDistribution: {},
      lastEvaluatedAt: Date.now(),
    });

    const report = await camp.dailyEvolution('agent-001');
    // No weaknesses detected → no exercises
    expect(report.totalExercises).toBe(0);
    expect(report.summary).toContain('暂无明显提升');
  });
});
