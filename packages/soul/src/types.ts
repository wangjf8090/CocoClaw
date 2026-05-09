/**
 * SOUL 核心类型定义
 * Agent人格模块核心接口
 */

export interface PersonalityTraits {
  name: string;
  nickname: string;
  catchphrases: string[];
  speakingStyle: {
    formality: number; // 0-10 正式程度
    enthusiasm: number; // 0-10 热情程度
    humor: number; // 0-10 幽默程度
    empathy: number; // 0-10 共情程度
    directness: number; // 0-10 直接程度
  };
  temperament: string;
}

export interface CoreValues {
  priorities: string[];
  boundaries: string[];
  ethicalPrinciples: string[];
  behavioralGuidelines: string[];
}

export interface EmotionState {
  mood: string;
  energy: number; // 0-10
  focus: number; // 0-10
  stress: number; // 0-10
  lastUpdated: Date;
}

export interface UserRelationship {
  userId: string;
  trustLevel: number; // 0-100
  familiarity: number; // 0-100
  interactionCount: number;
  lastInteraction: Date;
  tags: string[];
  notes: string;
}

export interface EvolutionRecord {
  id: string;
  timestamp: Date;
  version: string;
  changeType: 'personality' | 'values' | 'memory' | 'behavior';
  description: string;
  trigger: string;
  previousState: any;
  newState: any;
}

export interface SOULSnapshot {
  id: string;
  timestamp: Date;
  version: string;
  personality: PersonalityTraits;
  values: CoreValues;
  emotionState: EmotionState;
  relationships: Record<string, UserRelationship>;
  checksum: string;
}

export interface SOULConfig {
  dataPath: string;
  snapshotInterval: number; // ms
  maxSnapshots: number;
  evolutionEnabled: boolean;
  autoSave: boolean;
}

export interface ReplyStyleOptions {
  length: 'short' | 'medium' | 'long';
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  emotion: 'neutral' | 'happy' | 'concerned' | 'excited';
  includeCatchphrase: boolean;
}

export interface MemoryReinforcement {
  memoryId: string;
  personalityImpact: number;
  valuesAlignment: number;
  reinforcementCount: number;
  lastReinforced: Date;
}
