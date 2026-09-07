# Threading, loading and the frame budget

> How to do work in Godot 4 without dropping a frame: what may leave the main
> thread, what must come back to it, how resources load in the background, and
> how to spend an explicit budget per frame. Written against **Godot 4.7.2**
> (stable, released 18 August 2026 — the version `docs.godotengine.org/en/stable`
> currently documents).

---

## The short version

- **The scene tree is single-threaded. The servers are not.** Anything that
  touches nodes, adds children, or changes node properties happens on the main
  thread or via `call_deferred`. Pure computation, `Image` pixel work, parsing,
  pathfinding over your own data, and `ResourceLoader` may leave it.
- **`WorkerThreadPool` is the default answer**, not `Thread`. The pool already
  exists at startup; creating a `Thread` costs milliseconds, especially on
  Windows. Reach for `Thread` + `Semaphore` only for a *long-lived* worker that
  must stay alive across the run.
- **Every pool task must be waited for exactly once** —
  `wait_for_task_completion()` / `wait_for_group_task_completion()` — even after
  `is_task_completed()` has already returned `true`. That call is what frees the
  task's allocation.
- **Results come back with `Callable.call_deferred()`**, not by touching nodes
  from the worker. Deferred calls flush at the end of process and physics
  frames.
- **Load with `ResourceLoader.load_threaded_request()`**, poll
  `load_threaded_get_status()` **once per frame**, and only call
  `load_threaded_get()` when the status says `THREAD_LOAD_LOADED` — otherwise it
  blocks exactly like `load()`.
- **Slice long work by microseconds, not by item count.** `Time.get_ticks_usec()`
  plus `await get_tree().process_frame`. A fixed "N per frame" is a budget in the
  wrong unit and it will be wrong on the next device.
- **On the web export none of the threading is real.** Since 4.3 the default web
  build has no threads: `Thread.start()` is a silent no-op and `WorkerThreadPool`
  runs your task *synchronously inside `add_task()`*. Code written for threads
  still "works" there — it just blocks. Plan for that; do not discover it.

---

## 1. Four execution contexts, and which of them you actually get

Godot 4 runs more than one thread whether you ask for it or not. Knowing which
piece of code is on which one is most of the battle.

| Context | Runs | Rules |
|---|---|---|
| **Main thread** | `_process`, `_physics_process`, signals, input, the scene tree, the `MessageQueue` flush | The only place the scene tree may be touched |
| **Rendering thread** | The `RenderingServer` command buffer, when the *Rendering > Threads > Thread Model* project setting is `Multi-Threaded` | You reach it with `RenderingServer.call_on_render_thread()`, not directly |
| **`WorkerThreadPool` workers** | Whatever you `add_task()`, plus engine-internal work including threaded resource loading | No scene tree, no node properties, no `await` |
| **Threads you start** | `Thread.start(callable)` | Same rules as pool workers, plus you own the join |

Two consequences worth internalising:

1. `ResourceLoader`'s background loading is not a private thread — it submits to
   `WorkerThreadPool`. `resource_loader.cpp` calls
   `WorkerThreadPool::get_singleton()->add_native_task(&ResourceLoader::_run_load_task, …)`.
   Your own pool tasks and the engine's loads share the same workers. Saturating
   the pool with your work delays loads, and vice versa.
2. The pool's size comes from `threading/worker_pool/max_threads` (default `-1`,
   meaning the OS default) with `threading/worker_pool/low_priority_thread_ratio`
   (default `0.3`) reserving capacity so low-priority work cannot starve
   high-priority work.

### What is and is not thread-safe

Straight from the thread-safety reference, because this is the list people get
wrong:

- **Scene tree: not thread-safe.** Not for reads either. Use `call_deferred()` or
  `set_deferred()` to reach it from a thread.
- **Building a scene chunk *outside* the tree from a thread is fine**, then
  `add_child.call_deferred(node)` on the main thread. This is the sanctioned
  pattern for "instantiate while the player is still playing".
- **Most global singletons/servers are thread-safe**, but *instancing nodes that
  render* is not, unless *Rendering > Threads > Thread Model* is set to
  `Multi-Threaded` — which the docs themselves say "has several known bugs, so
  it may not be usable in all scenarios". Treat that setting as unavailable.
- **GDScript `Array` and `Dictionary`: reading and writing existing elements
  across threads is safe; anything that changes the container's size is not.**
  This is the single most useful sentence on the whole thread-safety page: size
  your output array on the main thread, then let N workers write disjoint indices
  with no mutex at all.
- **Resources: loading from threads is supported. Mutating the same resource from
  two threads is not.**
- **`AStar2D` / `AStar3D` / `AStarGrid2D` are not thread-safe** — one instance per
  thread.
- **Avoid GPU operations off the main thread** (texture creation, reading image
  data back): they force a synchronisation stall with the `RenderingServer`.
  `Image` is CPU-side and safe; `ImageTexture` is a GPU object and belongs on the
  main thread.

---

## 2. `WorkerThreadPool`: the default answer

The pool is allocated at engine startup, so submitting to it costs nothing like
creating a thread does. It is also the API almost no tutorial reaches for — the
*Using multiple threads* page in the 4.7 manual documents `Thread`, `Mutex` and
`Semaphore` and never mentions `WorkerThreadPool` at all. The class reference is
the only documentation there is.

### The parallel-bake shape

`add_group_task()` calls one `Callable` `elements` times, passing `0 … elements-1`
as its argument, spread across workers. Combined with the array rule above —
element writes safe, resizes not — you get a lock-free fan-out:

```gdscript
class_name HaloBaker
extends RefCounted

# HaloSpec is your own Resource/RefCounted describing one sprite to bake.
var _specs: Array[HaloSpec] = []
var _images: Array[Image] = []

## Blocking form: for a load screen, where a long frame is expected.
func bake_all(specs: Array[HaloSpec]) -> Array[ImageTexture]:
    _specs = specs
    _images.resize(specs.size())          # sized here, on one thread, once

    var group_id := WorkerThreadPool.add_group_task(
        _bake_one, specs.size(), -1, true, "cosmo: halo bake")
    WorkerThreadPool.wait_for_group_task_completion(group_id)

    var textures: Array[ImageTexture] = []
    for image in _images:
        textures.append(ImageTexture.create_from_image(image))  # main thread only
    return textures

## Runs on a worker. Writes one slot; never resizes the array.
func _bake_one(index: int) -> void:
    _images[index] = _specs[index].render_to_image()
```

The upload stays on the main thread deliberately. `Image` work is pure CPU and
parallelises; `ImageTexture.create_from_image()` is a GPU allocation, and the
thread-safety page tells you creating textures off-thread stalls against the
rendering server.

### The non-blocking shape

For work that must not stall the frame, submit and poll. Note that
`wait_for_task_completion()` is still called — it returns immediately once the
task is done, and it is what releases the task's resources:

```gdscript
extends Node

var _task_id: int = -1
var _result: PackedFloat32Array

func begin_analysis(source: PackedFloat32Array) -> void:
    _result = PackedFloat32Array()
    _task_id = WorkerThreadPool.add_task(
        _analyse.bind(source), false, "cosmo: spectrum")

func _process(_delta: float) -> void:
    if _task_id != -1 and WorkerThreadPool.is_task_completed(_task_id):
        WorkerThreadPool.wait_for_task_completion(_task_id)  # required; returns now
        _task_id = -1
        _on_analysis_ready()

func _analyse(source: PackedFloat32Array) -> void:
    _result = _expensive_transform(source)   # worker thread; touches no nodes
```

### Getting an answer back without polling

`Callable.call_deferred()` from inside the task is usually cleaner than a poll
loop, because the continuation lands on the main thread at a well-defined point:

```gdscript
func _analyse(source: PackedFloat32Array) -> void:
    var spectrum := _expensive_transform(source)
    _publish.call_deferred(spectrum)          # queued; runs on the main thread

func _publish(spectrum: PackedFloat32Array) -> void:
    _result = spectrum
    spectrum_ready.emit()
```

You still owe the pool a `wait_for_task_completion()` for that task id. Do it in
`_publish` (the task has necessarily finished its callable body by the time the
deferred call runs) or in a sweep in `_process`.

### When *not* to use the pool

The class reference is blunt: "Using this singleton could affect performance
negatively if the task being distributed between threads is not computationally
expensive." A task that takes 40µs is dominated by queueing, the pool mutex and
cache traffic. The practical threshold is around "a millisecond of real work per
task"; below that, do it inline or batch it into fewer, larger tasks.

---

## 3. `Thread`, `Mutex`, `Semaphore` — still the right tool sometimes

`WorkerThreadPool` tasks are fire-and-forget units. When you need a worker that
*lives* — one that owns a queue, sleeps when idle, and persists across a whole
run — a real `Thread` with a `Semaphore` is correct, and using the pool for it is
actively wrong: a task that never returns permanently occupies a worker, and the
pool's own internal "pump task" handling exists precisely because that starves
everything else.

```gdscript
extends Node

var _thread: Thread
var _sem: Semaphore
var _mutex: Mutex
var _queue: Array = []          # of Callable
var _quitting := false

func _ready() -> void:
    if not OS.has_feature("threads"):
        return                                   # see the web section
    _sem = Semaphore.new()
    _mutex = Mutex.new()
    _thread = Thread.new()
    _thread.start(_run)

func submit(job: Callable) -> void:
    if _thread == null:
        job.call()                               # no threads: run it inline (§8)
        return
    _mutex.lock()
    _queue.push_back(job)
    _mutex.unlock()
    _sem.post()

func _run() -> void:
    while true:
        _sem.wait()                              # sleeps; costs nothing
        _mutex.lock()
        var quitting := _quitting
        var job: Callable = Callable()
        if not _queue.is_empty():
            job = _queue.pop_front()
        _mutex.unlock()
        if quitting:
            return
        if job.is_valid():
            job.call()                           # the job defers its own result

func _exit_tree() -> void:
    if _thread == null:
        return
    _mutex.lock()
    _quitting = true
    _mutex.unlock()
    _sem.post()                                  # wake it so it can see the flag
    _thread.wait_to_finish()                     # non-negotiable
```

Details that matter:

- **`wait_to_finish()` is mandatory**, and it is a *join*, not a kill. There is no
  way to cancel a Godot thread; you cooperate with a flag, as above. A `Thread`
  whose refcount reaches zero while started, while holding a mutex, or while
  waiting on a semaphore is a crash.
- **Godot's `Mutex` is reentrant** — "it can be locked multiple times by one
  thread, provided it also unlocks it as many times". That differs from a bare
  `std::mutex` and from most people's assumption. `try_lock()` returns `true` if
  the calling thread already owns it. Convenient, and a good way to hide a
  double-lock bug from yourself.
- **`Semaphore.post(count: int = 1)`** can wake several waiters at once; it is
  initialised to zero, and `try_wait()` is the non-blocking form.
- **Mutex cost is real.** The manual's own warning: "locking and unlocking of
  mutexes can also be an expensive operation… avoid locking too often (or for too
  long)." Copy a snapshot out under the lock and work on the copy, as the example
  does with `quitting` and `job`.
- **Creating threads is slow, especially on Windows.** Create them at load, not
  when the work arrives.

---

## 4. `call_deferred`, `set_deferred`, and the queue behind them

These exist for exactly one reason: there are moments in a frame when mutating an
object is unsafe — from another thread, or from inside a signal or physics
callback that is currently iterating the thing you want to change. Both push a
message onto the engine's `MessageQueue`, which is flushed on the main thread.

```gdscript
# Modern form: a Callable already knows its object and method.
_spawn_formation.call_deferred(tier, ring)
node.add_child.call_deferred(child)
node.set_deferred(&"visible", true)

# Godot 3 / early-4 form. Still works, but stringly-typed and unchecked.
call_deferred("_spawn_formation", tier, ring)
```

What the reference actually guarantees: `call_deferred()` "calls the method on
the object during idle time", and "idle time happens mainly at the end of process
and physics frames". It **always returns `null`, not the method's result**.

Pitfalls, in the order they bite:

- **Deferring a method from itself is infinite recursion**, exactly as if you had
  called it directly. The docs call this out explicitly.
- **The queue is finite.** `memory/limits/message_queue/max_size_mb` (default 32).
  Overflow prints `Message queue out of memory` and *drops* the call — a silently
  skipped update, not a crash. Anything that defers per-object per-frame across
  hundreds of objects is how you get there. Defer one batch, not N items.
- **Deferred is not "next frame".** It is the next flush, which may be the end of
  the *current* process frame. Do not use it as a one-frame delay; use
  `await get_tree().process_frame` for that.
- **Ordering is queue order**, so two deferred calls to the same object run in
  submission order, but they are not ordered against signals emitted later in the
  frame. Do not build a protocol on that.

`set_deferred()` is the property form and is the correct way to change a node
property from a worker: `sprite.set_deferred(&"texture", tex)`.

---

## 5. Threaded resource loading

`ResourceLoader.load()` (and GDScript's `load()`) blocks. The background API is
three calls:

```gdscript
Error  load_threaded_request(path: String, type_hint: String = "",
                             use_sub_threads: bool = false,
                             cache_mode: CacheMode = 1)          # CACHE_MODE_REUSE
ThreadLoadStatus load_threaded_get_status(path: String, progress: Array = [])
Resource load_threaded_get(path: String)
```

`ThreadLoadStatus` is `THREAD_LOAD_INVALID_RESOURCE` (0),
`THREAD_LOAD_IN_PROGRESS` (1), `THREAD_LOAD_FAILED` (2), `THREAD_LOAD_LOADED` (3).

A small typed driver that reports progress and never blocks:

```gdscript
class_name BackgroundLoad
extends RefCounted

signal progressed(ratio: float)
signal loaded(resource: Resource)
signal failed(path: String)

var _path := ""
var _live := false

func start(path: String) -> Error:
    _path = path
    var err := ResourceLoader.load_threaded_request(
        path, "", false, ResourceLoader.CACHE_MODE_REUSE)
    _live = err == OK
    return err

## Call at most once per process frame. Returns true when finished.
func poll() -> bool:
    if not _live:
        return true
    var progress: Array = []
    var status := ResourceLoader.load_threaded_get_status(_path, progress)
    match status:
        ResourceLoader.THREAD_LOAD_IN_PROGRESS:
            progressed.emit(float(progress[0]) if not progress.is_empty() else 0.0)
            return false
        ResourceLoader.THREAD_LOAD_LOADED:
            _live = false
            loaded.emit(ResourceLoader.load_threaded_get(_path))
            return true
        _:
            _live = false
            failed.emit(_path)
            return true
```

Things the tutorial page does not tell you:

- **`load_threaded_get()` blocks if the load has not finished.** At that point it
  is `load()` with extra steps. Gate it on the status, always.
- **Poll once per frame.** Reading `resource_loader.cpp`,
  `load_threaded_get_status` notices when the main thread polls the same task
  twice within one `Engine.get_process_frames()` value and treats that as a
  busy-wait, forcing progress — the code comments it "Support userland polling in
  a loop on the main thread." So a tight `while` loop terminates rather than
  deadlocking. It is also a frozen frame, which is the thing you were trying to
  avoid.
- **`use_sub_threads = true` recursively parallelises a load's dependencies.** The
  class reference warns it may cause in-game slowdowns — it lets one load
  saturate the whole worker pool. Leave it `false` for anything loaded during
  play; consider it only on a dedicated loading screen.
- **`CacheMode`:** `IGNORE` (0), `REUSE` (1, default), `REPLACE` (2), and the
  recursive variants `IGNORE_DEEP` (3) and `REPLACE_DEEP` (4). **The `*_DEEP`
  modes are 4.3+.** `REUSE` means a second request for an already-loaded path
  returns from the cache, which is what makes "request everything early, retrieve
  lazily" cheap.
- **Pair every request with exactly one retrieve.** The loader holds a user token
  per outstanding request until `load_threaded_get()` collects it; fire-and-forget
  requests are a slow leak. (Read from source, not documented — treat this as a
  discipline rather than a guarantee.)
- **Swap scenes with `change_scene_to_packed(packed_scene)`**, never
  `change_scene_to_file(path)`, if you care about the hitch: the file variant
  loads synchronously. Either way the swap itself is deferred — the old scene
  leaves the tree immediately and the new one is added at the end of the frame.

---

## 6. `await`, and what the process frame actually is

`await` replaces Godot 3's `yield`. It suspends the calling function until a
signal fires or an awaited coroutine returns, and hands control back to the
caller immediately.

```gdscript
await get_tree().process_frame     # resume just before _process runs next frame
await get_tree().physics_frame     # resume just before _physics_process
await get_tree().create_timer(0.25).timeout
```

`process_frame` is "emitted immediately before `Node._process()` is called on
every node in this tree" — so a function that awaits it resumes *before* the
frame's normal processing, not after it. That is the right place to resume
amortised work: it runs ahead of the frame's real work and can therefore be cut
short by that frame's budget check.

Rules:

- **`await` is not a thread.** It yields to the main loop; the work still runs on
  the main thread when it resumes. It hides latency, never cost.
- **Do not `await` on a worker thread.** Coroutine resumption is driven by signal
  emission on the main thread, and the engine documents no thread contract for
  GDScript function state. Treat `await` as main-thread-only. (The docs are silent
  here; this is a discipline, not a cited rule.)
- **Awaiting inside `_ready()` is fine**, but the node counts as ready from the
  tree's point of view the moment the coroutine suspends. Anything that depends on
  the rest of `_ready` having run must not assume it has.
- **`await` on something that is neither a signal nor a coroutine** returns the
  value immediately and emits a runtime warning. Static typing will not catch it.

---

## 7. Spending an explicit frame budget

At 60fps you have 16.67ms per frame and you do not own all of it. The only honest
way to amortise work is a **deadline in microseconds**, re-armed each frame:

```gdscript
class_name FrameBudget
extends RefCounted

var _deadline: int = 0

func open(usec: int) -> void:
    _deadline = Time.get_ticks_usec() + usec

func spent() -> bool:
    return Time.get_ticks_usec() >= _deadline
```

```gdscript
## On a Node, because it needs get_tree().
## Pre-warm every sprite a level can spawn, over as many frames as it takes.
func prewarm(kinds: Array[StringName], usec_per_frame := 2000) -> void:
    var budget := FrameBudget.new()
    budget.open(usec_per_frame)
    for kind in kinds:
        _bake_kind(kind)                  # one unit of work, never split further
        if budget.spent():
            await get_tree().process_frame
            budget.open(usec_per_frame)
```

Why a deadline and not "N per frame":

- The cost of one unit is not constant across kinds, devices, or thermal states.
  A count that is right on a desktop is a 40ms frame on a throttled phone.
- A deadline degrades gracefully: on a slow device the same work simply takes more
  frames. A count does not degrade, it just misses.
- It composes. Two independent amortised jobs can share one budget object and the
  total stays bounded; two "N per frame" jobs add up and nobody notices.

Choose the granularity so that **one unit fits inside the budget**. The check
happens *after* the unit, so a 12ms unit blows a 2ms budget no matter what the
loop says. If a unit is too big, split the unit — do not lower the budget.

### Measuring honestly

- `Engine.get_frames_per_second()` returns an *average*. A single 40ms frame
  inside a second of 60fps barely moves it, and a single 40ms frame is exactly the
  thing a player feels. Measure with `Time.get_ticks_usec()` deltas and record the
  **maximum**, not the mean.
- `Time.get_ticks_usec()` is monotonic microseconds since engine start, 64-bit. It
  is the right clock for this.
- `Engine.get_process_frames()` increments per process frame regardless of whether
  rendering happened — useful as a "have I already done this frame's work?" guard.
- Do amortised work in `_process`, not `_physics_process`: physics can run several
  times in one rendered frame when catching up, which silently multiplies your
  budget.

### The other frame-time cliff: pipeline compilation

Not all hitching is your code. The first time a material or shader variant is
actually drawn, the GPU driver compiles a pipeline, and that shows as a stall.
Godot's mitigations, both version-gated:

- **Ubershaders (4.4+)** precompile one general pipeline using specialization
  constants and compile the optimised variants in the background during play.
- **Shader Baker (4.5+)**, an export option, bundles pre-compiled shader code into
  the PCK so the compilation step is skipped entirely. It supports **Forward+ and
  Mobile only — not Compatibility** — on Windows (Vulkan/D3D12), macOS
  (Vulkan/Metal), Linux (Vulkan) and Android (Vulkan). **Not supported on web.**
- The universal fallback still works: render every material once, off-camera or
  invisible, during loading.

---

## 8. The web export, where most of this stops being true

This is the section that will cost a day if it is skipped.

Since **Godot 4.3 the default web export has no threads**, because
`SharedArrayBuffer` requires full cross-origin isolation. A threaded web build
requires the server to send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

…which breaks embedding, third-party requests and several hosts. Godot 4.3 also
added an *Ensure Cross-Origin Isolation Headers* export option that injects those
headers through a PWA service worker when the server will not.

**What a no-threads build actually does with your threading code** — read from the
4.7 source, because the manual does not say:

- `main.cpp` initialises the pool with **zero threads** on a build without thread
  support: `WorkerThreadPool::get_singleton()->init(0, 0);`, inside the `#else` of
  `#ifdef THREADS_ENABLED`.
- With no workers, `WorkerThreadPool::_post_tasks()` takes the branch commented
  *"Fall back to processing on the calling thread if there are no worker
  threads."* and calls `_process_task()` inline. **`WorkerThreadPool.add_task()`
  therefore runs your callable to completion before it returns.** Your code is
  correct; it is just synchronous, and `is_task_completed()` is `true`
  immediately.
- `ResourceLoader` submits loads through `WorkerThreadPool::add_native_task`, so
  **`load_threaded_request()` performs the entire load inside the request call** on
  such a build. Your progress bar goes from 0 to 100 in one frame, after a frozen
  one.
- `Thread` is worse. In `core/os/thread.h` the non-threaded build compiles
  `start()` to an **empty body** and `is_started()` to `return false`. The
  script-level `Thread.start()` returns `OK`, your function **never runs**, and
  `wait_to_finish()` then fails its own `is_started()` check with *"Thread must
  have been started to wait for its completion"*. That is a silent logic failure,
  not a crash — which is why the `OS.has_feature("threads")` guard in §3 is there.

Detect it properly. `threads` is a documented feature tag ("Running with threading
support"), and `nothreads` is its counterpart:

```gdscript
static var has_threads: bool = OS.has_feature("threads")   # static var is 4.1+
```

The design rule that follows: **write the work so it is correct when it runs
inline.** Prefer `WorkerThreadPool` (which degrades to synchronous) over `Thread`
(which degrades to nothing), keep each task small enough that running it on the
main thread is survivable, and put anything genuinely long behind a loading screen
where a synchronous run is acceptable.

One more consequence, because it reaches into audio: without threads the web build
cannot mix audio on a CPU thread, so Godot 4.3+ plays streams through Web Audio
nodes as **samples** — `audio/general/default_playback_type` defaults to `Sample`
on web and `Stream` elsewhere. Sample playback changes what a scheduler can do
with a stream mid-flight. That belongs to the audio document, but it is a
threading consequence and it is easy to discover far too late.

---

## Pitfalls

**Godot 3 idiom that will be suggested to you and is wrong here**

| Godot 3 | Godot 4.7 |
|---|---|
| `yield(get_tree(), "idle_frame")` | `await get_tree().process_frame` |
| `thread.start(self, "_method", userdata)` | `thread.start(_method.bind(userdata))` |
| `connect("done", self, "_on_done")` | `done.connect(_on_done)` |
| `ResourceInteractiveLoader` / `load_interactive()` | `ResourceLoader.load_threaded_request()` |
| `OS.get_ticks_usec()` | `Time.get_ticks_usec()` |
| `Image.create(w, h, mips, fmt)` | `Image.create_empty(w, h, mips, fmt)` — **4.3+**; `create()` is deprecated |
| `wait_to_finish()` treated as optional | Mandatory; a live `Thread` reaching refcount zero is a crash |

**Threading**

- **Forgetting `wait_for_task_completion()`** because `is_task_completed()` said
  `true`. The wait is what releases the task's resources — the class reference says
  every task must be waited for "at some point".
- **Waiting on a task from inside another task.** `wait_for_task_completion()`
  returns `ERR_BUSY` when "there's potential for deadlocking (e.g., the task to
  await may be at a lower level in the call stack and therefore can't progress)".
  Do not build task dependency graphs on the pool.
- **Resizing a shared array from a worker.** Element writes are safe; `append`,
  `resize`, `erase` are not. This is the bug that reproduces once a week, on one
  machine.
- **Touching a node "just to read a property"** from a worker. The scene tree is
  not thread-safe for reads either. Snapshot what the worker needs into plain data
  before you submit it.
- **Creating an `ImageTexture` on a worker.** It appears to work, then stalls the
  renderer or corrupts under load. Bake `Image` off-thread; upload on the main
  thread.
- **`OS.delay_msec()` on the main thread.** It is for worker threads and test
  harnesses only. It freezes the frame by definition.
- **Assuming `Mutex` is non-reentrant.** It is reentrant, so a double lock will not
  deadlock and will not tell you about your mistake — but you owe it two unlocks.

**Loading**

- Calling `load_threaded_get()` on the same frame as the request, then wondering
  why the "background" load blocked.
- Polling `load_threaded_get_status()` in a `while` loop. It terminates, and it
  freezes the frame.
- `use_sub_threads = true` during gameplay, starving the pool the rest of the game
  is sharing.
- `preload()` in a script a level loads on demand: `preload` resolves at parse
  time, so the resource is pulled in when the *script* loads, not when you meant.

**Frame budget**

- Measuring with `get_frames_per_second()` and concluding everything is fine.
- Amortising in `_physics_process`.
- Deferring per-item instead of per-batch, and overflowing the message queue.

---

## In Cosmo

Cosmo's current hitch profile is known, small, and mostly self-inflicted by
Canvas2D constraints that Godot removes outright.

### Boot: the art manifest

`BootScene` reads `public/art/manifest.json` and queues every valid texture into
Phaser's cache before `CosmoScene` starts; the runtime treats a missing texture as
"draw the procedural version" (`node db/query.mjs get code.boundary.textures`).
34 keys are declared, 26 are actually requested, 8 are loaded and never used.

For the rebuild:

- The manifest stops being a runtime JSON fetch. Godot imports the art at build
  time; the key→file table becomes a typed `Resource` so the procedural-fallback
  contract survives — `get_texture(key)` returning nothing and the game drawing
  the vector version anyway is **spec** behaviour, not a Phaser artefact.
- **Load the eight world backdrops with `load_threaded_request()` from the title
  screen**, not at boot and not at world change. They are the largest assets and
  the sky changes at ladder milestones (`tune.sky-bands`), i.e. mid-run, which is
  precisely when a synchronous load is unacceptable.
- Drop the 8 unused keys rather than porting them. They are load time and VRAM
  that nothing reads.

### The sprite bake, at startup and on resize

`buildSprites()` (`src/game/runtime.js:372`, inside the sprite cache at
`:340-616`) bakes every gameplay sprite into `SPR` whenever `u`, `DPR`, `W`, `H`
or `skyI` moves, and `resize()` (`src/game/runtime.js:617-677`) is its only
caller. The source comment measures
it: *"The 1-2ms rebake lands on the same frame as the tier banner, where a long
frame is invisible."*

Three answers, in order of preference:

1. **Make it unnecessary.** The bake exists because Canvas2D has no cheap way to
   draw a shadow-blurred shape at an arbitrary size every frame, so Cosmo caches
   one bitmap per `u + ':' + DPR` (`code.artifact-sprites`). Godot scales textures
   on the GPU for free. Bake **once, at the largest size the device will ever
   need**, and let node transforms handle `u`. That deletes the resize re-bake
   entirely, which is a better outcome than threading it. This is the single
   biggest structural win available in this subsystem.
2. **Where a bake genuinely must re-run** (a material change that cannot become a
   shader uniform), do the `Image` work as a `WorkerThreadPool.add_group_task()`
   fan-out as in §2 and upload on the main thread. 1-2ms of Canvas2D work becomes a
   few hundred microseconds across four workers, and the upload is what is left.
3. **Never bake inside the resize callback.** `Viewport.size_changed` fires during
   window and rotation changes and can fire repeatedly. Recompute the cheap
   geometry immediately — `R`, `AY`, `cy`, the safe-area box, all of
   `code.resize`'s arithmetic — and defer or debounce anything that allocates.

### The lazy per-kind bake is the real hitch

`artifactSprite(kind)` (`src/game/runtime.js:8868` onward) bakes on **first draw**
of each kind, keyed on `u + ':' + DPR`, preferring the host texture and falling
back to procedural vector art. So the first blinker, the first mirror orb and the
first black hole of a run each cost a bake in the frame they appear — which is the
same frame a formation spawned and, for the black hole, the frame the arena
re-spaces its rings (`tune.radii`).

In Godot: **pre-warm from the level's data table.** The level record already names
every formation tier and orb pool a level can produce; walk it at level load and
run the §7 budgeted `prewarm()` so the cost lands on frames the player is not being
asked to react to. Nothing should be baked for the first time during a run.

### The run itself

`code.boundary.frame-loop` clamps `dt` to 0.05s so a stalled tab cannot teleport
the simulation. Say the same thing in Godot terms as a rule: **during a run there
is no loading, no baking and no allocation of GPU objects.** Everything a level can
show is resident before the first spawn. The budgeted-slice pattern is for the
transition into a level, not for play.

The sky shader deserves its own note. Cosmo's single full-screen triangle
(`code.gl-sky`) becomes a `ShaderMaterial` on a full-screen node, and its first
draw is a pipeline compilation. Draw it once during the title screen — that is the
warm-up the pipeline-compilation page recommends — and remember **Shader Baker does
not cover the web export**, so the web build will always pay that first compile
somewhere. Put it on the title screen deliberately.

### What should *not* be threaded

- **The music scheduler.** It queues notes ahead of time against the audio clock;
  moving it off the main thread buys nothing (the `AudioServer` calls are cheap)
  and costs direct access to game state. Note that `get_output_latency()` is
  documented as expensive — cache it, do not call it per frame. The web `Sample`
  playback change in §8 matters far more to that subsystem than threading does.
- **Save data.** `code.storage-prefs` writes a handful of small keys at run end. A
  `user://` write of a few hundred bytes on the main thread is invisible; a thread
  for it is a join you have to get right at teardown, for no gain.
- **Cloud sync.** `code.cloud-sync` is already asynchronous and optional, and an
  offline game must work regardless. Keep it signal-driven and never wait on it.

### Teardown

`rule.delivery.scene-teardown` — "reloading must never leave a second game running
beside the first" — extends directly to threads. Any long-lived `Thread` must be
joined in `_exit_tree()`, any outstanding `WorkerThreadPool` task waited for, and
any in-flight `load_threaded_request` retrieved or abandoned deliberately, before
the scene is freed. This is the same class of bug as `code.boundary.scene-shutdown`'s
listener drain, and it wants the same kind of check.

---

## Sources

Godot version and release:
- https://godotengine.org/download/archive/ — 4.7.2-stable, 18 August 2026
- https://godotengine.org/releases/4.7/

Manual:
- https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html
- https://docs.godotengine.org/en/stable/tutorials/performance/using_multiple_threads.html
- https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html
- https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html
- https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html
- https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html

Class reference:
- https://docs.godotengine.org/en/stable/classes/class_workerthreadpool.html
- https://docs.godotengine.org/en/stable/classes/class_thread.html
- https://docs.godotengine.org/en/stable/classes/class_mutex.html
- https://docs.godotengine.org/en/stable/classes/class_semaphore.html
- https://docs.godotengine.org/en/stable/classes/class_object.html
- https://docs.godotengine.org/en/stable/classes/class_resourceloader.html
- https://docs.godotengine.org/en/stable/classes/class_renderingserver.html — `call_on_render_thread`, verified in `doc/classes/RenderingServer.xml` at tag `4.7-stable`
- https://docs.godotengine.org/en/stable/classes/class_scenetree.html
- https://docs.godotengine.org/en/stable/classes/class_viewport.html
- https://docs.godotengine.org/en/stable/classes/class_engine.html
- https://docs.godotengine.org/en/stable/classes/class_time.html
- https://docs.godotengine.org/en/stable/classes/class_image.html
- https://docs.godotengine.org/en/stable/classes/class_imagetexture.html
- https://docs.godotengine.org/en/stable/classes/class_audioserver.html
- https://docs.godotengine.org/en/4.2/classes/class_image.html — evidence that `create_empty` is 4.3+

Engine source, tag `4.7-stable` (for claims the manual does not make):
- https://github.com/godotengine/godot/blob/4.7-stable/main/main.cpp — `WorkerThreadPool::init(0, 0)` on non-threaded builds
- https://github.com/godotengine/godot/blob/4.7-stable/core/object/worker_thread_pool.cpp — the `_post_tasks` calling-thread fallback
- https://github.com/godotengine/godot/blob/4.7-stable/core/os/thread.h — no-op `start()` without `THREADS_ENABLED`
- https://github.com/godotengine/godot/blob/4.7-stable/core/io/resource_loader.cpp — loads submitted via `add_native_task`; main-thread polling support
- https://github.com/godotengine/godot/blob/4.7-stable/core/object/message_queue.cpp — `memory/limits/message_queue/max_size_mb`
- https://github.com/godotengine/godot/blob/4.7-stable/core/register_core_types.cpp — `threading/worker_pool/*` defaults
- https://github.com/godotengine/godot/blob/4.7-stable/platform/web/os_web.cpp — web thread-pool size

Official articles:
- https://godotengine.org/article/progress-report-web-export-in-4-3/ — single-threaded web export and Sample playback
- https://godotengine.org/article/godot-4-1-is-here/ — GDScript static variables, i.e. `static var` is 4.1+
