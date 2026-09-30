/**
 * <fb-cookie-consent> — баннер согласия на cookie.
 * Копия sites/components/cookie-consent/fb-cookie-consent.js с доработками для шаблонов:
 *   • аналитика и маркетинг НЕ отмечены заранее;
 *   • убрана фраза «продолжая пользоваться сайтом, вы соглашаетесь» — согласие только по кнопке;
 *   • атрибут storage-key — отдельный выбор для каждого сайта на одном домене;
 *   • подключается обычным <script> (без type="module"), поэтому работает и при открытии файла;
 *   • кнопки не ниже 44 px, видимый фокус, aria-labelledby.
 *
 * Атрибуты: policy-href, categories, text, storage-key.
 * Событие: "fb-consent" { necessary, analytics, marketing, ts } — на элементе и на document.
 * Повторно открыть: window.fbCookieConsent.open()
 * Темизация через Shadow DOM: --fb-bg, --fb-text, --fb-text-muted, --fb-border, --fb-accent,
 *   --fb-accent-contrast, --fb-surface, --fb-radius, --fb-radius-sm, --fb-font, --fb-shadow-lg.
 */
(function () {
  if (window.customElements && customElements.get('fb-cookie-consent')) return;

  class FbCookieConsent extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      this._key = this.getAttribute('storage-key') || 'fb-cookie-consent';
      this._hasCategories = this.hasAttribute('categories');
      this._policy = this.getAttribute('policy-href') || 'legal/cookies.html';
      this._text = this.getAttribute('text') || 'Сайт использует необходимые файлы cookie для работы.';
      this.attachShadow({ mode: 'open' });
      this._render();
      window.fbCookieConsent = { open: () => this._show(true) };
      if (!this._saved()) this._show();
    }

    _render() {
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      this.shadowRoot.innerHTML = `
        <style>
          :host { font-family: var(--fb-font, system-ui, sans-serif); }
          .box { position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: var(--fb-z-modal, 2000);
                 max-width: 520px; margin: 0 auto; background: var(--fb-bg, #fff); color: var(--fb-text, #111);
                 border: 1px solid var(--fb-border, #e5e7eb); border-radius: var(--fb-radius, 14px);
                 box-shadow: var(--fb-shadow-lg, 0 12px 48px rgba(0,0,0,.18)); padding: 20px; display: none; }
          .box[open] { display: block; }
          h2 { margin: 0 0 8px; font-size: 1rem; }
          p { margin: 0 0 14px; font-size: .9rem; line-height: 1.55; }
          a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
          .cats { display: grid; gap: 6px; margin: 0 0 14px; }
          label { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: .9rem; }
          label input { width: 20px; height: 20px; accent-color: var(--fb-accent, #0e6d5d); }
          label.locked { color: var(--fb-text-muted, #555); }
          .row { display: flex; flex-wrap: wrap; gap: 8px; }
          button { min-height: 44px; border: 0; border-radius: var(--fb-radius-sm, 10px); padding: 10px 16px;
                   font: inherit; font-weight: 600; cursor: pointer; font-size: .9rem; }
          button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--fb-accent, #0e6d5d); outline-offset: 2px; }
          .primary { background: var(--fb-accent, #0e6d5d); color: var(--fb-accent-contrast, #fff); flex: 1; }
          .ghost { background: var(--fb-surface, #f1f1ee); color: var(--fb-text, #111); flex: 1; }
        </style>
        <div class="box" role="dialog" aria-labelledby="t">
          <h2 id="t">Файлы cookie</h2>
          <p>${esc(this._text)} <a href="${esc(this._policy)}">Подробнее о cookie</a>.</p>
          ${this._hasCategories ? `
            <div class="cats">
              <label class="locked"><input type="checkbox" checked disabled> Необходимые — всегда включены</label>
              <label><input type="checkbox" id="c-analytics"> Аналитические</label>
              <label><input type="checkbox" id="c-marketing"> Маркетинговые</label>
            </div>` : ''}
          <div class="row">
            <button class="primary" id="accept" type="button">${this._hasCategories ? 'Сохранить выбор' : 'Принять'}</button>
            <button class="ghost" id="reject" type="button">Только необходимые</button>
          </div>
        </div>`;
      this.shadowRoot.getElementById('accept').addEventListener('click', () => this._accept());
      this.shadowRoot.getElementById('reject').addEventListener('click', () => this._reject());
    }

    _show(force) {
      const saved = this._saved();
      if (force && saved && this._hasCategories) {
        this.shadowRoot.getElementById('c-analytics').checked = !!saved.analytics;
        this.shadowRoot.getElementById('c-marketing').checked = !!saved.marketing;
      }
      this.shadowRoot.querySelector('.box').setAttribute('open', '');
      if (force) this.shadowRoot.getElementById('accept').focus();
    }

    _hide() { this.shadowRoot.querySelector('.box').removeAttribute('open'); }

    _accept() {
      const analytics = this._hasCategories ? this.shadowRoot.getElementById('c-analytics').checked : true;
      const marketing = this._hasCategories ? this.shadowRoot.getElementById('c-marketing').checked : true;
      this._save({ necessary: true, analytics, marketing });
    }

    _reject() { this._save({ necessary: true, analytics: false, marketing: false }); }

    _save(choices) {
      const data = { ...choices, ts: new Date().toISOString() };
      try { localStorage.setItem(this._key, JSON.stringify(data)); } catch (e) { /* приватный режим */ }
      this.dispatchEvent(new CustomEvent('fb-consent', { detail: data, bubbles: true }));
      document.dispatchEvent(new CustomEvent('fb-consent', { detail: data }));
      this._hide();
    }

    _saved() {
      try { return JSON.parse(localStorage.getItem(this._key) || 'null'); } catch (e) { return null; }
    }
  }
  customElements.define('fb-cookie-consent', FbCookieConsent);
})();
