---
name: stock-analysis
description: 股票个股分析，支持多数据源自动切换，实时获取价格涨跌幅，计算技术指标和支撑位，识别缺口并判断支撑压力，智能预测未来3天走势并给出操作建议
dependency:
  python:
    - requests>=2.28.0
    - numpy>=1.24.0
    - pandas>=2.0.0
    # openclaw>=0.1.0  # 可选依赖，未安装时可使用备用数据源
  system:
    # pip install openclaw-china-market-gateway  # 可选安装

# 股票个股分析

## 任务目标
- 本 Skill 用于：对指定股票进行全面的技术分析，包括实时数据获取、技术指标计算、支撑位压力位分析、缺口识别分析
- 能力包含：实时行情获取、技术指标计算（均线、MACD、RSI）、支撑位压力位识别、缺口识别（向上/向下缺口及支撑压力作用）、趋势判断、未来走势预测
- 触发条件：用户提供股票代码并要求分析走势、预测未来、获取操作建议

## 前置准备
- 依赖说明（必需）：
  ```
  requests>=2.28.0
  numpy>=1.24.0
  pandas>=2.0.0
  ```
- 依赖说明（可选）：
  ```
  openclaw>=0.1.0  # 可选，提供更多数据源支持
  ```

## 操作步骤

### 标准流程

1. **获取股票代码并验证**
   - 用户提供股票代码，如：000001（平安银行）、sh600000（浦发银行）、000001.SZ（深交所格式）
   - 参考股票代码格式文档，确保代码格式正确

2. **获取实时行情数据（多数据源支持）**
   - 调用 `scripts/fetch_stock_data.py` 获取实时行情和历史K线数据
   - **多数据源自动切换机制**：
     - 主数据源：新浪财经（免费、稳定）
     - 备用数据源1：东方财富（免费、稳定）
     - 备用数据源2：雪球（免费、稳定）
     - 自动切换：主数据源失败时自动尝试备用数据源
   - 参数：
     - `--stock_code`: 股票代码（必需）
     - `--days`: 获取历史数据天数（默认30天）
     - `--source`: 指定数据源（可选，可选值：sina/eastmoney/xueqiu，不指定则自动切换）
   - 返回包含：当前价格、涨跌幅、成交量、历史K线数据、数据源信息

3. **计算技术指标和支撑位**
   - 调用 `scripts/analyze_stock.py` 进行技术分析
   - 参数：
     - `--data_file`: 上一步获取的数据文件路径
   - 计算结果：
     - MA5/MA10/MA20/MA60 均线
     - MACD 指标
     - RSI 指标
     - 支撑位和压力位
     - **缺口分析**（向上缺口和向下缺口）
     - 成交量分析
     - 趋势判断

4. **分析当前走势**
   - 基于技术指标进行多维度分析：
     - 均线排列（多头排列/空头排列/缠绕）
     - MACD金叉死叉状态
     - RSI超买超卖状态
     - 成交量配合情况
     - K线形态分析
     - **缺口分析**：
       - 向上缺口：通常构成支撑位（回调时缺口上沿可能成为支撑）
       - 向下缺口：通常构成压力位（反弹时缺口下沿可能成为压力）
       - 缺口大小和位置对走势的影响

5. **预测未来3天走势**
   - 综合技术指标和趋势分析，对未来3天走势进行判断
   - 考虑因素：趋势方向、支撑压力位、**缺口支撑压力**、成交量变化、市场情绪
   - 给出概率评估：上涨/下跌/横盘的概率和强度

6. **生成操作建议**
   - 根据分析结果和预测，给出明确的操作建议：
     - 买入/持有/卖出/观望
     - 建议的买入/卖出价格区间
     - 止损位和止盈位设置
     - **缺口相关的操作提示**（如：向上缺口未回补前可作为支撑参考）

## 资源索引
- 获取数据：见 [scripts/fetch_stock_data.py](scripts/fetch_stock_data.py)（用途：多数据源获取股票数据，支持自动切换）
- 技术分析：见 [scripts/analyze_stock.py](scripts/analyze_stock.py)（用途：计算技术指标和支撑位压力位）
- 代码格式：见 [references/stock_code_format.md](references/stock_code_format.md)（用途：股票代码格式参考）
- openclaw集成（可选）：见 [scripts/fetch_stock_data_openclaw.py](scripts/fetch_stock_data_openclaw.py)（用途：基于openclaw的数据获取，需安装openclaw）

## ⚠️ Failure Modes & Troubleshooting

本章节记录股票分析系统的**典型失败场景**、**失败原因**和**具体修复方法**。

### 场景1：数据获取返回空值或格式错误

**失败原因**：
- 股票代码格式不正确（如缺少市场前缀）
- 交易所休市期间无数据
- 数据源临时维护或限流
- 网络问题导致请求失败

**判断标准**：
- 返回 `{}` 或空 JSON
- 返回 `{'error': 'Invalid stock code'}`
- 返回数据但缺少 `close`/`volume` 等必要字段

**修复流程**：
```bash
# 1. 检查股票代码格式（必须包含市场标识）
# 正确格式示例：
#   A股沪市: sh600000, 600000
#   A股深市: sz000001, 000001, 000001.SZ
#   港股: 00700.HK, HK00700
#   美股: AAPL, GOOGL

# 2. 如果是格式问题，尝试自动补全
python3 scripts/fetch_stock_data.py --stock_code 600519 --days 30
# 如果失败，尝试带前缀：
python3 scripts/fetch_stock_data.py --stock_code sh600519 --days 30

# 3. 检查是否是休市时间
# A股交易时间：周一至周五 9:30-11:30, 13:00-15:00
# 港股交易时间：周一至周五 9:30-12:00, 13:00-16:00
# 美股交易时间：周一至周五 21:30-次日4:00（夏令时）

# 4. 尝试切换数据源
python3 scripts/fetch_stock_data.py --stock_code sh600519 \
  --source eastmoney --days 30
# 如果东方财富也失败：
python3 scripts/fetch_stock_data.py --stock_code sh600519 \
  --source xueqiu --days 30

# 5. 检查网络连接
curl -I --max-time 10 https://hq.sinajs.cn/list/sh600519
```

### 场景2：技术指标计算结果异常（如均线为 NaN）

**失败原因**：
- 历史数据不足（`--days` 设置过少，如少于 60 天但需要计算 MA60）
- 数据中存在 None/空值
- 数据格式不统一（日期格式、复权处理等）

**判断标准**：
- 输出显示 `MA5: nan`, `MA20: nan`
- 图表显示异常的水平线
- 报错 `ValueError: cannot reindex from a duplicate axis`

**修复流程**：
```bash
# 1. 增加数据获取天数
python3 scripts/fetch_stock_data.py --stock_code sh600519 --days 60
python3 scripts/analyze_stock.py --data_file stock_data_sh600519.json

# 2. 检查数据文件内容
cat stock_data_sh600519.json | python3 -m json.tool | head -50

# 3. 如果数据中有空值，需要在分析前清洗
python3 -c "
import pandas as pd
import json

with open('stock_data_sh600519.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)
# 清洗空值
df = df.dropna(subset=['close', 'volume'])
df = df[df['volume'] > 0]  # 过滤停牌日
df = df.sort_values('date')

with open('stock_data_sh600519_clean.json', 'w') as f:
    json.dump(df.to_dict('records'), f, ensure_ascii=False)
"

# 4. 使用清洗后的数据重新分析
python3 scripts/analyze_stock.py --data_file stock_data_sh600519_clean.json
```

### 场景3：港股/美股代码无法识别

**失败原因**：
- 港股代码格式不统一（00700 vs 00700.HK vs HK:00700）
- 美股代码有重名（如 "BB" 可能是 BlackBerry 或 Beyond Meat）
- 数据源不支持特定交易所

**判断标准**：
- 返回 "Stock code not supported"
- 数据返回但显示错误的市场（如港股显示为 A股）
- 热搜数据与实际不符

**修复流程**：
```bash
# 1. 使用正确的港股格式（推荐带 .HK 后缀）
python3 scripts/fetch_stock_data.py --stock_code 00700.HK --days 30

# 2. 使用正确的美股格式（大写）
python3 scripts/fetch_stock_data.py --stock_code AAPL --days 30

# 3. 如果数据源不支持，尝试备用源
python3 scripts/fetch_stock_data.py --stock_code AAPL \
  --source xueqiu --days 30

# 4. 检查数据源支持的交易所列表
python3 scripts/fetch_stock_data.py --help 2>&1 | grep -i "support"
```

### 场景4：止损止盈设置不合理

**失败原因**：
- 止损位设置过于接近当前价格（如 1% 以内），容易被噪音触发
- 止盈位设置过于激进，超出技术分析支持范围
- 没有考虑缺口回补导致的假突破

**判断标准**：
- 止损位在近期支撑位下方不足 2%
- 止盈位在历史压力位上方超过 10%
- 建议与用户风险承受能力不匹配

**修复流程**：
```python
# 合理的止损止盈计算逻辑

def calculate_stop_loss_take_profit(analysis_result):
    current_price = analysis_result['current_price']
    support = analysis_result['support_levels'][-1]  # 最近支撑位
    resistance = analysis_result['resistance_levels'][0]  # 最近压力位
    atr = analysis_result.get('atr', current_price * 0.02)  # 平均真实波幅
    
    # 止损位：支撑位下方 1-2 个 ATR，或支撑位下方 3-5%
    stop_loss = min(support * 0.97, current_price - 1.5 * atr)
    
    # 止盈位：压力位附近，或 1:2 风险收益比
    risk = current_price - stop_loss
    take_profit_1 = current_price + risk * 1.5  # 1.5 倍风险
    take_profit_2 = resistance * 0.98  # 压力位下方留 2% 空间
    take_profit = min(take_profit_1, take_profit_2)
    
    # 检查缺口影响
    gaps = analysis_result.get('gaps', [])
    for gap in gaps:
        if gap['type'] == 'down_gap':
            # 向下缺口构成压力，降低止盈预期
            if take_profit > gap['bottom']:
                take_profit = gap['bottom'] * 0.98
    
    return {
        'stop_loss': round(stop_loss, 2),
        'take_profit': round(take_profit, 2),
        'risk_reward_ratio': round((take_profit - current_price) / (current_price - stop_loss), 2)
    }
```

### 场景5：缺口分析识别错误

**失败原因**：
- 数据复权处理不当，导致历史价格断裂
- 缺口阈值设置不合理（如 0.1% 也算缺口）
- 识别逻辑未考虑开盘跳空与收盘回补

**判断标准**：
- 大量微小缺口（<0.5%）被识别
- 缺口位置在历史支撑压力位附近但未标注
- 明显的向上跳空缺口未被识别

**修复流程**：
```python
# 合理的缺口识别逻辑

def identify_gaps(kline_data, min_gap_ratio=0.01):
    """
    识别缺口，最小缺口幅度默认 1%
    """
    gaps = []
    for i in range(1, len(kline_data)):
        prev_close = kline_data[i-1]['close']
        curr_open = kline_data[i]['open']
        
        gap_up_ratio = (curr_open - prev_close) / prev_close
        gap_down_ratio = (prev_close - curr_open) / prev_close
        
        if gap_up_ratio >= min_gap_ratio:
            gaps.append({
                'type': 'up_gap',
                'date': kline_data[i]['date'],
                'bottom': curr_open,
                'top': kline_data[i]['high'],
                'ratio': round(gap_up_ratio * 100, 2),
                'support_role': True,  # 向上缺口通常构成支撑
                'support_level': curr_open  # 缺口下沿是支撑位
            })
        elif gap_down_ratio >= min_gap_ratio:
            gaps.append({
                'type': 'down_gap',
                'date': kline_data[i]['date'],
                'top': curr_open,
                'bottom': kline_data[i]['low'],
                'ratio': round(gap_down_ratio * 100, 2),
                'resistance_role': True,  # 向下缺口通常构成压力
                'resistance_level': curr_open  # 缺口上沿是压力位
            })
    
    return gaps

def get_gap_analysis(gaps, current_price):
    """
    生成缺口分析建议
    """
    if not gaps:
        return "近期无明显缺口，关注常规支撑压力位"
    
    # 找出未回补的缺口
    unfilled_gaps = []
    for gap in gaps:
        if gap['type'] == 'up_gap':
            # 向上缺口未回补：当前价格高于缺口下沿
            if current_price >= gap['bottom']:
                unfilled_gaps.append(gap)
        else:
            # 向下缺口未回补：当前价格低于缺口上沿
            if current_price <= gap['top']:
                unfilled_gaps.append(gap)
    
    analysis = []
    for gap in unfilled_gaps[:3]:  # 只显示最近3个未回补缺口
        if gap['type'] == 'up_gap':
            analysis.append(
                f"向上缺口 {gap['ratio']}%（{gap['date']}）："
                f"缺口下沿 {gap['bottom']} 构成支撑，"
                f"回调至该位置可考虑买入，"
                f"若跌破则缺口回补，下方看 {gap.get('next_support', '前低')}"
            )
        else:
            analysis.append(
                f"向下缺口 {gap['ratio']}%（{gap['date']}）："
                f"缺口上沿 {gap['top']} 构成压力，"
                f"反弹至该位置可考虑卖出，"
                f"若突破则看 {gap.get('next_resistance', '前高')}"
            )
    
    return "\n".join(analysis) if analysis else "近期缺口均已回补，关注常规支撑压力位"
```

### 场景6：多数据源切换后数据不一致

**失败原因**：
- 不同数据源的复权方式不同（前复权 vs 后复权 vs 不复权）
- 数据延迟不同（新浪延迟最低，雪球可能有 15 分钟延迟）
- 涨停/跌停数据记录方式不同

**判断标准**：
- 同一只股票不同源的价格差异 > 0.5%
- 均线值在不同源之间差异明显
- 缺口识别结果因数据源不同而不同

**修复流程**：
```bash
# 1. 检查各数据源的复权方式
python3 scripts/fetch_stock_data.py --stock_code sh600519 \
  --source sina --days 30  # 默认前复权

python3 scripts/fetch_stock_data.py --stock_code sh600519 \
  --source eastmoney --days 30 \
  --adjust qfq  # 东方财富指定前复权

# 2. 对比数据一致性
python3 -c "
import json

# 读取两个数据源的结果
with open('sina_data.json') as f:
    sina = json.load(f)
with open('eastmoney_data.json') as f:
    em = json.load(f)

# 比较最近一天收盘价
print(f'新浪: {sina[-1][\"close\"]}')
print(f'东方财富: {em[-1][\"close\"]}')

# 计算差异
diff = abs(sina[-1]['close'] - em[-1]['close']) / sina[-1]['close'] * 100
print(f'差异: {diff:.2f}%')
"

# 3. 如果差异过大，使用主数据源并注明
# 最终报告中标注：
# ⚠️ 数据来源：新浪财经（实时）
# ⚠️ 价格为前复权价格
```

## 🔒 Safety & High-Risk Operations

以下操作具有**不可逆性**或**高风险性**，执行前必须确认条件。

### 风险操作1：将分析结果作为直接投资建议

**风险等级**：🔴 极高风险

**为什么危险**：
- 技术分析基于历史数据，不能预测未来
- 市场受政策、资金、情绪等多因素影响
- AI 分析可能存在数据错误或模型偏差
- 历史表现不代表未来收益

**禁止行为**：
```markdown
# 绝对禁止在报告中使用以下表述
- "建议买入 XXX，必然上涨"
- "按照我的分析，明天 XXX 必涨 10%"
- "这只股票稳赚不赔"
- "跟着分析操作，保证盈利"
```

**必须添加的免责声明**：
```markdown
## ⚠️ 风险提示（必须包含）

1. **市场有风险，投资需谨慎**。本分析仅供参考，不构成任何投资建议。
2. 技术分析基于历史数据，过去的表现不能预测未来的走势。
3. 股票市场受政策变化、资金流动、市场情绪等多重因素影响，存在不确定性。
4. 请根据自身风险承受能力谨慎决策，必要时咨询专业投资顾问。
5. 实盘操作造成的盈亏，由投资者自行承担。
```

### 风险操作2：使用涨停板数据时未考虑涨跌停限制

**风险等级**：🟠 中高风险

**为什么危险**：
- A股有涨跌停限制（主板 ±10%，创业板/科创板 ±20%）
- 涨停时无法买入，跌停时无法卖出
- 缺口理论在涨跌停场景下可能失效

**禁止行为**：
```python
# 不要基于涨跌停数据给出"追涨杀跌"建议
if change_percent > 9.5:
    suggest_buy()  # 危险！第二天可能直接涨停或开板

if change_percent < -9.5:
    suggest_sell()  # 危险！可能卖在最低点
```

**安全分析逻辑**：
```python
def check_limit_up_down(kline_data):
    """
    检查是否存在涨跌停，判断是否需要特殊处理
    """
    last_day = kline_data[-1]
    change = (last_day['close'] - last_day['prev_close']) / last_day['prev_close'] * 100
    
    # 判断涨跌停
    limit_up = False
    limit_down = False
    
    # 简化判断（实际需要根据板块确定阈值）
    if change >= 9.8:
        limit_up = True
    elif change <= -9.8:
        limit_down = True
    
    return {
        'limit_up': limit_up,
        'limit_down': limit_down,
        'change_percent': round(change, 2),
        'warning': '涨停板次日可能出现高开低走，不建议追涨' if limit_up else \
                   '跌停板次日可能出现低开高走，不建议杀跌' if limit_down else None
    }
```

### 风险操作3：使用杠杆或融资炒股时未考虑爆仓风险

**风险等级**：🔴 极高风险

**为什么危险**：
- 杠杆交易放大收益的同时放大亏损
- 止损设置不合理可能导致爆仓
- 市场剧烈波动时可能触发强制平仓

**禁止行为**：
```python
# 杠杆炒股不建议使用本技能的分析结果作为唯一依据
# 融资融券账户的止损需要额外考虑维持担保比例

# 绝对不要给出类似以下的建议
suggestions = {
    "杠杆买入": "使用3倍杠杆全仓买入",
    "止损设置": "止损设在 1%，超过立即平仓"  # 风险极大
}
```

**安全建议格式**：
```markdown
## 杠杆交易特别提示

⚠️ 使用杠杆或融资炒股时：
1. 止损位应比普通账户更宽松（建议 3-5 倍）
2. 仓位管理：杠杆倍数 × 单股仓位 ≤ 30%
3. 保留足够保证金，避免强制平仓
4. 设置预警线，提前减仓

示例（仅供参考）：
- 3 倍杠杆：止损幅度建议 ≥ 7%（A股主板）
- 维持担保比例预警线：建议 150% 以上
```

### 风险操作4：迷信单一技术指标

**风险等级**：🟠 中风险

**为什么危险**：
- 单一指标可能被主力刻意操纵（如画线骗线）
- 不同指标可能发出矛盾信号
- 市场极端行情下指标可能失效

**禁止行为**：
```python
# 不要仅凭单一指标做出决策
if macd_golden_cross:
    suggest_buy()  # 危险！只凭 MACD 金叉就买入

if rsi < 30:
    suggest_buy()  # 危险！RSI 超卖可能继续跌
```

**安全分析逻辑**：
```python
def multi_indicator_analysis(ma_result, macd_result, rsi_result, volume_result):
    """
    多指标综合分析，需要至少 3 个指标信号一致才可参考
    """
    signals = []
    
    # 均线系统
    if ma_result['trend'] == 'bullish':
        signals.append(1)
    elif ma_result['trend'] == 'bearish':
        signals.append(-1)
    else:
        signals.append(0)
    
    # MACD
    if macd_result['signal'] == 'golden_cross':
        signals.append(1)
    elif macd_result['signal'] == 'death_cross':
        signals.append(-1)
    else:
        signals.append(0)
    
    # RSI
    if rsi_result['value'] < 30:
        signals.append(1)  # 超卖，可能反弹
    elif rsi_result['value'] > 70:
        signals.append(-1)  # 超买，可能回调
    else:
        signals.append(0)
    
    # 成交量
    if volume_result['trend'] == 'increasing':
        signals.append(1)
    elif volume_result['trend'] == 'decreasing':
        signals.append(-1)
    else:
        signals.append(0)
    
    total = sum(signals)
    
    if total >= 3:
        return "多指标共振信号，可考虑顺势操作"
    elif total <= -3:
        return "多指标共振看空信号，建议谨慎"
    else:
        return "指标信号不一致，建议观望，等待明确信号"
```

### 风险操作5：分析停牌或退市股票

**风险等级**：🔴 高风险

**为什么危险**：
- 停牌期间无法买卖，分析结果无实际意义
- 退市股票流动性极差，可能无法卖出
- 科创板、创业板退市后无整理期

**禁止行为**：
```bash
# 分析已退市或长期停牌的股票
python3 scripts/fetch_stock_data.py --stock_code sh600056
# 如果返回数据异常，检查是否为退市股

# 不要给出针对停牌股的操作建议
# 停牌期间的"技术分析"毫无意义
```

**安全分析逻辑**：
```python
def check_stock_status(data):
    """
    检查股票状态，识别停牌或退市风险
    """
    if not data or len(data) == 0:
        return {
            'status': 'unknown',
            'warning': '无法获取数据，请检查股票代码是否正确'
        }
    
    last_data = data[-1]
    
    # 检查最近交易日距今天数
    import datetime
    last_date = datetime.datetime.strptime(last_data['date'], '%Y-%m-%d')
    days_since = (datetime.datetime.now() - last_date).days
    
    if days_since > 5:
        return {
            'status': 'suspended_or_delisted',
            'warning': f'该股票最后交易日期为 {last_data["date"]}，'
                      f'距今 {days_since} 天，可能已停牌或退市，'
                      f'本分析结果仅供参考，不构成投资建议'
        }
    
    # 检查成交量
    if last_data.get('volume', 0) == 0:
        return {
            'status': 'no_trading',
            'warning': '最近交易日无成交量，可能处于停牌状态'
        }
    
    return {
        'status': 'normal',
        'warning': None
    }
```

## 注意事项
- 股票市场存在风险，所有分析仅供参考，不构成投资建议
- 技术分析基于历史数据，不能保证未来表现
- 建议结合基本面分析和市场环境进行综合判断
- 实时数据可能存在延迟，请以实际交易数据为准
- **数据源说明**：
  - 系统支持多数据源自动切换，提高数据获取稳定性
  - 默认使用新浪财经作为主数据源，失败时自动尝试东方财富和雪球
  - 可通过 `--source` 参数指定使用特定数据源
  - 数据源状态会在输出中明确显示
  - 如遇所有数据源均失败，请检查网络连接或稍后重试
- **openclaw 说明**（可选）：
  - openclaw 是一个开源的中国市场数据网关项目
  - 支持更多数据源（SSE/SZSE/东方财富/新浪/雪球等）
  - 目前可能未正式发布到 PyPI，建议使用已集成的备用数据源
  - 如需使用 openclaw，可从源码安装：`pip install git+https://github.com/Etherdrake/openclaw-china-market-gateway.git`
  - 未安装 openclaw 时，使用 `fetch_stock_data.py` 即可获得完整功能
- **缺口分析要点**：
  - 向上缺口（跳空高开）：通常在回调时可能构成支撑，关注缺口是否回补
  - 向下缺口（跳空低开）：通常在反弹时可能构成压力，关注缺口是否回补
  - 缺口越大，其支撑或压力作用通常越强
  - 成交量配合的缺口更具参考意义
  - 近期缺口的参考价值高于远期缺口
- 必须在所有建议中包含风险提示

## 使用示例

### 示例1：A股股票分析（推荐方式）
```
用户：分析002639雪人集团
执行：
1. 调用 fetch_stock_data.py --stock_code 002639 --days 30
2. 调用 analyze_stock.py --data_file stock_data_002639.json
3. 基于分析结果生成走势预测和操作建议
```

### 示例2：港股股票分析
```
用户：分析腾讯控股 00700.HK
执行：
1. 调用 fetch_stock_data.py --stock_code 00700.HK --days 30
2. 调用 analyze_stock.py --data_file stock_data_00700.HK.json
3. 生成分析报告和操作建议
```

### 示例3：指定数据源获取
```
用户：使用东方财富数据源分析贵州茅台
执行：
1. 调用 fetch_stock_data.py --stock_code 600519 --source eastmoney --days 30
2. 调用 analyze_stock.py --data_file stock_data_600519.json
3. 生成分析报告
```

### 示例4：美股股票分析
```
用户：分析AAPL苹果公司
执行：
1. 调用 fetch_stock_data.py --stock_code AAPL --days 30
2. 调用 analyze_stock.py --data_file stock_data_AAPL.json
3. 提供全面的技术分析报告
```

## 故障排查

### 问题：数据获取失败
**解决方案**：
1. 检查网络连接
2. 尝试指定其他数据源：`--source eastmoney` 或 `--source xueqiu`
3. 检查股票代码是否正确

### 问题：openclaw 未安装
**解决方案**：
1. 直接使用 `fetch_stock_data.py`（已实现完整功能）
2. 或尝试从源码安装 openclaw：
   ```bash
   pip install git+https://github.com/Etherdrake/openclaw-china-market-gateway.git
   ```
