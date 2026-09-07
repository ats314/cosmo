# What the harnesses actually assert about each orb and each upgrade

*What this answers: for every orb and every upgrade tile, which harness proves
it works — and, more usefully, which ones nothing proves at all.*

Read this session against `tools/smoke.mjs`, `tools/dropcheck.mjs`,
`tools/curriculum.mjs`, `tools/musiccheck.mjs`, `tools/fxcheck.mjs`,
`tools/rendercheck.mjs` and `tools/check.mjs` at commit `01a3a25`. Harness line
numbers move often; the assertion *strings* quoted below are the stable handle.

## The four surfaces an orb can be checked on

1. **It gets placed** — `spawnPow` picks it, once, where the curriculum says.
2. **Taking it does something** — the pickup branch sets the state it claims.
3. **The state does the work** — the collector, the conversion, the timer.
4. **It is visible and audible** — a scene event, a HUD chip, a musical voice.

Almost nothing is checked on all four. The table is which of the four each orb
has.

| Orb | Placed | Pickup effect | The work | Seen/heard |
|---|---|---|---|---|
| shield | lab sweep only | **nothing** | ghost-off shard spends one (`smoke`) | — |
| slow-mo (`warp`) | lab sweep, curriculum | `G.slow` 6 → 9 (`smoke`) | dilation not asserted | scene event (`fxcheck`), band mix (`musiccheck`) |
| nova | lab sweep, curriculum | **nothing** | front converts originals, expiry erases nothing (`smoke`); opening blast clears the board (`dropcheck`) | scene event (`fxcheck`) |
| hypernova (`hyper`) | curriculum: placed by end of L2 | **nothing** | doubling branch incidentally (`smoke`, via the Magnet probe) | STARRUN degrees/density/silence in a black hole, `bedTick` pad lift (`musiccheck`); scene event (`fxcheck`); a rendered frame (`rendercheck`) |
| Magnet (`spot`) | curriculum: placed by end of L3 | `G.spot` 10 → 16 (`smoke`) | pull, no-hazard, BH freeze, ordinary collection, no doubling (`smoke`) | leaves the music mix unchanged (`musiccheck`); scene event; rendered frame |
| the mirror | curriculum | `G.mirror === 16*SPB` (`smoke`) | swept-arc collect, combo untouched, route left alone, ring timing (`smoke`) | two sparse voices per two bars (`musiccheck`); scene event |
| scorch | curriculum | **nothing** (duration not read back) | paints only ground travelled, converts exactly the wake, survives one orbit, fades after the reward (`smoke`) | four sparse voices per two bars (`musiccheck`); scene event |
| slipstream (`slip`) | curriculum; `G.slipPlaced` at the frontier | `G.slip` 12 → 18 (`smoke`) | destination-arc clear only, 0.4 s grace metered, invalid hop does nothing (`smoke`) | scene event |
| star trail (`trail`) | curriculum; `G.trailPlaced` at the frontier | route life 16 → 24 (`smoke`) | nine ordered alternating stars, replacement, reversed travel (`smoke`) | scene event |
| black hole | lab sweep; `curriculum` walks a run | **nothing** (`startBlackHole()` is called directly) | inner-ring bank, escape cash-out, missed deadline costs a shield, closure empties the vanished ring, suspension and resume (`smoke`) | phase music and mix (`musiccheck`); rendered frame (`rendercheck`) |

`fxcheck` proves one thing for eight of them at once: `scenePulse('<kind>',2.5)`
for `nova, hyper, spot, warp, mirror, scorch, slip, trail` each raises
`uAccent[0]` above 0.99 with a finite tint — so every orb pickup **can** own a
visible scene event. It does not check that the pickup path calls it.

`smoke`'s lab sweep is the broadest placement guarantee in the suite: it plays
**every `LAB_ORBS` row** for 45 seconds, requires at least two placements, and
requires that *only* that type was placed. Because the list is derived from
`LAB_ORBS`, a new orb inherits the test for free.

`curriculum` walks one run to the frontier and requires a reachable lesson for
`spot, hyper, mirror, scorch, slip, trail` (alongside the ten formations), plus
`hyperPlaced`/`slipPlaced` by the end of level 2 and `spotPlaced`/`trailPlaced`
by the end of level 3.

## What nothing checks

These are the gaps, in rough order of how much they would cost if they broke.

* **The shield-pity rule.** `G.sinceShield >= 3` is the promise that no player
  goes more than three placements without a shield, and it outranks the black
  hole's own roll. No harness reads `sinceShield`. Grep the whole `tools/` tree
  and the identifier does not appear.
* **`POWPOOL` and its level floors.** The weight table, `ptot`
  renormalisation and the `minLevel` gate are the reason a level-1 run cannot be
  handed Magnet. Nothing reads `POWPOOL` outside `runtime.js`.
* **Overcharge.** The `+50` overflow shield, the ember doubling at a full bank
  and the `shieldMax()` 3/4/5 steps at dl 160 and 320 are asserted nowhere. The
  `smoke` reward block explicitly sets `G.shields=0` in its `fresh()` state, so
  the full-bank branch is never taken.
* **The shield pickup at all.** No `pickup('shield')` exists in `smoke`; the
  bank is only ever set directly.
* **The hypernova pickup.** `pickup('hyper')` is never called. Its duration
  (`SPB * 16`, or 24 with LONGER STAR), its `1 + 0.9*hv` speed envelope, its
  0.35 s ease-in / 1.4 s ease-out, the shard→ember conversion at contact and the
  1.2 s landing grace are all unasserted in gameplay. `musiccheck` proves the
  *song* the star plays in exhaustive detail while nothing proves the star.
* **The `soft` flag on four of the six reward lessons.** `smoke:347` asserts it
  for `spot`, `hyper` and `lapcost` only — `mirror`, `scorch`, `slip` and
  `trail` could lose their no-slow-mo flag silently.
* **Six of the eleven upgrade tiles.** See below.

## The upgrade tiles

`check.mjs` parses the `UPG` literal and fails the build if any id lacks a live
`upgOn('<id>')` call site, matched against a comment-stripped copy of the
source. That is a wiring test, not an effect test: it cannot tell a correct
effect from an inverted one.

| Tile | Effect asserted by |
|---|---|
| `slowworld` | `smoke` — take slow-mo again with the flag, read 9 |
| `stagelight` | `smoke` — Magnet reads 16 |
| `longslip` | `smoke` — slipstream reads 18 |
| `longtrail` | `smoke` — the new route's stars carry `life === 24` |
| `hairtrig` | `dropcheck` — `dropNeed()` becomes 2 |
| `longstar` | **nothing** |
| `deepbank` | **nothing** |
| `richnova` | **nothing** |
| `longmirror` | **nothing** |
| `deepburn` | **nothing** |
| `steadyhand` | **nothing** |

Five of eleven. The six unasserted tiles include both duration upgrades for the
two newest orbs and the only tile that touches an input (`steadyhand` widens
`TIGHT` from 0.032 s to 0.045 s).

## Starfall

`dropcheck.mjs` is the one harness for it and it is unusually thorough: the
three-orbit charge and the two-orbit upgraded charge, that time/embers/taps/hops
/near-misses charge nothing, that the release waits for audible onset, that the
opening blast clears hazards and protects the player, that a physically
collected star pays through the ordinary path, that exactly three waves arrive
spaced 2–4.5 s and 5–7.5 s in, that no hazard spawns inside the window, that
pause and a black-hole detour consume no duration, and that a retry clears the
state.

It does **not** assert the ×2 star payout, which is the reward's headline claim
in three player-facing channels.
