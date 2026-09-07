# The art pack: what ships, what draws, and what nothing references

*What this answers: for each image in `docs/art/catalog.json`, is it shipped,
where does the runtime use it, and which ones are bytes nobody can reach?*

State at commit `01a3a25`. Ten world plates were deleted from the release in
`f13d7c6`; three previously-orphaned sprites became shader samplers in the same
commit. Read `db/notes/render/commit-drift.md` if another record disagrees.

## The two populations

`docs/art/catalog.json` catalogues **34** assets and now carries a `published`
flag on every one:

- **24 sprites, `published: true`** — the whole of `public/art/sprites/`,
  787,290 bytes, all 24 listed in `public/art/manifest.json`.
- **10 world plates, `published: false`** — `worlds/*.webp`. The files are gone
  from `public/art/` and the keys are gone from the manifest. Every one carries
  `usage: "Reference only. Removed from the game: opaque scenery must not
  replace the living procedural system."`

`public/THIRD_PARTY_LICENSES.txt` matches: original Gemini artwork supplied and
approved by the owner on 2026-09-07 in `cosmoassetssprites.zip`, no separate
third-party licence notice in the archive, delivery changes limited to resizing
and WebP conversion with the original alpha preserved, and opaque world plates
"retained outside the game as references and are not distributed in this
release".

Note `nebula-arena`'s catalog row changed with the deletion: it is now a round-2
1536x2752 source resized to 1080x1935 at 100,400 bytes with a different SHA-256
from the 71,318-byte file that used to ship. Nothing in the repository holds
those bytes any more.

Every one of the 24 shipped sprite files was checked byte-for-byte against its
catalog `bytes` in this session; all 24 match.

## How art gets in

`BootScene.preload` loads the manifest as JSON; `BootScene.create`
(`src/scenes/BootScene.ts:10-21`) validates each key against `/^[-\w]+$/` and
each path against `/^[-\w./]+\.(png|webp|jpg)$/` with no `..`, queues
`this.load.image(key, 'art/'+file)`, and starts `CosmoScene` only once the
loader completes. If nothing queued, it starts `CosmoScene` immediately — the
empty-manifest case is a supported boot.

`CosmoScene` hands the runtime a `getTexture(key)` closure
(`src/scenes/CosmoScene.ts:39-43`) that returns `null` unless
`this.textures.exists(key)` and the source image is an `HTMLImageElement` or
`HTMLCanvasElement`. Every art lookup inside the runtime goes through it.

## The six lookup sites in the runtime

All anchors `src/game/runtime.js`. Note that four of them call bare `host`, the
`createCosmoRuntime` parameter (`6`), rather than `runtimeHost` (`10`) —
harmless in the module path, and the VM harnesses prepend `const host = {};`
so it is defined there too. `skyTexture` uses `runtimeHost`.

| anchor | keys | how it is used |
|---|---|---|
| `8872-8880` | 13 keys, in `artifactSprite` | baked into the artifact cache at `40*u` (star), `46*u` (hazards) or `56*u` (orbs) |
| `9006` | `power-blackhole` | when present, the black hole orb takes the ordinary `artifactPower` path instead of the hand-drawn dark disc |
| `9941-9968` | `fx-plasma-wisp`, `drift-planet`, `drift-ring` | uploaded once each as WebGL textures and sampled by `GL_FS` as `uNebulaMap`, `uPlanetMap`, `uRingMap` |
| `11128-11131`, `11169-11171` | `comet-core` | the comet body and the mirror twin, at `72*u`, offset `(-0.624, -0.482)` of that size |
| `11804-11809` | `ui-panel-frame` | the front-end panels |
| `11825-11831` | `ui-primary-frame` | the LAUNCH button |
| `11854-11858` | `cosmo-wordmark` | the title logo |

### The UI crops are exactly the catalog's alpha bounds

`frontPanel` slices `ui-panel-frame` at `(23,23)` size `978x466` on a 1024x512
image — catalog `alphaBounds [23,23,1001,489]`. `frontLaunch` slices
`ui-primary-frame` at `(19,19)` size `986x218` on 1024x256 — catalog
`[19,19,1005,237]`. `frontLogo` writes its fractions against a 1536x512 grid
(`179/1536`, `87/512`, `1224/1536`, `292/512`), which on the delivered 1024x341
resolves to `(119.3, 57.9)` size `816x194.5` — catalog `[119,58,936,252]`. All
three crops discard exactly the transparent margin and nothing else.

`comet-core`'s draw offset `(0.624, 0.482)` is the catalog's `recommendedOrigin`
for that asset verbatim, which targets the bright core rather than the image
centre. The catalog note says so explicitly: "Align bright core, not
whole-image center, to collision position."

### The three sky materials are additive detail, not replacement

`SKY_MATERIALS` (`9941`) pairs three sprite keys with three sampler uniforms.
`glBindSkyMaterials` (`9947-9968`) uploads each one lazily, caches it by image
identity, binds `GL.blank` (a 1x1 canvas made in `glInit:9699-9704`) when a key
is missing, and reports readiness as `uArt = (nebulaReady, planetReady,
ringReady)`. Each shader branch is guarded on `uArt.* > 0.5`:

- `uNebulaMap` (`fx-plasma-wisp`) adds two eddying light samples over the
  procedural cloud, edge-weighted to stay outside the play annulus (`9560-9574`).
- `uPlanetMap` (`drift-planet`) mixes a mineral body into the globe at
  `paint.a*(0.30+0.12*(1-uSurface.y))` (`9620-9628`).
- `uRingMap` (`drift-ring`) tints and modulates the belt's lanes at
  `paint.a*0.42` (`9508-9514`).

`runtimeDisposeGpu` deletes all three textures and the blank (`12284-12285`).

## Four assets nothing references

Loaded into Phaser's texture cache on every boot, decoded, resident, and
unreachable from any code path:

| key | size | bytes | why it is orphaned |
|---|---|---|---|
| `fx-shock-ring` | 512x512 | 18,590 | shockwaves used the baked `SPR.shock`, which is itself no longer drawn |
| `fx-soft-glow` | 512x512 | 27,684 | the halo is the GPU gaussian or `bloomDot`'s discs |
| `fx-spark` | 512x512 | 12,792 | particles are `ctx.arc` fills |
| `power-spotlight` | 256x256 | 25,686 | **deliberate** — the catalog says "Retired Spotlight art; not the current Magnet. Do not map to runtime spot." |

That is 84,752 bytes of the shipped pack's 787,290 — 10.8 % — downloaded and
decoded on every cold start. Only `power-spotlight` is documented as
intentional. The other three were joined by `drift-planet`, `drift-ring` and
`fx-plasma-wisp` until `f13d7c6` gave those three a job.

## The fallback is real and is what the harnesses test

Because `getTexture` is absent in every VM harness
(`tools/lib/game-source.mjs:20` injects `const host = {};`), and in
`rendercheck` which uses `loadGameHtml` — the same body inside the app shell —
`artifactSprite` takes the procedural branch, the comet draws `SPR.comet`, the
front-end draws its hand-built panels and vector wordmark, `drawPow` draws the
hand-built dark disc, and `skyTexture` returns `null` so `uArt` is `(0,0,0)`
and all three material branches are skipped. Everything in `fxcheck.mjs`,
`drawcheck.mjs` and `rendercheck.mjs` exercises the **art-free** path. See
`db/notes/render/coverage-gaps.md`.
