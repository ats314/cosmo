# Two skies, and what the shader actually composes

*What this answers: Cosmo has a WebGL sky and a CPU fallback that mirrors it.
Which runs when, what is in the composition, and where do the two disagree?*

All anchors are `src/game/runtime.js` at commit `01a3a25`.

**The painted-plate sky is gone.** `drawGeminiSky`, `skyArtPlate`,
`skyArtImage` and `SKY_ART_WORLDS` were deleted, and with them all ten
`public/art/worlds/*.webp` files. `docs/invariants.md` now says "opaque plates
must not replace the living scene". See `db/notes/render/commit-drift.md`.

## The selector

Two lines in `draw()` (`10693-10694`):

```js
if(GL.on){glRender(0);ctx.clearRect(0,0,W,H);}
if(!GL.on)drawCalmSky();
```

`glRender` has exactly one call site — this line. So does `drawCalmSky`. In the
shipped app the shader wins; in every VM harness `glInit` fails against the
stub and the CPU path runs.

## The WebGL sky — `GL_FS` 9460-9673, `glRender` 9969-10006

One full-screen triangle (`glInit:9693` uploads `[-1,-1, 3,-1, -1,3]`), one
fragment shader, **23 uniforms** looked up in one list at `9697`:

```
uRes uCtr uTime uCalm uArc uShape uAccent uPlanet uSurface
uTint uRim uDust uEventTint uArena uArt uLive uCurrent
uPowerFlow uFlight uRelease uNebulaMap uPlanetMap uRingMap
```

`fxcheck.mjs:250-255` asserts every location in `GL.u` is written every frame,
and the recording fake returns `null` for any name the shader does not declare,
so a typo fails rather than silently disabling an effect.

The nine names after `uArena` are new at this commit. What they carry:

| uniform | packed as | from |
|---|---|---|
| `uArt` | `(nebulaReady, planetReady, ringReady)` | `glBindSkyMaterials:9967` |
| `uLive` | `(phrase, travel, pressure)` | `glRender:9982` |
| `uCurrent` | `(turn, hop, radial, dir)` | `9983-9984` |
| `uPowerFlow` | `(magnet, scorch, release, bh)` | `9985-9986` |
| `uFlight` | the comet in screen-height units | `9987` |
| `uRelease` | `(elapsed, wavePeriod)` of a live Starfall, else `(-1, 1)` | `9988-9989` |

`phrase` is `sin(musPos()/STEPS*TAU)` — the arrangement's own position, not a
beat impulse. `travel` is `G.currentFlow.travel` while playing and `GL.stream`
otherwise. `pressure` is `skyCharge()`.

### The composition, in shader order

- **Flight deformation** (`9527-9543`), before anything is sampled. A `pressure`
  bulge, a Starfall `releaseWave` radiating from the planet, the black-hole
  lens `1 + blackhole*amp*0.36*exp(-rr*3)/(rr+0.17)` with a `0.34` swirl, then
  three local terms about the comet: a curl from `uCurrent.x*uCurrent.w`, a
  magnet pull from `uPowerFlow.x`, and a radial shove from a hop. All are gated
  by `influence = exp(-|uv-uFlight|^2*12)`, so they stay local to the comet.
- **Drift**: `(sin(uTime*0.14)*0.014, cos(uTime*0.11)*0.009)` (`9544`) — a
  closed ellipse, so the set of reachable skies is finite and sweepable.
- **Nebula** (`9545-9579`): two-level domain-warped 5-octave `cloud()`
  (lacunarity matrix `[1.64,-1.18;1.18,1.64]`, gain `0.48`, start amplitude
  `0.53`), a `grain` field at x9.2, a `vein` field at x22, gathered into a
  banded `structure` term whose axis, bend, width and reach come from
  `uArc`/`uShape`. `flow = (uLive.y*0.043, -uTime*0.028)` shifts every sample,
  so the cloud volume travels with the player's own orbit direction.
- **The plasma-wisp material** (`9560-9574`), only when `uArt.x > 0.5`: two
  eddying samples of `uNebulaMap` at different scales, added as *light*, edge-
  weighted so it stays outside the play annulus. The procedural volume still
  owns shape and density.
- **Ring belt** (`belt()`, `9496-9516`): an annulus
  `smoothstep(1.16,1.25,r)*(1-smoothstep(1.88,2.13,r))` in planet radii, a
  Cassini-style gap `1 - 0.80*exp(-((r-1.62)/0.033)^2)` and a haze lobe at 1.63
  with sigma 0.38. Drawn twice — far half before the globe at `0.45` occlusion,
  near half after at `0.70` — so the ring visibly crosses in front. When
  `uArt.z > 0.5` it mixes `uRingMap` into the mineral colour at `paint.a*0.42`.
- **Atmosphere before surface** (`9588-9595`):
  `atmo = exp(-|pr-radius|/(radius*0.038))*day` and
  `corona = exp(-|pr-radius|/(radius*0.13))*day`, added before the globe so the
  luminous height reads against space while the opaque globe still hides stars.
- **Globe** (`9597-9635`): sphere normal from the screen disc, an equirect-ish
  map spun by `uTime*0.034 + uLive.z*0.18 + uLive.x*0.024`, warped
  terrain/detail fields, latitude bands mixed against `uSurface.y`, a Lambert
  term smoothstepped over `[-0.11, 0.56]`, a blue night-side term, a limb term
  `pow(1-z,3.5)*pow(max(0,lambert+0.28),1.4)` at a flat `1.36`, an aurora fed
  through `materialHue`, and — when `uArt.y > 0.5` — a `uPlanetMap` sample
  mixed in at `paint.a*(0.30+0.12*(1-uSurface.y))`.
- **Stars** (`9642-9661`): three hashed cell layers at scales 19/36/53,
  threshold `h>0.91`, diffraction cross only above `step(0.985,h)`, multiplied
  by `(1-planetMask)` so no star sits on the opaque world, and *stretched
  radially* by `1+hyper*2` during a hypernova with a `1/stretch` energy
  correction so the streak conserves light.
- **The calm band** (`9662-9664`): `col *= 1 - uCalm*inside*outside*0.38`.
  With `SKY_ARENA_CALM = 0.62` the deepest attenuation in the play annulus is
  23.6 %.
- **Black hole darkening** (`9665-9666`): `eclipse = smoothstep(amp)`, then
  `col *= 1 - blackhole*eclipse*0.62*exp(-rr^2/0.20)`.
- **Tone map** (`9669-9671`): `1 - exp(-col*1.35)`, a +/-0.001 hash dither, and
  a floor of `(0.004,0.006,0.012)` so the frame can never be pure black.

### Events change material, not gain

`materialHue(base, hue, amount)` (`9491-9495`) recolours toward `hue` while
preserving `dot(base, luma)` — a dark part of the cloud stays dark. Every
event path now goes through it: scorch (`9576`), Starfall release (`9579`), the
atmosphere tint (`9594`), the aurora (`9633`). The old
`x(1.0+fire*2.6)`-style multipliers on nebula, atmosphere, belt and limb are
gone. `rendercheck.mjs:287-355` (section 3) enforces it: an earned drop must keep the mean
luma within `[0.84, 1.16]` of the resting field while moving at least `0.20`
cell luma of *shape*.

## The scenic clock

`skyAdvanceClock(M)` (`9929-9935`) integrates `GL.tw += d*GL_MOTION*M.motion`
with **`GL_MOTION = 1.0`** (`9458`) and a per-world `motion` of 0.48-0.80. It
also eases `GL.currentDir` toward `G.dir` and integrates `GL.stream` with it,
which is what makes the cloud field flow the way the comet is travelling. `d`
is a `G.vt` delta, so slow-motion slows the sky and reduced motion freezes it.

## The CPU fallback — `drawCalmSky`, 9813-9928

A line-for-line CPU port. `skyHash`/`skyNoise`/`skyCloud` (`9788-9806`) mirror
the shader's `hash21`/`noise2`/`cloud`; `skyCalm` (`9807-9812`) mirrors the
`uCalm` band from the same `SKY_ARENA_CALM`. It writes a half-resolution
`ImageData` material cache (`W*0.50 x H*0.50`) keyed on `[W, H, G.nRings,
round(skyW*80), floor(GL.tw), round(strength*10), round(charge*10), accentId,
round(radiusOf(0)), round(radiusOf(nRings-1))]` (`9818-9819`), fills `#020306`,
blits the cache up with `imageSmoothingQuality='high'`, then draws the three
star layers at native resolution on top.

**Three places where it does not match the shader**, all read directly:

| term | shader | fallback |
|---|---|---|
| nebula crevice | `0.52 + crevice*1.06` (`9556`) | `0.36 + crevice*0.83` (`9886`) |
| limb gain | `air*limb*1.36` (`9630`) | `air*limb*1.20` (`9896`) |
| black-hole lens | `*0.36` plus a `0.34` swirl (`9534-9535`) | `*0.13`, no swirl (`9843`) |

It also samples **no** art material — there is no `uArt` equivalent, so a
device on the 2D path never sees the plasma wisp, planet or ring maps.
`rendercheck.mjs:357-376` (section 4) bounds only the aggregate mean of DRIFT at clock 5,
to within 16 %.

## The world table

`WORLDS` (`265-289`) is eight rows — DRIFT, TIDE, DUSTLANE, GLASS, EMBERFALL,
VEIL, GRID, DEEPFIELD — each carrying 18 scalars plus three RGB triples
(`tint`, `rim`, `dust`). `skyMix()` (`9729-9741`) lerps the *weights* on the
CPU, so the shader never branches on a world and never evaluates two: a
transition is one field morphing, not a crossfade of two pictures. A world is
held for the first four fifths of its span and morphs over the last fifth
(`x = clamp((fr-0.80)/0.20)`, smoothstepped).

`LEVEL_HOME = [0,1,2,3,4,7]` (`325`) floors each level's opening sky. Because
the floor is a `Math.max` against a journey that never runs backwards, the
table has to climb — an earlier `[0,1,5,3,2,7]` made levels 4 and 5 unreachable
homes. VEIL (5) and GRID (6) are deliberately not homes: they are what a player
travels through by orbiting. `ORB_PER_WORLD = 7` and `ORB_WORLD_SECS = 150`
(`303`): seven completed orbits buy one world, and any 150 seconds of play
advances one on its own.

## Dead state in this region

- `SKY.wake` and `SKY.wakeAmt` are written by `skyWake` (`9773-9776`) and
  `skyStep` (`9782`) and read by nothing. There is no wake uniform and no wake
  term in `drawCalmSky`. The lap's effect on the sky travels entirely through
  `scenePulse('orbit')` to `uAccent`.
- `SKY_BANDS` (`251-259`) — four sky palettes, no colour read from them by any
  draw path. `skyI` (`260`) is still live: it gates the sprite re-bake (`654`)
  and some drum variations in `musicStep` (`2084-2092`).
- `nebulas` (`226-233`), `MOTES` (`236-239`), `bgStars` (`182`, filled at
  `651-652`), `starField`/`buildStarField` (`339-351`, no call site) and
  `RAD_BAKE` (`206`) are all declared or populated and never read.

The line comment above `WORLDS` at `264` still says *"All texture is generated
here; no outside artwork or shader is used"*, which the `SKY_MATERIALS` path
added at this same commit contradicts.
