/**
 * Excerpt extraction.
 *
 * Search results carry one short line showing where the query appears, never a
 * lyrics block. Excerpts stay small on purpose: they are enough for a model to
 * pick the right song, and search results are not the place to reproduce a
 * song's text.
 */

import { getKeywordIndex } from "./keywordIndex.js";

export interface ExcerptOptions {
  /** Hard cap on the returned excerpt. */
  maxChars?: number;
}

export interface LineMatch {
  line: string;
  /** 1-based line number within the text. */
  lineNumber: number;
}

/** First line containing `keyword`, using the two-pass matcher. */
export function findMatchingLine(text: string, keyword: string): LineMatch | null {
  if (!text || !keyword) {
    return null;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      continue;
    }
    if (getKeywordIndex(keyword, line) !== -1) {
      return { line: line.trim(), lineNumber: i + 1 };
    }
  }
  return null;
}

/**
 * Excerpt of the line where `keyword` appears, trimmed to a window centred on
 * the match. Falls back to the first non-empty line when the keyword is absent.
 */
export function matchedLineExcerpt(
  text: string,
  keyword: string,
  options: ExcerptOptions = {},
): string | null {
  const maxChars = options.maxChars ?? 160;
  if (!text) {
    return null;
  }

  const match = findMatchingLine(text, keyword);
  const line =
    match?.line ??
    text
      .split("\n")
      .find((candidate) => candidate.trim() !== "")
      ?.trim();
  if (!line) {
    return null;
  }
  if (line.length <= maxChars) {
    return line;
  }

  const keywordAt = match ? Math.max(getKeywordIndex(keyword, line), 0) : 0;
  const start = Math.max(0, keywordAt - Math.floor(maxChars / 2));
  const end = Math.min(line.length, start + maxChars);
  const slice = line.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < line.length ? "…" : ""}`;
}
