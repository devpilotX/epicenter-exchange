# Epicenter Exchange

> **Free, non-profit finance research &amp; education.** Markets, tools, open-source signal demos for India 🇮🇳 · US 🇺🇸 · UK 🇬🇧 · Crypto 🪙.

[![Live](https://img.shields.io/badge/Live-epicenterexchange.com-0B1F3A?style=flat-square)](https://epicenterexchange.com)
[![API](https://img.shields.io/badge/API-api.epicenterexchange.com-16A34A?style=flat-square)](https://api.epicenterexchange.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-C9A227?style=flat-square)](LICENSE)
[![Status: Non-Profit](https://img.shields.io/badge/Status-Non--Profit-1E40AF?style=flat-square)](#)

---

## What is this?

A single-person, non-profit finance education site. No advice, no tip groups, no paid signals, no affiliates. Everything free, everything open-source, every claim built on data.

- **Frontend** — static HTML/CSS/JS on GitHub Pages, custom domain, HTTPS.
- **API** — FastAPI + SQLite on a Hostinger Mumbai VPS, fronted by nginx + Let's Encrypt.
- **Email** — Resend (transactional + newsletter), two sender identities (`hello@` and `insights@`).
- **Analytics + ads** — Google Analytics 4 + AdSense with Consent Mode v2 cookie banner.
- **Content** — 7 long-form articles, 4 working calculators, in-browser backtester, equity + crypto dashboards.

---

## ⚠️ Important disclaimer

> Everything on this site is educational. None of it is investment advice. The author is **not** SEBI / SEC / FCA / ESMA registered. Markets carry real risk — including total loss. Always consult a licensed adviser before investing. Full text: [`/disclaimer.html`](./disclaimer.html), [`algo/disclaimer.md`](./algo/disclaimer.md).

---

## 🗂 Repository layout

```
epicenter-exchange/
├── index.html                       # Home / hero / featured content
├── about.html                       # Mission, principles, what we don't do
├── services.html                    # Services profile (all free, no booking)
├── markets.html                     # Live equity + crypto dashboards
├── tools.html                       # SIP, EMI, Retirement, FX, Tax calculators
├── signals.html                     # In-browser backtester (SMA / RSI / MACD)
├── insights.html                    # Articles index + newsletter signup
├── contact.html                     # Contact form (POSTs to API)
├── disclaimer.html / privacy.html / cookies.html
├── 404.html
├── insights/                        # 7 long-form articles
│   ├── sip-vs-lumpsum-india-2026.html
│   ├── nifty-vs-sp500-25-years.html
│   ├── best-tax-saving-investments-india-2026.html
│   ├── sebi-fo-rules-impact-2026.html
│   ├── xirr-vs-cagr-which-matters.html
│   ├── bitcoin-halving-cycles-explained.html
│   └── why-most-day-traders-lose-data.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── main.js                  # Nav, consent banner, dark mode, year stamp
│       ├── ticker.js                # Mixed equity + crypto marquee
│       ├── equity-dashboard.js      # 13+ instruments via Stooq + CORS proxy
│       ├── crypto-dashboard.js      # Top 12 coins via CoinGecko
│       ├── backtest.js              # POSTs to /backtest, renders equity curve
│       ├── calculators.js           # SIP/EMI/retirement/FX/tax math
│       ├── contact.js               # POSTs contact form to API
│       └── newsletter.js            # POSTs subscribe to API
├── api/                             # ← FastAPI backend (runs on VPS)
│   ├── main.py                  # All endpoints + email + DB
│   ├── requirements.txt
│   └── .env.example
├── algo/                            # Python research scripts (run locally)
│   ├── simple_signals.py        # SMA / RSI / MACD
│   ├── advanced_signals.py      # Z-score mean-reversion, 12-1 momentum, ATR sizing
│   ├── backtest.py              # Vectorised backtester + metrics
│   └── requirements.txt
├── sitemap.xml · robots.txt · feed.xml · manifest.json · ads.txt
└── CNAME                            # epicenterexchange.com
```

---

## 🌐 Frontend (GitHub Pages)

**Custom domain:** `epicenterexchange.com` → Hostinger DNS → GitHub Pages A records:
```
185.199.108.153  185.199.109.153  185.199.110.153  185.199.111.153
```

**Clean URLs.** Every page is reachable without `.html`: `/about`, `/services`, `/markets`, `/tools`, `/signals`, `/insights`, `/contact`, `/disclaimer`, `/privacy`, `/cookies`, `/insights/<slug>`. GitHub Pages automatically serves `/foo.html` for `/foo` requests, so no rewrites needed.

**Local preview:**
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

---

## ⚙️ API (FastAPI on VPS)

Live base URL: <https://api.epicenterexchange.com> · version 1.3.0.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service banner |
| `GET` | `/health` | Liveness check |
| `GET` | `/backtest?asset=&ticker=&strategy=&days=` | Run SMA / RSI / MACD backtest |
| `GET` | `/stats` | Cached site stats |
| `GET` | `/quote?symbol=` | Single quote (Stooq) |
| `GET` | `/history?symbol=&days=` | Daily history |
| `GET` | `/crypto/spot?ids=` | CoinGecko spot |
| `GET` | `/crypto/history?id=&days=` | CoinGecko history |
| `GET` | `/forex?pair=` | FX pair |
| `POST` | `/contact` | Save contact form + send 2 emails |
| `POST` | `/newsletter/subscribe` | Subscribe + welcome email |
| `GET` | `/newsletter/unsubscribe?token=` | One-click unsubscribe |
| `GET` | `/diag/email` | SMTP diagnostic (no secrets in output) |

All endpoints CORS-locked to `epicenterexchange.com` (and localhost during dev). No API key required.

### Stack on the VPS

- Ubuntu 24.04 (arm64) on Hostinger Mumbai
- Python 3.12 venv at `/opt/epicenter-exchange/.venv`
- FastAPI + Uvicorn, listening on `127.0.0.1:8090`
- nginx reverse-proxy with `proxy_pass http://127.0.0.1:8090`
- TLS via Let's Encrypt (certbot, auto-renew)
- systemd unit `epicenter-api.service`
- SQLite database at `/opt/epicenter-exchange/data/epicenter.db`

---

## 🚀 Fresh VPS deployment (from zero)

Run as `ubuntu` on the server.

```bash
# 1. System prep
sudo apt update && sudo apt install -y python3.12-venv nginx certbot python3-certbot-nginx git

# 2. Clone
sudo mkdir -p /opt/epicenter-exchange && sudo chown -R ubuntu:ubuntu /opt/epicenter-exchange
git clone https://github.com/devpilotX/epicenter-exchange.git /opt/epicenter-exchange
cd /opt/epicenter-exchange

# 3. Python env
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
mkdir -p data

# 4. Environment file — see ‘Environment variables’ below
cp api/.env.example api/.env
nano api/.env       # paste real values; see warnings about ZWSP below

# 5. systemd service
sudo tee /etc/systemd/system/epicenter-api.service >/dev/null <<'EOF'
[Unit]
Description=Epicenter Exchange API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/epicenter-exchange
EnvironmentFile=/opt/epicenter-exchange/api/.env
ExecStart=/opt/epicenter-exchange/.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8090
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now epicenter-api
sudo systemctl status epicenter-api --no-pager

# 6. nginx + HTTPS
sudo tee /etc/nginx/sites-available/api.epicenterexchange.com >/dev/null <<'EOF'
server {
  listen 80;
  server_name api.epicenterexchange.com;
  location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/api.epicenterexchange.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.epicenterexchange.com --non-interactive --agree-tos -m you@example.com --redirect

# 7. Smoke test
curl https://api.epicenterexchange.com/health
curl https://api.epicenterexchange.com/diag/email
```

### Updates

```bash
cd /opt/epicenter-exchange && git pull && sudo systemctl restart epicenter-api
```

---

## 🔑 Environment variables (`api/.env`)

```ini
# Resend SMTP
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     # 36-char Resend API key

# Senders (two identities, both verified in Resend)
FROM_EMAIL=hello@epicenterexchange.com
FROM_NAME=Epicenter Exchange
FROM_EMAIL_CONTACT=hello@epicenterexchange.com
FROM_NAME_CONTACT=Epicenter Exchange
FROM_EMAIL_NEWSLETTER=insights@epicenterexchange.com
FROM_NAME_NEWSLETTER=Epicenter Insights
NOTIFY_EMAIL=hello@epicenterexchange.com

# Public URLs
API_URL=https://api.epicenterexchange.com
SITE_URL=https://epicenterexchange.com
```

### ⚠️ Pasting credentials — read this once

When copying API keys or passwords from a browser, **invisible Unicode characters** (zero-width space `U+200B`, zero-width joiner `U+200D`, etc.) can stick to your clipboard and silently corrupt the value. Symptoms:

```
UnicodeEncodeError: 'ascii' codec can't encode character '\u200b' in position 44: ordinal not in range(128)
SMTP auth failed: (535, b'Authentication credentials invalid')
```

The API now strips invisibles on load, but the safest fix is at the source:

```bash
# When editing api/.env, paste then run this once to clean any invisibles in place:
sed -i 's/[\xE2\x80\x8B\xE2\x80\x8C\xE2\x80\x8D\xEF\xBB\xBF]//g' /opt/epicenter-exchange/api/.env
sudo systemctl restart epicenter-api
curl https://api.epicenterexchange.com/diag/email
```

`/diag/email` returns booleans + lengths but never the secret. Look for `"loaded": true, "smtp_user_set": true, "smtp_pass_len": 36`.

---

## 📧 Resend setup (one time per domain)

1. **Add domain** `epicenterexchange.com` in Resend → add the displayed **SPF**, **DKIM** (`resend._domainkey`), and optional **DMARC** records in Hostinger DNS. Wait for all three to show **Verified**.
2. **Sending only** is enough for transactional + newsletter. The **Receiving (Inbound) MX** record is optional and only needed if you want Resend to receive replies.
3. Create an API key in Resend → Settings → API Keys. Copy the 36-character `re_…` value into `SMTP_PASS`. **Do not** paste with surrounding whitespace.
4. Test:
   ```bash
   curl -X POST https://api.epicenterexchange.com/contact \
     -H 'Content-Type: application/json' \
     -d '{"name":"test","email":"you@example.com","topic":"Bug report","message":"hello"}'
   ```
   Expected JSON: `"email_sent": true`. Then check your inbox (and spam folder once).

---

## 📊 Analytics + ads + consent

- **GA4** stream `G-8GBZKT1BZL` — loaded only after consent.
- **AdSense** `ca-pub-6484525483464374` — loaded always; runs in **non-personalised** mode until consent.
- **Consent Mode v2** — implemented in `assets/js/main.js`. Default state: all storage signals denied. "Accept" sets `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` to granted.
- `ads.txt` at repo root: `google.com, pub-6484525483464374, DIRECT, f08c47fec0942fa0`
- Privacy + cookies docs: `/privacy`, `/cookies`.

---

## 📈 Free traffic playbook

1. **Google Search Console** — add property, verify via DNS TXT, submit `sitemap.xml`. Resubmit if it says "Couldn't fetch" — propagation can take 24-48h.
2. **Bing Webmaster Tools** — same flow.
3. **Communities** — share *educational* posts (never recommendations) on r/IndiaInvestments, r/IndianStockMarket, Twitter #fintwit, LinkedIn finance groups. Each post links one specific article with the SEBI / RIA disclaimer in the comment.
4. **Twitter threads** — the SEBI F&amp;O 89%-lose data article works well as a 6-tweet thread.
5. **GitHub itself** — the algo demos attract devs; stars/forks send referral traffic.
6. **Long-tail SEO** — each `/insights/<slug>` answers one specific question (e.g., "XIRR vs CAGR for SIP investors").

---

## 🧪 Algo signal demos (local Python)

```bash
cd algo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python simple_signals.py   --ticker RELIANCE.NS --strategy sma
python advanced_signals.py --ticker ^NSEI       --strategy meanrev
python backtest.py         --ticker AAPL        --strategy macd --start 2005-01-01
```

---

## 🔍 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/contact` returns `email_sent: false` with `UnicodeEncodeError` | ZWSP in `SMTP_PASS` | Run the `sed` invisibles-strip above, restart service |
| `SMTP auth failed: (535, b'Authentication credentials invalid')` | Wrong / revoked Resend key, or key includes extra chars | Generate a fresh 36-char `re_…` key, paste cleanly |
| `/diag/email` shows `loaded: false` | `.env` not readable by service user | `chown ubuntu:ubuntu api/.env && chmod 640 api/.env` |
| 502 from nginx | uvicorn not running | `sudo systemctl status epicenter-api` + `journalctl -u epicenter-api -n 50` |
| Cert expired | certbot renew failed | `sudo certbot renew --force-renewal` |
| GSC "Couldn't fetch sitemap" | DNS or path glitch | Retry after 24h; verify `curl https://epicenterexchange.com/sitemap.xml` returns 200 |
| GitHub Pages 404 on `/about` | rare cache issue | Hard refresh; `curl -I https://epicenterexchange.com/about` should be 200 |

---

## 🤝 Contributing

Solo project, but PRs welcome for typos, accessibility, more long-form articles, and additional educational backtest strategies. Read [`algo/disclaimer.md`](./algo/disclaimer.md) before touching signal code.

---

## 📜 License

MIT — see [`LICENSE`](./LICENSE).

---

*Built solo. Kept free. No advice, only education.* 🕯️
