/**
 * Forestbyte niches — сервер заявок (Node.js 18+, без зависимостей).
 *
 * Что делает:
 *   • раздаёт все сайты из sites/niches/ (http://localhost:8080/fitness/ и т.д.);
 *   • POST /api/lead           — принимает заявку (JSON, файлы base64), сохраняет в data/leads.json,
 *                                 файлы — в data/uploads/<id>/, шлёт уведомление в Telegram,
 *                                 при наличии ключей — создаёт лид в Bitrix24 / amoCRM;
 *   • GET  /api/busy           — занятые слоты (мастер/бокс/врач) на дату;
 *   • GET  /api/lead/:id       — публичный статус заявки/заказа (без личных данных);
 *   • GET  /api/leads          — список заявок для CRM-панели (Bearer ADMIN_TOKEN);
 *   • PATCH /api/leads/:id     — сменить статус / дату следующего контакта / комментарий;
 *   • GET  /api/files/:id/:name — вложение заявки (только с токеном).
 *
 * Запуск:  node server.mjs            (настройки — в .env рядом, см. .env.example)
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // sites/niches
const DATA = path.join(__dirname, 'data');

/* ---------- .env без зависимостей ---------- */
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env необязателен */ }

const PORT = +process.env.PORT || 8080;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const MAX_BODY = 25 * 1024 * 1024; // 25 МБ с учётом base64
const STATUSES = ['new', 'qualified', 'confirmed', 'in_work', 'shipped', 'done', 'repeat', 'canceled'];

await fsp.mkdir(path.join(DATA, 'uploads'), { recursive: true });
const LEADS_FILE = path.join(DATA, 'leads.json');

/* ---------- хранилище: JSON-файл с атомарной записью и очередью ---------- */
let leads = [];
try { leads = JSON.parse(await fsp.readFile(LEADS_FILE, 'utf8')); } catch { leads = []; }
let writing = Promise.resolve();
function persist() {
  writing = writing.then(async () => {
    const tmp = LEADS_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(leads, null, 1));
    await fsp.rename(tmp, LEADS_FILE);
  }).catch((e) => console.error('[store]', e));
  return writing;
}

/* ---------- CRM-адаптеры (подключаются, только если заданы ключи) ---------- */
const crms = [];
if (process.env.BITRIX24_WEBHOOK) {
  const { Bitrix24 } = await import('../../integrations/crm/bitrix24/bitrix24.js');
  crms.push(['Bitrix24', new Bitrix24(process.env.BITRIX24_WEBHOOK)]);
}
if (process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_TOKEN) {
  const { AmoCRM } = await import('../../integrations/crm/amocrm/amocrm.js');
  crms.push(['amoCRM', new AmoCRM(process.env.AMOCRM_SUBDOMAIN, process.env.AMOCRM_TOKEN)]);
}

/* ---------- утилиты ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
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
const authed = (req) => ADMIN_TOKEN && (req.headers.authorization || '') === 'Bearer ' + ADMIN_TOKEN;

/* ---------- анти-спам: не больше 8 заявок в 10 минут с одного IP ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8;
}
setInterval(() => { const now = Date.now(); for (const [ip, a] of hits) if (a.every((t) => now - t > 600000)) hits.delete(ip); }, 600000).unref();

/* ---------- Telegram ---------- */
const LABELS = {
  name: 'Имя', phone: 'Телефон', contact: 'Контакт', email: 'E-mail', service: 'Услуга', services: 'Услуги',
  resource: 'Специалист/ресурс', master: 'Мастер', date: 'Дата', time: 'Время', address: 'Адрес', total: 'Сумма',
  comment: 'Комментарий', pet: 'Питомец', car: 'Автомобиль', guests: 'Гостей', format: 'Формат', branch: 'Филиал'
};
// подписи для дополнительных полей (details) в уведомлении
const EXTRA_LABELS = {
  payment: 'Оплата', prepayAmount: 'Предоплата', notify: 'Подтверждение', telegram: 'Telegram', duration: 'Длительность, мин',
  discount: 'Скидка', firstVisit: 'Первый визит', repeat: 'Повторная запись', oldId: 'Перенос записи', orderId: 'Номер записи',
  late: 'Поздняя отмена', segments: 'План визита', when: 'Когда удобно', part: 'Время суток', amount: 'Номинал',
  recipient: 'Кому', from: 'От кого', message: 'Пожелание', delivery: 'Вручение', recipientEmail: 'Почта получателя',
  sendDate: 'Дата отправки', plan: 'Абонемент / план', design: 'Оформление', policy: 'С правилами отмены', branchId: 'Код филиала'
};
function detailText(v) {
  if (Array.isArray(v)) return str(v.map((x) => (x && typeof x === 'object' ? Object.values(x).map((y) => (Array.isArray(y) ? y.join(', ') : y)).join(' · ') : x)).join('; '), 600);
  if (v && typeof v === 'object') return str(Object.entries(v).map(([a, b]) => a + ': ' + b).join(', '), 600);
  return str(v, 300);
}
function tgText(lead) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = [`<b>🆕 ${esc(lead.siteName || lead.site)} — заявка ${lead.id}</b>`, `Тип: ${esc(lead.type)}`];
  for (const [k, label] of Object.entries(LABELS)) if (lead[k]) lines.push(`${label}: ${esc(str(lead[k], 300))}`);
  if (lead.details) for (const [k, v] of Object.entries(lead.details)) lines.push(`${esc(EXTRA_LABELS[k] || k)}: ${esc(detailText(v))}`);
  if (lead.files?.length) lines.push(`Файлов: ${lead.files.length}`);
  const utm = lead.utm && Object.entries(lead.utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ');
  if (utm) lines.push(`Источник: ${esc(utm)}`);
  return lines.join('\n');
}
async function tg(method, body, isForm) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) console.error('[telegram]', method, r.status, await r.text());
}
async function notify(lead, fileBufs) {
  try {
    await tg('sendMessage', { chat_id: TG_CHAT, text: tgText(lead), parse_mode: 'HTML', disable_web_page_preview: true });
    for (const f of fileBufs.slice(0, 5)) {
      const fd = new FormData();
      fd.append('chat_id', TG_CHAT);
      fd.append('caption', `${lead.id}: ${f.name}`);
      fd.append('document', new Blob([f.buf], { type: f.type || 'application/octet-stream' }), f.name);
      await tg('sendDocument', fd, true);
    }
  } catch (e) { console.error('[telegram]', e.message); }
  for (const [name, crm] of crms) {
    try {
      const r = await crm.createLead({
        title: `${lead.siteName || lead.site}: ${lead.service || lead.type} (${lead.id})`,
        name: lead.name, phone: lead.phone || lead.contact, email: lead.email, comment: tgText(lead).replace(/<[^>]+>/g, '')
      });
      if (!r.ok) console.error(`[${name}]`, r.error);
    } catch (e) { console.error(`[${name}]`, e.message); }
  }
}

/* ---------- обработчики API ---------- */
async function createLead(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'Слишком много заявок подряд, попробуйте через несколько минут' });
  let data;
  try { data = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.code || 400, { ok: false, error: e.code ? e.message : 'Некорректные данные' }); }
  if (data.website) return send(res, 200, { ok: true, id: 'OK' }); // honeypot

  const phoneDigits = str(data.phone).replace(/\D/g, '');
  const contact = str(data.contact || data.telegram);
  if (phoneDigits.length < 11 && !/^@?[A-Za-z0-9_]{4,32}$/.test(contact) && !/@/.test(str(data.email))) {
    return send(res, 422, { ok: false, error: 'Укажите телефон или другой способ связи' });
  }

  const site = str(data.site, 40).replace(/[^a-z0-9-]/gi, '') || 'site';
  const seq = leads.filter((l) => l.site === site).length + 1001;
  const id = `${(str(data.prefix, 4) || site.slice(0, 2)).toUpperCase()}-${seq}`;

  // вложения: проверка типа и размера, запись на диск
  const fileBufs = [];
  const allowed = /^(image\/(jpeg|png|webp|heic|heif|gif)|video\/(mp4|quicktime|webm)|application\/pdf|audio\/(webm|ogg|mpeg|mp4|wav))$/;
  for (const f of (Array.isArray(data.files) ? data.files : []).slice(0, 8)) {
    if (!f || !f.data || !allowed.test(str(f.type, 60))) continue;
    const buf = Buffer.from(String(f.data), 'base64');
    if (buf.length > 12 * 1024 * 1024) continue;
    fileBufs.push({ name: safeName(f.name), type: str(f.type, 60), buf });
  }
  if (fileBufs.length) {
    const dir = path.join(DATA, 'uploads', id);
    await fsp.mkdir(dir, { recursive: true });
    for (const f of fileBufs) await fsp.writeFile(path.join(dir, f.name), f.buf);
  }

  // сохраняем только известные поля и «details» — без произвольного мусора
  const pick = {};
  for (const k of Object.keys(LABELS).concat(['type', 'siteName', 'items', 'extras', 'calc', 'consent', 'reminders'])) {
    if (data[k] != null && data[k] !== '') pick[k] = typeof data[k] === 'object' ? data[k] : str(data[k], 2000);
  }
  // остальные поля формы (оплата, канал подтверждения, план визита…) — в details, чтобы ничего не терялось
  const SYSTEM = new Set(['site', 'prefix', 'page', 'utm', 'createdAt', 'files', 'website', 'id', 'status', 'history', 'ip', 'details']);
  const details = data.details && typeof data.details === 'object' && !Array.isArray(data.details) ? { ...data.details } : {};
  for (const [k, v] of Object.entries(data)) {
    if (pick[k] !== undefined || SYSTEM.has(k) || v == null || v === '' || Object.keys(details).length >= 40) continue;
    if (!/^[\w-]{1,40}$/.test(k)) continue;
    details[k] = typeof v === 'object' ? (JSON.stringify(v).length <= 4000 ? v : str(JSON.stringify(v), 4000)) : str(v, 1000);
  }
  const lead = {
    id, site, ...pick,
    details: Object.keys(details).length ? details : undefined,
    files: fileBufs.map((f) => ({ name: f.name, type: f.type, size: f.buf.length })),
    utm: data.utm && typeof data.utm === 'object' ? data.utm : {},
    page: str(data.page, 200),
    status: 'new',
    history: [{ at: new Date().toISOString(), status: 'new' }],
    nextContact: '',
    note: '',
    createdAt: new Date().toISOString(),
    ip
  };
  leads.push(lead);
  // клиент сам отменил или перенёс запись: закрываем исходную заявку, если совпадает телефон (защита от чужих отмен)
  const refId = lead.type === 'cancel' ? data.orderId : lead.type === 'reschedule' ? data.oldId : null;
  if (refId) {
    const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);
    const orig = leads.find((x) => x.id === String(refId).toUpperCase() && x.site === site);
    if (orig && orig.status !== 'canceled' && digits(orig.phone) && digits(orig.phone) === digits(lead.phone)) {
      orig.status = 'canceled';
      orig.history.push({ at: new Date().toISOString(), status: 'canceled', by: lead.id });
    }
  }
  await persist();
  notify(lead, fileBufs); // не ждём Telegram — клиенту отвечаем сразу
  console.log(`[lead] ${id} ${site} ${lead.type || ''}`);
  send(res, 201, { ok: true, id });
}

function busy(url, res) {
  const site = url.searchParams.get('site'), resource = url.searchParams.get('resource'), date = url.searchParams.get('date');
  const list = leads.filter((l) => l.site === site && l.resource === resource && l.date === date && l.time && l.status !== 'canceled').map((l) => l.time);
  send(res, 200, { ok: true, busy: list });
}

function publicStatus(id, res) {
  const l = leads.find((x) => x.id === id.toUpperCase());
  if (!l) return send(res, 200, { ok: false, error: 'Заявка не найдена' });
  send(res, 200, { ok: true, id: l.id, status: l.status, lead: { type: l.type, service: l.service, date: l.date, time: l.time }, updatedAt: l.history.at(-1).at, history: l.history.map((h) => ({ at: h.at, status: h.status })) });
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
  await persist();
  send(res, 200, { ok: true, lead: l });
}

/* ---------- статика ---------- */
async function serveStatic(url, res) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || file.startsWith(DATA) || file.includes(`${path.sep}server${path.sep}`)) return send(res, 403, 'Forbidden');
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      // no-cache = браузер переспрашивает сервер (правки видны сразу); картинки кэшируем на час
      'Cache-Control': /\.(webp|jpe?g|png|woff2|mp4)$/.test(ext) ? 'public, max-age=3600' : 'no-cache',
      'Last-Modified': st.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff'
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
    if (p === '/api/busy' && req.method === 'GET') return busy(url, res);
    let m;
    if ((m = p.match(/^\/api\/lead\/([A-Za-z0-9-]+)$/)) && req.method === 'GET') return publicStatus(m[1], res);
    if (p.startsWith('/api/leads') || p.startsWith('/api/files')) {
      if (!authed(req)) return send(res, 401, { ok: false, error: ADMIN_TOKEN ? 'Нужен токен' : 'ADMIN_TOKEN не задан в .env' });
      if (p === '/api/leads' && req.method === 'GET') {
        const site = url.searchParams.get('site');
        return send(res, 200, { ok: true, statuses: STATUSES, leads: leads.filter((l) => !site || l.site === site).slice().reverse() });
      }
      if ((m = p.match(/^\/api\/leads\/([A-Za-z0-9-]+)$/)) && req.method === 'PATCH') return await patchLead(m[1], req, res);
      if ((m = p.match(/^\/api\/files\/([A-Za-z0-9-]+)\/(.+)$/)) && req.method === 'GET') {
        const f = path.join(DATA, 'uploads', m[1], safeName(decodeURIComponent(m[2])));
        if (!f.startsWith(path.join(DATA, 'uploads'))) return send(res, 403, 'Forbidden');
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
  console.log(`Сайты:     http://localhost:${PORT}/`);
  console.log(`CRM:       http://localhost:${PORT}/crm/`);
  console.log(`Telegram:  ${TG_TOKEN && TG_CHAT ? 'включён' : 'выключен (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID в .env)'}`);
  console.log(`CRM-адаптеры: ${crms.map((c) => c[0]).join(', ') || 'нет'}`);
});
