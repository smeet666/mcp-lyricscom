# mcp-lyricscom

[![npm](https://img.shields.io/npm/v/mcp-lyricscom.svg)](https://www.npmjs.com/package/mcp-lyricscom)
[![CI](https://github.com/smeet666/mcp-lyricscom/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-lyricscom/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-lyricscom.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-lyricscom)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-lyricscom/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-lyricscom)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-lyricscom-pptp4t?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-lyricscom-pptp4t)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lyricscom&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1seXJpY3Njb20iXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lyricscom&config=%7B%22name%22%3A%22lyricscom%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lyricscom%22%5D%7D)

<!-- m8ven-verify: 3c4d434dcafaac3c25dc86631fb1393b -->

[lyrics.com](https://www.lyrics.com) is a large public catalogue of song lyrics.
It files a song under its title, its artist, the album it appeared on and the
year, and it holds the words themselves. Its search reaches inside those words.

This server connects a chat client to that catalogue. You can search for a song
by a line you remember, search by title and artist, and read the words of one
song, a slice at a time, with the words you were looking for located in the text.
It needs no API key and no account.

_[Version française](#mcp-lyricscom-français)_

---

## Install

**One-click install**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lyricscom&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1seXJpY3Njb20iXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lyricscom&config=%7B%22name%22%3A%22lyricscom%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lyricscom%22%5D%7D)

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

Node 24 or later is required, and no environment variable has to be set.

### With Docker

```json
{
  "mcpServers": {
    "lyricscom": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-lyricscom:2.0.0"]
    }
  }
}
```

`-i` keeps stdin open, which is where the protocol travels, and `-t` is left out
because a TTY rewrites the stream. The container needs outbound HTTPS to
`www.lyrics.com`, and nothing else: no volume, no port, no credential.

### Bundle, without npm

Download `mcp-lyricscom-2.0.0.mcpb` from
[the latest release](https://github.com/smeet666/mcp-lyricscom/releases/latest)
and open it. A client that supports MCP bundles installs it on its own, with no
npm and no configuration file to edit. The bundle carries its dependencies, so
nothing is fetched at install time.

## What you can ask

- "Which song goes 'I've got a hand for you'?"
- "Find me the lyrics of Wichita Lineman by Glen Campbell."
- "Read me the second half of those words."
- "Where does the word 'lineman' appear in that song?"
- "What albums is that song on?"

The ordinary path runs from a search to a reading: a row carries an `id`, and
`get_lyrics` takes that id.

## Tools

| Tool            | What it does                                    |
| --------------- | ----------------------------------------------- |
| `search_lyrics` | Finds a song from a line inside its words.      |
| `search_songs`  | Finds songs by title, narrowed by artist.       |
| `get_lyrics`    | Reads the words of one song, a slice at a time. |

### `search_lyrics`

Finds a song from words inside its lyrics. The site ranks loosely, so a match is
checked before it is served.

| Argument          | Type                                           | Required | What it does                            |
| ----------------- | ---------------------------------------------- | -------- | --------------------------------------- |
| `query`           | string, 1 to 120 characters                    | yes      | The line, or part of it, to look for.   |
| `limit`           | integer, 1 to 50, default `10`                 | no       | Rows to serve.                          |
| `page`            | integer, 1 to 20, default `1`                  | no       | Which page of rows.                     |
| `verify`          | `snippet`, `full` or `none`, default `snippet` | no       | How to confirm the words really appear. |
| `include_excerpt` | boolean, default `true`                        | no       | Carry the matching line with each row.  |

`verify` decides what a row is worth. `snippet` checks the excerpt the site
already returned and costs nothing. `full` fetches up to five song pages and
checks the complete words, which is slow and can bring on rate limiting. `none`
serves what the site ranked, unchecked.

**In return:** rows carrying `id`, which `get_lyrics` takes; `title`; `artist`;
`album` and `year`, `null` where the catalogue states none; `source_url`; and
`excerpt`, the matching line. `raw_result_count` is what the site returned and
`filtered_out` how many rows the check removed, so the two together say how loose
the ranking was. `has_more` and `next_page` continue.

### `search_songs`

Finds songs by title, narrowed by artist.

| Argument | Type                                 | Required | What it does                            |
| -------- | ------------------------------------ | -------- | --------------------------------------- |
| `title`  | string, 1 to 120 characters          | yes      | The song title, or part of it.          |
| `artist` | string, up to 120 characters         | no       | Keep the songs credited to this artist. |
| `limit`  | integer, 1 to 50, default `10`       | no       | Rows to serve.                          |
| `page`   | integer, 1 to 20, default `1`        | no       | Which page of rows.                     |
| `match`  | `loose` or `strict`, default `loose` | no       | How closely the artist has to match.    |

**In return:** the rows `search_lyrics` returns, with `artist_filter` echoing
what was asked for and `filtered_out` counting what the artist restriction
removed. `strict` keeps the artists whose name matches as written; `loose`
accepts a name written differently.

### `get_lyrics`

Reads the words of one song. Long lyrics are served a slice at a time.

| Argument    | Type                                  | Required   | What it does                              |
| ----------- | ------------------------------------- | ---------- | ----------------------------------------- |
| `id`        | string                                | one of two | The song id a search row carries.         |
| `url`       | a lyrics.com URL                      | one of two | The address of the song page.             |
| `max_chars` | integer, 200 to 20000, default `6000` | no         | Characters of text to serve in this call. |
| `offset`    | integer, 0 or more, default `0`       | no         | Character offset to resume from.          |
| `highlight` | string, up to 120 characters          | no         | Words to locate inside the text.          |

**In return:** `status`, reading `ok` or `no_lyrics` for a page the site holds
without words; `title`, `artist` and `source_url`; and `lyrics`, the slice
itself. The reading is described by `total_chars`, `returned_chars`, `offset`,
`next_offset` and `truncated`: pass `next_offset` back to read on, and `null`
there means the end. `line_count` counts the lines of the slice, and `highlight`
answers for each word whether it was `found` and on which `line_number`, which is
`null` when it was not.

## Configuration

Every variable is optional. Set them in the `env` block of your client config.

| Variable                      | Default              | What it does                                                                       |
| ----------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `LYRICSCOM_USER_AGENT`        | the project identity | Names your application to the site, with an address where a person can be reached. |
| `LYRICSCOM_MIN_INTERVAL_MS`   | `1100`               | Gap between two requests, from 500 to 60000.                                       |
| `LYRICSCOM_TIMEOUT_MS`        | `15000`              | Deadline for one request, from 1000 to 120000.                                     |
| `LYRICSCOM_MAX_RETRIES`       | `3`                  | Attempts after a transient failure, from 0 to 10.                                  |
| `LYRICSCOM_CACHE_TTL_MS`      | `900000`             | How long an answer stays in memory, from 0 to 86400000.                            |
| `LYRICSCOM_CACHE_MAX_ENTRIES` | `200`                | Answers held in memory at once, from 0 to 10000.                                   |
| `LYRICSCOM_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` or `debug`, written to stderr.                           |

A value outside its range falls back to the default, and the reason is written to
stderr.

**On the User-Agent.** This server names the project and links to its repository,
and the site serves that. It does refuse some generic tool agents outright: a
plain `curl` gets a 403. A `blocked_user_agent` error means the identity was
refused, and `LYRICSCOM_USER_AGENT` lets you set one of your choosing. What you
put there is your call and your responsibility.

## Errors

Every failure carries one of these codes, a message, and where it helps a hint
naming the next move.

| Code                 | What happened                                           | What to do                                                                          |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `not_found`          | The site answered, and holds no such song.              | Check the id with `search_songs`.                                                   |
| `invalid_input`      | The arguments were refused before any request went out. | Read the message, which names the argument.                                         |
| `throttled`          | The site asked this client to slow down.                | Wait, then call again with the same arguments. The song is still there.             |
| `blocked_user_agent` | The site refused the identity this client sent.         | Set `LYRICSCOM_USER_AGENT`.                                                         |
| `parse_failure`      | The page loaded and the expected content was absent.    | Report it at [the issue tracker](https://github.com/smeet666/mcp-lyricscom/issues). |
| `network_error`      | The request did not complete.                           | Try again shortly.                                                                  |
| `timeout`            | The request passed its deadline.                        | Raise `LYRICSCOM_TIMEOUT_MS`, or ask for a smaller `max_chars`.                     |

`throttled` and `blocked_user_agent` are this server's two names for a refusal to
serve, and a caller reading several sources normalises them onto whatever it
calls rate limiting.

## As a library

The layer reading the site is published on its own, with its pacing, its cache
and its errors, and with no protocol attached.

```ts
import { LyricsComClient } from "mcp-lyricscom/client";

const client = new LyricsComClient();
const { data, cached } = await client.getSong({ id: "1234567" });
console.log(data.title, data.artist, cached);
```

`search` and `getSong` each answer `{ data, cached }`, and throw an error
carrying one of the codes above. The floor between two requests holds here as
well.

## Pacing and attribution

Requests go out one at a time with at least a second between them, and the floor
of half a second holds however the server is configured. A `verify: "full"`
search fetches up to five song pages, which is the most expensive thing this
server does.

Every result carries the artist, the title and the address of the song page. Song
lyrics are the work of their authors and publishers. This project claims no
rights over them, ships no database of them, and writes nothing to disk.

This MCP server is an unofficial project, with no affiliation to lyrics.com.

## Privacy

This server collects nothing about you and sends nothing to its author. It runs
on your machine, contacts `www.lyrics.com` and nothing else, holds its answers in memory
while it runs, and writes nothing to disk.
[PRIVACY.md](PRIVACY.md) states what a request carries and which settings change
any of it.

## Development

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Tests run against generated fixtures and make no network request. The live suite,
`npm run test:live`, makes one request per route and runs nightly against the
site itself.

## Contributing

Bugs, questions and ideas belong in
[the issue tracker](https://github.com/smeet666/mcp-lyricscom/issues). Pull
requests are welcome; opening an issue first helps agree on the shape of the
change. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The lyrics belong to their authors and publishers.

---

<a name="mcp-lyricscom-français"></a>

# mcp-lyricscom (français)

_[English version](#mcp-lyricscom)_

[lyrics.com](https://www.lyrics.com) est un grand catalogue public de paroles de
chansons. Il classe une chanson sous son titre, son artiste, l'album où elle a
paru et l'année, et il contient les paroles elles-mêmes. Sa recherche va à
l'intérieur de ces paroles.

Ce serveur relie un client de conversation à ce catalogue. On peut y chercher une
chanson par un vers dont on se souvient, chercher par titre et par artiste, et
lire les paroles d'une chanson par tranches, avec les mots cherchés localisés
dans le texte. Aucune clé d'API, aucun compte.

## Installation

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=lyricscom&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC1seXJpY3Njb20iXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=lyricscom&config=%7B%22name%22%3A%22lyricscom%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-lyricscom%22%5D%7D)

**Claude Code**

```bash
claude mcp add lyricscom -- npx -y mcp-lyricscom
```

**Claude Desktop, Cursor, et tout client au format de configuration standard**

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

Node 24 ou plus récent est nécessaire, et aucune variable d'environnement n'est à
renseigner.

### Avec Docker

```json
{
  "mcpServers": {
    "lyricscom": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-lyricscom:2.0.0"]
    }
  }
}
```

`-i` garde l'entrée standard ouverte, qui est le canal du protocole, et `-t` est
omis parce qu'un TTY réécrit le flux. Le conteneur a besoin d'un accès HTTPS
sortant vers `www.lyrics.com`, et de rien d'autre : aucun volume, aucun port,
aucun identifiant.

### Bundle, sans npm

Téléchargez `mcp-lyricscom-2.0.0.mcpb` depuis
[la dernière publication](https://github.com/smeet666/mcp-lyricscom/releases/latest)
et ouvrez-le. Un client qui gère les bundles MCP l'installe seul, sans npm et
sans fichier de configuration à modifier. Le bundle emporte ses dépendances, donc
rien n'est téléchargé à l'installation.

## Ce qu'on peut demander

- « Quelle est la chanson qui dit "I've got a hand for you" ? »
- « Trouve-moi les paroles de Wichita Lineman par Glen Campbell. »
- « Lis-moi la seconde moitié de ces paroles. »
- « Où apparaît le mot "lineman" dans cette chanson ? »
- « Sur quels albums cette chanson figure-t-elle ? »

Le chemin ordinaire va d'une recherche à une lecture : une ligne porte un `id`,
et `get_lyrics` reprend cet identifiant.

## Les outils

| Outil           | Ce qu'il fait                                          |
| --------------- | ------------------------------------------------------ |
| `search_lyrics` | Trouve une chanson à partir d'un vers de ses paroles.  |
| `search_songs`  | Trouve des chansons par titre, resserrées par artiste. |
| `get_lyrics`    | Lit les paroles d'une chanson, par tranches.           |

### `search_lyrics`

Trouve une chanson à partir de mots contenus dans ses paroles. Le site classe
largement, donc une correspondance est vérifiée avant d'être servie.

| Argument          | Type                                          | Requis | Ce qu'il fait                                  |
| ----------------- | --------------------------------------------- | ------ | ---------------------------------------------- |
| `query`           | chaîne, 1 à 120 caractères                    | oui    | Le vers, ou une partie, à chercher.            |
| `limit`           | entier, 1 à 50, défaut `10`                   | non    | Lignes à servir.                               |
| `page`            | entier, 1 à 20, défaut `1`                    | non    | Quelle page de lignes.                         |
| `verify`          | `snippet`, `full` ou `none`, défaut `snippet` | non    | Comment confirmer que les mots y figurent.     |
| `include_excerpt` | booléen, défaut `true`                        | non    | Porter le vers correspondant sur chaque ligne. |

`verify` décide de ce que vaut une ligne. `snippet` vérifie l'extrait que le site
a déjà rendu et ne coûte rien. `full` va chercher jusqu'à cinq pages de chansons
et vérifie les paroles entières, ce qui est lent et peut déclencher une
limitation. `none` sert ce que le site a classé, sans vérification.

**En retour :** des lignes portant `id`, que `get_lyrics` reprend ; `title` ;
`artist` ; `album` et `year`, `null` là où le catalogue n'indique rien ;
`source_url` ; et `excerpt`, le vers correspondant. `raw_result_count` est ce que
le site a rendu et `filtered_out` le nombre de lignes que la vérification a
retirées, si bien que les deux ensemble disent à quel point le classement était
large. `has_more` et `next_page` poursuivent.

### `search_songs`

Trouve des chansons par titre, resserrées par artiste.

| Argument | Type                                | Requis | Ce qu'il fait                                  |
| -------- | ----------------------------------- | ------ | ---------------------------------------------- |
| `title`  | chaîne, 1 à 120 caractères          | oui    | Le titre de la chanson, ou une partie.         |
| `artist` | chaîne, jusqu'à 120 caractères      | non    | Ne garder que les chansons de cet artiste.     |
| `limit`  | entier, 1 à 50, défaut `10`         | non    | Lignes à servir.                               |
| `page`   | entier, 1 à 20, défaut `1`          | non    | Quelle page de lignes.                         |
| `match`  | `loose` ou `strict`, défaut `loose` | non    | La rigueur de la correspondance sur l'artiste. |

**En retour :** les lignes que rend `search_lyrics`, avec `artist_filter` qui
redonne ce qui a été demandé et `filtered_out` qui compte ce que la restriction
sur l'artiste a retiré. `strict` garde les artistes dont le nom correspond tel
qu'écrit ; `loose` accepte un nom écrit autrement.

### `get_lyrics`

Lit les paroles d'une chanson. Des paroles longues sont servies par tranches.

| Argument    | Type                               | Requis        | Ce qu'il fait                                |
| ----------- | ---------------------------------- | ------------- | -------------------------------------------- |
| `id`        | chaîne                             | l'un des deux | L'identifiant que porte une ligne.           |
| `url`       | une adresse lyrics.com             | l'un des deux | L'adresse de la page de la chanson.          |
| `max_chars` | entier, 200 à 20000, défaut `6000` | non           | Caractères de texte à servir dans cet appel. |
| `offset`    | entier, 0 ou plus, défaut `0`      | non           | Position en caractères où reprendre.         |
| `highlight` | chaîne, jusqu'à 120 caractères     | non           | Des mots à localiser dans le texte.          |

**En retour :** `status`, valant `ok` ou `no_lyrics` pour une page que le site
contient sans paroles ; `title`, `artist` et `source_url` ; et `lyrics`, la
tranche elle-même. La lecture est décrite par `total_chars`, `returned_chars`,
`offset`, `next_offset` et `truncated` : redonnez `next_offset` pour poursuivre,
et `null` marque la fin. `line_count` compte les lignes de la tranche, et
`highlight` répond pour chaque mot s'il a été `found` et à quel `line_number`,
`null` quand il ne l'a pas été.

## Configuration

Chaque variable est facultative. Elles se posent dans le bloc `env` de la
configuration du client.

| Variable                      | Défaut               | Ce qu'elle fait                                                                   |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `LYRICSCOM_USER_AGENT`        | l'identité du projet | Nomme votre application auprès du site, avec une adresse où joindre une personne. |
| `LYRICSCOM_MIN_INTERVAL_MS`   | `1100`               | Écart entre deux requêtes, de 500 à 60000.                                        |
| `LYRICSCOM_TIMEOUT_MS`        | `15000`              | Délai d'une requête, de 1000 à 120000.                                            |
| `LYRICSCOM_MAX_RETRIES`       | `3`                  | Tentatives après un échec passager, de 0 à 10.                                    |
| `LYRICSCOM_CACHE_TTL_MS`      | `900000`             | Durée pendant laquelle une réponse reste en mémoire, de 0 à 86400000.             |
| `LYRICSCOM_CACHE_MAX_ENTRIES` | `200`                | Réponses gardées en mémoire à la fois, de 0 à 10000.                              |
| `LYRICSCOM_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` ou `debug`, écrit sur la sortie d'erreur.               |

Une valeur hors de sa plage retombe sur le défaut, et la raison est écrite sur la
sortie d'erreur.

**À propos du User-Agent.** Ce serveur nomme le projet et renvoie vers son dépôt,
et le site le sert. Il refuse en revanche certains agents d'outils génériques :
un `curl` nu reçoit un 403. Une erreur `blocked_user_agent` signifie que
l'identité envoyée a été refusée, et `LYRICSCOM_USER_AGENT` permet d'en poser une
de votre choix. Ce que vous y mettez relève de votre décision et de votre
responsabilité.

## Erreurs

Chaque échec porte un de ces codes, un message, et quand cela aide une indication
du geste suivant.

| Code                 | Ce qui s'est passé                                 | Que faire                                                                                 |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `not_found`          | Le site a répondu, et n'a pas cette chanson.       | Vérifiez l'identifiant avec `search_songs`.                                               |
| `invalid_input`      | Les arguments ont été refusés avant toute requête. | Lisez le message, qui nomme l'argument.                                                   |
| `throttled`          | Le site demande à ce client de ralentir.           | Attendez, puis rappelez avec les mêmes arguments. La chanson est toujours là.             |
| `blocked_user_agent` | Le site a refusé l'identité envoyée par ce client. | Posez `LYRICSCOM_USER_AGENT`.                                                             |
| `parse_failure`      | La page a chargé et le contenu attendu est absent. | Signalez-le sur [le suivi d'incidents](https://github.com/smeet666/mcp-lyricscom/issues). |
| `network_error`      | La requête n'a pas abouti.                         | Réessayez sous peu.                                                                       |
| `timeout`            | La requête a dépassé son délai.                    | Augmentez `LYRICSCOM_TIMEOUT_MS`, ou demandez un `max_chars` plus petit.                  |

`throttled` et `blocked_user_agent` sont les deux noms que ce serveur donne à un
refus de servir, et un appelant qui lit plusieurs sources les ramène sur ce qu'il
appelle une limitation de débit.

## Comme bibliothèque

La couche qui lit le site est publiée seule, avec son rythme, son cache et ses
erreurs, sans protocole attaché.

```ts
import { LyricsComClient } from "mcp-lyricscom/client";

const client = new LyricsComClient();
const { data, cached } = await client.getSong({ id: "1234567" });
console.log(data.title, data.artist, cached);
```

`search` et `getSong` répondent chacun `{ data, cached }`, et lèvent une erreur
portant un des codes ci-dessus. Le plancher entre deux requêtes tient également
ici.

## Rythme et attribution

Les requêtes partent une à une avec au moins une seconde entre elles, et le
plancher d'une demi-seconde tient quelle que soit la configuration. Une recherche
en `verify: "full"` va chercher jusqu'à cinq pages de chansons, ce qui est la
chose la plus coûteuse que fait ce serveur.

Chaque résultat porte l'artiste, le titre et l'adresse de la page de la chanson.
Les paroles sont l'œuvre de leurs auteurs et de leurs éditeurs. Ce projet ne
revendique aucun droit dessus, n'embarque aucune base de paroles et n'écrit rien
sur le disque.

Ce MCP est un projet non officiel, sans affiliation à lyrics.com.

## Confidentialité

Ce serveur ne collecte rien sur vous et n'envoie rien à son auteur. Il tourne sur
votre machine, ne joint que `www.lyrics.com`, garde ses réponses en mémoire le temps qu'il
tourne, et n'écrit rien sur le disque. [PRIVACY.md](PRIVACY.md) dit ce qu'une
requête emporte et quels réglages changent cela.

## Développement

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Les tests s'exécutent sur des fixtures engendrées et n'émettent aucune requête.
La suite en direct, `npm run test:live`, émet une requête par route et tourne
chaque nuit contre le site lui-même.

## Contribuer

Les anomalies, les questions et les idées ont leur place dans
[le suivi d'incidents](https://github.com/smeet666/mcp-lyricscom/issues). Les
propositions de modification sont bienvenues ; ouvrir un ticket d'abord aide à
s'accorder sur la forme du changement. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT, voir [LICENSE](LICENSE). Les paroles appartiennent à leurs auteurs et à
leurs éditeurs.
