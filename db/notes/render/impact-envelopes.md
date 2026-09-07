# Coordinated impact: one event owns the scene, and it expires

*What this answers: when Cosmo pays out a reward, what changes, in what
priority order, for how long — and what stops ordinary play from flashing
every layer?*

Anchors are `src/game/runtime.js` at commit `01a3a25`. The envelope shape and
the local marks were both rewritten in `dd9bbaa`; see
`db/notes/render/commit-drift.md` for the before/after.

## Two parallel records, one shared vocabulary

A reward writes to **two** places, and they are not the same thing:

- `G.sceneEvent` — at most one live event, the *scene-wide* material change.
  Written by `scenePulse` (`9751-9758`), read by `sceneAccent` (`9759-9772`),
  consumed by both sky paths as `uAccent`/`uEventTint`.
- `G.impacts` — up to seven *local* marks pinned to where they happened.
  Written by `impactRecord` (`10397-10404`), drawn by `drawImpactEvents`
  (`10582-10607`).

**`scenePulse` now calls `impactRecord` only after it has decided to accept the
event** (`9756`). Previously it recorded first, so a refused pulse still left a
local mark. The two records are therefore now in step.

## The priority ladder and the duplicate guard

`SCENE_RANK` (`9745`):

| rank | kinds |
|---|---|
| 3 | `nova`, `hyper`, `hypernova`, `drop` |
| 2 | `shield`, `spot`, `warp`, `mirror`, `scorch`, `slip`, `trail` |
| 1 | `orbit` |

`scenePulse` refuses a new event when a live one is **the same kind** or is
strictly higher ranked (`9754-9755`):

```js
if(prev&&prev.at>=G.started&&G.t-prev.at<prev.span&&
   (prev.kind===kind||(SCENE_RANK[prev.kind]||0)>SCENE_RANK[kind]))return;
```

The `prev.kind===kind` clause is new. It exists because audio and gameplay both
report the same earned event, and the second report used to restart the
envelope — a visible re-onset. `fxcheck.mjs:342-347` asserts that a repeated
`scenePulse('drop',3)` changes neither `G.sceneEvent.at` nor
`G.impacts.length`.

Anything not in `SCENE_RANK` is ignored entirely — a `kind` typo silently does
nothing, which is worth knowing when adding one.

The black hole is not in the table at all. `sceneAccent` short-circuits on
`BH.phase > 0` and returns `{kind:'blackhole', id:4, strength:BH.warp,
tint:[0.38,0.30,0.60]}` (`9760`) before it looks at `G.sceneEvent` — so the
hole owns its scene by construction, not by ranking.

## The envelope

```js
attack  = min(1, age/0.9)
release = min(1, (span-age)/1.2)
env     = min(smoothstep(attack), smoothstep(release))
strength= env * (kind==='orbit' ? min(0.60, 0.28 + 0.065*G.lapStreak) : 1)
```

(`9766-9768`.) **900 ms of attack**, and a release over the last 1.2 s of the
span rather than over the whole remainder. `scenePulse` floors `span` at
`2.4` s and defaults it to `2.4` (`9757`), so the shortest possible event is
attack + release with 0.3 s of plateau. That floor overrides the durations the
call sites ask for: `scenePulse('shield',1.5)` and `scenePulse('orbit',1.8)`
both become 2.4 s.

An orbit is deliberately capped at 0.60 strength and starts at 0.28 — it is the
routine reward, and it earns more light only as the lap streak climbs.

`sceneAccent` returns the quiet accent (`id 0`, strength 0, no tint) whenever
**any** of these hold (`9762-9765`): reduced motion is on,
`G.state !== 'playing'`, there is no event, the event predates `G.started`, or
`age >= span`. The `at < G.started` test is what stops a previous run's event
lighting a new one.

## The ids, which are what actually reach the GPU

`uAccent = (strength, id, star, 0)` (`glRender:9998`):

| id | meaning |
|---|---|
| 0 | quiet |
| 1 | orbit |
| 2 | drop |
| 3 | hyper / hypernova |
| 4 | black hole |
| 5 | every other pickup |

`SCENE_TINT` (`9746-9750`) carries a per-kind RGB triple that becomes
`uEventTint`; the black hole substitutes its own. With no tint the sky falls
back to the current world's `rim` colour (`glRender:9975`).

In `GL_FS`, `fire = max(amp, uPowerFlow.z*0.65)*(1-blackhole)` (`9521`) drives
**hue**, not gain: the atmosphere's `air` is `materialHue(uRim, uEventTint,
fire*0.25)` (`9594`) and the aurora is `materialHue(globe, air, aurora*0.10)`
(`9633`). `blackhole` instead magnifies the sampling coordinate and darkens the
centre. So "an event" is the *existing materials changing colour and moving*,
never a brightness multiplier and never a new layer laid on top.

## Who fires what

All `scenePulse` call sites, with the duration they ask for (the 2.4 s floor
applies to the first two):

| call site | kind, requested span | anchor |
|---|---|---|
| shield pickup | `shield`, 1.5 | `8636` |
| completed orbit (via `skyWake`) | `orbit`, 1.8 | `9775` |
| nova pickup | `nova`, 2.4 | `8731` |
| mirror pickup | `mirror`, 2.5 | `8673` |
| scorch pickup | `scorch`, 2.5 | `8691` |
| slipstream pickup | `slip`, 2.5 | `8702` |
| slow-mo pickup | `warp`, 3 | `8651` |
| magnet pickup | `spot`, 3 | `8659` |
| star trail pickup | `trail`, 3 | `8708` |
| hypernova pickup | `hyper`, 3 | `8720` |
| black hole escape paid | `drop`, 3 | `2391` |
| overdrive opens | `drop`, 3 | `8081` |
| Starfall release | `drop`, 3.5 | `1357` |

## The local marks

`impactRecord` (`10397-10404`) stores `{kind, x, y, angle, ring, at, span}`
with `span = 1.25` for an orbit, `2.5` for a drop, `1.65` otherwise, filters
out anything from a previous run or already expired, and shifts the oldest out
at seven entries.

`drawImpactEvents` (`10582-10607`) returns immediately during a black hole or
outside play, and then **skips `orbit`, `nova` and `drop` entirely** (`10588`):
"Orbit has its travelling gold marker; Nova has its real conversion front;
Starfall comes from the planet. Do not stamp a second explosion."

What is left is the pickup mark: under reduced motion a single static halo at
`26*u` with alpha `0.28*fade`; otherwise 7 (hyper/hypernova) or 4 curved,
tapered fragment strokes at `source-over`, anchored at the pickup angle,
travelling from `reach*(0.38 + 0.08*(i%3))` to `reach*(0.72 + 0.16*(i%2))` where
`reach = (18 + t*(92 or 44))*u`. `fade = min(1, age/0.16)*(1-t)^1.3`.

The expanding ring, the radial halo, the horizontal beam and the `lighter`
composite that used to be here are all gone.

## The other bounded responses in the same frame

- **`drawOrbitalRails` (`10405-10432`) no longer responds to the scene event
  at all.** The additive `impactColor(scene.kind)` ellipse stroke per ring was
  removed; the rails now draw only their dark bed, the metal gradient, and the
  three-pass cyan arc under the comet.
- `G.stop` is hitstop, applied as a `0.10` multiplier on `sdt` only (`8161`) —
  effects run on `dt`, so a freeze costs no animation. Set at `7676` (0.04),
  `8398` (0.035), `8647` (0.07), `8725` (0.06) and `8746` (0.11), all guarded
  by `!RM`.
- `G.shake` translates the world inside the dolly transform (`10706`).
- `drawCurrentWake` (`10556-10581`) brightens with `f.release` and `f.bh`, and
  changes colour with scorch and magnet — a material response rather than a
  flash. See `db/notes/render/living-world.md`.

**`G.flash` and `flashHit()` no longer exist**, and neither does the white
death impact frame. There is no full-screen white anywhere in `draw()`.

## What the harnesses hold

`fxcheck.mjs:316-379` (section 1a-ii) drives a real lap and then asserts the
whole contract at the uniform level: an orbit arrives as
`uAccent = (0<s<=0.65, 1)`; a drop is still below 0.15 at 0.18 s (the onset is
gradual) and reaches >=0.99 by 0.9 s; a repeat pulse restarts nothing; a
subsequent `orbit` or `spot` cannot displace a live drop; `BH.phase=2` takes id
4 exclusively; an expired event leaves `uAccent[0] === 0`; an event from before
`G.started` is ignored; each of the eight pickup kinds can own a visible event
with a finite tint; and setting `G.beat`, `G.combo`, `G.lapStreak`, `G.pocket`
and `G.dir` changes neither `uAccent` nor `uArc`.

`rendercheck.mjs:287-355` (section 3) repeats the last of those against real
pixels, and now measures *shape* as well as level: an ordinary beat impulse
must not move the rendered mean by more than 0.01; earned orbital pressure
(`G.build=dropNeed()-1`) must move it by more than 0.01 but not above 1.30x;
advancing `GL.tw` from 5 to 7 must move at least 0.20 cell luma; a drop must stay within
`[0.84, 1.16]` of the charged mean while deforming the field by at least 0.20
cell luma; an expired event must leave the field identical to one with
`G.sceneEvent = null` at the same clock; and a black hole over a live nova must
come out darker than quiet.
