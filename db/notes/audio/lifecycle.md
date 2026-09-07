# Muted, paused, interrupted, backgrounded, offline

*What this answers: what the audio system does in every state where sound
cannot or should not be produced, and which of those states are allowed to
affect gameplay. The short answer to the last question is: none of them.*

## Offline is not a state

There are **no audio files anywhere in the repo**. Everything is synthesised in
WebAudio at runtime — the pad, every drum, the reverb impulse, the noise
buffer, the distortion curve. `find public -name '*.mp3' -o -name '*.wav' -o
-name '*.ogg' -o -name '*.m4a'` returns nothing. A cold offline launch has the
full soundtrack, and cloud accounts are irrelevant to it.

## Muted: mute the bus, never the clock

`toggleMute()` — `runtime.js:2866-2882`.

```js
muted = !muted; savePref('cometloop:muted', muted?'1':'0');
popup(..., muted ? 'SOUND OFF' : 'SOUND ON', ...);
ensureAudio();
if (muted) endSection();
if (A&&AC) A.out.gain.setTargetAtTime(muted?0:1, AC.currentTime, 0.02);
if (!muted) beep(700, 0.08, 'sine', 0.05, 1000);
```

The 20 ms ramp rather than a jump means muting mid-decay does not click.

**The important half is what it does *not* do.** The old build guarded
`musicTick`, `judgeTiming` and `performerHit` on `muted`, and that did not
silence the rhythm system — it deleted it. `musicTick` returning early left
`MU.next` frozen, so `gridOff()` answered its sentinel forever, `BEATQ` never
filled, `G.beat` never left 0, and even the *visual* beat stopped. Sound off
meant no groove, no score from it, no Starfall and no metronome — for a deaf
player, or anyone on a bus, the whole mechanic did not exist.

Now the clock always runs and only the output is gated. `note()`, `hat()`,
`kick()`, `swellPad()`, `riser()`, `gtr()`, `beep()` and `soundImpact()` each
early-out on `muted`, so a silent run still costs nothing to play. `endSection`
runs on mute so a section muted mid-flight is not left running out silently
against a ducked bus.

Mute persists per device (`cometloop:muted`), and the popup exists because a
silent game with no acknowledgement reads as broken audio rather than as a
setting someone switched.

## Paused

`pauseAudio()` — `runtime.js:3277-3281`, called by `pauseGame()` and by
`runtimePause()` (the native/back path):

```js
endSection();                        // banks an earned drop instead of eating it
BEATQ.length = 0; DROPQ.length = 0;  // or resuming fires a stale drop shake
if (BED&&AC) BED.g.gain.setTargetAtTime(0.005, AC.currentTime, 0.08);
```

The context is deliberately **not** suspended. `musicTick` already survives an
arbitrary gap — it detects `MU.next` falling more than 0.4 s behind, abandons
the section rather than replaying it compressed, and restarts on the next grid
line — and `guard++<16` bounds the worst case regardless. The source is explicit
that this should stay a copy of the `visibilitychange` handler rather than a
second answer to the same question.

`unpauseGame()` calls `ensureAudio()` from **inside the tap that asked for it**,
which is the only place iOS reliably lets a context come back. `bedTick` restores
the pad on the first live frame.

`frozen()` (`PAUSE.on || PAUSE.resumeT>0`) additionally gates `performerHit` and
`soundImpact`, so nothing sounds during the resume countdown.

## Backgrounded

`runtimeVisibilityChanged()` — `runtime.js:2838-2853`:

- **Hidden:** `endSection()`, take `BED.g` to 0.005 over 0.15 s, and clear
  `BEATQ` and `DROPQ`. Desktop and Android keep WebAudio running in a hidden
  tab but the rAF loop stops — so without this the pad froze at playing volume
  and droned one chord for as long as the tab stayed hidden. Draining the
  queues stops a return minutes later from firing a stale drop shake.
- **Visible:** `ensureAudio()` then `endSection()`. iOS can replay pending
  automation compressed on resume, so a section in flight is abandoned rather
  than rushed through.

The listener is only attached when the host does not own the lifecycle:
`if(!runtimeHost.externalLifecycle) runtimeListen(document,'visibilitychange',...)`.
Under Phaser/Capacitor, `CosmoScene` sets `externalLifecycle: true` and the host
calls `runtimePause`/`runtimeResume` instead — Android `onPause` precedes
`onStop` and audio must not be left playing in between.

## Interrupted (iOS)

`ensureAudio()` — `runtime.js:2818-2837`:

```js
if (!AC) AC = new (window.AudioContext||window.webkitAudioContext)();
if (AC.state==='suspended' || AC.state==='interrupted') AC.resume();
if (!audioUnlocked && AC.state!=='closed') {
  const src = AC.createBufferSource();
  src.buffer = AC.createBuffer(1,1,22050);
  src.connect(AC.destination); src.start(0);
  audioUnlocked = true;
}
buildBus();
```

Two device facts are encoded here:

1. `'interrupted'` is WebKit-only and is where a phone call, Siri or an alarm
   leaves you. Nothing else in the codebase recovers from it, and it is **not**
   `'suspended'`.
2. iOS will not actually start a context until something has been played through
   it inside a user gesture — `resume()` alone can leave it silent. A one-sample
   buffer is enough and is inaudible.

`bedTick` carries the backstop for the case nobody enumerated: it runs from
`update()` unconditionally, and

```js
if (MU && MU.pay>0 && t > MU.payEnd) endSection();
```

catches every stall path including an iOS phone-call interrupt mid-section,
where `musicTick` is bailing on `AC.state` and only this line would notice.

## Audio never gates gameplay

This is the invariant (`docs/invariants.md:73-74`) and it appears in the source
in three places:

- `build()` — if `MU`, `AC` or a running context is missing, it calls
  `startStarfall()` directly instead of `armDrop()`. The reward is not lost;
  it is merely not quantised.
- `cueTone()` — with no context, or a context that is not running, it invokes
  its callback with a delay of 0 rather than dropping it.
- Every voice function returns silently on a missing bus, missing context or
  mute, wrapped in `try/catch` so a hostile or exhausted WebAudio implementation
  cannot throw into the frame loop.

`musiccheck` proves the whole path is buildable under a stubbed context
(`tools/musiccheck.mjs:183`), and `smoke.mjs` deliberately runs with WebAudio
**absent** to prove every audio path is guarded.
