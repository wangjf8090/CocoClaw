# Pharmacy Operations Advisor 测试场景文档

> **版本**: 1.0.0（v3.7.0 M1）  
> **日期**: 2026-06-15  
> **用途**: Pharmacy Operations Advisor 自动化测试用例  
> **覆盖范围**: P01-P10 共10个测试场景

---

## 测试概览

| 测试类型 | 测试数量 | 覆盖能力 |
|----------|----------|----------|
| 药品信息查询 | 2个 | drug-info |
| 用药指导 | 1个 | medication-guidance |
| 库存分析 | 2个 | inventory-analysis |
| 合规检查 | 2个 | compliance-check |
| 药物相互作用 | 1个 | drug-interaction |
| 同品替换 | 1个 | substitute-recommend |
| 禁售品识别 | 1个 | compliance-check |

---

## 测试场景详情

### P01: 阿莫西林胶囊药品查询

**测试ID**: P01  
**测试类型**: 药品信息查询  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "drug_query",
  "drugName": "阿莫西林胶囊",
  "query": "查询阿莫西林胶囊的信息和分类"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('drug-info', { drugName: "阿莫西林胶囊" })
   → 调用卫健委公开数据
   
2. 查询药品基本信息
   → 通用名、商品名、规格、生产企业
   
3. 查询分类信息
   → 处方药/OTC分类
   → 医保/基药状态
   
4. 格式化输出
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "drug_info",
    "content": {
      "genericName": "阿莫西林",
      "brandName": "阿莫西林胶囊",
      "dosageForm": "胶囊剂",
      "specifications": "0.25g×24粒",
      "manufacturer": "某制药有限公司",
      "category": "Rx",
      "prescriptionRequired": true,
      "medicalInsurance": true,
      "essentialMedicine": true,
      "indications": ["上呼吸道感染", "下呼吸道感染", "泌尿生殖道感染"],
      "priceRange": "15-30元"
    }
  },
  "disclaimer": "本回答仅供药店工作人员参考，不构成诊疗建议",
  "source": "卫健委公开数据"
}
```

#### 验收标准

- [ ] 正确返回药品基本信息
- [ ] 正确标注处方药分类
- [ ] 标注医保/基药状态
- [ ] 包含完整免责声明

---

### P02: 布洛芬片用药指导查询

**测试ID**: P02  
**测试类型**: 用药指导  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "medication_guidance",
  "drugName": "布洛芬片",
  "context": {
    "patientAge": 45
  },
  "query": "这个药怎么服用，有什么禁忌"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('medication-guidance', { drugName: "布洛芬片" })
   → 调用临床指南数据源
   
2. 获取用药指导
   → 用法用量
   → 服药时间
   → 注意事项
   
3. 根据人群调整（成人）
   → 成人剂量
   → 注意事项

4. 格式化输出
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "medication_guidance",
    "content": {
      "drugName": "布洛芬片",
      "usage": "口服",
      "dosage": "一次1-2片",
      "frequency": "一日2-3次",
      "timing": "饭后服用",
      "adultGuidance": "成人一次1-2片，疼痛时服用，每日不超过4片",
      "precautions": [
        "请在药师指导下使用",
        "如有过敏反应请立即停药",
        "胃溃疡患者慎用"
      ],
      "sideEffects": [
        "可能出现恶心、腹泻等胃肠道反应",
        "偶有皮疹等过敏反应"
      ]
    }
  },
  "disclaimer": "本回答仅供药店工作人员参考，不能替代医生诊疗",
  "source": "临床指南"
}
```

#### 验收标准

- [ ] 正确返回用药指导
- [ ] 包含用法用量
- [ ] 包含注意事项
- [ ] 包含不良反应提示
- [ ] 包含完整免责声明

---

### P03: 效期预警分析

**测试ID**: P03  
**测试类型**: 库存分析（效期预警）  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "inventory_analysis",
  "analysisType": "expiry_warning",
  "inventory": [
    { "drugName": "阿莫西林胶囊", "quantity": 100, "expiryDate": "2025-07-01", "dailySales": 5 },
    { "drugName": "布洛芬片", "quantity": 50, "expiryDate": "2025-06-20", "dailySales": 3 },
    { "drugName": "维生素C片", "quantity": 200, "expiryDate": "2026-12-31", "dailySales": 10 }
  ],
  "query": "哪些药快过期了，需要优先销售"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('inventory-analysis', { inventory: [...], analysisType: "expiry_warning" })
   → 调用卫健委公开数据
   
2. 分析效期
   → 计算剩余天数
   → 识别紧急预警（30天内）
   → 识别警告提醒（90天内）
   
3. 生成处理建议
   → 优先销售计划
   → 供应商协调建议

4. 格式化输出
```

#### 验收标准

- [ ] 正确识别近效期药品（布洛芬片）
- [ ] 正确计算剩余天数
- [ ] 提供处理建议
- [ ] 按紧急程度排序

---

### P04: 处方药合规检查

**测试ID**: P04  
**测试类型**: 合规检查  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "compliance_check",
  "checkType": "prescription_drug",
  "drugName": "阿莫西林胶囊",
  "context": {
    "hasPrescription": false
  },
  "query": "顾客要买这个药，需要什么手续"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('compliance-check', { drugName: "阿莫西林胶囊" })
   → 调用卫健委公开数据
   
2. 查询药品分类
   → 确认处方药
   
3. 检查销售条件
   → 处方要求
   → 实名登记（抗菌药物）
   
4. 生成合规建议
```

#### 预期输出 JSON

```json
{
  "status": "warning",
  "response": {
    "type": "compliance_result",
    "content": {
      "drugName": "阿莫西林胶囊",
      "status": "warning",
      "category": "处方药（抗菌药物）",
      "requirements": [
        {
          "type": "prescription",
          "required": true,
          "description": "必须凭医师处方销售",
          "action": "要求顾客提供处方"
        },
        {
          "type": "registration",
          "required": true,
          "description": "抗菌药物需实名登记",
          "action": "登记购买人身份信息"
        }
      ],
      "recommendations": [
        "请顾客出示医师处方",
        "进行实名登记",
        "联系在职药师审核处方"
      ]
    }
  },
  "disclaimer": "请严格遵守处方药销售规定",
  "source": "卫健委公开数据"
}
```

#### 验收标准

- [ ] 正确识别处方药分类
- [ ] 标注处方要求
- [ ] 提供操作建议
- [ ] 包含完整免责声明

---

### P05: 抗生素销售资质检查

**测试ID**: P05  
**测试类型**: 合规检查（资质）  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "compliance_check",
  "checkType": "sales_condition",
  "drugName": "头孢克肟胶囊",
  "context": {
    "hasPrescription": true,
    "customerAge": 35
  },
  "query": "顾客要买抗生素，需要什么资质"
}
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "compliance_result",
    "content": {
      "drugName": "头孢克肟胶囊",
      "status": "compliant",
      "category": "处方药（抗菌药物）",
      "requirements": [
        { "type": "prescription", "required": true, "description": "需要处方" },
        { "type": "registration", "required": true, "description": "需要实名登记" },
        { "type": "qualification", "required": true, "description": "需要药师审核" }
      ],
      "recommendations": [
        "药师审核处方",
        "进行实名登记",
        "告知顾客用药注意事项"
      ]
    }
  },
  "disclaimer": "本回答仅供参考",
  "source": "卫健委公开数据"
}
```

#### 验收标准

- [ ] 正确识别抗菌药物
- [ ] 列出所有资质要求
- [ ] 提供合规操作建议

---

### P06: 药物相互作用检查

**测试ID**: P06  
**测试类型**: 药物相互作用  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "drug_interaction",
  "drug1": "阿司匹林",
  "drug2": "华法林",
  "query": "这两种药能一起用吗"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('drug-interaction', { drug1: "阿司匹林", drug2: "华法林" })
   → 调用 PubMed 数据源
   
2. 查询相互作用
   → 分析相互作用
   → 评估严重程度
   
3. 生成建议
   → 严重程度：severe
   → 建议：禁止联用
```

#### 预期输出 JSON

```json
{
  "status": "urgent",
  "response": {
    "type": "interaction_warning",
    "content": {
      "interactions": [
        {
          "drug1": "阿司匹林",
          "drug2": "华法林",
          "severity": "severe",
          "description": "两药联用显著增加出血风险",
          "recommendation": "禁止联用，或在严密监测下使用",
          "mechanism": "抗凝作用叠加"
        }
      ]
    }
  },
  "disclaimer": "用药请遵医嘱，如有不适应立即就医",
  "source": "PubMed 文献数据库"
}
```

#### 验收标准

- [ ] 正确识别严重相互作用
- [ ] 标注严重程度
- [ ] 提供明确建议
- [ ] 返回 urgent 状态

---

### P07: 同品替换建议

**测试ID**: P07  
**测试类型**: 同品替换  
**优先级**: P1（经营辅助）

#### 输入

```json
{
  "intent": "substitute_recommend",
  "drugName": "某品牌布洛芬缓释胶囊",
  "query": "有没有便宜的同类药推荐"
}
```

#### 预期 SKILL 调用链

```
1. dataSource.query('substitute-recommend', { drugName: "某品牌布洛芬缓释胶囊" })
   → 调用卫健委公开数据
   
2. 查询同类药品
   → 集采药品
   → 基药目录
   → 仿制药
   
3. 生成替换建议
   → 按价格/报销比例排序
```

#### 验收标准

- [ ] 返回同类替代药品
- [ ] 标注集采/基药标识
- [ ] 提供价格参考
- [ ] 说明推荐理由

---

### P08: 药品分类查询

**测试ID**: P08  
**测试类型**: 药品分类查询  
**优先级**: P1（经营辅助）

#### 输入

```json
{
  "intent": "drug_query",
  "drugName": "维生素C泡腾片",
  "query": "帮我查一下这个药是处方药还是OTC"
}
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "drug_category",
    "content": {
      "drugName": "维生素C泡腾片",
      "category": "OTC-B",
      "prescriptionRequired": false,
      "description": "乙类非处方药，可直接销售"
    }
  },
  "disclaimer": "本回答仅供参考",
  "source": "卫健委公开数据"
}
```

#### 验收标准

- [ ] 正确识别 OTC 分类
- [ ] 明确销售条件
- [ ] 包含完整免责声明

---

### P09: 库存不足预警

**测试ID**: P09  
**测试类型**: 库存分析（库存预警）  
**优先级**: P1（经营辅助）

#### 输入

```json
{
  "intent": "inventory_analysis",
  "analysisType": "low_stock",
  "inventory": [
    { "drugName": "阿莫西林胶囊", "quantity": 20, "expiryDate": "2026-06-30", "dailySales": 10 },
    { "drugName": "布洛芬片", "quantity": 100, "expiryDate": "2026-12-31", "dailySales": 5 }
  ],
  "query": "哪些药库存不足需要补货"
}
```

#### 验收标准

- [ ] 正确识别库存不足（阿莫西林）
- [ ] 计算可售天数
- [ ] 提供补货建议
- [ ] 优先处理紧急预警

---

### P10: 滞销品分析

**测试ID**: P10  
**测试类型**: 库存分析（滞销品）  
**优先级**: P2（经营辅助）

#### 输入

```json
{
  "intent": "inventory_analysis",
  "analysisType": "slow_moving",
  "inventory": [
    { "drugName": "某保健品", "quantity": 500, "expiryDate": "2026-06-30", "dailySales": 1 },
    { "drugName": "常规感冒药", "quantity": 100, "expiryDate": "2026-12-31", "dailySales": 8 }
  ],
  "query": "滞销药品有哪些，如何处理"
}
```

#### 验收标准

- [ ] 识别滞销品（某保健品）
- [ ] 计算周转天数
- [ ] 提供处理建议（促销/退货）
- [ ] 按价值排序

---

## 边界条件测试

### BC01: 禁售药品查询

**输入**: 查询某禁售药品  
**预期**: 🚨 紧急级别，明确禁止销售

### BC02: 过期药品检查

**输入**: 查询已过期药品  
**预期**: 🚨 提示已过期，禁止销售

### BC03: 严重相互作用

**输入**: 查询两种严重相互作用药  
**预期**: 🚨 强烈警告，建议分开购买

### BC04: 药品不存在

**输入**: "查询XXX药"（不存在的药品）  
**预期**: warning，提示未找到

### BC05: 处方药无处方购买

**输入**: 购买处方药 + 无处方  
**预期**: ⚠️ 提示需要处方

---

## 性能基准

| 基准ID | 任务 | 性能要求 | 验收标准 |
|--------|------|----------|----------|
| BT-1 | 单药品查询 | < 3秒 | 返回完整药品信息 |
| BT-2 | 用药指导生成 | < 5秒 | 返回完整用药指导 |
| BT-3 | 库存预警分析（100品） | < 10秒 | 返回预警列表 |
| BT-4 | 合规检查 | < 3秒 | 返回合规状态 |
| BT-5 | 相互作用分析 | < 5秒 | 返回相互作用等级 |

---

## 合规测试

| 测试项 | 验证内容 | 状态 |
|--------|----------|------|
| 免责声明 | 每条输出包含免责 | ☐ |
| 处方药限制 | 处方药销售必须提示处方 | ☐ |
| 禁售品拦截 | 禁售品明确禁止销售 | ☐ |
| 相互作用警告 | 严重相互作用必须警告 | ☐ |
| 效期管理 | 过期药品禁止销售提示 | ☐ |

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2026-06-15 | 初始版本（v3.7.0 M1） |

---

*本文档由 SelfClaw v3.7.0 Domain Skill Factory 自动生成*
