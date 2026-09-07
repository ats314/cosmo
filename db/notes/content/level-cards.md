# Level cards, the upgrade draft, and the twelve card rows that never render

*What this answers: what a Cosmo level card actually puts on screen, and why
the `mech` rows in the `LV` table are dead data.*

## The table

`LV`, `src/game/runtime.js:3008-3077`. Six rows, each `{dl0, end, name, key, mech}`:

| # | line | name | dl window | `mech` rows as written |
|---|---|---|---|---|
| 1 | 3023 | LIFT OFF | 0–90 | `['tap','Tap to turn around']`, `['swipe',null]`, `['shard','Red hits use shields; no shields means game over']` |
| 2 | 3039 | INTO THE RINGS | 90–215 | `['shard','Tap to turn away from walls']`, `['beat','Swipe to a ring without red obstacles']` |
| 3 | 3045 | THE STORM | 215–340 | `['shard','Tap to turn before a moving wall reaches you']`, `['star','Collect stars, then complete an orbit']` |
| 4 | 3059 | EVENT HORIZON | 340–470 | `['shard','Watch which ring the red obstacle moves to']`, `['warp','Black hole: reach the outer ring at ESCAPE']` |
| 5 | 3070 | REDSHIFT | 470–610 | `['swipe','Swipe to the ring with no wall']`, `['star','Scorch clears red obstacles behind you']` |
| 6 | 3075 | HEAT DEATH | 610–∞ | `['shard','Tap to turn; swipe to a ring without red']`, `['star','Collect stars and complete orbits to score']` |

## What the card actually draws

The `lvend` branch, `src/game/runtime.js:11884-11946`. When the draft is not
offering (`!G.offer.length`), the whole teaching payload is one line
(`:11939`):

```
const tip=n===1?'Learn the controls as you play.':(L.mech[0]&&L.mech[0][1])||'Collect stars and avoid red obstacles.';
```

That is the **only** read of `mech` in the entire repository — verified by
grepping `src/` and `tools/`. Consequences:

* **Level 1's three rows never render.** The `n===1` branch hard-codes
  `Learn the controls as you play.` over them.
* **Every level's second and third row never renders.** Only `mech[0][1]` is
  read.
* **The glyph ids** (`tap`, `swipe`, `shard`, `beat`, `star`, `warp` — the first
  element of each pair) are read by nothing.
* **The `['swipe',null]` row is dead twice over.** Its comment at `:3025` says
  `null = resolved at draw time by swipeWords()`; nothing resolves it, and it
  is the second row of the one level whose rows are overridden anyway.
* Level 2's second row is tagged `beat` — a glyph that draws a beat ring — for
  a sentence about swiping to a clear ring. Harmless only because it is never
  drawn.

So the six level cards teach: `Learn the controls as you play.`, `Tap to turn
away from walls`, `Tap to turn before a moving wall reaches you`, `Watch which
ring the red obstacle moves to`, `Swipe to the ring with no wall`, `Tap to turn;
swipe to a ring without red`. Twelve of the eighteen authored rows are
unreachable.

The rest of the card is the level number, `LEVEL n`, the title-cased level name,
a `Level n-1 complete` eyebrow with the carried score when `card.done`, a
`LEVEL n` launch button and `Tap anywhere to continue`.

## When a card shows

* `levelComplete()` → `G.state='lvend'`, `G.lvCard={done:false,next:G.level}`
  only for `G.level>=2` (`:6608`).
* `startFromSelect()` → a card for any picked level, and for level 1 only on a
  device with no runs (`:6861`).
* `cardDone()` (`:6868-6873`) sets `G.level` and emits `card_shown` with
  `game_level`, `after_clear`, `seconds` and `run_index`.

## The upgrade draft shares the card

`UPG`, `src/game/runtime.js:4911-4975` — **eleven** tiles. `rollOffer()`
(`:4982`) offers three; `available` requires `(x.minLevel||1)<=G.level+1` and
`!G.upg[x.id]`, so taken tiles never repeat and declined ones can return once
the fresh pool thins. When an offer exists the card prints `CHOOSE YOUR UPGRADE`
and the tiles are the only thing that starts the next level.

Tile ids, display names and descriptions as shipped:

| id | name | `d` |
|---|---|---|
| `longstar` | LONGER STAR | Hypernova lasts about 14 seconds |
| `deepbank` | DEEP BANK | Start each level with 3 shields |
| `slowworld` | SLOW WORLD | Slow-mo lasts 9 seconds |
| `richnova` | RICH NOVA | Each cleared red leaves 2 stars |
| `hairtrig` | EARLY STARFALL | Starfall after two star-fed orbits |
| `stagelight` | LONG MAGNET | Magnet attracts nearby stars for 16 seconds |
| `longmirror` | LONG MIRROR | Mirror lasts about 14 seconds |
| `deepburn` | DEEP BURN | Scorch lasts 13 seconds |
| `steadyhand` | STEADY HAND | More forgiving tap timing |
| `longslip` | LONG SLIPSTREAM | Slipstream lasts 18 seconds (`minLevel:2`) |
| `longtrail` | LONG STAR TRAIL | Star trail lasts 24 seconds (`minLevel:3`) |

Two ids no longer match their display name — `hairtrig` prints EARLY STARFALL
and `stagelight` prints LONG MAGNET. `docs/design/teaching.md`'s wiring table
still calls them HAIR TRIGGER and STAGE LIGHT. `tools/check.mjs` fails the build
if any offered id has no `upgOn` call site.
