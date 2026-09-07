# Project structure and the build

> How a Godot 4 repository for Cosmo should be laid out, how each platform gets
> built and shipped, and exactly what the move costs on the web. Written
> against **Godot 4.7.2-stable** (released 18 August 2026; verified on the
> [official download archive](https://godotengine.org/download/archive/) and
> [godot-builds releases](https://github.com/godotengine/godot-builds/releases)).
> `docs.godotengine.org/en/stable` currently serves the 4.7 branch.

---

## The short version

- **Layout**: `snake_case` for every file and folder, `PascalCase` for node
  names and `class_name`. Group by feature, not by file type. `addons/` at the
  root, `.gdignore` (an empty file) on anything the importer should skip.
- **Version control**: gitignore `.godot/` and `*.translation`. **Commit every
  `*.uid`.** Not committing them is the most common way a Godot 4.4+ repo
  breaks on a fresh clone.
- **Content**: authored tables (rings, worlds, orb pools, formation tiers,
  level windows) become custom `Resource` classes saved as `.tres`. Tuned
  scalars read every frame stay as `const` in a plain `.gd` — they diff better
  and carry their comment.
- **Per-platform config**: feature-tag overrides in `project.godot`
  (`setting.web = …`), read with `ProjectSettings.get_setting_with_override()`,
  **not** `get_setting()`.
- **Export**: commit `export_presets.cfg`; never commit
  `.godot/export_credentials.cfg`. CI runs `godot --headless --import` then
  `godot --headless --export-release "<preset>" <path>`.
- **Web is the expensive part.** The 4.3 engine `.wasm` alone was ~40 MB
  uncompressed, ~5 MB Brotli. Cosmo's entire current first load is ~439 KB of
  gzipped JS plus ~788 KB of WebP. Plan for a **5–10× regression in initial
  download** and design the loading experience around it.
- **Web audio is the other expensive part.** Web defaults to *Sample* playback
  and **AudioEffects do not work in Sample mode**. *Stream* mode restores them
  but adds latency unless Thread Support is on, which requires cross-origin
  isolation headers. This collides directly with Cosmo's bus and effects chain.
- **Saves** live in `user://`. On web that is an IndexedDB-backed virtual
  filesystem. Existing `cometloop:` records can be read on the web build via
  `JavaScriptBridge` **if the Godot build is served from the same origin**.
  Native Capacitor WebView records cannot be recovered; the cloud account is
  the only migration path for those players.
- **GDExtension**: almost certainly not. The last section gives the specific
  signs that would change that answer.

---

## 1. Repository layout

### The naming rules, and why they are not cosmetic

The docs are explicit: `snake_case` for files and folders, `PascalCase` for
node names. The reason for the first is not taste — Windows and macOS
filesystems are case-insensitive while Linux and the exporter's path handling
are not. A `res://Art/Comet.png` that resolves on the author's Windows machine
can fail on a Linux CI runner doing the export.
([Project organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html))

`class_name` registers a **global** identifier for the whole project. GDScript
has no namespaces, so `class_name Ring` is a project-wide claim on the word
`Ring` and collides with any addon that claims it too. For a one-owner project
the discipline that works is a short consistent prefix on anything generic
(`CosmoRing`, `CosmoClock`) and no prefix on anything obviously specific
(`StarfallCharge`).

### A layout that survives growth

Godot's own advice is to keep assets next to the scene that uses them rather
than in a global `textures/` bin. For Cosmo — one artist-authored sprite set, a
handful of systems, six levels — a hybrid works better than either pure form:

```
res://
  project.godot
  export_presets.cfg
  main.tscn                     # the one entry scene
  game/
    run/                        # run lifecycle, difficulty clock, spawning
      run_director.gd
      difficulty_clock.gd
    comet/
      comet.tscn  comet.gd
    hazards/
      formations/               # one .tres per formation tier
    powerups/
      orb.tscn  orb.gd
      pools/                    # one .tres per level's orb pool
  music/
    scheduler.gd
    keys/                       # one .tres per key
    layers/
  render/
    sky/
      sky.gdshader  sky_material.tres
    glow/
    halos/
  content/                      # data tables that ARE content
    rings.tres  worlds/  levels/
  ui/
  platform/                     # save, cloud, haptics, lifecycle
    save_store.gd
    legacy_import.gd
    cloud_client.gd
  art/                          # the shipped sprite set, provenance-tracked
  addons/
```

The rule that keeps this navigable a year later: **a directory is either a
subsystem or a content type, never both.** `game/powerups/` holds the code that
runs orbs; `content/` holds the authored tables saying which orbs exist. Mix
the two and "where is the orb pool for level 4" stops being obvious, and every
agent session pays to rediscover it.

### `.gdignore`, `.godot/`, and what git sees

- An empty file named `.gdignore` in a directory makes the editor skip
  importing it and hides it from the FileSystem dock. **Its contents are
  ignored** — it is not a pattern file. Use it on reference material, source
  PSDs, or a vendored tool directory.
- `.godot/` is the project cache and must be gitignored.
  `.godot/export_credentials.cfg` — keystore passwords, encryption keys — lives
  inside it, so ignoring the folder covers the secret.
  ([Version control systems](https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html))
- `*.translation` (the binary form compiled from CSV) is gitignored; the CSV is
  the source.
- **`*.uid` must be committed.** Since 4.4 every resource, script and shader
  gets a `.uid` sidecar and references are stored as `uid://…` rather than
  paths. The official announcement is unambiguous: *"`*.uid` should **not** be
  added to `.gitignore`."* Without them the project still works on the machine
  that has the cache and breaks on a fresh clone, falling back to path
  resolution with warnings. When you move or delete a script outside the
  editor, move or delete its `.uid` with it.
  ([UID changes coming to Godot 4.4](https://godotengine.org/article/uid-changes-coming-to-godot-4-4/))

The editor generates a starter `.gitignore` for you: **Project → Version
Control → Generate Version Control Metadata**. Use it rather than writing one
by hand — the 3.x/4.0 ignore list that is all over the internet is *wrong* for
4.1+ and will make you commit secrets.

### Autoloads: keep the list tiny

Autoloads register under **Project Settings → Globals → Autoload**, become
global identifiers, and are added to the root before any scene. A script (not a
scene) autoload gets a bare `Node` created for it with the script attached.
Order in the list is load order and is adjustable.

The documented hard rule: **never `free()` or `queue_free()` an autoload — the
engine crashes.**
([Singletons (Autoload)](https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html))

For Cosmo, four is about right: the save store, the music scheduler, the run
state holder, and a settings/telemetry singleton. Everything else should be a
node in the scene it belongs to. An autoload is a global variable in a
scene-tree costume; the failure mode is a project where every subsystem can
reach every other and nothing can be exercised in isolation — precisely what
Cosmo's current typed host/scene boundary exists to prevent.

---

## 2. Content as Resources — and when not to

Cosmo's data tables are really content: rings, worlds, powerup pools, formation
tiers, level windows. Godot's answer is a custom `Resource` — a script that
`extends Resource` with a `class_name`, `@export` properties, and instances
saved as `.tres`. The inspector edits them for free and no parsing code is
written.
([Resources](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html))

```gdscript
class_name OrbSpec
extends Resource

@export var id: StringName = &""
@export var texture: Texture2D
@export_range(0.0, 1.0, 0.01) var weight: float = 0.25
## Levels this orb may appear in, 1-based.
@export var levels: PackedInt32Array = PackedInt32Array()
@export var guaranteed_first_appearance: bool = false
```

```gdscript
class_name OrbPool
extends Resource

@export var level: int = 1
@export var entries: Array[OrbSpec] = []

func total_weight() -> float:
	var sum := 0.0
	for spec: OrbSpec in entries:
		sum += spec.weight
	return sum
```

Three things that are not obvious:

1. **`Array[OrbSpec]` is a real typed array in the inspector.** It gives you a
   drag target that rejects the wrong resource type. Untyped `Array` gives you
   a list you can put anything into, and eventually you will.
2. **Resources are cached and shared.** Two scenes that `load()` the same
   `.tres` get the *same object*. A system that mutates a spec at runtime has
   mutated it for everyone, and the mutation persists for the rest of the
   session. Either treat specs as immutable (the right answer) or
   `.duplicate()` explicitly.
3. **Never `load()` a resource that came from a player or a server.** A `.tres`
   can name a script path, and `FileAccess.get_var(true)` deserialises objects
   that, in the docs' own words, "can contain code which gets executed". Save
   files are JSON or `ConfigFile`, never `store_var` / `ResourceSaver`.

### When a `.gd` const table is the better answer

Not every table wants to be a Resource. Cosmo's database distinguishes `tuning`
records — numbers arrived at by playtesting, like `MASTER = 2.15` — from
`spec` records. For a **tuned scalar read every frame and never edited in the
inspector**, a `const` in a plain script wins:

```gdscript
class_name Tune

## Renderer controls carried across from the Phaser build.
const SKY_ARENA_CALM := 0.62
const GL_MOTION := 0.25
## Measured make-up gain. 2.6 was tried and was wrong.
const MASTER := 2.15
```

Why: a `const` is resolved at parse time with no resource load and no property
lookup; the file diffs as one readable line per number, so a playtest change
appears in `git log` as `MASTER 2.15 → 2.05` instead of an opaque `.tres` hunk;
and the comment explaining *why* the number is what it is travels with it. A
`.tres` cannot hold that comment at all.

Rule of thumb: **if a human will edit it in the inspector, or there are many
similar rows, make it a Resource. If it is a number with a story, make it a
`const`.**

---

## 3. Addons

An addon is a folder under `res://addons/` containing a `plugin.cfg`; you
enable it in **Project Settings → Plugins**, and no editor restart is needed. A
repository with `addons/` but no `plugin.cfg` is just runtime scripts — drop
them in and use them, nothing to enable.
([Installing plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/installing_plugins.html))

Godot 4.7 introduces a new **Asset Store** in place of the old AssetLib
browser ([4.7 release notes](https://godotengine.org/releases/4.7/)). It is a
discovery surface, not a package manager.

**The honest situation on keeping addons updated: there is no lockfile and no
dependency resolution.** An addon is vendored source sitting in your
repository. Two consequences:

- **Commit the addon source.** Do not gitignore `addons/`. A clone that cannot
  reproduce the build is worse than a large diff.
- **Record provenance the way Cosmo already does for art.** Cosmo keeps
  `public/THIRD_PARTY_LICENSES.txt` and a rule that third-party components
  retain their own notices. The Godot equivalent is the same file shipped next
  to the export, plus a one-line note per addon giving the version and the
  commit it came from — because the addon folder itself often does not say.
- **Prefer the Releases tab over the default branch** when pulling from GitHub;
  a tagged release is a version you can name later.

Two addon risks specific to this project: an addon that declares a `class_name`
you also want, and an editor plugin that writes to `project.godot` on enable
(several do). Read the diff the first time you enable one.

For a one-owner project the correct addon count is close to zero. The tooling
has to stay small, and every addon is a thing that breaks on the next minor
engine release and that only you can fix.

---

## 4. `project.godot`, feature tags and per-platform configuration

### The override syntax

Any project setting can carry a feature-tagged variant:

```ini
[display]

window/size/viewport_width=1080
window/size/viewport_height=1920
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"
window/handheld/orientation="portrait"

[rendering]

renderer/rendering_method="mobile"
renderer/rendering_method.web="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
```

The `.web` / `.mobile` / `.android` suffix is the whole mechanism. Default tags
include the platforms (`android`, `ios`, `web`, `windows`, `macos`,
`linuxbsd`), build types (`debug`, `release`, `editor`, `template`),
architectures (`arm64`, `wasm32`, …), device classes (`mobile`, `pc`, `web`),
and `threads` / `nothreads` — which matters for the web export below.
([Feature tags](https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html))

### The pitfall that will cost you a day

> `ProjectSettings.get_setting()` **ignores feature tags** and returns the base
> value. Use `ProjectSettings.get_setting_with_override()` to respect them.

```gdscript
# Wrong on every platform that has an override.
var method: String = ProjectSettings.get_setting("rendering/renderer/rendering_method")

# Right.
var method: String = ProjectSettings.get_setting_with_override(
	&"rendering/renderer/rendering_method")
```

This fails silently. The value you get is *a* value, it is just the wrong one,
and the symptom is behaviour that differs between editor and export for no
visible reason.

Custom feature tags are declared per export preset and **do not apply when
running from the editor** — an override keyed on a custom tag is invisible
during development, by design.

### Portrait mobile settings, verified

For a 1080×1920 portrait game that must fill 19.5:9 and 18:9 phones:

| Setting | Value |
|---|---|
| `display/window/size/viewport_width` | `1080` |
| `display/window/size/viewport_height` | `1920` |
| `display/window/stretch/mode` | `canvas_items` |
| `display/window/stretch/aspect` | `expand` |
| `display/window/handheld/orientation` | `portrait` |

`canvas_items` renders at the device resolution and scales the 2D coordinate
system, so text and shader output stay crisp; `viewport` renders at exactly the
base size and blits, avoiding scaling artifacts but throwing away resolution.
`expand` grows the viewport in the long axis rather than letterboxing, which is
what makes a tall phone usable.

The docs' own worked example for mobile is **720×1280**, with **1080×1920**
offered for high-end devices — *"allows you to provide higher resolution 2D
assets, resulting in crisper visuals at the cost of higher memory usage and
file sizes."* For Cosmo, where the whole product is a shader-drawn sky with
sprite halos read against it, 1080×1920 is the right pick and the file-size
cost lands on an export that is already the heaviest thing in this document.
([Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html))

`expand` means **your visible height is not fixed**. Cosmo's ring geometry and
HUD have to be laid out against a variable aspect, not a fixed 1080×1920 box.
That is the same constraint the Phaser build already lives under, so it is not
new — but a rebuild that hard-codes `1920` anywhere will look wrong on a 20:9
phone.

### Native lifecycle, without Capacitor

`src/platform/native.ts` exists because a WebView needs a bridge to the OS. A
Godot native export *is* the app, so the bridge disappears and becomes
notifications on any node:

```gdscript
extends Node

var _pending_update := false

func _ready() -> void:
	# Take over the Android Back button instead of quitting.
	get_tree().set_auto_accept_quit(false)

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED:
			_pause_run()
		NOTIFICATION_APPLICATION_RESUMED:
			_resume_run()
		NOTIFICATION_APPLICATION_FOCUS_OUT:
			_duck_audio()
		NOTIFICATION_WM_GO_BACK_REQUEST:
			if not _pop_screen():
				get_tree().quit()
		NOTIFICATION_WM_CLOSE_REQUEST:
			_flush_save()
			get_tree().quit()
```

`NOTIFICATION_APPLICATION_PAUSED` (2015) and `NOTIFICATION_APPLICATION_RESUMED`
(2014) are sent on Android and iOS; `NOTIFICATION_APPLICATION_FOCUS_IN` (2016)
and `FOCUS_OUT` (2017) on desktop and mobile; `NOTIFICATION_OS_MEMORY_WARNING`
(2009) on iOS.
([MainLoop](https://docs.godotengine.org/en/stable/classes/class_mainloop.html))
`NOTIFICATION_WM_GO_BACK_REQUEST` fires on Android Back when **Application →
Config → Quit On Go Back** is enabled, which is the default.
([Handling quit requests](https://docs.godotengine.org/en/stable/tutorials/inputs/handling_quit_requests.html))

Haptics: `Input.vibrate_handheld(duration_ms: int = 500, amplitude: float = -1.0)`.
([Input](https://docs.godotengine.org/en/stable/classes/class_input.html))
This is a single blunt pulse — **not** an equivalent of `@capacitor/haptics`'
impact/notification styles. Cosmo's six haptic kinds
(`tap | hop | pickup | impact | reward | death`) have to be re-expressed as
durations and amplitudes, and the 65 ms rate limit and priority ordering
rebuilt in GDScript. The existing web-fallback durations (55/35/24/12/7 ms) are
the starting tuning.

---

## 5. Export presets and the build

### Files and secrets

- `export_presets.cfg` — most of the configuration. **Commit it.**
- `.godot/export_credentials.cfg` — passwords and encryption keys. **Never
  commit it.** Ignoring `.godot/` already covers this.
  ([Exporting projects](https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html))

### What goes in the package

Five resource export modes, of which two matter here: *export all resources in
the project* (the default) and *export all resources except those checked
below*. Beyond that there are two text filters — one for non-resource files to
include (`*.json, *.txt, *.csv`) and one to exclude by pattern.

This is Godot's version of Cosmo's publish allowlist, and it is **weaker**.
`tools/check.mjs` enforces a deny-then-allow pair over `public/` and `dist/`
and fails the build if an internal file would become a public URL. Godot's
filters are a glob you have to remember to write. The rebuild should keep the
check, moved to a CI script that walks the exported directory:

- for the web export the artifact is a small, enumerable set: `index.html`,
  `.js`, `.wasm`, `.pck`, the boot-splash `.png`, plus the PWA's service
  worker, manifest, icons and offline page when enabled;
- everything inside the `.pck` came through the export filters, so the
  allowlist becomes "what did the filters let into the pack", which you can
  inspect;
- the `LICENSE` / `THIRD_PARTY_LICENSES.txt` requirement has to be carried
  deliberately — nothing in Godot copies them for you.

### Command line, for CI

```sh
# One-time on the runner: install matching export templates for 4.7.2.
godot --headless --path . --import       # populate .godot/ from a clean checkout
godot --headless --path . --export-release "Web" build/web/index.html
godot --headless --path . --export-release "Android" build/cosmo.aab
```

`--headless` is **required** on a runner with no GPU. `--import` "starts the
editor, waits for any resources to be imported, and then quits" — on a fresh
clone with no `.godot/` cache, skipping it is the classic CI failure: the
export succeeds and ships a pack with missing or unimported assets. The docs
record `--export-debug` as implying `--import`; run `--import` explicitly
anyway — it is one command and it removes the whole class of failure.
([Command line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html))

Preset names containing spaces must be quoted. Community CI actions exist (the
widely used `godot-ci` Docker images, for instance); treat them as something to
read rather than depend on — this is three shell commands plus a template
download, and a one-owner project is better off owning them.

### The build stamp

Cosmo's `__COSMO_BUILD__` is a Vite `define` filled from `git rev-parse
--short=7 HEAD`, and it is what lets a release check say *this page is that
commit*. Godot has no `define`. Two workable equivalents:

**(a) Generate a file before exporting.** Simplest and fully deterministic:

```sh
printf 'class_name BuildStamp\nconst SHA := "%s"\nconst AT := "%s"\n' \
  "$(git rev-parse --short=7 HEAD)" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > game/build_stamp.gd
```

Keep a checked-in placeholder so the editor always parses; read it as
`BuildStamp.SHA`.

**(b) An `EditorExportPlugin`**, if the stamp must appear even for a manual
export from the editor:

```gdscript
@tool
class_name BuildStampExporter
extends EditorExportPlugin

func _get_name() -> String:
	return "cosmo_build_stamp"

func _export_begin(features: PackedStringArray, is_debug: bool,
		path: String, flags: int) -> void:
	add_file("res://build_stamp.txt", _sha().to_utf8_buffer(), false)

func _sha() -> String:
	var lines: Array = []
	OS.execute("git", ["rev-parse", "--short=7", "HEAD"], lines)
	if lines.is_empty():
		return "dev"
	return String(lines[0]).strip_edges()
```

Registered from an `EditorPlugin` with `add_export_plugin()`.
([EditorExportPlugin](https://docs.godotengine.org/en/stable/classes/class_editorexportplugin.html))

Option (a) is what a one-owner project should use. Option (b) puts a `git`
subprocess inside the editor's export path — one more thing to fail on a
machine without `git` on `PATH`.

**The invariant survives the engine change unchanged**: a build stamp
identifies source, never deployment. `docs/invariants.md:114-115` still applies
— check the published URL, not the local build.

---

## 6. Export templates and build size

Templates are the prebuilt engine binaries the exporter wraps around your pack.
They are **version-locked**: 4.7.2 templates for a 4.7.2 project. Install from
**Editor → Manage Export Templates…**, or a `.tpz` from the website. 4.7 added
downloading **only the platforms you need** rather than the whole bundle
([4.7 release notes](https://godotengine.org/releases/4.7/)) — a real
improvement for CI cache size. Optional **ICU Data** is a separate download and
is what buys CJK/Thai text and emoji.

### Making the binary smaller

Official templates are general-purpose. If size matters — and for the web
export it is the dominant cost — you compile your own:

| Technique | SCons | Stated saving |
|---|---|---|
| Build profile (editor detects used features) | `build_profile=/path/to/profile.gdbuild` | moderate to high |
| Disable 3D | `disable_3d=yes` | ~15% for a 2D game |
| Optimise for size | `optimize=size`, or `optimize=size_extra` (**4.5+**) | moderate |
| Link-time optimisation | `lto=full` | high; needs 12–16 GB RAM |
| Strip symbols | `strip` on the binary | very high (5–10×) |
| Disable individual modules | `module_<name>_enabled=no`, or a `custom.py` | project-dependent |

([Optimizing a build for size](https://docs.godotengine.org/en/stable/engine_details/development/compiling/optimizing_for_size.html))

The build-profile route has the highest leverage: the editor analyses the
project, works out which engine features it actually touches, and writes a
`.gdbuild`. The docs warn detection "may occasionally be too aggressive" —
which means an export that runs fine in the editor and crashes on a feature the
profile stripped. Verify every custom-template build by playing it.

**The honest cost.** Custom templates mean maintaining a toolchain (Emscripten
for web, NDK for Android, Xcode for iOS), rebuilding on every engine version
bump, and a CI job measured in tens of minutes. For a solo owner that is a real
recurring tax. The sensible sequence: ship official templates first, measure
the actual download, and build custom templates only if the number is
unacceptable — with the web export the likeliest place it is.

---

## 7. The web export, in detail

This is where the rebuild is genuinely worse than what Cosmo has today, and
this document would be failing you if it did not say so first.

### What it requires

WebAssembly and **WebGL 2.0**. Godot 4 can only target WebGL 2.0, via the
**Compatibility** rendering method — Forward+ and Mobile do not export to web
at all.
([Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html))

Since 4.3 the default is a **single-threaded** export, which is the right
default and which you should keep. A threaded export needs cross-origin
isolation:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Those two headers gate `SharedArrayBuffer`. Enabling them has a real cost: a
cross-origin-isolated page cannot freely embed or call other origins, which is
what broke Godot games on itch.io and similar hosts. If you cannot set headers
on the host, **Progressive Web App → Enable** installs a service-worker
workaround that simulates them.

**Extensions Support** (loading GDExtensions) also requires cross-origin
isolation.

### The download

The 4.3 web build's `.wasm` was **~40 MB uncompressed, ~5 MB with Brotli**
([Web Export in 4.3](https://godotengine.org/article/progress-report-web-export-in-4-3/)).
The docs put gzip at roughly a quarter of the original for the wasm module.
Those are the only official figures I could find; 4.7's numbers are not
published and I have not measured them, so treat ~5 MB Brotli as an order of
magnitude, not a promise.

Against that, Cosmo's current web product, measured in this checkout on
2026-09-07:

| | Bytes |
|---|---|
| `dist/assets/index-*.js` | 1,621,182 (**439,055 gzipped**) |
| `public/art/` (24 WebP sprites + manifest) | 788,521 |
| `dist/` total, 47 files | 4,004,830 |

The engine alone, before a single sprite or a note of music, is roughly **ten
times** Cosmo's entire compressed first payload. A player on a mid-range phone
over cellular currently starts playing in a second or two; after the move they
watch a progress bar. That is not a rounding error, it is a change to the
product, and it should be a decision rather than a discovery.

Serving matters at that size. The `.wasm` must be served as `application/wasm`,
and `.pck` and `.wasm` should be compressed. **GitHub Pages gzips
automatically; itch.io does not, and GitLab Pages needs manual
precompression.** Netlify does Brotli. Since Cosmo publishes the same artifact
to both Netlify and GitHub Pages, expect the Pages copy to be measurably
heavier than the Netlify one.

### Audio — the requirement most at risk

Since 4.3 web exports default to **Sample** playback (Web Audio API buffers)
rather than **Stream**. The `AudioServer.PlaybackType` docs are explicit:

- `PLAYBACK_TYPE_SAMPLE` — *"can provide lower latency and more stable playback
  (with less risk of audio crackling), at the cost of having less flexibility.
  … Only currently supported on the web platform. AudioEffects are not
  supported when playback is considered as a sample."*
- `PLAYBACK_TYPE_STREAM` — full flexibility, but the audio tutorial notes
  Stream mode "incurs increased latency if threads are not enabled".

([AudioServer](https://docs.godotengine.org/en/stable/classes/class_audioserver.html),
[Audio streams](https://docs.godotengine.org/en/stable/tutorials/audio/audio_streams.html))

The default is settable per platform via `audio/general/default_playback_type`
and its `.web` override, and per node via `AudioStreamPlayer.playback_type` —
which is itself marked **experimental** and "may be changed or removed in
future versions".

For Cosmo this is a three-way squeeze:

1. Cosmo's music is a scheduled synthesis chain with a bus and a measured
   make-up gain. Bus **effects on web require Stream mode.**
2. Stream mode without threads adds latency, and a scheduler whose drop must
   land on the beat the player earned is exactly what latency ruins.
3. Threads require cross-origin isolation headers — fine on Netlify and GitHub
   Pages where you control or inherit headers, but it rules out embedding the
   game anywhere that will not isolate it.

The likely way through is **bake, don't process**: resolve the effects chain
into the samples ahead of time instead of applying AudioEffects at runtime, so
Sample mode becomes viable and the latency question disappears. That is a
decision for the audio document, not this one — but the constraint originates
here, in the export, and has to be known before the scheduler is written.

### iOS Safari, plainly

The docs are blunt: *"Safari has several issues with WebGL 2.0 support that
other browsers don't have, so we recommend using a Chromium-based browser or
Firefox if possible."* On iOS every browser is Safari's engine, so that advice
is unavailable — there is no Chromium on iOS.

The good news is that the single-threaded export "works very well on macOS and
iOS too, where it always had compatibility issues with multiple threads
exports." iOS web works, on the single-threaded path, with WebGL 2.0 caveats
the docs do not enumerate.

Concretely, a player opening the Godot web build on an iPhone can expect: a
multi-megabyte download; a WebGL 2.0 path Godot's own docs consider the
weakest; audio that will not start until they touch the screen (browser
autoplay policy); the game pausing whenever the tab is backgrounded
(`_process()` stops); and no reliable full-screen without an input event.
**Cosmo's native iOS app is the answer for iOS players, and after this move
that stops being a nice-to-have.**

### PWA and the freshness contract

With **Progressive Web App → Enable** you get a service worker, offline
caching, installability, an **Offline Page**, icon sizes (144/180/512),
orientation and display mode, and the **Enable Cross Origin Isolation Headers**
workaround.

The service worker also gives a *better* version of the mechanism Cosmo already
invented and then had to disable:

```gdscript
extends Node

var _pending_update := false

func _ready() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.pwa_update_available.connect(_on_update_available)

func _on_update_available() -> void:
	# Never interrupt a run. Offer it at the title screen only.
	_pending_update = true

func offer_update_at_title() -> void:
	if _pending_update and JavaScriptBridge.pwa_needs_update():
		# Reloads the app in ALL open browser tabs.
		var err := JavaScriptBridge.pwa_update()
		if err != OK:
			push_warning("PWA update failed: %d" % err)
```

`pwa_needs_update()`, `pwa_update()` and the `pwa_update_available` signal are
real API on `JavaScriptBridge`, and `pwa_update()` *"will be reloaded in all
browser tabs"*.
([JavaScriptBridge](https://docs.godotengine.org/en/stable/classes/class_javascriptbridge.html))

This maps one-to-one onto Cosmo's `freshCheck()` design and its guards: never
swap during a live run, only from the menu. The difference is that the browser
tells you, instead of you range-requesting your own bundle and regexing a
`BUILD` literal out of it — the approach currently inert in the shipped Phaser
build because minification eats the literal.

### The rest of the limitations

Worth knowing before they surprise you: the project **pauses when the tab is
inactive**; full-screen and mouse capture require an active input event;
gamepads are invisible until a button is pressed; clipboard and microphone need
a secure context; low-level networking is unavailable — HTTP, WebSocket and
WebRTC only, under same-origin rules; persistence needs cookies/IndexedDB
enabled, with third-party cookies required inside an iframe.

And: **the export cannot be opened over `file://`.** It needs a server — the
same constraint `CLAUDE.md` already states for the Vite entry, so the habit
carries over.

---

## 8. Save data

### Where `user://` actually is

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\Godot\app_userdata\[project_name]` |
| macOS | `~/Library/Application Support/Godot/app_userdata/[project_name]` |
| Linux | `~/.local/share/godot/app_userdata/[project_name]` |
| Android / iOS | app-private storage, inaccessible to other apps |
| Web | **a virtual filesystem stored in IndexedDB** |

With `application/config/use_custom_user_dir` enabled the
`Godot/app_userdata/` layer disappears (`%APPDATA%\[project_name]`), and
`application/config/custom_user_dir_name` renames it, accepting separators for
`Studio/Game`. `OS.get_user_data_dir()` returns the real path at runtime.
([Data paths](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html))

Two consequences:

- **`res://` is not writable in an exported project** — only `user://` is
  documented as "guaranteed to be writable to, even in an exported project".
  Everything the game persists goes there.
- **The path is derived from the project name.** Renaming the project orphans
  every existing save. Set `use_custom_user_dir` and a stable
  `custom_user_dir_name` on day one and never change them. This is the exact
  analogue of Cosmo's existing rule that the Capacitor scheme must not change
  because `localStorage` is origin-scoped.

On web, `FileAccess` writes sync to IndexedDB automatically;
`JavaScriptBridge.force_fs_sync()` exists only for "modules or extensions that
can't use FileAccess". IndexedDB is site data — a player who clears browser
data, or plays in a private window, has no save. That is no worse than
`localStorage` today, but the failure mode is identical and should not be
mistaken for an improvement.

### The save format

Use `ConfigFile` or JSON. Not `store_var`.

```gdscript
class_name SaveStore
extends RefCounted

const PATH := "user://records.cfg"
const SECTION := "records"

static func write(values: Dictionary) -> Error:
	var cfg := ConfigFile.new()
	cfg.load(PATH)  # a missing file is a fresh install, not an error
	for key: String in values:
		cfg.set_value(SECTION, key, values[key])
	# Write beside, then swap: a crash mid-write must not eat the record.
	var tmp := PATH + ".tmp"
	var err := cfg.save(tmp)
	if err != OK:
		return err
	var dir := DirAccess.open("user://")
	if dir == null:
		return DirAccess.get_open_error()
	return dir.rename(tmp, PATH)

static func read_int(key: String, fallback: int = 0) -> int:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return fallback
	return int(cfg.get_value(SECTION, key, fallback))
```

`ConfigFile` gives you `load` / `save` / `parse` / `encode_to_text`,
section-and-key access, and encrypted variants. Its one documented gotcha:
**section and property names cannot contain spaces — anything after a space is
dropped on save and on load.** Comments are preserved on parse but lost on
save.
([ConfigFile](https://docs.godotengine.org/en/stable/classes/class_configfile.html))

The write-then-rename above is not something Godot does for you; a plain
`cfg.save(PATH)` that is interrupted leaves a truncated file. On web the rename
goes through the same virtual filesystem, so the pattern should hold there too
— but verify it, because the IndexedDB-backed FS is the least-exercised path in
this list.

### Encrypted saves, and whether to bother

Two different levels:

**Per-file encryption** — no custom templates needed:

```gdscript
var f := FileAccess.open_encrypted_with_pass(
	"user://records.dat", FileAccess.WRITE, _device_pass())
if f != null:
	f.store_string(JSON.stringify(payload))
```

`FileAccess.open_encrypted(path, mode_flags, key: PackedByteArray, iv := PackedByteArray())`
takes a **32-byte** key; `open_encrypted_with_pass(path, mode_flags, pass: String)`
derives one from a string. `ConfigFile.save_encrypted_pass()` /
`load_encrypted_pass()` are the same idea one level up.
([FileAccess](https://docs.godotengine.org/en/stable/classes/class_fileaccess.html))

**PCK encryption** — encrypts the shipped pack with a 256-bit AES key
(`openssl rand -hex 32`), supplied as `SCRIPT_AES256_ENCRYPTION_KEY` at engine
compile time. The docs are blunt about the requirement and the limit: it *"will
**not** work if you use official, precompiled export templates"*, and *"the key
needs to be stored in the binary"*, so extraction is harder, not impossible.
([Compiling with PCK encryption key](https://docs.godotengine.org/en/stable/engine_details/development/compiling/compiling_with_script_encryption_key.html))

**The verdict for Cosmo: don't.** The whole game is delivered to the browser
already, the repository is public, and the leaderboard is *soft on purpose* —
it rejects the impossible rather than pretending to be unforgeable. An
encrypted local save adds a key you must never lose, breaks a player's ability
to recover their own file, and buys nothing against an adversary who can
already read the wasm. If tamper-resistance ever matters, the answer is the one
the current design already reached: **server-side merge with monotonic rules**,
which makes a forged `best: 0` a no-op.

---

## 9. Migrating Cosmo's existing player records

This has a real, checkable answer, and it differs for each of three
populations.

### The keys

Everything is stored under a `cometloop:` prefix. The keys the game reads
today: `best`, `gl`, `runs`, `intro`, `muted`, `swipe`, `groove`, `hopped`,
`landed`, `struggle`, `seen`, `seen2`. `cometloop:level` and `cometloop:mode`
are deliberately *not* read — a stored `7` would read back as level 7 of 6, and
a stored mode may no longer exist. The rebuild should preserve exactly that
decision: import the twelve, ignore the two.

### (a) Web players — recoverable, if the origin stays the same

Godot's web export runs inside the page, so `localStorage` for that origin is
readable. **`JavaScriptBridge` is registered as an engine singleton on every
platform**, with stub implementations off-web that return null — verified in
`platform/web/api/api.cpp` (which guards its bodies with
`#if !defined(WEB_ENABLED)`) and `platform/SCsub` (which compiles every
platform's `api/*.cpp` into every build). So this compiles and runs everywhere:

```gdscript
class_name LegacyImport
extends RefCounted

const PREFIX := "cometloop:"
const KEYS := [
	"best", "gl", "runs", "intro", "muted", "swipe",
	"groove", "hopped", "landed", "struggle", "seen", "seen2",
]

## Returns {} on any platform that is not the web, and when nothing is stored.
static func read_browser_records() -> Dictionary:
	var found: Dictionary = {}
	if not OS.has_feature("web"):
		return found
	for key: String in KEYS:
		# JSON.stringify produces a correctly quoted JS string literal.
		var js := "window.localStorage.getItem(%s)" % JSON.stringify(PREFIX + key)
		var raw: Variant = JavaScriptBridge.eval(js, true)
		if raw is String and not String(raw).is_empty():
			found[key] = raw
	return found
```

Run it once, fold it into the new save with the same `max` semantics the
current code uses (a late read must never lower a record), and write a
`migrated_v1 = true` flag so it never runs again. Do **not** delete the
`localStorage` keys: if the Godot build has to be rolled back, they are the
only copy.

**The condition is the origin.** This works if the Godot build is served from
`https://cosmo-arcade.netlify.app` and `https://ats314.github.io/cosmo/` — the
same origins the Phaser build used. Serving the rebuild from a new subdomain
silently loses every signed-out web player's record. That makes the play URL a
genuine migration constraint, not just a link in the README.

### (b) Native players — not recoverable

Capacitor stores `localStorage` inside the WebView's own origin storage
(`https://localhost` on Android, `capacitor://localhost` on iOS). A Godot
native export has no WebView and no access to that store; on Android the data
sits in a LevelDB the engine cannot read, and on iOS it is inside the app
container's WebKit storage. Recovering it would need a platform plugin whose
only job is to read a browser database — real work, for a population you cannot
size.

**Say this in the release notes rather than discovering it in a support
message.** A signed-out native player's best score does not survive the move.

### (c) Signed-in players — recoverable everywhere, and this is the lever

The account service already holds the synced keys server-side, merged
monotonically, keyed on a bearer token stored locally. Any player who signs in
before the switch gets their records back on the Godot build on any platform,
because the Godot client calls the same `/api/progress` and the server does the
fold.

Three things follow:

1. **Keep the endpoint contract identical.** Same paths, same
   `Authorization: Bearer <id>.<key>` shape, same bare (unprefixed) key names
   in the JSON. The Godot client is an `HTTPRequest` against the same
   `https://cosmo-arcade.netlify.app` origin. Nothing server-side changes.
2. **The CORS allowlist survives, and shrinks.** `cors()` in
   `netlify/lib/auth.mjs:50-60` only *adds* headers when the origin matches; it
   never rejects. A Godot **native** client is not a browser, sends no `Origin`
   header, and is therefore unaffected — the endpoints work for it as-is. The
   two Capacitor entries (`https://localhost`, `capacitor://localhost`) become
   dead once the Capacitor apps are retired, and should be removed then, not
   before.
3. **The strongest pre-migration action available is a prompt to sign in**,
   shipped in the *current* Phaser build, before the Godot one exists. It is
   the only thing that converts population (b) into population (c).

---

## 10. Localisation, if it ever matters

Author strings in a CSV with a keys column and one column per locale; Godot
imports it into `.translation` files; register those under **Project Settings →
Localization → Translations**; call `tr("KEY")` and `tr_n(singular, plural, n)`
in code. The **Remaps** tab swaps whole resources (textures, fonts, audio) per
locale. `TranslationServer` switches locale at runtime. Test with the
`--language` flag.
([Internationalizing games](https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html))

The structural decision to make *now*, not later: **do not scatter literal
strings through the code.** Even with no plan to localise, writing
`tr(&"LESSON_FIRST_HOP")` costs nothing and makes the teaching copy
addressable. Cosmo has 103 lesson records; retrofitting keys onto them later is
the expensive version.

The real cost for this game is not the pipeline, it is the font. Cosmo draws
its text, and a localised build needs glyph coverage — the ICU Data export
template download is what buys CJK and Thai. Budget the font, not the CSV.

---

## 11. GDExtension: what it is for, and why the answer here is no

GDExtension lets the engine load native shared libraries at runtime without
recompiling the engine — `gdextension_interface.h` for the C boundary,
`extension_api.json` for the exposed API, a `.gdextension` file to load it, and
in practice `godot-cpp` rather than the raw interface.
([What is GDExtension?](https://docs.godotengine.org/en/stable/engine_details/engine_api/gdextension/what_is_gdextension.html))

### The real cost

- **One compiled artifact per platform and architecture you ship.** Cosmo ships
  web (wasm32), Android (arm64, plus arm32 if you still care), iOS (arm64), and
  whatever you develop on. Each needs a toolchain and a CI job.
- **On web it forces cross-origin isolation on**, because Extensions Support
  requires it — throwing away the single-threaded export's main advantage and
  re-introducing the embedding restrictions.
- **Web GDExtension has known sharp edges.** Switching thread modes between
  exports has produced stale-`.wasm` export failures
  ([godotengine/godot#95077](https://github.com/godotengine/godot/issues/95077)),
  and statically linked libraries have hit wasm `LinkError`s
  ([#96492](https://github.com/godotengine/godot/issues/96492)). Treat these as
  leads, not current status — check whether they are fixed in 4.7 before
  relying on either.
- **Version compatibility is a standing obligation.** `godot-cpp` is pinned to
  an engine API version; every engine upgrade is a rebuild.
- **Debugging crosses a language boundary.** The crash you get is a native
  stack, not a GDScript one.

### The signs that would actually justify it

Not "GDScript feels slow". Specifically:

1. The profiler shows **script time** — not render or physics time — dominating
   a frame that is missing 16.6 ms on the target device.
2. The hot path is a **tight numeric loop over thousands of elements** that
   cannot be expressed as a shader, a `MultiMesh`, or a call into the rendering
   or physics servers.
3. You have already removed **per-frame allocation** from it. Every `Array`,
   `Dictionary` or object created in `_process` is garbage the next frame.
4. Everything is **statically typed**, which is the single largest GDScript
   speedup available and costs nothing.
5. You need a **native library with no GDScript equivalent** — a codec, a
   platform SDK, a physics engine.

Cosmo hits none of these. The heaviest work in the game is shader work, which
runs on the GPU regardless of the calling language; the simulation is a few
dozen entities; and the music scheduler's difficulty is *timing*, not
throughput — a problem GDExtension does not solve. The tooling has to stay
small, and a native build matrix is the opposite of that.

Reach for the engine's servers before reaching for C++: `RenderingServer`,
`MultiMeshInstance2D` for many identical sprites, and shader-side computation
are the professional answers to the problems that make people write extensions.

---

## Pitfalls

**Godot 3 idiom that fills search results and is wrong here**

| Godot 3 | Godot 4.7 |
|---|---|
| `yield(obj, "signal")` | `await obj.signal` |
| `export var x = 1` | `@export var x: int = 1` |
| `setget set_x, get_x` | `var x: int : set = _set_x, get = _get_x` |
| `Tween` node | `create_tween()` |
| `connect("pressed", self, "_on_pressed")` | `pressed.connect(_on_pressed)` |
| `KinematicBody2D` | `CharacterBody2D` |
| `OS.get_screen_size()` and friends | `DisplayServer.*` |
| `JavaScript` singleton | `JavaScriptBridge` |
| `File`, `Directory` (with `.new()`) | `FileAccess`, `DirAccess` (static `open`) |
| `tool` keyword | `@tool` |

**Godot 4 traps specific to this ground**

- **`get_setting()` silently ignores feature overrides.** Use
  `get_setting_with_override()`.
- **Uncommitted `*.uid` files.** Works locally, breaks on clone. Since 4.4 this
  is the top new-project version-control failure.
- **Committed `.godot/`.** Ships keystore passwords and encryption keys to the
  repository.
- **Skipping `--import` in CI.** A clean checkout with no cache exports a pack
  with unimported assets and no error you will notice.
- **Assuming `file://` works.** The web export needs a server.
- **Assuming AudioEffects work on web.** They do not in Sample mode, which is
  the default.
- **Assuming PCK encryption works with official templates.** It does not.
- **Renaming the project.** `user://` derives from the project name; the rename
  orphans every save.
- **`free()`ing an autoload.** Documented engine crash.
- **Doc URLs moved in 4.7.** `contributing/development/...` is now
  `engine_details/development/...`, and the GDExtension pages are under
  `engine_details/engine_api/`. Old links 404 rather than redirect — a common
  source of "the docs say" claims sourced from a stale 4.3 page.
- **Mixing `preload` and `load` carelessly.** `preload` is parse-time and
  cannot take a variable; `load` is runtime and can. A `preload` of a heavy
  resource inside a script that is itself preloaded pulls the whole graph in at
  startup.

---

## In Cosmo

| Cosmo today (Phaser 4.2.1 + Vite + Capacitor 8) | Godot 4.7 equivalent | Notes |
|---|---|---|
| `vite build` → `dist/`, published to Netlify + GitHub Pages | `godot --headless --export-release "Web" build/web/index.html` | `--import` first on a clean runner |
| `base: './'` for the `/cosmo/` Pages subpath | The web export is already path-relative | Verify the PWA service-worker **scope** at a subpath |
| `tools/check.mjs` publish allowlist (`internalAsset` / `publicAsset`) | Export-preset include/exclude filters **plus** a CI walk of the export directory | Godot's filters are weaker; keep the check |
| `check.mjs:472-477` proprietary notice in the shell | Custom HTML shell + Head Include; `LICENSE` / `THIRD_PARTY_LICENSES.txt` copied by CI | Nothing copies them for you |
| `__COSMO_BUILD__` Vite define from `git rev-parse` | CI-generated `game/build_stamp.gd`, or an `EditorExportPlugin` | Prefer the generated file |
| `freshCheck()` / `?u=` hop / `no-cache` on `index.html` | PWA service worker + `JavaScriptBridge.pwa_needs_update()` / `pwa_update()` / `pwa_update_available` | A better version of the same contract; keep the "menu only, never mid-run" guard |
| `capacitor.config.ts`, `cap sync`, `android/` + `ios/` | Native export presets; Android AAB via Gradle build (JDK 17, SDK 35, keystore); iOS → Xcode project on macOS | Capacitor, the WebView and the two `localhost` origins all disappear |
| `src/platform/native.ts` pause/resume/back bridge | `NOTIFICATION_APPLICATION_PAUSED` / `_RESUMED` / `_FOCUS_OUT`, `NOTIFICATION_WM_GO_BACK_REQUEST`, `set_auto_accept_quit(false)` | Same three callbacks, no plugin |
| `@capacitor/haptics` six-kind `haptic()` with a 65 ms rate limit | `Input.vibrate_handheld(ms, amplitude)` | Blunter API; rebuild the kind→duration map and the rate limit in GDScript |
| `localStorage` `cometloop:*` (12 keys read, 2 deliberately not) | `user://records.cfg` via `ConfigFile`, with `use_custom_user_dir` + a fixed `custom_user_dir_name` | Keep ignoring `level` and `mode` |
| `window.storage` cloud shim over `/api/progress` | `HTTPRequest` against the same origin and the same bearer shape | Server-side merge unchanged; `cors()` never rejects, so a native (non-browser) client works as-is |
| `MASTER = 2.15`, `SKY_ARENA_CALM = 0.62`, `GL_MOTION = 0.25` and the rest of the tuned constants | `const` in a `Tune` class, with the "why" comment carried across | Do **not** put these in `.tres` — the comment is part of the value |
| Rings, worlds, orb pools, formation tiers, level windows | Custom `Resource` + `.tres` under `content/` | Typed `Array[T]` exports; treat loaded specs as immutable |
| `public/art/` 24 WebP sprites + `manifest.json` + `BootScene` loader | `res://art/`, imported textures, `.uid` references | Godot's importer replaces the manifest; keep the provenance record |
| WebAudio bus with a measured make-up gain and effects | **Blocked on the Sample/Stream decision above** | Bake the chain into samples, or accept Stream + threads + COOP/COEP |
| Nine harnesses over an extracted JS runtime (`tools/lib/game-source.mjs`) | GDScript unit tests plus a headless `--script` run | The source-extraction trick is obsolete; the *coverage* it bought is not |

### The three decisions this document forces

1. **The play URL is now a save-migration constraint.** Serve the Godot web
   build from the same origins the Phaser build used, or every signed-out web
   player loses their record. If a new origin is unavoidable, ship a one-time
   handover page on the old origin that reads `localStorage` and passes the
   values across — but same-origin is far cheaper.
2. **Ship the sign-in prompt before the rebuild lands.** It is the only
   mechanism that saves native players' records, and it has to be in the
   *current* build to work.
3. **Decide the web audio path before writing the scheduler.** Sample mode with
   baked effects, or Stream mode with cross-origin isolation. The scheduler's
   architecture differs between them, and this is the hardest technical
   requirement in the project.

---

## Sources

Godot version and releases
- https://godotengine.org/download/archive/
- https://github.com/godotengine/godot-builds/releases
- https://godotengine.org/releases/4.7/

Project structure and version control
- https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html
- https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
- https://godotengine.org/article/uid-changes-coming-to-godot-4-4/
- https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html
- https://docs.godotengine.org/en/stable/tutorials/plugins/editor/installing_plugins.html

Configuration and export
- https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html
- https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- https://docs.godotengine.org/en/stable/classes/class_editorexportplugin.html
- https://docs.godotengine.org/en/stable/engine_details/development/compiling/optimizing_for_size.html
- https://docs.godotengine.org/en/stable/engine_details/development/compiling/compiling_with_script_encryption_key.html
- https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html

Web export
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/export/exporting_for_web.rst
- https://godotengine.org/article/progress-report-web-export-in-4-3/
- https://docs.godotengine.org/en/stable/classes/class_javascriptbridge.html
- https://docs.godotengine.org/en/stable/classes/class_audioserver.html
- https://docs.godotengine.org/en/stable/tutorials/audio/audio_streams.html

Storage and platform
- https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html
- https://docs.godotengine.org/en/stable/classes/class_fileaccess.html
- https://docs.godotengine.org/en/stable/classes/class_configfile.html
- https://docs.godotengine.org/en/stable/classes/class_mainloop.html
- https://docs.godotengine.org/en/stable/classes/class_input.html
- https://docs.godotengine.org/en/stable/tutorials/inputs/handling_quit_requests.html

Localisation
- https://docs.godotengine.org/en/stable/tutorials/i18n/internationalizing_games.html

GDExtension
- https://docs.godotengine.org/en/stable/engine_details/engine_api/gdextension/what_is_gdextension.html
- https://github.com/godotengine/godot/issues/95077
- https://github.com/godotengine/godot/issues/96492

Godot source, verifying JavaScriptBridge registration on non-web builds
- https://raw.githubusercontent.com/godotengine/godot/4.7/platform/web/api/api.cpp
- https://raw.githubusercontent.com/godotengine/godot/4.7/platform/SCsub

Cosmo, read in this checkout on 2026-09-07
- `db/notes/delivery/publish-allowlist.md`, `build-stamp-and-freshness.md`,
  `native-packaging.md`, `accounts-and-board.md`
- `docs/engine/delivery.md`, `docs/invariants.md:110-119`
- `vite.config.ts`, `package.json`, `manifest.webmanifest`,
  `netlify/lib/auth.mjs:40-60`
- measured: `dist/` 4,004,830 B across 47 files; `dist/assets/index-DG2O-aGv.js`
  1,621,182 B / 439,055 B gzipped; `public/art/` 788,521 B across 25 files
