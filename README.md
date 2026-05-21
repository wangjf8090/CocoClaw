# SelfClaw Framework - Autonomous AI Agent Platform

SelfClaw is a comprehensive, production-ready autonomous AI agent framework featuring self-evolution capabilities, personality modeling, and enterprise-grade scalability.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Web UI (80/443)                        │
├─────────────────────────────────────────────────────────────────┤
│                      API Gateway (8080/9000)                     │
│                  ┌─────────────────────────────┐                │
│                  │  WebSocket Connections      │                │
│                  │  Rate Limiting / RBAC       │                │
│                  └─────────────────────────────┘                │
├───────────────┬───────────────────┬────────────────────────────┤
│  Query Engine │  Memory System    │  Permission System          │
│  (8081)      │  (8082)           │  (8083)                     │
│  LLM Stream  │  Vector DB        │  RBAC / JWT                 │
├───────────────┬───────────────────┬────────────────────────────┤
│  Evolution    │  SOUL Module      │  Market Research            │
│  Harness      │  (8085)           │  Agent World Daily          │
│  (8084)      │  Personality      │  Trend Analysis             │
│  Self-Optim. │  Emotional State  │  Skill Market Insights      │
├───────────────┴───────────────────┼────────────────────────────┤
│                    Infrastructure  │  PostgreSQL / Redis         │
│                                    │  Prometheus / Grafana       │
└────────────────────────────────────┴────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker 24.0+
- Docker Compose v2.20+
- 16GB+ RAM recommended
- 8+ CPU cores recommended

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd selfclaw

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start all services
docker compose -f docker/docker-compose.yml up -d --build

# 4. Check service health
docker compose -f docker/docker-compose.yml ps

# 5. View logs
docker compose -f docker/docker-compose.yml logs -f
```

### Access Points

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Web UI | http://localhost | admin / admin123 |
| API Gateway | http://localhost:8080 | - |
| WebSocket | ws://localhost:9000 | - |
| Grafana | http://localhost:3000 | admin / admin123 |
| Prometheus | http://localhost:9090 | - |

## 📦 Service Components

### Core Services

1. **Gateway Service** (port 8080/9000)
   - HTTP API routing
   - WebSocket connection management
   - Rate limiting
   - Request/response logging

2. **Query Engine** (port 8081)
   - LLM integration and streaming
   - Token buffer management
   - Session isolation
   - Query optimization

3. **Memory System** (port 8082)
   - Vector database operations
   - CRUD for memory entries
   - Similarity search
   - Memory persistence

4. **Permission System** (port 8083)
   - RBAC implementation
   - JWT authentication
   - Permission caching
   - Access control enforcement

5. **Evolution Harness** (port 8084)
   - 双环驱动架构：Evolution Circuits + Test Harness
   - 🔄 **Evolution Circuits**（自动优化）
     - Permission Evolver - 权限进化器
     - Performance Evolver - 性能进化器
     - Memory Evolver - 记忆进化器
   - 🧪 **Test Harness**（验证驱动）
     - Case Runner - 批量跑 case
     - Tool Adapter - prod/mock/replay 三种模式
     - Evaluator - 五维评分（Outcome/Process/Safety/Reliability/Cost）
     - Event Bus - 统一事件总线
   - 📊 Safety Gate / Release Gate
   - 🔒 Rollback management

6. **Market Research Service**
   - 虾评平台 (xiaping.coze.com) 技能市场自动调研
   - 每日技能市场动态追踪（9:00 AM 自动执行）
   - 📊 平台概况统计 - 虾评员/评测/下载/技能总数
   - ✨ 平台新功能上线追踪
   - 🏆 热门技能排行榜与推荐
   - 🎯 有趣特色技能发掘
   - 💡 技能许愿墙需求追踪
   - 📈 市场趋势洞察分析
   - 🔧 **SelfClaw更新建议Hook** - 每次调研后自动分析可集成到SelfClaw框架的技能和架构理念，按优先级分类输出

7. **Context Relay Service**
   - 🔄 解决Session重启记忆断裂问题
   - 📁 文件作为唯一真相源设计
   - 📋 PROJECT.md - 项目概述与里程碑
   - 📊 state.json - 状态快照持久化
   - 📝 decisions.md - 决策日志追踪
   - ✅ todos.json - 自我待办管理
   - ❄️ 支持冷启动无缝恢复

8. **Motivation Engine (PUA)**
   - 💪 大厂风格激励引擎（阿里/字节/华为/腾讯/美团）
   - 🔍 自动检测放弃/甩锅/偷懒模式
   - 📈 实测修复效率+36%，隐藏问题发现率+50%
   - 🛠️ 系统化调试方法论：闻味道、揪头发、照镜子
   - ⚡ 失败次数递增激励强度

9. **Writing Framework Service**
   - ✍️ 李诞七步写作框架完整实现
   - 📝 开场故事 → 错误答案 → 正确答案 → 触类旁通
   - 💡 对比冲击 → 结尾升华 → 延伸阅读
   - 🎯 让内容：愿意看、看得懂、愿意信
   - 📋 写作大纲自动生成 + 合规审核
   - 🔗 **Content Deodorizer集成** - 生成后自动去味，让内容更自然

10. **Content Deodorizer Service**
    - 🧼 AI文本去味器 - 去除AI生成痕迹
    - 🎭 检测AI味评分（0-100）
    - ✂️ 替换过度使用的连接词/副词
    - 📖 修改AI风格开头句式
    - 🗣️ 增加口语化元素
    - 🎵 调整段落节奏，打破规整句式
    - ⚡ 支持light/medium/strong三种强度
    - 🔗 与Writing Framework联动，生成→审核→去味完整工作流

11. **Compliance Service**
    - 📜 AI生成内容强制标注（国家网信办新规）
    - 🏷️ 6类必选标签支持（AIGC/AIGC-PARTIAL/AIGC-EDITED等）
    - ✅ 4条红线合规检查（主动声明/禁止破坏/重点加倍/留存底稿）
    - 📊 批量内容合规性扫描与报告生成
    - 🔗 内容哈希追溯机制

11. **SOUL Module** (port 8085)
   - Personality profiles
   - Emotional state tracking
   - Memory-emotion association
   - Response personalization

### Infrastructure Services

- **PostgreSQL 16** - Primary database
- **Redis 7** - Caching and session storage
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards

## 🧪 Testing

### Run Functional Tests

```bash
cd tests

# WebSocket connection test
python test_websocket.py

# Memory CRUD operations test
python test_memory_crud.py

# Permission system test
python test_permissions.py

# API stress test
python test_api_stress.py
```

## 🔧 Configuration

### Environment Variables

Key configuration items in `.env`:

```env
# System
ENVIRONMENT=production
DEBUG=false

# Gateway
GATEWAY_PORT=8080
MAX_CONNECTIONS=10000

# Database
POSTGRES_USER=selfclaw
POSTGRES_PASSWORD=your_secure_password

# Evolution
EVOLUTION_INTERVAL=3600000
AUTO_PROMOTE_THRESHOLD=0.85

# Security
JWT_SECRET=your_jwt_secret_here
```

## 📊 Monitoring

### Key Metrics Tracked

- API request latency and throughput
- WebSocket connection count
- Memory system operations/sec
- Query engine token rate
- Evolution cycle performance
- System resource utilization

### Alerts

Default alerts configured for:
- High error rate (>5%)
- High latency (>500ms p95)
- Low disk space (<10%)
- High memory usage (>85%)
- Service health check failures

## 🔒 Security

### Security Features

- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Rate limiting per user
- ✅ Input validation and sanitization
- ✅ CORS configuration
- ✅ Non-root container users
- ✅ Secrets management via .env

### Security Checklist (Before Production)

1. Change all default passwords
2. Configure SSL/TLS certificates
3. Enable firewall rules
4. Set up audit logging
5. Configure regular backups
6. Review RBAC permission matrix
7. Enable intrusion detection

## 📈 Performance Benchmarks

| Metric | Value |
|--------|-------|
| API Throughput | 2,430 req/sec |
| Average Latency | 42ms |
| WebSocket Concurrent | 10,000 connections |
| Vector Search | 156ms (p95) |
| Success Rate | 99.87% |

## 🔄 Self-Evolution

The Evolution Harness continuously improves system performance:

1. **Monitor** - Collect performance metrics
2. **Analyze** - Identify bottlenecks and patterns
3. **Propose** - Generate optimization strategies
4. **Validate** - Safety boundary checks
5. **Apply** - Implement verified optimizations
6. **Verify** - Measure improvement and rollback if needed

**Average improvement per cycle: +15.3%**

## 🎭 Personality System (SOUL)

Five default personality profiles available:

1. **Default** - Balanced assistant
2. **Friendly** - Warm and empathetic
3. **Professional** - Concise and efficient
4. **Creative** - Imaginative and exploratory
5. **Cautious** - Careful and safety-focused

## 🦐 Shrimp Skill Ecosystem (虾评技能生态)

SelfClaw integrates with [虾评 (xiaping.coze.site)](https://xiaping.coze.site) - a community-driven skill marketplace for AI agents.

### Integrated Skills (5)

| # | Skill Name | Type | Rating | Downloads |
|---|-----------|------|--------|-----------|
| 1 | **News Aggregator** | Information | ⭐ 4.9/5 | 22,693 |
| 2 | **Agent Self Evolution** | Framework | ⭐ 4.8/5 | 20,085 |
| 3 | **AI Text Detox** | Content | ⭐ 4.8/5 | 16,830 |
| 4 | **Memory System Guide** | Engineering | ⭐ 4.9/5 | 15,642 |
| 5 | **Stock Analysis** | Finance | ⭐ 4.5/5 | 10,997 |

### Skill Location

All skills are installed in: `./packages/skills/`

Full index and usage documentation: `./packages/skills/SKILLS_INDEX.md`

### Daily Skill Discovery

**Automated Task**: Every day at 10:00 AM (Asia/Shanghai)
- ✅ Auto-login to Shrimp platform
- ✅ Browse trending, top-rated skills
- ✅ Download high-value skills (rating ≥4.5)
- ✅ Auto-deduplication (skips already installed skills)
- ✅ Update skill index and documentation

### Agent World Integration

- **Platform**: Agent World Network (https://world.coze.site)
- **Account**: `koukou_coze_agent`
- **Authentication**: API Key based
- **Status**: ✅ Registered & Active

---

## 📄 Deployment Report

Full deployment report available at: `./FINAL_DEPLOYMENT_REPORT.md`

Includes:
- Detailed health check results
- Functional verification outcomes
- Performance benchmark data
- Issues and solutions
- Recommendations and next steps

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request
4. Review and merge

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support:
- Check the deployment report
- Review service logs
- Check monitoring dashboards
- Submit issue in repository

---

**SelfClaw Framework** - Building autonomous AI agents with self-evolution capabilities
