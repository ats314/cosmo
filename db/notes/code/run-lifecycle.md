# The run: states, `startGame`, `die`, and what carries across a level

**What this answers:** the state machine in `src/game/runtime.js`, what
`startGame()` resets versus preserves, and the `carried` distinction that decides
half of it.

## States

`G.state` is a string, dispatched on by `update()` (7857–7877) and `draw()`/
`drawHUD`. The values: `'menu'`, `'swipesel'`, `'levelsel'`, `'powersel'`,
`'lvend'`, `'playing'`, `'dead'`.

Pause is **not** a state — it is `PAUSE.on`, a flag, because `G.state ===
'playing'` gates roughly twenty behaviours and `draw()` dispatches with the death
screen as its final `else` (3216–3222).

The lab is **not** a mode — it is `LAB.on`, set in `enterPowerSel()` (6653) and
cleared in exactly one place, `enterMenu()` (6641), so no route out can leave it
set. `MODES` stays a difficulty table with one row; `check.mjs` fails the build if
a knob stops being neutral or is declared without a call site.

## Entry paths

```
menu ──leaveMenu()──► (first run or introPending) ► beginIntro() ► playing
                   └► (!swipeAsked) ► swipesel ─► enterRunStart()
                   └► enterRunStart() ─► levelsel ─► startFromSelect() ► lvend ► startGame()
menu ──openLab()──► (!swipeAsked ► swipesel) ► powersel ─► startLab() ► startGame()
lvend ──pdEnd/keyDown──► cardDone() ► startGame()
dead ──retry()──► level>=2 ? lvend : startGame()
levelComplete() ► lvend (with rollOffer() when a level actually advances)
```

`beginIntro()` (6750) is the first-flight tutorial: four staged actions (turn,
collect, orbit, change ring) driven by `introTick` (6795) with `G.intro` set. It
forces `SWIPE_MODE = 'screen'` for a device that has never been asked. It uses
the real comet, hit test and input handlers — `introTick` owns movement and
returns before the ordinary progression, spawning and collision run.

## `startGame()` (6088) and the `carried` flag

`const carried = !!G.carryScore` (6119) distinguishes a **level advance** from a
**fresh run**. `startGame` runs on both, which is the source of a whole family of
fixed bugs where a per-run thing was reset per level.

Cleared on a fresh run only (`if(!carried)`):

- `G.skyW` (the world journey) — 6172
- `G.saidChor` — 6152
- the seen-this-run reward flags (`gotWarp`, `gotNova`, …) — 6236–6240
- `G.bhRun` — 6259
- the guarantee flags, seeded from the opening level: `hyperPlaced = level>2`,
  `spotPlaced = level>3`, `mirrorPlaced = level>4`, `scorchPlaced = level>5`,
  `slipPlaced = level>2`, `trailPlaced = level>3` — 6270–6274. A guarantee
  belongs to the level it names.
- `G.didReverse`, `G.didHop`, `G.didLap` — 6284
- `G.introN` (the shield → slow-mo → nova ceremony) — 6295

Carried across a level boundary: `orbits`, `lands`, `bestStreak`, `bestGroove`
via the `carry*` fields (6146–6150), plus `carryTime` accumulated in
`levelComplete()` (3609).

Reset on **every** `startGame`, therefore per level: `PAUSE.n`, `PAUSE.total`,
`G.chorusN`, `G.chorusBars`, `G.started`, `G.diff`, `G.powN`. This is why
`level_cleared` (3612) has to carry `pauses`/`paused_seconds` and
`chorus_entries`/`chorus_bars` — `run_ended` fires only on death and would
otherwise be the sole reporter of numbers this line already reset.

`G.runs` is incremented and persisted only when `!LAB.on` (6091): ten minutes in
the sandbox must not read forever after as ten more games played.

The level's music, sky floor and pre-climbed ladder are set here:
`applyLevelMusic()` (6117), `G.skyW = max(G.skyW, LEVEL_HOME[level-1])` (6182),
`G.tier = tierIndex()` and the ring count for level 2+ or the lab (6299–6302),
and `skyI = min(3, max(G.level-1, …))` clamped because there are six levels and
only four `SKY_BANDS` rows (6311).

## `die()` (6315)

Order matters and is annotated:

1. `flushLesson(true)` so an interrupted lesson is still recorded.
2. If inside a black hole: fire `blackhole_died` and skip straight to the closing
   warp, because `bhTick` runs on `bhActive()` regardless of `G.state` and would
   otherwise complete the mode — awarding the ESCAPE bonus — on the death screen.
3. Records: `G.newBest` and `G.best` are guarded on `!LAB.on` **at the point the
   record is computed**, not just at the `savePref`, because `G.best` is what the
   title screen prints.
4. `cloudSubmit` — fire-and-forget, swallowing its own failures.
5. The death coach, read word-for-word from `MEET[G.lastHit]`.
6. The re-arm: `delete G.seen[klr]; G.seen2[klr] = 1`, guarded on `!LAB.on`.
7. `G.struggle` — consecutive sub-30 s deaths, feeding `rookie()`; also guarded on
   `!LAB.on`, since it lengthens every future run's calm opening.
8. `G.newLevel = !LAB.on && G.startLevel === 1 && G.level > G.lvlMax` — a picked
   start is not a climb.
9. `endSection()` **before** `duckBed`, so `A.hole` is handed back first.
10. The death cadence, scheduled on the next eighth so even dying lands in time.
11. `run_ended` with ~35 properties.

## The finish line

Levels 1–5 have a finite `LV[].end`; level 6 is `Infinity` — "the currently
authored frontier", not an endless-mode rule.

`update()` 7897–7972 latches the star dive at `dl() >= lvEnd - 10` when no payoff
is in flight. With no audio context at all it falls back to completing the level
at the finish line (7902–7904). The dive builds `FIN.trail` — eleven stars in a
spiral (4 outer, 4 mid, 3 inner) carrying the cadence `[4,3,2,4,3,2,1,3,2,1,0]` —
plus a separate `FIN.sun` that only *blooms* once `FIN.got >= 8` or 30 s have
passed, so the ending is always a deliberate dive. `levelComplete()` (3592) then
sets `'lvend'` and calls `rollOffer()` only for a real advance.
