# Spawning: what arrives, and where it is allowed to stand

**What this answers:** how the game decides which formation to spawn and where,
and which of the many guards in `spawnSpike` are safety promises versus taste.

## Two independent decisions

**What** — `pickType()` (4792). **Where** — the retry loop in `spawnSpike()`
(5635). They are separate, and a formation that cannot be placed is *downgraded*
(gates and saucers become `'single'`) rather than skipped, so density does not
sag when variety fails.

## `pickType()`

`tierIndex()` (4744) gives the highest unlocked rung; `featuredTier(top)` (4788)
walks back to the last rung that actually carries a shape, so the two `type:null`
ring tiers do not accidentally un-feature the newest formation.

Then two passes:

1. **The insist loop** (4808–4842). While the newest unlocked shape's lesson has
   not landed (`!G.seen[ty]`), that shape *is* the next spawn. This is what makes
   the curriculum promise ("every formation is met and explained") true rather
   than a dice roll; `tools/curriculum.mjs` fails the build on a formation whose
   lesson never showed.
2. **The weighted pool** (4843–4900). Every unlocked shape enters with weight
   `1 + round(hb * SHAPE_RANK[ty] * 1.5)` where
   `hb = clamp((dl()-340)/560, 0, 1)`. `hb` is 0 at level 4's floor, so levels
   1–3 are untouched **by construction** — every weight is exactly 1 while `hb`
   is 0. The featured shape gets two extra entries once it has been on the ladder
   more than 18 s.

Both passes apply the same exclusions, duplicated deliberately (a precondition
added to one and not the other lets the insist path spawn what the pool refuses):

- `twin`/`blinktwin` need `G.nRings >= 2`, and past `dl() >= 340` are refused
  when four or more paired shards are already live. A twin places two shards
  from one clear spot, so it is the cheapest formation to fit on a crowded board
  and then consumes twice the capacity — a feedback loop that measured twins at
  62–65 % of everything standing on levels 5 and 6.
- `dive`/`funnel` need `G.nRings >= 2`.
- One wall at a time: `gate`, `driftgate` and `funnel` are all refused while any
  `s.gate` is live.
- `saucer` needs `saucerOK()` (5401): two or more rings, past `G.sauT`, and no
  other saucer or gate on the board.
- **A gate and a saucer may never share a board.** The gate exists to force a
  reversal and the saucer exists to make one cost something, so the pair is the
  only combination that can demand a move and punish it in the same breath. Held
  apart in the pool, not solved by placement, because no placement makes them
  compatible.

## `farFromAll(a, ring, minP, minSpike, minStar, behind)` (5327)

The clearance predicate. `minP` is the player clearance — the reaction-time
guarantee that nothing materialises inside the stopping distance. `minSpike` and
`minStar` are expressed as multiples of the hit width via `sep(ring, k)` (5283)
and `hitTol(ring) = (18.5*u)/radiusOf(ring)` (5282), so the clearance is correct
on every ring and every screen size: a shard blocks twice the angle on a ring of
half the radius.

`behind > 0` switches the player term from symmetric to **heading-aware**: the
full clearance ahead along the travel direction, and only `behindPad()` behind.
`BEHIND_MIN = 0.45` (5322); `behindPad()` (5323) returns
`max(BEHIND_MIN, 0.16 * G.speed)` — a time, not an angle, so the guarantee does
not shrink as the game speeds up. This closes the camping strategy: any
oscillation arc narrower than the old 1.1 rad bubble was provably unreachable by
every static formation, and a simulated camper cleared levels 1–3 inside a
30-degree arc.

`behindPad()` returns **0** while any gate segment is live and un-faded, which is
load-bearing: a gate exists to force a reversal, and `reverseEscape` (5406) has
already checked at spawn time that the reversal opens onto `GATE_ESCAPE = 1.1`
rad of clear run. A later spawn behind the player would invalidate that check.

## The relax loop

`spawnSpike` tries 18 placements with `relax = 1 - 0.45*(i/17)` (5678). The
shard-to-shard separation relaxes across the sequence — the last attempts accept
about 55 % of the full spacing. **The player clearance never relaxes.** This
exists because placement, not the pool, was starving the back half of variety:
measured mean shape rank was 1.33 on level 5 against 1.39 on level 3, while the
pool in isolation returns hard shapes 70 % of the time at `dl` 810+.

## Formations, in `spawnSpike` order

- `funnel` (THE NARROWS, 5714–5741): a wall on every ring except one adjacent to
  the player's. The open lane is held to a *wider* clearance (2.2 vs 1.7) — it is
  the only way out, so a shard in it turns a demand into a trap. `bar` marks the
  segment the drawn rung anchors on, because a funnel may not have ring 0.
- `gate` / `driftgate` (5742–5763): same angle on every ring. All segments share
  one `va` or the bar shears apart.
- `twin` / `blinktwin` (5764–5793): offset `rand(0.30,0.40)` with random sign;
  both halves take the heading-aware clearance. A `blinktwin` uses `duty: 0.5` and
  `bo: BLINK*0.5` so exactly one side is lethal at every instant — the lesson
  says "only one is solid at a time" and the promise has to be literally true.
  `tw` stamps the pairing on both shards so a twin death coaches the hop.
- `drift` (5795–5801): `va = rand(0.24,0.5)` signed, well under player speed.
- `blink` (5802–5806): lone blinker keeps `BDUTY = 0.55` (7519).
- `dive` (5807–5820): both the lane it leaves and the lane it lands in must be
  clear, or the placement is rejected outright. The transfer happens at 55 % of
  its own warn (7534–7541) so the player watches it move with time left to answer.
- `saucer` (5648–5661): skips the placement loop entirely — there is exactly one
  position it can take, `G.angle - G.dir*SAUCER_LAG` on the player's ring.
  `SAUCER_COOL = [9,15]` seconds keeps it a visitor rather than the weather.

Inside a black hole the type is forced to `single` or `drift` (5636) and the ring
draw leans one inward 45 % of the time (5698–5709), because the fourth ring would
otherwise make the mode *easier* by spreading the same shard budget over four
orbits.

## Warn quantization

`mkSpike` (5346) stretches `s.warn` by up to one eighth so the instant a shard
turns lethal lands on a beat subdivision. A type's first-ever specimen gets
`warnTime()*1.6`, computed **before** `firstMeet` stamps `seen`, so the shard
teaches alongside the sentence even when the lesson defers.

## Rewards use the old symmetric clearance

`spawnStar` (5340) and `spawnPow` (5936) pass no `behind` argument, so they keep
the symmetric bubble. Letting rewards fill in behind a stationary player would
hand the camper a reason to stay put — the arc behind you gets colder, not
richer.
