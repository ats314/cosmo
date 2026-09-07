# Decisions outside the game loop: harnesses, accounts, telemetry, delivery

*What this answers: why Cosmo's checks, cloud service and release path are shaped
the way they are, and which of those decisions exist to stop a specific past
failure.*

## The harnesses are designed against each other

Nine tools, each covering a blindness the others have.

- **One game source, two test surfaces.** The canonical simulation lives in
  `src/game/runtime.js`, exported as `createCosmoRuntime(host)`.
  `tools/lib/game-source.mjs` extracts *only* the marked runtime body between
  `// @runtime-body:start` / `:end`, supplies a default host, and injects it into
  the app shell with `src/styles.css`. It requires **exactly one ordered pair**
  of markers and pads the prefix with newlines so VM stack lines stay aligned
  with the real file. **There is no second checked-in copy of the game** — a
  fixture would be a second thing to keep true.
- **Determinism is injected at the sandbox boundary**, not in the product. The
  game calls `Math.random` dozens of times and every harness handed its VM the
  real `Math`, so no two runs played the same game; `CLAUDE.md` used to record
  that as a known property with a ritual attached ("re-run several times"), and
  `smoke.mjs` failed once in ~34 runs with nothing to reproduce. Each harness
  passes in a seeded `Math` instead. **Only `random` is replaced** — `sin`,
  `cos` and `PI` must stay themselves, because the arrangement and the arena
  geometry are built out of them.
- **The seed rotates in CI and is fixed locally**, which is the point. A fixed
  seed everywhere would make the suite reproducible *and blind* — it would play
  exactly one game forever. CI passes the run number so coverage keeps moving,
  and every failure prints the seed that produced it. (Two harnesses imported
  `seedLine` and never called it, so the seed CI ran on never reached the log;
  both now print it before any assertion can exit.)
- **`tools/all.mjs` holds no list.** It reads `.github/workflows/pages.yml` and
  runs exactly the `node tools/*.mjs` steps CI runs, in CI's order, because a
  second copy of the list is the thing that rots — "all checks passed locally"
  and the PR goes red anyway. `check.mjs` closes the other half: every
  `tools/*.mjs` must declare a lane, appear in the workflow and be named in
  `docs/harnesses.md`. *Either one alone leaves the other half open.*
- **`drawcheck.mjs` exists because the 2D canvas swallows everything.** The game
  makes ~852 `ctx.` calls against ~107 `GL.` ones, and every other harness stubs
  the context as a Proxy of no-ops, so `ctx.arc(NaN, NaN, …)` is
  indistinguishable from a correct draw. A non-finite coordinate does nothing
  silently; an unparseable colour leaves `fillStyle` at its *previous* value (so
  a shape draws in the last one's colour — a styling bug that is really a NaN
  two hundred lines away); an unbalanced `save()` leaks clip, transform and
  alpha into every later frame. And a **negative radius** is the opposite trap:
  a real browser throws `IndexSizeError` where the stub returns happily. So it
  is a *recording fake* that validates arguments the way a browser would.
- **`rendercheck.mjs` is the only check that looks at a pixel.** Its blind spot
  had a body count — in one session it hid a hairline rim down every screen
  edge, every halo oscillating off its own light, two fixed white highlight
  terms burying six world palettes into three, and a shipped glow path carrying
  less than half the light of the fallback it replaced. Seven checks were green
  through all of it. It runs real Chromium with SwiftShader so `GL.on` comes up
  true. **In CI a missing browser is a failure and never a skip** — the first cut
  would have skipped the moment Playwright was unresolvable, which is exactly
  the silent non-running guard that `check.mjs`'s workflow assertion exists to
  prevent, reintroduced inside the harness it protects.
- **`musiccheck.mjs` stubs WebAudio rather than removing it**, because
  `smoke.mjs` deliberately runs with WebAudio absent to prove every audio path
  is guarded — with the consequence that `musicTick()` never turns over in CI
  and not one note is ever scheduled by any other check. It derives its level
  count from `PROG.length` (`NLV`), because the loops used to be `L < 4`, so the
  day levels 5 and 6 were added the two newest songs became the only two nothing
  checked. *A count copied out of the code is a count that silently stops being
  true.*
- **`enginecheck.mjs`** exercises the built Phaser app through browser input and
  a read-only snapshot only, and now requires an actual HTTP response from the
  Vite preview rather than trusting a printed "Local:" line.

Three guards in `check.mjs` are worth naming because each replaced a failed
version of itself: the DOM-id list is **scanned** from `getElementById` calls
rather than written down (it was `['c','safe']` and missed `#bg`, whose loss
degrades silently to the 2D sky); the upgrade-wiring guard reads ids in any
position and runs against **comment-stripped** source (the literal characters
`upgOn('deepbank')` inside a block comment satisfied the first version, so
deleting a wiring while mentioning it in the comment explaining the deletion
left the tile offered, picked and inert); and the mechanics-ledger guard **runs
one way on purpose** — every mechanic the code ships must appear in
`MECHANICS.md` — because the reverse direction would have to decide which of the
ledger's rows are supposed to name a code symbol, *and a guard that guesses
produces false failures, which is how a guard gets deleted.*

## The cloud is an addition, never a dependency

The game plays with no network at all. Signed out, offline, blocked by an
extension, or served from a host with no functions behind it, it is exactly the
game; `localStorage` is still the real store. **Nothing is ever on the path
between a tap and a comet moving**, and a failed request is swallowed rather
than surfaced — *a player who has just died is owed the death screen, not a
network error.*

It plugged into a seam that already existed: `loadPrefs()` has always read an
optional async `window.storage` beside `localStorage` and folded the two with
`Math.max`, because the file was first written against a host that supplied one.
That seam **is** a cloud save. The only new code inside the game loop is one call
in `die()` offering the run to the board.

**The merge is server-side, and that is the whole point.** Two devices on one
account means two writers; the naive design makes the last tab to close the
winner, so a phone that has not synced since Tuesday overwrites Thursday's best.
`netlify/lib/records.mjs` folds instead, with the rules the game already applies
locally: `max` for `best`/`gl`/`runs`/`struggle` (a record is monotonic by
definition), **sticky** for `groove`/`hopped`/`landed` (*"this human has once
done X" can never become false — forgetting it replays a once-ever tutorial at
somebody already taught*), **union** for `seen`/`seen2`, **last write** for
`muted`/`swipe`/`name` (a preference is a statement about *now*; applying max to
a mute builds a mute that cannot be undone). Once the records are monotonic the
two devices commute, which is what makes an offline device safe to sync days
later — and it removes a class of tampering for free. **A key not in that table
is not synced**: an unknown key would be an unbounded write into a document the
server hands to every device on the account.

**No passwords**, on the owner's call. A name, a 32-byte random key living in
the browser, and a six-character single-use ten-minute transfer code for a second
device. That code is what makes it a *personal* login rather than a per-device
nickname. What it is **not** is proof of who anyone is — the key is a bearer
token — and the trade is deliberate and sized to a score on a board among people
who know each other. It should be revisited before this is handed to strangers.

**The board is soft on purpose.** The whole game is delivered to the browser, so
anyone who wants to POST a number can read exactly how. The rate bound is
**deliberately loose** — 1200 points a second against a game that pays a couple
of hundred at its best — because *a ceiling tuned close to real play would
eventually call somebody's genuine best a forgery, and that is a far worse
failure than letting an inflated one through.* What would actually close it is
server-side replay from a seed and an input log, which needs the game to become
self-seeding: a change to the game, not the service. It would also buy replays
and ghost runs, which is why it is written down.

**The account panel is the only DOM in a canvas game**, because a canvas cannot
raise a phone keyboard, cannot be filled by a password manager, and has no
caret, selection or paste. Two consequences: every listener is on the canvas
except `keydown`, which is on `window`, so `CLOUD.open` has to guard it or
typing a name reverses the comet on every space and mutes on every `m`; and
seven harnesses run the file against a stubbed DOM whose `getElementById`
returns a non-element, so this is the only part of the game that has to survive
not finding any node — *it found that out the honest way, by failing
`musiccheck` on the first run after it was written.*

## Telemetry

Anonymous counters to PostHog, plain POSTs (`sendBeacon` first so a death
recorded as the tab closes still gets out), **no analytics SDK** — no
third-party script to load and no load order to get wrong. One random device id,
no autocapture, no session recording, no cookies, no names. A copy served from
`file://` or localhost sends nothing, which keeps development and the harnesses
out of the data. If the host is blocked the game plays on: *telemetry is a
listener, never a dependency.*

Three naming decisions carry the weight:

- **One name per ordinal.** `game_level` is the 1–6 level; the thirteen-rung
  unlock ladder is only ever `tier`, with `tier_name` from `tierLabel()` beside
  it on `run_ended`. The old `level` property is **retired rather than
  redefined**, because it held `tier + 1` on `run_ended` and 1–3 on
  `level_cleared` — *one property name, two scales, two events* — and redefining
  it would silently change what every historical row means.
- **`play_mode`, not `mode`.** One mode ships, and the property stays anyway,
  because without it a second mode's deaths would average into one unreadable
  completion rate. It is not called `mode` because `swipe_mode_chosen` has
  always carried the swipe rule under that name.
- **Per-level, not cumulative.** `pauses` and `paused_seconds` ride both
  `run_ended` and `level_cleared` on the same per-level scale as the `seconds`
  beside them, because `startGame()` re-baselines the counters at every level
  boundary — a pause taken on level 1 of a run that died on level 4 was recorded
  nowhere. Carrying a cumulative total into `run_ended` instead would have put
  two scales on one event, *which is the retired-`level` failure rather than a
  fix for it.*

**A lab session sends nothing, and it is suppressed inside `track()` rather than
tagged.** Tagging would have been the smaller change and the worse one: it moves
the burden onto every future query, and the first dashboard that forgets the
filter averages sandbox deaths — pinned clock, one orb on repeat, red switched
off — into the real completion rate. Suppressing means an event added by a later
change inherits it for free. Exactly one name is allowed through,
`powerup_lab_started`. Note what that means for `blackhole_entered`: a lab
session is the easiest way there has ever been to enter the mode, and none of
those entries reach the data, so the number keeps meaning *"a player met one in
a real run"*.

Two fields exist because their absence was a hole: `blackhole_died` did not
exist at all, so the mode's failure rate — the one number that says whether it is
too hard — lived nowhere and had to be reconstructed by hand-joining an entry to
a later `run_ended`; and `blackhole_survived` used to send `seconds: BH_DUR`, *a
constant reported as a measurement*, so every row that would ever exist read
17.0.

The interesting teaching field is **`misread_rate`**. Every swipe begins as a
tap, so the input layer reverses speculatively and rolls back once the finger
travels; `GEST` counts where each gesture actually resolves — `tap`, `swipe`,
`lateSwipe`, `unresolved` — and the counts are taken at the resolution sites,
**deliberately not inside `bump()`**, which also fires when a swipe hits the
outermost or innermost ring. That is the game answering correctly rather than
failing to understand, and conflating the two would make the metric useless.

## Delivery

Publish **`dist/` only**, never the checkout: README, CLAUDE, the docs, tools,
package files and native source are internal. Relative asset URLs support both
GitHub Pages' `/cosmo/` path and bundled native origins. `vite.config.ts`
injects `__COSMO_BUILD__` from the local Git commit, falling back to
`COMMIT_REF` or `GITHUB_SHA` on a builder — and **a build stamp identifies
source; a successful local build is not a live deployment.** Check the published
URL before reporting a release.

The old self-contained-HTML freshness parser is disabled in the Phaser host,
because searching for an inline `BUILD` literal is incorrect for a module
bundle. Never reload a live run to refresh it.

`netlify/build.mjs` stages the site by **reading the `cp … _site/` line out of
`.github/workflows/pages.yml`** rather than restating it. A second copy of that
list is a second thing to forget, and the failure is silent on whichever host
got missed: an internal document becomes a public URL on one host and not the
other. It lives in `netlify/` and not `tools/` because `tools/` means something
— every file there is a CI harness and `check.mjs` enforces it — and this
asserts nothing, so filing it there would either break that guard or hollow it
out. The same reasoning keeps `db/` out of `tools/`.

Capacitor packages `dist/` with **no release `server.url`**: a native install
must open its bundled title screen with no network. The two native origins
(`https://localhost`, `capacitor://localhost`) plus the Vite origin are an
**exact** CORS allowlist, no wildcard. Native share text must use the public
game URL and never `location.origin`, which would produce a private localhost
link. And generated native project files are not evidence of a build: *do not
describe scaffolding as an APK, a signed app or a tested native release.*
