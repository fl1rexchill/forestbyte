/**
 * Смоук-тест Node-стека (аналог bots/python/tests/smoke_test.py): все модули импортируются,
 * шаблоны собираются, initDb создаёт все таблицы, ключевые сценарии модулей проходят
 * через bot.handleUpdate с подменённым Telegram API — без сети и токенов.
 */
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getDb, Platform, UserRepository } from "../src/core/db/index.js";
import { runBroadcast } from "../src/modules/broadcast/index.js";
import { paymentsTables } from "../src/modules/payments/index.js";
import { processDuePosts, schedulerTables } from "../src/modules/scheduler/index.js";
import { shopTables } from "../src/modules/shop/index.js";
import { supportTables } from "../src/modules/support/index.js";
import { build as buildFull } from "../src/templates/telegram_full/main.js";
import { build as buildGroup } from "../src/templates/telegram_group/main.js";
import { build as buildStarter } from "../src/templates/telegram_starter/main.js";
import {
  attachFakeApi,
  callbackUpdate,
  groupChat,
  messageUpdate,
  preCheckoutUpdate,
  rawMessageUpdate,
  resetDb,
  sentTexts,
  user,
} from "./helpers.js";

const admin = user(111, "Админ");
const ivan = user(5001, "Иван", { username: "ivan", language_code: "ru" });
const john = user(5002, "John", { language_code: "en" });

beforeEach(resetDb);

describe("сборка", () => {
  test("шаблоны собираются, initDb создаёт все 11 таблиц", async () => {
    buildStarter();
    buildFull();
    buildGroup();
    const rows = getDb().orm.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      "broadcast_jobs",
      "message_logs",
      "payments",
      "scheduled_posts",
      "settings",
      "shop_order_items",
      "shop_orders",
      "shop_products",
      "support_messages",
      "support_tickets",
      "users",
    ]);
  });
});

describe("telegram_full", () => {
  test("/start, эхо, бан — users + common", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "/start"));
    await bot.handleUpdate(messageUpdate(john, "/help"));
    await bot.handleUpdate(messageUpdate(ivan, "привет"));
    expect(sentTexts(calls)).toEqual([
      "👋 Привет, Иван! Я бот. Напиши /help, чтобы узнать возможности.",
      "📖 Commands:\n/start — begin\n/help — help",
      "привет",
    ]);

    await new UserRepository(getDb()).setBanned(Platform.TELEGRAM, john.id, true);
    calls.length = 0;
    await bot.handleUpdate(messageUpdate(john, "hello"));
    expect(sentTexts(calls)).toEqual(["🚫 You are banned."]);
  });

  test("referral: /start <id> фиксирует пригласившего и уведомляет его", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/start"));
    await bot.handleUpdate(messageUpdate(ivan, `/start ${admin.id}`));
    const users = new UserRepository(getDb());
    expect((await users.get(Platform.TELEGRAM, ivan.id))?.referredBy).toBe(admin.id);
    const notice = calls.find((c) =>
      String(c.payload.text).includes("По вашей ссылке присоединился Иван"),
    );
    expect(notice?.payload.chat_id).toBe(admin.id);
    expect(String(notice?.payload.text)).toContain("Всего приглашено: <b>1</b>");

    calls.length = 0;
    await bot.handleUpdate(messageUpdate(admin, "/ref"));
    expect(sentTexts(calls)[0]).toContain(`https://t.me/test_bot?start=${admin.id}`);
    expect(sentTexts(calls)[0]).toContain("Приглашено: <b>1</b>");
  });

  test("admin + statistics: панель, пользователи, статистика, /ban — только админам", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/admin"));
    const panel = calls.at(-1);
    expect(panel?.payload.text).toBe("🛠 <b>Панель администратора</b>\nВыберите раздел:");
    expect(JSON.stringify(panel?.payload.reply_markup)).toContain("admin:stats");

    await bot.handleUpdate(callbackUpdate(admin, "admin:users"));
    expect(sentTexts(calls).at(-1)).toContain("Всего: <b>1</b>");
    await bot.handleUpdate(callbackUpdate(admin, "admin:stats"));
    expect(sentTexts(calls).at(-1)).toContain("👥 Всего пользователей: <b>1</b>");
    await bot.handleUpdate(messageUpdate(admin, "/stats"));
    expect(sentTexts(calls).at(-1)).toContain("📊 <b>Статистика</b>");

    await bot.handleUpdate(messageUpdate(ivan, "hi"));
    await bot.handleUpdate(messageUpdate(admin, `/ban ${ivan.id}`));
    expect(sentTexts(calls).at(-1)).toBe(`🚫 Забанен: <code>${ivan.id}</code>`);
    await bot.handleUpdate(messageUpdate(admin, "/ban abc"));
    expect(sentTexts(calls).at(-1)).toBe(
      "Использование: /ban &lt;user_id&gt; [telegram|instagram|max]",
    );

    // не админ: /admin и /stats проваливаются до эхо
    calls.length = 0;
    await bot.handleUpdate(messageUpdate(john, "/admin"));
    await bot.handleUpdate(messageUpdate(john, "/stats"));
    expect(sentTexts(calls)).toEqual(["/admin", "/stats"]);
  });

  test("broadcast: диалог текст → подтверждение → рассылка и отчёт", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "hi"));
    await bot.handleUpdate(messageUpdate(john, "hi"));

    await bot.handleUpdate(messageUpdate(admin, "/broadcast"));
    expect(sentTexts(calls).at(-1)).toBe("✍️ Пришлите текст рассылки. /cancel — отмена.");
    await bot.handleUpdate(messageUpdate(admin, "Новости!"));
    expect(sentTexts(calls).at(-1)).toBe(
      "Отправить рассылку 3 пользователям?\n\n<b>Превью:</b>\nНовости!",
    );

    calls.length = 0;
    await bot.handleUpdate(callbackUpdate(admin, "admin:bc_send"));
    const texts = sentTexts(calls);
    expect(texts[0]).toBe("🚀 Рассылка запущена...");
    expect(texts.filter((x) => x === "Новости!")).toHaveLength(3);
    expect(texts.at(-1)).toBe("✅ Готово. Отправлено: 3, ошибок: 0.");
  });

  test("runBroadcast: 403 помечает неактивным, 429 повторяет", async () => {
    const { GrammyError } = await import("grammy");
    const users = new UserRepository(getDb());
    for (const id of [1, 2, 3])
      await users.getOrCreate({ platform: Platform.TELEGRAM, externalId: id });
    const fails: Record<number, unknown[]> = {
      2: [
        new GrammyError(
          "blocked",
          { ok: false, error_code: 403, description: "Forbidden" },
          "sendMessage",
          {},
        ),
      ],
      3: [
        new GrammyError(
          "flood",
          { ok: false, error_code: 429, description: "Too Many", parameters: { retry_after: 0 } },
          "sendMessage",
          {},
        ),
      ],
    };
    const sent: number[] = [];
    const api = {
      sendMessage: async (chatId: number) => {
        const err = fails[chatId]?.shift();
        if (err) throw err;
        sent.push(chatId);
      },
    };
    expect(await runBroadcast(api, { adminId: 111, text: "x" })).toEqual([2, 1]);
    expect(sent.sort()).toEqual([1, 3]);
    expect((await users.allActiveIds(Platform.TELEGRAM)).sort()).toEqual([1, 3]);
  });

  test("support: тикет → уведомление админам → ответ → закрытие", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "/support"));
    await bot.handleUpdate(messageUpdate(ivan, "Не работает оплата"));
    expect(sentTexts(calls)).toContain("✅ Обращение №1 принято. Мы ответим здесь же.");
    const toAdmins = calls.filter((c) => String(c.payload.text).startsWith("🆕 <b>Тикет №1</b>"));
    expect(toAdmins.map((c) => c.payload.chat_id)).toEqual([111, 222]);

    await bot.handleUpdate(messageUpdate(admin, "/tickets"));
    expect(sentTexts(calls).at(-1)).toContain(`• №1`);
    await bot.handleUpdate(messageUpdate(admin, "/reply 1 Уже чиним"));
    const answer = calls.find(
      (c) => c.payload.chat_id === ivan.id && String(c.payload.text).includes("Уже чиним"),
    );
    expect(answer).toBeDefined();
    await bot.handleUpdate(messageUpdate(admin, "/close 1"));
    expect(sentTexts(calls).at(-1)).toBe("✅ Тикет №1 закрыт.");

    const t = supportTables(getDb());
    const messages = await getDb().orm.select().from(t.messages);
    expect(messages.map((m) => [m.fromAdmin, m.text])).toEqual([
      [false, "Не работает оплата"],
      [true, "Уже чиним"],
    ]);
  });

  test("shop + payments: товар → корзина → счёт → оплата", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/addproduct Кофе | 10 | Свежий"));
    expect(sentTexts(calls).at(-1)).toBe("✅ Товар №1 «Кофе» добавлен (10 ⭐️).");

    await bot.handleUpdate(messageUpdate(ivan, "/shop"));
    expect(JSON.stringify(calls.at(-1)?.payload.reply_markup)).toContain("shop:add:1");
    await bot.handleUpdate(callbackUpdate(ivan, "shop:add:1"));
    await bot.handleUpdate(callbackUpdate(ivan, "shop:add:1"));
    await bot.handleUpdate(messageUpdate(ivan, "/cart"));
    expect(sentTexts(calls).at(-1)).toContain("Итого: <b>20 ⭐️</b>");

    await bot.handleUpdate(callbackUpdate(ivan, "shop:checkout"));
    const invoice = calls.find((c) => c.method === "sendInvoice");
    expect(invoice?.payload).toMatchObject({
      chat_id: ivan.id,
      payload: "order:1",
      currency: "XTR",
      prices: [{ label: "Заказ №1", amount: 20 }],
    });

    await bot.handleUpdate(preCheckoutUpdate(ivan, "order:1", 20));
    expect(calls.at(-1)).toMatchObject({ method: "answerPreCheckoutQuery", payload: { ok: true } });

    await bot.handleUpdate(
      rawMessageUpdate(
        ivan,
        { id: ivan.id, type: "private", first_name: "Иван" },
        {
          successful_payment: {
            currency: "XTR",
            total_amount: 20,
            invoice_payload: "order:1",
            telegram_payment_charge_id: "ch_1",
            provider_payment_charge_id: "",
          },
        },
      ),
    );
    expect(sentTexts(calls)).toContain("✅ Заказ №1 оплачён. Спасибо за покупку!");

    const shop = shopTables(getDb());
    const [order] = await getDb().orm.select().from(shop.orders);
    expect([order?.status, order?.totalStars]).toEqual(["paid", 20]);
    const items = await getDb().orm.select().from(shop.orderItems);
    expect(items.map((i) => [i.title, i.qty, i.priceStars])).toEqual([["Кофе", 2, 10]]);
    const payments = await getDb().orm.select().from(paymentsTables(getDb()).payments);
    expect(payments.map((p) => [p.amount, p.payload, p.telegramChargeId])).toEqual([
      [20, "order:1", "ch_1"],
    ]);
  });

  test("payments: /donate выставляет счёт в Stars, оплата пишется в БД", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(john, "/donate"));
    expect(calls.at(-1)?.method).toBe("sendInvoice");
    expect(calls.at(-1)?.payload).toMatchObject({
      currency: "XTR",
      payload: "donate:50",
      provider_token: "",
      prices: [{ label: "Поддержать бота", amount: 50 }],
    });
    await bot.handleUpdate(
      rawMessageUpdate(
        john,
        { id: john.id, type: "private", first_name: "John" },
        {
          successful_payment: {
            currency: "XTR",
            total_amount: 50,
            invoice_payload: "donate:50",
            telegram_payment_charge_id: "ch_2",
            provider_payment_charge_id: "",
          },
        },
      ),
    );
    expect(sentTexts(calls).at(-1)).toBe("✅ Оплата получена: 50 XTR. Спасибо!");
    const [payment] = await getDb().orm.select().from(paymentsTables(getDb()).payments);
    expect([payment?.amount, payment?.currency, payment?.status]).toEqual([50, "XTR", "paid"]);
  });

  test("scheduler: /schedule, /scheduled, /unschedule и доставка наступивших", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "hi"));
    await bot.handleUpdate(messageUpdate(admin, "/schedule 2099-01-01 10:00 | Анонс"));
    expect(sentTexts(calls).at(-1)).toBe(
      "✅ Запланировано №1 на 2099-01-01 10:00 UTC (получателей: все активные).",
    );
    await bot.handleUpdate(messageUpdate(admin, "/schedule 2000-01-01 10:00 | old"));
    expect(sentTexts(calls).at(-1)).toBe("⏰ Время уже прошло. Укажите будущий момент (UTC).");
    await bot.handleUpdate(messageUpdate(admin, "/schedule 2099-02-30 10:00 | bad"));
    expect(sentTexts(calls).at(-1)).toBe("Не удалось разобрать дату. Пример: 2026-09-10 15:30");
    await bot.handleUpdate(messageUpdate(admin, "/schedule 2099-01-02 10:00 | Второй"));
    await bot.handleUpdate(messageUpdate(admin, "/scheduled"));
    expect(sentTexts(calls).at(-1)).toContain("• №1 — 2099-01-01 10:00 UTC — Анонс…");
    await bot.handleUpdate(messageUpdate(admin, "/unschedule 2"));
    expect(sentTexts(calls).at(-1)).toBe("✅ Задача №2 отменена.");

    // «перематываем время»: задача №1 наступила
    const t = schedulerTables(getDb());
    await getDb()
      .orm.update(t.posts)
      .set({ runAt: new Date(Date.now() - 1000) })
      .where(eq(t.posts.id, 1));
    const sent: number[] = [];
    const delivered = await processDuePosts({
      sendMessage: async (id: number) => void sent.push(id),
    });
    expect(delivered).toBe(1);
    expect(sent.sort()).toEqual([admin.id, ivan.id]);
    const statuses = (await getDb().orm.select().from(t.posts)).map((p) => [p.id, p.status]);
    expect(statuses).toEqual([
      [1, "done"],
      [2, "cancelled"],
    ]);
    expect(await processDuePosts({ sendMessage: async () => undefined })).toBe(0);
  });
});

describe("telegram_group", () => {
  const getChatMember = (p: Record<string, unknown>) => ({
    status: p.user_id === admin.id ? "administrator" : "member",
    user: { id: p.user_id, is_bot: false, first_name: "x" },
  });

  test("captcha: новичок ограничен, чужое нажатие отклонено, своё — снимает ограничение", async () => {
    vi.useFakeTimers();
    try {
      const bot = buildGroup();
      const calls = attachFakeApi(bot);
      await bot.handleUpdate(rawMessageUpdate(ivan, groupChat, { new_chat_members: [ivan] }));
      expect(calls[0]).toMatchObject({
        method: "restrictChatMember",
        payload: {
          chat_id: groupChat.id,
          user_id: ivan.id,
          permissions: { can_send_messages: false },
        },
      });
      expect(String(calls[1]?.payload.text)).toContain(
        "Иван, подтвердите, что вы не бот, за 60 сек.",
      );
      const data = `captcha:${groupChat.id}:${ivan.id}`;

      await bot.handleUpdate(callbackUpdate(john, data, groupChat));
      expect(calls.at(-1)).toMatchObject({
        method: "answerCallbackQuery",
        payload: { show_alert: true },
      });

      await bot.handleUpdate(callbackUpdate(ivan, data, groupChat));
      expect(
        calls.some(
          (c) =>
            c.method === "restrictChatMember" &&
            (c.payload.permissions as Record<string, boolean>).can_send_messages,
        ),
      ).toBe(true);
      expect(sentTexts(calls).at(-1)).toBe("✅ Проверка пройдена, добро пожаловать!");

      // таймер отменён — кика не будет
      await vi.advanceTimersByTimeAsync(61_000);
      expect(calls.some((c) => c.method === "banChatMember")).toBe(false);

      // не нажал вовремя → кик (ban+unban) и удаление сообщения
      await bot.handleUpdate(rawMessageUpdate(john, groupChat, { new_chat_members: [john] }));
      await vi.advanceTimersByTimeAsync(61_000);
      expect(calls.slice(-3).map((c) => c.method)).toEqual([
        "banChatMember",
        "unbanChatMember",
        "deleteMessage",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("moderation: /warn ×3 → мут, только админ чата, нужен reply", async () => {
    const bot = buildGroup();
    const calls = attachFakeApi(bot, { getChatMember });
    const replyTo = {
      reply_to_message: { message_id: 1, date: 0, chat: groupChat, from: ivan, text: "спам" },
    };
    const warn = (from = admin) => messageUpdate(from, "/warn", groupChat, replyTo);

    await bot.handleUpdate(warn(john));
    expect(sentTexts(calls).at(-1)).toBe("⛔️ Только для админов чата.");
    await bot.handleUpdate(messageUpdate(admin, "/warn", groupChat));
    expect(sentTexts(calls).at(-1)).toBe("Ответьте этой командой на сообщение нарушителя.");

    await bot.handleUpdate(warn());
    await bot.handleUpdate(warn());
    expect(sentTexts(calls).at(-1)).toBe("⚠️ Предупреждение 2/3 для Иван.");
    await bot.handleUpdate(warn());
    expect(sentTexts(calls).at(-1)).toBe("⚠️ Иван: 3/3 — мут на час.");
    expect(calls.find((c) => c.method === "restrictChatMember")?.payload).toMatchObject({
      user_id: ivan.id,
      permissions: { can_send_messages: false },
    });

    await bot.handleUpdate(messageUpdate(admin, "/mute 15", groupChat, replyTo));
    expect(sentTexts(calls).at(-1)).toBe("🔇 Иван заглушён на 15 мин.");
    await bot.handleUpdate(messageUpdate(admin, "/kick", groupChat, replyTo));
    expect(calls.slice(-3).map((c) => c.method)).toEqual([
      "banChatMember",
      "unbanChatMember",
      "sendMessage",
    ]);
  });

  test("antiflood: 6 сообщений за 5 секунд → мут на 5 минут (админов не трогает)", async () => {
    const bot = buildGroup();
    const calls = attachFakeApi(bot, { getChatMember });
    for (let i = 0; i < 6; i++) await bot.handleUpdate(messageUpdate(john, `msg ${i}`, groupChat));
    expect(sentTexts(calls)).toEqual(["🔇 John заглушён на 5 мин за флуд."]);

    calls.length = 0;
    for (let i = 0; i < 6; i++) await bot.handleUpdate(messageUpdate(admin, `msg ${i}`, groupChat));
    expect(calls.some((c) => c.method === "restrictChatMember")).toBe(false);
  });
});
