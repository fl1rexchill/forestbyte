/**
 * <fb-faq> — аккордеон «вопрос-ответ» с плавным раскрытием (anime.js).
 *
 * Использование:
 *   <fb-faq single items='[
 *     {"q":"Сколько стоит сайт?","a":"От 30 000 ₽ в зависимости от задач."},
 *     {"q":"Какие сроки?","a":"Обычно 1–2 недели."}
 *   ]'></fb-faq>
 *
 *   <!-- или из файла: --> <fb-faq src="/data/faq.json"></fb-faq>
 *
 * Атрибуты: items (JSON), src (URL JSON), single (открыт только один пункт).
 * Темизация: --fb-accent, --fb-bg, --fb-surface, --fb-border, --fb-radius, --fb-text.
 * Ответы поддерживают HTML.
 */
import { loadAnime, prefersReducedMotion } from "../shared/anim.js";

class FbFaq extends HTMLElement {
  async connectedCallback() {
    this._single = this.hasAttribute("single");
    this.attachShadow({ mode: "open" });
    this._renderShell();

    let items = [];
    if (this.getAttribute("src")) {
      try { items = await (await fetch(this.getAttribute("src"))).json(); } catch {}
    } else {
      try { items = JSON.parse(this.getAttribute("items") || "[]"); } catch {}
    }
    this._render(items);
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--fb-font, sans-serif); }
        .item { border:1px solid var(--fb-border,#e4e8e8); border-radius: var(--fb-radius,16px);
                background: var(--fb-bg,#fff); margin-bottom: 12px; overflow:hidden;
                transition: box-shadow var(--fb-transition,.25s); }
        .item[open] { box-shadow: var(--fb-shadow,0 6px 24px rgba(20,30,30,.08)); }
        .q { display:flex; align-items:center; gap:14px; width:100%; text-align:left;
             padding:18px 20px; background:none; border:0; cursor:pointer;
             font-family:inherit; font-size:var(--fb-fs-lg,1.15rem); font-weight:600;
             color: var(--fb-text,#111); }
        .q:hover { color: var(--fb-accent,#0ea5a4); }
        .icon { margin-left:auto; flex:0 0 auto; width:26px; height:26px; border-radius:50%;
                display:grid; place-items:center; background: var(--fb-surface,#f4f6f7);
                transition: transform var(--fb-transition,.25s), background var(--fb-transition,.25s); }
        .item[open] .icon { transform: rotate(45deg); background: var(--fb-accent,#0ea5a4); }
        .icon svg { width:14px; height:14px; stroke: var(--fb-text,#111); stroke-width:2.5; }
        .item[open] .icon svg { stroke: var(--fb-accent-contrast,#fff); }
        .panel { height:0; overflow:hidden; }
        .a { padding:0 20px 20px; color: var(--fb-text-muted,#5f6b69); line-height:1.6; }
        .a a { color: var(--fb-accent,#0ea5a4); }
      </style>
      <div class="list"></div>
    `;
  }

  _render(items) {
    const list = this.shadowRoot.querySelector(".list");
    list.innerHTML = items.map((it) => `
      <div class="item">
        <button class="q" aria-expanded="false">
          ${it.q}
          <span class="icon"><svg viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
        </button>
        <div class="panel"><div class="a">${it.a}</div></div>
      </div>`).join("");

    list.querySelectorAll(".item").forEach((item) => {
      item.querySelector(".q").addEventListener("click", () => this._toggle(item));
    });
  }

  async _toggle(item) {
    const isOpen = item.hasAttribute("open");
    if (this._single && !isOpen) {
      this.shadowRoot.querySelectorAll(".item[open]").forEach((o) => this._collapse(o));
    }
    isOpen ? this._collapse(item) : this._expand(item);
  }

  async _expand(item) {
    item.setAttribute("open", "");
    item.querySelector(".q").setAttribute("aria-expanded", "true");
    const panel = item.querySelector(".panel");
    const target = panel.firstElementChild.offsetHeight;
    const A = prefersReducedMotion() ? null : await loadAnime();
    if (!A) { panel.style.height = "auto"; return; }
    A.animate(panel, { height: [0, target], duration: 380, ease: "outExpo",
      onComplete: () => { panel.style.height = "auto"; } });
  }

  async _collapse(item) {
    item.removeAttribute("open");
    item.querySelector(".q").setAttribute("aria-expanded", "false");
    const panel = item.querySelector(".panel");
    const current = panel.offsetHeight;
    const A = prefersReducedMotion() ? null : await loadAnime();
    if (!A) { panel.style.height = "0px"; return; }
    A.animate(panel, { height: [current, 0], duration: 320, ease: "inOutQuad" });
  }
}
customElements.define("fb-faq", FbFaq);
