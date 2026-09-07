# The two sprite caches, and the twelve bakes nothing draws

*What this answers: Cosmo bakes canvas sprites so `shadowBlur` and radial
gradients are paid once. There are two independent caches with overlapping
jobs — which one owns which object, and what is left over?*

Anchors are `src/game/runtime.js` at commit `01a3a25`.

## Cache 1 — `SPR`, baked in `buildSprites`

`SPR` (`242`) is filled by `buildSprites(bandOnly)` (`372-604`), called from
`resize` (`660`) whenever `u`, `DPR`, `W`, `H` or `skyI` moved. `bandOnly` is
an early return: scene colour is procedural now, so a palette change needs no
re-bake.

`makeSprite(half, fn)` (`352-361`) allocates a `ceil(half*2)`-square canvas at
`DPR`, sets a DPR transform and translates to the centre, so `fn` draws in
centred CSS pixels. `blit(sp,x,y,scale,rot,alpha)` (`362-371`) sets alpha
**absolutely** (not multiplicatively) and draws `sp.s*scale` square.

Eighteen sprites are baked. **Six are actually drawn:**

| sprite | baked | drawn by |
|---|---|---|
| `SPR.ember` | `376` | the HUD's ember counters and finale trail markers (`11468`, `11758`, `11784`) — **not** the play-field stars, which come from `artifactSprite('star')` |
| `SPR.cometGlow` | `466` | the comet's additive corona (`11103`) |
| `SPR.comet` | `479` | the comet teardrop (`11129-11131`) and the mirror twin (`11169-11171`), only when the `comet-core` texture is absent |
| `SPR.cometHot` | `551` | the steady hot core (`11133-11137`), only when `comet-core` is absent. The 24 Hz `FLK` flicker table that used to modulate it was deleted: "Heat is expressed by the moving wake, never flicker" (`11132`) |
| `SPR.core` | `541` | the hub lamp (`10742`) |
| `SPR.rim` | `597` | `rimLight` (`8993-9004`), the hub-facing highlight on stars and orbs |

**Twelve are baked on every real resize and never blitted:**

`SPR.shard` (`398`), `SPR.shardDrift` (`420`), `SPR.shardBlink` (`439`),
`SPR.shieldRing` (`492`), `SPR.powShield` (`501`), `SPR.powWarpO` (`506`),
`SPR.powWarpI` (`511`), `SPR.powNova` (`516`), `SPR.powHyper` (`527`),
`SPR.shock` (`564`), `SPR.mote` (`575`), `SPR.pip` (`581`).

`SPR.shock` joined the list at this commit — its only two draw sites were the
"fat" ripple pass, which was removed with the flash and impact-frame work. The
only remaining occurrences of `SPR.powHyper` (`5532`) and a second `SPR.core`
(`586`) are inside comments.

Each is a genuine `shadowBlur`/radial-gradient bake, so this is real work on
every orientation change and DPR change, producing twelve canvases that are
allocated, filled and then only ever released by `runtimeDestroy` (`12318`).
The hazard and orb sprites were superseded by cache 2; `SPR.mote` and
`SPR.pip` belong to the retired dust-mote and conduit-node layers.

## Cache 2 — `artifactBank`, the faceted objects

`artifactBank` (`8761`) is keyed on `u+':'+DPR` and rebuilt lazily per kind by
`artifactSprite(kind)` (`8868-8928`). This is the cache that draws the play
field: stars, all three hazard kin, and every power orb.

`artifactSprite` first looks for supplied art (`8872-8875`):

```js
const artKey={star:'star-gold',shard:'hazard-shard',drifter:'hazard-drifter',
  blinker:'hazard-blinker',shield:'power-shield',warp:'power-slow',
  nova:'power-nova',hyper:'power-hyper',mirror:'power-mirror',
  scorch:'power-scorch',slip:'power-slip',trail:'power-trail',
  blackhole:'power-blackhole'}[kind];
```

If `host.getTexture(artKey)` returns an image, the sprite is that image drawn
at `40*u` (star), `46*u` (the three hazards) or `56*u` (orbs) into a
`34*u`-half canvas (`8877-8880`). Otherwise the procedural faceted path runs
(`8883-8926`).

Two kinds deliberately have **no** art key and always draw procedurally:
`spot` (the magnet — `docs/art/catalog.json` records `power-spotlight` as
retired art that must not be mapped to it) and `saucer`.

The procedural path is a small material system: `artifactMaterials`
(`8762-8774`) gives each kind five face colours, an edge, a dark and an RGB
glow triple; `artifactGlow` (`8788-8794`) lays a three-stop radial;
`artifactFacet` (`8795-8813`) draws a shaded extrusion then lights each
triangular face individually from a hub at `(-1.6,-2.2)`; `artifactGlyph`
(`8814-8867`) stamps the functional symbol over a dark inset.

`drawPow` (`9005`) is the one caller that branches on art directly: the black
hole orb takes the ordinary `artifactPower` path when `power-blackhole` is
loaded (`9006`) and the hand-built dark disc otherwise.

## The one lamp

`rimLight(x,y,scale,al)` (`8993-9004`) blits `SPR.rim` — a 9`u` arc from
`0.72*pi` to `1.28*pi` with a soft shadow — rotated by `atan2(y-cy, x-cx)`,
i.e. the **screen** direction out from the hub, not the parametric ring angle.
With `AY` above 1 those differ by up to eleven degrees at the diagonals.

Falloff is written as a distance against the outermost radius,
`k = clamp(1.18 - 0.86*(d/radiusOf(0)))` (`8999`), never as a ring ordinal —
index 0 is the *outermost* orbit, so `1-ring/nRings` would light the board
backwards and still read as plausible in review.

`artifactStar` (`8929-8939`) and `artifactPower` (`8940-8946`) both call it at
`al*0.3`, each with `pulse = 1` — the old `1 + 0.065*G.beat` / `1 + 0.075*G.beat`
scale pulse and the `artifactGlint` specular cross were both removed with the
rest of the beat-driven light. `artifactShard` (`8947-8972`) does not call it: a shard's own baked bright
face at `-x` is rotated to its ring angle instead. The black hole orb is unlit
on purpose — it is the only object in the game that does not emit.
