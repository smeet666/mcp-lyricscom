import { describe, expect, it } from "vitest";
import { classifyResponse } from "../../src/lyricscom/parsers/detectThrottle.js";

const REAL_PAGE = `<!DOCTYPE html><html><body>${"x".repeat(5000)}</body></html>`;

describe("classifyResponse", () => {
  it("treats HTTP 202 as throttling, which is how lyrics.com signals it", () => {
    expect(classifyResponse(202, "")).toEqual({ kind: "throttled", reason: "status-202" });
  });

  it("treats a 200 with an empty body as throttling, not as an empty page", () => {
    expect(classifyResponse(200, "")).toEqual({ kind: "throttled", reason: "empty-body" });
    expect(classifyResponse(200, "   \n  ")).toEqual({ kind: "throttled", reason: "empty-body" });
  });

  it("treats an implausibly short body as throttling", () => {
    expect(classifyResponse(200, "<html><body>nope</body>")).toEqual({
      kind: "throttled",
      reason: "short-body",
    });
  });

  it("accepts a short but complete document", () => {
    const short = "<html><body>ok</body></html>";
    expect(classifyResponse(200, short)).toEqual({ kind: "ok", html: short });
  });

  it("maps the remaining statuses", () => {
    expect(classifyResponse(429, "")).toEqual({ kind: "throttled", reason: "status-429" });
    expect(classifyResponse(503, "")).toEqual({ kind: "throttled", reason: "status-503" });
    expect(classifyResponse(403, "denied")).toEqual({ kind: "blocked", status: 403 });
    expect(classifyResponse(404, "missing")).toEqual({ kind: "not-found" });
    expect(classifyResponse(500, "boom")).toEqual({ kind: "server-error", status: 500 });
  });

  it("passes a real page through", () => {
    expect(classifyResponse(200, REAL_PAGE)).toEqual({ kind: "ok", html: REAL_PAGE });
  });
});
