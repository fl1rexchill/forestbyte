import { describe, expect, test } from "vitest";
import { TRANSLATIONS, t } from "../src/core/i18n.js";

describe("core/i18n", () => {
  test("подстановка параметров", () => {
    expect(t("start.hello", "en", { name: "Bob" })).toBe(
      "👋 Hi, Bob! I'm a bot. Type /help to see what I can do.",
    );
    expect(t("broadcast.done", "ru", { sent: 3, failed: 1 })).toBe(
      "✅ Готово. Отправлено: 3, ошибок: 1.",
    );
  });

  test("фоллбэки: неизвестная локаль → DEFAULT_LOCALE, неизвестный ключ → ключ", () => {
    expect(t("common.banned", "de")).toBe("🚫 Вы заблокированы.");
    expect(t("common.banned")).toBe("🚫 Вы заблокированы.");
    expect(t("no.such.key", "en")).toBe("no.such.key");
  });

  test("не хватает параметра — шаблон без подстановки (как KeyError в Python)", () => {
    expect(t("broadcast.done", "ru", { sent: 1 })).toBe(
      "✅ Готово. Отправлено: {sent}, ошибок: {failed}.",
    );
  });

  test("ru и en содержат одинаковые ключи", () => {
    expect(Object.keys(TRANSLATIONS.ru ?? {}).sort()).toEqual(
      Object.keys(TRANSLATIONS.en ?? {}).sort(),
    );
  });
});
