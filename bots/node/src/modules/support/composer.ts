/** Поддержка: создание тикетов пользователем и ответы админов. */
import { desc, eq } from "drizzle-orm";
import { settings } from "../../core/config.js";
import { transaction, userFullName } from "../../core/db/index.js";
import {
  clearState,
  createComposer,
  escapeHtml,
  hasUser,
  inStateText,
  messageHtml,
  setState,
} from "../../platforms/telegram/index.js";
import { isAdmin } from "../admin/filters.js";
import { tablesFor } from "./models.js";

export const composer = createComposer();

const withUser = composer.filter(hasUser);

export const SupportStates = {
  waitingMessage: "SupportStates:waiting_message",
} as const;

// ---------------------- Сторона пользователя ----------------------

withUser.command("support", async (ctx) => {
  setState(ctx, SupportStates.waitingMessage);
  await ctx.reply("✍️ Опишите ваш вопрос одним сообщением. /cancel — отмена.");
});

// Команды (/cancel и т.п.) не считаем текстом обращения — их обработают другие модули
withUser.on("message:text").filter(inStateText(SupportStates.waitingMessage), async (ctx) => {
  clearState(ctx);
  const text = ctx.message.text;
  const html = messageHtml(ctx.message.text, ctx.message.entities);
  const userId = ctx.dbUser.id;

  // Тикет и первое сообщение — атомарно
  const ticket = await transaction(ctx.db, async (tx) => {
    const t = tablesFor(tx);
    const [row] = await tx.orm.insert(t.tickets).values({ userId, status: "open" }).returning();
    if (!row) throw new Error("support: insert ticket не вернул строку");
    await tx.orm.insert(t.messages).values({ ticketId: row.id, fromAdmin: false, text });
    return row;
  });

  await ctx.reply(`✅ Обращение №${ticket.id} принято. Мы ответим здесь же.`);

  // Рассылаем админам
  for (const adminId of settings.adminIds) {
    try {
      await ctx.api.sendMessage(
        adminId,
        `🆕 <b>Тикет №${ticket.id}</b> от ${escapeHtml(userFullName(ctx.dbUser))} ` +
          `(<code>${ctx.dbUser.externalId}</code>):\n\n${html}\n\n` +
          `Ответ: <code>/reply ${ticket.id} текст</code>`,
      );
    } catch {
      // админ мог не запускать бота
    }
  }
});

// ---------------------- Сторона админа ----------------------

withUser.command("reply").filter(isAdmin, async (ctx) => {
  const m = /^(\d+)\s+([\s\S]+)$/.exec(ctx.match.trim());
  if (!m?.[1] || !m[2]) {
    await ctx.reply("Использование: /reply &lt;ticket_id&gt; &lt;текст&gt;");
    return;
  }
  const ticketId = Number(m[1]);
  const text = m[2];
  const t = tablesFor(ctx.db);

  const [ticket] = await ctx.db.orm
    .select()
    .from(t.tickets)
    .where(eq(t.tickets.id, ticketId))
    .limit(1);
  if (!ticket) {
    await ctx.reply(`Тикет №${ticketId} не найден.`);
    return;
  }

  // external_id автора тикета
  const users = ctx.db.tables.users;
  const [author] = await ctx.db.orm
    .select()
    .from(users)
    .where(eq(users.id, ticket.userId))
    .limit(1);
  if (!author) {
    await ctx.reply("Автор тикета не найден.");
    return;
  }

  await ctx.db.orm.insert(t.messages).values({ ticketId: ticket.id, fromAdmin: true, text });
  try {
    await ctx.api.sendMessage(
      author.externalId,
      `💬 <b>Ответ поддержки (тикет №${ticket.id}):</b>\n\n${text}`,
    );
    await ctx.reply(`✅ Отправлено пользователю по тикету №${ticket.id}.`);
  } catch (err) {
    await ctx.reply(`⚠️ Не удалось доставить: ${escapeHtml(String(err))}`);
  }
});

withUser.command("close").filter(isAdmin, async (ctx) => {
  const arg = ctx.match.trim().split(/\s+/)[0] ?? "";
  if (!/^\d+$/.test(arg)) {
    await ctx.reply("Использование: /close &lt;ticket_id&gt;");
    return;
  }
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm
    .update(t.tickets)
    .set({ status: "closed" })
    .where(eq(t.tickets.id, Number(arg)))
    .returning({ id: t.tickets.id });
  const closed = rows[0];
  if (!closed) {
    await ctx.reply("Тикет не найден.");
    return;
  }
  await ctx.reply(`✅ Тикет №${closed.id} закрыт.`);
});

withUser.command("tickets").filter(isAdmin, async (ctx) => {
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm
    .select()
    .from(t.tickets)
    .where(eq(t.tickets.status, "open"))
    .orderBy(desc(t.tickets.id))
    .limit(20);
  if (rows.length === 0) {
    await ctx.reply("Открытых тикетов нет.");
    return;
  }
  const text =
    "📋 <b>Открытые тикеты:</b>\n" +
    rows.map((ticket) => `• №${ticket.id} (user id ${ticket.userId})`).join("\n");
  await ctx.reply(text);
});
