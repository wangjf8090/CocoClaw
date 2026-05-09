# SelfClaw Memory System Design Document
# SelfClaw 记忆系统设计文档

## 1. 系统概述

### 1.1 设计目标

SelfClaw记忆系统实现了**三重混合索引架构**，结合向量检索、全文检索和图关系检索，通过RRF（Reciprocal Rank Fusion）算法融合多路结果，为AI Agent提供高质量的上下文记忆。

**核心目标**:
- 语义理解：通过向量检索捕捉语义相似度
- 精确匹配：通过全文检索实现精确关键词匹配
- 关联推理：通过图索引发现实体间的隐式关系
- 高效召回：RRF融合提升搜索质量和多样性

### 1.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Manager Interface                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
┌─────────────┐     ┌───────────────┐     ┌───────────────┐
│  Vector     │     │  Full Text    │     │  Graph        │
│  Index      │     │  Index        │     │  Index        │
└──────┬──────┘     └───────┬───────┘     └───────┬───────┘
       │                    │                     │
       └────────────────────┼─────────────────────┘
                            ▼
                    ┌───────────────┐
                    │  RRF Fusion   │  ← Reciprocal Rank Fusion
                    └───────┬───────┘
                            ▼
                    ┌───────────────┐
                    │  Results      │
                    └───────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer (JSONL)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 三重索引详解

### 2.1 向量检索引擎 (Vector Index)

#### 工作原理

向量检索将文本转换为高维空间中的向量，通过计算向量间的余弦相似度找到语义相近的记忆。

```
文本 → Embedding(384维) → 向量空间 → 余弦相似度计算 → 结果
```

#### 技术实现

- **向量维度**: 384维 (all-MiniLM-L6-v2 标准)
- **相似度算法**: 余弦相似度
- **近似搜索**: 简化HNSW (Hierarchical Navigable Small World)
- **嵌入模型**: 
  - 内置: SimpleEmbedder (n-gram + tf-idf)
  - 可扩展: @xenova/transformers (all-MiniLM-L6-v2)

#### 余弦相似度公式

```
cos(θ) = (A · B) / (||A|| * ||B||)
       = Σ(Ai * Bi) / (√(ΣAi²) * √(ΣBi²))
```

#### API 参考

```typescript
// 添加文档
vectorIndex.add({
  id: string,
  vector: number[],
  metadata: Record<string, any>
});

// 搜索
vectorIndex.search(
  queryVector: number[],
  limit?: number  // default 10
): VectorSearchResult[];

// 批量操作
vectorIndex.addBatch(docs: VectorDocument[]);
```

---

### 2.2 全文检索引擎 (Full Text Index)

#### 工作原理

全文检索使用倒排索引和BM25排序算法，实现精确的关键词匹配。

#### 技术实现

- **底层引擎**: lunr.js
- **排序算法**: BM25 Okapi
- **中文支持**: n-gram 分词 (unigram + bigram + trigram)
- **字段加权**: title(3x) > content(1x) > type(0.5x)

#### BM25 公式

```
BM25(d, q) = Σ( IDF(qi) * f(qi, d) * (k1 + 1) / 
                         (f(qi, d) + k1 * (1 - b + b * |d| / avgdl)) )

where:
  IDF(qi) = inverse document frequency of term qi
  f(qi, d) = term frequency in document d
  k1 = 1.5 (term frequency saturation parameter)
  b = 0.75 (length normalization parameter)
```

#### 中文分词策略

```typescript
// n-gram 分词示例
输入: "开发工具"
输出: ["开", "发", "工", "具",            // unigram
       "开发", "发工", "工具",            // bigram
       "开发工", "发工具"]               // trigram
```

#### API 参考

```typescript
// 添加文档
fulltextIndex.add({
  id: string,
  title?: string,
  content: string,
  type: MemoryType,
  metadata: Record<string, any>
});

// 基础搜索
fulltextIndex.search(
  query: string,
  limit?: number,
  types?: MemoryType[]
): FullTextSearchResult[];

// 高级搜索
fulltextIndex.advancedSearch({
  query?: string,
  title?: string,
  content?: string,
  type?: MemoryType,
  minScore?: number,
  limit?: number
}): FullTextSearchResult[];
```

---

### 2.3 图关系索引 (Graph Index)

#### 工作原理

图索引将记忆建模为**实体-关系图**，通过图算法发现记忆之间的关联和重要性。

#### 数据模型

```
[Entity] -- [Relation] -- [Entity]
    |
    |-- id: string
    |-- name: string
    |-- type: person | organization | project | document | concept
    |-- importance: number (0-100)
    |-- metadata: Record<string, any>

[Relation]
    |-- id: string
    |-- source: string (entity id)
    |-- target: string (entity id)
    |-- type: related_to | mentions | uses | creates | belongs_to | depends_on
    |-- weight: number (0-1)
    |-- metadata: Record<string, any>
```

#### 核心算法

**1. PageRank 重要性排序**

```
PR(u) = (1 - d) + d * Σ( PR(v) / L(v) )

where:
  d = 0.85 (damping factor)
  L(v) = number of outgoing links from v
```

**2. 最短路径发现** (Dijkstra算法)

用于找到两个实体之间的关联路径，支持推理型查询。

**3. 社区发现** (连通分量)

识别知识领域的聚类结构。

#### API 参考

```typescript
// 添加实体
graphIndex.addEntity({
  id: string,
  name: string,
  type: EntityType,
  metadata: Record<string, any>,
  importance: number
});

// 添加关系
graphIndex.addRelation({
  id: string,
  source: string,
  target: string,
  type: RelationType,
  weight: number,
  metadata: Record<string, any>
});

// 搜索
graphIndex.search(
  query: string,
  limit?: number,
  types?: EntityType[]
): GraphSearchResult[];

// 邻接实体
graphIndex.getNeighbors(
  entityId: string,
  depth: number = 1
): Entity[];

// 最短路径
graphIndex.findPath(
  sourceId: string,
  targetId: string
): Entity[] | null;
```

---

## 3. RRF 结果融合算法

### 3.1 算法原理

**RRF (Reciprocal Rank Fusion)** 是一种无监督的结果融合方法，通过对每个来源的排名进行倒数加权，得到最终的融合排名。

```
RRF 公式:
score(d) = Σ( 1 / (k + rank(d, s)) ) for each source s

where:
  d = document
  s = retrieval source (vector, fulltext, graph)
  rank(d, s) = rank of document d in source s
  k = constant (typically 60)
```

### 3.2 k参数选择

- **k = 60**: 标准值，来自学术文献验证 (Cormack et al., 2009)
- 较大的k值降低排名靠前结果的权重
- 较小的k值增强排名靠前结果的优势

### 3.3 权重配置

```typescript
// 默认权重
weights = {
  vector: 1.0,    // 语义匹配权重
  fulltext: 1.0,  // 精确匹配权重
  graph: 0.8      // 关联匹配权重（稍低，避免过度关联）
};

// 加权后的公式
score(d) = Σ( weight[s] / (k + rank(d, s)) )
```

### 3.4 归一化

融合后进行 min-max 归一化，使分数落在 [0, 1] 区间：

```
normalized_score = (score - min_score) / (max_score - min_score)
```

### 3.5 API 参考

```typescript
// 创建融合器
const rrf = new RRFFusion({
  k: 60,
  weights: { vector: 1.0, fulltext: 1.0, graph: 0.8 }
});

// 融合三路结果
const fused: FusionResult[] = rrf.fuse({
  vector: VectorSearchResult[],
  fulltext: FullTextSearchResult[],
  graph: GraphSearchResult[]
}, limit: number);

// 归一化
const normalized = rrf.normalizeScores(fused);
```

---

## 4. 存储层设计

### 4.1 持久化格式

**JSONL (JSON Lines)** 格式，每行一个完整的记忆对象：

```jsonl
{"id":"uuid-1","type":"conversation","content":"...","createdAt":1234567890,"...":""}
{"id":"uuid-2","type":"fact","content":"...","createdAt":1234567891,"...":""}
{"id":"uuid-3","type":"reflection","content":"...","createdAt":1234567892,"...":""}
```

### 4.2 原子写入保证

```typescript
// 防止部分写入的原子操作
1. 写入临时文件: memories.jsonl.tmp
2. fs.rename() 原子替换原文件
3. 仅当完整写入成功才替换
```

### 4.3 双文件持久化

- **memories.jsonl**: 完整记忆状态，用于重建索引
- **transcripts.jsonl**: 追加式转录，用于审计和回放

### 4.4 Markdown 导出

支持按类型导出为易读的Markdown文档：

```markdown
# MEMORY EXPORT - 2024-01-15

Total memories: 150

---

## CONVERSATION

### [abc123] 2024-01-15 10:30:00
用户询问TypeScript最佳实践，推荐了...

Metadata: {"source": "chat", "importance": 75}

---

## FACTS

...
```

---

## 5. 记忆老化策略

### 5.1 半衰期衰减模型

模拟人类遗忘曲线，记忆重要性随时间指数衰减：

```
importance(t) = initial_importance * (1/2)^(t / half_life)

where:
  t = time since creation (days)
  half_life = 30 days (default)
```

### 5.2 访问增强

每次访问记忆会提升其重要性，模拟"复习强化记忆"：

```
importance = min(100, importance + 5)
```

### 5.3 自动清理

当重要性低于阈值（默认10）时自动清理低价值记忆。

---

## 6. 热记忆缓存 (Hot Cache)

### 6.1 LRU 策略

使用LRU（Least Recently Used）算法缓存最近访问的记忆：

```
         ┌─────────────────────────────────────┐
Access → │         Cache (max 1000 items)      │ → Hit/Miss
         └──────┬───────────────────┬──────────┘
                │                   │
         [Hot 区域]           [Cold 区域]
         最近20%访问           可能被淘汰
```

### 6.2 TTL 过期

缓存项目有1小时的TTL（Time To Live），过期自动失效。

---

## 7. 记忆类型系统

### 7.1 类型定义

| 类型 | 说明 | 来源 | 老化速度 |
|------|------|------|----------|
| `conversation` | 对话历史 | user/assistant | 快 (7天) |
| `fact` | 客观事实 | user/tool | 慢 (90天) |
| `reflection` | 反思总结 | reflection | 很慢 (180天) |
| `skill` | 技能记忆 | system | 永久 |
| `entity` | 实体信息 | extraction | 慢 (60天) |
| `system` | 系统配置 | system | 永久 |

### 7.2 记忆对象结构

```typescript
interface Memory {
  id: string;                    // UUID
  type: MemoryType;              // 记忆类型
  source: MemorySource;          // 来源
  content: string;               // 文本内容
  metadata: Record<string, any>; // 元数据
  embedding?: number[];          // 向量嵌入
  entities?: string[];           // 关联实体ID
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  accessCount: number;           // 访问计数
  lastAccessedAt: number;        // 最后访问时间
  importance: number;            // 重要性 (0-100)
  ttl?: number;                  // 过期时间戳
}
```

---

## 8. 事件系统

### 8.1 事件类型

```typescript
type MemoryEventType =
  | 'memory_created'    // 新记忆创建
  | 'memory_updated'    // 记忆更新
  | 'memory_deleted'    // 记忆删除
  | 'memory_accessed'   // 记忆被访问
  | 'index_updated'     // 索引更新
  | 'search_completed'  // 搜索完成
  | 'error';            // 错误
```

### 8.2 使用方式

```typescript
memoryManager.on('memory_created', (event) => {
  console.log(`New memory: ${event.data.memoryId}`);
});

memoryManager.on('search_completed', (event) => {
  console.log(`Search returned ${event.data.resultCount} results`);
});
```

---

## 9. 完整 API 参考

### MemoryManager 主接口

```typescript
class MemoryManager {
  // 初始化
  initialize(): Promise<void>;

  // CRUD 操作
  createMemory(
    content: string,
    type: MemoryType,
    source: MemorySource,
    metadata?: Record<string, any>,
    importance?: number
  ): Promise<Memory>;

  getMemory(id: string): Memory | undefined;

  updateMemory(
    id: string,
    updates: Partial<{
      content: string;
      metadata: Record<string, any>;
      importance: number;
      entities: string[];
    }>
  ): Promise<Memory | null>;

  deleteMemory(id: string): Promise<boolean>;

  // 搜索接口
  search(query: string, options?: SearchOptions): Promise<FusionResult[]>;
  vectorSearch(query: string, options?: SearchOptions): FusionResult[];
  fulltextSearch(query: string, options?: SearchOptions): FusionResult[];

  // 统计
  getStats(): MemoryStats;

  // 事件
  on(event: MemoryEventType, handler: Function): void;
  off(event: MemoryEventType, handler: Function): void;
}
```

### SearchOptions

```typescript
interface SearchOptions {
  limit?: number;              // default: 20
  threshold?: number;          // default: 0.0 (0-1)
  types?: MemoryType[];        // 过滤类型
  startTime?: number;          // 时间范围开始
  endTime?: number;            // 时间范围结束
  includeMetadata?: boolean;   // 是否返回元数据
}
```

---

## 10. 性能指标

### 10.1 时间复杂度

| 操作 | 时间复杂度 | 备注 |
|------|-----------|------|
| 向量搜索 | O(n) | 可优化为O(log n) |
| 全文搜索 | O(m log m) | lunr内置优化 |
| 图搜索 | O(V + E) | PageRank O(E) |
| RRF融合 | O(k1 + k2 + k3) | 线性 |

### 10.2 预期性能

(基于 10,000 条记忆)

- **向量搜索**: < 50ms
- **全文搜索**: < 20ms
- **混合搜索**: < 100ms
- **内存占用**: < 100MB

---

## 11. 扩展路线图

### 短期 (v0.3)
- [ ] 集成 @xenova/transformers 真实嵌入
- [ ] 量化向量压缩 (FP16 → INT8)
- [ ] 真实HNSW实现

### 中期 (v0.4)
- [ ] 向量数据库集成 (Chroma, Weaviate)
- [ ] 多模态支持 (图片/音频)
- [ ] 记忆摘要生成

### 长期 (v1.0)
- [ ] 深度学习重排序 (CrossEncoder)
- [ ] 主动遗忘机制
- [ ] 知识图谱推理

---

**文档版本**: 0.2.0
**最后更新**: ${new Date().toISOString()}
