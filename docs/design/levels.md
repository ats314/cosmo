# Levels

*Six levels, what each one is for, and where the boundaries sit.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

The run is **six levels**, each with an intro card and its own song. The
first five have finish lines; the sixth does not:

| Level | Name | Introduces | Key | Verse · Chorus | Groove |
|---|---|---|---|---|---|
| 1 | LIFT OFF | the verbs, twins, the orbit economy, shield/slow-mo/nova, the beat drop | A minor | i–♭VI–♭III–♭VII · ♭VI–♭VII–v–i | the original groove |
| 2 | INTO THE RINGS | gates, drifters, blinkers, hypernova | G minor | i–♭VII–♭VI–iv · ♭VI–♭VII–i–i | swung sixteenths, bass off the beat |
| 3 | THE STORM | the two compounds — sliding gates, flicker pairs — plus THE SAUCER and the spotlight, then a finish line | F minor | i–♭III–v–♭VI · i–i–♭III–♭VII | rolling four-on-the-floor |
| 4 | EVENT HORIZON | the same storm, one black hole guaranteed — and a finish line, which it did not have when it was last | E♭ minor | i–♭VI–♭VII–i · iv–i–♭III–v, both over a tonic pedal | octave bass, open offbeat hat |
| 5 | REDSHIFT | everything running away and stretching as it goes | D♭ minor | i–iv–♭VII–♭III · ♭VI–♭III–♭VII–i | the 3+3+2 push, in the bass and the hats |
| 6 | HEAT DEATH | **no new formations** — everything at once, speed climbing toward the 4.2 rad/s ceiling. Endless. | B minor | i–iv–v–♭VI · ♭III–♭VII–iv–i | continuous sixteenths, the floor on 2 and 6 |

### BLACK HOLE MODE

BLACK HOLE MODE runs across levels 3 and 4 and is neither a level nor a
power-up: a rare dark orb you may take or decline, and 17 seconds of somewhere
else if you take it. The band stops, a preset piece plays, you stop being an
instrument, everything runs at 0.42×, the reds run 1.5× to 3.5× — and a fourth
orbit opens while all four re-space. See `MECHANICS.md` for the geometry and the
measurements; the short version is that the fourth ring works because the
orbits move, not because the gaps shrank, and because the arena is an ellipse.

### What the black hole shipped as, and what was missing

The mode shipped with
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

### The curriculum rule

(this is the load-bearing design decision): every
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

### The arranging pass

"Too many sounds clashing" had a findable cause:
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

### Six songs, not one song in six keys

The six levels are **six
arrangements**: each has its own bassline (L1 walks, L2 pushes off the beat,
L3 rolls relentless eighths, L4 jumps the octave, L5 leans on the 3+3+2, L6
rides the octave up because its own root is too low to carry a bar), its own
riff, its own afterglow solo, its own payoff hook, and — past level 1, which
is the reference the others are heard against — its own kit identity (L2
swings with a soft clap lean, L3 drives an offbeat hat everywhere, L4 rides an
open hat and doubles the floor, L5 marks the 3+3+2, L6 runs continuous
sixteenths).

**The keys close a circle rather than falling forever.** A, G, F, E♭, D♭, B is
one full lap of the whole-tone scale: a seventh level would be A again, an
octave below where the game opened, which is the reason there are six and not
five or seven. The register does *not* keep descending with it — level 6's
tonic at 61.74Hz is the lowest root in the game and a bassline sitting on it
all bar would give the level people spend the most time inside the thinnest
bottom end of the six, so its line rides an octave up and touches the low root
only on the downbeat. `musiccheck.mjs` pins a 60Hz floor under every chord
tone in both tables so the next key added cannot fall through it.

Measured across all six, verse and chorus: six distinct progression shapes in
semitones from the tonic (L1 `0 -4 3 -2`, L2 `0 -2 -4 -7`, L3 `0 3 7 8`,
L4 `0 -4 -2 0`, L5 `0 5 10 3`, L6 `0 5 7 8`), six distinct chorus walks, six
distinct payoff hooks, every chord diatonic to its own natural minor, every
pitch within 8 cents of 12-TET, and the widest pad glide 9 semitones — level
3's long-standing figure, matched but not exceeded by either new level.

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

### Level 4's own arrangement

Its bassline branch fell through to
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

### The loop recorder

The owner's idea, near-verbatim: "if I'm stuck
between two reds I just intuitively click back and forth along the beat —
I ad-lib beats. What if my ad-libbed beats could be remembered and
recorded into the song with harmony?" So they are. Every quantised input
lands on a rolling two-bar tape; at each two-bar line, if the window held
a real phrase (three to ten taps with the groove alive), it becomes the
active loop and the band plays it back — harmonised in thirds, an octave
below the player, through the dub delay — for eight bars or until a new
phrase replaces it. The first capture of a run announces itself: "YOUR
BEAT IS IN THE SONG." Dodging in rhythm is composing.

### The orbs earn their look

The spotlight is a stage light, four rays
sweeping round a bright bulb. (Meteor Shower was cut — the playtest's
verdict was that it failed, and the board is calmer without star rain.)

### The braam is the signature voice

The deep "whaaa" from the drop hit —
sub boom under a swelling fifth-stack — now speaks at every big moment:
level starts and completions, overdrive, novas, new
layers, and (once the run warms up) breathing out of every bar-line bass
note. The game's biggest sound is no longer reserved for one event.

### The mid-game has manners

A playtest audit found the 2:00-3:10 window
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

### The new shape insists until its lesson lands

The curriculum promise
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

### The exam waits for the lesson

Twins are the tier that makes the hop
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
