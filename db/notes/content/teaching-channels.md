# Every channel that explains a mechanic, and who wins when two fire

*What this answers: which surfaces in Cosmo teach the player something, what
order they resolve in, and where the "one instruction card at a time" rule is
actually enforced in code.*

Read with `db/records/parts/content-teaching.jsonl`. Every line number here was
read in `src/game/runtime.js` (12,272 lines) in the session that wrote this.

## The single choke point

`runMessage()` — `src/game/runtime.js:11513-11541` — is the whole rule. It is a
chain of `return`s, so **exactly one** message object leaves it per frame, and
`drawRunHUD` calls `drawMessageCard(runMessage())` once
(`src/game/runtime.js:11641`). There is no second in-arena instruction surface:
`drawPowerStatus` prints countdowns, the header prints score/level/streak, and
the tier-banner, say-line and hint-ladder channels all arrive *through*
`runMessage`. That is the enforcement of the binding rule.

Priority, highest first, verbatim from the function body:

| # | Source | Tag printed | Guard |
|---|---|---|---|
| 1 | `introPrompt()` — the FIRST FLIGHT playable intro | `FIRST FLIGHT · n / 4` | `G.intro` non-null |
| 2 | Black hole, phase 1 / 3 | `BLACK HOLE` | `bhActive()` |
| 3 | Black hole, phase 2 | `BLACK HOLE` or `ESCAPE · Ns` | `bhActive()` |
| 4 | Star dive / finale | `FINISH THE LEVEL` | `FIN.on` |
| 5 | Starfall running | `STARFALL · Ns` | `starfallActive()` |
| 6 | Starfall result | `STARFALL COMPLETE` | within 2s of `G.starfallResult.at` |
| 7 | First-encounter lesson | `TRY THIS` | `G.teachHint && G.teach>0` |
| 8 | Tier banner | `NEW IN THIS WORLD` (when eyebrow is `UNLOCKED`) else the eyebrow, else `DISCOVERED` | `G.banner` |
| 9 | Starfall armed | `STARFALL EARNED` | `G.armFx` |
| 10 | Say-line queue | `NEW MUSIC` / `POWER ACTIVE` / `IN THE MUSIC` | `G.sayFx` |
| 11 | Hint ladder | `FLIGHT TIP` | `hintText()` returns non-null |

Two consequences worth knowing before editing anything:

* A **say-line is silently swallowed** while a lesson or banner is on screen.
  `say()` queues into `ANN` with a TTL (`src/game/runtime.js:4372-4375`);
  `annPump` (`:4377-4390`) refuses to promote one while `G.banner.t<2.6`, and
  `G.sayFx` itself only lives 1.8s (`:7750`) against a 2.8s minimum spacing
  (`annNext`). A pickup line that loses the race is dropped, not deferred.
* The **hint ladder is bottom of the stack**, so any of the ten above hides it.
  It is not a separate strip at the bottom of the screen any more — the
  "bottom-of-screen glyph+sentence rungs" in `docs/design/teaching.md` describe
  a layout that no longer exists.

## The channels themselves

1. **FIRST FLIGHT** — `beginIntro`/`introPrompt`/`introTick`,
   `src/game/runtime.js:6750-6830`. Four playable steps on the real arena.
   See `db/notes/content/first-flight-intro.md`.
2. **Menu demo** — `menuDemo`, `src/game/runtime.js:7492-7504`. A 12-second
   scripted loop behind the title screen: shard fades in at t=1, reverse at
   t=2.8, hop inward at t=6, hop back at t=9. Wordless.
3. **Tier banners** — set at `src/game/runtime.js:8195`, 3.2s life
   (`:8220`). `sub` is word-for-word the type's `MEET` lesson; `smoke.mjs`
   fails the build on any drift (`tools/smoke.mjs:354-355`).
4. **MEET first-encounter lessons** — `MEET` table `src/game/runtime.js:5438-5559`,
   fired by `firstMeet()` `:5560-5634`. See
   `db/notes/content/meet-lessons.md`.
5. **Hint ladder** — `hintText()`, `src/game/runtime.js:11455-11481`. Nine
   rungs, first match wins. See `db/notes/content/hint-ladder.md`.
6. **Level cards** — `G.state==='lvend'`, drawn `src/game/runtime.js:11884-11946`.
   One tip line, not a row list. See `db/notes/content/level-cards.md`.
7. **Say lines** — 14 call sites; the orb pickups at
   `src/game/runtime.js:8619-8708`, overcharge at `:8601`, shield-cap growth at
   `:8079`, overdrive at `:8053`, black hole escape at `:2268` and `:2353`,
   `GREAT TIMING` at `:2634`.
8. **Popups** — the shield spend, `src/game/runtime.js:7654-7656`:
   `-1 SHIELD · N LEFT`, or `NO SHIELDS: AVOID RED` when the bank empties.
   The near-miss `DODGED +3` at `:7689`.
9. **Death coach** — set in `die()`, `src/game/runtime.js:6362-6374`; drawn
   `:12134-12143`.
10. **Three sound cues** — `cueUnlock` (banner) `:3568`, `cueLesson` (a MEET
    lesson is on screen) `:3576`, `cueState(on)` (a standing bonus opens or
    closes) `:3583`.
11. **The lab picker** — `LAB_ORBS`, `src/game/runtime.js:3173-3184`. Ten rows,
    each description lifted from `hintText` or `MEET` by design.
12. **Swipe-rule chooser** — `G.state==='swipesel'`, drawn `:11947-11981`. Two
    rows plus CONFIRM, on a live arena.

## What the harnesses actually assert

* `tools/curriculum.mjs:233-238` — sixteen `MEET` keys must have a `seen` or
  `seen2` bit by the time a driven climb reaches the last level plus 90s.
* `tools/curriculum.mjs:252-259` — the eleven named tier banners must arrive in
  ladder order.
* `tools/smoke.mjs:346` — every `TIERS[].type` has a `MEET` entry.
* `tools/smoke.mjs:354-355` — every tier `sub` is byte-identical to its lesson.
* `tools/smoke.mjs:359-360` — no `MEET` string may match `/red kills/`.
* `tools/smoke.mjs:347` — `spot`, `hyper` and `lapcost` keep `soft:1`.
* `tools/check.mjs:68-71` — `MEET` may not name the cut orbs `echo`/`meteor`.
* `tools/check.mjs:313-340` — every `TIERS[].name` and `LAB_ORBS[].n` must
  appear somewhere in `MECHANICS.md`, case-insensitively.

Nothing checks the *wording* of a hint-ladder rung, a level-card tip, a say
line, a popup or a lab description against anything.
