/**
 * High-level lyrics.com client.
 *
 * This module knows nothing about MCP, which keeps it unit-testable against
 * plain strings and usable as a plain library through the `./client` export.
 */

import type { Config, Logger } from "../config.js";
import {
  DEFAULT_USER_AGENT,
  MIN_ALLOWED_INTERVAL_MS,
  createLogger,
  loadConfig,
} from "../config.js";
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

/**
 * Apply the guarantees this project makes about its own traffic.
 *
 * The environment parser already enforces both, but `LyricsComClient` is published as a
 * library through the `./client` export and takes a caller-built config, so
 * without this the pacing floor and the honest identity are optional for anyone
 * importing it. lyrics.com answers a burst by refusing, and an honest User-Agent is what it accepts, and those promises hold on every path.
 *
 * A caller may still name their own application in the User-Agent. Passing the
 * traffic off as a browser is a different thing, and gets the project's own
 * identity appended so it stays attributable.
 */
function withGuarantees(config: Config): Config {
  const userAgent = /mozilla\/|applewebkit|chrome\/|safari\/|gecko/i.test(config.userAgent)
    ? `${config.userAgent} ${DEFAULT_USER_AGENT}`
    : config.userAgent;
  return {
    ...config,
    userAgent,
    minIntervalMs: Math.max(MIN_ALLOWED_INTERVAL_MS, config.minIntervalMs),
  };
}

export class LyricsComClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: TtlLruCache<unknown>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: LyricsComClientOptions = {}) {
    this.config = withGuarantees(options.config ?? loadConfig());
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ minIntervalMs: this.config.minIntervalMs });
    this.cache = new TtlLruCache<unknown>(this.config.cacheMaxEntries, this.config.cacheTtlMs);
    this.fetchImpl = options.fetchImpl;
  }

  async search(term: string, page: number): Promise<FetchOutcome<SearchPage>> {
    const url = buildSearchUrl(term, page);
    return await this.fetchParsed(url, (html) => parseSearchResults(html, { page, url }));
  }

  async getSong(ref: { id?: string; url?: string }): Promise<FetchOutcome<SongPage>> {
    const { id, url } = resolveSongRef(ref);
    return await this.fetchParsed(url, (html) => parseSongPage(html, { id, url }));
  }

  /**
   * Fetch, parse, then cache. In that order: a page that could not be read is
   * never stored, so a bad minute at lyrics.com cannot be replayed from memory for
   * the rest of the cache lifetime, leaving the tool unable to recover after
   * the site comes back.
   *
   * The cached value is the parsed result rather than the raw page, which also
   * keeps a few hundred kilobytes of markup per entry out of memory.
   */
  private async fetchParsed<T>(url: string, parse: (html: string) => T): Promise<FetchOutcome<T>> {
    const hit = this.cache.get(url);
    if (hit !== undefined) {
      this.logger.debug(`cache hit ${url}`);
      return { data: hit as T, cached: true };
    }

    const html = await fetchHtml(url, {
      config: this.config,
      limiter: this.limiter,
      logger: this.logger,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
    });

    const data = parse(html);
    this.cache.set(url, data);
    return { data, cached: false };
  }
}
