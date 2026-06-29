/**
 * Model Router
 * 多模型路由核心
 */

import {
  ModelAdapter,
  ModelRequest,
  ModelResponse,
  RouterConfig,
  HealthStatus,
  DEFAULT_ROUTER_CONFIG,
} from './types.js';

export class ModelRouter {
  private adapters: Map<string, ModelAdapter> = new Map();
  private config: RouterConfig;
  private healthMap: Map<string, HealthStatus> = new Map();

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  registerAdapter(adapter: ModelAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.healthMap.set(adapter.name, HealthStatus.UNKNOWN);
  }

  getAdapter(name: string): ModelAdapter | undefined {
    return this.adapters.get(name);
  }

  getHealthyAdapters(): ModelAdapter[] {
    return Array.from(this.adapters.values())
      .filter(a => {
        const health = this.healthMap.get(a.name) ?? HealthStatus.UNKNOWN;
        return health === HealthStatus.HEALTHY || health === HealthStatus.DEGRADED;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  async route(request: ModelRequest): Promise<ModelResponse> {
    const candidates = this.getHealthyAdapters();
    
    if (candidates.length === 0) {
      return {
        content: '',
        model: 'none',
        latencyMs: 0,
        error: 'No healthy adapters available',
      };
    }

    const primary = candidates[0];
    try {
      return await primary.invoke(request);
    } catch (err) {
      return {
        content: '',
        model: primary.name,
        latencyMs: 0,
        error: `Primary model failed: ${err}`,
      };
    }
  }

  async routeWithFallback(
    request: ModelRequest,
    onFallback?: (from: string, to: string) => void
  ): Promise<ModelResponse> {
    const candidates = this.getHealthyAdapters();

    for (let i = 0; i < candidates.length; i++) {
      const adapter = candidates[i];
      
      try {
        return await adapter.invoke(request);
      } catch (err) {
        if (i < candidates.length - 1) {
          onFallback?.(adapter.name, candidates[i + 1].name);
        }
      }
    }

    return {
      content: '',
      model: candidates[candidates.length - 1]?.name ?? 'none',
      latencyMs: 0,
      error: 'All models failed',
    };
  }

  updateHealthStatus(name: string, status: HealthStatus): void {
    this.healthMap.set(name, status);
  }

  getConfig(): RouterConfig {
    return { ...this.config };
  }

  listAdapters(): { name: string; priority: number; health: HealthStatus }[] {
    return Array.from(this.adapters.values()).map(a => ({
      name: a.name,
      priority: a.priority,
      health: this.healthMap.get(a.name) ?? HealthStatus.UNKNOWN,
    }));
  }
}
