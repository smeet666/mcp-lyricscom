import { describe, expect, it } from "vitest";
import { LyricsComError } from "../../src/errors.js";
import {
  buildSearchUrl,
  extractSongId,
  isLyricsComHost,
  resolveSongRef,
} from "../../src/lyricscom/urls.js";

describe("buildSearchUrl", () => {
  it("uses the path form for page 1 and the query form afterwards", () => {
    expect(buildSearchUrl("joie", 1)).toBe("https://www.lyrics.com/lyrics/joie");
    expect(buildSearchUrl("joie", 2)).toBe("https://www.lyrics.com/serp.php?st=joie&p=2");
  });

  it("encodes spaces as plus and escapes the rest", () => {
    expect(buildSearchUrl("hello darkness", 1)).toBe(
      "https://www.lyrics.com/lyrics/hello+darkness",
    );
    expect(buildSearchUrl("rock & roll", 1)).toBe("https://www.lyrics.com/lyrics/rock+%26+roll");
    expect(buildSearchUrl("été", 1)).toBe("https://www.lyrics.com/lyrics/%C3%A9t%C3%A9");
  });
});

describe("isLyricsComHost", () => {
  it("accepts lyrics.com with or without the www prefix", () => {
    expect(isLyricsComHost("https://www.lyrics.com/lyric-lf/1/a/b")).toBe(true);
    expect(isLyricsComHost("https://lyrics.com/lyric-lf/1/a/b")).toBe(true);
  });

  it("rejects lookalike and internal hosts", () => {
    expect(isLyricsComHost("https://lyrics.com.evil.com/lyric-lf/1/a/b")).toBe(false);
    expect(isLyricsComHost("https://evil.com/lyrics.com/1")).toBe(false);
    expect(isLyricsComHost("http://127.0.0.1:8080/lyric-lf/1/a/b")).toBe(false);
    expect(isLyricsComHost("file:///etc/passwd")).toBe(false);
    expect(isLyricsComHost("not a url")).toBe(false);
  });
});

describe("extractSongId", () => {
  it("reads both URL shapes, absolute or relative", () => {
    expect(extractSongId("/lyric-lf/1128428/Nino+Ferrer/Le+sud")).toBe("1128428");
    expect(extractSongId("/lyric/22098455/John+Lennon/Imagine")).toBe("22098455");
    expect(extractSongId("https://www.lyrics.com/lyric-lf/732119/Edith+Piaf/X")).toBe("732119");
  });

  it("returns null for anything that is not a song page", () => {
    expect(extractSongId("/artist/Coldplay")).toBeNull();
    expect(extractSongId("https://evil.com/lyric-lf/1/a/b")).toBeNull();
  });
});

describe("resolveSongRef", () => {
  it("prefers the id and builds a canonical URL", () => {
    expect(resolveSongRef({ id: "1128428" })).toEqual({
      id: "1128428",
      url: "https://www.lyrics.com/lyric-lf/1128428/",
    });
  });

  it("accepts a lyrics.com song URL", () => {
    const url = "https://www.lyrics.com/lyric-lf/1128428/Nino+Ferrer/Le+sud";
    expect(resolveSongRef({ url })).toEqual({ id: "1128428", url });
  });

  it("rejects a foreign host", () => {
    expect(() => resolveSongRef({ url: "https://evil.com/lyric-lf/1/a/b" })).toThrow(
      LyricsComError,
    );
    try {
      resolveSongRef({ url: "https://evil.com/lyric-lf/1/a/b" });
    } catch (error) {
      expect((error as LyricsComError).code).toBe("invalid_input");
    }
  });

  it("rejects a non-numeric id and a missing reference", () => {
    expect(() => resolveSongRef({ id: "abc" })).toThrow(LyricsComError);
    expect(() => resolveSongRef({})).toThrow(LyricsComError);
  });
});
