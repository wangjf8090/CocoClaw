/**
 * Planner-Worker 分层路由器
 * 
 * 设计灵感来源（2026-07-23行业验证）：
 * 1. Cursor Swarm研究：层级Planner-Worker架构
 *    - 强模型做Planner，廉价模型做Worker
 *    - 成本降约8倍——只有任务分解和关键设计决策需要强模型
 *    - 执行层用便宜模型即可
 * 
 * 2. Cursor 2.4 Subagents：子智能体并行协作
 *    - 独立上下文/工具/模型
 *    - 主对话更聚焦
 * 
 * 3. 微软Harness：planning/memory/approvals/telemetry
 *    - 规划→执行→审计→审批的分层架构
 * 
 * SelfClaw定位：
 * 实现智能任务分解和路由，强模型只做高价值决策，
 * 执行层用廉价模型，实现成本优化。
 */

import { EventEmitter } from 'eventemitter3';

// ==================== 类型定义 ====================

/**
 * 任务复杂度级别
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'critical';

/**
 * 模型层级
 */
export type ModelTier = 'strong' | 'balanced' | 'fast' | 'minimal';

/**
 * 任务分解结果
 */
export interface TaskDecomposition {
  /** 原始任务描述 */
  originalTask: string;
  /** 任务复杂度 */
  complexity: TaskComplexity;
  /** 子任务列表 */
  subtasks: SubTask[];
  /** 执行计划 */
  executionPlan: ExecutionPlan;
  /** 分解时间戳 */
  timestamp: number;
}

/**
 * 子任务
 */
export interface SubTask {
  /** 唯一ID */
  id: string;
  /** 任务描述 */
  description: string;
  /** 依赖的子任务ID列表 */
  dependencies: string[];
  /** 所需模型层级 */
  requiredModelTier: ModelTier;
  /** 所需工具列表 */
  requiredTools: string[];
  /** 预估耗时（毫秒） */
  estimatedDuration: number;
  /** 优先级（1-10，10最高） */
  priority: number;
  /** 是否可并行执行 */
  parallelizable: boolean;
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** 执行结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 总预估耗时 */
  totalEstimatedDuration: number;
  /** 并行度（同时执行的最大子任务数） */
  parallelism: number;
  /** 执行阶段（每个阶段内的子任务可并行） */
  phases: SubTask[][];
  /** 总成本估算 */
  estimatedCost: CostEstimate;
}

/**
 * 成本估算
 */
export interface CostEstimate {
  /** 强模型成本 */
  strongModelCost: number;
  /** 平衡模型成本 */
  balancedModelCost: number;
  /** 快速模型成本 */
  fastModelCost: number;
  /** 最小模型成本 */
  minimalModelCost: number;
  /** 总成本 */
  totalCost: number;
  /** 相比全用强模型节省的成本 */
  savings: number;
  /** 节省比例 */
  savingsPercentage: number;
}

/**
 * 模型路由配置
 */
export interface PlannerWorkerRouterConfig {
  /** 强模型列表（用于Planner和关键决策） */
  strongModels: string[];
  /** 平衡模型列表（用于中等复杂度任务） */
  balancedModels: string[];
  /** 快速模型列表（用于简单执行） */
  fastModels: string[];
  /** 最小模型列表（用于极简任务） */
  minimalModels: string[];
  /** 成本优化策略 */
  optimizationStrategy: 'cost' | 'speed' | 'quality' | 'balanced';
  /** 最大并行度 */
  maxParallelism: number;
  /** 是否启用自适应路由 */
  enableAdaptiveRouting: boolean;
  /** 模型成本映射（每token成本） */
  modelCosts: Record<string, number>;
}

/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 选中的模型 */
  selectedModel: string;
  /** 模型层级 */
  modelTier: ModelTier;
  /** 决策原因 */
  reason: string;
  /** 置信度（0-1） */
  confidence: number;
}

/**
 * 子Agent配置
 */
export interface SubAgentConfig {
  /** Agent ID */
  id: string;
  /** Agent名称 */
  name: string;
  /** 使用的模型 */
  model: string;
  /** 模型层级 */
  modelTier: ModelTier;
  /** 可用工具列表 */
  availableTools: string[];
  /** 最大并发任务数 */
  maxConcurrency: number;
  /** 当前运行任务数 */
  currentLoad: number;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: PlannerWorkerRouterConfig = {
  strongModels: ['gpt-5.6', 'claude-opus-4.8', 'gemini-3.5-pro'],
  balancedModels: ['gpt-5.5', 'claude-sonnet-4', 'gemini-3.5-flash'],
  fastModels: ['gpt-5.5-mini', 'claude-haiku-3.5', 'gemini-3.5-flash-lite'],
  minimalModels: ['gpt-4o-mini', 'claude-haiku-3', 'gemini-3.0-flash'],
  optimizationStrategy: 'balanced',
  maxParallelism: 3,
  enableAdaptiveRouting: true,
  modelCosts: {
    'gpt-5.6': 0.00003,
    'claude-opus-4.8': 0.000035,
    'gemini-3.5-pro': 0.000025,
    'gpt-5.5': 0.000015,
    'claude-sonnet-4': 0.000012,
    'gemini-3.5-flash': 0.00001,
    'gpt-5.5-mini': 0.000005,
    'claude-haiku-3.5': 0.000004,
    'gemini-3.5-flash-lite': 0.000003,
    'gpt-4o-mini': 0.000002,
    'claude-haiku-3': 0.0000015,
    'gemini-3.0-flash': 0.000001,
  },
};

// ==================== Planner-Worker Router 主类 ====================

/**
 * Planner-Worker 分层路由器
 * 
 * 核心理念：
 * 1. 强模型只做高价值决策（任务分解、关键设计）
 * 2. 执行层用廉价模型（简单任务、重复执行）
 * 3. 智能路由，根据任务复杂度选择合适模型
 * 4. 支持并行执行，提升效率
 */
export class PlannerWorkerRouter extends EventEmitter {
  private config: PlannerWorkerRouterConfig;
  
  /** 子Agent池 */
  private subAgents: Map<string, SubAgentConfig> = new Map();
  
  /** 任务历史（用于自适应路由） */
  private taskHistory: Array<{ complexity: TaskComplexity; modelTier: ModelTier; success: boolean; duration: number }> = [];
  
  /** 路由决策历史 */
  private routingHistory: RoutingDecision[] = [];

  constructor(config: Partial<PlannerWorkerRouterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化默认子Agent
    this.initializeDefaultSubAgents();
  }

  // ===========================================================================
  // 任务分解（Planner）
  // ===========================================================================

  /**
   * 分解任务（使用强模型）
   * 
   * 这是Planner的核心功能，将复杂任务分解为可执行的子任务
   */
  async decomposeTask(task: string, context?: Record<string, any>): Promise<TaskDecomposition> {
    const startTime = Date.now();
    
    // 1. 评估任务复杂度
    const complexity = await this.assessComplexity(task, context);
    
    // 2. 根据复杂度决定是否需要分解
    if (complexity === 'simple') {
      // 简单任务不需要分解，直接执行
      return {
        originalTask: task,
        complexity,
        subtasks: [this.createSubTask(task, 'fast')],
        executionPlan: this.createExecutionPlan([this.createSubTask(task, 'fast')]),
        timestamp: Date.now(),
      };
    }
    
    // 3. 复杂任务需要分解
    const subtasks = await this.generateSubtasks(task, complexity, context);
    
    // 4. 创建执行计划
    const executionPlan = this.createExecutionPlan(subtasks);
    
    const decomposition: TaskDecomposition = {
      originalTask: task,
      complexity,
      subtasks,
      executionPlan,
      timestamp: Date.now(),
    };
    
    this.emit('task.decomposed', decomposition);
    
    return decomposition;
  }

  /**
   * 评估任务复杂度
   */
  private async assessComplexity(task: string, context?: Record<string, any>): Promise<TaskComplexity> {
    // 简化的复杂度评估（实际应该用LLM）
    const length = task.length;
    const hasMultipleSteps = task.includes('then') || task.includes('and then') || task.includes('after that');
    const hasConditionals = task.includes('if') || task.includes('when') || task.includes('unless');
    const hasDependencies = context && Object.keys(context).length > 3;
    
    if (length < 50 && !hasMultipleSteps && !hasConditionals) {
      return 'simple';
    }
    
    if (length < 200 && !hasDependencies) {
      return 'moderate';
    }
    
    if (hasConditionals || hasDependencies) {
      return 'complex';
    }
    
    return length > 500 ? 'critical' : 'complex';
  }

  /**
   * 生成子任务
   */
  private async generateSubtasks(task: string, complexity: TaskComplexity, context?: Record<string, any>): Promise<SubTask[]> {
    // 简化的子任务生成（实际应该用LLM）
    const subtasks: SubTask[] = [];
    
    // 根据复杂度生成不同数量的子任务
    const subtaskCount = complexity === 'moderate' ? 2 : complexity === 'complex' ? 4 : 6;
    
    // 第一个子任务：分析和规划（需要强模型）
    subtasks.push(this.createSubTask(
      `Analyze and plan: ${task.substring(0, 100)}...`,
      'strong',
      [],
      10
    ));
    
    // 中间子任务：执行（可以用平衡或快速模型）
    for (let i = 1; i < subtaskCount - 1; i++) {
      const modelTier = i % 2 === 0 ? 'fast' : 'balanced';
      subtasks.push(this.createSubTask(
        `Execute step ${i} of the plan`,
        modelTier,
        [subtasks[0].id],
        5
      ));
    }
    
    // 最后一个子任务：验证和总结（需要强模型）
    subtasks.push(this.createSubTask(
      'Verify results and generate summary',
      'strong',
      subtasks.slice(1).map(s => s.id),
      8
    ));
    
    return subtasks;
  }

  /**
   * 创建子任务
   */
  private createSubTask(description: string, modelTier: ModelTier, dependencies: string[] = [], priority: number = 5): SubTask {
    return {
      id: this.generateId(),
      description,
      dependencies,
      requiredModelTier: modelTier,
      requiredTools: [],
      estimatedDuration: modelTier === 'strong' ? 5000 : modelTier === 'balanced' ? 3000 : 1000,
      priority,
      parallelizable: dependencies.length === 0,
      status: 'pending',
    };
  }

  /**
   * 创建执行计划
   */
  private createExecutionPlan(subtasks: SubTask[]): ExecutionPlan {
    // 按依赖关系分阶段
    const phases: SubTask[][] = [];
    const completed = new Set<string>();
    
    while (completed.size < subtasks.length) {
      const phase: SubTask[] = [];
      
      for (const subtask of subtasks) {
        if (completed.has(subtask.id)) continue;
        
        // 检查依赖是否都已完成
        const depsCompleted = subtask.dependencies.every(dep => completed.has(dep));
        if (depsCompleted) {
          phase.push(subtask);
        }
      }
      
      if (phase.length === 0) break; // 避免无限循环
      
      phases.push(phase);
      phase.forEach(s => completed.add(s.id));
    }
    
    // 计算成本
    const costEstimate = this.calculateCost(subtasks);
    
    // 计算并行度
    const maxParallelism = Math.min(
      this.config.maxParallelism,
      Math.max(...phases.map(p => p.length))
    );
    
    return {
      totalEstimatedDuration: subtasks.reduce((sum, s) => sum + s.estimatedDuration, 0),
      parallelism: maxParallelism,
      phases,
      estimatedCost: costEstimate,
    };
  }

  // ===========================================================================
  // 模型路由（Worker选择）
  // ===========================================================================

  /**
   * 为子任务选择模型
   */
  async routeTask(subtask: SubTask): Promise<RoutingDecision> {
    const availableAgents = this.getAvailableAgents(subtask.requiredModelTier);
    
    if (availableAgents.length === 0) {
      throw new Error(`No available agents for tier: ${subtask.requiredModelTier}`);
    }
    
    // 选择负载最低的Agent
    const selectedAgent = availableAgents.reduce((min, agent) => 
      agent.currentLoad < min.currentLoad ? agent : min
    );
    
    const decision: RoutingDecision = {
      selectedModel: selectedAgent.model,
      modelTier: selectedAgent.modelTier,
      reason: `Selected ${selectedAgent.name} (load: ${selectedAgent.currentLoad}/${selectedAgent.maxConcurrency})`,
      confidence: 0.9,
    };
    
    this.routingHistory.push(decision);
    
    return decision;
  }

  /**
   * 获取可用的子Agent
   */
  private getAvailableAgents(modelTier: ModelTier): SubAgentConfig[] {
    return Array.from(this.subAgents.values())
      .filter(agent => agent.modelTier === modelTier && agent.currentLoad < agent.maxConcurrency);
  }

  // ===========================================================================
  // 成本计算
  // ===========================================================================

  /**
   * 计算成本估算
   */
  private calculateCost(subtasks: SubTask[]): CostEstimate {
    let strongCost = 0;
    let balancedCost = 0;
    let fastCost = 0;
    let minimalCost = 0;
    
    for (const subtask of subtasks) {
      const tokenEstimate = subtask.estimatedDuration * 10; // 简化估算
      
      // 各层级的成本
      const strongModel = this.config.strongModels[0];
      const balancedModel = this.config.balancedModels[0];
      const fastModel = this.config.fastModels[0];
      const minimalModel = this.config.minimalModels[0];
      
      strongCost += tokenEstimate * (this.config.modelCosts[strongModel] || 0.00003);
      balancedCost += tokenEstimate * (this.config.modelCosts[balancedModel] || 0.000012);
      fastCost += tokenEstimate * (this.config.modelCosts[fastModel] || 0.000004);
      minimalCost += tokenEstimate * (this.config.modelCosts[minimalModel] || 0.0000015);
    }
    
    // 根据子任务的requiredModelTier计算实际成本
    let actualCost = 0;
    for (const subtask of subtasks) {
      const tokenEstimate = subtask.estimatedDuration * 10;
      let modelCost = 0;
      
      switch (subtask.requiredModelTier) {
        case 'strong':
          modelCost = this.config.modelCosts[this.config.strongModels[0]] || 0.00003;
          break;
        case 'balanced':
          modelCost = this.config.modelCosts[this.config.balancedModels[0]] || 0.000012;
          break;
        case 'fast':
          modelCost = this.config.modelCosts[this.config.fastModels[0]] || 0.000004;
          break;
        case 'minimal':
          modelCost = this.config.modelCosts[this.config.minimalModels[0]] || 0.0000015;
          break;
      }
      
      actualCost += tokenEstimate * modelCost;
    }
    
    const savings = strongCost - actualCost;
    
    return {
      strongModelCost: strongCost,
      balancedModelCost: balancedCost,
      fastModelCost: fastCost,
      minimalModelCost: minimalCost,
      totalCost: actualCost,
      savings,
      savingsPercentage: strongCost > 0 ? (savings / strongCost) * 100 : 0,
    };
  }

  // ===========================================================================
  // 子Agent管理
  // ===========================================================================

  /**
   * 初始化默认子Agent
   */
  private initializeDefaultSubAgents(): void {
    // 强模型Agent（用于Planner）
    this.addSubAgent({
      id: 'planner-strong',
      name: 'Planner (Strong)',
      model: this.config.strongModels[0],
      modelTier: 'strong',
      availableTools: ['task_decomposition', 'complexity_assessment'],
      maxConcurrency: 2,
      currentLoad: 0,
    });
    
    // 平衡模型Agent
    this.addSubAgent({
      id: 'worker-balanced',
      name: 'Worker (Balanced)',
      model: this.config.balancedModels[0],
      modelTier: 'balanced',
      availableTools: ['code_execution', 'file_operations', 'web_search'],
      maxConcurrency: 3,
      currentLoad: 0,
    });
    
    // 快速模型Agent
    this.addSubAgent({
      id: 'worker-fast',
      name: 'Worker (Fast)',
      model: this.config.fastModels[0],
      modelTier: 'fast',
      availableTools: ['simple_query', 'format_conversion'],
      maxConcurrency: 5,
      currentLoad: 0,
    });
    
    // 最小模型Agent
    this.addSubAgent({
      id: 'worker-minimal',
      name: 'Worker (Minimal)',
      model: this.config.minimalModels[0],
      modelTier: 'minimal',
      availableTools: ['basic_query'],
      maxConcurrency: 10,
      currentLoad: 0,
    });
  }

  /**
   * 添加子Agent
   */
  addSubAgent(config: SubAgentConfig): void {
    this.subAgents.set(config.id, config);
    this.emit('subagent.added', config);
  }

  /**
   * 移除子Agent
   */
  removeSubAgent(agentId: string): void {
    this.subAgents.delete(agentId);
    this.emit('subagent.removed', agentId);
  }

  /**
   * 更新子Agent负载
   */
  updateAgentLoad(agentId: string, loadChange: number): void {
    const agent = this.subAgents.get(agentId);
    if (agent) {
      agent.currentLoad = Math.max(0, Math.min(agent.maxConcurrency, agent.currentLoad + loadChange));
      this.emit('subagent.load_changed', { agentId, currentLoad: agent.currentLoad });
    }
  }

  // ===========================================================================
  // 查询与统计
  // ===========================================================================

  /**
   * 获取所有子Agent
   */
  getSubAgents(): SubAgentConfig[] {
    return Array.from(this.subAgents.values());
  }

  /**
   * 获取路由历史
   */
  getRoutingHistory(): RoutingDecision[] {
    return [...this.routingHistory];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.taskHistory = [];
    this.routingHistory = [];
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export default PlannerWorkerRouter;
