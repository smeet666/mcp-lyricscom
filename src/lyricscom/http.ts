/**
 * HTTP layer: one GET, classified, with backoff.
 *
 * The retry policy is domain specific rather than generic, because the failure
 * this server exists to handle does not look like a failure at the transport
 * level: lyrics.com answers a throttled request with HTTP 202 and an empty
 * body. Only `classifyResponse` can tell that apart from a real page.
 */

import type { Config, Logger } from "../config.js";
import { blockedUserAgent, LyricsComError, notFound, throttled } from "../errors.js";
import { classifyResponse } from "./parsers/detectThrottle.js";
import { RateLimiter, sleep } from "./rateLimiter.js";

const BACKOFF_BASE_MS = 2000;
const BACKOFF_FACTOR = 2;
const BACKOFF_MAX_MS = 20_000;

/** Exponential backoff with jitter, so parallel clients do not resynchronise. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const uncapped = BACKOFF_BASE_MS * BACKOFF_FACTOR ** attempt;
  const capped = Math.min(BACKOFF_MAX_MS, uncapped);
  return Math.round(capped * (0.5 + random() * 0.5));
}

export interface HttpDeps {
  config: Config;
  limiter: RateLimiter;
  logger: Logger;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch one page as HTML, retrying transient conditions.
 *
 * The whole retry loop, backoff sleeps included, runs inside a single limiter
 * slot. Waiting outside it would let a queued request slip into the same
 * throttling window that the current one is backing away from.
 */
export async function fetchHtml(url: string, deps: HttpDeps): Promise<string> {
  const { config, limiter, logger } = deps;
  const doFetch = deps.fetchImpl ?? fetch;

  return limiter.schedule(async () => {
    let lastError: LyricsComError | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      if (attempt > 0) {
        const delay = backoffDelay(attempt - 1);
        logger.info(`retry ${attempt}/${config.maxRetries} in ${delay}ms for ${url}`);
        await sleep(delay);
      }

      let status: number;
      let body: string;
      try {
        const response = await doFetch(url, {
          headers: {
            "User-Agent": config.userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(config.timeoutMs),
        });
        status = response.status;
        body = await response.text();
      } catch (error) {
        lastError = asTransportError(error, url);
        logger.debug(`${lastError.code} for ${url}: ${lastError.message}`);
        continue;
      }

      const verdict = classifyResponse(status, body);
      switch (verdict.kind) {
        case "ok":
          limiter.relax();
          return verdict.html;

        case "throttled":
          limiter.penalize();
          logger.info(
            `throttled (${verdict.reason}) on ${url}, interval now ${limiter.currentIntervalMs}ms`,
          );
          lastError = throttled(url, backoffDelay(attempt));
          continue;

        case "server-error":
          lastError = new LyricsComError(
            "network_error",
            `lyrics.com returned HTTP ${verdict.status}.`,
            {
              url,
              status: verdict.status,
            },
          );
          continue;

        // Retrying these would only repeat the same answer.
        case "blocked":
          throw blockedUserAgent(url);
        case "not-found":
          throw notFound(url);
      }
    }

    throw lastError ?? new LyricsComError("network_error", `Could not fetch ${url}.`, { url });
  });
}

function asTransportError(error: unknown, url: string): LyricsComError {
  if (error instanceof LyricsComError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new LyricsComError("timeout", "lyrics.com did not answer in time.", {
      url,
      hint: "Raise LYRICSCOM_TIMEOUT_MS if this happens often on a slow connection.",
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new LyricsComError("network_error", `Could not reach lyrics.com: ${message}`, { url });
}
