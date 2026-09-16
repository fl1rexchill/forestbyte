/**
 * <fb-reveal> — плавное появление дочерних элементов при прокрутке (anime.js).
 * Работает в light DOM: анимирует прямых потомков со stagger-задержкой.
 * Без anime.js/при reduced-motion — просто показывает контент (грациозный фолбэк).
 *
 * Использование:
 *   <fb-reveal animation="fade-up" stagger="80">
 *     <div class="card">...</div>
 *     <div class="card">...</div>
 *   </fb-reveal>
 *
 * Атрибуты:
 *   animation — fade-up | fade | zoom | slide-left | slide-right (по умолчанию fade-up)
 *   stagger   — задержка между элементами, мс (по умолчанию 90)
 *   duration  — длительность, мс (по умолчанию 650)
 *   delay     — стартовая задержка, мс (по умолчанию 0)
 *   once      — анимировать только один раз (по умолчанию true; once="false" — каждый раз)
 *   threshold — доля видимости для запуска (0..1, по умолчанию 0.15)
 */
import { loadAnime, prefersReducedMotion } from "../shared/anim.js";

const PRESETS = {
  "fade":        { opacity: [0, 1] },
  "fade-up":     { opacity: [0, 1], translateY: [28, 0] },
  "slide-left":  { opacity: [0, 1], translateX: [-40, 0] },
  "slide-right": { opacity: [0, 1], translateX: [40, 0] },
  "zoom":        { opacity: [0, 1], scale: [0.9, 1] },
};

class FbReveal extends HTMLElement {
  connectedCallback() {
    this._anim = this.getAttribute("animation") || "fade-up";
    this._stagger = parseInt(this.getAttribute("stagger") || "90", 10);
    this._duration = parseInt(this.getAttribute("duration") || "650", 10);
    this._delay = parseInt(this.getAttribute("delay") || "0", 10);
    this._once = this.getAttribute("once") !== "false";
    this._threshold = parseFloat(this.getAttribute("threshold") || "0.15");

    this._targets = Array.from(this.children);
    this._reduced = prefersReducedMotion();

    // Прячем элементы до появления (только если будем анимировать)
    if (!this._reduced) {
      for (const el of this._targets) el.style.opacity = "0";
    }

    if (!("IntersectionObserver" in window) || this._reduced) {
      this._show(); // фолбэк — сразу показать
      return;
    }
    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this._play();
          if (this._once) { this._io.disconnect(); }
          else { /* сброс для повторного показа */ }
        } else if (!this._once) {
          for (const el of this._targets) el.style.opacity = "0";
        }
      }
    }, { threshold: this._threshold });
    this._io.observe(this);
  }

  async _play() {
    const A = await loadAnime();
    if (!A) { this._show(); return; }
    const preset = PRESETS[this._anim] || PRESETS["fade-up"];
    A.animate(this._targets, {
      ...preset,
      duration: this._duration,
      delay: A.stagger(this._stagger, { start: this._delay }),
      ease: "outExpo",
    });
  }

  _show() { for (const el of this._targets) el.style.opacity = "1"; }
}
customElements.define("fb-reveal", FbReveal);
