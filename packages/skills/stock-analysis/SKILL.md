---
name: stock-analysis
description: 专业股票技术分析工具，支持多数据源自动切换、技术指标计算和走势预测
version: 1.0.0
author: SelfClaw
model_support:
  - gpt-4o
  - qwen-3-max
tags:
  - stock
  - finance
  - analysis
  - trading
domain: financial
capability: market-analysis
---

## Instructions

This skill provides professional stock technical analysis with automatic data source switching.

### Data Sources
- Sina Finance (primary)
- East Money (fallback)
- Xueqiu (supplementary)

### Capabilities
1. Real-time stock price and change percentage
2. Technical indicator calculation (MA/MACD/RSI)
3. Support/resistance level identification
4. Gap analysis
5. 3-day trend prediction with confidence

### Usage
```bash
python3 scripts/analyze_stock.py --code 600519
```

### Disclaimer
- 本内容仅供参考，不构成投资建议
- 投资有风险，入市需谨慎

## Examples

- Analyze Kweichow Moutai (600519) technical indicators
- Calculate RSI for Shanghai Composite Index
- Identify support levels for a given stock

## Limitations

- Not financial advice
- Data may have 15-minute delay
- Technical analysis cannot predict black swan events
- Only supports A-share market currently
