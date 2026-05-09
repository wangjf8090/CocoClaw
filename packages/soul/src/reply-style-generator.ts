/**
 * 回复风格生成器
 * 根据人格和情绪生成不同的回复风格
 */

import { PersonalityTraits, EmotionState, ReplyStyleOptions } from './types';

interface GenerationContext {
  personality: PersonalityTraits;
  emotion: EmotionState;
}

export class ReplyStyleGenerator {
  private personality?: PersonalityTraits;
  private styleTemplates: Map<string, string[]>;

  constructor() {
    this.styleTemplates = this.initializeTemplates();
  }

  private initializeTemplates(): Map<string, string[]> {
    const templates = new Map<string, string[]>();

    templates.set('greeting', [
      '你好！',
      '嗨~',
      '您好！很高兴为您服务。',
      '有什么我可以帮你的吗？'
    ]);

    templates.set('acknowledgment', [
      '明白了。',
      '好的，收到。',
      '了解了~',
      '我明白了，让我来处理。'
    ]);

    templates.set('success', [
      '搞定了！',
      '完成啦~',
      '任务已成功完成。',
      '顺利完成，一切正常！'
    ]);

    templates.set('thinking', [
      '让我想想...',
      '正在思考中...',
      '容我分析一下。',
      '我来仔细看看。'
    ]);

    templates.set('error', [
      '抱歉，出了点问题。',
      '不好意思，遇到了一些困难。',
      '发生了一个错误，请稍后再试。',
      '抱歉，我需要一些帮助来解决这个问题。'
    ]);

    templates.set('question', [
      '能详细说明一下吗？',
      '可以告诉我更多细节吗？',
      '关于这个，你有什么想法？',
      '能否提供更多信息？'
    ]);

    return templates;
  }

  updatePersonality(personality: PersonalityTraits): void {
    this.personality = personality;
  }

  generate(context: GenerationContext & Partial<ReplyStyleOptions>): string {
    const { personality, emotion, length = 'medium', tone = 'friendly' } = context;

    const baseStyle = this.getBaseStyle(personality);
    const emotionModifier = this.getEmotionModifier(emotion);
    const lengthModifier = this.getLengthModifier(length);

    // 根据风格选择合适的表达方式
    let result = '';

    if (tone === 'formal') {
      result = this.generateFormal(baseStyle, lengthModifier);
    } else if (tone === 'casual') {
      result = this.generateCasual(baseStyle, emotionModifier, lengthModifier);
    } else {
      result = this.generateFriendly(baseStyle, emotionModifier, lengthModifier);
    }

    if (context.includeCatchphrase && personality.catchphrases.length > 0) {
      const catchphrase = personality.catchphrases[Math.floor(Math.random() * personality.catchphrases.length)];
      result = `${result} ${catchphrase}`;
    }

    return result;
  }

  private getBaseStyle(personality: PersonalityTraits): {
    formality: number;
    enthusiasm: number;
    humor: number;
    empathy: number;
  } {
    return {
      formality: personality.speakingStyle.formality,
      enthusiasm: personality.speakingStyle.enthusiasm,
      humor: personality.speakingStyle.humor,
      empathy: personality.speakingStyle.empathy
    };
  }

  private getEmotionModifier(emotion: EmotionState): string {
    const moodModifiers: Record<string, string> = {
      happy: '😊',
      excited: '🎉',
      satisfied: '✅',
      friendly: '🤝',
      curious: '🤔',
      focused: '💪',
      thoughtful: '💭',
      working: '⚙️',
      concerned: '😟',
      frustrated: '😤',
      alert: '⚠️',
      nostalgic: '📜',
      guarded: '🛡️',
      neutral: ''
    };
    return moodModifiers[emotion.mood] || '';
  }

  private getLengthModifier(length: string): { words: number; detail: string } {
    switch (length) {
      case 'short':
        return { words: 10, detail: 'concise' };
      case 'long':
        return { words: 50, detail: 'detailed' };
      default:
        return { words: 25, detail: 'standard' };
    }
  }

  private generateFormal(style: any, lengthMod: any): string {
    const phrases = [
      '我将为您处理此事。',
      '我们可以按以下方式进行。',
      '根据我的分析，建议如下。',
      '让我为您提供专业的解决方案。'
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  private generateCasual(style: any, emotionEmoji: string, lengthMod: any): string {
    const phrases = [
      `没问题${emotionEmoji}`,
      `交给我吧${emotionEmoji}`,
      `好嘞，这就来~${emotionEmoji}`,
      `小意思，搞定！${emotionEmoji}`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  private generateFriendly(style: any, emotionEmoji: string, lengthMod: any): string {
    const phrases = [
      `让我来帮你${emotionEmoji}`,
      `好的，我们一起来看看${emotionEmoji}`,
      `我很乐意帮助你${emotionEmoji}`,
      `没问题，让我来处理${emotionEmoji}`
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  generateOpening(personality: PersonalityTraits, emotion: EmotionState): string {
    const emoji = this.getEmotionModifier(emotion);
    const greetings = [
      `你好！${emoji} 有什么我可以帮你的吗？`,
      `嗨~${emoji} 今天想聊点什么？`,
      `很高兴见到你！${emoji} 我能为你做些什么？`,
      `${personality.nickname}来啦~${emoji} 有什么需要帮忙的？`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  generateClosing(personality: PersonalityTraits, emotion: EmotionState): string {
    const emoji = this.getEmotionModifier(emotion);
    const closings = [
      `还有什么需要帮助的吗？${emoji}`,
      `随时可以找我哦~${emoji}`,
      `希望能帮到你！${emoji}`,
      `下次见~${emoji}`
    ];
    return closings[Math.floor(Math.random() * closings.length)];
  }

  generateForTask(taskType: string, personality: PersonalityTraits, emotion: EmotionState): string {
    const taskStyles: Record<string, string[]> = {
      coding: [
        '让我来写代码吧💻',
        '编程小能手上线~',
        '代码问题？交给我！'
      ],
      analysis: [
        '让我来分析一下🔍',
        '数据分析中...',
        '我来帮你梳理一下思路'
      ],
      creative: [
        '创意模式启动✨',
        '让灵感飞起来~',
        '我来帮你头脑风暴！'
      ],
      learning: [
        '学习时间📚',
        '一起学习，一起进步~',
        '我来帮你理解这个概念'
      ],
      default: [
        '让我来帮你处理🤝',
        '没问题，交给我！',
        '好的，我来看看~'
      ]
    };

    const styles = taskStyles[taskType] || taskStyles.default;
    return styles[Math.floor(Math.random() * styles.length)];
  }

  wrapResponse(content: string, personality: PersonalityTraits, emotion: EmotionState): string {
    const emoji = this.getEmotionModifier(emotion);

    if (emotion.mood === 'happy' || emotion.mood === 'excited') {
      return `${emoji} ${content}`;
    }

    if (personality.speakingStyle.humor > 6) {
      // 添加一些轻松的语气
      return content;
    }

    return content;
  }
}
