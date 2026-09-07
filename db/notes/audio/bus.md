# The audio bus and every gain that touches the band

*What this answers: what nodes exist between a voice and the speaker, which
gain each subsystem is allowed to write, and what the current numbers are.*

Anchor: `src/game/runtime.js:755-831` (`buildBus`). Built once, on the first
`ensureAudio()`; `A` is the object it leaves behind. Everything is synthesised
— there are no audio files in the repo at all.

## The graph, as the code wires it

```
world ──────────────────────────────────────────┐
                                                │
bedDuck ─► hole ─► pump ─► band ────────────────┼─► lim ─► makeup ─► clip ─► out ─► destination
                                                │
perf ─► pq (peaking 1.5kHz Q0.9 +3dB) ──────────┤
                                                │
send ─► verb ─► verbTone (HP 420) ─► verbDark (LP 3200)
```

and the dub delay hangs off the bed path *before* the hole:

```
dly (0.4327s) ─► dtone (LP 1100) ─┬─► dfb (0.42) ─► dly
                                  └─► dout (0.55) ─► bedDuck
```

`A = {out, world, send, lim, bed:bedDuck, hole, pump, band, perf, makeup, dly}`.
Note the alias: `A.bed` is the **bedDuck gain node**, not the pad. The pad is
`BED.g`, a different object built by `buildBed`.

## Who is allowed to write what

This is the discipline the file repeats in three separate comments, and the
reason there are no stuck-gain bugs:

| Node | Rest value | Sole writer | What it does |
|---|---|---|---|
| `A.out` | 1 (0 if muted) | `toggleMute` | mutes the bus, never the clock |
| `A.world` | 1 | nobody | direct path for SFX and `soundImpact` |
| `A.bed` (bedDuck) | 1 | `duckBed` | big moments push the band aside, 0.09s later it writes its own recovery |
| `A.hole` | 1 | `schedulePreDrop` (arm) / `endSection` (undo) | the drop's silence — **currently dead, see below** |
| `A.pump` | 1 | `payoffStep`'s `pumpKick`, and `musicStep`'s bar-line dip | sidechain breath |
| `A.band` | 0.72 | `bedTick` only | the earned-state accompaniment level |
| `A.perf` | 1 | nobody | the player's own instrument |
| `A.makeup` | `MASTER` = 2.15 | nobody | measured makeup |
| `BED.g` | scheduled | `bedTick` only | the pad's amplitude |
| `BED.lp.frequency` | scheduled | `bedTick`, unless `t < MU.lpLock` | the pad's cutoff |

**The rule that makes it safe:** every duck writes its own undo at schedule
time, in the same call. AudioParam automation runs on the audio clock
independently of JS, mute, visibility and game state, so a hole whose recovery
is already written cannot be stranded by any of them (`runtime.js:1396-1403`).

## The numbers, read from source

- `MASTER = 2.15` (`runtime.js:750`). Measured: the pre-bus layer peaked at
  0.138 on the busiest moment, ~86% of headroom unused; 2.6 put the nova
  cascade three samples over full scale.
- Limiter: `DynamicsCompressor`, threshold −16, knee 6, ratio 12, attack 0.003,
  release 0.14.
- Soft clip: 1024-point `WaveShaper`, curve `tanh(x*1.25)/tanh(1.25)`,
  `oversample='2x'`, placed **after** makeup so a stacked moment saturates
  instead of tearing.
- Reverb: real `ConvolverNode` over a generated impulse — 1.6 s of noise through
  `(1-t)^2.6`, with a 6 ms fade-in ramp (`i < sr*0.006 ? t*160 : 1`). Send gain
  0.20. Tail highpassed at 420 Hz (out of the mud) and lowpassed at 3200 Hz
  (the deep genres keep the room dark). Two delay taps were tried first and read
  as slapback: above the ~50 ms fusion threshold you hear two echoes, not a room.
- Dub delay: `createDelay(1.2)`, `delayTime = (60/104)*0.75` = a dotted eighth at
  104 BPM. Feedback 0.42, feedback tone lowpass 1100 Hz, wet out 0.55 into
  bedDuck. It sits **before** the hole so a drop's silence swallows the echoes too.
- `A.band` rest 0.72.
- `A.perf` carries a peaking EQ: 1500 Hz, Q 0.9, +3 dB — "the most efficient band
  on a 15 mm phone driver".

## `A.band`: the earned-state gain

`bedTick` (`runtime.js:2729-2735`) is its only writer:

```js
const earned = playing ? Math.min(1, Math.max(G.groove/8, G.lapStreak/4, PLAY.heat*0.45)) : 0;
let band = 0.72 + 0.18*earned;                       // 0.72 .. 0.90
if (bhActive()) band = 0.84 + 0.16*Math.min(1, BH.t/BH_DUR*0.5 + BH.charge*0.5);
else if (playing && (G.hyper>0 || G.od>0 || FIN.on || MU.pay>0 || MU.rise)) band = 1;
A.band.gain.setTargetAtTime(band, t, band > A.band.gain.value ? 0.18 : 0.75);
```

Short opening (0.18 s time constant), slower recovery (0.75 s). It is not
modulated periodically and it creates no voices. The player's `perf` bus and the
`world` bus both join the limiter *after* `band`, so opening or closing the
accompaniment never changes the level of the player's own instrument or of the
immediate cues.

Black hole pins it at 0.84 rising to 1.0 with elapsed time and inner-ring
charge — and does so *before* the hypernova/overdrive branch, so a banked
hypernova cannot change the black-hole mix. `musiccheck` asserts exactly that
(`tools/musiccheck.mjs:1380-1383`).

## What is dead here

`schedulePreDrop` (`runtime.js:1404-1428`) — the drop's hush, the single most
documented moment in `docs/design/audio.md` — **has no caller**. `MU.rise` is
never assigned `true` anywhere in the file. So `A.hole` never leaves 1,
`MU.hushEnd` never leaves 0 (making `duckBed`'s hush guard and `musicTick`'s
cleanup test permanently false), and `MU.lpLock` never leaves 0 (making
`bedTick`'s `t >= MU.lpLock` always true). See `db/notes/audio/retired.md`.
