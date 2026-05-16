/**
 * SelfClaw Context Relay Setup
 * 解决Agent在Session重启、Sub-agent边界、Cron/Heartbeat隔离时的记忆断裂问题
 * 核心原则：文件是唯一的真相源
 */

const fs = require('fs').promises;
const path = require('path');

class ContextRelay {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.contextFiles = {
      project: 'PROJECT.md',
      state: 'state.json',
      decisions: 'decisions.md',
      todos: 'todos.json'
    };
  }

  /**
   * 初始化项目上下文结构
   */
  async init() {
    console.log('🔄 初始化 Context Relay 系统...');
    
    // 创建 PROJECT.md - 项目概述
    await this.createProjectMD();
    
    // 创建 state.json - 状态快照
    await this.createStateJSON();
    
    // 创建 decisions.md - 决策日志
    await this.createDecisionsMD();
    
    // 创建 todos.json - 自我待办
    await this.createTodosJSON();
    
    console.log('✅ Context Relay 初始化完成');
    console.log('📁 项目文件结构已创建');
  }

  /**
   * 创建 PROJECT.md 项目概述
   */
  async createProjectMD() {
    const content = `# SelfClaw Project Overview
**创建时间：${new Date().toISOString().split('T')[0]}**

## 🎯 项目目标
[在此填写项目核心目标]

## 📋 项目范围
- [ ] 范围项1
- [ ] 范围项2
- [ ] 范围项3

## 👥 相关人员
- 所有者：
- 利益相关者：

## 📅 里程碑
| 里程碑 | 时间 | 状态 |
|--------|------|------|
| M1 | | ⬜ |

## 📝 变更记录
| 时间 | 变更内容 | 变更人 |
|------|----------|--------|
`;
    
    await fs.writeFile(
      path.join(this.projectPath, this.contextFiles.project),
      content,
      'utf8'
    );
  }

  /**
   * 创建 state.json 状态快照
   */
  async createStateJSON() {
    const state = {
      project: {
        name: 'SelfClaw Project',
        phase: 'init',
        progress: 0
      },
      current: {
        task: '',
        status: 'idle',
        lastUpdate: new Date().toISOString()
      },
      session: {
        id: '',
        startTime: '',
        contextSummary: ''
      },
      nextAction: {
        type: '',
        description: '',
        priority: 'medium'
      },
      version: '1.0.0'
    };
    
    await fs.writeFile(
      path.join(this.projectPath, this.contextFiles.state),
      JSON.stringify(state, null, 2),
      'utf8'
    );
  }

  /**
   * 创建 decisions.md 决策日志
   */
  async createDecisionsMD() {
    const content = `# 决策日志 Decision Log

## 决策原则
1. 小步快跑，快速验证
2. 文档先行，编码随后
3. 每次决策都要有明确的背景和理由

---

## 已记录决策

| ID | 决策内容 | 背景/理由 | 决策人 | 时间 | 状态 |
|----|----------|-----------|--------|------|------|
| D001 | 采用文件作为唯一真相源 | 解决跨会话记忆断裂问题 | System | ${new Date().toISOString().split('T')[0]} | ✅ |

---

## 待决策事项

- [ ] 
`;
    
    await fs.writeFile(
      path.join(this.projectPath, this.contextFiles.decisions),
      content,
      'utf8'
    );
  }

  /**
   * 创建 todos.json 自我待办
   */
  async createTodosJSON() {
    const todos = {
      pending: [],
      inProgress: [],
      completed: [],
      archive: []
    };
    
    await fs.writeFile(
      path.join(this.projectPath, this.contextFiles.todos),
      JSON.stringify(todos, null, 2),
      'utf8'
    );
  }

  /**
   * 冷启动：从文件读取上下文
   */
  async coldStart() {
    console.log('❄️ Context Relay 冷启动...');
    
    try {
      const [project, state, decisions, todos] = await Promise.all([
        fs.readFile(path.join(this.projectPath, this.contextFiles.project), 'utf8'),
        fs.readFile(path.join(this.projectPath, this.contextFiles.state), 'utf8'),
        fs.readFile(path.join(this.projectPath, this.contextFiles.decisions), 'utf8'),
        fs.readFile(path.join(this.projectPath, this.contextFiles.todos), 'utf8')
      ]);
      
      console.log('✅ 上下文读取成功');
      console.log(`  - 项目状态: ${JSON.parse(state).project.phase}`);
      console.log(`  - 待办事项: ${JSON.parse(todos).pending.length} 个`);
      
      return {
        project,
        state: JSON.parse(state),
        decisions,
        todos: JSON.parse(todos)
      };
    } catch (error) {
      console.error('❌ 冷启动失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新状态快照
   */
  async updateState(updates) {
    const statePath = path.join(this.projectPath, this.contextFiles.state);
    const currentState = JSON.parse(await fs.readFile(statePath, 'utf8'));
    
    const newState = {
      ...currentState,
      ...updates,
      current: {
        ...currentState.current,
        ...(updates.current || {}),
        lastUpdate: new Date().toISOString()
      }
    };
    
    await fs.writeFile(statePath, JSON.stringify(newState, null, 2), 'utf8');
    console.log('✅ 状态已更新');
  }

  /**
   * 添加待办事项
   */
  async addTodo(todo) {
    const todosPath = path.join(this.projectPath, this.contextFiles.todos);
    const todos = JSON.parse(await fs.readFile(todosPath, 'utf8'));
    
    const newTodo = {
      id: `T${String(Date.now()).slice(-6)}`,
      ...todo,
      createdAt: new Date().toISOString(),
      priority: todo.priority || 'medium'
    };
    
    todos.pending.push(newTodo);
    await fs.writeFile(todosPath, JSON.stringify(todos, null, 2), 'utf8');
    
    console.log(`✅ 待办已添加: ${newTodo.id}`);
    return newTodo.id;
  }

  /**
   * 记录决策
   */
  async recordDecision(decision) {
    const decisionsPath = path.join(this.projectPath, this.contextFiles.decisions);
    let content = await fs.readFile(decisionsPath, 'utf8');
    
    const decisionRow = `\n| D${String(Date.now()).slice(-4)} | ${decision.content} | ${decision.reason} | ${decision.author || 'System'} | ${new Date().toISOString().split('T')[0]} | ✅ |`;
    
    // 插入到表格中
    content = content.replace('| D001 |', decisionRow + '\n| D001 |');
    
    await fs.writeFile(decisionsPath, content, 'utf8');
    console.log('✅ 决策已记录');
  }
}

module.exports = ContextRelay;
