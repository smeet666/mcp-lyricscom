/**
 * Pieces shared by the three tools: result schema, error mapping, text mirrors.
 */

import { z } from "zod";
import { LyricsComError } from "../errors.js";
import type { SongResult } from "../types.js";

/** Many MCP clients render only the text block, so it must stay readable on its own. */
export const MAX_TEXT_MIRROR_CHARS = 1500;

/**
 * The last page a search will accept.
 *
 * Offering a page beyond this sends a caller into an argument the schema
 * refuses, so the number that bounds the input is the number an answer is
 * allowed to suggest.
 */
export const MAX_PAGE = 20;

export const songResultSchema = z.object({
  id: z.string().describe("lyrics.com song id. Pass this to get_lyrics."),
  title: z.string(),
  artist: z.string(),
  album: z.string().nullable(),
  year: z.number().int().nullable(),
  source_url: z.string().describe("Canonical lyrics.com page for this song."),
  excerpt: z
    .string()
    .nullable()
    .describe("Short lyric line showing where the query appears, when available."),
});

export type SongResultOut = z.infer<typeof songResultSchema>;

export function toSongResultOut(song: SongResult, excerpt: string | null): SongResultOut {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    source_url: song.url,
    excerpt,
  };
}

export interface ToolResult {
  // The SDK's CallToolResult carries an index signature for protocol extensions.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Keep text from the site out of the shape this server's own lines take.
 *
 * A block ending with lines that open "Note:" gives a caller no way to tell one
 * of those from the same words inside a title someone else published.
 * Indenting such a line in the body keeps the two apart, and the structured
 * output still carries it exactly as it was.
 */
function indentMarkerLines(body: string): string {
  return body.replace(/^(Note:)/gm, " $1");
}

/**
 * Build a result whose text block ends with its notes.
 *
 * The notes are what qualifies an answer: that an offset landed past the end,
 * that the site chose these results rather than matching them, that the words
 * came from this server's cache. A client rendering only the text reads an
 * unqualified answer without them.
 */
export function ok(
  structured: Record<string, unknown>,
  text: string,
  notes: string[] = [],
): ToolResult {
  const trailer = notes.map((note) => `Note: ${note}`).join("\n");
  const budget = MAX_TEXT_MIRROR_CHARS - (trailer ? trailer.length + 2 : 0);
  const body = truncate(indentMarkerLines(text), Math.max(0, budget));

  return {
    content: [{ type: "text", text: trailer ? `${body}\n\n${trailer}` : body }],
    structuredContent: structured,
  };
}

/**
 * Error results carry no structuredContent: the SDK validates it against the
 * tool's declared output schema, which an error payload does not satisfy.
 */
export function toToolError(error: unknown): ToolResult {
  const known =
    error instanceof LyricsComError
      ? error
      : new LyricsComError("network_error", error instanceof Error ? error.message : String(error));

  const lines = [`[${known.code}] ${known.message}`];
  if (known.details.hint) {
    lines.push(`Hint: ${known.details.hint}`);
  }
  if (known.details.url) {
    lines.push(`URL: ${known.details.url}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Compact listing used by both search tools. */
export function renderResultList(results: SongResultOut[]): string {
  return results
    .map((result, index) => {
      const year = result.year ? ` (${result.year})` : "";
      const album = result.album ? ` [${result.album}]` : "";
      const head = `${index + 1}. ${result.title} — ${result.artist}${year}${album} · id: ${result.id}`;
      return result.excerpt ? `${head}\n   "${result.excerpt}"` : head;
    })
    .join("\n");
}
