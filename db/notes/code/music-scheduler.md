# The music scheduler: what `musicStep` decides, in what order

**What this answers:** how one 590-line function produces six different songs
with sections, layers, per-ring kits and set-piece takeovers — and which branch
wins when two want the same eighth.

`musicStep(i, t, k)` lives at 1623–2207. `i` is the step index (0–31, eighths,
four bars), `t` is the audio-clock time to schedule at, `k` is
`min(1, dl()/150)` — the difficulty clock, normalized (2688).

## The lookahead

`musicTick()` (2673) is the only caller. It runs from `bedTick`, which runs from
`update()`, so it is on the frame loop but schedules on the audio clock:

- If not playing, it ends any live section and zeroes `MU.next`.
- If `MU.next` has fallen more than 0.4 s behind, it abandons the phrase rather
  than replaying it compressed — this is the backgrounded-tab path.
- Otherwise it schedules while `MU.next < now + 0.16`, capped at 16 steps per
  tick, advancing `MU.step` mod `STEPS` and `MU.next` by `SPB/2`.

Constants: `BPM = 104`, `SPB = 60/BPM`, `STEPS = 32` (858). `S16 = SPB/4` (905).

## Dispatch order inside `musicStep`

Order is the whole design; each early return means "this owns the bar".

1. **Section decision** (1658–1687) — only at `i === 0`, only when no drop is in
   flight and `MU.barN >= 8`. Hot play (`G.od>0 || G.hyper>0 || t<MU.glow ||
   G.groove>=4 || G.lapStreak>=2 || PLAY.heat>0.50`) lifts to the chorus; the
   chorus then holds for `CHOR_HOLD = 12` bars (3482) after the hot state lapses.
   Cold play never lifts — `musiccheck` holds that line.
2. **Chord retune** (1694–1700 region, at 1697–1702) — moved above every return
   deliberately, so the pad keeps tracking the progression while ducked, through
   the whole payoff and through a black hole, and comes back in tune rather than
   glissing into place.
3. `MU.barN++` on `beat === 0`.
4. **Black hole outranks everything**, including a section in flight:
   `if(bhActive()){bhStep(t);return;}` (1707).
5. **Payoff section**: `if(MU.pay>0){payoffStep(t,ch,k);return;}` (1708).
6. **Armed drop latches on the next quarter**: `fireDrop(t)` then `payoffStep`
   (1710–1712).
7. **Star dive**: `FIN.pend` reverts to the verse at a 16-step boundary and
   re-retunes the oscillators in place (the second write is load-bearing — the
   bar retune above already scheduled the chorus chord at this same `t`); then
   `finStep(t); return;` (1723–1729).
8. `G.chorusBars++` — placed below every handoff so the telemetry counts bars the
   chorus arrangement actually owns (1741).
9. **Drum break** — eight eighths of `breakStep`, gated on overdrive-end or heat,
   `MU.brkCool = t + 30` (1745–1755).
10. **Sparse arrangement** (`!driving`, 1770–1789) — a separate authored
    arrangement, not the busy one turned down. `driving` is
    `hot || MU.sect || G.groove>=3 || G.lapStreak>=2 || PLAY.heat>0.45 || ringOf()>0`.
11. Everything after that is the driving arrangement: root, ring-0 kick, sidechain
    pump, per-level basslines (L1 walks, L2 pushes off the beat, L3 rolls, L4 jumps
    the octave, L5 leans 3+3+2, L6 rides the octave), the afterglow solo, the arp,
    the per-ring kit (`RINGS[].sub`), the string swell and riser, per-level kit
    identities, the chorus lean, the sky-band flavour, the score-layer ladder, the
    overdrive double-time, the hypernova star run, and `powerColour`.

## Section form

`applySect(s)` (3505) is the **only** writer of `CH` and `ARP`. It copies a row
set: `PROG[level-1]` / `ARPL[level-1]` for the verse, `PROGB` / `ARPBL` for the
chorus. `applyLevelMusic()` (3513) rescales `PENT` from `PENT_BASE` by `LV[].key`
and always opens on the verse.

`chI(bar)` (2208) resolves which chord is sounding: the verse walks its row in
place; the chorus rotates by `CHOFF[level-1]` = `[1,2,0,3,1,1]` (3473). This is
what lets a chorus start off-tonic while `CH[0]` stays the i chord that roughly
twenty-five call sites read as "the level's tonic". `chTone(ix)` (2209) resolves
an index against the chord sounding right now — 0–3 walk the voicing, each block
of four an octave up — and every player-triggered pitch goes through it.

Keys descend a whole tone per level (`LV[].key` 1, 0.8909, 0.7937, 0.7071,
0.6300, 0.5612), one full lap of the whole-tone scale. Every chord in `PROG` and
`PROGB` is diatonic to its level's natural minor, because `PENT` is scaled by the
same key and every sound effect in the game speaks through it — one borrowed
chord would put the whole SFX layer out of tune. `musiccheck.mjs` enforces this,
plus the "row slot 0 is always the i chord" rule and both halves of the chorus
entry/exit rule.

`subF(f)` (1089) octave-doubles anything below 40 Hz, which is what keeps level
5's and level 6's sub voices audible after the key descent.

## The payoff

`PAY = 32` eighths = 8 bars = `PAYLEN = PAY*(SPB/2)` ≈ 18.46 s. `PAYREST = 0`
(905). `PAY = 2*STEPS` is load-bearing: `MU.step` returns to 0 exactly as the
section ends, so the chord walk stays aligned and the seam lands on a downbeat.

`payoffStep(t, ch, k)` (1480) authors all eight bars. Bars 0–1 state the hook
(`HOOKL[level-1]`, 925), bars 2–3 and 6 play `ANSWERL[level-1]` (1020), bars 4–5
alternate with the second ending `HOOKBL` (998) on every other section, bar 7 is
the written descent. `MU.crown` (the ring the drop fired from) sets richness;
`MU.flavor` (the earning style) flavours the texture. `pumpKick` writes its dip
and recovery in the same call.

## The player's instrument

`performerHit(kind, dir, ring)` (2649) schedules the tap/hop note on the nearest
sixteenth via `gridNear()` (2445), with a one-note-per-slot guard
(`Math.abs(slot-PLAY.slot)<1e-4`) that exists because held-key auto-repeat was
stacking three or four notes into a single sixteenth. Pitches come from
`chTone`, timbre from `RINGS[ring]`, gain from `PLAY.heat` and the groove return.
Everything routes to `A.perf`.

`judgeTiming(x, y)` (2533) is the groove chain and the bias learner. `TIGHT =
0.032` (2516), widened to 0.045 by the `steadyhand` upgrade. Three tiers: CLIMB
(tight against the quarter) raises the chain, HOLD (tight against the sixteenth
only) refreshes its decay clock without climbing, SLIP costs one rung. The bias
is an EMA over taps plausibly aimed at the grid, with twelve fast samples
reserved for quarter-plausible taps and a ±3 ms/tap slew after that, clamped to
±0.12 s.

`cueTone(fn)` (2466) is the universal "the game's reply lands on the grid"
wrapper: one voice per sixteenth slot, a taken slot cascading to the next, capped
a beat out. Every ember, orbit, shield, milestone and unlock goes through it.
