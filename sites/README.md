# 🌐 Sites — база знаний для сайтов

Готовые блоки для быстрой сборки сайтов: универсальные виджеты, юр-шаблоны,
интеграции с CRM и WordPress, полные шаблоны страниц. Копируешь нужное → адаптируешь.

## Философия

Та же, что и у ботов: **самодостаточные блоки**, которые нейросеть берёт и дополняет.
Виджеты — на **чистом JS (Web Components)**: без сборки, работают везде — в WordPress,
на статике, внутри React/Next. Изоляция стилей через Shadow DOM, темизация через
CSS-переменные (`--fb-*`).

## Структура

```
sites/
├── components/            # 🧩 универсальные виджеты (vanilla Web Components)
│   ├── shared/            #    дизайн-токены и база (тема, адаптив)
│   ├── navbar/            #    адаптивное меню (бургер, sticky, dropdown)
│   ├── footer/            #    современный футер (колонки, соцсети, подписка)
│   ├── video-circles/    #    кружки как в Telegram
│   ├── stories/          #    сториз как в Instagram
│   ├── social-feed/      #    лента из соцсетей (VK/TG/Instagram)
│   └── cookie-consent/   #    баннер согласия (152-ФЗ / GDPR)
├── legal/                # ⚖️ шаблоны документов по 152-ФЗ
├── integrations/crm/     # 🔌 коннекторы CRM (Bitrix24, amoCRM) + туториалы
├── wordpress/            # 🟦 плагин (админка+шорткоды+форма→CRM) + тема + TUTORIAL.md
└── templates/            # 📄 полные шаблоны: vanilla/ и nextjs/ (🟡)
```

## Быстрый старт (виджет за 30 секунд)

```html
<!-- 1. подключить токены темы (один раз на страницу) -->
<link rel="stylesheet" href="sites/components/shared/tokens.css">

<!-- 2. подключить нужный виджет -->
<script type="module" src="sites/components/stories/fb-stories.js"></script>

<!-- 3. вставить тег -->
<fb-stories src="/data/stories.json"></fb-stories>
```

## Темизация

Все виджеты читают CSS-переменные из `components/shared/tokens.css`. Меняешь их —
меняется вид всех виджетов сразу. Пример перекраски под бренд:

```css
:root {
  --fb-accent: #ff3b6b;
  --fb-radius: 20px;
  --fb-font: "Inter", system-ui, sans-serif;
}
```

## Статус наполнения

| Раздел | Статус |
|--------|--------|
| Виджеты (navbar, footer, circles, stories, feed, cookie) | 🟢 готово |
| Виджеты анимированные (reveal, counter, faq, testimonials, modal) | 🟢 готово |
| Юр-шаблоны 152-ФЗ | 🟢 готово |
| Интеграции CRM (amoCRM, Bitrix24) + туториалы | 🟢 готово |
| WordPress плагин + тема + туториал | 🟢 готово |
| Полные шаблоны (vanilla / Next.js) | 🟡 в работе |
| Адаптив под все устройства | 🟢 встроен во все виджеты |
