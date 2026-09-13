/**
 * Модерация групп.
 *
 * Команды (ответом на сообщение нарушителя, только для админов чата):
 *   /ban            — забанить
 *   /kick           — исключить (ban+unban)
 *   /mute [минуты]  — заглушить (по умолчанию 60 мин)
 *   /unmute         — снять заглушку
 *   /warn           — предупреждение; после MAX_WARNS — авто-мут на час
 *
 * Плюс антифлуд: слишком частые сообщения → авто-мут на 5 минут.
 *
 * ⚠️ Бот должен быть админом группы. Права проверяются по факту (getChatMember),
 * а не по ADMIN_IDS — модерируют админы конкретного чата.
 * Счётчики warns/flood — в памяти процесса (для одного инстанса).
 */
import type { Api } from "grammy";
import type { ChatPermissions, User } from "grammy/types";
import { getLogger } from "../../core/logger.js";
import {
  type BotContext,
  createComposer,
  escapeHtml,
  fullName,
} from "../../platforms/telegram/index.js";

const log = getLogger("modules.moderation");

export const composer = createComposer();
// Работаем только в группах
const group = composer.chatType(["group", "supergroup"]);

export const MAX_WARNS = 3;
export const FLOOD_LIMIT = 6; // сообщений
export const FLOOD_WINDOW_MS = 5_000; // за столько миллисекунд

const warns = new Map<string, number>();
const flood = new Map<string, number[]>();

const MUTED: ChatPermissions = { can_send_messages: false };
const UNMUTED: ChatPermissions = {
  can_send_messages: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
};

const nowSec = () => Math.floor(Date.now() / 1000);

async function isChatAdmin(api: Api, chatId: number, userId: number): Promise<boolean> {
  try {
    const member = await api.getChatMember(chatId, userId);
    return member.status === "administrator" || member.status === "creator";
  } catch {
    return false;
  }
}

/** Проверяет, что вызвал админ и есть reply. Возвращает автора reply или null. */
async function requireReplyAdmin(ctx: BotContext): Promise<User | null> {
  const message = ctx.message;
  if (!message || !ctx.chat || !ctx.from) return null;
  const replyTo = { reply_parameters: { message_id: message.message_id } };
  if (!(await isChatAdmin(ctx.api, ctx.chat.id, ctx.from.id))) {
    await ctx.reply("⛔️ Только для админов чата.", replyTo);
    return null;
  }
  const target = message.reply_to_message?.from;
  if (!target) {
    await ctx.reply("Ответьте этой командой на сообщение нарушителя.", replyTo);
    return null;
  }
  return target;
}

group.command("ban", async (ctx) => {
  const target = await requireReplyAdmin(ctx);
  if (!target) return;
  await ctx.api.banChatMember(ctx.chat.id, target.id);
  await ctx.reply(`🚫 ${escapeHtml(fullName(target))} забанен.`);
});

group.command("kick", async (ctx) => {
  const target = await requireReplyAdmin(ctx);
  if (!target) return;
  await ctx.api.banChatMember(ctx.chat.id, target.id);
  await ctx.api.unbanChatMember(ctx.chat.id, target.id);
  await ctx.reply(`👢 ${escapeHtml(fullName(target))} исключён.`);
});

group.command("mute", async (ctx) => {
  const target = await requireReplyAdmin(ctx);
  if (!target) return;
  const arg = ctx.match.trim();
  const minutes = /^\d+$/.test(arg) ? Number(arg) : 60;
  await ctx.api.restrictChatMember(ctx.chat.id, target.id, MUTED, {
    until_date: nowSec() + minutes * 60,
  });
  await ctx.reply(`🔇 ${escapeHtml(fullName(target))} заглушён на ${minutes} мин.`);
});

group.command("unmute", async (ctx) => {
  const target = await requireReplyAdmin(ctx);
  if (!target) return;
  await ctx.api.restrictChatMember(ctx.chat.id, target.id, UNMUTED);
  await ctx.reply(`🔊 ${escapeHtml(fullName(target))} снова может писать.`);
});

group.command("warn", async (ctx) => {
  const target = await requireReplyAdmin(ctx);
  if (!target) return;
  const k = `${ctx.chat.id}:${target.id}`;
  const count = (warns.get(k) ?? 0) + 1;
  warns.set(k, count);
  if (count >= MAX_WARNS) {
    await ctx.api.restrictChatMember(ctx.chat.id, target.id, MUTED, {
      until_date: nowSec() + 3600,
    });
    warns.set(k, 0);
    await ctx.reply(`⚠️ ${escapeHtml(fullName(target))}: ${MAX_WARNS}/${MAX_WARNS} — мут на час.`);
  } else {
    await ctx.reply(`⚠️ Предупреждение ${count}/${MAX_WARNS} для ${escapeHtml(fullName(target))}.`);
  }
});

/** Антифлуд. Стоит последним в модуле — считает все сообщения группы. */
group.on(["message:text", "message:caption"], async (ctx) => {
  const from = ctx.message.from;
  const k = `${ctx.chat.id}:${from.id}`;
  const now = performance.now();
  const times = flood.get(k) ?? [];
  times.push(now);
  if (times.length > FLOOD_LIMIT) times.shift();
  flood.set(k, times);

  const first = times[0];
  if (times.length === FLOOD_LIMIT && first !== undefined && now - first < FLOOD_WINDOW_MS) {
    // Не глушим админов
    if (await isChatAdmin(ctx.api, ctx.chat.id, from.id)) return;
    try {
      await ctx.api.restrictChatMember(ctx.chat.id, from.id, MUTED, { until_date: nowSec() + 300 });
      await ctx.reply(`🔇 ${escapeHtml(fullName(from))} заглушён на 5 мин за флуд.`);
    } catch (err) {
      log.warn("Antiflood mute failed: %s", err);
    }
    flood.set(k, []);
  }
});
