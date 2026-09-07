# Never leave both Phaser and the legacy DOM path active

*What this answers: what "never leave both Phaser input/frames and legacy DOM
input/frames active" means concretely, which four guards enforce it, how the
failure would look, and what would actually catch it.*

`src/game/runtime.js` still contains its entire pre-Phaser standalone boot: a
`requestAnimationFrame` loop, pointer/keydown listeners on the canvas, a
`window` resize listener, a `document` visibilitychange listener and a
self-refresh fetch. None of it is dead — the VM and pixel harnesses depend on it
(see `db/notes/code/runtime-extraction.md`). All of it is switched off in
production by two boolean host fields.

## The guards, in source order

| runtime.js | Guard | What it suppresses in production |
|---|---|---|
| 94 | `if(runtimeDestroyed||runtimeHost.externalLoop)return;` | `freshCheck()` — the build-freshness fetch/redirect |
| 676 | `if(!runtimeHost.externalLoop)runtimeListen(window,'resize',resize)` | a second resize owner |
| 2854 | `if(!runtimeHost.externalLifecycle)runtimeListen(document,'visibilitychange',…)` | a second pause/resume owner |
| 7461-7468 | `if(!runtimeHost.externalLoop){ … }` | `pointerdown/move/up/cancel` and `contextmenu` on `#c`, plus `keydown` on `window` |
| 12261-12264 | `if(!runtimeHost.externalLoop){ requestAnimationFrame(frame); freshCheck(); }` | the standalone frame loop |

`CosmoScene` sets both flags to the literal `true` at
`src/scenes/CosmoScene.ts:38`. They are typed as the literal type `true` in
`RuntimeHost` (`src/game/contracts.ts:35-36`), so a host cannot pass `false` and
still typecheck — a deliberate, and easily overlooked, piece of enforcement.

## What breaking it looks like

Both flags are load-bearing in different ways, and the failure modes differ:

- **Two frame loops.** `frame()` (runtime.js:12181-12186) calls `runtimeStep` and
  `runtimeRender` itself. Beside Phaser's `update()` the simulation would advance
  roughly twice per displayed frame — every timer, deadline and audio schedule runs
  double speed — while `runtimeFrames` outruns `engineUpdates`. Nothing visibly
  crashes. It reads as "the game got harder".
- **Two input paths.** The canvas listeners and Phaser's forwarded pointers both
  reach `pointerDown`. A single tap reverses twice, which is a no-op, so the
  symptom is *taps stop working*, not an error.
- **Two resize owners.** `resize()` called with no arguments takes the
  `!external` branch and writes `cv.width`/`cv.style.width` directly
  (runtime.js:625-628), fighting Phaser's Scale Manager for the backing store.
- **Two lifecycle owners.** `runtimeVisibilityChanged` (runtime.js:2838) and
  `installNativeBridge`'s own visibility listener would both fire; the bridge
  deduplicates its *own* transitions but knows nothing about the runtime's.

## What actually catches it

Only `tools/enginecheck.mjs`, and only at runtime. It samples
`COSMO_APP.snapshot()` 400ms apart and asserts (enginecheck.mjs:111-114):

```
updates > 0                                   'the Phaser loop stopped'
|(steps  - steps)  - updates| <= 1            'simulation is not stepping once per Phaser update'
|(frames - frames) - updates| <= 1            'a second render loop is active'
```

Two caveats worth knowing before relying on it:

1. enginecheck declares `@lane full`, so `npm run test:fast` never runs it.
2. It prints `SKIP` and exits 0 when Playwright or Chromium is missing and `CI`
   is unset (enginecheck.mjs:33-37). On a developer machine without a browser,
   this invariant has no check at all.

There is **no static guard**. `tools/check.mjs` never mentions `externalLoop`,
`externalLifecycle`, or the `runtimeListen` call sites. Deleting one of the five
guards above passes `--fast`, passes `check.mjs`, and passes every VM harness —
the VM harnesses want the legacy path switched on.
