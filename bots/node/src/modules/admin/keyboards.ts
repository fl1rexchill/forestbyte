/** Инлайн-клавиатуры админ-панели. callback_data с префиксом admin:* */
import { InlineKeyboard } from "grammy";
import { t } from "../../core/i18n.js";

export function adminPanelKb(locale = "ru"): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("admin.stats_btn", locale), "admin:stats")
    .row()
    .text(t("admin.broadcast_btn", locale), "admin:broadcast")
    .row()
    .text(t("admin.users_btn", locale), "admin:users");
}

export function backKb(_locale = "ru"): InlineKeyboard {
  return new InlineKeyboard().text("⬅️ Назад", "admin:home");
}

export function broadcastConfirmKb(): InlineKeyboard {
  return new InlineKeyboard().text("✅ Отправить", "admin:bc_send").text("❌ Отмена", "admin:home");
}
