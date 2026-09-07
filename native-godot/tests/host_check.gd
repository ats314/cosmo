extends SceneTree
const Geometry = preload("res://scripts/orbit_geometry.gd")
const Gestures = preload("res://scripts/gestures.gd")
var failures: Array[String] = []
var turns = 0
var hops: Array[int] = []

func _initialize() -> void:
	call_deferred("_run")

func check(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)
		push_error(label)

func _run() -> void:
	var input = Gestures.new()
	input.turned.connect(func(): turns += 1)
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
	var release = press.duplicate()
	release.pressed = false
	Input.parse_input_event(release)
	await process_frame
	check(scene.sim.direction == -original_direction and scene.sim.tutorial == 1, "actual Godot input dispatch reverses comet and advances lesson")
	scene._pause()
	var time_before = scene.sim.time
	var visual_before = scene.sim.visual_time
	await create_timer(0.08).timeout
	check(scene.sim.time == time_before and scene.sim.visual_time == visual_before, "pause freezes game and world clock")
	check(scene.gestures.finger == -1, "pause releases held gestures")
	scene._resume()
	await physics_frame
	await physics_frame
	check(scene.sim.time > time_before, "explicit resume advances simulation")
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
