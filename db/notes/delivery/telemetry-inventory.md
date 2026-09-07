# Telemetry: every event, every global property, and what never leaves the device

*What this answers: exactly what Cosmo sends to PostHog, what it deliberately
does not send, where the choke points are, and which claims in
`docs/engine/telemetry.md` no longer match the code.*

## The transport

`src/game/runtime.js:4271-4343`. There is **no analytics SDK and no
third-party `<script>`** — events are plain POSTs to
`https://us.i.posthog.com/i/v0/e/`, `navigator.sendBeacon` first (so a death
recorded as the tab closes still gets out), `fetch(..., {keepalive:true})` as
the fallback, both wrapped so a blocked or dead network is silence. The body is
a JSON **string**, which goes out as `text/plain` — a CORS "simple request", no
preflight for `sendBeacon` to fail on.

The embedded key is `POSTHOG_KEY = 'phc_mqJcEAXMtZfZSfEFta3QrkyEXWRK3y7qjipqTX8UjcCj'`,
a PostHog **project token**: write-only by design, safe in a public file.

## Three gates before anything is sent

1. **`TELE_OK`** (`:4284-4288`) — false when `location.protocol === 'file:'` or
   the hostname starts `localhost`, `127.`, or `0.0.0.0`. Development and the
   harnesses therefore send nothing at all.
2. **The lab is silent** (`:4310`): `if(LAB.on && name!=='powerup_lab_started') return;`
   Suppression at the single choke point rather than a `lab_run` property,
   because tagging moves the burden onto every future query and the first
   dashboard that forgets the filter averages sandbox deaths — pinned clock, one
   orb on repeat, red switched off — into the real completion rate. An event
   added by a later session inherits the suppression for free. This is also why
   `blackhole_entered` still means "a player met one in a real run", which is
   the only reading its failure rate is worth anything under.
3. **Everything inside `track` is in a `try{}catch(e){}`** (`:4312-4343`), so a
   telemetry failure can never interrupt play. It is a listener, never a
   dependency.

The title screen discloses collection in the same footer band as the build
stamp: `if(POSTHOG_KEY)text('Anonymous play stats collected', …)` at
`src/game/runtime.js:12084`, one line above `'build '+BUILD` at `:12085`.

## Identity: one random id per device, and nothing else

`TELE_ID` (`:4289-4298`) reads or creates `localStorage['cometloop:pid']` as
`'p' + Math.random().toString(36).slice(2) + Date.now().toString(36)`. If
storage throws (private mode) it falls back to a per-visit id. No autocapture,
no session recording, no cookies, no names.

`TELE_ACCT` (`:3797`, stamped in `cloudSaveTok` at `:3815`) adds `account_id`
to every event **from a signed-in device only**. It is an opaque uuid arriving
with nothing else attached — no name, no email (there is no email in the system
at all), no second device id — and it is the join between the two halves of the
data: Netlify holds records and the board keyed by account, PostHog holds the
funnel keyed by the anonymous device id. A device that never signs in is
unchanged.

## The five properties stamped on every event

Set in `track()` before the POST (`:4313-4333`):

| Property | Value |
|---|---|
| `$process_person_profile` | always `false` — anonymous events by declaration, signed in or not |
| `swipe_mode` | `SWIPE_MODE`, `'radial'` or `'screen'` |
| `play_mode` | `MODE`, `'skill'` (the only mode; `CHILL` is retired) |
| `account_id` | only when `TELE_ACCT` is set |
| `$current_url` | `location.href` |

`play_mode` is deliberately **not** called `mode`: `swipe_mode_chosen` has
always carried the swipe rule under `mode`, and reusing the name would rewrite
what every historical row of that event says. One name per thing; retire, never
reuse.

## The events

Seventeen distinct names across eighteen call sites (`swipe_mode_chosen` fires
from two places). Line numbers are `src/game/runtime.js`.

| Event | Line | Properties beyond the five globals |
|---|---|---|
| `$pageview` | 4311 | none — *see the defect below* |
| `run_ended` | 6466 | score, best, new_best, run_index, seconds, orbits, best_streak, embers, scored, lands, best_groove, chorus_entries, chorus_bars, drops_earned, hold_timeout, best_combo, loop_caught, near_misses, pauses, paused_seconds, got_spot, got_blackhole, blackholes, tier, tier_name, rings, game_level, best_game_level, start_level, pows_placed, saw_warp, saw_nova, saw_hyper, picks, pick_n, did_hop, did_lap, did_reverse, death_cause, killer_lesson_seen, killer_relessoned, lessons_shown, blocks, gestures, gest_tap, gest_swipe, gest_late, gest_unresolved, misread_rate |
| `level_cleared` | 3615 | game_level, score, run_index, seconds, pauses, paused_seconds, chorus_entries, chorus_bars, fin_got, fin_perfect |
| `paused` | 3289 | game_level, tier, score, seconds, run_index |
| `blackhole_entered` | 2342 | game_level, tier, score, run_index |
| `blackhole_survived` | 2370 | game_level, seconds, shields_spent, charge, bonus, stars, run_index |
| `blackhole_failed` | 2355 | game_level, charge, run_index |
| `blackhole_died` | 6335 | game_level, tier, seconds, phase, reached_inner, stars, score, run_index |
| `lesson_shown` | 6884 | type, soft, rearmed, age, game_level, run_index, cut |
| `card_shown` | 6871 | game_level, after_clear, seconds, run_index |
| `pick_chosen` | 7307 | upgrade, game_level, offered, pick_index, run_index |
| `start_level_chosen` | 6855 | game_level, run_index |
| `swipe_mode_chosen` | 7327, 7424 | mode, hops |
| `powerup_lab_started` | 6688 | orb, ghost, run_index |
| `share_tapped` | 7058 | score, tier, run_index |
| `account_created` | 4200 | none |
| `account_linked` | 4209 | none |

## The naming rules that are load-bearing

- **One name per ordinal.** `game_level` is the 1-6 structure the player is told
  about; `tier` is the thirteen-rung zero-based unlock ladder, with `tier_name`
  from `tierLabel()` beside it on `run_ended` only. `level` used to be sent on
  `run_ended` holding `tier + 1` while `level_cleared` sent it holding 1-3 — one
  property name, two scales, two events. It is **retired rather than
  redefined**, so no historical row silently changes meaning; `tier` carried the
  same number all along.
- **`pauses` / `paused_seconds` ride both `run_ended` and `level_cleared`**, on
  the same per-level scale as the `seconds` beside them, because `startGame()`
  re-baselines the counters at every level boundary — without the pair on both
  events, a pause taken on level 1 of a run that died on level 4 was recorded
  nowhere at all. Carrying a cumulative total into `run_ended` would have put
  two scales on one event, which is the retired-`level` failure rather than a
  fix for it. `chorus_entries` / `chorus_bars` ride both for the same reason.
- **Paused time is a wall clock.** `pausedSeconds()` (`:3289-3291`) reads
  `performance.now()`, not the frame delta: `frame()` clamps `dt` to 0.05 s and
  `requestAnimationFrame` stops entirely while a tab is hidden, so a
  frame-delta accumulator recorded a ten-minute locked-phone break as 0.05
  seconds — the exact case the field exists to detect, reported as its
  opposite. It is read through a function rather than a field so an in-flight
  pause cannot be reported as zero.
- **`blackhole_survived` reports elapsed time**, `+(G.t-G.bhT).toFixed(1)`. It
  used to send `seconds: BH_DUR`, a constant reported as a measurement, so every
  row that would ever exist read 17.0.

## Three places `docs/engine/telemetry.md` no longer matches the code

1. **`mode_chosen` does not exist.** The document says "`mode_chosen` and
   `start_level_chosen` fire when those two screens are answered." There is no
   `track('mode_chosen'…)` anywhere in `src/game/runtime.js`; the difficulty-mode
   screen went away with CHILL. `start_level_chosen` is real (`:6888`).
2. **`blackhole_failed` is undocumented.** The document says "The black hole
   reports all three outcomes now: `blackhole_entered`, `blackhole_survived`
   and — new — `blackhole_died`." There is a fourth: `blackhole_failed`
   (`:2384`), which fires when the escape window closes and a shield absorbs the
   consequence, so the run continues. It is the distinction between "ran out of
   time but survived on a shield" and "died in there", and no document names it.
3. **`$pageview` is never delivered.** See below.

## The `$pageview` defect

`track('$pageview',{})` executes at `src/game/runtime.js:4344`.
`let SWIPE_MODE='radial'` is declared at `src/game/runtime.js:4364` — twenty
lines *after* it, in the same function scope (the whole runtime body lives
inside `createCosmoRuntime`). At line 4311 `SWIPE_MODE` is in its temporal dead
zone, so `pr.swipe_mode = SWIPE_MODE` (`:4317`) throws
`ReferenceError: Cannot access 'SWIPE_MODE' before initialization` — inside
`track`'s own `try{}catch(e){}`, which swallows it. The POST is never
constructed.

Every other `track()` call site is below line 4331 and is unaffected. The
failure is invisible by construction: telemetry is deliberately silent about its
own errors, and `TELE_OK` is false on localhost and under every harness, so it
cannot reproduce in development either. The consequence is that the one event
that counts a visit — the denominator of every funnel in the dashboard — has
never been sent from a deployed build.

The fix is to move the `let SWIPE_MODE='radial'` declaration above `track()`, or
the `track('$pageview',{})` call below line 4331. Nothing else in the file
depends on the current order.
