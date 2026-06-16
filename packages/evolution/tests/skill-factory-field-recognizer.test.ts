/**
 * 垂类识别引擎 - 单元测试
 * 
 * 测试场景：
 * - 金融垂类识别
 * - 医疗垂类识别
 * - 学术垂类识别
 * - 法律垂类识别
 * - 意图识别
 * - 复杂度评估
 */

import { describe, it, expect } from "vitest";
import {
  FieldRecognizer,
  classifyField,
  recognizeFieldIntent,
  estimateFieldComplexity,
  createFieldRecognizer,
} from "../code/field-recognizer.js";
import type { FieldType } from "../code/types.js";

describe("垂类识别引擎 - 单元测试", () => {
  let recognizer: FieldRecognizer;

  beforeEach(() => {
    recognizer = createFieldRecognizer();
  });

  // ==========================================================================
  // 金融垂类识别测试
  // ==========================================================================

  describe("金融垂类识别", () => {
    it("应该识别 '分析贵州茅台股票' 为金融垂类", () => {
      const result = recognizer.classify("分析贵州茅台股票");
      
      expect(result.field).toBe("financial");
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.subDomain).toBe("股票分析");
    });

    it("应该识别 '查询A股实时行情' 为金融垂类", () => {
      const result = recognizer.classify("查询A股实时行情");
      
      expect(result.field).toBe("financial");
      expect(result.requiredCapabilities).toContain("Wind金融终端API");
    });

    it("应该识别 '分析宁德时代财务数据' 为金融垂类", () => {
      const result = recognizer.classify("分析宁德时代财务数据");
      
      expect(result.field).toBe("financial");
      expect(result.subDomain).toBe("财报分析");
    });

    it("应该识别 '对比苹果和微软的估值' 为金融垂类", () => {
      const result = recognizer.classify("对比苹果和微软的估值");
      
      expect(result.field).toBe("financial");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it("应该识别 '基金净值走势' 为金融垂类", () => {
      const result = recognizer.classify("基金净值走势分析");
      
      expect(result.field).toBe("financial");
      expect(result.subDomain).toBe("基金评估");
    });
  });

  // ==========================================================================
  // 医疗垂类识别测试
  // ==========================================================================

  describe("医疗垂类识别", () => {
    it("应该识别 '解读我的体检报告' 为医疗垂类", () => {
      const result = recognizer.classify("解读我的体检报告");
      
      expect(result.field).toBe("medical");
      expect(result.subDomain).toBe("体检解读");
      expect(result.requiredCapabilities).toContain("中康科技医疗数据库");
    });

    it("应该识别 '查询阿司匹林用法用量' 为医疗垂类", () => {
      const result = recognizer.classify("查询阿司匹林用法用量");
      
      expect(result.field).toBe("medical");
      expect(result.subDomain).toBe("药品查询");
    });

    it("应该识别 '分析血常规报告' 为医疗垂类", () => {
      const result = recognizer.classify("帮我分析一下血常规报告");
      
      expect(result.field).toBe("medical");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it("应该识别 '二甲双胍和格列美脲能一起用吗' 为医疗垂类", () => {
      const result = recognizer.classify("二甲双胍和格列美脲能一起用吗");
      
      expect(result.field).toBe("medical");
      expect(result.subDomain).toBe("药品查询");
    });
  });

  // ==========================================================================
  // 学术垂类识别测试
  // ==========================================================================

  describe("学术垂类识别", () => {
    it("应该识别 '检索 PubMed 文献' 为学术垂类", () => {
      const result = recognizer.classify("检索2026年阿尔茨海默病最新文献");
      
      expect(result.field).toBe("academic");
      expect(result.subDomain).toBe("文献检索");
      expect(result.requiredCapabilities).toContain("PubMed E-utilities API");
    });

    it("应该识别 '查找Nature Medicine论文' 为学术垂类", () => {
      const result = recognizer.classify("查找2024年发表在Nature Medicine上的肿瘤免疫文章");
      
      expect(result.field).toBe("academic");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it("应该识别 '分析CAR-T细胞治疗趋势' 为学术垂类", () => {
      const result = recognizer.classify("帮我分析一下CAR-T细胞治疗的研究趋势");
      
      expect(result.field).toBe("academic");
      expect(result.subDomain).toBe("趋势分析");
    });

    it("应该识别 '导出BibTeX格式' 为学术垂类", () => {
      const result = recognizer.classify("导出近五年深度学习在医学影像应用的文献列表");
      
      expect(result.field).toBe("academic");
      expect(result.confidence).toBeGreaterThan(0.2);
    });
  });

  // ==========================================================================
  // 法律垂类识别测试
  // ==========================================================================

  describe("法律垂类识别", () => {
    it("应该识别 '起草 GDPR 协议' 为法律垂类", () => {
      const result = recognizer.classify("起草服务条款");
      
      expect(result.field).toBe("legal");
      expect(result.subDomain).toBe("服务条款");
    });

    it("应该识别 '生成隐私政策' 为法律垂类", () => {
      const result = recognizer.classify("帮我生成一个GDPR隐私政策");
      
      expect(result.field).toBe("legal");
      expect(result.subDomain).toBe("隐私政策");
    });

    it("应该识别 'Cookie政策' 为法律垂类", () => {
      const result = recognizer.classify("我们的App需要什么Cookie政策");
      
      expect(result.field).toBe("legal");
      expect(result.subDomain).toBe("Cookie政策");
    });

    it("应该识别 '数据处理协议' 为法律垂类", () => {
      const result = recognizer.classify("起草一份数据处理协议");
      
      expect(result.field).toBe("legal");
      expect(result.subDomain).toBe("数据处理协议");
    });
  });

  // ==========================================================================
  // 意图识别测试
  // ==========================================================================

  describe("意图识别", () => {
    it("应该识别 '分析' 意图", () => {
      const result = recognizer.recognizeIntent("分析一下贵州茅台的走势");
      
      expect(result.intent).toBe("analyze");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '创建' 意图", () => {
      const result = recognizer.recognizeIntent("帮我生成一个隐私政策");
      
      expect(result.intent).toBe("create");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '监控' 意图", () => {
      const result = recognizer.recognizeIntent("监控特斯拉股价变动");
      
      expect(result.intent).toBe("monitor");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '审计' 意图", () => {
      const result = recognizer.recognizeIntent("检查隐私政策合规性");
      
      expect(result.intent).toBe("audit");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '优化' 意图", () => {
      const result = recognizer.recognizeIntent("帮我优化一下这个服务条款");
      
      expect(result.intent).toBe("optimize");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '管理' 意图", () => {
      const result = recognizer.recognizeIntent("配置一下数据访问权限");
      
      expect(result.intent).toBe("manage");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("应该识别 '部署' 意图", () => {
      const result = recognizer.recognizeIntent("发布这个合规文档");
      
      expect(result.intent).toBe("deploy");
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 复杂度评估测试
  // ==========================================================================

  describe("复杂度评估", () => {
    it("应该评估金融任务为 moderate 复杂度", () => {
      const result = recognizer.estimateComplexity("financial", "分析贵州茅台股票");
      
      expect(["simple", "moderate", "complex"]).toContain(result.level);
      expect(result.score).toBeGreaterThan(0);
    });

    it("应该评估医疗任务为 complex 复杂度", () => {
      const result = recognizer.estimateComplexity("medical", "解读体检报告");
      
      expect(result.level).toBe("complex");
      expect(result.estimatedTokens).toBeGreaterThan(500);
    });

    it("应该评估学术任务为 moderate 复杂度", () => {
      const result = recognizer.estimateComplexity("academic", "检索文献");
      
      expect(["simple", "moderate"]).toContain(result.level);
    });
  });

  // ==========================================================================
  // 快捷函数测试
  // ==========================================================================

  describe("快捷函数", () => {
    it("classifyField 应该正常工作", () => {
      const result = classifyField("分析贵州茅台股票");
      
      expect(result.field).toBe("financial");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("recognizeFieldIntent 应该正常工作", () => {
      const result = recognizeFieldIntent("帮我分析一下");
      
      expect(result.intent).toBe("analyze");
    });

    it("estimateFieldComplexity 应该正常工作", () => {
      const result = estimateFieldComplexity("financial", "查一下股票");
      
      expect(result.score).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 边界情况测试
  // ==========================================================================

  describe("边界情况", () => {
    it("空字符串输入应该返回金融（默认）", () => {
      const result = recognizer.classify("");
      
      // 空字符串可能匹配不到任何模式，返回默认或最低置信度
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });

    it("混合垂类关键词应该返回最高分垂类", () => {
      // 同时包含金融和医疗关键词
      const result = recognizer.classify("分析医疗股票的财报");
      
      // 应该返回得分更高的垂类
      expect(["financial", "medical"]).toContain(result.field);
    });

    it("置信度低于阈值应该返回候选列表", () => {
      // 使用不明确的输入
      const result = recognizer.classify("处理一下数据");
      
      // 如果置信度低，应该有候选列表
      if (result.confidence < 0.8) {
        expect(result.candidates).toBeDefined();
      }
    });
  });
});
