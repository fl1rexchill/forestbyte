/** Клавиатуры магазина. callback_data с префиксом shop:* */
import { InlineKeyboard } from "grammy";
import type { Product } from "./models.js";

export function productKb(product: Pick<Product, "id" | "priceStars">): InlineKeyboard {
  return new InlineKeyboard().text(
    `🛒 В корзину · ${product.priceStars} ⭐️`,
    `shop:add:${product.id}`,
  );
}

export function cartKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Оформить и оплатить", "shop:checkout")
    .row()
    .text("🗑 Очистить корзину", "shop:clear");
}
