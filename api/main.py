"""Epicenter Exchange API — free educational backtest service.

Runs SMA crossover, RSI mean-reversion, and MACD strategies on free historical
data from CoinGecko (crypto) and Stooq (equities). Caches every fetch in SQLite
for 24 hours to be polite to upstream providers.

Deployed on a Mumbai VPS behind Caddy with automatic HTTPS.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .db import init_db, log_request, get_cached_prices, set_cached_prices, public_stats
from .backtest import run_backtest

API_VERSION = "1.0.0"
ALLOWED_ORIGINS = [
    "https://epicenterexchange.com",
    "https://www.epicenterexchange.com",
]
if os.environ.get("ALLOW_LOCALHOST") == "1":
    ALLOWED_ORIGINS.append("http://localhost:8000")
    ALLOWED_ORIGINS.append("http://127.0.0.1:5500")

app = FastAPI(
    title="Epicenter Exchange API",
    version=API_VERSION,
    description="Free, open-source backtester for educational use. Not investment advice.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {
        "service": "Epicenter Exchange API",
        "version": API_VERSION,
        "status": "ok",
        "docs": "/docs",
        "disclaimer": "Educational only. Not investment advice. Not SEBI / SEC / FCA registered.",
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ts": int(time.time())}


class BacktestRequest(BaseModel):
    asset: str = Field(..., description="'crypto' or 'equity'")
    ticker: str = Field(..., min_length=1, max_length=32)
    strategy: str = Field(..., description="'sma', 'rsi', or 'macd'")
    days: int = Field(1825, ge=90, le=3650, description="Crypto: history length in days")


class BacktestResponse(BaseModel):
    asset: str
    ticker: str
    strategy: str
    years: float
    total_return: float
    bh_return: float
    cagr: float
    bh_cagr: float
    sharpe: float
    max_drawdown: float
    win_rate: float
    days_long: int
    n_points: int
    disclaimer: str


def _coingecko_history(coin_id: str, days: int) -> list[tuple[int, float]]:
    cached = get_cached_prices(f"cg:{coin_id}:{days}", max_age_hours=24)
    if cached is not None:
        return cached
    url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
    params = {"vs_currency": "usd", "days": days, "interval": "daily"}
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url, params=params)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"CoinGecko returned {r.status_code}")
    data = r.json().get("prices", [])
    series = [(int(p[0]), float(p[1])) for p in data if isinstance(p, list) and len(p) >= 2]
    set_cached_prices(f"cg:{coin_id}:{days}", series)
    return series


def _stooq_history(ticker: str) -> list[tuple[int, float]]:
    cached = get_cached_prices(f"stooq:{ticker.lower()}", max_age_hours=24)
    if cached is not None:
        return cached
    url = f"https://stooq.com/q/d/l/?s={ticker.lower()}&i=d"
    with httpx.Client(timeout=30.0) as client:
        r = client.get(url)
    if r.status_code != 200 or not r.text.strip():
        raise HTTPException(status_code=502, detail=f"Stooq returned {r.status_code}")
    lines = r.text.strip().splitlines()
    series: list[tuple[int, float]] = []
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) < 5:
            continue
        try:
            ts = int(datetime.strptime(parts[0], "%Y-%m-%d").timestamp() * 1000)
            close = float(parts[4])
        except (ValueError, KeyError):
            continue
        series.append((ts, close))
    if not series:
        raise HTTPException(status_code=404, detail="No data for that ticker on Stooq")
    set_cached_prices(f"stooq:{ticker.lower()}", series)
    return series


def _do_backtest(req: BacktestRequest, client_ip: str = "unknown") -> BacktestResponse:
    if req.strategy not in ("sma", "rsi", "macd"):
        raise HTTPException(status_code=400, detail="strategy must be sma, rsi, or macd")
    if req.asset == "crypto":
        series = _coingecko_history(req.ticker, req.days)
    elif req.asset == "equity":
        series = _stooq_history(req.ticker)
    else:
        raise HTTPException(status_code=400, detail="asset must be 'crypto' or 'equity'")
    if len(series) < 60:
        raise HTTPException(status_code=400, detail="Not enough data (need at least 60 daily bars)")
    result = run_backtest(series, req.strategy)
    log_request(client_ip, req.asset, req.ticker, req.strategy)
    return BacktestResponse(
        asset=req.asset,
        ticker=req.ticker,
        strategy=req.strategy,
        years=round(result["years"], 2),
        total_return=round(result["total_ret"], 4),
        bh_return=round(result["bh_ret"], 4),
        cagr=round(result["cagr"], 4),
        bh_cagr=round(result["bh_cagr"], 4),
        sharpe=round(result["sharpe"], 3),
        max_drawdown=round(result["max_dd"], 4),
        win_rate=round(result["win_rate"], 4),
        days_long=result["trades"],
        n_points=len(series),
        disclaimer="Educational only. No costs, slippage, or taxes modelled. Past performance does not indicate future results.",
    )


@app.get("/backtest", response_model=BacktestResponse)
def backtest_get(
    request: Request,
    asset: str = Query("crypto"),
    ticker: str = Query("bitcoin", min_length=1, max_length=32),
    strategy: str = Query("sma"),
    days: int = Query(1825, ge=90, le=3650),
) -> BacktestResponse:
    req = BacktestRequest(asset=asset, ticker=ticker, strategy=strategy, days=days)
    ip = request.client.host if request.client else "unknown"
    return _do_backtest(req, ip)


@app.post("/backtest", response_model=BacktestResponse)
def backtest_post(req: BacktestRequest, request: Request) -> BacktestResponse:
    ip = request.client.host if request.client else "unknown"
    return _do_backtest(req, ip)


@app.get("/prices/{ticker}")
def prices(ticker: str, asset: str = Query("crypto"), days: int = Query(365, ge=30, le=3650)) -> dict:
    if asset == "crypto":
        series = _coingecko_history(ticker, days)
    else:
        series = _stooq_history(ticker)
    return {"ticker": ticker, "asset": asset, "n": len(series), "series": [{"t": t, "c": c} for t, c in series[-days:]]}


@app.get("/signals/today")
def signals_today() -> dict:
    """Today's signal across a watched basket of tickers, computed once per day."""
    watched = [
        ("crypto", "bitcoin"), ("crypto", "ethereum"), ("crypto", "solana"),
        ("equity", "^spx"), ("equity", "^ndx"), ("equity", "^ftse"),
        ("equity", "^nse"), ("equity", "reliance.in"), ("equity", "tcs.in"),
    ]
    out: list[dict] = []
    for asset, ticker in watched:
        try:
            series = _coingecko_history(ticker, 365) if asset == "crypto" else _stooq_history(ticker)
            if len(series) < 60:
                continue
            r = run_backtest(series, "sma")
            out.append({
                "asset": asset,
                "ticker": ticker,
                "current": series[-1][1],
                "position": "long" if r["current_signal"] == 1 else "flat",
                "days_long": r["trades"],
                "strategy": "sma_50_200",
            })
        except Exception:
            continue
    return {"date": datetime.utcnow().strftime("%Y-%m-%d"), "signals": out, "disclaimer": "Educational only."}


@app.get("/stats")
def stats() -> dict:
    return public_stats()


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "Internal error", "type": type(exc).__name__})
