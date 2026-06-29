# Model Router Design

## Overview

Multi-model router with automatic fallback and health monitoring for SelfClaw Agent.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ModelRouter                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Router    │  │  Fallback   │  │   Health    │  │
│  │             │  │   Manager   │  │   Monitor   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  Claude   │    │   GPT-4   │    │   GLM     │
    │ Adapter   │    │  Adapter  │    │ Adapter   │
    └───────────┘    └───────────┘    └───────────┘
```

## Fallback Chain

Default priority order:

1. **Claude 3.7 Sonnet** (priority=1) - Primary, best quality
2. **GPT-4o** (priority=2) - First fallback
3. **GLM-5.2** (priority=3) - Second fallback
4. **Qwen-3-Max** (priority=4) - Third fallback
5. **DeepSeek-V3** (priority=5) - Last resort

## Health Check Strategy

- **Interval**: 60 seconds
- **Failure Threshold**: 3 consecutive failures → UNHEALTHY
- **Recovery**: 2 minutes after last failure → re-check
- **Timeout**: 5 seconds per health ping

## Usage

```typescript
import { ModelRouter, HealthMonitor } from '@selfclaw/model-router';
import { createClaudeAdapter } from '@selfclaw/model-router/adapters/claude';

const router = new ModelRouter();
const monitor = new HealthMonitor();

const claude = createClaudeAdapter({ apiKey: 'xxx' });
router.registerAdapter(claude);
monitor.registerAdapter(claude);

monitor.startMonitoring();

const response = await router.routeWithFallback({
  prompt: 'Hello, world!',
});
```

## State Machine Integration

When UsageLimited is triggered:
1. Fallback chain exhausts all models
2. Returns error response
3. Caller should invoke `commitment-state-machine.transition('USAGE_LIMITED')`

When BudgetLimited is detected:
1. `checkBudgetExceeded()` returns `shouldDegrade: true`
2. Router switches to lower-priority model
3. If budget depleted, invoke `commitment-state-machine.transition('BUDGET_EXCEEDED')`
