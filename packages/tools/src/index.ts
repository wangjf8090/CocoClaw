/**
 * @selfclaw/tools
 *
 * Model-agnostic tool abstraction layer for SelfClaw
 * 模型无关的工具抽象层
 *
 * Features:
 * - Zod-powered tool definition schema
 * - Multi-LLM provider format adapters
 * - Built-in file/network/system tools
 * - Tool registry with metrics tracking
 * - Input validation and retry logic
 */

// Core types
export * from './types.js';

// Tool registry
export { ToolRegistry, defineTool } from './registry.js';

// Adapters
export {
  toOpenAIFunction,
  toAnthropicTool,
  toGeminiTool,
  toProviderFormat,
  parseOpenAIToolCall,
  parseAnthropicToolCall,
} from './adapters.js';

// Built-in tools
export {
  builtinTools,
  readFileDefinition,
  readFileHandler,
  writeFileDefinition,
  writeFileHandler,
  editFileDefinition,
  editFileHandler,
  shellCommandDefinition,
  shellCommandHandler,
  httpRequestDefinition,
  httpRequestHandler,
  memorySearchDefinition,
} from './builtins.js';

/**
 * Create a pre-configured tool registry with built-in tools
 * 创建预配置了内置工具的注册表
 */
import { ToolRegistry } from './registry.js';
import { builtinTools } from './builtins.js';

export function createToolRegistry(includeBuiltins = true): ToolRegistry {
  const registry = new ToolRegistry();

  if (includeBuiltins) {
    for (const tool of builtinTools) {
      registry.register(tool.definition, tool.handler);
    }
  }

  return registry;
}
