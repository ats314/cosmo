# How orbs are drawn, and what the HUD says about them

*What this answers: which orbs use authored sprite art and which are drawn
procedurally, why one shipped sprite is never loaded into the game, and which
colour each orb wears in each channel.*

## Sprite art vs. the procedural crystal

`artifactSprite(kind)` (`src/game/runtime.js:8838-8852`) maps a game object kind
to a texture key and bakes a sprite at the current scale:

```js
const artKey={star:'star-gold',shard:'hazard-shard',drifter:'hazard-drifter',
  blinker:'hazard-blinker',
  shield:'power-shield',warp:'power-slow',nova:'power-nova',hyper:'power-hyper',
  mirror:'power-mirror',scorch:'power-scorch',slip:'power-slip',
  trail:'power-trail',blackhole:'power-blackhole'}[kind];
```

**Nine of the ten orbs have art. `spot` — Magnet — is not in the map**, so it
always falls through to the procedural path: a faceted crystal from
`artifactMaterials.spot` (`src/game/runtime.js:8737`) with the
horseshoe-and-poles glyph at `src/game/runtime.js:8800-8808`.

That is deliberate, not an oversight. `docs/art/catalog.json` records for
`power-spotlight.webp`: *"Retired Spotlight art; not the current Magnet. Do not
map to runtime spot."* The consequence is that the file is still listed in
`public/art/manifest.json` and `BootScene` loads **every** manifest texture
(`src/scenes/BootScene.ts:13-16`), so 25.7 KB of retired art is downloaded and
decoded on every boot for a key nothing reads.

`drawPow` (`src/game/runtime.js:8985-9017`) routes everything except the black
hole straight to `artifactPower`; the black hole keeps a hand-drawn fallback —
a flat disc with an edge-on accretion ellipse and a lensing halo that bends
inward — used only when `power-blackhole` is absent. It is the file's only dark
object, and being identifiable before it can be named is the point, because
taking it is a decision.

The same `drawPow` draws the lab picker's row icons
(`src/game/runtime.js:12077`) and the title screen's POWERUP TESTING bar, so the
door to the sandbox shows the orb currently armed behind it.

## Colour per channel — and where it disagrees

| Orb | Pickup burst | Arc flash | HUD chip | Sprite/material |
|---|---|---|---|---|
| shield | `COL.shield` | `COL.shield` | (pips, not a chip) | `power-shield` |
| warp | `COL.warp` | `COL.warp` | `COL.warp` | `power-slow` |
| nova | `COL.nova` + white | `COL.nova` | (instant, no chip) | `power-nova` |
| hyper | white + `COL.ember` | `COL.hyper` | `COL.hyper` | `power-hyper` |
| **spot** | **`#eaf1ff`** | **`COL.warp`** | **`COL.comet`** | violet-white crystal |
| mirror | `COL.mirror` | `COL.mirror` | `COL.mirror` | `power-mirror` |
| scorch | `COL.scorch` | `COL.scorch` | `COL.scorch` | `power-scorch` |
| slip | `COL.comet` | `COL.comet` | `COL.comet` | `power-slip` |
| trail | (ripple only) | `COL.ember` | `COL.ember` | `power-trail` |
| blackhole | — | `COL.bh` | (own banner + label) | `power-blackhole` |

Read at `src/game/runtime.js:8562-8568` (arc flash), the per-orb pickup branches
`8569-8722`, and `drawPowerStatus` at `src/game/runtime.js:11585-11612`.

Two disagreements are real and worth knowing before touching this:

1. **Magnet wears three different colours** — a near-white burst, a violet arc
   flash, and a cyan HUD chip — while its sprite is violet-white. Nothing in the
   file reconciles them.
2. **Magnet and Slipstream share `COL.comet` in the HUD.** Two simultaneously
   possible timers in the same cyan, on the same list.

## The HUD chips

`drawPowerStatus` (`src/game/runtime.js:11585-11612`) draws one row per live
timed reward: label, `ceil(seconds)+'s'`, and a progress bar filled to
`left/duration`. It returns immediately during a black hole or the intro. Star
trail is listed by finding any `s.trail` star and reporting its remaining life,
so the route's countdown is derived from the stars themselves rather than from
a separate timer. On a wide viewport the list sits in the right margin beside
the arena; otherwise it stacks under the header in up to two columns.

There is **no `HYPERNOVA ×2` chip.** `MECHANICS.md` and
`docs/design/powerups.md` both describe one — "the standing 'HYPERNOVA ×2' chip
in the orb's own magenta" — but the only standing hypernova label the code draws
is this timer row, labelled `Hypernova`, with a countdown and no multiplier.
Grep confirms the string exists nowhere in `src/game/runtime.js`; the only
`SPOTLIGHT ×2` / `OVERDRIVE ×2` mentions are in the house-style comment at
`src/game/runtime.js:149` that defines the `NOUN ×N` idiom.
