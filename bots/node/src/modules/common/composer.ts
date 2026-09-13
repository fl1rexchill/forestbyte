/** Базовые хендлеры: /start, /help, /cancel, эхо (зеркало bots/python/modules/common/router.py). */
import { settings } from "../../core/config.js";
import { t } from "../../core/i18n.js";
import {
  clearState,
  createComposer,
  escapeHtml,
  hasUser,
  messageHtml,
  type UserContext,
} from "../../platforms/telegram/index.js";

export const composer = createComposer();

// ctx.db и ctx.dbUser даёт usersMiddleware; без него модуль пропускает апдейты дальше
const withUser = composer.filter(hasUser);

const locale = (ctx: UserContext): string => ctx.dbUser.languageCode || settings.defaultLocale;

withUser.command("start", async (ctx) => {
  await ctx.reply(
    t("start.hello", locale(ctx), { name: escapeHtml(ctx.dbUser.firstName || "друг") }),
  );
});

withUser.command("help", async (ctx) => {
  await ctx.reply(t("help.text", locale(ctx)));
});

withUser.command("cancel", async (ctx) => {
  if (ctx.session.state !== undefined) clearState(ctx);
  await ctx.reply(t("common.cancelled", locale(ctx)));
});

// Эхо — ловит всё, что не поймали другие модули. Подключай последним.
withUser.on("message:text", async (ctx) => {
  // HTML: форматирование сохраняется, спецсимволы экранированы (parse_mode=HTML)
  await ctx.reply(messageHtml(ctx.message.text, ctx.message.entities));
});
