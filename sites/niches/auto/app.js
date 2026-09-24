/* ТОРК — автосервис: цены по классу авто, корзина работ, шиномонтаж, запись на пост, гараж, статус и допработы. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочники */

  // марка → класс (A — массовые, B — средний, C — премиум) и популярные модели
  var BRANDS = {
    'Lada': ['A', 'Vesta, Granta, Largus, Niva Travel'], 'Kia': ['A', 'Rio, Ceed, Sportage, K5'], 'Hyundai': ['A', 'Solaris, Creta, Tucson, Elantra'],
    'Renault': ['A', 'Logan, Duster, Kaptur, Arkana'], 'Skoda': ['A', 'Octavia, Rapid, Kodiaq, Karoq'], 'Volkswagen': ['A', 'Polo, Tiguan, Jetta, Passat'],
    'Haval': ['A', 'Jolion, F7, H6, Dargo'], 'Chery': ['A', 'Tiggo 4, Tiggo 7 Pro, Tiggo 8 Pro'], 'Geely': ['A', 'Coolray, Atlas, Monjaro'],
    'Nissan': ['A', 'Qashqai, X-Trail, Almera, Terrano'], 'Toyota': ['B', 'Camry, RAV4, Corolla, Land Cruiser Prado'], 'Mazda': ['B', 'CX-5, 6, 3, CX-9'],
    'Mitsubishi': ['B', 'Outlander, ASX, Pajero Sport, L200'], 'Ford': ['B', 'Focus, Kuga, Mondeo, Explorer'], 'Honda': ['B', 'CR-V, Civic, Accord'],
    'Subaru': ['B', 'Forester, Outback, XV'], 'Exeed': ['B', 'LX, TXL, VX'], 'BMW': ['C', 'X5, 3 Series, 5 Series, X3'],
    'Mercedes-Benz': ['C', 'E-Class, C-Class, GLE, GLC'], 'Audi': ['C', 'A4, A6, Q5, Q7'], 'Lexus': ['C', 'RX, NX, ES, LX'],
    'Volvo': ['C', 'XC60, XC90, S60'], 'Land Rover': ['C', 'Range Rover Sport, Discovery, Evoque'], 'Porsche': ['C', 'Cayenne, Macan, Panamera']
  };
  var MULT = { A: 1, B: 1.15, C: 1.4 };
  var CLASS_NAME = { A: 'массовый', B: 'средний', C: 'премиум' };

  var CATS = [['to', 'ТО и жидкости'], ['chassis', 'Ходовая'], ['brakes', 'Тормоза'], ['diag', 'Диагностика'], ['ac', 'Кондиционер'], ['elec', 'Электрика']];
  // [категория, название, минут, цена для класса A]
  var SERVICES = [
    ['to', 'Замена масла и фильтра', 40, 1200], ['to', 'ТО по регламенту производителя', 90, 3500], ['to', 'Замена воздушного фильтра', 15, 300],
    ['to', 'Замена салонного фильтра', 20, 400], ['to', 'Замена свечей зажигания', 40, 1000], ['to', 'Замена антифриза', 60, 1800],
    ['to', 'Замена тормозной жидкости', 45, 1200], ['to', 'Замена ремня ГРМ с роликами', 240, 6500],
    ['chassis', 'Диагностика подвески', 30, 800], ['chassis', 'Стойки стабилизатора (пара)', 40, 1400], ['chassis', 'Амортизатор (1 шт.)', 60, 1800],
    ['chassis', 'Рычаг подвески (1 шт.)', 60, 1900], ['chassis', 'Замена сайлентблоков рычага', 120, 2400], ['chassis', 'Развал-схождение 3D', 40, 2200],
    ['brakes', 'Передние колодки', 40, 1200], ['brakes', 'Задние колодки', 50, 1400], ['brakes', 'Диски и колодки (ось)', 90, 2800], ['brakes', 'Прокачка тормозной системы', 40, 1200],
    ['diag', 'Компьютерная диагностика', 30, 1200], ['diag', 'Эндоскопия цилиндров', 40, 1500], ['diag', 'Проверка перед покупкой', 90, 3500],
    ['ac', 'Заправка кондиционера', 40, 2500], ['ac', 'Антибактериальная обработка', 30, 1500], ['ac', 'Поиск утечки УФ-красителем', 40, 1200],
    ['elec', 'Замена аккумулятора', 20, 500], ['elec', 'Ремонт/замена генератора', 150, 3500], ['elec', 'Ремонт/замена стартера', 120, 3000], ['elec', 'Регулировка фар', 30, 800]
  ].map(function (s, i) { return { id: 's' + i, cat: s[0], name: s[1], min: s[2], price: s[3] }; });
  var svcById = {};
  SERVICES.forEach(function (s) { svcById[s.id] = s; });

  var RADII = { 13: 1800, 14: 1900, 15: 2100, 16: 2300, 17: 2600, 18: 2900, 19: 3300, 20: 3700, 21: 4200, 22: 4700 };
  var SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  /* ================================================================ состояние */

  var car = FB.store.get('car', { brand: '', model: '', year: '' });
  var cart = FB.store.get('cart', {});       // id → true; особая позиция 'tire' хранит расчёт шиномонтажа
  var tireItem = FB.store.get('tireItem', null);
  var garage = FB.store.get('garage', []);

  function cls() { return car.brand && BRANDS[car.brand] ? BRANDS[car.brand][0] : null; }
  function price(s) { var c = cls(); return Math.round(s.price * (c ? MULT[c] : 1) / 50) * 50; }
  function fmtMin(m) { var h = Math.floor(m / 60), mm = m % 60; return (h ? h + ' ч' : '') + (h && mm ? ' ' : '') + (mm ? mm + ' мин' : ''); }

  /* ================================================================ подпанель: выпадающие разделы */

  var jumpBtn = FB.$('#jumpBtn'), jumpList = FB.$('#jumpList');
  function setJump(open) { jumpBtn.setAttribute('aria-expanded', String(open)); jumpList.hidden = !open; }
  jumpBtn.addEventListener('click', function (e) { e.stopPropagation(); setJump(jumpList.hidden); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.jump')) setJump(false); });
  jumpList.addEventListener('click', function (e) { if (e.target.closest('a')) setJump(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !jumpList.hidden) { setJump(false); jumpBtn.focus(); } });
  if ('IntersectionObserver' in window) {
    var links = FB.$$('a', jumpList);
    var so = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('is-active', on);
          if (on) FB.$('#jumpLabel').textContent = a.textContent;
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    links.forEach(function (a) { var s = FB.$(a.getAttribute('href')); if (s) so.observe(s); });
  }

  /* ================================================================ выбор авто */

  function fillBrands(sel) {
    sel.innerHTML = '<option value="">Выберите марку</option>' + Object.keys(BRANDS).sort().map(function (b) { return '<option>' + b + '</option>'; }).join('');
  }
  function fillYears(sel) {
    var y = new Date().getFullYear(), html = '<option value="">Год</option>';
    for (var i = y; i >= 2000; i--) html += '<option>' + i + '</option>';
    sel.innerHTML = html;
  }
  var cb = FB.$('#carBrand'), cm = FB.$('#carModel'), cy = FB.$('#carYear');
  var bb = FB.$('#bBrand'), bm = FB.$('#bModel'), by = FB.$('#bYear');
  [cb, bb].forEach(fillBrands);
  [cy, by].forEach(fillYears);

  function syncCar(from) {
    if (from === 'pick') { car = { brand: cb.value, model: cm.value, year: cy.value }; }
    else if (from === 'book') { car = { brand: bb.value, model: bm.value, year: by.value }; }
    cb.value = bb.value = car.brand; cm.value = bm.value = car.model; cy.value = by.value = car.year;
    FB.$('#modelList').innerHTML = car.brand ? BRANDS[car.brand][1].split(', ').map(function (m) { return '<option value="' + m + '">'; }).join('') : '';
    var c = cls();
    FB.$('#carClass').textContent = c ? 'Класс: ' + CLASS_NAME[c] + (c === 'A' ? ' · базовые цены' : ' · цены ×' + String(MULT[c]).replace('.', ',')) : 'Выберите марку — покажем точные цены';
    FB.store.set('car', car);
    renderServices();
    renderCart();
  }
  [cb, cm, cy].forEach(function (el) { el.addEventListener('change', function () { syncCar('pick'); }); });
  [bb, bm, by].forEach(function (el) { el.addEventListener('change', function () { syncCar('book'); }); });

  /* ================================================================ услуги */

  var curCat = 'to';
  var tabs = FB.$('#svcTabs');
  tabs.innerHTML = CATS.map(function (c, i) {
    return '<button type="button" role="tab" id="tab-' + c[0] + '" aria-controls="svcPanel" aria-selected="' + (i === 0) + '">' + c[1] + '</button>';
  }).join('');
  FB.tabs(tabs, function (t) { curCat = t.id.slice(4); renderServices(); FB.track('view_service', { cat: curCat }); });

  function renderServices() {
    var c = cls();
    FB.$('#svcPanel').innerHTML = SERVICES.filter(function (s) { return s.cat === curCat; }).map(function (s, i) {
      return '<label class="svc" style="--i:' + i + '"><input type="checkbox" data-svc="' + s.id + '"' + (cart[s.id] ? ' checked' : '') + '>' +
        '<span class="svc__name">' + s.name + '</span><span class="svc__meta">' + fmtMin(s.min) + ' · работа без запчастей</span>' +
        '<span class="svc__price">' + (c ? '' : 'от ') + FB.money(price(s)) + '<small>' + (c ? CLASS_NAME[c] + ' класс' : 'зависит от марки') + '</small></span>' +
        '<span class="svc__tick" aria-hidden="true">✓</span></label>';
    }).join('');
  }
  FB.$('#svcPanel').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-svc');
    if (!id) return;
    if (e.target.checked) cart[id] = true; else delete cart[id];
    FB.store.set('cart', cart);
    renderCart();
    FB.track('select_service', { id: id, on: e.target.checked });
  });

  function cartItems() {
    var items = Object.keys(cart).filter(function (id) { return svcById[id]; }).map(function (id) { var s = svcById[id]; return { id: id, name: s.name, min: s.min, price: price(s) }; });
    if (tireItem) items.push({ id: 'tire', name: tireItem.name, min: tireItem.min, price: tireItem.price });
    return items;
  }
  function renderCart() {
    var items = cartItems(), sum = 0, min = 0;
    items.forEach(function (i) { sum += i.price; min += i.min; });
    FB.$('#cartCount').textContent = items.length + ' ' + FB.plural(items.length, ['работа', 'работы', 'работ']);
    FB.$('#cartTime').textContent = min ? '≈ ' + fmtMin(min) : '—';
    FB.$('#cartSum').textContent = (cls() ? '' : 'от ') + FB.money(sum);
    FB.$('#cart').classList.toggle('is-on', items.length > 0);
    // список в форме записи
    FB.$('#bkServices').innerHTML = items.length ? items.map(function (i) {
      return '<label><input type="checkbox" checked data-bk="' + i.id + '"><span>' + i.name + '</span><em>' + FB.money(i.price) + '</em></label>';
    }).join('') : '<p class="empty">Работы не выбраны — опишите симптомы ниже или <a href="#services">выберите в прайсе</a>. Диагностика перед ремонтом бесплатна.</p>';
    FB.$('#bkTotal').textContent = items.length ? (cls() ? '' : 'от ') + FB.money(sum) + ' · ≈ ' + fmtMin(min) : 'по результатам диагностики';
  }
  FB.$('#bkServices').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-bk');
    if (!id || e.target.checked) return;
    if (id === 'tire') { tireItem = null; FB.store.set('tireItem', null); } else { delete cart[id]; FB.store.set('cart', cart); }
    renderServices();
    renderCart();
  });

  /* ================================================================ шиномонтаж */

  var radiiBox = FB.$('#radii');
  radiiBox.innerHTML = Object.keys(RADII).map(function (r) {
    return '<label><input type="radio" name="radius" value="' + r + '"' + (r === '16' ? ' checked' : '') + '><span>R' + r + '</span></label>';
  }).join('');
  var tireForm = FB.$('#tireForm');
  tireForm.removeAttribute('onsubmit');
  tireForm.addEventListener('submit', function (e) { e.preventDefault(); });
  var tireShown = 0;
  function tireCalc() {
    var r = +tireForm.radius.value, type = tireForm.ttype.value;
    var opts = FB.$$('input[name=topt]:checked', tireForm).map(function (i) { return i.value; });
    var base = RADII[r] * (type === 'suv' ? 1.15 : type === 'jeep' ? 1.3 : 1);
    if (opts.indexOf('runflat') >= 0) base *= 1.3;
    base = Math.round(base / 50) * 50;
    var total = base + (opts.indexOf('wash') >= 0 ? 400 : 0) + (opts.indexOf('bags') >= 0 ? 200 : 0) + (opts.indexOf('storage') >= 0 ? 3500 : 0);
    var min = 40 + (r >= 19 ? 10 : 0) + (type === 'jeep' ? 10 : 0);
    var names = { wash: 'мойка', bags: 'пакеты', runflat: 'RunFlat', storage: 'хранение' };
    return { total: total, min: min, name: 'Шиномонтаж R' + r + ' (' + { car: 'легковой', suv: 'кроссовер', jeep: 'внедорожник' }[type] + ')' + (opts.length ? ' + ' + opts.map(function (o) { return names[o]; }).join(', ') : '') };
  }
  function renderTire() {
    var t = tireCalc(), el = FB.$('#tireTotal');
    if (FB.anime && !FB.reduced && tireShown) {
      var o = { v: tireShown };
      FB.anime.animate(o, { v: t.total, duration: 450, ease: 'outCubic', onUpdate: function () { el.textContent = FB.money(o.v); } });
    } else el.textContent = FB.money(t.total);
    tireShown = t.total;
    FB.$('#tireTime').textContent = 'Время ≈ ' + t.min + ' минут · балансировка и грузики включены';
  }
  tireForm.addEventListener('change', renderTire);
  FB.$('#tireBook').addEventListener('click', function () {
    var t = tireCalc();
    tireItem = { name: t.name, price: t.total, min: t.min };
    FB.store.set('tireItem', tireItem);
    var box3 = FB.$('#bBox input[value^="Пост 3"]');
    box3.checked = true;
    renderCart();
    renderSlots();
    FB.scrollTo('#booking');
    FB.track('select_service', { id: 'tire', total: t.total });
  });

  /* ================================================================ запись: дни и слоты */

  var daysBox = FB.$('#bDays');
  daysBox.innerHTML = FB.days(10).map(function (d, i) {
    return '<label><input type="radio" name="date" value="' + FB.iso(d) + '"' + (i === 0 ? ' checked' : '') + '><span>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.weekday(d, true)) + '<b>' + d.getDate() + '</b></span></label>';
  }).join('');
  var bkForm = FB.$('#bkForm');
  function boxVal() { return (FB.$('#bBox input:checked') || {}).value || ''; }
  function dateVal() { return (FB.$('input[name=date]:checked', daysBox) || {}).value; }

  function renderSlots() {
    var box = boxVal(), date = dateVal(), wrap = FB.$('#bSlots');
    wrap.innerHTML = '<p class="muted">Проверяем расписание поста…</p>';
    FB.lead.busy(box, date, SLOTS, 0.4).then(function (busy) {
      var free = 0;
      wrap.innerHTML = SLOTS.map(function (t) {
        var dis = busy.indexOf(t) >= 0 || FB.isPastSlot(date, t);
        if (!dis) free++;
        return '<label><input type="radio" name="time" value="' + t + '"' + (dis ? ' disabled' : '') + '><span>' + t + '</span></label>';
      }).join('') + (free ? '' : '<p class="muted" style="grid-column:1/-1">На этот день всё занято — выберите другой.</p>');
    });
  }
  daysBox.addEventListener('change', function () { renderSlots(); FB.track('select_date'); });
  FB.$('#bBox').addEventListener('change', renderSlots);

  // ближайшее свободное окно в первом экране
  (function heroSlot() {
    var days = FB.days(5), i = 0;
    (function next() {
      if (i >= days.length) { FB.$('#heroSlot').innerHTML = 'Свободные окна — <b>в записи</b>'; return; }
      var d = FB.iso(days[i]);
      FB.lead.busy('Пост 1 · слесарный', d, SLOTS, 0.4).then(function (busy) {
        var t = SLOTS.filter(function (s) { return busy.indexOf(s) < 0 && !FB.isPastSlot(d, s); })[0];
        if (t) FB.$('#heroSlot').innerHTML = 'Ближайшее свободное окно: <b>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.fmtDate(d, { day: 'numeric', month: 'long' })) + ' в ' + t + '</b>';
        else { i++; next(); }
      });
    })();
  })();

  FB.files(FB.$('#bFiles'), { max: 5, maxSize: 15 * 1024 * 1024, list: FB.$('#bFileList') });

  /* ================================================================ отправка записи */

  FB.form(bkForm, {
    type: 'service_booking',
    before: function () { return FB.$('input[name=time]:checked', bkForm) ? true : 'Выберите свободное время.'; },
    collect: function (fd) {
      var items = FB.$$('#bkServices input:checked').map(function (i) { return cartItems().filter(function (x) { return x.id === i.getAttribute('data-bk'); })[0]; }).filter(Boolean);
      var sum = items.reduce(function (a, i) { return a + i.price; }, 0);
      return {
        car: [fd.get('brand'), fd.get('model'), fd.get('year')].filter(Boolean).join(' '),
        service: items.map(function (i) { return i.name; }).join('; ') || 'Диагностика по симптомам',
        resource: boxVal(), date: fd.get('date'), time: fd.get('time'),
        total: items.length ? FB.money(sum) : '',
        details: { 'Пробег': fd.get('mileage') || '—', 'Госномер/VIN': fd.get('plate') || '—', 'Ожидает в сервисе': fd.get('wait') ? 'да' : 'нет', 'Класс авто': cls() ? CLASS_NAME[cls()] : '—' }
      };
    },
    success: function (res, p) {
      // гараж: сохраняем авто и историю визитов
      var key = (p.brand + ' ' + p.model).trim().toLowerCase();
      var g = garage.filter(function (x) { return (x.brand + ' ' + x.model).trim().toLowerCase() === key; })[0];
      if (!g) { g = { brand: p.brand, model: p.model, year: p.year, history: [] }; garage.unshift(g); }
      g.mileage = p.mileage || g.mileage; g.plate = p.plate || g.plate; g.year = p.year || g.year;
      g.history.unshift({ id: res.id, date: p.date, time: p.time, service: p.service });
      FB.store.set('garage', garage);
      cart = {}; tireItem = null; FB.store.set('cart', cart); FB.store.set('tireItem', null);
      renderServices(); renderCart();
      FB.track('booking_confirmed', { id: res.id });
      bkForm.hidden = true;
      var done = FB.$('#bkDone');
      done.hidden = false;
      done.innerHTML = '<p class="muted">Заказ-наряд</p><div class="num">' + FB.esc(res.id) + '</div>' +
        '<p class="lead" style="margin:0">' + FB.esc(p.car) + ' · ' + FB.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' в ' + p.time + ', ' + FB.esc(p.resource) + '. Подтвердим в течение 10 минут и пришлём напоминание за день.</p>' +
        '<div class="actions"><a class="btn btn--yellow" href="' + ics(p) + '" download="tork-vizit.ics">В календарь</a><a class="btn btn--ghost" href="#status" id="toStatus" data-id="' + FB.esc(res.id) + '">Статус авто</a>' +
        '<button class="btn btn--ghost" type="button" data-open="garage">Мой гараж</button><button class="btn btn--ghost" type="button" id="bkAgain">Новая запись</button></div>';
      FB.scrollTo(done, { focus: false });
      syncCar();
      renderSlots();
    }
  });
  FB.$('#bkDone').addEventListener('click', function (e) {
    if (e.target.id === 'bkAgain') { FB.$('#bkDone').hidden = true; bkForm.hidden = false; }
    if (e.target.id === 'toStatus') { FB.$('#stId').value = e.target.getAttribute('data-id'); checkStatus(); }
  });

  function ics(p, title, dateIso, desc) {
    var d = (dateIso || p.date).replace(/-/g, ''), t = (p && p.time ? p.time : '10:00').replace(':', '');
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TORK//RU', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@tork', 'DTSTAMP:' + stamp,
      'DTSTART:' + d + 'T' + t + '00', 'DURATION:PT1H', 'SUMMARY:' + (title || 'ТОРК: визит в сервис'),
      'LOCATION:Екатеринбург\\, ул. Шефская\\, 2Г', 'DESCRIPTION:' + (desc || (p.service || '') + ' Тел. ' + FB.config.phone),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Напоминание ТОРК', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ мой гараж */

  function nextSeason() {
    var now = FB.today(), y = now.getFullYear();
    var cands = [new Date(y, 3, 15), new Date(y, 9, 15), new Date(y + 1, 3, 15)].filter(function (d) { return d > now; });
    var d = cands[0];
    return { date: d, winter: d.getMonth() === 9 };
  }
  function renderGarage() {
    var box = FB.$('#gBody');
    if (!garage.length) {
      box.innerHTML = '<p class="lead">Здесь появятся ваши автомобили, история визитов и напоминания о ТО и смене шин. Данные хранятся на этом устройстве.</p><a class="btn btn--yellow" href="#booking" data-close>Записаться</a>';
      return;
    }
    var s = nextSeason();
    box.innerHTML = garage.map(function (g, i) {
      var last = g.history[0];
      var km = parseInt(String(g.mileage || '').replace(/\D/g, ''), 10);
      var nextKm = km ? Math.ceil((km + 1) / 10000) * 10000 : null;
      var nextDate = last ? FB.addDays(FB.parseIso(last.date), 365) : null;
      return '<article class="car-card"><h3>' + FB.esc(g.brand + ' ' + g.model) + (g.year ? ', ' + FB.esc(g.year) : '') + '</h3>' +
        (g.plate ? '<div class="row"><span>Госномер / VIN</span><span>' + FB.esc(g.plate) + '</span></div>' : '') +
        '<div class="row"><span>Следующее ТО</span><b>' + (nextKm ? 'на ' + FB.num(nextKm) + ' км или ' : '') + (nextDate ? 'до ' + FB.fmtDate(nextDate, { day: 'numeric', month: 'long', year: 'numeric' }) : 'по регламенту') + '</b></div>' +
        '<div class="row"><span>Смена шин</span><b>с ' + FB.fmtDate(s.date) + ' — на ' + (s.winter ? 'зимние' : 'летние') + '</b></div>' +
        '<ul class="hist" role="list">' + g.history.slice(0, 4).map(function (h) { return '<li>' + FB.fmtDate(h.date, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + FB.esc(h.service) + ' · ' + FB.esc(h.id) + '</li>'; }).join('') + '</ul>' +
        '<div class="actions"><button class="btn btn--yellow" type="button" data-again="' + i + '">Записаться снова</button>' +
        '<a class="btn btn--ghost" download="tork-shiny.ics" href="' + ics({ time: '10:00' }, 'Пора менять шины — ТОРК', FB.iso(s.date), 'Запишитесь на шиномонтаж: ' + FB.config.phone) + '">Напомнить о шинах</a>' +
        '<button class="btn btn--ghost" type="button" data-del="' + i + '">Удалить</button></div></article>';
    }).join('');
  }
  FB.$('#garage').addEventListener('fb:open', renderGarage);
  FB.$('#gBody').addEventListener('click', function (e) {
    var a = e.target.closest('[data-again]'), d = e.target.closest('[data-del]');
    if (a) {
      var g = garage[+a.getAttribute('data-again')];
      car = { brand: g.brand, model: g.model, year: g.year || '' };
      syncCar();
      FB.$('#bMileage').value = g.mileage || '';
      FB.$('#bPlate').value = g.plate || '';
      FB.modal.close();
      FB.scrollTo('#booking');
      FB.track('repeat_booking');
    }
    if (d && confirm('Удалить автомобиль из гаража?')) { garage.splice(+d.getAttribute('data-del'), 1); FB.store.set('garage', garage); renderGarage(); }
  });

  /* ================================================================ статус и допработы */

  var ST = [['new', 'Запись принята'], ['qualified', 'Авто принято'], ['confirmed', 'Диагностика'], ['in_work', 'В ремонте'], ['done', 'Готово к выдаче']];
  var EXTRA = [['Втулки стабилизатора', 1200], ['Салонный фильтр', 900], ['Передние колодки (износ 80%)', 2600], ['Щётки стеклоочистителя', 1100], ['Промывка форсунок', 2400]];

  function checkStatus() {
    var id = FB.$('#stId').value.trim(), out = FB.$('#stOut');
    if (!id) return;
    out.innerHTML = '<p class="muted">Ищем заказ-наряд…</p>';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.innerHTML = '<p class="st-label">Не нашли ' + FB.esc(id.toUpperCase()) + '</p><p class="muted">Проверьте номер или позвоните: ' + FB.esc(FB.config.phone) + '</p>'; return; }
      var idx = Math.max(0, ST.map(function (s) { return s[0]; }).indexOf(r.status));
      if (r.status === 'repeat') idx = 4;
      var html = '<p class="muted">Заказ-наряд ' + FB.esc(r.id) + '</p><p class="st-label">' + (r.status === 'canceled' ? 'Запись отменена' : ST[idx][1]) + '</p>' +
        '<div class="progress" aria-hidden="true">' + ST.map(function (s, i) { return '<span class="' + (i <= idx ? 'on' : '') + '"></span>'; }).join('') + '</div>';
      if (r.status === 'confirmed' || r.status === 'in_work') {
        var rnd = FB.seeded(r.id), list = EXTRA.filter(function () { return rnd() < 0.5; }).slice(0, 3);
        if (!list.length) list = [EXTRA[0]];
        var approved = FB.store.get('approved', {})[r.id];
        html += approved ? '<div class="extra"><b>Допработы: ' + FB.esc(approved) + '</b></div>' :
          '<div class="extra"><b>Мастер предлагает дополнительно:</b>' + list.map(function (x, i) { return '<label><input type="checkbox" data-x="' + i + '" checked><span>' + x[0] + '</span><em>' + FB.money(x[1]) + '</em></label>'; }).join('') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--yellow" type="button" id="xOk">Согласовать выбранное</button><button class="btn btn--ghost" type="button" id="xNo">Отказаться</button></div></div>';
        out.__extra = list;
      }
      if (idx === 4) html += '<p class="lead">Авто готово. Выдача до 21:00, заказ-наряд и гарантия — в Telegram.</p>';
      if (!FB.lead.isServer()) html += '<p class="muted" style="margin-top:12px">Демо-режим: статусы меняются в CRM-панели при запуске через сервер.</p>';
      out.innerHTML = html;
      out.__id = r.id;
    });
  }
  FB.$('#stForm').addEventListener('submit', function (e) { e.preventDefault(); checkStatus(); });
  FB.$('#stOut').addEventListener('click', function (e) {
    var out = FB.$('#stOut');
    if (e.target.id !== 'xOk' && e.target.id !== 'xNo') return;
    var ok = e.target.id === 'xOk';
    var chosen = ok ? FB.$$('[data-x]:checked', out).map(function (i) { return out.__extra[+i.getAttribute('data-x')]; }) : [];
    var g = garage.filter(function (x) { return x.history.some(function (h) { return h.id === out.__id; }); })[0];
    var text = chosen.length ? chosen.map(function (x) { return x[0] + ' ' + FB.money(x[1]); }).join('; ') : 'отказ от допработ';
    var phone = FB.store.get('lastPhone', '');
    if (!phone) { FB.toast('Согласовать можно по ссылке из SMS или по телефону ' + FB.config.phone, 'error', 6000); return; }
    e.target.disabled = true;
    FB.lead.submit({ type: 'extra_approval', phone: phone, service: 'Согласование допработ', details: { 'Заказ-наряд': out.__id, 'Решение': text, 'Авто': g ? g.brand + ' ' + g.model : '—' } })
      .then(function () { var a = FB.store.get('approved', {}); a[out.__id] = text; FB.store.set('approved', a); FB.toast(ok ? 'Согласовано — мастер продолжает работу' : 'Отказ передан мастеру', 'ok'); checkStatus(); })
      .catch(function (err) { e.target.disabled = false; FB.toast(err.message, 'error'); });
  });
  bkForm.addEventListener('submit', function () { try { FB.store.set('lastPhone', bkForm.phone.value); } catch (e) {} }, true);

  /* ================================================================ закреплённая сцена «визит» */

  var visit = FB.$('#visit'), imgs = FB.$$('[data-scene]'), stepsLi = FB.$$('[data-scene-i]');
  function scene(i) {
    imgs.forEach(function (im) { im.classList.toggle('is-on', +im.getAttribute('data-scene') === i); });
    stepsLi.forEach(function (li) { li.classList.toggle('is-on', +li.getAttribute('data-scene-i') === i); });
  }
  FB.onScroll(function () {
    if (innerWidth <= 900) return;
    var r = visit.getBoundingClientRect(), total = r.height - innerHeight;
    var p = Math.min(0.999, Math.max(0, -r.top / total));
    scene(Math.floor(p * imgs.length));
  });
  if (innerWidth <= 900) {
    // на мобильном — смена кадра по мере появления шагов
    stepsLi.forEach(function (li) { li.classList.add('is-on'); });
  } else scene(0);

  /* ================================================================ старт */

  syncCar();
  renderTire();
  renderSlots();
})();
