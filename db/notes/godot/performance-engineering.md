# Performance engineering: holding 60 fps on a mid-range phone

> How to make a portrait 2D arcade with a shader sky, a glow chain and a few
> hundred moving lights run at 60 fps on cheap Android hardware in Godot —
> which techniques actually move the needle, which are cargo cult, and how to
> tell the difference. Written against **Godot 4.7.2** (stable, 18 Aug 2026;
> `version.py` on the `4.7-stable` tag reads `major = 4, minor = 7`).

Everything named here was checked against the 4.7 class reference or the 4.7
engine source. Where a technique exists only in a later 4.x than 4.0, the
section says so. Where I could not verify a performance claim, it is marked
**unverified** rather than asserted.

---

## The short version

For Cosmo specifically, in the order the wins actually arrive:

1. **Do not build the world out of `Node2D`s.** Every gameplay object — shards,
   stars, orbs, the comet, its fins, the tail — is a `RenderingServer` canvas
   item created once, with its primitives added once, and only its
   `Transform2D` and modulate written per frame. This is the single biggest
   structural decision and it is nearly invisible in tutorials.
2. **The starfield is one `MultiMesh`**, uploaded whole with
   `RenderingServer.multimesh_set_buffer()` from a `PackedFloat32Array` that is
   allocated once. Never call `multimesh_instance_set_transform_2d()` on a
   multimesh you also `set_buffer()` — that path does a synchronous GPU
   readback (source-verified below).
3. **One atlas for every gameplay sprite.** A texture change breaks the 2D
   batch; so does a material change, a clip change, and any polygon or mesh
   command. Verified from the 4.7 canvas renderers, both of them.
4. **Static typing everywhere, and turn the unsafe-access warnings into
   errors.** The documented win is specialised opcodes, not a JIT — treat it as
   a constant-factor improvement in hot loops, not a magic multiplier.
5. **Preallocate. Write by index. Never allocate in the frame.** Packed arrays
   for the shard/star tables, struct-of-arrays rather than array-of-objects.
6. **Do not use `PhysicsServer2D` or any physics node.** Cosmo's collision is
   an angular-distance test against a ring radius. A broadphase would be pure
   overhead. This is the "when pooling and servers are premature" answer:
   sometimes the whole subsystem is premature.
7. **Pick the renderer deliberately and early.** Compatibility is the cheapest
   and the docs recommend it for 2D, but it has no HDR 2D viewport and a
   simplified glow. That is a *look* decision, not just a perf decision.
8. **Measure the frame interval, not the vibe.** `Performance` monitors,
   `Time.get_ticks_usec()` around suspects, and
   `viewport_get_render_info(..., VIEWPORT_RENDER_INFO_TYPE_CANVAS, ...)` for
   2D draw calls — because the global draw-call counter only counts 3D.
9. **Thermals: Godot gives you nothing.** There is no thermal or battery API in
   4.7. Build a frame-time governor with hysteresis and step a quality ladder.

---

## What Cosmo actually draws, per frame

Grounding numbers, from the knowledge database, so the budget below is real
rather than hypothetical:

| Thing | Count | Record |
|---|---|---|
| Background stars, three tiers, 15 with halos | 173 | `tune.starfield` |
| Extra twinkling `bgStars` built in `resize()` | 22 | `tune.starfield` |
| Simultaneous shards (hazards), by difficulty ladder | 1 → 15 | `tune.shard-cap` |
| Placed impact events | ≤ 7 | `code.arena-decor` |
| Popups | ≤ 4 | `code.fx-primitives` |
| Bloom bright-buffer discs | one per light: every star, armed shard, orb, particle, the comet, the hub lamp | `code.bloom` |
| Glow chain render targets | 6, at 3 scales, 8 draws | `code.fx-chain` |
| Sky | one full-screen triangle, procedural planet + atmosphere + occluded rings + dust | `code.gl-sky` |

That is a few hundred textured quads, one full-screen fragment-heavy shader,
and a multi-pass downsample/blur/composite chain, at device DPR (capped at 2 —
`code.boundary.resize`), in portrait, on a phone. Every section below is
written against that budget.

---

## 1. The frame loop: `_process`, `_physics_process`, and an accumulator

### What the deltas actually mean

- `_process(delta)` runs once per **rendered** frame. `delta` is real elapsed
  time, but it is clamped: the class reference states delta "is capped at a
  maximum of `Engine.time_scale` * `Engine.max_physics_steps_per_frame` /
  `Engine.physics_ticks_per_second`". At the defaults (1.0 × 8 / 60) that is
  **133 ms**. Cosmo currently clamps at 50 ms in `runtimeStep`; keep your own
  tighter clamp, do not rely on the engine's.
- `_physics_process(delta)` runs on a fixed tick. `delta` is *logical*:
  `Engine.time_scale / Engine.physics_ticks_per_second`, exactly, always.
- Neither is a wall clock. The reference is explicit: "avoid using `delta` for
  time measurements in real-world seconds. Use the `Time` singleton's methods
  for this purpose instead, such as `Time.get_ticks_usec()`."

That last line is a load-bearing rule for Cosmo. `rule.sim.pause-wall-clock`
exists because a locked phone produces no frames at all and a ten-minute pause
must not be recorded as one clamped delta. In Godot that becomes
`Time.get_ticks_usec()`, not `delta`.

### The three-way choice

**`_physics_process` for everything.** This is what the physics-interpolation
guide tells you to do, and it is right *for a physics game*: "you should be
moving and performing game logic on your objects within `_physics_process`
… Setting the transform of objects only within physics ticks allows the
automatic interpolation to deal with transforms *between* physics ticks."
Combined with `physics/common/physics_interpolation` you get smooth motion at
any tick rate, and the CPU optimisation guide notes interpolation is "orders of
magnitude faster" than running more physics ticks.

Two costs. First, the jitter guide states plainly: "Enabling physics
interpolation will increase input lag for behavior that depends on the physics
tick … consider this carefully for games that operate on a fixed framerate
(like fighting or **rhythm** games)." Cosmo *is* a rhythm game: a tap has to
land on a beat, and the drop has to land on the beat the player earned. Second,
interpolation buys you smoothness for transforms that Godot owns. Cosmo's
objects do not have owned transforms in that sense — every position is a pure
function `posAt(ring, angle)` of the arena projection
(`code.arena-projection`). Recomputing it at the render frame is exact and
costs a `sin`/`cos`; interpolating it is an approximation that can drift off
the ellipse. `rule.gfx.shared-geometry` says the sky, the arena and the
gameplay layer must agree on ring radii — an interpolator is a second source
of position and therefore a second thing that can disagree.

**`_process` with raw `delta`.** What Cosmo does today, and it works. The risk
is variable-step integration: on a hitching device the sim sees a 40 ms step,
and a swept collision written for 16 ms steps can tunnel. Cosmo already solved
this with `sweptHit` (`code.player-geometry`: "sweptHit is why nothing tunnels
through a shard on a big screen or after a dropped frame"). Carry that
solution over and raw `_process` is defensible.

**A manual accumulator in `_process`.** Fixed sim steps, presentation every
frame, no engine interpolation, no input-lag tax, and the one clock that
matters (audio) untouched. This is the recommendation for Cosmo.

```gdscript
extends Node2D
## Fixed-step simulation driven from the render frame. Deadlines advance only
## in whole steps; presentation advances every frame on the dilated clock.

const SIM_HZ: float = 120.0
const SIM_STEP: float = 1.0 / SIM_HZ
const MAX_CATCHUP: int = 4          # ~33 ms of backlog, then drop it

var sim_t: float = 0.0              # every gameplay deadline reads this
var view_t: float = 0.0             # camera dolly, sky drift, particles
var time_scale: float = 1.0         # slow-mo / black hole dilation

var _accum: float = 0.0

func _process(delta: float) -> void:
	# Our own clamp, tighter than the engine's ~133 ms.
	var dt: float = minf(delta, 0.05)

	_accum += dt
	var steps: int = 0
	while _accum >= SIM_STEP and steps < MAX_CATCHUP:
		_sim_step(SIM_STEP)
		sim_t += SIM_STEP
		_accum -= SIM_STEP
		steps += 1
	if steps == MAX_CATCHUP:
		_accum = 0.0                # drop the backlog; never spiral

	view_t += dt * time_scale
	_present(_accum / SIM_STEP)     # alpha in [0, 1) if you interpolate

func _sim_step(step: float) -> void:
	pass

func _present(alpha: float) -> void:
	pass
```

`minf()` is the float-typed global; `mini()`/`maxi()`/`clampi()` are the int
ones. Using them instead of `min()`/`max()` keeps the expression statically
typed instead of Variant.

### Pause is a stopped clock, not a state

Cosmo's pause works because `update()` returns *before* `G.t += dt`, which
freezes every deadline in the file at once (`db/notes/code/clocks.md`). The
Godot translation is the same shape — return before `sim_t` advances — and
explicitly **not** `get_tree().paused = true` plus `process_mode`, which stops
`_process` entirely and takes your presentation clock and your audio scheduler
with it.

For the *duration* of a pause, use the wall clock:

```gdscript
var _paused_at_usec: int = 0

func pause() -> void:
	_paused_at_usec = Time.get_ticks_usec()

func resume() -> float:
	var held_s: float = float(Time.get_ticks_usec() - _paused_at_usec) / 1000000.0
	_paused_at_usec = 0
	return held_s
```

### Cheap frame-rate governor

`Engine.max_fps` caps the render rate; the reference says limiting FPS "can be
useful to reduce the host machine's power consumption, which reduces heat,
noise emissions, and improves battery life." Note the precedence rule: if
`display/window/vsync/vsync_mode` is **Enabled** or **Adaptive**, vsync wins
and `max_fps` cannot exceed the refresh rate — it can still go below it. On a
120 Hz phone, `Engine.max_fps = 60` with vsync on is the correct default for a
60 fps game: it renders half as many frames as letting the game track the panel
rate, and half the frames is half the sky shader.

---

## 2. The servers layer: drawing without nodes

This is the technique the brief calls under-documented, and it is. The official
page is one page, its GDScript sample for `PhysicsServer2D` still carries a
Godot 3 signature (see Pitfalls), and almost nothing written for Godot 4
explains the actual reason the technique is fast.

### Why it is fast, precisely

Three separate costs disappear:

1. **Per-node engine housekeeping.** The CPU optimisation guide: "every node
   has a cost. Built-in functions such as `_process()` and `_physics_process()`
   propagate through the tree … Each node is handled individually in the Godot
   renderer. Therefore, a smaller number of nodes with more in each can lead to
   better performance."
2. **The GDScript ↔ node property round-trip.** Setting `sprite.position`
   crosses the script/engine boundary through a property setter and dirties the
   node's transform, which propagates to children.
3. **Command rebuilding.** This is the subtle one. The servers page states:
   "The Canvas Item API in the server allows you to add draw primitives to it.
   Once added, they can't be modified. The Item needs to be cleared and the
   primitives re-added. **This is not the case for setting the transform, which
   can be done as many times as desired.**"

That last sentence is the whole design. Add the texture rect *once*, at
creation. Per frame, write only `canvas_item_set_transform()`,
`canvas_item_set_self_modulate()` and `canvas_item_set_visible()`. A `Sprite2D`
node effectively re-issues its command list every time it is dirtied; a canvas
item you own does not.

### The pool

```gdscript
class_name ShardLayer
extends Node2D
## One RenderingServer canvas item per shard slot, created once. Per frame we
## write a transform and a colour; the texture rect is never re-added.

const CAPACITY: int = 24            # tune.shard-cap tops out at 15; headroom for the black hole

## Keep the reference alive. RIDs are NOT counted for reference counting:
## if this Texture2D is freed, the RID dies with it and the layer draws nothing.
@export var atlas: Texture2D
@export var region: Rect2 = Rect2(0, 0, 64, 64)

var _items: Array[RID] = []
var _live: int = 0

func _ready() -> void:
	var parent: RID = get_canvas_item()
	var tex: RID = atlas.get_rid()
	var quad := Rect2(Vector2(-32.0, -32.0), Vector2(64.0, 64.0))
	_items.resize(CAPACITY)
	for i in CAPACITY:
		var ci: RID = RenderingServer.canvas_item_create()
		RenderingServer.canvas_item_set_parent(ci, parent)
		RenderingServer.canvas_item_add_texture_rect_region(ci, quad, tex, region)
		RenderingServer.canvas_item_set_visible(ci, false)
		# Without this the item interpolates in from the origin on its first frame.
		RenderingServer.canvas_item_reset_physics_interpolation(ci)
		_items[i] = ci

func write(i: int, xf: Transform2D, tint: Color) -> void:
	RenderingServer.canvas_item_set_transform(_items[i], xf)
	RenderingServer.canvas_item_set_self_modulate(_items[i], tint)

func set_live_count(n: int) -> void:
	for i in range(_live, n):
		RenderingServer.canvas_item_set_visible(_items[i], true)
	for i in range(n, _live):
		RenderingServer.canvas_item_set_visible(_items[i], false)
	_live = n

func _exit_tree() -> void:
	# Memory management does not happen automatically when using servers directly.
	for ci: RID in _items:
		RenderingServer.free_rid(ci)
	_items.clear()
	_live = 0
```

Notes on that code, each one a thing that costs a day if you get it wrong:

- **`atlas.get_rid()`, not `atlas`.** The official sample passes the
  `Texture2D` directly and relies on an implicit conversion. `get_rid()` is
  explicit, documented on `Resource` ("Many resources … are high-level
  abstractions of resources stored in a specialized server … so this function
  will return the original `RID`"), and survives a typed signature.
- **Keep the `Texture2D` reference.** The servers page warns in a box:
  "references to a resource's RID are *not* counted when determining whether
  the resource is still in use. Make sure to **keep a reference** to the
  resource outside the server."
- **`free_rid()` is mandatory.** The class reference on
  `RenderingServer.free_rid`: "To avoid memory leaks, this should be called
  after using an object as memory management does not occur automatically when
  using RenderingServer directly."
- **`canvas_item_reset_physics_interpolation()` on creation** — the servers
  page says without it "the canvas item may appear to teleport in when the
  scene is loaded, rather than appearing directly at its intended location."
  It is harmless with interpolation off. *Version gate:* 2D physics
  interpolation arrived in Godot 4.3; the method exists in 4.3+.
- **`for ci: RID in _items:`** — typed for-loop variables are Godot 4.2+.

### What you give up

Honest list, because these are the reasons not to do it:

- No `Node2D` conveniences on the item itself: no `AnimationPlayer` track, no
  signals, no `Tween` on its properties, no inspector. Parent transform and
  parent visibility do still propagate — the item is a real child of
  `get_canvas_item()` — but that is all you get.
- Nothing shows in the editor viewport. You debug with the running game.
- Draw order among siblings is not a `z_index` on a node you can see. Use
  `canvas_item_set_draw_index()` (documented tersely as "Sets the index for the
  CanvasItem") or `canvas_item_set_z_index()` ("its draw order (lower indexes
  are drawn first)"). If you swap-remove entries in a pooled table, the draw
  index no longer follows the slot — decide up front whether order matters. For
  Cosmo it does: threats must read above stars.
- **Never read anything back.** The servers page: "Try to **never** request any
  information from `RenderingServer`, `PhysicsServer2D`, or `PhysicsServer3D`
  … These servers will often run asynchronously for performance and calling any
  function that returns a value will stall them … This will severely decrease
  performance if you call them every frame (and it won't be obvious why)."

### Where the threshold is

The naive `Sprite2D`-per-object approach is fine for tens of objects. It is not
fine for hundreds. Cosmo sits awkwardly in the middle — 15 shards is nothing,
but 173 background stars plus per-light bloom discs plus particles is not. The
useful split:

| Objects | Approach |
|---|---|
| A handful, need editor authoring | `Node2D` / `Sprite2D`. Do not optimise this. |
| Tens, uniform, script-driven | One `Node2D` with `_draw()` + `queue_redraw()`. Simple, batches well, rebuilds commands each redraw. |
| Hundreds, individually transformed, distinct tints | `RenderingServer` canvas item pool (above). |
| Hundreds to thousands, identical mesh, one texture | `MultiMesh` (next section). |

The middle row deserves a note: `_draw()` is not slow. `queue_redraw()` is
documented to fire "only **once** per frame, even if this method has been
called multiple times", and the commands you emit inside `_draw()` batch by
exactly the same rules as anything else. Its cost is that the entire command
list is rebuilt on every redraw — which is fine at tens of quads and wrong at
hundreds. Cosmo's HUD and front screens are a perfect fit for `_draw()`; the
arena is not.

---

## 3. `MultiMesh` for the starfield, the dust and the bloom discs

`MultiMeshInstance2D` "is a specialized node to instance a `MultiMesh` in 2D.
This can be faster to render compared to displaying many `Sprite2D` nodes with
large transparent areas, especially if the nodes take up a lot of space on
screen at high viewport resolutions. This is because using a mesh designed to
fit the sprites' opaque areas will reduce GPU fill rate utilization (at the
cost of increased vertex processing utilization)."

Read that carefully — the documented win in 2D is **fill rate**, not draw
calls. On a mobile tile renderer that trade is favourable in one direction and
unfavourable in the other, and the GPU optimisation page tells you which:
"don't worry about vertex count on mobile, but **avoid concentration of
vertices in small parts of the screen**." A starfield of tiny quads scattered
across the whole screen is the good case. A thousand overlapping halo quads
piled in the arena annulus is the bad case.

### Building one

```gdscript
class_name Starfield
extends MultiMeshInstance2D
## 173 background stars in one draw call. The float buffer is allocated once
## and uploaded whole; nothing here allocates per frame.

const COUNT: int = 173
const STRIDE: int = 12          # 8 floats Transform2D + 4 floats Color

var _buf: PackedFloat32Array = PackedFloat32Array()
var _mm_rid: RID

func _ready() -> void:
	var quad := QuadMesh.new()          # QuadMesh defaults to FACE_Z: the XY plane
	quad.size = Vector2(4.0, 4.0)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_2D
	mm.use_colors = true                # MUST be set before instance_count
	mm.mesh = quad
	mm.instance_count = COUNT           # this clears and (re)sizes the buffers

	multimesh = mm
	_mm_rid = mm.get_rid()
	_buf.resize(COUNT * STRIDE)

func write_frame(pos: PackedVector2Array, tint: PackedColorArray) -> void:
	var w: int = 0
	for i in COUNT:
		var p: Vector2 = pos[i]
		var c: Color = tint[i]
		# Verified 2D layout, mesh_storage.cpp _multimesh_instance_set_transform_2d:
		#   [0]=col0.x [1]=col1.x [2]=0 [3]=origin.x
		#   [4]=col0.y [5]=col1.y [6]=0 [7]=origin.y
		_buf[w + 0] = 1.0
		_buf[w + 1] = 0.0
		_buf[w + 2] = 0.0
		_buf[w + 3] = p.x
		_buf[w + 4] = 0.0
		_buf[w + 5] = 1.0
		_buf[w + 6] = 0.0
		_buf[w + 7] = p.y
		_buf[w + 8] = c.r
		_buf[w + 9] = c.g
		_buf[w + 10] = c.b
		_buf[w + 11] = c.a
		w += STRIDE
	RenderingServer.multimesh_set_buffer(_mm_rid, _buf)
```

The per-instance data size is documented on `multimesh_set_buffer`: 2D is
"Position: 8 floats (8 floats for Transform2D)", "Position + Vertex color: 12
floats", "Position + Vertex color + Custom data: 16 floats". The exact float
order above is from `servers/rendering/renderer_rd/storage_rd/mesh_storage.cpp`
on `4.7-stable`, not inferred.

### The trap that costs a frame every time you hit it

**Do not mix `multimesh_set_buffer()` with the per-instance setters.**

`_multimesh_instance_set_transform_2d()` begins by calling
`_multimesh_make_local()`. That function returns immediately if a CPU-side data
cache already exists — but if you have only ever used `set_buffer()`, there is
no cache, and it builds one:

```cpp
// servers/rendering/renderer_rd/storage_rd/mesh_storage.cpp, 4.7-stable
if (multimesh->buffer_set) {
    Vector<uint8_t> buffer = RD::get_singleton()->buffer_get_data(multimesh->buffer);
    ...
}
```

That is a **synchronous GPU buffer readback** — exactly the "calling any
function that returns a value will stall them" failure the servers page warns
about, triggered by a setter that looks like it only writes. The Compatibility
renderer does the same thing via `Utilities::buffer_get_data`
(`drivers/gles3/storage/mesh_storage.cpp`). Pick one API per multimesh and stay
in it.

After that, per-instance writes are not catastrophic — they mark dirty
*regions*, not individual instances, and upload the dirty regions. But
`set_buffer()` is a single `buffer_update()` of the whole range with no CPU
mirror at all, and `PackedFloat32Array` is "always passed by reference", so the
buffer does not get copied on the way in either.

### Two more things worth knowing

- **`visible_instance_count` is your pool cursor.** "Limits the number of
  instances drawn, -1 draws all instances. Changing this does not change the
  sizes of the buffers." Allocate for the worst case once, then move
  `visible_instance_count`. Changing `instance_count` reallocates.
- **No per-instance culling.** "There is no screen or frustum culling possible
  for individual instances." For a full-screen starfield that is exactly what
  you want. For anything that leaves the screen, it means you are paying for
  offscreen instances; splitting into several multimeshes is the documented
  workaround, but see the batching section — each multimesh is its own draw
  call.
- `MultiMesh.custom_aabb` is documented as preventing "costly runtime AABB
  recalculations". Useful, but get the bounds wrong in 2D and the whole
  multimesh can vanish. Set it only after you have measured that the
  recalculation is on your profile. **Unverified** for the 2D canvas path
  specifically.

---

## 4. Draw-call batching in 2D: exactly what breaks a batch

The GPU optimisation page says what batching is — "Multiple similar items are
grouped together and rendered in a batch, via a single draw call" — and stops
there. The list below is read from the 4.7 renderers themselves:
`servers/rendering/renderer_rd/renderer_canvas_render_rd.cpp` (Forward+ and
Mobile) and `drivers/gles3/rasterizer_canvas_gles3.cpp` (Compatibility).

A new batch — and therefore a new draw call — starts when any of these changes
between consecutive canvas-item commands:

| Break | Both renderers |
|---|---|
| The clip owner (`canvas_item_set_clip`, `CanvasGroup`) | yes |
| The material (`canvas_item_set_material`) | yes |
| Whether lighting is on for the item | yes |
| The **texture**, or the texture's filter or repeat mode | yes |
| The command *type* — rect vs ninepatch vs primitive vs polygon vs mesh | yes |
| Blend mode / blend colour | yes |
| MSDF flags, pixel range, outline (text) | RD path |
| LCD subpixel AA (text) | RD path |
| Primitive point count (1/2/3-4 points) | yes |

And three command types can never batch at all. The comments in the source say
so in as many words:

```cpp
// Polygon's can't be batched, so always create a new batch
// Mesh's can't be batched, so always create a new batch   (MESH, MULTIMESH, PARTICLES)
```

So: `draw_polygon`, `draw_colored_polygon`, `draw_mesh`, `draw_multimesh` and
every `GPUParticles2D` / `CPUParticles2D` is **one draw call each, minimum**,
plus it terminates whatever batch was in progress. Twelve `MultiMeshInstance2D`
nodes are at least twelve draw calls even though each one contains a thousand
instances. A `draw_polyline` for a trail ribbon is a polygon command and ends
the batch.

There is also a hard flush: `rendering/2d/batching/item_buffer_size` (default
**16384**, and `rendering/gl_compatibility/item_buffer_size`, also 16384) caps
instances per instance buffer; on overflow the renderer flushes, allocates a
new buffer and forces a new batch. Cosmo will never approach 16384 quads.

### What this means for Cosmo

- **One atlas.** `public/art/manifest.json` ships **24 separate textures**
  today, and the shape of them is friendly: fourteen are 256×256 (every hazard,
  every powerup orb, `star-gold`), five are 512×512 (`comet-core` and the four
  `fx-*` plates), and the remaining five are the 1024-wide UI and world pieces.
  Fourteen 256×256 sprites tile exactly into one 1024×1024 page. Drawn as
  separate `Texture2D`s and interleaved, those fourteen are up to fourteen
  batch breaks per frame; atlased into one page with
  `canvas_item_add_texture_rect_region`, they are one. That is the single
  cheapest draw-call win available in this project and it costs an import
  step. `code.artifact-sprites` bakes each object once into `artifactBank` and
  `code.sprite-bake` bakes `SPR` on resize; both become one atlas built once
  per real resize.
- **Draw order is a batching decision, not just an art decision.** Interleaving
  a polygon (a rail arc) between two sprite groups splits the sprite batch in
  two. Draw all the arcs, then all the sprites; not arc/sprite/arc/sprite.
- **Set the texture filter once, on the parent canvas item.**
  `canvas_item_set_default_texture_filter()` is per item, and a mismatch
  between two items is a batch break.
- **The tail ribbon** (`code.tail`, drawn twice under time dilation) is polygon
  geometry: two unavoidable draw calls, and it splits whatever it sits between.
  Draw both passes adjacently.

### Counting them honestly

This is the part most people get wrong. The global counter does **not** see 2D:

- `RenderingServer.get_rendering_info(...)` carries a note: "Only 3D rendering
  is currently taken into account by some of these values, such as the number
  of draw calls." And `RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME` is documented
  as "Number of draw calls performed to render in the current **3D** scene."
- The one that works for canvas is per-viewport, and
  `VIEWPORT_RENDER_INFO_TYPE_CANVAS` is documented as "Canvas item rendering.
  This includes all 2D rendering."

```gdscript
func canvas_draw_calls() -> int:
	return RenderingServer.viewport_get_render_info(
		get_viewport().get_viewport_rid(),
		RenderingServer.VIEWPORT_RENDER_INFO_TYPE_CANVAS,
		RenderingServer.VIEWPORT_RENDER_INFO_DRAW_CALLS_IN_FRAME)
```

*Version gate:* `VIEWPORT_RENDER_INFO_TYPE_CANVAS` is absent from the 4.0 and
4.2 class reference and present from **4.3** onward. On 4.0–4.2 there is no
supported way to count 2D draw calls from script.

Also: "Rendering information is not available until at least 2 frames have been
rendered by the engine. If rendering information is not available,
`get_rendering_info` returns `0`." So this returns 0 in `_ready()`.

---

## 5. Pooling: doing it properly, and knowing when it is premature

### The documented baseline

Two official statements, and they are less exciting than the folklore:

- CPU optimisation, on the scene tree: "you can sometimes get much better
  performance by removing nodes from the SceneTree, rather than by pausing or
  hiding them. You don't have to delete a detached node. You can for example,
  keep a reference to a node, detach it from the scene tree using
  `Node.remove_child(node)`, then reattach it later using
  `Node.add_child(node)`."
- CPU optimisation, on physics: "Try removing objects from physics when they
  are out of view / outside the current area, or reusing physics objects (maybe
  you allow 8 monsters per area, for example, and reuse these)."

That is the whole official position on pooling. Note what it does *not* say: it
does not claim `instantiate()` is catastrophic, and it does not tell you to
pool everything.

### When it is premature

Cosmo's maximum simultaneous shard count is 15 (`tune.shard-cap`), and the
record notes the measured mean was "6.2 shards on a board whose cap was 8" —
placement failure limits density, not the cap. Pooling fifteen objects to avoid
fifteen allocations per minute is not an optimisation; it is a source of bugs
about stale state on reuse. If you build the shard layer out of nodes, do not
pool them.

Pooling becomes correct at exactly two moments in this game:

1. **When you own the RIDs.** A `RenderingServer` canvas item is not
   garbage-collected; you must create and free it explicitly. Pooling is then
   not an optimisation, it is the only sane lifetime policy — create the pool
   in `_ready()`, free it in `_exit_tree()`, and toggle
   `canvas_item_set_visible()` in between. The `ShardLayer` above is already a
   pool.
2. **For the things there are hundreds of** — bloom-contributing lights,
   particles from `burst`/`ripple` (`code.fx-primitives`), trail samples. Those
   have no identity and a fixed cap; they belong in flat arrays, not objects.

### The flat table

Struct-of-arrays, preallocated, with swap-remove. This is the shape that makes
the CPU cache work — the general optimisation page: modern CPUs are "nearly
always limited by memory bandwidth", and "if you can make your data accesses
localised, or even better, access memory in a linear fashion (like a continuous
list), then the cache will work optimally."

```gdscript
class_name ShardTable
extends RefCounted

const CAP: int = 24

var ring: PackedInt32Array = PackedInt32Array()
var ang: PackedFloat32Array = PackedFloat32Array()
var vel: PackedFloat32Array = PackedFloat32Array()
var phase: PackedInt32Array = PackedInt32Array()   # 0 warn, 1 live, 2 fade
var age: PackedFloat32Array = PackedFloat32Array()
var count: int = 0

func _init() -> void:
	ring.resize(CAP)
	ang.resize(CAP)
	vel.resize(CAP)
	phase.resize(CAP)
	age.resize(CAP)

func spawn(r: int, a: float, v: float) -> int:
	if count >= CAP:
		return -1
	var i: int = count
	ring[i] = r
	ang[i] = a
	vel[i] = v
	phase[i] = 0
	age[i] = 0.0
	count += 1
	return i

## Swap-remove. O(1), but it reorders the table: anything holding an index
## into it (a canvas item slot, a draw index) must be moved with it.
func despawn(i: int) -> void:
	var last: int = count - 1
	ring[i] = ring[last]
	ang[i] = ang[last]
	vel[i] = vel[last]
	phase[i] = phase[last]
	age[i] = age[last]
	count = last

func step(dt: float) -> void:
	for i in count:
		ang[i] += vel[i] * dt
		age[i] += dt
```

The swap-remove comment is not decoration. In Cosmo, `code.update-spikes`
resolves "the one lethal-contact site plus the two honest near misses" and
`lastHit` is stamped from the shard's own flags so the death coach names the
right formation. If your indices shuffle mid-frame, you name the wrong
formation. Either despawn in a deferred sweep after the contact pass, or keep a
stable slot id alongside the swap.

### And: skip the physics engine entirely

`tune.hit-tol`: a shard's hit half-width is `18.5*u / radiusOf(ring)` radians.
`code.player-geometry`: `sweptHit` covers the whole angle travelled this frame.
That is a one-dimensional interval overlap on a ring index. `PhysicsServer2D`
would give you a broadphase, an island solver and a force-integration callback
for a problem that is `absf(angle_delta) < tol`. Using it would be slower,
introduce a second position source in conflict with
`rule.gfx.shared-geometry`, and put collision on the physics tick when the game
runs on its own accumulator.

This is worth stating plainly because "use `Area2D` for pickups" is the
default Godot answer, and for this game it is the wrong one.

---

## 6. Data layout: packed arrays, typed arrays, and what allocates

### The documented hierarchy

From `PackedVector2Array`, and this is the clearest official statement on the
subject:

> **Differences between packed arrays, typed arrays, and untyped arrays:**
> Packed arrays are generally faster to iterate on and modify compared to a
> typed array of the same type (e.g. `PackedVector2Array` versus
> `Array[Vector2]`). Also, packed arrays consume less memory. As a downside,
> packed arrays are less flexible as they don't offer as many convenience
> methods such as `Array.map`. Typed arrays are in turn faster to iterate on
> and modify than untyped arrays.

So: `PackedFloat32Array` > `Array[float]` > `Array`. No numbers are given and
none should be invented.

### The copy trap

Also documented, and it is the one that silently allocates every frame:

> Packed arrays are always passed by reference. … This is *not* the case for
> built-in properties and methods. In these cases the returned packed array is
> a **copy**, and changing it will *not* affect the original value. To update a
> built-in property of this type, modify the returned array and then assign it
> to the property again.

```gdscript
# Allocates a full copy of the buffer, every frame, silently.
var b: PackedFloat32Array = multimesh.buffer
b[3] = x
multimesh.buffer = b

# No copy: the array you own is passed by reference into the server call.
_buf[3] = x
RenderingServer.multimesh_set_buffer(_mm_rid, _buf)
```

The same applies to `Line2D.points`, `Polygon2D.polygon`, `Curve2D` samples and
anything else exposed as a packed-array property.

### `range()` does not allocate — and this is a Godot 3 myth worth killing

`range()` is documented as returning an `Array`, which is why every performance
guide tells you to avoid it in hot loops. In GDScript 2.0 that is false for the
common case. `modules/gdscript/gdscript_compiler.cpp` on `4.7-stable`:

```cpp
// Optimize `range()` call to not allocate an array.
```

The compiler recognises `range(...)` **in the header of a `for` loop** and
emits a counted loop with no array. So:

```gdscript
for i in range(count):        # no allocation — compiled to a counted loop
	...

var r := range(count)         # allocates an Array
for i in r:                   # ...and iterates it
	...

for i in count:               # also fine, and shorter
	...
```

Prefer `for i in count:` for readability, but stop rewriting `range()` out of
loop headers on performance grounds.

### What does allocate, per frame, without looking like it

Verifiable:

- Any `Array` or `Dictionary` literal in the body of a per-frame function.
- `Node.get_children()` — documented as returning "all children of this node
  inside an `Array`": a fresh array each call.
- Packed-array property getters, as above.
- `String` building: `"%s" % x`, `str()`, `+` on strings. HUD text that
  recomputes an unchanged score string every frame is pure garbage.

Reasoned but **unverified** (I could not find documentation that pins these,
and did not measure them): `Callable.bind()` producing a new Callable per call;
lambda expressions evaluated inside a loop; boxing into `Variant` when a typed
value crosses an untyped boundary. Treat these as suspects to profile, not as
facts.

The mitigation is the same for all of them: hoist. Build the string when the
score changes, not when the frame renders. Cache child references in `_ready()`
instead of calling `get_node()`/`$Path` per frame.

---

## 7. Static typing: what it actually buys

The documented claim, in full, is one sentence:

> Also, typed GDScript improves performance by using optimized opcodes when
> operand/argument types are known at compile time. More GDScript optimizations
> are planned in the future, such as JIT/AOT compilation.

That is opcode specialisation — the VM can emit a float-add instead of a
Variant-add — not compilation. There is no published multiplier, and anyone
quoting one is quoting a benchmark, not the engine. The honest framing: typing
removes per-operation Variant dispatch from your inner loops. In a loop over 24
shards it is noise. In a loop over 173 stars × 12 floats it is not.

Type everything anyway, for the same reason you would in any other language,
and then let the compiler enforce it:

```ini
# project.godot
[debug]
gdscript/warnings/untyped_declaration=2      ; 2 = treat as error
gdscript/warnings/inference_on_variant=2
gdscript/warnings/unsafe_call_argument=2
gdscript/warnings/unsafe_method_access=2
gdscript/warnings/unsafe_property_access=2
gdscript/warnings/unsafe_cast=2
gdscript/warnings/integer_division=1
gdscript/warnings/narrowing_conversion=2
```

The `unsafe_*` family is the one that matters for performance: each warning is
a site where the compiler could not prove a type and fell back to a dynamic
lookup. Turning them into errors is how you find out that your "typed" codebase
is 40 % dynamic.

Current syntax, since Godot 3 material is everywhere:

```gdscript
var damage: float = 10.5
var speed := 320.0                  # inferred
const MAX_RINGS: int = 5
var angles: PackedFloat32Array = PackedFloat32Array()
var slots: Array[RID] = []
var costs: Dictionary[String, int] = {}     # typed dictionaries: Godot 4.4+
func hit(dmg: float) -> bool: return dmg > 0.0
@export var atlas: Texture2D                # not `export var`
signal ring_changed(index: int)             # emit with ring_changed.emit(i)
```

---

## 8. Shaders, fill rate and the glow chain

This is where Cosmo is most at risk on a phone, because the two most expensive
things in the game are the two things the direction document is least willing
to give up.

### The sky is a fill-rate problem

`code.gl-sky` is one full-screen triangle running a procedural planet,
atmosphere, occluded rings and a dust field. In Godot that becomes a
`ColorRect` (or a `canvas_item_add_texture_rect` on a 1×1 white texture) with a
`ShaderMaterial` and a `canvas_item` fragment shader. The cost is
`width × height × DPR²` fragment invocations of a long shader, every frame.

The documented diagnostic is the window test: "compare the frames per second
when running with a large window, to running with a very small window …
Usually, you will find the FPS increases quite a bit using a small window,
which indicates you are to some extent fill rate-limited." On a phone the
equivalent is `get_tree().root.content_scale_factor` (see §11) — if halving the
effective resolution doubles your headroom, the sky shader is your bottleneck
and no amount of CPU work will help.

Mitigations, in order of how much they cost you visually:

1. **Fewer texture reads.** "Reading textures is an expensive operation … If
   you use third-party shaders or write your own shaders, try to use algorithms
   that require as few texture reads as possible." Cosmo's sky is procedural,
   so this mostly means: do not add a noise texture lookup per layer.
2. **Simplify the shader.** "When targeting mobile devices, consider using the
   simplest possible shaders you can reasonably afford to use."
3. **Render the sky into a lower-resolution `SubViewport`** and stretch it. The
   sky is low-frequency; the arena is not. This is the single highest-leverage
   move available and it costs almost nothing visually — but see the tile-renderer
   warning below before committing to it.
4. **Bake it.** `code.sky-director` already has an art-plate path
   (`drawGeminiSky`) that cross-fades painted worlds; on a device that cannot
   afford the procedural sky, falling back to the painted plate is a
   *documented existing behaviour*, not a new compromise.

### The glow chain is the mobile-hostile shape

`code.fx-chain` is six render targets at three scales running a separable
gaussian and compositing with chromatic aberration. That is exactly the pattern
the GPU optimisation page singles out for mobile:

> Tiled rendering can make certain techniques much more complicated and
> expensive to perform. Tiles that rely on the results of rendering in
> different tiles or on the results of earlier operations being preserved can
> be very slow. **Be very careful to test the performance of shaders, viewport
> textures and post processing.**

A hand-rolled chain of `SubViewport`s in Godot is that pattern, with a resolve
and a re-bind per level. **Use Godot's built-in glow instead** unless you have
measured that you cannot. `WorldEnvironment` + `Environment.glow_enabled` runs
inside the engine's own post pipeline, which is already written around the
tiling constraint.

Things you must know about 2D glow in Godot 4 before you plan around it:

- **Lower the threshold.** `glow_hdr_threshold`: "This value also needs to be
  decreased below `1.0` when using glow in 2D, as 2D rendering is performed in
  SDR." Leaving it at 1.0 gives you no glow at all and an afternoon of
  confusion.
- **Compatibility uses a different, simpler implementation.** Documented on
  several members: "When using the Compatibility rendering method, glow uses a
  different implementation with some properties being unavailable";
  `glow_blend_mode` "will have no effect" (always Screen); `glow_levels/1` "has
  no effect … due to this rendering method using a simpler glow implementation
  optimized for low-end devices"; `glow_map_strength` likewise;
  `rendering/environment/glow/upscale_mode` is Forward+/Mobile only.
- **HDR 2D is what makes the gradients good, and Compatibility does not have
  it.** `Viewport.use_hdr_2d` gives an `RGBA16` framebuffer and "substantially
  improves the appearance of effects requiring highly detailed gradients". The
  renderer table lists "2D HDR Viewport" as not supported in Compatibility. For
  a game whose whole look is a nebula gradient behind bloomed points of light,
  that is the sharpest trade in this document.
- **Mobile renderer** has "lower dynamic range available", so
  `glow_intensity` "should be increased to `1.5` to compensate".

### Keep the baked halos

Cosmo's `code.sprite-bake` exists so that "no per-frame `shadowBlur` is ever
paid", and `bloomDot` writes two extra halo discs per light in the CPU
fallback. In Godot the equivalent is: **bake the halo into the sprite's alpha
in the atlas**. A pre-blurred halo costs one textured quad and zero
post-processing passes. The engine glow then only has to handle the few
genuinely bright things. This is strictly better than reproducing the six-target
chain, and it is the same technique Cosmo already relies on.

The cost is transparency, and the docs are blunt about it: "Transparent objects
are also particularly bad for fill rate, because every item has to be drawn even
if other transparent objects will be drawn on top later on … It is usually
better to use transparent areas as small as possible … especially on mobile,
where fill rate is very expensive." A 4× halo quad is 16× the fill of the
sprite. Keep halos tight; that is what `HALO_K1 = 2.0` / `HALO_K2 = 4.0` were
already negotiating.

### Shader compilation stutter — the 2D hole

This will bite on first play and it has no clean fix:

> The engine does not currently feature precompilation for 2D elements and
> stutters will show up when the 2D node is drawn for the first time.

Ubershaders (4.4+) and the Shader Baker (4.5+) mitigate 3D pipelines under
Forward+/Mobile; canvas is not covered, and Compatibility cannot use the
ubershader approach at all ("it is not possible to use this ubershader approach
due to technical limitations in OpenGL"). The documented workaround is a
warm-up: "spawn every mesh and visual effect in front of the camera for a
single frame when the level is loading … behind solid 2D UI (such as a
fullscreen `ColorRect`)."

For Cosmo that means: on the level card, draw one of every material — sky,
sprite, halo, ribbon polygon, glow-enabled frame — behind the card, for one
frame. And watch `Performance.PIPELINE_COMPILATIONS_CANVAS` ("Number of
pipeline compilations that were triggered by the 2D canvas renderer") to prove
the warm-up worked: it should stop climbing once play begins.

### Renderer choice

The 4.7 renderer table, verbatim on 2D: Forward+ and Mobile both say "Yes, but
Compatibility is usually good enough for 2D." The recommendation to pick
Compatibility applies "if you are developing a 2D game, or a 3D game which does
not need advanced rendering features", and "you want the best performance
possible on all devices". `msaa_2d` is not supported there; neither is HDR 2D;
neither is `RenderingDevice`.

For Cosmo the decision is genuinely open and should be made by looking at the
sky on a device, not by reading a table:

- **Compatibility** — cheapest, widest device reach, works on web. No HDR 2D →
  visible banding in the nebula, and a simplified glow you have less control
  over. `rendering/renderer/rendering_method.mobile` lets you choose it for
  mobile only.
- **Mobile** — HDR 2D and the real glow implementation, at a higher base cost
  and requiring Vulkan/Metal. "Yes, but slower than Compatibility" on older
  hardware.

Set `rendering/renderer/rendering_method.mobile` explicitly. Do not leave it to
the default and discover the answer on a user's phone.

---

## 9. Texture memory and compression on mobile

The import-options table, which is the numbers you actually need:

| Compress mode | On disk | Memory | Perf | Quality loss | Load time |
|---|---|---|---|---|---|
| Lossless | Small | **Large** | Normal | None | Slow |
| Lossy | Very small | **Large** | Normal | Slight | Slow |
| VRAM Compressed | Small | **Small** | Fast | Moderate | Fast |
| VRAM Uncompressed | Large | Large | Normal | None | Normal |
| Basis Universal | Very small | Small | Fast | Moderate | Normal |

And the memory a single RGBA8 texture with mipmaps costs:

| Size | Lossless / Lossy / Uncompressed | VRAM Compressed / Basis |
|---|---|---|
| 512×512 | 1.33 MiB | 341 KiB |
| 1024×1024 | 5.33 MiB | 1.33 MiB |
| 2048×2048 | 21.33 MiB | 5.33 MiB |
| 4096×4096 | 85.33 MiB | 21.33 MiB |

"Memory usage will be reduced by 25% for images that do not have an alpha
channel (RGB8). Memory usage will be further decreased by 25% for images that
have mipmaps disabled."

### Where Cosmo actually stands

The shipped art set is small and the memory arithmetic is easy. From
`public/art/manifest.json`, as RGBA8 with mipmaps **off** (the right setting
for sprites drawn near 1:1):

| Group | Count | Each | Subtotal |
|---|---|---|---|
| Hazards, orbs, `star-gold` | 14 × 256² | 256 KiB | 3.5 MiB |
| `comet-core`, four `fx-*` | 5 × 512² | 1 MiB | 5 MiB |
| `drift-planet`, `drift-ring` | 2 × 1024² | 4 MiB | 8 MiB |
| Wordmark and two UI frames | 3, 1024-wide | — | ≈ 4.3 MiB |

Roughly **21 MiB** uncompressed. That is comfortable on any phone, and it means
**the sprites do not need VRAM compression** — which is good, because the docs
warn it "should be avoided for 2D as it exhibits noticeable artifacts,
especially for lower-resolution textures", and Android generally cannot VRAM-
compress textures with alpha anyway ("most Android devices do not support
texture compression of textures with transparency (only opaque)").

The pressure arrives with `tune.sky-art-worlds` — eight painted celestial
backdrops. **These are not in the manifest today**; the record calls them
"optional". When they land they will dominate the budget: eight 2048×2048
lossless plates would be ~170 MiB with mipmaps, which is a plausible way to be
killed by Android's low-memory killer mid-session. Plan for it now:

1. **Do not keep eight resident.** A run visits at most two adjacent worlds at a
   time — `code.sky-director` cross-fades over the last 20 % of a world. Load
   two, free the rest. This is the right answer, and it is a content-pipeline
   decision rather than a compression trade.
2. **VRAM Compressed for the plates only.** Cuts each 2048² from 21.33 MiB to
   5.33 MiB. The plates are opaque, so Android will actually compress them.
   Block compression on smooth gradients is exactly where artifacts are worst,
   so *look at it on the device* before committing — the bloom and the dust may
   hide the banding, or may make it worse.
3. **Drop the plates entirely on low-memory devices** and use the procedural
   sky. That fallback already exists — `code.boundary.textures`: "every runtime
   art lookup treats null as draw the procedural version."

Also: "most Android devices do not support texture compression of textures with
transparency (only opaque)". Sky plates are opaque, so they are the good case;
a compressed sprite atlas with alpha is the bad case. And
`rendering/textures/vram_compression/import_etc2_astc` selects ETC2 for lower
quality and ASTC for high quality — but the setting "is an override. The
texture importer will always import the format the host platform needs, even if
this is set to `false`", and it does not retroactively apply to already-imported
textures.

Mipmaps: on for the sky plates (they are scaled and cover-cropped with a 1.045
overscan, so minification happens), off for gameplay sprites drawn near 1:1 —
that is a free 25 % of their memory back.

---

## 10. Measuring it honestly

### The built-in profiler, and its blind spots

- It must be started manually, because "recording these timing measurements can
  slow down your project significantly."
- **Inclusive vs Self is the setting that matters.** Inclusive "measures the
  time a function took **with** any nested function calls"; Self measures "the
  time spent in the function body without considering function calls it made
  itself." Reading Inclusive and concluding your top-level `_process` is slow
  is the classic mistake.
- **Frame Time includes rendering**, and the docs flag the exact confusion:
  "Say you find a mysterious spike of lag in your game, but your physics and
  scripts are all running fast. The delay could be due to the appearance of
  particles or visual effects!"
- It does not profile the GPU. For a game whose bottleneck is likely a
  full-screen shader, the profiler will show you a fast frame and a slow game.
  The general optimisation page lists external GPU profilers (Nsight, RGP, PIX,
  Xcode) for this reason.
- It does not profile C# (irrelevant here, but it explains a lot of confused
  forum posts).

### Manual timing

The documented technique, and it is still the most useful one:

```gdscript
var start: int = Time.get_ticks_usec()
_step_shards(dt)
var elapsed_us: int = Time.get_ticks_usec() - start
```

With the caveat from the CPU optimisation page: "run the function many times
(1,000 or more times), instead of just once", because timer resolution and
scheduler noise swamp a single call.

### The monitors worth watching in an on-screen debug overlay

| Monitor | Reads |
|---|---|
| `Performance.TIME_PROCESS` | seconds in the process step |
| `Performance.TIME_PHYSICS_PROCESS` | seconds in the physics step |
| `Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME` | draw calls. The `Performance` docs do *not* repeat the 3D-only caveat, but the `RenderingServer` constant it mirrors does; treat it as 3D and use the canvas viewport query for 2D |
| `Performance.RENDER_TEXTURE_MEM_USED` | texture bytes — the sky-plate budget |
| `Performance.RENDER_VIDEO_MEM_USED` | total video memory |
| `Performance.OBJECT_NODE_COUNT` | nodes in the tree |
| `Performance.OBJECT_ORPHAN_NODE_COUNT` | leaked detached nodes — debug builds only |
| `Performance.PIPELINE_COMPILATIONS_CANVAS` | 2D shader compilations; must go flat before gameplay |
| `Performance.MEMORY_STATIC` | **not available in release builds** |

`Performance.add_custom_monitor(id: StringName, callable: Callable,
arguments: Array, type: int)` puts your own numbers on the same graph as the
engine's, which is how you correlate a frame spike with a spawn wave:

```gdscript
func _ready() -> void:
	Performance.add_custom_monitor(&"cosmo/live_shards", _live_shards, [],
		Performance.MONITOR_TYPE_QUANTITY)
	Performance.add_custom_monitor(&"cosmo/quality_tier", _quality_tier, [],
		Performance.MONITOR_TYPE_QUANTITY)

func _live_shards() -> int:
	return shards.count

func _quality_tier() -> int:
	return governor.tier
```

### The rules that keep the numbers honest

1. **Measure on the target phone, in a release export.** Debug builds carry
   different code paths; the editor carries the editor.
2. **Measure with vsync as shipped.** Frame time under an uncapped renderer
   answers a question nobody asked.
3. **Do the window/resolution test before optimising CPU.** If dropping to 60 %
   resolution fixes it, nothing you do in GDScript will.
4. **Two frames of warm-up** before reading any rendering info, per the class
   reference.
5. Do not trust a single run. Thermal state changes the answer — which is the
   next section.

---

## 11. Thermal throttling and the long session

### What Godot gives you: nothing

Verified by enumerating `OS` in the 4.7 class reference: there is no thermal
state, no battery level, no power-source query, no sustained-performance mode.
`OS` has `get_memory_info`, `get_processor_count`, `get_static_memory_usage`
and no thermal anything. iOS exposes `ProcessInfo.thermalState` and Android
exposes `PowerManager.getThermalHeadroom()`; Godot 4.7 surfaces neither. If you
want them you are writing a platform plugin.

So the only signal available from GDScript is **the frame interval itself**,
and the only honest way to use it is a slow governor with hysteresis.

### A frame-time governor

```gdscript
class_name QualityGovernor
extends Node
## Watches the rendered frame interval and steps a quality ladder when the
## device stops holding the budget. Deliberately slow: a single hitch, a level
## load, or the frame a drop lands on must never move the ladder.

signal tier_changed(tier: int)

const WINDOW: int = 180              # ~3 s at 60 fps
const BUDGET: float = 1.0 / 60.0
const DOWN_AT: float = 1.25          # median frame 25 % over budget
const UP_AT: float = 0.92
const HOLD_S: float = 8.0            # settle time after any change
const MAX_TIER: int = 2

var tier: int = 0

var _ring: PackedFloat32Array = PackedFloat32Array()
var _scratch: PackedFloat32Array = PackedFloat32Array()
var _write: int = 0
var _filled: int = 0
var _hold: float = 0.0

func _ready() -> void:
	_ring.resize(WINDOW)
	_scratch.resize(WINDOW)

func _process(delta: float) -> void:
	_ring[_write] = delta
	_write = (_write + 1) % WINDOW
	_filled = mini(_filled + 1, WINDOW)

	if _hold > 0.0:
		_hold -= delta
		return
	if _filled < WINDOW:
		return

	var med: float = _median()
	if med > BUDGET * DOWN_AT and tier < MAX_TIER:
		_set_tier(tier + 1)
	elif med < BUDGET * UP_AT and tier > 0:
		_set_tier(tier - 1)

func _median() -> float:
	for i in WINDOW:
		_scratch[i] = _ring[i]
	_scratch.sort()
	return _scratch[WINDOW >> 1]     # `>> 1` not `/ 2`: no integer_division warning

func _set_tier(t: int) -> void:
	tier = t
	_hold = HOLD_S
	_filled = 0                      # refill the window before judging again
	tier_changed.emit(t)
```

Median, not mean: one 200 ms hitch must not move a 3-second window. Hysteresis
(1.25 down, 0.92 up) so the ladder cannot oscillate. A hold plus a window
refill so a change is judged only on evidence gathered after it took effect.

### The ladder itself

```gdscript
@onready var _world_env: WorldEnvironment = $WorldEnvironment

func _on_tier_changed(t: int) -> void:
	var env: Environment = _world_env.environment
	env.glow_enabled = (t == 0)

	# Stretch Mode must be `viewport` for this to reduce resolution:
	# "If Stretch Mode is set to viewport, the viewport's resolution is
	# divided by Scale." So a LARGER factor = LOWER resolution.
	get_tree().root.content_scale_factor = 1.0 if t < 2 else 1.25
```

The direction of `content_scale_factor` is the part everyone gets backwards:
under `CONTENT_SCALE_MODE_VIEWPORT` the resolution is *divided* by it, so
`1.25` renders at 80 %. It is a `Window` property and can be written at
runtime.

Order the ladder by what the player loses:

| Tier | Give up | Why first |
|---|---|---|
| 1 | Engine glow (keep the baked halos) | The halos carry most of the look already; the post pass is the expensive half |
| 2 | 80 % render resolution | Attacks fill rate directly, which is the likely bottleneck |
| 3 (if needed) | Procedural sky → painted plate, or a simplified sky shader | Changes the *world*, so last |

Never put particle counts or shard counts on this ladder. `tune.shard-cap` and
the spawn ladder are tuned difficulty, and a phone getting warm must not make
the game easier.

### And one rule about *when* it may fire

`rule.gfx.bounded-event-envelopes` says the black hole and major releases
outrank ordinary events. A quality change during a drop is a visible glitch on
the exact frame the game has spent ninety seconds earning. Gate `_set_tier` on
"not inside a scheduled musical peak, not inside the black hole, not within N
beats of a drop" — the governor can wait eight seconds; the drop cannot.

---

## Pitfalls

### Godot 3 idiom that will be suggested to you and is wrong here

| Godot 3 | Godot 4.7 |
|---|---|
| `yield(obj, "signal")` | `await obj.signal` |
| `KinematicBody2D`, `move_and_slide(vel, UP)` | `CharacterBody2D`, set `velocity`, call `move_and_slide()` |
| `export var speed = 10` | `@export var speed: float = 10.0` |
| `setget set_x, get_x` | `var x: int: set(v): ...` / `get: return ...` |
| `Tween` node, `interpolate_property` | `create_tween()`, `tween_property()` |
| `connect("pressed", self, "_on_pressed")` | `button.pressed.connect(_on_pressed)` |
| `emit_signal("done", x)` | `done.emit(x)` |
| `VisualServer` | `RenderingServer` |
| `Physics2DServer` | `PhysicsServer2D` |
| `update()` on a CanvasItem | `queue_redraw()` |
| `OS.get_ticks_usec()` | `Time.get_ticks_usec()` |
| `instance()` on a PackedScene | `instantiate()` |
| `rand_range`, `deg2rad` | `randf_range`, `deg_to_rad` |
| `QuadMesh` was the XY quad, `PlaneMesh` the XZ one | Both are `PlaneMesh` now; `QuadMesh` overrides `orientation` to `FACE_Z` ("matches the behavior of the QuadMesh in Godot 3.x") while `PlaneMesh` defaults to `FACE_Y`. For a 2D `MultiMesh`, use `QuadMesh`. |

### The official docs' own stale snippet

`tutorials/performance/using_servers.html` shows this GDScript:

```gdscript
PhysicsServer2D.body_set_force_integration_callback(body, self, "_body_moved", 0)
```

The 4.7 signature is
`body_set_force_integration_callback(body: RID, callable: Callable, userdata: Variant = null)`.
The four-argument form is Godot 3 and will fail. The C# tab on the same page is
correct (`new Callable(this, MethodName.BodyMoved)`). Written correctly:

```gdscript
PhysicsServer2D.body_set_force_integration_callback(body, _body_moved, 0)
```

Take it as a warning about the whole page: it is the only official document on
this technique and it has not been fully updated.

### The rest

- **`RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME` does not count 2D.** It is
  documented as "draw calls performed to render in the current 3D scene", and
  `get_rendering_info` carries a note that only 3D is taken into account for
  some values. A 2D game reading it will see a suspiciously small number and
  conclude, wrongly, that batching is perfect.
- **Mixing `multimesh_set_buffer()` with `multimesh_instance_set_*()` costs a
  GPU readback.** Source-verified in both renderers (§3).
- **Forgetting `free_rid()`** leaks server-side resources that no reference
  count will collect, and `OBJECT_ORPHAN_NODE_COUNT` will not show them because
  they are not nodes.
- **Letting a `Texture2D` go out of scope after handing its RID to the
  server.** Documented in a warning box; the symptom is an object that draws
  correctly in the editor build and vanishes in the export.
- **Calling a `_draw()`-family method with a resource held only in a local
  variable.** Documented on `draw_texture_rect`, `draw_mesh` and
  `draw_multimesh`: "the drawing operation doesn't begin immediately once this
  method is called. In GDScript, when the function with the local variables
  ends, the local variables get destroyed before the rendering takes place."
- **Assuming `_process` delta is a wall clock.** It is clamped, and it does not
  advance while the app is backgrounded.
- **Enabling physics interpolation and then setting transforms in `_process`.**
  Documented to produce jitter: "This jitter may not be visible on your
  machine, but it *will* occur for some players."
- **Assuming Compatibility gives you the same picture.** No HDR 2D, no MSAA 2D,
  a different glow implementation, several `Environment` glow properties inert.
- **Assuming the 2D shader stutter will go away with 4.5's Shader Baker.** The
  pipeline-compilation page is explicit that canvas has no precompilation.
- **Optimising before measuring on the phone.** Everything in this document is
  cheaper than a wrong guess, and the general optimisation page's framing is
  the right one: a performant *design* beats late low-level work.

---

## In Cosmo

Mapping each technique onto the subsystem that will need it. Record ids are
from this database; `node db/query.mjs get <id>` for the detail.

### The world pass — `code.draw`, `code.arena-projection`, `code.artifact-sprites`

`draw()` currently resets canvas state, picks a sky path, applies the dolly and
draws every object in one ordered pass. In Godot this becomes:

- One `Node2D` owning the arena, with the dolly on **its** transform, so
  `posAt`/`ecx`/`ecy` stay the single source of position exactly as
  `code.arena-projection` requires ("an object and its ring are computed from
  the same number"). Do not give objects their own `Node2D` positions; write
  `Transform2D`s into pooled canvas items from the same `posAt` call.
- Shards, stars, orbs, the comet and its fins: `ShardLayer`-style
  `RenderingServer` pools, one per draw-order band so `canvas_item_set_z_index`
  is set once per band rather than per object.
- `code.artifact-sprites` (`artifactBank`, keyed on `u + ':' + DPR`) becomes an
  atlas built once per real resize — the same cache key discipline as
  `code.sprite-bake`, which exists precisely so "no per-frame `shadowBlur` is
  ever paid". In Godot the equivalent sin is a per-frame `queue_redraw()` that
  re-emits every command; the rule survives the engine change.
- `code.arena-decor` (rails, atmosphere, ≤ 7 impacts, the singularity) is arc
  and polygon geometry: batch-breaking by construction. Draw the whole decor
  band contiguously, before the sprite band.

### The backdrop — `code.gl-sky`, `code.sky-director`, `tune.gl-scale`

`tune.gl-scale` records that the sky renders at full resolution with "no
performance downgrade ladder; the adaptive version described in
implementation.md is gone." The rebuild should bring that ladder back, as tier
2–3 of §11's governor, because the phone is where it was always needed and the
lever now exists as a documented `Window` property.

`SKY_ARENA_CALM = 0.62` and `GL_MOTION = 0.25` are tuned values
(`rule.gfx.sky-controls-readability`) and carry across as shader uniforms
unchanged.

### The glow — `code.bloom`, `code.fx-chain`, `tune.bloom`, `tune.halo`

Do **not** port the six-target chain. `code.bloom` already decides
`bloomHalo = !FX.on` once per frame, before the dot loop, so a mid-frame GPU
failure cannot half-glow the scene; Godot's built-in glow removes that whole
class of problem by removing the hand-rolled chain. The plan:

1. Bake the halo into each sprite's atlas entry — the `HALO_K1 = 2.0` /
   `HALO_K2 = 4.0` radius multiples and `HALO_W1 = 0.50` / `HALO_W2 = 0.20`
   weights are the recipe for the bake, and keeping the radii tight is a fill-rate
   decision (§8).
2. `WorldEnvironment` glow with `glow_hdr_threshold` well below 1.0 for the
   genuinely bright moments, tuned to reproduce `BLOOM_ALPHA = 0.28`.
3. Glow is governor tier 1: the first thing dropped when the device gets warm,
   because the baked halos survive it.

`check.gfx.glow-pipeline` currently pins "the six-target ladder, the Y-flip,
eight draws per frame and every uniform". That harness is `reference`, not
`spec` — it describes the WebGL implementation. The `spec` underneath it is
`rule.gfx.bounded-event-envelopes`: coordinated, bounded impact envelopes, a
calmer ordinary state, one authored moment at a time. Rewrite the check against
the new pipeline; keep the rule.

### The starfield — `tune.starfield`

173 stars in three tiers plus 22 `bgStars`, "generated once in normalised space
so resizing never reshuffles the sky." One `MultiMeshInstance2D`, three
sub-ranges of one buffer (or three multimeshes if the tiers need different
meshes — that costs three draw calls, which is fine). The record's warning that
"raising tier counts costs draw time on every frame" stops being true in a
multimesh, which is a real reason to revisit the count *upward* on capable
devices — but only as an addition at tier 0, never as a difficulty change.

### The simulation — `code.update`, `code.update-spikes`, `code.player-geometry`

- The accumulator in §1 replaces `runtimeStep`'s `dt` clamp; `sim_t` is `G.t`,
  `view_t` is `G.vt`, and the pause is still "a frozen clock, not a state"
  (`code.pause`). `rule.sim.pause-wall-clock` becomes `Time.get_ticks_usec()`.
- `code.player-geometry`'s `sweptHit` carries over unchanged and is the reason
  a variable render step is safe.
- No physics nodes, no `Area2D`, no `PhysicsServer2D` (§5). `tune.hit-tol`'s
  `18.5*u / radiusOf(ring)` is the entire collision system.
- The shard table is `ShardTable` from §5, with the swap-remove caveat honoured
  against `code.update-spikes`' contact ordering (labGhost → hypernova → shield
  → die), which must not be disturbed by index shuffling.

### The HUD and front screens — `code.draw-hud`, `code.front-screens`, `code.hud-buttons`

These are the one place to use ordinary nodes and `_draw()`. They are static
between events, they need text layout and hit-testing, and there are tens of
elements, not hundreds. Use `Control` nodes and `queue_redraw()`; do not
hand-roll canvas items for a pause button. Build HUD strings on change, not per
frame (§6).

### Assets — `tune.sky-art-worlds`, `code.boundary.textures`

Eight painted backdrops, and `code.boundary.textures` already establishes that
"every runtime art lookup treats null as draw the procedural version". Keep at
most two sky plates resident (§9), lean on the procedural fallback on
memory-constrained devices, and put the gameplay sprites in one Lossless atlas.

### Tooling

`docs/harnesses.md` and the `check.*` records describe harnesses that run the
JavaScript runtime in a VM with a fake canvas — `code.boundary.legacy-standalone-path`
and the whole `tools/lib/game-source.mjs` extraction are `obsolete` under the
Godot decision. The performance-relevant replacements worth building early,
because they are cheap and they are what stops this document from decaying:

- A headless scene that runs a scripted 60-second run and asserts a median
  frame interval on the CI machine — not a pass/fail on a phone, but a
  regression tripwire.
- An assertion that `Performance.PIPELINE_COMPILATIONS_CANVAS` is flat after
  the warm-up frame.
- An assertion that canvas draw calls per frame stay under a named budget, via
  `viewport_get_render_info(..., VIEWPORT_RENDER_INFO_TYPE_CANVAS, ...)`. This
  is the one that catches "somebody added a `draw_polyline` in the middle of
  the sprite band" the day it happens rather than the week before ship.

---

## Sources

Godot documentation (stable = 4.7 at time of writing):

- Optimization using Servers — https://docs.godotengine.org/en/stable/tutorials/performance/using_servers.html
- Optimization using MultiMeshes — https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html
- CPU optimization — https://docs.godotengine.org/en/stable/tutorials/performance/cpu_optimization.html
- GPU optimization — https://docs.godotengine.org/en/stable/tutorials/performance/gpu_optimization.html
- General optimization tips — https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html
- Reducing stutter from shader (pipeline) compilations — https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html
- Thread-safe APIs — https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html
- Renderers — https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html
- Multiple resolutions (stretch mode, stretch scale) — https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
- Fixing jitter, stutter and input lag — https://docs.godotengine.org/en/stable/tutorials/rendering/jitter_stutter.html
- Using physics interpolation — https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/using_physics_interpolation.html
- Importing images (compression modes, memory table) — https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html
- Static typing in GDScript — https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- The Profiler — https://docs.godotengine.org/en/stable/tutorials/scripting/debug/the_profiler.html
- Custom performance monitors — https://docs.godotengine.org/en/stable/tutorials/scripting/debug/custom_performance_monitors.html
- Particle systems (2D) — https://docs.godotengine.org/en/stable/tutorials/2d/particle_systems_2d.html

Class reference (4.7):

- RenderingServer — https://docs.godotengine.org/en/stable/classes/class_renderingserver.html
- PhysicsServer2D — https://docs.godotengine.org/en/stable/classes/class_physicsserver2d.html
- MultiMesh — https://docs.godotengine.org/en/stable/classes/class_multimesh.html
- MultiMeshInstance2D — https://docs.godotengine.org/en/stable/classes/class_multimeshinstance2d.html
- CanvasItem — https://docs.godotengine.org/en/stable/classes/class_canvasitem.html
- Node — https://docs.godotengine.org/en/stable/classes/class_node.html
- Engine — https://docs.godotengine.org/en/stable/classes/class_engine.html
- Performance — https://docs.godotengine.org/en/stable/classes/class_performance.html
- PackedVector2Array — https://docs.godotengine.org/en/stable/classes/class_packedvector2array.html
- PackedFloat32Array — https://docs.godotengine.org/en/stable/classes/class_packedfloat32array.html
- Window — https://docs.godotengine.org/en/stable/classes/class_window.html
- Viewport — https://docs.godotengine.org/en/stable/classes/class_viewport.html
- Environment — https://docs.godotengine.org/en/stable/classes/class_environment.html
- ProjectSettings — https://docs.godotengine.org/en/stable/classes/class_projectsettings.html
- RID — https://docs.godotengine.org/en/stable/classes/class_rid.html
- Resource — https://docs.godotengine.org/en/stable/classes/class_resource.html

Engine source, tag `4.7-stable` (used where the documentation is silent):

- Version — https://github.com/godotengine/godot/blob/4.7-stable/version.py
- Canvas batching, Forward+/Mobile — https://github.com/godotengine/godot/blob/4.7-stable/servers/rendering/renderer_rd/renderer_canvas_render_rd.cpp
- Canvas batching, Compatibility — https://github.com/godotengine/godot/blob/4.7-stable/drivers/gles3/rasterizer_canvas_gles3.cpp
- MultiMesh 2D buffer layout and the readback in `_multimesh_make_local` — https://github.com/godotengine/godot/blob/4.7-stable/servers/rendering/renderer_rd/storage_rd/mesh_storage.cpp
- The same readback in the Compatibility backend — https://github.com/godotengine/godot/blob/4.7-stable/drivers/gles3/storage/mesh_storage.cpp
- `range()` loop optimisation — https://github.com/godotengine/godot/blob/4.7-stable/modules/gdscript/gdscript_compiler.cpp

Release information:

- Godot 4.7 release announcement — https://godotengine.org/releases/4.7/
- Godot 4.4 release announcement (physics interpolation history) — https://godotengine.org/releases/4.4/
- Release policy — https://docs.godotengine.org/en/stable/about/release_policy.html

Cosmo records cited throughout: `code.draw`, `code.bloom`, `code.fx-chain`,
`code.gl-sky`, `code.sky-director`, `code.sprite-bake`, `code.artifact-sprites`,
`code.arena-projection`, `code.arena-decor`, `code.arena-geometry`,
`code.update`, `code.update-spikes`, `code.player-geometry`, `code.pause`,
`code.fx-primitives`, `code.tail`, `code.draw-hud`, `code.front-screens`,
`code.boundary.resize`, `code.boundary.textures`,
`code.boundary.legacy-standalone-path`, `tune.starfield`, `tune.shard-cap`,
`tune.hit-tol`, `tune.bloom`, `tune.halo`, `tune.gl-scale`,
`tune.sky-art-worlds`, `rule.gfx.shared-geometry`,
`rule.gfx.sky-controls-readability`, `rule.gfx.bounded-event-envelopes`,
`rule.sim.pause-wall-clock`, `check.gfx.glow-pipeline`,
`db/notes/code/clocks.md`, `db/notes/code/render-pipeline.md`.
