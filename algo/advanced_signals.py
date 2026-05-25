"""
More advanced (still educational) signal demos:
- Bollinger / z-score mean reversion
- Trend-momentum (12m - 1m, vol-scaled)
- ATR position sizing helper

Usage:
    python advanced_signals.py --ticker ^NSEI --strategy meanrev
    python advanced_signals.py --ticker ^GSPC --strategy momentum
    python advanced_signals.py --ticker BTC-USD --strategy meanrev
"""
from __future__ import annotations
import argparse
import sys
import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError:
    sys.exit("Install dependencies first: pip install -r requirements.txt")


def fetch(ticker: str, period: str = "10y") -> pd.DataFrame:
    df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
    if df.empty:
        sys.exit(f"No data for ticker {ticker!r}. Check the symbol.")
    return df.rename(columns=str.lower).dropna()


def zscore_mean_reversion(df: pd.DataFrame, window: int = 20, entry: float = 2.0) -> pd.Series:
    """Long when z-score of close vs rolling mean drops below -entry; flat above +entry."""
    m = df["close"].rolling(window).mean()
    s = df["close"].rolling(window).std()
    z = (df["close"] - m) / s
    sig = pd.Series(0, index=df.index, dtype=int)
    sig[z < -entry] = 1   # oversold relative to mean
    sig[z > entry] = -1   # overbought relative to mean
    return sig


def trend_momentum(df: pd.DataFrame) -> pd.Series:
    """12-1 momentum: skip the most recent month to avoid short-term reversal noise."""
    r12 = df["close"].pct_change(252)
    r1 = df["close"].pct_change(21)
    mom = r12 - r1
    sig = pd.Series(0, index=df.index, dtype=int)
    sig[mom > 0] = 1
    sig[mom < 0] = -1
    return sig


def atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(window).mean()


def position_size_atr(capital: float, atr_value: float, risk_pct: float = 0.005) -> float:
    """How many units to buy so that one ATR of move = risk_pct of capital."""
    if atr_value <= 0:
        return 0.0
    return (capital * risk_pct) / atr_value


STRATEGIES = {
    "meanrev": ("Z-score(20) mean-reversion at ±2.0", zscore_mean_reversion),
    "momentum": ("12-1 trend momentum", trend_momentum),
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True)
    p.add_argument("--strategy", choices=STRATEGIES.keys(), default="meanrev")
    p.add_argument("--period", default="10y")
    p.add_argument("--capital", type=float, default=100000.0, help="For ATR sizing example")
    args = p.parse_args()

    df = fetch(args.ticker, args.period)
    name, fn = STRATEGIES[args.strategy]
    sig = fn(df).dropna()
    a = atr(df).dropna()

    last = sig.iloc[-1]
    last_close = df["close"].iloc[-1]
    last_atr = a.iloc[-1] if not a.empty else float("nan")
    units = position_size_atr(args.capital, last_atr)

    label = {1: "LONG / BUY-bias", -1: "FLAT or SHORT-bias", 0: "NO SIGNAL"}[int(last)]

    print("=" * 60)
    print(f"Ticker        : {args.ticker}")
    print(f"Strategy      : {name}")
    print(f"Last close    : {last_close:.2f}")
    print(f"Last ATR(14)  : {last_atr:.2f}")
    print(f"Signal        : {label}")
    print(f"Example size  : {units:.4f} units @ ₹/$ {args.capital:.0f} capital, 0.5% risk")
    print("=" * 60)
    print("Educational only. Not investment advice. Read algo/disclaimer.md.")


if __name__ == "__main__":
    main()
