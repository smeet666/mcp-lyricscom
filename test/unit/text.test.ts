import { describe, expect, it } from "vitest";
import { dedupeSongs, songKey } from "../../src/text/dedupe.js";
import { findMatchingLine, matchedLineExcerpt } from "../../src/text/excerpt.js";
import { cleanInlineText, cleanLyricsText, unescapeHtml } from "../../src/text/normalize.js";
import type { SongResult } from "../../src/types.js";

function song(partial: Partial<SongResult>): SongResult {
  return {
    id: "1",
    url: "https://www.lyrics.com/lyric-lf/1/a/b",
    title: "Title",
    artist: "Artist",
    album: null,
    year: null,
    snippet: null,
    ...partial,
  };
}

describe("normalize", () => {
  it("decodes named and numeric entities", () => {
    expect(unescapeHtml("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(unescapeHtml("caf&#233;")).toBe("café");
    expect(unescapeHtml("caf&#xe9;")).toBe("café");
    expect(unescapeHtml("l&rsquo;enfant")).toBe("l’enfant");
  });

  it("repairs UTF-8 read as Latin-1", () => {
    expect(cleanInlineText("CafÃ© de la Ã©toile")).toBe("Café de la étoile");
  });

  it("leaves correct accented text untouched", () => {
    expect(cleanInlineText("Café de l’été")).toBe("Café de l’été");
  });

  it("collapses whitespace in inline text", () => {
    expect(cleanInlineText("  Some   Title \n ")).toBe("Some Title");
  });

  it("keeps single blank lines as verse separators and drops the rest", () => {
    const raw = "\n\n  one  \n\n\n  two  \n\nthree\n\n\n";
    expect(cleanLyricsText(raw)).toBe("one\n\ntwo\n\nthree");
  });
});

describe("songKey and dedupeSongs", () => {
  it("collapses bracketed and parenthesised editions of the same recording", () => {
    expect(songKey("Artist 1", "Song [Deluxe]")).toBe(songKey("Artist 1", "Song"));
    expect(songKey("Artist 1", "Song (Remastered)")).toBe(songKey("Artist 1", "Song"));
  });

  it("keeps different artists apart", () => {
    expect(songKey("Artist 1", "Song")).not.toBe(songKey("Artist 2", "Song"));
  });

  it("keeps the first occurrence and preserves order", () => {
    const result = dedupeSongs([
      song({ id: "1", title: "Song" }),
      song({ id: "2", title: "Song [Deluxe]" }),
      song({ id: "3", title: "Other" }),
    ]);
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });
});

describe("excerpt", () => {
  const text = "premiere ligne neutre\nla deuxieme parle de joie ici\n\nquatrieme ligne";

  it("finds the line carrying the keyword, 1-based", () => {
    expect(findMatchingLine(text, "joie")).toEqual({
      line: "la deuxieme parle de joie ici",
      lineNumber: 2,
    });
  });

  it("returns null when the keyword is absent", () => {
    expect(findMatchingLine(text, "absent")).toBeNull();
  });

  it("falls back to the first non-empty line", () => {
    expect(matchedLineExcerpt(text, "absent")).toBe("premiere ligne neutre");
  });

  it("windows a long line around the match", () => {
    const long = `${"filler ".repeat(40)}joie${" filler".repeat(40)}`;
    const excerpt = matchedLineExcerpt(long, "joie", { maxChars: 40 })!;
    expect(excerpt).toContain("joie");
    expect(excerpt.length).toBeLessThanOrEqual(44);
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
