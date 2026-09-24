/* Стол накрыт — форматы, конструктор рассадки (drag&drop, поворот, имена, подсчёт мест),
   пакеты меню с фильтром аллергенов, квиз-смета с проверкой даты, КП в PDF через печать. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочники */

  var FORMATS = [
    { id: 'corp', name: 'Корпоратив', from: 3900, img: 'hall', text: 'Банкет или фуршет для команды, рассадка по отделам', pack: 'ban-c', ratio: 12 },
    { id: 'wedding', name: 'Свадьба', from: 4500, img: 'banquet', text: 'Дегустация, торт, выездная кухня на любой площадке', pack: 'ban-p', ratio: 10 },
    { id: 'buffet', name: 'Фуршет', from: 1900, img: 'rolls', text: 'Открытие, презентация, вечер после конференции', pack: 'buf-s', ratio: 25 },
    { id: 'coffee', name: 'Кофе-брейк', from: 690, img: 'desserts', text: 'Для конференций и обучений, без очередей', pack: 'coffee', ratio: 40 },
    { id: 'private', name: 'Частный праздник', from: 2900, img: 'table', text: 'Юбилей, день рождения, семейный ужин дома', pack: 'ban-c', ratio: 12 },
    { id: 'bbq', name: 'Барбекю', from: 2700, img: 'steak', text: 'Гриль-станция и повар на природе или загородом', pack: 'bbq', ratio: 20 }
  ];
  var fmtById = {};
  FORMATS.forEach(function (f) { fmtById[f.id] = f; });

  var PACKS = [
    { id: 'coffee', name: 'Кофе-брейк', price: 690, per: 'на гостя · 20 минут', items: [['Кофе, чай, 3 вида', 'V'], ['Мини-круассаны с ветчиной', 'G L'], ['Сырники с ягодным соусом', 'G L V'], ['Фрукты на шпажках', 'V'], ['Макаронс', 'G L N V']] },
    { id: 'buf-l', name: 'Фуршет «Лайт»', price: 1900, per: '10 позиций · 350 г на гостя', items: [['Брускетты с томатами', 'G V'], ['Тарталетки с муссом из лосося', 'G L'], ['Роллы с огурцом и сливочным сыром', 'L'], ['Шпажки капрезе', 'L V'], ['Мини-бургеры', 'G L'], ['Эклеры', 'G L V']] },
    { id: 'buf-s', name: 'Фуршет «Стандарт»', price: 2600, per: '14 позиций · 500 г на гостя', hit: true, items: [['Канапе с ростбифом', 'G'], ['Тартар из тунца на рисовом чипсе', ''], ['Хумус с овощами', 'V'], ['Жюльен в тарталетке', 'G L'], ['Шашлычки из курицы', ''], ['Сырная тарелка с орехами', 'L N V'], ['Мини-чизкейки', 'G L V']] },
    { id: 'ban-c', name: 'Банкет «Классика»', price: 4200, per: 'закуски, салат, горячее · 1 100 г', items: [['Ассорти холодных закусок', 'L'], ['Салат с тёплой говядиной', 'N'], ['Судак с пюре из цветной капусты', 'L'], ['Куриное бедро на гриле (выбор)', ''], ['Овощи гриль', 'V'], ['Десерт «Павлова»', 'L V']] },
    { id: 'ban-p', name: 'Банкет «Премиум»', price: 6500, per: 'рыба, стейки, десерт-бар · 1 300 г', items: [['Тар-тар из говядины', ''], ['Салат с камчатским крабом', 'L'], ['Стейк из лосося', ''], ['Стейк рибай (выбор)', ''], ['Ризотто с белыми грибами', 'L V'], ['Десерт-бар 6 позиций', 'G L N V']] },
    { id: 'bbq', name: 'Барбекю', price: 2700, per: 'гриль-станция и повар', items: [['Стейки из свиной шеи', ''], ['Куриные крылья BBQ', ''], ['Колбаски гриль', 'G'], ['Кукуруза и овощи на гриле', 'V'], ['Лепёшки и соусы', 'G V'], ['Арбуз и фрукты', 'V']] }
  ];
  var packById = {};
  PACKS.forEach(function (p) { packById[p.id] = p; });

  var EXTRAS = [
    ['bartender', 'Бармен', '6 000 ₽ за смену', function (g) { return 6000 * Math.max(1, Math.ceil(g / 80)); }],
    ['dishes', 'Посуда и стекло', '250 ₽ на гостя', function (g) { return 250 * g; }],
    ['textile', 'Скатерти и салфетки', '150 ₽ на гостя', function (g) { return 150 * g; }],
    ['furniture', 'Мебель: столы и стулья', '600 ₽ на гостя', function (g) { return 600 * g; }],
    ['decor', 'Флористика и декор столов', 'от 25 000 ₽', function (g) { return 25000 + 150 * g; }],
    ['cake', 'Торт от кондитера', '2 500 ₽/кг', function (g) { return Math.max(3, Math.ceil(g * 0.12)) * 2500; }],
    ['tent', 'Шатёр', '45 000 ₽', function () { return 45000; }],
    ['coord', 'Координатор на площадке', '12 000 ₽', function () { return 12000; }]
  ];

  /* ================================================================ форматы */

  FB.$('#fgrid').innerHTML = FORMATS.map(function (f) {
    return '<button class="fmt" type="button" data-fmt="' + f.id + '" data-reveal><img src="img/' + f.img + '.webp" alt="" loading="lazy"><span class="fmt__price">от ' + FB.money(f.from) + ' / гость</span><h3>' + f.name + '</h3><p>' + f.text + '</p></button>';
  }).join('');
  FB.reveal(FB.$('#fgrid'));
  FB.$('#fgrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fmt]');
    if (!b) return;
    setFormat(b.getAttribute('data-fmt'));
    FB.scrollTo('#quote');
    FB.track('select_service', { format: b.getAttribute('data-fmt') });
  });

  /* ================================================================ конструктор рассадки */

  var TYPES = {
    round8: { name: 'Круглый на 8', seats: 8, w: 3, h: 3, shape: 'round' },
    round10: { name: 'Круглый на 10', seats: 10, w: 3.4, h: 3.4, shape: 'round' },
    rect6: { name: 'Прямоугольный на 6', seats: 6, w: 2.6, h: 2.2, shape: 'rect' },
    rect10: { name: 'Банкетный на 10', seats: 10, w: 3.8, h: 2.2, shape: 'rect' },
    stand: { name: 'Фуршетная стойка', seats: 0, standing: 6, w: 1.4, h: 1.4, shape: 'stand' },
    stage: { name: 'Сцена / ведущий', seats: 0, w: 4, h: 2, shape: 'stage' },
    bar: { name: 'Бар', seats: 0, w: 3, h: 1.2, shape: 'bar' }
  };
  var hall = FB.$('#hall'), hallW = FB.$('#hallW'), hallH = FB.$('#hallH'), planGuests = FB.$('#planGuests');
  var plan = FB.store.get('plan', { W: 20, H: 12, guests: 60, items: [] });
  var sel = null, uid = plan.items.reduce(function (m, i) { return Math.max(m, i.id); }, 0);
  hallW.value = plan.W; hallH.value = plan.H; planGuests.value = plan.guests;

  FB.$('#lib').innerHTML = Object.keys(TYPES).map(function (k) {
    var t = TYPES[k];
    return '<button class="lib__item" type="button" data-type="' + k + '"><span class="lib__ico" aria-hidden="true">' + icon(t) + '</span><span>' + t.name + '<small>' + (t.seats ? t.seats + ' мест' : t.standing ? 'до ' + t.standing + ' гостей стоя' : 'зона') + '</small></span></button>';
  }).join('');
  function icon(t) {
    if (t.shape === 'round' || t.shape === 'stand') return '<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="' + (t.shape === 'stand' ? 6 : 9) + '" fill="' + (t.shape === 'stand' ? '#d4f54c' : '#f4f4f0') + '" stroke="#1d1d1b" stroke-width="1.5"/></svg>';
    if (t.shape === 'rect') return '<svg width="30" height="30" viewBox="0 0 30 30"><rect x="4" y="9" width="22" height="12" rx="2" fill="#f4f4f0" stroke="#1d1d1b" stroke-width="1.5"/></svg>';
    return '<svg width="30" height="30" viewBox="0 0 30 30"><rect x="3" y="10" width="24" height="10" rx="2" fill="#1d1d1b"/></svg>';
  }

  function dims(it) { var t = TYPES[it.type]; return it.rot ? { w: t.h, h: t.w } : { w: t.w, h: t.h }; }
  function clamp(it) {
    var d = dims(it);
    it.x = Math.max(0, Math.min(plan.W - d.w, it.x));
    it.y = Math.max(0, Math.min(plan.H - d.h, it.y));
  }
  function overlaps(a, b) {
    var da = dims(a), db = dims(b);
    return a.x < b.x + db.w - 0.05 && b.x < a.x + da.w - 0.05 && a.y < b.y + db.h - 0.05 && b.y < a.y + da.h - 0.05;
  }
  function chairs(it) {
    var t = TYPES[it.type], out = [];
    if (t.shape === 'round') {
      for (var i = 0; i < t.seats; i++) {
        var a = (i / t.seats) * Math.PI * 2 - Math.PI / 2;
        out.push([50 + Math.cos(a) * 42, 50 + Math.sin(a) * 42]);
      }
    } else if (t.shape === 'rect') {
      var side = t.seats / 2;
      for (var j = 0; j < side; j++) {
        var p = 18 + (64 / (side - 1 || 1)) * j;
        out.push(it.rot ? [8, p] : [p, 8]);
        out.push(it.rot ? [92, p] : [p, 92]);
      }
    }
    return out;
  }

  function renderPlan() {
    hall.style.aspectRatio = plan.W + ' / ' + plan.H;
    hall.style.backgroundSize = (100 / plan.W) + '% ' + (100 / plan.H) + '%';
    if (!plan.items.length) { hall.innerHTML = '<div class="hall__empty">перетащите сюда столы<br>или нажмите «Расставить автоматически»</div>'; }
    else hall.innerHTML = plan.items.map(function (it) {
      var d = dims(it), t = TYPES[it.type];
      var bad = plan.items.some(function (o) { return o !== it && overlaps(it, o); });
      var label = it.name || (t.seats ? t.seats : t.shape === 'stage' ? 'сцена' : t.shape === 'bar' ? 'бар' : '');
      return '<div class="tbl tbl--' + t.shape + (sel === it.id ? ' is-sel' : '') + (bad ? ' is-bad' : '') + '" data-id="' + it.id + '" tabindex="0" role="button" aria-label="' + FB.esc(t.name + (it.name ? ', ' + it.name : '')) + (bad ? ', пересекается с другим' : '') + '" style="left:' + (it.x / plan.W * 100) + '%;top:' + (it.y / plan.H * 100) + '%;width:' + (d.w / plan.W * 100) + '%;height:' + (d.h / plan.H * 100) + '%">' +
        chairs(it).map(function (c) { return '<span class="chair" style="left:' + c[0] + '%;top:' + c[1] + '%"></span>'; }).join('') +
        '<span class="tbl__top">' + FB.esc(label) + '</span></div>';
    }).join('');
    var seats = plan.items.reduce(function (s, it) { var t = TYPES[it.type]; return s + (t.seats || t.standing || 0); }, 0);
    var g = +planGuests.value || 0, si = FB.$('#seatInfo');
    si.textContent = seats + ' ' + FB.plural(seats, ['место', 'места', 'мест']) + (g ? (seats >= g ? ' · всем хватает ✓' : ' · не хватает ' + (g - seats)) : '');
    si.classList.toggle('ok', g > 0 && seats >= g);
    renderInspector();
    FB.store.set('plan', plan);
  }

  function renderInspector() {
    var box = FB.$('#inspector'), it = plan.items.filter(function (i) { return i.id === sel; })[0];
    if (!it) { box.innerHTML = '<p class="lib__h">Выбранный стол</p><p class="hint">Кликните по столу в зале. Стрелки — сдвинуть, R — повернуть, Delete — удалить.</p>'; return; }
    var t = TYPES[it.type];
    box.innerHTML = '<p class="lib__h">Выбранный стол</p><b>' + t.name + '</b><div class="field"><label for="tblName">Имя стола</label><input id="tblName" value="' + FB.esc(it.name || '') + '" placeholder="Например: Родители" maxlength="18"></div>' +
      '<p class="hint">' + (t.seats ? t.seats + ' мест' : t.standing ? 'до ' + t.standing + ' гостей стоя' : 'зона без мест') + '</p>' +
      '<div class="inspector__btns"><button class="btn btn--line btn--sm" type="button" data-act="rot">Повернуть</button><button class="btn btn--line btn--sm" type="button" data-act="dup">Копия</button><button class="btn btn--line btn--sm" type="button" data-act="del">Удалить</button></div>';
  }
  FB.$('#inspector').addEventListener('input', function (e) {
    if (e.target.id !== 'tblName') return;
    var it = plan.items.filter(function (i) { return i.id === sel; })[0];
    if (!it) return;
    it.name = e.target.value.slice(0, 18);
    var top = hall.querySelector('[data-id="' + it.id + '"] .tbl__top');
    if (top) top.textContent = it.name || TYPES[it.type].seats || '';
    FB.store.set('plan', plan);
  });
  FB.$('#inspector').addEventListener('click', function (e) {
    var a = e.target.getAttribute('data-act');
    if (a) act(a);
  });

  function act(a) {
    var it = plan.items.filter(function (i) { return i.id === sel; })[0];
    if (!it) return;
    if (a === 'rot') { it.rot = !it.rot; clamp(it); }
    if (a === 'del') { plan.items = plan.items.filter(function (i) { return i !== it; }); sel = null; }
    if (a === 'dup') { var c = { id: ++uid, type: it.type, x: it.x + 0.6, y: it.y + 0.6, rot: it.rot, name: '' }; clamp(c); plan.items.push(c); sel = c.id; }
    renderPlan();
    if (sel) { var el = hall.querySelector('[data-id="' + sel + '"]'); if (el) el.focus(); }
  }

  function addItem(type, x, y) {
    var it = { id: ++uid, type: type, x: x, y: y, rot: false, name: '' };
    if (x == null) { // ищем свободное место
      var d = dims(it); it.x = 0.5; it.y = 0.5;
      outer: for (var yy = 0.5; yy <= plan.H - d.h; yy += 0.5) for (var xx = 0.5; xx <= plan.W - d.w; xx += 0.5) {
        it.x = xx; it.y = yy;
        if (!plan.items.some(function (o) { return overlaps(it, o); })) break outer;
      }
    }
    clamp(it);
    plan.items.push(it);
    sel = it.id;
    renderPlan();
    FB.track('plan_add', { type: type });
  }

  // перетаскивание из библиотеки
  var ghost = null, ghostType = null;
  FB.$('#lib').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b || e.button > 0) return;
    ghostType = b.getAttribute('data-type');
    var start = { x: e.clientX, y: e.clientY }, moved = false;
    function move(ev) {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      if (!moved) {
        moved = true;
        ghost = b.querySelector('.lib__ico').cloneNode(true);
        ghost.style.cssText = 'position:fixed;z-index:500;pointer-events:none;transform:translate(-50%,-50%) scale(1.4);';
        document.body.appendChild(ghost);
      }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
      var r = hall.getBoundingClientRect();
      hall.classList.toggle('is-over', ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom);
    }
    function up(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      hall.classList.remove('is-over');
      if (ghost) { ghost.remove(); ghost = null; }
      if (!moved) { addItem(ghostType); return; }  // простой клик — ставим на свободное место
      var r = hall.getBoundingClientRect();
      if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
        var t = TYPES[ghostType];
        addItem(ghostType, (ev.clientX - r.left) / r.width * plan.W - t.w / 2, (ev.clientY - r.top) / r.height * plan.H - t.h / 2);
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  FB.$('#lib').addEventListener('keydown', function (e) {
    var b = e.target.closest('[data-type]');
    if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addItem(b.getAttribute('data-type')); }
  });

  // перетаскивание столов в зале
  hall.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.tbl');
    if (!el) { if (sel) { sel = null; renderPlan(); } return; }
    var it = plan.items.filter(function (i) { return i.id === +el.getAttribute('data-id'); })[0];
    sel = it.id;
    FB.$$('.tbl', hall).forEach(function (t) { t.classList.toggle('is-sel', t === el); });
    renderInspector();
    var r = hall.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = it.x, oy = it.y, moved = false;
    el.setPointerCapture(e.pointerId);
    function move(ev) {
      var dx = (ev.clientX - sx) / r.width * plan.W, dy = (ev.clientY - sy) / r.height * plan.H;
      if (Math.abs(dx) + Math.abs(dy) > 0.05) moved = true;
      it.x = Math.round((ox + dx) * 10) / 10; it.y = Math.round((oy + dy) * 10) / 10;
      clamp(it);
      el.style.left = (it.x / plan.W * 100) + '%'; el.style.top = (it.y / plan.H * 100) + '%';
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      if (moved) renderPlan(); else el.focus();
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  hall.addEventListener('dblclick', function (e) {
    var el = e.target.closest('.tbl');
    if (el) { sel = +el.getAttribute('data-id'); act('rot'); }
  });
  hall.addEventListener('keydown', function (e) {
    var el = e.target.closest('.tbl');
    if (!el) return;
    sel = +el.getAttribute('data-id');
    var it = plan.items.filter(function (i) { return i.id === sel; })[0], step = e.shiftKey ? 2 : 0.5;
    var map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) { e.preventDefault(); it.x += map[e.key][0]; it.y += map[e.key][1]; clamp(it); renderPlan(); hall.querySelector('[data-id="' + sel + '"]').focus(); }
    else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { e.preventDefault(); act('rot'); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del'); }
    else if (e.key === 'Enter') { renderPlan(); hall.querySelector('[data-id="' + sel + '"]').focus(); }
  });

  [hallW, hallH].forEach(function (inp) {
    inp.addEventListener('change', function () {
      plan.W = Math.max(8, Math.min(60, +hallW.value || 20));
      plan.H = Math.max(6, Math.min(40, +hallH.value || 12));
      hallW.value = plan.W; hallH.value = plan.H;
      plan.items.forEach(clamp);
      renderPlan();
    });
  });
  planGuests.addEventListener('input', function () { plan.guests = +planGuests.value || 0; renderPlan(); });
  FB.$('#planClear').addEventListener('click', function () { if (!plan.items.length || confirm('Убрать все столы из зала?')) { plan.items = []; sel = null; renderPlan(); } });
  FB.$('#planAuto').addEventListener('click', function () {
    var g = +planGuests.value || 60, type = g > 120 ? 'round10' : 'round8', t = TYPES[type], gap = 0.6;
    plan.items = [{ id: ++uid, type: 'stage', x: plan.W / 2 - 2, y: 0.4, rot: false, name: '' }];
    var need = Math.ceil(g / t.seats), placed = 0;
    for (var y = 3.2; y + t.h <= plan.H && placed < need; y += t.h + gap) {
      for (var x = 0.5; x + t.w <= plan.W && placed < need; x += t.w + gap) {
        plan.items.push({ id: ++uid, type: type, x: x, y: y, rot: false, name: '' });
        placed++;
      }
    }
    if (placed < need) FB.toast('В зал ' + plan.W + '×' + plan.H + ' м помещается ' + placed + ' столов — увеличьте зал или используйте фуршет', 'error', 6000);
    sel = null;
    renderPlan();
    FB.track('plan_auto', { guests: g });
  });
  FB.$('#planToQuote').addEventListener('click', function () {
    if (!plan.items.length) { FB.toast('Сначала добавьте столы', 'error'); return; }
    qState.plan = planSummary();
    FB.$('#qGuests').value = Math.max(20, Math.min(800, +planGuests.value || 60));
    renderQuote();
    FB.scrollTo('#quote');
    FB.toast('Рассадка прикреплена к смете', 'ok');
  });
  function planSummary() {
    var counts = {}, seats = 0;
    plan.items.forEach(function (it) { var t = TYPES[it.type]; counts[t.name] = (counts[t.name] || 0) + 1; seats += t.seats || t.standing || 0; });
    return { text: Object.keys(counts).map(function (k) { return k + ' ×' + counts[k]; }).join(', ') + '; мест: ' + seats + '; зал ' + plan.W + '×' + plan.H + ' м', names: plan.items.filter(function (i) { return i.name; }).map(function (i) { return i.name; }).join(', '), items: plan.items };
  }

  /* ================================================================ меню */

  var diets = [];
  function renderPacks() {
    FB.$('#packs').innerHTML = PACKS.map(function (p) {
      return '<article class="pack' + (p.hit ? ' pack--hit' : '') + '">' + (p.hit ? '<span class="pack__tag">Чаще выбирают</span>' : '') +
        '<h3>' + p.name + '</h3><p class="pack__price">' + FB.money(p.price) + '</p><p class="pack__per">' + p.per + '</p><ul role="list">' + p.items.map(function (it) {
          var tags = it[1].split(' ').filter(Boolean), dim = diets.some(function (d) { return d === 'V' ? tags.indexOf('V') < 0 : tags.indexOf(d) >= 0; });
          return '<li class="' + (dim ? 'dim' : '') + '"><span>' + it[0] + '</span><small>' + (tags.join(' ') || '—') + '</small></li>';
        }).join('') + '</ul><button class="btn ' + (p.hit ? 'btn--lime' : 'btn--line') + '" type="button" data-pack="' + p.id + '">Выбрать для сметы</button></article>';
    }).join('');
  }
  FB.$('#diet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-diet]');
    if (!b) return;
    var d = b.getAttribute('data-diet'), i = diets.indexOf(d);
    if (i >= 0) diets.splice(i, 1); else diets.push(d);
    b.setAttribute('aria-pressed', String(i < 0));
    renderPacks();
  });
  FB.$('#packs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pack]');
    if (!b) return;
    var r = FB.$('input[name=pack][value="' + b.getAttribute('data-pack') + '"]');
    if (r) r.checked = true;
    renderQuote();
    FB.scrollTo('#quote');
  });

  /* ================================================================ смета */

  var qf = FB.$('#qForm'), qsteps = FB.$$('.qstep', qf), qnav = FB.$$('#qSteps li'), qi = 0, qState = { plan: null };
  FB.$('#qFormat').innerHTML = FORMATS.map(function (f, i) { return '<label><input type="radio" name="format" value="' + f.id + '"' + (i === 0 ? ' checked' : '') + '><span>' + f.name + '</span></label>'; }).join('');
  FB.$('#qPack').innerHTML = PACKS.map(function (p) { return '<label><input type="radio" name="pack" value="' + p.id + '"' + (p.id === 'ban-c' ? ' checked' : '') + '><span>' + p.name + '<small>' + FB.money(p.price) + ' · ' + p.per + '</small></span></label>'; }).join('');
  FB.$('#qExtras').innerHTML = EXTRAS.map(function (x) { return '<label><input type="checkbox" name="extra" value="' + x[0] + '"' + (x[0] === 'dishes' || x[0] === 'textile' ? ' checked' : '') + '><span>' + x[1] + '<small>' + x[2] + '</small></span></label>'; }).join('');
  var qDate = FB.$('#qDate');
  qDate.min = FB.iso(FB.addDays(FB.today(), 1));
  qDate.max = FB.iso(FB.addDays(FB.today(), 365));

  function setFormat(id) {
    var r = FB.$('input[name=format][value="' + id + '"]', qf);
    if (r) r.checked = true;
    var p = FB.$('input[name=pack][value="' + fmtById[id].pack + '"]', qf);
    if (p) p.checked = true;
    renderQuote();
  }

  function dateStatus(iso) {
    if (!iso) return null;
    var days = Math.round((FB.parseIso(iso) - FB.today()) / 864e5);
    var rnd = FB.seeded('sn-date|' + iso)();
    var wknd = [0, 5, 6].indexOf(FB.parseIso(iso).getDay()) >= 0;
    if (rnd < (wknd ? 0.25 : 0.08)) return { busy: true, text: 'Дата занята — все бригады на других событиях. Выберите соседний день или спросите менеджера.' };
    if (rnd < (wknd ? 0.5 : 0.25)) return { text: 'Свободна, осталась одна бригада — лучше забронировать сейчас.' };
    return { text: days < 3 ? 'Свободна. Срочный заказ: подготовка меньше 3 дней, +15% к меню.' : 'Дата свободна.', urgent: days < 3 };
  }

  function calc() {
    var fd = new FormData(qf), g = +fd.get('guests') || 60, f = fmtById[fd.get('format')] || FORMATS[0], p = packById[fd.get('pack')] || PACKS[0];
    var hours = Math.max(2, Math.min(12, +fd.get('hours') || 4)), ds = dateStatus(fd.get('date'));
    var lines = [], food = p.price * g * (ds && ds.urgent ? 1.15 : 1);
    lines.push([p.name + ' × ' + g, food]);
    var waiters = Math.max(1, Math.ceil(g / f.ratio)), staff = waiters * 800 * Math.max(4, hours);
    lines.push(['Официанты · ' + waiters + ' чел. × ' + Math.max(4, hours) + ' ч', staff]);
    fd.getAll('extra').forEach(function (id) { var x = EXTRAS.filter(function (e) { return e[0] === id; })[0]; if (x) lines.push([x[1], x[3](g)]); });
    var kids = +fd.get('kids') || 0;
    if (kids) lines.push(['Детское меню × ' + kids, -Math.round(p.price * 0.4 * kids)]);
    var deliv = +fd.get('city') || 0;
    lines.push(['Доставка и выезд кухни', 3000 + deliv]);
    var sub = lines.reduce(function (a, l) { return a + l[1]; }, 0), fee = Math.round(sub * 0.1);
    lines.push(['Сервисный сбор 10%', fee]);
    var total = sub + fee;
    return { lines: lines, total: total, lo: Math.round(total * 0.92 / 1000) * 1000, hi: Math.round(total * 1.08 / 1000) * 1000, perGuest: total / g, waiters: waiters, guests: g, pack: p, format: f, ds: ds };
  }

  function renderQuote() {
    FB.$('#qGuestsOut').textContent = FB.$('#qGuests').value;
    var c = calc();
    var di = FB.$('#dateInfo');
    di.textContent = c.ds ? c.ds.text : '';
    di.style.color = c.ds && c.ds.busy ? 'var(--error)' : '';
    FB.$('#staffInfo').textContent = 'Официантов по формату «' + c.format.name.toLowerCase() + '»: ' + c.waiters + ' (1 на ' + c.format.ratio + ' гостей).';
    FB.$('#planAttached').textContent = qState.plan ? 'Рассадка из конструктора прикреплена: ' + qState.plan.text : 'Совет: соберите рассадку в конструкторе выше — приложим её к КП.';
    FB.$('#qSum').innerHTML = '<h3>Предварительная смета</h3><ul role="list">' + c.lines.map(function (l) { return '<li><span>' + l[0] + '</span><span>' + (l[1] < 0 ? '−' : '') + FB.money(Math.abs(l[1])) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="qsum__total"><strong>' + FB.num(c.lo) + '–' + FB.money(c.hi) + '</strong><small>≈ ' + FB.money(c.perGuest) + ' на гостя · точная сумма — в КП после уточнения меню</small></div>';
  }
  qf.addEventListener('input', renderQuote);
  qf.addEventListener('change', function (e) {
    if (e.target.name === 'format') { var p = FB.$('input[name=pack][value="' + fmtById[e.target.value].pack + '"]', qf); if (p) p.checked = true; }
    renderQuote();
  });

  function goQ(n) {
    qi = n;
    qsteps.forEach(function (s, i) { s.hidden = i !== n; });
    qnav.forEach(function (li, i) { li.classList.toggle('on', i <= n); });
    FB.$('#qBack').hidden = n === 0;
    FB.$('#qNext').hidden = n === qsteps.length - 1;
    FB.$('#qSubmit').hidden = n !== qsteps.length - 1;
    FB.$('[data-form-error]', qf).textContent = '';
  }
  FB.$('#qNext').addEventListener('click', function () {
    if (!FB.validate(qsteps[qi])) return;
    if (qi === 0) {
      var ds = dateStatus(qDate.value);
      if (qDate.value < qDate.min) { FB.setError(qDate, 'Дата должна быть в будущем'); return; }
      if (ds && ds.busy) { FB.$('[data-form-error]', qf).textContent = 'На эту дату свободных бригад нет. Выберите другую дату или оставьте заявку — поставим в лист ожидания.'; FB.track('date_busy'); }
    }
    goQ(qi + 1);
    FB.track('quiz_step', { step: qi });
  });
  FB.$('#qBack').addEventListener('click', function () { goQ(qi - 1); });
  qf.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && qi < qsteps.length - 1) { e.preventDefault(); FB.$('#qNext').click(); } });
  FB.files(FB.$('#qFiles'), { max: 5, maxSize: 15 * 1024 * 1024, list: FB.$('#qFileList') });

  var lastQuote = null;
  FB.form(qf, {
    type: 'catering_brief',
    before: function () { return qi === qsteps.length - 1 ? true : 'Пройдите все шаги'; },
    collect: function (fd) {
      var c = calc();
      lastQuote = { c: c, fd: {} };
      fd.forEach(function (v, k) { if (!(v instanceof File)) lastQuote.fd[k] = v; });
      lastQuote.extras = fd.getAll('extra');
      return {
        service: c.format.name + ', ' + c.pack.name, guests: String(c.guests), date: fd.get('date'), format: c.format.name,
        total: FB.num(c.lo) + '–' + FB.money(c.hi),
        details: {
          'Длительность': fd.get('hours') + ' ч', 'Площадка': fd.get('venue') || 'нужна помощь с площадкой', 'Город': FB.$('#qCity').selectedOptions[0].textContent,
          'Вегетарианцев / дети / халяль': [fd.get('veg'), fd.get('kids'), fd.get('halal')].join(' / '), 'Аллергии': fd.get('allergy') || '—',
          'Допуслуги': fd.getAll('extra').map(function (id) { return EXTRAS.filter(function (x) { return x[0] === id; })[0][1]; }).join(', ') || '—',
          'Рассадка': qState.plan ? qState.plan.text + (qState.plan.names ? ' (' + qState.plan.names + ')' : '') : 'не составлена',
          'Компания': fd.get('company') || '—', 'КП нужно': fd.get('deadline'), 'Статус даты': c.ds ? c.ds.text : '—'
        }
      };
    },
    success: function (res, p) {
      var c = lastQuote.c;
      lastQuote.id = res.id; lastQuote.name = p.name;
      FB.track('submit_lead', { id: res.id, total: c.total });
      qf.closest('.qwrap').hidden = true;
      var d = FB.$('#qDone');
      d.hidden = false;
      d.innerHTML = '<p class="hint">Бриф принят</p><div class="num">' + FB.esc(res.id) + '</div>' +
        '<p>Предварительно: <b>' + FB.num(c.lo) + '–' + FB.money(c.hi) + '</b> за ' + c.guests + ' гостей, ' + FB.fmtDate(p.date, { day: 'numeric', month: 'long' }) + '. Менеджер пришлёт КП с тремя вариантами меню ' + (p.deadline === 'Сегодня' ? 'сегодня' : p.deadline === 'Завтра' ? 'завтра до 12:00' : 'в течение недели') + '.</p>' +
        '<div class="qdone__btns"><button class="btn btn--black" type="button" id="kpPrint">Скачать предварительное КП (PDF)</button><a class="btn btn--line" target="_blank" rel="noopener" href="' + FB.tgLink('Бриф ' + res.id) + '">Написать менеджеру</a><button class="btn btn--line" type="button" id="qAgain">Новый расчёт</button></div>' +
        '<p class="note-hand note-hand--dark">спасибо, что выбрали нас!</p>';
      FB.scrollTo(d, { focus: false });
    }
  });
  FB.$('#qDone').addEventListener('click', function (e) {
    if (e.target.id === 'qAgain') { FB.$('#qDone').hidden = true; qf.closest('.qwrap').hidden = false; goQ(0); renderQuote(); }
    if (e.target.id === 'kpPrint') printKP();
  });

  function printKP() {
    var q = lastQuote, c = q.c;
    FB.$('#kp').innerHTML = '<h1>Предварительное КП № ' + FB.esc(q.id) + '</h1>' +
      '<p>«Стол накрыт», Самара · ' + FB.esc(FB.config.phone) + ' · ' + new Date().toLocaleDateString('ru-RU') + '</p>' +
      '<p><b>' + FB.esc(c.format.name) + '</b>, ' + c.guests + ' гостей, ' + FB.fmtDate(q.fd.date, { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + FB.esc(q.fd.hours) + ' ч. Площадка: ' + FB.esc(q.fd.venue || 'уточняется') + '.</p>' +
      '<table><thead><tr><th>Позиция</th><th>Сумма</th></tr></thead><tbody>' + c.lines.map(function (l) { return '<tr><td>' + FB.esc(l[0]) + '</td><td>' + (l[1] < 0 ? '−' : '') + FB.money(Math.abs(l[1])) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="kp__total">Итого: ' + FB.num(c.lo) + '–' + FB.money(c.hi) + ' (≈ ' + FB.money(c.perGuest) + ' на гостя)</p>' +
      '<h2>Меню «' + FB.esc(c.pack.name) + '»</h2><ul>' + c.pack.items.map(function (i) { return '<li>' + FB.esc(i[0]) + (i[1] ? ' (' + i[1] + ')' : '') + '</li>'; }).join('') + '</ul>' +
      (qState.plan ? '<p>Рассадка: ' + FB.esc(qState.plan.text) + '</p>' : '') +
      '<p>Сумма предварительная и уточняется после согласования меню и числа гостей. Предоплата 50% по договору.</p>';
    FB.track('kp_download', { id: q.id });
    window.print();
  }

  /* ================================================================ старт */

  renderPlan();
  renderPacks();
  renderQuote();
  goQ(0);
})();
