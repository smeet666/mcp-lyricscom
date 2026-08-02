/**
 * Error taxonomy surfaced to the calling model.
 *
 * The point of this file is that an LLM must be able to tell "lyrics.com pushed
 * back on me" apart from "there is no such song". The reference implementation
 * this server replaces collapsed every failure into an empty list, which made
 * rate limiting look like an absence of results.
 */

export type ErrorCode =
  | "throttled"
  | "blocked_user_agent"
  | "not_found"
  | "invalid_input"
  | "parse_failure"
  | "network_error"
  | "timeout";

export interface ErrorDetails {
  url?: string;
  status?: number;
  retryAfterMs?: number;
  hint?: string;
}

export class LyricsComError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = "LyricsComError";
  }
}

const ISSUES_URL = "https://github.com/smeet666/mcp-lyricscom/issues";

export function throttled(url: string, retryAfterMs: number): LyricsComError {
  return new LyricsComError(
    "throttled",
    "lyrics.com is rate limiting this client. It answered with an empty response instead of a page. " +
      "This does NOT mean there are no results for this query.",
    {
      url,
      retryAfterMs,
      hint:
        "Wait at least a minute before calling the same tool again with the same arguments. Once lyrics.com " +
        "starts throttling, the window commonly lasts several minutes, so retrying immediately will fail again. " +
        "If it keeps happening, raise LYRICSCOM_MIN_INTERVAL_MS in your MCP client configuration.",
    },
  );
}

export function blockedUserAgent(url: string): LyricsComError {
  return new LyricsComError(
    "blocked_user_agent",
    "lyrics.com refused the request because of the User-Agent this server sends (HTTP 403).",
    {
      url,
      status: 403,
      hint:
        "Set the LYRICSCOM_USER_AGENT environment variable in your MCP client configuration to a different " +
        "value. See the Configuration section of the project README.",
    },
  );
}

export function notFound(url: string): LyricsComError {
  return new LyricsComError("not_found", "lyrics.com has no page at this address.", {
    url,
    status: 404,
    hint: "Check the song id. Ids come from the search tools; they are not stable to guess by hand.",
  });
}

export function parseFailure(url: string, what: string): LyricsComError {
  return new LyricsComError(
    "parse_failure",
    `The page loaded but the expected lyrics.com markup was not found (${what}). The site layout may have changed.`,
    { url, hint: `Please report this, with the query you used, at ${ISSUES_URL}` },
  );
}

export function invalidInput(message: string, hint?: string): LyricsComError {
  return new LyricsComError("invalid_input", message, hint ? { hint } : {});
}
