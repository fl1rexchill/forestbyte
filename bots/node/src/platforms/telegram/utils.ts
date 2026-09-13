/** Мелкие помощники Telegram-платформы. */
import type { MessageEntity } from "grammy/types";

/** Полное имя пользователя Telegram — как User.full_name в aiogram. */
export function fullName(user: { first_name: string; last_name?: string | undefined }): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

/**
 * Экранировать текст для parse_mode=HTML (как html.escape(..., quote=False) в Python).
 * Любой пользовательский текст (имена, сообщения, названия) вставляем в HTML только так.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const attr = (value: string): string => escapeHtml(value).replace(/"/g, "&quot;");

function wrap(entity: MessageEntity, inner: string): string {
  switch (entity.type) {
    case "bold":
      return `<b>${inner}</b>`;
    case "italic":
      return `<i>${inner}</i>`;
    case "underline":
      return `<u>${inner}</u>`;
    case "strikethrough":
      return `<s>${inner}</s>`;
    case "spoiler":
      return `<tg-spoiler>${inner}</tg-spoiler>`;
    case "code":
      return `<code>${inner}</code>`;
    case "pre":
      return entity.language
        ? `<pre><code class="language-${attr(entity.language)}">${inner}</code></pre>`
        : `<pre>${inner}</pre>`;
    case "text_link":
      return `<a href="${attr(entity.url)}">${inner}</a>`;
    case "text_mention":
      return `<a href="tg://user?id=${entity.user.id}">${inner}</a>`;
    case "custom_emoji":
      return `<tg-emoji emoji-id="${attr(entity.custom_emoji_id)}">${inner}</tg-emoji>`;
    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;
    case "expandable_blockquote":
      return `<blockquote expandable>${inner}</blockquote>`;
    default:
      // mention, hashtag, url, bot_command, email... — Telegram распознает сам
      return inner;
  }
}

/**
 * Текст сообщения + entities → HTML (аналог Message.html_text в aiogram):
 * форматирование сохраняется, спецсимволы экранируются. Offsets — в UTF-16, как в JS-строках.
 */
export function messageHtml(text: string, entities: readonly MessageEntity[] = []): string {
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);

  const render = (start: number, end: number, list: MessageEntity[]): string => {
    let out = "";
    let pos = start;
    let i = 0;
    while (i < list.length) {
      const entity = list[i];
      if (!entity) break;
      const entityEnd = entity.offset + entity.length;
      // вложенные в entity — все следующие, начинающиеся до её конца
      const inner: MessageEntity[] = [];
      let j = i + 1;
      for (; j < list.length; j++) {
        const next = list[j];
        if (!next || next.offset >= entityEnd) break;
        inner.push(next);
      }
      out += escapeHtml(text.slice(pos, entity.offset));
      out += wrap(entity, render(entity.offset, entityEnd, inner));
      pos = entityEnd;
      i = j;
    }
    return out + escapeHtml(text.slice(pos, end));
  };

  return render(0, text.length, sorted);
}
