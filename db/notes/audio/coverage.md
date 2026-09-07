# What musiccheck actually asserts, and what nothing asserts

*What this answers: for any audio change, which harness will catch a mistake
and which will not.*

`tools/musiccheck.mjs` (1533 lines) is the **only** harness that runs the
arrangement. `smoke.mjs` deliberately runs with WebAudio *absent* — that is its
job, proving every audio path is guarded — so without musiccheck not one note
would ever be scheduled in CI, and PROG, the hooks, the basslines and the kit
leans could be reordered, truncated or thrown from with all other checks green.

## How it works

- `/* @lane fast */` — runs in `npm run test:fast`.
- It extracts the canonical runtime through `tools/lib/game-source.mjs`, then
  **stubs WebAudio inside a `vm` context** rather than removing it. Every
  oscillator start, buffer start, frequency write and gain write is recorded
  into `LOG = {osc, buf, tune, pad, errors}`.
- The bed pad's eight oscillators are flagged `__pad`, so the *progression* is
  observable: they start once at page load and are retuned per bar with
  `setTargetAtTime`, which a start-only log cannot see at all.
- `padRoots(pad)` reads `LOG.pad[k*8]` as the root of bar `k` — so the **heard
  chord sequence** is checkable, not just the pitch set. That matters: L2's
  chorus is the verse's own chords walked the other way, and a set comparison
  cannot see order.
- Randomness is injected at the sandbox boundary via `seededMath`; the seed is
  printed by `seedLine('musiccheck')` **before any assertion can exit**. It
  previously imported `seedLine` and never called it, so CI's per-run seed never
  reached the log and every failure was irreproducible.
- Level count comes from `PROG.length`, not from a literal in the harness.

## What it asserts

| Section | Claim |
|---|---|
| the SFX scale is in the same key as the band | for each level, `PENT*key` is the minor pentatonic of that level's tonic |
| the verse | at heat 0, each level voices its own `PROG` row and nothing outside it, forever — the chorus never engages free |
| the chorus | at heat 0.9 the song lifts, **at a four-bar seam and only there**, and walks `PROGB` through `CHOFF`; the `SEVB` color tone sounds ≥3 times |
| no crossing | no level reads another level's progression row |
| the settle | after cooling, the walk returns to the verse at the first seam **past `CHOR_HOLD`**, and the exit happens at step 0 |
| the star dive | the finale latch reverts the section and re-retunes the oscillators, its first bar opens on the verse chord, its latch bar is not counted as a chorus bar, and the chorus cannot re-enter during the dive |
| `chorus_bars` | holds through a black hole and through a payoff (landing bar included) |
| the chorus lean | at level 4's sky floor, no slot carries a doubled snare body |
| every road in | afterglow, groove chain, overdrive and hypernova each lift the song alone; heat 0.5 does not |
| the freeze | the section cannot change while a drop is armed/rising, inside a payoff, or inside a black hole |
| the lift is measured | L2's chorus bass drives (low-saw count per bar), the chorus pump inhales deeper, the chorus opens the pad, the chorus arp follows `ARPBL` and never `ARPL`, and a tight tap pays exactly +8 more |
| the chain | 600 mashed taps never reach ×8; a consistent 40 ms-late device reaches ×8 in ~10 on-beat taps; odd-sixteenth taps hold a ×5 chain without climbing or slipping |
| naming | the chorus transition issues no instruction; `chorusN`/`chorusBars` count |
| distinct songs | all verse shapes distinct, all chorus walks distinct, no chorus walk equals its own verse, all six hooks distinct, all six hooks share **one** rhythmic signature, every hook degree inside `PENT`, every level has a complete valid `ANSWERL` phrase |
| level 4 | its octave bass alternates root/octave; its sub drone is a **tonic pedal**, never chord-following; its kit fires |
| voice leading | no pad voice glides more than 12 semitones, in either table, across both seams |
| both tables hold the law | chord 0 is the i chord, voice 1 is the root's octave, every pitch is on the semitone grid and inside the natural minor, `CHOFF` is a valid row index, every `SEVB` is the stacked third above the chord's fifth |
| the arps | every degree in `ARPL` and `ARPBL` is within 0-4 (under the player's floor), and each level's chorus arp differs from its verse arp |
| tuned percussion | the snare body is exactly tonic + 10 semitones on every level, and level 1's is still 196 Hz |
| the drop | every pitch in `fireDrop` is diatonic to its level's key and on the semitone grid; level 1's drop is unchanged to within a fraction of a cent |
| the payoff | runs on all six levels without throwing, hook intact |
| black hole | schedules voices; every voice is an interval over the tonic; at least one voice above 400 Hz; the pad is silenced; an earned drop is banked, not destroyed; the three acts pulse 1/2/4 times, charge adds harmony, pitches stay above 40 Hz and in key |
| the star run | `STARRUN` is a 16-step bar entirely above the band's degree-4 ceiling; all its degrees sound on every level; the driving bass appears under it; a black hole outranks it; the star opens the band |
| the earned band gain | contains the accompaniment and excludes the player and cue buses; rest / earned / peak / recovery keep contrast; time slip darkens timbre; **magnet does not change the music mix**; a banked hypernova or spotlight does not change the black-hole mix |
| the retired recorder | never captures or replays a movement phrase |
| temporary colours | mirror and scorch add six sparse voices across two bars then leave; the star takes priority |
| calm / build / release | at the same difficulty, engagement more than 1.5× the scheduled-event count, release returns it exactly, and the chord walk is bit-identical across all three |
| the release | plays without input on every level and bar; the movement instrument is identical in ordinary play, a payoff and a fill; death clears all phrase state |
| impacts | nova / hyper / orbit each use 4-5 pitched voices and ≤1 noise source, stay in key above the 40 Hz floor, and are **silent while muted or paused** |

## What nothing asserts

1. **`G.lapStreak` as a road into the chorus.** The per-term roads loop covers
   four of six terms; `lapStreak` and `PLAY.heat` are handled separately, and
   `lapStreak` not at all. It is also an uncovered term in the `driving` gate
   and in `A.band`'s `earned` expression. See `db/notes/audio/retired.md` §6.
2. **`MASTER` and actual loudness.** `docs/design/audio.md` is explicit: the
   gain targets and arrangement changes are checked as *control values, routing
   and scheduled events*, not as measured loudness. The historical dBFS figures
   in that document describe builds in which they were taken. Nothing in CI
   measures a peak or an RMS.
3. **The dub delay, the reverb and the soft clipper.** `buildBus` is exercised
   (the harness fails if the bus does not build) but no assertion inspects the
   delay time against the tempo, the feedback tone, the impulse length, or the
   clip curve. Changing `dly.delayTime` off the dotted eighth would pass.
4. **`bedTick`'s cutoff expression.** The chorus's +200 Hz is measured, and the
   time-slip darkening is measured, but the other eight terms (`k*k`, heat,
   `gv`, ring lift, armed wait, overdrive, hypernova, afterglow, finale) are not.
5. **The layer ladder thresholds.** `LAYER_AT` is not read by any assertion;
   the harness runs at `G.score = 5000` so all four layers are always open. A
   changed threshold, a wrong `LAYER_NAME` index, or a missing announcement
   would pass.
6. **The star-voice ladder (`T_VOICE`).** Neither `T_VOICE` nor `T_SKY` appears
   anywhere under `tools/`. No assertion drives a tier crossing and listens for
   the right instrument, or for the once-per-voice announcement. Worse, nothing
   checks that the three `TIERS.findIndex(...)` calls resolve at all: a renamed
   tier row yields `-1`, and `G.tier >= -1` is always true, so the electric
   guitar would fire from the first tier. `check.mjs`'s ledger-drift guard
   (`tools/check.mjs:318-330`) compares `TIERS` names against `MECHANICS.md`,
   so it catches a rename only when the two drift apart — a rename applied to
   both would break `T_VOICE` silently. The source comment at
   `runtime.js:4713-4722` claims a renamed row "fails loudly in check.mjs";
   that is true of the ledger, not of `T_VOICE`.
7. **The drum break and overdrive.** `breakStep` has no assertion of its own;
   overdrive appears only as a road into the chorus.
8. **`gridNear` / `cueTone` slot discipline.** The one-note-per-sixteenth dedupe
   and the taken-slot cascade — both of which have shipped broken — are not
   directly asserted. The mash test exercises them indirectly.
9. **Lifecycle.** Mute is asserted only for `soundImpact`. Nothing drives
   `runtimeVisibilityChanged`, `pauseAudio` or the `AC.state==='interrupted'`
   recovery.

## Where the seed matters

The harness's own comment is the rule: *reproduce the reported seed rather than
rerunning blindly.* `seedLine('musiccheck')` prints before the first assertion.
