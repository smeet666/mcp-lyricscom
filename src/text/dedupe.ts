/**
 * Deduplication of search results.
 *
 * lyrics.com lists the same recording once per album it appears on, so a single
 * query routinely returns "Title", "Title [Deluxe]" and "Title (Remastered)" by
 * the same artist. Bracketed and parenthesised suffixes are stripped before
 * comparison so those collapse into one result.
 */

import type { SongResult } from "../types.js";

export function songKey(artist: string, title: string): string {
  const withoutSuffixes = title.replace(/\s*[[(].*?[\])]/g, "");
  const titleNorm = withoutSuffixes.replace(/\s+/g, " ").trim().toLowerCase();
  const artistNorm = artist.replace(/\s+/g, " ").trim().toLowerCase();
  return `${artistNorm}|${titleNorm}`;
}

/** Keep the first occurrence of each artist/title pair, preserving order. */
export function dedupeSongs<T extends SongResult>(songs: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const song of songs) {
    const key = songKey(song.artist, song.title);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(song);
  }
  return unique;
}
