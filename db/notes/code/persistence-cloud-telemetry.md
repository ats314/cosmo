# Storage, cloud sync and telemetry

**What this answers:** every key the game writes, how the optional cloud account
folds into the same seam, and what leaves the device.

## Local storage keys — all prefixed `cometloop:`

The prefix is historical and deliberately kept so the rename did not wipe
anybody's saves (41–43).

| Key | Written by | Read by |
|---|---|---|
| `best` | `die()` 6349 | `loadPrefs` 3655 |
| `gl` | `die()` 6461 | `loadPrefs` 3661 |
| `runs` | `startGame` 6091 | `loadPrefs` 3663 |
| `muted` | `toggleMute` 2867 | `loadPrefs` 3679 |
| `swipe` | `pdEnd` 7318, `keyDown` 7420, `beginIntro` 6754 | `loadPrefs` 3682 |
| `groove` | `judgeTiming` 2622 | `loadPrefs` 3686 |
| `hopped` | `hop()` 6942 | `loadPrefs` 3689 |
| `landed` | — (see below) | `loadPrefs` 3690 |
| `struggle` | `die()` 6403 | `loadPrefs` 3691 |
| `seen` | `firstMeet` 5622, `die` 6388, orb pickup 8550, `finishIntro` 6792 | `loadPrefs` 3695 |
| `seen2` | `die()` 6389 | `loadPrefs` 3697 |
| `intro` | `beginIntro` 6757, `finishIntro` 6784 | `loadPrefs` 3665 |
| `auth` | `cloudSaveTok` 3772 | `cloudLoadTok` 3785 |
| `pid` | `TELE_ID` IIFE 4258 | itself |

Deliberately **not** read any more, and left on disk on purpose:
`cometloop:level` (it held the tier ordinal, so a stored 7 would read back as
level 7 of 6, 3657–3659), `cometloop:mode` (one mode remains, 3668–3674), and
every `:chill`-suffixed record (3152–3157).

`recKey(k, m)` (3138) is the seam a second mode would return through: the
unsuffixed keys are and always were skill's, so removing chill cost no player
their history and there is nothing to migrate.

`readLocal` (3643) and `savePref` (3722) are both wrapped in try/catch —
private-mode Safari throws on write, `file://` can throw on read.

## The cloud is bolted onto an existing seam

`loadPrefs` has always read an optional async `window.storage` alongside
`localStorage` and folded the two with `Math.max`. `cloudInstallStorage()` (3880)
installs a `window.storage` backed by `/api/progress`, so records, preferences and
the taught-mechanics set sync on a path that already existed and is already
merge-safe. `savePref` writes through it for free.

The merge is done **on the server** (`netlify/lib/records.mjs`), taking the max of
each record, so two devices commute and an offline device is safe to sync days
later. That is also why the client can post without reading first: it cannot
lower anything.

`cloudAdopt(d)` (3852) folds a freshly-arrived document into the live game and
writes back with `savePrefLocal` (3874) — **not** `savePref`, because `savePref`
writes through `window.storage` and a document writing itself back into itself is
a request per frame.

`CLOUD_ORIGIN = 'https://cosmo-arcade.netlify.app'` (3752). Auth is one field,
no email, no password: `cloudCreate(name)` → `/api/auth {action:'create'}`,
`cloudLink(code)` → `{action:'link'}`, `cloudCode()` → `{action:'code'}` (a
six-character code good for ten minutes, one use), `cloudRename`. The credential
is `{id, key, name}` and never expires — signing out is a local erase (3746–3750
and 3951).

`cloudSubmit(score, level, secs)` (3969) is offered at the end of a run and never
on its path: it refuses when signed out, in the lab, with a zero score, or under
5 s, and swallows every failure. `esc()` (4017) is the single XSS chokepoint for
every display name coming back from the board.

Signed out, offline, blocked or served from a host with no functions, the game is
byte-for-byte the game that shipped before any of this.

## Telemetry

No SDK and no third-party `<script>` — events are `sendBeacon`-first POSTs
straight to PostHog's capture API, with a `keepalive` fetch fallback, both
swallowing failures (4238–4248, 4302–4312).

- `POSTHOG_KEY` is a write-only project token, safe in a public file.
- `TELE_OK` (4251) is false on `file:`, `localhost`, `127.*` and `0.0.0.0`, so
  dev and test clones send nothing.
- `TELE_ID` (4256) is one random id per device in `cometloop:pid`, with a
  per-visit fallback in private mode.
- Every event carries `$process_person_profile:false`, `swipe_mode`, `play_mode`,
  `$current_url`, and `account_id` **only when signed in** — that is the join key
  between the Netlify records and the PostHog funnel, and it stays an opaque uuid.

**The lab is silent at the chokepoint, not by tagging** (4267–4276):
`if(LAB.on && name !== 'powerup_lab_started') return;`. A `lab_run` property would
have moved the burden onto every future query.

Events fired: `$pageview`, `run_ended`, `level_cleared`, `card_shown`,
`pick_chosen`, `lesson_shown`, `paused`, `share_tapped`, `swipe_mode_chosen`,
`start_level_chosen`, `powerup_lab_started`, `account_created`, `account_linked`,
`blackhole_entered`, `blackhole_survived`, `blackhole_failed`, `blackhole_died`.

## Naming discipline the file enforces on itself

Two ladders, two names, and `level` is retired rather than redefined: `tier` is
the zero-based unlock ladder, `game_level` is the 1–6 structure the player is
told about. `level` used to be sent on `run_ended` holding `tier+1` while
`level_cleared` sent it holding 1–3 — one property, two scales, across two
events. Likewise `swipe_mode` was already spent, so the difficulty mode is
`play_mode`; and `paused_seconds` rather than `paused`, because a bare `paused`
would be read as a boolean by the first person to query it.
