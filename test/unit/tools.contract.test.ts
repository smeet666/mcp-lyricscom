/**
 * End-to-end contract tests over a real MCP client/server pair, with the
 * network replaced by fixtures.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createLogger, loadConfig } from "../../src/config.js";
import { createServer } from "../../src/server.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

interface StubRoute {
  status?: number;
  body: string;
}

/** Routes a request URL to a canned response, by substring match. */
function stubFetch(routes: [RegExp, StubRoute][]): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0]) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, route] of routes) {
      if (pattern.test(url)) {
        return new Response(route.body, { status: route.status ?? 200 });
      }
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

async function connect(fetchImpl: typeof fetch) {
  const config = {
    ...loadConfig({}),
    // No pacing and no retries: these tests assert behaviour, not timing.
    minIntervalMs: 0,
    maxRetries: 0,
    logLevel: "silent" as const,
  };
  const server = createServer({ config, logger: createLogger("silent"), fetchImpl });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

const SEARCH_OK: [RegExp, StubRoute][] = [
  [/lyrics\/|serp\.php/, { body: load("serp-page1.html") }],
  [/lyric-lf\//, { body: load("song-with-lyrics.html") }],
];

describe("MCP tool contract", () => {
  it("exposes exactly the three documented tools", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_lyrics",
      "search_lyrics",
      "search_songs",
    ]);
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.outputSchema).toBeTruthy();
    }
  });

  it("search_lyrics returns structured results a model can chain from", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const result = (await client.callTool({
      name: "search_lyrics",
      arguments: { query: "joie", limit: 5 },
    })) as { isError?: boolean; structuredContent: Record<string, unknown> };

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      results: Array<{ id: string; source_url: string; excerpt: string | null }>;
      has_more: boolean;
      raw_result_count: number;
    };
    expect(structured.results.length).toBe(5);
    expect(structured.raw_result_count).toBeGreaterThan(0);
    expect(structured.has_more).toBe(true);
    for (const row of structured.results) {
      expect(row.id).toMatch(/^\d+$/);
      expect(row.source_url).toContain("lyrics.com");
    }
  });

  it("search_lyrics drops rows whose lyrics do not contain the query", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const result = (await client.callTool({
      name: "search_lyrics",
      arguments: { query: "absentword", limit: 10 },
    })) as { structuredContent: Record<string, unknown> };

    const structured = result.structuredContent as { results: unknown[]; filtered_out: number };
    expect(structured.results).toHaveLength(0);
    expect(structured.filtered_out).toBeGreaterThan(0);
  });

  it("get_lyrics returns the text with attribution and pagination fields", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const result = (await client.callTool({
      name: "get_lyrics",
      arguments: { id: "1000001", highlight: "joie" },
    })) as { isError?: boolean; structuredContent: Record<string, unknown> };

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      status: string;
      lyrics: string;
      truncated: boolean;
      attribution: string;
      highlight: { found: boolean; line_number: number | null };
    };
    expect(structured.status).toBe("ok");
    expect(structured.lyrics.length).toBeGreaterThan(0);
    expect(structured.truncated).toBe(false);
    expect(structured.attribution).toContain("lyrics.com");
    expect(structured.highlight.found).toBe(true);
    expect(structured.highlight.line_number).toBe(2);
  });

  it("get_lyrics reports a page with no lyrics as a successful answer", async () => {
    const { client } = await connect(
      stubFetch([[/lyric-lf\//, { body: load("song-no-lyrics.html") }]]),
    );
    const result = (await client.callTool({
      name: "get_lyrics",
      arguments: { id: "1000001" },
    })) as { isError?: boolean; structuredContent: Record<string, unknown> };

    // Marking this an error would push a model into pointless retries.
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { status: string }).status).toBe("no_lyrics");
  });

  it("search_songs ranks title matches and honours strict mode", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const loose = (await client.callTool({
      name: "search_songs",
      arguments: { title: "Placeholder Song 1", limit: 3 },
    })) as { structuredContent: Record<string, unknown> };
    const first = (loose.structuredContent as { results: Array<{ title: string }> }).results[0]!;
    expect(first.title).toBe("Placeholder Song 1");

    const strict = (await client.callTool({
      name: "search_songs",
      arguments: { title: "Placeholder Song 1", match: "strict", limit: 10 },
    })) as { structuredContent: Record<string, unknown> };
    const titles = (strict.structuredContent as { results: Array<{ title: string }> }).results.map(
      (r) => r.title,
    );
    expect(titles.every((t) => t.startsWith("Placeholder Song 1"))).toBe(true);
  });

  it("surfaces throttling as an error instead of an empty result list", async () => {
    // This is the regression guard for the behaviour that motivated the project:
    // lyrics.com answers a rate-limited request with HTTP 202 and no body, and a
    // naive client reports that as "no songs found".
    const { client } = await connect(stubFetch([[/.*/, { status: 202, body: "" }]]));
    const result = (await client.callTool({
      name: "search_lyrics",
      arguments: { query: "joie" },
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[throttled]");
    expect(result.content[0]!.text).toContain("does NOT mean there are no results");
  });

  it("reports a blocked user agent with actionable guidance", async () => {
    const { client } = await connect(stubFetch([[/.*/, { status: 403, body: "denied" }]]));
    const result = (await client.callTool({
      name: "search_lyrics",
      arguments: { query: "joie" },
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[blocked_user_agent]");
    expect(result.content[0]!.text).toContain("LYRICSCOM_USER_AGENT");
  });

  it("rejects a non-lyrics.com URL", async () => {
    const { client } = await connect(stubFetch(SEARCH_OK));
    const result = (await client.callTool({
      name: "get_lyrics",
      arguments: { url: "https://evil.com/lyric-lf/1/a/b" },
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[invalid_input]");
  });
});
