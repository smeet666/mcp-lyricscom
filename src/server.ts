/**
 * MCP server wiring.
 *
 * One client, one rate limiter and one cache are shared by all three tools:
 * per-tool instances would let three tools each open their own request stream
 * and defeat the throttling protection.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config, Logger } from "./config.js";
import { createLogger, loadConfig } from "./config.js";
import { LyricsComClient } from "./lyricscom/client.js";
import {
  getLyricsDescription,
  getLyricsInputShape,
  getLyricsOutputShape,
  runGetLyrics,
} from "./tools/getLyrics.js";
import type { GetLyricsArgs } from "./tools/getLyrics.js";
import {
  runSearchLyrics,
  searchLyricsDescription,
  searchLyricsInputShape,
  searchLyricsOutputShape,
} from "./tools/searchLyrics.js";
import type { SearchLyricsArgs } from "./tools/searchLyrics.js";
import {
  runSearchSongs,
  searchSongsDescription,
  searchSongsInputShape,
  searchSongsOutputShape,
} from "./tools/searchSongs.js";
import type { SearchSongsArgs } from "./tools/searchSongs.js";
import { PKG_VERSION } from "./version.js";

export interface CreateServerOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function createServer(options: CreateServerOptions = {}): McpServer {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger(config.logLevel);
  const client = new LyricsComClient({
    config,
    logger,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const server = new McpServer(
    { name: "mcp-lyricscom", version: PKG_VERSION },
    {
      instructions:
        "Tools for looking up song lyrics on lyrics.com. No API key is needed. " +
        "Typical flow: search_lyrics (by a word in the lyrics) or search_songs (by title) to get a song id, " +
        "then get_lyrics with that id. When you show lyrics to a user, credit the artist and link the source URL. " +
        "A 'throttled' error means lyrics.com is rate limiting this client, not that the song does not exist.",
    },
  );

  server.registerTool(
    "search_lyrics",
    {
      title: "Search lyrics by word",
      description: searchLyricsDescription,
      inputSchema: searchLyricsInputShape,
      outputSchema: searchLyricsOutputShape,
      annotations: READ_ONLY,
    },
    async (args) => runSearchLyrics(client, args as SearchLyricsArgs),
  );

  server.registerTool(
    "search_songs",
    {
      title: "Search songs by title",
      description: searchSongsDescription,
      inputSchema: searchSongsInputShape,
      outputSchema: searchSongsOutputShape,
      annotations: READ_ONLY,
    },
    async (args) => runSearchSongs(client, args as SearchSongsArgs),
  );

  server.registerTool(
    "get_lyrics",
    {
      title: "Get full lyrics",
      description: getLyricsDescription,
      inputSchema: getLyricsInputShape,
      outputSchema: getLyricsOutputShape,
      annotations: READ_ONLY,
    },
    async (args) => runGetLyrics(client, args as GetLyricsArgs),
  );

  logger.info(
    `ready: user-agent="${config.userAgent}", min interval ${config.minIntervalMs}ms, cache ${config.cacheTtlMs}ms`,
  );

  return server;
}
