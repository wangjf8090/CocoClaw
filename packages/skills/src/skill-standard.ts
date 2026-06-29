/**
 * SKILL.md 开放标准实现
 * 参考 BrowserBC 规范，统一技能卡格式，支持跨平台复用
 *
 * 格式: YAML frontmatter + Markdown body
 *   ---
 *   name: skill-name
 *   description: 技能描述
 *   version: 1.0.0
 *   ---
 *
 *   ## Instructions
 *   ...
 *
 *   ## Examples
 *   ...
 *
 *   ## Limitations
 *   ...
 */

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * SKILL.md 开放标准类型
 * 对标 BrowserBC 27+ 平台复用标准
 */
export interface SkillStandard {
  // --- YAML frontmatter 字段 ---
  /** 技能名称（唯一标识，kebab-case） */
  name: string;
  /** 触发条件描述（自然语言） */
  description: string;
  /** 语义化版本号 */
  version: string;
  /** 作者 */
  author?: string;
  /** 兼容模型列表（如 ['gpt-4o', 'claude-3.7-sonnet', 'qwen-3-max']） */
  model_support?: string[];
  /** 依赖的其他技能 */
  dependencies?: string[];
  /** 标签（用于检索和分类） */
  tags?: string[];
  /** 所属领域（如 'browser', 'file', 'api', 'medical', 'financial'） */
  domain?: string;
  /** 能力分类（如 'web-automation', 'data-extraction', 'document-creation'） */
  capability?: string;

  // --- Markdown body 字段 ---
  /** 详细执行指令 */
  instructions: string;
  /** 使用示例 */
  examples?: string[];
  /** 局限性说明 */
  limitations?: string[];
}

/**
 * YAML Frontmatter 解析结果
 */
export interface FrontmatterResult {
  name: string;
  description: string;
  version: string;
  author?: string;
  model_support?: string[];
  dependencies?: string[];
  tags?: string[];
  domain?: string;
  capability?: string;
  [key: string]: unknown;
}

/**
 * 解析验证结果
 */
export interface ParseValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// YAML 解析器（轻量实现，不引入第三方依赖）
// ============================================================================

/**
 * 解析简单的 YAML frontmatter
 * 支持: 字符串、数字、布尔值、数组（每行一个 - item）
 */
export function parseYAML(input: string): FrontmatterResult {
  const result: Record<string, unknown> = {};
  const lines = input.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 数组项: "- value"
    if (trimmed.startsWith('- ') && currentKey && currentArray !== null) {
      const value = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
      currentArray.push(value);
      continue;
    }

    // 键值对: "key: value"
    const kvMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)/);
    if (kvMatch) {
      // 保存上一个数组
      if (currentKey && currentArray !== null) {
        result[currentKey] = currentArray;
      }

      currentKey = kvMatch[1];
      const rawValue = kvMatch[2].trim();

      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        // 空值或块标记 → 开始数组
        currentArray = [];
        continue;
      }

      // 解析标量值
      currentArray = null;
      result[currentKey] = parseScalar(rawValue);
    }
  }

  // 保存最后一个数组
  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray;
  }

  return result as unknown as FrontmatterResult;
}

/**
 * 解析标量值
 */
function parseScalar(value: string): unknown {
  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;
  // 数字
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // 引号字符串 → 去引号
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  // 普通字符串
  return value;
}

/**
 * 生成 YAML frontmatter 文本
 */
export function dumpYAML(data: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'string') {
      // 含特殊字符时加引号（语义化版本号如 1.0.0 不需要引号）
      if (value.includes(':') || value.includes('#') || value.includes("'") ||
          value.includes('\n') || value === '') {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Markdown Body 解析
// ============================================================================

/**
 * 从 Markdown body 中提取指定 section 的文本内容
 */
export function extractSection(body: string, heading: string): string {
  const lines = body.split('\n');
  let inSection = false;
  const content: string[] = [];

  for (const line of lines) {
    // 检测 heading（支持 ## 和 ### 开头）
    if (/^#{1,3}\s/.test(line)) {
      if (line.trim() === heading || line.trim().startsWith(heading)) {
        inSection = true;
        continue;
      } else if (inSection) {
        // 遇到下一个 heading，停止
        break;
      }
    }

    if (inSection) {
      content.push(line);
    }
  }

  return content.join('\n').trim();
}

/**
 * 从 Markdown body 中提取指定 section 的列表项
 */
export function extractSectionList(body: string, heading: string): string[] {
  const sectionText = extractSection(body, heading);
  if (!sectionText) return [];

  const items: string[] = [];
  for (const line of sectionText.split('\n')) {
    const trimmed = line.trim();
    // 匹配 "- item" 或 "* item" 或 "1. item"
    const listMatch = trimmed.match(/^[-*]\s+(.*)/) || trimmed.match(/^\d+\.\s+(.*)/);
    if (listMatch) {
      items.push(listMatch[1].trim());
    } else if (trimmed && !trimmed.startsWith('#')) {
      // 非空行且不是 heading → 当作段落内容
      items.push(trimmed);
    }
  }

  return items;
}

// ============================================================================
// 核心解析和生成函数
// ============================================================================

/**
 * 解析 SKILL.md 文件内容为 SkillStandard 对象
 *
 * @param content - SKILL.md 文件完整内容
 * @returns 解析后的 SkillStandard 对象
 * @throws Error 如果缺少必要的 frontmatter
 */
export function parseSkillMarkdown(content: string): SkillStandard {
  // 提取 YAML frontmatter
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md: missing frontmatter (expected --- delimited block)');
  }

  const frontmatter = parseYAML(frontmatterMatch[1]);
  const body = content.slice(frontmatterMatch[0].length).trim();

  // 验证必填字段
  if (!frontmatter.name) {
    throw new Error('Invalid SKILL.md: missing required field "name" in frontmatter');
  }
  if (!frontmatter.description) {
    throw new Error('Invalid SKILL.md: missing required field "description" in frontmatter');
  }
  if (!frontmatter.version) {
    throw new Error('Invalid SKILL.md: missing required field "version" in frontmatter');
  }

  // 提取 Markdown body 的各个 section
  const instructions = extractSection(body, '## Instructions') ||
    extractSection(body, '## 指令') ||
    body; // 如果没有 Instructions section，则整个 body 作为 instructions

  const examples = extractSectionList(body, '## Examples') ||
    extractSectionList(body, '## 示例');

  const limitations = extractSectionList(body, '## Limitations') ||
    extractSectionList(body, '## 局限性');

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version,
    author: frontmatter.author,
    model_support: frontmatter.model_support as string[] | undefined,
    dependencies: frontmatter.dependencies as string[] | undefined,
    tags: frontmatter.tags as string[] | undefined,
    domain: frontmatter.domain as string | undefined,
    capability: frontmatter.capability as string | undefined,
    instructions,
    examples: examples.length > 0 ? examples : undefined,
    limitations: limitations.length > 0 ? limitations : undefined,
  };
}

/**
 * 生成 SKILL.md 文件内容
 *
 * @param skill - SkillStandard 对象
 * @returns 格式化的 SKILL.md 文件内容字符串
 */
export function generateSkillMarkdown(skill: SkillStandard): string {
  // 生成 frontmatter
  const frontmatterData: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
    version: skill.version,
  };

  // 仅在值存在时添加可选字段
  if (skill.author) frontmatterData.author = skill.author;
  if (skill.model_support && skill.model_support.length > 0) {
    frontmatterData.model_support = skill.model_support;
  }
  if (skill.dependencies && skill.dependencies.length > 0) {
    frontmatterData.dependencies = skill.dependencies;
  }
  if (skill.tags && skill.tags.length > 0) {
    frontmatterData.tags = skill.tags;
  }
  if (skill.domain) frontmatterData.domain = skill.domain;
  if (skill.capability) frontmatterData.capability = skill.capability;

  const frontmatter = dumpYAML(frontmatterData);

  let md = `---\n${frontmatter}\n---\n\n`;

  // Instructions section
  md += `## Instructions\n\n${skill.instructions}\n\n`;

  // Examples section
  if (skill.examples && skill.examples.length > 0) {
    md += `## Examples\n\n`;
    for (const ex of skill.examples) {
      md += `- ${ex}\n`;
    }
    md += '\n';
  }

  // Limitations section
  if (skill.limitations && skill.limitations.length > 0) {
    md += `## Limitations\n\n`;
    for (const lim of skill.limitations) {
      md += `- ${lim}\n`;
    }
    md += '\n';
  }

  return md.trimEnd() + '\n';
}

// ============================================================================
// 验证
// ============================================================================

/**
 * 验证 SkillStandard 对象的完整性
 *
 * @param skill - 待验证的 SkillStandard 对象
 * @returns 验证结果
 */
export function validateSkillStandard(skill: SkillStandard): ParseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必填字段检查
  if (!skill.name) {
    errors.push('Missing required field: name');
  } else if (!/^[a-z][a-z0-9_-]*$/.test(skill.name)) {
    errors.push('Field "name" must be in kebab-case (lowercase, numbers, hyphens, underscores)');
  }

  if (!skill.description) {
    errors.push('Missing required field: description');
  }

  if (!skill.version) {
    errors.push('Missing required field: version');
  } else if (!/^\d+\.\d+\.\d+/.test(skill.version)) {
    warnings.push('Field "version" should follow semver format (e.g., 1.0.0)');
  }

  if (!skill.instructions) {
    errors.push('Missing required field: instructions');
  }

  // 可选字段建议
  if (!skill.model_support || skill.model_support.length === 0) {
    warnings.push('Consider specifying model_support for cross-platform compatibility');
  }

  if (!skill.domain) {
    warnings.push('Consider specifying domain for Capability Bucket indexing');
  }

  if (!skill.capability) {
    warnings.push('Consider specifying capability for Capability Bucket indexing');
  }

  if (!skill.tags || skill.tags.length === 0) {
    warnings.push('Consider adding tags for better discoverability');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证 SKILL.md 文件内容
 *
 * @param content - SKILL.md 文件内容
 * @returns 验证结果
 */
export function validateSkillMarkdown(content: string): ParseValidation {
  try {
    const skill = parseSkillMarkdown(content);
    return validateSkillStandard(skill);
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  }
}
