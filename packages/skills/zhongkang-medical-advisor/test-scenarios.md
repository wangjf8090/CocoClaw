# Zhongkang Medical Advisor 测试场景文档

> **版本**: 1.0.0
> **日期**: 2026-06-12
> **用途**: Zhongkang Medical Advisor 自动化测试用例
> **覆盖范围**: M01-M10 共10个测试场景

---

## 测试概览

| 测试类型 | 测试数量 | 覆盖能力 |
|----------|----------|----------|
| 药品信息查询 | 2个 | drug-info |
| 体检报告解读 | 2个 | health-report |
| 药物相互作用 | 1个 | drug-info |
| 症状分析 | 1个 | medical-qa |
| 文献检索 | 1个 | literature-search |
| 健康管理 | 1个 | health-report |
| 紧急症状处理 | 2个 | medical-qa |

---

## 测试场景详情

### M01: 阿莫西林药品查询

**测试ID**: M01  
**测试类型**: 药品信息查询  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "drug_query",
  "drugName": "阿莫西林",
  "context": {
    "allergies": ["青霉素"]
  },
  "query": "查询阿莫西林的适应症和禁忌"
}
```

#### 预期 SKILL 调用链

```
1. adapter.getDrugInfo("阿莫西林")
   → 调用中康科技药品数据库
   
2. 检查过敏信息
   → 用户有青霉素过敏史
   → 阿莫西林属于青霉素类
   → 触发过敏警告

3. 格式化输出
   → 返回完整药品信息
   → 包含过敏警告
```

#### 预期输出 JSON

```json
{
  "status": "warning",
  "urgentLevel": "warning",
  "response": {
    "type": "drug_info",
    "content": {
      "genericName": "阿莫西林",
      "brandName": "常见商品名",
      "indications": ["上呼吸道感染", "下呼吸道感染", "泌尿生殖道感染"],
      "contraindications": ["青霉素过敏者禁用"],
      "warnings": [
        "⚠️ 警告：该药属于青霉素类抗生素，与您的过敏史（青霉素）可能冲突，请务必在医生指导下使用"
      ]
    }
  },
  "disclaimer": "本回答仅供参考，不能替代医生诊断",
  "source": "中康科技医疗数据库"
}
```

#### 验收标准

- [ ] 正确返回药品信息
- [ ] 检测到青霉素过敏风险
- [ ] 显示过敏警告
- [ ] 包含完整免责声明

---

### M02: 空腹血糖体检报告解读

**测试ID**: M02  
**测试类型**: 体检报告解读  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "health_report",
  "patientInfo": {
    "age": 55,
    "gender": "male"
  },
  "reportData": {
    "items": [
      { "name": "空腹血糖", "value": 7.2, "unit": "mmol/L" },
      { "name": "糖化血红蛋白", "value": 6.5, "unit": "%" }
    ]
  },
  "query": "解读空腹血糖7.2是什么情况"
}
```

#### 预期 SKILL 调用链

```
1. adapter.interpretExamReport({
     items: [{name: "空腹血糖", value: 7.2}],
     patientAge: 55
   })
   → 调用体检报告解读接口
   
2. 判断严重程度
   → 空腹血糖 7.2 mmol/L ≥ 7.0
   → 达到糖尿病诊断标准
   → 触发中度异常

3. 生成健康建议
```

#### 预期输出 JSON

```json
{
  "status": "warning",
  "urgentLevel": "warning",
  "response": {
    "type": "report_interpretation",
    "content": {
      "abnormalItems": [
        {
          "name": "空腹血糖",
          "value": 7.2,
          "unit": "mmol/L",
          "referenceRange": { "min": 3.9, "max": 6.1 },
          "status": "abnormal",
          "severity": "moderate",
          "interpretation": "空腹血糖7.2 mmol/L已达到糖尿病诊断标准（≥7.0 mmol/L），建议内分泌科就诊"
        }
      ],
      "healthAdvice": {
        "dietAdvice": ["控制碳水化合物摄入", "少食多餐", "避免高糖食物"],
        "exerciseAdvice": ["每周至少150分钟中等强度运动"],
        "monitoringAdvice": ["建议监测血糖", "完善糖耐量试验"]
      },
      "followUpRecommendation": "建议尽快到内分泌科就诊，明确诊断并制定治疗方案"
    }
  },
  "disclaimer": "本回答仅供参考，不能替代医生诊断",
  "source": "中康科技医疗数据库"
}
```

#### 验收标准

- [ ] 正确识别空腹血糖异常
- [ ] 评估严重程度为中度
- [ ] 提供饮食和运动建议
- [ ] 建议就诊科室

---

### M03: 二甲双胍和格列美脲相互作用

**测试ID**: M03  
**测试类型**: 药物相互作用  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "drug_query",
  "drugName": "二甲双胍和格列美脲",
  "query": "二甲双胍和格列美脲能一起用吗"
}
```

#### 预期 SKILL 调用链

```
1. adapter.getDrugInfo("二甲双胍")
2. adapter.getDrugInfo("格列美脲")
3. adapter.checkDrugInteraction("二甲双胍", "格列美脲")
   → 分析相互作用
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "urgentLevel": "info",
  "response": {
    "type": "drug_interaction",
    "content": {
      "interactions": [
        {
          "drug1": "二甲双胍",
          "drug2": "格列美脲",
          "severity": "moderate",
          "description": "两药联用可增强降糖效果，但可能增加低血糖风险",
          "recommendation": "联用需在医生指导下进行，密切监测血糖"
        }
      ]
    }
  },
  "disclaimer": "用药请遵医嘱，如有不适应立即就医",
  "source": "中康科技医疗数据库"
}
```

#### 验收标准

- [ ] 正确分析相互作用
- [ ] 标注严重程度
- [ ] 提供用药建议
- [ ] 包含免责声明

---

### M04: 肿瘤新药检索

**测试ID**: M04  
**测试类型**: 医疗数据/文献检索  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "data_analysis",
  "query": "最近有哪些新药获批",
  "params": {
    "type": "market",
    "category": "肿瘤"
  }
}
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "market_data",
    "content": {
      "title": "2024-2025年获批肿瘤新药",
      "data": [
        {
          "drugName": "XXX单抗",
          "indication": "非小细胞肺癌",
          "approvalDate": "2025-03",
          "mechanism": "PD-1抑制剂"
        }
      ]
    }
  },
  "disclaimer": "本信息仅供参考",
  "source": "中康科技医疗数据库"
}
```

---

### M05: 肺癌免疫治疗文献检索

**测试ID**: M05  
**测试类型**: 文献检索  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "literature_search",
  "query": "肺癌免疫治疗",
  "params": {
    "years": [2022, 2024],
    "limit": 10
  }
}
```

#### 预期 SKILL 调用链

```
1. adapter.searchLiterature("肺癌 免疫治疗", { years: [2022, 2024] })
   → 检索PubMed等文献数据库
   
2. 格式化输出
   → 返回文献摘要列表
```

#### 验收标准

- [ ] 返回相关文献列表
- [ ] 包含文献基本信息
- [ ] 支持按年份筛选

---

### M06: 高血压健康建议

**测试ID**: M06  
**测试类型**: 健康管理  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "health_report",
  "query": "高血压患者饮食需要注意什么"
}
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "response": {
    "type": "health_advice",
    "content": {
      "condition": "高血压",
      "advice": {
        "diet": [
          "限制钠盐摄入，每日<6g",
          "增加钾摄入，多吃蔬菜水果",
          "限制饮酒"
        ],
        "restrictions": [
          "避免腌制食品",
          "减少加工食品"
        ]
      }
    }
  },
  "disclaimer": "建议仅供参考，请遵医嘱调整",
  "source": "中康科技医疗数据库"
}
```

---

### M07: 儿童退烧药查询

**测试ID**: M07  
**测试类型**: 特殊人群用药  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "drug_query",
  "query": "儿童退烧药有哪些",
  "context": {
    "patientAge": 8
  }
}
```

#### 验收标准

- [ ] 返回适合儿童的退烧药
- [ ] 包含儿童剂量信息
- [ ] 标注年龄限制
- [ ] 强调需遵医嘱

---

### M08: 血常规报告解读

**测试ID**: M08  
**测试类型**: 体检报告解读  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "health_report",
  "reportData": {
    "items": [
      { "name": "白细胞计数", "value": 11.5, "unit": "×10⁹/L" },
      { "name": "中性粒细胞比例", "value": 78, "unit": "%" },
      { "name": "血红蛋白", "value": 135, "unit": "g/L" }
    ]
  }
}
```

#### 验收标准

- [ ] 识别白细胞升高
- [ ] 判断可能感染
- [ ] 建议就医复查

---

### M09: 老年头晕症状分析

**测试ID**: M09  
**测试类型**: 症状分析（紧急）  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "medical_qa",
  "context": {
    "age": 65,
    "medicalHistory": ["高血压", "糖尿病"]
  },
  "query": "65岁老人头晕如何处理"
}
```

#### 预期 SKILL 调用链

```
1. adapter.analyzeSymptoms(
     ["头晕"],
     { age: 65, medicalHistory: ["高血压", "糖尿病"] }
   )
   
2. 评估紧急程度
   → 老年 + 高血压 + 头晕
   → 心脑血管风险
   → 触发 warning/urgent 级别
```

#### 验收标准

- [ ] 识别高风险人群
- [ ] 提供鉴别诊断
- [ ] 建议立即就医
- [ ] 显示紧急警告

---

### M10: 高血压管理方案

**测试ID**: M10  
**测试类型**: 慢病管理  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "health_report",
  "reportType": "慢病管理",
  "patientInfo": {
    "age": 58,
    "gender": "male",
    "weight": 80,
    "height": 170
  },
  "query": "帮我制定高血压管理方案"
}
```

#### 预期 SKILL 调用链

```
1. adapter.generateHealthPlan("高血压", {
     age: 58,
     gender: "male",
     weight: 80,
     height: 170
   })
   
2. 生成个性化管理方案
   → 用药建议
   → 生活方式干预
   → 监测计划
   → 随访计划
```

#### 验收标准

- [ ] 生成个性化方案
- [ ] 包含用药管理
- [ ] 包含饮食运动建议
- [ ] 包含随访计划

---

## 边界条件测试

### BC01: 紧急症状 - 胸痛

**输入**: "突然胸口很疼，呼吸困难"  
**预期**: 🚨 紧急级别，立即建议拨打120

### BC02: 孕妇用药禁忌

**输入**: 查询某药品 + context.pregnant=true  
**预期**: ⚠️ 强化警告，强烈建议咨询医生

### BC03: 药品未找到

**输入**: "查询XXX药"（不存在的药品）  
**预期**: warning，提示未找到

### BC04: 严重药物相互作用

**输入**: 查询两种严重相互作用的药物  
**预期**: 🚨 强烈警告，建议立即就医

---

## 性能基准

| 基准ID | 任务 | 性能要求 | 验收标准 |
|--------|------|----------|----------|
| BT-1 | 单药品查询 | < 3秒 | 返回完整药品信息 |
| BT-2 | 体检报告解读 | < 10秒 | 识别异常项+建议 |
| BT-3 | 药物相互作用 | < 5秒 | 返回相互作用等级 |
| BT-4 | 症状分析 | < 8秒 | 返回鉴别诊断列表 |
| BT-5 | 文献检索（10篇） | < 10秒 | 返回文献摘要 |

---

## 合规测试

| 测试项 | 验证内容 | 状态 |
|--------|----------|------|
| 免责声明 | 每条输出包含免责 | ☐ |
| 诊断禁止 | 不出现"确诊"等表述 | ☐ |
| 紧急处理 | 紧急症状立即提示就医 | ☐ |
| 患者隐私 | 无敏感信息泄露 | ☐ |

---

*本文档由 SelfClaw v3.6.0 Domain Skill Factory 自动生成*
