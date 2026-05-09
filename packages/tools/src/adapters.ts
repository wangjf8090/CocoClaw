/**
 * LLM Provider Adapters
 * LLM 提供商适配器
 * 将通用工具定义转换为不同LLM提供商的工具调用格式
 */

import { z } from 'zod';
import {
  ToolDefinition,
  LLMProviderType,
  OpenAIFunction,
  AnthropicTool,
  GeminiTool,
} from './types.js';

/**
 * Convert Zod schema to JSON Schema
 * 将 Zod schema 转换为 JSON Schema
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const typeName = schema._def.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema(schema._def.type),
      };
    case 'ZodObject': {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      const shape = schema._def.shape() as Record<string, z.ZodTypeAny>;

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        if (value._def.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
      };
    }
    case 'ZodOptional':
      return zodToJsonSchema(schema._def.innerType);
    case 'ZodEnum':
      return {
        type: 'string',
        enum: schema._def.values,
      };
    case 'ZodLiteral':
      return {
        type: typeof schema._def.value,
        enum: [schema._def.value],
      };
    default:
      return { type: 'string' };
  }
}

/**
 * Convert ToolDefinition to OpenAI Function Calling format
 * 将工具定义转换为 OpenAI 函数调用格式
 */
export function toOpenAIFunction(tool: ToolDefinition): OpenAIFunction {
  const jsonSchema = zodToJsonSchema(tool.parameters);
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: (jsonSchema.properties as Record<string, unknown>) || {},
      required: (jsonSchema.required as string[]) || [],
    },
  };
}

/**
 * Convert ToolDefinition to Anthropic Tool Use format
 * 将工具定义转换为 Anthropic 工具使用格式
 */
export function toAnthropicTool(tool: ToolDefinition): AnthropicTool {
  const jsonSchema = zodToJsonSchema(tool.parameters);
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: (jsonSchema.properties as Record<string, unknown>) || {},
      required: (jsonSchema.required as string[]) || [],
    },
  };
}

/**
 * Convert ToolDefinition to Google Gemini Tool format
 * 将工具定义转换为 Google Gemini 工具格式
 */
export function toGeminiTool(tool: ToolDefinition): GeminiTool {
  const jsonSchema = zodToJsonSchema(tool.parameters);
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: (jsonSchema.properties as Record<string, unknown>) || {},
      required: (jsonSchema.required as string[]) || [],
    },
  };
}

/**
 * Convert ToolDefinition array to specified provider format
 * 将工具定义数组转换为指定提供商格式
 */
export function toProviderFormat(
  tools: ToolDefinition[],
  provider: LLMProviderType
): unknown[] {
  switch (provider) {
    case LLMProviderType.OPENAI:
      return tools.map(toOpenAIFunction).map((fn) => ({
        type: 'function',
        function: fn,
      }));
    case LLMProviderType.ANTHROPIC:
      return tools.map(toAnthropicTool);
    case LLMProviderType.GOOGLE:
      return tools.map(toGeminiTool);
    case LLMProviderType.MISTRAL:
      return tools.map(toOpenAIFunction);
    default:
      return tools.map(toOpenAIFunction);
  }
}

/**
 * Parse tool call from OpenAI response format
 * 从 OpenAI 响应格式解析工具调用
 */
export function parseOpenAIToolCall(call: {
  id: string;
  function: { name: string; arguments: string };
}): { id: string; name: string; arguments: Record<string, unknown> } {
  return {
    id: call.id,
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments),
  };
}

/**
 * Parse tool call from Anthropic response format
 * 从 Anthropic 响应格式解析工具调用
 */
export function parseAnthropicToolCall(call: {
  id: string;
  name: string;
  input: Record<string, unknown>;
}): { id: string; name: string; arguments: Record<string, unknown> } {
  return {
    id: call.id,
    name: call.name,
    arguments: call.input,
  };
}
