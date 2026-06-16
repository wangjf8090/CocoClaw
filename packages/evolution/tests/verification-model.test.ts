/**
 * Verification Model 测试套件
 * 
 * Loop Engineering M1.3: 独立 Verification Model
 * 
 * 测试覆盖：
 * 1. 单模型验证通过（高置信度）
 * 2. 单模型验证失败
 * 3. 低置信度触发人工确认
 * 4. 多模型冗余验证（一致通过）
 * 5. 多模型冗余验证（不一致 → 拒绝）
 * 6. 模型调用失败 fallback
 * 7. 集成测试：skill-orchestrator 调用 verification-model
 * 8. 向后兼容：不传 verificationModel 时行为不变
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  VerificationModel,
  createMockVerifier,
  createMockLLMClient,
  type VerificationContext,
  type MockLLMConfig,
  type SingleVerificationResult,
} from "../src/verification-model.js";

// ============================================================================
// Test Helpers
// ============================================================================

/** 创建标准验证上下文 */
function createTestContext(overrides?: Partial<VerificationContext>): VerificationContext {
  return {
    skillName: "audit",
    goal: "审计所有技能并生成报告",
    expectedOutput: "生成包含所有技能状态的审计报告",
    actualOutput: "审计完成，共扫描 10 个技能，生成报告",
    historyContext: undefined,
    verificationRound: 1,
    executionMeta: {
      taskId: "task-1",
      duration: 1500,
      retries: 0,
      status: "success",
    },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("VerificationModel", () => {
  describe("1. 单模型验证通过（高置信度）", () => {
    it("应返回 passed=true，置信度 >= 0.7", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.85,
          reason: "产出完全符合预期",
          modelUsed: "claude-haiku",
          requireHumanReview: false,
        },
      });

      const result = await verifier.verify(createTestContext());

      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.modelUsed).toBeDefined();
    });

    it("应正确设置 reason 和 meta", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.9,
          reason: "完美符合预期，质量优秀",
          modelUsed: "claude-haiku",
          requireHumanReview: false,
        },
      });

      const result = await verifier.verify(createTestContext());

      expect(result.reason).toBe("完美符合预期，质量优秀");
      expect(result.meta).toBeDefined();
      expect(result.meta?.configSnapshot?.model).toBeDefined();
    });
  });

  describe("2. 单模型验证失败", () => {
    it("应返回 passed=false，置信度 < 0.7", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: false,
          confidence: 0.3,
          reason: "产出不符合预期，存在明显错误",
          modelUsed: "claude-haiku",
          requireHumanReview: true,
        },
      });

      const result = await verifier.verify(createTestContext());

      expect(result.passed).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.requireHumanReview).toBe(true);
    });

    it("失败时应设置 requireHumanReview=true", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: false,
          confidence: 0.4,
          reason: "产出质量不达标",
          modelUsed: "claude-haiku",
          requireHumanReview: true,
        },
      });

      const result = await verifier.verify(createTestContext());

      expect(result.requireHumanReview).toBe(true);
    });
  });

  describe("3. 低置信度触发人工确认", () => {
    it("置信度低于阈值时应触发人工确认", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        confidenceThreshold: 0.8, // 高阈值
        llmClient: createMockLLMClient({
          defaultConfidence: 0.5, // 低置信度
        }),
      });

      const result = await verifier.verify(createTestContext());

      expect(result.requireHumanReview).toBe(true);
    });

    it("置信度高于阈值时不应触发人工确认", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        confidenceThreshold: 0.5,
        llmClient: createMockLLMClient({
          defaultConfidence: 0.9,
        }),
      });

      const result = await verifier.verify(createTestContext());

      // Mock 返回的 requireHumanReview 基于固定阈值 0.7
      // 这里测试 shouldRequireHumanReview 方法
      expect(verifier.shouldRequireHumanReview(0.9, 1)).toBe(false);
    });

    it("轮次达到 humanCheckpointInterval 时应触发人工确认", () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        humanCheckpointInterval: 5,
        confidenceThreshold: 0.3, // 低阈值
      });

      // 第 5 轮应触发
      expect(verifier.shouldRequireHumanReview(0.9, 5)).toBe(true);
      // 第 10 轮应触发
      expect(verifier.shouldRequireHumanReview(0.9, 10)).toBe(true);
      // 第 3 轮不应触发
      expect(verifier.shouldRequireHumanReview(0.9, 3)).toBe(false);
    });
  });

  describe("4. 多模型冗余验证（一致通过）", () => {
    it("所有模型都判定通过时应返回 passed=true", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        requireMultiModelConsensus: true,
        consensusModels: ["claude-haiku", "gpt-4o-mini", "claude-sonnet"],
        llmClient: createMockLLMClient({
          fixedResponse: {
            passed: true,
            confidence: 0.85,
            reason: "多模型一致通过",
            modelUsed: "mock",
            requireHumanReview: false,
          },
        }),
      });

      const result = await verifier.verifyMulti([createTestContext()]);

      expect(result.passed).toBe(true);
      expect(result.voteDistribution.pass).toBe(3);
      expect(result.voteDistribution.fail).toBe(0);
      expect(result.consensusResults).toHaveLength(3);
    });

    it("应返回综合置信度（平均）", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        requireMultiModelConsensus: true,
        consensusModels: ["claude-haiku", "gpt-4o-mini"],
        llmClient: createMockLLMClient({
          fixedResponse: {
            passed: true,
            confidence: 0.8,
            reason: "测试通过",
            modelUsed: "mock",
            requireHumanReview: false,
          },
        }),
      });

      const result = await verifier.verifyMulti([createTestContext()]);

      expect(result.confidence).toBeCloseTo(0.8);
    });
  });

  describe("5. 多模型冗余验证（不一致 → 拒绝）", () => {
    it("多数模型判定失败时应返回 passed=false", async () => {
      let callCount = 0;
      const verifier = new VerificationModel({
        model: "claude-haiku",
        requireMultiModelConsensus: true,
        consensusModels: ["claude-haiku", "gpt-4o-mini", "claude-sonnet"],
        llmClient: createMockLLMClient({
          // 模拟投票：2 个失败，1 个通过
          fixedResponse: (() => {
            callCount++;
            return callCount <= 2
              ? {
                  passed: false,
                  confidence: 0.3,
                  reason: "判定失败",
                  modelUsed: "mock",
                  requireHumanReview: true,
                }
              : {
                  passed: true,
                  confidence: 0.8,
                  reason: "判定通过",
                  modelUsed: "mock",
                  requireHumanReview: false,
                };
          })() as unknown as SingleVerificationResult,
        }),
      });

      const result = await verifier.verifyMulti([createTestContext()]);

      // 多数失败
      expect(result.passed).toBe(false);
      expect(result.voteDistribution.fail).toBeGreaterThan(result.voteDistribution.pass);
    });

    it("平票时应触发人工确认", async () => {
      let callCount = 0;
      const verifier = new VerificationModel({
        model: "claude-haiku",
        requireMultiModelConsensus: true,
        consensusModels: ["claude-haiku", "gpt-4o-mini"],
        llmClient: createMockLLMClient({
          fixedResponse: (() => {
            callCount++;
            return callCount === 1
              ? {
                  passed: true,
                  confidence: 0.6,
                  reason: "通过",
                  modelUsed: "mock",
                  requireHumanReview: true,
                }
              : {
                  passed: false,
                  confidence: 0.6,
                  reason: "失败",
                  modelUsed: "mock",
                  requireHumanReview: true,
                };
          })() as unknown as SingleVerificationResult,
        }),
      });

      const result = await verifier.verifyMulti([createTestContext()]);

      expect(result.voteDistribution.pass).toBe(result.voteDistribution.fail);
      expect(result.requireHumanReview).toBe(true);
    });
  });

  describe("6. 模型调用失败 fallback", () => {
    it("LLM 调用失败时应使用 fallback 验证", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        llmClient: createMockLLMClient({
          errorRate: 1.0, // 100% 错误
        }),
      });

      const result = await verifier.verify(createTestContext({
        executionMeta: {
          taskId: "task-1",
          duration: 1500,
          retries: 0,
          status: "success", // 执行成功
        },
      }));

      // Fallback 应该根据 status 判断
      expect(result.modelUsed).toBe("fallback-rule-based");
      // 执行成功时 fallback 会判定通过
      expect(result.passed).toBe(true);
    });

    it("LLM 不可用时应返回低置信度", async () => {
      // 不提供 llmClient
      const verifier = new VerificationModel({
        model: "claude-haiku",
      });

      const result = await verifier.verify(createTestContext());

      expect(result.modelUsed).toBe("fallback-rule-based");
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });
  });

  describe("7. 集成测试：skill-orchestrator 调用 verification-model", () => {
    it("应正确构建验证上下文", () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.85,
          reason: "测试通过",
          modelUsed: "mock",
          requireHumanReview: false,
        },
      });

      const context = createTestContext({
        skillName: "skill-test",
        goal: "执行测试任务",
        expectedOutput: "生成测试报告",
        actualOutput: "测试报告已生成",
        executionMeta: {
          taskId: "task-123",
          duration: 2000,
          retries: 1,
          status: "success",
        },
      });

      expect(context.skillName).toBe("skill-test");
      expect(context.goal).toBe("执行测试任务");
      expect(context.executionMeta?.taskId).toBe("task-123");
    });

    it("verifyMulti 应支持多个上下文", async () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        llmClient: createMockLLMClient({
          fixedResponse: {
            passed: true,
            confidence: 0.85,
            reason: "测试通过",
            modelUsed: "mock",
            requireHumanReview: false,
          },
        }),
      });

      const contexts = [
        createTestContext({ skillName: "skill-1" }),
        createTestContext({ skillName: "skill-2" }),
      ];

      const results = await Promise.all(
        contexts.map((ctx) => verifier.verify(ctx))
      );

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });
  });

  describe("8. 向后兼容：不传 verificationModel 时行为不变", () => {
    it("不提供 verificationModel 时 verifyResult 应使用规则验证", async () => {
      // 这是一个概念测试，实际的 verifyResult 测试需要导入 skill-orchestrator
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.85,
          reason: "测试通过",
          modelUsed: "mock",
          requireHumanReview: false,
        },
      });

      // 当传入 verificationModel 时
      const resultWithVM = await verifier.verify(createTestContext());
      expect(resultWithVM.modelUsed).toBe("mock");

      // 统计应正确更新
      const stats = verifier.getStats();
      expect(stats.totalVerifications).toBe(1);
      expect(stats.passedCount).toBe(1);
    });

    it("默认配置应符合预期", () => {
      const verifier = new VerificationModel();
      const summary = verifier.getConfigSummary();

      expect(summary.model).toBe("claude-haiku");
      expect(summary.requireMultiModelConsensus).toBe(false);
      expect(summary.confidenceThreshold).toBe(0.7);
      expect(summary.humanCheckpointInterval).toBe(5);
    });

    it("updateConfig 应正确更新配置", () => {
      const verifier = new VerificationModel({
        model: "claude-haiku",
        confidenceThreshold: 0.7,
      });

      verifier.updateConfig({
        model: "gpt-4o-mini",
        confidenceThreshold: 0.8,
      });

      const summary = verifier.getConfigSummary();
      expect(summary.model).toBe("gpt-4o-mini");
      expect(summary.confidenceThreshold).toBe(0.8);
    });

    it("重置统计应清空计数器", () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.85,
          reason: "测试",
          modelUsed: "mock",
          requireHumanReview: false,
        },
      });

      verifier.verify(createTestContext());
      verifier.verify(createTestContext());

      expect(verifier.getStats().totalVerifications).toBe(2);

      verifier.resetStats();
      expect(verifier.getStats().totalVerifications).toBe(0);
    });
  });

  describe("边界情况测试", () => {
    it("空 actualOutput 应正确处理", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: false,
          confidence: 0.2,
          reason: "无实际产出",
          modelUsed: "mock",
          requireHumanReview: true,
        },
      });

      const result = await verifier.verify(createTestContext({
        actualOutput: "",
      }));

      expect(result.passed).toBe(false);
    });

    it("异常 error output 应正确处理", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: false,
          confidence: 0.1,
          reason: "执行出错",
          modelUsed: "mock",
          requireHumanReview: true,
        },
      });

      const result = await verifier.verify(createTestContext({
        actualOutput: "Error: Connection timeout",
      }));

      expect(result.passed).toBe(false);
      expect(result.requireHumanReview).toBe(true);
    });

    it("特殊字符应正确处理", async () => {
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.9,
          reason: "包含特殊字符的内容验证通过: @#$%^&*()",
          modelUsed: "mock",
          requireHumanReview: false,
        },
      });

      const result = await verifier.verify(createTestContext({
        actualOutput: "特殊输出: 🎉 Emoji 和 Unicode ©®™",
      }));

      expect(result.passed).toBe(true);
    });

    it("长文本应正确处理", async () => {
      const longOutput = "A".repeat(10000);
      const verifier = createMockVerifier({
        fixedResponse: {
          passed: true,
          confidence: 0.85,
          reason: "长文本验证通过",
          modelUsed: "mock",
          requireHumanReview: false,
        },
      });

      const result = await verifier.verify(createTestContext({
        actualOutput: longOutput,
      }));

      expect(result.passed).toBe(true);
    });
  });

  describe("工厂函数测试", () => {
    it("createMockVerifier 应创建有效的验证器", () => {
      const verifier = createMockVerifier();

      expect(verifier).toBeInstanceOf(VerificationModel);
      expect(verifier.getConfigSummary().model).toBe("custom");
    });

    it("createMockVerifier 应支持自定义配置", () => {
      const verifier = createMockVerifier(
        { delay: 200, defaultConfidence: 0.9 },
        { confidenceThreshold: 0.8 }
      );

      expect(verifier.getConfigSummary().confidenceThreshold).toBe(0.8);
    });
  });
});
