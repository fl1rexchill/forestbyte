/** Фильтр доступа админа. Используется в модулях admin/statistics/broadcast/... */
import { settings } from "../../core/config.js";
import type { BotContext } from "../../platforms/telegram/index.js";

/** Пропускает только пользователей из ADMIN_IDS (как IsAdmin в Python). */
export function isAdmin(ctx: BotContext): boolean {
  return ctx.from !== undefined && settings.isAdmin(ctx.from.id);
}
