"""
Simple signal demos: SMA crossover, RSI mean-reversion, MACD.

Usage:
    python simple_signals.py --ticker RELIANCE.NS --strategy sma
    python simple_signals.py --ticker AAPL       --strategy rsi
    python simple_signals.py --ticker BTC-USD    --strategy macd

This script ONLY prints the most recent signal. It does NOT trade.
It is educational. Read disclaimer.md before doing anything with it.
"""
from __future__ import annotations
import argparse
import sys
import pandas as pd
import numpy as np

try:
    import yfinance as yf
except ImportError:
    sys.exit("Install dependencies first: pip install -r requirements.txt")


def fetch(ticker: str, period: str = "5y") -> pd.DataFrame:
    df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
    if df.empty:
        sys.exit(f"No data for ticker {ticker!r}. Check the symbol.")
    return df[["Close"]].rename(columns={"Close": "close"}).dropna()


def sma_crossover(df: pd.DataFrame, fast: int = 50, slow: int = 200) -> pd.Series:
    df = df.copy()
    df["sma_fast"] = df["close"].rolling(fast).mean()
    df["sma_slow"] = df["close"].rolling(slow).mean()
    # 1 = long, -1 = flat/short, 0 = no signal yet
    signal = pd.Series(0, index=df.index, dtype=int)
    signal[df["sma_fast"] > df["sma_slow"]] = 1
    signal[df["sma_fast"] < df["sma_slow"]] = -1
    return signal


def rsi(df: pd.DataFrame, window: int = 14) -> pd.Series:
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = -delta.clip(upper=0).rolling(window).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def rsi_mean_reversion(df: pd.DataFrame, low: int = 30, high: int = 70) -> pd.Series:
    r = rsi(df)
    signal = pd.Series(0, index=df.index, dtype=int)
    signal[r < low] = 1   # oversold -> consider long
    signal[r > high] = -1 # overbought -> consider exit/short
    return signal


def macd_signal(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal_w: int = 9) -> pd.Series:
    ema_fast = df["close"].ewm(span=fast, adjust=False).mean()
    ema_slow = df["close"].ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    sig = macd.ewm(span=signal_w, adjust=False).mean()
    hist = macd - sig
    out = pd.Series(0, index=df.index, dtype=int)
    out[hist > 0] = 1
    out[hist < 0] = -1
    return out


STRATEGIES = {
    "sma": ("SMA crossover (50/200)", sma_crossover),
    "rsi": ("RSI(14) mean-reversion (30/70)", rsi_mean_reversion),
    "macd": ("MACD(12/26/9) histogram", macd_signal),
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ticker", required=True, help="e.g. RELIANCE.NS, AAPL, BTC-USD")
    p.add_argument("--strategy", choices=STRATEGIES.keys(), default="sma")
    p.add_argument("--period", default="5y")
    args = p.parse_args()

    df = fetch(args.ticker, args.period)
    name, fn = STRATEGIES[args.strategy]
    sig = fn(df).dropna()

    last = sig.iloc[-1]
    last_close = df["close"].iloc[-1]
    label = {1: "LONG / BUY-bias", -1: "FLAT or SHORT-bias", 0: "NO SIGNAL"}[int(last)]

    print("=" * 60)
    print(f"Ticker     : {args.ticker}")
    print(f"Strategy   : {name}")
    print(f"Last close : {last_close:.2f}")
    print(f"Last date  : {df.index[-1].date()}")
    print(f"Signal     : {label}")
    print("=" * 60)
    print("This is an educational demo. Not investment advice.")


if __name__ == "__main__":
    main()
