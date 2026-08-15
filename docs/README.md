# The Cosmo documents

`index.html` is the product. Everything here exists to keep it correct, and
none of it is published — the deploy uploads an allowlist, and these files are
not on it.

**If you are an agent session starting work, read [`../CLAUDE.md`](../CLAUDE.md)
first.** It routes you to the invariant group your change lands in. This page is
the map of everything else.

## Start here, by what you are doing

| You are… | Read |
|---|---|
| about to change game behaviour | the matching design document below, then [`invariants.md`](invariants.md) |
| about to change how something is drawn or sounded | [`engine/implementation.md`](engine/implementation.md) or [`design/audio.md`](design/audio.md), then [`invariants.md`](invariants.md) |
| adding or moving a test | [`harnesses.md`](harnesses.md) — it says which harness a given regression belongs in |
| reviewing the repository | [`review.md`](review.md) — both halves, including the hygiene half |
| trying to find out *why* something is the way it is | the design record below; it keeps the abandoned attempts, not just the conclusions |

## The rules

| Document | What it is |
|---|---|
| [`invariants.md`](invariants.md) | The load-bearing rules, grouped by what you would have to be touching to break one. Every entry was paid for by a bug that shipped; several describe bugs that shipped three times. Not optional reading. |
| [`harnesses.md`](harnesses.md) | The eight checks: what each covers, which one a new test belongs in, and what each assertion was bought with. The only home for harness documentation. |
| [`review.md`](review.md) | What a review here covers — correctness *and* repository hygiene, licence, secrets, telemetry and public posture. |

## The design record

Why the game is the way it is. These keep the reasoning, including what was
tried and rejected, because the rejected version is what a later session would
otherwise re-propose.

| Document | What it covers |
|---|---|
| [`design/difficulty.md`](design/difficulty.md) | The difficulty clock, the `MODES` knob table and why it survives at one row, where a run starts, and pause. |
| [`design/levels.md`](design/levels.md) | The six levels, what each is for, and the black hole that spans two of them. |
| [`design/ladders.md`](design/ladders.md) | `G.tier` unlocks; `G.level` is what the player is told. Why they are never the same word. |
| [`design/teaching.md`](design/teaching.md) | The curriculum, the death coach, lesson wording, and every channel that explains a mechanic. |
| [`design/powerups.md`](design/powerups.md) | The orbs, the upgrade draft, and why a tile that does nothing is worse than a badly tuned one. |
| [`design/audio.md`](design/audio.md) | The bus, the drop, four keys, verse and chorus, and why every pitch is an interval over the level's tonic. |

## The engine

| Document | What it covers |
|---|---|
| [`engine/implementation.md`](engine/implementation.md) | Baked sprites, the arena lighting, the render path, the GPU glow chain, the sky shader, collision, storage. |
| [`engine/telemetry.md`](engine/telemetry.md) | What is collected, what each property is named, and what never leaves the device. |
| [`engine/delivery.md`](engine/delivery.md) | The allowlist deploy, the build stamp, and the freshness contract on the play link. |

## Two things that live outside this folder

- [`../MECHANICS.md`](../MECHANICS.md) — the mechanics ledger, one row per
  player-facing mechanic. It is at the repository root because `check.mjs`
  enforces it directly: a formation or orb that ships without a ledger row
  fails the build.
- [`../CLAUDE.md`](../CLAUDE.md) — the operating context, and the router into
  `invariants.md`.
