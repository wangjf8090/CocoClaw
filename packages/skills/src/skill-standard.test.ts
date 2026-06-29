/**
 * SKILL.md 开放标准 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  parseSkillMarkdown,
  generateSkillMarkdown,
  validateSkillStandard,
  validateSkillMarkdown,
  parseYAML,
  dumpYAML,
  extractSection,
  extractSectionList,
  type SkillStandard,
} from './skill-standard.js';

// ============================================================================
// parseYAML
// ============================================================================

describe('parseYAML', () => {
  it('should parse simple key-value pairs', () => {
    const result = parseYAML('name: my-skill\ndescription: A test skill\nversion: 1.0.0');
    expect(result.name).toBe('my-skill');
    expect(result.description).toBe('A test skill');
    expect(result.version).toBe('1.0.0');
  });

  it('should parse arrays', () => {
    const result = parseYAML('tags:\n  - tag1\n  - tag2\n  - tag3');
    expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should parse boolean values', () => {
    const result = parseYAML('enabled: true\ndisabled: false');
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
  });

  it('should parse numeric values', () => {
    const result = parseYAML('count: 42\nratio: 3.14');
    expect(result.count).toBe(42);
    expect(result.ratio).toBe(3.14);
  });

  it('should handle quoted strings', () => {
    const result = parseYAML('name: "my-skill"\ndesc: \'another desc\'');
    expect(result.name).toBe('my-skill');
    expect(result.desc).toBe('another desc');
  });

  it('should skip comments', () => {
    const result = parseYAML('name: my-skill\n# this is a comment\nversion: 1.0.0');
    expect(result.name).toBe('my-skill');
    expect(result.version).toBe('1.0.0');
  });

  it('should handle empty arrays', () => {
    const result = parseYAML('tags:');
    expect(result.tags).toEqual([]);
  });
});

// ============================================================================
// dumpYAML
// ============================================================================

describe('dumpYAML', () => {
  it('should generate YAML for simple key-value pairs', () => {
    const result = dumpYAML({ name: 'my-skill', version: '1.0.0' });
    expect(result).toContain('name: my-skill');
    expect(result).toContain('version: 1.0.0');
  });

  it('should generate YAML for arrays', () => {
    const result = dumpYAML({ tags: ['tag1', 'tag2'] });
    expect(result).toContain('tags:');
    expect(result).toContain('  - tag1');
    expect(result).toContain('  - tag2');
  });

  it('should skip undefined and null values', () => {
    const result = dumpYAML({ name: 'test', author: undefined, count: null as any });
    expect(result).not.toContain('author');
    expect(result).not.toContain('count');
  });

  it('should skip empty arrays', () => {
    const result = dumpYAML({ name: 'test', tags: [] });
    expect(result).not.toContain('tags');
  });

  it('should quote strings with special characters', () => {
    const result = dumpYAML({ description: 'has: special# chars' });
    expect(result).toContain('"has: special# chars"');
  });
});

// ============================================================================
// extractSection / extractSectionList
// ============================================================================

describe('extractSection', () => {
  const body = `## Instructions

Do this and that.

## Examples

- Example 1
- Example 2

## Limitations

- Limitation 1
- Limitation 2`;

  it('should extract Instructions section', () => {
    const result = extractSection(body, '## Instructions');
    expect(result).toContain('Do this and that');
    expect(result).not.toContain('Example');
  });

  it('should extract Examples section', () => {
    const result = extractSection(body, '## Examples');
    expect(result).toContain('Example 1');
    expect(result).toContain('Example 2');
  });

  it('should return empty string for missing section', () => {
    const result = extractSection(body, '## NonExistent');
    expect(result).toBe('');
  });
});

describe('extractSectionList', () => {
  const body = `## Examples

- Example 1
- Example 2
- Example 3`;

  it('should extract list items', () => {
    const result = extractSectionList(body, '## Examples');
    expect(result).toEqual(['Example 1', 'Example 2', 'Example 3']);
  });

  it('should return empty array for missing section', () => {
    const result = extractSectionList(body, '## NonExistent');
    expect(result).toEqual([]);
  });
});

// ============================================================================
// parseSkillMarkdown
// ============================================================================

describe('parseSkillMarkdown', () => {
  const validSkillMd = `---
name: news-aggregator
description: 全网科技/金融/AI深度新闻聚合
version: 1.0.0
author: SelfClaw
model_support:
  - gpt-4o
  - claude-3.7-sonnet
tags:
  - news
  - aggregation
  - daily
domain: data
capability: data-query
---

## Instructions

This skill aggregates news from multiple sources.
Use the fetch_news function to get articles.

## Examples

- Fetch tech news from Hacker News
- Generate daily briefing report

## Limitations

- Rate limited to 100 requests per hour
- Some sources may require authentication`;

  it('should parse a valid SKILL.md', () => {
    const result = parseSkillMarkdown(validSkillMd);
    expect(result.name).toBe('news-aggregator');
    expect(result.description).toBe('全网科技/金融/AI深度新闻聚合');
    expect(result.version).toBe('1.0.0');
    expect(result.author).toBe('SelfClaw');
    expect(result.model_support).toEqual(['gpt-4o', 'claude-3.7-sonnet']);
    expect(result.tags).toEqual(['news', 'aggregation', 'daily']);
    expect(result.domain).toBe('data');
    expect(result.capability).toBe('data-query');
  });

  it('should parse Instructions section', () => {
    const result = parseSkillMarkdown(validSkillMd);
    expect(result.instructions).toContain('aggregates news from multiple sources');
  });

  it('should parse Examples section as list', () => {
    const result = parseSkillMarkdown(validSkillMd);
    expect(result.examples).toBeDefined();
    expect(result.examples!.length).toBe(2);
    expect(result.examples).toContain('Fetch tech news from Hacker News');
  });

  it('should parse Limitations section as list', () => {
    const result = parseSkillMarkdown(validSkillMd);
    expect(result.limitations).toBeDefined();
    expect(result.limitations!.length).toBe(2);
  });

  it('should throw for missing frontmatter', () => {
    expect(() => parseSkillMarkdown('No frontmatter here')).toThrow('missing frontmatter');
  });

  it('should throw for missing name', () => {
    const md = `---\ndescription: test\nversion: 1.0.0\n---\n\n## Instructions\nDo something`;
    expect(() => parseSkillMarkdown(md)).toThrow('missing required field "name"');
  });

  it('should throw for missing description', () => {
    const md = `---\nname: test\nversion: 1.0.0\n---\n\n## Instructions\nDo something`;
    expect(() => parseSkillMarkdown(md)).toThrow('missing required field "description"');
  });

  it('should throw for missing version', () => {
    const md = `---\nname: test\ndescription: test\n---\n\n## Instructions\nDo something`;
    expect(() => parseSkillMarkdown(md)).toThrow('missing required field "version"');
  });

  it('should use full body as instructions when no Instructions section', () => {
    const md = `---\nname: test\ndescription: test\nversion: 1.0.0\n---\n\nJust do it`;
    const result = parseSkillMarkdown(md);
    expect(result.instructions).toContain('Just do it');
  });
});

// ============================================================================
// generateSkillMarkdown
// ============================================================================

describe('generateSkillMarkdown', () => {
  const skill: SkillStandard = {
    name: 'test-skill',
    description: 'A test skill',
    version: '1.0.0',
    author: 'Test Author',
    model_support: ['gpt-4o', 'claude-3.7-sonnet'],
    tags: ['test', 'demo'],
    domain: 'browser',
    capability: 'web-automation',
    instructions: 'Do something useful',
    examples: ['Example 1', 'Example 2'],
    limitations: ['Limit 1', 'Limit 2'],
  };

  it('should generate valid SKILL.md content', () => {
    const result = generateSkillMarkdown(skill);
    expect(result).toContain('---');
    expect(result).toContain('name: test-skill');
    expect(result).toContain('description: A test skill');
    expect(result).toContain('version: 1.0.0');
    expect(result).toContain('## Instructions');
    expect(result).toContain('Do something useful');
    expect(result).toContain('## Examples');
    expect(result).toContain('- Example 1');
    expect(result).toContain('## Limitations');
    expect(result).toContain('- Limit 1');
  });

  it('should skip optional fields when undefined', () => {
    const minimal: SkillStandard = {
      name: 'minimal',
      description: 'Minimal skill',
      version: '0.1.0',
      instructions: 'Do it',
    };
    const result = generateSkillMarkdown(minimal);
    expect(result).toContain('name: minimal');
    expect(result).not.toContain('## Examples');
    expect(result).not.toContain('## Limitations');
  });

  it('should be parseable by parseSkillMarkdown (round-trip)', () => {
    const generated = generateSkillMarkdown(skill);
    const parsed = parseSkillMarkdown(generated);
    expect(parsed.name).toBe(skill.name);
    expect(parsed.description).toBe(skill.description);
    expect(parsed.version).toBe(skill.version);
    expect(parsed.instructions).toContain('Do something useful');
  });
});

// ============================================================================
// validateSkillStandard
// ============================================================================

describe('validateSkillStandard', () => {
  it('should validate a complete skill standard', () => {
    const skill: SkillStandard = {
      name: 'my-skill',
      description: 'A skill',
      version: '1.0.0',
      model_support: ['gpt-4o'],
      domain: 'browser',
      capability: 'web-automation',
      tags: ['test'],
      instructions: 'Do something',
    };
    const result = validateSkillStandard(skill);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report error for missing name', () => {
    const skill = { name: '', description: 'A skill', version: '1.0.0', instructions: 'Do it' } as SkillStandard;
    const result = validateSkillStandard(skill);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: name');
  });

  it('should report error for invalid name format', () => {
    const skill = { name: 'Invalid Name!', description: 'A skill', version: '1.0.0', instructions: 'Do it' } as SkillStandard;
    const result = validateSkillStandard(skill);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('kebab-case'))).toBe(true);
  });

  it('should warn about missing optional fields', () => {
    const skill: SkillStandard = {
      name: 'my-skill',
      description: 'A skill',
      version: '1.0.0',
      instructions: 'Do it',
    };
    const result = validateSkillStandard(skill);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('model_support'))).toBe(true);
    expect(result.warnings.some(w => w.includes('domain'))).toBe(true);
  });

  it('should warn about non-semver version', () => {
    const skill = { name: 'test', description: 'A skill', version: 'v1', instructions: 'Do it' } as SkillStandard;
    const result = validateSkillStandard(skill);
    expect(result.warnings.some(w => w.includes('semver'))).toBe(true);
  });
});

// ============================================================================
// validateSkillMarkdown
// ============================================================================

describe('validateSkillMarkdown', () => {
  it('should validate valid SKILL.md content', () => {
    const content = `---\nname: test\ndescription: A test\nversion: 1.0.0\n---\n\n## Instructions\nDo it`;
    const result = validateSkillMarkdown(content);
    expect(result.valid).toBe(true);
  });

  it('should report error for invalid content', () => {
    const result = validateSkillMarkdown('Not a valid SKILL.md');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
