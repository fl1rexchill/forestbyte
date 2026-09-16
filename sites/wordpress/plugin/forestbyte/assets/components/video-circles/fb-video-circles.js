/**
 * <fb-video-circles> — кружки-видео как в Telegram (video notes).
 * Круглые превью с автоплеем без звука; по клику — крупно и со звуком.
 *
 * Использование:
 *   <fb-video-circles size="120"
 *     items='[{"video":"/media/a.mp4","poster":"/media/a.jpg","title":"Отзыв Анны"},
 *             {"video":"/media/b.mp4","title":"Как мы работаем"}]'>
 *   </fb-video-circles>
 *
 *   <!-- или из JSON-файла: -->
 *   <fb-video-circles src="/data/circles.json"></fb-video-circles>
 *
 * Атрибуты: size (px, диаметр кружка, по умолчанию 110), items (JSON), src (URL JSON).
 * Темизация: --fb-accent, --fb-bg, --fb-radius.
 */
class FbVideoCircles extends HTMLElement {
  async connectedCallback() {
    this._size = parseInt(this.getAttribute("size") || "110", 10);
    this.attachShadow({ mode: "open" });
    this._renderShell();

    let items = [];
    if (this.getAttribute("src")) {
      try { items = await (await fetch(this.getAttribute("src"))).json(); }
      catch (e) { console.warn("fb-video-circles: не удалось загрузить src", e); }
    } else {
      try { items = JSON.parse(this.getAttribute("items") || "[]"); } catch {}
    }
    this._items = items;
    this._renderCircles();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--fb-font, sans-serif); }
        .row { display: flex; gap: 16px; overflow-x: auto; padding: 8px 2px 14px;
               scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .row::-webkit-scrollbar { height: 6px; }
        .row::-webkit-scrollbar-thumb { background: var(--fb-border, #e5e7eb); border-radius: 3px; }
        .circle { flex: 0 0 auto; scroll-snap-align: start; text-align: center; cursor: pointer; }
        .thumb { width: var(--d); height: var(--d); border-radius: 50%; overflow: hidden;
                 position: relative; border: 3px solid var(--fb-accent, #4f46e5);
                 background: #000; transition: transform var(--fb-transition, .25s); }
        .circle:hover .thumb { transform: scale(1.05); }
        .thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .play { position: absolute; inset: 0; display: grid; place-items: center;
                pointer-events: none; }
        .play svg { width: 26px; height: 26px; fill: #fff; filter: drop-shadow(0 1px 3px rgba(0,0,0,.6)); opacity: .9; }
        .title { margin-top: 8px; font-size: var(--fb-fs-sm, .875rem); color: var(--fb-text, #111);
                 max-width: var(--d); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .overlay { position: fixed; inset: 0; z-index: var(--fb-z-modal, 2000);
                   background: rgba(0,0,0,.85); display: none; place-items: center; }
        .overlay[open] { display: grid; }
        .player { width: min(80vw, 480px); aspect-ratio: 1; border-radius: 50%; overflow: hidden;
                  box-shadow: var(--fb-shadow-lg, 0 12px 48px rgba(0,0,0,.6)); }
        .player video { width: 100%; height: 100%; object-fit: cover; }
        .close { position: fixed; top: 20px; right: 24px; background: none; border: 0;
                 color: #fff; font-size: 40px; cursor: pointer; line-height: 1; }
      </style>
      <div class="row" style="--d:${this._size}px"></div>
      <div class="overlay" part="overlay">
        <button class="close" aria-label="Закрыть">&times;</button>
        <div class="player"></div>
      </div>
    `;
    const overlay = this.shadowRoot.querySelector(".overlay");
    this.shadowRoot.querySelector(".close").addEventListener("click", () => this._close());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) this._close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this._close(); });
  }

  _renderCircles() {
    const row = this.shadowRoot.querySelector(".row");
    row.innerHTML = this._items.map((it, i) => `
      <div class="circle" data-i="${i}">
        <div class="thumb">
          <video src="${it.video}" ${it.poster ? `poster="${it.poster}"` : ""}
                 muted loop playsinline preload="metadata"></video>
          <span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </div>
        ${it.title ? `<div class="title">${it.title}</div>` : ""}
      </div>`).join("");

    row.querySelectorAll(".circle").forEach((el) => {
      const v = el.querySelector("video");
      // Автоплей превью при наведении/появлении
      el.addEventListener("mouseenter", () => v.play().catch(() => {}));
      el.addEventListener("mouseleave", () => v.pause());
      el.addEventListener("click", () => this._open(parseInt(el.dataset.i, 10)));
    });
    // Автостарт превью, когда видно (мобилки)
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const v = en.target.querySelector("video");
          if (en.isIntersecting) v.play().catch(() => {}); else v.pause();
        });
      }, { threshold: 0.6 });
      row.querySelectorAll(".circle").forEach((el) => io.observe(el));
    }
  }

  _open(i) {
    const it = this._items[i];
    const overlay = this.shadowRoot.querySelector(".overlay");
    this.shadowRoot.querySelector(".player").innerHTML =
      `<video src="${it.video}" ${it.poster ? `poster="${it.poster}"` : ""} autoplay controls playsinline></video>`;
    overlay.setAttribute("open", "");
  }

  _close() {
    const overlay = this.shadowRoot.querySelector(".overlay");
    if (!overlay.hasAttribute("open")) return;
    overlay.removeAttribute("open");
    this.shadowRoot.querySelector(".player").innerHTML = "";
  }
}
customElements.define("fb-video-circles", FbVideoCircles);
