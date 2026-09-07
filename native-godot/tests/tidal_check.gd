extends SceneTree
## Run: godot --headless --path native-godot --script res://tests/tidal_check.gd
## Exercises the physical stream through the same encounter pool as gameplay.
const S = preload("res://scripts/simulation.gd")
const T = preload("res://scripts/tidal_current.gd")
var failures: Array[String] = []

func expect(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)

func quiet():
	var sim = S.new()
	sim.tidal = T.new()
	sim.begin(1)
	for obj in sim.objects:
		obj.active = false
	sim.hazard_timer = 10000.0
	sim.star_timer = 10000.0
	sim.power_timer = 10000.0
	sim.teach_next = 10000.0
	return sim

func start(sim, element: String = "nebula") -> void:
	expect(sim.tidal.begin(sim, element, Vector3(320.0, 160.0, -900.0)), "bridge begins with a valid source")

func _initialize() -> void:
	var sim = quiet()
	start(sim)
	for ring in 3:
		var anchor = sim.tidal.point(sim, [0.50, 0.68, 0.82][ring])
		var orbit = sim.geometry.world(sim.tidal.lane_angle(float(ring)), float(ring), 0.0)
		expect(anchor.distance_to(orbit) < 0.0001, "stream crosses exact lane %s" % ring)
	expect(sim.tidal.point(sim, 0.0).distance_to(sim.tidal.source) < 0.0001, "stream begins on its physical source")
	sim.angle = sim.tidal.lane_angle(0.0)
	sim.tidal.step(sim, 2.9)
	expect(sim.tidal.warning > 0.09 and sim.tidal.age == 0.0 and sim.tidal.stars_issued == 0 and sim.tidal.factor(sim) == 1.0, "three-second warning changes no gameplay")
	sim.tidal.step(sim, 0.2)
	expect(is_equal_approx(sim.tidal.age, 0.1) and sim.tidal.stars_issued == 1, "warning carries only remaining time into the active bridge")
	sim.tidal.age = 1.0
	expect(is_equal_approx(sim.tidal.factor(sim), 1.35), "matching sector has a bounded 35 percent boost")
	sim.direction = -1.0
	expect(sim.tidal.factor(sim) == 1.0, "opposing direction receives no speed boost")
	sim.direction = 1.0
	sim.angle += PI
	expect(sim.tidal.factor(sim) == 1.0, "outside the physical crossing receives no speed boost")
	# A stream star arrives at exactly its ordinary lane point; contact then uses
	# the normal reward path and cannot grant Starfall charge without an orbit.
	sim = quiet()
	start(sim)
	sim.angle = sim.tidal.angle + PI
	sim.tidal.step(sim, 3.0)
	var streamed = null
	for obj in sim.objects:
		if obj.active and obj.current_flight:
			streamed = obj
	expect(streamed != null, "bridge issues a pooled physical star")
	if streamed != null:
		sim.tidal.step(sim, 2.1)
		var at = sim.geometry.world(streamed.angle, streamed.lane, 0.0)
		expect(not streamed.current_flight and streamed.current_position.distance_to(at) < 0.0001 and not streamed.bonus and not streamed.starfall, "arrival becomes an ordinary collectible at its exact lane anchor")
		expect(sim.score == 0 and sim.lap_stars == 0 and sim.charge == 0, "material flight cannot directly award progress")
		sim.angle = streamed.angle
		sim.lane = streamed.lane
		sim.target_lane = roundi(streamed.lane)
		sim._update_objects(0.0, 0.0, at, at)
		expect(not streamed.active and sim.score == 1 and sim.lap_stars == 1 and sim.charge == 0, "real stream star contact feeds the ordinary orbit without bypassing it")
	# Each element lends an existing power after entering its current.
	for pair in [["nebula", "spot"], ["molten", "scorch"], ["ice", "warp"]]:
		sim = quiet()
		start(sim, pair[0])
		sim.angle = sim.tidal.lane_angle(0.0)
		sim.tidal.step(sim, 3.5)
		expect(sim.tidal.entered and float(sim.powers.get(pair[1], 0.0)) == 4.0, "element uses real existing power " + pair[1])
	sim = quiet()
	start(sim)
	sim.powers["spot"] = 20.0
	sim.angle = sim.tidal.lane_angle(0.0)
	sim.tidal.step(sim, 3.5)
	expect(sim.powers.spot == 20.0, "bridge never shortens an existing longer power")
	var active_age = sim.tidal.age
	sim.paused = true
	sim.step(2.0)
	expect(sim.tidal.age == active_age and sim.tidal.factor(sim) == 1.0, "pause freezes the current and disables boost")
	sim.paused = false
	sim.activate_power("blackhole")
	sim.step(1.2)
	expect(sim.tidal.age == active_age and sim.tidal.factor(sim) == 1.0, "black-hole detour suspends bridge time and boost")
	for obj in sim.objects:
		if obj.active and obj.shape == "tidal":
			expect(obj.suspended and obj.current_t == 0.0, "black hole freezes incoming material stars")
	sim.begin(1)
	expect(not sim.tidal.active, "new run resets the bridge")
	start(sim)
	sim.begin_finale()
	expect(not sim.tidal.active, "finale resets the bridge before replacing encounters")
	sim = quiet()
	start(sim)
	sim.angle = sim.tidal.angle + PI
	for tick in 111:
		sim.tidal.step(sim, 0.1)
	expect(not sim.tidal.active and is_equal_approx(sim.tidal.age, 8.0) and sim.tidal.stars_issued == 12, "bridge ends after eight active seconds with its bounded star supply")
	for obj in sim.objects:
		expect(not obj.active or not obj.current_flight, "all material flights settle before bridge ends")
	sim.lab_power = "tidal"
	sim.begin(1, true)
	sim.spawn_power()
	expect(sim.count_kind("power") == 0 and sim.powers.is_empty(), "tidal lab never invents an ordinary tidal power")
	print(JSON.stringify({"tidal_geometry_gameplay": "passed" if failures.is_empty() else "failed", "failures": failures}))
	quit(0 if failures.is_empty() else 1)
