/**
 * Реферальная система.
 *
 * - /start <inviter_id>  → фиксируем пригласившего для НОВОГО пользователя, уведомляем его;
 * - /ref                → показываем пользователю его ссылку и статистику.
 *
 * Важно: подключается ДО common, чтобы ловить /start с payload.
 * Обычный /start (без payload) пропускается дальше — его обрабатывает common.
 * Приглашённые считаются в платформе пользователя (ctx.dbUser.platform).
 */
import { settings } from "../../core/config.js";
import { UserRepository, userFullName } from "../../core/db/index.js";
import { t } from "../../core/i18n.js";
import {
  createComposer,
  escapeHtml,
  hasUser,
  type UserContext,
} from "../../platforms/telegram/index.js";

export const composer = createComposer();

const withUser = composer.filter(hasUser);

const loc = (ctx: UserContext): string => ctx.dbUser.languageCode || settings.defaultLocale;

withUser.command("start", async (ctx, next) => {
  const payload = ctx.match.trim();
  if (!payload) return next(); // без deep-link — это для common

  const users = new UserRepository(ctx.db);
  // payload должен быть числовым external_id пригласившего
  if (/^-?\d+$/.test(payload)) {
    const inviterId = Number(payload);
    if (await users.setReferrer(ctx.dbUser, inviterId)) {
      // Уведомляем пригласившего (не критично, если не дойдёт)
      try {
        const total = await users.countReferrals(ctx.dbUser.platform, inviterId);
        await ctx.api.sendMessage(
          inviterId,
          `🎉 По вашей ссылке присоединился ${escapeHtml(userFullName(ctx.dbUser))}!\n` +
            `Всего приглашено: <b>${total}</b>`,
        );
      } catch {
        // пригласивший мог заблокировать бота
      }
    }
  }

  await ctx.reply(t("start.hello", loc(ctx), { name: escapeHtml(ctx.dbUser.firstName || "друг") }));
});

withUser.command(["ref", "referral"], async (ctx) => {
  const link = `https://t.me/${ctx.me.username}?start=${ctx.dbUser.externalId}`;
  const count = await new UserRepository(ctx.db).countReferrals(
    ctx.dbUser.platform,
    ctx.dbUser.externalId,
  );
  await ctx.reply(
    `🔗 <b>Ваша реферальная ссылка:</b>\n<code>${link}</code>\n\n` +
      `👥 Приглашено: <b>${count}</b>\n\n` +
      "Делитесь ссылкой — приглашённые засчитаются автоматически.",
  );
});
