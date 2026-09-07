# Modern GDScript

> What the language looks like when it is written well in 2026, which parts of it Cosmo's rebuild should actually use, and the Godot 3 habits that will quietly poison a codebase written from tutorials. Written against **Godot 4.7.2** (stable, released 18 August 2026; 4.7 stable landed 18 June 2026).

Everything below was checked against the 4.7 stable documentation and, where the
docs are vague, against the 4.7-stable engine source. Version-gated features say
so. Where the honest answer is "this is worse than what Cosmo has in JavaScript",
it says that too.

---

## The short version

For someone who already knows GDScript and needs the current rules:

1. **Type everything.** Turn `untyped_declaration` and the `unsafe_*` warnings on
   in project settings — they ship **off** — and make them errors. Typed code
   compiles to different, faster opcodes; untyped code silently does not.
2. **`:=` for obvious literals, explicit types at every boundary.** Function
   parameters, return types, exported vars, and anything whose type a reader
   cannot see on the same line get written out.
3. **`Array[T]` since 4.0, `Dictionary[K, V]` since 4.4.** Nested typed
   collections (`Array[Array[int]]`) do not exist. The element type applies to
   `[]`, assignment and `for` — **not** to methods, so `arr.pop_back()` hands you
   a `Variant`.
4. **`const` arrays and dictionaries are read-only automatically.** That is the
   cheapest correct home for a content table that never changes at runtime.
5. **Use the typed math functions.** `clampf`, `lerpf`, `snappedf`, `absf`,
   `roundi`, `minf`/`maxf`. The untyped `clamp`/`lerp`/`abs` take and return
   `Variant` and put you back on the slow path.
6. **Signals are objects.** `hit.connect(_on_hit)`, `hit.emit(x)`. Never
   `connect("hit", self, "_on_hit")` — that is 3.x and does not exist.
7. **Typed signal parameters are documentation, not enforcement.** Nothing checks
   `emit()` arguments. Verify in tests, not in the declaration.
8. **`await` is for one-shot waits, never for scheduling.** It resumes on the
   frame the signal fires, and `await` on a non-signal returns instantly. A
   sample-accurate music scheduler must be a pull loop, not a chain of awaits.
9. **Lambdas capture by value, once, at creation.** Reassignment inside a lambda
   does not reach the outer variable and raises `CONFUSABLE_CAPTURE_REASSIGNMENT`.
10. **Store the `Callable` if you will ever need to disconnect it.** Two lambdas
    written identically are two different targets.
11. **`&"name"` for any string used as an identity** — dictionary keys read every
    frame, `has_method`, input actions, signal and animation names.
12. **A plain `RefCounted` beats a `Node` for anything that is data.** Shards,
    stars, orbs, scheduled notes. Nodes cost tree membership, notifications and
    property lookups you are not using.
13. **`@abstract` (4.5+) for base classes that must never be instantiated.**
    `@export_tool_button` (4.4+), `@export_custom` and `@export_storage` (4.3+),
    `@warning_ignore_start`/`_restore` (4.4+).
14. **Never put `@onready` and `@export` on the same variable.** `@onready` runs
    later and overwrites the exported value. It is an error-level warning for a
    reason.
15. **`assert()` is stripped from release builds and its expression is not
    evaluated.** Invariant checks that must ship are `if` + `push_error`.

---

## 1. Static typing: what it actually buys

Three separate things, and it is worth knowing which is which, because only one
of them is about speed.

**Correctness.** A typed variable cannot hold another type; a typed function
signature is checked at parse time at every call site the analyzer can see.

**The editor.** Autocompletion after a dot only works when the analyzer knows the
type. For a one-owner project that is not a small benefit.

**Performance.** The manual's claim, verbatim:

> "typed GDScript improves performance by using optimized opcodes when
> operand/argument types are known at compile time."

That is the whole documented claim, and the same page notes JIT/AOT compilation
as a *planned future* feature. So: typed GDScript is faster than untyped GDScript
because the VM dispatches specialised instructions, and there is no JIT behind
either. Do not extrapolate a benchmark from that sentence — how big the win is
depends entirely on how much of your hot loop is arithmetic the compiler can
specialise.

### Write it like this

```gdscript
class_name DifficultyClock
extends RefCounted

const SPEED_MAX: float = 4.2
const SPEED_OPEN: float = 1.3
const SPEED_EXP_SPAN: float = 1.7
const SPEED_EXP_TAU: float = 190.0

var _age: float = 0.0

func advance(dt: float) -> void:
    _age += dt

## The single pressure lever. Every other threshold reads this.
func level() -> float:
    return _age

## Comet speed at the current clock.
func speed() -> float:
    var dl: float = level()
    var ramp: float = SPEED_OPEN + SPEED_EXP_SPAN * (1.0 - exp(-dl / SPEED_EXP_TAU))
    return minf(ramp, SPEED_MAX)
```

Every parameter typed, every return typed, constants typed, `minf` rather than
`min`. Nothing here is `Variant`, so nothing here takes the slow dispatch path.

### Inference: `:=`, and when to write the type anyway

```gdscript
var beat := 0                       # obviously int
var spb := 60.0 / 104.0             # obviously float
var ring_radii: Array[float] = []   # write it: [] alone infers an untyped Array
var host: Node = get_parent()       # write it: makes the expectation checkable
```

Two rules that are not obvious:

- **Inferring from a `Variant` is an error, not a warning.** `INFERENCE_ON_VARIANT`
  defaults to `ERROR` in the engine source. `var x := some_dict["k"]` will not
  compile, because untyped dictionary access returns `Variant`. Write
  `var x: float = some_dict["k"]` and accept the runtime conversion, or restructure
  so the value is typed at its source (a typed `Dictionary[K, V]`, or a row class).
- **For constants there is no difference between `=` and `:=`** — the type comes
  from the value either way. But you still want an explicit type on a constant
  *array*: `const A = [1, 2, 3]` is an untyped array, `const A: Array[int] = [1, 2, 3]`
  is not. The manual calls this out specifically.

### Turn the warnings on. They ship off.

This is the highest-value paragraph in this document, because the defaults are
the opposite of what a typed codebase wants. Default levels, read from
`modules/gdscript/gdscript_warning.h` at the `4.7-stable` tag:

| Warning | Default | What it catches |
|---|---|---|
| `UNTYPED_DECLARATION` | **IGNORE** | any `var x = ...` with no type |
| `INFERRED_DECLARATION` | **IGNORE** | any `var x := ...` (stricter still) |
| `UNSAFE_PROPERTY_ACCESS` | **IGNORE** | `.prop` the static type does not declare |
| `UNSAFE_METHOD_ACCESS` | **IGNORE** | `.method()` the static type does not have |
| `UNSAFE_CAST` | **IGNORE** | casting a `Variant` with `as` |
| `UNSAFE_CALL_ARGUMENT` | **IGNORE** | passing a `Variant` into a typed parameter |
| `RETURN_VALUE_DISCARDED` | **IGNORE** | dropping a returned value |
| `MISSING_AWAIT` | **IGNORE** | calling a coroutine without `await` |
| `INTEGER_DIVISION` | WARN | `a / b` on two ints |
| `NARROWING_CONVERSION` | WARN | float silently truncated to int |
| `SHADOWED_VARIABLE` | WARN | a local shadows a member |
| `STANDALONE_EXPRESSION` | WARN | an expression whose value is dropped |
| `CONFUSABLE_CAPTURE_REASSIGNMENT` | WARN | assigning to a lambda's captured variable |
| `REDUNDANT_AWAIT` | WARN | `await` on something that is not a signal |
| `UNSAFE_VOID_RETURN` | WARN | returning the result of a `void` call |
| `STATIC_CALLED_ON_INSTANCE` | WARN | `instance.static_func()` |
| `INFERENCE_ON_VARIANT` | **ERROR** | `:=` from a `Variant` |
| `NATIVE_METHOD_OVERRIDE` | **ERROR** | shadowing an engine method by accident |
| `GET_NODE_DEFAULT_WITHOUT_ONREADY` | **ERROR** | `var n = $Child` without `@onready` |
| `ONREADY_WITH_EXPORT` | **ERROR** | `@onready` and `@export` on one variable |

They live in **Project Settings → Debug → GDScript** (with Advanced Settings on),
as `debug/gdscript/warnings/<lowercase_name>`; each can be Ignore, Warn or Error.
For a project one person will maintain for years, setting `untyped_declaration`
and the four `unsafe_*` warnings to **Error** in the first commit is far cheaper
than retrofitting types later — and it is what makes the "typed opcodes" claim
apply to your code rather than to the examples in the manual.

Also enable the editor setting **Text Editor → Completion → Add Type Hints**, so
generated callbacks and overrides come out typed.

To silence one unavoidable case without weakening the setting globally:

```gdscript
@warning_ignore("unsafe_method_access")
func _poke(obj: Object) -> void:
    obj.refresh()

# Or a whole region (4.4+):
@warning_ignore_start("unsafe_property_access")
func _bulk() -> void:
    pass
@warning_ignore_restore("unsafe_property_access")
```

`@warning_ignore_restore` may be omitted, in which case the suppression runs to
the end of the file — which is almost never what you want.

### Safe lines, and why `as` is a trap

The editor colours line numbers green when it can prove a line is type-safe. The
manual then immediately warns you not to treat that as a quality signal:

```gdscript
@onready var node_1 := $Node1 as Type1  # "safe" line — silently null on mismatch
@onready var node_2: Type2 = $Node2     # "unsafe" line — errors loudly at load
```

`as` on a mismatched object type produces `null`, with no error. The second form
is the one you want: it fails at scene load, next to the mistake. Reserve `as`
for the case where `null` is a *meaningful answer* you are about to test:

```gdscript
var orb := body as Orb
if orb != null:
    collect(orb)
```

The documented safe pattern for reaching into a `Variant` you were handed:

```gdscript
func _on_body_entered(body: Node2D) -> void:
    var label_variant: Variant = body.get("label")
    if label_variant is Label:
        var label: Label = label_variant
        label.text = name
```

### The typed replacements for the global math functions

Untyped `abs`, `clamp`, `lerp`, `round`, `sign`, `snapped`, `floor`, `ceil`, `min`,
`max` take and return `Variant`. Every one has typed counterparts, and using them
is what keeps a hot loop on safe lines:

| Untyped | Typed |
|---|---|
| `abs()` | `absf()`, `absi()`, `Vector2.abs()` … |
| `clamp()` | `clampf()`, `clampi()`, `Vector2.clamp()` … |
| `lerp()` | `lerpf()`, `Vector2.lerp()`, `Color.lerp()` … |
| `round()` | `roundf()`, `roundi()` |
| `sign()` | `signf()`, `signi()` |
| `snapped()` | `snappedf()`, `snappedi()` |
| `floor()` / `ceil()` | `floorf()`/`floori()`, `ceilf()`/`ceili()` |
| `min()` / `max()` | `minf()`/`mini()`, `maxf()`/`maxi()` |

The manual's own instruction: "When using static typing, use the typed global
scope methods whenever possible." All of the above were confirmed present in
`doc/classes/@GlobalScope.xml` at `4.7-stable`.

---

## 2. Typed collections, and exactly where the typing stops

| Feature | Arrived in |
|---|---|
| `Array[T]` | 4.0 |
| Typed `for` loop variable — `for name: String in names:` | 4.2 |
| `Dictionary[K, V]` | 4.4 |
| `Array.duplicate_deep()` | 4.5 (absent from the 4.4 class reference) |

```gdscript
var scores: Array[int] = [10, 20, 30]
var rings: Array[Ring] = []
var costs: Dictionary[StringName, int] = { &"shield": 302, &"warp": 185 }
var rows: Array[Array] = [[1.0, 2.0], [3.0, 4.0]]   # legal
# var grid: Array[Array[float]]                      # NOT legal, at any version
```

**Where the element type applies:** `for` loop variables, `[]` access, `[...] =`
assignment, and `+` for arrays. **Where it does not:** methods and comparisons.
That distinction costs people an afternoon, so make it concrete:

```gdscript
var pool: Array[Shard] = []
var a: Shard = pool[0]        # typed: analyzer knows this is a Shard
var b := pool.pop_back()      # NOT typed: pop_back() returns Variant
var c: Shard = pool.pop_back()  # write the type; the conversion is checked at runtime
```

With `INFERENCE_ON_VARIANT` at its default of `ERROR`, the `var b := ...` line
above will not even compile. That is the warning doing its job: it is telling
you the type stopped at the method boundary.

**Assigning an untyped array into a typed one fails.** The fix is `assign()`,
which resizes and converts:

```gdscript
var raw: Array = _load_json_rows()
var rows: Array[float] = []
rows.assign(raw)   # converts; errors if an element cannot convert
```

**`const` collections are read-only for free.** From the `Array` class reference:
"In GDScript, arrays are automatically read-only if declared with the `const`
keyword." No `make_read_only()` call needed, no defensive `duplicate()` on every
read. This makes `const` the natural home for authored content tables — see §7.

**`duplicate()` is shallow.** Nested arrays, dictionaries and resources are shared
with the original. `duplicate_deep()` (4.5+) takes a mode controlling how
subresources are handled. If you copy a table row to mutate it per-run, this is
the difference between a per-run copy and quietly editing your content table.

**Packed arrays** (`PackedFloat32Array`, `PackedInt32Array`, `PackedVector2Array`)
are typed C++ vectors rather than `Vector<Variant>`. For a large block of numbers
that is written and read every frame and never holds objects, they are the
correct container. I have no citable benchmark for the size of the difference —
the documented facts are that `Array` is `Vector<Variant>` with contiguous
storage, and that packed arrays store the concrete type. Treat "packed arrays are
faster for bulk float data" as reasoning, not as a measured claim.

---

## 3. The annotation set, and the ones that matter here

Every annotation in 4.7, from the `@GDScript` class reference:

`@abstract` · `@export` · `@export_category` · `@export_color_no_alpha` ·
`@export_custom` · `@export_dir` · `@export_enum` · `@export_exp_easing` ·
`@export_file` · `@export_file_path` · `@export_flags` · `@export_flags_2d_navigation` ·
`@export_flags_2d_physics` · `@export_flags_2d_render` · `@export_flags_3d_navigation` ·
`@export_flags_3d_physics` · `@export_flags_3d_render` · `@export_flags_avoidance` ·
`@export_global_dir` · `@export_global_file` · `@export_group` · `@export_multiline` ·
`@export_node_path` · `@export_placeholder` · `@export_range` · `@export_storage` ·
`@export_subgroup` · `@export_tool_button` · `@icon` · `@onready` · `@rpc` ·
`@static_unload` · `@tool` · `@warning_ignore` · `@warning_ignore_restore` ·
`@warning_ignore_start`

Version gates, verified by diffing the class reference across doc versions:

| Annotation | First appears in |
|---|---|
| `@static_unload` | 4.1 |
| `@export_custom`, `@export_storage` | 4.3 |
| `@export_tool_button`, `@warning_ignore_start`, `@warning_ignore_restore` | 4.4 |
| `@abstract` | 4.5 |

### The export hint vocabulary worth knowing

```gdscript
@export_group("Sky")
@export_range(0.0, 1.0, 0.01) var arena_calm: float = 0.62
@export_range(0.0, 1.0, 0.01) var gl_motion: float = 0.25
@export_range(0.0, 4.2, 0.05, "or_greater", "suffix:rings/s") var speed_max: float = 4.2
@export_range(0.0, 20.0, 0.1, "exp", "hide_slider") var decay_tau: float = 190.0
@export_exp_easing var impact_curve: float = 1.0
@export_color_no_alpha var nebula_tint: Color = Color(0.2, 0.1, 0.4)

@export_group("Content")
@export var levels: Array[LevelRow] = []
@export_file("*.json") var manifest_path: String = ""
@export_enum("Verse", "Chorus", "Payoff") var opening_section: int = 0
@export_multiline var card_body: String = ""

@export_group("")   # end the group
@export_storage var _last_seed: int = 0   # saved, but not shown in the inspector
@export_custom(PROPERTY_HINT_NONE, "suffix:px") var halo_radius: float = 0.0
```

- `"or_greater"` / `"or_less"` free the *typed* value from the slider's range.
- `"exp"` gives an exponential slider — right for a value that spans decades.
- `"suffix:s"`, `"suffix:px"`, `"radians_as_degrees"`, `"degrees"` are hint strings
  on `@export_range`; `radians_as_degrees` converts for display only.
- `@export_custom` performs **no validation** on your hint string. A typo behaves
  strangely in the inspector rather than erroring.
- Groups cannot nest; use `@export_subgroup` inside a group, and
  `@export_group("")` to break out.
- Exporting an `Array[T]` where `T` extends `Resource` lets you drag several files
  from the FileSystem dock at once.
- Packed arrays export **only if initialised empty**: `@export var s = PackedStringArray()`.

`@export_tool_button` (4.4+) exports a `Callable` as an inspector button — the
cheapest possible content tool, with no editor plugin:

```gdscript
@tool
extends Resource

@export_tool_button("Rebuild pitch table", "Callable") var rebuild_action: Callable = _rebuild

func _rebuild() -> void:
    # regenerate a derived table, then:
    notify_property_list_changed()
```

The icon name must be one of the engine's own editor icons; project icons are not
supported.

### Initialization order — memorise this list

From the manual, in order:

1. Variables get the default for their static type (`null`, `0`, `false` …).
2. Declared initialisers run **top to bottom** — except `@onready` ones, deferred
   to step 5.
3. `_init()` runs.
4. Exported values from the scene/resource file are applied.
5. `@onready` variables initialise (Node-derived classes only).
6. `_ready()` runs.

Three consequences that bite:

- **Reading an exported variable in `_init()` gives you the annotation's default**,
  not the inspector value — step 4 has not happened yet. Read it in `_ready()`, or
  in the property's own setter (the only option for a `Resource`, which has no
  `_ready`).
- **`@onready` + `@export` on one variable is broken by construction.** The manual's
  own demonstration:

  ```gdscript
  @export var a = "init_value_a"
  @onready @export var b = "init_value_b"
  # _ready() prints: exported_value_a init_value_b   <- b's export was overwritten
  ```

  `ONREADY_WITH_EXPORT` is an error-level warning by default. Leave it that way.
- **A member initialiser that calls a function which touches another member** runs
  in declaration order, so a helper dictionary declared *below* the variable that
  fills it gets clobbered by its own `= {}`.

### `@tool` is contagious, and it lies about static variables

If you write editor tooling — and a data-heavy game is a good reason to —
three documented rules:

- "any other GDScript that your tool script uses must *also* be a tool". The
  editor cannot construct instances from non-tool scripts. Static **methods**,
  constants and enums are the exception and can be reached.
- **Static variables are not the exception.** Reading a static variable from a
  script that lacks `@tool` "will always return `null` but won't print a warning
  or error". A silent `null` inside editor tooling is a genuinely expensive bug.
- Extending a `@tool` script does not make the subclass a tool script; it must
  declare `@tool` itself.

Guard editor-time side effects with `Engine.is_editor_hint()`, and be careful with
`queue_free()`/`free()` in tool scripts — the manual warns it can crash the editor.

### `@rpc`

`@rpc("any_peer", "call_local", "reliable")` marks a function callable over the
high-level multiplayer API. **Cosmo has no multiplayer**, and its optional cloud
account is an HTTP call, not a peer connection. Skip it; do not let a tutorial
architecture drag `MultiplayerAPI` into a single-player arcade.

---

## 4. Callables, lambdas and signals

Signals and callables are first-class `Variant` types since 4.0. This is the
single biggest syntactic break from Godot 3 and the one most stale answers get
wrong.

```gdscript
class_name Run
extends RefCounted

signal ring_changed(from_ring: int, to_ring: int)
signal starfall_earned(orbits: int)
signal ended(score: int, level: int)

func hop_to(ring: int) -> void:
    var previous := _ring
    _ring = ring
    ring_changed.emit(previous, ring)
```

```gdscript
# Connecting. No strings anywhere.
run.ring_changed.connect(_on_ring_changed)
run.ended.connect(_on_ended, CONNECT_ONE_SHOT)
run.starfall_earned.connect(_hud.flash.bind(&"starfall"))
```

`Signal.connect(callable: Callable, flags: int = 0) -> int` returns an error code;
connecting the same `Callable` twice returns `ERR_INVALID_PARAMETER` and prints an
error unless you passed `CONNECT_REFERENCE_COUNTED`.

The connect flags, all documented on `Object`:

| Flag | Effect |
|---|---|
| `CONNECT_DEFERRED` | callable runs at idle time (end of frame), not instantly |
| `CONNECT_PERSIST` | connection is serialised with the scene; **not usable with lambdas** |
| `CONNECT_ONE_SHOT` | disconnects itself after the first emission |
| `CONNECT_REFERENCE_COUNTED` | same callable may connect repeatedly; counted |
| `CONNECT_APPEND_SOURCE_OBJECT` | appends the emitting object after the arguments |

`CONNECT_DEFERRED` is the tool for "react to this, but not while the emitter is
mid-update" — the ordering hazard that a mutable global run-state record creates
naturally.

### Typed signal parameters are not enforced

Write them anyway — the editor's signal dock uses them to generate callbacks, and
they document intent — but do not believe them. The manual says the argument list
is advisory: "you can still emit any number of arguments when you emit signals;
it's up to you to emit the correct values." Godot issue #110573, filed against
4.4.1/4.5 with exactly this complaint ("I can statically type the parameters of a
signal, but this is being ignored"), was **closed as not planned**. So the
declared types are neither checked at parse time nor at emit time.

The practical consequence for a rebuild: the harness, not the compiler, is what
holds signal contracts. A check that emits every gameplay signal once and asserts
the handler received what it expected is worth writing.

### Callables: bind, unbind, and the freed-object rule

```gdscript
var cue := _audio.play_cue.bind(&"unlock")   # bound args are appended AFTER emitted args
level_up.connect(cue)
...
level_up.disconnect(cue)                     # same Callable value: works
```

- `bind()` appends arguments; `unbind(n)` drops the last `n` supplied ones. Both
  produce a *custom* callable, and `is_custom()` reports that.
- `is_valid()` is true when "the callable's object exists and has a valid method
  name assigned, or is a custom callable" — note that a lambda is always valid,
  so this only tells you something about method callables.
- "If the callable's object is freed, the connection will be lost" — the engine
  drops it for you, so a freed listener is not a dangling call. It is still a
  silently vanished behaviour, which is why teardown should disconnect
  deliberately rather than relying on this.
- `Callable` carries **no signature in the type system**. `var f: Callable` tells
  the analyzer nothing about arity or parameter types; `get_argument_count()` is a
  runtime query. This is a real hole: a callback table (Cosmo has several — cue
  dispatch, screen dispatch, orb effects) gets zero static checking. Prefer a small
  `@abstract` class with a typed method over a dictionary of `Callable`s when the
  set is fixed and known.

### Lambdas: capture by value, once

```gdscript
var x := 42
var show := func () -> void: print(x)
show.call()   # 42
x = 7
show.call()   # still 42
```

The manual is blunt about the two failure modes:

- Locals are "captured by value once, when the lambda is created", so later
  reassignment of the outer variable is invisible to the lambda.
- A lambda **cannot reassign** an outer local — the capture shadows it, the outer
  value is unchanged after the call, and you get `CONFUSABLE_CAPTURE_REASSIGNMENT`.
- Pass-by-reference values (arrays, dictionaries, objects) *do* share mutations —
  until you reassign the variable inside the lambda, at which point the lambda is
  writing to its own copy of the reference.

And the disconnect trap: `Callable == Callable` is true when both "invoke the same
custom target". Two textually identical lambdas are two targets, so this silently
fails:

```gdscript
# WRONG: the disconnect does nothing.
timer.timeout.connect(func () -> void: _tick())
timer.timeout.disconnect(func () -> void: _tick())

# RIGHT:
var on_tick := func () -> void: _tick()
timer.timeout.connect(on_tick)
timer.timeout.disconnect(on_tick)
```

Lambdas cannot be `static`, and cannot be `CONNECT_PERSIST`.

---

## 5. `await`, coroutines, and where it is a trap

`await` suspends the function and returns control to the caller until a signal
fires or an awaited coroutine finishes. The semantics that matter, all from the
manual:

```gdscript
func wait_confirmation() -> bool:
    await $Button.button_up
    return true

func request() -> void:
    var confirmed := await wait_confirmation()   # caller must await too
```

- **Awaiting propagates.** A function containing `await` becomes a coroutine; any
  caller that wants its return value must `await` it, and reading the return value
  without `await` is an error. Calling it without `await` and ignoring the result
  is legal and runs asynchronously — this is where a run silently continues past a
  step you thought it waited for. Turn on `MISSING_AWAIT` (default IGNORE).
- **`await` on a non-signal returns immediately** and does not make the function a
  coroutine. `REDUNDANT_AWAIT` warns about the obvious case, but not about an
  expression whose value merely happens not to be a signal at runtime.
- **The awaited value's shape depends on the signal's arity**: one parameter gives
  you that value, more than one gives an `Array`, none gives `null`. Writing a
  typed variable for the result of `await` on a multi-parameter signal will fail
  in a way that reads like a type bug and is actually an arity bug.
- **You cannot obtain the function-state object.** Unlike 3.x `yield`, there is no
  handle, deliberately — "this is done to ensure type safety". You therefore
  **cannot cancel an `await`**. If the awaited signal never fires, that coroutine
  is parked forever, holding its captured references.

That last point is the load-bearing one. A one-shot wait is fine:

```gdscript
await get_tree().create_timer(0.35, false).timeout   # false: pauses with the tree
```

`SceneTree.create_timer(time_sec, process_always := true, process_in_physics := false,
ignore_time_scale := false)` — note that the default `process_always = true` means
the timer keeps running while the tree is paused, which is usually *not* what a
gameplay delay wants, and that the timer updates *after* every node's `_process`.

But a chain of `await`s is not a scheduler. It resumes on a frame boundary, it
inherits every frame-rate hiccup, it cannot be cancelled, and it cannot be
inspected. Anything with a musical deadline must be a **pull loop that reads a
clock**, of exactly the shape Cosmo already uses:

```gdscript
## Schedules ahead on the audio clock. Never awaits.
func tick(now: float) -> void:
    while _next < now + LOOKAHEAD:
        if _next < now - DROPOUT:
            _resync(now)          # a backgrounded app: abandon, do not replay
            return
        _step(_index, _next)
        _index = (_index + 1) % STEPS
        _next += _spb * 0.5
```

The language gives you nothing better than this for scheduling, and nothing worse
either — it is the same shape the current JavaScript runtime uses, and it survives
the port unchanged.

---

## 6. `StringName`, `String`, `NodePath`

`StringName` is an interned string: "two StringNames with the same value are the
same object", so comparison is pointer identity and "extremely fast compared to
regular Strings". Creation is the expensive part, which is exactly why the literal
form exists.

```gdscript
const RING_KEYS: Array[StringName] = [&"outer", &"mid", &"inner", &"core"]

var counts: Dictionary[StringName, int] = {}
var prior: int = counts.get(&"shield", 0)   # get() returns Variant: write the type
counts[&"shield"] = prior + 1               # [] assignment is typed
```

When `&` earns its place:

- **Any string that is an identity rather than text**: orb kinds, ring ids, lesson
  ids, cue names, telemetry event names, save keys.
- **Keys of a dictionary read every frame.** The interning is the whole point.
- **Engine APIs that take a `StringName`**: `has_method()`, `call()`,
  `Input.is_action_pressed()`, animation and signal names. You *may* pass a
  `String` — it converts automatically, "often at compile time" — but a `String`
  built at runtime (concatenation, formatting) converts at runtime, every call.
  A literal `&"..."` never does.

Do **not** use `StringName` for player-facing text, anything you slice or format,
or one-off strings. Interning has a cost and a global table.

One sharp edge worth knowing: `match` is stricter than `==` — `1` does not match
`1.0` — but String/StringName is the documented exception, so `"hello"` matches
`&"hello"` in a `match`.

`NodePath` has the parallel literal `^"Path/To/Node"`. Same reasoning; less
relevant to a game whose entities are not nodes.

---

## 7. Classes: `class_name`, inner classes, `@abstract`, `static`

### `class_name` versus a preloaded const

Two documented ways to use another script as a type:

```gdscript
const Shard = preload("res://sim/shard.gd")   # file-local name, no global registration
var s := Shard.new()
```

```gdscript
# In shard.gd:
class_name Shard
extends RefCounted
```

`class_name` registers the type globally — usable as a type hint anywhere, shows
in the editor's create dialog, gets an icon via `@icon`. The `preload` const form
keeps the name local and is the escape hatch when you do not want a global.

Note the naming convention the manual models: `const BuildingScn = preload(...)`
uses PascalCase for preloaded scripts/scenes, because they are types, not values.
And its anti-pattern, worth repeating: **never write
`@export var scene: PackedScene = preload("res://x.tscn")`** — the export is
overwritten by the scene file's stored value anyway, so the preload is wasted, and
instantiating the script directly with `.new()` ignores the export. Export it with
a `null` default.

### Inner classes

```gdscript
class_name Arena
extends Node2D

class Ring:
    var radius: float
    var index: int

    func _init(p_index: int, p_radius: float) -> void:
        index = p_index
        radius = p_radius

var _rings: Array[Ring] = []
```

Inner classes are usable as type hints, keep small helper types next to their only
user, and avoid polluting the global class list. For a game with a dozen row types
that only one system reads, this is the right default — `class_name` is for the
types that cross subsystems.

### `@abstract` (4.5+)

```gdscript
@abstract
class_name Formation
extends RefCounted

var tier: int = 0

@abstract func place(clock: float, rings: Array[float]) -> void

func describe() -> String:
    return "tier %d" % tier
```

Rules: an abstract method has **no body** — a newline or `;` follows the header. A
class with any unimplemented abstract method must itself be `@abstract`. An
abstract class may have no abstract methods. Inner classes may be abstract
(`@abstract class Foo:`). For an unnamed script, `@abstract` goes above `extends`.
You cannot attach an abstract script to a node — the engine errors at scene run.

Before 4.5 the idiom was a base method that called `push_error()` or
`assert(false)`; if you read that in an older answer, it is obsolete.

### `static var`, `static func`, `_static_init`, `@static_unload`

Static variables arrived in 4.1.

```gdscript
class_name Tables
extends RefCounted

static var levels: Array[LevelRow] = []

static func _static_init() -> void:
    levels = _build_levels()

static func level_for(dl: float) -> LevelRow:
    for row: LevelRow in levels:
        if dl < row.finish:
            return row
    return levels[levels.size() - 1]
```

- `_static_init()` runs automatically when the class loads, after static variables
  initialise. It takes no arguments and returns nothing.
- A static function has no `self` and no instance members, but does see static
  variables.
- `@export` and `@onready` cannot apply to a static variable, and locals cannot be
  static.
- Static variables keep the script resource loaded. `@static_unload` (top of file,
  before `class_name`/`extends`) is meant to release it — but the manual carries a
  standing warning: "Currently, due to a bug, scripts are never freed, even if
  `@static_unload` annotation is used." Treat static state as permanent for the
  process lifetime and keep it small.
- The `@tool` interaction from §3 applies: a non-tool script reading a static
  variable gets `null`, silently.

This is the honest shape for authored content tables: a class of `static var`
tables built once in `_static_init()`, typed rows, no scene, no autoload
singleton, no node. When the table is pure literals, `const` is better still,
because `const` collections are read-only:

```gdscript
const LEVEL_WINDOWS: Array[float] = [0.0, 90.0, 215.0, 340.0, 470.0, 610.0]
const KEY_RATIOS: Array[float] = [1.0, 0.8909, 0.7937, 0.7071, 0.6300, 0.5612]
```

**A limitation that will catch you:** `const` requires a *constant expression*, and
`Row.new(...)` is a call, so you cannot build a `const` array of row objects.
`preload()` **is** constant, so `const` arrays of preloaded `.tres` resources are
legal. Your three real options for a table of typed rows:

1. `const` arrays/dictionaries of literals — free read-only, no row type.
2. `static var` array of `RefCounted` rows filled in `_static_init()` — typed
   fields, code-authored, invisible to the inspector.
3. A container `Resource` with `@export var rows: Array[LevelRow]` and rows as
   `.tres` files — inspector-editable, diffable, one file per row.

### `RefCounted` vs `Object` vs `Node`

Godot has reference counting, not a garbage collector:

- `RefCounted` (and `Resource`, which extends it) frees itself when the last
  reference goes away.
- `Object` and `Node` live until `free()` (or `queue_free()` for nodes). Freeing a
  node recursively frees its children.
- Cycles between `RefCounted` objects never free. `weakref()` breaks them;
  `is_instance_valid(obj)` tests a non-reference-counted object you are holding.

The manual's own guidance on choosing:

- **Object** — "the ultimate lightweight object", manual memory, and "references
  can become invalid without warning". Rarely worth it in GDScript.
- **RefCounted** — "works well in the majority of cases where one needs data in a
  custom class". This is the default for game data.
- **Resource** — RefCounted plus serialisation and inspector editing. Use it when
  a designer (or you, later) should edit the thing as a file.
- **Node** — tree membership, `_process`, notifications, signals from the scene
  tree. The docs are explicit that nodes are cheap individually but "the more
  complex their behavior, the larger the strain each one adds".

The scripting-API cost is documented plainly on the data-preferences page: every
property or method access walks the object's script and then its inheritance chain
through `ClassDB`, and "the reason GDScript is slow is because every operation it
performs passes through this system". That is the argument for keeping per-frame
entities as plain typed fields on `RefCounted` rows in typed arrays rather than as
nodes with exported properties.

(Note: that same page still says "extends from Reference" in one place — Godot 3's
name for `RefCounted`. The official docs are not uniformly modernised, which is a
useful thing to remember when something you read there does not compile.)

---

## 8. Properties, `match`, enums, and the rest

### Properties are not 3.x `setget`

```gdscript
signal score_changed(value: int)

var _score: int = 0
var score: int:
    get:
        return _score
    set(value):
        _score = value
        score_changed.emit(value)
```

The rules that differ from `setget`:

- **Setters and getters are always called**, including from inside the class, with
  or without `self.`. `setget` did not.
- **They are not called when the variable is initialised** — the initialiser writes
  straight through, "even if the `@onready` or `@export` annotation is applied".
- **Using the property's own name inside its accessor accesses the underlying
  member directly**, so this does not recurse:

  ```gdscript
  var warns_when_changed = "some value":
      get:
          return warns_when_changed
      set(value):
          changed.emit(value)
          warns_when_changed = value
  ```

- Inline accessors **cannot have type hints** — the setter's argument type is the
  variable's type automatically. The separated form (`var x: get = get_x, set = set_x`)
  can be typed, and must match or widen the variable's type. You cannot mix the two
  notations on one variable.

Note the recursion trap the manual demonstrates: a *separated* setter that assigns
through the property name **does** recurse, because the plain function is not
"the setter" in the sense above.

### `match`

```gdscript
enum Kind { SINGLE, TWIN, GATE, WALL, SAUCER, DIVE }

func spawn(kind: Kind, dl: float) -> void:
    match kind:
        Kind.SINGLE:
            _spawn_single()
        Kind.TWIN, Kind.GATE:
            _spawn_pair(kind)
        Kind.WALL when dl >= 340.0:
            _spawn_wall()
        var other:
            push_error("unhandled formation kind %d" % other)
```

- `match` is **stricter than `==`**: `1` does not match `1.0`. The one exception is
  `String` versus `StringName`.
- Patterns: literal, constant expression (including `A.B`), wildcard `_`, binding
  `var name`, array `[1, 2, ..]`, dictionary `{"key": value, ..}`, comma-separated
  alternatives, and `when` guards.
- A guard is only evaluated if its pattern already matched; if the guard is false,
  matching continues with the next branch.
- 3.x's special `continue` behaviour inside `match` was **removed in 4.0**.

### Enums

```gdscript
enum Kind { SINGLE, TWIN, GATE, WALL, SAUCER, DIVE }

var kind: Kind = Kind.SINGLE
```

- A named enum is a constant `Dictionary`, so `Kind.keys()`, `Kind.values()` and
  the rest of the constant dictionary methods work. Keys are **not** global; always
  `Kind.SINGLE`.
- An enum used as a type hint is documented as "just an `int`, there is no
  guarantee that the value belongs to the set of enum values". So `var k: Kind = 99`
  is legal. `INT_AS_ENUM_WITHOUT_CAST` (WARN by default) catches assigning a plain
  int; keep it on.
- `ENUM_VARIABLE_WITHOUT_DEFAULT` warns about an enum-typed variable with no
  initialiser, which is the case where a stray `0` means the first member by
  accident.

### `assert` disappears in release builds

"These assertions are ignored in non-debug builds. This means that the expression
passed as argument won't be evaluated in a project exported in release mode."

So `assert(_advance_clock())` does nothing in the shipped game. Assertions are for
harnesses and debug play; a rule that must hold in a player's hands is an `if` and
a `push_error()`.

### Variadic functions (4.5+)

```gdscript
func log_cue(name: StringName, ...values: Array) -> void:
    prints(name, values)
```

One rest parameter, last, no default, and **typed arrays are not supported as the
rest parameter's type** (`...values: Array[int]` is rejected). There is no spread
syntax at call sites; use `callv(array)`.

---

## Pitfalls

### Godot 3 idiom that must never appear

| 3.x | 4.x |
|---|---|
| `yield(obj, "signal")` | `await obj.signal_name` |
| `var x setget set_x, get_x` | `var x: set = set_x, get = get_x` or an inline `set:`/`get:` block |
| `export(int) var x` | `@export var x: int` |
| `obj.connect("sig", self, "_on_sig")` | `obj.sig.connect(_on_sig)` |
| `emit_signal("sig", a)` | `sig.emit(a)` (the string form still exists; it is not idiom) |
| `Tween` as a node | `create_tween()` on any Node |
| `KinematicBody2D`, `move_and_slide(vel, UP)` | `CharacterBody2D`, set `velocity`, call `move_and_slide()` |
| `PoolFloatArray` | `PackedFloat32Array` |
| `instance()` on a `PackedScene` | `instantiate()` |
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` / `Time.get_ticks_usec()` |
| `Reference` | `RefCounted` |
| base method with `push_error("abstract")` | `@abstract func` (4.5+) |

### The ones that cost a day

1. **Warnings that ship off.** `untyped_declaration`, all four `unsafe_*`,
   `return_value_discarded` and `missing_await` default to IGNORE. A codebase can
   look fully typed and be riddled with `Variant` boundaries until you turn them on.
2. **`as` returning `null` silently.** The "safe line" is the dangerous one.
3. **Typing stops at method calls.** `typed_array.pop_back()` is a `Variant`; so is
   every value out of an untyped `Dictionary`.
4. **`@onready` with `@export`.** The export is overwritten. Error by default —
   leave it.
5. **Reading exports in `_init()`.** You get the annotation default, not the
   inspector value.
6. **Lambda captures freeze at creation**, and reassigning inside a lambda writes
   to the capture, not the outer variable.
7. **Disconnecting a lambda you did not store.** Silent no-op.
8. **Typed signal parameters are not checked.** Neither arity nor type.
9. **`await` cannot be cancelled**, and an awaited signal that never fires parks
   the coroutine and its captures forever.
10. **`const` cannot hold constructed objects.** `preload()` is constant;
    `Row.new()` is not.
11. **`@tool` contagion and the silent `null`** when a non-tool script reads a
    static variable.
12. **`assert()` vanishes in release builds** — including its side effects.
13. **`Array.assign()` versus `=`.** Assigning an untyped array to a typed one is an
    error, not a conversion.
14. **Integer division.** `dl / 150` on two ints truncates; `INTEGER_DIVISION` warns,
    and this is the classic silent-zero in a normalisation term.

### Two I could not verify

- **Typed array variance.** Whether `Array[Node2D]` is assignable to `Array[Node]`
  is not stated in the docs I read, and I could not run an engine to check. Assume
  invariance and write the target type explicitly.
- **The cost of a `Callable.call()` versus a direct method call.** Frequently
  asserted online, never with a citation I would trust. If a per-frame dispatch
  table matters, measure it in your own build rather than believing either of us.

---

## In Cosmo

Where each of the above lands in this specific rebuild. Anchors are into the
current Phaser implementation — read them for the problem, then solve it in Godot
idiom, per `db/ONTOLOGY.md`'s `reference` rule.

**The run state record (`G`, `src/game/runtime.js:5001-5079`).** One mutable
object holding state, clocks, score, rings, shields, every timed reward and every
teaching flag, with the standing rule that a new field must declare which clock
its deadline lives on (`rule.sim.two-clocks`). In Godot this is a `class_name
RunState extends RefCounted` with every field typed, grouped by clock, and a
`reset(carried: bool)` that mirrors `startGame`'s carried/fresh split. Typed
fields are what make "which clock does this deadline read?" answerable by the
editor instead of by grep. Not a node, not an autoload: one object the scene owns.

**The music scheduler (`musicStep`/`musicTick`, `src/game/runtime.js:1623-2213`).**
Schedules eighths on the audio clock with a 0.16 s lookahead, abandons the phrase
if it falls 0.4 s behind, and dispatches through an ordered chain where each
branch means "this owns the bar". Everything in §5 applies: **no `await`, no
`SceneTreeTimer`, no coroutine anywhere in this path.** The dispatch chain is a
`match` on a small enum of owners (black hole, payoff, drop, star dive, break,
sparse, driving) with `when` guards for the hot/cold conditions, which makes the
priority order readable as one block rather than as a ladder of early returns.
Pitches stay intervals over the level tonic (`rule.audio.diatonic-and-subf`), so
the tables are `const Array[int]` degrees, not floats.

**The difficulty clock (`dl()`, `src/game/runtime.js:4399-4565`).** Six pressure
terms keyed off one number, with every threshold below dl 420 deliberately frozen.
This is the archetype for §1: a `RefCounted` with typed constants
(`SPEED_MAX = 4.2`, `speed_exp_tau = 190`), typed pure functions, and `clampf`/
`minf`/`lerpf` throughout. Watch `INTEGER_DIVISION` on the normalisation terms —
`min(1, dl()/150)` becomes `minf(1.0, dl / 150.0)`.

**Content tables.** `LV` (six rows of `{dl0, end, name, key, mech}`,
`src/game/runtime.js:3008-3081`), `RADII` and the four ring instrument rows, the
eight `WORLDS` parameter rows, `POWPOOL`'s nine weighted orbs with level floors,
the formation tier ladder, the twelve upgrade tiles. Per §7: literal-only tables
(`LEVEL_WINDOWS`, `KEY_RATIOS`) as `const Array[float]`, which are read-only for
free; row tables with real fields as either `static var` arrays of typed
`RefCounted` rows built in `_static_init()`, or `.tres` resources under a
container with `@export var rows: Array[LevelRow]`. `LEVEL_MAX` stays
`LEVELS.size()`, never a literal — the current code already holds that line and a
check asserts it. Keep tier ordinals and level names in separate types so
`rule.curriculum.tier-vs-level` is enforced by the type system rather than by
review.

**Entities (shards, stars, orbs, popups).** Cosmo's objects are rows in flat
arrays placed on an ellipse by `posAt`, not independent actors, and the arena has
a hard four-popup cap. Per §7's `RefCounted` guidance these stay data —
`Array[Shard]` with a free-list, drawn by one `_draw()`/`RenderingServer` pass —
rather than a node per shard. The tuned `shardCap`/`emberCap` numbers become the
pool sizes, allocated once at load.

**Save data (`readLocal`/`loadPrefs`/`savePref`, `src/game/runtime.js:3643-3751`).**
Every key prefixed `cometloop:`, every read and write wrapped because storage can
throw, records folded with `Math.max` so a late cloud read cannot lower a record,
and two keys deliberately never read back. In Godot the keys become
`const Dictionary[StringName, int]` defaults with `&"..."` keys, the folding rule
becomes `maxi()`, and the "never read these two" decision needs to travel as a
comment plus a record — it is exactly the kind of intent a rebuild loses.

**Signals at the seams.** The current runtime has no event bus; ownership is call
order. Do not invent one. The places where a Godot signal genuinely fits are the
few that already exist as one-directional announcements: run ended, level
complete, lesson dismissed, upgrade offered, starfall earned. Everything else stays
a direct typed call. Where a listener must not run mid-update, use
`CONNECT_DEFERRED` rather than a queue of your own.

**Teardown.** `rule.delivery.scene-teardown` and `code.boundary.scene-shutdown`
require that shutdown removes every listener, stops audio and releases GPU
resources, with no second game left running. In Godot that means every `connect()`
in a scene has a matching `disconnect()` in `_exit_tree()` **using a stored
`Callable`** (§4), and no lambda connections on long-lived autoloads or servers.

**Input (`code.boundary.input`).** Tap turns, swipe changes ring, always
(`rule.curriculum.tap-turns-swipe-rings`). Gesture classification is arithmetic on
typed floats — the whole path should be typed and allocation-free, and the action
names, if any reach `InputMap`, are `&"..."` literals.

**Harnesses.** The current project's checks are Node scripts that extract the
runtime and assert against it. Godot's replacement is GDScript test scripts run
headlessly, and §4's finding matters here: because typed signal parameters are not
enforced and `Callable` has no signature type, the checks are the only thing
holding those contracts. Keep `assert()` out of shipped paths (§8) — a harness may
use it, the game may not.

---

## Sources

Godot documentation (stable = 4.7 at time of writing):

- GDScript reference — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html
- Static typing in GDScript — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- GDScript exported properties — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_exports.html
- GDScript warning system — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/warning_system.html
- `@GDScript` annotations class reference — https://docs.godotengine.org/en/stable/classes/class_@gdscript.html
- `Array` — https://docs.godotengine.org/en/stable/classes/class_array.html
- `Callable` — https://docs.godotengine.org/en/stable/classes/class_callable.html
- `Signal` — https://docs.godotengine.org/en/stable/classes/class_signal.html
- `Object` (ConnectFlags) — https://docs.godotengine.org/en/stable/classes/class_object.html
- `StringName` — https://docs.godotengine.org/en/stable/classes/class_stringname.html
- `SceneTree.create_timer` — https://docs.godotengine.org/en/stable/classes/class_scenetree.html
- Signals tutorial — https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html
- When and how to avoid using nodes for everything — https://docs.godotengine.org/en/stable/tutorials/best_practices/node_alternatives.html
- Data preferences (Array vs Dictionary vs Object) — https://docs.godotengine.org/en/stable/tutorials/best_practices/data_preferences.html
- Logic preferences (load vs preload) — https://docs.godotengine.org/en/stable/tutorials/best_practices/logic_preferences.html
- Running code in the editor (`@tool`) — https://docs.godotengine.org/en/stable/tutorials/plugins/running_code_in_the_editor.html

Version evidence:

- Download page, current stable 4.7.2 (18 August 2026) — https://godotengine.org/download/windows/
- Godot 4.7 release — https://godotengine.org/releases/4.7/
- Godot 4.5 release (abstract classes, variadic functions) — https://godotengine.org/releases/4.5/
- Godot 4.4 release (typed dictionaries, `@export_tool_button`) — https://godotengine.org/releases/4.4/
- Godot 4.1 announcement (static variables) — https://godotengine.org/article/godot-4-1-is-here/
- Annotation availability diffed against the 4.1/4.2/4.3/4.4/4.5 class references at
  `https://docs.godotengine.org/en/<version>/classes/class_@gdscript.html`
- Warning defaults read from `modules/gdscript/gdscript_warning.h` at the
  `4.7-stable` tag — https://github.com/godotengine/godot/blob/4.7-stable/modules/gdscript/gdscript_warning.h
- Global math function names verified in `doc/classes/@GlobalScope.xml` at
  `4.7-stable` — https://github.com/godotengine/godot/blob/4.7-stable/doc/classes/@GlobalScope.xml

Issue tracker (treated as corroboration for a documented behaviour, not as a
primary source):

- "Statically typed signal parameters are treated as if they never had static
  typing" — closed as not planned — https://github.com/godotengine/godot/issues/110573
