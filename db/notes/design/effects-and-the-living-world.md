# The effects overhaul: motion instead of light gain

*What this answers: what changed when Cosmo removed its flashes, what replaced
each one, and which documents have not caught up.*

This is the most recent design pass in the repository (commits `f13d7c6`,
`dd9bbaa`, `01a3a25`, September 7 2026) and it is the one a session is most
likely to trip over, because several long-standing documents still describe the
system it replaced.

## The diagnosis

The problem was **cumulative**: music, pickups, damage, particles and scenery
could each increase light independently, and a single event could activate
several of them. Making one overlay weaker did not remove the other outlets. So
the pass removes broad flashes and repeated brightness impulses from the default
presentation, and keeps the living world, steady material lighting, movement,
sound, and the actual reward or warning each effect represents.

**`flashHit(v)` had nine call sites**, despite the old comment claiming seven
systems, and its 0.45-second rate gate applied only when `v < 0.5` — so the
largest requests bypassed it entirely. Death had a **separate** full-screen
impact frame that never passed through `flashHit` and could reach **92%
opacity**. All ten outlets are gone. `flashHit` no longer exists in
`src/game/runtime.js`.

The replacements are stated per call site in `docs/design/effects-audit.md`; the
pattern is always the same shape — the thing that actually happened becomes the
signal:

- Starfall's release: three real gold-star flights leaving the planet's vicinity
  and curving into the playable rings, plus travelling material contours.
- A shield save: local contact debris and contour, the count, the sound, the
  protection outline.
- Nova: an open segmented contour following the actual conversion radius, with
  converted stars materialising where the threats were.
- Hypernova: comet fins and an extended moving wake. Its ribbon is **three
  source-over passes with alpha compensated for width**, not five with a white
  boost. (The measured 5.31× filled-area figure in `MECHANICS.md` and
  `docs/design/powerups.md` describes the five-pass ribbon that has been
  replaced.)
- A completed lap: one short gold marker travelling the orbit, instead of
  lighting the whole ring.
- First-encounter lessons: a steady local bracket on the specimen, instead of a
  full-field dark veil plus a bright ring.

## The rules that replaced the flash

**`materialHue` redistributes light; it never multiplies it.** It preserves the
shader's existing weighted RGB value (0.299/0.587/0.114) before tone mapping and
changes only the colour, so *a dark part of the cloud stays dark*. The file is
explicit that this is an implementation bound and not a claim of constant
measured display luminance.

**`scenePulse` / `sceneAccent` are one envelope with a rank.** `SCENE_RANK` runs
orbit 1 < shield/spot/warp/mirror/scorch/slip/trail 2 < nova/hyper/drop 3, and
the black hole sits above all of them. A pulse is refused while a live event of
the same kind or a higher rank is still inside its span, so *duplicate audio and
gameplay cues cannot restart a transition or stack an impact.* Every event gets a
minimum **2.4 s** span with a smoothstep **0.9 s** entry and **1.2 s** exit, and
an orbit event's strength is capped at 0.60. `fxcheck.mjs` asserts the onset is
gradual (`uAccent[0] < 0.15` on the first frame), that a second `scenePulse` of
the same kind changes nothing, and that an expired event leaves the field
exactly as it found it.

**Beat timestamps drain without a brightness impulse.** `BEATQ → G.beat = 1`
could fire ~3.47 times a second at payoff density, and `drawBloom` /
`drawRingGlow` raised shared bloom by up to 45% and ring alpha by 30% on it.
`musiccheck.mjs` now drives ordinary play, a late Starfall, a black hole and the
finale and fails if `G.beat` or `BEATQ` is ever non-zero after `bedTick`, while
requiring that music is still audibly scheduled — *the music keeps its clock, the
picture stops borrowing it.*

**No random per-frame gain on continuing objects.** The comet's furnace and the
hypernova core sampled a 16-value table 24 times a second; the invulnerability
palette ran `0.45 + 0.35*sin(G.t*30)`, swinging opacity 0.10–0.80 at ~4.77
cycles per second *during an already demanding recovery*. Both are replaced by
steady light plus a protection outline that fades with the remaining grace.
Collectibles lost their beat size-kicks and gated sine glints; fixed scale,
slight orientation motion and steady rim lighting carry material identity.

**Reduced motion is not the gate.** The audit says so twice: these are the
defaults, and `prefers-reduced-motion` remains an additional movement
preference. The document also states plainly that it is an engineering and
design record, not medical advice or a photosensitivity certification.

## What the world does instead

`docs/design/direction.md` now asks for a living field rather than a lit one:

- **Flight currents.** Long dust filaments retain the committed travelled path;
  a turn redirects them and a completed hop bends the flow into the new lane.
  Signed accumulated travel advects the nebula and atmosphere without rotating
  the whole screen. *A speculative tap that becomes a swipe must not leave a
  false reversal behind.* Pause freezes the history; retry clears it.
- **Orbit pressure.** Star-fed orbit charge deforms the planet's rings and
  surface material rather than brightening anything. `musiccheck` has a matching
  assertion on the audio side: fed-orbit pressure must open the pad's upper
  harmony and raise its cutoff **within the same eight-voice gain budget**
  (`sum == 0.16` exactly), and a committed reversal must release it. A complete
  orbit gets exactly **two spaced rising accents** in the world's own harmony,
  and those accents must not sound during a protected passage (black hole, drop,
  armed drop, hypernova, finale, pause, death) or replay after mute.
- **Starfall from the corona.** Gold stars originate near the planet and travel
  into the arena; their visible flight and their actual contact positions agree.
- **Powers as forces.** Magnet bends streams toward the comet, Scorch leaves a
  warm travelled wake, the black hole pulls surrounding layers inward — all
  coordinated through shared gameplay state rather than independent decorative
  oscillations.

`GL_MOTION` is **1.0** now and its comment reads "seconds of visible,
differential sky flow" — a different quantity from the 0.42/0.72/0.25 values the
historical prose discusses. `SKY_ARENA_CALM` is **0.62**, and its job is
unchanged: compress contrast in the annulus the orbits occupy so hue can be free
while the band a shard is read against stays quiet.

## Documents that have not caught up

These are worth knowing before trusting a paragraph:

- **`docs/engine/implementation.md`** still documents the GPU **degrade ladder**
  (`GL_SCALE` climbing and latching, the glow shed first, the sky killed last) as
  current. It was deleted; `GL_SCALE` is a constant 1.0, `glWatch` and
  `GL.scale`/`GL.cap` are forbidden by `fxcheck.mjs:289`, and the owner's
  instruction was "a struggling device should struggle". The same file's
  historical sections quote `SKY_ARENA_CALM = 0.10` and `GL_MOTION = 0.42 →
  0.72`; the current values appear in its "Current presentation" section, which
  is what `check.mjs`'s staleness guard requires.
- **`MECHANICS.md`** and **`docs/design/powerups.md`** quote the hypernova
  ribbon measurements (five passes, 1.85× wider, filled area 5.31×) for a ribbon
  that is now three compensated passes.
- **`docs/design/levels.md:420-433`** quotes twelve tier sentences, none of which
  is the shipped string, and still names `blinkers` / `flicker pairs` for
  `SHUTTERS` / `SHUTTER PAIRS`.
- **`docs/design/teaching.md`** still describes the loop recorder's cyan dot and
  the band meter as live, and describes the MEET lesson as a 0.06× near-freeze
  under a dim veil with a cool-white specimen ring — the veil is what the
  effects audit removed.
- **`src/game/runtime.js`**'s own `LV` header still says *"all nine formations
  still unlock inside dl 0-340 and levels 4, 5 and 6 introduce no new SHAPE at
  all"*, fifty lines above an `LV` comment saying "DIVERS unlock here, at dl
  395".

None of these is a bug in the game. They are the ordinary cost of a design
record that keeps its history — but a session that reads one paragraph and acts
on it will be wrong, which is exactly the failure `check.mjs`'s doc-staleness
guard was written for and which it only covers for *named constants*.
