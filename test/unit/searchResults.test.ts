import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LyricsComError } from "../../src/errors.js";
import { parseSearchResults } from "../../src/lyricscom/parsers/searchResults.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const OPTS = { page: 1, url: "https://www.lyrics.com/lyrics/joie" };

describe("parseSearchResults", () => {
  it("reads every well-formed row and skips the unusable one", () => {
    const page = parseSearchResults(load("serp-page1.html"), OPTS);
    // 24 regular rows plus the bracketed duplicate; the titleless row is dropped.
    expect(page.results).toHaveLength(25);
    expect(page.rawCount).toBe(26);
  });

  it("extracts fields from a row", () => {
    const { results } = parseSearchResults(load("serp-page1.html"), OPTS);
    const first = results[0]!;
    expect(first).toMatchObject({
      id: "1000001",
      title: "Placeholder Song 1",
      artist: "Artist 1",
      album: expect.stringContaining("Placeholder Album 1"),
      year: 1971,
      url: "https://www.lyrics.com/lyric-lf/1000001/Artist+1/Placeholder+Song+1",
    });
    expect(first.snippet).toContain("joie");
  });

  it("leaves album and year null when the row omits them", () => {
    const { results } = parseSearchResults(load("serp-page1.html"), OPTS);
    const second = results[1]!;
    expect(second.album).toBeNull();
    expect(second.year).toBeNull();
  });

  it("reads the artist from both row shapes", () => {
    // Rows without an album put the artist under `lyric-meta-artists` instead of
    // `lyric-meta-album-artist`. Handling only the first shape silently drops
    // roughly one result in twelve on the live site.
    const { results } = parseSearchResults(load("serp-page1.html"), OPTS);
    expect(results.map((r) => r.id)).toContain("1000017");
    expect(results.map((r) => r.id)).toContain("1000023");
    expect(results.find((r) => r.id === "1000017")?.artist).toBe("Artist 17");
  });

  it("extracts ids from both the current and the legacy URL shape", () => {
    const { results } = parseSearchResults(load("serp-page1.html"), OPTS);
    const legacy = results.filter((r) => r.url.includes("/lyric/"));
    expect(legacy).toHaveLength(2);
    expect(legacy[0]!.id).toMatch(/^\d+$/);
  });

  it("reports has_more when the page is full", () => {
    const page = parseSearchResults(load("serp-page1.html"), OPTS);
    expect(page.hasMore).toBe(true);
  });

  it("returns an empty result set, not an error, when the search found nothing", () => {
    const page = parseSearchResults(load("serp-empty.html"), OPTS);
    expect(page.results).toEqual([]);
    expect(page.rawCount).toBe(0);
    expect(page.hasMore).toBe(false);
  });

  it("raises parse_failure when the page is not a search page at all", () => {
    // The distinction that matters: unknown markup must never be reported as
    // "no songs found", because that is indistinguishable from a real answer.
    try {
      parseSearchResults(load("serp-unrecognized.html"), OPTS);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LyricsComError);
      expect((error as LyricsComError).code).toBe("parse_failure");
    }
  });
});
