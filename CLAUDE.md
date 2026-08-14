# CLAUDE.md

Operating context for Claude Code sessions in this repository. Read this before
reviewing, changing, or reporting on anything here.

**This file is the router, not the whole map.** It holds what is true for every
session: what this product is, what you may not do to it, and how you ship. The
long-form material lives in `docs/` and is indexed below by *what you would have
to be touching to need it*. Read the entries your change lands in, in full — they
are short compared to the bugs that wrote them, and every one of them was written
because something shipped broken.

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
- **The deploy publishes an allowlist, not the repository.** `index.html`, the
  icons, the manifest, `og.png` and `LICENSE` are the site; `CLAUDE.md`,
  `README.md`, `MECHANICS.md`, `docs/` and `tools/` are not. This was `path: .`
  until it was fixed, which made every internal document a public URL — and
  repository visibility would not have covered it, because Pages serves the
  artifact rather than the repo. `check.mjs` now fails on any root file that is
  in neither list.

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
| `docs/invariants.md` | The rules that are load-bearing, grouped by what you'd be touching. Indexed below. |
| `docs/harnesses.md` | What each check covers, and where a new test belongs. |
| `docs/review.md` | The two halves of a review here, including the hygiene half people skip. |
| `tools/all.mjs` | Runs every check in CI's order, or `--fast` for the quick four. Holds no list — it reads the workflow. |
| `tools/*.mjs` | The CI harnesses. No dependencies; Node's `vm` + a stubbed DOM. |
| `tools/lib/rng.mjs` | The seeded `Math.random` every harness runs on. Determinism lives here, not in the game. |
| `AGENTS.md` | Pointer here, for agent tools that look for that name instead. |
| `.github/workflows/pages.yml` | Runs every check on every PR; only `main` deploys, and only an allowlist. |
| `*.png`, `manifest.webmanifest` | Icons, share image, PWA manifest. |

## Before you push

```sh
node tools/all.mjs --fast   # ~4s, while you are editing
node tools/all.mjs          # ~50s, before you push
```

Every check, in CI's order, stopping at the first failure. Needs nothing
installed. `--fast` skips the three harnesses that play whole games and keeps
the four that are static or targeted; each harness declares its own lane and
`check.mjs` fails if one declares none. See `docs/harnesses.md` for what each
harness covers and — this matters when you add a test — which one a given kind
of regression belongs in. **Anything touching a shader, a uniform or the glow
goes in `fxcheck.mjs`; anything touching a pitch, a kit or the progression goes
in `musiccheck.mjs`; anything touching a 2D draw call goes in `drawcheck.mjs`.**
Those three exist because those three areas were invisible to CI by
construction.

**The harnesses are deterministic, and the seed is how.** Each one drives the
game through a seeded `Math.random` injected at the sandbox boundary
(`tools/lib/rng.mjs`) — `index.html` is untouched by this. A local run replays
the same game every time, so a changed number IS your diff and the old ritual
of re-running several times before believing anything is retired. CI rotates
the seed per run so coverage keeps moving, and every harness prints its seed:
reproduce any CI failure with `SEED=<n> node tools/<harness>.mjs`.

## What to read before you change something

Find the row your change lands in and read that group in `docs/invariants.md`
before you start. If your change spans two rows, read both. If nothing here
matches, you are probably doing repository or documentation work and
`docs/review.md` is the relevant file.

| If you are touching… | Read this group | Because |
|---|---|---|
| a formation, an orb, a level boundary, a lesson, or any sentence shown to a player | **Curriculum, teaching and the ledger** | The curriculum rule splits by KIND — formations complete by level 3, orbs and modes may run to level 4 — and three harnesses enforce the half you are most likely to breach. A lesson may only name verbs the game actually has. |
| `MODES`, the level select, a stored record, or anything reachable from POWERUP TESTING | **Modes, records and the powerup lab** | One mode ships and the table stays anyway; the unsuffixed storage keys are SKILL's; a lab session must be unable to *create* a key, and every guard behind that is one `!LAB.on` on an ordinary-looking line. |
| pause, `G.t` / `G.vt`, ring indices, difficulty numbers, or a telemetry property | **Simulation, state and telemetry** | Ring index 0 is the OUTERMOST orbit and has shipped inverted three times. Pause is a flag one line above `G.t+=dt`. Difficulty is measured per ring, never per board. |
| `PROG`, `PROGB`, a voice, a kit, the pad, or any pitch | **Audio and the arrangement** | Every pitch is an interval over the level's tonic — a bare frequency is wrong on three levels out of four. Silencing the scheduler does not silence the band. A moment that must be immediate cannot be a section. |
| a draw pass, a shader, a uniform, the glow chain, the render-scale dial | **Graphics, shaders and the sky** | A screen-space warp's sign is the opposite of what it reads like; a halo's bound must be in pixels, not fractions; the sky can never go black and the set of skies is closed. Nothing here is caught by reading — measure it, and `drawcheck.mjs` is where a 2D draw belongs. |
| the deploy, the build stamp, the freshness check | **Delivery** | The plain play URL is a contract: it must serve the newest build. |

Two rules sit above all of them and are not negotiable:

- **A visual or audio feature is not shipped until something proves it reaches a
  pixel or a speaker.** Port the maths and evaluate it, or instrument the voice
  and total the energy, and put the number in the commit message. "It is in the
  source" is not evidence that it is in the game. Thirteen black hole features
  shipped with one of them perceivable, each individually correct at its own
  site and disabled by something elsewhere.
- **`MECHANICS.md` and the code move together.** Change a mechanic, update the
  ledger row and the level card text in the same commit. `check.mjs` enforces
  it: a formation or orb that ships without a ledger row fails the build.

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

- **Merge your own work, and do not sit and watch CI do it.** Open pull
  requests ready for review, not as drafts, then **squash-merge with
  auto-merge** — the repository has `allow_auto_merge` on, so you can arm the
  merge the moment the pull request exists and end your turn. GitHub merges it
  when the checks go green and deletes the branch itself. Squash matches the
  history, where each commit on `main` carries its `(#N)`. Do not ask first.
  Do not wait for review that was never coming.
  **Polling is the expensive habit this replaces.** Watching a run to
  completion costs a minute of billed waiting per pull request and buys
  nothing: the merge condition is "checks green", which GitHub already
  evaluates. Arm it and go. Only fall back to merging by hand when auto-merge
  cannot be armed — and then say so, rather than quietly starting a poll loop.
- **Never merge red, and never merge unverified.** The checks are the gate,
  and `main` publishes to the live page on merge, so a red merge is a broken
  product for real players. If a check fails, fix it or say plainly why you are
  not going to.
- **Never commit directly to `main`.** This is not an approval gate; it is how
  CI gets to run before the deploy does. The pull request is the mechanism, not
  the permission. `main` is deliberately left unprotected — the owner's call —
  so this rule is honoured rather than enforced. What *is* enforced is the
  deploy: it `needs: check`, so a red push to `main` fails CI and never
  publishes. The live page is safe; `main`'s history is on you.
- **The branch deletes itself now — do not add a step for it.** The repository
  has `delete_branch_on_merge` on, so a merged pull request takes its branch
  with it. This used to be a manual `git push origin --delete <branch>` after
  every merge, and the rule was obeyed about as well as any rule that depends
  on remembering: twenty-nine branches accumulated before anyone counted them,
  because a squash-merge leaves the branch looking permanently unmerged and
  nothing complained. The setting is the fix, and it is the better kind — the
  work is not done more carefully, it is not done at all. If you find yourself
  writing a cleanup step, check the setting before writing the step.
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
  changes, `docs/invariants.md` when a constraint changes, and this file when
  the routing changes. Unprompted, in the same commit. Documentation is part of
  the change, not a follow-up.
