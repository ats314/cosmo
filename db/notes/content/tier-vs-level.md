# The two ladders: `G.tier` is not `G.level`

*What this answers: Cosmo has two ordinals. Which one is a level, which one is
an unlock rung, which surfaces the player sees each of them on, and what breaks
when they are printed side by side.*

Governing prose: `docs/design/ladders.md` ("`G.tier` unlocks; `G.level` is what
the player is told. Never the same word."). Code: `TIERS` / `tierIndex()` /
`tierLabel()` at `src/game/runtime.js:4652-4738`, `4744-4778`, `6987-6990`;
`LV` / `G.level` / `levelName()` at `3008-3077`, `7004-7007`.

## The distinction in one table

| | unlock ladder | level |
|---|---|---|
| table | `TIERS` | `LV` |
| state | `G.tier` | `G.level` |
| length | 13 rungs | 6 levels (`LEVEL_MAX = LV.length`) |
| keyed on | `dl()` — difficulty-seconds | authored structure; advanced by `levelComplete()` |
| named by | `tierLabel()` | `levelName()` |
| the player sees it | as a **banner when a rung lands** | continuously: HUD, death screen, share text, intro card, pips |
| persisted | no | `cometloop:gl` (`G.lvlMax`) |
| telemetry | `tier` | `game_level` / `best_game_level` |

`tierLabel()` iterates down from `G.tier` to the nearest named rung
(`src/game/runtime.js:7021-7024`); `levelName()` returns
`LV[G.level-1].name` (`7004-7007`). Per `docs/design/ladders.md`,
`tierLabel()` now speaks **only in telemetry** — the in-run standing line, the
death-screen subtitle and the share text all print the level's own name.

## Why they were separated

Two collisions, one level apart, both recorded in `docs/design/ladders.md` and
in the comment on THE EYE's row (`src/game/runtime.js:4701-4710`):

1. The tier named `STORM` collided with `LV[2].name === 'THE STORM'`, so every
   level-4 run printed "LEVEL 4 · STORM" seconds after the card said EVENT
   HORIZON. It was renamed to `THE EYE` rather than deleted — `smoke.mjs`
   asserts the last tier's `at` equals the endless level's floor, so removing
   the row fails the build.
2. Renaming was not enough. The header still printed `LEVEL 4 · FLICKER PAIRS` (that rung is called
   SHUTTER PAIRS now)
   while the card, the key and the sky all said EVENT HORIZON, and the black
   hole then arrived carrying EVENT HORIZON as its own eyebrow — four names,
   one situation. The fix was to stop printing two ladders side by side at all.

## The pip bar

`runSummary()` (`src/game/runtime.js:7063-7084`) draws one pip per level:
`for(let i=0;i<LEVEL_MAX;i++) bar += (i<G.level ? '◆' : '◇')`. It used to be a
ten-pip **tier** bar under a headline naming the level, which saturated the
moment level 3 opened. `tools/smoke.mjs:424` asserts
`LEVEL_MAX === LV.length` precisely so the drawn ladder cannot drift back onto
the tier scale, and the FURTHEST YET badge is decided on `G.lvlMax`, the level
record, not on a tier.

## Places the two ladders still touch

They are not independent — the level *floors* things the tier ladder also moves:

- **Pre-climb.** `startGame` for `G.level>=2` (or the lab) runs
  `G.tier = tierIndex()` and then walks `TIERS[0..tier]` raising `G.nRings` to
  the highest `rings` value it finds (`src/game/runtime.js:6312-6323`). The
  climb is silent — the intro card is the announcement.
- **Suppression.** The crossing ratchet refuses to fire inside a finale, a live
  banner, a black hole, a hard lesson's freeze, or a level's last 10
  difficulty-seconds (`src/game/runtime.js:8181-8195`). Any crossing a boundary
  swallows is owned by the next level's silent pre-climb.
- **Sky band.** `skyI = min(3, max(G.level-1, tier-derived band))`
  (`src/game/runtime.js:6334` and `8172`) — the level puts a floor under a
  palette the tier ladder otherwise deepens. Clamped to 3 because `SKY_BANDS`
  has four rows and there are six levels.
- **The hop hold.** `tierIndex()` clamps to rung 1 (SECOND RING) while
  `!G.didHop && G.level < 2 && !LAB.on && G.state==='playing'`, releasing after
  30 difficulty-seconds (`src/game/runtime.js:4796-4803`). The exemption is
  keyed on the **level**, not on a forged `didHop`, so the hop hint, the
  rehearsal and the death coach stay honest about what this run's thumbs did.
- **Ordinal-derived audio/sky rungs.** `T_VOICE` and `T_SKY`
  (`src/game/runtime.js:4749-4761`) are `TIERS.findIndex` lookups by **name**,
  not hardcoded indices, because inserting DIVERS and THE NARROWS moved THE EYE
  from index 10 to index 12 and silently re-timed twelve `G.tier>=10` reads.

## What a difficulty mode may not do

`docs/design/difficulty.md` and the `MODES` comment
(`src/game/runtime.js:3145-3149`) state the rule: orbs and lessons are gated on
`G.level`, tiers on `dl`, so a mode changes how many seconds a run takes to
reach a rung, never which rung. `tools/curriculum.mjs:276-289` enforces it by
comparing `TIERS.map(t=>t.at)`, `LV.map(l=>String(l.end))` and the level a given
dl belongs to across a synthetic mode.
