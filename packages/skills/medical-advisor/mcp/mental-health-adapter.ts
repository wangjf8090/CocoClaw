/**
 * 心理健康数据源适配器（接口规范）
 *
 * 状态：P3 预留框架 —— 接口已定义，**未实施**
 *
 * 本文件实现 MentalHealthDataSource 接口的**抽象骨架**，
 * 目的是：
 *   1. 占用 MentalHealthDataSource 接口的 id 命名空间
 *   2. 注册到 MedicalDataSourceRegistry（disabled by default）
 *   3. 未来 v3.8.0 评估实施时，开发者只需替换 query/healthCheck 实现
 *
 * **不要在 v3.7.0 M1/M2 阶段调用本适配器的方法**——
 * 所有方法都会抛出 P3NotImplementedError。
 *
 * @version 0.1.0
 * @date 2026-06-14
 * @status P3 RESERVED (决策 20 + 决策 24)
 */

import {
  MedicalDataSource,
  Capability
} from './interfaces';

// ============================================================================
// P3 预留接口定义
// ============================================================================

/**
 * 心理健康专属能力（扩展自通用 Capability）
 *
 * 注意：当前 Capability 联合类型未包含 'mental-screening'，
 * 这里用字符串字面量表示，避免影响现有数据源。
 * v3.8.0 实施时再合并到 Capability 联合类型。
 */
export type MentalHealthCapability =
  | 'mental-screening'      // 心理筛查（如 PHQ-9 / GAD-7 量表）
  | 'mental-counseling'     // 心理咨询对话
  | 'crisis-intervention'   // 危机干预识别
  | 'mood-tracking';        // 情绪追踪

/**
 * 心理筛查量表结果
 */
export interface MentalScreeningResult {
  scale: 'PHQ-9' | 'GAD-7' | 'PSS-10' | 'ISI' | string;
  totalScore: number;
  severity: 'minimal' | 'mild' | 'moderate' | 'severe';
  recommendation: string;
  rawAnswers: number[];
}

/**
 * 危机干预信号
 */
export interface CrisisSignal {
  level: 'none' | 'watch' | 'urgent' | 'emergency';
  triggers: string[];
  suggestedAction: string;
}

/**
 * 情绪追踪记录
 */
export interface MoodEntry {
  date: string;        // YYYY-MM-DD
  valence: number;     // -1 ~ 1
  arousal: number;     // -1 ~ 1
  note?: string;
}

/**
 * 心理健康数据源接口（与 MedicalDataSource 平行）
 *
 * 设计为独立接口而不是 MedicalDataSource 子类型，
 * 因为心理数据涉及隐私敏感度、伦理审查、危机干预责任等
 * 医疗通用接口未覆盖的领域。
 */
export interface MentalHealthDataSource {
  /** 数据源唯一标识 */
  id: string;

  /** 数据源名称 */
  name: string;

  /** 是否启用（v3.7.0 始终 false） */
  enabled: boolean;

  /**
   * 心理筛查（v3.8.0 实施）
   */
  screen(params: {
    scale: MentalHealthCapability;
    answers: number[];
  }): Promise<MentalScreeningResult>;

  /**
   * 危机干预检测（v3.8.0 实施）
   */
  detectCrisis(params: {
    text: string;
    context?: Record<string, unknown>;
  }): Promise<CrisisSignal>;

  /**
   * 情绪追踪（v3.8.0 实施）
   */
  trackMood(params: {
    userId: string;       // 匿名 ID
    entry: MoodEntry;
  }): Promise<{ stored: boolean }>;
}

// ============================================================================
// P3NotImplementedError
// ============================================================================

/**
 * P3 预留方法未实施错误
 */
export class P3NotImplementedError extends Error {
  readonly code = 'P3_NOT_IMPLEMENTED';
  readonly feature: string;
  readonly targetVersion = 'v3.8.0';

  constructor(feature: string) {
    super(
      `[P3 RESERVED] 心理健康模块「${feature}」尚未实施。` +
      `当前版本 v3.7.0，评估实施目标版本 ${this.targetVersion}。` +
      `如需提前启用，请联系 SelfClaw 维护者更新决策 24。`
    );
    this.feature = feature;
    this.name = 'P3NotImplementedError';
  }
}

// ============================================================================
// 预留适配器实现
// ============================================================================

/**
 * 心理健康数据源预留适配器（P3）
 *
 * 实现 MentalHealthDataSource 接口但所有方法抛出 P3NotImplementedError。
 * 占用 id = 'mental-health'，避免未来 v3.8.0 实施时命名冲突。
 *
 * **注册到 registry 但 enabled=false**，
 * 不会被任何生产路径调用，仅作为接口占位符存在。
 */
export class MentalHealthDataSourceReserved implements MentalHealthDataSource {
  readonly id = 'mental-health';
  readonly name = '心理健康数据源（预留 P3）';
  readonly enabled = false;

  /**
   * 心理筛查 —— v3.8.0 实施
   */
  async screen(_params: {
    scale: MentalHealthCapability;
    answers: number[];
  }): Promise<MentalScreeningResult> {
    throw new P3NotImplementedError('心理筛查');
  }

  /**
   * 危机干预检测 —— v3.8.0 实施
   */
  async detectCrisis(_params: {
    text: string;
    context?: Record<string, unknown>;
  }): Promise<CrisisSignal> {
    throw new P3NotImplementedError('危机干预检测');
  }

  /**
   * 情绪追踪 —— v3.8.0 实施
   */
  async trackMood(_params: {
    userId: string;
    entry: MoodEntry;
  }): Promise<{ stored: boolean }> {
    throw new P3NotImplementedError('情绪追踪');
  }
}

// ============================================================================
// MedicalDataSource 桥接适配器（让 MentalHealth 接入统一 registry）
// ============================================================================

/**
 * 把 MentalHealthDataSourceReserved 包装成 MedicalDataSource，
 * 这样它能注册到现有的 MedicalDataSourceRegistry。
 *
 * 桥接后的能力声明只暴露 'qa'（医疗问答），
 * 实际调用时会立即抛出 P3NotImplementedError。
 */
export class MentalHealthBridgeAdapter implements MedicalDataSource {
  readonly id = 'mental-health-bridge';
  readonly name = '心理健康桥接适配器（预留 P3）';
  readonly priority = 999;  // 最低优先级，永远不会被选为主数据源
  readonly capabilities: Capability[] = ['qa'];  // 仅占位
  readonly enabled = false;

  private inner: MentalHealthDataSourceReserved;

  constructor() {
    this.inner = new MentalHealthDataSourceReserved();
  }

  async query<T>(_capability: Capability, _params: Record<string, unknown>): Promise<T> {
    throw new P3NotImplementedError('心理数据查询');
  }

  async healthCheck(): Promise<boolean> {
    return false;  // 永远返回不可用
  }
}

// ============================================================================
// 导出
// ============================================================================

export default MentalHealthDataSourceReserved;
export {
  MentalHealthDataSourceReserved,
  MentalHealthBridgeAdapter,
  P3NotImplementedError,
  // 类型导出
  MentalHealthCapability,
  MentalScreeningResult,
  CrisisSignal,
  MoodEntry
};
