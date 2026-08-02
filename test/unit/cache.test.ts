import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlLruCache } from "../../src/lyricscom/cache.js";

describe("TtlLruCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and returns a value", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "value");
    expect(cache.get("a")).toBe("value");
  });

  it("expires entries once the TTL has passed", () => {
    const cache = new TtlLruCache<string>(10, 1000);
    cache.set("a", "value");
    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe("value");
    vi.advanceTimersByTime(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entry when full", () => {
    const cache = new TtlLruCache<string>(2, 10_000);
    cache.set("a", "1");
    cache.set("b", "2");
    // Reading "a" makes "b" the least recently used one.
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3");

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
  });

  it("is disabled when capacity or TTL is zero", () => {
    const noCapacity = new TtlLruCache<string>(0, 1000);
    noCapacity.set("a", "1");
    expect(noCapacity.get("a")).toBeUndefined();

    const noTtl = new TtlLruCache<string>(10, 0);
    noTtl.set("a", "1");
    expect(noTtl.get("a")).toBeUndefined();
  });
});
