/* Кройка — каталог, карточка товара, подбор размера, избранное, корзина и оформление, пошив по меркам, статус заказа. */
(function () {
  'use strict';
  FB.init();

  /* ================================================================ справочники */

  var SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  var SIZE_TABLE = [ // размер, RU, грудь, талия, бёдра (верхняя граница)
    ['XS', '40–42', [80, 84], [62, 66], [88, 92]], ['S', '42–44', [84, 88], [66, 70], [92, 96]],
    ['M', '44–46', [88, 92], [70, 74], [96, 100]], ['L', '46–48', [92, 98], [74, 80], [100, 106]],
    ['XL', '48–50', [98, 104], [80, 86], [106, 112]]
  ];
  var CATS = [['', 'Все'], ['coats', 'Пальто и тренчи'], ['jackets', 'Жакеты и костюмы'], ['knit', 'Трикотаж'], ['dresses', 'Платья'], ['shirts', 'Рубашки'], ['basics', 'База и джинсы']];
  var AV = { stock: ['В наличии', 'tag--stock'], order: ['Привоз 10–14 дней', 'tag--order'], tailor: ['Пошив 3 недели', 'tag--order'] };

  function s(xs, s_, m, l, xl) { return { XS: xs, S: s_, M: m, L: l, XL: xl }; }
  var P = [
    { id: 'coat-pink', name: 'Пальто из шерсти', cat: 'coats', price: 18900, av: 'stock', st: s(0, 2, 3, 1, 0), img2: 'knitfab', colors: [['#e8a0ad', 'розовый'], ['#c4a384', 'кэмел']], fabric: '80% шерсть, 20% полиамид', season: 'Осень', desc: 'Прямой силуэт, спущенное плечо, подклад из вискозы. Длина 105 см на рост 170.' },
    { id: 'jacket-olive', name: 'Жакет с воротником-стойкой', cat: 'jackets', price: 12400, av: 'order', st: s(1, 1, 1, 1, 1), img2: 'buttons', colors: [['#6b6b2e', 'олива'], ['#1f1f1f', 'чёрный']], fabric: '100% хлопок, саржа', season: 'Демисезон', desc: 'Приталенный крой, потайная застёжка, погоны. Шьётся в Стамбуле под заказ.' },
    { id: 'coat-navy', name: 'Тренч оверсайз', cat: 'coats', price: 15600, av: 'stock', st: s(1, 2, 0, 2, 1), img2: 'stripefab', colors: [['#1e2a3a', 'тёмно-синий'], ['#c9b28f', 'бежевый']], fabric: '65% хлопок, 35% полиэстер, водоотталкивающая пропитка', season: 'Весна–осень', desc: 'Двубортный, съёмный пояс, кокетка от дождя.' },
    { id: 'cardigan-white', name: 'Кардиган с поясом', cat: 'knit', price: 8900, av: 'stock', st: s(0, 3, 2, 2, 0), img2: 'knitfab', colors: [['#efece6', 'молочный']], fabric: '50% шерсть мериноса, 50% акрил', season: 'Круглый год', desc: 'Мягкий крупный трикотаж, накладные карманы, кожаный пояс в комплекте.' },
    { id: 'suit-blue', name: 'Костюм-двойка из шерсти', cat: 'jackets', price: 32000, av: 'tailor', st: s(1, 1, 1, 1, 1), img2: 'tailor', colors: [['#1f3a6e', 'синий'], ['#2b2b2b', 'графит']], fabric: 'Шерсть Super 110’s, Италия', season: 'Круглый год', desc: 'Шьём по вашим меркам: 2 примерки, выбор подклада и пуговиц.' },
    { id: 'shirt-white', name: 'Рубашка оксфорд', cat: 'shirts', price: 4900, av: 'stock', st: s(2, 4, 4, 3, 2), img2: 'stripefab', colors: [['#ffffff', 'белый'], ['#b9cde6', 'голубой']], fabric: '100% хлопок, плотное плетение оксфорд', season: 'Круглый год', desc: 'Свободный крой, воротник на пуговицах, не просвечивает.' },
    { id: 'tee-white', name: 'Футболка из плотного хлопка', cat: 'basics', price: 2400, av: 'stock', st: s(3, 5, 5, 4, 2), img2: 'tees', colors: [['#ffffff', 'белый'], ['#1f1f1f', 'чёрный'], ['#9aa58d', 'шалфей']], fabric: '100% хлопок, 220 г/м²', season: 'Круглый год', desc: 'Плотная, держит форму после стирки, горловина с усилением.' },
    { id: 'jeans', name: 'Джинсы прямые', cat: 'basics', price: 7900, av: 'order', st: s(1, 1, 1, 1, 1), img2: 'buttons', colors: [['#3c5a86', 'индиго']], fabric: 'Японский деним 13 oz, 100% хлопок', season: 'Круглый год', desc: 'Высокая посадка, прямая штанина. Привоз из Италии, подгоним длину бесплатно.' },
    { id: 'sweater-red', name: 'Джемпер из мериноса', cat: 'knit', price: 6900, av: 'stock', st: s(1, 2, 2, 1, 0), img2: 'knitfab', colors: [['#c3232e', 'красный'], ['#2e3a2b', 'хвоя']], fabric: '100% шерсть мериноса', season: 'Осень–зима', desc: 'Тонкий, не колется, подходит под жакет.' },
    { id: 'knit-rust', name: 'Кардиган косами', cat: 'knit', price: 9800, av: 'order', st: s(1, 1, 1, 1, 1), img2: 'knitfab', colors: [['#a8502a', 'ржавый'], ['#d8cfc0', 'овсяный']], fabric: '70% шерсть, 30% альпака', season: 'Зима', desc: 'Ручная вязка, крупные косы, деревянные пуговицы.' },
    { id: 'dress-navy', name: 'Платье в цветочек', cat: 'dresses', price: 7400, av: 'stock', st: s(1, 2, 1, 0, 1), img2: 'linen', colors: [['#1c2340', 'тёмно-синий']], fabric: '100% вискоза', season: 'Лето', desc: 'Длина миди, короткий рукав, пояс на кулиске.' },
    { id: 'dress-pink', name: 'Платье миди с воланами', cat: 'dresses', price: 9600, av: 'order', st: s(1, 1, 1, 1, 1), img2: 'linen', colors: [['#f1cfd0', 'пудровый']], fabric: '100% вискоза, принт', season: 'Весна–лето', desc: 'Струящийся силуэт, длинный рукав с манжетой.' },
    { id: 'hoodie-pink', name: 'Худи оверсайз', cat: 'basics', price: 5200, old: 6500, av: 'stock', st: s(0, 2, 3, 2, 1), img2: 'tees', colors: [['#f0a9bd', 'розовый'], ['#9a9a9a', 'серый меланж']], fabric: '80% хлопок, 20% полиэстер, футер с начёсом', season: 'Круглый год', desc: 'Двойной капюшон, карман-кенгуру.' },
    { id: 'shirt-stripe', name: 'Рубашка в полоску, лён', cat: 'shirts', price: 5800, av: 'stock', st: s(1, 2, 2, 1, 0), img2: 'linen', colors: [['#aebfe3', 'голубая полоска']], fabric: '100% лён', season: 'Лето', desc: 'Удлинённая, можно носить с поясом как платье.' },
    { id: 'cardigan-grey', name: 'Кардиган из альпаки', cat: 'knit', price: 11200, av: 'order', st: s(1, 1, 1, 1, 1), img2: 'knitfab', colors: [['#8f8f8f', 'серый'], ['#3b3530', 'кофе']], fabric: '60% альпака, 40% шерсть', season: 'Осень–зима', desc: 'Мужской и женский размерный ряд, шалевый воротник.' },
    { id: 'tees', name: 'Набор футболок, 3 шт.', cat: 'basics', price: 5900, av: 'stock', st: s(2, 3, 3, 3, 2), img2: 'tee-white', colors: [['#3a4a6b', 'синий+серый+белый']], fabric: '100% хлопок, 180 г/м²', season: 'Круглый год', desc: 'Три базовых цвета в одной упаковке — выгоднее на 1 300 ₽.' }
  ];
  P.forEach(function (p, i) { p.order = i; });
  var byId = {};
  P.forEach(function (p) { byId[p.id] = p; });

  var TAILOR_MODELS = [['Пальто прямого кроя', 26000], ['Жакет', 17000], ['Платье-футляр', 12000], ['Брюки палаццо', 9000], ['Костюм-двойка', 32000], ['Рубашка', 7500], ['По референсу', 10000]];
  var FABRICS = [['linen', 'Лён', 0], ['stripefab', 'Хлопок сорочечный', 0], ['knitfab', 'Трикотаж', 1500], ['plaid', 'Шерсть в клетку', 4500], ['jeans', 'Деним', 2000]];
  var TCOLORS = [['#efe9df', 'молочный'], ['#c4a384', 'кэмел'], ['#1f2a3a', 'тёмно-синий'], ['#2b2b2b', 'графит'], ['#6b6b2e', 'олива'], ['#a8502a', 'терракота']];
  var PROMO = { KROYKA10: { pct: 10, text: 'Скидка 10%' }, WELCOME: { minus: 1000, min: 5000, text: 'Скидка 1 000 ₽ на первый заказ' } };

  /* ================================================================ шторка */

  (function curtain() {
    var c = FB.$('#curtain'), seen = false;
    try { seen = sessionStorage.getItem('kr:curtain') === '1'; sessionStorage.setItem('kr:curtain', '1'); } catch (e) {}
    if (FB.reduced || seen) { c.remove(); return; }
    setTimeout(function () { c.classList.add('is-up'); setTimeout(function () { c.remove(); }, 950); }, 650);
  })();

  /* ================================================================ состояние */

  var fav = FB.store.get('fav', []);
  var cart = FB.store.get('cart', []);
  var orders = FB.store.get('orders', []);
  var f = { cat: '', q: '', size: '', stock: false, fav: false, sort: 'new' };

  function saveCart() { FB.store.set('cart', cart); FB.store.set('cartAt', Date.now()); renderBadges(); }
  function cartCount() { return cart.reduce(function (a, i) { return a + i.qty; }, 0); }

  function renderBadges() {
    var n = cartCount(), cc = FB.$('#cartCount');
    cc.textContent = n;
    if (FB.anime && !FB.reduced) FB.anime.animate(cc, { scale: [1.5, 1], duration: 450, ease: 'outBack' });
    var fc = FB.$('#favCount');
    fc.hidden = !fav.length;
    fc.textContent = fav.length;
  }

  /* ================================================================ каталог */

  var tabs = FB.$('#catTabs');
  tabs.innerHTML = CATS.map(function (c, i) { return '<button type="button" role="tab" id="cat-' + (c[0] || 'all') + '" aria-controls="grid" aria-selected="' + (i === 0) + '">' + c[1] + '</button>'; }).join('');
  FB.tabs(tabs, function (t) { f.cat = t.id === 'cat-all' ? '' : t.id.slice(4); renderGrid(); });
  FB.$('#sizeFilter').innerHTML = SIZES.map(function (z) { return '<button type="button" aria-pressed="false" data-size="' + z + '">' + z + '</button>'; }).join('');
  FB.$('#sizeFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-size]');
    if (!b) return;
    f.size = f.size === b.getAttribute('data-size') ? '' : b.getAttribute('data-size');
    FB.$$('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-size') === f.size)); });
    renderGrid();
  });
  FB.$('#q').addEventListener('input', FB.debounce(function (e) { f.q = e.target.value.trim().toLowerCase(); renderGrid(); }, 150));
  FB.$('#inStock').addEventListener('change', function (e) { f.stock = e.target.checked; renderGrid(); });
  FB.$('#sort').addEventListener('change', function (e) { f.sort = e.target.value; renderGrid(); });
  FB.$('#favToggle').addEventListener('click', function () {
    f.fav = !f.fav;
    this.setAttribute('aria-pressed', String(f.fav));
    this.setAttribute('aria-label', f.fav ? 'Показать все товары' : 'Показать избранное');
    renderGrid();
    FB.scrollTo('#catalog', { focus: false });
  });

  function hasSize(p, z) { return p.av !== 'stock' || p.st[z] > 0; }
  function inStockAny(p) { return p.av === 'stock' && SIZES.some(function (z) { return p.st[z] > 0; }); }

  function renderGrid() {
    var list = P.filter(function (p) {
      if (f.cat && p.cat !== f.cat) return false;
      if (f.fav && fav.indexOf(p.id) < 0) return false;
      if (f.stock && !(inStockAny(p) && (!f.size || p.st[f.size] > 0))) return false;
      if (f.size && !hasSize(p, f.size)) return false;
      if (f.q) {
        var hay = (p.name + ' ' + p.fabric + ' ' + p.season + ' ' + p.colors.map(function (c) { return c[1]; }).join(' ') + ' ' + AV[p.av][0]).toLowerCase();
        if (f.q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false;
      }
      return true;
    });
    list.sort(function (a, b) { return f.sort === 'asc' ? a.price - b.price : f.sort === 'desc' ? b.price - a.price : a.order - b.order; });
    FB.$('#found').textContent = list.length ? 'Найдено: ' + list.length + ' ' + FB.plural(list.length, ['товар', 'товара', 'товаров']) : '';
    FB.$('#grid').innerHTML = list.length ? list.map(function (p, i) {
      var faved = fav.indexOf(p.id) >= 0;
      return '<article class="card" style="--i:' + i + '">' +
        '<div class="card__media" data-pid="' + p.id + '"><img src="img/' + p.id + '.webp" alt="' + FB.esc(p.name) + '" loading="lazy" width="600" height="750"><img src="img/' + p.img2 + '.webp" alt="" loading="lazy">' +
        (p.old ? '<span class="card__sale">−' + Math.round((1 - p.price / p.old) * 100) + '%</span>' : '') +
        '<button class="card__quick" type="button" data-pid="' + p.id + '">Быстрый просмотр</button></div>' +
        '<button class="card__fav" type="button" data-fav="' + p.id + '" aria-pressed="' + faved + '" aria-label="' + (faved ? 'Убрать из избранного' : 'В избранное') + ': ' + FB.esc(p.name) + '"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg></button>' +
        '<h3 class="card__name"><button type="button" data-pid="' + p.id + '">' + p.name + '</button></h3>' +
        '<div class="tags"><span class="tag ' + AV[p.av][1] + '">' + AV[p.av][0] + '</span><span class="tag">' + p.fabric.split(',')[0].replace(/^\d+% /, '') + '</span><span class="tag">' + p.season + '</span></div>' +
        '<p class="card__price">' + (p.av === 'tailor' ? 'от ' : '') + FB.money(p.price) + (p.old ? '<s>' + FB.money(p.old) + '</s>' : '') + '</p></article>';
    }).join('') : '<p class="empty">' + (f.fav ? 'В избранном пока пусто — нажмите ♡ на карточке.' : 'Ничего не нашли. Попробуйте другой размер или <button class="link" type="button" id="resetF">сбросьте фильтры</button>.') + '</p>';
  }
  FB.$('#grid').addEventListener('click', function (e) {
    if (e.target.id === 'resetF') {
      f = { cat: '', q: '', size: '', stock: false, fav: false, sort: f.sort };
      FB.$('#q').value = ''; FB.$('#inStock').checked = false;
      FB.$$('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      FB.$('#cat-all').click();
      return;
    }
    var fv = e.target.closest('[data-fav]');
    if (fv) {
      var id = fv.getAttribute('data-fav'), i = fav.indexOf(id);
      if (i >= 0) fav.splice(i, 1); else fav.push(id);
      FB.store.set('fav', fav);
      fv.setAttribute('aria-pressed', String(i < 0));
      if (FB.anime && !FB.reduced) FB.anime.animate(fv, { scale: [0.7, 1], duration: 500, ease: 'outBack' });
      renderBadges();
      if (f.fav) renderGrid();
      return;
    }
    var pd = e.target.closest('[data-pid]');
    if (pd) openProduct(pd.getAttribute('data-pid'), pd);
  });

  /* ================================================================ карточка товара */

  var cur = null;
  function openProduct(id, opener) {
    var p = byId[id];
    if (!p) return;
    cur = p;
    var imgs = [p.id, p.img2];
    var firstSize = SIZES.filter(function (z) { return hasSize(p, z) && (p.av !== 'stock' || p.st[z] > 0); })[0];
    var recs = P.filter(function (x) { return x.id !== p.id && x.cat === p.cat; }).concat(P.filter(function (x) { return x.id !== p.id && x.cat !== p.cat; })).slice(0, 4);
    FB.$('#pmBody').innerHTML =
      '<div class="pm__gallery"><div class="pm__main" id="pmMain"><img src="img/' + imgs[0] + '.webp" alt="' + FB.esc(p.name) + '"></div>' +
      '<div class="pm__thumbs">' + imgs.map(function (im, i) { return '<button type="button" data-img="' + im + '" aria-current="' + (i === 0) + '" aria-label="Фото ' + (i + 1) + '"><img src="img/' + im + '.webp" alt=""></button>'; }).join('') + '</div></div>' +
      '<div class="pm__info"><h2 class="pm__title" id="pTitle">' + p.name + '</h2>' +
      '<p class="pm__price">' + (p.av === 'tailor' ? 'от ' : '') + FB.money(p.price) + (p.old ? '<s>' + FB.money(p.old) + '</s>' : '') + '</p>' +
      '<p class="pm__desc">' + p.desc + '</p>' +
      '<div class="opt-row"><span>Цвет: <em id="pmColor">' + p.colors[0][1] + '</em></span><div class="swatches" role="radiogroup" aria-label="Цвет">' + p.colors.map(function (c, i) {
        return '<label><input type="radio" name="pmColor" value="' + c[1] + '"' + (i === 0 ? ' checked' : '') + ' aria-label="' + c[1] + '"><span style="background:' + c[0] + '"></span></label>';
      }).join('') + '</div></div>' +
      '<div class="opt-row"><span>Размер <button class="link" type="button" id="pmSizeHelp">подобрать по меркам</button></span><div class="size-pick" role="radiogroup" aria-label="Размер">' + SIZES.map(function (z) {
        var dis = p.av === 'stock' && !(p.st[z] > 0);
        return '<label><input type="radio" name="pmSize" value="' + z + '"' + (z === firstSize ? ' checked' : '') + '><span' + (dis ? ' title="Нет в наличии — можно заказать привоз"' : '') + '>' + z + '</span></label>';
      }).join('') + '</div></div>' +
      '<p class="pm__avail" id="pmAvail"></p>' +
      '<div class="pm__buy"><button class="btn btn--accent" type="button" id="pmAdd">В корзину</button><button class="icon-btn" type="button" id="pmFav" aria-pressed="' + (fav.indexOf(p.id) >= 0) + '" aria-label="В избранное"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg></button></div>' +
      '<div class="pm__meta"><div><b>Состав:</b> ' + p.fabric + '</div><div><b>Сезон:</b> ' + p.season + '</div><div><b>Доставка:</b> по СПб с примеркой — 390 ₽, бесплатно от 15 000 ₽</div><div><b>Уход:</b> деликатная стирка 30°, не отбеливать</div></div></div>' +
      '<div class="recs"><h3>С этим носят</h3><div class="recs__row">' + recs.map(function (r) {
        return '<button type="button" data-rec="' + r.id + '"><img src="img/' + r.id + '.webp" alt="" loading="lazy"><span>' + r.name + '</span><b>' + FB.money(r.price) + '</b></button>';
      }).join('') + '</div></div>';
    updateAvail();
    if (!FB.$('#product').classList.contains('is-open')) FB.modal.open('product', opener);
    else FB.$('#product .fb-modal__dialog').scrollTop = 0;
    FB.track('view_service', { product: p.id });
  }

  function selSize() { return (FB.$('input[name=pmSize]:checked') || {}).value; }
  function updateAvail() {
    var p = cur, z = selSize(), el = FB.$('#pmAvail'), btn = FB.$('#pmAdd');
    if (!z) { el.textContent = 'Выберите размер'; btn.disabled = true; return; }
    btn.disabled = false;
    el.className = 'pm__avail';
    if (p.av === 'stock' && p.st[z] > 0) { el.innerHTML = '<b>В наличии</b> · ' + (p.st[z] <= 2 ? 'осталось ' + p.st[z] + ' шт. · ' : '') + 'отправим сегодня до 18:00'; btn.textContent = 'В корзину'; }
    else if (p.av === 'tailor') { el.classList.add('order'); el.innerHTML = '<b>Пошив по меркам</b> · 3 недели, мерки уточним после заказа'; btn.textContent = 'Заказать пошив'; }
    else { el.classList.add('order'); el.innerHTML = '<b>' + (p.av === 'order' ? 'Под заказ' : 'Нет в наличии') + '</b> · привезём за 10–14 дней, предоплата 30%'; btn.textContent = 'Заказать привоз'; }
  }

  FB.$('#pmBody').addEventListener('change', function (e) {
    if (e.target.name === 'pmSize') updateAvail();
    if (e.target.name === 'pmColor') FB.$('#pmColor').textContent = e.target.value;
  });
  FB.$('#pmBody').addEventListener('click', function (e) {
    var t = e.target;
    var th = t.closest('[data-img]');
    if (th) {
      FB.$('#pmMain img').src = 'img/' + th.getAttribute('data-img') + '.webp';
      FB.$$('[data-img]').forEach(function (x) { x.setAttribute('aria-current', String(x === th)); });
      return;
    }
    var main = t.closest('#pmMain');
    if (main) {
      var r = main.getBoundingClientRect();
      main.querySelector('img').style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      main.classList.toggle('is-zoom');
      return;
    }
    if (t.closest('#pmAdd')) { addToCart(cur, selSize(), (FB.$('input[name=pmColor]:checked') || {}).value); return; }
    if (t.closest('#pmFav')) {
      var b = t.closest('#pmFav'), i = fav.indexOf(cur.id);
      if (i >= 0) fav.splice(i, 1); else fav.push(cur.id);
      FB.store.set('fav', fav); b.setAttribute('aria-pressed', String(i < 0)); renderBadges(); renderGrid();
      return;
    }
    if (t.id === 'pmSizeHelp') { FB.modal.open('sizeModal', t); return; }
    var rc = t.closest('[data-rec]');
    if (rc) openProduct(rc.getAttribute('data-rec'));
  });
  FB.$('#pmBody').addEventListener('mousemove', function (e) {
    var main = e.target.closest('#pmMain.is-zoom');
    if (!main) return;
    var r = main.getBoundingClientRect();
    main.querySelector('img').style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
  });

  function addToCart(p, size, color) {
    var pre = p.av !== 'stock' || !(p.st[size] > 0);
    var key = p.id + '|' + size + '|' + color;
    var line = cart.filter(function (l) { return l.key === key; })[0];
    if (line) {
      if (!pre && line.qty >= p.st[size]) { FB.toast('Больше этого размера нет в наличии', 'error'); return; }
      line.qty++;
    } else cart.push({ key: key, id: p.id, size: size, color: color, qty: 1, pre: pre });
    saveCart();
    FB.toast('«' + p.name + '», ' + size + ' — в корзине', 'ok');
    FB.track('add_to_cart', { id: p.id, size: size, pre: pre });
  }

  /* ================================================================ корзина и оформление */

  var promo = null, delivery = 'courier';
  var DELIV = { courier: ['Курьер по СПб с примеркой', 390], cdek: ['СДЭК до пункта выдачи', 350], pickup: ['Самовывоз из шоурума', 0] };
  function totals() {
    var sub = cart.reduce(function (a, l) { var p = byId[l.id]; return a + (p ? p.price * l.qty : 0); }, 0);
    var disc = 0;
    if (promo && promo.pct) disc = Math.round(sub * promo.pct / 100);
    if (promo && promo.minus && sub >= (promo.min || 0)) disc = promo.minus;
    var dCost = delivery === 'pickup' ? 0 : (sub - disc >= 15000 && delivery === 'courier' ? 0 : DELIV[delivery][1]);
    var pre = cart.some(function (l) { return l.pre; });
    return { sub: sub, disc: disc, deliv: dCost, total: sub - disc + dCost, pre: pre, prepay: pre ? Math.round((sub - disc) * 0.3) : 0 };
  }

  function renderCart() {
    var body = FB.$('#cartBody');
    if (!cart.length) {
      body.innerHTML = '<p class="hint">Корзина пуста. Посмотрите <a class="link" href="#catalog" data-close>каталог</a> или закажите <a class="link" href="#tailor" data-close>пошив по меркам</a>.</p>';
      return;
    }
    var t = totals();
    body.innerHTML = '<ul class="ci-list" role="list">' + cart.map(function (l, i) {
      var p = byId[l.id];
      return '<li class="ci"><img src="img/' + p.id + '.webp" alt=""><div><div class="ci__name">' + p.name + '</div><div class="ci__meta">' + l.size + ' · ' + FB.esc(l.color) + (l.pre ? ' · привоз 10–14 дней' : ' · в наличии') + '</div>' +
        '<div class="ci__qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Меньше">−</button><span>' + l.qty + '</span><button type="button" data-q="1" data-i="' + i + '" aria-label="Больше">+</button></div> ' +
        '<button class="ci__rm" type="button" data-rm="' + i + '">Удалить</button></div><div class="ci__price">' + FB.money(p.price * l.qty) + '</div></li>';
    }).join('') + '</ul>' +
      '<div class="promo"><label class="sr-only" for="promoIn">Промокод</label><input id="promoIn" placeholder="Промокод" value="' + (promo ? FB.esc(promo.code) : '') + '"><button class="btn btn--line btn--sm" type="button" id="promoBtn">Применить</button></div><p class="promo-msg" id="promoMsg">' + (promo ? promo.text : '') + '</p>' +
      '<div class="sum-rows"><div><span>Товары</span><span>' + FB.money(t.sub) + '</span></div>' + (t.disc ? '<div><span>Скидка</span><span>−' + FB.money(t.disc) + '</span></div>' : '') +
      '<div><span>Доставка</span><span>' + (t.deliv ? FB.money(t.deliv) : 'бесплатно') + '</span></div><div class="total"><span>Итого</span><span>' + FB.money(t.total) + '</span></div>' +
      (t.pre ? '<div class="hint"><span>Предоплата за привоз/пошив 30%</span><span>' + FB.money(t.prepay) + '</span></div>' : '') + '</div>' +
      '<form class="checkout" id="checkout"><h3>Доставка</h3><div class="radio-list" role="radiogroup" aria-label="Способ доставки">' + Object.keys(DELIV).map(function (k) {
        return '<label><input type="radio" name="delivery" value="' + k + '"' + (k === delivery ? ' checked' : '') + '><span>' + DELIV[k][0] + '</span><em>' + (k === 'pickup' ? '0 ₽' : k === 'courier' ? '390 ₽, от 15 000 — 0' : 'от 350 ₽') + '</em></label>';
      }).join('') + '</div>' +
      '<div class="grid2"><div class="field" data-field><label for="cName">Имя</label><input id="cName" name="name" autocomplete="name" data-validate="required name"></div>' +
      '<div class="field" data-field><label for="cPhone">Телефон</label><input id="cPhone" name="phone" type="tel" data-validate="required phone"></div></div>' +
      (delivery === 'pickup' ? '' : '<div class="field" data-field><label for="cAddr">' + (delivery === 'cdek' ? 'Город и адрес пункта СДЭК' : 'Адрес доставки') + '</label><input id="cAddr" name="address" autocomplete="street-address" data-validate="required min:5" data-msg="Укажите адрес"></div>') +
      '<div class="radio-list" role="radiogroup" aria-label="Оплата"><label><input type="radio" name="payment" value="online" checked><span>Онлайн картой или СБП — пришлём ссылку</span></label><label><input type="radio" name="payment" value="receive"' + (t.pre ? ' disabled' : '') + '><span>При получении' + (t.pre ? ' (недоступно для привоза)' : '') + '</span></label></div>' +
      '<label class="check"><input type="checkbox" name="consent" value="yes" data-validate="required"><span>Согласна(ен) с <a href="../_shared/privacy.html?site=Кройка" target="_blank" rel="noopener">политикой</a> и условиями возврата</span></label>' +
      '<p class="form__error" data-form-error role="alert"></p><button class="btn btn--accent btn--wide" type="submit">Оформить заказ · ' + FB.money(t.total) + '</button></form>';
    var saved = FB.store.get('buyer', {});
    var ck = FB.$('#checkout');
    if (saved.name) ck.name.value = saved.name;
    if (saved.phone) ck.phone.value = saved.phone;
    if (saved.address && ck.address) ck.address.value = saved.address;
    FB.form(ck, {
      type: 'order',
      collect: function (fd) {
        var t2 = totals();
        return {
          service: cart.map(function (l) { return byId[l.id].name + ' ' + l.size + ' ' + l.color + ' ×' + l.qty; }).join('; '),
          total: FB.money(t2.total),
          items: cart.map(function (l) { return { id: l.id, size: l.size, color: l.color, qty: l.qty, preorder: l.pre }; }),
          details: { 'Доставка': DELIV[delivery][0] + (t2.deliv ? ' (' + FB.money(t2.deliv) + ')' : ''), 'Оплата': fd.get('payment') === 'online' ? 'онлайн, выслать ссылку' : 'при получении', 'Промокод': promo ? promo.code : '—', 'Предоплата': t2.pre ? FB.money(t2.prepay) : '—' }
        };
      },
      success: function (res, p) {
        FB.store.set('buyer', { name: p.name, phone: p.phone, address: p.address || '' });
        var t2 = totals();
        orders.unshift({ id: res.id, at: new Date().toISOString(), total: t2.total, items: cart.length });
        FB.store.set('orders', orders.slice(0, 10));
        FB.track('start_payment', { id: res.id, total: t2.total });
        var bought = cart.map(function (l) { return l.id; });
        cart = []; promo = null; saveCart();
        var recs = P.filter(function (x) { return bought.indexOf(x.id) < 0 && x.av === 'stock'; }).slice(0, 4);
        FB.$('#cartBody').innerHTML = '<div class="order-done"><p class="hint">Заказ оформлен</p><div class="num">' + FB.esc(res.id) + '</div>' +
          '<p>' + (p.payment === 'online' ? 'Ссылка на оплату придёт SMS и в Telegram в течение 15 минут.' : 'Оплатите при получении.') + ' Статус заказа — по номеру в разделе «Статус».</p>' +
          '<button class="btn btn--accent" type="button" data-open="statusModal">Статус заказа</button></div>' +
          '<div class="recs" style="padding:0;border:0"><h3>Вам может понравиться</h3><div class="recs__row" style="grid-template-columns:1fr 1fr">' + recs.map(function (r) {
            return '<button type="button" data-open-p="' + r.id + '"><img src="img/' + r.id + '.webp" alt=""><span>' + r.name + '</span><b>' + FB.money(r.price) + '</b></button>';
          }).join('') + '</div></div>';
      }
    });
  }
  FB.$('#cartBtn').addEventListener('click', function () { renderCart(); FB.modal.open('cart', this); FB.track('view_cart', { n: cartCount() }); });
  FB.$('#cartBody').addEventListener('click', function (e) {
    var t = e.target;
    var q = t.closest('[data-q]');
    if (q) {
      var l = cart[+q.getAttribute('data-i')], p = byId[l.id], d = +q.getAttribute('data-q');
      if (d > 0 && !l.pre && l.qty >= p.st[l.size]) { FB.toast('Больше этого размера нет в наличии', 'error'); return; }
      l.qty += d;
      if (l.qty <= 0) cart.splice(+q.getAttribute('data-i'), 1);
      saveCart(); renderCart();
      return;
    }
    var rm = t.closest('[data-rm]');
    if (rm) { cart.splice(+rm.getAttribute('data-rm'), 1); saveCart(); renderCart(); return; }
    if (t.id === 'promoBtn') {
      var code = FB.$('#promoIn').value.trim().toUpperCase(), pr = PROMO[code];
      if (pr && pr.min && totals().sub < pr.min) { FB.$('#promoMsg').textContent = 'Промокод действует от ' + FB.money(pr.min); FB.$('#promoMsg').classList.add('bad'); return; }
      promo = pr ? Object.assign({ code: code }, pr) : null;
      if (!pr) { FB.$('#promoMsg').textContent = code ? 'Такого промокода нет' : ''; FB.$('#promoMsg').classList.add('bad'); return; }
      renderCart();
      return;
    }
    var op = t.closest('[data-open-p]');
    if (op) { FB.modal.close(true); openProduct(op.getAttribute('data-open-p')); }
  });
  FB.$('#cartBody').addEventListener('change', function (e) {
    if (e.target.name === 'delivery') {
      var ck = FB.$('#checkout'), keep = { name: ck.name.value, phone: ck.phone.value, address: ck.address ? ck.address.value : '' };
      delivery = e.target.value;
      renderCart();
      ck = FB.$('#checkout'); ck.name.value = keep.name; ck.phone.value = keep.phone; if (ck.address) ck.address.value = keep.address;
    }
  });

  // брошенная корзина: напоминаем при возвращении
  (function abandoned() {
    var at = FB.store.get('cartAt', 0);
    if (cart.length && at && Date.now() - at > 30 * 60 * 1000) {
      setTimeout(function () { FB.toast('В корзине осталось ' + cartCount() + ' ' + FB.plural(cartCount(), ['вещь', 'вещи', 'вещей']) + ' — оформим?', '', 6000); }, 1800);
    }
  })();

  /* ================================================================ подбор размера */

  FB.$('#sizeTable').insertAdjacentHTML('beforeend', '<thead><tr><th scope="col">Размер</th><th scope="col">RU</th><th scope="col">Грудь</th><th scope="col">Талия</th><th scope="col">Бёдра</th></tr></thead><tbody>' +
    SIZE_TABLE.map(function (r) { return '<tr data-z="' + r[0] + '"><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2].join('–') + '</td><td>' + r[3].join('–') + '</td><td>' + r[4].join('–') + '</td></tr>'; }).join('') + '</tbody>');
  function recommend(c, w, h) {
    if (!c && !w && !h) return null;
    for (var i = 0; i < SIZE_TABLE.length; i++) {
      var r = SIZE_TABLE[i];
      if ((!c || c <= r[2][1]) && (!w || w <= r[3][1]) && (!h || h <= r[4][1])) return r;
    }
    return 'big';
  }
  function num(id) { return parseInt(FB.$(id).value, 10) || 0; }
  function sizeCalc() {
    var r = recommend(num('#scC'), num('#scW'), num('#scH')), out = FB.$('#scOut');
    FB.$$('#sizeTable tr[data-z]').forEach(function (tr) { tr.classList.toggle('is-hit', r && r[0] === tr.getAttribute('data-z')); });
    if (!r) out.textContent = 'Введите обхваты — подскажем размер.';
    else if (r === 'big') out.innerHTML = 'Ваши мерки больше нашей сетки — <a class="link" href="#tailor" data-close>сошьём по меркам</a>.';
    else out.innerHTML = 'Ваш размер: <b>' + r[0] + '</b> (RU ' + r[1] + '). Если между размерами — берите больший для верхней одежды.';
  }
  ['#scC', '#scW', '#scH'].forEach(function (id) { FB.$(id).addEventListener('input', sizeCalc); });

  /* ================================================================ пошив */

  var tf = FB.$('#tailorForm');
  FB.$('#tModel').innerHTML = '<option value="">Выберите модель</option>' + TAILOR_MODELS.map(function (m) { return '<option value="' + m[0] + '">' + m[0] + ' — от ' + FB.money(m[1]) + '</option>'; }).join('');
  FB.$('#fabrics').innerHTML = FABRICS.map(function (fb, i) {
    return '<label><input type="radio" name="fabric" value="' + fb[1] + '"' + (i === 0 ? ' checked' : '') + '><span><img src="img/' + fb[0] + '.webp" alt="" loading="lazy">' + fb[1] + '<small>' + (fb[2] ? '+' + FB.money(fb[2]) : 'включено') + '</small></span></label>';
  }).join('');
  FB.$('#tColors').innerHTML = TCOLORS.map(function (c, i) {
    return '<label><input type="radio" name="color" value="' + c[1] + '"' + (i === 0 ? ' checked' : '') + ' aria-label="' + c[1] + '"><span style="background:' + c[0] + '"></span></label>';
  }).join('');
  var dl = FB.$('#tDate');
  dl.min = FB.iso(FB.addDays(FB.today(), 7));
  function tailorCalc() {
    var m = TAILOR_MODELS.filter(function (x) { return x[0] === tf.model.value; })[0];
    var fab = FABRICS.filter(function (x) { return x[1] === (FB.$('input[name=fabric]:checked', tf) || {}).value; })[0];
    FB.$('#tPrice').textContent = m ? 'от ' + FB.money(m[1] + (fab ? fab[2] : 0)) : '—';
    var term = 'Срок — 21 день, две примерки.';
    if (dl.value) {
      var days = Math.round((FB.parseIso(dl.value) - FB.today()) / 864e5);
      term = days < 21 ? 'К ' + FB.fmtDate(dl.value) + ' успеем только срочно (+30%) — уточним возможность.' : 'Успеваем к ' + FB.fmtDate(dl.value) + '. ' + term;
    }
    FB.$('#tTerm').textContent = term;
    var r = recommend(num('#mC'), num('#mW'), num('#mHip'));
    FB.$('#sizeHint').textContent = r && r !== 'big' ? 'По меркам вы ближе к размеру ' + r[0] + ' (RU ' + r[1] + ') — закройщица учтёт посадку.' : r === 'big' ? 'Построим лекало индивидуально.' : '';
  }
  tf.addEventListener('input', tailorCalc);
  tf.addEventListener('change', tailorCalc);
  FB.files(FB.$('#tFiles'), { max: 5, maxSize: 10 * 1024 * 1024, list: FB.$('#tFileList') });
  FB.form(tf, {
    type: 'tailoring',
    collect: function (fd) {
      return {
        service: 'Пошив: ' + fd.get('model'), total: FB.$('#tPrice').textContent, date: fd.get('deadline') || '',
        details: { 'Ткань': fd.get('fabric'), 'Цвет': fd.get('color'), 'Мерки (рост/грудь/талия/бёдра/рукав/длина)': [fd.get('height'), fd.get('chest'), fd.get('waist'), fd.get('hips'), fd.get('sleeve') || '—', fd.get('length') || '—'].join(' / ') }
      };
    },
    success: function (res) {
      orders.unshift({ id: res.id, at: new Date().toISOString(), total: 0, items: 1, tailor: true });
      FB.store.set('orders', orders.slice(0, 10));
      tf.hidden = true;
      var d = FB.$('#tailorDone');
      d.hidden = false;
      d.innerHTML = '<p class="hint">Заявка на пошив</p><div class="num">' + FB.esc(res.id) + '</div><p>Закройщица позвонит в течение рабочего дня, уточнит детали и пришлёт эскиз. Предоплата — только после согласования.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn--accent" target="_blank" rel="noopener" href="' + FB.tgLink('Заявка на пошив ' + res.id) + '">Написать в Telegram</a><button class="btn btn--line" type="button" id="tAgain">Ещё одна заявка</button></div>';
      FB.scrollTo(d, { focus: false });
    }
  });
  FB.$('#tailorDone').addEventListener('click', function (e) { if (e.target.id === 'tAgain') { FB.$('#tailorDone').hidden = true; tf.hidden = false; } });

  /* ================================================================ статус заказа */

  var ST = [['new', 'Заказ принят'], ['qualified', 'Подтверждён'], ['in_work', 'Собираем / шьём'], ['shipped', 'Передан в доставку'], ['done', 'Получен']];
  function checkStatus(id) {
    var out = FB.$('#stOut');
    out.innerHTML = '<p class="hint">Ищем заказ…</p>';
    FB.lead.status(id).then(function (r) {
      if (!r || !r.ok) { out.innerHTML = '<p class="size-result">Заказ ' + FB.esc(id.toUpperCase()) + ' не найден. Проверьте номер или напишите нам.</p>'; return; }
      var i = Math.max(0, ST.map(function (x) { return x[0]; }).indexOf(r.status === 'confirmed' ? 'qualified' : r.status === 'repeat' ? 'done' : r.status));
      out.innerHTML = r.status === 'canceled' ? '<p class="size-result">Заказ ' + FB.esc(r.id) + ' отменён.</p>' :
        '<ol class="steps">' + ST.map(function (s, k) { return '<li class="' + (k < i || (k === i && k === 4) ? 'done' : k === i ? 'now' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>' +
        (!FB.lead.isServer() ? '<p class="hint" style="margin-top:12px">Демо-режим: статусы меняются в CRM-панели при запуске через сервер.</p>' : '');
    });
  }
  FB.$('#stForm').addEventListener('submit', function (e) { e.preventDefault(); checkStatus(FB.$('#stId').value.trim()); });
  FB.$('#statusModal').addEventListener('fb:open', function () {
    FB.$('#myOrders').innerHTML = orders.length ? '<ul class="orders" role="list">' + orders.slice(0, 5).map(function (o) {
      return '<li><span><b>' + FB.esc(o.id) + '</b> · ' + FB.fmtDate(o.at.slice(0, 10), { day: 'numeric', month: 'short' }) + (o.tailor ? ' · пошив' : ' · ' + FB.money(o.total)) + '</span><button class="link" type="button" data-st="' + FB.esc(o.id) + '">статус</button></li>';
    }).join('') + '</ul>' : '';
    if (orders[0]) { FB.$('#stId').value = orders[0].id; checkStatus(orders[0].id); }
  });
  FB.$('#myOrders').addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (b) { FB.$('#stId').value = b.getAttribute('data-st'); checkStatus(b.getAttribute('data-st')); } });

  /* ================================================================ старт */

  renderGrid();
  renderBadges();
  tailorCalc();
})();
