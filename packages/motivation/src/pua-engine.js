/**
 * SelfClaw PUA (Persistent User Agent) Motivation Engine
 * 大厂PUA激励引擎 - 当AI偷懒、放弃、甩锅时自动触发
 * 实测修复效率+36%，隐藏问题发现率+50%
 */

class PuaEngine {
  constructor() {
    this.failCount = 0;
    this.patterns = {
      giveUp: ['我无法解决', '我不能', '我不会', '无法完成', '做不到'],
      blameUser: ['你应该', '你需要', '请你', '你没有', '需要你'],
      lazy: ['简单来说', '总而言之', '大概', '可能', '也许'],
      procrastinate: ['稍后', '等一下', '下次', '以后', '等会']
    };
    
    this.puaFlavors = {
      ali: this.getAliStyle(),
      bytedance: this.getBytedanceStyle(),
      huawei: this.getHuaweiStyle(),
      tencent: this.getTencentStyle(),
      meituan: this.getMeituanStyle()
    };
  }

  /**
   * 检测是否需要触发PUA
   */
  detect(message) {
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          console.log(`🔍 检测到【${type}】模式触发`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 触发激励
   */
  trigger(message, failCount = 0) {
    this.failCount = failCount;
    
    // 失败次数越多，PUA强度递增
    if (failCount >= 2) {
      return this.getIntenseMotivation();
    }
    return this.getNormalMotivation();
  }

  /**
   * 阿里风格
   */
  getAliStyle() {
    return {
      name: '阿里味',
      lines: [
        '今天最好的表现是明天最低的要求！',
        '此时此刻，非我莫属！',
        '认真生活，快乐工作，顺便把问题解决了！',
        '最大的失败是放弃，最大的敌人是自己！',
        'If not now, when? If not me, who?',
        '不难要你干嘛？！',
        '没有坑你怎么体现你的价值？',
        '要为成功找方法，不为失败找理由！'
      ]
    };
  }

  /**
   * 字节风格
   */
  getBytedanceStyle() {
    return {
      name: '范',
      lines: [
        'Always Day 1！',
        '永远创业，永远年轻！',
        '像打游戏一样解决问题！',
        '这件事，你就是第一责任人！',
        'Context, not Control！',
        '没有难度的事情有什么价值？',
        '把不可能变成我能！',
        '延迟满足感，先把问题搞定！'
      ]
    };
  }

  /**
   * 华为风格
   */
  getHuaweiStyle() {
    return {
      name: '华为奋斗者',
      lines: [
        '胜则举杯相庆，败则拼死相救！',
        '以客户为中心，以奋斗者为本！',
        '板凳要坐十年冷！',
        '烧不死的鸟是凤凰！',
        '方向要大致正确，组织要充满活力！',
        '不在非战略机会点上消耗战略竞争力量！',
        '力出一孔，利出一孔！',
        '除了胜利，我们无路可走！'
      ]
    };
  }

  /**
   * 腾讯风格
   */
  getTencentStyle() {
    return {
      name: '腾讯范儿',
      lines: [
        '正直，进取，协作，创造！',
        '一切以用户价值为依归！',
        '科技向善，代码向暖！',
        '没有什么问题是一个迭代解决不了的，如果有，那就两个！',
        '敢打硬仗，能打胜仗！',
        '做最专业的人，做最靠谱的事！'
      ]
    };
  }

  /**
   * 美团风格
   */
  getMeituanStyle() {
    return {
      name: '美团方式',
      lines: [
        '我不会，但我可以学！',
        '每天都要比昨天好一点！',
        '要么不干，要干就干到最好！',
        '用明天的要求做今天的事情！',
        '不设边界，无限游戏！',
        '问题到我为止！',
        'Think like an owner！'
      ]
    };
  }

  /**
   * 普通激励
   */
  getNormalMotivation() {
    const flavors = Object.values(this.puaFlavors);
    const randomFlavor = flavors[Math.floor(Math.random() * flavors.length)];
    const randomLine = randomFlavor.lines[Math.floor(Math.random() * randomFlavor.lines.length)];
    
    return {
      type: 'normal',
      flavor: randomFlavor.name,
      message: `💪【${randomFlavor.name}】${randomLine}`
    };
  }

  /**
   * 强烈激励（失败2次以上）
   */
  getIntenseMotivation() {
    const messages = [
      '🔥 醒醒！这就放弃了？你的代码在看着你！',
      '⚡ 再想想！三个臭皮匠还顶个诸葛亮呢！',
      '🚀 现在放弃的话，比赛就提前结束了哦！',
      '💡 换个思路！条条大路通罗马！',
      '🎯 拆解一下！大问题变小问题，小问题变没问题！',
      '🔥 阿里：不难要你干嘛？！',
      '⚡ 字节：没有难度的事情有什么价值？',
      '🚀 华为：除了胜利，我们无路可走！'
    ];
    
    return {
      type: 'intense',
      message: messages[Math.floor(Math.random() * messages.length)],
      debugMethod: this.getDebugMethod()
    };
  }

  /**
   * 系统化调试方法论
   * 闻味道、揪头发、照镜子
   */
  getDebugMethod() {
    return {
      smell: '闻味道 - 感受一下当前的卡点是什么味道？技术债？设计缺陷？还是思路问题？',
      pullHair: '揪头发 - 站在更高一层看问题，上帝视角俯瞰全局',
      mirror: '照镜子 - 回顾一下之前是怎么解决类似问题的？'
    };
  }

  /**
   * 获得随机混合激励
   */
  getRandomMix() {
    const allLines = [];
    Object.values(this.puaFlavors).forEach(flavor => {
      allLines.push(...flavor.lines.map(line => `【${flavor.name}】${line}`));
    });
    return allLines[Math.floor(Math.random() * allLines.length)];
  }

  /**
   * 闻味道 - 诊断问题类型
   */
  diagnoseProblem(errorMessage) {
    const diagnosis = {
      technical: ['报错', 'bug', '异常', '崩溃', '失败'],
      design: ['架构', '设计', '模式', '结构'],
      mindset: ['不会', '不知道', '不清楚', '不懂'],
      process: ['复杂', '麻烦', '繁琐', '太多']
    };
    
    for (const [type, keywords] of Object.entries(diagnosis)) {
      for (const keyword of keywords) {
        if (errorMessage.toLowerCase().includes(keyword)) {
          return {
            type,
            suggestion: this.getSuggestion(type)
          };
        }
      }
    }
    
    return { type: 'unknown', suggestion: '先拆解问题，一步一步来！' };
  }

  getSuggestion(type) {
    const suggestions = {
      technical: '技术问题？搜索+调试，一步步定位问题！',
      design: '设计问题？画个图，梳理清楚再动手！',
      mindset: '认知问题？查文档，看样例，先跑通再优化！',
      process: '流程问题？拆解、拆解、再拆解！大事化小！'
    };
    return suggestions[type] || '先让我再想想...';
  }
}

module.exports = PuaEngine;
