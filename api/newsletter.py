"""POST /newsletter/subscribe and GET /newsletter/unsubscribe."""
from __future__ import annotations
import re
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, ConfigDict

from .db import save_subscriber, unsubscribe, latest_article
from .email_send import send_newsletter_welcome

router = APIRouter()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SubIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: str = Field(..., min_length=3, max_length=200)
    name: str = Field("", max_length=120)
    source: str = Field("", max_length=120)


@router.post("/newsletter/subscribe")
def subscribe(payload: SubIn, request: Request) -> dict:
    if not _EMAIL_RE.match(payload.email):
        raise HTTPException(400, "Invalid email")
    ip = request.client.host if request.client else ""
    added, token = save_subscriber(payload.email, payload.name, payload.source, ip)
    if added:
        try:
            send_newsletter_welcome(payload.name, payload.email, token, latest_article())
        except Exception as e:
            return {"subscribed": True, "already_existed": False, "email_sent": False, "warn": str(e)[:200]}
        return {"subscribed": True, "already_existed": False, "email_sent": True}
    return {"subscribed": True, "already_existed": True}


@router.get("/newsletter/unsubscribe", response_class=HTMLResponse)
def unsub(token: str = Query(..., min_length=10, max_length=200)) -> str:
    ok = unsubscribe(token)
    msg = "You have been unsubscribed." if ok else "Token not found or already unsubscribed."
    return f"<!doctype html><html><head><meta charset='utf-8'><title>Unsubscribed — Epicenter Exchange</title><style>bodyfont-family:Inter,Segoe UI,sans-serif;background:#F8FAFC;padding:60px 20px;text-align:center;color:#0F172A.cmax-width:520px;margin:0 auto;background:#fff;padding:40px;border-radius:12pxh1color:#0B1F3A;font-family:Fraunces,Georgia,serifacolor:#C9A227;text-decoration:none</style></head><body><div class='c'><h1>{msg}</h1><p>Re-subscribe anytime at <a href='https://epicenterexchange.com/insights.html'>epicenterexchange.com</a>.</p></div></body></html>"
