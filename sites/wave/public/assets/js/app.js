/* WAVE — поведение сайта. Без зависимостей (Lenis — необязательный, для плавного скролла). */
(function () {
  'use strict';

  var root = document.documentElement;
  var cfg = window.WAVE || {};
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------------- плавный скролл ---------------- */
  var lenis = null;
  if (!reduced && window.Lenis) {
    try {
      lenis = new window.Lenis({ autoRaf: true, lerp: 0.085 });
    } catch (e) { lenis = null; }
  }
  // ссылки вида /#faq на текущей странице — плавно, с учётом шапки
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || a.target === '_blank') return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || url.origin !== location.origin || url.hash.length < 2) return;
    var el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -(parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76) - 12, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', url.hash);
  });

  function lockScroll(on) {
    if (lenis) { on ? lenis.stop() : lenis.start(); }
    root.style.overflow = on ? 'hidden' : '';
  }

  /* ---------------- шапка ---------------- */
  var lastY = 0;
  function onScroll() {
    var y = window.pageYOffset;
    root.classList.toggle('is-scrolled', y > 8);
    if (Math.abs(y - lastY) > 8) {
      root.classList.toggle('is-hidden-hdr', y > lastY && y > 480);
      lastY = y;
    }
  }
  if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = $('.burger'), nav = $('#nav');
  function setNav(open) {
    if (!burger) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    nav.classList.toggle('is-open', open);
    root.classList.toggle('nav-open', open);
    lockScroll(open);
  }
  if (burger) {
    burger.addEventListener('click', function () { setNav(burger.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); burger.focus(); } });
    matchMedia('(min-width: 901px)').addEventListener('change', function (e) { if (e.matches) setNav(false); });
  }

  /* ---------------- появление ---------------- */
  function split(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          // режем только по обычным пробелам: &nbsp; склеивает слова
          var frag = document.createDocumentFragment();
          ch.textContent.split(/([ \t\n\r]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'), s = document.createElement('span');
            w.className = 'w'; s.textContent = p; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
      });
    })(el);
  }

  if (root.classList.contains('motion') && 'IntersectionObserver' in window) {
    $$('[data-split]').forEach(split);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('[data-reveal], [data-split]').forEach(function (el) { io.observe(el); });
  } else {
    root.classList.remove('motion');
  }

  /* ---------------- год ---------------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------------- форма заявки ---------------- */
  var form = $('#lead');
  if (form) initForm(form);

  function digits(v) { return v.replace(/\D/g, ''); }
  function formatPhone(v) {
    var d = digits(v);
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    if (d.length > 11 && d.slice(0, 2) === '78') d = '7' + d.slice(2); // вставили «8…» после «+7»
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  function initForm(f) {
    var started = Date.now();
    var phone = f.elements.phone, status = $('.lform__status', f), btn = $('button[type=submit]', f);
    f.elements.page.value = location.pathname;

    // после автоподстановки «+7» по привычке набирают «8» — это код страны, а не цифра номера
    phone.addEventListener('beforeinput', function (e) {
      if (e.data === '8' && digits(phone.value) === '7') e.preventDefault();
    });
    phone.addEventListener('input', function () {
      var pos = phone.selectionStart === phone.value.length;
      phone.value = formatPhone(phone.value);
      if (pos) phone.setSelectionRange(phone.value.length, phone.value.length);
    });
    phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
    phone.addEventListener('blur', function () { if (digits(phone.value).length <= 1) phone.value = ''; });

    function setErr(el, msg) {
      var box = document.getElementById(el.getAttribute('aria-describedby'));
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      if (box) box.textContent = msg || '';
    }
    function validate() {
      var ok = true, first = null;
      var name = f.elements.name, consent = f.elements.consent;
      var nm = name.value.trim();
      if (nm.length < 2) { setErr(name, 'Как к вам обращаться?'); ok = false; first = first || name; } else setErr(name, '');
      if (digits(phone.value).length !== 11) { setErr(phone, 'Проверьте номер: нужно 10 цифр после +7'); ok = false; first = first || phone; } else setErr(phone, '');
      if (!consent.checked) { setErr(consent, 'Без согласия мы не можем принять заявку'); ok = false; first = first || consent; } else setErr(consent, '');
      if (first) first.focus();
      return ok;
    }
    ['name', 'consent'].forEach(function (n) {
      f.elements[n].addEventListener('change', function () { if (f.elements[n].hasAttribute('aria-invalid')) validate(); });
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = ''; status.className = 'lform__status';
      if (!validate()) return;

      var data = new FormData(f);
      data.append('elapsed', String(Math.round((Date.now() - started) / 1000)));
      btn.disabled = true;
      var label = btn.textContent;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Отправляем…';

      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

      fetch(cfg.endpoint || f.action, { method: 'POST', body: data, signal: ctrl && ctrl.signal, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; }); })
        .then(function (res) {
          if (!res.ok) throw res;
          var name = f.elements.name.value.trim();
          f.hidden = true;
          var done = document.createElement('div');
          done.className = 'lead-done';
          done.setAttribute('tabindex', '-1');
          done.innerHTML = '<h3>Спасибо, заявка у нас</h3><p></p><p class="fine">Если вопрос срочный — звоните: <a href="tel:+' + digits(cfg.phone || '') + '">' + (cfg.phone || '') + '</a></p>';
          done.querySelector('p').textContent = (name ? name + ', м' : 'М') + 'енеджер дилера перезвонит в рабочее время и ответит на вопросы.';
          f.parentNode.insertBefore(done, f.nextSibling);
          done.focus();
          if (window.ym && cfg.metrika) window.ym(cfg.metrika, 'reachGoal', 'lead');
        })
        .catch(function (err) {
          status.className = 'lform__status is-error';
          var msg = err && err.error ? err.error : 'Не удалось отправить заявку.';
          status.innerHTML = '';
          status.appendChild(document.createTextNode(msg + ' Позвоните нам: '));
          var a = document.createElement('a');
          a.href = 'tel:+' + digits(cfg.phone || ''); a.textContent = cfg.phone || '';
          status.appendChild(a);
        })
        .then(function () { clearTimeout(timer); btn.disabled = false; btn.textContent = label; });
    });
  }

  /* ---------------- cookie и Яндекс Метрика ---------------- */
  var KEY = 'wave-cookie';
  var banner = $('#cookie');

  function loadMetrika() {
    var id = cfg.metrika;
    if (!id || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + id, 'ym');
    window.ym(id, 'init', { ssr: true, webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true });
  }
  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
  }
  function choose(v) {
    var prev = store.get(KEY);
    store.set(KEY, v + '|' + new Date().toISOString().slice(0, 10));
    if (banner) banner.hidden = true;
    if (v === 'all') loadMetrika();
    // отзыв согласия: перезагружаем, чтобы счётчик перестал работать на странице
    else if (prev && prev.indexOf('all') === 0 && window.ym) location.reload();
  }

  var saved = store.get(KEY);
  if (!saved) setTimeout(showBanner, 900);
  else if (saved.indexOf('all') === 0) loadMetrika();

  if (banner) $$('[data-cookie]', banner).forEach(function (b) {
    b.addEventListener('click', function () { choose(b.getAttribute('data-cookie')); });
  });
  $$('[data-cookie-settings]').forEach(function (b) { b.addEventListener('click', showBanner); });
})();
