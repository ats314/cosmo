# What the delivery layer is worth after the engine change

*What this answers: for a Godot 4 / GDScript rebuild, which parts of Cosmo's
build, hosting, account service, telemetry and native packaging must be carried
across, which must be re-solved in a new idiom, and which should be thrown away
without ceremony.*

The `portability` field on every record in `delivery-platform.jsonl` follows the
judgements below. This note is the reasoning behind them, because the split is
not the obvious one: almost all the *code* here is disposable and almost all the
*decisions* are not.

## Thrown away with the stack (`obsolete`)

Vite, the two CI workflows as written, `netlify/build.mjs`, `tools/all.mjs`,
every guard inside `tools/check.mjs`, the whole Capacitor project tree, and
`src/platform/native.ts`. Godot exports rather than bundles; it has its own
Android and iOS export pipelines, its own signing story, and no `dist/`.

Two things are worth reading once before deleting them:

- **The harness loop's shape.** One list of checks, living in the CI workflow,
  parsed by the local runner rather than copied — plus the converse guard that
  every check in the directory is wired into CI. The mechanism is Node-specific;
  the failure it prevents ("all checks passed locally" and the PR goes red, or a
  harness that reads as coverage and has never run) is engine-neutral and will
  reappear on day one of a Godot test suite.
- **The publish allowlist's shape.** A deny-then-allow pair over the tree that
  becomes public URLs, with a completeness half that fails when an asset went
  missing. Godot's export presets have an include/exclude filter that is the
  same idea with different syntax; what carries across is that the filter is
  *checked*, in both directions, rather than trusted.

## Re-solved in Godot idiom (`reference`)

- **The build stamp.** `vite.config.ts` injects `__COSMO_BUILD__` and the
  runtime republishes it as `window.COSMO_BUILD`, a title-screen line and a
  `snapshot()` field. The Godot equivalent is a generated `build_id.gd` or a
  project setting written at export time. What must survive is the *contract*:
  the running game can name the commit it was built from, cheaply, from three
  places — a global, a visible line that is never drawn during play, and a
  machine-readable snapshot. The incident it exists for (an undatable
  screenshot) is not a web problem.
- **Cache and freshness.** `netlify.toml`'s revalidate-the-entry-page,
  immutable-hashed-assets pair is a web answer to a web problem. A Godot web
  export has the same problem and the same answer; a native export does not have
  it at all. Do not port `freshCheck()` — it is already inert here, and see
  `build-stamp-and-freshness.md` for why it could not match a module bundle.
- **The native bridge.** `installNativeBridge` folds document visibility
  together with Capacitor lifecycle events and deduplicates transitions. Godot
  gives you `NOTIFICATION_APPLICATION_PAUSED` / `_RESUMED` /
  `NOTIFICATION_WM_GO_BACK_REQUEST` directly, so the plumbing disappears. Three
  behaviours must not: the deduplication (`active === wasActive` returns early),
  the rule that `resume()` restores the UI and never silently resumes an
  interrupted run, and Back returning a boolean so the root screen minimizes
  rather than swallowing the gesture.
- **The haptics envelope.** The kinds and their rate limit are tuning (below);
  the Capacitor `Haptics.impact` / `Haptics.notification` mapping is not.

## Carried across unchanged (`spec` — reproduce the behaviour)

These are the delivery-layer decisions that are about the *product*, not the
platform, and every one of them was arrived at by having the alternative go
wrong first.

**The account service is engine-independent.** `netlify/functions/` and
`netlify/lib/` are Node running on a server; a Godot client calls the same three
endpoints over HTTP with the same bearer header. Nothing in this half has to
change at all, and the rebuild should resist the urge to rewrite it:

- server-side monotonic merge, so two devices commute and a stale phone cannot
  erase a record — and a client that posts `best:0` cannot lower anything;
- the synced-key allowlist, because an unknown key is an unbounded write into a
  document the server hands to every device on the account;
- no passwords, no email, a 32-byte bearer key, and a six-character single-use
  transfer code with a ten-minute TTL;
- an exact CORS list rather than `*`, because these endpoints carry a bearer
  key — the *entries* change (a Godot export has different origins; a native
  export may have none), the exactness does not;
- the board publishes rank, name, score, level and a timestamp and nothing
  else, and the plausibility bound is deliberately loose so it rejects `9e9`
  without ever calling a real best run a forgery.

**The telemetry contract.** No SDK, no third-party script, `sendBeacon` first;
one random per-device id and nothing else; a signed-in device adds an opaque
account id with `$process_person_profile:false`; the lab is silenced at the
single choke point rather than tagged; local and development copies send
nothing; and one property name means one thing forever — retire, never reuse.
Every one of those is a rule about data, not about JavaScript. The event
inventory in `telemetry-inventory.md` is the acceptance list: a Godot rebuild
that emits the same seventeen names with the same properties keeps every
historical dashboard readable across the port, which is worth more than any
code it could reuse.

**Accounts and sound hold the same promise.** Signed out, offline, blocked or
served with no functions behind it, the game is exactly the game. Local storage
is the real store; the cloud is a copy that follows an account. Nothing in that
path is ever between a tap and a comet moving.

**The licence discipline.** Cosmo is proprietary; third-party components keep
their own notices in a file that travels with the game. The *list* changes
completely — Godot and its export templates replace Phaser and Capacitor — but
the obligation and the shipped file do not.

## Numbers to carry (`tuning`)

There are fewer here than in the audio or difficulty records, and they are all
in the server half, where they will not change at all:

| Value | Where | Why it is what it is |
|---|---|---|
| `RATE = 1200` /s, `FLOOR = 5000` | `netlify/lib/plausible.mjs` | roughly five times what the game can actually pay; chosen loose on purpose |
| `MIN_RUN_S = 5`, max 6 hours | same | a run too short to have earned it, and a clock that ran away |
| `SCORE_CEILING = 5_000_000`, `LEVEL_MAX = 6` | `netlify/lib/records.mjs` | the clamps that stop "up" meaning 9e9 |
| `COOLDOWN_MS = 10_000`, `TOP = 100`, `PAGE = 25` | `plausible.mjs`, `scores.mjs` | one row per player makes grinding pointless; the cooldown makes it slow |
| `CODE_TTL_MS = 10 min`, key = 32 bytes, code = 6 chars | `netlify/lib/accounts.mjs` | short is safe only because single-use and expiring |
| haptics: 65 ms gate; 55/35/24/12/7 ms web pulses | `src/platform/native.ts` | already recorded under `code.boundary.haptics` |
| push debounce 1200 ms | `src/game/runtime.js` (`cloudPush`) | a run's end writes several keys in one breath |

## The one thing to fix on the way, not after

`$pageview` has never been delivered from a deployed build — a temporal-dead-zone
throw swallowed by telemetry's own silence (`opp.delivery.pageview-tdz`). A
rebuild that re-emits the event inventory faithfully will *also* faithfully
reproduce the ordering that breaks it unless somebody knows. The denominator of
every funnel is worth one line of attention.
