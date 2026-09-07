# Where this database actually stands

Written at the end of the session that created it, so the next session does not
have to infer completeness from file listings. **Read this before trusting any
part of the database.** It is deliberately blunt about what is unfinished.

## What is finished and reliable

The **tooling** works and is tested: `build.mjs` validates and merges,
`query.mjs` reads, `ingest.mjs` extracts binary documents to text. Every record
in the built collections has passed schema validation, id-uniqueness and — the
check that matters — anchor verification against the real line count of the real
file it names.

The **extraction of the existing Phaser game** is substantially complete: the
runtime code map, the tuned constants, the levels and formations, the orbs, the
teaching curriculum, the invariants with their harness coverage, and the
delivery/native/cloud stack. This is the material the Godot rebuild specifies
itself from, and it is the most trustworthy thing here.

The **coverage analysis** is complete and is the single most actionable output:

```sh
node db/query.mjs uncovered
```

Twenty coverage records report a gap between what `docs/invariants.md` calls
load-bearing and what the eight harnesses actually assert. Several of those
rules exist because a bug shipped more than once. They matter more during a
rebuild, not less.

## What is unfinished, and exactly how

### 1. The Godot handbook is seven documents of ten, and unreconciled

Present in `notes/godot/`: `gdscript-mastery`, `performance-engineering`,
`project-structure`, `rendering-and-shaders`, `resources-data-design`,
`threading-and-loading`, `tooling-and-testing`.

**Missing entirely** — and the first of these is the most important document in
the whole handbook, because it is the project's hardest technical requirement:

- `audio-scheduling` — sample-accurate music scheduling in Godot. Cosmo's music
  is a lookahead scheduler queueing individual notes, six keys, layers that
  unlock, and a drop that must land on the beat the player earned. Whether Godot
  can hold that timing is the open question the rebuild rests on. **Nobody has
  answered it yet. Do not assume it is fine.**
- `architecture-patterns` — the node/scene/ownership design.
- `input-and-mobile` — touch, portrait, lifecycle, haptics.

### 2. THE DOCUMENTS DISAGREE ABOUT WHICH GODOT VERSION THEY TARGET

| Document | Version cited |
|---|---|
| `gdscript-mastery` | 4.7.2 |
| `rendering-and-shaders` | 4.7.2 |
| `performance-engineering` | 4.7 |
| `project-structure` | 4.7 |
| `tooling-and-testing` | 4.7 |
| `resources-data-design` | 4.4 |
| `threading-and-loading` | 4.3 |

These were written by independent agents and reconciling them was the synthesis
pass's job, which did not run. **Establish the actual current stable release
first, then re-check every version-gated claim against it.** A technique that is
real in one release and absent in another is the expensive kind of wrong, and an
API that exists in no release at all is worse.

### 3. Three documents were never fact-checked

`performance-engineering`, `rendering-and-shaders` and `resources-data-design`
were written but stopped before the verification stage that hunts invented APIs,
Godot 3 idiom presented as current, and uncited performance claims. They have no
part file, so their contents are **not in the searchable index**.

Treat their API names and especially their performance claims as unverified.
The other four were indexed; whether each completed verification is not recorded
per-document, so a spot-check is cheap insurance.

### 4. Portability is classified on 586 of 854 records

`portability` says what survives the move off Phaser. Records written after the
Godot decision carry it; the earlier extraction parts do not.

**The most consequential gap: all 110 records in `code-tunables.jsonl` are
unclassified.** Those are the constants — the playtested numbers a rebuild most
easily loses. `node db/query.mjs list --portability tuning` currently returns 17
records when it should return most of that file. Until that pass runs, do not
treat that list as the set of numbers to carry across.

### 5. The design-improvement research never ran

Game feel, teaching, progression, readability and retention were scoped and not
executed. `opportunities` holds 42 records, but they came from the Godot
technique work, not from a design pass.

## Finishing it

The workflow scripts are in the session scratchpad, or rewrite them from this
list. In rough priority:

1. Write `audio-scheduling`. It is the highest-risk unknown in the rebuild.
2. Settle the Godot version, then reconcile all seven documents against it.
3. Verify and index the three unchecked documents.
4. Classify portability on the pre-decision parts, `code-tunables.jsonl` first.
5. Write `architecture-patterns` and `input-and-mobile`.
6. Run the design-improvement research.

After any change to a part file:

```sh
node db/build.mjs            # validate and rebuild the collections
node db/build.mjs --verify   # confirm it still matches the sources it describes
```

## One honest caveat about the whole thing

Every record here was written by reading this repository, and each was checked
by a second pass — but a database assembled this way will still contain
confident mistakes. `confidence: "inferred"` marks what was reasoned rather than
read, and `query.mjs` prints those with a trailing `~`. The source always wins.
When a record and the code disagree, the record is the bug.
