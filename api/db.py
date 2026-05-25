"""SQLite layer for the Epicenter API. Tiny, single-file, zero-config."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Optional

DB_PATH = os.environ.get("DB_PATH", "/data/epicenter.db")


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL;")
    c.execute("PRAGMA foreign_keys=ON;")
    return c


def init_db() -> None:
    with _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts INTEGER NOT NULL,
                ip TEXT,
                asset TEXT,
                ticker TEXT,
                strategy TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_requests_ticker ON requests(ticker);
            CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts);

            CREATE TABLE IF NOT EXISTS price_cache (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            );
            """
        )


def log_request(ip: str, asset: str, ticker: str, strategy: str) -> None:
    with _conn() as c:
        c.execute(
            "INSERT INTO requests (ts, ip, asset, ticker, strategy) VALUES (?, ?, ?, ?, ?)",
            (int(time.time()), ip, asset, ticker.lower(), strategy),
        )


def get_cached_prices(key: str, max_age_hours: int = 24) -> Optional[list[tuple[int, float]]]:
    cutoff = int(time.time()) - max_age_hours * 3600
    with _conn() as c:
        row = c.execute(
            "SELECT payload FROM price_cache WHERE key = ? AND fetched_at > ?",
            (key, cutoff),
        ).fetchone()
    if not row:
        return None
    try:
        data = json.loads(row[0])
        return [(int(t), float(p)) for t, p in data]
    except Exception:
        return None


def set_cached_prices(key: str, series: list[tuple[int, float]]) -> None:
    payload = json.dumps([[int(t), float(p)] for t, p in series])
    with _conn() as c:
        c.execute(
            "INSERT INTO price_cache (key, payload, fetched_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at",
            (key, payload, int(time.time())),
        )


def public_stats() -> dict:
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) FROM requests").fetchone()[0]
        last_24h = c.execute(
            "SELECT COUNT(*) FROM requests WHERE ts > ?",
            (int(time.time()) - 86400,),
        ).fetchone()[0]
        top = c.execute(
            "SELECT ticker, COUNT(*) AS n FROM requests GROUP BY ticker ORDER BY n DESC LIMIT 10"
        ).fetchall()
    return {
        "total_backtests": total,
        "last_24h": last_24h,
        "top_tickers": [{"ticker": t, "count": n} for t, n in top],
    }
