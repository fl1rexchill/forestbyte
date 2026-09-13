/**
 * Платформа MAX (мессенджер max.ru, Bot API) — зеркало bots/python/platforms/max.
 *
 * Базовый URL https://platform-api2.max.ru, токен — заголовок `Authorization: <token>`.
 * Long polling (GET /updates) — для разработки, webhook (POST /subscriptions) — для продакшена.
 * Подробно — README.md рядом.
 */
export {
  type Attachment,
  BASE_URL,
  type Button,
  callbackButton,
  DEFAULT_RETRY_DELAYS_MS,
  inlineKeyboard,
  linkButton,
  MaxClient,
  type MaxClientOptions,
  MaxUploadError,
  messageButton,
  type SendMessageOptions,
  UPLOAD_TYPES,
  type UploadType,
} from "./client.js";
export {
  type BuildWebhookOptions,
  buildWebhook,
  type MaxContext,
  type MaxHandler,
  makeDispatcher,
  type RunPollingOptions,
  type RunWebhookOptions,
  runPolling,
  runWebhook,
} from "./runner.js";
export {
  dedupKey,
  HANDLED_TYPES,
  type MaxUpdate,
  MaxWebhook,
  type MaxWebhookOptions,
  orderKey,
  parseUpdate,
  parseUpdates,
  SECRET_HEADER,
  type UpdateHandler,
  verifySecret,
} from "./webhook.js";
