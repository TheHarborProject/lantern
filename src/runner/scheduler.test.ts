import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./scheduler.js";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
}

/** Manual promise gate: lets tests drive job completion without arbitrary sleeps. */
function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Gate {
  readonly started: Deferred<void>;
  readonly release: Deferred<void>;
}

describe("runWithConcurrency", () => {
  it("exécute séquentiellement avec concurrency = 1 (au plus un job actif, ordre préservé)", async () => {
    const jobCount = 4;
    const order: number[] = [];
    let active = 0;
    let maxActive = 0;
    const gates: Gate[] = Array.from({ length: jobCount }, () => ({
      started: createDeferred<void>(),
      release: createDeferred<void>(),
    }));

    const jobs = gates.map((gate, index) => async (): Promise<number> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(index);
      gate.started.resolve();
      await gate.release.promise;
      active -= 1;
      return index;
    });

    const pending = runWithConcurrency(jobs, 1);

    for (const gate of gates) {
      await gate.started.promise;
      expect(active).toBe(1);
      gate.release.resolve();
    }

    const outcomes = await pending;

    expect(maxActive).toBe(1);
    expect(order).toEqual([0, 1, 2, 3]);
    expect(outcomes.map((outcome) => (outcome.status === "fulfilled" ? outcome.value : null))).toEqual(
      [0, 1, 2, 3],
    );
  });

  it("respecte strictement la limite avec concurrency = N (jamais plus de N jobs actifs)", async () => {
    const jobCount = 6;
    const concurrency = 2;
    let active = 0;
    let maxActive = 0;
    const gates: Gate[] = Array.from({ length: jobCount }, () => ({
      started: createDeferred<void>(),
      release: createDeferred<void>(),
    }));

    const jobs = gates.map((gate, index) => async (): Promise<number> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      gate.started.resolve();
      await gate.release.promise;
      active -= 1;
      return index;
    });

    const pending = runWithConcurrency(jobs, concurrency);

    for (const gate of gates) {
      await gate.started.promise;
      expect(active).toBeLessThanOrEqual(concurrency);
      gate.release.resolve();
    }

    const outcomes = await pending;

    expect(maxActive).toBe(concurrency);
    expect(outcomes).toHaveLength(jobCount);
  });

  it("consomme toute la file : chaque job est exécuté exactement une fois", async () => {
    const executed: number[] = [];
    const jobs = Array.from({ length: 10 }, (_unused, index) => (): Promise<number> => {
      executed.push(index);
      return Promise.resolve(index);
    });

    const outcomes = await runWithConcurrency(jobs, 3);

    expect(outcomes).toHaveLength(10);
    expect([...executed].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
  });

  it("un job en échec libère son créneau et n'interrompt pas les jobs suivants", async () => {
    const jobs = [
      (): Promise<string> => Promise.resolve("a"),
      (): Promise<string> => Promise.reject(new Error("boom")),
      (): Promise<string> => Promise.resolve("c"),
      (): Promise<string> => Promise.resolve("d"),
    ];

    const outcomes = await runWithConcurrency(jobs, 2);

    expect(outcomes).toHaveLength(4);
    expect(outcomes[0]).toEqual({ index: 0, status: "fulfilled", value: "a" });

    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.index).toBe(1);
    if (rejected?.status === "rejected") {
      expect((rejected.reason as Error).message).toBe("boom");
    }

    expect(outcomes[2]).toEqual({ index: 2, status: "fulfilled", value: "c" });
    expect(outcomes[3]).toEqual({ index: 3, status: "fulfilled", value: "d" });
  });

  it("associe chaque résultat à son job d'origine, indépendamment de l'ordre de complétion", async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const third = createDeferred<string>();

    const pending = runWithConcurrency(
      [
        (): Promise<string> => first.promise,
        (): Promise<string> => second.promise,
        (): Promise<string> => third.promise,
      ],
      3,
    );

    // Complétion volontairement dans le désordre.
    third.resolve("c");
    first.resolve("a");
    second.resolve("b");

    const outcomes = await pending;

    expect(outcomes.map((outcome) => outcome.index)).toEqual([0, 1, 2]);
    expect(outcomes.map((outcome) => (outcome.status === "fulfilled" ? outcome.value : null))).toEqual(
      ["a", "b", "c"],
    );
  });

  it("retourne un tableau vide sans job", async () => {
    expect(await runWithConcurrency([], 4)).toEqual([]);
  });

  it("rejette une concurrency non entière ou < 1", async () => {
    await expect(runWithConcurrency([], 0)).rejects.toBeInstanceOf(RangeError);
    await expect(runWithConcurrency([], -1)).rejects.toBeInstanceOf(RangeError);
    await expect(runWithConcurrency([], 1.5)).rejects.toBeInstanceOf(RangeError);
  });
});
