/**
 * Commitment State Machine Tests
 */

import {
  CommitmentStateMachine,
  createMonitoredMachine,
} from './commitment-state-machine.js';
import {
  CommitmentState,
  CommitmentEvent,
  StateChangeContext,
} from './types.js';

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e: any) {
    console.error(`❌ ${name}: ${e.message}`);
    throw e;
  }
}

// ========== 核心状态转换测试 ==========

test('Active -> Paused', () => {
  const sm = new CommitmentStateMachine('goal-1');
  assertEqual(sm.getState(), 'active', 'initial state');
  const result = sm.transition('PAUSE');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'paused', 'after PAUSE');
});

test('Active -> Blocked', () => {
  const sm = new CommitmentStateMachine('goal-2');
  const result = sm.transition('BLOCK');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'blocked', 'after BLOCK');
});

test('Active -> BudgetLimited', () => {
  const sm = new CommitmentStateMachine('goal-3');
  const result = sm.transition('BUDGET_EXCEEDED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'budget_limited', 'after BUDGET_EXCEEDED');
});

test('Active -> UsageLimited', () => {
  const sm = new CommitmentStateMachine('goal-4');
  const result = sm.transition('USAGE_LIMITED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'usage_limited', 'after USAGE_LIMITED');
});

test('Active -> Complete', () => {
  const sm = new CommitmentStateMachine('goal-5');
  const result = sm.transition('COMPLETE');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'complete', 'after COMPLETE');
});

test('BudgetLimited -> Active (BUDGET_RESTORED)', () => {
  const sm = new CommitmentStateMachine('goal-6');
  sm.transition('BUDGET_EXCEEDED');
  const result = sm.transition('BUDGET_RESTORED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after BUDGET_RESTORED');
});

test('UsageLimited -> Active (USAGE_RESTORED)', () => {
  const sm = new CommitmentStateMachine('goal-7');
  sm.transition('USAGE_LIMITED');
  const result = sm.transition('USAGE_RESTORED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after USAGE_RESTORED');
});

test('Blocked -> Active (UNBLOCK)', () => {
  const sm = new CommitmentStateMachine('goal-8');
  sm.transition('BLOCK');
  const result = sm.transition('UNBLOCK');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after UNBLOCK');
});

test('Paused -> Active (RESUME)', () => {
  const sm = new CommitmentStateMachine('goal-9');
  sm.transition('PAUSE');
  const result = sm.transition('RESUME');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after RESUME');
});

// ========== 边界用例测试 ==========

test('Complete 是终态，拒绝 PAUSE', () => {
  const sm = new CommitmentStateMachine('goal-10');
  sm.transition('COMPLETE');
  const result = sm.transition('PAUSE');
  assertEqual(result, false, 'transition should fail');
  assertEqual(sm.getState(), 'complete', 'state unchanged');
});

test('Complete 可以通过 START 恢复', () => {
  const sm = new CommitmentStateMachine('goal-11');
  sm.transition('COMPLETE');
  const result = sm.transition('START');
  assertEqual(result, true, 'transition should succeed');
  assertEqual(sm.getState(), 'active', 'state reset to active');
});

test('无效转换返回 false', () => {
  const sm = new CommitmentStateMachine('goal-12');
  const result = sm.transition('RESUME'); // Active 不接受 RESUME
  assertEqual(result, false, 'invalid transition');
  assertEqual(sm.getState(), 'active', 'state unchanged');
});

test('Blocked 再次 BLOCK 仍是 blocked', () => {
  const sm = new CommitmentStateMachine('goal-13');
  sm.transition('BLOCK');
  sm.transition('BLOCK');
  assertEqual(sm.getState(), 'blocked', 'remains blocked');
});

test('BudgetLimited 可以 COMPLETE', () => {
  const sm = new CommitmentStateMachine('goal-14');
  sm.transition('BUDGET_EXCEEDED');
  const result = sm.transition('COMPLETE');
  assertEqual(result, true, 'transition should succeed');
  assertEqual(sm.getState(), 'complete', 'complete from budget_limited');
});

// ========== 钩子测试 ==========

test('onStateChange 钩子触发', () => {
  const contexts: StateChangeContext[] = [];
  const sm = createMonitoredMachine('goal-15', {
    onStateChange: (from, to, ctx) => {
      contexts.push(ctx);
    },
  });

  sm.transition('PAUSE');
  assertEqual(contexts.length, 1, 'hook triggered once');
  assertEqual(contexts[0].goalId, 'goal-15', 'goalId correct');
});

test('onBudgetExceeded 钩子触发', () => {
  let triggered = false;
  const sm = createMonitoredMachine('goal-16', {
    onBudgetExceeded: () => {
      triggered = true;
    },
  });

  sm.transition('BUDGET_EXCEEDED');
  assertEqual(triggered, true, 'budget exceeded hook triggered');
  assertEqual(sm.getState(), 'budget_limited', 'state correct');
});

test('onUsageLimited 钩子触发', () => {
  let triggered = false;
  const sm = createMonitoredMachine('goal-17', {
    onUsageLimited: () => {
      triggered = true;
    },
  });

  sm.transition('USAGE_LIMITED');
  assertEqual(triggered, true, 'usage limited hook triggered');
  assertEqual(sm.getState(), 'usage_limited', 'state correct');
});

// ========== Snapshot 测试 ==========

test('getSnapshot 返回正确结构', () => {
  const sm = new CommitmentStateMachine('goal-18');
  sm.transition('PAUSE');
  sm.transition('RESUME');

  const snapshot = sm.getSnapshot();
  assertEqual(snapshot.goalId, 'goal-18', 'goalId');
  assertEqual(snapshot.state, 'active', 'state');
  assertEqual(snapshot.transitionsCount, 2, 'transitionsCount');
  assertEqual(snapshot.createdAt > 0, true, 'createdAt');
  assertEqual(snapshot.lastTransitionAt > 0, true, 'lastTransitionAt');
});

// ========== 自动恢复测试 ==========

test('autoRestoreBudget 触发自动恢复', (done) => {
  const sm = new CommitmentStateMachine('goal-19', {
    autoRestoreBudget: true,
    budgetRestoreIntervalMs: 100,
  });

  sm.transition('BUDGET_EXCEEDED');
  assertEqual(sm.getState(), 'budget_limited', 'state is budget_limited');

  setTimeout(() => {
    try {
      assertEqual(sm.getState(), 'active', 'auto restored to active');
      sm.destroy();
      done();
    } catch (e) {
      sm.destroy();
      done(e);
    }
  }, 150);
}, { timeout: 500 });

test('autoRestoreUsage 触发自动恢复', (done) => {
  const sm = new CommitmentStateMachine('goal-20', {
    autoRestoreUsage: true,
    usageRestoreIntervalMs: 100,
  });

  sm.transition('USAGE_LIMITED');
  assertEqual(sm.getState(), 'usage_limited', 'state is usage_limited');

  setTimeout(() => {
    try {
      assertEqual(sm.getState(), 'active', 'auto restored to active');
      sm.destroy();
      done();
    } catch (e) {
      sm.destroy();
      done(e);
    }
  }, 150);
}, { timeout: 500 });

console.log('\n✅ All commitment state machine tests passed!');
