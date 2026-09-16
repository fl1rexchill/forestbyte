/**
 * <fb-modal> — модальное окно/попап с анимацией входа (anime.js) и человечными кнопками.
 *
 * Использование:
 *   <fb-modal id="promo" open-on="delay" delay="4000" title="Скидка 10%">
 *     <p>Оставьте заявку сегодня и получите скидку.</p>
 *     <button class="fb-btn" data-fb-close>Забрать скидку</button>
 *   </fb-modal>
 *
 *   <!-- открыть по клику на любую кнопку: -->
 *   <button data-fb-open="promo">Открыть</button>
 *
 *   <!-- программно: --> document.getElementById("promo").open()
 *
 * Атрибуты:
 *   title    — заголовок (необязательно)
 *   open-on  — manual (по умолч.) | load | delay | exit  (exit = уход курсора за верх окна)
 *   delay    — задержка для open-on="delay", мс (по умолчанию 3000)
 *   once     — показывать автоматически только один раз за сессию (по умолчанию true)
 * Контент — любой HTML внутри тега. Кнопка с [data-fb-close] закрывает окно.
 * Темизация: --fb-bg, --fb-radius, --fb-shadow-lg, --fb-text; кнопки — класс .fb-btn (tokens.css).
 */
import { loadAnime, prefersReducedMotion } from "../shared/anim.js";

class FbModal extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute("title") || "";
    const openOn = this.getAttribute("open-on") || "manual";
    const delay = parseInt(this.getAttribute("delay") || "3000", 10);
    const once = this.getAttribute("once") !== "false";

    // Переносим пользовательский контент внутрь, затем строим оболочку в shadow
    const content = this.innerHTML;
    this.innerHTML = "";
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { position: fixed; inset: 0; z-index: var(--fb-z-modal, 2000);
                display: none; font-family: var(--fb-font, sans-serif); }
        :host([shown]) { display: block; }
        .backdrop { position:absolute; inset:0; background: rgba(10,15,15,.55);
                    backdrop-filter: blur(3px); opacity:0; }
        .box { position:absolute; left:50%; top:50%; transform: translate(-50%,-50%);
               width: min(92vw, 460px); background: var(--fb-bg,#fff); color: var(--fb-text,#111);
               border-radius: var(--fb-radius,16px); box-shadow: var(--fb-shadow-lg,0 18px 50px rgba(0,0,0,.2));
               padding: 28px; }
        .close { position:absolute; top:12px; right:12px; width:34px; height:34px; border:0;
                 border-radius:50%; background: var(--fb-surface,#f4f6f7); color: var(--fb-text,#111);
                 font-size:20px; line-height:1; cursor:pointer; transition: background var(--fb-transition,.25s); }
        .close:hover { background: var(--fb-border,#e4e8e8); }
        h3 { margin:0 0 14px; font-size: var(--fb-fs-xl,1.6rem); }
        .content p { color: var(--fb-text-muted,#5f6b69); line-height:1.6; margin:0 0 18px; }
        /* Человечные кнопки внутри модалки (контент рендерится в shadow DOM) */
        .content .fb-btn, .content button:not(.close) {
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          padding: var(--fb-btn-pad, 12px 22px); border:0; border-radius: var(--fb-btn-radius,12px);
          background: var(--fb-accent,#0ea5a4); color: var(--fb-accent-contrast,#fff);
          font-family:inherit; font-weight: var(--fb-btn-weight,600); font-size:1rem; cursor:pointer;
          box-shadow: var(--fb-btn-shadow,0 6px 16px rgba(0,0,0,.12));
          transition: transform var(--fb-transition,.25s), box-shadow var(--fb-transition,.25s), background var(--fb-transition,.25s);
        }
        .content .fb-btn:hover, .content button:not(.close):hover {
          background: var(--fb-accent-hover,#0b8a89); transform: translateY(-2px);
          box-shadow: var(--fb-btn-shadow-hover,0 10px 24px rgba(0,0,0,.18));
        }
      </style>
      <div class="backdrop" part="backdrop"></div>
      <div class="box" role="dialog" aria-modal="true">
        <button class="close" data-fb-close aria-label="Закрыть">&times;</button>
        ${title ? `<h3>${title}</h3>` : ""}
        <div class="content">${content}</div>
      </div>
    `;

    // Закрытие: крестик, кнопки [data-fb-close], клик по фону, ESC
    this.shadowRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-fb-close]") || e.target.classList.contains("backdrop")) this.close();
    });
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };

    // Внешние триггеры открытия: [data-fb-open="<id>"]
    if (this.id) {
      document.addEventListener("click", (e) => {
        const t = e.target.closest(`[data-fb-open="${this.id}"]`);
        if (t) { e.preventDefault(); this.open(); }
      });
    }

    // Авто-открытие
    const key = `fb-modal-${this.id || "x"}`;
    const seen = once && sessionStorage.getItem(key);
    const markSeen = () => { try { sessionStorage.setItem(key, "1"); } catch {} };
    if (!seen) {
      if (openOn === "load") { this.open(); markSeen(); }
      else if (openOn === "delay") { setTimeout(() => { this.open(); markSeen(); }, delay); }
      else if (openOn === "exit") {
        const onLeave = (e) => {
          if (e.clientY <= 0) { this.open(); markSeen(); document.removeEventListener("mouseout", onLeave); }
        };
        document.addEventListener("mouseout", onLeave);
      }
    }
  }

  async open() {
    if (this.hasAttribute("shown")) return;
    this.setAttribute("shown", "");
    document.addEventListener("keydown", this._onKey);
    this.dispatchEvent(new CustomEvent("fb-modal-open", { bubbles: true }));

    if (prefersReducedMotion()) return;
    const A = await loadAnime();
    if (!A) return;
    A.animate(this.shadowRoot.querySelector(".backdrop"), { opacity: [0, 1], duration: 250, ease: "outQuad" });
    A.animate(this.shadowRoot.querySelector(".box"),
      { opacity: [0, 1], scale: [0.9, 1], duration: 400, ease: "outExpo" });
  }

  async close() {
    if (!this.hasAttribute("shown")) return;
    document.removeEventListener("keydown", this._onKey);
    this.dispatchEvent(new CustomEvent("fb-modal-close", { bubbles: true }));

    if (prefersReducedMotion()) { this.removeAttribute("shown"); return; }
    const A = await loadAnime();
    if (!A) { this.removeAttribute("shown"); return; }
    A.animate(this.shadowRoot.querySelector(".box"),
      { opacity: [1, 0], scale: [1, 0.94], duration: 220, ease: "inQuad" });
    A.animate(this.shadowRoot.querySelector(".backdrop"),
      { opacity: [1, 0], duration: 240, ease: "inQuad", onComplete: () => this.removeAttribute("shown") });
  }
}
customElements.define("fb-modal", FbModal);
