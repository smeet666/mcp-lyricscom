import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../src/lyricscom/rateLimiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs tasks in call order, one at a time", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });
    const order: number[] = [];
    const tasks = [1, 2, 3].map((n) =>
      limiter.schedule(async () => {
        await limiter.beforeRequest();
        order.push(n);
        return n;
      }),
    );
    await vi.runAllTimersAsync();
    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3]);
  });

  it("spaces task starts by at least the minimum interval", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000 });
    const starts: number[] = [];
    const record = () =>
      limiter.schedule(async () => {
        await limiter.beforeRequest();
        starts.push(Date.now());
      });

    const all = Promise.all([record(), record(), record()]);
    await vi.runAllTimersAsync();
    await all;

    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(1000);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(1000);
  });

  it("keeps draining after a task rejects", async () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });
    const failing = limiter.schedule(async () => {
      throw new Error("boom");
    });
    const following = limiter.schedule(async () => "survived");

    await vi.runAllTimersAsync();
    await expect(failing).rejects.toThrow("boom");
    await expect(following).resolves.toBe("survived");
  });

  it("doubles the interval under pressure and decays back to the base", () => {
    const limiter = new RateLimiter({ minIntervalMs: 1000, maxIntervalMs: 8000 });
    expect(limiter.currentIntervalMs).toBe(1000);

    limiter.penalize();
    expect(limiter.currentIntervalMs).toBe(2000);
    limiter.penalize();
    expect(limiter.currentIntervalMs).toBe(4000);

    limiter.penalize();
    limiter.penalize();
    expect(limiter.currentIntervalMs).toBe(8000);

    for (let i = 0; i < 20; i += 1) limiter.relax();
    expect(limiter.currentIntervalMs).toBe(1000);
  });

  it("still backs off when the configured interval is zero", () => {
    const limiter = new RateLimiter({ minIntervalMs: 0 });
    limiter.penalize();
    expect(limiter.currentIntervalMs).toBeGreaterThan(0);
  });
});
