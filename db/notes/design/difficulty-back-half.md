# Why the back half escalates on mix, not density

**What this answers:** why raising `shardCap` and the arrival rate past level 4
was measured and abandoned, and what replaced it.

## The failure that recurred one level along

Every pressure term in the file used to reach its floor or ceiling early and stay
there. Diagnosed first at dl 420, when level 4 was the last level: a player who
survived five minutes on EVENT HORIZON was playing the board they met at eighty
seconds, only faster. Measured across dl 340–1050 before the fix: warn 1.00 flat,
gap 0.80 flat, embers flat, shields flat, tier flat, sky flat.

The fix was written **as a number rather than as a rule**, so it recurred the
moment six levels existed: `shardCap` stopped at 12 from dl 680 forever and the
arrival gap floored at 0.64 from dl 700 forever, while HEAT DEATH runs dl 610 to
past 1100. Same failure, one level along.

Charted across the whole run, levels 1–3 raise per-ring shard density **nine-fold**
(0.33 → 3.00); levels 4–6 raised it **1.33-fold** (3.00 → 4.00) over roughly twice
the wall-clock time.

## Extending the curves barely moved anything

The curves were extended first — cap to 15 by dl 1080, the gap floor decaying from
level 4's own floor to 0.50. Measured over 100s of play per level: **mean live
shards 8.42 on level 4, 9.19 on level 5, 9.23 on level 6.** A 10% rise across two
whole levels, while `shardCap` went 10 → 12 and the arrival gap fell 0.75 → 0.62.

The board is already as full as placement will let it be, exactly as the
`spawnGap` note has always said: *placement failure limits density long before
`shardCap` does* (measured: mean 6.2 shards on a board whose cap was 8). Raising
the cap buys nothing; raising the rate buys almost nothing.

## The axis that was left is the mix

A board of nine plain singles and a board of nine sliding gates are the same count
and nothing like the same game. Three findings, each from measuring the flags on
every spike actually standing on the board rather than from reading the spawner:

**1. The pool was never the problem.** Sampled in isolation at dl 810+, it already
returned hard shapes ~70% of the time and singles 2–3%.

**2. The interesting shapes could not place.** Live-board mean shape rank was 1.39
on level 3, 1.72 on level 4, **1.33 on level 5** and 1.51 on level 6 — level 5's
board was *less* complex than level 3's, and gates, divers, funnels and saucers
were all but absent from levels 4–6. A gate needs every ring clear at one angle, a
funnel that plus a wider gap in its open lane, a diver two rings clear; on a board
already carrying nine shards none of those can be satisfied, all 18 attempts fail,
and the game quietly serves another twin. Shard-to-shard separation now **relaxes
across the attempt sequence** — full spacing on the first tries, ~55% of it on the
last. The *player* clearance does not relax and cannot: `clear` is the
reaction-time guarantee.

**3. Twins were eating the board.** 62–65% of everything standing on levels 5 and
6 against 44% on level 3 — a feedback loop, not odds. A twin places TWO shards
from ONE clear spot, so it is the cheapest formation to fit on a crowded board; it
then consumes twice the capacity, which makes every other formation harder to
place, which makes the next pick a twin.

## What shipped

- `SHAPE_RANK` (runtime.js:4742-4743) ranks shapes by how many independent facts
  the player must read: single 0, twin 1, gate/drift/blink 2, dive 3,
  driftgate/blinktwin/saucer/funnel 4.
- The late-board weight is `w = 1 + round(hb * SHAPE_RANK * 1.5)` where
  `hb = clamp((dl()-340)/560, 0, 1)` (runtime.js:4890-4891). `hb` is 0 at level
  4's floor and 1 by dl 900.
- Two live twin pairs is the ceiling, gated at `dl() >= 340`
  (runtime.js:4826, 4862) — the same rule one-wall-at-a-time has always applied to
  gates.

Landed live-board mean shape rank: **L3 1.42 · L4 1.71 · L5 1.79 · L6 1.68**, with
five to seven distinct shapes in play late instead of four, and divers back on the
board at all.

## Levels 1–3 are untouched *by construction*

Every change in the pass is gated at dl 340 or above. `hb` is exactly 0 below
level 4's floor, so every weight is exactly 1 — the identity the pool has always
had. The twin ceiling carries an explicit `dl()>=340`, and an earlier ungated
version of it measured a **9% rise in level 3's board complexity**, a difficulty
change nobody asked for. The spawn-gap floor is written `max(floor, ramp)` and not
`min(ramp, floor)`: the first draft used a `min`, which let the decaying term
undercut the ramp and pulled level 4's opening gap 0.90 → 0.85, a difficulty
change smuggled into the exact window the change promised not to touch.

## Three curves re-anchored to rules, not numbers

- **`warnTime`** now holds 1.00 through `LV[LEVEL_MAX-2].end` — dl 610, derived
  from the table — and eases to 0.86 past it (runtime.js:4457-4476). The old ease
  ran dl 460–640, written when everything past dl 340 was the exam and never
  re-anchored when dl 470–610 became REDSHIFT, a *teaching* level: **78% of the
  total telegraph decay landed inside the level that introduces THE NARROWS**,
  while the level the curve exists for got a flat tail.
- **`shardCap` steps moved off the lesson windows.** 9→10 and 10→11 sat at dl 420
  and 540 — 25 and 20 difficulty-seconds after the DIVERS (395) and NARROWS (520)
  banners. They sit at 445 and 575 now; end-of-level values are identical
  (runtime.js:4496-4503).
- **`spawnGap`'s floor decays from level 4's own floor**:
  `max(0.50, 0.80 - max(0, d-340)*0.00048)` (runtime.js:4533). The crossover with
  the opening ramp `2.6 - 0.005d` is dl 362, so every value below that is
  bit-identical to what shipped.
