# The host boundary: what Phaser owns and what the runtime owns

**What this answers:** the exact surface between `src/game/runtime.js` and its
Phaser host, which parts of the runtime change behaviour when a host is present,
and what a scene shutdown has to release.

## The two directions

**Host → runtime**, read off `runtimeHost` (line 10, `typeof host!=='undefined'&&host?host:{}`):

| Field | Read at | Effect |
|---|---|---|
| `canvas` | 50 | the 2D target; falls back to `document.getElementById('c')` |
| `context` | 51 | the 2D context; falls back to `cv.getContext('2d')` |
| `background` | 9658 | the WebGL backdrop canvas; falls back to `#bg` |
| `externalLoop` | 619, 624, 676, 7460, 12256 | **the master switch.** When true the runtime never sizes the canvas itself, never registers window/canvas listeners, never schedules `requestAnimationFrame`, and never runs `freshCheck` |
| `externalLifecycle` | 2884 | suppresses the runtime's own `visibilitychange` listener |
| `width` / `height` / `dpr` | 620–622, 677 | initial and fallback viewport |
| `insets` | 632 | safe-area insets, as a function or an object; falls back to the computed padding of `#safe` |
| `haptic(kind)` | 13 | native haptics; falls back to `navigator.vibrate(webPattern)` |
| `native` | 57 | suppresses the iOS in-app-browser hint |
| `getTexture(key)` | 8841, 9774, 11741, 11762, 11791 | the approved art atlas; every call site has a procedural fallback |

**Runtime → host**, the object returned at 12266–12272:

```
{ step, render, resize,
  pointerDown, pointerMove, pointerUp, pointerCancel, keyDown,
  pause, resume, back, snapshot, destroy }
```

`src/game/contracts.ts` and `src/game/runtime.d.ts` type this surface;
`tools/lib/game-source.mjs` extracts the body between the
`// @runtime-body:start` (7) and `// @runtime-body:end` (12265) markers for the
VM harnesses, which evaluate it with no host at all and get the standalone boot.

## `step` and `render` are separate, deliberately

`runtimeStep(deltaMs)` (12155) clamps to 0.05 s and calls `update(dt)`.
`runtimeRender()` (12161) calls `draw()`. `frame(now)` (12181) is the *legacy*
self-driven loop and only ever runs when `!runtimeHost.externalLoop`.

`enginecheck.mjs` asserts on the built app that there is exactly one Phaser
scene, that `loopOwner` is Phaser, and that `steps` and `frames` each advance
once per Phaser update (±1) — i.e. that a second render loop is not active.
`runtimeSnapshot()` (12212) exposes `frames` and `steps` for exactly that.

## Lifecycle

- `runtimePause()` (12187) — pauses the game if playing (bypassing the
  anti-farming `PAUSE.cool` guard, which still applies to the in-game button),
  otherwise just `pauseAudio()`. Drops `pd` so a held finger cannot steer on
  resume.
- `runtimeResume()` (12197) — unpauses or re-ensures audio and ends the section,
  and resets `last` so the legacy loop cannot fast-forward.
- `runtimeBack()` (12203) — Android Back, in priority order: close the account
  panel, unpause, leave a lab run to the picker, pause a live run, otherwise
  return to the menu. Returns false only when already on the menu, which is the
  signal for the host to let the OS handle it.
- `runtimeDestroy()` (12241) — cancels any rAF, runs every unsubscriber
  registered by `runtimeListen` (20), flushes and removes the cloud storage seam,
  clears input and audio queues, closes the account panel, closes the
  `AudioContext`, disposes **both** GPU targets via `runtimeDisposeGpu` (12221),
  and empties `SPR`, `artifactBank` and the six bloom canvases.

`runtimeDisposeGpu` deliberately does **not** force a context loss on the
backdrop canvas when the host supplied it (`target !== GL || !runtimeHost.background`,
12234), because Phaser may reuse that surface after a scene restart.

## Listener ownership

Every listener the runtime adds goes through `runtimeListen(target, type, listener, options)`
(20), which pushes a matching remover onto `runtimeUnsubscribers`. There is no
`addEventListener` anywhere else in the file except through this helper and
`acOn` (4007), which itself delegates to it.

Under `externalLoop` the runtime registers **no** canvas or window listeners
(7460–7466): pointer and key events arrive as method calls, normalized through
`runtimePointerEvent` (27) and `runtimeKeyEvent` (34) so a synthetic event object
with only `{x, y, id}` works as well as a real `PointerEvent`.

## The one real-DOM reach

The account panel (3995–4247) is the only part of the file that touches DOM nodes
other than the canvas — `#acct`, `#ac-h`, `#ac-sub`, `#ac-body`, `#ac-x`. Every
harness but one runs the file against a stubbed DOM, so `AC_DOM` (4010) checks
*results* rather than existence, and `openAccount` returns immediately when it is
false. Loading the game must never throw; the panel is inert without a real
document.

`keyDown` (7377) is the only window-level listener, and it hands the keyboard to
the account panel while it is open (7383–7385) — otherwise typing a name would
reverse the comet on every space and mute on every `m`.

## Freshness and the build stamp

`BUILD` (73) is `'dev'` in source and is replaced with a short commit SHA by the
deploy workflow; it is also published as `window.COSMO_BUILD`. `freshCheck()`
(93) fetches the first 8 KiB of `index.html` past the CDN with a minute-bucketed
query, reads the stamp out of it, and swaps once — but only from the title
screen, only when not already carrying `?u=`, never for `'dev'`, and never under
`externalLoop`. Every failure is silence.
