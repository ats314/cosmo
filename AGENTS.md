# AGENTS.md

**The operating context for this repository is [`CLAUDE.md`](CLAUDE.md). Read it
first.** This file exists only so that agent tooling looking for `AGENTS.md`
finds its way there instead of concluding the repository has no instructions and
proceeding on defaults.

Nothing here overrides `CLAUDE.md`. The three things worth knowing before you
open it:

- **This is a proprietary commercial product**, published to a public repository
  for playtesting only. Do not add an open-source licence, a contributor guide,
  or anything else that invites outside reuse. `CLAUDE.md` explains what follows
  from that.
- **Run `node tools/all.mjs` before you push.** Every check, no dependencies,
  seconds to run. It reads the CI workflow, so it cannot drift from what the
  pull request will run.
- **`docs/invariants.md` is not optional reading.** `CLAUDE.md` carries a table
  that maps what you are touching to the group you need. Every entry in it was
  written because something shipped broken; several describe bugs that shipped
  three times.
