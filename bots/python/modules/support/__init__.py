"""Модуль support: тикеты в поддержку (пользователь ↔ админ).

Подключение (ДО common_router):
    from modules.support import router as support_router
    dp.include_router(support_router)

Пользователь: /support → пишет вопрос → уходит всем админам.
Админ: /reply <ticket_id> <текст> → ответ доставляется пользователю.
       /close <ticket_id> → закрыть тикет.
"""
from modules.support.router import router

__all__ = ["router"]
