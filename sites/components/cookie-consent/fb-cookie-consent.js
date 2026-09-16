/**
 * <fb-cookie-consent> — баннер согласия на cookie и обработку ПД (152-ФЗ + GDPR).
 * Сохраняет выбор в localStorage, шлёт событие "fb-consent" — по нему включай
 * аналитику/пиксели ТОЛЬКО после согласия.
 *
 * Использование:
 *   <fb-cookie-consent policy-href="/privacy" categories></fb-cookie-consent>
 *
 *   <script>
 *     document.addEventListener("fb-consent", (e) => {
 *       if (e.detail.analytics) { /* инициализировать Я.Метрику / GA * / }
 *       if (e.detail.marketing) { /* пиксели рекламы * / }
 *     });
 *   </script>
 *
 * Атрибуты:
 *   policy-href — ссылка на политику конфиденциальности (обязательно по 152-ФЗ)
 *   categories  — показывать настройку категорий (аналитика/маркетинг)
 *   text        — переопределить основной текст
 * Повторно открыть настройки: window.fbCookieConsent.open()
 * Темизация: --fb-bg, --fb-text, --fb-accent, --fb-radius, --fb-shadow.
 */
const FB_CONSENT_KEY = "fb-cookie-consent";

class FbCookieConsent extends HTMLElement {
  connectedCallback() {
    this._hasCategories = this.hasAttribute("categories");
    this._policy = this.getAttribute("policy-href") || "/privacy";
    this._text = this.getAttribute("text") ||
      "Мы используем файлы cookie для работы сайта, аналитики и удобства. " +
      "Продолжая пользоваться сайтом, вы соглашаетесь на обработку персональных данных " +
      "в соответствии с Федеральным законом № 152-ФЗ.";
    this.attachShadow({ mode: "open" });
    this._render();

    window.fbCookieConsent = { open: () => this._show(true) };

    if (!this._saved()) this._show();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { font-family: var(--fb-font, sans-serif); }
        .box { position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: var(--fb-z-modal, 2000);
               max-width: 520px; margin: 0 auto; background: var(--fb-bg,#fff); color: var(--fb-text,#111);
               border: 1px solid var(--fb-border,#e5e7eb); border-radius: var(--fb-radius,14px);
               box-shadow: var(--fb-shadow-lg, 0 12px 48px rgba(0,0,0,.18)); padding: 20px;
               display: none; }
        .box[open] { display: block; }
        p { margin: 0 0 14px; font-size: .9rem; line-height: 1.55; }
        a { color: var(--fb-accent,#4f46e5); }
        .cats { display: grid; gap: 10px; margin: 0 0 14px; }
        label { display: flex; align-items: center; gap: 10px; font-size: .88rem; }
        label input { width: 18px; height: 18px; accent-color: var(--fb-accent,#4f46e5); }
        label.locked { color: var(--fb-text-muted,#6b7280); }
        .row { display: flex; flex-wrap: wrap; gap: 8px; }
        button { border: 0; border-radius: var(--fb-radius-sm,8px); padding: 10px 16px;
                 font-weight: 600; cursor: pointer; font-size: .88rem; }
        .primary { background: var(--fb-accent,#4f46e5); color: var(--fb-accent-contrast,#fff); flex: 1; }
        .ghost { background: var(--fb-surface,#f3f4f6); color: var(--fb-text,#111); }
      </style>
      <div class="box" role="dialog" aria-label="Согласие на cookie">
        <p>${this._text} <a href="${this._policy}">Политика конфиденциальности</a>.</p>
        ${this._hasCategories ? `
          <div class="cats">
            <label class="locked"><input type="checkbox" checked disabled> Необходимые (всегда включены)</label>
            <label><input type="checkbox" id="c-analytics" checked> Аналитика (Я.Метрика, GA)</label>
            <label><input type="checkbox" id="c-marketing"> Маркетинг и реклама</label>
          </div>` : ""}
        <div class="row">
          <button class="primary" id="accept">Принять${this._hasCategories ? " выбранные" : " всё"}</button>
          <button class="ghost" id="reject">Только необходимые</button>
        </div>
      </div>
    `;
    this.shadowRoot.getElementById("accept").addEventListener("click", () => this._accept());
    this.shadowRoot.getElementById("reject").addEventListener("click", () => this._reject());
  }

  _show(force) {
    if (force && this._hasCategories) {
      const saved = this._saved();
      if (saved) {
        const a = this.shadowRoot.getElementById("c-analytics");
        const m = this.shadowRoot.getElementById("c-marketing");
        if (a) a.checked = !!saved.analytics;
        if (m) m.checked = !!saved.marketing;
      }
    }
    this.shadowRoot.querySelector(".box").setAttribute("open", "");
  }

  _hide() { this.shadowRoot.querySelector(".box").removeAttribute("open"); }

  _accept() {
    const analytics = this._hasCategories
      ? this.shadowRoot.getElementById("c-analytics").checked : true;
    const marketing = this._hasCategories
      ? this.shadowRoot.getElementById("c-marketing").checked : true;
    this._save({ necessary: true, analytics, marketing });
  }

  _reject() { this._save({ necessary: true, analytics: false, marketing: false }); }

  _save(choices) {
    const data = { ...choices, ts: new Date().toISOString() };
    try { localStorage.setItem(FB_CONSENT_KEY, JSON.stringify(data)); } catch {}
    this.dispatchEvent(new CustomEvent("fb-consent", { detail: data, bubbles: true }));
    document.dispatchEvent(new CustomEvent("fb-consent", { detail: data }));
    this._hide();
  }

  _saved() {
    try { return JSON.parse(localStorage.getItem(FB_CONSENT_KEY) || "null"); }
    catch { return null; }
  }
}
customElements.define("fb-cookie-consent", FbCookieConsent);
