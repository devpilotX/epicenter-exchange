# Epicenter Exchange API

FastAPI service that powers `api.epicenterexchange.com`.

- Free, open-source backtester (SMA crossover, RSI mean-reversion, MACD).
- Free crypto + equity historical data from CoinGecko and Stooq.
- SQLite database for request logging + cached price history.
- Caddy reverse proxy with automatic HTTPS.
- All packaged in Docker Compose. Two commands to deploy.

## Endpoints

| Method | Path                | Description                                          |
|--------|---------------------|------------------------------------------------------|
| GET    | `/`                 | Health + version info                                |
| GET    | `/health`           | Liveness probe                                       |
| GET    | `/backtest`         | Run a backtest (query params)                        |
| POST   | `/backtest`         | Run a backtest (JSON body)                           |
| GET    | `/signals/today`    | Today's signal across watched tickers (cached daily) |
| GET    | `/prices/{ticker}`  | Cached daily history for one ticker                  |
| GET    | `/stats`            | Public stats: total backtests run, top tickers       |

All responses are JSON. CORS is locked to `https://epicenterexchange.com` only.

## Quick deploy on the Mumbai VPS

```bash
# 1. Clone and enter the api folder
git clone https://github.com/devpilotX/epicenter-exchange.git
cd epicenter-exchange/api

# 2. Copy env file and edit
cp .env.example .env
nano .env  # set API_DOMAIN=api.epicenterexchange.com

# 3. Bring it up
docker compose up -d

# 4. Check logs
docker compose logs -f
```

Then point a CNAME on Hostinger DNS: `api` → `<your-vps-ip>` (use an A record
actually — CNAMEs cannot point to bare IPs). Caddy will fetch and renew the
Let's Encrypt certificate automatically.

## DNS row for Hostinger

| Type | Name | Content        | TTL  |
|------|------|----------------|------|
| A    | api  | <your-vps-ip>  | 14400|

## Architecture

```
Internet  →  Caddy (TLS, rate-limit)  →  FastAPI (port 8000)  →  SQLite file
                                                  ↓
                                          CoinGecko / Stooq (cached 24h)
```

The SQLite database lives at `/data/epicenter.db` inside the container, mounted
to `./data` on the host so it persists across container restarts.

## Rate limits

Caddy enforces:
- 60 requests per minute per IP on `/backtest`
- 600 requests per minute per IP on everything else

No API keys required. The service is free and educational.
