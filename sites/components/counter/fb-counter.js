/**
 * <fb-counter> — анимированный счётчик: считает вверх, когда попадает в экран.
 *
 * Использование:
 *   <fb-counter to="1500" suffix="+" duration="1600">0</fb-counter>
 *   <fb-counter to="98.6" decimals="1" suffix="%"></fb-counter>
 *   <fb-counter to="1200000" separator=" " prefix="₽"></fb-counter>
 *
 * Атрибуты:
 *   to        — конечное число (обязательно)
 *   from      — стартовое число (по умолчанию 0)
 *   duration  — мс (по умолчанию 1600)
 *   decimals  — знаков после запятой (по умолчанию 0)
 *   separator — разделитель тысяч (например " " или ","; по умолчанию пусто)
 *   prefix / suffix — текст до/после числа
 *
 * Наследует размер/цвет от родителя (font-size/color) — оформляй как обычный текст.
 * Темизация чисел — обычным CSS на самом теге.
 */
import { loadAnime, prefersReducedMotion } from "../shared/anim.js";

class FbCounter extends HTMLElement {
  connectedCallback() {
    this._to = parseFloat(this.getAttribute("to") || "0");
    this._from = parseFloat(this.getAttribute("from") || "0");
    this._duration = parseInt(this.getAttribute("duration") || "1600", 10);
    this._decimals = parseInt(this.getAttribute("decimals") || "0", 10);
    this._sep = this.getAttribute("separator") || "";
    this._prefix = this.getAttribute("prefix") || "";
    this._suffix = this.getAttribute("suffix") || "";
    this._done = false;

    this.style.display = this.style.display || "inline-block";
    this._render(this._from);

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      this._render(this._to);
      return;
    }
    this._io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !this._done) {
        this._done = true;
        this._io.disconnect();
        this._run();
      }
    }, { threshold: 0.4 });
    this._io.observe(this);
  }

  async _run() {
    const A = await loadAnime();
    if (!A) { this._render(this._to); return; }
    const obj = { v: this._from };
    A.animate(obj, {
      v: this._to,
      duration: this._duration,
      ease: "outExpo",
      onUpdate: () => this._render(obj.v),
      onComplete: () => this._render(this._to),
    });
  }

  _render(value) {
    const fixed = Number(value).toFixed(this._decimals);
    let [intPart, decPart] = fixed.split(".");
    if (this._sep) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, this._sep);
    const num = decPart ? `${intPart}.${decPart}` : intPart;
    this.textContent = `${this._prefix}${num}${this._suffix}`;
  }
}
customElements.define("fb-counter", FbCounter);
