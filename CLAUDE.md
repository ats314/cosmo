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

- **The curriculum rule, as the owner revised it.** The rule used to end
  teaching at level 4's floor. The owner's call, verbatim: *"We are going to
  change to balance power up introduction, mechanics, and difficulty all the
  way the level 4."* So the boundary now differs by KIND, and the split is
  deliberate rather than a loophole:
  - **Formations** — the shard shapes on the tier ladder — still complete by
    dl 340. They compound with each other, they are what the death coach
    explains, and meeting a new one at the speed ceiling is the density
    problem the ladder was rebuilt to avoid. `curriculum.mjs` still fails if a
    tier banner fires inside level 4, and that guard stays.
  - **Orbs and modes** may now be introduced through level 4, taught by
    `firstMeet` at first contact wherever that falls. THE BLACK HOLE is the
    first of these: it is rare on purpose, so guaranteeing it inside level 3
    to satisfy a boundary would have destroyed the thing that makes it work.
  This is the owner's decision and not an inference from the code. The wider
  rebalance that sentence describes — difficulty and power-up pacing across
  all four levels — has NOT been done; only the black hole moves under it so
  far. Do not read the new latitude as permission to scatter formations into
  level 4.
- **The formation half of the rule.** Every formation is introduced *and
  explained* by the end of level 3 — dl 340, which is `LV[2].end` and level 4's
  floor. Enforced by `curriculum.mjs` (which
  fails if any tier banner fires inside level 4, and requires every type in its
  `TAUGHT` list to have been lessoned by then) and by a static guard in
  `check.mjs` (`max(TIERS[].at) <= ends[2]`). `smoke.mjs` additionally pins the
  LAST tier to exactly `LV[2].end`, so a new tier can be inserted anywhere below
  THE EYE but never appended after it. If you move a tier, all three must pass.
  This entry said "the end of level 2 · level 3 introduces nothing" until a
  session went looking for room to add a shape and found the code, the ladder
  table and all three harnesses saying level 3 while this file, `README.md` and
  one comment in `check.mjs` said level 2. Level 4 moved the exam when it was
  added; the rule was never updated to follow it. A constraint that disagrees
  with its own enforcement costs more than a missing one — it makes the careful
  reader wrong.
- **Adding a tier is wider than it looks.** `curriculum.mjs` used to hardcode
  the last tier's index (`G.tier !== 9`), so inserting a row anywhere failed the
  build with a message about the wrong thing; it now derives it from
  `TIERS.length`. Twelve places in `index.html` still hardcode tier ordinals for
  the sky band, the NEW SOUND ladder and the star instrument — inserting below
  the highest of them shifts every one.
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

**You are the agent. You ship. The owner gives guidance, not process steps.**

That means the whole mechanical chain is yours and none of it is worth asking
about: branch, commit, push, open the pull request, watch the checks, merge it,
and update the docs in the same breath. A green pull request sitting open is not
a finished task — it is a task stopped one step early.

This paragraph exists because of a specific failure. This file used to say
"open pull requests as drafts", and a session read that as *stop here and wait
to be told*. It left two green pull requests open, reported them as the
deliverable, and the owner had to say "merge" three times, the last two in
capitals. The instruction was about how a pull request starts, not about who
finishes it, but it was the only sentence here about merging and so it became
the rule. It is replaced rather than clarified.

- **Merge your own work.** Open pull requests ready for review, not as drafts.
  Squash-merge as soon as all five checks are green — that matches the history,
  where each commit on `main` carries its `(#N)`. Do not ask first. Do not wait
  for review that was never coming.
- **Never merge red, and never merge unverified.** The five checks are the gate,
  and `main` publishes to the live page on merge, so a red merge is a broken
  product for real players. If a check fails, fix it or say plainly why you are
  not going to.
- **Never commit directly to `main`.** This is not an approval gate; it is how
  CI gets to run before the deploy does. The pull request is the mechanism, not
  the permission.
- **Develop on the branch assigned for the session.** Push somewhere else only
  with explicit permission — but splitting unrelated work onto its own branch is
  usually the right instinct, so ask for it rather than shipping a pull request
  that does two things.
- **Say what you could not verify.** The thing genuinely worth escalating is
  never the merge; it is judgement the agent does not have. You cannot hear the
  audio or see the screen. Ship the work and name what needs the owner's ears
  and eyes, rather than holding the work hostage to it.
- Commit messages in this repo are substantive: what changed, and *why* it was
  wrong before. Match that register.
- Update `README.md` when behaviour changes, `MECHANICS.md` when a mechanic
  changes, and this file when a constraint changes. Unprompted, in the same
  commit. Documentation is part of the change, not a follow-up.

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
