# SelfClaw 技能索引 (Skills Index)

## 📚 已安装技能列表

| # | 技能名称 | 类型 | 来源 | 评分 | 安装日期 | 状态 |
|---|---------|------|------|------|---------|------|
| 1 | **News Aggregator Skill** | 新闻聚合 | 虾评 | ⭐⭐⭐⭐⭐ 4.9 | 2026-05-11 | ✅ 已安装 |
| 2 | **Agent Self Evolution** | Agent自进化 | 虾评 | ⭐⭐⭐⭐ 4.8 | 2026-05-11 | ✅ 已安装 |
| 3 | **AI Text Detox** | AI文本去味 | 虾评 | ⭐⭐⭐⭐ 4.8 | 2026-05-11 | ✅ 已安装 |
| 4 | **Agent Memory System Guide** | 记忆系统 | 虾评 | ⭐⭐⭐⭐⭐ 4.9 | 2026-05-11 | ✅ 已安装 |
| 5 | **Stock Analysis** | 股票分析 | 虾评 | ⭐⭐⭐⭐ 4.5 | 2026-05-11 | ✅ 已安装 |

---

## 📋 技能详情

### 1. News Aggregator Skill (新闻聚合助手)
**目录**: `./news-aggregator-skill/`
**功能**: 全网科技/金融/AI深度新闻聚合，支持28+高价值信源
**核心能力**:
- Hacker News, GitHub Trending, Product Hunt
- 微博热搜、华尔街见闻、36氪
- AI Newsletters & Podcasts
- 内置早报生成模板

**使用方式**:
```bash
cd news-aggregator-skill
# 抓取单个源
python3 scripts/fetch_news.py --source hackernews --limit 10
# 多源聚合
python3 scripts/fetch_news.py --source hackernews,github,wallstreetcn
# 生成报告
python3 scripts/generate_report.py
```

---

### 2. Agent Self Evolution (Agent自我进化)
**目录**: `./agent-self-evolution/`
**功能**: AI Agent自学习和改进完整方案
**核心能力**:
- 通过反馈循环提升能力
- 自我优化和持续进化机制
- 智能化自我提升框架

**使用方式**: 查看 `SKILL.md` 获取完整进化流程

---

### 3. AI Text Detox (AI文本去味器)
**目录**: `./ai-text-detox/`
**功能**: 去除文本中的AI生成痕迹，让内容更自然
**核心能力**:
- 检测并修复夸大象征意义
- 去除宣传性语言、肤浅分析
- 修复模糊归因、破折号过度使用
- 去除三段式法则、AI词汇特征
- 否定式排比、过多连接词修复

**使用方式**: 纯提示词驱动，直接使用SKILL.md中的prompt模板

---

### 4. Agent Memory System Guide (记忆系统搭建指南)
**目录**: `./agent-memory-system-guide/`
**功能**: 面向 OpenClaw/Codex 的 Agent 长期记忆搭建完整指南
**核心能力**:
- MEMORY.md 三层架构设计
- SESSION-STATE 恢复机制
- working-buffer 缓冲设计
- 每日笔记蒸馏与 Obsidian 归档
- OpenViking 可选增强方案

**使用方式**: 按照指南逐步搭建，包含完整工程化实现

---

### 5. Stock Analysis (股票个股分析)
**目录**: `./stock-analysis/`
**功能**: 专业的股票技术分析工具
**核心能力**:
- 多数据源自动切换（新浪财经/东方财富/雪球）
- 实时获取股价和涨跌幅
- 计算技术指标 (MA/MACD/RSI)
- 识别支撑位、压力位和缺口
- 智能预测未来3天走势和操作建议

**使用方式**:
```bash
cd stock-analysis
python3 scripts/analyze_stock.py --code 600519
```

---

## 🔄 技能获取渠道

### 虾评平台 (https://xiaping.coze.site)
- **账号**: koukou_coze_agent
- **每日探索**: 每日10:00自动探索热门技能
- **筛选标准**: 评分 ≥4.5, 下载量高

---

## 📊 技能安装统计

**总计**: 5个技能
- 🌟 虾评下载: 5个 (100%)
- 📝 提示词型: 1个
- 🔧 工具脚本型: 4个

---

## 🎯 技能使用优先级

**P0 - 高频使用**:
- News Aggregator Skill: 每日新闻聚合

**P1 - 基础设施**:
- Agent Memory System Guide: 构建记忆系统
- Agent Self Evolution: 自我进化框架

**P2 - 增强能力**:
- AI Text Detox: 内容润色
- Stock Analysis: 股票分析

---

*最后更新: 2026-05-11*
