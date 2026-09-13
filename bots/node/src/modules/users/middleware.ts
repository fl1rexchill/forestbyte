/**
 * usersMiddleware — регистрирует/обновляет пользователя на каждом апдейте
 * (зеркало bots/python/modules/users/middleware.py).
 *
 * - get_or_create пользователя, обновляет профиль и last_seen;
 * - логирует входящее сообщение (для статистики);
 * - блокирует забаненных;
 * - прокидывает в хендлер `ctx.db` и `ctx.dbUser`.
 */
import type { MiddlewareFn } from "grammy";
import type { Message } from "grammy/types";
import { settings } from "../../core/config.js";
import { getDb, MessageRepository, Platform, UserRepository } from "../../core/db/index.js";
import { t } from "../../core/i18n.js";
import type { BotContext } from "../../platforms/telegram/index.js";

/** Поля сообщения в порядке проверки — как Message.content_type в aiogram. */
const CONTENT_TYPES = [
  "text",
  "animation",
  "audio",
  "document",
  "game",
  "photo",
  "sticker",
  "story",
  "video",
  "video_note",
  "voice",
  "contact",
  "venue",
  "location",
  "poll",
  "dice",
  "new_chat_members",
  "left_chat_member",
  "invoice",
  "successful_payment",
  "pinned_message",
] as const;

/** Тип содержимого сообщения ("text", "photo", ...), как в aiogram. */
export function contentTypeOf(message: Message): string {
  for (const key of CONTENT_TYPES) {
    if (key in message) return key;
  }
  return "unknown";
}

export function usersMiddleware(platform: string = Platform.TELEGRAM): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();

    const db = getDb();
    const [dbUser] = await new UserRepository(db).getOrCreate({
      platform,
      externalId: from.id,
      username: from.username ?? null,
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null,
      isAdmin: settings.isAdmin(from.id),
    });

    // Забаненным — стоп (кроме админов)
    if (dbUser.isBanned && !settings.isAdmin(from.id)) {
      const text = t("common.banned", dbUser.languageCode || settings.defaultLocale);
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text, show_alert: true });
      } else if (ctx.message) {
        await ctx.reply(text);
      }
      return;
    }

    // Лог сообщения для статистики
    const message = ctx.message;
    if (message) {
      await new MessageRepository(db).log({
        userId: dbUser.id,
        platform,
        text: message.text ?? message.caption ?? null,
        contentType: contentTypeOf(message),
      });
    }

    ctx.db = db;
    ctx.dbUser = dbUser;
    await next();
  };
}
