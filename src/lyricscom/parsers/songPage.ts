/**
 * Parser for a lyrics.com song page.
 */

import * as cheerio from "cheerio";
import { parseFailure } from "../../errors.js";
import type { SongPage } from "../../types.js";
import { cleanInlineText, cleanLyricsText } from "../../text/normalize.js";
import { SEL } from "./selectors.js";

export interface ParseSongOptions {
  id: string;
  url: string;
}

export function parseSongPage(html: string, options: ParseSongOptions): SongPage {
  const $ = cheerio.load(html);

  const title = cleanInlineText($(SEL.songTitle).first().text()) || null;
  const artist = cleanInlineText($(SEL.songArtist).first().text()) || null;

  const body = $(SEL.songBody).first();
  if (body.length === 0) {
    // A valid song page can legitimately carry no lyrics. That is an answer,
    // not a failure, so it is only treated as breakage when the page says
    // nothing about why the text is missing.
    const declaresNoLyrics =
      $(SEL.songNoData).length > 0 || /no lyrics found/i.test($("title").text());
    if (!declaresNoLyrics) {
      throw parseFailure(options.url, "no lyrics container and no 'no lyrics' marker");
    }
    return { id: options.id, url: options.url, title, artist, lyrics: "", hasLyrics: false };
  }

  const lyrics = cleanLyricsText(extractBodyText($, body));
  if (!lyrics) {
    return { id: options.id, url: options.url, title, artist, lyrics: "", hasLyrics: false };
  }

  return { id: options.id, url: options.url, title, artist, lyrics, hasLyrics: true };
}

/**
 * lyrics.com wraps many individual words in links to its dictionary pages.
 * Those anchors are unwrapped in the raw HTML rather than through the DOM,
 * because DOM-level removal loses the line breaks that give lyrics their shape.
 */
function extractBodyText($: cheerio.CheerioAPI, body: ReturnType<cheerio.CheerioAPI>): string {
  const rawHtml = $.html(body);
  const withoutAnchors = rawHtml.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  const withNewlines = withoutAnchors.replace(/<br\s*\/?>/gi, "\n");
  return cheerio.load(withNewlines).root().text();
}
