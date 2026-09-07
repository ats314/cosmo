# What a scene shutdown must release

*What this answers: the exact teardown sequence when `CosmoScene` shuts down,
what each step releases, and the one WebGL context that must deliberately
survive.*

`docs/invariants.md:120-121` states the rule: *"Scene teardown removes
input/lifecycle listeners, timers, audio and graphics resources. A reload must
not accumulate another running game."* Two functions implement it.

## Half one — the scene (`src/scenes/CosmoScene.ts:106-120`)

Registered as `this.events.once(SHUTDOWN, this.shutdown, this)` at line 56, so it
does not need unregistering. In order:

1. `this.disposed = true` — makes `resizeToWindow()` a no-op even if a queued
   resize event lands after teardown (guard at line 95).
2. `this.disposeNative?.()` — the Capacitor/visibility bridge.
3. `window` and `window.visualViewport` `resize` listeners.
4. `game.events.off(BLUR, …)`.
5. Four Phaser input listeners plus `input.keyboard?.off('keydown', …)`.
6. `this.runtime?.destroy()`.
7. `delete window.COSMO_APP`.

Two ordering details that are not accidents. `installNativeBridge` is
asynchronous; if the scene shuts down before it resolves, the `.then` at line 68
sees `this.disposed` and disposes immediately rather than storing a disposer
nobody will ever call. And `OrbitDisplay` is never explicitly destroyed — it
holds its own reference to the runtime, so `runtime.render()` could still be
invoked after step 6; `runtimeRender` returns immediately on `runtimeDestroyed`
(runtime.js:12162), which is what makes that safe.

## Half two — the runtime (`runtimeDestroy`, runtime.js:12241-12258)

1. Sets `runtimeDestroyed = true`; every entry point checks it first.
2. Cancels `runtimeFrameId` (only ever non-zero on the standalone path).
3. Drains `runtimeUnsubscribers` — every listener added through `runtimeListen`,
   including the account-panel buttons and both canvases'
   `webglcontextlost`/`webglcontextrestored` handlers.
4. Flushes the pending cloud push (`clearTimeout(cloudTimer); cloudPushNow()`).
5. Removes `window.storage` **only if it is still the object this runtime
   installed** — the `window.storage === runtimeCloudStorage` test at line 12248.
6. Drops held input (`pd = null`) and clears `BEATQ` / `DROPQ`.
7. Closes the account panel, then closes the `AudioContext` and nulls `AC`, `A`,
   `BED`.
8. `runtimeDisposeGpu(GL)` and `runtimeDisposeGpu(FX)`.
9. Empties the sprite cache `SPR`, the artifact bank, and the bloom/halo canvases.

## The context that must not be lost

`runtimeDisposeGpu` (runtime.js:12221-12240) deletes textures, framebuffers,
buffers, shaders and programs for its target, then:

```js
if(target!==GL||!runtimeHost.background){ …WEBGL_lose_context.loseContext() }
```

`FX` draws into a canvas the runtime created with `document.createElement`
(runtime.js:10188), so losing its context is free. `GL` draws into `#bg`, which
the *host* supplied and which Phaser may hand to a restarted scene — forcing a
context loss there would leave the next scene with a dead surface. The comment on
line 12232 says exactly this. If `#bg` ever stops being host-supplied, this
branch has to be revisited.

## What no check asserts

`tools/enginecheck.mjs` asserts `sceneCount === 1` at boot and again after a
resize (enginecheck.mjs:83, 122) — that is the closest thing to a
"no accumulated game" test. Nothing exercises an actual scene restart, so the
teardown path above is verified only by reading. `src/main.ts:26` wires
`import.meta.hot.dispose(() => game.destroy(false))`, which is the one place a
developer will hit it routinely, and only in dev.
