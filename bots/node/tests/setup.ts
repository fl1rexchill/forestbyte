/**
 * Тестовое окружение — ДО импорта core/config (setupFiles в vitest.config.ts).
 * Переменные окружения важнее .env, поэтому реальные токены из .env в тесты не попадут.
 */
Object.assign(process.env, {
  BOT_TOKEN: "123456:DUMMY_TOKEN_FOR_TESTS",
  ADMIN_IDS: "111,222",
  DATABASE_URL: "sqlite:///:memory:",
  LOG_FILE: "",
  LOG_LEVEL: "WARNING",
  DEFAULT_LOCALE: "ru",
});
