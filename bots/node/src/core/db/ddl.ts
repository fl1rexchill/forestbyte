/**
 * DDL таблиц — тот же SQL, что генерирует Alembic для bots/python (миграция 0001),
 * с `IF NOT EXISTS`. initDb() выполняет его на старте — аналог Base.metadata.create_all.
 *
 * Модуль со своими таблицами регистрирует DDL через registerDdl() при импорте.
 * Для продакшена схему ведёт Alembic из Python-стека (одна БД — одни миграции).
 */

export interface DialectDdl {
  sqlite: string[];
  pg: string[];
}

export const CORE_DDL: DialectDdl = {
  sqlite: [
    `CREATE TABLE IF NOT EXISTS users (
    id INTEGER NOT NULL,
    platform VARCHAR(20) NOT NULL,
    external_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10),
    referred_by BIGINT,
    is_admin BOOLEAN NOT NULL,
    is_banned BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    PRIMARY KEY (id)
)`,
    "CREATE INDEX IF NOT EXISTS ix_users_external_id ON users (external_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_platform_external ON users (platform, external_id)",
    `CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    platform VARCHAR(20) NOT NULL,
    text TEXT,
    content_type VARCHAR(30) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    "CREATE INDEX IF NOT EXISTS ix_message_logs_created_at ON message_logs (created_at)",
    `CREATE TABLE IF NOT EXISTS broadcast_jobs (
    id INTEGER NOT NULL,
    created_by BIGINT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    total INTEGER NOT NULL,
    sent INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    finished_at DATETIME,
    PRIMARY KEY (id)
)`,
    `CREATE TABLE IF NOT EXISTS settings (
    "key" VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY ("key")
)`,
  ],
  pg: [
    `CREATE TABLE IF NOT EXISTS users (
    id SERIAL NOT NULL,
    platform VARCHAR(20) NOT NULL,
    external_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10),
    referred_by BIGINT,
    is_admin BOOLEAN NOT NULL,
    is_banned BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id)
)`,
    "CREATE INDEX IF NOT EXISTS ix_users_external_id ON users (external_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_platform_external ON users (platform, external_id)",
    `CREATE TABLE IF NOT EXISTS message_logs (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    platform VARCHAR(20) NOT NULL,
    text TEXT,
    content_type VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)`,
    "CREATE INDEX IF NOT EXISTS ix_message_logs_created_at ON message_logs (created_at)",
    `CREATE TABLE IF NOT EXISTS broadcast_jobs (
    id SERIAL NOT NULL,
    created_by BIGINT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    total INTEGER NOT NULL,
    sent INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id)
)`,
    `CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (key)
)`,
  ],
};

const registered: DialectDdl[] = [CORE_DDL];

/** Зарегистрировать DDL таблиц модуля (выполнится в initDb после ядра). */
export function registerDdl(ddl: DialectDdl): void {
  if (!registered.includes(ddl)) registered.push(ddl);
}

/** Все зарегистрированные операторы для диалекта — в порядке регистрации. */
export function allDdl(dialect: keyof DialectDdl): string[] {
  return registered.flatMap((ddl) => ddl[dialect]);
}
