import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./lib/concurrency";

describe("bounded concurrency", () => {
  it("drains in-flight work before reporting the first failure", async () => {
    const failure = deferred<void>();
    const slowWork = deferred<void>();
    const slowStarted = deferred<void>();
    const events: string[] = [];
    let settled = false;

    const operation = mapWithConcurrency(["failing", "slow", "not-started"], 2, async (value) => {
      if (value === "failing") {
        await failure.promise;
        events.push("failed");
        throw new Error("boom");
      }
      if (value === "slow") {
        slowStarted.resolve(undefined);
        await slowWork.promise;
        events.push("slow-finished");
      }
      return value;
    }).finally(() => {
      settled = true;
    });

    await slowStarted.promise;
    failure.resolve(undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    slowWork.resolve(undefined);
    await expect(operation).rejects.toThrow("boom");
    expect(events).toEqual(["failed", "slow-finished"]);
  });

  it("preserves an undefined rejection reason", async () => {
    const operation = mapWithConcurrency(["failing"], 1, async () => Promise.reject(undefined));

    await expect(operation).rejects.toBeUndefined();
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
