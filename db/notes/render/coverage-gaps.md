# What the render harnesses cover — and the hole under all three

*What this answers: before changing anything in the render path, which check
will catch the mistake, and which classes of mistake nothing catches?*

State at commit `01a3a25`.

## The three harnesses

| harness | lane | context it builds | what it can see |
|---|---|---|---|
| `tools/drawcheck.mjs` | fast | recording 2D fake, **no WebGL** (`getContext` returns `null` for anything but `'2d'`) | every 2D call's arguments; non-finite coordinates, negative radii, unparseable colours, out-of-range alpha, non-positive line width, unbalanced `save()` per frame |
| `tools/fxcheck.mjs` | fast | recording WebGL fake that parses uniform declarations out of the shader it was handed | which GL calls were issued, with what values; uniform-name typos, non-finite uniform values, upload flip, render-target ladder, draws per frame, lens direction, border gain, context loss |
| `tools/rendercheck.mjs` | full | real Chromium + SwiftShader, real WebGL | actual framebuffer pixels: edge rims, glow energy ratio, per-world brightness/contrast/hue/composition, event contrast and deformation, the 2D fallback's cloud light |

`tools/check.mjs` enforces that every harness declares a lane, appears in the
CI workflow, and is named in `docs/harnesses.md`. It also runs a doc-staleness
guard (`tools/check.mjs:520-601`): any markdown file under `docs/`, plus
`CLAUDE.md`, `README.md`, `MECHANICS.md` and `AGENTS.md`, that names an
ALL-CAPS numeric constant from the runtime must mention that constant's
**current** value near the name. That guard is why `GL_MOTION = 1.0` reached
`CLAUDE.md:117` and `docs/invariants.md` in the same commit that changed the
source, and it is the reason a stale number in the prose is a build failure
rather than a slow rot.

## What each one specifically pins

`drawcheck` requires each of `menu`, `play`, `landscape` and `death` to issue
at least 200 draw operations (`tools/drawcheck.mjs:355-363`), because "no
violations" is also what a harness that drew nothing reports. It plays 2,400
frames with driven taps and swipes, then resizes to 844x390 landscape, then
dies.

`fxcheck` sections, with their anchors:

| section | line | pins |
|---|---|---|
| 1 | `218` | `GL.on` and `FX.on` come up; no uniform name is undeclared; no uniform write hits a null location; no non-finite value reaches the GPU; every location in `GL.u`, `FX.uB`, `FX.uC` is written every frame; `UNPACK_FLIP_Y_WEBGL` on every bright-buffer upload; six render targets at `(bw,bh)x2, (bw>>1,bh>>1)x2, (bw>>2,bh>>2)x2`; exactly 8 GPU draws per frame; **nothing degrades** — ten seconds at 25 fps must not change `FX.on`, `GL.on` or `[GL.vw, GL.vh]`, and the source must not contain `glWatch` or `GL.scale`/`GL.cap` |
| 1a-ii | `316` | the whole scene-event contract at the uniform level: bounded orbit, gradual drop onset, duplicate suppression, priority, expiry, per-run reset, eight pickup tints, and that beat/streak/pocket/dir move neither `uAccent` nor `uArc` |
| 1b | `381` | the black-hole glow lens moves light *inward* at 0.10/0.15/0.20/0.30 H and never folds |
| 1c | `446` | a mid-run context loss turns `FX.on` false, `bloomHalo` true, and stops the glow issuing draws |
| 1c2 | `473` | the blur kernel, parsed out of the shader, does not pile light up at the screen border (fails at 1.05x) |
| 1d | `527` | 8 worlds, 101 morph samples each, all finite, seamless at the boundary, a continuous scenic clock, and `uArena` matching `[radiusOf(0)/H, radiusOf(nRings-1)/H, AY]` at 2/3/4/5 rings |
| 2 | `584` | the no-GPU run: `GL.on` false, `FX.on` false, `bloomHalo` true, zero GPU draws |

`rendercheck` sections: 1 (`219`) edge discontinuity <= 0.12 of interior;
2 (`245`) GPU/disc glow ratio in `[0.35, 2.6]`; 3 (`287`) per-world
`mean in [5,110]`, `p90 >= 25`, `p10 <= 40`, `p90-p10 >= 25`, `gradient <= 6`
luma/pixel, no world pair collapsing in both hue (`< 0.045`) and composition
(`r > 0.88`), plus the living-field battery: a beat impulse must not move the
mean, orbital pressure must move it but not past 1.30x, the clock must move the
field, a drop must deform without flashing, an expired event must be identical
to no event, and the black hole must be darker than quiet; 4 (`357`) the DRIFT
fallback within 16 % of the GPU's cloud light. It **skips loudly** without
Playwright/Chromium locally, and hard-fails in CI if Playwright is missing.

## The hole: none of them ever loads the art

`tools/lib/game-source.mjs:20` prepends `const host = {};` to the extracted
runtime body. So in every VM harness, and in `rendercheck` (which uses
`loadGameHtml`, the same body inside the app shell):

- `runtimeHost.getTexture` is undefined, so `skyTexture` returns `null`,
  `uArt` is `(0,0,0)`, and all three shader material branches are skipped;
- `artifactSprite` always takes its procedural branch;
- the comet draws `SPR.comet` + `SPR.cometHot`, never `comet-core`;
- `frontPanel`/`frontLaunch`/`frontLogo` draw their vector versions;
- `drawPow`'s black-hole branch draws the hand-built dark disc.

Every render assertion in the repo therefore grades the **art-free** path.

Concretely, nothing checks:

- that the three sky material textures upload, bind to the right samplers, or
  land where the shader expects (`uNebulaMap`/`uPlanetMap`/`uRingMap` are
  written every frame, so `fxcheck`'s uniform check passes on the blank
  texture);
- that `comet-core`'s `(0.624, 0.482)` origin offset still lands on the
  collision position;
- that the UI frame crops still match the assets' alpha bounds;
- that any manifest key is reachable — the four orphaned assets in
  `db/notes/render/art-assets.md` are invisible to CI;
- that `drawCurrentWake` draws anything at all. `drawcheck` will catch a
  non-finite coordinate or an unbalanced `save()` in it, and its 200-draw floor
  is a floor for the whole phase, not for this pass.

## The second hole: the 2D fallback is graded on one number

`rendercheck` section 4 compares one world (DRIFT), at one clock (5), by mean
luma, to within 16 %. Under that single bound the fallback currently differs
from the shader in at least three read constants — the nebula crevice term
(`0.36+crevice*0.83` against `0.52+crevice*1.06`), the limb gain (`1.20`
against `1.36`) and the black-hole lens (`0.13` with no swirl against `0.36`
with a `0.34` swirl) — and it samples no art material at all. Nothing compares
composition, hue, the other seven worlds, or any event state between the two
paths.

## `enginecheck` is the only harness with real textures, and it reads no pixels

`tools/enginecheck.mjs` starts Vite preview against `dist` on
`127.0.0.1:4173` and drives the built Phaser app, so `getTexture` is live
there. But it observes only `COSMO_APP.snapshot()` counters and browser errors:
boot, LAUNCH, pointer reversal, touch ring change, resize, one active scene,
one host-owned loop. It never reads a framebuffer.

## Practical consequence

A change to `SKY_MATERIALS`, `glBindSkyMaterials`, the art manifest, or any
`getTexture` call site can pass the entire suite while being visibly broken for
every real player. `docs/invariants.md` already says "inspect a real frame for
visual changes"; for the art path that instruction is the only guard there is.
`COSMO_SHOTS` (rendercheck) and `COSMO_ENGINE_SHOTS` (enginecheck) capture
frames, but only enginecheck's run through the built app has the textures
loaded.
