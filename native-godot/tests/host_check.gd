extends SceneTree
const Geometry = preload("res://scripts/orbit_geometry.gd")
const Gestures = preload("res://scripts/gestures.gd")
const Simulation = preload("res://scripts/simulation.gd")
var failures: Array[String] = []
var turns = 0
var hops: Array[int] = []
var starts = 0
var reversions = 0
var ambiguous = 0
var events: Array[StringName] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)
		push_error(label)

func _run() -> void:
	var input = Gestures.new()
	input.turned.connect(func(): turns += 1)
	input.started.connect(func(): starts += 1)
	input.reverted.connect(func(): reversions += 1)
	input.unresolved.connect(func(): ambiguous += 1)
	input.hopped.connect(func(direction): hops.append(direction))
	input.mode = "screen"
	input.begin(0, Vector2(200, 600), Vector2(270, 480))
	input.end(0, Vector2(201, 602))
	check(turns == 1 and hops.is_empty(), "tap commits exactly one turn")
	input.begin(0, Vector2(200, 600), Vector2(270, 480))
	input.tick(0.8)
	input.motion(0, Vector2(200, 650))
	input.end(0, Vector2(200, 650))
	check(turns == 1 and hops == [1], "late swipe never produces a false reversal")
	check(starts == 2 and reversions == 1, "press starts immediately and only a proven swipe rolls back")
	input.begin(0, Vector2(200, 600), Vector2(270, 480))
	input.begin(1, Vector2(200, 300), Vector2(270, 480))
	input.end(1, Vector2(200, 300))
	input.cancel()
	check(turns == 1, "second finger and cancellation are silent")
	input.mode = "radial"
	input.begin(0, Vector2(270, 700), Vector2(270, 480))
	input.motion(0, Vector2(270, 640))
	input.end(0, Vector2(270, 640))
	check(hops == [1, 1], "radial inward maps to higher lane index")
	# The finger can be on the opposite side of the arena from the comet.
	input.begin(0, Vector2(270, 700), Vector2(270, 480), Vector2(270, 200))
	input.motion(0, Vector2(270, 740))
	check(hops == [1, 1, 1], "radial direction comes from the comet at press, not finger position")
	input.mode = "screen"
	input.begin(0, Vector2.ZERO, Vector2.ZERO)
	input.motion(0, Vector2(40, 0))
	input.end(0, Vector2(20, 3))
	check(hops == [1, 1, 1, 1], "ambiguous motion can resolve at lift with eighteen pixels and twelve percent lean")
	input.begin(0, Vector2.ZERO, Vector2.ZERO)
	input.motion(0, Vector2(40, 0))
	input.end(0, Vector2(2, 2))
	check(hops.size() == 4 and ambiguous == 1, "returning near the start cannot commit an abandoned swipe")
	input.begin(0, Vector2.ZERO, Vector2.ZERO)
	input.motion(0, Vector2(40, 6))
	input.end(0, Vector2(1000, -1000), true)
	check(hops == [1, 1, 1, 1, 1], "pointer cancellation uses the last trustworthy swipe coordinates")
	# Full gesture-to-simulation path: immediate movement, deferred feedback,
	# exact lap restoration, and no speculative rhythm reward or saucer charge.
	var control = Gestures.new()
	var sim = Simulation.new()
	sim.begin(2)
	for obj in sim.objects:
		obj.active = false
	control.started.connect(sim.begin_pointer_turn)
	control.reverted.connect(sim.rollback_pointer_turn)
	control.turned.connect(sim.commit_pointer_turn)
	control.canceled.connect(sim.cancel_pointer_turn)
	control.hopped.connect(sim.hop)
	sim.event.connect(func(kind): events.append(kind))
	sim.lap = 2.3
	sim.streak = 4
	var saucer = sim.spawn_hazard("saucer", sim.angle, 0, 0.0)
	saucer.warn = 0.0
	saucer.age = 0.1
	control.begin(0, Vector2.ZERO, sim.geometry.center, sim.geometry.orbit(sim.angle, sim.lane))
	check(sim.direction == -1.0 and sim.lap == 0.0 and sim.streak == 0, "pointer-down reverses immediately and starts the scoring lap over")
	control.tick(0.8)
	check(events.is_empty() and sim.heat == 0.0 and sim.score == 0 and saucer.fire_time < 0.0, "held press has no sound, rhythm reward or saucer commitment")
	control.motion(0, Vector2(40, 0))
	check(sim.direction == 1.0 and sim.lap == 2.3 and sim.streak == 4 and events.is_empty() and not sim.pointer_turn_pending, "proven swipe silently restores direction and exact lap state")
	control.end(0, Vector2(40, 6))
	check(events == [&"hop"] and sim.target_lane == 1 and saucer.fire_time < 0.0, "resolved swipe commits only its hop")
	events.clear()
	control.begin(0, Vector2.ZERO, sim.geometry.center, sim.geometry.orbit(sim.angle, sim.lane))
	check(sim.direction == -1.0 and events.is_empty(), "next tap also responds before release")
	control.end(0, Vector2.ONE)
	check(sim.direction == -1.0 and events == [&"turn"] and saucer.fire_time > 0.0, "tap lift commits feedback and saucer once without a second reversal")
	events.clear()
	sim.hop(-1)
	check(sim.target_lane == 1 and events.is_empty(), "a second swipe cannot redirect an unfinished hop")
	sim.hop_progress = 1.0
	sim.target_lane = 0
	sim.lane = 0.0
	sim.time += 0.3
	var held_lap = sim.lap
	var held_streak = sim.streak
	var heat_before = sim.heat
	sim.hop(-1)
	check(events == [&"bump"] and sim.target_lane == 0 and sim.lap == held_lap and sim.streak == held_streak and sim.heat > heat_before, "edge swipe acknowledges and plays without spending lap or changing lane")
	check(is_equal_approx(Geometry.swept_distance(Vector3(-30, 0, 0), Vector3(30, 0, 0)), 0.0), "sweep catches skipped midpoint")
	check(Geometry.swept_distance(Vector3(-30, 0, 100), Vector3(30, 0, 100)) > 90.0, "depth-separated threats cannot collide")
	var scene = load("res://scenes/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.automated = true
	scene.auto_duration = 1000.0
	scene._start(0, true)
	await physics_frame
	check(scene.mode == "play" and scene.sim.tutorial == 0, "native scene starts playable teaching")
	var original_direction = scene.sim.direction
	var press = InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(270, 480)
	press.global_position = press.position
	Input.parse_input_event(press)
	await process_frame
	check(scene.sim.direction == -original_direction and scene.sim.tutorial == 0, "actual Godot pointer-down moves immediately while tutorial feedback waits")
	var release = press.duplicate()
	release.pressed = false
	Input.parse_input_event(release)
	await process_frame
	check(scene.sim.direction == -original_direction and scene.sim.tutorial == 1, "actual Godot release commits the turn and advances lesson")
	scene._pause()
	var time_before = scene.sim.time
	var visual_before = scene.sim.visual_time
	await create_timer(0.08).timeout
	check(scene.sim.time == time_before and scene.sim.visual_time == visual_before, "pause freezes game and world clock")
	check(scene.gestures.finger == -1, "pause releases held gestures")
	scene._resume()
	await physics_frame
	check(scene.mode == "resume" and scene.sim.time == time_before, "resume count-in keeps world frozen")
	scene._process(3.01)
	await physics_frame
	await physics_frame
	check(scene.sim.time > time_before, "explicit resume advances simulation")
	scene._pause()
	check(scene.mode == "play", "pause requires five active seconds before rearming")
	scene._pause(true)
	check(scene.mode == "pause", "focus-loss pause bypasses manual cooldown")
	scene._show_lab()
	scene._start_lab("spot")
	check(scene.sim.lab and scene.profile.lab_active and scene.sim.has_power("spot"), "native power lab uses actual Magnet")
	scene._menu()
	check(not scene.profile.lab_active and not scene.sim.running, "lab exit restores profile and stops simulation")
	scene.queue_free()
	await process_frame
	await create_timer(0.15).timeout
	print(JSON.stringify({"host_checks": "passed" if failures.is_empty() else "failed", "failures": failures}))
	quit(0 if failures.is_empty() else 1)
