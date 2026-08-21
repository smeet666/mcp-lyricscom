/**
 * Text cleaning for scraped content: HTML entities, mojibake, whitespace.
 */

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/** Decode named and numeric HTML entities. */
export function unescapeHtml(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const codePoint = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return match;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Repair UTF-8 bytes that were decoded as Latin-1, which turns "é" into "Ã©".
 * lyrics.com serves French titles that occasionally arrive in this state.
 * Re-encoding through latin1 recovers the original text; the round trip is only
 * kept when it removes replacement characters, so correct text is never touched.
 */
export function fixEncodingIssues(text: string): string {
  if (!text || !/[ÃÂ]/.test(text)) {
    return text;
  }
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (repaired.includes("�")) {
      return text;
    }
    return repaired;
  } catch {
    return text;
  }
}

/** Collapse runs of whitespace and trim. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Full cleaning pass for a scraped title or artist name. */
export function cleanInlineText(text: string): string {
  if (!text) {
    return "";
  }
  return collapseWhitespace(fixEncodingIssues(unescapeHtml(text)));
}

/**
 * Normalize a lyrics block: trim each line, drop leading and trailing blank
 * lines, and collapse runs of blank lines to a single verse separator.
 */
export function cleanLyricsText(text: string): string {
  if (!text) {
    return "";
  }
  const normalized = fixEncodingIssues(unescapeHtml(text)).replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim());

  const out: string[] = [];
  for (const line of lines) {
    if (line === "" && (out.length === 0 || out.at(-1) === "")) {
      continue;
    }
    out.push(line);
  }
  while (out.length > 0 && out.at(-1) === "") {
    out.pop();
  }
  return out.join("\n");
}
