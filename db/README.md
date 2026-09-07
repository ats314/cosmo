# The Cosmo knowledge database

A searchable index of how this game is built and why, written for agent
sessions that pay tokens per line. It exists because the honest answer to "what
do I need to know before changing the audio scheduler?" used to be *read a
12,272-line runtime file and 2,300 lines of design prose*, and almost every
session paid that cost again from zero.

This is not a second copy of the documentation. `docs/` is the authored record —
the reasoning, in prose, meant to be read by a person. This is the **index over
it**: small records that say what a thing is, exactly where it lives, which
document governs it, and which harness proves it still works. Records point at
sources. They do not replace them.

**Before you rely on any of it, read [`STATUS.md`](STATUS.md).** It says which
parts are finished, which are half-built, and what is known to be missing —
including an open question about the music scheduler that the Godot rebuild
depends on and that nobody has answered yet.

## Use it like this

```sh
node db/query.mjs search starfall
node db/query.mjs get content.orb.starfall
node db/query.mjs list --kind opportunity --area audio
```

**Do not open the collections directly.** `db/records/*.jsonl` holds hundreds of
records; reading one to find one fact is the exact cost this database was built
to remove. Search returns one line per hit — id and summary — and `get` returns
the single record you actually wanted, with its neighbours listed.

The whole command surface:

| Command | Answers |
|---|---|
| `search <terms…>` | "What do we know about X?" Ranked; every term must appear. |
| `get <id>` | "Tell me everything about this one thing", plus what links to it. |
| `list --kind K` | "What orbs / levels / invariants / opportunities exist?" |
| `links <id>` | "What else do I have to read before touching this?" |
| `uncovered` | "Which load-bearing rules does no harness actually assert?" |
| `notes <term>` | Full-text over the long-form notes. |
| `tags` | The retrieval vocabulary, when you do not know the word to search for. |

Filters: `--kind --tag --area --status --collection --confidence`. Add `--full`
for whole records, `--limit N` to widen.

## What is in it

| Path | What it holds |
|---|---|
| `INDEX.md` | Generated table of contents and counts. Start here to see the shape. |
| `ONTOLOGY.md` | The record contract. Binding on anything that writes a record. |
| `records/*.jsonl` | The built collections. One record per line. Generated — never edit. |
| `records/parts/*.jsonl` | The **sources of truth you edit**, one part per subsystem. |
| `notes/` | Long-form prose that does not fit a record. Records link to it. |
| `sources/` | Extracted text of ingested external documents. |
| `index.json` | Build manifest: counts, source fingerprints, the uncovered set. |

## Two fields decide how much to trust a record

`confidence` is `verified` (an agent read that exact line) or `inferred`
(reasoned from surrounding evidence — `query.mjs` marks these with a trailing
`~`). `status` is `current`, `retired`, or `proposed`. **Retired records are kept
on purpose**: this project's documents deliberately preserve the approaches that
were tried and rejected, because the rejected version is what a later session
would otherwise cheerfully re-propose.

Nothing here outranks the source. If a record and `src/game/runtime.js` disagree,
the source is right and the record is a bug — fix the part and rebuild.

## Changing it

```sh
node db/build.mjs            # merge parts → collections, validate, regenerate INDEX.md
node db/build.mjs --verify   # is the database still built against the current sources?
```

Edit a file under `records/parts/`, then rebuild. `build.mjs` refuses to write
anything if a record breaks the contract, an id collides, or — the check that
matters most — **an anchor points past the end of the file it names**. A record
that sends you to the wrong line in a twelve-thousand-line file is worse than a
missing one: the missing record sends you looking, the wrong one sends you
somewhere else and lets you conclude the thing is not there.

`--verify` compares hashes of the files this database describes against the ones
it was built from. It fails when they have moved, which is the moment the
numbers in these records stop being true.

Deliberately not a harness. `tools/check.mjs` fails on any `tools/*.mjs` that CI
does not run, and these are generators, not checks — which is why they live here
and not in `tools/`.

## Binary documents never enter this database

A PDF cannot be grepped, cannot be line-anchored, and cannot be read without
spending tokens on all of it to find one paragraph — and every later session
pays that again. So anything that arrives as a PDF, Word, or PowerPoint file is
extracted to text **once**, on the way in, and only the text is ever cited:

```sh
node db/ingest.mjs paper.pdf --id source.arcade-pacing --title "…" --note "why it is here"
node db/build.mjs
```

It writes `db/sources/<slug>.txt` with a provenance header and appends a `source`
record. No dependencies — it uses `pdftotext` when installed and falls back to
its own content-stream extractor. It refuses to write an empty extraction: a
scanned PDF has no text layer, and an empty source record would read as "this
document says nothing" forever.

## What this database is honest about

The most valuable thing in here is not the map of what exists. It is
`node db/query.mjs uncovered` — the invariants that `docs/invariants.md` calls
load-bearing and that no harness actually asserts. Every one of those rules was
written because something shipped broken. Where nothing checks them, they hold
only as long as everyone remembers.
