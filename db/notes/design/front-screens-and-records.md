# The front screens: what a run may start as, and what it may claim

**What this answers:** why the level picker exists, why the pick is deliberately
not persisted, and the record guard that pays for that freedom.

## The original bug: the menu resumed a device's highest unlock

Shared and borrowed phones kept inheriting a device's unlock, and friends thought
the game had skipped level 1. Every menu tap was made to force level 1 in response.

**That complaint was about a start nobody chose.** So the picker is safe to add
provided nothing remembers the choice.

## The picker

- It appears from a device's **second run**. A fresh device goes from the swipe
  chooser straight to level 1's own card, because "start where?" is not a question
  a player with zero runs can answer — offering EVENT HORIZON and HEAT DEATH to
  someone who has never touched the game was two decisions and four screens before
  their first second of play.
- **One run, however short, opens it**, so the picker's testing purpose survives.
- **All six are selectable on any device**, including levels never reached — the
  screen exists so a level can be reached without playing to it, which is what
  makes testing level 4 possible at all. Rows the device has actually reached are
  marked *reached*, so picked and earned stay visibly different things.
- **The selection is not persisted.** It lives in memory and every page load opens
  on LEVEL 1, so a borrowed phone still begins at LIFT OFF unless the person
  holding it picks otherwise on a screen that names all six.
  `smoke.mjs:806-814` scans the whole store after a pick and fails on any key
  matching `/lvsel|startlevel|:lv$/i` — *"a remembered selection would bring that
  back with the picker as its hiding place."*
- Level 1 for a returning player starts instantly; every other pick goes through
  that level's own intro card first.

## The cost is bounded in exactly one place

`G.startLevel` records the level a run **opened on**, and the level record only
moves for a run that began at level 1:

```
G.newLevel = !LAB.on && G.startLevel===1 && G.level>G.lvlMax;
```
(runtime.js:6432). Choosing EVENT HORIZON and dying on the first shard prints no
FURTHEST YET and writes nothing. A run that started at level 1 and climbed keeps
counting, **including across the retries that put it on a later level**, because
`startLevel` is where the run opened and not where it is now.

`smoke.mjs:822-835` asserts both halves.

**The `!LAB.on` clause is belt as well as braces and is meant to stay.** A lab run
opens on level 1 and its pinned clock never reaches level 1's finish line, so
`G.level>G.lvlMax` is already false on every path today — but the thing that makes
it false is a difficulty constant, and a later session that let the lab pick its
level would silently turn this back on. *State the rule where the rule lives.*

## The record moves at death, not at the finish line

`G.newLevel` is evaluated at the top of `die()`, next to `G.best`
(runtime.js:6408-6433), so the FURTHEST YET badge fires **exactly once** and a
retry of the same level stays quiet. It is measured on `G.level` — the ordinal the
screen actually prints — because it used to be measured on the tier ladder, which
the screen never names: a device whose record was level 3 could die on level 2 at a
deeper tier and be congratulated for getting further.

## The share text carries the qualifier or it is a claim the run did not earn

Two things used to change what "LEVEL 4/4" means — the mode and whether the run was
picked into. With CHILL retired one is left. A default run started at level 1
shares exactly the sentence that shipped; a picked start appends `· from Ln`
(smoke.mjs:836-846). There is **no share button on a lab death**: the share text
has no room to say the run was a sandbox, and a boast the game knows to be false
should not be one tap away.

## The title screen

No longer a picker. What is left is the record line under the title (`BEST ·
LEVEL n · score`, or "no runs yet"), the four-row key, the POWERUP TESTING door and
START. **A tap anywhere begins**, as it did before the mode cards arrived — with no
selection on the screen a stray tap costs nothing, which is the only thing the
select-don't-start rule ever existed to prevent.

The POWERUP TESTING bar **inherited the vacated card slot and that was wrong**:
nothing decided it, the cards were deleted and the bar fell into their position,
which made the door to a developer sandbox the second thing a first-time visitor
read — above the four lines that say what the game is and above the button that
plays it. It hangs off the START pill now, with the key rows taking the band; that
also closed a 119px dead gap. It falls back to the old slot on a viewport with no
room under the button.

## The swipe rule: two coherent rules, neither correct

Playtester, verbatim: *"can you make it so slide up always changes to outer ring
and down to inner? i think that's what my brain wants, so that would make it
easier (for me, definitely)."*

**Away is out** (radial) reads the swipe against the line from the centre through
the comet, so at the bottom of the loop you swipe *down* to go out. **Up is out**
(screen) ignores where the comet is. They agree at the sides of the loop and invert
at the bottom, and which one a person's hand expects is not something the game gets
to decide for them.

The dedicated chooser screen (`G.state==='swipesel'`, still reachable from the
menu's swipe row) runs the real rings and the real `hop()`, because a written
description of the difference does not land. It opens with the comet at the
**bottom of the loop**, the one place the two rules are opposites; opening at the
top would have presented a screen on which both choices look identical. An arrow at
the comet shows where *this* rule says out is right now: under the radial rule it
visibly rotates as the comet travels, under the screen rule it stays pinned upward.

**A brand-new player is no longer asked.** `beginIntro()` sets `SWIPE_MODE='screen'`
and persists it for any device that has not answered (runtime.js:6755-6757), which
is what `direction.md` means by "new players start with screen-relative up/down
swipes" — the playable introduction now owns onboarding and the chooser is a
setting rather than a gate. The module default `SWIPE_MODE='radial'`
(runtime.js:4331) is the value a harness or a mid-session state sees, not what a
fresh player gets. Existing preferences are loaded from `cometloop:swipe` and never
overwritten (runtime.js:3676).

`swipeOut()` is the **only** place either rule is expressed, and both gesture paths
— mid-drag resolution and resolution at lift — call it, so they cannot drift apart
(runtime.js:4343-4349). `smoke.mjs` asserts the two rules agree at the top of the
loop and invert at the bottom; collapsing them to the same expression fails the
build.

Five channels — the menu key, the level 1 card, the SECOND RING banner, the hint
ladder and the death coach — said "swipe up or down", which is the *screen* rule,
while the build was shipping the *radial* one. Every one resolves through
`swipeWords()` at draw time now (runtime.js:4332-4342), so the sentence always
describes the rule in force. Every telemetry event carries `swipe_mode`, because
two control schemes would otherwise average two different games into one
unreadable completion rate.
