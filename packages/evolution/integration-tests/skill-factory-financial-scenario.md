# 集成测试 - 金融垂类场景

> **测试场景**：分析贵州茅台最近 30 天股价  
> **垂类**：金融（financial）  
> **意图**：分析（analyze）  
> **子领域**：股票分析  
> **数据源**：Wind MCP Server

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
    "userInput": "分析贵州茅台最近30天股价走势",
    "metadata": {
      "userId": "user-123",
      "sessionId": "session-456"
    }
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "financial",
    "confidence": 0.85,
    "subDomain": "股票分析",
    "requiredCapabilities": [
      "Wind金融终端API",
      "实时行情数据",
      "财务报表分析",
      "技术指标计算",
      "研报摘要生成"
    ],
    "evidence": [
      "匹配模式: 股[票市]",
      "匹配模式: [涨跌跌]幅",
      "匹配模式: K[线图]"
    ],
    "candidates": []
  },
  "intent": {
    "intent": "analyze",
    "confidence": 0.9,
    "matchedKeywords": ["分析"]
  },
  "thresholds": {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.5
  },
  "processingTime": 12
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
      "field": "financial",
      "confidence": 0.85,
      "subDomain": "股票分析",
      "requiredCapabilities": ["Wind金融终端API"],
      "evidence": []
    },
    "intent": {
      "intent": "analyze",
      "confidence": 0.9,
      "matchedKeywords": ["分析"]
    }
  }'
```

### 预期响应

```json
{
  "match": {
    "template": {
      "id": "financial-stock-analysis",
      "name": "Wind Stock Analyzer",
      "field": "financial",
      "description": "基于万得API的A股/港股/美股全品类数据分析",
      "supportedIntents": ["analyze", "monitor", "audit", "create"],
      "requiredDataSources": [
        {
          "id": "wind-mcp",
          "name": "Wind MCP Server",
          "type": "mcp",
          "connector": "wind-mcp",
          "endpoints": ["stock.quote", "stock.history", "stock.financial"],
          "authType": "api_key",
          "authEnvVar": "WIND_API_KEY",
          "required": true
        }
      ]
    },
    "score": 0.85,
    "reason": "垂类匹配: financial（0.85）| 意图匹配: analyze（0.9）| 子领域: 股票分析 | 高度匹配",
    "missingDataSources": [
      {
        "id": "wind-mcp",
        "name": "Wind MCP Server",
        "required": true
      }
    ],
    "suggestedFillers": {
      "triggerPhrases": "分析一下 | 帮我查一下 | 对比一下",
      "subDomain": "股票分析",
      "requiredCapabilities": "Wind金融终端API, 实时行情数据, 财务报表分析, 技术指标计算, 研报摘要生成"
    }
  },
  "processingTime": 8
}
```

---

## 3. Skill 封装 API

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/wrap \
  -H "Content-Type: application/json" \
  -d '{
    "match": {
      "template": {
        "id": "financial-stock-analysis",
        "name": "Wind Stock Analyzer",
        "field": "financial",
        "description": "基于万得API的A股/港股/美股全品类数据分析",
        "supportedIntents": ["analyze", "monitor", "audit", "create"],
        "requiredDataSources": [
          {
            "id": "wind-mcp",
            "name": "Wind MCP Server",
            "type": "mcp",
            "connector": "wind-mcp",
            "endpoints": ["stock.quote", "stock.history", "stock.financial"],
            "authType": "api_key",
            "authEnvVar": "WIND_API_KEY",
            "required": true
          }
        ]
      },
      "score": 0.85,
      "reason": "高度匹配",
      "missingDataSources": [],
      "suggestedFillers": {}
    },
    "config": {
      "name": "kweichow-moutai-analyzer",
      "description": "分析贵州茅台股票走势的垂类Skill",
      "template": {
        "id": "financial-stock-analysis",
        "name": "Wind Stock Analyzer",
        "field": "financial",
        "description": "基于万得API的A股/港股/美股全品类数据分析",
        "supportedIntents": ["analyze", "monitor", "audit", "create"],
        "requiredDataSources": [],
        "templatePath": "./templates/financial-stock-analysis.md",
        "content": "# Wind Stock Analyzer",
        "version": "1.0.0",
        "createdAt": "2026-06-12T00:00:00Z",
        "updatedAt": "2026-06-12T00:00:00Z"
      },
      "domainModel": {
        "provider": "openai",
        "model": "gpt-4o",
        "systemPrompt": "你是一位资深A股分析师，基于Wind金融终端数据提供专业的投资分析服务。注意：不提供投资建议，所有分析仅供参考。",
        "maxTokens": 4096,
        "temperature": 0.7
      },
      "dataSources": [
        {
          "id": "wind-mcp",
          "name": "Wind MCP Server",
          "type": "mcp",
          "connector": "wind-mcp",
          "endpoints": ["stock.quote", "stock.history", "stock.financial"],
          "authType": "api_key",
          "authEnvVar": "WIND_API_KEY",
          "required": true
        }
      ],
      "complianceRequirements": ["sec-compliance", "risk-disclosure"],
      "pricing": {
        "type": "subscription",
        "price": 49.99,
        "currency": "USD",
        "period": "monthly",
        "callsPerDay": 5000,
        "callsPerMinute": 50
      },
      "author": "SelfClaw Skill Factory",
      "version": "1.0.0"
    },
    "generatePattern": true
  }'
```

### 预期响应

```json
{
  "result": {
    "skillDir": "./skills/kweichow-moutai-analyzer",
    "generatedFiles": [
      {
        "path": "./skills/kweichow-moutai-analyzer/SKILL.md",
        "name": "SKILL.md",
        "type": "skill_md",
        "size": 2048,
        "overwritten": false
      },
      {
        "path": "./skills/kweichow-moutai-analyzer/SKILL.pattern.md",
        "name": "SKILL.pattern.md",
        "type": "skill_md",
        "size": 4096,
        "overwritten": false
      },
      {
        "path": "./skills/kweichow-moutai-analyzer/src/index.ts",
        "name": "index.ts",
        "type": "index_ts",
        "size": 1024,
        "overwritten": false
      }
    ],
    "skillMdContent": "# Wind Stock Analyzer\n\n> **版本**: 1.0.0\n> **垂类**: financial\n> **作者**: SelfClaw Skill Factory\n\n## 描述\n\n基于万得API的A股/港股/美股全品类数据分析\n\n## 核心能力\n\n- 实时行情查询\n- 财务数据分析\n- 估值对比\n- 公告速读\n- 技术指标计算\n\n## 合规声明\n\n> ⚠️ **本内容仅供参考，不构成投资建议**\n> ⚠️ **投资有风险，入市需谨慎**\n> ⚠️ **数据来源：Wind金融终端**",
    "skillPatternContent": "# Wind Stock Analyzer - SKILL Pattern\n\n## 1. Scope（范围）\n\n### 核心能力\n- 实时行情查询\n- 财务数据分析\n- 估值对比分析\n- 公告速读\n\n### 使用边界\n- ❌ 不提供投资建议\n- ❌ 不预测股价走势\n- ❌ 不接入非授权数据源\n\n## 2. Idioms（指令风格）\n\n## 3. Patterns（成功路径）\n\n## 4. Fixtures（测试用例）\n\n## 5. Anti-Patterns（失败模式）\n\n## 6. Heuristics（决策规则）",
    "metadata": {
      "name": "kweichow-moutai-analyzer",
      "version": "1.0.0",
      "field": "financial",
      "riskLevel": "high",
      "capabilities": [
        "实时行情查询",
        "财务数据分析",
        "估值对比",
        "公告速读",
        "技术指标计算"
      ],
      "pricing": {
        "type": "subscription",
        "price": 49.99,
        "callsPerDay": 5000
      },
      "tags": ["金融", "投资", "股票", "A股", "财务分析"]
    },
    "estimatedDeployTime": "15-30秒"
  },
  "apiEndpoint": "/api/skills/kweichow-moutai-analyzer",
  "processingTime": 45
}
```

---

## 4. 创建完整 Skill API

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/skills \
  -H "Content-Type: application/json" \
  -d '{
    "field": "financial",
    "name": "kweichow-moutai-analyzer",
    "description": "分析贵州茅台股票走势的垂类Skill",
    "templateId": "financial-stock-analysis",
    "dataSources": [
      {
        "id": "wind-mcp",
        "name": "Wind MCP Server",
        "type": "mcp",
        "endpoints": ["stock.quote", "stock.history"],
        "authType": "api_key",
        "authEnvVar": "WIND_API_KEY",
        "required": true
      }
    ],
    "domainModel": {
      "provider": "openai",
      "model": "gpt-4o",
      "systemPrompt": "你是一位资深A股分析师"
    }
  }'
```

### 预期响应

```json
{
  "skillId": "skill_a1b2c3d4",
  "status": "created",
  "template": "financial-stock-analysis",
  "files": [
    "skills/kweichow-moutai-analyzer/SKILL.md",
    "skills/kweichow-moutai-analyzer/SKILL.pattern.md",
    "skills/kweichow-moutai-analyzer/src/index.ts"
  ],
  "auditScore": {
    "fme": 85,
    "as": 92,
    "hrb": 98
  },
  "estimatedDeployTime": "15-30秒"
}
```

---

## 验收标准

| 编号 | 验收条件 | 验证结果 |
|------|---------|----------|
| V1 | 垂类识别为 financial | ✅ |
| V2 | 置信度 > 0.8 | ✅ |
| V3 | 子领域识别为"股票分析" | ✅ |
| V4 | 意图识别为 analyze | ✅ |
| V5 | 模板匹配为 financial-stock-analysis | ✅ |
| V6 | SKILL.md 包含 6 章节 | ✅ |
| V7 | 合规声明包含"不构成投资建议" | ✅ |
| V8 | 风险等级为 high | ✅ |
| V9 | 定价配置正确 | ✅ |
