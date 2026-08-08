# CLAUDE.md

Operating context for Claude Code sessions in this repository. Read this before
reviewing, changing, or reporting on anything here.

---

## Status: proprietary, commercial

**Cosmo is not open source and not a hobby project.** It is a commercial product
owned by its copyright holder, published to a public repository for playtesting
only. Every session should work from that assumption.

What follows from it:

- `LICENSE` is an all-rights-reserved proprietary grant. Never replace it with,
  or add, an open-source licence (MIT/Apache/GPL/etc.) — not as a default, not
  as a "standard practice" suggestion.
- Never add `CONTRIBUTING.md`, contributor guides, "PRs welcome" language, good
  first issues, or anything else that invites outside reuse or contribution.
- The copyright notice at the top of `index.html` and its `copyright` meta tag
  are load-bearing: `index.html` is the *distributed artifact*. Every visitor's
  browser downloads the entire game, so the terms have to travel with the only
  copy anyone ever gets. Do not remove or relocate them.
- **Third-party anything requires provenance.** No copying code, audio,
  fonts, algorithms, or art in without recording where it came from and under
  what terms. A single unattributed snippet is a defect in a product that will
  be sold, however small it looks. Ask rather than assume.
- Treat the repository's public visibility as a decision under review, not a
  licence. Do not add anything that assumes a public audience.

## What this is

A one-thumb arcade rhythm game in a **single self-contained HTML file**. No
build step, no dependencies, no external assets. `index.html` is the entire
product — engine, simulation, WebAudio arrangement system, procedural art, and
UI — around 6,500 lines in one inline `<script>`.

Deployed to GitHub Pages from `main`. The published page is the product.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole game. The distributed artifact. |
| `README.md` | Design record — why the game is the way it is. |
| `MECHANICS.md` | The mechanics ledger: one row per player-facing mechanic, where it is introduced, every channel that explains it. |
| `LICENSE` | All-rights-reserved proprietary grant. |
| `tools/*.mjs` | The five CI harnesses. No dependencies; Node's `vm` + a stubbed DOM. |
| `.github/workflows/pages.yml` | Runs all five checks on every PR; only `main` deploys. |
| `*.png`, `manifest.webmanifest` | Icons, share image, PWA manifest. |

## The checks

All five run on every pull request and must pass. Run them locally before
pushing — they are fast and need nothing installed.

```sh
node tools/check.mjs       # parses; required elements; teaching-data drift
node tools/smoke.mjs       # loads and plays the game in a stubbed DOM
node tools/dropcheck.mjs   # the build meter still delivers beat drops
node tools/curriculum.mjs  # nothing is left untaught by level 3
node tools/musiccheck.mjs  # four levels, four songs, each in its own key
```

`smoke.mjs` is the one that catches real bugs: it loads the game into a stubbed
DOM and actually plays it — menu demo, taps, swipes, keyboard, minutes of
simulated play, resize, tab visibility, death, retry, level 2. Audio stays off,
which exercises every audio guard.

`musiccheck.mjs` is the only harness that runs the arrangement. `smoke.mjs`
removes WebAudio deliberately and `dropcheck.mjs` never drives past level 2, so
before it existed the per-level songs had no coverage: deleting level 4's riff
and solo rows left all four other checks green and crashed the browser. It
stubs WebAudio instead of removing it and asserts on what was actually
scheduled. **Anything that touches `PROG`, the hooks, the per-level basslines
or kits, or any pitch in the audio path belongs in this harness** — a musical
regression is otherwise invisible to CI by construction.

**The harnesses are not deterministic.** The game uses unseeded `Math.random`,
so run-length-dependent output (the `struggle` counter, death timings) varies
between runs. Before attributing a changed value to your diff, re-run the
harness on the unmodified file — several times.

## Invariants that are load-bearing

Breaking one of these is a product regression, not a style question.

- **The curriculum rule.** Every mechanic is introduced *and explained* by the
  end of level 2. Level 3 introduces nothing — it is the exam. Enforced by
  `curriculum.mjs` and by a static guard in `check.mjs`. If you move a tier,
  both must still pass.
- **Two ladders, two names.** `G.tier` is the ten-rung *unlock* ladder (what has
  been introduced); `G.level` is the 1–3 structure the player is told about.
  Everything player-facing — the HUD, the death headline, the pips, the share
  text, `FURTHEST YET` — uses `G.level`. Never call the tier ladder a level, in
  UI or in telemetry.
- **Telemetry: one name per ordinal.** `game_level` is the 1–3 level on every
  event; `tier` is the only name for the unlock ladder. Retire ambiguous
  property names rather than redefining them — a redefined property silently
  corrupts historical rows.
- **Audio is optional everywhere.** The game must be completable with no
  WebAudio at all. Every audio path is guarded; keep it that way.
- **Every chord is diatonic to its level's natural minor, and every pitch is
  written as an interval over the level's tonic.** These are one rule seen from
  two sides. The SFX pentatonic is scaled into each level's key and every sound
  in the game speaks through it, so a chord borrowed from outside the mode —
  a major dominant being the obvious temptation — puts the entire effects layer
  a semitone out against the band. And an absolute pitch is a chord from
  outside the mode on three levels out of four: the beat drop, the snare body
  and the tom fill were each hardcoded to A-minor pitches and each rang wrong
  everywhere else, unnoticed for as long as the levels differed only by
  transposition. Never write a bare frequency into the audio path. `PROG` and
  `musiccheck.mjs` are where both halves are enforced.
- **No aimed input.** There is no target to hit anywhere in this game. Landing
  the beat drop is *any* move in the window, wherever the thumb is.
- **A lesson may only reference actions and objects the game actually has.**
  Cosmo has two verbs (turn around, change ring), rings, red, stars, shields
  and the beat. It has no aimed movement: no positioning, no threading a gap,
  no outrunning, no stopping. Two twin wordings shipped that each invoked a
  manoeuvre from some other game, and both read to players as nonsense — not
  because they were inaccurate, but because they answered a question the player
  had no way to be asking. Checking a sentence against the *code* does not
  catch this; the code will happily support a true statement about something
  the player can never do. Ask instead: is this sentence about something the
  player could attempt? When in doubt, claim only what is countable and name a
  verb the game has.
- **`MECHANICS.md` and the code move together.** Change a mechanic, update the
  ledger row and the level card text in the same commit.

## Workflow

- Develop on the branch assigned for the session; never push to a different
  branch without explicit permission. Never commit directly to `main`.
- Open pull requests as drafts. All four checks must be green.
- Commit messages in this repo are substantive: what changed, and *why* it was
  wrong before. Match that register.
- Update `README.md` when behaviour changes, `MECHANICS.md` when a mechanic
  changes, and this file when a constraint changes.

## Reviewing this repository

A review here has two halves. Earlier reviews did only the first, and missed a
public repository sitting with no licence for its whole life as a result.

**1. Correctness and clarity** — bugs, dead code, drift between the code and
`README.md` / `MECHANICS.md`, invariants above.

**2. Repository and product hygiene** — do this half explicitly, every time:

- Licence present, correct, and carried into `index.html`.
- Secrets and keys: what is embedded in the distributed file, and is it
  genuinely safe there. The PostHog project token is deliberately embedded and
  documented as write-only — re-confirm rather than assume.
- Telemetry and privacy: what is collected, whether it stays anonymous, and what
  obligations attach once there are paying users.
- Repository settings: branch protection on `main`, fork policy, visibility.
- Public/private posture: what belongs in a public playtest build versus the
  private source. Note that the published page hands every visitor the complete
  readable source — repository visibility does not change that.
- Third-party provenance for any code, audio, or art.
- Name and trade-dress exposure.

Report hygiene findings even when the session was asked only about code. If a
finding is out of scope to fix, say it exists and let the owner decide.
