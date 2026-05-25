"""SMTP email sender + HTML templates. Pure stdlib.

Env vars:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  FROM_EMAIL, FROM_NAME                  — default sender
  FROM_EMAIL_CONTACT, FROM_NAME_CONTACT  — used by /contact route
  FROM_EMAIL_NEWSLETTER, FROM_NAME_NEWSLETTER  — used by /newsletter route
  NOTIFY_EMAIL                            — where admin copies land
"""
from __future__ import annotations
import os, smtplib, ssl
from email.message import EmailMessage
from email.utils import formataddr

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.resend.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")

# Default sender (fallback)
FROM_EMAIL = os.environ.get("FROM_EMAIL", "hello@epicenterexchange.com")
FROM_NAME = os.environ.get("FROM_NAME", "Epicenter Exchange")

# Per-route senders — override default if set
FROM_EMAIL_CONTACT = os.environ.get("FROM_EMAIL_CONTACT", FROM_EMAIL)
FROM_NAME_CONTACT = os.environ.get("FROM_NAME_CONTACT", FROM_NAME)
FROM_EMAIL_NEWSLETTER = os.environ.get("FROM_EMAIL_NEWSLETTER", FROM_EMAIL)
FROM_NAME_NEWSLETTER = os.environ.get("FROM_NAME_NEWSLETTER", FROM_NAME)

NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL", "dipanshu@paisareality.com")
BRAND_URL = "https://epicenterexchange.com"
API_URL = os.environ.get("API_URL", "https://api.epicenterexchange.com")


def _send(to_email: str, subject: str, html: str, text: str,
          from_email: str | None = None, from_name: str | None = None,
          reply_to: str | None = None) -> None:
    if not SMTP_USER or not SMTP_PASS:
        print(f"[email] SMTP not configured, skipping send to {to_email}")
        return
    msg = EmailMessage()
    msg["From"] = formataddr((from_name or FROM_NAME, from_email or FROM_EMAIL))
    msg["To"] = to_email
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    ctx = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx) as s:
            s.login(SMTP_USER, SMTP_PASS); s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls(context=ctx); s.login(SMTP_USER, SMTP_PASS); s.send_message(msg)


CSS = "body{font-family:Inter,Segoe UI,Arial,sans-serif;background:#F8FAFC;margin:0;padding:40px 20px;color:#0F172A}.wrap{max-width:600px;margin:0 auto}.hdr{background:#0B1F3A;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center}.hdr h1{color:#C9A227;font-family:Fraunces,Georgia,serif;margin:0;font-size:28px}.hdr p{color:rgba(255,255,255,.7);margin:6px 0 0;font-size:14px}.card{background:#fff;padding:32px;border-radius:0 0 12px 12px}.greet{font-size:22px;color:#C9A227;font-weight:600;margin:0 0 16px}.box{background:#FBF6E1;border-left:4px solid #C9A227;padding:16px 20px;border-radius:8px;margin:24px 0}.box .l{font-size:12px;color:#5b4a08;font-weight:600;text-transform:uppercase;letter-spacing:.05em}.box .v{font-family:IBM Plex Mono,Consolas,monospace;font-size:18px;color:#0B1F3A;font-weight:700;margin:4px 0}.box .h{font-size:13px;color:#C9A227}.wait{background:#F8FAFC;border:1px solid #E2E8F0;padding:20px 24px;border-radius:8px;margin:24px 0}.wait h3{margin:0 0 12px;color:#0B1F3A;font-size:16px}.wait ul{margin:0;padding-left:20px}.wait li{margin:6px 0}.wait a{color:#C9A227;text-decoration:none;font-weight:600}.btn{display:inline-block;background:#C9A227;color:#0B1F3A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0}.foot{text-align:center;padding:24px;color:#64748B;font-size:13px}.foot a{color:#C9A227;text-decoration:none}"


def _wrap(body_html: str, tagline: str = "Markets, math, and decisions — without the hype") -> str:
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body><div class='wrap'><div class='hdr'><h1>Epicenter Exchange</h1><p>{tagline}</p></div><div class='card'>{body_html}</div><div class='foot'>Contact: <a href='mailto:{NOTIFY_EMAIL}'>{NOTIFY_EMAIL}</a><br>© 2026 Epicenter Exchange · <a href='{BRAND_URL}'>epicenterexchange.com</a><br>Educational only. Not investment advice.</div></div></body></html>"


def send_contact_confirmation(name, email, topic, message, ticket_id):
    body = f"<p class='greet'>Hi {name}! 👋</p><p>Thank you for reaching out to <strong>Epicenter Exchange</strong>. We've received your message and will review it shortly.</p><div class='box'><div class='l'>Your Ticket ID:</div><div class='v'>{ticket_id}</div><div class='h'>Save this for your records</div></div><p>We typically respond within 24-48 hours.</p><p><strong>Topic:</strong> {topic}<br><strong>Your message:</strong></p><blockquote style='border-left:3px solid #E2E8F0;padding-left:16px;color:#475569;margin:8px 0'>{message[:500]}{'…' if len(message)>500 else ''}</blockquote><div class='wait'><h3>While you wait…</h3><ul><li>Read the <a href='{BRAND_URL}/insights.html'>latest insights</a></li><li>Try the <a href='{BRAND_URL}/tools.html'>SIP / EMI calculators</a></li><li>Run a <a href='{BRAND_URL}/signals.html'>backtest</a></li></ul></div>"
    text = f"Hi {name},\n\nWe received your message. Ticket ID: {ticket_id}. We typically respond within 24-48 hours.\n\nTopic: {topic}\n\nEpicenter Exchange\n{BRAND_URL}"
    # User-facing confirmation
    _send(email, f"We received your message — Ticket {ticket_id}", _wrap(body),
          text, from_email=FROM_EMAIL_CONTACT, from_name=FROM_NAME_CONTACT,
          reply_to=FROM_EMAIL_CONTACT)
    # Admin notification
    admin = f"<p class='greet'>New contact message</p><p><strong>From:</strong> {name} &lt;{email}&gt;<br><strong>Topic:</strong> {topic}<br><strong>Ticket:</strong> {ticket_id}</p><blockquote style='border-left:3px solid #E2E8F0;padding-left:16px'>{message}</blockquote>"
    _send(NOTIFY_EMAIL, f"[Contact] {topic} — {ticket_id}", _wrap(admin), text,
          from_email=FROM_EMAIL_CONTACT, from_name=FROM_NAME_CONTACT,
          reply_to=email)


def send_newsletter_welcome(name, email, unsub_token, latest):
    greet = f"Hi {name}! 👋" if name else "Welcome! 👋"
    unsub_url = f"{API_URL}/newsletter/unsubscribe?token={unsub_token}"
    latest_block = ""
    if latest:
        latest_block = (
            f"<div class='wait'><h3>Latest essay</h3>"
            f"<p style='margin:0 0 6px'><a href='{latest['url']}' style='color:#0B1F3A;font-weight:700;font-size:18px;text-decoration:none'>{latest['title']}</a></p>"
            f"<p style='margin:0;color:#475569'>{latest.get('summary','')}</p>"
            f"<p style='margin:12px 0 0'><a class='btn' href='{latest['url']}'>Read essay →</a></p></div>"
        )
    body = (
        f"<p class='greet'>{greet}</p>"
        f"<p>You're subscribed to <strong>Epicenter Insights</strong> — one math-grounded essay every fortnight on India, US, UK, and crypto markets. No tracking, no spam, one-click unsubscribe.</p>"
        f"{latest_block}"
        f"<div class='wait'><h3>What you'll get</h3><ul>"
        f"<li>One essay every other Sunday — long-form, data-grounded</li>"
        f"<li>Occasional new-tool notes (max once a month)</li>"
        f"<li>Never your data sold or shared</li></ul></div>"
        f"<p style='font-size:13px;color:#64748B;margin-top:24px'>Not interested? "
        f"<a href='{unsub_url}' style='color:#C9A227'>Unsubscribe in one click</a>.</p>"
    )
    text = (
        f"{greet}\n\nYou're subscribed to Epicenter Insights. One essay every fortnight.\n\n"
        f"{(latest['title']+': '+latest['url']) if latest else ''}\n\n"
        f"Unsubscribe: {unsub_url}"
    )
    _send(email, "Welcome to Epicenter Insights", _wrap(body, "Essays on markets, math & money"),
          text, from_email=FROM_EMAIL_NEWSLETTER, from_name=FROM_NAME_NEWSLETTER,
          reply_to=NOTIFY_EMAIL)
