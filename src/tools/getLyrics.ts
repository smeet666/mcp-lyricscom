/**
 * get_lyrics: fetch the full lyrics of one song.
 */

import { z } from "zod";
import type { LyricsComClient } from "../lyricscom/client.js";
import { findMatchingLine } from "../text/excerpt.js";
import { strictInput } from "./arguments.js";
import { ok, toToolError, truncate } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const getLyricsDescription = [
  "Fetch the full lyrics of one song from lyrics.com, given the song id or URL returned by search_lyrics or search_songs.",
  "Lyrics can be long, so the response is truncated by default: check 'truncated' and call again with 'offset' set to",
  "'next_offset' to continue reading.",
  'Some lyrics.com pages legitimately have no lyrics on file; those come back with status "no_lyrics" and an empty',
  "lyrics field, which is a valid answer and not an error, so do not retry them.",
  "Always cite 'source_url' and the artist when showing lyrics to a user.",
].join(" ");

export const getLyricsInput = strictInput({
  id: z
    .string()
    .regex(/^\d+$/, "Song ids are digits only.")
    .optional()
    .describe("lyrics.com numeric song id, as returned by the search tools. Preferred over 'url'."),
  url: z
    .string()
    .url()
    .optional()
    .describe(
      "Full lyrics.com song URL. Only www.lyrics.com URLs are accepted. Ignored when 'id' is given.",
    ),
  max_chars: z
    .number()
    .int()
    .min(200)
    .max(20000)
    .default(6000)
    .describe("Maximum characters of lyrics text to return in this call."),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Character offset to resume from, for lyrics longer than max_chars."),
  highlight: z
    .string()
    .max(120)
    .optional()
    .describe(
      "Optional word. When set, the response reports whether it appears in the lyrics and on which line.",
    ),
});

export const getLyricsOutputShape = {
  status: z.enum(["ok", "no_lyrics"]),
  id: z.string(),
  title: z.string().nullable(),
  artist: z.string().nullable(),
  source_url: z.string(),
  lyrics: z.string().describe("Slice of the lyrics text. Empty when status is 'no_lyrics'."),
  total_chars: z.number().int(),
  returned_chars: z.number().int(),
  offset: z.number().int(),
  next_offset: z.number().int().nullable(),
  truncated: z.boolean(),
  line_count: z.number().int(),
  highlight: z
    .object({
      word: z.string(),
      found: z.boolean(),
      line_number: z.number().int().nullable(),
      line: z.string().nullable(),
    })
    .nullable(),
  attribution: z.string().describe("Ready-to-display credit line."),
  source: z.literal("lyrics.com"),
  notes: z.array(z.string()),
};

export interface GetLyricsArgs {
  id?: string;
  url?: string;
  max_chars: number;
  offset: number;
  highlight?: string;
}

/**
 * Cut at the last newline that fits, so a continuation never splits a line in
 * half. Falls back to a hard cut for a single line longer than the budget.
 */
export function sliceAtLineBoundary(
  text: string,
  offset: number,
  maxChars: number,
): { slice: string; nextOffset: number | null } {
  if (offset >= text.length) return { slice: "", nextOffset: null };

  const remaining = text.slice(offset);
  if (remaining.length <= maxChars) return { slice: remaining, nextOffset: null };

  const window = remaining.slice(0, maxChars);
  const lastBreak = window.lastIndexOf("\n");
  const cut = lastBreak > 0 ? lastBreak : maxChars;
  return { slice: remaining.slice(0, cut), nextOffset: offset + cut };
}

export async function runGetLyrics(
  client: LyricsComClient,
  args: GetLyricsArgs,
): Promise<ToolResult> {
  try {
    const ref: { id?: string; url?: string } = {};
    if (args.id) ref.id = args.id;
    else if (args.url) ref.url = args.url;

    const { data, cached } = await client.getSong(ref);
    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");
    const credit = [data.title, data.artist].filter(Boolean).join(" — ");
    const attribution = `${credit || "Lyrics"} via lyrics.com — ${data.url}`;

    if (!data.hasLyrics) {
      const structured = {
        status: "no_lyrics" as const,
        id: data.id,
        title: data.title,
        artist: data.artist,
        source_url: data.url,
        lyrics: "",
        total_chars: 0,
        returned_chars: 0,
        offset: 0,
        next_offset: null,
        truncated: false,
        notes,
        line_count: 0,
        highlight: null,
        attribution,
        source: "lyrics.com" as const,
      };
      return ok(
        structured,
        `lyrics.com has a page for this song but no lyrics on file.\n${attribution}`,
      );
    }

    const { slice, nextOffset } = sliceAtLineBoundary(data.lyrics, args.offset, args.max_chars);
    const match = args.highlight ? findMatchingLine(data.lyrics, args.highlight) : null;

    const structured = {
      status: "ok" as const,
      id: data.id,
      title: data.title,
      artist: data.artist,
      source_url: data.url,
      lyrics: slice,
      total_chars: data.lyrics.length,
      returned_chars: slice.length,
      offset: args.offset,
      next_offset: nextOffset,
      truncated: nextOffset !== null,
      line_count: data.lyrics === "" ? 0 : data.lyrics.split("\n").length,
      highlight: args.highlight
        ? {
            word: args.highlight,
            found: match !== null,
            line_number: match?.lineNumber ?? null,
            line: match?.line ?? null,
          }
        : null,
      attribution,
      source: "lyrics.com" as const,
      notes,
    };

    // An offset beyond the words yields an empty body, which on its own reads
    // as a song that carries none. What happened is that the caller asked for
    // a position that does not exist, and only saying so tells the two apart.
    const pastTheEnd = args.offset > 0 && slice === "" && data.lyrics.length > 0;
    if (pastTheEnd) {
      notes.push(
        `offset=${args.offset} is past the end of a body of ${data.lyrics.length} characters. Call again with offset=0 to read it from the start.`,
      );
    }

    // The text mirror stays a pointer to the structured payload rather than a
    // second copy of the lyrics.
    const summary = [
      attribution,
      `${structured.line_count} lines, ${structured.total_chars} characters.`,
      pastTheEnd
        ? `Nothing at offset=${args.offset}: that is past the end. Call again with offset=0.`
        : nextOffset !== null
          ? `Truncated: call again with offset=${nextOffset} to continue.`
          : "Complete.",
      structured.highlight
        ? structured.highlight.found
          ? `"${structured.highlight.word}" appears on line ${structured.highlight.line_number}.`
          : `"${structured.highlight.word}" does not appear in these lyrics.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return ok(structured, truncate(`${summary}\n\n${slice}`, 4000), notes);
  } catch (error) {
    return toToolError(error);
  }
}
