"""HTTP-клиент Instagram Graph API (Messaging).

Каркас: send_text реализован по документации Graph API v21.0. Перед боевым
использованием проверь версию API и разрешения приложения.
"""
from __future__ import annotations

from typing import Any

import aiohttp

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)

GRAPH_API = "https://graph.facebook.com/v21.0"


class InstagramClient:
    def __init__(self, access_token: str | None = None) -> None:
        self.access_token = access_token or settings.ig_access_token
        if not self.access_token:
            log.warning("IG_ACCESS_TOKEN не задан — Instagram-клиент не сможет слать сообщения")

    async def send_text(self, recipient_id: str, text: str) -> dict[str, Any]:
        """Отправить текст пользователю (recipient_id = IGSID)."""
        url = f"{GRAPH_API}/me/messages"
        params = {"access_token": self.access_token or ""}
        payload = {"recipient": {"id": recipient_id}, "message": {"text": text}}
        async with aiohttp.ClientSession() as http:
            async with http.post(url, params=params, json=payload) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    log.error("IG send error %s: %s", resp.status, data)
                return data

    # TODO: send_image, send_quick_replies, mark_seen, get_user_profile
