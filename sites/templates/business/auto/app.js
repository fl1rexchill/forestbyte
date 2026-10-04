/* Автосервис: машина клиента (марка, год, госномер) и схема узлов → прейскурант с кодами работ →
   заказ-наряд (черновик, работа и запчасти раздельно) → путь машины → история обслуживания по пробегу →
   «Без мелкого шрифта» (условия и вопросы) → заявка в 2 шага: время и контакт.
   Нет личного кабинета и статуса ремонта: у шаблона нет рабочего источника этих данных.
   Анимации — CSS и Web Animations API; anime.js и Lenis на этой странице не подключаются. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), works = T.list('services');
  var classes = C.carClasses || {}, brands = C.carBrands || {}, pricing = C.pricing || {};
  var OTHER = 'Другая марка';
  var canAnimate = !FB.reduced && typeof Element.prototype.animate === 'function';
  var EASE = 'cubic-bezier(.2,.8,.2,1)';

  /* ---------------------------------------------------------------- состояние: машина и выбранные работы */

  var car = Object.assign({ brand: '', model: '', year: '', plateNum: '', plateReg: '', vin: '', mileage: '' }, FB.store.get('car', {}));
  var cart = FB.store.get('cart', {});   // id работы → id варианта ('' если вариантов нет)
  Object.keys(cart).forEach(function (id) { if (!T.byId(works, id)) delete cart[id]; });
  function saveCar() { FB.store.set('car', car); }
  function saveCart() { FB.store.set('cart', cart); }

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

  // коды работ: префикс категории + номер внутри категории (ТО-01, ТР-03)
  var codeOf = {};
  cats.forEach(function (c) {
    var n = 0;
    works.filter(function (w) { return w.cat === c.id; }).forEach(function (w) { codeOf[w.id] = (c.code || c.id.toUpperCase()) + '-' + String(++n).padStart(2, '0'); });
  });

  /* ---------------------------------------------------------------- госномер: маска «А 000 АА» и регион */

  var PLATE_LETTERS = 'АВЕКМНОРСТУХ';
  var LAT = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
  function cleanPlate(v) {
    var out = '', slots = 'LDDDLL';
    String(v || '').toUpperCase().split('').forEach(function (ch) {
      if (out.length >= 6) return;
      ch = LAT[ch] || ch;
      var want = slots[out.length];
      if (want === 'L' && PLATE_LETTERS.indexOf(ch) > -1) out += ch;
      else if (want === 'D' && /\d/.test(ch)) out += ch;
    });
    return out;
  }
  function plateText(num, reg) {
    if (!num) return '';
    return [num.slice(0, 1), num.slice(1, 4), num.slice(4)].filter(Boolean).join(' ') + (reg ? ' ' + reg : '');
  }
  function plateHtml(num, reg, cls2) {
    return '<span class="plate plate--static' + (cls2 ? ' ' + cls2 : '') + '" aria-label="Госномер ' + esc(plateText(num, reg)) + '">' +
      '<span class="plate__num">' + esc(plateText(num, '')) + '</span>' +
      '<span class="plate__reg"><b>' + esc(reg || '—') + '</b><span class="plate__rus">RUS<i></i></span></span></span>';
  }

  /* ---------------------------------------------------------------- первый экран: машина клиента */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Выбрать работы';
  $('#heroCta').href = '#' + (cta.target || 'catalog');

  /* ---------------------------------------------------------------- свой выпадающий список (combobox)
     Поле ввода + список на сайте вместо системного: фильтр по мере ввода, стрелки, Enter, Esc, клик мимо.
     strict: true — значение только из списка (марка, год); иначе список — подсказка (модель). */
  var combos = [];
  function combo(input, o) {
    var field = input.closest('.cb'), list = document.createElement('ul'), items = [], active = -1, open = false;
    var committed = input.value;
    list.className = 'cb__list'; list.id = input.id + 'List'; list.setAttribute('role', 'listbox'); list.hidden = true;
    field.appendChild(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('autocomplete', 'off');
    input.spellcheck = false;
    function hl(label, q) {
      var i = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
      return i < 0 ? esc(label) : esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + q.length)) + '</mark>' + esc(label.slice(i + q.length));
    }
    function render(q) {
      var all = o.items(), ql = (q || '').toLowerCase();
      // сначала совпадения с начала слова, потом остальные
      // alias — другие написания (марка по-русски): ищем и по ним
      var words = function (it) { return (it.label + ' ' + (it.alias || '')).toLowerCase(); };
      var starts = function (it) { return words(it).split(/[\s-]+/).some(function (w) { return w.indexOf(ql) === 0; }); };
      items = ql ? all.filter(starts).concat(all.filter(function (it) { return !starts(it) && words(it).indexOf(ql) > -1; })) : all;
      if (active >= items.length) active = items.length - 1;
      list.innerHTML = items.length ? items.map(function (it, i) {
        var sel = it.value === committed;
        return '<li role="option" id="' + list.id + '-' + i + '" data-i="' + i + '" aria-selected="' + sel + '" class="' + (i === active ? 'is-active' : '') + (sel ? ' is-sel' : '') + '">' +
          '<span>' + hl(it.label, q) + '</span>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</li>';
      }).join('') : '<li class="cb__empty" role="presentation">' + esc(o.empty ? o.empty(q) : 'Ничего не нашли') + '</li>';
      if (active >= 0 && items[active]) { input.setAttribute('aria-activedescendant', list.id + '-' + active); var li = list.children[active]; if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    // typing: при вводе подсвечиваем первое совпадение, при открытии — текущее значение
    function show(q, typing) {
      combos.forEach(function (c) { if (c.input !== input) c.close(); });
      if (typing) active = q ? 0 : -1;
      else if (!open) active = Math.max(-1, o.items().map(function (it) { return it.value; }).indexOf(committed));
      render(q);
      list.hidden = false; open = true;
      input.setAttribute('aria-expanded', 'true'); field.classList.add('is-open');
    }
    function close() {
      if (!open) return;
      list.hidden = true; open = false; active = -1;
      input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); field.classList.remove('is-open');
    }
    function choose(it) {
      committed = it.value; input.value = it.label; close();
      FB.setError(input, '');
      o.onSelect(it.value);
    }
    // строгий список: вписанное значение принимаем, только если оно есть в списке, иначе возвращаем прежнее
    function settle() {
      if (!o.strict) return;
      var v = input.value.trim().toLowerCase();
      var hit = o.items().filter(function (it) { return it.label.toLowerCase() === v || (it.alias || '').split(' ').indexOf(v) > -1; })[0];
      if (hit) { if (hit.value !== committed) choose(hit); else input.value = hit.label; }
      else if (!v) { if (committed && o.allowEmpty !== false) { committed = ''; o.onSelect(''); } }
      else input.value = (o.items().filter(function (it) { return it.value === committed; })[0] || { label: '' }).label;
    }
    input.addEventListener('focus', function () { show(''); });
    input.addEventListener('click', function () { if (!open) show(''); });
    input.addEventListener('input', function () {
      if (o.sanitize) { var c2 = o.sanitize(input.value); if (c2 !== input.value) input.value = c2; }
      show(input.value.trim(), true);
      if (!o.strict) { committed = input.value.trim(); o.onSelect(committed); }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { show(''); return; }
        if (!items.length) return;
        active = e.key === 'ArrowDown' ? (active + 1) % items.length : (active - 1 + items.length) % items.length;
        render(input.value.trim() === (items[active] && items[active].label) ? '' : input.value.trim());
      } else if (e.key === 'Enter') {
        if (open && items[active]) { e.preventDefault(); e.stopPropagation(); choose(items[active]); }
        else if (open) { e.preventDefault(); e.stopPropagation(); settle(); close(); }
      } else if (e.key === 'Escape') {
        if (open) { e.preventDefault(); e.stopPropagation(); close(); }
      } else if (e.key === 'Tab') { if (open && items[active] && o.strict && input.value.trim()) choose(items[active]); else { settle(); close(); } }
    });
    // клик по варианту: mousedown не забирает фокус у поля
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) { var li = e.target.closest('[data-i]'); if (li) choose(items[+li.getAttribute('data-i')]); });
    field.querySelector('.cb__chev') && field.addEventListener('mousedown', function (e) {
      if (e.target.closest('.cb__chev')) { e.preventDefault(); if (open) close(); else { input.focus(); show(''); } }
    });
    input.addEventListener('blur', function () { settle(); close(); });
    // клик по пустому месту ячейки — фокус в поле
    field.addEventListener('click', function (e) { if (e.target === field) input.focus(); });
    var api = {
      input: input, close: close,
      set: function (value) { committed = value || ''; var it = o.items().filter(function (x) { return x.value === committed; })[0]; input.value = it ? it.label : committed; }
    };
    combos.push(api);
    return api;
  }

  var yNow = new Date().getFullYear(), years = [];
  for (var yy = yNow; yy >= 1995; yy--) years.push({ value: String(yy), label: String(yy) });
  var brandItems = function () {
    var al = C.carBrandAliases || {};
    return Object.keys(brands).sort().map(function (b) { var c = classes[brands[b]]; return { value: b, label: b, alias: al[b] || '', hint: c ? c.name : '' }; })
      .concat([{ value: OTHER, label: OTHER, hint: 'цены «от»' }]);
  };
  var models = C.carModels || {};
  function modelHint() { return car.brand && car.brand !== OTHER ? 'Выберите' : car.brand ? 'Впишите' : '—'; }
  function setBrand(v) {
    if (v === car.brand) return;
    // модель от прежней марки больше не подходит
    if (car.model && (models[car.brand] || []).indexOf(car.model) > -1) { car.model = ''; cbModel.set(''); }
    car.brand = v;
    cbBrand.set(v); cbFormBrand.set(v);
    $('#pModel').placeholder = modelHint();
    carChanged(true);
  }
  var cbBrand = combo($('#pBrand'), { strict: true, items: brandItems, onSelect: setBrand, empty: function () { return 'Такой марки нет — выберите «' + OTHER + '»'; } });
  var cbFormBrand = combo($('#rBrand'), { strict: true, items: brandItems, onSelect: setBrand, empty: function () { return 'Такой марки нет — выберите «' + OTHER + '»'; } });
  var cbModel = combo($('#pModel'), {
    strict: false,
    items: function () { return (models[car.brand] || []).map(function (m) { return { value: m, label: m }; }); },
    onSelect: function (v) { car.model = v; carChanged(false); },
    empty: function (q) { return !car.brand ? 'Сначала выберите марку' : q ? 'Нет в списке — оставим как вписали' : 'Впишите модель'; }
  });
  var cbYear = combo($('#pYear'), {
    strict: true, items: function () { return years; },
    sanitize: function (v) { return v.replace(/\D/g, '').slice(0, 4); },
    onSelect: function (v) { car.year = v; carChanged(false); },
    empty: function () { return 'Год от 1995 до ' + yNow; }
  });
  // клик мимо — закрыть открытый список
  document.addEventListener('pointerdown', function (e) { combos.forEach(function (c) { if (!c.input.closest('.cb').contains(e.target)) c.close(); }); });

  function fillCarFields() {
    cbBrand.set(car.brand); cbFormBrand.set(car.brand);
    cbModel.set(car.model);
    cbYear.set(car.year);
    $('#pModel').placeholder = modelHint();
    $('#pPlateNum').value = car.plateNum;
    $('#pPlateReg').value = car.plateReg;
    if (!$('#rPlate').dataset.touched) $('#rPlate').value = plateText(car.plateNum, car.plateReg);
    $('#rMileage').value = car.mileage;
    $('#rVin').value = car.vin;
  }
  function renderClass() {
    var c = cls();
    // строка в заголовке штампа — коротко
    $('#pClass').innerHTML = c ? 'класс <b>' + esc(c.name) + '</b>' + (c.coef !== 1 ? ' · работы ×' + String(c.coef).replace('.', ',') : ' · базовые цены')
      : car.brand === OTHER ? 'марки нет в списке — цены «от»' : 'марка уточнит цены работ';
  }
  // смена машины меняет цены в каталоге, наряд и сводку заявки
  function carChanged(full) {
    saveCar();
    renderClass();
    renderBody();
    if (full) renderCatalog();
    renderOrder(false);
    renderSummary();
  }
  $('#pPlateNum').addEventListener('input', function () {
    var v = cleanPlate(this.value);
    if (v !== this.value) this.value = v;
    car.plateNum = v;
    if (v.length === 6 && !car.plateReg) $('#pPlateReg').focus();
    if (!$('#rPlate').dataset.touched) $('#rPlate').value = plateText(car.plateNum, car.plateReg);
    carChanged(false);
  });
  $('#pPlateReg').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 3);
    if (v !== this.value) this.value = v;
    car.plateReg = v;
    if (!$('#rPlate').dataset.touched) $('#rPlate').value = plateText(car.plateNum, car.plateReg);
    carChanged(false);
  });
  // Backspace в пустом регионе возвращает к номеру
  $('#pPlateReg').addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !this.value) $('#pPlateNum').focus(); });

  /* ---------------------------------------------------------------- схема узлов */

  // Силуэты кузова в системе viewBox 0 0 640 320. Колёса и узлы у всех на одних местах (оси x 150 и 492),
  // меняются кузов, стёкла, стойки и мелкие детали. Тип кузова — из config.carBodies, по умолчанию седан.
  var ARCHES = ' L536 226 A44 44 0 0 0 448 226 L194 226 A44 44 0 0 0 106 226 Z';
  var BODIES = {
    sedan: { name: 'седан', d: [
      'M62 226 L58 196 Q58 182 74 178 L196 164 L244 154 L306 104 Q312 98 322 98 L452 98 Q466 98 474 106 L536 150 L586 160 Q594 162 594 172 L592 214 Q590 226 578 226' + ARCHES,
      'M252 152 L308 108 Q313 103 322 103 L448 103 Q458 103 464 109 L516 146 Z',
      'M376 103 L376 149 M246 158 L244 222 M378 150 L378 222 M510 152 L500 222 M196 214 L446 214',
      'M330 172 L346 172 M452 170 L468 170 M252 152 L262 140 L274 142 L270 152 M64 186 L92 180 L92 188 L66 194 Z M588 168 L594 168 L594 186 L586 186'] },
    hatch: { name: 'хэтчбек', d: [
      'M62 226 L58 196 Q58 182 74 178 L196 164 L244 152 L300 104 Q306 98 316 98 L486 98 Q500 98 508 108 L556 160 Q566 166 566 178 L564 214 Q562 226 550 226' + ARCHES,
      'M252 150 L302 108 Q307 103 316 103 L482 103 Q492 103 498 110 L538 152 Z',
      'M376 103 L376 150 M246 156 L244 222 M378 151 L378 222 M500 154 L496 222 M196 214 L446 214 M552 162 L548 204',
      'M330 172 L346 172 M452 170 L468 170 M252 150 L262 138 L274 140 L270 150 M64 186 L92 180 L92 188 L66 194 Z M558 168 L566 168 L566 188 L558 188'] },
    suv: { name: 'кроссовер', d: [
      'M60 226 L56 184 Q56 168 72 164 L200 150 L250 140 L296 86 Q302 78 314 78 L520 78 Q534 78 540 88 L578 140 Q592 146 592 160 L592 214 Q590 226 578 226' + ARCHES,
      'M258 140 L300 92 Q305 84 316 84 L518 84 Q528 84 533 92 L566 140 Z',
      'M376 84 L376 140 M470 84 L470 140 M252 146 L250 222 M378 142 L378 222 M500 142 L496 222 M196 214 L446 214 M318 72 L516 72',
      'M330 162 L346 162 M452 160 L468 160 M258 140 L268 128 L280 130 L276 140 M58 172 L92 166 L92 176 L60 182 Z M584 150 L592 150 L592 176 L584 176'] }
  };
  var bodyLists = C.carBodies || {};
  function bodyOf() {
    var key = car.brand + ' ' + car.model;
    var hit = Object.keys(bodyLists).filter(function (t) { return BODIES[t] && (bodyLists[t] || []).indexOf(key) > -1; })[0];
    return hit || 'sedan';
  }
  var shownBody = '';
  // смена кузова: старый контур исчезает, новый прорисовывается заново (короче, чем при загрузке)
  function renderBody() {
    var t = bodyOf();
    if (t === shownBody) return;
    var first = !shownBody;
    shownBody = t;
    $('#schemeBody').textContent = 'Кузов: ' + BODIES[t].name + '. ';
    var g = $('#skBody'), svg = g.ownerSVGElement;
    var html = BODIES[t].d.map(function (d) { return '<path data-draw pathLength="1" d="' + d + '"/>'; }).join('') + '<path class="sk-ground" d="M30 262 L612 262"/>';
    if (first) { g.innerHTML = html; return; }
    svg.classList.add('is-redraw');
    if (canAnimate) {
      g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' }).onfinish = function () { g.innerHTML = html; };
    } else g.innerHTML = html;
  }

  // координаты узлов в системе viewBox 0 0 640 320; подписи — на «полках» сверху (y 44) и снизу (y 292)
  var NODES = {
    engine: { x: 100, y: 190, shelf: 44, lx: 40 },
    dash: { x: 291, y: 137, shelf: 44, lx: 240 },
    suspension: { x: 492, y: 165, shelf: 44, lx: 440 },
    brakes: { x: 136, y: 238, shelf: 292, lx: 40 },
    battery: { x: 203, y: 184, shelf: 292, lx: 190 },
    wheel: { x: 492, y: 224, shelf: 292, lx: 440 }
  };
  var SHELF = 150;
  var spotCats = cats.filter(function (c) { return c.node && NODES[c.node]; });
  var pct = function (v, of) { return (v / of * 100).toFixed(3) + '%'; };
  $('#schemeLeaders').innerHTML = spotCats.map(function (c) {
    var n = NODES[c.node];
    return '<path data-node="' + esc(c.node) + '" d="M' + n.x + ' ' + n.y + ' V' + n.shelf + ' M' + n.lx + ' ' + n.shelf + ' H' + (n.lx + SHELF) + '"/>';
  }).join('');
  $('#schemeSpots').innerHTML = spotCats.map(function (c) {
    var n = NODES[c.node], count = works.filter(function (w) { return w.cat === c.id; }).length;
    return '<button class="spot" type="button" data-cat="' + esc(c.id) + '" data-node="' + esc(c.node) + '" style="left:' + pct(n.x, 640) + ';top:' + pct(n.y, 320) + '" aria-label="' + esc((c.nodeLabel || c.name) + ' — открыть раздел «' + c.name + '» в каталоге') + '"><span aria-hidden="true">' + esc(c.code || '') + '</span></button>' +
      '<span class="spot-label spot-label--' + (n.shelf < 160 ? 'top' : 'bottom') + '" data-cat="' + esc(c.id) + '" data-node="' + esc(c.node) + '" style="left:' + pct(n.lx, 640) + ';top:' + pct(n.shelf, 320) + '" aria-hidden="true">' +
      esc(c.nodeLabel || c.name) + '<small>' + count + ' ' + FB.plural(count, ['работа', 'работы', 'работ']) + '</small></span>';
  }).join('');
  var stage = $('#schemeStage');
  function hot(node, on) { $$('[data-node="' + node + '"]', stage).forEach(function (el) { el.classList.toggle('is-hot', on); }); }
  ['mouseover', 'focusin'].forEach(function (ev) { stage.addEventListener(ev, function (e) { var t = e.target.closest('[data-node]'); if (t && t.closest('.scheme__spots')) hot(t.getAttribute('data-node'), true); }); });
  ['mouseout', 'focusout'].forEach(function (ev) { stage.addEventListener(ev, function (e) { var t = e.target.closest('[data-node]'); if (t && t.closest('.scheme__spots')) hot(t.getAttribute('data-node'), false); }); });
  stage.addEventListener('click', function (e) {
    var t = e.target.closest('.scheme__spots [data-cat]');
    if (t) openCategory(t.getAttribute('data-cat'));
  });

  /* ---------------------------------------------------------------- каталог: прейскурант с кодами работ */

  var curCat = cats.length ? cats[0].id : '';
  var query = '';
  $('#catTabs').innerHTML = cats.map(function (c, i) {
    return '<button type="button" role="tab" id="tab-' + esc(c.id) + '" aria-controls="catPanel" aria-selected="' + (i === 0) + '">' + esc(c.name) + '</button>';
  }).join('');
  // Телефон: штамп машины на первом экране свёрнут в строку «Ваш автомобиль», раскрывается по нажатию
  (function () {
    var stamp = $('#carPick'), title = $('#carPickTitle'), btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stamp__toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'carPick');
    btn.innerHTML = '<span>Ваш автомобиль</span><span class="stamp__toggle-val" id="carPickVal">выбрать</span>';
    stamp.insertBefore(btn, title);
    stamp.classList.add('is-folded');
    function open(o) { stamp.classList.toggle('is-folded', !o); btn.setAttribute('aria-expanded', String(o)); }
    btn.addEventListener('click', function () { open(stamp.classList.contains('is-folded')); });
    document.addEventListener('fb:navigate', function (e) { if (e.detail && e.detail.id === '#carPick') open(true); });
    var upd = function () { var v = [$('#pBrand').value, $('#pModel').value].filter(Boolean).join(' '); $('#carPickVal').textContent = v || 'выбрать'; };
    stamp.addEventListener('input', upd); stamp.addEventListener('change', upd); stamp.addEventListener('focusout', function () { setTimeout(upd, 200); });
    upd();
  })();
  FB.tabs($('#catTabs'), function (t) { curCat = t.id.slice(4); renderCatalog(); });

  function openCategory(id, workId) {
    if (query) { query = ''; $('#svcSearch').value = ''; }
    var tab = $('#tab-' + id);
    if (tab) tab.click(); else renderCatalog();
    FB.scrollTo('#catalog', { focus: false });
    if (workId && canAnimate) {
      setTimeout(function () {
        var row = $('[data-work="' + workId + '"]');
        if (row) row.animate([{ backgroundColor: 'rgba(255, 212, 0, .55)' }, { backgroundColor: 'rgba(255, 212, 0, 0)' }], { duration: 1600, easing: 'ease-out' });
      }, 700);
    }
  }

  // «В наряд» — квадратная кнопка с плюсом; в наряде плюс превращается в галочку
  var ADD_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-plus" d="M8 3v10M3 8h10"/><path class="i-check" d="M3.5 8.5l3 3 6-7"/></svg>';
  // «по запросу» строчными — стоит в одной строке с «запчасти» и рядом с «от 700 ₽»
  function priceOrDash(p) { return p ? esc(T.priceText(p).replace(/^По запросу$/, 'по запросу')) : '—'; }
  function renderCatalog() {
    var q = query.toLowerCase();
    var list = q ? works.filter(function (w) { return w.name.toLowerCase().indexOf(q) > -1 || (codeOf[w.id] || '').toLowerCase().indexOf(q) > -1; }) : works.filter(function (w) { return w.cat === curCat; });
    $('#catTabs').classList.toggle('is-muted', !!q);
    var head = q ? '<p class="found">' + (list.length ? 'Найдено: ' + list.length : 'Ничего не нашли по запросу «' + esc(query) + '». Попробуйте другое слово или отметьте «Не знаю, какая услуга нужна».') + '</p>' : '';
    $('#catPanel').innerHTML = head + (list.length ? '<div class="wrow wrow--head" aria-hidden="true"><span>Код</span><span>Работа</span><span>Время</span><span>Работа</span><span>Запчасти</span><span></span></div>' : '') + list.map(function (w) {
      var on = cart[w.id] !== undefined, variant = cart[w.id] || (w.variants ? w.variants[0].id : '');
      var cat = T.byId(cats, w.cat);
      return '<div class="wrow' + (on ? ' is-on' : '') + '" data-work="' + esc(w.id) + '">' +
        '<span class="wrow__code">' + esc(codeOf[w.id] || '') + '</span>' +
        '<div class="wrow__name">' + (q && cat ? '<span class="wrow__cat">' + esc(cat.name) + '</span>' : '') + esc(w.name) +
        // варианты работы (радиус шин) — кнопками в строке, а не системным списком
        (w.variants ? '<span class="wrow__variants" role="radiogroup" aria-label="Вариант для «' + esc(w.name) + '»">' + w.variants.map(function (v) { return '<button type="button" role="radio" data-variant="' + esc(w.id) + '" data-v="' + esc(v.id) + '" aria-checked="' + (v.id === variant) + '" tabindex="' + (v.id === variant ? 0 : -1) + '">' + esc(v.name) + '</button>'; }).join('') + '</span>' : '') +
        (w.partsNote ? '<span class="wrow__note">' + esc(w.partsNote) + '</span>' : '') + '</div>' +
        '<span class="wrow__time">' + esc(T.duration(w.duration)) + '</span>' +
        '<span class="wrow__labor"><span class="m-label">работа </span>' + esc(laborText(w, variant)) + '</span>' +
        '<span class="wrow__parts"><span class="m-label">запчасти </span>' + (w.parts === null || w.parts === undefined ? 'не нужны' : priceOrDash(w.parts)) + '</span>' +
        '<button class="add" type="button" data-toggle="' + esc(w.id) + '" aria-pressed="' + on + '" aria-label="В наряд: ' + esc(w.name) + '" title="' + (on ? 'Убрать из наряда' : 'Добавить в наряд') + '">' + ADD_ICON + '</button></div>';
    }).join('');
  }
  $('#svcSearch').addEventListener('input', FB.debounce(function (e) { query = e.target.value.trim(); renderCatalog(); }, 120));
  $('#catPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-toggle]');
    if (!b) return;
    var id = b.getAttribute('data-toggle'), w = T.byId(works, id);
    if (cart[id] !== undefined) delete cart[id];
    else if (w.variants) { var picked = $('[data-variant="' + id + '"][aria-checked="true"]'); cart[id] = picked ? picked.getAttribute('data-v') : w.variants[0].id; }
    else cart[id] = '';
    saveCart();
    renderCatalog(); renderOrder(true); renderSummary();
    var again = $('[data-toggle="' + id + '"]');
    if (again) again.focus();
  });
  function pickVariant(b) {
    var id = b.getAttribute('data-variant'), v = b.getAttribute('data-v'), row = b.closest('.wrow'), w = T.byId(works, id);
    $$('[data-variant]', row).forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
    if (cart[id] !== undefined) { cart[id] = v; saveCart(); }
    row.querySelector('.wrow__labor').innerHTML = '<span class="m-label">работа </span>' + esc(laborText(w, v));
    renderOrder(true); renderSummary();
  }
  $('#catPanel').addEventListener('click', function (e) { var b = e.target.closest('[data-variant]'); if (b) pickVariant(b); });
  // стрелки внутри группы вариантов — как у радиокнопок
  $('#catPanel').addEventListener('keydown', function (e) {
    var b = e.target.closest('[data-variant]');
    if (!b || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var all = $$('[data-variant]', b.parentNode), i = all.indexOf(b) + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    var n = all[(i + all.length) % all.length];
    pickVariant(n); n.focus();
  });
  var demoPrices = T.demo && (pricing.demo || works.some(function (w) { return w.demo; }));
  $('#catalogDemo').hidden = !demoPrices;
  if (demoPrices) $('#catalogDemo').innerHTML = '<span class="demo-tag">демо-цены</span> Цены и время работ приведены для примера.';

  /* ---------------------------------------------------------------- «Не знаю, какая услуга нужна» */

  var unknownTop = $('#unknownToggle'), unknownForm = $('#rUnknown'), problemBox = $('#rProblemBox');
  function setUnknown(on) {
    unknownTop.checked = unknownForm.checked = on;
    problemBox.hidden = !on;
    $('#unknownCard').classList.toggle('is-on', on);
    renderOrder(true); renderSummary();
  }
  unknownTop.addEventListener('change', function () {
    setUnknown(unknownTop.checked);
    if (unknownTop.checked) { wiz.go(0, false); FB.scrollTo('#request'); setTimeout(function () { $('#rProblem').focus(); }, 800); }
  });
  unknownForm.addEventListener('change', function () { setUnknown(unknownForm.checked); });

  /* ---------------------------------------------------------------- заказ-наряд: работа и запчасти отдельно */

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

  $('#orderDate').textContent = new Date().toLocaleDateString('ru-RU');
  // в наряде только то, что клиент уже указал; пустых клеток нет
  function renderOrderCar() {
    var name = [car.brand, car.model].filter(Boolean).join(' ') + (car.year ? ', ' + car.year : '');
    if (!car.brand) {
      $('#orderCar').innerHTML = '<p class="order__nocar">Машина не выбрана — цены работ «от». <a href="#carPick">Выбрать</a></p>';
      return;
    }
    var rows = [['Машина', esc(name)]];
    if (car.plateNum) rows.push(['Госномер', plateHtml(car.plateNum, car.plateReg, 'plate--mini')]);
    if (car.mileage) rows.push(['Пробег', '<span class="mono">' + esc(FB.num(+car.mileage)) + ' км</span>']);
    if (car.vin) rows.push(['VIN', '<span class="mono">' + esc(car.vin) + '</span>']);
    $('#orderCar').innerHTML = '<dl>' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }

  var shownRows = {}, shownSum = null, tween = 0;
  // итог «перещёлкивается» к новой сумме, когда меняется состав наряда
  function setTotal(el, r, animate) {
    var from = shownSum;
    shownSum = { min: r.min, max: r.max };
    if (!animate || !canAnimate || !from || (from.min === r.min && from.max === r.max)) { tween++; el.textContent = r.text; return; }
    var t0 = performance.now(), id = ++tween;
    setTimeout(function () { if (id === tween) el.textContent = r.text; }, 600);
    (function step(now) {
      if (id !== tween) return;
      var k = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      el.textContent = T.sumText(Object.assign({}, r, { min: Math.round(from.min + (r.min - from.min) * e), max: Math.round(from.max + (r.max - from.max) * e) }));
      if (k < 1) requestAnimationFrame(step); else el.textContent = r.text;
    })(t0);
  }

  function renderOrder(animate) {
    renderOrderCar();
    var e = estimate(), box = $('#estBody');
    var headRow = '<thead><tr><th scope="col">Код</th><th scope="col">Работа</th><th scope="col">Работа, ₽</th></tr></thead>';
    $('#estimate').classList.toggle('is-empty', !e.sel.length && !unknownTop.checked);
    updateBar(e);
    if (!e.sel.length) {
      shownRows = {}; shownSum = null;
      box.innerHTML = unknownTop.checked
        ? '<table class="order__table">' + headRow + '<tbody><tr><td>ДГ</td><td>Диагностика по описанию проблемы<small>цену назовёт мастер после осмотра</small></td><td>—</td></tr></tbody></table>' +
          '<p class="order__hint">Опишите проблему в заявке — мастер предложит диагностику.</p>'
        : '<p class="order__empty">Наряд пока пуст. Нажмите <span class="order__plus" aria-hidden="true">+</span> у работы — она появится здесь с ценой и временем.</p>';
      return;
    }
    var next = {};
    box.innerHTML = '<table class="order__table">' + headRow + '<tbody>' + e.sel.map(function (s) {
      var k = s.w.id;
      next[k] = true;
      var sub = [T.duration(s.w.duration), s.w.parts ? 'запчасти ' + T.priceText(s.w.parts).replace(/^По запросу$/, 'по запросу') : 'без запчастей'].filter(Boolean).join(' · ');
      return '<tr' + (shownRows[k] ? '' : ' class="is-new"') + '><td>' + esc(codeOf[k] || '') + '</td><td>' + esc(s.w.name) + (s.variant ? ', ' + esc(s.variant.name) : '') + '<small>' + esc(sub) + '</small></td><td>' + esc(laborText(s.w, s.variant && s.variant.id)) + '</td></tr>';
    }).join('') + '</tbody></table>' +
      '<dl class="order__sum"><div><dt>Работа</dt><dd>' + esc(e.labor.text) + '</dd></div>' +
      '<div><dt>Запчасти</dt><dd>' + (e.partsCount ? esc(e.parts.text) : 'не нужны') + '</dd></div>' +
      '<div><dt>Время работ</dt><dd>≈ ' + esc(T.duration(e.minutes)) + '</dd></div>' +
      '<div class="order__total"><dt>Итого</dt><dd><mark id="orderTotal"></mark></dd></div></dl>' +
      '<p class="order__hint">' + (cls() ? 'Класс: ' + esc(cls().name) + '. ' : 'Класс автомобиля не определён — цены работ «от». ') + esc(pricing.note || '') + '</p>';
    shownRows = next;
    setTotal($('#orderTotal'), e.total, animate);
  }

  /* ---------------------------------------------------------------- путь машины по сервису */

  var visit = T.list('visit');
  T.section('visit', visit.length);
  $('#visitList').innerHTML = visit.map(function (v, i) {
    return '<li class="path__step" data-reveal><span class="path__n">' + (i + 1) + '</span><h3>' + esc(v.title) + '</h3><p>' + esc(v.text) + '</p>' +
      (v.gives ? '<p class="path__gives"><span class="sr-only">На руках: </span>' + esc(v.gives) + '</p>' : '') + '</li>';
  }).join('');

  /* ---------------------------------------------------------------- история обслуживания: отзывы по пробегу */

  var reviews = T.list('reviews').slice().sort(function (a, b) { return (a.mileage || 0) - (b.mileage || 0); });
  T.section('reviews', T.feature('reviews') && reviews.length);
  var maxKm = Math.max.apply(null, [50000].concat(reviews.map(function (r) { return r.mileage || 0; })));
  var scaleTo = Math.ceil(maxKm / 50000) * 50000;
  var ticks = [];
  for (var km = 0; km <= scaleTo; km += 25000) ticks.push(km);
  $('#kmScale').innerHTML = '<span class="km__line"></span>' +
    ticks.map(function (t) {
      var end = t === scaleTo;
      return '<span class="km__tick' + (t % 50000 ? ' km__tick--minor' : '') + (end ? ' km__tick--end' : '') + '" style="left:' + pct(t, scaleTo) + '">' +
        (t % 50000 ? '' : '<b>' + (t ? FB.num(t / 1000) + ' тыс.' : '0') + (end ? ' км' : '') + '</b>') + '</span>';
    }).join('') +
    reviews.map(function (r, i) { return r.mileage ? '<span class="km__mark" data-i="' + i + '" style="left:' + pct(r.mileage, scaleTo) + '"><b>' + FB.num(r.mileage) + '</b></span>' : ''; }).join('');
  $('#reviewsList').innerHTML = reviews.map(function (r, i) {
    var src = r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.source || 'источник') + '</a>' : esc(r.source || '');
    var ws = (r.works || []).map(function (id) { return T.byId(works, id); }).filter(Boolean);
    return '<li class="hist__item" data-i="' + i + '" data-reveal>' +
      '<p class="hist__km">' + (r.mileage ? '<b>' + FB.num(r.mileage) + '</b> км' : '') + '</p>' +
      '<div class="hist__body">' +
        '<p class="hist__meta"><b>' + esc(r.car || '') + '</b>' + (r.date ? ' · ' + esc(r.date) : '') + '</p>' +
        '<blockquote class="hist__quote"><p>' + esc(r.text) + '</p></blockquote>' +
        '<p class="hist__who">— ' + esc(r.author || '') + (src ? ', ' + src : '') + '</p>' +
        (ws.length ? '<div class="hist__foot"><ul class="hist__works" role="list">' + ws.map(function (w) { return '<li><span>' + esc(codeOf[w.id] || '') + '</span>' + esc(w.name) + '</li>'; }).join('') + '</ul>' +
          '<button class="hist__go" type="button" data-go-work="' + esc(ws[0].id) + '">В каталог<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button></div>' : '') +
      '</div></li>';
  }).join('');
  var demoReviews = T.demo && reviews.some(function (r) { return r.demo; });
  $('#reviewsDemo').hidden = !demoReviews;
  if (demoReviews) $('#reviewsDemo').innerHTML = '<span class="demo-tag">демо-отзывы</span> Отзывы приведены для примера — публикуйте только настоящие, с согласия автора.';
  // запись и её отметка на шкале пробега подсвечивают друг друга
  function markHist(i, on) {
    $$('#kmScale .km__mark[data-i="' + i + '"], #reviewsList .hist__item[data-i="' + i + '"]').forEach(function (el) { el.classList.toggle('is-hot', on); });
  }
  T.rail($('#reviewsList'), 'История обслуживания');
  $('#reviewsList').addEventListener('mouseover', function (e) { var it = e.target.closest('.hist__item'); if (it) markHist(it.getAttribute('data-i'), true); });
  $('#reviewsList').addEventListener('mouseout', function (e) { var it = e.target.closest('.hist__item'); if (it) markHist(it.getAttribute('data-i'), false); });
  $('#reviewsList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go-work]');
    if (!b) return;
    var w = T.byId(works, b.getAttribute('data-go-work'));
    if (w) openCategory(w.cat, w.id);
  });

  /* ---------------------------------------------------------------- «Без мелкого шрифта»: условия и вопросы */

  var pol = C.policies || {}, marks = C.policyMarks || {};
  var terms = [['extraWork', 'Дополнительные работы'], ['parts', 'Свои запчасти'], ['oldParts', 'Старые детали'], ['warranty', 'Гарантия']].filter(function (t) { return pol[t[0]]; });
  T.section('terms', terms.length || T.list('faq').length);
  // фраза из policyMarks выделяется жёлтым маркером; если её нет в тексте — текст выводится как есть
  function withMark(text, mark) {
    var t = esc(text), m = mark ? esc(mark) : '';
    var i = m ? t.indexOf(m) : -1;
    return i < 0 ? t : t.slice(0, i) + '<mark class="hl">' + m + '</mark>' + t.slice(i + m.length);
  }
  $('#termsList').innerHTML = terms.map(function (t) {
    return '<li class="rule" data-reveal><h3>' + esc(t[1]) + '</h3><p>' + withMark(pol[t[0]], marks[t[0]]) + '</p></li>';
  }).join('');
  $('#termsList').hidden = !terms.length;
  $('#termsDemo').hidden = !(T.demo && pol.demo && terms.length);
  if (T.demo && pol.demo) $('#termsDemo').innerHTML = '<span class="demo-tag">демо-текст</span> Тексты условий приведены для примера — впишите утверждённые формулировки сервиса.';

  var faq = T.list('faq');
  $('#faq').hidden = !faq.length;
  $('#faqList').innerHTML = faq.map(function (q) {
    return '<div class="qa__item" data-reveal><p class="qa__q">' + esc(q.q) + '</p><p class="qa__a">' + esc(q.a) + '</p></div>';
  }).join('');
  // на телефоне вопросы раскрываются по нажатию: вопрос становится кнопкой (стили — max-width: 760px)
  $$('#faqList .qa__item').forEach(function (it, i) {
    var q = it.querySelector('.qa__q'), b = document.createElement('button');
    b.type = 'button';
    b.className = 'qa__toggle';
    b.setAttribute('aria-expanded', 'false');
    b.textContent = q.textContent;
    b.addEventListener('click', function () { var o = !it.classList.contains('is-open'); it.classList.toggle('is-open', o); b.setAttribute('aria-expanded', String(o)); });
    it.insertBefore(b, q);
  });
  if (faq.length) {
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(function (q) { return { '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } }; })
    });
    document.head.appendChild(ld);
  }

  /* ---------------------------------------------------------------- контакты и карта */

  // длинная подсказка общего слоя о пустых контактах заменяется одной демо-строкой; реквизиты — в консоль
  if (T.demo) {
    var note = $('.contact-row--note');
    if (note) {
      note.remove();
      $('#contactsDemo').hidden = false;
      $('#contactsDemo').innerHTML = '<span class="demo-tag">демо</span> Телефон, почта и Telegram появятся после заполнения <code>config.js → contacts</code>.';
    }
    var l = C.legal || {}, req = $('.legal-req');
    if (req && !(l.operator && l.inn)) { req.remove(); console.info('[auto] Демо: реквизиты появятся после заполнения config.js → legal.'); }
  }
  var map = (C.contacts || {}).map, mapBox = $('#map');
  if (map && map.embed) {
    mapBox.hidden = false;
    mapBox.innerHTML = '<iframe src="' + esc(map.embed) + '" title="Карта проезда" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
  } else if (T.demo) {
    // заглушка в языке чертежа: улицы двойными линиями, точка сервиса жёлтым
    mapBox.hidden = false;
    mapBox.classList.add('map--stub');
    mapBox.innerHTML = '<svg viewBox="0 0 600 420" aria-hidden="true">' +
      '<path class="map__road" d="M0 120 H600 M0 128 H600 M0 300 H600 M0 308 H600 M170 0 V420 M178 0 V420 M420 0 V420 M428 0 V420 M260 420 L600 160 M268 420 L600 170"/>' +
      '<path class="map__block" d="M196 146 H300 V214 H196 Z M196 230 H300 V282 H196 Z M20 146 H152 V282 H20 Z M446 18 H580 V102 H446 Z M196 18 H402 V102 H196 Z M20 326 H152 V404 H20 Z"/>' +
      '<path class="map__site" d="M318 146 H402 V230 H318 Z"/><path class="map__gate" d="M332 230 V262 M388 230 V262"/>' +
      '<circle class="map__pin" cx="360" cy="188" r="9"/><circle class="map__ring" cx="360" cy="188" r="20"/>' +
      '</svg><p class="map__cap">Здесь будет карта. Укажите <code>contacts.map.embed</code> — ссылку виджета Яндекс Карт.</p>';
  }
  $('.contacts__grid').classList.toggle('is-single', mapBox.hidden);

  /* ---------------------------------------------------------------- заявка: время и контакт */

  var form = $('#reqForm');
  var dayParts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#rParts').innerHTML = dayParts.map(function (p) {
    // «Утро, до 12:00» → крупно «Утро», ниже часы
    var m = String(p).split(/,\s*/);
    return '<label class="seg__item"><input type="radio" name="part" value="' + esc(p) + '" required data-msg="Выберите время суток"><b>' + esc(m[0]) + '</b>' + (m[1] ? '<small>' + esc(m.slice(1).join(', ')) + '</small>' : '') + '</label>';
  }).join('');

  // желаемый день: две недели вперёд; выходные из contacts.hours («Вс: выходной») недоступны
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var closed = {};
  ((C.contacts || {}).hours || []).forEach(function (h) {
    if (!/выходн|закрыт/i.test(h.time || '')) return;
    String(h.days || '').toLowerCase().split(/\s*,\s*/).forEach(function (part) {
      var r = part.split(/\s*[–-]\s*/), a = WD.indexOf(r[0].slice(0, 2)), b = WD.indexOf((r[1] || r[0]).slice(0, 2));
      if (a < 0 || b < 0) return;
      for (var d = a; ; d = (d + 1) % 7) { closed[d] = true; if (d === b) break; }
    });
  });
  $('#rDays').innerHTML = FB.days(14).map(function (d, i) {
    var off = closed[d.getDay()], w = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : WD[d.getDay()];
    return '<label class="day' + (off ? ' is-off' : '') + '"' + (off ? ' title="Выходной"' : '') + '><input type="radio" name="date" value="' + FB.iso(d) + '"' + (off ? ' disabled' : ' required data-msg="Выберите день"') + '>' +
      '<small>' + w + '</small><b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') + '</small></label>';
  }).join('');
  $('#rConsent').innerHTML = T.consentHtml('rConsentBox');

  // сводка над полями: машина и работы уже выбраны выше — не спрашиваем их второй раз
  // марку спрашиваем в форме, только если её не выбрали на первом экране (пока поле в фокусе — не прячем)
  function renderSummary() {
    var e = estimate(), name = [car.brand, car.model, car.year].filter(Boolean).join(' ');
    var worksText = e.sel.length ? e.sel.length + ' ' + FB.plural(e.sel.length, ['работа', 'работы', 'работ']) + ' · ' + e.total.text
      : unknownForm.checked ? 'диагностика по описанию проблемы' : 'не выбраны';
    $('#rSummary').innerHTML = '<dl>' +
      (name ? '<div><dt>Машина</dt><dd>' + esc(name) + (car.plateNum ? ' ' + plateHtml(car.plateNum, car.plateReg, 'plate--mini') : '') + ' <a href="#carPick">изменить</a></dd></div>' : '') +
      '<div><dt>В наряде</dt><dd>' + esc(worksText) + ' <a href="#catalog">изменить</a></dd></div></dl>';
    var box = $('#rBrandBox');
    if (!box.contains(document.activeElement)) box.hidden = !!car.brand;
  }
  $('#rBrand').addEventListener('blur', function () { setTimeout(renderSummary, 0); });

  // нижняя панель на телефоне: когда в наряде есть работы, показывает их число и сумму
  var bar = null;
  function updateBar(e) {
    if (!bar) return;
    bar.textContent = e.sel.length ? 'Заявка · ' + e.sel.length + ' ' + FB.plural(e.sel.length, ['работа', 'работы', 'работ']) + ' · ' + e.total.text : 'Оставить заявку';
  }

  // пробег — только цифры; VIN — латиница и цифры без I, O, Q; всё сразу попадает в наряд
  $('#rMileage').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 7);
    if (v !== this.value) this.value = v;
    car.mileage = v; saveCar(); renderOrderCar();
  });
  $('#rVin').addEventListener('input', function () {
    var v = this.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
    if (v !== this.value) this.value = v;
    car.vin = v; saveCar(); renderOrderCar();
  });
  $('#rPlate').addEventListener('input', function () { this.dataset.touched = '1'; });

  var wiz = T.wizard(form, {
    progress: $('#reqSteps'),
    check: { 0: function () { return Object.keys(cart).length || unknownForm.checked ? true : 'Добавьте работы в наряд или отметьте «Не знаю, какая услуга нужна».'; } }
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
        car: [fd.get('brand'), car.model, car.year].filter(Boolean).join(' '),
        service: e.sel.map(function (s) { return (codeOf[s.w.id] ? codeOf[s.w.id] + ' ' : '') + s.w.name + (s.variant ? ' (' + s.variant.name + ')' : ''); }).join('; ') || 'Диагностика по описанию проблемы',
        time: fd.get('part'),
        total: e.sel.length ? e.total.text : '',
        consent: fd.get('consent') === 'да',
        details: {
          'Проблема': unknownForm.checked ? fd.get('problem') : '—',
          'Работа (предварительно)': e.sel.length ? e.labor.text : '—',
          'Запчасти (предварительно)': e.partsCount ? e.parts.text : '—',
          'Класс авто': cls() ? cls().name : 'не определён',
          'Госномер': fd.get('plate') || '—',
          'VIN': fd.get('vin') || '—',
          'Пробег': fd.get('mileage') ? fd.get('mileage') + ' км' : '—',
          'Коды работ': Object.keys(cart).map(function (id) { return id + (cart[id] ? ':' + cart[id] : ''); }).join(', ') || '—'
        },
        brand: undefined, part: undefined, unknown: undefined, problem: undefined, plate: undefined, mileage: undefined, vin: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Автомобиль</dt><dd>' + esc(p.car) + '</dd><dt>Работы</dt><dd>' + esc(p.service) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(p.time) + '</dd>' + (p.total ? '<dt>Предварительно</dt><dd>' + esc(p.total) + '</dd>' : '') + '</dl>';
    },
    onSuccess: function (res, p) {
      // талон записи: номер заявки крупно и госномер — то, что назвать администратору
      var title = $('#reqResult .result__title');
      if (title && res && res.id) {
        title.insertAdjacentHTML('afterend', '<div class="talon"><p class="talon__lbl">Номер заявки</p><p class="talon__no">' + esc(res.id) + '</p>' +
          (car.plateNum ? plateHtml(car.plateNum, car.plateReg) : '') +
          '<p class="talon__when">' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ' · ' + esc(String(p.time || '').toLowerCase()) + '</p></div>');
      }
      cart = {}; saveCart();
      setUnknown(false);
      renderCatalog(); renderOrder(false); renderSummary();
    }
  });
  // core сбрасывает форму после успеха — возвращаем данные машины в поля
  form.addEventListener('fb:reset', function () { fillCarFields(); renderSummary(); });

  fillCarFields();
  renderClass();
  renderBody();
  renderCatalog();
  renderOrder(false);
  renderSummary();
  T.mobileCta('Оставить заявку', 'request');
  bar = $('.mcta__btn');
  updateBar(estimate());
});
