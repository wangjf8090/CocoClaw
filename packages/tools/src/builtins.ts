/**
 * Built-in Tools
 * 内置工具集
 * 文件操作、Shell命令、网络请求、记忆检索等
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { ToolDefinition, ToolResult } from './types.js';

const execAsync = promisify(exec);

// ============ File Operation Tools ============

/**
 * Read File Tool
 * 读取文件工具
 */
export const readFileDefinition: ToolDefinition = {
  name: 'read_file',
  description: '读取文件内容',
  category: 'file',
  parameters: z.object({
    path: z.string().describe('文件路径'),
    encoding: z.string().optional().default('utf-8').describe('文件编码'),
  }),
};

export async function readFileHandler(params: {
  path: string;
  encoding?: string;
}): Promise<ToolResult> {
  try {
    // Security: Restrict to allowed paths
    const normalizedPath = path.normalize(params.path);
    if (normalizedPath.includes('..')) {
      return {
        success: false,
        error: 'Access denied: Parent directory traversal not allowed',
      };
    }

    const content = await fs.readFile(normalizedPath, params.encoding || 'utf-8');
    return {
      success: true,
      data: {
        content,
        path: normalizedPath,
        size: Buffer.byteLength(content, params.encoding || 'utf-8'),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Write File Tool
 * 写入文件工具
 */
export const writeFileDefinition: ToolDefinition = {
  name: 'write_file',
  description: '写入内容到文件',
  category: 'file',
  parameters: z.object({
    path: z.string().describe('文件路径'),
    content: z.string().describe('文件内容'),
    encoding: z.string().optional().default('utf-8').describe('文件编码'),
    overwrite: z.boolean().optional().default(false).describe('是否覆盖已有文件'),
  }),
};

export async function writeFileHandler(params: {
  path: string;
  content: string;
  encoding?: string;
  overwrite?: boolean;
}): Promise<ToolResult> {
  try {
    const normalizedPath = path.normalize(params.path);
    if (normalizedPath.includes('..')) {
      return {
        success: false,
        error: 'Access denied: Parent directory traversal not allowed',
      };
    }

    // Check if file exists
    if (!params.overwrite) {
      try {
        await fs.access(normalizedPath);
        return {
          success: false,
          error: 'File already exists. Set overwrite=true to replace.',
        };
      } catch {
        // File doesn't exist, continue
      }
    }

    // Create directory if not exists
    const dir = path.dirname(normalizedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(normalizedPath, params.content, params.encoding || 'utf-8');
    return {
      success: true,
      data: {
        path: normalizedPath,
        size: Buffer.byteLength(params.content, params.encoding || 'utf-8'),
        written: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Edit File Tool
 * 编辑文件工具
 */
export const editFileDefinition: ToolDefinition = {
  name: 'edit_file',
  description: '编辑文件内容 - 替换指定字符串',
  category: 'file',
  parameters: z.object({
    path: z.string().describe('文件路径'),
    oldString: z.string().describe('要替换的旧内容'),
    newString: z.string().describe('新内容'),
  }),
};

export async function editFileHandler(params: {
  path: string;
  oldString: string;
  newString: string;
}): Promise<ToolResult> {
  try {
    const normalizedPath = path.normalize(params.path);
    if (normalizedPath.includes('..')) {
      return {
        success: false,
        error: 'Access denied: Parent directory traversal not allowed',
      };
    }

    const content = await fs.readFile(normalizedPath, 'utf-8');
    if (!content.includes(params.oldString)) {
      return {
        success: false,
        error: 'Old string not found in file',
      };
    }

    const newContent = content.replace(params.oldString, params.newString);
    await fs.writeFile(normalizedPath, newContent, 'utf-8');

    return {
      success: true,
      data: {
        path: normalizedPath,
        replaced: true,
        oldSize: content.length,
        newSize: newContent.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============ Shell Tools ============

/**
 * Shell Command Tool
 * Shell 命令执行工具
 */
export const shellCommandDefinition: ToolDefinition = {
  name: 'shell_command',
  description: '执行Shell命令',
  category: 'system',
  parameters: z.object({
    command: z.string().describe('要执行的命令'),
    cwd: z.string().optional().describe('工作目录'),
    timeout: z.number().optional().default(30000).describe('超时时间（毫秒）'),
  }),
};

export async function shellCommandHandler(params: {
  command: string;
  cwd?: string;
  timeout?: number;
}): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execAsync(params.command, {
      cwd: params.cwd,
      timeout: params.timeout || 30000,
    });

    return {
      success: true,
      data: {
        stdout,
        stderr,
        command: params.command,
      },
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message: string };
    return {
      success: false,
      error: execError.message,
      data: {
        stdout: execError.stdout,
        stderr: execError.stderr,
      },
    };
  }
}

// ============ Network Tools ============

/**
 * HTTP Request Tool
 * HTTP 请求工具
 */
export const httpRequestDefinition: ToolDefinition = {
  name: 'http_request',
  description: '发送HTTP请求',
  category: 'network',
  parameters: z.object({
    url: z.string().describe('请求URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET').describe('请求方法'),
    headers: z.record(z.string()).optional().describe('请求头'),
    body: z.string().optional().describe('请求体'),
    timeout: z.number().optional().default(30000).describe('超时时间'),
  }),
};

export async function httpRequestHandler(params: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}): Promise<ToolResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeout || 30000);

    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    return {
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: text,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============ Memory Retrieval Tool ============

/**
 * Memory Search Tool
 * 记忆检索工具
 */
export const memorySearchDefinition: ToolDefinition = {
  name: 'memory_search',
  description: '搜索相关记忆',
  category: 'memory',
  parameters: z.object({
    query: z.string().describe('搜索查询'),
    limit: z.number().optional().default(10).describe('返回结果数量'),
    threshold: z.number().optional().default(0.5).describe('相似度阈值'),
    types: z.array(z.string()).optional().describe('记忆类型过滤'),
  }),
};

// ============ Export all builtins ============

export const builtinTools = [
  { definition: readFileDefinition, handler: readFileHandler },
  { definition: writeFileDefinition, handler: writeFileHandler },
  { definition: editFileDefinition, handler: editFileHandler },
  { definition: shellCommandDefinition, handler: shellCommandHandler },
  { definition: httpRequestDefinition, handler: httpRequestHandler },
  { definition: memorySearchDefinition, handler: async () => ({ success: true, data: { results: [] } }) },
];
