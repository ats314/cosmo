# POWERUP TESTING: why the sandbox is shaped the way it is

**What this answers:** every design constraint on the powerup lab, and the four
leaks that produced them.

## Why it exists

Nine of the ten orbs sit behind a curriculum ladder and the tenth — the black hole
— is rare on purpose: **three `blackhole_entered` events in the game's entire
recorded history, every one of them on level 4.** Finding out what an orb actually
feels like meant playing until the game decided to hand you one.

`spawnPow()`'s lab branch bypasses the intro trio, the level floors, the
guarantees, the shield pity rule and the black hole's die — *the lab exists
precisely because those rules are the obstacle* (runtime.js:5930-5944).

## It is a door, not a mode

Deliberately not a third row of `MODES`. `MODES` is the difficulty table and a mode
*scales* the difficulty; **the lab pins it.** Tapping the bar opens a picker
instead of selecting anything, which is the test of it: retiring CHILL did not make
the lab a second mode row.

## The pinned clock, and why the constant is 40

`dl()` returns `LAB_DL` (40) and never moves (runtime.js:3193). That freezes speed,
shard cap, arrival rate, telegraph length, the tier ladder and the finish line
**together and in the proportions they were tuned in** — the same argument the
difficulty modes make for using `dl()` as their one lever.

40 is chosen because it is exactly `TIERS[3].at`, the lowest clock value that gives
the arena all three orbits. **The black hole adds a fourth on entry and restores
what it found on the way out, so a lab with fewer rings would have demonstrated
that against nothing.** Everything else follows: shard cap 4, arrival gap 2.4s,
speed 1.62 of a 4.2 ceiling, a 2.35s telegraph. Level 1's finish line is dl 90, so
a lab run is endless and no tier can arrive to interrupt what you came to look at.

The lab climbs the ladder **once** by the same two lines a level-2+ start uses
(`G.tier=tierIndex()`, then walking `TIERS[i].rings`) rather than assigning
`G.nRings` a number of its own (runtime.js:6277-6288).

## The ghost

*red cannot touch you*, on by default, switchable on the picker or with **G**. It
is read at the **single lethal-contact site, ahead of the hypernova and shield
branches**, so nothing downstream fires: no shield spent, no pip moved, no popup,
no i-frame (runtime.js:7616-7622). The shard keeps travelling and passes through
you, **which is how you can tell it is on without a line of HUD claiming it.**
Switch it off and the lab is the real game with one orb in it — which is the only
way to find out what taking that orb is worth.

Because a ghosted run cannot end by itself there is a door in the top-left of the
arena, live on the death screen too, plus Escape; without it the only exit would be
a page reload. Leaving mid-black-hole resets the mode outright, because `bhTick`
runs on `bhActive()` as well as on `playing` and an abandoned horizon would keep
rewriting `RADII` under the picker.

## Nothing a lab session does reaches the device

No score becomes a best, no level record moves, the lifetime run count does not
advance, the struggle streak that lengthens future openings is not fed, and no
first-encounter lesson is spent or re-armed.

**Two writers spend a lesson, not one.** `firstMeet()` fires the sentence, and the
pickup path *separately* treats taking a musical orb as having been taught it. The
lab hands you the same orb every few seconds, so guarding only the first would have
let one black-hole session **permanently retire the black hole's lesson on a device
that had never met one** — and the player would never learn it was gone. Both are
guarded (runtime.js:5563-5570); the harness found the second.

**And the gameplay verbs write, not just the menus.** `hop()` persists
`cometloop:hopped`, and `G.everHopped` gates the once-ever **first-hop rehearsal**
— the dilation, held spawns and radial guide that fire when the second ring lands
for someone who has never hopped. The lab runs on three rings, so a fresh player who
opened it first and swiped once would have met the real second ring with the game's
tutorial for its hardest gesture already spent. `tryLand()` and `judgeTiming()`
persist two more.

`smoke.mjs` snapshots `localStorage` across an entire lab session — entry, orbs
taken, a forced death — and fails if a single key changes. It clears the store
first: comparing an already populated store missed writes that simply rewrote
existing values.

Two of those writes are unreachable in `smoke` by construction (`tryLand` and
`judgeTiming` both return immediately without WebAudio, which `smoke` removes on
purpose), so `check.mjs` carries a static tripwire on the set of persisted keys
instead — see `guards-that-keep-decisions.md`.

## Telemetry is suppressed, not tagged

Suppressed at the choke point inside `track()` rather than tagged with a property.
**Tagging would have been the smaller change and the worse one**: it moves the
burden onto every future query, and the first dashboard that forgets the filter is
averaging sandbox deaths — pinned clock, one orb on repeat, red switched off — into
the real completion rate. Suppressing means a lab run cannot reach the funnel and
an event added by a later change inherits that for free.

Note what that means for the black-hole events: a lab session is the easiest way
there has ever been to enter the mode, and none of those entries reach the data —
so `blackhole_entered` keeps meaning *"a player met one in a real run"*, which is
the only reading its failure rate is worth anything under.

Exactly one name is allowed through: `powerup_lab_started`, carrying which orb was
picked and whether the ghost was on (runtime.js:6688). Which of the ten anybody
actually wants to look at is the one thing about a lab session worth counting.

## No share on a lab death

`runSummary()` has no room to say the run was a sandbox, and a boast the game knows
to be false should not be one tap away.

## The difficulty trims still apply

`speed`, `warn`, `cap`, `gap` and `shields` still run — with `MODES` at the identity
row they are all neutral. Only `clock` is bypassed, because a pinned constant has
nothing to scale.
