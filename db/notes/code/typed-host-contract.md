# The typed host contract, field by field

*What this answers: exactly what `CosmoScene` hands to `createCosmoRuntime`,
what the runtime does with each field, and which responsibilities stay on the
runtime's side of the seam even though they look like the shell's job.*

Cosmo is one game split across two languages. The tuned simulation, audio, 2D
drawing and both WebGL chains live in `src/game/runtime.js` — 12,272 lines of
plain JavaScript. Everything that talks to the browser as a *platform* — the
frame loop, the scene graph, pointer and keyboard events, the backing store, the
texture cache, native lifecycle — is TypeScript under `src/`. The two meet at
one function:

```
export function createCosmoRuntime(host = {}): GameRuntime   // runtime.js:6
```

`src/game/runtime.d.ts` is the only type Phaser ever sees of that file.
`src/game/contracts.ts` declares both halves: `RuntimeHost` (what goes in) and
`GameRuntime` (what may be called back).

## What goes in

Built at `src/scenes/CosmoScene.ts:35-44`.

| Host field | Who supplies it | What the runtime does with it |
|---|---|---|
| `canvas` | Phaser's game canvas (`#c`) | `cv` at runtime.js:50 — every 2D draw target |
| `context` | `canvas.getContext('2d')`, the same context Phaser's Canvas renderer uses | `ctx` at runtime.js:51 |
| `background` | `#bg`, the second DOM canvas | the WebGL sky's surface, `glInit` at runtime.js:9659 |
| `width` / `height` | `window.innerWidth` / `innerHeight` — **CSS pixels, not backing store** | `W` / `H`, all gameplay geometry |
| `dpr` | `min(devicePixelRatio, 2)` | `DPR`, and the canvas transform at runtime.js:629 |
| `externalLoop: true` | the literal type `true` | disables the runtime's own rAF loop, canvas input listeners, window resize listener and `freshCheck` |
| `externalLifecycle: true` | the literal type `true` | disables the runtime's own `visibilitychange` listener |
| `native` | `Capacitor.isNativePlatform()` | suppresses the iOS in-app-browser hint (runtime.js:57) |
| `haptic` | `haptic()` from `src/platform/native.ts` | reached only through `gameHaptic` (runtime.js:11-16) |
| `getTexture` | a closure over Phaser's texture cache | art lookups; `null` means draw the procedural fallback |

The runtime imports no Phaser and no Capacitor. `src/platform/native.ts` in turn
imports no gameplay — it takes three callbacks. That is what keeps the boundary a
boundary.

## What comes back

Twelve methods (runtime.js:12266-12271): `step`, `render`, `resize`,
`pointerDown`, `pointerMove`, `pointerUp`, `pointerCancel`, `keyDown`, `pause`,
`resume`, `back`, `snapshot`, `destroy`. The scene calls `step` from `update()`
and `render` from a display object's `renderCanvas`. Nothing else in the shell may
reach into the runtime.

`back()` is the only one that returns a value, and it returns `boolean` because
Android Back has to know whether the app should minimise.

## Two safety habits on the runtime's side

`runtimeHost` (runtime.js:10) re-binds `host` through a null guard, so
`createCosmoRuntime(null)` cannot throw on a property read. Every host access
should go through it — six art lookups currently do not; see
`db/notes/code/boundary-drift.md`.

`runtimeListen` (runtime.js:20-26) is the only sanctioned way for the runtime to
add a DOM listener: it registers the handler *and* pushes its remover onto
`runtimeUnsubscribers`, which `runtimeDestroy` drains. A raw `addEventListener`
anywhere in `runtime.js` is a leak by construction.

## What the runtime still owns that looks like the host's job

- **WebAudio.** Phaser's sound manager is switched off outright
  (`audio: { noAudio: true }`, `src/main.ts:19`). `ensureAudio()` at
  runtime.js:2818 creates, resumes and gesture-unlocks the context. See
  `db/notes/code/native-lifecycle.md`.
- **`localStorage` and `window.storage`.** The runtime installs and removes the
  async cloud shim itself (runtime.js:3880-3901), and `runtimeDestroy` removes it
  only if it is still the object it installed (runtime.js:12248).
- **One DOM screen.** The account panel `#acct` is real markup because a canvas
  cannot raise a keyboard or accept a password manager; the reasoning is written
  into `src/styles.css:14-22`. The runtime binds its buttons through
  `runtimeListen` (runtime.js:4007-4009) and clears `acBody.innerHTML` on close so
  a password never lingers in the DOM (runtime.js:4034).
- **Both WebGL contexts.** `GL` is the sky on the host's `#bg`; `FX` is the bloom
  chain on a canvas the runtime creates itself (`fxInit`, runtime.js:10188).
  Which one may lose its context at teardown is decided by who owns the surface —
  see `db/notes/code/scene-shutdown.md`.
- **Safe-area insets.** Read from `getComputedStyle('#safe')`, not from the host
  (runtime.js:632-640).
