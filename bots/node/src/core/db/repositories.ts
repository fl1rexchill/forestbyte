/**
 * Репозитории — весь доступ к данным через них (не пишем SQL в хендлерах).
 * Тот же набор методов, что в bots/python/core/database/repositories.py (camelCase).
 *
 * Отличие от Python: сессии/unit-of-work нет — каждый метод сразу пишет в БД.
 *
 * Использование:
 *   const users = new UserRepository(getDb());
 *   const [user, created] = await users.getOrCreate({ platform: "telegram", externalId: 123 });
 */
import { and, count, countDistinct, eq, gte } from "drizzle-orm";
import type { Db } from "./client.js";
import { type BroadcastJob, type User, utcnow } from "./schema.js";

export interface GetOrCreateUser {
  platform: string;
  externalId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
  isAdmin?: boolean;
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  private get t() {
    return this.db.tables.users;
  }

  async get(platform: string, externalId: number): Promise<User | null> {
    const t = this.t;
    const [user] = await this.db.orm
      .select()
      .from(t)
      .where(and(eq(t.platform, platform), eq(t.externalId, externalId)))
      .limit(1);
    return user ?? null;
  }

  /** Возвращает [user, created]. Обновляет профиль, если пользователь уже есть. */
  async getOrCreate(params: GetOrCreateUser): Promise<[User, boolean]> {
    const t = this.t;
    const existing = await this.get(params.platform, params.externalId);
    if (existing === null) {
      const [user] = await this.db.orm
        .insert(t)
        .values({
          platform: params.platform,
          externalId: params.externalId,
          username: params.username ?? null,
          firstName: params.firstName ?? null,
          lastName: params.lastName ?? null,
          languageCode: params.languageCode ?? null,
          isAdmin: params.isAdmin ?? false,
        })
        .returning();
      if (!user) throw new Error("UserRepository.getOrCreate: insert не вернул строку");
      return [user, true];
    }

    // Обновляем изменяемые поля профиля
    const [user] = await this.db.orm
      .update(t)
      .set({
        username: params.username ?? null,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        ...(params.languageCode ? { languageCode: params.languageCode } : {}),
        ...(params.isAdmin ? { isAdmin: true } : {}),
        lastSeenAt: utcnow(),
        isActive: true, // раз пишет — значит не заблокировал
      })
      .where(eq(t.id, existing.id))
      .returning();
    return [user ?? existing, false];
  }

  async setBanned(platform: string, externalId: number, banned: boolean): Promise<boolean> {
    const t = this.t;
    const rows = await this.db.orm
      .update(t)
      .set({ isBanned: banned })
      .where(and(eq(t.platform, platform), eq(t.externalId, externalId)))
      .returning({ id: t.id });
    return rows.length > 0;
  }

  /** Пометить, что пользователь заблокировал бота (для рассылок). */
  async markInactive(userId: number): Promise<void> {
    const t = this.t;
    await this.db.orm.update(t).set({ isActive: false }).where(eq(t.id, userId));
  }

  /** external_id всех активных, не забаненных — цель рассылки. */
  async allActiveIds(platform: string): Promise<number[]> {
    const t = this.t;
    const rows = await this.db.orm
      .select({ externalId: t.externalId })
      .from(t)
      .where(and(eq(t.platform, platform), eq(t.isActive, true), eq(t.isBanned, false)));
    return rows.map((row) => row.externalId);
  }

  async count(platform?: string | null): Promise<number> {
    const t = this.t;
    const [row] = await this.db.orm
      .select({ n: count() })
      .from(t)
      .where(platform ? eq(t.platform, platform) : undefined);
    return row?.n ?? 0;
  }

  /** Проставить пригласившего (только если ещё не задан и это не сам юзер). */
  async setReferrer(user: User, referrerExternalId: number): Promise<boolean> {
    if (user.referredBy !== null || user.externalId === referrerExternalId) return false;
    const t = this.t;
    await this.db.orm.update(t).set({ referredBy: referrerExternalId }).where(eq(t.id, user.id));
    user.referredBy = referrerExternalId;
    return true;
  }

  async countReferrals(platform: string, referrerExternalId: number): Promise<number> {
    const t = this.t;
    const [row] = await this.db.orm
      .select({ n: count() })
      .from(t)
      .where(and(eq(t.platform, platform), eq(t.referredBy, referrerExternalId)));
    return row?.n ?? 0;
  }
}

export interface LogMessage {
  userId: number;
  platform: string;
  text: string | null;
  contentType?: string;
}

export class MessageRepository {
  constructor(private readonly db: Db) {}

  async log({ userId, platform, text, contentType = "text" }: LogMessage): Promise<void> {
    await this.db.orm
      .insert(this.db.tables.messageLogs)
      .values({ userId, platform, text, contentType });
  }
}

export interface StatsSummary {
  total: number;
  newDay: number;
  newWeek: number;
  newMonth: number;
  activeDay: number;
  activeWeek: number;
  activeMonth: number;
  messagesDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Аналитические выборки для модуля statistics. */
export class StatsRepository {
  constructor(private readonly db: Db) {}

  async totalUsers(platform: string): Promise<number> {
    return new UserRepository(this.db).count(platform);
  }

  async newUsersSince(platform: string, since: Date): Promise<number> {
    const t = this.db.tables.users;
    const [row] = await this.db.orm
      .select({ n: count() })
      .from(t)
      .where(and(eq(t.platform, platform), gte(t.createdAt, since)));
    return row?.n ?? 0;
  }

  /** Уникальные пользователи, писавшие боту с момента `since`. */
  async activeUsersSince(platform: string, since: Date): Promise<number> {
    const t = this.db.tables.messageLogs;
    const [row] = await this.db.orm
      .select({ n: countDistinct(t.userId) })
      .from(t)
      .where(and(eq(t.platform, platform), gte(t.createdAt, since)));
    return row?.n ?? 0;
  }

  async messagesSince(platform: string, since: Date): Promise<number> {
    const t = this.db.tables.messageLogs;
    const [row] = await this.db.orm
      .select({ n: count() })
      .from(t)
      .where(and(eq(t.platform, platform), gte(t.createdAt, since)));
    return row?.n ?? 0;
  }

  /** Сводка: total / new & active за день, неделю, месяц. */
  async summary(platform: string): Promise<StatsSummary> {
    const now = Date.now();
    const day = new Date(now - DAY_MS);
    const week = new Date(now - 7 * DAY_MS);
    const month = new Date(now - 30 * DAY_MS);
    return {
      total: await this.totalUsers(platform),
      newDay: await this.newUsersSince(platform, day),
      newWeek: await this.newUsersSince(platform, week),
      newMonth: await this.newUsersSince(platform, month),
      activeDay: await this.activeUsersSince(platform, day),
      activeWeek: await this.activeUsersSince(platform, week),
      activeMonth: await this.activeUsersSince(platform, month),
      messagesDay: await this.messagesSince(platform, day),
    };
  }
}

export interface CreateBroadcast {
  createdBy: number;
  platform: string;
  text: string;
  total: number;
}

export class BroadcastRepository {
  constructor(private readonly db: Db) {}

  async create({ createdBy, platform, text, total }: CreateBroadcast): Promise<BroadcastJob> {
    const [job] = await this.db.orm
      .insert(this.db.tables.broadcastJobs)
      .values({ createdBy, platform, text, total, status: "running" })
      .returning();
    if (!job) throw new Error("BroadcastRepository.create: insert не вернул строку");
    return job;
  }

  async get(jobId: number): Promise<BroadcastJob | null> {
    const t = this.db.tables.broadcastJobs;
    const [job] = await this.db.orm.select().from(t).where(eq(t.id, jobId)).limit(1);
    return job ?? null;
  }

  async finish(jobId: number, sent: number, failed: number, status = "done"): Promise<void> {
    const t = this.db.tables.broadcastJobs;
    await this.db.orm
      .update(t)
      .set({ sent, failed, status, finishedAt: utcnow() })
      .where(eq(t.id, jobId));
  }
}

export class SettingRepository {
  constructor(private readonly db: Db) {}

  async get(key: string, defaultValue: string | null = null): Promise<string | null> {
    const t = this.db.tables.settings;
    const [row] = await this.db.orm.select().from(t).where(eq(t.key, key)).limit(1);
    return row ? row.value : defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    const t = this.db.tables.settings;
    await this.db.orm
      .insert(t)
      .values({ key, value })
      .onConflictDoUpdate({ target: t.key, set: { value, updatedAt: utcnow() } });
  }
}
