/*
 * Конфигурация шаблона «Салон красоты». Адаптация sites/niches/beauty/.
 * Все данные бизнеса — здесь. Схема — в README.md, список замен — в CONTENT_CHECKLIST.md.
 * На сайте выводятся только категории из списка categories.
 * Сертификаты, абонементы и предоплата выключены: у шаблона нет рабочего сценария оплаты.
 * Секреты — только в server/.env.
 */
window.SITE_CONFIG = {
  meta: { mode: 'demo', site: 'beauty-salon', prefix: 'BS', lang: 'ru', timezone: 'Europe/Moscow' },

  brand: {
    name: 'Бархат',
    logoText: 'Бархат',
    logo: null,
    description: 'Демо-салон: волосы, ногти, брови, ресницы и макияж.',
    colors: { accent: '#7f1734' },  // винный: кнопки и выделение; детали корпуса палетки — розовое золото в style.css
    fonts: {}
  },

  contacts: {
    phone: '', email: '', telegram: '',
    city: 'Нижний Новгород',
    address: '',
    hours: [{ days: 'Ежедневно', time: '10:00–21:00', demo: true }],
    map: null
  },

  hero: {
    eyebrow: 'Салон красоты',
    title: 'Время для себя\u00a0— в одном визите',   // \u00a0 — неразрывный пробел: тире не уходит в начало строки
    accent: 'в одном визите',     // часть заголовка, которая выделяется курсивом
    text: 'Соберите визит из нескольких услуг: покажем общую стоимость и длительность, подберём мастера. Время подтвердит администратор.',
    image: 'hero',                // фото в «зеркале» палетки на первом экране
    cta: { label: 'Собрать визит', target: 'services' }
  },

  // Категории: удалите лишние — они исчезнут с сайта вместе с услугами.
  // color — цвет «пэна» категории в палетке на первом экране и в визите
  categories: [
    { id: 'hair', name: 'Волосы', color: '#8a5a44' },
    { id: 'nails', name: 'Ногти', color: '#d4848f' },
    { id: 'brows', name: 'Брови', color: '#a07f69' },
    { id: 'lashes', name: 'Ресницы', color: '#4b2c3a' },
    { id: 'makeup', name: 'Макияж', color: '#e0876a' }
  ],

  // Услуги. composition — что входит; duration — минуты или { min, max };
  // consultFirst: true — перед услугой предлагаем консультацию (сложное окрашивание и т. п.)
  services: [
    { id: 'haircut', cat: 'hair', name: 'Женская стрижка', composition: ['мытьё головы', 'стрижка', 'укладка феном'], duration: 60, price: { type: 'from', value: 2200 }, demo: true },
    { id: 'styling', cat: 'hair', name: 'Укладка', composition: ['мытьё головы', 'укладка'], duration: 45, price: { type: 'from', value: 1800 }, demo: true },
    { id: 'color-one', cat: 'hair', name: 'Окрашивание в один тон', composition: ['подбор оттенка', 'окрашивание', 'уход', 'укладка'], duration: { min: 120, max: 150 }, price: { type: 'range', min: 4500, max: 8000 }, demo: true },
    { id: 'color-complex', cat: 'hair', name: 'Сложное окрашивание', composition: ['консультация колориста', 'техника по выбору', 'тонирование', 'уход'], duration: { min: 240, max: 360 }, price: { type: 'request' }, consultFirst: true, demo: true },
    { id: 'color-consult', cat: 'hair', name: 'Консультация колориста', composition: ['оценка волос', 'подбор техники и оттенка', 'расчёт стоимости'], duration: 20, price: { type: 'fixed', value: 500 }, demo: true },
    { id: 'mani-gel', cat: 'nails', name: 'Маникюр с покрытием гель-лаком', composition: ['снятие', 'маникюр', 'покрытие'], duration: 105, price: { type: 'fixed', value: 2400 }, demo: true },
    { id: 'mani-classic', cat: 'nails', name: 'Маникюр без покрытия', composition: ['обработка кутикулы', 'форма', 'уход'], duration: 60, price: { type: 'fixed', value: 1400 }, demo: true },
    { id: 'pedi-gel', cat: 'nails', name: 'Педикюр с покрытием', composition: ['обработка стоп', 'педикюр', 'покрытие'], duration: 90, price: { type: 'fixed', value: 3000 }, demo: true },
    { id: 'brows', cat: 'brows', name: 'Коррекция и окрашивание бровей', composition: ['подбор формы', 'коррекция', 'окрашивание'], duration: 45, price: { type: 'fixed', value: 1600 }, demo: true },
    { id: 'brow-lam', cat: 'brows', name: 'Долговременная укладка бровей', composition: ['укладка', 'коррекция', 'уход'], duration: 60, price: { type: 'fixed', value: 2300 }, demo: true },
    { id: 'lash-ext', cat: 'lashes', name: 'Наращивание ресниц', composition: ['подбор изгиба и длины', 'наращивание'], duration: { min: 120, max: 150 }, price: { type: 'from', value: 2800 }, demo: true },
    { id: 'lash-lam', cat: 'lashes', name: 'Ламинирование ресниц', composition: ['ламинирование', 'окрашивание'], duration: 60, price: { type: 'fixed', value: 2200 }, demo: true },
    { id: 'makeup-day', cat: 'makeup', name: 'Дневной макияж', composition: ['подготовка кожи', 'макияж'], duration: 45, price: { type: 'fixed', value: 2500 }, demo: true },
    { id: 'makeup-evening', cat: 'makeup', name: 'Вечерний макияж', composition: ['подготовка кожи', 'макияж', 'ресницы-пучки по желанию'], duration: 60, price: { type: 'from', value: 3500 }, demo: true }
  ],

  // Совместимость услуг в одном визите: exclusive — пары, которые нельзя выбрать вместе
  compatibility: {
    exclusive: [
      ['mani-gel', 'mani-classic', 'Выберите один вид маникюра.'],
      ['color-one', 'color-complex', 'Выберите один вид окрашивания.'],
      ['lash-ext', 'lash-lam', 'Наращивание и ламинирование ресниц в одном визите не совмещаем.'],
      ['makeup-day', 'makeup-evening', 'Выберите один вид макияжа.']
    ]
  },

  // Мастера: services — id услуг, которые мастер выполняет (проверка квалификации при выборе).
  // Имена и фото — только реальных сотрудников с их согласия.
  team: [
    { id: 'm-color', name: '', role: 'Стилист-колорист', services: ['haircut', 'styling', 'color-one', 'color-complex', 'color-consult'], photo: null, demo: true },
    { id: 'm-hair', name: '', role: 'Парикмахер-стилист', services: ['haircut', 'styling', 'color-one'], photo: null, demo: true },
    { id: 'm-nails', name: '', role: 'Мастер маникюра и педикюра', services: ['mani-gel', 'mani-classic', 'pedi-gel'], photo: null, demo: true },
    { id: 'm-brows', name: '', role: 'Бровист и лэшмейкер', services: ['brows', 'brow-lam', 'lash-ext', 'lash-lam'], photo: null, demo: true },
    { id: 'm-makeup', name: '', role: 'Визажист', services: ['makeup-day', 'makeup-evening', 'brows'], photo: null, demo: true }
  ],

  // Портфолио: service — id услуги, master — id мастера. Демо: стоковые фото, не работы салона.
  portfolio: [
    { id: 'pf5', title: 'Палитра для вечернего образа', service: 'makeup-evening', master: 'm-makeup', image: 'palette', demo: true },
    { id: 'pf3', title: 'Собранная укладка', service: 'styling', master: 'm-hair', image: 'bun', demo: true },
    { id: 'pf6', title: 'Подготовка к дневному макияжу', service: 'makeup-day', master: 'm-makeup', image: 'flatlay', demo: true },
    { id: 'pf1', title: 'Маникюр в нюдовой гамме', service: 'mani-gel', master: 'm-nails', image: 'nails', demo: true },
    { id: 'pf7', title: 'Рабочее место бровиста', service: 'brows', master: 'm-brows', image: 'brush', demo: true },
    { id: 'pf4', title: 'Инструменты визажиста', service: 'makeup-evening', master: 'm-makeup', image: 'brushes', demo: true },
    { id: 'pf2', title: 'Покрытие гель-лаком', service: 'mani-gel', master: 'm-nails', image: 'nails2', demo: true }
  ],

  // Готовые сочетания для пустого визита: одной кнопкой кладут несколько услуг. services — id услуг.
  visitIdeas: [
    { title: 'Маникюр и педикюр', services: ['mani-gel', 'pedi-gel'] },
    { title: 'Брови и ресницы', services: ['brows', 'lash-lam'] },
    { title: 'Укладка и макияж', services: ['styling', 'makeup-evening'] }
  ],

  reviews: [
    { text: 'Здесь будет отзыв гостьи о визите. Публикуйте только реальные отзывы, по возможности со ссылкой на площадку.', author: 'Имя клиента', source: 'пример', url: '', demo: true }
  ],

  faq: [
    { q: 'Можно ли записаться на несколько услуг сразу?', a: 'Да. Добавьте услуги в визит — покажем общую стоимость и длительность. Если услуги делают разные мастера, администратор предложит порядок.' },
    { q: 'Почему время нужно подтверждать?', a: 'На сайте вы указываете желаемое время. Администратор сверяет его с расписанием мастеров и подтверждает запись.' },
    { q: 'Зачем консультация перед сложным окрашиванием?', a: 'Колорист оценивает волосы, предлагает технику и называет стоимость. После консультации проще спланировать длительность визита.' },
    { q: 'Можно ли сделать маникюр и окрашивание одновременно?', a: 'Иногда да — если два мастера свободны в одно время. Напишите об этом в комментарии, администратор проверит расписание.' },
    { q: 'Почему у некоторых услуг цена «от»?', a: 'Стоимость зависит от длины и густоты волос или объёма работы. Мастер назовёт точную цену перед началом.' },
    { q: 'Как перенести или отменить запись?', a: 'Позвоните или напишите администратору. Чем раньше вы предупредите, тем проще подобрать другое время.' }
  ],

  booking: {
    mode: 'request',              // расписания мастеров нет: запрашиваем желаемое время
    dayParts: ['Утро, до 12:00', 'День, 12:00–16:00', 'Вечер, после 16:00', 'Любое время'],
    successTitle: 'Заявка на запись принята',
    successText: 'Администратор свяжется с вами, чтобы подтвердить время и мастера. Запись требует подтверждения.'
  },

  pricing: { note: 'Цены «от» и диапазоны зависят от длины волос и объёма работы — мастер уточнит перед началом.', demo: true },

  integrations: { endpoint: '/api/lead', channels: { phone: true, email: true, telegram: true }, analytics: { yandexMetrika: '' } },

  legal: {
    operator: '', inn: '', ogrn: '', address: '', email: '', phone: '', site: '', effectiveDate: '',
    dataCollected: ['выбранные услуги и мастер, желаемые дата и время'],
    processors: [],
    approved: false,
    docs: {}
  },

  // certificates, subscriptions, prepayment — выключены: нет рабочего сценария оплаты
  features: { team: true, portfolio: true, reviews: true, certificates: false, subscriptions: false, prepayment: false },

  seo: {
    title: 'Бархат — салон красоты: волосы, ногти, брови, ресницы, макияж',
    description: 'Демонстрационный шаблон сайта салона красоты с подбором услуг и мастера.',
    image: 'hero',
    canonical: ''
  },

  assets: {
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Кисти для макияжа в ажурном стакане на светлом мехе', role: 'hero', source: 'https://stocksnap.io/photo/makeup-brush-EE2H5SKEPA', author: 'Freestocks.org', license: 'CC0 1.0', demo: true },
    nails: { src: 'img/nails.webp', width: 960, height: 640, alt: 'Мастер в розовых перчатках делает маникюр', role: 'portfolio', source: 'https://stocksnap.io/photo/people-hands-XX356Q6EI4', author: 'Freestocks.org', license: 'CC0 1.0', demo: true },
    nails2: { src: 'img/nails2.webp', width: 960, height: 640, alt: 'Нанесение покрытия на ногти', role: 'portfolio', source: 'https://stocksnap.io/photo/people-hands-5M4DNCN8ZW', author: 'Freestocks.org', license: 'CC0 1.0', demo: true },
    brushes: { src: 'img/brushes.webp', width: 960, height: 640, alt: 'Набор кистей для макияжа в раскрытом чехле', role: 'portfolio', source: 'https://stocksnap.io/photo/makeup-brush-PZ0Z7K0JRR', author: 'Freestocks.org', license: 'CC0 1.0', demo: true },
    palette: { src: 'img/palette.webp', width: 960, height: 640, alt: 'Палитра теней и тональные средства на столе визажиста', role: 'portfolio', source: 'https://stocksnap.io/photo/beauty-makeup-34MSYVUYS0', author: 'Alexandre Vanier', license: 'CC0 1.0', demo: true },
    flatlay: { src: 'img/flatlay.webp', width: 960, height: 640, alt: 'Помады, кисти и палетка на белом фоне', role: 'portfolio', source: 'https://stocksnap.io/photo/makeup-products-I8SLDUOMYC', author: 'Beauty and Fashion', license: 'CC0 1.0', demo: true },
    bun: { src: 'img/bun.webp', width: 960, height: 640, alt: 'Волосы, собранные в пучок, на светлом фоне', role: 'portfolio', source: 'https://stocksnap.io/photo/bun-hair-I9AW11TY89', author: 'Kasia Serbin', license: 'CC0 1.0', demo: true },
    brush: { src: 'img/brush.webp', width: 960, height: 720, alt: 'Кисть для макияжа в стакане на подоконнике', role: 'portfolio', source: 'https://stocksnap.io/photo/makeup-brush-IJSBS0EFPO', author: 'Pawel Kadysz', license: 'CC0 1.0', demo: true },
    blush: { src: 'img/blush.webp', width: 960, height: 640, alt: 'Румяна и кисть на белом столе', role: 'decor', source: 'https://stocksnap.io/photo/makeup-brush-K00RNBNJGC', author: 'Studio 7042', license: 'CC0 1.0', demo: true }
  }
};
