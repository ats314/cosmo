# Where the level and formation prose disagrees with the source

*What this answers: every place, found by reading both, where
`docs/design/levels.md`, `docs/design/ladders.md`, `MECHANICS.md` or a comment in
`src/game/runtime.js` states something the level/formation tables no longer say.
Source wins in each case unless noted.*

Re-read and re-anchored against `src/game/runtime.js` at commit `01a3a25`
(12,335 lines — the file was 12,272 at `8d10559`, the commit this database was
first built from), plus `tools/check.mjs`, `tools/smoke.mjs`,
`tools/curriculum.mjs`.

Where the tables and the prose **agree**, and it is worth saying so: the six
level windows (dl 0/90/215/340/470/610 with `end:Infinity` on level 6), the
thirteen-rung length of `TIERS`, every tier `at` value, the twin offset
(0.30–0.40 rad), the saucer's 0.55 rad lag / 0.42s beam / 9–15s cooldown, the
diver's 55% transfer point, and THE NARROWS' 2.2-vs-1.7 clearance split are all
stated correctly in `MECHANICS.md`.

## 1. Every one-sentence lesson quoted in the docs is the previous wording

`tools/smoke.mjs:354-356` fails the build if any tier's `sub` differs from its
`MEET[type].t`, so the *code* is internally consistent: banner sub and lesson are
literally the same string. The docs quote an older generation of those strings.

`docs/design/levels.md:420-433` (the "Unlock and its one sentence" table) and
several rows of `MECHANICS.md`:

| dl | quoted in the docs | actual `TIERS[].sub` === `MEET[type].t` |
|---|---|---|
| 12 | "swipe up or down to change ring" | `subFn: swipeWords` — computed, follows the active swipe rule |
| 18 | "two at once — swipe to another ring" | `Two red obstacles: swipe to another ring` |
| 40 | "inside is tighter — the music runs hotter" | `Swipe to another ring to reach more stars` |
| 100 | "every ring is blocked — tap to turn around" | `A wall blocks every ring; tap to turn around` |
| 128 | "it slides — the gap moves with it" | `This red obstacle moves; tap to turn away` |
| 165 | "harmless while dim — cross it then" | `Pass through the open shape; avoid solid red` |
| 240 | "the wall slides — turn around early" | `The wall moves; tap to turn before it reaches you` |
| 275 | "turn back and it blocks your ring — swipe off" | `Turning triggers its shot; swipe to another ring` |
| 310 | "only one is solid — cross the dim one" | `The shapes take turns opening; pass through the open one` |
| 395 | "it changes ring — watch where it lands" | `It moves to the marked ring; swipe to another ring` |
| 520 | "one ring is open — swipe to it" | `Swipe to the ring with no wall` |
| 610 | "no new tricks — just more of everything" | `Collect stars and complete orbits to score` |

This is one systematic rewrite that the docs did not follow, not twelve separate
drifts: the new strings all name a verb the game has (`tap`, `swipe`) and the
observable consequence, per the doctrine in the `MEET` header
(`src/game/runtime.js:5466-5471`). The docs' claim that a banner's `sub` is
"word-for-word the lesson that fires when the shape first spawns" remains **true
in code**; only the sentences they print are stale.

`docs/design/levels.md:418` also says `smoke.mjs` fails the build if banner and
lesson drift apart — correct, that is the assertion above.

## 2. The THIRD RING comment argues for a sentence the row does not carry

`src/game/runtime.js:4656-4660` explains at length that "faster and higher" was
two false claims and that "the honest reward is the one the player can hear"
(`RINGS[].lift` climbing 0/380/820). The row it annotates then reads
`sub:'Swipe to another ring to reach more stars'` — a reward the comment never
mentions. `MECHANICS.md` quotes the comment's version.

## 3. `MECHANICS.md:93-95` describes a `check.mjs` read that no longer exists

> "`check.mjs` reads level 2's finish line positionally (`ends[1]`) rather than
> as `max(ends)`"

`tools/check.mjs:278-286` extracts `ats` and `ends` from the `TIERS` and `LV`
source text and asserts only that tier unlocks are non-decreasing and level
finish lines strictly increase. There is no `ends[1]` anywhere in `tools/`. (Its
`end:\s*(\d+)` regex also cannot match `end:Infinity`, so level 6 is silently
excluded from that check — correct behaviour here, but worth knowing.)

## 4. `LEVEL_HOME`'s inline comment names the wrong world for level 3

`src/game/runtime.js:325`:

```js
const LEVEL_HOME=[0,1,2,3,4,7];   /* DRIFT TIDE VEIL GLASS EMBERFALL DEEPFIELD */
```

`WORLDS[2]` is **DUSTLANE**; VEIL is `WORLDS[5]`. The long comment directly above
the line says "THE STORM opens on DUSTLANE" and explains that VEIL and GRID are
deliberately *not* homes. So the array and the paragraph agree with each other
and the one-line comment beside the array does not.

## 5. Two runtime comments still describe the pre-six-level ladder

- `src/game/runtime.js:4596-4615` — "THE WHOLE LADDER NOW FITS INSIDE LEVELS 1-2
  … They now land inside level 2 (dl 75-190) … and STORM sits exactly on level
  3's floor so the exam begins with nothing left to introduce", with a wall-clock
  spacing table for gates/drifters/blinkers/sliding gates/flicker pairs inside
  level 2. The table twenty lines below it now puts SLIDING GATES at 240, THE
  SAUCER at 275, SHUTTER PAIRS at 310, DIVERS at 395, THE NARROWS at 520 and THE
  EYE at 610 — three of them above dl 340. `docs/design/levels.md:121-155`
  records the rebuild that made this comment obsolete.
- `src/game/runtime.js:4805-4813` (`featuredTier`'s header) — "Three of the
  **ten** tiers announce a ring or a **storm** rather than a shape … `top` lands
  on a `type:null` entry once per run at THIRD RING and once at **STORM**."
  `TIERS` has thirteen entries and the last rung was renamed THE EYE; the count
  of `type:null` rungs is still three, so only the totals and the name are wrong.

Both are comments, not behaviour — `featuredTier` derives its answer from the
table — but `docs/design/levels.md` itself states the rule that "a comment that
describes intentions is the same defect as a rule that disagrees with its
enforcement".

## 6. `LV[].mech` is dead data with a live-sounding comment

The comment above `LV` (`src/game/runtime.js:3040-3041`) says "The card lines
below are checked against MECHANICS.md — update both together", and
`LV[0].mech[1]` is `['swipe', null]` annotated "null = resolved at draw time by
`swipeWords()`".

In fact `mech` is read once, at `src/game/runtime.js:11997`, as
`(L.mech[0] && L.mech[0][1])`, and only when the card's level is not 1. So level
1's three rows never render, every level's rows beyond the first never render,
the `swipeWords()` resolution never happens, and no check compares `mech` to
`MECHANICS.md`. `tools/check.mjs:314-341` checks `TIERS` and `LAB_ORBS` names
against the ledger; `mech` is not in that guard.

## 7. `tools/check.mjs`'s own floor comment undercounts

`tools/check.mjs:326-328`: "Six formations and six orbs ship today", guarding
`if (names.length < 8)`. `TIERS` supplies twelve non-null names and `LAB_ORBS`
supplies ten, so the real count is 22. The guard still works — it is a floor —
but the number in the sentence is two content passes old.

## 8. THE EYE's row claims a harness assertion that does not exist

Two comments on the last tier claim it is pinned by a check:

- `src/game/runtime.js:4712-4713` — "smoke.mjs asserts the last tier's `at`
  equals level 3's finish line, so removing the entry fails the build."
- `src/game/runtime.js:4735-4737` — "THE EYE sits on level 6's floor now rather
  than level 4's … smoke.mjs pins it to the last level's floor, so it cannot be
  appended past."

Neither assertion is in the repository. `tools/smoke.mjs` touches `TIERS` at
`343` (ordering and finiteness), `346` (every type has a `MEET` entry), `354`
(sub matches lesson), `723` (mode invariance) — none of them compares a tier's
`at` to a level boundary. `tools/check.mjs:278-286` only checks ordering, and
`tools/curriculum.mjs:245-246` only checks that `G.tier` has caught up to the
clock. A grep of `tools/` for `THE EYE` returns nothing.

The first comment is doubly stale: it also says "a dl 340 crossing", written
when THE EYE sat at 340. It sits at 610 now, which is level 5's finish line, so
the suppression argument still holds — but on a different boundary than the one
written down.

## 9. Terminology the docs are right about and the code half-keeps

`docs/design/ladders.md` requires that the tier ladder never calls itself a
level. The shipped strings obey it: `levelName()` feeds the HUD, death screen and
share text; `tierLabel()` is telemetry-only. The residue is in comments — the
retired tier name STORM still appears as a *rung* at
`src/game/runtime.js:4602`, `4705`, `4709`, `4807`, `4810`, `6336`, `8173` and
`8199`, in each case describing a rung that is now called THE EYE and sits 270
difficulty-seconds later. (`THE STORM` at `316`, `934`, `1451`, `3023`, `3079`,
`3369` and `3466` is the *level*, and is correct.)

## 10. The SHUTTERS rename moved the game and left three followers behind

`BLINKERS` became **SHUTTERS** and `FLICKER PAIRS` became **SHUTTER PAIRS** in
the effects pass (`f13d7c6`..`01a3a25`), along with both lessons:

| type key | was | is |
|---|---|---|
| `blink` | BLINKERS — *"Pass while dim; bright red costs a shield"* | SHUTTERS — *"Pass through the open shape; avoid solid red"* |
| `blinktwin` | FLICKER PAIRS — *"One flashes red; pass the dim one"* | SHUTTER PAIRS — *"The shapes take turns opening; pass through the open one"* |

The type keys did not change, so every spawn branch, exclusion, `SHAPE_RANK`
entry and death-attribution flag is untouched. What moved with the names:
`TIERS` (`4667`, `4704`), `MEET` (`5506`, `5516`), `T_VOICE`'s `findIndex` on
`'SHUTTERS'` (`4751`), the `MECHANICS.md` rows (128 and 140), and the draw,
which now says danger with *shape* rather than with a toggled halo.

What did **not** move, and matters most:

- `tools/curriculum.mjs:250-259` still expects the banner ladder
  `[… 'BLINKERS', 'SLIDING GATES', 'THE SAUCER', 'FLICKER PAIRS', …]`. The
  ordering check is written as `posOf(x) >= 0 && posOf(x-1) >= 0`, so a name it
  cannot find is silently skipped: two of the eleven rungs dropped out of that
  assertion the moment they were renamed, and the harness still prints OK.
- `docs/design/levels.md` and `docs/design/ladders.md` still print both old
  names, on top of already quoting the previous generation of every lesson.
- `tools/smoke.mjs:361` still comments the strict-alternation test as
  "FLICKER PAIRS", though the test itself is name-free and still passes.

`tools/check.mjs`'s ledger guard passes only because `MECHANICS.md` was updated
in the same commit — it is a substring test on every `TIERS` name, so a rename
that had missed the ledger would have failed the build. That guard is the
reason the ledger is right and the design docs are not: nothing checks them.
