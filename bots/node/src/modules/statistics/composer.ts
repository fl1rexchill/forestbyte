/** Статистика: /stats и кнопка admin:stats (только админам), по всем платформам. */
import { settings } from "../../core/config.js";
import { createComposer, hasUser, type UserContext } from "../../platforms/telegram/index.js";
import { isAdmin } from "../admin/filters.js";
import { backKb } from "../admin/keyboards.js";
import { buildStatsText } from "./service.js";

export const composer = createComposer();

const loc = (ctx: UserContext): string => ctx.dbUser.languageCode || settings.defaultLocale;

const admin = composer.filter(hasUser).filter(isAdmin);

admin.command("stats", async (ctx) => {
  await ctx.reply(await buildStatsText(ctx.db, null, loc(ctx)));
});

admin.callbackQuery("admin:stats", async (ctx) => {
  const text = await buildStatsText(ctx.db, null, loc(ctx));
  await ctx.editMessageText(text, { reply_markup: backKb(loc(ctx)) });
  await ctx.answerCallbackQuery();
});
