# The mechanics ledger

One row per player-facing mechanic: what it does, where the game introduces
it, and every channel that explains it. The curriculum rule this table
enforces: **every mechanic is introduced and explained by the end of level 2.
Level 3 opens with everything known and everything active.**

Difficulty-level (`dl`) values are difficulty-seconds — see `dl()` in
`index.html`. Level windows: level 1 spans dl 0–75, level 2 spans 75–190,
level 3 is 190 onward. A tier marked *(moved)* was pulled forward by the
curriculum pass so nothing new is ever met inside level 3.

## Level 1 — LIFT OFF (the verbs, the economy, the core orbs)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Reverse (tap) | Flips your direction instantly. Costs the orbit in progress and the lap streak; embers already gathered stay banked. | first seconds | menu demo + key row, hint ladder, first-reversal orbit lesson *(new)* |
| Hop (radial swipe) | Jumps one ring inward/outward. Read radially: away from centre = out, toward = in. | dl 12 (SECOND RING, ~20s) | menu demo + key row, banner, one-time slow-mo rehearsal, hint ladder, death coach |
| Rings | Inner rings are tighter (shards block twice the angle), faster, and run a hotter kit — the music assembles as you dive. | ring 2 at dl 12, ring 3 at dl 40 | banners, camp hint ("dive in — the music runs hotter inside") |
| Stars (embers) | Collectibles worth a rising combo up to ×6 while you keep collecting. They play the band's own instrument. | ~0.5s | menu key row, hint ladder |
| Orbit scoring | A full 360° without reversing pays out by the embers gathered *during* that orbit; consecutive fed orbits stack a streak. Reversing forfeits the orbit, never the banked embers. | first lap | hint ladder, first mid-orbit reversal lesson *(new)*, lap pips + payout popups |
| Plain shard | Red kills you. Pulses as a warning, then arms. | dl ~4.5–11s | menu key row, MEET lesson, hint ladder, death coach |
| Twin shards | Two shards side by side — too wide to outrun; the hop is the answer. Held until your first hop lands (max 30 dl-seconds). | dl 18 | banner, MEET lesson, death coach *(new)* |
| Shield (green orb) | Banked up to 3 (cap grows late — empty slots draw as faint rings, so the max is visible). A hit spends one automatically and knocks you off your orbit. Every run starts with two. | 1st power-up (~10s) | menu key row, orb-naming hint, visible cap *(new)* |
| Slow-mo (violet orb) | 4 seconds at 55% speed. | 2nd power-up | menu key row, orb-naming hint while on the board |
| Nova (white orb) | Converts every shard in the wave to paying embers. | 3rd power-up | menu key row, orb-naming hint while on the board |
| Overcharge | While the shield bank is full, embers and on-beat taps pay DOUBLE; an overflow shield pays +50. | first full bank | "SHIELDS FULL" line + shimmer-up on every bank-fill, shimmer-down when it breaks, OVERCHARGED popup, visible cap rings *(new)* |
| On-beat chain | Inputs judged against the sixteenth grid (consistency, not absolute timing). Tight play climbs ON BEAT ×8: each rung a scale-step tone, ×8 pays a build bonus and opens the band. | first tight taps | per-rung tones, popups from ×2 *(per-run again, new)*, hint ladder |
| Beat drop | Playing well fills an invisible meter; the music rises, counts 3…2…1…NOW! — any move on NOW lands it for a big bonus and a payoff section where everything pays more. | first drop (~50s worst case) | countdown numerals, "BEAT DROP COMING…", hint ladder |
| Near miss | Stopping just short of a shard, or sweeping past one mid-hop, pays +3 with a white spark. | first dodge | the spark itself |
| Loop recorder | Quantised inputs land on a rolling two-bar tape; a real phrase becomes the active loop, harmonised into the song. | first phrase | "YOUR BEAT IS IN THE SONG" line |
| Star dive (finale) | The level's closing melody laid out as a star trail; chase the brightest star, chains pay double, dive the bloomed sun to end the level. | end of every level | banner + one-at-a-time burning stars |

## Level 2 — INTO THE RINGS (every remaining threat and orb)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Gates | One angle blocked on EVERY ring — hopping cannot save you; reverse. Checked for solvability before spawning. | dl 85 | banner, MEET lesson, death coach |
| Drifters | Shards that slide along their ring; the chevron's point leads their motion. | dl 105 *(moved from 205)* | banner, MEET lesson, longer first telegraphs, death coach *(new)* |
| Blinkers | Phase on a two-beat cycle: harmless while dim, lethal while lit; the core fills as re-arm approaches. | dl 125 *(moved from 250)* | banner, MEET lesson, longer first telegraphs, death coach |
| Sliding gates | A gate whose wall drifts — reverse early, the exit is crowding shut. | dl 145 *(moved from 295)* | banner, MEET lesson, death coach |
| Flicker pairs | A twin whose halves alternate: exactly one is ever solid, one gap at a time. | dl 165 *(moved from 340)* | banner, MEET lesson, death coach *(new)* |
| Hypernova (gold star) | Sixteen beats of invincibility at nearly double speed: reds convert to paying embers on contact, everything pays double, the kit doubles to sixteenths. | guaranteed first post-curriculum placement on level 2 | MEET lesson naming the speed *(reworded)*, no slow-mo *(fixed)* |
| Bass bomb (cyan orb) | Clears every shard in the neighbourhood and drops the low end. | guaranteed on level 2 *(new — was a dice roll)* | MEET lesson |
| Spotlight (white/violet orb) | Four bars where you are the lead: your instrument doubles, tight taps pay double. | guaranteed on level 2 *(new — was a dice roll)* | MEET lesson, no slow-mo *(fixed)* |
| Overdrive | Hold the heat near max for a full bar: eight bars of double-time with embers and on-beat taps paying double. | heat-driven, reachable late L1, named on L2 card | "OVERDRIVE ×2" readout, gold band meter |
| Drum break | The band steps out for a bar and your inputs ARE the fill — taps land as snares, hops as kicks. | heat-driven, named on L2 card | caption *(per-run again, new)*, input flashes — snare white, kick gold *(new)* |

## Level 3 — THE STORM (the exam)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| The storm | No new tricks. Every threat and orb from levels 1–2 active at once, spawn pool full from the first second, speed climbing toward the 4.2 rad/s ceiling. Endless. | dl 190 *(aligned to the level 3 start — was 380)* | L3 intro card: "no new tricks — everything at once" |

## Cross-level systems (never gate progression)

| System | How it works | Explained by |
|---|---|---|
| Score-bought band layers | Four permanent layers join at 600 / 1,400 / 2,400 / 3,600 points. | gold "NEW LAYER" lines, band-meter dots |
| Band meter | Dot row under the level readout — one dot per layer currently in the record; the newest pulses. | gold "NEW LAYER" lines as each joins |
| New sounds | The star's instrument steps up at levels 4, 7, 10 (tier ladder). | "NEW SOUND" announcement, death-screen "next sound" hook |
| Difficulty clock | Difficulty is a clock; good play nudges it forward a little (capped). Speed, caps and spawn rate never change *what* a level teaches. | (internal — documented here) |

## The teaching channels

- **Menu key + 12s demo** — the verbs and core objects, before first touch.
- **Tier banners** — gold, 3.2s, one at a time, each with a one-line sub.
- **MEET lessons** — first encounter of each formation/orb: ~3s slow-mo
  (threats only), the one relevant sentence dead centre. A death to a
  taught mechanic re-arms its lesson once per device — soft form, no
  slow-mo *(new)*.
- **Hint ladder** — bottom-of-screen glyph+sentence rungs, first match wins,
  every rung clears the instant the player does the thing.
- **Level cards** — the calm between levels: what the next level introduces.
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
  teaching lands *(new)*.
