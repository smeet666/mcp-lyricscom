# mcp-lyricscom

## Tagline
Find a song from a word inside its lyrics, then read the words, with no API key.

## Description
An MCP server for lyrics.com. Its reason to exist is one question the other
lyrics sources cannot answer: which song contains this line. Search by a phrase
you half remember, or by title when you know it, then read the full lyrics.

Results say plainly when the site chose them loosely rather than matching what
was asked, so a model does not quote one song's words for another. Long lyrics
paginate, and a throttled response is reported as throttling rather than as a
song that does not exist.

## Setup Requirements
- `LYRICSCOM_USER_AGENT` (optional): Identify your own client. The project's own identifier is appended.
- `LYRICSCOM_MIN_INTERVAL_MS` (optional): Minimum gap between requests. Default 1100, and values below 500 are refused.
- `LYRICSCOM_TIMEOUT_MS` (optional): Per-request deadline. Default 15000.
- `LYRICSCOM_CACHE_TTL_MS` (optional): In-memory cache lifetime. Default 900000. Set 0 to turn it off.
- `LYRICSCOM_LOG_LEVEL` (optional): silent, error, info or debug. Default error, on stderr.

No API key and no account are needed.

## Category
Content & Media

## Features
- Search by a word or a phrase written inside the lyrics
- Search by title, in a strict or a loose mode, with the mode stated in the answer
- Read the full lyrics of one song, paginated at line boundaries
- Optional verification that a result really contains the phrase searched for
- Says when the site picked a result loosely, so a quote is never misattributed
- Distinguishes throttling from absence, with a clear error code
- Attribution and a source link on every result

## Getting Started
- "Which song has the line 'we are the champions, my friends'?"
- "Find a song whose lyrics mention a paper moon"
- "Show me the full lyrics of Sunny Afternoon by The Kinks"
- Tool: search_lyrics — Finds songs from a word or phrase inside the lyrics
- Tool: search_songs — Finds songs by title, strictly or loosely
- Tool: get_lyrics — Reads the full lyrics of one song

## Tags
lyrics, song-search, full-text, music, songs, lyrics-com, no-api-key, read-only

## Documentation URL
https://github.com/smeet666/mcp-lyricscom#readme
