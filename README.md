# Comet Loop

A one-thumb arcade game that runs in a single HTML file. No build step, no
dependencies, no assets — open it and play.

**▶ [Play it](https://ats314.github.io/cosmo/)**

You are a comet locked to a circular orbit. You cannot steer and you cannot
stop. You get two verbs: reverse your direction, and hop between rings. Gather
embers, dodge shards, and complete orbits.

## Controls

| | Touch | Keyboard |
|---|---|---|
| Reverse | tap anywhere | `Space` / `Enter` |
| Hop outward | swipe away from the centre | `↑` `W` `←` `A` |
| Hop inward | swipe toward the centre | `↓` `S` `→` `D` |
| Phase through a hit | tap the shield bar | `E` / `Shift` |
| Mute | tap the speaker | `M` |

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

## Difficulty

Difficulty is a clock, not a score. Playing well nudges it forward slightly,
but the nudge is capped, so a good run can never accelerate you into a wall.
The first ~70 seconds advance at 60% rate to give a new player room to find
the controls.

Mechanics unlock on a schedule, each announced with a banner:

| ≈ | Unlock |
|---|---|
| 30s | second ring |
| 63s | twin shards — too wide to outrun, hop over |
| 93s | gates — every ring blocked, reverse |
| 128s | third ring |
| 153s | drifters — these ones move |
| 193s | blinkers — they flicker, time your pass |

## Power-ups

- **Shield** (green) — banked, up to 3. Taking a hit spends one automatically
  but knocks you off your orbit. Spending one *deliberately* phases you
  through anything for 1.4s and leaves the orbit intact. Never more than three
  power-ups pass without a shield.
- **Slow-mo** (violet) — 4 seconds at 55% speed.
- **Nova** (white) — turns every shard on the board into an ember.

## Running locally

Any static server works. `file://` works too, except that Chrome's storage
rules may block the high-score save.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploying

`.github/workflows/pages.yml` syntax-checks the game on every push and pull
request, and publishes `main` to GitHub Pages.

Setting it up on a fresh clone takes one manual step: *Settings → Pages →
Build and deployment → Source: **GitHub Actions***. The workflow passes
`enablement: true` to `configure-pages`, which is meant to create the Pages
site automatically, but the default `GITHUB_TOKEN` is not permitted to and
fails with `Resource not accessible by integration`. The flag is left in
place because it costs nothing and works for anyone running with a token
that does have the rights.

Two things that bite when this is not yet working:

- The `deploy` job declares a `permissions:` block, and such a block
  *replaces* the defaults rather than adding to them. `contents: read` has to
  be listed explicitly or `actions/checkout` fails — reported as
  `Repository not found`, which reads like a missing repo rather than a
  permissions problem.
- Enabling Pages does not itself trigger a build. Push to `main`, or re-run
  the last workflow, before expecting the site to appear.

## Notes on the implementation

Everything is one `<canvas>` and about 1,300 lines of plain JavaScript.

- **Sprites are baked once.** `shadowBlur` and radial gradients are expensive
  per-frame, so the background, nebulae, star field, comet, embers and shards
  are each rendered to an offscreen canvas at startup and blitted thereafter.
  They rebuild only when the scale unit, DPR, or window size actually changes.
- **Collision is a swept arc**, not a point test, so nothing tunnels through a
  shard on a wide screen or after a dropped frame.
- **Star positions live in normalised space**, so resizing never reshuffles
  the sky.
- **Audio is scheduled on the `AudioContext` clock**, not `setTimeout`, so
  arpeggios stay in time when the tab is backgrounded.
- **`prefers-reduced-motion` is respected** — screen shake, flashes, parallax
  and pulsing are all suppressed.
- **Safe-area insets** are read from a hidden probe element, so the ring and
  HUD stay clear of the notch and the home indicator.

Scores persist to `localStorage`.

## Checks

```sh
node tools/check.mjs
```

Confirms the inline script still parses and that the elements it looks up by
ID are still in the document.
