# Шаблон: telegram_group (Node.js)

Бот-модератор для групп на grammY: капча новичков + модерация + антифлуд.
Зеркало `bots/python/templates/telegram_group`.

**Что внутри:**
- captcha — новый участник ограничивается, пока не нажмёт «Я человек» (иначе кик);
- moderation — команды ответом на сообщение: `/ban`, `/kick`, `/mute [мин]`, `/unmute`, `/warn`;
- антифлуд — авто-мут за слишком частые сообщения.

**Требования:** бот должен быть **администратором** группы с правами
ограничивать и банить участников.

**Запуск:**
```bash
cd bots/node
cp .env.example .env        # BOT_TOKEN
npm install
npm run build
npm run start:group
```

**Настройка:** время капчи и пороги флуда — в `src/modules/captcha/composer.ts`
и `src/modules/moderation/composer.ts` (константы вверху файлов).
