# The rules a Cosmo lesson has to pass

**What this answers:** why particular teaching sentences were rejected, and the
generalised rule each rejection produced.

The governing rule, in `CLAUDE.md` and `docs/invariants.md`: *a lesson may only
reference actions and objects the game actually has*, and *every instruction must
name a real action and its observable result*. Checking against the code cannot
catch a violation — the code will happily support a true statement about something
the player can never attempt.

## The game has exactly two verbs and no aimed movement

The comet travels a fixed circle at a fixed speed. There is turning around and
there is changing ring. There is no positioning, no threading, no stopping, no
aiming. Every wording failure below is a sentence that imported a manoeuvre from a
genre this game is not.

**The twin lesson took three attempts, and the first two failed for the same
reason.** Owner, on the shipped build: *"it makes no sense and I'm not getting the
feeling you actually understand why."*

- Attempt 1 invoked **outrunning**. Diagnosed as an accuracy bug and "fixed" by
  noting the comet has one fixed speed.
- Attempt 2 invoked **fitting through the gap between them**. Diagnosed as an
  accuracy bug and "fixed" by measuring the gap: 38 visible pixels on the outer
  ring.
- Both diagnoses asked whether the claim was *accurate*. That was the wrong frame,
  which is why the second attempt was no better than the first. The player was
  never trying to go between them and has no way to; the sentence reads as a
  non-sequitur because it is one.

What survives is what the game actually has: a count and a verb. The current
`MEET.twin` is `'Two red obstacles: swipe to another ring'` (runtime.js:5465).

## The same defect, found in nine more places

- **`red costs a shield — get out of its way`.** There is no getting out of the
  way. Now: `'Red hits cost a shield; tap to turn or swipe rings'`
  (runtime.js:5453) — it names both verbs because this is the sentence where the
  player most needs to know what their options are.
- **DRIFTERS: *"these ones chase you"* and *"keep moving"*.** A drifter is given
  one fixed random heading well under player speed and never steers — the spawn
  code's own comment says so — and there is no input in this game that stops you.
  Both halves named a behaviour the player would then watch not happen. Now:
  `'This red obstacle moves; tap to turn away'` (runtime.js:5471).
- **THIRD RING: *"faster and higher"*.** Two claims, neither true: angular speed
  is identical on every ring (one `G.speed`, no radius term) and an ember pays the
  same wherever taken. The filter lift is the real reward — `RINGS[].lift` climbs
  0/380/820 going in — so the banner names what the player can hear
  (runtime.js:4634-4638).
- **THE SAUCER: not *"shake it"*, not *"outrun it"*, not *"get past it"*.**
  Trigger, effect, counter-move, in the game's own nouns
  (runtime.js:5474-5481).
- **`this one slows everything down` / `this one turns every red into a star`.**
  "This one" names nothing, in a loop whose third row names its object. The
  powerup lab copies these strings verbatim by design, so it inherited the
  vagueness.
- **`play well — you're building toward a beat drop`.** The only rung in the
  ladder that asked for something a player cannot perform.

## Three sentences that were false rather than vague

- **"red kills you"** — false for the first two hits of every run, because every
  run starts with two shields and the level 1 card says so twenty seconds earlier.
  A playtester hit "a ton of reds" before dying and concluded he had misread
  something. He had not. All four channels now say the shield sentence; the lethal
  half is taught where it becomes true, by the `LAST SHIELD — RED KILLS NOW` popup
  (runtime.js:5439-5444). `smoke.mjs` forbids any lesson from claiming red kills
  outright.
- **`SPOTLIGHT ×2` doubled nothing** — three strings asserted it while the orb's
  entire effect inventory was a flat +8 on a tight tap, a performer gain and a bed
  duck.
- **FLICKER PAIRS promised *"only one is ever solid"*** while the pair ran at
  `armed()`'s 0.55 duty, so both halves were armed for 10% of every cycle. **The
  sentence was the good design, so the mechanic moved to meet it**: pairs run at
  duty 0.5 and strictly alternate. `smoke.mjs` walks a full period and fails the
  build on a single frame where both or neither is armed.

## One sentence per idea, repeated verbatim

Each tier banner's `sub` is word-for-word the `MEET` lesson for its formation, and
the death coach reads that same lesson rather than a paraphrase. Before that there
were four hand-written special cases sitting above a fallback that already did it,
so a gate death said *"gates want you to turn back"* while the banner said *"every
ring blocked"* and the lesson said *"every ring is blocked"* — and the player was
left to notice those were one rule and not three. **Repetition of one sentence
teaches; paraphrase reads as more rules**, which is what *"initially I felt like
there were like eight rules"* was actually counting. `smoke.mjs` asserts banner
and lesson are identical (runtime.js:5432-5437).

## Each counter names itself with the label the HUD prints

`COMBO ×N`, `ON BEAT ×N`, `CLEAN ORBITS · N`. Lessons that taught "the chain
climbs" while the HUD said ON BEAT, or "chain stars" while the HUD said COMBO,
were teaching a third rule (runtime.js:5551-5559). The house style makes the
symbol carry the distinction: `NOUN ×N` is a multiplier, `NOUN · N` is a count or
a clock (runtime.js:133-161).

Other corrections in the same family:

| was | now | because |
|---|---|---|
| the **gold** star | the **pink** star, then HYPERNOVA leading | `COL.hyper` is `#ff4fd8`; gold is the ordinary embers' colour, so the identifying sentence sent players hunting the most common object on screen |
| SHIELDS FULL — **everything** pays double | **stars** pay double | the orbit payout, up to 86, is untouched |
| combo — each star pays more than the last | up to **+6** each | the combo caps at 6 and the lesson fires at 3 |
| red starts arriving in **shapes** | red starts **blocking whole rings** | twins unlock at dl 18, inside level 1 |
| next sound: X at **level 7 / 10** | next sound: X — keep climbing | those are tier rungs, which the player is never told as numbers |
| LAPS **×**7 | CLEAN ORBITS · 7 | the streak bonus is additive and saturates at five laps |

## One name per object, in every channel at once

HYPERNOVA shipped as "the pink star" in one channel and HYPERNOVA in the rest —
renamed mid-encounter on its own guaranteed introduction. The house-style rule is
that a thing has one name and that name appears everywhere
(runtime.js:5505-5509).
