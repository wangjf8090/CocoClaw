# SelfClaw v3.6.0 垂类模板协同集成说明

> **版本**: 1.0.0
> **日期**: 2026-06-12
> **文档类型**: 协同集成指南
> **适用范围**: financial-skill + medical-skill 与 skill-factory-core 的集成

---

## 一、概述

本文档描述 SelfClaw v3.6.0 实施 B 阶段交付的 2 个核心垂类模板（金融 + 医疗）与 skill-factory-core 框架的接口契约、发布流程、以及与 P0-B（Skill Cleaner 独立产品）的协同关系。

### 1.1 交付物清单

```
./SelfClaw v3.6.0规划/v3.6.0实施/02-vertical-skill-templates/
├── financial-skill/              # 金融垂类模板
│   ├── SKILL.md                  # ✅ 符合 Microsoft SKILL Pattern 6章节
│   ├── mcp-adapter.ts            # ✅ Wind MCP 适配器
│   ├── prompts/                  # ✅ Prompt 模板
│   │   ├── stock-analysis-prompt.md
│   │   ├── report-generation-prompt.md
│   │   └── risk-disclaimer.md
│   ├── test-scenarios.md         # ✅ 10个测试场景
│   └── publish-checklist.md       # ✅ 发布检查清单
│
├── medical-skill/                 # 医疗垂类模板
│   ├── SKILL.md                  # ✅ 符合 Microsoft SKILL Pattern 6章节
│   ├── mcp-adapter.ts            # ✅ 中康科技 + 卓睦鸟适配器
│   ├── prompts/                  # ✅ Prompt 模板
│   │   ├── medical-qa-prompt.md
│   │   ├── drug-info-prompt.md
│   │   ├── health-report-prompt.md
│   │   └── medical-disclaimer.md
│   ├── test-scenarios.md         # ✅ 10个测试场景
│   └── publish-checklist.md       # ✅ 发布检查清单
│
└── 协同集成说明.md                # ✅ 本文档
```

---

## 二、与 skill-factory-core 框架的接口契约

### 2.1 接口契约总览

| 垂类模板 | 数据源 | 行业大模型 | 输出能力 |
|----------|--------|------------|----------|
| **financial-skill** | Wind API (万得) | OpenAI GPT-4o | 行情查询、财务分析、报告生成 |
| **medical-skill** | 多数据源可插拔（中康/PubMed/临床指南） | 行业大模型（可配置） | 药品查询、症状分析、体检解读、文献检索 |

### 2.2 输入接口规范

```typescript
// 金融垂类输入接口
interface FinancialSkillInput {
  intent: 'stock_query' | 'financial_analysis' | 
          'valuation_comparison' | 'announcement_summary';
  stockCode: string;
  params?: {
    period?: string;
    indicators?: string[];
    compareWith?: string[];
  };
}

// 医疗垂类输入接口
interface MedicalSkillInput {
  intent: 'drug_query' | 'diagnosis_assist' | 
          'health_report' | 'literature_search';
  context?: {
    patientAge?: number;
    gender?: 'male' | 'female';
    allergies?: string[];
    currentMedications?: string[];
  };
  query: string;
}
```

### 2.3 输出接口规范

```typescript
// 金融垂类输出接口
interface FinancialSkillOutput {
  status: 'success' | 'error' | 'partial' | 'cached';
  data: {
    stockInfo?: StockInfo;
    indicators?: FinancialIndicators;
    analysis?: AnalysisReport;
  };
  source: 'Wind Data';
  timestamp: string;
  disclaimer: string;
}

// 医疗垂类输出接口
interface MedicalSkillOutput {
  status: 'success' | 'warning' | 'urgent' | 'error';
  urgentLevel: 'info' | 'warning' | 'urgent';
  response?: {
    type: string;
    content: any;
  };
  disclaimer: string;
  source: '中康科技医疗数据库';
}
```

### 2.4 MCP 适配器注册

```typescript
// skill-factory-core/mcp-registry.ts
const mcpAdapters = {
  wind: {
    adapter: './financial-skill/mcp-adapter.ts',
    methods: [
      'getStockQuote',
      'getFinancialReport',
      'getHistoricalData',
      'getIndustryCompare',
      'getNewsSentiment'
    ]
  },
  zhongkang: {
    adapter: './medical-skill/mcp-adapter.ts',
    methods: [
      'getDrugInfo',
      'analyzeSymptoms',
      'interpretExamReport',
      'searchLiterature',
      'generateHealthPlan'
    ]
  }
};
```

---

## 三、Skill Cleaner 协同集成

### 3.1 审计流程

```
┌─────────────────┐
│ 垂类Skill提交   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Skill Cleaner   │
│ 三件套审计      │
├─────────────────┤
│ 1. skill-audit  │ ← Meta-Skill三维度审计
│ 2. skill-optimize│ ← SkillOpt优化
│ 3. skill-lifecycle│ ← 生命周期管理
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 审计通过评级    │
├─────────────────┤
│ ⭐⭐⭐ 金融版   │ ← 综合评分≥65
│ ⭐⭐⭐⭐ 医疗版 │ ← 综合评分≥70（更高要求）
└─────────────────┘
```

### 3.2 两个垂类的审计通过标准

| 维度 | 金融版要求 | 医疗版要求 | 差异说明 |
|------|-----------|-----------|----------|
| FME（失败机制编码） | ≥ 60 | ≥ 65 | 医疗需要更详细的失败处理 |
| AS（操作具体性） | ≥ 65 | ≥ 70 | 医疗需要更精确的操作指导 |
| HRB（风险黑名单） | ≥ 70 | ≥ 80 | 医疗风险更高 |
| 综合评分 | ≥ 65 | ≥ 70 | 医疗更严格 |
| 紧急处理 | 可选 | 强制 | 医疗必须能处理紧急症状 |
| 专业审核 | 建议 | 必须 | 医疗必须执业医师审核 |

### 3.3 负迁移防护

```typescript
// skill-lifecycle 部署前评估
interface DeploymentRiskAssessment {
  skillName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  negativeTransferRisk: number; // 0-100%
  
  // 金融版
  if (riskLevel === 'financial') {
    // 可在通过审计后部署
  }
  
  // 医疗版
  if (riskLevel === 'medical') {
    // 必须医学总监审批后才能部署
  }
}
```

---

## 四、上 Skill 商店流程

### 4.1 金融版上商店流程

```
1. 提交审核
   └─ 上传 financial-skill 到 skill-factory-core
   
2. Skill Cleaner 审计
   └─ 金融垂类审计规则集
   └─ 审计评分 ≥ 65
   
3. 合规检查
   └─ Wind API 授权确认
   └─ 数据使用协议签署
   
4. 发布审批
   └─ 技术负责人审批
   └─ 产品负责人审批
   
5. 上线发布
   └─ 发布到 SelfClaw Skill Store
   └─ 建议定价：99-199 元/月
```

### 4.2 医疗版上商店流程

```
1. 提交审核
   └─ 上传 medical-skill 到 skill-factory-core
   
2. Skill Cleaner 审计
   └─ 医疗垂类审计规则集
   └─ 审计评分 ≥ 70
   └─ 紧急处理验证
   
3. 医学内容审核
   └─ 执业医师审核
   └─ 执业药师审核
   
4. 合规检查
   └─ HIPAA/GDPR 合规
   └─ 数据源授权确认
   
5. 发布审批（双重审批）
   └─ 医学总监审批
   └─ 法律负责人审批
   └─ 技术负责人审批
   
6. 上线发布
   └─ 发布到 SelfClaw Skill Store
   └─ 建议定价：199-499 元/月
```

---

## 五、商业化定价策略

### 5.1 差异化定价建议

| 版本 | 建议定价 | 定价依据 |
|------|----------|----------|
| **金融版** | 99-199 元/月 | - 面向个人投资者<br>- 数据成本中等<br>- 风险相对可控 |
| **医疗版** | 199-499 元/月 | - 面向健康管理者<br>- 需要专业审核成本<br>- 风险更高，定价更高 |

### 5.2 订阅方案

```yaml
# 金融版订阅方案
financial_tiers:
  free:
    calls_per_day: 10
    features: ["基础行情查询"]
    
  starter:
    price: 99元/月
    calls_per_day: 100
    features: ["实时行情", "简单财务分析"]
    
  professional:
    price: 199元/月
    calls_per_day: 500
    features: ["全功能", "报告生成", "板块分析"]

# 医疗版订阅方案
medical_tiers:
  free:
    calls_per_day: 5
    features: ["基础药品查询"]
    
  personal:
    price: 199元/月
    calls_per_day: 50
    features: ["药品查询", "体检解读"]
    
  family:
    price: 499元/月
    calls_per_day: 200
    features: ["全功能", "慢病管理", "家庭成员"]
```

---

## 六、与 Coze 3.0 / 扣子商店 / Claude Code 生态的发布路径

### 6.1 发布路径总览

```
┌─────────────────────────────────────────────────────────┐
│                    SelfClaw v3.6.0                       │
│                   垂类模板生成                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │ SelfClaw   │    │   Coze 3.0  │    │   Claude    │   │
│  │ Skill Store │    │  扣子商店   │    │   Code      │   │
│  │             │    │             │    │   生态      │   │
│  │  (首发)     │───▶│  (第二波)   │───▶│  (第三波)   │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Coze 3.0 对接方案

```yaml
# Coze 3.0 技能导出格式
coze_skill_export:
  name: "wind-stock-analyzer"
  description: "基于万得API的A股/港股/美股分析"
  capabilities:
    - financial-data-read
    - stock-analysis
  mcp_connectors:
    - wind-mcp
  compliance:
    - investment-risk-disclaimer
  pricing: 99-199元/月
```

### 6.3 Claude Code 生态对接

```typescript
// Claude Code Tool Definition
interface SkillTool {
  name: string;
  description: string;
  input_schema: object;
  
  // 金融版
  financial_skill: {
    methods: string[];
    requires: ["mcp:wind"];
  };
  
  // 医疗版
  medical_skill: {
    methods: string[];
    requires: ["mcp:zhongkang", "mcp:zhuomu-bird-llm"];
  };
}
```

---

## 七、第一个版本的"5 大风险" + 应对策略

### 7.1 风险清单

| 风险ID | 风险名称 | 风险等级 | 影响范围 |
|--------|----------|----------|----------|
| R1 | 数据准确性风险 | 高 | 金融/医疗 |
| R2 | 免责声明不足风险 | 高 | 医疗 |
| R3 | 紧急症状漏报风险 | 极高 | 医疗 |
| R4 | API 限流/超时风险 | 中 | 金融 |
| R5 | 负迁移风险 | 中 | 金融/医疗 |

### 7.2 风险应对策略

#### R1: 数据准确性风险

**风险描述**：金融/医疗数据错误可能导致用户做出错误决策

**应对策略**：
```
1. 数据源校验
   - Wind API 返回数据增加校验层
   - 中康数据库增加来源标注

2. 多源验证
   - 关键数据尝试多数据源交叉验证
   - 异常数据自动标注"待确认"

3. 免责声明强化
   - 每次输出必须包含免责声明
   - 数据异常时加强风险提示
```

#### R2: 免责声明不足风险

**风险描述**：医疗场景免责声明不充分可能带来法律风险

**应对策略**：
```
1. 分层免责
   - 标准版：通用免责声明
   - 强化版：症状咨询/用药指导
   - 紧急版：急救提示

2. 强制显示
   - 每条输出必须包含免责声明
   - 医疗版必须显示"不能替代医生诊断"

3. 法律审核
   - 免责声明需法律顾问审核
   - 定期更新免责内容
```

#### R3: 紧急症状漏报风险

**风险描述**：紧急症状（如胸痛）未被识别可能延误治疗

**应对策略**：
```
1. 关键词触发
   - 维护紧急症状关键词库
   - 包含关键词立即返回紧急级别

2. 双重验证
   - 规则匹配 + ML 模型双重验证
   - 宁可误报也不漏报

3. 强制急救提示
   - 紧急症状必须包含"拨打120"
   - 输出前强制检查紧急标记

4. 测试覆盖
   - 所有紧急症状 100% 通过测试
   - 上线后持续监控
```

#### R4: API 限流/超时风险

**风险描述**：Wind API 限流或超时导致服务不可用

**应对策略**：
```
1. 缓存机制
   - 行情数据 30 秒缓存
   - 财务数据 1 小时缓存

2. 降级策略
   - 超时降级到缓存
   - 限流触发异步处理

3. 重试机制
   - 指数退避重试
   - 最多 3 次重试

4. 限流监控
   - 实时监控 API 调用量
   - 接近配额时预警
```

#### R5: 负迁移风险

**风险描述**：新垂类 Skill 可能对现有 Skill 产生负面影响

**应对策略**：
```
1. 独立命名空间
   - 垂类 Skill 使用独立命名空间
   - 避免与现有 Skill 冲突

2. 负迁移评估
   - 上线前进行负迁移风险评估
   - 风险 > 25% 需优化后上线

3. A/B 测试
   - 小流量 A/B 测试
   - 监控核心指标变化

4. 快速回滚
   - 设定回滚条件
   - 发现负迁移立即回滚
```

---

## 八、版本规划

### 8.1 v3.6.0（当前版本）

```
交付内容：
✅ 金融垂类模板（wind-stock-analyzer）
✅ 医疗垂类模板（zhongkang-medical-advisor）
✅ 与 skill-factory-core 接口契约
✅ Skill Cleaner 协同集成
✅ 上商店流程
```

### 8.2 v3.7.0（下一个版本）

```
计划内容：
📋 学术垂类模板（pubmed-research-assistant）
📋 法律垂类模板（legal-compliance-documentor）
📋 商业化能力（订阅计费、API密钥）
📋 Coze 3.0 对接
```

### 8.3 v4.0.0（长期规划）

```
计划内容：
📋 企业级多租户
📋 跨平台 Skill 市场
📋 高级合规审计
📋 Agent-to-Agent 安全协议
```

---

## 九、附录

### 9.1 术语表

| 术语 | 定义 |
|------|------|
| skill-factory-core | 领域 Skill 工厂核心框架 |
| Skill Cleaner | Skill 审计/优化/生命周期管理三件套 |
| MCP | Model Context Protocol，模型上下文协议 |
| Wind API | 万得金融终端 API |
| 中康科技 | 多数据源可插拔架构 | v3.6.0.1 新增 PubMed/临床指南适配器 |
| 卓睦鸟大模型 | 医疗领域专业大模型 |

### 9.2 参考文档

| 文档 | 路径 |
|------|------|
| P0-A 设计文档 | `./SelfClaw v3.6.0规划/领域Skill工厂设计.md` |
| SelfClaw v3.5.0 进度 | `./recent_memory/project/selfclaw_progress.md` |
| Wind MCP 对标 | `./AI日报/Agent_World_市场调研_20260610.md` |
| 中康科技对标 | `./AI技术日报/20260611.md` |

---

## 十、主人 Review 建议

### Review 顺序

1. **先看 SKILL.md** → 了解技能全貌和边界
2. **再看 mcp-adapter.ts** → 验证技术实现
3. **再看测试场景** → 确认功能覆盖
4. **最后看发布检查清单** → 确认合规要求

### Review 检查点

| 检查点 | 金融版 | 医疗版 |
|--------|--------|--------|
| Microsoft 6章节格式 | ☐ | ☐ |
| 核心方法覆盖 | ☐ | ☐ |
| 免责声明完整 | ☐ | ☐ |
| 紧急处理机制 | N/A | ☐ |
| Skill Cleaner 审计 | ☐ | ☐ |

---

*本文档由 SelfClaw v3.6.0 Domain Skill Factory 自动生成*  
*版本: 1.0.0 | 日期: 2026-06-12*  
*下一步：主人 review 后决定是否合并到主仓库*
