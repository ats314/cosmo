# The mechanics ledger

Current sky controls: `SKY_ARENA_CALM = 0.62` and `GL_MOTION = 1.0`.
Earlier numerical tuning notes below describe the retired background stack.
The current composition uses a textured planet, atmosphere/rings and deep
nebula with coordinated reward impacts. Phaser owns the frame loop; gameplay
and audio currently live in `src/game/runtime.js` behind typed scene contracts.

One row per player-facing mechanic: what it does, where the game introduces
it, and every channel that explains it. The curriculum rule this table
enforces is that new content has a reachable introduction and a clear lesson.
Current formations extend through THE NARROWS at dl 520 inside level 5.
Shield/slow-mo/nova are guaranteed on level 1, hypernova and SLIPSTREAM on
level 2, Magnet and STAR TRAIL on level 3, the mirror on level 4, scorch
on level 5, and the black hole is guaranteed to be *offered* once on level 4.
Every one of those
guarantees is once per RUN, literally: the placed flags survive level
boundaries, and a guarantee whose home level is behind the level a run opens
on is pre-spent, so a 1→6 climb meets each orb exactly once, on its home
level. The ordinary fallback roll respects the same level floors (`POWPOOL`,
renormalised proportionally), so a first run on LIFT OFF can no longer be
handed the spotlight.

Difficulty-level (`dl`) values are difficulty-seconds — see `dl()` in
`src/game/runtime.js`. Level windows: dl 0–90 (LIFT OFF), 90–215 (INTO THE RINGS),
215–340 (THE STORM), 340–470 (EVENT HORIZON), 470–610 (REDSHIFT), and 610
onward — HEAT DEATH, the current content frontier. Its present open-ended
clock is not a permanent restriction on later levels or mechanics. A tier marked *(moved)* was
pulled by a curriculum pass.

**Current formation teaching runs through level 5.** The two compound shapes — a gate that
also drifts, a twin that also blinks — used to arrive 22 dl-seconds apart at
the end of level 2, immediately after their two ingredients, which was the
densest stretch in the game and exactly where a playtester reported losing
track of the rules. Adding levels had made that worse rather than better:
every tier still unlocked inside dl 0–215 while whole levels taught nothing.
Level 2 now carries three shapes ~35 apart instead of five ~22 apart, level 3
carries three shapes at that same ~35 spacing — the two compounds and THE
SAUCER — levels 4 and 5 carry one formation and one orb each (DIVERS and THE
MIRROR, then THE NARROWS and SCORCH). The two new rewards arrive earlier:
SLIPSTREAM reinforces hopping in level 2, and STAR TRAIL rewards routing in
level 3. Future levels remain free to introduce more content.

**Level 3 gained a third shape and it is the one that answers a player rather
than a board.** A playtester, verbatim: *"I just feel like I end up just
banging back and forth [on] the final level to stay alive and it's not as much
fun as when I'm weaving in and out. And sort of feels like I'm cheating."* He
was right, and it is structural: `farFromAll` rejects any spawn within 1.1 rad
of the player's instantaneous angle, so an oscillation arc narrower than that
is a sanctuary no static shard can ever be placed inside — every point of the
arc is always within 1.1 rad of every position the player can occupy in it.
Simulated against the shipped build, a camper that adds one hop rule survived
five fifteen-minute level-4 runs without a scratch, covering 1.3 radians of the
circle. THE SAUCER is the first object in the game whose position is a function
of where the player has chosen to be, which is what makes turning around cost
something. It is a tax on the strategy rather than a cure: against a bot with
frame-perfect hop reactions it forces 600–900 ring changes per five minutes and
fires 51–88 times but does not reliably kill.

**The structural half is the clearance rule, and it has landed.** `farFromAll`'s
player term was one symmetric read of `G.angle` with no heading and no memory,
so nothing could be placed within `minP` of where the comet *is* — which is
exactly right for a player who travels and a permanent shelter for one who does
not. It now follows travel: the full reaction gap **ahead** along the heading, a
short pad **behind**, measured in time (0.16s of travel, floored at 0.45 rad) so
it cannot quietly shrink as the game speeds up. The arc you have just left fills
in behind you, and turning around means turning into what you abandoned.

This is not a new hazard class. Shards already end up behind the player every
orbit — you travel past them. The bubble never stopped that; it only stopped
them being *placed* there. And a shard placed behind still spends its whole warn
phase harmless, so a reversal meets a telegraph first, like every other shard.

**Gates are exempt while any wall is on the board.** A gate exists to force a
reversal, and `reverseEscape` vets at spawn time that the reversal has 1.1 rad to
open onto — a check a later spawn behind the player could invalidate. The bubble
goes symmetric while a gate is live, so the one formation that demands a turn can
never be the one that punishes it.

Measured on level 4, immortal-camper bot, five runs of five minutes: **5/5
survived before, 3/5 after**, and the survivors are executing roughly three
perfect ring changes a second. A travelling bot is unaffected — median survival
54.4s → 52.4s across twelve runs each, well inside this harness's noise — and
board density is unchanged (mean shards 9.1 → 8.8), so the rule redistributes
placement rather than adding any. Rewards keep the old symmetric clearance:
letting stars and orbs fill in behind a stationary player would hand the camper
a reason to stay, which is the behaviour the change exists to price.

**The frontier has moved as the game grew.** Level 3 was once the open-ended
level; later levels gave it a finish line and a star dive. EVENT HORIZON now
finishes at dl 470 and REDSHIFT at dl 610. HEAT DEATH currently has no finish
line, but the owner explicitly retired the rule that the last level must
remain an endless exam. `check.mjs` reads level 2's finish line positionally
(`ends[1]`) rather than as `max(ends)`, which was the same number only while
there were exactly three levels.

## Level 1 — LIFT OFF (the verbs, the economy, the core orbs)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Reverse (tap) | Flips your direction instantly. Costs the orbit in progress and the lap streak; embers already gathered stay banked. | first seconds | menu demo + key row, hint ladder, first-reversal orbit lesson *(new)* |
| Hop (swipe) | Jumps one ring inward/outward. **Two rules, chosen by the player.** *Away is out* (radial): read against the line from the centre through the comet, so at the bottom of the loop you swipe down to go out. *Up is out* (screen): up is the outer ring wherever the comet is. They agree at the sides of the loop and invert at the bottom; `swipeOut()` is the only place either is expressed. | dl 12 (SECOND RING, ~20s) | the WHICH WAY IS OUT chooser (once per device, re-openable from the menu's swipe row), menu demo + key row, banner, one-time slow-mo rehearsal, hint ladder, death coach — all five sentences follow the active rule via `swipeWords()` *(they all said "swipe up or down", which described the screen rule while the game shipped the radial one)* |
| Rings | Inner rings are tighter (shards block twice the angle) and run a hotter kit — `RINGS[].lift` climbs 0/380/820 going in. Angular speed is the same on every ring and an ember pays the same wherever taken. | ring 2 at dl 12, ring 3 at dl 40 | banners + camp hint, one sentence: "inside is tighter — the music runs hotter" *(the THIRD RING banner claimed "faster and higher"; neither was true)* |
| Stars (embers) | Collectibles paying a rising additive combo — up to +6 each — while you keep collecting. They play the band's own instrument. | ~0.5s | menu key row, hint ladder |
| Orbit scoring | Complete 360 degrees without turning to receive an orbit payout based on the stars collected along the route. Consecutive star-fed orbits build a streak. Turning loses orbit progress and streak, never collected points. Star-fed completions also advance the three-step Starfall reward. Travel advances the background journey; bounded milestone impacts celebrate completed routes. | first orbit in the playable introduction | orbit arc, collected-star feedback, orbit payout and Starfall progress sigils |
| Plain shard | Costs a shield; kills you when the bank is empty. Pulses as a warning, then arms. | dl ~4.5–11s | menu key row, L1 card, MEET lesson, hint ladder, death coach — all four now say "red costs a shield" *(reworded: three of them still said "red kills you", which is false for the first two hits of every run and directly contradicted the L1 card)* |
| Twin shards | Two shards on one ring, 0.30–0.40 rad apart. Wider than a single, so the escape has to be a ring change rather than a late reverse. Held until your first hop lands (max 30 dl-seconds). | dl 18 | banner + MEET lesson, one sentence: "two at once — swipe to another ring", death coach |
| Shield (green orb) | Banked up to 3 (cap grows late — empty slots draw as faint rings, so the max is visible). A hit spends one automatically, knocks you off your orbit, and grants 0.9s of invulnerability. Every run starts with two. | 1st power-up (~10s); the shield→slow-mo→nova intro trio fires once per RUN (`G.introN`), never again at a level boundary | L1 card, orb-naming hint, visible cap, and the save itself: "SHIELD USED · N LEFT", or "LAST SHIELD — RED KILLS NOW" with a darker cue when the bank empties *(new)* |
| Slow-mo (violet orb) | 6 seconds at 55% speed; 9 seconds with SLOW WORLD. | 2nd power-up | orb-naming hint beside the pickup, violet duration cue |
| Nova (white orb) | One expanding wave converts the original board's shards into reachable stars. New threats remain; expiry adds no invisible clear. Pickup grants 0.95s grace through the sweep. | 3rd power-up | orb-naming hint, visible segmented conversion front |
| Overcharge | While the shield bank is full, embers pay DOUBLE and a tight tap pays a flat +8; an overflow shield pays +50. The orbit payout is NOT doubled, which is why the line says "stars pay double" rather than "everything". | first full bank | "SHIELDS FULL — stars pay double" line (plus "BANK DEEPER" when the cap steps up and a full bank silently stops being full) + shimmer-up on every bank-fill, shimmer-down when it breaks, OVERCHARGED popup, visible cap rings *(new)* |
| Timing (`ON TIME`) | Optional timing rewards recognize committed turns and hops near the musical grid. Quarter-note accuracy grows the timing streak; tighter offbeat moves can sustain it. Timing colors the movement instrument and opens the arrangement, but does not charge Starfall or change what a gesture does. | first accurate moves | immediate keyed sound and brief timing feedback; no separate task or countdown |
| Music answers you | Turns and ring changes sound as chord tones; successful movement opens the arrangement. The controls always perform their normal movement. | first seconds | audible movement feedback; no separate musical task |
| Combo (`COMBO ×N`) | Each consecutively collected star pays more — additive under the idiom: a star at combo N pays +N, capped at +6. | first stars | `COMBO ×N` in the header *(reworded: it read `×2 COMBO`, backwards from the two labels under it)*, +N popups, combo lesson at first ×3 |
| Starfall | Complete three orbits that each collect a star; EARLY STARFALL reduces this to two. The reward releases automatically: red clears, new hazards pause, and three waves of stars arrive over about 9.23 seconds. Stars pay double, with a collected-star and score result afterward. No timing input is required; taps always turn. The real reward timer and waves suspend inside a black hole. | third star-fed orbit after the introduction | three progress sigils, a brief STARFALL / Catch the stars introduction, compact header status, visible gold-star flights, keyed musical release and final reward result |
| Near miss | Stopping just short of a shard, or sweeping past one mid-hop, pays +3 with a local contact mark. | first dodge | the contact mark and score |
| Movement instrument | Taps and swipes retain the same short chord-aware instrument through every musical passage. No input recording, replay mode, temporary melody task or drum remapping. | first movement | immediate sound attached to the actual turn or ring change |
| The chorus | Each world has a second progression. Sustained successful play opens it at a phrase boundary; cooling off returns to the verse. This changes the soundtrack automatically and does not request a new action. | earned engagement | the music itself; no instruction banner |
| Upgrade draft | Three of eleven upgrades are offered at each level boundary. Taken upgrades do not repeat; declined tiles may return when fresh choices run thin. LONGER STAR: 16 to 24 beats; DEEP BANK: start with three shields; SLOW WORLD: 6 to 9 seconds; RICH NOVA: two stars per converted shard; EARLY STARFALL: three star-fed orbits to two; LONG MAGNET: 10 to 16 seconds; LONG MIRROR: 16 to 24 beats; DEEP BURN: 8 to 13 seconds; STEADY HAND: 0.032 to 0.045s timing window; LONG SLIPSTREAM: 12 to 18 seconds; LONG STAR TRAIL: 16 to 24 seconds. LONG SLIPSTREAM enters on the level-2 card and LONG STAR TRAIL on level 3. | level 2 card onward | each tile's icon, name, and effect; every offered id has a live `upgOn` reader |
| Star dive (finale) | The level's closing melody laid out as a star trail; chase the brightest star, quick pickups pay double, dive the bloomed sun to end the level. | end of every level | banner + one-at-a-time burning stars |

## Level 2 — INTO THE RINGS (the ring threats, and the marquee star)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Gates | One angle blocked on EVERY ring — hopping cannot save you; reverse. Checked for solvability before spawning. | dl 100 | banner, MEET lesson, death coach |
| Drifters | Shards that slide along their ring at a fixed random heading, well under player speed; the chevron's point leads their motion. They do not steer. | dl 128 | banner + MEET lesson, one sentence: "it slides — the gap moves with it" *(reworded: the banner said "these ones chase you", which they never do, and both channels said "keep moving", which names no action — there is no input that stops you)*, longer first telegraphs, death coach |
| Shutters | Phase on a two-beat cycle at 0.55 duty: harmless as an open shutter, lethal as a solid red crystal. The shutter narrows toward re-arm at steady opacity. | dl 165 | banner + MEET lesson: "Pass through the open shape; avoid solid red", longer first telegraphs, death coach |
| Hypernova (pink star) | Sixteen beats of invincibility at nearly double speed: reds convert to paying embers on contact, stars and tight taps pay double, the kit doubles to sixteenths. **The song gets a star tune** *(new)*: sixteen sixteenths that climb and wrap — four ascending cells each starting a degree higher, so the line spirals and never resolves — restated every bar over a driving eighth-note bass, with the band's pad opening 1.22× underneath it. Written as `STARRUN` pentatonic degrees 4–10, above the band's degree-4 arp ceiling, so it is an interval over the level's tonic and transposes with the key. It is an **overlay, not a section**: it starts on the frame you take the orb, where the chorus lift the star also triggers can only land at a four-bar seam — up to most of a loop away against a star that lasts four bars. A black hole outranks it. The comet gains fins and an extended moving ribbon. Its three source-over passes compensate alpha for width, retaining a visible protected charge without a five-pass white boost or flickering core. | guaranteed first post-curriculum placement on level 2 — once per RUN (`hyperPlaced` survives level boundaries, and is pre-spent when a run opens past level 2) | MEET lesson — “hypernova — the pink star: untouchable and fast” — no slow-mo *(fixed)*, the lab row (HYPERNOVA there too; the working name “PINK STAR” is gone from every channel), the standing “HYPERNOVA ×2” chip in the orb's own magenta, and the tune and the tail — the two channels that do not need reading |
| Magnet (white/violet horseshoe) | For 10 seconds, stars within 110 scale units on the current or an adjacent ring curve into the moving comet over 0.38 seconds. The same position drives the crystal, glow and contact. Collection uses ordinary star/combo rewards; no tap or star multiplier. LONG MAGNET extends it to 16 seconds. Captured stars finish their flight after expiry; attraction and captured-star lifetime pause inside a black hole. | **Guaranteed on level 3**, once per run (`spotPlaced`; the internal `spot` and `stagelight` keys remain compatible with saves) | MEET and lab: "Nearby stars curve into you for 10 seconds"; visible curved collection, horseshoe artifact, named countdown and ordinary point popups |
| Overdrive | Hold the heat near max for a full bar: eight bars of double-time with embers and on-beat taps paying double. | heat-driven, reachable late L1, named on L2 card | "OVERDRIVE ×2" readout, gold band meter |
| Automatic drum fill | The accompaniment plays an authored fill during an earned arrangement change. Player inputs keep their ordinary chord-aware movement sound and are never remapped to drums. | earned musical engagement | the music itself; no instruction banner |

## Levels 3–5 — THE STORM to REDSHIFT

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Sliding gates | A gate whose wall drifts — reverse early, the exit is crowding shut. | dl 240 | banner + MEET lesson, one sentence: "the wall slides — turn around early", death coach |
| The saucer | The only shape placed against the **player** rather than the board. It takes station 0.55 rad off your tail and rides there, harmless, for 5–7.5s. Turn back and it does not move: the reversal leaves it in front of you, where it holds and charges for one beat, then blocks the whole ring it is standing on for 0.42s. Its body is never solid — only the shot is — so there is no contact death and the counter always exists: it is still on the ring you *left*, and it takes 0.42s to follow a hop. The charge cannot be cancelled by turning back again. One at a time, on a 9–15s cooldown, and **never on a board with a gate** — the gate exists to force a reversal and the saucer exists to price one, so the pair could demand a move and punish it in the same breath. | dl 275 *(new)* | banner + MEET lesson, one sentence: "turn back and it blocks your ring — swipe off", death coach |
| Shutter pairs | A twin whose halves strictly alternate at duty 0.5, offset half a cycle: at every instant exactly one side is solid and the other is the gap. | dl 310 *(moved from 295 to keep level 3's three shapes ~35 dl apart)* | banner + MEET lesson, one sentence: "The shapes take turns opening; pass through the open one" *(the pair ran at 0.55 duty, so both sides were armed for 10% of every cycle and the lesson was false exactly when a player acted on it; smoke.mjs now walks a full period and requires strict alternation)*, death coach |
| DIVERS | The first shard whose **ring is not the ring it armed on**. It telegraphs on one orbit and, 55% of the way through its own warning, transfers to an adjacent one — local arrival mark on the destination ring, a note in the level's key, and a radial guide with a chevron sitting on the destination for the whole telegraph. The remaining 45% of the warn is the lesson: where it lands is where it kills, and you were shown. Drift moves a shard *along* its ring; this is the only thing in the game that moves one *across* rings. Both the lane it leaves and the lane it lands in must be clear at placement or the spawn is rejected outright rather than downgraded — an unreadable arrival is neither fair nor survivable. Needs two orbits to mean anything, so it never rolls at `nRings < 2`. | dl 395 — inside level 4, the first formation the game has ever taught above dl 340 | banner + MEET lesson, one sentence: "it changes ring — watch where it lands", death coach |
| THE NARROWS | **The mirror of GATES, answered by the other gesture.** A wall across every ring but one. A gate blocks every lane and is answered by a TAP; this leaves exactly one lane and is answered by a HOP — the two verbs, one wall each, 420 difficulty-seconds apart. The open lane is always **adjacent to the comet's current ring and never the ring it is already on**, so exactly one swipe answers it and it can never be a wall that demands nothing. The open lane is held to a wider clearance (2.2 rad) than the walls (1.7), because it is the only way out and a shard sitting in it turns the formation from a demand into a trap. It does **not** use the gate's `reverseEscape` check — the escape it must guarantee is a lane, not an arc — and like every wall it may never share a board with another gate or with the saucer. Drawn as contiguous runs of blocked rings with the gap left as a visible hole, plus two comet-coloured steady brackets facing into the gap: a hole in a red wall is only readable if the eye is told it is a hole. | dl 520 — inside level 5 | banner + MEET lesson, one sentence: "one ring is open — swipe to it", death coach |
| THE EYE | The current tier ladder's final marker has `type:null`: it adds no shape or ring. Its dl 610 boundary coincides with the level-6 card. Later content may extend either table. | dl 610, level 6's floor | banner name |

### THE MIRROR *(new)* — level 4's orb

A second comet, opposite you on your own ring, for sixteen beats. It **gathers
what it passes and shatters red on contact**, it cannot be hurt, and it does
**not** protect you: red on your own half of the ring is exactly as lethal as it
ever was. That is what keeps it *presence* rather than immunity, and on a
circular board presence is a thing no other orb can offer — every existing
powerup changes what happens to YOU, and this one changes how much of the ring
is yours at once.

Its angle is **derived** (`G.angle + π`, with contact on `effRing()`) rather than integrated. A
chaser that accumulates its own position drifts and needs a controller, and the
magnetar died twice proving a first-order chase never arrives; a reflection has
no such problem, because it is not chasing anything. The contact check sweeps
the same travelled arc as the player's pickup check, and stays on the old
ring through the first half of a hop. Marked STAR TRAIL stars are left to the
player rather than collected automatically.

**It pays but does not advance the combo.** The chain is the game's measure of
the player's own hand, and a second collector feeding it would let an orb farm
the one number that is supposed to say how well *you* are playing. It pays at
the chain's current rate and leaves the chain where it found it.

Called THE MIRROR and not THE TWIN — the working name — because TWIN SHARDS is
a formation the player met at dl 18, and two unrelated things called twin is a
collision this file has paid for before. ECHO was the other candidate and is a
**banned string**: `check.mjs` fails the build on it, because an orb by that
name was cut and its teaching data outlived it.

| | |
|---|---|
| Introduced | level 4, guaranteed once per run (`mirrorPlaced`) — literally once: the flag survives level boundaries, and is pre-spent when a run opens past level 4 |
| Duration | 16 beats; 24 with LONG MIRROR |
| Taught by | MEET lesson, one sentence: "the mirror — a second you, gathering the far side" |
| Reads with sound off | yes — a second comet, a countdown ring, a HUD label |

### SCORCH *(new)* — level 5's orb

**Your wake burns.** For 8 seconds the arc of your own ring you have travelled
stays lit behind you, and any red standing in it — or arming into it — is
destroyed, converted through the same `novaConvert` path the nova uses, so the
lane you cleared pays you for clearing it.

**A full lap makes a full lap safe; sitting still makes almost nothing safe.**
That asymmetry is the entire design: it is the saucer's problem answered from
the reward side. The saucer prices camping by putting a threat behind a player
who will not travel; scorch pays travelling by making distance covered
literally the size of the benefit.

Stored per ring as a ring of **72 sectors** rather than as a list of arcs —
sectors cannot overlap, cannot leak, and cost one array. Painted from the
previous angle to the current one rather than at a point, because at 4.2 rad/s
a per-frame point sample leaves gaps between sectors, and a burn with holes in
it is a mechanic the player cannot trust. Drawn on the ring and **under** the
shards, so a red standing in the fire is still read as a red first.
The wake lifetime is at least one orbit at the current speed, with a 2.6s
minimum in gameplay time. Painting runs after the comet's actual movement;
hit-stop and teaching cannot paint a nominal arc the player never travelled.

Its colour is warm **orange**, deliberately not warm red: the rule that red
belongs to death alone is not negotiable, and `#ff5d73` is a pink, so the two
do not sit in the same family at a glance.

| | |
|---|---|
| Introduced | level 5, guaranteed once per run (`scorchPlaced`) — literally once: the flag survives level boundaries, and is pre-spent when a run opens past level 5 |
| Duration | 8s · 13s with DEEP BURN |
| Taught by | MEET lesson, one sentence: "scorch — keep moving, your wake burns red away" |
| Reads with sound off | yes — the burning arc, a HUD label |

### SLIPSTREAM — level 2's hop reward

For 12 seconds, each successful player hop converts non-saucer shards within
0.48 radians of the destination angle into stars on that ring. The landing
has 0.4s grace, awarded at most once per 0.8s. The clear still happens on every
valid hop, but chaining swipes cannot sustain immunity. Swipes beyond the
available rings and black-hole gravity do not activate it. LONG SLIPSTREAM
extends the duration to 18s. The level-2 guarantee follows hypernova, and the
fallback pool uses the same floor. The lesson is "slipstream — change ring
to clear your landing".

### STAR TRAIL — level 3's route reward

Nine marked gold stars wait ahead in the direction already being travelled,
alternating between the current ring and one adjacent ring. Each collects
normally, advances the combo, and adds four bonus points. They wait 16s,
or 24s with LONG STAR TRAIL; a new pickup replaces the previous route.
The sequence guides a chase without requiring collection in order, and
hazards remain. The level-3 guarantee follows Magnet, with the same floor
in the fallback pool. The lesson is "star trail — follow the gold stars
between rings".

Both rewards and their upgrades are available early enough to shape ordinary
runs. All ten orbs can also be selected directly in POWERUP TESTING. Ordinary
timed rewards, collectors, scorch sectors, and route lifetimes suspend inside
a black hole, then resume after its closing warp. Hard lessons defer while a
reward is active, so the player has time to use it.

## Level 3+ — BLACK HOLE MODE (rare, optional event)

**How often it arrives, rewritten for six levels.** The guarantee is once per
RUN now, not once per level. `bhPlaced` is cleared by every `startGame()` —
including a level advance — and the guarantee read `G.level>=4`, which was
exactly one level when it was written. With six levels that became a guaranteed
black hole on level 4, another on 5 and another on 6, on top of the ordinary
roll: `curriculum.mjs`'s own trace showed BLACK HOLE banners on L3, L4, L5 *and*
L6 of a single playthrough. The orb whose entire design is that it is rare —
*"a thing you meet twice a minute is a mechanic, not an event"* — had become the
most reliable pickup in the back half of the game. `G.bhRun` survives level
transitions and clears only when a run starts fresh; the ordinary roll drops
from 10% to 5% and still runs from level 3, so a second one is possible and
never promised. Same trace after: L4 and L5, one guaranteed and one rolled.


From a playtester, and built close to the pitch: *"It's not a power up. It's
something you hit in orbit and trigger. It's a rare mode. And it's optional…
It actually does things to make it both harder and easier simultaneously."*

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Black hole | Optional three-act wager: opening warp, inner-ring charge, then outward escape. The fourth ring opens over 0.85s. Motion settles at 0.60x; density ramps from 1.25x to 2x; gravity warns and pulls inward every 4s before ESCAPE. Settled innermost travel banks `dt/8` charge up to 1; arriving alone pays nothing. Inner stars pay double. At 12s gravity releases and fresh threat spawns stop; reach the outermost ring before 17s. Success pays `round((80 + 600*charge + 20*stars) / 1.5^min(3, shieldsSpent))` and 1.5s grace. Timeout loses the bank and a shield, or ends an unshielded ordinary run. Ordinary rewards and route stars suspend until closure; temporary-ring entities leave before that ring vanishes. | rare 5% roll from level 3; guaranteed offered once on level 4; shield pity precedes both branches; taking arms a 55s cooldown, declining 20s | charge meter, ESCAPE signal, and first-contact lesson |

**Historical audit, before the charge-and-escape overhaul.** The mode carried thirteen documented
sub-features and a playtester who had run it many times perceived one of them
("some purple color"). None of it was missing from the source; almost all of it
was unreachable, cancelled, or inaudible. The table preserves that feedback
and the fixes made in that earlier pass. Its old tuning and display numbers
are historical measurements, not claims about the current challenge above.

| Clause of the pitch | What was wrong | Fix from that earlier pass |
|---|---|---|
| "a super cool black hole backdrop" | The arena-scale black hole — well, accretion discs, photon ring, drawn at `radiusOf(0)` — was gated on `BG`, i.e. on **WebGL having failed**. It rendered only where the shader had given up. | Draws unconditionally; the shader composites under it. |
| same | The shader's lens `0.18/(brd+0.15)` exceeded `brd` inside 0.356 uv, **inverting the UV field** across the whole middle of the screen: the gravity well darkened nothing, and the disc and photon ring were pushed out to 249–358px, drawing as arcs behind the HUD. | Displacement clamped to `brd*0.72`; the field compresses instead of turning inside out. |
| same | `pow((rr-dR)/dW, 2.0)` — **`pow` with a negative base is undefined in GLSL ES**, and the base is negative for every fragment inside the ring radius. | `x*x`. |
| same | Every black-hole term measured from the **screen** centre, 41.8px off the arena centre on a notched phone. `uBH` pinned at 1.0 for all 17s while density and music ramped. | `uCtr` uniform; `uBH` ramps 0.55→1.0. |
| "the existing music immediately cuts out" | `musicStep` stopped scheduling, but the **pad is eight continuously running oscillators whose gain lives in `bedTick`**, which knew nothing about the mode. The level's progression sustained straight through at full level: 54% of the mix identical either side of the entry. Same bug the drop's hush had, never generalised. | `bedTick` cuts the pad in 0.05s and swells it back over 0.9s. |
| "super trippy and ominous" preset music | Tuned voices at gain 0.011–0.016 against the band's 0.050–0.085; **zero energy above 2 kHz** on a device that reproduces little below 500 Hz; the "metallic resonance on the minor third" passed a pitch to `hat()`'s **highpass-corner** argument; the second heartbeat's `bar>=8` guard could never fire because 17s is 7.37 bars. | Gains at the level of the record, a genuinely pitched metallic voice two octaves up, `fq`-keyed heartbeat, and an entry transient (`startBlackHole` scheduled zero voices). |
| "extended slow motion" | 0.55× — the same factor the slow-mo orb already uses, so the mode's biggest visual signature was one the player had seen. And the dilation reached the simulation and stopped: the backdrop, camera dolly, sky drift, ripples, arcs, popups, the comet's trail, the particles and the hop all ran on raw `dt`, so ~15 visible layers contradicted the 8 that slowed. The *depth of the number was never the problem.* | 0.42× (0.26× on entry), and a presentation clock `G.vt` that every visible layer rides. |
| same | The **tempo never changed** — 104 BPM in, 104 BPM inside, 29 identical quarter notes across the mode. In a rhythm game that is the one clock the player reads without ambiguity. | The preset piece runs at half tempo; the sixteenth lattice underneath is untouched, so the exit lands back in time. |
| "something cool to look forward to" (part 2) | The mode was named on screen for **0.92s of 18.7s** — a floating pickup popup — while HYPERNOVA, half its length, holds a standing label for 100% of its life. `G.banner`, the game's dedicated "something big happened" channel, was never set. The one explanatory sentence is a once-per-device lesson consumed at the first pickup, so **every black hole after a player's first was wordless.** | Banner at entry, standing `BLACK HOLE · 12s` label for the whole mode, and the fourth ring gets the same two-ripple/two-beep/one-sentence arrival every other new ring gets. |
| "double/triple amount of red obstacles" | `spawnGap()/bhDensity()` was drained by a timer ticking on **`sdt`, the slowed clock**, so real arrival was `0.55 × bhDensity()`: **0.825× at entry** — fewer shards than ordinary play — and never above 1.925×. Net effective pressure measured **0.83×**: the mode was *easier* than the level it interrupted. | Arrival runs on real time inside the mode. |
| "one more super small inner ring" | A fourth ring on a uniform draw is a **divisor**: the same budget over four orbits is 0.75× the per-ring density of three. | 45% inward lean on the draw. |
| "harder and easier simultaneously" | The gravity pull ran **backwards** — `G.ringI--` with index 0 being the *outermost* orbit pushed the comet to the widest, emptiest ring and then stopped forever — and the 2× star bonus paid on that **same** ring. Both systems that exist to price risk paid for avoiding it. | Pull drags inward and keeps pulling; 2× pays on the innermost orbit. `smoke.mjs` now fails if the direction flips. |
| "something cool to look forward to" | The 10% roll sat **below seven guaranteed placements**, and `startGame()` re-arms those flags at every level boundary — so a run that had met them all still spent level 3's first ~56s meeting them again. The median level-3 run dies at 55s; 64% never reached one roll. Telemetry: three `blackhole_entered` events in the game's history, all on level 4. | Both black-hole branches sit directly below `POW_INTRO`. |
| "it's optional" | Declining cost the full 55s cooldown *and* permanently satisfied level 4's guarantee. | Guarantee is to **offer**; a decline costs 20s. |

**The fourth ring is possible because the orbits re-space, not because the
gaps got smaller.** Adding a ring inside the shipped three puts it at f=0.33 —
55px from centre on a 390px phone — where `hitTol` makes one shard block 35.7°
of the orbit. That version was measured and rejected. Re-spacing all four
across the same annulus (`RAD_BH = [1.0, 0.80, 0.62, 0.45]`) puts the innermost
at 75px, where a shard blocks 26.2° — against the shipped inner ring's 21.6°, a
step rather than a cliff. The arena is also an ellipse (`AY` ≈ 1.41 in
portrait), which the original rejection did not account for: the re-spaced gaps
are 33/30/28px horizontally but **47/42/40px vertically**, wider than the gaps
the shipped three rings already run at their tightest, against a 7.4px comet
and a 9.3px shard.

`RADII` is therefore live and eased rather than constant, and the ring halos
are baked once at `RAD_BAKE` and scaled at draw time so a warp costs no
re-bake. The comet's ring **index** never changes during a warp — only the
radius that index resolves to — so nothing about position, collision or input
has to know it is happening. `smoke.mjs` drives a whole black hole and fails if
the orbits do not come back.

**The music follows the same three acts as the challenge.** Half-tempo pulses
build from one to two to four per bar; a deep tonic and the natural minor's
tritone leave space for the distant beacon. Inner-ring charge strengthens
the beacon, and the escape window brings a rising phrase. Pitches remain
diatonic rather than continuously detuning the record. The ordinary pad and
performer wait until the black hole releases the stage.

## Levels 4–6 — EVENT HORIZON, REDSHIFT, HEAT DEATH

Six keys now, and the descent is whole-tone: **A → G → F → E♭ → D♭ → B**, one
whole step per level, so the lap closes one whole step above the A it started
on. Each level owns its own minor-mode cadence (see `PROG`) — going deeper
still deepens the music, and it also changes what the music is doing.

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| The storm | Every threat and orb from levels 1–2 active at once plus level 3's own three shapes (their rows are above), spawn pool filling from the first second, speed climbing toward the 4.2 rad/s ceiling. **Finite** — it has a finish line at dl 340 and a star dive of its own. | dl 215 *(aligned to the level 3 start — was 380)* | L3 intro card: "the shapes start combining" / "survive to the star dive" |
| Event horizon | Level 4 introduces DIVERS (dl 395), THE MIRROR, and the guaranteed black-hole offer; it finishes at dl 470. E-flat minor tonic pedal and octave-jumping bass. | dl 340 | level card and first-contact lessons |
| Redshift | Level 5 introduces THE NARROWS at dl 520 and SCORCH, then finishes at dl 610. D-flat minor with descending-fifths harmony. | dl 470 | level card and first-contact lessons |
| Heat death | The current content frontier draws on the rewards and formations introduced earlier. Its present `end:Infinity` keeps the clock running after dl 610; later levels can extend the run and introduce more content. B minor, with a cold three-minor-chord loop and one fleeting major lift. | dl 610 | level card |

## Before the run — the front screens

None of these gates progression, and none of them changes what is taught.

| Screen | How it works | Explained by |
|---|---|---|
| Title screen | **No longer a picker.** The mode cards went with CHILL *(new)*. What is left is the record line under the title — `BEST · LEVEL n · score`, or "no runs yet" on a fresh device — the four-row key, the POWERUP TESTING door and START. A tap anywhere begins, as it did before the cards arrived: with no selection on the screen, a stray tap costs nothing, which is the only thing the select-don't-start rule existed to prevent. | the key rows, and the demo comet running the two verbs behind them |
| Swipe rule chooser | Unchanged. Still once per device, still between the title screen and the run — it hands off to `enterRunStart`: the level picker for a device with a run behind it, level 1's own card for a first-ever run. | live arena with both rules tryable |
| Level picker | Six rows, one per level, plus START and back, under the sub "pick a level" *(the orphaned mode name SKILL is gone from the screen)*. It appears from a device's **second run**: a fresh device goes from the swipe chooser straight to level 1's card, because "start where?" is not a question a player with zero runs can answer — and one run, however short, opens it, so the picker's testing purpose survives. From then on **every level is selectable**, including ones never reached — the screen exists so a level can be tested without playing to it. Rows the device has actually reached are marked *reached*, so picked and earned stay visibly different. Level 1 for a returning player starts instantly; every other pick goes through that level's own intro card first. Arrow keys move the selection, Enter starts. | the rows name the level and its title; *reached* marks the honest ones |
| POWERUP TESTING bar (title screen) | A wide bar **below the how-to key rows** — it sat in the dead mode-card slot above them for a while, which made the door to a debug sandbox the second thing a first-time visitor read — and a **door rather than a card**: tapping it opens the powerup picker instead of selecting anything. Deliberately not a third mode — `MODES` is the difficulty table and the lab pins the difficulty rather than scaling it. A fresh device is asked the swipe rule on the way through, once, exactly as the run route is. | the bar draws the orb currently armed, so it says what is behind it with the object |
| Powerup picker (the lab) | Ten choices: nine ordinary orbs plus the black hole, with a red-cannot-touch-you toggle, START, and back. Rows fold into two columns when available height requires it. Arrow keys select, G toggles the ghost, Enter starts, Escape returns. | Each choice uses the arena's `drawPow` icon and a short explanation. |

## One mode, and the table kept for the next one

**CHILL is retired for now** *(new)* — the owner's call: one mode until the
game is perfected. The `MODES` table stays at a single row, and that row is
still the **identity**: all its knobs are 1 (0 for the additive shield), which
is what makes "the game is the balance that shipped" a checkable fact rather
than a hope. `check.mjs` still fails the build if the row stops being the
identity, if any knob is never read, or if a future second row grows a knob
skill lacks.

Keeping the table costs one row and preserves the rule that took work to
arrive at: **a second difficulty is a derivative, never a second
implementation.** Deleting it would leave a future mode to rediscover that,
most likely as a branch on a flag in the game code — exactly what the table
exists to prevent.

| Knob | Value | What it reaches | What a second mode would use it for |
|---|---|---|---|
| `clock` | 1 | `dl()` — difficulty-seconds per real second | The main lever: speed, cap, gap, warn, the tier ladder and the finish line are all keyed off `dl`, so one number eases all six in the proportions they were tuned in. |
| `speed` | 1 | `speedAt()`, ceiling included | A genuinely slower fastest board, not merely a later one. |
| `warn` | 1 | `warnTime()` — the telegraph | A longer look at what is arriving. |
| `cap` | 1 | `shardCap()`, floored at one | Fewer shards on the board. |
| `gap` | 1 | `spawnGap()` — arrival rate | Cap and rate move together, for the same reason the black hole scales both. |
| `shields` | 0 | Starting bank, **additive** | A deeper bank. DEEP BANK still means one more shield on top. |
| `demo` | 1 | The title screen's demo comet | Made a pick legible before it was committed to; now simply runs the demo at the game's own pace. |

`smoke.mjs` is what keeps those wires alive with nothing shipped on them: it
**injects a synthetic mode** with every knob off neutral and measures every
curve through the real functions at the same difficulty second, so a table
wired to nothing cannot pass. It also asserts a mode moves no tier, no finish
line and no level boundary — the curriculum is gated on `G.level` and `dl`, so
a mode changes how many seconds a run takes to reach a rung, never which rung.

**No player loses a record.** Every value ever written to `cometloop:best` and
`cometloop:gl` was SKILL's, because chill's went to `:chill`-suffixed keys
precisely so an easier mode could never redefine the plain one — the failure
the retired `cometloop:level` key is remembered for. The plain keys therefore
mean exactly what they always meant, with nothing to migrate. The `:chill`
keys and `cometloop:mode` are **left on disk deliberately**: they cost a few
bytes, nothing reads them, and they are somebody's record. `cometloop:mode` is
no longer read at all — a device that last played chill has `chill` sitting
under it, and honouring that would select a mode that does not exist.

The death screen's best line drops its mode qualifier, and the share text
keeps `· from Ln` and loses `· CHILL`. A default run started at level 1 shares
exactly the text that shipped.

**A picked start cannot forge a climb.** `G.startLevel` records the level a run
opened on, and the level record only moves for a run that began at level 1 —
so choosing EVENT HORIZON and dying on the first shard prints no FURTHEST YET
and writes no record. A run that started at level 1 and climbed keeps counting,
including across the retries that put it on a later level.

## Pause

Requested by players. A small icon top-left, mirroring the mute icon top-right
at the same size and inset — small and inset on purpose, because the arena
answers a tap *anywhere* with a reversal, so every pixel given to a pause
control is a pixel where a reversal silently becomes a pause.

| Piece | How it works |
|---|---|
| The freeze | One early return in `update()`, placed **before** `G.t+=dt`. Every deadline in the file is written against `G.t`, so that single line stops all of them together — invulnerability, spawn timers, cooldowns, lesson spacing, the tier ladder, the difficulty clock, `G.vt`, and `bhTick`, which lives inside `update()` and would otherwise run the black hole to completion behind the panel. |
| Not a state | `PAUSE` is a flag; `G.state` stays `'playing'`. `draw()` dispatches on the state with the **death screen as its final `else`**, so a `'paused'` state would have rendered GAME OVER over a live run. |
| The board is hidden | The panel is opaque. Shards telegraph for 1–2.35s, and a button that freezes a warning mid-flight and lets you read the board at leisure is a difficulty change wearing a convenience label. You cannot study what is not drawn. |
| The count-in | RESUME shows the frozen board again for 3 seconds — enough to find the comet — and only then does time restart. Nothing takes input during it. |
| The cooldown | Pause re-arms 5 seconds after play actually restarts. Without it, pause–resume–pause is an unlimited supply of 3-second frozen looks at a live board: the hidden board's protection reassembled out of its own escape hatch. |
| Run time | `runTime()` reads `G.deadT-G.started`, both on `G.t`, so paused seconds leave the reported run length for free rather than by subtraction. |
| Audio | The context is **left running**. `musicTick` already survives an arbitrary gap — it detects `MU.next` falling >0.4s behind, abandons the section rather than replaying it compressed, and restarts on the next grid line. That is the path a backgrounded tab has always taken. Pause does exactly what the `visibilitychange` handler does: `endSection()`, drain the flash queues, take the bed down. |

**The trap this file already predicted.** *Silencing the scheduler is not
silencing the band.* The pad is eight continuously running oscillators whose
gain is written every frame by `bedTick`, its only writer — so freezing
`update()` does not silence the pad, it **freezes it**, droning one chord at
playing volume for as long as the panel is up. The bed is taken down
explicitly on the way in; `bedTick` restores it on the first live frame.

Telemetry: `pauses` and `paused_seconds`, on **both** `run_ended` and
`level_cleared`. Twenty short pauses and one long break are different
behaviours and only the pair tells them apart — the hidden board and the
count-in were balanced on an assumption, and this is what would show it wrong.

Two things about that pair are easy to get wrong and were:

- **They are per level, like the `seconds` beside them.** `startGame()`
  re-baselines the counters at every level boundary and `run_ended` only fires
  on death, so a pause taken on level 1 of a run that died on level 4 was
  recorded nowhere until `level_cleared` carried them too. Reported per level
  rather than carried into `run_ended`, because a cumulative number sitting
  next to a per-level `seconds` on the same event is one name with two scales —
  the shape of the retired `level` bug, not a fix for it.
- **Paused time is wall-clock, never the frame delta.** `frame()` clamps `dt`
  to 0.05s and `requestAnimationFrame` does not fire at all while a tab is
  hidden, so a break taken with the phone locked produces no frames — and a
  `dt` accumulator recorded a ten-minute break as 0.05 seconds, reporting the
  exact case the field exists to detect as its opposite. The count-in still
  rides `dt` on purpose: it is an animation, and a tab backgrounded mid-count
  should hold rather than silently expire.

## POWERUP TESTING (the lab)

A sandbox for looking at one orb, reached from the bar under the title
screen's key rows. It teaches nothing, gates nothing and changes nothing
about the game it sits in front of — it exists because the ten choices
arrive at different stages of a run and the black hole is rare on purpose, so
finding out what one feels like used to mean playing until the game offered
it.

| Piece | How it works |
|---|---|
| The orb | Whichever of the ten is picked, and only that one. `spawnPow()` bypasses the intro trio, level floors, guarantees, shield pity, and black-hole rarity. |
| How often | One orb on the board at a time (the real game never has two), refilled about 3 seconds after one is taken instead of 10–15. Measured: 7–10 placements per 45 seconds for a plain orb, and 4 full black holes — against three `blackhole_entered` events in the game's entire recorded history. |
| The board | `dl()` returns `LAB_DL` (40) and never moves. That is exactly `TIERS[3].at`, the lowest clock value that gives the arena all three orbits — the black hole opens a *fourth* on entry, so a one-ring lab would have demonstrated that against nothing. Everything else follows from the pinned clock: shard cap 4, arrival gap 2.4s, speed 1.62 of a 4.2 ceiling, a 2.35s telegraph. Level 1's finish line is dl 90, so nothing ever finishes and no tier ever arrives mid-session. |
| The ghost | *red cannot touch you*, on by default, flipped on the picker or with **G**. Read at the single lethal-contact site, ahead of the hypernova and shield branches: no shield is spent, no pip moves, no popup, no i-frame. The shard stays on the board and keeps travelling, so watching one pass through you is how you can tell it is on. Turn it off and the lab is the real game with one orb in it. |
| The way out | A pill in the top-left of a lab run, live on the death screen too, plus **Escape**. A ghosted run cannot end by itself, so without a door the only exit would be a page reload. Leaving mid-black-hole resets the mode outright — `bhTick` runs on `bhActive()` as well as on `playing`, so an abandoned horizon would otherwise keep rewriting `RADII` under the picker. |
| The difficulty mode | The one mode's trims (`speed`, `warn`, `cap`, `gap`, `shields`) still apply — with `MODES` at the identity row they are all neutral. Only `clock` is bypassed, because a pinned constant has nothing to scale. |

**Nothing a lab session does reaches the device.** No score becomes a best, no
level record moves, the lifetime run count does not advance, the struggle
streak — which lengthens every future run's calm opening — is not fed, no
first-encounter lesson is spent or re-armed, and the death screen offers no
share because `runSummary()` has no room to say any of the above. Telemetry is
suppressed at the choke point in `track()` rather than tagged, so a lab run
cannot reach the funnel and an event added later inherits that for free; one
event, `powerup_lab_started`, carries the chosen orb. `smoke.mjs` snapshots
`localStorage` across an entire lab session — entry, orbs taken, a forced
death — and fails if a single key changes.

**Two writers spend a lesson, not one.** `firstMeet()` fires the sentence, and
the pickup path separately treats *taking* a musical orb as having been taught
it. The lab hands you the same orb every few seconds, so guarding only the
first would have let one black hole session permanently retire the black hole's
lesson on a device that had never met one. Both are guarded; the harness found
the second.

**And the gameplay verbs write, not just the menus.** `hop()` persists
`cometloop:hopped`, and `G.everHopped` gates the **first-hop rehearsal** — the
once-ever dilation, held spawns and radial guide that fire when the second ring
lands for someone who has never hopped. The lab runs on three rings, so a fresh
player who opened it first and swiped once would have spent that rehearsal on a
sandbox and met the real second ring with nothing. `tryLand()` and
`judgeTiming()` persist two more. All three are guarded, and neither of the
last two is reachable in `smoke.mjs` — both return immediately without WebAudio,
which smoke removes by design — so `check.mjs` carries a tripwire on the set of
persisted keys instead: a new one cannot be added without someone being asked
whether the lab must be kept out of it.

## Cross-level systems (never gate progression)

| System | How it works | Explained by |
|---|---|---|
| Score-bought band layers | Score thresholds make additional accompaniment available; the calm/engaged arrangement still decides which voices sound. Music changes automatically without asking for another control. | audible arrangement |
| Band meter (retired) | The old standing dot row is removed. Musical growth is heard; the HUD prioritizes score, level progress, shields and active powers. | no current instruction |
| New sounds | The star's instrument steps up at the THIRD RING, SHUTTERS and THE EYE rungs (`T_VOICE`, derived from the table rather than hardcoded ordinals). The announcement fires **once per voice per visit** — `SND_SEEN` is keyed by voice ordinal, so TWIN SYNTHS and SYNTH LEAD no longer announce twice and ELECTRIC GUITAR now announces at all — waits for its level banner to clear, and defers during a black hole. | "NEW SOUND" announcement, death-screen "next sound" hook |
| Difficulty clock | Difficulty advances with time plus a capped nudge from good play. Current tuning holds the warning floor at 1.00 through dl 610, then eases to 0.86 by about dl 790. The spawn-gap floor decays from 0.80 to 0.50 after dl 340. Caps step at dl 445 and 575, away from the DIVERS and NARROWS lessons, then continue beyond dl 650. Later levels may extend these tuning anchors. | internal tuning |
| Level record | The deepest level a device has ever reached (`cometloop:gl`; still keyed by mode, and skill's key is the unsuffixed one). It moves at death, beside the high score, so the announcement fires exactly once and a retry of the same level stays quiet — and only for a run that began at level 1, so a level picked from the front screen can never move it *(new)*. | death screen: **FURTHEST YET** in place of NEW BEST, otherwise "BEST · LEVEL n · score"; the death-screen pip row, one pip per level |

## The sky

The default web flight view maps the six existing levels to Earth and Moon,
Saturn, Neptune, a stellar nursery, a galactic centre and Pelagic, an alien
ocean world. These are selected destinations, not every planet or a complete
larger campaign. Original procedural shader spheres, rings and moons supply
depth in the scenery; gameplay remains on its existing orbital canvas. The
eight procedural worlds remain the underlying palette, classic view and lab
scene. Their geometry and materials change along the original world journey;
unmarked alpha artwork adds detail. See
[the current direction](docs/design/direction.md) and
[the effects audit](docs/design/effects-audit.md).

| System | How it works | Explained by |
|---|---|---|
| Destination flybys | A copied `voyage` view drives approach, passage and recession through the six destinations. It reads the existing level finish-line progress and owns no clock, score, unlock or save. Intro starts at Earth with zero progress; the picker previews a destination; the lab keeps its original scene. Pelagic's camera approaches its endpoint without completing the infinite final level. | Destination and phase labels in the run header; route and destination cards. |
| Wormhole passage | Only the completed-level resting card shows a wormhole. It has no steering, collectibles, challenge or reward. Upgrade choice is untimed; the first live frame of the next level clears the passage. Selected-start and retry introduction cards do not open it. Reduced motion keeps the resting passage static. | Completed-level card and the existing continue/upgrade actions. |
| Worlds | In the classic view and lab, DRIFT, TIDE, DUSTLANE, GLASS, EMBERFALL, VEIL, GRID and DEEP FIELD have distinct planet placement, ring geometry, cloud structure and palette. CPU interpolation carries that composition between worlds. `LEVEL_HOME = [0,1,2,3,4,7]` sets each level's opening floor. The default voyage covers this classic scenery with its separate destination scene. | Classic scenery shows the underlying world journey; voyage labels and flybys show destination progress. |
| Underlying world journey | Each completed orbit advances one seventh of a world; a slow underlying advance of one world per 150 seconds of play keeps a struggling player moving. Each run opens at its level's home floor. This existing world/material travel is distinct from the destination camera's level progress. | The orbit lesson introduces the connection. |
| Flight currents | Existing committed-path and comet-wake responses remain. In the classic sky, accumulated travel also advects the nebula and atmosphere, with turn and hop disturbances. The opaque destination scenery does not yet use those sky envelopes; its camera follows level progress. Pause freezes current history; retry clears it. | The comet's path and wake remain visible; surrounding material responses belong to the classic sky. |
| Orbit pressure | Star-fed orbit charge and current fed-lap progress deform the classic planet's rings and surface material. Those deformations are covered by the default destination scene. The short local gold orbit marker and progress sigils remain visible; scoring and audio are unchanged. | Progress sigils and the orbit marker in both views; changing ring geometry in the classic sky. |
| Starfall | Three real gold-star waves curve toward playable rings from the original sky's planet anchor. That emission anchor is not yet connected to the visible voyage sphere. Outward material contours belong to the covered classic sky. The stars' visible flight and actual contact positions still agree; reward timing, scoring and audio are unchanged. | The arriving stars remain the reward, with compact status and sound; a visible planet-origin connection is currently specific to the classic sky. |
| Power forces | Magnet's attraction of nearby stars and the existing Scorch and black-hole gameplay and canvas effects remain. Their shared sky envelopes bend classic streams, warm the traveled material and pull surrounding layers inward. The opaque voyage scenery does not yet display those classic surface responses. | Existing gameplay and canvas feedback remain; surrounding material displacement belongs to the classic sky. |
| Readability and fallback | `SKY_ARENA_CALM = 0.62` preserves readable hazards against rich scenery. `GL_MOTION = 1.0` retains the authored motion baseline. Steady stars and material lighting preserve depth; the canvas path retains the composed world when WebGL is unavailable. | Scene contrast supports the actual route and threats. |

`skyI` remains the ladder band used by the drum-kit flavor and level floor.
It is distinct from the continuously traveled world composition.

## The teaching channels

- **Playable introduction**: first Launch enters a safe run. A committed turn,
  star collection, completed orbit and successful ring change advance four
  short steps. Skip remains available; Learn to play reopens the introduction.
- **Tier banners**: one named formation at a time, with a short action cue.
- **MEET lessons**: first contact holds the action long enough to read one
  instruction. A steady local bracket identifies the specimen; there is no
  full-field dark veil or flashing spotlight. A death to a taught mechanic
  can re-arm its lesson once per device.
- **Hint ladder**: one glyph and action sentence at a time; the cue clears
  when the player performs the action.
- **Level cards**: between levels, the card previews the next addition and
  offers upgrades. The first-ever run uses the playable introduction instead
  of an upfront card.
- **Death coach** — one line naming what killed you, with its counter-move.
  Covers every formation type *(new)*.
- **Sound cues** — three sounds with fixed meanings: the unlock call
  (tier banners), the lesson chime (first-encounter lessons), the state
  shimmer up/down (overcharge, Magnet, overdrive begin/end) *(new)*.
- **The insist rule** — while an unlocked shape's lesson has not landed,
  it is the next spawn until `firstMeet` finds calm; unseen orbs re-place
  on expiry, and using an orb counts as its introduction. Enforced by
   `tools/curriculum.mjs`, which drives the current frontier, requires the
   new rewards by their home levels, and checks reachable first-contact lessons.
- **Telemetry** — `run_ended` carries `did_hop`/`death_cause`/`misread_rate`;
  `lesson_shown` and `card_shown` events, plus `killer_lesson_seen` /
  `killer_relessoned` / `lessons_shown` on `run_ended`, measure whether
  teaching lands; `drops_earned`/`lands`, `hold_timeout`, `best_combo`,
  `best_groove`, `loop_caught`, `near_misses` and the orb pickup flags
  measure whether the taught systems get USED *(new)*.
