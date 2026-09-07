# The harnesses

Install the project dependencies with npm ci. The full suite type-checks and
builds the Phaser application once, then runs the harnesses listed in
.github/workflows/pages.yml. The fast lane checks source without rebuilding.

```sh
node tools/all.mjs --fast
node tools/all.mjs
```

For a single browser integration run, build first with npm run build, then run
node tools/enginecheck.mjs. Chromium and Playwright are required for the browser
checks. CI installs both; a missing dependency fails in CI and produces an
explicit local skip. COSMO_CHROME selects a local Chromium executable.

| Harness | What belongs here |
|---|---|
| check.mjs | Runtime syntax, required DOM elements, teaching and mode data, mechanic ledger, harness wiring, documentation constants, and public/dist exclusions. |
| smoke.mjs | Input, playable introduction, simulation, all powerups, black-hole decisions, pause, records, lab isolation, and responsive hit rectangles. |
| dropcheck.mjs | Starfall charge sources, audible onset, actual star collection, three timed waves, hazard clearing, pause/BH suspension, retry reset, and repeated releases. |
| curriculum.mjs | A played run through progression and honest ordered introductions. |
| musiccheck.mjs | Per-level arrangements and keys, scheduled pitch/voice behavior, player melody, and musical transitions. |
| fxcheck.mjs | Recorded GPU calls, uniform names and values, world morphs, scene-event priority, lens direction, render scales, and context-loss fallback. |
| drawcheck.mjs | Valid Canvas calls, finite geometry, legal colors and alpha, and balanced drawing state across gameplay and layout states. |
| rendercheck.mjs | Actual shader pixels: screen seams, glow alignment/energy, eight world compositions, event contrast, and the Canvas fallback. |
| enginecheck.mjs | The actual built Phaser app: boot, LAUNCH, pointer reversal, touch ring change, resize, one active scene, and one host-owned loop. |
| flightcheck.mjs | Original gameplay/input/audio function hashes and seeded behavior; the flight adapter reads copied presentation data without changing gameplay, random draws or scheduled music. |

Every tools/*.mjs harness must declare a fast or full lane, appear in the CI
workflow, and be named here. check.mjs enforces all three. all.mjs reads that
workflow list; it does not maintain another list of harnesses.

## One game source, two test surfaces

The canonical simulation, audio and procedural renderer live in
src/game/runtime.js, exported as createCosmoRuntime(host). Production supplies
the Phaser host, which owns timing and forwards input.

tools/lib/game-source.mjs extracts only the marked runtime body, supplies the
default host, and injects it into the app shell with src/styles.css. Existing
VM harnesses use that body with their recording DOM/audio/GPU fakes. The
compatibility loop runs only when the external host is absent. Source-line
padding keeps drawcheck diagnostics aligned with the canonical runtime file.
There is no second checked-in copy of the game.

rendercheck uses the same virtual document on an isolated local browser origin.
It deliberately keeps the runtime's lexical globals accessible so it can place
the game in precise visual states and read the framebuffer immediately after
the draw. This proves rendering behavior, not the Phaser integration.

enginecheck instead starts Vite preview against dist on 127.0.0.1:4173 and loads
the bundled application. It observes only COSMO_APP.snapshot and browser
errors, then drives actual browser pointer and touch input. It checks that
simulation and render counters advance once per Phaser update. External
requests and writes are blocked; it does not sign in or operate native apps.
The browser and the preview process it started are closed after the check.

Set COSMO_ENGINE_SHOTS to a local directory to capture the built app in portrait
and landscape. COSMO_SHOTS does the same for rendercheck's gameplay states.
COSMO_INDEX optionally points rendercheck at a prior self-contained HTML
artifact for an explicit visual comparison.

## What the existing regression guards protect

smoke exercises real handlers instead of calling gameplay actions directly
where input is the behavior under test. It crosses each menu through published
hit rectangles. The first run teaches a tap, physical star contact, an
uninterrupted orbit and a ring change. Other harnesses may finish that
introduction through its skip API when onboarding is outside their scope.

Lab persistence checks clear storage before a complete lab session. Comparing
an already populated store missed writes that simply rewrote existing values;
the protected contract is that a lab cannot create a persistent record.
Responsive controls must remain finite, pressable, within the viewport and
separate from neighboring hit areas.

dropcheck permits the nova's visible clearing front to travel while requiring
protection through that transition. It verifies reward stars through swept
contact, rather than injecting score. Starfall releases are checked on quarter
beats; their latency bound includes the scheduler's 160ms lookahead and frame
quantization.

musiccheck records what the audio scheduler actually issues. It checks the
playing level's harmonic material rather than accepting one song transposed
everywhere. A stub cannot establish subjective listening quality.

fxcheck rejects nonexistent uniform names, a failure real WebGL otherwise
silently ignores. It checks upload orientation, render-target layout, lens
direction and context recovery. World interpolation must remain finite across
every transition and retain correct outer-ring geometry. No fake GPU can
establish that the resulting picture is compelling.

drawcheck records calls that browsers may silently ignore: non-finite
coordinates, invalid colors, invalid alpha and broken drawing state.
rendercheck complements it by inspecting actual pixels; prior bugs included
screen-edge rims, detached glow and worlds collapsed into the same palette.
Current checks protect materials, dynamic range and distinct compositions
without requiring large empty areas or an obsolete visual style.

The build artifact guard examines public assets and dist output. Internal
documentation, server code, configuration, credentials and source maps must
not become published assets. LICENSE and the proprietary entry-page notice
travel with the game. Pages must publish dist, never the repository root.

## Reproduction

Simulation harnesses inject a deterministic random source from tools/lib/rng.mjs
and print the seed before assertions can fail. CI rotates SEED; set SEED to the
reported value to reproduce a failure. Game code does not acquire a test RNG.

Run the harness relevant to an edit while working. After integration, run the
full suite once. A successful fake, pixel check or engine smoke establishes its
specific contract; it does not replace player feedback about impact, sound or
balance.
