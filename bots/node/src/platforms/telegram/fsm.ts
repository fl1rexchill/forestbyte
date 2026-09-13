/**
 * «FSM» поверх grammY-сессии — аналог aiogram FSMContext.
 *
 * Состояние — строка вида "BroadcastStates:waiting_text" (как у aiogram State),
 * данные — объект в ctx.session.data. clearState сбрасывает и то, и другое (state.clear()).
 *
 * Фильтр по состоянию ставь ПОСЛЕ сужения по типу апдейта (там всегда есть chat/from):
 *   composer.on("message:text").filter(inState(States.waitingText), handler);
 */
import type { BotContext } from "./bot.js";

export function setState(ctx: BotContext, state: string): void {
  ctx.session.state = state;
}

export function getState(ctx: BotContext): string | undefined {
  return ctx.session.state;
}

export function clearState(ctx: BotContext): void {
  ctx.session.state = undefined;
  ctx.session.data = {};
}

export function getData(ctx: BotContext): Record<string, unknown> {
  return ctx.session.data;
}

export function updateData(ctx: BotContext, patch: Record<string, unknown>): void {
  ctx.session.data = { ...ctx.session.data, ...patch };
}

/** Предикат для composer.filter: текущее состояние равно state. */
export const inState =
  (state: string) =>
  (ctx: BotContext): boolean =>
    ctx.session.state === state;

/**
 * Как inState, но пропускает команды (/cancel и т.п.) — их обработают другие модули.
 * Для хендлеров «ждём текст от пользователя».
 */
export const inStateText =
  (state: string) =>
  (ctx: BotContext): boolean =>
    ctx.session.state === state && !(ctx.message?.text ?? "").startsWith("/");
