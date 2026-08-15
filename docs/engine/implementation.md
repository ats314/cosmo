# Implementation notes

*How the engine, the render path and the sky actually work.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

Everything is two `<canvas>` elements — `#bg` for the WebGL backdrop, `#c` for
the 2D game — driven by one inline `<script>` of about 12,000 lines of plain
JavaScript. No build step, no dependencies, no external assets.

### Sprites are baked once

`shadowBlur` and radial gradients are expensive
per-frame, so the background, nebulae, star field, comet, embers, shards,
power-up orbs and the slow-mo vignette are each rendered to an offscreen
canvas at startup and blitted thereafter. They rebuild only when the scale
unit, DPR, window size, or sky band actually changes.

### The arena is the lamp

The whole scene answers one light source — the
hub. A structured galactic band with carved dust lanes crosses the sky
corner-to-corner; a god-ray fan (born *outside* the ring stack, masked so
it can never cross the play annulus) counter-rotates against a second copy
of itself and throws wide when the drop lands; two fog banks drift with a
clearing visibly burned around the rings; forty-four dust motes orbit in
the lit shell, brightening under the sweep of light that leads the comet;
and a baked photographic grade (corner falloff, horizon lift, band-axis
bias) finishes the frame in one quarter-res blit. Every shard's baked
bright face is rotated to look back at the hub — one key light across the
whole board.

### The sky has depth and a clock

Five planes: the galaxy deepest, then a
half-screen textured planet (noise-octave surface, gas bands, a terminator
whose lit crescent faces the arena), blur-baked far stars, crisp near
stars riding a comet-coupled offset, and the near fog. A slow camera dolly
drifts the world a few pixels on a long sine so no frame is ever static —
the HUD stays pinned, and bloom rides inside the same transform so it
never smears. The palette is banded to the ladder — indigo, teal at THIRD
RING, violet at SLIDING GATES, ember at STORM — and the band now retints
the nebulae, galaxy, rays, planet limb and grade together (the nebulae
previously baked from fixed seed colours; the band tints were dead data).
Red stays reserved for danger in every band.

### The rings are conduits

Each orbit is a baked cross-section — dark
channel walls, a hot core line, a halo — with current visibly flowing
along it (fastest and brightest under the player, direction matching
travel) and eight node pips that breathe on the landed beat. The dark
walls darken the field around each track, which lifts every ember and
shard sitting on it. The hub lamp itself breathes on the beat and flares
with the drop; the comet gained a furnace core flickering at 24Hz and
sheds a spark stream that turns ember-gold one grain in four. The big
earned moments (drop landings, perfect lands, death) ride a fat baked
shockwave annulus instead of a hairline ripple.

### The comet has a body

A teardrop rotated to its heading rather than
three concentric discs: a committed reverse sweeps the nose end-for-end
through the radial over 90ms (never on the speculative flip, so a rolled-
back swipe cannot show a turn that did not happen), and a hop stretches it
along the radial with a small ease-out-back overshoot on arrival — clamped
to 6u and purely visual, since collision runs on ring indices.

### Shards are three kin, one halo

The drifter is a chevron whose point
leads its motion, the blinker a hollow crystal whose core *fills* as re-arm
approaches — the old dormant glyph was dimmest at the exact moment it was
about to become lethal — and the plain single keeps the square. The red
glow is identical across all three, so red stays one lesson.

### Nova embers condense

A converted shard's ember is born as a white-hot
point collapsing to size over a quarter second instead of the generic
fade-in, and the front's speed now scales with the actual ring radius, so
on a large viewport the sweep still beats both the invulnerability window
and the expiry net — the cascade can no longer end as a single-frame pop,
and you can no longer die inside your own blast on a desktop monitor.
A converted WALL fans out instead of piling up (playtester: same-angle
formations "turn into stars stacked on top of each other"): every ember
lands on the player's ring, so same-angle shards used to coincide
exactly — each now steps along the lane in the direction of travel until
it has room, a necklace of notes you sweep through in order.

### Collision is a swept arc

Collision is a swept arc, not a point test, so nothing tunnels through a
shard on a wide screen or after a dropped frame.

### Spawn clearances scale with ring radius

A shard's hit width is
`18.5u / radius` *radians*, so it doubles on the innermost ring — half the
radius, twice the angle blocked. Clearances used to be flat radians, which
meant two inner-ring neighbours at the mandated 0.5rad separation overlapped
by 0.068rad: a wall with no gap, which the player simply could not pass.
Expressing clearance as a multiple of the hit width fixes it on every ring
and every screen size, because both terms carry the same `u / radius`
factor. Sampled over 3,000 boards, no pair of separate shards on a ring
leaves less than a full gap; the only overlaps left are twins, which exist
to be hopped.

### The shield cap grows with the clock

The shield cap grows with the clock — 3, then 4 past `dl` 160, then 5
past 320. Late boards carry ten shards across three rings and the inner ring
costs twice the angle per shard, so three slots stopped being enough to play
around long before a run ended.

### Gates are checked for solvability before they spawn

A gate blocks every
ring at one angle, so it exists to force a reversal — and uniform random
placement can bracket the player, wall ahead and shards behind on every
ring. `reverseEscape()` requires some ring to offer a clear run in the
post-reversal heading; without one the formation is downgraded to a single
shard. Across 5,000 randomised board states, about 2% had no escape, and
none of the 1,257 gates that shipped landed in one. A death you had no move
against reads as the game cheating, which is the one thing that stops a run
being worth retrying.

### Star positions live in normalised space

Star positions live in normalised space, so resizing never reshuffles
the sky.

### Audio is scheduled on the `AudioContext` clock

Audio is scheduled on the `AudioContext` clock, not `setTimeout`, so
arpeggios stay in time when the tab is backgrounded.

### Mute is per device and permanent

Mute is per device and permanent, so toggling it says so. The speaker
sits in the top-right corner with a ~50×50px hit area that is live on the
menu too, and the setting persists through a reload — without
acknowledgement, one stray thumb reads as "this game has no sound". The
muted icon is drawn *more* prominently than the unmuted one for the same
reason: a muted state is the thing you need to notice.

### iOS needs audio actually played inside a gesture

iOS needs audio actually played inside a gesture, not just
`resume()` — a one-sample silent buffer unlocks it — and the context is
resumed again on `visibilitychange`, since returning from the app switcher
or lock screen leaves it suspended. (Note that on iPhone the hardware
ringer switch silences WebAudio regardless; no code can override that.)

### Completing an orbit sets the orbit alight

A head races the full
circumference in the direction you were travelling, wake burning behind it —
the one effect that draws what you actually did. It sits just proud of the
ring rather than on it: on the ring it lands under the comet's own tail and
reads as more trail, but offset and gold against the tail's cyan it reads as
the orbit catching light. Everything about it scales with the streak, and
from ×3 the comet holds still for 75ms while the ring burns round — effects
run on `dt` and gameplay on `sdt`, so the freeze costs no animation. Under
reduced motion the ring lights all at once and the hitstop is skipped.

### Bloom never reads back the canvas

The textbook route — copy the frame
into a small buffer and let the upscale blur it — measures ~16ms here,
because pulling 1.3M pixels back out stalls the pipeline; spare budget does
not help when one operation eats all of it. Instead the bright objects are
re-drawn as crude blobs into a quarter-size buffer, which is then upscaled
back additively. Precision there is pointless: bilinear filtering on the way
up *is* the blur. Costs about 0.3ms.

### The bloom's halo is drawn, not downsampled

One buffer can only carry one radius — how far a pass blurs is set by how far
it is upscaled — so the quarter-res pass put the same tight collar on the hub
lamp as on a spark: an ember's light was gone 15px out, the comet's at 22px,
barely past the blob itself. Every other layer of light here is several
passes at different weights (the trail is three, the gate bar two, the nova
front three); the bloom was the one that was a single flat blit, and light
with no range reads as paint. Each bloom dot now also draws two wider discs —
2× and 4× its radius — into a coarse buffer, blitted back along with one
downsample of itself. **Reach goes up ×3.6** — on a 390×844 phone, an ember
15px → 54px and the comet 22px → 78px, with the ratio holding 3.44–3.74
across viewports. Reach is measured to 1/255, the outermost radius whose
light can still tint an 8-bit pixel, as the max over a full circle in
sub-pixel steps; quoting the threshold is what makes the figure checkable.
The obvious cheaper route is a mip cascade, and it was built that way first
and measured before being thrown away. It fails twice. A box downsample
preserves the peak of anything larger than a buffer pixel, so a solid blob
keeps full brightness at every level and the passes just *sum*: the core came
out 61% hotter while the halo barely moved — a brightness bug dressed as a
glow. And bilinear is a separable tent, so a tiny buffer blown up 40× spreads
into a cross rather than a disc, with a footprint that depends on where the
object sits on the coarse grid: sliding one ember across a single coarse
pixel swung its halo 80%. Everything here is in orbit and permanently
crossing that grid, so that is a halo that crawls on nothing musical.
Drawn discs are round by construction — 0.97 to 1.09 across the halo, and 17%
ripple against the cascade's 80%. The numbers were picked against four
measurements that pull against each other: reach, core brightness (embers
must stay *gold*; washing them white spends the one colour that means
"collect me"), roundness, and how much a dense late-game board hazes over. As
set: ember core +4.8%, median lift across a full board 0.026. How much glow
is too much is the one part of this that wants eyes on a real screen.
The first cut of these figures was measured off a single ray in whole-pixel
steps against an arbitrary cutoff, and reported a before-gap of 4px between
the ember and the comet — impossible, since the two run through the same
filter chain and their discs differ by 7u. Two objects cannot differ in reach
by less than their radii do; that contradiction is what caught it.

### The halo moved to the GPU

The bright pass stays on the CPU and stays semantic — it knows which objects
are lights, so it never thresholds a composited frame and can never pick up
the rings, the pool or the HUD. Only the *blur* moved. Drawn discs bought
roundness at the price of three arc+fills per light and a falloff made of
two stacked steps; a separable gaussian is a true convolution, round by
construction, and its grid is the ¼ bright buffer — four times finer than
the ¹⁄₁₂ the mid halo was drawn into. So the crawl goes *down* by moving the
halo to a smaller buffer, which is the opposite of how that sounds.
Two levels, ¼ and ¹⁄₁₆, reached by way of ⅛: a single 4:1 read undersamples
a source only smooth to σ≈2 and the halo shimmers as lights orbit across the
sampling grid. Weighted so the halo carries the **same light it did before**
— this is a change of filter, not a brightness change. Per light, halo term
only, on a 390×844 phone: ember energy 1.04×, reach 54→64px, roundness
0.750→0.867; shard 1.07×, 56→69px, 0.821→0.883; comet 1.06×, 79→84px,
0.828→0.935; hub 1.02×, 51→59px, 0.733→0.881. Sliding a light across one
whole coarse pixel swung the old halo's reach 8.8% and its peak 5.7%; the
gaussian swings 3.5% and 3.2%. If any of it fails, `FX.on` goes false and
the two discs per light come straight back.

### The glow falls off the screen edge instead of reflecting

WebGL1 has no
`CLAMP_TO_BORDER`, so a blur tap past the texture edge reads the edge texel
back — light that should slide off-screen was reflected into the outermost
band, a thin bright frame at the border whenever the comet or its sparks
passed near it, compounded by every pass of the chain. Measured with the
shipped kernel: **1.82×** the physical level at the border; a playtester
photographed it. Out-of-bounds taps now contribute nothing, so the border
reads 0.55× — the energy genuinely leaves the screen, as it would at a
window's edge — and interior fragments are bit-identical, since all their
taps are in bounds. `fxcheck.mjs` parses the kernel out of the shader,
simulates the chain with whichever sampling semantics the source actually
has, and fails at 1.05× border gain.
- **The glow can be bent, because it is a field now and not a pile of discs.**
  Radial chromatic aberration scaled by the same energy that drives the sky —
  zero at the arena centre by construction, 0.57px of R/B separation a quarter
  of the way out when idle, 3.80px running hot, 7.60px in a black hole — and
  the hole's own pull applied to the arena's light. The shader has always bent
  the sky while the arena sat flat on top of it, which is exactly the tell this
  file already records for the star layer. The sharp arena still does not bend;
  its light does. **The lens had to be re-derived rather than copied**: the
  sky's pull is bounded as a *fraction* of the radius, which is right for a
  nebula and catastrophic for a halo. The orbits live between 0.09 and 0.20 of
  screen height, and across that band the sky's clamp binds at the full 72% —
  120 to 170px of displacement, tearing every halo off the light it belongs to,
  which is the detached-glow failure this project has already shipped once.
  Bounded in absolute terms instead: 6–9px of lean and 2.8° of wind across the
  play annulus, and a sweep of the whole screen confirms the map never folds.
  **And it shipped pointing the wrong way, which is the third time this exact
  inversion has hit the black hole.** The pass is *inverse* sampling: reading
  from a smaller radius magnifies, so subtracting the pull shoves every halo
  *away* from the singularity — measured at +6.8px and +8.8px where the
  comment above it promised the opposite. The gravity pull that "dragged the
  comet inward" pushed it outward, the "inner ring 2×" bonus paid on the outer
  ring, and now this. All three read as correct, because code and comment are
  both true under some reading of which way the number counts. Reading cannot
  catch it. Asking where a specific light *ends up*, in pixels, can — so
  `fxcheck.mjs` parses the coefficients out of the shader and does exactly
  that, and now reports −6.2/−7.8/−8.6/−8.8px at 0.10/0.15/0.20/0.30 of screen
  height.

### A lost context on the glow is silence, not an error

Every call on a lost
WebGL context is a no-op that does not throw, so `fxResize` would see
unchanged sizes and return true, `drawArrays` would do nothing, and
`fxRender` would return *true* — compositing an empty canvas. Worse than the
backdrop's version of the same bug, which at least left a baked sky behind:
`bloomHalo` is set false before the dot loop, so the discs that exist for
exactly this would never have been drawn either, and the glow would simply
stop with no way back. `isContextLost()` is now asked every frame, before
anything else, and the lost/restored listeners drop the six render targets —
a restored context hands back a new context object and every texture,
framebuffer and program made against the old one is dead.
- **The backdrops were one picture recoloured four times, and orbits were the
  game's biggest unnamed mechanic. Those turned out to be one problem.** The
  owner's brief, verbatim: the backgrounds are *"too similar, not lively
  enough, not fun and exciting, not integrated with gameplay"*, and separately
  *"many people have complained they didnt even know they were supposed to do
  orbits"*.

  The diagnosis for the first was that `SKY_BANDS` only ever changed the
  sky's **palette**. The geometry underneath — two-level domain-warped fBm,
  ridged dust, three star layers, one vignette — was identical in all four
  bands, and the recolour was gated on ladder milestones most runs never
  reach. There were also no *events* anywhere in the backdrop: every layer was
  a continuous field multiplied by a gain, and a gain is not an event. Nothing
  ever arrived, crossed, or left. And the gameplay coupling that did exist was
  all gain too — brightness up, hue walk, a small ripple — which is precisely
  the kind of change a player never notices they caused.

  **A world is a set of weights over structures the shader already computes.**
  This is the whole trick and it is borrowed from the pocket's crystallize,
  where `ridged()` had already been paid for by the dust lanes so re-entering
  it as *light* cost nothing. Four structures are recovered from the two fBm
  fields and the ridged field the chain evaluates anyway: soft **billows**
  (smoothstep over the warped field), large-scale **mass** (the 4-octave
  field), **contours** — `sin()` of a scalar field is a level set, and level
  sets of fBm are curtains, so an aurora world costs zero noise evaluations —
  and the **filament** network (the ridged field as light, at a per-world
  sharpness). `WORLDS` says which of them a world is made of, plus its dust
  depth, void, star gain, temperament and palette. Six of them: DRIFT, TIDE,
  GLASS, EMBERFALL, DUSTLANE, VEIL.

  The weights are **lerped on the CPU**, so the shader never branches on a
  world and never evaluates two. A transition is therefore filaments
  dissolving into billows rather than a crossfade between two pictures, and it
  costs nothing. A world is *held* for the first four fifths of its span and
  morphs over the last fifth — interpolating the whole way would mean the sky
  is never actually anywhere, which is the failure mode of every crossfade and
  the opposite of the point.

  **Orbits are how you travel.** Every completed lap buys a seventh of the way
  to the next world; the lap streak winds the entire backdrop into a rotation
  that follows your direction of travel; closing a lap surges the nebula's own
  mass outward in a slow wide ring; and the wedge of sky *behind* the comet
  lifts as you sweep it, closing as the orbit completes. That last one is the
  answer to the discoverability complaint: the arena has carried a lap arc for
  a long time and it did not teach, because it is three pixels of stroke at
  the exact radius the player is scanning for shards. The lap is now drawn
  where there is nothing else to look at. A first-lap `orbit` lesson names it
  once; the arena arc now thickens and brightens as it closes, where before it
  looked identical at 5% and 95%.

  **And turning around takes it back, visibly.** A reverse zeroes the streak,
  the spin's target rate collapses and flips, and the sky spends a couple of
  seconds stalling and unwinding. The cost of a reverse used to be a number in
  the corner; it is now the motion of the entire screen.

  **Things happen now.** Meteors cross every 3.5–11s, a distant star flares
  every 17–44s with a wash that lights the nebula it stands in, and a
  **passing body** drifts through every 95–210s — an object with a silhouette,
  a terminator and a rim, which *occludes* the nebula rather than being laid
  over it. That last one settles an argument: [#98](https://github.com/ats314/cosmo/pull/98) was right
  that *"no amount of fBm is an object — a texture is not a place"*, and wrong
  to fix it by compositing the old baked 2D scene back on top of the shader,
  which was reverted for veiling 69% of it. The argument outlived the
  implementation. Everything is held off the arena by one shared term: this
  game has no aimed input, so nothing crossing the rings may look like
  something to dodge.

  **The red ban is gone, and `GL_MOTION` went back up.** Both were the owner's
  call against a stated risk. What replaces the ban is narrower and sits where
  the "red means danger" contract is actually read — `SKY_ARENA_CALM` (0.34)
  compresses contrast in the annulus the orbits occupy, so EMBERFALL burns at
  the rim while the band a shard is read against stays quiet. Hue is free;
  contrast behind the rings is not. `GL_MOTION` 0.42 → 0.72, now multiplied by
  a per-world `motion` of 0.60–1.30, so the effective dial runs 0.43–0.94 and
  DUSTLANE still broods slower than the old constant while VEIL runs at more
  than twice it. The motion that failed playtesting at 1.0 was *undirected* —
  a uniform drift of everything, meaning nothing. What is faster now is a sky
  that has somewhere to be.

  **What was measured, since "it is in the source" is not evidence.** All 24
  reachable states (6 worlds x 3 samples along every morph) swept over the
  full drift orbit: mean 0.140–0.199, darkest 0.047–0.100. DRIFT is unchanged
  to four decimals against the sky that shipped — 0.1490 mean, 0.0374 darkest,
  against its recorded 0.149/0.038 — because the opening sky had to survive
  the overhaul. Driven through the real game against a recording GL: streak 5
  winds the sky's charge 0.00 → 0.98 and spins it at 0.102 rad/s *opposite*
  `G.dir` (uv counts y up, the game's angle counts it down), a completed lap
  fires the wave and advances the journey by 0.143 of a world, and losing the
  streak unwinds the charge to 0.03. Eight mutations were run against the new
  guards — a world that blacks out, one that floods, the spin sign inverted,
  the gate floor bypassed, weights that stop summing to 1, a uniform looked up
  but never written, and both halves of the y-flip dropped — and all eight
  fail the build.

  **Three holes in `fxcheck.mjs` were found by doing this and are now closed.**
  The recording GL had no `uniform4f` at all, and its absence failed in the
  worst possible shape: the backdrop's first vec4 write threw, `glRender`'s own
  catch swallowed it into `GL.on=false`, and the harness reported *"the
  backdrop shader did not come up against a working GL"* — a message about the
  shader, for a hole in the harness. `GL.u` was not in the "declared but never
  written" loop, so a backdrop uniform looked up and never fed was invisible;
  it is now, which matters more with 29 uniforms than it did with 16. And the
  fake now records the *values* written to each uniform, not only the names,
  so a check can assert what actually reached the GPU.

### The sky provably cannot go black

The coverage
gate that carves the nebula into clouds is sampled at `uv*0.75` — a phone
screen spans about a *quarter of one coverage cell*, so the whole sky rides
one wandering sample. The drift clock (`G.vt`) never resets, and as a
straight line it eventually parked that sample in barren stretches of the
field: whole-screen nebula blackouts lasting 10+ minutes, the first inside
the first quarter hour of page life, with the stars alive — which reads as
the game being broken. Latent since the shader's first day; found from two
same-build screenshots taken four hours apart, one vivid and one black, and
confirmed by a numeric port of the chain (mean luminance 0.0000 across the
epoch a phone had parked in). The drift is now an **ellipse** at the same
tangential speed — one lap (~14 minutes at the current `GL_MOTION`) is every
drift the game can ever show — and the gate is **floored** at
`0.10 + 0.90*smoothstep`, so a barren stretch reads quiet rather than black.
Because the reachable skies are a closed set, `fxcheck.mjs` sweeps the
entire orbit through a line-for-line port and pins **both** directions of
the band, with the orbit, gate, structure and spin constants parsed from the
shader so a retune retunes the check. *(This paragraph carried the retired
0.42 floor and a ~95-minute lap for two commits after they were superseded —
both are the numbers from before the orbit's territory was re-chosen. The
same stale pair was in `docs/invariants.md`. Fixed in the backdrop
overhaul.)*
**The set is now a product**, because there are six worlds rather than one
structure: (drift orbit) x (adjacent world pair). It stays sweepable because
every world's structure weights sum to 1, its coverage weight is a mix
factor that can only raise the never-black floor, and its exponents are >= 1
— all three checked rather than trusted. The sweep covers all six worlds and
three points along every morph between neighbours, which the midpoint alone
did not: the first cut found a transition at 0.238 mean against 0.166 and
0.164 at its two ends. Measured after balancing: **mean 0.140–0.199,
darkest 0.047–0.100 across all 24 states**, with DRIFT held to the
historical 0.1490/0.0374.
- **The render scale climbs as well as falls — but only on gameplay frames,
  and the degrade ladder sheds in order of identity.** `GL_SCALE` is 0.60 and
  rises toward 1.0 on a machine holding its frame; the ceiling *latches down*
  on the first slow stretch so the dial can never oscillate. Two hard lessons
  are now built into it, both from the same field report ("looks good for the
  opening and then 5 seconds in, it changes to the old shit"):
  **The raise only counts frames from a live run.** The title screen is
  nothing but fast seconds — empty board, no glow work, no simulation — so a
  raise that listened there bid the resolution up to a price the run could not
  pay, and handed the ladder a guaranteed walk-down. A raise fed by
  unrepresentative frames is not headroom, it is a debt the next screen
  inherits.
  **The sky dies last.** The watch measures the whole frame and cannot tell
  the backdrop's cost from the glow's or a phone throttling itself at 3%
  battery, and its only levers used to be the backdrop's — so any slowness
  anywhere was billed to the sky, ending in `GL.on=false` and the baked 2D
  backdrop swapping in mid-run, permanently. That is the worst degrade the
  game can perform, and it was being triggered by the glow's own per-frame
  cost. The ladder now sheds the glow first (nearly invisible — the disc
  fallback is tuned to carry the same light — and it refunds the likeliest
  bill), then steps the sky's resolution, and only kills the sky when the
  cheapest scale with no glow is still too slow. `fxcheck.mjs` asserts the
  order and fails if the resolution moves while the glow still runs.

### The hub lamp finally lights something

`SPR.core` is the light source the
whole scene is described as answering to, and exactly one object answered it:
the shard, whose baked bright face is rotated hubward at draw time. Embers,
orbs and the saucer now take a rim highlight the same way, falling off with
distance from the lamp — written as a *distance* against the outermost
radius, never as a ring ordinal, because index 0 is the outermost orbit and
the two read opposite. Rotated by the **screen** direction rather than the
parametric ring angle: with `AY` above 1 the arena is a stretched circle and
the two differ by up to 11° at the diagonals. The black hole orb is the one
thing left unlit — it is the only object in the game that does not emit.

### The orbit stack has depth

Five backdrop planes already rode the camera
dolly by their own depth while the four orbits sat on one plane, dead still,
which read as rings printed on glass in front of a world. The offset is a
function of the *radius alone*, so `posAt()` hands every object exactly the
offset its orbit gets and a shard cannot come unstuck from its track. Same
LFO as the dolly, scaled — one camera moving, not two effects agreeing — and
the hub is depth 0, which is what makes the differential visible.
`ARENA_PARALLAX = 0` restores the flat stack exactly.

### The comet lights its own ring

The comet lights its own ring— a short arc centred on it, falling off
both ways. Decorative, but it also makes "which ring am I on" readable
without looking away from the comet.

### The trail runs hot at its core

Three additive passes of one flat cyan
read as paint; the narrow pass now runs near-white so the ribbon cools
outward the way anything incandescent does.

### The whole wake burns, not just the head

The furnace sheds sparks from
one point seven pixels behind the comet, which is right for an idle orbit
and wrong for a hot one: the ribbon already reports the groove by tinting
toward warp-violet, so at ×6 it was a bright violet ribbon with sparks
coming off one end. Above groove 4 the ribbon itself throws embers, picked
at a random point along its length and pushed out along the local normal —
never the last two samples, because the furnace owns the head and two
emitters on one point read as one brighter emitter. Metered on the *dilated*
delta, so a spark thrown by a ribbon thins out when the ribbon slows.

### Slow motion smears

Dilation reaches the whole visible world now, and the
result is correct and strangely undersold — everything slowing down together
looks a great deal like nothing happening. What reads as slow motion is one
thing smearing against another, so while time is dilated the ribbon is drawn
twice: an after-image lagging by up to nine samples, wider and dimmer and in
the warp violet the slow-mo vignette is already tinted with, drawn first so
the live cyan ribbon lies on top of its own past. Two passes rather than
three — giving the ghost the hot white core would make it read as a second
comet instead of the first one's past.

### Particles stretch along their velocity

Burst speed drives the
elongation, and since velocity damps at `0.15^dt` the streak collapses to a
round spark on its own within a few frames — the shape carries the motion,
with no extra state to track.

### Gate bars are drawn as energy, not as a line

Gate bars are drawn as energy, not as a line— a wide soft pass under a
tight core, overhanging both ends of the ring stack so they read as a
barrier across the field rather than a chord within it, with crawling rungs
once armed.

### Ripples carry their own speed and decay

Ripples carry their own speed and decay, so a death shockwave can
outrun a pickup pop instead of every ring expanding at one rate.

### `prefers-reduced-motion` is respected

`prefers-reduced-motion` is respected— screen shake, flashes, parallax,
pulsing, the death shockwave and the animated gate rungs are all suppressed.

### Safe-area insets

Safe-area insets are read from a hidden probe element, so the ring and
HUD stay clear of the notch and the home indicator.

Scores persist to `localStorage`.
