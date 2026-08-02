# Changelog

## 0.1.1

- Enforce a floor on the request interval. `LYRICSCOM_MIN_INTERVAL_MS` is now
  refused below 500 ms; a lower value falls back to the default 1100 ms and warns
  on stderr. The pacing that keeps this client polite towards lyrics.com no
  longer depends on every installation configuring it correctly.

## 0.1.0

Initial release. Three tools over stdio, no API key: `search_lyrics` (word or
phrase inside the lyrics), `search_songs` (by title), `get_lyrics` (full text by
id or URL).
