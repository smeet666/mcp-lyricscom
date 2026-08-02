/**
 * Every lyrics.com CSS selector lives here, so a site redesign is a one-file fix.
 *
 * Selectors deliberately target a single stable class rather than a full class
 * list (`div.sec-lyric`, not `div.sec-lyric.clearfix`), so that a layout tweak
 * adding or removing a utility class does not break extraction.
 */

export const SEL = {
  /** One search result row. */
  serpItem: "div.sec-lyric",
  /**
   * Page chrome that is present whether or not there are results. Used to tell
   * "zero results" apart from "the markup changed", which must not look alike.
   */
  serpShell: "#lyric-search, .lyric-search, .pagination, #main-content, form[action*='serp']",
  resultTitle: "p.lyric-meta-title a",
  /**
   * Rows tied to an album expose the artist under `lyric-meta-album-artist`,
   * rows without one under `lyric-meta-artists`. Both shapes appear on the same
   * page, so missing the second silently drops results.
   */
  resultArtist: "p.lyric-meta-album-artist a, p.lyric-meta-artists a",
  resultAlbum: "p.lyric-meta-album",
  resultYear: "p.lyric-meta-album-year",
  resultSnippet: "pre.lyric-body",

  /** Full lyrics on a song page, with the historical fallback. */
  songBody: "pre#lyric-body-text, pre.lyric-body",
  /** Marker for a valid song page that simply has no lyrics on file. */
  songNoData: "div.lyric-no-data",
  songTitle: "#lyric-title-text, .lyric-title",
  songArtist: ".lyric-artist a, .lyric-artist",
} as const;
