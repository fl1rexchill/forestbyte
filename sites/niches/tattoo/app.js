/* ИГЛА — стили с превью за курсором, портфолио с фильтрами и лайтбоксом, калькулятор, бриф с консультацией,
   пирсинг с записью на время, статус эскиза с согласованием и предоплатой. */
(function () {
  'use strict';
  FB.init();
  var root = document.documentElement;

  /* ================================================================ справочники */

  var STYLES = [
    { id: 'fine', name: 'Файнлайн', c: 'тонкие линии, ботаника', img: 'w7' },
    { id: 'black', name: 'Блэкворк', c: 'графика и орнамент', img: 'w2' },
    { id: 'color', name: 'Цветная', c: 'неотрад, акварель', img: 'w1' },
    { id: 'real', name: 'Реализм', c: 'портреты, животные', img: 'w4' },
    { id: 'trad', name: 'Олдскул', c: 'классика флэша', img: 'w14' },
    { id: 'letter', name: 'Леттеринг', c: 'надписи, шрифты', img: 'w5' },
    { id: 'mini', name: 'Мини', c: 'до 5 см, за 1 час', img: 'w6' }
  ];
  var styleById = {};
  STYLES.forEach(function (s) { styleById[s.id] = s; });

  var MASTERS = [
    { id: 'den', name: 'Денис', styles: ['black', 'real', 'trad'], img: 'm1', text: '9 лет стажа. Блэкворк и реализм, крупные проекты: рукава, спины, перекрытия старых работ.' },
    { id: 'vera', name: 'Вера', styles: ['fine', 'mini', 'letter'], img: 'm2', text: 'Тонкие линии, ботаника и надписи. Каждый эскиз рисует от руки под анатомию.' },
    { id: 'alisa', name: 'Алиса', styles: ['color', 'trad'], img: 'm3', text: 'Цветные работы и олдскул. Ведёт пирсинг — медицинское образование, лицензия.' }
  ];
  var masterById = {};
  MASTERS.forEach(function (m) { masterById[m.id] = m; });

  // работа: [файл, стиль, мастер, размер s/m/l, место]
  var WORKS = [
    ['w1', 'color', 'alisa', 'l', 'Предплечье'], ['w2', 'black', 'den', 'l', 'Спина'], ['w3', 'color', 'alisa', 'l', 'Голени'],
    ['w4', 'real', 'den', 'm', 'Предплечье'], ['w5', 'letter', 'vera', 'm', 'Бедро'], ['w6', 'mini', 'vera', 's', 'Запястье'],
    ['w7', 'fine', 'vera', 's', 'Лопатка'], ['w8', 'color', 'alisa', 'l', 'Руки'], ['w9', 'black', 'den', 'l', 'Спина'],
    ['w10', 'mini', 'vera', 's', 'Кисть'], ['w11', 'letter', 'den', 'm', 'Предплечье'], ['w12', 'color', 'alisa', 'l', 'Рукав'],
    ['w13', 'black', 'den', 'l', 'Спина'], ['w14', 'trad', 'alisa', 'm', 'Предплечья'], ['w15', 'trad', 'den', 'm', 'Рука'],
    ['w16', 'black', 'den', 'm', 'Предплечье']
  ].map(function (w) { return { img: w[0], style: w[1], master: w[2], size: w[3], zone: w[4] }; });
  var SIZE_NAME = { s: 'мини', m: 'средняя', l: 'крупная' };

  var ZONE_K = { 'Предплечье': 1, 'Плечо': 1, 'Ключица': 1.15, 'Спина': 1.3, 'Рёбра': 1.35, 'Бедро': 1.2, 'Голень': 1.1, 'Шея': 1.3, 'Кисть': 1.4, 'Стопа': 1.4, 'Другое': 1.1 };
  var PIER = [['Мочка уха', 2500], ['Хеликс', 3000], ['Трагус', 3200], ['Крыло носа', 3000], ['Септум', 3500], ['Бровь', 3000], ['Пупок', 3500], ['Язык', 4000]];
  var PIER_SLOTS = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  var CONSULT_SLOTS = ['12:00', '12:30', '13:00', '17:00', '17:30', '18:00', '20:00', '20:30'];

  var briefs = FB.store.get('briefs', []);

  /* ================================================================ интро */

  (function intro() {
    var el = FB.$('#intro'), seen = false;
    try { seen = sessionStorage.getItem('ig:intro') === '1'; sessionStorage.setItem('ig:intro', '1'); } catch (e) {}
    if (FB.reduced || seen) { el.remove(); var w = FB.$('.hero__word'); if (w) w.style.animationDelay = '.1s'; return; }
    setTimeout(function () { el.classList.add('is-done'); setTimeout(function () { el.remove(); }, 700); }, 850);
  })();

  // лёгкий параллакс фона hero
  var heroImg = FB.$('.hero__bg img');
  if (!FB.reduced) FB.onScroll(function (y) { if (y < innerHeight * 1.2) heroImg.style.transform = 'scale(1.1) translate3d(0,' + (y * 0.18) + 'px,0)'; });

  /* ================================================================ стили с превью за курсором */

  var list = FB.$('#styleList');
  list.innerHTML = STYLES.map(function (s, i) {
    return '<li><button type="button" data-style="' + s.id + '" data-img="' + s.img + '" aria-pressed="false"><span class="n">0' + (i + 1) + '</span><span class="t">' + s.name + '</span><span class="c">' + s.c + '</span><img class="thumb" src="img/' + s.img + '.webp" alt="" loading="lazy"></button></li>';
  }).join('');
  var prev = FB.$('#cursorPreview'), pimg = prev.querySelector('img');
  var mx = 0, my = 0, px = 0, py = 0, raf = null;
  function follow() {
    px += (mx - px) * 0.18; py += (my - py) * 0.18;
    prev.style.left = px + 'px'; prev.style.top = py + 'px';
    raf = Math.abs(mx - px) + Math.abs(my - py) > 0.5 ? requestAnimationFrame(follow) : null;
  }
  list.addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(follow);
  });
  list.addEventListener('mouseover', function (e) {
    var b = e.target.closest('[data-img]');
    if (!b) return;
    var src = 'img/' + b.getAttribute('data-img') + '.webp';
    if (pimg.getAttribute('src') !== src) pimg.src = src;
    if (!prev.classList.contains('is-on')) { px = mx = e.clientX; py = my = e.clientY; prev.style.left = px + 'px'; prev.style.top = py + 'px'; }
    prev.classList.add('is-on');
  });
  list.addEventListener('mouseleave', function () { prev.classList.remove('is-on'); });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-style]');
    if (!b) return;
    setStyleFilter(b.getAttribute('data-style'));
    FB.scrollTo('#work');
  });

  /* ================================================================ портфолио */

  var fStyle = '', fMaster = FB.$('#fMaster'), fSize = FB.$('#fSize');
  MASTERS.forEach(function (m) { var o = document.createElement('option'); o.value = m.id; o.textContent = m.name; fMaster.appendChild(o); });
  FB.$('#fStyle').innerHTML = '<button type="button" aria-pressed="true" data-fs="">Все</button>' + STYLES.map(function (s) { return '<button type="button" aria-pressed="false" data-fs="' + s.id + '">' + s.name + '</button>'; }).join('');
  function setStyleFilter(id) {
    fStyle = id;
    FB.$$('[data-fs]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-fs') === id)); });
    FB.$$('[data-style]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-style') === id)); });
    renderGallery();
    FB.track('filter_portfolio', { style: id });
  }
  FB.$('#fStyle').addEventListener('click', function (e) { var b = e.target.closest('[data-fs]'); if (b) setStyleFilter(b.getAttribute('data-fs')); });
  [fMaster, fSize].forEach(function (s) { s.addEventListener('change', renderGallery); });

  var shown = [];
  function renderGallery() {
    shown = WORKS.filter(function (w) { return (!fStyle || w.style === fStyle) && (!fMaster.value || w.master === fMaster.value) && (!fSize.value || w.size === fSize.value); });
    FB.$('#gallery').innerHTML = shown.length ? shown.map(function (w, i) {
      return '<button class="gi" type="button" data-w="' + i + '" style="--i:' + i + '" aria-label="' + styleById[w.style].name + ', ' + w.zone + ', мастер ' + masterById[w.master].name + '"><figure style="margin:0">' +
        '<img src="img/' + w.img + '.webp" alt="" loading="lazy" width="546" height="683"><figcaption><span>' + styleById[w.style].name + ' · ' + w.zone + '</span><span class="gi__master">' + masterById[w.master].name + '</span></figcaption></figure></button>';
    }).join('') : '<p class="empty">Под эти фильтры работ пока нет — но мастер может сделать эскиз именно под вашу идею.</p>';
  }
  FB.$('#gallery').addEventListener('click', function (e) { var b = e.target.closest('[data-w]'); if (b) openLb(+b.getAttribute('data-w'), b); });

  /* ---------- лайтбокс ---------- */
  var lbI = 0;
  function showLb() {
    var w = shown[lbI];
    FB.$('#lbImg').src = 'img/' + w.img + '.webp';
    FB.$('#lbImg').alt = styleById[w.style].name + ', ' + w.zone;
    FB.$('#lbCap').textContent = (lbI + 1) + ' / ' + shown.length + ' · ' + styleById[w.style].name + ' · ' + w.zone + ' · ' + SIZE_NAME[w.size] + ' · мастер ' + masterById[w.master].name;
  }
  function openLb(i, opener) { lbI = i; showLb(); FB.modal.open('lightbox', opener); }
  function step(d) { lbI = (lbI + d + shown.length) % shown.length; showLb(); }
  FB.$('#lbPrev').addEventListener('click', function () { step(-1); });
  FB.$('#lbNext').addEventListener('click', function () { step(1); });
  document.addEventListener('keydown', function (e) {
    if (FB.modal.current() !== FB.$('#lightbox')) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  (function swipe() {
    var x0 = null, lb = FB.$('#lightbox');
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); x0 = null; });
  })();

  /* ================================================================ мастера */

  function freeDates(mid) {
    var rnd = FB.seeded('ig-free|' + mid + '|' + FB.iso(FB.today())), out = [];
    FB.days(30).slice(2).forEach(function (d) { if (out.length < 3 && rnd() < 0.18) out.push(d); });
    return out;
  }
  FB.$('#mgrid').innerHTML = MASTERS.map(function (m) {
    var fd = freeDates(m.id);
    return '<article class="master" data-reveal><img src="img/' + m.img + '.webp" width="512" height="640" alt="Мастер ' + m.name + '" loading="lazy"><div class="master__b">' +
      '<h3>' + m.name + '</h3><p class="master__styles">' + m.styles.map(function (s) { return styleById[s].name; }).join(' · ') + '</p><p>' + m.text + '</p>' +
      '<p class="master__free">Свободные даты: <b>' + (fd.length ? fd.map(function (d) { return FB.fmtDate(d, { day: 'numeric', month: 'short' }); }).join(', ') : 'запись на следующий месяц') + '</b></p>' +
      '<button class="btn btn--line btn--sm" type="button" data-to-master="' + m.id + '">Бриф к мастеру</button></div></article>';
  }).join('');
  FB.reveal(FB.$('#mgrid'));
  FB.$('#mgrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-to-master]');
    if (!b) return;
    FB.$('#bMaster').value = b.getAttribute('data-to-master');
    FB.scrollTo('#brief');
    FB.track('select_master', { master: b.getAttribute('data-to-master') });
  });

  /* ================================================================ калькулятор */

  function estimate(size, zoneK, colorK, detK) {
    var p = (3000 + size * size * 55 + size * 600) * zoneK * colorK * detK;
    p = Math.max(4000, Math.round(p / 500) * 500);
    var hours = (0.5 + size * size * 0.012 + size * 0.08) * detK * colorK;
    return { lo: Math.max(4000, Math.round(p * 0.9 / 500) * 500), hi: Math.round(p * 1.15 / 500) * 500, sessions: Math.max(1, Math.ceil(hours / 6)), hours: hours };
  }
  function rangeText(e) { return FB.num(e.lo) + '–' + FB.money(e.hi); }
  var calc = FB.$('#calc');
  calc.addEventListener('submit', function (e) { e.preventDefault(); });
  function renderCalc() {
    var s = +FB.$('#cSize').value;
    FB.$('#cSizeOut').textContent = s + ' см';
    var e = estimate(s, +FB.$('#cZone').value, +calc.cColor.value, +calc.cDet.value);
    FB.$('#cOut').textContent = rangeText(e);
    FB.$('#cSess').textContent = e.sessions === 1 ? 'Один сеанс ≈ ' + Math.max(1, Math.round(e.hours)) + ' ч' : e.sessions + ' ' + FB.plural(e.sessions, ['сеанс', 'сеанса', 'сеансов']) + ' по 5–6 часов';
  }
  calc.addEventListener('input', renderCalc);
  calc.addEventListener('change', renderCalc);
  FB.$('#cToBrief').addEventListener('click', function () {
    FB.$('#bSize').value = FB.$('#cSize').value;
    var zoneName = FB.$('#cZone').selectedOptions[0].textContent;
    var bz = FB.$('#bZone');
    if (FB.$$('option', bz).some(function (o) { return o.textContent === zoneName; })) bz.value = zoneName;
    var col = calc.cColor.value === '1.2' ? 'Цветная' : 'Чёрно-белая';
    var r = FB.$('input[name=color][value="' + col + '"]', FB.$('#briefForm'));
    if (r) r.checked = true;
    renderBriefEst();
  });

  /* ================================================================ флэш-день */

  FB.$('#flashBtn').addEventListener('click', function () {
    var idea = FB.$('#bIdea');
    if (!idea.value) idea.value = 'Хочу на флэш-день: готовый эскиз со скидкой 20%. Интересует стиль олдскул, размер до 10 см.';
    var t = FB.$('input[name=style][value="trad"]');
    if (t) t.checked = true;
    FB.scrollTo('#brief');
  });

  /* ================================================================ дни и слоты (пирсинг, консультации) */

  function daysHtml(name, n) {
    return FB.days(n).map(function (d, i) {
      return '<label><input type="radio" name="' + name + '" value="' + FB.iso(d) + '"' + (i === 0 ? ' checked' : '') + '><span>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.weekday(d, true)) + '<b>' + d.getDate() + '</b></span></label>';
    }).join('');
  }
  function renderSlots(box, name, resource, date, slots, density) {
    box.innerHTML = '<span class="muted">Проверяем время…</span>';
    return FB.lead.busy(resource, date, slots, density).then(function (busy) {
      var free = 0;
      box.innerHTML = slots.map(function (t) {
        var dis = busy.indexOf(t) >= 0 || FB.isPastSlot(date, t);
        if (!dis) free++;
        return '<label><input type="radio" name="' + name + '" value="' + t + '"' + (dis ? ' disabled' : '') + '><span>' + t + '</span></label>';
      }).join('') + (free ? '' : '<span class="muted">Свободного времени нет — выберите другой день</span>');
    });
  }

  /* ================================================================ пирсинг */

  var pf = FB.$('#pierForm');
  FB.$('#pierList').innerHTML = PIER.map(function (p, i) {
    return '<label><input type="radio" name="pier" value="' + p[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + p[0] + '<b>' + FB.money(p[1]) + '</b></span></label>';
  }).join('');
  FB.$('#pDays').innerHTML = daysHtml('pdate', 7);
  function pierSlots() { renderSlots(FB.$('#pSlots'), 'ptime', 'pier', (FB.$('input[name=pdate]:checked', pf) || {}).value, PIER_SLOTS, 0.35); }
  FB.$('#pDays').addEventListener('change', pierSlots);
  pierSlots();
  function pierPrice() { var v = (FB.$('input[name=pier]:checked', pf) || {}).value; return (PIER.filter(function (p) { return p[0] === v; })[0] || [0, 0])[1]; }
  pf.addEventListener('change', function (e) { if (e.target.name === 'pier') FB.$('#pSubmit').textContent = 'Записаться · ' + FB.money(pierPrice()); });
  FB.$('#pSubmit').textContent = 'Записаться · ' + FB.money(pierPrice());
  FB.form(pf, {
    type: 'piercing',
    before: function () { return FB.$('input[name=ptime]:checked', pf) ? true : 'Выберите время.'; },
    collect: function (fd) { return { service: 'Пирсинг: ' + fd.get('pier'), resource: 'pier', date: fd.get('pdate'), time: fd.get('ptime'), total: FB.money(pierPrice()), master: 'Алиса' }; },
    success: function (res, p) {
      FB.toast('Записали на ' + p.service.toLowerCase() + ' — ' + FB.fmtDate(p.date) + ' в ' + p.time + '. Заявка ' + res.id, 'ok', 6000);
      pf.insertAdjacentHTML('afterend', '<div class="bdone"><p class="kicker">Прокол</p><div class="bnum">' + FB.esc(res.id) + '</div><p class="muted">' + FB.esc(p.service) + ', ' + FB.fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' }) + ' в ' + p.time + '. Возьмите паспорт. За 2 часа до прокола — без алкоголя и кофе.</p></div>');
      pf.hidden = true;
    }
  });

  /* ================================================================ бриф */

  var bf = FB.$('#briefForm');
  FB.$('#bStyle').innerHTML = '<label><input type="radio" name="style" value="" checked><span>Посоветуйте</span></label>' + STYLES.map(function (s) {
    return '<label><input type="radio" name="style" value="' + s.id + '"><span>' + s.name + '</span></label>';
  }).join('');
  MASTERS.forEach(function (m) { var o = document.createElement('option'); o.value = m.id; o.textContent = m.name + ' — ' + m.styles.map(function (s) { return styleById[s].name.toLowerCase(); }).join(', '); FB.$('#bMaster').appendChild(o); });
  (function months() {
    var sel = FB.$('#bWhen'), d = FB.today(), html = '<option>Как можно скорее</option>';
    for (var i = 0; i < 6; i++) { var m = new Date(d.getFullYear(), d.getMonth() + i, 1); html += '<option>' + m.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + '</option>'; }
    sel.innerHTML = html;
  })();
  FB.files(FB.$('#bFiles'), { max: 6, maxSize: 10 * 1024 * 1024, list: FB.$('#bFileList') });

  function renderBriefEst() {
    var s = +FB.$('#bSize').value;
    FB.$('#bSizeOut').textContent = s + ' см';
    var col = (FB.$('input[name=color]:checked', bf) || {}).value === 'Цветная' ? 1.2 : 1;
    var det = (FB.$('input[name=style]:checked', bf) || {}).value === 'real' ? 1.3 : (FB.$('input[name=style]:checked', bf) || {}).value === 'fine' ? 0.9 : 1;
    var e = estimate(s, ZONE_K[FB.$('#bZone').value] || 1, col, det);
    FB.$('#bEst').textContent = rangeText(e);
    return e;
  }
  bf.addEventListener('input', renderBriefEst);
  bf.addEventListener('change', renderBriefEst);

  FB.$('#cDays').innerHTML = daysHtml('cdate', 7);
  function consultSlots() { renderSlots(FB.$('#cSlots'), 'ctime', 'consult', (FB.$('input[name=cdate]:checked', bf) || {}).value, CONSULT_SLOTS, 0.4); }
  FB.$('#cDays').addEventListener('change', consultSlots);
  FB.$('#bConsult').addEventListener('change', function (e) { FB.$('#consultPick').hidden = !e.target.checked; if (e.target.checked) consultSlots(); });

  FB.form(bf, {
    type: 'tattoo_brief',
    before: function () { return !FB.$('#bConsult').checked || FB.$('input[name=ctime]:checked', bf) ? true : 'Выберите время консультации или снимите галочку.'; },
    collect: function (fd) {
      var e = renderBriefEst(), st = fd.get('style');
      var consult = fd.get('consult') ? fd.get('cdate') + ' ' + fd.get('ctime') : '';
      return {
        service: 'Тату: ' + (st ? styleById[st].name : 'стиль на выбор мастера'), master: fd.get('master') ? masterById[fd.get('master')].name : 'подобрать',
        date: consult ? fd.get('cdate') : '', time: consult ? fd.get('ctime') : '', resource: consult ? 'consult' : '',
        total: rangeText(e),
        details: { 'Место': fd.get('zone'), 'Размер': fd.get('size') + ' см', 'Цвет': fd.get('color'), 'Когда': fd.get('when'), 'Бюджет': fd.get('budget'), 'Перекрытие': fd.get('cover'), 'Консультация': consult || 'нет', 'Фото в портфолио': fd.get('photo') ? 'можно' : 'нельзя' }
      };
    },
    success: function (res, p) {
      briefs.unshift({ id: res.id, contact: p.contact, name: p.name, at: new Date().toISOString() });
      FB.store.set('briefs', briefs.slice(0, 10));
      bf.hidden = true;
      var d = FB.$('#briefDone');
      d.hidden = false;
      d.innerHTML = '<p class="kicker">Бриф отправлен</p><div class="bnum">' + FB.esc(res.id) + '</div>' +
        '<p class="lead" style="margin:0">Мастер напишет в течение дня' + (p.date ? ', консультация — ' + FB.fmtDate(p.date, { day: 'numeric', month: 'long' }) + ' в ' + p.time : '') + '. Эскиз — 3–7 дней. Предоплата 3 000 ₽ только после того, как эскиз вам понравится.</p>' +
        '<div class="hero__cta"><a class="btn btn--lime" href="#status" id="toSt" data-id="' + FB.esc(res.id) + '">Следить за статусом</a><a class="btn btn--line" target="_blank" rel="noopener" href="' + FB.tgLink('Бриф ' + res.id) + '">Написать мастеру</a></div>';
      FB.scrollTo(d, { focus: false });
    }
  });
  FB.$('#briefDone').addEventListener('click', function (e) { if (e.target.id === 'toSt') { FB.$('#stId').value = e.target.getAttribute('data-id'); checkStatus(); } });

  /* ================================================================ статус эскиза */

  var ST = [['new', 'Заявка'], ['qualified', 'Уточнение'], ['confirmed', 'Эскиз готов'], ['in_work', 'Сеанс назначен'], ['done', 'Готово']];
  function checkStatus() {
    var id = FB.$('#stId').value.trim(), out = FB.$('#stOut');
    if (!id) return;
    out.innerHTML = '<div class="st-card"><span class="muted">Ищем…</span></div>';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.innerHTML = '<div class="st-card"><p>Заявка ' + FB.esc(id.toUpperCase()) + ' не найдена.</p><p class="muted">Проверьте номер или напишите в Telegram.</p></div>'; return; }
      var i = Math.max(0, ST.map(function (s) { return s[0]; }).indexOf(r.status === 'repeat' ? 'done' : r.status));
      var mine = briefs.filter(function (b) { return b.id === r.id; })[0];
      var fb = FB.store.get('sketchFb', {})[r.id];
      var html = '<div class="st-card"><p class="kicker">' + FB.esc(r.id) + '</p><ol class="st-steps" role="list">' + ST.map(function (s, k) { return '<li class="' + (k <= i ? 'on' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>';
      if (r.status === 'canceled') html += '<p>Заявка отменена.</p>';
      else if (i === 2) {
        html += fb ? '<p>Ваш ответ по эскизу: <b>' + FB.esc(fb) + '</b>. Мастер свяжется.</p>' : !mine ? '<p class="muted">Эскиз можно согласовать с устройства, с которого отправляли бриф, или в Telegram.</p>' :
          '<p>Эскиз отправлен вам в мессенджер. Что скажете?</p><div class="field"><label for="fbText">Комментарий или правки</label><textarea id="fbText" rows="2"></textarea></div>' +
          '<div class="hero__cta"><button class="btn btn--lime" type="button" data-fb="ok">Эскиз нравится, внести предоплату 3 000 ₽</button><button class="btn btn--line" type="button" data-fb="edit">Нужны правки</button></div>';
      } else if (i === 3) html += '<p>Сеанс назначен. За день пришлём напоминание: выспаться, плотно поесть, без алкоголя за 24 часа.</p>';
      else if (i === 4) html += '<p>Сеанс проведён. Памятка по уходу — <a href="#care">ниже на странице</a>. Коррекция бесплатно в течение 2 месяцев.</p>';
      else html += '<p class="muted">Мастер изучает бриф и напишет в течение дня.</p>';
      if (!FB.lead.isServer()) html += '<p class="muted">Демо-режим: статусы меняются в CRM-панели при запуске через сервер.</p>';
      out.innerHTML = html + '</div>';
      out.__id = r.id;
    });
  }
  FB.$('#stForm').addEventListener('submit', function (e) { e.preventDefault(); checkStatus(); });
  FB.$('#stOut').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fb]');
    if (!b) return;
    var out = FB.$('#stOut'), id = out.__id, mine = briefs.filter(function (x) { return x.id === id; })[0] || {};
    var ok = b.getAttribute('data-fb') === 'ok', text = FB.$('#fbText').value.trim();
    if (!ok && !text) { FB.toast('Опишите правки — мастер учтёт их в следующей версии', 'error'); FB.$('#fbText').focus(); return; }
    b.disabled = true;
    FB.lead.submit({ type: ok ? 'prepay' : 'sketch_feedback', name: mine.name, contact: mine.contact, phone: /^\+?[\d\s()-]{11,}$/.test(mine.contact || '') ? mine.contact : '', service: ok ? 'Эскиз согласован, предоплата 3 000 ₽' : 'Правки по эскизу', details: { 'Заявка': id, 'Комментарий': text || '—' } })
      .then(function () {
        var s = FB.store.get('sketchFb', {}); s[id] = ok ? 'согласован, ждём ссылку на предоплату' : 'нужны правки'; FB.store.set('sketchFb', s);
        FB.toast(ok ? 'Отлично! Ссылку на предоплату пришлём в течение 15 минут' : 'Правки переданы мастеру', 'ok', 6000);
        if (ok) FB.track('start_payment', { id: id, total: 3000 });
        checkStatus();
      })
      .catch(function (err) { b.disabled = false; FB.toast(err.message, 'error'); });
  });

  /* ================================================================ старт */

  renderGallery();
  renderCalc();
  renderBriefEst();
})();
