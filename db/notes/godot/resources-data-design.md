# Resource-driven data design

> How to turn Cosmo's hand-maintained JavaScript content tables into Godot
> Resources the editor can see, validate and refactor — and where that is worse
> than what we have. Written against **Godot 4.7.2** (stable, 18 August 2026;
> `docs.godotengine.org/en/stable` serves 4.7). Version-gated APIs are marked.

---

## The short version

- One script file per content type, `class_name` + `extends Resource`, every
  field `@export`ed and statically typed. `class_name` is what puts it in the
  **Create New Resource** dialog — without it the type is invisible to the editor.
- Give `_init()` **no required parameters**. `Resource.duplicate()` fails outright
  on a custom resource whose `_init()` demands arguments, and the inspector cannot
  construct it either.
- Compose, do not deep-inherit. One `@abstract` base carrying `id` and `validate()`
  (`@abstract` is **4.5+**), concrete leaves under it, and references between rows
  instead of integer indices into a parallel array.
- Author each content **row** as its own `.tres`. Keep one root `ContentIndex.tres`
  holding `Array[RowType]` of external references. Commit `.tres`; never commit
  `.res`; **always commit `.uid`** sidecars.
- `preload()` the index once from a `class_name` static registry. Do not scan
  `res://` directories at runtime — `DirAccess` does not see them in an exported
  build.
- `.tres` is converted to binary on export by default and a `<path>.remap` file is
  written beside it, so `load("res://…/foo.tres")` still resolves. Verified in
  engine source, and it contradicts one doc note — see Pitfalls.
- Resources are **shared by reference**. Anything the run mutates must be
  `duplicate()`d or marked `resource_local_to_scene`. Content tables are read-only
  and should stay that way.
- Validate content in a `@tool` script and in CI: `godot --headless --script`.
  This is the piece that replaces `tools/check.mjs`'s table assertions.
- The two things that will actually cost you a day: `@tool` **does not inherit**
  (every subclass needs its own `@tool`), and renaming an exported property
  **silently drops** the authored value from every `.tres` that stored it.

---

## 1. The class, and what makes it visible to the editor

```gdscript
# res://content/ring_voice.gd
@tool
class_name RingVoice
extends ContentEntry
## One orbit's instrument and colour. Ring 0 is the outermost.

enum Wave { SAW, SQUARE, TRIANGLE, SINE }

@export var wave: Wave = Wave.SAW
@export_range(0.5, 3.0, 0.01) var cutoff_scale: float = 1.0
@export_range(0.0, 2000.0, 1.0, "suffix:Hz") var filter_lift: float = 0.0
@export_range(0, 3) var sub_voices: int = 0
@export var tint: Color = Color(0.518, 0.635, 1.0)
```

Three rules, all of them load-bearing:

**`class_name` is not decoration.** The docs are explicit: *"To make the new
resource class appear in the Create Resource GUI you need to provide a class
name for GDScript"* ([Resources][res-tut]). Without it, authoring a row means
creating a bare `Resource`, then hand-attaching the script — a step people forget,
and a forgotten one produces a `.tres` with the right values and no behaviour.

**Every `_init()` parameter needs a default.** The class reference states it
twice over. `Resource.duplicate()`: *"For custom resources, this method will fail
if `Object._init()` has been defined with required parameters"* ([Resource][res-class]).
And the tutorial: *"Make sure that every parameter has a default value. Otherwise,
there will be problems with creating and editing your resource via the inspector."*
In practice, prefer **no `_init()` at all** for content rows — the exported
defaults are the constructor.

**Do not read an exported value in `_init()`.** Assignment from the `.tres` happens
*after* construction, so `_init()` sees the annotation's default, not the authored
one ([GDScript exported properties][exports]). Resources have no `_ready()`. If a
row must derive something from its own fields, do it in a property setter or in a
lazily-evaluated getter:

```gdscript
@export var filter_lift: float = 0.0:
    set(value):
        filter_lift = value
        _cutoff_hz = 0.0          # invalidate the derived value
        emit_changed()            # NOT automatic for custom resources

var _cutoff_hz: float = 0.0
func cutoff_hz(base: float) -> float:
    if _cutoff_hz == 0.0:
        _cutoff_hz = base * cutoff_scale + filter_lift
    return _cutoff_hz
```

`emit_changed()` matters more than it looks: *"This signal is not emitted
automatically for properties of custom resources. If necessary, a setter needs to
be created to emit the signal"* ([Resource][res-class]). Anything that watches a
row for live edits — a `@tool` preview, a hot-reload path — sees nothing until
you emit it yourself.

**Inner classes cannot be Resources.** A `.tres` stores the path of the script it
uses and loads that script as its type; an inner `class MyRes extends Resource`
inside another file will not serialise its properties ([Resources][res-tut]).
One content type, one file, always.

### Registering a nice icon

```gdscript
@tool
@icon("res://content/icons/ring_voice.svg")
class_name RingVoice
extends ContentEntry
```

`@icon` must precede the class definition, and its argument must be a **string
literal** — constant expressions are rejected ([@GDScript][gdscript-ann]). With
sixty content rows in one folder, per-type icons are the difference between a
browsable table and a wall of identical grey squares.

---

## 2. The `@export` hint vocabulary, with version gates

This is the part most tutorials never finish. All of the following exist in 4.7;
gates are noted.

| Annotation | Use | Since |
|---|---|---|
| `@export` | any typed or constant-initialised member | 4.0 |
| `@export_range(min, max, step, hints…)` | numeric slider; hints below | 4.0 |
| `@export_enum("A", "B:30", …)` | restrict `int` or `String` to a list | 4.0 |
| `@export_flags("Fire", "Water:4", …)` | bitfield checkboxes | 4.0 |
| `@export_multiline` | large text field | 4.0 |
| `@export_placeholder("hint")` | greyed placeholder in a String field | 4.0 |
| `@export_file("*.json")` / `@export_dir` | project-relative path *as a String* | 4.0 |
| `@export_global_file` / `@export_global_dir` | filesystem paths, `@tool` only | 4.0 |
| `@export_color_no_alpha` | `Color` with alpha pinned to 1 | 4.0 |
| `@export_exp_easing` | draws the `ease()` curve | 4.0 |
| `@export_node_path("Button", …)` | typed `NodePath` (prefer `@export var n: Node`) | 4.0 |
| `@export_group` / `@export_subgroup` / `@export_category` | inspector structure | 4.0 |
| **`@export_storage`** | serialise but hide from the inspector | **4.3+** |
| **`@export_custom(hint, hint_string)`** | any `PROPERTY_HINT_*` + hint string | **4.3+** |
| **`@export_tool_button("Label", "Icon")`** | a clickable inspector button | **4.4+** |

`@export_range` hint strings are the underused half: `"or_less"`, `"or_greater"`,
`"exp"`, `"hide_control"` (the tutorial still calls it `"hide_slider"`; both are
accepted — `editor/inspector/editor_properties.cpp` maps them to the same flag),
**`"prefer_slider"`**, `"suffix:m"`, `"radians_as_degrees"`, `"degrees"`
([exports][exports], [@GDScript][gdscript-ann]).

```gdscript
@export_range(0.0, 2000.0, 1.0, "or_greater", "suffix:dl") var at_dl: float = 0.0
@export_range(0.0, 1.0, 0.001, "hide_slider") var pool_weight: float = 0.0
@export_range(0.0, 4.0, 0.01, "exp", "suffix:s") var warn_seconds: float = 2.35
```

`@export_custom` reaches hints that have no dedicated annotation:

```gdscript
# A Vector2 whose components move together, with a px suffix. 4.7-documented recipe.
@export_custom(PROPERTY_HINT_LINK, "suffix:px") var plate_size: Vector2 = Vector2(1080, 1920)

# A free-text field that still offers known values — good for ids that grow.
@export_custom(PROPERTY_HINT_ENUM_SUGGESTION, "single,twin,gate,drift,blink") var kind: String = "single"

# An InputMap action name, with the ui_* built-ins offered. 4.7-documented.
@export_custom(PROPERTY_HINT_INPUT_NAME, "show_builtin") var action: String = ""
```

The engine does no validation on `@export_custom` hint strings — *"Invalid syntax
may have unexpected behavior in the inspector"* ([exports][exports]). Get it wrong
and the field silently renders as a plain text box.

One more worth knowing for optional content sections, **4.5+**:

```gdscript
@export_group("Painted plate")
@export_custom(PROPERTY_HINT_GROUP_ENABLE, "") var plate_enabled: bool = false
@export var plate_uid: String = ""
@export_range(0.0, 1.0, 0.01) var plate_focus: float = 0.3
```

`PROPERTY_HINT_GROUP_ENABLE` *"Hints that a boolean property will enable the
feature associated with the group that it occurs in. The property will be
displayed as a checkbox on the group header"*, hiding the rest of the group when
off unless you pass `"checkbox_only"` ([@GlobalScope][globalscope]). It is the
right shape for a row whose optional half — an art plate, an upgraded duration —
should not be visible when it does not apply. Absent from the 4.4 class reference,
present in 4.5.

### Grouping is how a 22-field row stays authorable

```gdscript
@export_group("Arc")
@export_range(-1.0, 1.0, 0.001) var arc_x: float = 0.0
@export_range(-1.0, 1.0, 0.001) var arc_y: float = 0.0
@export_range(-2.0, 2.0, 0.001) var arc_lean: float = 0.0
@export_range(0.05, 0.5, 0.001) var arc_width: float = 0.19

@export_group("Planet", "planet_")   # second arg: only fold in this prefix
@export_range(-0.5, 0.5, 0.001) var planet_x: float = 0.0
@export_range(0.1, 0.5, 0.001) var planet_size: float = 0.285

@export_group("")                    # break out
@export var notes: String = ""
```

Groups **cannot nest**; `@export_subgroup` creates one level inside a group.
`@export_category` inserts a new top-level category, and the docs warn against it:
*"The list of properties is organized based on the class inheritance and new
categories break that expectation"* ([exports][exports]). For content rows, use
groups and leave categories alone.

### Arrays and dictionaries of rows

```gdscript
@export var rings: Array[RingVoice] = []
@export var worlds: Array[WorldPortrait] = []
@export var chord_hz: PackedFloat32Array = PackedFloat32Array()

# Typed Dictionary — Godot 4.4+.
@export var orbs_by_id: Dictionary[StringName, OrbDef] = {}
```

An `Array[T]` where `T` derives `Resource` accepts **multi-file drag-and-drop from
the FileSystem dock** ([exports][exports]) — this is how you populate an eight-row
world list in one gesture instead of eight.

Two hard limits:

- **Nested typed arrays do not exist.** The docs say so outright: *"Nested typed
  arrays such as `Array[Array[float]]` are not supported yet."* A table like
  Cosmo's `PROG` (6 levels × 4 chords × 4 frequencies) cannot be one exported
  property. Wrap the inner row in a Resource (`Array[ChordRow]`, each holding a
  `PackedFloat32Array`), or flatten with a documented stride. The Resource wrap is
  the right answer — it gives each row a name in the inspector.
- **Packed arrays must be initialised empty.** `@export var v = PackedVector3Array()`
  is fine; a packed array with authored defaults in the annotation is not.

Other export variants compose with arrays, which is not obvious:

```gdscript
@export_range(0.0, 1.0, 0.001) var weights: Array[float] = []
@export_enum("shield", "warp", "nova") var pool_ids: Array[String] = []
```

---

## 3. Inheritance versus composition

Godot gives you both. For content tables, use a **thin abstract base plus
composition**, and resist a deep tree.

```gdscript
# res://content/content_entry.gd
@tool
@abstract                     # 4.5+
class_name ContentEntry
extends Resource
## Every authored row in Cosmo. Abstract so it can never be created by mistake.

@export var id: StringName = &""

## Returns human-readable problems, or an empty array when the row is valid.
func validate(_index: ContentIndex) -> PackedStringArray:
    var problems := PackedStringArray()
    if id == &"":
        problems.append("%s: id is empty" % resource_path)
    return problems
```

`@abstract` (**4.5+**) prevents instantiation entirely: *"Attempting to instantiate
an abstract class will result in an error"* ([@GDScript][gdscript-ann]). For a base
type that exists only to be extended, that is exactly what you want — a stray
`ContentEntry.tres` in the content folder is a row that validates, loads, and does
nothing.

The syntax is order-sensitive; annotations precede the class:

```gdscript
@tool
@abstract
class_name ContentEntry
extends Resource
```

**Where inheritance earns its place:** a shared `validate()` contract, a shared
`id`, a shared `display_name`. **Where composition wins:** anything a row *has*
rather than *is*. A level does not inherit from a world; it **references** one:

```gdscript
@export var home_world: WorldPortrait     # not `var home_world_index: int`
```

That single change turns Cosmo's `LEVEL_HOME=[0,1,2,3,4,7]` from an array of
integers whose meaning lives in a comment into eight typed references the editor
can follow, rename-track and click through. It is also what makes the bug that
table already had (see **In Cosmo**) checkable.

**Do not model variants as subclasses when a field will do.** A `GateFormation
extends FormationDef` that adds one boolean is a new script, a new global class, a
new entry in the create dialog and a new file to keep `@tool` on. A `bool moves`
on `FormationDef` is a checkbox. Subclass when the *behaviour* differs (a method
override the runtime calls), not when a number differs.

**Abstract methods are a real contract now:**

```gdscript
@abstract
class_name SpawnRule
extends ContentEntry

@abstract func place(rng: RandomNumberGenerator, ring_count: int) -> Array[Dictionary]
```

Any concrete subclass that forgets `place()` fails to compile rather than failing
at spawn time on level 4.

---

## 4. `.tres` versus `.res`, and what goes in git

`.tres` is the text serialisation, `.res` the binary one. Both round-trip the same
data. The decision is not really text-vs-binary; it is **authoring vs shipping**,
and Godot already makes it for you.

A real 4.7 `.tres` for a scripted resource looks like this (format version and tag
shapes verified against `scene/resources/resource_format_text.cpp`):

```
[gd_resource type="Resource" script_class="RingVoice" format=4 uid="uid://b3n7x2k1qwe8v"]

[ext_resource type="Script" uid="uid://cq1w8ktm2yv3n" path="res://content/ring_voice.gd" id="1_ring"]

[resource]
script = ExtResource("1_ring")
id = &"mid"
wave = 1
cutoff_scale = 1.18
filter_lift = 380.0
sub_voices = 1
tint = Color(0.502, 0.808, 1, 1)
```

Note `type="Resource"` with the global class name carried separately in
`script_class` — the saver writes the *engine* class and adds `script_class` from
the script's global name. `format=4` has been the text format since **4.4**
(`FORMAT_VERSION = 4`, `FORMAT_VERSION_COMPAT = 3`); a 4.7-saved `.tres` is not
readable by 4.3.

**Commit `.tres`. Never commit `.res`.** The whole reason to author content as
`.tres` is that a weight change is a one-line diff a human can review. That
property is the deliverable.

**Export converts it for you.** `ProjectSettings.editor/export/convert_text_resources_to_binary`
defaults to `true`: *"text resource (tres) and text scene (tscn) files are
converted to their corresponding binary format on export. This decreases file
sizes and speeds up loading slightly."* ([ProjectSettings][projset]). The engine's
own wording is "slightly" — do not budget a frame-time win on it, and do not
believe anyone who quotes a multiplier without a measurement.

The conversion is safe for path-based loading, which is the part people get
nervous about. In `editor/export/editor_export_platform.cpp`, when the converted
path differs from the source path the exporter pushes both onto `path_remaps` and
writes a `<original>.remap` file into the PCK; `ResourceLoader::_path_remap` in
`core/io/resource_loader.cpp` calls `ResourceUID::ensure_path()` and then consults
`<path>.remap` on every load. So `load("res://content/rings/mid.tres")` and
`load("uid://b3n7x2k1qwe8v")` both resolve in a shipped build.

**When to reach for `.res` deliberately:** a generated blob you do not want in
diffs (a baked lookup table, a packed atlas of curve data), or something big
enough that text parsing shows up in a profile. `ResourceSaver.FLAG_COMPRESS`
(zstd) is binary-only. For sixty small content rows, none of this applies.

### Saving from code

```gdscript
var err := ResourceSaver.save(row, "res://content/rings/mid.tres",
    ResourceSaver.FLAG_CHANGE_PATH)
if err != OK:
    push_error("save failed: %d" % err)
```

`ResourceSaver.save(resource, path := "", flags := 0)`. Flags worth knowing:
`FLAG_CHANGE_PATH` (updates `resource_path` to the new location),
`FLAG_REPLACE_SUBRESOURCE_PATHS`, `FLAG_OMIT_EDITOR_PROPERTIES`, `FLAG_COMPRESS`
([ResourceSaver][saver]). One flag to **avoid**: `FLAG_BUNDLE_RESOURCES` is named
in the cyclic-dependency tracker as a crash-on-load path ([tracker #80877][cyclic]).

Also from that page: *"When the project is running, any generated UID associated
with the resource will not be saved as the required code is only executed in
editor mode."* Runtime-generated `.tres` files therefore have no UID — fine for a
save file, wrong for authored content.

---

## 5. UIDs, and why they decide whether you can refactor

A `uid://` reference is a stable identity for a file that survives moving and
renaming it. Godot 4.0 had UIDs for imported resources; **4.4 generalised them to
everything**, which is the change that matters here ([UID changes coming to Godot 4.4][uid-article]).

Two storage shapes:

- **Godot's own formats store the UID inline** — the `uid="uid://…"` field in the
  `[gd_resource]` header above, and `uid=` on each `[ext_resource]`.
- **Plain-text formats get a sidecar.** `.gd` and `.gdshader` are not Godot
  formats, so a `foo.gd.uid` file is written beside them.

Consequences you have to live with:

1. **Commit `.uid` files.** The article is emphatic: *"make sure `.uid` files are
   committed to version control. In other words, `*.uid` should not be added to
   `.gitignore`"* — otherwise *"as soon as you clone the project on another device,
   the UID references will break."*
2. **Moving a script outside the editor means moving its `.uid` too.** `git mv`
   both. A `mv` of only the `.gd` orphans every `.tres` that references it — and
   because the editor writes both a `uid` and a `path` on each `ext_resource`, the
   failure is a fallback to the stale path rather than a loud error.
3. **Re-save everything once after an upgrade** so missing UIDs are filled in, in
   one reviewable commit rather than scattered across later diffs.

The API, for tooling:

```gdscript
var uid_text := ResourceUID.path_to_uid("res://content/rings/mid.tres")  # 4.5+ static
var path := ResourceUID.uid_to_path(uid_text)                            # 4.5+ static
var resolved := ResourceUID.ensure_path(some_uid_or_path)                # 4.5+ static

var id := ResourceUID.text_to_id(uid_text)
if ResourceUID.has_id(id):
    print(ResourceUID.get_id_path(id))
```

`ensure_path()`, `path_to_uid()`, `uid_to_path()` and `create_id_for_path()` are
**4.5+** (absent from the 4.3 and 4.4 class references). `create_id()`, `add_id()`,
`set_id()`, `has_id()`, `get_id_path()`, `id_to_text()`, `text_to_id()` have been
there since 4.0. `add_id()` and `get_id_path()` **error** on a bad id rather than
returning a sentinel — check `has_id()` first ([ResourceUID][uid-class]).

**Should content code hardcode `uid://` or `res://`?** For the single root index,
`uid://` is strictly better: the file can move and the reference holds. For
everything else, do not hardcode paths at all — reach rows through the index. A
`uid://` literal in source is unreadable in review, and that cost is only worth
paying once.

---

## 6. Loading: `preload`, `load`, `ResourceLoader`, and threads

```gdscript
const INDEX := preload("uid://dq8v2mx31nkbe")     # parse time, constant path only
var index := load("res://content/index.tres")     # call time, cached
var fresh := ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE)
```

`preload()` *"is a keyword, not a function"* — you cannot take a `Callable` to it —
and it resolves *"when the script is being parsed"* ([@GDScript][gdscript-ann]).
`load()` is *"equivalent of using `ResourceLoader.load()` with
`ResourceLoader.CACHE_MODE_REUSE`"*.

`ResourceLoader.load(path, type_hint := "", cache_mode := CACHE_MODE_REUSE)`. The
cache modes are `CACHE_MODE_IGNORE`, `CACHE_MODE_REUSE` (default),
`CACHE_MODE_REPLACE`, `CACHE_MODE_IGNORE_DEEP`, `CACHE_MODE_REPLACE_DEEP`
([ResourceLoader][loader]). `CACHE_MODE_IGNORE` is how you get a genuinely fresh
copy of a resource for mutation without touching the shared cached instance —
though `duplicate()` is usually cheaper and clearer.

**Exported `@export var x: SomeResource` is a load dependency.** The docs:
*"all the resources referenced by `@export` variables are loaded when the scene
containing the script is loaded"* ([exports][exports]). One `ContentIndex` holding
`Array[WorldPortrait]` therefore pulls every world in when the index loads — which
for parameter rows is exactly right, and for anything holding a texture is exactly
wrong. Keep heavy assets behind `@export_file` or a `uid://` string the runtime
loads on demand.

### Threaded loading

```gdscript
const PLATE_PATH := "res://art/worlds/emberfall.webp"

func _ready() -> void:
    ResourceLoader.load_threaded_request(PLATE_PATH)

func _process(_delta: float) -> void:
    var progress: Array = []
    match ResourceLoader.load_threaded_get_status(PLATE_PATH, progress):
        ResourceLoader.THREAD_LOAD_IN_PROGRESS:
            _bar.value = progress[0] if not progress.is_empty() else 0.0
        ResourceLoader.THREAD_LOAD_LOADED:
            set_process(false)
            _apply_plate(ResourceLoader.load_threaded_get(PLATE_PATH))
        ResourceLoader.THREAD_LOAD_FAILED, ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
            set_process(false)
            push_warning("plate load failed; keeping the procedural sky")
```

Signatures:
`load_threaded_request(path, type_hint := "", use_sub_threads := false, cache_mode := CACHE_MODE_REUSE) -> Error`,
`load_threaded_get_status(path, progress := []) -> ThreadLoadStatus`,
`load_threaded_get(path) -> Resource` ([ResourceLoader][loader]).

Two behaviours to plan around:

- **`load_threaded_get()` blocks if the load has not finished.** *"either the
  resource finished loading in the background and will be returned instantly or
  the load will block at this point like `load()` would"* ([Background loading][bgload]).
  Poll the status, or leave real time between request and get.
- **`use_sub_threads = true` "may affect the main thread"** — the docs say so
  without quantifying. On a mid-range phone, treat it as a hitch risk and leave it
  `false` unless you have measured otherwise.

**Web caveat, and it is a genuine regression against Cosmo's current stack.**
Since 4.3 the recommended and default web export is **single-threaded**, because
the threaded one requires `SharedArrayBuffer` and therefore
`Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy:
require-corp` on the host ([Exporting for the Web][web]). In a single-threaded web
build, background loading is not background. The Phaser build has no equivalent
constraint. If web parity matters, size content loading so it fits in the boot
screen, not in a mid-run hitch.

---

## 7. The shared-instance model, and the four ways out

The single most-reported Godot surprise: *"When the engine loads a resource from
disk, it only loads it once. If a copy of that resource is already in memory,
trying to load the resource again will return the same copy every time"*
([Resources][res-tut]). Assign one `.tres` to twenty nodes and all twenty hold the
**same object**. Mutate it on one and you mutated it on all — including, in the
editor, writing the change back to disk.

For read-only content tables this is a feature: eight `WorldPortrait` rows loaded
once and shared by everything is exactly the memory profile you want. It becomes a
bug the moment a row carries mutable per-run state. **Keep content rows immutable
by discipline**, and keep run state in plain script variables.

When you do need a private copy:

```gdscript
var shallow := row.duplicate()                                   # nested arrays/dicts shared
var deep := row.duplicate(true)                                  # arrays/dicts copied; only local subresources
var everything := row.duplicate_deep(Resource.DEEP_DUPLICATE_ALL)  # 4.5+
```

`duplicate(deep := false)` copies exported and `PROPERTY_USAGE_STORAGE`
properties. With `deep = true`, *"Any Resource found inside will only be duplicated
if it's local"*. `duplicate_deep(mode)` (**4.5+**) takes
`DEEP_DUPLICATE_NONE` / `DEEP_DUPLICATE_INTERNAL` (default) / `DEEP_DUPLICATE_ALL`
([Resource][res-class]). Two per-property overrides exist:
`PROPERTY_USAGE_ALWAYS_DUPLICATE` and `PROPERTY_USAGE_NEVER_DUPLICATE`, reachable
via `@export_custom` or `_validate_property`.

`DEEP_DUPLICATE_ALL` on a `ContentIndex` would clone every world, every level and
every orb. That is almost never what you want — it is the mode that quietly
doubles your content memory.

The other two escapes:

- `resource_local_to_scene = true` — *"the resource is duplicated for each
  instance of all scenes using it"*, with `_setup_local_to_scene()` as the hook to
  randomise or re-seed the copy. Note *"Changing this property at run-time has no
  effect on already created duplicate resources."*
- `ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE)` — a fresh
  parse, bypassing the cache entirely.

---

## 8. `@tool`: validating content where it is authored

The reason to move tables into Resources is not that `.tres` is prettier than a
JavaScript array. It is that the editor can then **refuse to let you author an
invalid row**. That only happens if you write the validator.

### Hiding and freezing fields that do not apply

```gdscript
@tool
class_name TierRung
extends ContentEntry

@export_range(0.0, 2000.0, 1.0, "suffix:dl") var at_dl: float = 0.0
@export var formation: FormationDef = null:
    set(value):
        formation = value
        notify_property_list_changed()      # re-run _validate_property
@export_range(0, 4) var opens_ring: int = 0
@export_multiline var lesson: String = ""

func _validate_property(property: Dictionary) -> void:
    # A rung either introduces a formation or opens a ring — never both.
    if property.name == "opens_ring" and formation != null:
        property.usage |= PROPERTY_USAGE_READ_ONLY
    # The lesson is owned by the formation, never retyped here.
    if property.name == "lesson" and formation != null:
        property.usage |= PROPERTY_USAGE_READ_ONLY
```

`_validate_property(property: Dictionary)` sees *"Every property info … except
properties added with `_get_property_list()`"*, and the docs' own example is
exactly this read-only pattern ([Object][object]). It must be paired with
`notify_property_list_changed()` from the setter, or the inspector will not
re-evaluate until you reselect the resource.

### A validate button in the inspector (4.4+)

```gdscript
@tool
class_name ContentIndex
extends Resource

@export var rings: Array[RingVoice] = []
@export var worlds: Array[WorldPortrait] = []
@export var levels: Array[LevelDef] = []
@export var tiers: Array[TierRung] = []
@export var orbs: Array[OrbDef] = []
@export var modes: Array[DifficultyMode] = []

@export_tool_button("Validate content", "Callable") var _check := _run_validation

func _run_validation() -> void:
    var problems := validate()
    if problems.is_empty():
        print_rich("[color=green]content OK[/color]")
    for p in problems:
        push_error(p)

func validate() -> PackedStringArray:
    var problems := PackedStringArray()
    for group: Array in [rings, worlds, levels, tiers, orbs, modes]:
        for row: ContentEntry in group:
            if row == null:
                problems.append("an empty slot in ContentIndex")
                continue
            problems.append_array(row.validate(self))
    problems.append_array(_check_cross_row_rules())
    return problems
```

`@export_tool_button(label, icon)` is **4.4+**. The icon name must match a file in
the engine's own `editor/icons` folder — *"It is not currently possible to use
custom icons from the project folder"* ([exports][exports]). The documented example
is on a `Node`; `PROPERTY_HINT_TOOL_BUTTON` is a generic property hint and should
render for a Resource opened in the inspector, but **this handbook has not run
it** — confirm before building the authoring flow around the button. The
`--headless --script` path below is the one that has to work either way.

### The same check in CI

```gdscript
#!/usr/bin/env -S godot -s
# res://tools/validate_content.gd
extends SceneTree

func _init() -> void:
    var index: ContentIndex = load("res://content/index.tres")
    if index == null:
        push_error("content index did not load")
        quit(1)
        return
    var problems := index.validate()
    for p in problems:
        printerr(p)
    print("%d content problem(s)" % problems.size())
    quit(1 if problems.size() > 0 else 0)
```

```sh
godot --headless --import                                  # once, if .godot/ is cold
godot --headless --script res://tools/validate_content.gd
```

*"The script must inherit from `SceneTree` or `MainLoop`"* ([Command line tutorial][cli]).
`--headless` is *"Enable headless mode … Useful for servers and with `--script`"*,
and `--import` *"Starts the editor, waits for any resources to be imported, and
then quits."*

The `--import` step is not decoration on a clean checkout. `class_name` lookups
resolve through `.godot/global_script_class_cache.cfg`
(`ProjectSettings::get_global_class_list_path()` in `core/config/project_settings.cpp`),
which the editor writes. Without it, a headless `--script` run may not resolve
`ContentIndex` by name. Committing `.godot/` is not the fix — running `--import`
in CI is.

### The `@tool` rules people trip over

Straight from [Running code in the editor][tool]:

- *"any other GDScript that your tool script uses must **also** be a tool."* Your
  content classes, your registry, your validator: all `@tool`.
- *"Extending a `@tool` script does not automatically make the extending script a
  `@tool`."* `RingVoice extends ContentEntry` needs its own `@tool` line. Forget it
  on one leaf and that row's setters silently stop running in the editor while
  every other row works.
- Static variables are the sharp exception: *"If you try to read a static
  variable's value in a script that does not have `@tool`, it will always return
  `null` but won't print a warning or error."* A static content registry read from
  a tool script must itself be `@tool`, or you get `null` with no diagnostic.
- *"Modifications in the editor are permanent, with no undo/redo possible."* A
  validator that *fixes* rows is a validator that can silently rewrite your content
  folder. Report; do not repair.

---

## 9. Cyclic references

Godot's handling of resource cycles is genuinely unfinished. The engine keeps an
open tracker issue for it, [godotengine/godot#80877][cyclic], collecting dozens of
distinct bugs — editor crashes when a custom resource's exported property is set
to itself, `FLAG_BUNDLE_RESOURCES` crashing on load, cyclic `preload()` producing a
bare `Resource` with none of the script's properties.

The two shapes that bite:

**Script-level `preload` cycles.** `a.gd` preloads `b.gd`, `b.gd` preloads `a.gd`.
`preload` resolves at parse time, so neither can be compiled first. Replace one
side with `load()` (runtime resolution) or, better, break the dependency: put the
shared type in a third file that both preload.

**Data-level cycles.** A `LevelDef` pointing at a `WorldPortrait` that points back
at a `LevelDef`. The rule that avoids all of it: **content references flow one
way**. `ContentIndex → LevelDef → WorldPortrait` and never back up. When a row
genuinely needs to name something above it, store an `id: StringName` and resolve
through the index at runtime:

```gdscript
# WorldPortrait does NOT hold `var level: LevelDef`.
@export var introduced_by: StringName = &""     # resolved via Content.level(id)
```

This costs one dictionary lookup and buys a content graph that is a tree, which is
the shape both the loader and a human reviewer can handle.

---

## Pitfalls

**Renaming an exported property silently discards the authored value.**
`ResourceLoaderText` calls `res->set(assign, value)` for every key in the file and
does not check the result (`scene/resources/resource_format_text.cpp`). An unknown
property is dropped; the new property gets its annotation default. Nothing is
printed. Rename a field on a resource that has forty authored rows and you have
forty rows of defaults that still load, still validate against a stale schema and
still play. **Mitigation:** rename via a `@tool` migration script that reads the old
key through `_set()` and writes the new one, run it once, and commit the resulting
diff. Or do not rename; add and deprecate.

**Reordering an `enum` rewrites content.** `@export var wave: Wave` serialises as
an integer index. Inserting a value in the middle of `enum Wave` re-points every
saved row. Append only, or export a `StringName` with
`@export_custom(PROPERTY_HINT_ENUM_SUGGESTION, …)` and pay a lookup.

**`_init()` with required parameters breaks `duplicate()` and the inspector.**
Documented on `Resource.duplicate()`. Content rows should have no `_init()` at all.

**`@tool` does not inherit.** Every subclass needs its own annotation. This is the
one that costs a day, because the symptom is "the setter runs for three of my five
resource types."

**Scanning `res://` for content does not work in an exported build.**
`DirAccess.get_files()`: *"since imported resources are stored in a top-level
`.godot/` folder, only paths to `*.gd` and `*.import` files are returned … the list
of returned files will also vary depending on whether
`ProjectSettings.editor/export/convert_text_resources_to_binary` is true"*
([DirAccess][diraccess]). Auto-discovery works perfectly in the editor and returns
an empty list on device. **Always keep an explicit index resource.**

**A doc note that contradicts the engine.** `@GDScript.load()` carries: *"If
`ProjectSettings.editor/export/convert_text_resources_to_binary` is true, `load()`
will not be able to read converted files in an exported project."* The export code
writes a `<path>.remap` for every converted file
(`editor/export/editor_export_platform.cpp`) and `ResourceLoader::_path_remap`
reads it on every load (`core/io/resource_loader.cpp`), so path-based `load()` of a
converted `.tres` does resolve. Treat the note as stale, but **verify on device
before shipping** — this handbook has read the source, not run the build.

**`ResourceSaver.save()` at runtime produces UID-less files.** *"the required code
is only executed in editor mode"* ([ResourceSaver][saver]). Fine for save data,
wrong for authored content.

**A resource loaded via an `@export` default may be null in an exported build.**
Reported against 4.4.1 as [godotengine/godot#108294][gh-108294] — a custom resource
with `@export var stats: Statblock = load("res://…tres")` loads in the editor and
comes back null on device. **Not verified against 4.7**, and the issue is a single
report. Avoid `load()` in a default-value expression regardless; it is a
`preload`-shaped thing written in the one place `preload` does not belong.

**Godot 3 idiom to unlearn.** `export var x` → `@export var x`. `export(int, 0, 10)`
→ `@export_range(0, 10)`. `export(Resource) var r` → `@export var r: Resource`.
`setget set_x, get_x` → property setters/getters on the `var`. `yield()` → `await`.
`class_name Foo, "res://icon.png"` → `@icon("res://icon.png")` above `class_name Foo`.
`ResourceInteractiveLoader` → `ResourceLoader.load_threaded_request()`. `.tres` files
written by 3.x are format 2 and do not load in 4.x without conversion.

**Where Godot is honestly worse than Cosmo's current stack.** A JavaScript literal
table is one file, greppable, diffable, and reorderable in a text editor in
seconds. Sixty `.tres` files are sixty files, a `.uid` each for the scripts, and a
folder you must not reorganise carelessly. Godot buys type checking, editor
authoring, refactor safety and a validation surface; it costs file-count and a
class of silent-drop failures (renamed properties, reordered enums) that a
JavaScript object literal simply does not have. Both halves are true.

---

## In Cosmo

The tables below live today as `const` literals inside
`src/game/runtime.js`. Each becomes one `class_name` script plus one `.tres` per
row. `id: StringName` on every row comes from `ContentEntry`.

### `RingVoice` — replaces `RINGS` (`src/game/runtime.js:210-220`) and `RAD_OFF`/`RAD_BH` (`:204-209`)

| Exported field | Type | Replaces |
|---|---|---|
| `wave` | `Wave` enum | `RINGS[].wave` (`'sawtooth'` / `'square'`) |
| `cutoff_scale` | `float`, `@export_range(0.5, 3.0, 0.01)` | `RINGS[].cut` — 1.00 / 1.18 / 1.42 / 1.62 |
| `filter_lift` | `float`, `"suffix:Hz"` | `RINGS[].lift` — 0 / 380 / 820 / 1180 |
| `sub_voices` | `int`, `@export_range(0, 3)` | `RINGS[].sub` — 0 / 1 / 2 / 2 |
| `tint` | `Color` (`@export_color_no_alpha`) | `RINGS[].tint`, the `"r,g,b"` strings |
| `radius_normal` | `float` | `RAD_OFF` — 1.0 / 0.76 / 0.545 / 0.0 |
| `radius_black_hole` | `float` | `RAD_BH` — 1.0 / 0.80 / 0.62 / 0.45 |
| `black_hole_only` | `bool` | the accretion ring's comment |

Four rows: `outer`, `mid`, `inner`, `accretion`. Row-level `validate()` asserts
`filter_lift` is non-decreasing across the array, which is the claim `THIRD RING`'s
lesson makes to the player ("each ring in carries a brighter filter lift").

### `WorldPortrait` — replaces `WORLDS` (`:265-290`)

Eight rows, twenty-two fields each, so this is the one where `@export_group` stops
being cosmetic:

- **Arc**: `arc_x`, `arc_y`, `arc_lean`, `arc_width`
- **Shape**: `bend`, `reach`, `grain`, `gain`
- **Planet**: `planet_x`, `planet_y`, `planet_size`, `planet_tilt`
- **Surface**: `flatten`, `rock`, `clouds`, `sun`
- **Field**: `star`, `motion`
- **Palette**: `tint`, `rim`, `dust` — three `Color`s, replacing the `[r,g,b]` triples
- **Plate** (optional art): `plate_uid: String`, `plate_focus: float` in `[0.25, 0.36]`

Every numeric field gets a real `@export_range`, because the shader's failure mode
for an out-of-range value is a sky that looks wrong rather than an error. Add
`func blend(other: WorldPortrait, t: float) -> Dictionary` mirroring today's
`skyMix()` and its 0.2 smoothstep window, returning packed uniform arrays. Keep the
blend a method on the resource, not in the renderer — it is a property of the data
format.

**A note about the sky-art plate table.** The db record `tune.sky-art-worlds`
anchors at `src/game/runtime.js:9763-9790`, but the working tree has `sceneAccent`
and `skyWake` there and no `focus:` literals anywhere in the file; the eight
`{key, focus}` rows are present only in `dist/`. Treat the plate fields above as
proposed, and confirm against the shipped runtime before authoring values.

### `LevelDef` — replaces `LV` (`:3042-3112`) and `LEVEL_HOME` (`:325`)

| Field | Type | Replaces |
|---|---|---|
| `display_name` | `String` | `LV[].name` — LIFT OFF … HEAT DEATH |
| `dl_start` | `float` | `LV[].dl0` — 0, 90, 215, 340, 470, 610 |
| `dl_end` | `float` (`INF` for level 6) | `LV[].end` |
| `key_scale` | `float`, `@export_range(0.4, 1.0, 0.0001)` | `LV[].key` — 1, 0.8909, 0.7937, 0.7071, 0.63, 0.5612 |
| `home_world` | `WorldPortrait` | one entry of `LEVEL_HOME` |
| `card` | `Array[TeachingLine]` | `LV[].mech` rows |

`TeachingLine` carries `icon: StringName`, `@export_multiline var text: String`,
and `dynamic_source: StringName` (empty = static) for the one row that is
`sub:null` and resolved at draw time by `swipeWords()`.

**This is the table that most repays the move.** `LEVEL_HOME` is applied as a
`Math.max` floor against a journey that never goes backwards, so it *has to climb*
— and it did not: it read `[0,1,5,3,2,7]`, which made three of six entries dead
and meant nobody playing from level 1 ever saw EMBERFALL or GLASS as an opening
image. The bug survived because an array of integers indexing a second array has no
representation in which "climbing" is visible. As typed references plus a
cross-row check, it is four lines:

```gdscript
func _check_level_home_climbs() -> PackedStringArray:
    var problems := PackedStringArray()
    var previous := -1
    for level: LevelDef in levels:
        var w := worlds.find(level.home_world)
        if w < 0:
            problems.append("%s: home_world is not in the journey" % level.display_name)
        elif w < previous:
            problems.append("%s: home_world is behind the previous level's floor — "
                % level.display_name + "the floor is a max(), so this entry is dead")
        else:
            previous = w
    return problems
```

That error appears in the inspector the moment somebody types the wrong world,
which is the whole argument for this document.

### `TierRung` — replaces `TIERS` (`:4652-4739`)

Thirteen rows: `at_dl` ∈ {0, 12, 18, 40, 100, 128, 165, 240, 275, 310, 395, 520, 610},
`banner_name`, `lesson`, `formation: FormationDef` (null on the three ring rungs),
`opens_ring: int` (2 at dl 12, 3 at dl 40, 0 otherwise), and
`lesson_source: StringName` for `SECOND RING`, whose sub is the only computed
sentence in the table.

Three cross-row checks lift straight out of the existing harnesses:

- `at_dl` strictly ascending — today an implicit property of source order.
- Every rung that carries a formation has `lesson` identical to that formation's
  MEET lesson. `tools/smoke.mjs` asserts this today; as data it is an editor error.
- The last rung's `at_dl` equals the last level's `dl_start` (610). Pinned by
  `smoke.mjs` today so that `THE EYE` cannot be appended past.

### `OrbDef` — replaces `POWPOOL` (`:6080-6082`), `LAB_ORBS` (`:3207-3218`), and the duration table

One row per orb, merging three tables that are three views of the same nine things:

| Field | Replaces |
|---|---|
| `display_name` | `LAB_ORBS[].n` |
| `pool_weight` | `POWPOOL[i][1]` — shield .302, warp .185, nova .143, spot .134, slip .095, trail .095, mirror .080, scorch .080, hyper .076 |
| `min_level` | `POWPOOL[i][2]` — shield/warp/nova 1, hyper/slip 2, spot/trail 3, mirror 4, scorch 5 |
| `guaranteed_on_level` | the `spawnPow` else-if ladder's `G.level` gates |
| `duration` / `duration_upgraded` | the per-orb durations |
| `duration_in_beats` | mirror and hypernova, which run 16 beats, not 16 seconds |
| `tint` | the row of `COL` for this orb |
| `lab_description` | `LAB_ORBS[].d` |
| `in_lab` | the black hole, which is in the lab and not in the pool |

`POWPOOL` is declared **inside** `spawnPow`, rebuilt on every roll and impossible
to inspect from a console. As a `ContentIndex.orbs` array it is inspectable, and
`validate()` can assert what the source comment only claims: that the weights sum
to 1 within epsilon, and that no weight was redistributed by hand without the
total moving. The renormalise-by-level-floor logic stays in code; only the table
moves.

Keep `lab_description` cross-checked against the orb's MEET or hint text — the lab
picker's own comment says its wording is lifted from those channels *"so the picker
cannot drift into being a second, differently-worded description of the same six
things."* That is a one-line check once both strings are data.

### `DifficultyMode` — replaces `MODES` (`:3151-3155`)

One row today, `skill`, and the point of keeping the table is the rule it encodes:
a second difficulty is a **derivative** of the clock, never a second code path.
Fields: `clock`, `speed`, `warn`, `cap`, `gap` (all 1.0 on the identity row),
`extra_shields` (0, additive), `demo` (1.0), plus `display_name`, `tagline`,
`accent: Color`.

`tools/check.mjs` currently fails the build if a knob stops being neutral or is
declared without a call site. Half of that survives the move directly:

```gdscript
func validate(_index: ContentIndex) -> PackedStringArray:
    var problems := PackedStringArray()
    if id == &"skill" and not is_identity():
        problems.append("skill must stay the identity row — every knob 1, shields 0")
    return problems

func is_identity() -> bool:
    return is_equal_approx(clock, 1.0) and is_equal_approx(speed, 1.0) \
        and is_equal_approx(warn, 1.0) and is_equal_approx(cap, 1.0) \
        and is_equal_approx(gap, 1.0) and extra_shields == 0 \
        and is_equal_approx(demo, 1.0)
```

The other half — "no knob declared without a call site" — is a static analysis of
the *code*, not the data, and does not port. Keep it as a grep in the CI script.

### The registry

```gdscript
# res://content/content.gd
@tool
@abstract
class_name Content
extends RefCounted

const INDEX: ContentIndex = preload("uid://dq8v2mx31nkbe")

static var _by_id: Dictionary[StringName, ContentEntry] = {}

static func _static_init() -> void:
    for group: Array in [INDEX.rings, INDEX.worlds, INDEX.levels,
                         INDEX.tiers, INDEX.orbs, INDEX.modes]:
        for row: ContentEntry in group:
            _by_id[row.id] = row

static func orb(id: StringName) -> OrbDef:
    return _by_id.get(id) as OrbDef

static func level(n: int) -> LevelDef:
    return INDEX.levels[clampi(n - 1, 0, INDEX.levels.size() - 1)]
```

`_static_init()` runs *"automatically when the class is loaded, after the static
variables have been initialized"* ([GDScript basics][gdbasics]) — so the id map is
built exactly once, with no autoload and no `_ready()` ordering question. Typed
`Dictionary[StringName, ContentEntry]` requires **4.4+**. `@abstract` requires
**4.5+**; on 4.4 use `extends Object` and never instantiate it. `@tool` is required
here for the reason in §8: a `@tool` validator reading `Content._by_id` from a
non-tool script gets `null`, silently.

### What deliberately does *not* become a Resource

- **`dl()`, `speedAt()`, `warnTime()`, `shardCap()`, `spawnGap()`** — these are
  curves, not rows. Their *constants* can be exported on a `DifficultyCurve`
  resource; the shape stays in code.
- **The music tables** (`PENT` `:2981`, `PROG` `:3354`, `HOOKL` `:914`, `ARPL`
  `:3405`) are a bigger design than this document. Note the blocker in advance:
  `PROG` is six levels × four chords × four frequencies, and
  `Array[Array[float]]` **cannot be exported**. It needs `Array[ChordRow]` where
  `ChordRow` holds a `PackedFloat32Array` — which is also more legible in the
  inspector than a nested list would have been.
- **Per-run mutable state** — never on a content row. The shared-instance rule in
  §7 makes that a cross-run bug that only shows up on the second run.

---

## Sources

Godot documentation, stable channel, serving 4.7 at time of writing.

- [GDScript exported properties][exports] — `https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_exports.html`
- [Resources (tutorial)][res-tut] — `https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html`
- [Resource (class reference)][res-class] — `https://docs.godotengine.org/en/stable/classes/class_resource.html`
- [ResourceLoader][loader] — `https://docs.godotengine.org/en/stable/classes/class_resourceloader.html`
- [ResourceSaver][saver] — `https://docs.godotengine.org/en/stable/classes/class_resourcesaver.html`
- [ResourceUID][uid-class] — `https://docs.godotengine.org/en/stable/classes/class_resourceuid.html`
- [Object (`_validate_property`, `_get_property_list`)][object] — `https://docs.godotengine.org/en/stable/classes/class_object.html`
- [@GlobalScope (`PropertyHint`, `PropertyUsageFlags`)][globalscope] — `https://docs.godotengine.org/en/stable/classes/class_@globalscope.html`
- [ProjectSettings (`editor/export/convert_text_resources_to_binary`)][projset] — `https://docs.godotengine.org/en/stable/classes/class_projectsettings.html`
- [DirAccess (exported-project caveats)][diraccess] — `https://docs.godotengine.org/en/stable/classes/class_diraccess.html`
- [@GDScript annotations][gdscript-ann] — `https://docs.godotengine.org/en/stable/classes/class_@gdscript.html`
- [GDScript basics (static vars, `_static_init`, `@abstract`)][gdbasics] — `https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html`
- [Running code in the editor][tool] — `https://docs.godotengine.org/en/stable/tutorials/plugins/running_code_in_the_editor.html`
- [Background loading][bgload] — `https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html`
- [Command line tutorial][cli] — `https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html`
- [Exporting for the Web][web] — `https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html`

Release and version evidence.

- [Godot 4.7 download page][dl] (4.7.2, 18 August 2026) — `https://godotengine.org/download/windows/`
- [Godot 4.4 release notes][rel44] (typed dictionaries, `@export_tool_button`, universal UIDs) — `https://godotengine.org/releases/4.4/`
- [Godot 4.5 release notes][rel45] (`@abstract`, `duplicate_deep()`, variadics) — `https://godotengine.org/releases/4.5/`
- [UID changes coming to Godot 4.4][uid-article] — `https://godotengine.org/article/uid-changes-coming-to-godot-4-4/`
- Annotation availability was checked empirically against the versioned docs:
  `@export_storage` / `@export_custom` first appear in `/en/4.3/`,
  `@export_tool_button` in `/en/4.4/`, `duplicate_deep` and `DeepDuplicateMode` in
  `/en/4.5/`, `PROPERTY_HINT_GROUP_ENABLE` in `/en/4.5/`, and
  `PROPERTY_HINT_INPUT_NAME` / `PROPERTY_HINT_LINK` / `"prefer_slider"` in
  `/en/4.7/`.

Engine source, tag `4.7`, for claims the documentation does not make.

- `scene/resources/resource_format_text.cpp` — `.tres` header/tag shapes, `script_class`, silent `res->set()` on unknown properties
- `scene/resources/resource_format_text.h` — `FORMAT_VERSION = 4`, `FORMAT_VERSION_COMPAT = 3`
- `editor/export/editor_export_platform.cpp` — text→binary conversion and `<path>.remap` emission
- `core/io/resource_loader.cpp` — `ResourceLoader::_path_remap` consulting `.remap` and `ResourceUID::ensure_path`
- `core/io/resource_uid.cpp` — `ResourceUID::ensure_path`
- `core/config/project_settings.cpp` — `global_script_class_cache.cfg`

Bug reports, cited as open questions rather than as facts.

- [Tracker: cyclic dependencies (#80877)][cyclic] — open, dozens of linked issues
- [Custom resource loading another resource via an `@export` default fails in exported builds (#108294)][gh-108294] — open, reported against 4.4.1, **unverified against 4.7**

[exports]: https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_exports.html
[res-tut]: https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html
[res-class]: https://docs.godotengine.org/en/stable/classes/class_resource.html
[loader]: https://docs.godotengine.org/en/stable/classes/class_resourceloader.html
[saver]: https://docs.godotengine.org/en/stable/classes/class_resourcesaver.html
[uid-class]: https://docs.godotengine.org/en/stable/classes/class_resourceuid.html
[object]: https://docs.godotengine.org/en/stable/classes/class_object.html
[globalscope]: https://docs.godotengine.org/en/stable/classes/class_@globalscope.html
[projset]: https://docs.godotengine.org/en/stable/classes/class_projectsettings.html
[diraccess]: https://docs.godotengine.org/en/stable/classes/class_diraccess.html
[gdscript-ann]: https://docs.godotengine.org/en/stable/classes/class_@gdscript.html
[gdbasics]: https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html
[tool]: https://docs.godotengine.org/en/stable/tutorials/plugins/running_code_in_the_editor.html
[bgload]: https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html
[cli]: https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
[web]: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
[dl]: https://godotengine.org/download/windows/
[rel44]: https://godotengine.org/releases/4.4/
[rel45]: https://godotengine.org/releases/4.5/
[uid-article]: https://godotengine.org/article/uid-changes-coming-to-godot-4-4/
[cyclic]: https://github.com/godotengine/godot/issues/80877
[gh-108294]: https://github.com/godotengine/godot/issues/108294
