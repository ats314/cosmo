# The black hole: thirteen features nobody could see

**What this answers:** the standing lesson from Cosmo's most instructive shipped
failure, and the three separate times the same sign error hit this one mechanic.

## The report

The mode shipped with thirteen documented sub-features. A playtester who had run
it many times could see one: *"nothing but some purple color."*

Every one of the thirteen was present in the source. **None of it was visible from
the code: every feature read correctly at its own site, and each was disabled by
something somewhere else.** Only measurement found them. That sentence is the
lesson — it is why `fxcheck`, `drawcheck`, `rendercheck` and `musiccheck` exist in
the shape they do, and why "it is in the source" is not accepted as evidence
anywhere in this repository.

## The clause-by-clause table

| The pitch said | What was actually wrong |
|---|---|
| "a super cool black hole backdrop" | The arena-scale art was gated on `BG` — i.e. on **WebGL having failed**. It rendered only where the shader had given up. |
| same | The shader's lens `0.18/(brd+0.15)` exceeded `brd` inside 0.356 uv, **inverting the UV field** across the middle of the screen: the gravity well darkened nothing and the disc drew as arcs behind the HUD. |
| same | `pow((rr-dR)/dW, 2.0)` — **`pow` with a negative base is undefined in GLSL ES**, and the base is negative for every fragment inside the ring radius. |
| same | Every term measured from the **screen** centre, 41.8px off the arena centre on a notched phone. `uBH` pinned at 1.0 for all 17s. |
| "the existing music immediately cuts out" | `musicStep` stopped scheduling, but the pad is eight continuously running oscillators whose gain lives in `bedTick`, which knew nothing about the mode. **54% of the mix was identical either side of the entry.** Same bug the drop's hush had, never generalised. |
| "super trippy and ominous" preset music | Tuned voices at gain 0.011–0.016 against the band's 0.050–0.085; **zero energy above 2 kHz** on a device that reproduces little below 500 Hz; the "metallic resonance" passed a pitch to `hat()`'s *highpass-corner* argument; the second heartbeat's `bar>=8` guard could never fire because 17s is 7.37 bars. |
| "extended slow motion" | 0.55× — the same factor the slow-mo orb already uses. And the dilation reached the simulation and stopped: ~15 visible layers ran on raw `dt` while 8 slowed. **The depth of the number was never the problem.** |
| same | The **tempo never changed** — 104 BPM in, 104 BPM inside, 29 identical quarter notes. In a rhythm game that is the one clock the player reads without ambiguity. |
| "something cool to look forward to" | The mode was named on screen for **0.92s of 18.7s** — a floating pickup popup — while HYPERNOVA, half its length, holds a standing label for 100% of its life. `G.banner` was never set, and the one explanatory sentence is a once-per-device lesson consumed at the first pickup, so **every black hole after a player's first was wordless.** |
| "double/triple amount of red obstacles" | `spawnGap()/bhDensity()` was drained by a timer ticking on **`sdt`, the slowed clock**, so real arrival was `0.55 × bhDensity()`: **0.825× at entry**. Net effective pressure measured **0.83× — the mode was easier than the level it interrupted.** |
| "one more super small inner ring" | A fourth ring on a uniform draw is a **divisor**: the same budget over four orbits is 0.75× the per-ring density of three. |
| "harder and easier simultaneously" | The gravity pull ran **backwards** and the 2× star bonus paid on the safest ring. Both systems that exist to price risk paid for avoiding it. |
| "it's optional" | Declining cost the full 55s cooldown *and* permanently satisfied the guarantee. |

## The inversion that has now hit three times

`docs/engine/implementation.md` and `tools/fxcheck.mjs:374-389` both name it:

1. **The gravity pull** that "dragged the comet inward" pushed it outward.
   `RAD_BH` is `[1.0,0.80,0.62,0.45]`, so index 0 is the **outermost** orbit, and
   `G.ringI--` walked the comet to the widest, safest, emptiest ring and then
   stopped there forever because the guard was `G.ringI>0`.
2. **The "inner ring 2×" bonus** paid on the outer ring — the same index confusion,
   in the reward instead of the threat.
3. **The composite lens** shipped pointing the wrong way. It is *inverse*
   sampling: reading from a smaller radius magnifies, so subtracting the pull
   shoves every halo *away* from the singularity. Measured on the first cut:
   **+6.8px at 0.10 of screen height, +8.8px at 0.20** — the right magnitude,
   pointing the wrong way. Corrected: −6.2px and −8.6px at the same radii.

Every one read as correct, **because the code and the comment are both true under
some reading of which way the number counts.** Reading cannot catch it.

**What works:** asking where a specific thing *ends up*, in pixels or in ring
index, and asserting that. `fxcheck.mjs` parses the lens coefficients out of the
shader (so retuning the shader retunes the check) and asserts the displacement is
inward; `smoke.mjs:507-530` parks the comet on the outer ring, runs past one pull
interval and requires `radiusOf(G.ringI) < radiusOf(0)`.

This is the origin of the invariant *"Ring index 0 is OUTERMOST. Increasing the
index moves inward. Test gravity and rewards against actual radius, not an
ambiguous ordinal."*

## The fourth ring is possible because the orbits re-space

The naive version was measured and rejected. Adding a ring **inside** the shipped
three puts it at f=0.33 — 55px from centre on a 390px phone — where `hitTol` makes
one shard block **35.7°** of the orbit, a tenth of the circle behind one crystal.

Re-spacing all four across the same annulus — `RAD_BH = [1.0, 0.80, 0.62, 0.45]`
against `RAD_OFF = [1.0, 0.76, 0.545, 0.0]` (runtime.js:204-206) — puts the
innermost at 75px, where a shard blocks **26.2°**, against the shipped inner ring's
21.6°. A step, not a cliff.

The original rejection also did not account for the arena being an ellipse
(`AY ≈ 1.41` in portrait): the re-spaced gaps are 33/30/28px horizontally but
**47/42/40px vertically**, wider than the gaps the shipped three rings already run
at their tightest, against a 7.4px comet and a 9.3px shard.

`RADII` is therefore live and eased. The halos are baked once at `RAD_BAKE` and
scaled at draw time, so a warp costs no re-bake. **The comet's ring index never
changes during a warp** — only the radius that index resolves to — so nothing about
position, collision or input has to know it is happening.

## The current contract

`BH_DUR=17`, `BH_ESCAPE=12`, `BH_PULL=4`, `BH_HORIZON=600`
(runtime.js:2241-2248). Success pays
`round((80 + 600*charge + 20*stars) / 1.5^min(3, shieldsSpent))`
(runtime.js:2358). Missing the exit loses the bank and one shield, or the run
without one. The rare roll is 5% from level 3; the guarantee to *offer* is once
per run on level 4.
