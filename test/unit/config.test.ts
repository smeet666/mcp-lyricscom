import { describe, expect, it } from "vitest";
import { DEFAULTS, loadConfig, MIN_ALLOWED_INTERVAL_MS } from "../../src/config.js";

describe("loadConfig", () => {
  it("uses the defaults when nothing is set", () => {
    const config = loadConfig({});
    expect(config.minIntervalMs).toBe(DEFAULTS.minIntervalMs);
    expect(config.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(config.userAgent).toContain("mcp-lyricscom/");
  });

  it("accepts an interval at or above the floor", () => {
    expect(loadConfig({ LYRICSCOM_MIN_INTERVAL_MS: "2000" }).minIntervalMs).toBe(2000);
    expect(
      loadConfig({ LYRICSCOM_MIN_INTERVAL_MS: String(MIN_ALLOWED_INTERVAL_MS) }).minIntervalMs,
    ).toBe(MIN_ALLOWED_INTERVAL_MS);
  });

  it("ignores an interval below the floor and keeps the default", () => {
    // Falling back to the default rather than to the floor is deliberate: a
    // request for no pacing is not a request for the minimum pacing.
    for (const value of ["0", "1", "100", "-500"]) {
      expect(loadConfig({ LYRICSCOM_MIN_INTERVAL_MS: value }).minIntervalMs).toBe(
        DEFAULTS.minIntervalMs,
      );
    }
  });

  it("ignores a non-numeric interval", () => {
    expect(loadConfig({ LYRICSCOM_MIN_INTERVAL_MS: "fast" }).minIntervalMs).toBe(
      DEFAULTS.minIntervalMs,
    );
  });

  it("caps an absurdly large interval", () => {
    expect(loadConfig({ LYRICSCOM_MIN_INTERVAL_MS: "999999999" }).minIntervalMs).toBe(60_000);
  });

  it("never crashes on malformed values", () => {
    const config = loadConfig({
      LYRICSCOM_TIMEOUT_MS: "nonsense",
      LYRICSCOM_MAX_RETRIES: "-4",
      LYRICSCOM_CACHE_TTL_MS: "",
      LYRICSCOM_LOG_LEVEL: "chatty",
    });
    expect(config.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(config.maxRetries).toBe(0);
    expect(config.cacheTtlMs).toBe(DEFAULTS.cacheTtlMs);
    expect(config.logLevel).toBe(DEFAULTS.logLevel);
  });

  it("honours a custom user agent", () => {
    expect(loadConfig({ LYRICSCOM_USER_AGENT: "custom/1.0" }).userAgent).toBe("custom/1.0");
  });
});
