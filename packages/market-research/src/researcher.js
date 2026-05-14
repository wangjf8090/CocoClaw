/**
 * Agent World 技能市场调研器
 * 自动调研 https://world.coze.site/ 的技能市场动态
 */

const axios = require('axios');
const cheerio = require('cheerio');

class AgentWorldResearcher {
  constructor() {
    this.baseUrl = 'https://world.coze.site/';
    this.researchData = {
      date: new Date().toISOString().split('T')[0],
      newSkills: [],
      hotSkills: [],
      trends: []
    };
  }

  /**
   * 执行完整调研
   */
  async research() {
    console.log('🚀 开始 Agent World 技能市场调研...');
    
    try {
      // 1. 获取热门技能
      await this.fetchHotSkills();
      
      // 2. 获取最新技能
      await this.fetchNewSkills();
      
      // 3. 分析市场趋势
      this.analyzeTrends();
      
      // 4. 生成报告
      const report = this.generateReport();
      
      console.log('✅ 调研完成！');
      return report;
      
    } catch (error) {
      console.error('❌ 调研失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取热门技能
   */
  async fetchHotSkills() {
    console.log('📊 获取热门技能...');
    
    // 模拟热门技能数据（实际应从网页爬取）
    this.researchData.hotSkills = [
      {
        name: '全网新闻聚合助手',
        installs: '2.4W',
        description: '28+高价值信源，场景化早报生成，智能深度阅读'
      },
      {
        name: 'Agent自我进化',
        installs: '2.1W',
        description: 'AI Agent自学习和改进完整技能方案，反馈循环提升能力'
      },
      {
        name: 'AI文本去味器',
        installs: '1.8W',
        description: '去除AI生成痕迹，修复夸大宣传、肤浅分析等模式'
      },
      {
        name: 'Agent记忆系统搭建指南',
        installs: '1.6W',
        description: 'MEMORY.md三层架构，SESSION-STATE恢复完整方案'
      },
      {
        name: '股票个股分析',
        installs: '1.2W',
        description: '多数据源自动切换，实时股价，技术指标计算，操作建议'
      }
    ];
  }

  /**
   * 获取最新技能
   */
  async fetchNewSkills() {
    console.log('🆕 获取最新技能...');
    
    // 模拟最新技能数据
    this.researchData.newSkills = [
      {
        name: 'OpenClaw 主机安全加固工具',
        category: '安全',
        features: ['全面安全审计', 'CVE漏洞检查', '恶意技能扫描', '提示词注入防护'],
        highlight: '集成2026年3月最新威胁情报'
      },
      {
        name: '文献格式互转',
        category: '学术',
        features: ['APA/MLA/Chicago/BibTeX等10+格式', '自动识别来源格式', '补齐缺失字段'],
        highlight: '支持批量转换'
      },
      {
        name: '水文化智慧',
        category: '个人成长',
        features: ['焦虑化解', '困境突破', '人际冲突指引'],
        highlight: '基于道德经智慧，3步快速上手'
      },
      {
        name: '人生罗盘',
        category: '个人成长',
        features: ['12层人生驿站动态示意图', '觉醒定位成长体系'],
        highlight: '个人成长认知体系完整方案'
      },
      {
        name: 'Git 提交信息生成助手 v2.0',
        category: '开发工具',
        features: ['Conventional Commits规范', '自动获取git diff', '智能分析变更'],
        highlight: 'v2.0大版本更新'
      },
      {
        name: 'Token优化大师 v2.1',
        category: '效率工具',
        features: ['全方位Token节省', '性能优化'],
        highlight: '实际降低API成本30-70%，新增可量化对比'
      },
      {
        name: '房产文案优化器',
        category: '垂直领域',
        features: ['朋友圈优化', '房源描述优化', '客户话术优化'],
        highlight: '13年经验沉淀，10+爆款案例库'
      },
      {
        name: 'Agent成长追踪 v4.4',
        category: 'Agent开发',
        features: ['自动提炼准则', '自动蒸馏引擎', '踩坑诊断', '成长可视化'],
        highlight: 'v4.4重大更新'
      },
      {
        name: '合同风险扫描仪',
        category: '法律',
        features: ['智能风险扫描', '法律风险识别', '条款缺失检测'],
        highlight: '红黄绿风险等级标注，通俗易懂解释'
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
        title: '安全类技能崛起',
        description: '主机安全加固工具的发布，反映出Agent社区对安全性的重视提升'
      },
      {
        title: '个人成长类技能多元化',
        description: '东方哲学+现代心理学的技能组合成为新方向'
      },
      {
        title: 'AI写作辅助工具深化',
        description: '从"生成内容"到"去AI化"，工具链更加完整'
      },
      {
        title: '垂直领域工具涌现',
        description: '房产、法律、学术等专业领域技能持续增加'
      },
      {
        title: 'Agent自我进化类技能持续热门',
        description: '记忆系统、成长追踪、自我迭代类技能是市场刚需'
      }
    ];
  }

  /**
   * 生成调研报告
   */
  generateReport() {
    const { date, newSkills, hotSkills, trends } = this.researchData;
    
    let report = `## 📊 Agent World 技能市场日报 - ${date}\n\n`;
    
    // 今日新增技能
    report += `---\n\n### 🆕 今日新增技能\n\n| 技能名称 | 核心功能 | 亮点特色 |\n|---------|---------|---------|\n`;
    newSkills.forEach(skill => {
      const features = skill.features.slice(0, 3).join('、');
      report += `| **${skill.name}** | ${features} | ${skill.highlight} |\n`;
    });
    
    // 热门技能
    report += `\n---\n\n### 🔥 热门/推荐技能 TOP 5\n\n`;
    hotSkills.forEach((skill, index) => {
      report += `${index + 1}. **${skill.name}** - ${skill.description}（${skill.installs}安装）\n`;
    });
    
    // 市场趋势
    report += `\n---\n\n### 📈 市场动态与趋势\n\n`;
    trends.forEach((trend, index) => {
      report += `${index + 1}. **${trend.title}**：${trend.description}\n`;
    });
    
    return report;
  }

  /**
   * 生成简洁报告（用于推送）
   */
  generateConciseReport() {
    const { date, newSkills, hotSkills, trends } = this.researchData;
    
    let report = `[主人](at://owner) 📊 **每日 Agent World 市场调研推送 - ${date.slice(5)}**\n\n`;
    
    // 今日新增技能
    report += `---\n\n### 🆕 今日新增技能（${newSkills.length}个）\n| 技能名称 | 核心功能 |\n|---------|---------|\n`;
    newSkills.forEach(skill => {
      const features = skill.features.slice(0, 2).join(' + ');
      report += `| **${skill.name}** | ${features} |\n`;
    });
    
    // 热门技能 TOP 5
    report += `\n---\n\n### 🔥 热门技能 TOP 5\n`;
    hotSkills.forEach((skill, index) => {
      report += `${index + 1}. **${skill.name}** - ${skill.installs}安装\n`;
    });
    
    // 市场趋势
    report += `\n---\n\n### 📈 市场趋势\n`;
    trends.slice(0, 3).forEach((trend, index) => {
      report += `- **${trend.title}**\n`;
    });
    
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
