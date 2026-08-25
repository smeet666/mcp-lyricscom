/**
 * Response classification.
 *
 * lyrics.com does not answer rate limiting with 429. It answers with HTTP 202
 * and a zero-byte body, which a naive client reads as a successful but empty
 * page. Every response therefore goes through this classifier before any
 * parsing happens.
 */

const CLOSING_HTML_TAG = /<\/html>/i;

export type ResponseVerdict =
  | { kind: "ok"; html: string }
  | { kind: "throttled"; reason: ThrottleReason }
  | { kind: "blocked"; status: number }
  | { kind: "not-found" }
  | { kind: "server-error"; status: number };

export type ThrottleReason =
  | "status-202"
  | "status-429"
  | "status-503"
  | "empty-body"
  | "short-body";

/**
 * A real search page weighs about 187 KB and a song page 60 KB or more, so a
 * body this small is never a genuine lyrics.com page.
 */
export const MIN_PLAUSIBLE_HTML = 2000;

export function classifyResponse(status: number, body: string): ResponseVerdict {
  if (status === 202) {
    return { kind: "throttled", reason: "status-202" };
  }
  if (status === 429) {
    return { kind: "throttled", reason: "status-429" };
  }
  if (status === 503) {
    return { kind: "throttled", reason: "status-503" };
  }
  if (status === 403) {
    return { kind: "blocked", status };
  }
  if (status === 404) {
    return { kind: "not-found" };
  }
  if (status >= 500) {
    return { kind: "server-error", status };
  }

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { kind: "throttled", reason: "empty-body" };
  }
  if (trimmed.length < MIN_PLAUSIBLE_HTML && !CLOSING_HTML_TAG.test(trimmed)) {
    return { kind: "throttled", reason: "short-body" };
  }

  return { kind: "ok", html: body };
}
