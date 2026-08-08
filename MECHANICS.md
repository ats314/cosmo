# The mechanics ledger

One row per player-facing mechanic: what it does, where the game introduces
it, and every channel that explains it. The curriculum rule this table
enforces: **every mechanic is introduced and explained by the end of level 2.
Level 3 opens with everything known and everything active.**

Difficulty-level (`dl`) values are difficulty-seconds — see `dl()` in
`index.html`. Level windows: level 1 spans dl 0–90, level 2 spans 90–215,
level 3 spans 215–340, and level 4 is 340 onward. A tier marked *(moved)* was
pulled forward by the curriculum pass so nothing new is ever met past level 3.

**Teaching runs through level 3 now.** The two compound shapes — a gate that
also drifts, a twin that also blinks — used to arrive 22 dl-seconds apart at
the end of level 2, immediately after their two ingredients, which was the
densest stretch in the game and exactly where a playtester reported losing
track of the rules. Adding level 4 had made that worse rather than better:
every tier still unlocked inside dl 0–215 while an entire level taught nothing.
Level 2 now carries three shapes ~35 apart instead of five ~22 apart, level 3
carries the two compounds 55 apart, and level 4 is the exam.

**Level 3 used to be endless and therefore last.** It has a finish line and a
star dive of its own now, and level 4 (EVENT HORIZON) took over as the level
you do not finish — which keeps "the last level is the exam" true instead of
making level 3 both the exam and the middle of the game. Neither introduces
anything: every tier still unlocks by dl 215, so the extra level costs the
curriculum rule nothing. `check.mjs` reads level 2's finish line positionally
(`ends[1]`) rather than as `max(ends)`, which was the same number only while
there were exactly three levels.

## Level 1 — LIFT OFF (the verbs, the economy, the core orbs)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Reverse (tap) | Flips your direction instantly. Costs the orbit in progress and the lap streak; embers already gathered stay banked. | first seconds | menu demo + key row, hint ladder, first-reversal orbit lesson *(new)* |
| Hop (radial swipe) | Jumps one ring inward/outward. Read radially: away from centre = out, toward = in. | dl 12 (SECOND RING, ~20s) | menu demo + key row, banner, one-time slow-mo rehearsal, hint ladder, death coach |
| Rings | Inner rings are tighter (shards block twice the angle), faster, and run a hotter kit — the music assembles as you dive. | ring 2 at dl 12, ring 3 at dl 40 | banners, camp hint ("dive in — the music runs hotter inside") |
| Stars (embers) | Collectibles worth a rising combo up to ×6 while you keep collecting. They play the band's own instrument. | ~0.5s | menu key row, hint ladder |
| Orbit scoring | A full 360° without reversing pays out by the embers gathered *during* that orbit; consecutive fed orbits stack a streak. Reversing forfeits the orbit, never the banked embers. | first lap | hint ladder, first mid-orbit reversal lesson *(new)*, lap pips + payout popups |
| Plain shard | Costs a shield; kills you when the bank is empty. Pulses as a warning, then arms. | dl ~4.5–11s | menu key row, L1 card ("red costs a shield — you start with two") *(reworded — it used to say "red kills you", which is false for the first two hits of every run)*, MEET lesson, hint ladder, death coach |
| Twin shards | Two shards side by side — too wide to outrun; the hop is the answer. Held until your first hop lands (max 30 dl-seconds). | dl 18 | banner, MEET lesson, death coach *(new)* |
| Shield (green orb) | Banked up to 3 (cap grows late — empty slots draw as faint rings, so the max is visible). A hit spends one automatically, knocks you off your orbit, and grants 0.9s of invulnerability. Every run starts with two. | 1st power-up (~10s) | menu key row, L1 card, orb-naming hint, visible cap, and the save itself: "SHIELD USED · N LEFT", or "LAST SHIELD — RED KILLS NOW" with a darker cue when the bank empties *(new)* |
| Slow-mo (violet orb) | 4 seconds at 55% speed. | 2nd power-up | menu key row, orb-naming hint while on the board |
| Nova (white orb) | Converts every shard in the wave to paying embers. | 3rd power-up | menu key row, orb-naming hint while on the board |
| Overcharge | While the shield bank is full, embers and on-beat taps pay DOUBLE; an overflow shield pays +50. | first full bank | "SHIELDS FULL" line + shimmer-up on every bank-fill, shimmer-down when it breaks, OVERCHARGED popup, visible cap rings *(new)* |
| On-beat chain | Inputs judged against the sixteenth grid (consistency, not absolute timing). Tight play climbs ON BEAT ×8: each rung a scale-step tone, ×8 pays a build bonus and opens the band. | first tight taps | per-rung tones, popups from ×2, "on the beat" lesson at first ×2 *(new)*, ×8 payoff line *(new)*, hint ladder |
| Music answers you | Every tap and hop places a note on the grid; input builds heat that opens the arrangement. The game's meta-rule. | first seconds | "your moves play the music" lesson in level 1's calm — now the only channel, the L1 card row having been cut to keep first contact to three rules |
| Combo | Each consecutively collected star pays more, up to ×6. | first stars | ×N popups, combo lesson at first ×3 *(new)* |
| Beat drop | Playing well fills an invisible meter; the music rises, counts 3…2…1…NOW! — any move on NOW lands it for a big bonus and a payoff section where everything pays more. | first drop (~50s worst case) | countdown numerals, "BEAT DROP COMING…", hint ladder |
| Near miss | Stopping just short of a shard, or sweeping past one mid-hop, pays +3 with a white spark. | first dodge | the spark itself |
| Loop recorder | Quantised inputs land on a rolling two-bar tape; a real phrase becomes the active loop, harmonised into the song. | first phrase | "YOUR BEAT IS IN THE SONG" line, cyan band-meter dot blinking with the ghost *(new)* |
| Star dive (finale) | The level's closing melody laid out as a star trail; chase the brightest star, chains pay double, dive the bloomed sun to end the level. | end of every level | banner + one-at-a-time burning stars |

## Level 2 — INTO THE RINGS (every remaining threat and orb)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Gates | One angle blocked on EVERY ring — hopping cannot save you; reverse. Checked for solvability before spawning. | dl 100 | banner, MEET lesson, death coach |
| Drifters | Shards that slide along their ring; the chevron's point leads their motion. | dl 122 *(moved from 205)* | banner, MEET lesson, longer first telegraphs, death coach *(new)* |
| Blinkers | Phase on a two-beat cycle: harmless while dim, lethal while lit; the core fills as re-arm approaches. | dl 144 *(moved from 250)* | banner, MEET lesson, longer first telegraphs, death coach |
| Hypernova (gold star) | Sixteen beats of invincibility at nearly double speed: reds convert to paying embers on contact, everything pays double, the kit doubles to sixteenths. | guaranteed first post-curriculum placement on level 2 | MEET lesson naming the speed *(reworded)*, no slow-mo *(fixed)* |
| Bass bomb (cyan orb) | Clears every shard in the neighbourhood and drops the low end. | guaranteed on level 2 *(new — was a dice roll)* | MEET lesson |
| Spotlight (white/violet orb) | Four bars where you are the lead: your instrument doubles, tight taps pay double. | guaranteed on level 2 *(new — was a dice roll)* | MEET lesson, no slow-mo *(fixed)* |
| Overdrive | Hold the heat near max for a full bar: eight bars of double-time with embers and on-beat taps paying double. | heat-driven, reachable late L1, named on L2 card | "OVERDRIVE ×2" readout, gold band meter |
| Drum break | The band steps out for a bar and your inputs ARE the fill — taps land as snares, hops as kicks. | heat-driven, named on L2 card | caption *(per-run again, new)*, input flashes — snare white, kick gold *(new)* |

## Level 3 — THE STORM (the last teaching level)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| Sliding gates | A gate whose wall drifts — reverse early, the exit is crowding shut. | dl 240 *(moved into level 3)* | banner, MEET lesson, death coach |
| Flicker pairs | A twin whose halves alternate: exactly one is ever solid, one gap at a time. | dl 295 *(moved into level 3)* | banner, MEET lesson, death coach |

## Level 4 — EVENT HORIZON (the exam)

| Mechanic | How it works | Introduced | Explained by |
|---|---|---|---|
| The storm | No new tricks. Every threat and orb from levels 1–2 active at once, spawn pool full from the first second, speed climbing toward the 4.2 rad/s ceiling. **Finite now** — it has a finish line at dl 340 and a star dive of its own. | dl 215 *(aligned to the level 3 start — was 380)* | L3 intro card: "no new tricks — everything at once" |
| Event horizon | The same storm with no exit: level 4 is endless, at the speed ceiling, in the fourth key (A → G → F → E♭). Introduces nothing. | dl 340 *(new)* | L4 intro card: "past the point of return" |

## Cross-level systems (never gate progression)

| System | How it works | Explained by |
|---|---|---|
| Score-bought band layers | Four permanent layers join at 600 / 1,400 / 2,400 / 3,600 points. | gold "NEW LAYER" lines, band-meter dots |
| Band meter | Dot row under the level readout — one dot per layer currently in the record; the newest pulses; the loop shows as a cyan member. | gold "NEW LAYER" lines, one-time "THE BAND — score adds layers" caption *(new)* |
| New sounds | The star's instrument steps up at levels 4, 7, 10 (tier ladder). | "NEW SOUND" announcement, death-screen "next sound" hook |
| Difficulty clock | Difficulty is a clock; good play nudges it forward a little (capped). Speed, caps and spawn rate never change *what* a level teaches. | (internal — documented here) |
| Level record | The deepest level a device has ever reached (`cometloop:gl`). It moves at death, beside the high score, so the announcement fires exactly once and a retry of the same level stays quiet. | death screen: **FURTHEST YET** in place of NEW BEST, otherwise "BEST · LEVEL n · score"; the death-screen pip row, one pip per level *(new)* |

## The teaching channels

- **Menu key + 12s demo** — the verbs and core objects, before first touch.
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
