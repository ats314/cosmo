# Audio and the arrangement

*Six levels, six keys, verse and chorus, and why every pitch is an interval.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

```
SFX -------------------------------> world ----+
player ----------------------------> perf EQ --+--> limiter --> makeup --> soft clip --> out
band/pad/delay -> bedDuck -> hole -> pump -> band gain --+
reverb send -> convolution -> dark filters ------------+
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

### Space for earned peaks

Movement keeps one meaning throughout the soundtrack. A tap turns the comet;
a swipe changes rings. Each committed move receives the same short chord-aware
instrument, with register and direction reflecting that movement. There are no
temporary melody, drum-playing or loop-recording tasks. Every release now has
a complete authored answering melody on all six worlds, even with no input.
Automatic drum fills and chorus transitions vary the accompaniment without
instructions or input remapping. Death, pause and interruption clear unfinished
phrases, fill state, legacy tape data and queued playback.

Ordinary outer-ring flight uses a sparse arrangement: the world's chord walk
and arp contour, a few separated bass notes in its rhythmic shape, one
heartbeat per bar, and a long answering tone. Moving inward, building a
groove of three, sustaining two clean orbits, or earning a chorus or major
reward opens the fuller arrangement. Returning to calm removes layers again;
late-world difficulty alone cannot keep every instrumental voice running.

The accompaniment also has its own `A.band` gain after the scheduled hush
and sidechain pump: **0.72** at rest, rising toward **0.90** with groove, orbit
streak, and engagement. Hypernova, overdrive, Starfall, and a star dive
open it to **1.0**. The player's close instrument and immediate cues bypass
this control. Dark reverb trails behind the quieter band, preserving space
while the musical grid and the world's own harmony keep running.

`bedTick` sets this state gain with a short opening and a slower recovery;
it does not modulate it periodically or create voices every frame. Magnet has
one pickup cue and does not create another ongoing music state. Starfall's
visual scene pulse starts when the audible release reaches its timestamp.

Temporary powers have short, distinct colours. Mirror answers with a quiet
left/right pair once every two bars. Scorch leaves one dry root/fifth flicker
per bar. Both yield to hypernova's established ascending run, and the scheduler
hands off entirely for a drop, black hole, or star dive. Time slip darkens
the pad cutoff without changing key or slowing the musical clock.

Nova, hypernova and orbit milestones share a compact impact voice. A close
transient and tuned low body lead into a root/fifth ring for nova, or a rising
pentatonic figure for hypernova. The cue replaces their previous stacked hits;
it does not sit above another braam and pickup arpeggio. It routes directly to
the world bus so its brief accompaniment duck cannot swallow its own attack.
Routine laps retain the lighter payout cue. Each impact uses at most five
pitched voices and one brief noise source, stays in the world's key with a
40 Hz sub floor, and is silent while muted or paused.

These gain targets and arrangement changes are checked as control values,
routing, and scheduled events in `musiccheck`; they are not new measured
loudness figures. Historical master measurements below describe the builds
in which they were taken.

### The black hole has three acts

The mode replaces the ordinary arrangement with a half-time piece on the
same 104 BPM scheduling grid. Its acts read the gameplay clock directly:

- **Opening, first 35%:** a low tonic, the natural minor's degree-2/flat-6
  tritone, one heartbeat per half-time bar, and a distant tuned beacon.
- **Accretion, until `BH_ESCAPE` at 12 seconds:** the heartbeat doubles and
  short dark noise grains add pressure. Inner-ring residency raises
  `BH.charge` from 0 to 1; the beacon gains a fifth as that bank grows.
- **Escape, the final 5 seconds of the 17-second limit:** four heartbeats per
  half-time bar and a rising scale phrase announce the open route. This is
  an unresolved question; only an actual successful escape plays the exit
  resolution and receives the banked reward.

Each heartbeat has one owner and one corresponding `BEATQ` timestamp, so
the sky's pulse follows the audible strike. The old overlapping late kick
branches and continuous sinking pitch are gone. Every pitched voice remains
an interval in the level's minor key; `subF` preserves pitch class while
raising any sub below 40 Hz by an octave. Sparse upper beacons preserve a
recognisable voice on small speakers. The normal sustained pad stays near
silence through the event; its louder exit recovery belongs to ordinary play.
All six keys are checked across the three acts, including charge-dependent
harmony, unique heartbeats, their visual timestamps, and the sub floor.

## Earlier playtest record

The notes below preserve earlier experiments and measurements. Current control
and reward behavior is defined above and in `direction.md`: temporary musical
input tasks and the timed drop-landing challenge have been retired. Starfall
now gives a four-bar automatic release after successful star-fed orbits.

### How much of the run is the payoff, and why it is a quarter rather than a half

**The section the whole arrangement exists to set up was the most-heard music
in it.** Measured over six minutes of natural play — a bot that hops, taps on
the beat and survives, with nothing force-fed into the meter — the bars divided
33% verse, 26% chorus, **41% payoff hook**, with a drop every 34.6 seconds and
a modal gap of exactly 34.6s. That flatness is the whole diagnosis: 34.6s is
`PAYLEN + PAYREST` plus the rise, so the build meter was full every single time
the cooldown lifted and the only thing gating the biggest moment in the game
was its own cooldown. "Earn a drop" was a fiction. The owner's report was that
the beat drop happened too often and the sound was repetitive and annoying;
both halves were that one fact.

Three changes, measured after each:

- **A section may no longer pre-fill its successor.** `build()` capped the
  meter at 0.96 while a drop was in flight, which is the single line that made
  it a timer. It caps at 0.5 now — nothing earned during a section is
  discarded, so the economy stays live, but the second half of the next drop
  has to be actually earned.
- **The first drop of a run is a gift; the rest are earned.** A flat higher
  threshold would have fixed the share and broken the opening, since most runs
  are short and a player who never hears a drop has lost the feature rather
  than had it rationed. The cost escalates within a run instead — 1.0, then
  +0.8 each — so drop one still lands around 43s and the steady
  state moves past a minute. The escalation is clamped at 2.75 now, under the
  meter's own 2.9 ceiling: the unclamped curve crossed the cap at the fourth
  drop (1+0.8·4 = 4.2), so after three drops the meter could never arm again
  and the mechanic's "it always comes around" promise was silently over for
  the rest of the run — 420s of strong play armed exactly three. The drop can
  always re-arm. `hairtrig` scales the curve rather than
  subtracting from its base, or it would be worth 15% of the first drop and 5%
  of the fourth.
- **The skill contributions halve; the trickle does not.** `build(dt/50)` is
  untouched, so a drop still always arrives for a player who is merely
  surviving.

**Then the chorus collapsed, and that was the more interesting bug.** With
drops rarer, chorus bars fell from 26% to 10% and the verse rose to 62% —
because `t < MU.glow`, the payoff afterglow, had quietly been almost the only
road in. Trading "the payoff hook over and over" for "the verse loop over and
over" is the same complaint one table along.

The first fix tried was a form clock that lifted the record on its own after
sixteen bars. `musiccheck.mjs` rejected it in one line — *"the chorus engaged
at heat 0 — the lift is free"* — and it was right: a chorus nobody earns is
wallpaper, and the harness holds that at heat 0 a level voices its verse row
and nothing else, forever. What shipped instead keeps entry earned and changes
which earning counts and how long it lasts:

- **`G.lapStreak` joins the hot set.** A clean orbit is the other thing this
  game measures skill with, and it is *sustainable* where `PLAY.heat` is not:
  heat is +0.26 a tap against 0.34/s of decay, so it spikes and collapses, and
  only frantic input holds it — which is the exact behaviour the saucer exists
  to discourage. The player who travels now gets the song, not the player who
  mashes.
- **An earned chorus holds for `CHOR_HOLD` (12) bars** after the hot state
  lapses instead of settling at the next seam, so a lift lasts long enough to
  be a section rather than a flicker. Two harness windows measured 9 and 5 bars
  and had to grow past the hold; they read `CHOR_HOLD` out of the game rather
  than copying it.

**And the hook itself now has three readings.** Cutting the frequency fixed how
often it was heard and did nothing about bars 0, 1 and 7 being note-for-note
identical on every section a run ever played. The statement rotates on a
three-cycle — plain, then fifth-doubled and dark, then octave-lit with every
pickup ornament open — while the tune stays the level's own. Three readings of
one melody is how an arrangement restates a hook; three melodies is a medley.
The inner-ring crown stays an independent axis on top, so the pair gives six
textures rather than three.

**Where it landed**, same six-minute measurement, level 1 → verse 43%, chorus
30%, payoff 27%, mean gap 56.3s (was 33/26/41 at 34.6s). Level 4: 54/19/27 at
58.0s. Level 6: 55/29/16 at 65.8s.

## Starfall: the current release

Three completed star-fed orbits earn Starfall; EARLY STARFALL needs two.
Passive time, tapping and near misses do not charge it. With running audio,
the scheduler releases it on the next quarter beat; muted or unavailable audio
does not block the gameplay reward.

The musical phrase lasts four bars, about 9.23 seconds at the current tempo.
It states a complete opening and answer automatically, with alternate openings
and six authored world melodies. The second half adds a stronger backbeat.
Every payoff kick dips the accompaniment briefly while the movement instrument
retains its separate path. The keyed sub and brass impact keep their pitch
class through the 40Hz sub-register floor.

Visual release follows the audible timestamp consumed from DROPQ, rather than
the scheduler's advance scheduling call. Gameplay clears red, suppresses new
hazards and gives three waves of double-value stars. The player sees Starfall,
collects the stars and receives an actual score/count result. No landing
countdown, perfect-tap bonus or temporary music control remains.

The calm arrangement before the event and its recovery afterward provide
contrast. A real Starfall reward interrupted by a black hole keeps its
remaining waves and time; scheduler cleanup must not reissue it as another
earned reward.

## Earlier timing and arrangement notes

The remaining notes describe prior experiments and tuning history. Where
they conflict with the current controls, Starfall contract or scene direction
above, the current implementation governs.

### Timing is rewarded, and never punished

Each input is judged in three
tiers. Tight against the **quarter — the beat the contracting ring draws —
climbs** a timing streak up to eight steps. The hit displays "ON TIME";
reaching the maximum displays "GREAT TIMING". Tight against the sixteenth
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

### Each rung of the chain is heard

The per-rung gain boost was ~0.6dB —
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

### The arrangement is front-loaded

Playtesting was unanimous — the music
is the game, and the layering used to reach full strength around six minutes
in, which nobody ever heard. The full band now arrives inside the runs
people actually have (~2.5 minutes), engagement can open every layer the
clock would (playing hard means hearing more, immediately), and the third
ring — the hottest kit — lands at ~73s instead of 114, one level before the
gates. And the stars change voice as you climb, one instrument per act: a
clean square early, a detuned synth pair from THIRD RING, a sawtooth lead
with a slide-in attack from BLINKERS, and at THE EYE an electric guitar — a
detuned saw pair with its fifth driven into a hard clip, hammer-on slide and
all. (The steps are tier rungs, read off `TIERS` by name — they were bare
ordinals once, which is the class of number that goes stale when a ladder
grows.) Each step announces itself ("NEW SOUND: SYNTH LEAD") once the level
banner has cleared, playing a quick lick in the new voice, and the death
screen names the next one so the ladder is never a secret. The announcement
is keyed by the voice, not the rung, so a climb hears each name exactly once
— TWIN SYNTHS and SYNTH LEAD used to announce twice and ELECTRIC GUITAR
never — and it defers across a black hole rather than captioning music that
is not playing. Same key, same
degrees throughout — a band that grows up with the run.

### Score buys the band

Playtest spec, near-verbatim: "once a player
reaches 2000 points add a new electro synth layer that maintains until they
get 3000 where another is added, and so on." Four permanent layers join at
600 / 1,400 / 2,400 / 3,600 — an offbeat electro pulse, a two-bar synth
riff, a held sub drone (one note a bar, pure weight under the mix), and a
high shimmer.
These layers remain available to the arrangement. The old standing band-meter
dot row is retired; score, level progress and active powers own the HUD.

### The drum break

Sustained engaged play occasionally opens one authored bar of drums, followed
by a crash on the next downbeat. The player's movement instrument stays the
same. No caption requests taps, no input becomes a drum, and the fill finishes
even without player input. A release in flight retains priority.

### Overdrive

Hold the heat near max for a full bar — continuous, committed
playing — and the game tips into eight bars of double-time sixteenths with
every arrangement gate held open, embers and on-beat taps paying double
under an "OVERDRIVE ×2" readout. Starfall
absorbs an active overdrive when its release starts; otherwise it
ends the way a record ends, on the drum break. Forty-five seconds of
cooldown keeps it an event rather than a state.

### The record is cinematic

The playtest asked for it by name:
trailer-score electro. A string-section swell — detuned saws with a bowed
attack — breathes in on every other bar line voicing the chord's third, a
noise riser turns each four-bar phrase the way a reverse cymbal turns a
scene, and both run much wetter into the reverb than anything else in the
game: the room is the cinema. The sky flavours the kit as the run climbs
its palette bands — band 1 swings its sixteenths, band 2 rides the offbeat
open-hat, band 3 leans heavy — so the world and the beat transform
together.

### The ring is the kit

Subdivision alone was too polite — the per-ring hats
sat at gains the target phone cannot reproduce, so "inner is hotter" was a
promise the speaker broke. Each ring now has a rhythmic identity: the outer
rides the heartbeat (one kick per bar — it used to be silent, which measured
as the single biggest reason ordinary play never hit), the mid ring gains a
half-time kick and a low fifth leaning into the turn, the inner runs a
four-on-the-floor with a moving octave bass and a swung sixteenth. The level
kits keep out of its way rather than doubling it — one tenant per timeslot:
level 3's kick fires only on the outer ring, and level 4's and level 6's
floors on beats 2 and 6 yield whenever the inner-ring kit owns those slots,
because two kick oscillators in one slot is mud, not emphasis. Pattern reads louder than gain: a drum kit assembling under
you as you dive is unmissable at any volume. And the hop itself is cut on the
grid like a DJ transition — a bright two-grain sweep inward, a breathing one
outward, with the arriving track flashing under the comet — so the change is
marked the moment it happens, not discovered a bar later.

### Taps are an instrument, not a click

Every reverse now carries a fifth
underneath that swells with engagement (one tap is a note, a flurry is a
chord), earns a dotted-eighth echo panned opposite once the groove is found —
against the 3+3+2 world one tap sounds like three — and the figures are
chord-aware, resolving against whatever chord is sounding in that bar rather
than against a fixed scale, so a run of taps follows the song instead of
circling a static position — and follows it on all six levels, since the
figures are chord-tone *indices* and each level's chords differ.

### Embers play the band's own instrument

The pickup
was a sine ding, then a chord-aware square that still pitched UP with the
combo: thinner the better you played ("way too twinkly", said the playtest).
The voice now stays low and gets HEAVIER instead: a fat detuned pluck with a
sub octave underneath, a kick thump from ×2, a short haptic tick from ×3,
riding the dub delay. Weight, not sparkle, is the reward. It still ducks,
pans and mixes as part of the record, and because the tones land on the
sixteenth grid a chain of embers comes out as a fill run.

### The chord is the instrument

The deepest playtest note — "I don't
feel the game being harmonious with my movements... general music theory
is off" — had a precise cause: player inputs walked the pentatonic SCALE,
which is in key but indifferent to the bar's chord. Melodically safe,
harmonically nowhere. Everything the player triggers now resolves through
chTone(): taps cycle the sounding chord's own voicing, hops arpeggiate it
up or down, the ring raises the octave, the harmony-under note is another
chord tone, star pickups climb the chord with the combo, and the
finale's call phrase is chordal by construction. Movement stays in the same
instrument through fills and releases; there is no recorded echo mode.

### The palette has discipline

The verdict that survived every gain
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

### The dub delay

One tempo-synced dotted-eighth delay with dark feedback
hangs off the bed path, and the player's taps, the arp, the riff, the solo
and the ember plucks all feed it — every note trails away in rhythm instead
of stopping dead, which is most of what "groovy and relaxing" means in
hardware terms. It sits BEFORE the drop's hole, so the silence swallows the
echoes too and the discipline holds.

### Earlier production pass: the whole record hits

The final playtest round was blunt: "the
drop hits — literally nothing else does." Measured on the master bus with
an analyser, ordinary play peaked 4.7dB under the section, and the cause
was structural: the kit only assembled as you dove inward, so the DEFAULT
outer ring had no kick at all; the bass floor was a polite triangle; and
the sidechain pump ran only inside the payoff. Three fixes, one idea —
the drop's production values run all game. Those instruments remain in the
driving arrangement; the sparse passage and state gain above restore space
between their peaks:

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

### The solo

After every payoff the lead answers over the afterglow: a
written four-bar phrase with a slide into each note, wet through the delay.
The drop no longer ends — it hands off.

The rings **pulse on every quarter note**, because you cannot play to a beat you
cannot find. The pulse brightens and shifts colour as the groove builds.

### Everything lands on the grid — not just your inputs

The game's replies
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

### The world itself keeps time

A blinker's cycle is exactly two beats (it
was an arbitrary 1.15s — four milliseconds off, permanently out of phase), so
flicker pairs alternate on the beat. A shard's warning stretches by up to one
eighth so the instant it turns lethal lands on a beat subdivision — danger
arrives as a note in the arrangement. The conduit current ticks one step per
sixteenth under the player (per eighth elsewhere), the gate rungs march per
eighth, orbs and embers pulse on the landed beat, the ring's lit arc breathes
with it, the orbit-ignition head runs the circumference in exactly one beat,
and the comet's trail is the groove's scoreboard — tinting from cyan toward
violet as the chain climbs and running white-hot through the payoff.

### Your inputs are part of the arrangement

Every reverse and every hop
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
music click at the seams. Continuous escalation is carried by filter movement;
the separate band gain changes with engagement and earned states. There
is no periodic volume wobble on the sustained pad.

Several cues were fixed rather than added. iPhone speakers roll off hard below
~500Hz, so the bump cue at 150→110Hz and the empty-shield cue at 140→100Hz
were inaudible on the device the game ships to — and bump fires exactly when a
swipe was misread, which is when the player most needs an answer. The shield
block landed in the death register and sounded like a punishment for being
rescued. The death itself fell to 50Hz and so ended by vanishing. The nova
cascade picked a random pitch per shard and stacked into a dissonant wash; it
is now a minor pentatonic.

And the in-run reward cues transpose now. The orbit payout arpeggio, the
score milestone cue, the shield save and shield pickup, the ring unlock and
the level-start chime were all absolute A-minor/C-major literals — in key on
level 1 because level 1's key is the key they were written in, and chromatic
against most of the other five. Each is written as an interval over the
level's tonic, `CH[0][0]*(old/110)`, so level 1 is bit-identical to what
shipped and every other level finally hears its own rewards in its own key —
the same audit and the same fix the drop's boom, the snare body and the tom
fill got before them.
