/** Общие помощники тестов: чистая БД, подменённый Telegram API, конструкторы апдейтов. */
import type { Bot } from "grammy";
import type { Chat, Update, User, UserFromGetMe } from "grammy/types";
import { disposeDb, initDb } from "../src/core/db/index.js";
import type { BotContext } from "../src/platforms/telegram/index.js";

/** Новая in-memory БД (dispose закрывает соединение — данные исчезают). */
export async function resetDb(): Promise<void> {
  await disposeDb();
  await initDb();
}

export const BOT_INFO: UserFromGetMe = {
  id: 42,
  is_bot: true,
  first_name: "Bot",
  username: "test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as UserFromGetMe;

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

type Override = (payload: Record<string, unknown>) => unknown;

/**
 * Перехватывает все вызовы Bot API (в сеть ничего не уходит) и возвращает журнал.
 * Перехватчик ставится последним, поэтому видит payload ДО трансформера parse_mode.
 */
export function attachFakeApi(
  bot: Bot<BotContext>,
  overrides: Record<string, Override> = {},
): ApiCall[] {
  bot.botInfo = BOT_INFO;
  const calls: ApiCall[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    calls.push({ method, payload: p });
    const override = overrides[method];
    const result = override
      ? override(p)
      : method.startsWith("send")
        ? { message_id: 1000 + calls.length, date: 0, chat: { id: p.chat_id, type: "private" } }
        : true;
    return { ok: true, result } as never;
  });
  return calls;
}

let seq = 1;

export const user = (id: number, firstName: string, extra: Partial<User> = {}): User => ({
  id,
  is_bot: false,
  first_name: firstName,
  ...extra,
});

export const privateChat = (u: User): Chat.PrivateChat => ({
  id: u.id,
  type: "private",
  first_name: u.first_name,
});

export const groupChat: Chat.SupergroupChat = { id: -100500, type: "supergroup", title: "Group" };

/** Апдейт с сообщением; команды получают entity bot_command автоматически. */
export function messageUpdate(
  from: User,
  text: string,
  chat: Chat = privateChat(from),
  extra: Record<string, unknown> = {},
): Update {
  seq += 1;
  const command = text.startsWith("/") ? (text.split(/\s/)[0] ?? "") : "";
  return {
    update_id: seq,
    message: {
      message_id: seq,
      date: Math.floor(Date.now() / 1000),
      chat,
      from,
      text,
      ...(command
        ? { entities: [{ type: "bot_command", offset: 0, length: command.length }] }
        : {}),
      ...extra,
    },
  } as Update;
}

/** Апдейт с произвольным сообщением (successful_payment, new_chat_members...). */
export function rawMessageUpdate(from: User, chat: Chat, fields: Record<string, unknown>): Update {
  seq += 1;
  return {
    update_id: seq,
    message: { message_id: seq, date: Math.floor(Date.now() / 1000), chat, from, ...fields },
  } as Update;
}

export function callbackUpdate(from: User, data: string, chat: Chat = privateChat(from)): Update {
  seq += 1;
  return {
    update_id: seq,
    callback_query: {
      id: String(seq),
      from,
      chat_instance: "ci",
      data,
      message: { message_id: 1, date: 0, chat, from: BOT_INFO, text: "..." },
    },
  } as Update;
}

export function preCheckoutUpdate(from: User, payload: string, amount: number): Update {
  seq += 1;
  return {
    update_id: seq,
    pre_checkout_query: {
      id: String(seq),
      from,
      currency: "XTR",
      total_amount: amount,
      invoice_payload: payload,
    },
  } as Update;
}

/** Тексты всех отправленных сообщений (sendMessage / editMessageText). */
export const sentTexts = (calls: ApiCall[]): string[] =>
  calls
    .filter((c) => c.method === "sendMessage" || c.method === "editMessageText")
    .map((c) => String(c.payload.text));
