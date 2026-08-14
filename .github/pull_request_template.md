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
- [ ] New guard is mutation-tested, or this adds no guard

## What I could not verify

<!--
  You cannot hear the audio or see the screen. Name what needs the owner's ears
  and eyes rather than leaving it implied — and ship the work anyway.
-->

---

**Merging:** arm **auto-merge (squash)** as soon as this is open — the
repository allows it, so GitHub merges on green and deletes the branch itself.
Do not sit and watch the run: the merge condition is "checks green", which
GitHub already evaluates, and polling it costs a minute of billed waiting per
pull request and buys nothing.
