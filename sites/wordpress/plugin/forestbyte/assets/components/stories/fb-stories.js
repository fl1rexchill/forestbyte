/**
 * <fb-stories> — истории как в Instagram: кольца-аватары + полноэкранный просмотр.
 * Прогресс-бары, авто-переключение, тап влево/вправо, картинки и видео,
 * статус «просмотрено» (localStorage).
 *
 * Использование:
 *   <fb-stories items='[
 *     {"id":"a","avatar":"/i/a.jpg","title":"Новинки","slides":[
 *        {"type":"image","src":"/s/1.jpg","duration":5000,"link":"/sale"},
 *        {"type":"video","src":"/s/2.mp4"}]},
 *     {"id":"b","avatar":"/i/b.jpg","title":"Отзывы","slides":[{"type":"image","src":"/s/3.jpg"}]}
 *   ]'></fb-stories>
 *
 *   <!-- или: --> <fb-stories src="/data/stories.json"></fb-stories>
 *
 * Атрибуты: items (JSON), src (URL JSON), size (px кольца, по умолчанию 72),
 *           default-duration (мс для картинок, по умолчанию 5000).
 * Темизация: --fb-gradient (кольцо непросмотренных), --fb-border, --fb-bg.
 */
class FbStories extends HTMLElement {
  async connectedCallback() {
    this._size = parseInt(this.getAttribute("size") || "72", 10);
    this._defDur = parseInt(this.getAttribute("default-duration") || "5000", 10);
    this._seen = this._loadSeen();
    this.attachShadow({ mode: "open" });
    this._renderShell();

    let items = [];
    if (this.getAttribute("src")) {
      try { items = await (await fetch(this.getAttribute("src"))).json(); } catch {}
    } else {
      try { items = JSON.parse(this.getAttribute("items") || "[]"); } catch {}
    }
    this._items = items;
    this._renderRing();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--fb-font, sans-serif); }
        .ring { display:flex; gap:16px; overflow-x:auto; padding:8px 2px 12px; }
        .ring::-webkit-scrollbar { height:6px; }
        .ava { flex:0 0 auto; text-align:center; cursor:pointer; width:var(--d); }
        .frame { width:var(--d); height:var(--d); border-radius:50%; padding:3px;
                 background: var(--fb-gradient, linear-gradient(45deg,#f09433,#dc2743,#bc1888)); }
        .frame.seen { background: var(--fb-border, #d1d5db); }
        .frame img { width:100%; height:100%; border-radius:50%; object-fit:cover;
                     border:2px solid var(--fb-bg, #fff); display:block; }
        .cap { margin-top:6px; font-size:var(--fb-fs-sm,.8rem); color:var(--fb-text,#111);
               overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        .viewer { position:fixed; inset:0; z-index:var(--fb-z-modal,2000);
                  background:#000; display:none; }
        .viewer[open] { display:block; }
        .stage { position:absolute; inset:0; display:grid; place-items:center; }
        .stage img, .stage video { max-width:100%; max-height:100%; width:auto; height:100%;
                                   object-fit:contain; }
        .bars { position:absolute; top:10px; left:10px; right:10px; display:flex; gap:4px; z-index:3; }
        .bar { flex:1; height:3px; background:rgba(255,255,255,.35); border-radius:2px; overflow:hidden; }
        .bar > i { display:block; height:100%; width:0; background:#fff; }
        .bar.done > i { width:100%; }
        .head { position:absolute; top:22px; left:14px; right:14px; z-index:3; display:flex;
                align-items:center; gap:10px; color:#fff; }
        .head img { width:34px; height:34px; border-radius:50%; object-fit:cover; }
        .head .name { font-weight:600; font-size:.9rem; }
        .close { margin-left:auto; background:none; border:0; color:#fff; font-size:30px; cursor:pointer; }
        .nav { position:absolute; top:0; bottom:0; width:35%; z-index:2; cursor:pointer; }
        .nav.prev { left:0; } .nav.next { right:0; }
        .link { position:absolute; bottom:26px; left:50%; transform:translateX(-50%); z-index:3;
                background:#fff; color:#111; text-decoration:none; padding:10px 22px;
                border-radius:999px; font-weight:600; font-size:.9rem; box-shadow:0 4px 14px rgba(0,0,0,.3); }
      </style>
      <div class="ring" style="--d:${this._size}px"></div>
      <div class="viewer">
        <div class="bars"></div>
        <div class="head">
          <img class="h-ava" alt=""><span class="name"></span>
          <button class="close" aria-label="Закрыть">&times;</button>
        </div>
        <div class="stage"></div>
        <div class="nav prev"></div>
        <div class="nav next"></div>
      </div>
    `;
    const sr = this.shadowRoot;
    sr.querySelector(".close").addEventListener("click", () => this._closeViewer());
    sr.querySelector(".nav.prev").addEventListener("click", () => this._prev());
    sr.querySelector(".nav.next").addEventListener("click", () => this._next());
    document.addEventListener("keydown", (e) => {
      if (!sr.querySelector(".viewer").hasAttribute("open")) return;
      if (e.key === "Escape") this._closeViewer();
      if (e.key === "ArrowRight") this._next();
      if (e.key === "ArrowLeft") this._prev();
    });
  }

  _renderRing() {
    const ring = this.shadowRoot.querySelector(".ring");
    ring.innerHTML = this._items.map((g, i) => `
      <div class="ava" data-i="${i}">
        <div class="frame ${this._seen.has(g.id) ? "seen" : ""}">
          <img src="${g.avatar}" alt="${g.title || ""}">
        </div>
        ${g.title ? `<div class="cap">${g.title}</div>` : ""}
      </div>`).join("");
    ring.querySelectorAll(".ava").forEach((el) =>
      el.addEventListener("click", () => this._openViewer(parseInt(el.dataset.i, 10))));
  }

  _openViewer(gi) {
    this._gi = gi; this._si = 0;
    this.shadowRoot.querySelector(".viewer").setAttribute("open", "");
    this._showSlide();
  }

  _closeViewer() {
    clearTimeout(this._timer);
    const v = this.shadowRoot.querySelector(".stage video");
    if (v) v.pause();
    this.shadowRoot.querySelector(".viewer").removeAttribute("open");
    this.shadowRoot.querySelector(".stage").innerHTML = "";
  }

  _showSlide() {
    clearTimeout(this._timer);
    const group = this._items[this._gi];
    const slide = group.slides[this._si];
    const stage = this.shadowRoot.querySelector(".stage");

    // Прогресс-бары
    const bars = group.slides.map((_, k) =>
      `<div class="bar ${k < this._si ? "done" : ""}"><i></i></div>`).join("");
    this.shadowRoot.querySelector(".bars").innerHTML = bars;

    // Шапка
    this.shadowRoot.querySelector(".h-ava").src = group.avatar || "";
    this.shadowRoot.querySelector(".name").textContent = group.title || "";

    // Контент
    let duration = slide.duration || this._defDur;
    if (slide.type === "video") {
      stage.innerHTML = `<video src="${slide.src}" autoplay playsinline></video>`;
      const v = stage.querySelector("video");
      v.addEventListener("loadedmetadata", () => {
        duration = (v.duration || 5) * 1000;
        this._runBar(duration);
      });
      v.addEventListener("ended", () => this._next());
    } else {
      stage.innerHTML = `<img src="${slide.src}" alt="">`;
      this._runBar(duration);
    }
    // Кнопка-ссылка
    const old = this.shadowRoot.querySelector(".link"); if (old) old.remove();
    if (slide.link) {
      const a = document.createElement("a");
      a.className = "link"; a.href = slide.link; a.textContent = slide.linkText || "Подробнее";
      a.target = "_blank"; a.rel = "noopener";
      this.shadowRoot.querySelector(".viewer").appendChild(a);
    }
  }

  _runBar(duration) {
    const bar = this.shadowRoot.querySelectorAll(".bar")[this._si];
    if (bar) {
      const fill = bar.querySelector("i");
      fill.style.transition = "none"; fill.style.width = "0";
      requestAnimationFrame(() => {
        fill.style.transition = `width ${duration}ms linear`;
        fill.style.width = "100%";
      });
    }
    this._timer = setTimeout(() => this._next(), duration);
  }

  _next() {
    const group = this._items[this._gi];
    if (this._si < group.slides.length - 1) { this._si++; this._showSlide(); return; }
    this._markSeen(group.id);
    if (this._gi < this._items.length - 1) { this._gi++; this._si = 0; this._showSlide(); }
    else this._closeViewer();
  }

  _prev() {
    if (this._si > 0) { this._si--; this._showSlide(); return; }
    if (this._gi > 0) { this._gi--; this._si = 0; this._showSlide(); }
  }

  _markSeen(id) {
    this._seen.add(id);
    try { localStorage.setItem("fb-stories-seen", JSON.stringify([...this._seen])); } catch {}
    this._renderRing();
  }

  _loadSeen() {
    try { return new Set(JSON.parse(localStorage.getItem("fb-stories-seen") || "[]")); }
    catch { return new Set(); }
  }
}
customElements.define("fb-stories", FbStories);
