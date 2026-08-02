/**
 * Runtime configuration, read from environment variables.
 *
 * A bad value never crashes the process: an MCP server that dies at startup
 * because of a typo in a client config file is very hard to diagnose from the
 * host application, so invalid input is clamped and reported on stderr.
 */

import { PKG_VERSION, REPO_URL } from "./version.js";

export type LogLevel = "silent" | "error" | "info" | "debug";

export interface Config {
  userAgent: string;
  minIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  logLevel: LogLevel;
}

/**
 * Identifies the client honestly. lyrics.com serves this fine; it blocks
 * generic tool agents such as `curl/x.y.z`, which is what the override is for.
 */
export const DEFAULT_USER_AGENT = `mcp-lyricscom/${PKG_VERSION} (+${REPO_URL})`;

export const DEFAULTS = {
  minIntervalMs: 1100,
  timeoutMs: 15_000,
  maxRetries: 3,
  cacheTtlMs: 15 * 60 * 1000,
  cacheMaxEntries: 200,
  logLevel: "error" as LogLevel,
};

const LOG_LEVELS: LogLevel[] = ["silent", "error", "info", "debug"];

interface NumericRange {
  min: number;
  max: number;
  fallback: number;
}

function readNumber(name: string, env: NodeJS.ProcessEnv, range: NumericRange): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return range.fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    warn(`${name}="${raw}" is not a number, using ${range.fallback}`);
    return range.fallback;
  }
  const clamped = Math.min(range.max, Math.max(range.min, Math.round(parsed)));
  if (clamped !== Math.round(parsed)) {
    warn(`${name}=${raw} is out of range, clamped to ${clamped}`);
  }
  return clamped;
}

function warn(message: string): void {
  process.stderr.write(`[mcp-lyricscom] ${message}\n`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawUserAgent = env.LYRICSCOM_USER_AGENT?.trim();
  const rawLogLevel = env.LYRICSCOM_LOG_LEVEL?.trim().toLowerCase();

  let logLevel = DEFAULTS.logLevel;
  if (rawLogLevel) {
    if (LOG_LEVELS.includes(rawLogLevel as LogLevel)) {
      logLevel = rawLogLevel as LogLevel;
    } else {
      warn(`LYRICSCOM_LOG_LEVEL="${rawLogLevel}" is unknown, using "${DEFAULTS.logLevel}"`);
    }
  }

  return {
    userAgent: rawUserAgent || DEFAULT_USER_AGENT,
    // 0 is allowed so the throttling behaviour can be exercised deliberately.
    minIntervalMs: readNumber("LYRICSCOM_MIN_INTERVAL_MS", env, {
      min: 0,
      max: 60_000,
      fallback: DEFAULTS.minIntervalMs,
    }),
    timeoutMs: readNumber("LYRICSCOM_TIMEOUT_MS", env, {
      min: 1000,
      max: 120_000,
      fallback: DEFAULTS.timeoutMs,
    }),
    maxRetries: readNumber("LYRICSCOM_MAX_RETRIES", env, {
      min: 0,
      max: 10,
      fallback: DEFAULTS.maxRetries,
    }),
    cacheTtlMs: readNumber("LYRICSCOM_CACHE_TTL_MS", env, {
      min: 0,
      max: 24 * 60 * 60 * 1000,
      fallback: DEFAULTS.cacheTtlMs,
    }),
    cacheMaxEntries: readNumber("LYRICSCOM_CACHE_MAX_ENTRIES", env, {
      min: 0,
      max: 10_000,
      fallback: DEFAULTS.cacheMaxEntries,
    }),
    logLevel,
  };
}

const LEVEL_RANK: Record<LogLevel, number> = { silent: 0, error: 1, info: 2, debug: 3 };

/**
 * Logs go to stderr without exception. On a stdio transport, stdout carries the
 * protocol and any stray write there corrupts the session.
 */
export function createLogger(level: LogLevel) {
  const emit = (at: LogLevel, message: string) => {
    if (LEVEL_RANK[level] >= LEVEL_RANK[at]) {
      process.stderr.write(`[mcp-lyricscom] ${message}\n`);
    }
  };
  return {
    error: (message: string) => emit("error", message),
    info: (message: string) => emit("info", message),
    debug: (message: string) => emit("debug", message),
  };
}

export type Logger = ReturnType<typeof createLogger>;
