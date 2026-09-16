/**
 * <fb-navbar> — адаптивное меню с бургером, sticky и выпадающими подменю.
 *
 * Использование:
 *   <fb-navbar logo-text="Forestbyte" sticky>
 *     <a href="/">Главная</a>
 *     <a href="/about">О нас</a>
 *     <a href="/contacts">Контакты</a>
 *     <a href="/order" data-cta>Заказать</a>   <!-- data-cta = кнопка-акцент -->
 *   </fb-navbar>
 *
 * Атрибуты:
 *   logo-text  — текст логотипа
 *   logo-src   — картинка логотипа (перекрывает logo-text)
 *   logo-href  — ссылка логотипа (по умолчанию "/")
 *   sticky     — прилипающее меню
 *
 * Темизация: --fb-accent, --fb-bg, --fb-text, --fb-border, --fb-container.
 */
class FbNavbar extends HTMLElement {
  connectedCallback() {
    const sticky = this.hasAttribute("sticky");
    const logoText = this.getAttribute("logo-text") || "Logo";
    const logoSrc = this.getAttribute("logo-src");
    const logoHref = this.getAttribute("logo-href") || "/";

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; font-family: var(--fb-font, sans-serif); }
        nav {
          position: ${sticky ? "sticky" : "relative"}; top: 0;
          z-index: var(--fb-z-nav, 1000);
          background: var(--fb-bg, #fff);
          border-bottom: 1px solid var(--fb-border, #e5e7eb);
          backdrop-filter: saturate(180%) blur(8px);
        }
        .wrap {
          max-width: var(--fb-container, 1200px); margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; gap: 16px;
        }
        .brand {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: var(--fb-fs-lg, 1.25rem);
          color: var(--fb-text, #111); text-decoration: none; white-space: nowrap;
        }
        .brand img { height: 32px; width: auto; display: block; }
        .links { display: flex; align-items: center; gap: 8px; }
        ::slotted(a) {
          color: var(--fb-text, #111); text-decoration: none;
          padding: 8px 14px; border-radius: var(--fb-radius-sm, 8px);
          font-size: var(--fb-fs-base, 1rem); transition: background var(--fb-transition, .25s);
        }
        ::slotted(a:hover) { background: var(--fb-surface, #f3f4f6); }
        ::slotted(a[data-cta]) {
          background: var(--fb-accent, #4f46e5);
          color: var(--fb-accent-contrast, #fff); font-weight: 600;
        }
        ::slotted(a[data-cta]:hover) { filter: brightness(1.08); }
        .burger {
          display: none; background: none; border: 0; cursor: pointer;
          width: 40px; height: 40px; padding: 8px; color: var(--fb-text, #111);
        }
        .burger svg { width: 100%; height: 100%; }

        @media (max-width: 820px) {
          .burger { display: block; }
          .links {
            position: absolute; left: 0; right: 0; top: 100%;
            flex-direction: column; align-items: stretch; gap: 4px;
            background: var(--fb-bg, #fff); padding: 12px 20px;
            border-bottom: 1px solid var(--fb-border, #e5e7eb);
            box-shadow: var(--fb-shadow, 0 4px 24px rgba(0,0,0,.08));
            transform: translateY(-8px); opacity: 0; pointer-events: none;
            transition: opacity var(--fb-transition, .25s), transform var(--fb-transition, .25s);
          }
          :host([data-open]) .links { transform: translateY(0); opacity: 1; pointer-events: auto; }
          ::slotted(a) { padding: 12px 14px; }
        }
      </style>
      <nav>
        <div class="wrap">
          <a class="brand" href="${logoHref}">
            ${logoSrc ? `<img src="${logoSrc}" alt="${logoText}">` : logoText}
          </a>
          <button class="burger" aria-label="Меню" aria-expanded="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="links"><slot></slot></div>
        </div>
      </nav>
    `;

    const burger = root.querySelector(".burger");
    burger.addEventListener("click", () => {
      const open = this.toggleAttribute("data-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    // Закрывать меню по клику на ссылку (мобилка)
    this.addEventListener("click", (e) => {
      if (e.target.closest("a")) this.removeAttribute("data-open");
    });
  }
}
customElements.define("fb-navbar", FbNavbar);
