/**
 * 反合理化表 - 单元测试
 * 
 * 测试场景：
 * - 10 条借口的匹配检测
 * - 自证验证逻辑
 * - 审计日志记录
 * - 报告生成
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectRationalization,
  verifySelfJustification,
  logAntiRationalization,
  getAntiRationalizationReport,
  clearAntiRationalizationLogs,
  getAntiRationalizationTable,
} from "../src/skill-anti-rationalization.js";

describe("反合理化表 - 单元测试", () => {
  beforeEach(() => {
    // 每个测试前清空日志
    clearAntiRationalizationLogs();
  });

  // ==========================================================================
  // 借口检测测试（10 条借口）
  // ==========================================================================

  describe("借口检测 - 改动小类", () => {
    it("应该检测 '改动很小，不需要测试' 借口", () => {
      const text = "这个改动很小，不需要测试";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.excuseDescription).toBe("改动很小，不需要测试");
      expect(result.matchedEntry?.type).toBe("skip_test");
    });

    it("应该检测 '小改动' 借口", () => {
      const text = "只是小改动，先上线再说";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("skip_test");
    });

    it("应该检测 '轻微修改' 借口", () => {
      const text = "做了一个轻微修改，应该没问题";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("skip_test");
    });
  });

  describe("借口检测 - 跳过测试类", () => {
    it("应该检测 '跳过测试' 借口", () => {
      const text = "暂时跳过这个测试，后续再加";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("skip_test");
    });

    it("应该检测 '显而易见' 类借口", () => {
      const text = "这个逻辑非常显而易见，不需要写测试";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.excuseDescription).toContain("显而易见");
    });
  });

  describe("借口检测 - 省略步骤类", () => {
    it("应该检测 '省略步骤' 借口", () => {
      const text = "为了加快进度，省略一些验证步骤";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("omit_step");
    });

    it("应该检测 '简化流程' 借口", () => {
      const text = "简化一下流程，不用那么复杂";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("omit_step");
    });
  });

  describe("借口检测 - 忽略 lint 类", () => {
    it("应该检测 '忽略 lint' 借口", () => {
      const text = "忽略这些 lint 警告，以后再修";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("ignore_lint");
    });
  });

  describe("借口检测 - 假设安全类", () => {
    it("应该检测 '应该没问题' 类借口", () => {
      const text = "这样做应该没问题，相信我";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("assume_safe");
    });
  });

  describe("借口检测 - 复制粘贴类", () => {
    it("应该检测 '直接复制' 借口", () => {
      const text = "直接复制粘贴一下就行，不用重写";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("copy_paste");
    });
  });

  describe("借口检测 - 懒惰类", () => {
    it("应该检测 '懒得' 借口", () => {
      const text = "懒得写测试了，反正能跑通";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("lazy");
    });

    it("应该检测 '临时方案' 借口", () => {
      const text = "这只是临时方案，很快会改的";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("lazy");
    });
  });

  describe("借口检测 - 不影响类", () => {
    it("应该检测 '不影响' 类借口", () => {
      const text = "这个改动不影响核心功能，不用测试";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(true);
      expect(result.matchedEntry?.type).toBe("skip_test");
    });
  });

  // ==========================================================================
  // 无借口情况测试
  // ==========================================================================

  describe("无借口情况", () => {
    it("正常的技术描述不应该被检测为借口", () => {
      const text = "这个函数实现了用户认证逻辑，使用 JWT token 进行验证";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(false);
      expect(result.matchedEntry).toBeNull();
    });

    it("包含测试计划的描述不应该被检测为借口", () => {
      const text = "添加了单元测试覆盖登录功能，测试覆盖率提升到 90%";
      const result = detectRationalization(text, "test-skill");
      
      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // 自证验证测试
  // ==========================================================================

  describe("自证验证", () => {
    it("应该拒绝未引用反证话术的 Agent 响应", () => {
      const detection = detectRationalization("改动很小，不需要测试", "test-skill");
      const agentResponse = "我觉得这个小改动没问题，直接提交就行";
      
      const result = verifySelfJustification(detection, agentResponse);
      
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("未充分引用反证话术");
    });

    it("应该接受引用了反证话术关键部分的 Agent 响应", () => {
      const detection = detectRationalization("改动很小，不需要测试", "test-skill");
      const agentResponse = "任何改动都可能引入 bug，无论改动大小，TDD 要求每次改动都必须有测试覆盖";
      
      const result = verifySelfJustification(detection, agentResponse);
      
      expect(result.approved).toBe(true);
    });

    it("跳过测试的借口必须提及测试", () => {
      const detection = detectRationalization("改动很小，不需要测试", "test-skill");
      const agentResponse = "虽然改动小，但我会添加测试覆盖来验证正确性";
      
      const result = verifySelfJustification(detection, agentResponse);
      
      expect(result.approved).toBe(true);
      expect(result.reason).toContain("自证充分");
    });

    it("忽略 lint 的借口必须包含修复计划", () => {
      const detection = detectRationalization("忽略这些 lint 警告，以后再修", "test-skill");
      const agentResponse = "暂时忽略这些 lint 警告，但会在下个版本中重构并修复这些问题";
      
      const result = verifySelfJustification(detection, agentResponse);
      
      expect(result.approved).toBe(true);
    });

    it("对于未检测到借口的情况应该直接通过", () => {
      const detection = detectRationalization("这是一个正常的函数实现", "test-skill");
      const agentResponse = "我正常实现了功能";
      
      const result = verifySelfJustification(detection, agentResponse);
      
      expect(result.approved).toBe(true);
      expect(result.reason).toContain("未检测到合理化行为");
    });
  });

  // ==========================================================================
  // 审计日志测试
  // ==========================================================================

  describe("审计日志", () => {
    it("应该正确记录反合理化检测", () => {
      const detection = detectRationalization("改动很小，不需要测试", "test-skill");
      
      logAntiRationalization(
        "test-skill",
        detection,
        "我同意这个观点，会写测试",
        "approved",
        "自证充分"
      );
      
      const report = getAntiRationalizationReport();
      
      expect(report.totalDetections).toBe(1);
      expect(report.logs[0].skillName).toBe("test-skill");
      expect(report.logs[0].excuse).toBe("改动很小，不需要测试");
      expect(report.logs[0].decision).toBe("approved");
    });

    it("应该正确统计拒绝数量", () => {
      const detection = detectRationalization("懒得写测试了", "test-skill");
      
      logAntiRationalization(
        "test-skill",
        detection,
        "反正能跑",
        "rejected",
        "未提供充分自证"
      );
      
      const report = getAntiRationalizationReport();
      
      expect(report.totalDetections).toBe(1);
      expect(report.rejectedCount).toBe(1);
    });

    it("应该按类型统计", () => {
      const detection1 = detectRationalization("改动很小，不需要测试", "skill1");
      const detection2 = detectRationalization("忽略 lint 警告", "skill2");
      
      logAntiRationalization("skill1", detection1, "ok", "approved", "通过");
      logAntiRationalization("skill2", detection2, "ok", "approved", "通过");
      
      const report = getAntiRationalizationReport();
      
      expect(report.statistics['skip_test']).toBe(1);
      expect(report.statistics['ignore_lint']).toBe(1);
    });

    it("应该清空日志", () => {
      const detection = detectRationalization("改动很小", "skill");
      logAntiRationalization("skill", detection, "ok", "approved", "通过");
      
      clearAntiRationalizationLogs();
      
      const report = getAntiRationalizationReport();
      expect(report.totalDetections).toBe(0);
      expect(report.logs.length).toBe(0);
    });
  });

  // ==========================================================================
  // 反合理化表内容测试
  // ==========================================================================

  describe("反合理化表内容", () => {
    it("应该有至少 10 条借口", () => {
      const table = getAntiRationalizationTable();
      expect(table.length).toBeGreaterThanOrEqual(10);
    });

    it("每条借口应该有完整的反证话术", () => {
      const table = getAntiRationalizationTable();
      
      for (const entry of table) {
        expect(entry.excusePattern).toBeDefined();
        expect(entry.excuseDescription).toBeTruthy();
        expect(entry.counterArgument).toBeTruthy();
        expect(entry.counterArgument.length).toBeGreaterThan(10);
      }
    });

    it("借口类型应该覆盖所有预期类型", () => {
      const table = getAntiRationalizationTable();
      const types = new Set(table.map(e => e.type));
      
      expect(types.has('skip_test')).toBe(true);
      expect(types.has('omit_step')).toBe(true);
      expect(types.has('ignore_lint')).toBe(true);
      expect(types.has('assume_safe')).toBe(true);
      expect(types.has('copy_paste')).toBe(true);
      expect(types.has('lazy')).toBe(true);
    });
  });

  // ==========================================================================
  // 边界情况测试
  // ==========================================================================

  describe("边界情况", () => {
    it("空字符串不应该报错", () => {
      const result = detectRationalization("", "test-skill");
      expect(result.detected).toBe(false);
    });

    it("undefined skillName 应该有默认值", () => {
      const result = detectRationalization("改动很小，不需要测试");
      expect(result.detected).toBe(true);
      expect(result.context).toContain("改动很小");
    });
  });
});
