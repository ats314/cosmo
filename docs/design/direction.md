# Cosmo: awe, motion, release

Current direction, September 7, 2026. The owner wants a striking premium
space arcade with clear movement and powerful earned releases. Earlier
playtest quotes remain evidence; an agent's chosen remedy is not a permanent
constraint. Six authored levels are a starting point, not an endless exam.

## Art and composition

A brilliant comet flies across an immense textured planet, luminous
atmosphere and sweeping rings, with deep colored nebula and stable stars
beyond. Give that celestial art room to breathe, particularly in portrait.
Worlds need distinctive composition, scale, materials and light.

The scene must feel alive without burying the routes or red hazards.
Procedural shading, approved original image assets and local effects can work
together. Phaser's boot scene loads the art manifest; the runtime retains a
coherent procedural fallback. The supplied Gemini pack is now integrated:
eight authored world backgrounds and a pack of 24 transparent images load
through the art manifest. Internal provenance, dimensions, hashes and crop
bounds live in docs/art/catalog.json. Record the source and permitted use of
every new asset; the fallback also supports an empty or unavailable manifest.

The title is art-first: original lettering, a tactile launch interaction and
thumb-reachable secondary controls. Menu, level cards, upgrades and results
share its visual identity. Avoid a generic thin heading over stacked cards,
tiny gray instructions or essays. Keep the comet, collectible stars and
threats distinct during play.

## Calm and impact

Ordinary play has space and mystery. Each world's harmonic identity remains
audible while clean movement and earned powers open the arrangement.
Large moments coordinate music, lighting, material response and motion.
A small gain trim alone is not a meaningful musical transformation.

Use scenePulse and sceneAccent to coordinate bounded visual responses.
Pickups keep their own identity; milestone orbits, Starfall, Nova and
Hypernova create stronger releases. A lower-priority event must not interrupt
a larger one. The black hole owns its scene until it closes. Reset event
state between runs, and let ordinary play recover instead of continuously
flashing every layer.

Tap always turns and swipe always changes ring. Their short musical feedback
stays consistent; authored melody answers, fills and chorus changes happen
automatically. The retired tap-to-play melody, drum and echo sections must not
return as temporary demands on the player. Muted play communicates every
mechanic visually.

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
