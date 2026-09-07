# The five clocks, and which one a deadline belongs on

**What this answers:** why `src/game/runtime.js` has `dt`, `sdt`, `pdt`, `G.t`,
`G.vt`, `AC.currentTime`, `BH.t` and `dl()` all at once, and which one any new
timer should be written against.

## The list

| Clock | Where | What it measures |
|---|---|---|
| `dt` | argument to `update()` (7699), clamped to 0.05 s in `runtimeStep` (12157) | one real frame |
| `G.t` | 7721, `G.t += dt` | **real seconds since boot.** Every deadline in the file — `G.invuln`, `G.bhCool`, spawn timers, lesson spacing, cooldowns — is written against this |
| `G.vt` | 7784, `G.vt += pdt` | the **presentation** clock: real time scaled by `G.tsCur`. Everything the player *looks at* rides this — camera dolly, sky drift, particles, ripples, popups, the trail |
| `pdt` | 7783, `dt * G.tsCur` | dilated frame delta for visuals |
| `sdt` | 8127–8128 | gameplay delta: `dt * G.tsCur * (G.stop>0?0.10:1) * (hard lesson ? (see:0.06 / hop:0.35) : 1)` |
| `bdt` | 8392, `BH.phase===2 ? dt : sdt` | arrival rate inside the black hole runs on real time |
| `rewardDt` | 7722, `bhActive() ? 0 : dt` | timed reward states are suspended, not drained, inside the black hole |
| `AC.currentTime` | Web Audio | the only clock the music is scheduled on; independent of frames, mute, visibility and game state |
| `dl()` | 4409 | "difficulty seconds" — `LV[level-1].dl0 + a<80 ? a*0.55 : 44+(a-80)` where `a = (age()+min(G.diff*0.22,40))*MD().clock` |

## Why the split exists

Slow motion originally reached the simulation and stopped there: the comet
halved its speed while the backdrop, dolly, sky drift, ripples, popups and trail
all kept running off raw time — roughly fifteen visible layers moving at full
speed contradicting eight that were not (5005–5015). `G.vt` and `pdt` exist so
that dilating time dilates the *visible world*, not just the comet.

`G.tsCur` eases toward `tsT` (8104–8106): `BH_TS*0.62` during black-hole phase 1,
`BH_TS = 0.60` during phase 2, `0.55` while slow-mo is up, otherwise 1. The ease
is slower going in (`dt*3.2`) than coming out (`dt*8`) — falling into a well is a
swoon, leaving it is a release.

`sdt` adds hit-stop and the teaching veil on top, so during hit-stop the comet
holds still while the ignition keeps playing, and a hard lesson runs the board at
0.06× while its particles keep explaining.

## Pause is a frozen clock, not a state

`update()` opens with the `frozen()` check **before** `G.t += dt` (7702–7719).
That single return is the entire freeze: every deadline in the file is on `G.t`,
so stopping it stops invulnerability, spawn timers, cooldowns, lesson spacing,
the tier ladder, the difficulty clock and `bhTick` at once. `G.state` stays
`'playing'` — a `'paused'` state would have made `draw()`'s final `else` render
GAME OVER over a live run (3216–3222).

Paused *duration* is measured with `performance.now()` (`pauseNow`, 3254) and not
with `dt`, because `dt` is clamped and rAF does not fire in a hidden tab — a
ten-minute locked phone would otherwise be recorded as 0.05 s (3243–3253).

The audio context is deliberately left running through a pause (3263–3276):
`musicTick` already survives an arbitrary gap by abandoning the phrase when
`MU.next` falls 0.4 s behind, and iOS only reliably resumes a context inside a
user gesture.

## The difficulty clock is the single difficulty lever

`dl()` is what `speedAt`, `shardCap`, `spawnGap`, `warnTime`, the tier ladder and
every level finish line read. That is why:

- `MODES` (3117) trims the *clock rate* rather than each term — one number, so
  nothing can drift out of step (3108–3115).
- the lab pins it: `if(LAB.on) return LAB_DL;` where `LAB_DL = 40` (3193), which
  is exactly `TIERS[3].at` (THIRD RING) and therefore the lowest value that gives
  the arena all three orbits.
- `G.intro` returns 0, so the first-flight tutorial sits at the bottom of every
  curve.
- the escalation nudge is capped: `min(G.diff*0.22, 40)`.

One consequence worth knowing: because `dl()` is constant in the lab, the
twin-hold release valve in `tierIndex` (`d - G.holdD >= 30`) can never fire
there, which is why the hold is explicitly exempted with `!LAB.on` (4770).

## The music is on its own clock and must stay there

`gridNear`, `gridOff`, `judgeTiming`, `cueTone`, `performerHit`, `mkSpike`'s
warn-quantization and `beatPhase` all read `AC.currentTime`. `bedTick` reads it
for every gain and filter target. Nothing in the audio path is allowed to derive
timing from `G.t`, because a rendering stall must not shift a note.
