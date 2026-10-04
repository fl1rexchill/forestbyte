/* Косметология: «сыворотка». Фарфоровый фон, мягкое свечение, стекло и капля сыворотки.
   Обложка (заголовок, на нём стеклянная капля; подзаголовок с кнопкой; три шага на матовом стекле) →
   специалисты → услуги прайсом → кабинет и оборудование → документы → вопросы карточками →
   запрос: услуга и специалист → время → контакт → контакты.
   Оговорки (цена — ориентир, показания уточняет специалист) — короткими строками рядом с ценами.
   Медицинские тексты — только утверждённые (approved: true). Форма не собирает сведения о здоровье.
   Анимации — CSS и Web Animations API; anime.js и Lenis на этой странице не подключаются. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), services = T.list('services'), team = T.list('team');
  var HELP = 'help';
  var UNAPPROVED = 'Показания, подготовку и ограничения уточняет специалист на консультации.';
  var PRICE_NOTE = (C.pricing && C.pricing.note) || 'Цены — ориентир. Итоговую стоимость называет специалист после консультации.';
  var canAnimate = !FB.reduced && typeof Element.prototype.animate === 'function';

  function specsFor(serviceId) { return team.filter(function (m) { return (m.services || []).indexOf(serviceId) > -1; }); }
  function specName(m) { return m.name || m.role; }
  // фото специалиста; без фото — ничего (буквы в кружках выглядят как заглушка)
  function face(m, cls) {
    return T.asset(m.photo) ? '<span class="face' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + T.img(m.photo, { alt: '' }) + '</span>' : '';
  }
  var consult = T.byId(services, 'consult') || services.filter(function (s) { return s.cat === 'consult'; })[0];
  // «По запросу» — строчными, в одном ряду с «от 3 000 ₽»
  var lc = function (t) { return String(t).replace(/^По запросу$/, 'по запросу'); };
  var isOpenPrice = function (p) { return p && (p.type === 'from' || p.type === 'range' || p.type === 'request'); };

  /* ---------------------------------------------------------------- обложка */

  var hero = C.hero || {}, cta = hero.cta || {};
  var c = C.contacts || {}, hours = (c.hours || [])[0];
  $('#coverMast').innerHTML = [hero.eyebrow || '', c.city || '', hours ? hours.days + ' ' + hours.time : ''].filter(Boolean)
    .map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
  // заголовок по словам — для мягкого появления слов
  var words = String(hero.title || '').split(/\s+/).filter(Boolean);
  $('#heroTitle').innerHTML = words.map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + esc(w) + '</span>'; }).join(' ');
  // главная кнопка — под заголовком; ведёт в запрос с уже выбранной консультацией
  $('#heroCta').textContent = cta.label || 'Записаться на консультацию';
  $('#heroCta').href = '#' + (cta.target || 'booking');
  if (consult) $('#heroCta').setAttribute('data-book-svc', consult.id);
  // «как это устроено»: шаги из hero.steps; у шага с услугой — длительность и цена
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var steps = hero.steps && hero.steps.length ? hero.steps : [
    { title: 'Консультация', text: 'Специалист осматривает кожу и отвечает на вопросы.', service: consult && consult.id },
    { title: 'Процедура', text: 'Только если решите вы.', link: { label: 'Услуги и цены', target: 'services' } }
  ];
  $('#heroRoute').innerHTML = steps.map(function (st, i) {
    var s = st.service ? T.byId(services, st.service) : null;
    var meta = s ? '<p class="route__meta">' + esc([T.duration(s.duration), T.priceText(s.price)].filter(Boolean).join(' · ')) + '</p>' : '';
    var act = s ? '<a class="route__cta" href="#' + esc(cta.target || 'booking') + '" data-book-svc="' + esc(s.id) + '">' + esc(s === consult ? 'Выбрать время' : 'Записаться') + ARROW + '</a>'
      : st.link ? '<a class="route__cta" href="#' + esc(st.link.target || 'services') + '">' + esc(st.link.label || 'Подробнее') + ARROW + '</a>' : '';
    return '<li class="route__step" style="--i:' + i + '"><span class="route__n" aria-hidden="true">' + (i + 1) + '</span>' +
      '<h2 class="route__title">' + esc(st.title) + '</h2>' + meta + '<p class="route__text">' + esc(st.text || '') + '</p>' + act + '</li>';
  }).join('');
  // предупреждение для медицинских услуг — строкой под шагами
  var warn = (C.legal || {}).medicalWarning;
  $('#coverNote').hidden = !warn;
  $('#coverNote').textContent = warn || '';

  // капля на заголовке чуть тянется за курсором — как жидкость на наклонной поверхности
  var drop = $('#coverDrop'), cover = $('#top');
  if (drop && !FB.reduced && window.matchMedia && matchMedia('(hover: hover)').matches) {
    var dx = 0, dy = 0, tx = 0, ty = 0, raf = 0;
    var step = function () {
      raf = 0; dx += (tx - dx) * .08; dy += (ty - dy) * .08;
      drop.style.setProperty('--dx', dx.toFixed(2) + 'px'); drop.style.setProperty('--dy', dy.toFixed(2) + 'px');
      if (Math.abs(tx - dx) + Math.abs(ty - dy) > .1) raf = requestAnimationFrame(step);
    };
    cover.addEventListener('pointermove', function (e) {
      var r = drop.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      tx = Math.max(-1, Math.min(1, (e.clientX - cx) / 600)) * 18; ty = Math.max(-1, Math.min(1, (e.clientY - cy) / 600)) * 12;
      if (!raf) raf = requestAnimationFrame(step);
    });
    cover.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  }

  /* ---------------------------------------------------------------- специалисты */

  T.section('specialists', T.feature('team') && team.length);
  var demoTeam = T.demo && team.some(function (m) { return m.demo && !m.name; });
  $('#specGrid').innerHTML = team.map(function (m) {
    var svc = (m.services || []).map(function (id) { var s = T.byId(services, id); return s ? s.name : null; }).filter(Boolean);
    var cred = (m.credentials || []).filter(function (x) { return x && x.title; });
    var ph = T.asset(m.photo);
    return '<article class="spec' + (ph ? ' spec--photo' : '') + '" data-reveal>' + (ph ? '<div class="spec__photo">' + T.img(m.photo, { alt: '' }) + '</div>' : '') +
      '<h3>' + esc(specName(m)) + '</h3>' + (m.name ? '<p class="spec__role">' + esc(m.role) + '</p>' : '') +
      '<p class="spec__label">Ведёт</p><ul class="spec__svc" role="list">' + svc.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') +
        (svc.length > 3 ? '<li class="spec__more"><button type="button" data-spec-more>ещё ' + (svc.length - 3) + '</button></li>' : '') + '</ul>' +
      (cred.length ? '<ul class="spec__cred" role="list">' + cred.map(function (x) {
        return '<li>' + esc(x.title) + (x.issuer ? ', ' + esc(x.issuer) : '') + (x.year ? ', ' + esc(x.year) : '') + (x.number ? ' · № ' + esc(x.number) : '') + '</li>';
      }).join('') + '</ul>' : '') +
      '<button class="link-btn" type="button" data-book-spec="' + esc(m.id) + '">Записаться к специалисту<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></article>';
  }).join('');
  T.rail($('#specGrid'), 'Специалисты');
  $('#specGrid').addEventListener('click', function (e) { var b = e.target.closest('[data-spec-more]'); if (b) { b.closest('.spec').classList.add('is-all'); } });
  $('#specDemo').hidden = !demoTeam;
  if (demoTeam) $('#specDemo').innerHTML = '<span class="demo-tag">пример</span> Имена и фото специалистов появятся после заполнения <code>config.js → team</code>. Сейчас показаны роли.';

  /* ---------------------------------------------------------------- услуги оглавлением */

  T.section('services', services.length);
  var demoPrices = T.demo && (C.pricing && C.pricing.demo || services.some(function (s) { return s.demo; }));
  var usedCats = cats.filter(function (x) { return services.some(function (s) { return s.cat === x.id; }); });
  // чипы категорий над прайсом — быстрый переход на телефоне (на компьютере скрыты)
  if (usedCats.length > 1) {
    var jump = document.createElement('nav');
    jump.className = 'toc__jump';
    jump.setAttribute('aria-label', 'Категории услуг');
    jump.innerHTML = usedCats.map(function (cat) { return '<a href="#cat-' + esc(cat.id) + '">' + esc(cat.name) + '</a>'; }).join('');
    $('#svcToc').parentNode.insertBefore(jump, $('#svcToc'));
  }
  $('#svcToc').innerHTML = usedCats.map(function (cat) {
    return '<section class="toc__cat" id="cat-' + esc(cat.id) + '" data-reveal><h3 class="toc__h">' + esc(cat.name) + '</h3><ol class="toc__list" role="list">' +
      services.filter(function (s) { return s.cat === cat.id; }).map(function (s) {
        var id = 'svc-' + esc(s.id), specs = specsFor(s.id), ok = s.approved === true;
        var sec = function (title, text) { return text ? '<h4>' + title + '</h4><p>' + esc(text) + '</p>' : ''; };
        return '<li class="toc__row">' +
          '<button class="toc__btn" type="button" aria-expanded="false" aria-controls="' + id + '">' +
            '<span class="toc__name">' + esc(s.name) + '</span><span class="toc__dots" aria-hidden="true"></span>' +
            '<span class="toc__price">' + esc(lc(T.priceText(s.price))) + '</span></button>' +
          '<div class="toc__more" id="' + id + '" hidden>' +
            '<p>' + esc(s.summary || '') + '</p>' +
            '<p class="toc__meta">' + esc(T.duration(s.duration) || 'длительность уточняется') + (specs.length ? ' · ведёт: ' + specs.map(function (m) { return esc(specName(m)); }).join(', ') : '') + '</p>' +
            (ok ? sec('Описание', s.description) + sec('Подготовка', s.preparation) + sec('Ограничения', s.limitations) : '<p class="toc__note">' + esc(UNAPPROVED) + '</p>') +
            '<button class="btn btn--accent btn--sm" type="button" data-book-svc="' + esc(s.id) + '">Записаться</button>' +
          '</div></li>';
      }).join('') + '</ol></section>';
  }).join('');
  var openPrices = services.some(function (s) { return isOpenPrice(s.price); });
  $('#svcNote').hidden = !(openPrices || demoPrices);
  $('#svcNote').innerHTML = (demoPrices ? '<span class="demo-tag">демо-цены</span> ' : '') + esc(PRICE_NOTE);
  $('#svcToc').addEventListener('click', function (e) {
    var b = e.target.closest('.toc__btn');
    if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true', more = document.getElementById(b.getAttribute('aria-controls'));
    b.setAttribute('aria-expanded', String(open));
    more.hidden = !open;
    if (open && canAnimate) more.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });

  /* ---------------------------------------------------------------- кабинет: разворот с подписями, оборудование */

  // space: id фото или { image, caption, ratio, focus }; ratio — пропорция кадра (ширина / высота),
  // focus — какая часть фото остаётся в кадре (CSS object-position). Подпись выводится, только если задана
  var space = T.list('space').map(function (x) { return typeof x === 'string' ? { image: x } : x; }).filter(function (x) { return x && T.asset(x.image); });
  var eq = T.list('equipment');
  T.section('cabinet', (T.feature('space') && space.length) || (T.feature('equipment') && eq.length));
  $('#spaceGrid').hidden = !(T.feature('space') && space.length);
  $('#spaceGrid').innerHTML = space.map(function (x) {
    var a = T.asset(x.image) || {}, ratio = +x.ratio || (a.width && a.height ? a.width / a.height : 1.5);
    var st = '--r:' + ratio.toFixed(3) + (x.focus ? ';--focus:' + esc(x.focus) : '');
    return '<figure class="spread__fig" style="' + st + '" data-reveal>' + T.img(x.image) + (x.caption ? '<figcaption>' + esc(x.caption) + '</figcaption>' : '') + '</figure>';
  }).join('');
  T.rail($('#spaceGrid'), 'Фото кабинета');
  var demoSpace = T.demo && space.some(function (x) { return (T.asset(x.image) || {}).demo; });
  $('#cabLead').innerHTML = demoSpace ? '<span class="demo-tag">демо</span> Стоковые фото. Замените их снимками кабинета и зоны ожидания.' : '';
  $('#cabLead').hidden = !demoSpace;
  $('#eqBox').hidden = !(T.feature('equipment') && eq.length);
  $('#eqList').innerHTML = eq.map(function (e) {
    return '<div><dt>' + esc(e.name) + (e.demo && T.demo ? ' <span class="demo-tag">укажите модель</span>' : '') + '</dt><dd>' + esc(e.text || '') + '</dd></div>';
  }).join('');

  // результаты: только записи с подтверждённым согласием пациента
  var results = T.list('results').filter(function (r) { return r.consentConfirmed === true && T.asset(r.image); });
  T.section('results', T.feature('results') && results.length);
  $('#resGrid').innerHTML = results.map(function (r) { return '<figure>' + T.img(r.image) + '<figcaption>' + esc(r.caption || '') + '</figcaption></figure>'; }).join('');

  var lic = T.list('licenses').filter(function (l) { return l && l.number; });
  T.section('licenses', T.feature('licenses') && lic.length);
  $('#licList').innerHTML = lic.map(function (l) {
    return '<li><b>' + esc(l.title || 'Лицензия') + ' № ' + esc(l.number) + '</b>' + (l.date ? ' от ' + esc(l.date) : '') + (l.issuer ? ', ' + esc(l.issuer) : '') +
      (l.url ? ' · <a href="' + esc(l.url) + '" target="_blank" rel="noopener">реестр</a>' : '') + '</li>';
  }).join('');

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);

  // вопросы — как интервью: всё видно сразу; разметка FAQPage для поиска
  var faq = T.list('faq');
  T.section('faq', faq.length);
  $('#faqList').innerHTML = faq.map(function (q) { return '<div class="qa__item" data-reveal><h3 class="qa__q">' + esc(q.q) + '</h3><p class="qa__a">' + esc(q.a) + '</p></div>'; }).join('');
  if (faq.length) {
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(function (q) { return { '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } }; }) });
    document.head.appendChild(ld);
  }

  // контакты: фраза-приглашение с длительностью и ценой консультации
  $('#colophonSay').textContent = consult
    ? 'Начните с консультации: ' + [T.duration(consult.duration), T.priceText(consult.price)].filter(Boolean).join(', ') + '. Решение о процедуре — после неё.'
    : 'Запишитесь на приём — администратор подтвердит время.';
  if (consult) $('#contactsCta').setAttribute('data-book-svc', consult.id);

  // длинная подсказка общего слоя о пустых контактах — одной демо-строкой; реквизиты — в консоль
  if (T.demo) {
    var note = $('.contact-row--note');
    if (note) {
      note.remove();
      $('#contactsDemo').hidden = false;
      $('#contactsDemo').innerHTML = '<span class="demo-tag">демо</span> Телефон, почта и Telegram появятся после заполнения <code>config.js → contacts</code>.';
    }
    var l = C.legal || {}, req = $('.legal-req');
    if (req && !(l.operator && l.inn)) { req.remove(); console.info('[cosmetology] Демо: реквизиты появятся после заполнения config.js → legal.'); }
  }

  /* ---------------------------------------------------------------- запрос консультации */

  var form = $('#bookForm');
  var OTHER = 'other';
  // шаг 1: консультация или конкретная услуга; список услуг — только для второго варианта
  $('#bStart').innerHTML =
    (consult ? '<label class="pick__item"><input type="radio" name="start" value="consult" required data-msg="Выберите, с чего начать"><b>Консультация</b><span>' + esc([T.duration(consult.duration), T.priceText(consult.price)].filter(Boolean).join(' · ')) + '</span><em>рекомендуем начать с неё</em></label>' : '') +
    '<label class="pick__item"><input type="radio" name="start" value="' + OTHER + '" required data-msg="Выберите, с чего начать"><b>Конкретная услуга</b><span>если вы уже знаете, что нужно</span></label>';
  $('#bServices').innerHTML = usedCats.filter(function (x) { return !consult || x.id !== consult.cat || services.filter(function (s) { return s.cat === x.id; }).length > 1; }).map(function (cat) {
    return '<p class="svc-pick__cat">' + esc(cat.name) + '</p>' + services.filter(function (s) { return s.cat === cat.id && s !== consult; }).map(function (s) {
      return '<label class="svc-pick__item"><input type="radio" name="serviceId" value="' + esc(s.id) + '" required data-msg="Выберите услугу"><span>' + esc(s.name) + '</span><small>' + esc(lc(T.priceText(s.price))) + '</small></label>';
    }).join('');
  }).join('');
  var parts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#bParts').innerHTML = parts.map(function (p) {
    var m = String(p).split(/,\s*/);
    return '<label class="seg__item"><input type="radio" name="part" value="' + esc(p) + '" required data-msg="Выберите время суток"><b>' + esc(m[0]) + '</b>' + (m[1] ? '<small>' + esc(m.slice(1).join(', ')) + '</small>' : '') + '</label>';
  }).join('');
  // желаемый день: две недели; дни, которых нет в часах работы, недоступны («Пн–Сб» — воскресенье закрыто)
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], open = {}, parsed = false;
  (c.hours || []).forEach(function (h) {
    if (/выходн|закрыт/i.test(h.time || '')) return;
    if (/ежедневно|без выходных/i.test(h.days || '')) { WD.forEach(function (_, d) { open[d] = true; }); parsed = true; return; }
    String(h.days || '').toLowerCase().split(/\s*,\s*/).forEach(function (part) {
      var r = part.split(/\s*[–-]\s*/), a = WD.indexOf(r[0].slice(0, 2)), b = WD.indexOf((r[1] || r[0]).slice(0, 2));
      if (a < 0 || b < 0) return;
      parsed = true;
      for (var d = a; ; d = (d + 1) % 7) { open[d] = true; if (d === b) break; }
    });
  });
  $('#bDays').innerHTML = FB.days(14).map(function (d, i) {
    var off = parsed && !open[d.getDay()], w = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : WD[d.getDay()];
    return '<label class="day' + (off ? ' is-off' : '') + '"' + (off ? ' title="Выходной"' : '') + '><input type="radio" name="date" value="' + FB.iso(d) + '"' + (off ? ' disabled' : ' required data-msg="Выберите день"') + '>' +
      '<small>' + w + '</small><b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') + '</small></label>';
  }).join('');
  $('#bConsent').innerHTML = T.consentHtml('bConsentBox');

  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function serviceNow() { return val('start') === 'consult' ? consult : T.byId(services, val('serviceId')); }
  var wantedSpec = '';
  function renderSpecs() {
    var s = serviceNow(), list = s ? specsFor(s.id) : [];
    var want = wantedSpec || val('spec') || HELP;
    var prev = list.some(function (m) { return m.id === want; }) ? want : HELP;
    wantedSpec = '';
    $('#bSpecs').innerHTML = '<label class="person"><input type="radio" name="spec" value="' + HELP + '" required' + (prev === HELP ? ' checked' : '') + '><span><b>Помогите выбрать</b><small>администратор подберёт специалиста</small></span></label>' +
      list.map(function (m) {
        return '<label class="person"><input type="radio" name="spec" value="' + esc(m.id) + '"' + (prev === m.id ? ' checked' : '') + '>' + face(m) + '<span><b>' + esc(specName(m)) + '</b><small>' + esc(m.name ? m.role : 'ведёт эту услугу') + '</small></span></label>';
      }).join('');
  }
  function renderStart() { $('#bServiceBox').hidden = val('start') !== OTHER; }
  function renderAsk() {
    var s = serviceNow(), specId = val('spec'), m = T.byId(team, specId), d = val('date'), part = val('part');
    var rows = [
      ['Услуга', s ? esc(s.name) + ' <span>' + esc(T.priceText(s.price)) + '</span>' : '<span>не выбрана</span>'],
      ['Специалист', specId === HELP || !specId ? 'поможем выбрать' : m ? esc(specName(m)) : '<span>не выбран</span>'],
      ['Когда', d ? esc(FB.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long' })) + (part ? ', ' + esc(part.toLowerCase()) : '') : '<span>на шаге 2</span>']
    ];
    $('#bookSummary').innerHTML = rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    $('#bookSummary').classList.toggle('is-empty', !s && !d && (!specId || specId === HELP));
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'start') { renderStart(); renderSpecs(); }
    if (e.target.name === 'serviceId') renderSpecs();
    renderAsk();
  });
  renderStart(); renderSpecs(); renderAsk();

  var wiz = T.wizard(form, { progress: $('#bookSteps') });

  function pick(serviceId, specId) {
    if (!serviceId && specId) {
      // специалист без выбранной услуги — консультация, если он её ведёт, иначе его первая услуга
      var m = T.byId(team, specId), own = (m && m.services) || [];
      serviceId = consult && own.indexOf(consult.id) > -1 ? consult.id : own[0] || '';
    }
    var isConsult = consult && serviceId === consult.id;
    var st = form.querySelector('input[name=start][value="' + (isConsult ? 'consult' : OTHER) + '"]');
    if (st) st.checked = true;
    if (!isConsult) { var r = form.querySelector('input[name=serviceId][value="' + serviceId + '"]'); if (r) r.checked = true; }
    wantedSpec = specId || '';
    renderStart(); renderSpecs(); renderAsk();
    if (!$('#bookResult').hidden) { $('#bookResult').hidden = true; form.hidden = false; }
    wiz.go(0, false);
    FB.scrollTo('#booking');
  }
  document.addEventListener('click', function (e) {
    var bs = e.target.closest('[data-book-svc]'), sp = e.target.closest('[data-book-spec]');
    if (bs) { e.preventDefault(); pick(bs.getAttribute('data-book-svc')); }
    if (sp) pick('', sp.getAttribute('data-book-spec'));
  });

  T.leadForm(form, {
    type: 'consult_request',
    result: $('#bookResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Запрос принят',
    successText: (C.booking && C.booking.successText) || '',
    before: function () { return serviceNow() ? true : 'Выберите консультацию или услугу.'; },
    collect: function (fd) {
      var s = serviceNow(), specId = fd.get('spec'), m = T.byId(team, specId);
      return {
        service: s ? s.name : '',
        resource: specId === HELP ? 'Помочь выбрать' : m ? specName(m) : '',
        time: fd.get('part'),
        total: s ? T.priceText(s.price) : '',
        consent: fd.get('consent') === 'да',
        details: { 'Код услуги': s ? s.id : '', 'Код специалиста': specId, 'Запись': 'требует подтверждения' },
        start: undefined, serviceId: undefined, spec: undefined, part: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Услуга</dt><dd>' + esc(p.service) + '</dd><dt>Специалист</dt><dd>' + esc(p.resource) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(String(p.time || '').toLowerCase()) + '</dd></dl>';
    }
  });
  form.addEventListener('fb:reset', function () { renderStart(); renderSpecs(); renderAsk(); });

  T.mobileCta(cta.label || 'Записаться на консультацию', 'booking');
});
