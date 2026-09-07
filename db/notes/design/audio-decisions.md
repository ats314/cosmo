# Why the soundtrack is shaped the way it is

*What this answers: the reasoning behind Cosmo's arrangement — the bus, the
economy of the payoff, the chorus, the timing game — and which parts of it are
history rather than current behaviour.*

Everything is synthesised in WebAudio; there are no audio files in the repo.
`docs/design/audio.md` is the authored record and is explicitly layered: the
first ~105 lines describe current behaviour, and everything under *"Earlier
playtest record"* (line 107 onward) preserves experiments and measurements from
builds that have since moved. Where they conflict, the current implementation
governs.

## The bus, and the one number that was measured

Voices → limiter → makeup (`MASTER`) → soft clipper, with a send into a
convolution reverb whose impulse is generated from noise and an exponential
decay. Two delay taps were tried first and read as slapback, not space.

`MASTER = 2.15` is the canonical example of a **tuning** value in this
codebase: the original layer peaked at 0.138 on the busiest moment in the game,
so ~86% of the available headroom was unused — *that*, not clipping, was why it
sounded thin on a phone. 2.6 put a nova cascade three samples over full scale.
2.15 peaks at 0.93 with the limiter barely working. The number is worth exactly
as much in any engine; the function that applies it is not.

The other standing constraint is the target device: **iPhone speakers roll off
hard under ~500 Hz**, so anything whose payload lives below that is inaudible
however loud it looks in the source. That is why the old bump cue (150→110 Hz)
and empty-shield cue (140→100 Hz) could not be heard at all, and bump fires
exactly when a swipe was misread — the moment the player most needs an answer.

## Loudness by contrast, not by gain

The drop's hush measured **−0.1 dB** against an ordinary bar, because
`musicStep`'s `if(hush) return` stopped *scheduling* while the pad kept
sounding (see `db/notes/design/repeat-failures.md` §1). The drop then landed
+2.9 dB — barely a noticeable level change. None of that is fixed by turning the
drop up; peak was already 0.97. *It is fixed by taking everything else away
first. Loudness by contrast is free.*

The same idea runs the whole arrangement: `A.band` sits at 0.72 at rest, rises
toward 0.90 with groove, orbit streak and engagement, and opens to 1.0 for
hypernova, overdrive, Starfall and a star dive. The player's close instrument
and immediate cues bypass it. Returning to calm removes layers again — *late
difficulty alone cannot keep every instrumental voice running.*

## The drop is a door, and its economy is the interesting part

A drop is not a moment. It is eight bars (18.46 s) entered through a real hole:
bars 0–1 state a hook that exists nowhere else, bars 2–3 are the player's, bars
4–5 restate with the drums at four times the backbeat rate, bar 6 is the
player's, bar 7 is a written descent landing one eighth before the loop resumes.
`PAY = 2 × STEPS` is load-bearing: `MU.step` returns to 0 exactly as the section
ends, so the chord walk stays aligned and the seam lands on a downbeat.

Three economy decisions, each measured:

1. **Nothing is discarded.** Twenty drops earned in a five-minute run, fifteen
   thrown away by the cooldown — *a timer wearing an achievement's clothes.* An
   earned drop is banked and fires the moment the music is free; the cooldown
   only stops two sections overlapping. What keeps drops special is that they
   are hard to *earn*, not hard to *receive*. `endSection()` re-banks a drop
   that was armed or rising but never paid, and deliberately does not re-bank a
   section already in flight — that one was received. Death and menu never bank.
2. **A section may not pre-fill its successor.** `build()` capped the meter at
   0.96 while a drop was in flight, which is the single line that made it a
   timer; it caps at 0.5.
3. **The first drop is a gift, the rest are earned.** A flat higher threshold
   would have fixed the share and broken the opening. The cost escalates within
   a run instead — 1.0, then +0.8 each — clamped at 2.75 under the meter's own
   2.9 ceiling, because the unclamped curve crossed the cap at the fourth drop
   and **420 s of strong play armed exactly three**. `hairtrig` scales the curve
   rather than subtracting from its base, or it would be worth 15% of the first
   drop and 5% of the fourth.

**The build meter itself** replaced three discrete triggers, each of which named
a single behaviour — so a player who navigated by hopping matched none of them
and earned nothing. One meter now, fed by gathering embers, hopping, landing
taps in time and closing orbits, visible the whole time, and decaying so it
measures how you are playing *now*. Arming says why on screen: it used to set a
flag with no feedback at all, and the drop landed up to nine seconds later.

## The chorus, and why it is not on a clock

Each level owns a **second** diatonic progression. Hot play lifts the record
into the chorus at a four-bar seam; cooling hands it back. Every payoff resolves
into the chorus through its afterglow, so the drop the game already guarantees
is also the guaranteed road in — *a player who never chains a beat still hears
every level's chorus.*

Making drops rarer collapsed the chorus (26% → 10% of bars, verse to 62%),
because the payoff afterglow had quietly been almost the only road in. The first
fix was a form clock that lifted the record after sixteen bars; `musiccheck`
rejected it in one line — *"the chorus engaged at heat 0 — the lift is free"*.
Two changes shipped instead, and neither hands anything out:

- **`G.lapStreak` joined the hot set.** A clean orbit is the other thing the
  game measures skill with and it is *sustainable* where `PLAY.heat` is not —
  heat is +0.26 a tap against 0.34/s of decay, so it spikes and collapses and
  only frantic input holds it, which is the exact behaviour the saucer exists to
  discourage. *The player who travels gets the song, not the player who mashes.*
- **`CHOR_HOLD = 12` bars** (~28 s) after the hot state lapses, so a lift is a
  section rather than a flicker. Entry is unchanged and still earned;
  `musiccheck` asserts both halves separately.

Two implementation facts are load-bearing. A chorus *starts* off-tonic but its
row slot 0 is still the i chord — `CH[0][0]` is read as "the level's tonic" by
roughly twenty-five call sites — so the walk order (`CHOFF`) is a separate fact
from the chord inventory. And `applySect` is the only writer of `CH`/`ARP`, and
sections change only at a four-bar seam; that rule is why the hypernova's star
tune had to be an **overlay** rather than a third section.

## Six songs, not one song in six keys

Six keys descending by a whole step, A → G → F → E♭ → D♭ → B, which is one full
lap of the whole-tone scale: a seventh level would be A again, an octave below
where the game opened. That is *why there are six*. The register does not keep
descending — level 6's tonic at 61.74 Hz is the lowest root in the game, so its
bassline rides an octave up and touches the low root only on the downbeat.

Each level owns its own progression, bassline, riff, afterglow solo, payoff hook
and (past level 1, the reference) kit identity. For a long time every level
walked the identical i–♭VI–♭III–♭VII and differed only by transposition — *the
one thing a player hears continuously for fifteen minutes was the one part that
never changed.* The chorus shapes are studied from the owner's three reference
records, cross-checked across transcriptions; the one thing they do that this
game cannot copy is their borrowed major V, whose raised seventh would put the
entire SFX layer a semitone out.

**That last clause is the real constraint.** The SFX pentatonic is scaled into
each level's key and every sound in the game speaks through it, so a chord from
outside the natural minor puts the whole effects layer out of tune with the
band. It is a constraint on the chords rather than a fact about them.

**One hook per level, one rhythm for all six.** The payoff is the loudest,
most-anticipated thing in the game and every level's peak used to state the same
tune transposed. Only the pitches move now: the 3+3+2 accent positions are the
hook's signature, they keep it clear of `ARP`'s straight eighths, and they are
the grid the response bars answer against. *Four different rhythms would be four
different pieces of music; four melodies over one rhythm is a game with a tune.*
`musiccheck` enforced that when HEAT DEATH's first hook tried to break it.

## Every pitch is an interval

Absolute frequencies were audited out of the audio path once the progressions
started to differ. The snare body was a fixed 196 Hz — G3, the ♭VII in A minor,
in key there for the obvious reason that A minor is the key it was picked in,
and a semitone above the tonic chord's third on EVENT HORIZON. It is stored as
the interval now (`CH[0][0] * 1.7818`), so level 1 is unchanged to the cycle. The
drop's sub boom and braam, the drum break's tom fill, the orbit payout arpeggio,
the milestone cue, the shield save and pickup, the ring unlock and the
level-start chime all got the same treatment. **`subF` folds any sub voice below
40 Hz up by octaves, preserving pitch class.**

`ARP` tops out at pentatonic degree 4 (784 Hz) on purpose: the player's floor is
784 and *a boundary only reads as a boundary if the band actually stops below
it.* `STARRUN` — the hypernova overlay — is degrees 4–10 precisely because it is
the one voice meant to sit *on top* of the arrangement.

## Timing is rewarded and never punished

Three tiers. Tight against the **quarter** — the beat the contracting ring draws
— *climbs*. Tight against the sixteenth only *holds* the chain and still earns
the garnish. Everything else *slips* one rung, never the chain and never points,
because the game already demands a tap when a shard arrives and docking the
player for surviving at the wrong moment would force a choice between playing
well and playing in time.

The judgement is of **consistency, not accuracy**: a phone adds 30–50 ms between
finger and JS event, so scoring absolute timing would let the device decide the
result. A running bias is tracked and deviation from it is judged. But a latency
is *static*, so the learner must be too — twelve fast-calibration samples,
reserved for taps plausibly aimed at the quarter so arbitrary survival taps
cannot spend the budget, then a slew of at most 3 ms per tap inside ±120 ms.

Score is awarded **only when the chain climbs**, never for holding it: paying
per tight hit made forty taps worth 320 against 86 for a maxed orbit, and rhythm
would have become the whole game. A full climb totals 36. *The real reward is
that the music opens up, and that costs nothing.* The climb is also **heard** —
the old +10% per rung was ~0.6 dB, under a phone speaker's JND, so the ladder
spoke only through HUD text; each rung now carries a confirmation tone one scale
degree higher, and ×8 lands the tier-unlock fanfare plus about a quarter of the
meter.

## Scheduling rules that are not negotiable

- Notes are scheduled **ahead on the `AudioContext` clock**, never the frame
  clock. A stall longer than 0.4 s **abandons** the section rather than flushing
  its backlog as one chord — verified by forcing a five-second gap.
- The pad is continuously running voices **retuned** per chord, never restarted;
  restarting sustained oscillators every bar is what makes cheap game music
  click at the seams.
- Every duck writes its own undo at schedule time, in the same call. Never rely
  on a later tick to restore a param — AudioParam automation runs on the audio
  clock independently of JS.
- Quantising is to the **nearest** sixteenth, not the next: snapping forward
  alone costs up to a full 144 ms slot, past the point where a sound stops
  feeling attached to its tap. Nearest measured 61 ms worst case across a flurry
  of twelve. One note per slot — two notes in one slot is a flam, not a faster
  rhythm.
- `beep()` keeps its original signature on purpose: thirty call sites depend on
  it, and *replacing them wholesale is how an audio rewrite takes the game
  down.* The bus was built underneath it instead.
- Muting mid-section calls `endSection()`, because `musicTick` runs while muted
  but `note()`/`hat()` do not — a section muted mid-flight would otherwise never
  be heard again.

## The black hole's three acts

The mode replaces the ordinary arrangement with a half-time piece on the same
104 BPM grid, and its acts read the gameplay clock directly: opening (first
35%), accretion (until `BH_ESCAPE` at 12 s, where inner-ring residency raises
`BH.charge` and the beacon gains a fifth), escape (the final 5 s of the
17-second limit, four heartbeats per half-time bar and a rising phrase). The
escape phrase is an **unresolved question**; only an actual successful escape
plays the exit resolution. Each heartbeat has one owner and one corresponding
`BEATQ` timestamp. The gameplay SFX **redshift** falls on a squared curve from
nothing at entry to a perfect fourth by the exit — a flat two-semitone offset
was the one shape a redshift cannot have, because the ear normalises to a
transposition within a second or two and then stops hearing it. A fourth is also
the one deep interval that stays in key.

## Audio is optional, everywhere

Muted or unavailable WebAudio must never block progression or suppress an earned
gameplay reward. Starfall releases on the next quarter beat with audio and
immediately without it. The finale reads entirely by eye. If WebAudio never came
up at all, the level completes at its plain finish line the way it always used
to. This rule is why the retired spotlight's "×2" badge was a lie:
`judgeTiming` returns early with no `AudioContext`, so with sound off it paid
literally zero.
