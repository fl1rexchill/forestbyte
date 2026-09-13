/** Планировщик (только админы): создать/список/отменить отложенные посты. */
import { and, asc, eq } from "drizzle-orm";
import { createComposer, hasUser } from "../../platforms/telegram/index.js";
import { isAdmin } from "../admin/filters.js";
import { tablesFor } from "./models.js";

export const composer = createComposer();

const admin = composer.filter(hasUser).filter(isAdmin);

/** "ГГГГ-ММ-ДД ЧЧ:ММ" (UTC) → Date; null, если дата некорректна (как strptime в Python). */
export function parseUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2})$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute;
  return valid ? date : null;
}

const formatUtc = (date: Date): string => date.toISOString().slice(0, 16).replace("T", " ");

/** /schedule 2026-09-10 15:30 | текст рассылки всем (время в UTC). */
admin.command("schedule", async (ctx) => {
  const raw = ctx.match.trim();
  if (!raw.includes("|")) {
    await ctx.reply(
      "Формат: <code>/schedule ГГГГ-ММ-ДД ЧЧ:ММ | текст</code>\n" +
        "Время в UTC. Текст уйдёт всем активным пользователям.",
    );
    return;
  }

  const sep = raw.indexOf("|");
  const whenStr = raw.slice(0, sep).trim();
  const text = raw.slice(sep + 1).trim();
  const runAt = parseUtc(whenStr);
  if (!runAt) {
    await ctx.reply("Не удалось разобрать дату. Пример: 2026-09-10 15:30");
    return;
  }
  if (runAt.getTime() <= Date.now()) {
    await ctx.reply("⏰ Время уже прошло. Укажите будущий момент (UTC).");
    return;
  }

  const t = tablesFor(ctx.db);
  const [post] = await ctx.db.orm
    .insert(t.posts)
    .values({ createdBy: ctx.dbUser.externalId, text, target: "all", runAt })
    .returning();
  if (!post) throw new Error("scheduler: insert не вернул строку");
  await ctx.reply(`✅ Запланировано №${post.id} на ${whenStr} UTC (получателей: все активные).`);
});

admin.command("scheduled", async (ctx) => {
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm
    .select()
    .from(t.posts)
    .where(eq(t.posts.status, "pending"))
    .orderBy(asc(t.posts.runAt));
  if (rows.length === 0) {
    await ctx.reply("Нет запланированных задач.");
    return;
  }
  const text =
    "🗓 <b>Запланировано:</b>\n" +
    rows
      .map((post) => `• №${post.id} — ${formatUtc(post.runAt)} UTC — ${post.text.slice(0, 30)}…`)
      .join("\n");
  await ctx.reply(text);
});

admin.command("unschedule", async (ctx) => {
  const arg = ctx.match.trim().split(/\s+/)[0] ?? "";
  if (!/^\d+$/.test(arg)) {
    await ctx.reply("Использование: /unschedule &lt;id&gt;");
    return;
  }
  const t = tablesFor(ctx.db);
  const rows = await ctx.db.orm
    .update(t.posts)
    .set({ status: "cancelled" })
    .where(and(eq(t.posts.id, Number(arg)), eq(t.posts.status, "pending")))
    .returning({ id: t.posts.id });
  const cancelled = rows[0];
  if (!cancelled) {
    await ctx.reply("Задача не найдена или уже выполнена.");
    return;
  }
  await ctx.reply(`✅ Задача №${cancelled.id} отменена.`);
});
