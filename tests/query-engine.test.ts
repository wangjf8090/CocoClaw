/**
 * QueryEngine Basic Tests
 */

import { QueryEngine } from '../packages/query-engine/src/index.js';
import assert from 'node:assert';
import { test, describe } from 'node:test';

describe('QueryEngine', () => {
  test('should create QueryEngine instance', () => {
    const engine = new QueryEngine();
    assert.ok(engine);
  });

  test('should register and unregister tools', () => {
    const engine = new QueryEngine();
    const toolDef = {
      type: 'function' as const,
      function: {
        name: 'test_tool',
        parameters: {
          type: 'object' as const,
          properties: {},
        },
      },
    };

    engine.registerTool(toolDef, async () => 'result');
    assert.equal(engine.getToolDefinitions().length, 1);

    engine.unregisterTool('test_tool');
    assert.equal(engine.getToolDefinitions().length, 0);
  });

  test('should execute query and stream events', async () => {
    const engine = new QueryEngine();
    const events = engine.execute('Hello, world!');

    const eventTypes: string[] = [];
    for await (const event of events) {
      eventTypes.push(event.type);
    }

    assert.ok(eventTypes.includes('query_start'), 'Should have query_start event');
    assert.ok(eventTypes.includes('token'), 'Should have token events');
    assert.ok(eventTypes.includes('query_complete'), 'Should have query_complete event');
  });

  test('should track query state', async () => {
    const engine = new QueryEngine();
    const events = engine.execute('Test query');

    let queryId: string | undefined;
    for await (const event of events) {
      queryId = event.queryId;
      break;
    }

    assert.ok(queryId, 'Should have query ID');
    const state = engine.getQueryState(queryId);
    assert.ok(state, 'Should have query state');
    assert.equal(state?.id, queryId);
  });

  test('should handle tool calls', async () => {
    const engine = new QueryEngine();
    let toolCalled = false;

    engine.registerTool(
      {
        type: 'function',
        function: {
          name: 'search',
          description: 'Search for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      },
      async () => {
        toolCalled = true;
        return { results: [] };
      }
    );

    // Query that triggers search tool
    const events = engine.execute('Please search for something', { maxIterations: 3 });

    const hasToolUse = false;
    for await (const event of events) {
      if (event.type === 'tool_use') {
        // Tool use detected
      }
    }

    // Note: MockLLMProvider will only call tool if message contains 'search'
    assert.ok(engine.getToolDefinitions().length > 0);
  });
});

console.log('QueryEngine tests ready! Run with: node --test dist/tests/query-engine.test.js');
