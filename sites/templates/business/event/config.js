/*
 * Конфигурация шаблона «Event-агентство».
 * Все данные бизнеса — здесь. Вёрстку и app.js для замены данных менять не нужно.
 * Схема полей — в README.md этой папки. Список данных для замены — в CONTENT_CHECKLIST.md.
 * demo: true помечает пример: в интерфейсе появляется метка, а проверка production не пропустит такую запись.
 * Секреты (токены Telegram, CRM) сюда не кладите — только в server/.env.
 */
window.SITE_CONFIG = {
  meta: {
    mode: 'demo',                 // 'demo' — заявки хранятся в браузере; 'production' — уходят на сервер
    site: 'event-agency',         // уникальный код сайта (латиница) — по нему CRM отличает заявки
    prefix: 'EV',                 // префикс номера заявки: EV-1001
    lang: 'ru',
    timezone: 'Europe/Moscow'
  },

  brand: {
    name: 'Ровно в семь',
    logoText: 'Ровно в семь',
    logo: null,                   // id изображения из assets, если есть логотип
    description: 'Демо-агентство: придумываем и проводим корпоративы, конференции, презентации и частные события.',
    colors: { accent: '#ff5a1f' },
    fonts: {}                     // { heading: '"Unbounded", sans-serif', body: '"Onest", sans-serif' }
  },

  contacts: {
    phone: '',                    // '+7 (XXX) XXX-XX-XX' — пусто: кнопка звонка скрыта
    email: '',
    telegram: '',                 // ник без @ и без ссылки
    city: 'Москва',
    address: '',
    hours: [{ days: 'Пн–Пт', time: '10:00–19:00', demo: true }],
    map: null                     // { url: 'https://yandex.ru/maps/...' }
  },

  hero: {
    eyebrow: 'Event-агентство полного цикла',
    title: 'Собираем событие от идеи до последнего гостя',
    text: 'Корпоративы, конференции, презентации и частные праздники. Берём на себя концепцию, площадку, программу, технику и координацию в день события.',
    image: 'hero',
    cta: { label: 'Обсудить мероприятие', target: 'brief' }
  },

  // Форматы — первый шаг брифа и фильтр проектов. id стабильные: на них ссылаются проекты и цены.
  formats: [
    { id: 'corporate', name: 'Корпоративы', short: 'Новогодние вечера, юбилеи компании, летние выезды', image: 'corporate' },
    { id: 'conference', name: 'Конференции', short: 'Форумы, отраслевые встречи, внутренние сессии', image: 'conference' },
    { id: 'presentation', name: 'Презентации', short: 'Запуск продукта, пресс-события, открытие пространства', image: 'presentation' },
    { id: 'private', name: 'Частные события', short: 'Свадьбы, дни рождения, семейные праздники', image: 'private' }
  ],

  // Услуги агентства. price: { type: 'fixed'|'from'|'range'|'request', value, min, max, unit }
  // perGuest: true — цена умножается на число гостей в смете.
  services: [
    { id: 'concept', name: 'Концепция и сценарий', text: 'Идея события, драматургия вечера, визуальный стиль и тайминг.', price: { type: 'from', value: 40000 }, demo: true },
    { id: 'venue', name: 'Подбор площадки', text: 'Шорт-лист площадок под формат и бюджет, переговоры, выезды на осмотр.', price: { type: 'from', value: 25000 }, demo: true },
    { id: 'program', name: 'Программа и артисты', text: 'Ведущий, артисты, интерактивы и спикеры под задачу события.', price: { type: 'from', value: 60000 }, demo: true },
    { id: 'tech', name: 'Техника', text: 'Звук, свет, экраны, сцена и технический райдер площадки.', price: { type: 'from', value: 80000 }, demo: true },
    { id: 'decor', name: 'Декор и оформление', text: 'Фотозоны, флористика, навигация и оформление пространства.', price: { type: 'from', value: 50000 }, demo: true },
    { id: 'coordination', name: 'Координация в день события', text: 'Команда на площадке: тайминг, подрядчики, гости и форс-мажоры.', price: { type: 'from', value: 35000 }, demo: true },
    { id: 'catering', name: 'Кейтеринг через партнёров', text: 'Необязательная услуга: подключаем кейтеринг партнёров и согласуем меню. Кейтеринг — не основной профиль агентства.', optional: true, price: { type: 'request' }, demo: true }
  ],

  // Этапы подготовки: только порядок работ, без обещаний сроков
  stages: [
    { title: 'Бриф', text: 'Вы рассказываете о задаче, гостях и бюджете. Мы задаём уточняющие вопросы.' },
    { title: 'Концепция', text: 'Предлагаем идею события, площадки и предварительную смету.' },
    { title: 'Договор и план', text: 'Фиксируем состав работ, смету и календарный план подготовки.' },
    { title: 'Подготовка', text: 'Бронируем площадку и подрядчиков, репетируем программу, собираем техническую часть.' },
    { title: 'День события', text: 'Команда координирует площадку, подрядчиков и тайминг от монтажа до демонтажа.' },
    { title: 'Итоги', text: 'Передаём фото и видео, собираем обратную связь, закрываем документы.' }
  ],

  // Проекты: size — 'l' | 'm' | 's' (размер плитки). Работы в демо — примеры на стоковых фото, не реальные кейсы.
  portfolio: [
    { id: 'p-winter', title: 'Зимний вечер для команды', format: 'corporate', size: 'l', cover: 'hall', gallery: ['hall', 'corporate', 'lights'],
      task: 'Собрать в одном зале несколько отделов и сделать вечер без долгих официальных частей.', works: ['концепция и сценарий', 'подбор площадки', 'ведущий и музыканты', 'свет и звук', 'координация'], demo: true },
    { id: 'p-forum', title: 'Отраслевой форум на два зала', format: 'conference', size: 'm', cover: 'forum', gallery: ['forum', 'conference', 'theatre'],
      task: 'Развести пленарную сессию и секции по двум залам и не потерять гостей между ними.', works: ['регистрация и навигация', 'техника и трансляция', 'работа со спикерами', 'координация залов'], demo: true },
    { id: 'p-launch', title: 'Презентация нового продукта', format: 'presentation', size: 's', cover: 'presentation', gallery: ['presentation', 'lights', 'crowd'],
      task: 'Показать продукт гостям и прессе за один короткий выход на сцену.', works: ['сценарий выхода', 'сцена и экраны', 'пресс-зона', 'репетиции'], demo: true },
    { id: 'p-garden', title: 'Свадьба в саду', format: 'private', size: 'm', cover: 'garden', gallery: ['garden', 'private', 'decor'],
      task: 'Провести церемонию и ужин на открытом воздухе с запасным планом на дождь.', works: ['декор и флористика', 'план Б на погоду', 'ведущий', 'координация подрядчиков'], demo: true },
    { id: 'p-summer', title: 'Летний выезд компании', format: 'corporate', size: 's', cover: 'outdoor', gallery: ['outdoor', 'balloons'],
      task: 'Устроить день на природе с активностями для разных групп сотрудников.', works: ['площадка', 'программа активностей', 'трансфер', 'координация'], demo: true },
    { id: 'p-stage', title: 'Концертная часть юбилея', format: 'corporate', size: 'l', cover: 'crowd', gallery: ['crowd', 'lights', 'hero'],
      task: 'Сделать концертный блок в конце официальной программы.', works: ['артисты', 'сцена, свет, звук', 'тайминг'], demo: true },
    { id: 'p-birthday', title: 'День рождения в камерном формате', format: 'private', size: 's', cover: 'decor', gallery: ['decor', 'balloons'],
      task: 'Небольшой праздник для близких с тёплой атмосферой и продуманным декором.', works: ['декор', 'программа', 'координация'], demo: true }
  ],

  // Команда: роли и зоны ответственности. Имена и фото — только реальных сотрудников с их согласия.
  team: [
    { id: 'producer', name: '', role: 'Продюсер проекта', area: 'Ведёт событие от брифа до итогов, отвечает за смету и сроки.', photo: null, demo: true },
    { id: 'creative', name: '', role: 'Креативный директор', area: 'Концепция, сценарий и визуальный стиль.', photo: null, demo: true },
    { id: 'tech-lead', name: '', role: 'Технический директор', area: 'Звук, свет, экраны и работа с площадкой.', photo: null, demo: true },
    { id: 'coordinator', name: '', role: 'Координатор', area: 'Подрядчики, гости и тайминг в день события.', photo: null, demo: true }
  ],

  reviews: [
    { text: 'Здесь будет отзыв клиента: какая была задача и что получилось. Публикуйте только реальные отзывы с согласия автора.', author: 'Имя клиента, компания', source: 'пример', url: '', demo: true }
  ],

  faq: [
    { q: 'За какое время до события нужно обращаться?', a: 'Срок зависит от формата, площадки и числа гостей. Напишите бриф — на обсуждении скажем, что успеваем подготовить к вашей дате.' },
    { q: 'Можно ли прийти без точной даты и бюджета?', a: 'Да. В брифе есть варианты «Дата не выбрана» и «Бюджет обсуждается». Предложим варианты под задачу.' },
    { q: 'Вы делаете кейтеринг?', a: 'Кейтеринг — не наш основной профиль. По запросу подключаем партнёров и согласуем меню в общей смете.' },
    { q: 'Как считается смета?', a: 'Предварительная смета на сайте — ориентир по нашим услугам. Точную смету готовим после обсуждения брифа и выбора площадки.' }
  ],

  booking: {
    mode: 'request',              // только заявка на обсуждение: сайт не резервирует даты агентства
    successTitle: 'Бриф принят для обсуждения',
    successText: 'Мы изучим бриф и свяжемся с вами, чтобы обсудить детали и предложить варианты.'
  },

  pricing: {
    mode: 'estimate',             // 'estimate' — показывать предварительную смету; 'request' — только «Запросить смету»
    note: 'Предварительная смета — ориентир по услугам агентства без аренды площадки, кейтеринга и гонораров артистов. Точную смету готовим после обсуждения.',
    // организация по формату: price — база, perGuest — за каждого гостя
    formats: {
      corporate: { price: { type: 'from', value: 60000 }, perGuest: 1200 },
      conference: { price: { type: 'from', value: 80000 }, perGuest: 900 },
      presentation: { price: { type: 'from', value: 70000 }, perGuest: 1000 },
      private: { price: { type: 'from', value: 45000 }, perGuest: 800 }
    },
    budgets: ['до 300 000 ₽', '300 000 – 700 000 ₽', '700 000 – 1 500 000 ₽', 'больше 1 500 000 ₽'],
    maxGuests: 3000,
    demo: true
  },

  integrations: {
    endpoint: '/api/lead',
    channels: { phone: true, email: true, telegram: true },
    analytics: { yandexMetrika: '' }  // номер счётчика; запускается только после согласия на аналитические cookie
  },

  legal: {
    operator: '',                 // ООО «...» или ИП ...
    inn: '',
    ogrn: '',
    address: '',
    email: '',
    phone: '',
    site: '',                     // example.ru
    effectiveDate: '',
    dataCollected: ['город и дата события, число гостей, бюджет, выбранные услуги, название компании и площадки', 'файл брифа, если вы его приложили'],
    processors: [],               // например: ['Telegram (уведомления сотрудникам)', 'Bitrix24']
    approved: false,              // true — владелец проверил тексты документов
    docs: {}                      // { privacy: '<p>утверждённый текст</p>', consent: '...', cookies: '...' }
  },

  features: {
    team: true,
    reviews: true,
    estimate: true
  },

  seo: {
    title: 'Ровно в семь — event-агентство: корпоративы, конференции, презентации',
    description: 'Демонстрационный шаблон сайта event-агентства. Форматы, проекты, услуги и бриф на мероприятие.',
    image: 'hero',
    canonical: ''                 // https://example.ru/
  },

  // Изображения: источник, лицензия и роль каждого файла. Все фото демо — стоковые CC0, не работы агентства.
  assets: {
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Сцена концерта в тёплом свете прожекторов, зрители в зале', role: 'hero', source: 'https://stocksnap.io/photo/concert-show-5FGWJW4Z5D', author: 'Nainoa Shizuru', license: 'CC0 1.0', demo: true },
    corporate: { src: 'img/corporate.webp', width: 960, height: 638, alt: 'Два бокала шампанского на тёмном фоне', role: 'format', source: 'https://stocksnap.io/photo/champagne-party-OS989CI8D6', author: 'Piotr Lohunko', license: 'CC0 1.0', demo: true },
    conference: { src: 'img/conference.webp', width: 1400, height: 933, alt: 'Пустой конференц-зал с рядами кресел', role: 'format', source: 'https://wordpress.org/photos/photo/60861b1e02/', author: 'Nilo Velez', license: 'CC0 1.0', demo: true },
    presentation: { src: 'img/presentation.webp', width: 960, height: 640, alt: 'Микрофон на стойке на фоне размытых огней сцены', role: 'format', source: 'https://stocksnap.io/photo/microphone-music-8KQC04JDT0', author: 'Freestocks.org', license: 'CC0 1.0', demo: true },
    private: { src: 'img/private.webp', width: 1400, height: 933, alt: 'Сцена, украшенная цветочной аркой, с диваном для пары', role: 'format', source: 'https://wordpress.org/photos/photo/7256540432/', author: 'Sharankrishna VP', license: 'CC0 1.0', demo: true },
    hall: { src: 'img/hall.webp', width: 1400, height: 1050, alt: 'Банкетный зал с люстрами на кессонном потолке', role: 'portfolio', source: 'https://wordpress.org/photos/photo/249690a31d/', author: 'Mehraz Morshed', license: 'CC0 1.0', demo: true },
    garden: { src: 'img/garden.webp', width: 1400, height: 842, alt: 'Сцена под открытым небом с жёлто-красными полотнами над газоном', role: 'portfolio', source: 'https://wordpress.org/photos/photo/21265cdae9/', author: 'Makarand Mane', license: 'CC0 1.0', demo: true },
    outdoor: { src: 'img/outdoor.webp', width: 1200, height: 900, alt: 'Белые столы и стулья, расставленные на газоне для праздника', role: 'portfolio', source: 'https://wordpress.org/photos/photo/127632102a/', author: 'ChrisEdwardsCE', license: 'CC0 1.0', demo: true },
    theatre: { src: 'img/theatre.webp', width: 1400, height: 933, alt: 'Пустой зрительный зал с красными креслами', role: 'portfolio', source: 'https://wordpress.org/photos/photo/50466603c9/', author: 'Nilo Velez', license: 'CC0 1.0', demo: true },
    lights: { src: 'img/lights.webp', width: 1400, height: 1867, alt: 'Синие лучи света над концертной сценой', role: 'portfolio', source: 'https://wordpress.org/photos/photo/9676222e25/', author: 'Josh Pollock', license: 'CC0 1.0', demo: true },
    crowd: { src: 'img/crowd.webp', width: 960, height: 640, alt: 'Зрители поднимают руки перед освещённой сценой', role: 'portfolio', source: 'https://stocksnap.io/photo/crowd-people-IUJP9OI22I', author: 'Anthony Delanoix', license: 'CC0 1.0', demo: true },
    decor: { src: 'img/decor.webp', width: 1200, height: 1499, alt: 'Столик под светящимся зонтом среди цветов вечером', role: 'portfolio', source: 'https://wordpress.org/photos/photo/2236946470/', author: 'Ravi Patidar', license: 'CC0 1.0', demo: true },
    forum: { src: 'img/forum.webp', width: 1400, height: 934, alt: 'Конференц-зал с экраном, трибуной и рядами кресел', role: 'portfolio', source: 'https://wordpress.org/photos/photo/5176786995/', author: 'Nilo Velez', license: 'CC0 1.0', demo: true },
    balloons: { src: 'img/balloons.webp', width: 960, height: 638, alt: 'Разноцветные воздушные шары крупным планом', role: 'portfolio', source: 'https://stocksnap.io/photo/balloons-party-DNWA3H3LCU', author: 'Fernando Arcos', license: 'CC0 1.0', demo: true }
  }
};
