/*
 * Конфигурация шаблона «Детейлинг-студия».
 * Все данные бизнеса — здесь. Схема полей — в README.md, список замен — в CONTENT_CHECKLIST.md.
 * demo: true — пример: в интерфейсе видна метка, проверка production не пропустит запись.
 * Секреты (токены Telegram, CRM) — только в server/.env.
 */
window.SITE_CONFIG = {
  meta: { mode: 'demo', site: 'detailing-studio', prefix: 'DT', lang: 'ru', timezone: 'Asia/Yekaterinburg' },

  brand: {
    name: 'Графит',
    logoText: 'ГРАФИТ',
    logo: null,
    description: 'Демо-студия детейлинга: полировка, защитная плёнка, керамика, химчистка и уход за салоном.',
    colors: { accent: '#c8f031' },
    fonts: {}
  },

  contacts: {
    phone: '', email: '', telegram: '',
    city: 'Екатеринбург',
    address: '',
    hours: [{ days: 'Ежедневно', time: '09:00–21:00', demo: true }],
    map: null
  },

  hero: {
    eyebrow: 'Детейлинг-студия',
    title: 'Блеск, который держится',
    text: 'Полируем кузов, клеим защитную плёнку, наносим керамику и чистим салон. Посчитайте ориентир по стоимости за минуту — итог уточним после осмотра.',
    image: 'hero',
    cta: { label: 'Рассчитать стоимость', target: 'calc' }
  },

  // Классы автомобиля: coef умножает цену услуги и зоны. id стабильные.
  carClasses: [
    { id: 'small', name: 'Малый', example: 'Kia Rio, VW Polo, Lada Vesta', coef: 1 },
    { id: 'middle', name: 'Средний', example: 'Toyota Camry, Kia K5, Skoda Octavia', coef: 1.2 },
    { id: 'large', name: 'Бизнес и кроссоверы', example: 'BMW 5, Toyota RAV4, Haval Jolion', coef: 1.35 },
    { id: 'xl', name: 'Внедорожники и минивэны', example: 'Land Cruiser, Mercedes V-класс', coef: 1.55 }
  ],

  // Услуги. zones — варианты внутри услуги; price: { type: 'fixed'|'from'|'range'|'request', value, min, max }
  // duration — минуты или { min, max }. limits — ограничения, которые видит клиент.
  services: [
    { id: 'polish', name: 'Полировка кузова', short: 'Убираем голограммы и мелкие царапины лака', image: 'polish',
      zones: [
        { id: 'polish-light', name: 'Лёгкая, один этап', price: { type: 'from', value: 12000 }, duration: { min: 360, max: 480 }, demo: true },
        { id: 'polish-deep', name: 'Восстановительная, два-три этапа', price: { type: 'from', value: 22000 }, duration: { min: 720, max: 1440 }, demo: true }
      ],
      limits: ['Глубокие царапины до грунта полировка не убирает', 'Толщину лака замеряем перед работой'] },
    { id: 'ppf', name: 'Защитная плёнка', short: 'Полиуретан на зоны риска или весь кузов', image: 'ppf',
      zones: [
        { id: 'ppf-lights', name: 'Фары', price: { type: 'from', value: 6000 }, duration: 120, demo: true },
        { id: 'ppf-front', name: 'Зона риска: капот, крылья, бампер, зеркала', price: { type: 'from', value: 45000 }, duration: { min: 960, max: 1440 }, demo: true },
        { id: 'ppf-full', name: 'Весь кузов', price: { type: 'range', min: 180000, max: 260000 }, duration: { min: 2880, max: 4320 }, demo: true }
      ],
      limits: ['Плёнку клеим на чистый лак без сколов', 'Сложные элементы оцениваем на осмотре'] },
    { id: 'ceramic', name: 'Керамика', short: 'Гидрофобный защитный слой на лак', image: 'ceramic',
      zones: [
        { id: 'ceramic-1', name: 'Кузов, один слой', price: { type: 'from', value: 15000 }, duration: 480, demo: true },
        { id: 'ceramic-2', name: 'Кузов, два слоя', price: { type: 'from', value: 24000 }, duration: 720, demo: true }
      ],
      limits: ['Перед керамикой обязательна подготовка лака', 'Срок службы зависит от состава и ухода — уточняем для конкретного покрытия'] },
    { id: 'dry', name: 'Химчистка салона', short: 'Сиденья, потолок, ковры и пластик', image: 'seats',
      zones: [
        { id: 'dry-seats', name: 'Сиденья', price: { type: 'from', value: 5000 }, duration: 180, demo: true },
        { id: 'dry-full', name: 'Комплексная химчистка', price: { type: 'from', value: 14000 }, duration: { min: 360, max: 540 }, demo: true }
      ],
      limits: ['Старые пятна могут остаться частично', 'После химчистки салон сохнет — время уточним'] },
    { id: 'interior', name: 'Уход за салоном', short: 'Кожа, пластик и стёкла изнутри', image: 'dash',
      zones: [
        { id: 'int-leather', name: 'Кожа: чистка и защита', price: { type: 'from', value: 7000 }, duration: 240, demo: true },
        { id: 'int-plastic', name: 'Пластик и стёкла', price: { type: 'from', value: 4000 }, duration: 120, demo: true }
      ],
      limits: ['Повреждённую кожу не восстанавливаем — только чистим и защищаем'] }
  ],

  // Пакеты: готовые наборы. includes — услуги из списка выше (для фильтра работ и расчёта).
  packages: [
    { id: 'pack-new', name: 'Новый автомобиль', composition: ['мойка и подготовка', 'лёгкая полировка', 'керамика в один слой', 'плёнка на фары'], includes: ['polish', 'ceramic', 'ppf'],
      limits: ['Для автомобиля без повреждений лака', 'Сколы и вмятины в пакет не входят'], price: { type: 'from', value: 32000 }, duration: { min: 960, max: 1440 }, demo: true },
    { id: 'pack-sale', name: 'Предпродажная подготовка', composition: ['мойка', 'лёгкая полировка', 'химчистка сидений', 'уход за пластиком'], includes: ['polish', 'dry', 'interior'],
      limits: ['Ремонт кузова и салона не входит'], price: { type: 'from', value: 24000 }, duration: { min: 600, max: 900 }, demo: true },
    { id: 'pack-season', name: 'Сезонный уход', composition: ['мойка', 'химчистка ковров', 'уход за кожей', 'защитное покрытие на стёкла'], includes: ['dry', 'interior'],
      limits: ['Подходит для регулярного ухода, не для восстановления'], price: { type: 'from', value: 11000 }, duration: 360, demo: true }
  ],

  // Допуслуги: цена не зависит от класса, если coef: false
  extras: [
    { id: 'x-wheels', name: 'Керамика дисков', price: { type: 'from', value: 6000 }, coef: false, demo: true },
    { id: 'x-glass', name: 'Антидождь на стёкла', price: { type: 'fixed', value: 3000 }, coef: false, demo: true },
    { id: 'x-engine', name: 'Мойка и консервация двигателя', price: { type: 'from', value: 3500 }, coef: true, demo: true },
    { id: 'x-headlights', name: 'Полировка фар', price: { type: 'fixed', value: 4000 }, coef: false, demo: true },
    { id: 'x-ozone', name: 'Озонирование салона', price: { type: 'request' }, coef: false, demo: true }
  ],

  // Работы для галереи. service — id услуги (фильтр). Демо: стоковые фото, не работы студии.
  portfolio: [
    { id: 'w1', title: 'Керамика на чёрный кузов', service: 'ceramic', image: 'ceramic', demo: true },
    { id: 'w2', title: 'Плёнка на фары', service: 'ppf', image: 'ppf', demo: true },
    { id: 'w3', title: 'Полировка стоек и крыши', service: 'polish', image: 'polish', demo: true },
    { id: 'w4', title: 'Химчистка кожаного салона', service: 'dry', image: 'seats', demo: true },
    { id: 'w5', title: 'Уход за панелью приборов', service: 'interior', image: 'dash', demo: true },
    { id: 'w6', title: 'Мойка перед нанесением защиты', service: 'ceramic', image: 'foam', demo: true }
  ],

  // До/после: только пара фото ОДНОЙ работы (sameCar: true) с разрешением на публикацию.
  // В демо — схематичная иллюстрация, чтобы показать работу блока. Пустой список — блок скрыт.
  beforeAfter: [
    { id: 'ba1', title: 'Пример блока сравнения', service: 'polish', before: 'ba-before', after: 'ba-after', sameCar: true, illustration: true, demo: true }
  ],

  process: [
    { title: 'Осмотр', text: 'Смотрим кузов при ярком свете, замеряем толщину лака, фиксируем сколы и царапины.' },
    { title: 'Смета', text: 'Называем итоговую стоимость и срок после осмотра, до начала работ.' },
    { title: 'Подготовка', text: 'Моем, очищаем от битума и металлических вкраплений, заклеиваем пластик.' },
    { title: 'Работа', text: 'Полировка, плёнка или керамика — по согласованному плану.' },
    { title: 'Выдача', text: 'Показываем результат при свете, объясняем, как ухаживать за покрытием.' }
  ],

  // Материалы: назовите реальные марки, которыми работает студия
  materials: [
    { name: 'Абразивные пасты и полировальные круги', text: 'Подбираем под твёрдость лака.', demo: true },
    { name: 'Полиуретановая плёнка', text: 'Прозрачная глянцевая или матовая.', demo: true },
    { name: 'Керамические составы', text: 'Одно- и двухслойные покрытия.', demo: true }
  ],

  team: [
    { id: 'master-polish', name: '', role: 'Мастер по полировке и керамике', area: 'Полировка, керамика, подготовка лака', photo: null, demo: true },
    { id: 'master-ppf', name: '', role: 'Мастер по плёнке', area: 'Оклейка кузова и фар', photo: null, demo: true },
    { id: 'master-interior', name: '', role: 'Мастер по салону', area: 'Химчистка и уход за кожей', photo: null, demo: true }
  ],

  // Условия ухода — памятка клиенту. Гарантии — только из документов студии; пусто — блок гарантий скрыт.
  care: [
    'Условия ухода зависят от материала: после работы студия выдаёт памятку для вашего покрытия.',
    'Для мойки используйте нейтральную химию и бесконтактный способ.',
    'Сколы и повреждения покрытия показывайте мастеру сразу.'
  ],
  warranty: [],

  reviews: [],

  faq: [
    { q: 'Почему на сайте цена «от»?', a: 'Стоимость зависит от класса, состояния лака и сложности элементов. Калькулятор показывает ориентир, итоговую стоимость называем после осмотра.' },
    { q: 'Сколько автомобиль пробудет в студии?', a: 'Ориентир по времени виден в расчёте. Точный срок назовём после осмотра — он зависит от состояния кузова и выбранных работ.' },
    { q: 'Можно ли приехать просто на осмотр?', a: 'Да. Оставьте заявку без выбора услуги или напишите в комментарии, что хотите осмотр.' }
  ],

  booking: {
    mode: 'request',
    successTitle: 'Запрос расчёта принят',
    successText: 'Мастер свяжется с вами, уточнит детали и предложит время осмотра. Запись требует подтверждения.'
  },

  pricing: {
    note: 'Ориентир по ценам студии. Итоговую стоимость уточняем после осмотра автомобиля.',
    demo: true
  },

  integrations: { endpoint: '/api/lead', channels: { phone: true, email: true, telegram: true }, analytics: { yandexMetrika: '' } },

  legal: {
    operator: '', inn: '', ogrn: '', address: '', email: '', phone: '', site: '', effectiveDate: '',
    dataCollected: ['класс, марка и модель автомобиля', 'выбранные услуги и расчёт', 'фото автомобиля, если вы их приложили'],
    processors: [],
    approved: false,
    docs: {}
  },

  features: { portfolio: true, beforeAfter: true, team: true, reviews: true, packages: true },

  seo: {
    title: 'Графит — детейлинг: полировка, плёнка, керамика, химчистка',
    description: 'Демонстрационный шаблон сайта детейлинг-студии с калькулятором стоимости.',
    image: 'hero',
    canonical: ''
  },

  assets: {
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Фара тёмного автомобиля в каплях дождя', role: 'hero', source: 'https://stocksnap.io/photo/headlight-rain-IF1XAANXVS', author: 'Robin Vet', license: 'CC0 1.0', demo: true },
    ppf: { src: 'img/ppf.webp', width: 960, height: 592, alt: 'Светодиодная фара серебристого автомобиля крупным планом', role: 'service', source: 'https://stocksnap.io/photo/auto-headlight-KEPSFKGIL9', author: 'Travis Soule', license: 'CC0 1.0', demo: true },
    polish: { src: 'img/polish.webp', width: 960, height: 640, alt: 'Стойки и окна серебристого автомобиля с отражениями', role: 'service', source: 'https://stocksnap.io/photo/auto-window-SEXSRO0DFS', author: 'Matt Bango', license: 'CC0 1.0', demo: true },
    ceramic: { src: 'img/ceramic.webp', width: 1200, height: 900, alt: 'Капли воды на тёмной глянцевой поверхности', role: 'service', source: 'https://wordpress.org/photos/photo/840659ee78/', author: 'Jonathan Desrosiers', license: 'CC0 1.0', demo: true },
    seats: { src: 'img/seats.webp', width: 960, height: 540, alt: 'Кожаные сиденья кабриолета сверху', role: 'service', source: 'https://stocksnap.io/photo/car-interior-SF6UIKA8HT', author: 'Mike Birdy', license: 'CC0 1.0', demo: true },
    dash: { src: 'img/dash.webp', width: 960, height: 638, alt: 'Руль и панель приборов классического автомобиля', role: 'service', source: 'https://stocksnap.io/photo/car-interior-FBC1FD9893', author: 'David Marcu', license: 'CC0 1.0', demo: true },
    foam: { src: 'img/foam.webp', width: 1200, height: 900, alt: 'Пена на лобовом стекле во время мойки', role: 'portfolio', source: 'https://wordpress.org/photos/photo/2276524509/', author: 'Michelle Frechette', license: 'CC0 1.0', demo: true },
    brush: { src: 'img/brush.webp', width: 1400, height: 1050, alt: 'Щётки автомойки на стекле', role: 'decor', source: 'https://wordpress.org/photos/photo/9756524507/', author: 'Michelle Frechette', license: 'CC0 1.0', demo: true },
    'ba-before': { src: 'img/ba-before.svg', width: 1200, height: 700, alt: 'Иллюстрация: поверхность с круговыми царапинами', role: 'illustration', source: 'создано для шаблона', author: 'Forestbyte', license: 'свободно в составе шаблона', demo: true },
    'ba-after': { src: 'img/ba-after.svg', width: 1200, height: 700, alt: 'Иллюстрация: ровная глянцевая поверхность с бликом', role: 'illustration', source: 'создано для шаблона', author: 'Forestbyte', license: 'свободно в составе шаблона', demo: true }
  }
};
