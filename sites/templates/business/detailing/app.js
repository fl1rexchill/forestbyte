/* Детейлинг-студия: «инспекционный свет».
   Первый экран — капот в боксе (canvas) и лампа: свет идёт за курсором, проявляет лак и голограммы;
   «После» — проход полировальника их стирает.
   Дальше: перечень услуг с фото → пакеты листом сравнения → работы (цвет под «лампой») → до/после (только
   реальные фото) → процесс и паспорт работы → расчёт на одном экране с плашкой ориентира → контакт.
   Все цены — из config.js. Анимации — CSS и Web Animations API; anime.js и Lenis не подключаются. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var classes = T.list('carClasses'), services = T.list('services'), packs = T.list('packages');
  var extras = T.list('extras'), works = T.list('portfolio');
  var pricing = C.pricing || {};
  var PACKAGE = 'package';
  var canAnimate = !FB.reduced && typeof Element.prototype.animate === 'function';
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  var EASE = 'cubic-bezier(.2,.8,.2,1)';

  function minPrice(list) {
    var vals = list.map(function (z) { var p = z.price || {}; return p.type === 'range' ? p.min : p.value; }).filter(function (v) { return v > 0; });
    return vals.length ? { type: 'from', value: Math.min.apply(null, vals) } : { type: 'request' };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------------------------------------------------------- первый экран: капот и лампа
     Капот рисуется на canvas: лак, рёбра, стыки с крыльями, лобовое стекло и отражения ламп бокса.
     Два статичных слоя — капот почти в темноте и при свете лампы (виден только в круге: CSS-маска
     по --lx/--ly). Третий слой перерисовывается за лампой: блик и голограммы — круговые царапины от
     полировальной машинки. У каждой окружности под точечным светом блестят два коротких участка на
     линии «центр — лампа», из них вокруг блика складываются кольца, как под лампой мастера. */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Рассчитать стоимость';
  $('#heroCta').href = '#' + (cta.target || 'calc');

  var hero = $('#top'), media = $('#heroMedia');
  if (touch) $('#heroHintText').textContent = 'Коснитесь капота: так мастер ищет голограммы и царапины на лаке';

  function hood() {
    var cD = $('#hoodDark'), cL = $('#hoodLit'), cF = $('#hoodFx');
    var xD = cD.getContext && cD.getContext('2d');
    if (!xD) return null;
    var xL = cL.getContext('2d'), xF = cF.getContext('2d');
    var W = 0, H = 0, G = null, paint = null, segs = null, n = 0;
    var cleanX = -200, cleanFrom = -200, cleanTo = -200, sweepT0 = 0, SWEEP = 1100;

    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    function fit(c, ctx, dpr) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

    // геометрия кадра: вид спереди чуть сверху. Поверхность капота задана долями (u, v): u — поперёк
    // (−1 и 1 — стыки с крыльями), v — вдоль (0 — у лобового стекла, 1 — передняя кромка).
    // Кромка у стекла выгнута к стеклу, передняя — к зрителю; ближе к зрителю всё шире (перспектива).
    function geometry() {
      var narrow = W < H * 1.15;
      var g = {
        cx: W * (narrow ? .54 : .62), top: H * (narrow ? .2 : .24), front: H * (narrow ? .92 : .88),
        bowT: H * .022, drop: H * (narrow ? .05 : .065), tH: W * (narrow ? .36 : .25), fH: W * (narrow ? .95 : .6)
      };
      g.p = function (u, v) {
        var pv = Math.pow(v, 1.5), a = g.top + g.bowT * u * u, b = g.front - g.drop * u * u;
        return { x: g.cx + u * (g.tH + (g.fH - g.tH) * pv), y: a + (b - a) * pv };
      };
      return g;
    }
    // продольная линия (u постоянна); рёбра чуть выгнуты наружу посередине
    function vline(ctx, u, rev, bulge) {
      var N = 24, i, v, p;
      for (i = 0; i <= N; i++) {
        v = rev ? 1 - i / N : i / N; p = G.p(u, v);
        if (bulge) p.x += bulge * Math.sin(Math.PI * v);
        if (!i && !rev) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    }
    // поперечная линия (v постоянна)
    function hline(ctx, v, u0, u1, move, dy) {
      var N = 40, i, p;
      for (i = 0; i <= N; i++) { p = G.p(u0 + (u1 - u0) * i / N, v); if (!i && move) ctx.moveTo(p.x, p.y + (dy || 0)); else ctx.lineTo(p.x, p.y + (dy || 0)); }
    }
    function region(ctx, u0, u1, v0, v1) { ctx.beginPath(); hline(ctx, v0, u0, u1, true); hline(ctx, v1, u1, u0, false); ctx.closePath(); }
    function strip(ctx, u0, u1) { ctx.beginPath(); vline(ctx, u0, false); vline(ctx, u1, true); ctx.closePath(); }
    function persp(y) { var t = Math.max(0, Math.min(1, (y - G.top) / (G.front - G.top))); return { s: .5 + .7 * t, k: .42 + .36 * t }; }
    var EDGE = 1.4;   // внешний край крыльев

    function render(ctx, lit) {
      ctx.clearRect(0, 0, W, H);
      var i, L = lit ? 1 : .25;
      ctx.fillStyle = lit ? '#08090b' : '#040405';
      ctx.fillRect(0, 0, W, H);
      // лобовое стекло со стойками: от кромки у стекла вверх и внутрь
      var gl = G.p(-1.2, 0), gr = G.p(1.2, 0), cowlUp = H * .03;
      var tl = { x: G.cx - G.tH * .86, y: -2 }, tr = { x: G.cx + G.tH * .86, y: -2 };
      ctx.beginPath(); ctx.moveTo(tl.x - 26, tl.y); ctx.lineTo(gl.x - 30, gl.y - cowlUp); ctx.lineTo(gr.x + 30, gr.y - cowlUp); ctx.lineTo(tr.x + 26, tr.y); ctx.closePath();
      ctx.fillStyle = lit ? '#1a1f26' : '#0b0d10';                         // стойки — цвет кузова
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(gl.x, gl.y - cowlUp); hline(ctx, 0, -1.2, 1.2, false, -cowlUp); ctx.lineTo(tr.x, tr.y); ctx.closePath();
      var glass = ctx.createLinearGradient(0, 0, 0, G.top);
      glass.addColorStop(0, lit ? '#10141a' : '#050607');
      glass.addColorStop(1, lit ? '#1b212a' : '#0b0d10');
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.save(); ctx.clip();
      // в стекле отражаются те же лампы потолка — косыми полосами
      [[.5, 46, .14], [.585, 14, .2], [.78, 26, .1]].forEach(function (r) {
        var x0 = W * r[0];
        ctx.beginPath(); ctx.moveTo(x0, -2); ctx.lineTo(x0 + r[1], -2); ctx.lineTo(x0 + r[1] - W * .06, G.top); ctx.lineTo(x0 - W * .06, G.top); ctx.closePath();
        ctx.fillStyle = 'rgba(215,224,238,' + (r[2] * (lit ? 1 : .45)).toFixed(3) + ')'; ctx.fill();
      });
      ctx.restore();
      // жабо под стеклом и щётки дворников
      ctx.beginPath(); hline(ctx, 0, -1.25, 1.25, true, -cowlUp); hline(ctx, 0, 1.25, -1.25, false); ctx.closePath();
      ctx.fillStyle = '#020203'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (.09 * L).toFixed(3) + ')'; ctx.lineWidth = 2;
      [[-.95, -.1], [.05, .9]].forEach(function (w) { ctx.beginPath(); hline(ctx, 0, w[0], w[1], true, -cowlUp * .45); ctx.stroke(); });

      // кузов: капот и крылья, ниже передней кромки — тёмная морда
      ctx.save();
      ctx.clip(paint);
      var base = ctx.createLinearGradient(0, G.top, 0, G.front);
      if (lit) { base.addColorStop(0, '#363d48'); base.addColorStop(.5, '#20252d'); base.addColorStop(1, '#161a20'); }
      else { base.addColorStop(0, '#171a1f'); base.addColorStop(.5, '#0e1013'); base.addColorStop(1, '#0a0b0d'); }
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      // объём: крылья уходят вниз — темнее; боковые плоскости капота темнее средней
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      strip(ctx, -EDGE - .2, -1); ctx.fill();
      strip(ctx, 1, EDGE + .2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      strip(ctx, -1, -.42); ctx.fill();
      strip(ctx, .42, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (.03 * L + .008).toFixed(3) + ')';
      strip(ctx, -.42, .42); ctx.fill();
      // отражения ламп потолка: поперечные полосы, выгнутые по капоту; у стекла уже, к зрителю шире
      [[.2, .022, 1], [.64, .05, .7]].forEach(function (r) {
        [1, .5, .18].forEach(function (k) {
          region(ctx, -EDGE - .2, EDGE + .2, r[0] - r[1] * k, r[0] + r[1] * k);
          ctx.fillStyle = 'rgba(225,232,245,' + ((lit ? .11 : .04) * r[2]).toFixed(3) + ')';
          ctx.fill();
        });
      });
      // рёбра капота: светлая кромка и тень за ней
      [-.42, .42].forEach(function (u) {
        var bulge = (u < 0 ? -1 : 1) * W * .012;
        ctx.beginPath(); vline(ctx, u * 1.03, false, bulge);
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); vline(ctx, u, false, bulge);
        ctx.strokeStyle = 'rgba(235,240,248,' + (.34 * L).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.stroke();
      });
      // стыки капота с крыльями: тёмный зазор и блик на кромке
      [-1, 1].forEach(function (u) {
        ctx.beginPath(); vline(ctx, u, false);
        ctx.strokeStyle = '#010101'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); vline(ctx, u * .994, false);
        ctx.strokeStyle = 'rgba(235,240,248,' + (.28 * L).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
      });
      // кромка капота у стекла
      ctx.beginPath(); hline(ctx, 0, -1, 1, true, 1.5);
      ctx.strokeStyle = 'rgba(235,240,248,' + (.3 * L).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
      // металлик: мелкие искры в лаке, видны только при свете
      if (lit) {
        var r = rng(7), m = Math.round(W * H / 34);
        for (i = 0; i < m; i++) {
          var px = r() * W, py = G.top + r() * (H - G.top), a = Math.pow(r(), 3) * .5;
          if (a < .03) continue;
          ctx.fillStyle = 'rgba(220,230,245,' + a.toFixed(3) + ')';
          ctx.fillRect(px, py, .9, .9);
        }
      }
      ctx.restore();
      // передняя кромка: блик по губе капота, под ней тень и тёмная морда с решёткой
      ctx.beginPath(); hline(ctx, 1, -EDGE - .2, EDGE + .2, true); ctx.lineTo(W + 10, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath();
      ctx.fillStyle = '#030304'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,' + (.05 * L).toFixed(3) + ')'; ctx.lineWidth = 1;
      for (i = 1; i <= 5; i++) { ctx.beginPath(); hline(ctx, 1, -.55, .55, true, 10 + i * 9); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); hline(ctx, 1, -EDGE - .2, EDGE + .2, true, -1);
      ctx.strokeStyle = 'rgba(235,240,248,' + (.45 * L).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
    }

    function build() {
      var r = rng(20240917), pad = 120;
      n = Math.round(Math.min(3400, Math.max(900, W * H / 420)));
      segs = new Float32Array(n * 5);
      for (var i = 0; i < n; i++) {
        var o = i * 5;
        segs[o] = -pad + r() * (W + pad * 2); segs[o + 1] = G.top + r() * (G.front - G.top + pad);
        segs[o + 2] = 18 + Math.pow(r(), 1.6) * 210;   // радиус: мелких больше
        segs[o + 3] = 8 + r() * 24;                    // длина блестящего участка, px
        segs[o + 4] = .35 + r() * .65;                 // глубина царапины
      }
    }

    var BUCKETS = 7;
    function fx(lx, ly) {
      if (!W) return;
      xF.clearRect(0, 0, W, H);
      var Rs = Math.max(W, H) * .3, paths = [], i, o;
      for (i = 0; i < BUCKETS; i++) paths.push([]);
      for (i = 0; i < n; i++) {
        o = i * 5;
        var cx = segs[o], cy = segs[o + 1], p = persp(cy), rr = segs[o + 2] * p.s, k = p.k;
        var ux = lx - cx, uy = ly - cy, ul = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= ul; uy /= ul;
        var t = Math.atan2(uy / k, ux), half = segs[o + 3] * p.s / 2 / rr;
        for (var side = 0; side < 2; side++) {
          var tt = side ? t + Math.PI : t;
          var px = cx + rr * Math.cos(tt), py = cy + rr * k * Math.sin(tt);
          if (px < cleanX) continue;
          var d = Math.sqrt((px - lx) * (px - lx) + (py - ly) * (py - ly));
          if (d > Rs || d < 6) continue;
          var a = Math.pow(1 - d / Rs, 2.2) * segs[o + 4] * 1.35;
          if (d < 30) a *= d / 30;                      // в самом блике царапин не видно
          if (a < .05) continue;
          paths[Math.min(BUCKETS - 1, Math.floor(a * BUCKETS))].push(cx, cy, rr, k, tt, half);
        }
      }
      xF.save();
      xF.clip(paint);
      xF.lineWidth = .7;
      xF.lineCap = 'round';
      for (var b = 0; b < BUCKETS; b++) {
        var list = paths[b];
        if (!list.length) continue;
        xF.strokeStyle = 'rgba(236,240,248,' + ((b + .6) / BUCKETS * .8).toFixed(3) + ')';
        xF.beginPath();
        for (i = 0; i < list.length; i += 6) {
          var a0 = list[i + 4] - list[i + 5], a1 = list[i + 4] + list[i + 5];
          xF.moveTo(list[i] + list[i + 2] * Math.cos(a0), list[i + 1] + list[i + 2] * list[i + 3] * Math.sin(a0));
          xF.ellipse(list[i], list[i + 1], list[i + 2], list[i + 2] * list[i + 3], 0, a0, a1);
        }
        xF.stroke();
      }
      // полоса полировальника во время прохода
      if (cleanX > -150 && cleanX < W + 150) {
        var bandG = xF.createLinearGradient(cleanX - 90, 0, cleanX + 20, 0);
        bandG.addColorStop(0, 'rgba(223,231,242,0)');
        bandG.addColorStop(.85, 'rgba(223,231,242,.1)');
        bandG.addColorStop(1, 'rgba(255,255,255,0)');
        xF.fillStyle = bandG;
        xF.fillRect(cleanX - 90, 0, 110, H);
        xF.fillStyle = 'rgba(255,255,255,.25)';
        xF.fillRect(cleanX, 0, 1, H);
      }
      xF.restore();
      // блик лампы на лаке — сплюснут перспективой
      var k0 = ly > G.top ? persp(ly).k : .6;
      xF.save();
      xF.translate(lx, ly); xF.scale(1, k0);
      var hs = xF.createRadialGradient(0, 0, 0, 0, 0, 80);
      hs.addColorStop(0, 'rgba(255,255,255,.95)');
      hs.addColorStop(.06, 'rgba(255,255,255,.75)');
      hs.addColorStop(.22, 'rgba(220,228,240,.16)');
      hs.addColorStop(1, 'rgba(220,228,240,0)');
      xF.fillStyle = hs;
      xF.beginPath(); xF.arc(0, 0, 80, 0, Math.PI * 2); xF.fill();
      xF.restore();
    }

    return {
      resize: function () {
        var rect = media.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (!rect.width || !rect.height) return false;
        var nw = Math.round(rect.width), nh = Math.round(rect.height);
        if (nw === W && nh === H && segs) return false;
        W = nw; H = nh; G = geometry();
        paint = new Path2D();
        for (var i = 0; i <= 40; i++) { var q = G.p(-EDGE + 2 * EDGE * i / 40, 0); if (i) paint.lineTo(q.x, q.y); else paint.moveTo(q.x, q.y); }
        for (i = 0; i <= 40; i++) { q = G.p(EDGE - 2 * EDGE * i / 40, 1); paint.lineTo(q.x, q.y); }
        paint.closePath();
        fit(cD, xD, dpr); fit(cL, xL, dpr); fit(cF, xF, Math.min(dpr, 1.6));
        render(xD, false); render(xL, true); build();
        if (cleanTo > 0) cleanX = cleanTo = W + 200;
        return true;
      },
      size: function () { return { w: W, h: H }; },
      // кадр лампы: вернёт true, пока идёт проход полировальника
      frame: function (lx, ly, now) {
        var busy = false;
        if (cleanX !== cleanTo) {
          var k = Math.min(1, (now - sweepT0) / SWEEP), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          cleanX = cleanFrom + (cleanTo - cleanFrom) * e;
          if (k >= 1) cleanX = cleanTo; else busy = true;
        }
        fx(lx, ly);
        return busy;
      },
      polish: function (on, animate) {
        cleanFrom = cleanX; cleanTo = on ? W + 200 : -200;
        if (!animate) cleanX = cleanTo;
        sweepT0 = performance.now();
      }
    };
  }

  var scene = hood();
  var lamp = (function () {
    var lx = null, ly = null, tx = 0, ty = 0, raf = 0, onFrame = null;
    function set(now) {
      media.style.setProperty('--lx', lx.toFixed(1) + 'px'); media.style.setProperty('--ly', ly.toFixed(1) + 'px');
      return scene ? scene.frame(lx, ly, now || performance.now()) : false;
    }
    function frame(now) {
      raf = 0;
      var busy = onFrame ? !!onFrame(now) : false, ex = tx - lx, ey = ty - ly;
      if (Math.abs(ex) + Math.abs(ey) > .3) { lx += ex * .09; ly += ey * .09; busy = true; } else { lx = tx; ly = ty; }
      if (set(now)) busy = true;
      if (busy) kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    return {
      aim: function (x, y, instant) { tx = x; ty = y; if (instant || lx === null) { lx = x; ly = y; set(); } kick(); },
      redraw: function () { if (lx !== null) set(); },
      onFrame: function (fn) { onFrame = fn; },
      kick: kick
    };
  })();
  // путь лампы без курсора: по капоту справа от текста; на узком экране — над текстом
  function path(t) {
    var w = media.clientWidth, h = media.clientHeight;
    if (w < 760) return { x: w * (.54 + .24 * Math.sin(t * .00027)), y: h * (.47 + .09 * Math.sin(t * .00041 + 1)) };
    return { x: w * (.66 + .16 * Math.sin(t * .00023)), y: h * (.52 + .15 * Math.sin(t * .00037 + 1)) };
  }
  // стоп-кадр без движения: лампа на капоте
  function rest() { var w = media.clientWidth, h = media.clientHeight; return w < 760 ? { x: w * .58, y: h * .5 } : { x: w * .68, y: h * .5 }; }
  var lastPointer = 0, heroVisible = true, AUTO_IDLE = 2400;
  if (scene) scene.resize();
  if (FB.reduced) { var r0 = rest(); lamp.aim(r0.x, r0.y, true); }
  else {
    // старт: лампа входит слева и уходит на капот
    lamp.aim(media.clientWidth * .12, media.clientHeight * .32, true);
    lamp.onFrame(function (now) {
      if (!heroVisible || document.hidden || now - lastPointer < AUTO_IDLE) return false;
      var p = path(now);
      lamp.aim(p.x, p.y);
      return true;
    });
    lamp.kick();
  }
  function local(e) { var r = media.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' && !e.buttons) return;
    var p = local(e); lastPointer = performance.now(); lamp.aim(p.x, p.y, FB.reduced);
  });
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button')) return;
    var p = local(e); lastPointer = performance.now(); lamp.aim(p.x, p.y, FB.reduced);
  });
  hero.addEventListener('pointerleave', function () { lastPointer = performance.now() - AUTO_IDLE + 900; lamp.kick(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; if (heroVisible) lamp.kick(); }).observe(hero);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) lamp.kick(); });
  var resizeT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (scene && scene.resize()) { if (FB.reduced) { var r = rest(); lamp.aim(r.x, r.y, true); } else lamp.redraw(); }
      lamp.kick();
    }, 120);
  });
  // переключатель «До полировки / После»: радиогруппа со стрелками
  var seg = $('#inspectSeg');
  if (!scene) seg.hidden = true;
  function setState(btn, focus) {
    $$('[data-state]', seg).forEach(function (b) { var on = b === btn; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
    if (focus) btn.focus();
    if (scene) { scene.polish(btn.getAttribute('data-state') === 'after', !FB.reduced); lamp.redraw(); lamp.kick(); }
  }
  seg.addEventListener('click', function (e) { var b = e.target.closest('[data-state]'); if (b) setState(b); });
  seg.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var all = $$('[data-state]', seg), i = all.indexOf(document.activeElement);
    setState(all[(i + 1) % all.length], true);
  });

  /* ---------------------------------------------------------------- услуги: перечень строками */

  T.section('services', services.length);
  var demoSvc = T.demo && services.some(function (s) { return (s.zones || []).some(function (z) { return z.demo; }); });
  if (demoSvc) $('#servicesLead').insertAdjacentHTML('beforeend', ' <span class="demo-tag">демо-цены</span>');
  $('#svcList').innerHTML = services.map(function (s, i) {
    // на компьютере первая услуга раскрыта (рядом её фото); на телефоне все строки свёрнуты
    var id = esc(s.id), open = i === 0 && !matchMedia('(max-width: 760px)').matches;
    return '<li class="svc-row' + (open ? ' is-open' : '') + '" data-svc="' + id + '">' +
      '<h3 class="svc-row__h"><button class="svc-row__head" type="button" id="svc-tab-' + id + '" aria-expanded="' + open + '" aria-controls="svc-' + id + '">' +
        '<span class="svc-row__n">' + pad2(i + 1) + '</span><span class="svc-row__name">' + esc(s.name) + '</span>' +
        '<span class="svc-row__from">' + esc(T.priceText(minPrice(s.zones || []))) + '</span><i class="svc-row__icon" aria-hidden="true"></i></button></h3>' +
      '<div class="svc-row__body" id="svc-' + id + '" role="region" aria-labelledby="svc-tab-' + id + '"><div class="svc-row__in">' +
        '<div class="svc-row__photo">' + T.img(s.image, { alt: '' }) + '</div>' +
        (s.short ? '<p class="svc-row__short">' + esc(s.short) + '</p>' : '') +
        '<ul class="svc-row__zones" role="list">' + (s.zones || []).map(function (z) {
          return '<li><span>' + esc(z.name) + '</span><small>' + (z.duration ? esc(T.duration(z.duration)) : '') + '</small><b>' + esc(T.priceText(z.price)) + '</b></li>';
        }).join('') + '</ul>' +
        (s.limits && s.limits.length ? '<p class="svc-row__limits">' + s.limits.map(esc).join('. ') + '.</p>' : '') +
        '<button class="btn btn--line btn--sm" type="button" data-calc-service="' + id + '">Рассчитать для своего авто</button>' +
      '</div></div></li>';
  }).join('');
  $('#svcMedia').innerHTML = services.map(function (s, i) {
    return '<div class="svc__shot' + (i === 0 ? ' is-on' : '') + '" data-shot="' + esc(s.id) + '">' + T.img(s.image, { alt: '' }) +
      '<span class="svc__cap"><b>' + pad2(i + 1) + '</b>' + esc(s.name) + '</span></div>';
  }).join('');
  var svcList = $('#svcList');
  function showShot(id) { $$('.svc__shot', $('#svcMedia')).forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-shot') === id); }); }
  function openId() { var o = $('.svc-row.is-open', svcList); return o ? o.getAttribute('data-svc') : (services[0] && services[0].id); }
  svcList.addEventListener('click', function (e) {
    var head = e.target.closest('.svc-row__head');
    if (!head) return;
    var row = head.closest('.svc-row'), on = !row.classList.contains('is-open');
    $$('.svc-row', svcList).forEach(function (x) {
      var me = x === row && on;
      x.classList.toggle('is-open', me);
      $('.svc-row__head', x).setAttribute('aria-expanded', me);
    });
    showShot(on ? row.getAttribute('data-svc') : openId());
  });
  // на компьютере фото справа меняется при наведении на строку
  svcList.addEventListener('mouseover', function (e) { var row = e.target.closest('.svc-row'); if (row && !touch) showShot(row.getAttribute('data-svc')); });
  svcList.addEventListener('mouseleave', function () { showShot(openId()); });

  /* ---------------------------------------------------------------- пакеты: лист сравнения */

  T.section('packages', T.feature('packages') && packs.length);
  $('#packGrid').style.setProperty('--n', Math.min(packs.length, 3) || 1);
  $('#packGrid').innerHTML = packs.map(function (p, i) {
    var lim = p.limits || [];
    return '<article class="pk" data-reveal><p class="pk__n">Пакет ' + pad2(i + 1) + '</p><h3>' + esc(p.name) + '</h3>' +
      '<div class="pk__price"><b>' + esc(T.priceText(p.price)) + '</b>' + (p.duration ? '<span>' + esc(T.duration(p.duration)) + ' в студии</span>' : '') + '</div>' +
      '<p class="pk__label">Состав</p>' +
      '<ul class="pk__list" role="list">' + (p.composition || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<p class="pk__label">' + (lim.length ? 'Условия' : '') + '</p>' +
      '<ul class="pk__limits" role="list">' + lim.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="pk__go"><button class="btn btn--line btn--sm" type="button" data-calc-pack="' + esc(p.id) + '">Рассчитать пакет</button></div></article>';
  }).join('');
  T.rail($('#packGrid'), 'Готовые наборы');
  var demoPacks = T.demo && packs.some(function (p) { return p.demo; });
  $('#packDemo').hidden = !demoPacks;
  if (demoPacks) $('#packDemo').innerHTML = '<span class="demo-tag">демо-цены</span> Цены пакетов приведены для примера.';

  /* ---------------------------------------------------------------- работы: ровная сетка, цвет под «лампой» */

  var wFilter = 'all';
  T.section('works', T.feature('portfolio') && works.length);
  var demoWorks = T.demo && works.some(function (w) { return w.demo; });
  $('#worksDemo').hidden = !demoWorks;
  if (demoWorks) $('#worksDemo').innerHTML = '<span class="demo-tag">демо</span> Работы — примеры на стоковых фото. Замените их фотографиями автомобилей студии.';
  var wServices = services.filter(function (s) { return works.some(function (w) { return w.service === s.id; }); });
  $('#worksFilter').innerHTML = [{ id: 'all', name: 'Все' }].concat(wServices).map(function (s) {
    return '<button class="chip" type="button" data-wf="' + esc(s.id) + '" aria-pressed="' + (s.id === 'all') + '">' + esc(s.name) + '</button>';
  }).join('');
  // на телефоне курсора нет: цвет появляется у фото, которое проходит через середину экрана
  var litIO = touch && 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (x) { x.target.classList.toggle('is-lit', x.isIntersecting); });
  }, { rootMargin: '-38% 0px -38% 0px' }) : null;
  function renderWorks(animate) {
    var list = works.filter(function (w) { return wFilter === 'all' || w.service === wFilter; });
    $('#worksGrid').innerHTML = list.map(function (w) {
      var s = T.byId(services, w.service);
      return '<figure class="work"><div class="work__img">' + T.img(w.image) + '</div><figcaption><span>' + esc(s ? s.name : '') + '</span>' + esc(w.title) + '</figcaption></figure>';
    }).join('');
    if (litIO) { litIO.disconnect(); $$('#worksGrid .work').forEach(function (el) { litIO.observe(el); }); }
    if (animate && canAnimate) $$('#worksGrid .work').forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 50, easing: EASE, fill: 'backwards' });
    });
  }
  $('#worksFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wf]');
    if (!b || b.getAttribute('aria-pressed') === 'true') return;
    wFilter = b.getAttribute('data-wf');
    $$('#worksFilter [data-wf]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderWorks(true);
  });
  renderWorks(false);

  /* ---------------------------------------------------------------- до / после: только реальные фото */

  // только пары одной работы (sameCar) и только если оба фото есть; иллюстрации и заглушки не показываем
  var pairs = T.list('beforeAfter').filter(function (p) { return p.sameCar === true && !p.illustration && T.asset(p.before) && T.asset(p.after); });
  T.section('compare', T.feature('beforeAfter') && pairs.length);
  $('#compareList').innerHTML = pairs.map(function (p, i) {
    var id = 'ba-' + i;
    return '<figure class="ba" style="--pos:50%">' +
      '<div class="ba__stage"><div class="ba__after">' + T.img(p.after) + '</div><div class="ba__before" aria-hidden="true">' + T.img(p.before, { alt: '' }) + '</div>' +
      '<span class="ba__line" aria-hidden="true"><span class="ba__knob"></span></span><span class="ba__tag ba__tag--l">до</span><span class="ba__tag ba__tag--r">после</span>' +
      '<input class="ba__range" type="range" id="' + id + '" min="0" max="100" value="50" step="1" aria-label="Положение сравнения до и после для «' + esc(p.title) + '»" aria-valuetext="50% кадра до"></div>' +
      '<figcaption>' + esc(p.title) + T.demoTag(p.demo) + '</figcaption></figure>';
  }).join('');
  $$('.ba').forEach(function (fig) {
    var r = $('.ba__range', fig), stage = $('.ba__stage', fig);
    function set(v) { v = Math.max(0, Math.min(100, Math.round(v))); r.value = v; fig.style.setProperty('--pos', v + '%'); r.setAttribute('aria-valuetext', v + '% кадра до'); }
    r.addEventListener('input', function () { set(+r.value); });
    // перетаскивание по всему кадру, а не только по ползунку
    var drag = false;
    function at(e) { var b = stage.getBoundingClientRect(); set((e.clientX - b.left) / b.width * 100); }
    stage.addEventListener('pointerdown', function (e) { drag = true; stage.setPointerCapture(e.pointerId); at(e); r.focus({ preventScroll: true }); });
    stage.addEventListener('pointermove', function (e) { if (drag) at(e); });
    stage.addEventListener('pointerup', function () { drag = false; });
    stage.addEventListener('pointercancel', function () { drag = false; });
  });

  /* ---------------------------------------------------------------- процесс, материалы, команда, уход */

  var proc = T.list('process');
  $('#procList').hidden = !proc.length;
  $('#procList').innerHTML = proc.map(function (s, i) {
    return '<li class="proc__step" data-reveal style="--i:' + i + '"><span class="proc__n">' + pad2(i + 1) + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
  }).join('');
  var mats = T.list('materials'), team = T.list('team');
  $('#materialsBox').hidden = !mats.length;
  if (T.demo && mats.some(function (m) { return m.demo; })) $('#materialsBox .side-title').insertAdjacentHTML('beforeend', ' <span class="demo-tag">укажите марки</span>');
  $('#matList').innerHTML = mats.map(function (m) { return '<li><b>' + esc(m.name) + '</b><span>' + esc(m.text || '') + '</span></li>'; }).join('');
  $('#teamBox').hidden = !(T.feature('team') && team.length);
  if (T.demo && team.some(function (m) { return m.demo; })) $('#teamBox .side-title').insertAdjacentHTML('beforeend', ' <span class="demo-tag">примеры ролей</span>');
  $('#teamList').innerHTML = team.map(function (m) { return '<li><b>' + esc(m.name || m.role) + '</b><span>' + esc([m.name ? m.role : '', m.area].filter(Boolean).join(' · ')) + '</span></li>'; }).join('');

  var care = T.list('care'), warranty = T.list('warranty');
  $('#careBox').hidden = !(care.length || warranty.length);
  $('#careList').innerHTML = care.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
  $('#warrantyBox').hidden = !warranty.length;   // гарантии — только из данных студии
  $('#warrantyList').innerHTML = warranty.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
  $('#passport').hidden = $$('.passport__col', $('#passport')).every(function (c) { return c.hidden; });
  // на телефоне колонки паспорта — раскрывающиеся строки с числом пунктов (стили — max-width: 760px)
  $$('.passport__col', $('#passport')).forEach(function (col, k) {
    var t = col.querySelector('.side-title'), n = $$('li', col).length;
    if (!t) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'passport__toggle';
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', col.id);
    b.innerHTML = '<span>' + esc(t.childNodes[0].textContent.trim()) + '</span><small>' + n + '</small>';
    b.addEventListener('click', function () { var o = !col.classList.contains('is-open'); col.classList.toggle('is-open', o); b.setAttribute('aria-expanded', String(o)); });
    col.insertBefore(b, col.firstChild);
  });
  T.section('process', proc.length || !$('#passport').hidden);

  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);
  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);

  // длинная подсказка общего слоя о пустых контактах — одной демо-строкой; реквизиты — в консоль
  if (T.demo) {
    var note = $('.contact-row--note');
    if (note) {
      note.remove();
      $('#contactsDemo').hidden = false;
      $('#contactsDemo').innerHTML = '<span class="demo-tag">демо</span> Телефон, почта и Telegram появятся после заполнения <code>config.js → contacts</code>.';
    }
    var l = C.legal || {}, req = $('.legal-req');
    if (req && !(l.operator && l.inn)) { req.remove(); console.info('[detailing] Демо: реквизиты появятся после заполнения config.js → legal.'); }
  }

  /* ---------------------------------------------------------------- расчёт на одном экране */

  var form = $('#calcForm');
  $('#cClasses').style.setProperty('--n', Math.min(classes.length, 4) || 1);
  $('#cClasses').innerHTML = classes.map(function (c) {
    return '<label class="seg__item"><input type="radio" name="carClass" value="' + esc(c.id) + '" required data-msg="Выберите класс автомобиля"><b>' + esc(c.name) + '</b></label>';
  }).join('');
  $('#cServices').innerHTML = services.map(function (s) {
    return '<label class="pill"><input type="radio" name="service" value="' + esc(s.id) + '" required data-msg="Выберите услугу"><span>' + esc(s.name) + '</span></label>';
  }).join('') + (packs.length && T.feature('packages') ? '<label class="pill pill--pack"><input type="radio" name="service" value="' + PACKAGE + '" required data-msg="Выберите услугу"><span>Готовый пакет</span></label>' : '');
  $('#cConsent').innerHTML = T.consentHtml('cConsentBox');
  FB.files($('#cPhotos'), { max: 3, maxSize: 10 * 1024 * 1024, list: $('#cPhotoList') });

  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function coefNow() { var c = T.byId(classes, val('carClass')); return c ? c.coef || 1 : 1; }
  function renderClassHint() {
    var c = T.byId(classes, val('carClass'));
    $('#cClassHint').textContent = c ? 'Например: ' + (c.example || '') + (c.coef !== 1 ? ' · цены ×' + String(c.coef).replace('.', ',') : ' · базовые цены') : 'Цены зависят от размера кузова.';
  }
  function renderExtras() {
    var k = coefNow(), on = $$('input[name=extras]:checked', form).map(function (x) { return x.value; });
    $('#cExtras').innerHTML = extras.map(function (x) {
      return '<label class="pill pill--check"><input type="checkbox" name="extras" value="' + esc(x.id) + '"' + (on.indexOf(x.id) > -1 ? ' checked' : '') + '><span>' + esc(x.name) + '</span><small>' + esc(T.priceText(x.price, x.coef ? k : 1).replace(/^По запросу$/, 'по запросу')) + '</small></label>';
    }).join('');
  }
  // варианты услуги (или пакеты) — с ценой уже для выбранного класса
  function renderZones(keep) {
    var sid = val('service'), prev = keep ? val('zone') : '', k = coefNow();
    var list = sid === PACKAGE ? packs : ((T.byId(services, sid) || {}).zones || []);
    $('#cZoneTitle').textContent = sid === PACKAGE ? 'Какой пакет' : 'Вариант';
    $('#cZones').innerHTML = !sid ? '<p class="group__empty">Сначала выберите услугу.</p>' : list.map(function (z) {
      return '<label class="choice"><input type="radio" name="zone" value="' + esc(z.id) + '" required data-msg="Выберите вариант"' + (z.id === prev ? ' checked' : '') + '>' +
        '<span class="choice__name">' + esc(z.name) + '</span><span class="choice__meta"><b>' + esc(T.priceText(z.price, k)) + '</b>' + (z.duration ? ' · ' + esc(T.duration(z.duration)) : '') + '</span>' +
        (z.composition ? '<span class="choice__sub">' + esc(z.composition.join(', ')) + '</span>' : '') + '</label>';
    }).join('') || '<p class="group__empty">Для этой услуги варианты не заданы — стоимость назовём после осмотра.</p>';
    var s = T.byId(services, sid), limits = sid === PACKAGE ? [] : (s && s.limits) || [];
    $('#cLimits').innerHTML = limits.length ? '<p class="limits">' + limits.map(esc).join('. ') + '.</p>' : '';
  }

  function calc() {
    var cls = T.byId(classes, val('carClass')), sid = val('service'), zid = val('zone');
    var coef = cls ? cls.coef || 1 : 1, items = [], lines = [], durMin = 0, durMax = 0;
    var zone = sid === PACKAGE ? T.byId(packs, zid) : T.byId((T.byId(services, sid) || {}).zones, zid);
    if (zone) {
      items.push({ price: zone.price, coef: coef });
      lines.push([(sid === PACKAGE ? 'Пакет «' + zone.name + '»' : (T.byId(services, sid) || {}).name + ' · ' + zone.name.charAt(0).toLowerCase() + zone.name.slice(1)), T.priceText(zone.price, coef)]);
      durMin += T.durMin(zone.duration); durMax += T.durMax(zone.duration);
    }
    $$('input[name=extras]:checked', form).forEach(function (c) {
      var x = T.byId(extras, c.value);
      if (!x) return;
      var k = x.coef ? coef : 1;
      items.push({ price: x.price, coef: k });
      lines.push([x.name, T.priceText(x.price, k)]);
    });
    return { cls: cls, sid: sid, zone: zone, items: items, lines: lines, sum: T.sum(items), durMin: durMin, durMax: durMax };
  }
  var shownTotal = '';
  // плашка не пустует: до выбора в ней видно, чего не хватает для ориентира
  function renderSummary() {
    var r = calc(), box = $('#sumBody'), plate = $('#summary');
    function row(dt, dd, empty) { return '<div' + (empty ? ' class="is-empty"' : '') + '><dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd></div>'; }
    var svc = r.sid === PACKAGE ? 'Пакет' : r.sid ? (T.byId(services, r.sid) || {}).name : '';
    var total = r.zone ? r.sum.text : 'после выбора варианта';
    box.innerHTML = '<dl class="plate__rows">' +
      (r.cls ? row('Класс', r.cls.name + (r.cls.coef !== 1 ? ' · ×' + String(r.cls.coef).replace('.', ',') : '')) : row('Класс', 'не выбран', true)) +
      (r.zone ? row(r.lines[0][0], r.lines[0][1]) : row(svc || 'Услуга', svc ? 'выберите вариант' : 'не выбрана', true)) +
      r.lines.slice(r.zone ? 1 : 0).map(function (l) { return row(l[0], l[1]); }).join('') + '</dl>' +
      '<p class="plate__total' + (r.zone ? '' : ' is-empty') + '"><span>Итого, ориентир</span><b>' + esc(total) + '</b></p>' +
      (r.durMax ? '<p class="plate__time">В студии ≈ ' + esc(T.duration(r.durMin === r.durMax ? r.durMin : { min: r.durMin, max: r.durMax })) + '</p>' : '') +
      '<p class="plate__note">' + (pricing.demo && T.demo ? '<span class="demo-tag">демо-цены</span> ' : '') + esc(pricing.note || 'Итоговую стоимость уточняем после осмотра.') + '</p>';
    // по плашке проходит блик, когда меняется сумма
    if (canAnimate && total !== shownTotal && r.zone) { plate.classList.remove('is-sweep'); void plate.offsetWidth; plate.classList.add('is-sweep'); }
    shownTotal = r.zone ? total : '';
    calcBar.querySelector('b').textContent = r.zone ? total : '';
    calcBar.dataset.ready = r.zone ? '1' : '';
    syncBar();
  }

  // Телефон: пока виден расчёт, а плашка «Ориентир» под формой за экраном, внизу — сумма и переход к плашке
  var calcBar = document.createElement('a');
  calcBar.className = 'calc-bar';
  calcBar.href = '#summary';
  calcBar.hidden = true;
  calcBar.innerHTML = '<span>Ориентир</span><b></b><i aria-hidden="true">Подробнее</i>';
  document.body.appendChild(calcBar);
  var seenForm = false, seenPlate = false;
  function syncBar() { calcBar.hidden = !(calcBar.dataset.ready && seenForm && !seenPlate && matchMedia('(max-width: 760px)').matches); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.target === form) seenForm = e.isIntersecting; else seenPlate = e.isIntersecting; }); syncBar(); }, { threshold: 0.05 })
      .observe(form);
    new IntersectionObserver(function (en) { seenPlate = en[0].isIntersecting; syncBar(); }, { threshold: 0.3 }).observe($('#summary'));
  }

  var wiz = T.wizard(form, { progress: $('#calcSteps') });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') renderZones(false);
    if (e.target.name === 'carClass') { renderClassHint(); renderZones(true); renderExtras(); }
    renderSummary();
  });
  form.addEventListener('fb:reset', function () { renderClassHint(); renderZones(false); renderExtras(); renderSummary(); });
  renderClassHint(); renderZones(false); renderExtras(); renderSummary();

  function preselect(service, zone) {
    var r = form.querySelector('input[name=service][value="' + service + '"]');
    if (r) r.checked = true;
    renderZones(false);
    if (zone) { var z = form.querySelector('input[name=zone][value="' + zone + '"]'); if (z) z.checked = true; }
    renderSummary();
    if (!$('#calcResult').hidden) { $('#calcResult').hidden = true; form.hidden = false; }
    wiz.go(0, false);
    FB.scrollTo('#calc');
  }
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-calc-service]'), p = e.target.closest('[data-calc-pack]');
    if (s) preselect(s.getAttribute('data-calc-service'));
    if (p) preselect(PACKAGE, p.getAttribute('data-calc-pack'));
  });

  T.leadForm(form, {
    type: 'detailing_quote',
    result: $('#calcResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Запрос расчёта принят',
    successText: (C.booking && C.booking.successText) || '',
    collect: function (fd) {
      var r = calc();
      var sName = r.sid === PACKAGE ? 'Пакет' : (T.byId(services, r.sid) || {}).name;
      return {
        service: sName + (r.zone ? ': ' + r.zone.name : ''),
        car: [fd.get('brand'), fd.get('model')].filter(Boolean).join(' ') || (r.cls ? r.cls.name + ' класс' : ''),
        total: r.zone ? r.sum.text : '',
        consent: fd.get('consent') === 'да',
        details: {
          'Класс': r.cls ? r.cls.name : '—',
          'Допуслуги': r.lines.slice(1).map(function (l) { return l[0]; }).join(', ') || '—',
          'Время работы': r.durMax ? T.duration({ min: r.durMin, max: r.durMax }) : '—',
          'Расчёт': 'ориентир с сайта, итог после осмотра',
          'Коды': [r.cls && r.cls.id, r.sid, r.zone && r.zone.id].concat(fd.getAll('extras')).filter(Boolean).join(', ')
        },
        carClass: undefined, zone: undefined, extras: undefined, brand: undefined, model: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Работа</dt><dd>' + esc(p.service) + '</dd>' + (p.total ? '<dt>Ориентир</dt><dd>' + esc(p.total) + '</dd>' : '') + '<dt>Итог</dt><dd>после осмотра</dd></dl>';
    }
  });

  T.mobileCta(cta.label || 'Рассчитать стоимость', 'calc');
});
