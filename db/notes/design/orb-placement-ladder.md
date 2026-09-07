# How an orb reaches the board, and why the order is what it is

**What this answers:** the exact precedence of `spawnPow`'s branches, what each
one is protecting, and which past bug each ordering decision was bought with.

Source: `src/game/runtime.js:5930-6080`.

## The ladder, top to bottom

1. **The lab.** `LAB.type`, placed every time — the lab exists precisely because
   the rules below are the obstacle.
2. **The intro trio** — `G.introN < POW_INTRO.length`: shield, then slow-mo, then
   nova. Counted on `introN`, which resets **per run, not per level**.
3. **The shield pity rule** — `G.sinceShield >= 3`. Never more than three
   placements without a shield. It sits above every optional offer *including the
   black hole*, or a rare roll could break the three-placement promise.
4. **The black hole guarantee** — `G.level>=4 && !G.bhRun && !G.bhPlaced`, gated
   on its own cooldown and `!bhActive()`.
5. **The black hole roll** — `G.level>=3 && Math.random()<0.05`.
6. **hypernova** (level ≥ 2), **mirror** (≥ 4), **scorch** (≥ 5), **magnet/spot**
   (≥ 3), **slipstream** (≥ 2), **star trail** (≥ 3) — each once per run.
7. **The weighted fallback roll**, `POWPOOL`.

## Why the black hole branches sit at position 4-5 and not at the bottom

They used to sit at the **bottom**, below hypernova, the pity shield, the bass
bomb and the spotlight — seven guaranteed placements — and `startGame()` re-armed
every one of those flags at each level boundary. So a run that had already met
them all on levels 1 and 2 spent level 3's first fifty seconds meeting them again
before the black hole could roll once. At the measured cadence of ~7.5s per
placement that put the first roll at ~56s; **the median recorded level-3 run dies
at 55s, and 64% of them ended having never reached a single roll.** Telemetry
agreed: three `blackhole_entered` events in the game's whole history, every one of
them on level 4.

The reorder is safe because the branches it jumps are **patient** and this one is
**impatient**: `hyperPlaced`/`spotPlaced` persist until satisfied, so delaying them
by one placement costs nothing, while a per-placement die that is never rolled is
simply gone.

## Why the guarantees are once per RUN and pre-spent

`startGame()` runs on every level advance as well as every new run, and every
"placed" flag reset unconditionally. Measured on one climb: **HYPERNOVA guaranteed
on L2, L3, L4, L5 and L6; SPOTLIGHT five times** — and level 5 opened with six
marquee arrivals in 54 seconds, burying SCORCH and THE NARROWS, the only two
things level 5 actually introduces. `curriculum.mjs`'s own trace showed BLACK HOLE
banners on L3, L4, L5 *and* L6 of a single playthrough. The orb whose entire
design is that it is rare — *"a thing you meet twice a minute is a mechanic, not
an event"* — had become the most reliable pickup in the back half.

The fix (runtime.js:6250-6254) resets the flags only when `carried` is false —
i.e. a genuinely fresh run — and **pre-spends** every guarantee whose home level is
already behind the level the run opens on:

```
G.hyperPlaced = G.level>2;  G.spotPlaced  = G.level>3;
G.mirrorPlaced= G.level>4;  G.scorchPlaced= G.level>5;
G.slipPlaced  = G.level>2;  G.trailPlaced = G.level>3;
```

So a 1→6 climb meets each orb exactly once, on its home level, and a picked
REDSHIFT start is not owed four marquee placements in its first minute. The
level-floored fallback roll still lets the earlier orbs appear.

`carried` is `!!G.carryScore`, read **before** the carried score is consumed and
zeroed ~100 lines above (runtime.js:6102). Reading `G.carryScore` at the flag site
is always false, which is the exact bug the flag exists to fix.

## `POWPOOL` and the redistribution rule

```
[['shield',0.302,1],['warp',0.185,1],['nova',0.143,1],
 ['spot',0.134,3],['hyper',0.076,2],['mirror',0.080,4],['scorch',0.080,5],
 ['slip',0.095,2],['trail',0.095,3]]
```
(runtime.js:6046-6053; third column is the minimum level.)

Two standing rules are visible in these numbers:

- **Removal is proportional.** The magnetar's 0.11 and the bass bomb's 0.15 were
  each redistributed across the survivors rather than handed to one of them:
  removal changes what can appear, never how often the others appear relative to
  each other. Addition follows the same rule in reverse — the five existing orbs
  kept their ratios exactly and the two new ones took a flat share off the top.
- **The roll respects the same level floors as the guarantees.** It used to draw
  from all seven on any level, so a first-ever run on LIFT OFF could be handed
  the spotlight — level 3's orb — at 37% of every post-intro placement, un-teaching
  the introduction schedule. Filtering by floor and renormalising keeps every
  surviving ratio exactly.

## A guarantee to *offer*, not to consume

Declining a black hole used to cost the full 55-second cooldown *and* permanently
satisfy the level-4 guarantee — so the one orb the game expects you to refuse was
the one whose refusal cost the most. Taking one arms 55s; declining arms 20s
(runtime.js:6059-6066). `bhPlaced` marks the *offer* as spent, which is the only
kind of guarantee an optional thing can carry.

## Placement counts placements, not pickups

`G.sinceShield` and the trio counter advance when an orb is **placed**
(runtime.js:6074-6079). A player who misses the slow-mo still advances the
curriculum; otherwise a run spent dodging would serve nothing but shields forever.
A pity shield placed while the trio owes one counts as the trio's shield, because
the thing the slot exists to show has just been shown.
