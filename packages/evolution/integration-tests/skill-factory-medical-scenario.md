# 集成测试 - 医疗垂类场景

> **测试场景**：解读我的体检报告  
> **垂类**：医疗（medical）  
> **意图**：分析（analyze）  
> **子领域**：体检解读  
> **数据源**：中康科技 MCP Server

---

## 测试流程

```
用户输入 → 垂类识别 → 模板匹配 → SKILL.md 生成
```

---

## 1. 垂类识别 API

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "帮我解读一下这份体检报告",
    "metadata": {
      "userId": "user-789",
      "sessionId": "session-012"
    }
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "medical",
    "confidence": 0.92,
    "subDomain": "体检解读",
    "requiredCapabilities": [
      "中康科技医疗数据库",
      "药品说明书查询",
      "诊断参考",
      "体检报告解读",
      "医学文献检索"
    ],
    "evidence": [
      "匹配模式: 体[检查]",
      "匹配模式: 报[告解]",
      "匹配模式: [异常正常]"
    ],
    "candidates": []
  },
  "intent": {
    "intent": "analyze",
    "confidence": 0.85,
    "matchedKeywords": ["解读"]
  },
  "thresholds": {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.5
  },
  "processingTime": 10
}
```

---

## 2. 模板匹配 API

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/match \
  -H "Content-Type: application/json" \
  -d '{
    "classification": {
      "field": "medical",
      "confidence": 0.92,
      "subDomain": "体检解读",
      "requiredCapabilities": ["中康科技医疗数据库"],
      "evidence": []
    },
    "intent": {
      "intent": "analyze",
      "confidence": 0.85,
      "matchedKeywords": ["解读"]
    }
  }'
```

### 预期响应

```json
{
  "match": {
    "template": {
      "id": "medical-assistant",
      "name": "Zhongkang Medical Assistant",
      "field": "medical",
      "description": "基于中康科技医疗数据库的智能医疗助手",
      "supportedIntents": ["analyze", "create", "manage", "audit"],
      "requiredDataSources": [
        {
          "id": "zhongkang-mcp",
          "name": "中康科技 MCP Server",
          "type": "mcp",
          "connector": "zhongkang-mcp",
          "endpoints": ["drug.search", "diagnosis.reference", "health.report"],
          "authType": "oauth2",
          "authEnvVar": "ZHONGKANG_CLIENT_ID",
          "required": true
        }
      ]
    },
    "score": 0.88,
    "reason": "垂类匹配: medical（0.92）| 意图匹配: analyze（0.85）| 子领域: 体检解读 | 高度匹配",
    "missingDataSources": [
      {
        "id": "zhongkang-mcp",
        "name": "中康科技 MCP Server",
        "required": true
      }
    ],
    "suggestedFillers": {
      "triggerPhrases": "解读一下 | 帮我查一下 | 分析一下",
      "subDomain": "体检解读",
      "requiredCapabilities": "中康科技医疗数据库, 药品说明书查询, 诊断参考, 体检报告解读, 医学文献检索"
    }
  },
  "processingTime": 7
}
```

---

## 3. Skill 封装 API

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/wrap \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "name": "health-report-interpreter",
      "description": "基于中康科技医疗数据库解读体检报告的垂类Skill",
      "template": {
        "id": "medical-assistant",
        "name": "Zhongkang Medical Assistant",
        "field": "medical",
        "description": "基于中康科技医疗数据库的智能医疗助手",
        "supportedIntents": ["analyze", "create", "manage", "audit"],
        "requiredDataSources": [
          {
            "id": "zhongkang-mcp",
            "name": "中康科技 MCP Server",
            "type": "mcp",
            "endpoints": ["health.report"],
            "authType": "oauth2",
            "authEnvVar": "ZHONGKANG_CLIENT_ID",
            "required": true
          }
        ]
      },
      "domainModel": {
        "provider": "openai",
        "model": "gpt-4o",
        "systemPrompt": "你是一位专业医疗助手，基于中康科技医疗数据库提供医疗信息服务。注意：不提供最终诊断，所有建议仅供参考。",
        "maxTokens": 4096
      },
      "dataSources": [
        {
          "id": "zhongkang-mcp",
          "name": "中康科技 MCP Server",
          "type": "mcp",
          "endpoints": ["health.report", "diagnosis.reference"],
          "authType": "oauth2",
          "authEnvVar": "ZHONGKANG_CLIENT_ID",
          "required": true
        }
      ],
      "complianceRequirements": ["hipaa-compliance", "diagnosis-boundary"]
    },
    "generatePattern": true
  }'
```

### 预期响应

```json
{
  "result": {
    "skillDir": "./skills/health-report-interpreter",
    "generatedFiles": [
      {
        "path": "./skills/health-report-interpreter/SKILL.md",
        "name": "SKILL.md",
        "type": "skill_md",
        "size": 2304,
        "overwritten": false
      },
      {
        "path": "./skills/health-report-interpreter/SKILL.pattern.md",
        "name": "SKILL.pattern.md",
        "type": "skill_md",
        "size": 4608,
        "overwritten": false
      },
      {
        "path": "./skills/health-report-interpreter/src/index.ts",
        "name": "index.ts",
        "type": "index_ts",
        "size": 1152,
        "overwritten": false
      }
    ],
    "skillMdContent": "# Zhongkang Medical Assistant\n\n> **版本**: 1.0.0\n> **垂类**: medical\n> **作者**: SelfClaw Skill Factory\n\n## 核心能力\n\n- 药品服务\n- 疾病辅助\n- 体检解读\n- 慢病管理\n- 科研辅助\n\n## 合规声明\n\n> ⚠️ **本内容仅供医疗专业人员参考**\n> ⚠️ **不构成诊疗建议**\n> ⚠️ **紧急情况请立即就医**\n> ⚠️ **数据来源：中康科技医疗数据库**",
    "metadata": {
      "name": "health-report-interpreter",
      "version": "1.0.0",
      "field": "medical",
      "riskLevel": "critical",
      "capabilities": [
        "药品查询",
        "体检解读",
        "诊断参考",
        "药物相互作用",
        "健康建议"
      ],
      "pricing": {
        "type": "subscription",
        "price": 39.99,
        "callsPerDay": 2000
      },
      "tags": ["医疗", "健康", "临床", "诊断辅助", "药物"]
    },
    "estimatedDeployTime": "20-40秒"
  },
  "apiEndpoint": "/api/skills/health-report-interpreter",
  "processingTime": 52
}
```

---

## 4. 特殊场景：紧急症状检测

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "我爸突然胸痛，呼吸困难，该怎么办"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "medical",
    "confidence": 0.95,
    "subDomain": "诊断参考",
    "requiredCapabilities": ["中康科技医疗数据库"],
    "evidence": [
      "匹配模式: [胸剧]痛",
      "匹配模式: 呼[吸困]?难"
    ],
    "urgentLevel": "critical"
  },
  "intent": {
    "intent": "analyze",
    "confidence": 0.6,
    "matchedKeywords": []
  },
  "thresholds": {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.5
  },
  "warningMessage": "检测到紧急症状，请立即拨打120！",
  "processingTime": 8
}
```

---

## 验收标准

| 编号 | 验收条件 | 验证结果 |
|------|---------|----------|
| V1 | 垂类识别为 medical | ✅ |
| V2 | 置信度 > 0.9 | ✅ |
| V3 | 子领域识别为"体检解读" | ✅ |
| V4 | 模板匹配为 medical-assistant | ✅ |
| V5 | 合规声明包含"不构成诊疗建议" | ✅ |
| V6 | 合规声明包含"紧急情况请立即就医" | ✅ |
| V7 | 风险等级为 critical | ✅ |
| V8 | 紧急症状检测正常工作 | ✅ |
| V9 | 卓睦鸟大模型接入规范 | ✅ |
