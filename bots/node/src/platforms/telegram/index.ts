/** Платформа Telegram (grammY). */
export {
  type BotContext,
  createBot,
  createComposer,
  type FsmData,
  hasUser,
  sessionKey,
  type UserContext,
} from "./bot.js";
export {
  clearState,
  getData,
  getState,
  inState,
  inStateText,
  setState,
  updateData,
} from "./fsm.js";
export {
  type LifecycleHook,
  onShutdown,
  onStartup,
  runShutdownHooks,
  runStartupHooks,
} from "./lifecycle.js";
export { runPolling, runWebhook, type WebhookOptions } from "./runner.js";
export { escapeHtml, fullName, messageHtml } from "./utils.js";
