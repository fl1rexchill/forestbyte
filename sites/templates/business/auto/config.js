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
    // map: { url: 'ссылка на карту', embed: 'src виджета Яндекс Карт (Конструктор карт → «Получить код» → src из iframe)' }
    map: null
  },

  hero: {
    eyebrow: 'Автосервис в Самаре · ТО, ремонт, шиномонтаж',
    title: 'Смета ремонта до визита в сервис',
    text: 'Выберите машину и работы — заказ-наряд соберётся сразу: работа и запчасти отдельно. Не знаете, что сломалось? Нажмите на узел на схеме или опишите симптомы.',
    image: 'hero',
    cta: { label: 'Выбрать работы', target: 'catalog' }
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

  // Категории каталога. code — префикс кода работы (ТО-01, ТР-02). node — узел на схеме автомобиля
  // в первом экране: engine, dash, battery, brakes, suspension, wheel. Без node категория на схеме не показывается.
  // Как марку пишут по-русски — по этим словам её тоже можно найти в списке «Марка».
  carBrandAliases: {
    'Lada': 'лада ваз', 'Kia': 'киа', 'Hyundai': 'хендай хундай хёндэ', 'Renault': 'рено', 'Skoda': 'шкода', 'Volkswagen': 'фольксваген вв',
    'Haval': 'хавал хавейл', 'Chery': 'чери', 'Geely': 'джили', 'Nissan': 'ниссан', 'Toyota': 'тойота', 'Mazda': 'мазда',
    'Mitsubishi': 'мицубиси митсубиси', 'Ford': 'форд', 'Honda': 'хонда', 'Subaru': 'субару', 'Exeed': 'эксид', 'BMW': 'бмв',
    'Mercedes-Benz': 'мерседес', 'Audi': 'ауди', 'Lexus': 'лексус', 'Volvo': 'вольво', 'Land Rover': 'ленд ровер лэнд', 'Porsche': 'порше'
  },
  // Модели для выпадающего списка «Модель» по маркам. Список — подсказка: клиент может вписать и свою модель.
  carModels: {
    'Lada': ['Granta', 'Vesta', 'Niva Travel', 'Niva Legend', 'Largus', 'XRAY'],
    'Kia': ['Rio', 'Ceed', 'Cerato', 'K5', 'Sportage', 'Sorento', 'Seltos', 'Soul'],
    'Hyundai': ['Solaris', 'Elantra', 'Sonata', 'Creta', 'Tucson', 'Santa Fe'],
    'Renault': ['Logan', 'Sandero', 'Duster', 'Kaptur', 'Arkana'],
    'Skoda': ['Rapid', 'Octavia', 'Superb', 'Karoq', 'Kodiaq'],
    'Volkswagen': ['Polo', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'Teramont'],
    'Haval': ['Jolion', 'F7', 'F7x', 'H6', 'Dargo', 'H9'],
    'Chery': ['Tiggo 4', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 8'],
    'Geely': ['Coolray', 'Atlas', 'Monjaro', 'Emgrand', 'Tugella'],
    'Nissan': ['Almera', 'Qashqai', 'X-Trail', 'Terrano', 'Juke'],
    'Toyota': ['Corolla', 'Camry', 'RAV4', 'Land Cruiser Prado', 'Land Cruiser', 'Highlander'],
    'Mazda': ['3', '6', 'CX-5', 'CX-30', 'CX-9'],
    'Mitsubishi': ['Lancer', 'ASX', 'Outlander', 'Pajero Sport', 'L200'],
    'Ford': ['Focus', 'Mondeo', 'Kuga', 'EcoSport', 'Transit'],
    'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot'],
    'Subaru': ['Impreza', 'XV', 'Forester', 'Outback'],
    'Exeed': ['LX', 'TXL', 'VX', 'RX'],
    'BMW': ['3 Series', '5 Series', 'X1', 'X3', 'X5', 'X6', 'X7'],
    'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'GLS'],
    'Audi': ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7', 'Q8'],
    'Lexus': ['ES', 'IS', 'NX', 'RX', 'LX'],
    'Volvo': ['S60', 'S90', 'XC40', 'XC60', 'XC90'],
    'Land Rover': ['Discovery Sport', 'Discovery', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover', 'Defender'],
    'Porsche': ['Macan', 'Cayenne', 'Panamera', '911']
  },

  // Кузов модели — по нему перерисовывается схема на первом экране. Строка «Марка Модель» из carModels.
  // Чего нет в списках — седан (в том числе модель, которую клиент вписал сам).
  carBodies: {
    hatch: ['Lada Largus', 'Lada XRAY', 'Kia Ceed', 'Kia Soul', 'Renault Sandero', 'Skoda Rapid', 'Ford Focus', 'Subaru Impreza', 'Audi A3', 'Porsche Panamera', 'Porsche 911'],
    suv: ['Lada Niva Travel', 'Lada Niva Legend', 'Kia Sportage', 'Kia Sorento', 'Kia Seltos', 'Hyundai Creta', 'Hyundai Tucson', 'Hyundai Santa Fe',
      'Renault Duster', 'Renault Kaptur', 'Renault Arkana', 'Skoda Karoq', 'Skoda Kodiaq', 'Volkswagen Tiguan', 'Volkswagen Touareg', 'Volkswagen Teramont',
      'Haval Jolion', 'Haval F7', 'Haval F7x', 'Haval H6', 'Haval Dargo', 'Haval H9', 'Chery Tiggo 4', 'Chery Tiggo 7 Pro', 'Chery Tiggo 8 Pro',
      'Geely Coolray', 'Geely Atlas', 'Geely Monjaro', 'Geely Tugella', 'Nissan Qashqai', 'Nissan X-Trail', 'Nissan Terrano', 'Nissan Juke',
      'Toyota RAV4', 'Toyota Land Cruiser Prado', 'Toyota Land Cruiser', 'Toyota Highlander', 'Mazda CX-5', 'Mazda CX-30', 'Mazda CX-9',
      'Mitsubishi ASX', 'Mitsubishi Outlander', 'Mitsubishi Pajero Sport', 'Mitsubishi L200', 'Ford Kuga', 'Ford EcoSport', 'Ford Transit',
      'Honda CR-V', 'Honda Pilot', 'Subaru XV', 'Subaru Forester', 'Subaru Outback', 'Exeed LX', 'Exeed TXL', 'Exeed VX', 'Exeed RX',
      'BMW X1', 'BMW X3', 'BMW X5', 'BMW X6', 'BMW X7', 'Mercedes-Benz GLC', 'Mercedes-Benz GLE', 'Mercedes-Benz GLS', 'Audi Q3', 'Audi Q5', 'Audi Q7', 'Audi Q8',
      'Lexus NX', 'Lexus RX', 'Lexus LX', 'Volvo XC40', 'Volvo XC60', 'Volvo XC90', 'Land Rover Discovery Sport', 'Land Rover Discovery',
      'Land Rover Range Rover Evoque', 'Land Rover Range Rover Sport', 'Land Rover Range Rover', 'Land Rover Defender', 'Porsche Macan', 'Porsche Cayenne']
  },

  categories: [
    { id: 'to', name: 'ТО', code: 'ТО', node: 'engine', nodeLabel: 'Двигатель и ТО' },
    { id: 'diag', name: 'Диагностика', code: 'ДГ', node: 'dash', nodeLabel: 'Диагностика' },
    { id: 'brakes', name: 'Тормоза', code: 'ТР', node: 'brakes', nodeLabel: 'Тормоза' },
    { id: 'chassis', name: 'Ходовая', code: 'ХД', node: 'suspension', nodeLabel: 'Подвеска' },
    { id: 'electric', name: 'Электрика', code: 'ЭЛ', node: 'battery', nodeLabel: 'Электрика' },
    { id: 'tires', name: 'Шиномонтаж', code: 'ШМ', node: 'wheel', nodeLabel: 'Шины и колёса' }
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

  // Путь машины по сервису. gives — что остаётся у клиента на этом этапе (строка «На руках»).
  visit: [
    { title: 'Заявка', text: 'Вы выбираете работы или описываете проблему и желаемое время.', gives: 'черновик заказ-наряда' },
    { title: 'Подтверждение', text: 'Администратор связывается с вами и подтверждает время записи.', gives: 'время записи' },
    { title: 'Приёмка', text: 'Мастер осматривает автомобиль и составляет заказ-наряд с ценами.', gives: 'заказ-наряд с ценами' },
    { title: 'Работы', text: 'Выполняем согласованное. Всё новое — только после вашего согласия.', gives: 'звонок перед доп. работами' },
    { title: 'Выдача', text: 'Показываем заменённые детали и выдаём документы по работам.', gives: 'старые детали и документы' }
  ],

  // Условия — блок «Без мелкого шрифта». extraWork выводится как есть — впишите утверждённый текст сервиса.
  // policyMarks — фраза из текста условия, которую выделяет жёлтый маркер (должна точно входить в текст).
  policyMarks: { extraWork: 'только после согласования', parts: 'привезти свои запчасти', oldParts: 'отдаём вам', warranty: '' },
  policies: {
    extraWork: 'Дополнительные работы выполняем только после согласования: мастер звонит или пишет, называет работы и цену и ждёт вашего ответа.',
    parts: 'Можно привезти свои запчасти. Порядок гарантии на такие работы уточните у администратора.',
    oldParts: 'Заменённые детали показываем при выдаче и отдаём вам, если хотите их забрать.',
    warranty: '',                 // текст гарантии из документов сервиса; пусто — блок скрыт
    demo: true
  },

  // Отзывы — «История обслуживания»: каждая запись привязана к машине, пробегу и работам из каталога.
  // car — марка и модель с годом; mileage — пробег в км (число); works — id работ из services; date — строка.
  // source и url — где опубликован отзыв. Публикуйте только реальные отзывы с согласия автора.
  reviews: [
    { text: 'Скрипели передние колодки. Поменяли колодки и тормозуху, старые отдали — там уже металл по металлу. По деньгам вышло как на сайте, разница рублей сто.', author: 'Андрей', car: 'Kia Rio, 2019', mileage: 87400, works: ['pads-front', 'brake-fluid'], date: 'август 2026', source: '', url: '', demo: true },
    { text: 'Делала ТО. Про свечи сказали, что можно дотянуть до следующего раза, — не меняли.', author: 'Ольга', car: 'Toyota Camry, 2017', mileage: 132000, works: ['to-reg', 'plugs'], date: 'июнь 2026', source: '', url: '', demo: true },
    { text: 'Смотрели машину перед покупкой. Нашли крашеное крыло и подтёк на коробке, от покупки я отказался. Полтора часа и 3 500 ₽ — дешевле, чем потом чинить.', author: 'Дмитрий', car: 'Skoda Octavia, 2020', mileage: 64500, works: ['diag-buy'], date: 'май 2026', source: '', url: '', demo: true },
    { text: 'Переобулась на R17 и оставила колёса у них на хранение. Приехала к девяти, в одиннадцать уже уехала.', author: 'Марина', car: 'Haval Jolion, 2022', mileage: 28900, works: ['tires-set', 'tire-storage'], date: 'апрель 2026', source: '', url: '', demo: true }
  ],

  faq: [
    { q: 'Почему в расчёте нет точной цены запчастей?', a: 'Цена зависит от производителя и наличия. На сайте — ориентир; точную стоимость назовём после подбора по VIN.' },
    { q: 'Что делать, если я не знаю, какая работа нужна?', a: 'Нажмите на узел на схеме или отметьте «Не знаю, какая услуга нужна» и опишите, что происходит с машиной. Мастер предложит диагностику.' },
    { q: 'Могу ли я выбрать точное время?', a: 'На сайте вы указываете желаемое время. Запись требует подтверждения: администратор свяжется и согласует время.' },
    { q: 'Сколько времени займёт ремонт?', a: 'В заказ-наряде указано нормативное время каждой работы. Точный срок мастер назовёт после приёмки: он зависит от наличия запчастей и загрузки.' },
    { q: 'Что будет, если при ремонте найдут ещё неисправность?', a: 'Мастер позвонит или напишет, назовёт работу и цену. Без вашего согласия дополнительные работы не делаем.' },
    { q: 'Нужно ли записываться на шиномонтаж заранее?', a: 'В сезон лучше оставить заявку: администратор предложит ближайшее свободное время.' }
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
    // на странице фото нет (первый экран — схема); hero используется только для og:image
    hero: { src: 'img/hero.webp', width: 960, height: 640, alt: 'Механик лежит под автомобилем в гараже, чёрно-белое фото', role: 'hero', source: 'https://stocksnap.io/photo/beetle-buggy-A0737DFF83', author: 'Ryan McGuire', license: 'CC0 1.0', demo: true }
  }
};
