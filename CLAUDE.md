# CLAUDE.md

Operating context for Claude Code sessions in this repository. Read this before
reviewing, changing, or reporting on anything here.

---

## Status: proprietary, commercial

**Cosmo is not open source and not a hobby project.** It is a commercial product
owned by its copyright holder, published to a public repository for playtesting
only. Every session should work from that assumption.

What follows from it:

- `LICENSE` is an all-rights-reserved proprietary grant. Never replace it with,
  or add, an open-source licence (MIT/Apache/GPL/etc.) — not as a default, not
  as a "standard practice" suggestion.
- Never add `CONTRIBUTING.md`, contributor guides, "PRs welcome" language, good
  first issues, or anything else that invites outside reuse or contribution.
- The copyright notice at the top of `index.html` and its `copyright` meta tag
  are load-bearing: `index.html` is the *distributed artifact*. Every visitor's
  browser downloads the entire game, so the terms have to travel with the only
  copy anyone ever gets. Do not remove or relocate them.
- **Third-party anything requires provenance.** No copying code, audio,
  fonts, algorithms, or art in without recording where it came from and under
  what terms. A single unattributed snippet is a defect in a product that will
  be sold, however small it looks. Ask rather than assume.
- Treat the repository's public visibility as a decision under review, not a
  licence. Do not add anything that assumes a public audience.

## What this is

A one-thumb arcade rhythm game in a **single self-contained HTML file**. No
build step, no dependencies, no external assets. `index.html` is the entire
product — engine, simulation, WebAudio arrangement system, procedural art, and
UI — around 6,500 lines in one inline `<script>`.

Deployed to GitHub Pages from `main`. The published page is the product.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole game. The distributed artifact. |
| `README.md` | Design record — why the game is the way it is. |
| `MECHANICS.md` | The mechanics ledger: one row per player-facing mechanic, where it is introduced, every channel that explains it. |
| `LICENSE` | All-rights-reserved proprietary grant. |
| `tools/*.mjs` | The six CI harnesses. No dependencies; Node's `vm` + a stubbed DOM. |
| `.github/workflows/pages.yml` | Runs all six checks on every PR; only `main` deploys. |
| `*.png`, `manifest.webmanifest` | Icons, share image, PWA manifest. |

## The checks

All six run on every pull request and must pass. Run them locally before
pushing — they are fast and need nothing installed.

```sh
node tools/check.mjs       # parses; required elements; teaching + mode-table drift
node tools/smoke.mjs       # loads and plays the game in a stubbed DOM
node tools/dropcheck.mjs   # the build meter still delivers beat drops
node tools/curriculum.mjs  # nothing is left untaught by level 3
node tools/musiccheck.mjs  # four levels, four songs, each in its own key
node tools/fxcheck.mjs     # the glow reaches a pixel, with a GPU and without one
```

`smoke.mjs` is the one that catches real bugs: it loads the game into a stubbed
DOM and actually plays it — the three front screens, menu demo, taps, swipes,
keyboard, minutes of simulated play, resize, tab visibility, death, retry,
level 2. Audio stays off, which exercises every audio guard.

**Two decision screens stand between the menu and a run**, and each publishes
its controls as rects from its draw pass: the swipe chooser, then the level
picker. Neither answers a tap on its background, because each is a decision, so
every harness crosses them by pressing the control it actually drew
(`passSwipeChooser`, `passLevelSelect`). The title screen answers a tap
anywhere again now the mode cards are gone, but `passMenu` presses its START
rect regardless — a helper that presses a real control keeps working when a
screen gains one, and a harness that taps a fixed point does not fail when it
meets an unexpected screen, it waits there forever. That is how the swipe
chooser broke all four harnesses when it arrived. Add a front screen and you
add a crossing helper to `smoke.mjs`, `dropcheck.mjs` and `curriculum.mjs` in
the same commit. A fourth screen, the powerup picker, sits off that route —
it opens only from the title screen's POWERUP TESTING bar — and all three
harnesses carry `passPowerSelect` anyway, returning untouched. That is not
redundancy: it was exactly true of the swipe chooser the day before it stalled
everything, and the helper costs one function. `fxcheck.mjs` crosses the front
too and needs the same treatment — it is a fourth harness on that route.

`fxcheck.mjs` is the only harness that runs the RENDER path, and it is the
answer to the "not shipped until something proves it reaches a pixel" rule
below. It stubs WebGL as a RECORDING FAKE instead of removing it: shaders
compile, framebuffers complete, and it asserts on what was issued. Its most
important assertion is the uniform-name check — real WebGL returns null from
`getUniformLocation` for a name the shader does not declare, and a write
through a null location is a silent no-op, so **one typo removes an effect
from the game without failing anything else in this repo**. The fake parses
the shader source it was handed and reproduces that exactly. It also pins the
glow's draw count and its render-target ladder, checks the y-flip on upload,
drives the render-scale dial through fast/slow/fast — asserting the degrade
ladder retires the GLOW before it touches the sky's resolution, keeps the sky
itself alive as the last resort, and that the raise ignores menu frames — and
then runs the whole game again with no WebGL and fails unless the drawn-disc
fallback takes over with zero GPU calls. **Anything that touches a shader, a uniform, the glow
chain or the scale dial belongs in this harness.** All of its assertions were
mutation-tested when it was written; keep that habit — a render check that
cannot fail is worse than none, because it reads as coverage.

`musiccheck.mjs` is the only harness that runs the arrangement. `smoke.mjs`
removes WebAudio deliberately and `dropcheck.mjs` never drives past level 2, so
before it existed the per-level songs had no coverage: deleting level 4's riff
and solo rows left all four other checks green and crashed the browser. It
stubs WebAudio instead of removing it and asserts on what was actually
scheduled. **Anything that touches `PROG`, the hooks, the per-level basslines
or kits, or any pitch in the audio path belongs in this harness** — a musical
regression is otherwise invisible to CI by construction.

**The harnesses are not deterministic.** The game uses unseeded `Math.random`,
so run-length-dependent output (the `struggle` counter, death timings) varies
between runs. Before attributing a changed value to your diff, re-run the
harness on the unmodified file — several times.

## Invariants that are load-bearing

Breaking one of these is a product regression, not a style question.

- **The curriculum rule, as the owner revised it.** The rule used to end
  teaching at level 4's floor. The owner's call, verbatim: *"We are going to
  change to balance power up introduction, mechanics, and difficulty all the
  way the level 4."* So the boundary now differs by KIND, and the split is
  deliberate rather than a loophole:
  - **Formations** — the shard shapes on the tier ladder — still complete by
    dl 340. They compound with each other, they are what the death coach
    explains, and meeting a new one at the speed ceiling is the density
    problem the ladder was rebuilt to avoid. `curriculum.mjs` still fails if a
    tier banner fires inside level 4, and that guard stays.
  - **Orbs and modes** may now be introduced through level 4, taught by
    `firstMeet` at first contact wherever that falls. THE BLACK HOLE is the
    first of these: it is rare on purpose, so guaranteeing it inside level 3
    to satisfy a boundary would have destroyed the thing that makes it work.
  This is the owner's decision and not an inference from the code. The pacing
  half of it is now done: spotlight's guarantee moved to level 3, the black
  hole's to level 4, and the difficulty clock grew a second ramp past dl 420
  where every pressure term used to sit flat forever. Do not read the new
  latitude as permission to scatter formations into level 4 — that half of the
  rule is unchanged and still enforced.
- **The formation half of the rule.** Every formation is introduced *and
  explained* by the end of level 3 — dl 340, which is `LV[2].end` and level 4's
  floor. Enforced by `curriculum.mjs` (which
  fails if any tier banner fires inside level 4, and requires every type in its
  `TAUGHT` list to have been lessoned by then) and by a static guard in
  `check.mjs` (`max(TIERS[].at) <= ends[2]`). `smoke.mjs` additionally pins the
  LAST tier to exactly `LV[2].end`, so a new tier can be inserted anywhere below
  THE EYE but never appended after it. If you move a tier, all three must pass.
  This entry said "the end of level 2 · level 3 introduces nothing" until a
  session went looking for room to add a shape and found the code, the ladder
  table and all three harnesses saying level 3 while this file, `README.md` and
  one comment in `check.mjs` said level 2. Level 4 moved the exam when it was
  added; the rule was never updated to follow it. A constraint that disagrees
  with its own enforcement costs more than a missing one — it makes the careful
  reader wrong.
- **Adding a tier is wider than it looks.** `curriculum.mjs` used to hardcode
  the last tier's index (`G.tier !== 9`), so inserting a row anywhere failed the
  build with a message about the wrong thing; it now derives it from
  `TIERS.length`. Twelve places in `index.html` still hardcode tier ordinals for
  the sky band, the NEW SOUND ladder and the star instrument — inserting below
  the highest of them shifts every one.
- **ONE MODE SHIPS, AND `MODES` STAYS ANYWAY.** CHILL is retired — the owner's
  call, one mode until the game is perfected — and the table is kept at a
  single row on purpose. Do not "finish the job" by deleting it. The table is
  where the rule lives that **a second difficulty is a derivative and never a
  second implementation**, and that rule was arrived at rather than obvious.
  Delete the table and a future mode rediscovers it as a branch on a flag in
  the game code, which is the thing the table exists to prevent.
  The guards stay armed and `check.mjs` still enforces them. **The one row is
  the identity mode** — every knob 1, or 0 for the additive shield — so every
  expression reduces to exactly what shipped and the table can never quietly
  become the place the real game is tuned. **A knob declared and never read
  fails the build**, for the same reason a dead upgrade tile does. **Every mode
  has the same knob set** is vacuous at one row and stays armed for the row
  that comes back. `smoke.mjs` is what keeps the wiring honest with nothing
  shipped on it: it INJECTS a synthetic mode with every knob off neutral and
  measures every curve through the real functions, so a table wired to nothing
  cannot pass. Do not delete that test as dead weight — it is the only thing
  standing between a future second mode and a day spent discovering the
  plumbing rotted while nobody was looking.
  If a mode ever needs behaviour a multiplier cannot express, that is the
  conversation to have first — not a branch on `MODE` in the game code. And a
  mode must not touch the curriculum, the music or the scoring: tiers are keyed
  on `dl` and orbs on `G.level`, and `curriculum.mjs` fails if a mode moves a
  tier, a finish line or a level boundary.
- **A picked starting level cannot forge a climb.** The level select can start
  any level on any device, including ones never reached — that is what it is
  for. `G.startLevel` is the level the run *opened* on, and the level record
  (`FURTHEST YET`, `cometloop:gl`) only moves when it is 1. Never widen this to
  "the level the run is on": a run that starts at 1 and climbs must keep
  counting across retries, and a run that jumped must never count at all.
  Records are still keyed per mode and **the unsuffixed storage keys are
  SKILL's**, which is exactly why retiring chill cost no player their history:
  every value ever written to `cometloop:best` was skill's, because any other
  mode's went to a suffixed key. Never let `recKey` suffix skill — that
  silently changes what every stored record on every device means, which is the
  retired-`cometloop:level` failure exactly. `check.mjs` guards it. The
  `:chill` keys and `cometloop:mode` are left on disk deliberately and
  `cometloop:mode` is no longer read: a device that last played chill has
  `chill` under it, and honouring that selects a mode that does not exist.
- **A LAB SESSION LEAVES NOTHING BEHIND, and that is the whole feature.**
  POWERUP TESTING is a sandbox reached from the title screen: it forces one
  orb, pins `dl()` to `LAB_DL`, and switches red off by default. Every one of
  its guarantees is a `!LAB.on` sitting on a line whose ordinary job is to
  write to the device — the best score, the level record, the run count, the
  struggle streak, the `seen` bits, telemetry — so an omitted guard looks
  exactly like the others in a diff and no amount of reading finds it. Do not
  add another such line without its guard, and do not trust a review to catch
  it: `smoke.mjs` CLEARS `localStorage`, plays a lab session including hops and
  taps, and fails if any key reappears — which is the only enforcement that
  scales. It has to clear rather than diff, and that distinction is the whole
  lesson: the first version snapshotted a store the earlier tests had already
  filled, so three leaked writes (`hopped`, `groove`, `landed`) wrote `'1'`
  over `'1'` and the comparison saw nothing. A lab session must be unable to
  CREATE a key, not merely unable to change one.
  **The gameplay verbs write too, not just the menus.** `hop()` persists
  `cometloop:hopped`, and `G.everHopped` gates the once-ever first-hop
  rehearsal — so an unguarded lab could spend a fresh player's tutorial for the
  hardest gesture in the game before they ever met the real second ring. Two
  more sit in `tryLand()` and `judgeTiming()`, and **neither is reachable in
  `smoke.mjs` at all**: both return immediately without `AC`/`MU`, and smoke
  removes WebAudio by design. `check.mjs` covers that gap with a tripwire on
  the set of persisted keys — it cannot tell whether a write is guarded, but a
  new one cannot be added without someone being asked the question.
  **Two writers spend a lesson, not one** — `firstMeet()` fires the sentence,
  and the pickup path separately treats *taking* a musical orb as being taught
  it. Guarding only the first was the shipped-looking bug the harness caught:
  one black hole lab session would have permanently retired the black hole's
  lesson on a device that had never met one in the real game.
  **The lab is not a MODES row and must not become one.** `MODES` is the
  difficulty table and `check.mjs` holds it to that shape; a sandbox that pins
  the clock rather than scaling it has no knob set to offer. It is a flag with
  its own front screen, and the two mode cards are untouched. Likewise the
  title bar that opens it is a DOOR, not a card — it navigates, the way the
  menu's `change` swipe control already does, so "cards select rather than
  start" survives intact.
  **A pinned clock has one trap and it is already sprung once.** Anything
  written as "N difficulty-seconds from now" is a deadline that never arrives
  in the lab, because the difference is always zero. `tierIndex`'s hop-hold
  release valve was exactly that and is exempted; check any new one.
- **Pause is a FLAG, and the freeze is one line ABOVE `G.t+=dt`.** Both halves
  are load-bearing. It cannot be a `G.state`, because `draw()` dispatches on the
  state with the DEATH SCREEN as its final `else` — a `'paused'` state renders
  GAME OVER over a live run. And the return has to sit before the clock
  advances, because every deadline in the file is written against `G.t`: put it
  one line lower and the world freezes while its deadlines keep expiring. If you
  add anything that must keep moving while paused, drive it off the real frame
  delta the way the count-in does, never off `G.t`.
  **The hidden board and the cooldown are balance, not decoration.** Shards
  telegraph for 1–2.35s, so a visible frozen board makes pause a free look at a
  live warning; and without a re-pause cooldown, pause–resume–pause rebuilds
  that free look out of the count-in. Removing either is a difficulty change and
  should be argued as one. `smoke.mjs` mutation-tests both.
  **The pad is the trap here too** — see the `bedTick` entry below. Freezing
  `update()` stops its only writer, which does not silence the band, it freezes
  it at playing volume.
  **Anything measuring REAL elapsed time must read `performance.now()`, never
  `dt`.** `frame()` clamps `dt` to 0.05s so a stalled tab cannot fast-forward
  the simulation, and `requestAnimationFrame` does not fire at all while a tab
  is hidden — so a `dt` accumulator recorded a ten-minute paused break as 0.05
  seconds, which is the one measurement `paused_seconds` exists to make,
  reported as its opposite. The clamp is correct and is not the bug; using a
  simulation delta to measure wall time is. `smoke.mjs` advances its clock
  without running a frame, which is what a locked phone does.
- **Two ladders, two names.** `G.tier` is the ten-rung *unlock* ladder (what has
  been introduced); `G.level` is the 1–3 structure the player is told about.
  Everything player-facing — the HUD, the death headline, the pips, the share
  text, `FURTHEST YET` — uses `G.level`. Never call the tier ladder a level, in
  UI or in telemetry.
- **Telemetry: one name per ordinal.** `game_level` is the 1–3 level on every
  event; `tier` is the only name for the unlock ladder. Retire ambiguous
  property names rather than redefining them — a redefined property silently
  corrupts historical rows. The difficulty mode is `play_mode` on every event
  and deliberately not `mode`, which `swipe_mode_chosen` has always used for the
  swipe rule; that is the rule being applied, not an inconsistency to tidy up.
- **Ring index 0 is the OUTERMOST orbit.** `RAD_OFF` is `[1.0,0.76,0.545,0]`
  and `RAD_BH` is `[1.0,0.80,0.62,0.45]`: the index counts *inward*, so
  `G.ringI--` moves the comet AWAY from the centre and `ring===0` is the widest,
  safest lane. Two black hole mechanics shipped inverted on this and neither
  was catchable by reading: the gravity pull "dragging the comet inward" pushed
  it outward and then stopped at the rim forever, and the "inner ring 2× star"
  bonus paid on the outer ring — so the mode's two risk/reward systems both
  rewarded avoiding risk, while their comments described the opposite. When
  code and comment can both be read as true under different meanings of "ring
  0", write the geometry, not the index: say *nearest the centre*, use
  `G.nRings-1`, and assert on `radiusOf()` rather than on the ordinal.
  `smoke.mjs` now fails if the pull's direction flips.
- **Silencing the scheduler is not silencing the band.** The pad is a bank of
  eight continuously running oscillators whose gain is written every frame by
  `bedTick`, which is its ONLY writer. A mode that stops `musicStep` from
  scheduling notes has not stopped the music — the pad sustains the level's
  progression straight through at full level. This was diagnosed once for the
  drop's hush, written up above `DROPQ`, and then repeated verbatim by the
  black hole, where it left 54% of the mix identical either side of an entry
  the pitch describes as the music "immediately cutting out". Any new mode that
  claims to replace the arrangement must have a branch in `bedTick`.
- **A MOMENT THAT MUST BE IMMEDIATE CANNOT BE A SECTION.** The section machinery
  changes only at a four-bar seam, which is the right rule for the chorus and
  the wrong one for anything a player triggers and expects to hear. The
  hypernova is the case: it is already in the hot-play set that lifts the
  record into the chorus, but the lift can only land at a seam, and a seam can
  be most of a loop away against a star that lasts four bars — so the payoff
  could arrive after the star had ended, or never. THE STAR RUN IS AN OVERLAY
  instead: a voice added above whatever harmony is already playing, starting on
  the frame the orb is taken. That is what makes it immediate, and it is also
  why it cannot collide with the chorus, the payoff or the black hole — it owns
  no table. Reach for an overlay whenever the answer to "when will the player
  hear this?" has to be "now"; reach for a section only when it can wait.
- **Audio is optional everywhere.** The game must be completable with no
  WebAudio at all. Every audio path is guarded; keep it that way.
- **Two clocks: `G.t` measures, `G.vt` shows.** `G.t` is real seconds and every
  deadline in the file is written against it (`G.invuln`, cooldowns, the audio
  scheduler), so it must never be dilated. `G.vt` is the same clock scaled by
  `G.tsCur` — the one the *visible* world rides: the backdrop, the camera
  dolly, ripples, popups, the trail, the particles, the hop. Slow motion used
  to reach the simulation and stop there, and the result was a mode running at
  0.42× behind a sky, a dolly and a debris field still at 1.0×, which reads to
  a player as not being slow at all. Adding a new animated layer means choosing
  one of these two on purpose. A deadline on `G.vt` will drift; an animation on
  `G.t` will contradict every slow-motion effect in the game.
- **Difficulty is measured PER RING, not per board.** The player stands on one
  orbit; what kills them is what arrives there. A board-wide count divided by
  nothing will read a mode that adds a fourth ring as harder when the same
  shard budget spread over four orbits is 0.75× the per-ring density of three.
  The black hole was reported at 1.18×/1.28× "effective pressure" on a
  board-wide metric and measures 0.82×/0.84× on a per-ring one, in the same
  build, on the same day. Quote the per-ring figure, say which metric any
  number came from, and be suspicious of a difficulty claim that improves the
  moment a ring is added.
- **A halo belongs to an object; a backdrop belongs to nobody.** These are
  tuned by opposite rules and the constants do not transfer. The sky's
  gravitational lens bounds its pull as a FRACTION of the radius, which is
  right for a smooth field where nothing has to stay anywhere. Copied onto the
  arena's glow it is a catastrophe: the orbits live between 0.09 and 0.20 of
  screen height, the clamp binds across that whole band, and the halo is
  dragged 120-170px off the light it belongs to — the detached-glow failure
  this file already records once, when an ember's bloom stayed parked on the
  ring it started from. Anything applied to light that is attached to an
  object must be bounded in ABSOLUTE terms and the bound quoted in pixels.
  This was caught by measurement, not by reading: the code was a faithful copy
  of a shipped, correct lens, and it looked right in review.
- **A SCREEN-SPACE WARP IS INVERSE SAMPLING, so its sign is the opposite of
  what it looks like.** The shader is handed a destination fragment and asked
  which part of the source to read, so reading from a SMALLER radius
  magnifies and pushes content OUTWARD. The glow's black hole lens shipped
  subtracting its pull, at the right magnitude, under a comment promising the
  opposite — halos moved 6.8 to 8.8px away from the singularity. **This is the
  third time this precise inversion has hit the black hole**: the gravity pull
  that "dragged the comet inward" pushed it outward, the "inner ring 2x" bonus
  paid on the outer ring, and now this. The pattern is always the same — code
  and comment are each true under a different reading of which way the number
  counts, so review confirms both. Nothing catches it except asking where a
  specific thing ENDS UP, in pixels, which `fxcheck.mjs` now does by parsing
  the coefficients out of the shader rather than copying them.
- **A visual feature is not shipped until something proves it reaches a pixel.**
  `fxcheck.mjs` now covers the GL path specifically — use it, extend it, and
  do not assume the other harnesses see any of this. They stub the canvas, so
  the 2D render path is STILL uncovered by construction, and the black hole
  spent its life with thirteen
  documented visual and audio features of which a playtester could perceive
  one. Each was individually correct at its own site and disabled by something
  elsewhere: the arena-scale art was gated on WebGL having *failed*; the
  shader's lens inverted the UV field so its own gravity well darkened nothing;
  `pow(x,2.0)` with `x` negative is undefined in GLSL ES and that is half of
  every gaussian ring; particles integrated on raw `dt` inside slow motion. If
  you add or change a draw or an audio layer, measure it — port the shader
  maths and evaluate it, or instrument the voice functions and total the
  energy — and put the number in the commit message. "It is in the source" is
  not evidence that it is in the game.
- **Every chord is diatonic to its level's natural minor, and every pitch is
  written as an interval over the level's tonic.** These are one rule seen from
  two sides. The SFX pentatonic is scaled into each level's key and every sound
  in the game speaks through it, so a chord borrowed from outside the mode —
  a major dominant being the obvious temptation — puts the entire effects layer
  a semitone out against the band. And an absolute pitch is a chord from
  outside the mode on three levels out of four: the beat drop, the snare body
  and the tom fill were each hardcoded to A-minor pitches and each rang wrong
  everywhere else, unnoticed for as long as the levels differed only by
  transposition. Never write a bare frequency into the audio path. `PROG` and
  `musiccheck.mjs` are where both halves are enforced.
  **The song is two sections per level now, and the chorus obeys four extra
  laws.** `PROGB` is the chorus table, `CHOFF` its per-level walk rotation,
  `SEVB` its color tones; `applySect` is the ONLY writer of the live `CH`/`ARP`
  tables and `chI()` the only translator from bar ordinal to chord. (1) Chord
  0 of every row in BOTH tables is the i chord: `CH[0][0]` is read as "the
  level's tonic" by ~25 call sites at arbitrary moments in either section, so
  a chorus opens off-tonic only through the rotation, never by reordering a
  row. (2) Sections change only at a four-bar seam, never inside a payoff,
  rise, black hole or star dive, and a level's first eight bars are always
  the verse. (3) The chorus's harmonic color lives in `SEVB` (stacked-third
  sevenths: m7 on minor chords, maj7 on III/VI, the dominant-shaped m7 on
  VII — the stacked third decides, never a hand-picked quality); the arps stay
  plain pentatonic under degree 4, the band's ceiling below the player's
  register. (4) The chorus lean never doubles a drum already playing: the
  sky bands FLOOR at `G.level-1`, so level 4 always rides band 3's beat-4
  snare and level 3 band 2's open offbeat hat, and the first lean stacked
  its "arriving" backbeat and open hat straight onto both — each addition
  yields wherever its slot already has that tenant (`skyI`/`rs` gates). All
  four are enforced in `musiccheck.mjs`, including walk ORDER (the L2
  chorus is the verse's chords walked the other way — invisible to any
  pitch-set comparison), the seam glides, the star dive's first-bar revert
  reaching the oscillators, `chorus_bars` holding through black hole and
  payoff, and a doubled-snare-body tripwire run at each level's sky floor.
- **No aimed input.** There is no target to hit anywhere in this game. Landing
  the beat drop is *any* move in the window, wherever the thumb is.
- **A lesson may only reference actions and objects the game actually has.**
  Cosmo has two verbs (turn around, change ring), rings, red, stars, shields
  and the beat. It has no aimed movement: no positioning, no threading a gap,
  no outrunning, no stopping. Two twin wordings shipped that each invoked a
  manoeuvre from some other game, and both read to players as nonsense — not
  because they were inaccurate, but because they answered a question the player
  had no way to be asking. Checking a sentence against the *code* does not
  catch this; the code will happily support a true statement about something
  the player can never do. Ask instead: is this sentence about something the
  player could attempt? When in doubt, claim only what is countable and name a
  verb the game has.
- **`MECHANICS.md` and the code move together.** Change a mechanic, update the
  ledger row and the level card text in the same commit.

## Workflow

**You are the agent. You ship. The owner gives guidance, not process steps.**

That means the whole mechanical chain is yours and none of it is worth asking
about: branch, commit, push, open the pull request, watch the checks, merge it,
and update the docs in the same breath. A green pull request sitting open is not
a finished task — it is a task stopped one step early.

This paragraph exists because of a specific failure. This file used to say
"open pull requests as drafts", and a session read that as *stop here and wait
to be told*. It left two green pull requests open, reported them as the
deliverable, and the owner had to say "merge" three times, the last two in
capitals. The instruction was about how a pull request starts, not about who
finishes it, but it was the only sentence here about merging and so it became
the rule. It is replaced rather than clarified.

- **Merge your own work.** Open pull requests ready for review, not as drafts.
  Squash-merge as soon as all six checks are green — that matches the history,
  where each commit on `main` carries its `(#N)`. Do not ask first. Do not wait
  for review that was never coming.
- **Never merge red, and never merge unverified.** The five checks are the gate,
  and `main` publishes to the live page on merge, so a red merge is a broken
  product for real players. If a check fails, fix it or say plainly why you are
  not going to.
- **Never commit directly to `main`.** This is not an approval gate; it is how
  CI gets to run before the deploy does. The pull request is the mechanism, not
  the permission.
- **Develop on the branch assigned for the session.** Push somewhere else only
  with explicit permission — but splitting unrelated work onto its own branch is
  usually the right instinct, so ask for it rather than shipping a pull request
  that does two things.
- **Say what you could not verify.** The thing genuinely worth escalating is
  never the merge; it is judgement the agent does not have. You cannot hear the
  audio or see the screen. Ship the work and name what needs the owner's ears
  and eyes, rather than holding the work hostage to it.
- Commit messages in this repo are substantive: what changed, and *why* it was
  wrong before. Match that register.
- Update `README.md` when behaviour changes, `MECHANICS.md` when a mechanic
  changes, and this file when a constraint changes. Unprompted, in the same
  commit. Documentation is part of the change, not a follow-up.

## Reviewing this repository

A review here has two halves. Earlier reviews did only the first, and missed a
public repository sitting with no licence for its whole life as a result.

**1. Correctness and clarity** — bugs, dead code, drift between the code and
`README.md` / `MECHANICS.md`, invariants above.

**2. Repository and product hygiene** — do this half explicitly, every time:

- Licence present, correct, and carried into `index.html`.
- Secrets and keys: what is embedded in the distributed file, and is it
  genuinely safe there. The PostHog project token is deliberately embedded and
  documented as write-only — re-confirm rather than assume.
- Telemetry and privacy: what is collected, whether it stays anonymous, and what
  obligations attach once there are paying users.
- Repository settings: branch protection on `main`, fork policy, visibility.
- Public/private posture: what belongs in a public playtest build versus the
  private source. Note that the published page hands every visitor the complete
  readable source — repository visibility does not change that.
- Third-party provenance for any code, audio, or art.
- Name and trade-dress exposure.

Report hygiene findings even when the session was asked only about code. If a
finding is out of scope to fix, say it exists and let the owner decide.
