# Gemini asset review

Reviewed 2026-09-07. Scope: every asset in `native-godot/assets/`, plus the
original Gemini artwork in `public/art/sprites/`. This covers **45 distinct
assets**: 24 original WebPs, 18 newer PNGs and three OBJ meshes. Eleven loose
WebPs in the native folder are exact copies of files in the original set.
Importer sidecars and Markdown specifications are supporting material.

## Findings that affect the next build

- The new comet, UFO, slow-motion pickup, gold star, shard and two basic glow/
  spark textures are usable for their stated sprite roles. Their painted
  surfaces do not supply the geometry needed for a close, rotating flyby.
- The new Nova is gold and resembles a collectible star at 24px. The new shield
  is blue, while the established shield is green. Preserve these gameplay
  identities when preparing the newer artwork.
- The frost image reads as a generic starburst, the solar-plasma image as five
  petals, and the stellar stream as rigid neon rails. These need different
  material treatment to sell ice, molten matter and an organic tidal bridge.
- All 18 PNGs have real alpha transparency. None showed an opaque checkerboard
  or background rectangle in dark/light composites. Padding and silhouette
  problems are more significant than transparency in this delivery.
- The three meshes have valid indices and modest polygon counts, but no
  supplied normals or material bindings. They need preparation before use.
- At review time, native code uses all 11 original WebP copies and just one
  newer PNG, the soft comet halo. The other 17 PNGs and all three OBJ files
  have no runtime references. The web game currently uses its original 24
  WebPs. Files in the asset directory are not evidence that they appear in play.

The strongest next visual target is a spatial flyby with a convincing body,
materials and attached wake. Use the UFO artwork as a distant view or preview;
prepare the saucer mesh for the close pass. The larger planet needs correct
surface/ring occlusion and a smooth limb. A tidal bridge should follow shared
planet/arena/center anchors so every part moves together. These requirements
apply to both the web and Godot builds.

## All three models

The diagnostic views use the actual mesh data with inspection colors. They
are not screenshots of finished game materials.

| Model | Measured geometry | Verdict and required preparation |
|---|---|---|
| accretion-bridge-curved.obj | 325 vertices, 256 quads, 512 nondegenerate triangles | Useful ribbon layout. Its V coordinate runs 0–12, while the proposed shader fades at 0–1: 232 of 256 quads lie wholly beyond that fade interval. Separate normalized path progress from repeating texture coordinates. Deform it along the shared flight path; give its transparent surface deliberate ordering. |
| celestial-planet-ringed.obj | 841 vertices, 748 quads, 1,432 nondegenerate triangles plus 64 zero-area pole triangles | Useful distant base. Clean the poles, provide normals and separate planet/ring materials, and ensure near/far ring occlusion. Raw sphere triangle cross-products point inward; a usual CCW WebGL loader needs matching winding handling. Godot importer behavior was not rendered, so this is not a claim that Godot necessarily culls the model. A close pass needs a smoother limb. |
| ufo-saucer.obj | 448 vertices, 416 quads, 768 nondegenerate triangles plus 64 zero-area pole triangles | Closest mesh candidate for a small flyby. Clean poles, preserve bevels when generating normals, and repair the U seam: 13 quads interpolate from 0.9688 back to 0 across almost the entire texture. The painted UFO sprite is not a matching surface atlas. |

[Mesh views](C:/COSMO/work/gemini-review/models-contact.png) ·
[Detailed geometry audit](C:/COSMO/work/gemini-review/models-review.md) ·
[Geometry measurements](C:/COSMO/work/gemini-review/models-audit.json)

## All 18 newer PNGs

“Ready” means usable for the limited role described, not an automatic replacement
for the existing game object. “Use with fix” preserves the artwork while
addressing the named issue. “Reference” means it does not yet perform its
advertised visual job.

| File | Verdict | Full-size and 24–32px assessment; role in mobile flybys |
| --- | --- | --- |
| `sprites/comet-core.png` | **Ready** | Clear cyan teardrop and swept wings; recognizable at 24px. Good comet head/billboard attached to a genuinely projected wake. Glow reaches within 9.6% of the sides, below the specification's 12% padding, but edge alpha is zero. It supplies a front-facing image, not rotating hull geometry. |
| `sprites/hazard-blinker.png` | **Use with fix** | Strong red diamond and real hollow aperture remain distinguishable at 24px. Only 3.7–5.9% padding; add room for atlas/mipmap use. The single image depicts one aperture state: show mechanical open/closed states with geometry or a separate state, not brightness flicker. |
| `sprites/hazard-drifter.png` | **Use with fix** | Directional chevron is convincing at full size, but its body occupies only about 52% of the canvas width. At 24px the alpha-over-128 mask contains only 18 pixels, versus 69 for the blinker. Normalize its visible footprint before use; retain direction and collider agreement. Fine trailing fragments disappear at this size. |
| `sprites/hazard-shard.png` | **Ready** | Angular ruby mass, orange cutting edges and dark fractures form a distinct threat silhouette. Facet detail reduces at 24px but the object still reads as a red shard. Suitable billboard/low-detail appearance; faceted 3D mesh still needed for a close rotating pass. |
| `sprites/power-magnet.png` | **Use with fix** | Attractive cyan/violet horseshoe and gold attraction stars at full size. At 24px, flux loops and little stars merge into a cyan ring; 32px is better. Use a simplified distant version emphasizing the open poles, then reveal this detail on approach. |
| `sprites/power-nova.png` | **Use with fix** | Many-point gold burst and circular rings are legible, but the 24px result resembles the gold collectible star. Existing Nova is cyan, so preserve that identity instead of silently adopting gold. The white center and stepped/pixelated rings also need restraint for large flybys. |
| `sprites/power-shield.png` | **Use with fix** | Clear blue faceted hexagonal shield with concentric rings; facets compress into a bright cyan center at 24px. Existing shield identity is green. Retain that color and a simpler distant silhouette; allow more than the current 3.7% outer padding. This is a flat icon, not a spherical volume. |
| `sprites/power-slow.png` | **Ready** | Purple hourglass remains identifiable at 24px despite losing its orbit lines. Good existing-role pickup billboard. Full-resolution rim edges are visibly pixel-stepped, so use it at modest sizes; it is not premium close-up geometry. |
| `sprites/star-gold.png` | **Ready** | Strong gold collectible with four dominant points and four smaller diagonal points. Recognizable at both sizes. Useful distant/ordinary collectible; keep Nova visually separate. Glow padding is only 1.6–2.5%, although outer edge alpha is zero; provide additional atlas space if packed. |
| `sprites/ufo-saucer.png` | **Ready** | Clean, substantially opaque hull and cyan dome; unmistakable saucer profile at 24–32px, while panel details disappear. Useful distant impostor or encounter preview. Its painted viewpoint and lighting cannot support an orbiting camera or close 3D flyby. |
| `particles/fx-alien-shockwave.png` | **Use with fix** | Detailed concentric cyan/violet electric disc; at 24px it reads as a busy portal icon. Use selectively for a larger overload event. Separate the expanding wave from the stationary center/other rings, and limit overlap/white knots; one scaled card makes every ring move together. |
| `particles/fx-frost-crystal.png` | **Reference** | Actual image is a white-centered multi-ray optical flare, not the README's six-point branched ice crystal. At 24px it is a generic white starburst. Near-white opaque pixels occupy 5.2% of the entire image. It does not communicate ice; retain only as a possible restrained generic flare reference. |
| `particles/fx-soft-glow.png` | **Ready** | Neutral white RGB with a smooth radial alpha falloff. Clean tinted halo mask at 24px and full size; edges are fully transparent. Useful on sparse particles/comet glow with bounded opacity. The source appearing white in an RGB-only viewer does not mean it has an opaque background. |
| `particles/fx-solar-plasma.png` | **Reference** | Five smooth yellow petals around a pinched center, reading as a flower/propeller at every inspected size, not solar prominence or flowing plasma. Faint alpha also touches the top edge (14/255). Does not establish molten stream material. |
| `particles/fx-spark.png` | **Ready** | Clean four-point cyan spark with a small bright center and soft halo. Readable at 24px. Useful sparse particle accent; repeated full-size sparkle fields would compete with hazards. Static artwork does not establish any animation's flashing behavior. |
| `particles/trail-ribbon.png` | **Use with fix** | Smooth cyan-to-violet fading strip, 512×128 as specified, but no sharp spine or fine energy strands. Correct as a one-shot head-to-tail mask, not a seamless repeating ribbon: left alpha reaches 255, right alpha is zero. Feather the faint bottom edge (alpha up to 5/255) and use clamp/stretch UVs on actual ribbon geometry. |
| `textures/tex-stellar-stream.png` | **Reference** | Long, rigid magenta/green/gold/white rails surrounded by blue haze. Vertical tiling is nearly seamless, but it reads as a neon cable, not an irregular stellar plasma stream. It is a color/alpha image, not encoded velocity or normal data. A moving bridge needs material breakup and geometry; scrolling these largely constant rails alone conveys little travel. |
| `textures/ufo-tractor-beam.png` | **Use with fix** | Convincing cyan cone illustration with a luminous base and internal rings. At 24px only the cone/base survive. 576×1024 contradicts the power-of-two requirement. Suitable distant billboard after importer/padding decisions; close flybys need a real cone/ribbon and shared endpoints. Repetition gives separate cone stamps, not continuous volume. |

[Sprites, first six](C:/COSMO/work/gemini-review/sprites-contact-1.png) ·
[Sprites, remaining four](C:/COSMO/work/gemini-review/sprites-contact-2.png) ·
[Particles](C:/COSMO/work/gemini-review/particles-contact-1.png) ·
[Textures](C:/COSMO/work/gemini-review/textures-contact-1.png)

The PNGs total 4,585,993 bytes on disk and 16.5 MiB of decoded RGBA pixels
before mipmaps or copies. Seventeen are power-of-two; the tractor beam is
576×1024, a specification mismatch rather than proof that an engine cannot
load it. Six sprite glow footprints have less than the specified 12% margin,
although every sprite's outer edge is transparent.

The stellar stream actually tiles nearly seamlessly along its length; its
rigid material design is the problem. The trail ribbon deliberately fades
from an opaque head to a transparent tail, so it belongs on a clamped/stretched
trail rather than a repeating strip.

[Full raster assessment](C:/COSMO/work/gemini-review/raster-review.md) ·
[Dimensions, alpha, seams and source hashes](C:/COSMO/work/gemini-review/raster-metrics.json)

## All 24 original WebPs

These are the owner's existing Gemini assets and already contribute to the
web game's presentation. All were inspected on dark/light backgrounds and at
24–32px; title and frame artwork were additionally checked at actual UI size.

| File in `public/art/sprites/` | Review |
|---|---|
| comet-core.webp | Clear cyan directional head. Preserve its recognizable orientation and the existing trail attachment if using a different sprite. |
| cosmo-wordmark.webp | Clean, distinctive title mark; already effective at the title screen's actual size. |
| drift-planet.webp | Strong atmospheric limb and readable dark hemisphere. Useful as a billboard or shader paint layer; not an equirectangular texture that can simply wrap a sphere. |
| drift-ring.webp | Fine annular material with good transparency. Suitable for a projected ring plane; its square image is not a seamless repeating strip. |
| fx-plasma-wisp.webp | Neutral striated ribbon material, useful for tinted flow effects. The silhouette alone does not supply a continuous 3D bridge. |
| fx-shock-ring.webp | Clean circular outline. Keep its strength and scale tied to existing events. |
| fx-soft-glow.webp | Clean radial falloff; suitable for halos with bounded brightness. |
| fx-spark.webp | Small directional white spark, readable at particle size. |
| hazard-blinker.webp | Hollow segmented silhouette distinguishes it from solid threats at 24–32px. |
| hazard-drifter.webp | Strong diagonal direction; the narrow silhouette remains distinct at small sizes. |
| hazard-shard.webp | Simple red faceted diamond. More immediately legible at small size than the newer highly fractured crystal. |
| power-blackhole.webp | Dark center, purple rim and gold disc retain a distinctive tiny silhouette. |
| power-hyper.webp | Tall magenta form and gold fins distinguish the pickup. |
| power-mirror.webp | Paired cyan bodies make duplication legible even at small size. |
| power-nova.webp | Cyan starburst is separated in color from collectible gold stars; preserve that distinction. |
| power-scorch.webp | Orange upward arrows remain readable; recognizable fire identity. |
| power-shield.webp | Green shield is distinct from cyan comet, Magnet and other powers. Preserve its color identity when evaluating the new blue shield. |
| power-slip.webp | Clear cyan chevrons communicate direction and motion. |
| power-slow.webp | Purple hourglass remains recognizable at 24px. |
| power-spotlight.webp | Purple source and cone are visually distinct from the other pickup silhouettes. |
| power-trail.webp | Three linked gold stars remain recognizably different from a single collectible. |
| star-gold.webp | Simple four-point collectible retains good contrast and immediate recognition. |
| ui-panel-frame.webp | Clean scalable secondary panel; transparency and restrained border work over the existing sky. Judge at panel size, not at 24px. |
| ui-primary-frame.webp | Clean rounded launch button; the existing title screen demonstrates its contrast and hierarchy. |

[Original artwork, sheet one](C:/COSMO/work/gemini-review/legacy-contact-1.png) ·
[Original artwork, sheet two](C:/COSMO/work/gemini-review/legacy-contact-2.png)

The native folder's wordmark and ten power WebPs passed both byte-for-byte and
SHA-256 comparison against these original web files. Their documentation calls
them fallbacks, but native code currently assigns them directly as its icons.
[Usage and duplicate audit](C:/COSMO/work/gemini-review/usage-review.md)
records each path and source reference.

## Review boundary

No supplied asset, Godot source or game behavior was changed by this review.
The new PNG source hashes were rechecked after inspection. Visual readiness
judgments come from full-size and phone-scale composites; mesh findings come
from parsed geometry and diagnostic projections. They do not establish iPhone
frame rate or final in-game appearance. Claude's ongoing Godot changes may
update the usage findings after this dated snapshot.

The published web checkpoint remains an early depth-and-wake pass:
[flight playtest](https://cosmo-flight-playtest.ats314.chatgpt.site/) and
[original visual comparison](https://cosmo-flight-playtest.ats314.chatgpt.site/?flight=0).
All ten regression checks passed, and the final build's browser check passed.
It is a browser playtest; no signed iPhone application is delivered by that URL.
