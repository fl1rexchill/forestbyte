/**
 * Капча для новых участников группы.
 *
 * Логика:
 *  1) новый участник входит → бот ограничивает ему отправку сообщений;
 *  2) публикует кнопку «Я человек» (нажать может только этот участник);
 *  3) при нажатии — ограничение снимается;
 *  4) если за CAPTCHA_TIMEOUT_SEC не нажал — участника кикают, сообщение удаляют.
 *
 * ⚠️ Бот должен быть админом группы с правами «ограничивать» и «банить».
 * Состояние ожидания хранится в памяти процесса (для одного инстанса).
 */
import { type Api, InlineKeyboard } from "grammy";
import type { ChatPermissions } from "grammy/types";
import { getLogger } from "../../core/logger.js";
import { createComposer, escapeHtml, fullName } from "../../platforms/telegram/index.js";

const log = getLogger("modules.captcha");

export const composer = createComposer();

export const CAPTCHA_TIMEOUT_SEC = 60; // секунд на прохождение

// "chat_id:user_id" → таймер кика
const pending = new Map<string, ReturnType<typeof setTimeout>>();

const MUTED: ChatPermissions = { can_send_messages: false };
const UNMUTED: ChatPermissions = {
  can_send_messages: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
};

const key = (chatId: number, userId: number) => `${chatId}:${userId}`;

async function kick(api: Api, chatId: number, userId: number, messageId: number): Promise<void> {
  if (!pending.has(key(chatId, userId))) return;
  try {
    await api.banChatMember(chatId, userId);
    await api.unbanChatMember(chatId, userId); // kick = ban+unban
    await api.deleteMessage(chatId, messageId);
  } catch (err) {
    log.warn("Captcha kick failed: %s", err);
  }
  pending.delete(key(chatId, userId));
}

composer.on("message:new_chat_members", async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    if (member.is_bot) continue;
    const chatId = ctx.chat.id;
    const userId = member.id;
    try {
      await ctx.api.restrictChatMember(chatId, userId, MUTED);
    } catch (err) {
      log.warn("Captcha restrict failed (бот не админ?): %s", err);
      continue;
    }

    const kb = new InlineKeyboard().text("✅ Я человек", `captcha:${chatId}:${userId}`);
    const sent = await ctx.reply(
      `👋 ${escapeHtml(fullName(member))}, подтвердите, что вы не бот, за ${CAPTCHA_TIMEOUT_SEC} сек.`,
      { reply_markup: kb },
    );
    const api = ctx.api;
    pending.set(
      key(chatId, userId),
      setTimeout(() => void kick(api, chatId, userId, sent.message_id), CAPTCHA_TIMEOUT_SEC * 1000),
    );
  }
});

composer.callbackQuery(/^captcha:/, async (ctx) => {
  const [, chatIdRaw, userIdRaw] = ctx.callbackQuery.data.split(":");
  const chatId = Number(chatIdRaw);
  const userId = Number(userIdRaw);

  if (ctx.from.id !== userId) {
    await ctx.answerCallbackQuery({ text: "Эта кнопка не для вас.", show_alert: true });
    return;
  }

  const timer = pending.get(key(chatId, userId));
  if (timer) clearTimeout(timer);
  pending.delete(key(chatId, userId));

  try {
    await ctx.api.restrictChatMember(chatId, userId, UNMUTED);
  } catch (err) {
    log.warn("Captcha unrestrict failed: %s", err);
  }

  await ctx.editMessageText("✅ Проверка пройдена, добро пожаловать!");
  await ctx.answerCallbackQuery();
});
