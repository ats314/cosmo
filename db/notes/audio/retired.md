# Dead code and doc drift in the audio path

*What this answers: which documented audio behaviour no longer runs, which
identifiers have no reader, and which comments describe a game that is not the
one shipping. Read this before "fixing" anything in the drop path.*

Everything below was verified by grepping the whole of `src/game/runtime.js`
for writers and readers in this session.

## 1. The rise and the hush do not exist

`docs/design/audio.md` describes the drop as *"A rise, a SILENCE, and the hit —
and the third is the one that was missing"*, and the source repeats it at length
around `runtime.js:1257-1273`. **Only the hit runs.**

- `MU.rise` is assigned `false` in exactly two places (`fireDrop:1430`,
  `endSection:1556`) and initialised `false` in `buildBed:1071`. **It is never
  assigned `true` anywhere in the file.** Every `if(MU.rise)` / `!MU.rise` guard
  is therefore a constant.
- `musicStep:1698` is `const rn=-1, rise=false;` followed at `1739-1761` by an
  `if(rise){...}` block containing the whole two-bar rise — the sweeping
  sawtooth, the highpass riser, the snare rolls. **Unreachable.**
- `schedulePreDrop(tD)` (`runtime.js:1404-1428`) — the hole, the −13 dB swallow,
  the −26 dB last eighth, the 8 ms restore landing on the beat, the filter slam
  to 220 Hz — **has no caller.** The only other mention of its name in the file
  is a comment in `bedTick` telling you not to fight a param it owns.
- Consequences that follow, each a permanently-false condition:
  - `A.hole.gain` never leaves 1. The drop has no silence in front of it.
  - `MU.hushEnd` never leaves 0, so `duckBed`'s hush guard (`2812`) and
    `musicTick`'s cleanup test (`2676`) never see it.
  - `MU.lpLock` never leaves 0, so `bedTick`'s `t >= MU.lpLock` (`2802`) is
    always true.
  - `MU.landT` / `MU.landDone` never reach the state the draw code at
    `runtime.js:9440` reads (`MU.landT && !MU.landDone`), so that countdown arc
    never draws.
- `MU.riseI` has no writer other than `endSection`'s reset.

`docs/design/audio.md` itself says the timed drop-landing challenge was retired,
which is consistent with `tryLand()` being emptied — but the *hush* was a
production move, not a challenge, and nothing in the docs records its removal.

## 2. The drop economy in the docs is not the drop economy in the code

`docs/design/audio.md` devotes a long section to an escalating drop cost —
1.0 then +0.8 each, clamped at 2.75 under a 2.9 meter ceiling, with `hairtrig`
scaling the curve. The source comment at `runtime.js:1300-1324` says the same
thing with different numbers (capped at 4.2). **Neither is what runs.**

```js
const DROP_STEP=0, DROP_STEP_MAX=0;          // no readers anywhere
function dropNeed(){return upgOn('hairtrig')?2:3;}
function build(amount,src){
  ...
  if(src!=='orbit'||amount<0.04)return;      // everything else is discarded
  G.build=Math.min(dropNeed(),G.build+1);
  ...
}
```

`G.build` is now an **integer count of completed star-fed orbits**, 0..3 (0..2
with `hairtrig`), and the HUD reads it as `'STARFALL ' + earned + ' / ' + n +
' ORBITS'` (`runtime.js:11635-11636`).

Live but inert `build()` call sites — each still executes, each returns at the
source filter:

| Site | Call | Why it does nothing |
|---|---|---|
| `2600` | `build(0.011,'time')` on a chain climb | src !== 'orbit' |
| `2616` | `build(0.06,'time')` at ×8 — documented as "a build bonus worth about a quarter of the meter" | src !== 'orbit' |
| `6964` | `build(0.021,'hop')` on a ring change | src !== 'orbit' |
| `7692` | `build(0.006,'orbit')` on a near miss | amount < 0.04 (deliberate, and the code comments say so) |
| `7749` | `build(dt/50,'time')` — documented as "the trickle a survivor still gets" | src !== 'orbit' |
| `8363` | `build(0.043,'orbit')` on a completed star-fed orbit | **this is the only live one** |

Related dead identifiers:

- `BUILD_SRC` (`runtime.js:1299`) — the four HUD strings naming what filled the
  meter. **No reader in the repo.**
- `G.buildSrc` and `G.buildSeg` — initialised at `5037`, reset at `6142`, never
  read or written elsewhere.
- `LAND_PERFECT` (`runtime.js:1338`) — no reader. `LAND_WIN` survives with one
  reader in the draw code (`9441`).
- `tryLand()` (`runtime.js:1339`) is `{}`. Three input handlers still call it
  (`7247`, `7439`, `7442`, `7447`).

Stale comment: `runtime.js:8358-8362` still explains that "the gap GROWS each
time … 4 orbits, then 9, then 16, then 25". `dropNeed()` is flat.

## 3. `PAYREST` is zero

`const PAY=32, S16=SPB/4, PAYLEN=PAY*(SPB/2), PAYREST=0;` (`runtime.js:905`).

Both the doc ("Four bars of ordinary arrangement is still a real breath between
sections") and the comment immediately above the line describe `PAYREST` as a
musical breath. It is 0, so `MU.cool = t + PAYLEN` and a banked Starfall can fire
on the eighth immediately after the section ends.

## 4. The recorder is fully inert

Retired but deliberately kept for cleanup paths, per the invariant that
end-of-run cleanup drains legacy queues:

- `LOOPQ` (`runtime.js:1030`) — cleared in `bedTick` every frame (`2770`),
  in `endSection` and in `startGame`. **Never pushed to.**
- `LOOP` (`runtime.js:2217`) — `{pat, n, until, heard}`, only ever reset.
  `LOOP.pat` is read once, in `musicTick`'s cleanup condition.
- `PLAY.tape` — only ever `.length=0`.
- `G.loopFx` — only ever zeroed.

`musiccheck` asserts this is still true (`tools/musiccheck.mjs:1390-1398`:
"the retired recorder captured or replayed a movement phrase").

## 5. Harness message drift

`tools/musiccheck.mjs:562` fails with *"heat 0.5 lifted the song — the 0.62
threshold is not being read"*. The live threshold is `PLAY.heat > 0.50`
(`runtime.js:1660`). The test still passes (0.5 is not > 0.50) but it is now
passing by a hair against a message that names a number the code has not used
for some time. A future tuning pass that moved the threshold to 0.48 would
break the test with a message pointing at the wrong constant.

Same file, `tools/musiccheck.mjs:536-539` calls the chorus eval "five OR'd
terms". It has six (`G.od`, `G.hyper`, `MU.glow`, `G.groove`, `G.lapStreak`,
`PLAY.heat`), and the roads loop tests four of them plus the heat threshold.

## 6. Coverage gap: `G.lapStreak` has no road test

`G.lapStreak >= 2` is the term `docs/design/audio.md` calls the fix that saved
the chorus — the axis that rewards the player who travels over the player who
mashes. `musiccheck`'s per-term roads list (`tools/musiccheck.mjs:541-548`)
covers `afterglow`, `groove chain`, `overdrive` and `hypernova`. **`lapStreak`
is not in it**, and the file's own comment explains exactly why that matters:
*"A deleted afterglow term … left every check green, which is the dead-tile
failure with a progression instead of an upgrade."*

`G.lapStreak >= 2` also appears in the `driving` gate (`runtime.js:1770`) and in
`A.band`'s `earned` term (`runtime.js:2730`), and neither of those is covered
per-term either.
