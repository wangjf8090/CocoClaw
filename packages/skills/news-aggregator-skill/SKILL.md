---
name: news-aggregator
description: 全网科技/金融/AI深度新闻聚合，支持28+高价值信源
version: 1.0.0
author: SelfClaw
model_support:
  - gpt-4o
  - claude-3.7-sonnet
  - qwen-3-max
tags:
  - news
  - aggregation
  - daily
  - hackernews
  - tech
domain: data
capability: data-query
---

## Instructions

This skill aggregates news from multiple high-value sources including Hacker News, GitHub Trending, Product Hunt, and Chinese tech media.

### Usage
1. Use `fetch_news.py --source hackernews --limit 10` to fetch from a single source
2. Use `fetch_news.py --source hackernews,github,wallstreetcn` for multi-source aggregation
3. Use `generate_report.py` to create a daily briefing

### Configuration
- Default sources: hackernews, github, wallstreetcn, 36kr
- Rate limit: 100 requests per hour
- Output format: Markdown report

## Examples

- Fetch top 10 Hacker News articles
- Generate morning tech briefing with 3 sources
- Aggregate AI news from the past 24 hours

## Limitations

- Rate limited to 100 requests per hour
- Some sources may require authentication
- Chinese sources may have encoding issues on non-UTF8 terminals
