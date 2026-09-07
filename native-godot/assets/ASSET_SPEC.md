# Cosmo — Godot 4 Native Asset Specification & Generation Guide

Updated for the **Godot 4 native tunnel vertical slice**.

All assets generated for `native-godot/` must adhere to these technical standards to guarantee optimal performance with Godot's `CanvasItem`, `MultiMeshInstance2D`, `GPUParticles2D`, and 3D billboard rendering pipelines.

---

## 1. Technical Invariants for Godot 4 Importer

1. **True Alpha Transparency**:
   - Every sprite must be a clean 32-bit RGBA PNG.
   - Transparent areas must have `Alpha = 0.0`. Absolutely **no painted checkerboards**, simulated alpha grids, or solid black background fills.
   - Soft glow envelopes must be natural alpha gradients (not opaque white/black blended).
2. **Power-of-Two Dimensions**:
   - Standard pickups & hazards: **512×512** (centered within 76% bounds, reserving 12% padding on all sides to prevent edge clipping in Godot's mipmaps and shader bloom).
   - Core celestials & discs: **1024×1024** or **2048×2048**.
   - Particle & trail ramps: **256×64** or **512×128** horizontal strips.
3. **Tunnel Readability (24px - 32px Scale)**:
   - In the forward-moving tunnel, hazards and pickups approach from deep in the z-axis.
   - Silhouettes must have high geometric contrast and clear internal faceting so a player immediately recognizes a drifter from a shard at a distance.
4. **No Flashing / Eye Safety**:
   - Artwork must rely on rich, saturated material color (e.g., deep pigeon-blood ruby with fiery orange-red bevels; electric cyan with deep violet undertones) rather than blown-out pure white specular blobs.

---

## 2. Updated Asset Generation Prompts

### Asset 1: Magnet Powerup (`sprites/power-magnet.png`)
* **Format**: 512×512 RGBA PNG, true alpha.
* **Role**: Visual representation of star attraction in the tunnel.
* **Prompt**:
  > Isolated game asset icon of an electromagnetic cosmic magnet pickup for space arcade game Cosmo. Futuristic compact horseshoe core crafted from glowing translucent cyan crystalline glass and polished titanium-violet alloy. Curved magnetic flux trails visibly pull three tiny golden four-point star gems inward between the magnetic poles. Crisp, readable silhouette, vivid cyan and magenta edge lighting, restrained ethereal glow, centered at (256, 256) on a completely pure transparent background. No background, no checkerboard pattern, no border, no lettering, no UI frame.

### Asset 2: Shard Hazard (`sprites/hazard-shard.png`)
* **Format**: 512×512 RGBA PNG, true alpha.
* **Role**: Primary stationary/orbiting threat in the tunnel cross-section.
* **Prompt**:
  > Isolated space arcade game obstacle of a lethal red crystal asteroid shard. Compact, jagged, multi-faceted dark ruby crystal with sharp luminous crimson and hot-orange edges, deep dark internal refractions, and subtle glowing fractures running through the rock. Crisp angular silhouette readable at small thumbnail size. Centered at (256, 256) with 15% clear margin on pure transparent background. Zero background, no checkerboard, no labels, no atmospheric haze.

### Asset 3: Drifter Hazard (`sprites/hazard-drifter.png`)
* **Format**: 512×512 RGBA PNG, true alpha.
* **Role**: Sliding/drifting hazard crossing lanes.
* **Prompt**:
  > Isolated space arcade obstacle of a directional drifter crystal. Sleek, sharp arrowhead/chevron-shaped fractured red gemstone crystal pointing distinctly in one direction. Dark obsidian-ruby core with brilliant incandescent red-orange beveled cutting edges, dynamic angular facets, and a faint trailing particulate spark. Centered at (256, 256) on a completely transparent background. Zero background, no simulated transparency pattern, no borders, no text.

### Asset 4: Blinker / Shutter Hazard (`sprites/hazard-blinker.png`)
* **Format**: 512×512 RGBA PNG, true alpha.
* **Role**: Hazard that alternates state mechanically (not through seizure-inducing flashing).
* **Prompt**:
  > Isolated space arcade obstacle of an alien geometric shutter crystal. Symmetrical hollow hexagonal or diamond red gem frame with a clean dark hollow aperture in the center. Hard sci-fi faceted ruby geometry, luminous crimson edges, crisp mechanical crystalline bevels. Centered at (256, 256) on pure transparent background. Absolutely no background, no checkerboard, no UI elements.

### Asset 5: Player Comet Core (`sprites/comet-core.png`)
* **Format**: 512×512 RGBA PNG, true alpha.
* **Role**: Player vessel head.
* **Prompt**:
  > Isolated player sprite of an aerodynamic luminous celestial comet nucleus. Brilliant cyan-white energy core shaped like a streamlined crystalline teardrop with sleek energetic swept-back wings. Radiant electric azure and cerulean energy contours, high interior luminance, smooth transparent glow halo. Centered facing upward at (256, 256) on pure transparent background. No background, no checkerboard, no text.

### Asset 6: Seamless Ribbon Trail Ramp (`particles/trail-ribbon.png`)
* **Format**: 512×128 RGBA PNG, horizontal gradient.
* **Role**: Texture for Godot `Line2D` and `RibbonTrailMesh` wake rendering.
* **Prompt**:
  > Seamless horizontal energy ribbon trail sprite texture. Left side begins with an intense cyan-white core with glowing ethereal energy strands, tapering smoothly to the right into faint deep-violet atmospheric dust, fading to complete 100% transparency at the right edge. Vertical cross-section has sharp central spine and soft fading edges. Pure transparent background.
