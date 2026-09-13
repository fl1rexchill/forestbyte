/**
 * HTTP-клиент Instagram API with Instagram Login (Messaging) —
 * зеркало bots/python/platforms/instagram/client.py.
 *
 * Сверено с официальной документацией Meta (2026-09):
 *  - версия Graph API: v26.0; хост graph.instagram.com (Business Login for Instagram);
 *  - отправка: POST /<IG_ID>/messages или /me/messages,
 *    заголовок Authorization: Bearer <INSTAGRAM_USER_ACCESS_TOKEN>
 *    https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
 *
 * Ошибки API не бросаются исключением — логируются, ответ (с ключом "error") возвращается.
 */
import { settings } from "../../core/config.js";
import { getLogger } from "../../core/logger.js";
import { defaultFetch, type FetchLike, type JsonObject, readJson } from "../http.js";

const log = getLogger("platforms.instagram.client");

export const GRAPH_API_VERSION = "v26.0";
export const GRAPH_HOST = "https://graph.instagram.com";
export const GRAPH_API = `${GRAPH_HOST}/${GRAPH_API_VERSION}`;

// Лимиты из документации
export const TEXT_MAX_BYTES = 1000; // текст сообщения: UTF-8, не более 1000 байт
export const QUICK_REPLIES_MAX = 13; // не более 13 кнопок быстрых ответов
export const QUICK_REPLY_TITLE_MAX = 20; // заголовок кнопки обрезается после 20 символов

/** Поля User Profile API (GET /<IGSID>?fields=...). */
export const DEFAULT_PROFILE_FIELDS = [
  "name",
  "username",
  "profile_pic",
  "follower_count",
  "is_user_follow_business",
  "is_business_follow_user",
] as const;

/** Быстрый ответ: [title, payload] или готовый объект (content_type user_email/user_phone_number). */
export type QuickReply =
  | readonly [title: string, payload: string]
  | { content_type: string; title?: string; payload?: string };

export interface InstagramClientOptions {
  accessToken?: string | undefined;
  /** ID профессионального аккаунта (<IG_ID>) или "me" — оба варианта в документации */
  igUserId?: string;
  /** Для Facebook Login / Page token: https://graph.facebook.com/v26.0 (не проверено) */
  apiBase?: string;
  fetch?: FetchLike;
}

export class InstagramClient {
  readonly accessToken: string;
  readonly igUserId: string;
  readonly apiBase: string;
  private readonly fetchFn: FetchLike;

  constructor(options: InstagramClientOptions = {}) {
    this.accessToken = options.accessToken ?? settings.igAccessToken ?? "";
    this.igUserId = options.igUserId ?? "me";
    this.apiBase = (options.apiBase ?? GRAPH_API).replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? defaultFetch;
    if (!this.accessToken) {
      log.warn("IG_ACCESS_TOKEN не задан — Instagram-клиент не сможет слать сообщения");
    }
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    {
      json,
      params = {},
      bearer = true,
    }: { json?: JsonObject; params?: Record<string, string>; bearer?: boolean } = {},
  ): Promise<JsonObject> {
    const url = new URL(`${this.apiBase}/${path.replace(/^\/+/, "")}`);
    const headers: Record<string, string> = {};
    const query = { ...params };
    if (bearer) headers.Authorization = `Bearer ${this.accessToken}`;
    else query.access_token = this.accessToken;
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    if (json) headers["Content-Type"] = "application/json";

    const res = await this.fetchFn(url.toString(), {
      method,
      headers,
      ...(json ? { body: JSON.stringify(json) } : {}),
    });
    const data = await readJson(res);
    if (res.status >= 400) {
      log.error("IG API error %s on %s %s: %j", res.status, method, path, data);
    }
    return data;
  }

  private send(payload: JsonObject): Promise<JsonObject> {
    return this.request("POST", `${this.igUserId}/messages`, { json: payload });
  }

  /** Отправить текст (recipientId = IGSID). Успех: {"recipient_id", "message_id"}. */
  sendText(recipientId: string, text: string): Promise<JsonObject> {
    if (Buffer.byteLength(text) > TEXT_MAX_BYTES) {
      log.warn("IG: текст длиннее %s байт, API может отклонить", TEXT_MAX_BYTES);
    }
    return this.send({ recipient: { id: recipientId }, message: { text } });
  }

  /** Отправить картинку по URL (png/jpeg, до 8 МБ). */
  sendImage(recipientId: string, imageUrl: string): Promise<JsonObject> {
    // TODO-VERIFY: в примере «одна картинка» документация показывает "attachments" как объект,
    // в примере «коллекция» — как массив (до 10 шт.). Используем массив из одного элемента.
    // Страница: .../messaging-api/ → "Send Images".
    return this.send({
      recipient: { id: recipientId },
      message: { attachments: [{ type: "image", payload: { url: imageUrl } }] },
    });
  }

  /** Текст с кнопками быстрых ответов (до 13 шт., заголовок до 20 символов). */
  sendQuickReplies(
    recipientId: string,
    text: string,
    replies: readonly QuickReply[],
  ): Promise<JsonObject> {
    if (replies.length > QUICK_REPLIES_MAX) {
      log.warn("IG: кнопок больше %s — лишние отброшены", QUICK_REPLIES_MAX);
    }
    const items = replies.slice(0, QUICK_REPLIES_MAX).map((reply) =>
      Array.isArray(reply)
        ? {
            content_type: "text",
            title: String(reply[0]).slice(0, QUICK_REPLY_TITLE_MAX),
            payload: reply[1],
          }
        : reply,
    );
    return this.send({ recipient: { id: recipientId }, message: { text, quick_replies: items } });
  }

  /** Отметить последнее сообщение пользователя прочитанным (sender_action=mark_seen). */
  markSeen(recipientId: string): Promise<JsonObject> {
    // TODO-VERIFY: пример mark_seen на странице Sender actions ошибочно содержит "typing_on"
    // и хост graph.facebook.com. Используем graph.instagram.com + Bearer, как для /messages.
    return this.send({ recipient: { id: recipientId }, sender_action: "mark_seen" });
  }

  /**
   * Профиль пользователя по IGSID (User Profile API). Доступен только после того,
   * как пользователь сам написал аккаунту (user consent).
   */
  getUserProfile(
    igsid: string,
    fields: readonly string[] = DEFAULT_PROFILE_FIELDS,
  ): Promise<JsonObject> {
    // Документация User Profile API показывает access_token в query-параметре
    return this.request("GET", igsid, { params: { fields: fields.join(",") }, bearer: false });
  }
}
