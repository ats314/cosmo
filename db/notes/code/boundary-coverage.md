# What actually checks the host boundary

*What this answers: for each ownership rule at the Phaser/runtime seam, which
harness asserts it, and which ones nothing asserts.*

Nine harnesses run in CI (`.github/workflows/pages.yml:31-39`). Eight of them
load the runtime through `tools/lib/game-source.mjs`, which supplies an **empty**
host — so eight of nine exercise the *legacy standalone* path and can say nothing
about the Phaser integration. `tools/enginecheck.mjs` is the only check that ever
sees a `RuntimeHost`.

## Asserted

| Rule | Where |
|---|---|
| The built app boots on Phaser and exposes `COSMO_APP` | enginecheck.mjs:76-82 |
| Exactly one active scene, at boot and after a resize | enginecheck.mjs:83, 122 |
| One simulation step per Phaser update (±1 over 400ms) | enginecheck.mjs:113 |
| One render per Phaser update — "a second render loop is active" | enginecheck.mjs:114 |
| The Phaser loop has not stopped | enginecheck.mjs:112 |
| A real pointer tap reverses exactly once | enginecheck.mjs:93-95 |
| A real CDP touch swipe changes ring by exactly one, inward | enginecheck.mjs:101-108 |
| Portrait→landscape→portrait resize keeps the live run and updates `viewport` | enginecheck.mjs:117-126 |
| No uncaught page error, and `window.__drawErr` is null | enginecheck.mjs:127-128 |
| Play survives every external request being aborted | enginecheck.mjs:68-72 |
| The app shell has a module entry and no second inline copy of the game | check.mjs:471-474 |
| Every `getElementById` id the runtime uses exists in the markup | check.mjs:36-43 |
| The extracted body is exactly one script block and parses | check.mjs:12-21 |
| Exactly one ordered pair of runtime-body markers | game-source.mjs:13-15 (throws) |
| `dist/` publishes no internal file, and keeps the proprietary notice | check.mjs:501-514 |

## Not asserted by anything

- **That the five `externalLoop`/`externalLifecycle` guards still exist.** No
  static check mentions either flag. Removing one passes `--fast` and every VM
  harness, because those harnesses *want* the legacy path on. Only enginecheck's
  counter comparison would notice, and only for the loop guards.
- **Scene shutdown.** Nothing restarts a scene, so `CosmoScene.shutdown()`,
  `runtimeDestroy()` and `runtimeDisposeGpu()` are verified by reading only. The
  `sceneCount === 1` assertions are the closest proxy.
- **The native bridge.** `installNativeBridge`, Android Back, `App` lifecycle
  events and haptics have no harness at all; `docs/harnesses.md:55` says so
  explicitly ("it does not sign in or operate native apps"). `runtimeBack()`'s
  six-step priority chain is unexercised.
- **Audio unlock.** `smoke.mjs` deliberately returns `undefined` for
  `AudioContext` (smoke.mjs:66) to exercise the guards, so the unlock path itself
  — `ensureAudio`'s one-sample buffer, the `interrupted` state — is never run.
- **Texture handover.** No check compares `public/art/manifest.json` against the
  keys the runtime asks for, in either direction. Eight manifest entries are
  currently loaded and never requested (see `db/notes/code/boundary-drift.md`).
- **Safe-area insets.** `getComputedStyle` is stubbed flat in the harnesses
  (smoke.mjs:54 returns `paddingTop: '0'`), so no check sees a real inset.

## Two ways this coverage disappears quietly

1. enginecheck declares `@lane full`. `npm run test:fast` skips it, and with it
   every assertion in the first table's top ten rows.
2. enginecheck prints `SKIP` and exits **0** when Playwright or Chromium is
   missing and `CI` is unset (enginecheck.mjs:33-37). A developer machine without
   a browser reports a green suite with the boundary entirely unchecked.
   `check.mjs:461-463` already guards this failure mode for `rendercheck` — it
   fails if CI runs rendercheck without installing a browser — but there is no
   equivalent guard naming `enginecheck`.
