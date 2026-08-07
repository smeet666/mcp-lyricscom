/**
 * What happens to an argument no tool declares.
 *
 * A caller who mistypes an argument name, or qualifies one this server keeps
 * plain, must be told. An argument that is read and dropped leaves the answer
 * computed on a default, which reads as an answer to the question that was
 * asked and is not one.
 *
 * Everything here goes over the protocol, because the refusal is the server's
 * answer to a client rather than an internal check.
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
function stubFetch(routes: Array<[RegExp, StubRoute]>): typeof fetch {
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

const SEARCH_OK: Array<[RegExp, StubRoute]> = [
  [/lyrics\/|serp\.php/, { body: load("serp-page1.html") }],
  [/lyric-lf\//, { body: load("song-with-lyrics.html") }],
];

/** One valid call per tool, so a refusal is never mistaken for a broken tool. */
const CALLS: Array<[string, Record<string, unknown>]> = [
  ["search_lyrics", { query: "joie" }],
  ["search_songs", { title: "Placeholder Song 1" }],
  ["get_lyrics", { id: "1000001" }],
];

async function connect(): Promise<Client> {
  const config = {
    ...loadConfig({}),
    minIntervalMs: 0,
    maxRetries: 0,
    logLevel: "silent" as const,
  };
  const server = createServer({
    config,
    logger: createLogger("silent"),
    fetchImpl: stubFetch(SEARCH_OK),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "unknown-arguments", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

interface CallResult {
  isError?: boolean;
  content?: Array<{ text?: string }>;
}

/** What a caller receives: whether the call failed, and what it was told. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const result = (await client.callTool({ name, arguments: args })) as CallResult;
  return {
    isError: result.isError === true,
    text: (result.content ?? []).map((part) => part.text ?? "").join("\n"),
  };
}

describe("the schema a client reads before calling", () => {
  it("says on every tool that an argument it does not declare is refused", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(CALLS.length);
    for (const tool of tools) {
      expect(
        (tool.inputSchema as { additionalProperties?: unknown }).additionalProperties,
        tool.name,
      ).toBe(false);
    }
  });
});

describe("an argument no tool declares", () => {
  it("is refused by every tool, and the refusal names it", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, { ...args, not_an_argument: 1 });
      expect(result.isError, name).toBe(true);
      expect(result.text, name).toContain("not_an_argument");
    }
  });

  it("is refused under the code the caller can branch on", async () => {
    const client = await connect();
    const result = await call(client, "search_lyrics", { query: "joie", not_an_argument: 1 });
    expect(result.text).toContain("invalid_input");
  });

  it("is answered with the declared name when it is a misspelling", async () => {
    const client = await connect();
    // "limt" is one deletion away from the declared "limit" argument of search_lyrics.
    const misspelt = await call(client, "search_lyrics", { query: "joie", limt: 3 });
    expect(misspelt.text).toContain("did you mean 'limit'");
  });

  it("is answered with the declared name when it is a prefix or suffix of one", async () => {
    const client = await connect();
    // "art" is a prefix of the declared "artist" argument of search_songs: a
    // caller shortening a name this tool spells out in full.
    const shortened = await call(client, "search_songs", { title: "Placeholder Song 1", art: "X" });
    expect(shortened.text).toContain("did you mean 'artist'");
  });

  it("lists the names the tool does take", async () => {
    const client = await connect();
    // "identifier" is not close to any declared name of search_songs, so no
    // suggestion is offered, and the message falls back to the full list.
    const result = await call(client, "search_songs", {
      title: "Placeholder Song 1",
      identifier: "x",
    });
    expect(result.text).toContain("This tool takes: title, artist, limit, page, match.");
  });

  it("leaves the arguments a tool does declare working", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, args);
      expect(result.isError, `${name}: ${result.text}`).toBe(false);
    }
  });
});
