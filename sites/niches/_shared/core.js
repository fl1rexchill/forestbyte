/*!
 * Forestbyte niches — общее ядро сайтов (без зависимостей, classic script, работает и с file://).
 *
 * Подключение (в конце <body>):
 *   <script src="../_shared/vendor/lenis.min.js"></script>
 *   <script src="../_shared/vendor/anime.umd.min.js"></script>
 *   <script src="../_shared/core.js"></script>
 *   <script src="app.js"></script>        // внутри: FB.init({...})
 *
 * В <head> — сниппет, который прячет [data-reveal] до запуска ядра и сам снимает
 * скрытие, если ядро не загрузилось (контент никогда не пропадёт):
 *   <script>(function(d){if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('fb-motion');setTimeout(function(){if(!(window.FB&&FB.started))d.classList.remove('fb-motion')},2500)}})(document.documentElement)</script>
 *
 * Конфиг сайта — window.SITE = { site, name, phone, telegram, endpoint } до подключения ядра.
 */
(function () {
  'use strict';

  var FB = (window.FB = window.FB || {});
  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  FB.reduced = reduced;
  FB.anime = window.anime || null;
  FB.config = Object.assign(
    { site: 'demo', name: 'Сайт', phone: '', telegram: '', endpoint: '/api/lead', debug: false },
    window.SITE || {}
  );

  /* ------------------------------------------------------------------ утилиты */

  FB.$ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  FB.$$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  FB.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var nf = new Intl.NumberFormat('ru-RU');
  FB.num = function (n) { return nf.format(Math.round(n)); };
  FB.money = function (n) { return nf.format(Math.round(n)) + ' ₽'; };

  /** FB.plural(5, ['день','дня','дней']) → 'дней' */
  FB.plural = function (n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };

  FB.debounce = function (fn, ms) {
    var t;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  };

  /** Детерминированный «случайный» генератор — одинаковый результат для одного ключа */
  FB.seeded = function (key) {
    var h = 1779033703 ^ String(key).length;
    for (var i = 0; i < String(key).length; i++) {
      h = Math.imul(h ^ String(key).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    var s = h >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ------------------------------------------------------------------ даты */

  FB.iso = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  FB.parseIso = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  FB.today = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  FB.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  FB.days = function (n, from) {
    var start = from ? new Date(from) : FB.today(), out = [];
    for (var i = 0; i < n; i++) out.push(FB.addDays(start, i));
    return out;
  };
  FB.fmtDate = function (d, opts) {
    if (typeof d === 'string') d = FB.parseIso(d);
    return d.toLocaleDateString('ru-RU', opts || { day: 'numeric', month: 'long' });
  };
  FB.weekday = function (d, short) { return d.toLocaleDateString('ru-RU', { weekday: short ? 'short' : 'long' }); };
  /** Время уже прошло сегодня? (для блокировки слотов) */
  FB.isPastSlot = function (dateIso, time) {
    var p = time.split(':'), d = FB.parseIso(dateIso);
    d.setHours(+p[0], +p[1], 0, 0);
    return d.getTime() < Date.now() + 30 * 60 * 1000;
  };

  /* ------------------------------------------------------------------ хранилище */

  FB.store = {
    get: function (k, def) {
      try { var v = localStorage.getItem('fb:' + FB.config.site + ':' + k); return v == null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set: function (k, v) {
      try { localStorage.setItem('fb:' + FB.config.site + ':' + k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    del: function (k) { try { localStorage.removeItem('fb:' + FB.config.site + ':' + k); } catch (e) {} }
  };

  /* ------------------------------------------------------------------ аналитика */

  FB.track = function (event, data) {
    var payload = Object.assign({ event: event, site: FB.config.site }, data || {});
    (window.dataLayer = window.dataLayer || []).push(payload);
    if (FB.config.debug) console.debug('[track]', event, data || '');
  };

  // UTM-метки сохраняем на сессию и прикладываем к заявке
  (function captureUtm() {
    try {
      var q = new URLSearchParams(location.search), utm = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (q.get(k)) utm[k] = q.get(k); });
      if (Object.keys(utm).length) sessionStorage.setItem('fb:utm', JSON.stringify(utm));
      if (!sessionStorage.getItem('fb:ref') && document.referrer) sessionStorage.setItem('fb:ref', document.referrer);
    } catch (e) {}
  })();
  FB.utm = function () {
    try { return Object.assign(JSON.parse(sessionStorage.getItem('fb:utm') || '{}'), { referrer: sessionStorage.getItem('fb:ref') || '' }); }
    catch (e) { return {}; }
  };

  /* ------------------------------------------------------------------ тосты */

  var toastBox;
  FB.toast = function (msg, type, ms) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'fb-toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    var t = document.createElement('div');
    t.className = 'fb-toast' + (type ? ' fb-toast--' + type : '');
    t.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 320);
    }, ms || 4200);
  };

  /* ------------------------------------------------------------------ скролл */

  FB.lenis = null;
  FB.headerOffset = function () {
    var v = parseFloat(getComputedStyle(root).getPropertyValue('--header-h'));
    return isNaN(v) ? 0 : v;
  };

  FB.scrollTo = function (target, opts) {
    opts = opts || {};
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    var offset = opts.offset != null ? opts.offset : -FB.headerOffset() - 12;
    if (typeof target === 'number') {
      if (FB.lenis) FB.lenis.scrollTo(target, { immediate: reduced });
      else window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    if (!el) return;
    if (FB.lenis) {
      FB.lenis.scrollTo(el, { offset: offset, duration: opts.duration || 1.2, immediate: reduced });
    } else {
      var y = el.getBoundingClientRect().top + window.pageYOffset + offset;
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    }
    // переносим фокус для клавиатуры/скринридеров
    if (opts.focus !== false) {
      if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
      setTimeout(function () { el.focus({ preventScroll: true }); }, reduced ? 0 : 700);
    }
  };

  var scrollSubs = [];
  FB.onScroll = function (cb) { scrollSubs.push(cb); cb(window.pageYOffset); };
  function emitScroll() { var y = window.pageYOffset; for (var i = 0; i < scrollSubs.length; i++) scrollSubs[i](y); }

  var lockCount = 0;
  FB.lockScroll = function (on) {
    lockCount = Math.max(0, lockCount + (on ? 1 : -1));
    var locked = lockCount > 0;
    if (FB.lenis) locked ? FB.lenis.stop() : FB.lenis.start();
    root.style.overflow = locked ? 'hidden' : '';
  };

  function initScroll(opts) {
    if (!reduced && window.Lenis && opts.smooth !== false) {
      try {
        FB.lenis = new window.Lenis({ autoRaf: true, lerp: opts.lerp || 0.1, wheelMultiplier: 1, smoothWheel: true });
        FB.lenis.on('scroll', emitScroll);
        root.classList.add('has-lenis');
      } catch (e) { FB.lenis = null; }
    }
    if (!FB.lenis) window.addEventListener('scroll', emitScroll, { passive: true });

    // якоря с учётом фиксированной шапки
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || a.hasAttribute('data-no-scroll')) return;
      var id = a.getAttribute('href');
      if (id.length < 2) { e.preventDefault(); FB.scrollTo(0); return; }
      var el = document.getElementById(decodeURIComponent(id.slice(1)));
      if (!el) return;
      e.preventDefault();
      if (FB.modal.current()) FB.modal.close(true); // ссылка из модалки: закрываем и едем к блоку
      document.dispatchEvent(new CustomEvent('fb:navigate', { detail: { id: id } }));
      FB.scrollTo(el);
      if (history.replaceState) history.replaceState(null, '', id);
    });

    // класс «прокручено» для шапки + направление
    var lastY = 0;
    FB.onScroll(function (y) {
      root.classList.toggle('is-scrolled', y > 10);
      if (Math.abs(y - lastY) > 6) {
        root.classList.toggle('is-scrolling-down', y > lastY && y > 300);
        lastY = y;
      }
    });
  }

  /* ------------------------------------------------------------------ появление */

  /** Разбивает текст заголовка на слова, сохраняя <em>, <br>, <strong> */
  FB.split = function (el) {
    if (el.__split) return;
    el.__split = true;
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          // делим только по обычным пробелам: неразрывный пробел (&nbsp;) склеивает слова
          var parts = ch.textContent.split(/([ \t\n\r]+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'), inner = document.createElement('span');
            w.className = 'w';
            inner.textContent = p;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') {
          walk(ch);
        }
      });
    })(el);
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  };

  var io;
  FB.reveal = function (ctx) {
    var els = FB.$$('[data-reveal], [data-split]', ctx);
    FB.$$('[data-split]', ctx).forEach(FB.split);
    var boxes = FB.$$('[data-stagger]', ctx);
    if (ctx && ctx.hasAttribute && ctx.hasAttribute('data-stagger')) boxes.push(ctx);
    boxes.forEach(function (box) {
      var step = parseFloat(box.getAttribute('data-stagger')) || 80;
      FB.$$(':scope > [data-reveal]', box).forEach(function (c, k) { c.style.setProperty('--reveal-delay', (k * step) / 1000 + 's'); });
    });
    if (!root.classList.contains('fb-motion') || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            en.target.dispatchEvent(new CustomEvent('fb:in'));
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    }
    els.forEach(function (e) { if (!e.classList.contains('is-in')) io.observe(e); });
  };

  /** Счётчики: <span data-count="1200" data-suffix="+">0</span> */
  FB.counters = function (ctx) {
    FB.$$('[data-count]', ctx).forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count')), suffix = el.getAttribute('data-suffix') || '';
      var dec = (String(to).split('.')[1] || '').length;
      var show = function (v) { el.textContent = (dec ? v.toFixed(dec).replace('.', ',') : FB.num(v)) + suffix; };
      if (reduced || !('IntersectionObserver' in window)) { show(to); return; }
      show(0);
      var ob = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        ob.disconnect();
        var t0 = performance.now(), dur = 1600;
        (function tick(t) {
          var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          show(to * e);
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      }, { threshold: 0.4 });
      ob.observe(el);
    });
  };

  /* ------------------------------------------------------------------ модалки */

  var openModal = null, lastFocus = null;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  FB.modal = {
    open: function (id, opener) {
      var m = typeof id === 'string' ? document.getElementById(id) : id;
      if (!m) return;
      if (openModal && openModal !== m) FB.modal.close(true);
      lastFocus = opener || document.activeElement;
      m.classList.add('is-open');
      m.removeAttribute('aria-hidden');
      var dlg = m.querySelector('.fb-modal__dialog');
      if (dlg) dlg.setAttribute('data-lenis-prevent', '');
      openModal = m;
      FB.lockScroll(true);
      setTimeout(function () {
        var f = m.querySelector('[autofocus]') || m.querySelector(FOCUSABLE);
        if (f) f.focus();
      }, 60);
      m.dispatchEvent(new CustomEvent('fb:open', { detail: { opener: opener } }));
    },
    close: function (silent) {
      var m = openModal;
      if (!m) return;
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden', 'true');
      openModal = null;
      FB.lockScroll(false);
      m.dispatchEvent(new CustomEvent('fb:close'));
      if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
    },
    current: function () { return openModal; }
  };

  function wireModals() {
    FB.$$('.fb-modal').forEach(function (m) { if (!m.classList.contains('is-open')) m.setAttribute('aria-hidden', 'true'); });
    document.addEventListener('click', function (e) {
      var op = e.target.closest && e.target.closest('[data-open]');
      if (op) {
        e.preventDefault();
        FB.modal.open(op.getAttribute('data-open'), op);
        FB.track('click_primary_cta', { target: op.getAttribute('data-open'), label: op.textContent.trim().slice(0, 40) });
        return;
      }
      if (openModal && (e.target.closest('[data-close]') || e.target.classList.contains('fb-modal__backdrop'))) {
        e.preventDefault();
        FB.modal.close();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!openModal) return;
      if (e.key === 'Escape') { FB.modal.close(); return; }
      if (e.key === 'Tab') {
        var f = FB.$$(FOCUSABLE, openModal).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ------------------------------------------------------------------ мобильное меню */

  function wireNav() {
    FB.$$('[data-nav-toggle]').forEach(function (btn) {
      var target = document.getElementById(btn.getAttribute('aria-controls'));
      if (!target) return;
      var set = function (open) {
        btn.setAttribute('aria-expanded', String(open));
        target.classList.toggle('is-open', open);
        root.classList.toggle('nav-open', open);
        FB.lockScroll(open);
      };
      btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
      target.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
      window.addEventListener('resize', FB.debounce(function () { if (window.innerWidth > 960 && btn.getAttribute('aria-expanded') === 'true') set(false); }, 150));
    });
  }

  /* ------------------------------------------------------------------ телефон */

  FB.phoneDigits = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d && d[0] !== '7') d = '7' + d;
    return d.slice(0, 11);
  };
  FB.phoneFormat = function (v) {
    var d = FB.phoneDigits(v);
    if (!d) return '';
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  };
  FB.phoneMask = function (input) {
    if (input.__mask) return;
    input.__mask = true;
    input.setAttribute('inputmode', 'tel');
    input.setAttribute('autocomplete', 'tel');
    if (!input.placeholder) input.placeholder = '+7 (___) ___-__-__';
    input.addEventListener('input', function () {
      var atEnd = input.selectionStart === input.value.length;
      var d = input.value.replace(/\D/g, '');
      // «8», набранная после автоподставленного «+7», — это привычный код страны, а не цифра номера
      if (d === '78') d = '7';
      else if (d.length === 12 && d[0] === '7' && d[1] === '8') d = '7' + d.slice(2);
      input.value = FB.phoneFormat(d);
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener('focus', function () { if (!input.value) input.value = '+7 '; });
    input.addEventListener('blur', function () { if (FB.phoneDigits(input.value).length <= 1) input.value = ''; });
  };

  /* ------------------------------------------------------------------ валидация */

  var MSG = {
    required: 'Заполните поле',
    name: 'Укажите имя — хотя бы 2 буквы',
    phone: 'Введите номер полностью: +7 (XXX) XXX-XX-XX',
    email: 'Похоже, в адресе почты опечатка',
    contact: 'Укажите телефон или @ник в Telegram',
    consent: 'Нужно согласие, чтобы мы могли связаться с вами',
    choose: 'Выберите вариант',
    min: 'Слишком коротко'
  };

  FB.validateField = function (el) {
    var rule = el.getAttribute('data-validate') || '';
    var v = el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
    var req = el.required || /\brequired\b/.test(rule);
    if (el.type === 'checkbox') return req && !v ? (el.getAttribute('data-msg') || MSG.consent) : '';
    if (el.type === 'radio') {
      var group = el.form ? FB.$$('input[type=radio][name="' + el.name + '"]', el.form) : [el];
      return req && !group.some(function (r) { return r.checked; }) ? (el.getAttribute('data-msg') || MSG.choose) : '';
    }
    if (!v) return req ? (el.getAttribute('data-msg') || MSG.required) : '';
    if (/\bname\b/.test(rule) && !/^[A-Za-zА-Яа-яЁё\-\s']{2,60}$/.test(v)) return MSG.name;
    if (/\bphone\b/.test(rule) && FB.phoneDigits(v).length !== 11) return MSG.phone;
    if (/\bemail\b/.test(rule) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MSG.email;
    if (/\bcontact\b/.test(rule) && !(FB.phoneDigits(v).length === 11 || /^@?[A-Za-z0-9_]{4,32}$/.test(v))) return MSG.contact;
    var m = rule.match(/\bmin:(\d+)/);
    if (m && v.length < +m[1]) return el.getAttribute('data-msg') || MSG.min;
    return '';
  };

  FB.setError = function (el, msg) {
    var box = el.closest('[data-field]') || el.parentElement;
    var err = box.querySelector('.fb-err');
    if (!err) {
      err = document.createElement('span');
      err.className = 'fb-err';
      err.id = 'err-' + Math.random().toString(36).slice(2, 8);
      err.setAttribute('aria-live', 'polite');
      box.appendChild(err);
    }
    err.textContent = msg || '';
    var targets = el.type === 'radio' && el.form ? FB.$$('input[type=radio][name="' + el.name + '"]', el.form) : [el];
    targets.forEach(function (t) {
      if (msg) { t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', err.id); }
      else { t.removeAttribute('aria-invalid'); }
    });
    box.classList.toggle('has-error', !!msg);
  };

  FB.validate = function (form) {
    var fields = FB.$$('[data-validate], [required]', form).filter(function (el) {
      return !el.disabled && !el.closest('[hidden]') && !el.closest('.hp-field');
    });
    var first = null, seenRadio = {};
    fields.forEach(function (el) {
      if (el.type === 'radio') { if (seenRadio[el.name]) return; seenRadio[el.name] = true; }
      var msg = FB.validateField(el);
      FB.setError(el, msg);
      if (msg && !first) first = el;
    });
    if (first) {
      first.focus({ preventScroll: true });
      FB.scrollTo(first.closest('[data-field]') || first, { focus: false, offset: -FB.headerOffset() - 60 });
    }
    return !first;
  };

  /* ------------------------------------------------------------------ файлы */

  /**
   * Поле загрузки с превью и лимитами.
   * FB.files(input, { max: 5, maxSize: 8*1024*1024, list: ulElement })
   * Выбранные файлы: input.fbFiles (массив File)
   */
  FB.files = function (input, opts) {
    opts = Object.assign({ max: 5, maxSize: 8 * 1024 * 1024 }, opts || {});
    input.fbFiles = [];
    var list = opts.list;
    var accept = (input.getAttribute('accept') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var okType = function (f) {
      if (!accept.length) return true;
      return accept.some(function (a) {
        if (a.endsWith('/*')) return f.type.indexOf(a.slice(0, -1)) === 0;
        if (a[0] === '.') return f.name.toLowerCase().endsWith(a);
        return f.type === a;
      });
    };
    function render() {
      if (!list) return;
      list.innerHTML = '';
      input.fbFiles.forEach(function (f, i) {
        var li = document.createElement('li');
        li.className = 'fb-file';
        if (f.type.indexOf('image/') === 0) {
          var img = document.createElement('img');
          img.alt = '';
          img.src = URL.createObjectURL(f);
          img.onload = function () { URL.revokeObjectURL(img.src); };
          li.appendChild(img);
        }
        var name = document.createElement('span');
        name.textContent = f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' КБ';
        li.appendChild(name);
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'fb-file__rm';
        rm.setAttribute('aria-label', 'Удалить ' + f.name);
        rm.textContent = '×';
        rm.addEventListener('click', function () { input.fbFiles.splice(i, 1); render(); });
        li.appendChild(rm);
        list.appendChild(li);
      });
      input.dispatchEvent(new CustomEvent('fb:files', { detail: input.fbFiles }));
    }
    function add(files) {
      Array.prototype.forEach.call(files, function (f) {
        if (input.fbFiles.length >= opts.max) { FB.toast('Можно приложить не больше ' + opts.max + ' ' + FB.plural(opts.max, ['файла', 'файлов', 'файлов']), 'error'); return; }
        if (!okType(f)) { FB.toast('«' + f.name + '» — неподходящий формат', 'error'); return; }
        if (f.size > opts.maxSize) { FB.toast('«' + f.name + '» больше ' + Math.round(opts.maxSize / 1048576) + ' МБ', 'error'); return; }
        input.fbFiles.push(f);
        FB.track('upload_file', { type: f.type });
      });
      render();
    }
    input.addEventListener('change', function () { add(input.files); input.value = ''; });
    var drop = input.closest('[data-drop]');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-drag'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-drag'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer) add(e.dataTransfer.files); });
    }
    input.fbReset = function () { input.fbFiles = []; render(); };
    return input;
  };

  FB.readFiles = function (files) {
    return Promise.all((files || []).map(function (f) {
      return new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res({ name: f.name, type: f.type, size: f.size, data: String(r.result).split(',')[1] }); };
        r.onerror = function () { rej(new Error('Не удалось прочитать файл ' + f.name)); };
        r.readAsDataURL(f);
      });
    }));
  };

  /* ------------------------------------------------------------------ заявки */

  function serverMode() {
    return /^https?:$/.test(location.protocol) && !!FB.config.endpoint && !FB.config.demo;
  }
  function prefix() { return (FB.config.prefix || FB.config.site.slice(0, 2)).toUpperCase(); }

  function fetchJson(url, opts, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 15000);
    return fetch(url, Object.assign({ signal: ctrl && ctrl.signal, headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) {
        clearTimeout(timer);
        if (r.status === 404 || r.status === 405 || r.status === 501) { var e = new Error('no-backend'); e.noBackend = true; throw e; }
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.ok === false) throw new Error(j.error || 'Сервер ответил ошибкой ' + r.status);
          return j;
        });
      }, function (err) {
        clearTimeout(timer);
        throw new Error(err && err.name === 'AbortError' ? 'Сервер не ответил вовремя' : 'Нет соединения с сервером');
      });
  }

  function saveLocal(full) {
    var leads = FB.store.get('leads', []);
    var n = FB.store.get('lead-seq', 1000) + 1;
    FB.store.set('lead-seq', n);
    full.id = prefix() + '-' + n;
    full.status = 'new';
    full.files = (full.files || []).map(function (f) { return { name: f.name, type: f.type, size: f.size }; });
    leads.unshift(full);
    FB.store.set('leads', leads.slice(0, 200));
    if (FB.config.debug) console.info('[lead] демо-режим, заявка сохранена в браузере:', full);
    return { ok: true, id: full.id, mode: 'demo' };
  }

  FB.lead = {
    /** Отправить заявку. Возвращает Promise<{ok, id, mode:'server'|'demo'}> */
    submit: function (payload) {
      var full = Object.assign({}, payload, {
        site: FB.config.site,
        siteName: FB.config.name,
        prefix: FB.config.prefix || '',
        page: location.pathname,
        utm: FB.utm(),
        createdAt: new Date().toISOString()
      });
      if (!serverMode()) return Promise.resolve(saveLocal(full));
      return fetchJson(FB.config.endpoint, { method: 'POST', body: JSON.stringify(full) }, 30000)
        .then(function (j) { return { ok: true, id: j.id, mode: 'server' }; })
        .catch(function (e) {
          if (e.noBackend) { console.warn('[lead] бэкенд не найден — демо-режим'); return saveLocal(full); }
          throw e;
        });
    },

    /** Занятые слоты: [ 'HH:MM', ... ] для ресурса (мастер/бокс/врач) на дату */
    busy: function (resource, dateIso, allSlots, density) {
      var rnd = FB.seeded(FB.config.site + '|' + resource + '|' + dateIso);
      var demoBusy = (allSlots || []).filter(function () { return rnd() < (density == null ? 0.35 : density); });
      var local = FB.store.get('leads', [])
        .filter(function (l) { return l.resource === resource && l.date === dateIso && l.time; })
        .map(function (l) { return l.time; });
      var base = demoBusy.concat(local);
      if (!serverMode()) return Promise.resolve(base);
      var url = FB.config.endpoint.replace(/\/lead$/, '/busy') + '?site=' + encodeURIComponent(FB.config.site) +
        '&resource=' + encodeURIComponent(resource) + '&date=' + encodeURIComponent(dateIso);
      return fetchJson(url, { method: 'GET' }, 8000)
        .then(function (j) { return base.concat(j.busy || []); })
        .catch(function () { return base; });
    },

    /** Статус заявки/заказа по номеру */
    status: function (id) {
      id = String(id || '').trim().toUpperCase();
      var local = FB.store.get('leads', []).filter(function (l) { return l.id === id; })[0];
      if (!serverMode()) return Promise.resolve(local ? { ok: true, id: id, status: local.status, lead: local } : { ok: false });
      return fetchJson(FB.config.endpoint + '/' + encodeURIComponent(id), { method: 'GET' }, 8000)
        .catch(function () { return local ? { ok: true, id: id, status: local.status, lead: local } : { ok: false }; });
    },

    local: function () { return FB.store.get('leads', []); },

    /** true — заявки уходят на сервер; false — демо-режим (сохраняются в браузере) */
    isServer: serverMode
  };

  /**
   * Форма заявки «под ключ».
   * FB.form(formEl, {
   *   type: 'booking',                     // тип заявки для CRM
   *   collect: (fd, form) => ({...}),      // доп. поля (выбранная услуга, дата, расчёт)
   *   before: (form) => true|'сообщение',   // доп. проверка (например, не выбран слот)
   *   success: (res, payload, form) => {}  // показать экран «готово»
   * })
   */
  FB.form = function (form, opts) {
    opts = opts || {};
    form.setAttribute('novalidate', '');
    var started = false, t0 = Date.now();
    if (!form.querySelector('.hp-field')) {
      var hp = document.createElement('div');
      hp.className = 'hp-field';
      hp.setAttribute('aria-hidden', 'true');
      hp.innerHTML = '<label>Не заполняйте это поле<input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
      form.appendChild(hp);
    }
    FB.$$('input[type=tel], [data-validate~="phone"]', form).forEach(FB.phoneMask);

    form.addEventListener('input', function (e) {
      if (!started) { started = true; FB.track('start_form', { form: opts.type || form.id }); }
      var el = e.target;
      if (el.getAttribute('aria-invalid') === 'true') FB.setError(el, FB.validateField(el));
    });
    form.addEventListener('change', function (e) {
      var el = e.target;
      if (el.getAttribute('aria-invalid') === 'true' || el.type === 'radio' || el.type === 'checkbox') {
        if (el.hasAttribute('data-validate') || el.required) FB.setError(el, FB.validateField(el));
      }
    });
    FB.$$('[data-validate], [required]', form).forEach(function (el) {
      el.addEventListener('blur', function () {
        if (el.value && el.type !== 'radio' && el.type !== 'checkbox') FB.setError(el, FB.validateField(el));
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.__busy) return;
      var formErr = form.querySelector('[data-form-error]');
      if (formErr) formErr.textContent = '';
      if (!FB.validate(form)) { FB.track('form_invalid', { form: opts.type }); return; }
      if (opts.before) {
        var chk = opts.before(form);
        if (chk !== true && chk !== undefined) {
          if (formErr) formErr.textContent = chk; else FB.toast(chk, 'error');
          return;
        }
      }
      var fd = new FormData(form);
      var btn = form.querySelector('[type=submit]');
      // бот: заполнил скрытое поле или отправил форму быстрее человека (t0 — момент появления формы)
      if (fd.get('website') || Date.now() - t0 < 1500) {
        FB.track('spam_blocked', { form: opts.type });
        FB.toast('Заявка принята', 'ok');
        form.reset();
        return;
      }
      var base = {};
      fd.forEach(function (v, k) {
        if (k === 'website' || v instanceof File) return;
        if (base[k] !== undefined) base[k] = [].concat(base[k], v); else base[k] = v;
      });
      if (base.phone) base.phone = FB.phoneFormat(base.phone);
      var fileInputs = FB.$$('input[type=file]', form);
      var files = [].concat.apply([], fileInputs.map(function (i) { return i.fbFiles || []; }));

      form.__busy = true;
      form.setAttribute('aria-busy', 'true');
      if (btn) { btn.disabled = true; btn.classList.add('is-loading'); btn.__label = btn.__label || btn.innerHTML; btn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Отправляем…'; }

      FB.readFiles(files)
        .then(function (fileData) {
          var payload = Object.assign({ type: opts.type || 'lead' }, base, opts.collect ? opts.collect(fd, form) : {});
          if (fileData.length) payload.files = fileData;
          return FB.lead.submit(payload).then(function (res) { return [res, payload]; });
        })
        .then(function (r) {
          FB.track('submit_lead', { type: opts.type, id: r[0].id, mode: r[0].mode });
          if (opts.success) opts.success(r[0], r[1], form);
          else FB.toast('Заявка ' + r[0].id + ' принята. Скоро свяжемся!', 'ok');
          form.reset();
          fileInputs.forEach(function (i) { if (i.fbReset) i.fbReset(); });
          started = false;
        })
        .catch(function (err) {
          var alt = [FB.config.phone ? 'позвоните ' + FB.config.phone : '', FB.config.telegram ? 'напишите в Telegram @' + FB.config.telegram : ''].filter(Boolean).join(' или ');
          var msg = 'Не получилось отправить: ' + err.message + '.' + (alt ? ' Попробуйте ещё раз или ' + alt + '.' : ' Попробуйте ещё раз.');
          if (formErr) formErr.textContent = msg;
          FB.toast(msg, 'error', 7000);
          FB.track('submit_error', { type: opts.type, error: err.message });
        })
        .then(function () {
          form.__busy = false;
          form.removeAttribute('aria-busy');
          if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.innerHTML = btn.__label; }
        });
    });
    return form;
  };

  /** Ссылка на Telegram с текстом заявки */
  FB.tgLink = function (text) {
    return FB.config.telegram ? 'https://t.me/' + FB.config.telegram + (text ? '?text=' + encodeURIComponent(text) : '') : '#';
  };

  /* ------------------------------------------------------------------ табы */

  /** Доступные табы: контейнер с [role=tablist] > [role=tab][aria-controls] */
  FB.tabs = function (list, onChange) {
    var tabs = FB.$$('[role=tab]', list);
    function select(tab, focus) {
      // сначала прячем все панели, потом показываем выбранную (панель может быть общей для всех табов)
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) p.hidden = true;
      });
      var cur = document.getElementById(tab.getAttribute('aria-controls'));
      if (cur) cur.hidden = false;
      if (focus) tab.focus();
      if (onChange) onChange(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % tabs.length;
        if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') j = 0;
        if (k === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    var cur = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (cur) select(cur);
    return { select: select };
  };

  /* ------------------------------------------------------------------ аккордеон */

  FB.accordion = function (ctx) {
    FB.$$('[data-acc] > button, [data-acc] > h3 > button', ctx).forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      panel.style.overflow = 'hidden';
      var set = function (open) {
        btn.setAttribute('aria-expanded', String(open));
        panel.hidden = false;
        var h = panel.scrollHeight;
        if (reduced) { panel.hidden = !open; panel.style.height = ''; return; }
        panel.style.height = (open ? 0 : h) + 'px';
        requestAnimationFrame(function () {
          panel.style.transition = 'height .45s cubic-bezier(.2,.8,.2,1)';
          panel.style.height = (open ? h : 0) + 'px';
        });
        panel.addEventListener('transitionend', function te() {
          panel.removeEventListener('transitionend', te);
          panel.style.transition = '';
          panel.style.height = '';
          if (!open) panel.hidden = true;
        });
      };
      panel.hidden = btn.getAttribute('aria-expanded') !== 'true';
      btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    });
  };

  /* ------------------------------------------------------------------ старт */

  FB.init = function (opts) {
    opts = opts || {};
    if (FB.started) return FB;
    FB.started = true;
    initScroll(opts);
    wireModals();
    wireNav();
    FB.accordion();
    FB.$$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
    FB.$$('[data-tg]').forEach(function (a) { a.href = FB.tgLink(a.getAttribute('data-tg')); a.target = '_blank'; a.rel = 'noopener'; });
    FB.$$('[data-phone]').forEach(function (a) {
      a.href = 'tel:' + FB.config.phone.replace(/[^\d+]/g, '');
      if (!a.textContent.trim()) a.textContent = FB.config.phone;
    });
    FB.reveal();
    FB.counters();
    // если открыли страницу с #якорем — докручиваем с учётом шапки
    if (location.hash && location.hash.length > 1) {
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) setTimeout(function () { FB.scrollTo(el, { focus: false, duration: 0.01 }); }, 60);
    }
    return FB;
  };
})();
