# The render path, end to end

*What this answers: in what order does one Cosmo frame get built, who owns each
layer, and where does the code for each stage live?*

Anchors are line ranges in `src/game/runtime.js` (12,335 lines at commit
`01a3a25`) unless another path is named. **Read
`db/notes/render/commit-drift.md` first if any other record disagrees with the
numbers here** — the render path was rewritten after the rest of this database
was built.

## Two canvases, one 2D context

`index.html:37-38` declares exactly two canvases: `#bg` (z-index 0, the WebGL
backdrop) and `#c` (z-index 1, `background:transparent`, the 2D game), plus
`#safe` at `:39`, the hidden `env(safe-area-inset-*)` probe. Both canvases are
`position:fixed` full-viewport (`src/styles.css:7-12`).

`src/main.ts:9-24` creates the Phaser game with `type: Phaser.CANVAS`,
`transparent: true`, `scale.mode: NONE` and `audio: {noAudio: true}` — Phaser
never owns the sizing or the sound. `CosmoScene.create()`
(`src/scenes/CosmoScene.ts:28-45`) hands the runtime Phaser's own canvas *and*
its 2D context, plus `document.querySelector('#bg')` as `background`. So `#c`
in the shipped app is Phaser's canvas, and the runtime draws into Phaser's 2D
context from inside `OrbitDisplay.renderCanvas`
(`src/scenes/CosmoScene.ts:13-16`). There is no second animation loop and no
per-frame `CanvasTexture` upload.

`runtimeRender()` (`12219-12238`) is the only entry point. It snapshots
Phaser's incoming transform, alpha and composite mode, wraps `draw()` in
`try/catch/finally`, stashes the first thrown error on `window.__drawErr`, and
restores everything Phaser handed it. A thrown frame cannot leak canvas state
into Phaser's own rendering.

## `draw()` — 10676 to 11275

1. **Reset.** `setTransform(DPR,0,0,DPR,0,0)`, `globalAlpha=1`,
   `globalCompositeOperation='source-over'` (`10685-10687`). A thrown frame
   leaves the save stack dirty; the orphaned entries are inert only because
   nothing reads from the stack without its own `save`.
2. **The sky**, two mutually exclusive paths (`10693-10694`):
   ```js
   if(GL.on){glRender(0);ctx.clearRect(0,0,W,H);}
   if(!GL.on)drawCalmSky();
   ```
   The `clearRect` matters: the shader draws onto `#bg`, so the 2D canvas above
   it must be wiped for the backdrop to show. See
   `db/notes/render/sky-paths.md`.
3. **Camera dolly.** `camX=sin(amb*0.065)*1.4*u`, `camY=cos(amb*0.051)*1.4*u`,
   both zero under `prefers-reduced-motion`; `paX/paY = camX*PARA_K*
   ARENA_PARALLAX` (`10695-10696`).
4. **The singularity** (`drawSingularity`, `10608-10654`) — before the dolly
   translate, in absolute screen space.
5. `ctx.save(); ctx.translate(camX,camY)` (`10703-10704`), then
   **`drawCurrentWake()`** (`10705`) *inside the dolly but outside the shake*,
   then the shake translate (`10706`).
6. Magnet connection curves (`10709-10719`), `drawPowerAtmosphere`
   (hypernova rain, slow-mo arcs, `10720`), `drawOrbitalRails` (`10721`), the
   hub lamp `SPR.core` blit (`10742`), scorch burn arcs, the lap progress arc,
   the reverse burn-off arc, the radial gesture guide, the slow-mo timer arc,
   the Slipstream arc, the Star Trail route.
7. Stars (`10877`), power orbs (`10899-10905`), gate bars, shards
   (`10919`, `10983`), divers, the nova contour, the orbit marker, contact
   marks, `drawImpactEvents` (`11095`), the comet ribbon `drawTail` (`11098`),
   `SPR.cometGlow` (`11103`), the comet body with its optional `comet-core`
   texture (`11128-11139`), the mirror twin (`11169-11171`), `drawBeat` and
   `drawCometFins` (`11185-11186`).
8. **`drawBloom()`** at `11221` — inside the shaken/dollied transform, but it
   resets to the base transform internally before compositing.
9. Score popups, shrunk with `fitSz` then clamped inside an `8*u` margin
   (`11237-11252`), then `ctx.restore()`.
10. The death scrim (`11259-11264`), then `drawHUD`, `drawMute`,
    `drawPauseBtn`, `drawShieldBtn`, `drawShareBtn`, `drawPausePanel`
    (`11265-11272`).

There is **nothing after the HUD**. The full-screen white flash and the death
impact frame both used to live here; `11273-11274` is now a comment saying so.

## Why the bloom composite resets the transform

`drawBloom`'s bright pass draws each light into `bloomC` under a pure scale
`setTransform(1/4,…)` with no dolly. Its composite runs inside `draw()`'s
`translate(camX,camY)`. Compositing there put the whole glow layer off its own
lights by exactly the dolly, oscillating on a sine, and smeared the outermost
texel into a hairline rim at the screen edge (measured: left device columns
0/1/2 at 5.0/4.4/3.5 against an interior of 3.6). `drawBloom` therefore calls
`ctx.setTransform(DPR,0,0,DPR,0,0)` immediately before compositing (`9264`).
`rendercheck.mjs` test 1 measures the edge discontinuity and fails above 0.12
of the interior level.

## Sizing, scale unit and the arena box

`resize(width,height,pixelRatio)` (`606-664`):

- `DPR` is clamped to 2 (`609-610`). In the Phaser host it arrives as
  `Math.min(window.devicePixelRatio||1, 2)` from `CosmoScene`.
- `u = clamp(min(W,H)/420, 0.75, 1.3)` (`620`) — the scale unit every sprite
  radius and line width multiplies.
- The arena is solved from the *free box*, not a fraction of the screen
  (`636-649`): `topLim = safeTop + 150*u`, `botLim = H - safeBot - 74*u`,
  `vBox = max(40,(botLim-topLim)/2)`, `hBox = W/2 - 30*u`,
  `R = max(52, min(hBox, vBox))`, `cy = (topLim+botLim)/2`.
- `AY = 1 + (clamp(vBox/R,1,ARENA_MAX_Y)-1)*min(1,ARENA_STRETCH)` with
  `ARENA_STRETCH = 0.75` (`178`) and `ARENA_MAX_Y = 1.55` (`179`). Landscape,
  where `vBox` binds, stays circular.
- Safe-area insets come from `runtimeHost.insets` when the host supplies them,
  otherwise from `getComputedStyle` on the `#safe` probe (`622-631`).
- The sprite cache re-bakes only when `u`, `DPR`, `W`, `H` or `skyI` changed
  (`654-663`).

`GL_SCALE` is `1.0` (`9457`) and `glResize` sizes the backdrop canvas at
`min(DPR,2)*GL_SCALE` (`9712`). There is no adaptive render scale:
`fxcheck.mjs:311-312` fails the build if `glWatch` or `GL.scale`/`GL.cap`
reappear.

## Parallax

Ring depth is a function of radius alone: `depthOf(r)=min(1.35, r/R)` (`715`).
`posAt(a,r)` (`716-721`) adds `paX*d`/`paY*d` to every object, and `ecx`/`ecy`
(`722-723`) add the same offset to any arc drawn about the hub — so a shard
cannot come unstuck from its track. The hub is depth 0, which is what makes the
differential visible. `ARENA_PARALLAX = 0` (`712`) restores the flat stack
exactly; `PARA_K = 1.15` (`713`) is the arena's swing as a multiple of the
dolly's.
