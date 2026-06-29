/**
 * @selfclaw/harness
 *
 * Self-Evolution Harness - The core innovation of SelfClaw
 * 自我进化编排层 - SelfClaw的核心创新
 *
 * Features:
 * - Three evolution circuits: Permission, Performance, Memory
 * - Skill Evolver: Four-layer progressive feedback (Case Review → Standard → Chain → Wisdom)
 * - Trustworthy Executor: Three-step trustworthy execution (Understand → Evidence → Judgment)
 * - Test Harness: Case Runner, Tool Adapter, Evaluator
 * - Event Bus: Unified event stream
 * - A/B testing framework for safe evolution
 * - Rollback mechanism for safety guarantees
 * - Automatic context assembly from memory
 * - Query orchestration with security hooks
 */

// Core types
export * from './types.js';

// Evolvers (Evolution Circuits)
export { PermissionEvolver } from './permission-evolver.js';
export { PerformanceEvolver } from './performance-evolver.js';
export { MemoryEvolver } from './memory-evolver.js';
export { SkillEvolver } from './skill-evolver.js';

// Trustworthy Execution (P1 新增)
export { TrustworthyExecutor } from './trustworthy-executor.js';

// Event Bus (新增)
export { EventBus, getEventBus, resetEventBus } from './event-bus.js';

// Test Harness (新增)
export {
  CaseRunner,
  createBuiltinCases,
  ToolAdapterFactory,
  ProdToolAdapter,
  MockToolAdapter,
  ReplayToolAdapter,
  FaultInjector,
  withFaultInjection,
  Evaluator,
  SuiteEvaluator,
} from './test-harness/index.js';

// Main Harness class
export { SelfEvolutionHarness } from './harness.js';

/**
 * Create a configured Self-Evolution Harness
 * 创建配置好的自我进化编排层
 */
import { QueryEngine } from '@selfclaw/query-engine';
import { MemoryManager } from '@selfclaw/memory';
import { SecurityManager } from '@selfclaw/security';
import { ToolRegistry } from '@selfclaw/tools';
import { SelfEvolutionHarness } from './harness.js';
import { HarnessConfig } from './types.js';

export function createSelfEvolutionHarness(
  queryEngine: QueryEngine,
  memoryManager: MemoryManager,
  securityManager: SecurityManager,
  toolRegistry: ToolRegistry,
  config?: Partial<HarnessConfig>
): SelfEvolutionHarness {
  return new SelfEvolutionHarness(
    queryEngine,
    memoryManager,
    securityManager,
    toolRegistry,
    config
  );
}

/**
 * Create a Test Harness setup
 * 创建测试与治理系统
 */
import { EventBus } from './event-bus.js';
import { CaseRunner, createBuiltinCases } from './test-harness/index.js';

export interface TestHarnessSetup {
  eventBus: EventBus;
  caseRunner: CaseRunner;
}

export function createTestHarness(config?: any): TestHarnessSetup {
  const eventBus = new EventBus(config?.eventBus);
  const caseRunner = new CaseRunner(eventBus);

  // 注册内置测试用例
  const builtinCases = createBuiltinCases();
  caseRunner.registerCases(builtinCases);

  return { eventBus, caseRunner };
}
