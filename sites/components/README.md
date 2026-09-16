# 🧩 Виджеты (Web Components)

Универсальные виджеты на чистом JS. Каждый — независимый `<script type="module">`,
регистрирует свой кастомный тег. Работают в WordPress, на статике, внутри React/Next.

## Контракт виджета

- один файл `fb-<name>.js` = один кастомный элемент `<fb-name>`;
- **Shadow DOM** — стили изолированы, не конфликтуют с темой сайта;
- **темизация только через CSS-переменные** `--fb-*` из `shared/tokens.css`;
- конфигурация через **атрибуты** (`items='...'` JSON или `src="..."` URL JSON);
- пользовательские действия — через **CustomEvent** (`fb-consent`, `fb-subscribe`);
- без сборки; единственная опциональная внешняя зависимость — anime.js (см. ниже).

## Стиль: без фиолетового, человечные кнопки

Палитра в `shared/tokens.css` — тёплый тил `--fb-accent: #0ea5a4` + коралловый
`--fb-accent-2`, **без фиолетового**. Кнопки — мягкие, скруглённые, с тактильным
hover-подъёмом и нажатием (токены `--fb-btn-*`). Готовый класс для обычной вёрстки:
`.fb-btn`, `.fb-btn--ghost`, `.fb-btn--outline`.

## Анимации (anime.js)

Анимированные виджеты (`fb-reveal`, `fb-counter`, `fb-faq`, `fb-testimonials`, `fb-modal`)
используют [anime.js v4](https://animejs.com) через общий загрузчик `shared/anim.js`.
Он подгружает библиотеку с CDN **мягко**: если CDN недоступен или включён
`prefers-reduced-motion` — виджет работает без анимации. Скопировал виджет — скопируй
и `shared/anim.js` + `shared/tokens.css`.

## Каталог

| Тег | Файл | Назначение |
|-----|------|-----------|
| `<fb-navbar>` | `navbar/fb-navbar.js` | Адаптивное меню: бургер, sticky, CTA |
| `<fb-footer>` | `footer/fb-footer.js` | Футер: колонки, соцсети, подписка |
| `<fb-video-circles>` | `video-circles/fb-video-circles.js` | Кружки-видео как в Telegram |
| `<fb-stories>` | `stories/fb-stories.js` | Сториз как в Instagram |
| `<fb-social-feed>` | `social-feed/fb-social-feed.js` | Лента постов из соцсетей |
| `<fb-cookie-consent>` | `cookie-consent/fb-cookie-consent.js` | Баннер согласия 152-ФЗ/GDPR |
| `<fb-reveal>` | `reveal/fb-reveal.js` | Появление элементов при скролле (anime.js, stagger) |
| `<fb-counter>` | `counter/fb-counter.js` | Анимированный счётчик чисел (anime.js) |
| `<fb-faq>` | `faq/fb-faq.js` | Аккордеон FAQ с плавным раскрытием (anime.js) |
| `<fb-testimonials>` | `testimonials/fb-testimonials.js` | Слайдер отзывов (anime.js, автоплей) |
| `<fb-modal>` | `modal/fb-modal.js` | Попап/модалка (anime.js): load/delay/exit/по клику |

## Подключение

```html
<link rel="stylesheet" href="/sites/components/shared/tokens.css">
<script type="module" src="/sites/components/stories/fb-stories.js"></script>
<fb-stories src="/data/stories.json"></fb-stories>
```

Живой пример со всеми виджетами: [`demo/index.html`](demo/index.html)
(проверено в браузере: рендер, интерактив, адаптив под мобильные).

## Данные

- `items='[...]'` — данные прямо в атрибуте (для статики/небольших наборов);
- `src="/url.json"` — виджет сам подтянет JSON (для динамики с бэкенда).

Для `fb-social-feed`: живой парсинг соцсетей из браузера невозможен (CORS/токены) —
данные отдаёт ваш бэкенд. Серверные адаптеры (VK/Telegram) — в `sites/integrations/`.

## Про cookie-consent и аналитику

Подключай счётчики **только после согласия**:

```js
document.addEventListener("fb-consent", (e) => {
  if (e.detail.analytics) initYandexMetrika();
  if (e.detail.marketing) initAdPixels();
});
```
