extends SceneTree
## Run: godot --headless --path native-godot --script res://tests/overdrive_check.gd
const S = preload("res://scripts/simulation.gd")
const BEAT = 60.0 / 104.0
var failures: Array[String] = []

func expect(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)

func quiet():
	var sim = S.new()
	sim.begin(1)
	for obj in sim.objects:
		obj.active = false
	sim.hazard_timer = 10000.0
	sim.star_timer = 10000.0
	sim.power_timer = 10000.0
	sim.teach_next = 10000.0
	return sim

func warm(sim, duration: float) -> void:
	for step in ceili(duration / 0.05):
		if step % 3 == 0:
			sim.turn()
		sim.step(0.05)

func _initialize() -> void:
	var sim = quiet()
	sim.turn()
	sim.turn()
	expect(is_equal_approx(sim.heat, 0.26), "movement heat deduplicates a sixteenth slot")
	sim.step(0.5)
	expect(is_equal_approx(sim.heat, 0.09), "engagement cools at the source rate")
	sim = quiet()
	sim.flow = 1.0
	sim.step(6.0)
	expect(sim.overdrive_eighths == 0, "visual activity and empty orbits cannot replace movement heat")
	sim = quiet()
	warm(sim, 3.0)
	expect(sim.overdrive_eighths == 0, "two-point-three-second comment cannot shorten the actual eight-beat hold")
	warm(sim, 3.0)
	expect(sim.overdrive_eighths > 0 and sim.overdrive_eighths <= 64 and sim.overdrive_cooldown > 43.0, "sustained source heat starts bounded overdrive and cooldown")
	# Boundary fixture isolates strict heat/difficulty comparisons from warm-up.
	for blocked in ["threshold", "early", "pending", "active", "rise", "blackhole", "finale", "cooldown"]:
		sim = quiet()
		sim.heat = 1.0
		sim.hot_time = BEAT * 8.0
		match blocked:
			"threshold": sim.heat = 0.75
			"early": sim.difficulty = 18.0
			"pending": sim.music_release_pending = true
			"active": sim.music_release_active = true
			"rise": sim.music_rising = true
			"blackhole": sim.black_hole = true
			"finale": sim.finish_age = 0.0
			"cooldown": sim.overdrive_cooldown = 0.01
		sim._update_overdrive(0.01)
		expect(sim.overdrive_eighths == 0, "source scheduler blocks entry during " + blocked)
	sim = quiet()
	sim.music_eighth_step(0)
	sim.heat = 1.0
	sim.hot_time = BEAT * 8.0
	sim._update_overdrive(0.01)
	expect(sim.overdrive_eighths == 64 and is_equal_approx(sim.overdrive_left, BEAT * 32.0), "duration begins at sixty-four audio eighths")
	sim.step(1.0)
	expect(sim.overdrive_eighths == 64, "external transport owns duration instead of a second timer")
	for eighth in range(1, 64):
		sim.music_eighth_step(eighth)
		sim.music_eighth_step(eighth)
	expect(sim.overdrive_eighths == 1, "duplicate transport callbacks never spend another eighth")
	sim.music_eighth_step(64)
	expect(sim.overdrive_eighths == 0 and sim.overdrive_left == 0.0, "sixty-fourth musical eighth ends overdrive")
	# Pending Starfall is resolved by its quarter boundary and absorbs Overdrive.
	sim = quiet()
	sim.overdrive_eighths = 40
	sim.overdrive_left = 20.0 * BEAT
	sim.starfall_wait = 0.0
	sim.step(0.01)
	expect(sim.starfall_left > 9.0 and sim.overdrive_eighths == 0 and sim.overdrive_left == 0.0, "Starfall absorbs an active overdrive")
	sim = quiet()
	sim.upgrades.append("hairtrig")
	for orbit in 2:
		sim.lap_stars = 1
		sim.complete_orbit()
	sim.step(BEAT * 0.5)
	expect(sim.starfall_left == 0.0, "earned Starfall waits past the half-beat")
	sim.step(BEAT * 0.5 + 0.01)
	expect(sim.starfall_left > 9.0, "earned Starfall releases on the next quarter")
	print(JSON.stringify({"overdrive_scheduler": "passed" if failures.is_empty() else "failed", "failures": failures}))
	quit(0 if failures.is_empty() else 1)
