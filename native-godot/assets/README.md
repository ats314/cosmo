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
* **	ex-<name>.png** — Scrolling UV flow maps and cylindrical textures (	ex-stellar-stream.png, ufo-tractor-beam.png).

---

## 3. Asset Registry

### Models (ssets/models/)
| File | Geometry | Description |
| :--- | :--- | :--- |
| ccretion-bridge-curved.obj | 325 verts / 256 quads | 64-step logarithmic spiral ribbon linking background to singularity |
| celestial-planet-ringed.obj | 841 verts / 748 quads | 3D Gas Giant sphere with concentric equatorial ring disc |
| ufo-saucer.obj | 448 verts / 416 quads | 32-segment rotational lathe flying saucer with cockpit dome & bevels |

### Sprites (ssets/sprites/) — All 512×512, 32-bit RGBA, unmultiplied alpha
* comet-core.png — Player comet nucleus with aerodynamic energy wings.
* hazard-shard.png — Jagged dark ruby crystal with crimson-orange cutting bevels.
* hazard-drifter.png — Arrowhead directional red gemstone.
* hazard-blinker.png — Symmetrical hollow mechanical shutter iris.
* power-magnet.png — Translucent cyan horseshoe core with magnetic flux lines.
* power-shield.png — Spherical electrostatic kinetic aegis bubble.
* power-slow.png — Chrono-dilating hourglass with celestial event horizon rings.
* power-nova.png — Starburst nova core with expanding coronal ring.
* star-gold.png — Beveled four-point star gem with golden flare motes.
* ufo-saucer.png — High-tech titanium extraterrestrial harvester ship with cyan conduits.

### Textures & Flow Maps (ssets/textures/)
* 	ex-stellar-stream.png (512×1024) — Seamless vertical plasma flow texture for 	idal_bridge.gdshader.
* ufo-tractor-beam.png (576×1024) — Volumetric cyan abduction ray with harmonic wave rings.

### Particles (ssets/particles/)
* x-soft-glow.png (256×256) — Gaussian radial glow core for comet halo.
* x-spark.png (256×256) — Four-point chromatic spark for star collections and collisions.
* x-frost-crystal.png (256×256) — 6-point ice snowflake for Cryo Moon tidal siphon wake.
* x-solar-plasma.png (256×256) — Incandescent solar prominence flare for Molten Star siphon wake.
* x-alien-shockwave.png (512×512) — Concentric EMP plasma shockwave for UFO tether overload.
* 	rail-ribbon.png (512×128) — Horizontal gradient ramp for ribbon trails.

---

## 4. Note on Root .webp Files (Legacy Fallback)
The loose .webp files in ssets/ (power-*.webp, cosmo-wordmark.webp) are legacy 2D sprites copied from the web build (public/art/). They are currently preloaded by spatial_world.gd as fallbacks. 
New features should use the high-resolution 32-bit RGBA PNGs in ssets/sprites/ and ssets/particles/.
