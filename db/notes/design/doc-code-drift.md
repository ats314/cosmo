# Where the design record and the source currently disagree

**What this answers:** which documented claims a session should NOT trust today,
verified line by line against `src/game/runtime.js` on 2026-09-07.

The repository's own rule (`docs/design/levels.md`): *a rule that disagrees with
its own enforcement is worse than no rule, because the next reader budgets their
design against the wrong boundary.* Each item below is that failure, live.

None of these are caught by `check.mjs`'s doc-staleness guard, which only asks
whether a constant's **current value** appears near its **name** in a document. A
retired feature described in the present tense names no constant.

---

## 1. The loop recorder is retired; three documents still describe it

- `docs/design/levels.md` — "### The loop recorder" section, present tense.
- `docs/design/teaching.md` — "### The loop recorder is visible".
- `docs/engine/telemetry.md` — lists `loop_caught` among the play-style aggregates.

Source: `LOOPQ` is "retained for lifecycle compatibility; no recorder schedules
this queue" (runtime.js:1029-1030); `LOOP` is "legacy recorder storage … kept inert
… no tape is captured or played back" (runtime.js:2215-2217); `bedTick` clears
both every frame — "retired recorder state cannot restart" (runtime.js:2770).
`G.loopN` is initialised to 0 (runtime.js:6237) and shipped on `run_ended`
(runtime.js:6483) but nothing increments it.

## 2. The adaptive render-scale degrade ladder is retired

`docs/engine/implementation.md:570-592` describes `GL_SCALE` starting at 0.60,
climbing on gameplay frames only, latching its ceiling down, and shedding the glow
before the sky, and states `fxcheck.mjs` "asserts the order". `docs/harnesses.md`
lists "render scales" under fxcheck.

Source: `const GL_SCALE=1.0; /* fixed quality; no performance downgrade */`
(runtime.js:9505). The `bloomHalo` disc fallback when `FX.on` goes false does still
exist (runtime.js:9126, 9211).

## 3. The drop-cost escalation is retired

`docs/design/audio.md` and `docs/design/difficulty.md` both describe an escalating
drop cost — 1.0 then +0.8 each, clamped at 2.75 under the meter's 2.9 cap.

Source: `const DROP_STEP=0, DROP_STEP_MAX=0;` and
`function dropNeed(){return upgOn('hairtrig')?2:3;}` (runtime.js:1325-1326).
`build()` accepts only completed star-fed orbits and counts to 3
(runtime.js:1332-1338). The long comment above `dropNeed` (runtime.js:1301-1324)
describes the retired curve and should be read as history.

## 4. Every player-facing lesson string in the docs is the previous wording

`docs/design/levels.md`'s unlock table and `MECHANICS.md`'s rows quote the older
sentences. The shipped `MEET` table and `TIERS[].sub` were rewritten since:

| doc says | source says (runtime.js) |
|---|---|
| two at once — swipe to another ring | `Two red obstacles: swipe to another ring` (5465) |
| every ring is blocked — tap to turn around | `A wall blocks every ring; tap to turn around` (5466) |
| it slides — the gap moves with it | `This red obstacle moves; tap to turn away` (5471) |
| harmless while dim — cross it then | `Pass while dim; bright red costs a shield` (5472) |
| the wall slides — turn around early | `The wall moves; tap to turn before it reaches you` (5473) |
| turn back and it blocks your ring — swipe off | `Turning triggers its shot; swipe to another ring` (5481) |
| only one is solid — cross the dim one | `One flashes red; pass the dim one` (5482) |
| it changes ring — watch where it lands | `It moves to the marked ring; swipe to another ring` (5489) |
| one ring is open — swipe to it | `Swipe to the ring with no wall` (5496) |
| no new tricks — just more of everything | `Collect stars and complete orbits to score` (4712) |
| inside is tighter — the music runs hotter | `Swipe to another ring to reach more stars` (4638) |
| red costs a shield — turn around or change ring | `Red hits cost a shield; tap to turn or swipe rings` (5453) |

The *rule* the docs record (banner sub == MEET lesson == death coach, one sentence
per idea) is intact and still enforced; only the quoted strings are stale.

The finale banner is likewise `{str:'COLLECT THE STARS', eyebrow:'LEVEL END',
sub:'Swipe between rings to collect them'}` (runtime.js:7940), not the "chase the
brightest star" / `FINISH LINE` wording in `docs/design/powerups.md`.

## 5. `mode_chosen` no longer fires

`docs/engine/telemetry.md`: "`mode_chosen` and `start_level_chosen` fire when those
two screens are answered." There is no `track('mode_chosen', …)` call site — the
mode cards went with CHILL. `start_level_chosen` does fire (runtime.js:6855).

## 6. `blackhole_failed` is undocumented

`docs/engine/telemetry.md` names `blackhole_entered`, `blackhole_survived` and
`blackhole_died`. All three exist (runtime.js:2342, 2370, 6335) — and so does a
fourth, `blackhole_failed`, fired when the escape deadline passes with a shield
still in the bank (runtime.js:2355). It appears in no document.

## 7. `SKY_ARENA_CALM` in `MECHANICS.md`'s sky table

`MECHANICS.md`'s header line correctly states 0.62 (which is what the source has,
runtime.js:339) but the "Red in the sky" row in the same file states **0.10** in
the present tense. The header's 0.62 is what satisfies the doc-staleness guard, so
the stale row passes CI.

## 8. Two stale inline comments in the runtime itself

- **`LEVEL_HOME=[0,1,2,3,4,7]` is annotated `/* DRIFT TIDE VEIL GLASS EMBERFALL
  DEEPFIELD */`** (runtime.js:336). Index 2 of `WORLDS` is **DUSTLANE**
  (runtime.js:283); VEIL is index 5. The values are right and the docs' mapping
  (THE STORM opens on DUSTLANE) is right; the inline comment names the wrong world.
- **"THIS COMMIT MOVES THE STRUCTURE, NOT YET THE LADDER"** (runtime.js:2996-3005)
  says all nine formations still unlock inside dl 0–340 and levels 4–6 introduce no
  new shape. The ladder rebuild it defers to has since landed: `TIERS` carries
  DIVERS at dl 395 and THE NARROWS at dl 520 (runtime.js:4698, 4708). The comment
  is now describing a state the file has left — the exact defect its own last
  paragraph warns about.
- **`spawnGap`'s interior comment** says the floor "keeps easing to 0.64 by dl 700"
  (runtime.js:4515-4518) above a newer comment and a line that actually ease to
  **0.50** (runtime.js:4533).
- **The upgrade-draft header** says "Three tiles on the calm card at the start of
  levels 2, 3 and 4" (runtime.js:4904). There are five level boundaries and
  eleven tiles; `rollOffer`'s own note (runtime.js:4983-4989) states the five-draw
  arithmetic correctly.
