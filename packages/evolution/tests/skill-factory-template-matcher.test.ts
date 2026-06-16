/**
 * 模板匹配器 - 单元测试
 * 
 * 测试场景：
 * - 金融模板匹配
 * - 医疗模板匹配
 * - 学术模板匹配
 * - 法律模板匹配
 * - 意图匹配
 * - 备选模板
 */

import { describe, it, expect } from "vitest";
import {
  TemplateMatcher,
  matchTemplate,
  matchAllTemplates,
  getDefaultPricing,
  createTemplateMatcher,
} from "../code/template-matcher.js";
import type { 
  FieldClassification, 
  IntentRecognition,
  FieldType,
  FieldTemplate,
} from "../code/types.js";

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建模拟垂类分类
 */
function createMockClassification(
  field: FieldType,
  confidence: number = 0.9,
  subDomain?: string
): FieldClassification {
  return {
    field,
    confidence,
    subDomain,
    requiredCapabilities: [],
    evidence: [],
  };
}

/**
 * 创建模拟意图识别
 */
function createMockIntent(
  intent: string,
  confidence: number = 0.9
): IntentRecognition {
  return {
    intent: intent as IntentRecognition["intent"],
    confidence,
    matchedKeywords: [],
  };
}

// ============================================================================
// 模板匹配器测试
// ============================================================================

describe("模板匹配器 - 单元测试", () => {
  let matcher: TemplateMatcher;

  beforeEach(() => {
    matcher = createTemplateMatcher();
  });

  // ==========================================================================
  // 金融模板匹配测试
  // ==========================================================================

  describe("金融模板匹配", () => {
    it("应该匹配金融垂类的分析意图", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("financial");
      expect(result.score).toBeGreaterThan(0);
      expect(result.template.supportedIntents).toContain("analyze");
    });

    it("应该匹配金融垂类的监控意图", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("monitor");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("financial");
      expect(result.template.supportedIntents).toContain("monitor");
    });

    it("应该返回股票分析模板", () => {
      const classification = createMockClassification("financial", 0.9, "股票分析");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.id).toBe("financial-stock-analysis");
    });

    it("应该返回必需的数据源", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.requiredDataSources.length).toBeGreaterThan(0);
      expect(result.missingDataSources.some(ds => ds.required)).toBe(true);
    });
  });

  // ==========================================================================
  // 医疗模板匹配测试
  // ==========================================================================

  describe("医疗模板匹配", () => {
    it("应该匹配医疗垂类的分析意图", () => {
      const classification = createMockClassification("medical");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("medical");
      expect(result.score).toBeGreaterThan(0);
    });

    it("应该匹配医疗垂类的创建意图", () => {
      const classification = createMockClassification("medical");
      const intent = createMockIntent("create");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("medical");
      expect(result.template.supportedIntents).toContain("create");
    });

    it("应该返回医疗助手模板", () => {
      const classification = createMockClassification("medical", 0.9, "体检解读");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.id).toBe("medical-assistant");
    });

    it("应该包含药品数据源", () => {
      const classification = createMockClassification("medical");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      const hasMedicalDataSource = result.template.requiredDataSources.some(
        ds => ds.name.includes("中康") || ds.type === "mcp"
      );
      expect(hasMedicalDataSource).toBe(true);
    });
  });

  // ==========================================================================
  // 学术模板匹配测试
  // ==========================================================================

  describe("学术模板匹配", () => {
    it("应该匹配学术垂类的分析意图", () => {
      const classification = createMockClassification("academic");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("academic");
      expect(result.score).toBeGreaterThan(0);
    });

    it("应该匹配学术垂类的创建意图", () => {
      const classification = createMockClassification("academic");
      const intent = createMockIntent("create");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("academic");
    });

    it("应该返回学术研究模板", () => {
      const classification = createMockClassification("academic", 0.9, "文献检索");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.id).toBe("academic-research");
    });

    it("应该包含PubMed数据源", () => {
      const classification = createMockClassification("academic");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent);
      
      const hasPubMedDataSource = result.template.requiredDataSources.some(
        ds => ds.name.includes("PubMed")
      );
      expect(hasPubMedDataSource).toBe(true);
    });
  });

  // ==========================================================================
  // 法律模板匹配测试
  // ==========================================================================

  describe("法律模板匹配", () => {
    it("应该匹配法律垂类的创建意图", () => {
      const classification = createMockClassification("legal");
      const intent = createMockIntent("create");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("legal");
      expect(result.template.supportedIntents).toContain("create");
    });

    it("应该匹配法律垂类的审计意图", () => {
      const classification = createMockClassification("legal");
      const intent = createMockIntent("audit");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.field).toBe("legal");
      expect(result.template.supportedIntents).toContain("audit");
    });

    it("应该返回合规文档模板", () => {
      const classification = createMockClassification("legal", 0.9, "隐私政策");
      const intent = createMockIntent("create");
      
      const result = matcher.match(classification, intent);
      
      expect(result.template.id).toBe("legal-compliance");
    });

    it("应该包含GDPR数据源", () => {
      const classification = createMockClassification("legal");
      const intent = createMockIntent("create");
      
      const result = matcher.match(classification, intent);
      
      const hasGDPRDataSource = result.template.requiredDataSources.some(
        ds => ds.name.includes("GDPR")
      );
      expect(hasGDPRDataSource).toBe(true);
    });
  });

  // ==========================================================================
  // 意图匹配测试
  // ==========================================================================

  describe("意图匹配", () => {
    const fields: FieldType[] = ["financial", "medical", "academic", "legal"];
    
    fields.forEach(field => {
      it(`应该支持 ${field} 垂类的 analyze 意图`, () => {
        const classification = createMockClassification(field);
        const intent = createMockIntent("analyze");
        
        const result = matcher.match(classification, intent);
        
        expect(result.template.supportedIntents).toContain("analyze");
      });

      it(`应该支持 ${field} 垂类的 create 意图`, () => {
        const classification = createMockClassification(field);
        const intent = createMockIntent("create");
        
        const result = matcher.match(classification, intent);
        
        expect(result.template.supportedIntents).toContain("create");
      });
    });
  });

  // ==========================================================================
  // matchAll 测试
  // ==========================================================================

  describe("matchAll - 匹配所有模板", () => {
    it("应该返回金融垂类的所有模板", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const results = matcher.matchAll(classification, intent);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.template.field === "financial")).toBe(true);
    });

    it("应该按分数降序排列", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const results = matcher.matchAll(classification, intent);
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("每个结果都应该有 reason", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const results = matcher.matchAll(classification, intent);
      
      results.forEach(result => {
        expect(result.reason).toBeDefined();
        expect(result.reason.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // 用户偏好测试
  // ==========================================================================

  describe("用户偏好", () => {
    it("应该优先使用用户指定的模板", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const result = matcher.match(classification, intent, {
        templateId: "financial-stock-analysis",
      });
      
      expect(result.template.id).toBe("financial-stock-analysis");
      expect(result.score).toBe(1.0);
      expect(result.reason).toContain("用户指定");
    });
  });

  // ==========================================================================
  // 模板注册测试
  // ==========================================================================

  describe("模板注册", () => {
    it("应该能注册新模板", () => {
      const newTemplate: FieldTemplate = {
        id: "custom-template",
        name: "Custom Template",
        field: "financial",
        description: "自定义模板",
        supportedIntents: ["analyze"],
        requiredDataSources: [],
        templatePath: "./custom.md",
        content: "# Custom",
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      matcher.registerTemplate(newTemplate);
      
      const templates = matcher.getAllTemplates();
      expect(templates.some(t => t.id === "custom-template")).toBe(true);
    });

    it("getTemplates 应该返回指定垂类的模板", () => {
      const templates = matcher.getTemplates("financial");
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.field === "financial")).toBe(true);
    });

    it("getAllTemplates 应该返回所有模板", () => {
      const templates = matcher.getAllTemplates();
      
      expect(templates.length).toBe(4); // 4 个垂类模板
    });
  });

  // ==========================================================================
  // 定价测试
  // ==========================================================================

  describe("定价配置", () => {
    it("应该返回金融垂类的默认定价", () => {
      const pricing = getDefaultPricing("financial");
      
      expect(pricing.type).toBe("subscription");
      expect(pricing.price).toBe(49.99);
      expect(pricing.callsPerDay).toBe(5000);
    });

    it("应该返回学术垂类的免费定价", () => {
      const pricing = getDefaultPricing("academic");
      
      expect(pricing.type).toBe("free");
    });

    it("应该返回医疗垂类的定价", () => {
      const pricing = getDefaultPricing("medical");
      
      expect(pricing.type).toBe("subscription");
      expect(pricing.price).toBe(39.99);
    });

    it("应该返回法律垂类的定价", () => {
      const pricing = getDefaultPricing("legal");
      
      expect(pricing.type).toBe("subscription");
      expect(pricing.price).toBe(99.99);
    });
  });

  // ==========================================================================
  // 快捷函数测试
  // ==========================================================================

  describe("快捷函数", () => {
    it("matchTemplate 应该正常工作", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const result = matchTemplate(classification, intent);
      
      expect(result.template.field).toBe("financial");
    });

    it("matchAllTemplates 应该返回多个结果", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      const results = matchAllTemplates(classification, intent);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 边界情况测试
  // ==========================================================================

  describe("边界情况", () => {
    it("未知垂类应该抛出错误", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("analyze");
      
      // 临时清空注册表
      const originalRegistry = (matcher as any).templates;
      (matcher as any).templates = new Map();
      
      expect(() => matcher.match(classification, intent)).toThrow("未找到垂类");
      
      // 恢复
      (matcher as any).templates = originalRegistry;
    });

    it("不支持的意图应该有合理的匹配分数", () => {
      const classification = createMockClassification("financial");
      const intent = createMockIntent("unknown-intent" as any, 0.5);
      
      const result = matcher.match(classification, intent);
      
      // 不完全匹配的意图应该返回较低分数
      expect(result.score).toBeLessThan(1);
    });
  });
});
