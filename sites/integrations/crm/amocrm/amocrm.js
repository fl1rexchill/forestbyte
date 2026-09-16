/**
 * Forestbyte — адаптер amoCRM (Node.js), API v4.
 * Создаёт сделку с контактом через долгосрочный токен. См. TUTORIAL.md.
 *
 * Пример:
 *   import { AmoCRM } from "./amocrm.js";
 *   const crm = new AmoCRM(process.env.AMOCRM_SUBDOMAIN, process.env.AMOCRM_TOKEN);
 *   await crm.createLead({ name:"Иван", phone:"+7900...", email:"a@b.ru", comment:"с сайта" });
 */
export class AmoCRM {
  constructor(subdomain, token) {
    if (!subdomain || !token) throw new Error("amoCRM: нужны subdomain и token");
    subdomain = subdomain.replace(/^https?:\/\//, "").replace(/\.amocrm\.(ru|com)\/?$/, "");
    this.base = `https://${subdomain}.amocrm.ru`;
    this.token = token;
  }

  /**
   * @param {{name?:string, phone?:string, email?:string, comment?:string, title?:string}} data
   * @returns {Promise<{ok:true, id:number}|{ok:false, error:string}>}
   */
  async createLead(data) {
    const contactFields = [];
    if (data.phone) contactFields.push({ field_code: "PHONE", values: [{ value: data.phone }] });
    if (data.email) contactFields.push({ field_code: "EMAIL", values: [{ value: data.email }] });

    const payload = [{
      name: data.title || `Заявка с сайта: ${data.name || ""}`,
      _embedded: {
        contacts: [{
          name: data.name || "Клиент с сайта",
          custom_fields_values: contactFields.length ? contactFields : null,
        }],
      },
    }];

    const res = await this._request("POST", "/api/v4/leads/complex", payload);
    if (!res.ok) return res;

    const leadId = res.body?.[0]?.id;
    if (data.comment && leadId) {
      await this._request("POST", `/api/v4/leads/${leadId}/notes`, [
        { note_type: "common", params: { text: data.comment } },
      ]);
    }
    return { ok: true, id: leadId };
  }

  async _request(method, path, body) {
    try {
      const res = await fetch(this.base + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) return { ok: false, error: "amoCRM: токен неверный или истёк (401)." };
      if (res.status === 403) return { ok: false, error: "amoCRM: нет доступа к CRM (403)." };
      if (res.status >= 400) return { ok: false, error: `amoCRM: HTTP ${res.status}. ${await res.text()}` };
      return { ok: true, body: await res.json().catch(() => ({})) };
    } catch (e) {
      return { ok: false, error: `Сеть/amoCRM: ${e.message}` };
    }
  }
}
