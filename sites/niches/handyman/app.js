/* Починим — мастер на час: прайс со сметой, заявка в 5 шагов (фото, голос, адрес, окно), статус и оценка. */
(function () {
  'use strict';
  FB.init();
  var root = document.documentElement;

  /* ================================================================ справочники */

  var CATS = [
    { id: 'plumb', name: 'Сантехника', desc: 'Смесители, унитазы, трубы, засоры, подключение стиральных машин', from: 900, img: 'img/faucet.webp' },
    { id: 'elec',  name: 'Электрика', desc: 'Розетки, выключатели, автоматы, люстры, замена проводки', from: 800, img: 'img/electric.webp' },
    { id: 'furn',  name: 'Сборка мебели', desc: 'Шкафы, кухни, кровати, комоды — любых фабрик и IKEA', from: 1200, img: 'img/plane.webp' },
    { id: 'hang',  name: 'Повесить и закрепить', desc: 'Полки, карнизы, телевизоры, зеркала, картины, турники', from: 500, img: 'img/drill.webp' },
    { id: 'doors', name: 'Двери и замки', desc: 'Регулировка, замена замков и ручек, доводчики, петли', from: 1000, img: 'img/tools.webp' },
    { id: 'small', name: 'Мелкий ремонт', desc: 'Плинтусы, герметик, подкраска, починка «по списку»', from: 700, img: 'img/paint.webp' }
  ];
  var catById = {};
  CATS.forEach(function (c) { catById[c.id] = c; });

  // [категория, работа, минут, цена]
  var PRICE = [
    ['plumb', 'Замена смесителя (раковина, кухня)', 40, 1500], ['plumb', 'Замена смесителя в ванной', 60, 1900],
    ['plumb', 'Устранение протечки соединения', 30, 900], ['plumb', 'Замена сифона', 30, 900],
    ['plumb', 'Прочистка засора раковины', 40, 1200], ['plumb', 'Замена арматуры бачка унитаза', 50, 1600],
    ['plumb', 'Установка унитаза-компакта', 120, 3500], ['plumb', 'Подключение стиральной машины', 60, 1800],
    ['plumb', 'Установка полотенцесушителя', 120, 3800],
    ['elec', 'Замена розетки или выключателя', 20, 450], ['elec', 'Установка новой розетки (с штроблением)', 60, 1500],
    ['elec', 'Установка люстры', 60, 1400], ['elec', 'Установка точечного светильника', 20, 400],
    ['elec', 'Замена автомата в щитке', 30, 900], ['elec', 'Поиск неисправности в проводке', 60, 1800],
    ['elec', 'Подключение электроплиты', 60, 1700],
    ['furn', 'Сборка шкафа (2 двери)', 120, 2900], ['furn', 'Сборка шкафа-купе', 240, 5500],
    ['furn', 'Сборка кровати', 90, 2400], ['furn', 'Сборка комода', 90, 1900],
    ['furn', 'Сборка кухни, за погонный метр', 120, 3800], ['furn', 'Навес кухонного шкафа', 30, 700],
    ['hang', 'Повесить полку', 20, 500], ['hang', 'Повесить карниз', 45, 1100],
    ['hang', 'Кронштейн и телевизор до 65"', 60, 2000], ['hang', 'Повесить зеркало или картину', 20, 500],
    ['doors', 'Регулировка межкомнатной двери', 30, 1000], ['doors', 'Замена замка входной двери', 60, 2200],
    ['doors', 'Врезка замка в межкомнатную дверь', 60, 1800], ['doors', 'Установка доводчика', 45, 1500],
    ['small', 'Замена герметика в ванной (до 3 м)', 60, 1600], ['small', 'Установка плинтуса, за метр', 6, 180],
    ['small', 'Мелкий ремонт по списку, час работы', 60, 1300]
  ].map(function (r, i) { return { id: 'p' + i, cat: r[0], name: r[1], min: r[2], price: r[3] }; });
  var priceById = {};
  PRICE.forEach(function (p) { priceById[p.id] = p; });

  var DISTRICTS = [
    ['Вахитовский', 0, 60], ['Советский', 0, 70], ['Ново-Савиновский', 0, 70], ['Московский', 0, 80],
    ['Кировский', 0, 90], ['Приволжский', 0, 80], ['Авиастроительный', 0, 90],
    ['Высокая Гора (пригород)', 300, 120], ['Осиново (пригород)', 300, 120], ['Иннополис', 600, 150]
  ];
  var WINDOWS = ['09:00', '12:00', '15:00', '18:00'];

  var REVIEWS = [
    { cat: 'plumb', s: 5, t: 'Потёк смеситель в воскресенье вечером. Отправила видео в 19:40, в 21:10 Руслан уже всё поменял. Цену назвали заранее, так и заплатила.', n: 'Алсу', d: 'Советский р-н', m: 'август 2026' },
    { cat: 'elec', s: 5, t: 'Выбивало автомат при включении духовки. Андрей нашёл скрутку в распредкоробке, переделал на клеммы, показал фото до и после.', n: 'Дмитрий', d: 'Ново-Савиновский р-н', m: 'июль 2026' },
    { cat: 'furn', s: 5, t: 'Собрали шкаф-купе и две кровати за один выезд. Мусор и коробки вынесли — это отдельное спасибо.', n: 'Марина', d: 'Приволжский р-н', m: 'сентябрь 2026' },
    { cat: 'small', s: 4, t: 'Сделали всё по списку из 8 пунктов за 3 часа. Минус звезда — опоздание на 20 минут, но предупредили заранее.', n: 'Ильдар', d: 'Вахитовский р-н', m: 'июнь 2026' },
    { cat: 'plumb', s: 5, t: 'Меняли унитаз. Мастер сам купил гофру и манжету по чеку, всё аккуратно, бахилы, плёнка на полу.', n: 'Елена', d: 'Московский р-н', m: 'май 2026' },
    { cat: 'hang', s: 5, t: 'Повесили телевизор на гипсокартон — с закладной, как положено. Висит уже два месяца.', n: 'Артём', d: 'Кировский р-н', m: 'июль 2026' },
    { cat: 'elec', s: 5, t: 'Поменяли все розетки и выключатели в двушке за день. Цена по прайсу с сайта, без сюрпризов.', n: 'Гульнара', d: 'Авиастроительный р-н', m: 'апрель 2026' },
    { cat: 'furn', s: 5, t: 'Кухня из Леруа, 3,5 метра. Олег подогнал столешницу и врезал мойку. Очень доволен.', n: 'Сергей', d: 'Советский р-н', m: 'август 2026' }
  ];

  /* ================================================================ прелоадер */

  (function loader() {
    var el = FB.$('#loader'), cnt = FB.$('#loaderCount');
    var seen = false;
    try { seen = sessionStorage.getItem('pn:loaded') === '1'; sessionStorage.setItem('pn:loaded', '1'); } catch (e) {}
    if (FB.reduced || seen) { el.remove(); return; }
    var t0 = performance.now(), dur = 800;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      cnt.textContent = String(Math.round(p * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick);
      else { el.classList.add('is-done'); setTimeout(function () { el.remove(); }, 600); }
    })(t0);
  })();

  /* ================================================================ светлый/тёмный фон под шапкой + scroll-spy */

  var darks = FB.$$('.hero, .block--green, .footer');
  FB.onScroll(function () {
    var y = 40, onDark = darks.some(function (s) { var r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
    var yr = innerHeight * 0.35, railDark = darks.some(function (s) { var r = s.getBoundingClientRect(); return r.top <= yr && r.bottom >= yr; });
    root.classList.toggle('on-paper', !onDark);
    FB.$('.rail').classList.toggle('on-paper', !railDark);
  });
  var spyLinks = FB.$$('[data-spy]');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        spyLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyLinks.forEach(function (a) { var s = FB.$(a.getAttribute('href')); if (s) spy.observe(s); });
  }

  /* ================================================================ плитки задач */

  FB.$('#tiles').innerHTML = CATS.map(function (c, i) {
    return '<button class="tile" type="button" data-reveal data-cat="' + c.id + '">' +
      '<span><span class="tile__n">0' + (i + 1) + '</span><span class="tile__h">' + c.name + '</span><span class="tile__p">' + c.desc + '</span></span>' +
      '<span class="tile__price">от ' + FB.money(c.from) + '</span><span class="tile__go" aria-hidden="true">→</span>' +
      '<img src="' + c.img + '" alt="" loading="lazy"></button>';
  }).join('');
  FB.reveal(FB.$('#tiles'));
  FB.$('#tiles').addEventListener('click', function (e) {
    var t = e.target.closest('[data-cat]');
    if (!t) return;
    selectCat(t.getAttribute('data-cat'));
    goStep(0);
    FB.scrollTo('#request');
    FB.track('select_service', { cat: t.getAttribute('data-cat') });
  });

  /* ================================================================ прайс и смета */

  var est = FB.store.get('estimate', {}); // id → количество
  var priceCat = '';
  var catsBox = FB.$('#priceCats');
  catsBox.innerHTML = '<button type="button" aria-pressed="true" data-pc="">Все</button>' + CATS.map(function (c) {
    return '<button type="button" aria-pressed="false" data-pc="' + c.id + '">' + c.name + '</button>';
  }).join('');
  catsBox.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pc]');
    if (!b) return;
    priceCat = b.getAttribute('data-pc');
    FB.$$('[data-pc]', catsBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderPrice();
  });
  var search = FB.$('#priceSearch');
  search.addEventListener('input', FB.debounce(renderPrice, 120));

  function fmtMin(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h ? h + ' ч' : '') + (h && mm ? ' ' : '') + (mm ? mm + ' мин' : '');
  }

  function renderPrice() {
    var q = search.value.trim().toLowerCase();
    var rows = PRICE.filter(function (p) { return (!priceCat || p.cat === priceCat) && (!q || p.name.toLowerCase().indexOf(q) >= 0); });
    FB.$('#priceBody').innerHTML = rows.length ? rows.map(function (p) {
      var on = !!est[p.id];
      return '<tr' + (on ? ' class="is-added"' : '') + '><td>' + p.name + '</td><td>' + fmtMin(p.min) + '</td><td>' + FB.money(p.price) + '</td>' +
        '<td><button class="add" type="button" data-add="' + p.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Убрать из сметы: ' : 'Добавить в смету: ') + p.name + '">+</button></td></tr>';
    }).join('') : '<tr class="empty"><td colspan="4">Ничего не нашли. Опишите задачу в заявке — оценим индивидуально.</td></tr>';
  }
  FB.$('#priceBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    var id = b.getAttribute('data-add');
    if (est[id]) delete est[id]; else est[id] = 1;
    saveEst();
  });
  FB.$('#estItems').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]');
    if (!b) return;
    var id = b.getAttribute('data-id'), d = +b.getAttribute('data-q');
    est[id] = (est[id] || 0) + d;
    if (est[id] <= 0) delete est[id];
    saveEst();
  });
  function saveEst() { FB.store.set('estimate', est); renderPrice(); renderEst(); }

  function estCalc() {
    var ids = Object.keys(est), work = 0, min = 0;
    ids.forEach(function (id) { var p = priceById[id]; if (!p) return; work += p.price * est[id]; min += p.min * est[id]; });
    var total = ids.length ? Math.max(1000, work) : 0;
    return { ids: ids, work: work, total: total, min: min, trip: ids.length ? (total >= 1500 ? 0 : 400) : null };
  }

  var shownTotal = 0;
  function renderEst() {
    var c = estCalc(), box = FB.$('#estItems');
    box.innerHTML = c.ids.length ? c.ids.map(function (id) {
      var p = priceById[id];
      return '<li><span>' + p.name + '</span><strong>' + FB.money(p.price * est[id]) + '</strong>' +
        '<span class="qty"><button type="button" data-q="-1" data-id="' + id + '" aria-label="Меньше">−</button>' + est[id] + '<button type="button" data-q="1" data-id="' + id + '" aria-label="Больше">+</button></span></li>';
    }).join('') : '<li class="empty">Добавьте работы из прайса плюсиком — посчитаем сумму и время.</li>';
    FB.$('#estTrip').textContent = c.trip === null ? 'бесплатно от 1 500 ₽' : c.trip ? '400 ₽' : 'бесплатно';
    var el = FB.$('#estTotal'), to = c.total + (c.trip || 0);
    if (FB.anime && !FB.reduced && to !== shownTotal) {
      var o = { v: shownTotal };
      FB.anime.animate(o, { v: to, duration: 500, ease: 'outCubic', onUpdate: function () { el.textContent = FB.money(o.v); } });
    } else el.textContent = FB.money(to);
    shownTotal = to;
    FB.$('#estTime').textContent = c.min ? 'Время работы ≈ ' + fmtMin(c.min) + (c.work < 1000 ? ' · минимальный заказ 1 000 ₽' : '') : '';
    FB.$('#estToRequest').disabled = !c.ids.length;
    updateEstNote();
  }
  FB.$('#estToRequest').addEventListener('click', function () {
    var c = estCalc(), counts = {};
    c.ids.forEach(function (id) { counts[priceById[id].cat] = (counts[priceById[id].cat] || 0) + 1; });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    selectCat(top);
    var desc = FB.$('#rDesc');
    if (!desc.value.trim()) desc.value = 'По смете: ' + c.ids.map(function (id) { return priceById[id].name + (est[id] > 1 ? ' ×' + est[id] : ''); }).join('; ') + '.';
    goStep(0);
    FB.scrollTo('#request');
    FB.track('click_primary_cta', { from: 'estimate', total: c.total });
  });

  /* ================================================================ заявка: шаги */

  var form = FB.$('#reqForm');
  var steps = FB.$$('[data-wstep]', form);
  var stepLis = FB.$$('#wizSteps li');
  var cur = 0;

  FB.$('#catChips').innerHTML = CATS.map(function (c, i) {
    return '<label class="chip"><input type="radio" name="cat" value="' + c.id + '"' + (i === 0 ? ' data-validate="required" data-msg="Выберите, что нужно сделать"' : '') + '><span>' + c.name + '</span></label>';
  }).join('');
  function selectCat(id) {
    var r = FB.$('input[name=cat][value="' + id + '"]', form);
    if (r) { r.checked = true; FB.setError(r, ''); }
  }

  function goStep(n) {
    cur = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach(function (s, i) { s.hidden = i !== cur; });
    stepLis.forEach(function (li, i) { li.classList.toggle('is-active', i === cur); li.classList.toggle('is-done', i < cur); });
    FB.$('#wizBack').hidden = cur === 0;
    FB.$('#wizNext').hidden = cur === steps.length - 1;
    FB.$('#wizSubmit').hidden = cur !== steps.length - 1;
    FB.$('[data-form-error]', form).textContent = '';
    if (cur === 4) renderSummary();
  }

  function stepValid() {
    var s = steps[cur];
    if (!FB.validate(s)) return false;
    if (cur === 3 && !FB.$('#rUrgent').checked && !FB.$('input[name=window]:checked', form)) {
      FB.$('[data-form-error]', form).textContent = 'Выберите окно приезда или отметьте «Срочно».';
      return false;
    }
    return true;
  }
  FB.$('#wizNext').addEventListener('click', function () {
    if (!stepValid()) return;
    goStep(cur + 1);
    FB.scrollTo('#request', { focus: false });
    FB.track('wizard_step', { step: cur });
  });
  FB.$('#wizBack').addEventListener('click', function () { goStep(cur - 1); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && cur < steps.length - 1) {
      e.preventDefault();
      FB.$('#wizNext').click();
    }
  });

  // оценка по смете прямо в заявке
  function updateEstNote() {
    var c = estCalc(), note = FB.$('#estNote');
    note.hidden = !c.ids.length;
    if (c.ids.length) note.innerHTML = 'Ориентир по вашей смете: <b>' + FB.money(c.total + (c.trip || 0)) + '</b>, ≈ ' + fmtMin(c.min) + '. Мастер подтвердит цену до начала работ.';
  }

  /* ---------- голосовое описание ---------- */

  var voiceFile = document.createElement('input');
  voiceFile.type = 'file';
  voiceFile.hidden = true;
  voiceFile.fbFiles = [];
  form.appendChild(voiceFile);
  (function voice() {
    var btn = FB.$('#voiceBtn'), lbl = FB.$('#voiceLabel'), timeEl = FB.$('#voiceTime'), player = FB.$('#voicePlayer'), del = FB.$('#voiceDel');
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { FB.$('#voice').hidden = true; return; }
    var rec = null, chunks = [], timer = null, t0 = 0, stream = null;
    function stop() { if (rec && rec.state === 'recording') rec.stop(); }
    btn.addEventListener('click', function () {
      if (rec && rec.state === 'recording') { stop(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s;
        chunks = [];
        rec = new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          clearInterval(timer);
          stream.getTracks().forEach(function (t) { t.stop(); });
          btn.classList.remove('is-recording');
          lbl.textContent = 'Записать заново';
          var type = (rec.mimeType || 'audio/webm').split(';')[0];
          var blob = new Blob(chunks, { type: type });
          voiceFile.fbFiles = [new File([blob], 'golosovoe.' + (type.indexOf('mp4') >= 0 ? 'm4a' : type.indexOf('ogg') >= 0 ? 'ogg' : 'webm'), { type: type })];
          player.src = URL.createObjectURL(blob);
          player.hidden = false;
          del.hidden = false;
          timeEl.textContent = '';
          FB.track('upload_file', { type: 'voice' });
        };
        rec.start();
        t0 = Date.now();
        btn.classList.add('is-recording');
        lbl.textContent = 'Остановить';
        timer = setInterval(function () {
          var s = Math.floor((Date.now() - t0) / 1000);
          timeEl.textContent = '● ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' / 1:00';
          if (s >= 60) stop();
        }, 250);
      }).catch(function () {
        FB.toast('Нет доступа к микрофону — опишите задачу текстом или разрешите микрофон в браузере', 'error', 6000);
      });
    });
    del.addEventListener('click', function () {
      voiceFile.fbFiles = [];
      player.hidden = true; player.removeAttribute('src');
      del.hidden = true;
      lbl.textContent = 'Надиктовать голосом';
    });
    voiceFile.fbReset = function () { del.click(); };
  })();

  FB.files(FB.$('#rFiles'), { max: 5, maxSize: 10 * 1024 * 1024, list: FB.$('#rFileList') });

  /* ---------- адрес ---------- */

  var distSel = FB.$('#rDistrict');
  DISTRICTS.forEach(function (d) { var o = document.createElement('option'); o.value = d[0]; o.textContent = d[0]; distSel.appendChild(o); });
  distSel.addEventListener('change', function () {
    var d = DISTRICTS.filter(function (x) { return x[0] === distSel.value; })[0];
    FB.$('#districtInfo').textContent = d ? (d[1] ? 'Выезд за город +' + FB.money(d[1]) + ' · ' : 'Выезд бесплатный от 1 500 ₽ · ') + 'срочный приезд ≈ ' + fmtMin(d[2]) : '';
  });

  /* ---------- дата и окно ---------- */

  var datesBox = FB.$('#rDates'), winBox = FB.$('#rWindows');
  datesBox.innerHTML = FB.days(7).map(function (d, i) {
    return '<label><input type="radio" name="date" value="' + FB.iso(d) + '"' + (i === 0 ? ' checked' : '') + '><span><small>' + (i === 0 ? 'сегодня' : i === 1 ? 'завтра' : FB.weekday(d, true)) + '</small><b>' + d.getDate() + '</b></span></label>';
  }).join('');
  function renderWindows() {
    var date = (FB.$('input[name=date]:checked', form) || {}).value;
    winBox.innerHTML = '<p class="hint">Проверяем свободных мастеров…</p>';
    FB.lead.busy('window', date, WINDOWS, 0.3).then(function (busy) {
      winBox.innerHTML = WINDOWS.map(function (w) {
        var end = String(+w.slice(0, 2) + 3).padStart(2, '0') + ':00';
        var dis = busy.indexOf(w) >= 0 || FB.isPastSlot(date, w.replace(':00', ':30'));
        return '<label><input type="radio" name="window" value="' + w + '"' + (dis ? ' disabled' : '') + '><span>' + w + '–' + end + '<small>' + (dis ? 'занято' : 'свободно') + '</small></span></label>';
      }).join('');
      if (!FB.$$('input[name=window]:not(:disabled)', winBox).length) winBox.insertAdjacentHTML('beforeend', '<p class="hint">На эту дату окон нет — выберите другой день или «Срочно».</p>');
    });
  }
  datesBox.addEventListener('change', function () { renderWindows(); FB.track('select_date'); });
  FB.$('#rUrgent').addEventListener('change', function (e) {
    FB.$('#slotPick').style.opacity = e.target.checked ? '.4' : '';
    FB.$('#slotPick').style.pointerEvents = e.target.checked ? 'none' : '';
  });
  renderWindows();

  /* ---------- сводка ---------- */

  function val(name) { var el = form.elements[name]; return el ? (el.value || '') : ''; }
  function renderSummary() {
    var cat = catById[val('cat')], c = estCalc(), urgent = FB.$('#rUrgent').checked;
    var d = DISTRICTS.filter(function (x) { return x[0] === val('district'); })[0];
    var files = FB.$('#rFiles').fbFiles.length + voiceFile.fbFiles.length;
    var when = urgent ? 'Срочно, в течение 2 часов' : FB.fmtDate(val('date'), { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + val('window') + '–' + String(+val('window').slice(0, 2) + 3).padStart(2, '0') + ':00';
    var extra = (urgent ? 500 : 0) + (d ? d[1] : 0);
    FB.$('#summary').innerHTML =
      '<div><b>' + (cat ? cat.name : '') + '</b> · ' + FB.esc(val('comment').slice(0, 90)) + (val('comment').length > 90 ? '…' : '') + '</div>' +
      '<div>' + FB.esc(val('district')) + ', ' + FB.esc(val('street')) + (val('flat') ? ', кв. ' + FB.esc(val('flat')) : '') + (val('floor') ? ', этаж ' + FB.esc(val('floor')) : '') + '</div>' +
      '<div>' + when + '</div>' +
      (files ? '<div>Вложений: ' + files + '</div>' : '') +
      (c.ids.length ? '<div class="sum-total">≈ ' + FB.money(c.total + (c.trip || 0) + extra) + '</div>' : (extra ? '<div>Доплата: ' + FB.money(extra) + ' (срочность/выезд)</div>' : '<div>Цену назовём после оценки — обычно в течение 15 минут.</div>'));
  }

  /* ---------- отправка ---------- */

  var orders = FB.store.get('orders', []);
  FB.form(form, {
    type: 'repair_request',
    before: function () { return cur === steps.length - 1 ? true : 'Пройдите все шаги заявки'; },
    collect: function () {
      var cat = catById[val('cat')], c = estCalc(), urgent = FB.$('#rUrgent').checked;
      return {
        service: cat ? cat.name : '', address: val('district') + ', ' + val('street') + (val('flat') ? ', кв. ' + val('flat') : ''),
        date: urgent ? FB.iso(FB.today()) : val('date'), time: urgent ? 'срочно' : val('window'),
        resource: 'window', total: c.ids.length ? FB.money(c.total + (c.trip || 0)) : '',
        details: {
          'Этаж / лифт': (val('floor') || '—') + ' / ' + (FB.$('input[name=lift]:checked', form) || {}).value,
          'Доступ': val('access') || '—', 'Связь': (FB.$('input[name=channel]:checked', form) || {}).value,
          'Срочно': urgent ? 'да (+500 ₽)' : 'нет',
          'Смета': c.ids.map(function (id) { return priceById[id].name + ' ×' + est[id]; }).join('; ') || '—'
        }
      };
    },
    success: function (res, payload) {
      var cat = val('cat') || (payload && payload.cat);
      orders.unshift({ id: res.id, phone: payload.phone, name: payload.name, cat: payload.cat || cat, service: payload.service, address: payload.address, district: payload.district, street: payload.street, date: payload.date, time: payload.time, at: new Date().toISOString() });
      FB.store.set('orders', orders.slice(0, 10));
      est = {}; saveEst();
      form.hidden = true;
      var done = FB.$('#reqDone');
      done.hidden = false;
      done.innerHTML = '<p class="kicker kicker--dark">Заявка принята</p><div class="done-id">' + FB.esc(res.id) + '</div>' +
        '<p class="lead lead--dark">' + (payload.time === 'срочно' ? 'Ищем ближайшего мастера — перезвоним в течение 10 минут.' : 'Перезвоним в течение 15 минут, чтобы подтвердить цену и окно ' + FB.fmtDate(payload.date) + ', ' + payload.time + '.') + ' Номер пригодится для статуса и гарантии.</p>' +
        '<div class="done-actions"><a class="btn btn--dark" href="#status" data-track-id="' + FB.esc(res.id) + '">Следить за статусом</a>' +
        '<a class="btn btn--line-dark" target="_blank" rel="noopener" href="' + FB.tgLink('Заявка ' + res.id) + '">Дописать в Telegram</a>' +
        '<button class="btn btn--line-dark" type="button" id="newReq">Новая заявка</button></div>';
      FB.scrollTo(done, { focus: false });
      renderOrders();
    }
  });
  FB.$('#reqDone').addEventListener('click', function (e) {
    if (e.target.id === 'newReq') { FB.$('#reqDone').hidden = true; form.hidden = false; goStep(0); }
    var tr = e.target.closest('[data-track-id]');
    if (tr) { FB.$('#stId').value = tr.getAttribute('data-track-id'); checkStatus(); }
  });

  /* ================================================================ статус и повтор */

  var STEPS = [['new', 'Заявка принята', 'Диспетчер уже смотрит'], ['qualified', 'Оценка готова', 'Цена согласована'], ['confirmed', 'Мастер назначен', 'Позвонит за 30 минут'], ['in_work', 'Мастер работает', 'Фото результата пришлём'], ['done', 'Готово', 'Гарантия 1 год']];

  function checkStatus() {
    var id = FB.$('#stId').value.trim();
    var box = FB.$('#statusResult');
    if (!id) return;
    box.innerHTML = '<p class="hint">Ищем заявку…</p>';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { box.innerHTML = '<h3 class="h3">Не нашли ' + FB.esc(id.toUpperCase()) + '</h3><p class="lead lead--dark">Проверьте номер или напишите нам — найдём по телефону.</p>'; return; }
      if (r.status === 'canceled') { box.innerHTML = '<h3 class="h3">' + FB.esc(r.id) + ' отменена</h3><p class="lead lead--dark">Если это ошибка — позвоните, восстановим.</p>'; return; }
      var idx = Math.max(0, STEPS.map(function (s) { return s[0]; }).indexOf(r.status));
      if (r.status === 'repeat') idx = 4;
      var rated = FB.store.get('rated', {})[r.id];
      var mine = orders.filter(function (o) { return o.id === r.id; })[0];
      box.innerHTML = '<p class="kicker kicker--dark">Заявка</p><h3 class="h3">' + FB.esc(r.id) + '</h3><ol class="timeline" role="list">' + STEPS.map(function (s, i) {
        return '<li class="' + (i < idx ? 'is-done' : i === idx ? (idx === 4 ? 'is-done' : 'is-now') : '') + '"><b>' + s[1] + '</b>' + s[2] + '</li>';
      }).join('') + '</ol>' +
        (idx === 4 ? (rated ? '<p class="lead lead--dark">Спасибо за оценку!</p>' : !mine ? '<p class="fineprint">Оценить мастера можно с устройства, с которого оформляли заявку, или по ссылке из SMS.</p>' :
          '<div class="rating"><b>Оцените мастера</b><div class="rate" role="radiogroup" aria-label="Оценка">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-rate="' + n + '" aria-label="' + n + ' из 5">★</button>'; }).join('') + '</div>' +
          '<div class="field"><label for="rateText">Комментарий</label><textarea id="rateText" rows="2"></textarea></div><button class="btn btn--dark btn--sm" type="button" id="rateSend" data-id="' + FB.esc(r.id) + '" disabled>Отправить отзыв</button></div>') : '') +
        (!FB.lead.isServer() ? '<p class="fineprint">Демо-режим: статусы меняются в CRM-панели при запуске через сервер.</p>' : '');
    });
  }
  FB.$('#statusForm').addEventListener('submit', function (e) { e.preventDefault(); checkStatus(); });

  var rating = 0;
  FB.$('#statusResult').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rate]');
    if (b) {
      rating = +b.getAttribute('data-rate');
      FB.$$('[data-rate]').forEach(function (x) { x.classList.toggle('is-on', +x.getAttribute('data-rate') <= rating); x.setAttribute('aria-checked', String(+x.getAttribute('data-rate') === rating)); });
      FB.$('#rateSend').disabled = false;
      return;
    }
    if (e.target.id === 'rateSend') {
      var id = e.target.getAttribute('data-id');
      e.target.disabled = true;
      var o = orders.filter(function (x) { return x.id === id; })[0] || {};
      FB.lead.submit({ type: 'review', name: o.name, phone: o.phone, service: 'Оценка мастера', details: { 'Заявка': id, 'Оценка': rating + ' из 5', 'Отзыв': FB.$('#rateText').value || '—' } })
        .then(function () { var r = FB.store.get('rated', {}); r[id] = rating; FB.store.set('rated', r); FB.toast('Спасибо! Отзыв передан руководителю', 'ok'); checkStatus(); })
        .catch(function (err) { e.target.disabled = false; FB.toast(err.message, 'error'); });
    }
  });

  function renderOrders() {
    var box = FB.$('#myOrders');
    if (!orders.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<ul class="orders" role="list">' + orders.slice(0, 5).map(function (o, i) {
      return '<li><span><b>' + FB.esc(o.id) + '</b> · ' + FB.esc(o.service || '') + '</span><span><button class="linkish" type="button" data-check="' + FB.esc(o.id) + '">Статус</button> · <button class="linkish" type="button" data-repeat="' + i + '">Повторить</button></span></li>';
    }).join('') + '</ul>';
  }
  FB.$('#myOrders').addEventListener('click', function (e) {
    var c = e.target.closest('[data-check]');
    if (c) { FB.$('#stId').value = c.getAttribute('data-check'); checkStatus(); return; }
    var r = e.target.closest('[data-repeat]');
    if (r) {
      var o = orders[+r.getAttribute('data-repeat')];
      if (o.cat) selectCat(o.cat);
      if (o.district) { distSel.value = o.district; distSel.dispatchEvent(new Event('change')); }
      if (o.street) FB.$('#rStreet').value = o.street;
      goStep(0);
      FB.scrollTo('#request');
      FB.track('repeat_booking', { from: o.id });
    }
  });

  /* ================================================================ процесс: активный шаг */

  var pSteps = FB.$$('.process__steps li');
  if ('IntersectionObserver' in window && innerWidth > 960) {
    var po = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = +e.target.getAttribute('data-step-i');
        pSteps.forEach(function (li, k) { li.classList.toggle('is-current', k === i); });
        FB.$('#processBar').style.width = ((i + 1) / pSteps.length * 100) + '%';
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    pSteps.forEach(function (li) { po.observe(li); });
  } else pSteps.forEach(function (li) { li.classList.add('is-current'); });

  /* ================================================================ отзывы */

  function renderReviews(cat) {
    FB.$('#reviews').innerHTML = REVIEWS.filter(function (r) { return !cat || r.cat === cat; }).map(function (r, i) {
      return '<blockquote class="review" style="animation-delay:' + i * 50 + 'ms"><div class="review__stars" aria-label="Оценка ' + r.s + ' из 5">' + '★★★★★'.slice(0, r.s) + '<span style="opacity:.25">' + '★★★★★'.slice(r.s) + '</span></div>' +
        '<p>' + r.t + '</p><footer><b>' + r.n + '</b> · ' + catById[r.cat].name + ' · ' + r.d + ' · ' + r.m + '</footer></blockquote>';
    }).join('');
  }
  FB.$('#revFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    FB.$$('#revFilter button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderReviews(b.getAttribute('data-cat'));
  });

  // на экране заявки нижняя кнопка «Описать проблему» не нужна
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { root.classList.toggle('in-request', en[0].isIntersecting); }, { threshold: 0.05 }).observe(FB.$('#request'));
  }

  /* ================================================================ старт */

  goStep(0);
  renderPrice();
  renderEst();
  renderReviews('');
  renderOrders();
})();
