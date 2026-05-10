/**
 * Dual Mode Architecture Test Suite
 * 
 * Tests for both authentication modes:
 * - Native API Mode (app_id + app_secret)
 * - Lark CLI Mode (lark-cli tool)
 * 
 * Usage: node test-dual-mode.js
 */

const { createSender, AUTH_MODES } = require('./sender-factory');

console.log('========================================');
console.log('Feishu Adapter - Dual Mode Test Suite');
console.log('========================================\n');

async function testModeSwitching() {
  console.log('Test 1: Mode Switching');
  console.log('-----------------------');
  
  try {
    // Test Native mode creation
    console.log('[1/3] Creating Native API mode sender...');
    const nativeSender = createSender({
      authMode: AUTH_MODES.NATIVE,
      appId: 'cli_test_app_id',
      appSecret: 'test_app_secret'
    });
    console.log(`      ✓ Native mode created: mode=${nativeSender.mode}`);
    
    // Test CLI mode creation
    console.log('[2/3] Creating Lark CLI mode sender...');
    const cliSender = createSender({
      authMode: AUTH_MODES.CLI,
      cliPath: 'lark-cli'
    });
    console.log(`      ✓ CLI mode created: mode=${cliSender.mode}`);
    
    // Test default mode (should be native)
    console.log('[3/3] Creating default mode sender...');
    const defaultSender = createSender({
      appId: 'cli_test_app_id',
      appSecret: 'test_app_secret'
    });
    console.log(`      ✓ Default mode created: mode=${defaultSender.mode}`);
    
    console.log('      ✓ Mode switching test passed!\n');
    return true;
  } catch (error) {
    console.log(`      ✗ Mode switching test failed: ${error.message}\n`);
    return false;
  }
}

async function testUnifiedInterface() {
  console.log('Test 2: Unified Interface Check');
  console.log('--------------------------------');
  
  try {
    const nativeSender = createSender({ authMode: AUTH_MODES.NATIVE });
    const cliSender = createSender({ authMode: AUTH_MODES.CLI });
    
    const requiredMethods = [
      'send', 'reply', 'sendMarkdown', 
      'sendCard', 'sendImage', 'sendTyping',
      'batchSend', 'healthCheck'
    ];
    
    let allNativeMethodsExist = true;
    let allCliMethodsExist = true;
    
    for (const method of requiredMethods) {
      if (typeof nativeSender[method] !== 'function') {
        allNativeMethodsExist = false;
        console.log(`      ✗ Native sender missing method: ${method}`);
      }
      if (typeof cliSender[method] !== 'function') {
        allCliMethodsExist = false;
        console.log(`      ✗ CLI sender missing method: ${method}`);
      }
    }
    
    if (allNativeMethodsExist && allCliMethodsExist) {
      console.log(`      ✓ Both senders have all required methods`);
      console.log('      ✓ Unified interface test passed!\n');
      return true;
    } else {
      console.log('      ✗ Unified interface test failed!\n');
      return false;
    }
  } catch (error) {
    console.log(`      ✗ Unified interface test failed: ${error.message}\n`);
    return false;
  }
}

async function testDryRun() {
  console.log('Test 3: Dry Run Mode Test');
  console.log('--------------------------');
  
  try {
    const nativeSender = createSender({ authMode: AUTH_MODES.NATIVE });
    const cliSender = createSender({ authMode: AUTH_MODES.CLI });
    
    console.log('[1/2] Testing Native mode dry run...');
    const nativeResult = await nativeSender.send('oc_test_chat_id', 'Test message', { dryRun: true });
    console.log(`      ✓ Native dry run: status=${nativeResult.status}, mode=${nativeResult.mode}`);
    
    console.log('[2/2] Testing CLI mode dry run...');
    const cliResult = await cliSender.send('oc_test_chat_id', 'Test message', { dryRun: true });
    console.log(`      ✓ CLI dry run: status=${cliResult.status}, mode=${cliResult.mode}`);
    
    console.log('      ✓ Dry run test passed!\n');
    return true;
  } catch (error) {
    console.log(`      ✗ Dry run test failed: ${error.message}\n`);
    return false;
  }
}

async function testContentBuilding() {
  console.log('Test 4: Content Building Test');
  console.log('------------------------------');
  
  try {
    const nativeSender = createSender({ authMode: AUTH_MODES.NATIVE });
    
    const testCases = [
      { type: 'text', content: 'Hello World' },
      { type: 'interactive', content: { config: { wide_screen_mode: true }, elements: [] } },
      { type: 'post', content: 'Rich text content' },
      { type: 'image', content: 'img_xxxxxx' }
    ];
    
    for (const testCase of testCases) {
      const result = nativeSender.apiClient.buildContent(testCase.content, testCase.type);
      const parsed = JSON.parse(result);
      console.log(`      ✓ ${testCase.type} content built successfully`);
    }
    
    console.log('      ✓ Content building test passed!\n');
    return true;
  } catch (error) {
    console.log(`      ✗ Content building test failed: ${error.message}\n`);
    return false;
  }
}

async function testCompatibilityLayer() {
  console.log('Test 5: Backward Compatibility Test');
  console.log('------------------------------------');
  
  try {
    const { MessageSender } = require('./sender');
    
    console.log('[1/2] Testing MessageSender compatibility (default mode)...');
    const sender1 = new MessageSender();
    console.log(`      ✓ Legacy MessageSender works: mode=${sender1.mode}`);
    
    console.log('[2/2] Testing MessageSender with explicit config...');
    const sender2 = new MessageSender({
      authMode: AUTH_MODES.NATIVE,
      appId: 'cli_test'
    });
    console.log(`      ✓ Legacy MessageSender with config works: mode=${sender2.mode}`);
    
    console.log('      ✓ Backward compatibility test passed!\n');
    return true;
  } catch (error) {
    console.log(`      ✗ Backward compatibility test failed: ${error.message}\n`);
    return false;
  }
}

async function testBatchOperations() {
  console.log('Test 6: Batch Operations Test');
  console.log('------------------------------');
  
  try {
    const nativeSender = createSender({ authMode: AUTH_MODES.NATIVE });
    
    const chatIds = ['oc_chat1', 'oc_chat2', 'oc_chat3'];
    const results = await nativeSender.batchSend(chatIds, 'Test message', { dryRun: true });
    
    console.log(`      ✓ Batch send completed: ${results.length} messages`);
    
    for (const result of results) {
      console.log(`        - ${result.chatId}: success=${result.success}`);
    }
    
    console.log('      ✓ Batch operations test passed!\n');
    return true;
  } catch (error) {
    console.log(`      ✗ Batch operations test failed: ${error.message}\n`);
    return false;
  }
}

async function runAllTests() {
  const results = [];
  
  results.push(await testModeSwitching());
  results.push(await testUnifiedInterface());
  results.push(await testDryRun());
  results.push(await testContentBuilding());
  results.push(await testCompatibilityLayer());
  results.push(await testBatchOperations());
  
  console.log('========================================');
  console.log('Test Summary');
  console.log('========================================');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);
  
  console.log(`Total: ${total} tests`);
  console.log(`Passed: ${passed} tests`);
  console.log(`Failed: ${total - passed} tests`);
  console.log(`Success rate: ${percentage}%`);
  console.log('========================================');
  
  if (passed === total) {
    console.log('\n✓ All tests passed! Dual mode architecture is working correctly.\n');
  } else {
    console.log('\n✗ Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch(console.error);
