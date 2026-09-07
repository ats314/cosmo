# Difficulty, the mode table, records and the lab

*What this answers: how Cosmo controls pressure, why a table with one row is
kept, where a run is allowed to start, and why the powerup lab may not touch
anything.*

## Difficulty is a clock

`dl()` is difficulty-seconds: wall time plus a **capped** nudge from good play,
so a strong run reaches each rung sooner but a good run can never accelerate
into a wall. Everything that presses on the player — speed, shard cap, arrival
rate, warning length, the tier ladder, the finish line — is keyed off that one
number. That is the whole argument for it being the lever: slowing `dl()` eases
all six together *and in the proportions they were tuned in*, which is the only
way "easier" stays recognisably the same game rather than a differently-broken
one.

The first ~80 seconds advance at 55% rate, the opening speed is a glide, the
first threat arrives alone (`shardCap` starts at one), early warning pulses run
almost half a second longer, and spawns open at 2.6 s instead of 2.1 — all of it
converging on the same late game, none of it touching the ceiling.

**Every run opens quietly, and it is a ramp, not a floor.** A flat 7 s floor was
an overshoot of the gentle-opening request: measured over five instrumented
runs, the first threat was not arriving until 10.5 s and 13.2 of the first 25
seconds had an empty board. `firstShardAt() = 4.5 + 8.5 * rookie()`, and
`rookie()` is `max(0, min(1, (4 - G.runs) / 3), min(1, G.struggle / 3))`. Note
that `G.runs` is incremented at the *start* of a run, so a fresh device plays
its first run with `G.runs = 1` and `rookie() = 1`: the opening is **13.0 s**,
easing to 4.5 s from the fourth run. `docs/design/teaching.md` and the code
comment beside `firstShardAt` both say 11 s; neither matches the arithmetic.
The struggle streak — three consecutive sub-30-second deaths — reopens the full
opening no matter what the lifetime counter says, and one survival past 30 s
clears it.

## The back half could not escalate, and density was not the reason

Charted across the whole run, levels 1–3 raise per-ring shard density **ninefold**
(0.33 → 3.00) and levels 4–6 raise it **1.33-fold** over roughly twice the
wall-clock time, and every term reached its ceiling about ninety seconds into
HEAT DEATH. Extending the curves **barely moved anything**: mean live shards
8.42 / 9.19 / 9.23 on levels 4/5/6 over 100 s each. *The board is already as full
as placement will let it be* — `spawnGap`'s own note has said all along that
placement failure limits density long before `shardCap` does (measured: mean 6.2
shards on a board whose cap was 8).

**The axis that was left is the mix.** Three findings, each from measuring the
flags on every spike actually standing on the board rather than from reading the
spawner:

1. The pool was never the problem — sampled in isolation at dl 810+ it already
   returns hard shapes ~70% of the time. `SHAPE_RANK` ramps complexity's weight
   from level 4's floor to dl 900.
2. The interesting shapes **could not place**. Live-board mean shape rank was
   1.39 on level 3, 1.72 on level 4, **1.33 on level 5**, 1.51 on level 6 —
   level 5's board was *less* complex than level 3's. A gate needs every ring
   clear at one angle; a funnel that plus a wider gap; a diver two rings clear.
   On a board carrying nine shards all 18 attempts fail and the game quietly
   serves another twin. Shard-to-shard separation now **relaxes across the
   attempt sequence** — full spacing on the first tries, ~55% on the last. The
   **player clearance does not relax and cannot**: `clear` is the reaction-time
   guarantee, and it is the one number here that is not a preference.
3. **Twins were eating the board** — 62–65% of everything standing on levels 5
   and 6 against 44% on level 3. A feedback loop, not odds: a twin places two
   shards from one clear spot, so it is the cheapest formation to fit on a
   crowded board, then consumes twice the capacity, which makes every other
   formation harder to place. Two pairs live is the ceiling now.

**Levels 1–3 are untouched by construction rather than by inspection.** Every
change is gated at dl 340 or above; the first dl at which any curve differs is
360.5, the shape weighting is multiplied by a ramp that is exactly 0 below level
4's floor, and the twin ceiling carries an explicit `dl() >= 340`. An earlier
ungated version measured a 9% rise in level 3's board complexity — *a difficulty
change nobody asked for* — which is why the gate is there.

Three curves were re-anchored in the same pass, all for the
written-as-a-number-not-a-rule failure: the telegraph decay moved into HEAT
DEATH (anchored to `LV[LEVEL_MAX-2].end`, not a literal); the shard-cap steps
moved off the DIVERS and NARROWS lesson windows to dl 445 and 575; the drop's
escalation was clamped under its own meter.

**`spawnGap` is written as `max(floor, ramp)` and not `min(ramp, floor)`.** The
first draft used a min, which let the decaying term undercut the opening ramp
before dl 420 was reached and pulled level 4's opening gap from 0.90 to 0.85 —
*a difficulty change smuggled into the exact window the change promised not to
touch.* The crossover is where the opening ramp hands over (dl 362), so every
value below that is bit-identical to what shipped.

## The clearance follows travel, not position

`farFromAll`'s player term was one symmetric read of `G.angle` with no heading
and no memory, so nothing could be placed within `minP` of where the comet *is*.
For a player who travels that is exactly right — it is the promise that a shard
never materialises inside your stopping distance. For a player who does **not**
travel it is a permanent sanctuary that moves with them: any oscillation arc
narrower than 1.1 rad is provably unreachable by every static formation, because
every point of the arc is always within 1.1 rad of every position the player can
occupy in it. Simulated, a camper survived five fifteen-minute level-4 runs
without a scratch inside 1.3 rad, and a camper starting on level 1 cleared
levels 1–3 inside a 30-degree arc.

So the exclusion follows travel: the full reaction gap **ahead** along the
heading, a short pad **behind**, measured in time (0.16 s of travel, floored at
0.45 rad) so it cannot shrink as the game speeds up. *The arc you have just left
fills in behind you, and turning around means turning into what you abandoned.*
This is not a new hazard class — shards already end up behind you every orbit;
the bubble only stopped them being *placed* there — and a shard placed behind
still spends its whole warn phase harmless.

**Gates are exempt while any wall is live.** A gate exists to force a reversal
and `reverseEscape` vets at spawn time that the reversal has 1.1 rad to open
onto — a check a later spawn behind the player could invalidate. The bubble goes
symmetric while a gate is on the board, *so the one formation that demands a
turn can never be the one that punishes it.* Rewards keep the old symmetric
clearance too: letting stars and orbs fill in behind a stationary player would
hand the camper a reason to stay.

Measured on level 4 with an immortal camper bot, five five-minute runs: **5/5
survived before, 3/5 after**, with survivors executing roughly three perfect
ring changes a second. A travelling bot is unaffected (median 54.4 s → 52.4 s
across twelve runs each) and board density is unchanged (9.1 → 8.8).

## One mode, and the table kept for the next one

CHILL is retired. `MODES` stays with a single row and that row is the
**identity**: every knob 1, or 0 for the additive shield. So every expression
the knobs appear in still reduces to exactly what shipped, and *the table cannot
quietly become the place the real game is tuned.*

| Knob | Reaches |
|---|---|
| `clock` | `dl()` — the main lever |
| `speed` | `speedAt()`, ceiling included |
| `warn` | `warnTime()` — the telegraph |
| `cap` | `shardCap()`, floored at one |
| `gap` | `spawnGap()` — arrival rate |
| `shields` | starting bank, **additive** |
| `demo` | the title screen's demo comet |

Keeping it costs one row and buys the rule that was expensive to get right: **a
second difficulty is a derivative, never a second implementation.** Deleting the
table would delete the rule and leave a future mode to rediscover it, most
likely as a branch on a flag in the game code — exactly what the table exists to
prevent. Bringing chill back is adding a row.

**And a mode must never touch the curriculum, the music or the scoring.** Orbs
and lessons are gated on `G.level` and tiers on `dl`, so any mode meets every
formation in the same order at the same points and merely takes a different
number of seconds to get there.

Three guards keep this honest with nothing shipped on it. `check.mjs:142` fails
if skill stops being the identity, if a knob is declared and never read (read
from the *stripped* source, because a knob named in the comment explaining its
removal is not a call site), or if a future second row grows a knob skill lacks.
`smoke.mjs:649` goes further: it **injects a synthetic mode** with every knob off
neutral and measures every curve through the real functions at the same
difficulty second, so a table of multipliers wired to nothing cannot pass.
*Deleting that test along with chill would have meant discovering the plumbing
was dead on the day someone added a row — the worst possible day.*

## No player loses a record

Every value ever written to `cometloop:best` and `cometloop:gl` was skill's,
because chill's went to `:chill`-suffixed keys precisely so an easier mode could
never redefine what the plain key meant — the failure the retired
`cometloop:level` key is remembered for. So the plain keys mean exactly what
they always meant, with nothing to migrate. The `:chill` keys and
`cometloop:mode` are **left on disk deliberately**: they cost a few bytes,
nothing reads them, and they are somebody's record. `recKey` keeps its mode
argument even though one mode can only produce one answer — it is the seam a
second mode returns through.

## Where a run starts

From the second run on, a picker names all six levels; a fresh device goes from
the swipe chooser straight to level 1's card, because a player with zero runs has
nothing to pick with. All six are selectable including levels never reached — *the
screen exists so a level can be reached without playing to it*, which is what
makes testing level 4 possible at all. Rows the device has actually reached are
marked *reached*.

This reverses a decision the menu used to enforce (every menu tap forced level
1, because shared phones kept inheriting a device's unlock and friends thought
the game had skipped level 1), and the reason it is safe is narrow: **the
selection is deliberately not persisted.** Every page load opens on LEVEL 1, so a
borrowed phone still begins at LIFT OFF. *Saving the pick is what would bring the
original bug back with the picker as its new hiding place*, and `smoke.mjs`
fails if any storage key matching `lvsel|startlevel|:lv$` appears.

The cost of that freedom is bounded in exactly one place. `G.startLevel` records
the level a run opened on, and the level record moves only for a run that began
at level 1 — so choosing EVENT HORIZON and dying on the first shard prints no
FURTHEST YET and writes nothing. A run that started at level 1 keeps counting
across the retries that put it on a later level. The share text carries `· from
Ln` for a picked start; a default run shares exactly the sentence that shipped.

## Pause

A small icon top-left mirroring mute top-right, at the same size and inset.
*Small and inset is the whole placement argument*: the arena answers a tap
anywhere with a reversal, so every pixel given to a pause control is a pixel
where a reversal silently becomes a pause — and in a reaction game that is a
death.

The freeze is **one early return in `update()`, placed before `G.t += dt`**.
Every deadline in the game is written against that clock, so stopping it stops
all of them in step, `bhTick` included. `PAUSE` is a **flag, not a state**:
`G.state` stays `'playing'`, because `draw()` dispatches on state with the death
screen as its final `else`, so a `'paused'` state would have rendered GAME OVER
over a live run.

**The board is hidden, and that is a balance decision.** Shards telegraph for
1–2.35 s; a button that freezes a warning mid-flight and lets you read the board
at leisure is a difficulty change wearing a convenience label. Resuming shows
the frozen board for a 3 s count-in, and pause re-arms 5 s after play restarts —
*without a cooldown, pause–resume–pause is an unlimited supply of three-second
frozen looks at a live board.*

The audio context is left running; `musicTick` already survives an arbitrary gap
(it notices `MU.next` falling >0.4 s behind, abandons the section rather than
replaying it compressed, and restarts on the next grid line). The one thing
pause **must** do is take the pad down explicitly.

Paused time is **wall-clock**. `frame()` clamps `dt` to 0.05 s and
`requestAnimationFrame` does not fire while a tab is hidden, so a `dt`
accumulator recorded a ten-minute locked-phone break as **0.05 seconds** — the
exact case the field exists to detect, reported as its opposite. The count-in
deliberately still rides `dt`, because it is an animation and a backgrounded tab
should hold rather than silently expire.

## POWERUP TESTING (the lab)

Deliberately **not a mode** — `MODES` is the difficulty table and the lab pins
the clock rather than scaling it. That distinction survived CHILL's retirement,
which is the test of it: the table went to one row and the lab did not become
the second one.

It exists because seven of the ten orbs sit behind a curriculum ladder and the
eighth is rare on purpose — **three `blackhole_entered` events in the game's
entire recorded history, every one on level 4.**

`dl()` returns `LAB_DL = 40` and never moves. 40 is exactly `TIERS[3].at` —
THIRD RING — the lowest clock value that gives the arena all three orbits, which
matters because the black hole opens a *fourth* on entry and *a one-ring lab
would have demonstrated that against nothing.* Everything else follows: shard
cap 4, arrival gap 2.4 s, speed 1.62 of a 4.2 ceiling, a 2.35 s telegraph, and
level 1's finish line at dl 90 so nothing ever finishes and no tier arrives.

*red cannot touch you* is on by default, read at the **single lethal-contact
site** ahead of the hypernova and shield branches, written as one predicate
rather than a shield top-up — because a bank that refills is still a bank being
spent, and the pip row would count down and the LAST SHIELD popup would fire,
both lying about a run that cannot end.

**Nothing a lab session does reaches the device.** No best, no level record, the
lifetime run count does not advance, the struggle streak is not fed, no
first-encounter lesson is spent, no preference is written, no telemetry leaves
except `powerup_lab_started`. Two subtleties the harness found:

- **Two writers spend a lesson, not one.** `firstMeet()` fires the sentence, and
  the pickup path separately treats *taking* a musical orb as having been taught
  it. Guarding only the first would have let one lab session permanently retire
  the black hole's lesson on a device that had never met one.
- **The gameplay verbs write too.** `hop()` persists `cometloop:hopped`, which
  gates the once-ever first-hop rehearsal — so a fresh player who opened the lab
  and swiped would have met the real second ring with the tutorial for the
  game's hardest gesture already spent. `tryLand()` and `judgeTiming()` persist
  two more, and neither is reachable in `smoke.mjs` (both return immediately
  without WebAudio, which smoke removes by design), so `check.mjs:216` carries a
  **tripwire on the set of persisted keys** instead: a new one cannot be added
  without someone being asked whether the lab must be kept out of it.

`smoke.mjs` snapshots `localStorage` across a whole lab session — entry, orbs
taken, a forced death — and fails if a single key changes. *A tool that quietly
rewrites the save file it was opened in order to avoid touching is worse than no
tool.*
