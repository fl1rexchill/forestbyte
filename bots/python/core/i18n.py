"""Простая мультиязычность без внешних зависимостей.

Тексты хранятся в словарях по локалям. Для больших проектов заменяется на gettext/Fluent,
но для 90% ботов этого достаточно.

Использование:
    from core.i18n import t
    t("start.hello", locale="ru", name="Ваня")
"""
from __future__ import annotations

from core.config import settings

# Словари переводов. Ключи вида "модуль.строка".
TRANSLATIONS: dict[str, dict[str, str]] = {
    "ru": {
        "start.hello": "👋 Привет, {name}! Я бот. Напиши /help, чтобы узнать возможности.",
        "start.back": "С возвращением, {name}!",
        "help.text": "📖 Доступные команды:\n/start — начать\n/help — помощь",
        "common.cancelled": "❌ Отменено.",
        "common.no_access": "⛔️ Недостаточно прав.",
        "common.banned": "🚫 Вы заблокированы.",
        "admin.panel": "🛠 <b>Панель администратора</b>\nВыберите раздел:",
        "admin.stats_btn": "📊 Статистика",
        "admin.broadcast_btn": "📣 Рассылка",
        "admin.users_btn": "👥 Пользователи",
        "stats.title": "📊 <b>Статистика</b>",
        "broadcast.ask_text": "✍️ Пришлите текст рассылки. /cancel — отмена.",
        "broadcast.confirm": "Отправить рассылку {count} пользователям?",
        "broadcast.started": "🚀 Рассылка запущена...",
        "broadcast.done": "✅ Готово. Отправлено: {sent}, ошибок: {failed}.",
    },
    "en": {
        "start.hello": "👋 Hi, {name}! I'm a bot. Type /help to see what I can do.",
        "start.back": "Welcome back, {name}!",
        "help.text": "📖 Commands:\n/start — begin\n/help — help",
        "common.cancelled": "❌ Cancelled.",
        "common.no_access": "⛔️ Access denied.",
        "common.banned": "🚫 You are banned.",
        "admin.panel": "🛠 <b>Admin panel</b>\nChoose a section:",
        "admin.stats_btn": "📊 Statistics",
        "admin.broadcast_btn": "📣 Broadcast",
        "admin.users_btn": "👥 Users",
        "stats.title": "📊 <b>Statistics</b>",
        "broadcast.ask_text": "✍️ Send the broadcast text. /cancel to abort.",
        "broadcast.confirm": "Send broadcast to {count} users?",
        "broadcast.started": "🚀 Broadcast started...",
        "broadcast.done": "✅ Done. Sent: {sent}, failed: {failed}.",
    },
}


def t(key: str, locale: str | None = None, **kwargs: object) -> str:
    """Вернуть перевод по ключу с подстановкой параметров.

    Падение на дефолтную локаль, затем на сам ключ, если перевода нет.
    """
    loc = locale or settings.default_locale
    table = TRANSLATIONS.get(loc) or TRANSLATIONS.get(settings.default_locale, {})
    template = table.get(key) or TRANSLATIONS.get("en", {}).get(key) or key
    try:
        return template.format(**kwargs) if kwargs else template
    except (KeyError, IndexError):
        return template
