/** Подменный fetch для клиентов платформ: без сети, с журналом запросов. */
import type { FetchLike } from "../src/platforms/http.js";

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeResponse {
  body: unknown;
  status?: number;
}

/** Ответы берутся по очереди из responses, потом — fallback. */
export function fakeFetch(
  responses: FakeResponse[] = [],
  fallback: FakeResponse = { body: {} },
): { fetch: FetchLike; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const fetch: FetchLike = async (input, init = {}) => {
    calls.push({
      url: input,
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body,
    });
    const next = queue.shift() ?? fallback;
    const text = typeof next.body === "string" ? next.body : JSON.stringify(next.body);
    return new Response(text, { status: next.status ?? 200 });
  };
  return { fetch, calls };
}

/** JSON-тело запроса. */
export const jsonBody = (call: FetchCall | undefined): unknown =>
  typeof call?.body === "string" ? JSON.parse(call.body) : undefined;

/** Query-параметры запроса. */
export const query = (call: FetchCall | undefined): Record<string, string> =>
  Object.fromEntries(new URL(call?.url ?? "http://x").searchParams);
