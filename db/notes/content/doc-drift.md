# Where the teaching docs quote wordings the game no longer has

*What this answers: which sentences in `docs/design/teaching.md`,
`docs/design/levels.md` and `MECHANICS.md` no longer exist anywhere in
`src/game/runtime.js` — so a future session does not "fix" the code back to
match the prose.*

Every "in source" column below was read in `src/game/runtime.js` this session.
`tools/check.mjs:313-340` only checks that each `TIERS[].name` and
`LAB_ORBS[].n` *appears somewhere* in `MECHANICS.md` — it does not compare a
single sentence, which is why this drift is invisible to the build.

## Lesson and banner wordings

The docs use an em-dash, lower-case house style; the shipped strings use a
semicolon, sentence-case style. This is a whole-table rewrite that the prose
never absorbed.

| doc quote | in source (`MEET` / `TIERS`) |
|---|---|
| `red costs a shield — turn around or change ring` | `Red hits cost a shield; tap to turn or swipe rings` (5453) |
| `two at once — swipe to another ring` | `Two red obstacles: swipe to another ring` (5465) |
| `every ring is blocked — tap to turn around` | `A wall blocks every ring; tap to turn around` (5466) |
| `it slides — the gap moves with it` | `This red obstacle moves; tap to turn away` (5471) |
| `harmless while dim — cross it then` | `Pass while dim; bright red costs a shield` (5472) |
| `the wall slides — turn around early` | `The wall moves; tap to turn before it reaches you` (5473) |
| `turn back and it blocks your ring — swipe off` | `Turning triggers its shot; swipe to another ring` (5481) |
| `only one is solid — cross the dim one` | `One flashes red; pass the dim one` (5482) |
| `it changes ring — watch where it lands` | `It moves to the marked ring; swipe to another ring` (5489) |
| `one ring is open — swipe to it` | `Swipe to the ring with no wall` (5496) |
| `hypernova — the pink star: untouchable and fast` | `Hypernova: move faster, safe from red, for about 9s` (5509) |
| `the mirror — a second you, gathering the far side` | `Mirror: a second comet collects stars and clears red for about 9s` (5514) |
| `scorch — keep moving, your wake burns red away` | `Scorch: your path clears red obstacles for 8s` (5520) |
| `slipstream — change ring to clear your landing` | `Slipstream: swipe rings to clear nearby red for 12s` (5521) |
| `star trail — follow the gold stars between rings` | `Star trail: collect nine bonus stars within 16s` (5522) |
| `inside is tighter — the music runs hotter` (THIRD RING) | `Swipe to another ring to reach more stars` (4638) |
| `no new tricks — just more of everything` (THE EYE) | `Collect stars and complete orbits to score` (4712) |
| `your moves play the music — every tap is a note` | `Each tap and ring change plays a note` (5550) |
| `tap as the ring lands and the chain climbs` | `Tap with the beat to earn bonus points` (5555) |
| `COMBO — stars in a row, up to +6 each` | `Collect stars close together to earn up to 6 points each` (5559) |
| `turning back restarts the orbit — stars stay banked` | `Turning restarts your orbit; collected stars still count` (5544) |

## Popups and say lines

| doc quote | in source |
|---|---|
| `SHIELD USED · N LEFT` | `-1 SHIELD · N LEFT` (`:7654`) |
| `LAST SHIELD — RED KILLS NOW` | `NO SHIELDS: AVOID RED` (`:7655`) |
| `SHIELDS FULL — stars pay double` | `Shields full: stars now score double` (`:8601`) |
| `BANK DEEPER` | `You can now hold N shields` (`:8079`) |
| `OVERDRIVE ×2` / `HYPERNOVA ×2` HUD chips | `drawPowerStatus` prints named countdowns — `Hypernova`, `Magnet`, `Mirror`, `Scorch`, `Slipstream`, `Slow-mo`, `Star trail` (`:11585-11611`); no `×2` chip exists |
| `LAPS ×7` → `CLEAN ORBITS · 7` | `N clean orbits` (`:11632`) |
| `SPOTLIGHT ×2` | the orb is `MAGNET` everywhere; `spot`/`stagelight` survive only as save keys |

## Screens

* **"The menu key is four rows, not nine."** There is no key on the title
  screen. `G.state==='menu'` (`:11982-12028`) draws the logo, `Move with the
  music.`, an optional `BEST` line, `LAUNCH`, `POWER-UP LAB` / `SIGN IN` /
  `LEADERBOARD`, a `Swipe controls` row and a `Learn to play` row. The two
  verbs are now taught by the 12-second demo comet and by FIRST FLIGHT.
* **"POWERUP TESTING bar"** — the control reads `POWER-UP LAB` (`:12010`).
* **The swipe chooser** is no longer asked on the first tap of a fresh device;
  `beginIntro` picks `screen` silently. See
  `db/notes/content/first-flight-intro.md`.
* **The hint ladder** is not a bottom-of-screen strip; it is the lowest-priority
  branch of the centre message card.
* **The camp hint** does not exist. `G.campT` is incremented and never read.
* **The level 1 card's "three rows"** never render — one hard-coded tip does.
  See `db/notes/content/level-cards.md`.
* **The death coach's glyph** is chosen (`G.coach.g`, `:6362`, `:6369`) and
  never drawn; the death-screen block reads only `G.coach.t` (`:12134-12143`).

## Upgrade tile names

`docs/design/teaching.md`'s wiring table names HAIR TRIGGER and STAGE LIGHT;
the shipped tiles print **EARLY STARFALL** (`hairtrig`) and **LONG MAGNET**
(`stagelight`). Ids are unchanged, so the wiring guard in `check.mjs` still
passes. `MECHANICS.md` has the current names.

## What is still accurate

The structural claims survive: one sentence per idea (banner `sub` ≡ `MEET`
lesson, enforced), no lesson may say red kills outright (enforced), the insist
rule, the once-per-run orb guarantees, the death re-arm, the lab spending no
lesson, the 9-second lesson spacing, the near-frozen 0.06x hard lesson, and the
three fixed sound cues. It is the *wordings* and the *screens* that moved.
