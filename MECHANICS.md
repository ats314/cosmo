# The mechanics ledger

One row per player-facing mechanic: what it does, where the game introduces
it, and every channel that explains it. The curriculum rule this table
enforces, **as the owner revised it**, now differs by kind:
**every FORMATION is introduced and explained by the end of level 3** — level 4
opens with every shape known and active and introduces none — while **orbs and
modes are spread across all four levels**, taught at first contact wherever
that falls. Shield/slow-mo/nova on level 1, hypernova and bass bomb on level 2,
spotlight on level 3, the black hole guaranteed to be offered once on level 4.

Difficulty-level (`dl`) values are difficulty-seconds — see `dl()` in
`index.html`. Level windows: level 1 spans dl 0–90, level 2 spans 90–215,
level 3 spans 215–340, and level 4 is 340 onward. A tier marked *(moved)* was
pulled by a curriculum pass; no FORMATION is ever met past dl 340.

**Teaching runs through level 3 now.** The two compound shapes — a gate that
also drifts, a twin that also blinks — used to arrive 22 dl-seconds apart at
the end of level 2, immediately after their two ingredients, which was the
densest stretch in the game and exactly where a playtester reported losing
track of the rules. Adding level 4 had made that worse rather than better:
every tier still unlocked inside dl 0–215 while an entire level taught nothing.
Level 2 now carries three shapes ~35 apart instead of five ~22 apart, level 3
carries three shapes at that same ~35 spacing — the two compounds and THE
SAUCER — and level 4 is the exam.

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

**Level 3 used to be endless and therefore last.** It has a finish line and a
star dive of its own now, and level 4 (EVENT HORIZON) took over as the level
you do not finish — which keeps "the last level is the exam" true instead of
making level 3 both the exam and the middle of the game. Every tier unlocks by
dl 340, so level 4 introduces no shape. `check.mjs` reads level 2's finish line positionally
(`ends[1]`) rather than as `max(ends)`, which was the same number only while
there were exactly three levels.

## Level 1 — LIFT OFF (the verbs, the economy, the core orbs)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Reverse (tap) | Flips your direction instantly. Costs the orbit in progress and the lap streak; embers already gathered stay banked. | first seconds | menu demo + key row, hint ladder, first-reversal orbit lesson *(new)* |
| Hop (swipe) | Jumps one ring inward/outward. **Two rules, chosen by the player.** *Away is out* (radial): read against the line from the centre through the comet, so at the bottom of the loop you swipe down to go out. *Up is out* (screen): up is the outer ring wherever the comet is. They agree at the sides of the loop and invert at the bottom; `swipeOut()` is the only place either is expressed. | dl 12 (SECOND RING, ~20s) | the WHICH WAY IS OUT chooser (once per device, re-openable from the menu's swipe row), menu demo + key row, banner, one-time slow-mo rehearsal, hint ladder, death coach — all five sentences follow the active rule via `swipeWords()` *(they all said "swipe up or down", which described the screen rule while the game shipped the radial one)* |
| Rings | Inner rings are tighter (shards block twice the angle) and run a hotter kit — `RINGS[].lift` climbs 0/380/820 going in. Angular speed is the same on every ring and an ember pays the same wherever taken. | ring 2 at dl 12, ring 3 at dl 40 | banners + camp hint, one sentence: "inside is tighter — the music runs hotter" *(the THIRD RING banner claimed "faster and higher"; neither was true)* |
| Stars (embers) | Collectibles worth a rising combo up to ×6 while you keep collecting. They play the band's own instrument. | ~0.5s | menu key row, hint ladder |
| Orbit scoring | A full 360° without reversing pays out by the embers gathered *during* that orbit; consecutive fed orbits stack a streak. Reversing forfeits the orbit, never the banked embers. | first lap | hint ladder, first mid-orbit reversal lesson *(new)*, lap pips + payout popups |
| Plain shard | Costs a shield; kills you when the bank is empty. Pulses as a warning, then arms. | dl ~4.5–11s | menu key row, L1 card, MEET lesson, hint ladder, death coach — all four now say "red costs a shield" *(reworded: three of them still said "red kills you", which is false for the first two hits of every run and directly contradicted the L1 card)* |
| Twin shards | Two shards on one ring, 0.30–0.40 rad apart. Wider than a single, so the escape has to be a ring change rather than a late reverse. Held until your first hop lands (max 30 dl-seconds). | dl 18 | banner + MEET lesson, one sentence: "two at once — swipe to another ring", death coach |
| Shield (green orb) | Banked up to 3 (cap grows late — empty slots draw as faint rings, so the max is visible). A hit spends one automatically, knocks you off your orbit, and grants 0.9s of invulnerability. Every run starts with two. | 1st power-up (~10s) | L1 card, orb-naming hint, visible cap, and the save itself: "SHIELD USED · N LEFT", or "LAST SHIELD — RED KILLS NOW" with a darker cue when the bank empties *(new)* |
| Slow-mo (violet orb) | 4 seconds at 55% speed. | 2nd power-up | orb-naming hint while the orb is on the board *(its menu key row was cut — the hint teaches it beside the thing itself)* |
| Nova (white orb) | Converts every shard in the wave to paying embers. | 3rd power-up | orb-naming hint while the orb is on the board *(its menu key row was cut — the hint teaches it beside the thing itself)* |
| Overcharge | While the shield bank is full, embers pay DOUBLE and a tight tap pays a flat +8; an overflow shield pays +50. The orbit payout is NOT doubled, which is why the line says "stars pay double" rather than "everything". | first full bank | "SHIELDS FULL — stars pay double" line (plus "BANK DEEPER" when the cap steps up and a full bank silently stops being full) + shimmer-up on every bank-fill, shimmer-down when it breaks, OVERCHARGED popup, visible cap rings *(new)* |
| On-beat chain | Inputs judged against the sixteenth grid (consistency, not absolute timing). Tight play climbs ON BEAT ×8: each rung a scale-step tone, ×8 pays a build bonus and opens the band. | first tight taps | per-rung tones, popups from ×2, "on the beat" lesson at first ×2 *(new)*, ×8 payoff line *(new)*, hint ladder |
| Music answers you | Every tap and hop places a note on the grid; input builds heat that opens the arrangement. The game's meta-rule. | first seconds | "your moves play the music" lesson in level 1's calm — now the only channel, the L1 card row having been cut to keep first contact to three rules |
| Combo | Each consecutively collected star pays more, up to ×6. | first stars | ×N popups, combo lesson at first ×3 *(new)* |
| Beat drop | Playing well fills an invisible meter; the music rises, counts 3…2…1…NOW! — any move on NOW lands it for a big bonus and a payoff section where everything pays more. | first drop (~50s worst case) | countdown numerals, "BEAT DROP COMING…", hint ladder *(its menu key row was cut — a sentence about "the drop" read before the first one means nothing)* |
| Near miss | Stopping just short of a shard, or sweeping past one mid-hop, pays +3 with a white spark. | first dodge | the spark itself |
| Loop recorder | Quantised inputs land on a rolling two-bar tape; a real phrase becomes the active loop, harmonised into the song. | first phrase | "YOUR BEAT IS IN THE SONG" line, cyan band-meter dot blinking with the ghost *(new)* |
| The chorus | Each level's song has a second progression (`PROGB`). Hot play — ON BEAT ×4, overdrive, hypernova, real heat, or a payoff's afterglow — lifts the record into it at the next four-bar seam; cooling off settles it back to the verse. Riding it pays tight taps +8 like the other standing states. Every drop resolves into the chorus, so it is guaranteed roughly as often as the drop is. A level's first eight bars are always the verse. | first hot seam, or first drop's afterglow (~1.5 min worst case: the drop's ~50s trickle plus its rise, section and glow) | "THE SONG LIFTS — chorus" line once per run, ambient CHORUS readout in the groove counter's violet, and the lift itself: new harmony, chorus arp, seventh color tone, deeper pump, and an open offbeat hat + backbeat wherever the sky band is not already riding them (the sky floors at the level, so on levels 3-4 those arrive from the sky and the chorus adds only what is missing) |
| Upgrade draft | At the start of every level after the first, three of eight upgrades are offered and one is taken; the pick is the tap that starts the level. `G.offered` prevents a repeat within a run. **LONGER STAR** hypernova 16→24 beats · **DEEP BANK** start with three shields not two · **SLOW WORLD** slow-mo 4s→6s · **RICH NOVA** two embers per converted shard · **HAIR TRIGGER** the drop arms at 0.85 of the meter · **LONG FUSE** the bass bomb clears 1.05→1.5 rad · **STAGE LIGHT** spotlight 16→24 beats · **STEADY HAND** on-beat window 0.032→0.045s. | level 2 card onward | the tiles themselves — icon, name and one line each *(all nine — WIDE PULL was removed with the magnetar — were UNWIRED until recently: `upgOn` had zero call sites, so every tile was a decision the player paid for and the game ignored. `check.mjs` fails the build if an offered id is never read.)* |
| Star dive (finale) | The level's closing melody laid out as a star trail; chase the brightest star, chains pay double, dive the bloomed sun to end the level. | end of every level | banner + one-at-a-time burning stars |

## Level 2 — INTO THE RINGS (every remaining threat and orb)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Gates | One angle blocked on EVERY ring — hopping cannot save you; reverse. Checked for solvability before spawning. | dl 100 | banner, MEET lesson, death coach |
| Drifters | Shards that slide along their ring at a fixed random heading, well under player speed; the chevron's point leads their motion. They do not steer. | dl 128 | banner + MEET lesson, one sentence: "it slides — the gap moves with it" *(reworded: the banner said "these ones chase you", which they never do, and both channels said "keep moving", which names no action — there is no input that stops you)*, longer first telegraphs, death coach |
| Blinkers | Phase on a two-beat cycle at 0.55 duty: harmless while dim, lethal while lit; the core fills as re-arm approaches. | dl 165 | banner + MEET lesson, one sentence: "harmless while dim — cross it then", longer first telegraphs, death coach |
| Hypernova (pink star) | Sixteen beats of invincibility at nearly double speed: reds convert to paying embers on contact, everything pays double, the kit doubles to sixteenths. | guaranteed first post-curriculum placement on level 2 | MEET lesson naming the speed *(reworded)*, no slow-mo *(fixed)* |
| Bass bomb (cyan orb) | Clears every shard in the neighbourhood and drops the low end. | guaranteed on level 2 *(new — was a dice roll)* | MEET lesson |
| Spotlight (white/violet orb) | Four bars where you are the lead: your instrument doubles, tight taps pay double. | **guaranteed on level 3** *(moved from level 2 by the introduction rebalance — six of the seven orbs used to be met by the end of level 2 while levels 3 and 4 introduced nothing. Spotlight moves best: it is the least load-bearing of the three guarantees and a pure reward, so meeting it later costs nothing that was needed earlier.)* | MEET lesson, no slow-mo *(fixed)* |
| Overdrive | Hold the heat near max for a full bar: eight bars of double-time with embers and on-beat taps paying double. | heat-driven, reachable late L1, named on L2 card | "OVERDRIVE ×2" readout, gold band meter |
| Drum break | The band steps out for a bar and your inputs ARE the fill — taps land as snares, hops as kicks. | heat-driven, named on L2 card | caption *(per-run again, new)*, input flashes — snare white, kick gold *(new)* |

## Level 3 — THE STORM (the last teaching level)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Sliding gates | A gate whose wall drifts — reverse early, the exit is crowding shut. | dl 240 | banner + MEET lesson, one sentence: "the wall slides — turn around early", death coach |
| The saucer | The only shape placed against the **player** rather than the board. It takes station 0.55 rad off your tail and rides there, harmless, for 5–7.5s. Turn back and it does not move: the reversal leaves it in front of you, where it holds and charges for one beat, then blocks the whole ring it is standing on for 0.42s. Its body is never solid — only the shot is — so there is no contact death and the counter always exists: it is still on the ring you *left*, and it takes 0.42s to follow a hop. The charge cannot be cancelled by turning back again. One at a time, on a 9–15s cooldown, and **never on a board with a gate** — the gate exists to force a reversal and the saucer exists to price one, so the pair could demand a move and punish it in the same breath. | dl 275 *(new)* | banner + MEET lesson, one sentence: "turn back and it blocks your ring — swipe off", death coach |
| Flicker pairs | A twin whose halves strictly alternate at duty 0.5, offset half a cycle: at every instant exactly one side is solid and the other is the gap. | dl 310 *(moved from 295 to keep level 3's three shapes ~35 dl apart)* | banner + MEET lesson, one sentence: "only one is solid — cross the dim one" *(the pair ran at 0.55 duty, so both sides were armed for 10% of every cycle and the lesson was false exactly when a player acted on it; smoke.mjs now walks a full period and requires strict alternation)*, death coach |

## Level 3+ — BLACK HOLE MODE (rare, optional, not a power-up)

From a playtester, and built close to the pitch: *"It's not a power up. It's
something you hit in orbit and trigger. It's a rare mode. And it's optional…
It actually does things to make it both harder and easier simultaneously."*

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Black hole | A rare dark orb on level 3+ (10% of orb rolls; a taken one arms a 55s cooldown, a declined one only 20s). Taking it is a **choice** — it sits on a ring like any pickup and staying off that ring declines it. Entry sets the game's **banner** (`BLACK HOLE` / EVENT HORIZON / "everything slows — the reds pile up — a fourth ring"), the channel every ring unlock and the star dive already use and the mode never did, and a standing HUD label **`BLACK HOLE · 12s`** counts the mode down for its whole length — it used to be named on screen for 0.92s of 18.7s and never again, and since its one explanatory lesson is once-per-device and consumed at the first pickup, every black hole after a player's first was wordless. For 17 seconds: **the arrangement stops dead** — the scheduler hands off to `bhStep` *and* `bedTick` pulls the sustaining pad to silence, which is the half that was missing — and the preset piece runs at **half tempo**, because in a rhythm game the pulse is the one clock the player reads without ambiguity and it used to stay at 104 BPM throughout; **the player stops being an instrument** (`performerHit` returns early — no notes, no heat, no on-beat chain, no loop capture); **everything runs at 0.42×**, dipping to 0.26× during the fall-in, and *everything* means it — the backdrop, the camera dolly, ripples, popups, the comet's trail and the hop all advance on `G.vt`, the dilated presentation clock, where roughly fifteen visible layers used to keep running at full speed and flatly contradict the eight that did not; **shard density ramps 1.5× → 3.5× on a real-time clock**; **a fourth orbit opens**, all four re-spaced over ~0.85s and withdrawn the same way, and **the spawn draw leans one ring inward 45% of the time** so the new orbit concentrates the board instead of diluting it; **gravity drags the comet one ring toward the centre every 4s** (one swipe counters it, and an interval that expires while you are already at the bottom is consumed rather than banked — banking it meant the next escape was cancelled on the frame it landed); **stars on the innermost orbit are worth 2×**, paid visibly in the popup; and reaching that innermost orbit pays a **HORIZON +200** bonus, once per black hole, which ignites the display — the disc blazes, the polar **jets** fire along the axis, the **warped spacetime grid** comes up underneath and the lensed halo brightens, settling back to a lower burn that runs for the rest of the mode so the hole is visibly *feeding* afterwards. The fourth ring is the mode's one structural novelty and arriving on it used to be worth exactly what arriving anywhere else was worth. Throughout the mode, **light falls in**: the star layers are rotated and compressed about the arena centre (frame dragging — a sampling transform in the shader, so no star moves in any coordinate the game reads), bright **filaments** are torn off the rim and run at the centre at three times the vortex speed, and **every star and orb on the board bleeds a tapered smear toward the singularity**. All three are draw-only — `G.parts` is a draw-only array and the smears read positions through the same `posAt()` every other pass uses and write nothing, so none of it can change what the board does. **Three things defer while the mode runs** — the tier banner, the hint ladder and any hard first-encounter lesson — because the mode owns the centre of the screen; the lesson defers without setting `seen`, so the next encounter re-offers it. No power-up orbs spawn inside it; stars do. **Gameplay SFX redshift from 0 to a perfect fourth down** across the mode, on the same squared curve as the sub drone. Surviving pays a lump **ESCAPE** bonus scaled by the stars gathered and halved per shield spent, plus **2 seconds of invulnerability and a decompression shockwave** (the slingshot). **How hard it actually is, measured two ways, because one number here was misleading.** Against a matched control at the same frozen `dl`: *board-wide arrival rate × time scale* reads **1.18–1.44× (level 3) / 1.28–1.34× (level 4)**, and that is the figure this row used to quote on its own. It flatters the mode, because the fourth ring inflates board-wide counts by construction — it counts shards on orbits the player is not standing on. The metric the thumb answers is *armed shards **per ring** × time scale*, and it reads **0.82× / 0.84×**: `2.60× armed shards ÷ (4 rings / 3 rings) × 0.42 time scale`. Both are real measurements of different things. The honest summary is that the mode carries **~2.6× the shards and ~3× the board**, looks far denser, and still sits slightly *below* ordinary per-ring threat, because two of its three levers are divisors and only one multiplies — and that one is capped by placement saturation rather than by `shardCap()` (observed max board 22–24 against a cap of 25–35; the innermost orbit physically holds ~7.8). It is also **shapeless**: armed shards by sixth of the mode at level 4 run 4.2 · 4.1 · 5.6 · 9.7 · 12.6 · 16.6 against an ordinary 3.3, so the first half sits at or below ordinary pressure and only the last ~3 seconds bite — which the 2.0s exit invulnerability then covers. The remaining lever with headroom is time, not density. | first rare roll on level 3+; guaranteed **offered** once on level 4. The roll sits directly below `POW_INTRO` in `spawnPow`, not at the bottom — see the revised curriculum rule in `CLAUDE.md` | MEET lesson, the only orb lesson that is **not** `soft` (it is the one orb that is not a gift): "black hole — everything slows, the reds pile up" |

**What shipped and what it actually did.** The mode carried thirteen documented
sub-features and a playtester who had run it many times perceived one of them
("some purple color"). None of it was missing from the source; almost all of it
was unreachable, cancelled, or inaudible.

| Clause of the pitch | What was wrong | Now |
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

**The music is diatonic and the dread is timbral.** The preset piece is a tonic
pedal, the tritone that already exists inside natural minor (degree 2 against
♭6), a noise wash and one kick a bar. The only glide is on the **sub alone** —
a redshift that falls a minor third on an accelerating (squared) curve — because
the SFX pentatonic keeps firing in here for pickups and shield saves and is
tuned to the level's scale, so the floor may move and nothing that has to agree
with an effect does. Additional building layers enter with time: a noise bed
that widens, metallic resonances on the minor third, a sub heartbeat that
doubles, and in the final ~4 seconds a full crescendo with the tritone pair
swelling and the kick quadrupling. The piece now has an arc rather than
looping flat.

## Level 4 — EVENT HORIZON (the exam)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| The storm | No new tricks. Every threat and orb from levels 1–2 active at once, spawn pool full from the first second, speed climbing toward the 4.2 rad/s ceiling. **Finite now** — it has a finish line at dl 340 and a star dive of its own. | dl 215 *(aligned to the level 3 start — was 380)* | L3 intro card: "no new tricks — everything at once" |
| Event horizon | The same storm with no exit: level 4 is endless, at the speed ceiling, in the fourth key (A → G → F → E♭). Its song is the one that never leaves home — i–♭VI–♭VII–i over a sub drone pinned to the tonic — with an octave-jumping bass and an open offbeat hat of its own. Introduces nothing. | dl 340 *(new)* | L4 intro card: "past the point of return" |

## Before the run — the front screens

None of these gates progression, and none of them changes what is taught.

| Screen | How it works | Explained by |
|---|---|---|
| Mode picker (title screen) | Two cards, CHILL and SKILL, on the title screen. SKILL is the default and the game as balanced. Tapping a card **selects**; START (or a tap anywhere that is not a card) begins. Each card animates its own mode — orbit speed, shard count and trail length are drawn from that mode's own knobs — and carries that mode's best score. Arrow keys pick left/right. The demo comet behind the cards runs at the selected mode's pace, so the title screen visibly calms down when CHILL is armed. | the cards themselves: each one is a moving picture of what it sells |
| Swipe rule chooser | Unchanged. Still once per device, still between the title screen and the run — it now hands off to the level picker rather than straight to level 1's card. | live arena with both rules tryable |
| Level picker | Four rows, one per level, plus START and back. **Every level is selectable on any device**, including ones never reached — the screen exists so a level can be tested without playing to it. Rows the device has actually reached are marked *reached*, so picked and earned stay visibly different. Level 1 for a returning player starts instantly; every other pick goes through that level's own intro card first. Arrow keys move the selection, Enter starts. | the rows name the level and its title; *reached* marks the honest ones |
| POWERUP TESTING bar (title screen) | A wide bar under the two mode cards, and a **door rather than a card**: tapping it opens the powerup picker instead of selecting anything. Deliberately not a third mode — `MODES` is the difficulty table and the lab pins the difficulty rather than scaling it. A fresh device is asked the swipe rule on the way through, once, exactly as the run route is. | the bar draws the orb currently armed, so it says what is behind it with the object |
| Powerup picker (the lab) | Seven rows, one per orb, plus a *red cannot touch you* toggle, START and back. Folds to two columns when the box is too short for seven rows — measured, not guessed; a landscape phone gets two columns and a portrait one gets seven rows. Arrow keys move the selection, **G** flips the ghost, Enter starts, Escape goes back. | each row carries the orb itself, drawn by the same `drawPow` the arena uses, and the sentence that channel already uses for it |

## CHILL and SKILL (one game, two clocks)

CHILL is a **derivative of SKILL, not a second implementation**. `MODES` holds
one set of multipliers per mode and every difficulty curve reads them, so a
balance change made once lands in both. SKILL is the identity — all its knobs
are 1 (0 for the additive shield) — which is what makes "with SKILL selected
the game is byte-for-byte the balance that shipped" a checkable fact.
`check.mjs` fails the build if SKILL stops being the identity, if a mode grows
a knob the others lack, or if any knob is never read.

| Knob | SKILL | CHILL | What it reaches |
|---|---|---|---|
| `clock` | 1 | 0.72 | `dl()` — difficulty-seconds per real second. The main lever: speed, cap, gap, warn, the tier ladder and the finish line are all keyed off `dl`, so one number eases all six in the proportions they were tuned in. Level 1's finish line lands near 2:55 instead of 2:06. |
| `speed` | 1 | 0.86 | `speedAt()`, ceiling included — CHILL's fastest board is genuinely slower, not merely later. |
| `warn` | 1 | 1.3 | `warnTime()` — the telegraph. CHILL's floor is 1.12s rather than 0.86s. |
| `cap` | 1 | 0.78 | `shardCap()`, floored at one. |
| `gap` | 1 | 1.3 | `spawnGap()` — arrival rate. Cap and rate move together, for the same reason the black hole scales both. |
| `shields` | 0 | +1 | Starting bank, additive: DEEP BANK still means one more shield in either mode. |
| `demo` | 1 | 0.62 | The title screen's demo comet, so the choice is legible before it is committed to. |

**What CHILL deliberately does not touch: the curriculum, the music, the
scoring.** Orbs and lessons are gated on `G.level` and tiers on `dl`, so a
chill run meets every formation and orb in the same order at the same points —
it just takes more seconds to get there. The arrangement is untouched: a mode
is not a key change. Nothing multiplies the score; chill is worth less per
minute only because a minute contains less game. `curriculum.mjs` asserts that
chill moves no tier, no finish line and no level boundary.

**The records are per mode, and the existing keys stay SKILL's.** A chill best
written to `cometloop:best` would silently redefine every value already on
every device — the failure the retired `cometloop:level` key is remembered for
— so chill writes `cometloop:best:chill` and `cometloop:gl:chill`. The death
screen names the mode when it is reporting chill's record, and the share text
appends `· CHILL` and `· from Ln` so a shared claim is the claim that was
earned. A default skill run started at level 1 shares exactly the text that
shipped.

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

A sandbox for looking at one orb, reached from the bar under the mode cards.
It teaches nothing, gates nothing and changes nothing about the game it sits
in front of — it exists because six of the seven orbs are behind a curriculum
ladder and the seventh is rare on purpose, so finding out what one feels like
used to mean playing until the game offered it.

| Piece | How it works |
|---|---|
| The orb | Whichever of the seven is picked, and only that one. `spawnPow()` short-circuits its entire ladder — the intro trio, the level gates, the pity shield, the three guarantees and the black hole's 10% die are all rules about *when* the game is willing to show you something, which is the obstacle the lab exists to remove. |
| How often | One orb on the board at a time (the real game never has two), refilled about 3 seconds after one is taken instead of 10–15. Measured: 7–10 placements per 45 seconds for a plain orb, and 4 full black holes — against three `blackhole_entered` events in the game's entire recorded history. |
| The board | `dl()` returns `LAB_DL` (40) and never moves. That is exactly `TIERS[3].at`, the lowest clock value that gives the arena all three orbits — the black hole opens a *fourth* on entry, so a one-ring lab would have demonstrated that against nothing. Everything else follows from the pinned clock: shard cap 4, arrival gap 2.4s, speed 1.62 of a 4.2 ceiling, a 2.35s telegraph. Level 1's finish line is dl 90, so nothing ever finishes and no tier ever arrives mid-session. |
| The ghost | *red cannot touch you*, on by default, flipped on the picker or with **G**. Read at the single lethal-contact site, ahead of the hypernova and shield branches: no shield is spent, no pip moves, no popup, no i-frame. The shard stays on the board and keeps travelling, so watching one pass through you is how you can tell it is on. Turn it off and the lab is the real game with one orb in it. |
| The way out | A pill in the top-left of a lab run, live on the death screen too, plus **Escape**. A ghosted run cannot end by itself, so without a door the only exit would be a page reload. Leaving mid-black-hole resets the mode outright — `bhTick` runs on `bhActive()` as well as on `playing`, so an abandoned horizon would otherwise keep rewriting `RADII` under the picker. |
| The difficulty mode | Whatever card is selected still applies its trims (`speed`, `warn`, `cap`, `gap`, `shields`). Only `clock` is bypassed, because a pinned constant has nothing to scale. |

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
| Score-bought band layers | Four permanent layers join at 600 / 1,400 / 2,400 / 3,600 points. | gold "NEW LAYER" lines, band-meter dots |
| Band meter | Dot row under the level readout — one dot per layer currently in the record; the newest pulses; the loop shows as a cyan member. | gold "NEW LAYER" lines, one-time "THE BAND — score adds layers" caption *(new)* |
| New sounds | The star's instrument steps up at tiers 4, 7 and 10. | "NEW SOUND" announcement, death-screen "next sound" hook |
| Difficulty clock | Difficulty is a clock; good play nudges it forward a little (capped). Speed, caps and spawn rate never change *what* a level teaches. **The clock now has a second ramp.** Every pressure term used to reach its floor or ceiling by dl 420 — eighty seconds into a level that never ends — so a player surviving five minutes on EVENT HORIZON was playing the board they met at eighty seconds, only faster: warn 1.00 flat, gap 0.80 flat, embers flat, shields flat, tier flat, sky flat, with speed and one cap step the whole of it. Warn now eases 1.00 → 0.86 between dl 460 and 640, the spawn gap's floor decays 0.80 → 0.64 between dl 420 and 700, and the cap steps 10 → 11 → 12 at dl 540 and 680. Measured at dl 560–650: spawns per 90s 125 → 139, mean shards on the board 9.9 → 10.8. Nothing before dl 420 moves, so a run ending where most runs end sees none of it. | (internal — documented here) |
| Level record | The deepest level a device has ever reached, **per mode** (`cometloop:gl`, `cometloop:gl:chill`). It moves at death, beside the high score, so the announcement fires exactly once and a retry of the same level stays quiet — and only for a run that began at level 1, so a level picked from the front screen can never move it *(new)*. | death screen: **FURTHEST YET** in place of NEW BEST, otherwise "BEST · LEVEL n · score" (prefixed CHILL in chill); the death-screen pip row, one pip per level |

## The teaching channels

- **Menu key + 12s demo** — the verbs and core objects, before first touch.
  The key sits under the mode cards now; the demo runs at the selected mode's
  pace *(new)*.
- **Tier banners** — gold, 3.2s, one at a time, each with a one-line sub.
- **MEET lessons** — first encounter of each formation/orb: threats hold
  the world near-frozen under a dim veil with the specimen spotlit in a
  gold ring, one sentence dead centre *(new — was 0.35x slow-mo over a
  moving board)*. A death to a taught mechanic re-arms its lesson once
  per device — soft form, no ceremony.
- **Hint ladder** — bottom-of-screen glyph+sentence rungs, first match wins,
  every rung clears the instant the player does the thing.
- **Level cards** — the calm between levels: what the next level introduces.
  Level 1's card carries **three** rows, not six: the two verbs and the thing
  that hurts. A playtester counted "like eight rules" on first contact and
  asked for three or four — the tier ladder already introduces one mechanic at
  a time, and a card previewing the whole syllabus was working against it.
  Orbit scoring, the musical rule and the star dive keep their own channels.
  The level 1 card shows on first-ever run; a death on level 2+ retries
  through that level's card (level 1 keeps the instant retry) *(new)*.
- **Death coach** — one line naming what killed you, with its counter-move.
  Covers every formation type *(new)*.
- **Sound cues** — three sounds with fixed meanings: the unlock call
  (tier banners), the lesson chime (first-encounter lessons), the state
  shimmer up/down (overcharge, spotlight, overdrive begin/end) *(new)*.
- **The insist rule** — while an unlocked shape's lesson has not landed,
  it is the next spawn until `firstMeet` finds calm; unseen orbs re-place
  on expiry, and using an orb counts as its introduction. Enforced by
  `tools/curriculum.mjs`, which fails the build if level 3 opens with
  anything untaught *(new)*.
- **Telemetry** — `run_ended` carries `did_hop`/`death_cause`/`misread_rate`;
  `lesson_shown` and `card_shown` events, plus `killer_lesson_seen` /
  `killer_relessoned` / `lessons_shown` on `run_ended`, measure whether
  teaching lands; `drops_earned`/`lands`, `hold_timeout`, `best_combo`,
  `best_groove`, `loop_caught`, `near_misses` and the orb pickup flags
  measure whether the taught systems get USED *(new)*.
