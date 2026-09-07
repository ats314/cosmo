# The bugs that shipped more than once

*What this answers: which specific mistakes this codebase has made repeatedly,
what shape they share, and which guard now stands where reading failed.*

`docs/README.md` says several invariants "describe bugs that shipped three
times". These are those. Each one is a class, not an incident — the reason it
recurred is that the code and its comment were both true under some reading, so
review could not catch it.

## 1. Silencing the scheduler is not silencing the band

**Shipped wrong at least three times.** `BED` is a bank of eight continuously
running oscillators and `bedTick` is the **only writer** of `BED.g`. Any feature
that changes what is scheduled in `musicStep` and touches nothing in `bedTick`
gets a busier or emptier arrangement over a pad sitting at exactly the level it
was.

- **The drop's hush.** `musicStep`'s `if(hush) return` stopped scheduling notes
  and the pad played straight through, filling the silence completely. Measured
  on the shipped build the "hush" was **−0.1 dB** against an ordinary bar, and
  the drop then landed **+2.9 dB** on a phone speaker — barely the threshold at
  which a human notices a level change. The fix was not turning the drop up
  (peak was already 0.97); it was taking everything else away first.
- **The black hole.** The mode replaced the arrangement and `bedTick` knew
  nothing about it, so the level's own progression sustained through the entry
  at full level: **54% of the mix identical either side**. Same bug, never
  generalised.
- **The hypernova star run.** The inverse case — the star should sound *bigger*,
  not quieter — and it fails identically, because scheduling extra voices alone
  cannot make a band louder.

`musiccheck.mjs:1319` is the guard, and its comment names this as *"the one that
has shipped wrong twice"*: it samples `BED.g.gain.value` with `G.hyper` at 0 and
at 99 and fails unless the pad actually lifts. **Anything that replaces or
augments the arrangement must write `BED.g` explicitly.** Pause does too — see
`MECHANICS.md`'s pause table: freezing `update()` does not silence the pad, it
*freezes* it, droning one chord at playing volume for as long as the panel is
up.

## 2. The direction inversion in the black hole

**Three times, in the same subsystem, for the same reason.** Ring index 0 is the
**outermost** orbit; increasing the index moves inward. Code and comment can
both be true under opposite readings of which way the number counts.

- **The gravity pull ran backwards.** `G.ringI--` with a `G.ringI > 0` guard
  walked the comet *outward* to the widest, safest, emptiest ring and then
  stopped there forever, while the comment said it dragged the comet inward.
- **The "inner ring pays 2×" bonus paid on the outer ring.** Both systems that
  exist to price risk paid for avoiding it.
- **The GPU lens.** The composite pass is *inverse* sampling — reading from a
  smaller radius magnifies — so subtracting the pull shoves every halo *away*
  from the singularity. It shipped at the right magnitude with a comment above
  it promising the opposite: measured **+6.8 px and +8.8 px** where the comment
  claimed the reverse.

Reading cannot catch this, so both guards ask where a thing *ends up*, in
numbers. `smoke.mjs:507` parks the comet on the outer ring, runs past a pull
interval and requires `radiusOf(G.ringI) < radiusOf(0)`; it also checks that
pull intervals are not banked at the innermost ring (they used to be, so the
next outward swipe was cancelled on the frame it landed). `fxcheck.mjs:381`
parses the lens coefficients straight out of the shader and asserts the
displacement is negative at 0.10/0.15/0.20/0.30 of screen height — currently
−6.2/−7.8/−8.6/−8.8 px.

## 3. A second source of truth for a position

**Twice, and the second time through a guard.** The magnetar gave an ember a
free radius in `s.pr`; several draw passes read `radiusOf(ring)` instead, so
glows detached from their embers — sixteen at once, up to 89 px apart on a
390 px screen. It was fixed with a `starR()` accessor and a build guard. It came
back through `WIDE PULL`, which put a free radius on *orbs*, a case the guard
never looked at. *A guard that covers the cases you thought of is not a guard
against the mistake you keep making.* `check.mjs:108` now forbids the second
radius existing at all, matched on an **operator** (`s.pr =`, `s.pr ===`, …) so
that a comment explaining the ban does not fail the build.

## 4. A ceiling written as a number instead of as a rule

**Twice, one level apart.** Every pressure term reached its floor or ceiling
about eighty seconds into the last level and stayed there: measured across
dl 340–1050, warn 1.00 flat, gap 0.80 flat, embers flat, shields flat, tier
flat, sky flat. That was diagnosed and fixed at dl 420 when level 4 was last —
and it recurred at dl 680 when level 6 became last, *because the fix had been
written as a number rather than as a rule*. The same defect produced a
telegraph-decay ramp anchored at dl 460–640, written when everything past dl 340
was the endless exam and never re-anchored when dl 470–610 became REDSHIFT, a
teaching level: **78% of the total telegraph decay landed inside the level that
introduces THE NARROWS.** `warnTime()` now reads its anchor out of `LV`
(`LV[LEVEL_MAX-2].end`) rather than a literal.

## 5. Two ladders printed side by side

**Twice.** `G.tier` is the unlock ladder, `G.level` is what the player is told.
The death screen printed `LEVEL 2` under a ten-pip bar filled to eight and
decided FURTHEST YET on the tier ladder, so a device whose record was level 3
could die on level 2 at a deeper tier and be congratulated. An earlier session
fixed the collision by renaming the *tier* (STORM → THE EYE), and it came back
one level later as `LEVEL 4 · FLICKER PAIRS` beside a card that said EVENT
HORIZON — because the defect was never the words, it was printing two ladders
and expecting the player to know which was which. `levelName()` feeds the
header, death screen and share text now; `tierLabel()` speaks only in telemetry.

## 6. A lesson that names a manoeuvre the game does not have

**Three wordings, two of them "fixed" against the wrong criterion.** The twin
lesson invoked *outrunning* (one fixed speed), then *fitting through the gap*
(38 visible pixels on the outer ring). Both fixes were about whether the claim
was *accurate*. Owner, on the shipped build: *"it makes no sense and I'm not
getting the feeling you actually understand why."* The real fault is that this
game has **no aimed movement** — a fixed circle, a fixed speed, two verbs — so a
sentence about the space between two objects describes something the player was
never trying to do. `CLAUDE.md`'s rule is generalised to match: a lesson may
only reference actions and objects the game actually has. Checking against the
code cannot catch this; the code will happily support a true statement about
something the player can never attempt.

## 7. A document that names a constant but not its current value

**Two constants, stale for two commits**: the nebula coverage gate described as
`0.42 + 0.58*smoothstep` with a ~95-minute drift lap, after the commit that
re-chose the orbit's territory made them 0.10/0.90 and ~24 minutes. Both
`docs/invariants.md` and `README.md` carried the stale pair.
`check.mjs:520` now walks every `.md` under `docs/` plus the root documents and
fails if a document *discusses* a constant without its current value appearing
in the same paragraph. **The check is for staleness, not agreement** — these
documents deliberately quote old values as history — and it walks the tree
rather than holding a filename list, because the previous list-based version
stopped covering almost everything the day `README.md` was split into
`docs/design/` and `docs/engine/`.

## 8. Thirteen features present in the source and none of them reachable

Not a repeat, but the canonical example of why measurement outranks reading. The
black hole shipped with thirteen documented sub-features and a playtester who
had run it many times could perceive one ("some purple color"). Every one was in
the source and each read correctly at its own site; each was disabled by
something somewhere else — the arena art gated on WebGL having *failed*, a
shader lens that inverted the UV field, `pow()` with a negative base (undefined
in GLSL ES), terms measured from the screen centre 41.8 px off the arena centre,
a density divisor drained on the *slowed* clock so the mode measured **0.83×**
the pressure of the level it interrupted, a rare roll sitting below seven
guaranteed placements so it first became reachable one second after the median
level-3 run had ended. The clause-by-clause table is in `MECHANICS.md`.
