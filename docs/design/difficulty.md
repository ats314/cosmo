# Difficulty

*The clock, the knobs, and the one mode that ships.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

Difficulty is a clock, not a score. Playing well nudges it forward slightly,
but the nudge is capped, so a good run can never accelerate you into a wall.
The first ~80 seconds advance at 55% rate to give a new player room to find
the controls, the opening speed is a glide rather than a chase, the first
threat arrives alone (the shard cap starts at one), early warning pulses run
almost half a second longer, and spawns open at 2.6s apart instead of 2.1 —
all of it converging on the same late game, none of it touching the ceiling.

## The back half could not escalate, and density was not the reason

With six levels, the pressure curve had never been looked at past level 4. It
does not hold up. Charted across the whole run, levels 1-3 raise per-ring shard
density **nine-fold** (0.33 → 3.00) and levels 4-6 raise it **1.33-fold**
(3.00 → 4.00) over roughly twice the wall-clock time — and every term in the
file reached its ceiling about ninety seconds into HEAT DEATH: `shardCap`
stopped at 12 from dl 680 forever, the arrival gap floored at 0.64 from dl 700
forever. That is the same *"the exam keeps asking"* failure that was diagnosed
and fixed at dl 420 when level 4 was the last level, recurring one level along
because the fix had been written as a number rather than as a rule.

The curves were extended first — cap to 15 by dl 1080, the gap floor decaying
from level 4's own floor to 0.50 — and **that barely moved anything**. Measured
over 100s of play per level: mean live shards 8.42 on level 4, 9.19 on level 5,
9.23 on level 6. A 10% rise across two whole levels. The board is already as
full as placement will let it be, exactly as the `spawnGap` note has said all
along (*"placement failure limits density long before shardCap does"*), so
raising the cap buys nothing and raising the rate buys almost nothing.

**Density is saturated. The axis that was left is the mix.** A board of nine
plain singles and a board of nine sliding gates are the same count and nothing
like the same game. Three findings, each from measuring the flags on every
spike actually standing on the board rather than from reading the spawner:

1. **The pool was never the problem.** Sampled in isolation at dl 810+, it
   already returns hard shapes ~70% of the time and singles 2-3%. Complexity
   now earns weight as the clock climbs (`SHAPE_RANK`, ramping from level 4's
   floor to dl 900), which is what produces that.
2. **The interesting shapes could not place.** Live-board mean shape rank was
   1.39 on level 3, 1.72 on level 4, **1.33 on level 5** and 1.51 on level 6 —
   level 5's board was *less* complex than level 3's, and gates, divers,
   funnels and saucers were all but absent from levels 4-6. A gate needs every
   ring clear at one angle, a funnel that plus a wider gap in its open lane, a
   diver two rings clear; on a board already carrying nine shards none of those
   can be satisfied, all 18 attempts fail, and the game quietly serves another
   twin. Shard-to-shard separation now **relaxes across the attempt sequence** —
   full spacing on the first tries, ~55% of it on the last. The player
   clearance does **not** relax and cannot: `clear` is the reaction-time
   guarantee, the promise that nothing materialises inside your stopping
   distance, and it is the one number here that is not a preference.
3. **Twins were eating the board.** 62-65% of everything standing on levels 5
   and 6, against 44% on level 3 — a feedback loop, not odds. A twin places
   TWO shards from ONE clear spot, so it is the cheapest formation to fit on a
   crowded board; it then consumes twice the capacity, which makes every other
   formation harder to place, which makes the next pick a twin. Two pairs live
   is the ceiling now, the same rule one-wall-at-a-time has always applied to
   gates.

**Where it landed**, live-board mean shape rank: L3 1.42 · L4 1.71 · L5 1.79 ·
L6 1.68, with five to seven distinct shapes in play late instead of four, and
divers back on the board at all.

**Levels 1-3 are untouched, by construction rather than by inspection.** Every
change in this pass is gated at dl 340 or above: the first dl at which any
curve differs is 360.5, the shape weighting is multiplied by a ramp that is
exactly 0 below level 4's floor, and the twin ceiling carries an explicit
`dl()>=340`. An earlier ungated version of that ceiling measured a 9% rise in
level 3's board complexity — a difficulty change nobody asked for — which is
why the gate is there.

Three curves were re-anchored after that pass, all three for the same
written-as-a-number-not-a-rule failure:

- **The telegraph decay lives in HEAT DEATH now, not in REDSHIFT.** The
  second `warnTime` ramp holds 1.00 through dl 610 — the endless level's
  floor, derived from `LV` rather than written as a literal — and eases to
  0.86 by ~dl 790. The old ease ran dl 460–640, written when everything past
  dl 340 was the endless exam and never re-anchored when dl 470–610 became
  REDSHIFT, a *teaching* level: 78% of the total telegraph decay landed
  inside the level that introduces THE NARROWS, while the level the curve
  exists for got a flat tail. 0.86s is still about three radians of travel
  between arming and lethal, so the telegraph stays a telegraph.
- **The shard-cap steps moved off the lesson windows.** 9→10 and 10→11 sat at
  dl 420 and 540 — 25 and 20 difficulty-seconds after the DIVERS (395) and
  NARROWS (520) banners, a density step in the middle of each new formation's
  own introduction. They sit at 445 and 575 now; the later steps (11→12 at
  650, on to 15 past 1080) and the gap floor (0.80 decaying from dl 340 to
  0.50) are unchanged.
- **The drop's escalation is clamped under its own meter.** `dropNeed()` tops
  out at 2.75 against the meter's 2.9 cap: the unclamped +0.8-per-drop curve
  crossed the cap at the fourth drop, so after three drops the game's stated
  centrepiece could never arm again — 420s of strong play armed exactly
  three. The drop always re-arms now; the audio record has the economy.

## One mode, and the table that survives it

### CHILL is retired for now

The owner's call: one mode until the game is
perfected, and then a difficulty conversation from a settled baseline rather
than alongside one. What is *not* retired is the mechanism.

`MODES` stays, with a single row, and that row is still the **identity**:
every knob 1, or 0 for the additive shield. So every expression the knobs
appear in — `dl()`, `speedAt()`, `warnTime()`, `shardCap()`, `spawnGap()`, the
shield bank — still reduces to exactly what shipped, and the table still
cannot quietly become the place the real game is tuned.

Keeping it costs one row and buys the thing that was expensive to get right:
the rule that a second difficulty is a **derivative** and never a second
implementation. That rule was arrived at, not obvious, and it is written into
the shape of the table and its guards. Deleting the table would delete the
rule and leave a future second mode to rediscover it — most likely as a branch
on a flag somewhere in the game code, which is exactly what the table exists
to prevent. Bringing chill back is adding a row, not re-deriving a design.

The clock stays the intended main lever, and the reasoning is kept because a
second mode will need it. Everything that presses on the player — speed, shard
cap, arrival rate, warning length, the tier ladder, the finish line — is
already keyed off `dl()`, so slowing that one number eases all six together
*and in the proportions they were tuned in*, which is the only way "easier"
stays recognisably the same game rather than a differently-broken one. The
other knobs are trims on top of it, never a second difficulty curve. And a
mode must never touch the curriculum, the music or the scoring: orbs and
lessons are gated on `G.level` and tiers on `dl`, so any mode meets every
formation in the same order at the same points and merely takes a different
number of seconds to get there.

The guards stay armed. `check.mjs` still fails the build if the row stops
being the neutral element, if any knob is declared and never read, or if a
future second row grows a knob skill lacks. `smoke.mjs` goes further and is
the reason this is more than a comment: it **injects a synthetic mode** with
every knob off neutral and measures every curve through the real functions, at
the same difficulty second, so a table of multipliers wired to nothing cannot
pass. Deleting that test along with chill would have meant discovering the
plumbing was dead on the day someone added a row — the worst possible day.

### No player loses a record

Every value ever written to `cometloop:best` and
`cometloop:gl` was SKILL's, because chill's went to `:chill`-suffixed keys
precisely so an easier mode could never redefine what the plain key meant (the
failure the retired `cometloop:level` key is remembered for). So the plain
keys mean exactly what they always meant, on every device, with nothing to
migrate. The `:chill` keys are **left on disk deliberately** — they cost a few
bytes, nothing reads them, and they are somebody's record. `cometloop:mode` is
likewise left but no longer read: a device that last played chill has `chill`
sitting under it, and honouring that would select a mode that no longer
exists.

The title screen loses its cards and gets its best line back under the title,
where it lived before there were two records to tell apart. It answers a tap
anywhere again — with no selection on the screen, there is nothing a stray tap
can cost you, which is the only thing the select-don't-start rule existed to
prevent. The lab door stays exactly as it was; it was never a card.

**And then it moved under START.** Keeping the bar unchanged was right and
leaving it in the vacated slot was not: it made a developer sandbox the second
thing on the front door, above the four lines that say what the game is and
above the button that plays it. Nothing decided that — the mode cards were
deleted and the bar inherited their position. It hangs off the START pill now
and the key rows take the band, which is also how the 119px dead gap above
them closed. It falls back to the old slot on a viewport with no room under
the button; see the invariant.

## Where you start

The screen after the title picks the starting level — from the second run on.
A fresh device skips it: START (after the once-ever swipe chooser) goes
straight to level 1's card, because a player with zero runs has nothing to
pick with, and offering EVENT HORIZON and HEAT DEATH to someone who has never
touched the game was two decisions and four screens before their first second
of play. One run, however short, opens the picker — which also preserves its
testing job. All six are selectable on any device, including levels never
reached — the screen exists so a level can be reached without playing to it,
which is what makes testing level 4 possible at all. Rows the device has
actually got to are marked *reached*, so picked and earned stay visibly
different things.

This reverses a decision the menu used to enforce, and the reason it is safe
to is narrower than it looks. Every menu tap used to force level 1, because
shared and borrowed phones kept inheriting a device's unlock and friends
thought the game had skipped level 1. That complaint was about a start nobody
*chose*. So the selection is deliberately **not persisted** — it lives in
memory and every page load opens on LEVEL 1 — and a borrowed phone still
begins at LIFT OFF unless the person holding it picks otherwise on a screen
that names all six levels. Saving the pick is what would bring the original
bug back with the picker as its new hiding place.

The cost of that freedom is bounded in exactly one place. `G.startLevel`
records the level a run opened on, and the level record only moves for a run
that began at level 1 — so choosing EVENT HORIZON and dying on the first shard
prints no FURTHEST YET and writes nothing. A run that started at level 1 and
climbed keeps counting, including across the retries that put it on a later
level, because `startLevel` is where the run opened and not where it is now.

## Pause

Players asked for it. A small icon top-left, mirroring mute top-right at the
same size and inset. Small and inset is the whole placement argument: the arena
answers a tap *anywhere* with a reversal, so every pixel given to a pause
control is a pixel where a reversal silently becomes a pause — and in a
reaction game that is a death.

The freeze itself is one early return in `update()`, placed before `G.t+=dt`.
Every deadline in the game is written against that one clock, so stopping it
stops all of them in step: invulnerability, spawn timers, cooldowns, lesson
spacing, the tier ladder, the difficulty clock, and the black hole's own tick.
It is the same argument the difficulty modes make for using `dl()` as their
lever — one number, so nothing drifts out of step with anything else. Paused
seconds also leave the reported run time for free, because run time is measured
on the same clock.

**The board is hidden while paused, and that is a balance decision rather than
a style one.** Shards telegraph for between one and 2.35 seconds. A button that
freezes a warning mid-flight and lets you read the board at leisure is a
difficulty change wearing a convenience label, so the panel is opaque: you
cannot study what is not drawn. Resuming brings the frozen board back for a
three-second count-in — enough to find the comet again — and only then does
time restart. Pause re-arms five seconds later, because without a cooldown
pause–resume–pause is an unlimited supply of three-second frozen looks at a
live board, which is the hidden board's protection reassembled out of its own
escape hatch.

Nothing is done to the audio context. `musicTick` already survives an arbitrary
gap — it notices the schedule falling behind, abandons the section rather than
replaying it compressed, and restarts on the next grid line — which is the path
a backgrounded tab has always taken. Pause does what the visibility handler
does and no more. The one thing it *must* do is take the pad down explicitly:
the pad is eight continuously running oscillators whose gain is written every
frame, so freezing the update loop does not silence it, it freezes it, droning
one chord for as long as the panel is up.

## POWERUP TESTING

Under the title screen's key rows is the POWERUP TESTING bar, and it is
deliberately not a mode (it was "under the two mode cards" when the cards
existed; retiring chill did not make it a second row, which is the test of
it). Seven of the eight orbs sit behind a curriculum ladder, and the eighth —
the black hole — is rare on purpose: three `blackhole_entered` events in the
game's entire recorded history, every one of them on level 4. Finding out what
an orb actually feels like meant playing until the game decided to hand you
one. The bar opens a picker of all eight; choosing one starts a run where that
orb, and only that orb, arrives every few seconds.

The board it arrives on is quiet and stays quiet. `dl()` — the difficulty
clock every pressure term in the game reads — returns a constant and never
moves, which freezes speed, shard cap, arrival rate, telegraph length, the
tier ladder and the finish line together and in the proportions they were
tuned in. The constant is 40, chosen because it is exactly the clock value
that opens the third ring: the black hole adds a *fourth* orbit on entry and
restores what it found on the way out, so a lab with fewer rings would have
demonstrated that against nothing. Level 1's finish line is 90, so a lab run
is endless and no tier can arrive to interrupt what you came to look at.

*red cannot touch you* is on by default and switchable on the picker. It is
read at the one lethal-contact site, so nothing downstream fires: no shield is
spent, no pip moves, no popup. The shard keeps travelling and passes through
you, which is how you can tell it is on without a line of HUD claiming it.
Switch it off and the lab is the real game with one orb in it — which is the
only way to find out what taking that orb is worth. Because a ghosted run
cannot end by itself, there is a door in the top-left of the arena (and
Escape) back to the picker.

### Nothing a lab session does reaches the device

No score becomes a best, no
level record moves, the run count does not advance, the struggle streak that
lengthens future openings is not fed, and no first-encounter lesson is spent —
that last one matters more than it sounds, because *taking* a musical orb
normally counts as having been taught it, so one unguarded black hole session
would have permanently retired the black hole's lesson on a device that had
never met one. Nor does hopping in the lab count as having hopped: `hop()`
persists a lifetime flag that gates the once-ever first-hop rehearsal, so a
fresh player who opened the lab and swiped would otherwise have met the real
second ring with the game's tutorial for its hardest gesture already spent. There is no share button on a lab death: the share text has no
room to say any of the above, and a boast the game knows to be false should not
be one tap away. Telemetry is suppressed rather than tagged — a lab run cannot
reach the funnel at all, and one event records that the lab was opened and with
which orb. `smoke.mjs` snapshots `localStorage` across a whole lab session and
fails if one key changes.
