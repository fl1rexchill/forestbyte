/** KeyedWorkerPool: порядок внутри ключа, параллельность ключей, изоляция ошибок. */
import { describe, expect, test } from "vitest";
import { KeyedWorkerPool } from "../src/platforms/background.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("KeyedWorkerPool", () => {
  test("порядок внутри ключа сохраняется, ключи обрабатываются параллельно", async () => {
    const seen: [string, number][] = [];
    const pool = new KeyedWorkerPool<[string, number]>(
      async (item) => {
        await sleep(Math.random() * 3);
        seen.push(item);
      },
      { workers: 3 },
    );
    pool.start();
    for (let n = 0; n < 10; n++) {
      for (const key of ["a", "b", "c"]) pool.submit(key, [key, n]);
    }
    await pool.stop();

    expect(seen).toHaveLength(30);
    for (const key of ["a", "b", "c"]) {
      expect(seen.filter(([k]) => k === key).map(([, n]) => n)).toEqual([...Array(10).keys()]);
    }
    expect(pool.running).toBe(false);
  });

  test("ошибка обработчика не останавливает воркер", async () => {
    const done: number[] = [];
    const pool = new KeyedWorkerPool<number>(
      async (n) => {
        if (n === 1) throw new Error("boom");
        done.push(n);
      },
      { workers: 1 },
    );
    pool.start();
    for (let n = 0; n < 4; n++) pool.submit("k", n);
    await pool.drain();
    expect(done).toEqual([0, 2, 3]);
  });

  test("submit до start и некорректное число воркеров", () => {
    const pool = new KeyedWorkerPool<number>(async () => {});
    expect(() => pool.submit("k", 1)).toThrow(/не запущен/);
    expect(() => new KeyedWorkerPool<number>(async () => {}, { workers: 0 })).toThrow(RangeError);
  });
});
