/**
 * URL construction and validation for lyrics.com.
 */

import { invalidInput } from "../errors.js";

export const BASE_URL = "https://www.lyrics.com";

/** lyrics.com renders 24 rows per search page. */
export const RESULTS_PER_PAGE = 24;

/**
 * Song page paths come in two shapes: the current `/lyric-lf/{id}/...` and the
 * older `/lyric/{id}/...` still present in archived links.
 */
export const SONG_HREF_RE = /^\/lyric(?:-lf)?\/(\d+)\//;

const ALLOWED_HOSTS = new Set(["lyrics.com", "www.lyrics.com"]);

/**
 * Percent-encode a search term the way lyrics.com expects, with spaces as `+`.
 */
function encodeTerm(term: string): string {
  return encodeURIComponent(term).replace(/%20/g, "+");
}

/**
 * Page 1 lives at a path, later pages at a query string. Both return the same
 * markup, so the parser does not need to know which one produced it.
 */
export function buildSearchUrl(term: string, page: number): string {
  const encoded = encodeTerm(term);
  if (page <= 1) {
    return `${BASE_URL}/lyrics/${encoded}`;
  }
  return `${BASE_URL}/serp.php?st=${encoded}&p=${page}`;
}

export function buildSongUrl(id: string): string {
  return `${BASE_URL}/lyric-lf/${id}/`;
}

/** True only for lyrics.com itself, so a hostile URL cannot be used as a proxy. */
export function isLyricsComHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
}

/** Extract the numeric song id from a lyrics.com song path or absolute URL. */
export function extractSongId(hrefOrUrl: string): string | null {
  let path = hrefOrUrl;
  if (/^https?:\/\//i.test(hrefOrUrl)) {
    if (!isLyricsComHost(hrefOrUrl)) {
      return null;
    }
    path = new URL(hrefOrUrl).pathname;
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const match = SONG_HREF_RE.exec(path);
  return match?.[1] ?? null;
}

/**
 * Resolve the `id` / `url` pair accepted by get_lyrics into a canonical
 * request URL. `id` wins when both are given.
 */
export function resolveSongRef(input: { id?: string; url?: string }): { id: string; url: string } {
  if (input.id) {
    if (!/^\d+$/.test(input.id)) {
      throw invalidInput(
        `"${input.id}" is not a lyrics.com song id.`,
        "Ids are digits only, as returned by the search tools.",
      );
    }
    return { id: input.id, url: buildSongUrl(input.id) };
  }

  if (input.url) {
    if (!isLyricsComHost(input.url)) {
      throw invalidInput(
        "Only www.lyrics.com URLs are accepted.",
        "Pass the source_url returned by search_lyrics or search_songs, or use the numeric id instead.",
      );
    }
    const id = extractSongId(input.url);
    if (!id) {
      throw invalidInput(
        "That lyrics.com URL is not a song page.",
        "Song pages look like https://www.lyrics.com/lyric-lf/1234567/Artist/Title",
      );
    }
    return { id, url: input.url };
  }

  throw invalidInput("Either 'id' or 'url' must be provided.");
}

/** Absolute URL for a href scraped out of a result row. */
export function toAbsoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}
