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
| `.github/workflows/pages.yml` | Runs every check on every push to `main` and on any PR; only `main` deploys, only if the checks pass, and only an allowlist. |
| `*.png`, `manifest.webmanifest` | Icons, share image, PWA manifest. |

## Before you push

```sh
node tools/all.mjs --fast   # ~5s, while you are editing
node tools/all.mjs          # ~110s, before you push
```

Every check, in CI's order, stopping at the first failure. Needs nothing
installed except the browser the eighth check drives, and it says so rather
than skipping quietly. `--fast` runs the four harnesses that are static or
targeted and skips the four that play a whole game or launch a browser; each
harness declares its own lane and `check.mjs` fails if one declares none. See
`docs/harnesses.md` for what each harness covers and — this matters when you
add a test — which one a given kind of regression belongs in. **Anything
touching a pitch, a kit or the progression goes in `musiccheck.mjs`; anything
touching a 2D draw call goes in `drawcheck.mjs`; anything touching a shader, a
uniform or the glow goes in `fxcheck.mjs` if you are asserting that a call was
issued, and in `rendercheck.mjs` if you are asserting how the frame LOOKS.**
Those four exist because those areas were invisible to CI by construction, and
the last two are not interchangeable: fxcheck runs against a recording fake and
cannot see a frame at all.

**The harnesses are deterministic, and the seed is how.** Each one drives the
game through a seeded `Math.random` injected at the sandbox boundary
(`tools/lib/rng.mjs`) — `index.html` is untouched by this. A local run replays
the same game every time, so a changed number IS your diff and the old ritual
of re-running several times before believing anything is retired. CI rotates
the seed per run so coverage keeps moving, and every harness that runs the game
prints its seed on the way in — before any assertion can exit — so reproducing a
CI failure is `SEED=<n> node tools/<harness>.mjs`. (`check.mjs` is the exception
and needs no seed: it is static and touches no RNG.)

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
| a draw pass, a shader, a uniform, the glow chain, the render scale | **Graphics, shaders and the sky** | A screen-space warp's sign is the opposite of what it reads like; a halo's bound must be in pixels, not fractions; the sky can never go black and the set of skies is closed. Nothing here is caught by reading — measure it, and `drawcheck.mjs` is where a 2D draw belongs. |
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
about: run the checks, commit, push, and update the docs in the same breath.
Work that is finished and unpushed is a task stopped one step early.

THIS SECTION HAS BEEN WRONG TWICE, IN OPPOSITE DIRECTIONS, AND BOTH COST A
SESSION. It first said "open pull requests as drafts", which one session read
as *stop and wait to be told*: it left two green pull requests open, reported
them as the deliverable, and the owner had to say "merge" three times, the last
two in capitals. That was corrected into an instruction to open a pull request
and arm auto-merge for every change — which was worse, because it was followed
exactly, and every pull request fired an automatic activity subscription that
relayed raw webhook envelopes into the owner's chat, woke the repository's
review bots, and left the agent polling GitHub. An afternoon of that produced:
*"fix the fucking github ... so every stupid fucking thing you keep doing stops
happening."*
The lesson under both is the same one: **a process step that nobody can point
at a reason for is a cost with no owner.** Before you add one here, say what
would go wrong without it, and check that the thing you are protecting against
is not already prevented somewhere else — as it was, in the workflow file, the
entire time.

- **PUSH STRAIGHT TO `main`. DO NOT OPEN A PULL REQUEST UNLESS ASKED.**
  This file used to require the opposite, and its stated reason was false.
  It said: *"Never commit directly to `main`. This is not an approval gate; it
  is how CI gets to run before the deploy does."* Check the workflow. It runs
  `on: push: branches: [main]`, and the deploy job carries `needs: check`. A
  direct push to `main` runs all eight harnesses and publishes **only** if they
  pass. The gate the rule existed to provide was already there without it.
  So the pull request was buying nothing and costing a great deal. Every one
  opened in a session fires an automatic PR-activity subscription, which relays
  raw webhook envelopes into the owner's chat; it triggers whatever review bots
  the repository has installed, each of which relays more; and it leaves the
  agent polling GitHub for a merge condition that a plain push does not have.
  The owner watched all of that happen for an afternoon and the instruction is
  verbatim: *"fix the fucking github ... so every stupid fucking thing you keep
  doing stops happening."*
  What is actually protected is the live page, and it stays protected: a red
  push fails `check`, `deploy` never runs, and the site keeps serving the last
  good build. What you risk is a broken commit sitting at the head of `main`
  until you fix it. **So run `node tools/all.mjs` before you push, every time.**
  That is the whole of the discipline this replaces.
  Open a pull request when the owner asks for one, when the change genuinely
  wants a second opinion, or when you want the before/after screenshots on a
  visual change to live somewhere durable. Then merge it yourself and do not
  sit watching CI — and if you do open one, expect the event noise and say so.

- **A VISUAL CHANGE DOES NOT GET PUSHED UNTIL YOU HAVE LOOKED AT IT.** This is
  the one place the fast path above does not apply, and it was paid for at full
  price. `main` publishes to the live page, and for anything touching a shader,
  a draw call, a uniform or the glow, "checks green" says almost nothing about
  the frame: seven of the eight harnesses stub the canvas, so a `drawImage` at
  the wrong translate is a valid call with finite arguments and a correct count.
  A build reached real playtesters carrying a hairline rim down every screen
  edge, every halo oscillating off its own light, and half the intended
  brightness — every check passing, merged in seconds, exactly as this file said
  to. **A day of a playtest cycle is not recoverable; testers do not come back.**
  So render it, look at it, and put the measurement in the commit message. It
  costs about twenty seconds using the loop below. `rendercheck.mjs` covers the
  regressions that have already happened; it cannot judge a new one for you.
  (This rule was itself briefly lost in a merge conflict while the workflow
  above was being rewritten, and restored on the next read — which is its own
  small argument for grepping the file after you resolve one.)

- **LOOK AT THE GAME. YOU CAN SEE THE SCREEN.** This line used to say the
  opposite — "you cannot hear the audio or see the screen" — and it was false,
  and it cost a whole session. An agent read it, believed it, shipped a
  complete backdrop overhaul verified only against the harnesses, and the
  owner's first look found a screen-edge artifact and a scene rendering at
  less than half the brightness of the path it replaced. Neither was subtle.
  Both were one screenshot away. The instruction that produced that was
  written by an earlier session in this same file, which is the whole reason
  it is being replaced rather than quietly corrected: **a false claim about
  your own capabilities in CLAUDE.md is the most expensive kind of wrong
  thing to write here, because every future session will believe it without
  checking.** Do not add another one. If you are about to write that you
  cannot do something, test it first.

  The loop, which takes about twenty seconds:

  ```sh
  # chromium + playwright are installed; index.html needs no server
  /opt/pw-browsers/chromium-1194/chrome-linux/chrome   # --enable-unsafe-swiftshader
  # playwright: import('/opt/node22/lib/node_modules/playwright/index.mjs')
  #   index.mjs, not index.js — index.js resolves but exports nothing
  # page.goto('file:///path/to/index.html') then screenshot
  ```

  WebGL works under SwiftShader, so `GL.on` comes up true and the real
  backdrop shader runs — not the 2D fallback. You can drive a run
  (`startGame()`), read any global (`G`, `SKY`, `GL`, `FX`), pull the
  shader's own output with `readPixels` in the same task as `glRender`, and
  isolate layers by hiding `#c` or `#bg`. Numbers out of a screenshot beat
  every argument about what a shader "should" look like.

  **Anything visual gets looked at before it is merged.** The harnesses are
  necessary and they are not sufficient: they stub the canvas, so they can
  prove a uniform was written and cannot prove the frame is not ruined. That
  gap is exactly where the thirteen invisible black hole features lived.
- **Say what you could not verify.** What genuinely wants the owner is TASTE —
  whether a sky reads as dangerous, whether a mix is too busy — and the audio,
  which really is beyond reach here. Ship the work and name those, rather than
  holding the work hostage to them. Do not put anything on that list that a
  screenshot would have answered.
- Commit messages in this repo are substantive: what changed, and *why* it was
  wrong before. Match that register.
- Update `README.md` when behaviour changes, `MECHANICS.md` when a mechanic
  changes, `docs/invariants.md` when a constraint changes, and this file when
  the routing changes. Unprompted, in the same commit. Documentation is part of
  the change, not a follow-up.
