/**
 * Live smoke test against the real lyrics.com.
 *
 * Excluded from CI on purpose: it depends on a third-party site, and running it
 * from shared runners would put pointless load on lyrics.com. Enable it locally
 * with LYRICSCOM_LIVE=1. It makes at most four requests, paced by the real rate
 * limiter.
 */

import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { LyricsComClient } from "../../src/lyricscom/client.js";

const enabled = process.env.LYRICSCOM_LIVE === "1";

describe.runIf(enabled)("live lyrics.com", () => {
  const client = new LyricsComClient({
    config: loadConfig(),
    logger: createLogger("info"),
  });

  it("searches, then reads the first result", async () => {
    const search = await client.search("autrefois", 1);
    expect(search.data.results.length).toBeGreaterThan(0);

    // Every row lyrics.com renders should be readable. A gap here means a row
    // shape the parser does not know about yet.
    expect(search.data.results.length).toBe(search.data.rawCount);

    const first = search.data.results[0]!;
    expect(first.id).toMatch(/^\d+$/);
    expect(first.url).toContain("lyrics.com");
    expect(first.title).not.toBe("");
    expect(first.artist).not.toBe("");

    const song = await client.getSong({ id: first.id });
    expect(song.data.url).toContain("lyrics.com");
    if (song.data.hasLyrics) {
      expect(song.data.lyrics.length).toBeGreaterThan(0);
      expect(song.data.lyrics).not.toContain("<a ");
    }
  }, 60_000);

  it("serves a repeated request from cache without a second request", async () => {
    const first = await client.search("joie", 1);
    const second = await client.search("joie", 1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  }, 60_000);
});
