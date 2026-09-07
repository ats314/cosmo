# Every hazard formation, as the code builds it

*What this answers: for each of the ten spawnable shapes — what flags it sets,
what it does per frame, how long it lives, what the placement loop demands of it,
and the one sentence the game teaches it with.*

Source of record: `const TIERS` (`src/game/runtime.js:4652-4738`), `pickType`
(`4792-4899`), `spawnSpike` (`5635-5820`), `updateSpikes` (`7522-`) and
`const MEET` (`5438-5559`). Every number was read there in this session.

## There are ten shapes and thirteen rungs

`TIERS` has thirteen entries; three of them (`SECOND RING`, `THIRD RING`,
`THE EYE`) carry `type:null` and introduce no shape. The remaining ten are the
whole hazard inventory. A shape is never a class — it is a set of independent
boolean flags on one `spike` object, which is why the two "compounds" cost a
spawn branch and nothing else.

| dl | tier name | `type` | rank |
|---|---|---|---|
| 0 | (unnamed) | `single` | 0 |
| 12 | SECOND RING | — (`rings:2`) | — |
| 18 | TWIN SHARDS | `twin` | 1 |
| 40 | THIRD RING | — (`rings:3`) | — |
| 100 | GATES | `gate` | 2 |
| 128 | DRIFTERS | `drift` | 2 |
| 165 | SHUTTERS | `blink` | 2 |
| 240 | SLIDING GATES | `driftgate` | 4 |
| 275 | THE SAUCER | `saucer` | 4 |
| 310 | SHUTTER PAIRS | `blinktwin` | 4 |
| 395 | DIVERS | `dive` | 3 |
| 520 | THE NARROWS | `funnel` | 4 |
| 610 | THE EYE | — | — |

`rank` is `SHAPE_RANK` (`src/game/runtime.js:4768-4769`), used only by the late
weighting in `pickType`.

## The shard record

`mkSpike(a, ring, extra)` (`src/game/runtime.js:5378-5393`) builds every one:

```js
{a, ring, t:0, phase:0, bt:0, bo:0, va:0, gate:false, blink:false,
 warn:warnTime(), life:rand(2.6,4.4)*(age()<30?0.7:1)}
```

then `extra` overwrites. `phase` 0 is the telegraph, 1 is lethal, 2 is fading
(`FADE = 0.4` s, harmless — `src/game/runtime.js:4393`). The warn is then
stretched by up to one eighth note so the instant a shard arms lands on a beat
subdivision.

**A type's first specimens telegraph 1.6×.** Every branch computes
`G.seen[type] ? {} : {warn: warnTime()*1.6}` *before* `firstMeet(type)` stamps
the seen bit, so the shard teaches alongside the sentence even when the lesson
was deferred for calm.

## The shapes

### `single` — plain shard (dl 0)

`G.spikes.push(mkSpike(a, ring, {spot: ...}))` and nothing else
(`src/game/runtime.js:5850`). Default life `rand(2.6,4.4)`, halved to ×0.7 in
the first 30 seconds of a run. Lesson: *"Red hits cost a shield; tap to turn or
swipe rings"*.

### `twin` — TWIN SHARDS (dl 18)

Two shards on one ring, `off = rand(0.30,0.40)` radians apart with a random
sign, life `rand(2.4,3.6)`, both stamped `tw:'twin'`
(`src/game/runtime.js:5796-5821`). Both halves must independently pass
`farFromAll` with the heading-aware clearance, or the pair could straddle the
comet. The `tw` stamp exists so a death reports the *formation* rather than
`single` — without it the death coach went silent for the shape that forces the
unfamiliar verb. Requires `G.nRings >= 2`. Lesson: *"Two red obstacles: swipe to
another ring"*.

### `gate` — GATES (dl 100)

The same angle blocked on **every** ring, so hopping cannot save you; the answer
is a tap. Life `rand(1.9,2.9)`, one `mkSpike` per ring with `gate:true`
(`src/game/runtime.js:5775-5795`). Two placement demands beyond the usual:
`angDist(a, G.angle) < 1.7` rejects the angle outright, and every ring must pass
`farFromAll(a, k, 1.7, ...)`. And before the loop runs at all,
`reverseEscape(GATE_ESCAPE)` with `GATE_ESCAPE = 1.1` must find at least one
ring with 1.1 rad of clear run along the *post-reversal* heading — otherwise the
formation is downgraded to a `single` (`src/game/runtime.js:5672`). Lesson:
*"A wall blocks every ring; tap to turn around"*.

### `drift` — DRIFTERS (dl 128)

One shard with `va = rand(0.24,0.5)` rad/s and a random sign, life
`rand(3.4,5.2)` (`src/game/runtime.js:5825-5831`). `updateSpikes` advances
`s.a += s.va*sdt` every frame. It never steers and never exceeds player speed.
Lesson: *"This red obstacle moves; tap to turn away"*.

### `blink` — SHUTTERS (dl 165)

`blink:true`, life `rand(4.0,6.0)` (`src/game/runtime.js:5832-5836`). The cycle
is `BLINK = SPB*2` — exactly two beats — and a lone shutter runs at
`BDUTY = 0.55`, so it is armed for 55% of each cycle
(`src/game/runtime.js:7542-7555`). `armed(s)` returns
`blinkPhase(s) < BLINK*duty(s)`; `blinkPhase` is `(s.bt + s.bo) % BLINK`, and
`bt` restarts at 0 the moment the shard arms so a pair cannot be staggered by
seeding it. Lesson: *"Pass through the open shape; avoid solid red"*.

The read is **geometry, not opacity**. `artifactShard`
(`src/game/runtime.js:8947-8972`) blits the ordinary solid shard sprite while
`armed(s)`, and while open draws four blades at a constant `globalAlpha` of
0.78 whose inner radius closes as the cycle runs out — a watchable countdown
rather than a fade. Shutters are also the one shard type excluded from the
bloom halo pass (`src/game/runtime.js:9187-9193`), so danger is never signalled
by a toggled glow. This shape was called **BLINKERS** until the effects pass;
the type key is still `blink`.

### `driftgate` — SLIDING GATES (dl 240), compound

A `gate` whose every segment carries the **same** `va = rand(0.18,0.34)` with a
random sign (`src/game/runtime.js:5787`). Same `va` on every segment is
load-bearing: the connecting bar is drawn from ring 0's angle, so unequal drift
would shear the rung off the wall. The drift range is deliberately narrower than
a plain drifter's — a sliding wall should crowd the exit, not chase you down.
Shares every gate precondition including `reverseEscape`. Lesson: *"The wall
moves; tap to turn before it reaches you"*.

### `saucer` — THE SAUCER (dl 275)

The only shape placed against the **player** rather than the board, so it skips
the placement loop entirely (`src/game/runtime.js:5682-5699`). Constants
(`src/game/runtime.js:5422-5425`, `5402`):

- `SAUCER_LAG = 0.55` rad — where it holds station off the tail
- `SAUCER_CHG = SPB` — one beat of wind-up
- `SAUCER_BEAM = 0.42` s — how long the ring stays blocked
- `SAUCER_HOP = 0.42` s — how long it takes to follow a ring change
- `SAUCER_COOL = [9,15]` s — cooldown armed at spawn
- life `rand(5, 7.5)` s

`saucerOK()` requires `G.nRings >= 2`, `G.t >= G.sauT`, and **no live saucer and
no live gate on the board**. The state machine (`src/game/runtime.js:7585-7634`)
has three states and no easing: glued to the tail while `s.dir === s.sdir`;
frozen and charging once the player reverses (`s.a` untouched, `side` flipped so
its *world* angle is unchanged while the heading it is measured against
reverses); then firing. **The body is never solid — only the shot is**, so there
is no contact death. The charge cannot be cancelled by turning back again, and
it fires at the ring it is standing on, which is the ring you were on when you
turned. Lesson: *"Turning triggers its shot; swipe to another ring"*.

### `blinktwin` — SHUTTER PAIRS (dl 310), compound

A `twin` whose halves are both `blink:true` at `duty:0.5`, offset
`bo: BLINK*0.5` — exactly half a cycle — with a shared life `rand(4.4,6.2)`
(`src/game/runtime.js:5813-5818`). Duty 0.5 with a half-cycle offset is what
makes "only one is solid" literally true at every instant: at 0.55 duty both
sides were armed for 10% of every cycle, and the lesson was false exactly when a
player acted on it. `tools/smoke.mjs:365-373` walks a full period at 120 samples
and requires both-armed and neither-armed to be zero. Lesson: *"The shapes take
turns opening; pass through the open one"*. Called **FLICKER PAIRS** until the
effects pass; the type key is still `blinktwin`.

### `dive` — DIVERS (dl 395)

The only shard whose ring is not the ring it armed on. Spawned with
`{dive:1, diveTo:dto, life:rand(3.0,4.6)}`, where `dto` is an adjacent ring
chosen at random except at the edges (`src/game/runtime.js:5837-5849`). **Both**
the lane it leaves and the lane it lands in must pass the full clearance, and a
failure rejects the placement outright rather than downgrading it — an
unreadable arrival is neither fair nor survivable.

The transfer happens inside the telegraph, at
`s.t >= (s.warn||WARN) * 0.55` while still in `phase===0`
(`src/game/runtime.js:7570-7577`): `s.dive=2`, `s.ring=s.diveTo`, an arc-flash on
the **arrival** ring, and a note in the level's key. The remaining 45% of the
warn is the lesson. Requires `G.nRings >= 2`. Lesson: *"It moves to the marked
ring; swipe to another ring"*.

### `funnel` — THE NARROWS (dl 520)

A wall across every ring but one — the mirror of `gate`, answered by a hop
instead of a tap (`src/game/runtime.js:5749-5774`). The open lane is
`G.ringI + (edge ? inward/outward : random ±1)`: **adjacent to the comet's
current ring and never the ring it is already on**, so exactly one swipe answers
it and it can never be a wall that demands nothing. Life `rand(2.0,3.0)`.

Clearances are asymmetric: the open lane is held to **2.2 rad** of player
clearance against **1.7** for the walls, because a shard sitting in the only way
out turns the formation from a demand into a trap. It does **not** call
`reverseEscape` — the escape it guarantees is a lane, not an arc. Segments carry
`{gate:true, funnel:true, gap:open, bar:anchor}`; `bar` marks the one segment the
rung is drawn from, because a plain gate anchors on ring 0 and a funnel may not
have one.

The draw (`src/game/runtime.js:10919-10979`) builds contiguous runs of blocked
rings, ends each run halfway between the last blocked orbit and the open one so
the wall visibly runs *up to* the hole, and paints two comet-coloured brackets
opening into the gap on the beat. Lesson: *"Swipe to the ring with no wall"*.

## The three rungs with no shape

`SECOND RING` (dl 12, `rings:2`) and `THIRD RING` (dl 40, `rings:3`) raise
`G.nRings` when crossed, fire two expanding rings and a two-note cue, and — if
`G.nRings===2 && !G.didHop && !G.everHopped` — open the once-ever hop rehearsal
(`G.teach=8, G.teachKind='hop'`, `src/game/runtime.js:8210-8224`).

`THE EYE` (dl 610) has `type:null` and adds nothing at all. Its `at` sits exactly
on level 6's floor. `SECOND RING`'s sub is `subFn: swipeWords` — the only tier
whose sentence is computed, because it has to follow the active swipe rule.

## The death classification

`G.lastHit` is derived from the flags at the moment of contact
(`src/game/runtime.js:7700-7703`):

```js
s.saucer ? 'saucer'
: s.gate ? (s.funnel ? 'funnel' : (s.va ? 'driftgate' : 'gate'))
: (s.dive ? 'dive'
   : (s.tw ? s.tw : (s.blink ? 'blink' : (s.va ? 'drift' : 'single'))))
```

This is the string the death coach and the lesson re-arm read, which is why the
`tw` stamp and the `funnel` flag exist at all.
