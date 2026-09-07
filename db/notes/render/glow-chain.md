# The glow: a semantic bright pass, a GPU gaussian, and a disc fallback

*What this answers: how does Cosmo's bloom actually work, what are its buffers
and dials, and what happens when the GPU goes away mid-run?*

Anchors are `src/game/runtime.js` at commit `01a3a25`.

## The bright pass is on the CPU and it is semantic

`drawBloom` (`9156-9282`) never thresholds a composited frame. It walks the
game's own object lists and draws a flat disc per light into `bloomC`, a canvas
at `ceil(W/BLOOM_DIV) x ceil(H/BLOOM_DIV)` with `BLOOM_DIV = 4` (`9116`), under
`globalCompositeOperation='lighter'` and a pure `setTransform(1/4,...)` scale —
no camera dolly.

What counts as a light, in draw order (`9180-9220`):

| source | radius | colour | note |
|---|---|---|---|
| every star (`G.stars`) | `8*u` | `COL.ember` | skipped while still in its Starfall flight delay; alpha fades in over 0.45 s and out over the last 0.65 s |
| armed shards in phase 1 | `7*u` | `COL.shard` | **blinkers excluded** — "shutters communicate danger with their shape, never a toggled halo" |
| uncollected finale trail stars | `12*u` | `COL.ember` | |
| every power orb except the black hole | `10*u` | the orb's own colour | |
| the comet, unless dead | `10*u` | `#7ce9ff` | one disc; the white inner dot is gone |
| the hub lamp | `7*u * hubLamp` | `#9db9ff` | `hubLamp = 1 - min(1, BH.warp)` |

Particles no longer bloom: "adding every fragment to bloom turned one collision
into an area-wide light burst" (`9212-9213`).

`hubLamp` gates the lamp's *bloom* separately from the lamp's own draw
(`10742`), because both were burning inside the black hole's shadow and each
had to be told individually.

Because the pass is semantic it can never pick up the rings, the calm pool or
the HUD, which a luminance threshold over the composited frame would.

## `bloomHalo` is decided once per frame, before the dot loop

`bloomHalo = !FX.on` (`9162`). If the GPU path is up, the two extra halo discs
per light are dead weight and are skipped. The decision is taken once so a
mid-frame GL failure can never leave half the lights haloed and half not — at
the cost of exactly one frame with no halo on the way into a permanent
fallback.

## The GPU halo — `FX`, 10084 to 10378

`fxInit` (`10196-10242`) builds its **own** offscreen canvas and WebGL context,
separate from the backdrop's `#bg` context, with `preserveDrawingBuffer:true`
(`10204`) because the result is read back with `drawImage` rather than
composited by the browser. Feature detection checks *results*, not existence
(`10208`), because the harness stub answers every property with a function.

Two programs:

- `FX_BLUR` (`10114-10125`) — a five-tap linear-sampled gaussian: centre weight
  `0.2270270270`, offsets `1.3846153846` (weight `0.3162162162`) and
  `3.2307692308` (weight `0.0702702703`), summing to exactly 1. An `inb()`
  factor zero-weights any tap whose UV falls outside `[0,1]`, so light slides
  off the screen instead of being reflected back by WebGL1's absent
  `CLAMP_TO_BORDER`. Measured: 1.82x the physical level at the border before,
  0.55x after. `fxcheck.mjs:473-525` (section 1c2) re-simulates the chain with whichever
  sampling semantics the source actually has and fails at 1.05x border gain.
- `FX_COMP` (`10126-10195`) — the composite, with radial chromatic aberration
  and the black hole lens.

`fxResize` (`10275-10287`) allocates **six** render targets at three scales:
two at `(bw,bh)`, two at `(bw>>1,bh>>1)`, two at `(bw>>2,bh>>2)` where
`bw = ceil(W/4)`. Relative to the full frame that is /4, /8, /16. The middle
pair is not decoration: a single 4:1 read from a source only smooth to sigma~2
undersamples and the halo shimmers as lights orbit across the sampling grid.
`fxTarget` (`10245-10260`) sets `CLAMP_TO_EDGE` on both axes and refuses any
target whose framebuffer is not `FRAMEBUFFER_COMPLETE`.

`fxRender` (`10302-10357`) per frame:

1. `isContextLost()` first, before anything else (`10318`).
2. `fxResize(bw,bh)`.
3. Resize `FX.cv` to `ceil(W/2) x ceil(H/2)` if needed.
4. Upload `bloomC` with `UNPACK_FLIP_Y_WEBGL` true — exactly once, because a 2D
   canvas counts rows down and a framebuffer counts them up.
5. Six separable blur passes (`10333-10339`): `src->A` (x), `A->B` (y),
   `B->C` (x), `C->D` (y), `D->E` (x), `E->F` (y). `B` is the mid level, `F`
   the wide one.
6. One composite to the default framebuffer at the FX canvas size.

That is 7 draws per frame from the glow. `fxcheck.mjs:278-279` asserts 8 total when
the backdrop shader is also running (1 + 6 + 1).

### The dials

| constant | value | anchor | what it does |
|---|---|---|---|
| `FX_A` | `0.55` (mutable) | `10084` | composite alpha of the whole halo layer |
| `FX_MIDW` | `0.62` | `10085` | weight of the /4 level inside `FX_COMP` |
| `FX_WIDEW` | `0.85` | `10085` | weight of the /16 level |
| `FX_SPREAD` | `1.15` | `10086` | blur step in texels of each level |
| `FX_AB` | `0.0045` | `10097` | radial chromatic aberration coefficient |

Aberration is applied as `uAb = FX_AB*(0.30+0.70*energy)*(1+BH.warp)`, zero
under reduced motion, with `energy = min(1, PLAY.heat + 0.6*G.pay + G.odGlow)`
(`10349-10350`). It is radial and scales with `r`, so it is exactly zero at the
arena centre and widest at the corners — the fringe never touches the orbits a
player is reading.

### The black hole lens, and its sign

`FX_COMP` bends the *glow field* (not the sharp arena) toward the singularity
(`10161-10186`):

```
fall = exp(-r*4.0);
pull = uBH*0.115*r*fall;
sw   = uBH*0.55*r*fall;          // the wind
d    = rotate(d, sw) * (1.0 + pull/r);
```

This is **inverse sampling**: the shader is handed a destination fragment and
asked which source radius to read. Reading from a smaller radius magnifies, so
the `+` is what pulls halos inward. The first cut shipped with `-` — right
magnitude, wrong direction — and read as correct because code and comment were
both true under some reading of which way the number counts. The source comment
records that this is the third time that exact inversion has hit the black hole
in this file.

The pull is bounded in **absolute** terms (`r*exp(-4r)` peaks near a hundredth
of screen height), not as a fraction of radius the way the backdrop's lens is.
The backdrop's old clamp bound at 72 % across the play annulus, which would
drag every halo 120-170 px off the light it belongs to.

`fxcheck.mjs:381-444` (section 1b) parses `fall`, `pull` and the sign out of the shader
source, then bisects for where a light at a given source radius actually lands,
and fails if any of 0.10/0.15/0.20/0.30 of screen height moves outward. It also
sweeps the whole map for monotonicity.

## The disc fallback

When `FX.on` is false, `bloomDot` (`9147-9155`) additionally draws two discs
per light into `haloC` at `HALO_DIV = 12`, at `HALO_K1 = 2.0` x radius with
weight `HALO_W1 = 0.50` and `HALO_K2 = 4.0` x radius with weight
`HALO_W2 = 0.20` (`9134-9136`). `haloC` is then downsampled once into `haloWC`
at `HALO_WDIV = 32` for the widest reach (`9229-9240`) — smoothing has to be
re-asserted every frame, because assigning `width` resets a 2D context and a
downscale with smoothing off is a point sample that discards fifteen pixels in
sixteen.

Composite alphas (`9137`, mutable at runtime): `HALO_A = 0.09`,
`HALO_WA = 0.06`, and the tight core always composites at
`BLOOM_ALPHA = 0.28` (`9116`).

**The beat pump is gone.** All three used to be multiplied by
`bp = 1 + (G.pay>0 && !RM ? 0.45*G.beat : 0)`. The comment that replaced it
reads "Fixed light budget. Music changes motion and orchestration, never the
gain of every object on screen at once" (`9266-9267`).

`rendercheck.mjs:245-286` (section 2) renders both paths on the same frame and fails if the
GPU/disc light ratio leaves `[0.35, 2.6]`.

## Context loss

A lost WebGL context is **silence, not an error**: every call is a no-op that
does not throw. Without an explicit check `fxResize` would see unchanged sizes
and return true, `drawArrays` would do nothing, and `fxRender` would return
*true* — compositing an empty canvas, with no way back, because `bloomHalo` was
already false and the discs were never drawn.

Both GPU users install `webglcontextlost`/`webglcontextrestored` listeners with
`preventDefault()` (without it, restoration is impossible by spec):

- backdrop, `10021-10030`: clears `GL.on`; on restore zeroes `GL.vw/vh` and
  re-runs `glInit`/`glResize`.
- glow, `10367-10378`: clears `FX.on` **and empties `FX.rt`** and zeroes the
  cached sizes — a restored context hands back a new context object and every
  texture, framebuffer and program made against the old one is dead, so
  `fxResize` would otherwise happily reuse six destroyed framebuffers.

`fxcheck.mjs:446-471` (section 1c) drives a mid-run loss and asserts `FX.on` goes false,
`bloomHalo` goes true, and the glow stops issuing draws.

`runtimeDisposeGpu` (`12281-12303`) is the teardown counterpart: it deletes the
three sky material textures (`12284`), the 1x1 `blank` texture, the six render
targets, the source texture, the vertex buffer, every attached shader and every
program, and calls `WEBGL_lose_context.loseContext()` — except on the backdrop
when the host supplied the surface, because Phaser may reuse `#bg` after a
scene restart.
