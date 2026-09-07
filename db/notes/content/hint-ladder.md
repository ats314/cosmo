# The hint ladder: nine rungs, first match wins

*What this answers: exactly which sentences `hintText()` can return, in what
order, under what gates, and what retires each one.*

`hintText()` — `src/game/runtime.js:11455-11481`. Its return value reaches the
player only as the **last** branch of `runMessage()` (`:11540`), rendered as a
`FLIGHT TIP` card in the arena centre. It is not a bottom-of-screen strip; the
docs describing one are stale.

## Global suppression (`:11456`)

Returns `null` outright unless `G.state==='playing'`, and if any of `G.intro`,
`LAB.on`, `bhActive()` or `FIN.on` is true. Note `starfallActive()` is **not**
in that list — Starfall outranks it inside `runMessage` instead.

## The rungs, in evaluation order

`const a=age(), learning=G.runs<=2;`

| # | line | text (verbatim) | glyph | fires while |
|---|---|---|---|---|
| 0 | 11459 | the live `MEET` lesson object | its own | `G.teachHint && G.teach>0` |
| 1 | 11461 | `Tap to turn around` | tap | `learning && !G.didReverse && a<12` |
| 2 | 11463-11464 | `Shield: blocks one red hit` | shield | `learning`, a shield orb on the board, `!G.gotShield && !G.didShield` |
| 3 | 11465-11466 | `Slow-mo: movement slows for 6 seconds` | warp | `learning`, a warp orb on the board, `!G.gotWarp` |
| 4 | 11467-11468 | `Nova: red obstacles become stars` | nova | `learning`, a nova orb on the board, `!G.gotNova` |
| 5 | 11470-11471 | `swipeWords()` → `swipe up or down to change ring` (screen) / `swipe out or in to change ring` (radial) | swipe | `!G.didHop && !G.everHopped && G.nRings>1 && a<35` |
| 6 | 11472-11474 | `Collect a star, then complete a circle without turning`, or `Keep going without turning to earn orbit points` once `G.lapEmbers>0` | star | `!G.didLap && !G.seen.orbit && a<30` |
| 7 | 11475 | `MEET.single` — `Red hits cost a shield; tap to turn or swipe rings` | shard | `!G.didDodge && !G.seen.single && G.spikes.length && a<40` |
| 8 | 11476-11477 | `Tap with the beat to earn bonus points` | beat | `learning && !G.didGroove && !G.seen.beat && a>28 && a<36` |
| 9 | 11478-11479 | `Three orbits with a collected star earn Starfall` | star | `learning && !G.sawDrop && G.build>0.15 && a>=38 && a<46` |

Rungs 1–4 and 8–9 are gated on `learning` = `G.runs<=2`, i.e. **only a device's
first two runs ever see them**. Rungs 5, 6 and 7 fire for anyone.

Three of these are duplicates by construction and that is deliberate: rung 7 IS
`MEET.single` (same object, so a reword moves both), rung 3 is the same sentence
as the `SLOW-MO` lab row and rung 4 as the `NOVA` lab row
(`LAB_ORBS`, `src/game/runtime.js:3173-3184`).

## The retirement flags

Each rung dies the moment the player does the thing:

* `G.didReverse` — set in `reverse()` (`:6568`).
* `G.gotShield` — first shield pickup (`:8571`); `G.didShield` — first shield
  *spent* (`:7656`).
* `G.gotWarp` / `G.gotNova` — first pickup (`:8619`, `:8699`).
* `G.didHop` — set in `hop()` (`:6911`); `G.everHopped` is the persisted
  lifetime version, written from `hop()` and never from the lab.
* `G.didLap` — first completed orbit.
* `G.didDodge` — a shard faded on the player's ring (`:7549`) or a shield
  absorbed one (`:7656`).
* `G.didGroove` — persisted (`cometloop:groove`) at the first on-beat tap
  (`:2625`), so it survives across runs.
* `G.sawDrop` — a Starfall was earned (`:1334`, `:1376`, `:1387`).

## Two pieces of dead state

`G.hopHintT` (declared `:5073`, reset `:6155`) and `G.campT` (declared `:5057`,
incremented `:7888`, reset `:6155`) are **never read** anywhere else in the
file. `campT` counts seconds spent on the outermost of three-plus rings — the
"camp hint" that `docs/design/teaching.md` still credits for teaching the inner
ring. There is no camp hint in the shipped code.

## What the docs claim that the code does not do

`docs/design/teaching.md` describes the ladder as deadlock-proofed: orb-naming
hints "outrank" the swipe prompt while an orb is on the board, and after ten
unanswered seconds the swipe prompt "alternates with the survival lessons on a
slow cycle". Both are true of the *ordering* only in the weak sense that rungs
2–4 sit above rung 5 in the list; there is **no alternation timer** in
`hintText()`. What actually bounds the swipe prompt now is its own `a<35`
window, after which rung 7 (red) is reachable until `a<40`.
