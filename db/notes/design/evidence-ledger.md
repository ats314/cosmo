# What actually settled each argument

*What this answers: which playtest quotes, owner calls and measurements are the
evidence behind Cosmo's design decisions, so a later session can tell an
authored constraint from a remembered preference.*

The design record is unusual in that almost every decision names its evidence.
This is the index. Quotes are as the documents record them.

## Owner calls (these outrank agent judgement)

| Call | What it decided |
|---|---|
| *"complete overhaul from the ground up"* | The six-level curriculum rebuild: DIVERS into level 4, THE NARROWS into level 5, THE EYE to dl 610. |
| *"Magnetar just broke the screen again. Remove that mechanic entirely. You can't fix it."* | Magnetar and `WIDE PULL` deleted; `check.mjs` enforces the *absence* of a free radius rather than its synchronisation. |
| One mode until the game is perfected | CHILL retired, `MODES` kept at the identity row with all its guards armed. |
| *"the backgrounds are too similar, not lively enough, not fun and exciting, not integrated with gameplay"* | The eight-world `WORLDS` table; worlds differ in structure, not palette. |
| *"many people have complained they didnt even know they were supposed to do orbits"* | Orbits buy the journey (`ORB_PER_WORLD = 7`); the lap sector; the orbit lesson. |
| *"players should want to get orbits, and they should be rewarded with a cool background change"* | Same decision, stated from the reward side. |
| *"if someones phone cant handle my game, they cant fucking play it, end of story"* / *"a struggling device should struggle"* | The GPU degrade ladder deleted; `GL_SCALE` is a constant. |
| *"we don't even need passwords"* | Bearer-key accounts, no email, no reset flow. |
| *"the hardest mechanics should be reserved for level 3 teaching, that will allow more time to learn"* | The two compounds moved from level 2 to level 3. |
| *"just make the first and second level longer if needed"* | Finish lines at dl 90 and 215 (were 75/190). |
| *"balance power up introduction, mechanics, and difficulty all the way [to] level 4"* | Spotlight/Magnet moved to level 3; mirror to 4; scorch to 5. |
| *"There is often tutorial language that makes no logical sense to the way red things and gameplay work."* | The teaching audit: five channels corrected, one mechanic changed to meet its sentence. |
| *"it makes no sense and I'm not getting the feeling you actually understand why"* | The twin lesson's third and final wording, and the generalised rule about aimed movement. |
| The red ban lifted, against a stated risk | `SKY_ARENA_CALM` replaces a hue ban with a contrast rule in the orbit annulus. |
| Level 6's finish line is not required to stay absent | `end:Infinity` is a content frontier, not an endless-mode rule. |

## Playtest quotes that changed code

| Quote | Change |
|---|---|
| *"the game feels exactly like 50 different agents have worked on it … 'ai made this'"* | The house style: one name per thing, one counter idiom (`×N` multiplier vs `· N` count), one colour per meaning with a closed list. |
| *"I wonder if the orbits were stretched out more to an oval shape vertically"* | The elliptical arena (`ARENA_STRETCH = 0.75`, `ARENA_MAX_Y = 1.55`); on a 390×844 phone 110 px a side was going unused. |
| *"can you make it so slide up always changes to outer ring and down to inner? i think that's what my brain wants"* | Two swipe rules, asked once on a screen where both can be felt; `swipeOut()` is the only place either is expressed. |
| *"feels like you can just tap randomly and get chains"* | The timing chain climbs on the quarter, not on any sixteenth. |
| *"way too twinkly"* | The ember pickup got heavier instead of brighter — fat detuned pluck with a sub octave, kick thump from ×2. |
| *"I don't feel the game being harmonious with my movements… general music theory is off"* | Everything the player triggers resolves through `chTone()` against the sounding chord, not a fixed pentatonic. |
| *"still way too sparkly and twinkling"* | The subtraction-and-transposition pass: everything down an octave, two layers deleted, hats bandpassed to 4–7 kHz, a dark room. |
| *"the drop hits — literally nothing else does"* | Ordinary play got the drop's production values; measured p95 −17.2 → −13.9 dBFS. |
| *"the music is THE key — front load it"* | Full band inside ~2.5 minutes instead of ~6. |
| *"once a player reaches 2000 points add a new electro synth layer…"* | `LAYER_AT = [600, 1400, 2400, 3600]` (moved down to rewards people reach). |
| *"tailor the electro to be more cinematic — like it's in a movie"* | The string swell and noise riser, both far wetter into the reverb than anything else. |
| *"I'm too focused to read the text… if a sound always accompanied that text"* | Three cues with fixed meanings: unlock call, lesson chime, state shimmer. |
| *"combos are never explained, timing beats is never explained… some of the best parts of the game are never used by new players"* | The musical curriculum: four soft lessons fired at first contact with each system. |
| *"initially I felt like there were like eight rules"* | Level 1's card carries three rows, not six; one sentence per idea across banner, lesson and death coach. |
| *"are you supposed to be getting the stars in a certain order at that part?"* | One finale star burns at a time, with a guide line to the next and a fainter segment to the one after. |
| *"it seems to turn them all into stars but place them in a single orbit… stacks them on top of each other"* | A converted wall fans into a necklace along the lane. |
| *"I just feel like I end up just banging back and forth… and it sort of feels like I'm cheating"* | THE SAUCER, and the heading-aware clearance that fills in the arc behind the player. |
| *"I know that's getting tricky and could lead to some 'there's no way to escape getting hit' moments"* (the saucer's proposer, about his own idea) | The saucer's body is never solid; only its shot is. |
| *"It's not a power up. It's something you hit in orbit and trigger. It's a rare mode. And it's optional… It actually does things to make it both harder and easier simultaneously."* | The black hole's whole shape. |
| *"if you're at full [shields]…"* (playtester-designed) | Overcharge: stars and on-beat taps pay double, overflow shields pay +50. |
| *"the playtest group asked for 'a star in Mario'"* | Hypernova is drawn plainly as a star — in magenta, because gold means "collect me". |
| *"a distant star flares"* had never been reported by anyone | Flares were placed on a circle in uv units; 77% fired off-screen on a phone. |
| *"nothing but some purple color"* | The black-hole audit: thirteen sub-features, one perceivable. |
| *"looks good for the opening and then 5 seconds in, it changes to the old shit"* | The degrade ladder deleted. |
| *"it's like you put a layer over the screen"* / *"everything just kind of wobbles around"* | The 1.82× edge pileup and the crawling halo; both invisible to seven harnesses, which is why `rendercheck.mjs` exists. |
| *"I didn't get the level ending mechanic at all"* | The finale gets a full banner with reading time, the stage clears, and a standing instruction line. |
| *"I just think clearing the board using level tiers might be more rewarding… reaching level 'XYZ' seems more memorable"* | The level ordinal is printed under the score, leads the death screen and the share text, and persists as `cometloop:gl`. |

## Measurements that decided a number

- `MASTER = 2.15`: the original layer peaked at **0.138** on the busiest moment,
  so ~86% of headroom was unused. 2.6 put a nova cascade three samples over full
  scale; 2.15 peaks at 0.93 with the limiter barely working.
- Section share, six minutes of natural play, level 1: **33/26/41** verse /
  chorus / payoff at a mean gap of **34.6 s** — and 34.6 s is `PAYLEN + PAYREST`
  plus the rise, i.e. the meter was full every time the cooldown lifted. After:
  **43/30/27 at 56.3 s**; level 4 54/19/27 at 58.0 s; level 6 55/29/16 at
  65.8 s.
- Drop escalation: the unclamped +0.8-per-drop curve crossed the meter's 2.9 cap
  at the fourth drop, so **420 s of strong play armed exactly three**. Clamped at
  2.75.
- Chorus collapse after making drops rarer: chorus bars **26% → 10%**, verse
  **→ 62%**.
- Twin timing: across 300 simulated runs per setting, pulling TWIN from dl 30 to
  15 moved median survival **less than 2%** (814 s → 822 s), left forced inputs
  per minute flat at 74, and killed nobody in the first 60 s.
- Density saturation: mean live shards **8.42 / 9.19 / 9.23** on levels 4/5/6
  over 100 s each — a 10% rise across two whole levels, so raising the cap buys
  nothing.
- Live-board mean shape rank before: L3 1.39, L4 1.72, **L5 1.33**, L6 1.51.
  After: 1.42 / 1.71 / 1.79 / 1.68.
- Twins were **62–65%** of everything standing on levels 5 and 6 against 44% on
  level 3.
- The camper: five fifteen-minute level-4 runs without a scratch inside 1.3 rad.
  After the heading-aware clearance, **5/5 survived → 3/5**, while a travelling
  bot's median moved 54.4 s → 52.4 s and board density 9.1 → 8.8.
- Bloom reach ×3.6 (ember 15 → 54 px, comet 22 → 78 px on a 390×844 phone,
  measured to 1/255 over a full circle in sub-pixel steps).
- Edge pileup **1.82×** the physical level at the border; corrected to 0.55×.
- World luminance correlation r = **0.97** between DRIFT and DUSTLANE, mean 0.77
  across fifteen pairs; after the per-world fields, max pair 0.65, mean 0.21, and
  edge/middle brightness 2.76× → 1.05×.
- Sky blackout: whole-screen nebula blackouts lasting 10+ minutes, found from
  two same-build screenshots four hours apart.
- Journey: 120 s of never reversing bought 27 orbits (3.86 worlds) and delivered
  **0.83**. After: 2.27 worlds/min never reversing, 1.18 reversing every three
  seconds, 0.84 every six.
- Quantising to the nearest sixteenth halves the worst case: **61 ms** measured
  across a flurry of twelve off-grid taps, against up to a full 144 ms slot.
- Held Space auto-repeat pinned the comet inside **0.23 rad** — about thirteen
  degrees — for a whole run, measured over three runs.
- Hypernova ribbon: trail samples 29 → 53, arc 143 → 428 px, widest point
  15 → 28 px, filled area 5.31×. *(The five-pass white ribbon has since been
  replaced by three source-over passes with alpha compensated for width — see
  the effects audit.)*
- Telemetry: **three** `blackhole_entered` events in the game's entire recorded
  history, all on level 4. That single number justifies both the lab and the
  level-4 guarantee.

## What is explicitly *not* evidence

`docs/design/direction.md` and `CLAUDE.md` both say it: automated measurements
do not establish that an effect is exciting, and the owner leads taste
decisions. `fxcheck` asserts what was issued, `drawcheck` that the calls are
ones a real canvas would honour, `rendercheck` that the pixels are right — none
of them says the game feels good. Where a decision rests on a brightness average
the record says so, and `docs/invariants.md` states the rule directly: *neither
a fake context nor a brightness average establishes visual quality.*
