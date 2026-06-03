---
name: news-aggregator-skill
description: "Comprehensive news aggregator that fetches, filters, and deeply analyzes real-time content from 28 sources including Hacker News, GitHub, Hugging Face Papers, AI Newsletters, WallStreetCN, Weibo, and Podcasts. Use when user requests 'daily scans', 'tech news', 'finance updates', 'AI briefings', 'deep analysis', or says '如意如意' to open the interactive menu."
---

# News Aggregator Skill

Fetch real-time hot news from 28 sources, generate deep analysis reports in Chinese.

---

## 🔄 Universal Workflow (3 Steps)

**Every** news request follows the same workflow, regardless of source or combination:

### Step 1: Fetch Data
```bash
# Single source
python3 scripts/fetch_news.py --source <source_key> --no-save

# Multiple sources (comma-separated)
python3 scripts/fetch_news.py --source hackernews,github,wallstreetcn --no-save

# All sources (broad scan)
python3 scripts/fetch_news.py --source all --limit 15 --deep --no-save

# With keyword filter (auto-expand: "AI" → "AI,LLM,GPT,Claude,Agent,RAG")
python3 scripts/fetch_news.py --source hackernews --keyword "AI,LLM,Claude" --deep --no-save
```

### Step 2: Generate Report
Read the output JSON and format **every** item using the **Unified Report Template** below. Translate all content to **Simplified Chinese**.

### Step 3: Save & Present
Save the report to `reports/YYYY-MM-DD/<source>_report.md`, then display the full content to the user.

---

## 📰 Unified Report Template

**All sources use this single template.** Show/hide optional fields based on data availability.

```markdown
#### N. [标题 (中文翻译)](https://original-url.com)
- **Source**: 源名 | **Time**: 时间 | **Heat**: 🔥 热度值
- **Links**: [Discussion](hn_url) | [GitHub](gh_url)     ← 仅在数据存在时显示
- **Summary**: 一句话中文摘要。
- **Deep Dive**: 💡 **Insight**: 深度分析（背景、影响、技术价值）。
```

### Source-Specific Adaptations

Only the **differences** from the universal template:

| Source | Adaptation |
|---|---|
| **Hacker News** | **MUST** include `[Discussion](hn_url)` link |
| **GitHub** | Use `🌟 Stars` for Heat, add `Lang` field, add `#Tags` in Deep Dive |
| **Hugging Face** | Use `🔥 +N` upvotes for Heat, include `[GitHub](url)` if present, write **深度解读** (not just translate abstract) |
| **Weibo** | Preserve exact heat text (e.g. "108万") |

---

## 🛠️ Tools

### fetch_news.py

| Arg | Description | Default |
|---|---|---|
| `--source` | Source key(s), comma-separated. See table below. | `all` |
| `--limit` | Max items per source | `15` |
| `--keyword` | Comma-separated keyword filter | None |
| `--deep` | Download article text for richer analysis | Off |
| `--save` | Force save to reports dir | Auto for single source |
| `--outdir` | Custom output directory | `reports/YYYY-MM-DD/` |

### Available Sources (28)

| Category | Key | Name |
|---|---|---|
| **Global News** | `hackernews` | Hacker News |
| | `36kr` | 36氪 |
| | `wallstreetcn` | 华尔街见闻 |
| | `tencent` | 腾讯新闻 |
| | `weibo` | 微博热搜 |
| | `v2ex` | V2EX |
| | `producthunt` | Product Hunt |
| | `github` | GitHub Trending |
| **AI/Tech** | `huggingface` | HF Daily Papers |
| | `ai_newsletters` | All AI Newsletters (aggregate) |
| | `bensbites` | Ben's Bites |
| | `interconnects` | Interconnects (Nathan Lambert) |
| | `oneusefulthing` | One Useful Thing (Ethan Mollick) |
| | `chinai` | ChinAI (Jeffrey Ding) |
| | `memia` | Memia |
| | `aitoroi` | AI to ROI |
| | `kdnuggets` | KDnuggets |
| **Podcasts** | `podcasts` | All Podcasts (aggregate) |
| | `lexfridman` | Lex Fridman |
| | `80000hours` | 80,000 Hours |
| | `latentspace` | Latent Space |
| **Essays** | `essays` | All Essays (aggregate) |
| | `paulgraham` | Paul Graham |
| | `waitbutwhy` | Wait But Why |
| | `jamesclear` | James Clear |
| | `farnamstreet` | Farnam Street |
| | `scottyoung` | Scott Young |
| | `dankoe` | Dan Koe |

### daily_briefing.py (Morning Routines)

Pre-configured multi-source profiles:

```bash
python3 scripts/daily_briefing.py --profile <profile>
```

| Profile | Sources | Instruction File |
|---|---|---|
| `general` | HN, 36Kr, GitHub, Weibo, PH, WallStreetCN | `instructions/briefing_general.md` |
| `finance` | WallStreetCN, 36Kr, Tencent | `instructions/briefing_finance.md` |
| `tech` | GitHub, HN, Product Hunt | `instructions/briefing_tech.md` |
| `social` | Weibo, V2EX, Tencent | `instructions/briefing_social.md` |
| `ai_daily` | HF Papers, AI Newsletters | `instructions/briefing_ai_daily.md` |
| `reading_list` | Essays, Podcasts | (Use universal template) |

**Workflow**: Execute script → Read corresponding instruction file → Generate report following both the instruction file AND the universal template.

---

## ⚠️ Rules (Strict)

1. **Language**: ALL output in **Simplified Chinese (简体中文)**. Keep well-known English proper nouns (ChatGPT, Python, etc.).
2. **Time**: **MANDATORY** field. Never skip. If missing in JSON, mark as "Unknown Time". Preserve "Real-time" / "Today" / "Hot" as-is.
3. **Anti-Hallucination**: Only use data from the JSON. Never invent news items. Use simple SVO sentences. Do not fabricate causal relationships.
4. **Smart Keyword Expansion**: When user says "AI" → auto-expand to `"AI,LLM,GPT,Claude,Agent,RAG,DeepSeek"`. Similar expansions for other domains.
5. **Smart Fill**: If results < 5 items in a time window, supplement with high-value items from wider range. Mark supplementary items with ⚠️.
6. **Save**: Always save report to `reports/YYYY-MM-DD/` before displaying.

---

## 📋 Interactive Menu

When the user says **"如意如意"** or asks for "menu/help":

1. Read `templates.md`
2. Display the menu
3. Execute the user's selection using the **Universal Workflow** above

---

## ⚠️ Failure Modes & Troubleshooting

本章节记录新闻聚合系统的**典型失败场景**、**失败原因**和**具体修复方法**。

### 场景1：数据获取超时或返回空结果

**失败原因**：
- 目标网站限流或暂时不可用（如 HF Papers 依赖 Playwright 渲染）
- 网络代理问题导致特定源无法访问
- 关键词过滤过于严格导致结果为空

**判断标准**：
- 命令返回 `Connection timeout` 或 `HTTP 403`
- JSON 输出为空数组 `[]`
- 错误信息包含 `Playwright` 或 `chromium`

**修复流程**：
```bash
# 1. 检查是否是网络问题
curl -I --max-time 10 https://news.ycombinator.com

# 2. 如果是 HF Papers 问题（依赖 Playwright），检查是否安装
python3 -c "import playwright" 2>/dev/null && echo "Playwright OK" || echo "Playwright Missing"

# 如果未安装：
pip install playwright
playwright install chromium

# 3. 重试时不加 --deep 参数（减少依赖）
python3 scripts/fetch_news.py --source huggingface --limit 10 --no-save

# 4. 如果仍然失败，尝试备用源
# Hugging Face Papers 的备用源是 arXiv trending
python3 scripts/fetch_news.py --source arxiv --limit 10 --keyword "cs.AI,cs.CL" --no-save

# 5. 如果关键词过滤导致为空，移除关键词参数
python3 scripts/fetch_news.py --source hackernews --no-save
```

### 场景2：时间字段缺失或格式混乱

**失败原因**：
- 某些源（如 GitHub Trending）不提供发布时间
- Weibo/微博的相对时间（"2小时前"）未转换
- 多源聚合时时间格式不统一

**判断标准**：
- JSON 中 `time` 字段为空或为 `null`
- 时间显示为 "Unknown Time"
- 时间戳显示为原始格式（如 Unix timestamp）

**修复流程**：
```python
# 在报告生成时处理时间字段
import datetime
import re

def parse_time(time_str):
    if not time_str or time_str == "Unknown":
        return "Unknown Time"
    
    # 处理相对时间
    if "小时前" in time_str:
        match = re.search(r'(\d+)小时前', time_str)
        if match:
            hours = int(match.group(1))
            dt = datetime.datetime.now() - datetime.timedelta(hours=hours)
            return dt.strftime("%Y-%m-%d %H:%M")
    
    # 处理 "Real-time" / "Hot" 等标签
    if time_str in ["Real-time", "Hot", "Today"]:
        return datetime.datetime.now().strftime("%Y-%m-%d")
    
    # 处理 Unix timestamp
    if time_str.isdigit():
        return datetime.datetime.fromtimestamp(int(time_str)).strftime("%Y-%m-%d")
    
    return time_str
```

### 场景3：关键词扩展导致结果过载或遗漏

**失败原因**：
- 用户说"AI"时自动扩展词过多（如 50+ 个）
- 扩展词包含用户实际不需要的领域
- 某些小众关键词未被纳入扩展词库

**判断标准**：
- 返回结果 > 100 条
- 结果中包含明显不相关的条目
- 某些用户明确提到的词未出现在结果中

**修复流程**：
```bash
# 1. 检查关键词扩展日志
grep "keyword expansion" logs/fetch_news.log

# 2. 如果扩展过多，手动指定关键词
python3 scripts/fetch_news.py --source hackernews \
  --keyword "LLM,Claude,GPT-4,RAG" --no-save  # 手动指定，不要"AI"

# 3. 查看扩展词库（scripts/keyword_expander.py）
cat scripts/keyword_expander.py | grep -A10 "EXPANSIONS ="

# 4. 如果需要自定义扩展，编辑 keyword_expander.py
# 添加自定义映射：
# "自动驾驶" -> "自动驾驶,无人车,激光雷达,视觉感知"
```

### 场景4：报告保存失败（目录不存在或权限问题）

**失败原因**：
- `reports/` 目录未创建
- 当前目录无写入权限
- 日期格式错误导致路径无效

**判断标准**：
- 错误信息：`No such file or directory: 'reports/2026-03-21/'`
- 错误信息：`Permission denied`

**修复流程**：
```bash
# 1. 创建报告目录
mkdir -p reports/$(date +%Y-%m-%d)

# 2. 检查写入权限
ls -la . | grep reports
# 如果没有权限：
# chmod u+w .

# 3. 使用 --outdir 指定自定义路径
python3 scripts/fetch_news.py --source hackernews \
  --outdir /tmp/news-reports/ --save

# 4. 复制到目标位置
cp /tmp/news-reports/*.md reports/$(date +%Y-%m-%d)/
```

### 场景5：多源聚合时代码执行到一半停止

**失败原因**：
- 某个源响应极慢导致整体超时
- 内存不足导致进程被 OOM Killer 终止
- 脚本内部错误被静默捕获

**判断标准**：
- 只输出了部分源的结果
- 进程突然退出，无错误信息
- 日志显示某个源处理时间过长

**修复流程**：
```bash
# 1. 设置单源超时
timeout 30 python3 scripts/fetch_news.py --source github --limit 15 --no-save

# 2. 限制并行源数量，避免同时请求过多
# 不要一次请求 all，分批执行
python3 scripts/fetch_news.py --source hackernews,github --limit 10 --no-save
python3 scripts/fetch_news.py --source huggingface,ai_newsletters --limit 10 --no-save

# 3. 添加内存监控
free -h
# 如果内存不足：
# 减少 --limit 参数
python3 scripts/fetch_news.py --source all --limit 5 --no-save

# 4. 启用详细日志
python3 scripts/fetch_news.py --source hackernews --limit 10 --verbose --no-save 2>&1 | tee fetch.log
```

### 场景6：Daily Briefing Profile 执行失败

**失败原因**：
- Profile 对应的 instruction 文件不存在
- Profile 配置的源 key 有误
- instruction 文件格式与预期不符

**判断标准**：
- 错误信息：`Profile 'xxx' not found`
- 错误信息：`Instruction file not found`
- 执行后输出为空或格式错误

**修复流程**：
```bash
# 1. 列出所有可用 profile
python3 scripts/daily_briefing.py --help

# 2. 检查 instruction 文件是否存在
ls -la instructions/

# 3. 如果文件缺失，创建模板
cat > instructions/briefing_custom.md << 'EOF'
# Custom Daily Briefing

## Sources
- hackernews
- github

## Focus Areas
- AI/ML 最新进展
- 开源项目动态

## Report Format
按照 Unified Report Template 生成。
EOF

# 4. 直接指定 instruction 文件执行
python3 scripts/daily_briefing.py \
  --instruction instructions/briefing_custom.md \
  --outdir reports/$(date +%Y-%m-%d)/
```

### 场景7：Deep Dive 分析质量低（引用错误或幻觉）

**失败原因**：
- 原始内容未正确下载（--deep 失败）
- 只翻译了标题就生成分析
- 尝试分析代码/表格等非文本内容

**判断标准**：
- Deep Dive 部分只有标题翻译，没有实际分析
- 分析中出现 JSON 中不存在的信息
- 技术细节明显错误

**修复流程**：
```bash
# 1. 检查 --deep 是否真正获取了内容
python3 scripts/fetch_news.py --source huggingface --limit 3 --deep --save
# 查看 JSON 中是否有 "content" 或 "abstract" 字段

# 2. 如果没有 deep 内容，手动抓取
python3 -c "
import requests
from bs4 import BeautifulSoup

url = 'https://arxiv.org/abs/XXXX'
html = requests.get(url).text
soup = BeautifulSoup(html, 'html.parser')
abstract = soup.find('blockquote', class_='abstract').text
print(abstract)
"

# 3. 在报告中标注数据来源
# 如果 content 字段为空，在 Deep Dive 中标注：
# 💡 **Insight**: （注：原始文章未获取到详细内容，以上分析基于标题推测）
```

## 🔒 Safety & High-Risk Operations

以下操作具有**不可逆性**或**高风险性**，执行前必须确认条件。

### 风险操作1：大量抓取导致对方服务器被封禁

**风险等级**：🔴 高风险

**为什么危险**：
- 短时间内大量请求会被目标网站识别为爬虫
- IP 可能被临时或永久封禁
- 影响其他用户使用同一 IP

**禁止行为**：
```bash
# 不要使用多进程/多线程同时请求同一源
for i in {1..100}; do
  python3 scripts/fetch_news.py --source hackernews &  # 危险！
done

# 不要使用极短间隔的循环请求
while true; do
  python3 scripts/fetch_news.py --source hackernews --no-save
  sleep 1  # 1秒间隔太短
done
```

**安全执行流程**：
```bash
# 1. 使用内置的请求限流
python3 scripts/fetch_news.py --source all --rate-limit 5 --no-save
# 默认请求间隔 5 秒以上

# 2. 限制每日抓取次数
# 在 crontab 中设置：
# 0 9,12,18 * * * python3 scripts/daily_briefing.py --profile general
# 每天只在固定时间抓取

# 3. 如果需要增量更新，使用 --since 参数（如果支持）
python3 scripts/fetch_news.py --source hackernews \
  --since "2026-03-21T00:00:00" --no-save
```

### 风险操作2：保存报告时覆盖重要历史数据

**风险等级**：🟠 中高风险

**为什么危险**：
- 默认保存路径是 `reports/YYYY-MM-DD/`
- 如果同一天多次执行，后面的报告会覆盖前面的
- 可能丢失中间时段的重要新闻

**禁止行为**：
```bash
# 不要覆盖同一天的历史报告
python3 scripts/fetch_news.py --source hackernews --save
# 会覆盖 reports/$(date +%Y-%m-%d)/hackernews_report.md
```

**安全执行流程**：
```bash
# 1. 使用带时间戳的输出文件名
TIMESTAMP=$(date +%H%M%S)
python3 scripts/fetch_news.py --source hackernews \
  --outdir "reports/$(date +%Y-%m-%d)/" \
  --filename "hackernews_${TIMESTAMP}.md" --save

# 2. 或使用子目录按时间段组织
mkdir -p "reports/$(date +%Y-%m-%d)/morning"
mkdir -p "reports/$(date +%Y-%m-%d)/evening"
python3 scripts/fetch_news.py --source all \
  --outdir "reports/$(date +%Y-%m-%d)/morning/" --save

# 3. 定期归档旧报告
find reports/ -name "*.md" -mtime +30 -exec gzip {} \;
```

### 风险操作3：使用 --keyword 过滤时遗漏重要新闻

**风险等级**：🟠 中风险

**为什么危险**：
- 过度依赖关键词过滤可能错过突发新闻
- 如果突发事件未包含目标关键词，将被忽略
- "AI" 的扩展可能包含无关内容

**安全执行流程**：
```bash
# 1. 定期执行全量扫描（不加关键词）
python3 scripts/fetch_news.py --source all --limit 20 --no-save | head -50

# 2. 使用宽泛关键词而非精确匹配
# 差：--keyword "GPT-5发布"（只有精确匹配）
# 好：--keyword "GPT,LLM,大模型"（覆盖更多相关）

# 3. 检查扩展词库是否包含最新热词
grep -i "gpt-5\|sora\|gemini" scripts/keyword_expander.py
# 如果没有，添加：
# "最新模型" -> "GPT-5,Sora,Gemini,Claude 3"
```

### 风险操作4：多源聚合时引入低质量源

**风险等级**：🟠 中风险

**为什么危险**：
- 某些源可能内容质量低或更新不及时
- 混合低质量源会拉低整体报告质量
- 可能引入噪音信息

**安全执行流程**：
```bash
# 1. 检查源的质量（定期审查）
python3 scripts/fetch_news.py --source <source_key> --limit 5 --no-save
# 评估返回内容的质量和相关性

# 2. 创建可信源列表
cat > instructions/approved_sources.md << 'EOF'
# Approved News Sources

## 高质量源（每日必抓）
- hackernews
- github
- huggingface
- wallstreetcn

## 中等质量源（按需抓取）
- 36kr
- v2ex
- producthunt

## 低质量源（避免）
- 某些 RSS 源（过时）
- 某些社交媒体源（噪音多）
EOF

# 3. 只使用 approved sources
python3 scripts/fetch_news.py --source "hackernews,github,huggingface" --no-save
```

## Requirements

- Python 3.8+, `pip install -r requirements.txt`
- Playwright (for HF Papers & Ben's Bites): `playwright install chromium`
