"""SMTP email sender + HTML templates. Pure stdlib.

Env vars (loaded automatically from api/.env if present):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  FROM_EMAIL, FROM_NAME                  - default sender
  FROM_EMAIL_CONTACT, FROM_NAME_CONTACT  - used by /contact route
  FROM_EMAIL_NEWSLETTER, FROM_NAME_NEWSLETTER  - used by /newsletter route
  NOTIFY_EMAIL                            - internal admin recipient (NEVER shown to users)
"""
from __future__ import annotations
import os, re, smtplib, ssl
from email.message import EmailMessage
from email.policy import SMTPUTF8
from email.utils import formataddr

# Strip zero-width / invisible Unicode chars that crash naive SMTP encoders.
_INVISIBLE_RE = re.compile(r"[\u200B\u200C\u200D\uFEFF\u2060\u00AD\u180E]")


def _clean(s) -> str:
    if s is None:
        return ""
    return _INVISIBLE_RE.sub("", str(s)).replace("\r\n", "\n").strip()


# ---- Auto-load .env file BEFORE reading env vars ----
def _load_env_file(path: str) -> bool:
    if not os.path.exists(path):
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k = k.strip()
                v = v.strip()
                if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                    v = v[1:-1]
                if k and k not in os.environ:
                    os.environ[k] = v
        print(f"[email] loaded .env from {path}")
        return True
    except Exception as e:
        print(f"[email] .env load failed for {path}: {e}")
        return False

_here = os.path.dirname(os.path.abspath(__file__))
for _p in (
    os.path.join(_here, ".env"),
    "/opt/epicenter-exchange/api/.env",
    "/etc/epicenter-exchange/.env",
):
    if _load_env_file(_p):
        break

SMTP_HOST = _clean(os.environ.get("SMTP_HOST", "smtp.resend.com"))
_smtp_port_raw = _clean(os.environ.get("SMTP_PORT", "465"))
SMTP_PORT = int(_smtp_port_raw) if _smtp_port_raw else 465
SMTP_USER = _clean(os.environ.get("SMTP_USER", ""))
_raw_pass = os.environ.get("SMTP_PASS", "") or ""
SMTP_PASS = _clean(_raw_pass)
_pass_diff = len(_raw_pass) - len(SMTP_PASS)

FROM_EMAIL = _clean(os.environ.get("FROM_EMAIL", "hello@epicenterexchange.com"))
FROM_NAME = _clean(os.environ.get("FROM_NAME", "Epicenter Exchange"))

FROM_EMAIL_CONTACT = _clean(os.environ.get("FROM_EMAIL_CONTACT", FROM_EMAIL))
FROM_NAME_CONTACT = _clean(os.environ.get("FROM_NAME_CONTACT", FROM_NAME))
FROM_EMAIL_NEWSLETTER = _clean(os.environ.get("FROM_EMAIL_NEWSLETTER", FROM_EMAIL))
FROM_NAME_NEWSLETTER = _clean(os.environ.get("FROM_NAME_NEWSLETTER", FROM_NAME))

# NOTIFY_EMAIL is the INTERNAL admin recipient. Never display this in user-facing emails.
NOTIFY_EMAIL = _clean(os.environ.get("NOTIFY_EMAIL", FROM_EMAIL_CONTACT))
BRAND_URL = "https://epicenterexchange.com"
API_URL = _clean(os.environ.get("API_URL", "https://api.epicenterexchange.com"))


def config_status() -> dict:
    return {
        "smtp_host": SMTP_HOST,
        "smtp_port": SMTP_PORT,
        "smtp_user": SMTP_USER if SMTP_USER else "",
        "smtp_user_set": bool(SMTP_USER),
        "smtp_pass_set": bool(SMTP_PASS),
        "smtp_pass_len": len(SMTP_PASS),
        "smtp_pass_raw_len": len(_raw_pass),
        "smtp_pass_invisible_chars_stripped": _pass_diff,
        "from_email_contact": FROM_EMAIL_CONTACT,
        "from_name_contact": FROM_NAME_CONTACT,
        "from_email_newsletter": FROM_EMAIL_NEWSLETTER,
        "from_name_newsletter": FROM_NAME_NEWSLETTER,
        "notify_email_configured": bool(NOTIFY_EMAIL),  # never expose value
        "api_url": API_URL,
    }

print(f"[email] startup config: smtp_host={SMTP_HOST}:{SMTP_PORT} "
      f"smtp_user={'<set len=' + str(len(SMTP_USER)) + '>' if SMTP_USER else 'EMPTY'} "
      f"smtp_pass={'<set len=' + str(len(SMTP_PASS)) + '>' if SMTP_PASS else 'EMPTY'} "
      f"invisibles_stripped_from_pass={_pass_diff} "
      f"contact_from={FROM_EMAIL_CONTACT} newsletter_from={FROM_EMAIL_NEWSLETTER}")


def _send(to_email: str, subject: str, html: str, text: str,
          from_email: str | None = None, from_name: str | None = None,
          reply_to: str | None = None) -> None:
    if not SMTP_USER or not SMTP_PASS:
        raise RuntimeError(
            "SMTP credentials missing: SMTP_USER="
            + ("<set>" if SMTP_USER else "EMPTY")
            + ", SMTP_PASS="
            + ("<set>" if SMTP_PASS else "EMPTY")
            + ". Check /opt/epicenter-exchange/api/.env"
        )

    to_email = _clean(to_email)
    subject = _clean(subject)
    html = _INVISIBLE_RE.sub("", str(html)).replace("\r\n", "\n")
    text = _INVISIBLE_RE.sub("", str(text)).replace("\r\n", "\n")
    from_email = _clean(from_email or FROM_EMAIL)
    from_name = _clean(from_name or FROM_NAME)
    reply_to = _clean(reply_to) if reply_to else None

    msg = EmailMessage(policy=SMTPUTF8)
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text, charset="utf-8")
    msg.add_alternative(html, subtype="html", charset="utf-8")

    raw = msg.as_bytes()

    ctx = ssl.create_default_context()
    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=15) as s:
                s.ehlo()
                s.login(SMTP_USER, SMTP_PASS)
                s.sendmail(from_email, [to_email], raw)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.ehlo()
                s.login(SMTP_USER, SMTP_PASS)
                s.sendmail(from_email, [to_email], raw)
        print(f"[email] sent OK to {to_email} from {from_email}")
    except smtplib.SMTPAuthenticationError as e:
        raise RuntimeError(f"SMTP auth failed: {e}") from e
    except smtplib.SMTPException as e:
        raise RuntimeError(f"SMTP error: {e}") from e
    except UnicodeEncodeError as e:
        raise RuntimeError(f"Unicode in SMTP frame: {e}. "
                           f"from={from_email!r} to={to_email!r} subject={subject!r}") from e
    except Exception as e:
        raise RuntimeError(f"Email send failed: {type(e).__name__}: {e}") from e


CSS = "body{font-family:Inter,Segoe UI,Arial,sans-serif;background:#F8FAFC;margin:0;padding:40px 20px;color:#0F172A}.wrap{max-width:600px;margin:0 auto}.hdr{background:#0B1F3A;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center}.hdr h1{color:#C9A227;font-family:Fraunces,Georgia,serif;margin:0;font-size:28px}.hdr p{color:rgba(255,255,255,.7);margin:6px 0 0;font-size:14px}.card{background:#fff;padding:32px;border-radius:0 0 12px 12px}.greet{font-size:22px;color:#C9A227;font-weight:600;margin:0 0 16px}.box{background:#FBF6E1;border-left:4px solid #C9A227;padding:16px 20px;border-radius:8px;margin:24px 0}.box .l{font-size:12px;color:#5b4a08;font-weight:600;text-transform:uppercase;letter-spacing:.05em}.box .v{font-family:IBM Plex Mono,Consolas,monospace;font-size:18px;color:#0B1F3A;font-weight:700;margin:4px 0}.box .h{font-size:13px;color:#C9A227}.wait{background:#F8FAFC;border:1px solid #E2E8F0;padding:20px 24px;border-radius:8px;margin:24px 0}.wait h3{margin:0 0 12px;color:#0B1F3A;font-size:16px}.wait ul{margin:0;padding-left:20px}.wait li{margin:6px 0}.wait a{color:#C9A227;text-decoration:none;font-weight:600}.btn{display:inline-block;background:#C9A227;color:#0B1F3A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:8px 0}.foot{text-align:center;padding:24px;color:#64748B;font-size:13px}.foot a{color:#C9A227;text-decoration:none}"


def _wrap(body_html: str, tagline: str, contact_email: str) -> str:
    """Wrap email body with header + footer.

    contact_email is the PUBLIC reply address shown in footer
    (hello@... for contact, insights@... for newsletter).
    Never use NOTIFY_EMAIL here.
    """
    return (
        "<!doctype html><html><head><meta charset='utf-8'><style>"
        + CSS + "</style></head><body><div class='wrap'>"
        "<div class='hdr'><h1>Epicenter Exchange</h1><p>" + tagline + "</p></div>"
        "<div class='card'>" + body_html + "</div>"
        "<div class='foot'>Contact: <a href='mailto:" + contact_email + "'>" + contact_email + "</a><br>"
        "&copy; 2026 Epicenter Exchange &middot; "
        "<a href='" + BRAND_URL + "'>epicenterexchange.com</a><br>"
        "Educational only. Not investment advice."
        "</div></div></body></html>"
    )


def send_contact_confirmation(name, email, topic, message, ticket_id):
    msg_preview = message[:500] + ("..." if len(message) > 500 else "")
    body = (
        "<p class='greet'>Hi " + str(name) + "! &#128075;</p>"
        "<p>Thank you for reaching out to <strong>Epicenter Exchange</strong>. "
        "We've received your message and will review it shortly.</p>"
        "<div class='box'><div class='l'>Your Ticket ID:</div>"
        "<div class='v'>" + str(ticket_id) + "</div>"
        "<div class='h'>Save this for your records</div></div>"
        "<p>We typically respond within 24-48 hours.</p>"
        "<p><strong>Topic:</strong> " + str(topic) + "<br><strong>Your message:</strong></p>"
        "<blockquote style='border-left:3px solid #E2E8F0;padding-left:16px;color:#475569;margin:8px 0'>"
        + msg_preview + "</blockquote>"
        "<div class='wait'><h3>While you wait...</h3><ul>"
        "<li>Read the <a href='" + BRAND_URL + "/insights'>latest insights</a></li>"
        "<li>Try the <a href='" + BRAND_URL + "/tools'>SIP / EMI calculators</a></li>"
        "<li>Run a <a href='" + BRAND_URL + "/signals'>backtest</a></li>"
        "</ul></div>"
    )
    text = (
        "Hi " + str(name) + ",\n\n"
        "We received your message. Ticket ID: " + str(ticket_id) + ".\n"
        "We typically respond within 24-48 hours.\n\n"
        "Topic: " + str(topic) + "\n\n"
        "Epicenter Exchange\n" + BRAND_URL
    )
    # User confirmation: from + footer + reply-to all show hello@
    _send(email, "We received your message - Ticket " + str(ticket_id),
          _wrap(body, "Markets, math, and decisions without the hype", FROM_EMAIL_CONTACT),
          text,
          from_email=FROM_EMAIL_CONTACT, from_name=FROM_NAME_CONTACT,
          reply_to=FROM_EMAIL_CONTACT)
    # Admin notification: goes to NOTIFY_EMAIL (internal), but footer still shows hello@ in case it's forwarded
    admin = (
        "<p class='greet'>New contact message</p>"
        "<p><strong>From:</strong> " + str(name) + " &lt;" + str(email) + "&gt;<br>"
        "<strong>Topic:</strong> " + str(topic) + "<br>"
        "<strong>Ticket:</strong> " + str(ticket_id) + "</p>"
        "<blockquote style='border-left:3px solid #E2E8F0;padding-left:16px'>"
        + str(message) + "</blockquote>"
    )
    _send(NOTIFY_EMAIL, "[Contact] " + str(topic) + " - " + str(ticket_id),
          _wrap(admin, "Admin notification", FROM_EMAIL_CONTACT),
          text,
          from_email=FROM_EMAIL_CONTACT, from_name=FROM_NAME_CONTACT,
          reply_to=email)


def send_newsletter_welcome(name, email, unsub_token, latest):
    greet = ("Hi " + str(name) + "! &#128075;") if name else "Welcome! &#128075;"
    unsub_url = API_URL + "/newsletter/unsubscribe?token=" + str(unsub_token)
    latest_block = ""
    if latest:
        latest_block = (
            "<div class='wait'><h3>Latest essay</h3>"
            "<p style='margin:0 0 6px'><a href='" + latest['url'] + "' "
            "style='color:#0B1F3A;font-weight:700;font-size:18px;text-decoration:none'>"
            + latest['title'] + "</a></p>"
            "<p style='margin:0;color:#475569'>" + latest.get('summary', '') + "</p>"
            "<p style='margin:12px 0 0'><a class='btn' href='" + latest['url'] + "'>"
            "Read essay &rarr;</a></p></div>"
        )
    body = (
        "<p class='greet'>" + greet + "</p>"
        "<p>You're subscribed to <strong>Epicenter Insights</strong> - one "
        "math-grounded essay every fortnight on India, US, UK, and crypto markets. "
        "No tracking, no spam, one-click unsubscribe.</p>"
        + latest_block +
        "<div class='wait'><h3>What you'll get</h3><ul>"
        "<li>One essay every other Sunday - long-form, data-grounded</li>"
        "<li>Occasional new-tool notes (max once a month)</li>"
        "<li>Never your data sold or shared</li></ul></div>"
        "<p style='font-size:13px;color:#64748B;margin-top:24px'>Not interested? "
        "<a href='" + unsub_url + "' style='color:#C9A227'>Unsubscribe in one click</a>."
        "</p>"
    )
    text_name = (str(name) + "! ") if name else ""
    text = (
        "Hi " + text_name + "\n\n"
        "You're subscribed to Epicenter Insights. One essay every fortnight.\n\n"
        + ((latest['title'] + ": " + latest['url']) if latest else "") + "\n\n"
        "Unsubscribe: " + unsub_url
    )
    # Newsletter: from + footer + reply-to all show insights@
    _send(email, "Welcome to Epicenter Insights",
          _wrap(body, "Essays on markets, math & money", FROM_EMAIL_NEWSLETTER),
          text,
          from_email=FROM_EMAIL_NEWSLETTER, from_name=FROM_NAME_NEWSLETTER,
          reply_to=FROM_EMAIL_NEWSLETTER)
