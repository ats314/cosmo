# Teaching the player

*The curriculum, the death coach, and every channel that explains a mechanic.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

A run opens on a single ring, where the only move is a tap to reverse. The
second ring does not arrive for ~20 seconds, so until it does, a prompt to
swipe would be asking for the one gesture the game will not answer — the
hints skip it until there is somewhere to hop to.

### The menu demonstrates both verbs

The title-screen comet was already
running the real simulation behind the key; now it plays a twelve-second
scripted loop — a harmless shard fades in ahead of it, it reverses with its
real sparks and the tap glyph beside it, then it hops a ring and back at a
third speed under the swipe glyph. The two verbs are watched being answered
by the actual object before the screen is ever touched.

### The hop gets a rehearsal

When the second ring lands for someone who has
never once hopped — a persisted flag, so it interrupts nobody else, ever —
time dilates to a third, spawns hold, and the radial guide that normally
appears mid-drag draws proactively at the comet, rotating with it: the one
place a rotating gesture can actually be shown. The first landed hop ends it
instantly, a failed swipe extends it instead of just thudding, and an 8-second
cap means it can never stall a run.

### The hint ladder cannot deadlock

The swipe prompt used to hold
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

### Ten more sentences that did not match the game

The audit's remaining
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

### Which way is out is the player's call

Playtester, verbatim: *"can you
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

### The wording described the wrong game

Five channels said "swipe
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

### MAGNETAR IS REMOVED

Owner's call, on the shipped build: *"Magnetar just
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


### The teaching says one thing, and it is true

Owner, on a build that had
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

### One sentence per idea, and the same one every time

Each tier banner's
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

### The menu key is four rows, not nine

It is the densest block of text in the
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

### Every formation teaches itself on first contact

The first time a twin,
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

### A death re-arms the lesson it disproves

The lesson flags are per-device
and permanent — which meant a player who died to gates on five consecutive
runs was never shown the gate lesson again, because a flag said teaching had
happened. Now, when the killer's lesson was already spent, dying to it clears
the flag: the next encounter re-offers the sentence and glyph, without the
slow-mo ceremony — once per type per device (`cometloop:seen2` caps it), so
a veteran is never nagged twice. The exam failing is evidence the lesson did
not land; the game finally acts on its own evidence.

### The death screen coaches — for every killer

It already knew what killed
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

### The musical curriculum

The deepest late note — "combos are never
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

### Hard lessons are a held breath now

The first-encounter slow-mo ran at
0.35x — the new threat was explained over a board still visibly in motion.
A 'see' lesson now runs near-frozen (0.06x) under a dim veil with the
specimen wearing a breathing gold ring: one thing lit, one sentence,
nothing else asking for the eye. The hop rehearsal keeps 0.35x (it needs a
world to practice against) and the music never stops either way.

### No line ever runs off the screen

Announcements, banner subs, the death
coach, card rows and menu rows all measure themselves and shrink to fit
the viewport before drawing — a long sentence on a narrow phone gets
smaller instead of getting cut.

### The loop recorder is visible

While a captured phrase plays back, a
cyan dot joins the band meter and blinks exactly when the ghost sings —
the player's own recorded rhythm, on screen, muted play included. And the
meter itself finally gets a one-time caption when the first bought layer
joins: "THE BAND — score adds layers."

### The ear learns the language

Playtest, near-verbatim: "I'm too focused
to read the text... if a sound always accompanied that text then I could
know what's being said without having to actually read it." Three cues now
mean exactly one thing each, and are never borrowed for anything else: a
rising chord call for a tier banner (a new mechanic just arrived), a soft
two-note chime for a first-encounter lesson (teaching is on screen), and a
quick shimmer up/down when a standing bonus state opens or closes
(overcharge, spotlight, overdrive). After a few runs the announcement types
are audible without reading — which was the request.

### The shield bank shows its size

"Is there a bonus if you max out the 4
shields?" — the cap was invisible, so "full" had no denominator and
Overcharge's trigger was a secret. The empty slots now draw as faint rings
beside the filled ones: the goal is watchable, and the cap growing 3→4→5
late-game appears as a new dim ring instead of silent rule drift.

### The economy's one hidden rule is watched, not inferred

Orbits pay by
the embers gathered during them, and reversing — the game's primary survival
verb — erases the orbit in progress while keeping the embers banked. No
channel said so; a player who tapped defensively all run scored almost
nothing and was never told why. Now every committed reverse burns off the
discarded lap arc visibly (retracting, gold, fading — muted-safe, reduced-
motion-safe), and the first reversal that discards most of an orbit earns
the economy's one sentence, soft form: "turning back restarts the orbit —
stars stay banked." A rolled-back swipe restores the lap and teaches
nothing, because it cost nothing.

### The hard gesture gets the quiet part of the run

The second ring used to
arrive at 30s, which meant the hop — a radial swipe on a circle, where "away
from the middle" points a different way at every point of the orbit — was
introduced at the exact moment the board first filled up. The calm opening was
being spent teaching the tap, which nobody needs help with, and the difficult
half of the control scheme was taught under pressure. The ring now lands at
20s and the hop prompt outranks the lap prompt, so the lesson and the calm
coincide.

### The opening is no longer one object repeated

`TWIN` is the first tier
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

### Every run introduces all three power-ups, in order

The first three
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

### The sky keeps the beat

One pulse scalar drives the whole backdrop off
the landed beat: the galactic band breathes, the nebulae swell, the god rays
lift, the twinklers and dust motes nod — quiet on an idle board, harder as
the player runs hot, doubled through the payoff. Overdrive floods the room
warm gold; the drum break drops it dark and the crash snaps the light back.
Large audio impact and large visual impact are the same event now. Reduced
motion keeps every layer static, as always.
