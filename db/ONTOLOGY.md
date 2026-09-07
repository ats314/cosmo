# The record contract

Everything in `db/records/` is JSON Lines: one record per line, one line per
record, no wrapping array. That format is the point. An agent that wants one
fact runs `grep` and gets back exactly one complete record — not a file it must
parse, not a fragment it must reassemble. Whole-file reads are the thing this
database exists to make unnecessary.

Long prose does not go in a record. It goes in `db/notes/<area>/<slug>.md` and
the record points at it with `note`. A record is the index card; the note is the
page. An agent reads cards until it knows which page it needs.

## The shared fields

Every record in every collection carries these.

| Field | Required | What it is |
|---|---|---|
| `id` | yes | Stable dotted identifier, unique across the whole database. Lowercase; segments are kebab-case. This is the address other records link to, so renaming one is a breaking change. |
| `kind` | yes | One of the kinds below. Determines which extra fields are required. |
| `name` | yes | What the thing is called in the source — the identifier, the ledger row name, the on-screen name. |
| `summary` | yes | One sentence, at most 200 characters, no trailing prose. This is the field a search result prints, so it must answer the question on its own. |
| `tags` | yes | Lowercase keywords for retrieval. Include the subsystem (`audio`, `render`, `input`, `sim`, `ui`, `storage`, `native`, `cloud`) and any player-facing noun. |
| `status` | yes | `current`, `retired`, or `proposed`. Retired records are kept deliberately — the rejected attempt is what a later session would otherwise re-propose. |
| `provenance` | yes | `generated` (a script re-derives it from source), `extracted` (an agent read the source and wrote it down), or `authored` (a judgement written by a human or an agent). |
| `confidence` | yes | `verified` (read directly in the cited source), or `inferred` (reasoned from surrounding evidence). Never label a guess `verified`. |
| `portability` | see below | What survives the move off Phaser. Required on every record written after the Godot decision. |

## Portability: what survives the engine change

Cosmo is moving to Godot 4 with GDScript, and the plan is a **rebuild from the
design record** rather than a line-by-line port. That makes this field the most
consequential one in the schema, because it is what separates the knowledge the
rebuild must carry forward from the knowledge it is allowed to throw away.

| `portability` | Meaning | What a rebuild does with it |
|---|---|---|
| `spec` | Engine-neutral behaviour. What the game *is*: a mechanic, a level, a lesson's wording, a musical structure, a rule the player can feel. | Reproduce it, or change it deliberately and write down why. |
| `tuning` | A number that was arrived at by playtesting rather than derivation. | **Carry the value across.** These are the expensive ones. |
| `reference` | How the Phaser/JavaScript implementation did it. | Read it to understand the problem, then solve it in Godot idiom. Do not transliterate. |
| `obsolete` | Bound to the retired stack — Vite, Capacitor packaging, the VM harness plumbing, DOM specifics. | Nothing. Kept only so a later session does not go looking for it. |

The distinction that matters most is `tuning` versus `reference`. `MASTER = 2.15`
is a measured makeup gain — the comment in source says 2.6 was tried and was
wrong — and that number is worth exactly as much in Godot as it is in WebAudio.
The function that applies it is `reference`. Losing the first while dutifully
porting the second is the specific way a rebuild ends up feeling worse than the
thing it replaced, with nobody able to say why.

When a record carries both — a tuned constant that only exists because of a
WebAudio quirk — mark it `tuning` and say in `detail` what it was compensating
for, so the rebuild can tell whether the compensation is still needed.

## The optional fields, and when they are not optional

| Field | Use it when | Shape |
|---|---|---|
| `detail` | The summary needs two to five more sentences. | String. Still short. If it wants to be longer, it is a note. |
| `anchors` | The record describes something that exists in a file. **Required for every `kind` that names code.** | `["src/game/runtime.js:755-857"]` — path, colon, line or line range. |
| `docs` | Authored prose governs the thing. | `["docs/design/audio.md"]` |
| `checks` | A harness asserts the behaviour. | `["tools/musiccheck.mjs"]` |
| `values` | The record carries live numbers from source. | `{"MASTER": 2.15}` — copied exactly, never rounded. |
| `links` | Another record is the next thing to read. | Array of `id`s. Link generously; a dangling link is a gap worth recording, not an error. |
| `note` | Long-form exists. | `"db/notes/audio/bus.md"` |

## The kinds

| `kind` | Namespace | Also required | Covers |
|---|---|---|---|
| `system` | `code.` | `anchors` | A coherent region of the runtime: the bus, the scheduler, the collision pass, the GPU chain. |
| `symbol` | `code.` | `anchors` | A single function or table worth addressing by name. |
| `tunable` | `tune.` | `anchors`, `values` | A named constant, its current value, and what moving it does. |
| `boundary` | `code.` | `anchors` | A place where ownership changes hands — host to runtime, scene to GPU, DOM to Phaser. |
| `level` | `content.level.` | — | An authored level: its window, its world, what it teaches. |
| `mechanic` | `content.mechanic.` | `docs` | A player-facing mechanic with a ledger row. |
| `orb` | `content.orb.` | — | A powerup orb, its effect, its guarantee and its home level. |
| `upgrade` | `content.upgrade.` | — | A lab upgrade tile. |
| `formation` | `content.formation.` | — | A hazard shape and the tier that introduces it. |
| `lesson` | `content.lesson.` | — | A teaching card, coach line, or introduction beat. |
| `invariant` | `rule.` | `docs` | One load-bearing rule from `docs/invariants.md`, in its own record. |
| `coverage` | `check.` | `checks` | The claim that a named harness asserts a named invariant — or the claim that nothing does. |
| `decision` | `design.` | — | Why something is the way it is, **including what was tried and rejected**. |
| `asset` | `asset.` | — | A sprite or world, its provenance and where the game uses it. |
| `insight` | `research.` | — | External knowledge, grounded against Cosmo's current state. Cite the source. |
| `opportunity` | `opp.` | see below | A specific, actionable improvement. |
| `source` | `source.` | — | An ingested external document and the path to its extracted text. |

## Opportunity records carry more

An improvement proposal that cannot be acted on is noise. Every `opportunity`
adds:

| Field | What it must contain |
|---|---|
| `area` | `audio`, `render`, `sim`, `teaching`, `content`, `input`, `perf`, `ux`, `accessibility`, `delivery`, or `tooling`. |
| `problem` | What is wrong or missing **in Cosmo specifically**, with evidence. Not a generic best practice. |
| `proposal` | What to do, concretely enough that a session could start. |
| `evidence` | `anchors`/`docs` pointing at the code or prose that shows the problem is real. |
| `effort` | `S` (one sitting), `M` (a focused session), `L` (a multi-session arc). |
| `risk` | What it could break, named. |
| `invariants` | `id`s of `rule.` records it would touch. Empty array means it touches none — say so explicitly rather than omitting the field. |
| `verdict` | `open`, `contradicts-direction`, or `superseded`. A proposal that fights the creative direction stays in the database marked as such, so nobody re-proposes it. |

## Rules that keep this usable

1. **A record answers a question.** If a record does not answer something an
   agent would actually ask, it is filler and costs tokens forever.
2. **Anchors are exact.** `runtime.js` is 12,272 lines. A record that points at
   the wrong place is worse than one that points nowhere, because it is trusted.
3. **Numbers are copied, never remembered.** `values` comes from reading the
   source. A stale number here would defeat the entire purpose.
4. **Never invent coverage.** If no harness asserts an invariant, the `coverage`
   record says so. That gap is one of the most valuable things this database
   holds.
5. **Retired is not deleted.** Mark it `retired` and keep why.
6. **Binary documents never enter the database.** They are extracted to text in
   `db/sources/` first, and only the text is cited. See `db/README.md`.
