# The sky, the journey, and why orbits buy it

**What this answers:** why the backdrop is structured as a per-world weight set
bought with orbits, and the measured failures that produced each rule.

## Two complaints that turned out to be one problem

Owner, verbatim: the backgrounds are *"too similar, not lively enough, not fun and
exciting, not integrated with gameplay"* — and separately, *"many people have
complained they didnt even know they were supposed to do orbits."*

**Diagnosis for the first:** `SKY_BANDS` only ever changed the sky's *palette*.
The geometry underneath — two-level domain-warped fBm, ridged dust, three star
layers, one vignette — was identical in all four bands, and the recolour was gated
on ladder milestones most runs never reach. There were also no *events* anywhere
in the backdrop: every layer was a continuous field multiplied by a gain, **and a
gain is not an event.** Nothing ever arrived, crossed, or left. The gameplay
coupling that existed was all gain too — brightness up, hue walk, a small ripple —
precisely the kind of change a player never notices they caused.

Measured: the luminance fields correlated at **r = 0.97** between DRIFT and
DUSTLANE, 0.94 between EMBERFALL and DUSTLANE, mean 0.77 across all fifteen pairs,
off the shader's own `readPixels` averaged over a full drift orbit. **One picture
wearing six palettes.**

Two structural causes: the coverage gate `covA`/`covB` was sampled at fixed
frequencies with fixed offsets for every row, so `cov` scaled only *how much* gate
and never *where* it opened — a world could change its surface and not its
silhouette; and `f`, `f2` and `rg` were sampled at one frequency for every world,
so six worlds shared the scale of every structure inside them. Both are per-world
now. Measured after: **max pair 0.65, mean 0.21**, edge/middle brightness ratio
**1.05×** (from 2.76×).

## A world is a set of weights over structures the shader already computes

The trick is borrowed from the pocket's crystallize, where `ridged()` had already
been paid for by the dust lanes so re-entering it as *light* cost nothing. Four
structures are recovered from fields the chain evaluates anyway: soft **billows**,
large-scale **mass**, **contours** (`sin()` of a scalar field is a level set, and
level sets of fBm are curtains, so an aurora world costs zero noise evaluations)
and the **filament** network (the ridged field as light).

`WORLDS` (runtime.js:276-300) carries eight, in journey order: DRIFT, TIDE,
DUSTLANE, GLASS, EMBERFALL, VEIL, GRID, DEEPFIELD — each with its own dust depth,
void, star gain, `motion` temperament (0.60–1.30) and palette.

**The weights are lerped on the CPU**, so the shader never branches on a world and
never evaluates two. A transition is filaments dissolving into billows rather than
a crossfade between two pictures. A world is *held* for the first four fifths of
its span and morphs over the last fifth — interpolating the whole way would mean
the sky is never actually anywhere, which is the failure mode of every crossfade.

## Orbits buy the journey

`ORB_PER_WORLD = 7, ORB_WORLD_SECS = 150` (runtime.js:314). Every completed lap
buys a seventh of the way to the next world; a slow trickle underneath (one world
per 150s of any play) means a struggling player is never parked, and is
deliberately far slower than the orbit route — *the point is that orbiting is how
you travel, not one of two ways.*

This is the answer to the discoverability complaint. The arena has carried a lap
arc for a long time and it did not teach, **because it is three pixels of stroke
at the exact radius the player is scanning for shards.** The lap is now drawn
where there is nothing else to look at: the wedge of sky *behind* the comet lifts
as you sweep it and closes as the orbit completes. And turning around takes it
back visibly — a reverse zeroes the streak, the spin's target rate collapses and
flips, and the sky spends a couple of seconds stalling and unwinding. *The cost of
a reverse used to be a number in the corner; it is now the motion of the entire
screen.*

## Four of the six worlds were content nobody ever saw

Two one-line bugs made the journey unreachable:

- **`reverse()` zeroed `G.lapAcc`.** Reversing is the game's *primary verb*, so a
  player who taps never completes a lap and therefore never travels. Measured
  across seeded runs: never reversing — the upper bound — reached world 2 of 6;
  reversing every three seconds reached world 1 and stayed, because a lap needs
  ~4.5s at opening speed and the reset beat it every time.
- **`startGame()` zeroed `G.skyW`,** and it runs on every *level advance*. A
  player climbing to level 4 had the sky sent back to DRIFT three times on the
  way. Measured before the fix: 120s of never reversing bought 27 orbits — 3.86
  worlds of travel — and delivered **0.83**, the trickle and nothing else.

The journey now survives a level boundary, gated on `carried` — the same signal
the black hole's once-per-run guarantee uses (runtime.js:6117-6128). Measured
after, over 120s: **2.27 worlds/min never reversing, 1.18 reversing every three
seconds** (which previously earned nothing but the trickle), 0.84 every six.

The *scoring* lap still resets on a reversal — the streak and its additive bonus
(up to +28; deliberately not a multiplier and never printed as ×N) are the price
of turning around, and gates exist to charge it. What is banked is the **distance
actually covered**, the one quantity here that is simply true.

## `LEVEL_HOME` has to climb, and it did not

`LEVEL_HOME` (runtime.js:336) floors each level's opening world, and a floor is a
`Math.max` against a journey that never runs backwards — **so a table that dips is
a table with dead entries.** It read `[0,1,5,3,2,7]`: level 3 floored the sky at
world 5, and levels 4 and 5 then asked for 3 and 2, both already behind. In a real
run from level 1 nobody ever saw either level's home. *It only looked right from
the level select, which starts with `skyW` at 0 — which is exactly how it was
screenshotted when it was written.*

`[0,1,2,3,4,7]` climbs. The freedom left over was spent on making the names agree:
THE STORM opens on DUSTLANE, EVENT HORIZON on GLASS, REDSHIFT on EMBERFALL (it had
been handed the *cold* one), HEAT DEATH on DEEP FIELD.

**VEIL cannot move, and that is measured.** It is GRID's bright neighbour. With
VEIL relocated to position 2, `DUSTLANE>GRID@0.25` swept to mean 0.0897, under
fxcheck's 0.105 floor. GRID's own gain is not the lever: at 1.15 that blend came up
only to 0.0970 while `GRID>DEEPFIELD@0.25` overshot the ceiling at 0.3300; at 1.40
four samples left the band. GRID is a dim world by construction and lives on its
neighbours. So VEIL and GRID are the two worlds you travel *through* rather than
open on.

## The sky provably cannot go black

The coverage gate was sampled at `uv*0.75` for every world — a phone screen spans
about a *quarter of one coverage cell*, so the whole sky rode one wandering sample.
The drift clock (`G.vt`) never resets, and as a straight line it eventually parked
that sample in barren stretches: **whole-screen nebula blackouts lasting 10+
minutes, the first inside the first quarter hour of page life, with the stars
alive** — which reads as the game being broken. Latent since the shader's first
day; found from two same-build screenshots taken four hours apart, one vivid and
one black, and confirmed by a numeric port of the chain (mean luminance 0.0000).

The drift is an **ellipse** at the same tangential speed — one lap is every drift
the game can ever show — and the gate is **floored** at `0.10 + 0.90*smoothstep`.
Because the reachable skies are a closed set, `fxcheck.mjs` sweeps the entire orbit
through a line-for-line port with the constants **parsed from the shader**, so a
retune retunes the check.

## Changing what the guard measures

Getting the per-world fields past the brightness guard required changing the
metric, and that is the part worth reading. "Never goes milky" was measured as
*does the frame average ever get dark* — which is the same question as *is there
darkness on screen* only while the coverage gate is a global dimmer. Raise the
frequency and the questions come apart: the gate varies *within* the frame, voids
and filaments coexist, the average sits mid, and a frame carrying **more** real
black than the shipped sky gets failed for never resting.

| at the darkest station | frame-mean | p10 | p90 |
|---|---|---|---|
| DRIFT (shipped) | 0.041 | **0.005** | 0.108 |
| VEIL, per-world field | 0.129 | **0.039** | 0.315 |
| a deliberately milky sky | 0.212 | **0.066** | 0.425 |

The darkest **decile** separates them; the average does not. (Spread was the first
guess and the measurement killed it — the milky sky had the widest spread.) The
guard asserts real light (`p90 >= 0.055`) and real black (`p10 <= 0.045`) at the
darkest station.

## Contrast behind the rings, not hue

The ban on the red family in the sky was **lifted** — the owner's call, against a
stated risk to the "red means danger" contract. What replaced it is narrower and
sits where the contract is actually read: `SKY_ARENA_CALM` compresses contrast in
the annulus the orbits occupy, so a world can burn at the rim while the band a
shard is read against stays quiet. **Hue is free; contrast directly behind the
rings is not.** Current value 0.62 (runtime.js:339); the historical retreat values
0.34 and 0.10 appear in the design record as history.
