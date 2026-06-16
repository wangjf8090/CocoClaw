/**
 * Vitest 配置
 * 
 * 与 SelfClaw 现有测试框架一致
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 使用 Vitest 默认环境
    environment: "node",
    
    // 覆盖范围配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "vitest.config.ts",
      ],
    },
    
    // 测试超时
    testTimeout: 10000,
    
    // 线程数
    threads: 4,
    
    // 是否在第一个失败时停止
    bail: 0,
    
    // 是否显示内联 diff
    inlineDiffs: false,
    
    // 是否使用 API 文件
    useAtomics: false,
  },
  
  // TypeScript 支持
  esbuild: {
    target: "node18",
  },
});
