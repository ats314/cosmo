# How an orb gets onto the board

*What this answers: which orb `spawnPow()` picks and why, in what order the
guarantees fire, what the fallback odds actually are at each level, how the
shield-pity rule and the once-per-run flags interact, and how often orbs arrive.*

Source of record: `spawnPow` at `src/game/runtime.js:5936-6087`, the spawn gate
at `src/game/runtime.js:8406-8417`, and the per-run reset at
`src/game/runtime.js:6237-6260`. Every number below was read there.

## The ladder, in the order the branches are tested

`spawnPow()` is a single `if/else if` chain. **Order is the design**: an earlier
branch always wins, and the file's own comment says the reorder that put the
black hole above the guarantees was the point — patient flags (`hyperPlaced`,
`spotPlaced`) survive a delayed placement, an unrolled per-placement die does
not.

| # | Line | Condition | Places |
|---|---|---|---|
| 1 | 5938 | `LAB.on` | `LAB.type` — the picked orb, every time |
| 2 | 5945 | `G.introN < POW_INTRO.length` | `POW_INTRO[G.introN]` — shield, then slow-mo, then nova |
| 3 | 5949 | `G.sinceShield >= 3` | `shield` (the pity rule) |
| 4 | 5953 | `level>=4 && !bhRun && !bhPlaced && t>=bhCool && !bhActive()` | `blackhole` (the guaranteed *offer*) |
| 5 | 5964 | `level>=3 && t>=bhCool && !bhActive() && Math.random()<0.05` | `blackhole` (the rare roll) |
| 6 | 5993 | `level>=2 && !hyperPlaced` | `hyper` |
| 7 | 6000 | `level>=4 && !mirrorPlaced` | `mirror` |
| 8 | 6007 | `level>=5 && !scorchPlaced` | `scorch` |
| 9 | 6009 | `level>=3 && !spotPlaced` | `spot` (Magnet) |
| 10 | 6019 | `level>=2 && !slipPlaced` | `slip` |
| 11 | 6021 | `level>=3 && !trailPlaced` | `trail` |
| 12 | 6023 | otherwise | the weighted `POWPOOL` roll |

Two consequences worth knowing before editing:

* **The pity shield outranks every optional offer, including the black hole.**
  That is deliberate and stated in the code: a rare roll must not be able to
  break the three-placement promise.
* **The mirror (level 4) is tested before Magnet (level 3).** On a climb this
  never matters because Magnet's guarantee is met on level 3, but a run that
  reached level 4 with `spotPlaced` still false will be handed the mirror first.

## The fallback pool

`POWPOOL` (`src/game/runtime.js:6046-6048`) is `[id, weight, minLevel]`:

```
shield .302/1   warp .185/1   nova .143/1
spot   .134/3   hyper .076/2  mirror .080/4  scorch .080/5
slip   .095/2   trail .095/3
```

The weights are **not normalised in the table** — they sum to 1.190. The first
seven sum to exactly 1.000 (the roster before SLIPSTREAM and STAR TRAIL), and
those two were appended at 0.095 each rather than taken out of the existing
space. `ptot` is recomputed over the eligible rows every call, so what a player
actually sees is `weight / ptot`:

| Level | shield | warp | nova | spot | hyper | mirror | scorch | slip | trail |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 47.9 % | 29.4 % | 22.7 % | — | — | — | — | — | — |
| 2 | 37.7 % | 23.1 % | 17.9 % | — | 9.5 % | — | — | 11.9 % | — |
| 3 | 29.3 % | 18.0 % | 13.9 % | 13.0 % | 7.4 % | — | — | 9.2 % | 9.2 % |
| 4 | 27.2 % | 16.7 % | 12.9 % | 12.1 % | 6.8 % | 7.2 % | — | 8.6 % | 8.6 % |
| 5–6 | 25.4 % | 15.5 % | 12.0 % | 11.3 % | 6.4 % | 6.7 % | 6.7 % | 8.0 % | 8.0 % |

`blackhole` is **not** in `POWPOOL`. It only arrives from branch 4 or branch 5.

The `minLevel` column is the same floor the guarantees use, so a first-ever run
on LIFT OFF cannot be handed a level-3 orb by the fallback.

## The guarantees are once per RUN, and pre-spent

`startGame()` (`src/game/runtime.js:6251-6254`) sets, only when the run is not
carrying a score forward from the previous level:

```
G.hyperPlaced = G.level > 2;   G.spotPlaced   = G.level > 3;
G.mirrorPlaced = G.level > 4;  G.scorchPlaced = G.level > 5;
G.slipPlaced  = G.level > 2;   G.trailPlaced  = G.level > 3;
```

So a 1→6 climb meets each orb exactly once, on its home level, and a run that
starts on REDSHIFT is not owed four marquee placements in its first minute. The
flags are *not* re-armed at a level boundary — that bug once produced
HYPERNOVA guaranteed on L2, L3, L4, L5 *and* L6 of one climb.

`POW_LESSON` (`src/game/runtime.js:5934-5935`) maps orb id → guarantee flag, and
the expiry path (`src/game/runtime.js:8538`) **clears the flag again** if an
unseen orb of that type times out unlessoned: the guarantee is of the
introduction, not of one spawn roll.

## Black-hole cooldowns

* Placed as the level-4 guarantee, or by the 5 % roll: `bhPlaced = true`,
  `bhRun = true`, `bhCool = G.t + 20` (`src/game/runtime.js:6066`). Twenty
  seconds is the *decline* price — the orb the game expects you to refuse must
  not be the one whose refusal costs most.
* Actually taken: `bhCool = G.t + 55` at the pickup (`src/game/runtime.js:8614`),
  armed on the event rather than the placement so the quiet window after a 17 s
  mode is the same one the number was chosen for.

## Cadence and placement geometry

The spawn gate (`src/game/runtime.js:8406`) requires
`powT<=0 && !FIN.on && !starfallActive() && !bhActive() && G.pows.length===0 && dl()>=6`
— **one orb on the board at a time**, never during the finale, Starfall or a
black hole. On success `powT` becomes `max(6, rand(10,15) - dl()*0.02)` in the
real game and `rand(2.2, 3.6)` in the lab; on failure, 0.5 s
(`src/game/runtime.js:8416`). A run opens with `powT = 4`
(`src/game/runtime.js:6270`), which with the `dl()>=6` gate puts the first shield
on the board around ten seconds in.

Placement (`src/game/runtime.js:6055-6057`) makes up to 24 attempts at a random
angle and ring, each accepted only if
`farFromAll(a, ring, 0.6, sep(ring,3.2), sep(ring,3.0))`. The orb's life is
`7` seconds (`src/game/runtime.js:6058`).

`G.sinceShield` and `G.introN` count **placements, not pickups**
(`src/game/runtime.js:6074-6080`) — otherwise a run spent dodging would serve
nothing but shields forever. A pity shield placed while the intro trio still
owes one counts as the trio's shield.

## The lab bypasses all of it

`LAB.on` short-circuits at branch 1 (`src/game/runtime.js:5938-5944`). The one
orb the picker chose is placed every time, at a refill of ~3 s instead of 10–15,
on a board pinned at `LAB_DL = 40` (`src/game/runtime.js:3193`) — exactly
`TIERS[3].at`, the lowest clock value that gives the arena all three orbits, so
the black hole has three rings to add a fourth to. `firstMeet` and the
"taking an orb counts as being taught it" shortcut are both suppressed in the
lab (`src/game/runtime.js:5570` and `src/game/runtime.js:8559`); the second one
was found by a harness, not by reading, because the first guard looked like the
whole job and there were two.
