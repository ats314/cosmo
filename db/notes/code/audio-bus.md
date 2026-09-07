# The audio bus, and the discipline that keeps it un-stuck

**What this answers:** how sound is routed in `src/game/runtime.js`, which node
each voice reaches, who is allowed to write which gain, and why the file keeps
insisting that every duck writes its own undo.

## The graph

`buildBus()` (755–835) builds it once, on the first `ensureAudio()`, and stores
the handles on `A`:

```
voice ─┬─► dry (A.world) ──────────────────────────┐
       └─► send (A.send) ─► verb ─► verbTone ─► verbDark ─┤
                                                   ├─► lim ─► makeup ─► clip ─► out ─► destination
bed ─► A.bed ─► hole ─► pump ─► band ──────────────┤
  └──► dly ─► dtone ─► dfb ─┘  (dtone ─► dout ─► A.bed)
perf (A.perf) ─► pq (peaking 1.5kHz +3dB) ─────────┘
```

Read off the source, not remembered:

- `MASTER = 2.15` (750) is the makeup gain. The comment records that 2.6 put the
  nova cascade three samples over full scale.
- `lim`: `DynamicsCompressor`, threshold −16, knee 6, ratio 12, attack 0.003,
  release 0.14 (766–767).
- `clip`: `WaveShaper`, 1024-point `tanh(x*1.25)/tanh(1.25)`, 2× oversample
  (761–765).
- `band.gain` opens at 0.72 (779); `bedTick` moves it between 0.72 and 0.90 on
  earned play, 1.0 during hypernova/overdrive/finale/payoff, and 0.84–1.0 inside
  a black hole (2726–2735).
- Reverb is a real `ConvolverNode` over a generated 1.6 s impulse; `send.gain`
  0.20, highpass 420 Hz, lowpass 3200 Hz (792–804).
- The dub delay is a dotted eighth at 104 BPM — `(60/104)*0.75` — with feedback
  0.42, a 1100 Hz lowpass on each repeat, and 0.55 out (810–818). It hangs off
  the bed path **before** `hole`, deliberately, so a silence swallows the echoes
  too.

## Who bypasses what, and why

`A.perf` — the player's own instrument — bypasses **both** `bedDuck` and `hole`
(780–786). A nova gets the band out of the way but not you; a payoff hole takes
the arrangement's floor out but your notes stay standing. `performerHit` and the
groove-climb tone route here.

`A.world` is the SFX path used by `beep()` (2886) and by `soundImpact` (3532).
It is downstream of `lim` but not of `bedDuck`, so a death cue is unaffected by
its own duck.

`A.bed` is everything the band plays. `note()` defaults to it (1112); `hat`,
`kick`, `swellPad`, `riser` and `gtr` connect there unconditionally.

## The rule

> Every duck writes its own undo at schedule time, in the same call. Never rely
> on a later tick to restore a param.

Stated at 1394–1403 above `schedulePreDrop`. The reason is that AudioParam
automation runs on the audio clock independently of JS, mute, visibility and
game state — so a hole whose recovery is already written cannot be stranded by
any of them. `endSection()` (1545) is belt-and-braces, not the mechanism.

`duckBed(amount, rel)` (2807) obeys this: `setTargetAtTime(amount, t, 0.02)`
immediately followed by `setTargetAtTime(1, t+0.09, rel||0.35)`. It also
early-returns while `AC.currentTime < MU.hushEnd`, so a pickup inside the hush
cannot cancel a scheduled recovery.

The ordinary-play sidechain in `musicStep` (1806–1813) writes its dip and its
recovery in the same call for the same reason: `setValueAtTime(1, t-0.002)`,
`linearRampToValueAtTime(0.80|0.84, t+0.02)`, `setTargetAtTime(1, t+0.05, 0.11)`.

## The bug class the comments keep naming

Three separate incidents in the file's history are the same bug: **silencing the
scheduler is not silencing the band.** The pad is eight continuously running
oscillators whose gain lives in `bedTick` (2695) and nowhere else, so anything
that stops `musicStep` from writing new notes leaves the pad sounding.

- The drop's hush stopped scheduling but the pad played through it (1265–1273).
- The black hole silenced `musicStep` but the level's chords sustained under the
  mode; 54 % of the mix was byte-identical either side of the entry (2717–2725).
- Pause freezes `update()`, which freezes `bedTick`, which does not silence the
  band — it *freezes* it droning one chord. `pauseAudio()` (3277) takes the bed
  down explicitly, copying `runtimeVisibilityChanged` (2838).

Anything new that "stops the music" has to touch `BED.g` or go through
`endSection()`.

## Mute

`toggleMute()` (2866) gates `A.out.gain` with a 20 ms `setTargetAtTime`, and
`note()`/`hat()`/`beep()` early-return while muted so a silent run costs nothing.
It deliberately does **not** stop the clock: `musicTick` keeps running, so
`MU.next` stays valid, `BEATQ` keeps filling, `G.beat` keeps pulsing, and the
groove chain, the drop and the visible metronome all still work for a player with
sound off (2853–2865). A muted section is ended rather than left to run out
silently against a ducked bus.

## Context lifecycle

`ensureAudio()` (2818) creates the context lazily, resumes from both `suspended`
and WebKit-only `interrupted`, and plays a one-sample buffer once to satisfy iOS's
gesture unlock. `runtimeVisibilityChanged` (2838) resumes and ends the section on
show; on hide it ends the section, drops `BED.g` to 0.005 directly and drains
`BEATQ`/`DROPQ` so returning minutes later cannot fire a stale drop shake.
`runtimeDestroy` (12241) closes the context and drops `AC`/`A`/`BED`.
