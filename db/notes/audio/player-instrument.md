# The player as an instrument: taps, hops, the chain, and the cue vocabulary

*What this answers: exactly what a tap and a swipe sound like, why they are
chord-aware, how the timing chain is judged, and what each earcon means.*

## The contract

**Tap always turns; swipe always changes ring.** No section, mode, drop or fill
ever remaps an input, records a phrase, or asks for musical input. `performerHit`
plays the same instrument in every state; `musiccheck` asserts the movement
instrument is identical in ordinary play, inside a payoff, and inside a drum
fill (`tools/musiccheck.mjs:1490-1503`).

## `performerHit(kind, dir, ring)`

`runtime.js:2649-2672`. Guarded on `frozen()`, `G.state==='playing'`,
`AC.state==='running'` and `!bhActive()` — during a black hole the player is not
playing the band.

```js
const slot = gridNear();
if (Math.abs(slot-PLAY.slot) < 1e-4) return;      // one note per sixteenth
PLAY.slot = slot;
const t = Math.max(slot, now+0.012);
PLAY.heat = Math.min(1, PLAY.heat+0.26);
if (now-PLAY.last > 2.4) PLAY.idx = 0;             // a pause starts a new phrase
const rg = Math.min(2, ring===undefined ? effRing() : ring);
const ci = (kind==='hop' ? (dir<0 ? [2,1,0,1] : [1,2,3,2])[PLAY.idx%4]
                         : [0,2,1,3,2,0,3,1][PLAY.idx%8]) + rg;
```

Three figures, all **chord-tone indices**, not scale degrees:

| Input | Figure |
|---|---|
| tap (reverse) | `[0,2,1,3,2,0,3,1]`, cycling on `PLAY.idx` |
| hop inward (`dir<0`) | `[2,1,0,1]` — arpeggiates down |
| hop outward | `[1,2,3,2]` — arpeggiates up |

`+ rg` is the ring transposition (0/1/2). Consecutive inputs walk the figure, so
tapping back and forth is a phrase; a 2.4 s pause restarts it.

Three voices per hit, all on `A.perf`:

```js
const g = (0.032 + 0.024*PLAY.heat) * (1 + 0.08*gr);      // gr = the groove chain
note(chTone(ci+2), t, 0.16, rv.wave, g,      (1500+1200*heat)*(1+0.16*gr)*rv.cut, pan, A.perf, 0.12);
note(chTone(ci),   t, 0.13, rv.wave, g*0.34, 1100*rv.cut,                          pan, A.perf);
if (rg>=2) note(chTone(ci+4), t, 0.09, 'sine', g*0.25, 3600,                       pan, A.perf);
```

- The **main note** is `ci+2` — a third above the walked tone. `+4` on the inner
  ring is the octave.
- The **fifth underneath** is `ci` at 34% gain: one tap is a note, a flurry is
  a chord.
- `echo 0.12` on the main voice feeds the dub delay, so against the 3+3+2 world
  one tap sounds like three.
- `rv.wave` and `rv.cut` come from `RINGS`, so the instrument's timbre *is* the
  ring you are on.
- Everything resolves through `chTone`, so a tap is a chord tone of **this bar**,
  and it follows on all six levels because the figures are indices and each
  level's chords differ.

Because `A.perf` bypasses `bedDuck`, `hole` and `pump`, the player's own notes
stand still while a nova or a bar-line kick moves everything else, and they are
the thing left standing if the band ever drops out.

## The timing chain

`judgeTiming(x, y)` — `runtime.js:2533-2648`. Three tiers, and each answers a
different intent:

| Tier | Test | Result |
|---|---|---|
| **CLIMB** | `dev16 < W` and `dev4 < W` — tight against the quarter | `G.groove` +1 (max 8), score += the new rung, a confirmation tone one degree higher, `build(0.011,'time')` |
| **HOLD** | `dev16 < W` but `dev4 >= W` — tight against the sixteenth only | chain neither climbs nor slips; its decay clock refreshes; still earns the section garnish |
| **SLIP** | neither | `G.groove` −1, never the chain, never points; a dim early/late arc if the tap was plausibly aimed |

`TIGHT = 0.032` (`runtime.js:2516`); `W = 0.045` with the `steadyhand` upgrade.

The climb tier used to be the sixteenth. At ±32 ms against a 144 ms grid random
tapping lands ~44% of hits, and simulated mashing reached ×8 in a quarter of
300-tap trials. On the quarter it reaches ×8 in none of 500, while a player
actually tapping the beat still maxes in ~12 taps.

### The bias: consistency, not accuracy

A phone adds 30-50 ms between finger and JS event, so judging absolute timing
would let the device decide the player's result. `PLAY.bias` is a running
estimate of that latency and the deviation *from it* is what is judged.

```js
if (Math.min(dev4,dev16) < W*2.5) {
  const d = ((dev4<=dev16 ? off4 : off16) - PLAY.bias) * 0.18;
  PLAY.bias += (PLAY.biasN<12 && dev4<W*2.5) ? (PLAY.biasN++, d)
                                             : clamp(d, -0.003, 0.003);
  PLAY.bias = clamp(PLAY.bias, -0.12, 0.12);
}
```

- Twelve **fast** samples (full 0.18 EMA) calibrate a fresh device, and they are
  **reserved for quarter-plausible taps** — otherwise arbitrary survival taps
  could spend the whole budget before the player ever aimed at a beat.
- After that the bias slews at most **3 ms per tap**, inside ±120 ms. A latency
  is static, so the learner is too. At the old always-on 0.18 EMA the calibration
  was fast enough to *track* a masher's wandering cadence — a simulated ~7 Hz
  renewal tapper was chased to ×8 in 458 of 500 trials; slew-limited on the
  quarter grid that is 0.
- `PLAY.bias` persists across runs, so a fully-spent budget is a one-time
  session cost, not a per-run one.

### What the chain pays

Score only on the way **up** — 36 points for a full climb, against 86 for a
maxed orbit. Paying per tight hit made forty taps worth 320 and rhythm would
have become the whole game. What a chain actually buys is the arrangement:
`G.groove>=3` opens `driving`, `>=4` lifts the chorus, `gv = max(0, groove-4)`
brightens the pad and thickens the hats, and `G.groove/8` feeds `A.band`.

Each rung is **heard**: `note(PENT[min(13, groove+4)]*0.5, ...)` on `A.perf` —
eight tight quarters literally walk up the scale. The old +10%/rung gain boost
was ~0.6 dB, under what a phone speaker makes audible, so the ladder spoke only
through HUD text until the pad opened at ×5.

×8 fires `fireLift()` (the tier-unlock fanfare: 2.3 s, no hush, no response
bars) and `build(0.06,'time')` — but see `db/notes/audio/retired.md`: `build`
now discards every non-`'orbit'` source, so that bonus does nothing.

During a payoff every tight hit **pays** rather than merely climbing:
`8 * G.secMult`. Playing through the drop is the skill and nothing asks you to
stop.

## The cue vocabulary

Three earcons, each meaning exactly one thing and never borrowed
(`runtime.js:3569-3593`). All chord-aware through `chTone`, all quantised
through `cueTone`:

| Cue | Shape | Meaning |
|---|---|---|
| `cueUnlock` | `chTone(0)`, `chTone(2)`, `chTone(4)` on successive sixteenths, squares, rising pan | a new mechanic just arrived (tier banners only) |
| `cueLesson` | `chTone(2)*0.5` then `chTone(0)*0.5` two sixteenths later, sines | a teaching sentence is on screen |
| `cueState(on)` | three triangles an octave up on half-sixteenths, `chTone(0/2/4)` rising if opening, `chTone(4/2/0)` falling if closing | a standing bonus state opened or closed |

## The impact voice

`soundImpact(kind, strength)` — `runtime.js:3532-3557`. One compact voice shared
by nova, hypernova and orbit milestones, replacing the previous stacked hits.

- Routes to **`A.world`**, not the bed — so its own accompaniment duck
  (`duckBed(0.22)` for nova/hyper, `0.72` for orbit) cannot swallow its attack.
- At most **five pitched voices and one brief noise source**, and only on the
  event.
- `subF(f*0.5)` sine floor, `f*2` triangle body, then either a rising pentatonic
  figure (`PENT[4]`, `PENT[6]`, `PENT[8]` on the perf bus — hypernova) or a
  root/fifth ring (`f*4` and `f*4*2^(7/12)` — nova and orbit).
- The noise tail is a bandpass sweep: 3200→650 Hz for a nova, 1800→4200 Hz for
  a hypernova. The orbit cue skips it entirely and keeps the lighter payout.
- Silent while muted or paused: `if(!AC||muted||frozen())return;`
