# mcp-lyricscom

[![npm](https://img.shields.io/npm/v/mcp-lyricscom.svg)](https://www.npmjs.com/package/mcp-lyricscom)
[![CI](https://github.com/smeet666/mcp-lyricscom/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-lyricscom/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-lyricscom.svg)](./LICENSE)

An [MCP](https://modelcontextprotocol.io) server for [lyrics.com](https://www.lyrics.com).
Search songs by a word in their lyrics, by title, and read the full text.
**No API key, no account, no configuration.**

_(Version française plus bas / [French version below](#mcp-lyricscom-français))_

---

## Quickstart

**Claude Code**

```bash
claude mcp add lyricscom -- npx -y mcp-lyricscom
```

**Claude Desktop, Cursor, and any client using the standard config format**

```json
{
  "mcpServers": {
    "lyricscom": {
      "command": "npx",
      "args": ["-y", "mcp-lyricscom"]
    }
  }
}
```

That is the whole setup. There is nothing to sign up for.

## Tools

| Tool            | What it does                                                                                 | Key parameters                                        |
| --------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `search_lyrics` | Finds songs whose **lyrics contain a word or phrase**, with the matching line as an excerpt. | `query`, `limit`, `page`, `verify`, `include_excerpt` |
| `search_songs`  | Finds songs **by title**, optionally narrowed by artist.                                     | `title`, `artist`, `limit`, `page`, `match`           |
| `get_lyrics`    | Reads the **full lyrics** of one song, by id or URL.                                         | `id`, `url`, `max_chars`, `offset`, `highlight`       |

The two search tools return a lyrics.com `id` for every result; `get_lyrics` takes that id.
That is the intended chain: search, then read.

### Things worth knowing

**Search really checks the lyrics.** lyrics.com's own search also returns title
matches and loose matches. `search_lyrics` filters them out locally, using a
word-boundary matcher, so a result is a song where the word genuinely appears.
`coup` does not match `beaucoup`, but `enfant` does match `enfants`. Set
`verify: "none"` to see the raw, unfiltered list.

**Pagination is yours to drive.** One call fetches one page (24 rows on
lyrics.com). The response carries `has_more` and `next_page`. Raising `limit`
does not fetch more pages, on purpose: chaining several fetches inside a single
tool call is the fastest way to get rate limited.

**Some songs have no lyrics.** A valid lyrics.com page can simply have no text
on file. That comes back as `status: "no_lyrics"` with a successful result, not
an error, so there is nothing to retry.

**Rate limiting is visible, not silent.** lyrics.com answers a throttled request
with an empty body rather than a normal error code. This server detects that and
returns an explicit `throttled` error telling you to wait and try again. It never
reports throttling as "no results found", which would be indistinguishable from a
genuine answer.

## Configuration

Every variable is optional. Set them in the `env` block of your MCP client config.

| Variable                      | Default                               | Purpose                                                       |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `LYRICSCOM_USER_AGENT`        | `mcp-lyricscom/<version> (+repo url)` | User-Agent sent to lyrics.com. See below.                     |
| `LYRICSCOM_MIN_INTERVAL_MS`   | `1100`                                | Minimum gap between requests. Raise it if you hit throttling. |
| `LYRICSCOM_TIMEOUT_MS`        | `15000`                               | Per-request timeout.                                          |
| `LYRICSCOM_MAX_RETRIES`       | `3`                                   | Retries on throttling and transient errors.                   |
| `LYRICSCOM_CACHE_TTL_MS`      | `900000`                              | In-memory page cache lifetime (15 minutes).                   |
| `LYRICSCOM_CACHE_MAX_ENTRIES` | `200`                                 | In-memory page cache size.                                    |
| `LYRICSCOM_LOG_LEVEL`         | `error`                               | `silent`, `error`, `info` or `debug`. Logs go to stderr.      |

```json
{
  "mcpServers": {
    "lyricscom": {
      "command": "npx",
      "args": ["-y", "mcp-lyricscom"],
      "env": { "LYRICSCOM_MIN_INTERVAL_MS": "1500" }
    }
  }
}
```

### About the User-Agent

This server identifies itself honestly by default, naming the project and linking
to this repository. lyrics.com serves that fine today.

It does block some generic tool agents outright: a plain `curl/8.5.0` gets a 403.
If you ever see a `blocked_user_agent` error, set `LYRICSCOM_USER_AGENT` to a
value of your choosing. That override exists so you are not stuck, and what you
put in it is your call and your responsibility.

## Troubleshooting

**"throttled" errors.** lyrics.com is rate limiting you. Wait a few seconds and
retry; the server already backs off and slows itself down on its own. If it keeps
happening, raise `LYRICSCOM_MIN_INTERVAL_MS`. Note that a `throttled` error does
not mean your query has no results.

**"blocked_user_agent" errors.** See the User-Agent section above.

**"parse_failure" errors.** lyrics.com changed its page layout and the server
could not read the response. Please [open an issue](https://github.com/smeet666/mcp-lyricscom/issues)
with the query you used. The server deliberately reports this loudly instead of
pretending it found nothing.

**Empty results.** If `raw_result_count` is greater than zero while `results` is
empty, lyrics.com did return rows but none of them actually contain your word.
Try `verify: "none"` to see them anyway.

## How it works

There is no lyrics.com API. The server requests the same public pages you would
open in a browser and reads them with [cheerio](https://cheerio.js.org). It
fetches one page at a time, roughly one request per second, backs off when the
site pushes back, and keeps a small in-memory cache so repeated questions about
the same song do not hit the site again.

## Development

```bash
npm install
npm run build:fixtures   # regenerate the HTML test fixtures
npm test                 # unit tests, no network
npm run typecheck
npm run build
LYRICSCOM_LIVE=1 npm run test:live   # hits the real site, excluded from CI
npm run inspector        # explore the tools in the MCP Inspector
```

The fixtures are generated, not scraped: they reproduce lyrics.com's markup
structure with placeholder text, so the parser tests are deterministic and no
copyrighted lyrics live in this repository.

The scraping layer (`src/lyricscom`, `src/text`) does not import the MCP SDK and
is published separately as `mcp-lyricscom/client`, so it can be used as a plain
library.

## Lyrics and copyright

Song lyrics are copyrighted works owned by their authors and publishers. This
project claims no rights over them.

This server is a client. It fetches the same public lyrics.com pages you could
open in a browser, on demand, one request at a time, in response to an explicit
request from you or your assistant. It does not crawl the site, does not build a
lyrics database, and does not write anything to disk. Pages are held in memory
for a few minutes so that repeated questions do not hit the site again.

Every result carries the artist, the title, and the source URL. If you display or
reuse anything this server returns, keep that attribution and link back to the
source page.

The server honours lyrics.com's robots.txt: none of the endpoints it uses are
disallowed there. It rate limits itself by default. Please do not lower
`LYRICSCOM_MIN_INTERVAL_MS` for bulk use.

This is an unofficial project, with no affiliation to, endorsement by, or
sponsorship from lyrics.com or STANDS4 Ltd. Use it in accordance with lyrics.com's
terms of service and the copyright law that applies to you.

## License

MIT. See [LICENSE](./LICENSE). The license covers this source code only, not the
lyrics retrieved through it.

---

<a name="mcp-lyricscom-français"></a>

# mcp-lyricscom (français)

Un serveur [MCP](https://modelcontextprotocol.io) pour [lyrics.com](https://www.lyrics.com).
Cherchez des chansons par un mot présent dans les paroles, par titre, et lisez le
texte complet. **Sans clé d'API, sans compte, sans configuration.**

## Démarrage rapide

**Claude Code**

```bash
claude mcp add lyricscom -- npx -y mcp-lyricscom
```

**Claude Desktop, Cursor, et tout client utilisant le format de configuration standard**

```json
{
  "mcpServers": {
    "lyricscom": {
      "command": "npx",
      "args": ["-y", "mcp-lyricscom"]
    }
  }
}
```

C'est toute l'installation. Il n'y a aucune inscription.

## Outils

| Outil           | Rôle                                                                                                                | Paramètres principaux                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `search_lyrics` | Trouve les chansons dont les **paroles contiennent un mot ou une phrase**, avec la ligne correspondante en extrait. | `query`, `limit`, `page`, `verify`, `include_excerpt` |
| `search_songs`  | Trouve des chansons **par titre**, éventuellement restreintes à un artiste.                                         | `title`, `artist`, `limit`, `page`, `match`           |
| `get_lyrics`    | Lit les **paroles complètes** d'une chanson, par id ou par URL.                                                     | `id`, `url`, `max_chars`, `offset`, `highlight`       |

Les deux outils de recherche renvoient un `id` lyrics.com pour chaque résultat, et
`get_lyrics` prend cet id. C'est l'enchaînement prévu : chercher, puis lire.

### Ce qu'il faut savoir

**La recherche vérifie vraiment les paroles.** La recherche de lyrics.com renvoie
aussi des correspondances de titre et des à-peu-près. `search_lyrics` les écarte
localement, avec un matcher qui respecte les frontières de mot : un résultat est
donc une chanson où le mot est réellement présent. `coup` ne matche pas
`beaucoup`, mais `enfant` matche bien `enfants`. Mettez `verify: "none"` pour voir
la liste brute.

**C'est vous qui paginez.** Un appel récupère une page (24 lignes chez
lyrics.com). La réponse porte `has_more` et `next_page`. Augmenter `limit` ne va
pas chercher plus de pages, volontairement : enchaîner plusieurs requêtes dans un
seul appel d'outil est le meilleur moyen de se faire limiter.

**Certaines chansons n'ont pas de paroles.** Une page lyrics.com valide peut
simplement n'avoir aucun texte enregistré. Cela revient en `status: "no_lyrics"`
avec un résultat réussi, pas une erreur : inutile de réessayer.

**La limitation de débit est visible, pas silencieuse.** lyrics.com répond à une
requête limitée par un corps vide plutôt que par un code d'erreur normal. Ce
serveur le détecte et renvoie une erreur `throttled` explicite, qui vous dit
d'attendre et de réessayer. Il ne présente jamais une limitation comme « aucun
résultat », ce qui serait indiscernable d'une vraie réponse.

## Configuration

Toutes les variables sont optionnelles. Elles se déclarent dans le bloc `env` de
la configuration de votre client MCP.

| Variable                      | Défaut                                    | Rôle                                                                 |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `LYRICSCOM_USER_AGENT`        | `mcp-lyricscom/<version> (+url du dépôt)` | User-Agent envoyé à lyrics.com. Voir plus bas.                       |
| `LYRICSCOM_MIN_INTERVAL_MS`   | `1100`                                    | Écart minimal entre deux requêtes. À augmenter en cas de limitation. |
| `LYRICSCOM_TIMEOUT_MS`        | `15000`                                   | Délai d'attente par requête.                                         |
| `LYRICSCOM_MAX_RETRIES`       | `3`                                       | Tentatives sur limitation et erreurs passagères.                     |
| `LYRICSCOM_CACHE_TTL_MS`      | `900000`                                  | Durée de vie du cache mémoire (15 minutes).                          |
| `LYRICSCOM_CACHE_MAX_ENTRIES` | `200`                                     | Taille du cache mémoire.                                             |
| `LYRICSCOM_LOG_LEVEL`         | `error`                                   | `silent`, `error`, `info` ou `debug`. Les logs vont sur stderr.      |

### À propos du User-Agent

Le serveur s'identifie honnêtement par défaut, en nommant le projet et en pointant
vers ce dépôt. lyrics.com l'accepte sans problème aujourd'hui.

Le site bloque en revanche certains agents d'outils génériques : un simple
`curl/8.5.0` reçoit un 403. Si vous voyez une erreur `blocked_user_agent`,
définissez `LYRICSCOM_USER_AGENT` à la valeur de votre choix. Cette surcharge
existe pour que vous ne restiez pas bloqué ; ce que vous y mettez relève de votre
décision et de votre responsabilité.

## Dépannage

**Erreurs « throttled ».** lyrics.com vous limite. Attendez quelques secondes et
réessayez ; le serveur ralentit déjà tout seul. Si cela persiste, augmentez
`LYRICSCOM_MIN_INTERVAL_MS`. Une erreur `throttled` ne signifie pas que votre
requête n'a pas de résultats.

**Erreurs « blocked_user_agent ».** Voir la section User-Agent ci-dessus.

**Erreurs « parse_failure ».** lyrics.com a changé la structure de ses pages et le
serveur n'a pas su lire la réponse. Merci d'[ouvrir une issue](https://github.com/smeet666/mcp-lyricscom/issues)
en indiquant la requête utilisée. Le serveur signale volontairement ce cas au lieu
de faire comme s'il n'avait rien trouvé.

**Résultats vides.** Si `raw_result_count` est supérieur à zéro alors que
`results` est vide, lyrics.com a bien renvoyé des lignes mais aucune ne contient
réellement votre mot. Essayez `verify: "none"` pour les voir quand même.

## Fonctionnement

lyrics.com n'a pas d'API. Le serveur demande les mêmes pages publiques que celles
que vous ouvririez dans un navigateur et les lit avec
[cheerio](https://cheerio.js.org). Il récupère une page à la fois, à environ une
requête par seconde, ralentit quand le site le lui demande, et garde un petit
cache mémoire pour ne pas redemander deux fois la même page.

## Développement

```bash
npm install
npm run build:fixtures   # régénère les fixtures HTML de test
npm test                 # tests unitaires, sans réseau
npm run typecheck
npm run build
LYRICSCOM_LIVE=1 npm run test:live   # touche le vrai site, exclu de la CI
npm run inspector        # explorer les outils dans le MCP Inspector
```

Les fixtures sont générées, pas aspirées : elles reproduisent la structure du
markup de lyrics.com avec du texte de remplissage, ce qui rend les tests de
parsing déterministes et évite de stocker des paroles sous droits dans ce dépôt.

La couche de scraping (`src/lyricscom`, `src/text`) n'importe pas le SDK MCP et
est publiée séparément sous `mcp-lyricscom/client`, utilisable comme simple
bibliothèque.

## Paroles et droits d'auteur

Les paroles de chansons sont des œuvres protégées, propriété de leurs auteurs et
éditeurs. Ce projet ne revendique aucun droit dessus.

Ce serveur est un client. Il va chercher les mêmes pages publiques de lyrics.com
que celles que vous pourriez ouvrir dans un navigateur, à la demande, une requête
à la fois, en réponse à une demande explicite de votre part ou de celle de votre
assistant. Il ne parcourt pas le site, ne constitue aucune base de paroles, et
n'écrit rien sur le disque. Les pages restent en mémoire quelques minutes pour ne
pas solliciter le site inutilement.

Chaque résultat porte l'artiste, le titre et l'URL source. Si vous affichez ou
réutilisez ce que renvoie ce serveur, conservez cette attribution et le lien vers
la page d'origine.

Le serveur respecte le robots.txt de lyrics.com : aucun des endpoints qu'il
utilise n'y est interdit. Il s'auto-limite par défaut. Merci de ne pas abaisser
`LYRICSCOM_MIN_INTERVAL_MS` pour un usage en masse.

Projet non officiel, sans affiliation à lyrics.com ni à STANDS4 Ltd, ni
approbation ou parrainage de leur part. Utilisez-le dans le respect des conditions
d'utilisation de lyrics.com et du droit d'auteur qui vous est applicable.

## Licence

MIT, voir [LICENSE](./LICENSE). La licence couvre uniquement le code source, pas
les paroles récupérées par son intermédiaire.
