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

## Deploy on your Mumbai VPS

```bash
# 1. install deps
sudo apt update && sudo apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx ufw
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# 2. clone
cd /opt && sudo git clone https://github.com/devpilotX/epicenter-exchange.git
sudo chown -R $USER:$USER /opt/epicenter-exchange
cd /opt/epicenter-exchange/api

# 3. venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 4. env
sudo mkdir -p /data && sudo chown $USER:$USER /data
cp .env.example .env && nano .env       # fill SMTP creds
```

In **Hostinger Control Panel → Emails → Email Accounts**, create `hello@epicenterexchange.com`. Use that mailbox + password in `.env` (SMTP host `smtp.hostinger.com`, port 465).

```bash
# 5. systemd service
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

# 6. nginx + HTTPS
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

## DNS in Hostinger

Add A record:  `api` → your VPS IP.  Wait 5-10 min, then `https://api.epicenterexchange.com/health` should respond.

## Test it end-to-end

1. Visit `https://epicenterexchange.com/contact.html`, submit the form.
2. You see success + ticket ID `EE-XXXXXX-YYYY`.
3. Confirmation email arrives at the address you typed.
4. Admin notification arrives at `dipanshu@paisareality.com`.
5. `sqlite3 /data/epicenter.db "SELECT * FROM contacts ORDER BY ts DESC LIMIT 1;"` shows the row.

## Ops

```bash
sudo systemctl restart epicenter-api       # restart
sudo journalctl -u epicenter-api -f         # live logs
cd /opt/epicenter-exchange && git pull && sudo systemctl restart epicenter-api   # update
cp /data/epicenter.db ~/backup-$(date +%F).db   # nightly backup (SQLite is just a file)
```
