# Accounts, synced records and the board

*What this answers: how the optional account service works end to end, exactly
which keys sync and by which rule, what the threat model is and where it stops,
and which parts of the client half do not do what the design says.*

## The rule that shapes everything

Accounts hold themselves to the same standard as sound: *optional, in the same
sense the sound is optional.* Signed out, offline, blocked by an extension, or
served from a host with no functions behind it, the game is exactly the game.
`localStorage` is the real store; the cloud is a copy that follows an account
between devices. `src/game/runtime.js:3762-3785` states it and the code obeys
it — every cloud promise ends in a swallowed `.catch()`, and
`cloudSubmit()` refuses outright inside the lab, on a zero score, or on a run
under five seconds (`src/game/runtime.js:3999-4012`).

## The seam it plugged into

`loadPrefs()` has always read an optional async `window.storage` beside
`localStorage` and folded the two with `Math.max`, because the file was first
written against a host that supplied one (`src/game/runtime.js:3726-3753`).
`savePref()` writes to both (`:3755-3760`). The cloud is nothing more than an
implementation of that interface: `cloudInstallStorage()`
(`src/game/runtime.js:3911-3934`) sets `window.storage` to a `{get,set}` pair
backed by `/api/progress`, and `cloudRemoveStorage()` deletes it on sign-out, so
*the signed-out game is byte-for-byte the game that shipped before any of this*.

Two details that are easy to break:

- `cloudAdopt()` must call `savePrefLocal()` and never `savePref()`
  (`:3904-3909`) — `savePref` writes back through `window.storage`, and a
  document that writes itself back into itself is a request per frame.
- The session is restored in an IIFE at `src/game/runtime.js:4014-4022`, before
  `loadPrefs()` runs at `:5104`, so the first `window.storage.get` is a real
  read rather than a miss.
- `runtimeDestroy()` flushes a pending debounced push and only removes
  `window.storage` if it is still the one this runtime installed
  (`:12310-12312`).

## The endpoints

Three functions, each declaring its own path via `export const config`.

| File | Path | Methods |
|---|---|---|
| `netlify/functions/auth.mjs` | `/api/auth` | POST with `action`: `create`, `rename`, `code`, `link` |
| `netlify/functions/progress.mjs` | `/api/progress` | GET reads the account document, PUT/POST folds one in |
| `netlify/functions/scores.mjs` | `/api/scores` | GET reads the board, POST offers a run |

The client calls them at an absolute origin — `CLOUD_ORIGIN =
'https://cosmo-arcade.netlify.app'` (`src/game/runtime.js:3785`) — which is what
lets the GitHub Pages copy and both native WebViews reach the same service.

Both blob stores use `consistency: 'strong'`: `progress.mjs:31` because it is a
read-modify-write two devices can race, and `scores.mjs:39` for the board.
Store names are `cosmo-accounts`, `cosmo-progress`, `cosmo-scores`.

## Who is asking

`netlify/lib/auth.mjs:15-25`. A request carries
`Authorization: Bearer <id>.<key>`, matched against
`/^Bearer\s+([0-9a-f-]{8,64})\.([0-9a-f]{32,128})$/i`. The id is looked up in
the blob store and the key compared with `keyMatches`. Nothing is decoded out of
the token — the comment names the failure that prevents: believing a
self-asserted id.

`keyMatches` (`netlify/lib/accounts.mjs:56-61`) is a length-checked XOR
accumulate rather than `===`, and says why: the threat here is nil and the cost
is nil, but `a === b` in an auth path is the line that gets copied somewhere it
matters.

## CORS is an exact list, never a wildcard

`netlify/lib/auth.mjs:40-48`, seven origins:

```
https://cosmo-arcade.netlify.app   the Netlify copy
https://ats314.github.io           the GitHub Pages copy
https://localhost                  bundled Capacitor Android WebView
capacitor://localhost              bundled Capacitor iOS WebView
http://localhost:5173              the Vite dev server
http://localhost:8000
http://localhost:8888              netlify dev
```

`cors()` echoes the origin only on a match and sets `vary: origin`.
`preflight()` answers `OPTIONS` with 204 **before any handler runs and without
requiring auth** — the browser sends OPTIONS with no `Authorization` header by
design, so an endpoint that 401s its own preflight is unreachable cross-origin.
`docs/invariants.md:119-120` makes the exactness a rule; the code's own comment
gives the reason a `*` would be wrong: these endpoints carry a bearer key, and
`*` is the shape of an account any page on the internet can read.

## No passwords

`netlify/lib/accounts.mjs`. You type a name; the server mints
`crypto.randomUUID()` as the id and `rand(32)` — 32 random bytes, hex — as the
key, and that key living in the browser **is** the login. No email exists in the
system at all.

- `cleanName` collapses whitespace, trims, slices to 12 and requires
  `/^[A-Za-z0-9 _.\-]{1,12}$/`.
- `makeCode()` draws 6 characters from
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` — no `O`/`0`, no `I`/`1`/`L`.
- `CODE_TTL_MS = 10 * 60 * 1000`. Short is safe because the code is
  single-use and expires; the key is long because it is the whole credential.

`auth.mjs`'s `link` action deletes the code **on sight**, before it even checks
expiry (`netlify/functions/auth.mjs:68-72`): a code that survives being
presented can be presented again, and deleting only on the success path leaves
every failure path as a retry loop. The code blob stores only `{id, exp}` — the
key is read from the account when the code is spent, so a stolen code blob is
not a stolen credential.

Names are deliberately **not unique** (`auth.mjs:30-34`): uniqueness means
telling a stranger which names are taken, a rejection on the one screen that has
to be frictionless, and an index to keep consistent.

What this is not: proof of identity. The key is a bearer token with nothing
behind it, and nothing expires — signing out is a local erase, and a lost device
stays signed in until the account is abandoned. The trade is sized to a group of
friends and both `accounts.mjs` and `docs/engine/cloud.md` say it should be
revisited before this is handed to strangers.

## The merge is server-side

`netlify/lib/records.mjs`. The client never replaces the stored document; it
proposes one and the server folds it in, using the same rules the game applies
locally. Once records are monotonic the two devices commute, which is what makes
an offline device safe to sync days later — and it removes a class of tampering
for free, because a client that posts `best:0` cannot lower anything.

| Rule | Keys | Bounds |
|---|---|---|
| `max` | `best` | 0 … `SCORE_CEILING` = 5,000,000 |
| `max` | `gl` | 1 … `LEVEL_MAX` = 6 |
| `max` | `runs` | 0 … 1,000,000 |
| `max` | `struggle` | 0 … 1,000 |
| `sticky` | `groove`, `hopped`, `landed` | `'1'` once either side has it |
| `union` | `seen`, `seen2` | tokens matching `/^[a-z0-9_]{1,24}$/i`, capped at 64 |
| `oneOf` | `muted` (`'0'`/`'1'`), `swipe` (`radial`/`screen`) | |
| custom | `name` | trimmed, 12 chars, printable ASCII only |

`SYNCED_KEYS = Object.keys(RULES)` and `merge()` iterates only those: **a key
not in the table is not synced**, deliberately, because an unknown key is an
unbounded write into a document the server hands back to every device on the
account. Adding a synced key is a decision, not an accident.

Keys are the bare name; the game stores everything under `cometloop:<k>` and the
storage shim strips the prefix on the way out (`src/game/runtime.js:3915-3926`).
`cometloop:intro` is written by the game but is not in `RULES`, so it correctly
never syncs.

### Three defects in the client half of that table

1. **`landed` has no producer.** Nothing in the game ever writes
   `cometloop:landed`. It is read at `src/game/runtime.js:3716`, set by a cloud
   adopt at `:3898`, and uploaded at `:3950` — and `G.everLanded` is read
   nowhere else in the runtime's 12,335 lines. Contrast `everHopped`, which is written at
   `:6961` and gates real teaching at `:8216` and `:11528`. The synced key is a
   loop with no source and no consumer.
2. **`struggle` and `swipe` sync up but never come down.** Both are written
   through `savePref` (`:6437`, `:6789`/`:7359`/`:7456`), so they reach the
   server. But `cloudAdopt` (`:3885-3902`) handles only best, gl, runs, groove,
   hopped, landed, seen, seen2 and name, and `loadPrefs`'s `window.storage.get`
   reads only best, gl, runs and muted. A second device never learns either
   value.
3. **The `last` merge rule is dead code.** `records.mjs:65` defines it and
   `docs/engine/cloud.md`'s rule table lists "last write | muted, swipe, name" —
   but `RULES` uses `oneOf` for `muted` and `swipe` and a bespoke `name`
   function. The behaviour is last-write-ish either way; the named helper is
   never referenced.

## The board is soft on purpose

`netlify/functions/scores.mjs` does not pretend to be unforgeable: the whole
game is delivered to the browser and the repository is public. It rejects the
impossible and the automated:

- you must be signed in, so a forged entry costs an account
- one blob, `TOP = 100` rows kept, `PAGE = 25` returned by default
- one row per player: a resubmission that does not beat your own stored score
  returns `improved: false` rather than adding a row, so grinding is pointless
- `COOLDOWN_MS = 10_000` between submissions from one account (429)

`netlify/lib/plausible.mjs` is the only judgement made about a score, split out
of `scores.mjs` specifically so it can be tested without a network or the blobs
dependency: `score` a non-negative integer at most `SCORE_CEILING`, `level`
within 1…`LEVEL_MAX`, run at least `MIN_RUN_S = 5` seconds and at most six
hours, and `score <= FLOOR + RATE * secs` with `FLOOR = 5000` and
`RATE = 1200`.

The rate bound is deliberately loose — roughly five times what the game can
actually pay. The file works the arithmetic: a fed orbit is 86 plus a streak
bonus to 28, the fastest lap at the 4.2 rad/s ceiling is about 1.5 s (≈76/s from
orbits), embers pay a combo to ×6 doubled under overcharge, garnishes 8-16, and
sustained perfect play lands a couple of hundred a second. The bound exists to
reject `9e9`, never to adjudicate a good run: a ceiling tuned close to real play
would eventually call somebody's genuine best a forgery, which is a far worse
failure than letting an inflated one through.

Two things stay open and are written down rather than hidden:

- **One blob, last write wins.** Two people finishing in the same second can
  drop an entry. The fix is a row per player assembled on read, costing a list
  plus N gets per page load; accepted at this scale.
- **What would actually close forgery** is replaying the run server-side from a
  seed and an input log, and the game cannot do that: the runtime has no seeded
  generator of its own — determinism is injected from outside by
  `tools/lib/rng.mjs`, for the harnesses only. Making the game self-seeding is
  the prerequisite, and it would also buy replays and ghost runs.

GET rows carry `{rank, name, score, level, at}` and nothing else — no account
id, no email ever leaves the function. A signed-in caller additionally gets
their own standing, which is usually not in the top 25.

The name on a row resolves in order: what this run sent, then the account's own
name, then whatever the row already held, then the literal `'PLAYER'`
(`scores.mjs:91`). The comment records the bug that ordering fixes: it read
`user.email.split('@')[0]` until passwords were dropped and there stopped being
an email, after which every submission without an explicit name landed on the
board as `PLAYER`.

## The panel is the only DOM in a canvas game

Everything else in Cosmo is drawn. This screen asks for a name, and a canvas
cannot raise a phone keyboard, be filled by a password manager, or offer a
caret, selection or paste. So it is real markup — `#acct` in `index.html:40`,
styled from `src/styles.css`, reachable only from the title screen, never drawn
over a run.

Two consequences the code guards explicitly:

- **`CLOUD.open` is the keyboard guard** (`src/game/runtime.js:7419`). Without
  it, typing a name would reverse the comet on every space and mute the game on
  every `m`. In the Phaser host the keydown arrives through
  `this.input.keyboard.on('keydown', …)` (`src/scenes/CosmoScene.ts:52`) rather
  than the runtime's own `window` listener — which is only registered when
  `!runtimeHost.externalLoop` (`src/game/runtime.js:7495-7502`) — but it lands
  in the same `keyDown` and the guard is still the only thing stopping it.
- **It must survive a stubbed DOM.** Seven of the harnesses run the runtime
  against a fake document whose `getElementById` returns something that is not
  an element. `acOn()` and `AC_DOM` (`src/game/runtime.js:4040-4043`) exist for
  that, and the comment records that it was found the honest way — by failing
  `musiccheck` on the first run after the panel was written.
- **`esc()`** (`:4049-4052`) is the only thing between a stranger's 12
  printable characters and script execution on every other player's device; `<`
  is a printable character, and the server's bound does not exclude it.

## No harness touches any of this

Nothing in `tools/` imports `netlify/lib/*`, exercises `merge()` or
`validate()`, or drives the account panel. The only references to accounts in
the harnesses are `smoke.mjs:1494` checking that the menu draws one `account`
hit rectangle, and `enginecheck.mjs:70-76` deliberately aborting every
non-origin request so no account or telemetry write can leave the check.
`plausible.mjs` was split out expressly so it could be checked on a laptop, and
then nothing was ever written to check it.
