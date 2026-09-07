# Cosmo: awe, motion, release

Current design direction, September 7, 2026. This supersedes earlier aesthetic
prescriptions and the old "last level is an endless exam" rule. Earlier playtest
quotes remain evidence; an agent's chosen remedy is not a permanent constraint.

Cosmo is a small, brilliant comet moving through an immense living universe.
Ordinary play should feel clear, spacious and mysterious. Skilled movement
gradually opens the music. Major earned moments change the room together.

## The scene

One authored celestial composition per world: a swept, illuminated cloud limb,
shadowed volume and sparse stable stars. Worlds differ in position, curvature,
scale, colour and light, not just hue. The background has slow internal motion;
the play annulus stays quieter than its surroundings. Do not add independent
meteors, random flares, grids, foreground fog, screen rotation and beat washes
on top of that composition.

The arena is a set of fine orbital paths. The comet, collectible stars and red
threats win contrast. An active path segment shows the player's lane. A thin
lap arc reports progress; large orbit celebrations occur at milestones. The
comet carries one shield crescent; the HUD carries the actual shield count and
all active powerup durations. Avoid concentric status rings around the comet.

## What makes the world respond

`scenePulse` and `sceneAccent` provide one visual event envelope. A completed
orbit makes a small, brief response. A pickup supplies its own colour. A drop,
nova or hypernova earns the largest release. A lower priority event cannot
interrupt a larger one. The black hole owns the scene until it closes. All
events expire and are scoped to the run; ordinary beats do not flash the sky.

The music has a sparse calm arrangement and a fuller engaged arrangement,
using each level's existing harmonic identity. Ring position, rhythm and clean
orbits open the arrangement; returning to calm allows it to thin again. Drops
retain their build, breath and release. Player instruments remain independently
audible. Muted play still communicates every mechanic visually.

## Powerups have jobs

Shield preserves a mistake. Slow-mo buys a useful planning window. Nova opens
space through an actual expanding conversion front. Hypernova gives a short
charge through threats with an audible identity and a protected landing.
Spotlight rewards performance and compounds with other earned payouts. Mirror
collects opposite the player along the actual swept path. Scorch burns the
route actually travelled. Slipstream makes ring changes open a safe arc. Star
Trail offers a valuable route to pursue across rings. See `powerups.md` and
`MECHANICS.md` for durations, introduction levels and scoring.

The black hole is a voluntary wager, not another ordinary timed buff. A fourth
ring opens. Inner-ring dwell banks a visible reward while gravity threatens
position. At twelve seconds gravity releases and the escape signal opens;
reach the outer ring before seventeen seconds to cash out. Missing it loses
the bank and a shield, or the run if no shield remains. Other orb durations
pause and their effects suspend. Earned drops are banked for the return.

## The game continues to grow

There are six implemented levels today. Level 6's missing finish line is a
content frontier, not an intended endless mode or a limit on teaching. New
levels, new worlds, new formations and new powerups are welcome when they add
meaningful decisions. Introduce them where their verbs are useful and their
lessons are understandable. Tests enforce honest lessons, valid data and
playable geometry; they must not fossilize an unfinished content schedule.

## The first flight and the words on screen

New players enter a safe playable introduction directly from Play. A committed
tap, physical star contact, a full orbit without turning and a completed ring
change advance four short steps. Each action receives brief confirmation. The
second ring and earned score carry into level 1. Skip is always available;
interrupted introductions resume on the next Play. Existing control preferences
are preserved; new players begin with screen-relative up/down swipes.

One message card owns gameplay instructions. Introduction and immediate escape
instructions take priority over timing cues, lessons, results and announcements.
It uses a short heading, an optional explanation and a progress indicator only
when useful. The black-hole instruction sits above the arena while its centre
shows charge or time remaining. Long explanations wrap instead of shrinking to
illegible single lines. Experienced players do not keep receiving basic hints.

Score and level progress form the header. Active powers have named countdowns;
shields have a labeled count. Music dots and ambiguous resource diamonds are
retired. Pickups announce their name and actual effect once. Instructions name
the action the player can perform, using tap, swipe, star, orbit and shield
consistently. The level cards, menu and results share the same restrained type
and panel treatment.

## What counts as verification

Run required functional checks once the implementation is integrated. Use a
small real-browser check for layout, input and rendering failures. The owner
will lead broader playtesting and balance feedback; keep agent time focused on
improvements rather than repeated review campaigns. Automated measurements do
not establish whether a game feels good.
