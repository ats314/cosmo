# Dead code, vestigial state, and comments that outlived their mechanism

**What this answers:** which parts of `src/game/runtime.js` no longer do
anything, so an agent does not tune a constant nothing reads or trust a comment
describing a retired path. Every entry below was verified by reading every
reference in the file in this session.

Two kinds appear here and they matter differently. **Declared-inert** things are
labelled as such in the source and are load-bearing as documentation or as a
seam. **Silently dead** things are not labelled, and a reader has no way to tell
from the comment above them that the mechanism is gone.

## Silently dead — the ones worth acting on

### `schedulePreDrop` is never called (1404–1428)

The function that writes the drop's hush — the automation curve on `A.hole` that
takes the band's floor out for the eighth before the hit — has **no call site**.
The only other mention is a comment at 2801. A 34-line block above it (1394–1403)
states the file's central audio rule ("every duck writes its own undo") using
this function as the worked example, and the long note above `DROPQ` (1265–1273)
explains why the hush was necessary at all. None of that is running.

Downstream, `MU.hushEnd` and `MU.lpLock` are only ever set to 0 (in `buildBed`
and `endSection`), so:

- `duckBed`'s guard `if(MU && AC.currentTime < MU.hushEnd) return;` (2812) never
  trips.
- `bedTick`'s guard `if(!MU || t >= MU.lpLock)` (2802) always passes.
- `A.hole.gain` is written by exactly one thing now — `endSection`'s restore to 1
  (1565–1566). The node is in the graph and always at unity.

### The two-bar rise never happens (1698, 1719–1735)

`musicStep` hardcodes `const rn=-1, rise=false;` at 1698, so the whole
`if(rise){...}` block — the highpass sweep, the snare roll, the two-eighth hole —
is unreachable. `MU.rise` is assigned `false` in three places (1430, 1556, and
its initialiser) and **never assigned true**, yet it is read as a guard in
thirteen places: `armDrop` (1374), `fireLift` (1579), the section lift (1658),
the break gate (1726), the armed-wait shaker (1761), `endSection`'s bank (1553),
`startBlackHole` (2323), `musicTick` (2676), `bedTick` (2708, 2733, 2790), the
finale latch (7905) and the overdrive gate (8049). All of those terms are
constant-false.

### Drop landing is entirely retired, but its readouts are not

`tryLand()` (1339) is an empty function with a comment saying so, still called
from four input sites (7247, 7439, 7442, 7447). The consequences reach further
than the stub:

- `G.lands` is only ever assigned 0 or `G.carryLands` (6143, 6147). It is never
  incremented. So `run_ended.lands` is permanently 0 (6475), `level_cleared`
  carries a dead counter, and the share line `G.lands>0 ? ... : ''` (7051) can
  never print.
- `G.landFx` is only ever assigned `null` (1353, 6143). The update tick that ages
  it (7752) and the `firstMeet` deferral that respects it (5586) are dead terms.
- `G.secMult` is only ever assigned 1 (1442, 6143), so the "×2 on a perfect
  landing" multiplier at 2574 and 8448 is a permanent ×1.
- `MU.landT` is only ever assigned 0 (1414 — itself in the uncalled
  `schedulePreDrop` — and 1558), so the **count-in** in `drawBeat` (9440–9443)
  can never fire: `cin` is always 0 and the white-hot swelling ring described in
  the comment above it does not exist.
- `LAND_PERFECT = 0.12` (1338) has no readers at all. `LAND_WIN = 0.29` is read
  only by that dead count-in branch (9442).

### Sprites baked every resize and never drawn

`SPR.mote` (586–591) and `SPR.pip` (592–597) are built by `buildSprites` on every
real resize and are never passed to `blit`. `MOTES` (236–241) — 44 dust motes
with per-object drift rates — is populated at module scope and never read. The
"dust motes drifting in the shell of air the arena's light reaches" is not
rendered.

Likewise `bgStars` (182), filled with 22 entries inside `resize` (662–664), has
no reader; and `buildStarField()` (351–362) is never called, so `starField` is
permanently empty.

`drawShardOutline(x,y,r,al,dash,core)` (8953–8972) is defined and never called.

### Constants with no readers

| Constant | Line | Note |
|---|---|---|
| `RING_MULT` | 208 | the per-ring payout multiplier the comment invites you to set |
| `RAD_BAKE` | 206 | the halos are no longer baked, so nothing reads the radii they were baked at |
| `SKY_SWELL`, `SKY_FLOW`, `SKY_RATE` | 270 | described in a 7-line comment as "the whole feel of the backdrop" |
| `DROP_STEP`, `DROP_STEP_MAX` | 1325 | |
| `BUILD_SRC` | 1299–1300 | the four build-source display strings |
| `LAND_PERFECT` | 1338 | see above |

`dlOld(a)` (4425–4427) is defined and never called.

### Write-only state

`G.buildSeg` (declared 5037, written 6142) and `G.bandN` (declared 5069, written
6163) are never read. `MU.payHits` and `MU.barHits` are incremented in
`performerHit` (2666) and reset in `fireDrop`/`payoffStep`/`endSection`, but no
expression reads either.

`G.payOpen` is assigned only 0 (1485, 1563) and decayed toward 0 (7743), so its
term in `drawBeat`'s landing alpha (9463) is always 0.

## Declared-inert — labelled, and deliberately kept

- `glRipple()` and `glShear(dir)` (9697–9698) are empty by design, described as
  "compatibility hooks for input/audio". Called from `bedTick` (2769), `reverse`
  (6569) and `hop` (6912).
- `LOOPQ` (1030), `LOOP` (2217) and `PLAY.tape` (2214) are the retired
  loop-recorder's storage, kept for the lifecycle and cleanup paths that still
  clear them. The comments say so.
- `MODES` (3117) is one row on purpose — the table is kept so the rule "a second
  difficulty is a derivative, never a second implementation" survives, and
  `check.mjs` fails the build if a knob stops being neutral or is declared
  without a call site. `MD().demo` and `MD().shields` exist only to keep that
  test honest.
- `recKey`'s mode argument (3138) and the `:chill` keys left on disk are the same
  kind of deliberate seam.

## Comments that describe a different game

- The `DROPQ` note (1265–1273) and the `schedulePreDrop` discipline note
  (1394–1403) describe the hush in the present tense. It does not run.
- The block at 1301–1324 explains an escalating drop cost ("drop 1 at 1.0, then
  +0.8 each, capped at 4.2") and `HAIRTRIG` as a multiplier on that curve. The
  live `build()` (1328–1337) is a simple counter to `dropNeed()`, which returns 2
  with `hairtrig` and 3 without; there is no escalating cost and no decay,
  contrary to "It also decays" at 1297.
- `build()` accepts only `src === 'orbit'` with `amount >= 0.04` (1332). There
  are seven call sites and exactly one passes: `build(0.043,'orbit')` at 8363,
  inside the fed-orbit branch. Rejected on the source: `build(0.011,'time')`
  (2600), `build(0.06,'time')` at the ×8 summit (2616), `build(0.021,'hop')`
  (6964), `build(0.008,'ember')` (8527), and the trickle `build(dt/50,'time')`
  (7749). Rejected on the amount: the near-miss `build(0.006,'orbit')` (7692).
  So the four-source build meter described at 1287–1298 is one source in
  practice, the "it also decays" claim at 1297 is false, and the comment at
  7747–7748 — "a steady trickle guarantees one roughly every 50s even for a
  player earning nothing" — describes a call that returns immediately. The
  behaviour that ships is the one `CLAUDE.md` states: three star-fed orbits, or
  two with `hairtrig`.
- The comment at 202–203 says the halos are baked once at `RAD_BAKE` and scaled
  at draw time. `buildSprites` bakes no halos; `bandOnly` returns immediately
  (386) because "scene colour is procedural now".
- The header at 1274 promises "a rise, a SILENCE, and the hit". What ships is the
  hit.

## What this does *not* claim

Nothing here is a proposal. Several of these are cheap deletions and several
(the hush, the rise, the landing) are features that were removed from behaviour
while their scaffolding stayed. Deciding which to restore and which to delete is
a taste question for the owner; the point of this note is that the code does not
currently say which is which, and a session that tunes `LAND_WIN` or
`SKY_FLOW` will change nothing at all.
