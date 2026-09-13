/**
 * Платформа Instagram (Instagram API with Instagram Login, Graph API v26.0) —
 * зеркало bots/python/platforms/instagram.
 *
 * Нужны профессиональный аккаунт Instagram и Meta App с разрешениями
 * instagram_business_basic, instagram_business_manage_messages. Входящие — вебхуком
 * (HTTPS), ответы — POST в Graph API. Подробно — README.md рядом.
 */
export {
  DEFAULT_PROFILE_FIELDS,
  GRAPH_API,
  GRAPH_API_VERSION,
  InstagramClient,
  type InstagramClientOptions,
  type QuickReply,
} from "./client.js";
export {
  type BuildWebhookOptions,
  buildWebhook,
  type InstagramContext,
  type InstagramHandler,
  makeDispatcher,
  type RunWebhookOptions,
  runWebhook,
  toExternalId,
} from "./runner.js";
export {
  type IncomingMessage,
  InstagramWebhook,
  type InstagramWebhookOptions,
  type MessageHandler,
  parseEvents,
  SIGNATURE_HEADER,
  verifyChallenge,
  verifySignature,
} from "./webhook.js";
