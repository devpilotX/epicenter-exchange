"""POST /contact — own DB + HTML confirmation email."""
from __future__ import annotations
import re
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from .db import save_contact
from .email_send import send_contact_confirmation

router = APIRouter()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=200)
    topic: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=8000)


@router.post("/contact")
def post_contact(payload: ContactIn, request: Request) -> dict:
    if not _EMAIL_RE.match(payload.email):
        raise HTTPException(400, "Invalid email address")
    blob = (payload.name + " " + payload.message).lower()
    if ("http://" in blob or "https://" in blob) and len(payload.message) < 60:
        raise HTTPException(400, "Message looks spammy")
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")[:300]
    tid = save_contact(payload.name, payload.email, payload.topic, payload.message, ip, ua)
    try:
        send_contact_confirmation(payload.name, payload.email, payload.topic, payload.message, tid)
    except Exception as e:
        return {"ticket_id": tid, "saved": True, "email_sent": False, "warn": str(e)[:200]}
    return {"ticket_id": tid, "saved": True, "email_sent": True}
