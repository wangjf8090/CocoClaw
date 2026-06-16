/**
 * 数据源配置
 * 
 * v3.7.0 M1 药店经营辅助 Skill
 * 管理多数据源的配置和优先级
 * 
 * @version 1.0.0
 * @date 2026-06-15
 */

import { PharmacyCapability } from './interfaces';
import { NHcDataSource } from './nhc-adapter';
import { ClinicalGuidelinesDataSource } from './clinical-guidelines-adapter';
import { PubMedDataSource } from './pubmed-adapter';
import {
  PharmacyDataSourceRegistry,
  DefaultPharmacyDataSourceRegistry,
} from './interfaces';

// ============================================================================
// 数据源配置
// ============================================================================

/**
 * 数据源条目配置
 */
export interface DataSourceEntry {
  id: string;
  capability: PharmacyCapability;
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
  primary: 'nhc',                      // 主数据源 = 卫健委公开数据
  fallback: 'clinical-guidelines',       // 兜底数据源 = 临床指南
  priority: [
    { id: 'nhc', capability: 'drug-info' },
    { id: 'nhc', capability: 'compliance-check' },
    { id: 'nhc', capability: 'inventory-analysis' },
    { id: 'nhc', capability: 'substitute-recommend' },
    { id: 'clinical-guidelines', capability: 'medication-guidance' },
    { id: 'pubmed', capability: 'drug-interaction' },
  ],
};

// ============================================================================
// 数据源注册表管理器
// ============================================================================

/**
 * 数据源管理器
 */
class DataSourceManager {
  private registry: PharmacyDataSourceRegistry;
  private config: DataSourceConfiguration;
  
  constructor(config: Partial<DataSourceConfiguration> = {}) {
    this.registry = new DefaultPharmacyDataSourceRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 注册所有内置数据源
    this.registerDefaultSources();
  }
  
  /**
   * 注册默认数据源
   */
  private registerDefaultSources(): void {
    // 卫健委公开数据源
    const nhcSource = new NHcDataSource();
    this.registry.register(nhcSource);
    
    // 临床指南数据源
    const clinicalSource = new ClinicalGuidelinesDataSource();
    this.registry.register(clinicalSource);
    
    // PubMed 数据源
    const pubmedSource = new PubMedDataSource();
    this.registry.register(pubmedSource);
  }
  
  /**
   * 获取数据源注册表
   */
  getRegistry(): PharmacyDataSourceRegistry {
    return this.registry;
  }
  
  /**
   * 获取数据源
   */
  getSource(id: string): ReturnType<PharmacyDataSourceRegistry['get']> {
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
  async resolveForCapability(capability: PharmacyCapability): Promise<ReturnType<PharmacyDataSourceRegistry['resolve']>> {
    return this.registry.resolve(capability);
  }
  
  /**
   * 列出所有已注册的数据源
   */
  listSources(): ReturnType<PharmacyDataSourceRegistry['list']> {
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
  DEFAULT_CONFIG,
};
