/**
 * <fb-footer> — современный адаптивный футер: колонки ссылок, соцсети, подписка.
 *
 * Использование:
 *   <fb-footer
 *     brand="Forestbyte"
 *     about="Делаем сайты и ботов быстро."
 *     columns='[{"title":"Компания","links":[{"text":"О нас","href":"/about"},{"text":"Блог","href":"/blog"}]},
 *               {"title":"Услуги","links":[{"text":"Сайты","href":"/web"},{"text":"Боты","href":"/bots"}]}]'
 *     socials='[{"name":"telegram","href":"https://t.me/x"},{"name":"vk","href":"https://vk.com/x"}]'
 *     newsletter
 *     copyright="© 2026 Forestbyte. Все права защищены.">
 *   </fb-footer>
 *
 * Событие: "fb-subscribe" (detail.email) при отправке формы подписки — повесь свой обработчик.
 * Иконки соцсетей: telegram, vk, instagram, youtube, whatsapp, github.
 */
const FB_ICONS = {
  telegram: '<path d="M9.8 15.6 9.6 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.6-12c.3-1.1-.4-1.6-1.1-1.3L3.4 9.9c-1.1.4-1.1 1-.2 1.3l4 1.2 9.2-5.8c.4-.3.8-.1.5.2z"/>',
  vk: '<path d="M12.8 16.3c-5 0-8-3.5-8.1-9.2h2.5c.1 4.2 2 6 3.4 6.4V7.1h2.4v3.6c1.5-.2 3-1.8 3.5-3.6h2.4c-.4 2.2-2 3.8-3.1 4.5 1.1.6 2.9 2 3.6 4.7h-2.6c-.5-1.7-1.9-3-3.8-3.2v3.2h-.6z"/>',
  instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.6 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 4 3.9 2.4 7.1 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2zm0 10.9a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6zm6.8-11.1a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>',
  youtube: '<path d="M23 12s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5c-.9.2-1.6.9-1.8 1.8C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.4-5.1-4.6-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.2.2-.4.4-.2.7.2.4.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.2.1.5.1.7-.1l.7-.9c.2-.3.5-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.6z"/>',
  github: '<path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-5a4 4 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.5 5 .3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/>',
};

class FbFooter extends HTMLElement {
  connectedCallback() {
    const brand = this.getAttribute("brand") || "";
    const about = this.getAttribute("about") || "";
    const copyright = this.getAttribute("copyright") || `© ${new Date().getFullYear()}`;
    const newsletter = this.hasAttribute("newsletter");
    const columns = this._json("columns", []);
    const socials = this._json("socials", []);

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; font-family: var(--fb-font, sans-serif);
                background: var(--fb-surface, #f5f6f8); color: var(--fb-text, #111); }
        .wrap { max-width: var(--fb-container, 1200px); margin: 0 auto; padding: 48px 20px 24px; }
        .grid { display: grid; grid-template-columns: 1.5fr repeat(auto-fit, minmax(150px, 1fr));
                gap: var(--fb-gap-lg, 32px); }
        .brand { font-weight: 800; font-size: var(--fb-fs-xl, 1.75rem); margin-bottom: 10px; }
        .about { color: var(--fb-text-muted, #6b7280); max-width: 320px; line-height: 1.5; }
        h4 { font-size: var(--fb-fs-base, 1rem); margin: 0 0 14px; }
        ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        a { color: var(--fb-text-muted, #6b7280); text-decoration: none; transition: color var(--fb-transition, .25s); }
        a:hover { color: var(--fb-accent, #4f46e5); }
        .socials { display: flex; gap: 10px; margin-top: 16px; }
        .socials a { display: grid; place-items: center; width: 40px; height: 40px;
                     border-radius: 50%; background: var(--fb-bg, #fff); border: 1px solid var(--fb-border, #e5e7eb); }
        .socials svg { width: 20px; height: 20px; fill: var(--fb-text, #111); }
        .socials a:hover { background: var(--fb-accent, #4f46e5); }
        .socials a:hover svg { fill: var(--fb-accent-contrast, #fff); }
        form { display: flex; gap: 8px; margin-top: 14px; }
        input { flex: 1; padding: 10px 12px; border: 1px solid var(--fb-border, #e5e7eb);
                border-radius: var(--fb-radius-sm, 8px); background: var(--fb-bg, #fff); color: var(--fb-text, #111); }
        button { padding: 10px 16px; border: 0; border-radius: var(--fb-radius-sm, 8px);
                 background: var(--fb-accent, #4f46e5); color: var(--fb-accent-contrast, #fff);
                 font-weight: 600; cursor: pointer; }
        .bottom { border-top: 1px solid var(--fb-border, #e5e7eb); margin-top: 40px; padding-top: 20px;
                  color: var(--fb-text-muted, #6b7280); font-size: var(--fb-fs-sm, .875rem); text-align: center; }
        @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
      </style>
      <div class="wrap">
        <div class="grid">
          <div>
            ${brand ? `<div class="brand">${brand}</div>` : ""}
            ${about ? `<div class="about">${about}</div>` : ""}
            ${socials.length ? `<div class="socials">${socials.map(s =>
              `<a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.name}">
                 <svg viewBox="0 0 24 24">${FB_ICONS[s.name] || ""}</svg></a>`).join("")}</div>` : ""}
            ${newsletter ? `
              <form id="sub">
                <input type="email" name="email" placeholder="E-mail для рассылки" required>
                <button type="submit">Подписаться</button>
              </form>` : ""}
          </div>
          ${columns.map(col => `
            <div>
              <h4>${col.title}</h4>
              <ul>${(col.links || []).map(l => `<li><a href="${l.href}">${l.text}</a></li>`).join("")}</ul>
            </div>`).join("")}
        </div>
        <div class="bottom">${copyright}</div>
      </div>
    `;

    const form = root.getElementById("sub");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = form.email.value;
        this.dispatchEvent(new CustomEvent("fb-subscribe", { detail: { email }, bubbles: true }));
        form.reset();
      });
    }
  }

  _json(attr, fallback) {
    try { return JSON.parse(this.getAttribute(attr) || ""); }
    catch { return fallback; }
  }
}
customElements.define("fb-footer", FbFooter);
