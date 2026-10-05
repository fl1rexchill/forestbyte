/*!
 * site.js — общий слой шаблонов поверх core.js: выводит данные из window.SITE_CONFIG.
 *
 * Что делает:
 *   • цены (точная, «от», диапазон, «по запросу») и суммы нескольких услуг;
 *   • изображения из config.assets (alt, размеры, отложенная загрузка, заглушка);
 *   • бренд, контакты, реквизиты, SEO, режим demo/production;
 *   • скрытие необязательных блоков и их пунктов меню;
 *   • многошаговые формы (T.wizard) и формы заявок (T.leadForm поверх FB.form);
 *   • баннер cookie и аналитика только после согласия.
 *
 * Использование в app.js:  T.boot(function (T, C) { ...отрисовка ниши... });
 */
(function () {
  'use strict';

  var C = window.SITE_CONFIG || {};
  var T = (window.T = {});
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;

  T.cfg = C;
  T.demo = FB.config.demo;
  T.formsBlocked = null;

  /* ---------------------------------------------------------------- данные */

  T.feature = function (name) { return !C.features || C.features[name] !== false; };
  T.list = function (key) { return Array.isArray(C[key]) ? C[key] : []; };
  T.byId = function (arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0] || null; };

  /* ---------------------------------------------------------------- цены и время */

  var UNKNOWN = 'Стоимость уточняется';

  /** Цена × коэффициент с округлением до 10 ₽. toFixed убирает ошибку плавающей точки: 3100 × 1.15 = 3564.9999… */
  T.roundCoef = function (n, coef) { return Math.round(+(n * coef).toFixed(4) / 10) * 10; };

  /** Текст цены. price = { type: 'fixed'|'from'|'range'|'request', value, min, max, unit } */
  T.priceText = function (p, coef) {
    coef = coef || 1;
    // коэффициент (класс авто и т. п.) округляем до 10 ₽; без коэффициента цена выводится как есть
    var round = function (n) { return coef === 1 ? n : T.roundCoef(n, coef); };
    if (!p || !p.type) return UNKNOWN;
    var unit = p.unit ? ' ' + p.unit : '';
    if (p.type === 'fixed' && p.value > 0) return FB.money(round(p.value)) + unit;
    if (p.type === 'from' && p.value > 0) return 'от ' + FB.money(round(p.value)) + unit;
    if (p.type === 'range' && p.min > 0 && p.max >= p.min) return FB.num(round(p.min)) + '–' + FB.money(round(p.max)) + unit;
    if (p.type === 'request') return 'По запросу';
    return UNKNOWN;
  };
  T.demoTag = function (on, label) { return on && T.demo ? ' <span class="demo-tag">' + esc(label || 'пример') + '</span>' : ''; };
  T.priceHtml = function (p, coef, demo) { return '<span class="price">' + esc(T.priceText(p, coef)) + '</span>' + T.demoTag(demo !== undefined ? demo : p && p.demo, 'демо-цена'); };

  /**
   * Сумма нескольких цен. items = [{ price, coef, qty }]
   * → { min, max, open, unknown, count, text }
   *   open — есть цены «от» (верхней границы нет); unknown — позиции без цены.
   */
  T.sum = function (items) {
    var r = { min: 0, max: 0, open: false, unknown: 0, count: items.length };
    items.forEach(function (it) {
      var p = it.price || {}, coef = it.coef || 1;
      var rd = function (n) { return (coef === 1 ? n : T.roundCoef(n, coef)) * (it.qty || 1); };
      if (p.type === 'fixed' && p.value > 0) { r.min += rd(p.value); r.max += rd(p.value); }
      else if (p.type === 'from' && p.value > 0) { r.min += rd(p.value); r.max += rd(p.value); r.open = true; }
      else if (p.type === 'range' && p.min > 0) { r.min += rd(p.min); r.max += rd(p.max); }
      else r.unknown++;
    });
    r.min = Math.max(0, r.min); r.max = Math.max(r.min, r.max);
    r.text = T.sumText(r);
    return r;
  };
  T.sumText = function (r) {
    if (!r.count) return '—';
    if (!r.min) return UNKNOWN;
    var base = r.open ? 'от ' + FB.money(r.min) : r.max > r.min ? FB.num(r.min) + '–' + FB.money(r.max) : FB.money(r.min);
    return base + (r.unknown ? ' + ' + r.unknown + ' ' + FB.plural(r.unknown, ['позиция', 'позиции', 'позиций']) + ' по запросу' : '');
  };

  /** Длительность в минутах → «1 ч 30 мин». d — число или { min, max } */
  T.duration = function (d) {
    if (d == null || d === '') return '';
    if (typeof d === 'object') return d.max && d.max !== d.min ? T.duration(d.min) + ' – ' + T.duration(d.max) : T.duration(d.min);
    var h = Math.floor(d / 60), m = d % 60;
    return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : '') || '0 мин';
  };
  T.durMin = function (d) { return d == null ? 0 : typeof d === 'object' ? d.min || 0 : d; };
  T.durMax = function (d) { return d == null ? 0 : typeof d === 'object' ? d.max || d.min || 0 : d; };

  /* ---------------------------------------------------------------- изображения */

  T.asset = function (id) { return id && C.assets ? C.assets[id] || null : null; };

  /** <img> из config.assets. opts: { cls, eager, alt, sizes }. Нет файла — нейтральная заглушка. */
  T.img = function (id, opts) {
    opts = opts || {};
    var a = T.asset(id);
    var cls = opts.cls ? ' class="' + esc(opts.cls) + '"' : '';
    if (!a || !a.src) {
      var label = opts.alt || (a && a.alt) || 'Фото появится после замены';
      return '<span' + (opts.cls ? ' class="' + esc(opts.cls) + ' ph"' : ' class="ph"') + ' role="img" aria-label="' + esc(label) + '"><span aria-hidden="true">' + esc(opts.phText || 'Место для фото') + '</span></span>';
    }
    var alt = opts.alt != null ? opts.alt : a.role === 'decor' ? '' : a.alt || '';
    return '<img' + cls + ' src="' + esc(a.src) + '" alt="' + esc(alt) + '"' +
      (a.width ? ' width="' + a.width + '" height="' + a.height + '"' : '') +
      (opts.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"' +
      (opts.sizes ? ' sizes="' + esc(opts.sizes) + '"' : '') + '>';
  };

  /* ---------------------------------------------------------------- DOM */

  /** Вставить текст в [data-cfg="путь"]; пустое значение — элемент прячется. */
  T.bindText = function () {
    $$('[data-cfg]').forEach(function (el) {
      var v = el.getAttribute('data-cfg').split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, C);
      if (v == null || v === '') { el.hidden = true; return; }
      el.textContent = v;
    });
  };

  /** Спрятать блок и убрать его пункт из навигации. */
  T.section = function (id, visible) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.hidden = !visible;
    return !!visible;
  };
  T.pruneNav = function () {
    $$('a[href^="#"][data-nav]').forEach(function (a) {
      var t = document.getElementById(a.getAttribute('href').slice(1));
      var off = !t || !!t.closest('[hidden]');
      var item = a.closest('li') || a;
      item.hidden = off;
    });
  };

  /* ---------------------------------------------------------------- бренд, SEO, тема */

  function meta(name, content, attr) {
    attr = attr || 'name';
    var m = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!content) { if (m) m.remove(); return; }
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, name); document.head.appendChild(m); }
    m.setAttribute('content', content);
  }
  T.renderMeta = function () {
    var seo = C.seo || {}, brand = C.brand || {};
    document.documentElement.lang = (C.meta && C.meta.lang) || 'ru';
    document.title = seo.title || brand.name || document.title;
    meta('description', seo.description || brand.description || '');
    if (T.demo) meta('robots', 'noindex, nofollow');
    else meta('robots', seo.robots || '');
    meta('og:title', seo.title || brand.name, 'property');
    meta('og:description', seo.description || '', 'property');
    meta('og:type', 'website', 'property');
    var img = T.asset(seo.image);
    if (img && seo.canonical) meta('og:image', new URL(img.src, seo.canonical).href, 'property');
    if (!T.demo && seo.canonical) {
      var l = document.head.querySelector('link[rel=canonical]') || document.head.appendChild(document.createElement('link'));
      l.rel = 'canonical'; l.href = seo.canonical;
    }
  };

  /** brand.colors: { accent: '#...', ... } → CSS-переменные; --fb-* для виджетов с Shadow DOM. */
  T.theme = function () {
    var cols = (C.brand && C.brand.colors) || {}, st = document.documentElement.style;
    Object.keys(cols).forEach(function (k) { if (cols[k]) st.setProperty('--' + k, cols[k]); });
    var fonts = (C.brand && C.brand.fonts) || {};
    if (fonts.heading) st.setProperty('--font-heading', fonts.heading);
    if (fonts.body) st.setProperty('--font-body', fonts.body);
  };

  T.renderBrand = function () {
    var b = C.brand || {};
    $$('[data-brand]').forEach(function (el) {
      var logo = T.asset(b.logo);
      if (logo && el.hasAttribute('data-logo')) el.innerHTML = '<img src="' + esc(logo.src) + '" alt="' + esc(b.name) + '" height="32">';
      else el.textContent = b.logoText || b.name || '';
      // длинное название обрезается многоточием — полное имя остаётся в подсказке и для скринридера
      if (el.tagName === 'A' && b.name) { el.title = b.name; el.setAttribute('aria-label', b.name + ' — на главную'); }
    });
    $$('[data-brand-name]').forEach(function (el) { el.textContent = b.name || ''; });
  };

  T.renderDemoBar = function () {
    if (!T.demo) return;
    var bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.setAttribute('role', 'note');
    bar.innerHTML = FB.config.mode === 'server-test'
      ? '<b>Демонстрационный шаблон. Тестовая отправка.</b> Данные приведены для примера. Заявка сохранится на локальном сервере с пометкой «тест», уведомления не отправляются.'
      : '<span class="demo-bar__full"><b>Демонстрационный шаблон.</b> Данные приведены для примера. Заявки сохраняются только в этом браузере.</span>' +
        '<span class="demo-bar__short"><b>Демо-шаблон</b> · заявки только в этом браузере</span>';
    document.body.insertBefore(bar, document.body.firstChild);
  };

  /* ---------------------------------------------------------------- контакты */

  T.contacts = function () {
    var c = C.contacts || {};
    return {
      phone: c.phone || '', email: c.email || '', telegram: String(c.telegram || '').replace(/^@/, ''),
      address: c.address || '', city: c.city || '', hours: Array.isArray(c.hours) ? c.hours : [], map: c.map || null
    };
  };
  T.hasContact = function () { var c = T.contacts(); return !!(c.phone || c.email || c.telegram); };

  /** Список контактов в элемент el. Кнопки без данных не создаются. */
  T.renderContacts = function (el) {
    if (!el) return;
    var c = T.contacts(), ch = (C.integrations && C.integrations.channels) || {};
    var rows = [];
    if (c.address || c.city) rows.push(['Адрес', esc([c.city, c.address].filter(Boolean).join(', ')) + (c.map && c.map.url ? ' · <a href="' + esc(c.map.url) + '" target="_blank" rel="noopener">Открыть карту</a>' : '')]);
    if (c.hours.length) rows.push(['Часы работы', c.hours.map(function (h) { return esc(h.days) + ': ' + esc(h.time); }).join('<br>')]);
    if (c.phone && ch.phone !== false) rows.push(['Телефон', '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + esc(c.phone) + '</a>']);
    if (c.email && ch.email !== false) rows.push(['Почта', '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>']);
    if (c.telegram && ch.telegram !== false) rows.push(['Telegram', '<a href="https://t.me/' + encodeURIComponent(c.telegram) + '" target="_blank" rel="noopener">@' + esc(c.telegram) + '</a>']);
    var html = rows.map(function (r) { return '<div class="contact-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    if (!T.hasContact() && T.demo) html += '<div class="contact-row contact-row--note"><dt>Связь</dt><dd>В демо-версии телефон, почта и Telegram не заполнены. Укажите их в <code>config.js → contacts</code>, и кнопки появятся автоматически.</dd></div>';
    el.innerHTML = html ? '<dl class="contacts">' + html + '</dl>' : '';
  };

  /** Быстрые кнопки связи: [data-quick="phone|telegram|email"] прячутся, если контакта нет. */
  T.renderQuick = function () {
    var c = T.contacts();
    $$('[data-quick]').forEach(function (a) {
      var k = a.getAttribute('data-quick');
      if (k === 'phone' && c.phone) a.href = 'tel:' + c.phone.replace(/[^\d+]/g, '');
      else if (k === 'telegram' && c.telegram) { a.href = 'https://t.me/' + encodeURIComponent(c.telegram); a.target = '_blank'; a.rel = 'noopener'; }
      else if (k === 'email' && c.email) a.href = 'mailto:' + c.email;
      else { a.hidden = true; return; }
      a.hidden = false;
    });
  };

  /* ---------------------------------------------------------------- юридическое */

  T.legalLinks = function () {
    return [['legal/privacy.html', 'Политика обработки данных'], ['legal/consent.html', 'Согласие на обработку данных'], ['legal/cookies.html', 'Cookie']];
  };
  T.renderFooterLegal = function (el) {
    if (!el) return;
    var l = C.legal || {};
    var req = l.operator && l.inn ? esc(l.operator) + ', ИНН ' + esc(l.inn) + (l.ogrn ? ', ОГРН ' + esc(l.ogrn) : '') :
      T.demo ? 'Реквизиты появятся после заполнения <code>config.js → legal</code>' : '';
    el.innerHTML = (req ? '<p class="legal-req">' + req + '</p>' : '') +
      '<ul class="legal-links" role="list">' + T.legalLinks().map(function (x) { return '<li><a href="' + x[0] + '">' + x[1] + '</a></li>'; }).join('') +
      '<li><button type="button" class="linklike" data-cookie-settings>Настройки cookie</button></li></ul>' +
      '<p class="legal-year">© <span data-year></span> ' + esc((C.brand || {}).name || '') + '</p>';
  };

  /** Поле согласия: не отмечено заранее, ссылка на текст согласия рядом. */
  T.consentHtml = function (id) {
    id = id || 'consent';
    return '<div class="consent" data-field><label class="consent__label"><input type="checkbox" name="consent" id="' + id + '" value="да" required> ' +
      '<span>Даю <a href="legal/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> и принимаю <a href="legal/privacy.html" target="_blank" rel="noopener">политику</a>.</span></label></div>';
  };

  /* ---------------------------------------------------------------- cookie и аналитика */

  var analyticsOn = false;
  function startAnalytics(choice) {
    var a = (C.integrations && C.integrations.analytics) || {};
    if (T.demo || analyticsOn || !choice || !choice.analytics || !a.yandexMetrika) return;
    analyticsOn = true;
    // Яндекс Метрика: счётчик подключается только после согласия на аналитические cookie
    var id = String(a.yandexMetrika).replace(/\D/g, '');
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = +new Date();
    var s = document.createElement('script');
    s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(s);
    window.ym(+id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }
  T.cookies = function () {
    if (!customElements.get('fb-cookie-consent')) return;
    var el = document.createElement('fb-cookie-consent');
    el.setAttribute('policy-href', 'legal/cookies.html');
    el.setAttribute('storage-key', 'fb-cookie-consent:' + FB.config.site);
    el.setAttribute('categories', '');
    var a = (C.integrations && C.integrations.analytics) || {};
    el.setAttribute('text', 'Сайт использует необходимые файлы cookie и локальное хранилище браузера для работы форм.' +
      (a.yandexMetrika && !T.demo ? ' Аналитику включим только с вашего согласия.' : ' Аналитика и реклама на сайте не подключены.'));
    document.body.appendChild(el);
    document.addEventListener('fb-consent', function (e) { startAnalytics(e.detail); });
    try { startAnalytics(JSON.parse(localStorage.getItem('fb-cookie-consent:' + FB.config.site) || 'null')); } catch (e) {}
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cookie-settings]') && window.fbCookieConsent) window.fbCookieConsent.open();
    });
  };

  /* ---------------------------------------------------------------- проверка production */

  T.checkProduction = function () {
    if (FB.config.mode !== 'production' || !FB.checkConfig) return;
    var r = FB.checkConfig(C, { production: true });
    if (r.ok) { r.warnings.forEach(function (w) { console.warn('[config]', w); }); return; }
    T.formsBlocked = r.errors;
    console.error('[config] Сайт не готов к публикации:\n- ' + r.errors.join('\n- '));
    var bar = document.createElement('div');
    bar.className = 'demo-bar demo-bar--error';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = '<b>Конфигурация не готова к работе.</b> Формы отключены. Ошибок: ' + r.errors.length + '. Список — в консоли браузера и в выводе <code>node _shared/config-check.js</code>.';
    document.body.insertBefore(bar, document.body.firstChild);
  };

  /* ---------------------------------------------------------------- формы */

  /**
   * Форма заявки поверх FB.form.
   * opts: { type, collect, before, result: Element, successTitle, successText, onSuccess }
   */
  T.leadForm = function (form, opts) {
    opts = opts || {};
    var result = opts.result;
    return FB.form(form, {
      type: opts.type,
      collect: opts.collect,
      before: function (f) {
        if (T.formsBlocked) return 'Форма отключена: конфигурация сайта не заполнена. Обратитесь к владельцу сайта.';
        return opts.before ? opts.before(f) : true;
      },
      success: function (res, payload) {
        if (result) {
          var demo = res.mode === 'demo', test = !demo && res.notify === 'skipped-test';
          var title = demo ? 'Демо-заявка сохранена на этом устройстве' : test ? 'Тестовая заявка сохранена на сервере' : opts.successTitle || 'Заявка принята';
          var text = demo ? 'Номер ' + res.id + '. Заявка никуда не отправлена: она хранится только в этом браузере. Бизнес её не получил.'
            : test ? 'Номер ' + res.id + '. Сайт работает в демо-режиме, поэтому сервер сохранил заявку с пометкой «тест» и не отправлял уведомления.'
            : opts.successText || 'Мы свяжемся с вами по указанному контакту.';
          result.innerHTML = '<p class="result__eyebrow">' + (demo ? 'Демо-режим' : 'Заявка ' + esc(res.id)) + '</p>' +
            '<h3 class="result__title" tabindex="-1">' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
            (opts.summary ? '<div class="result__summary">' + opts.summary(payload) + '</div>' : '') +
            '<button type="button" class="btn btn--ghost" data-again>Заполнить ещё раз</button>';
          result.hidden = false;
          form.hidden = true;
          var h = result.querySelector('.result__title');
          FB.scrollTo(result, { focus: false });
          setTimeout(function () { h.focus(); }, 50);
          result.querySelector('[data-again]').addEventListener('click', function () {
            result.hidden = true; form.hidden = false;
            var f = form.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea, button');
            if (f) f.focus();
          });
        }
        if (opts.onSuccess) opts.onSuccess(res, payload);
      }
    });
  };

  /**
   * Многошаговая форма. Шаги — [data-step] внутри формы, кнопки [data-next] / [data-prev].
   * opts: { check: { 0: fn → true|'ошибка' }, onStep: fn(i) , progress: Element }
   * Поля скрытых шагов не проверяются (core пропускает [hidden]), поэтому проверка идёт по текущему шагу.
   */
  T.wizard = function (form, opts) {
    opts = opts || {};
    var steps = $$('[data-step]', form), cur = 0;
    var err = form.querySelector('[data-form-error]');
    var prog = opts.progress;
    function render() {
      steps.forEach(function (s, i) { s.hidden = i !== cur; });
      if (prog) {
        prog.innerHTML = steps.map(function (s, i) {
          return '<li class="' + (i < cur ? 'is-done' : i === cur ? 'is-cur' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '</span> ' + esc(s.getAttribute('data-title') || '') + '</li>';
        }).join('');
        prog.setAttribute('aria-label', 'Шаг ' + (cur + 1) + ' из ' + steps.length);
      }
      if (opts.onStep) opts.onStep(cur);
    }
    function go(i, focus) {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      if (err) err.textContent = '';
      render();
      if (focus !== false) {
        var h = steps[cur].querySelector('legend, h3, .step__title');
        if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        FB.scrollTo(form, { focus: false, offset: -FB.headerOffset() - 24 });
      }
    }
    form.addEventListener('click', function (e) {
      var n = e.target.closest('[data-next]'), p = e.target.closest('[data-prev]');
      if (p) { e.preventDefault(); go(cur - 1); return; }
      if (!n) return;
      e.preventDefault();
      if (!FB.validate(form)) return;
      var chk = opts.check && opts.check[cur] ? opts.check[cur]() : true;
      if (chk !== true && chk !== undefined) { if (err) err.textContent = chk; return; }
      go(cur + 1);
    });
    // Enter в поле шага = «Далее», а не отправка всей формы
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit' || e.target.tagName === 'BUTTON') return;
      if (cur < steps.length - 1) { e.preventDefault(); var n = steps[cur].querySelector('[data-next]'); if (n) n.click(); }
    });
    form.addEventListener('fb:reset', function () { go(0, false); });
    go(0, false);
    return { go: go, current: function () { return cur; } };
  };

  /* ---------------------------------------------------------------- общие блоки */

  T.renderFaq = function (box, items, prefix) {
    prefix = prefix || 'faq';
    box.innerHTML = items.map(function (q, i) {
      return '<div class="faq__item" data-acc><h3><button type="button" aria-expanded="false" aria-controls="' + prefix + '-' + i + '"><span>' + esc(q.q) + '</span><i aria-hidden="true"></i></button></h3>' +
        '<div class="faq__a" id="' + prefix + '-' + i + '" role="region"><p>' + esc(q.a) + '</p></div></div>';
    }).join('');
  };

  /** Отзывы: пометка «Пример отзыва» рядом с каждым демонстрационным отзывом. */
  T.renderReviews = function (box, items) {
    box.innerHTML = items.map(function (r) {
      var src = r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.source || 'источник') + '</a>' : esc(r.source || '');
      return '<figure class="review">' + (r.demo ? '<span class="demo-tag demo-tag--block">Пример отзыва — не настоящий клиент</span>' : '') +
        '<blockquote><p>' + esc(r.text) + '</p></blockquote><figcaption>' + esc(r.author || '') + (src ? ' · ' + src : '') + '</figcaption></figure>';
    }).join('');
  };

  /** Нижняя панель действия на телефоне. Прячется, когда на экране целевой блок или кнопка страницы, ведущая туда же
   *  (иначе на первом экране панель дублирует и перекрывает кнопку обложки). */
  T.mobileCta = function (label, targetId) {
    var bar = document.createElement('div');
    bar.className = 'mcta';
    bar.innerHTML = '<a class="btn btn--accent mcta__btn" href="#' + esc(targetId) + '">' + esc(label) + '</a>';
    document.body.appendChild(bar);
    document.documentElement.classList.add('has-mcta');
    var target = document.getElementById(targetId);
    if (target && 'IntersectionObserver' in window) {
      var seen = [];
      var watch = [target].concat($$('main a.btn[href="#' + targetId + '"]'));
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { var i = watch.indexOf(e.target); if (i > -1) seen[i] = e.isIntersecting; });
        bar.classList.toggle('is-hidden', seen.some(Boolean));
      }, { threshold: 0.05 });
      watch.forEach(function (el) { io.observe(el); });
    }
  };

  /**
   * Карусель на телефоне: контейнер с однотипными карточками листается вбок (стили — core.css, [data-rail]).
   * Под лентой — счётчик «2 / 5» и полоска прогресса. На компьютере контейнер остаётся сеткой ниши.
   */
  T.rail = function (box, label) {
    if (!box) return;
    box.setAttribute('data-rail', '');
    if (label) box.setAttribute('aria-label', label);
    var cnt = box.nextElementSibling && box.nextElementSibling.classList.contains('rail-count') ? box.nextElementSibling : null;
    if (!cnt) {
      cnt = document.createElement('p');
      cnt.className = 'rail-count';
      cnt.setAttribute('aria-hidden', 'true');
      box.parentNode.insertBefore(cnt, box.nextSibling);
    }
    function update() {
      var items = Array.prototype.filter.call(box.children, function (c) { return !c.hidden && c.offsetWidth; });
      if (items.length < 2 || box.scrollWidth <= box.clientWidth + 2) { cnt.hidden = true; return; }
      cnt.hidden = false;
      var left = box.getBoundingClientRect().left, i = 0;
      items.forEach(function (c, k) { if (c.getBoundingClientRect().left - left < c.offsetWidth / 2) i = k; });
      if (box.scrollLeft + box.clientWidth >= box.scrollWidth - 4) i = items.length - 1;
      cnt.innerHTML = '<span>' + (i + 1) + ' / ' + items.length + '</span><span class="rail-count__bar"><i style="--p:' + Math.round((i + 1) / items.length * 100) + '%"></i></span>';
    }
    if (!box.__rail) {
      box.__rail = true;
      box.addEventListener('scroll', FB.debounce(update, 60), { passive: true });
      window.addEventListener('resize', FB.debounce(update, 150));
    }
    update();
    return update;
  };

  /** Минимальная дата для поля «Желаемая дата» — сегодня (в часовом поясе устройства). */
  T.minDate = function (input) { input.min = FB.iso(FB.today()); };

  /* ---------------------------------------------------------------- запуск */

  T.boot = function (render) {
    T.theme();
    T.renderMeta();
    T.renderDemoBar();
    T.renderBrand();
    T.bindText();
    T.renderQuick();
    T.renderContacts($('[data-contacts]'));
    T.renderFooterLegal($('[data-legal]'));
    try { render(T, C); }
    catch (e) { console.error('[template] ошибка отрисовки', e); }
    T.pruneNav();
    FB.init();
    T.checkProduction();
    T.cookies();
  };
})();
