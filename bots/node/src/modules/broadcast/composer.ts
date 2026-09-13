/** Рассылка: диалог ввода текста, подтверждение, запуск (только админам). */
import { settings } from "../../core/config.js";
import { Platform, UserRepository } from "../../core/db/index.js";
import { t } from "../../core/i18n.js";
import {
  clearState,
  createComposer,
  getData,
  hasUser,
  inState,
  inStateText,
  messageHtml,
  setState,
  type UserContext,
  updateData,
} from "../../platforms/telegram/index.js";
import { isAdmin } from "../admin/filters.js";
import { broadcastConfirmKb } from "../admin/keyboards.js";
import { runBroadcast } from "./service.js";
import { BroadcastStates } from "./states.js";

export const composer = createComposer();

const loc = (ctx: UserContext): string => ctx.dbUser.languageCode || settings.defaultLocale;

const admin = composer.filter(hasUser).filter(isAdmin);

admin.command("broadcast", async (ctx) => {
  setState(ctx, BroadcastStates.waitingText);
  await ctx.reply(t("broadcast.ask_text", loc(ctx)));
});

admin.callbackQuery("admin:broadcast", async (ctx) => {
  setState(ctx, BroadcastStates.waitingText);
  await ctx.reply(t("broadcast.ask_text", loc(ctx)));
  await ctx.answerCallbackQuery();
});

// Команды (/cancel и т.п.) не считаем текстом рассылки — их обработают другие модули
admin.on("message:text").filter(inStateText(BroadcastStates.waitingText), async (ctx) => {
  // HTML: форматирование сохраняется, спецсимволы экранированы (parse_mode=HTML)
  const text = messageHtml(ctx.message.text, ctx.message.entities);
  updateData(ctx, { text });
  setState(ctx, BroadcastStates.waitingConfirm);

  // Рассылка идёт через Telegram-бота — получатели только из Telegram
  const count = (await new UserRepository(ctx.db).allActiveIds(Platform.TELEGRAM)).length;
  const preview = `${t("broadcast.confirm", loc(ctx), { count })}\n\n<b>Превью:</b>\n${text}`;
  await ctx.reply(preview, { reply_markup: broadcastConfirmKb() });
});

admin
  .callbackQuery("admin:bc_send")
  .filter(inState(BroadcastStates.waitingConfirm), async (ctx) => {
    const data = getData(ctx);
    const text = typeof data.text === "string" ? data.text : "";
    clearState(ctx);

    await ctx.editMessageText(t("broadcast.started", loc(ctx)));
    await ctx.answerCallbackQuery();

    const [sent, failed] = await runBroadcast(ctx.api, { adminId: ctx.from.id, text });
    await ctx.reply(t("broadcast.done", loc(ctx), { sent, failed }));
  });
