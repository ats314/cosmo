# The render path changed under the rest of this database

*What this answers: `db/INDEX.md` says the database was generated from commit
`8d10559`. The repository is now at `01a3a25`. What in the render path moved,
and which existing records are therefore describing a game that no longer
exists?*

Read this before trusting any pre-existing `code.` record tagged `render`,
`sky` or `gpu`, and before trusting the numbers in `docs/engine/
implementation.md`'s historical section.

## The three commits

```
8d10559  Move Cosmo to Phaser and Capacitor with Gemini worlds …   <- db built here
f13d7c6  Restore living procedural scenery throughout Cosmo
dd9bbaa  Make living worlds respond to flight without flashing
01a3a25  Check star draw positions instead of source formatting     <- HEAD now
```

`src/game/runtime.js` went from 12,272 to 12,335 lines, with 1,207 changed
lines. **Every line anchor above about 8,700 has moved.**

## What was removed outright

| Gone | Was |
|---|---|
| `drawGeminiSky`, `skyArtPlate`, `skyArtImage`, `SKY_ART_WORLDS` | the painted-plate sky that beat the shader in the shipped app |
| `public/art/worlds/*` — all ten plates | 461,098 bytes of shipped world art |
| `G.flash`, `flashHit()` | the rate-limited full-screen white |
| the death impact frame | two or three frames of flat white with the killer silhouetted |
| the bloom's beat pump `bp` | `1 + 0.45*G.beat` on every bloom composite alpha |
| the comet's 24 Hz `FLK` furnace flicker | `SPR.cometHot` scaled by a random table |
| `drawOrbitalRails`' scene-accent stroke | one extra additive ellipse per ring per event |
| `SKY_SWELL`, `SKY_FLOW`, `SKY_RATE` | the old background LFO dials (were already dead) |
| particles and the comet's white inner dot from the bright pass | |

## What was added

| New | Where |
|---|---|
| `materialHue()` / `skyMaterialHue()` — recolour at constant luminance | `9491-9495`, `9724-9728` |
| `SKY_MATERIALS`, `skyTexture`, `glBindSkyMaterials` — three sprites become shader samplers | `9941-9968` |
| nine new uniforms: `uArt uLive uCurrent uPowerFlow uFlight uRelease uNebulaMap uPlanetMap uRingMap` | `9697` |
| `skyAdvanceClock` (`GL.stream`, `GL.currentDir`) and `skyCharge` | `9929-9940` |
| the 36-strand current wake | `10463-10581` |
| `drawCometFins` | `10655-10674` |
| `docs/design/effects-audit.md` | new document |

## The numbers that changed

| constant / quantity | 8d10559 | 01a3a25 | anchor now |
|---|---|---|---|
| `GL_MOTION` | `0.25` | **`1.0`** | `src/game/runtime.js:9458` |
| scene-event attack | `age/0.18` | `age/0.9` | `9766` |
| scene-event release | remainder of span | last `1.2` s | `9766` |
| `scenePulse` span floor / default | `0.35` / `1.8` | `2.4` / `2.4` | `9757` |
| black-hole sky lens gain | `0.13` | `0.36`, plus a `0.34` swirl | `9534-9535` |
| star bloom dot | `10*u` | `8*u` | `9184` |
| shard bloom dot | `11*u` | `7*u` (and blinkers excluded) | `9192` |
| comet bloom | `13*u` + `4.5*u` white | one `10*u` | `9216` |
| hub-lamp bloom | `(9+9*G.dropFx)*u` | `7*u` | `9220` |
| shader nebula crevice term | `0.36+crevice*0.83` | `0.52+crevice*1.06` | `9556` |
| shader limb gain | `1.20+fire*2.7` | `1.36` flat | `9630` |

`SKY_ARENA_CALM` is unchanged at `0.62` (`328`).

**`GL_MOTION = 0.25` is now wrong everywhere it is quoted from memory.**
`CLAUDE.md:117` and `docs/invariants.md` were both updated to `1.0` in the same
commit; `tools/check.mjs`'s doc-staleness guard is what forces that. Any agent
brief, record or note still saying `0.25` predates `f13d7c6`.

## The behavioural rule the three commits encode

From `docs/invariants.md`, graphics section, as it now reads:

> Use motion and material response, not full-field flashes or beat-driven light
> gain; the default must not depend on a reduced-motion toggle.

and

> opaque plates must not replace the living scene.

Both are new sentences. The second is why the ten world plates were deleted:
`docs/art/catalog.json` now carries `published: false` and
`usage: "Reference only. Removed from the game: opaque scenery must not replace
the living procedural system."` on every one of them.

## Consequence for the pre-existing records

`db/records/parts/code-systems.jsonl` holds `code.sky-director`, whose `detail`
still describes `SKY_ART_WORLDS`, `skyArtImage`, `skyArtPlate` and
`drawGeminiSky` as things it owns. `code.gl-sky` carries `GL_MOTION: 0.25` in
`values` and a 14-name uniform list. `code.bloom`'s star/shard/comet dot radii
are the old ones. `code.draw`'s anchor `10555-11218` now spans the end of `currentWakeUpdate`
through the middle of `draw()` instead of `draw()` itself. Those four records are stale in `values`, not
just in line numbers, and `node db/build.mjs --verify` will report the source
hashes have moved.
