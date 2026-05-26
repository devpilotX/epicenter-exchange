"""Epicenter Exchange API - backtest + contact + newsletter + market data proxy.
Own SQLite DB, own SMTP, deployed on Mumbai VPS behind nginx with HTTPS."""
from __future__ import annotations
import os, time
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .db import init_db, log_request, get_cached_prices, set_cached_prices, public_stats
from .backtest import run_backtest
from .contact import router as contact_router
from .newsletter import router as newsletter_router

API_VERSION = "1.2.0"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
CRYPTOCOMPARE_BASE = "https://min-api.cryptocompare.com/data/v2"
YAHOO_BASE = "https://query1.finance.yahoo.com"
FOREX_BASE = "https://open.er-api.com/v6"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 EpicenterBot/1.2"

ALLOWED_ORIGINS = ["https://epicenterexchange.com", "https://www.epicenterexchange.com"]
if os.environ.get("ALLOW_LOCALHOST") == "1":
    ALLOWED_ORIGINS.extend(["http://localhost:8000", "http://127.0.0.1:5500", "http://localhost:5500"])

app = FastAPI(title="Epicenter Exchange API", version=API_VERSION,
              description="Free, open-source backtester + own-DB contact/newsletter + market data proxy. Educational only.")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"], max_age=86400)
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


# --- In-memory cache for live data (short TTL) ---
_mem_cache: dict = {}

def _mget(key: str, ttl: int):
    v = _mem_cache.get(key)
    if v and time.time() - v[0] < ttl:
        return v[1]
    return None

def _mset(key: str, value) -> None:
    _mem_cache[key] = (time.time(), value)


# ===== MARKET DATA PROXY ENDPOINTS =====
# Frontend bypasses CORS by routing through our backend.
# Yahoo, CoinGecko, CryptoCompare, open.er-api.com all called server-side.

@app.get("/quote")
def quote(symbols: str) -> dict:
    """Live quote for one or more Yahoo Finance symbols. Cached 60s."""
    syms = [s.strip() for s in symbols.split(",") if s.strip()][:50]
    if not syms:
        raise HTTPException(400, "no symbols")
    key = "q:" + ",".join(syms)
    cached = _mget(key, 60)
    if cached is not None:
        return {"quotes": cached, "cached": True}
    out: dict = {}
    try:
        with httpx.Client(timeout=8.0, headers={"User-Agent": UA}) as cli:
            for sym in syms:
                try:
                    r = cli.get(f"{YAHOO_BASE}/v8/finance/chart/{sym}",
                                params={"range": "2d", "interval": "1d"})
                    if r.status_code != 200:
                        continue
                    j = r.json()
                    res = (j.get("chart", {}) or {}).get("result", [])
                    if not res:
                        continue
                    meta = res[0].get("meta", {}) or {}
                    price = meta.get("regularMarketPrice")
                    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
                    if price is None:
                        continue
                    chg = ((price - prev) / prev * 100) if prev else 0
                    out[sym] = {
                        "price": float(price),
                        "change_pct": float(chg),
                        "currency": meta.get("currency", ""),
                        "market_state": meta.get("marketState", ""),
                    }
                except Exception:
                    continue
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Yahoo error: {e}")
    _mset(key, out)
    return {"quotes": out, "cached": False}


@app.get("/history")
def history(symbol: str, range: str = "5y", interval: str = "1d") -> dict:
    """Historical bars via Yahoo Finance v8 chart. Cached 6 hours."""
    if range not in ("1y","2y","3y","5y","10y","max","1mo","3mo","6mo","ytd"):
        raise HTTPException(400, "invalid range")
    if interval not in ("1d","1wk","1mo"):
        raise HTTPException(400, "invalid interval")
    key = f"hist:{symbol}:{range}:{interval}"
    cached = get_cached_prices(key)
    if cached is not None:
        return {"symbol": symbol, "points": cached, "n": len(cached), "cached": True}
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{YAHOO_BASE}/v8/finance/chart/{symbol}",
                        params={"range": range, "interval": interval})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Yahoo failed: {e}")
    if r.status_code == 404:
        raise HTTPException(404, f"Symbol {symbol} not found")
    if r.status_code != 200:
        raise HTTPException(502, f"Yahoo {r.status_code}")
    j = r.json()
    res = (j.get("chart", {}) or {}).get("result", [])
    if not res:
        raise HTTPException(404, "No data")
    r0 = res[0]
    ts = r0.get("timestamp") or []
    indicators = r0.get("indicators", {}) or {}
    closes = (indicators.get("quote") or [{}])[0].get("close", []) or []
    adj = None
    if indicators.get("adjclose"):
        adj = (indicators["adjclose"] or [{}])[0].get("adjclose", []) or []
    points = []
    for i, t in enumerate(ts):
        p = None
        if adj and i < len(adj) and adj[i] is not None:
            p = adj[i]
        elif i < len(closes) and closes[i] is not None:
            p = closes[i]
        if p is not None and t is not None:
            points.append([int(t) * 1000, float(p)])
    if not points:
        raise HTTPException(404, "Empty series")
    set_cached_prices(key, points)
    return {"symbol": symbol, "points": points, "n": len(points), "cached": False}


@app.get("/crypto/spot")
def crypto_spot(ids: str) -> dict:
    """Live spot prices via CoinGecko. Cached 60s."""
    ids_list = [i.strip() for i in ids.split(",") if i.strip()][:30]
    if not ids_list:
        raise HTTPException(400, "no ids")
    key = "cs:" + ",".join(ids_list)
    cached = _mget(key, 60)
    if cached is not None:
        return {"prices": cached, "cached": True}
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{COINGECKO_BASE}/simple/price",
                        params={"ids": ",".join(ids_list), "vs_currencies": "usd",
                                "include_24hr_change": "true"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"CoinGecko error: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"CoinGecko {r.status_code}")
    data = r.json()
    _mset(key, data)
    return {"prices": data, "cached": False}


# Map CoinGecko ids -> CryptoCompare symbols.
_CC_SYM_MAP = {
    "bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL", "ripple": "XRP",
    "binancecoin": "BNB", "cardano": "ADA", "dogecoin": "DOGE",
    "polkadot": "DOT", "chainlink": "LINK", "avalanche-2": "AVAX",
    "matic-network": "MATIC", "litecoin": "LTC", "tron": "TRX",
    "stellar": "XLM", "monero": "XMR", "bitcoin-cash": "BCH",
    "cosmos": "ATOM", "uniswap": "UNI", "near": "NEAR",
    "aptos": "APT", "arbitrum": "ARB", "optimism": "OP",
    "shiba-inu": "SHIB", "pepe": "PEPE",
}


@app.get("/crypto/history")
def crypto_history(id: str, days: int = 1825) -> dict:
    """Historical crypto daily closes via CryptoCompare (free, no key, supports ~2000 days). Cached 24h."""
    sym = _CC_SYM_MAP.get(id.lower(), id.upper())
    days = max(30, min(int(days), 2000))
    key = f"cch:{sym}:{days}"
    cached = get_cached_prices(key)
    if cached is not None:
        return {"id": id, "symbol": sym, "points": cached, "n": len(cached), "cached": True}
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{CRYPTOCOMPARE_BASE}/histoday",
                        params={"fsym": sym, "tsym": "USD", "limit": days})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"CryptoCompare error: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"CryptoCompare {r.status_code}")
    j = r.json()
    if j.get("Response") == "Error":
        raise HTTPException(502, j.get("Message", "CryptoCompare error"))
    data = (j.get("Data", {}) or {}).get("Data", []) or []
    points = []
    for d in data:
        if d.get("close") and d.get("time"):
            points.append([int(d["time"]) * 1000, float(d["close"])])
    if not points:
        raise HTTPException(404, "No data")
    set_cached_prices(key, points)
    return {"id": id, "symbol": sym, "points": points, "n": len(points), "cached": False}


@app.get("/forex")
def forex(base: str = "USD") -> dict:
    """Live FX rates from open.er-api.com (free, no key). Cached 1 hour."""
    base = base.upper()[:6]
    key = f"fx:{base}"
    cached = _mget(key, 3600)
    if cached is not None:
        return {**cached, "cached": True}
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{FOREX_BASE}/latest/{base}")
    except httpx.HTTPError as e:
        raise HTTPException(502, f"FX error: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"FX {r.status_code}")
    j = r.json()
    if j.get("result") != "success":
        raise HTTPException(502, j.get("error-type", "FX error"))
    out = {
        "base": j.get("base_code", base),
        "rates": j.get("rates", {}),
        "time": j.get("time_last_update_utc", ""),
    }
    _mset(key, out)
    return {**out, "cached": False}


# ===== BACKTEST (uses new robust data sources) =====

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


def _crypto_series(coin_id: str, days: int) -> list:
    sym = _CC_SYM_MAP.get(coin_id.lower(), coin_id.upper())
    days = max(60, min(days, 2000))
    key = f"bt:cc:{sym}:{days}"
    cached = get_cached_prices(key)
    if cached is not None:
        return cached
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{CRYPTOCOMPARE_BASE}/histoday",
                        params={"fsym": sym, "tsym": "USD", "limit": days})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"CryptoCompare failed: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"CryptoCompare {r.status_code}")
    j = r.json()
    data = (j.get("Data", {}) or {}).get("Data", []) or []
    s = [(int(d["time"]) * 1000, float(d["close"])) for d in data
         if d.get("close") and d.get("time")]
    if s:
        set_cached_prices(key, s)
    return s


def _equity_series(symbol: str, days: int) -> list:
    years = max(1, days // 365)
    rng = "5y" if years <= 5 else ("10y" if years <= 10 else "max")
    key = f"bt:y:{symbol}:{rng}"
    cached = get_cached_prices(key)
    if cached is not None:
        return cached
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": UA}) as cli:
            r = cli.get(f"{YAHOO_BASE}/v8/finance/chart/{symbol}",
                        params={"range": rng, "interval": "1d"})
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Yahoo failed: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"Yahoo {r.status_code}")
    j = r.json()
    res = (j.get("chart", {}) or {}).get("result", [])
    if not res:
        raise HTTPException(404, "No data")
    r0 = res[0]
    ts = r0.get("timestamp") or []
    indicators = r0.get("indicators", {}) or {}
    closes = (indicators.get("quote") or [{}])[0].get("close", []) or []
    adj = None
    if indicators.get("adjclose"):
        adj = (indicators["adjclose"] or [{}])[0].get("adjclose", []) or []
    s = []
    for i, t in enumerate(ts):
        p = None
        if adj and i < len(adj) and adj[i] is not None:
            p = adj[i]
        elif i < len(closes) and closes[i] is not None:
            p = closes[i]
        if p is not None:
            s.append((int(t) * 1000, float(p)))
    if not s:
        raise HTTPException(404, "Empty series")
    set_cached_prices(key, s)
    return s


def _do(req: BacktestRequest, ip: str = "") -> BacktestResponse:
    if req.strategy not in ("sma", "rsi", "macd"):
        raise HTTPException(400, "strategy must be sma/rsi/macd")
    if req.asset == "crypto":
        s = _crypto_series(req.ticker, req.days)
    elif req.asset == "equity":
        s = _equity_series(req.ticker, req.days)
    else:
        raise HTTPException(400, "asset must be crypto or equity")
    if len(s) < 60:
        raise HTTPException(400, "need 60+ daily bars")
    res = run_backtest(s, req.strategy)
    log_request(ip, req.asset, req.ticker, req.strategy)
    return BacktestResponse(
        asset=req.asset, ticker=req.ticker, strategy=req.strategy,
        years=round(res["years"], 2),
        total_return=round(res["total_ret"], 4), bh_return=round(res["bh_ret"], 4),
        cagr=round(res["cagr"], 4), bh_cagr=round(res["bh_cagr"], 4),
        sharpe=round(res["sharpe"], 3), max_drawdown=round(res["max_dd"], 4),
        win_rate=round(res["win_rate"], 4),
        days_long=res["trades"], n_points=len(s),
        disclaimer="Educational only. No costs/slippage/taxes modelled.",
    )


@app.get("/backtest", response_model=BacktestResponse)
def bt_get(request: Request, asset: str = "crypto", ticker: str = "bitcoin",
           strategy: str = "sma", days: int = 1825) -> BacktestResponse:
    return _do(BacktestRequest(asset=asset, ticker=ticker, strategy=strategy, days=days),
               request.client.host if request.client else "")


@app.post("/backtest", response_model=BacktestResponse)
def bt_post(req: BacktestRequest, request: Request) -> BacktestResponse:
    return _do(req, request.client.host if request.client else "")


@app.get("/stats")
def stats() -> dict:
    return public_stats()


@app.exception_handler(Exception)
async def _err(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code,
                            content={"detail": exc.detail, "type": "HTTPException"})
    return JSONResponse(status_code=500,
                        content={"detail": "Internal error", "type": type(exc).__name__})
