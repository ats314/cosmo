# Cosmo

A one-thumb arcade game that runs in a single HTML file. No build step, no
dependencies, no assets — open it and play.

**▶ [Play it](https://ats314.github.io/cosmo/)**

> **Proprietary — all rights reserved.** Cosmo is a commercial product, not an
> open-source project. This repository is public for playtesting only. No
> permission is granted to use, copy, modify, host, redistribute, or build
> derivative works from any part of it, and it is excluded from text and data
> mining and from machine-learning training. See [LICENSE](LICENSE).

You are a comet locked to a circular orbit. You cannot steer and you cannot
stop. You get two verbs: reverse your direction, and hop between rings. Gather
embers, dodge shards, and complete orbits.

## Where everything is

`index.html` is the product — the entire game in one self-contained file, with
no build step and no dependencies. Everything else in this repository exists to
keep that file correct.

| Path | What it is |
|---|---|
| `index.html` | **The whole game.** Engine, simulation, WebAudio arrangement, procedural art and UI, in one inline `<script>`. The distributed artifact. |
| `MECHANICS.md` | The mechanics ledger: one row per player-facing mechanic, where it is introduced, every channel that explains it. |
| `CLAUDE.md` | Operating context for agent sessions — what this is, what you may not do to it, how to ship. Read first. |
| `AGENTS.md` | A pointer to `CLAUDE.md`, for tooling that looks for that filename. |
| `LICENSE` | All-rights-reserved proprietary grant. Published with the game. |
| `docs/` | Everything below. |
| `tools/` | The CI harnesses. No dependencies; Node's `vm` and a stubbed DOM. |
| `.github/workflows/pages.yml` | Runs every check on every push and PR; only `main` deploys, only on green, and only an allowlist. |

### The design record — why the game is the way it is

Each of these is the reasoning behind one system, including the things that were
tried and abandoned. Read the one you are about to change.

| Document | What it covers |
|---|---|
| [`docs/design/difficulty.md`](docs/design/difficulty.md) | The difficulty clock, the `MODES` knob table, where a run starts, and pause. |
| [`docs/design/levels.md`](docs/design/levels.md) | The four levels, what each is for, and the black hole that spans two of them. |
| [`docs/design/ladders.md`](docs/design/ladders.md) | `G.tier` unlocks, `G.level` is what the player is told — and why they are never the same word. |
| [`docs/design/teaching.md`](docs/design/teaching.md) | The curriculum, the death coach, lesson wording, and every channel that explains a mechanic. |
| [`docs/design/powerups.md`](docs/design/powerups.md) | The orbs, the upgrade draft, and why a tile that does nothing is worse than a bad one. |
| [`docs/design/audio.md`](docs/design/audio.md) | The bus, the drop, four keys, verse and chorus, and why every pitch is an interval. |

### The engine — how it actually works

| Document | What it covers |
|---|---|
| [`docs/engine/implementation.md`](docs/engine/implementation.md) | Baked sprites, the render path, the GPU glow chain, the sky shader, collision, storage. |
| [`docs/engine/telemetry.md`](docs/engine/telemetry.md) | What is collected, what each property is named, and what never leaves the device. |
| [`docs/engine/delivery.md`](docs/engine/delivery.md) | The allowlist deploy, the build stamp, and the freshness contract on the play link. |

### Working on it

| Document | What it covers |
|---|---|
| [`docs/invariants.md`](docs/invariants.md) | The rules that are load-bearing, grouped by what you would have to be touching. Every entry was paid for by a bug that shipped. |
| [`docs/harnesses.md`](docs/harnesses.md) | What each check covers, where a new test belongs, and what each assertion was bought with. |
| [`docs/review.md`](docs/review.md) | The two halves of a review here, including the hygiene half people skip. |

## Running the checks

```sh
node tools/all.mjs --fast   # the quick four, ~5s — while editing
node tools/all.mjs          # all eight, ~110s — before pushing
```

No dependencies beyond the browser the render check drives, and it says so
rather than skipping quietly. `all.mjs` holds no list: it parses the CI workflow
and runs exactly what CI runs, in CI's order. See
[`docs/harnesses.md`](docs/harnesses.md).

## Running it locally

Any static server works. `file://` works too, except that Chrome's storage
rules may block the high-score save.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Controls

| | Touch | Keyboard |
|---|---|---|
| Reverse | tap anywhere | `Space` / `Enter` |
| Hop outward | swipe away from the centre | `↑` `W` `←` `A` |
| Hop inward | swipe toward the centre | `↓` `S` `→` `D` |
| Land the drop | any move on the downbeat | any move |
| Mute | tap the speaker | `M` |

Every keyboard row is a keyPRESS, not a key being down: `keydown` returns early
on `e.repeat`, so holding a key does nothing after the first frame. Without that
guard the OS auto-repeat rate *was* the input rate — a held `Space` called
`reverse()` around twenty times a second and pinned the comet inside 0.23 rad of
the circle, about thirteen degrees, for an entire run. The pointer path had
always guarded the equivalent ("one gesture at a time: a second finger can't
double-reverse"); the keyboard path never had. `smoke.mjs` now fires a burst of
repeats and fails if the comet stops covering ground.

There is no aimed input anywhere in this game. Landing the drop is any move —
the tap or hop you were making anyway, wherever your thumb is — inside the
window around the downbeat, and the move still does its normal job: if
survival wanted a hop right then, that hop lands the drop.

Swipes are read **radially** — measured against the line from the centre
through the comet — so "away from the middle" always means outward no matter
where on the circle you are. A tap reverses instantly and the sound follows a
beat later, so a swipe that starts like a tap can be rolled back silently.

## How scoring works

The two systems feed each other rather than competing:

- **Embers** are worth a rising combo (up to ×6) while you keep collecting.
- **Orbits** — 360° of travel without reversing — pay out based on how many
  embers you gathered *during* that orbit. A bare orbit is worth almost
  nothing; a full one is worth a lot, and consecutive fed orbits stack a
  streak bonus.

Reversing costs you the current orbit and the streak, but the embers already
gathered stay banked. Gates exist to force reversals, so they must not delete
the score you turned around to protect.

## License

**Proprietary. Copyright (c) 2026 Alex Smith ([@ats314](https://github.com/ats314)).
All rights reserved.** See [LICENSE](LICENSE).

This is not open source. No permission is granted to use, copy, modify, host,
redistribute, or build derivative works from any part of this repository —
including the game itself, its assets, and its tooling. Playing the game at its
published address is the only permitted use; the source your browser receives in
order to run it is not yours to keep or reuse. The code is also excluded from
text and data mining and from machine-learning training of any kind.

Licensing enquiries: open an [issue](https://github.com/ats314/cosmo/issues).

One caveat the license itself names: GitHub's Terms of Service let any GitHub
user view and fork a repository its owner has set public, and no LICENSE file
overrides that. Making the repository private is the only way to withdraw it.
