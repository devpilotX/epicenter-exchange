# Algo signal demos

Open-source, **educational** Python implementations of classic trading signals. Read the code, run the backtests, learn from the failures.

> ⚠️ **Not investment advice. Not a trading system. No accuracy guarantee.** See [`disclaimer.md`](./disclaimer.md).

## Quick start

```bash
cd algo
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Generate today's signals on a single ticker
python simple_signals.py --ticker RELIANCE.NS --strategy sma
python simple_signals.py --ticker AAPL       --strategy rsi
python simple_signals.py --ticker BTC-USD    --strategy macd

# Advanced strategies
python advanced_signals.py --ticker ^NSEI    --strategy meanrev
python advanced_signals.py --ticker ^GSPC    --strategy momentum

# Full backtest with metrics + plot
python backtest.py --ticker RELIANCE.NS --strategy sma --start 2010-01-01
```

## Supported markets (via `yfinance` symbols)

| Market | Examples |
|--------|----------|
| 🇮🇳 India NSE | `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`, `^NSEI` (NIFTY 50), `^NSEBANK` |
| 🇺🇸 United States | `AAPL`, `MSFT`, `GOOGL`, `^GSPC` (S&P 500), `^IXIC` (NASDAQ), `^DJI` |
| 🇬🇧 United Kingdom | `HSBA.L`, `BP.L`, `VOD.L`, `^FTSE`, `^FTMC` |
| 🪙 Crypto | `BTC-USD`, `ETH-USD`, `SOL-USD`, `XRP-USD`, `BNB-USD` |

## Strategies included

### `simple_signals.py`
- **SMA crossover** (50/200) — the classic golden / death cross.
- **RSI** (14) mean-reversion — buy &lt; 30, sell &gt; 70.
- **MACD** (12/26/9) — histogram zero-crossings.

### `advanced_signals.py`
- **Bollinger / Z-score mean-reversion** — trade extremes of a 20-day price-to-mean z-score.
- **Trend-momentum** — 12-month minus 1-month momentum with volatility scaling.
- **ATR position sizing** — equal-risk position sizing helper.

### `backtest.py`
Vectorised backtester. Outputs:
- Total return
- CAGR
- Annualised volatility
- Sharpe ratio (rf = 0)
- Max drawdown
- Win rate
- Equity curve plot (PNG to `algo/plots/`)

## Honest expectations

- These strategies are **textbook**. Production quants spend years on data cleaning, microstructure, regime detection, and risk management before any of this is tradeable.
- Backtests have **look-ahead and survivorship bias** unless you actively prevent them.
- Transaction costs, slippage, taxes, and execution latency are not modeled.
- **Past performance is not predictive.**

## License

MIT. Fork it, learn from it. Don't sell it as a paid "signal service."
