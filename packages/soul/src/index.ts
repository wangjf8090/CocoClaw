/**
 * @selfclaw/soul - Agent Personality Module
 * SelfClaw 框架的 SOUL 核心模块
 * 
 * 提供 Agent 人格、情绪、关系管理和身份持久化功能
 */

export * from './types';
export { SOULCore } from './soul-core';
export { EmotionStateMachine } from './emotion-state-machine';
export { ReplyStyleGenerator } from './reply-style-generator';
export { RelationshipModel } from './relationship-model';
export { IdentityPersistence } from './identity-persistence';

import { SOULCore } from './soul-core';

/**
 * 创建并初始化 SOUL 实例
 */
export async function createSOUL(config?: any): Promise<SOULCore> {
  const soul = new SOULCore(config);
  await soul.initialize();
  return soul;
}

/**
 * SOUL 模块版本
 */
export const VERSION = '1.0.0';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  dataPath: './data/soul',
  snapshotInterval: 3600000, // 1 hour
  maxSnapshots: 100,
  evolutionEnabled: true,
  autoSave: true
};

export default {
  createSOUL,
  SOULCore,
  VERSION,
  DEFAULT_CONFIG
};
