extends SceneTree
## Run: godot --headless --path native-godot --script res://tests/fidelity_check.gd
## Deterministic boundary fixtures exercise behaviors that caught porting bugs.
const S = preload("res://scripts/simulation.gd")
const G = preload("res://scripts/orbit_geometry.gd")
var failures: Array[String] = []
func expect(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)
func quiet(index: int = 0):
	var sim = S.new()
	sim.begin(index)
	for obj in sim.objects:
		obj.active = false
	sim.hazard_timer = 10000.0
	sim.star_timer = 10000.0
	sim.power_timer = 10000.0
	sim.teach_next = 10000.0
	return sim
func armed(sim, shape: String, a: float, ring: int):
	var obj = sim.spawn_hazard(shape, a, ring, 0.0)
	obj.warn = 0.0
	obj.age = 0.1
	obj.depth = 0.0
	obj.lifetime = 100.0
	obj.position = sim.geometry.world(a, ring, 0.0)
	obj.previous = obj.position
	return obj
func _initialize() -> void:
	var geo = G.new()
	expect(is_equal_approx(geo.radius(1.0), 0.76) and is_equal_approx(geo.radius(2.0), 0.545), "canonical normal radii")
	geo.black_hole = true
	expect(is_equal_approx(geo.radius(3.0), 0.45), "canonical BH radius")
	var sim = quiet()
	expect(sim.world_progress == 0.0, "fresh journey starts at selected home")
	sim.step(0.3)
	expect(is_equal_approx(sim.world_progress, 0.3 / 150.0), "active-time sky trickle")
	sim.lap = TAU * 0.5
	var journey = sim.world_progress
	sim.turn()
	expect(is_equal_approx(sim.world_progress - journey, 0.5 / 7.0) and sim.lap == 0.0, "turn banks fractional travel before resetting scoring lap")
	journey = sim.world_progress
	sim.complete_orbit()
	expect(is_equal_approx(sim.world_progress - journey, 1.0 / 7.0), "all completed orbits advance the sky")
	sim.world_progress = 9.5
	sim.begin(1, false, false, true)
	expect(sim.world_progress == 9.5, "carried journey never moves backward to home")
	sim.begin(4)
	expect(sim.world_progress == 4.0, "fresh selected start resets journey to home")
	sim = quiet()
	expect(sim.shields == 2, "ordinary start has two shields")
	sim.lap = 4.0
	sim.streak = 3
	sim.lap_stars = 2
	sim._hit("test")
	expect(sim.shields == 1 and sim.lap == 4.0 and sim.streak == 3 and sim.lap_stars == 2, "shield preserves earned orbit state")
	sim.upgrades.append("deepbank")
	sim.begin(1, false, false, true)
	expect(sim.shields == 3, "Deep Bank starts next level with three")
	sim.shields = 3
	sim.difficulty = 90.0
	sim.score = 0
	sim.activate_power("shield")
	expect(sim.shields == 3 and sim.score == 50, "Deep Bank does not raise shield cap")
	for pair in [["slowworld","warp",9.0],["stagelight","spot",16.0],["longstar","hyper",24.0*60.0/104.0],["longmirror","mirror",24.0*60.0/104.0],["deepburn","scorch",13.0],["longslip","slip",18.0]]:
		sim = quiet(3)
		sim.upgrades.append(pair[0])
		sim.activate_power(pair[1])
		expect(is_equal_approx(float(sim.powers[pair[1]]), pair[2]), "upgrade duration " + pair[0])
	sim = quiet()
	sim.upgrades.append("richnova")
	var converted = armed(sim, "single", 1.0, 0)
	sim.convert(converted)
	var converted_angles: Array[float] = []
	for obj in sim.objects:
		if obj.active and obj.kind == "star":
			converted_angles.append(obj.angle)
			expect(not obj.bonus, "Rich Nova stars have ordinary reward")
	expect(converted_angles.size() == 2 and absf(angle_difference(converted_angles[0], converted_angles[1])) >= 0.30, "Rich Nova makes two separated real stars")
	sim = quiet(2)
	sim.upgrades.append("longtrail")
	sim.activate_power("trail")
	sim.activate_power("trail")
	expect(sim.count_kind("star") == 9, "new Star Trail replaces old route")
	for obj in sim.objects:
		if obj.active:
			expect(obj.bonus and obj.lifetime == 24.0, "Long Star Trail real 24s stars")
	sim = quiet()
	sim.time = 0.038
	sim.judge_timing()
	expect(sim.groove == 0, "ordinary timing excludes 38ms")
	sim = quiet()
	sim.upgrades.append("steadyhand")
	sim.time = 0.038
	sim.judge_timing()
	expect(sim.groove == 1, "Steady Hand accepts 38ms")
	sim = quiet()
	for n in 4:
		sim.complete_orbit()
	expect(sim.charge == 0 and sim.starfall_wait < 0.0, "empty orbits do not earn Starfall")
	sim.upgrades.append("hairtrig")
	for n in 2:
		sim.lap_stars = 1
		sim.complete_orbit()
	sim.step(60.0 / 104.0 + 0.01)
	expect(sim.starfall_left > 9.0 and sim.wave_index == 1, "two fed orbits trigger upgraded Starfall")
	var reward = null
	for obj in sim.objects:
		if obj.active and obj.starfall:
			reward = obj
			expect(not obj.bonus, "Starfall is not a +4 route star")
	var before_score = sim.score
	sim.collect(reward)
	expect(sim.score - before_score == 2, "Starfall actual first collection doubles to two")
	# Captured stars, power objects and ordinary reward clocks must survive a full BH detour.
	sim = quiet(3)
	sim.activate_power("spot")
	sim.starfall_left = 8.0
	sim.wave_index = 1
	sim.burn[0] = 2.5
	var star = sim.spawn_star(sim.angle + 1.0, 0)
	star.captured = true
	star.flight_age = 0.12
	star.flight_from = star.position
	var power = sim._take()
	power.kind = "power"
	power.shape = "scorch"
	power.lane = 1.0
	power.position = sim.geometry.world(1.0, 1.0, 0.0)
	power.previous = power.position
	var age = star.age
	sim.activate_power("bh")
	sim.step(1.85)
	expect(sim.black_hole and sim.bh_phase == 2, "BH alias and opening phase")
	expect(star.suspended and power.suspended and power.shape == "scorch", "suspension preserves object type")
	expect(star.age == age and star.flight_age == 0.12 and sim.powers.spot == 10.0 and sim.starfall_left == 8.0 and sim.burn[0] == 2.5, "BH freezes captured flight and reward clocks")
	expect(sim.level_time > 1.8, "difficulty age continues through BH")
	var temporary = sim.spawn_star(1.0, 3)
	sim._close_black_hole()
	expect(not temporary.active and sim.rings == 3, "temporary lane clears before collapse")
	sim.step(0.9)
	expect(not sim.black_hole and not star.suspended and not power.suspended and power.shape == "scorch", "closing restores original object identities")
	# Large-step relative motion and interpolated hops resolve the same contacts as small frames.
	var a = quiet(1)
	var b = quiet(1)
	for sample in [a,b]:
		sample.angle = 0.0
		sample.previous_angle = 0.0
		sample.invulnerable = 0.0
		var hazard = armed(sample, "drift", 0.20, 0)
		hazard.velocity = -20.0
	a.step(0.04)
	for unused in 40:
		b.step(0.001)
	expect(a.shields == 1 and b.shields == 1, "fast relative hazard hits at both frame partitions")
	sim = quiet(1)
	sim.angle = 0.0
	sim.previous_angle = 0.0
	armed(sim, "single", 0.06, 1)
	sim.hop(2)
	sim.step(0.12)
	expect(sim.shields == 1, "actual interpolated hop crosses intermediate hazard lane")
	sim = quiet()
	sim.angle = 0.0
	var grazed = armed(sim, "single", 0.077, 0)
	var at = sim.player_position()
	sim._update_objects(0.0,0.0,at,at)
	var once = sim.score
	sim._update_objects(0.0,0.0,at,at)
	expect(once == 3 and sim.score == once and grazed.resolved, "near miss pays once at actual contact")
	# Same-ring alternating pair and a fixed-lane, uncancellable saucer charge.
	sim = quiet(2)
	sim.difficulty = 330.0
	sim.did_hop = true
	sim.seen["blinktwin"] = true
	sim.tier_rows.assign([{"at":0.0,"type":"blinktwin"}])
	sim.spawn_formation()
	var pair: Array = []
	for obj in sim.objects:
		if obj.active:
			pair.append(obj)
	expect(pair.size() == 2 and pair[0].lane == pair[1].lane, "twin halves occupy same ring")
	if pair.size() == 2:
		for frame in 100:
			for obj in pair:
				obj.age = obj.warn + frame * (60.0/104.0)*2.0/100.0
			expect(pair[0].lethal() != pair[1].lethal(), "shutters strictly alternate")
	sim = quiet(2)
	var saucer = armed(sim, "saucer", sim.angle - 0.55, 0)
	saucer.heading = sim.direction
	sim.turn()
	var deadline = saucer.fire_time
	sim.turn()
	sim.hop(1)
	sim.step(0.6)
	expect(saucer.lane == 0.0 and saucer.beam_left > 0.0 and deadline > 0.0 and sim.shields == 2, "saucer frozen charge cannot cancel; hop escapes whole ring")
	# A lesson formation must never occupy its advertised only exit.
	for ty in ["dive", "funnel"]:
		sim = quiet(4)
		sim.difficulty = 540.0
		sim.level_time = 40.0
		sim.did_hop = true
		sim.seen[ty] = true
		sim.tier_rows.assign([{"at":0.0,"type":ty}])
		for j in 63:
			armed(sim,"single",float(j)*TAU/63.0,1)
		var previous_count = sim.count_kind("hazard")
		sim.spawn_formation()
		expect(sim.count_kind("hazard") == previous_count, ty + " rejects occupied destination/gap")
	sim = quiet(4)
	sim.angle = 0.0
	sim.difficulty = 540.0
	sim.level_time = 40.0
	armed(sim,"gate",2.0,0)
	sim.tier_rows.assign([{"at":0.0,"type":"single"}])
	sim.seen["single"] = true
	for j in 20:
		sim.spawn_formation()
	for obj in sim.objects:
		if obj.active and obj.shape == "single":
			expect(absf(angle_difference(obj.angle,sim.angle)) >= 1.1, "later spawn respects gate reversal arc")
	# Finale requires the bloomed sun or the actual 50 second backstop.
	sim = quiet(5)
	sim.begin_finale()
	expect(sim.count_kind("star") == 12, "finale has eleven stars and distinct sun")
	sim.step(8.1)
	expect(sim.running, "finale does not auto-finish after eight seconds")
	for obj in sim.objects:
		if obj.active and obj.finale_index >= 0:
			sim.collect(obj)
	sim.step(0.01)
	expect(sim.finish_got == 11 and sim.finish_bloomed, "collecting stars blooms sun")
	before_score = sim.score
	sim.collect(sim.finish_sun)
	expect(not sim.running and sim.score - before_score == 200, "all-star sun gives 200 and finishes once")
	sim = quiet(5)
	sim.begin_finale()
	for obj in sim.objects:
		obj.active = false
	sim.step(49.0)
	expect(sim.running, "finale remains before actual backstop")
	sim.step(1.1)
	expect(not sim.running, "finale finishes after fifty active seconds")
	print(JSON.stringify({"simulation_fidelity": "passed" if failures.is_empty() else "failed", "failures": failures}))
	quit(0 if failures.is_empty() else 1)
