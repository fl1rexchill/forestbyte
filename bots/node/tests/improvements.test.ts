/** Доработки 6–9, 20, 26: транзакции, ключ сессии, hasUser, платформы, scheduler, логгер. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Update } from "grammy/types";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb, Platform, transaction, UserRepository } from "../src/core/db/index.js";
import { RotatingFileStream } from "../src/core/logger.js";
import { composer as commonComposer } from "../src/modules/common/index.js";
import { claimDuePosts, schedulerTables } from "../src/modules/scheduler/index.js";
import { createBot, sessionKey } from "../src/platforms/telegram/index.js";
import { build as buildFull } from "../src/templates/telegram_full/main.js";
import {
  attachFakeApi,
  callbackUpdate,
  messageUpdate,
  resetDb,
  sentTexts,
  user,
} from "./helpers.js";

const admin = user(111, "Админ");

describe("transaction() (пункт 7)", () => {
  beforeEach(resetDb);

  test("фиксирует все записи", async () => {
    const db = getDb();
    await transaction(db, async (tx) => {
      const users = new UserRepository(tx);
      await users.getOrCreate({ platform: Platform.TELEGRAM, externalId: 1 });
      await users.getOrCreate({ platform: Platform.TELEGRAM, externalId: 2 });
    });
    expect(await new UserRepository(db).count()).toBe(2);
  });

  test("откатывает всё при ошибке", async () => {
    const db = getDb();
    await expect(
      transaction(db, async (tx) => {
        await new UserRepository(tx).getOrCreate({ platform: Platform.TELEGRAM, externalId: 1 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await new UserRepository(db).count()).toBe(0);
    // после отката соединение снова пригодно для транзакций
    await transaction(db, (tx) =>
      new UserRepository(tx).getOrCreate({ platform: Platform.TELEGRAM, externalId: 3 }),
    );
    expect(await new UserRepository(db).count()).toBe(1);
  });

  test("SQLite-транзакции выполняются по очереди", async () => {
    const db = getDb();
    const order: string[] = [];
    await Promise.all([
      transaction(db, async () => {
        order.push("a1");
        await new Promise((resolve) => setTimeout(resolve, 10));
        order.push("a2");
      }),
      transaction(db, async () => {
        order.push("b1");
        order.push("b2");
      }),
    ]);
    expect(order).toEqual(["a1", "a2", "b1", "b2"]);
  });
});

describe("ключ сессии (пункт 9)", () => {
  test("чат:пользователь, без чата — пользователь", () => {
    expect(sessionKey({ chat: { id: 5 }, from: { id: 7 } } as never)).toBe("5:7");
    expect(sessionKey({ from: { id: 7 } } as never)).toBe("7:7");
    expect(sessionKey({} as never)).toBeUndefined();
  });

  test("нажатие inline-кнопки без chat не ломает сессию", async () => {
    await resetDb();
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    const inlineCallback = {
      update_id: 900001,
      callback_query: {
        id: "q1",
        from: user(5001, "Иван"),
        chat_instance: "ci",
        inline_message_id: "im1",
        data: "shop:add:1",
      },
    } as Update;
    await bot.handleUpdate(inlineCallback);
    const answer = calls.find((c) => c.method === "answerCallbackQuery");
    expect(answer?.payload.text).toBe("Добавлено в корзину ✅");
  });
});

describe("hasUser (пункт 8)", () => {
  test("без usersMiddleware модуль пропускает апдейт, а не падает", async () => {
    await resetDb();
    const bot = createBot("123:TEST");
    const calls = attachFakeApi(bot);
    bot.use(commonComposer);
    await bot.handleUpdate(messageUpdate(user(1, "A"), "/start"));
    expect(calls).toEqual([]);
  });
});

describe("статистика и админка по платформам (пункт 20)", () => {
  beforeEach(resetDb);

  test("/stats и «Пользователи» с разбивкой, /ban с платформой", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/start"));
    await new UserRepository(getDb()).getOrCreate({ platform: Platform.MAX, externalId: 77 });

    await bot.handleUpdate(messageUpdate(admin, "/stats"));
    expect(sentTexts(calls).at(-1)).toContain("👥 Всего пользователей: <b>2</b>");
    expect(sentTexts(calls).at(-1)).toContain("🌐 <b>По платформам:</b>");
    expect(sentTexts(calls).at(-1)).toContain("• max: всего 1, DAU 0");

    await bot.handleUpdate(callbackUpdate(admin, "admin:users"));
    expect(sentTexts(calls).at(-1)).toContain("Всего: <b>2</b> (telegram: 1, max: 1)");

    await bot.handleUpdate(messageUpdate(admin, "/ban 77 max"));
    expect(sentTexts(calls).at(-1)).toBe("🚫 Забанен: <code>77</code> (max)");
    await bot.handleUpdate(messageUpdate(admin, "/ban 77 vk"));
    expect(sentTexts(calls).at(-1)).toBe("Платформа: telegram, instagram или max.");
    expect((await new UserRepository(getDb()).get(Platform.MAX, 77))?.isBanned).toBe(true);
  });
});

describe("scheduler (пункт 6)", () => {
  beforeEach(resetDb);

  test("наступившую задачу забирает ровно один вызов", async () => {
    const db = getDb();
    const t = schedulerTables(db);
    const past = new Date(Date.now() - 60_000);
    await db.orm.insert(t.posts).values([
      { createdBy: 1, text: "p0", runAt: past },
      { createdBy: 1, text: "p1", runAt: past },
      { createdBy: 1, text: "later", runAt: new Date(Date.now() + 3_600_000) },
    ]);
    const [a, b] = await Promise.all([claimDuePosts(db), claimDuePosts(db)]);
    expect([...a, ...b].map((p) => p.text).sort()).toEqual(["p0", "p1"]);
    expect([...a, ...b].every((p) => p.status === "done")).toBe(true);
    expect(await claimDuePosts(db)).toEqual([]);
  });
});

describe("логгер (пункт 26)", () => {
  test("асинхронная запись с ротацией по размеру", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devbase-log-"));
    const file = path.join(dir, "bot.log");
    const sink = new RotatingFileStream(file, 100, 2);
    for (let i = 0; i < 10; i++) sink.write(`${"x".repeat(40)} ${i}\n`);
    await sink.close();
    await new Promise((resolve) => setTimeout(resolve, 50)); // старые потоки дописывают буфер

    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.existsSync(`${file}.2`)).toBe(true);
    expect(fs.existsSync(`${file}.3`)).toBe(false);
    expect(fs.readFileSync(file, "utf8")).toContain("x 9\n");
    expect(fs.readFileSync(`${file}.1`, "utf8")).toContain("x 7\n");
    fs.rmSync(dir, { recursive: true });
  });
});
