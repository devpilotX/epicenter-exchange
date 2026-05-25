"""Epicenter Exchange API — backtest + contact + newsletter.
Own SQLite DB, own SMTP, deployed on Mumbai VPS behind nginx with HTTPS."""
from __future__ import annotations
import os, time
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .db import init_db, log_request, get_cached_prices, set_cached_prices, public_stats
from .backtest import run_backtest
from .contact import router as contact_router
from .newsletter import router as newsletter_router

API_VERSION = "1.1.0"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
STOOQ_BASE = "https://stooq.com/q/d/l/"
ALLOWED_ORIGINS = ["https://epicenterexchange.com", "https://www.epicenterexchange.com"]
if os.environ.get("ALLOW_LOCALHOST") == "1":
    ALLOWED_ORIGINS.extend(["http://localhost:8000", "http://127.0.0.1:5500", "http://localhost:5500"])

app = FastAPI(title="Epicenter Exchange API", version=API_VERSION, description="Free, open-source backtester + own-DB contact/newsletter. Educational only.")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"], max_age=86400)
app.include_router(contact_router)
app.include_router(newsletter_router)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/")
def root() -> dict:
    return {"service": "Epicenter Exchange API", "version": API_VERSION, "status": "ok", "docs": "/docs"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ts": int(time.time())}


class BacktestRequest(BaseModel):
    asset: str
    ticker: str = Field(..., min_length=1, max_length=32)
    strategy: str
    days: int = Field(1825, ge=90, le=3650)


class BacktestResponse(BaseModel):
    asset: str; ticker: str; strategy: str; years: float
    total_return: float; bh_return: float; cagr: float; bh_cagr: float
    sharpe: float; max_drawdown: float; win_rate: float
    days_long: int; n_points: int; disclaimer: str


def _coingecko(coin_id: str, days: int) -> list:
    key = f"cg:{coin_id}:{days}"
    cached = get_cached_prices(key)
    if cached is not None: return cached
    try:
        with httpx.Client(timeout=30.0) as cli:
            r = cli.get(f"{COINGECKO_BASE}/coins/{coin_id}/market_chart", params={"vs_currency": "usd", "days": days, "interval": "daily"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"CoinGecko request failed: {e}")
    if r.status_code == 429: raise HTTPException(429, "CoinGecko rate-limited")
    if r.status_code != 200: raise HTTPException(502, f"CoinGecko {r.status_code}")
    s = [(int(p[0]), float(p[1])) for p in r.json().get("prices", []) if isinstance(p, list) and len(p) >= 2]
    if s: set_cached_prices(key, s)
    return s


def _stooq(ticker: str) -> list:
    key = f"stooq:{ticker.lower()}"
    cached = get_cached_prices(key)
    if cached is not None: return cached
    try:
        with httpx.Client(timeout=30.0) as cli:
            r = cli.get(STOOQ_BASE, params={"s": ticker.lower(), "i": "d"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Stooq request failed: {e}")
    if r.status_code != 200 or not r.text.strip(): raise HTTPException(502, f"Stooq {r.status_code}")
    lines = r.text.strip().splitlines(); series = []
    for line in lines[1:]:
        p = line.split(",")
        if len(p) < 5: continue
        try:
            ts = int(datetime.strptime(p[0], "%Y-%m-%d").timestamp() * 1000)
            series.append((ts, float(p[4])))
        except (ValueError, KeyError):
            continue
    if not series: raise HTTPException(404, "No data for ticker on Stooq")
    set_cached_prices(key, series); return series


def _do(req: BacktestRequest, ip: str = "") -> BacktestResponse:
    if req.strategy not in ("sma", "rsi", "macd"): raise HTTPException(400, "strategy must be sma/rsi/macd")
    s = _coingecko(req.ticker, req.days) if req.asset == "crypto" else _stooq(req.ticker) if req.asset == "equity" else None
    if s is None: raise HTTPException(400, "asset must be crypto or equity")
    if len(s) < 60: raise HTTPException(400, "need 60+ daily bars")
    res = run_backtest(s, req.strategy); log_request(ip, req.asset, req.ticker, req.strategy)
    return BacktestResponse(asset=req.asset, ticker=req.ticker, strategy=req.strategy, years=round(res["years"], 2), total_return=round(res["total_ret"], 4), bh_return=round(res["bh_ret"], 4), cagr=round(res["cagr"], 4), bh_cagr=round(res["bh_cagr"], 4), sharpe=round(res["sharpe"], 3), max_drawdown=round(res["max_dd"], 4), win_rate=round(res["win_rate"], 4), days_long=res["trades"], n_points=len(s), disclaimer="Educational only. No costs/slippage/taxes modelled.")


@app.get("/backtest", response_model=BacktestResponse)
def bt_get(request: Request, asset: str = "crypto", ticker: str = "bitcoin", strategy: str = "sma", days: int = 1825) -> BacktestResponse:
    return _do(BacktestRequest(asset=asset, ticker=ticker, strategy=strategy, days=days), request.client.host if request.client else "")


@app.post("/backtest", response_model=BacktestResponse)
def bt_post(req: BacktestRequest, request: Request) -> BacktestResponse:
    return _do(req, request.client.host if request.client else "")


@app.get("/stats")
def stats() -> dict:
    return public_stats()


@app.exception_handler(Exception)
async def _err(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "Internal error", "type": type(exc).__name__})
