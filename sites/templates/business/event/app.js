/* Event-агентство: форматы → проекты с фильтром → прайс «в смету» → тайминг дня → бейджи команды →
   калькулятор-фраза со сметой-документом → контакт.
   Все данные — из config.js (window.SITE_CONFIG). Даты агентства не резервируются: бриф — это заявка на обсуждение.
   Анимации — CSS и Web Animations API; anime.js и Lenis на этой странице не подключаются. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var formats = T.list('formats'), services = T.list('services'), projects = T.list('portfolio');
  var pricing = C.pricing || {};
  var fmtById = function (id) { return T.byId(formats, id); };
  var canAnimate = !FB.reduced && typeof Element.prototype.animate === 'function';
  var EASE = 'cubic-bezier(.2,.8,.2,1)';
  var root = document.documentElement;

  /** 'ЧЧ:ММ' → минуты от начала суток; время до 06:00 считаем следующими сутками (ночь после события). */
  function mins(t) {
    var p = String(t || '').split(':'), m = (+p[0] || 0) * 60 + (+p[1] || 0);
    return m < 360 ? m + 1440 : m;
  }
  function clock(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  /** Цена по частям для крупной типографики: «от» · число · ₽. */
  function priceTag(p) {
    var unit = p && p.unit ? ' ' + esc(p.unit) : '', num = '', pre = '';
    if (p && p.type === 'from' && p.value > 0) { pre = 'от'; num = FB.num(p.value); }
    else if (p && p.type === 'fixed' && p.value > 0) num = FB.num(p.value);
    else if (p && p.type === 'range' && p.min > 0 && p.max >= p.min) num = FB.num(p.min) + '–' + FB.num(p.max);
    if (!num) return '<p class="ptag ptag--text">' + esc(T.priceText(p)) + '</p>';
    return '<p class="ptag">' + (pre ? '<span class="ptag__pre">' + pre + '</span>' : '') + '<span class="ptag__num">' + num + '</span><span class="ptag__cur">₽' + unit + '</span></p>';
  }

  /* ---------------------------------------------------------------- первый экран */

  $('#heroTitle').textContent = (C.hero && C.hero.title) || (C.brand && C.brand.name) || '';
  var cta = (C.hero && C.hero.cta) || {};
  $('#heroCta').textContent = cta.label || 'Обсудить мероприятие';
  $('#heroCta').href = '#' + (cta.target || 'brief');
  $('#heroMedia').innerHTML = T.img(C.hero && C.hero.image, { eager: true });

  // табло «19:00»: при загрузке перещёлкивается с 18:57 — минута в минуту, как в названии
  var timingItems = (C.timing && C.timing.items) || [];
  var accentItem = timingItems.filter(function (t) { return t.accent; })[0];
  var clockTime = (C.hero && C.hero.clock) || (accentItem && accentItem.time) || '19:00';
  var board = $('#heroClock');
  board.setAttribute('aria-label', 'Начало в ' + clockTime);
  function boardHtml(t) {
    return t.split('').map(function (ch) {
      return ch === ':' ? '<span class="board__sep" aria-hidden="true">:</span>' : '<span class="board__cell" aria-hidden="true"><span class="board__d">' + ch + '</span></span>';
    }).join('');
  }
  board.innerHTML = boardHtml(clockTime);
  if (canAnimate && /^\d\d:\d\d$/.test(clockTime)) {
    var target = mins(clockTime), cells = $$('.board__d', board);
    var show = function (t) { t.replace(':', '').split('').forEach(function (ch, i) { cells[i].textContent = ch; }); };
    show(clock(target - 3));
    // каждая смена цифры — половина пластины уходит вверх, новая цифра выходит снизу
    var flip = function (el, ch, delay) {
      if (el.textContent === ch) return;
      el.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(-90deg)' }], { duration: 120, delay: delay, easing: 'ease-in', fill: 'forwards' }).onfinish = function () {
        el.textContent = ch;
        el.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], { duration: 160, easing: 'ease-out' });
        el.getAnimations().forEach(function (x) { if (x.playState === 'finished') x.cancel(); });
      };
    };
    [2, 1, 0].forEach(function (left, k) {
      setTimeout(function () {
        clock(target - left).replace(':', '').split('').forEach(function (ch, i) { flip(cells[i], ch, i * 40); });
      }, 700 + k * 520);
    });
    // вкладка в фоне не анимирует — финальное время ставим в любом случае
    setTimeout(function () { show(clockTime); }, 700 + 3 * 520 + 400);
  }

  // полоса тайминга вечера: пункты вокруг времени на табло, этот пункт подсвечен
  var at = timingItems.map(function (t) { return t.time; }).indexOf(clockTime);
  if (at < 0) at = accentItem ? timingItems.indexOf(accentItem) : 0;
  var run = timingItems.slice(Math.max(0, at - 2), at + 4);
  $('#heroRunTitle').textContent = (C.timing && C.timing.title) ? 'Тайминг: ' + C.timing.title.charAt(0).toLowerCase() + C.timing.title.slice(1) : 'Тайминг вечера';
  $('#heroRun').innerHTML = run.map(function (t) {
    var now = t.time === clockTime;
    return '<li class="run__item' + (now ? ' is-now' : '') + '"' + (now ? ' aria-current="time"' : '') + '><time>' + esc(t.time) + '</time><span>' + esc(t.title) + '</span></li>';
  }).join('');
  $('.hero__run').hidden = !run.length;

  // прокрутка: фото сжимается в карточку со скруглением и темнеет, текст уходит вверх
  if (!FB.reduced) {
    var hero = $('#top'), media = $('#heroMedia'), inner = $('.hero__in'), ticking = false;
    var onHeroScroll = function () {
      ticking = false;
      var h = hero.offsetHeight || 1, p = Math.min(1, Math.max(0, window.scrollY / h));
      var side = Math.min(window.innerWidth * 0.06, 72) * p;
      media.style.clipPath = 'inset(' + (p * 40).toFixed(1) + 'px ' + side.toFixed(1) + 'px ' + (p * 120).toFixed(1) + 'px round ' + (p * 28).toFixed(1) + 'px)';
      media.style.setProperty('--dim', (0.06 + p * 0.5).toFixed(3));
      inner.style.transform = 'translateY(' + (-p * 60).toFixed(1) + 'px)';
      inner.style.opacity = String(Math.max(0, 1 - p * 1.4));
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onHeroScroll); } }, { passive: true });
    onHeroScroll();
  }

  /* ---------------------------------------------------------------- форматы */

  T.section('formats', formats.length);
  $('#formatsGrid').innerHTML = formats.map(function (f, i) {
    var n = projects.filter(function (p) { return p.format === f.id; }).length;
    return '<article class="fcard fcard--' + (i === 0 ? 'big' : 'std') + '" data-reveal>' +
      '<div class="fcard__media">' + T.img(f.image, { alt: '' }) + '</div>' +
      '<div class="fcard__body"><h3>' + esc(f.name) + '</h3><p>' + esc(f.short || '') + '</p>' +
      '<div class="fcard__actions">' +
      (n ? '<button class="btn btn--line btn--sm" type="button" data-show-format="' + esc(f.id) + '">Проекты · ' + n + '</button>' : '') +
      '<a class="btn btn--accent btn--sm" href="#brief" data-pick-format="' + esc(f.id) + '">Обсудить ' + esc(f.name.toLowerCase()) + '</a></div></div></article>';
  }).join('');
  T.rail($('#formatsGrid'), 'Форматы событий');

  /* ---------------------------------------------------------------- проекты */

  var curFilter = 'all';
  var hasDemo = projects.some(function (p) { return p.demo; });
  T.section('projects', T.feature('portfolio') && projects.length);
  $('#projectsDemo').hidden = !(T.demo && hasDemo);
  var usedFormats = formats.filter(function (f) { return projects.some(function (p) { return p.format === f.id; }); });
  $('#projectFilter').innerHTML = [{ id: 'all', name: 'Все' }].concat(usedFormats).map(function (f) {
    return '<button class="chip" type="button" data-filter="' + esc(f.id) + '" aria-pressed="' + (f.id === 'all') + '">' + esc(f.name) + '</button>';
  }).join('');

  // Размеры плиток по числу проектов: блоки «большая + две малые» (3), «две средние» (2), «на всю ширину» (1).
  // Любое число проектов собирается из этих блоков без пустых ячеек в сетке из 6 колонок.
  function tileSizes(n) {
    var out = [];
    while (n > 0) {
      if (n === 1) { out.push('xl'); n -= 1; }
      else if (n === 2 || n === 4) { out.push('m', 'm'); n -= 2; }
      else { out.push('l', 's', 's'); n -= 3; }
    }
    return out;
  }
  function guestsText(n) { return n ? n + ' ' + FB.plural(n, ['гость', 'гостя', 'гостей']) : ''; }

  function renderProjects(animate) {
    var grid = $('#projectsGrid'), before = {};
    if (animate && canAnimate) $$('.pcard', grid).forEach(function (el) { before[el.getAttribute('data-project')] = el.getBoundingClientRect(); });
    var list = projects.filter(function (p) { return curFilter === 'all' || p.format === curFilter; });
    var sizes = tileSizes(list.length);
    grid.innerHTML = list.map(function (p, i) {
      var f = fmtById(p.format);
      var meta = [f ? f.name : '', guestsText(p.guests)].filter(Boolean).map(esc).join(' · ');
      return '<button class="pcard pcard--' + sizes[i] + '" type="button" data-project="' + esc(p.id) + '">' +
        '<span class="pcard__media">' + T.img(p.cover, { alt: '' }) + '</span>' +
        '<span class="pcard__meta"><span class="pcard__fmt">' + meta + '</span>' + T.demoTag(p.demo, 'демо-проект') + '</span>' +
        '<span class="pcard__title">' + esc(p.title) + '</span></button>';
    }).join('') || '<p class="empty">В этом формате пока нет проектов.</p>';
    if (!animate || !canAnimate) return;
    // FLIP: карточка, которая осталась после фильтра, переезжает со старого места на новое; новые проявляются
    $$('.pcard', grid).forEach(function (el, i) {
      var was = before[el.getAttribute('data-project')], now = el.getBoundingClientRect();
      if (was) el.animate([{ transform: 'translate(' + (was.left - now.left) + 'px,' + (was.top - now.top) + 'px)' }, { transform: 'none' }], { duration: 480, easing: EASE });
      else el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 40, easing: EASE, fill: 'backwards' });
    });
  }
  function setFilter(id) {
    curFilter = id;
    $$('#projectFilter [data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === id)); });
    renderProjects(true);
  }
  $('#projectFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) setFilter(b.getAttribute('data-filter'));
  });
  renderProjects(false);

  // карточка проекта в модальном окне (FB.modal: Esc, фокус, блокировка фона)
  function openProject(id, opener) {
    var p = T.byId(projects, id);
    if (!p) return;
    var f = fmtById(p.format);
    var gallery = (p.gallery || []).filter(function (g) { return g !== p.cover; });
    var facts = [['Гостей', p.guests], ['Площадка', p.venue], ['Подготовка', p.prep]].filter(function (x) { return x[1]; });
    $('#pmBody').innerHTML =
      '<div class="pm__cover">' + T.img(p.cover) + '</div>' +
      '<div class="pm__text"><p class="eyebrow">' + esc(f ? f.name : '') + T.demoTag(p.demo, 'демо-проект') + '</p>' +
      '<h2 id="pmTitle">' + esc(p.title) + '</h2>' +
      (facts.length ? '<dl class="pm__facts">' + facts.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '<h3>Задача</h3><p>' + esc(p.task || '') + '</p>' +
      (p.works && p.works.length ? '<h3>Что сделали</h3><ul class="pm__works">' + p.works.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      (p.demo && T.demo ? '<p class="pm__note">Это пример карточки. Фото — стоковые, не работа агентства.</p>' : '') +
      '<a class="btn btn--accent" href="#brief" data-pick-format="' + esc(p.format) + '">Обсудить похожее событие</a></div>' +
      (gallery.length ? '<div class="pm__gallery">' + gallery.map(function (g) { return T.img(g); }).join('') + '</div>' : '');
    FB.modal.open('projectModal', opener);
  }
  $('#projectsGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-project]');
    if (b) openProject(b.getAttribute('data-project'), b);
  });

  /* ---------------------------------------------------------------- прайс: строки меню с кнопкой «в смету» */

  $('#servicesList').innerHTML = services.map(function (s) {
    return '<li class="srow" data-reveal data-svc="' + esc(s.id) + '">' +
      '<div class="srow__main"><h3>' + esc(s.name) + (s.optional ? ' <span class="srow__opt">по запросу</span>' : '') + '</h3><p>' + esc(s.text || '') + '</p>' +
      (s.text || s.deliverable ? '<button class="srow__more" type="button" aria-expanded="false">Подробнее</button>' : '') + '</div>' +
      (s.deliverable ? '<p class="doc"><span class="doc__icon" aria-hidden="true"></span><span class="doc__txt"><span class="doc__label">На руках</span>' + esc(s.deliverable) + '</span></p>' : '<span></span>') +
      priceTag(s.price) +
      '<button class="add" type="button" data-add="' + esc(s.id) + '" aria-pressed="false" aria-label="В смету: ' + esc(s.name) + '"><span class="add__icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path class="i-plus" d="M8 3v10M3 8h10"/><path class="i-check" d="M3.5 8.5l3 3 6-7"/></svg></span><span class="add__txt">В смету</span></button></li>';
  }).join('');
  T.section('services', services.length);
  // на телефоне описание и «На руках» раскрываются по нажатию (стили — max-width: 760px)
  $('#servicesList').addEventListener('click', function (e) {
    var b = e.target.closest('.srow__more');
    if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Свернуть' : 'Подробнее';
    b.closest('.srow').classList.toggle('is-open', open);
  });
  // одна пометка на весь блок вместо метки у каждой цены
  var demoPrices = T.demo && services.some(function (s) { return s.demo; });
  $('#servicesDemo').hidden = !demoPrices;
  if (demoPrices) $('#servicesDemo').innerHTML = '<span class="demo-tag">демо-цены</span> Цены в этом блоке приведены для примера.';

  /* ---------------------------------------------------------------- тайминг и подготовка */

  var timing = C.timing || {};
  var tItems = Array.isArray(timing.items) ? timing.items : [];
  var stages = T.list('stages');
  T.section('timing', T.feature('timing') && (tItems.length || stages.length));

  var tl = $('#timingList');
  tl.hidden = !tItems.length;
  $('#timingCaption').innerHTML = timing.title ? esc(timing.title) + T.demoTag(timing.demo, 'пример тайминга') : '';
  tl.innerHTML = tItems.map(function (it) {
    return '<li class="tl__row' + (it.accent ? ' tl__row--accent' : '') + '">' +
      '<time class="tl__time" datetime="' + esc(it.time) + '">' + esc(it.time) + '</time>' +
      '<span class="tl__dot" aria-hidden="true"></span>' +
      '<div class="tl__body"><h3>' + esc(it.title) + '</h3>' + (it.text ? '<p>' + esc(it.text) + '</p>' : '') + '</div></li>';
  }).join('');
  var keyAt = Math.max(0, tItems.map(function (it) { return !!it.accent; }).indexOf(true));
  var extra = 0;
  $$('.tl__row', tl).forEach(function (r, i) { if (Math.abs(i - keyAt) > 2) { r.classList.add('is-extra'); extra++; } });
  if (extra) {
    tl.classList.add('is-short');
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn--line tl__more';
    more.textContent = 'Показать весь день · ещё ' + extra;
    more.addEventListener('click', function () { tl.classList.remove('is-short'); more.remove(); window.dispatchEvent(new Event('scroll')); });
    tl.parentNode.insertBefore(more, tl.nextSibling);
  }

  $('#prep').hidden = !stages.length;
  $('#stagesList').innerHTML = stages.map(function (s, i) {
    return '<li class="prep__step" data-reveal><span class="prep__n">' + (i + 1) + '</span><h4>' + esc(s.title) + '</h4><p>' + esc(s.text) + '</p></li>';
  }).join('');
  T.rail($('#stagesList'), 'Этапы подготовки');

  // Прогресс тайминга: линия заполняется до середины экрана, пройденные пункты подсвечиваются.
  // Это состояние, а не украшение, поэтому работает и при prefers-reduced-motion (без переходов — их гасит core.css).
  if (tItems.length) {
    var rows = $$('.tl__row', tl), ticking = false;
    var update = function () {
      ticking = false;
      var box = tl.getBoundingClientRect(), mid = window.innerHeight * 0.55;
      tl.style.setProperty('--p', Math.min(1, Math.max(0, (mid - box.top) / box.height)).toFixed(4));
      rows.forEach(function (r) { r.classList.toggle('is-reached', r.getBoundingClientRect().top + 14 < mid); });
    };
    var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    FB.onScroll(request);
    window.addEventListener('resize', FB.debounce(request, 100));
  }

  /* ---------------------------------------------------------------- команда: бейджи персонала со сменой на шкале дня */

  var team = T.list('team');
  T.section('team', T.feature('team') && team.length);
  // шкала дня: от самого раннего до самого позднего времени из тайминга и смен, по целым часам
  var points = tItems.map(function (it) { return mins(it.time); });
  team.forEach(function (m) { if (m.onSite) points.push(mins(m.onSite.from), mins(m.onSite.to)); });
  var dayFrom = points.length ? Math.floor(Math.min.apply(null, points) / 60) * 60 : 0;
  var dayTo = points.length ? Math.ceil(Math.max.apply(null, points) / 60) * 60 : 0;
  var key = tItems.filter(function (it) { return it.accent; })[0];
  var pct = function (m) { return ((m - dayFrom) / (dayTo - dayFrom) * 100).toFixed(2) + '%'; };
  var initials = function (s) { return String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); };
  var brandName = (C.brand && C.brand.name) || '';

  $('#teamGrid').innerHTML = team.map(function (m) {
    var who = m.name || m.role;
    var photo = T.asset(m.photo) ? T.img(m.photo, { alt: who }) : '<span class="badge__mono" aria-hidden="true">' + esc(initials(who)) + '</span>';
    var on = m.onSite && m.onSite.from && m.onSite.to && dayTo > dayFrom ? { a: mins(m.onSite.from), b: mins(m.onSite.to) } : null;
    var meta = [];
    if (m.channel) meta.push(['Канал', String(m.channel)]);
    if (on) meta.push(['На площадке', clock(on.a) + '–' + clock(on.b)]);
    return '<li class="badge" data-reveal>' +
      '<span class="badge__clip" aria-hidden="true"></span>' +
      '<p class="badge__band"><span>' + esc(brandName) + '</span><span>Персонал</span></p>' +
      '<div class="badge__photo">' + photo + '</div>' +
      '<div class="badge__body"><h3>' + esc(who) + '</h3>' + (m.name ? '<p class="badge__role">' + esc(m.role) + '</p>' : '') +
      '<p class="badge__area">' + esc(m.area || '') + '</p></div>' +
      (meta.length ? '<dl class="badge__meta">' + meta.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (on ? '<div class="badge__shift" aria-hidden="true"><span class="badge__track"><span class="badge__bar" style="left:' + pct(on.a) + ';width:' + ((on.b - on.a) / (dayTo - dayFrom) * 100).toFixed(2) + '%"></span>' +
        (key ? '<span class="badge__key" style="left:' + pct(mins(key.time)) + '"></span>' : '') + '</span>' +
        '<span class="badge__scale"><span>' + clock(dayFrom) + '</span>' + (key ? '<span class="badge__keylabel" style="left:' + pct(mins(key.time)) + '">' + esc(key.time) + '</span>' : '') + '<span>' + clock(dayTo) + '</span></span></div>' : '') +
      '</li>';
  }).join('');
  // одна пометка на весь блок вместо метки у каждой роли
  var demoTeam = T.demo && team.some(function (m) { return m.demo; });
  $('#teamDemo').hidden = !demoTeam;
  if (demoTeam) $('#teamDemo').innerHTML = '<span class="demo-tag">пример ролей</span> Роли приведены для примера. Имена и фото — только реальных сотрудников с их согласия.';

  /* ---------------------------------------------------------------- отзывы, FAQ */

  /* ---------------------------------------------------------------- отзывы: билеты с корешком проекта */

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  $('#reviewsList').innerHTML = reviews.map(function (r) {
    var p = T.byId(projects, r.project);
    var src = r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.source || 'источник') + '</a>' : esc(r.source || '');
    var meta = [['Событие', p && p.title], ['Площадка', p && p.venue], ['Гостей', p && p.guests], ['Когда', r.date]].filter(function (x) { return x[1]; });
    return '<figure class="ticket" data-reveal>' +
      '<div class="ticket__main">' +
        '<p class="ticket__kicker">Отзыв заказчика' + (r.demo && T.demo ? ' <span class="demo-tag">пример — не настоящий клиент</span>' : '') + '</p>' +
        '<blockquote class="ticket__quote"><p>' + esc(r.text) + '</p></blockquote>' +
        '<figcaption class="ticket__who">' + esc(r.author || '') + (src ? '<span class="ticket__src">' + src + '</span>' : '') + '</figcaption>' +
      '</div>' +
      '<div class="ticket__stub">' +
        (meta.length ? '<dl class="ticket__meta">' + meta.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        (p ? '<button class="ticket__btn" type="button" data-project="' + esc(p.id) + '">Смотреть проект<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></button>' : '') +
      '</div></figure>';
  }).join('');
  T.rail($('#reviewsList'), 'Отзывы заказчиков');
  $('#reviewsList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-project]');
    if (b) openProject(b.getAttribute('data-project'), b);
  });

  /* ---------------------------------------------------------------- вопросы: памятка заказчику */

  var faq = T.list('faq');
  T.section('faq', faq.length);
  var num = function (i) { return String(i + 1).padStart(2, '0'); };
  $('#faqIndex').innerHTML = faq.map(function (q, i) {
    return '<li><a href="#faq-' + (i + 1) + '"><span class="memo__n">' + num(i) + '</span><span>' + esc(q.q) + '</span></a></li>';
  }).join('');
  $('#faqList').innerHTML = faq.map(function (q, i) {
    return '<article class="memo__item" id="faq-' + (i + 1) + '" data-reveal><span class="memo__n" aria-hidden="true">' + num(i) + '</span>' +
      '<div><h3>' + esc(q.q) + '</h3><p>' + esc(q.a) + '</p></div></article>';
  }).join('');
  // в оглавлении подсвечивается вопрос, который сейчас в середине экрана
  if (faq.length && 'IntersectionObserver' in window) {
    var links = $$('#faqIndex a');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = '#' + en.target.id;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === id;
          a.classList.toggle('is-current', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('.memo__item').forEach(function (el) { spy.observe(el); });
  }
  // разметка FAQPage для поисковиков (Яндекс и Google читают её и из скрипта)
  if (faq.length) {
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(function (q) { return { '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } }; })
    });
    document.head.appendChild(ld);
  }

  // Подсказки для разработчика из общего слоя (контакты и реквизиты не заполнены) — в консоль, а не на страницу
  if (T.demo) {
    var note = $('.contact-row--note');
    if (note) { note.remove(); console.info('[event] Демо: телефон, почта и Telegram не заполнены — укажите их в config.js → contacts.'); }
    var l = C.legal || {}, req = $('.legal-req');
    if (req && !(l.operator && l.inn)) { req.remove(); console.info('[event] Демо: реквизиты появятся после заполнения config.js → legal.'); }
  }

  /* ---------------------------------------------------------------- калькулятор: фраза-форма */

  var form = $('#briefForm');
  var fFormat = $('#fFormat'), fGuests = $('#fGuests'), fCity = $('#fCity'), fBudget = $('#fBudget');
  var noDate = $('#fNoDate'), dateIn = $('#fDate');
  fFormat.innerHTML = '<option value="">формат</option>' + formats.map(function (f) {
    return '<option value="' + esc(f.id) + '">' + esc(f.phrase || f.name.toLowerCase()) + '</option>';
  }).join('');
  fBudget.innerHTML = '<option value="">выберите</option>' +
    (pricing.budgets || []).map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') +
    '<option value="Бюджет обсуждается">обсудим</option>';
  fGuests.max = pricing.maxGuests || 10000;
  $('#fServices').innerHTML = services.map(function (s) {
    return '<label class="svc"><input type="checkbox" name="services" value="' + esc(s.id) + '">' +
      '<span class="svc__box" aria-hidden="true"></span><span class="svc__name">' + esc(s.name) + '</span>' +
      '<span class="svc__price">' + esc(T.priceText(s.price)) + '</span></label>';
  }).join('');
  $('#fConsent').innerHTML = T.consentHtml('fConsentBox');
  T.minDate(dateIn);
  FB.files($('#fFile'), { max: 1, maxSize: 10 * 1024 * 1024, list: $('#fFileList') });

  // поля фразы подстраивают ширину под текст сразу при вводе; ширину меряем через canvas, без перерасчёта вёрстки
  var ctx = document.createElement('canvas').getContext('2d');
  function textWidth(el, t) {
    var cs = getComputedStyle(el);
    ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return ctx.measureText(t).width + (parseFloat(cs.letterSpacing) || 0) * t.length;
  }
  function fitInput(inp) { inp.style.width = Math.ceil(textWidth(inp, inp.value || inp.placeholder || '') + 6) + 'px'; }
  function fitSlots() {
    fitInput(fGuests); fitInput(fCity);
    dateIn.closest('.slot').classList.toggle('is-empty', !dateIn.value);
    var n = Math.floor(Number(fGuests.value)) || 0;
    $('#fGuestsWord').textContent = FB.plural(n || 5, ['гостя', 'гостей', 'гостей']);
  }
  // число гостей — только цифры; ширина поля и склонение «гостей» меняются на каждом символе
  fGuests.addEventListener('input', function () {
    var v = fGuests.value.replace(/\D/g, '').slice(0, 5);
    if (v !== fGuests.value) fGuests.value = v;
    fitSlots();
  });
  fCity.addEventListener('input', function () { fitInput(fCity); });

  // Выпадающие списки фразы: свой компактный список вместо системного —
  // системный на macOS рисуется размером шрифта фразы и закрывает полэкрана.
  // Нативный <select> остаётся полем формы (значение, проверка), но скрыт; видна кнопка со списком.
  var menus = [];
  function enhanceSelect(sel) {
    var slot = sel.closest('.slot'), label = slot.querySelector('label').textContent;
    var btn = document.createElement('button'), list = document.createElement('ul'), active = -1, api;
    btn.type = 'button';
    btn.className = 'slot__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', sel.id + 'Menu');
    list.id = sel.id + 'Menu';
    list.className = 'slot__menu';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label);
    list.tabIndex = -1;
    list.hidden = true;
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.classList.add('slot__native');
    slot.appendChild(btn);
    slot.appendChild(list);
    var opts = function () { return Array.prototype.filter.call(sel.options, function (o) { return o.value; }); };
    function sync() {
      var o = sel.options[sel.selectedIndex];
      btn.innerHTML = '<span class="slot__val">' + esc(o ? o.text : '') + '</span><svg class="slot__chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5"/></svg>';
      btn.setAttribute('aria-label', label + ': ' + (sel.value && o ? o.text : 'не выбрано'));
      slot.classList.toggle('is-empty', !sel.value);
    }
    function paint() {
      list.innerHTML = opts().map(function (o, i) {
        return '<li role="option" id="' + sel.id + '-o' + i + '" data-i="' + i + '" aria-selected="' + (o.value === sel.value) + '"' + (i === active ? ' class="is-active"' : '') + '>' + esc(o.text) + '</li>';
      }).join('');
      if (active >= 0) list.setAttribute('aria-activedescendant', sel.id + '-o' + active);
    }
    function open() {
      menus.forEach(function (m) { if (m !== api) m.close(false); });
      active = Math.max(0, opts().map(function (o) { return o.value; }).indexOf(sel.value));
      paint();
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      slot.classList.add('is-open');
      list.focus({ preventScroll: true });
    }
    function close(focusBtn) {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      slot.classList.remove('is-open');
      if (focusBtn) btn.focus();
    }
    function choose(i) {
      var o = opts()[i];
      if (!o) return;
      sel.value = o.value;
      FB.setError(sel, '');
      sync();
      close(true);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    btn.addEventListener('click', function () { if (list.hidden) open(); else close(true); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    list.addEventListener('click', function (e) { var li = e.target.closest('[data-i]'); if (li) choose(+li.getAttribute('data-i')); });
    list.addEventListener('keydown', function (e) {
      var n = opts().length;
      if (e.key === 'ArrowDown') active = (active + 1) % n;
      else if (e.key === 'ArrowUp') active = (active - 1 + n) % n;
      else if (e.key === 'Home') active = 0;
      else if (e.key === 'End') active = n - 1;
      // Enter и Escape не должны дойти до формы: там Enter — «Дальше», Escape закрывает меню сайта
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); choose(active); return; }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      else if (e.key === 'Tab') { close(false); return; }
      else return;
      e.preventDefault();
      paint();
      var li = list.querySelector('.is-active');
      if (li) li.scrollIntoView({ block: 'nearest' });
    });
    // проверка формы ставит фокус на первое ошибочное поле — переводим его на видимую кнопку
    sel.addEventListener('focus', function () { btn.focus(); });
    api = { sync: sync, close: close, el: slot };
    menus.push(api);
    sync();
    return api;
  }
  [fFormat, fBudget].forEach(enhanceSelect);
  // после «Дальше» с ошибкой проверка фокусирует скрытый select — переводим фокус на его кнопку
  form.addEventListener('click', function (e) {
    if (!e.target.closest('[data-next]')) return;
    // мастер шагов проверяет форму в своём обработчике клика — смотрим фокус уже после него
    setTimeout(function () {
      var a = document.activeElement;
      if (a && a.classList.contains('slot__native')) a.closest('.slot').querySelector('.slot__btn').focus();
    }, 0);
  });
  document.addEventListener('pointerdown', function (e) { menus.forEach(function (m) { if (!m.el.contains(e.target)) m.close(false); }); });

  // «Дата пока не известна» отключает поле даты (отключённые поля не проверяются)
  noDate.addEventListener('change', function () {
    dateIn.disabled = noDate.checked;
    dateIn.closest('.slot').classList.toggle('is-off', noDate.checked);
    if (noDate.checked) { dateIn.value = ''; FB.setError(dateIn, ''); }
  });

  var wiz = T.wizard(form, { progress: $('#briefSteps') });

  // выбор формата с любой кнопки страницы
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick-format]');
    if (a) {
      fFormat.value = a.getAttribute('data-pick-format');
      FB.setError(fFormat, '');
      if ($('#briefResult').hidden === false) { $('#briefResult').hidden = true; form.hidden = false; }
      wiz.go(0, false);
      refresh(true);
    }
    var s = e.target.closest('[data-show-format]');
    if (s) { setFilter(s.getAttribute('data-show-format')); FB.scrollTo('#projects'); }
    var add = e.target.closest('[data-add]');
    if (add) {
      var cb = form.querySelector('input[name=services][value="' + add.getAttribute('data-add') + '"]');
      if (cb) { cb.checked = !cb.checked; refresh(true); }
      if (canAnimate) add.querySelector('.add__icon').animate([{ transform: 'scale(.6)' }, { transform: 'none' }], { duration: 300, easing: EASE });
    }
  });

  // прайс и переключатели в калькуляторе — одно состояние (чекбоксы формы)
  function syncPicked() {
    var picked = new FormData(form).getAll('services');
    $$('[data-add]').forEach(function (b) {
      var on = picked.indexOf(b.getAttribute('data-add')) >= 0;
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('.add__txt').textContent = on ? 'В смете' : 'В смету';
      b.closest('.srow').classList.toggle('is-picked', on);
    });
  }

  /* ---------------------------------------------------------------- смета-документ */

  $('#sheetDate').textContent = new Date().toLocaleDateString('ru-RU');

  function state() {
    var fd = new FormData(form);
    return {
      format: fd.get('format'),
      guests: Math.max(0, Math.floor(Number(fd.get('guests')) || 0)),
      date: noDate.checked ? '' : fd.get('date'),
      city: String(fd.get('city') || '').trim(),
      services: fd.getAll('services')
    };
  }
  function estimate() {
    var s = state();
    if (pricing.mode !== 'estimate' || !T.feature('estimate')) return null;
    var fp = pricing.formats && pricing.formats[s.format];
    var items = [], lines = [];
    if (fp) {
      items.push({ price: fp.price });
      lines.push(['Организация: ' + ((fmtById(s.format) || {}).name || '').toLowerCase(), T.priceText(fp.price)]);
      if (fp.perGuest > 0 && s.guests > 0) {
        items.push({ price: { type: 'fixed', value: fp.perGuest }, qty: s.guests });
        lines.push(['Работа с гостями: ' + s.guests + ' × ' + FB.money(fp.perGuest), FB.money(fp.perGuest * s.guests)]);
      }
    }
    s.services.forEach(function (id) {
      var sv = T.byId(services, id);
      if (!sv) return;
      items.push({ price: sv.price });
      lines.push([sv.name, T.priceText(sv.price)]);
    });
    return { sum: T.sum(items), lines: lines, s: s };
  }

  var shownLines = {}, shownSum = null, tween = 0;
  // итог «перещёлкивается» от старой суммы к новой, как табло — при выборе формата и услуг.
  // При наборе числа гостей сумма меняется сразу, без анимации, чтобы не отставать от ввода.
  function setTotal(el, r, animate) {
    var from = shownSum;
    shownSum = { min: r.min, max: r.max };
    if (!animate || !canAnimate || !from || (from.min === r.min && from.max === r.max)) { tween++; el.textContent = r.text; return; }
    var t0 = performance.now(), id = ++tween;
    // во вкладке в фоне requestAnimationFrame стоит — итог всё равно должен оказаться верным
    setTimeout(function () { if (id === tween) el.textContent = r.text; }, 600);
    (function step(now) {
      if (id !== tween) return;
      var k = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      el.textContent = T.sumText(Object.assign({}, r, { min: Math.round(from.min + (r.min - from.min) * e), max: Math.round(from.max + (r.max - from.max) * e) }));
      if (k < 1) requestAnimationFrame(step); else el.textContent = r.text;
    })(t0);
  }

  function renderEstimate(animate) {
    var box = $('#estBody'), e = estimate();
    if (!e) {
      box.innerHTML = '<p class="sheet__empty">Смету подготовим после обсуждения брифа: она зависит от площадки, программы и подрядчиков.</p>';
      updateTally(null);
      return;
    }
    var s = e.s, f = fmtById(s.format);
    // строка события: только то, что уже заполнено во фразе
    var ev = [f ? f.name : '', s.guests ? s.guests + ' ' + FB.plural(s.guests, ['гость', 'гостя', 'гостей']) : '',
      s.date ? FB.fmtDate(s.date, { day: 'numeric', month: 'long' }) : noDate.checked ? 'дата обсуждается' : '', s.city].filter(Boolean);
    var head = '<p class="sheet__event">' + (ev.length ? ev.map(esc).join(' · ') : 'Заполните фразу слева') + '</p>';
    if (!e.lines.length) {
      shownLines = {}; shownSum = null;
      box.innerHTML = head + '<ul class="sheet__lines sheet__lines--ghost" role="list" aria-hidden="true">' +
        ['Организация', 'Работа с гостями', 'Услуги'].map(function (t) { return '<li><span>' + t + '</span><i></i><b>—</b></li>'; }).join('') + '</ul>' +
        '<p class="sheet__total"><span>Итого</span><b>—</b></p><p class="sheet__hint">Выберите формат во фразе — строки сметы появятся здесь.</p>';
      updateTally(e);
      return;
    }
    var next = {};
    box.innerHTML = head + '<ul class="sheet__lines" role="list">' + e.lines.map(function (l) {
      var k = l[0].split(':')[0];
      next[k] = true;
      return '<li' + (shownLines[k] ? '' : ' class="is-new"') + '><span>' + esc(l[0]) + '</span><i aria-hidden="true"></i><b>' + esc(l[1]) + '</b></li>';
    }).join('') + '</ul>' +
      '<p class="sheet__total"><span>Итого</span><b id="sheetTotal"></b></p>' +
      '<div class="sheet__foot">' + T.demoTag(pricing.demo, 'демо-тарифы') + '<p>' + esc(pricing.note || '') + '</p></div>';
    shownLines = next;
    setTotal($('#sheetTotal'), e.sum, animate);
    updateTally(e);
  }

  /* ---------------------------------------------------------------- плашка сметы внизу экрана */

  var tally = $('#tally'), sheetOnScreen = false, lastTally = '';
  function updateTally(e) {
    var s = e && e.s, has = !!(s && (s.format || s.services.length));
    var show = has && !sheetOnScreen && $('#briefResult').hidden;
    if (has) {
      var f = fmtById(s.format);
      var what = s.services.length ? s.services.length + ' ' + FB.plural(s.services.length, ['услуга', 'услуги', 'услуг']) : f ? f.name : '';
      var text = what + ' · ' + e.sum.text;
      $('#tallyWhat').textContent = what;
      $('#tallySum').textContent = e.sum.text;
      if (show && !tally.hidden && text !== lastTally && canAnimate) tally.animate([{ transform: 'translateX(-50%) scale(1.04)' }, { transform: 'translateX(-50%)' }], { duration: 280, easing: EASE });
      lastTally = text;
    }
    tally.hidden = !show;
    root.classList.toggle('has-tally', show);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { sheetOnScreen = en[0].isIntersecting; updateTally(estimate()); }, { threshold: 0.15 }).observe($('#estimateWrap'));
  }

  function refresh(animate) {
    menus.forEach(function (m) { m.sync(); });
    fitSlots();
    syncPicked();
    renderEstimate(animate);
  }
  window.addEventListener('resize', FB.debounce(fitSlots, 150));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSlots);
  form.addEventListener('change', function () { refresh(true); });
  // ввод с клавиатуры: одна перерисовка сметы на кадр, без задержки
  var inputFrame = 0;
  form.addEventListener('input', function () {
    cancelAnimationFrame(inputFrame);
    inputFrame = requestAnimationFrame(function () { refresh(false); });
  });
  form.addEventListener('fb:reset', function () { dateIn.disabled = false; dateIn.closest('.slot').classList.remove('is-off'); refresh(false); });
  refresh(false);

  T.leadForm(form, {
    type: 'event_brief',
    result: $('#briefResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Бриф принят для обсуждения',
    successText: (C.booking && C.booking.successText) || '',
    collect: function (fd) {
      var e = estimate(), f = fmtById(fd.get('format'));
      var chosen = fd.getAll('services').map(function (id) { var s = T.byId(services, id); return s ? s.name : id; });
      return {
        format: f ? f.name : fd.get('format'),
        date: noDate.checked ? '' : fd.get('date'),
        city: fd.get('city'),
        guests: fd.get('guests'),
        services: chosen.join(', '),
        company: fd.get('company') || '',
        total: e && e.s.format ? e.sum.text : '',
        consent: fd.get('consent') === 'да',
        details: {
          'Дата': noDate.checked ? 'Дата не выбрана' : fd.get('date'),
          'Бюджет': fd.get('budget'),
          'Площадка': fd.get('venue') || '—',
          'Код формата': fd.get('format'),
          'Коды услуг': fd.getAll('services').join(', ') || '—',
          'Смета': e && e.s.format ? 'предварительная, из тарифов на сайте' : 'не рассчитывалась'
        },
        // коды полей формы, дублирующие details, не отправляем
        dateUnknown: undefined, budget: undefined, venue: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Формат</dt><dd>' + esc(p.format) + '</dd><dt>Дата</dt><dd>' + esc(p.date ? FB.fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' }) : 'не выбрана') + '</dd>' +
        '<dt>Гостей</dt><dd>' + esc(p.guests) + '</dd>' + (p.total ? '<dt>Ориентир</dt><dd>' + esc(p.total) + '</dd>' : '') + '</dl>';
    },
    onSuccess: function () { updateTally(estimate()); }
  });

  T.mobileCta((cta.label || 'Обсудить мероприятие'), 'brief');
});
