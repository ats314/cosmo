# Forward flight in the original game

This agent is developing the original web game alongside Claude's Godot build,
which established an appealing sense of flying through space. The owner's
current priority is the original web voyage; Godot work continues separately.
This is a presentation upgrade to the same mobile game. The original music,
tap/swipe handlers, simulation, rewards, teaching and screens remain in use.

## Ownership

Phaser owns the existing input and frame loop. After the runtime finishes its
normal draw, it passes a copied `runtimeFlightFrame()` to CosmoScene. The
snapshot includes the actual projected comet position, orbital geometry,
palette, presentation clock and existing power envelopes. It contains no
mutable game objects, callbacks into gameplay or audio handles. Reading it
does not consume random numbers. Capturing the existing hit shake preserves
the original order and number of random draws.

`src/game/flight-world.ts` draws perspective dust, distant helical strands and
the comet's departing wake using the runtime's WebGL sky context. Positive
depth recedes beyond the arena; the original arena lies at depth zero. Old
wake positions approach the viewer as the comet and orbital center travel
onward. Distance uses the presentation clock, so turning never reverses the
entire journey. Pause and slow motion follow the existing clock. Reduced
motion removes the forward flow and departing wake.

The sky shader adds atmospheric perspective and approaching star layers.
World colors and planet coordinates still come from the original director.
The geometry pass restores the sky's GPU state, releases resources when the
scene stops and recreates them after context restoration. A failed decorative
pass leaves the original playable renderer available.

## Wormhole passages

A copied `transition` field reports the elapsed completed-level card time and
next level. The flight renderer opens a curved cyan/violet volume around a
dark aperture, with longitudinal material flow and quieter transverse ribs.
The existing arena recedes on its foreground canvas before the card is drawn.
The player can rest and choose an upgrade without a countdown. The tunnel
dissolves as the original next-level action starts play; it never owns that
action, blocks controls, advances records or schedules sound. Selected-level
introduction cards do not pretend that a previous level was completed.

Reduced motion shows a static passage and removes traveling flow. Clock
rollback, title return, and renderer teardown clear passage state. The original
game's controls, music, scoring, pressure curves and level-start reset remain
unchanged. The route display reads existing levels and run progress only.

## Scope and comparison

The default view enables flight. Add `?flight=0` to the play URL to use the
original sky and omit the geometry pass. This is a visual switch only.

This first version retains Canvas2D for gameplay and UI. The sky and flight
geometry share WebGL, but the gameplay canvas is still composited above them.
There is no shared depth buffer for hazards and planets. Deep strands use a
projected planet mask; the existing shader can distort the globe during power
effects, so that mask is an approximation. Full 3D crossing and moving celestial
bodies need a shared projection before they can safely affect the visual world.

Tidal siphons with new boosts or fuel rewards are not part of this graphics
change. The existing Starfall and power behavior remain authoritative.

## Verification and delivery

`flightcheck.mjs` compares protected original functions and seeded runs,
including audio events, random consumption, pointer controls and storage.
`enginecheck.mjs` loads the real built app and checks gestures, flight startup,
resize, context recovery, one frame loop and the classic comparison path.
Additional flight checks cover passage geometry, held-clock stability,
departure, menu reset, selected-level exclusion and static reduced motion.
The shader's disabled mode was also compared against the original renderer in
real WebGL across all eight world palettes with identical pixels.

The separate flight playtest publishes only the web build. Its browser origin
has its own local saves; the original game's saves are not transferred or
overwritten. The optional existing account server has its own origin allowlist;
deploying a new static playtest does not add that origin to the account service.
Device performance and touch feel still need the owner's iPhone/iPad playtest.
