"""Pure-Python backtest engine. No numpy/pandas dependency — fast on small VPS."""
from __future__ import annotations

import math
from typing import Sequence


def sma(arr: Sequence[float], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(arr)
    s = 0.0
    for i, v in enumerate(arr):
        s += v
        if i >= n:
            s -= arr[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def rsi(arr: Sequence[float], n: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(arr)
    if len(arr) < n + 1:
        return out
    gains = 0.0
    losses = 0.0
    for i in range(1, len(arr)):
        d = arr[i] - arr[i - 1]
        g = max(d, 0)
        l = max(-d, 0)
        if i <= n:
            gains += g
            losses += l
            if i == n:
                gains /= n
                losses /= n
                rs = 100.0 if losses == 0 else gains / losses
                out[i] = 100 - 100 / (1 + rs)
        else:
            gains = (gains * (n - 1) + g) / n
            losses = (losses * (n - 1) + l) / n
            rs = 100.0 if losses == 0 else gains / losses
            out[i] = 100 - 100 / (1 + rs)
    return out


def ema(arr: Sequence[float | None], n: int) -> list[float | None]:
    out: list[float | None] = [None] * len(arr)
    k = 2 / (n + 1)
    prev: float | None = None
    for i, v in enumerate(arr):
        if v is None:
            continue
        prev = v if prev is None else v * k + prev * (1 - k)
        out[i] = prev
    return out


def macd_signal(closes: Sequence[float]) -> tuple[list[float | None], list[float | None]]:
    e12 = ema(closes, 12)
    e26 = ema(closes, 26)
    macd_line: list[float | None] = [
        e12[i] - e26[i] if e12[i] is not None and e26[i] is not None else None
        for i in range(len(closes))
    ]
    sig = ema([v if v is not None else 0.0 for v in macd_line], 9)
    return macd_line, sig


def sig_sma(closes: Sequence[float]) -> list[int]:
    f = sma(closes, 50)
    s = sma(closes, 200)
    return [1 if (f[i] is not None and s[i] is not None and f[i] > s[i]) else 0 for i in range(len(closes))]


def sig_rsi(closes: Sequence[float]) -> list[int]:
    r = rsi(closes, 14)
    pos = 0
    out: list[int] = []
    for v in r:
        if v is not None:
            if v < 30:
                pos = 1
            elif v > 70:
                pos = 0
        out.append(pos)
    return out


def sig_macd(closes: Sequence[float]) -> list[int]:
    m, s = macd_signal(closes)
    return [1 if (m[i] is not None and s[i] is not None and m[i] > s[i]) else 0 for i in range(len(closes))]


def run_backtest(series: list[tuple[int, float]], strategy: str) -> dict:
    closes = [c for _, c in series]
    if strategy == "sma":
        sig = sig_sma(closes)
    elif strategy == "rsi":
        sig = sig_rsi(closes)
    elif strategy == "macd":
        sig = sig_macd(closes)
    else:
        raise ValueError("unknown strategy")
    # Lag 1 day to avoid look-ahead
    lagged = [0] + sig[:-1]
    equity = [1.0]
    bh = [1.0]
    for i in range(1, len(closes)):
        r = (closes[i] / closes[i - 1]) - 1
        equity.append(equity[i - 1] * (1 + (lagged[i] * r)))
        bh.append(bh[i - 1] * (1 + r))
    years = (series[-1][0] - series[0][0]) / (365.25 * 86400 * 1000)
    total = equity[-1] - 1
    bh_ret = bh[-1] - 1
    cagr = (1 + total) ** (1 / max(years, 0.01)) - 1
    bh_cagr = (1 + bh_ret) ** (1 / max(years, 0.01)) - 1
    rets = [equity[i] / equity[i - 1] - 1 for i in range(1, len(equity))]
    mean = sum(rets) / len(rets) if rets else 0
    var = sum((r - mean) ** 2 for r in rets) / len(rets) if rets else 0
    sd = math.sqrt(var)
    sharpe = (mean / sd) * math.sqrt(252) if sd > 0 else 0
    peak = equity[0]
    max_dd = 0.0
    for v in equity:
        if v > peak:
            peak = v
        dd = (v - peak) / peak
        if dd < max_dd:
            max_dd = dd
    wins = 0
    trades = 0
    for i in range(1, len(lagged)):
        if lagged[i] == 1:
            trades += 1
            if closes[i] > closes[i - 1]:
                wins += 1
    win_rate = wins / trades if trades > 0 else 0
    return {
        "years": years,
        "total_ret": total,
        "bh_ret": bh_ret,
        "cagr": cagr,
        "bh_cagr": bh_cagr,
        "sharpe": sharpe,
        "max_dd": max_dd,
        "win_rate": win_rate,
        "trades": trades,
        "current_signal": sig[-1] if sig else 0,
    }
