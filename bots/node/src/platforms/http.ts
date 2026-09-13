/**
 * Общие HTTP-помощники платформ Instagram и MAX: тип fetch для клиентов, безопасный
 * разбор JSON и минимальный сервер вебхука на node:http (без внешних зависимостей).
 */
import {
  createServer,
  type IncomingMessage as HttpRequest,
  type IncomingHttpHeaders,
  type Server,
} from "node:http";
import { getLogger } from "../core/logger.js";

const log = getLogger("platforms.http");

/** Совместимая с глобальным fetch функция — в тестах подменяется. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type JsonObject = Record<string, unknown>;

/** Глобальный fetch как FetchLike (без привязки this). */
export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/** Прочитать ответ как JSON-объект; не-JSON или массив → { data: ... }. */
export async function readJson(res: Response): Promise<JsonObject> {
  const text = await res.text();
  try {
    const data: unknown = JSON.parse(text);
    return isObject(data) ? data : { data };
  } catch {
    return { data: text };
  }
}

// --------------------------------------------------------------------------- разбор JSON

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asObject = (value: unknown): JsonObject => (isObject(value) ? value : {});

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
};

export const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// --------------------------------------------------------------------------- сервер вебхука

/** Ответ эндпоинта вебхука. */
export interface HttpResult {
  status: number;
  body: string;
  contentType?: string;
}

export interface WebhookRoutes {
  path: string;
  onGet?: (query: URLSearchParams) => HttpResult;
  onPost: (body: Buffer, headers: IncomingHttpHeaders) => Promise<HttpResult>;
}

const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Значение заголовка (node:http отдаёт имена в нижнем регистре). */
export function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readBody(req: HttpRequest, limit = MAX_BODY_BYTES): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("end", () => resolve(tooLarge ? null : Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Поднять HTTP-сервер вебхука на host:port. Снаружи нужен HTTPS (reverse-proxy). */
export async function listenWebhook(
  routes: WebhookRoutes,
  { host = "0.0.0.0", port = 8080 }: { host?: string; port?: number } = {},
): Promise<Server> {
  const server = createServer((req, res) => {
    const send = (result: HttpResult): void => {
      res.statusCode = result.status;
      res.setHeader("Content-Type", result.contentType ?? "text/plain; charset=utf-8");
      res.end(result.body);
    };
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== routes.path) {
      send({ status: 404, body: "not found" });
      return;
    }
    if (req.method === "GET" && routes.onGet) {
      send(routes.onGet(url.searchParams));
      return;
    }
    if (req.method !== "POST") {
      send({ status: 405, body: "method not allowed" });
      return;
    }
    readBody(req)
      .then(async (body) => {
        send(
          body === null
            ? { status: 413, body: "payload too large" }
            : await routes.onPost(body, req.headers),
        );
      })
      .catch((err: unknown) => {
        log.error("Webhook request failed: %s", err);
        if (!res.headersSent) send({ status: 500, body: "error" });
      });
  });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  return server;
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/** Промис, который резолвится по Ctrl+C / SIGTERM. */
export function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
