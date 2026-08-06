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
| 20s | second ring |
| 50s | twin shards — too wide to outrun, hop over |
| 80s | gates — every ring blocked, reverse |
| 106s | third ring |
| 133s | drifters — these ones move |
| 173s | blinkers — they flicker, time your pass |
| 223s | sliding gates — the wall slides, reverse early |
| 278s | flicker pairs — one gap at a time, never both |
| 343s | storm — no new tricks, just more of them |

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

## Levels

The ladder is ten levels, and it is the same ten tiers the game has always
climbed — `TIERS`, `tierIndex()`, `G.tier` — but until now the only places the
ordinal ever surfaced were the clipboard and an analytics endpoint that ships
switched off. The player doing the climbing was never told the number.

A tester put the case better than the design did:

> I just think clearing the board using level tiers might be more rewarding as
> a sense of accomplishment than just trying to get a higher score each time.
> For whatever reason, reaching level "XYZ" seems more memorable and rewarding
> than just a highest score. Levels are more distinct, you know?

He is right, and the reason is that a score is a cardinal you cannot repeat
from memory while a level is an ordinal you can say out loud, compare against
someone else, and come back for. So the level now appears under the score in
play, leads the death screen in ember gold with the tier named beneath it,
leads the share text, and persists as `cometloop:level` — "BEST · LEVEL 6 of
10" on the menu, and **FURTHEST YET** in place of NEW BEST when a run sets it.

The ten-pip ladder is drawn on the death screen with the reached levels
filled. The empty half is the point as much as the full half: a player who
dies on level 3 can see that seven more exist, which is the one thing a bare
score can never tell them.

None of this touches the simulation. It changes what the game *says* about
itself, not what it does.

**The banner is gold now, not red.** A tier announcement drew in `COL.shard` —
the shard fill, the danger outline, and the exact colour `GAME OVER` prints
in. The only moment the game announced that you had got somewhere was painted
in its failure colour.

**And the newest formation stays featured across ring unlocks.** `pickType()`
triples the weight of the newest shape, keyed off the top tier — but three of
the ten tiers announce a ring or a storm rather than a shape, so at those the
tripling silently did nothing. Crossing THIRD RING dropped gates from 60% of
the spawn pool to 33%: a banner celebrating a new ring that also made the
board easier. STORM, whose own banner promises "just more of everything",
flattened flicker pairs from 33% to 14%. It now walks back to the last tier
that carries a shape.

## Learning it

A run opens on a single ring, where the only move is a tap to reverse. The
second ring does not arrive for ~20 seconds, so until it does, a prompt to
swipe would be asking for the one gesture the game will not answer — the
hints skip it until there is somewhere to hop to.

**The hard gesture gets the quiet part of the run.** The second ring used to
arrive at 30s, which meant the hop — a radial swipe on a circle, where "away
from the middle" points a different way at every point of the orbit — was
introduced at the exact moment the board first filled up. The calm opening was
being spent teaching the tap, which nobody needs help with, and the difficult
half of the control scheme was taught under pressure. The ring now lands at
20s and the hop prompt outranks the lap prompt, so the lesson and the calm
coincide.

**Every run introduces all three power-ups, in order.** The first three
placements are shield, then slow-mo, then nova; only afterwards does the
40/35/25 roll take over. Drawn independently at roughly one placement every
twelve seconds, a 60-second run — which is most runs — saw two power-ups and
had better than even odds of never meeting slow-mo or nova at all. Two of the
three most interesting objects in the game were optional content. Slow-mo and
nova are also *named* now, by a hint that fires while the orb is still on the
board: before, you touched a coloured dot and something large happened that
you had no word for.

The first three runs get a longer clear opening before the first shard —
11s, tapering back to the normal 7s by the fourth run. (Every run starts with
two shields, for everybody, not just newcomers.) `G.runs` persists, so this
fades out on its own and a returning player never meets it. It is a ramp for
learning the controls, not a difficulty change — from run four the game is
exactly what it always was.

## Power-ups

- **Shield** (green) — banked, up to 3. Taking a hit spends one automatically
  but knocks you off your orbit. Never more than three power-ups pass without
  a shield.
- **Slow-mo** (violet) — 4 seconds at 55% speed.
- **Nova** (white) — a front expands from where you took it and turns what it
  touches into light. It converts on *contact*, not all at once: nearest
  shards first, each detonating as the wave reaches it, so the board comes
  apart as a cascade rather than in a single frame. Because the wave reaches
  each shard at a different moment, the conversion pings sequence themselves
  with no scheduling. You are invulnerable while it sweeps — you are standing
  inside your own blast.

  **Its speed was tuned to the wrong distance.** The front ran at 1600, picked
  so it clears a screen diagonal inside its lifetime — but no shard is ever out
  on the diagonal. The blast is centred on the comet and every shard sits
  inside the ring system, so the farthest is 2R away: 334px on a 390px phone,
  crossed in **0.225s**. The cascade this was all written to produce finished
  in thirteen frames and the front then spent another half second expanding
  through empty space. At 560 the same sweep takes ~0.65s, which is long enough
  to read as a wave travelling outward, and the invulnerability window was
  widened to outlast it.

  **And the embers now land on your ring.** Converting in place looked right
  and paid almost nothing: embers are only collectable on the ring you are on,
  so on a three-ring board two thirds of a nova's output was scenery that
  expired five seconds later. A six-shard nova returned about two reachable
  embers — twelve points, against the eighty-six a maxed orbit pays, for the
  rarest thing in the game. They now arrive on your own track at the angle the
  shard held, which turns the same blast into a guaranteed ember run: the combo
  climbs, the pentatonic phrase resolves, and `lapEmbers` feeds the orbit
  payout and the build meter. The conversion burst still fires out where the
  shard actually was, so the light reads as travelling from the danger onto
  your lane.

## After a run

The death screen leads with the **level**, names the tier under it, and draws
the ten-pip ladder with your run filled in — then the score, then orbits, best
streak and elapsed time. It offers a **SHARE** button that hands off to the
native share sheet where one exists and falls back to the clipboard, producing
plain text:

```
Comet Loop · LEVEL 10/10
◆◆◆◆◆◆◆◆◆◆ STORM
4300 points · 62 orbits · ×7 streak · 5:12
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

One event per run, `run_ended`, carrying score, duration, orbits, best streak,
embers, level and tier reached, what killed you, shields that saved the run,
how many power-ups were placed and whether slow-mo and nova were actually
seen, and `run_index` — the lifetime run count, which is the one that actually
measures retention. Plus `share_tapped`.

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

## Audio

```
voice ─┬─► dry ──────────────► world ─┐
       └─► send ─► reverb ───────────►├─► limiter ─► makeup ─► soft clip ─► out
bed ─────────────► bedDuck ───────────┘
```


Everything is synthesised in WebAudio — there are no audio files anywhere in
the repo.

Sound routes through a bus built once: voices into a limiter, then makeup
gain, then a soft clipper, with a send into a convolution reverb whose impulse
is generated from noise and an exponential decay. Two delay taps were tried
first and read as slapback rather than space — above the ~50ms fusion
threshold you hear two echoes, not a room.

`MASTER` was measured, not guessed. The original layer peaked at **0.138** on
the busiest moment in the game, so roughly 86% of the available headroom was
going unused — that, and not clipping, was why it sounded thin on a phone.
2.6 put a nova cascade three samples over full scale; 2.15 peaks at 0.93 on
the loudest event with the limiter barely working.

**The drop.** The arrangement builds and, when you earn it, releases. A drop
needs three things and the third is the one usually missed: a rise, a
**silence**, and the hit. The last bar runs an accelerating riser, the final
two eighths cut almost everything, and the downbeat lands with six voices at
once — without the hole, the loud part is just more loud.

It always fires on a downbeat. Earning one *arms* it and it goes off at the top
of the next cycle, so there is up to nine seconds of anticipation. A drop that
arrived mid-bar would not be a drop, it would be a noise. There is a 20s
cooldown, because a drop that happens constantly is not an event.

What arms one is the **build meter**, and nothing else. Four things fill it,
one per style of play — gathering sparks, working the rings, playing in time,
and closing clean orbits — and whichever contributed most names the drop when
it lands. The meter decays, so it measures how you are playing *now* rather
than how long you have survived, and it is on screen throughout, so "how am I
causing this" never needs answering twice.

**Timing is rewarded, and never punished.** Each input is judged against the
sixteenth grid; land tight and the **groove** chain climbs to ×8. An off-beat
input simply earns nothing — the game already demands you tap when a shard
arrives, and docking you for surviving at the wrong moment would force a choice
between playing well and playing in time.

The judgement is of **consistency, not absolute accuracy**. A phone adds
30–50ms between finger and JS event, so scoring absolute timing would mean a
player tapping perfectly in time registers late and never scores — their device
deciding their result. Instead a running bias is tracked and the deviation from
it is judged, so a player reliably 60ms late is playing in time and gets credit.
Verified by simulating exactly that: the system learned a bias of 0.057 against
an injected 55ms and that player reached ×8 alongside a perfectly-timed one,
while arbitrary tapping topped out at ×4.

Score is awarded **only when the chain climbs**, never for holding it. Paying
per tight hit made forty taps worth 320 against 86 for a maxed orbit — rhythm
would have become the whole game. On the way up a full chain totals 36, so it
stays a garnish beside embers and orbits. The real reward is that the music
opens up, and that costs nothing.

The rings **pulse on every quarter note**, because you cannot play to a beat you
cannot find. The pulse brightens and shifts colour as the groove builds.

**Your inputs are part of the arrangement.** Every reverse and every hop
already makes an immediate functional noise — that does not change, because
delaying it would make the controls feel laggy. On top of it, each input places
a second note *on the musical grid*, so a player mashing reverse while stuck is
not making noise, they are playing the record.

Consecutive inputs walk a pentatonic figure rather than repeating a pitch, so
tapping back and forth is a phrase; a pause of 2.4s starts a new one. Hops run
the figure upward or downward depending on direction. Input also builds *heat*,
which opens the pad filter, adds sixteenth-note hats and thickens the hits, then
decays over about three seconds — so working the controls drives the groove and
then settles, rather than latching.

Quantising is to the **nearest** sixteenth, not the next one. Snapping forward
alone costs up to a full slot — 144ms at this tempo, past the point where a
sound stops feeling attached to the tap that caused it. Nearest halves the worst
case: measured at **61ms** across a flurry of twelve off-grid taps. One note per
slot, so forty taps inside a single frame produce exactly one — two notes in one
slot is not a faster rhythm, it is a flam, and it is how mashing would otherwise
stack nodes.

The score is **adaptive layering**: one fixed tempo (104bpm) and one key
(A minor, deliberately the key the SFX pentatonic sits in, so nothing the game
plays can clash with it), with layers entering as the difficulty clock rises —
bass, then a pentatonic arp, then hats, then a counter-line, with the arp
moving from quarters to eighths past 62% intensity. Nothing changes tempo or
key mid-run, so it can never lurch; what changes is how much of the
arrangement you hear. It is also the only channel that tells you speed has
climbed from 1.4 to 4.2 rad/s.

Notes are scheduled **ahead on the audio clock**, never from the frame clock,
which stalls whenever the tab is backgrounded. A stall longer than 0.4s
resyncs rather than flushing its backlog as one chord — verified by forcing a
five-second gap and counting what came out.

The pad is four continuously running voices **retuned** per chord rather than
restarted; restarting sustained oscillators every bar is what makes cheap game
music click at the seams. Escalation is carried by filter movement, never by
amplitude — a slow volume wobble on a sustained tone is the most fatiguing
thing you can put under a fifteen-minute run.

Several cues were fixed rather than added. iPhone speakers roll off hard below
~500Hz, so the bump cue at 150→110Hz and the empty-shield cue at 140→100Hz
were inaudible on the device the game ships to — and bump fires exactly when a
swipe was misread, which is when the player most needs an answer. The shield
block landed in the death register and sounded like a punishment for being
rescued. The death itself fell to 50Hz and so ended by vanishing. The nova
cascade picked a random pitch per shard and stacked into a dissonant wash; it
is now a minor pentatonic.

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
- **Mute is per device and permanent**, so toggling it says so. The speaker
  sits in the top-right corner with a ~50×50px hit area that is live on the
  menu too, and the setting persists through a reload — without
  acknowledgement, one stray thumb reads as "this game has no sound". The
  muted icon is drawn *more* prominently than the unmuted one for the same
  reason: a muted state is the thing you need to notice.
- **iOS needs audio actually played inside a gesture**, not just
  `resume()` — a one-sample silent buffer unlocks it — and the context is
  resumed again on `visibilitychange`, since returning from the app switcher
  or lock screen leaves it suspended. (Note that on iPhone the hardware
  ringer switch silences WebAudio regardless; no code can override that.)
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
