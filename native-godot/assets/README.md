# Cosmo Native Godot Assets — Directory Map & Guide

This directory contains all visual, VFX, and 3D assets for the **Godot 4 native tunnel slice**.

---

## 1. Directory Tree & Architecture

`
native-godot/assets/
├── models/          # 3D Meshes (.obj / .glb) used by MeshInstance3D nodes
├── particles/       # 2D/3D Particle textures (GPUParticles3D / CPUParticles2D)
├── sprites/         # 32-bit RGBA sprites (512x512) for pickups, hazards, comet
├── textures/        # UV-mapped flow maps and volumetric textures
├── ASSET_SPEC.md    # Generation prompts and technical specs
└── README.md        # This directory guide
`

---

## 2. Naming Conventions

All assets follow strict semantic prefixes:
* **hazard-<name>.png** — Threats in the tunnel cross-section (hazard-shard.png, hazard-drifter.png, hazard-blinker.png).
* **power-<name>.png** — Lab power-up pickups (power-magnet.png, power-nova.png, power-shield.png, power-slow.png).
* **star-<name>.png** — Collectible stars (star-gold.png).
* **x-<name>.png** — Particle bursts, embers, and shockwaves (x-spark.png, x-soft-glow.png, x-frost-crystal.png, x-solar-plasma.png, x-alien-shockwave.png).
* **	rail-<name>.png** — Ribbon trail gradient ramps (	rail-ribbon.png).
* **fx-<name>.png** — Particle bursts, embers, and shockwaves (fx-spark.png, fx-soft-glow.png, fx-frost-crystal.png, fx-solar-plasma.png, fx-alien-shockwave.png).
* **trail-<name>.png** — Ribbon trail gradient ramps (trail-ribbon.png).
* **tex-<name>.png** — Scrolling UV flow maps and cylindrical textures (tex-stellar-stream.png, ufo-tractor-beam.png).

---

## 3. Asset Registry

### Models (`assets/models/`)
| File | Geometry | Description |
| :--- | :--- | :--- |
| `accretion-bridge-curved.obj` | 325 verts / 256 quads | 64-step curved spiral ribbon linking background to singularity. Normalized $V \in [0, 1]$ path progress, analytic ribbon normals, 0 degenerate triangles. |
| `celestial-planet-ringed.obj` | 754 verts / 748 quads | 3D Gas Giant sphere with concentric equatorial ring disc. 100% outward CCW normals, single poles (0 degenerate triangles), separate `Planet` and `Rings` groups. |
| `ufo-saucer.obj` | 386 verts / 416 quads | 32-segment rotational lathe flying saucer. Single poles (0 degenerate triangles), analytic normals with bevel crease breaks, explicit $U=1.0$ seam wrapping. |

### Sprites (`assets/sprites/`) — All 512×512, 32-bit RGBA, unmultiplied alpha, $\ge 12\%$ outer margin
* `comet-core.png` — Player comet nucleus with aerodynamic energy wings.
* `hazard-shard.png` — Jagged dark ruby crystal with crimson-orange cutting bevels.
* `hazard-drifter.png` — Arrowhead directional red gemstone, normalized ~75% footprint.
* `hazard-blinker.png` — Symmetrical hollow mechanical shutter iris.
* `power-magnet.png` — Translucent cyan horseshoe core with magnetic flux lines.
* `power-shield.png` — Canon mint kinetic aegis bubble (`#7bffc8` / `Color(0.48, 1.0, 0.78)`).
* `power-slow.png` — Chrono-dilating hourglass with celestial event horizon rings.
* `power-nova.png` — Canon cyan-white starburst nova core (`#ffffff` / `#e8f8ff`).
* `star-gold.png` — Beveled four-point star gem with golden flare motes.
* `ufo-saucer.png` — High-tech titanium extraterrestrial harvester ship with cyan conduits.

### Textures & Flow Maps (`assets/textures/`)
* `tex-stellar-stream.png` (512×1024) — Seamless vertical plasma flow texture for `tidal_bridge.gdshader`.
* `ufo-tractor-beam.png` (512×1024) — Power-of-two volumetric cyan abduction ray with harmonic wave rings.

### Particles (`assets/particles/`)
* `fx-soft-glow.png` (256×256) — Gaussian radial glow core for comet halo.
* `fx-spark.png` (256×256) — Four-point chromatic spark for star collections and collisions.
* `fx-frost-crystal.png` (256×256) — 6-point dendritic ice snowflake for Cryo Moon tidal siphon wake.
* `fx-solar-plasma.png` (256×256) — Coronal solar prominence flare with zero-alpha margins.
* `fx-alien-shockwave.png` (512×512) — Concentric EMP plasma shockwave for UFO tether overload.
* `trail-ribbon.png` (512×128) — Horizontal gradient ramp for ribbon trails with feathered zero-alpha edge margins.

---

## 4. Note on Root .webp Files (Legacy Fallback)
The loose `.webp` files in `assets/` (`power-*.webp`, `cosmo-wordmark.webp`) are legacy 2D sprites copied from the web build (`public/art/`). They are currently preloaded by `spatial_world.gd` as fallbacks. 
New features should use the high-resolution 32-bit RGBA PNGs in `assets/sprites/` and `assets/particles/`.
