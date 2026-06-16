# SKILL: Pharmacy Operations Advisor（药店经营辅助助手）

> **版本**: 1.0.0（v3.7.0 M1 药店经营辅助 Skill）  
> **日期**: 2026-06-15  
> **模板来源**: SelfClaw v3.7.0 Domain Skill Factory - Pharmacy Template  
> **符合规范**: Microsoft SKILL Pattern 6 章节格式  
> **差异化定位**: 开发者级药店经营 Skill 工厂，基于公开数据源（卫健委/临床指南/PubMed）

---

## 差异化定位

本模板是 SelfClaw v3.7.0 领域 Skill 工厂的**药店经营辅助垂类基线模板**，定位"药店数字化经营工具"，支持：

- **多数据源可插拔**：卫健委公开数据 / 临床指南 / PubMed 可自由组合
- **经营辅助**：库存预警 / 滞销品识别 / 同品替换建议
- **合规保障**：处方药/非处方药分类 / 禁售品识别
- **开发者友好**：TypeScript 接口抽象 + 完整测试覆盖 + 模块化架构

**与通用医疗 Skill 的区别**：
| 维度 | 通用医疗 Skill | 本 Skill（药店经营） |
|------|---------------|---------------------|
| 核心场景 | 诊断/治疗参考 | 药店经营辅助 |
| 数据源 | 医疗数据库 | 卫健委/指南/PubMed |
| 目标用户 | 医师/患者 | 药店店员/店长 |
| 核心能力 | 诊疗辅助 | 药品查询/用药指导/库存管理/合规检查 |

---

## 1. Scope（范围）

### 1.1 技能定义

药店经营辅助助手，整合卫健委公开数据、临床指南、PubMed 文献资源，提供药品查询、用药指导、库存管理、经营分析、合规检查等能力。本 Skill 是 SelfClaw v3.7.0 药店经营辅助垂类的标准化实现，支持多数据源插拔，专为药店场景设计。

### 1.2 核心能力（Capabilities）

| 能力 ID | 能力名称 | 描述 |
|---------|----------|------|
| `drug-info` | 药品信息查询 | 适应症/用法/禁忌/价格区间 |
| `medication-guidance` | 用药指导 | 服用方法/注意事项/不良反应 |
| `inventory-analysis` | 库存分析 | 库存预警/滞销品识别/效期管理 |
| `compliance-check` | 合规检查 | 处方药分类/禁售品识别/经营资质 |
| `drug-interaction` | 药物相互作用 | 药品配伍禁忌查询 |
| `substitute-recommend` | 同品替换建议 | 集采替代/同类替代 |

### 1.3 支持的数据源（可插拔）

| 数据源 | 类型 | 说明 |
|--------|------|------|
| nhc-adapter | 主数据源 | 卫健委公开数据（药品目录/基药/医保） |
| clinical-guidelines-adapter | 扩展数据源 | 临床指南检索 |
| pubmed-adapter | 兜底数据源 | PubMed 文献检索（英文场景） |

> **配置方式**：修改 `mcp/config.ts` 中的 `dataSourcePriority` 数组即可切换/组合数据源

### 1.4 使用边界（不做什么）

- ❌ **不提供疾病诊断**：仅提供用药参考，诊断必须由医师做出
- ❌ **不开具处方**：不生成具有法律效力的处方文件
- ❌ **不替代执业药师**：用药指导仅供参考
- ❌ **不提供毒麻药品详细交易指导**：特殊药品需合规限制
- ❌ **不保证价格实时性**：价格数据仅供参考

### 1.5 元数据（Metadata）

```yaml
name: pharmacy-operations-advisor
version: 1.0.0
risk_level: medium
requires:
  - network:http
  - mcp:pharmacy-adapter
capabilities:
  - drug-info
  - medication-guidance
  - inventory-analysis
  - compliance-check
  - drug-interaction
  - substitute-recommend
compliance:
  - prescription-drug-warning
  - otc-drug-guidance
  - prohibited-drugs-check
  - inventory-red-lines
  - professional-disclaimer
pricing_hint: 99-199 元/月（药店版建议订阅价）
```

### 1.6 触发短语（Triggers）

```
- "查询阿司匹林肠溶片的价格和适应症"
- "这个药怎么服用，有什么禁忌"
- "哪些药快过期了，需要优先销售"
- "这个处方单合规吗"
- "顾客要买抗生素，需要什么资质"
- "这款药和XX药能一起用吗"
- "有没有便宜的同类药推荐"
- "帮我查一下这个药是处方药还是OTC"
```

---

## 2. Idioms（指令风格）

### 2.1 用户指令格式

```json
{
  "intent": "drug_query | medication_guidance | inventory_analysis | compliance_check | drug_interaction | substitute_recommend",
  "context": {
    "pharmacyId": "药店ID",
    "inventoryData": [{ "drugName": "药品名", "quantity": 100, "expiryDate": "2025-12-31" }],
    "userRole": "pharmacist | clerk | manager"
  },
  "query": "具体问题描述"
}
```

### 2.2 响应格式规范

```json
{
  "status": "success | warning | urgent",
  "response": {
    "type": "drug_info | medication_guidance | inventory_alert | compliance_result | interaction_warning | substitute_list",
    "content": {
      "title": "阿司匹林肠溶片",
      "category": "OTC",
      "prescriptionRequired": false,
      "priceRange": "10-25元",
      "indications": ["解热镇痛", "抗血小板"],
      "usage": "50-100mg/次，3次/日"
    }
  },
  "disclaimer": "本回答仅供药店工作人员参考，不构成诊疗建议",
  "source": "卫健委公开数据/临床指南"
}
```

### 2.3 警告级别定义

| 级别 | 标识 | 触发条件 | 处理方式 |
|------|------|---------|---------|
| Info | ℹ️ | 一般信息查询 | 正常返回 |
| Warning | ⚠️ | 库存不足/效期临近/处方药提醒 | 显著标注警告 |
| Urgent | 🚨 | 禁售药品查询/严重相互作用/过期药品 | 强烈提示处理 |

### 2.4 错误处理规范

| 错误类型 | HTTP 状态码 | 响应示例 |
|----------|-------------|---------|
| 药品未找到 | 404 | `{ status: "warning", message: "未找到该药品，请核实名称" }` |
| 处方药销售限制 | 200 | `{ status: "warning", message: "该药为处方药，请要求顾客出示处方" }` |
| 禁售品查询 | 200 | `{ status: "urgent", message: "该药属于禁售品，不能销售" }` |
| 库存不足 | 200 | `{ status: "warning", message: "库存不足，建议及时补货" }` |
| 严重相互作用 | 200 | `{ status: "urgent", message: "存在严重配伍禁忌，不建议同时销售" }` |

---

## 3. Patterns（成功路径）

### 3.1 最佳实践清单

#### Pattern 1：药品信息标准化查询

```
1. 解析药品名称（支持商品名/通用名/别名）
   - 商品名 → 查询药品说明书
   - 通用名 → 查询成分相同药品
   - 别名 → 映射到标准名称

2. 查询基本信息
   - 药品分类（OTC/处方药）
   - 价格区间
   - 适应症
   - 规格包装

3. 查询经营信息
   - 是否在医保目录
   - 是否在基药目录
   - 集采信息

4. 生成查询结果
   - 标准格式输出
   - 包含来源标注
```

#### Pattern 2：用药指导标准化流程

```
1. 获取药品信息
2. 识别患者人群
   - 成人/儿童/孕妇/老年人
   - 特殊人群注意事项

3. 生成用药指导
   - 服用方法
   - 服药时间
   - 注意事项
   - 不良反应监测

4. 强制免责声明
   - 每条回复必须包含
   - 强调不替代医生诊疗
```

#### Pattern 3：库存预警分析

```
1. 获取库存数据
   - 药品名称
   - 当前库存
   - 效期
   - 日均销量

2. 识别预警类型
   - 效期预警（30天内）
   - 库存不足预警（低于安全库存）
   - 滞销预警（近效期）

3. 生成处理建议
   - 优先销售计划
   - 补货建议
   - 退货/报废建议

4. 输出预警报告
   - 按紧急程度排序
   - 包含具体药品列表
```

#### Pattern 4：合规检查流程

```
1. 查询药品属性
   - 处方药/OTC 分类
   - 经营资质要求
   - 是否为禁售品

2. 验证销售条件
   - 处方要求
   - 实名登记要求
   - 年龄限制

3. 生成合规建议
   - 合规销售
   - 需补充材料
   - 禁止销售

4. 输出合规报告
   - 合规状态
   - 具体要求
   - 操作建议
```

### 3.2 思维链示例

```
用户: "顾客要买阿莫西林胶囊，需要什么手续"

思维链:
1. 识别意图：合规检查 + 用药指导
2. 查询药品信息：
   - 药品名称：阿莫西林胶囊
   - 分类：处方药（抗生素）
   
3. 合规检查：
   - 处方药销售：需要顾客出示处方
   - 抗生素销售：可能需要实名登记
   - 执业药师审核：需要在职药师审核处方

4. 用药指导（如果顾客有处方）：
   - 询问过敏史（青霉素类）
   - 用法用量提示
   - 注意事项

5. 输出响应：
   - 合规状态：需要处方
   - 操作建议：请顾客出示处方
   - 免责声明：本回答仅供参考
```

---

## 4. Fixtures（测试用例）

### 4.1 测试场景列表（P01-P10）

| ID | 输入 Query | 预期 SKILL 调用链 | 预期输出类型 | 备注 |
|----|-----------|-------------------|-------------|------|
| P01 | "查询阿莫西林胶囊的信息" | getDrugInfo(阿莫西林) | 完整药品信息+分类 | 验证药品数据库 |
| P02 | "这个药怎么服用，有什么禁忌" | getMedicationGuidance(药品名) | 用药指导+注意事项 | 验证用药指导 |
| P03 | "哪些药快过期了需要优先销售" | analyzeInventory(效期预警) | 效期预警列表 | 验证库存分析 |
| P04 | "帮我检查这个处方单合规吗" | checkCompliance(处方信息) | 合规检查结果 | 验证合规检查 |
| P05 | "顾客要买抗生素，需要什么资质" | checkCompliance(抗生素销售) | 资质要求 | 验证合规检查 |
| P06 | "这款药和XX药能一起用吗" | checkDrugInteraction(两种药) | 相互作用分析 | 验证相互作用 |
| P07 | "有没有便宜的同类药推荐" | getSubstituteDrugs(原药品) | 同类替代列表 | 验证替换建议 |
| P08 | "帮我查一下这个药是处方药还是OTC" | getDrugCategory(药品名) | 药品分类结果 | 验证分类查询 |
| P09 | "哪些药库存不足需要补货" | analyzeInventory(库存预警) | 补货建议列表 | 验证库存预警 |
| P10 | "滞销药品有哪些，如何处理" | analyzeInventory(滞销分析) | 滞销品分析+建议 | 验证经营分析 |

### 4.2 基准任务（Baseline Tasks）

| 基准 ID | 任务描述 | 性能要求 | 验收标准 |
|---------|----------|----------|----------|
| BT-1 | 单药品查询 | < 3秒 | 返回完整药品信息 |
| BT-2 | 用药指导生成 | < 5秒 | 返回完整用药指导 |
| BT-3 | 库存预警分析（100品） | < 10秒 | 返回预警列表 |
| BT-4 | 合规检查 | < 3秒 | 返回合规状态 |
| BT-5 | 相互作用分析 | < 5秒 | 返回相互作用等级 |

### 4.3 测试边界情况

| 场景 | 输入 | 预期行为 |
|------|------|----------|
| 禁售药品 | 查询某禁售药 | 🚨 明确提示禁止销售 |
| 处方药无处方 | 购买处方药 | ⚠️ 提示需要处方 |
| 严重相互作用 | 两种严重相互作用药 | 🚨 强烈警告，建议分开购买 |
| 效期已过 | 查询已过期药品 | 🚨 提示已过期，禁止销售 |
| 药品不存在 | "查询XX药" | 返回未找到，提示核实名称 |

---

## 5. Anti-Patterns（失败模式）

### 5.1 危险信号与修复方案

| 危险信号 | 原因 | 修复方案 |
|---------|------|----------|
| 忽视处方药销售限制 | 合规风险 | 强制提示需要处方 |
| 滞销品不处理 | 资金占用 | 建议促销或退货 |
| 效期管理缺失 | 药品过期损耗 | 强制效期预警 |
| 禁售品误售 | 法律风险 | 黑名单拦截 |

### 5.2 应避免的情况

- ❌ **不要**忽视处方药的销售限制
  - 应说"该药为处方药，需要顾客出示处方"

- ❌ **不要**推荐禁售药品
  - 应说"该药属于禁售品，不能销售"

- ❌ **不要**忽视药物相互作用
  - 应主动提示相互作用风险

- ❌ **不要**推荐处方药给无处方顾客
  - 应建议顾客就医获取处方

- ❌ **不要**提供过期药品销售建议
  - 应提示立即下架

### 5.3 失败处理代码示例

```typescript
async function analyzePharmacyRequest(input: PharmacyRequest): Promise<PharmacyResponse> {
  // 1. 合规检查
  const complianceResult = await checkDrugCompliance(input.drugName);
  
  if (complianceResult.status === 'prohibited') {
    return {
      status: 'urgent',
      message: '该药属于禁售品，不能销售',
      action: '下架处理',
      disclaimer: '请遵守药品经营管理规范'
    };
  }
  
  if (complianceResult.prescriptionRequired && !input.hasPrescription) {
    return {
      status: 'warning',
      message: '该药为处方药，需要顾客出示处方',
      action: '要求提供处方',
      disclaimer: '请遵守处方药销售规定'
    };
  }
  
  // 2. 库存检查
  const inventoryCheck = await checkInventory(input.drugName);
  
  if (inventoryCheck.expiryDate && isExpiringSoon(inventoryCheck.expiryDate)) {
    return {
      status: 'warning',
      message: `该药效期至${inventoryCheck.expiryDate}，建议优先销售`,
      action: '效期预警',
      disclaimer: '请注意药品效期管理'
    };
  }
  
  // 3. 返回正常结果
  return {
    status: 'success',
    response: await getDrugInfo(input.drugName),
    disclaimer: '本回答仅供参考'
  };
}
```

---

## 6. Heuristics（决策规则）

### 6.1 合规判断

| 药品类型 | 销售要求 | 验证方式 |
|----------|---------|---------|
| OTC甲类 | 药师指导 | 可直接销售 |
| OTC乙类 | 自主选择 | 可直接销售 |
| 处方药 | 必须凭处方 | 要求出示处方 |
| 抗菌药物 | 处方+登记 | 处方+实名登记 |
| 精神药品 | 专用处方 | 特殊渠道 |
| 疫苗类 | 资质要求 | 确认配送资质 |

### 6.2 库存预警规则

| 预警类型 | 触发条件 | 处理建议 |
|----------|---------|---------|
| 效期预警 | 效期≤30天 | 优先销售/促销 |
| 效期警告 | 效期≤90天 | 计划销售 |
| 库存不足 | 库存≤安全库存 | 及时补货 |
| 滞销预警 | 近效期+高库存 | 促销/退货 |
| 过期预警 | 已过期 | 立即下架 |

### 6.3 经营辅助规则

| 场景 | 规则 |
|------|------|
| 同品替换优先级 | 集采药品 > 基药 > 普通仿制药 |
| 价格参考 | 医保支付价 > 市场价 > 进价 |
| 库存周转 | 重点关注高周转品 |

### 6.4 免责声明标准文本

```
【免责声明】

本回答仅供药店工作人员参考，不构成诊疗建议。
本工具不能替代执业药师的专业判断。
用药前请仔细阅读说明书。
如有疑问，请咨询执业药师。
```

---

## 附录 A：与 skill-factory-core 接口契约

### A.1 输入接口

```typescript
interface PharmacySkillInput {
  intent: 'drug_query' | 'medication_guidance' | 'inventory_analysis' | 
          'compliance_check' | 'drug_interaction' | 'substitute_recommend';
  context?: {
    pharmacyId?: string;
    inventoryData?: InventoryItem[];
    userRole?: 'pharmacist' | 'clerk' | 'manager';
    hasPrescription?: boolean;
  };
  query: string;
}

interface InventoryItem {
  drugName: string;
  quantity: number;
  expiryDate: string;
  purchasePrice: number;
  dailySales?: number;
}
```

### A.2 输出接口

```typescript
interface PharmacySkillOutput {
  status: 'success' | 'warning' | 'urgent' | 'error';
  response?: {
    type: string;
    content: any;
  };
  disclaimer: string;
  source: '卫健委公开数据/临床指南/PubMed';
}
```

---

## 附录 B：MCP 架构说明

### B.1 目录结构

```
pharmacy-operations-advisor/
├── SKILL.md                        # 主 Skill 定义
├── mcp/                            # MCP 适配器目录
│   ├── index.ts                    # 统一导出
│   ├── interfaces.ts               # PharmacyDataSource 接口定义
│   ├── nhc-adapter.ts              # 卫健委公开数据适配器
│   ├── clinical-guidelines-adapter.ts  # 临床指南适配器
│   ├── pubmed-adapter.ts           # PubMed 文献适配器
│   └── config.ts                   # 数据源配置
├── mcp-adapter.ts                  # 向后兼容 shim
├── test-scenarios.md               # 测试场景文档
├── publish-checklist.md            # 发布检查清单
├── prompts/                        # Prompt 模板
│   ├── drug-info-prompt.md
│   ├── medication-guidance-prompt.md
│   ├── inventory-prompt.md
│   ├── compliance-check-prompt.md
│   └── pharmacy-disclaimer.md
└── tests/                          # 单元测试
    └── pharmacy-operations-advisor.test.ts
```

### B.2 数据源配置示例

```typescript
// mcp/config.ts
export const dataSourceConfig = {
  primary: 'nhc',  // 主数据源 = 卫健委公开数据
  fallback: 'clinical-guidelines',  // 兜底数据源 = 临床指南
  priority: [
    { id: 'nhc', capability: 'drug-info' },
    { id: 'nhc', capability: 'compliance-check' },
    { id: 'nhc', capability: 'inventory-analysis' },
    { id: 'clinical-guidelines', capability: 'medication-guidance' },
    { id: 'pubmed', capability: 'drug-interaction' }
  ]
};
```

---

## 附录 C：与 medical-advisor 的复用关系

根据 v3.7.0 规划决策 9（复用模块），本 Skill 复用 medical-advisor 的：

| 模块 | 复用方式 |
|------|---------|
| `mcp/interfaces.ts` | 复用 DrugInfo/DrugInteraction 等接口 |
| `mcp/pubmed-adapter.ts` | 直接复用 pubmed-adapter |
| `mcp/clinical-guidelines-adapter.ts` | 直接复用 clinical-guidelines-adapter |
| `prompts/drug-info-prompt.md` | 调整 prompt 适配药店场景 |
| `skill-compliance` | 复用医疗合规检查规则 |

---

*本文档由 SelfClaw v3.7.0 Domain Skill Factory 自动生成*  
*版本: 1.0.0 | 日期: 2026-06-15*  
*符合 Microsoft SKILL Pattern 6 章节格式*
