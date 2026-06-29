/**
 * Commitment State Machine Tests (JS version)
 */

const {
  CommitmentStateMachine,
  createMonitoredMachine,
} = require('../src/commitment-state-machine.js');

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); throw e; }
}

// Core transition tests
test('Active -> Paused', () => {
  const sm = new CommitmentStateMachine('goal-1');
  assertEqual(sm.getState(), 'active', 'initial state');
  const result = sm.transition('PAUSE');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'paused', 'after PAUSE');
});

test('Active -> BudgetLimited', () => {
  const sm = new CommitmentStateMachine('goal-3');
  const result = sm.transition('BUDGET_EXCEEDED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'budget_limited', 'after BUDGET_EXCEEDED');
});

test('BudgetLimited -> Active', () => {
  const sm = new CommitmentStateMachine('goal-6');
  sm.transition('BUDGET_EXCEEDED');
  const result = sm.transition('BUDGET_RESTORED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after BUDGET_RESTORED');
});

test('UsageLimited -> Active', () => {
  const sm = new CommitmentStateMachine('goal-7');
  sm.transition('USAGE_LIMITED');
  const result = sm.transition('USAGE_RESTORED');
  assertEqual(result, true, 'transition result');
  assertEqual(sm.getState(), 'active', 'after USAGE_RESTORED');
});

test('Complete is terminal', () => {
  const sm = new CommitmentStateMachine('goal-10');
  sm.transition('COMPLETE');
  const result = sm.transition('PAUSE');
  assertEqual(result, false, 'invalid transition');
  assertEqual(sm.getState(), 'complete', 'state unchanged');
});

test('Complete can START', () => {
  const sm = new CommitmentStateMachine('goal-11');
  sm.transition('COMPLETE');
  const result = sm.transition('START');
  assertEqual(result, true, 'transition should succeed');
  assertEqual(sm.getState(), 'active', 'state reset');
});

test('Invalid transition returns false', () => {
  const sm = new CommitmentStateMachine('goal-12');
  const result = sm.transition('RESUME');
  assertEqual(result, false, 'invalid transition');
});

test('Hook triggers on state change', () => {
  let triggered = false;
  const sm = createMonitoredMachine('goal-15', {
    onStateChange: () => { triggered = true; }
  });
  sm.transition('PAUSE');
  assertEqual(triggered, true, 'hook triggered');
});

test('onBudgetExceeded hook triggers', () => {
  let triggered = false;
  const sm = createMonitoredMachine('goal-16', {
    onBudgetExceeded: () => { triggered = true; }
  });
  sm.transition('BUDGET_EXCEEDED');
  assertEqual(triggered, true, 'budget exceeded hook triggered');
});

test('getSnapshot returns correct structure', () => {
  const sm = new CommitmentStateMachine('goal-18');
  sm.transition('PAUSE');
  sm.transition('RESUME');
  const snapshot = sm.getSnapshot();
  assertEqual(snapshot.goalId, 'goal-18', 'goalId');
  assertEqual(snapshot.state, 'active', 'state');
  assertEqual(snapshot.transitionsCount, 2, 'transitionsCount');
});

console.log('\n✅ All commitment state machine tests passed!');
