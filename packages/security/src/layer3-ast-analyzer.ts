/**
 * Layer 3: Tree-sitter AST Analysis
 * 第3层：Tree-sitter AST分析
 * 
 * - JavaScript/TypeScript解析
 * - 危险模式检测
 * - 命令语义分析
 * - 风险评分计算
 */

import {
  Operation,
  SecurityDecision,
  AstAnalysisResult,
  SecurityLevel,
  SECURITY_LEVEL_SCORES,
} from './types.js';

/**
 * 简化的AST分析器（不依赖tree-sitter）
 * 实际生产环境应使用web-tree-sitter
 */
export class AstAnalyzerLayer {
  private initialized = false;

  constructor() {
    this.initialized = true;
  }

  /**
   * 初始化Tree-sitter
   */
  async initialize(): Promise<void> {
    // 实际项目中初始化tree-sitter
    // import Parser from 'web-tree-sitter';
    // await Parser.init();
    // const parser = new Parser();
    // const JavaScript = await Parser.Language.load('tree-sitter-javascript.wasm');
    // parser.setLanguage(JavaScript);
    this.initialized = true;
  }

  /**
   * 分析代码中的危险模式
   */
  analyze(code: string, language: 'javascript' | 'typescript' = 'typescript'): AstAnalysisResult {
    const details = {
      hasEval: false,
      hasChildProcess: false,
      hasFsAccess: false,
      hasNetworkAccess: false,
      hasProcessAccess: false,
      hasEnvAccess: false,
      hasUnsafeImports: false,
      suspiciousPatterns: [] as string[],
    };

    const dangerPatterns: string[] = [];
    let score = 0;

    // 1. 检查eval
    if (/eval\s*\(/.test(code)) {
      details.hasEval = true;
      dangerPatterns.push('使用了eval函数');
      score += 30;
    }

    // 2. 检查Function构造器
    if (/new\s+Function\s*\(/.test(code)) {
      dangerPatterns.push('使用了Function构造器');
      score += 25;
    }

    // 3. 检查child_process
    if (/child_process|require\s*\(\s*['"]child_process['"]|exec\s*\(|execSync\s*\(/.test(code)) {
      details.hasChildProcess = true;
      dangerPatterns.push('使用了child_process模块');
      score += 35;
    }

    // 4. 检查fs模块
    if (/require\s*\(\s*['"]fs['"]|import.*fs\s+from/.test(code)) {
      details.hasFsAccess = true;
      dangerPatterns.push('使用了fs模块');
      score += 20;
    }

    // 5. 检查网络模块
    if (/require\s*\(\s*['"](?:net|http|https)['"]|fetch\s*\(|axios|XMLHttpRequest/.test(code)) {
      details.hasNetworkAccess = true;
      dangerPatterns.push('使用了网络模块');
      score += 20;
    }

    // 6. 检查process访问
    if (/process\.(?:exit|chdir|cwd|env|kill|on)/.test(code)) {
      details.hasProcessAccess = true;
      dangerPatterns.push('访问了process对象');
      score += 15;
    }

    // 7. 检查环境变量
    if (/process\.env/.test(code)) {
      details.hasEnvAccess = true;
      dangerPatterns.push('访问了环境变量');
      score += 10;
    }

    // 8. 检查不安全的导入
    const unsafeModules = ['vm', 'worker_threads', 'cluster', 'os', 'sys'];
    for (const mod of unsafeModules) {
      if (new RegExp(`require\\s*\\(\\s*['"]${mod}['"]`).test(code)) {
        details.hasUnsafeImports = true;
        dangerPatterns.push(`导入了可能危险的模块: ${mod}`);
        score += 20;
      }
    }

    // 9. 检查shell命令
    if (/spawn\s*\(|spawnSync\s*\(|fork\s*\(|execFile\s*\(/.test(code)) {
      dangerPatterns.push('使用了进程创建函数');
      score += 30;
    }

    // 10. 检查动态require
    if (/require\s*\(\s*['"]\s*\+/.test(code)) {
      details.suspiciousPatterns.push('动态require可能导致代码注入');
      dangerPatterns.push('动态require可能导致代码注入');
      score += 25;
    }

    // 11. 检查原型污染
    if (/__proto__|Object\.prototype/.test(code)) {
      details.suspiciousPatterns.push('可能的原型污染风险');
      dangerPatterns.push('可能的原型污染风险');
      score += 20;
    }

    // 12. 检查危险正则
    if (/\)\{[^{}]*\+[^{}]*\+[^{}]*\}/.test(code)) {
      details.suspiciousPatterns.push('可能的正则表达式DoS');
      score += 15;
    }

    // 13. 检查无限循环
    if (/while\s*\(\s*true\s*\)|for\s*\(\s*;;\s*\)/.test(code)) {
      details.suspiciousPatterns.push('可能的无限循环');
      score += 15;
    }

    // 14. 检查文件写入
    if (/fs\.(?:writeFile|appendFile|writeFileSync)/.test(code)) {
      dangerPatterns.push('文件写入操作');
      score += 15;
    }

    // 15. 检查删除操作
    if (/fs\.(?:unlink|rmdir|rm)/.test(code)) {
      dangerPatterns.push('文件删除操作');
      score += 25;
    }

    const level = this.determineLevel(score);

    return {
      hasDangerPatterns: dangerPatterns.length > 0,
      dangerPatterns,
      score: Math.min(100, score),
      level,
      details,
    };
  }

  /**
   * 检查操作
   */
  check(operation: Operation): SecurityDecision {
    const content = operation.content || operation.target || '';
    
    // 只对代码执行操作进行分析
    if (operation.type === 'code_execute' || operation.type === 'file_write') {
      const result = this.analyze(content);

      if (result.hasDangerPatterns) {
        return {
          allowed: result.level !== 'critical',
          level: result.level,
          score: result.score,
          reasons: result.dangerPatterns,
          layer: 'ast-analyzer',
          requiresConfirmation: result.level === 'high' || result.level === 'medium',
          blockingLayer: result.level === 'critical' ? 'ast-analyzer' : undefined,
        };
      }
    }

    return {
      allowed: true,
      level: 'safe',
      score: 0,
      reasons: ['AST分析未发现危险模式'],
      layer: 'ast-analyzer',
      requiresConfirmation: false,
    };
  }

  /**
   * 根据分数确定安全级别
   */
  private determineLevel(score: number): SecurityLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    if (score >= 10) return 'low';
    return 'safe';
  }

  /**
   * 获取详细的分析报告
   */
  getAnalysisReport(code: string): string {
    const result = this.analyze(code);
    
    let report = `=== AST分析报告 ===\n\n`;
    report += `风险级别: ${result.level} (分数: ${result.score}/100)\n\n`;
    
    if (result.dangerPatterns.length > 0) {
      report += `发现的危险模式:\n`;
      for (const pattern of result.dangerPatterns) {
        report += `  - ${pattern}\n`;
      }
      report += `\n`;
    }

    report += `详细信息:\n`;
    report += `  - eval: ${result.details.hasEval ? '是' : '否'}\n`;
    report += `  - child_process: ${result.details.hasChildProcess ? '是' : '否'}\n`;
    report += `  - fs访问: ${result.details.hasFsAccess ? '是' : '否'}\n`;
    report += `  - 网络访问: ${result.details.hasNetworkAccess ? '是' : '否'}\n`;
    report += `  - process访问: ${result.details.hasProcessAccess ? '是' : '否'}\n`;
    report += `  - 环境变量访问: ${result.details.hasEnvAccess ? '是' : '否'}\n`;
    report += `  - 不安全导入: ${result.details.hasUnsafeImports ? '是' : '否'}\n`;

    if (result.details.suspiciousPatterns.length > 0) {
      report += `\n可疑模式:\n`;
      for (const pattern of result.details.suspiciousPatterns) {
        report += `  - ${pattern}\n`;
      }
    }

    return report;
  }

  /**
   * 检查是否可以安全执行
   */
  isSafeToExecute(code: string): { safe: boolean; level: SecurityLevel; reasons: string[] } {
    const result = this.analyze(code);
    return {
      safe: result.level === 'safe' || result.level === 'low',
      level: result.level,
      reasons: result.dangerPatterns,
    };
  }
}
