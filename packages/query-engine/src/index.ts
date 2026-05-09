/**
 * SelfClaw QueryEngine Module
 * Streaming generator for LLM interactions
 */

export { QueryEngine } from './query-engine.js';
export { LLMProvider, MockLLMProvider, OpenAICompatibleProvider } from './llm-provider.js';
export * from './types.js';

import { QueryEngine } from './query-engine.js';
import { MockLLMProvider } from './llm-provider.js';

/**
 * Create a QueryEngine instance
 */
export function createQueryEngine(): QueryEngine {
  return new QueryEngine(new MockLLMProvider());
}

// Example usage if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new QueryEngine();

  // Register an example tool
  engine.registerTool(
    {
      type: 'function',
      function: {
        name: 'search',
        description: 'Search the web for information',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    },
    async (toolCall) => {
      console.log('Executing search:', toolCall.arguments.query);
      return { results: ['Mock search result 1', 'Mock search result 2'] };
    }
  );

  // Example: execute a query
  (async () => {
    console.log('Starting QueryEngine example...');
    const events = engine.execute('Hello, how are you?');

    for await (const event of events) {
      if (event.type === 'token') {
        process.stdout.write(event.data.token as string);
      } else if (event.type === 'query_complete') {
        console.log('\nQuery complete!');
      } else {
        console.log('\nEvent:', event.type, event.data);
      }
    }
  })().catch(console.error);
}
