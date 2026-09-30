/*!
 * config-check.js — проверка config.js шаблона перед публикацией.
 *
 * В браузере: FB.checkConfig(window.SITE_CONFIG, { production: true }) → { ok, errors, warnings }.
 *   site.js вызывает проверку в режиме production и отключает формы, если есть ошибки.
 * В Node (из корня репозитория):
 *   node sites/templates/business/_shared/config-check.js            — все шаблоны
 *   node sites/templates/business/_shared/config-check.js beauty     — один шаблон
 *   Проверка всегда идёт по правилам production. Код выхода 1, если есть ошибки.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.FB = root.FB || {}; root.FB.checkConfig = api.check; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRICE_KEYS = ['price', 'labor', 'parts']; // поля с объектом цены
  var PLACEHOLDER = /\[[А-ЯЁA-Z0-9 ,.«»\-]{3,}\]/; // [НАЗВАНИЕ], [ТЕЛЕФОН] и т. п.

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function filled(v) { return v != null && String(v).trim() !== '' && !PLACEHOLDER.test(String(v)); }

  /** Обходит конфигурацию и собирает пути с demo: true и с плейсхолдерами [ТАКИМИ]. */
  function scan(node, path, out) {
    if (Array.isArray(node)) { node.forEach(function (v, i) { scan(v, path + '[' + i + ']', out); }); return; }
    if (node && typeof node === 'object') {
      if (node.demo === true) out.demo.push(path || '(корень)');
      Object.keys(node).forEach(function (k) { scan(node[k], path ? path + '.' + k : k, out); });
      return;
    }
    if (typeof node === 'string' && PLACEHOLDER.test(node)) out.placeholders.push(path);
  }

  function check(cfg, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    var err = function (m) { errors.push(m); }, warn = function (m) { warnings.push(m); };
    if (!cfg || typeof cfg !== 'object') return { ok: false, errors: ['window.SITE_CONFIG не найден: проверьте подключение config.js'], warnings: [] };

    var production = opts.production != null ? opts.production : get(cfg, 'meta.mode') === 'production';

    // базовые поля нужны в любом режиме
    if (!/^[a-z0-9-]{2,40}$/.test(get(cfg, 'meta.site') || '')) err('meta.site: латиница, цифры и дефис, 2–40 символов');
    if (!/^[A-Z]{2,4}$/.test(get(cfg, 'meta.prefix') || '')) err('meta.prefix: 2–4 заглавные латинские буквы');
    if (['demo', 'production'].indexOf(get(cfg, 'meta.mode')) < 0) err('meta.mode: укажите "demo" или "production"');
    if (!filled(get(cfg, 'brand.name'))) err('brand.name: укажите название');

    // цены: число вместо текста и без нуля вместо неизвестной цены
    var priceIssues = [];
    (function walkPrices(node, path) {
      if (Array.isArray(node)) { node.forEach(function (v, i) { walkPrices(v, path + '[' + i + ']'); }); return; }
      if (!node || typeof node !== 'object') return;
      PRICE_KEYS.forEach(function (key) {
        var p = node[key];
        if (!p || typeof p !== 'object' || Array.isArray(p) || !('type' in p)) return;
        var t = p.type, at = (path ? path + '.' : '') + key;
        if (['fixed', 'from', 'range', 'request'].indexOf(t) < 0) priceIssues.push(at + '.type');
        else if ((t === 'fixed' || t === 'from') && !(typeof p.value === 'number' && p.value > 0)) priceIssues.push(at + '.value');
        else if (t === 'range' && !(typeof p.min === 'number' && typeof p.max === 'number' && p.min > 0 && p.max >= p.min)) priceIssues.push(at + '.min/max');
      });
      Object.keys(node).forEach(function (k) { if (PRICE_KEYS.indexOf(k) < 0) walkPrices(node[k], path ? path + '.' + k : k); });
    })(cfg, '');
    priceIssues.forEach(function (p) { err(p + ': тип цены fixed/from/range/request, значение — положительное число. Неизвестна цена — type: "request"'); });

    if (!production) return { ok: !errors.length, errors: errors, warnings: warnings, production: false };

    // ---- рабочий режим
    var c = cfg.contacts || {};
    if (!filled(c.phone) && !filled(c.email) && !filled(c.telegram)) err('contacts: нужен хотя бы один способ связи (phone, email или telegram)');
    if (filled(c.phone) && String(c.phone).replace(/\D/g, '').length !== 11) err('contacts.phone: номер в формате +7 (XXX) XXX-XX-XX');
    if (filled(c.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) err('contacts.email: проверьте адрес');
    if (filled(c.telegram) && !/^@?[A-Za-z0-9_]{4,32}$/.test(c.telegram)) err('contacts.telegram: ник без ссылки, 4–32 символа');
    if (!filled(c.city)) warn('contacts.city: город не указан');
    if (!filled(c.address)) warn('contacts.address: адрес не указан — блок адреса скрыт');

    if (!filled(get(cfg, 'integrations.endpoint'))) err('integrations.endpoint: укажите адрес приёма заявок, например "/api/lead"');

    var l = cfg.legal || {};
    ['operator', 'address', 'email', 'site', 'effectiveDate'].forEach(function (k) { if (!filled(l[k])) err('legal.' + k + ': обязательное поле юридических страниц'); });
    if (!/^(\d{10}|\d{12})$/.test(String(l.inn || ''))) err('legal.inn: ИНН — 10 или 12 цифр');
    if (l.approved !== true) err('legal.approved: владелец сайта должен проверить тексты документов и поставить true');
    if ('medicalWarning' in l && !filled(l.medicalLicense)) warn('legal.medicalLicense: для медицинских услуг укажите сведения о лицензии — их проверяет юрист клиники');

    var seo = cfg.seo || {};
    if (!filled(seo.title)) err('seo.title: укажите заголовок страницы');
    if (!filled(seo.description)) err('seo.description: укажите описание страницы');
    if (!filled(seo.canonical)) warn('seo.canonical: адрес сайта не указан');

    var assets = cfg.assets || {};
    Object.keys(assets).forEach(function (id) {
      var a = assets[id];
      if (!filled(a.license) || !filled(a.source)) err('assets.' + id + ': укажите source и license');
      if (!filled(a.alt) && a.role !== 'decor') err('assets.' + id + ': укажите alt');
    });

    (cfg.reviews || []).forEach(function (r, i) {
      if (!filled(r.source)) err('reviews[' + i + '].source: укажите, где опубликован отзыв');
    });

    var found = { demo: [], placeholders: [] };
    scan(cfg, '', found);
    // отметки demo: true группируем по разделу, чтобы список ошибок оставался читаемым
    var groups = {};
    found.demo.forEach(function (p) { var k = p.split(/[.[]/)[0]; (groups[k] = groups[k] || []).push(p); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      err(k + ': осталось отметок demo: true — ' + g.length + (g.length <= 3 ? ' (' + g.join(', ') + ')' : ' (' + g.slice(0, 3).join(', ') + ' …)') + '. Замените примеры данными бизнеса');
    });
    found.placeholders.forEach(function (p) { err(p + ': остался плейсхолдер в квадратных скобках'); });

    return { ok: !errors.length, errors: errors, warnings: warnings, production: true };
  }

  return { check: check };
});

/* ---------------------------------------------------------------- запуск из Node */
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
  var fs = require('fs'), path = require('path'), vm = require('vm');
  var base = path.resolve(__dirname, '..');
  var niches = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; });
  if (!niches.length) niches = fs.readdirSync(base).filter(function (d) { return fs.existsSync(path.join(base, d, 'config.js')); });
  var failed = 0;
  niches.forEach(function (n) {
    var file = path.join(base, n, 'config.js');
    var sandbox = { window: {} };
    try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file }); }
    catch (e) { console.log('✗ ' + n + ': config.js не выполняется — ' + e.message); failed++; return; }
    var r = module.exports.check(sandbox.window.SITE_CONFIG, { production: true });
    console.log((r.ok ? '✓ ' : '✗ ') + n + ' (режим в файле: ' + ((sandbox.window.SITE_CONFIG || {}).meta || {}).mode + ')');
    r.errors.forEach(function (e) { console.log('   ошибка: ' + e); });
    r.warnings.forEach(function (w) { console.log('   предупреждение: ' + w); });
    if (!r.ok) failed++;
  });
  process.exitCode = failed ? 1 : 0;
}
