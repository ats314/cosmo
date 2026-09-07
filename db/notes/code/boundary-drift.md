# Where the host boundary and its description disagree

*What this answers: the places where `contracts.ts`, `runtime.js`, the manifest
and the engine docs currently describe different things — each one read in
source, not recalled.*

None of these are breaking the shipped game today. All of them are traps for the
next session that trusts the description instead of the file.

## 1. `runtimeHost.insets` is a host field no host supplies

`resize()` reads it first, before falling back to the `#safe` probe element:

```js
// src/game/runtime.js:633-639
const insets = typeof runtimeHost.insets === 'function' ? runtimeHost.insets() : runtimeHost.insets;
if (insets) { safeTop = …; safeBot = …; }
else { const cs = getComputedStyle(safeEl); … }
```

`RuntimeHost` (`src/game/contracts.ts:28-40`) declares no `insets`, and
`CosmoScene`'s host literal (CosmoScene.ts:35-44) does not pass one. Safe-area
insets therefore always come from `getComputedStyle('#safe')` and its
`env(safe-area-inset-*)` padding (`src/styles.css:11-12`). The typed path is the
one that exists; the untyped one is the one that runs.

## 2. `snapshot()` returns two fields the contract does not declare

`runtimeSnapshot` (runtime.js:12212-12220) returns `build: BUILD` and
`destroyed: runtimeDestroyed` on top of the declared `GameSnapshot`
(contracts.ts:4-20). Because `runtime.js` is JavaScript behind a hand-written
`.d.ts`, TypeScript never sees the difference. They are real and readable from
`window.COSMO_APP.snapshot()`; no harness reads either.

## 3. Six art lookups bypass the null-guarded host

`runtimeHost` exists precisely so a missing or null host cannot throw
(runtime.js:10). Six sites use the raw parameter instead:

```
runtime.js:8845   host.getTexture(artKey)          hazard/orb/star sprites
runtime.js:8986   host.getTexture('power-blackhole')
runtime.js:11047  host.getTexture('comet-core')
runtime.js:11741  host.getTexture('ui-panel-frame')
runtime.js:11762  host.getTexture('ui-primary-frame')
runtime.js:11791  host.getTexture('cosmo-wordmark')
```

Harmless while `host` defaults to `{}` and Phaser always passes an object.
`createCosmoRuntime(null)` would survive line 10 and throw at the first of these.
By contrast `skyArtImage` (runtime.js:9773-9776) does it correctly.

## 4. `freshCheck()` cannot fire in any shipping configuration

The self-refresh check (runtime.js:93-108) fetches the first 8KB of the page,
looks for `const BUILD='<7 hex>'` and redirects once if it names a newer build.
Three facts, all read this session:

- Its only call site is inside `if(!runtimeHost.externalLoop)`
  (runtime.js:12261-12263), and its own first line returns when `externalLoop` is
  set. In production it is unreachable.
- On the harness path `externalLoop` is unset, but `BUILD === 'dev'` and line 96
  returns.
- Its premise no longer holds either: Vite emits the runtime into
  `dist/assets/*.js`, and `dist/index.html` contains zero occurrences of
  `const BUILD=`. The only match in the whole bundle is the regex literal itself.

The 30 lines of comment above it (runtime.js:75-92) describe a GitHub Pages
inline-script deployment that the Vite build replaced.

## 5. `runtime.resume()` is contracted, exported and never called

`GameRuntime.resume()` (contracts.ts:51) and `runtimeResume()`
(runtime.js:12197-12202) exist. The native bridge's `resume` callback is wired to
`this.resizeToWindow()` instead (CosmoScene.ts:66), on purpose — see
`db/notes/code/native-lifecycle.md`. Worth knowing before "fixing" the apparent
omission: resuming a live run from the background is an invariant violation
(`docs/invariants.md:52`).

## 6. Eight manifest textures are downloaded and never used

`BootScene` queues every entry of `public/art/manifest.json` (34 keys) into
Phaser's cache. Cross-referencing the runtime's consumers — six literal
`getTexture` keys, the twelve-entry `artKey` table at runtime.js:8842-8844, and
the eight `SKY_ART_WORLDS` keys at runtime.js:9763-9772 — leaves 26 consumed and
these eight unconsumed:

`drift-planet`, `drift-ring`, `fx-plasma-wisp`, `fx-shock-ring`, `fx-soft-glow`,
`fx-spark`, `power-spotlight`, `emberfall-small-world`.

All eight files exist under `public/art/`, so they are shipped and decoded at
boot for nothing. (`drift-ring` matches the source only as a substring of
`drift-ringed-world`.)

## 7. `docs/engine/implementation.md` still opens on the pre-Phaser architecture

Lines 9-11: *"Everything is two `<canvas>` elements … driven by one inline
`<script>` of about 12,000 lines of plain JavaScript. No build step, no
dependencies, no external assets."* The two canvases are still right. The inline
script, the absent build step, the absent dependencies and the absent external
assets are all four now false — `CLAUDE.md` describes the current architecture,
and this file's own "Current presentation" section immediately below is current.
