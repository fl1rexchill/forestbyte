/**
 * HTTP-клиент MAX Bot API — зеркало bots/python/platforms/max/client.py.
 *
 * Сверено с https://dev.max.ru/docs-api (2026-09):
 *  - базовый URL https://platform-api2.max.ru; авторизация — заголовок `Authorization: <token>`;
 *  - отправка: POST /messages?chat_id=... | ?user_id=...  body: {text, attachments, format, notify};
 *  - long polling: GET /updates?marker=&timeout=&limit=&types= → {updates, marker};
 *  - webhook: POST /subscriptions {url, update_types, secret}; DELETE /subscriptions?url=;
 *  - ответ на нажатие кнопки: POST /answers?callback_id=... body: {message?, notification?};
 *  - файлы: POST /uploads?type=image|video|audio|file → {url, token?}; сам файл — multipart
 *    (поле data) на полученный url. Вложение: image/file — ответ загрузки, video/audio —
 *    {token} из первого шага. Сразу после загрузки возможна ошибка attachment.not.ready —
 *    отправка повторяется с растущей паузой.
 *  - лимиты: 30 rps, не более 2 сообщений в секунду в один чат, текст до 4000 символов.
 *
 * Ошибки API не бросаются — логируются и возвращаются ({code, message}). Исключение —
 * upload(): без url/token вложение не собрать, поэтому MaxUploadError.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { settings } from "../../core/config.js";
import { getLogger } from "../../core/logger.js";
import { defaultFetch, type FetchLike, isObject, type JsonObject, readJson } from "../http.js";

const log = getLogger("platforms.max.client");

export const BASE_URL = "https://platform-api2.max.ru";

export const TEXT_MAX_LEN = 4000;
export const KEYBOARD_MAX_ROWS = 30;
export const KEYBOARD_MAX_BUTTONS = 210;
export const KEYBOARD_MAX_IN_ROW = 7; // до 3 для link/open_app/request_*
const WIDE_BUTTONS = new Set(["link", "open_app", "request_geo_location", "request_contact"]);

export const UPLOAD_TYPES = ["image", "video", "audio", "file"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];
export const NOT_READY_CODE = "attachment.not.ready";
/** Паузы (мс) между повторами отправки, пока вложение обрабатывается. */
export const DEFAULT_RETRY_DELAYS_MS = [500, 1000, 2000, 4000] as const;

export type Button = { type: string; text: string } & JsonObject;
export type Attachment = { type: string; payload: JsonObject };
export type FileSource = Uint8Array | string;

export class MaxUploadError extends Error {
  override name = "MaxUploadError";
}

// --------------------------------------------------------------------------- кнопки

/** Кнопка, нажатие которой приходит событием message_callback. */
export const callbackButton = (text: string, payload: string): Button => ({
  type: "callback",
  text,
  payload,
});

/** Кнопка-ссылка (URL до 2048 символов). */
export const linkButton = (text: string, url: string): Button => ({ type: "link", text, url });

/** Кнопка, отправляющая боту свой текст как обычное сообщение. */
export const messageButton = (text: string): Button => ({ type: "message", text });

/** Вложение inline_keyboard из рядов кнопок. */
export function inlineKeyboard(buttons: readonly (readonly Button[])[]): Attachment {
  const rows = buttons.map((row) => [...row]);
  const total = rows.reduce((sum, row) => sum + row.length, 0);
  if (rows.length > KEYBOARD_MAX_ROWS || total > KEYBOARD_MAX_BUTTONS) {
    log.warn("MAX: клавиатура превышает лимиты (%s рядов, %s кнопок)", rows.length, total);
  }
  for (const row of rows) {
    const limit = row.some((b) => WIDE_BUTTONS.has(b.type)) ? 3 : KEYBOARD_MAX_IN_ROW;
    if (row.length > limit) log.warn("MAX: в ряду %s кнопок, допустимо %s", row.length, limit);
  }
  return { type: "inline_keyboard", payload: { buttons: rows } };
}

// --------------------------------------------------------------------------- клиент

export interface MaxClientOptions {
  token?: string | undefined;
  baseUrl?: string;
  fetch?: FetchLike;
  /** Паузы между повторами при attachment.not.ready (мс) */
  retryDelaysMs?: readonly number[];
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface SendMessageOptions {
  userId?: number;
  attachments?: Attachment[];
  format?: "markdown" | "html";
  notify?: boolean;
  disableLinkPreview?: boolean;
}

export class MaxClient {
  readonly token: string;
  readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly retryDelaysMs: readonly number[];

  constructor(options: MaxClientOptions = {}) {
    this.token = options.token ?? settings.maxBotToken ?? "";
    this.baseUrl = (options.baseUrl ?? BASE_URL).replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? defaultFetch;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    if (!this.token) log.warn("MAX_BOT_TOKEN не задан — MAX-клиент не сможет слать сообщения");
  }

  private async request(
    method: "GET" | "POST" | "DELETE",
    apiPath: string,
    {
      params = {},
      json,
      timeoutMs,
      signal,
    }: {
      params?: Query;
      json?: JsonObject;
      timeoutMs?: number;
      signal?: AbortSignal | undefined;
    } = {},
  ): Promise<JsonObject> {
    const url = new URL(`${this.baseUrl}/${apiPath.replace(/^\/+/, "")}`);
    // null/undefined не отправляем; boolean → "true"/"false"
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { Authorization: this.token };
    if (json) headers["Content-Type"] = "application/json";
    const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter(
      (s): s is AbortSignal => s !== undefined,
    );

    const res = await this.fetchFn(url.toString(), {
      method,
      headers,
      ...(json ? { body: JSON.stringify(json) } : {}),
      ...(signals.length ? { signal: AbortSignal.any(signals) } : {}),
    });
    const data = await readJson(res);
    if (res.status >= 400)
      log.error("MAX API error %s on %s %s: %j", res.status, method, apiPath, data);
    return data;
  }

  // ------------------------------------------------------------------ бот

  /** Информация о боте: {user_id, first_name, username, is_bot, ...}. */
  getMe(): Promise<JsonObject> {
    return this.request("GET", "me");
  }

  // ------------------------------------------------------------------ сообщения

  /**
   * POST /messages. Нужен chatId (чат/канал/диалог) или options.userId.
   * Если вложение ещё обрабатывается (attachment.not.ready) — повтор с паузами.
   */
  async sendMessage(
    chatId: number | null,
    text: string | null,
    options: SendMessageOptions = {},
  ): Promise<JsonObject> {
    if (chatId === null && options.userId === undefined) {
      throw new Error("MAX: нужен chatId или userId");
    }
    if (text && text.length > TEXT_MAX_LEN) {
      log.warn("MAX: текст длиннее %s символов, API может отклонить", TEXT_MAX_LEN);
    }
    const body: JsonObject = { text };
    if (options.attachments) body.attachments = options.attachments;
    if (options.format) body.format = options.format;
    if (options.notify !== undefined) body.notify = options.notify;
    const params: Query = {
      chat_id: chatId,
      user_id: options.userId,
      disable_link_preview: options.disableLinkPreview,
    };

    let data = await this.request("POST", "messages", { params, json: body });
    if (options.attachments?.length) {
      for (const pause of this.retryDelaysMs) {
        if (data.code !== NOT_READY_CODE) break;
        log.info("MAX: вложение ещё обрабатывается, повтор через %s мс", pause);
        await delay(pause);
        data = await this.request("POST", "messages", { params, json: body });
      }
    }
    return data;
  }

  /** Текстовое сообщение в чат (chatId) или пользователю (userId). */
  sendText(chatId: number | null, text: string, options: { userId?: number } = {}) {
    return this.sendMessage(chatId, text, options);
  }

  /** Сообщение с inline-клавиатурой: [[callbackButton("Да", "yes"), ...]]. */
  sendKeyboard(
    chatId: number | null,
    text: string,
    buttons: readonly (readonly Button[])[],
    options: { userId?: number } = {},
  ) {
    return this.sendMessage(chatId, text, { ...options, attachments: [inlineKeyboard(buttons)] });
  }

  /** Ответ на нажатие callback-кнопки: уведомление и/или новое сообщение (NewMessageBody). */
  answerCallback(
    callbackId: string,
    { notification, message }: { notification?: string; message?: JsonObject } = {},
  ): Promise<JsonObject> {
    // TODO-VERIFY: поле "notification" есть в официальном Go-клиенте, но в таблице
    // «Тело запроса» POST /answers указано только "message".
    const body: JsonObject = {};
    if (message) body.message = message;
    if (notification !== undefined) body.notification = notification;
    return this.request("POST", "answers", { params: { callback_id: callbackId }, json: body });
  }

  // ------------------------------------------------------------------ файлы

  /** POST /uploads?type=... → {url, token?} (token приходит для video/audio). */
  getUploadUrl(type: UploadType): Promise<JsonObject> {
    if (!UPLOAD_TYPES.includes(type)) {
      throw new Error(`MAX: тип загрузки должен быть одним из ${UPLOAD_TYPES.join(", ")}`);
    }
    return this.request("POST", "uploads", { params: { type } });
  }

  /**
   * Загрузить файл (байты или путь) и вернуть готовое вложение {type, payload}.
   * Вложение можно переиспользовать (документация советует загружать частые файлы заранее).
   */
  async upload(
    type: UploadType,
    file: FileSource,
    { filename }: { filename?: string } = {},
  ): Promise<Attachment> {
    let content: Uint8Array;
    let name = filename;
    if (typeof file === "string") {
      content = await readFile(file);
      name ??= path.basename(file);
    } else {
      content = file;
    }

    const target = await this.getUploadUrl(type);
    const url = typeof target.url === "string" ? target.url : null;
    if (!url) throw new MaxUploadError(`MAX /uploads не вернул url: ${JSON.stringify(target)}`);

    // Multipart на хост загрузки; токен бота туда не передаём
    const form = new FormData();
    form.append("data", new Blob([content]), name ?? type);
    const res = await this.fetchFn(url, { method: "POST", body: form });
    const result = await readJson(res); // video/audio могут ответить не JSON (retval)
    if (res.status >= 400) {
      throw new MaxUploadError(`MAX upload HTTP ${res.status}: ${JSON.stringify(result)}`);
    }

    if (type === "video" || type === "audio") {
      const token = typeof target.token === "string" ? target.token : null;
      if (!token) throw new MaxUploadError(`MAX /uploads не вернул token для ${type}`);
      return { type, payload: { token } };
    }
    if (!isObject(result) || "data" in result || Object.keys(result).length === 0) {
      throw new MaxUploadError(`MAX upload: неожиданный ответ ${JSON.stringify(result)}`);
    }
    return { type, payload: result };
  }

  /** Загрузить файл и отправить одним сообщением (с подписью text). */
  async sendFile(
    chatId: number | null,
    file: FileSource,
    type: UploadType = "file",
    options: { text?: string; userId?: number; filename?: string } = {},
  ): Promise<JsonObject> {
    const attachment = await this.upload(
      type,
      file,
      options.filename ? { filename: options.filename } : {},
    );
    return this.sendMessage(chatId, options.text ?? null, {
      ...(options.userId !== undefined ? { userId: options.userId } : {}),
      attachments: [attachment],
    });
  }

  // ------------------------------------------------------------------ обновления

  /**
   * Long polling: {updates: [...], marker}. marker=null → только последнее обновление.
   * Не работает при активной webhook-подписке; для продакшена MAX рекомендует webhook.
   */
  getUpdates(
    marker: number | null,
    {
      timeout = 30,
      limit = 100,
      types,
      signal,
    }: { timeout?: number; limit?: number; types?: readonly string[]; signal?: AbortSignal } = {},
  ): Promise<JsonObject> {
    return this.request("GET", "updates", {
      params: { marker, timeout, limit, types: types?.length ? types.join(",") : null },
      // HTTP-таймаут с запасом поверх серверного long-poll таймаута
      timeoutMs: (timeout + 15) * 1000,
      signal,
    });
  }

  /** Подписать бота на webhook (HTTPS, порт 443). secret придёт в X-Max-Bot-Api-Secret. */
  subscribe(
    url: string,
    { updateTypes, secret }: { updateTypes?: readonly string[]; secret?: string | undefined } = {},
  ): Promise<JsonObject> {
    const body: JsonObject = { url };
    if (updateTypes?.length) body.update_types = [...updateTypes];
    if (secret) body.secret = secret;
    return this.request("POST", "subscriptions", { json: body });
  }

  /** Отписать webhook (после этого снова работает long polling). */
  unsubscribe(url: string): Promise<JsonObject> {
    return this.request("DELETE", "subscriptions", { params: { url } });
  }

  /** Список активных webhook-подписок: {subscriptions: [...]}. */
  getSubscriptions(): Promise<JsonObject> {
    return this.request("GET", "subscriptions");
  }
}
