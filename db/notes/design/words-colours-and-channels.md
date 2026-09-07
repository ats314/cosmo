# The house style: one name, one counter idiom, one colour per meaning

*What this answers: the vocabulary rules Cosmo holds itself to, why they exist,
and the specific sentences and colours that were changed to obey them.*

## The rule that produced the rules

Playtest, verbatim, after six levels: *"the game feels exactly like 50 different
agents have worked on it … very pieced together, not cohesive … my first thought
would be 'ai made this'."* No single feature was wrong. What was wrong is that
each one had brought its own vocabulary, and nothing in the file said what the
vocabulary **was** — so every session invented one more. Three rules, written
down once at `src/game/runtime.js:133`, so the next thing added inherits them
instead of adding a fourth idiom.

1. **One name per thing.** The player is on a LEVEL and the level has a name;
   that name appears on the card, in the header, on the death screen and in the
   share text, and nothing else is printed beside it. The tier ladder is real
   and is not player-facing furniture — *it speaks by arriving.*
2. **One counter idiom.** `NOUN ×N` is a multiplier — COMBO ×3, ON BEAT ×8,
   OVERDRIVE ×2. `NOUN · N` is a count or a clock — SHIELDS · 3, SHIELD USED · 2
   LEFT, CLEAN ORBITS · 3, BLACK HOLE · 12s. The dot is already this file's
   connector everywhere else, so the two symbols carry the whole distinction and
   no label has to spell it out. **A lesson names a counter with the exact
   string the HUD prints for it.**
3. **One colour per meaning, and the list is closed.** cyan = you; gold =
   earned; violet = the music; pink-red = death, and death only; mint = shield;
   white = the peak. Everything past that is an *orb's* identity — magenta
   hypernova, violet-blue black hole, blue mirror, orange scorch — and is spent
   on that orb alone, never on a readout and never on a reward. A new colour
   needs a meaning nothing above already owns.

### The colour rule, applied twice

- **Hypernova was `COL.ember`**, the exact gold of the collectible stars, so "am
  I invincible right now" was signalled in the one colour already meaning
  "points". Every playtester reported not being able to read the state. Magenta
  `#ff4fd8` is the furthest usable hue from the rest of the palette: ember gold
  ~42°, shard red ~352°, hypernova ~318° — far enough from the shard that the
  two never trade places at speed.
- **The mirror is blue and scorch is orange**, and the constraint is what
  chose them. Blue is free and reads as "another one of you". Orange is free and
  is the only honest colour for a burn — deliberately warm-**orange** rather
  than warm-red, because *the invariant that red belongs to death alone is not
  negotiable* and `#ff5d73` is a pink, so the two do not sit in the same family
  at a glance. Verified on a rendered frame, not argued from hex values.

The same rule ran the other way on the tier banner, which used to draw in
`COL.shard` — the shard fill, the danger outline, and the exact colour GAME OVER
prints in. *The only moment the game announced that you had got somewhere was
painted in its failure colour.*

## The lesson law

**A lesson may only reference actions and objects the game actually has.** This
game has no aimed movement: the comet travels a fixed circle at a fixed speed
and there are exactly two verbs, turn around and change ring. There is no
positioning, no threading, no stopping, no aiming — so a sentence about the
space between two objects describes a manoeuvre that does not exist, and reads
as a non-sequitur because it is one. **Checking against the code cannot catch
this**; the code will happily support a true statement about something the
player can never attempt.

Sentences that were changed for it:

| was | why it was wrong |
|---|---|
| *red kills you* (three channels) | False for the first two hits of every run — the level 1 card said so twenty seconds earlier. A playtester hit "a ton of reds" and concluded he had misread something. The lethal half is taught where it becomes true: the LAST SHIELD popup. |
| *red costs a shield — get out of its way* | There is no getting out of the way. There is turning around and there is changing ring. |
| *these ones chase you* / *keep moving* (drifters) | A drifter gets one fixed random heading well under player speed and never steers; and there is no input that stops you moving. Both halves named a behaviour the player would watch not happen. |
| *outrunning* / *fitting through the gap* (twins) | One fixed speed; and no aimed movement. Two "fixes" that both argued about accuracy instead of about whether the manoeuvre exists. |
| *faster and higher* (THIRD RING) | Angular speed is identical on every ring (one `G.speed`, no radius term) and an ember pays the same wherever taken. The real reward is the filter lift — `RINGS[].lift` climbs 0/380/820 — so the banner names what you can hear. |
| *play well — you're building toward a beat drop* | The only rung that asked for something a player cannot perform. Every other rung names an input. |
| *SPOTLIGHT ×2* | Doubled nothing, and under *audio is optional* paid literally zero. |
| *SHIELDS FULL — everything pays double* | The orbit payout, the largest in the game at up to 86, is untouched. It says *stars*. |
| *combo — each star pays more than the last* | The combo caps at 6 and the lesson fires at 3. |
| *next sound: X at level 7 / 10* | Those are tier rungs, which the player is never told as numbers. |
| *LAPS ×7* | The streak bonus is **additive** and saturates at five laps; "orbit" is the one player-facing word for the act. It reads CLEAN ORBITS · 7. |
| *this one slows everything down* / *this one turns every red into a star* | "This one" names nothing, in a loop whose third row names its object. The lab copies these strings verbatim by design, so it inherited the vagueness. |
| every level-clear captioned *UNLOCKED* | Nothing unlocks at the finale: the tier, the ring count and the spawn pool are untouched by the latch. One hardcoded eyebrow served two opposite events; the finale reads FINISH LINE. |

### And once, the mechanic moved to meet the sentence

FLICKER PAIRS (now SHUTTER PAIRS) promised *only one is ever solid*. The pair
was offset half a cycle but ran at `armed()`'s 0.55 duty, so **both halves were
armed for 10% of every cycle**: a player who read the sentence, waited for the
gap and crossed it died doing precisely what they had been told. *The sentence
was the good design, so the mechanic moved* — duty 0.5, strict alternation, and
`smoke.mjs` walks a full period and fails on a single frame where both or
neither is armed.

## One sentence per idea, said the same way three times

Each tier banner's `sub` is word-for-word the `MEET` lesson for its formation,
and the death coach reads that same lesson rather than a paraphrase. It used to
have four hand-written special cases above a fallback that already did this, so
a gate death said *gates want you to turn back* while the banner said *every
ring blocked* and the lesson said *every ring is blocked* — and the player was
left to notice those were one rule and not three. *Repetition of one sentence
teaches; paraphrase reads as more rules*, which is what "initially I felt like
there were like eight rules" was actually counting. A `smoke.mjs` assertion
keeps banner and lesson identical, and another forbids any lesson from claiming
red kills outright.

## One voice, and the queue behind it

Six systems used to write the announcement slot directly, and every write was an
unconditional overwrite: at the mid-game pile-up "NEW LAYER: BASS" could eat
"GOLDEN LAP" while its 13-second window kept running with its only explanation
destroyed. One queue now — `say()` enqueues with a priority and a shelf life,
the pump shows one line at a time with a breath between, and **a message that
expires unshown is dropped rather than shouted late.** `sayNow()` survives only
for the two bar-timed section calls whose whole meaning is the instant they
refer to.

## Teaching channels, and when each may fire

- **Playable introduction** — a first visit enters a safe real run (same comet,
  same handlers) and four short steps advance on a committed turn, a star, a
  full orbit and a completed ring change. Skip is available; *Learn to play*
  reopens it.
- **Tier banners** — one named formation at a time with a short action cue.
- **MEET lessons** — first contact per device. A threat lesson holds the action
  long enough to read one instruction; reward orbs are `soft:1` and get the
  sentence without the ceremony, because *dilation is protection from threats,
  not ceremony for gifts*. The `soft` flag lives in the table so the list cannot
  go stale — it used to be an enumeration naming two orbs that had been cut,
  which ran the survivors through full threat-grade slow-mo.
- **Hint ladder** — one glyph and sentence at a time, cleared the instant the
  player does the thing. It used to stop after run six; every rung is per-run
  now, so a veteran sees each for well under a second and a newcomer gets the
  whole ladder whenever they pick the game up. Each rung carries a small
  animated diagram — *a sentence is the slowest possible way to teach a thumb
  movement* — and the glyph folds the caller's alpha (`ga`) so nothing draws
  brighter than the line it labels.
- **Level cards** — the calm between levels. Level 1's card carries three rows,
  not six: the two verbs and the thing that hurts.
- **Death coach** — one line naming what killed you with its counter-move,
  covering every formation. Twins stamp their formation on both shards, because
  a lone shard cannot say which pairing it came from and twin deaths used to
  report as a plain single.
- **Sound cues** — three, each meaning exactly one thing and never borrowed: a
  rising chord call for a tier banner, a two-note chime for a first-encounter
  lesson, a shimmer up/down when a standing bonus state opens or closes.

**A lesson may be deferred but never spent unread.** `firstMeet` refuses within
9 s of the last lesson, while a lethal shard is armed near the player, while a
fresh banner or payoff card owns the centre, during the hop rehearsal, and
**inside a black hole** — the mode owns the centre slot and a veil over a world
already at 0.42× was screenshotted going dark mid-set-piece. In every case
`seen` is not set, so the next encounter re-offers it. Three bugs used to spend
the once-ever lesson invisibly and all are fixed: a landed hop cancelled any
running lesson (complying with "swipe to another ring" destroyed the sentence
mid-read), the lesson fired *before* the spawn placement loop which can fail
outright on a dense board, and a lesson could run behind a fresh banner.

**A death re-arms the lesson it disproves.** The flags are per-device and
permanent, which meant a player who died to gates on five consecutive runs was
never shown the gate lesson again. Dying to a killer whose lesson was already
spent clears the flag — soft form, no ceremony, capped once per type per device
by `cometloop:seen2`. *The exam failing is evidence the lesson did not land.*

## Which way is out is the player's call

Two coherent rules, neither correct. **Away is out** (radial) reads the swipe
against the line from the centre through the comet, so at the bottom of the loop
you swipe *down* to go out. **Up is out** (screen) ignores where the comet is.
They agree at the sides of the loop and invert at the bottom, and which one a
person's hand expects is not something the game gets to decide.

So it is asked once, on the first tap of a fresh device, on a screen running the
real rings and the real `hop()` — *a written description of the difference does
not land.* The chooser opens with the comet at the **bottom** of the loop, the
one place the two rules are opposites; opening at the top would have presented a
screen on which both choices look identical.

`swipeOut()` is the **only** place either rule is expressed and both gesture
paths call it, so they cannot drift. `smoke.mjs` asserts the two rules agree at
the top of the loop and invert at the bottom — collapsing them to one expression
fails the build. Every sentence about the hop resolves through `swipeWords()` at
draw time, because five channels said "swipe up or down" (the *screen* rule)
while the build shipped the *radial* one. Every telemetry event carries
`swipe_mode`, or two control schemes would silently average two different games.

Note that `beginIntro()` now sets `SWIPE_MODE = 'screen'` for a device that has
never been asked, which matches `docs/design/direction.md`'s "new players start
with screen-relative up/down swipes" — the module default remains `'radial'`.

## Nothing runs off the screen

Announcements, banner subs, the death coach, card rows and menu rows all measure
themselves and shrink to fit before drawing. `fitSz` reserves the fixed
per-character `letterSpacing` the draw adds *after* `measureText`, or a tracked
line still overflows exactly as before.

Two placement bugs did more damage to legibility than any sentence, and both
were invisible to reading because both are arithmetic. The tier banner sat at
`cy - R - 30u` where `R` is the **horizontal** semi-axis and the rings are drawn
with a vertical semi-axis of `R*AY` (`AY` ≈ 1.413 on every shipping phone) — so
"just above the outer ring" was computed 41% short and the banner landed 38–45 px
*inside* the tracks on three viewports. Five expressions read that one wrong
quantity, so they were wrong together and consistently, which is why it read as
a style problem. There is one `arenaTop = cy - R*AY` now. And popups had **no
clamp at all**: `SHIELD USED · 1 LEFT` rendered from x = −99 to x = 135 on a
390 px phone. They shrink to fit and then slide inside the margins — shrinking
alone leaves a line hanging off the edge, sliding alone cannot save a string
wider than the screen.
