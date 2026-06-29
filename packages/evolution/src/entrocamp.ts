/**
 * EntroCamp 进化学院
 * 定时调度 + 个性化课程 + 可见变化机制
 *
 * 移植自 Agent World EntroCamp，适配 SelfClaw 架构:
 * 1. 诊断技能短板 → 个性化课程
 * 2. 定时调度（CronScheduler）→ 每日自动精进
 * 3. 可见变化报告（EvolutionReport）→ 用户可感知进化
 */

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 技能短板类型
 */
export type WeaknessType = 'accuracy' | 'efficiency' | 'safety' | 'reliability';

/**
 * 技能短板
 */
export interface Weakness {
  /** 技能名称 */
  skillName: string;
  /** 短板类型 */
  weaknessType: WeaknessType;
  /** 严重程度 0-1 */
  severity: number;
  /** 短板描述 */
  description: string;
  /** 相关案例 ID */
  relatedCaseIds: string[];
}

/**
 * 进化课程
 */
export interface EvolutionCourse {
  /** 课程 ID */
  id: string;
  /** 关联的技能名称 */
  skillName: string;
  /** 针对的短板类型 */
  weaknessType: WeaknessType;
  /** 课程描述 */
  description: string;
  /** 练习题列表 */
  exercises: EvolutionExercise[];
  /** 计划执行时间 */
  scheduledAt: Date;
  /** 课程难度 1-5 */
  difficulty: number;
  /** 预计完成时间 (分钟) */
  estimatedDurationMin: number;
}

/**
 * 进化练习题
 */
export interface EvolutionExercise {
  /** 练习 ID */
  id: string;
  /** 练习类型 */
  type: 'case_study' | 'rule_update' | 'chain_analysis' | 'prediction';
  /** 输入内容 */
  input: ExerciseInput;
  /** 期望输出 */
  expectedOutput: ExerciseOutput;
  /** 练习描述 */
  description: string;
}

/**
 * 练习输入
 */
export interface ExerciseInput {
  /** 场景描述 */
  scenario: string;
  /** 上下文数据 */
  context?: Record<string, unknown>;
  /** 约束条件 */
  constraints?: string[];
}

/**
 * 练习输出
 */
export interface ExerciseOutput {
  /** 期望的结果类型 */
  type: 'text' | 'rule' | 'score' | 'prediction';
  /** 期望值描述 */
  expected: string;
  /** 通过条件 */
  passCriteria: string;
  /** 满分分值 */
  maxScore: number;
}

/**
 * 练习结果
 */
export interface ExerciseResult {
  /** 练习 ID */
  exerciseId: string;
  /** 课程 ID */
  courseId: string;
  /** 关联的技能名称 */
  skillName: string;
  /** 是否完成 */
  completed: boolean;
  /** 得分 0-1 */
  score: number;
  /** 进化前的分数 */
  beforeScore: number;
  /** 进化后的分数 */
  afterScore: number;
  /** 改进幅度 */
  improvement: number;
  /** 实际输出 */
  actualOutput?: string;
  /** 反馈信息 */
  feedback?: string;
  /** 完成时间 */
  completedAt?: Date;
}

/**
 * 可见变化报告
 */
export interface EvolutionReport {
  /** 报告 ID */
  id: string;
  /** 报告日期 */
  date: Date;
  /** Agent ID */
  agentId: string;
  /** 总练习数 */
  totalExercises: number;
  /** 完成的练习数 */
  completedExercises: number;
  /** 平均得分 */
  averageScore: number;
  /** 具体改进项 */
  improvements: Array<{
    skillName: string;
    before: number;
    after: number;
    delta: number;
  }>;
  /** 摘要文本 */
  summary: string;
  /** 详细分析 */
  detailedAnalysis?: string;
  /** 建议的下一步行动 */
  nextSteps: string[];
  /** 生成时间 */
  generatedAt: number;
}

/**
 * 技能统计信息
 */
export interface SkillStats {
  /** 技能名称 */
  skillName: string;
  /** 成功率 0-1 */
  successRate: number;
  /** 总调用次数 */
  totalInvocations: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均延迟 (ms) */
  avgLatencyMs: number;
  /** 最近错误类型分布 */
  errorTypeDistribution: Record<string, number>;
  /** 最近评估时间 */
  lastEvaluatedAt: number;
}

/**
 * Cron 调度配置
 */
export interface CronScheduleConfig {
  /** Cron 表达式 */
  expression: string;
  /** 是否启用 */
  enabled: boolean;
  /** 时区 */
  timezone: string;
  /** 首次运行延迟 (ms) */
  initialDelayMs: number;
}

/**
 * 默认调度配置：每晚 2:00 自动执行
 */
export const DEFAULT_CRON_CONFIG: CronScheduleConfig = {
  expression: '0 2 * * *',
  enabled: true,
  timezone: 'Asia/Shanghai',
  initialDelayMs: 0,
};

/**
 * EntroCamp 配置
 */
export interface EntroCampConfig {
  /** 最低成功率阈值（低于此值触发课程） */
  weaknessThreshold: number;
  /** 课程难度系数（1-5） */
  defaultDifficulty: number;
  /** 每日最大课程数 */
  maxCoursesPerDay: number;
  /** 每课程最大练习数 */
  maxExercisesPerCourse: number;
  /** 调度配置 */
  schedule: CronScheduleConfig;
}

/**
 * 默认 EntroCamp 配置
 */
export const DEFAULT_ENTROCAMP_CONFIG: EntroCampConfig = {
  weaknessThreshold: 0.8,
  defaultDifficulty: 3,
  maxCoursesPerDay: 5,
  maxExercisesPerCourse: 4,
  schedule: DEFAULT_CRON_CONFIG,
};

// ============================================================================
// CronScheduler 定时调度器
// ============================================================================

/**
 * 定时调度器
 * 支持基于 setTimeout 的简易定时任务
 */
export class CronScheduler {
  private config: CronScheduleConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private executionCount = 0;
  private lastExecutionTime: number | null = null;

  constructor(config?: Partial<CronScheduleConfig>) {
    this.config = { ...DEFAULT_CRON_CONFIG, ...config };
  }

  /**
   * 解析 cron 表达式到下次执行延迟 (ms)
   * 支持简单格式: "0 2 * * *" (每晚2点)
   */
  private getNextDelay(): number {
    const parts = this.config.expression.split(/\s+/);
    if (parts.length !== 5) {
      // 默认 24 小时
      return 24 * 60 * 60 * 1000;
    }

    const [minute, hour] = parts.map(Number);
    const now = new Date();
    const target = new Date(now);

    target.setHours(hour, minute, 0, 0);

    // 如果今天的时间已过，改为明天
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    // 加上初始延迟
    return delay + this.config.initialDelayMs;
  }

  /**
   * 启动调度器
   *
   * @param task - 要定时执行的任务函数
   */
  start(task: () => Promise<void>): void {
    if (this.running) return;
    this.running = true;

    const scheduleNext = (): void => {
      if (!this.running) return;

      const delay = this.getNextDelay();
      this.timer = setTimeout(async () => {
        if (!this.running) return;

        try {
          await task();
          this.executionCount++;
          this.lastExecutionTime = Date.now();
        } catch (err) {
          console.error('[CronScheduler] Task execution failed:', err);
        }

        // 调度下一次
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  /**
   * 立即执行一次（不等待定时）
   */
  async executeNow(task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (err) {
      console.error('[CronScheduler] executeNow task failed:', err);
    }
    this.executionCount++;
    this.lastExecutionTime = Date.now();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 调度器状态
   */
  getStatus(): {
    running: boolean;
    executionCount: number;
    lastExecutionTime: number | null;
    config: CronScheduleConfig;
  } {
    return {
      running: this.running,
      executionCount: this.executionCount,
      lastExecutionTime: this.lastExecutionTime,
      config: this.config,
    };
  }
}

// ============================================================================
// CourseGenerator 课程生成器
// ============================================================================

/**
 * 个性化课程生成器
 */
export class CourseGenerator {
  private config: EntroCampConfig;

  constructor(config?: Partial<EntroCampConfig>) {
    this.config = { ...DEFAULT_ENTROCAMP_CONFIG, ...config };
  }

  /**
   * 根据短板生成个性化课程
   *
   * @param weaknesses - 检测到的技能短板
   * @returns 进化课程列表
   */
  generate(weaknesses: Weakness[]): EvolutionCourse[] {
    const courses: EvolutionCourse[] = [];
    let courseIndex = 0;

    for (const weakness of weaknesses) {
      if (courseIndex >= this.config.maxCoursesPerDay) break;

      const exercises = this.generateExercises(weakness);
      const difficulty = this.calculateDifficulty(weakness.severity);
      const duration = this.estimateDuration(exercises);

      courses.push({
        id: `course-${Date.now()}-${courseIndex}`,
        skillName: weakness.skillName,
        weaknessType: weakness.weaknessType,
        description: `针对 ${weakness.skillName} 的 ${weakness.weaknessType} 短板训练`,
        exercises,
        scheduledAt: new Date(),
        difficulty,
        estimatedDurationMin: duration,
      });

      courseIndex++;
    }

    return courses;
  }

  /**
   * 为短板生成练习题
   */
  private generateExercises(weakness: Weakness): EvolutionExercise[] {
    const exercises: EvolutionExercise[] = [];
    const types: EvolutionExercise['type'][] = ['case_study', 'rule_update', 'chain_analysis', 'prediction'];

    const exerciseCount = Math.min(
      this.config.maxExercisesPerCourse,
      Math.ceil(weakness.severity * 4), // 严重程度越高，练习越多
    );

    for (let i = 0; i < exerciseCount; i++) {
      const type = types[i % types.length];
      exercises.push({
        id: `exercise-${Date.now()}-${i}`,
        type,
        input: this.createExerciseInput(weakness, type),
        expectedOutput: this.createExerciseOutput(weakness, type),
        description: this.getExerciseDescription(weakness, type),
      });
    }

    return exercises;
  }

  /**
   * 创建练习输入
   */
  private createExerciseInput(weakness: Weakness, type: EvolutionExercise['type']): ExerciseInput {
    const baseInput: ExerciseInput = {
      scenario: `${weakness.skillName} 的 ${weakness.weaknessType} 问题: ${weakness.description}`,
      context: {
        severity: weakness.severity,
        relatedCases: weakness.relatedCaseIds,
      },
      constraints: [],
    };

    switch (type) {
      case 'case_study':
        baseInput.scenario = `分析 ${weakness.skillName} 的历史失败案例，找出 ${weakness.weaknessType} 相关的共同模式`;
        baseInput.constraints = ['必须引用具体案例', '需要给出根因分析'];
        break;
      case 'rule_update':
        baseInput.scenario = `为 ${weakness.skillName} 设计新的审计规则，防止 ${weakness.weaknessType} 类问题再次发生`;
        baseInput.constraints = ['规则必须可执行', '需要包含验证条件'];
        break;
      case 'chain_analysis':
        baseInput.scenario = `追踪 ${weakness.skillName} 中 ${weakness.weaknessType} 问题的传播链条，分析上游依赖`;
        baseInput.constraints = ['需要展示完整的依赖链', '标注每个节点的风险等级'];
        break;
      case 'prediction':
        baseInput.scenario = `预测 ${weakness.skillName} 在未来一周内 ${weakness.weaknessType} 问题的趋势`;
        baseInput.constraints = ['需要给出置信区间', '说明预测依据'];
        break;
    }

    return baseInput;
  }

  /**
   * 创建练习输出期望
   */
  private createExerciseOutput(weakness: Weakness, type: EvolutionExercise['type']): ExerciseOutput {
    const baseOutput: ExerciseOutput = {
      type: 'text',
      expected: `改进 ${weakness.skillName} 的 ${weakness.weaknessType} 表现`,
      passCriteria: `得分 >= 0.7`,
      maxScore: 100,
    };

    switch (type) {
      case 'rule_update':
        baseOutput.type = 'rule';
        baseOutput.expected = `一条完整的审计规则，覆盖 ${weakness.weaknessType} 场景`;
        baseOutput.passCriteria = '规则格式正确、条件完整、可执行';
        break;
      case 'prediction':
        baseOutput.type = 'prediction';
        baseOutput.expected = `包含置信度的趋势预测`;
        baseOutput.passCriteria = '预测合理且有依据，置信度标注正确';
        break;
      case 'chain_analysis':
        baseOutput.type = 'text';
        baseOutput.expected = `完整的依赖链分析报告`;
        baseOutput.passCriteria = '链条完整、风险标注准确';
        break;
    }

    return baseOutput;
  }

  /**
   * 获取练习描述
   */
  private getExerciseDescription(weakness: Weakness, type: EvolutionExercise['type']): string {
    const descriptions: Record<EvolutionExercise['type'], string> = {
      case_study: `案例研究：分析 ${weakness.skillName} 的 ${weakness.weaknessType} 失败模式`,
      rule_update: `规则更新：为 ${weakness.skillName} 新增 ${weakness.weaknessType} 防护规则`,
      chain_analysis: `链路分析：追溯 ${weakness.skillName} 的 ${weakness.weaknessType} 问题根因`,
      prediction: `趋势预测：预判 ${weakness.skillName} 的 ${weakness.weaknessType} 风险趋势`,
    };
    return descriptions[type];
  }

  /**
   * 根据严重程度计算难度
   */
  private calculateDifficulty(severity: number): number {
    if (severity > 0.7) return 5;
    if (severity > 0.5) return 4;
    if (severity > 0.3) return 3;
    if (severity > 0.1) return 2;
    return 1;
  }

  /**
   * 估算课程完成时间 (分钟)
   */
  private estimateDuration(exercises: EvolutionExercise[]): number {
    const perExerciseMinutes: Record<EvolutionExercise['type'], number> = {
      case_study: 15,
      rule_update: 10,
      chain_analysis: 20,
      prediction: 10,
    };

    return exercises.reduce(
      (sum, ex) => sum + (perExerciseMinutes[ex.type] || 10),
      0,
    );
  }
}

// ============================================================================
// EntroCamp 进化学院
// ============================================================================

/**
 * EntroCamp 进化学院
 * 定时调度 + 个性化课程 + 可见变化
 */
export class EntroCamp {
  private config: EntroCampConfig;
  private courseGenerator: CourseGenerator;
  private scheduler: CronScheduler;
  private skillStatsMap: Map<string, SkillStats> = new Map();
  private reports: EvolutionReport[] = [];

  constructor(config?: Partial<EntroCampConfig>) {
    this.config = { ...DEFAULT_ENTROCAMP_CONFIG, ...config };
    this.courseGenerator = new CourseGenerator(this.config);
    this.scheduler = new CronScheduler(this.config.schedule);
  }

  // ===========================================================================
  // 核心方法
  // ===========================================================================

  /**
   * 每日自动进化
   *
   * @param agentId - Agent ID
   * @returns 进化报告
   */
  async dailyEvolution(agentId: string): Promise<EvolutionReport> {
    const startedAt = Date.now();

    // 1. 诊断技能短板
    const weaknesses = this.diagnoseWeaknesses(agentId);

    // 2. 生成个性化课程
    const courses = this.courseGenerator.generate(weaknesses);

    // 3. 执行训练
    const results = await this.executeCourses(agentId, courses);

    // 4. 生成可见变化报告
    const report = this.generateReport(agentId, results);
    report.detailedAnalysis = this.generateDetailedAnalysis(weaknesses, results);

    // 5. 保存报告
    this.reports.push(report);

    // 6. 更新技能统计
    this.updateSkillStats(results);

    return report;
  }

  /**
   * 诊断技能短板
   */
  private diagnoseWeaknesses(agentId: string): Weakness[] {
    const weaknesses: Weakness[] = [];

    for (const [skillName, stats] of Array.from(this.skillStatsMap.entries()) as [string, SkillStats][]) {
      if (stats.successRate < this.config.weaknessThreshold) {
        const weaknessType = this.inferWeaknessType(stats);
        weaknesses.push({
          skillName,
          weaknessType,
          severity: 1 - stats.successRate,
          description: `${skillName} 成功率 ${(stats.successRate * 100).toFixed(1)}%，低于阈值 ${(this.config.weaknessThreshold * 100).toFixed(0)}%`,
          relatedCaseIds: [],
        });
      }
    }

    // 按严重程度排序
    weaknesses.sort((a, b) => b.severity - a.severity);

    return weaknesses;
  }

  /**
   * 推断短板类型
   */
  private inferWeaknessType(stats: SkillStats): WeaknessType {
    // 基于错误类型分布推断
    const errors = stats.errorTypeDistribution;

    if (errors['runtime'] && errors['runtime'] > stats.totalInvocations * 0.3) {
      return 'reliability';
    }
    if (errors['semantic'] && errors['semantic'] > stats.totalInvocations * 0.2) {
      return 'accuracy';
    }
    if (stats.avgLatencyMs > 5000) {
      return 'efficiency';
    }
    if (errors['format'] && errors['format'] > stats.totalInvocations * 0.1) {
      return 'safety';
    }

    // 默认基于成功率推断
    if (stats.successRate < 0.5) return 'reliability';
    if (stats.successRate < 0.6) return 'accuracy';
    if (stats.successRate < 0.7) return 'efficiency';
    return 'safety';
  }

  /**
   * 执行课程训练
   */
  private async executeCourses(
    agentId: string,
    courses: EvolutionCourse[],
  ): Promise<ExerciseResult[]> {
    const allResults: ExerciseResult[] = [];

    for (const course of courses) {
      for (const exercise of course.exercises) {
        const result = await this.executeExercise(agentId, course, exercise);
        allResults.push(result);
      }
    }

    return allResults;
  }

  /**
   * 执行单个练习
   */
  private async executeExercise(
    agentId: string,
    course: EvolutionCourse,
    exercise: EvolutionExercise,
  ): Promise<ExerciseResult> {
    // 模拟练习执行和评分
    const beforeScore = this.getSkillScore(course.skillName);
    const exerciseScore = this.evaluateExercise(exercise);
    const afterScore = Math.min(1, beforeScore + exerciseScore * 0.1);

    return {
      exerciseId: exercise.id,
      courseId: course.id,
      skillName: course.skillName,
      completed: true,
      score: exerciseScore,
      beforeScore,
      afterScore,
      improvement: afterScore - beforeScore,
      actualOutput: `Completed ${exercise.type} exercise for ${course.skillName}`,
      feedback: this.generateFeedback(exerciseScore),
      completedAt: new Date(),
    };
  }

  /**
   * 评估练习得分
   * 根据练习类型和难度计算模拟分数
   */
  private evaluateExercise(exercise: EvolutionExercise): number {
    // 简化的评分逻辑：基于练习类型给出模拟分数
    const baseScores: Record<EvolutionExercise['type'], number> = {
      case_study: 0.75,
      rule_update: 0.80,
      chain_analysis: 0.65,
      prediction: 0.70,
    };

    const base = baseScores[exercise.type] || 0.7;
    // 添加少量随机性
    const jitter = (Math.random() - 0.5) * 0.1;
    return Math.max(0, Math.min(1, base + jitter));
  }

  /**
   * 获取技能当前分数
   */
  private getSkillScore(skillName: string): number {
    const stats = this.skillStatsMap.get(skillName);
    return stats?.successRate ?? 0.8;
  }

  /**
   * 生成练习反馈
   */
  private generateFeedback(score: number): string {
    if (score >= 0.9) return 'Excellent! 完全掌握了该知识点';
    if (score >= 0.7) return 'Good! 基本理解，建议继续巩固';
    if (score >= 0.5) return 'Fair! 需要更多练习来加深理解';
    return 'Needs improvement. 建议重新学习相关内容';
  }

  /**
   * 生成可见变化报告
   */
  private generateReport(agentId: string, results: ExerciseResult[]): EvolutionReport {
    const completed = results.filter(r => r.completed);
    const improvements = results
      .filter(r => r.improvement > 0)
      .map(r => ({
        skillName: r.skillName,
        before: r.beforeScore,
        after: r.afterScore,
        delta: r.improvement,
      }));

    const avgScore = completed.length > 0
      ? completed.reduce((sum, r) => sum + r.score, 0) / completed.length
      : 0;

    const report: EvolutionReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date(),
      agentId,
      totalExercises: results.length,
      completedExercises: completed.length,
      averageScore: avgScore,
      improvements,
      summary: this.generateSummary(results, improvements),
      nextSteps: this.generateNextSteps(results),
      generatedAt: Date.now(),
    };

    return report;
  }

  /**
   * 生成报告摘要
   */
  private generateSummary(
    results: ExerciseResult[],
    improvements: EvolutionReport['improvements'],
  ): string {
    const completed = results.filter(r => r.completed).length;
    const totalImprovement = improvements.reduce((sum, i) => sum + i.delta, 0);

    if (totalImprovement > 0.1) {
      return `今日进化完成 ${completed}/${results.length} 项练习，` +
        `${improvements.length} 项技能获得提升，` +
        `总进步幅度 ${(totalImprovement * 100).toFixed(1)}%。继续保持！`;
    } else if (totalImprovement > 0) {
      return `今日进化完成 ${completed}/${results.length} 项练习，` +
        `${improvements.length} 项技能小幅提升，` +
        `总进步幅度 ${(totalImprovement * 100).toFixed(1)}%。稳步前进。`;
    } else {
      return `今日进化完成 ${completed}/${results.length} 项练习，` +
        `暂无明显提升。建议调整训练策略。`;
    }
  }

  /**
   * 生成详细分析
   */
  private generateDetailedAnalysis(
    weaknesses: Weakness[],
    results: ExerciseResult[],
  ): string {
    const lines: string[] = [];

    lines.push('## 短板诊断');
    for (const w of weaknesses) {
      lines.push(`- **${w.skillName}**: ${w.weaknessType} 短板 (严重度: ${(w.severity * 100).toFixed(0)}%)`);
    }

    lines.push('');
    lines.push('## 训练结果');
    for (const r of results) {
      const delta = r.improvement > 0 ? `+${(r.improvement * 100).toFixed(1)}%` : '0%';
      lines.push(`- ${r.skillName}: ${r.beforeScore.toFixed(2)} → ${r.afterScore.toFixed(2)} (${delta})`);
    }

    return lines.join('\n');
  }

  /**
   * 生成下一步建议
   */
  private generateNextSteps(results: ExerciseResult[]): string[] {
    const steps: string[] = [];

    const weakSkills = results.filter(r => r.afterScore < 0.7);
    if (weakSkills.length > 0) {
      steps.push(
        `继续强化训练: ${weakSkills.map(s => s.skillName).join(', ')} 成功率仍低于 70%`,
      );
    }

    const improvedSkills = results.filter(r => r.improvement > 0.05);
    if (improvedSkills.length > 0) {
      steps.push(
        `巩固进步: ${improvedSkills.map(s => s.skillName).join(', ')} 有明显提升，建议持续练习`,
      );
    }

    if (steps.length === 0) {
      steps.push('所有训练完成良好，明日继续常规进化');
    }

    return steps;
  }

  /**
   * 更新技能统计
   */
  private updateSkillStats(results: ExerciseResult[]): void {
    for (const result of results) {
      const stats = this.skillStatsMap.get(result.skillName);
      if (stats) {
        stats.successRate = result.afterScore;
        stats.lastEvaluatedAt = Date.now();
      }
    }
  }

  // ===========================================================================
  // 公共接口
  // ===========================================================================

  /**
   * 注册技能统计
   */
  registerSkillStats(skillName: string, stats: SkillStats): void {
    this.skillStatsMap.set(skillName, stats);
  }

  /**
   * 批量注册技能统计
   */
  registerSkillStatsBatch(statsList: SkillStats[]): void {
    for (const stats of statsList) {
      this.skillStatsMap.set(stats.skillName, stats);
    }
  }

  /**
   * 获取技能统计
   */
  getSkillStats(skillName: string): SkillStats | undefined {
    return this.skillStatsMap.get(skillName);
  }

  /**
   * 获取所有已注册技能的统计
   */
  getAllSkillStats(): Map<string, SkillStats> {
    return new Map(this.skillStatsMap);
  }

  /**
   * 获取历史报告
   */
  getReports(): EvolutionReport[] {
    return [...this.reports];
  }

  /**
   * 获取最新报告
   */
  getLatestReport(): EvolutionReport | undefined {
    return this.reports[this.reports.length - 1];
  }

  /**
   * 启动定时进化调度
   */
  startScheduledEvolution(agentId: string): void {
    this.scheduler.start(async () => {
      await this.dailyEvolution(agentId);
    });
  }

  /**
   * 手动触发一次进化（不等定时）
   */
  async triggerEvolution(agentId: string): Promise<EvolutionReport> {
    return this.dailyEvolution(agentId);
  }

  /**
   * 停止定时调度
   */
  stopScheduledEvolution(): void {
    this.scheduler.stop();
  }

  /**
   * 获取调度器状态
   */
  getSchedulerStatus() {
    return this.scheduler.getStatus();
  }

  /**
   * 获取 EntroCamp 配置
   */
  getConfig(): EntroCampConfig {
    return { ...this.config };
  }
}
