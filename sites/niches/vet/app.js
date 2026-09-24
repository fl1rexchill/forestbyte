/* Хвост — ветклиника. Плановое и срочное разведены с первого экрана. Профиль владельца с несколькими питомцами
   (карточка: вид, порода, возраст, вес, аллергии, прививки), напоминания о вакцинации и обработках, запись
   питомец → услуга и врач → время → контакты с документами, история визитов и повторный приём, проверка готовности
   анализа, экстренный сценарий «предупредить, что едем». Сайт не ставит диагнозы. */
(function () {
  'use strict';

  /* ================================================================ справочники */

  var SPECIES = { dog: 'Собака', cat: 'Кошка', rabbit: 'Кролик', ferret: 'Хорёк', rodent: 'Грызун', bird: 'Птица' };
  var EXOTIC = ['rabbit', 'ferret', 'rodent', 'bird'];
  var SPECS = { therapy: 'Терапевт', surgery: 'Хирург, травматолог', cardio: 'Кардиолог, УЗИ', dental: 'Стоматолог', exotic: 'Экзотические животные', derm: 'Дерматолог' };
  var DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  var DOCTORS = [
    { id: 'lebedeva', name: 'Анна Лебедева', spec: ['therapy'], sp: 'dogcat', exp: 12, days: [1, 2, 3, 4, 5], from: 9, to: 18, note: 'Первичные приёмы, вакцинация, хронические болезни' },
    { id: 'kim', name: 'Сергей Ким', spec: ['therapy'], sp: 'dogcat', exp: 5, days: [6, 7, 1, 3], from: 12, to: 21, note: 'Терапия, вакцинация, приёмы по вечерам и выходным' },
    { id: 'maltsev', name: 'Игорь Мальцев', spec: ['surgery'], sp: 'all', exp: 15, days: [1, 3, 5, 6], from: 10, to: 19, note: 'Плановая хирургия, ортопедия, рентген' },
    { id: 'klimova', name: 'Дарья Климова', spec: ['cardio'], sp: 'dogcat', exp: 8, days: [2, 4, 6], from: 9, to: 17, note: 'Кардиология, УЗИ брюшной полости, ЭхоКГ' },
    { id: 'safin', name: 'Олег Сафин', spec: ['dental'], sp: 'dogcat', exp: 9, days: [1, 2, 4], from: 12, to: 21, note: 'Осмотр зубов, чистка, удаление под седацией' },
    { id: 'tkach', name: 'Мария Ткач', spec: ['exotic'], sp: 'exotic', exp: 7, days: [2, 3, 5, 7], from: 10, to: 19, note: 'Кролики, хорьки, грызуны, птицы' },
    { id: 'rudneva', name: 'Екатерина Руднева', spec: ['derm', 'therapy'], sp: 'dogcat', exp: 6, days: [3, 4, 5, 6, 7], from: 12, to: 21, note: 'Кожа и шерсть, аллергии, терапия' }
  ];
  var DOC = {};
  DOCTORS.forEach(function (d) { DOC[d.id] = d; });
  var LAB = { id: 'lab', name: 'Процедурный кабинет', spec: ['lab'], sp: 'all', days: [1, 2, 3, 4, 5, 6, 7], from: 9, to: 13 };

  var CATS = [['visit', 'Приёмы'], ['vac', 'Прививки и чип'], ['diag', 'Диагностика'], ['lab', 'Анализы'], ['surg', 'Хирургия'], ['dent', 'Стоматология']];
  var SERVICES = [
    { id: 'first', cat: 'visit', name: 'Первичный приём терапевта', price: 1200, min: 30, spec: 'therapy', sp: 'dogcat', desc: 'Осмотр, сбор истории, план обследования и лечения' },
    { id: 'repeat', cat: 'visit', name: 'Повторный приём', price: 700, min: 30, spec: 'any', sp: 'all', desc: 'В течение 14 дней после первичного по тому же поводу' },
    { id: 'narrow', cat: 'visit', name: 'Консультация узкого специалиста', price: 1800, min: 45, spec: ['cardio', 'derm', 'surgery', 'dental'], sp: 'dogcat', desc: 'Кардиолог, дерматолог, хирург или стоматолог' },
    { id: 'exo', cat: 'visit', name: 'Приём экзотического животного', price: 1400, min: 30, spec: 'exotic', sp: 'exotic', desc: 'Кролики, хорьки, грызуны, птицы' },
    { id: 'vacdog', cat: 'vac', name: 'Комплексная прививка собаке', price: 1900, min: 30, spec: 'therapy', sp: 'dog', desc: 'Осмотр перед прививкой и отметка в ветпаспорте входят в цену', prep: ['За 10–14 дней — обработка от глистов'] },
    { id: 'vaccat', cat: 'vac', name: 'Комплексная прививка кошке', price: 1700, min: 30, spec: 'therapy', sp: 'cat', desc: 'Осмотр перед прививкой и отметка в ветпаспорте входят в цену', prep: ['За 10–14 дней — обработка от глистов'] },
    { id: 'rabies', cat: 'vac', name: 'Прививка от бешенства', price: 900, min: 30, spec: 'therapy', sp: 'dogcat', desc: 'Обязательна для выезда и выставок' },
    { id: 'vacrab', cat: 'vac', name: 'Прививка кролику', price: 1500, min: 30, spec: 'exotic', sp: 'exotic', desc: 'Миксоматоз и ВГБК' },
    { id: 'chip', cat: 'vac', name: 'Чипирование с регистрацией в базе', price: 1500, min: 30, spec: ['therapy', 'exotic'], sp: 'all', desc: 'Международный чип ISO, внесём в базу Animal-ID' },
    { id: 'uzi', cat: 'diag', name: 'УЗИ брюшной полости', price: 1900, min: 45, spec: 'cardio', sp: 'dogcat', fast: 8, desc: 'Заключение врача сразу после исследования' },
    { id: 'echo', cat: 'diag', name: 'Эхокардиография (УЗИ сердца)', price: 2500, min: 45, spec: 'cardio', sp: 'dogcat', desc: 'С ЭКГ и консультацией кардиолога' },
    { id: 'xray', cat: 'diag', name: 'Рентген, 2 проекции', price: 1400, min: 30, spec: 'surgery', sp: 'all', desc: 'Цифровой снимок, файл отправим вам' },
    { id: 'blood', cat: 'lab', name: 'Общий анализ крови', price: 700, min: 30, spec: 'lab', sp: 'all', fast: 8, ready: '1 рабочий день', desc: 'Кровь берём в процедурном кабинете с 9:00 до 13:00' },
    { id: 'bio', cat: 'lab', name: 'Биохимия крови, 16 показателей', price: 1400, min: 30, spec: 'lab', sp: 'all', fast: 8, ready: '1 рабочий день', desc: 'Можно сдать вместе с общим анализом' },
    { id: 'urine', cat: 'lab', name: 'Общий анализ мочи', price: 500, min: 30, spec: 'lab', sp: 'all', ready: 'в тот же день', desc: 'Стерильный контейнер выдадим бесплатно' },
    { id: 'checkup', cat: 'lab', name: 'Чекап «Здоров»: осмотр, кровь, биохимия, УЗИ', price: 4900, min: 90, spec: 'therapy', sp: 'dogcat', fast: 10, ready: '1 рабочий день', desc: 'Раз в год, с 7 лет — раз в полгода' },
    { id: 'castcat', cat: 'surg', name: 'Кастрация кота', price: 3500, min: 60, spec: 'surgery', sp: 'cat', fast: 10, desc: 'Наркоз, операция, попона и наблюдение до пробуждения', prep: ['За 1–10 дней — осмотр и анализ крови'] },
    { id: 'stercat', cat: 'surg', name: 'Стерилизация кошки', price: 6500, min: 90, spec: 'surgery', sp: 'cat', fast: 12, desc: 'Наркоз, операция, попона и наблюдение до пробуждения', prep: ['За 1–10 дней — осмотр и анализ крови'] },
    { id: 'castdog', cat: 'surg', name: 'Кастрация кобеля', price: 6000, min: 90, spec: 'surgery', sp: 'dog', fast: 12, desc: 'Цена зависит от веса — уточним на осмотре', prep: ['За 1–10 дней — осмотр, анализы, для собак старше 6 лет — ЭхоКГ'] },
    { id: 'dentexam', cat: 'dent', name: 'Осмотр стоматолога', price: 1200, min: 30, spec: 'dental', sp: 'dogcat', desc: 'Оценка зубов и дёсен, план лечения' },
    { id: 'dentclean', cat: 'dent', name: 'Ультразвуковая чистка зубов под седацией', price: 4500, min: 60, spec: 'dental', sp: 'dogcat', fast: 10, desc: 'С полировкой; удаление зубов — отдельно', prep: ['За 1–10 дней — осмотр стоматолога и анализ крови'] }
  ];
  var SVC = {};
  SERVICES.forEach(function (s) { SVC[s.id] = s; });

  var REVIEWS = [
    { n: 'Ольга М.', pet: 'кошка Мила', img: 'siamese', r: 5, src: 'Яндекс Карты', d: 'сентябрь', t: 'Записалась вечером на сайте, утром уже были у Анны Викторовны. Отдельный зал для кошек — Мила впервые не шипела в очереди.' },
    { n: 'Артём К.', pet: 'бигль Бакс', img: 'beagle', r: 5, src: '2ГИС', d: 'сентябрь', t: 'Бакс съел носок. Позвонили по дороге, нас уже ждали — сделали рентген и всё решили без операции. Спасибо дежурной смене.' },
    { n: 'Наталья С.', pet: 'кролик Пирожок', img: 'kitten', r: 5, src: 'Яндекс Карты', d: 'август', t: 'Сложно найти врача для кролика. Мария Сергеевна всё объяснила про питание и зубы, дала памятку.' },
    { n: 'Денис П.', pet: 'лабрадор Граф', img: 'labr', r: 4, src: '2ГИС', d: 'август', t: 'Хорошая клиника, но в субботу пришлось подождать 15 минут. Зато кардиолог очень подробно рассказала про УЗИ сердца.' },
    { n: 'Ирина В.', pet: 'хаски Нора', img: 'husky', r: 5, src: 'Яндекс Карты', d: 'июль', t: 'Приходят напоминания о прививке и обработке от клещей — я бы сама забыла. Удобно, что в кабинете видно всю историю.' },
    { n: 'Мария Л.', pet: 'кошка Соня', img: 'catsleep', r: 5, src: 'Яндекс Карты', d: 'июль', t: 'Стерилизация прошла спокойно, вечером прислали сообщение, как она себя чувствует, и памятку по уходу.' }
  ];

  var BRING = [
    ['Ветпаспорт или справка о прививках', ''],
    ['Анализы и выписки из других клиник', 'Можно загрузить заранее — врач посмотрит до приёма'],
    ['Переноска или поводок и намордник', 'Кошки и мелкие собаки — только в переноске'],
    ['Лекарства, которые питомец получает сейчас', 'Или фото упаковок'],
    ['Пелёнка и влажные салфетки', ''],
    ['Перед УЗИ, анализами и операциями — не кормить 8–12 часов', 'Воду можно, если врач не сказал иначе'],
    ['Список вопросов врачу', 'В кабинете легко забыть']
  ];

  /* ================================================================ утилиты */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function dow(d) { var x = d.getDay(); return x === 0 ? 7 : x; }
  function speciesOk(sp, species) {
    if (!species) return true;
    if (sp === 'all') return true;
    if (sp === 'dogcat') return species === 'dog' || species === 'cat';
    if (sp === 'exotic') return EXOTIC.indexOf(species) > -1;
    return sp === species;
  }
  function spGroupOk(sp, filter) {
    if (filter === 'all') return true;
    if (filter === 'exotic') return sp === 'all' || sp === 'exotic';
    return sp === 'all' || sp === 'dogcat' || sp === filter;
  }
  function whenText(dateIso, time) {
    var d = FB.parseIso(dateIso), diff = Math.round((d - FB.today()) / 864e5);
    var day = diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : FB.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
    return day + (time ? ', ' + time : '');
  }
  function ageText(birth) {
    if (!birth) return '';
    var d = FB.parseIso(birth), now = FB.today(), m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
    if (m < 0) return '';
    if (m < 3) { var w = Math.floor((now - d) / 6048e5); return w + ' ' + FB.plural(w, ['неделя', 'недели', 'недель']); }
    if (m < 12) return m + ' ' + FB.plural(m, ['месяц', 'месяца', 'месяцев']);
    var y = Math.floor(m / 12);
    return y + ' ' + FB.plural(y, ['год', 'года', 'лет']);
  }
  function ageYears(birth) { return birth ? (FB.today() - FB.parseIso(birth)) / (365.25 * 864e5) : null; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  var PAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="17.5" cy="10" r="2"/><path d="M8 17c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5c0 1.6-1.4 2.5-4 2.5s-4-.9-4-2.5z"/></svg>';

  /* ================================================================ расписание */

  function worksOn(doc, dateIso) { return doc.days.indexOf(dow(FB.parseIso(dateIso))) > -1; }
  function cellsOf(doc) { var out = []; for (var m = doc.from * 60; m < doc.to * 60; m += 30) out.push(hm(m)); return out; }
  var busyCache = {};
  function busySet(doc, dateIso) {
    var key = doc.id + '|' + dateIso;
    if (!busyCache[key]) {
      var rnd = FB.seeded('vet|' + key), set = {}, cells = cellsOf(doc), i = 0;
      while (i < cells.length) {
        if (rnd() < (doc.id === 'lab' ? 0.35 : 0.42)) { var len = 1 + Math.floor(rnd() * 3); for (var k = 0; k < len && i + k < cells.length; k++) set[cells[i + k]] = 1; i += len; }
        else i += 1 + Math.floor(rnd() * 2);
      }
      busyCache[key] = set;
    }
    var out = Object.assign({}, busyCache[key]);
    visits().forEach(function (v) {
      if (v.status !== 'upcoming' || v.doc !== doc.id || v.date !== dateIso) return;
      for (var m = mins(v.time); m < mins(v.time) + v.min; m += 30) out[hm(m)] = 1;
    });
    (serverBusy[key] || []).forEach(function (t) { out[t] = 1; });
    return out;
  }
  var serverBusy = {};
  function loadServerBusy(docs, dateIso, done) {
    if (!FB.lead.isServer() || !docs.length) return;
    var left = docs.length;
    docs.forEach(function (d) {
      FB.lead.busy(d.id, dateIso, [], 0).then(function (list) { serverBusy[d.id + '|' + dateIso] = list; if (--left === 0) done(); });
    });
  }
  function freeAt(doc, dateIso, time, min) {
    if (!worksOn(doc, dateIso)) return false;
    if (FB.isPastSlot(dateIso, time)) return false;
    var b = busySet(doc, dateIso), end = mins(time) + Math.ceil(min / 30) * 30;
    if (end > doc.to * 60) return false;
    for (var m = mins(time); m < end; m += 30) if (b[hm(m)]) return false;
    return true;
  }
  function nearest(doc, min) {
    var days = FB.days(14);
    for (var i = 0; i < days.length; i++) {
      var iso = FB.iso(days[i]);
      if (!worksOn(doc, iso)) continue;
      var cells = cellsOf(doc);
      for (var c = 0; c < cells.length; c++) if (freeAt(doc, iso, cells[c], min || 30)) return { date: iso, time: cells[c] };
    }
    return null;
  }
  function doctorsFor(svc, species) {
    if (svc.spec === 'lab') return [LAB];
    var specs = svc.spec === 'any' ? null : [].concat(svc.spec);
    return DOCTORS.filter(function (d) {
      return (!specs || d.spec.some(function (s) { return specs.indexOf(s) > -1; })) && speciesOk(d.sp, species);
    });
  }

  /* ================================================================ хранилище: владелец, питомцы, визиты */

  function pets() { return FB.store.get('pets', []); }
  function savePets(list) { FB.store.set('pets', list); updatePetBadges(); }
  function owner() { return FB.store.get('owner', {}); }
  var visitsCache = null;
  function visits() {
    if (visitsCache) return visitsCache;
    var list = FB.store.get('visits', []), now = Date.now(), changed = false;
    list.forEach(function (v) {
      if (v.status !== 'upcoming') return;
      var d = FB.parseIso(v.date); d.setMinutes(mins(v.time) + v.min);
      if (d.getTime() < now) { v.status = 'done'; changed = true; }
    });
    if (changed) FB.store.set('visits', list);
    visitsCache = list;
    setTimeout(function () { visitsCache = null; }, 0);
    return list;
  }
  function saveVisits(list) { visitsCache = null; FB.store.set('visits', list.slice(0, 60)); }

  /* ================================================================ профилактика: общая схема */

  var VAC_LABEL = { complex: 'Комплексная прививка', rabies: 'Бешенство', worm: 'От глистов', ticks: 'От клещей и блох' };
  function lastOf(vacs, types) {
    return (vacs || []).filter(function (v) { return types.indexOf(v.type) > -1 && v.date; }).map(function (v) { return v.date; }).sort().pop() || null;
  }
  function addD(iso, n) { return FB.iso(FB.addDays(FB.parseIso(iso), n)); }
  function status(iso) {
    var diff = Math.round((FB.parseIso(iso) - FB.today()) / 864e5);
    return diff < 0 ? 'late' : diff <= 14 ? 'soon' : 'plan';
  }

  /** Ориентировочный график. Возвращает [{key,title,date,note,svc}] — окончательную схему назначает врач. */
  function schedule(p) {
    var out = [], today = FB.iso(FB.today()), sp = p.species, age = ageYears(p.birth);
    var lastVac = lastOf(p.vacs, ['complex']), lastRab = lastOf(p.vacs, ['rabies']), lastWorm = lastOf(p.vacs, ['worm']), lastTicks = lastOf(p.vacs, ['ticks']);
    var vacSvc = sp === 'dog' ? 'vacdog' : sp === 'cat' ? 'vaccat' : sp === 'rabbit' ? 'vacrab' : null;
    if (sp === 'dog' || sp === 'cat' || sp === 'rabbit') {
      if (lastVac) out.push({ key: 'vac', title: 'Ежегодная прививка', date: addD(lastVac, 365), note: sp === 'rabbit' ? 'миксоматоз и ВГБК' : 'комплексная' + (lastRab ? '' : ' + бешенство'), svc: vacSvc });
      else if (p.birth && age < 16 / 52) {
        var w8 = addD(p.birth, 56), w12 = addD(p.birth, 84);
        out.push({ key: 'vac1', title: 'Первая прививка', date: w8 < today ? today : w8, note: 'с 8 недель, после обработки от глистов', svc: vacSvc });
        out.push({ key: 'vac2', title: 'Вторая прививка' + (sp === 'rabbit' ? '' : ' + бешенство'), date: w12 < today ? addD(today, 21) : w12, note: 'через 3–4 недели после первой', svc: vacSvc });
      } else if (p.birth) out.push({ key: 'vac', title: 'Прививка', date: today, note: 'если прививок не было или дата неизвестна — лучше не откладывать', svc: vacSvc });
      if ((sp === 'dog' || sp === 'cat') && lastRab && (!lastVac || Math.abs(FB.parseIso(lastRab) - FB.parseIso(lastVac)) > 30 * 864e5)) {
        out.push({ key: 'rab', title: 'Бешенство', date: addD(lastRab, 365), note: 'раз в год', svc: 'rabies' });
      }
    }
    if (sp === 'dog' || sp === 'cat' || sp === 'ferret') {
      out.push({ key: 'worm', title: 'Обработка от глистов', date: lastWorm ? addD(lastWorm, 90) : today, note: 'раз в 3 месяца', mark: 'worm' });
      if (sp === 'dog' || p.outdoor !== false) {
        var now = FB.today(), m = now.getMonth() + 1, next;
        if (lastTicks) next = addD(lastTicks, 30); else next = today;
        var nd = FB.parseIso(next), nm = nd.getMonth() + 1;
        if (nm < 4 || nm > 10) next = FB.iso(new Date(nd.getFullYear() + (nm > 10 ? 1 : 0), 3, 1));
        out.push({ key: 'ticks', title: 'Защита от клещей и блох', date: next, note: m >= 4 && m <= 10 ? 'сезон: апрель — октябрь, раз в месяц' : 'сезон начнётся в апреле', mark: 'ticks' });
      }
    }
    if (sp === 'dog' || sp === 'cat') {
      var vacDate = (out.filter(function (x) { return x.key === 'vac'; })[0] || {}).date;
      var ck = age != null && age >= 7 ? (vacDate && addD(vacDate, -182) > today ? addD(vacDate, -182) : vacDate || today) : vacDate;
      if (ck) out.push({ key: 'check', title: age >= 7 ? 'Чекап (с 7 лет — раз в полгода)' : 'Ежегодный чекап', date: ck, note: 'удобно совместить с прививкой', svc: 'checkup' });
    }
    if (EXOTIC.indexOf(sp) > -1 && sp !== 'rabbit') out.push({ key: 'exo', title: 'Профилактический осмотр', date: addD(today, 30), note: 'врач по экзотическим животным, раз в год', svc: 'exo' });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  function icsDate(iso) { return iso.replace(/-/g, ''); }
  function icsEvents(items, prefix) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hvost vet//RU'];
    items.forEach(function (it, i) {
      lines.push('BEGIN:VEVENT', 'UID:' + Date.now() + '-' + i + '@hvost', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(it.date), 'DTEND;VALUE=DATE:' + icsDate(addD(it.date, 1)),
        'SUMMARY:' + (prefix ? prefix + ': ' : '') + it.title, 'DESCRIPTION:' + (it.note || '').replace(/,/g, '\\,') + '. Записаться: +7 (342) 200-03-00',
        'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', 'DESCRIPTION:Через 3 дня: ' + it.title, 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ старт ядра: число врачей сегодня */

  (function todayDocs() {
    var iso = FB.iso(FB.today()), on = DOCTORS.filter(function (d) { return worksOn(d, iso); });
    var c = FB.$('.tile--stat [data-count]');
    c.setAttribute('data-count', on.length);
    c.textContent = on.length;
    FB.$('.tile--stat b').lastChild.textContent = ' ' + FB.plural(on.length, ['врач', 'врача', 'врачей']);
    FB.$('#heroDocs').textContent = on.map(function (d) { return d.name.split(' ')[0] + ' (' + SPECS[d.spec[0]].split(',')[0].toLowerCase() + ')'; }).join(', ') + '. Дежурный врач — круглосуточно.';
  })();
  FB.init();

  /* ================================================================ бенто: ближайшее время, питомцы */

  function heroNext() {
    var best = null;
    DOCTORS.filter(function (d) { return d.spec.indexOf('therapy') > -1; }).forEach(function (d) {
      var n = nearest(d, 30);
      if (n && (!best || n.date + n.time < best.date + best.time)) best = Object.assign({ d: d }, n);
    });
    FB.$('#heroNext').textContent = best ? 'Ближайшее к терапевту: ' + whenText(best.date, best.time).toLowerCase() : 'Свободного времени на 2 недели нет — позвоните';
  }
  function updatePetBadges() {
    var list = pets(), b = FB.$('#petCount');
    b.hidden = !list.length;
    b.textContent = list.length;
    if (!list.length) {
      FB.$('#heroPets').textContent = 'Карточки питомцев и напоминания о прививках';
      FB.$('#heroPetsNext').textContent = 'Добавьте питомца — напомним о прививке и обработке';
      return;
    }
    var all = [];
    list.forEach(function (p) { schedule(p).forEach(function (it) { all.push(Object.assign({ pet: p.name }, it)); }); });
    all.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    FB.$('#heroPets').textContent = list.map(function (p) { return p.name; }).join(', ');
    var n = all[0];
    FB.$('#heroPetsNext').textContent = n ? (status(n.date) === 'late' ? 'Пора: ' : 'Следующее: ') + n.title.toLowerCase() + ' — ' + n.pet + ', ' + (status(n.date) === 'late' ? 'просрочено' : whenText(n.date).toLowerCase()) : 'Напоминаний пока нет';
  }
  document.addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]');
    if (j) { FB.scrollTo(j.getAttribute('data-jump')); setTimeout(function () { FB.$('#labId').focus({ preventScroll: true }); }, 700); }
  });

  /* ================================================================ услуги */

  var svcCat = 'visit', svcSp = 'all';
  (function servicesUI() {
    var tabs = FB.$('#svcTabs');
    tabs.innerHTML = CATS.map(function (c, i) {
      var n = SERVICES.filter(function (s) { return s.cat === c[0]; }).length;
      return '<button type="button" role="tab" id="st-' + c[0] + '" aria-controls="svcPanel" aria-selected="' + (i === 0) + '" data-c="' + c[0] + '">' + c[1] + '<span>' + n + '</span></button>';
    }).join('');
    FB.tabs(tabs, function (t) { svcCat = t.getAttribute('data-c'); renderServices(); });
    FB.$('#svcSpecies').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sp]');
      if (!b) return;
      svcSp = b.getAttribute('data-sp');
      FB.$$('[data-sp]', this).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      renderServices();
    });
    FB.$('#svcTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-book-svc]');
      if (b) openBooking({ svc: b.getAttribute('data-book-svc') });
    });
  })();
  function svcChips(s) {
    var c = [];
    if (s.fast) c.push('<span class="chip chip--warn">натощак ' + s.fast + ' ч</span>');
    if (s.ready) c.push('<span class="chip">результат: ' + s.ready + '</span>');
    if (s.prep) c.push('<span class="chip chip--warn">' + s.prep[0].replace(/^За /, 'за ') + '</span>');
    var who = s.spec === 'lab' ? 'процедурный кабинет' : s.spec === 'any' ? 'любой врач' : [].concat(s.spec).map(function (x) { return SPECS[x].split(',')[0].toLowerCase(); }).join(' / ');
    c.push('<span class="chip">' + who + '</span>');
    return c.join('');
  }
  function renderServices() {
    var list = SERVICES.filter(function (s) { return s.cat === svcCat && spGroupOk(s.sp, svcSp); });
    FB.$('#svcTable').innerHTML = list.length ? list.map(function (s, i) {
      return '<div class="svc-row" style="--i:' + i + '"><div><h3>' + s.name + '</h3><p>' + s.desc + '</p><div class="chips">' + svcChips(s) + '</div></div>' +
        '<span class="svc-row__dur">' + s.min + ' мин</span><span class="svc-row__price"><small>от</small>' + FB.money(s.price) + '</span>' +
        '<button class="btn btn--line btn--sm" type="button" data-book-svc="' + s.id + '">Записаться</button></div>';
    }).join('') : '<p class="svc-empty">В этом разделе нет услуг для выбранного вида. Выберите «Все» или позвоните — подскажем.</p>';
  }

  /* ================================================================ врачи */

  function renderDoctors() {
    FB.$('#docGrid').innerHTML = DOCTORS.map(function (d, i) {
      var first = SERVICES.filter(function (s) { return s.spec !== 'lab' && s.spec !== 'any' && [].concat(s.spec).some(function (x) { return d.spec.indexOf(x) > -1; }); })[0];
      var n = nearest(d, first ? first.min : 30);
      var ini = d.name.split(' ').map(function (p) { return p[0]; }).join('');
      return '<article class="doc" style="--i:' + i + '"><div class="doc__top"><span class="doc__av" aria-hidden="true">' + ini + '</span><div><h3>' + d.name + '</h3><p class="doc__spec">' + d.spec.map(function (s) { return SPECS[s]; }).join(' · ') + ' · стаж ' + d.exp + ' ' + FB.plural(d.exp, ['год', 'года', 'лет']) + '</p></div></div>' +
        '<p>' + d.note + '</p>' +
        '<div class="doc__tags"><span class="chip">' + (d.sp === 'exotic' ? 'экзоты' : d.sp === 'all' ? 'все виды' : 'собаки и кошки') + '</span><span class="chip">' + pad(d.from) + ':00–' + pad(d.to) + ':00</span></div>' +
        '<div class="doc__week" aria-label="Дни приёма: ' + d.days.slice().sort().map(function (x) { return DAYS[x - 1]; }).join(', ') + '">' + DAYS.map(function (x, k) { return '<span class="' + (d.days.indexOf(k + 1) > -1 ? 'on' : '') + '">' + x + '</span>'; }).join('') + '</div>' +
        '<div class="doc__slot"><span>Ближайшее окно<b>' + (n ? whenText(n.date, n.time) : 'нет на 2 недели') + '</b></span><button class="btn btn--navy btn--sm" type="button" data-doc="' + d.id + '"' + (n ? ' data-date="' + n.date + '" data-time="' + n.time + '"' : '') + '>Записаться</button></div></article>';
    }).join('');
  }
  FB.$('#docGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-doc]');
    if (!b) return;
    var d = DOC[b.getAttribute('data-doc')];
    var svc = SERVICES.filter(function (s) { return s.spec !== 'lab' && s.spec !== 'any' && [].concat(s.spec).some(function (x) { return d.spec.indexOf(x) > -1; }); })[0];
    openBooking({ svc: svc.id, doc: d.id, date: b.getAttribute('data-date'), time: b.getAttribute('data-time') });
  });

  /* ================================================================ профилактический календарь */

  (function calendar() {
    var f = FB.$('#calcForm'), plan = FB.$('#pcPlan'), icsA = FB.$('#pcIcs');
    FB.$('#pcBirth').max = FB.iso(FB.today());
    FB.$('#pcVac').max = FB.$('#pcWorm').max = FB.iso(FB.today());
    function data() {
      var p = { species: (FB.$('input[name=pcSp]:checked', f) || {}).value, birth: FB.$('#pcBirth').value, outdoor: FB.$('#pcOut').value === 'yes', vacs: [] };
      if (FB.$('#pcVac').value) p.vacs.push({ type: 'complex', date: FB.$('#pcVac').value }, { type: 'rabies', date: FB.$('#pcVac').value });
      if (FB.$('#pcWorm').value) p.vacs.push({ type: 'worm', date: FB.$('#pcWorm').value });
      return p;
    }
    var cur = [];
    function render() {
      var p = data();
      if (!p.birth && !p.vacs.length) {
        plan.innerHTML = '<li class="tl__empty">Укажите дату рождения или последней прививки — покажем даты.</li>';
        icsA.hidden = true; cur = []; return;
      }
      cur = schedule(p);
      icsA.hidden = false;
      plan.innerHTML = cur.map(function (it, i) {
        var st = status(it.date);
        return '<li class="is-' + st + '" style="--i:' + i + '"><b>' + it.title + (st === 'late' ? '<em>пора</em>' : st === 'soon' ? '<em>скоро</em>' : '') + '</b><span>' + (st === 'late' ? 'как можно скорее' : FB.fmtDate(it.date, { day: 'numeric', month: 'long', year: 'numeric' })) + ' · ' + it.note + '</span></li>';
      }).join('');
      if (icsA.href.indexOf('blob:') === 0) URL.revokeObjectURL(icsA.href);
      icsA.href = icsEvents(cur, 'Питомец');
    }
    f.addEventListener('input', render);
    f.addEventListener('change', render);
    render();
    FB.$('#pcSave').addEventListener('click', function () {
      var p = data();
      if (!p.birth && !p.vacs.length) { FB.toast('Сначала укажите дату рождения или прививки', 'error'); FB.$('#pcBirth').focus(); return; }
      openPetEdit(null, { species: p.species, birth: p.birth, vacs: p.vacs, outdoor: p.outdoor });
    });
  })();

  /* ================================================================ что взять */

  (function bring() {
    var done = FB.store.get('bring', []);
    FB.$('#bringList').innerHTML = BRING.map(function (b, i) {
      return '<li><label><input type="checkbox" data-bring="' + i + '"' + (done.indexOf(i) > -1 ? ' checked' : '') + '><span class="box" aria-hidden="true"></span><span>' + b[0] + (b[1] ? '<small>' + b[1] + '</small>' : '') + '</span></label></li>';
    }).join('');
    FB.$('#bringList').addEventListener('change', function (e) {
      var i = +e.target.getAttribute('data-bring');
      done = done.filter(function (x) { return x !== i; });
      if (e.target.checked) done.push(i);
      FB.store.set('bring', done);
    });
  })();

  /* ================================================================ анализы и документы */

  FB.$('#labForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = FB.$('#labId').value.trim(), out = FB.$('#labOut');
    out.classList.remove('is-ready');
    if (!id) { out.textContent = 'Введите номер из подтверждения записи'; return; }
    out.textContent = 'Проверяем…';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.innerHTML = '<b>Не нашли ' + FB.esc(id.toUpperCase()) + '</b>Проверьте номер или позвоните: +7 (342) 200-03-00.'; return; }
      var l = r.lead || {}, name = (l.pet || '').split(',')[0];
      if (r.status === 'done') {
        out.classList.add('is-ready');
        out.innerHTML = '<b>Результат готов' + (name ? ' — ' + FB.esc(name) : '') + '</b>Врач свяжется с вами сегодня и объяснит, что он значит, и что делать дальше. Сами показатели мы не расшифровываем по переписке.';
      } else if (r.status === 'canceled') {
        out.innerHTML = '<b>Заявка отменена</b>Если это ошибка — позвоните нам.';
      } else {
        out.innerHTML = '<b>В работе' + (l.service ? ': ' + FB.esc(l.service) : '') + '</b>Обычно результат готов за 1 рабочий день. Пришлём уведомление, как только он появится' + (FB.lead.isServer() ? '' : ' (в демо-режиме статус меняется в CRM при запущенном сервере)') + '.';
      }
    });
  });

  FB.files(FB.$('#docFiles'), { max: 6, maxSize: 10 * 1024 * 1024, list: FB.$('#docList') });
  FB.form(FB.$('#docForm'), {
    type: 'documents',
    before: function () { return (FB.$('#docFiles').fbFiles || []).length ? true : 'Приложите хотя бы один файл'; },
    success: function (res) { FB.toast('Документы переданы врачу, номер ' + res.id + '. Спасибо!', 'ok', 6000); }
  });

  /* ================================================================ срочно */

  var sosForm = FB.$('#sosForm');
  FB.form(sosForm, {
    type: 'emergency',
    success: function (res, p) {
      sosForm.hidden = true;
      sosForm.insertAdjacentHTML('afterend', '<div class="done" id="sosDone"><h3>Ждём вас через ' + FB.esc(p.eta) + '</h3><p>Дежурный врач предупреждён, номер обращения <b>' + FB.esc(res.id) + '</b>. Если питомцу станет хуже по дороге — звоните: <a href="tel:+73422000303">+7 (342) 200-03-03</a>.</p>' +
        '<a class="btn btn--line btn--sm" href="https://yandex.ru/maps/?text=%D0%9F%D0%B5%D1%80%D0%BC%D1%8C%2C%20%D1%83%D0%BB.%20%D0%A0%D0%B5%D0%B2%D0%BE%D0%BB%D1%8E%D1%86%D0%B8%D0%B8%2C%2022" target="_blank" rel="noopener">Открыть маршрут</a></div>');
      FB.track('emergency_notice', { id: res.id });
    }
  });
  FB.$('#sos').addEventListener('fb:open', function () {
    var d = FB.$('#sosDone');
    if (d) { d.remove(); sosForm.hidden = false; }
    var o = owner();
    if (o.name && !FB.$('#sName').value) FB.$('#sName').value = o.name;
    if (o.phone && !FB.$('#sPhone').value) FB.$('#sPhone').value = o.phone;
  });

  /* ================================================================ запись */

  var bk = { step: 1, pet: null, svc: null, doc: 'any', date: null, time: null, assigned: null, repeatOf: null };
  var form = FB.$('#bookForm');
  var bFiles = FB.files(FB.$('#bFiles'), { max: 6, maxSize: 10 * 1024 * 1024, list: FB.$('#bFileList') });

  function curSpecies() {
    if (bk.pet === 'new') return FB.$('#npSpecies').value;
    var p = pets().filter(function (x) { return x.id === bk.pet; })[0];
    return p ? p.species : null;
  }
  function openBooking(o) {
    o = o || {};
    FB.$('#bFlow').hidden = false;
    FB.$('#bDone').hidden = true;
    var list = pets();
    bk.pet = o.pet || (list.length ? (bk.pet && bk.pet !== 'new' && list.some(function (p) { return p.id === bk.pet; }) ? bk.pet : list[0].id) : 'new');
    bk.svc = o.svc || null;
    bk.doc = o.doc || 'any';
    bk.date = o.date || null;
    bk.time = o.time || null;
    bk.repeatOf = o.repeatOf || null;
    FB.$('#bMode').textContent = bk.repeatOf ? 'Повторный приём' : 'Запись на приём';
    var ow = owner();
    if (ow.name && !FB.$('#bName').value) FB.$('#bName').value = ow.name;
    if (ow.phone && !FB.$('#bPhone').value) FB.$('#bPhone').value = ow.phone;
    // нового питомца сначала нужно описать — начинаем с первого шага, выбор услуги и времени сохраняется
    var step = bk.pet === 'new' ? 1 : o.step || 1;
    go(step);
    if (!FB.modal.current() || FB.modal.current().id !== 'book') FB.modal.open('book');
    FB.track('start_booking', { svc: bk.svc });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-book]');
    if (b) { e.preventDefault(); openBooking({}); }
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
    if (n === 1) renderPets();
    if (n === 2) renderSvc();
    if (n === 3) renderDays();
    if (n === 4) renderSum();
    var dlg = FB.$('#book .fb-modal__dialog');
    if (dlg) dlg.scrollTop = 0;
  }
  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-prev]')) { go(bk.step - 1); return; }
    if (!e.target.closest('[data-next]')) return;
    if (bk.step === 1) {
      if (bk.pet === 'new') {
        var nm = FB.$('#npName');
        nm.setAttribute('data-validate', 'required');
        var msg = FB.validateField(nm);
        FB.setError(nm, msg ? 'Как зовут питомца?' : '');
        nm.removeAttribute('data-validate');
        if (msg) { nm.focus(); return; }
      }
      go(2);
    } else if (bk.step === 2) {
      if (!bk.svc) { FB.$('#e2').textContent = 'Выберите услугу'; return; }
      if (!doctorsFor(SVC[bk.svc], curSpecies()).length) { FB.$('#e2').textContent = 'Для этого вида животных услугу не оказываем — позвоните, подскажем'; return; }
      FB.$('#e2').textContent = '';
      go(3);
    } else if (bk.step === 3) {
      if (!bk.date || !bk.time) { FB.$('#e3').textContent = 'Выберите день и время'; return; }
      FB.$('#e3').textContent = '';
      go(4);
    }
  });

  /* шаг 1 — питомец */
  function renderPets() {
    var list = pets();
    FB.$('#bPets').innerHTML = list.map(function (p) {
      return '<label class="pet-opt"><input type="radio" name="petPick" value="' + p.id + '"' + (bk.pet === p.id ? ' checked' : '') + '><span><b>' + FB.esc(p.name) + '</b>' + SPECIES[p.species] + (p.birth ? ', ' + ageText(p.birth) : '') + (p.weight ? ', ' + String(p.weight).replace('.', ',') + ' кг' : '') + '</span></label>';
    }).join('') + (list.length ? '<label class="pet-opt"><input type="radio" name="petPick" value="new"' + (bk.pet === 'new' ? ' checked' : '') + '><span><b>+ Другой питомец</b>добавим в профиль</span></label>' : '');
    FB.$('#bPets').hidden = !list.length;
    FB.$('#bNewPet').hidden = bk.pet !== 'new';
    FB.$('#npBirth').max = FB.iso(FB.today());
  }
  FB.$('#bPets').addEventListener('change', function (e) {
    if (e.target.name !== 'petPick') return;
    bk.pet = e.target.value;
    FB.$('#bNewPet').hidden = bk.pet !== 'new';
    if (bk.pet === 'new') FB.$('#npName').focus();
  });

  /* шаг 2 — услуга и врач */
  function renderSvc() {
    var sp = curSpecies(), sel = FB.$('#bSvc');
    var avail = SERVICES.filter(function (s) { return speciesOk(s.sp, sp) && doctorsFor(s, sp).length; });
    if (bk.svc && !avail.some(function (s) { return s.id === bk.svc; })) {
      FB.toast('«' + SVC[bk.svc].name + '» не подходит для вида «' + SPECIES[sp].toLowerCase() + '» — выберите другую услугу', 'error', 5000);
      bk.svc = null;
    }
    if (!bk.svc) bk.svc = avail.length ? avail[0].id : null;
    sel.innerHTML = CATS.map(function (c) {
      var items = avail.filter(function (s) { return s.cat === c[0]; });
      return items.length ? '<optgroup label="' + c[1] + '">' + items.map(function (s) { return '<option value="' + s.id + '"' + (s.id === bk.svc ? ' selected' : '') + '>' + s.name + ' — от ' + FB.money(s.price) + '</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
    renderSvcNote();
    renderDocs();
  }
  function renderSvcNote() {
    var s = SVC[bk.svc];
    if (!s) { FB.$('#bSvcNote').textContent = ''; return; }
    var notes = [];
    if (s.fast) notes.push('Не кормить ' + s.fast + ' ч до приёма, воду можно.');
    (s.prep || []).forEach(function (x) { notes.push(x + '.'); });
    if (s.spec === 'lab') notes.push('Кровь берём с 9:00 до 13:00. Результат — ' + s.ready + ', пришлём уведомление.');
    FB.$('#bSvcNote').textContent = notes.join(' ');
  }
  function renderDocs() {
    var s = SVC[bk.svc], sp = curSpecies(), docs = s ? doctorsFor(s, sp) : [];
    if (bk.doc !== 'any' && !docs.some(function (d) { return d.id === bk.doc; })) bk.doc = 'any';
    if (docs.length === 1) bk.doc = docs[0].id;
    FB.$('#bDocs').innerHTML = (docs.length > 1 ? '<label class="pet-opt"><input type="radio" name="docPick" value="any"' + (bk.doc === 'any' ? ' checked' : '') + '><span><b>Любой свободный</b>быстрее найдём время</span></label>' : '') +
      docs.map(function (d) {
        var n = nearest(d, s.min);
        return '<label class="pet-opt"><input type="radio" name="docPick" value="' + d.id + '"' + (bk.doc === d.id ? ' checked' : '') + '><span><b>' + d.name + '</b>' + (d.id === 'lab' ? 'ежедневно 9:00–13:00' : d.spec.map(function (x) { return SPECS[x].split(',')[0]; }).join(', ')) + '<br>' + (n ? 'ближайшее: ' + whenText(n.date, n.time).toLowerCase() : 'нет окон на 2 недели') + '</span></label>';
      }).join('');
  }
  FB.$('#bSvc').addEventListener('change', function () { bk.svc = this.value; bk.time = null; renderSvcNote(); renderDocs(); });
  FB.$('#bDocs').addEventListener('change', function (e) { if (e.target.name === 'docPick') { bk.doc = e.target.value; bk.time = null; } });

  /* шаг 3 — время */
  function candDocs() {
    var s = SVC[bk.svc], docs = doctorsFor(s, curSpecies());
    return bk.doc === 'any' ? docs : docs.filter(function (d) { return d.id === bk.doc; });
  }
  function slotsFor(dateIso) {
    var s = SVC[bk.svc], docs = candDocs(), map = {};
    docs.forEach(function (d) { cellsOf(d).forEach(function (t) { if (!map[t] && freeAt(d, dateIso, t, s.min)) map[t] = d.id; }); });
    return Object.keys(map).sort().map(function (t) { return { time: t, doc: map[t] }; });
  }
  function renderDays() {
    var days = FB.days(14);
    var counts = days.map(function (d) { return slotsFor(FB.iso(d)).length; });
    var idx = bk.date ? days.map(FB.iso).indexOf(bk.date) : -1;
    if (idx < 0 || !counts[idx]) { idx = counts.findIndex(function (c) { return c > 0; }); bk.date = idx > -1 ? FB.iso(days[idx]) : FB.iso(days[0]); }
    FB.$('#bDays').innerHTML = days.map(function (d, i) {
      var iso = FB.iso(d), n = counts[i];
      return '<button class="day" type="button" role="radio" aria-checked="' + (iso === bk.date) + '" data-day="' + iso + '"' + (n ? '' : ' disabled') + ' aria-label="' + FB.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (n ? ', свободно ' + n : ', нет времени') + '">' + FB.weekday(d, true) + '<b>' + d.getDate() + '</b>' + (n ? n : '—') + '</button>';
    }).join('');
    renderSlots();
    loadServerBusy(candDocs(), bk.date, renderSlots);
  }
  function renderSlots() {
    var list = slotsFor(bk.date);
    if (bk.time && !list.some(function (x) { return x.time === bk.time; })) bk.time = null;
    FB.$('#bSlots').innerHTML = list.length ? list.map(function (x, i) {
      return '<button class="slot" type="button" role="radio" style="--i:' + i + '" aria-checked="' + (x.time === bk.time) + '" data-time="' + x.time + '" data-doc="' + x.doc + '">' + x.time + '</button>';
    }).join('') : '<p class="slots__empty">На этот день свободного времени нет. Выберите другой день или позвоните — постараемся найти окно.</p>';
    var sel = list.filter(function (x) { return x.time === bk.time; })[0];
    bk.assigned = sel ? sel.doc : null;
    FB.$('#bSlotNote').textContent = sel ? 'Приём ведёт: ' + (sel.doc === 'lab' ? LAB.name : DOC[sel.doc].name) + '. Приходите за 10 минут.' : '';
  }
  FB.$('#bDays').addEventListener('click', function (e) {
    var d = e.target.closest('[data-day]');
    if (!d || d.disabled) return;
    bk.date = d.getAttribute('data-day');
    bk.time = null;
    FB.$$('#bDays .day').forEach(function (x) { x.setAttribute('aria-checked', String(x === d)); });
    renderSlots();
    loadServerBusy(candDocs(), bk.date, renderSlots);
    FB.track('select_date', { date: bk.date });
  });
  FB.$('#bSlots').addEventListener('click', function (e) {
    var s = e.target.closest('[data-time]');
    if (!s) return;
    bk.time = s.getAttribute('data-time');
    FB.$$('#bSlots .slot').forEach(function (x) { x.setAttribute('aria-checked', String(x === s)); });
    renderSlots();
    FB.$('#e3').textContent = '';
  });

  /* шаг 4 — контакты */
  function petInfo() {
    if (bk.pet === 'new') {
      return { id: 'p' + uid(), name: FB.$('#npName').value.trim(), species: FB.$('#npSpecies').value, breed: FB.$('#npBreed').value.trim(), birth: FB.$('#npBirth').value, weight: FB.$('#npWeight').value, vacs: [], isNew: true };
    }
    return pets().filter(function (x) { return x.id === bk.pet; })[0];
  }
  function petLine(p) {
    return [p.name, SPECIES[p.species].toLowerCase(), p.breed, p.birth ? ageText(p.birth) : '', p.weight ? String(p.weight).replace('.', ',') + ' кг' : '', p.allergy ? 'аллергия: ' + p.allergy : ''].filter(Boolean).join(', ');
  }
  function price() { return bk.repeatOf && bk.svc === 'repeat' ? SVC.repeat.price : SVC[bk.svc].price; }
  function renderSum() {
    var p = petInfo(), s = SVC[bk.svc], d = bk.assigned === 'lab' ? LAB : DOC[bk.assigned];
    FB.$('#bSum').innerHTML = '<div><span>Питомец</span><span>' + FB.esc(petLine(p)) + '</span></div><div><span>Услуга</span><span>' + s.name + '</span></div>' +
      '<div><span>Врач</span><span>' + (d ? d.name : '—') + '</span></div><div><span>Когда</span><span>' + whenText(bk.date, bk.time) + '</span></div>' +
      '<div><span>Стоимость</span><span>от ' + FB.money(price()) + '</span></div>';
  }
  FB.form(form, {
    type: 'booking',
    before: function () {
      var s = SVC[bk.svc], d = bk.assigned === 'lab' ? LAB : DOC[bk.assigned];
      if (!d || !freeAt(d, bk.date, bk.time, s.min)) { go(3); FB.$('#e3').textContent = 'Это время только что заняли — выберите другое'; return 'Выберите другое время'; }
      return true;
    },
    collect: function () {
      var p = petInfo(), s = SVC[bk.svc], d = bk.assigned === 'lab' ? LAB : DOC[bk.assigned];
      return {
        pet: petLine(p), service: s.name, resource: d.id, doctor: d.name, date: bk.date, time: bk.time, duration: s.min, total: price(),
        fasting: s.fast ? 'не кормить ' + s.fast + ' ч' : undefined, repeatOf: bk.repeatOf || undefined, petPick: undefined, docPick: undefined
      };
    },
    success: function (res, pl) {
      var p = petInfo(), list = pets();
      FB.store.set('owner', { name: pl.name, phone: pl.phone });
      if (p.isNew) { delete p.isNew; list.push(p); savePets(list); bk.pet = p.id; }
      var s = SVC[bk.svc];
      var v = { id: res.id, petId: p.id, pet: p.name, svc: s.id, doc: pl.resource, date: pl.date, time: pl.time, min: s.min, status: 'upcoming', files: (pl.files || []).length, at: Date.now() };
      var all = visits();
      all.unshift(v);
      saveVisits(all);
      bFiles.fbReset();
      FB.$('#npName').value = '';
      showDone(v, res, s);
      renderDoctors(); heroNext(); updatePetBadges();
    }
  });

  function showDone(v, res, s) {
    var d = v.doc === 'lab' ? LAB : DOC[v.doc];
    var prep = [];
    if (s.fast) prep.push('Не кормить ' + s.fast + ' часов до приёма, воду можно');
    (s.prep || []).forEach(function (x) { prep.push(x); });
    prep.push('Ветпаспорт и предыдущие анализы', 'Переноска или поводок с намордником');
    FB.$('#bFlow').hidden = true;
    var box = FB.$('#bDone');
    box.hidden = false;
    box.innerHTML = '<div class="done"><p class="eyebrow">Запись создана</p><div class="done__num">' + FB.esc(res.id) + '</div>' +
      '<p><b>' + FB.esc(v.pet) + '</b> · ' + s.name + ' · ' + d.name + '<br>' + whenText(v.date, v.time) + ', ул. Революции, 22. Администратор подтвердит запись в течение 15 минут, напомним за сутки и за 2 часа.</p>' +
      '<div class="sum"><b>Что взять и как подготовиться</b><ul>' + prep.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      (s.ready ? '<p class="fine">Результат будет готов: ' + s.ready + '. Проверить можно по номеру ' + FB.esc(res.id) + ' в разделе «Анализы» — и мы пришлём уведомление.</p>' : '') +
      (res.mode === 'demo' ? '<p class="fine">Демо-режим: запись сохранена в этом браузере. С запущенным сервером она уйдёт администратору в Telegram и CRM.</p>' : '') +
      '<div class="done__btns"><a class="btn btn--sun" href="' + visitIcs(v, s) + '" download="hvost-' + v.id + '.ics">В календарь с напоминаниями</a><button class="btn btn--line" type="button" data-open="pets">Мои питомцы</button></div></div>';
    FB.track('booking_confirmed', { id: res.id });
  }
  function visitIcs(v, s) {
    var d = v.doc === 'lab' ? LAB : DOC[v.doc], dt = v.date.replace(/-/g, '') + 'T' + v.time.replace(':', '') + '00';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hvost vet//RU', 'BEGIN:VEVENT', 'UID:' + v.id + '@hvost', 'DTSTAMP:' + stamp, 'DTSTART:' + dt, 'DURATION:PT' + v.min + 'M',
      'SUMMARY:Хвост: ' + v.pet + ' — ' + s.name, 'LOCATION:Пермь\\, ул. Революции\\, 22', 'DESCRIPTION:' + d.name + '. Запись ' + v.id + '. Возьмите ветпаспорт.',
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра приём в «Хвосте»', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Через 2 часа приём в «Хвосте»', 'END:VALARM'];
    if (s.fast) lines.push('BEGIN:VALARM', 'TRIGGER:-PT' + s.fast + 'H', 'ACTION:DISPLAY', 'DESCRIPTION:С этого момента не кормить ' + v.pet + ' (вода можно)', 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ мои питомцы */

  var VST = { upcoming: ['Предстоит', ''], done: ['Состоялся', 'ok'], cancelled: ['Отменён', 'off'] };
  function renderPetsModal() {
    var list = pets(), o = owner(), vs = visits(), box = FB.$('#petsBody');
    var html = '<div class="owner"><span>' + (o.name ? '<b>' + FB.esc(o.name) + '</b> · ' + FB.esc(o.phone || '') : 'Профиль заполнится после первой записи') + '</span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--line btn--sm" type="button" data-pet-add>+ Питомец</button><button class="btn btn--sun btn--sm" type="button" data-book>Записать</button></span></div>';
    if (!list.length) {
      html += '<div class="empty-pets"><p>Добавьте питомца: кличка, вид, возраст, прививки. Напомним о вакцинации и обработках, врач увидит аллергии заранее.</p>' +
        '<div class="done__btns"><button class="btn btn--sun" type="button" data-pet-add>Добавить питомца</button><button class="btn btn--line" type="button" data-pet-demo>Показать пример</button></div></div>';
      box.innerHTML = html;
      return;
    }
    html += '<div class="pets-grid">' + list.map(function (p) {
      var rem = schedule(p), hist = vs.filter(function (v) { return v.petId === p.id; });
      return '<article class="pcard"><div class="pcard__top"><span class="pcard__av">' + PAW + '</span><div><h3>' + FB.esc(p.name) + '</h3><p class="pcard__meta">' +
        [SPECIES[p.species], p.breed, p.birth ? ageText(p.birth) : '', p.weight ? String(p.weight).replace('.', ',') + ' кг' : '', p.sex === 'm' ? 'мальчик' : p.sex === 'f' ? 'девочка' : '', p.ster === 'yes' ? (p.sex === 'f' ? 'стерилизована' : 'кастрирован') : ''].filter(Boolean).map(FB.esc).join(' · ') + '</p></div></div>' +
        (p.allergy ? '<p class="pcard__warn">Аллергия: ' + FB.esc(p.allergy) + '</p>' : '') +
        '<div class="pcard__cols"><div><h4>Напоминания</h4><ul class="rem">' + (rem.length ? rem.map(function (it) {
          var st = status(it.date);
          var act = it.svc ? '<button class="btn btn--navy" type="button" data-rem-book="' + p.id + '|' + it.svc + '">Записать</button>' : it.mark ? '<button class="btn btn--line" type="button" data-rem-mark="' + p.id + '|' + it.mark + '">Сделано</button>' : '';
          return '<li class="is-' + st + '"><span>' + it.title + '<small>' + (st === 'late' ? 'пора — ' + it.note : FB.fmtDate(it.date, { day: 'numeric', month: 'long' }) + ' · ' + it.note) + '</small></span>' + act + '</li>';
        }).join('') : '<li>Для этого вида — плановый осмотр раз в год</li>') + '</ul></div>' +
        '<div><h4>История визитов</h4><ul class="hist">' + (hist.length ? hist.map(function (v) {
          var s = SVC[v.svc], d = v.doc === 'lab' ? LAB : DOC[v.doc], st = VST[v.status] || VST.upcoming;
          var btn = v.status === 'upcoming' ? '<button class="link" type="button" data-v-cancel="' + v.id + '">Отменить</button>' :
            v.status === 'done' ? '<button class="link" type="button" data-v-repeat="' + v.id + '">' + (Date.now() - FB.parseIso(v.date) < 14 * 864e5 && s.cat === 'visit' ? 'Повторный приём за 700 ₽' : 'Записаться снова') + '</button>' : '';
          return '<li><span class="row"><b>' + whenText(v.date, v.time) + '</b><span class="st' + (st[1] ? ' st--' + st[1] : '') + '">' + st[0] + '</span></span><span>' + s.name + ' · ' + d.name + '</span>' +
            (v.rec ? '<span class="fine">Рекомендации врача: ' + FB.esc(v.rec) + '</span>' : v.status === 'done' ? '<span class="fine">Рекомендации врач присылает в Telegram после приёма</span>' : '') + (btn ? '<span>' + btn + '</span>' : '') + '<span data-confirm></span></li>';
        }).join('') : '<li>Визитов через сайт пока не было</li>') + '</ul></div></div>' +
        '<div class="pcard__btns"><button class="btn btn--sun" type="button" data-pet-book="' + p.id + '">Записать ' + FB.esc(p.name) + '</button><button class="btn btn--line" type="button" data-pet-edit="' + p.id + '">Карточка и прививки</button>' +
        (rem.length ? '<a class="btn btn--line" href="' + icsEvents(rem, p.name) + '" download="hvost-' + FB.esc(p.name) + '.ics">Напоминания в календарь</a><button class="btn btn--line" type="button" data-pet-tg="' + p.id + '">Напоминать в Telegram</button>' : '') + '</div></article>';
    }).join('') + '</div>';
    box.innerHTML = html;
  }
  FB.$('#pets').addEventListener('fb:open', renderPetsModal);
  FB.$('#petsBody').addEventListener('click', function (e) {
    var t;
    if (e.target.closest('[data-pet-add]')) { openPetEdit(null); return; }
    if (e.target.closest('[data-pet-demo]')) { demoPet(); renderPetsModal(); return; }
    if ((t = e.target.closest('[data-pet-edit]'))) { openPetEdit(t.getAttribute('data-pet-edit')); return; }
    if ((t = e.target.closest('[data-pet-book]'))) { openBooking({ pet: t.getAttribute('data-pet-book') }); return; }
    if ((t = e.target.closest('[data-rem-book]'))) { var a = t.getAttribute('data-rem-book').split('|'); openBooking({ pet: a[0], svc: a[1], step: 2 }); return; }
    if ((t = e.target.closest('[data-rem-mark]'))) {
      var b = t.getAttribute('data-rem-mark').split('|'), list = pets();
      list.forEach(function (p) { if (p.id === b[0]) { p.vacs = p.vacs || []; p.vacs.push({ type: b[1], date: FB.iso(FB.today()) }); } });
      savePets(list); renderPetsModal();
      FB.toast('Отметили: ' + VAC_LABEL[b[1]].toLowerCase() + ' — сегодня. Следующее напоминание пересчитано.', 'ok');
      return;
    }
    if ((t = e.target.closest('[data-pet-tg]'))) { remindTg(t.getAttribute('data-pet-tg'), t); return; }
    if ((t = e.target.closest('[data-v-repeat]'))) {
      var v = visits().filter(function (x) { return x.id === t.getAttribute('data-v-repeat'); })[0], s = SVC[v.svc];
      var within = Date.now() - FB.parseIso(v.date) < 14 * 864e5 && s.cat === 'visit';
      openBooking({ pet: v.petId, svc: within ? 'repeat' : v.svc, doc: v.doc === 'lab' ? 'any' : v.doc, step: 3, repeatOf: v.id });
      FB.track('repeat_booking', { from: v.id });
      return;
    }
    if ((t = e.target.closest('[data-v-cancel]'))) {
      var li = t.closest('li'), id = t.getAttribute('data-v-cancel');
      li.querySelector('[data-confirm]').innerHTML = '<span class="fine">Отменить запись? Время освободится для других.</span> <button class="link" type="button" data-v-cancel-ok="' + id + '">Да, отменить</button>';
      return;
    }
    if ((t = e.target.closest('[data-v-cancel-ok]'))) {
      var vid = t.getAttribute('data-v-cancel-ok'), vv = visits().filter(function (x) { return x.id === vid; })[0], o = owner();
      t.disabled = true;
      FB.lead.submit({ type: 'cancel', orderId: vid, name: o.name || '', phone: o.phone || '', pet: vv.pet, service: SVC[vv.svc].name, date: vv.date, time: vv.time })
        .then(function () {
          var all = visits();
          all.forEach(function (x) { if (x.id === vid) x.status = 'cancelled'; });
          saveVisits(all); renderPetsModal(); renderDoctors(); heroNext();
          FB.toast('Запись ' + vid + ' отменена', 'ok');
        })
        .catch(function (err) { t.disabled = false; FB.toast('Не получилось: ' + err.message + '. Позвоните нам.', 'error', 6000); });
    }
  });

  function remindTg(petId, btn) {
    var p = pets().filter(function (x) { return x.id === petId; })[0], o = owner();
    if (!o.phone) { FB.toast('Сначала запишитесь один раз — так мы узнаем ваш телефон для напоминаний', 'error', 6000); return; }
    btn.disabled = true;
    var rem = schedule(p);
    FB.lead.submit({ type: 'reminders', name: o.name, phone: o.phone, pet: petLine(p), reminders: rem.map(function (it) { return it.title + ' — ' + it.date; }) })
      .then(function (r) { btn.textContent = 'Напоминания включены'; FB.toast('Будем напоминать о ' + rem.length + ' ' + FB.plural(rem.length, ['событии', 'событиях', 'событиях']) + ' (' + r.id + ')', 'ok'); })
      .catch(function (err) { btn.disabled = false; FB.toast('Не получилось: ' + err.message, 'error'); });
  }

  function demoPet() {
    var t = FB.today(), iso = function (n) { return FB.iso(FB.addDays(t, n)); };
    var p = { id: 'pdemo', name: 'Бакс', species: 'dog', breed: 'бигль', birth: iso(-365 * 4 - 40), weight: '14.5', sex: 'm', ster: 'no', allergy: 'курица', chronic: '', outdoor: true,
      vacs: [{ type: 'complex', date: iso(-350) }, { type: 'rabies', date: iso(-350) }, { type: 'worm', date: iso(-100) }, { type: 'ticks', date: iso(-40) }] };
    savePets([p]);
    saveVisits([{ id: 'VT-DEMO', petId: 'pdemo', pet: 'Бакс', svc: 'first', doc: 'lebedeva', date: iso(-6), time: '11:00', min: 30, status: 'done', rec: 'повторный осмотр через 10 дней, корм без курицы', at: Date.now() }]);
  }

  /* ---- карточка питомца */
  var peTmp = [];
  function openPetEdit(id, preset) {
    var p = id ? pets().filter(function (x) { return x.id === id; })[0] : Object.assign({ id: '', name: '', species: 'dog', breed: '', birth: '', weight: '', sex: '', ster: '', allergy: '', chronic: '', vacs: [] }, preset || {});
    FB.$('#peTitle').textContent = id ? 'Карточка: ' + p.name : 'Новый питомец';
    FB.$('#peId').value = p.id;
    FB.$('#peName').value = p.name;
    FB.$('#peSpecies').value = p.species;
    FB.$('#peBreed').value = p.breed || '';
    FB.$('#peBirth').value = p.birth || '';
    FB.$('#peBirth').max = FB.$('#peVacDate').max = FB.iso(FB.today());
    FB.$('#peWeight').value = p.weight || '';
    FB.$('#peSex').value = p.sex || '';
    FB.$('#peSter').value = p.ster || '';
    FB.$('#peAllergy').value = p.allergy || '';
    FB.$('#peChronic').value = p.chronic || '';
    FB.$('#peVacDate').value = FB.iso(FB.today());
    peTmp = (p.vacs || []).slice();
    FB.$('#peForm').dataset.outdoor = p.outdoor === false ? 'no' : 'yes';
    var del = FB.$('#peDel');
    del.hidden = !id;
    del.textContent = 'Удалить питомца';
    delete del.dataset.sure;
    FB.$('#peErr').textContent = '';
    FB.setError(FB.$('#peName'), '');
    renderVacs();
    FB.modal.open('petEdit');
  }
  function renderVacs() {
    peTmp.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    FB.$('#peVacs').innerHTML = peTmp.length ? peTmp.map(function (v, i) {
      return '<li><span>' + VAC_LABEL[v.type] + ' — ' + FB.fmtDate(v.date, { day: 'numeric', month: 'long', year: 'numeric' }) + '</span><button type="button" data-vac-rm="' + i + '" aria-label="Удалить запись">×</button></li>';
    }).join('') : '<li><span class="fine">Пока нет записей — добавьте из ветпаспорта</span></li>';
  }
  FB.$('#peVacAdd').addEventListener('click', function () {
    var d = FB.$('#peVacDate').value;
    if (!d) { FB.$('#peVacDate').focus(); return; }
    if (d > FB.iso(FB.today())) { FB.toast('Дата не может быть в будущем', 'error'); return; }
    peTmp.push({ type: FB.$('#peVacType').value, date: d });
    renderVacs();
  });
  FB.$('#peVacs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-vac-rm]');
    if (b) { peTmp.splice(+b.getAttribute('data-vac-rm'), 1); renderVacs(); }
  });
  FB.$('#peForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = FB.$('#peName');
    if (!name.value.trim()) { FB.setError(name, 'Как зовут питомца?'); name.focus(); return; }
    FB.setError(name, '');
    var w = FB.$('#peWeight').value;
    if (w && (+w <= 0 || +w > 120)) { FB.$('#peErr').textContent = 'Проверьте вес — от 0,05 до 120 кг'; return; }
    var id = FB.$('#peId').value, list = pets();
    var p = { id: id || 'p' + uid(), name: name.value.trim().slice(0, 30), species: FB.$('#peSpecies').value, breed: FB.$('#peBreed').value.trim(), birth: FB.$('#peBirth').value, weight: w,
      sex: FB.$('#peSex').value, ster: FB.$('#peSter').value, allergy: FB.$('#peAllergy').value.trim(), chronic: FB.$('#peChronic').value.trim(), vacs: peTmp.slice(), outdoor: FB.$('#peForm').dataset.outdoor !== 'no' };
    if (id) list = list.map(function (x) { return x.id === id ? p : x; }); else list.push(p);
    savePets(list);
    FB.toast(id ? 'Карточка обновлена' : p.name + ' — в профиле. Напоминания посчитаны.', 'ok');
    FB.modal.open('pets');
  });
  FB.$('#peDel').addEventListener('click', function () {
    if (!this.dataset.sure) { this.dataset.sure = '1'; this.textContent = 'Точно удалить? Нажмите ещё раз'; return; }
    var id = FB.$('#peId').value;
    savePets(pets().filter(function (x) { return x.id !== id; }));
    FB.modal.open('pets');
  });

  /* ================================================================ отзывы */

  FB.$('#revGrid').innerHTML = REVIEWS.map(function (r) {
    return '<article class="rev" data-reveal><div class="rev__top"><img src="img/' + r.img + '.webp" alt="" loading="lazy"><div><b>' + r.n + '</b><span>' + r.pet + '</span></div></div>' +
      '<div class="rev__stars" aria-label="Оценка ' + r.r + ' из 5">' + '★★★★★'.slice(0, r.r) + '<span style="opacity:.25">' + '★★★★★'.slice(r.r) + '</span></div><p>' + r.t + '</p><span class="rev__src">' + r.src + ' · ' + r.d + '</span></article>';
  }).join('');
  FB.reveal(FB.$('#revGrid'));

  /* ================================================================ мобильная кнопка */

  FB.onScroll(function (y) { FB.$('#mobileCta').classList.toggle('is-hidden', y < 300); });
  FB.$('.nav__pets').addEventListener('click', function () {
    var bg = FB.$('.burger');
    if (bg.getAttribute('aria-expanded') === 'true') bg.click();
  });

  renderServices();
  renderDoctors();
  heroNext();
  updatePetBadges();
})();
