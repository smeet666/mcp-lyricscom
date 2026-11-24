/**
 * A search page that arrives without its results must not be remembered as an
 * empty search: the next request for the same query goes back to lyrics.com.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { LyricsComError } from "../../src/errors.js";
import { LyricsComClient } from "../../src/lyricscom/client.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

function sequencedFetch(bodies: string[]): { fetchImpl: typeof fetch; calls: () => number } {
  let served = 0;
  const fetchImpl = (async () => {
    const body = bodies[Math.min(served, bodies.length - 1)]!;
    served += 1;
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => served };
}

function clientWith(fetchImpl: typeof fetch): LyricsComClient {
  return new LyricsComClient({
    config: { ...loadConfig({}), minIntervalMs: 0, maxRetries: 0, logLevel: "silent" as const },
    logger: createLogger("silent"),
    fetchImpl,
  });
}

describe("search recovery after a page without results", () => {
  it("reports parse_failure, then reads the full page on the next request", async () => {
    const { fetchImpl, calls } = sequencedFetch([
      load("serp-shell-no-rows.html"),
      load("serp-page1.html"),
    ]);
    const client = clientWith(fetchImpl);

    const first = await client.search("autrefois", 1).catch((error: unknown) => error);
    expect(first).toBeInstanceOf(LyricsComError);
    expect((first as LyricsComError).code).toBe("parse_failure");

    const second = await client.search("autrefois", 1);
    expect(second.cached).toBe(false);
    expect(second.data.rawCount).toBeGreaterThan(0);
    expect(calls()).toBe(2);
  });

  it("keeps a search the site declared empty as an empty result", async () => {
    const { fetchImpl } = sequencedFetch([load("serp-empty.html")]);
    const result = await clientWith(fetchImpl).search("zqxjvwkpqzz", 1);
    expect(result.data.results).toEqual([]);
    expect(result.data.hasMore).toBe(false);
  });
});
