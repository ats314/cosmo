# Starfall — the earned reward

*What this answers: exactly how Starfall is charged, released, staged and
scored, why its duration is 9.2308 seconds and not a round number, and what
suspends it.*

Starfall is **not a spawned orb**. Nothing places it, `POWPOOL` does not carry
it, and the lab cannot select it. It is the payout for three star-fed orbits.
Source of record: `src/game/runtime.js:1326-1370` and the star-scoring branch at
`src/game/runtime.js:8447-8450`.

## Charging

`build(amount, src)` (`src/game/runtime.js:1328-1336`) is the only entry point,
and it discards everything that is not an orbit:

```js
if(src!=='orbit'||amount<0.04)return;
G.build=Math.min(dropNeed(),G.build+1);
```

so time, embers, hops, taps and near-miss grazes contribute **nothing** — they
call `build` with other sources or with amounts below 0.04.

`dropNeed()` (`src/game/runtime.js:1326`) is `2` with the EARLY STARFALL
upgrade (`hairtrig`) and `3` otherwise. `DROP_STEP` and `DROP_STEP_MAX` are both
`0` (`src/game/runtime.js:1325`): the escalating cost the long comment above
them describes is **retired**, and the comment is stale. So is `tryLand()`
(`src/game/runtime.js:1338`), an empty function kept as a tombstone — "a reward
never asks for a different tap."

`build` returns immediately while the intro is up, in the lab, inside a black
hole, during the finale, or while Starfall is already running.

## Release

On the qualifying orbit, `G.build` resets to 0, `G.dropsEarned++`, and:

* with a live audio context, `armDrop('STARFALL','orbit')` — the release waits
  for the next musical quarter so the reward lands *on* the record;
* with no audio, `startStarfall()` fires immediately.

**No timing input is required either way.** Taps always turn.

## The reward itself

`startStarfall()` (`src/game/runtime.js:1349-1358`):

| Field | Value |
|---|---|
| `left`, `total` | `PAYLEN` |
| `next` | `PAYLEN/3` |
| `wave` | 0 |
| invulnerability | `G.t + PAYLEN + 0.6` |
| opening | `novaBlast(cx, cy)` — a full-board clear from the centre |
| scene | `scenePulse('drop', 3.5)` |

`PAYLEN = PAY * (SPB/2)` with `PAY = 32` (`src/game/runtime.js:905`) and
`SPB = 60/104` (`src/game/runtime.js:858`), so

```
PAYLEN = 32 * (0.5769230769230769 / 2) = 9.230769230769232 s
```

That is four bars at 104 BPM — the same length as the payoff section it rides.
`PAYREST = 0`: there is no cooldown tax between releases.

## The three waves

`starfallWave()` (`src/game/runtime.js:1340-1348`) pushes **five stars per
wave**, capped at 30 stars on the board, at `0.55 + j*0.42` rad ahead in the
current direction. Every third star (`j%3===2`) goes to the adjacent ring —
inward if the comet is on the innermost, outward otherwise. Each star lives
`5` seconds and is marked `starfall:true`.

`tickStarfall()` (`src/game/runtime.js:1359-1370`) fires wave 1 at release and
schedules the next two at `PAYLEN/3 = 3.0769 s` apart, so waves land at roughly
0 s, 3.08 s and 6.15 s of the 9.23 s window. It also re-arms the invulnerability
every frame at `G.t + left + 0.6`, which is what keeps the protection honest if a
black-hole detour advanced the run clock underneath it.

## Scoring

A Starfall star is collected through the ordinary swept-contact path. The
doubling is at `src/game/runtime.js:8447-8449`:

```js
if(starfallActive()&&!bhActive()){
  const ex=G.combo*(G.secMult||1);
  G.score+=ex;G.secScore+=ex;paid+=ex;
}
```

— the combo value is added **a second time**, multiplied by the live payoff
section's multiplier. That branch is an `if/else` against the standing-state
doubling (overdrive / hypernova / full shield bank), so the two never stack.
The popup prints `paid`, i.e. what the score actually received.

At expiry `G.starfallResult = {at, got, score}` is published for the HUD's
"STARFALL COMPLETE" card (`src/game/runtime.js:11527-11528`) and `G.spikeT` is
pushed out by 1.2 s so the board does not re-arm the instant the protection
ends.

## What suspends it

`tickStarfall` returns while `bhActive()`, and `updateOrbMotion`
(`src/game/runtime.js:5879-5881`) only calls it when a black hole is not
running. Starfall stars carry the `starfall` flag, which the ember loop
(`src/game/runtime.js:8423-8425`) uses to skip them entirely inside a black hole
and to age them on `rewardDt` rather than the simulation delta otherwise. The
pause freeze is upstream of all of it: `update()` returns before `G.t += dt`.

While Starfall runs, the ordinary spawners are gated off — `starfallActive()`
appears in the star, shard and orb spawn conditions
(`src/game/runtime.js:8394`, `8396`, `8406`).

## Coverage

`tools/dropcheck.mjs` is the harness. It asserts the three-orbit charge and the
two-orbit upgraded charge, that no other source charges it, that the release
waits for audible onset, that the opening blast clears hazards and protects the
player, that a physically collected star pays through the normal path, that
exactly three waves arrive spaced 2–4.5 s and 5–7.5 s in, that no hazard spawns
during the window, that pause and black-hole suspension consume no duration, and
that a retry clears the state. It does **not** assert the ×2 star payout.
