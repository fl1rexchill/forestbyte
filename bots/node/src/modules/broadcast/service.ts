/**
 * Сервис рассылки: отправляет текст всем активным пользователям.
 *
 * - соблюдает лимит скорости (settings.broadcastRate сообщений/сек);
 * - корректно обрабатывает 429 (flood control) и 403/400 (бот заблокирован / чат не найден);
 * - заблокировавших помечает isActive=false, чтобы не слать им впредь;
 * - фиксирует результат в BroadcastJob (итог — одной транзакцией).
 */
import { GrammyError } from "grammy";
import { settings } from "../../core/config.js";
import {
  BroadcastRepository,
  getDb,
  Platform,
  transaction,
  UserRepository,
} from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";

const log = getLogger("modules.broadcast");

/** Всё, что нужно сервису от Bot API (ctx.api / bot.api подходят). */
export interface BroadcastApi {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}

export interface BroadcastParams {
  adminId: number;
  text: string;
  platform?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Выполнить рассылку. Возвращает [sent, failed]. */
export async function runBroadcast(
  api: BroadcastApi,
  { adminId, text, platform = Platform.TELEGRAM }: BroadcastParams,
): Promise<[number, number]> {
  const db = getDb();

  // 1. Собираем получателей и создаём job
  const recipientIds = await new UserRepository(db).allActiveIds(platform);
  const job = await new BroadcastRepository(db).create({
    createdBy: adminId,
    platform,
    text,
    total: recipientIds.length,
  });

  let sent = 0;
  let failed = 0;
  const blockedExternalIds: number[] = [];
  const delayMs = 1000 / Math.max(1, settings.broadcastRate);

  // 2. Отправляем (вне транзакции — это сетевые вызовы)
  for (const externalId of recipientIds) {
    try {
      await api.sendMessage(externalId, text);
      sent += 1;
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 429) {
        // Flood control — ждём и повторяем этого получателя
        const retryAfter = err.parameters.retry_after ?? 1;
        log.warn("Flood control, sleeping %s s", retryAfter);
        await sleep(retryAfter * 1000);
        try {
          await api.sendMessage(externalId, text);
          sent += 1;
        } catch {
          failed += 1;
        }
      } else if (err instanceof GrammyError && (err.error_code === 403 || err.error_code === 400)) {
        // 403 — пользователь заблокировал бота; 400 — чат не найден / удалён
        failed += 1;
        blockedExternalIds.push(externalId);
      } else {
        failed += 1;
        log.error("Broadcast send error to %s: %s", externalId, err);
      }
    }
    await sleep(delayMs);
  }

  // 3. Помечаем заблокировавших неактивными и закрываем job — атомарно
  await transaction(db, async (tx) => {
    const users = new UserRepository(tx);
    for (const externalId of blockedExternalIds) {
      const user = await users.get(platform, externalId);
      if (user) await users.markInactive(user.id);
    }
    await new BroadcastRepository(tx).finish(job.id, sent, failed);
  });

  log.info("Broadcast #%s done: sent=%s failed=%s", job.id, sent, failed);
  return [sent, failed];
}
