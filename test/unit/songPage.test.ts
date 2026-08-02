import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LyricsComError } from "../../src/errors.js";
import { parseSongPage } from "../../src/lyricscom/parsers/songPage.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const OPTS = { id: "1000001", url: "https://www.lyrics.com/lyric-lf/1000001/Artist+1/Song" };

describe("parseSongPage", () => {
  it("reads the lyrics container along with the title and artist", () => {
    const page = parseSongPage(load("song-with-lyrics.html"), OPTS);
    expect(page.hasLyrics).toBe(true);
    expect(page.title).toBe("Placeholder Song 1");
    expect(page.artist).toBe("Artist 1");
  });

  it("unwraps the dictionary anchors while preserving line structure", () => {
    // lyrics.com links individual words to its dictionary. Unwrapping those must
    // not merge lines together, which is what makes the raw-HTML approach
    // necessary instead of DOM removal.
    const page = parseSongPage(load("song-with-lyrics.html"), OPTS);
    expect(page.lyrics).not.toContain("<a");
    expect(page.lyrics).not.toContain("href");
    const lines = page.lyrics.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Placeholder first line of text");
    expect(lines[1]).toBe("Second placeholder line mentioning joie clearly");
    expect(lines[2]).toBe("");
    expect(lines[4]).toBe("Fourth final placeholder line");
  });

  it("falls back to the class-only lyrics container", () => {
    const page = parseSongPage(load("song-fallback-body.html"), { ...OPTS, id: "1000002" });
    expect(page.hasLyrics).toBe(true);
    expect(page.lyrics).toBe("Only placeholder line here");
    expect(page.title).toBe("Placeholder Song 2");
  });

  it("reports a page with no lyrics as an answer, not an error", () => {
    const page = parseSongPage(load("song-no-lyrics.html"), OPTS);
    expect(page.hasLyrics).toBe(false);
    expect(page.lyrics).toBe("");
    expect(page.url).toBe(OPTS.url);
  });

  it("raises parse_failure when the container vanished without a no-lyrics marker", () => {
    try {
      parseSongPage(load("song-broken.html"), OPTS);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LyricsComError);
      expect((error as LyricsComError).code).toBe("parse_failure");
    }
  });
});
