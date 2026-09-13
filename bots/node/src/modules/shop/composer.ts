/**
 * Магазин: каталог, корзина, оформление + оплата в Stars.
 *
 * Корзина хранится в FSM-данных пользователя ({product_id: qty}).
 * Оплаченные заказы имеют payload "order:<id>" — их ловит собственный
 * successful_payment этого модуля (подключай shop ДО payments).
 * Заказ с позициями и отметка об оплате пишутся транзакциями.
 */
import { asc, eq } from "drizzle-orm";
import { settings } from "../../core/config.js";
import { type Db, transaction } from "../../core/db/index.js";
import {
  type BotContext,
  createComposer,
  escapeHtml,
  getData,
  hasUser,
  updateData,
} from "../../platforms/telegram/index.js";
import { isAdmin } from "../admin/filters.js";
import { tablesFor as paymentTables } from "../payments/models.js";
import { sendStarsInvoice } from "../payments/service.js";
import { cartKb, productKb } from "./keyboards.js";
import { tablesFor } from "./models.js";

export const composer = createComposer();

const withUser = composer.filter(hasUser);

// ------------------------- helpers -------------------------

type Cart = Record<string, number>;

function getCart(ctx: BotContext): Cart {
  const raw = getData(ctx).cart;
  const cart: Cart = {};
  if (raw && typeof raw === "object") {
    for (const [pid, qty] of Object.entries(raw)) {
      if (typeof qty === "number") cart[pid] = qty;
    }
  }
  return cart;
}

function setCart(ctx: BotContext, cart: Cart): void {
  updateData(ctx, { cart });
}

async function getProduct(db: Db, productId: number) {
  const t = tablesFor(db);
  const [product] = await db.orm
    .select()
    .from(t.products)
    .where(eq(t.products.id, productId))
    .limit(1);
  return product;
}

// ------------------------- сторона покупателя -------------------------

withUser.command("shop", async (ctx) => {
  const t = tablesFor(ctx.db);
  const products = await ctx.db.orm
    .select()
    .from(t.products)
    .where(eq(t.products.isActive, true))
    .orderBy(asc(t.products.id));
  if (products.length === 0) {
    await ctx.reply("🛍 Каталог пока пуст.");
    return;
  }
  await ctx.reply("🛍 <b>Каталог</b>. Нажмите «В корзину» у нужных товаров, затем /cart.");
  for (const p of products) {
    // Тексты товаров вводит админ — экранируем для parse_mode=HTML
    const text = `<b>${escapeHtml(p.title)}</b>\n${escapeHtml(p.description)}\n\nЦена: <b>${p.priceStars} ⭐️</b>`;
    await ctx.reply(text, { reply_markup: productKb(p) });
  }
});

// Корзина живёт в сессии — БД не нужна; работает и для inline-кнопок без chat
composer.callbackQuery(/^shop:add:/, async (ctx) => {
  const pid = ctx.callbackQuery.data.split(":")[2] ?? "";
  const cart = getCart(ctx);
  cart[pid] = (cart[pid] ?? 0) + 1;
  setCart(ctx, cart);
  await ctx.answerCallbackQuery("Добавлено в корзину ✅");
});

withUser.command("cart", async (ctx) => {
  const cart = getCart(ctx);
  if (Object.keys(cart).length === 0) {
    await ctx.reply("🛒 Корзина пуста. Откройте /shop.");
    return;
  }

  const lines: string[] = [];
  let total = 0;
  for (const [pid, qty] of Object.entries(cart)) {
    const product = await getProduct(ctx.db, Number(pid));
    if (!product) continue;
    const subtotal = product.priceStars * qty;
    total += subtotal;
    lines.push(`• ${escapeHtml(product.title)} × ${qty} = ${subtotal} ⭐️`);
  }

  const text = `🛒 <b>Ваша корзина:</b>\n${lines.join("\n")}\n\nИтого: <b>${total} ⭐️</b>`;
  await ctx.reply(text, { reply_markup: cartKb() });
});

composer.callbackQuery("shop:clear", async (ctx) => {
  setCart(ctx, {});
  await ctx.editMessageText("🗑 Корзина очищена.");
  await ctx.answerCallbackQuery();
});

withUser.callbackQuery("shop:checkout", async (ctx) => {
  const cart = getCart(ctx);
  if (Object.keys(cart).length === 0) {
    await ctx.answerCallbackQuery({ text: "Корзина пуста", show_alert: true });
    return;
  }

  // Заказ, позиции и итог — одной транзакцией: без «пустых» заказов при ошибке
  const userId = ctx.dbUser.id;
  const { orderId, total } = await transaction(ctx.db, async (tx) => {
    const t = tablesFor(tx);
    const [order] = await tx.orm.insert(t.orders).values({ userId, status: "pending" }).returning();
    if (!order) throw new Error("shop: insert order не вернул строку");
    let sum = 0;
    for (const [pid, qty] of Object.entries(cart)) {
      const product = await getProduct(tx, Number(pid));
      if (!product) continue;
      sum += product.priceStars * qty;
      await tx.orm.insert(t.orderItems).values({
        orderId: order.id,
        productId: product.id,
        title: product.title,
        priceStars: product.priceStars,
        qty,
      });
    }
    await tx.orm.update(t.orders).set({ totalStars: sum }).where(eq(t.orders.id, order.id));
    return { orderId: order.id, total: sum };
  });

  setCart(ctx, {});
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id ?? ctx.from.id;
  await sendStarsInvoice(ctx.api, chatId, {
    title: `Заказ №${orderId}`,
    description: `Оплата заказа №${orderId}`,
    payload: `order:${orderId}`,
    stars: Math.max(1, total),
  });
});

withUser.on("message:successful_payment").filter(
  (ctx) => ctx.message.successful_payment.invoice_payload.startsWith("order:"),
  async (ctx) => {
    const sp = ctx.message.successful_payment;
    const orderId = Number(sp.invoice_payload.split(":")[1]);
    const userId = ctx.dbUser.id;
    await transaction(ctx.db, async (tx) => {
      const t = tablesFor(tx);
      await tx.orm.update(t.orders).set({ status: "paid" }).where(eq(t.orders.id, orderId));
      await tx.orm.insert(paymentTables(tx).payments).values({
        userId,
        amount: sp.total_amount,
        currency: sp.currency,
        payload: sp.invoice_payload,
        telegramChargeId: sp.telegram_payment_charge_id,
        status: "paid",
      });
    });
    await ctx.reply(`✅ Заказ №${orderId} оплачён. Спасибо за покупку!`);
    for (const adminId of settings.adminIds) {
      try {
        await ctx.api.sendMessage(
          adminId,
          `💰 Оплачен заказ №${orderId} на ${sp.total_amount} ${sp.currency}`,
        );
      } catch {
        // админ мог не запускать бота
      }
    }
  },
);

// ------------------------- сторона админа -------------------------

/** /addproduct Название | 100 | Описание (цена в звёздах). */
withUser.command("addproduct").filter(isAdmin, async (ctx) => {
  const raw = ctx.match.trim();
  if (!raw.includes("|")) {
    await ctx.reply("Формат: <code>/addproduct Название | цена | Описание</code>");
    return;
  }
  const parts = raw.split("|").map((part) => part.trim());
  const title = parts[0] ?? "";
  const priceRaw = parts[1] ?? "";
  if (!/^\d+$/.test(priceRaw)) {
    await ctx.reply("Цена должна быть целым числом звёзд.");
    return;
  }
  const price = Number(priceRaw);
  const description = parts[2] ?? "";
  const [product] = await ctx.db.orm
    .insert(tablesFor(ctx.db).products)
    .values({ title, priceStars: price, description })
    .returning();
  if (!product) throw new Error("shop: insert product не вернул строку");
  await ctx.reply(`✅ Товар №${product.id} «${escapeHtml(title)}» добавлен (${price} ⭐️).`);
});

withUser.command("products").filter(isAdmin, async (ctx) => {
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm.select().from(t.products).orderBy(asc(t.products.id));
  if (rows.length === 0) {
    await ctx.reply("Товаров нет.");
    return;
  }
  const text =
    "📦 <b>Товары:</b>\n" +
    rows
      .map(
        (p) => `• №${p.id} ${p.isActive ? "🟢" : "🔴"} ${escapeHtml(p.title)} — ${p.priceStars} ⭐️`,
      )
      .join("\n");
  await ctx.reply(`${text}\n\nСкрыть: <code>/delproduct id</code>`);
});

withUser.command("delproduct").filter(isAdmin, async (ctx) => {
  const arg = ctx.match.trim().split(/\s+/)[0] ?? "";
  if (!/^\d+$/.test(arg)) {
    await ctx.reply("Использование: /delproduct &lt;id&gt;");
    return;
  }
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm
    .update(t.products)
    .set({ isActive: false })
    .where(eq(t.products.id, Number(arg)))
    .returning({ id: t.products.id });
  const hidden = rows[0];
  if (!hidden) {
    await ctx.reply("Товар не найден.");
    return;
  }
  await ctx.reply(`✅ Товар №${hidden.id} скрыт.`);
});
