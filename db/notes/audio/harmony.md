# Every pitch is an interval over the level's tonic

*What this answers: the one rule that governs all pitched sound in Cosmo, how
it is implemented, where it can be violated, and what the six keys actually are.*

## The rule

**No pitched voice in the game may be an absolute frequency.** Every one is
written as an interval over the level's tonic, and there are exactly three
mechanisms that carry it:

1. **`PENT` is rescaled per level.** `applyLevelMusic` (`runtime.js:3513-3517`):
   ```js
   const L = LV[G.level-1];
   for (let i=0;i<PENT.length;i++) PENT[i] = PENT_BASE[i] * L.key;
   applySect(0);
   ```
   `PENT_BASE` (`runtime.js:2947-2949`) is A minor pentatonic —
   `[440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568,
   1760, 2093, 2349.32, 2637]`, fourteen degrees. Every hook, riff, solo, star
   run and answering melody is written as **indices into `PENT`**, so they
   transpose by construction and can never leave the key.

2. **`CH[0][0]` is "the level's tonic"**, read by roughly twenty-five call
   sites. `applySect` guarantees chord 0 of both the verse row and the chorus
   row is the i chord, so `CH[0][0]` never stops meaning the tonic even when the
   chorus opens on a different chord (that is what `CHOFF` is for).
   Fixed intervals are written as ratios over it:
   - the snare body: `CH[0][0]*1.7818` — a minor seventh (110·2^(10/12) = 196.0,
     so level 1 is unchanged to the cycle) (`runtime.js:1167`)
   - the drop's boom: `subF(f*0.374577)` — the fifth below the tonic, an octave
     and a fourth down, 2^(−17/12) (`runtime.js:1466`)
   - the braam's fifth: `f*1.49831` (`runtime.js:3527`, `runtime.js:1621`)
   - the black hole's tritone: `root*1.12246` (degree 2) and `root*1.58740`
     (flat 6) (`runtime.js:2402-2403`)
   - the drum fill's toms: `kf = CH[0][0]/110`, applied to the figure written in
     A (`runtime.js:1595`)
   - every in-run reward cue, written as `CH[0][0]*(old/110)` — the orbit payout
     arpeggio, the score milestone, the shield save and pickup, the ring unlock,
     the level-start chime. Level 1 is bit-identical to what shipped because its
     key multiplier is 1; every other level finally hears its own rewards in its
     own key.

3. **`chTone(ix)`** (`runtime.js:2209-2213`) resolves an index against the chord
   sounding **right now**, not against a scale:
   ```js
   const ch = CH[MU ? chI((MU.step/8)|0) : 0];
   const i2 = Math.max(0, ix|0);
   return ch[i2%4] * (1 << ((i2/4)|0));
   ```
   Indices 0-3 walk the voicing (root, octave, third, fifth); each block of four
   is an octave up. Everything the player triggers speaks through this — taps,
   hops, star pickups, the finale's call phrase, `cueUnlock`/`cueLesson`/
   `cueState`. A tap is a chord tone of *this bar* by construction.

## The constraint that makes it work

`PENT` is a **minor pentatonic**: tonic, third, fourth, fifth and seventh of the
natural minor. It is consonant against any triad built from the natural minor,
and it is **not** safe against chords borrowed from outside it — a major
dominant, the obvious way to make a minor progression sound finished, puts a
raised leading tone a semitone under the pentatonic's own seventh in every
sound effect in the game.

That is the entire reason every row of `PROG` and `PROGB` is diatonic to its own
natural minor and no other (`runtime.js:2940-2946`). It is a constraint on the
chords imposed by the SFX layer, not an aesthetic preference. `musiccheck`
enforces it numerically (`tools/musiccheck.mjs:960-997`).

Two concrete casualties recorded in the source: L3's chorus wanted Protovision's
harmonic-minor V and got VII–i instead; L4's chorus wanted Odd Look's major V
and got the diatonic v.

## The register turnaround: `subF`

`runtime.js:1089` — `function subF(f){while(f<40)f*=2;return f;}`

The six keys descend a whole tone each, so by REDSHIFT and HEAT DEATH the
drop's boom had fallen to 26 and 23 Hz and the tonic-half drones to 35 and
31 Hz — below what any phone reproduces at all, so the game's biggest hits were
literally silent on the two newest levels. `subF` octave-doubles anything below
40 Hz, keeping the **pitch class** (a sub an octave up is the same note with
actual air behind it) while turning the sounding register around.

Callers: the drop's sub and boom, `payoffStep`'s floor, `braam`, `soundImpact`,
the layer-3 sub drone, `bhStep`'s low tonic.

The pitch class keeps descending — which is what the ear tracks — while the
sounding register turns around. That is what a bass player does walking a line
down and jumping back up.

## The six keys

`LV[].key` (`runtime.js:3008-3080`) is the multiplier applied to `PENT_BASE`:

| # | Level | `key` | Tonic (from PROG chord 0) |
|---|---|---|---|
| 1 | LIFT OFF | 1 | A — 110 Hz |
| 2 | INTO THE RINGS | 0.8909 | G — 98 Hz |
| 3 | THE STORM | 0.7937 | F — 87.31 Hz |
| 4 | EVENT HORIZON | 0.7071 | Eb — 77.78 Hz |
| 5 | REDSHIFT | 0.6300 | Db — 69.30 Hz |
| 6 | HEAT DEATH | 0.5612 | B — 61.74 Hz |

A, G, F, Eb, Db, B — six whole steps, exactly one lap of the whole-tone scale.
A seventh level would be A again, an octave below where the game opened. That
is the stated reason there are six levels and not five or seven.

`PROG`'s roots are written **absolutely** and level 6's tonic *is* the literal
descent at 61.74 Hz. The turnaround happens in the arrangement (L6's bassline
rides `ch[1]` an octave up and touches `ch[0]` only on the downbeat) and in
`subF`, not in the table. An earlier version of the source comment claimed the
tables were voiced up an octave and that `musiccheck` pinned a 60 Hz floor;
neither was ever true, and the comment now says so.

## Where the tables live

| Table | Anchor | What it is |
|---|---|---|
| `PENT` / `PENT_BASE` | `2947-2949` | 14 degrees of minor pentatonic; live copy rescaled per level |
| `CH` | `859-862` | the **live** four-chord row, overwritten by `applySect` |
| `ARP` | `866` | the **live** arp contour, overwritten by `applySect` |
| `PROG` | `3320-3372` | six verse progressions |
| `PROGB` | `3449-3472` | six chorus progressions |
| `CHOFF` | `3473` | `[1,2,0,3,1,1]` — where each chorus's walk begins in its row |
| `ARPL` / `ARPBL` | `3373-3374` / `3499-3500` | verse / chorus arp contours |
| `SEVB` | `3489-3496` | the chorus color tone, one seventh per chord |
| `HOOKL` / `HOOKBL` | `925-996` / `998-1012` | payoff hook and its second ending |
| `ANSWERL` | `1020-1026` | the answering melodies |
| `RIFFL` / `SOLOL` | `3375-3381` / `3382-3399` | layer-2 riff and afterglow solo |
| `STARRUN` | `875` | the hypernova run |

`applySect(s)` (`runtime.js:3505-3511`) is the **only writer of `CH` and `ARP`**.
It copies a row set; everything downstream — the pad retune, `chTone`, every
bassline, every bass reader — follows by construction. It is callable at any
time: the pad retunes at the next bar line, not inside the call.
