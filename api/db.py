"""SQLite layer for Epicenter API.
Tables: requests, price_cache, contacts, subscribers, articles.
DB lives at $DB_PATH (default /data/epicenter.db on the VPS)."""
from __future__ import annotations

import json, os, sqlite3, time, secrets
from typing import Optional

DB_PATH = os.environ.get("DB_PATH", "/data/epicenter.db")


def _conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL;"); c.execute("PRAGMA foreign_keys=ON;")
    return c


def init_db() -> None:
    with _conn() as c:
        c.executescript("""
CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, ip TEXT, asset TEXT, ticker TEXT, strategy TEXT);
CREATE INDEX IF NOT EXISTS idx_requests_ticker ON requests(ticker);
CREATE INDEX IF NOT EXISTS idx_requests_ts ON requests(ts);
CREATE TABLE IF NOT EXISTS price_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT UNIQUE NOT NULL, ts INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, topic TEXT NOT NULL, message TEXT NOT NULL, ip TEXT, user_agent TEXT, status TEXT DEFAULT 'new');
CREATE INDEX IF NOT EXISTS idx_contacts_ts ON contacts(ts);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, source TEXT, confirmed INTEGER DEFAULT 1, unsubscribe_token TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, unsubscribed_at INTEGER, ip TEXT);
CREATE INDEX IF NOT EXISTS idx_subs_created ON subscribers(created_at);
CREATE TABLE IF NOT EXISTS articles (slug TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT, url TEXT NOT NULL, published_at INTEGER NOT NULL);
""")
    _seed_articles()


def _seed_articles() -> None:
    seed = [
        ("why-day-traders-lose", "Why 89% of day traders lose money", "SEBI's data on 9.5 lakh F&O traders.", "https://epicenterexchange.com/insights/why-most-day-traders-lose-data.html"),
        ("tax-saving-2026", "Best tax-saving investments in India 2026", "ELSS vs PPF vs NPS vs ULIP — post-tax math.", "https://epicenterexchange.com/insights/best-tax-saving-investments-india-2026.html"),
        ("nifty-vs-sp500-25y", "NIFTY 50 vs S&P 500: 25 years of real numbers", "Currency- and drawdown-adjusted long-term comparison.", "https://epicenterexchange.com/insights/nifty-vs-sp500-25-years.html"),
        ("sip-vs-lumpsum", "SIP vs Lumpsum in India 2026", "25 years of NIFTY data.", "https://epicenterexchange.com/insights/sip-vs-lumpsum-india-2026.html"),
        ("bitcoin-halving", "Bitcoin halving cycles, explained", "Why the four-year cycle exists.", "https://epicenterexchange.com/insights/bitcoin-halving-cycles-explained.html"),
        ("xirr-vs-cagr", "XIRR vs CAGR — which one matters?", "Worked examples in INR.", "https://epicenterexchange.com/insights/xirr-vs-cagr-which-matters.html"),
    ]
    now = int(time.time())
    with _conn() as c:
        for slug, title, summary, url in seed:
            c.execute("INSERT OR IGNORE INTO articles (slug,title,summary,url,published_at) VALUES (?,?,?,?,?)", (slug, title, summary, url, now))


def log_request(ip: str, asset: str, ticker: str, strategy: str) -> None:
    with _conn() as c:
        c.execute("INSERT INTO requests (ts,ip,asset,ticker,strategy) VALUES (?,?,?,?,?)", (int(time.time()), ip, asset, ticker.lower(), strategy))


def get_cached_prices(key: str, max_age_hours: int = 24) -> Optional[list]:
    cutoff = int(time.time()) - max_age_hours * 3600
    with _conn() as c:
        row = c.execute("SELECT payload FROM price_cache WHERE key=? AND fetched_at>?", (key, cutoff)).fetchone()
    if not row: return None
    try: return [(int(t), float(p)) for t, p in json.loads(row[0])]
    except Exception: return None


def set_cached_prices(key: str, series: list) -> None:
    payload = json.dumps([[int(t), float(p)] for t, p in series])
    with _conn() as c:
        c.execute("INSERT INTO price_cache (key,payload,fetched_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at", (key, payload, int(time.time())))


def new_ticket_id() -> str:
    return "EE-" + secrets.token_hex(3).upper() + "-" + secrets.token_hex(2).upper()


def save_contact(name, email, topic, message, ip="", ua="") -> str:
    tid = new_ticket_id()
    with _conn() as c:
        c.execute("INSERT INTO contacts (ticket_id,ts,name,email,topic,message,ip,user_agent) VALUES (?,?,?,?,?,?,?,?)", (tid, int(time.time()), name, email, topic, message, ip, ua))
    return tid


def save_subscriber(email, name="", source="", ip=""):
    token = secrets.token_urlsafe(16)
    with _conn() as c:
        row = c.execute("SELECT unsubscribe_token, unsubscribed_at FROM subscribers WHERE email=?", (email.lower(),)).fetchone()
        if row:
            if row[1] is not None:
                c.execute("UPDATE subscribers SET unsubscribed_at=NULL WHERE email=?", (email.lower(),))
                return True, row[0]
            return False, row[0]
        c.execute("INSERT INTO subscribers (email,name,source,unsubscribe_token,created_at,ip) VALUES (?,?,?,?,?,?)", (email.lower(), name, source, token, int(time.time()), ip))
    return True, token


def unsubscribe(token) -> bool:
    with _conn() as c:
        cur = c.execute("UPDATE subscribers SET unsubscribed_at=? WHERE unsubscribe_token=? AND unsubscribed_at IS NULL", (int(time.time()), token))
        return cur.rowcount > 0


def latest_article():
    with _conn() as c:
        row = c.execute("SELECT slug,title,summary,url FROM articles ORDER BY published_at DESC LIMIT 1").fetchone()
    return {"slug": row[0], "title": row[1], "summary": row[2], "url": row[3]} if row else None


def public_stats() -> dict:
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) FROM requests").fetchone()[0]
        last_24h = c.execute("SELECT COUNT(*) FROM requests WHERE ts>?", (int(time.time()) - 86400,)).fetchone()[0]
        subs = c.execute("SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at IS NULL").fetchone()[0]
        msgs = c.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    return {"total_backtests": total, "last_24h": last_24h, "subscribers": subs, "messages_received": msgs}
