# Cosmo

A one-thumb arcade game that runs in a single HTML file. No build step, no
dependencies, no assets — open it and play.

**▶ [Play it](https://ats314.github.io/cosmo/)**

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

## Levels

The run is **three levels** now, each with a clear finish line, an intro
card, and its own song:

| Level | Name | Introduces | Song |
|---|---|---|---|
| 1 | LIFT OFF | the verbs, stars, the beat drop | A minor, the original groove |
| 2 | INTO THE RINGS | gates, twins, overdrive, drum breaks, bass bomb, spotlight | G minor, swung sixteenths |
| 3 | THE STORM | drifters, blinkers, sliding gates, flicker pairs — endless | F minor, rolling four-on-the-floor |

Survive to a level's finish line and a card celebrates the clear, names the
next level, and lists the mechanics it will introduce — teaching moved to a
calm screen instead of mid-combat. Each level transposes DOWN a whole step
(A → G → F): going deeper into the game literally deepens the music, with
the same 104bpm grid so the dub delay never falls out of time. Every visit
starts at level 1 — the game used to resume a device's highest unlock from
the menu, and playtesters on shared or borrowed phones read that as "the
game skipped level 1," so the resume was cut. Within a run nothing is
lost: death retries the level you died on, and the best score and deepest
level reached are still remembered (`cometloop:best`, `cometloop:gl`) as
records on the death screen. Score carries across a single run's levels;
by level 3 every current mechanic has been introduced.

Playtest round three on levels: **1 and 2 run longer again** (finish lines
at dl 75 and 190 — about 1:50 for level 1 and a further ~2:30 for level 2,
"by the time you get into the song, it's over" being the note) so each song
has time to land; gates moved into level 2 proper and the storm threats
moved out accordingly.

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
  deep. And the three songs are **actually three
arrangements**, not one tune transposed: each level has its own bassline
(L1 walks, L2 pushes off the beat, L3 rolls relentless eighths), its own
riff, its own afterglow solo, and its own kit identity (L2 swings with a
soft clap lean, L3 drives an offbeat hat everywhere).

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

**The orbs earn their look.** The bass bomb is a subwoofer now — its cone
slams on the landed beat; the spotlight is a stage light, four rays
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

Mechanics unlock on a schedule, each announced with a banner:

| ≈ | Unlock |
|---|---|
| 22s | second ring |
| 33s | twin shards — too wide to outrun, hop over |
| 73s | third ring |
| 121s | gates — every ring blocked, reverse |
| 241s | drifters — these ones move |
| 286s | blinkers — they flicker, time your pass |
| 331s | sliding gates — the wall slides, reverse early |
| 376s | flicker pairs — one gap at a time, never both |
| 416s | storm — no new tricks, just more of them |

Those times assume a player earning no difficulty nudge at all, which is the
slowest the schedule ever runs; scoring well pulls everything forward by up
to 40 seconds.

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

## Levels

The ladder is ten levels, and it is the same ten tiers the game has always
climbed — `TIERS`, `tierIndex()`, `G.tier` — but until now the only places the
ordinal ever surfaced were the clipboard and an analytics endpoint that ships
switched off. The player doing the climbing was never told the number.

A tester put the case better than the design did:

> I just think clearing the board using level tiers might be more rewarding as
> a sense of accomplishment than just trying to get a higher score each time.
> For whatever reason, reaching level "XYZ" seems more memorable and rewarding
> than just a highest score. Levels are more distinct, you know?

He is right, and the reason is that a score is a cardinal you cannot repeat
from memory while a level is an ordinal you can say out loud, compare against
someone else, and come back for. So the level now appears under the score in
play, leads the death screen in ember gold with the tier named beneath it,
leads the share text, and persists as `cometloop:level` — "BEST · LEVEL 6 of
10" on the menu, and **FURTHEST YET** in place of NEW BEST when a run sets it.

The ten-pip ladder is drawn on the death screen with the reached levels
filled. The empty half is the point as much as the full half: a player who
dies on level 3 can see that seven more exist, which is the one thing a bare
score can never tell them.

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
drowning at 30 seconds was the entire run, so "red kills you" and the shield
lesson never showed for exactly the person who needed them. The orb-naming
hints now outrank it while an orb is on the board, and after ten unanswered
seconds it alternates with the survival lessons on a slow cycle.

**Every formation teaches itself on first contact.** The first time a twin,
gate, drifter, blinker, sliding gate or flicker pair ever spawns on a device,
time dilates for about three seconds, further spawns hold, and the one
relevant sentence sits dead centre with its glyph while the new thing is
actually on screen — "every ring is blocked — tap to turn back" arrives while
the first gate is visibly barring every ring. Acting ends nothing; it is a
pause, not a test, and it never repeats.

**The death screen coaches.** It already knew what killed you, whether you
ever changed rings, and how long you lasted; now it says the one most useful
thing it can, with its glyph, phrased as an invitation — "you never changed
rings — swipe up or down". And three consecutive sub-30-second deaths quietly
reopen the full 11-second calm opening (see below) no matter what the
lifetime run counter says; one survival past 30 seconds clears it.

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
- **Bass Bomb** (cyan) — every shard in the neighbourhood converts to light,
  and the low end drops: a pitch-fall boom into a one-bar heavy kick figure.
  The clear reuses the nova's conversion, so the shards pay the same.
- **Spotlight** (white/violet) — four bars where YOU are the lead: your
  instrument doubles and brightens, the band steps back a notch, every
  tight tap pays double. A performance, not a transaction. (It replaced
  the Echo orb, which the loop recorder made redundant, and which the
  playtest didn't love.)
- **Hypernova** — the gold star (the playtest group asked for "a star in
  Mario", so it is one, drawn plainly). Sixteen beats of invincibility at
  nearly double speed: the kit doubles to sixteenths, the room floods
  gold, and every red you plow through converts into a paying ember on
  your lane — fast contacts play an ascending sixteenth run, so carving
  through a full lane IS a melody. The speed eases in over a third of a
  second and back out over the final 1.4 seconds, with a short
  invulnerability grace after it fades, so the star never dumps you at
  double speed into an armed shard. Everything pays double while it burns.

The musical orbs join the spawn rotation after the intro curriculum
(shield → slow-mo → nova) has run, each named by a first-encounter hint. The
shield-pity rule is unchanged: never more than three placements without one.

**The near miss.** Two honest shapes only: stopping just short of a shard on
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

**Timing is rewarded, and never punished.** Each input is judged against the
sixteenth grid; land tight and the **on-beat** chain climbs to ×8 (shown as "ON BEAT ×N" — playtesters had no idea what "groove" meant). An off-beat
input simply earns nothing — the game already demands you tap when a shard
arrives, and docking you for surviving at the wrong moment would force a choice
between playing well and playing in time.

**Each rung of the chain is heard.** The per-rung gain boost was ~0.6dB —
under what a phone speaker makes audible — so the ladder used to speak only
through HUD text until the pad opened at ×5. Now the tap that raises the
chain carries a quiet confirmation tone one scale degree higher per rung, so
eight tight sixteenths literally walk up the scale, and ×8 lands with the
tier-unlock fanfare and a build bonus worth about a quarter of the meter —
the summit stopped being a dead end.

The judgement is of **consistency, not absolute accuracy**. A phone adds
30–50ms between finger and JS event, so scoring absolute timing would mean a
player tapping perfectly in time registers late and never scores — their device
deciding their result. Instead a running bias is tracked and the deviation from
it is judged, so a player reliably 60ms late is playing in time and gets credit.
Verified by simulating exactly that: the system learned a bias of 0.057 against
an injected 55ms and that player reached ×8 alongside a perfectly-timed one,
while arbitrary tapping topped out at ×4.

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
chord-aware, leaning with the bar's harmony (Am steady, F down, C up, G home)
so a run of taps follows the song instead of circling a static position.

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

The score is **adaptive layering**: one fixed tempo (104bpm) and one key
(A minor, deliberately the key the SFX pentatonic sits in, so nothing the game
plays can clash with it), with layers entering as the difficulty clock rises —
bass, then a pentatonic arp, then hats, then a counter-line, with the arp
moving from quarters to eighths past 62% intensity. Nothing changes tempo or
key mid-run, so it can never lurch; what changes is how much of the
arrangement you hear. It is also the only channel that tells you speed has
climbed from 1.4 to 4.2 rad/s.

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
on every death (score, level, run length, death cause, the two-verb usage
counts and the swipe-misread rate — the "did the teaching land" numbers),
`level_cleared` on every finish line (with the Star Dive tally, 11 being
the perfect ending), and `share_tapped`. There is deliberately no
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
  glow is identical across all three, so "red kills you" stays one lesson.
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
- **The comet lights its own ring** — a short arc centred on it, falling off
  both ways. Decorative, but it also makes "which ring am I on" readable
  without looking away from the comet.
- **The trail runs hot at its core.** Three additive passes of one flat cyan
  read as paint; the narrow pass now runs near-white so the ribbon cools
  outward the way anything incandescent does.
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
node tools/check.mjs
node tools/smoke.mjs
```

`check.mjs` confirms the inline script still parses and that the elements it
looks up by ID are still in the document. `smoke.mjs` goes further: it loads
the game into a stubbed DOM and actually plays it — the menu demo, taps,
committed and aborted swipes, the keyboard, several simulated minutes of a
run, a landscape resize, a tab background/foreground, a death, the death
screen's fast-forward tap and a retry — asserting the state machine comes
through each transition intact. No browser, no dependencies; audio stays off,
which also exercises every audio guard.
