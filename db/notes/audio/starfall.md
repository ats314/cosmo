# Starfall: the earned release, and how the sound leads the picture

*What this answers: what earns Starfall, what the scheduler does with it, and
why the visual release is driven by an audio timestamp rather than a call.*

## Earning it

`build(amount, src)` — `runtime.js:1328-1337`:

```js
function build(amount,src){
  if(G.state!=='playing'||G.intro||LAB.on||bhActive()||FIN.on||starfallActive())return;
  if(src!=='orbit'||amount<0.04)return;              // only a completed star-fed orbit
  G.build=Math.min(dropNeed(),G.build+1);G.buildFx=1;
  if(G.build<dropNeed())return;
  G.build=0;G.dropsEarned++;G.sawDrop=true;
  if(MU&&AC&&AC.state==='running')armDrop('STARFALL','orbit');
  else startStarfall();
}
```

`dropNeed()` returns **3**, or **2** with the `hairtrig` upgrade
(`runtime.js:1326`). Passive time, tapping and near misses do not charge it —
`build` is called from several sites with `'ember'`, `'time'` and `'hop'`
sources, and every one of those returns immediately at the second line. Those
call sites are live but inert; see `db/notes/audio/retired.md`.

**The last line is the invariant.** If audio is muted, unbuilt or not running,
`startStarfall()` fires directly. A muted or offline game still gets the
gameplay reward — it just does not get it quantised.

## Arming and banking

`armDrop(why, src)` — `runtime.js:1371-1394`. If a section is live, a rise is in
flight, or the cooldown has not lifted, the earn is **banked** in `MU.pend`
rather than discarded, and is still *heard*: the same two-note stab, quieter
(0.017/0.016 vs 0.028/0.026). Otherwise `MU.armed = true`, the stab plays at full
gain, a ripple fires at the comet and a reward haptic runs.

`bedTick` (`runtime.js:2707-2710`) fires a banked drop the instant the music can
carry one. `endSection` re-banks anything armed but unpaid, but never re-banks a
section already in flight — that drop was received. Death and menu do not bank;
a new run starts clean.

## Release

`musicStep:1695-1697`:
```js
if (MU.armed && i%2===0) { G.od=0; G.odBrk=false; fireDrop(t); payoffStep(t,ch,k); return; }
```

`i%2===0` is the **quarter beat** — so an earned Starfall waits at most one
eighth (0.288 s) before it lands. There is no timing exam, no landing window and
no perfect-tap bonus; `tryLand()` is an empty function retained only so its three
input call sites keep compiling.

Overdrive is absorbed at the same instant: the bigger moment wins.

## `fireDrop`: the impact

`runtime.js:1429-1478`. Sets `MU.pay = PAY`, `MU.payEnd = t+PAYLEN+0.6` (the
audio-clock deadline `bedTick` polices so no stall path can strand a section),
`MU.cool = t+PAYLEN+PAYREST`, `MU.lateAt` (2 for a `'time'` flavour, else 4) and
`MU.crown = ringOf()`.

Then, all as intervals over `f = CH[0][0]`:

| Voice | Pitch | Notes |
|---|---|---|
| sub | `subF(f*0.5)` | sawtooth, 0.55 s, gain 0.045 — headphone weight only |
| body | `f` | sawtooth, 0.60 s, 0.055 |
| stabs | `PENT[8]`, `PENT[5]` | squares ±0.22, pre-echoing the hook |
| crash | — | `hat(t, 0.060, 2400, 0.55, wet 0.55)` |
| boom | `subF(f*0.374577)` | the fifth below the tonic, an octave and a fourth down — 2^(−17/12) |
| its octave | `f*0.749154` | triangle, for the phone speaker |
| wash | — | `hat(t, 0.030, 900, 0.9, wet 0.6)` |
| braam | `f` and `f*1.49831` | two `swellPad`s — the trailer-score fifth stack |

**No kick here, deliberately.** The caller runs `payoffStep` at the same `t` and
its bar 0 fires one; scheduling both put two kicks on the same sample.

Half of this used to be absolute — 55/110, 41.2/82.4, and a 110/164.81 braam,
all A and E from when A minor was the only key. The stabs beside them used
`PENT` and transposed correctly, which is what hid it: half of the loudest event
in the game followed the level and half of it did not. On THE STORM the fixed A
sounded a semitone against F minor's Ab, at the moment the arrangement is most
exposed.

## The audio timestamp leads

`fireDrop`'s last line: `DROPQ.push(t)`.

`bedTick` (`runtime.js:2772-2785`) drains it:
```js
while (DROPQ.length && DROPQ[0] <= t) {
  DROPQ.shift(); startStarfall(); G.dropFx=1;
  flashHit(0.34); G.shake=max(G.shake,9);
  ...one expanding ring per orbit, one white ring, a burst at the comet...
  gameHaptic('reward',[34,30,70]);
}
```

So the screen flash, the shake, the rings, the burst, the haptic **and the
gameplay reward** all wait for the audio clock to reach the impact's timestamp —
not for the scheduling call, which precedes it by up to 160 ms. The scene pulse
starts when the audible release reaches its timestamp.

## The gameplay reward

`startStarfall` (`runtime.js:1349-1358`) and `tickStarfall`
(`runtime.js:1359-1370`):

- `left = total = PAYLEN` (9.23 s), `next = PAYLEN/3`, `wave = 0`
- invulnerability for `PAYLEN + 0.6`
- `novaBlast` clears red, three waves of five double-value stars each
  (`starfallWave`, capped at 30 live stars), a `scenePulse('drop', 3.5)`
- teaching state is cleared: no lesson competes with the release
- at the end, `G.starfallResult = {at, got, score}` — an actual score/count result

**A Starfall interrupted by a black hole keeps its remaining waves and time.**
`tickStarfall` re-extends `G.invuln` every frame from the *current* `G.t`, so a
detour that advanced the run clock does not eat the earned safety. Scheduler
cleanup (`endSection`) must not reissue it as another earned reward — that is why
`endSection` refuses to re-bank a section already in flight.
