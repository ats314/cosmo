# The graveyard

*What this answers: which approaches Cosmo has already tried and abandoned, why
each one went, and what (if anything) now stops it coming back.*

This repository deliberately keeps its rejected attempts, because a rejected
attempt is exactly what a fresh session re-proposes. Every entry below is a
thing that was built, shipped or measured, and then removed. Read this before
proposing anything that sounds obviously good.

## Mechanics removed outright

**MAGNETAR** — an orb that pulled embers between rings. Removed on the owner's
call, verbatim: *"Magnetar just broke the screen again. Remove that mechanic
entirely. You can't fix it."* The bug is the interesting part. Every object in
the arena sits at `radiusOf(ring)`; the magnetar handed each ember a *free*
radius in `s.pr` so it could curve inward. Several passes draw an ember and only
some learned about `s.pr`, so glows stayed parked on the origin ring — sixteen
detached glows, up to 89px apart on a 390px screen, on the game's most
spectacular move. Two playtesters reported it independently. It was fixed with a
`starR()` accessor plus a build guard, **and it came back anyway**, because the
guard only inspected loops it could recognise as star loops and the `WIDE PULL`
upgrade put a free radius on *orbs*. The removal therefore deletes the category
rather than the bug: `tools/check.mjs` now fails the build if an ember or orb is
given a `.pr` at all, and if `starR()` reappears without its guard. `WIDE PULL`
went with it. Its spawn share was redistributed **proportionally**, which is the
standing rule for removals — removal changes what can appear, never how often
the survivors appear relative to each other.

**THE BASS BOMB** — owner's call after a seven-orb review. Its whole named
identity ("drops the low end") lived in the audio channel, and its visual tell
rode `G.beat`, which only moves when the audio scheduler feeds it — so for a
muted player the sprite sat still and the pickup was a cyan flash. What remained
with sound off was strictly a weaker nova: the same `novaConvert` pipeline over
a third of the board, no invulnerability, same odds. Its clear region (a ±60°
wedge) was never drawn, so `LONG FUSE` widened an invisible number. `LONG FUSE`
went with it.

**SPOTLIGHT → MAGNET.** The owner found the stage metaphor confusing and the
reward uninteresting. Before that it had already been through a repair pass: an
audit found its active state changed *zero arena pixels* for nine to fourteen
seconds — the entire inventory was a mix move (instrument ×1.5, pad to 0.8,
about −1.9dB on one layer) plus a chip that only drew on tall viewports, and its
one universal effect (stars pay double) printed the *undoubled* number in its
popup. Worse, under the *audio is optional* rule it paid literally zero:
`judgeTiming` returns early with no `AudioContext`, so no tap was ever judged
tight. The internal keys `spot`, `spotPlaced` and `stagelight` are still the
Magnet's, deliberately, so existing saves keep working.

**METEOR SHOWER** — cut after playtest; the board is calmer without star rain.

**CHILL (the second difficulty mode)** — retired on the owner's call: one mode
until the game is perfected, then a difficulty conversation from a settled
baseline rather than alongside one. **The mechanism is deliberately not
retired.** `MODES` stays at a single row and that row is the identity element
(every knob 1, 0 for the additive shield), so every expression the knobs appear
in reduces to exactly what shipped. `check.mjs` still fails the build if skill
stops being the identity, if a knob is never read, or if a future second row
grows a knob skill lacks; `smoke.mjs` injects a synthetic mode with every knob
off neutral and measures every curve through the real functions, so a table
wired to nothing cannot pass. The rule the table encodes — *a second difficulty
is a derivative, never a second implementation* — was arrived at rather than
obvious, and deleting the table would delete the rule.

**Tap-to-play melody, drum and echo tasks; the loop recorder.** The player's
inputs are never temporarily remapped. Tap always turns, swipe always changes
ring. Authored answering melodies, drum fills and chorus changes now happen
automatically on all six worlds, with or without input. `endSection()` still
drains the retired recorder's queues (`LOOPQ`, `G.loopFx`) so that state cannot
restart. `docs/design/teaching.md` still contains a section describing the loop
recorder's cyan dot as a live feature; that section is history, not behaviour.

**The timed drop-landing challenge** — no landing countdown, no perfect-tap
bonus. Starfall replaced it: three star-fed orbits (two with EARLY STARFALL),
released automatically, three waves over ~9.23 s, no timing exam.

**The golden lap** and **the standing band-meter dot row** are both retired; the
finale (star dive) is the scheduled special moment now, and score, level
progress, shields and active powers own the HUD.

## Approaches measured and thrown away

**Two delay taps for the reverb.** Tried first, read as slapback rather than
space — above the ~50 ms fusion threshold you hear two echoes, not a room. A
convolution reverb with a noise-and-exponential-decay impulse replaced it.

**A fourth ring squeezed inside the shipped three.** Measured and rejected: at
f = 0.33 (55 px from centre on a 390 px phone) `hitTol` makes one shard block
35.7° of the orbit. Re-spacing all four across the same annulus
(`RAD_BH = [1.0, 0.80, 0.62, 0.45]`) puts the innermost at 75 px where a shard
blocks 26.2°, against the shipped inner ring's 21.6° — a step, not a cliff.

**A mip cascade for the bloom halo.** Built first and measured before being
thrown away. It fails twice: a box downsample preserves the peak of anything
larger than a buffer pixel, so a solid blob keeps full brightness at every level
and the passes just sum (core came out 61% hotter while the halo barely moved);
and bilinear is a separable tent, so a tiny buffer blown up 40× spreads into a
cross rather than a disc, with a footprint that depends on where the object sits
on the coarse grid — sliding one ember across a single coarse pixel swung its
halo 80%. Everything in this game is in orbit and permanently crossing that
grid. Drawn discs replaced it; a separable gaussian later replaced those.

**Reading the frame back for bloom.** The textbook route measures ~16 ms here
because pulling 1.3M pixels back stalls the pipeline. Bright objects are
re-drawn as crude blobs into a quarter-size buffer instead: ~0.3 ms.

**A form clock that lifted the chorus on its own after sixteen bars.**
`musiccheck.mjs` rejected it in one line — *"the chorus engaged at heat 0 — the
lift is free"* — and it was right. A chorus nobody earns is wallpaper. What
shipped instead keeps entry earned and changes which earning counts
(`G.lapStreak` joined the hot set) and how long it lasts (`CHOR_HOLD = 12`
bars).

**Varying the payoff hook's rhythm per level.** The first cut of HEAT DEATH's
hook tried to say "running down" by taking notes out of the shared 3+3+2 accent
grammar. `musiccheck` rejected it: six melodies over one rhythm is a game with a
tune, six rhythms is six unrelated pieces. The energy leaves through *pitch*
instead.

**Rationing the drop with a cooldown.** Measured over a five-minute run, twenty
drops were earned and fifteen were discarded by the cooldown — a timer wearing
an achievement's clothes. Drops are banked now; the cooldown only prevents two
sections overlapping. Separately, `PAYREST` was 20 s, which put the second drop
38.5 s after the first, beyond most runs; it is 0.

**Climbing the timing chain on any sixteenth-tight hit.** At ±32 ms against a
144 ms grid a random tapper lands ~44% of taps; simulated mashing reached ×8 in
a quarter of 300-tap trials, and a playtester said *"feels like you can just tap
randomly and get chains."* The chain climbs on the **quarter** now.

**An always-on 0.18 EMA for the timing bias.** Fast enough to *track* a sloppy
masher's wandering cadence — a simulated ~7 Hz renewal tapper was chased by his
own bias to ×8 in 458 of 500 trials. Twelve gated fast-calibration samples then
a 3 ms-per-tap slew inside ±120 ms replaced it; slew-limited on the quarter grid
that number is 0.

**The GPU degrade ladder.** `GL_SCALE` used to climb and fall, the ceiling
latched down on the first slow stretch, and the sky could be switched off
mid-run for the baked 2D backdrop. It was tested carefully and in the wrong
direction. The field report it produced — *"looks good for the opening and then
5 seconds in, it changes to the old shit"* — was the mechanism working as
designed. Deleted on the owner's instruction: *"a struggling device should
struggle"*, target iPhone 12 and up. `GL_SCALE` is a constant 1.0 and
`fxcheck.mjs` now drives ten seconds at 25 fps and **fails if anything moves**,
plus fails on the reappearance of `glWatch` or `GL.scale`/`GL.cap`.
`docs/engine/implementation.md` still documents the ladder as current; that
section is history.

**Nine full-field white flash outlets and a separate death frame.** See
`docs/design/effects-audit.md`. `flashHit(v)` fed a white rectangle across the
whole viewport with a 0.45 s gate that only applied when `v < 0.5`, so the
biggest requests bypassed it; there were nine call sites despite the old comment
claiming seven. Death had its own frame reaching 92% opacity that never passed
through `flashHit` at all. All ten are removed. The replacement is motion and
material response: `materialHue` redistributes existing light rather than
multiplying it, and `scenePulse`/`sceneAccent` give an event a minimum 2.4 s
span with a 0.9 s eased entry and 1.2 s eased exit, suppress a same-kind
restart, and refuse to let a lower priority interrupt a higher one.

**Beat-driven light gain generally.** `BEATQ → G.beat = 1` could fire ~3.47
times a second at payoff density and several render systems read the same
impulse; bloom rose up to 45% and ring-light alpha 30% on it. Removed. The
timestamps still drain and the music still schedules — `musiccheck` asserts
exactly that.

**Opaque Gemini world plates.** Eight authored world backgrounds were integrated
through the art manifest and have since been removed from the manifest and from
`public/art/worlds/`; the originals are archived outside the game as references.
The 24 remaining transparent sprites stay. The procedural worlds are the scene.

## Retired storage keys and names

- `cometloop:level` — retired and deliberately never read; it held an ordinal
  whose meaning changed.
- `cometloop:mode` and the `:chill`-suffixed records — **left on disk on
  purpose.** They cost a few bytes, nothing reads them, and they are somebody's
  record. Honouring `cometloop:mode` would select a mode that no longer exists.
- Telemetry `level` — retired rather than redefined, because `run_ended` sent it
  holding `tier + 1` while `level_cleared` sent 1–3. Redefining it would have
  silently changed what every historical row means.
- `ECHO` is a **banned string**: `check.mjs` fails the build on it, because an
  orb by that name was cut and its teaching data outlived it.
- Tier `STORM` was renamed `THE EYE` because `LV[2].name` is `THE STORM`;
  `BLINKERS`/`FLICKER PAIRS` are now `SHUTTERS`/`SHUTTER PAIRS`.
