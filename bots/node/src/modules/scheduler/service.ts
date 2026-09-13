/**
 * Фоновый цикл планировщика: раз в N секунд шлёт наступившие задачи.
 *
 * Регистрируется на старте бота через setup(bot) (хуки onStartup/onShutdown платформы).
 * Задачи забираются атомарно (claimDuePosts), поэтому два процесса бота не отправят
 * одну задачу дважды.
 */
import { and, eq, lte } from "drizzle-orm";
import type { Bot } from "grammy";
import { type Db, getDb, Platform, UserRepository } from "../../core/db/index.js";
import { getLogger } from "../../core/logger.js";
import { type BotContext, onShutdown, onStartup } from "../../platforms/telegram/index.js";
import { type ScheduledPost, tablesFor } from "./models.js";

const log = getLogger("modules.scheduler");

export const CHECK_INTERVAL_MS = 30_000;

/** Всё, что нужно планировщику от Bot API (ctx.api / bot.api подходят). */
export interface SchedulerApi {
  sendMessage(chatId: number, text: string): Promise<unknown>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Отправить одну задачу по её target. */
export async function deliver(
  api: SchedulerApi,
  post: ScheduledPost,
  db: Db = getDb(),
): Promise<void> {
  if (post.target === "all") {
    const ids = await new UserRepository(db).allActiveIds(Platform.TELEGRAM);
    for (const id of ids) {
      try {
        await api.sendMessage(id, post.text);
      } catch {
        // заблокировавших пропускаем
      }
      await sleep(40);
    }
  } else {
    try {
      await api.sendMessage(Number(post.target), post.text);
    } catch (err) {
      log.error("Scheduled post %s delivery failed: %s", post.id, err);
    }
  }
}

/**
 * Атомарно забрать наступившие задачи: pending → done одним UPDATE ... RETURNING.
 * Строку меняет только один UPDATE, поэтому при нескольких процессах каждая задача
 * достаётся ровно одному из них. Помечаем до отправки, чтобы не дублировать.
 */
export async function claimDuePosts(db: Db = getDb()): Promise<ScheduledPost[]> {
  const t = tablesFor(db);
  return db.orm
    .update(t.posts)
    .set({ status: "done" })
    .where(and(eq(t.posts.status, "pending"), lte(t.posts.runAt, new Date())))
    .returning();
}

/** Одна итерация: забрать наступившие задачи и отправить. Возвращает их число. */
export async function processDuePosts(api: SchedulerApi, db: Db = getDb()): Promise<number> {
  const due = await claimDuePosts(db);
  for (const post of due) {
    await deliver(api, post, db);
    log.info("Scheduled post %s delivered", post.id);
  }
  return due.length;
}

/** Запустить бесконечный цикл проверки. Возвращает функцию остановки. */
export function startScheduler(api: SchedulerApi, intervalMs = CHECK_INTERVAL_MS): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const loop = async (): Promise<void> => {
    if (stopped) return;
    try {
      await processDuePosts(api);
    } catch (err) {
      log.error("Scheduler loop error: %s", err);
    }
    if (!stopped) timer = setTimeout(() => void loop(), intervalMs);
  };

  log.info("Scheduler loop started (interval=%ss)", intervalMs / 1000);
  void loop();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    log.info("Scheduler loop cancelled");
  };
}

/** Подключить планировщик к жизненному циклу бота. */
export function setup(bot: Bot<BotContext>): void {
  let stop: (() => void) | undefined;
  onStartup(bot, (b) => {
    stop = startScheduler(b.api);
  });
  onShutdown(bot, () => {
    stop?.();
  });
}
