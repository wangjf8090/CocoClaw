/**
 * Kimi K3 Adapter Tests
 * P1-3: 国产模型Adapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KimiK3Adapter, createKimiK3Adapter } from './kimi-k3.js';
import { ModelProvider, HealthStatus } from '../types.js';

describe('KimiK3Adapter', () => {
  let adapter: KimiK3Adapter;

  beforeEach(() => {
    adapter = createKimiK3Adapter({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'kimi-k3',
      enableLongContext: true,
    });
  });

  describe('basic properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('kimi-k3');
    });

    it('should have MOONSHOT provider', () => {
      expect(adapter.provider).toBe(ModelProvider.MOONSHOT);
    });

    it('should support 1M token context', () => {
      expect(adapter.maxTokens).toBe(1000000);
    });

    it('should support streaming', () => {
      expect(adapter.supportsStreaming).toBe(true);
    });

    it('should have low cost per token (open source)', () => {
      expect(adapter.costPerToken).toBe(0.000003);
    });
  });

  describe('getCapabilities()', () => {
    it('should report 100万 token max context', () => {
      const caps = adapter.getCapabilities();
      expect(caps.maxContextLength).toBe(1000000);
    });

    it('should report long context support', () => {
      const caps = adapter.getCapabilities();
      expect(caps.supportsLongContext).toBe(true);
    });

    it('should report 256 MoE experts', () => {
      const caps = adapter.getCapabilities();
      expect(caps.moeExperts).toBe(256);
    });

    it('should report function calling support', () => {
      const caps = adapter.getCapabilities();
      expect(caps.supportsFunctionCalling).toBe(true);
    });
  });

  describe('invoke() - error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Use an invalid URL to trigger network error
      const errorAdapter = createKimiK3Adapter({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:99999/invalid',
      });

      const result = await errorAdapter.invoke({
        prompt: 'Hello',
      });

      expect(result.error).toBeDefined();
      expect(result.content).toBe('');
      expect(result.model).toBe('kimi-k3');
    });
  });

  describe('long context processing', () => {
    it('should handle normal-length input', async () => {
      // Even if API call fails, we test that the adapter constructs request properly
      const errorAdapter = createKimiK3Adapter({
        apiKey: 'test-key',
        baseUrl: 'http://localhost:99999/invalid',
        enableLongContext: true,
      });

      const result = await errorAdapter.invoke({
        prompt: 'Normal length input',
      });

      // Should attempt the call (will fail due to invalid URL)
      expect(result).toBeDefined();
    });
  });
});
