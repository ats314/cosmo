# Forward flight in the original game

The original web voyage is the active priority; Godot work continues
separately. Level 1 of the root Phaser game tours all eight planets, then the
remaining five levels visit a stellar nursery, the galactic centre, Pelagic,
Crystal Reach and Ember Sea. The
original music, tap/swipe handlers, simulation, rewards and teaching remain
in use. See [the level mapping](../design/levels.md).

## Ownership

Phaser owns the existing input and frame loop. After the runtime finishes its
normal draw, it passes a copied `runtimeFlightFrame()` to CosmoScene. The
snapshot includes the actual projected comet position, orbital geometry,
palette, presentation clock, existing power envelopes and a copied
`voyage: { progress, chapter }`. It contains no mutable game objects,
callbacks into gameplay or audio handles. Reading it
does not consume random numbers. Capturing the existing hit shake preserves
the original order and number of random draws.

`journeyView()` selects scenery from the existing level. Level 1 samples the
existing presentation clock into a resettable `SOLAR_FLIGHT` memo outside game
state: each encounter lasts 9.5 seconds, with a 2.66-second overlapping handoff.
The introduction holds the close Mercury opening; finishing or skipping it
starts the tour without a camera jump. Neptune stays visible until the real
level ends. Levels 2–5 follow the existing `dl()` finish line.
`voyageFrame()` copies the chapter and progress needed by the scenery; the
incoming encounter is copied separately during a handoff. Chapter selects an
authored visual preset, not another level ordinal or unlock. This introduces
no simulation clock, permanent atlas, save record or gameplay rule.
The level picker previews its selection. The lab emits no
destination voyage and keeps its original scene. Level 6 remains infinite:
its decorative camera approaches the end of its flyby asymptotically without
completing the level, unlocking anything or announcing a nonexistent level 7.

`src/game/flight-world.ts` draws original procedural celestial scenes,
perspective dust and the comet's departing wake using the runtime's WebGL
sky context. Shaded spheres, a ring plane and moons at different depths make
approach, passage and recession visible. Earth optionally uses the owner's
1280×632 map, cached through Phaser and uploaded with NPOT-safe clamp/linear
sampling. Missing or failed imagery leaves its procedural surface available.
Positive depth recedes beyond the arena; the original arena lies at depth zero. Old
wake positions approach the viewer as the comet and orbital center travel
onward. Dust and wake distance use the presentation clock, so turning never
reverses the entire journey. Pause and slow motion follow the existing clock. Reduced
motion removes the forward flow and departing wake.

The original living sky draws once per frame. A ready flyby suppresses only
its fixed planet, rings and halo; nebulae, texture detail, stars, orbit-earned
`G.skyW` palettes and committed-motion responses stay visible. The second
pass is transparent around its planets, moons and rings. Incoming and outgoing
scenes blend with premultiplied coverage to avoid black handoff fringes.
The stellar nursery and galactic centre add translucent landmark layers.

Copied orbit, charge, release and power envelopes deform the flyby surfaces
and rings as well as the original sky. Magnet draws nearby dust toward the
comet, Scorch warms the departing wake, and black-hole gravity suppresses
ordinary power responses while bending the surrounding field inward.
Starfall copies up to five real in-flight Bezier paths into gold wisps. Their
heads share the actual stars' easing and camera translation. The existing
emission anchor remains independent of the flyby sphere; neither collectibles
nor their collision positions move to suit the scenery. Reduced motion omits
these wisps and dust flow, and freezes the planet camera and material time.

The geometry pass restores the sky's GPU state, releases resources when the
scene stops and recreates them after context restoration. A failed decorative
pass leaves the original playable renderer available.

## Wormhole passages

A copied `transition` field reports the elapsed completed-level card time and
next level. The flight renderer opens a curved cyan/violet volume around a
dark aperture, with longitudinal material flow and quieter transverse ribs.
The existing arena recedes on its foreground canvas before the card is drawn.
The player can rest and choose an upgrade without a countdown. The wormhole
exists only while the completed-level resting card is active and disappears
on the first live frame of the next level. It never owns that action, blocks
controls, advances records or schedules sound. There is no tunnel steering,
collectible, challenge or new mechanic. Selected-level and retry introduction
cards do not open a wormhole. A gameplay black hole is the existing optional
power and does not authorize a travel passage during ordinary play.

Reduced motion shows a static passage and removes traveling flow. Clock
rollback, title return, and renderer teardown clear passage state. The original
game's controls, music, scoring, pressure curves and level-start reset remain
unchanged. The route display reads existing levels and run progress only.

## Scope and comparison

The default view enables flight. Add `?flight=0` to the play URL to use the
original sky and omit the geometry pass. This is a visual switch only.

Canvas2D still draws gameplay and UI above the WebGL scenery. The shader's
spheres, ring plane and moons have their own spatial depth, but hazards and
the comet do not share that 3D geometry or a collision/depth buffer with them.
Their original projected positions and interaction rules remain authoritative.
Decorative depth must preserve the arena's readability.

Tidal siphons with new boosts or fuel rewards are not part of this graphics
change. The existing Starfall and power behavior remain authoritative.

## Verification and delivery

`flightcheck.mjs` provides protected-function and seeded-runtime comparisons
against the `dd9bbaa` fixture: 191 functions and 11 tuning tables, including
audio events, random consumption, pointer controls and storage. This protects
the presentation pass from changing that baseline; it does not establish
equivalence to the game before earlier gameplay changes.
`enginecheck.mjs` exercises the built root application through Phaser. The
integrated destination pass must be checked through that real main-game host,
including approach/pass/recede, held-clock stability, selected starts, lab
exclusion, first-live-frame passage removal, resize, reduced motion, context
recovery and the classic comparison path. A controlled preview page that
creates its own runtime and animation loop proves only its fixture surface.

The change belongs to the original game built into `dist/`. Local preview
pages are verification tools, not a separate gameplay product or evidence of
deployment. Final integrated checks and main-game visual inspection must be
recorded by the integrating agent; this document does not claim a passing
run or a live release. Device performance and touch feel still require real
phone/tablet playtesting. No balance changes or new music are included in
this presentation pass.
