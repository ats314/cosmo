# Cosmo: awe, motion, release

Current direction, September 7–8, 2026. The original web game is the active
priority: a relaxed musical voyage through immense space, with wormhole
passages connecting distinct destinations. Progress should feel like discovery.
Keep room to breathe between skillful decisions and musical releases. The
owner's references emphasize violet/blue nebulae, monumental planets, and
flowing tunnel walls with light travelling past a distant aperture.

The current web route gives the six existing levels a continuous sequence of
celestial encounters: Earth and Moon, Saturn, Neptune, a stellar nursery, a
galactic centre, and Pelagic, an alien ocean world. These are selected solar
landmarks followed by more distant destinations, not a complete tour of every
planet or a finished larger campaign. Approach, passage and recession make
travel visible during the original game. See [the level mapping](levels.md).

Completed-level cards are resting places within that journey: the arena
recedes, the wormhole continues gently, and the next destination is named.
Upgrade selection has no timer. The player continues when ready. A small
route shows the existing level progression without creating new save records
or a permanent atlas. Wormholes appear only on completed-level resting cards
and disappear on the first frame of resumed play. They have no steering,
collectibles, challenge or independent progression. Reduced motion keeps a
static passage. This presentation pass preserves the tuned pressure curves
and existing music; further balance and musical work should evaluate stress
during actual play, particularly the later levels.

The owner wants a striking premium
space arcade with clear movement and powerful earned releases. Earlier
playtest quotes remain evidence; an agent's chosen remedy is not a permanent
constraint. Six authored levels are a starting point, not an endless exam.

## Art and composition

A brilliant comet flies across an immense textured planet, luminous
atmosphere and sweeping rings, with deep colored nebula and stable stars
beyond. Give that celestial art room to breathe, particularly in portrait.
Worlds need distinctive composition, scale, materials and light.

The destination renderer uses original procedural shader scenes: shaded
spheres, a ring plane and moons at different depths. Their flybys share the
game's supplied camera progress; the orbital game and HUD remain on their
existing canvas. This is depth within the scenery, not a conversion of
hazards or collision rules into a shared 3D world. No new external imagery is
introduced by these celestial scenes.

Procedural worlds are the foundation: their planet, atmosphere, rings and
nebula respond to play while keeping routes and red hazards readable. The
24 images remaining in the art manifest have real transparency. Wisp, planet
and ring textures supply material detail within that living scene. Opaque
Gemini world plates have been removed from the manifest and public world
assets; their originals are archived outside the game as references. A baked
checkerboard is not alpha, and a marked background is not release artwork.
Internal provenance, dimensions and hashes live in docs/art/catalog.json.
Record the source and permitted use of every new asset. The procedural scene
also works when textures are unavailable.

The comet disturbs persistent orbital currents. Long dust filaments retain
the travelled path briefly; a committed turn redirects them and a successful
hop bends their flow into the new lane. Share that movement across the dust,
nebula and atmosphere. Keep the central playfield clear and let the strongest
motion reach the surrounding space. A speculative tap that becomes a swipe
must not leave a false reversal behind. Freeze the currents on pause and
clear their history on retry.

The title is art-first: original lettering, a tactile launch interaction and
thumb-reachable secondary controls. Menu, level cards, upgrades and results
share its visual identity. Avoid a generic thin heading over stacked cards,
tiny gray instructions or essays. Keep the comet, collectible stars and
threats distinct during play.

## Calm and impact

Ordinary play has space and mystery. Each world's harmonic identity remains
audible while clean movement and earned powers open the arrangement.
Large moments coordinate music, material response and motion.
A small gain trim alone is not a meaningful musical transformation.

Let completed orbits build visible pressure in the planet's atmosphere and
rings together with the musical arrangement. The accepted Starfall direction
is gold stars originating near the planet's corona and travelling into the
arena, with currents opening outward and material contours travelling through
the world as the stars arrive. Give the reward a visible source and a clear
return to ordinary play.

Powers reshape the same field: Magnet bends nearby streams toward the comet,
Scorch leaves a warm burning wake, and the black hole pulls surrounding
layers inward. Their forces should remain legible through motion, even with
audio muted. Coordinate them through shared gameplay state rather than
independent decorative oscillations.

Use scenePulse and sceneAccent to coordinate bounded visual responses.
Pickups keep their own identity; milestone orbits, Starfall, Nova and
Hypernova create stronger releases. A lower-priority event must not interrupt
a larger one. The black hole owns its scene until it closes. Reset event
state between runs, and let each material response settle before the next.

## Default effects baseline

No full-field white flashes, inverse death frames or shared beat-driven light
gain. Repeated collectible glints, rapid comet flicker and whole-orbit warning
pulses do not belong in ordinary play or earned releases. This is the default;
the player must not need a toggle to remove them.

Keep the universe alive through persistent currents, material flow, ring
deformation and visible forces. Let music coordinate that movement. Earned
rewards should do something: stars fly into the arena, Nova converts threats,
and pressure changes the planet's rings. Preserve steady glow and shaded
materials; communicate hazards through shape, position and actual warning
progress. Pause and result darkening remain clear state transitions. Reduced
motion is an additional movement preference, not the gate for this baseline.
See the [event-by-event effects audit](effects-audit.md) for sources and
replacement rationale.

Tap always turns and swipe always changes ring. Their short musical feedback
stays consistent; authored melody answers, fills and chorus changes happen
automatically. The retired tap-to-play melody, drum and echo sections must not
return as temporary demands on the player. Muted play communicates every
mechanic visually.

## Primary design references

Housemarque's official [Returnal VFX breakdown](https://housemarque.com/news/2021/9/15/returnal-vfx-breakdown)
describes gameplay forces affecting nearby particles and vegetation, and
persistent connected trails. [Juice It or Lose It](https://www.gdcvault.com/play/1016789/Juice-It-or-Lose),
by Martin Jonasson and Petri Purho at GDC Europe 2012, demonstrates how
responsive audiovisual feedback changes the feel of a simple game. These
are design references. Cosmo's orbital currents, shared orbit pressure and
corona-to-Starfall release are our application to this game's movement,
rewards and phone performance budget; they do not import those games' code,
assets or rendering architecture.

## Rewards have visible jobs

Three star-fed orbits earn Starfall, or two with EARLY STARFALL. It starts
automatically on the next musical beat when audio is available, immediately
otherwise. Red clears and three star waves arrive across about 9.23 seconds.
Collect them for double value. There is no countdown to land and no timing
exam. The collected stars and final score report explain the reward.

Shield protects a mistake. Slow-mo buys planning time. Nova opens space
through an expanding conversion front. Hypernova gives a short charge through
threats and a protected landing. Magnet visibly bends nearby stars into the
comet. Mirror collects and breaks red opposite the player. Scorch burns the
travelled route; Slipstream opens a safe arc when hopping. Star Trail offers
a route across rings. See powerups.md and MECHANICS.md for exact durations
and upgrade behavior.

The black hole is a voluntary wager. A fourth ring opens; settled inner-ring
residence charges a reward while gravity threatens position. At twelve
seconds gravity releases. Reach the outer ring before seventeen seconds to
receive the reward. Missing the exit loses it and one shield, or the run if
none remains. Other powers suspend and keep their remaining time. An already
running Starfall pauses its real waves and timer; it is not earned twice.

## Teaching and words

New players enter a safe playable introduction from Launch. A committed turn,
star contact, full orbit without turning and completed ring change advance
four short steps. Skip remains available; Learn to play reopens it.
Preserve existing swipe preferences; new players start with screen-relative
up/down swipes.

One message card owns instructions. Introduction and immediate escape guidance
outrank other lessons and announcements. Name an action and its visible result.
The black-hole guidance sits above the arena while its center shows charge or
escape time. Keep score and level progress in the header; show powers as
named countdowns and shields as a count. Retired band dots and ambiguous
resource diamonds do not return.

## Verification and growth

Run the required functional checks once integration is ready and inspect a
small real-browser sample for layout, input and rendering failures. The owner
leads broader playtesting and balance feedback. Automated metrics do not
establish whether an effect is exciting.

New levels, worlds, formations and powers are welcome when they add meaningful
decisions. Tests protect honest teaching, geometry and state behavior; they
must not fossilize an unfinished content schedule.
