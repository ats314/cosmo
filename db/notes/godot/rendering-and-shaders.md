# Rendering and shaders in Godot 4

> What Cosmo's sky shader, glow chain and baked halos become in Godot, which
> renderer that choice forces, and where Godot is genuinely worse than the
> WebGL/Canvas pipeline it replaces.
> **Written against Godot 4.7.2 (stable, released 18 August 2026).**
> `docs.godotengine.org/en/stable` currently serves 4.7. Anything gated to a
> specific release is marked inline.

Anchors of the form `src/game/runtime.js:NNNN` are the Phaser implementation at
commit `01a3a25` (12,335 lines), read directly for this document. Several
records under `db/records/` were built at `8d10559` and the render subsystem has
moved since — `GL_MOTION` is now **1.0**, the painted-plate sky path
(`drawGeminiSky`) is gone, and the shader now samples three art textures as
materials. Where this document and an older record disagree, the source wins.
Long-form background lives in `db/notes/render/`.

---

## The short version

- **The renderer choice is a web-export choice.** Web only runs Compatibility
  (OpenGL/WebGL 2). Forward+ targets desktop — on mobile the docs call it
  "Supported, but poorly optimized." Mobile runs Vulkan/Metal on phones. If
  Cosmo keeps its web build, Compatibility is either the single target or you
  accept two visual targets.
- **The sky is one `canvas_item` fragment shader on a full-rect `ColorRect`**
  inside a `CanvasLayer` at a negative layer. `GL_FS` ports almost line for
  line. Drop `uRes`: derive resolution from `1.0 / SCREEN_PIXEL_SIZE`.
- **Do not use `TIME` for the scenic clock.** Cosmo's clock is an integrated
  dilated delta that freezes under reduced motion. Push your own float uniform.
  Also lower `rendering/limits/time/time_rollover_secs` (default 3600) if you
  do use `TIME` anywhere.
- **Do not use WorldEnvironment glow for Cosmo's halo.** It thresholds the
  composited frame — the exact approach `db/notes/render/glow-chain.md` records
  as rejected, because it picks up rings, pools and HUD. Rebuild the semantic
  bright pass in a `SubViewport` and blur it yourself.
- **Reading the screen** is `uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;`
  plus `textureLod(...)`. `SCREEN_TEXTURE` as a built-in was removed in Godot 4.
  The first node that uses the hint triggers one full-screen back-buffer copy.
- **`repeat_disable` is clamp-to-edge, not clamp-to-border.** Cosmo's border
  reflection bug (measured at 1.82× the physical level) survives the port
  intact. Keep the out-of-bounds tap zero-weighting.
- **There is no `screen` blend mode.** `canvas_item` render modes are mix, add,
  sub, mul, premul_alpha, disabled. Cosmo no longer uses `screen` anywhere at
  HEAD, but 25 `'lighter'` composites do map cleanly onto `blend_add`.
- **Per-instance uniforms work in `canvas_item` shaders since 4.4**, max 16 per
  shader, no textures or arrays, set with `CanvasItem.set_instance_shader_parameter()`.
  In 4.3 and earlier they are 3D-only.
- **Compute shaders are Forward+/Mobile only**, and the docs say support "is
  generally poor on mobile devices (due to driver bugs)". They are not an
  option for this game.
- **Texture import for 2D: Lossless, mipmaps off unless you actually downscale.**
  VRAM compression is documented as producing visible artifacts in 2D. Filter
  and repeat moved out of the importer onto `CanvasItem` / `Viewport`.

---

## 1. The renderer choice, and what it costs

Godot 4 ships three rendering methods. The documented support matrix
([Renderers](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html)):

| | Forward+ | Mobile | Compatibility |
|---|---|---|---|
| API | Vulkan / D3D12 / Metal | Vulkan / D3D12 / Metal | OpenGL 3.3, GLES 3.0, WebGL 2 |
| Desktop | yes | yes | yes (low-end) |
| Mobile | "Supported, but poorly optimized. Use Mobile or Compatibility instead." | yes (high-end) | yes (low-end) |
| Web | **no** | **no** | **yes** |
| 2D | "yes, but Compatibility is usually good enough for 2D" | same | yes |
| Compute shaders | yes | yes | **no** |
| `CompositorEffect` post-processing | yes | yes | **no** |
| Glow | full | "looks different due to the lower dynamic range" | simplified implementation |

The editor writes the choice into `project.godot` as
`rendering/renderer/rendering_method`, with the usual per-feature override
syntax for platform-specific values (`rendering_method.mobile`,
`rendering_method.web`) — a new project ships with the mobile and web overrides
set to `gl_compatibility`. The renderers page itself only documents switching
by clicking the renderer name in the editor's upper-right corner, so treat the
setting names as what the editor writes rather than as a documented API.

**What this means for Cosmo concretely.** Cosmo ships web (Vite build) *and*
iOS/Android. Godot cannot give those the same renderer. Three honest options:

1. **Compatibility everywhere.** One visual target, one set of tuned constants,
   one thing to test. You give up compute shaders (which this game does not
   need), `CompositorEffect` (which the glow chain does not need if it is built
   out of SubViewports), and the flexible half of `Environment.glow` (which
   this game should not use — §8).
2. **Mobile on phones, Compatibility on web.** Better phone throughput, and
   `use_hdr_2d` behaves more predictably, at the cost of two visual targets and
   two sets of screenshots for every render check.
3. **Drop the web build.** Not a rendering decision, but it is the only thing
   that makes Forward+/Mobile a free choice.

The recommendation in §12 is (1), and the reason is not performance — it is
that Cosmo's render invariants are stated as measured pixel ratios
(`rendercheck.mjs` fails outside `[0.35, 2.6]` on the GPU/disc light ratio),
and two renderers means two sets of thresholds forever.

---

## 2. Godot Shading Language vs GLSL: what ports, what does not

The language is "similar to GLSL ES 3.0"
([Shading language](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html)).
Cosmo's `GL_FS` is WebGL 1 / GLSL ES 1.0, so the port is mostly an upgrade.

**What ports unchanged:** every scalar/vector/matrix type, `mix`, `smoothstep`,
`step`, `clamp`, `fract`, `mod`, `exp`, `pow`, `dot`, `normalize`, `length`,
`atan(y,x)`, `sin`/`cos`, struct and const declarations, `for`/`if`/`switch`,
and the `texture()` call form. Bit conversion (`floatBitsToUint`,
`uintBitsToFloat`) and `fma` are available, so a hash function written against
GLSL ES 3.0 works verbatim
([Built-in functions](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_functions.html)).

**What does not port:**

| WebGL/GLSL | Godot 4 |
|---|---|
| `#version`, `precision highp float;` header | omitted; `shader_type canvas_item;` is the first line. `lowp`/`mediump`/`highp` exist as optional per-declaration qualifiers, `highp` is the default |
| `gl_FragColor` | `COLOR` (an `inout vec4` in `fragment()`) |
| `texture2D()` | `texture()` |
| `attribute` / `varying` in the vertex stage | `varying` declared at file scope, written in `vertex()`, read in `fragment()` |
| `gl_FragCoord` | `FRAGCOORD` |
| `uniform sampler2D` + CPU-side sampler state | the sampler state is a *uniform hint*: `filter_linear_mipmap`, `repeat_disable`, … |
| a `uTime` uniform you upload | `TIME` is a built-in (but see §3 — Cosmo should still upload its own) |
| a `uRes` uniform | `SCREEN_PIXEL_SIZE` is the inverse viewport size, in `fragment()` |
| implicit int→float | **not allowed.** "implicit casting between scalars and vectors of the same size but different type is not allowed. Casting of types of different size is also not allowed." Write `float(i)`. |
| `#define` only via string concatenation on the CPU | a real preprocessor: `#define`, `#if`/`#ifdef`/`#elif`/`#else`/`#endif`, `#undef`, `#error`, `#pragma`, and `#include` of `.gdshaderinc` files, include depth capped at 25 |

The preprocessor matters more than it looks for a 150-line sky shader. Cosmo's
`GL_FS` contains a `cloud()` fbm, a `belt()` annulus, a hash, and a tone map
that the CPU fallback `drawCalmSky` duplicates in JavaScript. In Godot, put
`hash21`/`noise2`/`cloud` in `res://shaders/lib/noise.gdshaderinc` and
`#include` it from both the sky shader and anything else that needs the same
field, so the two can never drift. The docs also note that `#if` is faster than
a runtime `if` because the excluded branch is never compiled and does not
consume registers — relevant if you ever want a "low" variant of the sky.

A minimal, complete canvas_item shader in current idiom:

```glsl
shader_type canvas_item;
render_mode unshaded;

#include "res://shaders/lib/noise.gdshaderinc"

uniform vec2  arena_centre = vec2(0.5, 0.5);
uniform float arena_calm : hint_range(0.0, 1.0) = 0.62;
uniform float scenic_time = 0.0;
uniform vec4  accent = vec4(0.0);            // (strength, id, star, unused)
uniform vec3  tint : source_color = vec3(1.0);

// nebula() and calm_band() come from the include; they are not built-ins.
void fragment() {
	vec2 res = 1.0 / SCREEN_PIXEL_SIZE;               // viewport pixels
	vec2 p   = (UV - arena_centre) * vec2(res.x / res.y, 1.0);

	vec3 col = nebula(p, scenic_time) * tint;
	col     *= 1.0 - arena_calm * calm_band(length(p)) * 0.38;
	col      = vec3(1.0) - exp(-col * 1.35);          // the same tone map

	COLOR = vec4(col, 1.0);
}
```

`source_color` is the 4.x replacement for 3.x's `hint_color`. It tells the
editor the value is a colour *and* tells the engine to convert it to linear
where appropriate — omitting it is the single most common cause of a ported
shader looking washed out.

---

## 3. `canvas_item` shaders in depth

**Render modes** (complete): `blend_mix` (default), `blend_add`, `blend_sub`,
`blend_mul`, `blend_premul_alpha`, `blend_disabled`, `unshaded`, `light_only`,
`skip_vertex_transform`, `world_vertex_coords`
([CanvasItem shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)).

Note what is *not* there: **no `blend_screen`.** Canvas 2D's
`globalCompositeOperation = 'screen'` has no equivalent render mode. Either
read the back buffer and compute `1 - (1-a)*(1-b)` yourself, or accept
additive. Additive is not the same: `screen` cannot exceed 1.0 and additive
can, so an accent over an already-bright plate blows out where the original
rolled off. Cosmo's shipped code no longer composites anything with `screen` —
the painted-plate sky that did was removed — but its 25 `'lighter'` composites
are exactly `blend_add`, so the common case ports for free. Know the gap before
somebody reaches for `screen` in a rebuilt effect and finds nothing there.

**The three functions.** `vertex()` runs per vertex in local space,
`fragment()` per pixel, `light()` once per `Light2D` that touches the pixel.
`unshaded` skips `light()` entirely — use it on the sky and on anything
additive; it is both correct and cheaper.

**Built-ins worth knowing** (from the reference table):

- `UV` — 0..1 across the node's own quad. For a full-rect `ColorRect`, this is
  the screen. Use it, not `SCREEN_UV`, when you can: `SCREEN_UV` is fine here
  but `UV` costs nothing and keeps the shader usable inside a `SubViewport`.
- `SCREEN_UV` — "Screen UV coordinate for the current pixel."
- `SCREEN_PIXEL_SIZE` — "Size of individual pixels. Equal to the inverse of
  resolution." This is how you get the viewport size without a uniform.
- `TEXTURE_PIXEL_SIZE` — the same for the node's own texture.
- `FRAGCOORD` — pixel centre in screen space.
- `REGION_RECT` — the sprite region as `(x, y, w, h)`, normalized. Useful for
  atlased sprites where `UV` spans the atlas, not the frame.
- `CUSTOM0` / `CUSTOM1` — per-vertex custom data.
- `INSTANCE_CUSTOM` — `vec4` per instance. For particles it is documented as
  `x: rotation in radians, y: phase 0..1, z: animation frame`. For a
  `MultiMesh` it is whatever you wrote with `set_instance_custom_data()`.
- `LIGHT_VERTEX` — writable in `fragment()`; its Z component is height, which
  is how you fake a raised surface for 2D lights without a normal map.
- `SHADOW_VERTEX` — same idea, but only affects the shadow.

**`TIME` and the scenic clock.** `TIME` rolls over to 0.0 at
`rendering/limits/time/time_rollover_secs` (default 3600) "since large
floating-point values are less precise than small floating-point values". Set
it low — 300 is plenty for a shader whose fastest term is `sin(t*0.028)` — or
avoid it. **Cosmo must avoid it.** `skyAdvanceClock`
(`src/game/runtime.js:9929-9935`) reads `RM ? 0 : G.vt`, so the scenic clock
runs on the *dilated* clock and freezes entirely under reduced motion, and it
integrates two separate quantities: `GL.tw += d*GL_MOTION*M.motion` and a
directional `GL.stream += d*GL_MOTION*M.motion*GL.currentDir`, where
`GL.currentDir` eases toward the comet's travel direction on
`1 - exp(-d*4.5)`. `TIME` can express none of that. Push both as uniforms.

```gdscript
class_name SkyLayer
extends CanvasLayer

const P_SCENIC := &"scenic_time"
const P_STREAM := &"stream"
const GL_MOTION := 1.0           # src/game/runtime.js:9458, carried across

@export var rect_path: NodePath
var _mat: ShaderMaterial
var _scenic := 0.0
var _stream := 0.0
var _current_dir := 1.0

func _ready() -> void:
	layer = -100
	var rect: ColorRect = get_node(rect_path)
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mat = rect.material as ShaderMaterial

# dilated_delta is 0.0 under reduced motion; world_motion is the WORLDS row's
# own term, 0.48 to 0.80.
func advance(dilated_delta: float, world_motion: float, dir: float) -> void:
	var d := dilated_delta * GL_MOTION * world_motion
	_current_dir += (dir - _current_dir) * (1.0 - exp(-dilated_delta * 4.5))
	_scenic += d
	_stream += d * _current_dir
	_mat.set_shader_parameter(P_SCENIC, _scenic)
	_mat.set_shader_parameter(P_STREAM, _stream)
```

`&"scenic_time"` is a `StringName` literal. `set_shader_parameter` takes a
`StringName`; passing a plain `String` converts on every call. The sky shader
has twenty-three uniforms (`src/game/runtime.js:9697`); at 60fps that is nearly
1,400 conversions a second for no reason. Hoist them into consts.

---

## 4. Uniforms: material, global, per-instance

Three mechanisms, and they are not interchangeable.

**Material uniforms** — `ShaderMaterial.set_shader_parameter(name, value)`.
Scoped to the material. "Changes affect all instances using that
ShaderMaterial." This is right for the sky (one material, one node) and wrong
for two hundred stars that each want their own tint.

**Global uniforms** — declared `global uniform float sky_arena_calm;` in the
shader and registered in **Project Settings → Shader Globals**, then set with
`RenderingServer.global_shader_parameter_set(&"sky_arena_calm", 0.62)`. The
docs state that "Assigning global uniform values can be done as many times as
desired without impacting performance, as setting data doesn't require
synchronization between the CPU and GPU". Use these for values that genuinely
belong to the whole frame — the scenic clock, the event accent, the calm
constant. Cosmo has exactly two governing renderer constants named in
`CLAUDE.md`; making `SKY_ARENA_CALM` a global uniform gives them one home that
both the sky shader and any future material can read, instead of a value copied
into three materials.

**Per-instance uniforms** — declared with the `instance` qualifier:

```glsl
shader_type canvas_item;
render_mode unshaded, blend_add;

instance uniform vec4 halo_tint : source_color = vec4(1.0);
instance uniform float halo_energy : hint_range(0.0, 4.0) = 1.0;
```

```gdscript
star.set_instance_shader_parameter(&"halo_tint", Color(1.0, 0.84, 0.35))
star.set_instance_shader_parameter(&"halo_energy", 1.0 + 0.45 * beat)
```

**Version gate.** Per-instance uniforms in `canvas_item` shaders landed in
**Godot 4.4** (PR #99230, merged 2024-12-20, milestone 4.4, implemented for
Forward+, Mobile and Compatibility). In 4.3 and earlier the docs say "Per-instance
uniforms are only available in `spatial` (3D) shaders" and the shader compiler
rejects them. Limits in every version: **16 per shader**, no textures, no
arrays, scalars and vectors only. `instance_index(N)` pins a slot if you need
stable indices across shader variants.

`ShaderMaterial`'s own docs say per-instance uniforms are "preferred for
performance reasons over duplicating the material" — duplicating a material per
sprite is the naive route and it defeats batching.

**`INSTANCE_CUSTOM` and `MultiMesh`.** For hundreds of near-identical quads —
the bright pass's one disc per light, or a particle burst — `MultiMeshInstance2D`
is the tool. One draw call, per-instance transform, colour and a `vec4` of
custom data. (Cosmo's `starField` table at `src/game/runtime.js:339-351` is not
the case: `buildStarField` has no call site and the live stars are the shader's
three hashed layers. Do not rebuild dead code in a new engine.)

```gdscript
func build_starfield(points: PackedVector2Array, mesh: Mesh) -> MultiMesh:
	var mm := MultiMesh.new()
	# Format flags MUST be set before instance_count; setting instance_count
	# allocates the buffers and later flag changes have no effect.
	mm.transform_format = MultiMesh.TRANSFORM_2D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = mesh
	mm.instance_count = points.size()
	for i in points.size():
		mm.set_instance_transform_2d(i, Transform2D(0.0, points[i]))
		mm.set_instance_color(i, Color(1.0, 1.0, 1.0, 1.0))
		# x: twinkle phase, y: twinkle rate, z: tier, w: spare
		mm.set_instance_custom_data(i, Color(randf() * TAU, 0.6, 1.0, 0.0))
	return mm
```

The ordering rule is documented — `use_colors` and `use_custom_data` "must be
set when `instance_count` is 0 or less". Getting it wrong produces a silently
colourless field, which is a genuinely nasty afternoon.

Custom data "has to be manually accessed in your custom shader using
`INSTANCE_CUSTOM`" — it is a `vec4` in `vertex()`; pass it to `fragment()` in a
`varying` if you need it there. The instance *colour* path is less clearly
documented for 2D: `set_instance_color` is described as "Sets the color of a
specific instance by multiplying the mesh's existing vertex colors", and in a
`canvas_item` shader that lands in the vertex-stage `COLOR`. Treat that as
**reasoned from the vertex-colour description rather than stated for 2D**, and
prefer `INSTANCE_CUSTOM` when you need certainty — it is the path the docs
name explicitly.

---

## 5. Reading the screen, and what it costs

`SCREEN_TEXTURE` was removed as a built-in in Godot 4. The current form is a
uniform with a hint
([Screen-reading shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/screen-reading_shaders.html)):

```glsl
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_nearest;

void fragment() {
	COLOR = textureLod(screen_texture, SCREEN_UV, 0.0);
}
```

Three things are load-bearing in that declaration and all three are commonly
copied wrong:

- `hint_screen_texture` is what makes the engine emit a back-buffer copy at
  all.
- `repeat_disable` — sampling outside the buffer must not wrap. See §7 for why
  clamp is not actually safe either.
- `filter_nearest` vs `filter_linear_mipmap` — **`textureLod` with a LOD above
  0.0 does nothing unless the filter hint contains `mipmap`.** The docs call
  this out explicitly.

**The cost, in 2D.** The first node whose material uses `hint_screen_texture`
triggers a full-screen copy into the back buffer. Subsequent nodes reuse that
same copy — they do *not* each trigger one, and consequently **overlapping
screen-reading materials do not see each other's output**. To force an
intermediate refresh, put a `BackBufferCopy` node between them
(`copy_mode` = `COPY_MODE_RECT` with a `rect`, or `COPY_MODE_VIEWPORT` for the
whole screen; `COPY_MODE_DISABLED` makes the node use the screen region it
covers directly).

**The cheap wide blur.** Because the back buffer can carry mipmaps, a two-tap
`textureLod` gives you a two-level glow for the price of one full-screen pass:

```glsl
shader_type canvas_item;
render_mode unshaded, blend_add;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform float mid_weight  : hint_range(0.0, 2.0) = 0.62;   // FX_MIDW
uniform float wide_weight : hint_range(0.0, 2.0) = 0.85;   // FX_WIDEW
uniform float composite   : hint_range(0.0, 1.0) = 0.55;   // FX_A

void fragment() {
	vec3 mid  = textureLod(screen_texture, SCREEN_UV, 3.0).rgb;
	vec3 wide = textureLod(screen_texture, SCREEN_UV, 5.0).rgb;
	COLOR = vec4((mid * mid_weight + wide * wide_weight) * composite, 1.0);
}
```

This is the naive-but-good route and it is worth knowing exactly why Cosmo
cannot use it as-is: a mip cascade is a box downsample, and
`db/notes/design/render-decisions.md` records that measurement — a box
downsample preserves the peak of any feature larger than a buffer pixel, so
levels *sum* rather than spread (the core came out 61% hotter while the halo
barely moved), and a coarse level blown up through a bilinear tent swings a
light's halo by 80% as it crosses the sampling grid. Cosmo is a game where
everything is permanently in orbit across that grid. The mip trick is right for
a static scene and wrong for this one — which is precisely the kind of thing a
handbook has to say out loud, because the mip trick is what every tutorial
shows.

---

## 6. `CanvasGroup`: compositing a set of nodes as one

`CanvasGroup` draws all its `CanvasItem` children into the back buffer and
composites the result once. Its stated purpose: "draw overlapping translucent
2D nodes without causing the overlapping sections to be more opaque than
intended (set the `CanvasItem.self_modulate` property on the CanvasGroup to
achieve this effect)."

The default behaviour is this shader, quoted from the class reference — worth
reading because a custom material *replaces* it and you must re-do the
un-premultiply yourself:

```glsl
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_nearest;

void fragment() {
	vec4 c = textureLod(screen_texture, SCREEN_UV, 0.0);

	if (c.a > 0.0001) {
		c.rgb /= c.a;
	}

	COLOR *= c;
}
```

Properties, with the documented trade-offs:

- `fit_margin` (10.0) — expands the drawable rect. "This increases both the
  backbuffer area used and the area covered by the CanvasGroup both of which
  can reduce performance." If a child's shader writes outside its own quad — a
  glow, a bleed — you must grow this or it gets clipped.
- `clear_margin` (10.0) — expands the cleared area. Smaller is faster, "however
  if `use_mipmaps` is enabled, a small margin may result in mipmap errors at
  the edge."
- `use_mipmaps` (false) — "calculates mipmaps for the backbuffer before drawing
  the CanvasGroup". "Generating mipmaps has a performance cost so this should
  not be enabled unless required." This is what makes the §5 `textureLod` trick
  work on a group rather than the whole screen.

**The warning that will cost you an afternoon:** children with `clip_children`
set to anything other than `CLIP_CHILDREN_DISABLED` "will not function
correctly" inside a `CanvasGroup`, because both features use the back buffer.

**Where this fits Cosmo.** A `CanvasGroup` over the whole gameplay layer, with
`use_mipmaps` on and a custom material doing the two-LOD composite, is a
*legitimate* one-node glow for the arena — cheaper than any SubViewport chain
and identical on all three renderers. It is the right answer for the HUD's
softer bloom and the wrong answer for the play field's halo, for the mip reason
in §5. Reach for it when what you want is "these overlapping translucent things
should composite as one object", which is exactly the Starfall trail, the nova
fronts and the magnet connection curves.

---

## 7. `SubViewport` chains for real multi-pass

This is the direct analogue of Cosmo's six-render-target ladder
(`src/game/runtime.js:10275-10288`). A `SubViewport` is a render target; its
`ViewportTexture` is what the next stage samples.

The rules that actually bite:

- `size` "must be set to a value greater than or equal to 2 pixels on both
  dimensions. Otherwise, nothing will be displayed." A `>> 2` chain on a narrow
  portrait viewport hits this on the short axis faster than you expect. Clamp.
- A `SubViewport` "must have a non-zero size and be either put inside a
  `SubViewportContainer` or assigned to a `ViewportTexture`." A chain stage is
  the second case — nothing displays it, something samples it.
- `render_target_update_mode`: `UPDATE_DISABLED`, `UPDATE_ONCE`,
  `UPDATE_WHEN_VISIBLE` (default), `UPDATE_WHEN_PARENT_VISIBLE`,
  `UPDATE_ALWAYS`. A chain stage that nothing displays is not "visible", so the
  default silently never renders. Set `UPDATE_ALWAYS`.
- `render_target_clear_mode`: `CLEAR_MODE_ALWAYS`, `CLEAR_MODE_NEVER`,
  `CLEAR_MODE_ONCE`.
- `transparent_bg = true` on every stage, or the glow arrives with an opaque
  black plate behind it.
- `disable_3d = true` — "Disable 3D rendering (but keep 2D rendering)." Free,
  and it is one less thing for the driver to set up per target.
- You cannot read and write the same viewport in one frame. A separable blur is
  two passes, so a three-level chain is six targets — which is exactly the
  count Cosmo already runs.

```gdscript
class_name GlowChain
extends Node

const LEVELS := 3
const FX_SPREAD := 1.15          # src/game/runtime.js:10086, carried across

var stages: Array[SubViewport] = []
var taps: Array[Texture2D] = []  # one per level: the vertical pass output

func build(source: Texture2D, base: Vector2i, blur: Shader) -> void:
	var size := base
	var input := source
	for i in LEVELS:
		size = Vector2i(maxi(2, size.x >> 1), maxi(2, size.y >> 1))
		input = _stage(input, size, blur, Vector2(1.0, 0.0))   # horizontal
		input = _stage(input, size, blur, Vector2(0.0, 1.0))   # vertical
		taps.append(input)

func _stage(input: Texture2D, size: Vector2i, blur: Shader,
		axis: Vector2) -> Texture2D:
	var sv := SubViewport.new()
	sv.size = size
	sv.transparent_bg = true
	sv.disable_3d = true
	sv.render_target_clear_mode = SubViewport.CLEAR_MODE_ALWAYS
	# Nothing displays a chain stage, so UPDATE_WHEN_VISIBLE never fires.
	sv.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(sv)

	var mat := ShaderMaterial.new()
	mat.shader = blur
	# The blur step is in texels of THIS level, which is what makes the
	# distance physical rather than a fraction of the frame.
	mat.set_shader_parameter(&"axel", axis * FX_SPREAD
			/ Vector2(float(size.x), float(size.y)))

	var rect := TextureRect.new()
	rect.texture = input
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_SCALE
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	rect.texture_repeat = CanvasItem.TEXTURE_REPEAT_DISABLED
	rect.material = mat
	sv.add_child(rect)

	stages.append(sv)
	return sv.get_texture()
```

`axis * FX_SPREAD / Vector2(...)` divides componentwise, so the inactive axis
stays exactly zero and the active one is `FX_SPREAD` texels — the same
quantity `fxBlur(FX.src, A, FX_SPREAD/bw, 0)` passes today
(`src/game/runtime.js:10333-10339`).

**The edge problem survives the port.** `TEXTURE_REPEAT_DISABLED` is documented
as: "The texture does not repeat. Sampling outside extents stretches edge
pixels." That is clamp-to-*edge*. Cosmo's glow bug — a blur tap past the
texture edge reads the edge texel back, reflecting light that should have left
the screen into a bright frame at the border, **measured at 1.82× the physical
level with the shipped kernel** (`rule.gfx.glow-pipeline`,
`db/notes/render/glow-chain.md`) — reproduces exactly. Godot has no
clamp-to-border sampler hint for canvas textures. Keep the guard:

```glsl
shader_type canvas_item;
render_mode unshaded;

// TEXTURE is the TextureRect's own texture — the previous stage's
// ViewportTexture. Filter and repeat come from the node (linear, disabled).
uniform vec2 axel;                  // axis * FX_SPREAD / level size, in UV

const float W0 = 0.2270270270;      // the shipped five-tap kernel
const float W1 = 0.3162162162;
const float W2 = 0.0702702703;
const float O1 = 1.3846153846;
const float O2 = 3.2307692308;

float inb(vec2 p) {
	// Zero-weight any tap outside the source. repeat_disable clamps to EDGE,
	// which reflects light back inward instead of letting it leave the frame.
	return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
}

void fragment() {
	vec2 o1 = axel * O1;
	vec2 o2 = axel * O2;
	vec2 u = UV;

	vec4  acc = texture(TEXTURE, u) * W0;
	float sum = W0;

	vec2 t = u + o1; float k = inb(t) * W1; acc += texture(TEXTURE, t) * k; sum += k;
	t = u - o1;      k = inb(t) * W1;       acc += texture(TEXTURE, t) * k; sum += k;
	t = u + o2;      k = inb(t) * W2;       acc += texture(TEXTURE, t) * k; sum += k;
	t = u - o2;      k = inb(t) * W2;       acc += texture(TEXTURE, t) * k; sum += k;

	COLOR = acc / max(sum, 0.00001);
}
```

Three notes on that kernel. The weights and offsets are copied from
`src/game/runtime.js:10114-10125` and must be — they are a five-tap
linear-sampled gaussian summing to exactly 1. The `inb()` factor is the shipped
guard, verbatim in structure. And the renormalisation by `sum` keeps *interior*
fragments unchanged while the border darkens instead of brightening: every tap
of an interior fragment is in bounds, so `sum == 1.0` and the division is
identity. The shipped version does not renormalise — it simply drops the
out-of-bounds energy, so its border reads 0.55× rather than 1.0×. Either is
correct; pick one and let the harness assert it, because "the border is dimmer
than the interior" and "the border matches the interior" are both defensible
and only one of them is what you measured.

**Cost, honestly.** Six `SubViewport`s means six render targets, six clears and
six draws per frame, plus the driver state changes between them. Cosmo's WebGL
chain does the same six blurs on one context with framebuffer switches, which
is cheaper. I have no measurement for Godot's overhead here and the docs
publish none — treat "six SubViewports at ≤1/4 area is affordable on a
mid-range phone" as **unverified**, and measure it before committing the
architecture. The `CanvasGroup` route in §6 is the fallback if it is not.

---

## 8. WorldEnvironment glow in 2D, and why Cosmo should not use it

Setup, if you do want it: a `WorldEnvironment` node with an `Environment`
whose `background_mode = BG_CANVAS` ("Displays a `CanvasLayer` in the
background") and `background_canvas_max_layer` set high enough to include the
layers you want glowed, then `glow_enabled = true`.

The documented facts that decide this, all from the `Environment` class
reference:

- **2D is SDR by default.** `glow_hdr_threshold`: "This value also needs to be
  decreased below `1.0` when using glow in 2D, as 2D rendering is performed in
  SDR." So without HDR, everything above your threshold glows — including the
  rings and the HUD.
- **`Viewport.use_hdr_2d`** gives you an `RGBA16` framebuffer: "the end result
  of the Viewport will not be clamped to the `0-1` range … This allows 2D
  rendering to take advantage of effects requiring high dynamic range (e.g. 2D
  glow)". The 4.7 class reference carries **no renderer restriction** on it.
  Older tutorial prose and several third-party pages still say Forward+/Mobile
  only; a docs issue about that was closed after the Compatibility path was
  enabled. Treat "HDR 2D works on Compatibility" as **plausible but test it on
  your actual web build** — this is the one claim in this document I would not
  ship a design decision on without a screenshot.
- **Compatibility's glow is a different, simpler implementation.** These have
  *no effect*: `glow_levels/1` through `glow_levels/7`, `glow_normalized`,
  `glow_strength`, `glow_blend_mode` (always Screen), `glow_mix`, `glow_map`,
  `glow_map_strength`. What is left is `glow_intensity`, `glow_bloom`, and the
  HDR threshold/scale/cap.
- **Mobile renderer** "only supports a lower dynamic range up to `2.0`" —
  `glow_intensity` should be raised to about 1.5 and `glow_hdr_threshold`
  lowered to about 0.9.

Even if all of that were free, **it is the wrong shape for this game.**
Cosmo's bright pass is *semantic*: `drawBloom` walks the game's own object
lists and draws a disc per light, so it "can never pick up the rings, the calm
pool or the HUD, which a luminance threshold over the composited frame would"
(`db/notes/render/glow-chain.md`). `Environment.glow` is exactly a luminance
threshold over the composited frame. Adopting it would silently reverse a
decision that was made by measurement, and the symptom — a hazy HUD and glowing
orbital rails — would read as a taste problem rather than an architecture one.

The Godot-idiomatic way to keep the semantic pass is **a second
`SubViewport` that contains only the lights**: proxy quads or a
`MultiMeshInstance2D` mirroring the same object lists, additive, at
`ceil(W/4) × ceil(H/4)`. That viewport's texture is the input to §7's chain.
`canvas_cull_mask` on the viewport, or simply a separate node tree, keeps the
gameplay sprites out of it.

Where `Environment.glow` *is* right: a title screen, a menu, or any scene where
"everything bright blooms" is the intent. Cosmo's front end could use it. The
arena cannot.

---

## 9. Blend modes and additive drawing

Two places set blending, and they do different things:

- **`CanvasItemMaterial.blend_mode`** — `BLEND_MODE_MIX` (0), `BLEND_MODE_ADD`
  (1), `BLEND_MODE_SUB` (2), `BLEND_MODE_MUL` (3), `BLEND_MODE_PREMULT_ALPHA`
  (4). No shader needed.
- **`render_mode blend_add`** in a `ShaderMaterial` — the same blend, on a node
  that also has a shader.

You cannot have both: a node has one material. If you need additive *and* a
custom fragment function, it is a `ShaderMaterial` with `render_mode unshaded,
blend_add;`.

The 2D lighting docs make a performance claim worth carrying: "Additive sprites
are much faster to render, since they don't need to go through a separate
rendering pipeline." Cosmo is an additive game — comet corona, halo composite,
impact ejecta, ring highlights — so this is mostly free advantage.

`BLEND_MODE_PREMULT_ALPHA` pairs with the importer's **Premultiply Alpha**
option (§11). Premultiplied art is the correct choice for glow-ish sprites with
soft edges, because it removes the dark fringe that straight alpha produces
under bilinear filtering. It is the one case where you must change both the
import setting and the material, and changing only one produces a subtle
wrongness that is hard to name.

---

## 10. Compute shaders and `RenderingDevice`: not for this game

The short answer is no, and the reasons are documented
([Using compute shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/compute_shaders.html)):

- Only Forward+ and Mobile support compute shaders. **Not Compatibility, so not
  web.**
- "Compute shader support is generally poor on mobile devices (due to driver
  bugs), even if they are technically supported."
- `RenderingServer.create_local_rendering_device()` gives you a device you
  drive yourself; "Local RenderingDevices cannot be debugged using tools such
  as RenderDoc", and you must `free_rid()` every buffer, pipeline and uniform
  set by hand.
- `sync()` blocks the CPU on the GPU. The tutorial advises waiting "at least 2
  or 3 frames before synchronizing".
- "Long computations can cause Windows graphics drivers to 'crash' due to TDR
  being triggered by Windows."

Nothing Cosmo does is compute-shaped. The blur is separable and fits a fragment
shader; the bright pass is a few hundred quads; the sky is one full-screen
pass. Reaching for `RenderingDevice` here buys a debugging hole, a platform
split and a mobile driver lottery in exchange for nothing.

`CompositorEffect` (the supported way to inject a custom pass into the main
pipeline) is likewise Forward+/Mobile only. Same verdict, same reason.

---

## 11. Texture import and filtering

From [Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html):

- **Compress → Mode: Lossless.** "This is the default and most common
  compression mode for 2D assets. It shows assets without any kind of
  artifacting, and disk compression is decent." VRAM Compressed "should be
  avoided for 2D as it exhibits noticeable artifacts, especially for
  lower-resolution textures."
- **Mipmaps: off by default in 2D.** "in 2D, this should only be enabled if
  your project visibly benefits from having mipmaps enabled. If the camera
  never zooms out significantly, there won't be a benefit to enabling mipmaps
  but memory usage will increase."
- **Fix Alpha Border: leave on.** It mitigates the dark outline bilinear
  filtering produces at alpha edges.
- **Premultiply Alpha** requires a `CanvasItemMaterial` in Premul Alpha blend
  mode. Both or neither.
- **Filter and Repeat are no longer import settings.** They live on
  `CanvasItem.texture_filter` / `texture_repeat`, on
  `Viewport.canvas_item_default_texture_filter`, and on the project setting
  that seeds the viewport default. `TEXTURE_FILTER_PARENT_NODE` (0) is the
  default and inherits.

The `CanvasItem.TextureFilter` values you will actually use:
`TEXTURE_FILTER_NEAREST` (1), `TEXTURE_FILTER_LINEAR` (2),
`TEXTURE_FILTER_NEAREST_WITH_MIPMAPS` (3), `TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`
(4), plus the two anisotropic variants (5, 6) which are a 3D concern.

**Cosmo specifics.** The shipped pack is 24 sprites, 787,290 bytes; the ten
opaque world plates were deleted from the release because "opaque scenery must
not replace the living procedural system" (`db/notes/render/art-assets.md`).
What is left is drawn at 40–56 `u`, near 1:1, and never zooms out. So:
Lossless, mipmaps off, `TEXTURE_FILTER_LINEAR` set once on the viewport rather
than per node — with the single exception of any texture you intend to sample
with `textureLod`, which needs `_WITH_MIPMAPS` and the matching
`filter_*_mipmap` hint in the shader.

The three sky material maps (`fx-plasma-wisp` 512×512, `drift-planet` and
`drift-ring` 1024×1024) are the one place mipmaps could earn their keep, since
the shader samples them at varying rates across the frame — `uRingMap` is read
through an atlas coordinate scaled by `1/(uPlanet.z*4.85)`. That is a genuine
minification, so `filter_linear_mipmap` on those three samplers is worth
measuring. Everything else: off.

One warning from the built-in functions reference that applies to any shader
that wants its own resolution: **`textureSize()` "should be avoided as it
always performs a full texture read. When possible, you should pass the texture
size as a uniform instead."** For screen resolution, `SCREEN_PIXEL_SIZE` is
free; for a sampled texture, `TEXTURE_PIXEL_SIZE` is free; use a uniform for
anything else.

---

## 12. Stutter, warm-up, and what Compatibility cannot do

[Reducing stutter from shader (pipeline) compilations](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html):

- Pipeline compilation stutter is a first-encounter cost. A shader can expand
  to "dozens of pipelines or more".
- **Ubershaders and pipeline pre-compilation are Forward+/Mobile only.** The
  Compatibility renderer — OpenGL 3.3, GLES 3.0, WebGL 2 — "lacks necessary
  functionality and cannot use ubershaders or pipeline precompilation".
- **Shader Baker (Godot 4.5+)** is an export-preset option that bundles
  compiled shader code. Also not Compatibility.
- The one technique that works everywhere: draw everything once during loading.
  Render feature scenes off-screen with a `ColorRect` or a `SubViewport`
  positioned outside the window, or attach hidden instances of every effect as
  children so they get compiled before they are needed.

For Cosmo on Compatibility this is not optional — it is the only lever. The
warm-up scene should instantiate one of each: the sky material at each of the
eight `WORLDS` parameter sets (one material, so one pipeline), the blur shader,
the composite shader, an additive sprite, a `CanvasGroup`. Godot's boot already
has a natural place for it — the equivalent of `BootScene`, which today waits
on the art manifest before starting the game.

Also renderer-gated: `dFdxCoarse`, `dFdxFine`, `dFdyCoarse`, `dFdyFine`,
`fwidthCoarse` and `fwidthFine` are "Not available when using the Compatibility
renderer". Plain `dFdx`, `dFdy` and `fwidth` are.

---

## Pitfalls

**Godot 3 idiom that will be in every search result you find.**

| Godot 3 | Godot 4 |
|---|---|
| `SCREEN_TEXTURE` built-in | removed — `uniform sampler2D t : hint_screen_texture` |
| `DEPTH_TEXTURE` built-in | `hint_depth_texture` (3D only) |
| `hint_color` / `hint_albedo` | `source_color` |
| `texture2D(tex, uv)` | `texture(tex, uv)` |
| `Viewport` node used as a render target | `SubViewport` (plain `Viewport` is now abstract) |
| `Tween` node for animating shader params | `create_tween()` |
| `yield(...)` | `await` |
| `connect("sig", self, "_on")` | `sig.connect(_on)` |
| `export var x` | `@export var x` |
| `setget` | `set`/`get` blocks on the property |
| 3.x glow "levels" as booleans | floats, `glow_levels/1` … `glow_levels/7` |

**Things that go wrong specifically.**

- **A `SubViewport` in a chain never renders.** Default
  `render_target_update_mode` is `UPDATE_WHEN_VISIBLE`, and nothing displays a
  chain stage. Set `UPDATE_ALWAYS`.
- **`textureLod` with LOD > 0 returns the base level.** The filter hint has to
  contain `mipmap`. Silently produces a sharp "blur".
- **`MultiMesh` colours vanish.** `use_colors` / `use_custom_data` /
  `transform_format` must be set *before* `instance_count`.
- **Instance uniforms fail to compile on 4.3.** They are 3D-only until 4.4.
- **A ported shader looks washed out.** A colour uniform without
  `source_color`, or a `vec3` you built in sRGB feeding a linear pipeline once
  HDR 2D is on.
- **The glow has a bright frame at the screen edge.** `repeat_disable` clamps
  to edge, which reflects light inward. Zero-weight out-of-bounds taps.
- **`set_shader_parameter("name", v)` in `_process`.** Use a `StringName`
  const.
- **`CanvasGroup` children with `clip_children`.** Documented as not working;
  both use the back buffer.
- **Two overlapping screen-reading materials.** They both read the same
  pre-copy back buffer. Insert a `BackBufferCopy`.
- **`glow_strength` does nothing and you cannot see why.** You are on
  Compatibility, where seven glow properties are inert.
- **`int` where a `float` is expected.** No implicit conversion. `1` is not
  `1.0`.
- **`TIME` drifts or judders after an hour.** Rollover at 3600s by default; and
  it is not the clock a game with slow motion and reduced motion wants anyway.

**The one that has no clean answer.** Cosmo's WebGL path handles context loss
explicitly: both GPU users install `webglcontextlost`/`webglcontextrestored`
with `preventDefault()`, and the backdrop hands off to a CPU sky while the glow
hands off to two disc passes per light (`src/game/runtime.js:10023-10031`,
`10369-10379`). I could find no equivalent in Godot's
class reference — no GDScript-visible signal or recovery API for a lost
context, and the web build's own failure text is "WebGL context lost, please
reload the page". **This is a genuine regression and I could not verify a
workaround.** If offline resilience on mobile web matters, budget for
investigating it rather than assuming Godot handles it.

---

## In Cosmo

### The sky — `GL_FS` at `src/game/runtime.js:9460-9673`

One `canvas_item` shader on a full-rect `ColorRect` in a `CanvasLayer` at
`layer = -100`. The composition — domain-warped 5-octave `cloud()`, the
Cassini-gapped `belt()` drawn twice around the globe, atmosphere-before-surface,
three hashed star layers masked by `(1 - planetMask)`, the calm band, the black
hole's radial magnification, the `1 - exp(-col*1.35)` tone map and its dither —
ports essentially unchanged. Concrete changes:

- `uRes` disappears: `vec2 res = 1.0 / SCREEN_PIXEL_SIZE;`.
- `uTime` becomes a driven uniform, **not `TIME`**, because `GL.tw` integrates
  the dilated delta at `GL_MOTION = 1.0` times the world's own `motion`
  (0.48–0.80) and must freeze under reduced motion. `GL.stream` is a second
  integrator carrying travel direction and needs its own uniform.
- The shader now takes **23 uniforms**, three of them `sampler2D`
  (`src/game/runtime.js:9697`). Group the scalars: `uArc`, `uShape`, `uPlanet`,
  `uSurface`, `uCurrent` and `uPowerFlow` are already `vec4`s, which is the
  right packing for Godot too — a uniform block change costs the same whether
  it carries one float or four.
- `uCalm` becomes `global uniform float sky_arena_calm` so `SKY_ARENA_CALM =
  0.62` has one home. `CLAUDE.md` names it as one of two renderer controls;
  a global uniform is the Godot construct that matches that status.
- `skyMix()` stays on the CPU. It lerps the *weights* of two `WORLDS` rows so
  the shader never branches on a world and never evaluates two
  (`src/game/runtime.js:9729-9750`). That is already the right design for a
  GPU; do not turn it into a crossfade of two shader passes.
- The `cloud`/`hash21`/`noise2` trio goes in a `.gdshaderinc`, shared with
  `drawCalmSky`'s successor and anything else that needs the same field. Today
  those two implementations are hand-mirrored across JavaScript and GLSL and
  `rendercheck.mjs` asserts they agree within 16%; an include makes half of
  that divergence impossible.

`GL_SCALE` is 1.0 with no downgrade ladder and `fxcheck.mjs` actively fails the
build if an adaptive dial reappears (`tune.gl-scale`). In Godot the equivalent
temptation is `Viewport.scaling_3d_scale` (3D only, irrelevant) or rendering
the sky into a half-size `SubViewport`. Same answer: don't.

### The art materials — `SKY_MATERIALS`, `9941-9968`

This is the part of the render path that changed most recently and the part a
stale record will get wrong. There is no painted-plate sky any more. The ten
world plates were removed from the release; three sprites that used to be
orphaned bytes — `fx-plasma-wisp`, `drift-planet`, `drift-ring` — are now
uploaded as WebGL textures and sampled *inside* `GL_FS` as `uNebulaMap`,
`uPlanetMap` and `uRingMap`. They are additive material detail over the
procedural fields, not a replacement for them: the nebula map adds two eddying
light samples edge-weighted to stay outside the play annulus, the planet map
mixes a mineral body into the globe at `paint.a*(0.30+0.12*(1-uSurface.y))`,
and the ring map tints the belt's lanes at `paint.a*0.42`.

`glBindSkyMaterials` binds a 1×1 blank texture when a key is missing and
reports readiness as `uArt = (nebulaReady, planetReady, ringReady)`, with each
branch guarded on `uArt.* > 0.5`. In Godot most of that plumbing disappears:

```glsl
uniform sampler2D nebula_map : source_color, hint_default_black, filter_linear, repeat_disable;
uniform sampler2D planet_map : source_color, hint_default_black, filter_linear, repeat_disable;
uniform sampler2D ring_map   : source_color, hint_default_black, filter_linear, repeat_disable;
uniform vec3 art_ready = vec3(0.0);
```

`hint_default_black` gives an unassigned sampler defined content, so the blank
1×1 texture and the null checks around it are unnecessary — a missing map
samples to zero and contributes nothing. **Keep `art_ready` anyway.** The
default only makes the *result* correct; the branch is what makes it free, and
on a Compatibility/WebGL 2 target a skipped texture fetch is worth more than a
tidier shader. Assign the textures once at load with
`material.set_shader_parameter(&"nebula_map", tex)` — `Texture2D` values are
legal shader parameters — and set `art_ready` in the same pass.

The upload dance (`createTexture`, `UNPACK_FLIP_Y_WEBGL`, `texImage2D`, four
`texParameteri` calls, cache-by-image-identity, delete on teardown) has no
Godot equivalent and should not be recreated. Godot owns texture lifetime; the
importer owns filter and wrap for the *resource*, and the sampler hints
override them for the shader.

One thing to carry across deliberately: those three textures are bound with
`CLAMP_TO_EDGE` and `LINEAR`. `repeat_disable` plus `filter_linear` is the
matching hint pair. If you leave the hints off, the sampler inherits the
`CanvasItem`'s `texture_repeat`, which defaults to `TEXTURE_REPEAT_PARENT_NODE`
and can therefore change under you when somebody reparents the sky.

### The glow — `drawBloom` at `9156-9282`, the FX chain at `10084-10379`

The proposal, in nodes:

```
SkyLayer            CanvasLayer, layer -100   ColorRect + sky.gdshader
WorldLayer          Node2D                    gameplay
LightsViewport      SubViewport               W/4 x H/4, transparent, additive
                                              light proxies mirroring the object lists
BlurChain           6 SubViewports            /8 /8 /16 /16 /32 /32, five-tap separable
GlowComposite       CanvasLayer               ColorRect, blend_add, samples mid + wide
HudLayer            CanvasLayer               above the composite, never glowed
```

- `LightsViewport` is `bloomC`. It must stay **semantic** — it draws lights,
  not a threshold of the frame. `MultiMeshInstance2D` with `use_custom_data`
  suits it: one draw call, `INSTANCE_CUSTOM.x` carrying the radius and `COLOR`
  the tint, sourced from the same lists `drawBloom` walks
  (`src/game/runtime.js:9180-9240`).
- The `/4 → /8 → /16` ladder is not decoration and must survive: a single 4:1
  read from a source only smooth to σ≈2 undersamples, and the halo shimmers as
  lights orbit across the sampling grid.
- `FX_A = 0.55`, `FX_MIDW = 0.62`, `FX_WIDEW = 0.85`, `FX_SPREAD = 1.15`,
  `FX_AB = 0.0045` are `tuning` values (`tune.fx`) and carry across as shader
  uniforms verbatim. `FX_A` is deliberately mutable at runtime so it can be
  re-weighted against real eyes on a real screen — keep that: an `@export`
  float on the composite node does the same job.
- The radial chromatic aberration is `uAb = FX_AB*(0.30+0.70*energy)*(1+BH.warp)`,
  zero at the arena centre by construction so the fringe never touches the
  orbits a player is reading. Straight port.
- The black hole lens in `FX_COMP` bends the glow field inward by **inverse
  sampling**, and the sign has been wrong three times in this file's history.
  Whatever the Godot version looks like, port the `fxcheck.mjs` bisection with
  it: parse `fall`, `pull` and the sign out of the shader text and assert that
  a light at 0.10/0.15/0.20/0.30 of screen height moves *inward*.
- The disc fallback (`HALO_*`, two extra discs per light at 1/12 and 1/32) has
  no Godot analogue worth keeping, because there is no context-loss event to
  fall back *from*. If the chain is too expensive, the fallback is the
  `CanvasGroup` + `textureLod` composite from §6, chosen once at startup from a
  quality setting rather than mid-run.

### The baked sprites — `buildSprites` at `372-604`, `artifactSprite` at `8868-8928`

This whole subsystem largely goes away, and that is the biggest single
simplification the engine change buys.

- `buildSprites` bakes eighteen canvases on every resize because `shadowBlur`
  and radial gradients are expensive per frame in Canvas 2D. **Eleven of them
  are never drawn** — re-counted at `01a3a25`, where each of `shard`,
  `shardDrift`, `shardBlink`, `shieldRing`, `powShield`, `powWarpO`,
  `powWarpI`, `powNova`, `shock`, `mote` and `pip` appears exactly once in the
  file, at its own definition. (The membership has shifted since
  `db/notes/render/baked-sprites.md` was written — `SPR.shock` went dead,
  `SPR.powHyper` came alive — but the count has not.) They are pure waste on
  every orientation and DPR change.
- In Godot the same shapes are a `canvas_item` shader evaluated at native
  resolution, or a `GradientTexture2D` with a radial fill for the three-stop
  glows. Neither is re-baked on resize; the `u` scale unit becomes
  `Sprite2D.scale` or a uniform.
- `artifactBank`'s procedural material system — five face colours, an edge, a
  dark, an RGB glow triple, then `artifactFacet` lighting each triangular face
  from a hub at `(-1.6,-2.2)` — is a per-kind uniform set. Thirteen kinds, one
  shader, `instance uniform` for the per-object tint. That is under the 16-slot
  limit with room to spare.
- `rimLight` rotates a baked arc by `atan2(y-cy, x-cx)` — the *screen*
  direction out from the hub, not the ring angle, which differ by up to eleven
  degrees at the diagonals when `AY > 1`. Whatever replaces it must keep the
  screen-direction form; the ring-angle version is the plausible-looking wrong
  one.

### The renderer decision, stated

**Compatibility, everywhere, as the single visual target.** Web forces it;
matching it on mobile means one set of render-check thresholds, one glow
implementation and one screenshot per world instead of two. The costs are
real and all of them are things Cosmo does not use: compute shaders,
`CompositorEffect`, the flexible half of `Environment.glow`, and shader
pre-compilation (which costs a warm-up scene, not a feature).

The one thing to test before committing: `Viewport.use_hdr_2d` on the actual
web build. If it works there, the glow composite can run unclamped and the
tuned weights transfer more directly. If it does not, the chain still works —
it just clips at 1.0 the way the Canvas version already does.

### The invariants this touches

- `rule.gfx.sky-controls-readability` — `SKY_ARENA_CALM = 0.62`, `GL_MOTION =
  1.0`, `GL_SCALE = 1.0`, and nothing may obscure a hazard in the arena
  annulus. All three survive as uniforms/constants. `check.mjs` fails any
  document under `docs/` naming the first two without its current value in the
  same paragraph; it does not walk `db/`, so nothing enforces that here — this
  document states the current values because being wrong is worse than being
  unchecked, and because `GL_MOTION` moved from 0.25 to 1.0 recently enough
  that a stale copy is the likely failure.
- `rule.gfx.one-composed-world` — planet, atmosphere/rings, nebula and stable
  stars are one scene, with a coherent fallback when art is absent.
- `rule.gfx.glow-pipeline` — correct sizes, physical-pixel blur distances,
  normalized kernels, edges that fade rather than clamp. The last clause is the
  one Godot does not give you for free.
- `rule.gfx.bounded-event-envelopes` — one authored scene event at a time, by
  rank, expiring on its own. This is CPU state feeding a `vec4` uniform
  (`uAccent = (strength, id, star, 0)`) and is unaffected by the engine change.

---

## Sources

Godot documentation, stable (4.7) unless noted:

- Renderers — https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html
- Shading language — https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html
- CanvasItem shaders — https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html
- Built-in shader functions — https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_functions.html
- Shader preprocessor — https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_preprocessor.html
- Screen-reading shaders — https://docs.godotengine.org/en/stable/tutorials/shaders/screen-reading_shaders.html
- Using compute shaders — https://docs.godotengine.org/en/stable/tutorials/shaders/compute_shaders.html
- Reducing stutter from shader (pipeline) compilations — https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html
- Importing images — https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html
- 2D lights and shadows — https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html
- `CanvasGroup` — https://docs.godotengine.org/en/stable/classes/class_canvasgroup.html
- `CanvasItem` — https://docs.godotengine.org/en/stable/classes/class_canvasitem.html
- `CanvasItemMaterial` — https://docs.godotengine.org/en/stable/classes/class_canvasitemmaterial.html
- `BackBufferCopy` — https://docs.godotengine.org/en/stable/classes/class_backbuffercopy.html
- `SubViewport` — https://docs.godotengine.org/en/stable/classes/class_subviewport.html
- `Viewport` — https://docs.godotengine.org/en/stable/classes/class_viewport.html
- `Environment` — https://docs.godotengine.org/en/stable/classes/class_environment.html
- `MultiMesh` — https://docs.godotengine.org/en/stable/classes/class_multimesh.html
- `MultiMeshInstance2D` — https://docs.godotengine.org/en/stable/classes/class_multimeshinstance2d.html
- `ShaderMaterial` — https://docs.godotengine.org/en/stable/classes/class_shadermaterial.html

Version establishment and gating:

- Godot 4.7.2 download (current stable, 18 August 2026) — https://godotengine.org/download/windows/
- Godot 4.7 release notes — https://godotengine.org/releases/4.7/
- Maintenance release: Godot 4.7.2 — https://godotengine.org/article/maintenance-release-godot-4-7-2/
- 2D instance uniforms, merged for 4.4 — https://github.com/godotengine/godot/pull/99230
- 4.3 shading language (per-instance uniforms 3D-only) — https://docs.godotengine.org/en/4.3/tutorials/shaders/shader_reference/shading_language.html
- Shader time rollover setting — https://github.com/godotengine/godot/pull/95381
- `use_hdr_2d` on Compatibility, docs issue (closed) — https://github.com/godotengine/godot-docs/issues/10896

Cosmo's current implementation, for the comparisons above:

- `db/notes/render/pipeline.md`, `sky-paths.md`, `glow-chain.md`,
  `baked-sprites.md`, `art-assets.md`, `impact-envelopes.md`
- `db/notes/design/render-decisions.md`
- `src/game/runtime.js:9156-9282` (bloom), `:9457-9673` (sky shader),
  `:9674-10006` (sky bring-up and render), `:10084-10379` (glow chain),
  `:372-604` (sprite bake), `:8868-8928` (artifact bank), all at `01a3a25`
