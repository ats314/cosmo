# The black hole — the one orb that is a wager

*What this answers: the three acts, every constant, the exact escape formula,
what the mode suspends, and how rare it actually is.*

Source of record: constants at `src/game/runtime.js:2241-2251`, `bhTick` at
`src/game/runtime.js:2256-2314`, `startBlackHole` at
`src/game/runtime.js:2315-2343`, `endBlackHole` at
`src/game/runtime.js:2344-2372`, and the pickup at
`src/game/runtime.js:8609-8617`.

## The constants

| Name | Value | What it governs |
|---|---|---|
| `BH_DUR` | 17 | the whole mode, seconds |
| `BH_ESCAPE` | 12 | when gravity releases and the ESCAPE signal fires |
| `BH_WARP` | 0.85 | the opening and closing warp, seconds |
| `BH_TS` | 0.60 | settled time scale |
| `BH_DENSITY` | 1.25 | opening density multiplier |
| `BH_PULL` | 4 | seconds between inward gravity pulls |
| `BH_IGNITE` | 1.2 | the charge-lit flourish |
| `BH_HORIZON` | 600 | maximum bank, reached by eight seconds of inner-ring dwell |
| `RAD_BH` | `[1.0, 0.80, 0.62, 0.45]` | the four re-spaced orbits (`src/game/runtime.js:205`) |

`bhDensity()` ramps `1.25 + 0.75*min(1, BH.t/12)` during the challenge, so the
board fills from 1.25× to 2× the ordinary budget.

**Ring index 0 is the OUTERMOST orbit.** `RAD_BH[0]` is 1.0. Two systems have
shipped backwards on this — the gravity pull once pushed the comet *outward*
and the 2× star bonus once paid on the widest, emptiest ring. Both now read
`G.nRings-1` for "innermost".

## Phase 0 → 1 → 2 → 3

* **1, opening (0.85 s).** `BH.warp` climbs to 1; `RADII[i]` lerps from
  `RAD_OFF[i]` to `RAD_BH[i]`, so all four orbits re-space rather than a fourth
  being squeezed inside the existing three. At `warp>=1`, `G.nRings=4`.
  `startBlackHole` clears `G.spikes`, banks any armed drop, flushes a live
  lesson, sets the `BLACK HOLE` banner and grants `BH_WARP + 0.3` of grace.
* **2, the challenge (12 s of charge, then up to 5 s of escape).**
  Settled dwell on the innermost ring (`G.ringI===G.nRings-1 && G.hopP>=1`)
  banks `dt/8` charge, capped at 1 — eight seconds fills it. **Arriving alone
  pays nothing.** Every `BH_PULL` seconds, if the hop has landed, gravity drags
  the comet one ring inward and grants 0.55 s of grace to cover the forced
  arrival. At `BH.t >= BH_ESCAPE`: `BH.escape = true`, the banner clears, the
  say line "ESCAPE: swipe to the outer ring" fires, and 0.6 s of grace covers
  the transition. Reaching ring 0 with the hop landed ends it successfully;
  `BH.t >= BH_DUR` ends it as a failure.
* **3, closing (0.85 s).** Before the radii close, every entity on the vanished
  ring is withdrawn: `G.spikes`, `G.stars` and `G.pows` are filtered to
  `ring < G.nRings`, and `G.ringI`/`G.hopFromI` are clamped. This also runs
  after death and when the lab is left mid-challenge.

## The payout

```js
bonus = round((80 + 600*BH.charge + 20*BH.score) / 1.5 ** min(3, spent))
```

where `BH.score` counts stars collected during the mode
(`src/game/runtime.js:8430`) and `spent = G.blocks - BH.hits0`, the shields lost
inside it. Success also grants 1.5 s of grace and fires `blackhole_survived`.

Failure: one shield is spent (with 1.5 s grace), or an unshielded ordinary run
dies. Either way the bank is lost, `REWARD LOST` pops, and
`blackhole_failed` is tracked. In the lab an unshielded failure does not kill.

Stars on the innermost ring pay double while `BH.phase===2`
(`src/game/runtime.js:8443-8444`).

## What it suspends

`updateOrbMotion` returns immediately while `bhActive()`
(`src/game/runtime.js:5879-5880`), so Starfall's clock, slipstream, the mirror,
the scorch wake and its burn-off all stop. `updateMagnetStar` returns too
(`src/game/runtime.js:5104`). Route, magnet and Starfall stars are skipped
entirely by the ember loop (`src/game/runtime.js:8423`). Hypernova and Magnet
glow envelopes are forced to 0 (`src/game/runtime.js:8069-8070`), and the HUD's
power chips do not draw (`src/game/runtime.js:11586`). Orb spawning is gated off
(`src/game/runtime.js:8406`) — an orb in here would either be a lifeline
undoing the mode's difficulty or a musical orb acting on a halted arrangement.
`firstMeet` defers rather than spends (`src/game/runtime.js:5596`).

## How rare

Two branches only, both above the guarantees in `spawnPow`:

* level ≥ 4, once per run, if `!bhRun && !bhPlaced && t>=bhCool && !bhActive()`
  — a guarantee to **offer**, which is the only kind an optional thing can
  carry;
* level ≥ 3, `Math.random() < 0.05` per placement, behind the same cooldown.

The pity shield is tested **before** both, so an optional event can never
postpone the survival bank. Declining costs 20 s of cooldown; taking it costs 55
s, armed at the pickup rather than the placement.

## Coverage

`tools/smoke.mjs` drives a full mode: four rings opened and restored, the shard
cap raised and the spawn gap shortened, slow motion active, no orb placed
inside, the escape bonus paid exactly once, death inside paying nothing, charge
banked only on settled inner-ring dwell and not on any other ring, suspended
orb timers untouched and resumed afterward, the deadline losing the bank and one
shield, and closure leaving no entity on the vanished ring. `tools/fxcheck.mjs`
asserts the mode takes exclusive visual priority over every other scene event.
