/* Этюд — процедуры с подробной карточкой, подбор по задаче, прайс с курсами, запись с анкетой и согласиями,
   личный кабинет «Мой курс» (выполнено/осталось, напоминания), вопрос врачу. Без диагнозов онлайн. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочник процедур */

  var GOALS = { wrinkles: 'Морщины', pigment: 'Пигментация', acne: 'Акне и постакне', dry: 'Сухость и тусклость', oval: 'Овал лица', texture: 'Расширенные поры', sensitive: 'Чувствительная кожа', hair: 'Нежелательные волосы', body: 'Отёки и тонус тела' };
  var ZONES = { face: 'Лицо', body: 'Тело', laser: 'Лазер' };

  var PROCS = [
    { id: 'consult', zone: 'consult', name: 'Консультация врача', img: 'room', price: 1500, min: 40, course: 'разово', down: 0, goals: [], pack: null,
      short: 'Осмотр, дерматоскопия, план ухода', ind: 'Первое обращение, выбор процедур, контроль после курса.', contra: ['Нет'], prep: ['Приходите без макияжа', 'Возьмите список средств, которыми пользуетесь'], res: 'Письменный план ухода с ценами и сроками. Стоимость засчитывается в первую процедуру.' },
    { id: 'peel', zone: 'face', name: 'Химический пилинг', img: 'pad', price: 4500, min: 40, course: '4–6 процедур раз в 2 недели', down: 3, goals: ['pigment', 'acne', 'texture'], pack: [5, 19800],
      short: 'Ровный тон и текстура', ind: 'Постакне, пигментация, неровный рельеф, расширенные поры.', contra: ['Беременность и лактация', 'Загар и солнце в ближайшие 2 недели', 'Герпес в активной фазе', 'Приём изотретиноина'], prep: ['За 2 недели — без загара и солярия', 'За 5 дней — отменить ретинол и кислоты', 'В день процедуры — без макияжа'], res: 'Кожа ровнее по тону и рельефу после курса. Возможно шелушение 1–3 дня. Обязателен SPF 50.' },
    { id: 'biorev', zone: 'face', name: 'Биоревитализация', img: 'serum', price: 9500, min: 45, course: '3–4 процедуры раз в 2–3 недели', down: 2, goals: ['dry', 'wrinkles'], pack: [3, 25500],
      short: 'Увлажнение и тонус кожи', ind: 'Обезвоженность, тусклость, мелкие морщины, подготовка к лету.', contra: ['Беременность и лактация', 'Аутоиммунные заболевания', 'Воспаления в зоне введения', 'Приём антикоагулянтов'], prep: ['За 3 дня — без алкоголя и аспирина', 'За сутки — без бани и спорта'], res: 'Кожа плотнее и увлажнённее. Папулы в местах инъекций проходят за 1–2 дня.' },
    { id: 'clean', zone: 'face', name: 'Комбинированная чистка', img: 'towel', price: 3900, min: 90, course: 'раз в 1–2 месяца', down: 1, goals: ['acne', 'texture'], pack: null,
      short: 'Чистые поры без травм', ind: 'Закрытые комедоны, жирный блеск, расширенные поры.', contra: ['Острое воспаление акне', 'Герпес в активной фазе', 'Купероз в выраженной форме'], prep: ['За 3 дня — без скрабов и кислот'], res: 'Очищенные поры и ровная текстура. Лёгкое покраснение до суток.' },
    { id: 'rf', zone: 'face', name: 'RF-лифтинг лица', img: 'hands', price: 6500, min: 50, course: '6–8 процедур раз в неделю', down: 0, goals: ['oval', 'wrinkles'], pack: [6, 33000],
      short: 'Чёткий овал без инъекций', ind: 'Потеря тонуса, «брыли», первые возрастные изменения.', contra: ['Кардиостимулятор и металлические импланты в зоне', 'Беременность', 'Онкологические заболевания'], prep: ['Особой подготовки не требует'], res: 'Кожа подтягивается постепенно, итог — через месяц после курса. Можно сразу на работу.' },
    { id: 'care', zone: 'face', name: 'Уходовая программа', img: 'cream', price: 4200, min: 60, course: 'раз в 2–4 недели', down: 0, goals: ['dry', 'sensitive'], pack: [4, 14800],
      short: 'Под тип и состояние кожи', ind: 'Сухость, чувствительность, реабилитация после процедур.', contra: ['Аллергия на компоненты — уточняем заранее'], prep: ['Приходите без макияжа'], res: 'Комфорт, увлажнение и сияние сразу после процедуры.' },
    { id: 'laser-face', zone: 'laser', name: 'Лазерная эпиляция лица', img: 'dropper', price: 2500, min: 20, course: '6–8 процедур раз в 4–6 недель', down: 0, goals: ['hair'], pack: [6, 12750],
      short: 'Диодный лазер 808 нм', ind: 'Нежелательные волосы над губой, на подбородке.', contra: ['Загар', 'Беременность', 'Приём фотосенсибилизирующих препаратов', 'Светлые и седые волосы — метод неэффективен'], prep: ['За 2 недели — без загара', 'За 2–3 дня — побрить зону, не выщипывать'], res: 'Количество волос уменьшается от процедуры к процедуре. Полностью — после курса.' },
    { id: 'laser-legs', zone: 'laser', name: 'Лазерная эпиляция ног', img: 'bath', price: 7900, min: 60, course: '6–8 процедур раз в 6–8 недель', down: 0, goals: ['hair'], pack: [6, 40300],
      short: 'Ноги полностью', ind: 'Нежелательные волосы на ногах.', contra: ['Загар', 'Беременность', 'Варикоз в стадии обострения'], prep: ['За 2 недели — без загара', 'За сутки — побрить зону'], res: 'Гладкая кожа без раздражения от бритья после курса.' },
    { id: 'lymph', zone: 'body', name: 'Лимфодренажный массаж', img: 'massage', price: 3500, min: 60, course: '10 процедур 2 раза в неделю', down: 0, goals: ['body'], pack: [10, 29750],
      short: 'Отёки и лёгкость в теле', ind: 'Отёчность, тяжесть в ногах, восстановление после перелётов.', contra: ['Тромбоз', 'Острые воспаления', 'Беременность — по согласованию с врачом'], prep: ['За 2 часа — не есть плотно'], res: 'Уходят отёки, улучшается тонус кожи. Результат накопительный.' },
    { id: 'rf-body', zone: 'body', name: 'RF-лифтинг тела', img: 'stones', price: 5500, min: 50, course: '6–8 процедур раз в неделю', down: 0, goals: ['body'], pack: [6, 28000],
      short: 'Живот, руки, бёдра', ind: 'Снижение тонуса кожи после похудения или родов.', contra: ['Металлические импланты в зоне', 'Беременность', 'Онкологические заболевания'], prep: ['Особой подготовки не требует'], res: 'Кожа плотнее и ровнее, итог — через месяц после курса.' }
  ];
  var byId = {};
  PROCS.forEach(function (p) { byId[p.id] = p; });
  var SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  function downText(d) { return d === 0 ? 'сразу к обычной жизни' : d <= 2 ? '1–2 дня' : d <= 3 ? '1–3 дня' : 'до недели'; }

  /* ================================================================ категории */

  (function cats() {
    var list = [['face', 'Лицо'], ['body', 'Тело'], ['laser', 'Лазер'], ['consult', 'Консультация']];
    FB.$('#cats').innerHTML = list.map(function (c) {
      var ps = PROCS.filter(function (p) { return p.zone === c[0]; });
      var min = Math.min.apply(null, ps.map(function (p) { return p.price; }));
      return '<button class="cat" type="button" data-cat="' + c[0] + '"><b>' + c[1] + '</b><span>/ ' + ps.length + ' ' + FB.plural(ps.length, ['процедура', 'процедуры', 'процедур']) + ' · от <i>' + FB.money(min) + '</i></span></button>';
    }).join('');
    FB.$('#cats').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      var z = b.getAttribute('data-cat');
      if (z === 'consult') { openBook('consult', b); return; }
      FB.$('#z-' + z).click();
      FB.scrollTo('#procedures');
    });
  })();

  /* ================================================================ процедуры */

  var zoneF = 'all';
  function renderProcs() {
    var list = PROCS.filter(function (p) { return p.zone !== 'consult' && (zoneF === 'all' || p.zone === zoneF); });
    FB.$('#procGrid').innerHTML = list.map(function (p, i) {
      return '<article class="pcard" style="--i:' + i + '"><div class="pcard__img"><img src="img/' + p.img + '.webp" alt="" loading="lazy"></div><div class="pcard__b">' +
        '<h3>' + p.name + '</h3><p class="pcard__from">' + p.short + ' · от<b>' + FB.money(p.price) + '</b></p>' +
        '<dl><div><dt>Длительность</dt><dd>' + p.min + ' мин</dd></div><div><dt>Курс</dt><dd>' + p.course + '</dd></div><div><dt>Восстановление</dt><dd>' + downText(p.down) + '</dd></div></dl>' +
        '<div class="pcard__btns"><button class="btn btn--line" type="button" data-proc="' + p.id + '">Подробнее</button><button class="btn btn--sand" type="button" data-book="' + p.id + '">Записаться</button></div></div></article>';
    }).join('');
  }
  FB.tabs(FB.$('#procTabs'), function (t) { zoneF = t.id.slice(2); renderProcs(); });

  document.addEventListener('click', function (e) {
    var pr = e.target.closest('[data-proc]');
    if (pr) { openProc(pr.getAttribute('data-proc'), pr); return; }
    var bk = e.target.closest('[data-book]');
    if (bk) { openBook(bk.getAttribute('data-book') || 'consult', bk, bk.getAttribute('data-doc')); }
  });

  function openProc(id, opener) {
    var p = byId[id];
    FB.$('#prBody').innerHTML = '<div class="pr"><img src="img/' + p.img + '.webp" alt="' + FB.esc(p.name) + '"><div>' +
      '<p class="eyebrow">' + ZONES[p.zone] + '</p><h2 id="prTitle">' + p.name + '</h2><p class="pr__price">от ' + FB.money(p.price) + (p.pack ? ' · курс ' + p.pack[0] + ' — ' + FB.money(p.pack[1]) : '') + '</p>' +
      '<div class="pr__sec"><h3>Показания</h3><p>' + p.ind + '</p></div>' +
      '<div class="pr__sec"><h3>Противопоказания</h3><ul>' + p.contra.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul></div>' +
      '<div class="pr__sec"><h3>Подготовка</h3><ul>' + p.prep.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul></div>' +
      '<div class="pr__sec"><h3>Чего ожидать</h3><p>' + p.res + ' Длительность — ' + p.min + ' мин, курс: ' + p.course + '.</p></div>' +
      '<p class="fine" style="margin-top:12px">Результат индивидуален. Перед процедурой обязателен осмотр врача.</p>' +
      '<button class="btn btn--sand" type="button" data-book="' + p.id + '">Записаться на процедуру</button></div></div>';
    FB.modal.open('proc', opener);
    FB.track('view_service', { id: id });
  }

  /* ================================================================ подбор */

  (function matcher() {
    FB.$('#mZone').innerHTML = '<label><input type="radio" name="mzone" value="face" checked><span>Лицо</span></label><label><input type="radio" name="mzone" value="body"><span>Тело</span></label>';
    function goalsFor(z) { return z === 'body' ? ['body', 'hair'] : ['wrinkles', 'pigment', 'acne', 'dry', 'oval', 'texture', 'sensitive', 'hair']; }
    function renderGoals() {
      var z = (FB.$('input[name=mzone]:checked') || {}).value;
      FB.$('#mGoal').innerHTML = goalsFor(z).map(function (g, i) { return '<label><input type="radio" name="mgoal" value="' + g + '"' + (i === 0 ? ' checked' : '') + '><span>' + GOALS[g] + '</span></label>'; }).join('');
    }
    FB.$('#mZone').addEventListener('change', renderGoals);
    renderGoals();
    FB.$('#matchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var z = FB.$('input[name=mzone]:checked').value, g = FB.$('input[name=mgoal]:checked').value, d = +FB.$('input[name=down]:checked').value;
      var list = PROCS.filter(function (p) { return p.goals.indexOf(g) >= 0 && (g === 'hair' ? true : (z === 'body' ? p.zone === 'body' : p.zone === 'face')); });
      var ok = list.filter(function (p) { return p.down <= d; }), later = list.filter(function (p) { return p.down > d; });
      var out = FB.$('#matchOut');
      if (!list.length) { out.innerHTML = '<p class="lead">Под эту задачу нужна очная консультация — врач предложит варианты.</p>'; return; }
      out.innerHTML = ok.concat(later).slice(0, 3).map(function (p, i) {
        var soft = p.down > d;
        return '<div class="mres" style="--i:' + i + '"><img src="img/' + p.img + '.webp" alt=""><div><h3>' + p.name + '</h3><p>от ' + FB.money(p.price) + ' · восстановление: ' + downText(p.down) + (soft ? ' — дольше, чем вы хотите' : '') + '</p></div>' +
          '<button class="btn btn--line" type="button" data-proc="' + p.id + '">Подробнее</button></div>';
      }).join('') + '<div><button class="btn btn--sand" type="button" data-book="consult">Обсудить с врачом — консультация 1 500 ₽</button></div>';
      FB.track('match_result', { goal: g, n: list.length });
    });
  })();

  /* ================================================================ прайс */

  (function priceTable() {
    var html = '<thead><tr><th scope="col">Процедура</th><th scope="col">Время</th><th scope="col">1 визит</th><th scope="col">Курс</th></tr></thead><tbody>';
    [['consult', 'Консультации'], ['face', 'Лицо'], ['body', 'Тело'], ['laser', 'Лазерная эпиляция']].forEach(function (g) {
      html += '<tr class="group"><th colspan="4" scope="rowgroup">' + g[1] + '</th></tr>';
      PROCS.filter(function (p) { return p.zone === g[0]; }).forEach(function (p) {
        var save = p.pack ? Math.round((1 - p.pack[1] / (p.price * p.pack[0])) * 100) : 0;
        html += '<tr><th scope="row">' + p.name + '<small>' + p.short + '</small></th><td>' + p.min + ' мин</td><td>' + FB.money(p.price) + '</td><td>' + (p.pack ? p.pack[0] + ' шт — <b>' + FB.money(p.pack[1]) + '</b> (−' + save + '%)' : '—') + '</td></tr>';
      });
    });
    FB.$('#ptable').insertAdjacentHTML('beforeend', html + '</tbody>');
  })();

  /* ================================================================ запись */

  var bf = FB.$('#bookForm'), bsteps = FB.$$('.bstep', bf), bnav = FB.$$('#bSteps li'), bstep = 0, courseRef = null;
  var courses = FB.store.get('courses', []);
  FB.$('#bProc').innerHTML = PROCS.map(function (p) { return '<option value="' + p.id + '">' + p.name + ' — ' + FB.money(p.price) + '</option>'; }).join('');
  FB.$('#bDays').innerHTML = FB.days(12).map(function (d, i) {
    return '<label><input type="radio" name="date" value="' + FB.iso(d) + '"' + (i === 0 ? ' checked' : '') + '><span>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.weekday(d, true)) + '<b>' + d.getDate() + '</b></span></label>';
  }).join('');

  function curProc() { return byId[bf.proc.value]; }
  function slotsFor(date) {
    var d = FB.parseIso(date), sunday = d.getDay() === 0;
    return SLOTS.filter(function (t) { return !sunday || (t >= '10:00' && t <= '17:00'); });
  }
  function renderSlots() {
    var date = (FB.$('input[name=date]:checked', bf) || {}).value, doc = bf.doctor.value || 'любой', box = FB.$('#bSlots');
    box.innerHTML = '<span class="fine">Проверяем расписание врача…</span>';
    var all = slotsFor(date);
    FB.lead.busy('doc:' + doc, date, all, 0.4).then(function (busy) {
      var free = 0;
      box.innerHTML = all.map(function (t) {
        var dis = busy.indexOf(t) >= 0 || FB.isPastSlot(date, t);
        if (!dis) free++;
        return '<label><input type="radio" name="time" value="' + t + '"' + (dis ? ' disabled' : '') + '><span>' + t + '</span></label>';
      }).join('') + (free ? '' : '<span class="fine">В этот день всё занято — выберите другой.</span>');
    });
  }
  function renderPack() {
    var p = curProc(), wrap = FB.$('#bPack').closest('.check');
    wrap.hidden = !p.pack || !!courseRef;
    if (p.pack) FB.$('#bPackInfo').textContent = p.pack[0] + ' процедур за ' + FB.money(p.pack[1]) + ' вместо ' + FB.money(p.price * p.pack[0]);
    if (!p.pack) FB.$('#bPack').checked = false;
    FB.$('#bkTitle').textContent = courseRef ? p.name + ': следующая процедура курса' : p.name;
  }
  bf.addEventListener('change', function (e) {
    if (e.target.name === 'proc') { courseRef = null; renderPack(); }
    if (e.target.name === 'proc' || e.target.name === 'doctor' || e.target.name === 'date') renderSlots();
    if (e.target.id === 'bPhotoOk') FB.$('#photoBox').hidden = !e.target.checked;
    if (e.target.name === 'q') contraCheck();
    renderSum();
  });

  function contraCheck() {
    var p = curProc(), checked = FB.$$('input[name=q]:checked', bf).map(function (i) { return i.value; });
    var err = FB.$('[data-form-error]', bf);
    err.textContent = '';
    if (p.id === 'consult') return true;
    var hits = [];
    if (checked.indexOf('Беременность или кормление') >= 0 && p.contra.some(function (c) { return /Беременность/.test(c); })) hits.push('беременность и кормление');
    if (checked.indexOf('Загар последние 2 недели') >= 0 && p.contra.some(function (c) { return /[Зз]агар/.test(c); })) hits.push('недавний загар');
    if (checked.indexOf('Приём изотретиноина или антикоагулянтов') >= 0 && p.contra.some(function (c) { return /изотретиноин|антикоагулянт/.test(c); })) hits.push('приём изотретиноина / антикоагулянтов');
    if (hits.length) {
      err.innerHTML = 'Для процедуры «' + p.name + '» есть противопоказание: ' + hits.join(', ') + '. Предлагаем сначала консультацию врача — <button class="link" type="button" id="toConsult" style="color:var(--sand);text-decoration:underline">переключить на консультацию</button>.';
      return false;
    }
    return true;
  }
  bf.addEventListener('click', function (e) {
    if (e.target.id === 'toConsult') { bf.proc.value = 'consult'; courseRef = null; renderPack(); renderSum(); FB.$('[data-form-error]', bf).textContent = ''; }
  });

  function renderSum() {
    var p = curProc(), pack = FB.$('#bPack').checked && p.pack;
    var date = (FB.$('input[name=date]:checked', bf) || {}).value, time = (FB.$('input[name=time]:checked', bf) || {}).value;
    FB.$('#bSum').innerHTML = '<div>' + p.name + (pack ? ', курс ' + p.pack[0] + ' процедур' : '') + (bf.doctor.value ? ' · врач ' + bf.doctor.value : '') + '</div>' +
      '<div>' + (date ? FB.fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }) : '') + (time ? ', ' + time : '') + '</div>' +
      '<div>К оплате: <b>' + (courseRef ? 'по оплаченному курсу' : FB.money(pack ? p.pack[1] : p.price)) + '</b>' + (p.id !== 'consult' && !courseRef ? ' · при записи через консультацию вычтем 1 500 ₽' : '') + '</div>';
  }

  function goB(n) {
    bstep = n;
    bsteps.forEach(function (s, i) { s.hidden = i !== n; });
    bnav.forEach(function (li, i) { li.classList.toggle('on', i <= n); });
    FB.$('#bBack').hidden = n === 0;
    FB.$('#bNext').hidden = n === bsteps.length - 1;
    FB.$('#bSubmit').hidden = n !== bsteps.length - 1;
    if (n !== 1) FB.$('[data-form-error]', bf).textContent = '';
    renderSum();
  }
  FB.$('#bNext').addEventListener('click', function () {
    if (bstep === 0 && !FB.$('input[name=time]:checked', bf)) { FB.$('[data-form-error]', bf).textContent = 'Выберите время.'; return; }
    if (bstep === 1 && !contraCheck()) return;
    if (!FB.validate(bsteps[bstep])) return;
    goB(bstep + 1);
  });
  FB.$('#bBack').addEventListener('click', function () { goB(bstep - 1); });
  bf.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && bstep < bsteps.length - 1) { e.preventDefault(); FB.$('#bNext').click(); } });
  FB.files(FB.$('#bFiles'), { max: 4, maxSize: 10 * 1024 * 1024, list: FB.$('#bFileList') });

  function openBook(procId, opener, doc, course) {
    courseRef = course || null;
    FB.$('#bDone').hidden = true; bf.hidden = false;
    bf.proc.value = byId[procId] ? procId : 'consult';
    bf.doctor.value = doc || '';
    var prof = FB.store.get('profile', {});
    if (prof.name && !bf.name.value) bf.name.value = prof.name;
    if (prof.phone && !bf.phone.value) bf.phone.value = prof.phone;
    renderPack();
    renderSlots();
    goB(0);
    if (!FB.$('#book').classList.contains('is-open')) FB.modal.open('book', opener);
    FB.track('start_form', { form: 'booking', proc: procId });
  }

  FB.form(bf, {
    type: 'procedure_booking',
    before: function () { if (bstep !== bsteps.length - 1) return 'Пройдите все шаги'; return contraCheck() ? true : 'Проверьте анкету'; },
    collect: function (fd) {
      var p = curProc(), pack = fd.get('pack') && p.pack;
      return {
        type: courseRef ? 'course_session' : 'procedure_booking',
        service: p.name + (pack ? ' — курс ' + p.pack[0] : ''), master: fd.get('doctor') || 'любой', resource: 'doc:' + (fd.get('doctor') || 'любой'),
        date: fd.get('date'), time: fd.get('time'), total: courseRef ? 'по курсу' : FB.money(pack ? p.pack[1] : p.price),
        details: {
          'Анкета': fd.getAll('q').join('; ') || 'ограничений не отмечено', 'Напоминания': fd.get('comms') ? fd.get('channel') : 'не присылать',
          'Фото': fd.get('photoConsent') ? 'согласие дано' : 'без фото', 'Курс': courseRef ? 'продолжение ' + courseRef : (pack ? 'новый курс' : 'разовый визит')
        }
      };
    },
    success: function (res, pl) {
      var p = curProc(), pack = pl.pack && p.pack;
      FB.store.set('profile', { name: pl.name, phone: pl.phone });
      if (courseRef) {
        var c = courses.filter(function (x) { return x.id === courseRef; })[0];
        if (c) c.sessions.push({ date: pl.date, time: pl.time, id: res.id });
      } else if (pack) {
        courses.unshift({ id: res.id, proc: p.id, total: p.pack[0], sessions: [{ date: pl.date, time: pl.time, id: res.id }] });
      } else {
        courses.unshift({ id: res.id, proc: p.id, total: 1, sessions: [{ date: pl.date, time: pl.time, id: res.id }] });
      }
      FB.store.set('courses', courses.slice(0, 20));
      FB.track('booking_confirmed', { id: res.id, proc: p.id, pack: !!pack });
      bf.hidden = true;
      var d = FB.$('#bDone');
      d.hidden = false;
      d.innerHTML = '<div class="done"><p class="eyebrow">Запись подтверждается</p><div class="num">' + FB.esc(res.id) + '</div>' +
        '<p class="lead" style="margin:0">' + p.name + ', ' + FB.fmtDate(pl.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' в ' + pl.time + '. Администратор подтвердит запись в течение 15 минут.</p>' +
        '<div class="pr__sec"><h3>Как подготовиться</h3><ul>' + p.prep.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
        '<div class="course__row"><a class="btn btn--sand" download="etud-zapis.ics" href="' + ics(p, pl) + '">В календарь с напоминаниями</a><button class="btn btn--line" type="button" data-open="course">Мой курс</button></div></div>';
      courseRef = null;
    }
  });

  function ics(p, pl) {
    var dt = pl.date.replace(/-/g, '') + 'T' + pl.time.replace(':', '') + '00';
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Etud//RU', 'BEGIN:VEVENT', 'UID:' + Date.now() + '@etud', 'DTSTAMP:' + stamp, 'DTSTART:' + dt, 'DURATION:PT' + p.min + 'M',
      'SUMMARY:Этюд: ' + p.name, 'LOCATION:Краснодар\\, ул. Красная\\, 154', 'DESCRIPTION:Подготовка: ' + p.prep.join('; '),
      'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', 'DESCRIPTION:Через 3 дня процедура — начните подготовку', 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра процедура в «Этюде»', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  }

  /* ================================================================ мой курс */

  function renderCourse() {
    var box = FB.$('#cBody');
    if (!courses.length) { box.innerHTML = '<p class="lead">Здесь появятся ваши записи и курсы процедур: сколько сделано, сколько осталось и когда следующий визит. Данные хранятся на этом устройстве.</p><button class="btn btn--sand" type="button" data-book="consult">Записаться на консультацию</button>'; return; }
    box.innerHTML = '<div class="course">' + courses.map(function (c) {
      var p = byId[c.proc], done = c.sessions.filter(function (s) { return FB.isPastSlot(s.date, s.time); }).length;
      var upcoming = c.sessions.filter(function (s) { return !FB.isPastSlot(s.date, s.time); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
      var left = c.total - c.sessions.length;
      var lastDate = c.sessions.length ? c.sessions[c.sessions.length - 1].date : null;
      var control = c.total > 1 && !left && lastDate ? FB.addDays(FB.parseIso(lastDate), 21) : null;
      return '<article class="course__card"><h3>' + p.name + '</h3>' +
        (c.total > 1 ? '<div class="dots" aria-label="Выполнено ' + done + ' из ' + c.total + '">' + Array.from({ length: c.total }, function (_, i) { return '<span class="' + (i < done ? 'done' : i === done ? 'next' : '') + '">' + (i + 1) + '</span>'; }).join('') + '</div>' : '') +
        '<p class="fine">' + (c.total > 1 ? 'Выполнено ' + done + ' из ' + c.total + ', записано ' + c.sessions.length + '. ' : '') + (upcoming ? 'Ближайший визит: ' + FB.fmtDate(upcoming.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' в ' + upcoming.time + '.' : 'Ближайших визитов нет.') + (control ? ' Контрольный осмотр — с ' + FB.fmtDate(control) + ', бесплатно.' : '') + '</p>' +
        '<div class="course__row">' + (left > 0 ? '<button class="btn btn--sand btn--sm" type="button" data-next="' + c.id + '">Записаться на ' + (c.sessions.length + 1) + '-ю процедуру</button>' : '') +
        (control ? '<button class="btn btn--line btn--sm" type="button" data-book="consult">Записаться на контроль</button>' : '') +
        (c.total === 1 ? '<button class="btn btn--line btn--sm" type="button" data-book="' + p.id + '">Повторить</button>' : '') + '</div></article>';
    }).join('') + '</div>';
  }
  FB.$('#course').addEventListener('fb:open', renderCourse);
  FB.$('#cBody').addEventListener('click', function (e) {
    var n = e.target.closest('[data-next]');
    if (!n) return;
    var c = courses.filter(function (x) { return x.id === n.getAttribute('data-next'); })[0];
    openBook(c.proc, n, '', c.id);
    FB.track('repeat_booking', { course: c.id });
  });

  /* ================================================================ вопрос врачу */

  FB.form(FB.$('#askForm'), {
    type: 'question',
    collect: function () { return { service: 'Вопрос врачу' }; },
    success: function (res) {
      FB.modal.close();
      FB.toast('Вопрос ' + res.id + ' передан врачу. Ответим в рабочее время', 'ok', 6000);
    }
  });

  /* ================================================================ старт */

  renderProcs();
})();
