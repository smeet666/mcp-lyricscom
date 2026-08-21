/**
 * Two-pass keyword matcher.
 *
 * lyrics.com's own search is fuzzy: it returns title-only matches and loose
 * matches alongside genuine lyric-body hits. This matcher is what lets the
 * server promise that a returned song really contains the query.
 *
 * Pass 1 requires the keyword to be delimited on both sides, so "coup" does not
 * match "beaucoup". Pass 2 relaxes the right-hand side to a word start, so
 * "enfant" still matches "enfants". Pass 2 only runs when pass 1 finds nothing,
 * which keeps exact hits ranked ahead of prefix hits.
 */

/**
 * Characters treated as word boundaries. Includes the typographic apostrophe,
 * which is common in French lyrics ("l’enfant").
 */
const WORD_DELIMITERS = "[\\s,;:'\".!?()\\[\\]&’`@-]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Index of `keyword` inside `text`, or -1 when absent.
 * The returned index points at the keyword itself, not at the leading delimiter.
 */
export function getKeywordIndex(keyword: string, text: string): number {
  if (!keyword || !text) {
    return -1;
  }

  const escaped = escapeRegExp(keyword.toLowerCase());
  const haystack = text.toLowerCase();

  const passes = [
    new RegExp(`(^|${WORD_DELIMITERS})${escaped}(${WORD_DELIMITERS}|$)`),
    new RegExp(`(^|${WORD_DELIMITERS})${escaped}`),
  ];

  for (const pattern of passes) {
    const match = pattern.exec(haystack);
    if (match) {
      const leadingDelimiter = match[1] ?? "";
      return match.index + leadingDelimiter.length;
    }
  }

  return -1;
}

export function containsWord(keyword: string, text: string): boolean {
  return getKeywordIndex(keyword, text) !== -1;
}
