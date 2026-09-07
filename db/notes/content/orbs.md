# The orb roster

*What this answers: for every power-up orb Cosmo ships — its internal id, its
player-facing name, its colour, its duration, its home level, how it is drawn,
and where its behaviour lives in `src/game/runtime.js`.*

Source of record: `const LAB_ORBS` at `src/game/runtime.js:3173-3184` (the
picker's table, and the list `tools/check.mjs` compares against `MECHANICS.md`),
the pickup chain at `src/game/runtime.js:8569-8722`, and the constants named
below. Every number here was read in those lines.

## Internal id is not the player-facing name

Three of the ten answer to a different word in code than on screen. This is the
single most expensive fact about this subsystem, because grepping the display
name finds nothing.

| Code id | On screen | Why the drift |
|---|---|---|
| `warp` | SLOW-MO | oldest orb; the id predates the name |
| `spot` | MAGNET | shipped as Spotlight, redesigned into Magnet; `spot`, `spotPlaced`, `spotGlow` and the `stagelight` upgrade id were all kept so existing saves keep working (`src/game/runtime.js:8626`) |
| `hyper` | HYPERNOVA | shortened id |

`shield`, `nova`, `mirror`, `scorch`, `slip`, `trail` and `blackhole` all match.

## The ten, at a glance

| id | Name | Colour (`COL`) | Duration | Upgraded | Home level |
|---|---|---|---|---|---|
| `shield` | SHIELD | `shield` `#7bffc8` | banked, not timed | DEEP BANK: +1 at run start | 1 (intro trio) |
| `warp` | SLOW-MO | `warp` `#b48bff` | 6 s | SLOW WORLD: 9 s | 1 (intro trio) |
| `nova` | NOVA | `nova` `#ffffff` | instant + 0.95 s grace | RICH NOVA: 2 stars per shard | 1 (intro trio) |
| `hyper` | HYPERNOVA | `hyper` `#ff4fd8` | 16 beats = 9.2308 s | LONGER STAR: 24 beats = 13.846 s | 2 (guaranteed) |
| `slip` | SLIPSTREAM | drawn in `comet` `#5df0ff` | 12 s | LONG SLIPSTREAM: 18 s | 2 (guaranteed, after hypernova) |
| `spot` | MAGNET | material violet-white; HUD uses `comet` | 10 s | LONG MAGNET (`stagelight`): 16 s | 3 (guaranteed) |
| `trail` | STAR TRAIL | drawn in `ember` `#ffc857` | 16 s route life | LONG STAR TRAIL: 24 s | 3 (guaranteed, after Magnet) |
| `mirror` | THE MIRROR | `mirror` `#4d8cff` | 16 beats = 9.2308 s | LONG MIRROR: 24 beats = 13.846 s | 4 (guaranteed) |
| `scorch` | SCORCH | `scorch` `#ff8a2b` | 8 s of paint | DEEP BURN: 13 s | 5 (guaranteed) |
| `blackhole` | BLACK HOLE | `bh` `#8f5cff` | 17 s mode | none | 4 (guaranteed *offer*), 5 % roll from 3 |

`COL` is at `src/game/runtime.js:119-133`. Beat-measured durations use
`SPB = 60/104 = 0.5769230769230769 s` (`src/game/runtime.js:858`), so sixteen
beats is 9.2308 s and twenty-four is 13.8462 s — which is why the two "LONG"
tiles say *about 14 seconds* rather than a round number.

## What each one actually does

**SHIELD** (`src/game/runtime.js:8569-8608`). Banked. `shieldMax()`
(`src/game/runtime.js:4902`) is 3 below dl 160, 4 below dl 320, 5 after. Every
run starts with `2 + (DEEP BANK ? 1 : 0) + MODES.shields`
(`src/game/runtime.js:6199`). A hit spends one, grants 0.9 s invulnerability and
knocks you off the orbit but does **not** clear `lapAcc`/`lapStreak`
(`src/game/runtime.js:7632-7645`). Picking one up at a full bank pays a flat
`+50` instead (`src/game/runtime.js:8578-8579`). Filling the bank opens
overcharge: `cueState(true)` and, only once the red lesson has landed
(`G.seen.single`), the line "Shields full: stars now score double"
(`src/game/runtime.js:8601-8602`).

**SLOW-MO** (`src/game/runtime.js:8618-8624`). `G.slow = 9` with SLOW WORLD else
`6`. The dilation itself rides `G.tsCur` and the presentation clock `G.vt`, so
the whole visible world slows, not just the simulation.

**NOVA** (`src/game/runtime.js:8697-8722`, the final `else` of the pickup
chain — it names itself nowhere, which is why a static "one branch per orb id"
scan cannot find it). `novaBlast` (`src/game/runtime.js:5188-5191`) pushes one
expanding front carrying `targets: G.spikes.slice()` — a snapshot, so threats
that spawn after the blast are not silently erased. Front speed is
`max(560*u, (2*R + 60*u)/0.62)`, i.e. the tuned phone number or whatever clears
the ring system in 0.62 s, whichever is faster. Each contact runs `novaConvert`
(`src/game/runtime.js:5202-5248`), which lands the ember **on the player's
current ring** at the shard's angle, stepping `0.36` rad along the lane until it
has `0.30` rad of clearance so a converted wall reads as a necklace rather than
a pile. Pickup grants `G.invuln = G.t + 0.95`.

**HYPERNOVA** (`src/game/runtime.js:8681-8696`). `G.hyperD = SPB * (LONGER STAR ?
24 : 16)`. Speed is `speedAt() * (1 + 0.9*hv)` where
`hv = min(1, (hyperD-hyper)/0.35, hyper/1.4)` (`src/game/runtime.js:8137-8138`) —
a 0.35 s ease in, a 1.4 s ease out, peak +90 %. Armed red met while it burns is
routed straight into `novaConvert` instead of the shield branch
(`src/game/runtime.js:7623-7631`), so a lane of shards plays the cascade's
ascending sixteenth run. When it reaches zero it grants `G.t + 1.2` of grace
(`src/game/runtime.js:8063-8068`). Stars pay double while it runs
(`src/game/runtime.js:8450`).

**MAGNET** (`src/game/runtime.js:8625-8637`, field at
`src/game/runtime.js:5099-5128`). `MAGNET_RANGE = 110` scale units,
`MAGNET_SECS = 10`, `MAGNET_FLIGHT = 0.38 s`. Captures only stars — never
shards — on the current or an adjacent ring (`Math.abs(s.ring - effRing()) <= 1`),
flies them along a quadratic Bézier whose control point is bent
`min(22, d*0.28)` perpendicular to the line of flight, and extends the star's
own life so it survives the trip. `starVisualPos` is authoritative for contact,
crystal, bloom and route links. `updateMagnetStar` returns immediately while
`bhActive()`, so both attraction and captured lifetimes freeze inside a black
hole. There is **no** star or tap multiplier — the doubling branch at
`src/game/runtime.js:8450` lists overdrive, hypernova and a full shield bank
only.

**THE MIRROR** (`src/game/runtime.js:8638-8657`, collector at
`src/game/runtime.js:5884-5909`). `G.mirrorA = G.angle + Math.PI`, **derived
every frame**, never integrated — the reflection cannot drift and needs no
controller. It collects stars on the player's effective ring using the same
swept-arc test the player uses, pays `max(1, G.combo)` and **does not advance
the combo**. It skips `st.trail` and `st.mag` stars — the offered route and a
star already flying to the player belong to the player. Armed non-saucer shards
on that ring go through `novaConvert`. It cannot be hurt and does not protect
you.

**SCORCH** (`src/game/runtime.js:8658-8668`, paint at
`src/game/runtime.js:5910-5931`). `SCORCH_SECS = 8`, `BURN_SECT = 72`,
`BURN_LIFE = 2.6`. The wake is 72 sectors per ring in a `Float32Array`, four
rings allocated once per run (`src/game/runtime.js:6259-6260`) — sectors cannot
overlap or leak. Paint runs from `G.prevAngle` to the current angle in
`ceil(G.sweep/step)` samples, so nothing is skipped at 4.2 rad/s. Each sector's
lifetime is `max(BURN_LIFE, TAU/max(0.3, G.speed) + 0.2)` — **at least one full
orbit at the current speed**, stored in gameplay seconds, so slow motion
preserves the wake rather than erasing it. Any shard standing in or arming into
a burning sector is converted. Drawn under the shards
(`src/game/runtime.js:10631-10659`).

**SLIPSTREAM** (`src/game/runtime.js:8669-8675`, trigger at
`src/game/runtime.js:6933-6947`). `SLIP_SECS = 12`, `SLIP_ARC = 0.48` rad either
side of the landing angle, `SLIP_GRACE = 0.4 s`, `SLIP_COOL = 0.8 s`. It fires
inside `hop()` **after** the ring index has been committed, so only a successful
player hop counts: an invalid swipe returns before that point and black-hole
gravity moves `G.ringI` directly in `bhTick` without calling `hop()`. Saucers
are exempt. The grace is metered by `G.slipAt` so chained hops cannot become
continuous immunity.

**STAR TRAIL** (`src/game/runtime.js:8676-8680`, route at
`src/game/runtime.js:5867-5877`). `STAR_ROUTE_N = 9`, `STAR_ROUTE_SECS = 16`,
`STAR_ROUTE_BONUS = 4`. Stars are laid at `0.62 + i*0.62` rad ahead in the
current direction, alternating between the current ring and one adjacent ring.
Each pays the ordinary combo value **plus 4** (`src/game/runtime.js:8444`).
A later pickup filters out every existing `trail` star first, so routes replace
rather than accumulate. Red is not cleared.

**BLACK HOLE** — see `db/notes/content/black-hole.md`.

## Where the lessons live

Every orb except shield, slow-mo and nova has a first-encounter sentence in
`MEET` (`src/game/runtime.js:5500-5531`) and a `POW_LESSON` flag
(`src/game/runtime.js:5934-5935`). Shield, slow-mo and nova are taught by the
level-1 card, the hint ladder and their own `say()` line at pickup instead. All
six reward lessons carry `soft:1` — no time dilation, because dilation is
protection from threats and not ceremony for gifts. The black hole's lesson is
deliberately **not** soft: taking it starts a mode, and naming the trade is the
lesson.

`firstMeet` (`src/game/runtime.js:5560-5600`) defers rather than spends: it
returns without setting the seen bit while the lab is open, inside a black hole,
within 9 s of the last lesson, under a fresh banner, or during a hop rehearsal.
`spawnPow` calls it at placement and the per-frame orb loop
(`src/game/runtime.js:8545`) keeps re-offering it for as long as the orb is on
the board, so a deferred sentence is not lost with the orb.
