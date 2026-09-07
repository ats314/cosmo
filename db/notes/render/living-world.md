# The living world: how flight deforms the sky and leaves a wake

*What this answers: commits `f13d7c6` and `dd9bbaa` added a layer that did not
exist before — the scene reacting continuously to what the player is doing,
instead of only to discrete rewards. What is it made of, and what feeds it?*

Anchors are `src/game/runtime.js` at commit `01a3a25`.

The design rule it implements, from `docs/invariants.md`:

> Use motion and material response, not full-field flashes or beat-driven light
> gain; the default must not depend on a reduced-motion toggle.

There are two halves: a **state record** (`G.currentFlow`) that both the shader
and a canvas pass read, and a **36-strand dust wake** (`G.currentWake`) drawn
in world space.

## `G.currentFlow` — nine scalars describing what the comet is doing

Created and zeroed by `currentWakeReset()` (`10463-10475`), called from
`startGame` (`6227`):

| field | meaning | set by |
|---|---|---|
| `turn` | 1 on a committed reverse, decaying over 0.8 s | `currentWakeTurn` (`10479`), from `reverseFX` (`6577`) |
| `hop` | 1 on a ring change, decaying over 0.6 s | `currentWakeHop` (`10492`), from the hop commit (`6966`) |
| `radial` | `-step` — which way the hop went | `currentWakeHop` (`10492`) |
| `dir` | the comet's travel direction | `currentWakeTurn` (`10479`) |
| `magnet`, `scorch`, `release` | eased 0..1 presence of Magnet, Scorch, Starfall | `currentWakeUpdate` (`10502-10504`) |
| `bh` | `BH.warp` | `currentWakeUpdate` (`10505`) |
| `travel` | accumulated signed arc, in outer-radius units | `currentWakeUpdate` (`10510`) |

`travel` only accumulates while `G.revPend <= 0` (`10509-10510`) — a held
pointer may still roll a speculative turn back into a swipe, and the sky must
not be steered by a gesture the player has not committed to.

`currentWakeUpdate(pdt)` is called once per frame from `update` (`8257`) and
once from the intro path (`7917`). It early-returns outside play or while
frozen.

## What the shader does with it

`glRender` (`9978-9989`) packs the record into four uniforms:

```
uCurrent    = (turn, hop, radial, dir)          — zeroed unless live
uPowerFlow  = (magnet, scorch, release, bh)     — bh is never gated
uFlight     = the comet in screen-height units
uLive       = (phrase, travel, pressure)
```

`live = G.state==='playing' && !RM`, so reduced motion zeroes the gesture terms
but leaves `radial`, `dir` and `bh`.

In `GL_FS` (`9539-9543`), all three gesture responses are multiplied by

```glsl
float influence = exp(-dot(fromComet,fromComet)*12.0)*(1.0-blackhole);
```

so a turn curls the cloud volume *around the comet*, a hop shoves it radially,
and Magnet draws it inward — each locally, none of them a full-frame effect,
and all of them off during a black hole.

`uLive.y` (`travel`) also drives the nebula's own flow field
(`flow = vec2(uLive.y*0.043, -uTime*0.028)`, `9546`) and the ring atlas
rotation (`9509`), and `uLive.z` (`pressure`) spins the globe (`9603`) and
swells the belt radius (`9498`). `uLive.x` (`phrase`) is
`sin(musPos()/STEPS*TAU)` — a continuous position in the bar, not a beat
impulse, which is the distinction `rendercheck` section 3 tests by setting
`G.beat=1` and requiring the rendered mean not to move.

## `skyCharge()` — the pressure term

`skyCharge()` (`9936-9940`) returns 0 under reduced motion, outside play,
during a black hole or during a live Starfall. Otherwise it is

```js
min(1, MU && MU.armed ? 1 : ((G.build||0) + partial*0.85) / dropNeed())
```

where `partial` is the current lap's progress `G.lapAcc/TAU` when the lap has
fed at least one ember. It is the invisible build meter, expressed as planet
spin and ring swell instead of the retired violet arc.

`rendercheck.mjs:328-331` asserts it is *visible but not overwhelming*: setting
`G.build = dropNeed()-1` must move the rendered mean by more than 0.01 and must
not raise it above 1.30x the resting field.

## `uRelease` — Starfall comes from the planet

`glRender:9988-9989` sends `(reward.total - reward.left, reward.total/3)` while
a Starfall is live and `(-1, 1)` otherwise. `GL_FS:9528-9536` turns that into a
ring expanding away from the planet centre:

```glsl
releaseRadius = mod(elapsed, period)*0.38;
releaseWave   = exp(-((fromPlanet-releaseRadius)/0.048)^2) * exp(-releaseRadius*1.25)
                * step(0.0, elapsed) * (1-blackhole)
                * smoothstep(0.0,0.12,phase) * (1-smoothstep(0.75,1.0,phase));
```

which displaces the sampling coordinate outward by `releaseWave*0.035` and
recolours through `materialHue(col, vec3(1.0,0.76,0.32), releaseWave*0.18)`
(`9579`). This is the "Starfall sends physical gold stars from the planet
toward the playable orbits" line in `docs/engine/implementation.md`.

## The dust wake — `G.currentWake`, 36 strands

`currentWakeReset` allocates a fixed pool of 36 (`10471`); nothing is ever
allocated after that. `currentWakeUpdate` emits new strands along the comet's
actual travelled segment (`10532-10552`), at most 4 per frame, spaced every 22
world units (13 during a hop), each assigned `layer = serial++ % 3` which sets
its offset from the ring (`9 + layer*14`), its trailing reach
(`62 + layer*34 + hop*34`) and its lifetime (`2.3 + layer*0.3` s).

Per-strand forces (`10512-10531`): a tangential term
`dir*(14 + turn*24)` and an outward term `7 + release*92`, a Magnet pull
`magnet*max(0,1-d/230)*220` toward the comet, and during a black hole a
substitution — not an addition — of `-normal*bh*190 + tangent*bh*45`, with
strands inside `r < 18` killed outright. Drag is `min(1, dt*(bh>0 ? 5 : 2.6))`.
The tail point `p.tx/p.ty` integrates at **0.30** of the head's velocity, so a
force change bends a long filament rather than translating it.

`drawCurrentWake` (`10556-10581`) runs inside the camera dolly but **outside**
the screen shake (`10705` precedes `10706`). It clips out a quiet ellipse at
`0.24*R` (`0.34*R` during a black hole) with `evenodd` so nothing crosses the
hub or the singularity's shadow, then draws each strand twice — a wide soft
pass at `alpha*0.22` and a `1.1 + layer*0.4` core — as a quadratic curve bent
by `p.bend`. Colour is chosen by state, not by blending: scorch orange
`#ffb571` above `p.heat > 0.45`, Starfall lilac `#ebd2ff` above
`release > 0.3`, magnet cyan `#91e8ed` above `magnet > 0.25`, otherwise the
layer's own blue.

Alpha is `fade * (0.065 + edge*0.16 + kick*0.13 + release*0.13 + bh*0.14)`
where `edge` rises from 0 at 0.46 of the outer radius to 1 at 1.14 — the wake
is faint over the play annulus and strongest outside it.

The whole pass returns immediately under `prefers-reduced-motion` (`10557`),
and `currentWakeUpdate` skips strand physics and emission under it too
(`10511`) while still integrating `travel` and the eased power terms — so the
shader keeps its flow direction and the canvas draws nothing.

## Where this is not covered

Nothing in `fxcheck`, `drawcheck` or `rendercheck` drives a turn or a hop and
then asserts the wake exists, and `rendercheck`'s living-field test measures
only the *sky* (`skyRGB`, `rendercheck.mjs:145-152`, calls `glRender` and then
`readPixels` off the backdrop's own GL context — it never sees the 2D canvas). `drawcheck` will catch a
non-finite coordinate or an unbalanced `save()` inside `drawCurrentWake`
because it plays 2,400 frames with driven taps and swipes, but it cannot see
whether anything appeared. See `db/notes/render/coverage-gaps.md`.
