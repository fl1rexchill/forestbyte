/* Автосервис (адаптация sites/niches/auto): выбор автомобиля → каталог работ с поиском →
   предварительный расчёт (работа и запчасти раздельно) → заявка: авто → работы или проблема → желаемое время → контакт.
   Нет личного кабинета и статуса ремонта: у шаблона нет рабочего источника этих данных. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), works = T.list('services');
  var classes = C.carClasses || {}, brands = C.carBrands || {}, pricing = C.pricing || {};
  var OTHER = 'Другая марка';

  /* ---------------------------------------------------------------- состояние: авто и выбранные работы */

  var car = FB.store.get('car', { brand: '', model: '', year: '' });
  var cart = FB.store.get('cart', {});   // id работы → id варианта ('' если вариантов нет)
  Object.keys(cart).forEach(function (id) { if (!T.byId(works, id)) delete cart[id]; });

  function cls() { var c = brands[car.brand]; return c && classes[c] ? classes[c] : null; }
  function coefFor(w) { var c = cls(); return w.noCoef ? 1 : c ? c.coef || 1 : 1; }
  function laborOf(w, variantId) {
    if (w.variants && w.variants.length) { var v = T.byId(w.variants, variantId) || w.variants[0]; return v.labor; }
    return w.labor;
  }
  // марка не выбрана или её нет в списке — цена работы «от» по базовому классу
  function laborText(w, variantId) {
    var p = laborOf(w, variantId), t = T.priceText(p, coefFor(w));
    return !cls() && p && p.type === 'fixed' ? 'от ' + t : t;
  }

  /* ---------------------------------------------------------------- первый экран и выбор авто */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Оставить заявку';
  $('#heroCta').href = '#' + (cta.target || 'request');
  $('#heroMedia').innerHTML = T.img(C.hero && C.hero.image, { eager: true });

  var brandOpts = '<option value="">Выберите марку</option>' + Object.keys(brands).sort().map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '<option>' + OTHER + '</option>';
  var y = new Date().getFullYear(), yearOpts = '<option value="">Год</option>';
  for (var i = y; i >= 1995; i--) yearOpts += '<option>' + i + '</option>';
  $('#pBrand').innerHTML = $('#rBrand').innerHTML = brandOpts;
  $('#pYear').innerHTML = $('#rYear').innerHTML = yearOpts;

  function syncCar(from) {
    if (from === 'pick') car = { brand: $('#pBrand').value, model: $('#pModel').value.trim(), year: $('#pYear').value };
    if (from === 'form') car = { brand: $('#rBrand').value, model: $('#rModel').value.trim(), year: $('#rYear').value };
    $('#pBrand').value = $('#rBrand').value = car.brand;
    $('#pModel').value = $('#rModel').value = car.model;
    $('#pYear').value = $('#rYear').value = car.year;
    var c = cls();
    $('#pClass').innerHTML = c ? 'Класс: <b>' + esc(c.name) + '</b>' + (c.coef !== 1 ? ' · работы ×' + String(c.coef).replace('.', ',') : ' · базовые цены работ')
      : car.brand === OTHER ? 'Марки нет в списке — покажем цены «от», точную стоимость назовёт мастер' : 'Выберите марку — уточним стоимость работ';
    FB.store.set('car', car);
    renderCatalog();
    renderEstimate();
  }
  ['#pBrand', '#pModel', '#pYear'].forEach(function (s) { $(s).addEventListener('change', function () { syncCar('pick'); }); });
  ['#rBrand', '#rModel', '#rYear'].forEach(function (s) { $(s).addEventListener('change', function () { syncCar('form'); }); });

  /* ---------------------------------------------------------------- каталог */

  var curCat = cats.length ? cats[0].id : '';
  var query = '';
  $('#catTabs').innerHTML = cats.map(function (c, i) {
    return '<button type="button" role="tab" id="tab-' + esc(c.id) + '" aria-controls="catPanel" aria-selected="' + (i === 0) + '">' + esc(c.name) + '</button>';
  }).join('');
  FB.tabs($('#catTabs'), function (t) { curCat = t.id.slice(4); renderCatalog(); });

  function priceOrDash(p) { return p ? esc(T.priceText(p)) : '—'; }
  function renderCatalog() {
    var q = query.toLowerCase();
    var list = q ? works.filter(function (w) { return w.name.toLowerCase().indexOf(q) > -1; }) : works.filter(function (w) { return w.cat === curCat; });
    $('#catTabs').classList.toggle('is-muted', !!q);
    var head = q ? '<p class="found">' + (list.length ? 'Найдено: ' + list.length : 'Ничего не нашли по запросу «' + esc(query) + '». Попробуйте другое слово или отметьте «Не знаю, какая услуга нужна».') + '</p>' : '';
    var img = !q && C.categoryImages && C.categoryImages[curCat] ? '<div class="cat-img">' + T.img(C.categoryImages[curCat], { alt: '' }) + '</div>' : '';
    $('#catPanel').innerHTML = head + img + (list.length ? '<div class="wrow wrow--head" aria-hidden="true"><span>Работа</span><span>Время</span><span>Работа, ₽</span><span>Запчасти, ₽</span><span></span></div>' : '') + list.map(function (w) {
      var on = cart[w.id] !== undefined, variant = cart[w.id] || (w.variants ? w.variants[0].id : '');
      var cat = T.byId(cats, w.cat);
      return '<div class="wrow' + (on ? ' is-on' : '') + '" data-work="' + esc(w.id) + '">' +
        '<div class="wrow__name">' + (q && cat ? '<span class="wrow__cat">' + esc(cat.name) + '</span>' : '') + esc(w.name) + T.demoTag(w.demo, 'демо-цена') +
        (w.variants ? '<label class="wrow__variant"><span class="sr-only">Вариант для «' + esc(w.name) + '»</span><select data-variant="' + esc(w.id) + '">' + w.variants.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === variant ? ' selected' : '') + '>' + esc(v.name) + '</option>'; }).join('') + '</select></label>' : '') +
        (w.partsNote ? '<span class="wrow__note">' + esc(w.partsNote) + '</span>' : '') + '</div>' +
        '<span class="wrow__time"><span class="sr-only">Время: </span>' + esc(T.duration(w.duration)) + '</span>' +
        '<span class="wrow__labor"><span class="m-label">Работа: </span>' + esc(laborText(w, variant)) + '</span>' +
        '<span class="wrow__parts"><span class="m-label">Запчасти: </span>' + (w.parts === null || w.parts === undefined ? 'не нужны' : priceOrDash(w.parts)) + '</span>' +
        '<button class="btn btn--sm ' + (on ? 'btn--dark' : 'btn--line-dark') + '" type="button" data-toggle="' + esc(w.id) + '" aria-pressed="' + on + '">' + (on ? 'В расчёте ✓' : 'Добавить') + '</button></div>';
    }).join('');
  }
  $('#svcSearch').addEventListener('input', FB.debounce(function (e) { query = e.target.value.trim(); renderCatalog(); }, 120));
  $('#catPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-toggle]');
    if (!b) return;
    var id = b.getAttribute('data-toggle'), w = T.byId(works, id);
    if (cart[id] !== undefined) delete cart[id];
    else cart[id] = w.variants ? ($('select[data-variant="' + id + '"]') || {}).value || w.variants[0].id : '';
    FB.store.set('cart', cart);
    renderCatalog(); renderEstimate(); renderFormWorks();
    var again = $('[data-toggle="' + id + '"]');
    if (again) again.focus();
  });
  $('#catPanel').addEventListener('change', function (e) {
    var s = e.target.closest('[data-variant]');
    if (!s) return;
    var id = s.getAttribute('data-variant');
    if (cart[id] !== undefined) { cart[id] = s.value; FB.store.set('cart', cart); }
    var row = s.closest('.wrow'), w = T.byId(works, id);
    row.querySelector('.wrow__labor').innerHTML = '<span class="m-label">Работа: </span>' + esc(laborText(w, s.value));
    renderEstimate(); renderFormWorks();
  });

  /* ---------------------------------------------------------------- «Не знаю, какая услуга нужна» */

  var unknownTop = $('#unknownToggle'), unknownForm = $('#rUnknown'), problemBox = $('#rProblemBox');
  function setUnknown(on) {
    unknownTop.checked = unknownForm.checked = on;
    problemBox.hidden = !on;
    $('#unknownCard').classList.toggle('is-on', on);
    renderEstimate();
  }
  unknownTop.addEventListener('change', function () {
    setUnknown(unknownTop.checked);
    if (unknownTop.checked) { wiz.go(1, false); FB.scrollTo('#request'); setTimeout(function () { $('#rProblem').focus(); }, 800); }
  });
  unknownForm.addEventListener('change', function () { setUnknown(unknownForm.checked); });

  /* ---------------------------------------------------------------- расчёт: работа и запчасти отдельно */

  function selection() {
    return Object.keys(cart).map(function (id) {
      var w = T.byId(works, id), v = w.variants ? T.byId(w.variants, cart[id]) || w.variants[0] : null;
      return { w: w, variant: v, labor: laborOf(w, v && v.id), coef: coefFor(w) };
    });
  }
  function estimate() {
    var sel = selection();
    var labor = T.sum(sel.map(function (s) { return { price: s.labor, coef: s.coef }; }));
    if (!cls() && sel.length) { labor.open = true; labor.text = T.sumText(labor); } // без класса — «от»
    var partsSel = sel.filter(function (s) { return s.w.parts; });
    var parts = T.sum(partsSel.map(function (s) { return { price: s.w.parts }; }));
    var total = T.sum(sel.map(function (s) { return { price: s.labor, coef: s.coef }; }).concat(partsSel.map(function (s) { return { price: s.w.parts }; })));
    if (!cls() && sel.length) { total.open = true; total.text = T.sumText(total); }
    var minutes = sel.reduce(function (a, s) { return a + (s.w.duration || 0); }, 0);
    return { sel: sel, labor: labor, parts: parts, partsCount: partsSel.length, total: total, minutes: minutes };
  }
  function renderEstimate() {
    var e = estimate(), box = $('#estBody');
    if (!e.sel.length) {
      box.innerHTML = unknownTop.checked
        ? '<p>Вы выбрали «Не знаю, какая услуга нужна». Опишите проблему в заявке — мастер предложит диагностику и назовёт цену.</p>'
        : '<p class="est__empty">Добавьте работы из каталога — здесь появится состав расчёта.</p>';
      return;
    }
    box.innerHTML = '<ul class="est__lines" role="list">' + e.sel.map(function (s) {
      return '<li><span>' + esc(s.w.name) + (s.variant ? ', ' + esc(s.variant.name) : '') + '</span><b>' + esc(laborText(s.w, s.variant && s.variant.id)) + '</b></li>';
    }).join('') + '</ul>' +
      '<dl class="est__sum"><div><dt>Работа</dt><dd>' + esc(e.labor.text) + '</dd></div>' +
      '<div><dt>Запчасти</dt><dd>' + (e.partsCount ? esc(e.parts.text) : 'не нужны') + '</dd></div>' +
      '<div class="est__total"><dt>Итого</dt><dd>' + esc(e.total.text) + '</dd></div>' +
      '<div><dt>Время работ</dt><dd>≈ ' + esc(T.duration(e.minutes)) + '</dd></div></dl>' +
      (cls() ? '<p class="est__class">Класс: ' + esc(cls().name) + '</p>' : '<p class="est__class">Класс автомобиля не определён — цены работ «от».</p>') +
      T.demoTag(pricing.demo, 'демо-цены') + '<p class="est__note">' + esc(pricing.note || '') + '</p>';
  }

  /* ---------------------------------------------------------------- этапы визита, условия, отзывы, FAQ */

  var visit = T.list('visit');
  T.section('visit', visit.length);
  $('#visitList').innerHTML = visit.map(function (v, i) { return '<li data-reveal><span class="visit__n">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(v.title) + '</h3><p>' + esc(v.text) + '</p></li>'; }).join('');

  var pol = C.policies || {};
  var terms = [['Дополнительные работы', pol.extraWork], ['Свои запчасти', pol.parts], ['Гарантия', pol.warranty]].filter(function (t) { return t[1]; });
  T.section('terms', terms.length);
  $('#termsList').innerHTML = terms.map(function (t) { return '<div><dt>' + esc(t[0]) + '</dt><dd>' + esc(t[1]) + T.demoTag(pol.demo, 'демо-текст') + '</dd></div>'; }).join('');

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);
  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);

  /* ---------------------------------------------------------------- заявка */

  var form = $('#reqForm');
  var parts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#rParts').innerHTML = parts.map(function (p, i) { return '<label class="radio"><input type="radio" name="part" value="' + esc(p) + '"' + (i === 0 ? ' required' : '') + '><span>' + esc(p) + '</span></label>'; }).join('');
  $('#rConsent').innerHTML = T.consentHtml('rConsentBox');
  T.minDate($('#rDate'));

  function renderFormWorks() {
    var sel = selection();
    $('#rWorks').innerHTML = sel.length
      ? '<ul class="fworks" role="list">' + sel.map(function (s) { return '<li><span>' + esc(s.w.name) + (s.variant ? ', ' + esc(s.variant.name) : '') + '</span><button type="button" class="linklike" data-remove="' + esc(s.w.id) + '">Убрать</button></li>'; }).join('') + '</ul>' +
        '<p class="fworks__sum">Предварительно: <b>' + esc(estimate().total.text) + '</b></p><p><a href="#catalog">Добавить работы в каталоге</a></p>'
      : '<p class="hint">Работы не выбраны. <a href="#catalog">Выберите в каталоге</a> или отметьте «Не знаю, какая услуга нужна».</p>';
  }
  $('#rWorks').addEventListener('click', function (e) {
    var r = e.target.closest('[data-remove]');
    if (!r) return;
    delete cart[r.getAttribute('data-remove')];
    FB.store.set('cart', cart);
    renderCatalog(); renderEstimate(); renderFormWorks();
  });

  var wiz = T.wizard(form, {
    progress: $('#reqSteps'),
    check: { 1: function () { return Object.keys(cart).length || unknownForm.checked ? true : 'Выберите работы в каталоге или отметьте «Не знаю, какая услуга нужна».'; } }
  });

  T.leadForm(form, {
    type: 'service_request',
    result: $('#reqResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Заявка принята',
    successText: (C.booking && C.booking.successText) || '',
    before: function () { return Object.keys(cart).length || unknownForm.checked ? true : 'Выберите работы или опишите проблему.'; },
    collect: function (fd) {
      var e = estimate();
      return {
        car: [fd.get('brand'), fd.get('model'), fd.get('year')].filter(Boolean).join(' '),
        service: e.sel.map(function (s) { return s.w.name + (s.variant ? ' (' + s.variant.name + ')' : ''); }).join('; ') || 'Диагностика по описанию проблемы',
        time: fd.get('part'),
        total: e.sel.length ? e.total.text : '',
        consent: fd.get('consent') === 'да',
        details: {
          'Проблема': unknownForm.checked ? fd.get('problem') : '—',
          'Работа (предварительно)': e.sel.length ? e.labor.text : '—',
          'Запчасти (предварительно)': e.partsCount ? e.parts.text : '—',
          'Класс авто': cls() ? cls().name : 'не определён',
          'Госномер/VIN': fd.get('plate') || '—',
          'Пробег': fd.get('mileage') || '—',
          'Коды работ': Object.keys(cart).map(function (id) { return id + (cart[id] ? ':' + cart[id] : ''); }).join(', ') || '—'
        },
        brand: undefined, model: undefined, year: undefined, part: undefined, unknown: undefined, problem: undefined, plate: undefined, mileage: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Автомобиль</dt><dd>' + esc(p.car) + '</dd><dt>Работы</dt><dd>' + esc(p.service) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(p.time) + '</dd>' + (p.total ? '<dt>Предварительно</dt><dd>' + esc(p.total) + '</dd>' : '') + '</dl>';
    },
    onSuccess: function () {
      cart = {}; FB.store.set('cart', cart);
      setUnknown(false);
      renderCatalog(); renderEstimate(); renderFormWorks();
    }
  });
  // core сбрасывает форму после успеха — возвращаем выбранный автомобиль в поля
  form.addEventListener('fb:reset', function () { syncCar(); });

  syncCar();
  renderFormWorks();
  T.mobileCta(cta.label || 'Оставить заявку', 'request');
});
