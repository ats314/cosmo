# The ledger rule, audited orb by orb and tile by tile

*What this answers: what "every shipped tier and lab orb must appear in
MECHANICS.md" actually enforces, whether the shipped roster currently satisfies
it, and where the ledger and the code disagree in ways the guard cannot see.*

Audited this session against `src/game/runtime.js`, `MECHANICS.md`,
`docs/design/powerups.md` and `tools/check.mjs` at commit `01a3a25`.

## What the guard actually is

`tools/check.mjs:313-340`. It reads `MECHANICS.md`, lowercases it, and pulls
two lists out of the runtime source with regexes:

```js
const tiersBlock = src.match(/const TIERS=\[([\s\S]*?)\n\];/);
const orbsBlock  = src.match(/const LAB_ORBS=\[([\s\S]*?)\n\];/);
const names = [...tiers name:'…', ...orbs n:'…'];
if (names.length < 8) fail(…);           // the regexes have stopped matching
for (const n of new Set(names))
  if (!hay.includes(n.toLowerCase())) fail(`'${n}' ships … but appears nowhere`);
```

Three properties follow, and all three matter:

1. **It is a substring test, not a row parse.** `SHIELD` passes because the
   word "shield" occurs somewhere — anywhere — in the file. A mechanic can be
   named in a paragraph about something else and satisfy the guard.
2. **It is one-directional.** It catches an orb in the code with no mention in
   the ledger. It cannot catch a ledger row describing something the code no
   longer does.
3. **It does not read `UPG`.** The eleven upgrade tiles are outside its scope
   entirely.

The `names.length < 8` floor exists because a regex that stops matching yields
an empty list and an empty loop reports success — which is the failure mode the
whole file is written against.

## The roster, checked

All ten `LAB_ORBS` names occur in `MECHANICS.md` today: SHIELD, SLOW-MO, NOVA,
MAGNET, HYPERNOVA, THE MIRROR, SCORCH, SLIPSTREAM, STAR TRAIL, BLACK HOLE. Each
also has a real row or section, not just an incidental mention:

| Orb | Where the ledger explains it |
|---|---|
| shield | Level 1 table, "Shield (green orb)" |
| slow-mo | Level 1 table, "Slow-mo (violet orb)" |
| nova | Level 1 table, "Nova (white orb)" |
| hypernova | Level 2 table, "Hypernova (pink star)" |
| Magnet | Level 2 table (see the filing note below) |
| the mirror | `### THE MIRROR — level 4's orb` |
| scorch | `### SCORCH — level 5's orb` |
| slipstream | `### SLIPSTREAM — level 2's hop reward` |
| star trail | `### STAR TRAIL — level 3's route reward` |
| black hole | `## Level 3+ — BLACK HOLE MODE` |

**No orb in the code lacks a ledger row.** That half of the rule is satisfied.

All eleven `UPG` names also occur in `MECHANICS.md` — every one of them inside
the single "Upgrade draft" row of the Level 1 table, which lists base → upgraded
for each. Nothing enforces that, so a twelfth tile could ship unmentioned and
the build would pass.

## Where the ledger and the code disagree

These survive the guard by construction. None of them is an orb missing a row;
all of them are a row saying something the code does not do.

* **Magnet is filed under the wrong level.** Its row sits in the
  `## Level 2 — INTO THE RINGS` table while its own Introduced cell reads
  "**Guaranteed on level 3**". The code agrees with the cell:
  `spawnPow` gates it on `G.level>=3` and `startGame` pre-spends `spotPlaced`
  when `G.level > 3`. The heading is the thing that is wrong.
* **There is no `HYPERNOVA ×2` chip.** Both `MECHANICS.md` and
  `docs/design/powerups.md` describe "the standing 'HYPERNOVA ×2' chip in the
  orb's own magenta". `drawPowerStatus` draws a row labelled `Hypernova` with a
  seconds countdown and a progress bar; the string `HYPERNOVA ×2` exists nowhere
  in `runtime.js`. Same for `SPOTLIGHT ×2`, which survives only as an example in
  the house-style comment at `runtime.js:149`.
* **"On-beat taps pay double" is loose.** `docs/design/powerups.md` says
  overcharge makes "embers and on-beat taps pay DOUBLE". Embers do double. A
  tight tap pays a flat `+8` while overdrive, hypernova, a full bank or the
  chorus is live, and pays *nothing* otherwise — so there is no base value being
  doubled. `MECHANICS.md`'s own Overcharge row gets this right ("a tight tap
  pays a flat +8"); it is the design doc that drifted.
* **Every orb lesson wording in the docs is paraphrased.** The docs use an
  em-dash lower-case house style; the shipped `MEET` strings use a semicolon,
  sentence-case style. Fully tabulated in `db/notes/content/doc-drift.md`.
* **"POWERUP TESTING bar"** — the control on the title screen reads
  `POWER-UP LAB`.
* **`power-spotlight.webp` is shipped and never read.** It is in
  `public/art/manifest.json`, `BootScene` loads every manifest texture, and
  `artifactSprite`'s `artKey` map has no `spot` entry. `docs/art/catalog.json`
  records the reason: *"Retired Spotlight art; not the current Magnet. Do not
  map to runtime spot."* The ledger says nothing about it either way.

## What would break the guard

A new orb added to `LAB_ORBS` without a ledger mention fails the build. A new
orb added to `spawnPow` but **not** to `LAB_ORBS` does not — the lab picker
table is the roster of record, and an orb that never enters it is invisible to
both the guard and `smoke.mjs`'s lab sweep, which also derives its list from
`LAB_ORBS`. That is the one path by which an orb could ship untested and
unledgered.
