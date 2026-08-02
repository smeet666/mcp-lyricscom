import { describe, expect, it } from "vitest";
import { containsWord, getKeywordIndex } from "../../src/text/keywordIndex.js";

describe("getKeywordIndex", () => {
  it("finds a delimited word and points at the word itself", () => {
    const text = "de ma joie qui ne souffre";
    expect(getKeywordIndex("joie", text)).toBe(text.indexOf("joie"));
  });

  it("matches at the start and at the end of the text", () => {
    expect(getKeywordIndex("joie", "joie partout")).toBe(0);
    expect(getKeywordIndex("joie", "partout la joie")).toBe(11);
  });

  it("does not match a word embedded in a longer one", () => {
    expect(getKeywordIndex("coup", "beaucoup de bruit")).toBe(-1);
    expect(containsWord("coup", "beaucoup")).toBe(false);
  });

  it("matches a word start on the second pass", () => {
    expect(containsWord("enfant", "les enfants jouent")).toBe(true);
    expect(containsWord("matin", "matinée douce")).toBe(true);
  });

  it("prefers an exact match over a later prefix match", () => {
    const text = "les enfants puis enfant seul";
    expect(getKeywordIndex("enfant", text)).toBe(text.indexOf("enfant seul"));
  });

  it("treats the typographic apostrophe as a boundary", () => {
    expect(containsWord("enfant", "l’enfant court")).toBe(true);
    expect(containsWord("avant", "d’avant hier")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(containsWord("JOIE", "quelle joie")).toBe(true);
    expect(containsWord("autrefois", "AUTREFOIS le monde")).toBe(true);
    expect(containsWord("Envie", "une envie soudaine")).toBe(true);
  });

  it("keeps accents significant", () => {
    // "envie" and "envié" are different words, so the prefix pass must not
    // bridge them. Folding accents here would let the server claim a word is
    // present when a different one is.
    expect(containsWord("envie", "envié par tous")).toBe(false);
    expect(containsWord("cote", "la côte bretonne")).toBe(false);
  });

  it("handles punctuation and bracket delimiters", () => {
    expect(containsWord("jamais", "plus jamais, dit-il")).toBe(true);
    expect(containsWord("yeux", "(yeux) fermés")).toBe(true);
    expect(containsWord("avant", "avant-hier")).toBe(true);
  });

  it("escapes regex metacharacters in the query", () => {
    expect(containsWord("c++", "je code en c++ souvent")).toBe(true);
    expect(() => getKeywordIndex("a(b", "anything")).not.toThrow();
    expect(containsWord("a(b", "voici a(b ici")).toBe(true);
  });

  it("returns -1 for empty inputs", () => {
    expect(getKeywordIndex("", "text")).toBe(-1);
    expect(getKeywordIndex("word", "")).toBe(-1);
  });
});
