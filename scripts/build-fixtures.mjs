/**
 * Generates the HTML fixtures used by the unit tests.
 *
 * The fixtures reproduce lyrics.com's markup structure exactly (class names,
 * nesting, the anchor-wrapped words inside the lyrics block) but carry
 * placeholder text instead of real lyrics. The parsers are checked against
 * structure, so no copyrighted text needs to live in this repository.
 *
 * Run with: npm run build:fixtures
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

const PAD = "<!-- " + "padding ".repeat(400) + "-->";

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
${body}
${PAD}
</body>
</html>
`;
}

/** One search result row, matching the live markup shape. */
function resultRow({
  id,
  artist,
  artistId,
  title,
  album,
  year,
  snippet,
  legacyPath,
  artistPlural,
}) {
  const path = `${legacyPath ? "/lyric" : "/lyric-lf"}/${id}/${encodeURIComponent(artist).replace(/%20/g, "+")}/${encodeURIComponent(title).replace(/%20/g, "+")}`;
  const albumBlock = album
    ? `<p class="lyric-meta-album">Album: <a href="/album/${id}">${album}</a></p>`
    : "";
  const yearBlock = year ? `<p class="lyric-meta-album-year">${year}</p>` : "";
  // Rows without an album carry the artist under a different class on the live
  // site, so both shapes have to appear in the fixture.
  const artistClass = artistPlural ? "lyric-meta-artists" : "lyric-meta-album-artist";
  return `<div class="sec-lyric clearfix">
  <div class="lyric-meta within-lyrics fll">
    <div>
      <p class="lyric-meta-title"><a href="${path}">${title}</a></p>
      <p class="${artistClass}"><a href="artist/${artist.replace(/\s+/g, "-")}/${artistId}">${artist}</a></p>
      ${albumBlock}
      ${yearBlock}
    </div>
    <div class="clearfix"></div>
  </div>
  <pre class="lyric-body" onclick="location.href='https://www.lyrics.com${path}';">${snippet}</pre>
</div>`;
}

const SERP_SHELL_OPEN = `<div id="main-content">
<form action="/serp.php" method="get"><input type="text" name="st"></form>
<div class="best-matches">`;
const SERP_SHELL_CLOSE = `</div>
<div class="pagination"><a href="/serp.php?st=joie&p=2">2</a></div>
</div>`;

/**
 * 24 rows, the count lyrics.com serves per page. Album and year are sparse on
 * the real site, so only a few rows carry them. Two rows use the legacy
 * `/lyric/` path so the id extractor is exercised on both URL shapes.
 */
function buildSerpPage1() {
  const rows = [];
  for (let i = 0; i < 24; i += 1) {
    const n = i + 1;
    rows.push(
      resultRow({
        id: 1000000 + n,
        artist: `Artist ${n}`,
        artistId: 20000 + n,
        title: `Placeholder Song ${n}`,
        album: i % 8 === 0 ? `Placeholder Album ${n}` : null,
        year: i % 12 === 0 ? 1970 + n : null,
        snippet: `first placeholder line\nline two mentions <em>joie</em> right here\nthird placeholder line`,
        legacyPath: i === 5 || i === 11,
        artistPlural: i === 16 || i === 22,
      }),
    );
  }
  // A duplicate of row 1 with a bracketed suffix, so dedupe has something to do.
  rows.push(
    resultRow({
      id: 1999999,
      artist: "Artist 1",
      artistId: 20001,
      title: "Placeholder Song 1 [Deluxe Edition]",
      album: "Placeholder Album 1",
      year: 1971,
      snippet: `line two mentions <em>joie</em> right here`,
      legacyPath: false,
    }),
  );
  // A row with no usable title link, which must be skipped rather than crash.
  rows.push(`<div class="sec-lyric clearfix">
  <div class="lyric-meta within-lyrics fll"><div><p class="lyric-meta-title"></p></div></div>
  <pre class="lyric-body">orphan row</pre>
</div>`);

  return page("Joie Lyrics", `${SERP_SHELL_OPEN}\n${rows.join("\n")}\n${SERP_SHELL_CLOSE}`);
}

function buildSerpEmpty() {
  return page(
    "No results",
    `${SERP_SHELL_OPEN}<p>Sorry, no results were found.</p>${SERP_SHELL_CLOSE}`,
  );
}

/** A well-formed page that is simply not a lyrics.com search page. */
function buildSerpUnrecognized() {
  return page(
    "Something else",
    `<div class="promo"><h1>Unrelated page</h1><p>No search markup here.</p></div>`,
  );
}

/**
 * lyrics.com links many individual words to its dictionary. The parser has to
 * unwrap those anchors without losing the line structure, which is exactly what
 * this fixture pins down.
 */
function buildSongWithLyrics() {
  const body = [
    `Placeholder <a href="/definition/first">first</a> line of text`,
    `Second placeholder line mentioning <a href="/definition/joie">joie</a> clearly`,
    ``,
    `Third placeholder line after a blank`,
    `Fourth <a href="/definition/final">final</a> placeholder line`,
  ].join("\n");

  return page(
    "Placeholder Song 1 Lyrics",
    `<div id="lyric-body">
  <h1 id="lyric-title-text">Placeholder Song 1</h1>
  <h3 class="lyric-artist"><a href="/artist/Artist-1">Artist 1</a></h3>
  <pre id="lyric-body-text" class="lyric-body">${body}</pre>
</div>`,
  );
}

/** Older pages expose the lyrics under the class only, with no id. */
function buildSongFallbackBody() {
  return page(
    "Placeholder Song 2 Lyrics",
    `<div id="lyric-body">
  <h1 class="lyric-title">Placeholder Song 2</h1>
  <h3 class="lyric-artist">Artist 2</h3>
  <pre class="lyric-body">Only placeholder line here</pre>
</div>`,
  );
}

/** A valid song page that genuinely has no lyrics on file. */
function buildSongNoLyrics() {
  return page(
    "No Lyrics found",
    `<div id="s4-page-lyric">
  <div class="lyric-no-data clearfix">
    <h2>No Lyrics found</h2>
    <p>We do not have the lyrics for this track yet.</p>
  </div>
</div>`,
  );
}

/** A song page whose lyrics container disappeared: selector drift, not an answer. */
function buildSongBroken() {
  return page(
    "Placeholder Song 3 Lyrics",
    `<div id="lyric-body">
  <h1 id="lyric-title-text">Placeholder Song 3</h1>
  <div class="brand-new-markup">the lyrics used to be here</div>
</div>`,
  );
}

const FIXTURES = {
  "serp-page1.html": buildSerpPage1(),
  "serp-empty.html": buildSerpEmpty(),
  "serp-unrecognized.html": buildSerpUnrecognized(),
  "song-with-lyrics.html": buildSongWithLyrics(),
  "song-fallback-body.html": buildSongFallbackBody(),
  "song-no-lyrics.html": buildSongNoLyrics(),
  "song-broken.html": buildSongBroken(),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(FIXTURES)) {
  writeFileSync(join(OUT_DIR, name), content, "utf8");
  process.stdout.write(`wrote ${name} (${content.length} bytes)\n`);
}
