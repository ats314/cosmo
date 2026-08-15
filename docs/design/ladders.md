# The two ladders

*`G.tier` unlocks; `G.level` is what the player is told. Never the same word.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

There are two ordinals inside this game and only one of them is a level.

`TIERS` / `tierIndex()` / `G.tier` is the **unlock ladder**: ten rungs naming
what has been introduced so far — SECOND RING, TWIN SHARDS, GATES, … STORM.
`LV` / `G.level` is the **level**, the 1–3 structure above with the cards and
the songs. The unlock ladder is a mechanism; the level is what the player is
told.

A tester made the case for telling them an ordinal at all:

> I just think clearing the board using level tiers might be more rewarding as
> a sense of accomplishment than just trying to get a higher score each time.
> For whatever reason, reaching level "XYZ" seems more memorable and rewarding
> than just a highest score. Levels are more distinct, you know?

That is right, and the reason is that a score is a cardinal you cannot repeat
from memory while a level is an ordinal you can say out loud, compare against
someone else, and come back for. So the level appears under the score in play,
leads the death screen in ember gold with the current unlock rung named
beneath it, leads the share text, and persists as `cometloop:gl` — "BEST ·
LEVEL 2 · 4300" on the death screen, and **FURTHEST YET** in place of NEW BEST
when a run reaches deeper than the device ever has.

**Both ladders used to call themselves "level" in the same eyeline.** The
death screen printed `LEVEL 2` directly under a ten-pip bar filled to eight,
and FURTHEST YET was decided on the tier ladder — the scale the screen never
names — so a device whose record was level 3 could die on level 2 at a deeper
tier and be congratulated for getting further. The pip bar had stopped saying
anything anyway: the curriculum pass folded every tier into levels 1–2, so it
saturated the moment level 3 opened and stayed full for the rest of an endless
level. Everything the player reads is the level now — three pips, one per
level, filled to the one this run reached — and the record moves at death
beside the high score, so the badge fires exactly once and a retry of the same
level stays quiet. The unlock ladder keeps `tier` and `tierLabel()` and never
calls itself a level again, telemetry included. `smoke.mjs` asserts all of it.

**And then it stopped standing next to the level at all.** Not calling itself
a level was necessary and it was not enough: the header printed
`LEVEL 4 · FLICKER PAIRS` and the death screen printed `LEVEL 6` over
`THE EYE`, so the permanent line naming where you are named *both* ladders,
one of which the player has never been shown. Playtested, the composite was
worse than the pairing: the header said FLICKER PAIRS while the card that
opened the level said EVENT HORIZON, the music was in E♭ because of EVENT
HORIZON, the sky was EVENT HORIZON's — and then the black hole arrived
carrying `EVENT HORIZON` as its own eyebrow. Four names, one situation.

An earlier session hit this exact collision and fixed it by renaming the
*tier* — the note on THE EYE in `TIERS` records it — and it came back one
level later, because the defect was never the words. It was printing two
ladders side by side and expecting the player to know which was which.

So `levelName()` now feeds the header, the death screen and the share text,
and it returns `LV[G.level-1].name`: the same string the level card just
showed, the same string the key and the sky are chosen by. **The tier ladder
is not hidden and is not deleted — it speaks by arriving.** A rung landing
still fires a banner, still names the shape, still teaches it, which is the
moment it is news. It just no longer sits in the corner competing with a
different ladder's number for the rest of the run. `tierLabel()` is still
what telemetry records, because telemetry wants the unlock rung.

The empty pips are the point as much as the filled ones: a player who dies on
level 1 can see that two more exist, which is the one thing a bare score can
never tell them.

None of this touches the simulation. It changes what the game *says* about
itself, not what it does.

### The banner is gold, not red

A tier announcement drew in `COL.shard` —
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
