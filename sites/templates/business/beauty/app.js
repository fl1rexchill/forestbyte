/* Салон красоты (адаптация sites/niches/beauty): категории → услуги в визит (сумма цены и длительности,
   совместимость) → мастера по квалификации → портфолио с фильтром → цены →
   запись: услуги → мастер → желаемое время → контакт. Расписания нет: свободные окна не показываем. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), team = T.list('team'), works = T.list('portfolio');
  // показываем только услуги категорий из конфигурации
  var services = T.list('services').filter(function (s) { return T.byId(cats, s.cat); });
  var exclusive = ((C.compatibility || {}).exclusive || []);
  var ANY = 'any';
  var CONSULT = services.filter(function (s) { return s.id === 'color-consult'; })[0] || null;

  var visit = FB.store.get('visit', []).filter(function (id) { return T.byId(services, id); });
  function save() { FB.store.set('visit', visit); }
  function svc(id) { return T.byId(services, id); }
  function masterName(m) { return m.name || m.role; }
  function mastersFor(ids) { return team.filter(function (m) { return ids.every(function (id) { return (m.services || []).indexOf(id) > -1; }); }); }

  /* ---------------------------------------------------------------- первый экран */

  var h = C.hero || {}, cta = h.cta || {};
  var title = esc(h.title || '');
  if (h.accent && title.indexOf(esc(h.accent)) > -1) title = title.replace(esc(h.accent), '<em>' + esc(h.accent) + '</em>');
  $('#heroTitle').innerHTML = title;
  $('#heroTitle').setAttribute('data-split', '');
  $('#heroCta').textContent = cta.label || 'Выбрать услуги';
  $('#heroCta').href = '#' + (cta.target || 'services');
  $('#heroCollage').innerHTML = '<figure class="col col--main">' + T.img(h.image, { eager: true }) + '</figure>' +
    (h.collage || []).slice(0, 2).map(function (id, i) { return '<figure class="col col--' + (i + 1) + '" data-reveal="scale">' + T.img(id, { alt: '' }) + '</figure>'; }).join('');

  /* ---------------------------------------------------------------- визит: сумма, длительность, совместимость */

  function conflictWith(id) {
    for (var i = 0; i < exclusive.length; i++) {
      var r = exclusive[i];
      if (r[0] === id && visit.indexOf(r[1]) > -1) return r[2] || 'Эти услуги нельзя совместить в одном визите.';
      if (r[1] === id && visit.indexOf(r[0]) > -1) return r[2] || 'Эти услуги нельзя совместить в одном визите.';
    }
    return '';
  }
  function totals() {
    var list = visit.map(svc).filter(Boolean);
    return {
      list: list,
      sum: T.sum(list.map(function (s) { return { price: s.price }; })),
      min: list.reduce(function (a, s) { return a + T.durMin(s.duration); }, 0),
      max: list.reduce(function (a, s) { return a + T.durMax(s.duration); }, 0),
      consult: list.filter(function (s) { return s.consultFirst; })
    };
  }
  function durText(t) { return t.min === t.max ? T.duration(t.min) : T.duration({ min: t.min, max: t.max }); }
  function toggle(id) {
    var i = visit.indexOf(id);
    if (i > -1) visit.splice(i, 1);
    else {
      var c = conflictWith(id);
      if (c) { FB.toast(c, 'error'); var m = $('#svcMsg'); if (m) m.textContent = c; return; }
      visit.push(id);
    }
    save();
    renderAll();
  }

  /* ---------------------------------------------------------------- услуги по категориям */

  var curCat = cats.length ? cats[0].id : '';
  var usedCats = cats.filter(function (c) { return services.some(function (s) { return s.cat === c.id; }); });
  T.section('services', services.length);
  $('#catTabs').innerHTML = usedCats.map(function (c, i) {
    return '<button type="button" role="tab" id="tab-' + esc(c.id) + '" aria-controls="catPanel" aria-selected="' + (i === 0) + '">' + esc(c.name) + '</button>';
  }).join('');
  FB.tabs($('#catTabs'), function (t) { curCat = t.id.slice(4); renderServices(); });

  function renderServices() {
    var list = services.filter(function (s) { return s.cat === curCat; });
    $('#catPanel').innerHTML = '<p class="svc-msg" id="svcMsg" role="status" aria-live="polite"></p><ul class="svc-list" role="list">' + list.map(function (s) {
      var on = visit.indexOf(s.id) > -1;
      return '<li class="svc' + (on ? ' is-on' : '') + '"><div class="svc__main"><h3>' + esc(s.name) + '</h3>' +
        '<p class="svc__comp">' + esc((s.composition || []).join(' · ')) + '</p>' +
        (s.consultFirst ? '<p class="svc__consult">Перед этой услугой предлагаем консультацию колориста.</p>' : '') + '</div>' +
        '<p class="svc__dur">' + esc(T.duration(s.duration)) + '</p><p class="svc__price">' + T.priceHtml(s.price, 1, s.demo) + '</p>' +
        '<button class="btn btn--sm ' + (on ? 'btn--accent' : 'btn--line') + '" type="button" data-add="' + esc(s.id) + '" aria-pressed="' + on + '">' + (on ? 'В визите ✓' : 'Добавить') + '</button></li>';
    }).join('') + '</ul>';
  }
  $('#catPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    var id = b.getAttribute('data-add');
    toggle(id);
    var again = $('[data-add="' + id + '"]');
    if (again) again.focus();
  });

  /* ---------------------------------------------------------------- мастера */

  T.section('masters', T.feature('team') && team.length);
  $('#mastersGrid').innerHTML = team.map(function (m) {
    var list = (m.services || []).map(svc).filter(Boolean);
    return '<article class="master" data-reveal><div class="master__photo">' + T.img(m.photo, { alt: masterName(m), phText: 'Фото мастера' }) + '</div>' +
      '<h3>' + esc(masterName(m)) + '</h3>' + (m.name ? '<p class="master__role">' + esc(m.role) + '</p>' : '') + T.demoTag(m.demo, 'пример роли') +
      '<ul class="master__svc" role="list">' + list.map(function (s) { return '<li>' + esc(s.name) + '</li>'; }).join('') + '</ul>' +
      '<button class="btn btn--line btn--sm" type="button" data-work-master="' + esc(m.id) + '">Работы мастера</button></article>';
  }).join('');

  /* ---------------------------------------------------------------- портфолио: фильтр по услуге и мастеру */

  T.section('works', T.feature('portfolio') && works.length);
  $('#worksDemo').hidden = !(T.demo && works.some(function (w) { return w.demo; }));
  var wCats = usedCats.filter(function (c) { return works.some(function (w) { var s = svc(w.service); return s && s.cat === c.id; }); });
  var wMasters = team.filter(function (m) { return works.some(function (w) { return w.master === m.id; }); });
  $('#wfService').innerHTML = '<option value="">Все услуги</option>' + wCats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
  $('#wfMaster').innerHTML = '<option value="">Все мастера</option>' + wMasters.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(masterName(m)) + '</option>'; }).join('');
  function renderWorks() {
    var c = $('#wfService').value, m = $('#wfMaster').value;
    var list = works.filter(function (w) { var s = svc(w.service); return (!c || (s && s.cat === c)) && (!m || w.master === m); });
    $('#worksGrid').innerHTML = list.map(function (w, i) {
      var s = svc(w.service), mm = T.byId(team, w.master);
      return '<figure class="work work--' + (i % 4) + '">' + T.img(w.image) + '<figcaption><b>' + esc(w.title) + '</b>' +
        '<span>' + esc([s && s.name, mm && masterName(mm)].filter(Boolean).join(' · ')) + '</span>' + T.demoTag(w.demo, 'демо') + '</figcaption></figure>';
    }).join('') || '<p class="empty">По этому фильтру работ пока нет.</p>';
    if (FB.anime && !FB.reduced) FB.anime.animate($$('#worksGrid .work'), { opacity: [0, 1], translateY: [16, 0], delay: FB.anime.stagger(50), duration: 480, ease: 'outCubic' });
  }
  $('#wfService').addEventListener('change', renderWorks);
  $('#wfMaster').addEventListener('change', renderWorks);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-work-master]');
    if (!b) return;
    $('#wfMaster').value = b.getAttribute('data-work-master');
    $('#wfService').value = '';
    renderWorks();
    FB.scrollTo('#works');
  });
  renderWorks();

  /* ---------------------------------------------------------------- цены */

  $('#pricesNote').textContent = (C.pricing && C.pricing.note) || '';
  $('#pricesGrid').innerHTML = usedCats.map(function (c) {
    return '<div class="pcat"><h3>' + esc(c.name) + '</h3><dl>' + services.filter(function (s) { return s.cat === c.id; }).map(function (s) {
      return '<div><dt>' + esc(s.name) + ' <span>' + esc(T.duration(s.duration)) + '</span></dt><dd>' + T.priceHtml(s.price, 1, s.demo) + '</dd></div>';
    }).join('') + '</dl></div>';
  }).join('');

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);
  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);

  /* ---------------------------------------------------------------- панель визита */

  function renderBar() {
    var t = totals(), bar = $('#visitBar');
    bar.hidden = !t.list.length;
    document.documentElement.classList.toggle('has-visit', !!t.list.length);
    $('#visitSum').innerHTML = t.list.length ? '<b>' + t.list.length + ' ' + FB.plural(t.list.length, ['услуга', 'услуги', 'услуг']) + '</b> · ' + esc(t.sum.text) + ' · ' + esc(durText(t)) : '';
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { $('#visitBar').classList.toggle('is-away', en[0].isIntersecting); }, { threshold: 0.05 }).observe($('#booking'));
  }

  /* ---------------------------------------------------------------- запись */

  var form = $('#bookForm');
  var parts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#bParts').innerHTML = parts.map(function (p, i) { return '<label class="choice choice--sm"><input type="radio" name="part" value="' + esc(p) + '"' + (i === 0 ? ' required' : '') + '><span>' + esc(p) + '</span></label>'; }).join('');
  $('#bConsent').innerHTML = T.consentHtml('bConsentBox');
  T.minDate($('#bDate'));

  function renderVisitStep() {
    var t = totals();
    $('#bVisit').innerHTML = t.list.length
      ? '<ul class="vlist" role="list">' + t.list.map(function (s) {
          return '<li><span><b>' + esc(s.name) + '</b><small>' + esc(T.duration(s.duration)) + ' · ' + esc(T.priceText(s.price)) + '</small></span><button type="button" class="linklike" data-remove="' + esc(s.id) + '">Убрать</button></li>';
        }).join('') + '</ul>' +
        '<p class="vtotal"><span>Итого</span><b>' + esc(t.sum.text) + '</b><span>' + esc(durText(t)) + '</span></p>' +
        (t.consult.length && CONSULT && visit.indexOf(CONSULT.id) < 0 ? '<div class="consult-hint"><p>Для услуги «' + esc(t.consult[0].name) + '» предлагаем начать с консультации: мастер оценит волосы и назовёт стоимость.</p><button class="btn btn--line btn--sm" type="button" data-add-consult>Добавить консультацию</button></div>' : '') +
        T.demoTag((C.pricing || {}).demo, 'демо-цены') + '<p class="hint">' + esc((C.pricing || {}).note || '') + '</p>'
      : '<p class="hint">Услуги не выбраны. <a href="#services">Выберите услуги</a> — они появятся здесь.</p>';
  }
  $('#bVisit').addEventListener('click', function (e) {
    var r = e.target.closest('[data-remove]');
    if (r) toggle(r.getAttribute('data-remove'));
    if (e.target.closest('[data-add-consult]') && CONSULT) toggle(CONSULT.id);
  });

  function renderMasters() {
    var prev = (form.querySelector('input[name=master]:checked') || {}).value;
    var list = mastersFor(visit);
    $('#bMasters').innerHTML = '<label class="choice"><input type="radio" name="master" value="' + ANY + '" required' + (!prev || prev === ANY ? ' checked' : '') + '><span><b>Любой подходящий мастер</b><span>Администратор подберёт мастера под выбранные услуги</span></span></label>' +
      list.map(function (m) { return '<label class="choice"><input type="radio" name="master" value="' + esc(m.id) + '"' + (prev === m.id ? ' checked' : '') + '><span><b>' + esc(masterName(m)) + '</b><span>' + esc(m.name ? m.role : 'выполняет все выбранные услуги') + '</span></span></label>'; }).join('') +
      (visit.length && !list.length ? '<p class="hint">Один мастер не выполняет все выбранные услуги. Администратор распределит их между мастерами.</p>' : '');
  }

  function renderAll() { renderServices(); renderBar(); renderVisitStep(); renderMasters(); }

  T.wizard(form, {
    progress: $('#bookSteps'),
    check: { 0: function () { return visit.length ? true : 'Добавьте хотя бы одну услугу.'; } },
    onStep: function (i) { if (i === 1) renderMasters(); }
  });

  T.leadForm(form, {
    type: 'visit_request',
    result: $('#bookResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Заявка на запись принята',
    successText: (C.booking && C.booking.successText) || '',
    before: function () {
      if (!visit.length) return 'Добавьте хотя бы одну услугу.';
      // квалификация: выбранный мастер должен выполнять все услуги визита
      var mid = (form.querySelector('input[name=master]:checked') || {}).value;
      if (mid && mid !== ANY && mastersFor(visit).map(function (m) { return m.id; }).indexOf(mid) < 0) return 'Выбранный мастер не выполняет все услуги визита. Выберите другого мастера.';
      return true;
    },
    collect: function (fd) {
      var t = totals(), mid = fd.get('master'), m = T.byId(team, mid);
      return {
        services: t.list.map(function (s) { return s.name; }).join('; '),
        master: mid === ANY ? 'Любой подходящий' : m ? masterName(m) : '',
        time: fd.get('part'),
        total: t.sum.text,
        consent: fd.get('consent') === 'да',
        details: { 'Длительность': durText(t), 'Коды услуг': visit.join(', '), 'Код мастера': mid, 'Запись': 'требует подтверждения' },
        part: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Услуги</dt><dd>' + esc(p.services) + '</dd><dt>Мастер</dt><dd>' + esc(p.master) + '</dd><dt>Итого</dt><dd>' + esc(p.total) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(p.time) + '</dd></dl>';
    },
    onSuccess: function () { visit = []; save(); }
  });
  form.addEventListener('fb:reset', renderAll);

  renderAll();
});
