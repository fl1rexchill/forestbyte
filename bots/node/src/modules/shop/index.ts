/**
 * Модуль shop: каталог, корзина, заказы с оплатой в Telegram Stars.
 *
 * Подключение (shop ДО payments и common):
 *   import { composer as shopComposer } from "../../modules/shop/index.js";
 *   bot.use(shopComposer);
 *
 * Покупатель: /shop → добавляет в корзину → /cart → оформить → оплата.
 * Админ: /addproduct, /products, /delproduct.
 *
 * Зависит от modules/payments (sendStarsInvoice, таблица payments) и core/db.
 * Оплаченные заказы имеют payload "order:<id>", поэтому shop должен идти
 * раньше payments (иначе платёж перехватит payments).
 */
export { composer } from "./composer.js";
export { cartKb, productKb } from "./keyboards.js";
export { type Order, type OrderItem, type Product, tablesFor as shopTables } from "./models.js";
