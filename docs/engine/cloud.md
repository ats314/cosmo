# The cloud

*Accounts without passwords, records that follow them, and the board.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

The game is still one self-contained file that plays with no network at all.
Everything below is an addition beside that file, never a dependency of it.

## Optional, in the same sense the sound is optional

The menu has always said *best with sound on — never required*, and the design
record spends a section on what that costs to honour: muted play keeps every
mechanic whole, the beat rides the pulsing ring, the finale reads entirely by
eye. This holds itself to the identical rule, and the rule is the reason the
feature is shaped the way it is.

Signed out, offline, blocked by an extension, or served from a host with no
functions behind it — the game is exactly the game. `localStorage` is still the
real store. Every record still works. **Nothing here is ever on the path between
a tap and a comet moving**, and a failed request is swallowed rather than
surfaced: a player who has just died is owed the death screen, not a network
error.

## It plugged into a seam that was already there

`loadPrefs()` has always read an optional async `window.storage` beside
`localStorage` and folded the two together with `Math.max`, because the file was
first written against a host that supplied one. That seam is exactly a cloud
save. The client installs a `window.storage` backed by `/api/progress`, and the
records, the preferences and the taught-mechanics set sync on a path that
already existed and was already merge-safe. `savePref()` writes through it for
free.

Nothing in the game had to be restructured. The only new code inside the game
loop is one call in `die()` offering the run to the board.

## The merge is server-side, and that is the whole point

Two devices on one account means two writers. The naive design — the client
sends its document, the server stores it — makes the last device to close its
tab the winner, so a phone that has not synced since Tuesday overwrites
Thursday's best score, and the player watches a record they actually set
disappear.

`netlify/lib/records.mjs` folds instead. Each key has a rule, and the rules are
the ones the game already applies locally:

| Rule | Keys | Why |
|---|---|---|
| max | `best`, `gl`, `runs`, `struggle` | a record means "the best this human has ever done", which is monotonic by definition |
| sticky | `groove`, `hopped`, `landed` | "this human has once done X" can never become false — forgetting it replays a once-ever tutorial at somebody already taught |
| union | `seen`, `seen2` | the same argument over a set |
| last write | `muted`, `swipe`, `name` | a preference is a statement about *now*; applying max to a mute builds a mute that cannot be undone |

Once the records are monotonic, order stops mattering and the two devices
commute — which is what makes an offline device safe to sync days later. It also
removes a class of tampering for free: a client that posts `best:0` cannot lower
anything, and the clamp is what stops "up" meaning `9e9`.

**A key not in that table is not synced.** An unknown key would be an unbounded
write into a document the server hands back to every device on the account, and
"store whatever the client sends" is how a save file becomes an injection
vector. Adding a synced key is a decision.

## No passwords, and what that buys and costs

The owner's call: *"we don't even need passwords."* So there are none. You type
a name, the server mints an account and returns a 32-byte random key, and that
key living in the browser **is** the login. No email, no password, no reset
flow, no confirmation round trip — nothing between a friend and their first run.

A six-character transfer code, single-use and good for ten minutes, moves the
account to a second device. That code is what makes this a *personal* login
rather than a per-device nickname: the same person on their phone and their
laptop is one row on the board and one player in the telemetry.

What it is **not** is proof of who anyone is. The key is a bearer token, so
whoever holds it is the account, and there is nothing behind it. That trade is
deliberate and sized to the situation — the thing being protected is a score on
a board among people who know each other. It should be revisited before this is
handed to strangers.

## The board is soft on purpose

The whole game is delivered to the browser and this repository is public, so
anyone who wants to POST a number can read exactly how. `scores.mjs` does not
pretend otherwise. It rejects the impossible and the automated: you must be
signed in, the score must be an integer inside a rate bound, the run must have
lasted long enough to have earned it, and one row per player means grinding is
pointless.

The rate bound is **deliberately loose** — 1200 points a second against a game
that pays a couple of hundred at its best. It exists to reject `9e9`, never to
adjudicate a good run, because a ceiling tuned close to real play would
eventually call somebody's genuine best a forgery, and that is a far worse
failure than letting an inflated one through.

**What would actually close it** is replaying the run server-side from a seed
and an input log — and the game cannot do that today. `index.html` calls
`Math.random` 73 times with no generator of its own; determinism is injected
from *outside* by `tools/lib/rng.mjs`, for the harnesses only. Making the game
self-seeding is the prerequisite, and it is a change to the game rather than to
the service. It would also buy replays and ghost runs, which is the reason it is
written down here rather than forgotten.

## The join with PostHog

Netlify holds the records and the board, keyed by account id. PostHog holds the
play funnel, keyed by an anonymous per-device id. Signing in stamps
`account_id` onto every event, which is what lets one be read against the other
for the same person.

It stays an opaque uuid and it arrives with nothing else attached: no name, no
new device id, and `$process_person_profile` is still false, so a signed-in
player's events are still anonymous events that happen to carry a stable key. A
device that never signs in is unchanged. See [`telemetry.md`](telemetry.md).

## The panel is the only DOM in a canvas game

Everything else here is drawn, down to the type, because the look is the
product. But this screen asks for a name, and a canvas cannot raise a phone
keyboard, cannot be filled by a password manager, and has no caret, selection or
paste. Hand-rolling those badly would make the one screen with a keyboard the
worst screen in the game. So it is real markup, styled in the game's palette,
reachable only from the title screen, and it never draws over a run.

Two consequences worth knowing:

- **Every listener in this game is on the canvas except `keydown`,** which is on
  `window`. Without a guard, typing a name reverses the comet on every space and
  mutes the game on every `m`. `CLOUD.open` is that guard.
- **Seven of the eight harnesses run this file against a stubbed DOM,** whose
  `getElementById` returns something that is not an element. This is the only
  part of the game that reaches for real nodes, so it is the only part that has
  to survive not finding any. It found that out the honest way, by failing
  `musiccheck` on the first run after it was written.

## Two hosts, one allowlist

GitHub Pages still serves the play URL and its freshness contract is unchanged.
Netlify serves the same artifact with the functions behind it.

`netlify/build.mjs` stages the site by **reading the `cp … _site/` line out of
`.github/workflows/pages.yml`** rather than restating it. A second copy of that
list is a second thing to forget, and the failure is silent on whichever host
got missed: an internal document becomes a public URL on one host and not the
other. One list, two deploys — the same argument `all.mjs` makes for parsing the
workflow instead of holding its own list of harnesses.

It lives in `netlify/` and not in `tools/` because `tools/` means something:
every file there is a CI harness, and `check.mjs` enforces it — a lane
declaration, a workflow step, a row in `harnesses.md`. This asserts nothing, so
filing it there would either break that guard or hollow it out.

## What is left open

- **The board is one blob, last write wins.** Two people finishing in the same
  second can drop an entry. The fix is a row per player assembled on read, which
  costs a list plus N gets on every page load. Accepted rather than hidden;
  revisit if the board ever gets busy.
- **Signing out is a local erase.** Nothing expires, so a lost device stays
  signed in until the account is abandoned.
- **Names are not unique**, deliberately: uniqueness means telling a stranger
  which names are taken, a rejection on the one screen that has to be
  frictionless, and an index to keep consistent.
