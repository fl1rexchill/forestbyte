/**
 * Платежи: демо-донат в Stars, подтверждение оплаты, запись в БД.
 *
 * Обязательные части любого платёжного бота:
 *  1) ответ на pre_checkout_query в течение 10 сек (иначе оплата отменится);
 *  2) обработка сообщения об успешной оплате (successful_payment).
 */
import { createComposer, hasUser } from "../../platforms/telegram/index.js";
import { tablesFor } from "./models.js";
import { sendStarsInvoice } from "./service.js";

export const composer = createComposer();

/** Демо: донат 50 звёзд. В реальном боте сумму/товар подставляй динамически. */
composer.command("donate", async (ctx) => {
  await sendStarsInvoice(ctx.api, ctx.chat.id, {
    title: "Поддержать бота",
    description: "Спасибо за поддержку! 50 ⭐️",
    payload: "donate:50",
    stars: 50,
  });
});

composer.on("pre_checkout_query", async (ctx) => {
  // Здесь можно проверить наличие товара/цену. Ответить нужно всегда.
  await ctx.answerPreCheckoutQuery(true);
});

// Для записи оплаты нужен пользователь из БД — только после usersMiddleware
composer.filter(hasUser).on("message:successful_payment", async (ctx) => {
  const sp = ctx.message.successful_payment;
  await ctx.db.orm.insert(tablesFor(ctx.db).payments).values({
    userId: ctx.dbUser.id,
    amount: sp.total_amount,
    currency: sp.currency,
    payload: sp.invoice_payload,
    telegramChargeId: sp.telegram_payment_charge_id,
    status: "paid",
  });
  await ctx.reply(`✅ Оплата получена: ${sp.total_amount} ${sp.currency}. Спасибо!`);
});
