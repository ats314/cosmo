# The render pipeline: three sky paths, one world pass, one HUD

**What this answers:** what `draw()` does in what order, which backdrop path is
actually running, and how the glow chain decides between GPU and CPU.

## `runtimeRender()` → `draw()`

`runtimeRender` (12161) is the host's entry. Because Phaser owns the canvas, it
snapshots the incoming transform, alpha and composite mode, wraps `draw()` in
`try/finally`, stashes the first exception on `window.__drawErr`, and restores
everything afterwards. `enginecheck.mjs` asserts `__drawErr` is null.

`draw()` (10555) opens by resetting to a known-good state —
`setTransform(DPR,0,0,DPR,0,0)`, `globalAlpha = 1`,
`globalCompositeOperation = 'source-over'` — because a thrown frame otherwise
leaks a dirty transform, alpha or line dash into every subsequent frame.

## The backdrop: three paths, tried in order

```
if(!drawGeminiSky()){
  if(GL.on){ glRender(0); ctx.clearRect(0,0,W,H); }
  if(!GL.on) drawCalmSky();
}
```
(10570–10574)

1. **`drawGeminiSky()`** (9790) — the authored world paintings. Asks
   `runtimeHost.getTexture(world.key)` for two adjacent `SKY_ART_WORLDS` entries
   (9763) and cross-fades over the last 20 % of a world, cover-cropped with a
   1.045 overscan and a slow parallax drift. Returns false when no texture is
   available.
2. **`glRender(dt)`** (9970) — the procedural WebGL backdrop. One full-screen
   triangle through `GL_FS` (9508), fed a morphed `skyMix()` of two `WORLDS`
   rows plus `sceneAccent()`. Note that when the art path succeeds the GL path is
   *not* drawn; when the art path fails and GL is on, `glRender` draws to its own
   canvas and the 2D context is cleared over it. `GL_MOTION = 0.25` (9506) is the
   scenic clock rate; `SKY_ARENA_CALM = 0.62` (339) is the in-annulus contrast
   moderation passed as `uCalm`.
3. **`drawCalmSky()`** (9854) — the 2D fallback. Shares the same globe, ring and
   cloud parameters so a context loss does not change what the world *is*.

`glInit()` (9657) takes the canvas from `runtimeHost.background` or `#bg`, and
returns false on any failure. Context loss is handled explicitly (10009–10019):
`webglcontextlost` calls `preventDefault()` and sets `GL.on = false` so the 2D
path takes over, and `webglcontextrestored` re-inits.

## World pass order in `draw()`

`drawSingularity` (before the dolly) → `ctx.translate(camX,camY)` and shake →
magnet connection lines → `drawPowerAtmosphere` → `drawOrbitalRails` → the core
lamp → scorch sectors → the lap-progress arc → the discarded-lap burn-off →
gesture guide → threats, stars, orbs, the comet and its fins → `drawTail` →
`drawBeat` → impact events → ring/arc/lap effects → `drawBloom()` → popups →
`ctx.restore()` → the death scrim → `drawHUD` → the four buttons → the pause
panel → the flash → the impact frame.

The camera dolly is `camX = sin(amb*0.065)*1.4*u`, `camY = cos(amb*0.051)*1.4*u`
on `amb = G.vt` (10575). `paX`/`paY` are set from it by `PARA_K = 1.15` and
`ARENA_PARALLAX` (10576), and `posAt`/`ecx`/`ecy` (727–735) apply the offset as a
function of radius alone — which is exactly why a shard cannot come unstuck from
its track: the object and its ring are computed from the same number.

## The glow chain

`drawBloom()` (9136) fills a `W/BLOOM_DIV`-scale bright buffer (`BLOOM_DIV = 4`,
`BLOOM_ALPHA = 0.28`, 9096) with one disc per light: stars, armed shards, finale
trail stars, orbs, particles, the comet, and the hub lamp scaled by `1 - BH.warp`.

`bloomHalo` is decided **once per frame, before the dot loop** (9147,
`bloomHalo = !FX.on`). This matters: `bloomDot` (9127) writes the two extra
halo discs only when `bloomHalo` is true, so a mid-frame GL failure can never
leave half the lights haloed and half not. The cost is one frame of thinner glow
on the way into a permanent fallback.

- **GPU path** — `fxRender(bloomC, bw, bh)` (10291) uploads the bright buffer and
  runs a six-target, three-scale separable gaussian (`bw → bw>>1 → bw>>2`) then
  `FX_COMP` composites mid and wide with radial chromatic aberration.
  `FX_A = 0.55`, `FX_MIDW = 0.62`, `FX_WIDEW = 0.85`, `FX_SPREAD = 1.15`,
  `FX_AB = 0.0045` (10073–10086). `FX_BLUR` zero-weights out-of-bounds taps
  because WebGL1 has no `CLAMP_TO_BORDER` and edge-clamped taps reflected light
  back into a bright border frame.
- **CPU fallback** — two disc passes at `HALO_DIV = 12` and `HALO_WDIV = 32`,
  radius multiples `HALO_K1 = 2.0` / `HALO_K2 = 4.0`, weights `0.50` / `0.20`,
  composited at `HALO_A = 0.09` / `HALO_WA = 0.06` (9114–9117). Both `HALO_A` and
  `FX_A` are `let`, deliberately mutable at runtime so the dial can be turned in
  the console.

The composite resets to the base transform (`setTransform(DPR,0,0,DPR,0,0)`,
9235) before drawing, because the bright pass uses a pure scale with no dolly
while the world pass is inside `translate(camX,camY)`. Compositing inside the
dolly offset every halo from its own light by the dolly, oscillating on a sine —
the "everything wobbles" field report — and smeared the outermost texel into a
hairline rim.

## Sprites

Two caches:

- `SPR` (245) — the gameplay bakes in `buildSprites()` (383), rebuilt from
  `resize()` only when `u`, `DPR`, `W`, `H` or `skyI` change. `bandOnly` returns
  immediately now that scene colour is procedural.
- `artifactBank` (8731) — faceted object sprites keyed on `u + ':' + DPR`.
  `artifactSprite(kind)` (8838) prefers a host texture via `host.getTexture(...)`
  and falls back to a procedural facet/glow/glyph bake.

The UI panel kit (`frontPanel` 11740, `frontLaunch` 11761, `frontLogo` 11790) also
prefers host textures with a procedural fallback.

## Reduced motion

`RM` (111) is read once from `prefers-reduced-motion` and gates every large
motion: the slow-mo ghost ribbon, the wake sparks, the trail cap, shake, the
death shockwave, the beat ring's animation (replaced by one opacity step per
beat at 1.73 Hz), and the sky's drift.
