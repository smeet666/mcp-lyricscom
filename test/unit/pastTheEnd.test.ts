/**
 * What an answer says when it cannot give what was asked for.
 *
 * Three cases here, and each one currently states something the data does not
 * support: an empty body read as a song without words, a result list that calls
 * everything in it a match, and a page number offered that the schema refuses.
 */

import { describe, expect, it } from "vitest";
import { runGetLyrics } from "../../src/tools/getLyrics.js";
import { runSearchSongs } from "../../src/tools/searchSongs.js";
import { runSearchLyrics } from "../../src/tools/searchLyrics.js";
import { searchLyricsInputShape } from "../../src/tools/searchLyrics.js";
import type { LyricsComClient } from "../../src/lyricscom/client.js";

const textOf = (result: any) => result.content[0].text as string;

const BODY = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");

const lyricsClient = (): LyricsComClient =>
  ({
    getSong: async () => ({
      data: {
        id: "1",
        url: "https://www.lyrics.com/lyric/1",
        title: "A Song",
        artist: "An Artist",
        lyrics: BODY,
        hasLyrics: true,
      },
      cached: false,
    }),
  }) as unknown as LyricsComClient;

describe("an offset past the end of the words", () => {
  const call = (offset: number) =>
    runGetLyrics(lyricsClient(), { id: "1", max_chars: 4000, offset } as never);

  it("is not reported as a song with nothing on file", async () => {
    const result: any = await call(999_999);

    expect(
      (result.structuredContent.notes as string[]).join(" "),
      "an empty body with no explanation reads as a song without words",
    ).toMatch(/past the end/i);
  });

  it("says so in the text block, where a client may read nothing else", async () => {
    const text = textOf(await call(999_999));

    expect(text, "'Complete.' over an empty body states the opposite of what happened").not.toMatch(
      /^Complete\.$/m,
    );
    expect(text).toMatch(/past the end/i);
  });

  it("still reads normally from a position inside the words", async () => {
    const result: any = await call(10);

    expect(result.structuredContent.returned_chars).toBeGreaterThan(0);
    expect((result.structuredContent.notes as string[]).join(" ")).not.toMatch(/past the end/i);
  });
});

describe("a result list from a loose title search", () => {
  const songsClient = (): LyricsComClient =>
    ({
      search: async () => ({
        data: {
          results: [
            {
              id: "953198",
              url: "https://www.lyrics.com/lyric/953198",
              title: "Mortal Man",
              artist: "Kendrick Lamar",
            },
          ],
          page: 1,
          rawCount: 24,
          hasMore: false,
        },
        cached: false,
      }),
    }) as unknown as LyricsComClient;

  it("does not call a row a match when its title is not the one asked for", async () => {
    // The site's loose mode returns its own guesses. Presenting them as songs
    // "matching" the query is how a model comes to quote one song's words for
    // another.
    const result: any = await runSearchSongs(songsClient(), {
      title: "Luther",
      match: "loose",
      limit: 5,
      page: 1,
    } as never);

    expect(
      textOf(result),
      "a row whose title is not the query must not be announced as matching it",
    ).not.toMatch(/matching "Luther"/i);
  });

  it("says that the site chose these, so a caller checks before quoting", async () => {
    const result: any = await runSearchSongs(songsClient(), {
      title: "Luther",
      match: "loose",
      limit: 5,
      page: 1,
    } as never);

    expect((result.structuredContent.notes as string[]).join(" ")).toMatch(
      /loose|does not contain|title/i,
    );
  });
});

describe("the page a search offers next", () => {
  it("is never one the schema would refuse", async () => {
    // Offering a page beyond the accepted range sends a caller into an error
    // it was told to expect a result from.
    expect(
      JSON.stringify(searchLyricsInputShape.page),
      "the page argument is bounded at 20, which is what makes offering 21 a lie",
    ).toBeTruthy();

    const client = (): LyricsComClient =>
      ({
        search: async () => ({
          data: { results: [], page: 20, rawCount: 0, hasMore: true },
          cached: false,
        }),
      }) as unknown as LyricsComClient;

    const result: any = await runSearchLyrics(client(), {
      query: "a word",
      limit: 5,
      page: 20,
      verify: "none",
    } as never);

    expect(
      result.structuredContent.next_page,
      "page 21 is refused by the schema, so it must not be offered",
    ).toBeNull();
    expect(textOf(result)).not.toMatch(/page=21/);
  });
});
