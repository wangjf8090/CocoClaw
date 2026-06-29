/**
 * Commitment State Machine Types
 * 目标状态机类型定义
 */

export type CommitmentState =
  | 'active'
  | 'paused'
  | 'blocked'
  | 'budget_limited'
  | 'usage_limited'
  | 'complete';

export type CommitmentEvent =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'BUDGET_EXCEEDED'
  | 'BUDGET_RESTORED'
  | 'USAGE_LIMITED'
  | 'USAGE_RESTORED'
  | 'COMPLETE'
  | 'ABANDON';

export interface StateTransition {
  from: CommitmentState;
  event: CommitmentEvent;
  to: CommitmentState;
}

export interface StateChangeHook {
  name: string;
  onStateChange?: (from: CommitmentState, to: CommitmentState, context: StateChangeContext) => void | Promise<void>;
  onBudgetExceeded?: (context: StateChangeContext) => void | Promise<void>;
  onUsageLimited?: (context: StateChangeContext) => void | Promise<void>;
  onComplete?: (context: StateChangeContext) => void | Promise<void>;
}

export interface StateChangeContext {
  goalId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StateMachineConfig {
  hooks?: StateChangeHook[];
  autoRestoreBudget?: boolean;
  autoRestoreUsage?: boolean;
  budgetRestoreIntervalMs?: number;
  usageRestoreIntervalMs?: number;
}

export interface StateMachineSnapshot {
  state: CommitmentState;
  goalId: string;
  transitionsCount: number;
  lastTransitionAt: number;
  createdAt: number;
}
