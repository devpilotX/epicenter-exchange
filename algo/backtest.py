"""
Vectorised backtester for the simple_signals strategies.

Usage:
    python backtest.py --ticker RELIANCE.NS --strategy sma --start 2010-01-01
    python backtest.py --ticker BTC-USD --strategy rsi  --start 2018-01-01
    python backtest.py --ticker AAPL    --strategy macd --start 2005-01-01

Outputs:
    - Performance metrics to stdout
    - Equity-curve PNG to algo/plots/<ticker>_<strategy>.png

Notes:
    - Long-only, full-capital, no leverage, no costs, no slippage.
    - Signals computed on day t are traded at the OPEN of t+1 (we use close-to-close shift(1)).
    - This is a teaching backtester, not a production framework.
"""
from __future__ import annotations
import argparse
import os
import sys
import numpy as np
import pandas as pd

try:
    import yfinance as yf
    import matplotlib.pyplot as plt
except ImportError:
    sys.exit("Install dependencies first: pip install -r requirements.txt")

from simple_signals import sma_crossover, rsi_mean_reversion, macd_signal

STRAT_FNS = {"sma": sma_crossover, "rsi": rsi_mean_reversion, "macd": macd_signal}


def fetch(ticker: str, start: str) -> pd.DataFrame:
    df = yf.download(ticker, start=start, progress=False, auto_adjust=True)
    if df.empty:
        sys.exit(f"No data for ticker {ticker!r}. Check the symbol.")
    return df[["Close"]].rename(columns={"Close": "close"}).dropna()


def metrics(equity: pd.Series, rets: pd.Series) -> dict:
    total_return = equity.iloc[-1] / equity.iloc[0] - 1
    years = (equity.index[-1] - equity.index[0]).days / 365.25
    cagr = (1 + total_return) ** (1 / years) - 1 if years > 0 else float("nan")
    vol = rets.std() * np.sqrt(252)
    sharpe = (rets.mean() * 252) / vol if vol > 0 else float("nan")
    dd = equity / equity.cummax() - 1
    max_dd = dd.min()
    wins = (rets > 0).sum()
    losses = (rets < 0).sum()
    win_rate = wins / (wins + losses) if (wins + losses) > 0 else float("nan")
    return {
        "total_return": total_return,
        "cagr": cagr,
        "annual_vol": vol,
        "sharpe_rf0": sharpe,
        "max_drawdown": max_dd,
        "win_rate": win_rate,
    }


def backtest(df: pd.DataFrame, strategy: str) -> tuple[pd.Series, pd.Series, pd.Series]:
    sig = STRAT_FNS[strategy](df)
    # Long-only: position = 1 when sig == 1 else 0. Lag by 1 to avoid look-ahead.
    position = (sig == 1).astype(int).shift(1).fillna(0)
    daily_ret = df["close"].pct_change().fillna(0)
    strat_ret = position * daily_ret
    equity = (1 + strat_ret).cumprod()
    buy_hold = (1 + daily_ret).cumprod()
    return equity, buy_hold, strat_ret


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True)
    p.add_argument("--strategy", choices=STRAT_FNS.keys(), default="sma")
    p.add_argument("--start", default="2010-01-01")
    args = p.parse_args()

    df = fetch(args.ticker, args.start)
    eq, bh, rets = backtest(df, args.strategy)
    m = metrics(eq, rets)
    m_bh = metrics(bh, df["close"].pct_change().fillna(0))

    def fmt(d):
        return {k: (f"{v:.2%}" if k != "sharpe_rf0" else f"{v:.2f}") for k, v in d.items()}

    print("=" * 70)
    print(f"Ticker   : {args.ticker}")
    print(f"Strategy : {args.strategy}")
    print(f"Range    : {df.index[0].date()} → {df.index[-1].date()}")
    print("-" * 70)
    print(f"{'METRIC':<18}{'STRATEGY':>18}{'BUY-AND-HOLD':>20}")
    s, b = fmt(m), fmt(m_bh)
    for k in m.keys():
        print(f"{k:<18}{s[k]:>18}{b[k]:>20}")
    print("=" * 70)
    print("Costs, taxes, slippage, look-ahead bias: not modeled. Educational only.")

    # Plot
    os.makedirs("plots", exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 5))
    eq.plot(ax=ax, label=f"{args.strategy} strategy", color="#C9A227", linewidth=2)
    bh.plot(ax=ax, label="Buy & hold", color="#0B1F3A", linewidth=2, alpha=.6)
    ax.set_title(f"{args.ticker} · {args.strategy.upper()} backtest")
    ax.set_ylabel("Equity (start = 1.0)")
    ax.legend()
    ax.grid(alpha=.3)
    out = f"plots/{args.ticker.replace('^','').replace('/','_')}_{args.strategy}.png"
    fig.tight_layout()
    fig.savefig(out, dpi=140)
    print(f"Plot saved: algo/{out}")


if __name__ == "__main__":
    main()
