/**
 * MCP 适配器统一导出
 * 
 * v3.7.0 M1 药店经营辅助 Skill
 * 提供多数据源可插拔架构的统一入口
 * 
 * @version 1.0.0
 * @date 2026-06-15
 */

// ============================================================================
// 接口和类型
// ============================================================================

export {
  PharmacyDataSource,
  PharmacyCapability,
  PharmacyDataSourceRegistry,
  DefaultPharmacyDataSourceRegistry,
  DrugInfo,
  MedicationGuidance,
  DrugInteraction,
  InventoryAnalysis,
  InventoryAlert,
  InventoryItem,
  ComplianceCheckResult,
  ComplianceRequirement,
  SubstituteRecommendation,
  SubstituteDrug,
  PharmacyContext,
} from './interfaces';

// ============================================================================
// 数据源适配器
// ============================================================================

export { NHcDataSource } from './nhc-adapter';
export { ClinicalGuidelinesDataSource } from './clinical-guidelines-adapter';
export { PubMedDataSource } from './pubmed-adapter';

// ============================================================================
// 配置和注册表
// ============================================================================

export {
  getDataSourceManager,
  resetDataSourceManager,
  DataSourceManager,
  DataSourceEntry,
  DataSourceConfiguration,
  DEFAULT_CONFIG,
} from './config';

// ============================================================================
// 便捷方法
// ============================================================================

import { getDataSourceManager } from './config';
import { PharmacyCapability } from './interfaces';

/**
 * 便捷方法：获取数据源管理器
 */
export function createPharmacyAdvisor(): ReturnType<typeof getDataSourceManager> {
  return getDataSourceManager();
}

/**
 * 便捷方法：执行查询
 */
export async function queryPharmacyData<T>(
  capability: PharmacyCapability,
  params: Record<string, unknown>
): Promise<T> {
  const manager = getDataSourceManager();
  const source = await manager.resolveForCapability(capability);
  return source.query<T>(capability, params);
}

// ============================================================================
// 导出结束
// ============================================================================
