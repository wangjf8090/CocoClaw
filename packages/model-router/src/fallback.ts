/**
 * Fallback Chain
 * 降级链管理
 */

import {
  ModelAdapter,
  ModelRequest,
  ModelResponse,
  FallbackStrategy,
  DEFAULT_FALLBACK_STRATEGY,
  HealthStatus,
} from './types.js';

export interface FallbackChainConfig {
  strategy: FallbackStrategy;
  adapters: ModelAdapter[];
  onTransition?: (from: string, to: string, attempt: number) => void;
  onAllFailed?: (error: string) => void;
}

export interface FallbackResult {
  response: ModelResponse;
  attemptedModels: string[];
  successModel: string | null;
  transitionCount: number;
}

export function createFallbackChain(
  adapters: ModelAdapter[],
  strategy: FallbackStrategy = DEFAULT_FALLBACK_STRATEGY
): (request: ModelRequest) => Promise<FallbackResult> {
  const sortedAdapters = [...adapters].sort((a, b) => a.priority - b.priority);

  return async (request: ModelRequest): Promise<FallbackResult> => {
    const attemptedModels: string[] = [];
    let transitionCount = 0;

    for (let i = 0; i < Math.min(sortedAdapters.length, strategy.maxRetries); i++) {
      const adapter = sortedAdapters[i];

      if (i > 0) {
        transitionCount++;
      }

      attemptedModels.push(adapter.name);

      try {
        const response = await adapter.invoke(request);
        
        return {
          response,
          attemptedModels,
          successModel: adapter.name,
          transitionCount,
        };
      } catch (err) {
        if (i < sortedAdapters.length - 1) {
          continue;
        }
      }
    }

    return {
      response: {
        content: '',
        model: attemptedModels[attemptedModels.length - 1] ?? 'none',
        latencyMs: 0,
        error: 'All fallback models exhausted',
      },
      attemptedModels,
      successModel: null,
      transitionCount,
    };
  };
}

export class FallbackManager {
  private chain: Map<string, ModelAdapter> = new Map();
  private circuitBreakers: Map<string, number> = new Map();
  private strategy: FallbackStrategy;

  constructor(strategy: FallbackStrategy = DEFAULT_FALLBACK_STRATEGY) {
    this.strategy = strategy;
  }

  registerModel(adapter: ModelAdapter): void {
    this.chain.set(adapter.name, adapter);
    this.circuitBreakers.set(adapter.name, 0);
  }

  getNextFallback(currentModel: string): ModelAdapter | null {
    const sorted = Array.from(this.chain.values())
      .sort((a, b) => a.priority - b.priority);

    const currentIndex = sorted.findIndex(a => a.name === currentModel);
    if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
      return null;
    }

    return sorted[currentIndex + 1];
  }

  recordFailure(modelName: string): void {
    const count = (this.circuitBreakers.get(modelName) ?? 0) + 1;
    this.circuitBreakers.set(modelName, count);
  }

  recordSuccess(modelName: string): void {
    this.circuitBreakers.set(modelName, 0);
  }

  isCircuitOpen(modelName: string): boolean {
    return (this.circuitBreakers.get(modelName) ?? 0) >= this.strategy.circuitBreakerThreshold;
  }

  resetCircuit(modelName: string): void {
    this.circuitBreakers.set(modelName, 0);
  }

  getChain(): ModelAdapter[] {
    return Array.from(this.chain.values()).sort((a, b) => a.priority - b.priority);
  }
}
