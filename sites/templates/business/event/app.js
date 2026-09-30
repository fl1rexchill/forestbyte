/* Event-агентство: форматы → проекты с фильтром → услуги → бриф из 5 шагов с предварительной сметой.
   Все данные — из config.js (window.SITE_CONFIG). Даты агентства не резервируются: бриф — это заявка на обсуждение. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var formats = T.list('formats'), services = T.list('services'), projects = T.list('portfolio');
  var pricing = C.pricing || {};
  var fmtById = function (id) { return T.byId(formats, id); };

  /* ---------------------------------------------------------------- первый экран */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || (C.brand && C.brand.name) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Обсудить мероприятие';
  $('#heroCta').href = '#' + (cta.target || 'brief');
  $('#heroMedia').innerHTML = T.img(C.hero && C.hero.image, { eager: true });
  $('#heroFormats').innerHTML = formats.map(function (f) {
    return '<li><a href="#brief" data-pick-format="' + esc(f.id) + '">' + esc(f.name) + '</a></li>';
  }).join('');

  /* ---------------------------------------------------------------- форматы */

  T.section('formats', formats.length);
  $('#formatsGrid').innerHTML = formats.map(function (f, i) {
    var n = projects.filter(function (p) { return p.format === f.id; }).length;
    return '<article class="fcard fcard--' + (i === 0 ? 'big' : 'std') + '" data-reveal>' +
      '<div class="fcard__media">' + T.img(f.image, { alt: '' }) + '</div>' +
      '<div class="fcard__body"><h3>' + esc(f.name) + '</h3><p>' + esc(f.short || '') + '</p>' +
      '<div class="fcard__actions">' +
      (n ? '<button class="btn btn--line btn--sm" type="button" data-show-format="' + esc(f.id) + '">Проекты · ' + n + '</button>' : '') +
      '<a class="btn btn--accent btn--sm" href="#brief" data-pick-format="' + esc(f.id) + '">Обсудить ' + esc(f.name.toLowerCase()) + '</a></div></div></article>';
  }).join('');

  /* ---------------------------------------------------------------- проекты */

  var curFilter = 'all';
  var hasDemo = projects.some(function (p) { return p.demo; });
  T.section('projects', T.feature('portfolio') && projects.length);
  $('#projectsDemo').hidden = !(T.demo && hasDemo);
  var usedFormats = formats.filter(function (f) { return projects.some(function (p) { return p.format === f.id; }); });
  $('#projectFilter').innerHTML = [{ id: 'all', name: 'Все' }].concat(usedFormats).map(function (f) {
    return '<button class="chip" type="button" data-filter="' + esc(f.id) + '" aria-pressed="' + (f.id === 'all') + '">' + esc(f.name) + '</button>';
  }).join('');

  function renderProjects() {
    var list = projects.filter(function (p) { return curFilter === 'all' || p.format === curFilter; });
    $('#projectsGrid').innerHTML = list.map(function (p, i) {
      var f = fmtById(p.format);
      return '<button class="pcard pcard--' + esc(p.size || 'm') + '" type="button" data-project="' + esc(p.id) + '" style="--i:' + i + '">' +
        '<span class="pcard__media">' + T.img(p.cover, { alt: '' }) + '</span>' +
        '<span class="pcard__meta"><span class="pcard__fmt">' + esc(f ? f.name : '') + '</span>' + T.demoTag(p.demo, 'демо-проект') + '</span>' +
        '<span class="pcard__title">' + esc(p.title) + '</span></button>';
    }).join('') || '<p class="empty">В этом формате пока нет проектов.</p>';
    if (FB.anime && !FB.reduced) {
      FB.anime.animate($$('#projectsGrid .pcard'), { opacity: [0, 1], translateY: [18, 0], delay: FB.anime.stagger(55), duration: 520, ease: 'outCubic' });
    }
  }
  function setFilter(id) {
    curFilter = id;
    $$('#projectFilter [data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === id)); });
    renderProjects();
  }
  $('#projectFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) setFilter(b.getAttribute('data-filter'));
  });
  renderProjects();

  // карточка проекта в модальном окне (FB.modal: Esc, фокус, блокировка фона)
  function openProject(id, opener) {
    var p = T.byId(projects, id);
    if (!p) return;
    var f = fmtById(p.format);
    var gallery = (p.gallery || []).filter(function (g) { return g !== p.cover; });
    $('#pmBody').innerHTML =
      '<div class="pm__cover">' + T.img(p.cover) + '</div>' +
      '<div class="pm__text"><p class="eyebrow">' + esc(f ? f.name : '') + T.demoTag(p.demo, 'демо-проект') + '</p>' +
      '<h2 id="pmTitle">' + esc(p.title) + '</h2>' +
      '<h3>Задача</h3><p>' + esc(p.task || '') + '</p>' +
      (p.works && p.works.length ? '<h3>Что сделали</h3><ul class="pm__works">' + p.works.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      (p.demo && T.demo ? '<p class="pm__note">Это пример карточки. Фото — стоковые, не работа агентства.</p>' : '') +
      '<a class="btn btn--accent" href="#brief" data-pick-format="' + esc(p.format) + '">Обсудить похожее событие</a></div>' +
      (gallery.length ? '<div class="pm__gallery">' + gallery.map(function (g) { return T.img(g); }).join('') + '</div>' : '');
    FB.modal.open('projectModal', opener);
  }
  $('#projectsGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-project]');
    if (b) openProject(b.getAttribute('data-project'), b);
  });

  /* ---------------------------------------------------------------- услуги, этапы, команда, отзывы, FAQ */

  $('#servicesList').innerHTML = services.map(function (s, i) {
    return '<li class="srow" data-reveal><span class="srow__n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="srow__main"><h3>' + esc(s.name) + (s.optional ? ' <span class="srow__opt">по запросу</span>' : '') + '</h3><p>' + esc(s.text || '') + '</p></div>' +
      '<p class="srow__price">' + T.priceHtml(s.price, 1, s.demo) + '</p></li>';
  }).join('');
  T.section('services', services.length);

  var stages = T.list('stages');
  T.section('stages', stages.length);
  $('#stagesList').innerHTML = stages.map(function (s, i) {
    return '<li class="stage" data-reveal><span class="stage__n">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
  }).join('');

  var team = T.list('team');
  T.section('team', T.feature('team') && team.length);
  $('#teamGrid').innerHTML = team.map(function (m) {
    return '<li class="tcard" data-reveal>' + T.img(m.photo, { alt: m.name || m.role, phText: m.role }) +
      '<h3>' + esc(m.name || m.role) + '</h3>' + (m.name ? '<p class="tcard__role">' + esc(m.role) + '</p>' : '') +
      '<p>' + esc(m.area || '') + '</p>' + T.demoTag(m.demo, 'пример роли') + '</li>';
  }).join('');

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);

  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);

  /* ---------------------------------------------------------------- бриф */

  var form = $('#briefForm');
  $('#fFormats').innerHTML = formats.map(function (f, i) {
    return '<label class="choice"><input type="radio" name="format" value="' + esc(f.id) + '"' + (i === 0 ? ' required' : '') + '>' +
      '<span class="choice__img">' + T.img(f.image, { alt: '' }) + '</span><span class="choice__name">' + esc(f.name) + '</span></label>';
  }).join('');
  $('#fBudget').innerHTML = '<option value="">Выберите вариант</option>' +
    (pricing.budgets || []).map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') +
    '<option value="Бюджет обсуждается">Бюджет обсуждается</option>';
  $('#fGuests').max = pricing.maxGuests || 10000;
  $('#fServices').innerHTML = services.map(function (s) {
    return '<label class="check check--row"><input type="checkbox" name="services" value="' + esc(s.id) + '">' +
      '<span class="check__name">' + esc(s.name) + (s.optional ? ' <em>по запросу</em>' : '') + '</span><span class="check__price">' + esc(T.priceText(s.price)) + '</span></label>';
  }).join('');
  $('#fConsent').innerHTML = T.consentHtml('fConsentBox');
  T.minDate($('#fDate'));
  FB.files($('#fFile'), { max: 1, maxSize: 10 * 1024 * 1024, list: $('#fFileList') });

  // «Дата не выбрана» отключает поле даты (отключённые поля не проверяются)
  var noDate = $('#fNoDate'), dateIn = $('#fDate');
  noDate.addEventListener('change', function () {
    dateIn.disabled = noDate.checked;
    if (noDate.checked) { dateIn.value = ''; FB.setError(dateIn, ''); }
  });

  var wiz = T.wizard(form, { progress: $('#briefSteps') });

  // выбор формата с любой кнопки страницы
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick-format]');
    if (a) {
      var r = form.querySelector('input[name=format][value="' + a.getAttribute('data-pick-format') + '"]');
      if (r) { r.checked = true; FB.setError(r, ''); renderEstimate(); }
      if ($('#briefResult').hidden === false) { $('#briefResult').hidden = true; form.hidden = false; }
      wiz.go(0, false);
    }
    var s = e.target.closest('[data-show-format]');
    if (s) { setFilter(s.getAttribute('data-show-format')); FB.scrollTo('#projects'); }
  });

  /* ---------------------------------------------------------------- смета */

  function state() {
    var fd = new FormData(form);
    return {
      format: fd.get('format'),
      guests: Math.max(0, Math.floor(Number(fd.get('guests')) || 0)),
      services: fd.getAll('services')
    };
  }
  function estimate() {
    var s = state();
    if (pricing.mode !== 'estimate' || !T.feature('estimate')) return null;
    var fp = pricing.formats && pricing.formats[s.format];
    var items = [], lines = [];
    if (fp) {
      items.push({ price: fp.price });
      lines.push(['Организация: ' + (fmtById(s.format) || {}).name, T.priceText(fp.price)]);
      if (fp.perGuest > 0 && s.guests > 0) {
        items.push({ price: { type: 'fixed', value: fp.perGuest }, qty: s.guests });
        lines.push(['Работа с гостями: ' + s.guests + ' × ' + FB.money(fp.perGuest), FB.money(fp.perGuest * s.guests)]);
      }
    }
    s.services.forEach(function (id) {
      var sv = T.byId(services, id);
      if (!sv) return;
      items.push({ price: sv.price });
      lines.push([sv.name, T.priceText(sv.price)]);
    });
    return { sum: T.sum(items), lines: lines, s: s };
  }
  function renderEstimate() {
    var box = $('#estBody'), e = estimate();
    if (!e) {
      box.innerHTML = '<p>Смету подготовим после обсуждения брифа: она зависит от площадки, программы и подрядчиков.</p><a class="btn btn--accent btn--sm" href="#brief">Запросить смету</a>';
      return;
    }
    if (!e.s.format) { box.innerHTML = '<p class="est__empty">Выберите формат — покажем ориентир по стоимости услуг агентства.</p>'; return; }
    box.innerHTML = '<ul class="est__lines" role="list">' + e.lines.map(function (l) { return '<li><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></li>'; }).join('') + '</ul>' +
      '<p class="est__total"><span>Итого</span><b>' + esc(e.sum.text) + '</b></p>' + T.demoTag(pricing.demo, 'демо-тарифы') +
      '<p class="est__note">' + esc(pricing.note || '') + '</p>';
  }
  form.addEventListener('change', renderEstimate);
  form.addEventListener('input', FB.debounce(renderEstimate, 150));
  form.addEventListener('fb:reset', function () { dateIn.disabled = false; renderEstimate(); });
  renderEstimate();

  T.leadForm(form, {
    type: 'event_brief',
    result: $('#briefResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Бриф принят для обсуждения',
    successText: (C.booking && C.booking.successText) || '',
    collect: function (fd) {
      var e = estimate(), f = fmtById(fd.get('format'));
      var chosen = fd.getAll('services').map(function (id) { var s = T.byId(services, id); return s ? s.name : id; });
      return {
        format: f ? f.name : fd.get('format'),
        date: noDate.checked ? '' : fd.get('date'),
        city: fd.get('city'),
        guests: fd.get('guests'),
        services: chosen.join(', '),
        company: fd.get('company') || '',
        total: e && e.s.format ? e.sum.text : '',
        consent: fd.get('consent') === 'да',
        details: {
          'Дата': noDate.checked ? 'Дата не выбрана' : fd.get('date'),
          'Бюджет': fd.get('budget'),
          'Площадка': fd.get('venue') || '—',
          'Код формата': fd.get('format'),
          'Коды услуг': fd.getAll('services').join(', ') || '—',
          'Смета': e && e.s.format ? 'предварительная, из тарифов на сайте' : 'не рассчитывалась'
        },
        // коды полей формы, дублирующие details, не отправляем
        dateUnknown: undefined, budget: undefined, venue: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Формат</dt><dd>' + esc(p.format) + '</dd><dt>Дата</dt><dd>' + esc(p.date ? FB.fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' }) : 'не выбрана') + '</dd>' +
        '<dt>Гостей</dt><dd>' + esc(p.guests) + '</dd>' + (p.total ? '<dt>Ориентир</dt><dd>' + esc(p.total) + '</dd>' : '') + '</dl>';
    }
  });

  T.mobileCta((cta.label || 'Обсудить мероприятие'), 'brief');
});
