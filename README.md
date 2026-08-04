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
| 238s | sliding gates — the wall slides, reverse early |
| 288s | flicker pairs — one gap at a time, never both |
| 348s | storm — no new tricks, just more of them |

Those times assume a player earning no difficulty nudge at all, which is the
slowest the schedule ever runs; scoring well pulls everything forward by up
to 40 seconds.

The late tiers are **compounds**, not new objects. `gate`, `blink` and drift
(`va`) are independent flags on the same shard, and both update and draw
already handle them in any combination — so a sliding gate and an alternating
pair cost a spawn branch each and nothing else. A sliding gate gives every
segment the same drift, or the rung would shear apart from the bar, which is
drawn from ring 0's angle. A flicker pair is offset half a cycle, so there is
always exactly one gap and never two.

Speed keeps climbing after the unlocks run out. The exponential is within
0.2 of its ceiling by ~4 minutes, so past that a slow linear term takes over
(capped at 4.2 rad/s). Without it a long run flattens into a plateau that only
ever ends from a lapse in attention rather than from pressure.

## Learning it

A run opens on a single ring, where the only move is a tap to reverse. The
second ring does not arrive for ~30 seconds, so until it does, a prompt to
swipe would be asking for the one gesture the game will not answer — the
hints skip it until there is somewhere to hop to.

The first three runs get more room: two shields instead of one, and a longer
clear opening before the first shard (9s, tapering back to the normal 4s by
the fourth run). `G.runs` persists, so this fades out on its own and a
returning player never meets it. It is a ramp for learning the controls, not
a difficulty change — from run four the game is exactly what it always was.

## Power-ups

- **Shield** (green) — banked, up to 3. Taking a hit spends one automatically
  but knocks you off your orbit. Spending one *deliberately* phases you
  through anything for 1.4s and leaves the orbit intact. Never more than three
  power-ups pass without a shield.
- **Slow-mo** (violet) — 4 seconds at 55% speed.
- **Nova** (white) — a front expands from where you took it and turns what it
  touches into light. It converts on *contact*, not all at once: nearest
  shards first, each detonating as the wave reaches it, so the board comes
  apart as a cascade over roughly a fifth of a second rather than in a single
  frame. Because the wave reaches each shard at a different moment, the
  conversion pings sequence themselves with no scheduling. You are invulnerable
  while it sweeps — you are standing inside your own blast.

## After a run

The death screen reports orbits, best streak and elapsed time alongside the
score, and offers a **SHARE** button. It hands off to the native share sheet
where one exists and falls back to the clipboard, producing plain text:

```
Comet Loop 4300
◆◆◆◆◆◆◆◆◆◆ STORM
62 orbits · ×7 streak · 5:12
https://ats314.github.io/cosmo/
```

Text rather than an image, deliberately: it survives every messaging app, can
be quoted in a reply, and travels further than a bare link does. The bar
reports how far the run got without spoiling the tiers you have not reached.

## Telemetry

**Off by default.** `POSTHOG_KEY` is empty in this repo, so a clone sends
nothing anywhere and every `track()` call short-circuits before it does
anything. Paste a PostHog project key into that constant to switch it on; a
disclosure line appears on the menu automatically when you do.

It is configured for gameplay counters and nothing else: `autocapture` off,
session recording off, `localStorage` persistence rather than cookies. The
loader is fully wrapped and fails silent, so a blocked request or a dead
network cannot take the game down with it.

One event per run, `run_ended`, carrying score, duration, orbits, best
streak, embers, tier reached, what killed you, shields spent reactively vs.
deliberately, and `run_index` — the lifetime run count, which is the one that
actually measures retention. Plus `share_tapped`.

The interesting field is **`misread_rate`**. Every swipe begins as a tap, so
the input layer reverses speculatively and rolls back once your finger
travels. That is invisible when it works. `GEST` counts where each gesture
actually resolves:

| | |
|---|---|
| `tap` | lifted without travelling — reverse, as intended |
| `swipe` | radial intent clear mid-drag — hop, as intended |
| `lateSwipe` | only resolved at lift — worked, but it was close |
| `unresolved` | swiped and got nothing. **The misread.** |

Counted at the resolution sites, deliberately *not* inside `bump()` — that
also fires when a swipe hits the outermost or innermost ring, which is the
game answering correctly rather than failing to understand. Conflating the
two would make the metric useless.

Expect ad blockers to eat a fair share of events. Ratios like `misread_rate`
and run-4 retention survive that; absolute player counts do not.

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
- **Spawn clearances scale with ring radius.** A shard's hit width is
  `18.5u / radius` *radians*, so it doubles on the innermost ring — half the
  radius, twice the angle blocked. Clearances used to be flat radians, which
  meant two inner-ring neighbours at the mandated 0.5rad separation overlapped
  by 0.068rad: a wall with no gap, which the player simply could not pass.
  Expressing clearance as a multiple of the hit width fixes it on every ring
  and every screen size, because both terms carry the same `u / radius`
  factor. Sampled over 3,000 boards, no pair of separate shards on a ring
  leaves less than a full gap; the only overlaps left are twins, which exist
  to be hopped.
- **The shield cap grows with the clock** — 3, then 4 past `dl` 160, then 5
  past 320. Late boards carry ten shards across three rings and the inner ring
  costs twice the angle per shard, so three slots stopped being enough to play
  around long before a run ended.
- **Gates are checked for solvability before they spawn.** A gate blocks every
  ring at one angle, so it exists to force a reversal — and uniform random
  placement can bracket the player, wall ahead and shards behind on every
  ring. `reverseEscape()` requires some ring to offer a clear run in the
  post-reversal heading; without one the formation is downgraded to a single
  shard. Across 5,000 randomised board states, about 2% had no escape, and
  none of the 1,257 gates that shipped landed in one. A death you had no move
  against reads as the game cheating, which is the one thing that stops a run
  being worth retrying.
- **Star positions live in normalised space**, so resizing never reshuffles
  the sky.
- **Audio is scheduled on the `AudioContext` clock**, not `setTimeout`, so
  arpeggios stay in time when the tab is backgrounded.
- **Completing an orbit sets the orbit alight.** A head races the full
  circumference in the direction you were travelling, wake burning behind it —
  the one effect that draws what you actually did. It sits just proud of the
  ring rather than on it: on the ring it lands under the comet's own tail and
  reads as more trail, but offset and gold against the tail's cyan it reads as
  the orbit catching light. Everything about it scales with the streak, and
  from ×3 the comet holds still for 75ms while the ring burns round — effects
  run on `dt` and gameplay on `sdt`, so the freeze costs no animation. Under
  reduced motion the ring lights all at once and the hitstop is skipped.
- **Bloom never reads back the canvas.** The textbook route — copy the frame
  into a small buffer and let the upscale blur it — measures ~16ms here,
  because pulling 1.3M pixels back out stalls the pipeline; spare budget does
  not help when one operation eats all of it. Instead the bright objects are
  re-drawn as crude blobs into a quarter-size buffer, which is then upscaled
  back additively. Precision there is pointless: bilinear filtering on the way
  up *is* the blur. Costs about 0.3ms.
- **The comet lights its own ring** — a short arc centred on it, falling off
  both ways. Decorative, but it also makes "which ring am I on" readable
  without looking away from the comet.
- **The trail runs hot at its core.** Three additive passes of one flat cyan
  read as paint; the narrow pass now runs near-white so the ribbon cools
  outward the way anything incandescent does.
- **Particles stretch along their velocity.** Burst speed drives the
  elongation, and since velocity damps at `0.15^dt` the streak collapses to a
  round spark on its own within a few frames — the shape carries the motion,
  with no extra state to track.
- **Gate bars are drawn as energy, not as a line** — a wide soft pass under a
  tight core, overhanging both ends of the ring stack so they read as a
  barrier across the field rather than a chord within it, with crawling rungs
  once armed.
- **Ripples carry their own speed and decay**, so a death shockwave can
  outrun a pickup pop instead of every ring expanding at one rate.
- **`prefers-reduced-motion` is respected** — screen shake, flashes, parallax,
  pulsing, the death shockwave and the animated gate rungs are all suppressed.
- **Safe-area insets** are read from a hidden probe element, so the ring and
  HUD stay clear of the notch and the home indicator.

Scores persist to `localStorage`.

## Checks

```sh
node tools/check.mjs
```

Confirms the inline script still parses and that the elements it looks up by
ID are still in the document.
