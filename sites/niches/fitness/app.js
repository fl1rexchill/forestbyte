/* Линия — логика сайта: расписание и запись, лист ожидания, абонементы, личный кабинет. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочники */

  var DIRS = {
    barre:   { name: 'Барре',          dur: 55, cap: 10 },
    pilates: { name: 'Пилатес',        dur: 55, cap: 10 },
    func:    { name: 'Функциональный', dur: 45, cap: 12 },
    stretch: { name: 'Растяжка',       dur: 60, cap: 10 }
  };

  var COACHES = [
    { id: 'anna',   name: 'Анна Соколова', with: 'Анной', role: 'Барре и пилатес', img: 'img/t1.webp',
      text: 'Сертификат Balanced Body, 8 лет опыта. Ведёт группы для мам после родов — с разрешения врача.' },
    { id: 'ilya',   name: 'Илья Громов', with: 'Ильёй', role: 'Функциональный тренинг', img: 'img/t2.webp',
      text: 'КМС по лёгкой атлетике, 10 лет тренерского стажа. Строит нагрузку от вашего уровня, без «через не могу».' },
    { id: 'karina', name: 'Карина Адебайо', with: 'Кариной', role: 'Растяжка и барре', img: 'img/t3.webp',
      text: 'Бывшая артистка балета. Помогает мягко вернуть подвижность спине и тазобедренным.' }
  ];
  var coachById = {};
  COACHES.forEach(function (c) { coachById[c.id] = c; });

  // Шаблон недели: день (1=пн … 7=вс) → [время, направление, тренер]
  var WEEK = {
    1: [['07:30', 'func', 'ilya'], ['09:00', 'barre', 'anna'], ['12:00', 'pilates', 'anna'], ['18:00', 'barre', 'karina'], ['19:10', 'func', 'ilya'], ['20:20', 'stretch', 'karina']],
    2: [['07:30', 'pilates', 'anna'], ['10:00', 'stretch', 'karina'], ['12:00', 'barre', 'anna'], ['18:00', 'func', 'ilya'], ['19:10', 'barre', 'karina'], ['20:20', 'pilates', 'anna']],
    3: [['07:30', 'barre', 'anna'], ['09:00', 'func', 'ilya'], ['12:00', 'stretch', 'karina'], ['18:00', 'pilates', 'anna'], ['19:10', 'barre', 'karina'], ['20:20', 'func', 'ilya']],
    4: [['07:30', 'func', 'ilya'], ['10:00', 'pilates', 'anna'], ['12:00', 'barre', 'karina'], ['18:00', 'barre', 'anna'], ['19:10', 'stretch', 'karina'], ['20:20', 'func', 'ilya']],
    5: [['07:30', 'pilates', 'anna'], ['09:00', 'barre', 'karina'], ['12:00', 'func', 'ilya'], ['18:00', 'stretch', 'karina'], ['19:10', 'barre', 'anna'], ['20:20', 'pilates', 'anna']],
    6: [['09:00', 'func', 'ilya'], ['10:10', 'barre', 'anna'], ['11:20', 'pilates', 'anna'], ['12:30', 'stretch', 'karina']],
    7: [['09:00', 'barre', 'karina'], ['10:10', 'stretch', 'karina'], ['11:20', 'func', 'ilya'], ['12:30', 'pilates', 'anna']]
  };

  var PLANS = [
    { id: 'single', name: 'Разовое',    desc: 'Одно занятие любого направления', price: 1200,  visits: 1,   freeze: 0 },
    { id: 'p8',     name: '8 занятий',  desc: 'Два раза в неделю — оптимально для старта', price: 7900, visits: 8, freeze: 7 },
    { id: 'p12',    name: '12 занятий', desc: 'Три раза в неделю — для заметного результата', price: 10400, visits: 12, freeze: 14, hit: true },
    { id: 'unlim',  name: 'Безлимит',   desc: 'Сколько угодно занятий в любое время', price: 13900, visits: 0, freeze: 30 }
  ];
  var PROMO = { LINIYA10: { pct: 10, text: 'Скидка 10% применена' }, FRIEND: { minus: 500, text: 'Скидка 500 ₽ от подруги применена' } };

  var ADDRESS = 'Москва, Комсомольский пр-т, 28, 2 этаж';

  /* ================================================================ состояние */

  var bookings = FB.store.get('bookings', []);     // мои записи
  var membership = FB.store.get('membership', null);
  var profile = FB.store.get('profile', {});
  function save() {
    FB.store.set('bookings', bookings);
    FB.store.set('membership', membership);
    FB.store.set('profile', profile);
  }

  /* ================================================================ расписание */

  function weekday(d) { return d.getDay() === 0 ? 7 : d.getDay(); }
  function addMin(t, m) {
    var p = t.split(':'), x = +p[0] * 60 + +p[1] + m;
    return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
  }

  function classesFor(date) {
    var iso = FB.iso(date);
    return (WEEK[weekday(date)] || []).map(function (row) {
      var dir = DIRS[row[1]], key = iso + '_' + row[0] + '_' + row[1];
      var rnd = FB.seeded('fit|' + key)();
      var taken = Math.min(dir.cap, Math.round(dir.cap * (0.35 + rnd * 0.75))); // часть групп заполнена целиком
      var mine = bookings.filter(function (b) { return b.key === key && b.status === 'booked'; }).length;
      var left = Math.max(0, dir.cap - taken - mine);
      return {
        key: key, date: iso, time: row[0], end: addMin(row[0], dir.dur), dirId: row[1], dir: dir,
        coach: coachById[row[2]], left: left, past: FB.isPastSlot(iso, row[0]),
        my: bookings.filter(function (b) { return b.key === key && b.status !== 'canceled'; })[0] || null
      };
    });
  }

  var days = FB.days(7);
  var curDay = 0;
  var fDir = FB.$('#fDir'), fCoach = FB.$('#fCoach'), fTime = FB.$('#fTime');
  COACHES.forEach(function (c) {
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; fCoach.appendChild(o);
  });

  var daysBox = FB.$('#days');
  days.forEach(function (d, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.setAttribute('role', 'tab');
    b.id = 'day-' + i;
    b.setAttribute('aria-controls', 'classes');
    b.innerHTML = '<small>' + (i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : FB.esc(FB.weekday(d, true))) + '</small><b>' +
      d.getDate() + '</b><small>' + FB.esc(d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')) + '</small>';
    daysBox.appendChild(b);
  });
  FB.tabs(daysBox, function (tab) { curDay = +tab.id.split('-')[1]; renderClasses(); });

  function timeBucket(t) { var h = +t.split(':')[0]; return h < 12 ? 'morning' : h < 17 ? 'day' : 'evening'; }

  function renderClasses() {
    var list = classesFor(days[curDay]).filter(function (c) {
      return (!fDir.value || c.dirId === fDir.value) && (!fCoach.value || c.coach.id === fCoach.value) && (!fTime.value || timeBucket(c.time) === fTime.value);
    });
    var box = FB.$('#classes');
    if (!list.length) {
      box.innerHTML = '<div class="empty">В этот день нет подходящих занятий. Попробуйте другой день или сбросьте фильтры.</div>';
      return;
    }
    box.innerHTML = list.map(function (c, i) {
      var spots, btn;
      if (c.past) {
        spots = '<span class="cls__spots">Занятие прошло</span>';
        btn = '<button class="btn btn--ghost btn--sm" type="button" disabled>Прошло</button>';
      } else if (c.my) {
        spots = '<span class="cls__spots">' + (c.my.status === 'waitlist' ? 'Вы в листе ожидания' : 'Место за вами') + '</span>';
        btn = '<button class="btn btn--ghost btn--sm" type="button" data-open="cabinet">Моя запись</button>';
      } else if (c.left === 0) {
        spots = '<span class="cls__spots full">Мест нет</span>';
        btn = '<button class="btn btn--ghost btn--sm" type="button" data-book="' + c.key + '">В лист ожидания</button>';
      } else {
        spots = '<span class="cls__spots' + (c.left <= 2 ? ' low' : '') + '">' + (c.left <= 2 ? 'Осталось ' : 'Свободно ') + c.left + ' ' + FB.plural(c.left, ['место', 'места', 'мест']) + '</span>';
        btn = '<button class="btn btn--dark btn--sm" type="button" data-book="' + c.key + '">Записаться</button>';
      }
      var tag = c.my ? '<span class="tag tag--ok">' + (c.my.status === 'waitlist' ? 'Ожидание' : 'Вы записаны') + '</span>' : '';
      return '<article class="cls' + (c.my ? ' is-mine' : '') + (c.past ? ' is-past' : '') + '" style="--i:' + i + '">' +
        '<div class="cls__time">' + c.time + '<small>' + c.dir.dur + ' мин</small></div>' +
        '<div><div class="cls__name">' + c.dir.name + tag + '</div><div class="cls__coach">' + FB.esc(c.coach.name) + ' · до ' + c.end + '</div></div>' +
        spots + btn + '</article>';
    }).join('');
  }
  [fDir, fCoach, fTime].forEach(function (s) { s.addEventListener('change', function () { renderClasses(); FB.track('filter_schedule', { dir: fDir.value, coach: fCoach.value, time: fTime.value }); }); });

  // кнопки «Расписание барре» в карточках направлений
  FB.$$('[data-filter-dir]').forEach(function (b) {
    b.addEventListener('click', function () {
      fDir.value = b.getAttribute('data-filter-dir');
      renderClasses();
      FB.scrollTo('#schedule');
      FB.track('view_service', { dir: fDir.value });
    });
  });

  function findClass(key) {
    var date = FB.parseIso(key.split('_')[0]);
    return classesFor(date).filter(function (c) { return c.key === key; })[0];
  }

  function nextOpenClass(filter) {
    for (var i = 0; i < 7; i++) {
      var list = classesFor(days[i]).filter(function (c) { return !c.past && c.left > 0 && !c.my && (!filter || filter(c)); });
      if (list.length) return { cls: list[0], dayIndex: i };
    }
    return null;
  }

  function dayWord(i, iso) { return i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' }); }

  function renderHeroNext() {
    var n = nextOpenClass();
    if (!n) { FB.$('#nextClassTitle').textContent = 'Смотрите расписание'; return; }
    FB.$('#nextClassTitle').textContent = n.cls.dir.name + ' · ' + dayWord(n.dayIndex, n.cls.date) + ' в ' + n.cls.time;
    FB.$('#nextClassMeta').textContent = n.cls.coach.name.split(' ')[0] + ' · осталось ' + n.cls.left + ' ' + FB.plural(n.cls.left, ['место', 'места', 'мест']);
    FB.$('.hero__next').onclick = function (e) { e.preventDefault(); openBooking(n.cls.key); };
  }

  /* ================================================================ запись на занятие */

  var bookingForm = FB.$('#bookingForm');
  var currentClass = null;

  function showStep(modal, step) {
    FB.$$('[data-step]', modal).forEach(function (s) { s.hidden = s.getAttribute('data-step') !== step; });
  }

  function openBooking(key, opener) {
    var c = findClass(key);
    if (!c) return;
    currentClass = c;
    var modal = FB.$('#booking');
    showStep(modal, 'form');
    var wait = c.left === 0;
    FB.$('#bkKicker').textContent = wait ? 'Лист ожидания' : 'Запись на занятие';
    FB.$('#bkTitle').textContent = c.dir.name + ' с ' + c.coach.with;
    FB.$('#bkMeta').textContent = FB.fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + c.time + '–' + c.end +
      (wait ? ' · мест нет, напишем, если освободится' : ' · свободно ' + c.left + ' ' + FB.plural(c.left, ['место', 'места', 'мест']));
    FB.$('#bkSubmit').textContent = wait ? 'Встать в лист ожидания' : 'Записаться';
    FB.$('#bFirstWrap').hidden = !!membership;
    if (profile.name) bookingForm.name.value = profile.name;
    if (profile.phone) bookingForm.phone.value = profile.phone;
    FB.modal.open('booking', opener);
    FB.track('select_date', { cls: key });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-book]');
    if (b) openBooking(b.getAttribute('data-book'), b);
  });

  FB.form(bookingForm, {
    type: 'class_booking',
    before: function () {
      var c = currentClass && findClass(currentClass.key);
      if (!c || c.past) return 'Это занятие уже началось — выберите другое.';
      if (c.my) return 'Вы уже записаны на это занятие.';
      return true;
    },
    collect: function (fd) {
      var c = currentClass, wait = c.left === 0;
      return {
        type: wait ? 'waitlist' : 'class_booking',
        service: c.dir.name, master: c.coach.name, resource: c.key, date: c.date, time: c.time,
        details: { 'Занятие': c.dir.name + ', ' + c.time + '–' + c.end, 'Первое занятие': fd.get('first') ? 'да' : 'нет', 'Абонемент': membership ? membership.planName : 'нет' }
      };
    },
    success: function (res, payload) {
      var c = currentClass, wait = c.left === 0;
      profile.name = payload.name || profile.name; profile.phone = payload.phone || profile.phone;
      bookings.push({ key: c.key, date: c.date, time: c.time, end: c.end, dir: c.dir.name, coach: c.coach.name, id: res.id, status: wait ? 'waitlist' : 'booked' });
      save();
      FB.track(wait ? 'waitlist_join' : 'booking_confirmed', { cls: c.key, id: res.id });
      FB.$('#bkDoneTitle').textContent = wait ? 'Вы в листе ожидания' : 'Вы записаны!';
      FB.$('#bkDoneText').textContent = 'Заявка ' + res.id + '. ' + c.dir.name + ', ' + FB.fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' в ' + c.time + '. ' +
        (wait ? 'Если место освободится, администратор напишет вам в течение 10 минут.' : 'Приходите за 10 минут — выдадим коврик и носки.');
      var ics = FB.$('#bkIcs');
      ics.hidden = wait;
      if (!wait) ics.href = icsUrl(c);
      FB.$('#bkTg').href = FB.tgLink('Здравствуйте! Моя запись ' + res.id + ': ' + c.dir.name + ' ' + c.date + ' ' + c.time);
      showStep(FB.$('#booking'), 'done');
      renderAll();
    }
  });

  /** .ics с напоминаниями за 24 ч и 2 ч — реальные напоминания в календаре телефона */
  function icsUrl(c) {
    var dt = function (iso, t) { return iso.replace(/-/g, '') + 'T' + t.replace(':', '') + '00'; };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liniya studio//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + c.key + '@liniya', 'DTSTAMP:' + stamp, 'DTSTART:' + dt(c.date, c.time), 'DTEND:' + dt(c.date, c.end),
      'SUMMARY:' + c.dir.name + ' — студия «Линия»', 'LOCATION:' + ADDRESS.replace(/,/g, '\\,'),
      'DESCRIPTION:Тренер: ' + c.coach.name + '. Отмена без списания — за 3 часа.',
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра занятие в «Линии»', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Через 2 часа занятие в «Линии»', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ абонементы */

  var period = 1;
  var planPrice = function (p) { return p.id === 'single' ? p.price : Math.round(p.price * period * (period === 3 ? 0.9 : 1) / 10) * 10; };
  var shown = {};

  function renderPlans(animate) {
    var box = FB.$('#plans');
    if (!box.children.length) {
      box.innerHTML = PLANS.map(function (p) {
        return '<article class="plan' + (p.hit ? ' plan--hit' : '') + '" data-reveal>' + (p.hit ? '<span class="plan__badge">Выбирают чаще</span>' : '') +
          '<h3>' + p.name + '</h3><p class="plan__desc">' + p.desc + '</p>' +
          '<div class="plan__price"><span data-price="' + p.id + '">' + FB.money(planPrice(p)) + '</span><span class="plan__old" data-old="' + p.id + '"></span></div>' +
          '<p class="plan__per" data-per="' + p.id + '"></p>' +
          '<button class="btn ' + (p.hit ? '' : 'btn--dark') + '" type="button" data-buy="' + p.id + '">Оформить</button></article>';
      }).join('');
      FB.reveal(box);
    }
    PLANS.forEach(function (p) {
      var to = planPrice(p), el = FB.$('[data-price="' + p.id + '"]'), from = shown[p.id] || to;
      shown[p.id] = to;
      if (animate && FB.anime && !FB.reduced && from !== to) {
        var o = { v: from };
        FB.anime.animate(o, { v: to, duration: 700, ease: 'outCubic', onUpdate: function () { el.textContent = FB.money(o.v); } });
      } else el.textContent = FB.money(to);
      var old = FB.$('[data-old="' + p.id + '"]');
      old.textContent = period === 3 && p.id !== 'single' ? FB.money(p.price * 3) : '';
      var per = FB.$('[data-per="' + p.id + '"]');
      var visits = p.visits * (p.id === 'single' ? 1 : period);
      per.textContent = p.id === 'single' ? 'действует 30 дней' :
        p.visits ? '≈ ' + FB.money(to / visits) + ' за занятие · ' + (period === 3 ? '90' : '30') + ' дней' :
        (period === 3 ? '90 дней' : '30 дней') + ' без ограничений';
    });
  }
  FB.$$('input[name=period]').forEach(function (r) {
    r.addEventListener('change', function () { period = +r.value; renderPlans(true); FB.track('switch_period', { period: period }); });
  });

  var buyForm = FB.$('#buyForm'), buyPlan = null, promo = null;
  function buyTotal() {
    var t = planPrice(buyPlan);
    if (promo && promo.pct) t = Math.round(t * (1 - promo.pct / 100));
    if (promo && promo.minus) t = Math.max(0, t - promo.minus);
    return t;
  }
  function openBuy(id, opener) {
    buyPlan = PLANS.filter(function (p) { return p.id === id; })[0];
    promo = null;
    FB.$('#promoMsg').textContent = '';
    showStep(FB.$('#buy'), 'form');
    var months = buyPlan.id === 'single' ? 1 : period;
    FB.$('#buyTitle').textContent = buyPlan.name + (buyPlan.id === 'single' ? '' : ' · ' + months + ' ' + FB.plural(months, ['месяц', 'месяца', 'месяцев']));
    FB.$('#buyMeta').textContent = (buyPlan.visits ? buyPlan.visits * months + ' ' + FB.plural(buyPlan.visits * months, ['занятие', 'занятия', 'занятий']) : 'Без ограничений') +
      ' · действует ' + (months * 30) + ' дней' + (buyPlan.freeze ? ' · заморозка до ' + buyPlan.freeze * months + ' дней' : '');
    var start = FB.$('#pStart');
    start.min = FB.iso(FB.today());
    start.max = FB.iso(FB.addDays(FB.today(), 30));
    start.value = FB.iso(FB.today());
    if (profile.name) buyForm.name.value = profile.name;
    if (profile.phone) buyForm.phone.value = profile.phone;
    FB.$('#buyTotal').textContent = FB.money(buyTotal());
    FB.modal.open('buy', opener);
    FB.track('select_service', { plan: id, period: months });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-buy]');
    if (b) openBuy(b.getAttribute('data-buy'), b);
  });
  FB.$('#promoApply').addEventListener('click', function () {
    var code = FB.$('#pPromo').value.trim().toUpperCase(), msg = FB.$('#promoMsg');
    promo = PROMO[code] || null;
    msg.textContent = code ? (promo ? promo.text : 'Такого промокода нет') : '';
    msg.classList.toggle('bad', !!code && !promo);
    FB.$('#buyTotal').textContent = FB.money(buyTotal());
  });

  FB.form(buyForm, {
    type: 'purchase',
    before: function () {
      var s = FB.$('#pStart').value;
      if (s < FB.iso(FB.today())) return 'Дата начала не может быть в прошлом.';
      return true;
    },
    collect: function (fd) {
      var months = buyPlan.id === 'single' ? 1 : period;
      return {
        service: buyPlan.name + ' (' + months + ' мес.)', total: FB.money(buyTotal()), date: fd.get('start'),
        details: { 'Оплата': fd.get('payment') === 'online' ? 'картой онлайн (выслать ссылку)' : 'в студии', 'Промокод': promo ? FB.$('#pPromo').value.toUpperCase() : '—' }
      };
    },
    success: function (res, payload) {
      var months = buyPlan.id === 'single' ? 1 : period;
      var start = FB.parseIso(payload.date || FB.iso(FB.today()));
      profile.name = payload.name; profile.phone = payload.phone;
      membership = {
        id: res.id, plan: buyPlan.id, planName: buyPlan.name, visits: buyPlan.visits ? buyPlan.visits * months : 0,
        freeze: buyPlan.freeze * months, start: FB.iso(start), end: FB.iso(FB.addDays(start, months * 30 - 1)),
        status: payload.payment === 'online' ? 'awaiting' : 'studio', total: buyTotal(), frozenUntil: ''
      };
      save();
      FB.track('start_payment', { id: res.id, plan: buyPlan.id, total: buyTotal() });
      FB.$('#buyDoneText').textContent = 'Заявка ' + res.id + '. ' + (payload.payment === 'online'
        ? 'Ссылку на оплату ' + FB.money(buyTotal()) + ' пришлём SMS и в Telegram в течение 15 минут. Абонемент активируется после оплаты.'
        : 'Оплатите ' + FB.money(buyTotal()) + ' на ресепшене при первом визите — абонемент активируем сразу.');
      showStep(FB.$('#buy'), 'done');
      renderAll();
    }
  });

  /* ================================================================ личный кабинет */

  function usedVisits() {
    if (!membership) return 0;
    return bookings.filter(function (b) { return b.status === 'booked' && b.date >= membership.start && FB.isPastSlot(b.date, b.time); }).length;
  }

  function renderCabinet() {
    var box = FB.$('#cabBody');
    if (!membership && !bookings.length) {
      box.innerHTML = '<p class="modal__meta">Здесь появятся ваш абонемент и записи на занятия. Данные хранятся на этом устройстве; для входа с другого — напишите администратору.</p>' +
        '<div class="done-actions"><a class="btn btn--dark" href="#prices" data-close>Выбрать абонемент</a><a class="btn btn--ghost" href="#schedule" data-close>Записаться на занятие</a></div>';
      return;
    }
    var html = '';
    if (membership) {
      var used = usedVisits(), left = membership.visits ? Math.max(0, membership.visits - used) : Infinity;
      var daysLeft = Math.round((FB.parseIso(membership.end) - FB.today()) / 864e5) + 1;
      var frozen = membership.frozenUntil && membership.frozenUntil >= FB.iso(FB.today());
      var st = membership.status === 'active' ? ['Активен', 'status--ok'] : membership.status === 'awaiting' ? ['Ждёт оплаты', 'status--wait'] : ['Оплата в студии', 'status--wait'];
      if (frozen) st = ['Заморожен до ' + FB.fmtDate(membership.frozenUntil), 'status--wait'];
      html += '<div class="cab-card">' +
        '<div class="cab-card__row"><span>' + FB.esc(membership.planName) + ' · №' + FB.esc(membership.id) + '</span><span class="status ' + st[1] + '">' + st[0] + '</span></div>' +
        '<div class="cab-card__row"><div><div class="cab-card__big">' + (membership.visits ? left : '∞') + '</div><small>' + (membership.visits ? 'занятий осталось из ' + membership.visits : 'безлимит') + '</small></div>' +
        '<div style="text-align:right"><div class="cab-card__big">' + Math.max(0, daysLeft) + '</div><small>' + FB.plural(Math.max(0, daysLeft), ['день', 'дня', 'дней']) + ' до ' + FB.fmtDate(membership.end) + '</small></div></div>' +
        (membership.visits ? '<div class="meter" role="progressbar" aria-label="Использовано занятий" aria-valuemin="0" aria-valuemax="' + membership.visits + '" aria-valuenow="' + used + '"><span style="width:' + Math.min(100, used / membership.visits * 100) + '%"></span></div>' : '') +
        '</div>';
      if (membership.status !== 'active' && !FB.lead.isServer()) {
        html += '<p class="note">Демо-режим: оплата не подключена. <button class="link-btn" type="button" id="demoPaid">Отметить как оплаченный</button></p>';
      }
      if (membership.freeze && !frozen) {
        html += '<div class="cab-section"><h3>Заморозка</h3><p class="modal__meta" style="margin:0 0 12px">Доступно до ' + membership.freeze + ' ' + FB.plural(membership.freeze, ['дня', 'дней', 'дней']) + '. Срок абонемента продлится автоматически.</p><div class="freeze">' +
          [7, 14, 30].filter(function (d) { return d <= membership.freeze; }).map(function (d) { return '<button class="btn btn--ghost btn--sm" type="button" data-freeze="' + d + '">На ' + d + ' дней</button>'; }).join('') + '</div></div>';
      }
      if ((membership.visits && left <= 2) || daysLeft <= 5) {
        html += '<div class="cab-section"><h3>Пора продлить</h3><p class="modal__meta" style="margin:0 0 12px">Абонемент скоро закончится. Продлите сейчас — занятия не прервутся.</p>' +
          '<button class="btn btn--dark btn--sm" type="button" data-buy="' + membership.plan + '">Продлить «' + FB.esc(membership.planName) + '»</button></div>';
      }
    }
    var upcoming = bookings.filter(function (b) { return b.status !== 'canceled' && !FB.isPastSlot(b.date, b.time); }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var past = bookings.filter(function (b) { return b.status === 'booked' && FB.isPastSlot(b.date, b.time); });
    html += '<div class="cab-section"><h3>Ближайшие записи</h3>' + (upcoming.length ? '<ul class="cab-list">' + upcoming.map(function (b) {
      return '<li><span><b>' + FB.esc(b.dir) + '</b> · ' + FB.fmtDate(b.date, { day: 'numeric', month: 'short', weekday: 'short' }) + ', ' + b.time +
        (b.status === 'waitlist' ? ' <span class="status status--wait">ожидание</span>' : '') + '</span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-cancel="' + b.key + '">Отменить</button></li>';
    }).join('') + '</ul>' : '<p class="modal__meta">Записей пока нет. <a href="#schedule" data-close>Открыть расписание</a></p>') + '</div>';
    if (past.length) html += '<div class="cab-section"><h3>Посещено</h3><ul class="cab-list">' + past.slice(-5).reverse().map(function (b) {
      return '<li><span>' + FB.esc(b.dir) + ' · ' + FB.fmtDate(b.date, { day: 'numeric', month: 'short' }) + '</span><button class="btn btn--ghost btn--sm" type="button" data-again="' + b.dir + '">Записаться снова</button></li>';
    }).join('') + '</ul></div>';
    box.innerHTML = html;
  }

  FB.$('#cabinet').addEventListener('fb:open', renderCabinet);
  FB.$('#cabBody').addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'demoPaid') { membership.status = 'active'; save(); FB.track('payment_success', { id: membership.id }); renderCabinet(); return; }
    var fr = t.closest('[data-freeze]');
    if (fr) {
      var d = +fr.getAttribute('data-freeze');
      if (!confirm('Заморозить абонемент на ' + d + ' дней? Срок продлится до ' + FB.fmtDate(FB.addDays(FB.parseIso(membership.end), d)) + '.')) return;
      fr.disabled = true;
      FB.lead.submit({ type: 'freeze', name: profile.name, phone: profile.phone, service: membership.planName, details: { 'Заморозка': d + ' дней', 'Абонемент': membership.id } })
        .then(function () {
          membership.frozenUntil = FB.iso(FB.addDays(FB.today(), d - 1));
          membership.end = FB.iso(FB.addDays(FB.parseIso(membership.end), d));
          membership.freeze = 0;
          save(); renderCabinet();
          FB.toast('Абонемент заморожен на ' + d + ' дней', 'ok');
        })
        .catch(function (err) { fr.disabled = false; FB.toast('Не удалось заморозить: ' + err.message, 'error'); });
      return;
    }
    var cn = t.closest('[data-cancel]');
    if (cn) {
      var b = bookings.filter(function (x) { return x.key === cn.getAttribute('data-cancel') && x.status !== 'canceled'; })[0];
      if (!b) return;
      var late = FB.isPastSlot(b.date, addMin(b.time, -150)); // меньше 3 часов до начала
      if (!confirm(late && b.status === 'booked' ? 'До занятия меньше 3 часов — оно спишется с абонемента. Всё равно отменить?' : 'Отменить запись на ' + b.dir + ' ' + FB.fmtDate(b.date) + ' в ' + b.time + '?')) return;
      cn.disabled = true;
      FB.lead.submit({ type: 'cancel', orderId: b.id, name: profile.name, phone: profile.phone, service: b.dir, resource: b.key, date: b.date, time: b.time, details: { 'Отмена записи': b.id, 'Поздняя отмена': late ? 'да' : 'нет' } })
        .then(function () { b.status = 'canceled'; save(); renderAll(); renderCabinet(); FB.toast('Запись отменена', 'ok'); })
        .catch(function (err) { cn.disabled = false; FB.toast('Не удалось отменить: ' + err.message, 'error'); });
      return;
    }
    var ag = t.closest('[data-again]');
    if (ag) {
      var dirId = Object.keys(DIRS).filter(function (k) { return DIRS[k].name === ag.getAttribute('data-again'); })[0];
      FB.modal.close();
      fDir.value = dirId || '';
      renderClasses();
      FB.scrollTo('#schedule');
      FB.track('repeat_booking', { dir: dirId });
    }
  });

  /* ================================================================ тренеры */

  function renderCoaches() {
    FB.$('#coachGrid').innerHTML = COACHES.map(function (c) {
      var n = nextOpenClass(function (x) { return x.coach.id === c.id; });
      return '<article class="coach" data-reveal><div class="coach__photo"><img src="' + c.img + '" width="512" height="640" alt="Тренер ' + FB.esc(c.name) + '" loading="lazy"></div>' +
        '<div class="coach__body"><p class="coach__role">' + c.role + '</p><h3>' + c.name + '</h3><p class="coach__text">' + c.text + '</p>' +
        '<div class="coach__next">' + (n ? '<span>Ближайшее: ' + n.cls.dir.name.toLowerCase() + ', ' + dayWord(n.dayIndex, n.cls.date) + ' ' + n.cls.time + '</span><button class="btn btn--dark btn--sm" type="button" data-book="' + n.cls.key + '">Записаться</button>' : '<span>На этой неделе мест нет</span>') +
        '</div></div></article>';
    }).join('');
    FB.reveal(FB.$('#coachGrid'));
  }

  /* ================================================================ отзывы: перетаскивание */

  (function slider() {
    var vp = FB.$('#revViewport'), track = FB.$('#revTrack');
    var x = 0, start = 0, startX = 0, dragging = false, moved = false;
    var prog = document.createElement('div');
    prog.className = 'reviews__progress';
    prog.innerHTML = '<span></span>';
    vp.after(prog);
    function max() { return Math.max(0, track.scrollWidth - vp.clientWidth); }
    function set(v, smooth) {
      x = Math.max(-max(), Math.min(0, v));
      track.style.transition = smooth ? 'transform .6s cubic-bezier(.2,.8,.2,1)' : 'none';
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      prog.firstChild.style.width = (max() ? (-x / max()) * 100 : 100) + '%';
    }
    function step() { var c = track.children[0]; return c ? c.getBoundingClientRect().width + 18 : 300; }
    FB.$('#revPrev').addEventListener('click', function () { set(x + step(), true); });
    FB.$('#revNext').addEventListener('click', function () { set(x - step(), true); });
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; moved = false; startX = e.clientX; start = x;
      vp.classList.add('is-drag');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      set(start + dx, false);
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      vp.classList.remove('is-drag');
      var s = step();
      set(Math.round(x / s) * s, true); // доводим до ближайшей карточки
    });
    vp.addEventListener('click', function (e) { if (moved) e.preventDefault(); }, true);
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') set(x - step(), true);
      if (e.key === 'ArrowLeft') set(x + step(), true);
    });
    vp.tabIndex = 0;
    vp.setAttribute('aria-label', 'Отзывы, листайте стрелками');
    window.addEventListener('resize', FB.debounce(function () { set(x, false); }, 150));
    set(0, false);
  })();

  /* ================================================================ параллакс фото «Метод» */

  var par = FB.$('[data-parallax]');
  if (par && !FB.reduced) {
    FB.onScroll(function () {
      var r = par.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      par.style.transform = 'translate3d(0,' + (p * -60 - 40) + 'px,0)';
    });
  }

  /* ================================================================ пробное занятие */

  var trialForm = FB.$('#trialForm');
  FB.form(trialForm, {
    type: 'trial',
    collect: function (fd) {
      return { service: 'Пробное занятие', details: { 'Цель': fd.get('goal'), 'Уровень': fd.get('level'), 'Удобное время': fd.get('when') } };
    },
    success: function (res, payload) {
      profile.name = payload.name || profile.name; profile.phone = payload.phone || profile.phone; save();
      var box = trialForm.parentElement;
      var done = document.createElement('div');
      done.innerHTML = '<div class="done-mark" aria-hidden="true">✓</div><h3 class="modal__title" style="padding:0">Заявка ' + FB.esc(res.id) + ' принята</h3>' +
        '<p class="section-lead">Перезвоним в течение 15 минут (с 9:00 до 21:00) и подберём занятие. Хотите быстрее — выберите время сами.</p>' +
        '<div class="done-actions"><a class="btn btn--dark" href="#schedule">Выбрать занятие</a><a class="btn btn--ghost" target="_blank" rel="noopener" href="' +
        FB.tgLink('Здравствуйте! Заявка ' + res.id + ' на пробное занятие') + '">Написать в Telegram</a></div>';
      trialForm.hidden = true;
      box.appendChild(done);
      FB.scrollTo(box, { focus: false });
    }
  });

  /* ================================================================ */

  function renderAll() {
    renderClasses();
    renderHeroNext();
    renderCoaches();
  }
  renderPlans(false);
  renderAll();
  // обновляем «прошедшие» занятия раз в минуту
  setInterval(renderClasses, 60000);
})();
