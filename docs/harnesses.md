# The harnesses

Every one of them runs on every pull request and must pass. Run them locally before
pushing — they are fast and need nothing installed.

```sh
node tools/all.mjs --fast   # the four quick checks, ~5s — the editing loop
node tools/all.mjs          # all eight, ~110s — before you push
```

`all.mjs` is not a check of its own and holds no list of its own. It **parses the
workflow** and runs exactly the harnesses `.github/workflows/pages.yml` runs, in
that order, so "what CI runs" and "what I ran locally" cannot disagree — the
usual way that pair rots is a list maintained in two places. Run the individual
harness while you are iterating on it; run `all.mjs` before you push.

```sh
node tools/check.mjs       # parses; elements; teaching + mode drift; repo tripwires
node tools/smoke.mjs       # loads and plays the game in a stubbed DOM
node tools/dropcheck.mjs   # the build meter still delivers beat drops
node tools/curriculum.mjs  # nothing is left untaught by level 3
node tools/musiccheck.mjs  # six levels, six songs, each in its own key
node tools/fxcheck.mjs     # the glow reaches a pixel, with a GPU and without one
node tools/drawcheck.mjs   # every 2D draw call is one a real canvas would honour
node tools/rendercheck.mjs # the frame a player sees, rendered in real Chromium
```

**Adding a harness is three edits, and `check.mjs` fails until all three are
made.** Write `tools/<name>.mjs`, add its `- run: node tools/<name>.mjs` step to
`pages.yml`, and name it in the list above. A harness that exists but is not
wired into CI is worse than no harness: it reads as coverage in the tree and
never runs on a pull request, which is the same failure class as a guard that
cannot fail. `check.mjs` compares tools/ against the workflow, and separately
reads this file and fails on a harness it never names.

**That third edit went unenforced for as long as this file claimed it was
enforced, and it had already failed.** `rendercheck.mjs` — the only check in
the repository that looks at a pixel — was absent from the list above and from
`README.md`, while both documents went on saying `fxcheck.mjs` was the only
harness that runs the render path. A session with a rim or a detached halo to
test would have filed it in the harness that stubs the canvas and proved
nothing. A sentence claiming a guard exists is worse than no sentence: the
reader checks, finds the claim, and stops looking.

**This file is now the only home for harness documentation.** `README.md`
carried a second copy of it, and the second copy is what rotted — both lists
went stale in the same way at the same time. There is one list, it is the one
above, and `check.mjs` reads it.

`smoke.mjs` is the one that catches real bugs: it loads the game into a stubbed
DOM and actually plays it — the three front screens, menu demo, taps, swipes,
keyboard, minutes of simulated play, resize, tab visibility, death, retry,
level 2. Audio stays off, which exercises every audio guard.

**Two decision screens stand between the menu and a run**, and each publishes
its controls as rects from its draw pass: the swipe chooser, then the level
picker. Neither answers a tap on its background, because each is a decision, so
every harness crosses them by pressing the control it actually drew
(`passSwipeChooser`, `passLevelSelect`). The title screen answers a tap
anywhere again now the mode cards are gone, but `passMenu` presses its START
rect regardless — a helper that presses a real control keeps working when a
screen gains one, and a harness that taps a fixed point does not fail when it
meets an unexpected screen, it waits there forever. That is how the swipe
chooser broke all four harnesses when it arrived. Add a front screen and you
add a crossing helper to `smoke.mjs`, `dropcheck.mjs` and `curriculum.mjs` in
the same commit. A fourth screen, the powerup picker, sits off that route —
it opens only from the title screen's POWERUP TESTING bar — and all three
harnesses carry `passPowerSelect` anyway, returning untouched. That is not
redundancy: it was exactly true of the swipe chooser the day before it stalled
everything, and the helper costs one function. `fxcheck.mjs` crosses the front
too and needs the same treatment — it is a fourth harness on that route.
`rendercheck.mjs` is the exception and deliberately so: it drives a real browser
and calls `startGame()` outright, so it never meets a front screen and a fifth
one cannot stall it. That buys immunity at a price worth knowing — it also means
nothing in this repository ever looks at a front screen's pixels.

**Two harnesses run the render path and they see different things.**
`fxcheck.mjs` runs it against a fake and `rendercheck.mjs` runs it against a
real GPU; between them they are the answer to the "not shipped until something
proves it reaches a pixel" rule below. Which one your change belongs in is the
question this section exists to answer, and getting it wrong is silent.

`fxcheck.mjs` stubs WebGL as a RECORDING FAKE instead of removing it: shaders
compile, framebuffers complete, and it asserts on what was issued. Its most
important assertion is the uniform-name check — real WebGL returns null from
`getUniformLocation` for a name the shader does not declare, and a write
through a null location is a silent no-op, so **one typo removes an effect
from the game without failing anything else in this repo**. The fake parses
the shader source it was handed and reproduces that exactly. It also pins the
glow's draw count and its render-target ladder, checks the y-flip on upload,
drives ten seconds of 25fps frames and asserts that NOTHING degrades — the
glow still on, the sky still on, the resolution unmoved — because the degrade
ladder was deleted and a device in trouble now drops frames rather than getting
a different game; it also fails if glWatch or GL.scale ever come back. Then it
runs the whole game again with no WebGL and fails unless the drawn-disc
fallback takes over with zero GPU calls. **Anything that touches a shader, a
uniform, the glow chain or the scale dial belongs in this harness** — as long as
what you are asserting is that a call was ISSUED with the right arguments.

It also owns **the sky as a set rather than as a picture**. It reads `WORLDS`
out of `index.html` instead of copying it, validates the properties that keep
the set closed (weights summing to 1, a coverage weight that can only raise
the never-black floor, exponents >= 1 because `pow(0.0,0.0)` is undefined),
and sweeps all six worlds plus three points along every morph between
neighbours over the full drift orbit, pinning both directions of the luminance
band. Sampling only the midpoint of a morph is not enough and that is
measured, not cautious: the first cut found a transition at 0.238 mean against
0.166 and 0.164 at its two ends. It asks the **where does it end up** question
of both frame conversions the orbit coupling needs — the spin's sample
rotation and the lap sector's y-down-to-y-up flip — by running the parsed
transforms, and it drives the real game to prove a lap streak reaches the
uniform rather than only the variable behind it. The fake records uniform
*values* as well as names, which is what makes that last check possible.
A harness note worth keeping: a fake that is MISSING a call does not fail the
check it is missing. It had no `uniform4f`, the backdrop's first vec4 write
threw into `glRender`'s catch, and the reported failure was "the backdrop
shader did not come up against a working GL" — a plausible message, about the
wrong thing. When a render assertion fails in a way that does not match the
change you made, suspect the fake before the game.

**`rendercheck.mjs` is the only harness that looks at a PIXEL, and it is the
eighth check rather than a spare.** Every other harness in this file — fxcheck
included — runs on a stubbed canvas, so `drawImage` at the wrong translate is
indistinguishable from `drawImage` at the right one: same call, same finite
arguments, same count. That blind spot shipped a hairline rim down every screen
edge, every halo oscillating off its own light, and six world palettes buried
into three, with every other check green. So this one launches real Chromium,
runs the real shader under SwiftShader, and asserts on the framebuffer: the
outer columns against the interior (the rim), the glow's light against the
disc-halo's (the composite), and the six worlds' hues against each other (the
palettes). **If your assertion is about how the frame LOOKS rather than which
call was made, it belongs here and fxcheck cannot host it.**

It is the one harness with a dependency — Chromium and the playwright package,
both installed by the workflow — and the reason it runs last. It SKIPS when it
cannot find a browser, which is right on a developer's machine and fatal in the
build, so it fails rather than skips under CI and `check.mjs` fails if the
install step ever leaves the workflow. A check that can quietly not run is not
a check.

`musiccheck.mjs` is the only harness that runs the arrangement. `smoke.mjs`
removes WebAudio deliberately and `dropcheck.mjs` never drives past level 2, so
before it existed the per-level songs had no coverage: deleting level 4's riff
and solo rows left all four other checks green and crashed the browser. It
stubs WebAudio instead of removing it and asserts on what was actually
scheduled. **Anything that touches `PROG`, the hooks, the per-level basslines
or kits, or any pitch in the audio path belongs in this harness** — a musical
regression is otherwise invisible to CI by construction.

**The harnesses are deterministic, and the seed is how.** Each one drives the
game through a seeded `Math.random` injected at the sandbox boundary
(`tools/lib/rng.mjs`) — `index.html` is untouched by this. A local run replays
the same game every time, so a changed number IS your diff and the old ritual
of re-running several times before believing anything is retired. CI rotates
the seed per run so coverage keeps moving, and every harness that runs the game
prints its seed on the way in — before any assertion can exit — so reproducing a
CI failure is `SEED=<n> node tools/<harness>.mjs`. (`check.mjs` is the exception
and needs no seed: it is static and touches no RNG.)

---

## What each harness actually asserts, and why

The routing above tells you which harness a change belongs in. This is the
record of what each one covers and which specific bug bought each assertion —
moved here from `README.md`, which had grown a second copy of it.

`check.mjs` confirms the inline script still parses, that the elements it
looks up by ID are still in the document, and that the teaching tables have
not gone stale — no lesson pointing at a cut orb, no tier unlocking after
level 3's finish line, and no mode knob that is declared without being read or
that lets SKILL stop being the identity. `smoke.mjs` goes further: it loads the
game into a stubbed DOM and actually plays it — the front screens, the
menu demo, taps, committed and aborted swipes, the keyboard, several simulated
minutes of a run, a landscape resize, a tab background/foreground, a death, the
death screen's fast-forward tap and a retry, a level-2 start and its retry card,
the level ladder's agreement with the FURTHEST YET badge, every difficulty term
measured in both modes at the same difficulty second, and the guard that stops a
picked starting level forging a level record — asserting the state machine comes
through each transition intact. No browser, no dependencies; audio stays off,
which also exercises every audio guard.

It also runs the POWERUP TESTING lab, which needs proving in two opposite
directions. That it *does* something: all six orbs are run for 45 simulated
seconds each and each lab must place its own orb and nothing else, at a
measured cadence. And that it *leaves nothing behind*: `localStorage` is
**cleared**, then a whole session is played — entry, hops, taps, orbs taken, a
forced death with every record set so that it would move if it could — and any
key that reappears fails the build. Clearing rather than diffing is the point,
and it was learned the hard way: the first version snapshotted a store the
earlier tests had already filled, so three leaked writes wrote `'1'` over `'1'`
and the comparison saw nothing. A lab session must be unable to *create* a key,
not merely unable to change one. `check.mjs` carries a tripwire on the set of
persisted keys for the two write sites smoke cannot reach at all — both return
immediately without WebAudio, which smoke removes by design. The lab's two screens are also measured on
eight viewports for rects that run off the screen, overlap each other, or fall
below a pressable height — the canvas is stubbed so no pixel can be checked,
but every control publishes a rect from its own draw pass, and geometry can
be. The first draft of the picker failed that on both landscape phones by
drawing its last orb through the ghost switch. `dropcheck.mjs` re-runs that harness
with a stubbed AudioContext and fails if the build meter stops delivering beat
drops at a playable cadence. `curriculum.mjs` plays a whole run headlessly and
fails if level 3 ever opens with a mechanic the player was never shown.

`musiccheck.mjs` is the one that runs the *arrangement*. The other four never
did: `smoke.mjs` removes WebAudio on purpose, which is how it proves every
audio path is guarded, and `dropcheck.mjs` — the only audio-on harness — never
drives past level 2. The consequence was that the per-level songs had no
coverage at all. Deleting level 4's riff and solo rows outright left all four
checks green while crashing the real game on level 4 with an undefined index.

So this one stubs WebAudio rather than removing it, drives the real scheduler
at every level, and asserts what came out: that each level's pad voices *its*
chords and nothing else, that the progressions are distinct shapes
rather than one transposed, that the four payoff hooks are four distinct tunes
sharing one rhythmic signature, that the response bars stay silent, that level
4 has a bassline and a kit of its own, that no pad voice glides more than an
octave between chords (the pad portamentos, so a chord that leaps is a chord
you hear swoop), and that every pitch in the drop, the snare body and the tom
fill is diatonic to the key actually playing. It also pins level 1: its snare
is still 196Hz and its drop still within a cent of what shipped.

The chorus doubled what it holds. Cold play must voice the verse row exactly
(which is also the proof the lift cannot trigger itself), hot play must lift
at a four-bar seam no earlier than bar 8 and then hold the chorus *walk* —
the row read through its rotation, asserted in order, because the L2 chorus
is the verse's own chords walked the other way and a pitch-set comparison
cannot see order. Both tables are held to one law: chord 0 is the i chord
(the tonic anchor twenty-five `CH[0][0]` readers rely on), every pitch
diatonic, every chorus seventh a genuine stacked third, every glide — the
section seams included — inside an octave, and the chorus arps under the same
784Hz ceiling as the verse's. The color-tone assertion matches on sustain as
well as pitch: the counter-line lands on the same frequency by pentatonic
arithmetic, and a first version of the check counted it, so deleting the
color line stayed green until the check learned to read note length.
The harness also runs each level at its sky-band floor — the game pins
`skyI` to `G.level-1`, and a harness that left the sky at band 0 could not
hear the first chorus lean stack its backbeat straight onto sky band 3's,
which is exactly how a doubled level-4 snare shipped. It now fails on any
slot carrying two snare bodies, asserts the star dive's first bar opens on
the verse chord (the section revert has to reach the oscillators, not just
the tables), and holds `chorus_bars` still through a black hole and a
payoff, where the section flag is frozen but the chorus is not sounding.

`fxcheck.mjs` is the first of two that run the *render* path, and it exists for
the same reason `musiccheck.mjs` does: every other harness stubs the canvas and
WebGL away, so the entire draw layer was uncovered by construction. That is not
a theoretical gap — it is how thirteen black hole features shipped with one of
them perceptible.

So this one stubs WebGL as a *recording fake* rather than removing it. Shaders
compile, programs link, framebuffers complete, and every call is written down;
then it asserts on what was actually issued. The most valuable assertion by
far is the uniform-name check. In real WebGL `getUniformLocation` returns null
for a name the shader does not declare, and `uniform1f(null, x)` is a silent
no-op — so a single typo does not throw, does not warn, and fails no other
check in this repo. It just quietly removes an effect from the game. The fake
reproduces that exactly, parsing the uniform declarations out of the shader
source it was handed and returning null for anything else, and the harness
fails if any location came back null or any write went to one.

It also holds the glow to eight GPU draws a frame (one backdrop, six blur, one
composite), pins the render-target ladder to ¼–¼–⅛–⅛–¹⁄₁₆–¹⁄₁₆ so nobody
collapses the chained downsample back into one aliasing 4:1 read, and checks
that the bright buffer is uploaded with `UNPACK_FLIP_Y_WEBGL` — a canvas
counts rows down and a framebuffer counts them up, so flipping in neither
place or in both renders the glow upside down, which nothing else here could
notice. It drives the render-scale dial through a fast stretch, a slow one and
a fast one again, and fails if the ceiling does not latch. Then it runs the
whole game a second time with no WebGL at all and fails unless the drawn-disc
halo takes over and not one GPU call is issued — a fallback nobody runs is a
fallback nobody knows is broken.

Two more assertions came out of review, both for defects the harness as first
written could not see. It parses the lens coefficients out of the shader
source, asks where a light at a given radius actually lands, and fails unless
the answer is closer to the middle — the sign of an inverse-sampled
displacement is the opposite of what it looks like, and reading has now failed
to catch that same inversion three times in this file. And it takes the
context away mid-run, failing unless the glow stands down and the discs take
back over.

All seven assertions were mutation-tested: renaming a uniform, deleting the
y-flip, collapsing the downsample chain, removing the scale raise, removing
the ceiling latch, flipping the lens sign and removing the lost-context guard
each fail the harness with the right message. The first attempt at that last
mutation silently failed to apply — the regex missed a character — and the
harness "passed", which is its own lesson about mutation tests: confirm the
mutation landed before believing the result.

`rendercheck.mjs` is the eighth check, and everything above it — `fxcheck.mjs`
included — is blind to the thing it exists for. A recording fake can prove a
call was issued with finite arguments in the right order. It cannot prove the
frame is not ruined, because `drawImage` at the wrong translate is the same
call, with the same finite arguments, in the same order. That gap is not
hypothetical: a build reached real playtesters carrying a hairline rim down
every screen edge, every halo oscillating off its own light, and six world
palettes collapsed into three, with every other check green and the merge
taking seconds.

So this one launches real Chromium, runs the real backdrop shader under
SwiftShader — `GL.on` comes up true, so it is the shipped path and not the 2D
fallback — and reads the framebuffer back. Three measurements, one per defect
that got out: the outer screen columns against the interior, which catches a
rim; the glow's light against the disc-halo's, which catches a composite in the
wrong coordinate space; and the six worlds' hues against each other, which
catches a palette buried by a white highlight. It samples each world in its own
page load, because screenshotting several in one leaves the previous world's
pixels in the frame.

It is the only harness with a dependency, which is why it runs last and why the
workflow installs both halves — the browser and the playwright package. Miss
either and it cannot drive anything. It SKIPS rather than fails when no browser
is present, which is correct on a developer's machine and would be fatal in the
build, so under CI it fails instead, and `check.mjs` fails if the install step
ever leaves the workflow: the only check in this repository that can see a
pixel must not be able to quietly stop running.
