# Power-ups

*The orbs, the draft, and why each tile has to do something.*

Part of the [Cosmo design record](../../README.md#where-everything-is).

---

Every one of these can be tried on demand from the title screen's POWERUP
TESTING bar — see [POWERUP TESTING](difficulty.md#powerup-testing). It exists because the
list below is gated: three are introduced on level 1, one on level 2, one on
level 3, and the black hole is deliberately rare enough that it had been
entered three times in the game's whole recorded history.

- **Shield** (green) — banked, up to 3. Taking a hit spends one automatically
  but knocks you off your orbit. Never more than three power-ups pass without
  a shield.
- **Slow-mo** (violet) — 4 seconds at 55% speed.
- **Overcharge** — a full shield bank means you have been playing clean,
  and the streak pays (playtester-designed, near-verbatim): while shields
  are full, embers and on-beat taps pay DOUBLE, the pips ring gold, and
  every overflow shield is worth +50 ("OVERCHARGED") instead of a token
  +2. Reaching full announces it: "SHIELDS FULL — everything pays
  double."
- **Spotlight** (white/violet) — four bars where YOU are the lead, on an
  actual stage: the house dims under the arena, a followspot beam and a
  pool of light pin the comet, stars and tight taps pay double, your
  instrument gains half again and the band steps back a notch. A violet
  ring around the comet empties clockwise and blinks through the last
  1.5 seconds. A performance, not a transaction. (It replaced the Echo
  orb, which the loop recorder made redundant, and which the playtest
  didn't love.)
- **Hypernova** — the gold star (the playtest group asked for "a star in
  Mario", so it is one, drawn plainly). Sixteen beats of invincibility at
  nearly double speed: the kit doubles to sixteenths, the room floods
  gold, and every red you plow through converts into a paying ember on
  your lane — fast contacts play an ascending sixteenth run, so carving
  through a full lane IS a melody. The speed eases in over a third of a
  second and back out over the final 1.4 seconds, with a short
  invulnerability grace after it fades, so the star never dumps you at
  double speed into an armed shard. Everything pays double while it burns.

  **And the song gets a star tune**, which is what the playtest was really
  asking for. Doubling the kit is a *texture* change — the same song, busier.
  What a star does in the game everyone means by that comparison is melodic: a
  different tune arrives, instantly, and it is unmistakably the invincibility
  tune. So `STARRUN` is sixteen sixteenths that climb and wrap — four ascending
  four-note cells, each starting a degree higher than the last, so the line
  spirals upward and never resolves — restated every bar for as long as you are
  untouchable, over a driving eighth-note bass on the live chord's root, with
  the band's pad opening 1.22× underneath rather than stepping back.

  It is an **overlay, not a section**, and both halves of that are deliberate.
  The star already lifts the record into the chorus (hypernova is in the
  hot-play set) — but that lift can only land at a four-bar seam, and a seam
  can be most of a loop away against a star that lasts four bars, so a player
  could take the orb, hear nothing change, and have it expire before the
  section arrived. The one thing this moment cannot be is late. And a third
  *section* was not available: `applySect` is the only writer of `CH`/`ARP`,
  sections change only at a four-bar seam, and a star that swapped the harmony
  mid-bar would break the rule the payoff, rise, black hole and star dive
  exceptions exist to protect. An overlay adds a voice above whatever harmony
  is already playing, so it is immediate and cannot collide with anything.
  Written as pentatonic degrees 4–10 — an interval over the level's own tonic,
  never a frequency — so it transposes with the key and stays consonant against
  every chord in either section, and it sits above the band's degree-4 arp
  ceiling because it is the one voice meant to be *on top* of the arrangement.
  A black hole outranks it. `musiccheck.mjs` holds all of that: every degree
  sounded on every level, the density (2 voices in that register cold against
  66 with the star), silence through a black hole, and — the one that has
  shipped wrong twice in this file — that `bedTick` actually lifts the pad,
  because it is the only writer of `BED.g` and scheduling extra voices alone
  cannot make a band louder.

  **And the tail becomes the comet.** "A comet flying through orbit with a
  brilliant tail" is the other half of the ask, so during a star the ribbon
  stops being the groove's scoreboard and becomes the thing itself: five
  passes instead of three — a wide magenta bloom outside a hot gold body
  inside a white core, in the orb's own two colours rather than a new palette
  — 1.85× wider, and *longer*, because the per-sample decay eases off (the
  sample cap is only headroom; it was never the binding constraint, and saying
  otherwise would be a comment taking credit for a line that does nothing).
  Sparks shed off it unconditionally rather than waiting for a groove chain,
  in the star's colours, at a raised particle ceiling. Measured on a 390×844
  phone, ordinary run → hypernova, repeated across runs: **trail samples held
  29→53, arc length 143→428px (3.00×), widest point 15→28px (1.85×), filled
  area 5.31×.** Particles are quoted as a *range* — 4.3× to 11.5× the debris in
  the air — because a point read of `G.parts.length` is whatever the decay left
  standing on that frame, and the first version of this measurement disagreed
  with itself threefold and once reported the star shedding *less*. Averaged
  over a hundred frames it is proportional to spawn rate × lifetime, which is
  the number that means something; the spread is the game's unseeded
  `Math.random`, not the effect.

The musical orbs join the spawn rotation after the intro curriculum
(shield → slow-mo → nova) has run, each named by a first-encounter hint.
On level 2 and up the FIRST placement after the curriculum is the
hypernova, guaranteed, once per run — at a 10% roll the marquee item was
optional content again (a 6000-point run met zero), which is the exact
disease the curriculum exists to cure. The shield-pity rule is unchanged:
never more than three placements without one.

### THE BASS BOMB IS REMOVED

Owner's call, after a full review of the seven
orbs. The review's finding made the case: the orb's entire named
identity — "drops the low end" — lived in the audio channel, and its visual
tell (the subwoofer cone slamming on the beat) rode `G.beat`, which only moves
when the audio scheduler feeds it, so for a muted player the sprite sat
motionless and the pickup was a cyan flash. What remained with sound off was
strictly a weaker nova: the same `novaConvert` pipeline over a third of the
board instead of all of it, with no invulnerability, at the same rotation odds.
Its clear region — a ±60° wedge across every ring — was never drawn, so the
`LONG FUSE` upgrade widened an invisible number. Two orbs occupying one job,
one of them inferior and illegible, is one orb too many; the nova keeps the
job. `LONG FUSE` goes with it, leaving seven upgrade tiles, and the bomb's
0.15 share of the spawn roll is redistributed proportionally across the
remaining five — the magnetar's precedent, both times: removal changes what
can appear, not how often the others appear relative to each other.

### THE SPOTLIGHT FINALLY LIGHTS THE STAGE

The same review found the
spotlight's active state changed zero arena pixels for its whole nine-to-
fourteen seconds: the entire inventory was an audio mix move (instrument
×1.5, pad to 0.8 — about −1.9dB on one layer, at the edge of a phone
speaker's JND) plus a text chip that only drew on tall viewports, and the
one universal effect — stars paying double — printed the UNDOUBLED number
in its popup. The owner's brief asked for an actual spotlight, so it has
one now: the house dims under the arena (the drum break's own veil at
0.22 against its 0.30 — every gameplay object draws above it, because a
dimmed board would be a difficulty change and a dimmed sky is staging), a
followspot beam and a pool of light track the comet (beam 0.09 flat/0.15
at beat peak at the comet, pool centre 0.14/0.22 — flat terms first, so
the state reads with the sound off, where `G.beat` never moves), and a
violet timer ring around the comet empties clockwise, blinking through
the last 1.5s — the hypernova's playtest lesson applied before a second
playtester had to teach it. The claim is true now too: the tight-tap
garnish doubles (16 against the standing states' 8), and every ember
popup prints what the score actually paid — a fix that repairs the same
lie for overdrive, hypernova and overcharge, which had all been adding
2× while printing 1×. The lesson rewords to what is countable: "the
light is on you: stars and taps pay double." Two honest shapes only: stopping just short of a shard on
your own ring (the reverse that saved you), and sweeping past a shard on the
ring you just left mid-hop (the hop that saved you). Either pays +3, a white
spark, a breath of heat and a tick of build — passing shards on other rings
in ordinary travel earns nothing, because a graze has to be a dodge or the
spark means nothing. The spark is white-blue: red stays death's alone.

### The text speaks in starlight

The playtest called the UI type "plain
and boring," and it was: flat white system sans. Headline and guidance
text now draws in the game's own light — a vertical starlight gradient
over a soft glow underlay (four offset passes; shadowBlur stays banned
per-frame; gradients are cached per style so none is built twice). The
title, tap prompts, level cards, banners, countdown, announcements,
finale instructions and teaching hints all carry it; persistent HUD lines
stay lean so the moments keep their contrast.

### Audio is optional, everywhere

The menu says it plainly: best with
sound on — never required. Muted play keeps every mechanic whole: the beat
rides the pulsing ring, the drop counts down in numerals, the break dims
the room, and the finale reads entirely by eye — every call note RIPPLES
its mark as the band plays it, and in the answer half each mark SWELLS as
the sweep bears down on it, so the tap moment is visible before it is
audible. And if WebAudio itself never comes up (a blocked context, an
ancient browser), the duet is skipped and the level completes at its
plain finish line the way it always used to — nothing about progression
ever requires a speaker.

### The finale: the star dive

The level's closing melody appears
physically — eleven stars in a tight spiral, four outer, four mid, three
inner. ONE STAR BURNS AT A TIME (playtester: "are you supposed to be
getting the stars in a certain order?" — he couldn't tell, because eleven
equally bright stars answer nothing): the constellation waits as dim
seeds, only the NEXT star burns full-size with the guide line running to
it and a fainter second segment showing the one after, and the moment a
star is taken the next visibly IGNITES with a ripple — chase-this-then-
that, read at a glance, no caption. Any star still collects out of order;
the sequence is the melody's phrasing, never a rule that punishes. The
banner says the rest: "chase the brightest star — quick chains pay
double." Gathering it is a RUSH, not a stroll (the fun pass, after the
owner's "just not that fun"): every star collected speeds the comet ~6%
and opens
the music's filter, the kit fills in as the melody comes home, and quick
consecutive pickups CHAIN for double. Each star plays the next note of a
cadence descending to the root; the core visibly wakes and the sky gilds.
The ending is always the player's own act: a dim sun-seed waits on the
inner ring and only BLOOMS — riser, gold ripple, white-gold and
unmistakable — once the melody is nearly home (or late enough that it
must). Dive into the bloomed sun to land the full chord and the braam:
all eleven gathered pays PERFECT ENDING +200, otherwise LEVEL COMPLETE
+100, and a 50-second timeout completes the level regardless. Both verbs,
zero words, and nothing ends until you choose it.
**`did_hop` is the one to watch first.** The hop is the unfamiliar half of the
control scheme, and a run ending with it false is a run where the player never
used half the game. Read against `misread_rate`: false with unresolved swipes
means the input was misread; false with no swipes at all means the lesson was
missed. Those are opposite problems and no amount of level naming or content
pacing fixes either.

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
