# Lifecycle, Android Back, audio unlock and haptics

*What this answers: who decides the game is in the background, what happens on
the way back, how the audio context gets unlocked, and why Back is a boolean.*

## One bridge, three callbacks

`installNativeBridge(callbacks)` (`src/platform/native.ts:52-93`) is bound once,
from `CosmoScene.create()` (CosmoScene.ts:63-68), and returns a disposer. It
imports nothing from the game.

It maintains two independent booleans and publishes their AND:

- `visible` — from `document.visibilitychange`, always bound, web and native.
- `nativeActive` — from Capacitor `App` events, bound only when
  `Capacitor.isNativePlatform()`: `appStateChange`, and separately `pause` and
  `resume`, because "a transient activity can resume without ever reaching
  onStop/onStart" (native.ts:76-78). The initial value is read once from
  `App.getState()`.

`publish()` (native.ts:59-67) fires `callbacks.pause()`/`resume()` **only on a
change** of the combined state, so a background transition that produces both an
`appStateChange` and a `pause` event pauses once. The module-level `foreground`
flag it also sets is what gates haptics.

`Promise.allSettled` around the four `addListener` calls means a plugin that
fails to bind cannot stop the others, and only fulfilled handles go into the
disposer's list.

## What pause and resume mean to the game

`callbacks.pause` → `runtime.pause()` → `runtimePause()` (runtime.js:12187-12196).
It calls `pauseGame()` while deliberately preserving `PAUSE.at` and zeroing
`PAUSE.cool`, so a background event freezes the run **even during the in-game
pause button's anti-farming cooldown**. If the game is not playing it just calls
`pauseAudio()`. It always drops held input (`pd = null`).

`callbacks.resume` → **not** `runtime.resume()`. `CosmoScene.ts:66` deliberately
calls `this.resizeToWindow()` instead, with the comment *"Returning to the app
leaves the existing pause screen visible."* This is the code that satisfies
`docs/invariants.md:52` ("Native/background resume does not silently resume a
live run") and `docs/engine/native.md:92-93`. `runtimeResume()` exists
(runtime.js:12197-12202) and is exported through the contract, but nothing in the
shell calls it.

`Phaser.Core.Events.BLUR` is wired separately to `runtime.pause()`
(CosmoScene.ts:55, 92). There is no FOCUS counterpart — losing focus pauses,
regaining it does not resume.

## Android Back

`App.addListener('backButton', …)` (native.ts:79-82) calls `callbacks.back()` and
minimises the app when it returns `false`. `runtimeBack()`
(runtime.js:12203-12211) is a strict priority chain:

1. account panel open → `closeAccount()`
2. paused → `unpauseGame()`
3. lab on, and playing or dead → `enterPowerSel()`
4. playing → `runtimePause()`
5. any state that is not `menu` → `enterMenu()`
6. otherwise `false` — the root title, where Back minimises

## Audio unlock

Phaser's sound manager is disabled outright: `audio: { noAudio: true }` in
`src/main.ts:19`, with the comment that the game's keyed WebAudio instrument owns
sound. So Phaser performs no unlock and the runtime must do it itself.

`ensureAudio()` (runtime.js:2818-2835) creates the context on first use, resumes
it from `suspended` **or** WebKit's `interrupted` (a phone call or alarm), and —
once — plays a one-sample buffer, because iOS will not truly start a context
until something has been played through it inside a user gesture. It is called
from the top of `pointerDown` (runtime.js:7131) and from the Space/Enter branch
of `keyDown` (runtime.js:7417), both of which arrive inside a real forwarded
browser gesture, plus from `unpauseGame()` (runtime.js:3298) and
`toggleMute()` (runtime.js:2871).

The context is **never suspended on pause**. The 14-line comment at
runtime.js:3263-3276 is the reasoning: suspending would need a gesture to come
back, `musicTick` already survives an arbitrary gap by abandoning a stale
section, and every tap calls `ensureAudio()` anyway. `pauseAudio()`
(runtime.js:3277-3281) instead ends the section, clears the beat/drop queues and
ramps the pad's gain to 0.005.

## Haptics

`haptic(kind)` (native.ts:28-48) is passed in as `host.haptic` and reached from
gameplay only through `gameHaptic` (runtime.js:11-16), which falls back to
`navigator.vibrate` when no host callback exists and swallows every error.

The rate limit is one pulse per 65ms unless a higher-priority kind supersedes:
`death` = 3, `impact`/`reward` = 2, everything else = 1. On the web path the
durations are `death` 55ms, `impact` 35, `reward` 24, `hop` 12, otherwise 7. On
native it maps to `Haptics.notification` for reward/death and `Haptics.impact`
Heavy/Medium/Light otherwise. Suppressed entirely when `document.hidden` or when
the bridge says the app is backgrounded.
