/**
 * SelfClaw AI内容合规标注模块
 * 根据国家网信办新规：AI生成内容必须强制标注
 * 支持6类"必选标签"，确保内容合规
 */

class AIContentLabeling {
  constructor() {
    // 6类必选标签（根据官方要求）
    this.labelCategories = {
      'AIGC': {
        name: 'AI生成内容',
        description: '由人工智能生成的全部内容',
        conditions: ['全文由AI生成', 'AI作为主要创作工具']
      },
      'AIGC-PARTIAL': {
        name: '部分AI生成',
        description: '部分内容由AI生成，部分为人类原创',
        conditions: ['AI辅助创作', '部分段落AI生成', 'AI改写润色']
      },
      'AIGC-EDITED': {
        name: 'AI生成经人工编辑',
        description: 'AI生成内容经过人工审核和大幅修改',
        conditions: ['AI初稿+人工编辑', 'AI生成后人工改写']
      },
      'AIGC-TRANSLATE': {
        name: 'AI翻译',
        description: '使用AI工具进行的翻译内容',
        conditions: ['AI翻译生成', '机器翻译']
      },
      'AIGC-SUMMARY': {
        name: 'AI摘要/整理',
        description: 'AI对已有内容进行的摘要、整理、总结',
        conditions: ['AI摘要', 'AI内容整理', 'AI文本总结']
      },
      'AIGC-OTHER': {
        name: '其他AI生成',
        description: '其他使用AI技术生成的内容类型',
        conditions: ['其他AI辅助生成']
      }
    };

    this.disclaimers = {
      standard: '本文内容由人工智能辅助生成，仅供参考，请审慎判断。',
      creative: '本文部分内容由AI辅助创作，最终呈现经人工审核确认。',
      technical: '本文技术内容由AI辅助整理，如有错误欢迎指正。',
      strict: '【AI生成标注】本文为人工智能生成内容，不代表平台观点。'
    };

    this.redLines = [
      '必须主动声明使用AI',
      '禁止破坏或移除AI标识',
      '重点场景（新闻、政务、医疗等）加倍严格',
      '需留存生成底稿和过程记录'
    ];
  }

  /**
   * 检测内容类型并推荐合适的标签
   */
  detectLabelType(content, options = {}) {
    const { aiPercentage = 100, isEdited = false, isTranslation = false, isSummary = false } = options;

    if (isTranslation) {
      return 'AIGC-TRANSLATE';
    }
    if (isSummary) {
      return 'AIGC-SUMMARY';
    }
    if (aiPercentage >= 90 && !isEdited) {
      return 'AIGC';
    }
    if (aiPercentage >= 50 && isEdited) {
      return 'AIGC-EDITED';
    }
    if (aiPercentage > 0 && aiPercentage < 50) {
      return 'AIGC-PARTIAL';
    }
    return 'AIGC-OTHER';
  }

  /**
   * 生成合规标注文本
   */
  generateLabel(labelType, options = {}) {
    const category = this.labelCategories[labelType];
    if (!category) {
      throw new Error(`未知的标签类型: ${labelType}`);
    }

    const label = {
      type: labelType,
      name: category.name,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    // 生成标注文本
    let labelText = `【${category.name}】`;
    
    if (options.includeDisclaimer) {
      const disclaimerType = options.disclaimerType || 'standard';
      labelText += ` ${this.disclaimers[disclaimerType]}`;
    }

    if (options.includeTimestamp) {
      labelText += ` (生成时间: ${new Date().toLocaleString('zh-CN')})`;
    }

    label.text = labelText;
    return label;
  }

  /**
   * 在内容末尾添加标注
   */
  addLabelToContent(content, labelType, options = {}) {
    const label = this.generateLabel(labelType, options);
    
    let labeledContent = content;
    
    // 添加分隔线
    labeledContent += '\n\n---\n\n';
    
    // 添加标注
    labeledContent += `<sub>${label.text}</sub>`;
    
    if (options.includeDraftHash) {
      // 添加内容哈希用于追溯
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(content).digest('hex');
      labeledContent += `\n<sub>内容哈希: ${hash}</sub>`;
    }

    return {
      content: labeledContent,
      label: label,
      compliance: this.checkCompliance(labeledContent)
    };
  }

  /**
   * 检查内容是否已标注
   */
  isLabeled(content) {
    const labelPatterns = [
      /【AI生成.*】/,
      /人工智能生成/,
      /AI辅助生成/,
      /AIGC/i,
      /本文由AI生成/
    ];
    
    return labelPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 合规性检查
   */
  checkCompliance(content) {
    const results = {
      isLabeled: this.isLabeled(content),
      issues: [],
      suggestions: []
    };

    // 检查是否有标注
    if (!results.isLabeled) {
      results.issues.push('未添加AI生成标注');
      results.suggestions.push('建议使用 addLabelToContent() 方法添加合规标注');
    }

    // 检查是否可能是AI生成但未标注
    const aiIndicators = [
      { pattern: /作为一个(AI|人工智能|大语言模型)/i, weight: 3 },
      { pattern: /根据我的(训练|学习|知识)/i, weight: 2 },
      { pattern: /截止到.*202[45]/i, weight: 1 }
    ];

    let aiScore = 0;
    aiIndicators.forEach(indicator => {
      if (indicator.pattern.test(content)) {
        aiScore += indicator.weight;
      }
    });

    if (aiScore >= 3 && !results.isLabeled) {
      results.issues.push('高概率为AI生成内容但未标注');
      results.suggestions.push('该内容包含典型AI生成特征，建议添加标注');
    }

    results.score = results.isLabeled ? 100 : Math.max(0, 60 - aiScore * 5);
    results.pass = results.isLabeled && results.issues.length === 0;

    return results;
  }

  /**
   * 批量处理内容标注
   */
  batchLabel(contents, labelType, options = {}) {
    return contents.map(content => {
      try {
        return this.addLabelToContent(content, labelType, options);
      } catch (error) {
        return {
          content,
          error: error.message,
          success: false
        };
      }
    });
  }

  /**
   * 生成合规报告
   */
  generateComplianceReport(contents) {
    const report = {
      generatedAt: new Date().toISOString(),
      totalCount: contents.length,
      labeledCount: 0,
      unlabeledCount: 0,
      highRiskCount: 0,
      details: []
    };

    contents.forEach((content, index) => {
      const compliance = this.checkCompliance(content);
      report.details.push({
        index,
        ...compliance
      });
      
      if (compliance.isLabeled) {
        report.labeledCount++;
      } else {
        report.unlabeledCount++;
        if (compliance.score < 50) {
          report.highRiskCount++;
        }
      }
    });

    report.complianceRate = Math.round((report.labeledCount / report.totalCount) * 10000) / 100;

    return report;
  }

  /**
   * 获取4条红线说明
   */
  getRedLines() {
    return {
      title: 'AI生成内容合规四条红线',
      lines: this.redLines.map((line, index) => ({
        id: index + 1,
        content: line
      }))
    };
  }

  /**
   * 获取所有可用标签类别
   */
  getLabelCategories() {
    return Object.entries(this.labelCategories).map(([key, value]) => ({
      code: key,
      ...value
    }));
  }
}

module.exports = AIContentLabeling;
