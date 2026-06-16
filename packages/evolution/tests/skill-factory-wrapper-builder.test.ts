/**
 * 封装构建器 - 单元测试
 * 
 * 测试场景：
 * - SKILL.md 生成
 * - SKILL Pattern 6 章节生成
 * - metadata 自动生成
 * - 目录结构生成
 * - 行业大模型封装
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WrapperBuilder,
  wrapSkill,
  generateSKILLPattern,
  createWrapperBuilder,
} from "../code/wrapper-builder.js";
import { createTemplateMatcher } from "../code/template-matcher.js";
import type { 
  SkillWrapperConfig, 
  FieldType, 
  DomainModelConfig,
  DataSource,
} from "../code/types.js";

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建模拟数据源
 */
function createMockDataSource(type: "required" | "optional"): DataSource {
  return {
    id: type === "required" ? "wind-mcp" : "news-api",
    name: type === "required" ? "Wind MCP Server" : "News API",
    type: "mcp",
    connector: "wind-mcp",
    endpoints: ["stock.quote"],
    authType: "api_key",
    authEnvVar: "WIND_API_KEY",
    required: type === "required",
  };
}

/**
 * 创建模拟领域模型配置
 */
function createMockDomainModel(): DomainModelConfig {
  return {
    provider: "openai",
    model: "gpt-4o",
    systemPrompt: "你是一位资深分析师。",
    maxTokens: 4096,
    temperature: 0.7,
  };
}

/**
 * 创建模拟 Skill 配置
 */
function createMockSkillConfig(field: FieldType): SkillWrapperConfig {
  const matcher = createTemplateMatcher();
  const templates = matcher.getTemplates(field);
  
  return {
    name: `test-${field}-skill`,
    description: `测试${field}技能`,
    template: templates[0],
    domainModel: createMockDomainModel(),
    dataSources: [createMockDataSource("required")],
    complianceRequirements: [],
    pricing: {
      type: "subscription",
      price: 9.99,
      currency: "USD",
      period: "monthly",
      callsPerDay: 100,
    },
    author: "Test Author",
    version: "1.0.0",
  };
}

// ============================================================================
// 模拟文件系统操作
// ============================================================================

// 在测试环境中模拟 fs 模块
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ""),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ""),
}));

vi.mock("node:path", () => ({
  default: {
    join: (...args: string[]) => args.join("/"),
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
  },
  join: (...args: string[]) => args.join("/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

// ============================================================================
// 封装构建器测试
// ============================================================================

describe("封装构建器 - 单元测试", () => {
  let builder: WrapperBuilder;

  beforeEach(() => {
    builder = createWrapperBuilder({ outputDir: "./test-skills" });
  });

  // ==========================================================================
  // SKILL.md 生成测试
  // ==========================================================================

  describe("SKILL.md 生成", () => {
    it("应该生成包含必需章节的 SKILL.md", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        subDomain: "股票分析",
      });
      
      // 验证基本结构
      expect(result.skillDir).toContain(config.name);
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      
      // 验证 SKILL.md 内容
      expect(result.skillMdContent).toContain("#");
      expect(result.skillMdContent).toContain("描述");
      expect(result.skillMdContent).toContain("核心能力");
      expect(result.skillMdContent).toContain("数据源");
    });

    it("应该包含垂类信息", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.skillMdContent).toContain("financial");
    });

    it("应该包含版本信息", async () => {
      const config = createMockSkillConfig("financial");
      config.version = "2.0.0";
      
      const result = await builder.build(config);
      
      expect(result.skillMdContent).toContain("2.0.0");
    });

    it("应该包含作者信息", async () => {
      const config = createMockSkillConfig("financial");
      config.author = "Test User";
      
      const result = await builder.build(config);
      
      expect(result.skillMdContent).toContain("Test User");
    });

    it("应该包含合规声明", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      // 金融垂类应该有投资风险提示
      expect(result.skillMdContent).toContain("⚠️");
      expect(result.skillMdContent).toContain("投资");
    });
  });

  // ==========================================================================
  // SKILL Pattern 6 章节测试
  // ==========================================================================

  describe("SKILL Pattern 6 章节生成", () => {
    it("应该生成 Scope 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toBeDefined();
      expect(result.skillPatternContent).toContain("## 1. Scope");
    });

    it("应该生成 Idioms 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toContain("## 2. Idioms");
    });

    it("应该生成 Patterns 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toContain("## 3. Patterns");
    });

    it("应该生成 Fixtures 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toContain("## 4. Fixtures");
    });

    it("应该生成 Anti-Patterns 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toContain("## 5. Anti-Patterns");
    });

    it("应该生成 Heuristics 章节", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config, {
        intent: "analyze",
        generatePattern: true,
      });
      
      expect(result.skillPatternContent).toContain("## 6. Heuristics");
    });
  });

  // ==========================================================================
  // Metadata 生成测试
  // ==========================================================================

  describe("Metadata 生成", () => {
    it("应该生成正确的元数据", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.metadata.name).toBe(config.name);
      expect(result.metadata.field).toBe("financial");
      expect(result.metadata.version).toBe(config.version);
      expect(result.metadata.riskLevel).toBeDefined();
    });

    it("应该包含必需的能力列表", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.metadata.capabilities.length).toBeGreaterThan(0);
      expect(result.metadata.capabilities).toContain("实时行情查询");
    });

    it("应该包含数据源列表", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.metadata.dataSources.length).toBeGreaterThan(0);
    });

    it("应该包含标签", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.metadata.tags.length).toBeGreaterThan(0);
      expect(result.metadata.tags).toContain("金融");
    });

    it("应该包含定价信息", async () => {
      const config = createMockSkillConfig("financial");
      config.pricing = {
        type: "subscription",
        price: 19.99,
        currency: "USD",
        period: "monthly",
      };
      
      const result = await builder.build(config);
      
      expect(result.metadata.pricing?.type).toBe("subscription");
      expect(result.metadata.pricing?.price).toBe(19.99);
    });

    it("金融垂类应该评估为 high 风险", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.metadata.riskLevel).toBe("high");
    });

    it("医疗垂类应该评估为 critical 风险", async () => {
      const config = createMockSkillConfig("medical");
      
      const result = await builder.build(config);
      
      expect(result.metadata.riskLevel).toBe("critical");
    });

    it("学术垂类应该评估为 low 风险", async () => {
      const config = createMockSkillConfig("academic");
      
      const result = await builder.build(config);
      
      expect(result.metadata.riskLevel).toBe("low");
    });
  });

  // ==========================================================================
  // 文件生成测试
  // ==========================================================================

  describe("文件生成", () => {
    it("应该生成 SKILL.md 文件", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      const skillMdFile = result.generatedFiles.find(f => f.type === "skill_md");
      expect(skillMdFile).toBeDefined();
      expect(skillMdFile?.name).toBe("SKILL.md");
    });

    it("应该生成 index.ts 文件", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      const indexFile = result.generatedFiles.find(f => f.type === "index_ts");
      expect(indexFile).toBeDefined();
      expect(indexFile?.name).toBe("index.ts");
    });

    it("应该计算文件大小", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      result.generatedFiles.forEach(file => {
        expect(file.size).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // 部署时间预估测试
  // ==========================================================================

  describe("部署时间预估", () => {
    it("应该返回部署时间范围", async () => {
      const config = createMockSkillConfig("financial");
      
      const result = await builder.build(config);
      
      expect(result.estimatedDeployTime).toMatch(/\d+-\d+秒/);
    });

    it("法律垂类应该有更长的部署时间", async () => {
      const financialConfig = createMockSkillConfig("financial");
      const legalConfig = createMockSkillConfig("legal");
      
      const financialResult = await builder.build(financialConfig);
      const legalResult = await builder.build(legalConfig);
      
      // 法律模板的 baseTime 是 30s，其他是 10s
      const financialMatch = financialResult.estimatedDeployTime.match(/(\d+)-/);
      const legalMatch = legalResult.estimatedDeployTime.match(/(\d+)-/);
      
      if (financialMatch && legalMatch) {
        const financialBase = parseInt(financialMatch[1]);
        const legalBase = parseInt(legalMatch[1]);
        expect(legalBase).toBeGreaterThan(financialBase);
      }
    });
  });

  // ==========================================================================
  // 快捷函数测试
  // ==========================================================================

  describe("快捷函数", () => {
    it("generateSKILLPattern 应该生成完整内容", () => {
      const matcher = createTemplateMatcher();
      const templates = matcher.getTemplates("financial");
      
      const content = generateSKILLPattern(
        "financial",
        templates[0],
        "analyze",
        "股票分析"
      );
      
      expect(content).toContain("#");
      expect(content).toContain("## 1. Scope");
      expect(content).toContain("## 6. Heuristics");
    });
  });

  // ==========================================================================
  // 不同垂类测试
  // ==========================================================================

  describe("不同垂类测试", () => {
    const fields: FieldType[] = ["financial", "medical", "academic", "legal"];
    
    fields.forEach(field => {
      it(`应该成功构建 ${field} 垂类 Skill`, async () => {
        const config = createMockSkillConfig(field);
        
        const result = await builder.build(config, {
          intent: "analyze",
          generatePattern: true,
        });
        
        expect(result.skillMdContent).toBeDefined();
        expect(result.metadata.field).toBe(field);
        expect(result.generatedFiles.length).toBeGreaterThan(0);
      });

      it(`应该为 ${field} 垂类生成合规声明`, async () => {
        const config = createMockSkillConfig(field);
        
        const result = await builder.build(config);
        
        expect(result.skillMdContent).toContain("⚠️");
      });
    });
  });

  // ==========================================================================
  // 边界情况测试
  // ==========================================================================

  describe("边界情况", () => {
    it("空配置应该抛出错误", async () => {
      const config = createMockSkillConfig("financial");
      config.template = null as any;
      
      // 期望抛出错误
      await expect(builder.build(config)).rejects.toThrow();
    });

    it("没有数据源应该使用模板默认数据源", async () => {
      const config = createMockSkillConfig("financial");
      config.dataSources = [];
      
      const result = await builder.build(config);
      
      // 应该回退到模板的必需数据源
      expect(result.metadata.dataSources.length).toBeGreaterThan(0);
    });

    it("没有版本应该使用默认版本", async () => {
      const config = createMockSkillConfig("financial");
      config.version = undefined;
      
      const result = await builder.build(config);
      
      expect(result.metadata.version).toBe("1.0.0");
    });

    it("没有作者应该使用默认作者", async () => {
      const config = createMockSkillConfig("financial");
      config.author = undefined;
      
      const result = await builder.build(config);
      
      expect(result.metadata.author).toBe("SelfClaw Skill Factory");
    });
  });
});

// ============================================================================
// 集成测试示例（标记为跳过）
// ==========================================================================

describe.skip("封装构建器 - 集成测试（需要真实文件系统）", () => {
  it("应该在真实文件系统中创建 Skill 目录", async () => {
    // 此测试需要真实的文件系统操作
    // 在 CI 环境中运行
    const builder = createWrapperBuilder({ outputDir: "/tmp/test-skills" });
    const config = createMockSkillConfig("financial");
    
    const result = await builder.build(config);
    
    expect(result.skillDir).toContain("/tmp/test-skills");
  });
});
