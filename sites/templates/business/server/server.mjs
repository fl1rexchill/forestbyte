/**
 * Forestbyte business templates — сервер сайтов и заявок (Node.js 18+, без зависимостей).
 * Основа — sites/niches/server/server.mjs. Отличия — в ../REUSE_MAP.md.
 *
 * Запуск из корня репозитория:
 *   node sites/templates/business/server/server.mjs
 * Настройки — server/.env (образец: .env.example). Порт по умолчанию 8090.
 *
 * Что делает:
 *   • раздаёт шаблоны из sites/templates/business/ (http://localhost:8090/event/ и т. д.);
 *   • при старте читает config.js каждого шаблона: список сайтов, префиксы номеров, режим demo/production;
 *   • POST /api/lead        — проверяет и сохраняет заявку в data/leads.json, файлы — в data/uploads/<id>/;
 *                             только после записи на диск отвечает «принято». Уведомления в Telegram
 *                             и CRM уходят после ответа и только для сайтов в режиме production;
 *   • GET  /api/health      — сервер доступен (для CRM-панели);
 *   • GET  /api/leads       — заявки для CRM-панели (Bearer ADMIN_TOKEN);
 *   • PATCH /api/leads/:id  — статус, дата следующего контакта, заметка (Bearer ADMIN_TOKEN);
 *   • GET  /api/files/:id/:name — вложение заявки (Bearer ADMIN_TOKEN).
 * Бронирование (резерв времени) сервер не делает: все формы шаблонов — заявки, запись требует подтверждения.
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // sites/templates/business
const DATA = path.join(__dirname, 'data');

/* ---------- .env без зависимостей ---------- */
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env необязателен */ }

const PORT = +process.env.PORT || 8090;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const MAX_BODY = 25 * 1024 * 1024; // 25 МБ с учётом base64
// X-Forwarded-For учитываем только за своим прокси (nginx и т. п.): иначе клиент подменит IP и обойдёт лимит
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const RATE_LIMIT = Math.max(1, +process.env.RATE_LIMIT || 8); // заявок за 10 минут с одного IP
const STATUSES = ['new', 'qualified', 'confirmed', 'in_work', 'done', 'repeat', 'canceled'];

await fsp.mkdir(path.join(DATA, 'uploads'), { recursive: true });
const LEADS_FILE = path.join(DATA, 'leads.json');

/* ---------- реестр сайтов из config.js ---------- */
const SITES = {}; // site → { dir, prefix, name, mode }
for (const dir of fs.readdirSync(ROOT)) {
  const file = path.join(ROOT, dir, 'config.js');
  if (!fs.existsSync(file)) continue;
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 1000 });
    const c = sandbox.window.SITE_CONFIG || {};
    const site = c.meta?.site, prefix = c.meta?.prefix;
    if (!/^[a-z0-9-]{2,40}$/.test(site || '') || !/^[A-Z]{2,4}$/.test(prefix || '')) { console.error(`[config] ${dir}: неверные meta.site или meta.prefix — сайт пропущен`); continue; }
    if (SITES[site]) { console.error(`[config] ${dir}: meta.site "${site}" уже занят папкой ${SITES[site].dir} — сайт пропущен`); continue; }
    const dup = Object.entries(SITES).find(([, s]) => s.prefix === prefix);
    if (dup) { console.error(`[config] ${dir}: префикс ${prefix} уже у сайта ${dup[0]} — сайт пропущен, иначе номера заявок совпадут`); continue; }
    SITES[site] = { dir, prefix, name: String(c.brand?.name || site), mode: c.meta?.mode === 'production' ? 'production' : 'demo' };
  } catch (e) { console.error(`[config] ${dir}: config.js не выполняется — ${e.message}`); }
}
const DEMO_DIRS = new Set(Object.values(SITES).filter((s) => s.mode !== 'production').map((s) => s.dir));

/* ---------- хранилище: JSON-файл с атомарной записью и очередью ---------- */
let leads = [];
try { leads = JSON.parse(await fsp.readFile(LEADS_FILE, 'utf8')); } catch { leads = []; }
let writing = Promise.resolve();
function persist() {
  // ошибка записи должна дойти до обработчика: без записи на диск клиенту нельзя отвечать «принято»
  const job = writing.then(async () => {
    const tmp = LEADS_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(leads, null, 1));
    await fsp.rename(tmp, LEADS_FILE);
  });
  writing = job.catch((e) => console.error('[store]', e));
  return job;
}

/* ---------- CRM-адаптеры (подключаются, только если заданы ключи) ---------- */
const crms = [];
if (process.env.BITRIX24_WEBHOOK) {
  const { Bitrix24 } = await import('../../../integrations/crm/bitrix24/bitrix24.js');
  crms.push(['bitrix24', new Bitrix24(process.env.BITRIX24_WEBHOOK)]);
}
if (process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_TOKEN) {
  const { AmoCRM } = await import('../../../integrations/crm/amocrm/amocrm.js');
  crms.push(['amocrm', new AmoCRM(process.env.AMOCRM_SUBDOMAIN, process.env.AMOCRM_TOKEN)]);
}
const tgOn = !!(TG_TOKEN && TG_CHAT);

/* ---------- утилиты ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', ...SECURITY, ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Слишком большой запрос'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const str = (v, max = 500) => (v == null ? '' : String(Array.isArray(v) ? v.join(', ') : v)).slice(0, max).trim();
const safeName = (n) => str(n, 120).replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^\.+/, '') || 'file';
function authed(req) {
  if (!ADMIN_TOKEN) return false;
  const got = Buffer.from(req.headers.authorization || ''), want = Buffer.from('Bearer ' + ADMIN_TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* ---------- анти-спам: не больше RATE_LIMIT заявок в 10 минут с одного IP ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [ip, a] of hits) if (a.every((t) => now - t > 600000)) hits.delete(ip); }, 600000).unref();

/* ---------- уведомления ---------- */
const LABELS = {
  name: 'Имя', phone: 'Телефон', contact: 'Контакт', email: 'E-mail', service: 'Услуга', services: 'Услуги',
  resource: 'Специалист', master: 'Мастер', date: 'Желаемая дата', time: 'Желаемое время', address: 'Адрес', total: 'Предварительно',
  comment: 'Комментарий', car: 'Автомобиль', guests: 'Гостей', format: 'Формат', city: 'Город', company: 'Компания'
};
function detailText(v) {
  if (Array.isArray(v)) return str(v.map((x) => (x && typeof x === 'object' ? Object.values(x).join(' · ') : x)).join('; '), 600);
  if (v && typeof v === 'object') return str(Object.entries(v).map(([a, b]) => a + ': ' + b).join(', '), 600);
  return str(v, 300);
}
function tgText(lead) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = [`<b>${esc(lead.siteName || lead.site)} — заявка ${lead.id}</b>`, `Тип: ${esc(lead.type)}`];
  for (const [k, label] of Object.entries(LABELS)) if (lead[k]) lines.push(`${label}: ${esc(str(lead[k], 300))}`);
  if (lead.details) for (const [k, v] of Object.entries(lead.details)) lines.push(`${esc(k)}: ${esc(detailText(v))}`);
  if (lead.files?.length) lines.push(`Файлов: ${lead.files.length}`);
  return lines.join('\n');
}
async function tg(method, body, isForm) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Telegram ${method}: ${r.status}`);
}
/** Доставка во внешние системы. Результат пишется в lead.delivery — CRM-панель показывает его отдельно от статуса заявки. */
async function notify(lead, fileBufs) {
  if (tgOn) {
    try {
      await tg('sendMessage', { chat_id: TG_CHAT, text: tgText(lead), parse_mode: 'HTML', disable_web_page_preview: true });
      for (const f of fileBufs.slice(0, 5)) {
        const fd = new FormData();
        fd.append('chat_id', TG_CHAT);
        fd.append('caption', `${lead.id}: ${f.name}`);
        fd.append('document', new Blob([f.buf], { type: f.type || 'application/octet-stream' }), f.name);
        await tg('sendDocument', fd, true);
      }
      lead.delivery.telegram = 'sent';
    } catch (e) { lead.delivery.telegram = 'failed'; console.error('[telegram]', e.message); }
  }
  for (const [name, crm] of crms) {
    try {
      const r = await crm.createLead({
        title: `${lead.siteName || lead.site}: ${lead.service || lead.type} (${lead.id})`,
        name: lead.name, phone: lead.phone || lead.contact, email: lead.email, comment: tgText(lead).replace(/<[^>]+>/g, '')
      });
      lead.delivery[name] = r.ok ? 'sent' : 'failed';
      if (!r.ok) console.error(`[${name}]`, r.error);
    } catch (e) { lead.delivery[name] = 'failed'; console.error(`[${name}]`, e.message); }
  }
  await persist().catch(() => {});
}

/* ---------- приём заявки ---------- */
const SYSTEM = new Set(['site', 'prefix', 'page', 'utm', 'createdAt', 'files', 'website', 'id', 'status', 'history', 'ip', 'details', 'mode', 'siteName', 'test', 'delivery', 'consent']);
const KNOWN = Object.keys(LABELS).concat(['type', 'items', 'extras', 'calc']);

function validate(data) {
  const site = str(data.site, 40);
  if (!SITES[site]) return 'Неизвестный сайт';
  if (!/^[a-z_]{2,40}$/.test(str(data.type, 40))) return 'Неизвестный тип заявки';
  if (!(data.consent === true || data.consent === 'да')) return 'Нужно согласие на обработку персональных данных';
  const name = str(data.name, 80);
  if (!/^[A-Za-zА-Яа-яЁё\-\s']{2,60}$/.test(name)) return 'Укажите имя: от 2 до 60 букв';
  const phone = str(data.phone, 40).replace(/\D/g, '');
  const contact = str(data.contact, 40), email = str(data.email, 120);
  const okPhone = phone.length === 11;
  const okContact = /^@?[A-Za-z0-9_]{4,32}$/.test(contact) || contact.replace(/\D/g, '').length === 11;
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!okPhone && !okContact && !okEmail) return 'Укажите телефон, Telegram или почту';
  if (email && !okEmail) return 'Проверьте адрес почты';
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(str(data.date, 20))) return 'Неверный формат даты';
  return '';
}

async function createLead(req, res) {
  const ip = ((TRUST_PROXY && req.headers['x-forwarded-for']) || req.socket.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'Слишком много заявок подряд, попробуйте через несколько минут' });
  if (!/application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { ok: false, error: 'Нужен JSON' });
  let data;
  try { data = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.code || 400, { ok: false, error: e.code ? e.message : 'Некорректные данные' }); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, { ok: false, error: 'Некорректные данные' });
  if (data.website) return send(res, 200, { ok: true, id: 'OK', stored: false }); // ловушка для ботов

  const problem = validate(data);
  if (problem) return send(res, 422, { ok: false, error: problem });

  const site = str(data.site, 40), meta = SITES[site];
  const seq = leads.filter((l) => l.site === site).length + 1001;
  const id = `${meta.prefix}-${seq}`;
  const test = meta.mode !== 'production';

  // вложения: проверка типа и размера
  const fileBufs = [];
  const allowed = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
  for (const f of (Array.isArray(data.files) ? data.files : []).slice(0, 5)) {
    if (!f || !f.data || !allowed.test(str(f.type, 60))) continue;
    const buf = Buffer.from(String(f.data), 'base64');
    if (buf.length > 10 * 1024 * 1024) continue;
    fileBufs.push({ name: safeName(f.name), type: str(f.type, 60), buf });
  }

  // объект сохраняем как есть, если он небольшой; большой — обрезанной строкой
  const small = (v, max) => { const j = JSON.stringify(v); return j.length <= max ? JSON.parse(j) : str(j, 2000); };
  const pick = {};
  for (const k of KNOWN) {
    if (data[k] != null && data[k] !== '') pick[k] = typeof data[k] === 'object' ? small(data[k], 8000) : str(data[k], 2000);
  }
  // остальные поля формы — в details, чтобы ничего не терялось
  const details = {};
  if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
    for (const [k, v] of Object.entries(data.details).slice(0, 40)) details[str(k, 60)] = typeof v === 'object' ? str(JSON.stringify(v), 1000) : str(v, 1000);
  }
  for (const [k, v] of Object.entries(data)) {
    if (pick[k] !== undefined || SYSTEM.has(k) || v == null || v === '' || Object.keys(details).length >= 40) continue;
    if (!/^[\w-]{1,40}$/.test(k)) continue;
    details[k] = typeof v === 'object' ? str(JSON.stringify(v), 1000) : str(v, 1000);
  }

  const now = new Date().toISOString();
  const lead = {
    id, site, siteName: meta.name, ...pick,
    details: Object.keys(details).length ? details : undefined,
    consent: { given: true, at: now, page: str(data.page, 200) },
    files: fileBufs.map((f) => ({ name: f.name, type: f.type, size: f.buf.length })),
    utm: data.utm && typeof data.utm === 'object' && !Array.isArray(data.utm)
      ? Object.fromEntries(Object.entries(data.utm).slice(0, 8).map(([k, v]) => [str(k, 30), str(v, 200)])) : {},
    page: str(data.page, 200),
    test,
    status: 'new',
    history: [{ at: now, status: 'new' }],
    delivery: {
      telegram: test ? 'skipped-test' : tgOn ? 'pending' : 'off',
      ...Object.fromEntries(crms.map(([n]) => [n, test ? 'skipped-test' : 'pending']))
    },
    nextContact: '',
    note: '',
    createdAt: now,
    ip
  };

  try {
    if (fileBufs.length) {
      const dir = path.join(DATA, 'uploads', id);
      await fsp.mkdir(dir, { recursive: true });
      for (const f of fileBufs) await fsp.writeFile(path.join(dir, f.name), f.buf);
    }
    leads.push(lead);
    await persist();
  } catch (e) {
    leads = leads.filter((l) => l !== lead);
    console.error('[lead] не удалось сохранить', e);
    return send(res, 500, { ok: false, error: 'Заявка не сохранена из-за ошибки сервера' });
  }

  const external = !test && (tgOn || crms.length);
  if (external) notify(lead, fileBufs); // клиенту отвечаем сразу после записи на диск
  console.log(`[lead] ${id} ${site} ${lead.type}${test ? ' (тестовая, без уведомлений)' : ''}`);
  send(res, 201, { ok: true, id, stored: true, notify: test ? 'skipped-test' : external ? 'queued' : 'off' });
}

async function patchLead(id, req, res) {
  const l = leads.find((x) => x.id === id);
  if (!l) return send(res, 404, { ok: false, error: 'Не найдено' });
  let data; try { data = JSON.parse(await readBody(req)); } catch { return send(res, 400, { ok: false, error: 'Некорректные данные' }); }
  if (data.status && STATUSES.includes(data.status) && data.status !== l.status) {
    l.status = data.status;
    l.history.push({ at: new Date().toISOString(), status: data.status });
  }
  if (data.nextContact !== undefined) l.nextContact = str(data.nextContact, 20);
  if (data.note !== undefined) l.note = str(data.note, 2000);
  try { await persist(); } catch { return send(res, 500, { ok: false, error: 'Не удалось сохранить' }); }
  send(res, 200, { ok: true, lead: l });
}

/* ---------- статика ---------- */
async function serveStatic(url, res) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad Request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const parts = path.relative(ROOT, file).split(path.sep);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return send(res, 403, 'Forbidden');
  if (parts[0] === 'server' || parts.some((p) => p.startsWith('.'))) return send(res, 403, 'Forbidden');
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // no-cache = браузер переспрашивает сервер (правки видны сразу); картинки и шрифты кэшируем на час
      'Cache-Control': /\.(webp|jpe?g|png|woff2)$/.test(ext) ? 'public, max-age=3600' : 'no-cache',
      'Last-Modified': st.mtime.toUTCString(),
      // сайты в демо-режиме и CRM-панель не индексируются
      ...(DEMO_DIRS.has(parts[0]) || parts[0] === 'crm' || parts.length === 1 ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
      ...SECURITY
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Страница не найдена');
  }
}

/* ---------- роутер ---------- */
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/api/lead' && req.method === 'POST') return await createLead(req, res);
    if (p === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
    let m;
    if (p.startsWith('/api/leads') || p.startsWith('/api/files')) {
      if (!authed(req)) return send(res, 401, { ok: false, error: ADMIN_TOKEN ? 'Нужен токен' : 'ADMIN_TOKEN не задан в server/.env — CRM-панель закрыта' });
      if (p === '/api/leads' && req.method === 'GET') {
        const site = url.searchParams.get('site');
        const names = Object.fromEntries(Object.entries(SITES).map(([k, v]) => [k, v.name]));
        return send(res, 200, { ok: true, statuses: STATUSES, sites: names, leads: leads.filter((l) => !site || l.site === site).slice().reverse() });
      }
      if ((m = p.match(/^\/api\/leads\/([A-Za-z0-9-]+)$/)) && req.method === 'PATCH') return await patchLead(m[1], req, res);
      if ((m = p.match(/^\/api\/files\/([A-Za-z0-9-]+)\/(.+)$/)) && req.method === 'GET') {
        const f = path.join(DATA, 'uploads', m[1], safeName(decodeURIComponent(m[2])));
        if (!f.startsWith(path.join(DATA, 'uploads') + path.sep)) return send(res, 403, 'Forbidden');
        return fs.createReadStream(f).on('error', () => send(res, 404, 'Нет файла')).pipe(res);
      }
    }
    if (p.startsWith('/api/')) return send(res, 404, { ok: false, error: 'Нет такого метода' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    return await serveStatic(url, res);
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, error: 'Внутренняя ошибка сервера' });
  }
}).listen(PORT, () => {
  console.log(`Шаблоны:   http://localhost:${PORT}/`);
  for (const [site, s] of Object.entries(SITES)) console.log(`  ${s.dir.padEnd(12)} http://localhost:${PORT}/${s.dir}/  (${site}, ${s.prefix}, ${s.mode})`);
  console.log(`CRM:       http://localhost:${PORT}/crm/  ${ADMIN_TOKEN ? '' : '— закрыта: задайте ADMIN_TOKEN в server/.env'}`);
  console.log(`Telegram:  ${tgOn ? 'настроен (уведомления только для сайтов в режиме production)' : 'не настроен — заявки сохраняются только на сервере'}`);
  console.log(`CRM-адаптеры: ${crms.map((c) => c[0]).join(', ') || 'не настроены'}`);
});
