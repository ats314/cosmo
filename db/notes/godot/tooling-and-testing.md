# Tooling, testing and CI in Godot 4

> What the engineering discipline around Cosmo's code looks like after the move
> off Phaser: which of the nine harnesses survive, what replaces them, what
> becomes untestable, and the editor/CI machinery worth building for one owner.
> Written against **Godot 4.7.2-stable** (released 18 August 2026). At the time
> of writing `docs.godotengine.org/en/stable` *is* the 4.7 documentation.

---

## The short version

If you read nothing else:

1. **`--headless` disables all rendering.** Not "renders offscreen" — disables.
   Every pixel assertion needs a real display server (Xvfb plus a software
   rasterizer, or a GPU runner). Budget a second CI lane for it.
2. **Input does not propagate under `--headless`.** `Input.parse_input_event()`
   is dropped. Cosmo's entire input-driven test surface — the thing `smoke.mjs`
   was built to be — needs a display server too, or a seam below `Input`.
3. **You cannot stub `AudioServer` or `RenderingServer` from GDScript.** They
   are C++ singletons with no injection point. `musiccheck.mjs` and `fxcheck.mjs`
   record calls into fake browser APIs; that trick has no Godot analogue. The
   only way to keep that coverage is to **move the decision above the engine
   API**: a pure planner that emits typed events, and a thin dumb player. Decide
   this before writing the scheduler, not after.
4. **Turn the type checker into your first harness.** Set
   `debug/gdscript/warnings/untyped_declaration=2` (2 = Error) and the four
   `unsafe_*` warnings to Error in `project.godot`. Most of what `smoke.mjs`
   exists to catch — typos, wrong arity, null field access — becomes a compile
   error you get in the editor instead of a 40-second harness run.
5. **Test framework: gdUnit4 if you want a scene runner and a maintained CI
   action; GUT if you want less machinery and better doubles.** Both are
   addons that run inside the engine. Neither can run without the Godot binary.
6. **CI is: download the binary + templates, `--headless --import`, lint, unit
   lane, display lane, export.** There is no `npm test`. Write the runner
   yourself, and port `check.mjs`'s three routing guards verbatim — they are
   text checks over files and cost nothing to move.
7. **Own your PRNG.** `RandomNumberGenerator`'s docs say the PCG32
   implementation is not a stability guarantee. A golden simulation test seeded
   through it can change meaning on an engine upgrade. Ship a 40-line
   xorshift32 in GDScript and forbid global `randi()`/`randf()` in gameplay.
8. **`enginecheck.mjs` has no real replacement.** There is no Playwright for a
   Godot export. Accept a weaker boot check plus an on-device pass, and say so
   in the docs rather than pretending.

---

## 1. Version gates, up front

Everything below is verified against 4.7.2. These are the ones that will bite if
you copy a two-year-old blog post, or if you pin an older engine:

| API | Available since | Notes |
|---|---|---|
| `EditorInterface` as a global singleton | **4.2** | Before that, only via `EditorPlugin.get_editor_interface()` / an `EditorScript` instance. |
| `@export_tool_button("Label")` | **4.4** | Replaces the "bool that resets itself" inspector-button hack. |
| `@warning_ignore_start()` / `@warning_ignore_restore()` | **4.4** | Absent from the 4.3 docs; present in 4.7. Region-scoped suppression. |
| `.uid` sidecar files for scripts and scenes | **4.4** | Generalized UIDs. Commit them. |
| `EditorDock` + `EditorPlugin.add_dock()` / `remove_dock()` | **4.6** | 4.5 and earlier use `add_control_to_dock(DOCK_SLOT_*, control)`. `EditorDock` is marked *experimental*: "This class may be changed or removed in future versions." |
| `load_steps` in the `[gd_scene]` header | deprecated at **4.6** | Older scenes still carry it; new saves may not. Do not write tooling that parses it. |
| Per-platform export template downloads | **4.7** | Lets CI fetch only the Web/Android templates instead of the full ~1 GB `.tpz`. |

Not available at 4.7.2, despite what you will read: **offscreen / surfaceless
rendering**. `--headless` still means "no rendering at all"; the long-standing
proposal ([godot-proposals#5790]) is open.

---

## 2. The decision testing depends on: put the decision above the engine API

This is the part that is genuinely hard, and it is an architecture choice, not a
tooling one. Cosmo's most valuable harnesses work by **substituting the platform
API and recording what the game asked for**:

- `musiccheck.mjs` stubs `AudioContext` inside a `vm` sandbox and records every
  `OscillatorNode.start`, buffer start, frequency write and gain write into
  `LOG = {osc, buf, tune, pad, errors}`. That is how the *heard chord sequence*
  becomes assertable — `padRoots(pad)` reads `LOG.pad[k*8]` as bar `k`'s root.
- `fxcheck.mjs` hands the runtime a fake WebGL context that parses the uniform
  declarations out of the shader it was given, so a uniform name typo — which
  real WebGL ignores silently — fails the build.
- `drawcheck.mjs` hands it a recording 2D context and rejects non-finite
  coordinates, negative radii and unbalanced `save()`.

None of that is possible in Godot. `AudioServer`, `RenderingServer` and the
`CanvasItem` draw calls are engine C++ reached through singletons and native
methods; GDScript has no interception point, and the addon test frameworks
cannot mock a native singleton either.

**The only recovery is to make the interesting decision a pure function.**

```gdscript
# res://src/audio/note_event.gd
class_name NoteEvent
extends RefCounted

enum Voice { PAD, BASS, ARP, LEAD, SNARE, KICK, DROP }

var at_beat: float          # position in the bar grid, not wall-clock seconds
var voice: Voice
var semitones_over_tonic: int
var gain: float
var duration_beats: float

func _init(p_at: float, p_voice: Voice, p_semi: int, p_gain: float, p_dur: float) -> void:
	at_beat = p_at
	voice = p_voice
	semitones_over_tonic = p_semi
	gain = p_gain
	duration_beats = p_dur

func _to_string() -> String:
	# Stable, greppable, diff-friendly. Golden tests compare these strings.
	return "%.3f/%d/%+d/%.3f/%.3f" % [at_beat, voice, semitones_over_tonic, gain, duration_beats]
```

```gdscript
# res://src/audio/arrangement.gd — no engine calls, no AudioServer, no nodes.
class_name Arrangement
extends RefCounted

## Returns the notes for one bar. Deterministic in (level, bar, heat, flags).
static func plan_bar(level: int, bar: int, heat: float, flags: int) -> Array[NoteEvent]:
	var out: Array[NoteEvent] = []
	# ... the whole musical decision lives here ...
	return out
```

The player becomes a dumb consumer that turns `NoteEvent`s into
`AudioStreamPlayer` starts at a scheduled time. It carries no musical decisions,
so it needs no coverage beyond "it does not throw".

The same shape recovers `fxcheck`'s uniform assertions:

```gdscript
# res://src/render/sky_uniforms.gd
class_name SkyUniforms
extends RefCounted

## Pure: scene state in, the exact dictionary of shader parameters out.
static func compute(state: SkyState) -> Dictionary:
	return {
		"u_arena": Vector3(state.outer_radius / state.height,
						   state.inner_radius / state.height,
						   state.arena_y),
		"u_accent": state.accent,
		"u_motion": SKY_GL_MOTION,
	}
```

Now a headless test can assert `u_arena` to 1e-10 exactly the way
`fxcheck.mjs:567-573` does today, and a second test can assert every key in that
dictionary exists in the shader (see §7).

**This is the single highest-leverage decision in the rebuild's test story.** If
the arrangement logic ends up inside `_process()` on an `AudioStreamPlayer`
subclass, `musiccheck`'s 1,533 lines of coverage are gone permanently and no
amount of tooling gets them back.

---

## 3. Headless: what you get and what you do not

`--headless` is documented as exactly `--display-driver headless --audio-driver
Dummy`. `DisplayServer`'s class reference is blunt about the consequence:

> "Starting the engine with the `--headless` command line argument disables all
> rendering and window management functions. Most functions from DisplayServer
> will return dummy values in this case."

So, headless:

| Works | Does not work |
|---|---|
| Loading scripts, resources, scenes | Any rendering; `Viewport.get_texture()` gives you nothing useful |
| `SceneTree` running, `_process`/`_physics_process`, signals | Screenshots, shader pixels, glow chains |
| File I/O, `user://` saves, JSON, `ResourceSaver` | `Input.parse_input_event()` propagation ([godot#73557], open) |
| Importing and exporting | Real audio output (Dummy driver — see the caveat below) |

**The input hole matters most.** `godot#73557` (open since 4.0 RC2) reports that
input events pushed with `Input.parse_input_event()` are never emitted under
`--headless`. gdUnit4 has institutionalised this: its CLI **refuses headless by
default** and you must pass `--ignoreHeadlessMode`, because "Godot cannot process
UI input in headless mode".

Cosmo's input contract is the game — *tap always turns; swipe always changes
ring* — and `smoke.mjs:216-266` drives taps, swipes and keys through the real
handlers. Two ways to keep that coverage:

1. **Put a seam directly under `Input`.** Gameplay never reads `Input` or
   `_unhandled_input` directly; it consumes a small `InputIntent` stream that one
   adapter node produces. Tests feed the stream. This is the same shape as
   Cosmo's existing typed host boundary (`src/game/contracts.ts`), and it is the
   cheap answer.
2. **Run the input lane with a display server** (Xvfb), where
   `Input.parse_input_event()` works and gdUnit4's scene runner can drive real
   `InputEventScreenTouch`/`InputEventScreenDrag`.

Do (1) for logic and (2) for a thin end-to-end pass. (1) alone leaves the
adapter untested; (2) alone is slow and flaky.

**Audio under the Dummy driver is an open question.** I could not find
documentation stating whether `AudioServer` continues to advance playback
position with `--audio-driver Dummy`. Treat "audio actually plays in CI" as
**unverified** and do not build a harness that depends on it — which is another
argument for testing the planner, not the playback.

### The `SceneTree` script: the shape a headless harness should take

`--script` (`-s`) requires a script that extends `SceneTree` or `MainLoop`. This
is the Godot replacement for Cosmo's `vm`-sandbox harnesses, and it is *better*:
no source extraction, no marker pair, no line-number padding — just imports.
`tools/lib/game-source.mjs` and its whole extraction contract become obsolete.

```gdscript
# res://tools/harness/sim_harness.gd
# Run: godot --headless --path . -s res://tools/harness/sim_harness.gd
extends SceneTree

const FRAMES := 2400
const DT := 1.0 / 60.0

var _failures: PackedStringArray = []

func _initialize() -> void:
	var seed_value := _seed()
	print("sim_harness  seed=%d" % seed_value)   # printed BEFORE any assertion

	var rng := Xorshift32.new(seed_value)
	var run := RunSim.new(rng)
	run.start(1)

	for i in FRAMES:
		run.step(DT)
		if not is_finite(run.comet_angle):
			_fail("frame %d: comet angle went non-finite" % i)
			break

	_expect(run.tier >= 1, "tier never advanced in %d frames" % FRAMES)
	_expect(run.score > 0, "no score was earned")

	for line in _failures:
		printerr("FAIL  ", line)
	quit(1 if not _failures.is_empty() else 0)

func _fail(msg: String) -> void:
	_failures.append(msg)

func _expect(ok: bool, msg: String) -> void:
	if not ok:
		_fail(msg)

func _seed() -> int:
	var env := OS.get_environment("SEED")
	return env.to_int() if env.is_valid_int() else 20260814
```

Three things to notice.

- **`quit(exit_code)`** is what makes CI red. `SceneTree.quit()` takes an
  `exit_code` and "quits the application at the end of the current iteration".
- **The seed prints before the first assertion.** This is Cosmo's existing rule
  (`tools/lib/rng.mjs`; `check.mjs:390-403` enforces it) and it survives the
  engine change unchanged. CI rotates `SEED` per run; local defaults to a
  constant so an agent can attribute a changed number to its own diff.
- **`_initialize()` never yields to a frame.** If you need frames — physics,
  timers, `await` — override `_process(delta) -> bool` and return `true` to end
  the loop, or instantiate a scene under `root` and drive it. Note that one
  report ([godot#122707], on 4.7.1, closed as not planned) describes headless
  stalling after 25-55 s *when a scene is loaded as the main scene*, and
  explicitly not reproducing with a `SceneTree` script that loads no scenes. The
  pattern above is the shape that did not stall.

### `--check-only` is a parse check, not a project check

```sh
godot --headless --check-only -s res://src/game/run_sim.gd
```

"Only parse for errors and quit (use with `--script`)." It parses *that* script.
There is no documented flag that parses every script in the project and returns
non-zero. The practical substitutes:

```sh
# 1. Import once; parse errors surface on stderr during import.
godot --headless --path . --import

# 2. Then loop the check over every script.
find src tools -name '*.gd' -print0 \
  | xargs -0 -n1 godot --headless --path . --check-only -s
```

Slow (one process per file) but exhaustive. `gdlint` (§8) is the fast pre-pass.

**Do not assume a GDScript runtime error sets a non-zero exit code.** I found no
documentation guaranteeing it, and there is an open proposal
([godot-proposals#13048]) asking for structured headless error output precisely
because errors today are unstructured and can drop the process into the
interactive debugger. Make CI fail on stderr content as well as on exit status:

```sh
set -o pipefail
godot --headless --path . -s res://tools/harness/sim_harness.gd 2>&1 \
  | tee run.log
grep -qE 'SCRIPT ERROR|Parse Error|ERROR:' run.log && { echo "engine errors"; exit 1; }
```

---

## 4. Determinism

Godot gives you the knobs; it does not give you a stable RNG.

```sh
godot --headless --fixed-fps 60 --disable-render-loop --path . -s res://tools/harness/x.gd
```

- `--fixed-fps <fps>`: "Force a fixed number of frames per second. This setting
  disables real-time synchronization." This is what makes a driven run
  reproducible.
- `--disable-render-loop`: "Disable render loop so rendering only occurs when
  called explicitly from script." Useful on a display-server lane where you want
  frames only when you ask for them.
- `--time-scale`, `--max-fps`, `--quit-after <n>` round it out.

**Do not seed simulation golden tests through `RandomNumberGenerator`.** Its
documentation says identical seeds give identical sequences *and* that the
underlying PCG32 algorithm "should not be relied upon as a permanent
implementation detail". A golden test whose expected values come out of the
engine RNG can silently change meaning at an engine upgrade — the failure mode
where you spend a day looking for a gameplay regression that is a library
change. Ship your own:

```gdscript
# res://src/util/xorshift32.gd
class_name Xorshift32
extends RefCounted

const MASK := 0xFFFFFFFF

var _state: int

func _init(seed_value: int = 1) -> void:
	_state = seed_value & MASK
	if _state == 0:
		_state = 1

func next_u32() -> int:
	var x := _state
	x ^= (x << 13) & MASK
	x ^= x >> 17
	x ^= (x << 5) & MASK
	_state = x & MASK
	return _state

## [0.0, 1.0)
func next_float() -> float:
	return float(next_u32() >> 8) / 16777216.0

func range_float(from: float, to: float) -> float:
	return from + (to - from) * next_float()
```

Shifts and xors only — no multiplication, because GDScript integers are 64-bit
signed and a 32×32 multiply can overflow. That is why this is xorshift32 and not
the mulberry32 in `tools/lib/rng.mjs`: a direct port of `Math.imul` semantics
needs 16-bit lane splitting to stay in range, and the extra code is not worth it
for deciding where a hazard spawns.

Then make it a rule that gameplay never calls the global `randi()`/`randf()` —
those read a process-global RNG a test cannot control — and enforce it with a
text guard, exactly the way `check.mjs` guards Cosmo's other rules today:

```gdscript
# in the static-check harness
var offenders := _grep_dir("res://src/game", "\\b(randi|randf|randi_range|randf_range|randomize)\\s*\\(")
_expect(offenders.is_empty(), "gameplay must take an injected RNG: %s" % ", ".join(offenders))
```

---

## 5. Unit and integration testing: gdUnit4 vs GUT, honestly

Both are GDScript addons that live in `res://addons/` and run *inside* the
engine. There is no out-of-engine GDScript test runner; every test run pays
engine start-up (roughly a second, plus import on a cold `.godot/`).

As of September 2026:

| | **gdUnit4** (`godot-gdunit-labs/gdUnit4`) | **GUT** (`bitwes/Gut`) |
|---|---|---|
| Current | v6.2.1; supports 4.5 – 4.7.1 | 9.7.1; 9.x is the Godot 4 line |
| Language | GDScript **and** C# (separate `gdUnit4Net` package) | GDScript only |
| Style | Fluent: `assert_str(x).is_equal("y")` | xUnit-ish: `assert_eq(x, "y", "message")` |
| Base class | `extends GdUnitTestSuite` | `extends GutTest` |
| Discovery | test suites; functions prefixed `test_` | files named `test_*.gd` under a test dir |
| Doubles | mocks and spies for classes and scenes | full/partial doubles, stubs, spies — the more mature half |
| Scene runner | yes: simulates mouse, keys, touch, custom actions, frame stepping | `gut.simulate()` steps `_process` on a node tree; no touch simulation |
| Fuzzers / parameterized | both | parameterized only |
| CLI | `addons/gdUnit4/runtest.sh` (`.cmd` on Windows) | `godot -d -s --path "$PWD" addons/gut/gut_cmdln.gd` |
| Exit codes | `0` pass, `100` failures, `101` warnings | `0` pass, `1` any failure (pending does not count) |
| Reports | JUnit XML + HTML | JUnit XML |
| CI | maintained `gdunit4-action` on the GitHub Marketplace | roll your own step |
| Headless | **opt-in**: `--headless --ignoreHeadlessMode` | plain `--headless` |

```gdscript
# res://test/unit/test_arrangement.gd  — gdUnit4
extends GdUnitTestSuite

func test_every_drop_pitch_is_diatonic() -> void:
	for level in range(1, 7):
		var events := Arrangement.plan_drop(level)
		for e in events:
			assert_int(Harmony.degree_of(e.semitones_over_tonic, level)) \
				.is_greater_equal(0)

func test_level_two_chorus_walks_the_verse_backwards() -> void:
	var verse := Arrangement.chord_roots(2, Arrangement.Section.VERSE)
	var chorus := Arrangement.chord_roots(2, Arrangement.Section.CHORUS)
	verse.reverse()
	assert_array(chorus).is_equal(verse)
```

```gdscript
# res://test/unit/test_arrangement.gd  — GUT
extends GutTest

func test_every_drop_pitch_is_diatonic() -> void:
	for level in range(1, 7):
		for e in Arrangement.plan_drop(level):
			assert_gt(Harmony.degree_of(e.semitones_over_tonic, level), -1,
				"level %d drop pitch %d is outside the key" % [level, e.semitones_over_tonic])
```

**What neither can do**, and it is worth being explicit because both READMEs
read as if they can test anything:

- Mock a native singleton. No `AudioServer`, `RenderingServer`, `DisplayServer`,
  `Input` or `OS` double. If your code calls them directly, that path is
  reachable only in an integration run against the real engine.
- Assert what the GPU was asked to do. There is no call recorder.
- Assert audio content. Nothing reads the mix bus.
- Run without the engine. No pure-CLI unit run, no watch mode measured in
  milliseconds.

**Recommendation for Cosmo: gdUnit4.** Not because the assertions are better —
GUT's doubling is better — but because the scene runner's touch simulation and
the maintained GitHub Action are the two things a one-owner project cannot
cheaply rebuild, and Cosmo's coverage is disproportionately about *driven input*
and *driven runs*. If the input seam from §3 lands, this becomes a much closer
call and GUT's smaller surface is attractive.

**Both lag the engine.** Check the addon's compatibility statement before taking
an engine point release; a 4.8 upgrade is likely to arrive before the addon
supports it. That is a real, recurring tax that Cosmo does not pay today, where
the harnesses are 4,000 lines of Node you own outright.

---

## 6. `@tool` scripts and their hazards

`@tool` runs the script in the editor. It is the right tool for content that
should be *seen* while authoring — ring geometry, formation shapes, level window
previews — and it is the fastest way to lose work.

The hazards, from the official page:

- "Modifications in the editor are permanent, with no undo/redo possible."
- "Be **extremely** cautious when manipulating the scene tree, especially via
  `Node.queue_free()`, as it can cause crashes if you free a node while the
  editor runs logic involving it."
- An infinite loop in a `@tool` script freezes the editor. There is no watchdog.
- For editor plugins: "Any GDScript without `@tool` used by the editor will act
  like an empty file!" — a silent failure that looks like the API being broken.

The guard is not optional:

```gdscript
@tool
class_name RingPreview
extends Node2D

@export var ring_count: int = 5:
	set(value):
		ring_count = clampi(value, 2, 6)
		queue_redraw()          # cheap, idempotent, safe in the editor

@export var arena_height: float = 1280.0:
	set(value):
		arena_height = maxf(value, 1.0)
		queue_redraw()

func _ready() -> void:
	if Engine.is_editor_hint():
		return                  # no timers, no audio, no save writes, no spawning
	_start_run()

func _draw() -> void:
	for i in ring_count:
		draw_arc(Vector2.ZERO, Geometry.radius_of(i, ring_count, arena_height),
			0.0, TAU, 64, Color(1, 1, 1, 0.25), 1.0, true)
```

`_draw()` is safe in the editor because it writes nothing. `_ready()` is not, so
it returns early. That asymmetry is the whole discipline: **a `@tool` script may
compute and draw; it must not start clocks, touch `user://`, or free nodes.**

Two escapes from `@tool` when you only need a one-shot action:

```gdscript
@tool
extends EditorScript
# Script editor: File > Run (Ctrl+Shift+X). No undo — save the scene first.

func _run() -> void:
	for path in DirAccess.get_files_at("res://content/levels"):
		var lv := load("res://content/levels/%s" % path) as LevelDef
		print("%s  window=%d..%d  world=%s" % [lv.name, lv.window_start, lv.window_end, lv.world])
```

```gdscript
@tool
extends Node

# 4.4+. Replaces the "export a bool that sets itself back to false" hack.
@export_tool_button("Rebake sprite halos") var bake_action: Callable = _bake_halos

func _bake_halos() -> void:
	# EditorInterface is a global singleton since 4.2 — no plugin instance needed.
	EditorInterface.get_resource_filesystem().scan()
```

Finally: enable the `MISSING_TOOL` warning (see §8). It fires when a class
inherits a `@tool` class without declaring `@tool` itself, which is the exact
shape of the "acts like an empty file" bug.

---

## 7. EditorPlugin, docks and inspector plugins — when it pays

An editor plugin is a fixed cost of a few hundred lines plus a permanent
maintenance surface (the dock API moved in 4.6, and `EditorDock` is marked
experimental). For a single maintainer it pays for itself in exactly one
situation: **content you edit repeatedly and cannot judge from a text field.**

Cosmo has three candidates, in order:

1. **The content tables** — rings, worlds, powerup pools, formation tiers,
   level windows. These are `Resource` subclasses, so the built-in inspector
   already handles them for free. An `EditorInspectorPlugin` adds value only for
   the fields where a number is not the thing you want to see: a formation's
   shape, a level's window against the tier ladder, an orb's colour.
2. **A run-window preview dock** — showing the six level windows and the ten
   tier thresholds on one axis. Today that ordering rule (`check.mjs:284-285`,
   `curriculum.mjs:232-248`) is only ever seen as a pass/fail.
3. **Nothing else.** Resist the build/export dock; that is what the command line
   is for.

Skeleton, current idiom, 4.6+:

```gdscript
# res://addons/cosmo_tools/plugin.gd
@tool
extends EditorPlugin

var _dock: EditorDock

func _enter_tree() -> void:
	_dock = EditorDock.new()
	_dock.title = "Cosmo content"
	_dock.default_slot = DOCK_SLOT_RIGHT_UL          # EditorPlugin.DockSlot
	_dock.add_child(preload("res://addons/cosmo_tools/content_dock.tscn").instantiate())
	add_dock(_dock)

func _exit_tree() -> void:
	remove_dock(_dock)
	_dock.queue_free()                                # leaks the Control otherwise
```

```ini
; res://addons/cosmo_tools/plugin.cfg
[plugin]
name="Cosmo content tools"
description="Level window and formation previews."
author="Cosmo"
version="1.0"
script="plugin.gd"
```

On 4.5 and earlier the two dock lines are instead
`add_control_to_dock(DOCK_SLOT_RIGHT_UL, control)` and
`remove_control_from_docks(control)`.

An inspector plugin that draws a formation instead of listing its point array:

```gdscript
# res://addons/cosmo_tools/formation_inspector.gd
@tool
extends EditorInspectorPlugin

func _can_handle(object: Object) -> bool:
	return object is FormationDef

func _parse_property(object: Object, type: Variant.Type, name: String,
		hint_type: PropertyHint, hint_string: String,
		usage_flags: int, wide: bool) -> bool:
	if name != "points":
		return false
	var preview := FormationPreview.new()          # a Control that _draw()s the shape
	preview.formation = object
	add_property_editor(name, preview, true)
	return true                                     # true removes the built-in editor
```

Register it from the plugin with `add_inspector_plugin()` in `_enter_tree()` and
`remove_inspector_plugin()` in `_exit_tree()`. Every script the editor loads must
carry `@tool`, including the preview `Control`.

**Use `EditorUndoRedoManager` (via `get_undo_redo()`) for anything a plugin
mutates in a scene.** A plugin that edits without registering undo steps is the
`@tool` data-loss hazard with a nicer interface.

---

## 8. Static analysis and the settings worth turning on

### The type checker is your cheapest harness

GDScript's warning levels are `IGNORE=0`, `WARN=1`, `ERROR=2`, set per warning
under `debug/gdscript/warnings/<name>`. Put this in `project.godot` on day one,
while there is no code to retrofit:

```ini
[debug]

gdscript/warnings/enable=true
gdscript/warnings/exclude_addons=true

; Static typing, enforced. This is the setting that replaces a whole class of
; smoke.mjs: a typo'd field or a wrong-arity call stops being a runtime crash
; found by a 40-second harness and becomes a compile error in the editor.
gdscript/warnings/untyped_declaration=2
gdscript/warnings/inferred_declaration=1
gdscript/warnings/unsafe_property_access=2
gdscript/warnings/unsafe_method_access=2
gdscript/warnings/unsafe_cast=2
gdscript/warnings/unsafe_call_argument=2
gdscript/warnings/unsafe_void_return=2
gdscript/warnings/inference_on_variant=2

; Bug shapes, not style.
gdscript/warnings/unassigned_variable=2
gdscript/warnings/unassigned_variable_op_assign=2
gdscript/warnings/narrowing_conversion=2
gdscript/warnings/integer_division=2
gdscript/warnings/incompatible_ternary=2
gdscript/warnings/return_value_discarded=1
gdscript/warnings/native_method_override=2
gdscript/warnings/missing_tool=2
gdscript/warnings/shadowed_variable=1
gdscript/warnings/shadowed_variable_base_class=2
gdscript/warnings/standalone_expression=2
gdscript/warnings/standalone_ternary=2
gdscript/warnings/unreachable_code=1
gdscript/warnings/confusable_identifier=1
```

The full warning list (46 live codes) is in
`modules/gdscript/gdscript_warning.h`; the project-setting key is the enum name
lowercased. Several of the `unsafe_*` and typing warnings ship as `IGNORE`
because "static typing is optional" and they are "too common in untyped
scenarios" — which is precisely why an all-typed project should raise them.

`exclude_addons=true` matters: gdUnit4 and GUT are third-party code that will not
satisfy your settings, and without this every CI run is red for someone else's
style.

For the handful of places where the type checker cannot see through the engine
(a `get_node()` cast, an `Object` from a signal):

```gdscript
@warning_ignore_start("unsafe_method_access")     # 4.4+
var host: Object = _bridge.get_host()
host.forward_intent(intent)
@warning_ignore_restore("unsafe_method_access")
```

Region annotations beat per-line `@warning_ignore()` when you have a cluster, and
they are visible in review as an explicit "here be dragons" block.

### gdlint / gdformat

`gdtoolkit` (`pip install "gdtoolkit==4.*"`, currently 4.3.2) is a parser,
linter, formatter and metrics tool that runs **without the engine** — the only
piece of the toolchain that does. That makes it the fast pre-pass:

```sh
gdformat --check src/ tools/ test/     # fails if anything is unformatted
gdlint src/ tools/                     # style + a few real smells
```

Honest limitation: `gdlint` is style-and-shape analysis over the syntax tree. It
does not know the engine's type system, so it finds none of what the `unsafe_*`
warnings find. Run both; they do not overlap.

### `assert()` is not a harness

GDScript's `assert()` is stripped from release builds. It is a development
tripwire, not a check. Anything that must hold in the shipped game needs a real
branch, and anything that must hold in CI needs a test.

---

## 9. Version control hygiene

### The ignore file

The canonical Godot 4 `.gitignore` (github/gitignore, and what Godot's *Project
> Version Control > Generate Version Control Metadata* writes) is small:

```gitignore
# Godot 4.2+ specific ignores
~*.dll

# Godot 4+ specific ignores
.godot/
.nomedia

# Godot-specific ignores
.import/
export.cfg
export_credentials.cfg
*.tmp

# Imported translations (automatically generated from CSV files)
*.translation
```

`.godot/` is the cache: imported binaries under `.godot/imported/`, plus
`.godot/export_credentials.cfg`, which the export documentation says holds
"passwords and encryption keys" and "should generally **not** be committed".
`export_presets.cfg` itself "can be safely committed" — that split arrived so
that a keystore password would stop leaking into repositories, and it is the one
thing to check before the first Android export lands.

### What must be committed

| File | Commit? | Why |
|---|---|---|
| `*.import` (beside each asset) | **yes** | "Make sure to commit these files to your version control system, as these files contain important metadata." Without them the asset reimports with default settings. |
| `*.uid` (4.4+, beside scripts/shaders/scenes) | **yes** | They are project state, not build output. Ignore them and every clone mints fresh UIDs, and scene→script references resolve to UIDs that exist on one machine only. |
| `export_presets.cfg` | yes | Export configuration. Check it for secrets once. |
| `.godot/` | no | Cache; regenerates. Cache it in CI, do not commit it. |
| `android/build/` (Capacitor's successor: the Gradle build template) | no | Regenerated by "Install Android Build Template". |

When moving a script or shader **outside** the editor, move its `.uid` with it.

### `.gdignore`

An empty file named `.gdignore` in a directory makes Godot skip it entirely — no
import, no script parsing, and it disappears from the FileSystem dock. Note the
consequence: "resources in that folder can't be loaded anymore using the `load()`
and `preload()` methods."

Use it for exactly two things: raw art sources kept next to the exported PNGs,
and any research/scratch directory. Do **not** put `res://tools/` behind it —
harness scripts must be loadable by `--script`.

### What diffs usefully

`.tscn` and `.tres` are line-oriented text. A scene header looks like
`[gd_scene format=3 uid="uid://cecaux1sm7mo0"]` (4.6 deprecated `load_steps`), an
external reference like
`[ext_resource type="Texture2D" uid="uid://ccbm14ebjmpy1" path="res://gradient.tres" id="2_eorut"]`,
and each `[node]` carries name, parent and a unique id so nodes survive renames.

Reality check on the community folklore that "Godot regenerates every resource id
on save": the `id="2_eorut"` form is a stable per-file id with a random suffix,
and there **was** a 4.1 regression ([godot#77172]) where all `ExtResource` ids
were rewritten on every save. Whether any churn remains at 4.7 I did not verify.
Practical rule: read `git diff` on a `.tscn` before committing it, and if you
find yourself with id churn, `gdmerge`/`tscnmerge` exist as merge drivers.

**But keep this in proportion for Cosmo.** One owner, direct pushes to `main`, no
concurrent branches: three-way scene merges are close to a non-problem here. What
actually matters is the *other* half of the same property — **a `.tscn` diff is
not readable as intent.** Reordering two children of a node produces a diff you
cannot review. That argues for the same thing the rest of this document argues
for: keep the content in typed `Resource` files and code, keep scenes thin, and
the review surface stays in `.gd` and `.tres` where a diff means something.

---

## 10. CI

There is no `npm test`. The pieces:

```yaml
# .github/workflows/check.yml
name: check
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:

env:
  GODOT_VERSION: 4.7.2

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install "gdtoolkit==4.*"
      - run: gdformat --check src tools test
      - run: gdlint src tools

  headless:
    runs-on: ubuntu-latest
    env:
      SEED: ${{ github.run_number }}
    steps:
      - uses: actions/checkout@v4
      - name: Install Godot
        run: |
          curl -sSLo godot.zip \
            "https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip"
          unzip -q godot.zip && mv Godot_v${GODOT_VERSION}-stable_linux.x86_64 /usr/local/bin/godot
          chmod +x /usr/local/bin/godot
      - uses: actions/cache@v4
        with:
          path: .godot/imported
          key: import-${{ env.GODOT_VERSION }}-${{ hashFiles('**/*.import') }}
      - name: Import (pre-heat the cache)
        run: godot --headless --path . --import
      # Keep explicit steps: the local runner reads this list.
      - run: node tools/routing_guard.mjs        # or a .gd equivalent
      - run: ./addons/gdUnit4/runtest.sh --headless --ignoreHeadlessMode -a res://test/unit
      - run: godot --headless --path . -s res://tools/harness/sim_harness.gd
      - run: godot --headless --path . -s res://tools/harness/curriculum_harness.gd

  pixels:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... same Godot install ...
      - run: sudo apt-get update && sudo apt-get install -y xvfb mesa-vulkan-drivers libgl1-mesa-dri
      - run: godot --headless --path . --import
      - name: Golden frames
        run: |
          xvfb-run -a --server-args="-screen 0 1080x1920x24" \
            godot --path . --rendering-driver opengl3 --resolution 1080x1920 \
              -s res://tools/harness/pixel_harness.gd
```

Notes on each sharp edge:

- **Import first, always.** `--export-debug` is documented as implying
  `--import`; `--export-release` is not. Running `--headless --path . --import`
  as its own step removes the ambiguity and gives you a cacheable `.godot/`. The
  common CI recipe adds `--headless --editor --quit` as a "pre-heat" when a cold
  cache makes the first export crash — community knowledge, not documented.
- **Cache `.godot/imported`, not `.godot/`.** The rest of that directory holds
  editor state and (potentially) `export_credentials.cfg`.
- **`--headless` cannot run the pixel lane.** That is the whole reason for the
  second job. Xvfb plus Mesa's software rasterizer with
  `--rendering-driver opengl3` (the Compatibility renderer, which is the right
  one for a 2D portrait mobile game anyway) is the standard shape. Godot's own
  `godot-benchmarks` runs its GPU suite under a headless X11 display for exactly
  this reason. **Verify it on your runner before believing it** — I have not run
  this configuration for Cosmo.
- **Exports.** `godot --headless --path . --export-release "Web" build/web/index.html`
  requires export templates at
  `~/.local/share/godot/export_templates/4.7.2.stable/`, unpacked from the
  `.tpz`; 4.7 lets you fetch a single platform's templates instead of all of
  them. `--export-pack` produces only the PCK. Output paths are relative to the
  project directory, **not** the working directory — the docs are explicit and
  this is the single most common CI export bug.
- **Port `check.mjs`'s three routing guards.** They are text checks over files,
  they cost nothing to move, and they are the reason Cosmo's harness suite has
  not silently rotted: (1) every harness in `tools/` appears in the CI workflow,
  (2) every harness declares a lane, (3) every harness is named in
  `docs/harnesses.md`. The specific failure they exist for — `rendercheck.mjs`,
  the only harness that reads a pixel, missing from the routing document while
  two documents claimed `fxcheck` covered rendering — is engine-independent.

---

## 11. Performance regression testing

Godot ships no performance test framework. It ships the instruments, and the
engine team's own `godot-benchmarks` repository is the reference implementation
of the pattern: run a scene for five seconds, log average per-frame statistics
(Render CPU, Render GPU, idle, physics), emit JSON, diff the JSON against a
baseline.

The instruments:

```gdscript
# res://tools/harness/perf_probe.gd
extends Node

var _cpu_ms: PackedFloat32Array = []
var _gpu_ms: PackedFloat32Array = []
var _draws: PackedInt32Array = []

func _ready() -> void:
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)

func _process(_delta: float) -> void:
	var rid := get_viewport().get_viewport_rid()
	_cpu_ms.append(RenderingServer.viewport_get_measured_render_time_cpu(rid))
	_gpu_ms.append(RenderingServer.viewport_get_measured_render_time_gpu(rid))
	_draws.append(int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)))

func report() -> Dictionary:
	return {
		"render_cpu_ms_p50": _percentile(_cpu_ms, 0.5),
		"render_gpu_ms_p95": _percentile(_gpu_ms, 0.95),
		"draw_calls_max": _draws.max(),
		"process_ms_p95": Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
		"orphan_nodes": Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT),
	}
```

Caveats that matter:

- `Performance.get_monitor()` values are refreshed at most once per second for
  several monitors ("there may be a delay of up to 1 second between changes"),
  and `TIME_FPS` explicitly so. Sample over seconds, never per frame.
- `viewport_get_measured_render_time_gpu()` **returns 0.0 on the Metal driver**
  — so it gives you nothing on iOS or on an Apple-silicon dev machine.
- Measuring render time at all requires rendering, so this lane cannot be
  `--headless`.
- `OBJECT_ORPHAN_NODE_COUNT` is the cheapest real regression check in the list
  and it *does* work headless: a scene teardown that leaks nodes shows up
  immediately. Cosmo already has this rule
  (`rule.delivery.scene-teardown` — a shutdown must remove listeners, stop audio
  and release resources) and today `check.delivery.scene-teardown` records that
  **nothing ever triggers a shutdown**. In Godot that gap closes for free.

**What CI cannot tell you.** A GitHub runner's software rasterizer says nothing
about 60fps on a mid-range phone. Use CI for *counts* — draw calls, orphan nodes,
node counts, process time in a fixed-step run — which are stable across hardware,
and treat frame time as a device measurement. On device, `--print-fps` writes FPS
to stdout and the remote debugger's profiler gives the breakdown.

Deterministic capture, when you need frame-exact comparison, is Movie Maker mode:
`--write-movie out.avi` runs the engine non-real-time at a fixed FPS, and "faster
hardware will allow you to render a given animation in less time, but the visual
output remains identical". That is the right tool for a golden *sequence* — an
earned drop, a starfall release — where a single frame is not enough.

---

## Pitfalls

**Godot 3 idiom that will be in every search result and is wrong here.**

| Godot 3 | Godot 4 |
|---|---|
| `yield(obj, "signal")` | `await obj.signal` |
| `export var x = 1` | `@export var x: int = 1` |
| `tool` | `@tool` |
| `setget set_x, get_x` | property setters/getters in the declaration block |
| `Tween` node, `interpolate_property` | `create_tween()` → `SceneTreeTween` |
| `KinematicBody2D`, `move_and_slide(vel)` | `CharacterBody2D`, set `velocity`, call `move_and_slide()` |
| `connect("x", self, "_on_x")` | `x.connect(_on_x)` |
| `OS.window_size`, `OS.get_screen_size()` | `DisplayServer.*` / `get_window()` |
| `.import/` directory at project root | `.godot/imported/`, with `*.import` beside each asset |
| `PoolStringArray` | `PackedStringArray` |
| `instance()` | `instantiate()` |
| `Engine.target_fps` | `Engine.max_fps` |

**Engine-specific traps.**

- **`--headless` for a screenshot test.** It will produce a black or empty image
  with no error. This costs a day the first time.
- **Assuming a script error fails the build.** It may print and continue. Grep
  stderr as well as checking the exit code.
- **Committing `.uid` files to `.gitignore`.** Silent, delayed, and it breaks for
  everyone but you.
- **A `@tool` script that writes.** Saving files, mutating `user://` or freeing
  nodes from editor-time code is irreversible; there is no undo.
- **A plugin script without `@tool`.** It loads as an empty file with no error.
- **`add_control_to_dock` copied from a 4.4-era tutorial into 4.7.** Method still
  exists, but the current API is `add_dock()`/`EditorDock` — and `EditorDock`
  is itself marked experimental, so pin your engine version if you build one.
- **Seeding a golden test through `RandomNumberGenerator`.** The PCG32
  implementation is explicitly not a stability promise.
- **Forgetting `exclude_addons=true`** with warnings-as-errors; your CI turns red
  on gdUnit4's code.
- **Export output paths relative to `$PWD`.** They are relative to the project
  directory.
- **Nested typed collections.** `Array[Array[int]]` and
  `Dictionary[String, Dictionary[String, int]]` are not supported; a data table
  that wants to be nested needs a `Resource` in the middle.
- **`Shader.get_shader_uniform_list()` under `--headless`.** It is the natural
  replacement for `fxcheck`'s uniform-name assertion, but whether the dummy
  rasterizer populates it is **unverified**. Test it; if it comes back empty, the
  check belongs in the display-server lane or has to fall back to parsing the
  `.gdshader` text.

**Where Godot is plainly worse than what Cosmo has today.**

- **No API-substitution testing.** The `vm`-plus-fake-context technique that
  produces Cosmo's three best harnesses does not exist. This is a genuine,
  permanent loss of coverage class, mitigated only by architecture.
- **No browser-driver equivalent.** Playwright drives the built Phaser app
  through real pointer and CDP touch events (`enginecheck.mjs`). Nothing drives
  an exported Godot binary from outside.
- **Slower inner loop.** Every test run starts an engine. Cosmo's fast lane is
  ~5 seconds for four harnesses; expect the Godot equivalent to be slower per
  invocation even when the assertions are fewer.
- **Third-party test framework.** Cosmo owns 100% of its harness code today.
  After the move, the unit lane depends on an addon that must be upgraded in
  lockstep with the engine.
- **Web export.** Cosmo ships one Vite bundle to web and wraps it with
  Capacitor. Godot's web export is a multi-megabyte WASM payload with a
  materially worse mobile-browser story. If web parity matters, price it early.

---

## In Cosmo

### The nine harnesses, one by one

`tools/` holds nine checks (`all.mjs` is the runner). Eight assert runtime
behaviour; `check.mjs` is static. Here is what happens to each.

| Today | What it protects | Godot answer | Verdict |
|---|---|---|---|
| **`check.mjs`** — syntax, required DOM elements, teaching/mode data, the mechanic ledger vs `MECHANICS.md`, harness routing, documentation constant staleness, `public/`+`dist/` allowlist | text over files | Port nearly verbatim. It reads sources as text and needs no engine. `gdlint`+`--check-only` replace the syntax half; the ledger-drift guard (`check.mjs:313-341`), the doc-constant guard (`:520-601`, the one that keeps `SKY_ARENA_CALM = 0.62` honest) and the three routing guards move as-is. | **Full. Do this first.** |
| **`smoke.mjs`** — input through real handlers, playable intro, simulation, all powerups, black-hole decisions, pause freeze, records, lab isolation, responsive hit rectangles | driven input + a driven run | Splits three ways. The *simulation* half becomes gdUnit4 suites plus a `SceneTree` harness. The *input* half needs the §3 seam or a display lane. The *hit-rectangle* half (eight viewports down to 320×568) becomes assertions over computed `Rect2`s in a `Control` layout — cheaper and more precise than today's DOM measurement. | **Partial; input is the work.** |
| **`dropcheck.mjs`** — starfall charge sources, audible onset, swept star contact, three timed waves, hazard clearing, pause/BH suspension | run + audio timing | Full equivalent *if* starfall charge state and the release schedule are plain data. The "released at audible onset" tie is exactly the planner boundary from §2: assert the release event and the note event carry the same beat. | **Full, conditional on §2.** |
| **`curriculum.mjs`** — a played run through progression with ordered introductions | driven run | `SceneTree` harness with `--fixed-fps`, injected RNG, no rendering. Derive the frontier from the level table's length the way it does today, so adding a level extends the run automatically. | **Full.** |
| **`musiccheck.mjs`** — per-level arrangements, keys, scheduled pitch/voice behaviour, player melody, transitions (1,533 lines, the only harness that runs the arrangement) | recorded WebAudio | **No direct equivalent.** No stub point exists. Recoverable *only* by making the arrangement a pure planner (§2). If that happens, essentially all of its assertions port: the pitch law, the chord walk, `chorus_bars`, the freeze guards, the six distinct hooks, voice leading ≤12 semitones, the tuned snare at tonic+10. If it does not, this coverage is gone. | **Architectural decision, now.** |
| **`fxcheck.mjs`** — recorded GL calls, uniform names and values, world morphs, render-target ladder, context loss | fake WebGL | **No direct equivalent.** Partial recovery: uniform *names* via `Shader.get_shader_uniform_list()` (or parsing the `.gdshader`), uniform *values* via a pure `SkyUniforms.compute()`, world morph finiteness/seamlessness as plain maths over 101 samples per world. The render-target ladder and draws-per-frame become `Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME` in the display lane. Context loss is an engine concern now, not yours. | **Partial, and better in one place: the GPU chain is no longer hand-built.** |
| **`drawcheck.mjs`** — valid Canvas calls, finite geometry, legal colours and alpha, balanced drawing state | fake 2D context | **No direct equivalent.** Godot's `CanvasItem` API takes typed arguments, so "invalid colour" and "non-positive line width" mostly stop being expressible; non-finite coordinates still are. Recovery costs a deliberate seam: route custom `_draw()` work through one typed method you can record under a test flag. Judge whether that seam is worth more than the bug class it catches. | **Weak; possibly not worth rebuilding.** |
| **`rendercheck.mjs`** — actual shader pixels: screen seams, glow alignment/energy, eight world compositions, event contrast | real Chromium + WebGL | **Full equivalent, more expensive.** `await RenderingServer.frame_post_draw`, then `get_viewport().get_texture().get_image()`, then the same statistics it computes today — edge discontinuity ≤0.12 of interior, per-world `mean ∈ [5,110]`, `p90-p10 ≥ 25`, no world pair collapsing in both hue and composition. Keep the *statistical* comparison; do not switch to exact-pixel golden images, which will be flaky across drivers. Requires the display lane. | **Full, second CI job.** |
| **`enginecheck.mjs`** — the built app boots, LAUNCH works, pointer reversal, touch ring change, resize, one active scene, one host-owned loop | Vite preview + Playwright/CDP | **The real loss.** No external driver exists for an exported Godot binary. Nearest: export, run the export with `--quit-after`, assert clean stderr and an autoload-reported boot state; plus an on-device checklist. The "one scene, one loop" assertion becomes structurally impossible to violate — Godot owns the loop — and `OBJECT_ORPHAN_NODE_COUNT` covers teardown better than today. | **Weak, but some of what it guarded stops being possible.** |

### What is simply untested unless something new is built

Ranked by how much it would cost to be wrong:

1. **Real touch against the shipped build.** No Playwright equivalent. This
   becomes an on-device pass in the release checklist, and the checklist must say
   so instead of implying automation.
2. **Audio reaching the mixer.** The planner can be perfect and the bus silent.
   Nothing in CI will catch a wrong bus route or a muted layer.
3. **The art path.** Already Cosmo's largest hole, and a warning about what a
   uniform-name check is worth: `tools/lib/game-source.mjs:20` prepends
   `const host = {}`, so `getTexture` is undefined in every VM harness *and* in
   `rendercheck`, and every render assertion in the repository grades the
   art-free path. `fxcheck` asserts that `uNebulaMap`/`uPlanetMap`/`uRingMap` are
   written every frame — and passes, on a blank texture. Godot does not fix any
   of this. The display lane must load the real textures and assert something
   about them, or it reproduces the same hole with new syntax.
4. **Reduced motion.** All six VM harnesses stub `matchMedia` to
   `{matches:false}`, so the reduced-motion branch has never executed in a check.
   Godot's equivalent (`DisplayServer.is_touchscreen_available()`-style feature
   queries, or your own setting) is at least directly settable from a test — this
   gap is cheaper to close than it is today.
5. **Native packaging and deployment.** Uncovered today
   (`check.delivery.native-sync`, `check.delivery.build-stamp-vs-deploy`) and
   uncovered after. CI can prove an export *produced a file*; it cannot prove a
   deployment happened. Keep the rule that a local build is not deployment
   evidence.

### What gets cheaper

- **Typed compile errors replace a whole class of `smoke.mjs`.** Its own header
  says it "catches TDZ, load-order, null-deref and typo errors that a parse check
  cannot". With `untyped_declaration=2` and the `unsafe_*` warnings as errors,
  most of that becomes a red squiggle in the editor.
- **No runtime extraction.** `tools/lib/game-source.mjs`, the ordered marker
  pair, the empty host stub, the line-number padding, the injected app shell —
  all of it exists because a 12,272-line JavaScript file had to be smuggled into
  a `vm`. Godot harnesses just `preload()` the class. `code.boundary.harness-html`
  and `code.boundary.runtime-extraction` retire with the old stack.
- **The double-loop hazard retires.** `check.delivery.scene-teardown` and the
  "never leave both Phaser input/frames and legacy DOM input/frames active" rule
  exist because two engines were live at once. In Godot the loop is not yours to
  duplicate.
- **Orphan-node counting** gives teardown coverage that no current harness
  provides.

### The two things to decide before writing gameplay code

1. **Is the arrangement a pure planner?** (§2) If yes, `musiccheck`'s coverage
   survives. If no, it does not, and no tooling recovers it.
2. **Is there a seam under `Input`?** (§3) If yes, `smoke.mjs`'s input
   assertions survive headless. If no, they need a display server or they are
   gone.

Both are cheap now and expensive in six months.

---

## Sources

Official documentation (Godot 4.7 stable unless noted):

- Command line tutorial — https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- Exporting projects (command line, `export_presets.cfg`, `export_credentials.cfg`) — https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html
- Version control systems — https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
- Import process (`.import` files must be committed; `.godot/imported`) — https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/import_process.html
- Project organization (`.gdignore`, snake_case, case sensitivity) — https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html
- Running code in the editor (`@tool` hazards) — https://docs.godotengine.org/en/stable/tutorials/plugins/running_code_in_the_editor.html
- Making plugins (`plugin.cfg`, `add_dock`) — https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html
- Making plugins, 4.5 (`add_control_to_dock`, for comparison) — https://docs.godotengine.org/en/4.5/tutorials/plugins/editor/making_plugins.html
- GDScript warning system — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/warning_system.html
- GDScript warning system, 4.3 (no `@warning_ignore_start`) — https://docs.godotengine.org/en/4.3/tutorials/scripting/gdscript/warning_system.html
- Static typing in GDScript — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- GDScript exported properties (`@export_tool_button`) — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_exports.html
- Feature tags — https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html
- Creating movies (Movie Maker mode) — https://docs.godotengine.org/en/stable/tutorials/animation/creating_movies.html
- TSCN/TRES file format — https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html
- `DisplayServer` (headless disables rendering) — https://docs.godotengine.org/en/stable/classes/class_displayserver.html
- `MainLoop` — https://docs.godotengine.org/en/stable/classes/class_mainloop.html
- `SceneTree` (`quit(exit_code)`) — https://docs.godotengine.org/en/stable/classes/class_scenetree.html
- `Performance` (monitors, 1-second refresh) — https://docs.godotengine.org/en/stable/classes/class_performance.html
- `RenderingServer` (`viewport_set_measure_render_time`) — https://docs.godotengine.org/en/stable/classes/class_renderingserver.html
- `RandomNumberGenerator` (PCG32 is not a stability promise) — https://docs.godotengine.org/en/stable/classes/class_randomnumbergenerator.html
- `Shader.get_shader_uniform_list()` — https://docs.godotengine.org/en/stable/classes/class_shader.html
- `ShaderMaterial.set_shader_parameter()` (case-sensitive, must match exactly) — https://docs.godotengine.org/en/stable/classes/class_shadermaterial.html
- `EditorInspectorPlugin` — https://docs.godotengine.org/en/stable/classes/class_editorinspectorplugin.html
- `EditorScript` — https://docs.godotengine.org/en/stable/classes/class_editorscript.html
- `EditorDock` (marked experimental) — https://docs.godotengine.org/en/stable/classes/class_editordock.html
- Download archive (4.7.2-stable, 18 Aug 2026) — https://godotengine.org/download/archive/
- Godot 4.7 release notes — https://godotengine.org/releases/4.7/
- UID changes in 4.4 — https://godotengine.org/article/uid-changes-coming-to-godot-4-4/

Engine source (4.7-stable tag):

- `modules/gdscript/gdscript_warning.h` — `WarnLevel { IGNORE, WARN, ERROR }`, the 46 warning codes
- `modules/gdscript/gdscript_warning.cpp` — the warning name strings

Issues and proposals (status as read on 2026-09-07):

- Headless input not propagated, **open** — https://github.com/godotengine/godot/issues/73557
- Structured headless error output, **proposal** — https://github.com/godotengine/godot-proposals/issues/13048
- Offscreen rendering, **proposal, open** — https://github.com/godotengine/godot-proposals/issues/5790
- `ExtResource` id churn on save (4.1 regression) — https://github.com/godotengine/godot/issues/77172
- Headless stall with a loaded main scene (4.7.1, closed as not planned) — https://github.com/godotengine/godot/issues/122707
- GPU render time returns 0.0 on Metal — https://github.com/godotengine/godot/pull/103014

Tooling (treated as leads, versions read 2026-09-07):

- gdUnit4 — https://github.com/godot-gdunit-labs/gdUnit4 · CLI: https://godot-gdunit-labs.github.io/gdUnit4/latest/advanced_testing/cmd/
- GUT — https://github.com/bitwes/Gut · CLI: https://gut.readthedocs.io/en/latest/Command-Line.html
- gdtoolkit (`gdlint`, `gdformat`) — https://github.com/Scony/godot-gdscript-toolkit
- godot-benchmarks (the engine team's own perf-regression pattern) — https://github.com/godotengine/godot-benchmarks
- github/gitignore `Godot.gitignore` — https://github.com/github/gitignore/blob/main/Godot.gitignore
- godot-ci (community export recipe, export template paths) — https://github.com/abarichello/godot-ci

Cosmo's own record, read for grounding:

- `docs/harnesses.md`, `.github/workflows/pages.yml`, `tools/all.mjs`,
  `tools/lib/rng.mjs`, `tools/lib/game-source.mjs`
- `db/notes/delivery/two-lane-harnesses.md`, `db/notes/audio/coverage.md`,
  `db/notes/render/coverage-gaps.md`
- `node db/query.mjs uncovered` — 24 of 43 coverage records report no assertion
