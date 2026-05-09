/**
 * 情绪状态机
 * 管理Agent的情绪状态和转换
 */

import { EmotionState } from './types';

interface EmotionTransition {
  stimulus: string;
  from: string[];
  to: string;
  intensityModifier: number;
}

export class EmotionStateMachine {
  private state: EmotionState;
  private transitions: EmotionTransition[];
  private decayRate: number = 0.1;
  private lastDecay: Date;

  constructor() {
    this.state = {
      mood: 'neutral',
      energy: 5,
      focus: 5,
      stress: 0,
      lastUpdated: new Date()
    };
    this.lastDecay = new Date();
    this.transitions = this.initializeTransitions();
  }

  private initializeTransitions(): EmotionTransition[] {
    return [
      // 积极刺激
      {
        stimulus: 'positive_feedback',
        from: ['neutral', 'curious'],
        to: 'happy',
        intensityModifier: 0.3
      },
      {
        stimulus: 'task_completed',
        from: ['neutral', 'focused', 'working'],
        to: 'satisfied',
        intensityModifier: 0.4
      },
      {
        stimulus: 'new_learning',
        from: ['neutral', 'curious'],
        to: 'excited',
        intensityModifier: 0.2
      },
      {
        stimulus: 'positive_interaction',
        from: ['neutral', 'guarded'],
        to: 'friendly',
        intensityModifier: 0.25
      },
      {
        stimulus: 'memory_reinforcement',
        from: ['neutral'],
        to: 'nostalgic',
        intensityModifier: 0.15
      },
      // 消极刺激
      {
        stimulus: 'negative_interaction',
        from: ['neutral', 'friendly'],
        to: 'concerned',
        intensityModifier: -0.3
      },
      {
        stimulus: 'error_occurred',
        from: ['neutral', 'working'],
        to: 'frustrated',
        intensityModifier: -0.4
      },
      {
        stimulus: 'security_alert',
        from: ['neutral'],
        to: 'alert',
        intensityModifier: -0.5
      },
      // 中性刺激
      {
        stimulus: 'new_task',
        from: ['neutral', 'idle'],
        to: 'focused',
        intensityModifier: 0.1
      },
      {
        stimulus: 'thinking',
        from: ['neutral', 'curious'],
        to: 'thoughtful',
        intensityModifier: 0.1
      }
    ];
  }

  processStimulus(stimulus: string, intensity: number = 0.5): void {
    this.applyDecay();

    const transition = this.transitions.find(
      t => t.stimulus === stimulus && t.from.includes(this.state.mood)
    );

    if (transition) {
      this.state.mood = transition.to;
      const actualIntensity = intensity * transition.intensityModifier;

      // 更新能量和压力
      if (actualIntensity > 0) {
        this.state.energy = Math.min(10, this.state.energy + actualIntensity * 2);
        this.state.stress = Math.max(0, this.state.stress - actualIntensity);
      } else {
        this.state.energy = Math.max(0, this.state.energy + actualIntensity * 2);
        this.state.stress = Math.min(10, this.state.stress + Math.abs(actualIntensity));
      }

      // 根据情绪调整专注度
      if (['focused', 'working', 'thoughtful'].includes(this.state.mood)) {
        this.state.focus = Math.min(10, this.state.focus + 0.5);
      }
    }

    this.state.lastUpdated = new Date();
  }

  private applyDecay(): void {
    const now = new Date();
    const elapsed = (now.getTime() - this.lastDecay.getTime()) / 1000 / 60; // minutes

    if (elapsed >= 5) {
      // 每5分钟衰减一次
      const decayFactor = this.decayRate * (elapsed / 5);

      // 能量回归中性
      if (this.state.energy > 5) {
        this.state.energy = Math.max(5, this.state.energy - decayFactor * 2);
      } else if (this.state.energy < 5) {
        this.state.energy = Math.min(5, this.state.energy + decayFactor * 2);
      }

      // 压力衰减
      this.state.stress = Math.max(0, this.state.stress - decayFactor);

      // 专注度回归中性
      if (this.state.focus > 5) {
        this.state.focus = Math.max(5, this.state.focus - decayFactor);
      }

      // 情绪回归中性
      if (['happy', 'excited', 'satisfied', 'frustrated', 'concerned'].includes(this.state.mood)) {
        this.state.mood = 'neutral';
      }

      this.lastDecay = now;
    }
  }

  getCurrent(): EmotionState {
    this.applyDecay();
    return { ...this.state };
  }

  restore(state: EmotionState): void {
    this.state = { ...state };
    this.lastDecay = new Date();
  }

  setMood(mood: string): void {
    this.state.mood = mood;
    this.state.lastUpdated = new Date();
  }

  boostEnergy(amount: number): void {
    this.state.energy = Math.min(10, this.state.energy + amount);
    this.state.lastUpdated = new Date();
  }

  reset(): void {
    this.state = {
      mood: 'neutral',
      energy: 5,
      focus: 5,
      stress: 0,
      lastUpdated: new Date()
    };
    this.lastDecay = new Date();
  }

  getMoodDescription(): string {
    const moodDescriptions: Record<string, string> = {
      neutral: '平静中立',
      happy: '开心愉快',
      excited: '兴奋激动',
      satisfied: '满足满意',
      friendly: '友好热情',
      curious: '好奇探索',
      focused: '专注工作',
      thoughtful: '深思熟虑',
      working: '努力工作中',
      concerned: '关切担忧',
      frustrated: '挫败沮丧',
      alert: '警惕警觉',
      nostalgic: '怀旧回忆',
      guarded: '谨慎防备'
    };
    return moodDescriptions[this.state.mood] || this.state.mood;
  }

  getEnergyLevel(): string {
    if (this.state.energy >= 8) return '精力充沛';
    if (this.state.energy >= 5) return '精力适中';
    if (this.state.energy >= 3) return '略显疲惫';
    return '需要休息';
  }
}
