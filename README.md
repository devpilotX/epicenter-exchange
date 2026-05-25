# Epicenter Exchange

> **Free, non-profit finance research & education.** Markets, tools, and open-source signal demos for India 🇮🇳, US 🇺🇸, UK 🇬🇧, and Crypto.

[![Pages](https://img.shields.io/badge/Live-epicenterexchange.com-0B1F3A?style=flat-square)](https://epicenterexchange.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-C9A227?style=flat-square)](LICENSE)
[![Status: Non-Profit](https://img.shields.io/badge/Status-Non--Profit-16A34A?style=flat-square)](#)

---

## What is this?

**Epicenter Exchange** is a **single-person, zero-cost, non-profit** finance research & education site. It does **not** offer investment advice, brokerage, or paid services. Visitors can browse content and reach out via the contact page — nothing more.

- ✅ 100% static — hosted free on **GitHub Pages**
- ✅ Custom domain: `epicenterexchange.com`
- ✅ Educational signal demos in Python (SMA, RSI, MACD, mean-reversion, momentum)
- ✅ Coverage: Indian equities, US equities, UK equities, Crypto
- ✅ SEO-ready (sitemap, robots, JSON-LD, Open Graph)
- ❌ No customer support, no accounts, no payments, no advice

---

## ⚠️ Important Disclaimer

> **This site is for educational and informational purposes only.**
> Nothing here is investment, financial, legal, or tax advice. The author is **not** a SEBI / SEC / FCA / ESMA registered investment adviser, analyst, or research analyst. Markets carry risk; you can lose money. Past performance does not indicate future results. **Always consult a licensed professional before investing.**

Full disclaimer: [`/disclaimer.html`](./disclaimer.html) and [`algo/disclaimer.md`](./algo/disclaimer.md).

---

## 🧱 Tech stack (all free)

| Layer        | Choice                         | Why                         |
|--------------|--------------------------------|-----------------------------|
| Hosting      | GitHub Pages                   | Free, custom domain, HTTPS  |
| Frontend     | HTML + Tailwind CDN + vanilla JS | Zero build, zero deps     |
| Forms        | `mailto:` link (or Formspree free tier) | No backend         |
| Market data  | CoinGecko public API           | No key, free                |
| Analytics    | GitHub repo traffic (built-in) | Free, privacy-friendly      |
| Algo demos   | Python + pandas + yfinance     | Open source, free           |

---

## 🚀 Deploy in 5 minutes

1. **Settings → Pages** → Source: **Deploy from branch** → Branch: `main` `/` (root) → Save.
2. **Custom domain** → enter `epicenterexchange.com` → Save. (The `CNAME` file is already in this repo.)
3. On your domain registrar, create a **CNAME record**: `@` → `devpilotx.github.io`. (Or four A records to GitHub's IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.)
4. Wait 5–30 min for DNS + HTTPS to provision.
5. Visit https://epicenterexchange.com 🎉

---

## 🗂 Project structure

```
epicenter-exchange/
├── index.html              # Home / hero / services teaser
├── about.html              # About + mission + author
├── services.html           # Services profile (info only — no booking)
├── markets.html            # Markets snapshot (India / US / UK / Crypto)
├── tools.html              # Free calculators (SIP, EMI, Retirement, Risk)
├── signals.html            # Algo signal demos (educational)
├── insights.html           # Articles index
├── contact.html            # ONLY interaction point — contact form
├── disclaimer.html         # Legal disclaimer
├── 404.html                # Custom not-found
├── CNAME                   # Custom domain for Pages
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── assets/
│   ├── css/style.css       # Design tokens + components
│   └── js/
│       ├── main.js         # Nav, smooth-scroll, year stamp
│       ├── ticker.js       # Live CoinGecko ticker
│       └── calculators.js  # SIP / EMI / Retirement math
└── algo/
    ├── README.md           # How to run the algo demos
    ├── requirements.txt    # pandas, numpy, yfinance, matplotlib
    ├── simple_signals.py   # SMA crossover, RSI, MACD
    ├── advanced_signals.py # Mean-reversion, momentum, ATR-stop
    ├── backtest.py         # Vectorised backtester + metrics
    └── disclaimer.md
```

---

## 📈 Getting traffic (free playbook)

No paid ads. Pure organic.

1. **SEO basics** — meta titles, descriptions, OG tags, sitemap, robots, JSON-LD `Organization` schema (already in repo).
2. **Long-tail content** — each `insights.html` post targets one question (e.g., *"What is XIRR vs CAGR for SIP investors?"*).
3. **Search Console** — submit sitemap at `search.google.com/search-console` (free).
4. **Bing Webmaster Tools** — same (free).
5. **Communities** — share educational posts (NOT recommendations) on r/IndiaInvestments, r/IndianStockMarket, Twitter/X #fintwit, LinkedIn finance groups.
6. **GitHub itself** — the algo demos attract devs; star/fork traffic flows back.
7. **Comparison pages** — "SIP vs Lump-sum", "NPS vs PPF" — these rank well.
8. **Newsletter** — Buttondown free tier (100 subs) later.

---

## 🧪 Algo signal demos

In [`algo/`](./algo). All Python, all free. They print signals to console and save plots locally — they do **not** auto-trade, and they are **not** advice.

```bash
cd algo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python simple_signals.py --ticker RELIANCE.NS
python advanced_signals.py --ticker BTC-USD
python backtest.py --ticker AAPL --strategy sma
```

Markets supported via `yfinance` symbols:
- 🇮🇳 India: `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `^NSEI` (NIFTY)
- 🇺🇸 US: `AAPL`, `MSFT`, `^GSPC` (S&P 500)
- 🇬🇧 UK: `HSBA.L`, `BP.L`, `^FTSE`
- 🪙 Crypto: `BTC-USD`, `ETH-USD`, `SOL-USD`

---

## 🤝 Contributing

This is a solo project, but PRs welcome — typo fixes, accessibility improvements, more educational content. Please read [`algo/disclaimer.md`](./algo/disclaimer.md) before touching the signal code.

---

## 📜 License

MIT — see [`LICENSE`](./LICENSE).

---

*Built with care, deployed for free. No advice, only education.* 🕯️
