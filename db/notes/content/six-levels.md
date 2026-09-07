# The six authored levels

*What this answers: for each of Cosmo's six levels — its dl window, its key, the
sky it opens on, what it introduces, what is guaranteed there, and how it ends.*

Source of record: `const LV` at `src/game/runtime.js:3042-3111`. Every number
below was read there in this session. `docs/design/levels.md` is the prose; where
it disagrees with the table, see `prose-vs-source.md`.

## The table itself

`LV` rows carry exactly four scalar fields — `dl0`, `end`, `name`, `key` — plus a
`mech` array (see "the card", below).

| # | name | dl0 | end | key ratio |
|---|---|---|---|---|
| 1 | LIFT OFF | 0 | 90 | 1 |
| 2 | INTO THE RINGS | 90 | 215 | 0.8909 |
| 3 | THE STORM | 215 | 340 | 0.7937 |
| 4 | EVENT HORIZON | 340 | 470 | 0.7071 |
| 5 | REDSHIFT | 470 | 610 | 0.6300 |
| 6 | HEAT DEATH | 610 | Infinity | 0.5612 |

`LEVEL_MAX = LV.length` (`src/game/runtime.js:3115`), declared immediately after
the table so `loadPrefs` can clamp `cometloop:gl` against it.

`key` is a frequency ratio, not a note name. The whole-tone descent
A-G-F-Eb-Db-B that `docs/design/levels.md` describes is these six ratios; the
sixth is 0.5612, one whole step above 0.5, so a seventh level would be A an
octave down. `LV[].key` scales the SFX pentatonic, which is why every keyed
sound in the game — including a saucer's shot — transposes with the level.

## The difficulty clock is re-based per level

`dl()` (`src/game/runtime.js:4431-4450`):

```
base = LV[(G.level||1)-1].dl0
a    = (age() + min(G.diff*0.22, 40)) * MD().clock
return base + (a < 80 ? a*0.55 : 44 + (a-80))
```

Each level **re-runs the gentle opening ramp from its own floor**. A level's own
elapsed difficulty is `dl() - LV[n-1].dl0`, and every value in the tier ladder is
an absolute position on this rebased clock. A run picked into level 5 begins at
dl 470, not dl 0 — which is what makes the level picker a real testing tool.

In the lab, `dl()` returns the constant `LAB_DL = 40`
(`src/game/runtime.js:3227`, read at `4419`), so no level can finish and no tier
can arrive.

## How a level ends

`update()` at `src/game/runtime.js:7929-7983`:

- `lvEnd = LV[G.level-1].end`. The whole block is skipped when `lvEnd >= 1e9`,
  which is exactly HEAT DEATH — **level 6 has no finish line and no star dive**.
- With no WebAudio (`!AC || !MU`), the level simply completes when
  `dl() >= lvEnd`.
- With audio, the finale (star dive) latches at `dl() >= lvEnd - 10`, gated on
  `!FIN.on && !FIN.done && !starfallActive() && MU.pay<=0 && !MU.rise` — so a
  live beat-drop payoff defers the latch while dl keeps running.
- The finale lays 11 trail stars, cadence `[4,3,2,4,3,2,1,3,2,1,0]`, four on
  ring 0, four on ring 1, three on ring 2, spaced 0.55 rad from
  `G.angle + dir*0.9`, plus a separate finish sun at index 11 that only blooms
  once the melody is nearly gathered. Only diving the sun completes the level.
- Its banner is `COLLECT THE STARS` under the eyebrow `LEVEL END`, deliberately
  not "UNLOCKED" — nothing is unlocked on this path.

`levelComplete()` (`src/game/runtime.js:3626-3669`) sets `G.state='lvend'`,
`G.lvCard={done:true,next:G.level+1}`, rolls an upgrade offer only if
`G.level+1 <= LEVEL_MAX`, and carries score, orbits, lands, streak, groove and
time forward. The deepest-level record is **not** written here — it moves at
death beside `G.best`, so FURTHEST YET can fire exactly once.

## The level card

One draw site: `src/game/runtime.js:11942-12004`, state `'lvend'`. It serves
three situations through one `G.lvCard = {done, next}`:

- after a clear (`done:true`) — "LEVEL n COMPLETE", score so far, then either
  the three upgrade tiles or the next level's name;
- a picked start (`startFromSelect`, `src/game/runtime.js:6894`) —
  `{done:false, next:n}`;
- a retry on level 2+ (`retry`, `src/game/runtime.js:6641`) —
  `{done:false, next:G.level}`, so a death re-reads that level's own card.

Level 1's card shows only when `!G.runs` (a first-ever run) or when level 1 is
picked; a returning player's level-1 start and retry are instant.

**The `mech` rows are almost entirely dead.** `LV[].mech` is read in exactly one
expression in the whole repository:

```js
const tip = n===1 ? 'Learn the controls as you play.'
                  : (L.mech[0] && L.mech[0][1]) || 'Collect stars and avoid red obstacles.';
```

(`src/game/runtime.js:11997`; a repo-wide grep for `mech` finds no other reader
in `src/` or `tools/`.) So level 1's three rows never render at all, every
level's second and third rows never render, and the icon keys (`'tap'`,
`'swipe'`, `'shard'`, `'beat'`, `'star'`, `'warp'`) are unread. The comment on
`LV[0].mech[1]` — `['swipe', null]` with "null = resolved at draw time by
swipeWords()" (`src/game/runtime.js:3059`) — describes a resolution no draw site
performs. The comment above `LV` says "The card lines below are checked against
MECHANICS.md — update both together"; `tools/check.mjs` does check `TIERS` and
`LAB_ORBS` names against the ledger, but nothing checks `mech`.

## Which sky each level opens on

`LEVEL_HOME = [0,1,2,3,4,7]` (`src/game/runtime.js:325`) indexes `WORLDS`
(`src/game/runtime.js:265-289`), whose order is:

`0 DRIFT · 1 TIDE · 2 DUSTLANE · 3 GLASS · 4 EMBERFALL · 5 VEIL · 6 GRID · 7 DEEPFIELD`

so the six homes are DRIFT, TIDE, DUSTLANE, GLASS, EMBERFALL, DEEPFIELD. It is a
**floor**, not an assignment: `startGame` does
`G.skyW = Math.max(G.skyW, LEVEL_HOME[min(len-1, G.level-1)])`
(`src/game/runtime.js:6172`), and the journey is bought with orbits
(`ORB_PER_WORLD = 7`, trickle `ORB_WORLD_SECS = 150`,
`src/game/runtime.js:303`). A player who orbits hard on level 2 can arrive at
level 3 already past DUSTLANE and keeps it. VEIL and GRID are deliberately not
homes — they are travelled *through* between REDSHIFT and HEAT DEATH.

The inline comment beside the array reads `/* DRIFT TIDE VEIL GLASS EMBERFALL
DEEPFIELD */`, naming VEIL where index 2 is DUSTLANE. The long comment above it,
and the array itself, say DUSTLANE.

`skyI` (the four-row `SKY_BANDS` palette) is a separate thing and is clamped:
`skyI = min(3, max(G.level-1, ...))` (`src/game/runtime.js:6333`), so levels 4,
5 and 6 all floor at the deepest band.

## What each level introduces

Formations come from `TIERS`, keyed on `dl`. Orbs come from the guarantee ladder
in `spawnPow`, keyed on `G.level`.

| level | formations unlocked in its window | orbs guaranteed there |
|---|---|---|
| 1 (0–90) | SECOND RING dl 12, TWIN SHARDS dl 18, THIRD RING dl 40 | the `POW_INTRO` trio shield -> warp -> nova, once per run |
| 2 (90–215) | GATES 100, DRIFTERS 128, SHUTTERS 165 | hypernova (`hyperPlaced`), slipstream (`slipPlaced`) |
| 3 (215–340) | SLIDING GATES 240, THE SAUCER 275, SHUTTER PAIRS 310 | magnet (`spotPlaced`), star trail (`trailPlaced`); the black hole's 5% roll opens here |
| 4 (340–470) | DIVERS 395 | the mirror (`mirrorPlaced`); the black hole guaranteed to be *offered* |
| 5 (470–610) | THE NARROWS 520 | scorch (`scorchPlaced`) |
| 6 (610–inf) | THE EYE 610 — `type:null`, introduces nothing | none of its own |

## What "guaranteed" means, exactly

`spawnPow` (`src/game/runtime.js:5970-6094`) is an ordered ladder of `else if`
branches: the lab override, the `POW_INTRO` trio (`introN`), the pity shield
(`G.sinceShield>=3`), the level-4 black hole guarantee, the 5% black hole roll,
hypernova (`G.level>=2`), mirror (`>=4`), scorch (`>=5`), spot (`>=3`), slip
(`>=2`), trail (`>=3`), then the weighted `POWPOOL` fallback.

`startGame` pre-spends each flag when its home level is already behind the level
the run opens on (`src/game/runtime.js:6287-6292`):

```js
G.hyperPlaced = G.level>2;  G.spotPlaced   = G.level>3;
G.mirrorPlaced= G.level>4;  G.scorchPlaced = G.level>5;
G.slipPlaced  = G.level>2;  G.trailPlaced  = G.level>3;
```

and only when `!carried` — a level advance keeps whatever the run has already
spent. So a 1→6 climb meets each orb exactly once, on its home level, and a
picked REDSHIFT start owes level 2 nothing.

`bhPlaced` is **not** in that pre-spend list. `G.bhRun` is what survives level
boundaries (`if(!carried) G.bhRun=false`, `src/game/runtime.js:6269`), and the
guarantee branch reads `G.level>=4 && !G.bhRun && !G.bhPlaced && G.t>=G.bhCool
&& !bhActive()`. A run picked straight into HEAT DEATH therefore still gets its
one guaranteed black hole offer, on level 6 — the guarantee is "once per run, on
level 4 or later", not "on level 4".

The `POWPOOL` fallback carries the same floors and renormalises over whatever
passes them (`src/game/runtime.js:6080-6088`): `shield 0.302/1`, `warp 0.185/1`,
`nova 0.143/1`, `spot 0.134/3`, `hyper 0.076/2`, `mirror 0.080/4`,
`scorch 0.080/5`, `slip 0.095/2`, `trail 0.095/3`.

## Where a run starts

`G.startLevel` records the level a run opened on (`src/game/runtime.js:5052`).
The level record only moves when `G.startLevel===1`:
`G.newLevel = !LAB.on && G.startLevel===1 && G.level>G.lvlMax`
(`src/game/runtime.js:6467`). The share text appends `· from Ln` when
`G.startLevel>1` (`src/game/runtime.js:7076`). The picker's selection is not
persisted — `startFromSelect` (`src/game/runtime.js:6880-6895`) sets
`G.level = G.startLevel = n` in memory only, and clears every carry counter so a
picked level 3 does not open holding level 2's score.
