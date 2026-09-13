import { defineConfig } from "vitest/config";

// Тесты без сети и токенов: SQLite in-memory, Telegram API подменён (tests/helpers.ts)
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
  },
});
