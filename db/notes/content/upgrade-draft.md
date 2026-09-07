# The upgrade draft — eleven tiles, five cards

*What this answers: every lab/draft upgrade tile, what it changes and by how
much, how `rollOffer` decides which three you see, and why the draft used to run
dry.*

Source of record: `const UPG` at `src/game/runtime.js:4911-4975`, `rollOffer` at
`src/game/runtime.js:4982-4999`, the pick handler at
`src/game/runtime.js:7302-7312`, and each tile's single `upgOn` call site.

## Upgrades are free

There is no currency. `levelComplete()` (`src/game/runtime.js:3592-3599`) calls
`rollOffer()` when `G.level+1 <= LEVEL_MAX`, the level-complete card draws the
three tiles, and tapping one is the only way past the card
(`src/game/runtime.js:7302-7304` returns on a miss). The **cost is the choice**:
one of three, and a taken tile never returns. With six levels that is five
cards, at the starts of levels 2 through 6.

## The eleven tiles

| `id` | Name | Effect | Reads | Base → upgraded |
|---|---|---|---|---|
| `longstar` | LONGER STAR | hypernova duration | `src/game/runtime.js:8688` | 16 → 24 beats (9.23 s → 13.85 s) |
| `deepbank` | DEEP BANK | starting shields, **additive** | `src/game/runtime.js:6199` | 2 → 3 |
| `slowworld` | SLOW WORLD | slow-mo duration | `src/game/runtime.js:8619` | 6 s → 9 s |
| `richnova` | RICH NOVA | embers per converted shard | `src/game/runtime.js:5216` | 1 → 2 |
| `hairtrig` | EARLY STARFALL | star-fed orbits per Starfall | `src/game/runtime.js:1326` | 3 → 2 |
| `stagelight` | LONG MAGNET | Magnet duration | `src/game/runtime.js:8627` | 10 s → 16 s |
| `longmirror` | LONG MIRROR | mirror duration | `src/game/runtime.js:8641` | 16 → 24 beats |
| `deepburn` | DEEP BURN | scorch paint time | `src/game/runtime.js:8659` | 8 s → 13 s |
| `steadyhand` | STEADY HAND | tight-tap timing window | `src/game/runtime.js:2537` | 0.032 s → 0.045 s |
| `longslip` | LONG SLIPSTREAM | slipstream duration | `src/game/runtime.js:8670` | 12 s → 18 s |
| `longtrail` | LONG STAR TRAIL | star-trail route life | `src/game/runtime.js:5870` | 16 s → 24 s |

Two ids do not say what they do: **`hairtrig` is EARLY STARFALL** and
**`stagelight` is LONG MAGNET** (kept from the retired Spotlight so saved
`G.upg` keys survive). `steadyhand` widens `TIGHT`
(`src/game/runtime.js:2516`), the on-beat judgement window — the only tile that
touches an input rather than a reward.

RICH NOVA's second ember walks the same spacing search as the first
(`src/game/runtime.js:5215-5224`), so a doubled wall is a longer necklace, never
two embers stacked on one point.

## Level floors

Only two tiles carry `minLevel`: `longslip` (2) and `longtrail` (3). Both are
tested as `(x.minLevel||1) <= G.level+1` — the level the card is *offering*, not
the level just finished — so a player is never offered an upgrade to an orb they
cannot yet meet.

## The draw

```js
const available = x => (x.minLevel||1) <= G.level+1 && !G.upg[x.id];
let pool = UPG.filter(x => available(x) && !G.offered[x.id]);
for (let k=0;k<3;k++){
  if(!pool.length) pool = UPG.filter(x => available(x) && !pick.includes(x));
  ...
}
```

Taken tiles (`G.upg`) are gone for the run. **Declined tiles (`G.offered`) come
back only once the fresh pool runs thin**, which is the fix for the bug the
comment records: the old filter burned every tile it had ever *offered*, and
five draws × three slots against nine tiles left the level-5 and level-6 cards
drawing from an empty pool — the two levels added most recently were the two the
draft skipped.

`startLab()` clears `G.upg`, `G.offered`, `G.offer` and `G.picks`
(`src/game/runtime.js:6685`): a lab run never reaches a finish line, so the card
the draft hangs off cannot happen.

## Coverage

`tools/check.mjs:99-107` parses the `UPG` literal and fails the build if any id
lacks a live `upgOn('<id>')` call site, matching against a comment-stripped copy
of the source — a dead tile is the failure this guard exists for, and it has
been blind twice (an id-after-name row was invisible to the old regex; a call
site surviving only inside a block comment satisfied the old test).

Only **five of the eleven** tiles are asserted to change anything.
`tools/dropcheck.mjs:207-212` asserts `hairtrig`; `tools/smoke.mjs` asserts
`slowworld` (line 1295), `longslip` (1309), `longtrail` (1320) and `stagelight`
(1374), each by taking the orb again with the flag set and reading the new
duration. Nothing anywhere sets `longstar`, `deepbank`, `richnova`,
`longmirror`, `deepburn` or `steadyhand` — for those six the only guard is
`check.mjs`'s "the id has a call site somewhere" test, which cannot tell a
correct effect from an inverted one.

`tools/check.mjs`'s ledger-drift guard (`tools/check.mjs:314-341`) checks the
`TIERS` and `LAB_ORBS` names against `MECHANICS.md`. It does **not** check `UPG`
names — all eleven happen to appear in the ledger's upgrade-draft row today, but
nothing keeps them there.
