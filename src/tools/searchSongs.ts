/**
 * search_songs: find songs by title.
 *
 * lyrics.com has no title-only endpoint, so this runs the same search and ranks
 * and filters the rows by how well their title matches. The tool description
 * says so plainly rather than implying a precision the site does not offer.
 */

import { z } from "zod";
import type { LyricsComClient } from "../lyricscom/client.js";
import { dedupeSongs } from "../text/dedupe.js";
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

/**
 * What to say about the rows past this page.
 *
 * The sentence may only name a page the schema would accept, or it sends a
 * caller into an argument that is refused.
 */
function whatFollowsThisPage(hasMore: boolean, page: number): string {
  if (!hasMore) {
    return "";
  }
  if (page < MAX_PAGE) {
    return `\n\nMore results available: call again with page=${page + 1}.`;
  }
  return `\n\nlyrics.com holds more, but page ${MAX_PAGE} is as far as this tool reads. Narrow the query instead.`;
}

/** The opening line, which says whether the site matched the title or merely offered rows. */
function headerFor(found: number, loose: boolean, page: number, title: string): string {
  if (found === 0) {
    return `No song on page ${page} matched "${title}".`;
  }
  if (loose) {
    return `${found} song(s) lyrics.com offers on page ${page} for "${title}":`;
  }
  return `${found} song(s) on page ${page} matching "${title}":`;
}

export const searchSongsDescription = [
  "Find songs on lyrics.com by their title.",
  "Returns candidate songs with artist, album, year, and the lyrics.com id and URL.",
  "Use this when someone names a song and you need its id to call get_lyrics, or to tell covers and versions",
  "by different artists apart. An optional 'artist' narrows the list.",
  "lyrics.com searches titles and lyrics together, so results are ranked and filtered locally by title match;",
  'use match="strict" to keep only genuine title matches.',
].join(" ");

export const searchSongsInput = strictInput({
  title: z.string().min(1).max(120).describe("Song title, or part of it."),
  artist: z
    .string()
    .max(120)
    .optional()
    .describe("Optional artist name, matched case-insensitively against each result."),
  limit: z.number().int().min(1).max(50).default(10),
  page: z.number().int().min(1).max(20).default(1),
  match: z
    .enum(["loose", "strict"])
    .default("loose")
    .describe(
      "'strict' keeps only results whose title matches the query as a whole title, ignoring suffixes such as " +
        "'(Remastered)'. 'loose' keeps anything lyrics.com returned, best match first.",
    ),
});

export const searchSongsOutputShape = {
  title: z.string(),
  artist_filter: z.string().nullable(),
  page: z.number().int(),
  results: z.array(songResultSchema),
  raw_result_count: z.number().int(),
  filtered_out: z.number().int(),
  has_more: z.boolean(),
  next_page: z.number().int().nullable(),
  source: z.literal("lyrics.com"),
  notes: z.array(z.string()),
};

export interface SearchSongsArgs {
  title: string;
  artist?: string;
  limit: number;
  page: number;
  match: "loose" | "strict";
}

/** Normalized form used for title comparison: no edition suffix, no punctuation noise. */
function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[[(].*?[\])]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 3 = same title, 2 = starts with the query, 1 = contains it, 0 = no title match. */
export function titleScore(candidate: string, query: string): number {
  const a = normalizeTitle(candidate);
  const b = normalizeTitle(query);
  if (!(a && b)) {
    return 0;
  }
  if (a === b) {
    return 3;
  }
  if (a.startsWith(b)) {
    return 2;
  }
  if (a.includes(b)) {
    return 1;
  }
  return 0;
}

export async function runSearchSongs(
  client: LyricsComClient,
  args: SearchSongsArgs,
): Promise<ToolResult> {
  try {
    const { data, cached } = await client.search(args.title, args.page);
    const notes: string[] = [];
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }

    const artistFilter = args.artist?.trim().toLowerCase() ?? null;
    const unique = dedupeSongs(data.results);

    const scored: Array<{ song: SongResult; score: number }> = [];
    let filteredOut = 0;

    for (const song of unique) {
      const score = titleScore(song.title, args.title);
      const artistOk = !artistFilter || song.artist.toLowerCase().includes(artistFilter);
      if (!artistOk || (args.match === "strict" && score < 2)) {
        filteredOut += 1;
        continue;
      }
      scored.push({ song, score });
    }

    // Stable sort by score, so equally scored rows keep lyrics.com's own order.
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, args.limit).map((entry) => toSongResultOut(entry.song, null));

    if (results.length === 0 && data.rawCount > 0) {
      notes.push(
        args.match === "strict"
          ? 'lyrics.com returned results but none matched the title strictly. Try match="loose".'
          : "lyrics.com returned results but none matched the requested artist.",
      );
    }

    const structured = {
      title: args.title,
      artist_filter: args.artist ?? null,
      page: args.page,
      results,
      raw_result_count: data.rawCount,
      filtered_out: filteredOut,
      has_more: data.hasMore,
      next_page: data.hasMore && args.page < MAX_PAGE ? args.page + 1 : null,
      source: "lyrics.com" as const,
      notes,
    };

    // In loose mode the site returns its own guesses, and a row whose title is
    // not the one asked for is among them. Calling the list a set of matches is
    // how one song's words end up quoted for another.
    const loose = args.match !== "strict";
    const header = headerFor(results.length, loose, args.page, args.title);
    // The footer may only name a page the schema would accept, or it sends a
    // caller into an argument that is refused.
    const footer = whatFollowsThisPage(data.hasMore, args.page);

    if (results.length > 0 && loose) {
      notes.push(
        `These are lyrics.com's own suggestions for "${args.title}", not rows whose title matches it. Check each title before quoting one, or ask again with match="strict".`,
      );
    }

    return ok(structured, `${header}\n${renderResultList(results)}${footer}`, notes);
  } catch (error) {
    return toToolError(error);
  }
}
