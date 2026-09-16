/**
 * Forestbyte — адаптер Bitrix24 (Node.js).
 * Создаёт лид в Bitrix24 через входящий вебхук. Как получить — см. TUTORIAL.md.
 *
 * Пример:
 *   import { Bitrix24 } from "./bitrix24.js";
 *   const crm = new Bitrix24(process.env.BITRIX24_WEBHOOK);
 *   await crm.createLead({ name: "Иван", phone: "+7900...", email: "a@b.ru", comment: "с сайта" });
 */
export class Bitrix24 {
  /** @param {string} webhook ссылка входящего вебхука (с / на конце) */
  constructor(webhook) {
    if (!webhook) throw new Error("Bitrix24: не задан webhook");
    this.webhook = webhook.replace(/\/+$/, "") + "/";
  }

  /**
   * Создать лид.
   * @param {{name?:string, phone?:string, email?:string, comment?:string, title?:string}} data
   * @returns {Promise<{ok:true, id:number}|{ok:false, error:string}>}
   */
  async createLead(data) {
    const fields = {
      TITLE: data.title || `Заявка с сайта: ${data.name || ""}`,
      NAME: data.name || "",
      COMMENTS: data.comment || "",
      SOURCE_ID: "WEB",
    };
    if (data.phone) fields.PHONE = [{ VALUE: data.phone, VALUE_TYPE: "WORK" }];
    if (data.email) fields.EMAIL = [{ VALUE: data.email, VALUE_TYPE: "WORK" }];

    try {
      const res = await fetch(this.webhook + "crm.lead.add.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      if (json.error) return { ok: false, error: json.error_description || json.error };
      return { ok: true, id: json.result };
    } catch (e) {
      return { ok: false, error: `Сеть/Bitrix24: ${e.message}` };
    }
  }
}
