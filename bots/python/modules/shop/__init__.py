"""Модуль shop: каталог, корзина, заказы с оплатой в Telegram Stars.

Подключение (shop ДО payments и common):
    from modules.shop import router as shop_router
    dp.include_router(shop_router)

Покупатель: /shop → добавляет в корзину → /cart → оформить → оплата.
Админ: /addproduct, /products, /delproduct.

Зависит от modules.payments (использует send_stars_invoice) и core.db.
Оплаченные заказы имеют payload "order:<id>", поэтому shop должен идти
раньше payments в include_router (иначе платёж перехватит payments).
"""
from modules.shop.router import router

__all__ = ["router"]
