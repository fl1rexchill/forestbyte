/*
 * Конфигурация шаблона «Автосервис». Адаптация sites/niches/auto/ (выбор автомобиля и расчёт работ).
 * Все данные бизнеса — здесь. Схема — в README.md, список замен — в CONTENT_CHECKLIST.md.
 * demo: true — пример: метка в интерфейсе, проверка production не пропустит запись.
 * Секреты — только в server/.env.
 */
window.SITE_CONFIG = {
  meta: { mode: 'demo', site: 'auto-service', prefix: 'AS', lang: 'ru', timezone: 'Europe/Samara' },

  brand: {
    name: 'Механика',
    logoText: 'МЕХАНИКА',
    logo: null,
    description: 'Демо-автосервис: ТО, диагностика, тормоза, ходовая, электрика и шиномонтаж.',
    colors: { accent: '#ffd400' },
    fonts: {}
  },

  contacts: {
    phone: '', email: '', telegram: '',
    city: 'Самара',
    address: '',
    hours: [{ days: 'Пн–Сб', time: '09:00–20:00', demo: true }, { days: 'Вс', time: 'выходной', demo: true }],
    map: null
  },

  hero: {
    eyebrow: 'Автосервис · ТО и ремонт',
    title: 'Ремонт с понятной сметой',
    text: 'Выберите автомобиль и работы — покажем предварительный расчёт: работа отдельно, запчасти отдельно. Не знаете, что сломалось? Опишите симптомы.',
    image: 'hero',
    cta: { label: 'Оставить заявку', target: 'request' }
  },

  // Классы автомобиля: coef умножает стоимость работ (не запчастей)
  carClasses: {
    A: { name: 'массовый', coef: 1 },
    B: { name: 'средний', coef: 1.15 },
    C: { name: 'премиум', coef: 1.4 }
  },
  // Марка → класс. Марки нет в списке — выводим цены «от» по базовому классу.
  carBrands: {
    'Lada': 'A', 'Kia': 'A', 'Hyundai': 'A', 'Renault': 'A', 'Skoda': 'A', 'Volkswagen': 'A', 'Haval': 'A', 'Chery': 'A', 'Geely': 'A', 'Nissan': 'A',
    'Toyota': 'B', 'Mazda': 'B', 'Mitsubishi': 'B', 'Ford': 'B', 'Honda': 'B', 'Subaru': 'B', 'Exeed': 'B',
    'BMW': 'C', 'Mercedes-Benz': 'C', 'Audi': 'C', 'Lexus': 'C', 'Volvo': 'C', 'Land Rover': 'C', 'Porsche': 'C'
  },

  categories: [
    { id: 'to', name: 'ТО' },
    { id: 'diag', name: 'Диагностика' },
    { id: 'brakes', name: 'Тормоза' },
    { id: 'chassis', name: 'Ходовая' },
    { id: 'electric', name: 'Электрика' },
    { id: 'tires', name: 'Шиномонтаж' }
  ],

  // Работы. labor — стоимость работы (умножается на класс), parts — запчасти и расходники (не умножаются).
  // price: { type: 'fixed'|'from'|'range'|'request', value, min, max }. duration — минуты.
  // variants — выбор внутри работы (например, радиус), у каждого свой labor.
  services: [
    { id: 'oil', cat: 'to', name: 'Замена масла и масляного фильтра', duration: 40, labor: { type: 'fixed', value: 1200 }, parts: { type: 'from', value: 3500 }, partsNote: 'масло и фильтр по допуску производителя', demo: true },
    { id: 'to-reg', cat: 'to', name: 'ТО по регламенту производителя', duration: 120, labor: { type: 'from', value: 3500 }, parts: { type: 'request' }, partsNote: 'состав запчастей зависит от пробега', demo: true },
    { id: 'air-filter', cat: 'to', name: 'Замена воздушного фильтра', duration: 15, labor: { type: 'fixed', value: 300 }, parts: { type: 'from', value: 700 }, demo: true },
    { id: 'cabin-filter', cat: 'to', name: 'Замена салонного фильтра', duration: 20, labor: { type: 'fixed', value: 400 }, parts: { type: 'from', value: 800 }, demo: true },
    { id: 'plugs', cat: 'to', name: 'Замена свечей зажигания', duration: 40, labor: { type: 'from', value: 1000 }, parts: { type: 'from', value: 1600 }, demo: true },
    { id: 'antifreeze', cat: 'to', name: 'Замена антифриза', duration: 60, labor: { type: 'fixed', value: 1800 }, parts: { type: 'from', value: 2500 }, demo: true },

    { id: 'diag-pc', cat: 'diag', name: 'Компьютерная диагностика', duration: 30, labor: { type: 'fixed', value: 1200 }, parts: null, demo: true },
    { id: 'diag-chassis', cat: 'diag', name: 'Диагностика подвески', duration: 30, labor: { type: 'fixed', value: 800 }, parts: null, demo: true },
    { id: 'diag-buy', cat: 'diag', name: 'Проверка автомобиля перед покупкой', duration: 90, labor: { type: 'fixed', value: 3500 }, parts: null, demo: true },

    { id: 'pads-front', cat: 'brakes', name: 'Замена передних колодок', duration: 40, labor: { type: 'fixed', value: 1200 }, parts: { type: 'from', value: 2500 }, demo: true },
    { id: 'pads-rear', cat: 'brakes', name: 'Замена задних колодок', duration: 50, labor: { type: 'fixed', value: 1400 }, parts: { type: 'from', value: 2200 }, demo: true },
    { id: 'discs', cat: 'brakes', name: 'Замена дисков и колодок на оси', duration: 90, labor: { type: 'fixed', value: 2800 }, parts: { type: 'range', min: 6000, max: 18000 }, demo: true },
    { id: 'brake-fluid', cat: 'brakes', name: 'Замена тормозной жидкости', duration: 45, labor: { type: 'fixed', value: 1200 }, parts: { type: 'from', value: 600 }, demo: true },

    { id: 'links', cat: 'chassis', name: 'Замена стоек стабилизатора, пара', duration: 40, labor: { type: 'fixed', value: 1400 }, parts: { type: 'from', value: 1800 }, demo: true },
    { id: 'shock', cat: 'chassis', name: 'Замена амортизатора, 1 шт.', duration: 60, labor: { type: 'from', value: 1800 }, parts: { type: 'request' }, demo: true },
    { id: 'alignment', cat: 'chassis', name: 'Развал-схождение', duration: 40, labor: { type: 'fixed', value: 2200 }, parts: null, demo: true },

    { id: 'battery', cat: 'electric', name: 'Замена аккумулятора', duration: 20, labor: { type: 'fixed', value: 500 }, parts: { type: 'from', value: 7000 }, demo: true },
    { id: 'generator', cat: 'electric', name: 'Ремонт или замена генератора', duration: 150, labor: { type: 'from', value: 3500 }, parts: { type: 'request' }, demo: true },
    { id: 'lights', cat: 'electric', name: 'Регулировка фар', duration: 30, labor: { type: 'fixed', value: 800 }, parts: null, demo: true },

    { id: 'tires-set', cat: 'tires', name: 'Шиномонтаж комплекта с балансировкой', duration: 45, parts: null, demo: true,
      variants: [
        { id: 'r13-15', name: 'R13–R15', labor: { type: 'fixed', value: 2000 } },
        { id: 'r16-17', name: 'R16–R17', labor: { type: 'fixed', value: 2500 } },
        { id: 'r18-19', name: 'R18–R19', labor: { type: 'fixed', value: 3100 } },
        { id: 'r20-22', name: 'R20–R22', labor: { type: 'fixed', value: 4000 } }
      ] },
    { id: 'tire-repair', cat: 'tires', name: 'Ремонт прокола', duration: 30, labor: { type: 'from', value: 600 }, parts: null, demo: true },
    { id: 'tire-storage', cat: 'tires', name: 'Хранение комплекта шин, сезон', duration: 10, labor: { type: 'fixed', value: 3500 }, parts: null, noCoef: true, demo: true }
  ],

  // Как проходит визит
  visit: [
    { title: 'Заявка', text: 'Вы выбираете работы или описываете проблему и желаемое время.' },
    { title: 'Подтверждение', text: 'Администратор связывается с вами и подтверждает время записи.' },
    { title: 'Приёмка', text: 'Мастер осматривает автомобиль и составляет заказ-наряд с ценами.' },
    { title: 'Работы', text: 'Выполняем согласованное. Всё новое — только после вашего согласия.' },
    { title: 'Выдача', text: 'Показываем заменённые детали и выдаём документы по работам.' }
  ],

  // Условия. extraWork выводится как есть — впишите утверждённый текст сервиса.
  policies: {
    extraWork: 'Дополнительные работы выполняем только после согласования: мастер звонит или пишет, называет работы и цену и ждёт вашего ответа.',
    parts: 'Можно привезти свои запчасти. Порядок гарантии на такие работы уточните у администратора.',
    warranty: '',                 // текст гарантии из документов сервиса; пусто — блок скрыт
    demo: true
  },

  reviews: [
    { text: 'Здесь будет отзыв клиента о визите. Публикуйте только реальные отзывы, лучше со ссылкой на площадку, где они опубликованы.', author: 'Имя клиента', source: 'пример', url: '', demo: true }
  ],

  faq: [
    { q: 'Почему в расчёте нет точной цены запчастей?', a: 'Цена зависит от производителя и наличия. На сайте — ориентир; точную стоимость назовём после подбора по VIN.' },
    { q: 'Что делать, если я не знаю, какая работа нужна?', a: 'Выберите «Не знаю, какая услуга нужна» и опишите, что происходит с машиной. Мастер предложит диагностику.' },
    { q: 'Могу ли я выбрать точное время?', a: 'На сайте вы указываете желаемое время. Запись требует подтверждения: администратор свяжется и согласует время.' }
  ],

  booking: {
    mode: 'request',
    dayParts: ['Утро, до 12:00', 'День, 12:00–16:00', 'Вечер, после 16:00', 'Любое время'],
    successTitle: 'Заявка принята',
    successText: 'Администратор свяжется с вами, уточнит работы и подтвердит время. Запись требует подтверждения.'
  },

  pricing: {
    note: 'Предварительный расчёт. Стоимость работ зависит от класса автомобиля, запчастей — от производителя и наличия. Итог — в заказ-наряде после приёмки.',
    demo: true
  },

  integrations: { endpoint: '/api/lead', channels: { phone: true, email: true, telegram: true }, analytics: { yandexMetrika: '' } },

  legal: {
    operator: '', inn: '', ogrn: '', address: '', email: '', phone: '', site: '', effectiveDate: '',
    dataCollected: ['марка, модель и год автомобиля, госномер или VIN при указании', 'выбранные работы или описание неисправности, желаемая дата и время'],
    processors: [],
    approved: false,
    docs: {}
  },

  // cabinet и repairStatus выключены: у шаблона нет рабочего источника статусов ремонта
  features: { reviews: true, cabinet: false, repairStatus: false },

  seo: {
    title: 'Механика — автосервис: ТО, диагностика, ремонт, шиномонтаж',
    description: 'Демонстрационный шаблон сайта автосервиса с каталогом работ и предварительным расчётом.',
    image: 'hero',
    canonical: ''
  },

  assets: {
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Механик лежит под автомобилем в гараже, чёрно-белое фото', role: 'hero', source: 'https://stocksnap.io/photo/beetle-buggy-A0737DFF83', author: 'Ryan McGuire', license: 'CC0 1.0', demo: true },
    valves: { src: 'img/valves.webp', width: 960, height: 640, alt: 'Клапанный механизм двигателя крупным планом', role: 'category', source: 'https://stocksnap.io/photo/engine-block-739D74EEB8', author: 'Leeroy', license: 'CC0 1.0', demo: true },
    battery: { src: 'img/battery.webp', width: 960, height: 720, alt: 'Провода для прикуривания на клеммах аккумулятора', role: 'category', source: 'https://stocksnap.io/photo/jumpercables-battery-T7T37KWY8G', author: 'Pawel Kadysz', license: 'CC0 1.0', demo: true },
    tools: { src: 'img/tools.webp', width: 1400, height: 1027, alt: 'Гаечные ключи на стене мастерской', role: 'decor', source: 'https://wordpress.org/photos/photo/395634db9b/', author: 'Jennifer Bourn', license: 'CC0 1.0', demo: true },
    wheel: { src: 'img/wheel.webp', width: 960, height: 1280, alt: 'Колесо автомобиля на мойке', role: 'category', source: 'https://stocksnap.io/photo/carwash-wheels-84899ED96C', author: 'JESHOOTS.com', license: 'CC0 1.0', demo: true },
    suspension: { src: 'img/suspension.webp', width: 1400, height: 930, alt: 'Детали подвески крупным планом', role: 'category', source: 'https://wordpress.org/photos/photo/320630d011/', author: 'Pierre Lannoy', license: 'CC0 1.0', demo: true },
    engine: { src: 'img/engine.webp', width: 960, height: 638, alt: 'Двигатель автомобиля в тёмных тонах', role: 'category', source: 'https://stocksnap.io/photo/engine-automotive-E2P16G1E6U', author: 'Lukasz Dec', license: 'CC0 1.0', demo: true }
  },

  // изображения категорий каталога (id из assets)
  categoryImages: { to: 'valves', diag: 'engine', brakes: 'tools', chassis: 'suspension', electric: 'battery', tires: 'wheel' }
};
