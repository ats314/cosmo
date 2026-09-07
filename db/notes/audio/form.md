# The form: verse, chorus, payoff, afterglow — and what is left of the drop

*What this answers: how the song's horizontal axis works, what earns a lift,
what an earned Starfall section actually plays, and which documented parts of
the drop no longer run.*

## Two axes

- **Vertical (layers)** — how much of the arrangement is audible. Driven by the
  difficulty clock `k`, `PLAY.heat`, ring depth, score, sky band and tier. See
  `db/notes/audio/arrangement-layers.md`.
- **Horizontal (form)** — *which* progression is playing. Verse (`PROG`) or
  chorus (`PROGB`). `MU.sect` is the flag; `applySect` is the only writer.

## The lift

`musicStep`, `runtime.js:1658-1675`. Evaluated **only** at `i===0` — once per
four-bar loop, at the seam, when nothing else owns the harmony:

```js
if (i===0 && MU.pay<=0 && !MU.rise && !MU.armed && !FIN.on && !bhActive() && MU.barN>=8) {
  const hotSect = (G.od>0 || G.hyper>0 || t<MU.glow || G.groove>=4 || G.lapStreak>=2 || PLAY.heat>0.50);
  let wantB = MU.sect;
  if (hotSect) wantB = 1;
  else if (MU.sect && MU.barN-MU.sectAt >= CHOR_HOLD) wantB = 0;
  ...
}
```

Six roads in, and each is a real earning:

| Road | Meaning |
|---|---|
| `G.od>0` | overdrive |
| `G.hyper>0` | hypernova |
| `t < MU.glow` | the payoff afterglow — the guaranteed road |
| `G.groove>=4` | a timing chain of four |
| `G.lapStreak>=2` | two clean orbits |
| `PLAY.heat>0.50` | sustained engagement |

**Cold play never lifts.** `musiccheck` holds that at heat 0 a level voices its
verse row and nothing else, forever (`tools/musiccheck.mjs:310`). A form clock
that lifted the record on its own after sixteen bars was written and rejected by
the harness in one line — *"the chorus engaged at heat 0 — the lift is free"* —
and deleted. A chorus nobody earns is wallpaper.

`G.lapStreak` was the fix that saved the chorus after drops were made rarer:
heat is +0.26 a tap against 0.34/s of decay, so it spikes and collapses and only
frantic input holds it — which is the exact behaviour the saucer exists to
discourage. A clean orbit is sustainable. The player who travels gets the song,
not the player who mashes.

`CHOR_HOLD = 12` bars (`runtime.js:3482`) — ~28 s at 104 BPM — is how long an
earned chorus survives after the hot state lapses. Entry is untouched; this
governs only the exit. Without it the section read as a flicker.

The lift is **frozen** while a drop is armed or in flight, inside a black hole,
and during the star dive. `endSection` always lands back on the verse
(`if(MU.sect)applySect(0);`), and the first eight bars of a level are always the
verse — the song states its home before it leaves it.

## What the chorus changes

1. **The chords** — `PROGB[level-1]`, walked from `CHOFF[level-1]`.
2. **The arp contour** — `ARPBL` instead of `ARPL`, same even-eighth grid, same
   0-4 degree ceiling.
3. **The color tone** — `SEVB[level][cix]*2`, one sustained seventh a bar
   (`runtime.js:2057`). The only place extensions live; the arp and every riff
   stay plain pentatonic.
4. **The lean** — an open offbeat hat (levels 1-3), a sixteenth ghost instead
   (levels 4-6, which all ride an offbeat hat of their own), and a half-time
   backbeat snare.
5. **A deeper pump** — the bar-line dip goes to 0.80 instead of 0.84.
6. **A brighter pad** — +200 Hz on the cutoff.
7. **Level 1 and 2's bass switches to driving root eighths.**
8. **A tight tap pays +8** (`judgeTiming`'s `MU.sect===1` branch).

**The yield rule** governs every addition: each yields wherever its slot already
has that tenant. `skyI` floors at `G.level-1`, so level 4 has carried sky band
3's beat-4 snare since its first bar — the chorus backbeat used to double it,
~+4.6 dB on one slot, on the level good players live in. Level 3's floor is
band 2, whose signature *is* the open offbeat hat. The chorus is the harmony
moving, never the same drum twice as loud. `musiccheck` runs the harness at each
level's sky floor and fails on a doubled snare body
(`tools/musiccheck.mjs:517-532`).

## The payoff section

`payoffStep` (`runtime.js:1480-1542`), eight bars, `PAY = 32` eighths, 9.23 s.

```
bar 0-1  the hook states itself                          (HOOKL, or HOOKBL on alternate sections)
bar 2-3  the ANSWER                                       (ANSWERL — authored, plays with no input)
bar 4-5  the hook returns, drums at four times the rate    ("late": pb>=2)
bar 6    the answer's grammar continues
bar 7    the written descent, landing one eighth before the loop resumes
```

`PAY = 2 × STEPS` is load-bearing: `MU.step` returns to 0 exactly as the section
ends, so the chord walk stays aligned and the seam lands on a downbeat.

Three readings rotate on `MU.payN%3` so two drops in a row never state the hook
identically:
- `voice 0` — plain
- `voice 1` — a triangle a third under every note (fifth-doubled and dark)
- `voice 2` — a square five degrees up, and pickup ornaments open

`MU.crown = ringOf()` at fire time sets how *rich* the section plays, never how
much it pays: an inner-ring drop states the hook doubled at the octave with the
full swing; an outer-ring drop plays it lean.

`MU.flavor` is the earning style and colours the section: `'orbit'` sustains its
notes 1.7×, `'ember'` adds a wet ghost hat, `'hop'` opens the swung sixteenth,
`'time'` sets `MU.lateAt=2` so the double-time bars arrive two bars early.

Every payoff kick calls `pumpKick`, dipping `A.pump` to 0.70 and recovering with
a 0.09 s time constant, written in the same call.

`payoffStep`'s last act: `MU.glow = t + 16*SPB` — a **sixteen-beat (four-bar)**
afterglow during which every arrangement gate is held open, the solo plays, and
the chorus is guaranteed.

## The solo

`runtime.js:1901-1908`. During `t < MU.glow`, `SOLOL[G.level-1][i%32]` plays a
sawtooth at `PENT[min(8,d)]` (the solo sings, it does not shriek), wet through
the dub delay at 0.6, with a `beep` slide 4% below the target pitch as the
hammer-on. The drop no longer ends; it hands off.

## The drum break

`breakStep` (`runtime.js:1594-1609`), one authored bar of toms and snares
descending, then a crash on the next downbeat (`MU.brkEnd`, handled back in
`musicStep`). Opened by `PLAY.heat>0.55 && G.od<=0 && k>0.22 && t>=MU.brkCool`,
or forced by `G.odBrk` when overdrive ends — "it ends the way a record ends: on
the break". Cooldown 30 s. Never while a drop is armed, rising or banked.
The player's movement instrument does not change; no caption asks for taps.

## Overdrive

`runtime.js:8044-8058`. Hold `PLAY.heat > 0.75` for `SPB*8` (a full bar, ~2.3 s)
and `G.od = 64` — eight bars of double-time sixteenths with every gate held open,
embers and on-beat taps paying double. 45 s cooldown. Never while a drop is in
flight; a drop that fires mid-overdrive **absorbs** it (`musicStep:1696` sets
`G.od=0` before `fireDrop`).

## What is retired

The documented three-part drop — *a rise, a silence, and the hit* — is now only
the hit. See `db/notes/audio/retired.md` for the full list, but in summary:

- `MU.rise` is never set true. `musicStep` has `const rn=-1, rise=false;`
  (`runtime.js:1698`) followed by an `if(rise)` block that can never execute.
- `schedulePreDrop` — the hole, the −26 dB hush, the 8 ms restore landing on the
  beat, the filter slam — has **no caller**.
- `PAYREST = 0`, so the cooldown between sections is zero.
- The escalating drop cost (1.0, +0.8 each, capped) documented at length in
  `docs/design/audio.md` is gone: `build()` now counts **only completed
  star-fed orbits** and `dropNeed()` returns 3, or 2 with the `hairtrig`
  upgrade. `DROP_STEP` and `DROP_STEP_MAX` are both 0 and have no readers.
