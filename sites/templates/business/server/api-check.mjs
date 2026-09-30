/**
 * Проверка API сервера шаблонов. Создаёт тестовые заявки — запускайте на локальном сервере.
 *
 *   node sites/templates/business/server/api-check.mjs http://localhost:8090 <ADMIN_TOKEN>
 *
 * Для проверки лимита частоты каждой группе запросов нужен свой IP: запустите сервер с TRUST_PROXY=1
 * (скрипт подставляет X-Forwarded-For). Без TRUST_PROXY проверка лимита пропускается.
 */
const [base = 'http://localhost:8090', token = ''] = process.argv.slice(2);
let failed = 0, ip = 0;
const nextIp = () => `10.99.0.${++ip}`;

async function post(body, xff = nextIp(), type = 'application/json') {
  const r = await fetch(base + '/api/lead', { method: 'POST', headers: { 'Content-Type': type, 'X-Forwarded-For': xff }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
function check(name, ok, extra = '') {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
}
const lead = (over = {}) => ({ site: 'event-agency', type: 'event_brief', name: 'Анна', phone: '+7 (912) 345-67-89', consent: true, format: 'Конференции', details: { 'Бюджет': 'Бюджет обсуждается' }, ...over });

let r;
r = await post(lead({ consent: undefined }));
check('без согласия — 422', r.status === 422, r.json.error);
r = await post(lead({ site: 'unknown-site' }));
check('неизвестный сайт — 422', r.status === 422, r.json.error);
r = await post(lead({ phone: '', contact: '', email: '' }));
check('без контакта — 422', r.status === 422, r.json.error);
r = await post(lead({ name: '<script>' }));
check('имя с тегом — 422', r.status === 422, r.json.error);
r = await post(lead({ type: 'DROP TABLE' }));
check('неизвестный тип — 422', r.status === 422, r.json.error);
r = await post(lead({ date: '31.12.2026' }));
check('дата не в формате ГГГГ-ММ-ДД — 422', r.status === 422, r.json.error);
r = await post('x', nextIp(), 'text/plain');
check('не JSON — 415', r.status === 415, r.json.error);
r = await post(lead({ website: 'http://spam' }));
check('ловушка для ботов: ответ без сохранения', r.status === 200 && r.json.stored === false);

// корректные заявки по всем сайтам: префикс берётся из config.js, а не из запроса
const sites = [['event-agency', 'EV', 'event_brief'], ['detailing-studio', 'DT', 'detailing_quote'], ['auto-service', 'AS', 'service_request'], ['cosmetology-clinic', 'CS', 'consult_request'], ['beauty-salon', 'BS', 'visit_request']];
const created = {};
for (const [site, prefix, type] of sites) {
  r = await post(lead({ site, type, prefix: 'ZZ', service: 'Проверка API', email: 'test@example.com' }));
  created[site] = r.json.id;
  check(`заявка ${site} сохранена с префиксом ${prefix}`, r.status === 201 && r.json.stored === true && String(r.json.id).startsWith(prefix + '-'), `${r.json.id}, notify=${r.json.notify}`);
}
check('демо-сайт: уведомления не отправляются', r.json.notify === 'skipped-test');

// лимит частоты
const statuses = [];
for (let i = 0; i < 10; i++) statuses.push((await post(lead({ name: 'Лимит' }), '10.99.200.2')).status);
const limited = statuses.includes(429);
if (limited) check('лимит частоты: 429 после серии запросов с одного IP', statuses.indexOf(429) >= 8, statuses.join(' '));
else console.log('– лимит частоты не проверен: сервер не учитывает X-Forwarded-For (TRUST_PROXY не задан)');

// CRM-доступ
let a = await fetch(base + '/api/leads');
check('CRM без токена — 401', a.status === 401);
a = await fetch(base + '/api/leads', { headers: { Authorization: 'Bearer wrong' } });
check('CRM с неверным токеном — 401', a.status === 401);
if (token) {
  a = await fetch(base + '/api/leads', { headers: { Authorization: 'Bearer ' + token } });
  const j = await a.json();
  check('CRM с токеном — 200 и список сайтов', a.status === 200 && Object.keys(j.sites || {}).length === 5, Object.values(j.sites || {}).join(', '));
  for (const [site] of sites) {
    const l = j.leads.find((x) => x.id === created[site]);
    check(`заявка ${created[site]} принадлежит ${site} и помечена тестовой`, l && l.site === site && l.test === true && l.delivery && l.consent?.given === true);
  }
  const bySite = await (await fetch(base + '/api/leads?site=beauty-salon', { headers: { Authorization: 'Bearer ' + token } })).json();
  check('фильтр по сайту не смешивает заявки', bySite.leads.length > 0 && bySite.leads.every((l) => l.site === 'beauty-salon'));
  const p = await fetch(base + '/api/leads/' + created['auto-service'], { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'qualified', note: 'проверка' }) });
  check('смена статуса в CRM', p.status === 200 && (await p.json()).lead.status === 'qualified');
} else console.log('– проверки с токеном пропущены: передайте ADMIN_TOKEN вторым аргументом');

for (const path of ['/server/.env', '/server/server.mjs', '/server/data/leads.json', '/event/.hidden']) {
  const s = (await fetch(base + path)).status;
  check(`закрыт ${path}`, s === 403 || s === 404, String(s));
}
const h = await fetch(base + '/event/');
check('демо-сайт отдаётся с X-Robots-Tag: noindex', /noindex/.test(h.headers.get('x-robots-tag') || ''));

console.log(failed ? `\nОшибок: ${failed}` : '\nВсе проверки API пройдены');
process.exitCode = failed ? 1 : 0;
