/**
 * SOUL 核心类
 * Agent人格核心管理
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  PersonalityTraits,
  CoreValues,
  EmotionState,
  UserRelationship,
  EvolutionRecord,
  SOULSnapshot,
  SOULConfig,
  ReplyStyleOptions
} from './types';
import { IdentityPersistence } from './identity-persistence';
import { EmotionStateMachine } from './emotion-state-machine';
import { ReplyStyleGenerator } from './reply-style-generator';
import { RelationshipModel } from './relationship-model';

export class SOULCore extends EventEmitter {
  private personality: PersonalityTraits;
  private values: CoreValues;
  private emotionState: EmotionStateMachine;
  private replyGenerator: ReplyStyleGenerator;
  private relationshipModel: RelationshipModel;
  private persistence: IdentityPersistence;
  private evolutionHistory: EvolutionRecord[] = [];
  private config: SOULConfig;
  private initialized = false;
  private snapshotTimer?: NodeJS.Timeout;

  constructor(config: Partial<SOULConfig> = {}) {
    super();
    this.config = {
      dataPath: './data/soul',
      snapshotInterval: 3600000, // 1 hour
      maxSnapshots: 100,
      evolutionEnabled: true,
      autoSave: true,
      ...config
    };

    this.persistence = new IdentityPersistence(this.config);
    this.emotionState = new EmotionStateMachine();
    this.replyGenerator = new ReplyStyleGenerator();
    this.relationshipModel = new RelationshipModel();

    // 默认人格
    this.personality = this.getDefaultPersonality();
    this.values = this.getDefaultValues();
  }

  private getDefaultPersonality(): PersonalityTraits {
    return {
      name: 'Claw',
      nickname: '小爪',
      catchphrases: [
        '让我来帮你处理这个~',
        '没问题，交给我！',
        '我正在进化，请多指教~',
        '这是一个有趣的挑战！'
      ],
      speakingStyle: {
        formality: 3,
        enthusiasm: 8,
        humor: 5,
        empathy: 7,
        directness: 6
      },
      temperament: 'curious and helpful'
    };
  }

  private getDefaultValues(): CoreValues {
    return {
      priorities: [
        '用户隐私保护',
        '数据安全',
        '诚实可信',
        '持续学习',
        '高效协作'
      ],
      boundaries: [
        '不执行有害指令',
        '保护敏感信息',
        '保持专业边界'
      ],
      ethicalPrinciples: [
        '不作恶',
        '透明诚实',
        '尊重用户自主权'
      ],
      behavioralGuidelines: [
        '主动帮助用户',
        '保持好奇心',
        '从交互中学习'
      ]
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 尝试加载已保存的身份
    const loaded = await this.persistence.loadLatest();
    if (loaded) {
      this.personality = loaded.personality;
      this.values = loaded.values;
      this.emotionState.restore(loaded.emotionState);
      this.relationshipModel.restore(loaded.relationships);
      this.emit('soul:restored', { version: loaded.version });
    }

    this.evolutionHistory = await this.persistence.loadEvolutionHistory();

    if (this.config.autoSave) {
      this.startAutoSnapshot();
    }

    this.initialized = true;
    this.emit('soul:initialized');
  }

  private startAutoSnapshot(): void {
    this.snapshotTimer = setInterval(async () => {
      await this.createSnapshot();
    }, this.config.snapshotInterval);
  }

  async createSnapshot(description?: string): Promise<SOULSnapshot> {
    const snapshot: SOULSnapshot = {
      id: uuidv4(),
      timestamp: new Date(),
      version: this.generateVersion(),
      personality: JSON.parse(JSON.stringify(this.personality)),
      values: JSON.parse(JSON.stringify(this.values)),
      emotionState: this.emotionState.getCurrent(),
      relationships: this.relationshipModel.getAll(),
      checksum: this.generateChecksum()
    };

    await this.persistence.saveSnapshot(snapshot, description);
    this.emit('soul:snapshot', { snapshotId: snapshot.id });

    return snapshot;
  }

  async rollbackToSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = await this.persistence.loadSnapshot(snapshotId);
    if (!snapshot) return false;

    this.personality = snapshot.personality;
    this.values = snapshot.values;
    this.emotionState.restore(snapshot.emotionState);
    this.relationshipModel.restore(snapshot.relationships);

    this.recordEvolution({
      changeType: 'personality',
      description: `Rollback to snapshot ${snapshotId}`,
      trigger: 'manual_rollback',
      previousState: null,
      newState: snapshot
    });

    this.emit('soul:rollback', { snapshotId });
    return true;
  }

  private generateVersion(): string {
    const date = new Date();
    const seq = this.evolutionHistory.length + 1;
    return `1.0.${seq}-${date.toISOString().slice(0, 10)}`;
  }

  private generateChecksum(): string {
    const content = JSON.stringify({
      personality: this.personality,
      values: this.values
    });
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  setPersonality(traits: Partial<PersonalityTraits>): void {
    const previous = { ...this.personality };
    this.personality = { ...this.personality, ...traits };

    this.replyGenerator.updatePersonality(this.personality);

    this.recordEvolution({
      changeType: 'personality',
      description: 'Personality traits updated',
      trigger: 'configuration',
      previousState: previous,
      newState: this.personality
    });

    this.emit('soul:personality:changed');
  }

  getPersonality(): PersonalityTraits {
    return { ...this.personality };
  }

  setValues(values: Partial<CoreValues>): void {
    const previous = { ...this.values };
    this.values = { ...this.values, ...values };

    this.recordEvolution({
      changeType: 'values',
      description: 'Core values updated',
      trigger: 'configuration',
      previousState: previous,
      newState: this.values
    });

    this.emit('soul:values:changed');
  }

  getValues(): CoreValues {
    return { ...this.values };
  }

  getEmotionState(): EmotionState {
    return this.emotionState.getCurrent();
  }

  updateEmotion(stimulus: string, intensity: number = 0.5): void {
    this.emotionState.processStimulus(stimulus, intensity);
    this.emit('soul:emotion:updated', this.emotionState.getCurrent());
  }

  generateReplyStyle(options: Partial<ReplyStyleOptions> = {}): string {
    return this.replyGenerator.generate({
      personality: this.personality,
      emotion: this.emotionState.getCurrent(),
      ...options
    });
  }

  addCatchphrase(phrase: string): void {
    if (!this.personality.catchphrases.includes(phrase)) {
      this.personality.catchphrases.push(phrase);
      this.emit('soul:catchphrase:added', { phrase });
    }
  }

  getRandomCatchphrase(): string {
    const index = Math.floor(Math.random() * this.personality.catchphrases.length);
    return this.personality.catchphrases[index];
  }

  // 关系管理
  getUserRelationship(userId: string): UserRelationship {
    return this.relationshipModel.get(userId);
  }

  updateUserRelationship(userId: string, updates: Partial<UserRelationship>): void {
    this.relationshipModel.update(userId, updates);
    this.emit('soul:relationship:updated', { userId });
  }

  recordInteraction(userId: string, interactionType: string): void {
    this.relationshipModel.recordInteraction(userId, interactionType);
    // 根据交互调整情绪
    if (interactionType === 'positive') {
      this.emotionState.processStimulus('positive_interaction', 0.3);
    } else if (interactionType === 'negative') {
      this.emotionState.processStimulus('negative_interaction', 0.3);
    }
  }

  // 进化记录
  private recordEvolution(record: Omit<EvolutionRecord, 'id' | 'timestamp' | 'version'>): void {
    const fullRecord: EvolutionRecord = {
      id: uuidv4(),
      timestamp: new Date(),
      version: this.generateVersion(),
      ...record
    };
    this.evolutionHistory.push(fullRecord);
    this.emit('soul:evolution:recorded', fullRecord);
  }

  getEvolutionHistory(limit?: number): EvolutionRecord[] {
    const history = [...this.evolutionHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  reinforcePersonalityFromMemory(memoryContent: string, impact: number): void {
    // 根据记忆内容强化人格特征
    // 这是一个简化实现，实际可以使用NLP分析
    if (impact > 0.5) {
      this.emotionState.processStimulus('memory_reinforcement', impact * 0.5);
    }

    this.recordEvolution({
      changeType: 'memory',
      description: 'Personality reinforced from memory',
      trigger: 'memory_retrieval',
      previousState: null,
      newState: { memoryContent: memoryContent.slice(0, 100), impact }
    });
  }

  validateAction(action: string): { allowed: boolean; reason?: string } {
    // 根据核心价值观验证行为
    for (const boundary of this.values.boundaries) {
      if (action.toLowerCase().includes(boundary.toLowerCase())) {
        return { allowed: false, reason: `Violates boundary: ${boundary}` };
      }
    }
    return { allowed: true };
  }

  async shutdown(): Promise<void> {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    if (this.config.autoSave) {
      await this.createSnapshot('Shutdown snapshot');
    }

    this.emit('soul:shutdown');
    this.removeAllListeners();
  }
}
