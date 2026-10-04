/*
 * Конфигурация шаблона «Косметология». Адаптация sites/niches/cosmetology/.
 * Медицинские сведения (описание, подготовка, ограничения) выводятся ТОЛЬКО если approved: true —
 * это текст, утверждённый клиникой. Иначе сайт пишет, что условия уточняет специалист на консультации.
 * Лицензии и квалификация — только подтверждённые документы; пустые списки скрывают блоки.
 * Схема — в README.md, список замен — в CONTENT_CHECKLIST.md. Секреты — только в server/.env.
 */
window.SITE_CONFIG = {
  meta: { mode: 'demo', site: 'cosmetology-clinic', prefix: 'CS', lang: 'ru', timezone: 'Europe/Moscow' },

  brand: {
    name: 'Лён',
    logoText: 'Лён',
    logo: null,
    description: 'Демо-кабинет косметологии: консультации, уход за кожей и аппаратные процедуры.',
    colors: { accent: '#22292d' },  // чернильный: главная кнопка и выбранное; детали — янтарь сыворотки в style.css
    fonts: {}
  },

  contacts: {
    phone: '', email: '', telegram: '',
    city: 'Краснодар',
    address: '',
    hours: [{ days: 'Пн–Сб', time: '10:00–20:00', demo: true }],
    map: null
  },

  hero: {
    eyebrow: 'Косметология',
    title: 'Сначала консультация, потом процедура',
    text: 'Решение о процедуре вы принимаете после разговора со специалистом — не на сайте и не по анкете.',
    image: 'hero',                // на странице не выводится (обложка — заголовок и капля), используется для og:image
    // «Как это устроено» на обложке. service — id услуги: у шага покажем её длительность и цену и кнопку записи
    steps: [
      { title: 'Консультация', text: 'Специалист осматривает кожу, отвечает на ваши вопросы и предлагает варианты ухода.', service: 'consult' },
      { title: 'План ухода', text: 'Вы получаете варианты процедур и домашнего ухода с ценами. Можно взять паузу и подумать.' },
      { title: 'Процедура', text: 'Только если решите вы. Если уже знаете, что нужно, можно записаться сразу на услугу.', link: { label: 'Услуги и цены', target: 'services' } }
    ],
    cta: { label: 'Записаться на консультацию', target: 'booking' }
  },

  categories: [
    { id: 'consult', name: 'Консультация' },
    { id: 'care', name: 'Уход за лицом' },
    { id: 'peel', name: 'Пилинги' },
    { id: 'hardware', name: 'Аппаратные процедуры' },
    { id: 'body', name: 'Тело' }
  ],

  // Услуги. summary — нейтральное описание без медицинских обещаний.
  // description, preparation, limitations — только утверждённый клиникой текст и approved: true.
  services: [
    { id: 'consult', cat: 'consult', name: 'Консультация косметолога', summary: 'Осмотр, ответы на вопросы и план ухода.', duration: 40, price: { type: 'fixed', value: 1500 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'care-basic', cat: 'care', name: 'Уходовая процедура для лица', summary: 'Очищение, маска и уход по типу кожи.', duration: 60, price: { type: 'from', value: 3500 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'cleaning', cat: 'care', name: 'Чистка лица', summary: 'Очищение пор. Вид чистки подбирает специалист.', duration: { min: 60, max: 90 }, price: { type: 'range', min: 3500, max: 5500 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'peel-surface', cat: 'peel', name: 'Поверхностный пилинг', summary: 'Состав и курс подбирает специалист после консультации.', duration: 40, price: { type: 'from', value: 3000 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'peel-course', cat: 'peel', name: 'Курс пилингов', summary: 'Число процедур определяет специалист.', duration: 40, price: { type: 'request' },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'rf-face', cat: 'hardware', name: 'RF-процедура для лица', summary: 'Аппаратная процедура. Возможность проведения определяет специалист.', duration: 50, price: { type: 'from', value: 5000 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'massage-face', cat: 'care', name: 'Массаж лица', summary: 'Ручная техника массажа.', duration: 45, price: { type: 'fixed', value: 2800 },
      description: '', preparation: '', limitations: '', approved: false, demo: true },
    { id: 'lymph', cat: 'body', name: 'Лимфодренажный массаж', summary: 'Массаж тела. Возможность проведения определяет специалист.', duration: 60, price: { type: 'from', value: 3200 },
      description: '', preparation: '', limitations: '', approved: false, demo: true }
  ],

  // Специалисты. services — id услуг. credentials — только подтверждённые документы:
  // { title: 'Диплом …', issuer: '…', year: 2020, number: '…' }. Пусто — блок квалификации скрыт.
  team: [
    { id: 'spec-1', name: '', role: 'Врач-косметолог', services: ['consult', 'peel-surface', 'peel-course', 'rf-face', 'cleaning'], photo: null, credentials: [], demo: true },
    { id: 'spec-2', name: '', role: 'Косметолог-эстетист', services: ['consult', 'care-basic', 'cleaning', 'massage-face'], photo: null, credentials: [], demo: true },
    { id: 'spec-3', name: '', role: 'Специалист по массажу', services: ['massage-face', 'lymph'], photo: null, credentials: [], demo: true }
  ],

  // Оборудование: модель, производитель и регистрационное удостоверение — из документов клиники
  equipment: [
    { name: 'Аппарат для RF-процедур', text: 'Укажите модель, производителя и номер регистрационного удостоверения.', image: 'chair', demo: true },
    { name: 'Кабинет для уходовых процедур', text: 'Опишите, что есть в кабинете: кушетка, освещение, стерилизация.', image: 'towels', demo: true }
  ],

  // Пространство: фото кабинета и зоны ожидания — id из assets или { image, caption, ratio, focus }.
  // Выводятся одной высоты; ratio — пропорция кадра, focus — какая часть фото в кадре (например '20% 50%').
  space: ['chair', 'plant', { image: 'towels', ratio: 1, focus: '8% 60%' }],

  // Лицензия клиники на медицинскую деятельность: { title, number, date, issuer, url }. Пусто — блок скрыт.
  licenses: [],

  // Результаты процедур: только подтверждённые фото с письменным разрешением пациента. Пусто — блок скрыт.
  results: [],

  reviews: [],

  faq: [
    { q: 'Зачем нужна консультация перед процедурой?', a: 'Специалист осматривает кожу, уточняет ваши пожелания и объясняет, какие процедуры возможны. Решение о процедуре принимаете вы.' },
    { q: 'Нужно ли рассказывать о здоровье в заявке?', a: 'Нет. Не указывайте в форме сведения о здоровье. Всё, что важно для процедуры, специалист обсудит с вами на консультации.' },
    { q: 'Почему у части услуг цена «от» или «по запросу»?', a: 'Стоимость зависит от зоны, препарата и числа процедур. Точную цену назовёт специалист после консультации.' },
    { q: 'Можно ли записаться сразу на процедуру?', a: 'Да, выберите услугу в форме. Если специалист решит, что сначала нужна консультация, администратор скажет об этом при подтверждении записи.' },
    { q: 'Что взять с собой на консультацию?', a: 'Ничего специального. Если вы пользуетесь уходовыми средствами, можно взять их или сфотографировать — специалист посмотрит состав.' },
    { q: 'Как отменить или перенести запись?', a: 'Позвоните или напишите администратору. Чем раньше вы предупредите, тем проще подобрать другое время.' }
  ],

  booking: {
    mode: 'request',
    dayParts: ['Утро, до 12:00', 'День, 12:00–16:00', 'Вечер, после 16:00', 'Любое время'],
    successTitle: 'Запрос на консультацию принят',
    successText: 'Администратор свяжется с вами, чтобы подтвердить время. Запись требует подтверждения.'
  },

  pricing: { note: 'Цены — ориентир. Итоговую стоимость называет специалист после консультации.', demo: true },

  integrations: { endpoint: '/api/lead', channels: { phone: true, email: true, telegram: true }, analytics: { yandexMetrika: '' } },

  legal: {
    operator: '', inn: '', ogrn: '', address: '', email: '', phone: '', site: '', effectiveDate: '',
    dataCollected: ['выбранная услуга и специалист, желаемые дата и время'],
    // предупреждение для рекламы медицинских услуг; формулировку проверяет юрист клиники
    medicalWarning: 'Имеются противопоказания. Необходима консультация специалиста.',
    medicalLicense: '',           // «Лицензия № … от … выдана …» — выводится в подвале, если заполнено
    processors: [],
    approved: false,
    docs: {}
  },

  features: { team: true, equipment: true, space: true, licenses: true, results: true, reviews: true },

  seo: {
    title: 'Лён — косметология: консультации и уход за кожей',
    description: 'Демонстрационный шаблон сайта кабинета косметологии: услуги, специалисты, запрос консультации.',
    image: 'hero',
    canonical: ''
  },

  assets: {
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Ваза с сухими колосьями у светлой стены', role: 'hero', source: 'https://stocksnap.io/photo/vase-wall-JGTJS8KF6Q', author: 'Chimene Gaspar', license: 'CC0 1.0', demo: true },
    towels: { src: 'img/towels.webp', width: 960, height: 640, alt: 'Свёрнутые белые полотенца на тёмной скамье', role: 'space', source: 'https://stocksnap.io/photo/spa-white-811926DC8B', author: 'Leeroy', license: 'CC0 1.0', demo: true },
    chair: { src: 'img/chair.webp', width: 960, height: 638, alt: 'Процедурное кресло в светлом кабинете', role: 'equipment', source: 'https://stocksnap.io/photo/clinic-doctor-6C4YTOELUE', author: 'Mali Maeder', license: 'CC0 1.0', demo: true },
    bottles: { src: 'img/bottles.webp', width: 960, height: 640, alt: 'Стеклянные флаконы и цветы гипсофилы на голубом фоне', role: 'space', source: 'https://stocksnap.io/photo/aromatherapy-spa-5A5JLDXM4R', author: 'Marina Pershina', license: 'CC0 1.0', demo: true },
    plant: { src: 'img/plant.webp', width: 960, height: 1438, alt: 'Зелёная ветка в стеклянной вазе на столе', role: 'space', source: 'https://stocksnap.io/photo/still-items-E8RZSBUQCX', author: 'Gaelle Marcel', license: 'CC0 1.0', demo: true }
  }
};
