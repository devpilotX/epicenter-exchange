# Epicenter Exchange API

FastAPI service that powers:
- `/backtest` — server-side backtester
- `/contact` — saves contact submissions in **your own SQLite DB** + sends HTML confirmation email
- `/newsletter/subscribe` — saves subscriber in **your own SQLite DB** + sends HTML welcome with latest article
- `/newsletter/unsubscribe` — one-click unsubscribe
- `/stats` — anonymous stats

**Zero third-party form services. Zero newsletter platforms. Everything in your DB.**

## Where is the database?

At `$DB_PATH` (default `/data/epicenter.db`) **on the Mumbai VPS, after you deploy this API**. Until deployed, no DB file exists — the frontend forms fall back to `mailto:` so submissions still reach `dipanshu@paisareality.com`.

Inspect it any time:
```bash
ssh your-vps
sqlite3 /data/epicenter.db
.tables
SELECT ticket_id, ts, name, email, topic FROM contacts ORDER BY ts DESC LIMIT 20;
SELECT email, name, created_at FROM subscribers WHERE unsubscribed_at IS NULL;
```

## 0. Email provider — set up Resend first (5 min)

Resend gives you a real `hello@epicenterexchange.com` sender, 3,000 emails/month free, excellent inbox placement.

### Step 0.1 — sign up
1. Go to **https://resend.com** → **Sign up** (use `dipanshu@paisareality.com`).
2. Verify your email by clicking the Resend confirmation link.

### Step 0.2 — add your domain
1. Resend dashboard → **Domains** → **Add Domain** → type `epicenterexchange.com` → region **"India (Mumbai)"** (lowest latency for your VPS).
2. Resend will show you **3 DNS records** to add (one MX, one SPF/TXT, one DKIM/CNAME, plus an optional DMARC).

### Step 0.3 — add the DNS records in Hostinger
1. Hostinger panel → **Domains** → `epicenterexchange.com` → **DNS / Nameservers** → **Manage DNS records**.
2. For each record Resend gave you, click **Add record**, copy *Type*, *Name/Host*, *Value*, and *TTL* (3600 is fine). Examples (yours will differ):
   - **MX**  Name: `send`  Priority: `10`  Value: `feedback-smtp.ap-south-1.amazonses.com`
   - **TXT** Name: `send`  Value: `v=spf1 include:amazonses.com ~all`
   - **TXT** Name: `resend._domainkey`  Value: `p=MIGfMA0G…` (the long DKIM key string)
   - **TXT** Name: `_dmarc`  Value: `v=DMARC1; p=none;`
3. Wait 2-10 minutes. Click **Verify DNS records** in Resend → should turn green.

### Step 0.4 — create an API key
1. Resend dashboard → **API Keys** → **Create API Key** → name it `epicenter-api`, permission **Full Access**.
2. Copy the key (starts with `re_…`). **You will only see it once.**
3. Paste it into your VPS `.env` as `SMTP_PASS`.

That's it. Resend's SMTP host is `smtp.resend.com:465`, user is the literal string `resend`, password is the API key. The backend's generic SMTP client works without any code changes.

## 1. Deploy on your Mumbai VPS

```bash
# install deps
sudo apt update && sudo apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx ufw
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# clone
cd /opt && sudo git clone https://github.com/devpilotX/epicenter-exchange.git
sudo chown -R $USER:$USER /opt/epicenter-exchange
cd /opt/epicenter-exchange/api

# venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# env
sudo mkdir -p /data && sudo chown $USER:$USER /data
cp .env.example .env && nano .env       # paste Resend API key into SMTP_PASS
```

```bash
# systemd service
sudo tee /etc/systemd/system/epicenter-api.service <<'EOF'
[Unit]
Description=Epicenter Exchange API
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/epicenter-exchange
EnvironmentFile=/opt/epicenter-exchange/api/.env
ExecStart=/opt/epicenter-exchange/api/.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8080
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now epicenter-api
curl http://127.0.0.1:8080/health

# nginx + HTTPS
sudo tee /etc/nginx/sites-available/api.epicenterexchange.com <<'EOF'
server {
    listen 80;
    server_name api.epicenterexchange.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/api.epicenterexchange.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.epicenterexchange.com
```

## 2. DNS in Hostinger

Add A record:  `api` → your VPS IP.  Wait 5-10 min, then `https://api.epicenterexchange.com/health` should respond.

## 3. Test it end-to-end

1. Visit `https://epicenterexchange.com/contact.html`, submit the form.
2. You see success + ticket ID `EE-XXXXXX-YYYY`.
3. Confirmation email arrives at the address you typed (from `hello@epicenterexchange.com`).
4. Admin notification arrives at `dipanshu@paisareality.com`.
5. `sqlite3 /data/epicenter.db "SELECT * FROM contacts ORDER BY ts DESC LIMIT 1;"` shows the row.

## 4. Ops

```bash
sudo systemctl restart epicenter-api       # restart
sudo journalctl -u epicenter-api -f         # live logs
cd /opt/epicenter-exchange && git pull && sudo systemctl restart epicenter-api   # update
cp /data/epicenter.db ~/backup-$(date +%F).db   # nightly backup (SQLite is just a file)
```

## 5. If Resend ever isn't enough (unlikely below 3k/month)

The SMTP stack is generic. Just swap the four `SMTP_*` env vars to any other provider (Brevo, Mailgun, AWS SES, Hostinger mailbox, etc.) and restart the service. No code change needed.
