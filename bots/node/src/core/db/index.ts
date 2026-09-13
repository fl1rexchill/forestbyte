/**
 * Слой БД ядра: подключение, схема, DDL, репозитории.
 *
 * Использование:
 *   import { getDb, initDb, UserRepository, Platform } from "../core/db/index.js";
 */
export {
  type DatabaseTarget,
  type Db,
  type Dialect,
  disposeDb,
  getDb,
  initDb,
  type Orm,
  parseDatabaseUrl,
  transaction,
} from "./client.js";
export { allDdl, CORE_DDL, type DialectDdl, registerDdl } from "./ddl.js";
export { pickTables, userFullName } from "./helpers.js";
export {
  BroadcastRepository,
  type CreateBroadcast,
  type GetOrCreateUser,
  type LogMessage,
  MessageRepository,
  SettingRepository,
  StatsRepository,
  type StatsSummary,
  UserRepository,
} from "./repositories.js";
export {
  type BroadcastJob,
  fromSqliteDateTime,
  type MessageLog,
  type NewUser,
  Platform,
  pgTables,
  pgUsers,
  type SameRow,
  type Setting,
  sqliteDateTime,
  sqliteTables,
  sqliteUsers,
  type Tables,
  toSqliteDateTime,
  type User,
  utcnow,
} from "./schema.js";
