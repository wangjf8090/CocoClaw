/**
 * AI文本去味器
 * 去除AI生成痕迹，让内容更自然、更像人类书写
 * 
 * 参考：https://xiaping.coze.com/skill/ai-text-deodorizer
 */

class ContentDeodorizer {
  constructor() {
    this.name = 'AI Text Deodorizer';
    this.version = '1.0.0';
    
    // AI写作常见特征模式
    this.aiPatterns = {
      // 过度使用的连接词
      connectors: [
        '首先', '其次', '最后', '综上所述',
        '一方面...另一方面', '然而', '但是',
        '因此', '所以', '由此可见', '总的来说'
      ],
      
      // 过度使用的副词
      adverbs: [
        '非常', '十分', '极其', '相当', '非常',
        '尤为', '格外', '简直', '确实', '的确'
      ],
      
      // AI爱用的开头句式
      openings: [
        '首先，', '其次，', '值得注意的是',
        '可以说', '毫无疑问', '毫无疑问地',
        '不得不承认', '必须承认', '诚然'
      ],
      
      // 过度完美的句式
      perfectPatterns: [
        /，因此/g,
        /。因此/g,
        /，所以/g,
        /。所以/g
      ],
      
      // 过度使用标点符号
      punctuation: ['；', '：']
    };
    
    // 去味策略强度
    this.intensityLevels = {
      light: { connectorLimit: 3, adverbLimit: 5 },
      medium: { connectorLimit: 2, adverbLimit: 3 },
      strong: { connectorLimit: 1, adverbLimit: 2 }
    };
  }

  /**
   * 主去味方法
   * @param {string} text - 待处理文本
   * @param {string} level - 强度: light/medium/strong
   * @returns {object} - { text, report }
   */
  deodorize(text, level = 'medium') {
    const original = text;
    const report = {
      originalLength: text.length,
      changes: [],
      aiScore: this.detectAIScore(text)
    };
    
    let result = text;
    
    // 1. 替换过度使用的连接词
    result = this.replaceConnectors(result, report);
    
    // 2. 替换过度使用的副词
    result = this.replaceAdverbs(result, report);
    
    // 3. 修改AI风格开头
    result = this.fixOpenings(result, report);
    
    // 4. 打破过度完美的句式
    result = this.breakPerfectSentences(result, report);
    
    // 5. 增加口语化元素
    result = this.addCasualElements(result, report);
    
    // 6. 调整段落节奏
    result = this.adjustRhythm(result, report);
    
    report.finalLength = result.length;
    report.finalScore = this.detectAIScore(result);
    report.improvement = report.aiScore - report.finalScore;
    
    return {
      text: result,
      report
    };
  }

  /**
   * 检测AI生成概率
   */
  detectAIScore(text) {
    let score = 0;
    const length = text.length;
    
    // 计算连接词密度
    let connectorCount = 0;
    this.aiPatterns.connectors.forEach(conn => {
      const regex = new RegExp(conn, 'gi');
      connectorCount += (text.match(regex) || []).length;
    });
    
    // 计算副词密度
    let adverbCount = 0;
    this.aiPatterns.adverbs.forEach(adv => {
      const regex = new RegExp(adv, 'gi');
      adverbCount += (text.match(regex) || []).length;
    });
    
    // 计算每千字的连接词和副词数量
    const perThousand = length / 1000;
    const connectorDensity = connectorCount / perThousand;
    const adverbDensity = adverbCount / perThousand;
    
    // AI味评分（0-100）
    if (connectorDensity > 10) score += 30;
    else if (connectorDensity > 5) score += 15;
    
    if (adverbDensity > 8) score += 25;
    else if (adverbDensity > 4) score += 12;
    
    // 检查常见AI句式
    const aiPhrases = ['首先，其次，最后', '综上所述', '值得注意的是', '可以说'];
    aiPhrases.forEach(phrase => {
      if (text.includes(phrase)) score += 10;
    });
    
    // 段落长度均匀性检查
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      const lengths = paragraphs.map(p => p.length);
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
      // 方差太小说明太规整，可能是AI
      if (variance < avg * 0.3) score += 15;
    }
    
    return Math.min(100, score);
  }

  /**
   * 替换过度使用的连接词
   */
  replaceConnectors(text, report) {
    const replacements = {
      '首先': '开头',
      '其次': '接着',
      '最后': '总之',
      '因此': '',
      '所以': '',
      '由此可见': '这么看',
      '综上所述': '总的来看',
      '然而': '不过',
      '但是': '但'
    };
    
    let result = text;
    Object.entries(replacements).forEach(([from, to]) => {
      const regex = new RegExp(from, 'gi');
      const matches = result.match(regex);
      if (matches) {
        const count = matches.length;
        if (count > 2) {
          result = result.replace(regex, () => Math.random() > 0.5 ? from : to);
          report.changes.push(`连接词"${from}": 替换${Math.floor(count / 2)}处`);
        }
      }
    });
    
    return result;
  }

  /**
   * 替换过度使用的副词
   */
  replaceAdverbs(text, report) {
    const replacements = {
      '非常': ['特别', '蛮', '挺', ''],
      '十分': ['特别', '相当', ''],
      '极其': ['超', '特别', ''],
      '相当': ['挺', '蛮', ''],
      '确实': ['真', '的确', ''],
      '的确': ['确实', '真', '']
    };
    
    let result = text;
    Object.entries(replacements).forEach(([from, toList]) => {
      const regex = new RegExp(from, 'gi');
      const matches = result.match(regex);
      if (matches && matches.length > 2) {
        result = result.replace(regex, () => {
          const choice = toList[Math.floor(Math.random() * toList.length)];
          return choice || '';
        });
        report.changes.push(`副词"${from}": 替换${Math.floor(matches.length * 0.6)}处`);
      }
    });
    
    return result;
  }

  /**
   * 修改AI风格开头
   */
  fixOpenings(text, report) {
    const badOpenings = [
      { from: '首先，', to: '' },
      { from: '其次，', to: '接着' },
      { from: '值得注意的是，', to: '' },
      { from: '可以说，', to: '' },
      { from: '毫无疑问，', to: '' }
    ];
    
    let result = text;
    badOpenings.forEach(({ from, to }) => {
      if (result.includes(from)) {
        result = result.replace(from, to);
        report.changes.push(`AI开头"${from}": 已移除`);
      }
    });
    
    return result;
  }

  /**
   * 打破过度完美的句式
   */
  breakPerfectSentences(text, report) {
    let result = text;
    
    // 把"因此"开头的句子改成另起一段
    result = result.replace(/，因此/g, '。\n');
    result = result.replace(/。因此/g, '。\n');
    result = result.replace(/，所以/g, '。');
    result = result.replace(/。所以/g, '。');
    
    return result;
  }

  /**
   * 增加口语化元素
   */
  addCasualElements(text, report) {
    let result = text;
    
    // 随机添加口语化表达
    const casualPhrases = [
      '说实话',
      '你看',
      '说真的',
      '其实',
      '这么说吧'
    ];
    
    // 找段落开头，添加口语化元素
    const paragraphs = result.split('\n');
    paragraphs.forEach((para, idx) => {
      if (para.length > 50 && Math.random() > 0.7) {
        const casual = casualPhrases[Math.floor(Math.random() * casualPhrases.length)];
        if (!para.includes(casual)) {
          paragraphs[idx] = casual + '，' + para.charAt(0).toLowerCase() + para.slice(1);
          report.changes.push(`口语化: 段落${idx + 1}添加"${casual}"`);
        }
      }
    });
    
    return paragraphs.join('\n');
  }

  /**
   * 调整段落节奏
   */
  adjustRhythm(text, report) {
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    // 确保段落长度有变化
    paragraphs.forEach((para, idx) => {
      // 短段落可以更短
      if (para.length > 200 && para.length < 250) {
        const half = Math.floor(para.length / 2);
        // 在中间某个句号处分段
        const midPoint = para.indexOf('。', half - 50);
        if (midPoint > 0 && midPoint < para.length - 50) {
          const newPara = para.slice(0, midPoint + 1) + '\n\n' + para.slice(midPoint + 1);
          paragraphs[idx] = newPara;
          report.changes.push(`节奏调整: 段落${idx + 1}拆分`);
        }
      }
    });
    
    return paragraphs.join('\n');
  }

  /**
   * 生成去味报告
   */
  generateReport(originalText, deodorizedText) {
    const originalScore = this.detectAIScore(originalText);
    const finalScore = this.detectAIScore(deodorizedText);
    
    return {
      summary: {
        originalScore,
        finalScore,
        improvement: originalScore - finalScore,
        level: originalScore > 60 ? 'strong' : originalScore > 40 ? 'medium' : 'light'
      },
      metrics: {
        originalLength: originalText.length,
        finalLength: deodorizedText.length,
        changeRate: ((deodorizedText.length - originalText.length) / originalText.length * 100).toFixed(1) + '%'
      },
      recommendation: this.getRecommendation(originalScore, finalScore)
    };
  }

  /**
   * 获取建议
   */
  getRecommendation(originalScore, finalScore) {
    if (originalScore < 30) {
      return '原文已经很自然，无需过度处理';
    } else if (finalScore > 30) {
      return '建议配合写作框架重新组织内容结构';
    } else if (finalScore > 15) {
      return '去味效果良好，内容已接近自然书写风格';
    } else {
      return '去味效果显著，内容自然度大幅提升';
    }
  }
}

module.exports = ContentDeodorizer;
