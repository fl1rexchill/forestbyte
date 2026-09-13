/**
 * Админ-панель: вход /admin, навигация, раздел «Пользователи», /ban /unban.
 *
 * Разделы «Статистика» и «Рассылка» обрабатываются своими модулями
 * (statistics / broadcast) через callback_data admin:stats и admin:broadcast —
 * так модули остаются независимыми.
 */
import type { CommandContext } from "grammy";
import { settings } from "../../core/config.js";
import { Platform, UserRepository } from "../../core/db/index.js";
import { t } from "../../core/i18n.js";
import { createComposer, hasUser, type UserContext } from "../../platforms/telegram/index.js";
import { isAdmin } from "./filters.js";
import { adminPanelKb, backKb } from "./keyboards.js";

export const composer = createComposer();

const PLATFORMS: string[] = Object.values(Platform);

const loc = (ctx: UserContext): string => ctx.dbUser.languageCode || settings.defaultLocale;

// Весь модуль доступен только админам; сообщения — только в личке
// (в группах команду /ban обрабатывает модуль moderation)
const admin = composer.filter(hasUser).filter(isAdmin);
const adminPrivate = admin.chatType("private");

adminPrivate.command("admin", async (ctx) => {
  await ctx.reply(t("admin.panel", loc(ctx)), { reply_markup: adminPanelKb(loc(ctx)) });
});

admin.callbackQuery("admin:home", async (ctx) => {
  await ctx.editMessageText(t("admin.panel", loc(ctx)), { reply_markup: adminPanelKb(loc(ctx)) });
  await ctx.answerCallbackQuery();
});

admin.callbackQuery("admin:users", async (ctx) => {
  const users = new UserRepository(ctx.db);
  // Пользователи всех платформ из общей БД; рассылка — только в Telegram
  const counts: [string, number][] = [];
  for (const platform of PLATFORMS) counts.push([platform, await users.count(platform)]);
  const used = counts.filter(([, n]) => n > 0);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  const breakdown = used.length > 1 ? ` (${used.map(([p, n]) => `${p}: ${n}`).join(", ")})` : "";
  const activeIds = await users.allActiveIds(Platform.TELEGRAM);
  const text =
    "👥 <b>Пользователи</b>\n\n" +
    `Всего: <b>${total}</b>${breakdown}\n` +
    `Активных в Telegram (не заблокировали бота): <b>${activeIds.length}</b>\n\n` +
    "Бан/разбан: <code>/ban &lt;id&gt; [платформа]</code> · " +
    "<code>/unban &lt;id&gt; [платформа]</code>";
  await ctx.editMessageText(text, { reply_markup: backKb(loc(ctx)) });
  await ctx.answerCallbackQuery();
});

/** /ban <user_id> [telegram|instagram|max] — по умолчанию telegram. */
async function setBan(ctx: CommandContext<UserContext>, banned: boolean): Promise<void> {
  const [arg = "", platformArg] = ctx.match.trim().split(/\s+/);
  if (!/^-?\d+$/.test(arg)) {
    await ctx.reply("Использование: /ban &lt;user_id&gt; [telegram|instagram|max]");
    return;
  }
  const platform = (platformArg ?? Platform.TELEGRAM).toLowerCase();
  if (!PLATFORMS.includes(platform)) {
    await ctx.reply("Платформа: telegram, instagram или max.");
    return;
  }
  const target = Number(arg);
  const ok = await new UserRepository(ctx.db).setBanned(platform, target, banned);
  const where = platform === Platform.TELEGRAM ? "" : ` (${platform})`;
  if (ok) {
    await ctx.reply(`${banned ? "🚫 Забанен" : "✅ Разбанен"}: <code>${target}</code>${where}`);
  } else {
    await ctx.reply(`Пользователь <code>${target}</code>${where} не найден.`);
  }
}

adminPrivate.command("ban", (ctx) => setBan(ctx, true));
adminPrivate.command("unban", (ctx) => setBan(ctx, false));
