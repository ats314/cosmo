# Telemetry

*What is collected, what it is named, and what never leaves the device.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

The game reports anonymous gameplay counters to PostHog (US cloud) so
playtests can be read instead of retold: a pageview per visit, `run_ended`
on every death (score, game level, run length, death cause, the two-verb usage
counts and the swipe-misread rate — the "did the teaching land" numbers),
`level_cleared` on every finish line (with the Star Dive tally, 11 being
the perfect ending), and `share_tapped`. **One name per ordinal:**
`game_level` is the 1–3 level on every event that carries it, and the
ten-rung unlock ladder is only ever `tier`. `run_ended` used to send `level`
holding `tier + 1` while `level_cleared` sent `level` holding 1–3 — one
property name, two scales, two events. The ambiguous name is retired rather
than redefined, so no historical row silently changes meaning; `tier` carried
the same number all along. The two difficulty modes ride on every event as
`play_mode` — with a second mode, deaths would otherwise average into one unreadable
completion rate, exactly as the two swipe rules would — and it is deliberately
**not** called `mode`, because `swipe_mode_chosen` has always carried the swipe
rule under that name and reusing it would rewrite what every historical row of
that event says. `run_ended` also gained `start_level`, the level a run opened
on: every run used to open on 1, so without it a level-4 run picked from the
front screen is indistinguishable from one played to, and the completion funnel
would count a jump as a climb. `mode_chosen` and `start_level_chosen` fire when
those two screens are answered. The teaching pipeline reports on
itself now too: `lesson_shown` fires when a first-encounter lesson actually
completes its display (type, soft form or not, whether it was a death-
triggered re-offer, seconds into the run), `card_shown` fires when a level
card is dismissed (which level, after a clear or a retry, how long it was
read), and `run_ended` gained `killer_lesson_seen` / `killer_relessoned` /
`lessons_shown` — so "died to a mechanic whose lesson was never shown" and
"died to it even after the re-offer" are directly countable funnels rather
than guesses. The play-style aggregates round it out: `lands` vs
`drops_earned` (the countdown's conversion rate), `best_groove` and
`best_combo` (did the rhythm and combo lessons change behaviour),
`hold_timeout` (the twin exam arrived by hop or by the release valve —
the purest hop-teaching signal), `loop_caught`, `near_misses`, and
`got_spot` alongside the existing orb pickup flags.
`chorus_entries` and `chorus_bars` ride on `run_ended` *and* `level_cleared`
(the same per-level scale and split as `pauses`, for the same reason): did a
run ever lift the song, and could it stay there — the two numbers that say
whether the chorus threshold is tuned right. **The black
hole reports all three outcomes now:** `blackhole_entered`, `blackhole_survived`
and — new — `blackhole_died`, which did not exist, so the mode's failure rate,
the one number that says whether it is too hard, lived nowhere and had to be
reconstructed by hand-joining an entry to a later `run_ended`. It carries how
many seconds were survived, which phase the death fell in, and whether the
innermost orbit had been reached. `blackhole_survived` used to send
`seconds: BH_DUR` — a constant reported as a measurement, so every row that
would ever exist read 17.0; it sends the elapsed time.
**Pause reports `pauses` and `paused_seconds`**, on `level_cleared` as well as
`run_ended` and on the same per-level scale as the `seconds` beside them —
`startGame()` re-baselines the counters at every level boundary, so without the
pair on both events a pause taken on level 1 of a run that died on level 4 was
recorded nowhere at all. Carrying a cumulative total into `run_ended` instead
would have put two scales on one event, which is the retired-`level` failure
rather than a fix for it. Paused time is measured on a **wall clock**: `frame()`
clamps `dt` to 0.05s and `requestAnimationFrame` stops entirely while a tab is
hidden, so a break taken with the phone locked produces no frames, and a
frame-delta accumulator recorded ten minutes as 0.05 seconds — the one case the
field exists to detect, reported as its opposite.
**A POWERUP TESTING session sends nothing**, and it is suppressed at the choke
point inside `track()` rather than tagged with a property. Tagging would have
been the smaller change and the worse one: it moves the burden onto every
future query, and the first dashboard that forgets the filter is averaging
sandbox deaths — pinned clock, one orb on repeat, red switched off — into the
real completion rate. Suppressing means a lab run cannot reach the funnel and
an event added by a later change inherits that for free. Note what that means
for the three black hole events above: a lab session is the easiest way there
has ever been to enter the mode, and none of those entries reach the data — so
`blackhole_entered` keeps meaning "a player met one in a real run", which is
the only reading its failure rate is worth anything under. Exactly one name is
allowed through, `powerup_lab_started`, carrying which orb was picked and
whether the ghost was on; which of the six anybody actually wants to look at
is the one thing about a lab session worth counting. There is deliberately no
analytics SDK: events are plain POSTs to the capture API (sendBeacon
first, so a death recorded as the tab closes still gets out; keepalive
fetch as fallback), which means no third-party script to load and no
load-order to get wrong. Each device gets one random id
(`cometloop:pid`); no autocapture, no session recording, no cookies, no
names — the embedded key is a write-only project token, safe in a public
file by design. A copy served from `file://` or localhost sends nothing at
all, which keeps development and the test harnesses out of the data. If
the analytics host is blocked (ad blockers commonly do) the game plays on
unaffected — telemetry is a listener, never a dependency.
