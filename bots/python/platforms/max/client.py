"""HTTP-клиент MAX Bot API (каркас).

⚠️ BASE_URL и имена методов/полей нужно сверить с официальной документацией MAX
перед боевым использованием. Структура повторяет типовое бот-API.
"""
from __future__ import annotations

from typing import Any

import aiohttp

from core.config import settings
from core.logger import get_logger

log = get_logger(__name__)

# TODO: заменить на актуальный базовый URL MAX Bot API из официальной документации
BASE_URL = "https://botapi.max.ru"


class MaxClient:
    def __init__(self, token: str | None = None) -> None:
        self.token = token or settings.max_bot_token
        if not self.token:
            log.warning("MAX_BOT_TOKEN не задан — MAX-клиент не сможет слать сообщения")

    async def _request(self, method: str, **params: Any) -> dict[str, Any]:
        url = f"{BASE_URL}/{method}"
        params = {"access_token": self.token, **params}
        async with aiohttp.ClientSession() as http:
            async with http.post(url, json=params) as resp:
                data = await resp.json()
                if resp.status >= 400:
                    log.error("MAX API error %s on %s: %s", resp.status, method, data)
                return data

    async def send_text(self, chat_id: int | str, text: str) -> dict[str, Any]:
        """Отправить текстовое сообщение (сверь имя метода/полей с доками MAX)."""
        return await self._request("messages", chat_id=chat_id, text=text)

    # TODO: get_updates / long-polling loop, webhook, send_keyboard
