# How a formation actually reaches the board

*What this answers: the path from "the clock crossed a tier" to "a shape is
standing on a ring" — the insist loop, the weighted pool, the exclusions, the
clearance rules, and why raising the shard cap buys nothing.*

Code: `pickType` (`src/game/runtime.js:4818-4925`), `spawnSpike`
(`5635-5820`), `behindPad` / `farFromAll` (`5323-5339`), `shardCap` /
`spawnGap` (`4478-4538`). Prose: `docs/design/difficulty.md`, "The back half
could not escalate, and density was not the reason".

## Step 1 — the insist loop

Before any pool is built, `pickType` walks `TIERS[0..top]` looking for the
lowest unlocked type whose lesson has not landed (`!G.seen[ty]`). If it finds
one, **that type is the next spawn**, unconditionally — banner first (the newest
rung gets a 4-second head start via `G.t - G.featT < 4`), then specimen after
specimen until `firstMeet` finds a calm beat. Density is untouched: same spawn,
different shape. Veterans never enter this loop because they have seen
everything. `tools/curriculum.mjs:232-238` plays a whole climb headlessly and
fails the build if any of
`single, twin, gate, drift, blink, driftgate, saucer, blinktwin, dive, funnel,
spot, hyper, mirror, scorch, slip, trail` is unlearned at the frontier.

## Step 2 — the exclusions

The same five preconditions are applied twice — once in the insist loop and once
in the pool loop — by an existing convention the code comments on explicitly
(*"a precondition added to one and not the other lets the insist path spawn what
the pool path refuses"*):

| rule | condition |
|---|---|
| a hop needs somewhere to go | `twin`/`blinktwin` skipped when `G.nRings < 2` |
| a dive needs a destination, a funnel needs a lane | `dive`/`funnel` skipped when `G.nRings < 2` |
| **one wall at a time** | `gate`/`driftgate`/`funnel` skipped if any live spike has `s.gate` |
| **no gate beside a saucer** | `gate`/`driftgate`/`funnel` skipped if any live spike has `s.saucer`; `saucer` skipped unless `saucerOK()` |
| **twins may not own the board** | `twin`/`blinktwin` skipped when `dl() >= 340` and four or more live spikes carry `tw` |

The gate/saucer exclusion is a *meaning* rule, not a placement one: the gate
exists to force a reversal and the saucer exists to price one, so the pair could
demand a move and punish it in the same breath. There is no position that makes
them compatible.

The twin ceiling is explicitly gated at `dl() >= 340` — level 4's floor —
because an ungated version measured a 9% rise in level 3's board complexity. Two
live pairs is the cap; a twin places two shards from one clear spot, which makes
it the cheapest formation to fit on a crowded board and then consumes twice the
capacity, so without a ceiling it feeds itself (62–65% of everything standing on
levels 5 and 6, against 44% on level 3).

## Step 3 — the weighted pool

```js
const hb = Math.max(0, Math.min(1, (dl()-340)/560));
const w  = 1 + Math.round(hb * (SHAPE_RANK[ty]||0) * 1.5);
for (let q=0; q<w; q++) pool.push(ty);
if (k===feat && G.t-G.featT > 18) pool.push(ty, ty);
```

`hb` is exactly 0 below dl 340 and 1 by dl 900, so **levels 1–3 are untouched by
construction**: every weight is 1, which is the flat pool the game always had.
`SHAPE_RANK` (`src/game/runtime.js:4768-4769`) ranks by how many independent
facts the player must read: `single 0`, `twin 1`, `gate/drift/blink 2`,
`dive 3`, `driftgate/blinktwin/saucer/funnel 4`.

The featured-tripling adds two extra copies of the newest shape, but only after
it has been on the ladder ~18 seconds — *you meet one drifter before you meet
three*. `featuredTier(top)` (`src/game/runtime.js:4814-4817`) walks **back** from
the current rung to the last one that carries a `type`, because three of the
thirteen rungs announce a ring or the exam: keying on `top` directly meant
crossing THIRD RING dropped gates from 60% of the pool to 33%, a banner
celebrating a new ring that also made the board easier.

## Step 4 — placement

`spawnSpike` gets 18 attempts. Two clearances are in play and they behave
differently:

- **Player clearance** `clear = age()<26 ? 1.5 : 1.1` radians. This is the
  reaction-time guarantee — nothing materialises inside your stopping distance —
  and it **never relaxes**. Gates and funnels use a fixed 1.7 instead (2.2 for a
  funnel's open lane).
- **Shard- and star-separation** `sep(ring, k) = k * hitTol(ring)`, where
  `hitTol(ring) = 18.5*u / radiusOf(ring)` (`src/game/runtime.js:5316-5317`) —
  so an inner ring costs more angle per shard. Spikes use `sep(ring, 3.5*relax)`,
  stars and orbs `sep(ring, 2.5*relax)`, with
  `relax = 1 - 0.45*(i/17)` across the attempt sequence: full spacing on the
  first tries, ~55% of it on the last.

The relaxation exists because the interesting shapes could not place at all on a
busy board — a gate needs every ring clear at one angle, a funnel that plus a
wider gap in its open lane, a diver two rings clear — so all 18 attempts failed
and the game quietly served another twin. Measured live-board mean shape rank
before: 1.39 on level 3, 1.72 on level 4, **1.33 on level 5**, 1.51 on level 6.
After: 1.42 · 1.71 · 1.79 · 1.68.

## The heading-aware bubble

`farFromAll(a, ring, minP, minSpike, minStar, behind)` takes an optional
`behind` argument. When it is positive the player term becomes a **signed
distance along the heading**: the full `minP` ahead, and only `behind` radians of
pad astern. `behindPad()` returns `max(BEHIND_MIN, 0.16*G.speed)` with
`BEHIND_MIN = 0.45` — a *time* (0.16s of travel) floored at an angle, so the
guarantee cannot shrink as the game speeds up.

Two carve-outs:

- **Gates are exempt.** `behindPad()` returns 0 while any live spike carries
  `s.gate`, making the bubble symmetric again, because `reverseEscape` vetted
  the reversal arc at spawn time and a later spawn behind the player would
  invalidate it.
- **Rewards keep the symmetric bubble.** Stars and orbs call `farFromAll`
  without the `behind` argument, so the arc behind a stationary player gets
  colder, not richer.

Measured effect (`MECHANICS.md`): an immortal camper bot on level 4 survived 5/5
five-minute runs before the heading-aware rule and 3/5 after; a travelling bot's
median survival moved 54.4s → 52.4s, inside the harness's noise; mean board
density 9.1 → 8.8.

## Why density is not the lever any more

`shardCap()` (`src/game/runtime.js:4504-4537`) steps
1/2/3/4/5/6/7/8/9/10/11/12/13/14/15 at dl
8/20/32/55/120/200/270/340/445/575/650/780/920/1080.
`spawnGap()` (`src/game/runtime.js:4539-4564`) is
`max( max(0.50, 0.80 - max(0,d-340)*0.00048), 2.6 - d*0.005 )`; the two terms
cross at dl 362, so every value below that is bit-identical to what shipped.

Extending both curves *barely moved anything*: measured over 100s of play per
level, mean live shards 8.42 on level 4, 9.19 on level 5, 9.23 on level 6 — a
10% rise across two whole levels. The board is already as full as placement will
let it be. **The axis that was left is the mix**, which is what the `SHAPE_RANK`
weighting and the twin ceiling are for.

The 9→10 and 10→11 cap steps were deliberately moved off the lesson windows —
from dl 420/540 to 445/575 — because 420 and 540 sat 25 and 20
difficulty-seconds after the DIVERS (395) and NARROWS (520) banners, putting a
density step in the middle of each new formation's own introduction.

## The telegraph

`warnTime()` (`src/game/runtime.js:4483-4502`):

```js
const examDl = LV[LEVEL_MAX-2].end;   // the endless level's floor: dl 610
return MD().warn * Math.max(0.86,
         Math.min(Math.max(1.0, 2.35 - d*0.0042), 1.0 - (d-examDl)*0.00078));
```

Two ramps: 2.35s early easing to 1.00s, then held flat until the endless level's
floor, then eased to 0.86 over its first three minutes. `examDl` is **derived
from `LV`**, not written as a literal — the previous version ran dl 460–640 and
put 78% of the telegraph decay inside REDSHIFT, a teaching level, while HEAT
DEATH got a flat tail. 0.86s is still about three radians of travel between
arming and lethal.
