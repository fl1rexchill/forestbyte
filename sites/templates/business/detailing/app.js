/* Детейлинг-студия: услуги с зонами → пакеты → работы с фильтром → до/после (клавиатура) →
   расчёт: класс авто → услуга → зона или пакет → допуслуги → контакт. Все цены — из config.js. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var classes = T.list('carClasses'), services = T.list('services'), packs = T.list('packages');
  var extras = T.list('extras'), works = T.list('portfolio');
  var pricing = C.pricing || {};
  var PACKAGE = 'package';

  function minPrice(list) {
    var vals = list.map(function (z) { var p = z.price || {}; return p.type === 'range' ? p.min : p.value; }).filter(function (v) { return v > 0; });
    return vals.length ? { type: 'from', value: Math.min.apply(null, vals) } : { type: 'request' };
  }

  /* ---------------------------------------------------------------- первый экран */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Рассчитать стоимость';
  $('#heroCta').href = '#' + (cta.target || 'calc');
  $('#heroMedia').innerHTML = T.img(C.hero && C.hero.image, { eager: true });
  $('#heroFacts').innerHTML = [
    services.length + ' ' + FB.plural(services.length, ['услуга', 'услуги', 'услуг']),
    packs.length ? packs.length + ' ' + FB.plural(packs.length, ['пакет', 'пакета', 'пакетов']) : '',
    'расчёт по классу авто'
  ].filter(Boolean).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

  /* ---------------------------------------------------------------- услуги */

  T.section('services', services.length);
  $('#svcList').innerHTML = services.map(function (s, i) {
    return '<li class="svc" data-reveal><span class="svc__n mono">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="svc__main"><h3>' + esc(s.name) + '</h3><p>' + esc(s.short || '') + '</p>' +
      '<ul class="svc__zones" role="list">' + (s.zones || []).map(function (z) { return '<li><span>' + esc(z.name) + '</span><b>' + esc(T.priceText(z.price)) + '</b></li>'; }).join('') + '</ul>' +
      '<p class="svc__price">' + T.priceHtml(minPrice(s.zones || []), 1, (s.zones || []).some(function (z) { return z.demo; })) + ' <span class="mono">· малый класс</span></p>' +
      '<button class="btn btn--line btn--sm" type="button" data-calc-service="' + esc(s.id) + '">Рассчитать</button></div>' +
      '<div class="svc__media">' + T.img(s.image, { alt: '' }) + '</div></li>';
  }).join('');

  /* ---------------------------------------------------------------- пакеты */

  T.section('packages', T.feature('packages') && packs.length);
  $('#packGrid').innerHTML = packs.map(function (p) {
    return '<article class="pack" data-reveal><h3>' + esc(p.name) + '</h3>' +
      '<p class="pack__price">' + T.priceHtml(p.price, 1, p.demo) + '</p>' +
      (p.duration ? '<p class="mono pack__dur">' + esc(T.duration(p.duration)) + '</p>' : '') +
      '<h4>Состав</h4><ul role="list">' + (p.composition || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      (p.limits && p.limits.length ? '<h4>Ограничения</h4><ul role="list" class="pack__limits">' + p.limits.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      '<button class="btn btn--accent btn--sm" type="button" data-calc-pack="' + esc(p.id) + '">Рассчитать пакет</button></article>';
  }).join('');

  /* ---------------------------------------------------------------- работы */

  var wFilter = 'all';
  T.section('works', T.feature('portfolio') && works.length);
  $('#worksDemo').hidden = !(T.demo && works.some(function (w) { return w.demo; }));
  var wServices = services.filter(function (s) { return works.some(function (w) { return w.service === s.id; }); });
  $('#worksFilter').innerHTML = [{ id: 'all', name: 'Все' }].concat(wServices).map(function (s) {
    return '<button class="chip" type="button" data-wf="' + esc(s.id) + '" aria-pressed="' + (s.id === 'all') + '">' + esc(s.name) + '</button>';
  }).join('');
  function renderWorks() {
    var list = works.filter(function (w) { return wFilter === 'all' || w.service === wFilter; });
    $('#worksGrid').innerHTML = list.map(function (w, i) {
      var s = T.byId(services, w.service);
      return '<figure class="work work--' + (i % 5 === 0 ? 'wide' : 'std') + '">' + T.img(w.image) +
        '<figcaption><span class="mono">' + esc(s ? s.name : '') + '</span>' + esc(w.title) + T.demoTag(w.demo, 'демо') + '</figcaption></figure>';
    }).join('');
    if (FB.anime && !FB.reduced) FB.anime.animate($$('#worksGrid .work'), { opacity: [0, 1], scale: [.97, 1], delay: FB.anime.stagger(60), duration: 500, ease: 'outCubic' });
  }
  $('#worksFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wf]');
    if (!b) return;
    wFilter = b.getAttribute('data-wf');
    $$('#worksFilter [data-wf]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderWorks();
  });
  renderWorks();

  /* ---------------------------------------------------------------- до / после */

  // только пары одной работы (sameCar) и только если оба изображения есть
  var pairs = T.list('beforeAfter').filter(function (p) { return p.sameCar === true && T.asset(p.before) && T.asset(p.after); });
  T.section('compare', T.feature('beforeAfter') && pairs.length);
  $('#compareNote').textContent = pairs.some(function (p) { return p.illustration; })
    ? 'Сейчас здесь схематичная иллюстрация, а не фото результата. Замените её парой снимков одного автомобиля до и после работы.'
    : 'Оба кадра — один и тот же автомобиль до и после работы.';
  $('#compareList').innerHTML = pairs.map(function (p, i) {
    var id = 'ba-' + i;
    return '<figure class="ba" style="--pos:50%">' +
      '<div class="ba__stage"><div class="ba__after">' + T.img(p.after) + '</div><div class="ba__before" aria-hidden="true">' + T.img(p.before, { alt: '' }) + '</div>' +
      '<span class="ba__line" aria-hidden="true"></span><span class="ba__tag ba__tag--l mono">до</span><span class="ba__tag ba__tag--r mono">после</span></div>' +
      '<label class="ba__ctrl" for="' + id + '"><span class="sr-only">Положение сравнения до и после для «' + esc(p.title) + '»</span>' +
      '<input type="range" id="' + id + '" min="0" max="100" value="50" step="1" aria-valuetext="50% кадра до"></label>' +
      '<figcaption>' + esc(p.title) + T.demoTag(p.demo, p.illustration ? 'иллюстрация' : 'демо') + '</figcaption></figure>';
  }).join('');
  $$('.ba input[type=range]').forEach(function (r) {
    var fig = r.closest('.ba');
    r.addEventListener('input', function () {
      fig.style.setProperty('--pos', r.value + '%');
      r.setAttribute('aria-valuetext', r.value + '% кадра до');
    });
  });

  /* ---------------------------------------------------------------- процесс, материалы, команда, уход */

  var proc = T.list('process');
  $('#procList').innerHTML = proc.map(function (s, i) {
    return '<li data-reveal><span class="mono">' + String(i + 1).padStart(2, '0') + '</span><div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></div></li>';
  }).join('');
  T.section('process', proc.length);
  var mats = T.list('materials'), team = T.list('team');
  $('#materialsBox').hidden = !mats.length;
  $('#matList').innerHTML = mats.map(function (m) { return '<li><b>' + esc(m.name) + '</b>' + T.demoTag(m.demo, 'укажите марку') + '<span>' + esc(m.text || '') + '</span></li>'; }).join('');
  $('#teamBox').hidden = !(T.feature('team') && team.length);
  $('#teamList').innerHTML = team.map(function (m) { return '<li><b>' + esc(m.name || m.role) + '</b>' + (m.name ? '<span>' + esc(m.role) + '</span>' : '') + '<span>' + esc(m.area || '') + '</span>' + T.demoTag(m.demo, 'пример роли') + '</li>'; }).join('');

  var care = T.list('care'), warranty = T.list('warranty');
  T.section('care', care.length || warranty.length);
  $('#careList').innerHTML = care.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
  $('#warrantyBox').hidden = !warranty.length;   // гарантии — только из данных студии
  $('#warrantyList').innerHTML = warranty.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');

  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);
  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);

  /* ---------------------------------------------------------------- расчёт */

  var form = $('#calcForm');
  $('#cClasses').innerHTML = classes.map(function (c, i) {
    return '<label class="opt"><input type="radio" name="carClass" value="' + esc(c.id) + '"' + (i === 0 ? ' required' : '') + '>' +
      '<span class="opt__name">' + esc(c.name) + '</span><span class="opt__sub">' + esc(c.example || '') + '</span></label>';
  }).join('');
  $('#cServices').innerHTML = services.map(function (s, i) {
    return '<label class="opt"><input type="radio" name="service" value="' + esc(s.id) + '"' + (i === 0 ? ' required' : '') + '>' +
      '<span class="opt__name">' + esc(s.name) + '</span><span class="opt__sub">' + esc(s.short || '') + '</span></label>';
  }).join('') + (packs.length && T.feature('packages') ? '<label class="opt opt--pack"><input type="radio" name="service" value="' + PACKAGE + '"><span class="opt__name">Готовый пакет</span><span class="opt__sub">' + packs.map(function (p) { return esc(p.name); }).join(' · ') + '</span></label>' : '');
  $('#cExtras').innerHTML = extras.map(function (x) {
    return '<label class="opt opt--check"><input type="checkbox" name="extras" value="' + esc(x.id) + '"><span class="opt__name">' + esc(x.name) + '</span><span class="opt__sub">' + esc(T.priceText(x.price)) + (x.coef ? ' · зависит от класса' : '') + '</span></label>';
  }).join('');
  $('#cConsent').innerHTML = T.consentHtml('cConsentBox');
  FB.files($('#cPhotos'), { max: 3, maxSize: 10 * 1024 * 1024, list: $('#cPhotoList') });

  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function renderZones(keep) {
    var sid = val('service'), prev = keep ? val('zone') : '';
    var list = sid === PACKAGE ? packs : ((T.byId(services, sid) || {}).zones || []);
    $('#cZoneTitle').textContent = sid === PACKAGE ? 'Какой пакет?' : 'Какая зона или вариант?';
    $('#cZones').innerHTML = list.map(function (z, i) {
      return '<label class="opt"><input type="radio" name="zone" value="' + esc(z.id) + '"' + (i === 0 ? ' required' : '') + (z.id === prev ? ' checked' : '') + '>' +
        '<span class="opt__name">' + esc(z.name) + '</span><span class="opt__sub">' + esc(T.priceText(z.price)) + (z.duration ? ' · ' + esc(T.duration(z.duration)) : '') +
        (z.composition ? '<br>' + esc(z.composition.join(', ')) : '') + '</span></label>';
    }).join('') || '<p class="hint">Для этой услуги варианты не заданы — стоимость назовём после осмотра.</p>';
    var s = T.byId(services, sid);
    var limits = sid === PACKAGE ? [] : (s && s.limits) || [];
    $('#cLimits').innerHTML = limits.length ? '<div class="limits"><h4 class="mono">Ограничения</h4><ul role="list">' + limits.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>' : '';
  }

  function calc() {
    var cls = T.byId(classes, val('carClass')), sid = val('service'), zid = val('zone');
    var coef = cls ? cls.coef || 1 : 1, items = [], lines = [], durMin = 0, durMax = 0;
    var zone = sid === PACKAGE ? T.byId(packs, zid) : T.byId((T.byId(services, sid) || {}).zones, zid);
    if (zone) {
      items.push({ price: zone.price, coef: coef });
      lines.push([(sid === PACKAGE ? 'Пакет «' + zone.name + '»' : (T.byId(services, sid) || {}).name + ': ' + zone.name.toLowerCase()), T.priceText(zone.price, coef)]);
      durMin += T.durMin(zone.duration); durMax += T.durMax(zone.duration);
    }
    form.querySelectorAll('input[name=extras]:checked').forEach(function (c) {
      var x = T.byId(extras, c.value);
      if (!x) return;
      var k = x.coef ? coef : 1;
      items.push({ price: x.price, coef: k });
      lines.push([x.name, T.priceText(x.price, k)]);
    });
    return { cls: cls, sid: sid, zone: zone, items: items, lines: lines, sum: T.sum(items), durMin: durMin, durMax: durMax };
  }
  function renderSummary() {
    var r = calc(), box = $('#sumBody');
    if (!r.cls && !r.zone) { box.innerHTML = '<p class="sum__empty">Выберите класс и услугу — покажем ориентир по цене и времени.</p>'; return; }
    box.innerHTML = (r.cls ? '<p class="sum__class"><span class="mono">класс</span> ' + esc(r.cls.name) + (r.cls.coef !== 1 ? ' · ×' + String(r.cls.coef).replace('.', ',') : '') + '</p>' : '') +
      (r.lines.length ? '<ul class="sum__lines" role="list">' + r.lines.map(function (l) { return '<li><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></li>'; }).join('') + '</ul>' : '') +
      '<p class="sum__total"><span>Ориентир</span><b>' + esc(r.zone ? r.sum.text : '—') + '</b></p>' +
      (r.durMax ? '<p class="mono sum__time">время работы ≈ ' + esc(T.duration(r.durMin === r.durMax ? r.durMin : { min: r.durMin, max: r.durMax })) + '</p>' : '') +
      T.demoTag(pricing.demo, 'демо-цены') +
      '<p class="sum__note">' + esc(pricing.note || 'Итоговую стоимость уточняем после осмотра.') + '</p>';
  }

  var wiz = T.wizard(form, {
    progress: $('#calcSteps'),
    onStep: function (i) { if (i === 2) renderZones(true); }
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'service') renderZones(false);
    renderSummary();
  });
  form.addEventListener('fb:reset', renderSummary);
  renderSummary();

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
