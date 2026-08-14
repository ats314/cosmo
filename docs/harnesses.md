# The harnesses

Every one of them runs on every pull request and must pass. Run them locally before
pushing — they are fast and need nothing installed.

```sh
node tools/all.mjs --fast   # the four quick checks, ~4s — the editing loop
node tools/all.mjs          # all seven, ~50s — before you push
```

`all.mjs` is not a seventh check and holds no list of its own. It **parses the
workflow** and runs exactly the harnesses `.github/workflows/pages.yml` runs, in
that order, so "what CI runs" and "what I ran locally" cannot disagree — the
usual way that pair rots is a list maintained in two places. Run the individual
harness while you are iterating on it; run `all.mjs` before you push.

```sh
node tools/check.mjs       # parses; elements; teaching + mode drift; repo tripwires
node tools/smoke.mjs       # loads and plays the game in a stubbed DOM
node tools/dropcheck.mjs   # the build meter still delivers beat drops
node tools/curriculum.mjs  # nothing is left untaught by level 3
node tools/musiccheck.mjs  # four levels, four songs, each in its own key
node tools/fxcheck.mjs     # the glow reaches a pixel, with a GPU and without one
node tools/drawcheck.mjs   # every 2D draw call is one a real canvas would honour
```

**Adding a harness is three edits, and `check.mjs` fails until all three are
made.** Write `tools/<name>.mjs`, add its `- run: node tools/<name>.mjs` step to
`pages.yml`, and list it in the table above. A harness that exists but is not
wired into CI is worse than no harness: it reads as coverage in the tree and
never runs on a pull request, which is the same failure class as a guard that
cannot fail. `check.mjs` compares the two sets and names whichever side is
missing.

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

`fxcheck.mjs` is the only harness that runs the RENDER path, and it is the
answer to the "not shipped until something proves it reaches a pixel" rule
below. It stubs WebGL as a RECORDING FAKE instead of removing it: shaders
compile, framebuffers complete, and it asserts on what was issued. Its most
important assertion is the uniform-name check — real WebGL returns null from
`getUniformLocation` for a name the shader does not declare, and a write
through a null location is a silent no-op, so **one typo removes an effect
from the game without failing anything else in this repo**. The fake parses
the shader source it was handed and reproduces that exactly. It also pins the
glow's draw count and its render-target ladder, checks the y-flip on upload,
drives the render-scale dial through fast/slow/fast — asserting the degrade
ladder retires the GLOW before it touches the sky's resolution, keeps the sky
itself alive as the last resort, and that the raise ignores menu frames — and
then runs the whole game again with no WebGL and fails unless the drawn-disc
fallback takes over with zero GPU calls. **Anything that touches a shader, a uniform, the glow
chain or the scale dial belongs in this harness.** All of its assertions were
mutation-tested when it was written; keep that habit — a render check that
cannot fail is worse than none, because it reads as coverage.

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

