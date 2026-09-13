/** Регрессии: /cancel в диалогах и экранирование HTML (пункты 1–2). */
import { beforeEach, describe, expect, test } from "vitest";
import { getDb } from "../src/core/db/index.js";
import { supportTables } from "../src/modules/support/index.js";
import { escapeHtml, messageHtml } from "../src/platforms/telegram/index.js";
import { build as buildFull } from "../src/templates/telegram_full/main.js";
import { attachFakeApi, messageUpdate, privateChat, resetDb, sentTexts, user } from "./helpers.js";

const admin = user(111, "Админ");
const ivan = user(5001, "Иван", { language_code: "ru" });

describe("escapeHtml / messageHtml", () => {
  test("escapeHtml экранирует & < > (кавычки не трогает, как quote=False)", () => {
    expect(escapeHtml('a < b & "c" > d')).toBe('a &lt; b &amp; "c" &gt; d');
  });

  test("entities → HTML: вложенность, ссылки, UTF-16, спецсимволы", () => {
    expect(messageHtml("a<b & c", [])).toBe("a&lt;b &amp; c");
    expect(
      messageHtml("bold italic", [
        { type: "bold", offset: 0, length: 11 },
        { type: "italic", offset: 5, length: 6 },
      ]),
    ).toBe("<b>bold <i>italic</i></b>");
    expect(
      messageHtml("go <site>", [
        { type: "text_link", offset: 3, length: 6, url: "https://x.ru/?a=1&b=2" },
      ]),
    ).toBe('go <a href="https://x.ru/?a=1&amp;b=2">&lt;site&gt;</a>');
    // эмодзи занимает 2 единицы UTF-16 — offsets Telegram совпадают с JS
    expect(messageHtml("👍 ok", [{ type: "bold", offset: 3, length: 2 }])).toBe("👍 <b>ok</b>");
    expect(messageHtml("x", [{ type: "pre", offset: 0, length: 1, language: "ts" }])).toBe(
      '<pre><code class="language-ts">x</code></pre>',
    );
    expect(messageHtml("/start", [{ type: "bot_command", offset: 0, length: 6 }])).toBe("/start");
  });
});

describe("/cancel в диалогах (пункт 1)", () => {
  beforeEach(resetDb);

  test("рассылка: /cancel отменяет, а не уходит как текст рассылки", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/broadcast"));
    await bot.handleUpdate(messageUpdate(admin, "/cancel"));
    expect(sentTexts(calls).at(-1)).toBe("❌ Отменено.");
    // состояние сброшено: обычный текст — это эхо, а не превью рассылки
    await bot.handleUpdate(messageUpdate(admin, "просто текст"));
    expect(sentTexts(calls).at(-1)).toBe("просто текст");
    expect(calls.some((c) => JSON.stringify(c.payload).includes("admin:bc_send"))).toBe(false);
  });

  test("поддержка: /cancel отменяет, тикет не создаётся", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "/support"));
    await bot.handleUpdate(messageUpdate(ivan, "/cancel"));
    expect(sentTexts(calls).at(-1)).toBe("❌ Отменено.");
    const tickets = await getDb().orm.select().from(supportTables(getDb()).tickets);
    expect(tickets).toHaveLength(0);
  });
});

describe("экранирование HTML (пункт 2)", () => {
  beforeEach(resetDb);

  test("эхо: спецсимволы экранированы, форматирование сохранено", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(ivan, "a < b & <i>"));
    await bot.handleUpdate(
      messageUpdate(ivan, "жирный", privateChat(ivan), {
        entities: [{ type: "bold", offset: 0, length: 6 }],
      }),
    );
    expect(sentTexts(calls)).toEqual(["a &lt; b &amp; &lt;i&gt;", "<b>жирный</b>"]);
  });

  test("имя с HTML в /start и в уведомлении referral", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    const tom = user(6001, "<Tom>");
    await bot.handleUpdate(messageUpdate(admin, "/start"));
    await bot.handleUpdate(messageUpdate(tom, `/start ${admin.id}`));
    const texts = sentTexts(calls);
    expect(texts).toContain(
      "👋 Привет, &lt;Tom&gt;! Я бот. Напиши /help, чтобы узнать возможности.",
    );
    expect(texts.some((x) => x.includes("присоединился &lt;Tom&gt;!"))).toBe(true);
  });

  test("рассылка: превью экранировано", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/broadcast"));
    await bot.handleUpdate(messageUpdate(admin, "Скидка <50%> & подарок"));
    expect(sentTexts(calls).at(-1)).toContain("<b>Превью:</b>\nСкидка &lt;50%&gt; &amp; подарок");
  });

  test("поддержка: текст обращения и имя экранированы у админов, в БД — исходный текст", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    const eve = user(6002, "<Eve>");
    await bot.handleUpdate(messageUpdate(eve, "/support"));
    await bot.handleUpdate(messageUpdate(eve, "<script>"));
    const toAdmin = sentTexts(calls).find((x) => x.startsWith("🆕 <b>Тикет №1</b>"));
    expect(toAdmin).toContain("от &lt;Eve&gt;");
    expect(toAdmin).toContain("&lt;script&gt;");
    const [message] = await getDb().orm.select().from(supportTables(getDb()).messages);
    expect(message?.text).toBe("<script>");
  });

  test("shop: название и описание товара экранированы", async () => {
    const bot = buildFull();
    const calls = attachFakeApi(bot);
    await bot.handleUpdate(messageUpdate(admin, "/addproduct <Кофе> | 10 | a&b"));
    expect(sentTexts(calls).at(-1)).toBe("✅ Товар №1 «&lt;Кофе&gt;» добавлен (10 ⭐️).");
    await bot.handleUpdate(messageUpdate(ivan, "/shop"));
    expect(sentTexts(calls).at(-1)).toBe("<b>&lt;Кофе&gt;</b>\na&amp;b\n\nЦена: <b>10 ⭐️</b>");
    await bot.handleUpdate(messageUpdate(admin, "/products"));
    expect(sentTexts(calls).at(-1)).toContain("🟢 &lt;Кофе&gt; — 10 ⭐️");
  });
});
