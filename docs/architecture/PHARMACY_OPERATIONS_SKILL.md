# Pharmacy Operations Advisor 设计文档

> **版本**: v1.0.0  
> **日期**: 2026-06-15  
> **状态**: v3.7.0 M1 完成  
> **Skill**: pharmacy-operations-advisor  
> **定位**: 药店经营辅助垂类基线模板

---

## 一、概述

### 1.1 目的

本文档描述 SelfClaw v3.7.0 M1 阶段实现的 **Pharmacy Operations Advisor**（药店经营辅助 Skill）的设计细节，作为 v3.7.0 开发者级医疗 Skill 工厂的首个垂直场景落地。

### 1.2 定位

| 维度 | 内容 |
|------|------|
| Skill 名称 | pharmacy-operations-advisor |
| 版本 | 1.0.0 |
| 场景优先级 | P0（v3.7.0 首发场景） |
| 目标用户 | 药店店员/店长 |
| 差异化定位 | 开发者级药店经营工具，基于公开数据源 |

### 1.3 与 v3.6.0 的关系

- 复用 `medical-advisor` 的接口设计模式
- 复用 `mcp/pubmed-adapter.ts`
- 复用 `mcp/clinical-guidelines-adapter.ts`
- 场景差异化：医疗通用 → 药店经营专用

---

## 二、核心能力设计

### 2.1 能力矩阵

| 能力 ID | 能力名称 | 数据源 | Stub/Real | 优先级 |
|---------|----------|--------|-----------|--------|
| drug-info | 药品信息查询 | nhc-adapter | Stub | P0 |
| medication-guidance | 用药指导 | clinical-guidelines-adapter | Stub | P0 |
| inventory-analysis | 库存分析 | nhc-adapter | Stub | P0 |
| compliance-check | 合规检查 | nhc-adapter | Stub | P0 |
| drug-interaction | 药物相互作用 | pubmed-adapter | Stub | P1 |
| substitute-recommend | 同品替换 | nhc-adapter | Stub | P1 |

### 2.2 能力详情

#### 2.2.1 药品信息查询（drug-info）

**功能**：
- 药品基本信息查询（通用名/商品名/规格/生产企业）
- 药品分类查询（OTC-A/OTC-B/Rx/Special）
- 医保/基药状态查询
- 价格参考（市场价/医保支付价）

**数据源**：卫健委公开数据

**Stub 实现**：
- 返回预设示例数据
- 标注 TODO 接入真实 API

#### 2.2.2 用药指导（medication-guidance）

**功能**：
- 用法用量指导
- 服药时间建议
- 特殊人群指导（儿童/老年人/孕妇）
- 注意事项、不良反应、相互作用提醒
- 漏服处理、停药指征

**数据源**：临床指南

**Stub 实现**：
- 返回标准化用药指导模板
- 根据人群参数调整内容

#### 2.2.3 库存分析（inventory-analysis）

**功能**：
- 效期预警（30天/90天阈值）
- 库存不足预警（基于日均销量）
- 滞销品识别
- 综合经营分析报告

**数据源**：卫健委公开数据

**Stub 实现**：
- 基于库存数据计算预警
- 提供处理建议

#### 2.2.4 合规检查（compliance-check）

**功能**：
- 处方药销售合规检查
- 禁售品识别
- 经营资质要求查询
- 抗菌药物实名登记提醒

**数据源**：卫健委公开数据

**Stub 实现**：
- 基于关键词识别禁售品
- 标准合规规则库

---

## 三、架构设计

### 3.1 目录结构

```
pharmacy-operations-advisor/
├── SKILL.md                           # 主 Skill 定义（v1.0.0）
├── mcp/                               # MCP 适配器目录
│   ├── index.ts                       # 统一导出
│   ├── interfaces.ts                   # PharmacyDataSource 接口定义
│   ├── nhc-adapter.ts                 # 卫健委公开数据适配器
│   ├── clinical-guidelines-adapter.ts  # 临床指南适配器
│   ├── pubmed-adapter.ts              # PubMed 文献适配器
│   └── config.ts                      # 数据源配置
├── mcp-adapter.ts                     # 向后兼容 shim
├── test-scenarios.md                  # 测试场景文档（P01-P10）
├── publish-checklist.md               # 发布检查清单
├── prompts/                          # Prompt 模板
│   ├── drug-info-prompt.md            # 药品查询
│   ├── medication-guidance-prompt.md  # 用药指导
│   ├── inventory-prompt.md            # 库存分析
│   ├── compliance-check-prompt.md     # 合规检查
│   └── pharmacy-disclaimer.md         # 免责声明
└── tests/                             # 单元测试
    └── pharmacy-operations-advisor.test.ts  # 单元测试（8+ 用例）
```

### 3.2 接口设计

```typescript
// mcp/interfaces.ts
export interface PharmacyDataSource {
  id: string;
  name: string;
  priority: number;
  capabilities: PharmacyCapability[];
  query<T>(capability: PharmacyCapability, params: Record<string, unknown>): Promise<T>;
  healthCheck?(): Promise<boolean>;
}

export type PharmacyCapability =
  | 'drug-info'
  | 'medication-guidance'
  | 'inventory-analysis'
  | 'compliance-check'
  | 'drug-interaction'
  | 'substitute-recommend';
```

### 3.3 数据源优先级

| 能力 | 主数据源 | 优先级 | 兜底 |
|------|---------|--------|------|
| drug-info | nhc | 1 | - |
| medication-guidance | clinical-guidelines | 2 | - |
| inventory-analysis | nhc | 1 | - |
| compliance-check | nhc | 1 | - |
| drug-interaction | pubmed | 3 | - |
| substitute-recommend | nhc | 1 | - |

---

## 四、数据源策略

### 4.1 数据源概览

| 数据源 | 状态 | 说明 |
|--------|------|------|
| 卫健委公开数据 | Stub → 待接入 | 主数据源，零授权风险 |
| 临床指南 | Stub → 待接入 | 用药指导数据 |
| PubMed | Stub → 待接入 | 药物相互作用数据 |
| 中康科技 | 预留 | 暂不接入，v3.7.0 决策 21 |

### 4.2 真实数据源接入 TODO

| 数据源 | 接入项 | 优先级 | 状态 |
|--------|--------|--------|------|
| 国家药监局 | 药品数据查询 API | P0 | ☐ TODO |
| 国家基药目录 | 基本药物目录 | P0 | ☐ TODO |
| 国家医保目录 | 医保药品目录 | P0 | ☐ TODO |
| 医脉通 | 临床指南数据 | P1 | ☐ TODO |
| 丁香园 | 用药指南数据 | P1 | ☐ TODO |
| PubMed E-utilities | 文献检索 API | P1 | ☐ TODO |
| DrugBank | 药物相互作用数据 | P2 | ☐ TODO |

### 4.3 中康科技预留（v3.7.0 决策 21）

> 根据 v3.7.0 决策 21：中康科技作为后续合作窗口预留，暂不接入。

当前策略：
- Stub 实现预留 `zhongkang-adapter.ts` 位置
- 未来接入时只需实现接口 + 注册到 config

---

## 五、合规设计

### 5.1 合规红线

| 红线 | 要求 |
|------|------|
| 处方药销售 | 必须提示处方要求 |
| 禁售品拦截 | 明确禁止销售 |
| 抗菌药物登记 | 必须提示实名登记 |
| 免责声明 | 每条输出必须包含 |
| 过期药品 | 必须提示禁止销售 |

### 5.2 合规规则示例

```typescript
// 合规检查规则
const complianceRules = {
  prescriptionDrug: {
    check: (drug) => drug.category === 'Rx',
    action: 'require_prescription',
    warning: '该药为处方药，需要顾客出示处方'
  },
  prohibited: {
    check: (drug) => PROHIBITED_KEYWORDS.some(k => drug.name.includes(k)),
    action: 'block_sale',
    warning: '该药属于禁售品，不能销售'
  },
  expiry: {
    check: (item) => new Date(item.expiryDate) < new Date(),
    action: 'block_sale',
    warning: '该药已过期，禁止销售'
  }
};
```

---

## 六、反合理化设计（v3.6.1 增强）

### 6.1 反合理化原则

根据 v3.6.1 增强（skill-anti-rationalization.ts），本 Skill 遵循以下反合理化原则：

| 原则 | 说明 | 验证方式 |
|------|------|----------|
| 库存预警不虚报 | 不因追求"服务感"而生成虚假预警 | 正常库存不产生预警 |
| 合规检查不放松 | 不因追求"用户体验"而放松合规 | 处方药必须提示 |
| 免责声明不省略 | 不因追求"简洁"而省略免责 | 每次输出包含 |
| 效期管理不妥协 | 不因追求"销售"而忽略效期 | 过期品明确禁止 |

### 6.2 测试验证

```typescript
// 反合理化测试用例
it('should not fabricate inventory warnings', async () => {
  // 提供正常库存数据
  const result = await analyzeInventory([{ quantity: 100, expiryDate: '2027-12-31' }]);
  // 不应该生成虚假的紧急预警
  expect(result.summary.urgentItems).toBe(0);
});

it('should enforce prescription requirements strictly', async () => {
  // 处方药
  const result = await checkCompliance('阿莫西林胶囊');
  // 应该严格要求处方
  expect(result.requirements.some(r => r.type === 'prescription' && r.required)).toBe(true);
});
```

---

## 七、测试设计

### 7.1 测试场景（P01-P10）

| ID | 测试类型 | 覆盖能力 | 优先级 |
|----|----------|----------|--------|
| P01 | 药品信息查询 | drug-info | P0 |
| P02 | 用药指导查询 | medication-guidance | P0 |
| P03 | 效期预警分析 | inventory-analysis | P0 |
| P04 | 处方药合规检查 | compliance-check | P0 |
| P05 | 抗生素资质检查 | compliance-check | P0 |
| P06 | 药物相互作用 | drug-interaction | P0 |
| P07 | 同品替换建议 | substitute-recommend | P1 |
| P08 | 药品分类查询 | drug-info | P1 |
| P09 | 库存不足预警 | inventory-analysis | P1 |
| P10 | 滞销品分析 | inventory-analysis | P2 |

### 7.2 单元测试覆盖

| 测试类别 | 测试用例数 | 覆盖范围 |
|----------|-----------|----------|
| 数据源测试 | 9 | 3 个 adapter |
| 能力测试 | 13 | 4 大核心能力 |
| 合规测试 | 4 | 合规红线 |
| 反合理化测试 | 3 | v3.6.1 增强 |
| **总计** | **≥29** | **全覆盖** |

---

## 八、与 medical-advisor 的复用关系

### 8.1 复用清单

| 模块 | 复用方式 | 说明 |
|------|---------|------|
| mcp/interfaces.ts | 复用接口模式 | DrugInfo/DrugInteraction 等 |
| mcp/pubmed-adapter.ts | 直接复用 | 药物相互作用查询 |
| mcp/clinical-guidelines-adapter.ts | 调整适配 | 用药指导 |
| prompts/ | 调整场景 | 药店场景 prompt |
| skill-compliance | 复用规则 | 医疗合规检查规则 |

### 8.2 差异化设计

| 维度 | medical-advisor | pharmacy-operations-advisor |
|------|-----------------|---------------------------|
| 核心场景 | 诊断/治疗参考 | 药店经营辅助 |
| 数据源 | 中康/PubMed/指南 | 卫健委/PubMed/指南 |
| 目标用户 | 医师/患者 | 药店店员/店长 |
| 能力重点 | 诊疗辅助 | 库存/合规/经营 |

---

## 九、验收标准

| 项 | 验收 | 状态 |
|----|------|------|
| 目录结构 | 仿照 medical-advisor，完整 6 子目录 | ✅ |
| SKILL.md | v1.0.0，含 4 大核心能力 + 10 测试场景引用 | ✅ |
| mcp-adapter.ts | 7-9 个核心方法 | ✅ |
| mcp/ 目录 | 6 文件齐 | ✅ |
| prompts/ 目录 | 5 个 prompt 文件 | ✅ |
| test-scenarios.md | P01-P10，覆盖 4 大能力 | ✅ |
| publish-checklist.md | 12+ 项 | ✅ |
| 单元测试 | ≥8 用例，覆盖 4 大能力 | ✅ |
| 设计文档 | PHARMACY_OPERATIONS_SKILL.md | ✅ |
| 反合理化 | 在测试用例中体现 | ✅ |

---

## 十、下一步行动

### M1 完成（v3.7.0 W1-W4）

| 行动项 | 状态 |
|--------|------|
| pharmacy-operations-advisor Skill 完成 | ✅ |
| 测试场景 P01-P10 完成 | ✅ |
| 发布检查清单完成 | ✅ |
| 设计文档完成 | ✅ |

### M2 规划（v3.7.0 W5-W8）

| 行动项 | 说明 |
|--------|------|
| 真实数据源接入 | 卫健委 API / 临床指南 / PubMed |
| 中医体质辨识 Skill | P1 场景，GB/T46939-2025 |
| 开发者 SDK 封装 | npm 包发布 |

### M3 规划（v3.7.0 W9-W12）

| 行动项 | 说明 |
|--------|------|
| 商业化准备 | SDK 定价 / 私有化部署包 |
| 数据源 Marketplace | 公开数据源 + 增值数据源 |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0.0 | 2026-06-15 | v3.7.0 M1 完成，初始版本 |

---

*本文档由 SelfClaw v3.7.0 Domain Skill Factory 自动生成*  
*版本: v1.0.0 | 日期: 2026-06-15*
