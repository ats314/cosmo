# Cosmo

A one-thumb arcade game that runs in a single HTML file. No build step, no
dependencies, no assets — open it and play.

**▶ [Play it](https://ats314.github.io/cosmo/)**

> **Proprietary — all rights reserved.** Cosmo is a commercial product, not an
> open-source project. This repository is public for playtesting only. No
> permission is granted to use, copy, modify, host, redistribute, or build
> derivative works from any part of it, and it is excluded from text and data
> mining and from machine-learning training. See [LICENSE](LICENSE).

You are a comet locked to a circular orbit. You cannot steer and you cannot
stop. You get two verbs: reverse your direction, and hop between rings. Gather
embers, dodge shards, and complete orbits.

## Controls

| | Touch | Keyboard |
|---|---|---|
| Reverse | tap anywhere | `Space` / `Enter` |
| Hop outward | swipe away from the centre | `↑` `W` `←` `A` |
| Hop inward | swipe toward the centre | `↓` `S` `→` `D` |
| Land the drop | any move on the downbeat | any move |
| Mute | tap the speaker | `M` |

Every keyboard row is a keyPRESS, not a key being down: `keydown` returns early
on `e.repeat`, so holding a key does nothing after the first frame. Without that
guard the OS auto-repeat rate *was* the input rate — a held `Space` called
`reverse()` around twenty times a second and pinned the comet inside 0.23 rad of
the circle, about thirteen degrees, for an entire run. The pointer path had
always guarded the equivalent ("one gesture at a time: a second finger can't
double-reverse"); the keyboard path never had. `smoke.mjs` now fires a burst of
repeats and fails if the comet stops covering ground.

There is no aimed input anywhere in this game. Landing the drop is any move —
the tap or hop you were making anyway, wherever your thumb is — inside the
window around the downbeat, and the move still does its normal job: if
survival wanted a hop right then, that hop lands the drop.

Swipes are read **radially** — measured against the line from the centre
through the comet — so "away from the middle" always means outward no matter
where on the circle you are. A tap reverses instantly and the sound follows a
beat later, so a swipe that starts like a tap can be rolled back silently.

## How scoring works

The two systems feed each other rather than competing:

- **Embers** are worth a rising combo (up to ×6) while you keep collecting.
- **Orbits** — 360° of travel without reversing — pay out based on how many
  embers you gathered *during* that orbit. A bare orbit is worth almost
  nothing; a full one is worth a lot, and consecutive fed orbits stack a
  streak bonus.

Reversing costs you the current orbit and the streak, but the embers already
gathered stay banked. Gates exist to force reversals, so they must not delete
the score you turned around to protect.

## Difficulty

Difficulty is a clock, not a score. Playing well nudges it forward slightly,
but the nudge is capped, so a good run can never accelerate you into a wall.
The first ~80 seconds advance at 55% rate to give a new player room to find
the controls, the opening speed is a glide rather than a chase, the first
threat arrives alone (the shard cap starts at one), early warning pulses run
almost half a second longer, and spawns open at 2.6s apart instead of 2.1 —
all of it converging on the same late game, none of it touching the ceiling.

### One mode, and the table that survives it

**CHILL is retired for now.** The owner's call: one mode until the game is
perfected, and then a difficulty conversation from a settled baseline rather
than alongside one. What is *not* retired is the mechanism.

`MODES` stays, with a single row, and that row is still the **identity**:
every knob 1, or 0 for the additive shield. So every expression the knobs
appear in — `dl()`, `speedAt()`, `warnTime()`, `shardCap()`, `spawnGap()`, the
shield bank — still reduces to exactly what shipped, and the table still
cannot quietly become the place the real game is tuned.

Keeping it costs one row and buys the thing that was expensive to get right:
the rule that a second difficulty is a **derivative** and never a second
implementation. That rule was arrived at, not obvious, and it is written into
the shape of the table and its guards. Deleting the table would delete the
rule and leave a future second mode to rediscover it — most likely as a branch
on a flag somewhere in the game code, which is exactly what the table exists
to prevent. Bringing chill back is adding a row, not re-deriving a design.

The clock stays the intended main lever, and the reasoning is kept because a
second mode will need it. Everything that presses on the player — speed, shard
cap, arrival rate, warning length, the tier ladder, the finish line — is
already keyed off `dl()`, so slowing that one number eases all six together
*and in the proportions they were tuned in*, which is the only way "easier"
stays recognisably the same game rather than a differently-broken one. The
other knobs are trims on top of it, never a second difficulty curve. And a
mode must never touch the curriculum, the music or the scoring: orbs and
lessons are gated on `G.level` and tiers on `dl`, so any mode meets every
formation in the same order at the same points and merely takes a different
number of seconds to get there.

The guards stay armed. `check.mjs` still fails the build if the row stops
being the neutral element, if any knob is declared and never read, or if a
future second row grows a knob skill lacks. `smoke.mjs` goes further and is
the reason this is more than a comment: it **injects a synthetic mode** with
every knob off neutral and measures every curve through the real functions, at
the same difficulty second, so a table of multipliers wired to nothing cannot
pass. Deleting that test along with chill would have meant discovering the
plumbing was dead on the day someone added a row — the worst possible day.

**No player loses a record.** Every value ever written to `cometloop:best` and
`cometloop:gl` was SKILL's, because chill's went to `:chill`-suffixed keys
precisely so an easier mode could never redefine what the plain key meant (the
failure the retired `cometloop:level` key is remembered for). So the plain
keys mean exactly what they always meant, on every device, with nothing to
migrate. The `:chill` keys are **left on disk deliberately** — they cost a few
bytes, nothing reads them, and they are somebody's record. `cometloop:mode` is
likewise left but no longer read: a device that last played chill has `chill`
sitting under it, and honouring that would select a mode that no longer
exists.

The title screen loses its cards and gets its best line back under the title,
where it lived before there were two records to tell apart. It answers a tap
anywhere again — with no selection on the screen, there is nothing a stray tap
can cost you, which is the only thing the select-don't-start rule existed to
prevent. The lab door stays exactly as it was; it was never a card.

### Where you start

The screen after the title picks the starting level. All four are selectable on any device, including levels never
reached — the screen exists so a level can be reached without playing to it,
which is what makes testing level 4 possible at all. Rows the device has
actually got to are marked *reached*, so picked and earned stay visibly
different things.

This reverses a decision the menu used to enforce, and the reason it is safe
to is narrower than it looks. Every menu tap used to force level 1, because
shared and borrowed phones kept inheriting a device's unlock and friends
thought the game had skipped level 1. That complaint was about a start nobody
*chose*. So the selection is deliberately **not persisted** — it lives in
memory and every page load opens on LEVEL 1 — and a borrowed phone still
begins at LIFT OFF unless the person holding it picks otherwise on a screen
that names all four levels. Saving the pick is what would bring the original
bug back with the picker as its new hiding place.

The cost of that freedom is bounded in exactly one place. `G.startLevel`
records the level a run opened on, and the level record only moves for a run
that began at level 1 — so choosing EVENT HORIZON and dying on the first shard
prints no FURTHEST YET and writes nothing. A run that started at level 1 and
climbed keeps counting, including across the retries that put it on a later
level, because `startLevel` is where the run opened and not where it is now.

### Pause

Players asked for it. A small icon top-left, mirroring mute top-right at the
same size and inset. Small and inset is the whole placement argument: the arena
answers a tap *anywhere* with a reversal, so every pixel given to a pause
control is a pixel where a reversal silently becomes a pause — and in a
reaction game that is a death.

The freeze itself is one early return in `update()`, placed before `G.t+=dt`.
Every deadline in the game is written against that one clock, so stopping it
stops all of them in step: invulnerability, spawn timers, cooldowns, lesson
spacing, the tier ladder, the difficulty clock, and the black hole's own tick.
It is the same argument the difficulty modes make for using `dl()` as their
lever — one number, so nothing drifts out of step with anything else. Paused
seconds also leave the reported run time for free, because run time is measured
on the same clock.

**The board is hidden while paused, and that is a balance decision rather than
a style one.** Shards telegraph for between one and 2.35 seconds. A button that
freezes a warning mid-flight and lets you read the board at leisure is a
difficulty change wearing a convenience label, so the panel is opaque: you
cannot study what is not drawn. Resuming brings the frozen board back for a
three-second count-in — enough to find the comet again — and only then does
time restart. Pause re-arms five seconds later, because without a cooldown
pause–resume–pause is an unlimited supply of three-second frozen looks at a
live board, which is the hidden board's protection reassembled out of its own
escape hatch.

Nothing is done to the audio context. `musicTick` already survives an arbitrary
gap — it notices the schedule falling behind, abandons the section rather than
replaying it compressed, and restarts on the next grid line — which is the path
a backgrounded tab has always taken. Pause does what the visibility handler
does and no more. The one thing it *must* do is take the pad down explicitly:
the pad is eight continuously running oscillators whose gain is written every
frame, so freezing the update loop does not silence it, it freezes it, droning
one chord for as long as the panel is up.

### POWERUP TESTING

Under the two mode cards is a third option, and it is deliberately not a third
mode. Five of the six orbs sit behind a curriculum ladder, and the sixth —
the black hole — is rare on purpose: three `blackhole_entered` events in the
game's entire recorded history, every one of them on level 4. Finding out what
an orb actually feels like meant playing until the game decided to hand you
one. The bar opens a picker of all six; choosing one starts a run where that
orb, and only that orb, arrives every few seconds.

The board it arrives on is quiet and stays quiet. `dl()` — the difficulty
clock every pressure term in the game reads — returns a constant and never
moves, which freezes speed, shard cap, arrival rate, telegraph length, the
tier ladder and the finish line together and in the proportions they were
tuned in. The constant is 40, chosen because it is exactly the clock value
that opens the third ring: the black hole adds a *fourth* orbit on entry and
restores what it found on the way out, so a lab with fewer rings would have
demonstrated that against nothing. Level 1's finish line is 90, so a lab run
is endless and no tier can arrive to interrupt what you came to look at.

*red cannot touch you* is on by default and switchable on the picker. It is
read at the one lethal-contact site, so nothing downstream fires: no shield is
spent, no pip moves, no popup. The shard keeps travelling and passes through
you, which is how you can tell it is on without a line of HUD claiming it.
Switch it off and the lab is the real game with one orb in it — which is the
only way to find out what taking that orb is worth. Because a ghosted run
cannot end by itself, there is a door in the top-left of the arena (and
Escape) back to the picker.

**Nothing a lab session does reaches the device.** No score becomes a best, no
level record moves, the run count does not advance, the struggle streak that
lengthens future openings is not fed, and no first-encounter lesson is spent —
that last one matters more than it sounds, because *taking* a musical orb
normally counts as having been taught it, so one unguarded black hole session
would have permanently retired the black hole's lesson on a device that had
never met one. Nor does hopping in the lab count as having hopped: `hop()`
persists a lifetime flag that gates the once-ever first-hop rehearsal, so a
fresh player who opened the lab and swiped would otherwise have met the real
second ring with the game's tutorial for its hardest gesture already spent. There is no share button on a lab death: the share text has no
room to say any of the above, and a boast the game knows to be false should not
be one tap away. Telemetry is suppressed rather than tagged — a lab run cannot
reach the funnel at all, and one event records that the lab was opened and with
which orb. `smoke.mjs` snapshots `localStorage` across a whole lab session and
fails if one key changes.

## Levels

The run is **four levels**, each with an intro card and its own song. The
first three have finish lines; the fourth does not:

| Level | Name | Introduces | Key | Verse · Chorus | Groove |
|---|---|---|---|---|---|
| 1 | LIFT OFF | the verbs, twins, the orbit economy, shield/slow-mo/nova, the beat drop | A minor | i–♭VI–♭III–♭VII · ♭VI–♭VII–v–i | the original groove |
| 2 | INTO THE RINGS | gates, drifters, blinkers, hypernova | G minor | i–♭VII–♭VI–iv · ♭VI–♭VII–i–i | swung sixteenths, bass off the beat |
| 3 | THE STORM | the two compounds — sliding gates, flicker pairs — plus THE SAUCER and the spotlight, then a finish line | F minor | i–♭III–v–♭VI · i–i–♭III–♭VII | rolling four-on-the-floor |
| 4 | EVENT HORIZON | **no new formations** — the same storm with no exit, speed climbing toward the 4.2 rad/s ceiling, and one black hole guaranteed. Endless. | E♭ minor | i–♭VI–♭VII–i · iv–i–♭III–v, both over a tonic pedal | octave bass, open offbeat hat |

**BLACK HOLE MODE** runs across levels 3 and 4 and is neither a level nor a
power-up: a rare dark orb you may take or decline, and 17 seconds of somewhere
else if you take it. The band stops, a preset piece plays, you stop being an
instrument, everything runs at 0.42×, the reds run 1.5× to 3.5× — and a fourth
orbit opens while all four re-space. See `MECHANICS.md` for the geometry and the
measurements; the short version is that the fourth ring works because the
orbits move, not because the gaps shrank, and because the arena is an ellipse.

**And for most of its life it did almost none of that.** The mode shipped with
thirteen sub-features and a playtester who had run it many times could see one:
"nothing but some purple color." Every one of the thirteen was present in the
source. The arena-scale art was gated on WebGL having *failed*; the shader's
lens inverted the UV field so the gravity well darkened nothing; the sustaining
pad ignored the mode entirely and played the level's own chords straight
through it at full volume; the density divisor was drained by a timer on the
slowed clock, which made the mode *easier* than the level it interrupted; the
gravity pull ran backwards, pushing the comet to the safest orbit, where the
2× star bonus also happened to pay; and the rare roll sat below seven
guaranteed placements, so it first became reachable one second after the median
level-3 run had already ended. `MECHANICS.md` has the clause-by-clause table.
The lesson worth keeping is that none of this was visible from the code: every
feature read correctly at its own site, and each was disabled by something
somewhere else. Only measurement found them.

Level 3 used to be the endless one. Giving it a finish line and handing
"endless" to level 4 keeps *the last level is the exam* true, rather than
making level 3 both the exam and the middle of the game. Neither introduces
anything, so the curriculum rule below is untouched by the extra level.

**The curriculum rule** (this is the load-bearing design decision): every
mechanic is introduced and explained **by the end of level 3**. By the start of
level 4 the player knows how everything works and all of it is in play —
level 4 is the exam, not a syllabus. The four storm shapes used to unlock
at dl 205–340 with no level 4 to hold them: a level whose banner promised
"no new tricks" still owed four brand-new tricks, delivered at the game's
most hostile density. Adding level 4 moved the exam rather than the syllabus,
so teaching now runs to dl 340 — three shapes in level 2 and three in level 3,
each ~35 dl apart, each with its banner and first-encounter lesson, and THE EYE
sits exactly on level 4's floor. Difficulty is untouched — every pressure term
still keys off the same clock — this changes *what* arrives, never *how much*.

This paragraph said "the end of level 2" for as long as level 4 has existed,
while the table sixteen lines above it listed two tiers under level 3 and all
three harnesses tested `dl <= LV[2].end`. Three documents and one code comment
said level 2; the code, the ladder and `check.mjs`/`smoke.mjs`/`curriculum.mjs`
said level 3. The stale half is corrected rather than re-argued — a rule that
disagrees with its own enforcement is worse than no rule, because the next
reader budgets their design against the wrong boundary.
`MECHANICS.md` is the ledger: one row per mechanic, how it works, where it
is introduced, and every channel that explains it. Change one, update both.

Survive to a level's finish line and a card celebrates the clear, names the
next level, and lists the mechanics it will introduce — teaching moved to a
calm screen instead of mid-combat. A genuine first run passes through
level 1's card too (once per device — it was dead data before: the one calm
screen written to pre-teach the verbs never actually rendered), and a death
on level 2 or 3 retries *through that level's card*, so the syllabus for
exactly the mechanics that just killed you is re-read from a calm screen at
the moment it is most relevant. Each level's key drops a whole step
(A → G → F → E♭): going deeper into the game literally deepens the music, with
the same 104bpm grid so the dub delay never falls out of time. The keys
descend but the songs are not transpositions of each other — each level walks
a *different* progression, which is the difference between four keys and four
songs. Every visit
starts at level 1 — the game used to resume a device's highest unlock from
the menu, and playtesters on shared or borrowed phones read that as "the
game skipped level 1," so the resume was cut. Within a run nothing is
lost: death retries the level you died on, and the best score and deepest
level reached are still remembered (`cometloop:best`, `cometloop:gl`) as
records on the death screen. Score carries across a single run's levels;
by level 3 every current mechanic has been introduced.

Playtest round three on levels: **1 and 2 run longer again** (finish lines
now at dl 90 and 215 — about 2:05 for level 1 and a further ~2:40 for
level 2; they sat at 75/190 until the teaching pass needed the room, the
owner's call being "just make the first and second level longer if
needed") so each song has time to land and each introduction gets air;
gates and the storm threats all live in level 2 now, and level 1's back
half belongs to the musical curriculum.

**The arranging pass.** "Too many sounds clashing" had a findable cause:
the octave-down warmth pass had stacked the arp, the riff, the loop
recorder and half the chimes into the same 200-400Hz band, over TWO
basslines (the synth bass plus the score-layer bass playing a different
pattern). The fix is arrangement discipline, not more subtraction:
- **One bass.** The third score layer is a held sub DRONE now (one note a
  bar, pure weight) instead of a second bassline fighting the first.
- **One tenant per band.** The riff REPLACES the arp when it unlocks —
  the arrangement evolves rather than accumulates. The pulse layer moved
  up into its own pluck slot; the loop recorder sings in the player's own
  octave (harmonising with yourself) and steps aside during the solo.
- **Call and response on the downbeat.** The bar-line whaa breathes on
  even bars, the string swell answers on odd ones, and the root's bright
  octave double is deleted — the downbeat is no longer twelve oscillators
  deep.

**Four songs, not one song in four keys.** The four levels are **four
arrangements**: each has its own bassline (L1 walks, L2 pushes off the beat,
L3 rolls relentless eighths, L4 jumps the octave), its own riff, its own
afterglow solo, its own payoff hook, and — past level 1, which is the
reference the others are heard against — its own kit identity (L2 swings with
a soft clap lean, L3 drives an offbeat hat everywhere, L4 rides an open hat
and doubles the floor).

For a long time that claim had a hole in the middle of it. Every level walked
the identical i–♭VI–♭III–♭VII and differed only by transposition, so the chord
loop — the one thing a player hears continuously for fifteen minutes — was the
one part of the song that never actually changed. Each level owns a different
minor-mode cadence now: level 2 walks the descending tetrachord down past its
own tonic and hands the loop back unresolved, level 3's roots climb F–A♭–C–D♭
so its bass is a line rather than a set of leaps, and level 4 pedals home every
four bars, which is what the level with no finish line should sound like.

The constraint that picks them is not taste. The SFX pentatonic is scaled into
each level's key and every sound in the game speaks through it, so a chord from
outside the natural minor puts the whole effects layer out of tune with the
band — which is why none of the four progressions uses the borrowed major
dominant that would be the obvious way to make a minor loop sound more
finished. All four rows were checked numerically rather than by ear: exact
octaves, perfect fifths, every chord diatonic, and no semitone rub against the
pentatonic that the shipped progressions did not already carry.

**The song has a chorus now, and playing well is how you get there.** A verse
alone is not a song: the arrangement always thickened and thinned with the run
(vertical layering, the axis every adaptive score has), but what the harmony
was *doing* never changed. Each level now owns a second diatonic progression,
and the record moves between the two with the play — hot play (a groove chain,
an earned state, real heat) lifts it into the chorus at the next four-bar
seam; cooling off hands it back to the verse; every beat-drop payoff resolves
into the chorus through its afterglow, so the drop the game already guarantees
is also the guaranteed road in. That last clause matters: a player who never
chains a beat still hears every level's chorus, the same worst-case promise
the drop itself makes. Riding the chorus pays on-beat taps like the other
standing states, the HUD names it, and one line names the mechanic the first
time a run earns it.

The chorus shapes are studied from the records this band imitates — the
owner's three references, cross-checked across transcriptions: **Nightcall**
(A minor, pure Aeolian — its chorus never modulates; it starts the loop on ♭VI
with the tonic withheld and floats), **Odd Look** (E♭ minor at ~105 BPM, this
band's own tempo — one iv–i–♭III–V loop for the whole song, the lift purely
textural), and **Protovision** (E♭ minor — one asymmetric i–i–♭III–V cell,
two bars of tonic then a ramp). So level 1's chorus walks the shape
Nightcall's does, in the key the level shares with it; level 4 rides Odd
Look's loop shape in the key they share, launched on the subdominant, endless
as the level; level 3 runs Protovision's ramp; and level 2 — whose verse walks the descending tetrachord — gets the
Aeolian cadence, the same chords climbing the other way, dovetailing back
into its verse with a zero-glide seam. The one thing the records do that this
game cannot copy is their single borrowed chord: Odd Look's and Protovision's
major V carries a raised seventh that would put the entire SFX layer a
semitone out, so the diatonic v stands in — which is what Nightcall, 100%
diatonic, does all along.

Two implementation facts are load-bearing. A chorus *starts* off-tonic but
its row slot 0 is still the i chord — `CH[0][0]` is read as "the level's
tonic" by roughly twenty-five call sites, so the walk order (`CHOFF`) is a
separate fact from the chord inventory, and the rotation is what lets
Nightcall's tonic-withholding trick coexist with every tonic reader in the
file. And the chorus carries the genre's voicing split — the stacked third decides:
m7 on the minor chords, maj7 on ♭III and ♭VI, the dominant-shaped seventh on
♭VII, one sustained color tone a bar (`SEVB`) — while
the arp and every riff stay plain pentatonic, which is also how the reference
records keep their extensions from muddying the ostinato. `musiccheck.mjs`
holds all of it: cold play voices the verse row exactly, hot play must lift
at a legal seam and hold the chorus *walk* (order, not pitch sets — the L2
chorus reuses the verse's chords in a different order, invisible to a set
comparison), both rows diatonic, both anchored on i, every seventh a stacked
third, every glide including the section seams inside an octave.

**Level 4 had been getting the leftovers.** Its bassline branch fell through to
level 3's, it had no kit block at all, and the endless level — the one good
players spend most of a session inside — was the only one whose bottom end and
percussion were second-hand. It has an octave-jumping bass, an open offbeat
hat, a doubled floor, and a sub drone pinned to the tonic under its pedal
progression, so the bottom never moves at all.

**Three things were in the wrong key on three levels out of four.** All
pre-existing, all found by auditing every absolute pitch in the audio path
once the progressions started to differ:

- The **beat drop's impact** — its sub boom and the braam swelling out of it —
  was hardcoded to A and E. The pentatonic stabs beside it transposed
  correctly, which is exactly what hid it: half of the loudest event in the
  game followed the key and half of it did not. On THE STORM that fixed A♮ rang
  a semitone against F minor's own A♭, at the moment the arrangement is most
  exposed.
- The **snare body** was a fixed 196Hz. That is G3, the ♭VII in A minor, in key
  there because A minor is the key it was chosen in — and not in E♭ minor at
  all, where it sits a semitone above the tonic chord's third.
- The **drum break's tom fill** was C4–A3–F3, a descending ♭III–i–♭VI in A
  minor and nothing in particular anywhere else.

All three are written as intervals over the level's tonic now. Level 1 is
unchanged — its snare is still 196Hz to the cycle and its drop is within
0.15 cents of what shipped, the remaining drift being the old literals' own
rounding.

**The loop recorder.** The owner's idea, near-verbatim: "if I'm stuck
between two reds I just intuitively click back and forth along the beat —
I ad-lib beats. What if my ad-libbed beats could be remembered and
recorded into the song with harmony?" So they are. Every quantised input
lands on a rolling two-bar tape; at each two-bar line, if the window held
a real phrase (three to ten taps with the groove alive), it becomes the
active loop and the band plays it back — harmonised in thirds, an octave
below the player, through the dub delay — for eight bars or until a new
phrase replaces it. The first capture of a run announces itself: "YOUR
BEAT IS IN THE SONG." Dodging in rhythm is composing.

**The orbs earn their look.** The spotlight is a stage light, four rays
sweeping round a bright bulb. (Meteor Shower was cut — the playtest's
verdict was that it failed, and the board is calmer without star rain.)

**The braam is the signature voice.** The deep "whaaa" from the drop hit —
sub boom under a swelling fifth-stack — now speaks at every big moment:
level starts and completions, overdrive, novas, new
layers, and (once the run warms up) breathing out of every bar-line bass
note. The game's biggest sound is no longer reserved for one event.

**The mid-game has manners.** A playtest audit found the 2:00-3:10 window
— exactly where every run was dying — contained BOTH new threat archetypes
with tripled spawn featuring and slow-motion lessons, two score-layer
banners, a NEW SOUND, a golden lap, a drop section every ~30s, drum breaks,
overdrives, three shard-cap steps and a milestone ripple every 2-3 seconds,
while all announcements fought over one text slot that overwrote without
queueing and seven systems strobed the screen flash. A survival-bot could
dodge that board indefinitely; humans died because they could not READ it.
So the mid-game now keeps the early game's discipline, one thing at a time:

- **One voice** — announcements go through a priority queue with a breath
  between lines; a message that expires unshown is dropped, never shouted
  late. Only the section's bar-timed YOUR TURN / LISTEN bypass it.
- **A spread calendar** — the score layers moved down to 600-3,600 (rewards
  people actually reach), drifters/blinkers/sliding gates/flicker pairs
  each moved to their own moment, and the shard-cap steps left the death
  window.
- **A quieter routine** — milestone chime every 250 not 50, orbit popups
  only when they are news once laps take under 2.4s, the popup cloud capped
  at six, and one rate-limited flash writer (perfect landings and novas
  always pass).
- **Lessons wait for calm** — a first-encounter never fires its slow-motion
  inside danger or within 9s of another lesson; the next encounter simply
  re-offers it. The musical orbs teach without slow-motion at all, and a
  new threat type's first specimens telegraph 1.6x longer.
- **You meet ONE drifter before you meet three** — featured tripling now
  waits ~18s after each unlock.

Mechanics unlock on a schedule, each announced with a banner — and the whole
ladder fits inside levels 1–3, with level 4 as the exam (the curriculum rule).
`dl` is difficulty-seconds: wall time plus the nudge good play earns, so a
strong run reaches each rung sooner than a struggling one. Each banner's `sub`
is word-for-word the lesson that fires when the shape first spawns; they are
one sentence, and `smoke.mjs` fails the build if they drift apart:

| dl | Level | Unlock and its one sentence |
|---|---|---|
| 12 | 1 | second ring — *swipe up or down to change ring* |
| 18 | 1 | twin shards — *two at once — swipe to another ring* |
| 40 | 1 | third ring — *inside is tighter — the music runs hotter* |
| 100 | 2 | gates — *every ring is blocked — tap to turn around* |
| 128 | 2 | drifters — *it slides — the gap moves with it* |
| 165 | 2 | blinkers — *harmless while dim — cross it then* |
| 240 | 3 | sliding gates — *the wall slides — turn around early* |
| 275 | 3 | the saucer — *turn back and it blocks your ring — swipe off* |
| 310 | 3 | flicker pairs — *only one is solid — cross the dim one* |
| 340 | 4 | the eye — *no new tricks — just more of everything* |

Because the ladder is keyed to `dl` rather than the clock, a player earning no
nudge at all sees the slowest the schedule ever runs; scoring well pulls
everything forward by up to 40 seconds. Every gap clears the 9-second lesson
spacing and a banner's full display, so each shape still gets its solo
introduction. A crossing
never fires during a finale — the exam must not be announced over the
graduation ceremony — and the level-3 start owns the STORM crossing
silently, because its intro card is the announcement.

**The new shape insists until its lesson lands.** The curriculum promise
was a dice roll at first: a sliding gate shares the one-wall-at-a-time slot
with plain gates, its placement can fail on a dense board, and its lesson
defers for calm — a simulated playthrough reached level 3 with the
sliding-gate lesson never shown. Now, while any unlocked shape's lesson has
not landed, that shape (lowest first) IS the next spawn — banner first,
then specimen after specimen until `firstMeet` finds its calm beat. The
musical orbs get the same guarantee their way: an unseen orb's lesson keeps
knocking while the orb is on the board, an unseen orb that expires
unlessoned is re-placed, and picking one up counts as the introduction —
using it beats any sentence about it. Veterans have seen everything, so
none of this runs for them; density is untouched — same spawn, different
shape. `tools/curriculum.mjs` plays the whole run headlessly and fails the
build if level 3 ever opens with anything left untaught.

**The exam waits for the lesson.** Twins are the tier that makes the hop
compulsory, and they used to arrive on a pure clock whether or not the player
had ever landed one — the direct mechanism of the sub-two-minute first
sessions. The ladder now holds at SECOND RING until the first hop lands, then
resumes exactly where the clock says; after 30 difficulty-seconds the exam
arrives anyway, so the hold cannot be farmed. Speed, shard cap and spawn rate
all still run on the clock untouched — the gate changes *what* arrives, never
*how much* — and a veteran hops in the opening seconds and never notices it
exists. When a long hold releases, the banked tiers announce themselves one
banner at a time instead of piling up and skipping straight to the last.

The late tiers are **compounds**, not new objects. `gate`, `blink` and drift
(`va`) are independent flags on the same shard, and both update and draw
already handle them in any combination — so a sliding gate and an alternating
pair cost a spawn branch each and nothing else. A sliding gate gives every
segment the same drift, or the rung would shear apart from the bar, which is
drawn from ring 0's angle. A flicker pair is offset half a cycle, so there is
always exactly one gap and never two.

Speed keeps climbing after the unlocks run out. The exponential is within
0.2 of its ceiling by ~4 minutes, so past that a slow linear term takes over
(capped at 4.2 rad/s). Without it a long run flattens into a plateau that only
ever ends from a lapse in attention rather than from pressure.

## The two ladders

There are two ordinals inside this game and only one of them is a level.

`TIERS` / `tierIndex()` / `G.tier` is the **unlock ladder**: ten rungs naming
what has been introduced so far — SECOND RING, TWIN SHARDS, GATES, … STORM.
`LV` / `G.level` is the **level**, the 1–3 structure above with the cards and
the songs. The unlock ladder is a mechanism; the level is what the player is
told.

A tester made the case for telling them an ordinal at all:

> I just think clearing the board using level tiers might be more rewarding as
> a sense of accomplishment than just trying to get a higher score each time.
> For whatever reason, reaching level "XYZ" seems more memorable and rewarding
> than just a highest score. Levels are more distinct, you know?

That is right, and the reason is that a score is a cardinal you cannot repeat
from memory while a level is an ordinal you can say out loud, compare against
someone else, and come back for. So the level appears under the score in play,
leads the death screen in ember gold with the current unlock rung named
beneath it, leads the share text, and persists as `cometloop:gl` — "BEST ·
LEVEL 2 · 4300" on the death screen, and **FURTHEST YET** in place of NEW BEST
when a run reaches deeper than the device ever has.

**Both ladders used to call themselves "level" in the same eyeline.** The
death screen printed `LEVEL 2` directly under a ten-pip bar filled to eight,
and FURTHEST YET was decided on the tier ladder — the scale the screen never
names — so a device whose record was level 3 could die on level 2 at a deeper
tier and be congratulated for getting further. The pip bar had stopped saying
anything anyway: the curriculum pass folded every tier into levels 1–2, so it
saturated the moment level 3 opened and stayed full for the rest of an endless
level. Everything the player reads is the level now — three pips, one per
level, filled to the one this run reached — and the record moves at death
beside the high score, so the badge fires exactly once and a retry of the same
level stays quiet. The unlock ladder keeps `tier` and `tierLabel()` and never
calls itself a level again, telemetry included. `smoke.mjs` asserts all of it.

The empty pips are the point as much as the filled ones: a player who dies on
level 1 can see that two more exist, which is the one thing a bare score can
never tell them.

None of this touches the simulation. It changes what the game *says* about
itself, not what it does.

**The banner is gold now, not red.** A tier announcement drew in `COL.shard` —
the shard fill, the danger outline, and the exact colour `GAME OVER` prints
in. The only moment the game announced that you had got somewhere was painted
in its failure colour.

**And the newest formation stays featured across ring unlocks.** `pickType()`
triples the weight of the newest shape, keyed off the top tier — but three of
the ten tiers announce a ring or a storm rather than a shape, so at those the
tripling silently did nothing. Crossing THIRD RING dropped gates from 60% of
the spawn pool to 33%: a banner celebrating a new ring that also made the
board easier. STORM, whose own banner promises "just more of everything",
flattened flicker pairs from 33% to 14%. It now walks back to the last tier
that carries a shape.

## Learning it

A run opens on a single ring, where the only move is a tap to reverse. The
second ring does not arrive for ~20 seconds, so until it does, a prompt to
swipe would be asking for the one gesture the game will not answer — the
hints skip it until there is somewhere to hop to.

**The menu demonstrates both verbs.** The title-screen comet was already
running the real simulation behind the key; now it plays a twelve-second
scripted loop — a harmless shard fades in ahead of it, it reverses with its
real sparks and the tap glyph beside it, then it hops a ring and back at a
third speed under the swipe glyph. The two verbs are watched being answered
by the actual object before the screen is ever touched.

**The hop gets a rehearsal.** When the second ring lands for someone who has
never once hopped — a persisted flag, so it interrupts nobody else, ever —
time dilates to a third, spawns hold, and the radial guide that normally
appears mid-drag draws proactively at the comet, rotating with it: the one
place a rotating gesture can actually be shown. The first landed hop ends it
instantly, a failed swipe extends it instead of just thudding, and an 8-second
cap means it can never stall a run.

**The hint ladder cannot deadlock any more.** The swipe prompt used to hold
the hint slot for as long as the player had not hopped — which for the player
drowning at 30 seconds was the entire run, so the red lesson and the shield
lesson never showed for exactly the person who needed them. The orb-naming
hints now outrank it while an orb is on the board, and after ten unanswered
seconds it alternates with the survival lessons on a slow cycle.

**The twin lesson took three attempts, and the first two failed for the same
reason.** Owner, on the shipped build: *"it makes no sense and I'm not getting
the feeling you actually understand why."* Correct on both counts.

I had diagnosed the two failures as separate bugs. The first invoked
*outrunning*; I fixed it by noting the comet has one fixed speed. The second
invoked *fitting through the gap between them*; I fixed it by measuring the gap
and finding 38 visible pixels on the outer ring. Both diagnoses were about
whether the claim was **accurate**.

That was the wrong frame, and it is why the second attempt was no better than
the first. **This game has no aimed movement.** The comet travels a fixed
circle at a fixed speed, and there are exactly two verbs: turn around, change
ring. There is no positioning, no threading, no stopping, no aiming. A sentence
about the space between two objects describes a manoeuvre that does not exist
here — the player was never trying to go between them and has no way to. It
reads as a non-sequitur because it is one. Accuracy was never the problem;
both wordings imported a manoeuvre from a genre this game is not.

What survives is what the game actually has: a count, and a verb.
*"two at once — swipe to another ring."*

The rule in `CLAUDE.md` is generalised to match: a lesson may only reference
actions and objects the game actually has. Checking against the code cannot
catch this — the code will happily support a true statement about something the
player can never attempt.

**Ten more sentences that did not match the game.** The audit's remaining
confirmed findings, cleared in one pass. Four needed the code to move, not the
copy:

- **`SPOTLIGHT ×2` doubled nothing.** Three strings asserted it — the lesson,
  the announcement, and a HUD chip sharing a slot and a grammar with
  `OVERDRIVE ×2`, which genuinely doubles. The spotlight's entire effect
  inventory was a flat +8 on a tight tap, performer gain ×1.5 and a bed duck.
  Worse, under this repo's *audio is optional everywhere* rule it paid
  **literally zero**: `judgeTiming` returns early with no `AudioContext`, so no
  tap is ever judged tight, yet the orb is force-placed on level 2 with no
  audio condition and the chip draws off `G.spot` alone. Adding `G.spot>0` to
  the game's one doubling test makes the badge true, and true without sound.
- **Every level-clear ceremony was captioned `UNLOCKED`** — including the
  finale, where nothing unlocks: the tier, the ring count and the spawn pool
  are untouched by the finale latch. One hardcoded eyebrow served two opposite
  events, so no wording could fix it; the banner carries its own eyebrow now
  and the finale reads `FINISH LINE`.
- **The death screen mixed one run-scoped number with three level-scoped
  ones.** `startGame` restored the carried score but zeroed every counter
  beside it and re-baselined the clock, so clearing three levels and dying 30s
  into level 4 printed a four-figure cumulative score next to *"3 orbits · ×1
  streak · 0:30"* — a six-minute session reported as half a minute. The
  counters carry now: sums for orbits and drops, max for the streaks, and the
  clock spans the run. Verified: 3 levels + 30s reads **5:15**, not 0:30.
- **`TIERS[9]` was named `STORM`,** which is also `LV[2].name` (`THE STORM`).
  Its `sub` can never render, but its *name* is the only label `tierLabel()`
  can return on level 4 — so every level-4 run printed `LEVEL 4 · STORM` in the
  header, on the death screen and in the share text, seconds after the card
  named the level EVENT HORIZON. Renamed to `THE EYE`; deleting it would fail
  `smoke.mjs`, which asserts the last tier sits on level 3's finish line.

And six wordings:

| was | now | because |
|---|---|---|
| the **gold** star — untouchable at double speed | the **pink** star — untouchable and fast | `COL.hyper` is `#ff4fd8`; gold is the colour of the ordinary embers |
| SHIELDS FULL — **everything** pays double | SHIELDS FULL — **stars** pay double | the orbit payout, up to 86, is untouched |
| combo — each star pays more than the last | combo — chain stars, **up to +6 each** | the chain caps at 6 and the lesson fires at 3 |
| red starts arriving in shapes | red starts blocking whole rings | twins unlock at dl 18, inside level 1 |
| next sound: X at **level 7 / 10** | next sound: X — keep climbing | those are tier rungs, on a four-level ladder |
| LAPS **×**7 | LAPS 7 IN A ROW | the streak bonus saturates at five laps |

Two more, from the bug hunt rather than the copy audit. `shieldMax()` steps
3→4→5 on the difficulty clock, so a bank sitting full silently stopped being
full and the doubling stopped with no message — that crossing now says **BANK
DEEPER** and closes the shimmer. And there was **no `webglcontextlost` handler
of either kind**: iOS drops a WebGL context under memory pressure, the default
action makes restoration impossible, and `GL.on` stayed true so the renderer
kept issuing calls into a dead context while the 2D fallback that exists for
exactly this never took over.

**Which way is out is now the player's call.** Playtester, verbatim: *"can you
make it so slide up always changes to outer ring and down to inner? i think
that's what my brain wants, so that would make it easier (for me,
definitely)."*

There are two coherent rules and neither is correct. **Away is out** (radial)
reads the swipe against the line from the centre through the comet, so at the
bottom of the loop you swipe *down* to go out. **Up is out** (screen) ignores
where the comet is: up is the outer ring, always. They agree at the sides of
the loop and invert at the bottom, and which one a person's hand expects is not
something the game gets to decide for them.

So it is asked once, on the first tap of a fresh device, on a screen that runs
the real rings and the real `hop()` — because a written description of the
difference does not land. An arrow at the comet shows where *this* rule says
out is right now: under the radial rule it visibly rotates as the comet
travels, under the screen rule it stays pinned upward. The chooser opens with
the comet at the bottom of the loop, which is the one place the two rules are
opposites; opening at the top would have presented a screen on which both
choices look identical. The controls sit inside the hollow of the ring system
so the comet orbits *around* them rather than behind them.

**The wording had been describing the wrong game.** Five channels said "swipe
up or down to change ring" — the menu key, the level 1 card, the SECOND RING
banner, the hint ladder and the death coach. That is the *screen* rule, and the
build has been shipping the *radial* one. Every one of them now resolves
through `swipeWords()` at draw time, so the sentence always describes the rule
in force.

`swipeOut()` is the single place either rule is expressed and both gesture
paths — mid-drag resolution and resolution at lift — call it, so they cannot
drift apart. `smoke.mjs` asserts the two rules agree at the top of the loop and
invert at the bottom; collapsing them to the same expression fails the build.

Every telemetry event carries `swipe_mode`. Two control schemes means every
completion and death rate would otherwise silently average two different games
together and stop being readable.

**Nine tiles the player chose between, and not one of them did anything.**
(Nine at the time — `WIDE PULL` went with the magnetar and `LONG FUSE` with
the bass bomb, so there are seven now.) The
same audit found `upgOn` — the accessor every upgrade effect was supposed to go
through — with **zero call sites in 7,257 lines**. Each of the nine ids
appeared exactly once in the file: in its own row of the `UPG` table. `G.upg`
was written by the pick handler and read only by the no-repeat filter and the
telemetry payload.

So the game stopped the player at every level boundary, printed CHOOSE ONE,
spent their attention on three tiles, wrote the pick to analytics, and then ran
identically whichever they took. It was also quietly poisoning the data:
`G.picks` rides on every event, so any future read of "which upgrade correlates
with survival" would have been measuring noise.

All nine are wired now, each verified to change the value it claims to:

| tile | off | on |
|---|---|---|
| LONGER STAR | 9.2s | 13.8s |
| DEEP BANK | 2 shields | 3 |
| SLOW WORLD | 4s | 6s |
| RICH NOVA | 1 ember/shard | 2 |
| HAIR TRIGGER | meter 1.0 | 0.85 |
| STAGE LIGHT | 9.2s | 13.8s |
| STEADY HAND | 0.032s | 0.045s |

Two of the descriptions were wrong even once wired, and changed with them.
*"slow-mo slows spawns"* sold the base game back to the player — slow-mo
already slows every spawn for everyone, through `tsT` into `sdt` into all three
spawn clocks — so it is *"slow-mo runs longer"* now.

**DEEP BANK gives a third starting shield rather than raising the cap.** The
obvious wiring — `shieldMax()+1` — would have made overcharge *harder* to
reach, since overcharge requires a FULL bank, so a tile reading as pure upside
would quietly have cost score; and `SHIELDS FULL` would have printed with a
visibly empty pip. "One more shield" should mean one more shield.

`check.mjs` now fails the build if any offered upgrade id has no `upgOn` call
site. Verified by deleting one wiring and watching it fail.

**MAGNETAR IS REMOVED.** Owner's call, on the shipped build: *"Magnetar just
broke the screen again. Remove that mechanic entirely. You can't fix it."*

The two entries that used to sit here recorded fixing it twice — once for a
pull that only collected a third of the board, and once for a glow that flew
without its ember. Both are gone with the mechanic, but the second is worth
keeping as a lesson, because it is the reason removal was the right call rather
than a third fix.

Every object in the arena sits at `radiusOf(ring)`. The magnetar pull was the
one exception: it handed each ember a FREE radius in `s.pr` so it could curve
between rings instead of teleporting across them. Several passes draw an ember.
Only some of them were taught about `s.pr`, so each ember's glow stayed parked
on the ring it started from while the ember flew inward — **sixteen detached
glows at once, up to 89px apart on a 390px-wide screen**, on the game's most
spectacular move. Two playtesters reported it independently, verbatim: *"every
time I pick up one of the magnet things this happens to my screen."*

That was fixed with a `starR()` accessor and a build guard, and it came back
anyway. The guard only inspected loops it could recognise as star loops, and
`WIDE PULL` — the upgrade that extended the pull to power-up orbs — put a free
radius on objects the guard never looked at. A guard that covers the cases you
thought of is not a guard against the mistake you keep making.

The shape of the mistake is worth naming, because it was never a typo: a second
source of truth for a position, one reader updated, shipped. The harnesses
could not catch it — they have no renderer — and reading the code did not catch
it either, because each pass looked correct in isolation.

So the removal is not a retreat from a hard bug; it deletes the category. With
no free radius there is no second source of truth, nothing to keep in sync, and
nothing for a draw pass to disagree about. `check.mjs` now enforces the absence
rather than the synchronisation: it fails the build if an ember or an orb is
given a `.pr` again, or if `starR()` returns without the guard that has to come
with it. Verified by reintroducing the assignment and watching the build fail.

`WIDE PULL` goes with it, leaving eight upgrade tiles. Magnetar's share of the
orb spawn roll is redistributed proportionally across the remaining six orbs,
so removing it changes what can appear without changing how often the others
appear relative to each other.


**The teaching says one thing, and it is true.** Owner, on a build that had
just had its teaching retimed: *"There is often tutorial language that makes no
logical sense to the way red things and gameplay work."* There was, and the
audit found the same defect in five places — every one of them a sentence the
game could be caught contradicting inside a single run.

The worst was red. The level 1 card says *red costs a shield — you start with
two*, and that is exactly what the code does. Three other channels — the
first-encounter lesson, the hint ladder and the menu key — flatly said **red
kills you**, which is false for the first two hits of every run. A playtester
reported hitting "a ton of reds" before dying and concluded he had misread
something. He had not. The game told him one rule and then visibly broke it,
twenty seconds apart, which is the fastest way to make a player stop trusting
anything else it says. All four now carry the same sentence; the lethal half is
taught where it becomes true, by the `LAST SHIELD — RED KILLS NOW` popup at the
moment the bank empties.

The others were the same failure in miniature. The DRIFTERS banner said *these
ones chase you* — a drifter is given one fixed random heading well under player
speed and never steers, which the spawn code's own comment says in as many
words. Both drifter channels then said *keep moving*, an instruction naming an
action the game does not have: there is no input that stops you. TWIN SHARDS
invoked *outrunning*, in a game with one fixed speed where nothing is ever
outrun. THIRD RING promised *faster and higher* — angular speed is identical on
every ring (one `G.speed`, no radius term) and an ember pays the same wherever
it is taken; the only real reward for diving is the filter lift, which is what
the banner names now.

**And FLICKER PAIRS was fixed in the code rather than the copy.** Its lesson
promised *only one is ever solid*. The pair is offset half a cycle but ran at
`armed()`'s 0.55 duty, so both halves were armed for 10% of every cycle: a
player who read the sentence, waited for the gap and crossed it died doing
precisely what they had been told. The sentence was the good design, so the
mechanic moved to meet it — pairs run at duty 0.5 and strictly alternate, one
solid side and one gap at every instant. `smoke.mjs` walks a full period and
fails the build on a single frame where both or neither is armed.

**One sentence per idea, and the same one every time.** Each tier banner's
`sub` is now word-for-word the `MEET` lesson for its formation, and the death
coach reads that same lesson rather than a paraphrase. It had four hand-written
special cases sitting above a fallback that already did this, so a gate death
said *gates want you to turn back* while the banner said *every ring blocked*
and the lesson said *every ring is blocked* — and the player was left to notice
those were one rule and not three. Repetition of one sentence teaches;
paraphrase reads as more rules, which is what *"initially I felt like there were
like eight rules"* was actually counting. A `smoke.mjs` assertion keeps banner
and lesson identical, and another forbids any lesson from claiming red kills
outright.

**The menu key is four rows, not nine.** It is the densest block of text in the
game and the first thing anybody reads. The shield, the slow-mo orb and the
nova each have a hint-ladder rung that fires the first time one is actually on
screen; the inner ring has the THIRD RING banner and the camp hint; the beat
drop has the build prompt and a 3-2-1 countdown. Each of those teaches beside
the thing itself, which a row read before the thing exists cannot do. What
survives is what you need before you touch anything: the two gestures, the
thing that pays, and the thing that hurts. The later level cards had gone on
making the same mistake one screen later — level 2's card named gates, drifters
and blinkers on a screen shown up to 75 seconds before the first one exists,
then listed four orbs the player had no referent for. Two lines each now, and
they say what the level *is* rather than what it will contain.

**Three overprints, found by screenshotting rather than reading.** `LAPS ×N`
drew at exactly the `y` of `HYPERNOVA` and `SPOTLIGHT ×2` — the three timed
states were correctly chained with `else if` and the lap streak sat on its own
`if`, guarded against overdrive alone. The share pill had been positioned
against the last line above it twice, and both times a new line was added
underneath it afterwards; it was being stroked straight through *next sound:
twin synths at level 4* for every player below tier 9. And `hintGlyph` assigned
`globalAlpha` absolutely, ignoring whatever its caller had set, so on the death
screen a lone red diamond floated over the ladder for two and a half seconds
explaining nothing while the sentence it belonged to was still at zero. None of
these are reachable by the harnesses — there is no renderer in CI — which is
the standing argument for putting eyes on the actual pixels.

**Every formation teaches itself on first contact.** The first time a twin,
gate, drifter, blinker, sliding gate or flicker pair ever spawns on a device,
time dilates for about three seconds, further spawns hold, and the one
relevant sentence sits dead centre with its glyph while the new thing is
actually on screen — "every ring is blocked — tap to turn around" arrives while
the first gate is visibly barring every ring. Acting ends nothing; it is a
pause, not a test. Three bugs used to spend this once-ever lesson invisibly,
and all are fixed: a landed hop cancelled any running lesson (complying with
"swipe to another ring" destroyed the sentence mid-read — now only the hop
rehearsal ends on a hop); the lesson fired *before* the spawn placement loop,
which can fail outright on a dense board (dilation and seen-bit for a
formation that never existed — it fires at the success sites now); and a
lesson could run behind a fresh banner or payoff card, spent without ever
being readable (it now defers, like it already deferred for danger).

**A death re-arms the lesson it disproves.** The lesson flags are per-device
and permanent — which meant a player who died to gates on five consecutive
runs was never shown the gate lesson again, because a flag said teaching had
happened. Now, when the killer's lesson was already spent, dying to it clears
the flag: the next encounter re-offers the sentence and glyph, without the
slow-mo ceremony — once per type per device (`cometloop:seen2` caps it), so
a veteran is never nagged twice. The exam failing is evidence the lesson did
not land; the game finally acts on its own evidence.

**The death screen coaches — for every killer.** It already knew what killed
you, whether you ever changed rings, and how long you lasted; now it says the
one most useful thing it can, with its glyph, phrased as an invitation —
"you never changed rings — swipe up or down". The coach chain used to go
silent for a drifter or flicker-pair death past 30 seconds — precisely the
death the mid-game hands out — and a twin death reported as a plain single,
because a lone shard cannot say which pairing it came from. Twins now stamp
their formation on both shards, and every named killer without a bespoke
line coaches from its own lesson sentence. And three consecutive
sub-30-second deaths quietly reopen the full 11-second calm opening (see
below) no matter what the lifetime run counter says; one survival past 30
seconds clears it.

**The musical curriculum.** The deepest late note — "combos are never
explained, timing beats is never explained, the music responding to your
beats is never really explained: some of the best parts of the game are
never used by new players" — gets its own lesson set, event-triggered at
the exact moment the player first touches each system: the first reverse's
calm names the whole idea ("your moves play the music — every tap is a
note"), the first on-beat tap names the timing game ("tap as the ring
lands and the chain climbs" — it points at the one object that shows the
beat), the first ×3 names the combo, ×8 says what the summit bought, and
the level 1 card carries the promise up front. All soft lessons —
sentences, never slow-mo.

**Hard lessons are a held breath now.** The first-encounter slow-mo ran at
0.35x — the new threat was explained over a board still visibly in motion.
A 'see' lesson now runs near-frozen (0.06x) under a dim veil with the
specimen wearing a breathing gold ring: one thing lit, one sentence,
nothing else asking for the eye. The hop rehearsal keeps 0.35x (it needs a
world to practice against) and the music never stops either way.

**No line ever runs off the screen.** Announcements, banner subs, the death
coach, card rows and menu rows all measure themselves and shrink to fit
the viewport before drawing — a long sentence on a narrow phone gets
smaller instead of getting cut.

**The loop recorder is visible.** While a captured phrase plays back, a
cyan dot joins the band meter and blinks exactly when the ghost sings —
the player's own recorded rhythm, on screen, muted play included. And the
meter itself finally gets a one-time caption when the first bought layer
joins: "THE BAND — score adds layers."

**The ear learns the language.** Playtest, near-verbatim: "I'm too focused
to read the text... if a sound always accompanied that text then I could
know what's being said without having to actually read it." Three cues now
mean exactly one thing each, and are never borrowed for anything else: a
rising chord call for a tier banner (a new mechanic just arrived), a soft
two-note chime for a first-encounter lesson (teaching is on screen), and a
quick shimmer up/down when a standing bonus state opens or closes
(overcharge, spotlight, overdrive). After a few runs the announcement types
are audible without reading — which was the request.

**The shield bank shows its size.** "Is there a bonus if you max out the 4
shields?" — the cap was invisible, so "full" had no denominator and
Overcharge's trigger was a secret. The empty slots now draw as faint rings
beside the filled ones: the goal is watchable, and the cap growing 3→4→5
late-game appears as a new dim ring instead of silent rule drift.

**The economy's one hidden rule is watched, not inferred.** Orbits pay by
the embers gathered during them, and reversing — the game's primary survival
verb — erases the orbit in progress while keeping the embers banked. No
channel said so; a player who tapped defensively all run scored almost
nothing and was never told why. Now every committed reverse burns off the
discarded lap arc visibly (retracting, gold, fading — muted-safe, reduced-
motion-safe), and the first reversal that discards most of an orbit earns
the economy's one sentence, soft form: "turning back restarts the orbit —
stars stay banked." A rolled-back swipe restores the lap and teaches
nothing, because it cost nothing.

**The hard gesture gets the quiet part of the run.** The second ring used to
arrive at 30s, which meant the hop — a radial swipe on a circle, where "away
from the middle" points a different way at every point of the orbit — was
introduced at the exact moment the board first filled up. The calm opening was
being spent teaching the tap, which nobody needs help with, and the difficult
half of the control scheme was taught under pressure. The ring now lands at
20s and the hop prompt outranks the lap prompt, so the lesson and the calm
coincide.

**The opening is no longer one object repeated.** `TWIN` is the first tier
carrying a shape other than a plain single, so everything below it is a 100%
single pool — and it used to sit at 63 seconds, which is longer than most first
runs last. A tester played four rounds and reported that the game needed more
stuff; he had genuinely seen one obstacle type. It is at 30s now, and the move
is free: across 300 simulated runs per setting, pulling it from 50s to 25s
moved median survival less than 2% (814s → 822s), left forced inputs per minute
flat at 74, and killed nobody inside the first minute at any setting, because a
twin spends two slots of the same shard cap rather than adding to it. It is not
pulled all the way in only because twins are the tier that makes the hop
compulsory, and the second ring needs a clear stretch first — the lesson before
the exam.

**Every run introduces all three power-ups, in order.** The first three
placements are shield, then slow-mo, then nova; only afterwards does the
40/35/25 roll take over. Drawn independently at roughly one placement every
twelve seconds, a 60-second run — which is most runs — saw two power-ups and
had better than even odds of never meeting slow-mo or nova at all. Two of the
three most interesting objects in the game were optional content. Slow-mo and
nova are also *named* now, by a hint that fires while the orb is still on the
board: before, you touched a coloured dot and something large happened that
you had no word for.

The first three runs get a longer clear opening before the first shard —
11s, tapering back to the normal 7s by the fourth run. (Every run starts with
two shields, for everybody, not just newcomers.) `G.runs` persists, so this
fades out on its own and a returning player never meets it. It is a ramp for
learning the controls, not a difficulty change — from run four the game is
exactly what it always was.

**The sky keeps the beat.** One pulse scalar drives the whole backdrop off
the landed beat: the galactic band breathes, the nebulae swell, the god rays
lift, the twinklers and dust motes nod — quiet on an idle board, harder as
the player runs hot, doubled through the payoff. Overdrive floods the room
warm gold; the drum break drops it dark and the crash snaps the light back.
Large audio impact and large visual impact are the same event now. Reduced
motion keeps every layer static, as always.

## Power-ups

Every one of these can be tried on demand from the title screen's POWERUP
TESTING bar — see [POWERUP TESTING](#powerup-testing). It exists because the
list below is gated: three are introduced on level 1, one on level 2, one on
level 3, and the black hole is deliberately rare enough that it had been
entered three times in the game's whole recorded history.

- **Shield** (green) — banked, up to 3. Taking a hit spends one automatically
  but knocks you off your orbit. Never more than three power-ups pass without
  a shield.
- **Slow-mo** (violet) — 4 seconds at 55% speed.
- **Overcharge** — a full shield bank means you have been playing clean,
  and the streak pays (playtester-designed, near-verbatim): while shields
  are full, embers and on-beat taps pay DOUBLE, the pips ring gold, and
  every overflow shield is worth +50 ("OVERCHARGED") instead of a token
  +2. Reaching full announces it: "SHIELDS FULL — everything pays
  double."
- **Spotlight** (white/violet) — four bars where YOU are the lead, on an
  actual stage: the house dims under the arena, a followspot beam and a
  pool of light pin the comet, stars and tight taps pay double, your
  instrument gains half again and the band steps back a notch. A violet
  ring around the comet empties clockwise and blinks through the last
  1.5 seconds. A performance, not a transaction. (It replaced the Echo
  orb, which the loop recorder made redundant, and which the playtest
  didn't love.)
- **Hypernova** — the gold star (the playtest group asked for "a star in
  Mario", so it is one, drawn plainly). Sixteen beats of invincibility at
  nearly double speed: the kit doubles to sixteenths, the room floods
  gold, and every red you plow through converts into a paying ember on
  your lane — fast contacts play an ascending sixteenth run, so carving
  through a full lane IS a melody. The speed eases in over a third of a
  second and back out over the final 1.4 seconds, with a short
  invulnerability grace after it fades, so the star never dumps you at
  double speed into an armed shard. Everything pays double while it burns.

  **And the song gets a star tune**, which is what the playtest was really
  asking for. Doubling the kit is a *texture* change — the same song, busier.
  What a star does in the game everyone means by that comparison is melodic: a
  different tune arrives, instantly, and it is unmistakably the invincibility
  tune. So `STARRUN` is sixteen sixteenths that climb and wrap — four ascending
  four-note cells, each starting a degree higher than the last, so the line
  spirals upward and never resolves — restated every bar for as long as you are
  untouchable, over a driving eighth-note bass on the live chord's root, with
  the band's pad opening 1.22× underneath rather than stepping back.

  It is an **overlay, not a section**, and both halves of that are deliberate.
  The star already lifts the record into the chorus (hypernova is in the
  hot-play set) — but that lift can only land at a four-bar seam, and a seam
  can be most of a loop away against a star that lasts four bars, so a player
  could take the orb, hear nothing change, and have it expire before the
  section arrived. The one thing this moment cannot be is late. And a third
  *section* was not available: `applySect` is the only writer of `CH`/`ARP`,
  sections change only at a four-bar seam, and a star that swapped the harmony
  mid-bar would break the rule the payoff, rise, black hole and star dive
  exceptions exist to protect. An overlay adds a voice above whatever harmony
  is already playing, so it is immediate and cannot collide with anything.
  Written as pentatonic degrees 4–10 — an interval over the level's own tonic,
  never a frequency — so it transposes with the key and stays consonant against
  every chord in either section, and it sits above the band's degree-4 arp
  ceiling because it is the one voice meant to be *on top* of the arrangement.
  A black hole outranks it. `musiccheck.mjs` holds all of that: every degree
  sounded on every level, the density (2 voices in that register cold against
  66 with the star), silence through a black hole, and — the one that has
  shipped wrong twice in this file — that `bedTick` actually lifts the pad,
  because it is the only writer of `BED.g` and scheduling extra voices alone
  cannot make a band louder.

  **And the tail becomes the comet.** "A comet flying through orbit with a
  brilliant tail" is the other half of the ask, so during a star the ribbon
  stops being the groove's scoreboard and becomes the thing itself: five
  passes instead of three — a wide magenta bloom outside a hot gold body
  inside a white core, in the orb's own two colours rather than a new palette
  — 1.85× wider, and *longer*, because the per-sample decay eases off (the
  sample cap is only headroom; it was never the binding constraint, and saying
  otherwise would be a comment taking credit for a line that does nothing).
  Sparks shed off it unconditionally rather than waiting for a groove chain,
  in the star's colours, at a raised particle ceiling. Measured on a 390×844
  phone, ordinary run → hypernova, repeated across runs: **trail samples held
  29→53, arc length 143→428px (3.00×), widest point 15→28px (1.85×), filled
  area 5.31×.** Particles are quoted as a *range* — 4.3× to 11.5× the debris in
  the air — because a point read of `G.parts.length` is whatever the decay left
  standing on that frame, and the first version of this measurement disagreed
  with itself threefold and once reported the star shedding *less*. Averaged
  over a hundred frames it is proportional to spawn rate × lifetime, which is
  the number that means something; the spread is the game's unseeded
  `Math.random`, not the effect.

The musical orbs join the spawn rotation after the intro curriculum
(shield → slow-mo → nova) has run, each named by a first-encounter hint.
On level 2 and up the FIRST placement after the curriculum is the
hypernova, guaranteed, once per run — at a 10% roll the marquee item was
optional content again (a 6000-point run met zero), which is the exact
disease the curriculum exists to cure. The shield-pity rule is unchanged:
never more than three placements without one.

**THE BASS BOMB IS REMOVED.** Owner's call, after a full review of the seven
orbs. The review's finding made the case: the orb's entire named
identity — "drops the low end" — lived in the audio channel, and its visual
tell (the subwoofer cone slamming on the beat) rode `G.beat`, which only moves
when the audio scheduler feeds it, so for a muted player the sprite sat
motionless and the pickup was a cyan flash. What remained with sound off was
strictly a weaker nova: the same `novaConvert` pipeline over a third of the
board instead of all of it, with no invulnerability, at the same rotation odds.
Its clear region — a ±60° wedge across every ring — was never drawn, so the
`LONG FUSE` upgrade widened an invisible number. Two orbs occupying one job,
one of them inferior and illegible, is one orb too many; the nova keeps the
job. `LONG FUSE` goes with it, leaving seven upgrade tiles, and the bomb's
0.15 share of the spawn roll is redistributed proportionally across the
remaining five — the magnetar's precedent, both times: removal changes what
can appear, not how often the others appear relative to each other.

**THE SPOTLIGHT FINALLY LIGHTS THE STAGE.** The same review found the
spotlight's active state changed zero arena pixels for its whole nine-to-
fourteen seconds: the entire inventory was an audio mix move (instrument
×1.5, pad to 0.8 — about −1.9dB on one layer, at the edge of a phone
speaker's JND) plus a text chip that only drew on tall viewports, and the
one universal effect — stars paying double — printed the UNDOUBLED number
in its popup. The owner's brief asked for an actual spotlight, so it has
one now: the house dims under the arena (the drum break's own veil at
0.22 against its 0.30 — every gameplay object draws above it, because a
dimmed board would be a difficulty change and a dimmed sky is staging), a
followspot beam and a pool of light track the comet (beam 0.09 flat/0.15
at beat peak at the comet, pool centre 0.14/0.22 — flat terms first, so
the state reads with the sound off, where `G.beat` never moves), and a
violet timer ring around the comet empties clockwise, blinking through
the last 1.5s — the hypernova's playtest lesson applied before a second
playtester had to teach it. The claim is true now too: the tight-tap
garnish doubles (16 against the standing states' 8), and every ember
popup prints what the score actually paid — a fix that repairs the same
lie for overdrive, hypernova and overcharge, which had all been adding
2× while printing 1×. The lesson rewords to what is countable: "the
light is on you: stars and taps pay double." Two honest shapes only: stopping just short of a shard on
your own ring (the reverse that saved you), and sweeping past a shard on the
ring you just left mid-hop (the hop that saved you). Either pays +3, a white
spark, a breath of heat and a tick of build — passing shards on other rings
in ordinary travel earns nothing, because a graze has to be a dodge or the
spark means nothing. The spark is white-blue: red stays death's alone.

**The text speaks in starlight.** The playtest called the UI type "plain
and boring," and it was: flat white system sans. Headline and guidance
text now draws in the game's own light — a vertical starlight gradient
over a soft glow underlay (four offset passes; shadowBlur stays banned
per-frame; gradients are cached per style so none is built twice). The
title, tap prompts, level cards, banners, countdown, announcements,
finale instructions and teaching hints all carry it; persistent HUD lines
stay lean so the moments keep their contrast.

**Audio is optional, everywhere.** The menu says it plainly: best with
sound on — never required. Muted play keeps every mechanic whole: the beat
rides the pulsing ring, the drop counts down in numerals, the break dims
the room, and the finale reads entirely by eye — every call note RIPPLES
its mark as the band plays it, and in the answer half each mark SWELLS as
the sweep bears down on it, so the tap moment is visible before it is
audible. And if WebAudio itself never comes up (a blocked context, an
ancient browser), the duet is skipped and the level completes at its
plain finish line the way it always used to — nothing about progression
ever requires a speaker.

**The finale: the star dive.** The level's closing melody appears
physically — eleven stars in a tight spiral, four outer, four mid, three
inner. ONE STAR BURNS AT A TIME (playtester: "are you supposed to be
getting the stars in a certain order?" — he couldn't tell, because eleven
equally bright stars answer nothing): the constellation waits as dim
seeds, only the NEXT star burns full-size with the guide line running to
it and a fainter second segment showing the one after, and the moment a
star is taken the next visibly IGNITES with a ripple — chase-this-then-
that, read at a glance, no caption. Any star still collects out of order;
the sequence is the melody's phrasing, never a rule that punishes. The
banner says the rest: "chase the brightest star — quick chains pay
double." Gathering it is a RUSH, not a stroll (the fun pass, after the
owner's "just not that fun"): every star collected speeds the comet ~6%
and opens
the music's filter, the kit fills in as the melody comes home, and quick
consecutive pickups CHAIN for double. Each star plays the next note of a
cadence descending to the root; the core visibly wakes and the sky gilds.
The ending is always the player's own act: a dim sun-seed waits on the
inner ring and only BLOOMS — riser, gold ripple, white-gold and
unmistakable — once the melody is nearly home (or late enough that it
must). Dive into the bloomed sun to land the full chord and the braam:
all eleven gathered pays PERFECT ENDING +200, otherwise LEVEL COMPLETE
+100, and a 50-second timeout completes the level regardless. Both verbs,
zero words, and nothing ends until you choose it.
**`did_hop` is the one to watch first.** The hop is the unfamiliar half of the
control scheme, and a run ending with it false is a run where the player never
used half the game. Read against `misread_rate`: false with unresolved swipes
means the input was misread; false with no swipes at all means the lesson was
missed. Those are opposite problems and no amount of level naming or content
pacing fixes either.

The interesting field is **`misread_rate`**. Every swipe begins as a tap, so
the input layer reverses speculatively and rolls back once your finger
travels. That is invisible when it works. `GEST` counts where each gesture
actually resolves:

| | |
|---|---|
| `tap` | lifted without travelling — reverse, as intended |
| `swipe` | radial intent clear mid-drag — hop, as intended |
| `lateSwipe` | only resolved at lift — worked, but it was close |
| `unresolved` | swiped and got nothing. **The misread.** |

Counted at the resolution sites, deliberately *not* inside `bump()` — that
also fires when a swipe hits the outermost or innermost ring, which is the
game answering correctly rather than failing to understand. Conflating the
two would make the metric useless.

Expect ad blockers to eat a fair share of events. Ratios like `misread_rate`
and run-4 retention survive that; absolute player counts do not.

## Audio

```
voice ─┬─► dry ──────────────► world ─┐
       └─► send ─► reverb ───────────►├─► limiter ─► makeup ─► soft clip ─► out
bed ─────────────► bedDuck ───────────┘
```


Everything is synthesised in WebAudio — there are no audio files anywhere in
the repo.

Sound routes through a bus built once: voices into a limiter, then makeup
gain, then a soft clipper, with a send into a convolution reverb whose impulse
is generated from noise and an exponential decay. Two delay taps were tried
first and read as slapback rather than space — above the ~50ms fusion
threshold you hear two echoes, not a room.

`MASTER` was measured, not guessed. The original layer peaked at **0.138** on
the busiest moment in the game, so roughly 86% of the available headroom was
going unused — that, and not clipping, was why it sounded thin on a phone.
2.6 put a nova cascade three samples over full scale; 2.15 peaks at 0.93 on
the loudest event with the limiter barely working.

**The drop.** The arrangement builds and, when you earn it, releases. A drop
needs three things and the third is the one usually missed: a rise, a
**silence**, and the hit. The last bar runs an accelerating riser, the final
two eighths cut almost everything, and the downbeat lands with six voices at
once — without the hole, the loud part is just more loud.

**The payoff got a floor.** Playtest: "the payoff isn't big enough" and
"the game needs more bass." The drop's impact now lands with a real sub
boom (41Hz, with its octave for speakers) and a braam — a fifth-stack
brass bloom swelling out of the hit — and the section carries a bass line
under the hook, sub sine plus octave square, riding the sidechain pump so
it breathes with the kick. When the eight bars run out the arrangement no
longer snaps back to normal: every gate stays open through the four-bar
breath that follows (the afterglow), so the record cools instead of
stopping — the playtest's exact note was "and then continue on."

**During the payoff, collecting is soloing.** A star grabbed inside the
section fires a three-note run up the scale on the player's own bus instead
of a single note — ride the section gathering stars and you are playing
the keyboard solo over your own drop.

**The section breathes.** Every payoff kick dips the whole band ~3dB through
a dedicated gain after the hole and lets it back over a tenth of a second —
the classic sidechain pump — while the player's own notes stand still: the
response bars are skipped, because the lead voice there is theirs. The
picture pumps with it — bloom and the ring strokes swell on each landed beat
— and the whole sky flips into the warp palette for the section, ebbing out
as the final bar drains. Earning a drop is *heard* the instant it happens
(the same two-note stab a tier unlock uses), the armed wait leans forward on
a creeping sixteenth shaker and an opening pad filter, and the style that
earned it flavours the section itself: a RINGS drop swings, a TIME drop goes
double-time two bars early, an ORBITS drop sustains, a SPARKS drop glitters.
Every other section takes a second ending in bars 4–5, so two drops in a row
never state the hook identically. And earned always stays earned: a drop
interrupted by a mute, a backgrounded tab or a stall goes back to the bank
and fires when the music is next free, instead of silently vanishing.

It always fires on a downbeat. Earning one *arms* it, the rise latches at the
next bar line, and the hit lands two bars later — about five to seven seconds
of anticipation, never the up-to-fourteen the old fixed latch could produce,
which was long enough that most players died holding a full meter and
reasonably concluded the whole mechanic was broken. A drop that arrived
mid-bar would not be a drop, it would be a noise. The cooldown is four bars —
one full pass of the ordinary arrangement — because a drop that happens
constantly is not an event, but a second drop a run can never reach is not a
mechanic either.

**Landing it.** Family playtesting killed every clever sentence this feature
ever carried — no wording about "the drop" survived contact with a
first-time player. So the words are gone: three beats out, the centre counts
**3… 2… 1… NOW!**, and any move — the tap or hop you were making anyway,
anywhere on the screen — landed on NOW is a huge bonus (+300 perfect, +100
close, judged on the groove's own bias-corrected clock). A perfect also
quietly doubles everything earned during the payoff, where tight-timed
inputs pay and embers pay double, tallied at the end as "BONUS +N". A
countdown is the one timing device that has never needed a manual.

**The crown.** The ring you fire the drop from sets how rich the section
plays — never how much it pays, because depth's reward in this game is the
record itself. An inner-ring drop states the hook doubled at the octave with
the full swing; an outer-ring drop plays it lean. Earn it anywhere; crown it
inside.

**The drop's meter is invisible now.** The owner's final call on the
gauge: "get rid of the purple build-up timer — just have the beat drop
incorporated into ideal moments for musical impact." The build economy
still runs untouched underneath (playing well still brings the drop
sooner, and it still latches on a bar line), but the violet arc, its
white armed state, the payoff drain sweep and the BUILD strip are all
deleted. The drop announces itself the musical way only: the shaker
leaning in, BEAT DROP COMING…, the rise, and the countdown.

**The drop is a timer the player accelerates.** The earning economy kept
demanding to be understood, so it stopped being the story: a steady trickle
guarantees a drop roughly every 50 seconds even for someone earning nothing,
and everything the game considers playing well — gathering sparks, working
the rings, tapping in time, closing orbits — pulls it sooner through the
same meter, invisibly. The violet arc around the arena simply fills toward
the next one (the payoff sweep later drains the same circle), and the only
message the player ever sees is "BEAT DROP COMING…". Nothing earned while
the music is busy is discarded; it counts toward the next.

**Timing is rewarded, and never punished.** Each input is judged in three
tiers. Tight against the **quarter — the beat the contracting ring draws —
climbs** the **on-beat** chain toward ×8 (shown as "ON BEAT ×N" —
playtesters had no idea what "groove" meant). Tight against the sixteenth
only — offbeats, fills, survival taps in the song's own subdivisions —
**holds** the chain and still earns the section garnish; it just doesn't
climb. Everything else **slips** one rung — never the chain, never points:
the game already demands you tap when a shard arrives, and docking you for
surviving at the wrong moment would force a choice between playing well and
playing in time. The chain used to climb on any sixteenth-tight hit, and at
±32ms against a 144ms grid random tapping landed ~44% of hits — a playtest
said "feels like you can just tap randomly and get chains", and simulation
agreed: mashing reached ×8 in a quarter of 300-tap trials. On the quarter
it reaches ×8 in none of 500, while a player actually tapping the beat
still maxes in ~12 taps. A near-miss aimed at the beat answers with a dim
arc beside the ring — leading side early, trailing side late — so a player
hunting the beat can steer instead of guessing; a climb lands the next ring
with visible extra weight. The thing taught and the thing judged are now
the same object.

**Holding ×8 is a place, and the sky is how you know you're in it.** The
pocket: keep the chain at the top (×7 sustains it — one slip of grace, the
same one rung a miss costs) and over about a bar the backdrop changes state
rather than brightness. The nebula's flow field accelerates 3.2×, the dust
lanes crystallize into a bright filament network that breaches the coverage
voids — the same ridged field that carves them dark, re-entered as light,
widening on each landed beat — the palette phase nudges per beat, the big
stars glint on the grid, and every landed beat seeds a ripple at the comet
through the interference field the taps already use. Measured on a ported
copy of the shader math: filaments light 8.1% of the void on the landed
beat (0% at rest), highlight coverage 15.9%→19.4%. The 2D fallback rides
the same envelope through its swell, rays, twinklers and motes, and the
trail's last 0.3 of payoff-grade brightness belongs to the pocket alone.

**Each rung of the chain is heard.** The per-rung gain boost was ~0.6dB —
under what a phone speaker makes audible — so the ladder used to speak only
through HUD text until the pad opened at ×5. Now the tap that raises the
chain carries a quiet confirmation tone one scale degree higher per rung, so
eight nailed beats literally walk up the scale, and ×8 lands with the
tier-unlock fanfare and a build bonus worth about a quarter of the meter —
the summit stopped being a dead end.

The judgement is of **consistency, not absolute accuracy**. A phone adds
30–50ms between finger and JS event, so scoring absolute timing would mean a
player tapping perfectly in time registers late and never scores — their device
deciding their result. Instead a running bias is tracked and the deviation from
it is judged, so a player reliably 60ms late is playing in time and gets credit.
But a latency is static, so the learner is too: twelve fast-calibration
samples for a fresh device — reserved for taps plausibly aimed at the quarter,
so arbitrary survival taps cannot spend the budget before the player ever aims
at a beat — then the bias slews at most 3ms per tap inside ±120ms. At the old always-on 0.18 EMA the calibration was fast enough to
*track* a sloppy masher's wandering cadence — simulation showed a ~7Hz
renewal tapper being chased by his own bias all the way to ×8 in 458 of 500
trials; slew-limited on the quarter grid that is 0. Verified end-to-end in
`musiccheck.mjs`: a tapper 40ms late on every beat calibrates in and maxes in
~10 taps, 600 mashed taps peak around ×2–×4, and dead-on odd-sixteenth taps
hold a ×5 chain without climbing or slipping.

Score is awarded **only when the chain climbs**, never for holding it. Paying
per tight hit made forty taps worth 320 against 86 for a maxed orbit — rhythm
would have become the whole game. On the way up a full chain totals 36, so it
stays a garnish beside embers and orbits. The real reward is that the music
opens up, and that costs nothing.

**The arrangement is front-loaded.** Playtesting was unanimous — the music
is the game, and the layering used to reach full strength around six minutes
in, which nobody ever heard. The full band now arrives inside the runs
people actually have (~2.5 minutes), engagement can open every layer the
clock would (playing hard means hearing more, immediately), and the third
ring — the hottest kit — lands at ~73s instead of 114, one level before the
gates. And the stars change voice as you climb, one instrument per act: a
clean square early, a detuned synth pair from level 4, a sawtooth lead with
a slide-in attack from level 7, and at level 10 an electric guitar — a
detuned saw pair with its fifth driven into a hard clip, hammer-on slide and
all. Each step announces itself ("NEW SOUND: SYNTH LEAD") once the level
banner has cleared, playing a quick lick in the new voice, and the death
screen names the next one so the ladder is never a secret. Same key, same
degrees throughout — a band that grows up with the run.

**Score buys the band.** Playtest spec, near-verbatim: "once a player
reaches 2000 points add a new electro synth layer that maintains until they
get 3000 where another is added, and so on." Four permanent layers join at
600 / 1,400 / 2,400 / 3,600 — an offbeat electro pulse, a two-bar synth
riff, a held sub drone (one note a bar, pure weight under the mix), and a
high shimmer.
Each is named in gold as it arrives. A row of dots under the level readout —
the band meter — shows every layer currently in the record: five violet for
the arrangement's own gates, gold for the bought ones, the newest pulsing.

**The drum break.** Play hot and every so often the band steps out for one
bar of drums walking a fill down — and the player's inputs ARE the fill:
taps land as snares, hops as kicks, on the same grid as everything else.
A crash brings the record back exactly on the downbeat. It can never start
while a drop is anywhere in flight; the rise owns its bar.

**Overdrive.** Hold the heat near max for a full bar — continuous, committed
playing — and the game tips into eight bars of double-time sixteenths with
every arrangement gate held open, embers and on-beat taps paying double
under an "OVERDRIVE ×2" readout, the whole band meter running gold. A drop
that rises mid-overdrive absorbs it (the bigger moment wins); otherwise it
ends the way a record ends, on the drum break. Forty-five seconds of
cooldown keeps it an event rather than a state.

**The record is cinematic now.** The playtest asked for it by name:
trailer-score electro. A string-section swell — detuned saws with a bowed
attack — breathes in on every other bar line voicing the chord's third, a
noise riser turns each four-bar phrase the way a reverse cymbal turns a
scene, and both run much wetter into the reverb than anything else in the
game: the room is the cinema. The sky flavours the kit as the run climbs
its palette bands — band 1 swings its sixteenths, band 2 rides the offbeat
open-hat, band 3 leans heavy — so the world and the beat transform
together.

**The ring is the kit.** Subdivision alone was too polite — the per-ring hats
sat at gains the target phone cannot reproduce, so "inner is hotter" was a
promise the speaker broke. Each ring now has a rhythmic identity: the outer
rides the heartbeat (one kick per bar — it used to be silent, which measured
as the single biggest reason ordinary play never hit), the mid ring gains a
half-time kick and a low fifth leaning into the turn, the inner runs a
four-on-the-floor with a moving octave bass and a swung sixteenth. Pattern reads louder than gain: a drum kit assembling under
you as you dive is unmissable at any volume. And the hop itself is cut on the
grid like a DJ transition — a bright two-grain sweep inward, a breathing one
outward, with the arriving track flashing under the comet — so the change is
marked the moment it happens, not discovered a bar later.

**Taps are an instrument, not a click.** Every reverse now carries a fifth
underneath that swells with engagement (one tap is a note, a flurry is a
chord), earns a dotted-eighth echo panned opposite once the groove is found —
against the 3+3+2 world one tap sounds like three — and the figures are
chord-aware, resolving against whatever chord is sounding in that bar rather
than against a fixed scale, so a run of taps follows the song instead of
circling a static position — and follows it on all four levels, since the
figures are chord-tone *indices* and each level's chords differ.

**Embers play the band's own instrument — and now they GIVE.** The pickup
was a sine ding, then a chord-aware square that still pitched UP with the
combo: thinner the better you played ("way too twinkly", said the playtest).
The voice now stays low and gets HEAVIER instead: a fat detuned pluck with a
sub octave underneath, a kick thump from ×2, a short haptic tick from ×3,
riding the dub delay. Weight, not sparkle, is the reward. It still ducks,
pans and mixes as part of the record, and because the tones land on the
sixteenth grid a chain of embers comes out as a fill run.

**The chord is the instrument.** The deepest playtest note — "I don't
feel the game being harmonious with my movements... general music theory
is off" — had a precise cause: player inputs walked the pentatonic SCALE,
which is in key but indifferent to the bar's chord. Melodically safe,
harmonically nowhere. Everything the player triggers now resolves through
chTone(): taps cycle the sounding chord's own voicing, hops arpeggiate it
up or down, the ring raises the octave, the harmony-under note is another
chord tone, star pickups climb the chord with the combo, the loop
recorder records chord-tone INDICES so a recorded loop transposes itself
through the progression like a chord-following arpeggiator, and the
finale's call phrase is chordal by construction — it can never clash with
its own accompaniment. A nailed finale round is answered with the bar's
whole chord. Registers are capped across the solo and payoff licks
("too many high notes"): measured on the master bus, the 1-4kHz band
dropped a further 3.2dB with the low end held.

**The palette has discipline now.** The verdict that survived every gain
fix was "still way too sparkly and twinkling" — because sparkle is not a
level, it is a vocabulary. A study of the reference genres (hypnotic/deep
techno: limited palette of kick, sub bass, ONE dry offbeat hat plus
ghosts, one or two evolving tonal layers; hypnosis from timed delays and
slow filter movement, not from more notes) indicted the arrangement
directly, so this is a subtraction-and-transposition pass, verified with
an analyser on the master bus:

- **Everything points DOWN now.** The arp, the player's instrument, and
  every reward chime in the game — milestones, orbit payouts, golden lap,
  drop-arming stabs, landing hits, power-up fanfares — dropped an octave.
  Brightness was the game's reward language; depth is now.
- **Two layers deleted outright** (the "drive" doubling square and the
  offbeat "cover") — filling space is the dub delay's job.
- **Hats are bandpassed ticks**, not cymbals: highpass alone can only THIN
  a hat (measured: lowering the floor without a cap read as MORE sizzle),
  so the rhythm hats live in a 4-7kHz band, fewer of them, quieter, with
  the offbeat shaker echoed in time through the dub delay — the genre's
  own trick. Crashes and the payoff keep full sheen: climaxes may sparkle.
- **The room is dark**: a 3.2kHz lowpass on the reverb tail, the delay's
  feedback tone down to 1.1kHz, and one very slow breath (a ~2.3-minute
  sine) on the bed's cutoff so the texture moves the way the references do.
- **The bass rolls when you run hot** — pumping eighths against the
  bar-line sidechain.

**The dub delay.** One tempo-synced dotted-eighth delay with dark feedback
hangs off the bed path, and the player's taps, the arp, the riff, the solo
and the ember plucks all feed it — every note trails away in rhythm instead
of stopping dead, which is most of what "groovy and relaxing" means in
hardware terms. It sits BEFORE the drop's hole, so the silence swallows the
echoes too and the discipline holds.

**The whole record hits now.** The final playtest round was blunt: "the
drop hits — literally nothing else does." Measured on the master bus with
an analyser, ordinary play peaked 4.7dB under the section, and the cause
was structural: the kit only assembled as you dove inward, so the DEFAULT
outer ring had no kick at all; the bass floor was a polite triangle; and
the sidechain pump ran only inside the payoff. Three fixes, one idea —
the drop's production values run all game:

- **The heartbeat**: ring 0 carries one kick per bar from the start and a
  second at half band. Inner rings still stack their patterns on top —
  inner stays hotter, but nowhere is silent.
- **The bass is a synth**: bassN() — saw growl, sine sub, square glint for
  the phone, note()'s closing filter as the envelope — walks root / push /
  fifth / approach from almost the first bar.
- **The record breathes all game**: every bar-line kick dips the band
  ~1.5dB and lets it back, the genre's inhale, with the player's perf bus
  standing above it. The bed runs louder and brighter (0.17+0.26k, floor
  520Hz), the string swell breathes every bar, and the arp is a detuned
  analog pair at every level.

Measured after: ordinary-play peaks rose 3.3dB (p95 −17.2 → −13.9 dBFS),
within 2.5dB of the section's — while the section keeps its identity
through the hush, the hook, and the doubled backbeat, which no RMS
average can flatten.

**The solo.** After every payoff the lead answers over the afterglow: a
written four-bar phrase with a slide into each note, wet through the delay.
The drop no longer ends — it hands off.

The rings **pulse on every quarter note**, because you cannot play to a beat you
cannot find. The pulse brightens and shifts colour as the groove builds.

**Everything lands on the grid — not just your inputs.** The game's replies
used to fire at collision time: every ember, orbit payout, shield and
milestone beeped the moment it happened, a cloud of off-grid sounds over a
quantised band. Every scored event now keeps a tiny instant transient (touch
is felt immediately, so nothing reads as lag) and lands its tonal payload on
the sixteenth grid through one shared scheduler — one voice per slot, a taken
slot cascading to the next, so gathering a string of embers plays an actual
sixteenth-note run and the orbit payout walks its arpeggio up from the next
grid point. The nova cascade is a strict ascending pentatonic run in
sixteenths, the wave's arrival order picking the phrasing. Even dying is in
time: the impact is carried by the flash and freeze, and the falling figure
lands on the next eighth — a cadence, not a noise. The death screen's ladder
pips walk the pentatonic too.

**The world itself keeps time.** A blinker's cycle is exactly two beats (it
was an arbitrary 1.15s — four milliseconds off, permanently out of phase), so
flicker pairs alternate on the beat. A shard's warning stretches by up to one
eighth so the instant it turns lethal lands on a beat subdivision — danger
arrives as a note in the arrangement. The conduit current ticks one step per
sixteenth under the player (per eighth elsewhere), the gate rungs march per
eighth, orbs and embers pulse on the landed beat, the ring's lit arc breathes
with it, the orbit-ignition head runs the circumference in exactly one beat,
and the comet's trail is the groove's scoreboard — tinting from cyan toward
violet as the chain climbs and running white-hot through the payoff.

**Your inputs are part of the arrangement.** Every reverse and every hop
already makes an immediate functional noise — that does not change, because
delaying it would make the controls feel laggy. On top of it, each input places
a second note *on the musical grid*, so a player mashing reverse while stuck is
not making noise, they are playing the record.

Consecutive inputs walk a pentatonic figure rather than repeating a pitch, so
tapping back and forth is a phrase; a pause of 2.4s starts a new one. Hops run
the figure upward or downward depending on direction. Input also builds *heat*,
which opens the pad filter, adds sixteenth-note hats and thickens the hits, then
decays over about three seconds — so working the controls drives the groove and
then settles, rather than latching.

Quantising is to the **nearest** sixteenth, not the next one. Snapping forward
alone costs up to a full slot — 144ms at this tempo, past the point where a
sound stops feeling attached to the tap that caused it. Nearest halves the worst
case: measured at **61ms** across a flurry of twelve off-grid taps. One note per
slot, so forty taps inside a single frame produce exactly one — two notes in one
slot is not a faster rhythm, it is a flam, and it is how mashing would otherwise
stack nodes.

The score is **adaptive layering**: one fixed tempo (104bpm) for the whole
game, and one key per level — with layers entering as the difficulty clock
rises: bass, then a pentatonic arp, then hats, then a counter-line, with the
arp moving from quarters to eighths past 62% intensity. Nothing changes tempo
ever, and nothing changes key mid-*level*, so it can never lurch; what changes
inside a level is how much of the arrangement you hear. It is also the only
channel that tells you speed has climbed from 1.4 to 4.2 rad/s.

The SFX pentatonic is scaled into whatever key is playing, which is what keeps
the effects layer from clashing with the band. That is a constraint on the
chords rather than a fact about them, and it is the reason every level's
progression stays inside its own natural minor — see the Levels section.

Notes are scheduled **ahead on the audio clock**, never from the frame clock,
which stalls whenever the tab is backgrounded. A stall longer than 0.4s
resyncs rather than flushing its backlog as one chord — verified by forcing a
five-second gap and counting what came out.

The pad is four continuously running voices **retuned** per chord rather than
restarted; restarting sustained oscillators every bar is what makes cheap game
music click at the seams. Escalation is carried by filter movement, never by
amplitude — a slow volume wobble on a sustained tone is the most fatiguing
thing you can put under a fifteen-minute run.

Several cues were fixed rather than added. iPhone speakers roll off hard below
~500Hz, so the bump cue at 150→110Hz and the empty-shield cue at 140→100Hz
were inaudible on the device the game ships to — and bump fires exactly when a
swipe was misread, which is when the player most needs an answer. The shield
block landed in the death register and sounded like a punishment for being
rescued. The death itself fell to 50Hz and so ended by vanishing. The nova
cascade picked a random pitch per shard and stacked into a dissonant wash; it
is now a minor pentatonic.

## Telemetry

The game reports anonymous gameplay counters to PostHog (US cloud) so
playtests can be read instead of retold: a pageview per visit, `run_ended`
on every death (score, game level, run length, death cause, the two-verb usage
counts and the swipe-misread rate — the "did the teaching land" numbers),
`level_cleared` on every finish line (with the Star Dive tally, 11 being
the perfect ending), and `share_tapped`. **One name per ordinal:**
`game_level` is the 1–3 level on every event that carries it, and the
ten-rung unlock ladder is only ever `tier`. `run_ended` used to send `level`
holding `tier + 1` while `level_cleared` sent `level` holding 1–3 — one
property name, two scales, two events. The ambiguous name is retired rather
than redefined, so no historical row silently changes meaning; `tier` carried
the same number all along. The two difficulty modes ride on every event as
`play_mode` — with a second mode, deaths would otherwise average into one unreadable
completion rate, exactly as the two swipe rules would — and it is deliberately
**not** called `mode`, because `swipe_mode_chosen` has always carried the swipe
rule under that name and reusing it would rewrite what every historical row of
that event says. `run_ended` also gained `start_level`, the level a run opened
on: every run used to open on 1, so without it a level-4 run picked from the
front screen is indistinguishable from one played to, and the completion funnel
would count a jump as a climb. `mode_chosen` and `start_level_chosen` fire when
those two screens are answered. The teaching pipeline reports on
itself now too: `lesson_shown` fires when a first-encounter lesson actually
completes its display (type, soft form or not, whether it was a death-
triggered re-offer, seconds into the run), `card_shown` fires when a level
card is dismissed (which level, after a clear or a retry, how long it was
read), and `run_ended` gained `killer_lesson_seen` / `killer_relessoned` /
`lessons_shown` — so "died to a mechanic whose lesson was never shown" and
"died to it even after the re-offer" are directly countable funnels rather
than guesses. The play-style aggregates round it out: `lands` vs
`drops_earned` (the countdown's conversion rate), `best_groove` and
`best_combo` (did the rhythm and combo lessons change behaviour),
`hold_timeout` (the twin exam arrived by hop or by the release valve —
the purest hop-teaching signal), `loop_caught`, `near_misses`, and
`got_spot` alongside the existing orb pickup flags.
`chorus_entries` and `chorus_bars` ride on `run_ended` *and* `level_cleared`
(the same per-level scale and split as `pauses`, for the same reason): did a
run ever lift the song, and could it stay there — the two numbers that say
whether the chorus threshold is tuned right. **The black
hole reports all three outcomes now:** `blackhole_entered`, `blackhole_survived`
and — new — `blackhole_died`, which did not exist, so the mode's failure rate,
the one number that says whether it is too hard, lived nowhere and had to be
reconstructed by hand-joining an entry to a later `run_ended`. It carries how
many seconds were survived, which phase the death fell in, and whether the
innermost orbit had been reached. `blackhole_survived` used to send
`seconds: BH_DUR` — a constant reported as a measurement, so every row that
would ever exist read 17.0; it sends the elapsed time.
**Pause reports `pauses` and `paused_seconds`**, on `level_cleared` as well as
`run_ended` and on the same per-level scale as the `seconds` beside them —
`startGame()` re-baselines the counters at every level boundary, so without the
pair on both events a pause taken on level 1 of a run that died on level 4 was
recorded nowhere at all. Carrying a cumulative total into `run_ended` instead
would have put two scales on one event, which is the retired-`level` failure
rather than a fix for it. Paused time is measured on a **wall clock**: `frame()`
clamps `dt` to 0.05s and `requestAnimationFrame` stops entirely while a tab is
hidden, so a break taken with the phone locked produces no frames, and a
frame-delta accumulator recorded ten minutes as 0.05 seconds — the one case the
field exists to detect, reported as its opposite.
**A POWERUP TESTING session sends nothing**, and it is suppressed at the choke
point inside `track()` rather than tagged with a property. Tagging would have
been the smaller change and the worse one: it moves the burden onto every
future query, and the first dashboard that forgets the filter is averaging
sandbox deaths — pinned clock, one orb on repeat, red switched off — into the
real completion rate. Suppressing means a lab run cannot reach the funnel and
an event added by a later change inherits that for free. Note what that means
for the three black hole events above: a lab session is the easiest way there
has ever been to enter the mode, and none of those entries reach the data — so
`blackhole_entered` keeps meaning "a player met one in a real run", which is
the only reading its failure rate is worth anything under. Exactly one name is
allowed through, `powerup_lab_started`, carrying which orb was picked and
whether the ghost was on; which of the six anybody actually wants to look at
is the one thing about a lab session worth counting. There is deliberately no
analytics SDK: events are plain POSTs to the capture API (sendBeacon
first, so a death recorded as the tab closes still gets out; keepalive
fetch as fallback), which means no third-party script to load and no
load-order to get wrong. Each device gets one random id
(`cometloop:pid`); no autocapture, no session recording, no cookies, no
names — the embedded key is a write-only project token, safe in a public
file by design. A copy served from `file://` or localhost sends nothing at
all, which keeps development and the test harnesses out of the data. If
the analytics host is blocked (ad blockers commonly do) the game plays on
unaffected — telemetry is a listener, never a dependency.

## Running locally

Any static server works. `file://` works too, except that Chrome's storage
rules may block the high-score save.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploying

`.github/workflows/pages.yml` syntax-checks the game on every push and pull
request, and publishes `main` to GitHub Pages.

**The site is an allowlist, not the repository.** The deploy stages
`index.html`, the icons, the manifest, `og.png` and `LICENSE` into `_site/` and
publishes that. It was `path: .` for most of the project's life, which served
the entire checkout from the Pages URL — `CLAUDE.md`, this file, `MECHANICS.md`
and every harness among them, each at its own public address. Repository
visibility never covered it: Pages serves the artifact rather than the repo, so
turning the repository private would have left every one of those documents
readable exactly where they were. `check.mjs` now fails the build on any file at
the repository root that is in neither the published list nor its internal one,
because both directions of that mistake are silent — an asset left out of the
list 404s on the live site, and a document left in becomes a URL.

Setting it up on a fresh clone takes one manual step: *Settings → Pages →
Build and deployment → Source: **GitHub Actions***. The workflow passes
`enablement: true` to `configure-pages`, which is meant to create the Pages
site automatically, but the default `GITHUB_TOKEN` is not permitted to and
fails with `Resource not accessible by integration`. The flag is left in
place because it costs nothing and works for anyone running with a token
that does have the rights.

Two things that bite when this is not yet working:

- The `deploy` job declares a `permissions:` block, and such a block
  *replaces* the defaults rather than adding to them. `contents: read` has to
  be listed explicitly or `actions/checkout` fails — reported as
  `Repository not found`, which reads like a missing repo rather than a
  permissions problem.
- Enabling Pages does not itself trigger a build. Push to `main`, or re-run
  the last workflow, before expecting the site to appear.


**The deployed page is stamped with its commit.** The source says `const
BUILD='dev'`; the deploy workflow rewrites it to the short sha before upload,
so the game itself stays a single hand-written file with no build step — the
stamp is a label on the box, not a compiler. It draws faintly at the bottom of
the title screen and is readable as `window.COSMO_BUILD`. It exists because a
day was lost to screenshots that could not say which build they came from: a
fix deployed at 1:01:42pm, a screenshot taken at 1:02pm, and GitHub Pages'
ten-minute cache between them. A stale cache can also be bypassed on demand by
adding any query string to the URL (`/cosmo/?fresh`) — the CDN keys on it.

## Notes on the implementation

Everything is one `<canvas>` and about 1,300 lines of plain JavaScript.

- **Sprites are baked once.** `shadowBlur` and radial gradients are expensive
  per-frame, so the background, nebulae, star field, comet, embers, shards,
  power-up orbs and the slow-mo vignette are each rendered to an offscreen
  canvas at startup and blitted thereafter. They rebuild only when the scale
  unit, DPR, window size, or sky band actually changes.
- **The arena is the lamp.** The whole scene answers one light source — the
  hub. A structured galactic band with carved dust lanes crosses the sky
  corner-to-corner; a god-ray fan (born *outside* the ring stack, masked so
  it can never cross the play annulus) counter-rotates against a second copy
  of itself and throws wide when the drop lands; two fog banks drift with a
  clearing visibly burned around the rings; forty-four dust motes orbit in
  the lit shell, brightening under the sweep of light that leads the comet;
  and a baked photographic grade (corner falloff, horizon lift, band-axis
  bias) finishes the frame in one quarter-res blit. Every shard's baked
  bright face is rotated to look back at the hub — one key light across the
  whole board.
- **The sky has depth and a clock.** Five planes: the galaxy deepest, then a
  half-screen textured planet (noise-octave surface, gas bands, a terminator
  whose lit crescent faces the arena), blur-baked far stars, crisp near
  stars riding a comet-coupled offset, and the near fog. A slow camera dolly
  drifts the world a few pixels on a long sine so no frame is ever static —
  the HUD stays pinned, and bloom rides inside the same transform so it
  never smears. The palette is banded to the ladder — indigo, teal at THIRD
  RING, violet at SLIDING GATES, ember at STORM — and the band now retints
  the nebulae, galaxy, rays, planet limb and grade together (the nebulae
  previously baked from fixed seed colours; the band tints were dead data).
  Red stays reserved for danger in every band.
- **The rings are conduits.** Each orbit is a baked cross-section — dark
  channel walls, a hot core line, a halo — with current visibly flowing
  along it (fastest and brightest under the player, direction matching
  travel) and eight node pips that breathe on the landed beat. The dark
  walls darken the field around each track, which lifts every ember and
  shard sitting on it. The hub lamp itself breathes on the beat and flares
  with the drop; the comet gained a furnace core flickering at 24Hz and
  sheds a spark stream that turns ember-gold one grain in four. The big
  earned moments (drop landings, perfect lands, death) ride a fat baked
  shockwave annulus instead of a hairline ripple.
- **The comet has a body.** A teardrop rotated to its heading rather than
  three concentric discs: a committed reverse sweeps the nose end-for-end
  through the radial over 90ms (never on the speculative flip, so a rolled-
  back swipe cannot show a turn that did not happen), and a hop stretches it
  along the radial with a small ease-out-back overshoot on arrival — clamped
  to 6u and purely visual, since collision runs on ring indices.
- **Shards are three kin, one halo.** The drifter is a chevron whose point
  leads its motion, the blinker a hollow crystal whose core *fills* as re-arm
  approaches — the old dormant glyph was dimmest at the exact moment it was
  about to become lethal — and the plain single keeps the square. The red
  glow is identical across all three, so red stays one lesson.
- **Nova embers condense.** A converted shard's ember is born as a white-hot
  point collapsing to size over a quarter second instead of the generic
  fade-in, and the front's speed now scales with the actual ring radius, so
  on a large viewport the sweep still beats both the invulnerability window
  and the expiry net — the cascade can no longer end as a single-frame pop,
  and you can no longer die inside your own blast on a desktop monitor.
  A converted WALL fans out instead of piling up (playtester: same-angle
  formations "turn into stars stacked on top of each other"): every ember
  lands on the player's ring, so same-angle shards used to coincide
  exactly — each now steps along the lane in the direction of travel until
  it has room, a necklace of notes you sweep through in order.
- **Collision is a swept arc**, not a point test, so nothing tunnels through a
  shard on a wide screen or after a dropped frame.
- **Spawn clearances scale with ring radius.** A shard's hit width is
  `18.5u / radius` *radians*, so it doubles on the innermost ring — half the
  radius, twice the angle blocked. Clearances used to be flat radians, which
  meant two inner-ring neighbours at the mandated 0.5rad separation overlapped
  by 0.068rad: a wall with no gap, which the player simply could not pass.
  Expressing clearance as a multiple of the hit width fixes it on every ring
  and every screen size, because both terms carry the same `u / radius`
  factor. Sampled over 3,000 boards, no pair of separate shards on a ring
  leaves less than a full gap; the only overlaps left are twins, which exist
  to be hopped.
- **The shield cap grows with the clock** — 3, then 4 past `dl` 160, then 5
  past 320. Late boards carry ten shards across three rings and the inner ring
  costs twice the angle per shard, so three slots stopped being enough to play
  around long before a run ended.
- **Gates are checked for solvability before they spawn.** A gate blocks every
  ring at one angle, so it exists to force a reversal — and uniform random
  placement can bracket the player, wall ahead and shards behind on every
  ring. `reverseEscape()` requires some ring to offer a clear run in the
  post-reversal heading; without one the formation is downgraded to a single
  shard. Across 5,000 randomised board states, about 2% had no escape, and
  none of the 1,257 gates that shipped landed in one. A death you had no move
  against reads as the game cheating, which is the one thing that stops a run
  being worth retrying.
- **Star positions live in normalised space**, so resizing never reshuffles
  the sky.
- **Audio is scheduled on the `AudioContext` clock**, not `setTimeout`, so
  arpeggios stay in time when the tab is backgrounded.
- **Mute is per device and permanent**, so toggling it says so. The speaker
  sits in the top-right corner with a ~50×50px hit area that is live on the
  menu too, and the setting persists through a reload — without
  acknowledgement, one stray thumb reads as "this game has no sound". The
  muted icon is drawn *more* prominently than the unmuted one for the same
  reason: a muted state is the thing you need to notice.
- **iOS needs audio actually played inside a gesture**, not just
  `resume()` — a one-sample silent buffer unlocks it — and the context is
  resumed again on `visibilitychange`, since returning from the app switcher
  or lock screen leaves it suspended. (Note that on iPhone the hardware
  ringer switch silences WebAudio regardless; no code can override that.)
- **Completing an orbit sets the orbit alight.** A head races the full
  circumference in the direction you were travelling, wake burning behind it —
  the one effect that draws what you actually did. It sits just proud of the
  ring rather than on it: on the ring it lands under the comet's own tail and
  reads as more trail, but offset and gold against the tail's cyan it reads as
  the orbit catching light. Everything about it scales with the streak, and
  from ×3 the comet holds still for 75ms while the ring burns round — effects
  run on `dt` and gameplay on `sdt`, so the freeze costs no animation. Under
  reduced motion the ring lights all at once and the hitstop is skipped.
- **Bloom never reads back the canvas.** The textbook route — copy the frame
  into a small buffer and let the upscale blur it — measures ~16ms here,
  because pulling 1.3M pixels back out stalls the pipeline; spare budget does
  not help when one operation eats all of it. Instead the bright objects are
  re-drawn as crude blobs into a quarter-size buffer, which is then upscaled
  back additively. Precision there is pointless: bilinear filtering on the way
  up *is* the blur. Costs about 0.3ms.
- **The bloom got a halo, and the halo is drawn rather than downsampled.**
  One buffer can only carry one radius — how far a pass blurs is set by how far
  it is upscaled — so the quarter-res pass put the same tight collar on the hub
  lamp as on a spark: an ember's light was gone 15px out, the comet's at 22px,
  barely past the blob itself. Every other layer of light here is several
  passes at different weights (the trail is three, the gate bar two, the nova
  front three); the bloom was the one that was a single flat blit, and light
  with no range reads as paint. Each bloom dot now also draws two wider discs —
  2× and 4× its radius — into a coarse buffer, blitted back along with one
  downsample of itself. **Reach goes up ×3.6** — on a 390×844 phone, an ember
  15px → 54px and the comet 22px → 78px, with the ratio holding 3.44–3.74
  across viewports. Reach is measured to 1/255, the outermost radius whose
  light can still tint an 8-bit pixel, as the max over a full circle in
  sub-pixel steps; quoting the threshold is what makes the figure checkable.
  The obvious cheaper route is a mip cascade, and it was built that way first
  and measured before being thrown away. It fails twice. A box downsample
  preserves the peak of anything larger than a buffer pixel, so a solid blob
  keeps full brightness at every level and the passes just *sum*: the core came
  out 61% hotter while the halo barely moved — a brightness bug dressed as a
  glow. And bilinear is a separable tent, so a tiny buffer blown up 40× spreads
  into a cross rather than a disc, with a footprint that depends on where the
  object sits on the coarse grid: sliding one ember across a single coarse
  pixel swung its halo 80%. Everything here is in orbit and permanently
  crossing that grid, so that is a halo that crawls on nothing musical.
  Drawn discs are round by construction — 0.97 to 1.09 across the halo, and 17%
  ripple against the cascade's 80%. The numbers were picked against four
  measurements that pull against each other: reach, core brightness (embers
  must stay *gold*; washing them white spends the one colour that means
  "collect me"), roundness, and how much a dense late-game board hazes over. As
  set: ember core +4.8%, median lift across a full board 0.026. How much glow
  is too much is the one part of this that wants eyes on a real screen.
  The first cut of these figures was measured off a single ray in whole-pixel
  steps against an arbitrary cutoff, and reported a before-gap of 4px between
  the ember and the comet — impossible, since the two run through the same
  filter chain and their discs differ by 7u. Two objects cannot differ in reach
  by less than their radii do; that contradiction is what caught it.
- **And then the halo moved to the GPU, which is where it always belonged.**
  The bright pass stays on the CPU and stays semantic — it knows which objects
  are lights, so it never thresholds a composited frame and can never pick up
  the rings, the pool or the HUD. Only the *blur* moved. Drawn discs bought
  roundness at the price of three arc+fills per light and a falloff made of
  two stacked steps; a separable gaussian is a true convolution, round by
  construction, and its grid is the ¼ bright buffer — four times finer than
  the ¹⁄₁₂ the mid halo was drawn into. So the crawl goes *down* by moving the
  halo to a smaller buffer, which is the opposite of how that sounds.
  Two levels, ¼ and ¹⁄₁₆, reached by way of ⅛: a single 4:1 read undersamples
  a source only smooth to σ≈2 and the halo shimmers as lights orbit across the
  sampling grid. Weighted so the halo carries the **same light it did before**
  — this is a change of filter, not a brightness change. Per light, halo term
  only, on a 390×844 phone: ember energy 1.04×, reach 54→64px, roundness
  0.750→0.867; shard 1.07×, 56→69px, 0.821→0.883; comet 1.06×, 79→84px,
  0.828→0.935; hub 1.02×, 51→59px, 0.733→0.881. Sliding a light across one
  whole coarse pixel swung the old halo's reach 8.8% and its peak 5.7%; the
  gaussian swings 3.5% and 3.2%. If any of it fails, `FX.on` goes false and
  the two discs per light come straight back.
- **The glow falls off the screen edge instead of reflecting.** WebGL1 has no
  `CLAMP_TO_BORDER`, so a blur tap past the texture edge reads the edge texel
  back — light that should slide off-screen was reflected into the outermost
  band, a thin bright frame at the border whenever the comet or its sparks
  passed near it, compounded by every pass of the chain. Measured with the
  shipped kernel: **1.82×** the physical level at the border; a playtester
  photographed it. Out-of-bounds taps now contribute nothing, so the border
  reads 0.55× — the energy genuinely leaves the screen, as it would at a
  window's edge — and interior fragments are bit-identical, since all their
  taps are in bounds. `fxcheck.mjs` parses the kernel out of the shader,
  simulates the chain with whichever sampling semantics the source actually
  has, and fails at 1.05× border gain.
- **The glow can be bent, because it is a field now and not a pile of discs.**
  Radial chromatic aberration scaled by the same energy that drives the sky —
  zero at the arena centre by construction, 0.57px of R/B separation a quarter
  of the way out when idle, 3.80px running hot, 7.60px in a black hole — and
  the hole's own pull applied to the arena's light. The shader has always bent
  the sky while the arena sat flat on top of it, which is exactly the tell this
  file already records for the star layer. The sharp arena still does not bend;
  its light does. **The lens had to be re-derived rather than copied**: the
  sky's pull is bounded as a *fraction* of the radius, which is right for a
  nebula and catastrophic for a halo. The orbits live between 0.09 and 0.20 of
  screen height, and across that band the sky's clamp binds at the full 72% —
  120 to 170px of displacement, tearing every halo off the light it belongs to,
  which is the detached-glow failure this project has already shipped once.
  Bounded in absolute terms instead: 6–9px of lean and 2.8° of wind across the
  play annulus, and a sweep of the whole screen confirms the map never folds.
  **And it shipped pointing the wrong way, which is the third time this exact
  inversion has hit the black hole.** The pass is *inverse* sampling: reading
  from a smaller radius magnifies, so subtracting the pull shoves every halo
  *away* from the singularity — measured at +6.8px and +8.8px where the
  comment above it promised the opposite. The gravity pull that "dragged the
  comet inward" pushed it outward, the "inner ring 2×" bonus paid on the outer
  ring, and now this. All three read as correct, because code and comment are
  both true under some reading of which way the number counts. Reading cannot
  catch it. Asking where a specific light *ends up*, in pixels, can — so
  `fxcheck.mjs` parses the coefficients out of the shader and does exactly
  that, and now reports −6.2/−7.8/−8.6/−8.8px at 0.10/0.15/0.20/0.30 of screen
  height.
- **A lost context on the glow is silence, not an error.** Every call on a lost
  WebGL context is a no-op that does not throw, so `fxResize` would see
  unchanged sizes and return true, `drawArrays` would do nothing, and
  `fxRender` would return *true* — compositing an empty canvas. Worse than the
  backdrop's version of the same bug, which at least left a baked sky behind:
  `bloomHalo` is set false before the dot loop, so the discs that exist for
  exactly this would never have been drawn either, and the glow would simply
  stop with no way back. `isContextLost()` is now asked every frame, before
  anything else, and the lost/restored listeners drop the six render targets —
  a restored context hands back a new context object and every texture,
  framebuffer and program made against the old one is dead.
- **The backdrops were one picture recoloured four times, and orbits were the
  game's biggest unnamed mechanic. Those turned out to be one problem.** The
  owner's brief, verbatim: the backgrounds are *"too similar, not lively
  enough, not fun and exciting, not integrated with gameplay"*, and separately
  *"many people have complained they didnt even know they were supposed to do
  orbits"*.

  The diagnosis for the first was that `SKY_BANDS` only ever changed the
  sky's **palette**. The geometry underneath — two-level domain-warped fBm,
  ridged dust, three star layers, one vignette — was identical in all four
  bands, and the recolour was gated on ladder milestones most runs never
  reach. There were also no *events* anywhere in the backdrop: every layer was
  a continuous field multiplied by a gain, and a gain is not an event. Nothing
  ever arrived, crossed, or left. And the gameplay coupling that did exist was
  all gain too — brightness up, hue walk, a small ripple — which is precisely
  the kind of change a player never notices they caused.

  **A world is a set of weights over structures the shader already computes.**
  This is the whole trick and it is borrowed from the pocket's crystallize,
  where `ridged()` had already been paid for by the dust lanes so re-entering
  it as *light* cost nothing. Four structures are recovered from the two fBm
  fields and the ridged field the chain evaluates anyway: soft **billows**
  (smoothstep over the warped field), large-scale **mass** (the 4-octave
  field), **contours** — `sin()` of a scalar field is a level set, and level
  sets of fBm are curtains, so an aurora world costs zero noise evaluations —
  and the **filament** network (the ridged field as light, at a per-world
  sharpness). `WORLDS` says which of them a world is made of, plus its dust
  depth, void, star gain, temperament and palette. Six of them: DRIFT, TIDE,
  GLASS, EMBERFALL, DUSTLANE, VEIL.

  The weights are **lerped on the CPU**, so the shader never branches on a
  world and never evaluates two. A transition is therefore filaments
  dissolving into billows rather than a crossfade between two pictures, and it
  costs nothing. A world is *held* for the first four fifths of its span and
  morphs over the last fifth — interpolating the whole way would mean the sky
  is never actually anywhere, which is the failure mode of every crossfade and
  the opposite of the point.

  **Orbits are how you travel.** Every completed lap buys a seventh of the way
  to the next world; the lap streak winds the entire backdrop into a rotation
  that follows your direction of travel; closing a lap surges the nebula's own
  mass outward in a slow wide ring; and the wedge of sky *behind* the comet
  lifts as you sweep it, closing as the orbit completes. That last one is the
  answer to the discoverability complaint: the arena has carried a lap arc for
  a long time and it did not teach, because it is three pixels of stroke at
  the exact radius the player is scanning for shards. The lap is now drawn
  where there is nothing else to look at. A first-lap `orbit` lesson names it
  once; the arena arc now thickens and brightens as it closes, where before it
  looked identical at 5% and 95%.

  **And turning around takes it back, visibly.** A reverse zeroes the streak,
  the spin's target rate collapses and flips, and the sky spends a couple of
  seconds stalling and unwinding. The cost of a reverse used to be a number in
  the corner; it is now the motion of the entire screen.

  **Things happen now.** Meteors cross every 3.5–11s, a distant star flares
  every 17–44s with a wash that lights the nebula it stands in, and a
  **passing body** drifts through every 95–210s — an object with a silhouette,
  a terminator and a rim, which *occludes* the nebula rather than being laid
  over it. That last one settles an argument: [#98](../../pull/98) was right
  that *"no amount of fBm is an object — a texture is not a place"*, and wrong
  to fix it by compositing the old baked 2D scene back on top of the shader,
  which was reverted for veiling 69% of it. The argument outlived the
  implementation. Everything is held off the arena by one shared term: this
  game has no aimed input, so nothing crossing the rings may look like
  something to dodge.

  **The red ban is gone, and `GL_MOTION` went back up.** Both were the owner's
  call against a stated risk. What replaces the ban is narrower and sits where
  the "red means danger" contract is actually read — `SKY_ARENA_CALM` (0.34)
  compresses contrast in the annulus the orbits occupy, so EMBERFALL burns at
  the rim while the band a shard is read against stays quiet. Hue is free;
  contrast behind the rings is not. `GL_MOTION` 0.42 → 0.72, now multiplied by
  a per-world `motion` of 0.60–1.30, so the effective dial runs 0.43–0.94 and
  DUSTLANE still broods slower than the old constant while VEIL runs at more
  than twice it. The motion that failed playtesting at 1.0 was *undirected* —
  a uniform drift of everything, meaning nothing. What is faster now is a sky
  that has somewhere to be.

  **What was measured, since "it is in the source" is not evidence.** All 24
  reachable states (6 worlds x 3 samples along every morph) swept over the
  full drift orbit: mean 0.140–0.199, darkest 0.047–0.100. DRIFT is unchanged
  to four decimals against the sky that shipped — 0.1490 mean, 0.0374 darkest,
  against its recorded 0.149/0.038 — because the opening sky had to survive
  the overhaul. Driven through the real game against a recording GL: streak 5
  winds the sky's charge 0.00 → 0.98 and spins it at 0.102 rad/s *opposite*
  `G.dir` (uv counts y up, the game's angle counts it down), a completed lap
  fires the wave and advances the journey by 0.143 of a world, and losing the
  streak unwinds the charge to 0.03. Eight mutations were run against the new
  guards — a world that blacks out, one that floods, the spin sign inverted,
  the gate floor bypassed, weights that stop summing to 1, a uniform looked up
  but never written, and both halves of the y-flip dropped — and all eight
  fail the build.

  **Three holes in `fxcheck.mjs` were found by doing this and are now closed.**
  The recording GL had no `uniform4f` at all, and its absence failed in the
  worst possible shape: the backdrop's first vec4 write threw, `glRender`'s own
  catch swallowed it into `GL.on=false`, and the harness reported *"the
  backdrop shader did not come up against a working GL"* — a message about the
  shader, for a hole in the harness. `GL.u` was not in the "declared but never
  written" loop, so a backdrop uniform looked up and never fed was invisible;
  it is now, which matters more with 29 uniforms than it did with 16. And the
  fake now records the *values* written to each uniform, not only the names,
  so a check can assert what actually reached the GPU.
- **The sky had blackouts built in, and now provably cannot.** The coverage
  gate that carves the nebula into clouds is sampled at `uv*0.75` — a phone
  screen spans about a *quarter of one coverage cell*, so the whole sky rides
  one wandering sample. The drift clock (`G.vt`) never resets, and as a
  straight line it eventually parked that sample in barren stretches of the
  field: whole-screen nebula blackouts lasting 10+ minutes, the first inside
  the first quarter hour of page life, with the stars alive — which reads as
  the game being broken. Latent since the shader's first day; found from two
  same-build screenshots taken four hours apart, one vivid and one black, and
  confirmed by a numeric port of the chain (mean luminance 0.0000 across the
  epoch a phone had parked in). The drift is now an **ellipse** at the same
  tangential speed — one lap (~14 minutes at the current `GL_MOTION`) is every
  drift the game can ever show — and the gate is **floored** at
  `0.10 + 0.90*smoothstep`, so a barren stretch reads quiet rather than black.
  Because the reachable skies are a closed set, `fxcheck.mjs` sweeps the
  entire orbit through a line-for-line port and pins **both** directions of
  the band, with the orbit, gate, structure and spin constants parsed from the
  shader so a retune retunes the check. *(This paragraph carried the retired
  0.42 floor and a ~95-minute lap for two commits after they were superseded —
  both are the numbers from before the orbit's territory was re-chosen. The
  same stale pair was in `docs/invariants.md`. Fixed in the backdrop
  overhaul.)*
  **The set is now a product**, because there are six worlds rather than one
  structure: (drift orbit) x (adjacent world pair). It stays sweepable because
  every world's structure weights sum to 1, its coverage weight is a mix
  factor that can only raise the never-black floor, and its exponents are >= 1
  — all three checked rather than trusted. The sweep covers all six worlds and
  three points along every morph between neighbours, which the midpoint alone
  did not: the first cut found a transition at 0.238 mean against 0.166 and
  0.164 at its two ends. Measured after balancing: **mean 0.140–0.199,
  darkest 0.047–0.100 across all 24 states**, with DRIFT held to the
  historical 0.1490/0.0374.
- **The render scale climbs as well as falls — but only on gameplay frames,
  and the degrade ladder sheds in order of identity.** `GL_SCALE` is 0.60 and
  rises toward 1.0 on a machine holding its frame; the ceiling *latches down*
  on the first slow stretch so the dial can never oscillate. Two hard lessons
  are now built into it, both from the same field report ("looks good for the
  opening and then 5 seconds in, it changes to the old shit"):
  **The raise only counts frames from a live run.** The title screen is
  nothing but fast seconds — empty board, no glow work, no simulation — so a
  raise that listened there bid the resolution up to a price the run could not
  pay, and handed the ladder a guaranteed walk-down. A raise fed by
  unrepresentative frames is not headroom, it is a debt the next screen
  inherits.
  **The sky dies last.** The watch measures the whole frame and cannot tell
  the backdrop's cost from the glow's or a phone throttling itself at 3%
  battery, and its only levers used to be the backdrop's — so any slowness
  anywhere was billed to the sky, ending in `GL.on=false` and the baked 2D
  backdrop swapping in mid-run, permanently. That is the worst degrade the
  game can perform, and it was being triggered by the glow's own per-frame
  cost. The ladder now sheds the glow first (nearly invisible — the disc
  fallback is tuned to carry the same light — and it refunds the likeliest
  bill), then steps the sky's resolution, and only kills the sky when the
  cheapest scale with no glow is still too slow. `fxcheck.mjs` asserts the
  order and fails if the resolution moves while the glow still runs.
- **The hub lamp finally lights something.** `SPR.core` is the light source the
  whole scene is described as answering to, and exactly one object answered it:
  the shard, whose baked bright face is rotated hubward at draw time. Embers,
  orbs and the saucer now take a rim highlight the same way, falling off with
  distance from the lamp — written as a *distance* against the outermost
  radius, never as a ring ordinal, because index 0 is the outermost orbit and
  the two read opposite. Rotated by the **screen** direction rather than the
  parametric ring angle: with `AY` above 1 the arena is a stretched circle and
  the two differ by up to 11° at the diagonals. The black hole orb is the one
  thing left unlit — it is the only object in the game that does not emit.
- **The orbit stack has depth.** Five backdrop planes already rode the camera
  dolly by their own depth while the four orbits sat on one plane, dead still,
  which read as rings printed on glass in front of a world. The offset is a
  function of the *radius alone*, so `posAt()` hands every object exactly the
  offset its orbit gets and a shard cannot come unstuck from its track. Same
  LFO as the dolly, scaled — one camera moving, not two effects agreeing — and
  the hub is depth 0, which is what makes the differential visible.
  `ARENA_PARALLAX = 0` restores the flat stack exactly.
- **The comet lights its own ring** — a short arc centred on it, falling off
  both ways. Decorative, but it also makes "which ring am I on" readable
  without looking away from the comet.
- **The trail runs hot at its core.** Three additive passes of one flat cyan
  read as paint; the narrow pass now runs near-white so the ribbon cools
  outward the way anything incandescent does.
- **The whole wake burns, not just the head.** The furnace sheds sparks from
  one point seven pixels behind the comet, which is right for an idle orbit
  and wrong for a hot one: the ribbon already reports the groove by tinting
  toward warp-violet, so at ×6 it was a bright violet ribbon with sparks
  coming off one end. Above groove 4 the ribbon itself throws embers, picked
  at a random point along its length and pushed out along the local normal —
  never the last two samples, because the furnace owns the head and two
  emitters on one point read as one brighter emitter. Metered on the *dilated*
  delta, so a spark thrown by a ribbon thins out when the ribbon slows.
- **Slow motion smears.** Dilation reaches the whole visible world now, and the
  result is correct and strangely undersold — everything slowing down together
  looks a great deal like nothing happening. What reads as slow motion is one
  thing smearing against another, so while time is dilated the ribbon is drawn
  twice: an after-image lagging by up to nine samples, wider and dimmer and in
  the warp violet the slow-mo vignette is already tinted with, drawn first so
  the live cyan ribbon lies on top of its own past. Two passes rather than
  three — giving the ghost the hot white core would make it read as a second
  comet instead of the first one's past.
- **Particles stretch along their velocity.** Burst speed drives the
  elongation, and since velocity damps at `0.15^dt` the streak collapses to a
  round spark on its own within a few frames — the shape carries the motion,
  with no extra state to track.
- **Gate bars are drawn as energy, not as a line** — a wide soft pass under a
  tight core, overhanging both ends of the ring stack so they read as a
  barrier across the field rather than a chord within it, with crawling rungs
  once armed.
- **Ripples carry their own speed and decay**, so a death shockwave can
  outrun a pickup pop instead of every ring expanding at one rate.
- **`prefers-reduced-motion` is respected** — screen shake, flashes, parallax,
  pulsing, the death shockwave and the animated gate rungs are all suppressed.
- **Safe-area insets** are read from a hidden probe element, so the ring and
  HUD stay clear of the notch and the home indicator.

Scores persist to `localStorage`.

## Checks

```sh
node tools/all.mjs         # every check below, in CI's order, first failure stops it
```

```sh
node tools/check.mjs       # parses, elements, teaching-data drift, repository tripwires
node tools/smoke.mjs       # loads and plays the game headlessly
node tools/dropcheck.mjs   # the build meter still delivers drops
node tools/curriculum.mjs  # nothing is left untaught by level 3
node tools/musiccheck.mjs  # four levels, four songs, all in their own key
node tools/fxcheck.mjs     # the glow actually reaches a pixel, on a GPU and without one
node tools/drawcheck.mjs   # every 2D draw call is one a real canvas would honour
```

Every check runs on every pull request; only `main` goes on to publish.

`all.mjs` is a runner, not a seventh check, and it holds no list of its own: it
parses `pages.yml` and runs exactly the harnesses CI runs, in CI's order. A list
in two places is the thing that rots, and the way it rots is the worst one
available — "all checks passed locally" followed by a red pull request. The
complement is in `check.mjs`, which fails if a harness sits in `tools/` without
a step in the workflow. Between them a harness cannot exist without running in
CI, and cannot run in CI without running locally.

`check.mjs` confirms the inline script still parses, that the elements it
looks up by ID are still in the document, and that the teaching tables have
not gone stale — no lesson pointing at a cut orb, no tier unlocking after
level 3's finish line, and no mode knob that is declared without being read or
that lets SKILL stop being the identity. `smoke.mjs` goes further: it loads the
game into a stubbed DOM and actually plays it — the front screens, the
menu demo, taps, committed and aborted swipes, the keyboard, several simulated
minutes of a run, a landscape resize, a tab background/foreground, a death, the
death screen's fast-forward tap and a retry, a level-2 start and its retry card,
the level ladder's agreement with the FURTHEST YET badge, every difficulty term
measured in both modes at the same difficulty second, and the guard that stops a
picked starting level forging a level record — asserting the state machine comes
through each transition intact. No browser, no dependencies; audio stays off,
which also exercises every audio guard.

It also runs the POWERUP TESTING lab, which needs proving in two opposite
directions. That it *does* something: all six orbs are run for 45 simulated
seconds each and each lab must place its own orb and nothing else, at a
measured cadence. And that it *leaves nothing behind*: `localStorage` is
**cleared**, then a whole session is played — entry, hops, taps, orbs taken, a
forced death with every record set so that it would move if it could — and any
key that reappears fails the build. Clearing rather than diffing is the point,
and it was learned the hard way: the first version snapshotted a store the
earlier tests had already filled, so three leaked writes wrote `'1'` over `'1'`
and the comparison saw nothing. A lab session must be unable to *create* a key,
not merely unable to change one. `check.mjs` carries a tripwire on the set of
persisted keys for the two write sites smoke cannot reach at all — both return
immediately without WebAudio, which smoke removes by design. The lab's two screens are also measured on
eight viewports for rects that run off the screen, overlap each other, or fall
below a pressable height — the canvas is stubbed so no pixel can be checked,
but every control publishes a rect from its own draw pass, and geometry can
be. The first draft of the picker failed that on both landscape phones by
drawing its last orb through the ghost switch. `dropcheck.mjs` re-runs that harness
with a stubbed AudioContext and fails if the build meter stops delivering beat
drops at a playable cadence. `curriculum.mjs` plays a whole run headlessly and
fails if level 3 ever opens with a mechanic the player was never shown.

`musiccheck.mjs` is the one that runs the *arrangement*. The other four never
did: `smoke.mjs` removes WebAudio on purpose, which is how it proves every
audio path is guarded, and `dropcheck.mjs` — the only audio-on harness — never
drives past level 2. The consequence was that the per-level songs had no
coverage at all. Deleting level 4's riff and solo rows outright left all four
checks green while crashing the real game on level 4 with an undefined index.

So this one stubs WebAudio rather than removing it, drives the real scheduler
at every level, and asserts what came out: that each level's pad voices *its*
chords and nothing else, that the progressions are distinct shapes
rather than one transposed, that the four payoff hooks are four distinct tunes
sharing one rhythmic signature, that the response bars stay silent, that level
4 has a bassline and a kit of its own, that no pad voice glides more than an
octave between chords (the pad portamentos, so a chord that leaps is a chord
you hear swoop), and that every pitch in the drop, the snare body and the tom
fill is diatonic to the key actually playing. It also pins level 1: its snare
is still 196Hz and its drop still within a cent of what shipped.

The chorus doubled what it holds. Cold play must voice the verse row exactly
(which is also the proof the lift cannot trigger itself), hot play must lift
at a four-bar seam no earlier than bar 8 and then hold the chorus *walk* —
the row read through its rotation, asserted in order, because the L2 chorus
is the verse's own chords walked the other way and a pitch-set comparison
cannot see order. Both tables are held to one law: chord 0 is the i chord
(the tonic anchor twenty-five `CH[0][0]` readers rely on), every pitch
diatonic, every chorus seventh a genuine stacked third, every glide — the
section seams included — inside an octave, and the chorus arps under the same
784Hz ceiling as the verse's. The color-tone assertion matches on sustain as
well as pitch: the counter-line lands on the same frequency by pentatonic
arithmetic, and a first version of the check counted it, so deleting the
color line stayed green until the check learned to read note length.
The harness also runs each level at its sky-band floor — the game pins
`skyI` to `G.level-1`, and a harness that left the sky at band 0 could not
hear the first chorus lean stack its backbeat straight onto sky band 3's,
which is exactly how a doubled level-4 snare shipped. It now fails on any
slot carrying two snare bodies, asserts the star dive's first bar opens on
the verse chord (the section revert has to reach the oscillators, not just
the tables), and holds `chorus_bars` still through a black hole and a
payoff, where the section flag is frozen but the chorus is not sounding.

`fxcheck.mjs` is the one that runs the *render* path, and it exists for the
same reason `musiccheck.mjs` does: the other five stub the canvas and WebGL
away, so the entire draw layer was uncovered by construction. That is not a
theoretical gap — it is how thirteen black hole features shipped with one of
them perceptible.

So this one stubs WebGL as a *recording fake* rather than removing it. Shaders
compile, programs link, framebuffers complete, and every call is written down;
then it asserts on what was actually issued. The most valuable assertion by
far is the uniform-name check. In real WebGL `getUniformLocation` returns null
for a name the shader does not declare, and `uniform1f(null, x)` is a silent
no-op — so a single typo does not throw, does not warn, and fails no other
check in this repo. It just quietly removes an effect from the game. The fake
reproduces that exactly, parsing the uniform declarations out of the shader
source it was handed and returning null for anything else, and the harness
fails if any location came back null or any write went to one.

It also holds the glow to eight GPU draws a frame (one backdrop, six blur, one
composite), pins the render-target ladder to ¼–¼–⅛–⅛–¹⁄₁₆–¹⁄₁₆ so nobody
collapses the chained downsample back into one aliasing 4:1 read, and checks
that the bright buffer is uploaded with `UNPACK_FLIP_Y_WEBGL` — a canvas
counts rows down and a framebuffer counts them up, so flipping in neither
place or in both renders the glow upside down, which nothing else here could
notice. It drives the render-scale dial through a fast stretch, a slow one and
a fast one again, and fails if the ceiling does not latch. Then it runs the
whole game a second time with no WebGL at all and fails unless the drawn-disc
halo takes over and not one GPU call is issued — a fallback nobody runs is a
fallback nobody knows is broken.

Two more assertions came out of review, both for defects the harness as first
written could not see. It parses the lens coefficients out of the shader
source, asks where a light at a given radius actually lands, and fails unless
the answer is closer to the middle — the sign of an inverse-sampled
displacement is the opposite of what it looks like, and reading has now failed
to catch that same inversion three times in this file. And it takes the
context away mid-run, failing unless the glow stands down and the discs take
back over.

All seven assertions were mutation-tested: renaming a uniform, deleting the
y-flip, collapsing the downsample chain, removing the scale raise, removing
the ceiling latch, flipping the lens sign and removing the lost-context guard
each fail the harness with the right message. The first attempt at that last
mutation silently failed to apply — the regex missed a character — and the
harness "passed", which is its own lesson about mutation tests: confirm the
mutation landed before believing the result.

## License

**Proprietary. Copyright (c) 2026 Alex Smith ([@ats314](https://github.com/ats314)).
All rights reserved.** See [LICENSE](LICENSE).

This is not open source. No permission is granted to use, copy, modify, host,
redistribute, or build derivative works from any part of this repository —
including the game itself, its assets, and its tooling. Playing the game at its
published address is the only permitted use; the source your browser receives in
order to run it is not yours to keep or reuse. The code is also excluded from
text and data mining and from machine-learning training of any kind.

Licensing enquiries: open an [issue](https://github.com/ats314/cosmo/issues).

One caveat the license itself names: GitHub's Terms of Service let any GitHub
user view and fork a repository its owner has set public, and no LICENSE file
overrides that. Making the repository private is the only way to withdraw it.
