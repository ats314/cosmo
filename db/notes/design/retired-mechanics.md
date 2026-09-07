# The graveyard

**What this answers:** which mechanics Cosmo has tried and abandoned, why each
one went, and what evidence would have to change before proposing it again.

Every entry here exists because a later session would otherwise re-propose it.
The repository keeps the rejected version deliberately (`docs/README.md`: "it
keeps the abandoned attempts, not just the conclusions"). Read this before
suggesting any of them.

---

## MAGNETAR — removed by the owner, not fixed a third time

Owner, on the shipped build, verbatim: *"Magnetar just broke the screen again.
Remove that mechanic entirely. You can't fix it."*

The mechanic pulled embers between rings. Every object in the arena sits at
`radiusOf(ring)`; the magnetar was the one exception, handing each ember a free
radius in `s.pr` so it could curve inward instead of teleporting. Several passes
draw an ember and only some were taught about `s.pr`, so each ember's glow stayed
parked on the ring it started from — **sixteen detached glows at once, up to 89px
apart on a 390px-wide screen**, on the game's most spectacular move. Two
playtesters reported it independently: *"every time I pick up one of the magnet
things this happens to my screen."*

It was fixed twice. The second fix added a `starR()` accessor plus a build guard,
and the bug came back anyway: the guard only inspected loops it could recognise
as star loops, and `WIDE PULL` — the upgrade that extended the pull to power-up
orbs — put a free radius on objects the guard never looked at.

The removal deletes the *category*, not the bug. `tools/check.mjs` now enforces
the **absence** of a second radius rather than its synchronisation: it fails the
build if an ember or an orb is assigned a `.pr` again, or if `starR()` returns
without its guard (check.mjs:108-141). The match is on an *operator* (`s.pr =`,
`s.pr ===`) so a comment explaining the deletion does not fail the build, and so
`GL.pr` — the WebGL pixel ratio — stays out of it.

`WIDE PULL` went with the mechanic. The magnetar's 0.11 share of the orb spawn
roll was redistributed **proportionally** across the survivors, which is now the
standing rule: removal changes what can appear, never how often the others appear
relative to each other.

**If it comes back:** the conversation is the check.mjs note, and whatever
replaces the guard must cover every draw pass — which the previous one did not.

## THE BASS BOMB — two orbs, one job

Owner's call after a full review of the seven orbs. The orb's entire named
identity ("drops the low end") lived in the audio channel, and its visual tell —
a subwoofer cone slamming on the beat — rode `G.beat`, which only moves when the
audio scheduler feeds it. For a muted player the sprite sat motionless and the
pickup was a cyan flash. What remained with sound off was strictly a *weaker
nova*: the same `novaConvert` pipeline over a third of the board instead of all
of it, no invulnerability, same rotation odds. Its clear region — a ±60° wedge
across every ring — was never drawn, so the `LONG FUSE` upgrade widened an
invisible number.

`LONG FUSE` went with it. Its 0.15 share was redistributed proportionally
(runtime.js:6033-6045).

**The rule this established:** an orb whose whole identity lives in the audio
channel violates *audio is optional, everywhere*.

## SPOTLIGHT → MAGNET — the reward nobody could see

Retired after the owner found the stage metaphor confusing and the reward
uninteresting. The review that preceded the replacement found the spotlight's
active state **changed zero arena pixels** for its whole nine-to-fourteen
seconds: the inventory was an audio mix move (instrument ×1.5, pad to 0.8 — about
−1.9 dB on one layer, at the edge of a phone speaker's JND) plus a text chip that
only drew on tall viewports. Its one universal effect — stars paying double —
printed the *undoubled* number in its popup. Under *audio is optional* it paid
literally zero: `judgeTiming` returns early with no `AudioContext`, so no tap is
ever judged tight, yet the orb was force-placed with no audio condition.

It was given a real visual pass before being replaced entirely. The current
contract is Magnet: stars within 110 scale units on the current or an adjacent
ring curve into the comet over 0.38s.

**The internal keys survive the rename.** `spot`, `spotPlaced` and `stagelight`
(the `LONG MAGNET` upgrade id) are still the identifiers in source and in saved
games — see runtime.js:3177, 4936, 6009-6018. Renaming them would break saves for
no player-visible gain.

## THE LOOP RECORDER — retired, and the docs have not caught up

Every quantised input landed on a rolling two-bar tape; a real phrase became the
active loop and the band played it back harmonised in thirds. The first capture
announced "YOUR BEAT IS IN THE SONG."

It is **gone from the runtime**. `LOOPQ` survives as an inert queue "retained for
lifecycle compatibility; no recorder schedules this queue" (runtime.js:1029-1030);
`LOOP` is "legacy recorder storage … kept inert for saved-run and cleanup paths.
Movement feedback is immediate; no tape is captured or played back"
(runtime.js:2215-2217); `bedTick` clears `LOOPQ` and `G.loopFx` every frame
because "retired recorder state cannot restart" (runtime.js:2770).

The retirement belongs to the wider rule in `direction.md`: *the retired
tap-to-play melody, drum and echo sections must not return as temporary demands
on the player.* A recorder is a temporary input remap by another name.

`docs/design/levels.md` still has a "The loop recorder" section written in the
present tense, `docs/design/teaching.md` still says "The loop recorder is
visible", and `run_ended` still ships `loop_caught: G.loopN`, a counter nothing
increments. Those are documentation debt, not a live feature.

## THE TIMED DROP LANDING — `tryLand()` is an empty function

The beat drop used to end with a timing exam: land a tap inside `LAND_WIN`
(0.29s) or `LAND_PERFECT` (0.12s) to cash the section. The whole challenge is
retired — `function tryLand(){}` carries the comment *"Retired: a reward never
asks for a different tap"* (runtime.js:1339). `LAND_WIN` and `LAND_PERFECT` are
still declared beside it.

Starfall replaced it. `docs/design/audio.md` states the current contract plainly:
"No landing countdown, perfect-tap bonus or temporary music control remains."

The related escalation economy is also retired: `DROP_STEP` and `DROP_STEP_MAX`
are both **0**, and `dropNeed()` returns a flat 3 (2 with `EARLY STARFALL`)
(runtime.js:1325-1326). The long "what a drop costs and why it goes up" comment
above it (runtime.js:1301-1324) describes a curve — 1.0, +0.8 each, capped —
that no longer runs. Treat it as history.

## CHILL — one mode until the game is perfected

The owner's call. The *mechanism* is deliberately not retired: `MODES` stays with
a single `skill` row and that row is still the identity — every knob 1, `shields`
0 (runtime.js:3117-3121). The rule it encodes ("a second difficulty is a
derivative, never a second implementation") was arrived at rather than obvious,
and deleting the table would delete the rule and leave a future mode to
rediscover it as a branch on a flag somewhere in gameplay code.

`check.mjs` still fails the build if the row stops being neutral, if a knob is
declared and never read, or if a future second row grows a knob `skill` lacks
(check.mjs:142-207). `smoke.mjs` goes further and injects a *synthetic* mode with
every knob off neutral, measuring every curve through the real functions — so a
table of multipliers wired to nothing cannot pass.

**No player lost a record.** Every value ever written to `cometloop:best` and
`cometloop:gl` was skill's, because chill's went to `:chill`-suffixed keys
precisely so an easier mode could never redefine the plain key. The `:chill` keys
and `cometloop:mode` are left on disk deliberately; nothing reads them.

## THE MODE CARDS AND THE MENU PICKER

The title screen's two mode cards went with chill. The record line came back
under the title where it lived before there were two records to tell apart, and a
tap anywhere starts a run again — with no selection on the screen there is
nothing a stray tap can cost you, which is the only thing the select-don't-start
rule ever existed to prevent.

The POWERUP TESTING bar **inherited the vacated slot and that was wrong**: it made
a developer sandbox the second thing on the front door. It hangs off the START
pill now, below the key rows.

## THE BAND METER DOT ROW

Retired. Musical growth is heard; the HUD prioritises score, level progress,
shields and active powers (`MECHANICS.md`, "Band meter (retired)").

## THE ADAPTIVE RENDER SCALE / DEGRADE LADDER

`docs/engine/implementation.md` documents a ladder in which `GL_SCALE` starts at
0.60, climbs on gameplay frames only, latches its ceiling down on the first slow
stretch, and sheds the glow before the sky. **None of that is live.** The source
reads `const GL_SCALE=1.0; /* fixed quality; no performance downgrade */`
(runtime.js:9505). The `bloomHalo` fallback (drawn discs when `FX.on` goes false)
is still there — that part survived.

## `cometloop:level` — the key remembered for its failure

The retired record key whose meaning silently changed owner. It is the named
precedent behind two live rules: mode records are suffixed so the plain key never
changes meaning, and telemetry retires an ambiguous property name rather than
redefining it (`level` → `game_level` / `tier`).

## METEOR SHOWER

Cut. The playtest's verdict was that it failed, and the board is calmer without
star rain (`docs/design/levels.md`, "The orbs earn their look").

## ECHO — a banned string

An orb called ECHO was cut and its teaching data outlived it. `check.mjs` fails
the build on `'echo'` or `'meteor'` appearing in `MEET` or `teachSoft`
(check.mjs:67-71). ECHO was also the runner-up name for THE MIRROR and is
unavailable for that reason.
