/**
 * Capability Bucket 索引 - 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  CapabilityIndex,
  DOMAIN_KEYWORDS,
  CAPABILITY_KEYWORDS,
} from './capability-bucket.js';
import type { SkillStandard } from './skill-standard.js';

// ============================================================================
// 基础注册与查询
// ============================================================================

describe('CapabilityIndex - Registration', () => {
  it('should register a skill to a domain and capability', () => {
    const index = new CapabilityIndex();
    index.register('news-aggregator', 'data', 'data-query');

    const skills = index.query('data', 'data-query');
    expect(skills).toContain('news-aggregator');
  });

  it('should register multiple skills to the same capability', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'web-automation');

    const skills = index.query('browser', 'web-automation');
    expect(skills).toContain('skill-a');
    expect(skills).toContain('skill-b');
  });

  it('should register a skill to different capabilities in the same domain', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'data-extraction');

    const webSkills = index.query('browser', 'web-automation');
    const dataSkills = index.query('browser', 'data-extraction');
    expect(webSkills).toContain('skill-a');
    expect(dataSkills).toContain('skill-b');
  });

  it('should return all skills in a domain when capability is omitted', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'data-extraction');

    const all = index.query('browser');
    expect(all).toContain('skill-a');
    expect(all).toContain('skill-b');
  });

  it('should return empty array for non-existent domain', () => {
    const index = new CapabilityIndex();
    const skills = index.query('nonexistent');
    expect(skills).toEqual([]);
  });

  it('should return empty array for non-existent capability', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    const skills = index.query('browser', 'nonexistent');
    expect(skills).toEqual([]);
  });
});

// ============================================================================
// 批量注册
// ============================================================================

describe('CapabilityIndex - Batch Registration', () => {
  it('should register batch of skills', () => {
    const index = new CapabilityIndex();
    index.registerBatch([
      { skillName: 'skill-a', domain: 'browser', capability: 'web-automation' },
      { skillName: 'skill-b', domain: 'data', capability: 'data-query' },
      { skillName: 'skill-c', domain: 'medical', capability: 'health-consultation' },
    ]);

    expect(index.size).toBe(3);
    expect(index.query('browser')).toContain('skill-a');
    expect(index.query('data')).toContain('skill-b');
    expect(index.query('medical')).toContain('skill-c');
  });
});

// ============================================================================
// 从 SkillStandard 注册
// ============================================================================

describe('CapabilityIndex - Register from SkillStandard', () => {
  it('should register from SkillStandard with domain and capability', () => {
    const index = new CapabilityIndex();
    const skill: SkillStandard = {
      name: 'news-aggregator',
      description: 'News aggregation tool',
      version: '1.0.0',
      domain: 'data',
      capability: 'data-query',
      instructions: 'Aggregate news',
    };

    index.registerFromStandard(skill);
    expect(index.query('data', 'data-query')).toContain('news-aggregator');
  });

  it('should infer domain from description when domain is missing', () => {
    const index = new CapabilityIndex();
    const skill: SkillStandard = {
      name: 'medical-advisor',
      description: 'Medical health consultation advisor',
      version: '1.0.0',
      instructions: 'Provide medical advice',
    };

    index.registerFromStandard(skill);
    const stats = index.getStats();
    expect(stats.domainCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// 注销
// ============================================================================

describe('CapabilityIndex - Unregister', () => {
  it('should unregister a skill', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');

    const result = index.unregister('skill-a');
    expect(result).toBe(true);
    expect(index.query('browser', 'web-automation')).toEqual([]);
    expect(index.size).toBe(0);
  });

  it('should return false for non-existent skill', () => {
    const index = new CapabilityIndex();
    const result = index.unregister('nonexistent');
    expect(result).toBe(false);
  });

  it('should clean up empty buckets after unregister', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.unregister('skill-a');

    const domains = index.getDomains();
    expect(domains).not.toContain('browser');
  });
});

// ============================================================================
// 智能匹配
// ============================================================================

describe('CapabilityIndex - Smart Match', () => {
  it('should match skills based on description keywords', () => {
    const index = new CapabilityIndex();
    index.register('web-scraper', 'browser', 'data-extraction');
    index.register('news-fetcher', 'data', 'data-query');

    const results = index.smartMatch('browser automation and web scraping');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.skillNames.includes('web-scraper'))).toBe(true);
  });

  it('should match medical skills', () => {
    const index = new CapabilityIndex();
    index.register('medical-advisor', 'medical', 'health-consultation');

    const results = index.smartMatch('医疗健康咨询');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.matchedDomain === 'medical')).toBe(true);
  });

  it('should return empty results for no match', () => {
    const index = new CapabilityIndex();
    const results = index.smartMatch('完全无关的查询xyz');
    expect(results).toEqual([]);
  });

  it('should rank results by confidence', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'data', 'data-query');

    const results = index.smartMatch('browser web automation');
    if (results.length > 1) {
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    }
  });
});

// ============================================================================
// 查询选项
// ============================================================================

describe('CapabilityIndex - Query Options', () => {
  it('should limit result count', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'web-automation');
    index.register('skill-c', 'browser', 'web-automation');

    const skills = index.query('browser', undefined, { limit: 2 });
    expect(skills.length).toBe(2);
  });

  it('should support fuzzy domain matching', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');

    const skills = index.query('brows', undefined, { exactDomain: false });
    expect(skills).toContain('skill-a');
  });
});

// ============================================================================
// 统计信息
// ============================================================================

describe('CapabilityIndex - Stats', () => {
  it('should compute correct stats', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'data-extraction');
    index.register('skill-c', 'medical', 'health-consultation');

    const stats = index.getStats();
    expect(stats.domainCount).toBe(2);
    expect(stats.totalSkills).toBe(3);
    expect(stats.totalCapabilities).toBe(3);
  });

  it('should return domain details', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'browser', 'data-extraction');

    const stats = index.getStats();
    const browserDomain = stats.domains.find(d => d.domain === 'browser');
    expect(browserDomain).toBeDefined();
    expect(browserDomain!.capabilityCount).toBe(2);
    expect(browserDomain!.skillCount).toBe(2);
  });
});

// ============================================================================
// 推断方法
// ============================================================================

describe('CapabilityIndex - Inference', () => {
  it('should infer domain from description', () => {
    const index = new CapabilityIndex();
    expect(index.inferDomain('Web browser automation')).toBe('browser');
    expect(index.inferDomain('Medical diagnosis tool')).toBe('medical');
    expect(index.inferDomain('Stock market analysis')).toBe('financial');
  });

  it('should return "general" for unrecognized descriptions', () => {
    const index = new CapabilityIndex();
    expect(index.inferDomain('Something completely unknown xyz')).toBe('general');
  });

  it('should infer capability from description', () => {
    const index = new CapabilityIndex();
    expect(index.inferCapability('Web browser automation')).toBe('web-automation');
    expect(index.inferCapability('Data query and search')).toBe('data-query');
  });
});

// ============================================================================
// 清空
// ============================================================================

describe('CapabilityIndex - Clear', () => {
  it('should clear all registrations', () => {
    const index = new CapabilityIndex();
    index.register('skill-a', 'browser', 'web-automation');
    index.register('skill-b', 'medical', 'health-consultation');

    index.clear();
    expect(index.size).toBe(0);
    expect(index.getDomains()).toEqual([]);
  });
});

// ============================================================================
// 预设关键词验证
// ============================================================================

describe('CapabilityIndex - Preset Keywords', () => {
  it('should have DOMAIN_KEYWORDS for all expected domains', () => {
    const expectedDomains = ['browser', 'file', 'api', 'medical', 'financial', 'communication', 'data', 'legal', 'academic', 'content', 'evolution', 'security', 'memory'];
    for (const domain of expectedDomains) {
      expect(DOMAIN_KEYWORDS[domain]).toBeDefined();
      expect(DOMAIN_KEYWORDS[domain].length).toBeGreaterThan(0);
    }
  });

  it('should have CAPABILITY_KEYWORDS for expected capabilities', () => {
    const expectedCaps = ['web-automation', 'data-extraction', 'document-creation', 'health-consultation', 'market-analysis'];
    for (const cap of expectedCaps) {
      expect(CAPABILITY_KEYWORDS[cap]).toBeDefined();
    }
  });
});
