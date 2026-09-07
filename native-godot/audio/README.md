# Cosmo native audio

These are original procedural Cosmo recordings, created by
`../tools/generate_audio.mjs`. They remain part of the proprietary Cosmo product;
no external recordings, samples, melodies or third-party audio libraries were used.

The native arrangement is 104 BPM, with six independently rendered minor-key
sets for world tonics MIDI 69, 67, 65, 63, 61 and 59. Four eight-bar stems share
exactly 576,000 frames at 31,200 Hz. The stereo bed contains dark chord voices
and a sparse heartbeat; mono sub pulse, restrained drums and an authored
answer enter with earned intensity and inward flight. Stereo Starfall and ending
phrases are also rendered in every key. Bass and kick pitch classes fold upward
by octaves at the 40 Hz floor. Tonic changes do not resample music or change BPM.

The generator reads each world's `chord_degrees` and `arp` directly from
`scripts/cosmo_content.gd`. Natural-minor intervals `[0, 2, 3, 5, 7, 8, 10]`
build diatonic root/third/fifth voicings; the source progression changes every
four-beat bar and repeats twice across each eight-bar asset. Source bass octave
choices preserve TIDE's descending line and VEIL's climbing line. Each world's
own eight-note pentatonic arp supplies its slower answer and fuller Starfall
phrase. This is a native instrumental adaptation of the authored harmony and
contour, not a claim that every WebAudio voice or chorus has been reproduced.
Movement/pickup cues read that same world profile and sounding bar.

| World | Key | Source progression |
| --- | --- | --- |
| DRIFT | A minor | i – VI – III – VII |
| TIDE | G minor | i – VII – VI – iv |
| VEIL | F minor | i – III – v – VI |
| GLASS | Eb minor | i – VI – VII – i |
| EMBERFALL | Db minor | i – iv – VII – III |
| DEEPFIELD | B minor | i – iv – v – VI |

Run `node native-godot/tools/generate_audio.mjs` from the repository root to
recreate all WAVs and their checksum/peak/loop-boundary manifest. The script uses
only Node built-ins, a seeded noise source and explicit oscillator arrangements.
It checks finite samples, clipping, loop discontinuities and overlapping stem
headroom. This is functional signal validation; taste and device loudness need
listening and owner playtesting.

Run Godot with `--headless --path native-godot --script res://audio/verify_audio.gd`
for the focused native check. It compares rendered harmony/arp profiles and cue
roots with the source ledger, verifies sample-exact loop lengths in the actual
imported streams, and exercises running key changes, pause/resume, mute,
dilation, cue playback, ending and audio-bus teardown.

`scripts/reactive_audio.gd` owns one `AudioStreamSynchronized` music player, one
release player, eight reused cue players and one private audio bus with a
low-pass filter and a -1 dB peak limiter for overlapping action cues.
All bus resources and playback are released when the node exits the tree.
The host awaits `shutdown()` before quitting the application. This stops and
clears player streams, lets the native mixer retire them for 0.2 seconds, and
removes the private bus. It is idempotent; `_exit_tree` remains a fallback for
ordinary scene removal. Deferring shutdown until application `_exit_tree`
leaves no live mixer tick and is therefore too late for graceful retirement.
Audio stays optional: absent files return silently, mute preserves the transport,
and a stalled device falls back to a pause-aware local clock.

The scene calls `start_run()`, `stop_run()`, `set_paused(bool)`,
`set_muted(bool)`, `set_intensity(float)` (0–1), `set_lane(int)` (0 outermost),
`set_tonic(int)`, `set_dilated(bool)`, `beat_position()` and `cue(StringName)`.
Supported core cues are `turn`, `hop`, `star`, `orbit`, `magnet`, `hit`,
`starfall` and `finish`. `finish` can play after `stop_run()`. Additional power
aliases are documented in the script's cue dispatch. Movement and pickups have
immediate root/fifth cues, transposed to the current chord. Orbit adds a short
quantized answer; Starfall adds a complete four-bar release on the next quarter.
The `cue_started(kind)` signal identifies the expected audible start of a
quantized cue. The scene must retain ownership of rewards and cannot require
this signal to advance. Missing/muted audio reports the cue immediately.

The music stems start and pause as one stream. The audio clock compensates for
mix/output latency, rejects backward jitter, and unwraps loop position.
Quantized cues are dispatched from the process callback ahead of expected
speaker time; precision is bounded by frame and device mix scheduling, not a
claim of sample-exact input latency. Pause freezes the musical transport and
active release while discarding unfinished pickup cues. Dilation closes a
low-pass filter without slowing the beat grid. World-key changes fade at a bar
boundary and retain their phrase position; active Starfall finishes first.

Godot API references: [synchronized streams](https://docs.godotengine.org/en/stable/classes/class_audiostreamsynchronized.html),
[audio timing](https://docs.godotengine.org/en/stable/tutorials/audio/sync_with_audio.html),
[stream pause](https://docs.godotengine.org/en/stable/classes/class_audiostreamplayer.html),
[low-pass filters](https://docs.godotengine.org/en/stable/classes/class_audioeffectlowpassfilter.html).
