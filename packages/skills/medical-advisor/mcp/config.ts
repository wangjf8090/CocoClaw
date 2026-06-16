/**
 * 数据源配置
 * 
 * v3.6.0.1 新增
 * 管理多数据源的配置和优先级
 * 
 * @version 1.1.0
 * @date 2026-06-14
 */

import { Capability } from './interfaces';
import { ZhongkangDataSource } from './zhongkang-adapter';
import { PubMedDataSource } from './pubmed-adapter';
import { ClinicalGuidelinesDataSource } from './clinical-guidelines-adapter';
import {
  MedicalDataSourceRegistry,
  DefaultMedicalDataSourceRegistry
} from './interfaces';

// ============================================================================
// 数据源配置
// ============================================================================

/**
 * 数据源条目配置
 */
export interface DataSourceEntry {
  id: string;
  capability: Capability;
}

/**
 * 全局数据源配置
 */
export interface DataSourceConfiguration {
  /** 主数据源 ID */
  primary: string;
  /** 兜底数据源 ID */
  fallback: string;
  /** 数据源优先级配置 */
  priority: DataSourceEntry[];
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: DataSourceConfiguration = {
  primary: 'zhongkang',    // 主数据源 = 中康科技
  fallback: 'pubmed',       // 兜底数据源 = PubMed
  priority: [
    { id: 'zhongkang', capability: 'drug' },
    { id: 'zhongkang', capability: 'qa' },
    { id: 'zhongkang', capability: 'report' },
    { id: 'zhongkang', capability: 'guideline' },
    { id: 'pubmed', capability: 'literature' }
  ]
};

// ============================================================================
// 数据源注册表管理器
// ============================================================================

/**
 * 数据源管理器
 * 
 * 统一管理所有数据源实例
 */
class DataSourceManager {
  private registry: MedicalDataSourceRegistry;
  private config: DataSourceConfiguration;
  
  constructor(config: Partial<DataSourceConfiguration> = {}) {
    this.registry = new DefaultMedicalDataSourceRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 注册所有内置数据源
    this.registerDefaultSources();
  }
  
  /**
   * 注册默认数据源
   */
  private registerDefaultSources(): void {
    // 中康科技数据源
    const zhongkangSource = new ZhongkangDataSource();
    this.registry.register(zhongkangSource);
    
    // PubMed 数据源
    const pubmedSource = new PubMedDataSource();
    this.registry.register(pubmedSource);
    
    // 临床指南数据源
    const clinicalSource = new ClinicalGuidelinesDataSource();
    this.registry.register(clinicalSource);
  }
  
  /**
   * 获取数据源注册表
   */
  getRegistry(): MedicalDataSourceRegistry {
    return this.registry;
  }
  
  /**
   * 获取数据源
   */
  getSource(id: string): ReturnType<MedicalDataSourceRegistry['get']> {
    return this.registry.get(id);
  }
  
  /**
   * 获取配置
   */
  getConfig(): DataSourceConfiguration {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<DataSourceConfiguration>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 根据能力解析数据源
   */
  async resolveForCapability(capability: Capability): Promise<ReturnType<MedicalDataSourceRegistry['resolve']>> {
    return this.registry.resolve(capability);
  }
  
  /**
   * 列出所有已注册的数据源
   */
  listSources(): ReturnType<MedicalDataSourceRegistry['list']> {
    return this.registry.list();
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let managerInstance: DataSourceManager | null = null;

/**
 * 获取数据源管理器单例
 */
export function getDataSourceManager(
  config?: Partial<DataSourceConfiguration>
): DataSourceManager {
  if (!managerInstance) {
    managerInstance = new DataSourceManager(config);
  } else if (config) {
    managerInstance.updateConfig(config);
  }
  return managerInstance;
}

/**
 * 重置数据源管理器（主要用于测试）
 */
export function resetDataSourceManager(): void {
  managerInstance = null;
}

// ============================================================================
// 导出
// ============================================================================

export default DataSourceManager;
export {
  DataSourceManager,
  DataSourceEntry,
  DataSourceConfiguration,
  DEFAULT_CONFIG
};
// ============================================================================
// P3 预留配置（决策 20 + 决策 24）
// ============================================================================
//
// 心理健康数据源是 v3.7.0 P3 预留场景。
// 占位 id = 'mental-health-bridge'，priority = 999（永远不会被选中），
// enabled = false，不会出现在 resolveForCapability 结果里。
//
// v3.8.0 实施时，开发者只需：
//   1. 实现 MentalHealthBridgeAdapter.query() 和 healthCheck()
//   2. 把下面 enabled 改为 true
//   3. 在 DEFAULT_CONFIG.priority 加 mental-health-bridge 条目
// ---------------------------------------------------------------------------

export const MENTAL_HEALTH_RESERVED_CONFIG = {
  id: 'mental-health-bridge',
  enabled: false,
  priority: 999,
  targetVersion: 'v3.8.0',
  decision: '决策 20 + 决策 24',
  reason: '主人 2026-06-14 决策："先放个框架，后期可以做"'
};
