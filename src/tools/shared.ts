/**
 * Pieces shared by the three tools: result schema, error mapping, text mirrors.
 */

import { z } from "zod";
import { LyricsComError } from "../errors.js";
import type { SongResult } from "../types.js";

/** Many MCP clients render only the text block, so it must stay readable on its own. */
export const MAX_TEXT_MIRROR_CHARS = 1500;

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

export function ok(structured: Record<string, unknown>, text: string): ToolResult {
  return {
    content: [{ type: "text", text: truncate(text, MAX_TEXT_MIRROR_CHARS) }],
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
  if (known.details.hint) lines.push(`Hint: ${known.details.hint}`);
  if (known.details.url) lines.push(`URL: ${known.details.url}`);

  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
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
