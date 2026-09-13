/** platforms/instagram: клиент (подменный fetch), подпись, парсинг, эндпоинт — без сети и сокетов. */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { getDb, StatsRepository, UserRepository } from "../src/core/db/index.js";
import {
  buildWebhook,
  GRAPH_API,
  InstagramClient,
  InstagramWebhook,
  parseEvents,
  toExternalId,
  verifyChallenge,
  verifySignature,
} from "../src/platforms/instagram/index.js";
import { resetDb } from "./helpers.js";
import { fakeFetch, jsonBody, query } from "./http-fakes.js";

const SECRET = "ig-secret";
const VERIFY = "ig-verify";
const TOKEN = "ig-token";

const sign = (body: string) => `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;

const event = (mid: string, message: Record<string, unknown>) => ({
  sender: { id: "777" },
  recipient: { id: "IG" },
  timestamp: 1,
  message: { mid, ...message },
});

const PAYLOAD = {
  object: "instagram",
  entry: [
    {
      id: "IG",
      time: 1,
      messaging: [
        event("m1", { text: "hello" }),
        event("m2", { attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }] }),
        event("m3", { text: "Да", quick_reply: { payload: "YES" } }),
        {
          sender: { id: "777" },
          recipient: { id: "IG" },
          timestamp: 2,
          postback: { mid: "m4", title: "Старт", payload: "GO" },
        },
        {
          sender: { id: "IG" },
          recipient: { id: "777" },
          timestamp: 3,
          message: { mid: "m5", text: "echo", is_echo: true },
        },
        { sender: { id: "777" }, recipient: { id: "IG" }, timestamp: 4, read: { mid: "m1" } },
      ],
    },
  ],
};

const body = (...events: unknown[]) =>
  JSON.stringify({ object: "instagram", entry: [{ id: "IG", messaging: events }] });

const client = (
  responses: Parameters<typeof fakeFetch>[0] = [],
  fallback?: Parameters<typeof fakeFetch>[1],
) => {
  const http = fakeFetch(responses, fallback);
  return { http, client: new InstagramClient({ accessToken: TOKEN, fetch: http.fetch }) };
};

const hookOptions = { verifyToken: VERIFY, appSecret: SECRET };

describe("InstagramClient", () => {
  test("sendText: URL, Bearer, тело", async () => {
    const { http, client: ig } = client();
    await ig.sendText("42", "hi");
    const [call] = http.calls;
    expect(call?.url).toBe(`${GRAPH_API}/me/messages`);
    expect(GRAPH_API).toBe("https://graph.instagram.com/v26.0");
    expect(call?.method).toBe("POST");
    expect(call?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(jsonBody(call)).toEqual({ recipient: { id: "42" }, message: { text: "hi" } });
  });

  test("sendImage и свой igUserId", async () => {
    const http = fakeFetch();
    const ig = new InstagramClient({
      accessToken: TOKEN,
      igUserId: "17841400000",
      fetch: http.fetch,
    });
    await ig.sendImage("42", "https://x/i.png");
    expect(http.calls[0]?.url).toBe(`${GRAPH_API}/17841400000/messages`);
    expect(jsonBody(http.calls[0])).toMatchObject({
      message: { attachments: [{ type: "image", payload: { url: "https://x/i.png" } }] },
    });
  });

  test("quick replies: не больше 13, заголовок до 20 символов", async () => {
    const { http, client: ig } = client();
    const replies = [
      ["X".repeat(30), "P0"] as const,
      ...Array.from({ length: 14 }, (_, i) => [`b${i}`, `P${i}`] as const),
    ];
    await ig.sendQuickReplies("42", "Выбери", replies);
    const items = (jsonBody(http.calls[0]) as { message: { quick_replies: unknown[] } }).message
      .quick_replies;
    expect(items).toHaveLength(13);
    expect(items[0]).toEqual({ content_type: "text", title: "X".repeat(20), payload: "P0" });
  });

  test("markSeen и профиль (access_token в query)", async () => {
    const { http, client: ig } = client();
    await ig.markSeen("42");
    await ig.getUserProfile("42", ["name", "username"]);
    expect(jsonBody(http.calls[0])).toEqual({
      recipient: { id: "42" },
      sender_action: "mark_seen",
    });
    expect(http.calls[1]?.method).toBe("GET");
    expect(http.calls[1]?.url.startsWith(`${GRAPH_API}/42?`)).toBe(true);
    expect(query(http.calls[1])).toEqual({ fields: "name,username", access_token: TOKEN });
  });

  test("ошибка API возвращается, а не бросается", async () => {
    const { client: ig } = client([{ body: { error: { code: 100 } }, status: 400 }]);
    expect(await ig.sendText("1", "x")).toEqual({ error: { code: 100 } });
  });
});

describe("проверки и парсинг", () => {
  test("verifyChallenge", () => {
    const ok = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "vt",
      "hub.challenge": "123",
    });
    expect(verifyChallenge(ok, "vt")).toBe("123");
    expect(verifyChallenge(ok, "other")).toBeNull();
    expect(verifyChallenge(ok, undefined)).toBeNull();
  });

  test("verifySignature", () => {
    const raw = '{"a":1}';
    expect(verifySignature(raw, sign(raw), SECRET)).toBe(true);
    expect(verifySignature(`${raw} `, sign(raw), SECRET)).toBe(false);
    expect(verifySignature(raw, "sha1=abc", SECRET)).toBe(false);
    expect(verifySignature(raw, undefined, SECRET)).toBe(false);
  });

  test("parseEvents: сообщения, вложения, quick reply, postback, эхо", () => {
    const events = parseEvents(PAYLOAD);
    expect(events.map((e) => e.contentType)).toEqual([
      "text",
      "image",
      "quick_reply",
      "postback",
      "text",
    ]);
    expect([events[0]?.senderId, events[0]?.accountId, events[0]?.text]).toEqual([
      "777",
      "IG",
      "hello",
    ]);
    expect(events[1]?.attachments).toEqual([{ type: "image", url: "https://cdn/x.jpg" }]);
    expect([events[2]?.payload, events[3]?.payload, events[3]?.text]).toEqual([
      "YES",
      "GO",
      "Старт",
    ]);
    expect(events[4]?.isEcho).toBe(true);
    expect(parseEvents([PAYLOAD])[0]?.mid).toBe("m1");
    expect(parseEvents({ object: "page", entry: [] })).toEqual([]);
  });

  test("toExternalId: только безопасные целые", () => {
    expect(toExternalId("777")).toBe(777);
    expect(toExternalId("99999999999999999")).toBeNull(); // > 2^53
    expect(toExternalId("abc")).toBeNull();
  });
});

describe("эндпоинт вебхука", () => {
  beforeEach(resetDb);

  test("верификация, подпись, регистрация, лог, дедуп", async () => {
    const got: [string | null, number][] = [];
    const hook = buildWebhook(
      async (msg, ctx) => {
        got.push([msg.mid, ctx.dbUser.externalId]);
      },
      { ...hookOptions, client: client().client },
    );
    const ok = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY,
      "hub.challenge": "999",
    });
    expect(hook.handleGet(ok)).toEqual({ status: 200, body: "999" });
    ok.set("hub.verify_token", "x");
    expect(hook.handleGet(ok).status).toBe(403);

    const raw = JSON.stringify(PAYLOAD);
    expect((await hook.handlePost(raw, "sha256=00")).status).toBe(403);
    expect((await hook.handlePost("nope", sign("nope"))).status).toBe(400);
    for (let i = 0; i < 2; i++) {
      expect(await hook.handlePost(raw, sign(raw))).toEqual({
        status: 200,
        body: "EVENT_RECEIVED",
      });
    }
    await hook.stop();

    expect(got).toEqual([
      ["m1", 777],
      ["m2", 777],
      ["m3", 777],
      ["m4", 777],
    ]);
    expect(await new UserRepository(getDb()).count("instagram")).toBe(1);
    expect((await new StatsRepository(getDb()).summary("instagram")).messagesDay).toBe(4);
  });

  test("200 возвращается до окончания обработки", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const got: (string | null)[] = [];
    const hook = buildWebhook(
      async (msg) => {
        await gate;
        got.push(msg.mid);
      },
      { ...hookOptions, client: client().client },
    );
    const raw = body(event("slow", { text: "hi" }));
    expect((await hook.handlePost(raw, sign(raw))).status).toBe(200);
    expect(got).toEqual([]);
    release();
    await hook.stop();
    expect(got).toEqual(["slow"]);
  });

  test("забаненному — уведомление, обработчик не вызывается", async () => {
    const users = new UserRepository(getDb());
    await users.getOrCreate({ platform: "instagram", externalId: 777 });
    await users.setBanned("instagram", 777, true);
    const { http, client: ig } = client();
    const called: unknown[] = [];
    const hook = buildWebhook(async (msg) => void called.push(msg), { ...hookOptions, client: ig });
    const raw = body(event("b1", { text: "hi" }));
    await hook.handlePost(raw, sign(raw));
    await hook.stop();
    expect(called).toEqual([]);
    expect(jsonBody(http.calls[0])).toMatchObject({ recipient: { id: "777" } });
  });

  test("профиль нового собеседника запрашивается один раз", async () => {
    const { http, client: ig } = client([], { body: { name: "Иван Петров", username: "ivan_ig" } });
    const seen: [string | null, string | null][] = [];
    const hook = buildWebhook(
      async (_msg, ctx) => void seen.push([ctx.dbUser.username, ctx.dbUser.firstName]),
      { ...hookOptions, client: ig },
    );
    const raw = body(event("n1", { text: "hi" }), event("n2", { text: "again" }));
    await hook.handlePost(raw, sign(raw));
    await hook.stop();
    const profileCalls = http.calls.filter((c) => c.method === "GET");
    expect(profileCalls).toHaveLength(1);
    expect(profileCalls[0]?.url.startsWith(`${GRAPH_API}/777?`)).toBe(true);
    expect(seen).toEqual([
      ["ivan_ig", "Иван Петров"],
      ["ivan_ig", "Иван Петров"],
    ]);
  });

  test("ошибка профиля не мешает обработке", async () => {
    const { client: ig } = client([], { body: { error: { message: "consent" } }, status: 400 });
    const seen: (string | null)[] = [];
    const hook = buildWebhook(async (_msg, ctx) => void seen.push(ctx.dbUser.username), {
      ...hookOptions,
      client: ig,
    });
    const raw = body(event("n1", { text: "hi" }));
    await hook.handlePost(raw, sign(raw));
    await hook.stop();
    expect(seen).toEqual([null]);
  });

  test("без App Secret — только с явным checkSignature: false", () => {
    expect(() => new InstagramWebhook(async () => {}, {})).toThrow(/IG_APP_SECRET/);
    expect(() => new InstagramWebhook(async () => {}, { checkSignature: false })).not.toThrow();
  });
});
