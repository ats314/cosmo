# The vertical axis: every gate that adds or removes a voice

*What this answers: exactly what has to be true for each instrument to be
audible, and which of the five independent ladders it belongs to.*

There are five independent axes stacked on the same 104 BPM grid. None of them
changes tempo or key. All live in `musicStep` (`runtime.js:1623-2176`) unless
noted.

## 0. The calm / driving switch

`runtime.js:1770-1790`. This is the coarsest gate and the one the direction
document cares most about:

```js
const hot = G.od>0 || G.hyper>0 || t<MU.glow;
const driving = hot || MU.sect || G.groove>=3 || G.lapStreak>=2 || PLAY.heat>0.45 || ringOf()>0;
```

If `!driving`, the whole rest of the function is skipped and a **sparse
arrangement** plays instead:

- one kick on beat 0 at gain 0.035
- a few separated `bassN` notes on the level's own rhythmic shape:
  `calls = [[0,5],[1,6],[0,4],[0,6],[0,3,6],[0,6]]` — one row per level, the
  eighths where the bass speaks
- one long arp tone on beat 2, an octave down, `SPB*1.6` (≈0.92 s), echo 0.42
- a string swell on odd bars
- `powerColour` (mirror / scorch)

So **ordinary outer-ring flight with cool play** is genuinely a different
arrangement, not the busy one turned down. Moving inward, chaining three
timing hits, holding two clean orbits, or earning any hot state opens the
engine. Late-world difficulty alone cannot: `k` appears nowhere in `driving`.

## 1. The difficulty clock, `k`

`k = min(1, dl()/150)` in `musicTick`. Front-loaded deliberately — the layering
used to reach full strength around six minutes in, which nobody heard. Gates
that read `k`:

| Threshold | Adds |
|---|---|
| `k>0.12` (or heat>0.20, or hot) | the `bassN` synth bass and its bar-line whaa |
| `k>0.18` (or heat>0.30, or hot) | the arp, on even eighths |
| `k>0.20` (or heat>0.30, or hot) | the string swell on odd bar lines |
| `k>0.25` (L6) / `k>0.30` (L3) | denser level hats |
| `k>0.30` (or heat>0.35, or hot) | ring 0's second kick, on beat 4 |
| `k>0.35` (or hot) | the bar-0 swell on even bars |
| `k>0.45` (or `gv>0`, or hot) | the 4.2 kHz hat on beats 2 and 6 |
| `k>0.5` (or hot) | the noise riser turning every fourth bar |
| `k>0.72` (or heat>0.65, or hot) | the counter-line, `CNT`, an octave down |

Every one of these also has a `PLAY.heat` or `hot` alternative — "playing hard
means hearing more, immediately".

## 2. The ring is the kit

`RINGS` (`runtime.js:210-220`) — four rows, `{wave, cut, lift, sub, tint}`:

| Ring | `wave` | `cut` | `lift` | `sub` |
|---|---|---|---|---|
| 0 outer | sawtooth | 1.00 | 0 | 0 |
| 1 mid | square | 1.18 | 380 | 1 |
| 2 inner | square | 1.42 | 820 | 2 |
| 3 accretion (black hole only) | square | 1.62 | 1180 | 2 |

- `wave` and `cut` are the **player's own instrument** — `performerHit` plays
  `rv.wave` at `(1500+1200*heat)*(1+0.16*groove)*rv.cut`. Inner rings are
  brighter and squarer.
- `lift` is added to the pad's cutoff in `bedTick` — the mix brightens with depth.
- `sub` drives the hat pattern (see below).

The **rhythmic identity** is in `musicStep` (`runtime.js:1952-1972`):

- **ring 0** — one kick per bar (beat 0, gain 0.050) and a second at half band
  (beat 4, 0.038). It used to be silent, which measured as the single biggest
  reason ordinary play never hit.
- **ring ≥1** — a half-time kick (beats 0 and 4), a low fifth `ch[3]/2` leaning
  into the turn on beat 3, and `ch[0]*2` on beat 6.
- **ring ≥2** — four-on-the-floor (adds beats 2 and 6) and a moving octave bass
  `ch[0]*2` on every odd eighth.
- **`sub>=1`** — the dry dark offbeat shaker, 4 kHz, echo 0.35, capped at 6.8 kHz.
- **`sub>=2`** — a swung sixteenth pair: `t+S16` at 4.4 kHz and a ghost at
  `t+S16*1.16` at 4.8 kHz.

Level kits **yield** to the ring kit rather than doubling it: L3's kick fires
only on ring 0, and L4's and L6's floors on beats 2 and 6 are guarded by
`rg2<2`. Two kick oscillators in one slot is mud, not emphasis.

## 3. Score buys the band

`LAYER_AT = [600, 1400, 2400, 3600]` (`runtime.js:881`),
`LAYER_NAME = ['NEW MUSIC: RHYTHM', 'NEW MUSIC: MELODY', 'NEW MUSIC: DEEP BASS',
'NEW MUSIC: HIGH NOTES']`.

| Score | Layer | Anchor |
|---|---|---|
| 600 | an offbeat electro pulse: `ch[0]*2` square on `t+S16`, even eighths | `2074-2075` |
| 1400 | the two-bar riff, `RIFFL[level-1][(bar%2)*8+beat]`, a saw+square pair an octave down | `2076-2083` |
| 2400 | a held sub drone, one triangle note a bar, `subF(ch[0]/2)` — **or the tonic pedal `subF(CH[0][0]/2)` on level 4** | `2092-2093` |
| 3600 | a high shimmer, `PENT[11]*0.5` sine on beat 7's sixteenth | `2094-2095` |

**One tenant per band.** Layer 2 (the riff) *replaces* the arp rather than
stacking on it — the arp is gated `if (G.score < LAYER_AT[1])`
(`runtime.js:1923`). The arrangement evolves; it does not accumulate.

Layer 3's pedal on level 4 is deliberate: EVENT HORIZON's progression is
i VI VII i, and pinning the sub to the tonic under it turns a chord loop into a
drone with harmony moving over the top. `musiccheck` asserts the pedal
specifically (`tools/musiccheck.mjs:890-909`).

The crossing is announced in `update()` (`runtime.js:8083-8095`): `say(...)` at
priority 2, a `braam(0.030)`, and a two-note `cueTone`. `startGame` seeds
`G.layerN` from the carried score so a level-2 start does not falsely announce a
layer that has been audible since the middle of level 1.

## 4. The tier ladder: the star's voice

`T_VOICE` (`runtime.js:4723-4726`) is derived from `TIERS` **by name**, not by
ordinal — the previous twelve hardcoded ordinals all shifted when DIVERS and
THE NARROWS were inserted and THE EYE moved from index 10 to 12.

```js
const T_VOICE = [0,
  TIERS.findIndex(t => t.name==='THIRD RING'),
  TIERS.findIndex(t => t.name==='BLINKERS'),
  TIERS.findIndex(t => t.name==='THE EYE')];
```

The star pickup voice (`runtime.js:8484-8525`):

| Rung | Voice |
|---|---|
| base | square + a 1.005-detuned saw + a sine sub octave |
| ≥ THIRD RING | square + a 1.007-detuned saw + sub — TWIN SYNTHS |
| ≥ BLINKERS | sawtooth lead + sub + a `beep` slide-in 6% flat — SYNTH LEAD |
| ≥ THE EYE | `gtr()` — a detuned saw pair plus the fifth into a hard clip — ELECTRIC GUITAR |

The pitch is `chTone(1 + min(4, (combo>>1) + (eco>0?1:0)))`, where `eco` cycles `[0,-1,1,0]` by bar — the pickup climbs the
**chord** with the combo, root to fifth to the octave voicing, so a chain of
stars is an arpeggio of the bar. It stays low and gets heavier (a kick thump
from ×2), never higher: "way too twinkly" was the playtest verdict on the old
voice that pitched up with the combo.

During a payoff it is replaced outright by a three-note run on the **player's
own bus** — collecting *is* soloing.

The arp's own waveform also steps: `av = G.tier>=T_VOICE[2] ? 'sawtooth' : 'square'`.

Announcements are keyed by **voice ordinal** (1/2/3) in `SND_SEEN`, not by tier
index. Keyed by tier index, TWIN SYNTHS and SYNTH LEAD announced twice per climb
and ELECTRIC GUITAR never announced at all. They defer across a black hole.

## 5. The sky flavours the kit

`skyI` (0-3), floored at `G.level-1` (`runtime.js:6300`):

- band 1 — swings its sixteenths (`t+S16*1.16` ghost on beats 2 and 6)
- band 2 — rides the classic offbeat open hat (3.6 kHz, 0.11 s decay)
- band 3 — leans heavy: kick on 0, snare on 4

Additive only; the ring's identity stays. Because `skyI` floors at `level-1`,
levels 4, 5 and 6 all sit at band 3 from their first bar — which is why their
level kits and the chorus lean deliberately avoid beats 0 and 4.
