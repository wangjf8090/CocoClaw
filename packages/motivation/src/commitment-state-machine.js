"use strict";
/**
 * Commitment State Machine
 * 目标状态机 - 6状态/8事件
 *
 * States: Active | Paused | Blocked | BudgetLimited | UsageLimited | Complete
 * Events: START | PAUSE | RESUME | BLOCK | UNBLOCK | BUDGET_EXCEEDED | USAGE_LIMITED | COMPLETE
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitmentStateMachine = void 0;
exports.createMonitoredMachine = createMonitoredMachine;
// 状态转换表
const TRANSITIONS = [
    // Active -> 其他状态
    { from: 'active', event: 'PAUSE', to: 'paused' },
    { from: 'active', event: 'BLOCK', to: 'blocked' },
    { from: 'active', event: 'BUDGET_EXCEEDED', to: 'budget_limited' },
    { from: 'active', event: 'USAGE_LIMITED', to: 'usage_limited' },
    { from: 'active', event: 'COMPLETE', to: 'complete' },
    // Paused -> 其他状态
    { from: 'paused', event: 'RESUME', to: 'active' },
    { from: 'paused', event: 'START', to: 'active' },
    { from: 'paused', event: 'BLOCK', to: 'blocked' },
    { from: 'paused', event: 'COMPLETE', to: 'complete' },
    // Blocked -> 其他状态
    { from: 'blocked', event: 'UNBLOCK', to: 'active' },
    { from: 'blocked', event: 'START', to: 'active' },
    { from: 'blocked', event: 'BLOCK', to: 'blocked' },
    { from: 'blocked', event: 'PAUSE', to: 'paused' },
    // BudgetLimited -> 恢复
    { from: 'budget_limited', event: 'BUDGET_RESTORED', to: 'active' },
    { from: 'budget_limited', event: 'START', to: 'active' },
    { from: 'budget_limited', event: 'PAUSE', to: 'paused' },
    { from: 'budget_limited', event: 'COMPLETE', to: 'complete' },
    // UsageLimited -> 恢复
    { from: 'usage_limited', event: 'USAGE_RESTORED', to: 'active' },
    { from: 'usage_limited', event: 'START', to: 'active' },
    { from: 'usage_limited', event: 'PAUSE', to: 'paused' },
    { from: 'usage_limited', event: 'COMPLETE', to: 'complete' },
    // Complete 是终态，拒绝大多数事件
    { from: 'complete', event: 'START', to: 'active' },
];
class CommitmentStateMachine {
    constructor(goalId, config) {
        this.state = 'active';
        this.transitionsCount = 0;
        this.hooks = [];
        this.autoRestoreBudget = false;
        this.autoRestoreUsage = false;
        this.goalId = goalId;
        this.createdAt = Date.now();
        this.lastTransitionAt = this.createdAt;
        if (config?.hooks) {
            this.hooks = config.hooks;
        }
        if (config?.autoRestoreBudget !== undefined) {
            this.autoRestoreBudget = config.autoRestoreBudget;
        }
        if (config?.autoRestoreUsage !== undefined) {
            this.autoRestoreUsage = config.autoRestoreUsage;
        }
    }
    getState() {
        return this.state;
    }
    getSnapshot() {
        return {
            state: this.state,
            goalId: this.goalId,
            transitionsCount: this.transitionsCount,
            lastTransitionAt: this.lastTransitionAt,
            createdAt: this.createdAt,
        };
    }
    /**
     * 状态转换
     */
    transition(event) {
        const transition = this.findTransition(this.state, event);
        if (!transition) {
            return false;
        }
        const fromState = this.state;
        const toState = transition.to;
        this.state = toState;
        this.transitionsCount++;
        this.lastTransitionAt = Date.now();
        const context = {
            goalId: this.goalId,
            timestamp: this.lastTransitionAt,
        };
        // 触发钩子
        this.triggerHooks(fromState, toState, event, context);
        // 自动恢复逻辑
        this.handleAutoRestore(event, context);
        return true;
    }
    findTransition(from, event) {
        return TRANSITIONS.find(t => t.from === from && t.event === event);
    }
    triggerHooks(from, to, event, context) {
        // 通用状态变化钩子
        for (const hook of this.hooks) {
            hook.onStateChange?.(from, to, context);
        }
        // 特定状态钩子
        switch (to) {
            case 'budget_limited':
                for (const hook of this.hooks) {
                    hook.onBudgetExceeded?.(context);
                }
                break;
            case 'usage_limited':
                for (const hook of this.hooks) {
                    hook.onUsageLimited?.(context);
                }
                break;
            case 'complete':
                for (const hook of this.hooks) {
                    hook.onComplete?.(context);
                }
                break;
        }
    }
    handleAutoRestore(event, context) {
        if (event === 'BUDGET_EXCEEDED' && this.autoRestoreBudget) {
            this.startBudgetRestoreTimer(context);
        }
        if (event === 'USAGE_LIMITED' && this.autoRestoreUsage) {
            this.startUsageRestoreTimer(context);
        }
    }
    startBudgetRestoreTimer(context) {
        if (this.budgetRestoreTimer) {
            clearTimeout(this.budgetRestoreTimer);
        }
        this.budgetRestoreTimer = setTimeout(() => {
            this.transition('BUDGET_RESTORED');
        }, 60000); // 默认1分钟后恢复
    }
    startUsageRestoreTimer(context) {
        if (this.usageRestoreTimer) {
            clearTimeout(this.usageRestoreTimer);
        }
        this.usageRestoreTimer = setTimeout(() => {
            this.transition('USAGE_RESTORED');
        }, 120000); // 默认2分钟后恢复
    }
    destroy() {
        if (this.budgetRestoreTimer) {
            clearTimeout(this.budgetRestoreTimer);
        }
        if (this.usageRestoreTimer) {
            clearTimeout(this.usageRestoreTimer);
        }
    }
}
exports.CommitmentStateMachine = CommitmentStateMachine;
/**
 * 快速创建带钩子的状态机
 */
function createMonitoredMachine(goalId, callbacks) {
    return new CommitmentStateMachine(goalId, {
        hooks: [
            {
                name: 'monitor',
                onStateChange: callbacks.onStateChange,
                onBudgetExceeded: callbacks.onBudgetExceeded,
                onUsageLimited: callbacks.onUsageLimited,
            },
        ],
        autoRestoreBudget: callbacks.autoRestoreBudget ?? false,
        autoRestoreUsage: callbacks.autoRestoreUsage ?? false,
    });
}
