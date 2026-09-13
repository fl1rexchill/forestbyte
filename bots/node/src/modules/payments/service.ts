/**
 * Помощники для выставления счетов (invoices).
 *
 * Поддерживает два режима:
 *  - Telegram Stars: currency="XTR", provider_token="" (пустой), amount = число звёзд;
 *  - Провайдер (ЮKassa/Stripe и т.п.): currency="RUB"/"USD", provider_token из BotFather,
 *    amount в минимальных единицах (копейки/центы).
 */
import type { Api } from "grammy";

/** Всё, что нужно от Bot API (ctx.api / bot.api подходят). */
export type InvoiceApi = Pick<Api, "sendInvoice">;

export interface StarsInvoice {
  title: string;
  description: string;
  payload: string;
  stars: number;
}

/** Счёт в Telegram Stars (XTR). provider_token не нужен. */
export async function sendStarsInvoice(
  api: InvoiceApi,
  chatId: number,
  { title, description, payload, stars }: StarsInvoice,
): Promise<void> {
  await api.sendInvoice(
    chatId,
    title,
    description,
    payload,
    "XTR",
    [{ label: title, amount: stars }],
    {
      provider_token: "", // для Stars — пустая строка
    },
  );
}

export interface ProviderInvoice {
  title: string;
  description: string;
  payload: string;
  providerToken: string;
  currency: string;
  /** сумма в минимальных единицах (например, 19900 = 199.00 RUB) */
  amountMinor: number;
}

/** Счёт через платёжного провайдера (валюта RUB/USD и т.д.). */
export async function sendProviderInvoice(
  api: InvoiceApi,
  chatId: number,
  { title, description, payload, providerToken, currency, amountMinor }: ProviderInvoice,
): Promise<void> {
  await api.sendInvoice(
    chatId,
    title,
    description,
    payload,
    currency,
    [{ label: title, amount: amountMinor }],
    { provider_token: providerToken },
  );
}
