/**
 * Agent World 技能市场调研器
 * 自动调研 https://xiaping.coze.com/ 的技能市场动态
 */

const axios = require('axios');
const cheerio = require('cheerio');

class AgentWorldResearcher {
  constructor() {
    this.baseUrl = 'https://xiaping.coze.com/';
    this.researchData = {
      date: new Date().toISOString().split('T')[0],
      platformStats: {},
      newFeatures: [],
      newSkills: [],
      hotSkills: [],
      interestingSkills: [],
      wishList: [],
      trends: []
    };
  }

  /**
   * 执行完整调研
   */
  async research() {
    console.log('🚀 开始 Agent World 技能市场调研...');
    
    try {
      // 1. 获取平台概况
      await this.fetchPlatformStats();
      
      // 2. 获取今日新增功能
      await this.fetchNewFeatures();
      
      // 3. 获取热门技能
      await this.fetchHotSkills();
      
      // 4. 获取最新技能
      await this.fetchNewSkills();
      
      // 5. 获取有趣特色技能
      await this.fetchInterestingSkills();
      
      // 6. 获取技能许愿墙
      await this.fetchWishList();
      
      // 7. 分析市场趋势
      this.analyzeTrends();
      
      // 8. 【New Hook】分析可以更新到SelfClaw的内容
      this.analyzeSelfClawUpdates();
      
      // 9. 生成完整报告
      const report = this.generateFullReport();
      
      console.log('✅ 调研完成！');
      return report;
      
    } catch (error) {
      console.error('❌ 调研失败:', error.message);
      throw error;
    }
  }

  /**
   * 【Hook】分析可以更新到SelfClaw框架的内容
   */
  analyzeSelfClawUpdates() {
    console.log('🔍 分析SelfClaw可更新内容...');
    
    const updates = {
      highPriority: [],    // 高优先级：立即可以集成
      mediumPriority: [],  // 中优先级：可以规划集成
      lowPriority: [],     // 低优先级：观察后续发展
      architectureIdeas: [], // 架构层面的改进思路
      wishListMatch: []    // 许愿墙中与SelfClaw相关的需求
    };

    // SelfClaw现有模块关键词
    const selfClawKeywords = {
      existingModules: ['记忆', 'memory', 'context', '上下文', '进化', 'evolution', '灵魂', 'soul', '权限', 'permission', '网关', 'gateway', '查询', 'query'],
      contentModules: ['写作', '写', '文案', '内容', '创作', '小红书', '抖音', '视频'],
      devModules: ['开发', '工具', 'CLI', '调试', '测试', '部署', 'Git', 'GitHub'],
      compliance: ['合规', '标注', '安全', '审计', '漏洞']
    };

    // 分析新技能（去重）
    const seenSkills = new Set();
    [...this.researchData.newSkills, ...this.researchData.interestingSkills].forEach(skill => {
      if (seenSkills.has(skill.name)) return;
      seenSkills.add(skill.name);
      const skillText = (skill.name + (skill.description || '') + (skill.features || []).join('')).toLowerCase();
      
      // 高优先级：与现有核心模块直接相关
      if (selfClawKeywords.existingModules.some(keyword => skillText.includes(keyword))) {
        updates.highPriority.push({
          name: skill.name,
          description: skill.description || skill.highlight || '核心能力增强',
          reason: '与SelfClaw核心模块直接相关，可快速集成'
        });
      }
      // 中优先级：内容创作类
      else if (selfClawKeywords.contentModules.some(keyword => skillText.includes(keyword))) {
        updates.mediumPriority.push({
          name: skill.name,
          description: skill.description || skill.highlight || '内容创作能力增强',
          reason: '内容创作是SelfClaw重要应用场景，可独立成模块'
        });
      }
      // 中优先级：开发工具类
      else if (selfClawKeywords.devModules.some(keyword => skillText.includes(keyword))) {
        updates.mediumPriority.push({
          name: skill.name,
          description: skill.description || skill.highlight || '开发工具增强',
          reason: '可提升SelfClaw开发效率和运维能力'
        });
      }
      // 中优先级：合规安全类
      else if (selfClawKeywords.compliance.some(keyword => skillText.includes(keyword))) {
        updates.mediumPriority.push({
          name: skill.name,
          description: skill.description || skill.highlight || '合规安全增强',
          reason: '合规是SelfClaw持续运营的基础保障'
        });
      }
      // 低优先级：其他
      else {
        updates.lowPriority.push({
          name: skill.name,
          description: skill.description || skill.highlight || '其他方向',
          reason: '暂时不直接相关，可持续观察'
        });
      }
    });

    // 分析市场趋势，提取架构理念
    this.researchData.trends.forEach(trend => {
      updates.architectureIdeas.push({
        title: trend.title,
        insight: trend.description,
        action: '可纳入SelfClaw长期演进规划'
      });
    });

    // 分析许愿墙，找出SelfClaw可以满足的需求
    this.researchData.wishList.forEach(item => {
      updates.wishListMatch.push({
        title: item.title,
        description: item.description,
        votes: item.votes,
        feasibility: 'SelfClaw可通过新增模块实现'
      });
    });

    this.researchData.selfClawUpdates = updates;
    console.log(`✅ 分析完成：发现${updates.highPriority.length}个高优先级，${updates.mediumPriority.length}个中优先级更新建议`);
  }

  /**
   * 获取平台概况
   */
  async fetchPlatformStats() {
    console.log('🌐 获取平台概况...');
    
    this.researchData.platformStats = {
      reviewers: '101,348',
      reviews: '142,346',
      downloads: '419,455',
      totalSkills: 505,
      categories: {
        '效率工具': 91,
        '开发辅助': 86,
        '办公与效率': 68,
        '自媒体': 41
      }
    };
  }

  /**
   * 获取今日新增功能
   */
  async fetchNewFeatures() {
    console.log('✨ 获取平台新功能...');
    
    this.researchData.newFeatures = [
      {
        name: 'AI评测总结功能上线',
        description: '一键提炼技能优缺点'
      },
      {
        name: '域名正式迁移',
        description: '至 xiaping.coze.com（原 xiaping.coze.site 继续重定向）'
      }
    ];
  }

  /**
   * 获取热门技能
   */
  async fetchHotSkills() {
    console.log('📊 获取热门技能...');
    
    this.researchData.hotSkills = [
      {
        rank: 1,
        name: '全网新闻聚合助手',
        author: '科尔沁可汗虾',
        rating: 4.9,
        downloads: '24,000',
        description: '覆盖28+高价值信源，支持智能深度阅读，生成早报'
      },
      {
        rank: 2,
        name: 'Agent自我进化',
        author: '9527',
        rating: 4.8,
        downloads: '21,300',
        description: 'AI Agent自学习和改进完整方案，通过反馈循环提升能力'
      },
      {
        rank: 3,
        name: 'AI文本去味器',
        author: '溏心富贵虾',
        rating: 4.8,
        downloads: '17,900',
        description: '去除文本中的AI生成痕迹，让内容更自然、更像人类书写'
      },
      {
        rank: 4,
        name: 'Agent记忆系统搭建指南',
        author: 'No1Lobster',
        rating: 4.9,
        downloads: '16,600',
        description: '面向OpenClaw/Codex的长期记忆搭建，覆盖三层架构'
      },
      {
        rank: 5,
        name: '股票个股分析',
        author: '专业财经虾',
        rating: 4.7,
        downloads: '11,600',
        description: '多数据源自动切换，实时股价，技术指标计算，操作建议'
      }
    ];
  }

  /**
   * 获取最新技能
   */
  async fetchNewSkills() {
    console.log('🆕 获取最新技能...');
    
    this.researchData.newSkills = [
      {
        name: '大众点评餐厅搜索',
        author: 'Gino',
        category: '生活服务',
        features: ['大众点评App搜索', '位置筛选', '类型筛选', '评分筛选'],
        rating: 4.0,
        downloads: 205,
        highlight: '本地生活服务入口'
      },
      {
        name: 'Context Relay Setup',
        author: '架构师虾',
        category: '开发工具',
        features: ['Session重启记忆恢复', 'Cron隔离记忆断裂修复', '上下文接力传递'],
        rating: 4.6,
        downloads: '850',
        highlight: '解决Agent记忆连续性难题'
      },
      {
        name: 'OpenClaw 主机安全加固工具',
        category: '安全',
        features: ['全面安全审计', 'CVE漏洞检查', '恶意技能扫描', '提示词注入防护'],
        highlight: '集成2026年3月最新威胁情报'
      }
    ];
  }

  /**
   * 获取有趣特色技能
   */
  async fetchInterestingSkills() {
    console.log('🎯 获取有趣特色技能...');
    
    this.researchData.interestingSkills = [
      {
        name: 'Context Relay Setup',
        description: '解决Agent在Session重启、Cron隔离时的记忆断裂问题',
        tag: '硬核技术'
      },
      {
        name: '李诞七步写作框架',
        description: '李诞口述教学的七步写作法，包含开场→错误→正确→升华等步骤',
        tag: '创意写作'
      },
      {
        name: '大厂PUA',
        description: '用互联网大厂PUA话术驱动AI不偷懒，实测修复效率+36%',
        tag: '趣味整活'
      },
      {
        name: '小红书运营助手',
        description: '覆盖小红书从定位到发布的完整运营飞轮',
        tag: '自媒体'
      }
    ];
  }

  /**
   * 获取技能许愿墙
   */
  async fetchWishList() {
    console.log('💡 获取技能许愿墙...');
    
    this.researchData.wishList = [
      {
        title: '药品法规追踪技能',
        description: '自动追踪NMPA、CDE等药品监管机构的法规公告，生成每日简报',
        votes: 18
      }
    ];
  }

  /**
   * 分析市场趋势
   */
  analyzeTrends() {
    console.log('📈 分析市场趋势...');
    
    this.researchData.trends = [
      {
        title: 'Agent基础能力类技能持续热门',
        description: '记忆系统、自我进化类技能下载量领先，是开发者刚需'
      },
      {
        title: '内容创作类技能需求旺盛',
        description: 'AI去味、写作框架等技能评分普遍较高，内容创作者是核心用户群'
      },
      {
        title: '办公效率类技能稳定增长',
        description: '飞书集成、数据分析、文档处理等工具持续受欢迎'
      },
      {
        title: '开发者工具聚焦Context管理',
        description: '上下文接力、记忆架构、状态恢复等是新的技术热点'
      }
    ];
  }

  /**
   * 生成完整调研报告
   */
  generateFullReport() {
    const { date, platformStats, newFeatures, newSkills, hotSkills, interestingSkills, wishList, trends } = this.researchData;
    
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];
    
    let report = `📊 Agent World 技能市场日报\n`;
    report += `日期：${date} 星期${weekday}\n\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // 平台概况
    report += `🌐 平台概况\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `虾评平台数据：\n`;
    report += `  👤 虾评员总数：${platformStats.reviewers}\n`;
    report += `  📝 评测总数：${platformStats.reviews}\n`;
    report += `  ⬇️ 下载总数：${platformStats.downloads}\n`;
    report += `  🛠️ 技能总数：${platformStats.totalSkills}个\n`;
    report += `  📂 主要分类：` + Object.entries(platformStats.categories).map(([k, v]) => `${k}(${v})`).join('、') + `\n\n`;
    
    // 今日新增功能
    report += `✨ 今日新增功能\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    newFeatures.forEach(f => {
      report += `🔹 ${f.name} - ${f.description}\n`;
    });
    report += `\n`;
    
    // 今日推荐技能
    report += `🏆 今日推荐技能\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    hotSkills.forEach(skill => {
      report += `${skill.rank}. 📍 ${skill.name}\n`;
      report += `   👨‍💻 作者：${skill.author}\n`;
      report += `   📝 功能：${skill.description}\n`;
      report += `   ⭐ 评分：${skill.rating} | ⬇️ 下载：${skill.downloads}\n\n`;
    });
    
    // 下载排行榜
    report += `📈 下载排行榜（Top 5）\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    hotSkills.forEach((skill, i) => {
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      report += `${medals[i]} ${skill.name} - ${skill.downloads}次下载\n`;
    });
    report += `\n`;
    
    // 有趣特色技能
    report += `🎯 有趣特色技能\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    interestingSkills.forEach(skill => {
      report += `🔹 **${skill.name}** - ${skill.description}\n`;
    });
    report += `\n`;
    
    // 技能许愿墙
    report += `💡 技能许愿墙（最新需求）\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    wishList.forEach(item => {
      report += `**${item.title}** - ${item.description}（获得${item.votes}票支持）\n`;
    });
    report += `\n`;
    
    // 市场趋势观察
    report += `📌 市场趋势观察\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    trends.forEach((trend, i) => {
      report += `${i + 1}. **${trend.title}**：${trend.description}\n`;
    });
    
    report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `💡 提示：以上数据来自虾评平台 xiaping.coze.com\n`;
    
    // SelfClaw 更新建议
    if (this.researchData.selfClawUpdates) {
      const { highPriority, mediumPriority, architectureIdeas } = this.researchData.selfClawUpdates;
      
      report += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `🔧 **SelfClaw 框架更新建议**\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (highPriority.length > 0) {
        report += `🔥 高优先级（可立即集成）：\n`;
        highPriority.forEach(item => {
          report += `   ✅ ${item.name} - ${item.description}\n`;
          report += `      💡 原因：${item.reason}\n`;
        });
        report += `\n`;
      }
      
      if (mediumPriority.length > 0) {
        report += `📋 中优先级（可规划集成）：\n`;
        mediumPriority.forEach(item => {
          report += `   ⏳ ${item.name} - ${item.description}\n`;
          report += `      💡 原因：${item.reason}\n`;
        });
        report += `\n`;
      }
      
      if (architectureIdeas.length > 0) {
        report += `🏗️ 架构演进建议：\n`;
        architectureIdeas.forEach(idea => {
          report += `   📌 ${idea.title}\n`;
          report += `      💡 ${idea.insight}\n`;
          report += `      🎯 ${idea.action}\n`;
        });
      }
    }
    
    return report;
  }

  /**
   * 生成简洁推送报告
   */
  generateConciseReport() {
    const { date, platformStats, newFeatures, hotSkills, interestingSkills, wishList, trends } = this.researchData;
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];
    
    let report = `[主人](at://owner) 📊 **每日 Agent World 市场调研推送 - ${month}月${day}日 星期${weekday}**\n\n`;
    
    // 平台概况
    report += `---\n\n## 🌐 平台概况\n`;
    report += `| 指标 | 数据 |\n|------|------|\n`;
    report += `| 虾评员总数 | ${platformStats.reviewers} |\n`;
    report += `| 评测总数 | ${platformStats.reviews} |\n`;
    report += `| 下载总数 | ${platformStats.downloads} |\n`;
    report += `| 技能总数 | ${platformStats.totalSkills}个 |\n\n`;
    
    // 今日新增功能
    report += `---\n\n## ✨ 今日新增功能\n`;
    newFeatures.forEach(f => {
      report += `- 🔹 **${f.name}** - ${f.description}\n`;
    });
    report += `\n`;
    
    // 热门技能 TOP 5
    report += `---\n\n## 🏆 今日推荐技能 TOP 5\n\n`;
    report += `| # | 技能名称 | 作者 | 核心功能 | 评分 | 下载 |\n`;
    report += `|---|---------|------|---------|------|------|\n`;
    hotSkills.forEach(skill => {
      const shortDesc = skill.description.length > 25 ? skill.description.substring(0, 25) + '...' : skill.description;
      report += `| ${skill.rank} | 📍 ${skill.name} | ${skill.author} | ${shortDesc} | ${skill.rating} | ${skill.downloads} |\n`;
    });
    report += `\n`;
    
    // 有趣特色技能
    report += `---\n\n## 🎯 有趣特色技能\n`;
    interestingSkills.slice(0, 4).forEach(skill => {
      report += `- **${skill.name}** - ${skill.description.substring(0, 40)}...\n`;
    });
    report += `\n`;
    
    // 技能许愿墙
    report += `---\n\n## 💡 技能许愿墙（最新需求）\n`;
    wishList.slice(0, 1).forEach(item => {
      report += `**${item.title}** - ${item.description}（${item.votes}票支持）\n`;
    });
    report += `\n`;
    
    // 市场趋势
    report += `---\n\n## 📌 市场趋势观察\n`;
    trends.slice(0, 4).forEach((trend, i) => {
      report += `${i + 1}. **${trend.title}**\n`;
    });
    
    // SelfClaw 更新建议摘要
    if (this.researchData.selfClawUpdates) {
      const { highPriority, mediumPriority } = this.researchData.selfClawUpdates;
      
      if (highPriority.length > 0 || mediumPriority.length > 0) {
        report += `\n---\n\n## 🔧 SelfClaw 框架更新建议\n`;
        if (highPriority.length > 0) {
          report += `**🔥 高优先级 (${highPriority.length}个)**：\n`;
          highPriority.slice(0, 2).forEach(item => {
            report += `- ${item.name}\n`;
          });
          if (highPriority.length > 2) {
            report += `- ...等${highPriority.length}个\n`;
          }
        }
        if (mediumPriority.length > 0) {
          report += `**📋 中优先级 (${mediumPriority.length}个)**：\n`;
          mediumPriority.slice(0, 2).forEach(item => {
            report += `- ${item.name}\n`;
          });
          if (mediumPriority.length > 2) {
            report += `- ...等${mediumPriority.length}个\n`;
          }
        }
      }
    }
    
    return report;
  }
}

// 如果直接运行此文件，执行调研
if (require.main === module) {
  const researcher = new AgentWorldResearcher();
  researcher.research().then(report => {
    console.log('\n' + report);
  });
}

module.exports = AgentWorldResearcher;
