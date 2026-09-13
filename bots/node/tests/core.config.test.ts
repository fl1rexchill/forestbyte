import { describe, expect, test } from "vitest";
import { loadSettings, settings } from "../src/core/config.js";

describe("core/config", () => {
  test("settings из тестового окружения", () => {
    expect(settings.botToken).toBe("123456:DUMMY_TOKEN_FOR_TESTS");
    expect(settings.adminIds).toEqual([111, 222]);
    expect(settings.isAdmin(111)).toBe(true);
    expect(settings.isAdmin(999)).toBe(false);
    expect(settings.isSqlite).toBe(true);
    expect(settings.logFile).toBeNull();
  });

  test("значения по умолчанию как в Python-стеке", () => {
    const s = loadSettings({ BOT_TOKEN: "x" });
    expect(s.adminIds).toEqual([]);
    expect(s.databaseUrl).toBe("sqlite+aiosqlite:///data/bot.sqlite3");
    expect(s.logLevel).toBe("INFO");
    expect(s.logFile).toBe("logs/bot.log");
    expect(s.defaultLocale).toBe("ru");
    expect(s.broadcastRate).toBe(25);
    expect(s.igAccessToken).toBeUndefined();
    expect(s.maxBotToken).toBeUndefined();
  });

  test("ADMIN_IDS: пробелы и пустые элементы", () => {
    expect(loadSettings({ BOT_TOKEN: "x", ADMIN_IDS: " 1, 2 ,,3 " }).adminIds).toEqual([1, 2, 3]);
  });

  test("регистр LOG_LEVEL и пустые опциональные токены", () => {
    const s = loadSettings({
      BOT_TOKEN: "x",
      LOG_LEVEL: "debug",
      IG_APP_SECRET: "",
      BROADCAST_RATE: "10",
    });
    expect(s.logLevel).toBe("DEBUG");
    expect(s.igAppSecret).toBeUndefined();
    expect(s.broadcastRate).toBe(10);
  });

  test("ошибки конфигурации понятны", () => {
    expect(() => loadSettings({})).toThrow(/BOT_TOKEN/);
    expect(() => loadSettings({ BOT_TOKEN: "x", ADMIN_IDS: "1,abc" })).toThrow(/ADMIN_IDS/);
    expect(() => loadSettings({ BOT_TOKEN: "x", LOG_LEVEL: "LOUD" })).toThrow();
    expect(() => loadSettings({ BOT_TOKEN: "x", BROADCAST_RATE: "0" })).toThrow();
  });
});
