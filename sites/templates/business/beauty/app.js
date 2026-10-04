/* Салон красоты: «палетка».
   Первый экран — открытая палетка: крышка-зеркало с заголовком и матовые «пэны» категорий своего цвета.
   Дальше: услуги и цены всех категорий сразу («+» кладёт услугу в палетку визита внизу экрана) →
   мастера → работы лентой с фильтром → вопросы → запись: визит (пустой — с готовыми сочетаниями) →
   мастер → желаемое время → контакт → визитка салона.
   Расписания нет: свободные окна не показываем. Анимации — CSS и Web Animations API;
   anime.js и Lenis на этой странице не подключаются. */
T.boot(function (T, C) {
  'use strict';
  var $ = FB.$, $$ = FB.$$, esc = FB.esc;
  var cats = T.list('categories'), team = T.list('team'), works = T.list('portfolio');
  // показываем только услуги категорий из конфигурации
  var services = T.list('services').filter(function (s) { return T.byId(cats, s.cat); });
  var exclusive = ((C.compatibility || {}).exclusive || []);
  var ANY = 'any';
  var CONSULT = services.filter(function (s) { return s.id === 'color-consult'; })[0] || null;
  var canAnimate = !FB.reduced && typeof Element.prototype.animate === 'function';
  var FALLBACK = ['#8a5a44', '#d4848f', '#a07f69', '#4b2c3a', '#e0876a', '#b98b7a'];

  var visit = FB.store.get('visit', []).filter(function (id) { return T.byId(services, id); });
  function save() { FB.store.set('visit', visit); }
  function svc(id) { return T.byId(services, id); }
  function masterName(m) { return m.name || m.role; }
  function mastersFor(ids) { return team.filter(function (m) { return ids.every(function (id) { return (m.services || []).indexOf(id) > -1; }); }); }
  function catColor(catId) { var i = cats.map(function (c) { return c.id; }).indexOf(catId), c = cats[i]; return (c && c.color) || FALLBACK[Math.max(0, i) % FALLBACK.length]; }
  function svcColor(s) { return catColor(s && s.cat); }
  function lc(t) { return String(t).replace(/^По запросу$/, 'по запросу'); }
  var usedCats = cats.filter(function (c) { return services.some(function (s) { return s.cat === c.id; }); });

  function minPrice(list) {
    var vals = list.map(function (s) { var p = s.price || {}; return p.type === 'range' ? p.min : p.value; }).filter(function (v) { return v > 0; });
    return vals.length ? { type: 'from', value: Math.min.apply(null, vals) } : { type: 'request' };
  }

  /* ---------------------------------------------------------------- первый экран: палетка */

  var h = C.hero || {}, cta = h.cta || {};
  var title = esc(h.title || '');
  if (h.accent && title.indexOf(esc(h.accent)) > -1) title = title.replace(esc(h.accent), '<em>' + esc(h.accent) + '</em>');
  $('#heroTitle').innerHTML = title;
  $('#heroCta').textContent = cta.label || 'Собрать визит';
  $('#heroCta').href = '#' + (cta.target || 'services');
  $('#heroPhoto').innerHTML = T.img(h.image, { eager: true, alt: '' });
  $('#heroPans').innerHTML = usedCats.map(function (c) {
    // «от» на пэне — без консультации, иначе у волос было бы «от 500 ₽»
    var list = services.filter(function (s) { return s.cat === c.id && s !== CONSULT; });
    return '<li><a class="pan" href="#cat-' + esc(c.id) + '" style="--c:' + esc(catColor(c.id)) + '">' +
      '<span class="pan__dot" aria-hidden="true"></span><b>' + esc(c.name) + '</b><small>' + esc(lc(T.priceText(minPrice(list)))) + '</small></a></li>';
  }).join('');
  $('#heroPans').addEventListener('click', function (e) {
    var a = e.target.closest('.pan');
    if (!a) return;
    e.preventDefault();
    FB.scrollTo(a.getAttribute('href'));
  });

  /* ---------------------------------------------------------------- визит: сумма, длительность, совместимость */

  function conflictWith(id) {
    for (var i = 0; i < exclusive.length; i++) {
      var r = exclusive[i];
      if ((r[0] === id && visit.indexOf(r[1]) > -1) || (r[1] === id && visit.indexOf(r[0]) > -1)) return r[2] || 'Эти услуги нельзя совместить в одном визите.';
    }
    return '';
  }
  function totals() {
    var list = visit.map(svc).filter(Boolean);
    return {
      list: list,
      sum: T.sum(list.map(function (s) { return { price: s.price }; })),
      min: list.reduce(function (a, s) { return a + T.durMin(s.duration); }, 0),
      max: list.reduce(function (a, s) { return a + T.durMax(s.duration); }, 0),
      consult: list.filter(function (s) { return s.consultFirst; })
    };
  }
  function durText(t) { return t.min === t.max ? T.duration(t.min) : T.duration({ min: t.min, max: t.max }); }
  function toggle(id, from) {
    var i = visit.indexOf(id), added = false;
    $('#svcMsg').textContent = '';
    if (i > -1) visit.splice(i, 1);
    else {
      var c = conflictWith(id);
      if (c) { $('#svcMsg').textContent = c; FB.toast(c, 'error'); return; }
      visit.push(id); added = true;
    }
    save();
    renderAll();
    if (added && from) fly(from, svcColor(svc(id)));
  }
  // кружок цвета категории перелетает из строки услуги в палетку визита внизу экрана
  function fly(from, color) {
    var target = $('#visitPans').lastElementChild;
    if (!canAnimate || !target || $('#visitBar').hidden) return;
    var a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!b.width) return;
    var dot = document.createElement('span');
    dot.className = 'fly';
    dot.style.background = color;
    dot.style.left = (a.left + a.width / 2 - 9) + 'px';
    dot.style.top = (a.top + a.height / 2 - 9) + 'px';
    document.body.appendChild(dot);
    target.style.opacity = '0';
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(' + (dx * .45) + 'px,' + (Math.min(dy, 0) * .5 - 70) + 'px) scale(1.25)', offset: .45 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.85)' }
    ], { duration: 700, easing: 'cubic-bezier(.45,0,.3,1)' }).onfinish = function () {
      dot.remove();
      target.style.opacity = '';
      target.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
  }

  /* ---------------------------------------------------------------- услуги и цены: все категории */

  T.section('services', services.length);
  var ADD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-plus" d="M12 6v12M6 12h12"/><path class="i-check" d="M6.5 12.5l3.5 3.5 7.5-8"/></svg>';
  // чипы категорий — закреплены под шапкой на телефоне, все категории остаются на странице (README)
  if (usedCats.length > 1) {
    var jump = document.createElement('nav');
    jump.className = 'menu__jump';
    jump.setAttribute('aria-label', 'Категории услуг');
    jump.innerHTML = usedCats.map(function (c) { return '<a href="#cat-' + esc(c.id) + '" style="--c:' + esc(catColor(c.id)) + '"><i aria-hidden="true"></i>' + esc(c.name) + '</a>'; }).join('');
    $('#svcMenu').parentNode.insertBefore(jump, $('#svcMenu'));
    // закреплённые чипы перекрывают верх страницы: прокручиваем с учётом их высоты
    jump.addEventListener('click', function (e) {
      var a = e.target.closest('a'), el = a && document.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      FB.scrollTo(el, { offset: -FB.headerOffset() - jump.offsetHeight - 12 });
    });
  }
  $('#svcMenu').innerHTML = usedCats.map(function (c) {
    return '<section class="menu__cat" id="cat-' + esc(c.id) + '" style="--c:' + esc(catColor(c.id)) + '" data-reveal>' +
      '<h3 class="menu__h"><span class="swatch" aria-hidden="true"></span>' + esc(c.name) + '</h3><ul class="menu__list" role="list">' +
      services.filter(function (s) { return s.cat === c.id; }).map(function (s) {
        return '<li class="item" data-item="' + esc(s.id) + '"><div class="item__main"><p class="item__name">' + esc(s.name) + '</p>' +
          '<p class="item__comp">' + esc((s.composition || []).join(' · ')) + '</p>' +
          (s.consultFirst ? '<p class="item__consult">Перед этой услугой предлагаем консультацию колориста.</p>' : '') + '</div>' +
          '<span class="item__dur">' + esc(T.duration(s.duration)) + '</span><span class="item__price">' + esc(lc(T.priceText(s.price))) + '</span>' +
          '<button class="add" type="button" data-add="' + esc(s.id) + '" aria-pressed="false" aria-label="Добавить в визит: ' + esc(s.name) + '">' + ADD + '</button></li>';
      }).join('') + '</ul></section>';
  }).join('');
  function renderMenu() {
    $$('#svcMenu .item').forEach(function (li) {
      var id = li.getAttribute('data-item'), on = visit.indexOf(id) > -1, b = $('.add', li);
      li.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', (on ? 'Убрать из визита: ' : 'Добавить в визит: ') + svc(id).name);
    });
  }
  $('#svcMenu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b) toggle(b.getAttribute('data-add'), b);
  });
  var pricing = C.pricing || {};
  $('#pricesNote').innerHTML = (T.demo && (pricing.demo || services.some(function (s) { return s.demo; })) ? '<span class="demo-tag">демо-цены</span> ' : '') + esc(pricing.note || '');

  /* ---------------------------------------------------------------- мастера */

  // фото мастера; без фото — ничего (буквы в кружках выглядят как заглушка)
  function portrait(m, cls) {
    return T.asset(m.photo) ? '<span class="' + cls + '" aria-hidden="true">' + T.img(m.photo, { alt: '' }) + '</span>' : '';
  }
  T.section('masters', T.feature('team') && team.length);
  $('#mastersGrid').innerHTML = team.map(function (m) {
    var list = (m.services || []).map(svc).filter(Boolean);
    var mcats = usedCats.filter(function (c) { return list.some(function (s) { return s.cat === c.id; }); });
    return '<article class="master" data-reveal>' + portrait(m, 'master__photo') +
      '<p class="master__cats">' + mcats.map(function (c) { return '<span style="--c:' + esc(catColor(c.id)) + '"><i></i>' + esc(c.name) + '</span>'; }).join('') + '</p>' +
      '<h3>' + esc(masterName(m)) + '</h3>' + (m.name ? '<p class="master__role">' + esc(m.role) + '</p>' : '') +
      '<p class="master__svc">' + list.map(function (s) { return esc(s.name); }).join(', ') + '</p>' +
      (works.some(function (w) { return w.master === m.id; }) ? '<button class="link-btn" type="button" data-work-master="' + esc(m.id) + '">Работы мастера<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' : '') + '</article>';
  }).join('');
  T.rail($('#mastersGrid'), 'Мастера');
  var demoTeam = T.demo && team.some(function (m) { return m.demo; });
  $('#mastersDemo').hidden = !demoTeam;
  if (demoTeam) $('#mastersDemo').innerHTML = '<span class="demo-tag">пример</span> Показаны роли мастеров. Имена и фото — только реальных сотрудников с их согласия.';

  /* ---------------------------------------------------------------- работы: лента, фильтр по категории и мастеру */

  T.section('works', T.feature('portfolio') && works.length);
  var demoWorks = T.demo && works.some(function (w) { return w.demo; });
  $('#worksDemo').hidden = !demoWorks;
  if (demoWorks) $('#worksDemo').innerHTML = '<span class="demo-tag">демо</span> Работы — примеры на стоковых фото. Замените их фотографиями работ мастеров салона.';
  var wCats = usedCats.filter(function (c) { return works.some(function (w) { var s = svc(w.service); return s && s.cat === c.id; }); });
  var wMasters = team.filter(function (m) { return works.some(function (w) { return w.master === m.id; }); });
  var fCat = '', fMaster = '';
  $('#wfCats').innerHTML = [{ id: '', name: 'Все работы' }].concat(wCats).map(function (c) {
    return '<button class="chip" type="button" data-wc="' + esc(c.id) + '" aria-pressed="' + (c.id === '') + '"' + (c.id ? ' style="--c:' + esc(catColor(c.id)) + '"' : '') + '>' + (c.id ? '<i></i>' : '') + esc(c.name) + '</button>';
  }).join('');
  $('#wfMaster').innerHTML = '<option value="">Все мастера</option>' + wMasters.map(function (m) {
    return '<option value="' + esc(m.id) + '">' + esc(masterName(m)) + '</option>';
  }).join('');
  $('#wfMasterBox').hidden = wMasters.length < 2;
  function renderWorks(animate) {
    var list = works.filter(function (w) { var s = svc(w.service); return (!fCat || (s && s.cat === fCat)) && (!fMaster || w.master === fMaster); });
    $$('#wfCats [data-wc]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-wc') === fCat)); });
    $('#wfMaster').value = fMaster;
    $('#worksGrid').innerHTML = list.map(function (w) {
      var s = svc(w.service), mm = T.byId(team, w.master);
      return '<figure class="work" style="--c:' + esc(svcColor(s)) + '">' + T.img(w.image) + '<figcaption><b>' + esc(w.title) + '</b>' +
        '<span><i></i>' + esc([s && s.name, mm && masterName(mm)].filter(Boolean).join(' · ')) + '</span></figcaption></figure>';
    }).join('') || '<p class="empty">По этому фильтру работ пока нет.</p>';
    $('#worksGrid').scrollLeft = 0;
    if (animate && canAnimate) $$('#worksGrid .work').forEach(function (el, i) {
      el.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 50, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
  }
  $('#wfCats').addEventListener('click', function (e) { var b = e.target.closest('[data-wc]'); if (!b) return; fCat = b.getAttribute('data-wc'); renderWorks(true); });
  $('#wfMaster').addEventListener('change', function () { fMaster = this.value; renderWorks(true); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-work-master]');
    if (!b) return;
    fMaster = b.getAttribute('data-work-master'); fCat = '';
    renderWorks(true);
    FB.scrollTo('#works');
  });
  function reelStep(dir) {
    var reel = $('#worksGrid'), card = $('.work', reel);
    reel.scrollBy({ left: dir * (card ? card.getBoundingClientRect().width + 16 : 320), behavior: FB.reduced ? 'auto' : 'smooth' });
  }
  $('#reelPrev').addEventListener('click', function () { reelStep(-1); });
  $('#reelNext').addEventListener('click', function () { reelStep(1); });
  renderWorks(false);

  var reviews = T.list('reviews');
  T.section('reviews', T.feature('reviews') && reviews.length);
  T.renderReviews($('#reviewsList'), reviews);
  var faq = T.list('faq');
  T.section('faq', faq.length);
  T.renderFaq($('#faqList'), faq);

  // визитка: «Салон красоты · город»
  $('#vcardSub').textContent = [h.eyebrow, (C.contacts || {}).city].filter(Boolean).join(' · ');

  // длинная подсказка общего слоя о пустых контактах — одной демо-строкой; реквизиты — в консоль
  if (T.demo) {
    var note = $('.contact-row--note');
    if (note) {
      note.remove();
      $('#contactsDemo').hidden = false;
      $('#contactsDemo').innerHTML = '<span class="demo-tag">демо</span> Телефон, почта и Telegram появятся после заполнения <code>config.js → contacts</code>.';
    }
    var l = C.legal || {}, req = $('.legal-req');
    if (req && !(l.operator && l.inn)) { req.remove(); console.info('[beauty] Демо: реквизиты появятся после заполнения config.js → legal.'); }
  }

  /* ---------------------------------------------------------------- палетка визита внизу экрана */

  function renderBar() {
    var t = totals(), bar = $('#visitBar');
    bar.hidden = !t.list.length;
    document.documentElement.classList.toggle('has-visit', !!t.list.length);
    $('#visitPans').innerHTML = t.list.map(function (s) { return '<li style="--c:' + esc(svcColor(s)) + '"></li>'; }).join('');
    $('#visitSum').innerHTML = t.list.length ? '<b>' + t.list.length + ' ' + FB.plural(t.list.length, ['услуга', 'услуги', 'услуг']) + '</b><span>' + esc(t.sum.text) + ' · ' + esc(durText(t)) + '</span>' : '';
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { $('#visitBar').classList.toggle('is-away', en[0].isIntersecting); }, { threshold: 0.05 }).observe($('#booking'));
  }

  /* ---------------------------------------------------------------- запись */

  var form = $('#bookForm');
  var parts = ((C.booking || {}).dayParts || ['Любое время']);
  $('#bParts').innerHTML = parts.map(function (p) {
    var m = String(p).split(/,\s*/);
    return '<label class="seg__item"><input type="radio" name="part" value="' + esc(p) + '" required data-msg="Выберите время суток"><b>' + esc(m[0]) + '</b>' + (m[1] ? '<small>' + esc(m.slice(1).join(', ')) + '</small>' : '') + '</label>';
  }).join('');
  // желаемый день: две недели; дни, которых нет в часах работы, недоступны
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], open = {}, parsed = false;
  ((C.contacts || {}).hours || []).forEach(function (hh) {
    if (/выходн|закрыт/i.test(hh.time || '')) return;
    if (/ежедневно|без выходных/i.test(hh.days || '')) { WD.forEach(function (_, d) { open[d] = true; }); parsed = true; return; }
    String(hh.days || '').toLowerCase().split(/\s*,\s*/).forEach(function (part) {
      var r = part.split(/\s*[–-]\s*/), a = WD.indexOf(r[0].slice(0, 2)), b = WD.indexOf((r[1] || r[0]).slice(0, 2));
      if (a < 0 || b < 0) return;
      parsed = true;
      for (var d = a; ; d = (d + 1) % 7) { open[d] = true; if (d === b) break; }
    });
  });
  $('#bDays').innerHTML = FB.days(14).map(function (d, i) {
    var off = parsed && !open[d.getDay()], w = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : WD[d.getDay()];
    return '<label class="day' + (off ? ' is-off' : '') + '"' + (off ? ' title="Выходной"' : '') + '><input type="radio" name="date" value="' + FB.iso(d) + '"' + (off ? ' disabled' : ' required data-msg="Выберите день"') + '>' +
      '<small>' + w + '</small><b>' + d.getDate() + '</b><small>' + d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') + '</small></label>';
  }).join('');
  $('#bConsent').innerHTML = T.consentHtml('bConsentBox');

  function renderVisitStep() {
    var t = totals();
    $('#bVisit').innerHTML = t.list.length
      ? '<ul class="vlist" role="list">' + t.list.map(function (s) {
          return '<li style="--c:' + esc(svcColor(s)) + '"><span class="swatch" aria-hidden="true"></span><span class="vlist__name"><b>' + esc(s.name) + '</b><small>' + esc(T.duration(s.duration)) + ' · ' + esc(lc(T.priceText(s.price))) + '</small></span>' +
            '<button type="button" class="vlist__rm" data-remove="' + esc(s.id) + '" aria-label="Убрать из визита: ' + esc(s.name) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button></li>';
        }).join('') + '</ul>' +
        '<p class="vtotal"><span>Итого</span><b>' + esc(t.sum.text) + '</b><span>' + esc(durText(t)) + '</span></p>' +
        (t.consult.length && CONSULT && visit.indexOf(CONSULT.id) < 0 ? '<div class="consult-hint"><p>Для услуги «' + esc(t.consult[0].name) + '» предлагаем начать с консультации: мастер оценит волосы и назовёт стоимость.</p><button class="btn btn--line btn--sm" type="button" data-add-consult>Добавить консультацию</button></div>' : '') +
        '<p class="hint">' + esc(pricing.note || '') + '</p>'
      : '<p class="vempty">Выберите услуги <a href="#services">в прайсе</a> или начните с готового сочетания:</p>' + ideasHtml();
  }
  // готовые сочетания: только те, где все услуги есть и их можно совместить
  var ideas = T.list('visitIdeas').filter(function (x) {
    var ids = (x.services || []).filter(function (id) { return svc(id); });
    return ids.length > 1 && ids.length === (x.services || []).length && !exclusive.some(function (r) { return ids.indexOf(r[0]) > -1 && ids.indexOf(r[1]) > -1; });
  });
  function ideasHtml() {
    return ideas.length ? '<ul class="ideas" role="list">' + ideas.map(function (x, i) {
      var list = x.services.map(svc), sum = T.sum(list.map(function (s) { return { price: s.price }; }));
      var t = { min: list.reduce(function (a, s) { return a + T.durMin(s.duration); }, 0), max: list.reduce(function (a, s) { return a + T.durMax(s.duration); }, 0) };
      return '<li><button type="button" class="idea" data-idea="' + i + '"><span class="idea__pans" aria-hidden="true">' + list.map(function (s) { return '<i style="--c:' + esc(svcColor(s)) + '"></i>'; }).join('') + '</span>' +
        '<span class="idea__name"><b>' + esc(x.title || list.map(function (s) { return s.name; }).join(' и ')) + '</b><small>' + esc(sum.text) + ' · ' + esc(durText(t)) + '</small></span><span class="idea__add">Добавить</span></button></li>';
    }).join('') + '</ul>' : '';
  }
  $('#bVisit').addEventListener('click', function (e) {
    var r = e.target.closest('[data-remove]');
    if (r) toggle(r.getAttribute('data-remove'));
    if (e.target.closest('[data-add-consult]') && CONSULT) toggle(CONSULT.id);
    var idea = e.target.closest('[data-idea]');
    if (idea) {
      ideas[+idea.getAttribute('data-idea')].services.forEach(function (id) { if (visit.indexOf(id) < 0 && !conflictWith(id)) visit.push(id); });
      save(); renderAll();
      var first = $('#bVisit .vlist li');
      if (first && canAnimate) $$('#bVisit .vlist li').forEach(function (li, k) { li.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: k * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); });
    }
  });

  function renderMasters() {
    var prev = (form.querySelector('input[name=master]:checked') || {}).value;
    var list = mastersFor(visit);
    if (prev && prev !== ANY && !list.some(function (m) { return m.id === prev; })) prev = ANY;
    $('#bMasters').innerHTML = '<label class="person"><input type="radio" name="master" value="' + ANY + '" required' + (!prev || prev === ANY ? ' checked' : '') + '><span><b>Любой подходящий мастер</b><small>администратор подберёт под выбранные услуги</small></span></label>' +
      list.map(function (m) { return '<label class="person"><input type="radio" name="master" value="' + esc(m.id) + '"' + (prev === m.id ? ' checked' : '') + '>' + portrait(m, 'person__photo') + '<span><b>' + esc(masterName(m)) + '</b><small>' + esc(m.name ? m.role : 'делает все выбранные услуги') + '</small></span></label>'; }).join('') +
      (visit.length && !list.length ? '<p class="hint">Один мастер не делает все выбранные услуги. Администратор распределит их между мастерами.</p>' : '');
  }

  function renderAll() { renderMenu(); renderBar(); renderVisitStep(); renderMasters(); }

  T.wizard(form, {
    progress: $('#bookSteps'),
    check: { 0: function () { return visit.length ? true : 'Добавьте хотя бы одну услугу.'; } },
    onStep: function (i) { if (i === 1) renderMasters(); }
  });

  T.leadForm(form, {
    type: 'visit_request',
    result: $('#bookResult'),
    successTitle: (C.booking && C.booking.successTitle) || 'Заявка на запись принята',
    successText: (C.booking && C.booking.successText) || '',
    before: function () {
      if (!visit.length) return 'Добавьте хотя бы одну услугу.';
      // квалификация: выбранный мастер должен выполнять все услуги визита
      var mid = (form.querySelector('input[name=master]:checked') || {}).value;
      if (mid && mid !== ANY && mastersFor(visit).map(function (m) { return m.id; }).indexOf(mid) < 0) return 'Выбранный мастер не выполняет все услуги визита. Выберите другого мастера.';
      return true;
    },
    collect: function (fd) {
      var t = totals(), mid = fd.get('master'), m = T.byId(team, mid);
      return {
        services: t.list.map(function (s) { return s.name; }).join('; '),
        master: mid === ANY ? 'Любой подходящий' : m ? masterName(m) : '',
        time: fd.get('part'),
        total: t.sum.text,
        consent: fd.get('consent') === 'да',
        details: { 'Длительность': durText(t), 'Коды услуг': visit.join(', '), 'Код мастера': mid, 'Запись': 'требует подтверждения' },
        part: undefined
      };
    },
    summary: function (p) {
      return '<dl class="sum-list"><dt>Услуги</dt><dd>' + esc(p.services) + '</dd><dt>Мастер</dt><dd>' + esc(p.master) + '</dd><dt>Итого</dt><dd>' + esc(p.total) + '</dd>' +
        '<dt>Желаемое время</dt><dd>' + esc(FB.fmtDate(p.date, { day: 'numeric', month: 'long' })) + ', ' + esc(String(p.time || '').toLowerCase()) + '</dd></dl>';
    },
    onSuccess: function () { visit = []; save(); renderAll(); }
  });
  form.addEventListener('fb:reset', renderAll);

  renderAll();
  T.mobileCta('Записаться', 'booking');
});
