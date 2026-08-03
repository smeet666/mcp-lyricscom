/**
 * Live canary against the real lyrics.com.
 *
 * The unit tests run against frozen HTML fixtures. They prove the parser reads a
 * given markup correctly, and they can never tell that lyrics.com changed that
 * markup: the day the site alters its class names, every fixture test stays
 * green while the published server is broken for everyone. This file is the only
 * thing that catches that, so it runs on a schedule in CI and asserts each
 * selector the parser depends on, individually, so a failure names what moved.
 *
 * Excluded from the ordinary CI run: enable with LYRICSCOM_LIVE=1.
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

  it("still parses every row of a search page", async () => {
    const search = await client.search("autrefois", 1);

    expect(
      search.data.rawCount,
      "lyrics.com returned no result rows at all: div.sec-lyric may have been renamed",
    ).toBeGreaterThan(0);

    // A gap between rows found and rows read means a row shape the parser does
    // not know about, which is how the artist selector silently lost 8% of
    // results before it was caught.
    expect(
      search.data.results.length,
      `${search.data.rawCount} rows on the page but only ${search.data.results.length} could be read`,
    ).toBe(search.data.rawCount);

    const first = search.data.results[0]!;
    expect(first.id, "song id missing: the /lyric-lf/ href shape may have changed").toMatch(
      /^\d+$/,
    );
    expect(first.title, "title empty: p.lyric-meta-title may have moved").not.toBe("");
    expect(first.artist, "artist empty: the artist selectors may have moved").not.toBe("");
    expect(
      first.snippet,
      "no snippet on any row: pre.lyric-body may have moved, which would break search filtering",
    ).toBeTruthy();
  }, 120_000);

  it("still finds album and year on at least one row", async () => {
    // These are sparse per row but never absent from a whole page. Losing them
    // everywhere means the meta block was restructured.
    const search = await client.search("joie", 1);
    expect(
      search.data.results.some((song) => song.album !== null),
      "no row carried an album: p.lyric-meta-album may have moved",
    ).toBe(true);
    expect(
      search.data.results.some((song) => song.year !== null),
      "no row carried a year: p.lyric-meta-album-year may have moved",
    ).toBe(true);
  }, 120_000);

  it("still extracts full lyrics from a song page", async () => {
    const search = await client.search("autrefois", 1);
    const withSnippet = search.data.results.find((song) => song.snippet)!;
    const song = await client.getSong({ id: withSnippet.id });

    expect(song.data.url).toContain("lyrics.com");

    if (song.data.hasLyrics) {
      expect(song.data.lyrics.length, "lyrics container found but empty").toBeGreaterThan(0);
      // lyrics.com links individual words to its dictionary; the parser unwraps
      // those anchors in the raw HTML to keep line breaks intact.
      expect(song.data.lyrics, "anchor unwrapping failed").not.toContain("<a ");
      expect(song.data.lyrics, "HTML leaked into the lyrics text").not.toContain("</");
      expect(
        song.data.lyrics.split("\n").length,
        "lyrics came back as a single line: the line structure was lost",
      ).toBeGreaterThan(1);
    }
  }, 120_000);

  it("serves a repeated request from cache without a second request", async () => {
    const first = await client.search("matin", 1);
    const second = await client.search("matin", 1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  }, 120_000);
});
