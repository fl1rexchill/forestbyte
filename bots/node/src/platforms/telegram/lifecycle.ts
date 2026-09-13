/**
 * Хуки жизненного цикла бота — аналог dp.startup / dp.shutdown в aiogram.
 * runPolling / runWebhook вызывают их после старта и перед остановкой.
 *
 *   onStartup(bot, (b) => { stop = startLoop(b.api); });
 *   onShutdown(bot, () => stop());
 */
import type { Bot } from "grammy";
import type { BotContext } from "./bot.js";

export type LifecycleHook = (bot: Bot<BotContext>) => void | Promise<void>;

const startupHooks = new WeakMap<Bot<BotContext>, LifecycleHook[]>();
const shutdownHooks = new WeakMap<Bot<BotContext>, LifecycleHook[]>();

function add(
  map: WeakMap<Bot<BotContext>, LifecycleHook[]>,
  bot: Bot<BotContext>,
  hook: LifecycleHook,
) {
  const hooks = map.get(bot) ?? [];
  hooks.push(hook);
  map.set(bot, hooks);
}

export function onStartup(bot: Bot<BotContext>, hook: LifecycleHook): void {
  add(startupHooks, bot, hook);
}

export function onShutdown(bot: Bot<BotContext>, hook: LifecycleHook): void {
  add(shutdownHooks, bot, hook);
}

export async function runStartupHooks(bot: Bot<BotContext>): Promise<void> {
  for (const hook of startupHooks.get(bot) ?? []) await hook(bot);
}

export async function runShutdownHooks(bot: Bot<BotContext>): Promise<void> {
  for (const hook of shutdownHooks.get(bot) ?? []) await hook(bot);
}
