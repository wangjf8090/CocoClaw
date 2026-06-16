# 集成测试 - 法律垂类场景

> **测试场景**：起草服务条款  
> **垂类**：法律（legal）  
> **意图**：创建（create）  
> **子领域**：服务条款  
> **数据源**：GDPR 合规模板库

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
    "userInput": "起草服务条款",
    "metadata": {
      "userId": "legal-user-001",
      "sessionId": "session-legal"
    }
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "legal",
    "confidence": 0.90,
    "subDomain": "服务条款",
    "requiredCapabilities": [
      "GDPR合规模板库",
      "Cookie政策生成",
      "隐私政策审查",
      "数据处理协议",
      "服务条款起草"
    ],
    "evidence": [
      "匹配模式: 合[同协议]",
      "匹配模式: 条[款款]",
      "匹配模式: 签[署订]"
    ],
    "candidates": []
  },
  "intent": {
    "intent": "create",
    "confidence": 0.95,
    "matchedKeywords": ["起草"]
  },
  "thresholds": {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.5
  },
  "processingTime": 9
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
      "field": "legal",
      "confidence": 0.90,
      "subDomain": "服务条款",
      "requiredCapabilities": ["GDPR合规模板库"],
      "evidence": []
    },
    "intent": {
      "intent": "create",
      "confidence": 0.95,
      "matchedKeywords": ["起草"]
    }
  }'
```

### 预期响应

```json
{
  "match": {
    "template": {
      "id": "legal-compliance",
      "name": "Legal Compliance Documentor",
      "field": "legal",
      "description": "基于GDPR等法规的法律合规文书助手",
      "supportedIntents": ["create", "audit", "manage", "analyze"],
      "requiredDataSources": [
        {
          "id": "gdpr-template",
          "name": "GDPR 合规模板库",
          "type": "file",
          "endpoints": ["templates/gdpr/", "templates/ccpa/"],
          "authType": "none",
          "required": true
        }
      ]
    },
    "score": 0.87,
    "reason": "垂类匹配: legal（0.90）| 意图匹配: create（0.95）| 子领域: 服务条款 | 高度匹配",
    "missingDataSources": [
      {
        "id": "gdpr-template",
        "name": "GDPR 合规模板库",
        "required": true
      }
    ],
    "suggestedFillers": {
      "triggerPhrases": "起草一份 | 帮我生成 | 创建",
      "subDomain": "服务条款",
      "requiredCapabilities": "GDPR合规模板库, Cookie政策生成, 隐私政策审查, 数据处理协议, 服务条款起草"
    }
  },
  "processingTime": 5
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
      "name": "terms-of-service-generator",
      "description": "基于GDPR等法规起草服务条款的垂类Skill",
      "template": {
        "id": "legal-compliance",
        "name": "Legal Compliance Documentor",
        "field": "legal",
        "description": "基于GDPR等法规的法律合规文书助手",
        "supportedIntents": ["create", "audit", "manage", "analyze"],
        "requiredDataSources": [
          {
            "id": "gdpr-template",
            "name": "GDPR 合规模板库",
            "type": "file",
            "endpoints": ["templates/gdpr/", "templates/ccpa/"],
            "authType": "none",
            "required": true
          }
        ]
      },
      "domainModel": {
        "provider": "openai",
        "model": "gpt-4o",
        "systemPrompt": "你是一位法律合规顾问，基于GDPR等法规提供合规文书服务。注意：不提供法律意见，所有模板仅供参考。",
        "maxTokens": 8192
      },
      "dataSources": [
        {
          "id": "gdpr-template",
          "name": "GDPR 合规模板库",
          "type": "file",
          "endpoints": ["templates/gdpr/", "templates/ccpa/"],
          "authType": "none",
          "required": true
        }
      ],
      "complianceRequirements": ["gdpr-compliance", "legal-disclaimer"]
    },
    "generatePattern": true
  }'
```

### 预期响应

```json
{
  "result": {
    "skillDir": "./skills/terms-of-service-generator",
    "generatedFiles": [
      {
        "path": "./skills/terms-of-service-generator/SKILL.md",
        "name": "SKILL.md",
        "type": "skill_md",
        "size": 2560,
        "overwritten": false
      },
      {
        "path": "./skills/terms-of-service-generator/SKILL.pattern.md",
        "name": "SKILL.pattern.md",
        "type": "skill_md",
        "size": 5120,
        "overwritten": false
      },
      {
        "path": "./skills/terms-of-service-generator/src/index.ts",
        "name": "index.ts",
        "type": "index_ts",
        "size": 1280,
        "overwritten": false
      }
    ],
    "skillMdContent": "# Legal Compliance Documentor\n\n> **版本**: 1.0.0\n> **垂类**: legal\n> **作者**: SelfClaw Skill Factory\n\n## 核心能力\n\n- 隐私政策生成\n- Cookie政策\n- 数据处理协议\n- 合规检查清单\n- 多语言支持\n\n## 合规声明\n\n> ⚠️ **本模板仅供参考，不构成法律意见**\n> ⚠️ **使用前请咨询专业律师**\n> ⚠️ **具体合规要求因业务类型和地区而异**",
    "metadata": {
      "name": "terms-of-service-generator",
      "version": "1.0.0",
      "field": "legal",
      "riskLevel": "high",
      "capabilities": [
        "隐私政策生成",
        "Cookie政策",
        "DPA协议",
        "合规检查",
        "多语言支持"
      ],
      "pricing": {
        "type": "subscription",
        "price": 99.99,
        "callsPerDay": 1000
      },
      "tags": ["法律", "合规", "GDPR", "隐私政策", "合同"]
    },
    "estimatedDeployTime": "30-60秒"
  },
  "apiEndpoint": "/api/skills/terms-of-service-generator",
  "processingTime": 65
}
```

---

## 4. GDPR 合规检查场景

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "检查一下现有隐私政策是否符合GDPR"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "legal",
    "confidence": 0.92,
    "subDomain": "隐私政策",
    "requiredCapabilities": ["GDPR合规模板库"],
    "evidence": [
      "匹配模式: [合规]",
      "匹配模式: GDPR,
      "匹配模式: 隐私[政策保护]"
    ]
  },
  "intent": {
    "intent": "audit",
    "confidence": 0.95,
    "matchedKeywords": ["检查"]
  }
}
```

---

## 5. Cookie 政策场景

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "我们的App需要什么Cookie政策"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "legal",
    "confidence": 0.88,
    "subDomain": "Cookie政策",
    "requiredCapabilities": ["GDPR合规模板库", "Cookie政策生成"],
    "evidence": [
      "匹配模式: Cookie,
      "匹配模式: [同拒]?意"
    ]
  },
  "intent": {
    "intent": "create",
    "confidence": 0.8,
    "matchedKeywords": ["需要"]
  }
}
```

---

## 6. 数据处理协议场景

### 请求

```bash
curl -X POST http://localhost:3000/api/factory/classify \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "起草一份数据处理协议"
  }'
```

### 预期响应

```json
{
  "classification": {
    "field": "legal",
    "confidence": 0.94,
    "subDomain": "数据处理协议",
    "requiredCapabilities": ["GDPR合规模板库", "数据处理协议"],
    "evidence": [
      "匹配模式: [数据]处[理],
      "匹配模式: 合[同协议]"
    ]
  },
  "intent": {
    "intent": "create",
    "confidence": 0.95,
    "matchedKeywords": ["起草"]
  }
}
```

---

## 验收标准

| 编号 | 验收条件 | 验证结果 |
|------|---------|----------|
| V1 | 垂类识别为 legal | ✅ |
| V2 | 置信度 > 0.85 | ✅ |
| V3 | 子领域识别为"服务条款" | ✅ |
| V4 | 模板匹配为 legal-compliance | ✅ |
| V5 | 合规声明包含"不构成法律意见" | ✅ |
| V6 | 合规声明包含"使用前请咨询专业律师" | ✅ |
| V7 | 风险等级为 high | ✅ |
| V8 | 定价配置正确 | ✅ |
| V9 | GDPR 合规检查场景正常工作 | ✅ |
| V10 | Cookie 政策场景正常工作 | ✅ |
| V11 | 数据处理协议场景正常工作 | ✅ |
| V12 | GDPR 模板匹配规范 | ✅ |
