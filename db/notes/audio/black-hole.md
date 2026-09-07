# The black hole piece: three acts on the same grid

*What this answers: what replaces the arrangement during black hole mode, how
its acts are timed, and which contracts it must not break.*

Anchors: `bhStep` `runtime.js:2376-2424`; constants `runtime.js:2241-2254`;
band/pad handling in `bedTick` `runtime.js:2695-2802`.

## Constants

```
BH_DUR     = 17   seconds, total
BH_ESCAPE  = 12   seconds, when the route opens
BH_WARP    = 0.85
BH_TS      = 0.60
BH_DENSITY = 1.25
BH_PULL    = 4
BH_IGNITE  = 1.2
BH_HORIZON = 600  maximum bank from eight seconds at the inner ring
```

## Half time, one grid

`bhStep` runs from `musicStep`, at the top, above every other handoff — the
black hole outranks even a payoff section already in flight. It halves the rate
itself:

```js
const fs = BH.step++;
if (fs & 1) return;
const hs = fs>>1, beat = hs%8, bar = (hs/8)|0;
```

So the piece is half-time on the same 104 BPM scheduling grid. There is **no
parallel audio timer** — the acts read the gameplay clock directly:

```js
const q = min(1, BH.t/BH_DUR);
const escapeAt = BH_ESCAPE/BH_DUR;               // 12/17 ≈ 0.7059
const act = q<0.35 ? 0 : q<escapeAt ? 1 : 2;
const charge = clamp(BH.charge, 0, 1);
const escape = max(0, (q-escapeAt)/(1-escapeAt));
```

## The three acts

**Act 0 — Opening (0 to 35%, i.e. 0-5.95 s)**
- one heartbeat per half-time bar (`beat===0`)
- a low tonic: `subF(root*0.5)` sawtooth, `SPB*4.2` long, cutoff 180
- the mode's own tritone, degree 2 against flat 6: `root*1.12246` and
  `root*1.58740`, squares panned ±0.32, `SPB*2.8` long
- a dark noise grain on beat 4
- a distant tuned beacon on beat 6 of odd bars: `root*1.18921*8`

**Act 1 — Accretion (35% to `BH_ESCAPE`, 5.95-12 s)**
- the heartbeat **doubles** — `beat===0` and `beat===4`
- a second dark grain on beat 2, 520 Hz, `SPB*0.26` decay
- the tritone gains a second statement on beat 5
- inner-ring residency raises `BH.charge` from 0 to 1; when `charge > 0.35`
  the beacon **gains a fifth**: `root*1.78180*4`. The bank is audible as harmony.
- the beacon now fires on every bar, not only odd ones

**Act 2 — Escape (the final 5 s of 17)**
- **four heartbeats per half-time bar** — beats 0, 2, 4 and 6
- the low tonic shortens to `SPB*2.3`; the tritone to `SPB*1.3` — motion
  replaces the long separated statements
- a rising scale phrase on every odd beat:
  `root*4*[1.12246, 1.18921, 1.33484, 1.49831][(beat-1)>>1]`
- a brighter grain on beat 6 that opens with `escape`

The rise is **an unresolved question**. Only an actual successful escape plays
the exit resolution, in `endBlackHole` (`runtime.js:2344-2375`), and receives the
banked reward.

## The contracts it holds

1. **One pulse owner.** `pulse` is computed once and drives both `kick()` and
   `BEATQ.push(t)`, so the sky's pulse follows the audible strike exactly. The
   old overlapping late-kick branches and continuous sinking pitch are gone.
2. **Every pitch is an interval over `CH[0][0]`** and every sub passes through
   `subF`, so no voice falls under 40 Hz on the low keys.
3. **Sparse upper beacons** keep a recognisable voice on a phone speaker —
   `musiccheck` fails a level whose black-hole voices are all under 400 Hz
   (`tools/musiccheck.mjs:1157-1164`).
4. **The pad is silenced.** `bedTick` sets `lvl = 0.010` and a 0.05 s time
   constant when `bhActive()`. This is the bug the mode originally shipped with:
   silencing the *scheduler* is not silencing the *band*, because the pad is a
   bank of eight continuously running oscillators whose gain lives in `bedTick`.
   Measured, 54% of the mix was byte-identical either side of the entry.
   The 0.05 s cut on the way in and 0.9 s swell on the way out are deliberate:
   a crossfade would read as a transition between two songs.
5. **`A.band` is pinned** at `0.84 + 0.16*(BH.t/BH_DUR*0.5 + BH.charge*0.5)`,
   evaluated *before* the hypernova/overdrive branch — so a banked hypernova or
   spotlight cannot change the black-hole mix.
6. **The section is frozen.** `bhActive()` is in the lift guard, so the chorus
   can neither enter nor leave inside the mode, and `G.chorusBars` does not
   advance.
7. **An earned drop survives.** `endBlackHole`/`startBlackHole` bank it via
   `MU.pend` rather than destroying it (`runtime.js:2323`).
8. **Gameplay SFX redshift.** `beep()` gates on `BH.phase===2` and falls on a
   squared curve from nothing at entry to a perfect fourth at exit — a fourth
   is the one deep interval that stays in key, because the SFX pentatonic
   transposed down five semitones is still inside the level's natural minor.
   The old flat two semitones was a transposition the ear normalises away
   within seconds. Entry (phase 1) and exit (phase 3) beeps keep their pitch.
9. **The accretion ring (`RINGS[3]`)** carries no arrangement of its own — the
   band is halted, so its `wave`/`cut`/`lift` values only feed the SFX layer.
   Violet, not the cyan the ladder was walking toward: it belongs to the black
   hole, not the band.
