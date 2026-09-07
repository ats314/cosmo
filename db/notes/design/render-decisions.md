# Rendering decisions: the things measurement overturned

**What this answers:** which visual approaches were built, measured and thrown
away, and the rules that generalised out of them.

## A stroke is a line; light is a gradient

Stated as a rule because it caught the file twice in one week:

> A stroke of constant colour has a hard edge on **both** sides, however wide it
> is. Widening it makes a thicker band, not a softer one. Anything meant to be
> light — a shock front, an accretion disc, a halo — needs a gradient across its
> width, and a radial gradient used *as the stroke style* gets that in one pass,
> because gradients are evaluated in user space.

- **The black hole's accretion disc** was two stroked ellipses, 9u and 5u wide, at
  0.62R and 0.78R, spun against each other. On screen: two big thin purple loops
  crossing the middle of the arena.
- **The nova front** was three concentric strokes — a 26u soft one, a hard white
  1.5–5.5u one at 0.85 alpha, and a thin inner echo. The middle one dominated
  completely: **a flat white circle sweeping the arena in the game's single most
  spectacular moment.**

## And one thing measurement said was fine

The hypernova ribbon's widest pass looked, in a screenshot, as though it had a hard
vertical seam at screen centre. Scanning the frame for the largest column-to-column
luminance step across that band returned **1.21/255 — half a percent**, below
perception; the same scan with the halo composite disabled returned 1.25, so the
composite was not implicated either. There was nothing there. **Changing it would
have been a guess wearing a fix's clothes.**

## Bloom never reads back the canvas

The textbook route — copy the frame into a small buffer and let the upscale blur it
— measures **~16ms here**, because pulling 1.3M pixels back out stalls the pipeline;
*spare budget does not help when one operation eats all of it.* Instead the bright
objects are re-drawn as crude blobs into a quarter-size buffer, upscaled back
additively. Precision there is pointless: bilinear filtering on the way up **is**
the blur. Costs about 0.3ms.

The bright pass stays on the CPU and stays **semantic** — it knows which objects are
lights, so it never thresholds a composited frame and can never pick up the rings,
the pool or the HUD.

## The mip cascade was built first and measured, and it fails twice over

One buffer can only carry one radius: how far a pass blurs is fixed by how far it is
upscaled, so the quarter-res buffer put the same tight collar on the hub lamp as on
a spark. An ember's light was gone 15px out, the comet's at 22px. Every other layer
of light here is several passes at different weights — the trail is three, the gate
bar two, the nova front three — and the bloom was the one that was a single flat
blit. **Light with no range reads as paint.**

The obvious cheap fix is a mip cascade. It fails twice (runtime.js:9070-9095):

1. **A box downsample preserves the peak** of any feature bigger than a buffer
   pixel, so a solid blob keeps full brightness at every level and the passes simply
   *sum* — the core came out **61% hotter** while the halo barely moved. *A
   brightness bug wearing a glow's clothes.*
2. **Bilinear is a separable tent**, so a tiny buffer blown up 40× spreads into a
   cross, not a disc, with a footprint that depends on where the object falls on the
   coarse grid. **Sliding one ember across a single coarse pixel swung its halo
   80%.** Everything in this game is in orbit, permanently crossing that grid.

Drawn discs are round by construction — 0.97 to 1.09 across the halo, **17% ripple
against the cascade's 80%**. Reach up ×3.6: ember 15px → 54px, comet 22px → 78px,
ratio holding 3.44–3.74 across viewports.

**Reach is measured to 1/255** — the outermost radius whose light can still tint an
8-bit pixel — as the maximum over a full circle in sub-pixel steps. *The threshold
has to be quoted or the number is not checkable.* The first cut stepped in whole
pixels off one ray and reported a before-gap of 4px between the ember and the comet,
whose discs differ by 7u: **two objects through the same filter chain cannot differ
in reach by less than their radii do.** That contradiction is what caught it.

Four measurements pull against each other and the dial was set against all of them
at once: reach, core brightness (**embers must stay gold — washing them white spends
the one colour that means "collect me"**), roundness, and how much a dense
late-game board hazes over. `HALO_A` is mutable at runtime so
`HALO_A=0.14` in the console re-weights the next frame — *the last word on how much
glow is too much belongs to eyes on a real screen.*

## Then the blur moved to the GPU, and the crawl went down by using a smaller buffer

Drawn discs bought roundness at the price of three arc+fills per light and a falloff
made of two stacked steps; a separable gaussian is a true convolution, round by
construction, and its grid is the ¼ bright buffer — four times finer than the ¹⁄₁₂
the mid halo was drawn into. **So the crawl goes *down* by moving the halo to a
smaller buffer, which is the opposite of how that sounds.** Two levels, ¼ and ¹⁄₁₆,
reached by way of ⅛: a single 4:1 read undersamples a source only smooth to σ≈2.

Weighted so the halo carries **the same light it did before** — a change of filter,
not a brightness change. Per light, halo term only, on a 390×844 phone: ember energy
1.04×, reach 54→64px, roundness 0.750→0.867; comet 1.06×, 79→84px, 0.828→0.935.
Sliding a light across one whole coarse pixel swung the old halo's reach 8.8% and
its peak 5.7%; the gaussian swings 3.5% and 3.2%. If any of it fails, `FX.on` goes
false and the two discs per light come straight back.

## The glow fell off the edge by reflecting into it

WebGL1 has no `CLAMP_TO_BORDER`, so a blur tap past the texture edge reads the edge
texel back — light that should slide off-screen was reflected into the outermost
band, **a thin bright frame at the border whenever the comet or its sparks passed
near it, compounded by every pass of the chain.** Measured with the shipped kernel:
**1.82×** the physical level at the border; a playtester photographed it.
Out-of-bounds taps contribute nothing now, so the border reads 0.55× — the energy
genuinely leaves the screen — and interior fragments are bit-identical, since all
their taps are in bounds. `fxcheck.mjs` parses the kernel out of the shader,
simulates the chain with whichever sampling semantics the source actually has, and
fails at 1.05× border gain.

## A lost context on the glow is silence, not an error

**Every call on a lost WebGL context is a no-op that does not throw.** So `fxResize`
would see unchanged sizes and return true, `drawArrays` would do nothing, and
`fxRender` would return *true* — compositing an empty canvas. Worse than the
backdrop's version of the same bug, which at least left a baked sky behind:
`bloomHalo` is set false before the dot loop, so the discs that exist for exactly
this would never have been drawn either, **and the glow would simply stop with no
way back.** `isContextLost()` is asked every frame, before anything else, and the
lost/restored listeners drop the six render targets — a restored context hands back
a new context object and every texture, framebuffer and program made against the old
one is dead.

There was also **no `webglcontextlost` handler of either kind**: iOS drops a WebGL
context under memory pressure, the default action makes restoration impossible, and
`GL.on` stayed true so the renderer kept issuing calls into a dead context while the
2D fallback that exists for exactly this never took over.

## The lens had to be re-derived, not copied

The sky's pull is bounded as a *fraction* of the radius, which is right for a nebula
and catastrophic for a halo. The orbits live between 0.09 and 0.20 of screen height,
and across that band the sky's clamp binds at the full 72% — **120 to 170px of
displacement, tearing every halo off the light it belongs to, which is the
detached-glow failure this project has already shipped once.** Bounded in absolute
terms instead: 6–9px of lean and 2.8° of wind across the play annulus, with a sweep
of the whole screen confirming the map never folds.

*The shader has always bent the sky while the arena sat flat on top of it. The sharp
arena still does not bend; its light does.*

For the sign error that followed, see `black-hole-audit.md`.

## The arena had to move with the world

Five backdrop planes already rode the camera dolly by their own depth while the four
orbits sat on one plane, dead still, **which read as rings printed on glass in front
of a world.** The offset is a function of the *radius alone*, so `posAt()` hands
every object exactly the offset its orbit gets and a shard cannot come unstuck from
its track. Same LFO as the dolly, scaled — *one camera moving, not two effects
agreeing.* `ARENA_PARALLAX = 0` restores the flat stack exactly.

## Slow motion had to smear

Dilation reaching the whole visible world is correct and **strangely undersold —
everything slowing down together looks a great deal like nothing happening.** What
reads as slow motion is one thing smearing against another, so while time is dilated
the ribbon is drawn twice: an after-image lagging by up to nine samples, wider and
dimmer and in the warp violet the slow-mo vignette already uses, drawn first so the
live cyan ribbon lies on top of its own past. **Two passes rather than three** —
giving the ghost the hot white core would make it read as a second comet instead of
the first one's past.

## Collision and clearance are geometry, not pixels

- Collision is a **swept arc**, not a point test, so nothing tunnels through a shard
  on a wide screen or after a dropped frame.
- A shard's hit width is `18.5u / radius` **radians** (`hitTol`, runtime.js:5282),
  so it doubles on the innermost ring. Clearances used to be flat radians, which
  meant two inner-ring neighbours at the mandated 0.5 rad separation **overlapped by
  0.068 rad: a wall with no gap, which the player simply could not pass.** Expressing
  clearance as a multiple of the hit width fixes it on every ring and every screen
  size, because both terms carry the same `u / radius` factor. Sampled over 3,000
  boards, no pair of separate shards on a ring leaves less than a full gap; the only
  overlaps left are twins, which exist to be hopped.
- **Nova embers condense and fan out.** A converted shard's ember is born as a
  white-hot point collapsing to size, and the front's speed scales with the actual
  ring radius so on a large viewport the sweep still beats both the invulnerability
  window and the expiry net — *you can no longer die inside your own blast on a
  desktop monitor.* A converted wall fans out instead of piling up (playtester:
  same-angle formations "turn into stars stacked on top of each other"): every ember
  lands on the player's ring, so same-angle shards used to coincide exactly; each now
  steps along the lane until it has room, **a necklace of notes you sweep through in
  order.**

## Text and layout bugs that reading could not find

- **The tier banner printed 41px inside the arena, on every device.** It sat at
  `cy - R - 30u`; `R` is the arena's *horizontal* semi-axis while the rings are
  ellipses with a vertical semi-axis of `R*AY`, and `AY` is 1.413 on every phone the
  game ships to. Measured on three viewports the block landed 38px, 41px and 45px
  *inside* the tracks. **Five expressions read that one wrong quantity, so they were
  wrong together and consistently, which is why it read as a style problem rather
  than a bug.** There is one `arenaTop = cy - R*AY` now.
- **Popups had no clamp at all.** They spawn at the object that caused them, which
  is in orbit, and they draw centred. `SHIELD USED · 1 LEFT` rendered from x=−99 to
  x=135 on a 390px phone: a quarter of the sentence off the glass, on the one popup
  a player most needs to read. They shrink to fit **and then** slide inside the
  margins — shrinking alone leaves a line hanging off the edge, sliding alone cannot
  save a string wider than the screen.
- **Three overprints, found by screenshotting rather than reading.** `LAPS ×N` drew
  at exactly the `y` of `HYPERNOVA` and `SPOTLIGHT ×2`; the share pill had been
  positioned against the last line above it twice and both times a new line was
  added underneath it afterwards; and `hintGlyph` assigned `globalAlpha` absolutely,
  ignoring its caller, so a lone red diamond floated over the death screen's ladder
  for two and a half seconds explaining nothing. **None of these are reachable by
  the harnesses — there is no renderer in CI — which is the standing argument for
  putting eyes on the actual pixels.**

The audit worth keeping: wrap `text`/`textFx`, record the real box for every string
the game draws, and walk the states. It reports zero overflow across 390×844,
360×780, 430×932 and 844×390.

## The arena is an ellipse

Playtest, near-verbatim: *"I wonder if the orbits were stretched out more to an oval
shape vertically so that they were all a little bit bigger and took up more of the
screen."* Measurable: on a 390×844 phone the arena is **width**-constrained at
R=167px while 277px of vertical room is available — 110px a side going unused.

`R` stays the horizontal radius, `AY` is the vertical multiplier, and every position
flows through `posAt()`. Canvas `ellipse()` takes the same **parametric** angle
`posAt()` does, so paths and objects agree for free — and unlike a canvas `scale()`
this distorts neither sprites nor stroke widths. `ARENA_STRETCH=0.75` is the A/B
dial (0 restores the exact circle); `ARENA_MAX_Y=1.55` stops even a very tall screen,
*past this it reads as an egg rather than a wider orbit* (runtime.js:163-179).

The ellipse is also why the hub-lamp rim highlight is rotated by the **screen**
direction rather than the parametric ring angle: with `AY` above 1 the two differ by
up to 11° at the diagonals.
