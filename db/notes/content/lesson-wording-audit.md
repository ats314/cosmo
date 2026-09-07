# Every lesson tested against the binding rule

*What this answers: which of Cosmo's player-facing instruction strings name an
action the player can actually perform and a result they can observe — and
which do not.*

The rule (CLAUDE.md, "Player-facing contracts"): *every instruction must name a
real action and its observable result*, and one instruction card shows at a
time. `docs/design/teaching.md` generalises it: *a lesson may only reference
actions and objects the game actually has.* The game has exactly two verbs —
tap (reverse) and swipe (change ring). There is no aimed movement, no stopping,
no speed control.

All strings below were read in `src/game/runtime.js` this session. Verdicts are
mine, not the repo's; no harness tests wording against this rule.

## Passes — action named, result observable

`single`, `twin`, `gate`, `drift`, `driftgate`, `saucer`, `dive`, `funnel`,
`slip`, `trail`, `blackhole`, `orbit`, `lapcost`, `music`, `beat`, `combo` — all
of the `MEET` table's instruction-shaped rows. Each names `tap` or `swipe` or
`collect`, and each result (a shield spent, a ring cleared, points) is on the
HUD or on the board within the same encounter.

Hint-ladder rungs 1, 5, 6, 8, 9 pass. Level cards 2–6 pass. The death coach's
two authored lines pass. The intro's four steps pass (each is an instruction the
player then performs to advance).

## The two that fail the action half

* **`blink`** — `Pass while dim; bright red costs a shield` (`:5472`).
* **`blinktwin`** — `One flashes red; pass the dim one` (`:5482`).

"Pass" is not an input. The comet travels on its own; passing is what happens if
you do nothing. This is structurally the same defect the repo has already
diagnosed and fixed twice: *"keep moving"* was removed from both drifter
channels because "there is no input in this game that stops you", and *"get out
of its way"* was removed from `single` because it describes a manoeuvre rather
than an input. Both blink lessons state a **timing condition** with no verb
attached; the player who reads them has to infer that the answer is "arrive
later", which is `tap`, or "arrive elsewhere", which is `swipe`. Neither word
appears. Because `smoke.mjs` pins each tier `sub` to its lesson, the BLINKERS and
FLICKER PAIRS banners carry the same two sentences.

Note the asymmetry that makes this visible: `drift` says *"This red obstacle
moves; **tap** to turn away"* and `blink` — the tier immediately after it —
says *"Pass while dim"*. One names the input, its neighbour does not.

## The class that names a result and no action, by design

`spot`, `hyper`, `mirror`, `scorch` (`:5497`, `:5509`, `:5514`, `:5520`) plus
the shield/slow-mo/nova hint rungs and every orb say-line. These are gifts: the
player has already taken the orb, and the sentence exists to name the object and
its visible effect. `scorch` is the interesting one — `MECHANICS.md` records
that the sentence *had* to say "keep moving" because scorch's value is
proportional to distance travelled, and the shipped string
(`Scorch: your path clears red obstacles for 8s`) has dropped that clause. It
now names an effect with no behavioural hook, which is exactly the property the
ledger says the lesson must not lose.

## The number that is stale after an upgrade

Six reward lessons hard-code a base duration (`10 seconds`, `about 9s`, `8s`,
`12s`, `16s`). Taking LONG MAGNET, LONGER STAR, LONG MIRROR, DEEP BURN, LONG
SLIPSTREAM or LONG STAR TRAIL changes the real duration and not the sentence.
The `MEET` bit is spent on first encounter, so in practice a player sees the
base number once and the upgraded orb thereafter — the lesson is not re-shown
lying, but the lab row and the say line keep the base number forever.

## The one-card rule

Enforced structurally: `runMessage()` (`:11513-11541`) is a chain of returns and
`drawRunHUD` calls `drawMessageCard(runMessage())` exactly once (`:11641`).
There is no path by which two instruction cards coexist in the arena. The death
screen is a different state and draws its coach line there (`:12134-12143`).

The one gap is that a **say line loses rather than defers**: `annPump`
(`:4377-4390`) drops entries whose TTL expired while a banner or lesson held the
slot, so e.g. `Shields full: stars now score double` can be earned and never
printed. Everything else in the stack defers.
