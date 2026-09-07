# The MEET table: every first-encounter lesson, verbatim, and what suppresses it

*What this answers: what each of Cosmo's 22 first-encounter lessons actually
says in the shipped source, what fires it, and every guard that can defer or
spend it.*

Table: `src/game/runtime.js:5438-5559`. Firing function: `firstMeet(type)`,
`src/game/runtime.js:5560-5634`. Strings below are copied character-for-character
from those lines; the design docs quote **older wordings** — see
`db/notes/content/doc-drift.md`.

## The 22 entries

| key | line | `t` (verbatim) | `g` | `soft` |
|---|---|---|---|---|
| `single` | 5453 | `Red hits cost a shield; tap to turn or swipe rings` | shard | — |
| `twin` | 5465 | `Two red obstacles: swipe to another ring` | swipe | — |
| `gate` | 5466 | `A wall blocks every ring; tap to turn around` | tap | — |
| `drift` | 5471 | `This red obstacle moves; tap to turn away` | shard | — |
| `blink` | 5472 | `Pass while dim; bright red costs a shield` | shard | — |
| `driftgate` | 5473 | `The wall moves; tap to turn before it reaches you` | tap | — |
| `saucer` | 5481 | `Turning triggers its shot; swipe to another ring` | swipe | — |
| `blinktwin` | 5482 | `One flashes red; pass the dim one` | shard | — |
| `dive` | 5489 | `It moves to the marked ring; swipe to another ring` | swipe | — |
| `funnel` | 5496 | `Swipe to the ring with no wall` | swipe | — |
| `spot` | 5497 | `Magnet: nearby stars curve into you for 10 seconds` | magnet | 1 |
| `hyper` | 5509 | `Hypernova: move faster, safe from red, for about 9s` | star | 1 |
| `mirror` | 5514 | `Mirror: a second comet collects stars and clears red for about 9s` | star | 1 |
| `scorch` | 5520 | `Scorch: your path clears red obstacles for 8s` | swipe | 1 |
| `slip` | 5521 | `Slipstream: swipe rings to clear nearby red for 12s` | swipe | 1 |
| `trail` | 5522 | `Star trail: collect nine bonus stars within 16s` | star | 1 |
| `blackhole` | 5531 | `Black hole: ride the inner ring; at ESCAPE, swipe to the outer ring` | warp | — |
| `orbit` | 5543 | `An orbit is a full circle without turning; it earns bonus points` | star | 1 |
| `lapcost` | 5544 | `Turning restarts your orbit; collected stars still count` | star | 1 |
| `music` | 5550 | `Each tap and ring change plays a note` | beat | 1 |
| `beat` | 5555 | `Tap with the beat to earn bonus points` | beat | 1 |
| `combo` | 5559 | `Collect stars close together to earn up to 6 points each` | star | 1 |

Ten of these (the formation types plus `funnel`) are also the `sub` on their
tier banner, byte-identical — `tools/smoke.mjs:354-355` fails the build if one
drifts.

Every number in the reward lessons is live and correct as of this read:
`MAGNET_SECS=10` (`:5099`), `MIRROR_BEATS=16` at `BPM=104` → `SPB=60/104`, so
16 beats = 9.23s ("about 9s") (`:5846`, `:858`), `SCORCH_SECS=8` (`:5857`),
`SLIP_SECS=12` (`:5858`), `STAR_ROUTE_N=9`/`STAR_ROUTE_SECS=16` (`:5859`),
combo cap 6 (`G.combo=Math.min(G.combo+1,6)`, `:8429`). The upgraded values
(LONG MAGNET 16s, LONGER STAR / LONG MIRROR 24 beats, DEEP BURN 13s, LONG
SLIPSTREAM 18s, LONG STAR TRAIL 24s) are **not** reflected in the lesson text —
the sentence keeps the base number after the tile is taken.

## What fires each one

* **Formations** — at the *success* site of each spawn branch, never at the top
  of `spawnSpike`: `:5652` (twin), `:5729` (funnel), `:5755` (gate/driftgate),
  `:5769` (saucer), `:5795` (drift), `:5800` (blink), `:5812` (dive), `:5816`
  (plain single and the rest). Firing before placement used to burn the
  once-ever lesson on a formation that never got placed.
* **Reward orbs** — at placement (`:6073`, excluding `blackhole`) and then
  again on every frame the orb is on the board and unseen (`:8545`, which does
  include `blackhole`). An unseen orb that expires unlessoned clears its
  `*Placed` flag and is re-placed (`:8538`).
* **`orbit`** — first completed lap, `:8313`.
* **`lapcost`** — a committed reverse that discarded more than `TAU*0.6` of the
  lap, `:6562`.
* **`music`** — `!G.seen.music && G.didReverse && age()>10 && age()<26`, `:7892`.
* **`beat`** — `G.groove>=2`, `:2632`.
* **`combo`** — `G.combo>=3`, `:8432`.

## Every guard in `firstMeet`, in order (`:5561-5626`)

1. `G.intro` — nothing teaches during the FIRST FLIGHT introduction.
2. `G.seen[type]` already set, or no `MEET` row.
3. `LAB.on` — the lab never spends a lesson. The second half of that guard is
   at `:8559`: *taking* an orb in the lab must not count as the introduction
   either.
4. `G.t < G.meetNext` — 9-second minimum spacing (set at `:5625`).
5. A running hop rehearsal (`G.teachKind==='hop'`) is never hijacked.
6. `G.banner && G.banner.t<2.4` — a fresh banner owns the centre.
7. `G.landFx || G.secFx` — a payoff card owns the centre.
8. `bhActive()` — the black hole owns the screen.
9. `soft && !G.seen.single` — **every reward lesson waits until the red-shard
   lesson has landed on this device.** Measured before this guard: combo fired
   at 5.4s, music 14.4s, orbit 24.7s, lapcost 33.9s, and `single` at 44.3s.
10. Hard lessons only: no live timed reward (`hyper|spot|slow|mirror|scorch|slip`
    or a trail star on the board), and no armed lethal shard on the player's
    ring within 1.2 rad.

All of these **defer** rather than spend: `G.seen[type]` is set only after every
guard passes, so the next encounter re-offers the sentence.

## The presentation

* `G.teach=Math.max(G.teach,2.8)`, `G.teachKind='see'`, `G.teachSoft=soft`.
* Hard lesson → the world runs at **0.06x** (`sdt` factor, `:8132`) under a
  0.48-alpha veil with the specimen wearing a breathing cool-white `#dfe9ff`
  ring (`:11831-11848`). The hop rehearsal is the other kind and keeps 0.35x.
* Soft lesson → no dilation at all; it reads like any other card.
* `cueLesson()` fires with it (`:3576`) — the one sound that always means
  "teaching is on screen".
* `G.teach` decays on raw `dt` at `:7887`. A landed hop clears **only** the hop
  rehearsal (`:6917`), never a `see` lesson — asserted by
  `tools/smoke.mjs:371-377`.
* `flushLesson()` (`:6878-6888`) emits the `lesson_shown` telemetry event with
  `type`, `soft`, `rearmed`, `age`, `game_level`, `run_index` and `cut`.

## Death re-arms the lesson it disproves

`die()` at `:6375-6391`: if the killer's `MEET` lesson was already spent
(`G.seen[klr]`) and has not been re-armed (`!G.seen2[klr]`), `seen` is deleted
and `seen2` set, both persisted. The re-offer runs in **soft** form because
`firstMeet` reads `soft = MEET[type].soft || G.seen2[type]` (`:5600`) — a
veteran is never slow-motioned twice. Capped at once per type per device.
Never from a lab death.

Both bit sets persist as comma-joined key lists under `cometloop:seen` and
`cometloop:seen2` (`:5627`, `:6389-6390`, loaded `:3689-3691`).
