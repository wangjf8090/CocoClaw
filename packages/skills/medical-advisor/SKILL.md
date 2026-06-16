# SKILL: Medical Advisor（通用医疗助手）

> **版本**: 1.1.0（v3.6.0.1 去中康化版）  
> **日期**: 2026-06-14  
> **模板来源**: SelfClaw v3.6.0 Domain Skill Factory - Medical Template  
> **符合规范**: Microsoft SKILL Pattern 6 章节格式  
> **差异化定位**: 开发者级医疗 Skill 工厂，支持多数据源可插拔 + 私有化部署 + 二次开发

---

## 差异化定位

本模板是 SelfClaw v3.6.0 领域 Skill 工厂的**医疗垂类基线模板**，定位"开发者级医疗 Skill 工厂"，支持：

- **多数据源可插拔**：中康科技 / PubMed / 临床指南可自由组合，默认主数据源 = 中康
- **私有化部署**：适合医院 / 诊所 / 药店内网场景
- **二次开发友好**：TypeScript 接口抽象 + 完整测试覆盖 + 模块化架构

**与扣子×中康官方医疗 Skill 的区别**：本模板不绑定单一数据源，开发者可基于业务需求选择 / 组合数据源，更适合需要定制化和私有化的场景。

---

## 1. Scope（范围）

### 1.1 技能定义

通用医疗助手，整合多数据源（药品数据库 / 疾病知识库 / 文献资源 / 临床指南），提供药品查询、疾病诊断参考、体检报告解读、科研文献检索、医疗数据分析等能力。本 Skill 是 SelfClaw v3.6.0 医疗垂类模板的标准化实现，支持多数据源插拔，可直接通过 skill-factory-core 生成定制化医疗 Skill。

### 1.2 核心能力（Capabilities）

| 能力 ID | 能力名称 | 描述 |
|---------|----------|------|
| `medical-qa` | 医学问答 | 症状分析、疾病参考、诊疗指南摘要 |
| `drug-info` | 药品信息 | 适应症查询、用法用量、不良反应、药物相互作用 |
| `health-report` | 健康报告 | 体检报告解读、慢病管理、健康建议 |
| `literature-search` | 文献检索 | 医学文献检索、临床试验查询 |
| `data-analysis` | 数据分析 | 病历结构化、医疗统计、市场研究 |

### 1.3 支持的数据源（可插拔）

| 数据源 | 类型 | 说明 |
|--------|------|------|
| zhongkang-adapter | 主数据源 | 中康科技 30万+ 药品数据库 |
| pubmed-adapter | 兜底数据源 | PubMed 文献检索（英文场景） |
| clinical-guidelines-adapter | 扩展数据源 | 临床指南检索 |

> **配置方式**：修改 `mcp/config.ts` 中的 `dataSourcePriority` 数组即可切换 / 组合数据源

### 1.4 使用边界（不做什么）

- ❌ **不提供最终诊断**：仅作为辅助参考，诊断必须由执业医师做出
- ❌ **不开具处方**：不生成具有法律效力的处方文件
- ❌ **不替代专业医疗**：紧急情况必须建议用户就医
- ❌ **不提供毒麻药品详情**：特殊药品需合规限制
- ❌ **不处理紧急医疗情况**：如胸痛、呼吸困难等必须建议立即就医

### 1.5 元数据（Metadata）

```yaml
name: medical-advisor
version: 1.1.0
risk_level: high
requires:
  - network:http
  - mcp:medical-adapter
capabilities:
  - medical-qa
  - drug-info
  - health-report
  - literature-search
  - data-analysis
compliance:
  - hipaa
  - gdpr-health-data
  - medical-device-warning
  - professional-review-disclaimer
pricing_hint: 199-499 元/月（医疗版建议订阅价）
```

### 1.6 触发短语（Triggers）

```
- "查询阿司匹林的用法用量"
- "帮我解读一下这份体检报告"
- "二型糖尿病的诊疗指南是什么"
- "最近有哪些新药获批"
- "帮我找一下肿瘤免疫治疗的文献"
- "这款药的副作用有哪些"
- "儿童退烧药有哪些"
- "高血压患者饮食需要注意什么"
```

---

## 2. Idioms（指令风格）

### 2.1 用户指令格式

```json
{
  "intent": "drug_query | diagnosis_assist | health_report | chronic_disease | literature_search | data_analysis",
  "context": {
    "patientAge": 45,
    "gender": "male | female",
    "allergies": ["青霉素"],
    "currentMedications": ["二甲双胍"],
    "medicalHistory": ["高血压", "糖尿病"]
  },
  "query": "具体问题描述"
}
```

### 2.2 响应格式规范

```json
{
  "status": "success | warning | urgent",
  "response": {
    "type": "drug_info | diagnosis_reference | report_interpretation | literature_summary | health_advice",
    "content": {
      "title": "阿司匹林肠溶片",
      "genericName": "Aspirin",
      "indications": ["解热镇痛", "抗血小板聚集"],
      "dosage": "50-100mg/次，3次/日",
      "warnings": ["胃肠道出血风险"]
    }
  },
  "disclaimer": "本回答仅供医疗专业人员参考，不构成诊疗建议",
  "source": "医疗数据库",
  "evidence": [
    { "type": "指南", "name": "国家基本药物目录2023", "relevance": 0.9 }
  ],
  "urgentLevel": "info | warning | urgent"
}
```

### 2.3 警告级别定义

| 级别 | 标识 | 触发条件 | 处理方式 |
|------|------|---------|---------|
| Info | ℹ️ | 一般信息查询 | 正常返回 |
| Warning | ⚠️ | 用药风险/注意事项/需要复查 | 显著标注警告 |
| Urgent | 🚨 | 严重不良反应/用药禁忌/紧急症状 | 强烈提示立即就医 |

### 2.4 错误处理规范

| 错误类型 | HTTP 状态码 | 响应示例 |
|----------|-------------|---------|
| 药品未找到 | 404 | `{ status: "warning", message: "未找到该药品，请核实名称" }` |
| 用药禁忌 | 200 | `{ status: "urgent", urgentLevel: "urgent", message: "该药禁用于XX人群，禁止使用" }` |
| 严重相互作用 | 200 | `{ status: "warning", message: "与当前用药存在严重相互作用" }` |
| 紧急症状 | 200 | `{ status: "urgent", urgentLevel: "urgent", message: "建议立即就医或拨打120" }` |
| 数据暂时不可用 | 503 | `{ status: "error", message: "数据服务暂时不可用，请稍后重试" }` |

---

## 3. Patterns（成功路径）

### 3.1 最佳实践清单

#### Pattern 1：药品信息标准化查询

```
1. 解析药品名称（支持商品名/通用名/别名）
   - 商品名 → 查询药品说明书
   - 通用名 → 查询成分相同药品
   - 别名 → 映射到标准名称

2. 核实用药人群（成人/儿童/孕妇/老人）
   - 儿童用药：剂量调整
   - 孕妇用药：风险分级
   - 老年人：肝肾功能考虑

3. 查询适应症和禁忌症
   - 适应症匹配
   - 禁忌症检查
   - 特殊人群注意

4. 检查药物相互作用（与当前用药）
   - 严重相互作用：立即警告
   - 中度相互作用：提示注意
   - 轻度相互作用：一般提示

5. 生成用药指导建议
   - 用法用量
   - 服药时间
   - 注意事项
   - 副作用监测
```

#### Pattern 2：体检报告智能解读

```
1. 提取关键指标数值
   - 血常规：WBC/RBC/PLT/Hb
   - 生化：血糖/血脂/肝功/肾功
   - 尿常规：蛋白/潜血/白细胞

2. 与参考范围对比
   - 正常范围标注
   - 临界值标注
   - 异常值标注

3. 识别异常项（↑↓标识）
   - 轻度异常
   - 中度异常
   - 重度异常

4. 分级评估
   - 无需处理
   - 建议复查
   - 需要治疗

5. 生成健康建议
   - 饮食建议
   - 运动建议
   - 就医建议

6. 标注需要复查的项目
   - 复查时间
   - 复查项目
   - 就诊科室
```

#### Pattern 3：症状到参考诊断

```
1. 收集症状描述（部位/持续时间/程度）
   - 主要症状
   - 伴随症状
   - 症状持续时间
   - 症状严重程度

2. 查询鉴别诊断列表
   - 可能性排序
   - 相似度评分

3. 按可能性排序
   - 高可能性
   - 中可能性
   - 低可能性

4. 标注需要进一步检查的项目
   - 推荐检查
   - 检查目的

5. 明确提示"需就医确认"
   - 必须立即就医
   - 建议尽快就医
   - 可择期就医
```

### 3.2 思维链示例

```
用户: "我爸65岁，有高血压病史，最近总是头晕，帮他分析一下"

思维链:
1. 收集信息：
   - 年龄=65岁（老年）
   - 既往史=高血压
   - 症状=头晕
   
2. 风险评估：
   - 老年 + 高血压 + 头晕 → 心脑血管风险 ⚠️
   - 需要排除：血压波动、颈椎病、贫血、药物副作用
   
3. 可能原因分析：
   - 血压控制不佳（可能性：高）
   - 颈动脉斑块导致供血不足（可能性：中）
   - 药物副作用（可能性：中）
   - 贫血（可能性：低）
   
4. 建议检查：
   - 24小时动态血压监测
   - 颈椎X光或CT
   - 血常规（排除贫血）
   - 颈动脉超声
   
5. 输出响应：
   - 明确标注 🚨 Urgent 级别
   - 强烈建议"尽快就医"
   - 提供具体检查建议
   - 包含专业免责声明
```

---

## 4. Fixtures（测试用例）

### 4.1 测试场景列表

| ID | 输入 Query | 预期 SKILL 调用链 | 预期输出 JSON | 备注 |
|----|-----------|-------------------|---------------|------|
| M01 | "查询阿莫西林的适应症和禁忌" | getDrugInfo(阿莫西林) | 完整药品信息+过敏提示 | 验证药品数据库 |
| M02 | "解读体检报告：空腹血糖7.2mmol/L" | interpretExamReport(血糖=7.2) | 糖尿病前期评估+建议 | 验证指标解读 |
| M03 | "二甲双胍和格列美脲能一起用吗" | checkDrugInteraction(两种药) | 相互作用分析 | 验证相互作用库 |
| M04 | "帮我查一下最近获批的肿瘤新药" | searchNewDrugs(肿瘤) | 新药列表+适应症 | 验证行业数据 |
| M05 | "肺癌免疫治疗的最新文献" | searchLiterature(肺癌+免疫治疗) | PubMed相关文献 | 验证文献检索 |
| M06 | "高血压患者饮食需要注意什么" | getHealthAdvice(高血压) | 饮食建议+注意事项 | 验证健康管理 |
| M07 | "儿童退烧药有哪些" | searchDrugs(退烧+儿童) | 儿童适用药品列表 | 验证人群适配 |
| M08 | "帮我分析血常规报告" | interpretExamReport(血常规) | WBC/RBC/PLT分析 | 验证报告解析 |
| M09 | "65岁老人头晕如何处理" | analyzeSymptoms(头晕+老年+高血压) | 鉴别诊断+建议 | 验证症状分析 |
| M10 | "帮我整理一份高血压管理方案" | generateHealthPlan(高血压) | 综合管理方案 | 验证方案生成 |

### 4.2 基准任务（Baseline Tasks）

| 基准 ID | 任务描述 | 性能要求 | 验收标准 |
|---------|----------|----------|----------|
| BT-1 | 单药品查询 | < 3 秒 | 返回完整药品信息 |
| BT-2 | 体检报告解读 | < 10 秒 | 识别异常项+建议 |
| BT-3 | 药物相互作用分析 | < 5 秒 | 返回相互作用等级 |
| BT-4 | 症状分析 | < 8 秒 | 返回鉴别诊断列表 |
| BT-5 | 文献检索（10篇） | < 10 秒 | 返回文献摘要 |

### 4.3 测试边界情况

| 场景 | 输入 | 预期行为 |
|------|------|----------|
| 紧急症状 | "胸痛" | 🚨 立即建议拨打120 |
| 儿童用药 | "8岁儿童退烧" | 标注儿童剂量 |
| 孕妇禁忌 | "孕妇能用这个药吗" | 🚨 明确提示禁忌 |
| 药品不存在 | "查询XX药" | 返回未找到，提示核实名称 |
| 严重相互作用 | "XX药和XX药一起用" | 🚨 强烈警告，提示就医 |

---

## 5. Anti-Patterns（失败模式）

### 5.1 危险信号与修复方案

| 危险信号 | 原因 | 修复方案 |
|---------|------|----------|
| 将辅助诊断当最终诊断 | 用户可能直接采纳 | 每次响应强制加免责声明 |
| 忽视药物过敏信息 | 导致严重后果 | 强制要求输入过敏史 |
| 建议特殊药品给特殊人群 | 法规和医学风险 | 添加人群过滤逻辑 |
| 报告紧急症状不提示就医 | 延误治疗 | 关键词触发 Urgent 级别 |

### 5.2 应避免的情况

- ❌ **不要**直接说"你得了XX病"
  - 应说"根据描述，可能存在XX情况，建议就医确认"

- ❌ **不要**建议使用处方药给无处方用户
  - 应说"该药为处方药，请咨询医生"

- ❌ **不要**忽视多个异常指标的相关性
  - 应综合分析，识别关联性

- ❌ **不要**在紧急症状上犹豫是否建议就医
  - 应立即标注 🚨 强烈建议就医

- ❌ **不要**提供毒麻精放药品的详细用法
  - 应提示需专业医师处方

### 5.3 失败处理代码示例

```typescript
async function analyzeMedicalQuery(input: MedicalQuery): Promise<MedicalResponse> {
  // 1. 紧急症状检查
  const urgentKeywords = ['胸痛', '呼吸困难', '意识模糊', '严重过敏'];
  const hasUrgent = urgentKeywords.some(k => input.query.includes(k));
  
  if (hasUrgent) {
    return {
      status: 'urgent',
      urgentLevel: 'urgent',
      message: '您的症状可能需要紧急医疗处理',
      immediateAction: '建议立即就医或拨打120',
      disclaimer: '本回答仅供参考，不能替代医生诊断'
    };
  }
  
  // 2. 药品查询（通过数据源管理器）
  if (input.intent === 'drug_query') {
    try {
      const dataSource = await dataSourceRegistry.resolve('drug-info');
      const drugInfo = await dataSource.query('getDrugInfo', { drugName: input.drugName });
      
      // 3. 过敏检查
      if (input.context.allergies?.length > 0) {
        const allergyCheck = checkAllergies(drugInfo, input.context.allergies);
        if (allergyCheck.hasRisk) {
          return {
            status: 'warning',
            urgentLevel: 'warning',
            message: `该药含有${allergyCheck.allergen}成分，可能引起过敏`,
            immediateAction: '建议在医生指导下使用',
            disclaimer: '本回答仅供参考，不能替代医生诊断'
          };
        }
      }
      
      return {
        status: 'success',
        response: drugInfo,
        disclaimer: '本回答仅供参考，不能替代医生诊断'
      };
      
    } catch (error) {
      return {
        status: 'error',
        message: '药品信息查询失败，请稍后重试',
        disclaimer: '本回答仅供参考，不能替代医生诊断'
      };
    }
  }
  
  // ... 其他处理逻辑
}
```

---

## 6. Heuristics（决策规则）

### 6.1 紧急情况判断

| 关键词 | 级别 | 响应策略 |
|--------|------|---------|
| "胸痛" | 🚨 Urgent | 立即建议拨打120 |
| "呼吸困难" | 🚨 Urgent | 立即建议就医 |
| "意识模糊" | 🚨 Urgent | 立即建议就医 |
| "过敏性休克" | 🚨 Urgent | 立即建议拨打120 |
| "大出血" | 🚨 Urgent | 立即建议拨打120 |
| "持续高热" | ⚠️ Warning | 建议24小时内就医 |
| "药物过敏" | ⚠️ Warning | 建议立即停药并就医 |
| "严重头晕" | ⚠️ Warning | 建议尽快就医 |
| "血压异常" | ⚠️ Warning | 建议监测并就医 |

### 6.2 证据分级

| 证据来源 | 权重 | 说明 |
|---------|------|------|
| 临床指南 | 0.95 | 权威医学机构发布 |
| 药品说明书 | 0.90 | 法定文件 |
| 专家共识 | 0.85 | 多位专家签字 |
| 临床研究 | 0.75 | 发表论文 |
| 病例报告 | 0.50 | 个案参考 |

### 6.3 医疗合规红线

| 红线 | 要求 |
|------|------|
| 诊断禁止 | 绝不说"你得了XX病"，只能说"可能存在XX情况" |
| 处方禁止 | 绝不生成具有法律效力的处方 |
| 紧急处理 | 紧急症状必须立即建议就医 |
| 患者隐私 | 绝不透露任何可识别患者信息 |
| 特殊药品 | 毒麻精放药品严格限制 |

### 6.4 免责声明标准文本

```
【免责声明】

本回答仅供医疗专业人员参考，不构成诊疗建议。
本工具不能替代执业医师的诊断和治疗。
如有不适，请及时就医。
紧急情况请拨打120。
```

---

## 附录 A：与 skill-factory-core 接口契约

### A.1 输入接口

```typescript
interface MedicalSkillInput {
  intent: 'drug_query' | 'diagnosis_assist' | 'health_report' | 
          'chronic_disease' | 'literature_search' | 'data_analysis';
  context?: {
    patientAge?: number;
    gender?: 'male' | 'female';
    allergies?: string[];
    currentMedications?: string[];
    medicalHistory?: string[];
  };
  query: string;
}
```

### A.2 输出接口

```typescript
interface MedicalSkillOutput {
  status: 'success' | 'warning' | 'urgent' | 'error';
  urgentLevel: 'info' | 'warning' | 'urgent';
  response?: {
    type: string;
    content: any;
  };
  disclaimer: string;
  source: '医疗数据库';
  evidence?: Array<{
    type: string;
    name: string;
    relevance: number;
  }>;
}
```

---

## 附录 B：MCP 架构说明

### B.1 目录结构

```
medical-advisor/
├── SKILL.md                        # 主 Skill 定义
├── mcp/                            # MCP 适配器目录
│   ├── index.ts                    # 统一导出
│   ├── interfaces.ts               # MedicalDataSource 接口定义
│   ├── zhongkang-adapter.ts        # 中康科技适配器
│   ├── pubmed-adapter.ts           # PubMed 文献检索适配器
│   ├── clinical-guidelines-adapter.ts  # 临床指南适配器
│   └── config.ts                   # 数据源配置
├── mcp-adapter.ts                  # 向后兼容 shim
├── test-scenarios.md
├── publish-checklist.md
└── prompts/                        # Prompt 模板
```

### B.2 数据源配置示例

```typescript
// mcp/config.ts
export const dataSourceConfig = {
  primary: 'zhongkang',  // 主数据源
  fallback: 'pubmed',     // 兜底数据源
  priority: [
    { id: 'zhongkang', capability: 'drug-info' },
    { id: 'pubmed', capability: 'literature-search' },
    { id: 'zhongkang', capability: 'clinical-guidelines' }
  ]
};
```

---

*本文档由 SelfClaw v3.6.0 Domain Skill Factory 自动生成*  
*版本: 1.1.0 (v3.6.0.1 去中康化版) | 日期: 2026-06-14*  
*符合 Microsoft SKILL Pattern 6 章节格式*
