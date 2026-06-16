/**
 * MCP 适配器统一导出
 * 
 * v3.6.0.1 重构
 * 提供多数据源可插拔架构的统一入口
 * 
 * @version 1.1.0
 * @date 2026-06-14
 */

// ============================================================================
// 接口和类型
// ============================================================================

export {
  MedicalDataSource,
  Capability,
  MedicalDataSourceRegistry,
  DefaultMedicalDataSourceRegistry,
  DrugInfo,
  DrugInteraction,
  SymptomAnalysis,
  PossibleDiagnosis,
  RecommendedTest,
  ExamReportInterpretation,
  ExamItem,
  HealthAdvice,
  LiteratureSearchResult,
  LiteratureArticle,
  HealthManagementPlan,
  MedicationPlan,
  LifestylePlan,
  MonitoringPlan,
  FollowUpSchedule,
  MedicalData,
  MedicalAPIError
} from './interfaces';

// ============================================================================
// 数据源适配器
// ============================================================================

export { ZhongkangDataSource } from './zhongkang-adapter';
export { PubMedDataSource } from './pubmed-adapter';
export { ClinicalGuidelinesDataSource } from './clinical-guidelines-adapter';

// ============================================================================
// 配置和注册表
// ============================================================================

export {
  getDataSourceManager,
  resetDataSourceManager,
  DataSourceManager,
  DataSourceEntry,
  DataSourceConfiguration,
  DEFAULT_CONFIG
} from './config';

// ============================================================================
// 便捷方法
// ============================================================================

import { getDataSourceManager } from './config';
import { Capability } from './interfaces';

/**
 * 便捷方法：获取数据源管理器
 */
export function createMedicalAdvisor(): ReturnType<typeof getDataSourceManager> {
  return getDataSourceManager();
}

/**
 * 便捷方法：执行查询
 */
export async function queryMedicalData<T>(
  capability: Capability,
  params: Record<string, unknown>
): Promise<T> {
  const manager = getDataSourceManager();
  const source = await manager.resolveForCapability(capability);
  return source.query<T>(capability, params);
}
// ============================================================================
// 数据源适配器
// ============================================================================

export { ZhongkangDataSource } from './zhongkang-adapter';
export { PubMedDataSource } from './pubmed-adapter';
export { ClinicalGuidelinesDataSource } from './clinical-guidelines-adapter';

// ============================================================================
// P3 预留适配器（决策 20 + 决策 24）
// ============================================================================

export {
  MentalHealthDataSourceReserved,
  MentalHealthBridgeAdapter,
  P3NotImplementedError
} from './mental-health-adapter';

export type {
  MentalHealthCapability,
  MentalScreeningResult,
  CrisisSignal,
  MoodEntry,
  MentalHealthDataSource
} from './mental-health-adapter';
