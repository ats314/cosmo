# The payoff section: from beat drop to Starfall

**What this answers:** the whole arc of the game's biggest musical moment — what
was measured, what was tried, what was rejected, and what the code actually does
today.

## The diagnosis: 41% of every bar

Owner's report: *"the beat drop happens too frequently and the sound is repetitive
and annoying."* Both halves were one fact.

Measured over six minutes of natural play — a bot that hops, taps on the beat and
survives, nothing force-fed into the meter — the bars divided **33% verse, 26%
chorus, 41% payoff hook**, with a drop every 34.6 seconds and a modal gap of
exactly 34.6s. That flatness is the diagnosis: 34.6s is `PAYLEN + PAYREST` plus
the rise, so the build meter was full every single time the cooldown lifted and
**the only thing gating the biggest moment in the game was its own cooldown**.
"Earn a drop" was a fiction.

## What was tried, in order

**The build meter itself** replaced three discrete triggers. Each trigger named a
single behaviour, so a player who navigated by hopping between rings — a perfectly
good style that avoids tapping — matched none of them and earned nothing at all.
And a build-up that arrives as a threshold you cross invisibly is not a build-up,
it is a lottery result. One meter, on screen, fed by gathering, hopping, landing
taps in time and closing orbits, decaying so it measures how you are playing *now*
(runtime.js:1289-1300).

**Earning always counts.** Measured over a five-minute run, twenty drops were
earned and fifteen were thrown away by the cooldown — a timer wearing an
achievement's clothes. Nothing is discarded now; an earned drop banks and fires
when the music is free (runtime.js:1280-1288).

**Say why.** Arming used to set a flag and produce no feedback whatsoever — no
sound, no text, no HUD change — and the drop then landed up to nine seconds later.
A player could earn one, hear it arrive, and have no way to connect the two
(runtime.js:1275-1279).

**The escalating cost, since retired.** A flat higher threshold would have fixed
the share and broken the opening, since most runs are short and a player who never
hears a drop has lost the feature rather than had it rationed. So the cost
escalated within a run: 1.0, then +0.8 each. That curve then had its own bug — the
unclamped version crossed the meter's 2.9 cap at the fourth drop (1+0.8·4 = 4.2),
so after three drops the game's stated centrepiece could never arm again; 420s of
strong play armed exactly three. Clamped at 2.75.

**`hairtrig` scales the curve rather than subtracting from its base.** As a flat
−0.15 it was worth 15% of the first drop and 5% of the fourth — an upgrade that
quietly retires itself over a run.

## What the code does today

The escalation is gone. `DROP_STEP = 0, DROP_STEP_MAX = 0` and
`dropNeed(){return upgOn('hairtrig')?2:3;}` (runtime.js:1325-1326). `build()` now
accepts **only** completed star-fed orbits: `if(src!=='orbit'||amount<0.04)return;`
and increments a plain counter to 3 (2 with `EARLY STARFALL`)
(runtime.js:1327-1338). Passive waiting and tapping cannot charge it.

`armDrop` releases on the next quarter beat with audio running; with no
`AudioContext` it calls `startStarfall()` immediately — **muted or unavailable
audio must never block an earned gameplay reward.**

`PAY=32, S16=SPB/4, PAYLEN=PAY*(SPB/2), PAYREST=0` at 104 BPM
(runtime.js:858, 905) — so the phrase is 32 × 0.2885 s = **9.23 s**, which is the
number every player-facing channel quotes. `PAY = 2 × STEPS` is load-bearing:
`MU.step` returns to 0 exactly as the section ends, so the chord walk stays
aligned and the seam lands on a downbeat.

`tryLand()` is an empty function — *"Retired: a reward never asks for a different
tap"* (runtime.js:1339). No landing countdown, no perfect-tap bonus, no temporary
music control.

## The chorus collapse, and the fix that was rejected

With drops rarer, chorus bars fell from 26% to **10%** and the verse rose to 62% —
because `t < MU.glow`, the payoff afterglow, had quietly been almost the only road
in. Trading "the payoff hook over and over" for "the verse loop over and over" is
the same complaint one table along.

**The first fix tried was a form clock** that lifted the record on its own after
sixteen bars. `musiccheck.mjs` rejected it in one line — *"the chorus engaged at
heat 0 — the lift is free"* — and it was right: a chorus nobody earns is
wallpaper, and the harness holds that at heat 0 a level voices its verse row and
nothing else, forever.

What shipped keeps entry earned and changes which earning counts and how long it
lasts (runtime.js:1635-1662):

- **`G.lapStreak` joins the hot set.** A clean orbit is the other thing this game
  measures skill with, and it is *sustainable* where `PLAY.heat` is not: heat is
  +0.26 a tap against 0.34/s of decay, so it spikes and collapses, and only
  frantic input holds it — the exact behaviour the saucer exists to discourage.
  The player who travels gets the song, not the player who mashes.
- **`CHOR_HOLD = 12` bars** (runtime.js:3482): an earned chorus holds twelve bars
  after the hot state lapses instead of settling at the next seam, so a lift lasts
  long enough to be a section rather than a flicker. Two harness windows measured
  9 and 5 bars and had to grow past the hold; they read `CHOR_HOLD` out of the
  game rather than copying it.
- The hot set as shipped: `G.od>0 || G.hyper>0 || t<MU.glow || G.groove>=4 ||
  G.lapStreak>=2 || PLAY.heat>0.50`, and only at `i===0 && MU.barN>=8` — the first
  eight bars of a level are always the verse, because the song states its home
  before it leaves it.

**The hook has three readings.** Cutting the frequency fixed how often it was
heard and did nothing about bars 0, 1 and 7 being note-for-note identical on every
section a run ever played. The statement rotates on a three-cycle — plain, then
fifth-doubled and dark, then octave-lit — while the tune stays the level's own.
*Three readings of one melody is how an arrangement restates a hook; three
melodies is a medley.*

Where it landed, same six-minute measurement: level 1 → **verse 43%, chorus 30%,
payoff 27%, mean gap 56.3s**. Level 4: 54/19/27 at 58.0s. Level 6: 55/29/16 at
65.8s.

## The hush, and the rule it generalised

Measured on the shipped build, the drop's "hush" was **−0.1 dB against an ordinary
bar**. `musicStep`'s `if(hush)return` stopped *scheduling* notes, but the pad is a
bank of continuously running oscillators whose gain lives in `bedTick`, so it
played straight through and filled the hole completely. The riser hat also sat
above the guard and fired at the loudest gain of any hat in the game, inside the
silence. The drop then landed +2.9 dB on a phone speaker — barely the threshold at
which a human notices a level change.

*None of that is fixed by turning the drop up; peak was already 0.97. It is fixed
by taking everything else away first. Loudness by contrast is free.*

**`bedTick` is the only writer of `BED.g`.** That single sentence is the generalised
rule, and `musiccheck.mjs:1319-1337` calls it "the one that has shipped wrong
twice": the drop's hush and then the black hole both shipped with the band playing
straight through the thing that was supposed to have replaced it. The hypernova is
the inverse case — it should sound *bigger*, not quieter — and fails the same way,
so the harness asserts the pad actually lifts (`hot > cold * 1.05`).
