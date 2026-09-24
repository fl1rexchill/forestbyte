/* Свежо — калькулятор в первом экране, навигация по видам уборки, чек-листы, заказ в 4 шага
   с зоной выезда и слотами бригад, регулярность со скидкой, повтор заказа, статус и оценка качества. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ тарифы */

  var KIND = {
    support: { name: 'Поддерживающая', rate: 70, min: 2900, h: 0.045 },
    general: { name: 'Генеральная', rate: 140, min: 5900, h: 0.09 },
    repair: { name: 'После ремонта', rate: 190, min: 7900, h: 0.12 }
  };
  var TYPE = { flat: ['Квартира', 1], house: ['Дом', 1.15], office: ['Офис', 0.85], commercial: ['Коммерческое помещение', 1.1] };
  var ROOMS_AREA = { 0: 30, 1: 38, 2: 55, 3: 75, 4: 100 };
  var FREQ = { once: ['Разово', 0], week: ['Раз в неделю', 0.15], '2weeks': ['Раз в 2 недели', 0.1], month: ['Раз в месяц', 0.05] };
  var EXTRAS = [
    ['windows', 'Мойка окон', 'за створку, с двух сторон', 350, 20],
    ['fridge', 'Холодильник внутри', 'с разморозкой — +300 ₽', 900, 2],
    ['oven', 'Духовка внутри', 'нагар и решётки', 900, 2],
    ['hood', 'Вытяжка', 'жир и фильтры', 700, 1],
    ['cabinets', 'Кухонные шкафы внутри', 'с разбором посуды', 1200, 1],
    ['balcony', 'Балкон или лоджия', 'пол, рамы, подоконник', 1500, 2],
    ['ironing', 'Глажка', 'за час', 800, 5],
    ['chandelier', 'Люстра', 'за штуку', 500, 6],
    ['dishes', 'Мытьё посуды', 'до 1 часа', 500, 1],
    ['sofa', 'Химчистка дивана', 'за посадочное место ×3', 3500, 3],
    ['mattress', 'Химчистка матраса', 'одна сторона', 2900, 3],
    ['pets', 'После животных', 'шерсть, лотки, запах', 700, 1]
  ];
  var ZONES = [
    ['Центральный', 0], ['Железнодорожный', 0], ['Заельцовский', 0], ['Дзержинский', 0], ['Октябрьский', 0], ['Ленинский', 0],
    ['Кировский', 0], ['Калининский', 0], ['Первомайский', 300], ['Советский (Академгородок)', 500], ['Краснообск', 500],
    ['Кольцово', 600], ['Обь', 700], ['Бердск', 800]
  ];
  var NOT_SERVED = ['искитим', 'тогучин', 'коченево', 'черепаново'];
  var SLOTS = ['09:00', '12:00', '15:00', '18:00'];

  var SERVICES = [
    { id: 'support', name: 'Поддерживающая', img: 'flat', text: 'Чтобы дома было чисто каждую неделю: пыль, полы, зеркала, кухня и санузел.', specs: [['Цена', 'от 2 900 ₽'], ['Время', '2–4 часа'], ['Бригада', '1 клинер'], ['Для кого', 'квартиры до 80 м²']], kind: 'support' },
    { id: 'general', name: 'Генеральная', img: 'general', text: 'Раз в сезон: отмываем всё до деталей — двери, батареи, плитку, фасады и технику снаружи.', specs: [['Цена', 'от 5 900 ₽'], ['Время', '5–8 часов'], ['Бригада', '2–3 клинера'], ['Включено', 'всё из поддерживающей']], kind: 'general' },
    { id: 'repair', name: 'После ремонта', img: 'repair', text: 'Строительная пыль, затирка на плитке, брызги краски и пены. Промышленный пылесос.', specs: [['Цена', 'от 7 900 ₽'], ['Время', '6–10 часов'], ['Бригада', '2–4 клинера'], ['Средства', 'кислотные и щелочные']], kind: 'repair' },
    { id: 'windows', name: 'Мойка окон', img: 'windows', text: 'Стёкла, рамы, подоконники и отливы с двух сторон. Высотные работы — промальпинисты с допуском.', specs: [['Цена', '350 ₽ за створку'], ['Время', '15 минут на створку'], ['Минимум', '2 900 ₽'], ['Высота', 'до 25 этажа']], kind: 'support', extra: ['windows', 6] },
    { id: 'office', name: 'Офисы', img: 'office', text: 'Ежедневно или раз в неделю, до или после рабочего дня. Договор, счёт и акт — автоматически.', specs: [['Цена', 'от 55 ₽/м²'], ['График', 'любой, 24/7'], ['Документы', 'договор, акт, счёт'], ['Скидка', 'до 15% регулярно']], kind: 'support', type: 'office' },
    { id: 'sofa', name: 'Химчистка мебели', img: 'sofa', text: 'Диваны, кресла, матрасы и ковры экстрактором. Высыхает за 4–6 часов, без запаха химии.', specs: [['Цена', 'от 3 500 ₽'], ['Время', '1–2 часа'], ['Сушка', '4–6 часов'], ['Средства', 'гипоаллергенные']], kind: 'support', extra: ['sofa', 1] }
  ];

  var ROOMS = {
    kitchen: [['Пыль со всех поверхностей и техники снаружи', 0], ['Мойка и столешница, смеситель до блеска', 0], ['Плита и фартук', 0], ['Полы и плинтусы', 0], ['Вынос мусора', 0], ['Фасады шкафов снаружи', 1], ['Микроволновка внутри', 1], ['Плитка на стенах целиком', 1], ['Батареи и трубы', 1]],
    rooms: [['Пыль с открытых поверхностей', 0], ['Полы: пылесос и влажная уборка', 0], ['Зеркала и стеклянные поверхности', 0], ['Заправить кровать, сложить вещи', 0], ['Двери и дверные ручки', 1], ['Плинтусы и выключатели', 1], ['Подоконники и батареи', 1], ['Пыль на верху шкафов', 1], ['Под кроватью и за диваном', 1]],
    bath: [['Раковина, ванна или душ', 0], ['Унитаз снаружи и внутри', 0], ['Зеркало и смеситель', 0], ['Полы', 0], ['Налёт и известковый камень', 1], ['Швы плитки щёткой', 1], ['Шкафчики и полки снаружи', 1], ['Вентиляционная решётка', 1]],
    hall: [['Полы и коврик', 0], ['Зеркало', 0], ['Обувь расставить', 0], ['Входная дверь с двух сторон', 1], ['Шкаф снаружи и плинтусы', 1], ['Светильники', 1]]
  };

  /* ================================================================ расчёт */

  function calc(o) {
    var k = KIND[o.kind] || KIND.support, t = TYPE[o.type] || TYPE.flat;
    var base = Math.max(k.min, o.area * k.rate * t[1]);
    base = Math.round(base / 100) * 100;
    var lines = [[k.name + ', ' + o.area + ' м²', base]], extra = 0, extraH = 0;
    EXTRAS.forEach(function (e) {
      var q = (o.extras || {})[e[0]] || 0;
      if (q) { lines.push([e[1] + (q > 1 ? ' ×' + q : ''), e[3] * q]); extra += e[3] * q; extraH += q * (e[0] === 'windows' ? 0.25 : e[0] === 'ironing' ? 1 : 0.6); }
    });
    var sub = base + extra, disc = Math.round(sub * FREQ[o.freq || 'once'][1] / 10) * 10;
    var zone = ZONES.filter(function (z) { return z[0] === o.zone; })[0], fee = zone ? zone[1] : 0;
    var hours = o.area * k.h * (o.type === 'house' ? 1.1 : 1) + extraH;
    var team = Math.min(5, Math.max(1, Math.ceil(hours / 5)));
    var dur = Math.max(1.5, Math.round(hours / team * 2) / 2);
    return { lines: lines, sub: sub, disc: disc, fee: fee, total: sub - disc + fee, team: team, dur: dur };
  }
  function durText(h) { return (h % 1 ? String(h).replace('.', ',') : h) + ' ' + FB.plural(Math.ceil(h), ['час', 'часа', 'часов']); }
  function teamText(n) { return n + ' ' + FB.plural(n, ['клинер', 'клинера', 'клинеров']); }

  function animateNum(el, to, key) {
    var from = el[key] || 0;
    el[key] = to;
    if (!FB.anime || FB.reduced || !from) { el.textContent = FB.money(to); return; }
    var o = { v: from };
    FB.anime.animate(o, { v: to, duration: 450, ease: 'outCubic', onUpdate: function () { el.textContent = FB.money(o.v); } });
  }

  /* ================================================================ быстрый расчёт в hero */

  var qType = FB.$('#qType'), qKind = FB.$('#qKind'), qArea = FB.$('#qArea');
  function quick() {
    FB.$('#qAreaOut').textContent = qArea.value + ' м²';
    var r = calc({ type: qType.value, kind: qKind.value, area: +qArea.value, freq: 'once' });
    animateNum(FB.$('#qPrice'), r.total, '_v');
    FB.$('#qMeta').textContent = teamText(r.team) + ' · ≈ ' + durText(r.dur) + ' · средства и техника включены';
  }
  [qType, qKind, qArea].forEach(function (el) { el.addEventListener('input', quick); el.addEventListener('change', quick); });
  FB.$('#qGo').addEventListener('click', function () {
    openOrder({ type: qType.value, kind: qKind.value, area: +qArea.value }, this, 2);
    FB.track('click_primary_cta', { from: 'hero_calc' });
  });
  (function nearest() {
    var days = FB.days(4), i = 0;
    (function next() {
      if (i >= days.length) { FB.$('#qSlot').textContent = 'Ближайшие окна — в оформлении заказа'; return; }
      var d = FB.iso(days[i]);
      FB.lead.busy('brigade', d, SLOTS, 0.3).then(function (busy) {
        var t = SLOTS.filter(function (s) { return busy.indexOf(s) < 0 && !FB.isPastSlot(d, s); })[0];
        if (t) FB.$('#qSlot').textContent = 'Свободная бригада: ' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.fmtDate(d)) + ' с ' + t;
        else { i++; next(); }
      });
    })();
  })();

  /* ================================================================ навигация по видам уборки (Duten) */

  var list = FB.$('#svcList'), stage = FB.$('#svcStage'), info = FB.$('#svcInfo');
  FB.$('#svcTotal').textContent = String(SERVICES.length).padStart(2, '0');
  list.innerHTML = SERVICES.map(function (s, i) {
    return '<li role="presentation"><button type="button" role="tab" id="svc-' + s.id + '" aria-controls="svcInfo" aria-selected="' + (i === 0) + '"><small>0' + (i + 1) + '</small>' + s.name + '</button></li>';
  }).join('');
  stage.innerHTML = SERVICES.map(function (s, i) { return '<img src="img/' + s.img + '.webp" alt="" data-svc="' + s.id + '"' + (i === 0 ? ' class="is-on"' : '') + ' loading="' + (i === 0 ? 'eager' : 'lazy') + '">'; }).join('');
  var curSvc = SERVICES[0];
  function showSvc(s) {
    var prev = FB.$('img.is-on', stage), next = FB.$('img[data-svc="' + s.id + '"]', stage);
    if (prev !== next) {
      FB.$$('img', stage).forEach(function (im) { im.classList.remove('is-out'); });
      if (prev) { prev.classList.remove('is-on'); prev.classList.add('is-out'); }
      next.classList.add('is-on');
    }
    curSvc = s;
    FB.$('#svcNum').textContent = String(SERVICES.indexOf(s) + 1).padStart(2, '0');
    info.innerHTML = '<h3>' + s.name + '</h3><p>' + s.text + '</p><dl class="svc__specs">' + s.specs.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<button class="btn btn--dark" type="button" id="svcCalc">Рассчитать ' + s.name.toLowerCase() + ' →</button>';
    FB.track('view_service', { id: s.id });
  }
  FB.tabs(list, function (tab) { showSvc(SERVICES.filter(function (s) { return 'svc-' + s.id === tab.id; })[0]); });
  info.addEventListener('click', function (e) {
    if (e.target.id !== 'svcCalc') return;
    var ex = {};
    if (curSvc.extra) ex[curSvc.extra[0]] = curSvc.extra[1];
    openOrder({ kind: curSvc.kind, type: curSvc.type || 'flat', extras: ex }, e.target, 0);
  });

  /* ================================================================ что входит */

  var inclKind = 'support', room = 'kitchen';
  function renderIncl() {
    var items = ROOMS[room];
    FB.$('#roomPanel').innerHTML = '<ul role="list">' + items.slice(0, Math.ceil(items.length / 2)).map(li).join('') + '</ul><ul role="list">' + items.slice(Math.ceil(items.length / 2)).map(li).join('') + '</ul>';
    function li(it, i) {
      var on = !it[1] || inclKind === 'general';
      return '<li class="' + (on ? '' : 'gen') + '" style="--i:' + i + '"><span class="tick" aria-hidden="true">' + (on ? '✓' : '—') + '</span><span>' + it[0] + (it[1] && !on ? '<em>в генеральной</em>' : '') + '</span></li>';
    }
  }
  FB.tabs(FB.$('#roomTabs'), function (t) { room = t.id.slice(2); renderIncl(); });
  FB.$$('input[name=inclKind]').forEach(function (r) { r.addEventListener('change', function () { inclKind = r.value; renderIncl(); }); });

  /* ================================================================ регулярные планы */

  (function plans() {
    var base = calc({ type: 'flat', kind: 'support', area: 55, freq: 'once' }).total;
    FB.$('#plans').innerHTML = Object.keys(FREQ).map(function (f) {
      var p = Math.round(base * (1 - FREQ[f][1]) / 10) * 10;
      return '<article class="plan' + (f === '2weeks' ? ' plan--hit' : '') + '">' + (f === '2weeks' ? '<span class="plan__tag">Чаще выбирают</span>' : '') +
        '<h3>' + FREQ[f][0] + '</h3><p class="plan__price">' + FB.money(p) + (FREQ[f][1] ? '<s>' + FB.money(base) + '</s>' : '') + '</p>' +
        '<p>' + (f === 'once' ? 'Двушка 55 м², поддерживающая уборка.' : 'Скидка ' + FREQ[f][1] * 100 + '% на каждый визит, фиксированная бригада и день недели.') + '</p>' +
        '<button class="btn btn--line btn--sm" type="button" data-freq="' + f + '">Выбрать</button></article>';
    }).join('');
    FB.$('#plans').addEventListener('click', function (e) { var b = e.target.closest('[data-freq]'); if (b) openOrder({ freq: b.getAttribute('data-freq') }, b, 0); });
  })();

  /* ================================================================ районы */

  FB.$('#zonesList').innerHTML = ZONES.map(function (z) { return '<li>' + z[0] + '<span>' + (z[1] ? '+' + FB.money(z[1]) : 'бесплатно') + '</span></li>'; }).join('');
  FB.$('#zoneList').innerHTML = ZONES.map(function (z) { return '<option value="' + z[0] + '">'; }).join('');
  function findZone(q) {
    q = q.trim().toLowerCase().replace('ё', 'е');
    if (!q) return null;
    if (NOT_SERVED.some(function (n) { return q.indexOf(n) >= 0; })) return 'no';
    if (/академ/.test(q)) q = 'советский';
    return ZONES.filter(function (z) { return z[0].toLowerCase().replace('ё', 'е').indexOf(q) >= 0 || q.indexOf(z[0].toLowerCase().split(' ')[0]) >= 0; })[0] || 'unknown';
  }
  FB.$('#zoneForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var z = findZone(FB.$('#zoneQ').value), out = FB.$('#zoneOut');
    out.className = 'zone-out';
    if (!z) { out.textContent = 'Введите район или город.'; return; }
    if (z === 'no') { out.classList.add('bad'); out.textContent = 'Пока не выезжаем. Оставьте заявку — сообщим, когда появится бригада рядом.'; return; }
    if (z === 'unknown') { out.textContent = 'Такого района нет в списке — напишите в Telegram, проверим адрес вручную.'; return; }
    out.classList.add('ok');
    out.textContent = z[0] + ': выезжаем, ' + (z[1] ? 'доплата за дорогу ' + FB.money(z[1]) : 'выезд бесплатный') + '.';
    FB.track('check_zone', { zone: z[0] });
  });

  /* ================================================================ оформление заказа */

  var of = FB.$('#orderForm'), steps = FB.$$('.ostep', of), navLis = FB.$$('#oSteps li'), step = 0;
  var extras = {};
  FB.$('#oZone').innerHTML = '<option value="">Выберите район</option>' + ZONES.map(function (z) { return '<option>' + z[0] + '</option>'; }).join('');
  FB.$('#extras').innerHTML = EXTRAS.map(function (e) {
    return '<div class="extra" data-ex="' + e[0] + '"><div class="extra__t">' + e[1] + '<small>' + FB.money(e[3]) + ' · ' + e[2] + '</small></div>' +
      '<div class="stepper"><button type="button" data-d="-1" aria-label="Меньше: ' + e[1] + '">−</button><output>0</output><button type="button" data-d="1" aria-label="Больше: ' + e[1] + '">+</button></div></div>';
  }).join('');
  FB.$('#extras').addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]');
    if (!b) return;
    var box = b.closest('[data-ex]'), id = box.getAttribute('data-ex'), def = EXTRAS.filter(function (x) { return x[0] === id; })[0];
    extras[id] = Math.max(0, Math.min(def[4], (extras[id] || 0) + +b.getAttribute('data-d')));
    if (!extras[id]) delete extras[id];
    renderExtras();
    renderSum();
  });
  function renderExtras() {
    FB.$$('[data-ex]').forEach(function (box) {
      var id = box.getAttribute('data-ex'), q = extras[id] || 0, def = EXTRAS.filter(function (x) { return x[0] === id; })[0];
      box.querySelector('output').textContent = q;
      box.classList.toggle('is-on', q > 0);
      box.querySelector('[data-d="-1"]').disabled = !q;
      box.querySelector('[data-d="1"]').disabled = q >= def[4];
    });
  }

  function state() {
    var fd = new FormData(of);
    return { type: fd.get('type'), rooms: fd.get('rooms'), area: +fd.get('area'), kind: fd.get('kind'), freq: fd.get('freq'), extras: extras, zone: fd.get('zone') };
  }
  function renderSum() {
    var s = state(), r = calc(s);
    FB.$('#oAreaOut').textContent = s.area + ' м²';
    FB.$('#roomsField').hidden = s.type !== 'flat';
    FB.$('#oSum').innerHTML = '<h3>Ваш заказ</h3><ul class="sum-list" role="list">' + r.lines.map(function (l) { return '<li><span>' + l[0] + '</span><span>' + FB.money(l[1]) + '</span></li>'; }).join('') +
      (r.disc ? '<li><span>' + FREQ[s.freq][0] + ' −' + FREQ[s.freq][1] * 100 + '%</span><span>−' + FB.money(r.disc) + '</span></li>' : '') +
      (r.fee ? '<li><span>Выезд: ' + s.zone + '</span><span>' + FB.money(r.fee) + '</span></li>' : '') + '</ul>' +
      '<div class="sum-total"><small>Итого' + (s.freq !== 'once' ? ' за визит' : '') + '</small><strong id="sumTotal"></strong></div>' +
      '<p class="sum-work">Бригада: <b>' + teamText(r.team) + '</b><br>Длительность: <b>≈ ' + durText(r.dur) + '</b><br>' + TYPE[s.type][0] + ', ' + KIND[s.kind].name.toLowerCase() + '</p>' +
      '<p class="hint">Цена фиксируется. Средства, техника и выезд по городу включены.</p>';
    var el = FB.$('#sumTotal');
    el._v = FB.$('#oSum')._last || 0;
    animateNum(el, r.total, '_v');
    FB.$('#oSum')._last = r.total;
  }
  of.addEventListener('input', renderSum);
  of.addEventListener('change', function (e) {
    if (e.target.name === 'rooms') { FB.$('#oArea').value = ROOMS_AREA[e.target.value]; }
    if (e.target.name === 'zone') {
      var z = ZONES.filter(function (x) { return x[0] === e.target.value; })[0];
      FB.$('#oZoneInfo').textContent = z ? (z[1] ? 'Доплата за выезд ' + FB.money(z[1]) : 'Выезд бесплатный') : '';
    }
    renderSum();
  });

  function goStep(n) {
    step = n;
    steps.forEach(function (s, i) { s.hidden = i !== n; });
    navLis.forEach(function (li, i) { li.classList.toggle('is-on', i === n); li.classList.toggle('is-done', i < n); });
    FB.$('#oBack').hidden = n === 0;
    FB.$('#oNext').hidden = n === steps.length - 1;
    FB.$('#oSubmit').hidden = n !== steps.length - 1;
    FB.$('[data-form-error]', of).textContent = '';
    if (n === 2) renderSlots();
    var dlg = FB.$('#order .fb-modal__dialog');
    if (dlg) dlg.scrollTop = 0;
  }
  FB.$('#oNext').addEventListener('click', function () {
    if (!FB.validate(steps[step])) return;
    if (step === 2 && !FB.$('input[name=time]:checked', of)) { FB.$('[data-form-error]', of).textContent = 'Выберите время начала уборки.'; return; }
    goStep(step + 1);
    FB.track('order_step', { step: step });
  });
  FB.$('#oBack').addEventListener('click', function () { goStep(step - 1); });
  of.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && step < steps.length - 1) { e.preventDefault(); FB.$('#oNext').click(); } });

  FB.$('#oDays').innerHTML = FB.days(10).map(function (d, i) {
    return '<label><input type="radio" name="date" value="' + FB.iso(d) + '"' + (i === 0 ? ' checked' : '') + '><span>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.weekday(d, true)) + '<b>' + d.getDate() + '</b></span></label>';
  }).join('');
  FB.$('#oDays').addEventListener('change', function () { renderSlots(); FB.track('select_date'); });
  function renderSlots() {
    var date = (FB.$('input[name=date]:checked', of) || {}).value, box = FB.$('#oSlots');
    var dur = calc(state()).dur;
    box.innerHTML = '<span class="hint">Проверяем бригады…</span>';
    FB.lead.busy('brigade', date, SLOTS, 0.3).then(function (busy) {
      var free = 0;
      box.innerHTML = SLOTS.map(function (t) {
        var dis = busy.indexOf(t) >= 0 || FB.isPastSlot(date, t) || (+t.slice(0, 2) + dur > 22);
        if (!dis) free++;
        return '<label><input type="radio" name="time" value="' + t + '"' + (dis ? ' disabled' : '') + '><span>' + t + '<small>' + (dis ? 'занято' : 'до ≈' + String(Math.ceil(+t.slice(0, 2) + dur)).padStart(2, '0') + ':00') + '</small></span></label>';
      }).join('') + (free ? '' : '<span class="hint">Этот день занят — выберите другой.</span>');
    });
  }
  FB.files(FB.$('#oFiles'), { max: 6, maxSize: 10 * 1024 * 1024, list: FB.$('#oFileList') });

  function setRadio(name, val) { var r = FB.$('input[name=' + name + '][value="' + val + '"]', of); if (r) r.checked = true; }
  function openOrder(preset, opener, startStep) {
    preset = preset || {};
    if (!FB.$('#oDone').hidden) { FB.$('#oDone').hidden = true; of.hidden = false; FB.$('#oSum').hidden = false; }
    if (preset.type) setRadio('type', preset.type);
    if (preset.kind) setRadio('kind', preset.kind);
    if (preset.freq) setRadio('freq', preset.freq);
    if (preset.area) FB.$('#oArea').value = preset.area;
    if (preset.extras) { extras = Object.assign({}, preset.extras); renderExtras(); }
    var last = FB.store.get('lastOrder', null), rb = FB.$('#repeatBox');
    rb.hidden = !last;
    if (last) rb.innerHTML = '<span>Прошлый заказ: ' + KIND[last.kind].name.toLowerCase() + ', ' + last.area + ' м², ' + FB.esc(last.address) + '</span><button type="button" id="repeatBtn">Повторить в один клик</button>';
    renderSum();
    goStep(startStep || 0);
    FB.modal.open('order', opener);
    FB.track('start_form', { form: 'order' });
  }
  FB.$$('[data-open="order"]').forEach(function (b) {
    b.removeAttribute('data-open');
    b.addEventListener('click', function () { openOrder({}, b, 0); });
  });
  FB.$('#repeatBox').addEventListener('click', function (e) {
    if (e.target.id !== 'repeatBtn') return;
    var l = FB.store.get('lastOrder', null);
    if (!l) return;
    setRadio('type', l.type); setRadio('kind', l.kind); setRadio('freq', l.freq); setRadio('lift', l.lift); if (l.rooms) setRadio('rooms', l.rooms);
    FB.$('#oArea').value = l.area;
    extras = Object.assign({}, l.extras || {}); renderExtras();
    of.zone.value = l.zone; of.address.value = l.address; of.floor.value = l.floor || ''; of.access.value = l.access || '';
    of.name.value = l.name; of.phone.value = l.phone;
    of.zone.dispatchEvent(new Event('change', { bubbles: true }));
    renderSum();
    goStep(2);
    FB.toast('Заполнили как в прошлый раз — выберите дату и время', 'ok');
    FB.track('repeat_booking');
  });

  FB.form(of, {
    type: 'cleaning_order',
    before: function () { return step === steps.length - 1 ? true : 'Пройдите все шаги'; },
    collect: function (fd) {
      var s = state(), r = calc(s);
      return {
        service: KIND[s.kind].name + ' уборка, ' + s.area + ' м²', resource: 'brigade', date: fd.get('date'), time: fd.get('time'),
        address: fd.get('zone') + ', ' + fd.get('address'), total: FB.money(r.total),
        details: {
          'Объект': TYPE[s.type][0] + (s.type === 'flat' ? ', комнат: ' + (s.rooms === '0' ? 'студия' : s.rooms) : ''), 'Периодичность': FREQ[s.freq][0],
          'Допуслуги': EXTRAS.filter(function (e) { return extras[e[0]]; }).map(function (e) { return e[1] + ' ×' + extras[e[0]]; }).join(', ') || 'нет',
          'Бригада и время': teamText(r.team) + ', ≈ ' + durText(r.dur), 'Этаж / лифт': (fd.get('floor') || '—') + ' / ' + fd.get('lift'),
          'Доступ': fd.get('access') || '—', 'Оплата': { after: 'после уборки', online: 'онлайн заранее', invoice: 'счёт для юрлица' }[fd.get('pay')]
        }
      };
    },
    success: function (res, p) {
      var s = state(), r = calc(s);
      FB.store.set('lastOrder', { type: s.type, rooms: p.rooms, area: s.area, kind: s.kind, freq: s.freq, extras: extras, zone: of.zone.value, address: of.address.value, floor: p.floor, lift: p.lift, access: p.access, name: p.name, phone: p.phone });
      var mine = FB.store.get('orders', []); mine.unshift({ id: res.id, date: p.date, time: p.time, name: p.name, phone: p.phone }); FB.store.set('orders', mine.slice(0, 10));
      FB.track('booking_confirmed', { id: res.id, total: r.total });
      of.hidden = true; FB.$('#oSum').hidden = true;
      var d = FB.$('#oDone');
      d.hidden = false;
      d.innerHTML = '<p class="eyebrow">Заказ принят</p><div class="num">' + FB.esc(res.id) + '</div>' +
        '<p class="lead" style="margin:0">' + FB.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ', начало в ' + p.time + '. ' + teamText(r.team) + ', ≈ ' + durText(r.dur) + '. Итого ' + FB.money(r.total) + (s.freq !== 'once' ? ' за визит' : '') + '.</p>' +
        '<p class="hint">Подтвердим в течение 15 минут. Бригада позвонит за час и приедет в окне ±30 минут.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn--accent" download="svezho-uborka.ics" href="' + ics(p, r) + '">Добавить в календарь</a><a class="btn btn--line" target="_blank" rel="noopener" href="' + FB.tgLink('Заказ ' + res.id) + '">Telegram</a><a class="btn btn--line" href="#status" id="toStatus" data-id="' + FB.esc(res.id) + '">Статус заказа</a></div>';
      extras = {}; renderExtras();
    }
  });
  FB.$('#oDone').addEventListener('click', function (e) { if (e.target.id === 'toStatus') { FB.$('#stId').value = e.target.getAttribute('data-id'); checkStatus(); } });

  function ics(p, r) {
    var d = p.date.replace(/-/g, ''), t = p.time.replace(':', '') + '00';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Svezho//RU', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@svezho', 'DTSTAMP:' + stamp, 'DTSTART:' + d + 'T' + t,
      'DURATION:PT' + Math.ceil(r.dur) + 'H', 'SUMMARY:Уборка «Свежо»', 'LOCATION:' + (p.zone + '\\, ' + p.address).replace(/,/g, '\\,'), 'DESCRIPTION:Бригада: ' + teamText(r.team),
      'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра уборка «Свежо»', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ статус и оценка */

  var ST = [['new', 'Принят'], ['qualified', 'Подтверждён'], ['confirmed', 'Бригада назначена'], ['in_work', 'Уборка идёт'], ['done', 'Готово']];
  var rating = 0;
  function checkStatus() {
    var id = FB.$('#stId').value.trim(), out = FB.$('#stOut');
    if (!id) return;
    out.innerHTML = '<div class="st-card"><span class="hint">Ищем заказ…</span></div>';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.innerHTML = '<div class="st-card">Заказ ' + FB.esc(id.toUpperCase()) + ' не найден. Проверьте номер.</div>'; return; }
      var i = Math.max(0, ST.map(function (s) { return s[0]; }).indexOf(r.status === 'repeat' ? 'done' : r.status));
      var mine = FB.store.get('orders', []).filter(function (o) { return o.id === r.id; })[0];
      var rated = FB.store.get('rated', {})[r.id];
      var html = '<div class="st-card"><b>' + FB.esc(r.id) + '</b><ol class="st-steps" role="list">' + ST.map(function (s, k) { return '<li class="' + (k <= i ? 'on' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>';
      if (r.status === 'canceled') html += '<p>Заказ отменён.</p>';
      else if (i === 4) {
        html += rated ? '<p>Спасибо за оценку: ' + '★'.repeat(rated) + '</p>' : !mine ? '<p class="hint">Оценить уборку можно с устройства, с которого оформляли заказ.</p>' :
          '<p>Как прошла уборка?</p><div class="stars" role="radiogroup" aria-label="Оценка">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" aria-label="' + n + ' из 5">★</button>'; }).join('') + '</div>' +
          '<div class="field"><label for="rText">Что улучшить? <span class="opt">необязательно</span></label><textarea id="rText" rows="2"></textarea></div>' +
          '<button class="btn btn--dark btn--sm" type="button" id="rSend" disabled>Отправить оценку</button>';
      } else html += '<p class="hint">Напомним за 12 часов до уборки. Перенос бесплатно — не позже чем за 12 часов.</p>';
      if (!FB.lead.isServer()) html += '<p class="hint">Демо-режим: статусы меняются в CRM-панели при запуске через сервер.</p>';
      out.innerHTML = html + '</div>';
      out.__id = r.id;
    });
  }
  FB.$('#stForm').addEventListener('submit', function (e) { e.preventDefault(); checkStatus(); });
  FB.$('#stOut').addEventListener('click', function (e) {
    var st = e.target.closest('[data-star]');
    if (st) {
      rating = +st.getAttribute('data-star');
      FB.$$('[data-star]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-star') <= rating); });
      FB.$('#rSend').disabled = false;
      return;
    }
    if (e.target.id === 'rSend') {
      var id = FB.$('#stOut').__id, mine = FB.store.get('orders', []).filter(function (o) { return o.id === id; })[0] || {};
      e.target.disabled = true;
      FB.lead.submit({ type: 'quality_rating', name: mine.name, phone: mine.phone, service: 'Оценка уборки', details: { 'Заказ': id, 'Оценка': rating + ' из 5', 'Комментарий': FB.$('#rText').value || '—' } })
        .then(function () {
          var r = FB.store.get('rated', {}); r[id] = rating; FB.store.set('rated', r);
          FB.toast(rating <= 3 ? 'Спасибо! Менеджер свяжется и предложит бесплатную переделку' : 'Спасибо за оценку!', 'ok', 6000);
          checkStatus();
        })
        .catch(function (err) { e.target.disabled = false; FB.toast(err.message, 'error'); });
    }
  });

  /* ================================================================ параллакс */

  var par = FB.$('[data-parallax]');
  if (par && !FB.reduced) FB.onScroll(function () {
    var r = par.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    par.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - innerHeight / 2) * -0.12) + 'px,0)';
  });

  /* ================================================================ старт */

  quick();

  renderIncl();
  renderExtras();
  renderSum();
})();
