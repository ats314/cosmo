# CLAUDE.md

Operating context for agents working on Cosmo. Read this first, then the
relevant design document and invariant group before editing.

## Product and ownership

Cosmo is a proprietary commercial space arcade. Preserve the original
copyright notices and LICENSE; do not relicense the game, invite outside
contributions or assume a public repository grants reuse rights.

The owner has approved Phaser, TypeScript, Capacitor and original external
art assets. Their use does not change Cosmo's license. Record third-party
source, artwork and dependency provenance and preserve their own license
notices in public/THIRD_PARTY_LICENSES.txt. Do not copy unattributed material
or apply Cosmo's proprietary terms to MIT or other third-party components.

Current creative direction: [awe, motion, release](docs/design/direction.md).
The owner wants ambitious, coherent work with strong visual impact, clear
actions and earned musical peaks. Six authored levels are a content frontier,
not an endless exam or a prohibition on new mechanics.

## Architecture

- Phaser 4.2.1 owns the frame loop, scenes, input and resize.
- src/main.ts configures the canvas renderer and launches BootScene/CosmoScene.
- BootScene loads public/art/manifest.json and its approved textures into
  Phaser's cache. The runtime can render its procedural fallback without them.
- CosmoScene forwards normalized input and renders the runtime through a
  Phaser display object. There is no iframe or second live animation loop.
- src/game/contracts.ts and runtime.d.ts define the typed runtime boundary.
  src/game/runtime.js still contains the tuned JavaScript gameplay, audio,
  drawing and GPU effects. Do not claim that this core is fully TypeScript.
- src/platform/native.ts owns optional haptics, native/document lifecycle and
  Android Back. It depends on callbacks, not gameplay imports.
- index.html is the HTML shell. Vite builds the web product into dist/.
- public/ is intentional release content. Internal docs, tools, native source,
  package files and source maps do not belong in the published site.
- Capacitor 8 packages dist/ into android/ and ios/. There is no release
  server.url. Native assets work offline; cloud accounts remain optional.

Keep ownership explicit when moving another subsystem. A scene shutdown must
remove listeners, stop audio and release runtime/GPU resources. Never leave
both Phaser input/frames and legacy DOM input/frames active.

## Working commands

Use Node 22 or newer and the pinned package lock.

```sh
npm ci
npm run dev
npm run typecheck
npm run test:fast
npm run build
npm test
npm run native:sync
```

Development runs at http://localhost:5173. Browser checks need Chromium
(`npx playwright install chromium` if absent). Use a server for the module
entry; do not open source index.html through file://.

The checks extract the canonical JavaScript runtime through
tools/lib/game-source.mjs. Keep its markers and typed host boundary intact.
Harness randomness is injected at the sandbox boundary; failures print a seed.
Reproduce the reported seed rather than rerunning blindly.

## Before shipping

Complete the authorized change, run the required checks and inspect a real
browser frame for visual changes. Keep additional testing proportional to
actual failures. The owner leads broader playtesting and taste decisions;
automated measurements do not prove that a game feels good.

The established workflow is a direct main push after checks when shipping is
authorized. Do not manufacture a pull request or review-watching workflow.
Open one when requested or when a concrete review need warrants it.

Publish only dist/. Main releases use the repository's workflow; Netlify
functions are deployed separately from the public game assets. The Vite build
stamp identifies the source commit. Check the deployed build before calling a
release live; a local build is not deployment evidence.

After the final web build, synchronize both native projects. Do not describe
scaffolding as an APK, signed app or tested native release. Android requires an
SDK/JDK; iOS requires macOS/Xcode and the owner's signing credentials.

## Where to read

| Change | Read |
|---|---|
| Content, teaching or player-facing copy | docs/design/teaching.md, levels.md, MECHANICS.md |
| Powerups, upgrades or the lab | docs/design/powerups.md, docs/design/difficulty.md |
| Music, cues or scheduling | docs/design/audio.md |
| Rendering, shaders or assets | docs/design/direction.md, docs/engine/implementation.md |
| State, clocks, records or geometry | docs/invariants.md |
| Accounts or server functions | docs/engine/cloud.md |
| Build or delivery | docs/engine/delivery.md |
| Native lifecycle or packaging | docs/engine/native.md |
| Check coverage | docs/harnesses.md |

Keep docs synchronized with behavior. The mechanics ledger must name every
shipped tier and lab orb. Preserve meaningful regression checks; revise old
design assertions when the owner's approved behavior changes.

## Player-facing contracts

Tap always turns; swipe always changes ring. No temporary tap-to-play melody,
drum or echo assignment. Starfall is earned from three star-fed orbits, or two
with its upgrade, and releases automatically. Magnet visibly attracts stars.
Every instruction must name a real action and its observable result.

The scene has a textured planet, luminous atmosphere/rings and a deep nebula.
Keep the comet, stars and red threats readable against it. Use coordinated,
bounded impact envelopes for large rewards; preserve a calmer ordinary state.
Current renderer controls are SKY_ARENA_CALM = 0.62 and GL_MOTION = 1.0.

A muted, offline or interrupted game still works. Keep input, audio, scoring,
shield, upgrade and timer behavior aligned with what the player can see.
