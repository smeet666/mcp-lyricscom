/**
 * High-level lyrics.com client.
 *
 * This module knows nothing about MCP, which keeps it unit-testable against
 * plain strings and usable as a plain library through the `./client` export.
 */

import type { Config, Logger } from "../config.js";
import { createLogger, loadConfig } from "../config.js";
import type { SearchPage, SongPage } from "../types.js";
import { TtlLruCache } from "./cache.js";
import { fetchHtml } from "./http.js";
import { parseSearchResults } from "./parsers/searchResults.js";
import { parseSongPage } from "./parsers/songPage.js";
import { RateLimiter } from "./rateLimiter.js";
import { buildSearchUrl, resolveSongRef } from "./urls.js";

export interface LyricsComClientOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

export interface FetchOutcome<T> {
  data: T;
  /** True when the page came from the in-memory cache rather than the network. */
  cached: boolean;
}

export class LyricsComClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlLruCache<string>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: LyricsComClientOptions = {}) {
    this.config = options.config ?? loadConfig();
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ minIntervalMs: this.config.minIntervalMs });
    this.cache = new TtlLruCache<string>(this.config.cacheMaxEntries, this.config.cacheTtlMs);
    this.fetchImpl = options.fetchImpl;
  }

  async search(term: string, page: number): Promise<FetchOutcome<SearchPage>> {
    const url = buildSearchUrl(term, page);
    const { html, cached } = await this.fetchPage(url);
    return { data: parseSearchResults(html, { page, url }), cached };
  }

  async getSong(ref: { id?: string; url?: string }): Promise<FetchOutcome<SongPage>> {
    const { id, url } = resolveSongRef(ref);
    const { html, cached } = await this.fetchPage(url);
    return { data: parseSongPage(html, { id, url }), cached };
  }

  private async fetchPage(url: string): Promise<{ html: string; cached: boolean }> {
    const hit = this.cache.get(url);
    if (hit !== undefined) {
      this.logger.debug(`cache hit ${url}`);
      return { html: hit, cached: true };
    }

    const html = await fetchHtml(url, {
      config: this.config,
      limiter: this.limiter,
      logger: this.logger,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
    });
    // Only successful pages are cached; a throttled response never reaches here.
    this.cache.set(url, html);
    return { html, cached: false };
  }
}
