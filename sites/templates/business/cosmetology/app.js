/* Косметология (адаптация sites/niches/cosmetology): специалисты → каталог по категориям с карточкой услуги →
   оборудование, пространство, документы → запрос: услуга или консультация → специалист или «Помогите выбрать» →
   желаемое время → контакт. Медицинские тексты — только утверждённые (approved: true). Без анамнеза в форме. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), services = T.list('services'), team = T.list('team');
  var HELP = 'help';
  var UNAPPROVED = 'Показания, подготовку и ограничения уточняет специалист на консультации.';

  function specsFor(serviceId) { return team.filter(function (m) { return (m.services || []).indexOf(serviceId) > -1; }); }
  function specName(m) { return m.name || m.role; }

  /* ---------------------------------------------------------------- первый экран */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Записаться на консультацию';
  $('#heroCta').href = '#' + (cta.target || 'booking');
  $('#heroMedia').innerHTML = T.img(C.hero && C.hero.image, { eager: true });

  /* ---------------------------------------------------------------- специалисты */

  T.section('specialists', T.feature('team') && team.length);
  $('#specGrid').innerHTML = team.map(function (m) {
    var svc = (m.services || []).map(function (id) { var s = T.byId(services, id); return s ? s.name : null; }).filter(Boolean);
    var cred = (m.credentials || []).filter(function (c) { return c && c.title; });
    return '<article class="spec" data-reveal>' +
      '<div class="spec__photo">' + T.img(m.photo, { alt: specName(m), phText: 'Фото специалиста' }) + '</div>' +
      '<div class="spec__body"><h3>' + esc(specName(m)) + '</h3>' + (m.name ? '<p class="spec__role">' + esc(m.role) + '</p>' : '') + T.demoTag(m.demo, 'пример: имя и фото не указаны') +
      '<h4>Ведёт услуги</h4><ul class="spec__svc" role="list">' + svc.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      (cred.length ? '<h4>Образование и квалификация</h4><ul class="spec__cred" role="list">' + cred.map(function (c) {
        return '<li>' + esc(c.title) + (c.issuer ? ', ' + esc(c.issuer) : '') + (c.year ? ', ' + esc(c.year) : '') + (c.number ? ' · № ' + esc(c.number) : '') + '</li>';
      }).join('') + '</ul>' : '') +
      '<button class="btn btn--line btn--sm" type="button" data-book-spec="' + esc(m.id) + '">Записаться к специалисту</button></div></article>';
  }).join('');

  /* ---------------------------------------------------------------- услуги */

  var curCat = 'all';
  T.section('services', services.length);
  $('#svcNote').textContent = (C.pricing && C.pricing.note) || '';
  var usedCats = cats.filter(function (c) { return services.some(function (s) { return s.cat === c.id; }); });
  $('#svcCats').innerHTML = [{ id: 'all', name: 'Все' }].concat(usedCats).map(function (c) {
    return '<button class="chip" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === 'all') + '">' + esc(c.name) + '</button>';
  }).join('');
  function renderServices() {
    var list = services.filter(function (s) { return curCat === 'all' || s.cat === curCat; });
    $('#svcGrid').innerHTML = list.map(function (s) {
      var cat = T.byId(cats, s.cat);
      return '<article class="svc">' +
        '<p class="svc__cat">' + esc(cat ? cat.name : '') + '</p><h3>' + esc(s.name) + '</h3><p class="svc__sum">' + esc(s.summary || '') + '</p>' +
        '<dl class="svc__meta"><div><dt>Длительность</dt><dd>' + esc(T.duration(s.duration) || 'уточняется') + '</dd></div><div><dt>Стоимость</dt><dd>' + T.priceHtml(s.price, 1, s.demo) + '</dd></div></dl>' +
        '<div class="svc__btns"><button class="btn btn--line btn--sm" type="button" data-svc-info="' + esc(s.id) + '">Подробнее</button>' +
        '<button class="btn btn--accent btn--sm" type="button" data-book-svc="' + esc(s.id) + '">Записаться</button></div></article>';
    }).join('');
  }
  $('#svcCats').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    curCat = b.getAttribute('data-cat');
    $$('#svcCats [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderServices();
  });
  renderServices();

  // карточка услуги: медицинские разделы — только если текст утверждён клиникой
  function openService(id, opener) {
    var s = T.byId(services, id);
    if (!s) return;
    var ok = s.approved === true;
    var sec = function (title, text) { return text ? '<h3>' + title + '</h3><p>' + esc(text) + '</p>' : ''; };
    var specs = specsFor(s.id);
    $('#smBody').innerHTML = '<p class="svc__cat">' + esc((T.byId(cats, s.cat) || {}).name || '') + '</p><h2 id="smTitle">' + esc(s.name) + '</h2>' +
      '<p class="sm__sum">' + esc(s.summary || '') + '</p>' +
      '<dl class="svc__meta"><div><dt>Длительность</dt><dd>' + esc(T.duration(s.duration) || 'уточняется') + '</dd></div><div><dt>Стоимость</dt><dd>' + T.priceHtml(s.price, 1, s.demo) + '</dd></div></dl>' +
      (ok ? sec('Описание', s.description) + sec('Подготовка', s.preparation) + sec('Ограничения', s.limitations)
        : '<p class="sm__note">' + UNAPPROVED + '</p>') +
      (specs.length ? '<h3>Специалисты</h3><p>' + specs.map(function (m) { return esc(specName(m)); }).join(', ') + '</p>' : '') +
      '<button class="btn btn--accent" type="button" data-book-svc="' + esc(s.id) + '">Записаться</button>';
    FB.modal.open('svcModal', opener);
  }

  /* ---------------------------------------------------------------- оборудование, пространство, результаты, документы */

  var eq = T.list('equipment');
  T.section('equipment', T.feature('equipment') && eq.length);
  $('#eqList').innerHTML = eq.map(function (e) {
    return '<article class="eq" data-reveal><div class="eq__img">' + T.img(e.image) + '</div><div><h3>' + esc(e.name) + '</h3><p>' + esc(e.text || '') + '</p>' + T.demoTag(e.demo, 'укажите модель') + '</div></article>';
  }).join('');

  var space = T.list('space').filter(function (id) { return T.asset(id); });
  T.section('space', T.feature('space') && space.length);
  $('#spaceGrid').innerHTML = space.map(function (id, i) { return '<figure class="sp sp--' + (i % 3) + '" data-reveal>' + T.img(id) + '</figure>'; }).join('');

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
  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);

  /* ---------------------------------------------------------------- запрос консультации */

  var form = $('#bookForm');
  $('#bService').innerHTML = '<option value="">Выберите услугу</option>' + usedCats.map(function (c) {
    return '<optgroup label="' + esc(c.name) + '">' + services.filter(function (s) { return s.cat === c.id; }).map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
    }).join('') + '</optgroup>';
  }).join('');
  var parts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#bParts').innerHTML = parts.map(function (p, i) { return '<label class="choice choice--sm"><input type="radio" name="part" value="' + esc(p) + '"' + (i === 0 ? ' required' : '') + '><span>' + esc(p) + '</span></label>'; }).join('');
  $('#bConsent').innerHTML = T.consentHtml('bConsentBox');
  T.minDate($('#bDate'));

  var wantedSpec = '';
  function renderSpecs() {
    var sid = $('#bService').value, list = sid ? specsFor(sid) : [];
    // приоритет: специалист из кнопки «Записаться к специалисту», затем текущий выбор; не ведёт услугу — «Помогите выбрать»
    var want = wantedSpec || (form.querySelector('input[name=spec]:checked') || {}).value || HELP;
    var prev = list.some(function (m) { return m.id === want; }) ? want : HELP;
    wantedSpec = '';
    $('#bSpecs').innerHTML = '<label class="choice"><input type="radio" name="spec" value="' + HELP + '" required' + (prev === HELP ? ' checked' : '') + '><span><b>Помогите выбрать</b><span>Администратор подберёт специалиста под услугу</span></span></label>' +
      list.map(function (m) {
        return '<label class="choice"><input type="radio" name="spec" value="' + esc(m.id) + '"' + (prev === m.id ? ' checked' : '') + '><span><b>' + esc(specName(m)) + '</b><span>' + esc(m.name ? m.role : 'ведёт эту услугу') + '</span></span></label>';
      }).join('');
    var s = T.byId(services, sid);
    $('#bServiceInfo').innerHTML = s ? esc(T.duration(s.duration)) + ' · ' + esc(T.priceText(s.price)) + (s.approved ? '' : ' · ' + esc(UNAPPROVED)) : '';
  }
  $('#bService').addEventListener('change', renderSpecs);
  renderSpecs();

  T.wizard(form, { progress: $('#bookSteps') });

  function pick(serviceId, specId) {
    if (serviceId) $('#bService').value = serviceId;
    wantedSpec = specId || '';
    // специалист без выбранной услуги — подставляем консультацию или первую его услугу
    if (!serviceId && specId) {
      var m = T.byId(team, specId), first = (m.services || []);
      $('#bService').value = first.indexOf('consult') > -1 ? 'consult' : first[0] || '';
    }
    renderSpecs();
    if (!$('#bookResult').hidden) { $('#bookResult').hidden = true; form.hidden = false; }
    if (FB.modal.current()) FB.modal.close(true);
    FB.scrollTo('#booking');
  }
  document.addEventListener('click', function (e) {
    var info = e.target.closest('[data-svc-info]'), bs = e.target.closest('[data-book-svc]'), sp = e.target.closest('[data-book-spec]');
    if (info) openService(info.getAttribute('data-svc-info'), info);
    if (bs) pick(bs.getAttribute('data-book-svc'));
    if (sp) pick('', sp.getAttribute('data-book-spec'));
  });

  T.leadForm(form, {
    type: 'consult_request',
    result: $('#bookResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Запрос принят',
    successText: (C.booking && C.booking.successText) || '',
    collect: function (fd) {
      var s = T.byId(services, fd.get('serviceId')), specId = fd.get('spec'), m = T.byId(team, specId);
      return {
        service: s ? s.name : '',
        resource: specId === HELP ? 'Помочь выбрать' : m ? specName(m) : '',
        time: fd.get('part'),
        total: s ? T.priceText(s.price) : '',
        consent: fd.get('consent') === 'да',
        details: { 'Код услуги': fd.get('serviceId'), 'Код специалиста': specId, 'Запись': 'требует подтверждения' },
        serviceId: undefined, spec: undefined, part: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Услуга</dt><dd>' + esc(p.service) + '</dd><dt>Специалист</dt><dd>' + esc(p.resource) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(p.time) + '</dd></dl>';
    }
  });
  form.addEventListener('fb:reset', function () { renderSpecs(); });

  T.mobileCta(cta.label || 'Записаться на консультацию', 'booking');
});
