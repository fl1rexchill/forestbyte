/* Пудра — салон красоты. Каталог услуг с фильтрами, визит из нескольких услуг, мастера с ближайшим окном
   по живому расписанию, запись: услуги → мастер → время (услуги встают подряд) → контакты и гарантия визита.
   Кабинет: перенос/отмена по правилам, повторная запись, баллы, лист ожидания. Сертификаты и абонементы. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочники */

  var CATS = [['hair', 'Волосы'], ['nails', 'Ногти'], ['brows', 'Брови и ресницы'], ['makeup', 'Макияж'], ['barber', 'Барбер']];
  var CAT = {};
  CATS.forEach(function (c) { CAT[c[0]] = c[1]; });
  var LEVELS = { m: ['Мастер', 1], top: ['Топ-мастер', 1.2], art: ['Арт-директор', 1.45] };

  var SERVICES = [
    { id: 'cut', cat: 'hair', name: 'Женская стрижка', price: 1800, min: 60, img: 'cut', every: 6, short: 'С мытьём и укладкой по форме',
      desc: 'Мастер обсудит форму, учтёт тип и рост волос, покажет, как укладывать дома.', prep: ['Приходите с привычной укладкой — так видно, как лежат волосы'], care: ['Освежать форму раз в 6–8 недель'] },
    { id: 'blow', cat: 'hair', name: 'Укладка', price: 1500, min: 45, img: 'dryer', every: 0, short: 'Брашинг, локоны или гладкость',
      desc: 'Мытьё, уход по типу волос и укладка на выбор. Держится 2–3 дня.', prep: ['Покажите фото желаемой укладки'], care: ['Не мочить волосы первые сутки'] },
    { id: 'tone', cat: 'hair', name: 'Однотонное окрашивание', price: 4200, min: 120, img: 'blonde', every: 6, complex: true, test: true, short: 'Корни или по всей длине',
      desc: 'Подбор оттенка, окрашивание профессиональными красителями, уход и укладка.', prep: ['Первый раз — тест на чувствительность за 48 часов, бесплатно', 'Не мыть голову накануне'], care: ['Шампунь для окрашенных волос', 'Первые 2 дня — без бассейна'] },
    { id: 'balayage', cat: 'hair', name: 'Сложное окрашивание', price: 9500, min: 240, img: 'blonde', every: 12, complex: true, prepay: true, test: true, short: 'Балаяж, airtouch, растяжка цвета',
      desc: 'Мягкий переход цвета с тонированием. Итоговая цена зависит от длины и густоты — мастер назовёт её по фото.', prep: ['Пришлите фото волос при дневном свете и пример результата', 'Тест на чувствительность за 48 часов'], care: ['Тонирование раз в 2–3 месяца', 'Маска и термозащита'] },
    { id: 'keratin', cat: 'hair', name: 'Кератиновое выпрямление', price: 6500, min: 180, img: 'bun', every: 16, complex: true, short: 'Гладкость до 4 месяцев',
      desc: 'Разглаживание и восстановление без формальдегида.', prep: ['Не окрашивать волосы за неделю до процедуры'], care: ['Безсульфатный шампунь', '3 дня — без заколок и резинок'] },
    { id: 'updo', cat: 'hair', name: 'Вечерняя причёска', price: 3500, min: 75, img: 'updo', every: 0, complex: true, short: 'Собранная или локоны',
      desc: 'Причёска на событие. Для свадебной — рекомендуем пробную заранее.', prep: ['Вымыть голову накануне вечером', 'Принести фото и аксессуары'], care: [] },
    { id: 'mani', cat: 'nails', name: 'Маникюр с покрытием', price: 2200, min: 90, img: 'nails1', every: 3, short: 'Аппаратный или комбинированный + гель-лак',
      desc: 'Снятие старого покрытия, маникюр, выравнивание и гель-лак. Носится 3–4 недели.', prep: [], care: ['Масло для кутикулы каждый вечер'] },
    { id: 'mani0', cat: 'nails', name: 'Маникюр без покрытия', price: 1200, min: 50, img: 'nails6', every: 2, short: 'Ухоженные ногти за час',
      desc: 'Обработка кутикулы, форма, уход. Можно покрыть лечебной базой.', prep: [], care: [] },
    { id: 'pedi', cat: 'nails', name: 'Педикюр с покрытием', price: 2900, min: 100, img: 'nails5', every: 4, short: 'Стопы и пальцы + гель-лак',
      desc: 'Аппаратная обработка стоп, пальцев и покрытие гель-лаком.', prep: ['Удобная открытая обувь, если покрытие обычным лаком'], care: [] },
    { id: 'ext', cat: 'nails', name: 'Наращивание ногтей', price: 3800, min: 150, img: 'nails3', every: 3, complex: true, short: 'Гель на верхние формы',
      desc: 'Любая длина и форма, покрытие в цене. Коррекция — через 3 недели.', prep: ['Пришлите пример длины и формы'], care: ['Коррекция раз в 3–4 недели'] },
    { id: 'design', cat: 'nails', name: 'Дизайн на 2 ногтя', price: 300, min: 15, img: 'nails2', every: 0, short: 'Френч, слайдеры, рисунок',
      desc: 'Добавляется к маникюру. Сложный рисунок — по фото.', prep: [], care: [] },
    { id: 'brow', cat: 'brows', name: 'Коррекция и окрашивание бровей', price: 1300, min: 45, img: 'eye', every: 4, short: 'Форма по лицу + краска или хна',
      desc: 'Архитектура бровей, коррекция воском или пинцетом, окрашивание.', prep: ['Не выщипывать брови за 2 недели'], care: ['Сутки не мочить и не тереть'] },
    { id: 'lami', cat: 'brows', name: 'Ламинирование бровей', price: 2200, min: 60, img: 'blush', every: 6, test: true, short: 'Укладка волосков на 6 недель',
      desc: 'Фиксация формы, окрашивание и питание волосков.', prep: ['Тест на чувствительность при первом визите'], care: ['24 часа не мочить', 'Масло для бровей на ночь'] },
    { id: 'lash', cat: 'brows', name: 'Ламинирование ресниц', price: 2400, min: 70, img: 'eye', every: 6, test: true, short: 'Изгиб и цвет своих ресниц',
      desc: 'Подкручивание, окрашивание и уход. Эффект держится 6–8 недель.', prep: ['Прийти без туши и линз'], care: ['24 часа не мочить'] },
    { id: 'lashext', cat: 'brows', name: 'Наращивание ресниц 2D', price: 3200, min: 150, img: 'eye', every: 3, complex: true, short: 'Естественный объём',
      desc: 'Подбор изгиба и длины под форму глаз.', prep: ['Прийти без туши и линз', 'Пример желаемого эффекта'], care: ['Коррекция через 2–3 недели', 'Без масляных средств у глаз'] },
    { id: 'day', cat: 'makeup', name: 'Дневной макияж', price: 2500, min: 60, img: 'makeup', every: 0, short: 'Лёгкий, держится весь день',
      desc: 'Подготовка кожи, тон, брови, ресницы, губы.', prep: ['Прийти с чистой кожей'], care: [] },
    { id: 'evening', cat: 'makeup', name: 'Вечерний макияж', price: 3500, min: 75, img: 'brushes', every: 0, complex: true, short: 'Акцент на глаза или губы',
      desc: 'Стойкий макияж на событие, накладные пучки в цене.', prep: ['Пришлите фото образа и платья'], care: [] },
    { id: 'bride', cat: 'makeup', name: 'Свадебный образ', price: 9000, min: 180, img: 'updo', every: 0, complex: true, prepay: true, short: 'Макияж + причёска + пробный образ',
      desc: 'Пробный образ за 2–4 недели, в день свадьбы — макияж и причёска. Выезд — по договорённости.', prep: ['Пришлите фото платья и примеры образов'], care: [] },
    { id: 'mcut', cat: 'barber', name: 'Мужская стрижка', price: 1300, min: 45, img: 'barber1', every: 4, short: 'Машинка и ножницы, мытьё, укладка',
      desc: 'Стрижка любой сложности с мытьём головы и укладкой.', prep: [], care: ['Освежать раз в 3–4 недели'] },
    { id: 'beard', cat: 'barber', name: 'Борода и контур', price: 900, min: 30, img: 'barber2', every: 3, short: 'Форма, опасная бритва, уход',
      desc: 'Моделирование бороды, горячее полотенце, масло.', prep: [], care: [] },
    { id: 'combo', cat: 'barber', name: 'Стрижка + борода', price: 2000, min: 75, img: 'clipper', every: 4, short: 'Выгоднее на 200 ₽',
      desc: 'Полный уход за 75 минут.', prep: [], care: [] },
    { id: 'kids', cat: 'barber', name: 'Детская стрижка до 12 лет', price: 900, min: 30, img: 'tools', every: 6, short: 'Терпеливо и с мультиками',
      desc: 'Стрижка для детей до 12 лет.', prep: ['Лучше приходить после сна и еды'], care: [] }
  ];
  var SVC = {};
  SERVICES.forEach(function (s) { SVC[s.id] = s; });

  var MASTERS = [
    { id: 'alina', name: 'Алина Руденко', cats: ['hair'], lvl: 'top', exp: 9, rate: 4.9, revs: 212, br: ['push'], spec: 'Стрижки, укладки, короткие формы' },
    { id: 'vera', name: 'Вера Ким', cats: ['hair'], lvl: 'art', exp: 14, rate: 5.0, revs: 187, br: ['push'], spec: 'Сложное окрашивание и блонд' },
    { id: 'dasha', name: 'Дарья Ли', cats: ['hair', 'makeup'], lvl: 'm', exp: 5, rate: 4.9, revs: 96, br: ['push'], spec: 'Причёски, макияж, свадебные образы' },
    { id: 'oksana', name: 'Оксана Белова', cats: ['nails'], lvl: 'top', exp: 8, rate: 4.9, revs: 301, br: ['push'], spec: 'Маникюр, педикюр, укрепление' },
    { id: 'artem', name: 'Артём Пак', cats: ['barber'], lvl: 'm', exp: 3, rate: 4.8, revs: 65, br: ['push'], spec: 'Фейды, классика, детские стрижки' },
    { id: 'kristina', name: 'Кристина Ахмедова', cats: ['brows'], lvl: 'top', exp: 6, rate: 5.0, revs: 154, br: ['push', 'west'], spec: 'Брови, ламинирование, ресницы' },
    { id: 'nika', name: 'Ника Орлова', cats: ['hair'], lvl: 'm', exp: 4, rate: 4.8, revs: 73, br: ['west'], spec: 'Стрижки и окрашивание' },
    { id: 'lena', name: 'Лена Сорокина', cats: ['nails'], lvl: 'm', exp: 3, rate: 4.8, revs: 88, br: ['west'], spec: 'Маникюр, наращивание, дизайн' },
    { id: 'sonya', name: 'Соня Гарина', cats: ['makeup', 'brows'], lvl: 'm', exp: 4, rate: 4.9, revs: 71, br: ['west'], spec: 'Макияж и брови' },
    { id: 'timur', name: 'Тимур Галиев', cats: ['barber'], lvl: 'top', exp: 7, rate: 4.9, revs: 240, br: ['west'], spec: 'Мужские стрижки, борода, бритьё' }
  ];
  var MS = {};
  MASTERS.forEach(function (m) { MS[m.id] = m; });

  var BRANCHES = {
    push: { name: 'Пушкинская', addr: 'ул. Пушкинская, 118', full: 'Ростов-на-Дону, ул. Пушкинская, 118', hours: 'Каждый день 10:00–21:00', phone: '+7 (863) 310-44-20',
      park: 'Платная городская парковка на ул. Чехова — 2 минуты пешком', how: 'Вход с улицы, вывеска «пудра», 1 этаж', pin: [52, 40] },
    west: { name: 'Западный', addr: 'ул. Еременко, 58', full: 'Ростов-на-Дону, ул. Еременко, 58', hours: 'Каждый день 10:00–21:00', phone: '+7 (863) 310-44-21',
      park: 'Бесплатная парковка у торгового центра прямо у входа', how: 'ТЦ «Западный», 2 этаж, рядом с эскалатором', pin: [26, 58] }
  };

  var WORKS = [
    { img: 'hero', w: 546, h: 683, cat: 'hair', svc: 'cut', m: 'alina', t: 'Удлинённое каре' },
    { img: 'nails3', w: 683, h: 683, cat: 'nails', svc: 'ext', m: 'oksana', t: 'Красный с френч-дизайном' },
    { img: 'blonde', w: 960, h: 640, cat: 'hair', svc: 'balayage', m: 'vera', t: 'Тёплый блонд, растяжка цвета' },
    { img: 'barber1', w: 960, h: 1200, cat: 'barber', svc: 'mcut', m: 'artem', t: 'Фейд с текстурой' },
    { img: 'makeup', w: 640, h: 640, cat: 'makeup', svc: 'evening', m: 'dasha', t: 'Вечерний со стрелкой' },
    { img: 'nails2', w: 683, h: 683, cat: 'nails', svc: 'mani', m: 'lena', t: 'Кобальт' },
    { img: 'updo', w: 1021, h: 681, cat: 'hair', svc: 'updo', m: 'dasha', t: 'Свадебный пучок из локонов' },
    { img: 'eye', w: 859, h: 573, cat: 'brows', svc: 'lash', m: 'kristina', t: 'Ламинирование ресниц' },
    { img: 'cut', w: 960, h: 640, cat: 'hair', svc: 'cut', m: 'nika', t: 'Мужская стрижка ножницами' },
    { img: 'nails1', w: 681, h: 681, cat: 'nails', svc: 'mani', m: 'oksana', t: 'Нюд и оливковый' },
    { img: 'barber2', w: 960, h: 640, cat: 'barber', svc: 'beard', m: 'timur', t: 'Бритьё опасной бритвой' },
    { img: 'dryer', w: 1024, h: 682, cat: 'hair', svc: 'blow', m: 'alina', t: 'Объёмный брашинг' },
    { img: 'nails4', w: 683, h: 683, cat: 'nails', svc: 'mani', m: 'oksana', t: 'Классика в красном' },
    { img: 'bun', w: 960, h: 640, cat: 'hair', svc: 'keratin', m: 'nika', t: 'Гладкость после кератина' },
    { img: 'clipper', w: 1024, h: 682, cat: 'barber', svc: 'combo', m: 'timur', t: 'Андеркат и контур' },
    { img: 'nails5', w: 682, h: 682, cat: 'nails', svc: 'mani0', m: 'lena', t: 'Молочный гель-лак' }
  ];

  var REVIEWS = [
    { n: 'Анастасия К.', src: 'Яндекс Карты', d: '12 сентября', svc: 'Сложное окрашивание', m: 'vera', r: 5, t: 'Пришла с рыжими остатками старой краски, ушла с ровным тёплым блондом. Вера честно сказала, что за один раз светлее не надо — волосы живые.', ph: ['blonde'] },
    { n: 'Мария С.', src: '2ГИС', d: '9 сентября', svc: 'Маникюр с покрытием', m: 'oksana', r: 5, t: 'Хожу к Оксане второй год. Покрытие носится 4 недели без сколов, запись через сайт — за минуту, напоминание приходит в Telegram.', ph: ['nails4'] },
    { n: 'Игорь Л.', src: 'Яндекс Карты', d: '3 сентября', svc: 'Стрижка + борода', m: 'timur', r: 5, t: 'Удобно, что можно записаться на стрижку и бороду сразу, без ожидания между услугами. Бесплатная парковка на Западном — плюс.', ph: [] },
    { n: 'Екатерина Д.', src: 'Яндекс Карты', d: '28 августа', svc: 'Свадебный образ', m: 'dasha', r: 5, t: 'Сделали пробный образ за три недели, в день свадьбы всё было ровно так, как договорились. Причёска продержалась до ночи.', ph: ['updo', 'makeup'] },
    { n: 'Полина Р.', src: '2ГИС', d: '21 августа', svc: 'Ламинирование ресниц', m: 'kristina', r: 4, t: 'Результат отличный, но пришлось подождать минут десять — мастер задержалась на предыдущей записи. Извинились и сделали скидку на следующий визит.', ph: ['eye'] },
    { n: 'Ольга Т.', src: 'Яндекс Карты', d: '15 августа', svc: 'Женская стрижка', m: 'alina', r: 5, t: 'Алина объяснила, как укладывать каре дома за пять минут. Правда получается!', ph: ['hero'] },
    { n: 'Денис В.', src: '2ГИС', d: '10 августа', svc: 'Детская стрижка', m: 'artem', r: 5, t: 'Сын обычно не даёт себя стричь. Артём включил мультики и управился за 20 минут, без слёз.', ph: [] },
    { n: 'Юлия Н.', src: 'Яндекс Карты', d: '2 августа', svc: 'Наращивание ногтей', m: 'lena', r: 5, t: 'Отправила фото формы заранее — Лена подготовилась, всё сделали быстрее, чем я думала.', ph: ['nails3'] }
  ];

  var SUBS = [
    { id: 'mani4', name: 'Маникюр ×4', img: 'nails1', price: 7900, old: 8800, note: 'Маникюр с покрытием у любого мастера уровня «мастер»' },
    { id: 'blow5', name: 'Укладка ×5', img: 'dryer', price: 6000, old: 7500, note: 'Для тех, кто каждую неделю на событиях' },
    { id: 'brow3', name: 'Брови ×3', img: 'eye', price: 3300, old: 3900, note: 'Коррекция и окрашивание раз в месяц' }
  ];

  /* ================================================================ утилиты */

  var CELLS = 22; // 10:00 … 20:30, шаг 30 минут; закрытие в 21:00
  function cellTime(i) { var m = 600 + i * 30; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function timeCell(t) { var p = t.split(':'); return ((+p[0]) * 60 + (+p[1]) - 600) / 30; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dur(min) { var h = Math.floor(min / 60), m = min % 60; return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : ''); }
  function round50(n) { return Math.round(n / 50) * 50; }
  function price(s, lvl) { return round50(s.price * (lvl ? LEVELS[lvl][1] : 1)); }
  function firstName(m) { return m.name.split(' ')[0]; }
  function cellsFor(min) { return Math.ceil(min / 30); }
  function img(name, alt, lazy) { return '<img src="img/' + name + '.webp" alt="' + FB.esc(alt || '') + '"' + (lazy === false ? '' : ' loading="lazy"') + '>'; }
  function whenText(dateIso, time) {
    var d = FB.parseIso(dateIso), t = FB.today(), diff = Math.round((d - t) / 864e5);
    var day = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : FB.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
    return day + ', ' + time;
  }
  function bump(el) { if (el && FB.anime && !FB.reduced) FB.anime.animate(el, { scale: [1.18, 1], duration: 480, ease: 'outBack' }); }

  var state = {
    branch: FB.store.get('branch', 'push'),
    basket: FB.store.get('basket', []).filter(function (id) { return SVC[id]; })
  };
  function saveBasket() { FB.store.set('basket', state.basket); renderBasket(); }

  /* ================================================================ расписание */

  // Смена мастера: Кристина работает в двух салонах через день, остальные — по графику ~5/2
  function worksAt(m, dateIso) {
    if (m.br.length > 1) return m.br[FB.parseIso(dateIso).getDate() % 2];
    return FB.seeded('shift|' + m.id + '|' + dateIso)() < 0.74 ? m.br[0] : null;
  }
  var busyCache = {};
  function busyCells(mId, dateIso) {
    var key = mId + '|' + dateIso;
    if (!busyCache[key]) {
      // демо-занятость: блоки записей по 1–2,5 часа, как в реальном журнале
      var rnd = FB.seeded('busy|' + key), set = {}, i = 0;
      while (i < CELLS) {
        if (rnd() < 0.4) { var len = 2 + Math.floor(rnd() * 3); for (var k = 0; k < len; k++) set[i + k] = 1; i += len; }
        else i += 1 + Math.floor(rnd() * 3);
      }
      busyCache[key] = set;
    }
    var out = Object.assign({}, busyCache[key]);
    // свои записи из кабинета
    visits().forEach(function (v) {
      if (v.status !== 'upcoming' || v.date !== dateIso || v.id === bk.oldId) return; // переносимая запись не занимает своё же время
      v.segs.forEach(function (s) { if (s.m === mId) for (var k = 0; k < s.n; k++) out[timeCell(s.time) + k] = 1; });
    });
    // занятость с сервера (если запущен): старт записи + час
    (serverBusy[key] || []).forEach(function (t) { var c = timeCell(t); out[c] = out[c + 1] = 1; });
    return out;
  }
  var serverBusy = {};
  function loadServerBusy(mIds, dateIso, done) {
    if (!FB.lead.isServer()) { if (done) done(); return; }
    var left = mIds.length;
    mIds.forEach(function (id) {
      FB.lead.busy(id, dateIso, [], 0).then(function (list) {
        serverBusy[id + '|' + dateIso] = list;
        if (--left === 0 && done) done();
      });
    });
  }
  function isFree(m, dateIso, cell, n, branch) {
    if (cell + n > CELLS) return false;
    if (worksAt(m, dateIso) !== branch) return false;
    if (FB.isPastSlot(dateIso, cellTime(cell))) return false;
    var b = busyCells(m.id, dateIso);
    for (var k = 0; k < n; k++) if (b[cell + k]) return false;
    return true;
  }
  function mastersFor(cat, branch) { return MASTERS.filter(function (m) { return m.cats.indexOf(cat) > -1 && m.br.indexOf(branch) > -1; }); }
  function nearest(m, branch, n) {
    var days = FB.days(14);
    for (var d = 0; d < days.length; d++) {
      var iso = FB.iso(days[d]);
      for (var c = 0; c < CELLS; c++) if (isFree(m, iso, c, n || 2, branch)) return { date: iso, cell: c, time: cellTime(c) };
    }
    return null;
  }

  /* ================================================================ филиал */

  function setBranch(b, silent) {
    state.branch = b;
    FB.store.set('branch', b);
    FB.$$('[data-branch]').forEach(function (x) { x.setAttribute('aria-checked', String(x.getAttribute('data-branch') === b)); });
    FB.$$('[data-branch-name]').forEach(function (x) { x.textContent = BRANCHES[b].name; });
    renderMasters();
    heroWindow();
    var tab = FB.$('#ct-' + b);
    if (tab && contactTabs) contactTabs.select(tab);
    if (!silent) FB.toast('Показываем салон «' + BRANCHES[b].name + '»');
  }
  FB.$$('[data-branch]').forEach(function (btn) { btn.addEventListener('click', function () { setBranch(btn.getAttribute('data-branch')); }); });

  /* ================================================================ каталог услуг */

  var svcCat = 'all';
  (function catalog() {
    var chips = FB.$('#svcCats');
    chips.innerHTML = [['all', 'Все']].concat(CATS).map(function (c, i) {
      var n = c[0] === 'all' ? SERVICES.length : SERVICES.filter(function (s) { return s.cat === c[0]; }).length;
      return '<button type="button" role="tab" id="sc-' + c[0] + '" aria-controls="svcPanel" aria-selected="' + (i === 0) + '" data-c="' + c[0] + '">' + c[1] + '<sup>' + n + '</sup></button>';
    }).join('');
    FB.tabs(chips, function (tab) { svcCat = tab.getAttribute('data-c'); renderServices(); });
    FB.$('#svcSearch').addEventListener('input', FB.debounce(renderServices, 150));
    FB.$('#svcDur').addEventListener('change', renderServices);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset-svc]')) {
        FB.$('#svcSearch').value = '';
        FB.$('#svcDur').value = '0';
        FB.$('#sc-all').click();
      }
    });
    FB.$('#svcList').addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]');
      if (add) { toggleSvc(add.getAttribute('data-add'), add); return; }
      var open = e.target.closest('[data-svc]');
      if (open) openService(open.getAttribute('data-svc'), open);
    });
  })();

  function renderServices() {
    var q = FB.$('#svcSearch').value.trim().toLowerCase(), maxMin = +FB.$('#svcDur').value;
    var list = SERVICES.filter(function (s) {
      return (svcCat === 'all' || s.cat === svcCat) && (!maxMin || s.min <= maxMin) &&
        (!q || (s.name + ' ' + s.short + ' ' + CAT[s.cat]).toLowerCase().indexOf(q) > -1);
    });
    FB.$('#svcList').innerHTML = list.map(function (s, i) {
      var on = state.basket.indexOf(s.id) > -1;
      var tags = (s.prepay ? '<span class="tag">предоплата</span>' : '') + (s.test ? '<span class="tag">тест на аллергию</span>' : '') + (s.complex && !s.prepay ? '<span class="tag">по фото</span>' : '');
      return '<li class="svc" style="--i:' + i + '"><div class="svc__img">' + img(s.img, '') + '</div>' +
        '<button class="svc__name" type="button" data-svc="' + s.id + '"><b>' + s.name + '</b><span>' + s.short + '</span>' + (tags ? '<span class="svc__tags">' + tags + '</span>' : '') + '</button>' +
        '<span class="svc__dur">' + dur(s.min) + '</span>' +
        '<span class="svc__price"><small>от</small>' + FB.money(s.price) + '</span>' +
        '<button class="svc__add" type="button" data-add="' + s.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Убрать из визита: ' : 'Добавить в визит: ') + s.name + '">' + (on ? '✓' : '+') + '</button></li>';
    }).join('');
    FB.$('#svcEmpty').hidden = list.length > 0;
  }

  function toggleSvc(id, btn) {
    var i = state.basket.indexOf(id);
    if (i > -1) state.basket.splice(i, 1);
    else { state.basket.push(id); FB.track('add_service', { id: id }); }
    saveBasket();
    renderServices();
    if (btn) bump(FB.$('[data-add="' + id + '"]'));
  }

  /* ================================================================ корзина визита */

  function basketTotals(list) {
    var min = 0, sum = 0;
    (list || state.basket).forEach(function (id) { min += SVC[id].min; sum += SVC[id].price; });
    return { min: min, sum: sum };
  }
  function renderBasket() {
    var bar = FB.$('#visitBar'), n = state.basket.length;
    bar.hidden = !n;
    if (n) {
      var t = basketTotals();
      FB.$('#vbCount').innerHTML = n + ' ' + FB.plural(n, ['услуга', 'услуги', 'услуг']) + '<span class="vb-hide"> в визите</span>';
      FB.$('#vbMeta').textContent = dur(t.min) + ' · от ' + FB.money(t.sum) + ' · ' + state.basket.map(function (id) { return SVC[id].name; }).join(', ');
      bump(FB.$('#vbCount'));
    }
    FB.$('#mobileCta').classList.toggle('is-hidden', !!n || window.pageYOffset < 500);
  }
  FB.$('#vbClear').addEventListener('click', function () { state.basket = []; saveBasket(); renderServices(); });
  FB.onScroll(function (y) { FB.$('#mobileCta').classList.toggle('is-hidden', state.basket.length > 0 || y < 500); });

  /* ================================================================ карточка услуги */

  function openService(id, opener) {
    var s = SVC[id], ms = MASTERS.filter(function (m) { return m.cats.indexOf(s.cat) > -1; });
    var lvls = Object.keys(LEVELS).filter(function (l) { return ms.some(function (m) { return m.lvl === l; }); });
    var on = state.basket.indexOf(id) > -1;
    FB.$('#sBody').innerHTML = '<div class="sv__img">' + img(s.img, s.name) + '</div><p class="eyebrow">' + CAT[s.cat] + '</p><h2 class="modal__title" id="sTitle">' + s.name + '</h2>' +
      '<p class="sv__lead">' + s.desc + '</p>' +
      '<div class="sv__grid"><div><b>' + dur(s.min) + '</b>длительность</div>' + lvls.map(function (l) { return '<div><b>' + FB.money(price(s, l)) + '</b>' + LEVELS[l][0].toLowerCase() + '</div>'; }).join('') +
      (s.every ? '<div><b>раз в ' + s.every + ' нед.</b>как часто</div>' : '') + '</div>' +
      '<div class="sv__sec"><h3>Делают</h3><div class="sv__who">' + ms.map(function (m) { return '<span class="tag">' + m.name + ' · ' + m.br.map(function (b) { return BRANCHES[b].name; }).join(', ') + '</span>'; }).join('') + '</div></div>' +
      (s.prep.length ? '<div class="sv__sec"><h3>Как подготовиться</h3><ul>' + s.prep.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '') +
      (s.care.length ? '<div class="sv__sec"><h3>После</h3><ul>' + s.care.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '') +
      (s.prepay ? '<p class="fine" style="margin-top:14px">Для этой услуги нужна предоплата 30% или привязка карты — мастер резервирует под вас несколько часов.</p>' : '') +
      '<div class="sv__btns"><button class="btn btn--cherry" type="button" data-sv-book="' + id + '">Записаться</button>' +
      '<button class="btn btn--line" type="button" data-sv-add="' + id + '">' + (on ? 'Убрать из визита' : 'Добавить в визит') + '</button></div>';
    FB.modal.open('service', opener);
    FB.track('view_service', { id: id });
  }
  FB.$('#service').addEventListener('click', function (e) {
    var a = e.target.closest('[data-sv-add]'), b = e.target.closest('[data-sv-book]');
    if (a) { toggleSvc(a.getAttribute('data-sv-add')); FB.modal.close(); }
    if (b) {
      var id = b.getAttribute('data-sv-book');
      if (state.basket.indexOf(id) < 0) { state.basket.push(id); saveBasket(); renderServices(); }
      openBooking({});
    }
  });

  /* ================================================================ портфолио */

  var workCat = 'all', workList = [], workIdx = 0;
  (function works() {
    var box = FB.$('#workCats');
    box.innerHTML = [['all', 'Все']].concat(CATS).map(function (c, i) { return '<button type="button" aria-pressed="' + (i === 0) + '" data-w="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-w]');
      if (!b) return;
      workCat = b.getAttribute('data-w');
      FB.$$('[data-w]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderWorks();
    });
    FB.$('#workGrid').addEventListener('click', function (e) {
      var w = e.target.closest('[data-work]');
      if (w) { workIdx = +w.getAttribute('data-work'); showWork(); FB.modal.open('work', w); }
    });
  })();
  function renderWorks() {
    workList = WORKS.filter(function (w) { return workCat === 'all' || w.cat === workCat; });
    FB.$('#workGrid').innerHTML = workList.map(function (w, i) {
      return '<button class="work" type="button" data-work="' + i + '" style="--i:' + i + '" aria-label="' + FB.esc(w.t + ', мастер ' + MS[w.m].name) + '"><img src="img/' + w.img + '.webp" alt="" width="' + w.w + '" height="' + w.h + '" loading="lazy">' +
        '<span class="work__cap"><b>' + w.t + '</b>' + MS[w.m].name + ' · ' + SVC[w.svc].name + '</span></button>';
    }).join('');
  }
  function showWork() {
    var w = workList[workIdx], m = MS[w.m];
    var im = FB.$('#lbImg');
    im.src = 'img/' + w.img + '.webp';
    im.alt = w.t;
    FB.$('#lbCap').innerHTML = '<p><b>' + w.t + '</b>' + m.name + ' · ' + SVC[w.svc].name + ' · от ' + FB.money(price(SVC[w.svc], m.lvl)) + '</p>' +
      '<button class="btn btn--light btn--sm" type="button" data-same="' + workIdx + '">Хочу так же</button>';
    if (FB.anime && !FB.reduced) FB.anime.animate(im, { opacity: [0, 1], scale: [.98, 1], duration: 420, ease: 'outCubic' });
  }
  function stepWork(d) { workIdx = (workIdx + d + workList.length) % workList.length; showWork(); }
  FB.$('#work').addEventListener('click', function (e) {
    var nav = e.target.closest('[data-lb]');
    if (nav) stepWork(+nav.getAttribute('data-lb'));
    var same = e.target.closest('[data-same]');
    if (same) {
      var w = workList[+same.getAttribute('data-same')];
      if (state.basket.indexOf(w.svc) < 0) { state.basket.push(w.svc); saveBasket(); renderServices(); }
      var mm = {}; mm[w.cat] = w.m;
      if (MS[w.m].br.indexOf(state.branch) < 0) setBranch(MS[w.m].br[0], true);
      openBooking({ masters: mm, comment: 'Референс: работа «' + w.t + '» из портфолио' });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (FB.modal.current() !== FB.$('#work')) return;
    if (e.key === 'ArrowRight') stepWork(1);
    if (e.key === 'ArrowLeft') stepWork(-1);
  });
  (function swipe() {
    var x0 = null, fig = FB.$('#work .lb__fig');
    fig.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    fig.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) stepWork(dx < 0 ? 1 : -1);
      x0 = null;
    });
  })();

  /* ================================================================ мастера */

  function signature(m) { return SERVICES.filter(function (s) { return s.cat === m.cats[0]; })[0].id; }
  function renderMasters() {
    var list = MASTERS.filter(function (m) { return m.br.indexOf(state.branch) > -1; });
    FB.$('#mGrid').innerHTML = list.map(function (m, i) {
      var nx = nearest(m, state.branch, cellsFor(SVC[signature(m)].min));
      var ini = m.name.split(' ').map(function (p) { return p[0]; }).join('');
      return '<article class="mcard" style="--i:' + i + '"><div class="mcard__top"><span class="mono" aria-hidden="true">' + ini + '</span><div><h3>' + m.name + '</h3><p class="mcard__lvl">' + LEVELS[m.lvl][0] + ' · ' + m.cats.map(function (c) { return CAT[c].toLowerCase(); }).join(', ') + '</p></div></div>' +
        '<p class="mcard__spec">' + m.spec + '</p>' +
        '<p class="mcard__meta"><span><b>★ ' + m.rate.toFixed(1).replace('.', ',') + '</b> · ' + m.revs + ' ' + FB.plural(m.revs, ['отзыв', 'отзыва', 'отзывов']) + '</span><span>стаж <b>' + m.exp + ' ' + FB.plural(m.exp, ['год', 'года', 'лет']) + '</b></span></p>' +
        '<div class="mcard__slot' + (nx ? '' : ' is-none') + '"><span>' + (nx ? 'Ближайшее: <b>' + whenText(nx.date, nx.time) + '</b>' : 'Нет окон на 2 недели') + '</span>' +
        '<button class="btn btn--cherry btn--sm" type="button" data-master="' + m.id + '"' + (nx ? ' data-date="' + nx.date + '" data-time="' + nx.time + '"' : '') + '>' + (nx ? 'Записаться' : 'В лист ожидания') + '</button></div></article>';
    }).join('');
  }
  FB.$('#mGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-master]');
    if (!b) return;
    bookWithMaster(MS[b.getAttribute('data-master')], b.getAttribute('data-date'), b.getAttribute('data-time'));
  });
  function bookWithMaster(m, date, time) {
    var has = state.basket.some(function (id) { return m.cats.indexOf(SVC[id].cat) > -1; });
    if (!has) {
      var s = signature(m);
      state.basket.push(s); saveBasket(); renderServices();
      FB.toast('Добавили «' + SVC[s].name + '» — поменяйте услугу, если нужно другое');
    }
    var mm = {};
    m.cats.forEach(function (c) { mm[c] = m.id; });
    openBooking({ masters: mm, step: date ? 3 : 3, date: date, time: time });
  }

  function heroWindow() {
    var best = null;
    MASTERS.filter(function (m) { return m.br.indexOf(state.branch) > -1; }).forEach(function (m) {
      var nx = nearest(m, state.branch, 2);
      if (nx && (!best || nx.date < best.date || (nx.date === best.date && nx.cell < best.cell))) best = Object.assign({ m: m }, nx);
    });
    var b = FB.$('#heroWindow b');
    if (!best) { b.textContent = 'Окна на ближайшие дни разобрали — встаньте в лист ожидания'; FB.$('#heroWindow').onclick = function () { openBooking({}); }; return; }
    b.textContent = whenText(best.date, best.time) + ' · ' + firstName(best.m) + ', ' + CAT[best.m.cats[0]].toLowerCase();
    FB.$('#heroWindow').onclick = function () { bookWithMaster(best.m, best.date, best.time); };
  }

  /* ================================================================ запись */

  var bk = { step: 1, masters: {}, date: null, cell: null, mode: 'new', oldId: null, repeat: false };
  var form = FB.$('#bookForm');
  var refInput = FB.files(FB.$('#bRef'), { max: 5, list: FB.$('#bRefList') });

  // группы визита: услуги одной категории делает один мастер, группы идут подряд
  function groups() {
    var order = [], by = {};
    state.basket.forEach(function (id) {
      var c = SVC[id].cat;
      if (!by[c]) { by[c] = []; order.push(c); }
      by[c].push(id);
    });
    return order.map(function (c) {
      var min = by[c].reduce(function (a, id) { return a + SVC[id].min; }, 0);
      return { cat: c, ids: by[c], min: min, n: cellsFor(min) };
    });
  }
  function branchVal() { return (FB.$('input[name=branch]:checked', form) || {}).value || state.branch; }

  // план визита на дату и время старта: какой мастер когда делает какую группу.
  // Первая услуга — ровно во время старта, следующие — сразу или с паузой до часа, если мастер ещё занят.
  function planAt(dateIso, cell) {
    var br = branchVal(), cur = cell, segs = [];
    var gs = groups();
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i], pick = bk.masters[g.cat], cands = pick && pick !== 'any' ? [MS[pick]] : mastersFor(g.cat, br), m = null;
      for (var w = 0; w <= (i ? 2 : 0) && !m; w++) {
        m = cands.filter(function (x) { return isFree(x, dateIso, cur + w, g.n, br); })[0] || null;
        if (m) cur += w;
      }
      if (!m) return null;
      segs.push({ cat: g.cat, m: m.id, time: cellTime(cur), n: g.n, min: g.min, ids: g.ids });
      cur += g.n;
    }
    return segs;
  }
  function planEnd(segs) { var l = segs[segs.length - 1]; return timeCell(l.time) + l.n; }
  function startsFor(dateIso) {
    var out = [], total = groups().reduce(function (a, g) { return a + g.n; }, 0);
    for (var c = 0; c + total <= CELLS; c++) if (planAt(dateIso, c)) out.push(c);
    return out;
  }

  function openBooking(o) {
    o = o || {};
    FB.$('#bFlow').hidden = false;
    FB.$('#bDone').hidden = true;
    bk.mode = o.mode || 'new';
    bk.oldId = o.oldId || null;
    bk.repeat = !!o.repeat;
    bk.masters = Object.assign({}, o.keepMasters ? bk.masters : {}, o.masters || {});
    bk.date = o.date || null;
    bk.cell = o.time ? timeCell(o.time) : null;
    FB.$$('input[name=branch]', form).forEach(function (r) { r.checked = r.value === state.branch; });
    if (o.first) FB.$('#bFirst').checked = true;
    if (o.comment) FB.$('#bComment').value = o.comment;
    FB.$('#bMode').textContent = bk.mode === 'reschedule' ? 'Перенос записи ' + bk.oldId : bk.repeat ? 'Повторная запись · −10%' : 'Онлайн-запись';
    FB.$('#bFirst').closest('.check').hidden = bk.mode !== 'new' || bk.repeat;
    var step = o.step || 1;
    if (!state.basket.length) step = 1;
    go(step);
    if (!FB.modal.current() || FB.modal.current().id !== 'book') FB.modal.open('book');
    FB.track('start_booking', { mode: bk.mode });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-book]');
    if (!b) return;
    e.preventDefault();
    openBooking({ first: b.hasAttribute('data-first') });
  });

  function go(n) {
    bk.step = n;
    FB.$$('.step', form).forEach(function (f) { f.hidden = +f.getAttribute('data-step') !== n; });
    FB.$$('#bSteps li').forEach(function (li) {
      var s = +li.getAttribute('data-s');
      li.classList.toggle('is-cur', s === n);
      li.classList.toggle('is-done', s < n);
      if (s === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (n === 1) renderStep1();
    if (n === 2) renderStep2();
    if (n === 3) renderStep3();
    if (n === 4) renderStep4();
    var dlg = FB.$('#book .fb-modal__dialog');
    if (dlg) dlg.scrollTop = 0;
  }
  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-prev]')) { go(bk.step - 1); return; }
    if (!e.target.closest('[data-next]')) return;
    if (bk.step === 1) {
      if (!state.basket.length) { FB.$('#e1').textContent = 'Добавьте хотя бы одну услугу'; return; }
      var br = branchVal(), miss = groups().filter(function (g) { return !mastersFor(g.cat, br).length; });
      if (miss.length) { FB.$('#e1').textContent = 'В этом салоне нет мастеров по направлению «' + CAT[miss[0].cat] + '». Выберите другой салон.'; return; }
      FB.$('#e1').textContent = '';
      go(2);
    } else if (bk.step === 2) go(3);
    else if (bk.step === 3) {
      if (bk.cell == null || !bk.date) { FB.$('#e3').textContent = 'Выберите дату и время начала визита'; return; }
      FB.$('#e3').textContent = '';
      go(4);
    }
  });

  /* ---- шаг 1 */
  (function addSelect() {
    FB.$('#bAdd').innerHTML = '<option value="">+ Добавить услугу…</option>' + CATS.map(function (c) {
      return '<optgroup label="' + c[1] + '">' + SERVICES.filter(function (s) { return s.cat === c[0]; }).map(function (s) {
        return '<option value="' + s.id + '">' + s.name + ' · ' + dur(s.min) + ' · от ' + FB.money(s.price) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    FB.$('#bAdd').addEventListener('change', function () {
      var v = this.value;
      if (v && state.basket.indexOf(v) < 0) { state.basket.push(v); saveBasket(); renderServices(); renderStep1(); }
      this.value = '';
    });
    FB.$('#bItems').addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rm]');
      if (!rm) return;
      state.basket.splice(state.basket.indexOf(rm.getAttribute('data-rm')), 1);
      saveBasket(); renderServices(); renderStep1();
    });
    FB.$$('input[name=branch]', form).forEach(function (r) {
      r.addEventListener('change', function () {
        // мастера другого салона сбрасываем на «любого»
        Object.keys(bk.masters).forEach(function (c) { var m = MS[bk.masters[c]]; if (m && m.br.indexOf(r.value) < 0) bk.masters[c] = 'any'; });
        bk.date = null; bk.cell = null;
        FB.$('#e1').textContent = '';
      });
    });
  })();
  function renderStep1() {
    FB.$('#bItems').innerHTML = state.basket.length ? state.basket.map(function (id) {
      var s = SVC[id];
      return '<li class="b-item"><div><b>' + s.name + '</b><span>' + CAT[s.cat] + ' · ' + dur(s.min) + '</span></div><span>от ' + FB.money(s.price) + '</span>' +
        '<button class="b-item__rm" type="button" data-rm="' + id + '" aria-label="Убрать ' + s.name + '">×</button></li>';
    }).join('') : '<li class="b-empty">Визит пока пустой — добавьте услугу из списка ниже или из каталога на странице.</li>';
  }

  /* ---- шаг 2 */
  function renderStep2() {
    var br = branchVal();
    FB.$('#bMasters').innerHTML = groups().map(function (g) {
      var ms = mastersFor(g.cat, br);
      var cur = bk.masters[g.cat] && (bk.masters[g.cat] === 'any' || ms.some(function (m) { return m.id === bk.masters[g.cat]; })) ? bk.masters[g.cat] : 'any';
      bk.masters[g.cat] = cur;
      var base = g.ids.reduce(function (a, id) { return a + SVC[id].price; }, 0);
      return '<div class="mgroup"><h3>' + CAT[g.cat] + '<span>' + g.ids.map(function (id) { return SVC[id].name; }).join(', ') + ' · ' + dur(g.min) + '</span></h3><div class="mopts">' +
        '<label class="mopt"><input type="radio" name="m_' + g.cat + '" value="any"' + (cur === 'any' ? ' checked' : '') + '><span><b>Любой свободный</b>быстрее найдём время · от ' + FB.money(base) + '</span></label>' +
        ms.map(function (m) {
          var sum = g.ids.reduce(function (a, id) { return a + price(SVC[id], m.lvl); }, 0), nx = nearest(m, br, g.n);
          return '<label class="mopt"><input type="radio" name="m_' + g.cat + '" value="' + m.id + '"' + (cur === m.id ? ' checked' : '') + '><span><b>' + m.name + '</b>' + LEVELS[m.lvl][0] + ' · ★ ' + m.rate.toFixed(1).replace('.', ',') + ' · ' + FB.money(sum) +
            '<br>' + (nx ? 'ближайшее: ' + whenText(nx.date, nx.time) : 'нет окон на 2 недели') + '</span></label>';
        }).join('') + '</div></div>';
    }).join('');
  }
  FB.$('#bMasters').addEventListener('change', function (e) {
    if (e.target.name && e.target.name.indexOf('m_') === 0) { bk.masters[e.target.name.slice(2)] = e.target.value; bk.cell = null; }
  });

  /* ---- шаг 3 */
  function renderStep3() {
    var days = FB.days(14), br = branchVal();
    var ids = {};
    groups().forEach(function (g) { (bk.masters[g.cat] && bk.masters[g.cat] !== 'any' ? [MS[bk.masters[g.cat]]] : mastersFor(g.cat, br)).forEach(function (m) { ids[m.id] = 1; }); });
    var counts = days.map(function (d) { return startsFor(FB.iso(d)).length; });
    var di = bk.date ? days.map(FB.iso).indexOf(bk.date) : -1;
    if (di < 0 || counts[di] === 0) {
      var first = counts.findIndex(function (c) { return c > 0; });
      bk.date = first > -1 ? FB.iso(days[first]) : FB.iso(days[0]);
      if (!startsFor(bk.date).length) bk.cell = null;
    }
    FB.$('#bDays').innerHTML = days.map(function (d, i) {
      var iso = FB.iso(d), n = counts[i];
      return '<button class="day" type="button" role="radio" aria-checked="' + (iso === bk.date) + '" data-day="' + iso + '"' + (n ? '' : ' disabled') + ' aria-label="' + FB.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (n ? ', свободно ' + n : ', нет окон') + '">' +
        FB.weekday(d, true) + '<b>' + d.getDate() + '</b><i>' + (n ? n + ' ' + FB.plural(n, ['окно', 'окна', 'окон']) : 'нет') + '</i></button>';
    }).join('');
    renderSlots();
    var cur = FB.$('#bDays [aria-checked="true"]');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    loadServerBusy(Object.keys(ids), bk.date, function () { renderSlots(); });
  }
  function renderSlots() {
    var starts = startsFor(bk.date);
    if (bk.cell != null && starts.indexOf(bk.cell) < 0) bk.cell = null;
    FB.$('#bSlots').innerHTML = starts.length ? starts.map(function (c, i) {
      return '<button class="slot" type="button" role="radio" style="--i:' + i + '" aria-checked="' + (c === bk.cell) + '" data-cell="' + c + '">' + cellTime(c) + '</button>';
    }).join('') : '<p class="slots__empty">На этот день подходящих окон нет — выберите другой день или встаньте в лист ожидания ниже.</p>';
    renderPlan();
  }
  function renderPlan() {
    var segs = bk.cell != null ? planAt(bk.date, bk.cell) : null;
    FB.$('#bPlan').innerHTML = segs ? segs.map(function (s) {
      var end = cellTime(timeCell(s.time) + s.n);
      return '<div class="plan__row"><b>' + s.time + '–' + end + '</b><span>' + MS[s.m].name + ' · ' + s.ids.map(function (id) { return SVC[id].name; }).join(', ') + '</span></div>';
    }).join('') : '';
  }
  FB.$('#bDays').addEventListener('click', function (e) {
    var d = e.target.closest('[data-day]');
    if (!d || d.disabled) return;
    bk.date = d.getAttribute('data-day');
    bk.cell = null;
    FB.$$('#bDays .day').forEach(function (x) { x.setAttribute('aria-checked', String(x === d)); });
    renderSlots();
  });
  FB.$('#bSlots').addEventListener('click', function (e) {
    var s = e.target.closest('[data-cell]');
    if (!s) return;
    bk.cell = +s.getAttribute('data-cell');
    FB.$$('#bSlots .slot').forEach(function (x) { x.setAttribute('aria-checked', String(x === s)); });
    FB.$('#e3').textContent = '';
    renderPlan();
    bump(s);
  });

  // лист ожидания
  FB.$('#wSend').addEventListener('click', function () {
    var name = FB.$('#wName'), contact = FB.$('#wContact'), ok = true;
    [[name, 'required name'], [contact, 'required contact']].forEach(function (p) {
      p[0].setAttribute('data-validate', p[1]);
      var msg = FB.validateField(p[0]);
      FB.setError(p[0], msg);
      p[0].removeAttribute('data-validate');
      if (msg) ok = false;
    });
    if (!ok) return;
    var btn = this;
    btn.disabled = true;
    var item = {
      type: 'waitlist', name: name.value.trim(), contact: contact.value.trim(), branch: BRANCHES[branchVal()].name,
      service: state.basket.map(function (id) { return SVC[id].name; }).join(', '),
      master: groups().map(function (g) { var m = bk.masters[g.cat]; return m && m !== 'any' ? MS[m].name : 'любой'; }).join(', '),
      when: FB.$('#wWhen').value + (FB.$('#wWhen').value === 'В выбранный день' ? ' (' + bk.date + ')' : ''), part: FB.$('#wPart').value
    };
    FB.lead.submit(item).then(function (res) {
      var w = FB.store.get('waits', []);
      w.unshift({ id: res.id, service: item.service, when: item.when, part: item.part, branch: item.branch, at: Date.now() });
      FB.store.set('waits', w.slice(0, 10));
      FB.toast('Вы в листе ожидания (' + res.id + '). Напишем, как только освободится окно.', 'ok', 6000);
      FB.$('#bWait').open = false;
      FB.track('join_waitlist', { id: res.id });
    }).catch(function (err) { FB.toast('Не получилось: ' + err.message, 'error'); })
      .then(function () { btn.disabled = false; });
  });

  /* ---- шаг 4 */
  var PAY = {
    prepay: ['Предоплата 30%', 'Ссылку на оплату пришлём вместе с подтверждением. Вычтем из суммы визита.'],
    card: ['Привязать карту', 'Деньги не спишутся. Только при неявке или отмене позже 12 часов — 50% первой услуги.'],
    salon: ['Оплачу в салоне', 'Картой или наличными после визита.']
  };
  function calc() {
    var segs = planAt(bk.date, bk.cell) || [], sum = 0, lines = [];
    segs.forEach(function (s) {
      var m = MS[s.m];
      s.ids.forEach(function (id) { var p = price(SVC[id], m.lvl); sum += p; lines.push([SVC[id].name + ' · ' + firstName(m), p]); });
    });
    var rate = bk.repeat ? 0.10 : (FB.$('#bFirst').checked && bk.mode === 'new' ? 0.15 : 0);
    var disc = round50(sum * rate), total = sum - disc;
    var need = total >= 6000 || state.basket.some(function (id) { return SVC[id].prepay; });
    return { segs: segs, sum: sum, lines: lines, rate: rate, disc: disc, total: total, need: need, prepay: Math.round(total * 0.3 / 100) * 100,
      min: segs.length ? (planEnd(segs) - timeCell(segs[0].time)) * 30 : 0 };
  }
  function renderStep4() {
    var c = calc(), cur = (FB.$('input[name=pay]:checked', form) || {}).value;
    var opts = c.need ? ['prepay', 'card'] : ['salon', 'card', 'prepay'];
    if (opts.indexOf(cur) < 0) cur = opts[0];
    FB.$('#bPayOpts').innerHTML = opts.map(function (k) {
      return '<label><input type="radio" name="pay" value="' + k + '"' + (k === cur ? ' checked' : '') + '><span><b>' + PAY[k][0] + (k === 'prepay' ? ' — ' + FB.money(c.prepay) : '') + '</b><small>' + PAY[k][1] + '</small></span></label>';
    }).join('');
    FB.$('#bPayNote').textContent = c.need ? 'Для визитов от 6 000 ₽ и сложных услуг нужна гарантия: мастер резервирует под вас несколько часов.' : '';
    FB.$('#bRefField').hidden = !state.basket.some(function (id) { return SVC[id].complex; });
    FB.$('#bSum').innerHTML = c.lines.map(function (l) { return '<div><span>' + l[0] + '</span><span>' + FB.money(l[1]) + '</span></div>'; }).join('') +
      (c.disc ? '<div class="disc"><span>' + (bk.repeat ? 'Повторный визит' : 'Первый визит') + ' −' + Math.round(c.rate * 100) + '%</span><span>−' + FB.money(c.disc) + '</span></div>' : '') +
      '<div class="sum__total"><span>' + whenText(bk.date, cellTime(bk.cell)) + ' · ' + dur(c.min) + '</span><span>' + FB.money(c.total) + '</span></div>';
    notifyFields();
  }
  function notifyFields() {
    var v = (FB.$('input[name=notify]:checked', form) || {}).value;
    FB.$('#bTgField').hidden = v !== 'telegram';
    FB.$('#bEmailField').hidden = v !== 'email';
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'notify') notifyFields();
    if (e.target.id === 'bFirst' && bk.step === 4) renderStep4();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-policy]')) { e.preventDefault(); FB.$('#policy').dataset.back = 'book'; FB.modal.open('policy'); }
  });
  FB.$('#policy').addEventListener('fb:close', function () {
    if (this.dataset.back) { delete this.dataset.back; setTimeout(function () { FB.modal.open('book'); }, 30); }
  });

  FB.form(form, {
    type: 'booking',
    before: function () {
      if (!state.basket.length) { go(1); return 'Визит пустой — добавьте услугу'; }
      if (bk.cell == null || !planAt(bk.date, bk.cell)) { go(3); FB.$('#e3').textContent = 'Это время только что заняли — выберите другое'; return 'Выберите другое время'; }
      return true;
    },
    collect: function (fd) {
      var c = calc();
      var pay = fd.get('pay');
      return {
        type: bk.mode === 'reschedule' ? 'reschedule' : 'booking',
        oldId: bk.oldId || undefined,
        service: state.basket.map(function (id) { return SVC[id].name; }).join(', '),
        master: c.segs.map(function (s) { return MS[s.m].name; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', '),
        resource: c.segs[0].m,
        branch: BRANCHES[branchVal()].name,
        date: bk.date, time: cellTime(bk.cell), duration: c.min,
        segments: c.segs.map(function (s) { return { master: MS[s.m].name, time: s.time, services: s.ids.map(function (id) { return SVC[id].name; }) }; }),
        total: c.total, discount: c.disc, payment: PAY[pay] ? PAY[pay][0] : pay,
        prepayAmount: pay === 'prepay' ? c.prepay : undefined,
        firstVisit: fd.get('firstVisit') ? 'да' : undefined,
        repeat: bk.repeat ? 'да' : undefined,
        m_hair: undefined, m_nails: undefined, m_brows: undefined, m_makeup: undefined, m_barber: undefined, branchId: branchVal()
      };
    },
    success: function (res, p) {
      var c = calc();
      FB.store.set('me', { name: p.name, phone: p.phone });
      var v = { id: res.id, date: p.date, time: p.time, min: p.duration, branch: p.branchId, total: p.total, status: 'upcoming', pay: p.payment, name: p.name, phone: p.phone,
        segs: c.segs.map(function (s) { return { m: s.m, time: s.time, n: s.n, ids: s.ids, cat: s.cat }; }), at: Date.now() };
      var all = visits();
      if (bk.mode === 'reschedule') all.forEach(function (x) { if (x.id === bk.oldId) { x.status = 'moved'; x.movedTo = res.id; } });
      all.unshift(v);
      saveVisits(all);
      state.basket = []; saveBasket(); renderServices(); renderMasters(); heroWindow();
      refInput.fbReset();
      showDone(v, res, p);
    }
  });

  function showDone(v, res, p) {
    var br = BRANCHES[v.branch];
    FB.$('#bFlow').hidden = true;
    var d = FB.$('#bDone');
    d.hidden = false;
    d.innerHTML = '<div class="done"><p class="eyebrow">' + (p.type === 'reschedule' ? 'Запись перенесена' : 'Запись создана') + '</p><div class="done__num">' + FB.esc(res.id) + '</div>' +
      '<p>' + whenText(v.date, v.time) + ', салон «' + br.name + '», ' + br.addr + '. Администратор подтвердит запись ' + (p.notify === 'sms' ? 'по SMS' : p.notify === 'email' ? 'письмом' : 'в Telegram') + ' в течение 15 минут' + (p.payment === 'Предоплата 30%' ? ' и пришлёт ссылку на предоплату' : p.payment === 'Привязать карту' ? ' и пришлёт ссылку для привязки карты' : '') + '.</p>' +
      '<div class="plan">' + v.segs.map(function (s) { return '<div class="plan__row"><b>' + s.time + '–' + cellTime(timeCell(s.time) + s.n) + '</b><span>' + MS[s.m].name + ' · ' + s.ids.map(function (id) { return SVC[id].name; }).join(', ') + '</span></div>'; }).join('') + '</div>' +
      '<p class="fine">Напомним за сутки и за 2 часа. Перенести или отменить бесплатно можно до ' + cancelDeadline(v) + '.</p>' +
      (res.mode === 'demo' ? '<p class="fine">Демо-режим: запись сохранена в этом браузере. С запущенным сервером она уйдёт администратору в Telegram и CRM.</p>' : '') +
      '<div class="done__btns"><a class="btn btn--cherry" href="' + ics(v) + '" download="pudra-' + v.id + '.ics">В календарь с напоминаниями</a><button class="btn btn--line" type="button" data-open="cabinet">Мои записи</button></div></div>';
    FB.track('booking_done', { id: res.id });
  }
  function startDate(v) { var d = FB.parseIso(v.date), t = v.time.split(':'); d.setHours(+t[0], +t[1], 0, 0); return d; }
  function cancelDeadline(v) { var d = new Date(startDate(v).getTime() - 12 * 3600e3); return FB.fmtDate(d, { day: 'numeric', month: 'long' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ics(v) {
    var br = BRANCHES[v.branch], dt = v.date.replace(/-/g, '') + 'T' + v.time.replace(':', '') + '00';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var what = v.segs.map(function (s) { return s.ids.map(function (id) { return SVC[id].name; }).join(', ') + ' — ' + MS[s.m].name + ' в ' + s.time; }).join('; ');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pudra//RU', 'BEGIN:VEVENT', 'UID:' + v.id + '@pudra', 'DTSTAMP:' + stamp, 'DTSTART:' + dt, 'DURATION:PT' + v.min + 'M',
      'SUMMARY:Пудра: ' + v.segs.map(function (s) { return s.ids.map(function (id) { return SVC[id].name; }).join(', '); }).join(', '),
      'LOCATION:' + br.full.replace(/,/g, '\\,'), 'DESCRIPTION:' + what.replace(/,/g, '\\,') + '. Запись ' + v.id + '. Перенос и отмена бесплатно за 12 часов.',
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра визит в «Пудру»', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Через 2 часа визит в «Пудру»', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ кабинет */

  var visitsCache = null;
  function visits() {
    if (visitsCache) return visitsCache;
    var list = FB.store.get('visits', []), now = Date.now(), changed = false;
    list.forEach(function (v) {
      if (v.status === 'upcoming' && startDate(v).getTime() + v.min * 60e3 < now) { v.status = 'done'; changed = true; }
    });
    if (changed) FB.store.set('visits', list);
    visitsCache = list;
    setTimeout(function () { visitsCache = null; }, 0); // кеш живёт один проход рендера
    return list;
  }
  function saveVisits(list) { visitsCache = null; FB.store.set('visits', list.slice(0, 30)); }
  function points() { return visits().filter(function (v) { return v.status === 'done'; }).reduce(function (a, v) { return a + Math.round(v.total * 0.05); }, 0); }

  var ST = { upcoming: ['Предстоит', ''], done: ['Состоялся', 'ok'], cancelled: ['Отменён', 'off'], moved: ['Перенесён', 'off'] };
  function renderCabinet() {
    var list = visits(), waits = FB.store.get('waits', []);
    var html = '<div class="cab-points"><div><b>' + FB.num(points()) + '</b> баллов</div><span>5% от каждого визита. Можно оплатить до 30% услуги — скажите администратору.</span></div>';
    if (!list.length) {
      html += '<div class="cab-empty"><p>Здесь появятся ваши записи: перенос, отмена, повторная запись и баллы.</p><button class="btn btn--cherry btn--sm" type="button" data-book>Записаться</button>' +
        '<button class="link" type="button" data-demo-visit>Показать пример прошлого визита</button></div>';
    }
    html += list.map(function (v) {
      var st = ST[v.status] || ST.upcoming, br = BRANCHES[v.branch];
      var btns = '';
      if (v.status === 'upcoming') {
        btns = '<a class="btn btn--line" href="' + ics(v) + '" download="pudra-' + v.id + '.ics">В календарь</a><button class="btn btn--line" type="button" data-resch="' + v.id + '">Перенести</button><button class="btn btn--line" type="button" data-cancel="' + v.id + '">Отменить</button>';
      } else if (v.status === 'done') {
        btns = '<button class="btn btn--cherry" type="button" data-repeat="' + v.id + '">Записаться снова' + (repeatDiscount(v) ? ' −10%' : '') + '</button>';
      }
      return '<article class="visit"><div class="visit__top"><b>' + whenText(v.date, v.time) + '</b><span class="visit__st' + (st[1] ? ' visit__st--' + st[1] : '') + '">' + st[0] + (v.movedTo ? ' → ' + v.movedTo : '') + '</span></div>' +
        '<p class="fine">' + v.id + ' · салон «' + br.name + '» · ' + FB.money(v.total) + (v.demo ? ' · пример' : '') + '</p>' +
        '<ul>' + v.segs.map(function (s) { return '<li>' + s.time + ' — ' + s.ids.map(function (id) { return SVC[id].name; }).join(', ') + ', ' + MS[s.m].name + '</li>'; }).join('') + '</ul>' +
        (btns ? '<div class="visit__btns">' + btns + '</div>' : '') + '<div class="visit__confirm" data-confirm-box></div></article>';
    }).join('');
    if (waits.length) {
      html += '<h3 class="sub-h" style="margin:24px 0 10px;font-size:22px">Лист ожидания</h3>' + waits.map(function (w, i) {
        return '<article class="visit"><div class="visit__top"><b>' + FB.esc(w.service) + '</b><button class="link" type="button" data-unwait="' + i + '">Убрать</button></div><p class="fine">' + w.id + ' · ' + FB.esc(w.branch) + ' · ' + FB.esc(w.when) + ', ' + FB.esc(w.part).toLowerCase() + '</p></article>';
      }).join('');
    }
    FB.$('#cabBody').innerHTML = html;
  }
  function repeatDiscount(v) { return Date.now() - startDate(v).getTime() < 35 * 864e5; }
  FB.$('#cabinet').addEventListener('fb:open', renderCabinet);
  FB.$('#cabBody').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-demo-visit]'))) {
      var d = FB.addDays(FB.today(), -26);
      var br = state.branch, hair = mastersFor('hair', br)[0], nails = mastersFor('nails', br)[0];
      saveVisits([{ id: FB.config.prefix + '-DEMO', demo: true, date: FB.iso(d), time: '12:00', min: 150, branch: br, status: 'done', pay: 'Оплачу в салоне',
        total: price(SVC.cut, hair.lvl) + price(SVC.mani, nails.lvl),
        segs: [{ m: hair.id, time: '12:00', n: 2, ids: ['cut'], cat: 'hair' }, { m: nails.id, time: '13:00', n: 3, ids: ['mani'], cat: 'nails' }] }]);
      renderCabinet();
      return;
    }
    if ((t = e.target.closest('[data-unwait]'))) {
      var w = FB.store.get('waits', []);
      w.splice(+t.getAttribute('data-unwait'), 1);
      FB.store.set('waits', w);
      renderCabinet();
      return;
    }
    var v = visits().filter(function (x) { var el = e.target.closest('[data-resch],[data-cancel],[data-repeat],[data-cancel-ok]'); return el && x.id === (el.getAttribute('data-resch') || el.getAttribute('data-cancel') || el.getAttribute('data-repeat') || el.getAttribute('data-cancel-ok')); })[0];
    if (!v) return;
    if (e.target.closest('[data-resch]')) {
      if (startDate(v) - Date.now() < 12 * 3600e3) FB.toast('До визита меньше 12 часов — перенос возможен, но предоплата не вернётся. Лучше напишите администратору.', 'error', 7000);
      loadVisit(v);
      openBooking({ mode: 'reschedule', oldId: v.id, step: 3, keepMasters: true });
    } else if (e.target.closest('[data-repeat]')) {
      loadVisit(v);
      var every = Math.min.apply(null, v.segs.map(function (s) { return Math.min.apply(null, s.ids.map(function (id) { return SVC[id].every || 99; })); }));
      var target = every < 99 ? FB.addDays(startDate(v), every * 7) : FB.today();
      if (target < FB.today()) target = FB.today();
      if (target > FB.addDays(FB.today(), 13)) target = FB.addDays(FB.today(), 13);
      openBooking({ mode: 'new', repeat: repeatDiscount(v), step: 3, keepMasters: true, date: FB.iso(target) });
      if (every < 99) FB.toast('Подобрали дату: мастер советует повторять раз в ' + every + ' нед.');
    } else if (e.target.closest('[data-cancel]')) {
      var late = startDate(v) - Date.now() < 12 * 3600e3;
      var box = e.target.closest('.visit').querySelector('[data-confirm-box]');
      var me = FB.store.get('me', {});
      box.innerHTML = '<p class="fine" style="margin:6px 0 10px">' + (late ? 'До визита меньше 12 часов: по правилам предоплата не возвращается, с привязанной карты спишем 50% первой услуги.' : 'Отмена бесплатная. Окно передадим тем, кто в листе ожидания.') + '</p>' +
        (v.phone || me.phone ? '' : '<div class="field" data-field style="margin-bottom:10px"><label for="cxPhone">Телефон, на который была запись</label><input id="cxPhone" type="tel" autocomplete="tel"></div>') +
        '<div class="visit__btns"><button class="btn btn--cherry" type="button" data-cancel-ok="' + v.id + '">Да, отменить</button><button class="btn btn--line" type="button" data-cancel-no>Оставить запись</button></div>';
    } else if (e.target.closest('[data-cancel-ok]')) {
      var btn = e.target.closest('[data-cancel-ok]'), cx = FB.$('#cxPhone'), me2 = FB.store.get('me', {});
      if (cx) {
        cx.setAttribute('data-validate', 'required phone');
        var msg = FB.validateField(cx);
        FB.setError(cx, msg);
        if (msg) { cx.focus(); return; }
      }
      btn.disabled = true;
      FB.lead.submit({ type: 'cancel', orderId: v.id, name: v.name || me2.name || '', phone: cx ? FB.phoneFormat(cx.value) : v.phone || me2.phone, date: v.date, time: v.time,
        service: v.segs.map(function (s) { return s.ids.map(function (id) { return SVC[id].name; }).join(', '); }).join(', '),
        branch: BRANCHES[v.branch].name, late: startDate(v) - Date.now() < 12 * 3600e3 ? 'да' : 'нет' })
        .then(function () {
          var all = visits();
          all.forEach(function (x) { if (x.id === v.id) x.status = 'cancelled'; });
          saveVisits(all);
          renderCabinet(); renderMasters(); heroWindow();
          FB.toast('Запись ' + v.id + ' отменена', 'ok');
        })
        .catch(function (err) { btn.disabled = false; FB.toast('Не получилось отменить: ' + err.message + '. Напишите нам в Telegram.', 'error', 7000); });
    }
  });
  FB.$('#cabBody').addEventListener('click', function (e) { if (e.target.closest('[data-cancel-no]')) e.target.closest('[data-confirm-box]').innerHTML = ''; });
  FB.$('#cabBody').addEventListener('focusin', function (e) { if (e.target.id === 'cxPhone' && !e.target.__mask) { e.target.__mask = 1; FB.phoneMask(e.target); } });
  function loadVisit(v) {
    state.basket = [];
    bk.masters = {};
    v.segs.forEach(function (s) { s.ids.forEach(function (id) { state.basket.push(id); }); bk.masters[s.cat] = s.m; });
    saveBasket(); renderServices();
    if (v.branch !== state.branch) setBranch(v.branch, true);
  }

  FB.$('#lookup').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = FB.$('#lkId').value.trim(), out = FB.$('#lkOut');
    if (!id) { out.textContent = 'Введите номер записи из подтверждения'; return; }
    out.textContent = 'Ищем…';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.textContent = 'Запись ' + id.toUpperCase() + ' не нашли. Проверьте номер или напишите нам в Telegram.'; return; }
      var L = { new: 'ждёт подтверждения администратора', qualified: 'ждёт подтверждения администратора', confirmed: 'подтверждена', in_work: 'подтверждена', done: 'состоялась', repeat: 'состоялась', canceled: 'отменена' };
      var l = r.lead || {};
      out.textContent = 'Запись ' + r.id + ': ' + (L[r.status] || r.status) + (l.date ? ' · ' + whenText(l.date, l.time) : '') + (l.service ? ' · ' + l.service : '');
    });
  });

  /* ================================================================ абонементы и сертификаты */

  FB.$('#subs').innerHTML = SUBS.map(function (s) {
    return '<article class="sub"><div class="sub__img">' + img(s.img, '') + '</div><div><h4>' + s.name + '</h4><p>' + s.note + '</p>' +
      '<div class="sub__price"><b>' + FB.money(s.price) + '</b><s>' + FB.money(s.old) + '</s><i>−' + FB.money(s.old - s.price) + '</i></div>' +
      '<button class="btn btn--line btn--sm" type="button" data-sub="' + s.id + '">Оформить</button></div></article>';
  }).join('');
  FB.$('#subs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sub]');
    if (!b) return;
    var s = SUBS.filter(function (x) { return x.id === b.getAttribute('data-sub'); })[0];
    FB.$('#subTitle').textContent = s.name + ' за ' + FB.money(s.price);
    FB.$('#subInfo').textContent = s.note + '. Действует 4 месяца в обоих салонах. Администратор свяжется, чтобы оформить и принять оплату.';
    FB.$('#subPlan').value = s.name + ' — ' + FB.money(s.price);
    FB.$('#subForm').hidden = false;
    var done = FB.$('#subDone'); if (done) done.remove();
    FB.modal.open('subscription', b);
  });
  FB.form(FB.$('#subForm'), {
    type: 'subscription',
    success: function (res) {
      FB.$('#subForm').hidden = true;
      FB.$('#subForm').insertAdjacentHTML('afterend', '<div class="done" id="subDone"><div class="done__num">' + FB.esc(res.id) + '</div><p>Заявка на абонемент принята. Администратор позвонит в течение 30 минут в рабочее время.</p><button class="btn btn--line" type="button" data-close>Хорошо</button></div>');
    }
  });

  (function certificate() {
    var f = FB.$('#certForm');
    FB.$('#certService').innerHTML = SERVICES.filter(function (s) { return s.price >= 1200; }).map(function (s) { return '<option value="' + s.id + '">' + s.name + ' — ' + FB.money(s.price) + '</option>'; }).join('');
    var dt = FB.$('#certDate');
    dt.min = FB.iso(FB.today());
    dt.value = FB.iso(FB.today());
    function val() {
      var a = (FB.$('input[name=amount]:checked', f) || {}).value;
      if (a === 'custom') return +FB.$('#certSum').value || 0;
      if (a === 'service') return SVC[FB.$('#certService').value].price;
      return +a;
    }
    function upd() {
      var a = (FB.$('input[name=amount]:checked', f) || {}).value;
      FB.$('#certCustom').hidden = a !== 'custom';
      FB.$('#certSvc').hidden = a !== 'service';
      FB.$('#certSum').toggleAttribute('data-validate', a === 'custom');
      if (a === 'custom') FB.$('#certSum').setAttribute('data-validate', 'required');
      FB.$('#certMailRow').hidden = (FB.$('input[name=delivery]:checked', f) || {}).value !== 'email';
      var live = FB.$('#certLive');
      live.setAttribute('data-design', (FB.$('input[name=design]:checked', f) || {}).value);
      FB.$('#clSum').textContent = a === 'service' ? SVC[FB.$('#certService').value].name : (val() ? FB.money(val()) : '— ₽');
      var to = FB.$('#certTo').value.trim(), from = FB.$('#certFrom').value.trim();
      FB.$('#clTo').textContent = (to || 'подарок') + (from ? ' · ' + from : '');
      FB.$('#clMsg').textContent = FB.$('#certMsg').value.trim();
    }
    f.addEventListener('input', upd);
    f.addEventListener('change', upd);
    upd();
    FB.form(f, {
      type: 'certificate',
      before: function () {
        var v = val();
        if (v < 1000 || v > 50000) return 'Номинал — от 1 000 до 50 000 ₽';
        return true;
      },
      collect: function (fd) {
        var a = fd.get('amount');
        return { amount: val(), service: a === 'service' ? SVC[fd.get('service')].name : undefined, customSum: undefined, total: val() };
      },
      success: function (res, p) {
        f.hidden = true;
        f.insertAdjacentHTML('afterend', '<div class="done" id="certDone"><p class="eyebrow">Сертификат оформлен</p><div class="done__num">' + FB.esc(res.id) + '</div><p>' + FB.money(p.amount) + (p.service ? ' на «' + p.service + '»' : '') + '. Ссылку на оплату пришлём по SMS в течение 15 минут. ' +
          (p.delivery === 'email' ? 'После оплаты сертификат придёт получателю на почту ' + FB.fmtDate(FB.parseIso(p.sendDate), { day: 'numeric', month: 'long' }) + '.' : 'Заберите его в салоне в подарочном конверте.') + '</p>' +
          '<button class="btn btn--line" type="button" data-cert-again>Оформить ещё один</button></div>');
      }
    });
    FB.$('#certificate').addEventListener('click', function (e) {
      if (!e.target.closest('[data-cert-again]')) return;
      FB.$('#certDone').remove();
      f.hidden = false;
      dt.value = FB.iso(FB.today());
      upd();
    });
    // превью на странице покачивается за курсором
    var prev = FB.$('#certPreview');
    if (!FB.reduced && matchMedia('(hover: hover)').matches) {
      FB.$('.cert').addEventListener('mousemove', function (e) {
        var r = prev.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        prev.style.transform = 'rotate(-2deg) perspective(800px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg)';
      });
      FB.$('.cert').addEventListener('mouseleave', function () { prev.style.transform = ''; });
    }
  })();

  /* ================================================================ отзывы */

  (function reviews() {
    var track = FB.$('#revTrack');
    track.innerHTML = REVIEWS.map(function (r) {
      return '<article class="rev"><div class="rev__stars" aria-label="Оценка ' + r.r + ' из 5">' + '★★★★★'.slice(0, r.r) + '<span style="opacity:.25">' + '★★★★★'.slice(r.r) + '</span></div>' +
        '<p>' + r.t + '</p>' + (r.ph.length ? '<div class="rev__ph">' + r.ph.map(function (p) { return img(p, 'Фото к отзыву'); }).join('') + '</div>' : '') +
        '<div class="rev__foot"><span><b>' + r.n + '</b> · ' + r.svc + ', ' + MS[r.m].name + '</span><span class="src">' + r.src + ' · ' + r.d + '</span></div></article>';
    }).join('');
    function by(d) { var c = track.firstElementChild; track.scrollBy({ left: d * (c ? c.offsetWidth + 16 : 320), behavior: FB.reduced ? 'auto' : 'smooth' }); }
    FB.$$('[data-rev]').forEach(function (b) { b.addEventListener('click', function () { by(+b.getAttribute('data-rev')); }); });
    track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); by(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); by(-1); } });
    track.setAttribute('data-lenis-prevent-horizontal', '');
  })();

  /* ================================================================ контакты */

  var contactTabs = FB.tabs(FB.$('#cTabs'), function (tab) {
    var b = BRANCHES[tab.getAttribute('data-cb')];
    FB.$('#cPanel').innerHTML = '<dl><div><dt>Адрес</dt><dd>' + b.addr + '</dd></div><div><dt>Часы</dt><dd>' + b.hours + '</dd></div>' +
      '<div><dt>Телефон</dt><dd><a href="tel:' + b.phone.replace(/[^\d+]/g, '') + '">' + b.phone + '</a></dd></div><div><dt>Как найти</dt><dd>' + b.how + '</dd></div><div><dt>Парковка</dt><dd>' + b.park + '</dd></div></dl>' +
      '<div class="btns"><button class="btn btn--light" type="button" data-book-branch="' + tab.getAttribute('data-cb') + '">Записаться сюда</button>' +
      '<a class="btn btn--line" href="https://yandex.ru/maps/?text=' + encodeURIComponent(b.full) + '" target="_blank" rel="noopener">Маршрут в Яндекс Картах</a></div>';
    var pin = FB.$('#mapPin');
    pin.style.left = b.pin[0] + '%';
    pin.style.top = b.pin[1] + '%';
    pin.querySelector('b').textContent = 'пудра · ' + b.name;
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-book-branch]');
    if (!b) return;
    var br = b.getAttribute('data-book-branch');
    if (br !== state.branch) setBranch(br, true);
    openBooking({});
  });

  /* ================================================================ параллакс и старт */

  if (!FB.reduced) {
    var par = FB.$$('[data-parallax]');
    FB.onScroll(function (y) {
      if (y > window.innerHeight * 1.2) return;
      par.forEach(function (el) { el.style.transform = 'translate3d(0,' + (y * parseFloat(el.getAttribute('data-parallax'))) + 'px,0)'; });
    });
  }

  // «Мои записи» в мобильном меню — кнопка, а не ссылка: закрываем меню сами
  FB.$('.nav__cab').addEventListener('click', function () {
    var bg = FB.$('.burger');
    if (bg.getAttribute('aria-expanded') === 'true') bg.click();
  });

  renderServices();
  renderWorks();
  renderBasket();
  setBranch(state.branch, true);
})();
