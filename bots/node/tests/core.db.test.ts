import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import {
  BroadcastRepository,
  fromSqliteDateTime,
  getDb,
  initDb,
  MessageRepository,
  Platform,
  parseDatabaseUrl,
  SettingRepository,
  StatsRepository,
  toSqliteDateTime,
  UserRepository,
  userFullName,
} from "../src/core/db/index.js";
import { resetDb } from "./helpers.js";

const TG = Platform.TELEGRAM;

describe("core/db: утилиты", () => {
  test("parseDatabaseUrl понимает форматы Node и Python", () => {
    expect(parseDatabaseUrl("sqlite+aiosqlite:///data/bot.sqlite3")).toEqual({
      dialect: "sqlite",
      path: "data/bot.sqlite3",
    });
    expect(parseDatabaseUrl("sqlite:///data/bot.sqlite3")).toEqual({
      dialect: "sqlite",
      path: "data/bot.sqlite3",
    });
    expect(parseDatabaseUrl("sqlite:////abs/x.db")).toEqual({
      dialect: "sqlite",
      path: "/abs/x.db",
    });
    expect(parseDatabaseUrl("sqlite:///:memory:")).toEqual({ dialect: "sqlite", path: ":memory:" });
    expect(parseDatabaseUrl("postgresql+asyncpg://u:p@h:5432/d")).toEqual({
      dialect: "pg",
      url: "postgres://u:p@h:5432/d",
    });
    expect(parseDatabaseUrl("postgres://u@h/d").dialect).toBe("pg");
    expect(() => parseDatabaseUrl("mysql://x")).toThrow(/неподдерживаемая/);
  });

  test("DATETIME в формате SQLAlchemy (UTC, микросекунды)", () => {
    const d = new Date(Date.UTC(2026, 8, 12, 17, 52, 5, 774));
    expect(toSqliteDateTime(d)).toBe("2026-09-12 17:52:05.774000");
    expect(fromSqliteDateTime("2026-09-12 17:52:05.774908").getTime()).toBe(d.getTime());
    expect(fromSqliteDateTime("2026-09-12 17:52:05").getTime()).toBe(
      Date.UTC(2026, 8, 12, 17, 52, 5),
    );
    // строки одного формата сравниваются как даты — на этом держатся выборки >= since
    expect(toSqliteDateTime(new Date(1)) < toSqliteDateTime(new Date(2))).toBe(true);
  });

  test("userFullName как User.full_name", () => {
    const base = { externalId: 5, username: null, firstName: null, lastName: null };
    expect(userFullName({ ...base, firstName: "Иван", lastName: "Петров" })).toBe("Иван Петров");
    expect(userFullName({ ...base, username: "nick" })).toBe("nick");
    expect(userFullName(base)).toBe("id5");
  });
});

describe("core/db: схема", () => {
  beforeEach(resetDb);

  test("initDb создаёт таблицы ядра и идемпотентен", async () => {
    await initDb();
    const rows = getDb().orm.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      "broadcast_jobs",
      "message_logs",
      "settings",
      "users",
    ]);
    const indexes = getDb().orm.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'index' and name like 'ix_%' order by name`,
    );
    expect(indexes.map((r) => r.name)).toEqual([
      "ix_message_logs_created_at",
      "ix_users_external_id",
      "ix_users_platform_external",
    ]);
  });

  test("даты пишутся строкой SQLAlchemy — Python прочитает ту же БД", async () => {
    await new UserRepository(getDb()).getOrCreate({ platform: TG, externalId: 1 });
    const [row] = getDb().orm.all<{ created_at: string; is_active: number }>(
      sql`select created_at, is_active from users`,
    );
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
    expect(row?.is_active).toBe(1);
  });
});

describe("core/db: репозитории", () => {
  beforeEach(resetDb);

  test("UserRepository.getOrCreate создаёт, затем обновляет профиль", async () => {
    const users = new UserRepository(getDb());
    const [u, created] = await users.getOrCreate({
      platform: TG,
      externalId: 1,
      username: "old",
      firstName: "A",
      languageCode: "ru",
    });
    expect(created).toBe(true);
    expect([u.isActive, u.isBanned, u.isAdmin]).toEqual([true, false, false]);
    expect(u.createdAt).toBeInstanceOf(Date);

    const [u2, created2] = await users.getOrCreate({
      platform: TG,
      externalId: 1,
      username: "new",
      firstName: "B",
      languageCode: null,
      isAdmin: true,
    });
    expect(created2).toBe(false);
    expect(u2.id).toBe(u.id);
    expect([u2.username, u2.firstName, u2.languageCode, u2.isAdmin]).toEqual([
      "new",
      "B",
      "ru",
      true,
    ]);
  });

  test("getOrCreate снова делает активным того, кто писал после блокировки", async () => {
    const users = new UserRepository(getDb());
    const [u] = await users.getOrCreate({ platform: TG, externalId: 5 });
    await users.markInactive(u.id);
    expect((await users.get(TG, 5))?.isActive).toBe(false);
    const [again] = await users.getOrCreate({ platform: TG, externalId: 5 });
    expect(again.isActive).toBe(true);
  });

  test("один external_id на разных платформах — разные пользователи", async () => {
    const users = new UserRepository(getDb());
    await users.getOrCreate({ platform: TG, externalId: 7 });
    const [, created] = await users.getOrCreate({ platform: Platform.MAX, externalId: 7 });
    expect(created).toBe(true);
    expect(await users.count()).toBe(2);
    expect(await users.count(TG)).toBe(1);
    expect(await users.get(TG, 999)).toBeNull();
  });

  test("setBanned / markInactive / allActiveIds", async () => {
    const users = new UserRepository(getDb());
    for (const id of [1, 2, 3]) await users.getOrCreate({ platform: TG, externalId: id });
    await users.getOrCreate({ platform: Platform.INSTAGRAM, externalId: 4 });

    expect(await users.setBanned(TG, 2, true)).toBe(true);
    expect(await users.setBanned(TG, 999, true)).toBe(false);
    const u3 = await users.get(TG, 3);
    await users.markInactive(u3?.id ?? -1);

    expect((await users.allActiveIds(TG)).sort()).toEqual([1]);
  });

  test("рефералы", async () => {
    const users = new UserRepository(getDb());
    const [inviter] = await users.getOrCreate({ platform: TG, externalId: 10 });
    const [guest] = await users.getOrCreate({ platform: TG, externalId: 11 });

    expect(await users.setReferrer(inviter, 10)).toBe(false); // сам себя
    expect(await users.setReferrer(guest, 10)).toBe(true);
    expect(await users.setReferrer(guest, 12)).toBe(false); // уже задан
    expect(await users.countReferrals(TG, 10)).toBe(1);
    expect(await users.countReferrals(TG, 12)).toBe(0);
    expect((await users.get(TG, 11))?.referredBy).toBe(10);
  });

  test("MessageRepository + StatsRepository.summary", async () => {
    const db = getDb();
    const users = new UserRepository(db);
    const [a] = await users.getOrCreate({ platform: TG, externalId: 1 });
    const [b] = await users.getOrCreate({ platform: TG, externalId: 2 });
    const [old] = await users.getOrCreate({ platform: TG, externalId: 3 });
    const longAgo = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    await db.orm
      .update(db.tables.users)
      .set({ createdAt: longAgo })
      .where(sql`${db.tables.users.id} = ${old.id}`);

    const msgs = new MessageRepository(db);
    await msgs.log({ userId: a.id, platform: TG, text: "hi" });
    await msgs.log({ userId: a.id, platform: TG, text: null, contentType: "photo" });
    await msgs.log({ userId: b.id, platform: TG, text: "yo" });
    await db.orm
      .insert(db.tables.messageLogs)
      .values({ userId: old.id, platform: TG, text: "old", createdAt: longAgo });

    expect(await new StatsRepository(db).summary(TG)).toEqual({
      total: 3,
      newDay: 2,
      newWeek: 2,
      newMonth: 2,
      activeDay: 2,
      activeWeek: 2,
      activeMonth: 2,
      messagesDay: 3,
    });
    expect((await new StatsRepository(db).summary(Platform.MAX)).total).toBe(0);
  });

  test("BroadcastRepository", async () => {
    const repo = new BroadcastRepository(getDb());
    const job = await repo.create({ createdBy: 111, platform: TG, text: "hello", total: 5 });
    expect(job.status).toBe("running");
    expect([job.sent, job.failed]).toEqual([0, 0]);

    await repo.finish(job.id, 4, 1);
    const done = await repo.get(job.id);
    expect([done?.sent, done?.failed, done?.status]).toEqual([4, 1, "done"]);
    expect(done?.finishedAt).toBeInstanceOf(Date);
    expect(await repo.get(999)).toBeNull();
  });

  test("SettingRepository get/set (upsert)", async () => {
    const repo = new SettingRepository(getDb());
    expect(await repo.get("welcome")).toBeNull();
    expect(await repo.get("welcome", "default")).toBe("default");
    await repo.set("welcome", "hi");
    expect(await repo.get("welcome")).toBe("hi");
    await repo.set("welcome", "hello");
    expect(await repo.get("welcome")).toBe("hello");
  });
});
