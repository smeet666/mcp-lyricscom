/** Domain types shared by the scraping layer and the MCP tools. */

export interface SongRef {
  /** Numeric lyrics.com song id, extracted from the page URL. */
  id: string;
  /** Absolute lyrics.com URL for the song page. */
  url: string;
}

export interface SongResult extends SongRef {
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  /** Raw excerpt lyrics.com renders under each search result, when present. */
  snippet: string | null;
}

export interface SearchPage {
  results: SongResult[];
  page: number;
  /** Rows lyrics.com returned before local filtering and deduplication. */
  rawCount: number;
  hasMore: boolean;
}

export interface SongPage extends SongRef {
  title: string | null;
  artist: string | null;
  /** Empty string when the page carries no lyrics. */
  lyrics: string;
  hasLyrics: boolean;
}
