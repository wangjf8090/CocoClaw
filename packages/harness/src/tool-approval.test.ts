/**
 * ToolApprovalManager Tests
 * 工具审批管理器测试
 *
 * 测试覆盖：
 *   - 工具风险分级
 *   - 预定义规则匹配
 *   - 审批会话生命周期
 *   - 批准/拒绝/超时
 *   - 白名单机制
 *   - 审批历史记录
 *   - 自定义规则
 *   - 配置管理
 *   - 统计信息
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ToolApprovalManager,
  createToolApprovalManager,
  PREDEFINED_RISK_RULES,
  DEFAULT_TOOL_APPROVAL_CONFIG,
  ToolRiskLevel,
  ToolApprovalConfig,
  ToolRiskRule,
  ApprovalCheckResult,
  ApprovalSession,
  ApprovalRecord,
} from './tool-approval.js';

// 辅助函数：创建快速超时的管理器（用于超时测试）
function createManagerWithTimeout(ms: number): ToolApprovalManager {
  return new ToolApprovalManager({ timeoutMs: ms });
}

describe('ToolApprovalManager — 工具审批管理器', () => {
  let manager: ToolApprovalManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ToolApprovalManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // 预定义规则
  // ===========================================================================

  describe('预定义风险规则', () => {
    it('should have predefined rules loaded', () => {
      const rules = manager.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.length).toBe(PREDEFINED_RISK_RULES.length);
    });

    it('should have rules for all four risk levels', () => {
      const rules = manager.getRules();
      const levels = new Set(rules.map((r) => r.riskLevel));
      expect(levels.has('low')).toBe(true);
      expect(levels.has('medium')).toBe(true);
      expect(levels.has('high')).toBe(true);
      expect(levels.has('critical')).toBe(true);
    });

    it('should have file deletion rule as critical', () => {
      const rules = manager.getRules();
      const deleteRule = rules.find((r) => r.id === 'critical-file-delete');
      expect(deleteRule).toBeDefined();
      expect(deleteRule!.riskLevel).toBe('critical');
    });

    it('should have network request rule as medium', () => {
      const rules = manager.getRules();
      const networkRule = rules.find((r) => r.id === 'medium-network');
      expect(networkRule).toBeDefined();
      expect(networkRule!.riskLevel).toBe('medium');
    });

    it('should have code execution rule as high', () => {
      const rules = manager.getRules();
      const execRule = rules.find((r) => r.id === 'high-code-exec');
      expect(execRule).toBeDefined();
      expect(execRule!.riskLevel).toBe('high');
    });

    it('should have file read rule as low', () => {
      const rules = manager.getRules();
      const readRule = rules.find((r) => r.id === 'low-file-read');
      expect(readRule).toBeDefined();
      expect(readRule!.riskLevel).toBe('low');
    });
  });

  // ===========================================================================
  // checkTool — 工具检查
  // ===========================================================================

  describe('checkTool() — 工具检查', () => {
    // === Critical 级别 ===
    describe('critical 风险工具', () => {
      it('should require approval for delete_file', () => {
        const result = manager.checkTool('delete_file', { path: '/tmp/test.txt' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('critical');
        expect(result.ruleId).toBe('critical-file-delete');
        expect(result.session).toBeDefined();
      });

      it('should require approval for rm command', () => {
        const result = manager.checkTool('rm', { path: '/tmp/test.txt' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('critical');
      });

      it('should require approval for rmdir', () => {
        const result = manager.checkTool('rmdir', { path: '/tmp/dir' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('critical');
      });

      it('should require approval for systemctl', () => {
        const result = manager.checkTool('systemctl', { action: 'stop', service: 'nginx' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('critical');
      });

      it('should require approval for drop_table', () => {
        const result = manager.checkTool('drop_table', { table: 'users' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('critical');
      });
    });

    // === High 级别 ===
    describe('high 风险工具', () => {
      it('should require approval for execute', () => {
        const result = manager.checkTool('execute', { command: 'rm -rf /' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('high');
        expect(result.ruleId).toBe('high-code-exec');
      });

      it('should require approval for bash', () => {
        const result = manager.checkTool('bash', { script: 'echo hello' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('high');
      });

      it('should require approval for eval', () => {
        const result = manager.checkTool('eval', { code: '1+1' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('high');
      });

      it('should require approval for write_file', () => {
        const result = manager.checkTool('write_file', { path: '/etc/config', content: '...' });
        expect(result.needsApproval).toBe(true);
        expect(result.riskLevel).toBe('high');
      });
    });

    // === Medium 级别 ===
    describe('medium 风险工具', () => {
      it('should NOT require approval for fetch (medium)', () => {
        const result = manager.checkTool('fetch', { url: 'https://example.com' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('medium');
      });

      it('should NOT require approval for http_request', () => {
        const result = manager.checkTool('http_request', { method: 'GET', url: 'https://api.example.com' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('medium');
      });

      it('should NOT require approval for send_email', () => {
        const result = manager.checkTool('send_email', { to: 'user@example.com' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('medium');
      });

      it('should NOT require approval for insert (DB)', () => {
        const result = manager.checkTool('insert', { table: 'logs', data: {} });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('medium');
      });
    });

    // === Low 级别 ===
    describe('low 风险工具', () => {
      it('should NOT require approval for read_file', () => {
        const result = manager.checkTool('read_file', { path: '/tmp/test.txt' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('low');
      });

      it('should NOT require approval for cat', () => {
        const result = manager.checkTool('cat', { path: '/tmp/test.txt' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('low');
      });

      it('should NOT require approval for list', () => {
        const result = manager.checkTool('list', { path: '/tmp' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('low');
      });

      it('should NOT require approval for select (DB)', () => {
        const result = manager.checkTool('select', { table: 'users' });
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('low');
      });

      it('should NOT require approval for help', () => {
        const result = manager.checkTool('help');
        expect(result.needsApproval).toBe(false);
        expect(result.riskLevel).toBe('low');
      });
    });

    // === 默认规则 ===
    describe('默认规则（未匹配）', () => {
      it('should use default risk level for unknown tools', () => {
        const result = manager.checkTool('unknown_tool_xyz');
        expect(result.riskLevel).toBe('medium');
        expect(result.ruleId).toBe('default');
        expect(result.needsApproval).toBe(false);
      });

      it('should use custom default risk level', () => {
        const customManager = new ToolApprovalManager({ defaultRiskLevel: 'high' });
        const result = customManager.checkTool('unknown_tool');
        expect(result.riskLevel).toBe('high');
        expect(result.needsApproval).toBe(true);
      });
    });
  });

  // ===========================================================================
  // 审批会话管理
  // ===========================================================================

  describe('审批会话管理', () => {
    it('should create session with unique ID', () => {
      const r1 = manager.checkTool('delete_file', { path: '/a' });
      const r2 = manager.checkTool('delete_file', { path: '/b' });

      expect(r1.session).toBeDefined();
      expect(r2.session).toBeDefined();
      expect(r1.session!.sessionId).not.toBe(r2.session!.sessionId);
    });

    it('should store tool name and input in session', () => {
      const toolInput = { path: '/important/file.txt', recursive: true };
      const result = manager.checkTool('delete_file', toolInput);

      expect(result.session!.toolName).toBe('delete_file');
      expect(result.session!.toolInput).toEqual(toolInput);
    });

    it('should store risk level and rule ID in session', () => {
      const result = manager.checkTool('execute', { command: 'test' });

      expect(result.session!.riskLevel).toBe('high');
      expect(result.session!.ruleId).toBe('high-code-exec');
    });

    it('should have initial pending status', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      expect(result.session!.status).toBe('pending');
    });

    it('should have createdAt timestamp', () => {
      const before = Date.now();
      const result = manager.checkTool('delete_file', { path: '/test' });
      const after = Date.now();

      expect(result.session!.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.session!.createdAt).toBeLessThanOrEqual(after);
    });
  });

  // ===========================================================================
  // 批准/拒绝
  // ===========================================================================

  describe('approve() — 批准会话', () => {
    it('should approve a pending session', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      const approved = manager.approve(sessionId, 'admin');
      expect(approved).toBe(true);

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined(); // 已从活跃会话中移除
    });

    it('should record approver name', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      manager.approve(sessionId, 'user-123');

      const history = manager.getHistory();
      expect(history[0].approver).toBe('user-123');
      expect(history[0].status).toBe('approved');
    });

    it('should reject approval for non-existent session', () => {
      const result = manager.approve('nonexistent', 'admin');
      expect(result).toBe(false);
    });

    it('should reject approval for already-approved session', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      manager.approve(sessionId, 'admin');
      const second = manager.approve(sessionId, 'admin2');
      expect(second).toBe(false);
    });
  });

  describe('reject() — 拒绝会话', () => {
    it('should reject a pending session', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      const rejected = manager.reject(sessionId, 'admin', 'Too dangerous');
      expect(rejected).toBe(true);
    });

    it('should record reject reason', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      manager.reject(sessionId, 'admin', 'This file is critical');

      const history = manager.getHistory();
      expect(history[0].status).toBe('rejected');
      expect(history[0].rejectReason).toBe('This file is critical');
    });

    it('should reject approval for non-existent session', () => {
      const result = manager.reject('nonexistent', 'admin');
      expect(result).toBe(false);
    });

    it('should reject approval for already-rejected session', () => {
      const result = manager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      manager.reject(sessionId, 'admin');
      const second = manager.reject(sessionId, 'admin');
      expect(second).toBe(false);
    });
  });

  // ===========================================================================
  // 超时机制
  // ===========================================================================

  describe('超时自动拒绝', () => {
    it('should auto-reject after timeout', () => {
      const fastManager = createManagerWithTimeout(1000);
      const result = fastManager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      // 会话仍在 pending
      const session = fastManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe('pending');

      // 快进时间
      vi.advanceTimersByTime(1001);

      // 会话已移除
      expect(fastManager.getSession(sessionId)).toBeUndefined();

      // 历史记录中有 timeout 记录
      const history = fastManager.getHistory();
      const timeoutRecord = history.find((r) => r.sessionId === sessionId);
      expect(timeoutRecord).toBeDefined();
      expect(timeoutRecord!.status).toBe('timeout');
      expect(timeoutRecord!.rejectReason).toContain('timeout');
    });

    it('should NOT auto-reject if already approved before timeout', () => {
      const fastManager = createManagerWithTimeout(1000);
      const result = fastManager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      // 批准
      fastManager.approve(sessionId, 'admin');

      // 快进时间
      vi.advanceTimersByTime(1001);

      // 历史记录应该是 approved，不是 timeout
      const history = fastManager.getHistory();
      const record = history.find((r) => r.sessionId === sessionId);
      expect(record!.status).toBe('approved');
    });

    it('should NOT auto-reject if already rejected before timeout', () => {
      const fastManager = createManagerWithTimeout(1000);
      const result = fastManager.checkTool('delete_file', { path: '/test' });
      const sessionId = result.session!.sessionId;

      // 拒绝
      fastManager.reject(sessionId, 'admin');

      // 快进时间
      vi.advanceTimersByTime(1001);

      // 历史记录应该是 rejected，不是 timeout
      const history = fastManager.getHistory();
      const record = history.find((r) => r.sessionId === sessionId);
      expect(record!.status).toBe('rejected');
    });

    it('should default to 30 second timeout', () => {
      const defaultManager = new ToolApprovalManager();
      const config = defaultManager.getConfig();
      expect(config.timeoutMs).toBe(30000);
    });
  });

  // ===========================================================================
  // 白名单机制
  // ===========================================================================

  describe('白名单机制', () => {
    it('should auto-approve whitelisted tools', () => {
      manager.addToWhitelist('delete_file');

      const result = manager.checkTool('delete_file', { path: '/test' });
      expect(result.needsApproval).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.ruleId).toBe('whitelist');
    });

    it('should be case-insensitive', () => {
      manager.addToWhitelist('Delete_File');

      const result = manager.checkTool('delete_file', { path: '/test' });
      expect(result.needsApproval).toBe(false);
      expect(result.ruleId).toBe('whitelist');
    });

    it('should support batch add', () => {
      manager.addToWhitelistBatch(['delete_file', 'rm', 'execute']);

      expect(manager.checkTool('delete_file').needsApproval).toBe(false);
      expect(manager.checkTool('rm').needsApproval).toBe(false);
      expect(manager.checkTool('execute').needsApproval).toBe(false);
    });

    it('should remove from whitelist', () => {
      manager.addToWhitelist('delete_file');
      expect(manager.isWhitelisted('delete_file')).toBe(true);

      const removed = manager.removeFromWhitelist('delete_file');
      expect(removed).toBe(true);
      expect(manager.isWhitelisted('delete_file')).toBe(false);

      // 移除后应恢复审批
      const result = manager.checkTool('delete_file');
      expect(result.needsApproval).toBe(true);
    });

    it('should return false for removing non-whitelisted tool', () => {
      expect(manager.removeFromWhitelist('nonexistent')).toBe(false);
    });

    it('should return whitelist array', () => {
      manager.addToWhitelistBatch(['tool_a', 'tool_b']);
      const list = manager.getWhitelist();
      expect(list).toContain('tool_a');
      expect(list).toContain('tool_b');
    });

    it('should initialize with whitelist from config', () => {
      const configManager = new ToolApprovalManager({
        whitelist: ['delete_file', 'rm'],
      });

      expect(configManager.checkTool('delete_file').needsApproval).toBe(false);
      expect(configManager.checkTool('rm').needsApproval).toBe(false);
      expect(configManager.checkTool('execute').needsApproval).toBe(true);
    });
  });

  // ===========================================================================
  // 审批历史
  // ===========================================================================

  describe('审批历史记录', () => {
    it('should record approved sessions', () => {
      const result = manager.checkTool('delete_file', { path: '/a' });
      manager.approve(result.session!.sessionId, 'admin');

      const history = manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('delete_file');
      expect(history[0].status).toBe('approved');
      expect(history[0].approver).toBe('admin');
    });

    it('should record rejected sessions', () => {
      const result = manager.checkTool('delete_file', { path: '/a' });
      manager.reject(result.session!.sessionId, 'admin', 'Not safe');

      const history = manager.getHistory();
      expect(history[0].status).toBe('rejected');
      expect(history[0].rejectReason).toBe('Not safe');
    });

    it('should have completedAt after session end', () => {
      const result = manager.checkTool('delete_file', { path: '/a' });
      manager.approve(result.session!.sessionId, 'admin');

      const history = manager.getHistory();
      expect(history[0].completedAt).toBeGreaterThan(0);
      expect(history[0].completedAt).toBeGreaterThanOrEqual(history[0].createdAt);
    });

    it('should support pagination', () => {
      // 创建多个审批记录
      for (let i = 0; i < 10; i++) {
        const result = manager.checkTool('execute', { command: `cmd-${i}` });
        manager.approve(result.session!.sessionId, 'admin');
      }

      const page1 = manager.getHistory(5, 0);
      const page2 = manager.getHistory(5, 5);

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
    });

    it('should filter history by approver', () => {
      const r1 = manager.checkTool('execute', { cmd: 'a' });
      const r2 = manager.checkTool('execute', { cmd: 'b' });
      manager.approve(r1.session!.sessionId, 'alice');
      manager.approve(r2.session!.sessionId, 'bob');

      const aliceHistory = manager.getHistoryByApprover('alice');
      expect(aliceHistory).toHaveLength(1);
      expect(aliceHistory[0].approver).toBe('alice');

      const bobHistory = manager.getHistoryByApprover('bob');
      expect(bobHistory).toHaveLength(1);
      expect(bobHistory[0].approver).toBe('bob');
    });

    it('should filter history by tool name', () => {
      const r1 = manager.checkTool('delete_file', { path: '/a' });
      const r2 = manager.checkTool('execute', { cmd: 'a' });
      manager.approve(r1.session!.sessionId, 'admin');
      manager.approve(r2.session!.sessionId, 'admin');

      const deleteHistory = manager.getHistoryByTool('delete_file');
      expect(deleteHistory).toHaveLength(1);
      expect(deleteHistory[0].toolName).toBe('delete_file');
    });

    it('should enforce max history size', () => {
      const smallManager = new ToolApprovalManager({ maxHistorySize: 5 });

      for (let i = 0; i < 10; i++) {
        const result = smallManager.checkTool('execute', { cmd: `cmd-${i}` });
        smallManager.approve(result.session!.sessionId, 'admin');
      }

      expect(smallManager.getHistoryCount()).toBe(5);
    });

    it('should clear history', () => {
      const result = manager.checkTool('execute', { cmd: 'a' });
      manager.approve(result.session!.sessionId, 'admin');
      expect(manager.getHistoryCount()).toBe(1);

      manager.clearHistory();
      expect(manager.getHistoryCount()).toBe(0);
    });
  });

  // ===========================================================================
  // 自定义规则
  // ===========================================================================

  describe('自定义规则', () => {
    it('should add custom rule', () => {
      const customRule: ToolRiskRule = {
        id: 'custom-special-tool',
        toolPattern: '^special_tool$',
        riskLevel: 'critical',
        description: 'Custom special tool rule',
        priority: 100,
      };

      manager.addCustomRule(customRule);

      const result = manager.checkTool('special_tool');
      expect(result.needsApproval).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.ruleId).toBe('custom-special-tool');
    });

    it('should override predefined rule with same ID', () => {
      const customRule: ToolRiskRule = {
        id: 'low-file-read',
        toolPattern: '^read_file$',
        riskLevel: 'high',
        description: 'Elevated: file read is now high risk',
        priority: 100,
      };

      manager.addCustomRule(customRule);

      const result = manager.checkTool('read_file');
      expect(result.riskLevel).toBe('high');
      expect(result.ruleId).toBe('low-file-read');
    });

    it('should batch add custom rules', () => {
      manager.addCustomRules([
        { id: 'r1', toolPattern: '^tool_a$', riskLevel: 'low', description: 'Rule 1' },
        { id: 'r2', toolPattern: '^tool_b$', riskLevel: 'high', description: 'Rule 2' },
      ]);

      expect(manager.checkTool('tool_a').riskLevel).toBe('low');
      expect(manager.checkTool('tool_b').riskLevel).toBe('high');
    });

    it('should remove custom rules', () => {
      manager.addCustomRule({
        id: 'my-custom-rule',
        toolPattern: '^my_tool$',
        riskLevel: 'critical',
        description: 'My rule',
      });

      const removed = manager.removeCustomRule('my-custom-rule');
      expect(removed).toBe(true);
    });

    it('should NOT allow removing predefined rules', () => {
      const removed = manager.removeCustomRule('low-file-read');
      expect(removed).toBe(false);
    });

    it('should reset rules to predefined defaults', () => {
      manager.addCustomRule({
        id: 'my-rule',
        toolPattern: '^my_tool$',
        riskLevel: 'critical',
        description: 'My rule',
      });

      manager.resetRules();

      const rules = manager.getRules();
      expect(rules.length).toBe(PREDEFINED_RISK_RULES.length);
      expect(rules.find((r) => r.id === 'my-rule')).toBeUndefined();
    });

    it('should honor priority ordering', () => {
      // 添加高优先级规则覆盖低优先级预定义规则
      manager.addCustomRule({
        id: 'critical-override',
        toolPattern: '^read_file$',
        riskLevel: 'critical',
        description: 'Override read to critical',
        priority: 200,
      });

      const result = manager.checkTool('read_file');
      expect(result.riskLevel).toBe('critical');
      expect(result.ruleId).toBe('critical-override');
    });
  });

  // ===========================================================================
  // 配置管理
  // ===========================================================================

  describe('配置管理', () => {
    it('should use default config', () => {
      const config = manager.getConfig();
      expect(config.timeoutMs).toBe(30000);
      expect(config.defaultRiskLevel).toBe('medium');
      expect(config.maxHistorySize).toBe(1000);
    });

    it('should accept partial config', () => {
      const customManager = new ToolApprovalManager({
        timeoutMs: 5000,
        defaultRiskLevel: 'high',
      });

      const config = customManager.getConfig();
      expect(config.timeoutMs).toBe(5000);
      expect(config.defaultRiskLevel).toBe('high');
      expect(config.maxHistorySize).toBe(1000); // 默认值
    });

    it('should update config dynamically', () => {
      manager.updateConfig({ timeoutMs: 10000, defaultRiskLevel: 'low' });

      const config = manager.getConfig();
      expect(config.timeoutMs).toBe(10000);
      expect(config.defaultRiskLevel).toBe('low');
    });

    it('should accept custom rules in initial config', () => {
      const customManager = new ToolApprovalManager({
        customRules: [
          { id: 'init-rule', toolPattern: '^init_tool$', riskLevel: 'critical', description: 'Init rule' },
        ],
      });

      const result = customManager.checkTool('init_tool');
      expect(result.riskLevel).toBe('critical');
      expect(result.ruleId).toBe('init-rule');
    });
  });

  // ===========================================================================
  // 批量检查
  // ===========================================================================

  describe('checkTools() — 批量检查', () => {
    it('should check multiple tools at once', () => {
      const results = manager.checkTools([
        { name: 'delete_file', input: { path: '/a' } },
        { name: 'read_file', input: { path: '/b' } },
        { name: 'fetch', input: { url: 'https://example.com' } },
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].needsApproval).toBe(true);  // critical
      expect(results[1].needsApproval).toBe(false);  // low
      expect(results[2].needsApproval).toBe(false);  // medium
    });
  });

  // ===========================================================================
  // 待审批会话
  // ===========================================================================

  describe('getPendingSessions() — 待审批会话', () => {
    it('should return all pending sessions', () => {
      manager.checkTool('delete_file', { path: '/a' });
      manager.checkTool('execute', { cmd: 'b' });
      manager.checkTool('read_file', { path: '/c' }); // low, 不创建会话

      const pending = manager.getPendingSessions();
      expect(pending).toHaveLength(2);
    });

    it('should return empty array when no pending sessions', () => {
      const pending = manager.getPendingSessions();
      expect(pending).toHaveLength(0);
    });

    it('should not include approved/rejected sessions', () => {
      const r1 = manager.checkTool('delete_file', { path: '/a' });
      const r2 = manager.checkTool('delete_file', { path: '/b' });

      manager.approve(r1.session!.sessionId, 'admin');
      manager.reject(r2.session!.sessionId, 'admin');

      expect(manager.getPendingSessions()).toHaveLength(0);
    });

    it('getPendingCount should return correct count', () => {
      expect(manager.getPendingCount()).toBe(0);

      manager.checkTool('delete_file', { path: '/a' });
      expect(manager.getPendingCount()).toBe(1);

      manager.checkTool('execute', { cmd: 'b' });
      expect(manager.getPendingCount()).toBe(2);
    });
  });

  // ===========================================================================
  // 统计信息
  // ===========================================================================

  describe('getStats() — 统计信息', () => {
    it('should return initial stats correctly', () => {
      const stats = manager.getStats();
      expect(stats.totalRules).toBe(PREDEFINED_RISK_RULES.length);
      expect(stats.customRules).toBe(0);
      expect(stats.whitelistSize).toBe(0);
      expect(stats.pendingSessions).toBe(0);
      expect(stats.totalHistory).toBe(0);
      expect(stats.approvedCount).toBe(0);
      expect(stats.rejectedCount).toBe(0);
      expect(stats.timeoutCount).toBe(0);
    });

    it('should track approved/rejected/timeout counts', () => {
      const r1 = manager.checkTool('delete_file', { path: '/a' });
      const r2 = manager.checkTool('delete_file', { path: '/b' });
      const r3 = manager.checkTool('delete_file', { path: '/c' });

      manager.approve(r1.session!.sessionId, 'admin');
      manager.reject(r2.session!.sessionId, 'admin', 'nope');

      // 超时 r3
      const fastManager = createManagerWithTimeout(100);
      const r4 = fastManager.checkTool('delete_file', { path: '/d' });
      vi.advanceTimersByTime(101);

      expect(manager.getStats().approvedCount).toBe(1);
      expect(manager.getStats().rejectedCount).toBe(1);
      expect(fastManager.getStats().timeoutCount).toBe(1);
    });

    it('should track whitelist and custom rules', () => {
      manager.addToWhitelist('tool_a');
      manager.addCustomRule({
        id: 'my-rule',
        toolPattern: '^tool_a$',
        riskLevel: 'low',
        description: 'My rule',
      });

      const stats = manager.getStats();
      expect(stats.whitelistSize).toBe(1);
      expect(stats.customRules).toBe(1);
    });
  });

  // ===========================================================================
  // 工厂函数
  // ===========================================================================

  describe('createToolApprovalManager() — 工厂函数', () => {
    it('should create manager with default config', () => {
      const m = createToolApprovalManager();
      expect(m).toBeInstanceOf(ToolApprovalManager);
      expect(m.getRules().length).toBe(PREDEFINED_RISK_RULES.length);
    });

    it('should create manager with custom config', () => {
      const m = createToolApprovalManager({ timeoutMs: 5000 });
      expect(m.getConfig().timeoutMs).toBe(5000);
    });
  });

  // ===========================================================================
  // DEFAULT_TOOL_APPROVAL_CONFIG
  // ===========================================================================

  describe('DEFAULT_TOOL_APPROVAL_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TOOL_APPROVAL_CONFIG.timeoutMs).toBe(30000);
      expect(DEFAULT_TOOL_APPROVAL_CONFIG.defaultRiskLevel).toBe('medium');
      expect(DEFAULT_TOOL_APPROVAL_CONFIG.maxHistorySize).toBe(1000);
      expect(DEFAULT_TOOL_APPROVAL_CONFIG.whitelist).toEqual([]);
      expect(DEFAULT_TOOL_APPROVAL_CONFIG.customRules).toEqual([]);
    });
  });

  // ===========================================================================
  // 边界条件
  // ===========================================================================

  describe('边界条件', () => {
    it('should handle empty tool name', () => {
      const result = manager.checkTool('');
      expect(result.riskLevel).toBe('medium');
      expect(result.needsApproval).toBe(false);
    });

    it('should handle very long tool name', () => {
      const longName = 'a'.repeat(1000);
      const result = manager.checkTool(longName);
      expect(result.riskLevel).toBe('medium');
    });

    it('should handle tool name with special regex characters', () => {
      // 使用不匹配任何预定义规则的名称，但仍含特殊字符
      const result = manager.checkTool('zm_no_match_tool.[special](test)');
      // 应该不匹配任何规则，使用默认
      expect(result.riskLevel).toBe('medium');
    });

    it('should handle null tool input', () => {
      const result = manager.checkTool('delete_file', null);
      expect(result.needsApproval).toBe(true);
      expect(result.session!.toolInput).toBeNull();
    });

    it('should handle undefined tool input', () => {
      const result = manager.checkTool('delete_file');
      expect(result.needsApproval).toBe(true);
      expect(result.session!.toolInput).toBeUndefined();
    });
  });
});