/**
 * Pharmacy Operations Advisor MCP Adapter
 * 
 * 向后兼容 shim
 * 重导出 mcp/index.ts 的所有内容
 * 
 * @version 1.0.0
 * @date 2026-06-15
 */

// Re-export from new modular structure
export * from './mcp/index.ts';

// Re-export specific classes for backward compatibility
export { NHcDataSource } from './mcp/nhc-adapter';
export { PubMedDataSource } from './mcp/pubmed-adapter';
export { ClinicalGuidelinesDataSource } from './mcp/clinical-guidelines-adapter';

// Re-export config
export {
  getDataSourceManager,
  resetDataSourceManager,
  DEFAULT_CONFIG,
} from './mcp/config';
