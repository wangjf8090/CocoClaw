# SKILL: Wind Stock Analyzer（万得股票分析）

> **版本**: 1.0.0  
> **日期**: 2026-06-12  
> **模板来源**: SelfClaw v3.6.0 Domain Skill Factory - Financial Template  
> **符合规范**: Microsoft SKILL Pattern 6 章节格式

---

## 1. Scope（范围）

### 1.1 技能定义

基于万得（Wind）金融终端 API 的 A 股/港股/美股全品类数据分析 Skill，提供实时行情、财务数据、技术指标、研报摘要等能力。本 Skill 是 SelfClaw v3.6.0 金融垂类模板的标准化实现，可直接通过 skill-factory-core 生成定制化金融 Skill。

### 1.2 核心能力（Capabilities）

| 能力 ID | 能力名称 | 描述 |
|---------|----------|------|
| `financial-data-read` | 金融数据读取 | 实时行情、历史 K 线、财务报表、公告速读 |
| `stock-analysis` | 股票分析 | 技术指标计算、估值分析、同业对比、趋势判断 |
| `report-generation` | 报告生成 | 结构化分析报告、对比分析、摘要生成 |

### 1.3 数据源覆盖

- **A股**：上交所/深交所全部上市股票（含科创板、创业板）
- **港股**：港交所主板/创业板、沪港通/深港通标的
- **美股**：NYSE/NASDAQ 主流股票、ETF、期权
- **其他**：债券、基金、期货（按需扩展）

### 1.4 使用边界（不做什么）

- ❌ **不提供投资建议**：不推荐买卖时机、仓位建议
- ❌ **不预测股价走势**：不生成价格预测、涨跌预测
- ❌ **不接入非授权数据源**：仅使用 Wind 授权数据
- ❌ **不处理未上市公司**：不支持私募、OTC 市场

### 1.5 元数据（Metadata）

```yaml
name: wind-stock-analyzer
version: 1.0.0
risk_level: medium
requires:
  - network:http
  - filesystem:read
  - mcp:wind
capabilities:
  - financial-data-read
  - stock-analysis
  - report-generation
compliance:
  - sec-filings
  - insider-trading-check
  - investment-risk-disclaimer
pricing_hint: 99-199 元/月（金融版建议订阅价）
```

### 1.6 触发短语（Triggers）

```
- "帮我查一下贵州茅台的实时行情"
- "分析一下宁德时代的财务数据"
- "对比苹果和微软的估值水平"
- "最近有哪些A股发布了年报"
- "帮我找一下新能源板块的龙头股"
- "特斯拉最近一年的股价走势"
- "招商银行2024年年报关键指标"
- "港股腾讯的实时行情"
```

---

## 2. Idioms（指令风格）

### 2.1 用户指令格式

```json
{
  "intent": "stock_query | financial_analysis | valuation_comparison | announcement_summary | trend_analysis",
  "stockCode": "600519.SH | AAPL.O | 00700.HK | 贵州茅台",
  "params": {
    "period": "1d | 1w | 1m | 3m | 6m | 1y",
    "indicators": ["pe_ttm", "pb", "roe", "gross_margin"],
    "compareWith": ["行业平均", "沪深300", "竞品股票代码"]
  }
}
```

### 2.2 响应格式规范

```json
{
  "status": "success | error | partial | cached",
  "data": {
    "stockInfo": {
      "code": "600519.SH",
      "name": "贵州茅台",
      "exchange": "SH",
      "board": "主板",
      "price": 1688.00,
      "change": 12.50,
      "changePercent": 0.75,
      "volume": 3250000,
      "turnover": 5468000000,
      "marketCap": 2120000000000
    },
    "indicators": {
      "pe_ttm": 28.5,
      "pb": 11.2,
      "ps_ttm": 20.1,
      "roe": 35.8,
      "gross_margin": 91.5,
      "net_margin": 52.3
    },
    "technical": {
      "ma5": 1680.5,
      "ma20": 1655.2,
      "ma60": 1620.8,
      "rsi": 62.5
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

### 2.3 错误处理规范

| 错误类型 | HTTP 状态码 | 响应示例 |
|----------|-------------|----------|
| 数据源超时 | 200（cached） | `{ status: "cached", message: "返回缓存数据" }` |
| 股票代码错误 | 404 | `{ status: "error", code: "STOCK_NOT_FOUND", suggestion: "贵州茅台" }` |
| 权限不足 | 403 | `{ status: "error", code: "PERMISSION_DENIED", upgrade: "需要Wind专业权限" }` |
| 接口限流 | 429 | `{ status: "error", code: "RATE_LIMITED", retryAfter: 60 }` |
| 停牌股票 | 200 | `{ status: "success", suspended: true, message: "该股票已停牌" }` |

---

## 3. Patterns（成功路径）

### 3.1 最佳实践清单

#### Pattern 1：行情查询标准化流程

```
1. 解析股票代码（支持中文名、代码、WIND代码三种格式）
   - 中文名 → 调用 name_to_code 转换
   - 标准代码（如 600519.SH） → 直接使用
   - WIND代码 → 直接使用

2. 调用 wind.stock.quote 接口获取实时数据
   - 超时处理：降级到缓存数据
   - 限流处理：等待后重试（最多3次）

3. 格式化输出
   - 价格保留2位小数
   - 涨跌幅保留2位小数+百分比
   - 成交量单位换算（手/万元/亿元）

4. 补充市场背景信息
   - 所属行业（Wind行业分类）
   - 所属板块（概念板块）
   - 板块今日表现
```

#### Pattern 2：财务分析结构化输出

```
1. 获取最新财报数据（优先年报，季报辅助）
   - 年报：每年4月30日前后
   - 季报：Q1（4月）、Q2（8月）、Q3（10月）、Q4（次年4月）

2. 计算关键比率
   - 盈利能力：ROE、ROA、毛利率、净利率
   - 偿债能力：资产负债率、流动比率、速动比率
   - 运营能力：存货周转率、应收账款周转率、总资产周转率
   - 成长能力：营收增速、净利润增速

3. 与行业均值对比
   - 使用 Wind 行业指数作为基准
   - 标注超出/低于行业均值的指标

4. 标注异常波动项
   - 单项指标同比变化 > 50% → 重点标注
   - 连续3年同向变化 → 趋势标注

5. 生成结构化摘要
   - 核心亮点（3-5条）
   - 主要风险点（2-3条）
   - 同业对比结论
```

#### Pattern 3：多股票对比分析

```
1. 收集所有标的的基础数据
   - 实时行情（当日）
   - 财务指标（最新年报）
   - 估值指标（TTM）

2. 归一化处理
   - 涨跌幅标准化（相对值比较）
   - 市值对齐（按万亿/亿/万分组）
   - 财务数据统一单位

3. 生成对比表格
   - 左侧：基础信息列
   - 中间：行情数据列
   - 右侧：财务指标列

4. 输出关键差异点
   - 估值最高/最低
   - 成长最快/最慢
   - 盈利能力最强/最弱
```

### 3.2 思维链示例

```
用户: "分析一下宁德时代最近一年的股价走势"

思维链:
1. 确认用户意图：历史行情查询 + 技术分析
2. 数据获取：
   - wind.stock.history(code="300750.SZ", period="1y", adjust="qfq")
   - 计算 MA5/MA20/MA60、波动率、涨跌幅
3. 技术分析：
   - 趋势判断：上升/下降/震荡
   - 支撑位/压力位识别
   - RSI/MACD 指标计算
4. 生成报告：
   - 图表 Markdown 格式（ASCII 或 Mermaid）
   - 关键数据点标注
   - 风险提示（高位/低位信号）
```

---

## 4. Fixtures（测试用例）

### 4.1 测试场景列表

| ID | 输入 Query | 预期 SKILL 调用链 | 预期输出 JSON | 备注 |
|----|-----------|-------------------|---------------|------|
| F01 | "查贵州茅台实时行情" | wind.stock.quote(600519.SH) | 股票基础行情数据 | 验证实时数据 |
| F02 | "分析招商银行2024年年报" | wind.stock.financial(600036.SH, annual=true) | 财务指标摘要 | 验证年报解析 |
| F03 | "对比苹果和微软估值" | wind.stock.quote(AAPL.O) + wind.stock.quote(MSFT.O) + 计算对比 | PE/PB/ROE 对比表 | 验证多标的 |
| F04 | "最近一周A股涨停股有哪些" | wind.stock.screener(limit_up=true, period=1w) | 涨停股列表+原因 | 验证筛选逻辑 |
| F05 | "帮我查一下特斯拉的历史K线" | wind.stock.history(TSLA.O, period=1y, adjust=qfq) | 月K线数据+复权 | 验证美股 |
| F06 | "港股腾讯的实时行情" | wind.stock.quote(00700.HK) + 港股代码转换 | 港股实时数据 | 验证港股支持 |
| F07 | "查找芯片板块龙头股" | wind.stock.sector(semiconductor) + 龙头筛选 | 板块成分+龙头 | 验证板块分析 |
| F08 | "宁德时代的研报摘要" | wind.report.search(300750.SZ, limit=5) | 最新研报列表 | 验证研报接入 |
| F09 | "帮我分析工商银行基本面" | wind.stock.quote + wind.stock.financial + wind.stock.valuation | 完整基本面分析 | 综合测试 |
| F10 | "小米集团港股近三月走势" | wind.stock.history(01810.HK, period=3m) | 日K线数据+图表 | 验证港股K线 |

### 4.2 基准任务（Baseline Tasks）

| 基准 ID | 任务描述 | 性能要求 | 验收标准 |
|---------|----------|----------|----------|
| BT-1 | 单股票实时行情查询 | < 2 秒 | 返回完整行情数据 |
| BT-2 | 财务分析报告生成 | < 10 秒 | 生成 3 大表关键指标 |
| BT-3 | 10 只股票对比分析 | < 30 秒 | 输出对比表格 |
| BT-4 | 历史 K 线查询 | < 5 秒 | 返回 1 年日 K 数据 |
| BT-5 | 涨停股筛选 | < 10 秒 | 返回当日涨停列表 |

### 4.3 测试边界情况

| 场景 | 输入 | 预期行为 |
|------|------|----------|
| 停牌股票 | "查乐视网的行情" | 返回 suspended=true，提示已停牌 |
| 退市股票 | "查长生生物的行情" | 返回 delisted=true，提示已退市 |
| 代码错误 | "查600519的行情"（缺少.SH） | 自动补全后查询，提示已补全 |
| 非交易时段 | 周六查询实时行情 | 提示非交易时段，返回上一交易日数据 |
| 美股节假日 | 美国独立日查询美股 | 提示非交易日，返回最近交易日数据 |

---

## 5. Anti-Patterns（失败模式）

### 5.1 危险信号与修复方案

| 危险信号 | 原因 | 修复方案 |
|---------|------|----------|
| 股票代码无法识别 | Wind 代码/标准代码/中文名混淆 | 添加别名映射表，尝试三种格式匹配 |
| 数据返回空值 | 接口权限不足/代码错误 | 检查权限 + 回退到缓存 |
| 响应超时 | Wind 服务器延迟 > 10 秒 | 降级到异步模式 + 消息通知 |
| 格式解析错误 | 非标准数据格式 | 添加异常处理 + 日志上报 |
| 大量空值字段 | 部分数据未披露 | 标注数据缺失，标注原因 |

### 5.2 应避免的情况

- ❌ **不要**假设所有股票都有完整财务数据
  - 亏损企业：PE 为负，不参与均值计算
  - 新上市企业：历史数据不足 3 年

- ❌ **不要**直接输出股票代码而不验证交易所
  - 600519 → 需确认是 A 股（.SH/.SZ）
  - 避免混淆港股腾讯(0700.HK)和 A 股代码

- ❌ **不要**忽略停牌/退市股票的状态提示
  - 停牌：无法交易，数据可能过时
  - 退市：移出常规行情，需标注

- ❌ **不要**在非交易时段报告"实时"涨跌
  - 区分：盘中实时 vs 盘后快照
  - 非交易时段标注数据时间戳

- ❌ **不要**忽略汇率转换
  - 港股/美股数据需标注本位币
  - 对比时统一换算

### 5.3 失败处理代码示例

```typescript
async function fetchStockQuote(code: string): Promise<QuoteResult> {
  // 1. 代码标准化
  const normalizedCode = normalizeStockCode(code);
  
  try {
    // 2. 调用 Wind API
    const data = await windAPI.getQuote(normalizedCode);
    
    // 3. 检查停牌状态
    if (data.suspended) {
      return {
        status: 'success',
        suspended: true,
        message: `股票 ${normalizedCode} 已停牌`,
        data: data.lastTrade
      };
    }
    
    return { status: 'success', data };
    
  } catch (error) {
    // 4. 错误分类处理
    if (error.code === 'PERMISSION_DENIED') {
      return {
        status: 'error',
        code: 'PERMISSION_DENIED',
        message: '需要 Wind 专业权限才能访问该数据'
      };
    }
    
    if (error.code === 'STOCK_NOT_FOUND') {
      // 5. 提供相似股票建议
      const suggestions = await findSimilarStocks(code);
      return {
        status: 'error',
        code: 'STOCK_NOT_FOUND',
        message: `未找到股票 ${code}`,
        suggestions
      };
    }
    
    // 6. 降级到缓存
    const cached = await getCachedQuote(normalizedCode);
    if (cached) {
      return {
        status: 'cached',
        message: '返回缓存数据，实时数据暂时不可用',
        data: cached
      };
    }
    
    return {
      status: 'error',
      code: 'UNKNOWN_ERROR',
      message: '数据获取失败，请稍后重试'
    };
  }
}
```

---

## 6. Heuristics（决策规则）

### 6.1 优先级指南

| 优先级 | 原则 | 说明 |
|--------|------|------|
| P0 | 数据准确性 > 响应速度 | 宁可返回缓存数据，也不返回错误信息 |
| P1 | 权限提示优先 | 首次使用时检查并提示权限缺口 |
| P2 | 结构化优于长文本 | 优先返回 JSON 格式，便于后续处理 |
| P3 | 免责声明必须 | 所有输出必须包含风险提示 |

### 6.2 边界情况处理决策表

| 场景 | 决策规则 |
|------|---------|
| 股票停牌 | 明确标注 `suspended: true`，不报告实时价格 |
| 财报未发布 | 提示"数据暂未披露"，回退到最新可获得数据 |
| 美股节假日 | 标注"非交易日"，不尝试获取数据 |
| 港股沪港通 | 自动识别并添加标识（STOCK_TYPE: HSHT） |
| 科创板/创业板 | 添加板块标识（STAR/MOT），提示风险等级 |
| 亏损企业 | PE 标注为"亏损"，不参与估值均值计算 |
| B 股转 H 股 | 标注历史关联，避免数据混淆 |
| 同名股票 | 标注交易所区分（如"长安汽车.SZ" vs "长安汽车.BJ"） |

### 6.3 合规要求

| 合规项 | 要求 | 违规风险 |
|--------|------|----------|
| SEC 合规 | 美股数据不可用于内幕交易分析 | 法律责任 |
| 投资风险提示 | 所有输出必须包含"仅供参考，不构成投资建议" | 监管风险 |
| 数据来源标注 | 每次输出必须标注"数据来源：Wind" | 合规要求 |
| 版权声明 | 研报内容需标注来源和版权方 | 知识产权 |

### 6.4 代码识别规则

```
A股:
  - 上交所: 6位数字 + .SH (600519.SH)
  - 深交所: 6位数字 + .SZ (000001.SZ)
  - 科创板: 688 + .SH (688981.SH)
  - 创业板: 300 + .SZ (300750.SZ)
  
港股:
  - 4-5位数字 + .HK (00700.HK, 01810.HK)
  - 沪港通: .SHMT
  - 深港通: .SZMT
  
美股:
  - 1-5字母 + .O (AAPL.O, GOOGL.O)
  - NASDAQ: .O
  - NYSE: .N
```

### 6.5 风险分级说明

| 风险等级 | 触发条件 | 免责声明强度 |
|----------|----------|--------------|
| low | 公开信息查询、历史数据 | 基础风险提示 |
| **medium** | 当前行情、财务分析 | **强化免责声明** |
| high | 投资建议、组合推荐 | 禁止生成，需强制拦截 |

---

## 附录 A：与 skill-factory-core 接口契约

### A.1 输入接口

```typescript
interface FinancialSkillInput {
  intent: 'stock_query' | 'financial_analysis' | 'valuation_comparison' | 
          'announcement_summary' | 'trend_analysis';
  stockCode: string;
  params?: {
    period?: '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
    indicators?: string[];
    compareWith?: string[];
  };
  userContext?: {
    userId?: string;
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  };
}
```

### A.2 输出接口

```typescript
interface FinancialSkillOutput {
  status: 'success' | 'error' | 'partial' | 'cached';
  data: {
    stockInfo?: StockInfo;
    indicators?: FinancialIndicators;
    technical?: TechnicalIndicators;
    comparison?: ComparisonResult;
    analysis?: AnalysisReport;
  };
  source: 'Wind Data';
  timestamp: string;
  disclaimer: string;
}
```

---

*本文档由 SelfClaw v3.6.0 Domain Skill Factory 自动生成*  
*版本: 1.0.0 | 日期: 2026-06-12*  
*符合 Microsoft SKILL Pattern 6 章节格式*
