/**
 * Фоновая обработка входящих событий платформ (Instagram, MAX) —
 * зеркало bots/python/platforms/background.py.
 *
 * Вебхук отвечает платформе 200 сразу, а события обрабатываются «воркерами»:
 *  - у каждого воркера своя цепочка промисов;
 *  - события одного ключа (отправителя) всегда попадают к одному воркеру → порядок
 *    сохраняется, а разные собеседники обрабатываются параллельно;
 *  - ошибка обработчика логируется и не останавливает воркер;
 *  - stop() дожидается обработки всего, что уже принято.
 *
 * Очередь живёт в памяти процесса: при аварийном падении принятые, но не обработанные
 * события теряются (платформа уже получила 200) — см. docs/DEPLOYMENT.md.
 */
import { getLogger } from "../core/logger.js";

const log = getLogger("platforms.background");

/** FNV-1a — стабильный хеш ключа для выбора воркера. */
function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export interface WorkerPoolOptions {
  workers?: number;
  name?: string;
}

export class KeyedWorkerPool<T> {
  private tails: Promise<void>[] | null = null;
  private readonly size: number;
  private readonly name: string;

  constructor(
    private readonly handler: (item: T) => Promise<void>,
    options: WorkerPoolOptions = {},
  ) {
    this.size = options.workers ?? 4;
    this.name = options.name ?? "events";
    if (!Number.isInteger(this.size) || this.size < 1) {
      throw new RangeError("workers должно быть целым числом >= 1");
    }
  }

  get running(): boolean {
    return this.tails !== null;
  }

  start(): void {
    this.tails ??= Array.from({ length: this.size }, () => Promise.resolve());
  }

  /** Поставить событие в цепочку воркера, закреплённого за ключом. */
  submit(key: string, item: T): void {
    const tails = this.tails;
    if (!tails) throw new Error(`${this.name}: пул не запущен (вызовите start())`);
    const index = hash(key) % this.size;
    const tail = tails[index] ?? Promise.resolve();
    tails[index] = tail
      .then(() => this.handler(item))
      .catch((err: unknown) => {
        log.error("%s: ошибка обработчика: %s", this.name, err);
      });
  }

  /** Дождаться обработки всего, что уже принято. */
  async drain(): Promise<void> {
    if (this.tails) await Promise.all(this.tails);
  }

  /** Обработать принятое и остановить пул. */
  async stop(): Promise<void> {
    await this.drain();
    this.tails = null;
  }
}
