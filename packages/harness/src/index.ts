/**
 * @selfclaw/harness
 *
 * Self-Evolution Harness - The core innovation of SelfClaw
 * 自我进化编排层 - SelfClaw的核心创新
 *
 * Features:
 * - Three evolution circuits: Permission, Performance, Memory
 * - A/B testing framework for safe evolution
 * - Rollback mechanism for safety guarantees
 * - Automatic context assembly from memory
 * - Query orchestration with security hooks
 */

// Core types
export * from './types.js';

// Evolvers
export { PermissionEvolver } from './permission-evolver.js';
export { PerformanceEvolver } from './performance-evolver.js';
export { MemoryEvolver } from './memory-evolver.js';

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
