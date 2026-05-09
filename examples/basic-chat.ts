/**
 * SelfClaw Basic Chat Example
 * 基础聊天示例
 *
 * Demonstrates:
 * - Full system integration (Query + Memory + Security + Tools)
 * - Self-Evolution Harness auto-context injection
 * - Real-time evolution monitoring
 */

import { QueryEngine } from '@selfclaw/query-engine';
import { MemoryManager } from '@selfclaw/memory';
import { SecurityManager } from '@selfclaw/security';
import { createToolRegistry } from '@selfclaw/tools';
import { createSelfEvolutionHarness } from '@selfclaw/harness';
import * as readline from 'readline';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              SelfClaw - Self-Evolution Chat                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // =====================================================
  // Step 1: Initialize all core components
  // =====================================================
  console.log('[1/5] Initializing Query Engine...');
  const queryEngine = new QueryEngine();

  console.log('[2/5] Initializing Memory Manager...');
  const memoryManager = new MemoryManager();
  await memoryManager.initialize();

  // Add some sample memories
  await memoryManager.createMemory(
    'The user likes to work with TypeScript and Node.js',
    'fact',
    'user_input',
    {},
    80
  );
  await memoryManager.createMemory(
    'The user is building an AI assistant framework',
    'fact',
    'user_input',
    {},
    90
  );

  console.log('[3/5] Initializing Security Manager...');
  const securityManager = new SecurityManager();
  await securityManager.initialize();

  console.log('[4/5] Initializing Tool Registry...');
  const toolRegistry = createToolRegistry();

  // Register some basic tools
  console.log('  - Registered tools:', Array.from(toolRegistry.getDefinitions()).map(t => t.name).join(', '));

  // =====================================================
  // Step 2: Initialize Self-Evolution Harness
  // =====================================================
  console.log('[5/5] Initializing Self-Evolution Harness...');
  const harness = createSelfEvolutionHarness(
    queryEngine,
    memoryManager,
    securityManager,
    toolRegistry,
    {
      autoApplyChanges: true,
      evolutionCycleInterval: 30000, // 30 seconds for demo
    }
  );
  await harness.initialize();

  console.log('');
  console.log('✅ System initialization complete!');
  console.log('');

  // =====================================================
  // Step 3: Monitor evolution events
  // =====================================================
  harness.on('evolution_cycle', (event) => {
    if (event.data.status === 'completed') {
      console.log('');
      console.log('🔄 [EVOLUTION] Cycle completed:', event.data.totalChanges, 'changes');
      console.log('');
    }
  });

  harness.on('evolution_change', (event) => {
    console.log(`🔬 [EVOLUTION] ${event.data.circuit}: Change detected`);
    console.log(`   Reason: ${(event.data.change as { reason: string }).reason}`);
    console.log(`   Confidence: ${((event.data.change as { confidence: number }).confidence * 100).toFixed(1)}%`);
  });

  // =====================================================
  // Step 4: Interactive chat loop
  // =====================================================
  console.log('═'.repeat(60));
  console.log('💬 Chat with SelfClaw (type "exit" to quit)');
  console.log('═'.repeat(60));
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const chat = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('');
        console.log('Shutting down...');

        // Print final stats
        const stats = harness.getStats();
        console.log('');
        console.log('📊 Final Evolution Stats:');
        console.log(`   Version: ${stats.version}`);
        console.log(`   Rollback Points: ${stats.rollbackPoints}`);
        console.log(`   Permission Patterns: ${stats.permissionPatterns}`);
        console.log(`   Context Window: ${stats.performanceSettings.contextWindowSize} tokens`);
        console.log(`   Cache Size: ${stats.performanceSettings.cacheSize}`);

        harness.shutdown();
        rl.close();
        return;
      }

      if (input.trim() === 'stats') {
        const stats = harness.getStats();
        console.log('');
        console.log('📊 Current Stats:');
        console.log(`   Version: ${stats.version}`);
        console.log(`   Rollback Points: ${stats.rollbackPoints}`);
        console.log(`   Active A/B Tests: ${stats.activeTests}`);
        console.log(`   Permission Patterns: ${stats.permissionPatterns}`);
        console.log(`   Context Window: ${stats.performanceSettings.contextWindowSize} tokens`);
        console.log(`   Cache Size: ${stats.performanceSettings.cacheSize}`);
        console.log(`   Search Quality (efSearch): ${stats.indexParams.efSearch}`);
        console.log('');
        chat();
        return;
      }

      if (input.trim() === 'evolve') {
        console.log('');
        console.log('🔄 Triggering manual evolution cycle...');
        const results = await harness.runEvolutionCycle();
        console.log('');
        for (const result of results) {
          console.log(`   ${result.circuit}: ${result.changes.length} changes`);
          for (const change of result.changes) {
            console.log(`     - ${change.target}: ${change.oldValue} -> ${change.newValue}`);
            console.log(`       Reason: ${change.reason}`);
          }
        }
        console.log('');
        chat();
        return;
      }

      console.log('');
      console.log('🤖 SelfClaw is thinking...');

      try {
        // Execute through harness (auto-injects memory context)
        let response = '';
        for await (const event of harness.execute(input, { stream: false })) {
          if (event.data.result) {
            response = event.data.result as string;
          }
        }

        console.log('');
        console.log('SelfClaw:', response);
        console.log('');

        // Record interaction to memory
        await memoryManager.createMemory(
          `User asked: "${input}"\nAssistant answered: "${response}"`,
          'conversation',
          'chat',
          {},
          50
        );

      } catch (error) {
        console.error('Error:', (error as Error).message);
      }

      chat();
    });
  };

  chat();
}

main().catch(console.error);
