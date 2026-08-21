/**
 * Parser for a lyrics.com search results page.
 *
 * Page 1 (`/lyrics/{term}`) and later pages (`/serp.php?st=...&p=N`) share the
 * same markup, so one parser covers both.
 */

import * as cheerio from "cheerio";
import { parseFailure } from "../../errors.js";
import type { SearchPage, SongResult } from "../../types.js";
import { cleanInlineText, cleanLyricsText } from "../../text/normalize.js";
import { extractSongId, RESULTS_PER_PAGE, toAbsoluteUrl } from "../urls.js";
import { SEL } from "./selectors.js";

export interface ParseSearchOptions {
  page: number;
  /** Reported in errors so a failure points at the request that caused it. */
  url: string;
}

export function parseSearchResults(html: string, options: ParseSearchOptions): SearchPage {
  const $ = cheerio.load(html);
  const rows = $(SEL.serpItem);

  if (rows.length === 0) {
    // An empty result set still renders the page chrome. Its absence means the
    // response was not the page we asked for, which must not be reported as
    // "no songs found".
    if ($(SEL.serpShell).length === 0) {
      throw parseFailure(options.url, "no result rows and no recognizable search page structure");
    }
    return { results: [], page: options.page, rawCount: 0, hasMore: false };
  }

  const results: SongResult[] = [];
  let skipped = 0;

  rows.each((_, element) => {
    const row = $(element);
    const titleLink = row.find(SEL.resultTitle).first();
    const href = titleLink.attr("href");
    const title = cleanInlineText(titleLink.text());
    const artist = cleanInlineText(row.find(SEL.resultArtist).first().text());

    const id = href ? extractSongId(href) : null;
    if (!id || !title || !artist) {
      skipped += 1;
      return;
    }

    const album = cleanInlineText(row.find(SEL.resultAlbum).first().text()) || null;
    const year = parseYear(row.find(SEL.resultYear).first().text());
    const snippetRaw = row.find(SEL.resultSnippet).first().text();
    const snippet = snippetRaw ? cleanLyricsText(snippetRaw) || null : null;

    results.push({
      id,
      url: toAbsoluteUrl(href as string),
      title,
      artist,
      album,
      year,
      snippet,
    });
  });

  if (results.length === 0) {
    throw parseFailure(options.url, `${rows.length} result rows matched but none could be read`);
  }
  if (skipped > 0) {
    process.stderr.write(
      `[mcp-lyricscom] skipped ${skipped} unreadable result rows on ${options.url}\n`,
    );
  }

  return {
    results,
    page: options.page,
    rawCount: rows.length,
    hasMore: rows.length >= RESULTS_PER_PAGE,
  };
}

/** Year cells look like "1971" but are sometimes decorated or empty. */
function parseYear(raw: string): number | null {
  const match = /\b(1[89]\d{2}|20\d{2})\b/.exec(raw);
  if (!match?.[1]) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}
