/** platforms/max: клиент, загрузка файлов, парсинг, эндпоинт, polling — без сети и сокетов. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb, StatsRepository, UserRepository } from "../src/core/db/index.js";
import {
  BASE_URL,
  buildWebhook,
  callbackButton,
  linkButton,
  MaxClient,
  MaxUploadError,
  orderKey,
  parseUpdate,
  parseUpdates,
  runPolling,
  verifySecret,
} from "../src/platforms/max/index.js";
import { resetDb } from "./helpers.js";
import { type FakeResponse, fakeFetch, jsonBody, query } from "./http-fakes.js";

const TOKEN = "max-token";
const SECRET = "max_secret";

const msgUpdate = (
  mid: string,
  text: string | null,
  uid = 500,
  isBot = false,
  attachments?: unknown[],
) => ({
  update_type: "message_created",
  timestamp: 1,
  user_locale: "ru",
  message: {
    sender: { user_id: uid, first_name: "Иван", username: "ivan", is_bot: isBot },
    recipient: { chat_id: 9001, chat_type: "dialog", user_id: null },
    timestamp: 1,
    body: { mid, seq: 1, text, attachments },
  },
});

const CALLBACK = {
  update_type: "message_callback",
  timestamp: 2,
  callback: {
    timestamp: 2,
    callback_id: "cb1",
    payload: "help",
    user: { user_id: 500, first_name: "Иван", username: "ivan", is_bot: false },
  },
  message: {
    recipient: { chat_id: 9001, chat_type: "dialog" },
    timestamp: 1,
    body: { mid: "m0", seq: 0, text: "menu" },
  },
};
const BOT_STARTED = {
  update_type: "bot_started",
  timestamp: 3,
  chat_id: 9001,
  payload: "ref42",
  user: { user_id: 600, first_name: "Пётр", is_bot: false },
};
const CHANNEL_POST = {
  update_type: "message_created",
  timestamp: 4,
  message: {
    recipient: { chat_id: -5, chat_type: "channel" },
    timestamp: 4,
    body: { mid: "p1", seq: 1, text: "post" },
  },
};

const maxClient = (responses: FakeResponse[] = [], fallback?: FakeResponse) => {
  const http = fakeFetch(responses, fallback);
  return {
    http,
    client: new MaxClient({ token: TOKEN, fetch: http.fetch, retryDelaysMs: [0, 0, 0] }),
  };
};

describe("MaxClient", () => {
  test("sendText: URL, Authorization без Bearer, chat_id в query", async () => {
    const { http, client } = maxClient();
    await client.sendText(9001, "hi");
    const [call] = http.calls;
    expect(call?.url.startsWith(`${BASE_URL}/messages?`)).toBe(true);
    expect(BASE_URL).toBe("https://platform-api2.max.ru");
    expect(call?.headers.Authorization).toBe(TOKEN);
    expect(query(call)).toEqual({ chat_id: "9001" });
    expect(jsonBody(call)).toEqual({ text: "hi" });
  });

  test("клавиатура пользователю", async () => {
    const { http, client } = maxClient();
    await client.sendKeyboard(
      null,
      "Выбор",
      [[callbackButton("Да", "yes"), linkButton("Сайт", "https://x")]],
      {
        userId: 7,
      },
    );
    expect(query(http.calls[0])).toEqual({ user_id: "7" });
    expect((jsonBody(http.calls[0]) as { attachments: unknown }).attachments).toEqual([
      {
        type: "inline_keyboard",
        payload: {
          buttons: [
            [
              { type: "callback", text: "Да", payload: "yes" },
              { type: "link", text: "Сайт", url: "https://x" },
            ],
          ],
        },
      },
    ]);
  });

  test("нужен chatId или userId", async () => {
    await expect(maxClient().client.sendText(null, "x")).rejects.toThrow(/chatId или userId/);
  });

  test("answerCallback, getUpdates, подписки", async () => {
    const { http, client } = maxClient();
    await client.answerCallback("cb1", { notification: "ok" });
    await client.getUpdates(123, { timeout: 10, types: ["message_created", "message_callback"] });
    await client.subscribe("https://h/webhook", {
      updateTypes: ["message_created"],
      secret: SECRET,
    });
    await client.unsubscribe("https://h/webhook");
    expect(query(http.calls[0])).toEqual({ callback_id: "cb1" });
    expect(jsonBody(http.calls[0])).toEqual({ notification: "ok" });
    expect(http.calls[1]?.method).toBe("GET");
    expect(query(http.calls[1])).toEqual({
      marker: "123",
      timeout: "10",
      limit: "100",
      types: "message_created,message_callback",
    });
    expect(jsonBody(http.calls[2])).toEqual({
      url: "https://h/webhook",
      update_types: ["message_created"],
      secret: SECRET,
    });
    expect([http.calls[3]?.method, query(http.calls[3])]).toEqual([
      "DELETE",
      { url: "https://h/webhook" },
    ]);
  });
});

describe("загрузка файлов (пункт 18)", () => {
  const UPLOAD_URL = "https://iu.oneme.ru/upload.do?id=1";

  test("image: payload — ответ загрузки, токен бота на хост загрузки не уходит", async () => {
    const { http, client } = maxClient([
      { body: { url: UPLOAD_URL } },
      { body: { photos: { p1: { token: "IMG" } } } },
    ]);
    const attachment = await client.upload("image", new Uint8Array([1, 2, 3]), {
      filename: "a.png",
    });
    expect(attachment).toEqual({ type: "image", payload: { photos: { p1: { token: "IMG" } } } });
    expect([http.calls[0]?.method, query(http.calls[0])]).toEqual(["POST", { type: "image" }]);
    expect(http.calls[1]?.url).toBe(UPLOAD_URL);
    expect(http.calls[1]?.body).toBeInstanceOf(FormData);
    expect(http.calls[1]?.headers).toEqual({});
  });

  test("video: token из первого шага, файл по пути", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devbase-max-"));
    const file = path.join(dir, "clip.mp4");
    fs.writeFileSync(file, "MP4");
    const { client } = maxClient([
      { body: { url: "https://omub.okcdn.ru/u", token: "VID" } },
      { body: "<retval>1</retval>" },
    ]);
    expect(await client.upload("video", file)).toEqual({
      type: "video",
      payload: { token: "VID" },
    });
    fs.rmSync(dir, { recursive: true });
  });

  test("ошибки загрузки", async () => {
    await expect(maxClient().client.upload("photo" as never, new Uint8Array())).rejects.toThrow(
      /тип загрузки/,
    );
    await expect(
      maxClient([{ body: { code: "err" } }]).client.upload("file", new Uint8Array()),
    ).rejects.toThrow(MaxUploadError);
    await expect(
      maxClient([
        { body: { url: UPLOAD_URL } },
        { body: { error: "big" }, status: 413 },
      ]).client.upload("file", new Uint8Array()),
    ).rejects.toThrow(MaxUploadError);
    await expect(
      maxClient([{ body: { url: UPLOAD_URL } }, { body: "ok" }]).client.upload(
        "audio",
        new Uint8Array(),
      ),
    ).rejects.toThrow(/token/);
  });

  test("sendFile повторяет отправку, пока вложение обрабатывается", async () => {
    const notReady = {
      body: { code: "attachment.not.ready", message: "not processed" },
      status: 400,
    };
    const { http, client } = maxClient([
      { body: { url: UPLOAD_URL } },
      { body: { token: "FILE" } },
      notReady,
      notReady,
      { body: { message: { body: { mid: "m1" } } } },
    ]);
    const result = await client.sendFile(9001, new Uint8Array([1]), "file", {
      text: "Отчёт",
      filename: "r.pdf",
    });
    expect(result).toEqual({ message: { body: { mid: "m1" } } });
    const sends = http.calls.filter((c) => c.url.startsWith(`${BASE_URL}/messages`));
    expect(sends).toHaveLength(3);
    expect(jsonBody(sends[0])).toEqual({
      text: "Отчёт",
      attachments: [{ type: "file", payload: { token: "FILE" } }],
    });
  });

  test("текст без вложений не повторяется", async () => {
    const { http, client } = maxClient([], { body: { code: "attachment.not.ready" }, status: 400 });
    await client.sendText(1, "x");
    expect(http.calls).toHaveLength(1);
  });
});

describe("парсинг и секрет", () => {
  test("message_created", () => {
    const u = parseUpdate(msgUpdate("m1", "hello"));
    expect([u?.updateType, u?.chatId, u?.userId, u?.text, u?.mid]).toEqual([
      "message_created",
      9001,
      500,
      "hello",
      "m1",
    ]);
    expect([u?.contentType, u?.chatType, u?.userLocale, u?.firstName]).toEqual([
      "text",
      "dialog",
      "ru",
      "Иван",
    ]);
    const img = parseUpdate(
      msgUpdate("m2", null, 500, false, [{ type: "image", payload: { url: "u" } }]),
    );
    expect(img?.contentType).toBe("image");
  });

  test("callback, bot_started, ключ очереди, неизвестные типы", () => {
    const cb = parseUpdate(CALLBACK);
    expect([cb?.callbackId, cb?.payload, cb?.userId, cb?.chatId, cb?.contentType]).toEqual([
      "cb1",
      "help",
      500,
      9001,
      "callback",
    ]);
    const started = parseUpdate(BOT_STARTED);
    expect([started?.payload, started?.userId, started?.chatId]).toEqual(["ref42", 600, 9001]);
    expect(started && orderKey(started)).toBe("600");
    const post = parseUpdate(CHANNEL_POST);
    expect(post && orderKey(post)).toBe("-5");
    expect(parseUpdate({ update_type: "bot_added", chat_id: 1 })).toBeNull();
    expect(
      parseUpdates({
        updates: [CALLBACK, BOT_STARTED, { update_type: "user_added" }],
        marker: 5,
      }).map((u) => u.updateType),
    ).toEqual(["message_callback", "bot_started"]);
  });

  test("verifySecret", () => {
    expect(verifySecret("anything", undefined)).toBe(true);
    expect(verifySecret(SECRET, SECRET)).toBe(true);
    expect(verifySecret("wrong", SECRET)).toBe(false);
    expect(verifySecret(undefined, SECRET)).toBe(false);
  });
});

describe("эндпоинт вебхука", () => {
  beforeEach(resetDb);

  test("секрет, регистрация, дедуп, пропуск ботов и постов канала", async () => {
    const got: [string, number][] = [];
    const hook = buildWebhook(
      async (update, ctx) => {
        got.push([update.updateType, ctx.dbUser.externalId]);
      },
      { secret: SECRET, client: maxClient().client },
    );
    const post = (b: unknown, s = SECRET) => hook.handlePost(JSON.stringify(b), s);
    expect((await post(msgUpdate("m1", "hi"), "wrong")).status).toBe(403);
    expect((await hook.handlePost("{bad", SECRET)).status).toBe(400);
    for (const b of [
      msgUpdate("m1", "hi"),
      msgUpdate("m1", "hi"),
      CALLBACK,
      BOT_STARTED,
      CHANNEL_POST,
      msgUpdate("mb", "bot", 1, true),
    ]) {
      expect(await post(b)).toEqual({
        status: 200,
        body: '{"ok": true}',
        contentType: "application/json",
      });
    }
    await hook.stop();

    // разные пользователи — параллельно; порядок гарантирован внутри пользователя
    expect([...got].sort()).toEqual(
      [
        ["message_created", 500],
        ["message_callback", 500],
        ["bot_started", 600],
      ].sort(),
    );
    expect(got.filter(([, uid]) => uid === 500).map(([kind]) => kind)).toEqual([
      "message_created",
      "message_callback",
    ]);
    const users = new UserRepository(getDb());
    expect(await users.count("max")).toBe(2);
    const ivan = await users.get("max", 500);
    expect([ivan?.firstName, ivan?.username, ivan?.languageCode]).toEqual(["Иван", "ivan", "ru"]);
    expect((await new StatsRepository(getDb()).summary("max")).messagesDay).toBe(1);
  });

  test("событие без username не стирает профиль (пункт 3)", async () => {
    const partial = {
      ...CALLBACK,
      callback: {
        ...CALLBACK.callback,
        callback_id: "cb_p",
        user: { user_id: 500, first_name: "Иван" },
      },
    };
    const hook = buildWebhook(async () => {}, { secret: SECRET, client: maxClient().client });
    await hook.handlePost(JSON.stringify(msgUpdate("p1", "hi")), SECRET);
    await hook.handlePost(JSON.stringify(partial), SECRET);
    await hook.stop();
    const ivan = await new UserRepository(getDb()).get("max", 500);
    expect([ivan?.username, ivan?.firstName]).toEqual(["ivan", "Иван"]);
  });

  test("забаненному — всплывающее уведомление на кнопку", async () => {
    const users = new UserRepository(getDb());
    await users.getOrCreate({ platform: "max", externalId: 500 });
    await users.setBanned("max", 500, true);
    const { http, client } = maxClient();
    const called: unknown[] = [];
    const hook = buildWebhook(async (u) => void called.push(u), { secret: SECRET, client });
    await hook.handlePost(JSON.stringify(CALLBACK), SECRET);
    await hook.stop();
    expect(called).toEqual([]);
    expect(http.calls[0]?.url.startsWith(`${BASE_URL}/answers?`)).toBe(true);
    expect(jsonBody(http.calls[0])).toHaveProperty("notification");
  });
});

describe("long polling", () => {
  beforeEach(resetDb);

  test("пауза после ошибки, marker, пропуск ботов, остановка по signal", async () => {
    const markers: (number | null)[] = [];
    const controller = new AbortController();
    const polled: (string | null)[] = [];

    class FakeMax extends MaxClient {
      override async getMe() {
        return { user_id: 1, username: "bot" };
      }
      override async getUpdates(marker: number | null) {
        markers.push(marker);
        if (markers.length === 1) return { code: "too.many.requests" };
        if (markers.length === 2) {
          return {
            updates: [msgUpdate("pm1", "poll"), msgUpdate("pb", "bot", 2, true)],
            marker: 77,
          };
        }
        controller.abort();
        return { updates: [], marker: 78 };
      }
    }

    await runPolling(async (update) => void polled.push(update.mid), {
      client: new FakeMax({ token: "t", fetch: fakeFetch().fetch }),
      signal: controller.signal,
      delayMinMs: 0,
    });
    expect(polled).toEqual(["pm1"]);
    expect(markers).toEqual([null, null, 77]);
  });
});
