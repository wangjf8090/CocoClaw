# 集成测试 - 学术垂类场景

> **测试场景**：检索 2026 年阿尔茨海默病最新文献  
> **垂类**：学术（academic）  
> **意图**：分析（analyze）  
> **子领域**：文献检索  
> **数据源**：PubMed E-utilities API

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
    "userInput": "检索2026年阿尔茨海默病最新文献",
    "metadata": {
      "userId": "researcher-001",
      "sessionId": "session-research"
    }
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "academic",
    "confidence": 0.88,
    "subDomain": "文献检索",
    "requiredCapabilities": [
      "PubMed E-utilities API",
      "文献检索",
      "影响因子查询",
      "引用分析",
      "多格式导出"
    ],
    "evidence": [
      "匹配模式: 检[索索]",
      "匹配模式: 论[文文献]",
      "匹配模式: PubMed"
    ],
    "candidates": []
  },
  "intent": {
    "intent": "analyze",
    "confidence": 0.8,
    "matchedKeywords": ["检索"]
  },
  "thresholds": {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.5
  },
  "processingTime": 11
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
      "field": "academic",
      "confidence": 0.88,
      "subDomain": "文献检索",
      "requiredCapabilities": ["PubMed E-utilities API"],
      "evidence": []
    },
    "intent": {
      "intent": "analyze",
      "confidence": 0.8,
      "matchedKeywords": ["检索"]
    }
  }'
```

### 预期响应

```json
{
  "match": {
    "template": {
      "id": "academic-research",
      "name": "PubMed Research Assistant",
      "field": "academic",
      "description": "基于PubMed的生物医学文献检索和分析",
      "supportedIntents": ["analyze", "create", "monitor", "audit"],
      "requiredDataSources": [
        {
          "id": "pubmed-mcp",
          "name": "PubMed MCP Server",
          "type": "mcp",
          "connector": "pubmed-mcp",
          "endpoints": ["search", "fetch_abstract", "citation_lookup"],
          "authType": "api_key",
          "authEnvVar": "PUBMED_API_KEY",
          "required": true
        }
      ]
    },
    "score": 0.82,
    "reason": "垂类匹配: academic（0.88）| 意图匹配: analyze（0.8）| 子领域: 文献检索 | 高度匹配",
    "missingDataSources": [
      {
        "id": "pubmed-mcp",
        "name": "PubMed MCP Server",
        "required": true
      }
    ],
    "suggestedFillers": {
      "triggerPhrases": "检索一下 | 帮我查一下 | 搜索一下",
      "subDomain": "文献检索",
      "requiredCapabilities": "PubMed E-utilities API, 文献检索, 影响因子查询, 引用分析, 多格式导出"
    }
  },
  "processingTime": 6
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
      "name": "alzheimers-literature-searcher",
      "description": "基于PubMed检索阿尔茨海默病最新文献的垂类Skill",
      "template": {
        "id": "academic-research",
        "name": "PubMed Research Assistant",
        "field": "academic",
        "description": "基于PubMed的生物医学文献检索和分析",
        "supportedIntents": ["analyze", "create", "monitor", "audit"],
        "requiredDataSources": [
          {
            "id": "pubmed-mcp",
            "name": "PubMed MCP Server",
            "type": "mcp",
            "endpoints": ["search", "fetch_abstract"],
            "authType": "api_key",
            "authEnvVar": "PUBMED_API_KEY",
            "required": true
          }
        ]
      },
      "domainModel": {
        "provider": "openai",
        "model": "gpt-4o",
        "systemPrompt": "你是一位学术研究助手，基于PubMed生物医学数据库提供文献检索和分析服务。",
        "maxTokens": 4096
      },
      "dataSources": [
        {
          "id": "pubmed-mcp",
          "name": "PubMed MCP Server",
          "type": "mcp",
          "endpoints": ["search", "fetch_abstract", "citation_lookup"],
          "authType": "api_key",
          "authEnvVar": "PUBMED_API_KEY",
          "required": true
        }
      ],
      "complianceRequirements": ["citation-integrity"]
    },
    "generatePattern": true
  }'
```

### 预期响应

```json
{
  "result": {
    "skillDir": "./skills/alzheimers-literature-searcher",
    "generatedFiles": [
      {
        "path": "./skills/alzheimers-literature-searcher/SKILL.md",
        "name": "SKILL.md",
        "type": "skill_md",
        "size": 1920,
        "overwritten": false
      },
      {
        "path": "./skills/alzheimers-literature-searcher/SKILL.pattern.md",
        "name": "SKILL.pattern.md",
        "type": "skill_md",
        "size": 3840,
        "overwritten": false
      },
      {
        "path": "./skills/alzheimers-literature-searcher/src/index.ts",
        "name": "index.ts",
        "type": "index_ts",
        "size": 960,
        "overwritten": false
      }
    ],
    "skillMdContent": "# PubMed Research Assistant\n\n> **版本**: 1.0.0\n> **垂类**: academic\n> **作者**: SelfClaw Skill Factory\n\n## 核心能力\n\n- 文献检索\n- 趋势分析\n- 引用分析\n- 论文写作辅助\n\n## 合规声明\n\n> ⚠️ **本内容仅供学术研究参考**\n> ⚠️ **引用请注明来源**\n> ⚠️ **数据来源：PubMed生物医学数据库**",
    "metadata": {
      "name": "alzheimers-literature-searcher",
      "version": "1.0.0",
      "field": "academic",
      "riskLevel": "low",
      "capabilities": [
        "文献检索",
        "影响因子查询",
        "引用分析",
        "趋势追踪",
        "多格式导出"
      ],
      "pricing": {
        "type": "free",
        "callsPerDay": 100
      },
      "tags": ["学术", "研究", "文献", "PubMed", "论文"]
    },
    "estimatedDeployTime": "10-20秒"
  },
  "apiEndpoint": "/api/skills/alzheimers-literature-searcher",
  "processingTime": 38
}
```

---

## 4. 高级检索场景：趋势分析

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "分析一下mRNA疫苗领域的研究趋势"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "academic",
    "confidence": 0.85,
    "subDomain": "趋势分析",
    "requiredCapabilities": [
      "PubMed E-utilities API",
      "文献检索",
      "影响因子查询",
      "引用分析",
      "多格式导出"
    ],
    "evidence": [
      "匹配模式: 研[究究]",
      "匹配模式: 趋势"
    ]
  },
  "intent": {
    "intent": "analyze",
    "confidence": 0.9,
    "matchedKeywords": ["分析", "趋势"]
  }
}
```

---

## 5. 引用分析场景

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "导出近五年深度学习在医学影像应用的文献到BibTeX"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "academic",
    "confidence": 0.90,
    "subDomain": "文献检索",
    "requiredCapabilities": [
      "PubMed E-utilities API",
      "文献检索",
      "影响因子查询",
      "引用分析",
      "多格式导出"
    ],
    "evidence": [
      "匹配模式: 检[索索]",
      "匹配模式: 引[用文]",
      "匹配模式: BibTeX"
    ]
  },
  "intent": {
    "intent": "create",
    "confidence": 0.75,
    "matchedKeywords": ["导出"]
  }
}
```

---

## 验收标准

| 编号 | 验收条件 | 验证结果 |
|------|---------|----------|
| V1 | 垂类识别为 academic | ✅ |
| V2 | 置信度 > 0.8 | ✅ |
| V3 | 子领域识别为"文献检索" | ✅ |
| V4 | 模板匹配为 academic-research | ✅ |
| V5 | 合规声明包含"引用请注明来源" | ✅ |
| V6 | 风险等级为 low | ✅ |
| V7 | 定价为 free | ✅ |
| V8 | PubMed E-utilities 接入规范 | ✅ |
| V9 | 支持 BibTeX 导出格式 | ✅ |
| V10 | 趋势分析场景正常工作 | ✅ |
