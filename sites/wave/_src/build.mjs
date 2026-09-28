// Сборка статического сайта WAVE: node _src/build.mjs → public/
// Без зависимостей. Шапка, подвал, SEO-теги и разметка schema.org собираются из одного места.

import { writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, operator, stores, products, benefits, steps, faq } from './data.mjs';
import { illustration, waves } from './illustrations.mjs';
import { privacyBody, consentBody, cookiesBody } from './legal.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = join(SRC, '..', 'public');
const today = new Date().toISOString().slice(0, 10);
const VERSION = Date.now().toString(36); // сброс кэша CSS/JS после каждой сборки

/* ---------------------------------------------------------------- утилиты */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Неразрывные пробелы после коротких слов и перед тире — только в тексте, не в атрибутах
const typo = (s) => esc(s)
  .replace(/(^|[\s(«])([А-ЯЁа-яёA-Za-z]{1,2}|без|для|при|над|под|про|или|все|это|как|что)\s/g, '$1$2 ')
  .replace(/(^|[\s(«])([А-ЯЁа-яёA-Za-z]{1,2})\s/g, '$1$2 ') // второй проход для «в и с…»
  .replace(/\s—/g, ' —')
  .replace(/(\d)\s(мм|₽|%)/g, '$1 $2');

const tel = (p) => '+' + p.replace(/\D/g, '');
const abs = (p) => site.url + p;
const write = (path, html) => {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
};

/* ---------------------------------------------------------------- картинки товаров */

const photoExt = ['.webp', '.jpg', '.jpeg', '.png', '.avif'];
const photos = existsSync(join(SRC, 'photos')) ? readdirSync(join(SRC, 'photos')) : [];

rmSync(join(OUT, 'assets/img/products'), { recursive: true, force: true });
mkdirSync(join(OUT, 'assets/img/products'), { recursive: true });

for (const p of products) {
  const found = photos.find((f) => f.startsWith(p.photo + '.') && photoExt.includes(extname(f).toLowerCase()));
  if (found) {
    const name = p.slug + extname(found).toLowerCase();
    copyFileSync(join(SRC, 'photos', found), join(OUT, 'assets/img/products', name));
    p.img = { src: '/assets/img/products/' + name, w: 1200, h: 1500, photo: true };
  } else {
    writeFileSync(join(OUT, 'assets/img/products', p.slug + '.svg'), illustration(p));
    p.img = { src: '/assets/img/products/' + p.slug + '.svg', w: 800, h: 1000, photo: false };
  }
  p.url = `/mebel/${p.slug}/`;
  p.alt = p.img.photo ? `${p.title}, мебель для ванной WAVE` : `Иллюстрация комплекта ${p.name}: ${p.kind.toLowerCase()}`;
}

/* ---------------------------------------------------------------- куски разметки */

const logo = (tag = 'a') => `<${tag} class="logo"${tag === 'a' ? ' href="/" aria-label="WAVE — на главную"' : ''}>
  <svg class="logo__mark" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 14c5-9 9-9 13 0s8 9 12 0 8-9 11-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
  <span class="logo__word">WAVE</span>
</${tag}>`;

const nav = [
  ['/mebel/', 'Коллекция'],
  ['/#material', 'Материал'],
  ['/#buy', 'Как купить'],
  ['/#faq', 'Вопросы'],
  ['/kontakty/', 'Контакты'],
];

function header(active) {
  const main = stores[0];
  return `<a class="skip-link" href="#main">Перейти к содержанию</a>
<header class="hdr">
  <div class="hdr__in">
    ${logo()}
    <nav class="nav" id="nav" aria-label="Основное меню">
      ${nav.map(([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
      <a class="nav__phone" href="tel:${tel(main.phones[0])}">${main.phones[0]}</a>
    </nav>
    <a class="hdr__phone" href="tel:${tel(main.phones[0])}">${main.phones[0].replace(/ /g, ' ')}</a>
    <a class="btn btn--ink btn--sm hdr__cta" href="${site.catalogPdf}" target="_blank" rel="noopener">Каталог PDF</a>
    <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="Открыть меню"><span></span><span></span></button>
  </div>
</header>`;
}

function footer() {
  return `<footer class="ftr">
  <div class="ftr__wave" aria-hidden="true"><svg viewBox="0 0 1400 200" preserveAspectRatio="none">${waves()}</svg></div>
  <div class="ftr__in">
    <div class="ftr__brand">
      ${logo('p')}
      <p>${typo('Мебель для ванной комнаты из влагостойкого PVC. Производство с 2021 года.')}</p>
      <p>${typo('Официальный дилер в России — компания «Практик», Омск.')}</p>
    </div>
    <div>
      <h2 class="ftr__h">Разделы</h2>
      <ul role="list">
        ${nav.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}
        <li><a href="${site.catalogPdf}" target="_blank" rel="noopener">Каталог PDF</a></li>
      </ul>
    </div>
    <div>
      <h2 class="ftr__h">Коллекция</h2>
      <ul role="list">${products.map((p) => `<li><a href="${p.url}">${esc(p.name)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="ftr__h">Контакты</h2>
      ${stores.map((s) => `<p><span class="ftr__muted">${s.title}</span><br>${esc(s.city)}, ${esc(s.street)}<br><a href="tel:${tel(s.phones[0])}">${s.phones[0]}</a></p>`).join('')}
    </div>
  </div>
  <div class="ftr__legal">
    <p>© <span data-year>${new Date().getFullYear()}</span> WAVE. Сведения на сайте носят справочный характер и не являются публичной офертой: цены и наличие уточняйте у дилера.</p>
    <p class="ftr__docs">
      <a href="/privacy/">Политика обработки персональных данных</a>
      <a href="/soglasie/">Согласие на обработку данных</a>
      <a href="/cookies/">Политика cookie</a>
      <button type="button" data-cookie-settings>Настройки cookie</button>
    </p>
  </div>
</footer>

<div class="cookie" id="cookie" role="dialog" aria-live="polite" aria-label="Использование cookie" hidden>
  <p>${typo('Мы используем необходимые cookie для работы сайта. Аналитические cookie (Яндекс Метрика) включаем только с вашего согласия.')} <a href="/cookies/">Подробнее</a></p>
  <div class="cookie__btns">
    <button class="btn btn--ink btn--sm" type="button" data-cookie="all">Принять все</button>
    <button class="btn btn--line btn--sm" type="button" data-cookie="necessary">Только необходимые</button>
  </div>
</div>

<script>window.WAVE=${JSON.stringify({ metrika: site.yandexMetrikaId, endpoint: site.leadEndpoint, phone: stores[0].phones[0] })}</script>
<script src="/assets/vendor/lenis.min.js?v=1.3.26" defer></script>
<script src="/assets/js/app.js?v=${VERSION}" defer></script>`;
}

function head({ title, description, path, image, noindex, jsonld = [], preload }) {
  const url = abs(path);
  const img = abs(image || '/assets/img/og.png');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
${site.yandexVerification ? `<meta name="yandex-verification" content="${esc(site.yandexVerification)}">\n` : ''}${site.googleVerification ? `<meta name="google-site-verification" content="${esc(site.googleVerification)}">\n` : ''}<meta name="theme-color" content="#f6f3ee">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="WAVE — мебель для ванной">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/cormorant-garamond-cyrillic-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/manrope-cyrillic-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload ? `<link rel="preload" href="${preload}" as="image">\n` : ''}<link rel="stylesheet" href="/assets/css/style.css?v=${VERSION}">
<script>document.documentElement.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion');</script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>`;
}

const page = (opts, body) => `${head(opts)}
${header(opts.active)}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>
`;

function crumbs(items) {
  const list = [['/', 'Главная'], ...items];
  return {
    html: `<nav class="crumbs" aria-label="Хлебные крошки"><ol role="list">${list.map(([h, l], i) => i === list.length - 1
      ? `<li><span aria-current="page">${esc(l)}</span></li>`
      : `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ol></nav>`,
    ld: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: list.map(([h, l], i) => ({ '@type': 'ListItem', position: i + 1, name: l, item: abs(h) })),
    },
  };
}

const productImg = (p, { eager = false, sizes = '(max-width: 700px) 100vw, 50vw', cls = '' } = {}) =>
  `<img class="${cls}" src="${p.img.src}" width="${p.img.w}" height="${p.img.h}" alt="${esc(p.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" sizes="${sizes}">`;

function productCard(p, i) {
  return `<article class="pcard" data-reveal style="--d:${(i % 2) * 120}ms">
    <a class="pcard__img" href="${p.url}" tabindex="-1" aria-hidden="true">${productImg(p)}</a>
    <div class="pcard__b">
      <p class="pcard__kind">${typo(p.kind)}</p>
      <h3 class="pcard__name"><a href="${p.url}">${esc(p.name)}</a></h3>
      <p class="pcard__text">${typo(p.short)}</p>
      <a class="link-arrow" href="${p.url}" aria-label="Подробнее о комплекте ${esc(p.name)}">Подробнее <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function leadForm(preset = '') {
  return `<form class="lform" id="lead" action="${site.leadEndpoint}" method="post" novalidate>
    <div class="lform__row">
      <div class="field"><label for="f-name">Имя</label><input id="f-name" type="text" name="name" autocomplete="given-name" required maxlength="80" aria-describedby="e-name"><span class="field__err" id="e-name"></span></div>
      <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 (___) ___-__-__" aria-describedby="e-phone"><span class="field__err" id="e-phone"></span></div>
    </div>
    <div class="field"><label for="f-model">Комплект <span class="opt">необязательно</span></label>
      <select id="f-model" name="model"><option value="">Нужна помощь с выбором</option>${products.map((p) => `<option${p.name === preset ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="f-msg">Вопрос <span class="opt">необязательно</span></label><textarea id="f-msg" name="message" rows="3" maxlength="1500" placeholder="Например: ширина ниши 70 см, нужна доставка в Тюмень"></textarea></div>
    <div class="hp" aria-hidden="true"><label for="f-site">Сайт</label><input id="f-site" type="text" name="website" tabindex="-1" autocomplete="off"></div>
    <input type="hidden" name="page" value="">
    <label class="check"><input type="checkbox" name="consent" value="1" required aria-describedby="e-consent"><span>${typo('Даю')} <a href="/soglasie/" target="_blank">согласие на&nbsp;обработку персональных данных</a> ${typo('на условиях')} <a href="/privacy/" target="_blank">Политики</a></span></label>
    <span class="field__err" id="e-consent"></span>
    <p class="lform__status" role="status" aria-live="polite"></p>
    <button class="btn btn--ink btn--wide" type="submit">Отправить заявку</button>
    <p class="lform__note">${typo('Ответим в рабочее время дилера. Звонок — бесплатно, ни к чему не обязывает.')}</p>
  </form>`;
}

function contactCards() {
  return stores.map((s) => {
    const q = encodeURIComponent(`${s.city}, ${s.street}`);
    return `<article class="store" data-reveal>
      <p class="eyebrow">${esc(s.note)}</p>
      <h3 class="store__t">${esc(s.title)}</h3>
      <address>${esc(s.postal)}, г.&nbsp;${esc(s.city)},<br>${esc(s.street)}</address>
      <ul class="store__list" role="list">
        ${s.phones.map((ph) => `<li><a href="tel:${tel(ph)}">${ph}</a></li>`).join('')}
        <li><a href="mailto:${s.email}">${s.email}</a></li>
      </ul>
      <a class="link-arrow" href="https://yandex.ru/maps/?text=${q}" target="_blank" rel="noopener">Открыть на Яндекс Картах <span aria-hidden="true">↗</span></a>
    </article>`;
  }).join('');
}

/* ---------------------------------------------------------------- schema.org */

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': abs('/#org'),
  name: 'WAVE',
  alternateName: 'Вейв',
  url: site.url,
  logo: abs('/assets/img/logo.png'),
  foundingDate: String(site.founded),
  description: 'Российский производитель мебели для ванных комнат и санузлов из влагостойкого PVC.',
  brand: { '@type': 'Brand', name: 'WAVE' },
};
const storesLd = stores.map((s) => ({
  '@context': 'https://schema.org',
  '@type': 'FurnitureStore',
  '@id': abs(`/kontakty/#${s.id}`),
  name: `Практик — ${s.title.toLowerCase()}, мебель WAVE`,
  url: abs('/kontakty/'),
  image: abs('/assets/img/og.png'),
  telephone: s.phones.map(tel),
  email: s.email,
  address: { '@type': 'PostalAddress', streetAddress: s.street, addressLocality: s.city, postalCode: s.postal, addressCountry: 'RU' },
  areaServed: 'RU',
  brand: { '@id': abs('/#org') },
}));
const websiteLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'WAVE', url: site.url, inLanguage: 'ru-RU', publisher: { '@id': abs('/#org') } };

/* ---------------------------------------------------------------- главная */

const heroP = products[1];
write('index.html', page({
  title: 'Мебель для ванной WAVE из PVC — купить в Омске у официального дилера',
  description: 'Тумбы, зеркала и шкафы для ванной WAVE из влагостойкого PVC: не разбухают от воды и пара. Смотрите в магазине «Практик» в Омске, доставка по России.',
  path: '/',
  preload: heroP.img.src,
  jsonld: [orgLd, websiteLd, ...storesLd, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }],
}, `
<section class="hero" aria-labelledby="hero-t">
  <div class="hero__waves" aria-hidden="true"><svg viewBox="0 0 1400 200" preserveAspectRatio="none">${waves()}</svg></div>
  <div class="hero__in">
    <div class="hero__text">
      <p class="eyebrow" data-reveal>Производство с ${site.founded} года · Омск и вся Россия</p>
      <h1 class="hero__t" id="hero-t" data-split>Мебель для ванной, <em>которой не&nbsp;страшна&nbsp;вода</em></h1>
      <p class="hero__lead" data-reveal style="--d:.25s">${typo('Тумбы, зеркала и шкафы WAVE из влагостойкого PVC. Смотрите вживую и покупайте у официального дилера — компании «Практик» в Омске, с доставкой по России.')}</p>
      <div class="hero__btns" data-reveal style="--d:.4s">
        <a class="btn btn--ink" href="/mebel/">Смотреть коллекцию</a>
        <a class="btn btn--line" href="${site.catalogPdf}" target="_blank" rel="noopener">Каталог PDF</a>
      </div>
    </div>
    <figure class="hero__art" data-reveal="soft">
      <div class="arch">${productImg(heroP, { eager: true, sizes: '(max-width: 900px) 90vw, 40vw' })}</div>
      <figcaption><a href="${heroP.url}">${esc(heroP.name)}</a> · ${typo(heroP.kind.toLowerCase())}</figcaption>
    </figure>
  </div>
  <ul class="facts" role="list">
    <li data-reveal><b>PVC</b><span>${typo('не впитывает воду и не разбухает')}</span></li>
    <li data-reveal style="--d:.1s"><b>${products.length}</b><span>${typo('готовых комплекта в коллекции')}</span></li>
    <li data-reveal style="--d:.2s"><b>2</b><span>${typo('точки продаж в Омске: розница и опт')}</span></li>
  </ul>
</section>

<section class="sec collection" id="collection" aria-labelledby="col-t">
  <div class="sec__head">
    <p class="eyebrow">Коллекция</p>
    <h2 class="h2" id="col-t" data-split>Четыре комплекта <em>для разных ванных</em></h2>
    <p class="lead">${typo('Каждый комплект — тумба и зеркало или шкаф в одном стиле. Подбирать отдельно не нужно: всё уже сочетается по цвету и пропорциям.')}</p>
  </div>
  <div class="pgrid">${products.map(productCard).join('')}</div>
</section>

<section class="sec material" id="material" aria-labelledby="mat-t">
  <div class="material__in">
    <div class="material__head">
      <p class="eyebrow">Материал</p>
      <h2 class="h2" id="mat-t" data-split>Почему <em>PVC</em></h2>
      <p class="lead">${typo('В ванной мебель живёт в пару, брызгах и перепадах влажности. Поэтому WAVE делает корпуса и фасады не из древесных плит, а из PVC.')}</p>
    </div>
    <ol class="benefits" role="list">
      ${benefits.map((b, i) => `<li data-reveal style="--d:${i * 80}ms"><span class="benefits__n">0${i + 1}</span><h3>${typo(b.title)}</h3><p>${typo(b.text)}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="sec about" aria-labelledby="about-t">
  <p class="eyebrow">О бренде</p>
  <h2 class="about__t" id="about-t" data-split>WAVE — <em>российское производство</em> мебели для ванных комнат и санузлов</h2>
  <div class="about__grid">
    <p data-reveal>${typo(`Предприятие основано в ${site.founded} году. Мы делаем тумбы, зеркала и шкафы из PVC: материал лёгкий, прочный и не боится влаги. Коллекция — это современные модели по доступной цене, которые хорошо знают на российском рынке.`)}</p>
    <p data-reveal style="--d:.12s">${typo('Официальный дилер WAVE — компания «Практик» в Омске. У дилера весь ассортимент бренда, консультация по подбору и гарантия качества; мебель можно увидеть в розничном магазине или купить оптом со склада.')}</p>
  </div>
</section>

<section class="sec buy" id="buy" aria-labelledby="buy-t">
  <div class="sec__head">
    <p class="eyebrow">Как купить</p>
    <h2 class="h2" id="buy-t" data-split>Три шага <em>до новой ванной</em></h2>
  </div>
  <ol class="steps" role="list">
    ${steps.map((s, i) => `<li data-reveal style="--d:${i * 100}ms"><span class="steps__n">${i + 1}</span><h3>${typo(s.title)}</h3><p>${typo(s.text)}</p></li>`).join('')}
  </ol>
</section>

<section class="sec contacts" id="contacts" aria-labelledby="ct-t">
  <div class="sec__head">
    <p class="eyebrow">Где купить</p>
    <h2 class="h2" id="ct-t" data-split>Магазин и склад <em>в Омске</em></h2>
  </div>
  <div class="contacts__grid">
    <div class="stores">${contactCards()}</div>
    <div class="lead-card" id="zayavka" data-reveal>
      <h3 class="lead-card__t">Узнать цену и&nbsp;наличие</h3>
      <p class="lead-card__sub">${typo('Оставьте телефон — менеджер дилера перезвонит, подскажет размеры и рассчитает доставку.')}</p>
      ${leadForm()}
    </div>
  </div>
</section>

<section class="sec faq" id="faq" aria-labelledby="faq-t">
  <div class="sec__head">
    <p class="eyebrow">Вопросы</p>
    <h2 class="h2" id="faq-t" data-split>Частые <em>вопросы</em></h2>
  </div>
  <div class="faq__list">
    ${faq.map((f, i) => `<details class="faq__item" data-reveal${i === 0 ? ' open' : ''}><summary><h3>${typo(f.q)}</h3><span class="faq__ico" aria-hidden="true"></span></summary><div class="faq__a"><p>${typo(f.a)}</p></div></details>`).join('\n    ')}
  </div>
</section>
`));

/* ---------------------------------------------------------------- коллекция */

{
  const c = crumbs([['/mebel/', 'Коллекция']]);
  write('mebel/index.html', page({
    title: 'Коллекция мебели для ванной WAVE: тумбы, зеркала, шкафы',
    description: 'Все комплекты мебели для ванной WAVE: Black Matte, Black Groove, Grey-Blue и White. Корпус из влагостойкого PVC. Купить в Омске у официального дилера «Практик».',
    path: '/mebel/',
    active: '/mebel/',
    jsonld: [c.ld, {
      '@context': 'https://schema.org', '@type': 'ItemList', name: 'Коллекция мебели для ванной WAVE',
      itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(p.url), name: p.title })),
    }],
  }, `
<section class="sec page-top" aria-labelledby="col-t">
  ${c.html}
  <div class="sec__head">
    <p class="eyebrow">Мебель для ванной</p>
    <h1 class="h1" id="col-t" data-split>Коллекция <em>WAVE</em></h1>
    <p class="lead">${typo('Четыре готовых комплекта из влагостойкого PVC — от компактного набора для маленького санузла до гарнитура с тремя ящиками и навесным шкафом. Цены и наличие — у официального дилера.')}</p>
  </div>
  <div class="pgrid">${products.map(productCard).join('')}</div>
  <div class="cta-strip" data-reveal>
    <p>${typo('Все модели с размерами — в каталоге бренда.')}</p>
    <div class="cta-strip__btns"><a class="btn btn--ink" href="${site.catalogPdf}" target="_blank" rel="noopener">Открыть каталог PDF</a><a class="btn btn--line" href="${site.dealer.search}" target="_blank" rel="noopener">WAVE на сайте дилера</a></div>
  </div>
</section>`));
}

/* ---------------------------------------------------------------- карточки товаров */

for (const p of products) {
  const c = crumbs([['/mebel/', 'Коллекция'], [p.url, p.name]]);
  const others = products.filter((o) => o !== p);
  write(`mebel/${p.slug}/index.html`, page({
    title: `${p.title} — WAVE`,
    description: `${p.name}: ${p.kind.toLowerCase()} из влагостойкого PVC. Цена и наличие у официального дилера WAVE в Омске, доставка по России.`,
    path: p.url,
    active: '/mebel/',
    preload: p.img.src,
    jsonld: [c.ld, {
      '@context': 'https://schema.org', '@type': 'Product',
      name: p.title, description: [p.short, ...p.text].join(' '),
      image: abs(p.img.src), url: abs(p.url),
      brand: { '@type': 'Brand', name: 'WAVE' },
      manufacturer: { '@id': abs('/#org') },
      material: 'PVC', color: p.color, category: 'Мебель для ванной комнаты',
    }],
  }, `
<section class="sec page-top product" aria-labelledby="p-t">
  ${c.html}
  <div class="product__grid">
    <figure class="product__img" data-reveal="soft">${productImg(p, { eager: true, sizes: '(max-width: 900px) 100vw, 50vw' })}
      ${p.img.photo ? '' : '<figcaption>Иллюстрация. Фото модели — в каталоге и у дилера.</figcaption>'}</figure>
    <div class="product__info">
      <p class="eyebrow">${typo(p.kind)}</p>
      <h1 class="h1 product__t" id="p-t" data-split>${esc(p.title.split(':')[0])}</h1>
      <p class="lead">${typo(p.short)}</p>
      <ul class="ticks" role="list">${p.features.map((f) => `<li>${typo(f)}</li>`).join('')}</ul>
      <dl class="specs">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="product__btns">
        <a class="btn btn--ink" href="#zayavka">Узнать цену и наличие</a>
        <a class="btn btn--line" href="${esc(p.dealerUrl)}" target="_blank" rel="noopener">Купить у дилера <span aria-hidden="true">↗</span></a>
      </div>
      <p class="fine">${typo('Цены, точные размеры и наличие уточняйте у официального дилера WAVE — компании «Практик».')}</p>
    </div>
  </div>
</section>

<section class="sec prose-sec" aria-labelledby="about-p">
  <div class="prose-sec__in">
    <h2 class="h3" id="about-p">О модели</h2>
    <div class="prose">${p.text.map((t) => `<p data-reveal>${typo(t)}</p>`).join('')}</div>
  </div>
</section>

<section class="sec" aria-labelledby="more-t">
  <div class="sec__head sec__head--row"><h2 class="h2" id="more-t">Другие <em>комплекты</em></h2><a class="link-arrow" href="/mebel/">Вся коллекция <span aria-hidden="true">→</span></a></div>
  <div class="pgrid pgrid--3">${others.map(productCard).join('')}</div>
</section>

<section class="sec contacts" aria-labelledby="ct-t">
  <div class="contacts__grid">
    <div class="lead-card" id="zayavka" data-reveal>
      <h2 class="lead-card__t" id="ct-t">Узнать цену ${esc(p.name)}</h2>
      <p class="lead-card__sub">${typo('Менеджер дилера перезвонит, подскажет размеры и наличие, рассчитает доставку.')}</p>
      ${leadForm(p.name)}
    </div>
    <div class="stores">${contactCards()}</div>
  </div>
</section>`));
}

/* ---------------------------------------------------------------- контакты */

{
  const c = crumbs([['/kontakty/', 'Контакты']]);
  write('kontakty/index.html', page({
    title: 'Где купить мебель WAVE в Омске — адреса и телефоны',
    description: 'Мебель для ванной WAVE в Омске: розничный магазин на ул. Декабристов, 139А и оптовый склад на ул. 20 лет РККА, 298/4. Телефоны, e-mail, заявка на подбор.',
    path: '/kontakty/',
    active: '/kontakty/',
    jsonld: [c.ld, ...storesLd],
  }, `
<section class="sec page-top contacts" aria-labelledby="ct-t">
  ${c.html}
  <div class="sec__head">
    <p class="eyebrow">Официальный дилер WAVE — «Практик»</p>
    <h1 class="h1" id="ct-t" data-split>Контакты <em>в Омске</em></h1>
    <p class="lead">${typo('Посмотреть мебель вживую можно в розничном магазине. Магазинам, строительным и ремонтным компаниям — на оптовый склад.')}</p>
  </div>
  <div class="contacts__grid">
    <div class="stores">${contactCards()}</div>
    <div class="lead-card" id="zayavka" data-reveal>
      <h2 class="lead-card__t">Задать вопрос</h2>
      <p class="lead-card__sub">${typo('Поможем подобрать комплект под размер санузла и рассчитаем доставку в ваш город.')}</p>
      ${leadForm()}
    </div>
  </div>
</section>`));
}

/* ---------------------------------------------------------------- юридические страницы */

const legalPages = [
  ['privacy', 'Политика обработки персональных данных', 'Политика в отношении обработки персональных данных на сайте waverus.ru: цели, условия обработки и права пользователей по 152-ФЗ.', privacyBody],
  ['soglasie', 'Согласие на обработку персональных данных', 'Текст согласия на обработку персональных данных, которое пользователь даёт при отправке формы на сайте waverus.ru.', consentBody],
  ['cookies', 'Политика использования cookie', 'Какие cookie использует сайт waverus.ru, зачем они нужны и как отказаться от аналитических cookie.', cookiesBody],
];
for (const [slug, title, description, body] of legalPages) {
  const c = crumbs([[`/${slug}/`, title]]);
  write(`${slug}/index.html`, page({ title: `${title} — WAVE`, description, path: `/${slug}/`, noindex: true, jsonld: [c.ld] }, `
<section class="sec page-top legal" aria-labelledby="l-t">
  ${c.html}
  <article class="doc">
    <h1 class="h1 doc__t" id="l-t">${esc(title)}</h1>
    ${body({ site, operator, stores, typo, esc })}
  </article>
</section>`));
}

/* ---------------------------------------------------------------- 404 */

write('404.html', page({ title: 'Страница не найдена — WAVE', description: 'Такой страницы нет на сайте WAVE.', path: '/404.html', noindex: true }, `
<section class="sec page-top notfound" aria-labelledby="nf-t">
  <p class="eyebrow">Ошибка 404</p>
  <h1 class="h1" id="nf-t">Такой страницы <em>нет</em></h1>
  <p class="lead">${typo('Возможно, ссылка устарела после обновления сайта. Коллекция и контакты — по ссылкам ниже.')}</p>
  <div class="hero__btns"><a class="btn btn--ink" href="/mebel/">Коллекция</a><a class="btn btn--line" href="/">На главную</a></div>
</section>`));

/* ---------------------------------------------------------------- служебные файлы */

const sitemapUrls = [
  ['/', '1.0', 'weekly'],
  ['/mebel/', '0.9', 'weekly'],
  ...products.map((p) => [p.url, '0.8', 'monthly']),
  ['/kontakty/', '0.7', 'monthly'],
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls.map(([u, pr, f]) => {
  const p = products.find((x) => x.url === u);
  return `  <url><loc>${abs(u)}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority>${p && p.img.photo ? `<image:image><image:loc>${abs(p.img.src)}</image:loc></image:image>` : ''}</url>`;
}).join('\n')}
</urlset>
`);

write('robots.txt', `User-agent: *
Disallow: /api/
Disallow: /*?utm_
Disallow: /*?yclid=
Disallow: /*?gclid=
Allow: /

User-agent: Yandex
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&etext&from /

Sitemap: ${abs('/sitemap.xml')}
`);

write('site.webmanifest', JSON.stringify({
  name: 'WAVE — мебель для ванной', short_name: 'WAVE', lang: 'ru', start_url: '/', display: 'browser',
  background_color: '#f6f3ee', theme_color: '#f6f3ee',
  icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2));

write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#15524f"/><path d="M12 36c6-11 11-11 16 0s10 11 15 0 9-10 10-4" fill="none" stroke="#f6f3ee" stroke-width="4.5" stroke-linecap="round"/></svg>
`);

console.log(`Готово. Товаров: ${products.length}, с фото: ${products.filter((p) => p.img.photo).length}. Вывод → ${OUT}`);
