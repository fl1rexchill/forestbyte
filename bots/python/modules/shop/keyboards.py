"""Клавиатуры магазина. callback_data с префиксом shop:*"""
from __future__ import annotations

from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from modules.shop.models import Product


def product_kb(product: Product) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=f"🛒 В корзину · {product.price_stars} ⭐️", callback_data=f"shop:add:{product.id}")
    return kb.as_markup()


def cart_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Оформить и оплатить", callback_data="shop:checkout")
    kb.button(text="🗑 Очистить корзину", callback_data="shop:clear")
    kb.adjust(1)
    return kb.as_markup()
