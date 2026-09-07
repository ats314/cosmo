# FIRST FLIGHT — the four-step playable introduction

*What this answers: what the newest teaching channel is, what its four steps
say and require, and the two side effects it has that no design doc records.*

Code: `beginIntro()` `src/game/runtime.js:6750-6762`, `introPrompt()` `:6763-6772`,
`introFeedback()` `:6773-6776`, `introAction()` `:6777-6780`, `finishIntro()`
`:6781-6794`, `introTick()` `:6795-6830`. Rendered through `runMessage()`'s
first branch (`:11515-11517`) and the `Skip intro` control at `:11646-11653`.
Documented only in `docs/design/direction.md:74-77` and `README.md:17`;
`docs/design/teaching.md` does not mention it at all.

## The route in

`leaveMenu()` (`:6835-6840`) → `if(!G.runs||G.introPending) beginIntro()`. So a
device with zero runs, or one with `cometloop:intro === 'active'` from an
abandoned attempt, gets the introduction instead of the swipe chooser or the
level picker. The title screen also carries a `Learn to play` control
(`G.menuRects` id `intro`, pushed at `:12019`, handled at `:7180`) that calls
`beginIntro()` on demand.

## The four steps

`introPrompt()` builds them from two parallel arrays (`:6765-6771`):

| stage | title | detail | glyph | completion |
|---|---|---|---|---|
| 0 | `Tap to turn` | `One tap reverses your comet.` | `tap` | `introAction('turn')` → feedback `You turned.` |
| 1 | `Collect the star` | `Let your comet touch the gold star.` | `star` | `sweptHit` on the single planted star → `Star collected. +1` |
| 2 | `Complete an orbit` | `Go all the way around without turning.` | `orbit` | `G.lapAcc>=TAU` → `Orbit complete. +N` |
| 3 | `Change rings` | `Swipe down to move to the inner ring.` (screen rule) / `Swipe toward the centre to change ring.` (radial) | `hop` | `G.ringI!==I.fromRing && G.hopP>=1` → `You changed rings.` |

Each completion holds the card for 0.95s showing the feedback string in place
of the title (`introFeedback`, `:6773-6776`), then advances. Stage 2 also
publishes `progress: G.lapAcc/TAU`, which `drawMessageCard` renders as a bar.
Stage 3 raises `G.nRings` to 2 the moment it starts (`:6807`).

`introTick` runs *instead of* the normal update path (`:7885`, `if(G.intro){introTick(dt);return;}`)
and clears spikes, orbs, banners, lessons and announcements every frame
(`:6797`) — nothing can hurt you and nothing else can speak. Speed is pinned at
1.4. `firstMeet()` returns immediately while `G.intro` is set (`:5561`).

## The glyph bug

Stage 2 asks for glyph `orbit`. `runMessage` only rewrites `hop` → `swipe`
(`:11516`); `orbit` passes through unchanged, and `hintGlyph()`
(`:11365-11454`) has branches for exactly `tap`, `swipe`, `magnet`, `star`,
`shard`, `shield`, `beat`, `build`, `warp` and `nova` — **no `orbit`**. So on
the third of four steps of the first thing a new player ever sees,
`drawMessageCard` reserves 25 scaled units of vertical space (`:11565`) and
draws nothing into it.

## Two undocumented side effects

1. **It silently chooses the swipe rule.** `beginIntro` at `:6755-6757`:
   `if(!G.swipeAsked){SWIPE_MODE='screen';G.swipeAsked=true;savePref('cometloop:swipe','screen');}`.
   Because `leaveMenu` tests `!G.runs||G.introPending` *before* it tests
   `!G.swipeAsked`, a fresh device **never sees the WHICH WAY IS OUT chooser**.
   The chooser is now reachable only through the title screen's `Swipe controls`
   row (`G.swipeRect`, `:7167`, which clears `swipeAsked` and re-enters) or by
   opening the lab first (`openLab`, `:6844`). `docs/design/teaching.md`'s
   "asked once, on the first tap of a fresh device" is no longer how it works,
   and the default flipped from the file-level `let SWIPE_MODE='radial'`
   (`:4331`) to `screen` for every new player.
2. **It banks real score and a real orbit.** Stage 1 pays `G.score++` and
   stage 2 pays `6+13*min(G.lapEmbers,LAP_EMB_MAX)` with `G.orbits++`,
   `G.didLap=true`, `G.lapStreak=1` and a world-journey tick `G.skyW+=1/ORB_PER_WORLD`
   (`:6807-6826`). `finishIntro` keeps all of it — it explicitly does not restart
   the run — and sets `G.seen.orbit` if a lap landed (`:6792`), permanently
   retiring both the `orbit` MEET lesson and hint-ladder rung 6.

`finishIntro` also floors `G.nRings` at 2 and `G.tier` at 1, re-baselines
`G.started`, clears the board, and grants 2s of invulnerability (`:6787-6793`).
`cometloop:intro` is written `'active'` on entry and `'done'` on completion, so
a page reload mid-introduction resumes it rather than skipping it.
