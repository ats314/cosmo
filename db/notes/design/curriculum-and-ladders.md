# The curriculum rule, and the two ladders it runs on

*What this answers: how Cosmo decides what a player meets and when, why the rule
has been rewritten three times, and why a tier is never called a level.*

## The rule

**Every mechanic is introduced and explained by the end of level 5; the last
level is the exam.** `tools/curriculum.mjs` plays a whole run headlessly and
fails the build if the exam level — read off `LV`, not written down — ever opens
with anything left untaught.

## It has moved three times, always for the same reason

The rule's *number* has been wrong three times because it was written as a
number rather than as a rule.

1. **"By the end of level 2."** Three documents and one code comment said level
   2 while the tier table listed two tiers under level 3 and all three harnesses
   tested `dl <= LV[2].end`. The stale half was corrected rather than
   re-argued: *a rule that disagrees with its own enforcement is worse than no
   rule, because the next reader budgets their design against the wrong
   boundary.*
2. **"By the end of level 3", with level 4 as the exam.** Correct while level 4
   was the only level after the syllabus. The four storm shapes had originally
   unlocked at dl 205–340 with no level 4 to hold them — a level whose banner
   promised "no new tricks" still owed four brand-new tricks, delivered at the
   game's most hostile density. Adding level 4 moved the *exam*, not the
   syllabus.
3. **The six-level rebuild.** With three levels after level 3, the same rule
   meant LIFT OFF through THE STORM taught nine formations in 340
   difficulty-seconds and then EVENT HORIZON, REDSHIFT and HEAT DEATH taught
   nothing for twelve minutes. *A second half that introduces nothing is not an
   exam, it is a plateau* — the exact complaint that produced level 4, restated
   one level on. Owner's call: "complete overhaul from the ground up". DIVERS
   landed at dl 395 (level 4), THE NARROWS at dl 520 (level 5), THE EYE moved
   from dl 340 to dl 610.

**Difficulty is untouched by all of it.** Every pressure term keys off `dl()`,
and none of these moves touches `speedAt`, `shardCap`, `spawnGap` or
`warnTime` — the ladder changes *what* arrives, never *how much*.

### A stale paragraph, still in the file

The header comment above `LV` (`src/game/runtime.js:3030-3037`) still says
*"THIS COMMIT MOVES THE STRUCTURE, NOT YET THE LADDER… all nine formations still
unlock inside dl 0-340 and levels 4, 5 and 6 introduce no new SHAPE at all"*.
That has not been true since DIVERS and THE NARROWS were added: the same file's
`LV` entry for EVENT HORIZON says "DIVERS unlock here, at dl 395" fifty lines
below it, and `TIERS` carries both. The comment describes the game the commit
was on its way to, which is precisely the defect the paragraph *itself* warns
against two sentences later.

## The two new shapes were chosen to close gaps, not to add volume

- Drift moves a shard **along** its ring and nothing moved one **across** rings,
  so **DIVERS** does. It arms on one orbit and transfers 55% of the way through
  its own telegraph — late enough to be news, early enough to answer — and the
  remaining 45% is the lesson: *where it lands is where it kills, and you were
  shown.* Both the lane it leaves and the lane it lands in must be clear at
  placement, or the spawn is rejected outright rather than downgraded. It is
  deliberately level 4's shape because level 4 is the black hole's level and the
  black hole's whole geometry is orbits moving under the player.
- GATES had no mirror: a gate blocks every lane and is answered by a **TAP**, so
  **THE NARROWS** blocks every lane but one and is answered by a **HOP**. Two
  verbs, one wall each, 420 difficulty-seconds apart. The open lane is always
  adjacent to the comet's ring and never the ring it is already on, held to a
  wider clearance (2.2 rad) than the walls (1.7), and it does **not** use the
  gate's `reverseEscape` check because the escape it must guarantee is a lane,
  not an arc.

## The insist rule, and the exam that waits

The curriculum promise was a dice roll at first — a simulated playthrough
reached level 3 with the sliding-gate lesson never shown. Now, while any
unlocked shape's lesson has not landed, that shape (lowest first) **is** the
next spawn: banner first, then specimen after specimen until `firstMeet` finds
its calm beat. Density is untouched — same spawn, different shape — and veterans
never see it run.

Separately, **the exam waits for the lesson**: TWIN is the tier that makes the
hop compulsory and it used to arrive on a pure clock whether or not the player
had ever landed one, which was the direct mechanism of the sub-two-minute first
sessions. `tierIndex()` holds at SECOND RING until the first hop, with a
30-difficulty-second release valve so the hold cannot be farmed, and the valve
firing sets `G.holdTimeout` — the purest "the hop lesson did not land" signal
telemetry has. The clamp lives in `tierIndex()` rather than in the ratchet so
`pickType` and the banner can never disagree about the tier. **The lab is
excluded**, because `dl()` is a constant there and the release valve's
`d - G.holdD >= 30` would be zero forever.

## Ordinals derived by name, not by index

Inserting DIVERS and THE NARROWS moved THE EYE from index 10 to index 12, so
every `G.tier >= 10` in the file silently stopped meaning "the last rung".
`T_VOICE` and `T_SKY` now find their rungs with `TIERS.findIndex(t => t.name ===
…)`, so the next insert costs nothing and a rename fails loudly in `check.mjs`
instead of quietly re-timing the audio ladder. `T_SKY`'s two rungs happened not
to shift this time — and *"happens not to have shifted" is the property that
made the audio ladder's twelve ordinals safe right up until they were not.*

## `featuredTier` walks back to a shape

`pickType()` triples the weight of the newest formation, keyed off the top tier
— but three rungs announce a ring or the exam rather than a shape, so at those
the tripling did nothing. Crossing THIRD RING dropped gates from 60% of the pool
to 33%: *a banner celebrating a new ring that also made the board easier.* The
last rung, whose banner promises "just more of everything", flattened the newest
pair from 33% to 14%. `featuredTier(top)` walks back to the last tier that
carries a `type`.

## A tier is not a level

`TIERS` / `tierIndex()` / `G.tier` is the **unlock ladder**: thirteen rungs
naming what has been introduced. `LV` / `G.level` is the **level**, the 1–6
structure with cards and songs. The unlock ladder is a mechanism; the level is
what the player is told.

The collision has been paid for twice (see `db/notes/design/repeat-failures.md`).
The settled rule: `levelName()` — `LV[G.level-1].name` — feeds the header, the
death screen and the share text; `tierLabel()` speaks **only** in telemetry,
where the rung is the thing wanted. The tier ladder is not hidden and not
deleted: **it speaks by arriving.** A rung landing still fires a gold banner
(gold, not `COL.shard` — the only moment the game announced progress used to be
painted in its failure colour), still names the shape, still teaches it. It just
no longer sits in the corner competing with a different ladder's number.

The death-screen pips count **levels**, one per `LEVEL_MAX`, filled to the one
this run reached. They used to count the ten tiers, which put two ordinals in
one eyeline — and the pip bar had stopped saying anything anyway, because the
curriculum pass had folded every tier into levels 1–2 so it saturated the moment
level 3 opened. *The empty pips are the point as much as the filled ones:* a
player who dies on level 1 can see that more exist, which a bare score can never
tell them.

## The banner subs and the lessons are one string

Each tier banner's `sub` is word-for-word the `MEET` lesson for its formation,
and the death coach reads that same lesson rather than a paraphrase.
`smoke.mjs` fails the build if they drift apart. *Repetition of one sentence
teaches; paraphrase reads as more rules* — which is what "there were like eight
rules" was actually counting.

**Note a live drift.** The unlock table at `docs/design/levels.md:420-433`
quotes twelve lesson sentences and **not one of them is the string the game
ships**. It also still names `blinkers` and `flicker pairs`, which are
`SHUTTERS` and `SHUTTER PAIRS` in `TIERS`. `MECHANICS.md:107` likewise still
quotes *"two at once — swipe to another ring"*. The shipped strings are:

| tier | shipped `sub` / `MEET` string |
|---|---|
| TWIN SHARDS | Two red obstacles: swipe to another ring |
| THIRD RING | Swipe to another ring to reach more stars |
| GATES | A wall blocks every ring; tap to turn around |
| DRIFTERS | This red obstacle moves; tap to turn away |
| SHUTTERS | Pass through the open shape; avoid solid red |
| SLIDING GATES | The wall moves; tap to turn before it reaches you |
| THE SAUCER | Turning triggers its shot; swipe to another ring |
| SHUTTER PAIRS | The shapes take turns opening; pass through the open one |
| DIVERS | It moves to the marked ring; swipe to another ring |
| THE NARROWS | Swipe to the ring with no wall |
| THE EYE | Collect stars and complete orbits to score |

The `smoke.mjs` assertion compares banner to lesson, not either to the prose, and
`check.mjs`'s ledger guard only asks whether `MECHANICS.md` *mentions* a
mechanic — so this drift is invisible to CI by construction.
