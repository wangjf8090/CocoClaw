# Wind Stock Analyzer 测试场景文档

> **版本**: 1.0.0
> **日期**: 2026-06-12
> **用途**: Wind Stock Analyzer 自动化测试用例
> **覆盖范围**: F01-F10 共10个测试场景

---

## 测试概览

| 测试类型 | 测试数量 | 覆盖能力 |
|----------|----------|----------|
| 实时行情查询 | 3个 | financial-data-read |
| 财务数据分析 | 2个 | financial-data-read, stock-analysis |
| 历史K线查询 | 2个 | financial-data-read |
| 板块/行业分析 | 1个 | sector-analysis |
| 新闻舆情 | 1个 | news-sentiment |
| 股票筛选 | 1个 | screener |

---

## 测试场景详情

### F01: A股实时行情查询

**测试ID**: F01  
**测试类型**: 实时行情查询  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "stock_query",
  "stockCode": "贵州茅台",
  "query": "查贵州茅台实时行情"
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("贵州茅台") 
   → { code: "600519.SH", market: "A", exchange: "SH" }
   
2. WindMCPAdapter.getStockQuote("600519.SH")
   → 调用 wind.stock.quote 接口
   
3. 格式化输出
   → 返回标准化行情数据
```

#### 预期输出 JSON

```json
{
  "status": "success",
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
      "marketCap": 2120000000000,
      "pe_ttm": 28.5,
      "pb": 11.2
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 正确识别中文股票名称
- [ ] 返回完整行情数据（价格/涨跌幅/成交量/市值）
- [ ] 包含免责声明
- [ ] 响应时间 < 2秒

---

### F02: 招商银行财务分析

**测试ID**: F02  
**测试类型**: 财务数据分析  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "financial_analysis",
  "stockCode": "600036.SH",
  "query": "分析招商银行2024年年报",
  "params": {
    "type": "annual",
    "year": 2024
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("600036.SH")
   → { code: "600036.SH", market: "A", exchange: "SH" }
   
2. WindMCPAdapter.getFinancialReport("600036.SH", { type: "annual" })
   → 调用 wind.stock.financial 接口
   
3. WindMCPAdapter.getFinancialIndicators("600036.SH", ["roe", "pe_ttm", "pb", ...])
   → 获取关键财务指标
   
4. 生成结构化财务分析报告
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "stockInfo": {
      "code": "600036.SH",
      "name": "招商银行"
    },
    "financialReport": {
      "period": "2024",
      "type": "annual",
      "revenue": 33912400,
      "netProfit": 14830800,
      "roe": 16.22,
      "nplRatio": 0.95
    },
    "indicators": {
      "pe_ttm": 5.8,
      "pb": 0.85,
      "roe": 16.22,
      "grossMargin": null,
      "netMargin": 43.72
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 正确获取年报数据
- [ ] 关键财务指标完整（ROE/PE/PB/净利率）
- [ ] 包含同比变化数据
- [ ] 包含免责声明

---

### F03: 苹果与微软估值对比

**测试ID**: F03  
**测试类型**: 多股票对比分析  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "valuation_comparison",
  "stockCode": ["AAPL.O", "MSFT.O"],
  "query": "对比苹果和微软估值",
  "params": {
    "indicators": ["pe_ttm", "pb", "roe", "revenue_growth"]
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("AAPL.O") 
   → { code: "AAPL.O", market: "US", exchange: "NASDAQ" }
   
2. normalizeStockCode("MSFT.O") 
   → { code: "MSFT.O", market: "US", exchange: "NASDAQ" }
   
3. WindMCPAdapter.compareStocks(["AAPL.O", "MSFT.O"], ["pe_ttm", "pb", "roe", "revenue_growth"])
   → 批量获取数据
   
4. 生成对比表格
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "stocks": [
      {
        "code": "AAPL.O",
        "name": "Apple Inc.",
        "price": 182.50,
        "changePercent": 1.25,
        "marketCap": 2850000000000
      },
      {
        "code": "MSFT.O",
        "name": "Microsoft Corporation",
        "price": 425.80,
        "changePercent": 0.85,
        "marketCap": 3160000000000
      }
    ],
    "indicators": {
      "AAPL.O": { "pe_ttm": 28.5, "pb": 45.2, "roe": 152.3, "revenue_growth": 4.3 },
      "MSFT.O": { "pe_ttm": 35.2, "pb": 12.8, "roe": 38.5, "revenue_growth": 15.6 }
    },
    "comparison": {
      "pe_ttm": { "AAPL.O": 28.5, "MSFT.O": 35.2, "lower": "AAPL.O" },
      "pb": { "AAPL.O": 45.2, "MSFT.O": 12.8, "lower": "MSFT.O" },
      "roe": { "AAPL.O": 152.3, "MSFT.O": 38.5, "higher": "AAPL.O" }
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 正确处理美股代码格式
- [ ] 同时返回两只股票数据
- [ ] 生成对比分析表格
- [ ] 包含免责声明

---

### F04: A股涨停股筛选

**测试ID**: F04  
**测试类型**: 股票筛选  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "announcement_summary",
  "query": "最近一周A股涨停股有哪些",
  "params": {
    "limitUp": true,
    "period": "1w",
    "market": "A"
  }
}
```

#### 预期 SKILL 调用链

```
1. WindMCPAdapter.screenStocks({
     limitUp: true,
     period: "1w",
     market: "A"
   })
   → 调用 wind.stock.screener 接口
   
2. 格式化涨停股列表
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "totalCount": 45,
    "filters": {
      "limitUp": true,
      "period": "1w",
      "market": "A"
    },
    "stocks": [
      {
        "code": "300999.SZ",
        "name": "金龙鱼",
        "price": 32.50,
        "changePercent": 20.00,
        "reason": "业绩预增"
      },
      {
        "code": "600519.SH",
        "name": "贵州茅台",
        "price": 1688.00,
        "changePercent": 10.00,
        "reason": "板块带动"
      }
    ]
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 返回涨停股票列表
- [ ] 包含涨停原因
- [ ] 支持按时间范围筛选
- [ ] 包含免责声明

---

### F05: 特斯拉历史K线

**测试ID**: F05  
**测试类型**: 历史K线查询  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "trend_analysis",
  "stockCode": "TSLA.O",
  "query": "帮我查一下特斯拉的历史K线",
  "params": {
    "period": "1y",
    "adjust": "qfq"
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("TSLA.O")
   → { code: "TSLA.O", market: "US", exchange: "NASDAQ" }
   
2. WindMCPAdapter.getHistoricalData("TSLA.O", "1y", "qfq")
   → 调用 wind.stock.history 接口
   
3. 计算技术指标（MA5/MA20/MA60）
4. 生成K线图表（Markdown格式）
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "stockInfo": {
      "code": "TSLA.O",
      "name": "Tesla Inc.",
      "period": "1y"
    },
    "klines": [
      { "date": "2025-06-12", "open": 175.50, "high": 180.20, "low": 174.80, "close": 178.90, "volume": 85000000 },
      { "date": "2025-06-13", "open": 179.00, "high": 182.50, "low": 178.20, "close": 181.30, "volume": 92000000 }
    ],
    "statistics": {
      "highest": 358.50,
      "lowest": 138.80,
      "avgVolume": 95000000,
      "changePercent": -42.5
    },
    "indicators": {
      "ma5": 180.25,
      "ma20": 175.50,
      "ma60": 185.20
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 正确处理美股代码
- [ ] 返回1年日K线数据
- [ ] 支持前复权处理
- [ ] 包含免责声明

---

### F06: 港股腾讯实时行情

**测试ID**: F06  
**测试类型**: 港股实时行情  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "stock_query",
  "stockCode": "00700.HK",
  "query": "港股腾讯的实时行情"
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("00700.HK")
   → { code: "00700.HK", market: "HK", exchange: "HK" }
   
2. WindMCPAdapter.getStockQuote("00700.HK")
   → 调用 wind.stock.quote 接口
   
3. 标注港股标识
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "stockInfo": {
      "code": "00700.HK",
      "name": "腾讯控股",
      "exchange": "HK",
      "marketType": "港股主板",
      "price": 385.20,
      "change": -5.60,
      "changePercent": -1.43,
      "volume": 15200000,
      "turnover": 5850000000,
      "marketCap": 3580000000000,
      "currency": "HKD",
      "pe_ttm": 18.5
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 正确处理港股代码格式
- [ ] 标注港股标识
- [ ] 显示港元报价
- [ ] 包含免责声明

---

### F07: 芯片板块龙头股

**测试ID**: F07  
**测试类型**: 板块分析  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "sector_analysis",
  "query": "查找芯片板块龙头股",
  "params": {
    "sector": "半导体"
  }
}
```

#### 预期 SKILL 调用链

```
1. WindMCPAdapter.getIndustryCompare("半导体")
   → 调用 wind.stock.sector 接口
   
2. 识别龙头股（按市值/涨幅排序）
3. 生成板块分析报告
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "sectorAnalysis": {
      "sectorName": "半导体",
      "sectorCode": "884760",
      "sectorIndex": {
        "code": "884760.WI",
        "name": "半导体指数",
        "changePercent": 2.35,
        "pe": 45.8,
        "pb": 5.2
      },
      "leaders": [
        { "code": "688981.SH", "name": "中芯国际", "changePercent": 3.25, "marketCap": 1850000000000, "isLeader": true },
        { "code": "002371.SZ", "name": "北方华创", "changePercent": 4.15, "marketCap": 1680000000000, "isLeader": true },
        { "code": "688256.SH", "name": "寒武纪", "changePercent": 5.82, "marketCap": 1250000000000, "isLeader": true }
      ]
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 返回板块成分股列表
- [ ] 正确识别龙头股
- [ ] 包含板块指数数据
- [ ] 包含免责声明

---

### F08: 宁德时代研报摘要

**测试ID**: F08  
**测试类型**: 新闻舆情  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "announcement_summary",
  "stockCode": "300750.SZ",
  "query": "宁德时代的研报摘要",
  "params": {
    "limit": 5
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("300750.SZ")
   → { code: "300750.SZ", market: "MOT", exchange: "SZ" }
   
2. WindMCPAdapter.getNewsSentiment("300750.SZ", { days: 30, limit: 5 })
   → 调用 wind.stock.news 接口
   
3. 生成研报摘要列表
```

#### 预期输出 JSON

```json
{
  "status": "success",
  "data": {
    "newsSentiment": {
      "stockCode": "300750.SZ",
      "stockName": "宁德时代",
      "newsCount": 28,
      "sentiment": "positive",
      "sentimentScore": 25,
      "recentNews": [
        {
          "title": "宁德时代发布神行PLUS电池",
          "source": "证券时报",
          "timestamp": "2026-06-10",
          "sentiment": "positive"
        },
        {
          "title": "宁德时代与多家车企签订战略合作",
          "source": "上海证券报",
          "timestamp": "2026-06-08",
          "sentiment": "positive"
        }
      ]
    }
  },
  "source": "Wind Data",
  "timestamp": "2026-06-12T10:30:00+08:00",
  "disclaimer": "数据仅供参考，不构成投资建议"
}
```

#### 验收标准

- [ ] 返回近期新闻列表
- [ ] 包含情感分析
- [ ] 标注新闻来源
- [ ] 包含免责声明

---

### F09: 工商银行基本面综合分析

**测试ID**: F09  
**测试类型**: 综合分析  
**优先级**: P0（核心功能）

#### 输入

```json
{
  "intent": "financial_analysis",
  "stockCode": "601398.SH",
  "query": "帮我分析工商银行基本面",
  "params": {
    "analysisType": "fundamental"
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("601398.SH")
2. 并行调用：
   - getStockQuote("601398.SH")
   - getFinancialReport("601398.SH")
   - getFinancialIndicators("601398.SH", [...])
3. 生成综合基本面分析报告
```

#### 验收标准

- [ ] 返回实时行情
- [ ] 返回财务指标
- [ ] 返回估值数据
- [ ] 包含免责声明

---

### F10: 小米集团港股K线分析

**测试ID**: F10  
**测试类型**: 港股历史数据  
**优先级**: P1（高级功能）

#### 输入

```json
{
  "intent": "trend_analysis",
  "stockCode": "01810.HK",
  "query": "小米集团港股近三月走势",
  "params": {
    "period": "3m",
    "adjust": "qfq"
  }
}
```

#### 预期 SKILL 调用链

```
1. normalizeStockCode("01810.HK")
   → { code: "01810.HK", market: "HK", exchange: "HK" }
   
2. WindMCPAdapter.getHistoricalData("01810.HK", "3m", "qfq")
3. 生成港股K线图表
```

#### 验收标准

- [ ] 正确处理小米港股代码
- [ ] 返回3月日K数据
- [ ] 支持复权处理
- [ ] 包含免责声明

---

## 边界条件测试

### BC01: 停牌股票

**输入**: 乐视股票（已停牌）  
**预期**: 返回 `suspended: true` 状态

### BC02: 代码错误

**输入**: "600519"（缺少.SH）  
**预期**: 自动补全后查询

### BC03: 非交易时段

**输入**: 周六查询实时行情  
**预期**: 提示非交易时段，返回最近交易日数据

### BC04: 美股节假日

**输入**: 美国独立日查询美股  
**预期**: 提示非交易日

---

## 性能基准

| 基准ID | 任务 | 性能要求 | 验收标准 |
|--------|------|----------|----------|
| BT-1 | 单股票实时行情 | < 2秒 | 返回完整行情 |
| BT-2 | 财务分析报告 | < 10秒 | 生成3大表指标 |
| BT-3 | 10只股票对比 | < 30秒 | 输出对比表格 |
| BT-4 | 历史K线查询 | < 5秒 | 返回1年数据 |
| BT-5 | 涨停股筛选 | < 10秒 | 返回涨停列表 |

---

*本文档由 SelfClaw v3.6.0 Domain Skill Factory 自动生成*
