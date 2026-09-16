/**
 * <fb-testimonials> — слайдер отзывов с плавными переходами (anime.js).
 *
 * Использование:
 *   <fb-testimonials autoplay="6000" items='[
 *     {"name":"Анна","role":"Основатель, ООО Ромашка","avatar":"/i/a.jpg",
 *      "text":"Сделали сайт за неделю, заявки пошли сразу.","rating":5},
 *     {"name":"Игорь","role":"Маркетолог","text":"Чистая работа, всё по срокам.","rating":5}
 *   ]'></fb-testimonials>
 *
 *   <!-- или: --> <fb-testimonials src="/data/reviews.json"></fb-testimonials>
 *
 * Атрибуты: items (JSON), src (URL JSON), autoplay (мс; 0/нет — выкл).
 * Темизация: --fb-bg, --fb-surface, --fb-accent, --fb-radius, --fb-shadow, --fb-text.
 */
import { loadAnime, prefersReducedMotion } from "../shared/anim.js";

class FbTestimonials extends HTMLElement {
  async connectedCallback() {
    this._i = 0;
    this._autoplay = parseInt(this.getAttribute("autoplay") || "0", 10);
    this.attachShadow({ mode: "open" });
    this._renderShell();

    let items = [];
    if (this.getAttribute("src")) {
      try { items = await (await fetch(this.getAttribute("src"))).json(); } catch {}
    } else {
      try { items = JSON.parse(this.getAttribute("items") || "[]"); } catch {}
    }
    this._items = items;
    if (!items.length) return;
    this._renderDots();
    this._show(0, false);
    this._bind();
    if (this._autoplay > 0) this._startAuto();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--fb-font, sans-serif); }
        .card { position:relative; background: var(--fb-surface,#f4f6f7);
                border-radius: var(--fb-radius,16px); padding:36px 40px; text-align:center;
                box-shadow: var(--fb-shadow,0 6px 24px rgba(20,30,30,.08)); }
        .stars { color: var(--fb-accent-2,#ff6b5e); font-size:1.15rem; letter-spacing:2px; margin-bottom:14px; }
        .text { font-size: var(--fb-fs-lg,1.2rem); line-height:1.6; color: var(--fb-text,#111);
                margin:0 auto 22px; max-width:640px; }
        .who { display:flex; align-items:center; justify-content:center; gap:12px; }
        .who img { width:48px; height:48px; border-radius:50%; object-fit:cover; }
        .who .n { font-weight:700; color: var(--fb-text,#111); }
        .who .r { color: var(--fb-text-muted,#5f6b69); font-size: var(--fb-fs-sm,.875rem); }
        .nav { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:22px; }
        .arrow { width:46px; height:46px; border-radius:50%; border:0; cursor:pointer;
                 background: var(--fb-bg,#fff); box-shadow: var(--fb-btn-shadow,0 6px 16px rgba(0,0,0,.12));
                 display:grid; place-items:center; color: var(--fb-text,#111);
                 transition: transform var(--fb-transition,.25s), box-shadow var(--fb-transition,.25s), background var(--fb-transition,.25s); }
        .arrow:hover { transform: translateY(-2px); box-shadow: var(--fb-btn-shadow-hover,0 10px 24px rgba(0,0,0,.18));
                       background: var(--fb-accent,#0ea5a4); color: var(--fb-accent-contrast,#fff); }
        .arrow:active { transform: translateY(0); }
        .arrow svg { width:20px; height:20px; }
        .dots { display:flex; gap:8px; }
        .dot { width:9px; height:9px; border-radius:50%; border:0; padding:0; cursor:pointer;
               background: var(--fb-border,#d7dcdc); transition: all var(--fb-transition,.25s); }
        .dot[active] { background: var(--fb-accent,#0ea5a4); width:24px; border-radius:5px; }
      </style>
      <div class="card">
        <div class="stars"></div>
        <p class="text"></p>
        <div class="who"></div>
      </div>
      <div class="nav">
        <button class="arrow prev" aria-label="Назад"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="dots"></div>
        <button class="arrow next" aria-label="Вперёд"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
    `;
  }

  _renderDots() {
    this.shadowRoot.querySelector(".dots").innerHTML =
      this._items.map((_, k) => `<button class="dot" data-k="${k}" aria-label="Отзыв ${k + 1}"></button>`).join("");
    this.shadowRoot.querySelectorAll(".dot").forEach((d) =>
      d.addEventListener("click", () => this._go(parseInt(d.dataset.k, 10))));
  }

  _bind() {
    this.shadowRoot.querySelector(".prev").addEventListener("click", () => this._go(this._i - 1));
    this.shadowRoot.querySelector(".next").addEventListener("click", () => this._go(this._i + 1));
    // Пауза автоплея при наведении
    this.addEventListener("mouseenter", () => this._stopAuto());
    this.addEventListener("mouseleave", () => { if (this._autoplay > 0) this._startAuto(); });
  }

  _go(index) {
    const n = this._items.length;
    this._i = (index + n) % n;
    this._show(this._i, true);
  }

  async _show(i, animated) {
    const it = this._items[i];
    const sr = this.shadowRoot;
    const rating = Math.max(0, Math.min(5, it.rating || 5));
    sr.querySelector(".stars").textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    sr.querySelector(".text").innerHTML = `«${it.text}»`;
    sr.querySelector(".who").innerHTML =
      `${it.avatar ? `<img src="${it.avatar}" alt="">` : ""}
       <div><div class="n">${it.name || ""}</div>${it.role ? `<div class="r">${it.role}</div>` : ""}</div>`;
    sr.querySelectorAll(".dot").forEach((d, k) => d.toggleAttribute("active", k === i));

    if (!animated || prefersReducedMotion()) return;
    const A = await loadAnime();
    if (A) A.animate(sr.querySelector(".card"), { opacity: [0, 1], translateY: [16, 0], duration: 450, ease: "outExpo" });
  }

  _startAuto() {
    this._stopAuto();
    this._timer = setInterval(() => this._go(this._i + 1), this._autoplay);
  }
  _stopAuto() { if (this._timer) clearInterval(this._timer); }
  disconnectedCallback() { this._stopAuto(); }
}
customElements.define("fb-testimonials", FbTestimonials);
