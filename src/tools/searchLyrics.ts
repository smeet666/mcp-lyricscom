/**
 * search_lyrics: find songs by a word or phrase occurring in the lyrics.
 */

import { z } from "zod";
import type { LyricsComClient } from "../lyricscom/client.js";
import { dedupeSongs } from "../text/dedupe.js";
import { matchedLineExcerpt } from "../text/excerpt.js";
import { containsWord } from "../text/keywordIndex.js";
import type { SongResult } from "../types.js";
import { strictInput } from "./arguments.js";
import {
  MAX_PAGE,
  ok,
  renderResultList,
  songResultSchema,
  toSongResultOut,
  toToolError,
} from "./shared.js";
import type { ToolResult } from "./shared.js";

/** Verifying against full lyrics costs one page fetch per candidate. */
const MAX_FULL_VERIFICATIONS = 5;

export const searchLyricsDescription = [
  "Search lyrics.com for songs whose lyrics contain a given word or phrase.",
  "Returns matching songs with artist, title, a short excerpt of the line where the word appears,",
  "and the lyrics.com id and URL needed to fetch the full text with get_lyrics.",
  "Use this when someone remembers a fragment of lyrics but not the song, or wants songs mentioning a word or theme.",
  "One call returns one page of lyrics.com results; to see more, increase 'page' rather than 'limit'.",
  "lyrics.com also returns loose and title-only matches, so results are filtered locally to keep only songs",
  "where the word genuinely appears in the lyrics. Set 'verify' to \"none\" to see the raw, unfiltered list.",
].join(" ");

export const searchLyricsInput = strictInput({
  query: z
    .string()
    .min(1)
    .max(120)
    .describe("Word or short phrase to look for inside the lyrics, for example 'autrefois'."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum songs to return from this page."),
  page: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(1)
    .describe("Result page on lyrics.com. Each page holds up to 24 raw results."),
  verify: z
    .enum(["snippet", "full", "none"])
    .default("snippet")
    .describe(
      "How to confirm the query really appears in the lyrics. 'snippet' checks the excerpt lyrics.com already " +
        "returned and costs nothing. 'full' fetches up to 5 song pages and checks the complete lyrics, which is " +
        "slow and can trigger rate limiting. 'none' disables filtering.",
    ),
  include_excerpt: z
    .boolean()
    .default(true)
    .describe("Include the matching lyric line excerpt in each result."),
});

export const searchLyricsOutputShape = {
  query: z.string(),
  page: z.number().int(),
  results: z.array(songResultSchema),
  raw_result_count: z
    .number()
    .int()
    .describe("Rows lyrics.com returned before local filtering and deduplication."),
  filtered_out: z
    .number()
    .int()
    .describe("Rows dropped because the query was not found in their lyrics."),
  has_more: z.boolean(),
  next_page: z.number().int().nullable(),
  source: z.literal("lyrics.com"),
  notes: z
    .array(z.string())
    .describe("Caveats worth knowing, such as a cache hit or partial verification."),
};

export interface SearchLyricsArgs {
  query: string;
  limit: number;
  page: number;
  verify: "snippet" | "full" | "none";
  include_excerpt: boolean;
}

export async function runSearchLyrics(
  client: LyricsComClient,
  args: SearchLyricsArgs,
): Promise<ToolResult> {
  try {
    const { data, cached } = await client.search(args.query, args.page);
    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");

    const unique = dedupeSongs(data.results);
    const kept: Array<{ song: SongResult; excerpt: string | null }> = [];
    let filteredOut = 0;
    let fullChecks = 0;

    for (const song of unique) {
      if (kept.length >= args.limit) break;

      let text = song.snippet ?? "";

      if (args.verify === "full" && fullChecks < MAX_FULL_VERIFICATIONS) {
        fullChecks += 1;
        try {
          const page = await client.getSong({ id: song.id });
          if (page.data.hasLyrics) text = page.data.lyrics;
        } catch (error) {
          // A single unreadable song page must not sink the whole search.
          notes.push(`Could not verify "${song.title}" against its full lyrics.`);
          void error;
        }
      }

      const matches = args.verify === "none" || (text !== "" && containsWord(args.query, text));
      if (!matches) {
        filteredOut += 1;
        continue;
      }

      const excerpt =
        args.include_excerpt && text
          ? matchedLineExcerpt(text, args.query, { maxChars: 160 })
          : null;
      kept.push({ song, excerpt });
    }

    if (args.verify === "full" && unique.length > MAX_FULL_VERIFICATIONS) {
      notes.push(
        `Full verification is capped at ${MAX_FULL_VERIFICATIONS} songs per call to avoid rate limiting; ` +
          "the remaining results were checked against their search excerpt.",
      );
    }
    if (kept.length === 0 && data.rawCount > 0) {
      notes.push(
        "lyrics.com returned results but none of them actually contain the query in their lyrics. " +
          'Try verify="none" to see the raw matches.',
      );
    }

    const results = kept.map((entry) => toSongResultOut(entry.song, entry.excerpt));
    const structured = {
      query: args.query,
      page: args.page,
      results,
      raw_result_count: data.rawCount,
      filtered_out: filteredOut,
      has_more: data.hasMore,
      next_page: data.hasMore && args.page < MAX_PAGE ? args.page + 1 : null,
      source: "lyrics.com" as const,
      notes,
    };

    const header =
      results.length > 0
        ? `${results.length} song(s) on page ${args.page} for "${args.query}":`
        : `No song on page ${args.page} matched "${args.query}".`;
    // The footer may only name a page the schema would accept, or it sends a
    // caller into an argument that is refused.
    const footer =
      data.hasMore && args.page < MAX_PAGE
        ? `\n\nMore results available: call again with page=${args.page + 1}.`
        : data.hasMore
          ? `\n\nlyrics.com holds more, but page ${MAX_PAGE} is as far as this tool reads. Narrow the query instead.`
          : "";

    return ok(structured, `${header}\n${renderResultList(results)}${footer}`);
  } catch (error) {
    return toToolError(error);
  }
}
