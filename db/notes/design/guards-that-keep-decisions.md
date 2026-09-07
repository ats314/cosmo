# How Cosmo stops its own decisions from rotting

**What this answers:** the meta-decisions about enforcement — which guards exist,
what each was bought with, and the recurring failure shapes they encode.

This repository's distinctive habit is that a design decision is not considered
landed until something fails the build when it is undone. The patterns below
recur; a new guard should be built out of them rather than invented.

## 1. Derive the list, never write it down

The failure shape: *a guard whose scope is a hard-coded list stops covering the
thing it guards the moment somebody reorganises.*

- **`tools/all.mjs` holds no list of harnesses.** It reads
  `.github/workflows/pages.yml` and runs exactly the `node tools/*.mjs` steps CI
  runs, in CI's order. A second copy is the thing that rots — the local runner
  drifting from the build is precisely the bug where "all checks passed locally"
  and the PR goes red anyway.
- **`check.mjs` proves the complement**: every `.mjs` in `tools/` is wired into
  the workflow, and every workflow step exists in `tools/`. Together, a harness
  cannot be in the tree without running in CI, and cannot run in CI without
  running locally.
- **The missing-element guard scans for `getElementById` lookups** rather than
  listing ids. It was the literal `['c','safe']` and the game had grown `#bg`;
  renaming that canvas took the starfield away from every visitor with **no build
  failure and no runtime error**, because `glInit` swallows its own failure and
  falls back to the 2D sky (check.mjs:23-43).
- **The doc-staleness guard walks `docs/`** instead of naming five files. When
  README.md was broken up into `docs/design/` and `docs/engine/`, every constant
  those 2,300 lines discussed moved into files the guard had never heard of
  (check.mjs:543-559).
- **`T_VOICE` and `T_SKY` are `TIERS.findIndex(...)`**, not ordinals — inserting
  DIVERS and THE NARROWS moved THE EYE from index 10 to 12 and silently re-timed
  every `G.tier>=10` in the file (runtime.js:4714-4734).
- **`netlify/build.mjs` reads the `cp … _site/` line out of the Pages workflow**
  rather than restating it. A second copy of an allowlist fails *silently on
  whichever host got missed*: an internal document becomes a public URL on one
  host and not the other.

## 2. Assert the absence, not the synchronisation

The magnetar's detached glow was fixed twice and came back both times, because the
guard policed *keeping two radii in sync* and could only inspect the loops it
recognised. It now fails the build if a second radius **exists at all**
(check.mjs:108-141): `radiusOf(ring)` is the only radius an ember or an orb has,
so there is nothing to keep in sync and nothing for a draw pass to disagree about.

*A guard that covers the cases you thought of is not a guard against the mistake
you keep making.*

## 3. A guard that cannot fail is worse than no guard

- **`rendercheck.mjs` skips when no browser is present**, which is right locally
  and fatal in CI. `check.mjs` fails if the workflow runs rendercheck without a
  Playwright install step, because it would report SKIP and success forever and
  silently remove the only check in the repo that looks at a pixel
  (check.mjs:453-464).
- **`--fast` must select something.** `all.mjs` fails if the fast lane is empty,
  because a runner that silently runs nothing reports success.
- **Zero parsed rows is a hard failure.** `MODES` with one row is the shipped
  state; zero rows is a parse failure that would silently disarm every guard below
  it (check.mjs:177-180). The same floor guards the harness-step parse, the UPG id
  collector, the ledger-name collector and the doc walk.
- **A harness that seeds its RNG must print the seed.** `curriculum`, `dropcheck`,
  `fxcheck` and `musiccheck` all *imported* `seedLine` and never called it, for
  four sessions, while `CLAUDE.md` and `harnesses.md` both stated the opposite.
  The claim was prose; nothing executed it (check.mjs:390-402).
- **`docs/harnesses.md` naming every harness was documented as enforced and was
  not.** Its own words: "Adding a harness is three edits, and `check.mjs` fails
  until all three are made." Only two were enforced. It had already failed:
  `rendercheck.mjs` — the only harness that looks at a pixel — was absent from
  both lists while both documents asserted that `fxcheck.mjs` was "the only
  harness that runs the render path". A session with a detached halo to test would
  have filed its test in the harness that stubs the canvas and proved nothing,
  **with all eight checks green** (check.mjs:404-433).

## 4. Mutation-test the guard itself

Two blind spots in the upgrade-wiring guard were found by deliberately breaking
things (check.mjs:80-95):

- It collected ids with `/\{id:'(\w+)',n:'/`, requiring `id` before `n`. A row
  written `{n:'…',id:'…'}` was invisible, and the `length < 2` floor was cleared by
  the rows that did match.
- The call-site test ran against the raw script, so the literal characters
  `upgOn('deepbank')` **surviving inside a block comment** satisfied it. Deleting
  the wiring while mentioning it in the comment explaining the deletion — the most
  natural edit in the world — left DEEP BANK offered, picked and recorded in
  telemetry while doing nothing.

The general fix: strip comments before testing for a call site (`CODE` in
check.mjs:96-98), or match on an operator so prose cannot satisfy the test.

Eight mutations were run against the backdrop guards — a world that blacks out,
one that floods, the spin sign inverted, the gate floor bypassed, weights that
stop summing to 1, a uniform looked up but never written, and both halves of the
y-flip dropped — and all eight fail the build.

## 5. Staleness, not agreement

The doc-value guard checks that **if a document discusses a constant at all, that
constant's current value appears in the paragraph the name appears in**
(check.mjs:520-601). It deliberately does not demand agreement: these documents are
historical and say things like *"1.0 was the first pass and read as distracting"*,
*"0.42 was the retreat"*. A guard that fires on correct prose gets deleted within a
week. **History may stay; ignorance may not.**

Two refinements were bought by false failures: the comparison is **numeric**, not
textual (README's "read 17.0" failed for `BH_DUR=17`), and the window is **the
paragraph the name appears in**, not the whole file (README discusses both
`GL_MOTION` and `SKY_ARENA_CALM`, so changing one would have been waved through by
the other's value three hundred lines away).

## 6. The ledger check runs one way on purpose

Every mechanic the code ships must appear in `MECHANICS.md`. The reverse direction
would have to decide which of the ledger's rows are supposed to name a code
symbol, and a guard that guesses produces false failures, **which is how a guard
gets deleted**. Matching is case-insensitive and a substring test, because this
asks whether the ledger *knows about* the mechanic, and anything stricter would
break every time someone rewords a row (check.mjs:288-341).

Three documents disagreed with the code at once before this existed, each found by
a reader who trusted the prose: `CLAUDE.md` said "five checks" while saying six
everywhere else, and both it and README said tiers complete at level 2's finish
line while the code beside them read level 3's.

## 7. The lab tripwire covers what the runtime test cannot reach

`smoke.mjs` proves the powerup lab writes nothing by clearing `localStorage` and
failing on any key that reappears — the real enforcement. But it can only catch
writes on paths it reaches, and `tryLand()` and `judgeTiming()` both return
immediately without `AC`/`MU`, which `smoke` removes on purpose to prove the audio
guards. So `check.mjs` carries a **static list of persisted keys** and fails when a
new one appears: it cannot tell whether a write is guarded, but it can insist
nobody adds one without being asked the question (check.mjs:209-249). Three of the
four writes the lab originally leaked — `hopped`, `groove`, `landed` — were found
this way after the fact.

`persistedKnown` is `['intro','groove','hopped','muted','runs','seen','seen2',
'struggle','swipe']`, and the comparison is a **floor**: removing a key from the
list is as much a decision as adding one.

## 8. Compare against a cleared store, not a populated one

`docs/harnesses.md`: "Comparing an already populated store missed writes that
simply rewrote existing values; the protected contract is that a lab cannot create
a persistent record."

## 9. Inject a synthetic version of the thing nobody ships

`smoke.mjs` injects a synthetic difficulty mode with every knob off neutral and
measures every curve through the real functions at the same difficulty second — so
a table of multipliers wired to nothing cannot pass. Deleting that test along with
CHILL would have meant discovering the plumbing was dead on the day someone added
a row: **the worst possible day.**

## 10. Stop at the first failure

`all.mjs` exits on the first non-zero harness. The harnesses are not independent —
`smoke`, `dropcheck` and `curriculum` all drive the same front screens, so one
broken screen fails all three with the same message three times over and only the
first report is informative.
