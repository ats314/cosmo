# Accounts, the board, telemetry and delivery: the decisions

**What this answers:** why the optional cloud layer is shaped the way it is, what
was consciously left open, and the delivery rules that bound it.

## Optional in the same sense the sound is optional

The menu has always said *best with sound on — never required*, and this holds
itself to the identical rule. Signed out, offline, blocked by an extension, or
served from a host with no functions behind it — the game is exactly the game.
`localStorage` is still the real store. **Nothing here is ever on the path between
a tap and a comet moving**, and a failed request is swallowed rather than surfaced:
*a player who has just died is owed the death screen, not a network error.*

## It plugged into a seam that already existed

`loadPrefs()` has always read an optional async `window.storage` beside
`localStorage` and folded the two together with `Math.max`, because the file was
first written against a host that supplied one. **That seam is exactly a cloud
save.** The client installs a `window.storage` backed by `/api/progress`, and
`savePref()` writes through it for free. The only new code inside the game loop is
one call in `die()` offering the run to the board.

## The merge is server-side, and that is the whole point

Two devices on one account means two writers. The naive design — the client sends
its document, the server stores it — makes the last device to close its tab the
winner, **so a phone that has not synced since Tuesday overwrites Thursday's best
score, and the player watches a record they actually set disappear.**

`netlify/lib/records.mjs` folds instead, with the rules the game already applies
locally:

| Rule | Keys | Why |
|---|---|---|
| max | `best`, `gl`, `runs`, `struggle` | a record is monotonic by definition |
| sticky | `groove`, `hopped`, `landed` | "this human has once done X" can never become false — forgetting it replays a once-ever tutorial at somebody already taught |
| union | `seen`, `seen2` | the same argument over a set |
| last write | `muted`, `swipe`, `name` | a preference is a statement about *now*; applying max to a mute builds a mute that cannot be undone |

Once the records are monotonic, order stops mattering and the two devices commute —
which is what makes an offline device safe to sync days later. It also removes a
class of tampering for free: a client that posts `best:0` cannot lower anything.

**A key not in that table is not synced.** An unknown key would be an unbounded
write into a document the server hands back to every device on the account, and
*"store whatever the client sends" is how a save file becomes an injection vector.*
Adding a synced key is a decision.

## No passwords

Owner's call: *"we don't even need passwords."* You type a name, the server mints an
account and returns a 32-byte random key, and that key living in the browser **is**
the login. No email, no password, no reset flow — nothing between a friend and their
first run. A six-character transfer code, single-use and good for ten minutes, moves
the account to a second device; **that code is what makes this a *personal* login
rather than a per-device nickname.**

What it is **not** is proof of who anyone is. The key is a bearer token. That trade
is deliberate and sized to the situation — the thing being protected is a score on a
board among people who know each other — and **should be revisited before this is
handed to strangers.**

## The board is soft on purpose

The whole game is delivered to the browser and the repository is public, so anyone
who wants to POST a number can read exactly how. `scores.mjs` does not pretend
otherwise: signed in, integer, inside a rate bound, run long enough to have earned
it, one row per player so grinding is pointless.

The rate bound is **deliberately loose** — 1200 points a second against a game that
pays a couple of hundred at its best. *It exists to reject `9e9`, never to
adjudicate a good run, because a ceiling tuned close to real play would eventually
call somebody's genuine best a forgery, and that is a far worse failure than letting
an inflated one through.*

**What would actually close it** is replaying the run server-side from a seed and an
input log, and the game cannot do that today: it calls `Math.random` 73 times with
no generator of its own, and determinism is injected from *outside* by
`tools/lib/rng.mjs` for the harnesses only. Making the game self-seeding is the
prerequisite; it is a change to the game rather than to the service, and it would
also buy replays and ghost runs — which is why it is written down rather than
forgotten.

## Deliberately left open

- **The board is one blob, last write wins.** Two people finishing in the same
  second can drop an entry. The fix is a row per player assembled on read, which
  costs a list plus N gets on every page load. *Accepted rather than hidden.*
- **Signing out is a local erase.** Nothing expires, so a lost device stays signed in
  until the account is abandoned.
- **Names are not unique**, deliberately: uniqueness means telling a stranger which
  names are taken, a rejection on the one screen that has to be frictionless, and an
  index to keep consistent.

## The account panel is the only DOM in a canvas game

Everything else is drawn, down to the type, because the look is the product. But
this screen asks for a name, **and a canvas cannot raise a phone keyboard, cannot be
filled by a password manager, and has no caret, selection or paste.** Hand-rolling
those badly would make the one screen with a keyboard the worst screen in the game.

Two consequences: **every listener in this game is on the canvas except `keydown`,**
which is on `window`, so without a guard typing a name reverses the comet on every
space and mutes on every `m` — `CLOUD.open` is that guard. And **seven of the eight
harnesses run this file against a stubbed DOM** whose `getElementById` returns
something that is not an element, so this is the only part of the game that has to
survive not finding any nodes. *It found that out the honest way, by failing
`musiccheck` on the first run after it was written.*

## Telemetry: one name per ordinal

`game_level` is the 1–6 level on every event that carries it; the thirteen-rung
unlock ladder is only ever `tier`, with `tier_name` beside it on `run_ended`.
`run_ended` used to send `level` holding `tier + 1` while `level_cleared` sent
`level` holding 1–3 — **one property name, two scales, two events.** The ambiguous
name is **retired rather than redefined**, so no historical row silently changes
meaning.

`play_mode` rides on every event even though one mode ships, because without it a
second mode's deaths would average into one unreadable completion rate — and it is
deliberately **not** called `mode`, because `swipe_mode_chosen` has always carried
the swipe rule under that name.

`pauses`/`paused_seconds` and `chorus_entries`/`chorus_bars` ride on **both**
`run_ended` and `level_cleared`, on the same per-level scale as the `seconds` beside
them, because `startGame()` re-baselines the counters at every level boundary and
`run_ended` fires only on death — so a pause taken on level 1 of a run that died on
level 4 was recorded nowhere at all. **Carrying a cumulative total into `run_ended`
instead would have put two scales on one event, which is the retired-`level` failure
rather than a fix for it.**

**Paused time is wall-clock, never the frame delta.** `frame()` clamps `dt` to
0.05s and `requestAnimationFrame` does not fire while a tab is hidden, so a break
taken with the phone locked produces no frames — and a `dt` accumulator recorded a
ten-minute break as **0.05 seconds**, reporting the exact case the field exists to
detect as its opposite. The count-in still rides `dt` on purpose: it is an
animation, and a tab backgrounded mid-count should hold rather than silently expire.

`blackhole_survived` used to send `seconds: BH_DUR` — **a constant reported as a
measurement**, so every row that would ever exist read 17.0.

**There is deliberately no analytics SDK.** Events are plain POSTs to the capture
API (`sendBeacon` first, so a death recorded as the tab closes still gets out;
keepalive fetch as fallback), which means no third-party script to load and no
load-order to get wrong. One random id per device (`cometloop:pid`); no autocapture,
no session recording, no cookies, no names; the embedded key is a write-only project
token, safe in a public file by design. A copy served from `file://` or localhost
sends nothing at all, which keeps development and the harnesses out of the data. If
the analytics host is blocked — ad blockers commonly do — the game plays on
unaffected: **telemetry is a listener, never a dependency.** Expect ad blockers to
eat a fair share; ratios like `misread_rate` and run-4 retention survive that,
absolute player counts do not.

`account_id` rides on signed-in events only, as an opaque uuid with nothing else
attached, and `$process_person_profile` stays false — so a signed-in player's events
are still anonymous events that happen to carry a stable key.

## `misread_rate`, and where it is counted

Every swipe begins as a tap, so the input layer reverses speculatively and rolls
back once the finger travels. `GEST` counts where each gesture actually resolves:
`tap`, `swipe`, `lateSwipe` (only resolved at lift — worked, but it was close) and
`unresolved` (**the misread**).

Counted at the resolution sites, **deliberately not inside `bump()`** — that also
fires when a swipe hits the outermost or innermost ring, which is the game answering
correctly rather than failing to understand. *Conflating the two would make the
metric useless.*

`did_hop` is the one to watch first: a run ending with it false is a run where the
player never used half the game. Read against `misread_rate` — false with unresolved
swipes means the input was misread; false with no swipes at all means the lesson was
missed. **Those are opposite problems and no amount of level naming or content
pacing fixes either.**

## Delivery

- **Publish `dist/` only.** `public/` is intentional release content; internal
  documentation, tooling and native source must never become site assets.
  `check.mjs` walks both trees against an allowlist.
- **Two hosts, one allowlist.** `netlify/build.mjs` stages the site by *reading the
  `cp … _site/` line out of `.github/workflows/pages.yml`* rather than restating it.
  A second copy is a second thing to forget, **and the failure is silent on
  whichever host got missed:** an internal document becomes a public URL on one host
  and not the other.
- **`netlify/` is not `tools/`.** Every file in `tools/` is a CI harness and
  `check.mjs` enforces it — a lane declaration, a workflow step, a row in
  `harnesses.md`. The staging script asserts nothing, so filing it there would either
  break that guard or hollow it out.
- **A build stamp identifies source; a successful local build is not a live
  deployment.** Check the published URL before reporting release success. The old
  self-contained-HTML freshness parser is disabled in the Phaser host — searching for
  an inline `BUILD` literal is incorrect for a module bundle. **Never reload a live
  run to refresh it.**
- **Capacitor packages bundled assets with no release `server.url`.** Exact native
  origins are `https://localhost` and `capacitor://localhost`; CORS stays exact, no
  wildcard. Native share text must use the public game URL, never `location.origin`,
  which would produce a private localhost link.
- **Synchronise after the final web build**, and do not describe scaffolding as an
  APK, a signed app or a tested native release.
- **The established workflow is a direct main push after checks when shipping is
  authorized.** Do not manufacture a pull request or review-watching workflow.
