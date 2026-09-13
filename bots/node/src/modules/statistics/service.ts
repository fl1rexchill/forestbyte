/**
 * Формирование текста статистики. Отделено от хендлеров для переиспользования.
 *
 * По умолчанию считает все платформы (telegram/instagram/max) и, если активных платформ
 * больше одной, добавляет разбивку. platform=... — статистика одной платформы.
 */
import { type Db, Platform, StatsRepository, type StatsSummary } from "../../core/db/index.js";
import { t } from "../../core/i18n.js";

function render(data: StatsSummary, locale: string): string {
  return (
    `${t("stats.title", locale)}\n\n` +
    `👥 Всего пользователей: <b>${data.total}</b>\n\n` +
    "🆕 <b>Новые:</b>\n" +
    `  • за день: ${data.newDay}\n` +
    `  • за неделю: ${data.newWeek}\n` +
    `  • за месяц: ${data.newMonth}\n\n` +
    "⚡️ <b>Активные:</b>\n" +
    `  • за день (DAU): ${data.activeDay}\n` +
    `  • за неделю (WAU): ${data.activeWeek}\n` +
    `  • за месяц (MAU): ${data.activeMonth}\n\n` +
    `💬 Сообщений за сутки: <b>${data.messagesDay}</b>`
  );
}

export async function buildStatsText(
  db: Db,
  platform: string | null = null,
  locale = "ru",
): Promise<string> {
  const repo = new StatsRepository(db);
  if (platform !== null) return render(await repo.summary(platform), locale);

  // Пользователь привязан к одной платформе, поэтому суммы по платформам —
  // это число разных пользователей
  const perPlatform: [string, StatsSummary][] = [];
  for (const p of Object.values(Platform)) perPlatform.push([p, await repo.summary(p)]);
  const total: StatsSummary = {
    total: 0,
    newDay: 0,
    newWeek: 0,
    newMonth: 0,
    activeDay: 0,
    activeWeek: 0,
    activeMonth: 0,
    messagesDay: 0,
  };
  for (const [, summary] of perPlatform) {
    for (const key of Object.keys(total) as (keyof StatsSummary)[]) total[key] += summary[key];
  }

  let text = render(total, locale);
  const used = perPlatform.filter(([, summary]) => summary.total > 0);
  if (used.length > 1) {
    const lines = used
      .map(([name, s]) => `  • ${name}: всего ${s.total}, DAU ${s.activeDay}`)
      .join("\n");
    text += `\n\n🌐 <b>По платформам:</b>\n${lines}`;
  }
  return text;
}
