/**
 * <fb-social-feed> — лента постов из соцсетей (VK / Telegram / Instagram / YouTube).
 * Рендерит адаптивную сетку карточек. Данные приходят JSON-ом (из вашего бэкенда
 * или выгрузки) — клиентский прямой парсинг соцсетей невозможен из-за CORS/токенов.
 * Готовые серверные адаптеры — в sites/integrations/ (см. README рядом).
 *
 * Использование:
 *   <fb-social-feed src="/api/social-feed.json" columns="3"></fb-social-feed>
 *
 *   <fb-social-feed items='[
 *     {"network":"telegram","author":"Канал","avatar":"/i/c.png",
 *      "text":"Запустили новинку!","image":"/p/1.jpg","link":"https://t.me/x/10","date":"2026-09-10"}
 *   ]'></fb-social-feed>
 *
 * Атрибуты: src (URL JSON), items (JSON), columns (число колонок, по умолчанию авто).
 * Поле network: telegram|vk|instagram|youtube — влияет на бейдж.
 */
const FB_NET = {
  telegram: { c: "#2aabee", n: "Telegram" },
  vk: { c: "#0077ff", n: "VK" },
  instagram: { c: "#dc2743", n: "Instagram" },
  youtube: { c: "#ff0000", n: "YouTube" },
};

class FbSocialFeed extends HTMLElement {
  async connectedCallback() {
    this._cols = this.getAttribute("columns");
    this.attachShadow({ mode: "open" });
    this._renderShell();

    let items = [];
    if (this.getAttribute("src")) {
      try { items = await (await fetch(this.getAttribute("src"))).json(); }
      catch (e) { console.warn("fb-social-feed: ошибка загрузки src", e); }
    } else {
      try { items = JSON.parse(this.getAttribute("items") || "[]"); } catch {}
    }
    this._render(items);
  }

  _renderShell() {
    const colRule = this._cols
      ? `grid-template-columns: repeat(${this._cols}, 1fr);`
      : `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));`;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--fb-font, sans-serif); }
        .grid { display:grid; gap: var(--fb-gap,16px); ${colRule} }
        .card { background: var(--fb-bg,#fff); border:1px solid var(--fb-border,#e5e7eb);
                border-radius: var(--fb-radius,14px); overflow:hidden; display:flex; flex-direction:column;
                transition: transform var(--fb-transition,.25s), box-shadow var(--fb-transition,.25s); }
        .card:hover { transform: translateY(-4px); box-shadow: var(--fb-shadow,0 4px 24px rgba(0,0,0,.08)); }
        .top { display:flex; align-items:center; gap:10px; padding:14px; }
        .top img { width:40px; height:40px; border-radius:50%; object-fit:cover; }
        .who { display:flex; flex-direction:column; min-width:0; }
        .who b { color: var(--fb-text,#111); font-size:.95rem; }
        .badge { font-size:.72rem; font-weight:700; padding:2px 8px; border-radius:999px;
                 color:#fff; margin-left:auto; }
        .media img { width:100%; display:block; aspect-ratio:16/10; object-fit:cover; }
        .text { padding:14px; color:var(--fb-text,#111); font-size:.92rem; line-height:1.5; flex:1; }
        .foot { padding:0 14px 14px; }
        .foot a { color:var(--fb-accent,#4f46e5); text-decoration:none; font-weight:600; font-size:.88rem; }
        .date { color:var(--fb-text-muted,#6b7280); font-size:.78rem; }
        .empty { color:var(--fb-text-muted,#6b7280); padding:24px; text-align:center; }
      </style>
      <div class="grid"></div>
    `;
  }

  _render(items) {
    const grid = this.shadowRoot.querySelector(".grid");
    if (!items.length) { grid.innerHTML = `<div class="empty">Лента пуста.</div>`; return; }
    grid.innerHTML = items.map((p) => {
      const net = FB_NET[p.network] || { c: "#888", n: p.network || "" };
      return `
        <article class="card">
          <div class="top">
            ${p.avatar ? `<img src="${p.avatar}" alt="">` : ""}
            <div class="who">
              <b>${p.author || ""}</b>
              ${p.date ? `<span class="date">${p.date}</span>` : ""}
            </div>
            ${net.n ? `<span class="badge" style="background:${net.c}">${net.n}</span>` : ""}
          </div>
          ${p.image ? `<div class="media"><img src="${p.image}" alt="" loading="lazy"></div>` : ""}
          ${p.text ? `<div class="text">${p.text}</div>` : ""}
          ${p.link ? `<div class="foot"><a href="${p.link}" target="_blank" rel="noopener">Открыть пост →</a></div>` : ""}
        </article>`;
    }).join("");
  }
}
customElements.define("fb-social-feed", FbSocialFeed);
