# Effects audit: replace flashes with readable actions

September 7, 2026. This records the flash sources found in the runtime at
`f13d7c6` and in the subsequent unpublished working revisions, including the
added shader and motion responses. It records their replacements in the
current effects revision. Source names below refer to
[the canonical runtime](../../src/game/runtime.js).
The [current direction](direction.md) governs future effects.

The problem was cumulative: music, pickups, damage, particles and scenery
could each increase light independently. A single event could activate several
of them. Making one overlay weaker did not remove the other outlets. This
revision removes broad flashes and repeated brightness impulses from the
default presentation. It preserves the living world, steady material lighting,
movement, sound and the actual reward or warning each effect represents.

## The shared white flash and the independent death frame

`flashHit(v)` fed a white rectangle across the whole viewport at alpha
`G.flash * 0.5`. Its 0.45-second gate applied only when `v < 0.5`; larger
requests bypassed it. There were **nine call sites**, despite the old comment
claiming seven systems. The values below are requested amplitudes, not the
final rectangle opacity.

| Call path and trigger | Old purpose and problem | Replacement and retained behavior |
|---|---|---|
| `musicStep`: drum-break ending, `0.18` | Mark the returning downbeat; imposed a screen flash on a musical transition. | The arrangement and percussion announce the return. Moving phase cues remain; no white rectangle. |
| `bedTick`: consume audible `DROPQ` release, `0.34` | Make Starfall start feel large; stacked global white, per-ring ripples and a fat shock ring over the reward. | The audible onset starts the real bonus. Three gold-star flights arrive from the planet, and material contours travel through the world. |
| `levelComplete`, `0.6` | Punctuate success; broad flash duplicated the completion sound, score and transition. | Completion audio, score report and the between-level state carry success. |
| `updateSpikes`: shield absorbs a threat, `0.28` | Explain the saved collision; washed out the position that mattered. | Local contact debris and contour, the shield count, sound and protection outline explain the save. Shield consumption and collision grace remain. |
| `update`: finale sun with all stars, `0.55` | Distinguish the full reward; flashed alongside the finale presentation. | The all-stars label and extra score distinguish the result. |
| `update`: ordinary finale sun, `0.4` | Mark level completion; added another broad brightness change. | The collected sun, completion sound and result state supply the ending. |
| `update`: Overdrive activation, `0.2` | Announce doubled rewards; generic flash did not explain the power. | Named status, changed musical arrangement and visible rewards explain the active mode. |
| `update`: Hypernova pickup, `0.5` | Sell the protected charge; stacked white core, broad ribbon and global flash. | Comet fins, an extended moving wake, power status and sound identify the charge. Damage immunity and protected landing remain. |
| `update`: Nova pickup, `0.55` | Announce conversion; broad white hid the expanding front and new stars. | An open segmented contour follows the actual conversion radius. Converted stars materialize where threats were removed. |

All nine global-white outlets are removed. The old call gate is not the new
policy: unrelated systems must not recreate the same flash elsewhere.

Death had a **separate** full-screen impact frame. `die()` set a 0.13-second
impact interval; `draw` filled near-white at
`0.92 * min(1, G.impactT / 0.10)` and put the killer silhouette over it.
That could reach 92% opacity and did not pass through `flashHit`. The full-screen
frame is removed. Comet breakup, the collision location, sound, death coach and
result state communicate the loss.

## Music, the comet and collectible light

| Source | Original reason and failure | Current outlet; what remains |
|---|---|---|
| `BEATQ` → `G.beat = 1` | Make the audible beat visible. At 104 BPM, payoff eighth-note timestamps can arrive at about **3.47 per second**. The shared impulse affected several render systems together. | Timestamp consumption and audio scheduling remain. Visual beat cues use a steadily moving phase marker; consuming a beat no longer adds a shared brightness impulse. This is a source trigger cadence, not a measured display flash frequency. |
| `drawBloom` and `drawRingGlow` | Payoff beat raised shared bloom by up to **45%** and ring-light alpha by **30%**, amplifying the same impulse across much of the composition. | Bloom and rim illumination have stable gain. Their size, buffers and steady sprite lighting still establish depth and object identity. |
| Furnace and Hypernova `FLK` | A 16-value random table sampled **24 times per second** gave the comet an unstable furnace and white-hot power core. Independent random gain made continuing flight flicker. | Stable core light, fins and moving wakes communicate heat and power. Hypernova uses the same three source-over ribbon passes with alpha compensated for width, instead of a five-pass white boost. The sample rate is not a claim of 24 complete light/dark cycles. |
| Invulnerability palette | `0.45 + 0.35*sin(G.t*30)` varied comet opacity from 0.10 to 0.80: **30 radians/second**, about **4.77 cycles/second**. It made the player and glow blink during an already demanding recovery. | The comet stays visible. A steady protection outline fades with remaining protection time; collision grace is unchanged. The old outline's `sin(G.t*16)` size oscillation is also gone. |
| `artifactStar` / `artifactPower` | Beat size kicks and sharply gated sine glints (`2.5` and `2.2` radians/second respectively) made every collectible repeatedly call attention to itself. Several objects could glint at once. | Fixed scale, slight orientation motion and steady rim lighting retain material identity. Gold stars, power colors and glyphs do the recognition work. |
| Nova newborn star | A white condensing point tried to explain the instant threat-to-star conversion, but repeated across every converted threat. | A **0.45-second** star materialization shows the new object without the white birth glint. Position and collectibility still come from the actual conversion. |

## Background, atmosphere and musical pressure

These changes apply to the WebGL path and its canvas fallback. The eight
procedural worlds remain active on both menu and play. Unmarked alpha textures
add material detail; opaque world plates do not replace the living scene.

| Source | Original reason and failure | Current outlet; what remains |
|---|---|---|
| Scene-event gain | Event multipliers reached **1.6×** for nebula, **3.4×** for rings and **3.6×** for corona. Several large surfaces brightened for one pickup or reward. | Events deform rings, move material and slowly redistribute hue. Those light-gain multipliers are removed. |
| Musical atmosphere and wisp | Music added up to **17%** to wisp gain and **7%** to atmosphere width; event width added **55%**. A beat could change the apparent luminous area as well as brightness. | Musical phase supplies continuous angular sway and material placement. Atmosphere width no longer pumps with the beat or scene envelope. |
| Planet sunrise, limb and aurora | Event-dependent additive lighting tried to make orbit pressure and release visible; it duplicated the corona and nebula response. | Actual star-fed orbit charge changes ring geometry and surface longitude. Auroral patterns redistribute existing material color; the planet's steady shaded volume and lit limb remain. |
| Starfall pressure waves | Broad warm light fronts made three earned releases resemble repeated scene flashes. | The same real reward timing drives traveling coordinate contours and ring deformation. Warm hue arrives gradually; physical gold-star waves provide the payoff. |
| Scorch | Additive warm illumination could brighten much of the field for a continuing power. | A local burning wake and material hue change explain the traveled route. Magnet bends streams; committed turns and successful hops redirect persistent currents. |
| Background stars / Hyper travel | Sine twinkle and unnormalized stretched stars made continuous scenery add its own light variation. | Stable star intensity, depth motion and stretch normalized by its length retain movement without a brightness kick. |
| Black-hole scene | Collapse needs a changed gravitational state, but beat-driven light would obscure the sustained wager. | One eased entry/exit darkening, inward deformation and flowing accretion remain. Charge arc, escape countdown and actual gravity explain the state. The periodic whole-inner-ring warning is replaced by two inward-moving chevrons near the comet at fixed alpha. |
| `scenePulse` / `sceneAccent` | Short attacks and repeated same-kind retriggers could restart light responses before the previous one settled. | A minimum 2.4-second event span, 0.9-second eased entry and 1.2-second eased exit govern material responses. An active same-kind event is not restarted; lower priorities cannot interrupt higher ones. Black hole retains priority. |

`materialHue` preserves the shader's existing weighted RGB light value before
tone mapping while changing color. That is an implementation bound, not a
claim of constant measured display luminance. Spatial motion can naturally
move a lit surface through a pixel; removing beat gain does not freeze the art.

## Local effects, warnings and interface

| Source | Original reason and failure | Replacement and retained mechanic |
|---|---|---|
| Nova front | A filled or heavily additive blast announced clearance but covered the threats being converted. | Ten broken contour segments follow the actual front, with short radial tails and normal compositing. Conversion timing is unchanged. |
| Completed lap | Lighting an entire orbit duplicated score, music and world pressure on every completion. | One short gold marker travels the completed orbit. The lap still pays, advances the journey and charges Starfall when star-fed. |
| Ripples and impact rings | Fat rings and additive centers could accumulate into an unearned white patch. | Contact marks move apart along the affected lane; impact rings use three open segments. `impactHalo` uses two capped, source-over arcs with an empty center. |
| Particles / pickup impacts | Additive streaks, white cores and overlapping disks made ordinary bursts sum toward white. | Source-over faceted debris follows its velocity. Pickup casing fragments curve outward; orbit, Nova and Starfall do not add redundant generic impact layers. |
| Shutters (formerly Blinkers) | Bright/dark switching tried to teach the lethal cycle but made visibility itself ambiguous. | The safe state is a visibly open shutter at stable alpha; the lethal state is a solid shard. Closure follows the real armed-state clock, so the collision rule remains honest. Shutter pairs retain their strictly alternating openings. |
| Gates / Narrows | Pulsing bars and beat-lit brackets made warnings compete with the player. | Stable bars show blocked spans, continuously moving rungs show the powered wall, and fixed brackets identify the actual gap. |
| Divers / saucers | Bright warning beats announced a crossing or shot without explaining its destination. | A visible route, destination chevron and charge facets show the next action. Diver warning progression and saucer charge still advance with the actual scheduled event. |
| Shield / pause HUD | Oscillating emphasis repeatedly asked the player to look away from the route. | Fixed icon brightness, filled shield slots and clear counts show availability. Pause is a steady control. |
| Finale | Beat-driven size and light made the ending add another repeated pulse source. | Fixed star scale and steady rings; growth follows actual collected finale progress. The final sun and score remain distinct. |
| Tutorial / first encounter | A full-field dark veil plus bright specimen ring caused a large contrast change whenever a lesson appeared. | One instruction and a steady local bracket identify the specimen. Entry/exit fades and any teaching slowdown remain; the repeated full-field lesson veil is removed. |
| Starfall status | A long central announcement obscured the very reward it described. | A brief 1.6-second introduction yields to compact header status while the real stars arrive. |
| Pause, results and level transition | Darkening separates a non-playing state and prevents studying a live board while paused. | Retained as state transitions, not rhythmic effects. Ordinary lifecycle fades, stable sprite glow and steady material highlights also remain. |

## Verification boundary

Source inspection confirmed the nine shared-flash call paths and the separate
death overlay. Local documentation links resolve and the documentation diff
passes the whitespace check. Live publication remains a separate release step.

Functional checks protect timing, collision geometry, event priority, finite
draw calls and rendering fallback. Source inspection identifies independent
gain paths; a brightness average alone cannot establish that an effect is
appropriate. The defaults above do not depend on enabling reduced motion.
Reduced motion remains an additional preference for movement. This audit is
an engineering and design record, not medical advice or a photosensitivity
certification.
