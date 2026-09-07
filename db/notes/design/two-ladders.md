# `G.tier` unlocks; `G.level` is what the player is told

**What this answers:** why Cosmo has two ordinals, why only one of them is ever
called a level, and the channel collisions that forced the separation twice.

## The two things

- **`TIERS` / `tierIndex()` / `G.tier`** — the unlock ladder. Thirteen rungs
  keyed to `dl` (difficulty-seconds), naming what has been introduced: SECOND
  RING, TWIN SHARDS, THIRD RING, GATES, DRIFTERS, BLINKERS, SLIDING GATES, THE
  SAUCER, FLICKER PAIRS, DIVERS, THE NARROWS, THE EYE (runtime.js:4626-4713). A
  mechanism.
- **`LV` / `G.level`** — the 1–6 structure with cards, keys, songs and finish
  lines (runtime.js:3008-3077). What the player is told.

## Why the player is told an ordinal at all

A tester made the case, verbatim:

> I just think clearing the board using level tiers might be more rewarding as a
> sense of accomplishment than just trying to get a higher score each time. For
> whatever reason, reaching level "XYZ" seems more memorable and rewarding than
> just a highest score. Levels are more distinct, you know?

A score is a cardinal you cannot repeat from memory; a level is an ordinal you can
say out loud, compare, and come back for. So the level appears under the score in
play, leads the death screen, leads the share text, and persists as
`cometloop:gl`. The empty pips matter as much as the filled ones: a player who
dies on level 1 can see that five more exist, which a bare score can never say.

## Collision one: both ladders called themselves "level"

The death screen printed `LEVEL 2` directly under a ten-pip bar filled to eight,
and **FURTHEST YET was decided on the tier ladder** — the scale the screen never
names — so a device whose record was level 3 could die on level 2 at a deeper tier
and be congratulated for getting further. The pip bar had stopped saying anything
anyway: the curriculum pass folded every tier into levels 1–2, so it saturated the
moment level 3 opened.

Everything the player reads is the level now — six pips, one per level — and the
record moves at **death**, next to `G.best` at the top of `die()` rather than at
the finish line, so the badge fires exactly once and a retry of the same level
stays quiet (runtime.js:6408-6433).

## Collision two: the composite line was worse than the pairing

Not calling itself a level was necessary and not sufficient. The header printed
`LEVEL 4 · FLICKER PAIRS` and the death screen printed `LEVEL 6` over `THE EYE`,
so the permanent line naming where you are named *both* ladders, one of which the
player has never been shown. Playtested: the header said FLICKER PAIRS while the
card that opened the level said EVENT HORIZON, the music was in E♭ because of
EVENT HORIZON, the sky was EVENT HORIZON's — and then the black hole arrived
carrying `EVENT HORIZON` as its own eyebrow. **Four names, one situation.**

An earlier session hit this exact collision and fixed it by renaming the *tier*:
`TIERS[9]` was named `STORM`, which is also `LV[2].name` (`THE STORM`), so every
level-4 run printed `LEVEL 4 · STORM` seconds after the card named the level EVENT
HORIZON. Renamed to `THE EYE` — and it came back one level later, **because the
defect was never the words.** It was printing two ladders side by side and
expecting the player to know which was which.

So `levelName()` returns `LV[G.level-1].name` and feeds the header, the death
screen and the share text. `tierLabel()` now speaks **only in telemetry**, where
the unlock rung is genuinely what you want.

**The tier ladder is not hidden and is not deleted — it speaks by arriving.** A
rung landing still fires a banner, still names the shape, still teaches it, which
is the moment it is news. It just no longer sits in the corner competing with a
different ladder's number.

## Ordinals derived, never written down

Inserting DIVERS and THE NARROWS moved THE EYE from index 10 to index 12, so every
`G.tier>=10` in the file silently stopped meaning "the last rung" and started
meaning "two rungs early". `T_VOICE` and `T_SKY` are now
`TIERS.findIndex(t => t.name === '…')` (runtime.js:4714-4734), so the next insert
costs nothing and a renamed row fails loudly in `check.mjs` rather than quietly
re-timing the audio ladder.

`warnTime()` reads `LV[LEVEL_MAX-2].end` rather than the literal 610 for the same
reason. `check.mjs` reads level 2's finish line positionally (`ends[1]`) rather
than as `max(ends)`, which was the same number only while there were exactly three
levels.

## The banner is gold, not red

A tier announcement drew in `COL.shard` — the shard fill, the danger outline, and
the exact colour `GAME OVER` prints in. The only moment the game announced that
you had got somewhere was painted in its failure colour.

## The newest formation stays featured across ring unlocks

`pickType()` triples the weight of the newest shape, keyed off the top tier — but
three of the thirteen tiers announce a ring or the exam rather than a shape, so at
those the tripling silently did nothing. **Crossing THIRD RING dropped gates from
60% of the spawn pool to 33%**: a banner celebrating a new ring that also made the
board easier. The last rung, whose own banner promises "just more of everything",
flattened flicker pairs from 33% to 14%. `featuredTier()` walks back to the last
tier that carries a shape (runtime.js:4779-4791).
