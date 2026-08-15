<!--
  An internal working checklist, not an invitation. This repository is a
  proprietary commercial product published for playtesting; see CLAUDE.md.

  Commit messages and pull request bodies here are substantive: what changed,
  and WHY it was wrong before. Match that register — the history is the record
  of how this game came to be the way it is, and a body reading "updates" costs
  the next session the reasoning it needs.
-->

## What changed, and why it was wrong before



## Evidence

<!--
  "It is in the source" is not evidence that it is in the game. For a visual or
  audio change, put a NUMBER here: the ported shader maths evaluated, the voice
  instrumented and its energy totalled, the pixel measured. Thirteen black hole
  features shipped with one of them perceivable, each correct at its own site
  and disabled by something elsewhere. Delete this section only if the change
  cannot reach a pixel or a speaker.
-->

- [ ] `node tools/all.mjs` passes locally
- [ ] Invariant group(s) in `docs/invariants.md` for what this touches: <!-- name them -->
- [ ] `MECHANICS.md` updated, or this changes no player-facing mechanic
- [ ] `README.md` updated, or this changes no behaviour

## What I could not verify

<!--
  YOU CAN SEE THE SCREEN. This section used to open by telling you that you
  could not, which was false, and CLAUDE.md records what it cost: an agent read
  it, believed it, shipped a backdrop overhaul verified only against the
  harnesses, and the owner's first look found a screen-edge artifact and a
  scene at less than half the brightness of the path it replaced. Both were one
  screenshot away. Chromium and playwright are installed and index.html needs
  no server — see the loop in CLAUDE.md; it takes about twenty seconds.

  So this section is for TASTE and for AUDIO: whether a sky reads as dangerous,
  whether a mix is too busy. Audio genuinely is beyond reach here. Nothing that
  a screenshot would have answered belongs on this list — and ship the work
  anyway rather than holding it hostage to a question only the owner can settle.
-->

---

**Merging:** merge it yourself, squash, as soon as the checks are green, and do
not sit watching the run.

Note that **auto-merge is inert on this repository** and arming it is not a
step: GitHub waits on REQUIRED status checks, `main` has no branch protection,
so there are none to wait on. This footer used to instruct arming it anyway.

And note that a pull request is now the **exception** rather than the route —
`CLAUDE.md` says push straight to `main`, because the workflow already runs
every check on a direct push and deploys only if they pass. Open one when the
owner asks, when the change wants a second opinion, or to give before/after
screenshots somewhere durable. Expect the event noise if you do.
