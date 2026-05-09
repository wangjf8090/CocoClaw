/**
 * Memory Storage Layer
 * JSONL转录持久化 + Markdown文件存储
 * 支持增量写入和原子操作
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { Memory, StorageOptions, MemoryType } from './types.js';

export class MemoryStorage {
  private options: Required<StorageOptions>;
  private memoryMap: Map<string, Memory> = new Map();
  private writeQueue: Memory[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;

  constructor(options: StorageOptions) {
    this.options = {
      dataDir: options.dataDir,
      memoryFile: options.memoryFile || 'memories.jsonl',
      jsonlFile: options.jsonlFile || 'transcripts.jsonl',
      autoFlush: options.autoFlush ?? true,
      flushInterval: options.flushInterval ?? 30000,
    };
  }

  /**
   * 初始化存储目录和文件
   */
  async initialize(): Promise<void> {
    const { dataDir, memoryFile, jsonlFile } = this.options;
    
    // 创建数据目录
    if (!existsSync(dataDir)) {
      await fs.mkdir(dataDir, { recursive: true });
    }

    // 创建记忆文件（如果不存在）
    const memoryFilePath = path.join(dataDir, memoryFile);
    if (!existsSync(memoryFilePath)) {
      await fs.writeFile(memoryFilePath, '', 'utf8');
    }

    // 创建转录文件（如果不存在）
    const jsonlFilePath = path.join(dataDir, jsonlFile);
    if (!existsSync(jsonlFilePath)) {
      await fs.writeFile(jsonlFilePath, '', 'utf8');
    }

    // 加载现有记忆
    await this.loadMemories();

    // 启动自动刷新
    if (this.options.autoFlush) {
      this.startAutoFlush();
    }
  }

  /**
   * 从JSONL文件加载记忆
   */
  private async loadMemories(): Promise<void> {
    const filePath = path.join(this.options.dataDir, this.options.memoryFile);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const memory = JSON.parse(line) as Memory;
          this.memoryMap.set(memory.id, memory);
        } catch (e) {
          console.warn('Failed to parse memory line:', line);
        }
      }

      console.log(`Loaded ${this.memoryMap.size} memories from storage`);
    } catch (error) {
      console.error('Error loading memories:', error);
    }
  }

  /**
   * 保存记忆到内存队列
   */
  async save(memory: Memory): Promise<void> {
    this.memoryMap.set(memory.id, memory);
    this.writeQueue.push(memory);
  }

  /**
   * 批量保存记忆
   */
  async saveBatch(memories: Memory[]): Promise<void> {
    for (const memory of memories) {
      this.memoryMap.set(memory.id, memory);
      this.writeQueue.push(memory);
    }
  }

  /**
   * 获取单个记忆
   */
  get(id: string): Memory | undefined {
    const memory = this.memoryMap.get(id);
    if (memory) {
      // 更新访问统计
      memory.accessCount++;
      memory.lastAccessedAt = Date.now();
    }
    return memory;
  }

  /**
   * 获取所有记忆
   */
  getAll(options?: { type?: MemoryType; limit?: number; offset?: number }): Memory[] {
    let result = Array.from(this.memoryMap.values());

    if (options?.type) {
      result = result.filter(m => m.type === options.type);
    }

    // 按创建时间倒序
    result.sort((a, b) => b.createdAt - a.createdAt);

    if (options?.offset) {
      result = result.slice(options.offset);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.memoryMap.delete(id);
  }

  /**
   * 刷新队列到磁盘（原子操作）
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.writeQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const queueToWrite = [...this.writeQueue];
    this.writeQueue = [];

    try {
      const memoryFilePath = path.join(this.options.dataDir, this.options.memoryFile);
      const transcriptFilePath = path.join(this.options.dataDir, this.options.jsonlFile);

      // 追加到转录文件
      const transcriptLines = queueToWrite.map(m => JSON.stringify({
        id: m.id,
        type: m.type,
        content: m.content,
        timestamp: m.createdAt,
      })).join('\n');
      
      await fs.appendFile(transcriptFilePath, transcriptLines + '\n', 'utf8');

      // 重写完整记忆文件（原子操作）
      const tempFile = `${memoryFilePath}.tmp`;
      const allMemories = Array.from(this.memoryMap.values());
      const content = allMemories.map(m => JSON.stringify(m)).join('\n') + '\n';
      
      await fs.writeFile(tempFile, content, 'utf8');
      await fs.rename(tempFile, memoryFilePath);

      console.log(`Flushed ${queueToWrite.length} memories to disk`);
    } catch (error) {
      // 恢复队列
      this.writeQueue = [...queueToWrite, ...this.writeQueue];
      console.error('Error flushing memories:', error);
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 启动自动刷新
   */
  private startAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.options.flushInterval);
  }

  /**
   * 停止自动刷新
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; pending: number } {
    return {
      total: this.memoryMap.size,
      pending: this.writeQueue.length,
    };
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
  }

  /**
   * 导出为Markdown格式
   */
  async exportToMarkdown(filePath: string, title: string = 'MEMORY'): Promise<void> {
    const memories = this.getAll();
    
    let markdown = `# ${title}\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `Total memories: ${memories.length}\n\n---\n\n`;

    const grouped = this.groupByType(memories);
    
    for (const [type, typeMemories] of Object.entries(grouped)) {
      markdown += `## ${type.toUpperCase()}\n\n`;
      
      for (const memory of typeMemories.sort((a, b) => a.createdAt - b.createdAt)) {
        const date = new Date(memory.createdAt).toLocaleString();
        markdown += `### [${memory.id.slice(0, 8)}] ${date}\n\n`;
        markdown += `${memory.content}\n\n`;
        if (Object.keys(memory.metadata).length > 0) {
          markdown += `*Metadata: ${JSON.stringify(memory.metadata)}*\n\n`;
        }
      }
      
      markdown += '---\n\n';
    }

    await fs.writeFile(filePath, markdown, 'utf8');
  }

  private groupByType(memories: Memory[]): Record<string, Memory[]> {
    return memories.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, Memory[]>);
  }
}
