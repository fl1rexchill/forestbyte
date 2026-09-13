/**
 * Централизованное логирование (зеркало bots/python/core/logger.py).
 *
 * Пишет и в консоль, и в файл (если задан LOG_FILE) с ротацией 5 МБ × 3.
 * Запись в файл асинхронная (WriteStream) — не блокирует обработку апдейтов.
 * Единый формат для всех модулей: "2026-09-12 17:52:05 | INFO     | name | message".
 * Сообщение форматируется как util.format: log.info("user %s", id).
 *
 * Использование:
 *   import { getLogger } from "../core/logger.js";
 *   const log = getLogger("modules.admin");
 *   log.info("bot started");
 */
import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";
import { type LogLevel, settings } from "./config.js";

const LEVELS: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARNING: 30, ERROR: 40 };
const MAX_BYTES = 5 * 1024 * 1024;
const BACKUP_COUNT = 3;

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Файл с ротацией по размеру (аналог RotatingFileHandler), запись через WriteStream.
 *
 * Файл открывается синхронно (fd), поэтому переименование при ротации безопасно:
 * недописанный буфер уходит в уже переименованный файл .1, новые строки — в новый.
 */
export class RotatingFileStream {
  private stream: fs.WriteStream;
  private size: number;

  constructor(
    private readonly file: string,
    private readonly maxBytes = MAX_BYTES,
    private readonly backups = BACKUP_COUNT,
  ) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    this.stream = this.open();
  }

  private open(): fs.WriteStream {
    const fd = fs.openSync(this.file, "a");
    const stream = fs.createWriteStream(this.file, { fd, autoClose: true });
    stream.on("error", (err) => console.error(`logger: ${err.message}`));
    return stream;
  }

  write(line: string): void {
    const bytes = Buffer.byteLength(line);
    if (this.size > 0 && this.size + bytes > this.maxBytes) this.rotate();
    this.stream.write(line);
    this.size += bytes;
  }

  private rotate(): void {
    this.stream.end();
    for (let i = this.backups - 1; i >= 1; i--) {
      const src = `${this.file}.${i}`;
      if (fs.existsSync(src)) fs.renameSync(src, `${this.file}.${i + 1}`);
    }
    if (fs.existsSync(this.file)) fs.renameSync(this.file, `${this.file}.1`);
    this.stream = this.open();
    this.size = 0;
  }

  /** Дописать буфер и закрыть файл (при остановке приложения / в тестах). */
  close(): Promise<void> {
    return new Promise((resolve) => this.stream.end(resolve));
  }
}

// undefined — ещё не создан; null — файл отключён
let fileSink: RotatingFileStream | null | undefined;

function sink(): RotatingFileStream | null {
  if (fileSink === undefined) {
    fileSink = settings.logFile ? new RotatingFileStream(path.resolve(settings.logFile)) : null;
  }
  return fileSink;
}

/** Дописать логи в файл перед выходом (вызывается раннерами при остановке). */
export async function flushLogs(): Promise<void> {
  if (fileSink) {
    const current = fileSink;
    fileSink = undefined;
    await current.close();
  }
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Вернуть настроенный логгер с указанным именем. */
export function getLogger(name: string): Logger {
  const emit = (level: LogLevel, message: string, args: unknown[]): void => {
    if (LEVELS[level] < LEVELS[settings.logLevel]) return;
    const line = `${timestamp()} | ${level.padEnd(8)} | ${name} | ${format(message, ...args)}`;
    console.log(line);
    sink()?.write(`${line}\n`);
  };
  return {
    debug: (message, ...args) => emit("DEBUG", message, args),
    info: (message, ...args) => emit("INFO", message, args),
    warn: (message, ...args) => emit("WARNING", message, args),
    error: (message, ...args) => emit("ERROR", message, args),
  };
}
