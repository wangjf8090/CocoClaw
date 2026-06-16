/**
 * Medical Advisor MCP Adapter
 * 
 * 向后兼容 shim
 * 重导出 mcp/index.ts 的所有内容
 * 
 * @version 1.1.0 (v3.6.0.1 去中康化版)
 * @date 2026-06-14
 * 
 * @deprecated 请使用 mcp/index.ts 作为新入口
 */

// Re-export from new modular structure
export * from './mcp/index.ts';

// Re-export specific classes for backward compatibility
export { ZhongkangDataSource } from './mcp/zhongkang-adapter';
export { PubMedDataSource } from './mcp/pubmed-adapter';
export { ClinicalGuidelinesDataSource } from './mcp/clinical-guidelines-adapter';

// Re-export config
export {
  getDataSourceManager,
  resetDataSourceManager,
  DEFAULT_CONFIG
} from './mcp/config';

// Backward compatibility alias
import { ZhongkangDataSource as OriginalZhongkangMedicalAdapter } from './mcp/zhongkang-adapter';

/**
 * @deprecated Use ZhongkangDataSource from './mcp/zhongkang-adapter' instead
 */
export const ZhongkangMedicalAdapter = OriginalZhongkangMedicalAdapter;
