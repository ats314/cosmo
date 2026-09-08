extends SceneTree
## Handoff only. Claude may place this at native-godot/tests/ and run it.
## No audio, profile IO, UI scene or engine process is started by preparing it.
## Source contracts and expected pre-fix failures are documented in the adjacent note.
const Simulation = preload("res://scripts/simulation.gd")
var failures: Array[String] = []

func expect(ok: bool, label: String) -> void:
	if not ok:
		failures.append(label)

func quiet(index: int = 1):
	var sim = Simulation.new()
	sim.begin(index)
	for obj in sim.objects:
		obj.active = false
	sim.hazard_timer = 10000.0
	sim.star_timer = 10000.0
	sim.power_timer = 10000.0
	sim.teach_next = 10000.0
	return sim

func _initialize() -> void:
	# runtime.js:7818: ordinary hops use raw dt even under Slow-mo or teaching.
	var sim = quiet()
	sim.activate_power("warp")
	sim.hop(1)
	sim.step(0.15)
	expect(sim.hop_progress >= 1.0 and sim.target_lane == 1,
		"Slow-mo still settles a 140ms ordinary hop within 150ms")
	expect(float(sim.powers.warp) > 5.8, "Slow-mo was still active during that hop")

	sim = quiet()
	sim.teach_left = 2.8
	sim.hop(1)
	sim.step(0.15)
	expect(sim.hop_progress >= 1.0,
		"a teaching veil does not dilate the ordinary hop clock")

	# runtime.js:2275,7818: settled BH_TS=.60 multiplies the 140ms hop clock.
	# Exclude entry/exit easing by settling the actual entry before measuring.
	sim = quiet(3)
	sim.activate_power("blackhole")
	sim.step(0.90)
	expect(sim.black_hole and sim.bh_phase == 2 and is_equal_approx(sim.bh_warp, 1.0),
		"black-hole measurement starts after its entry geometry has settled")
	sim.hop(1)
	sim.step(0.14)
	expect(absf(float(sim.hop_progress) - 0.60) < 0.002,
		"140ms in settled black-hole time advances a hop by 60 percent")
	sim.step(0.10)
	expect(sim.hop_progress >= 1.0 and sim.target_lane == 1,
		"settled black-hole hop completes by 240ms")

	# runtime.js:6968-6981: every hop clears on its DESTINATION ring;
	# only the 0.4-second grace is subject to the 0.8-second cooldown.
	sim = quiet()
	sim.activate_power("slip")
	var first = sim.spawn_hazard("single", sim.angle + 0.10, 1, 0.0)
	expect(first != null, "first Slipstream fixture has a hazard")
	if first != null:
		sim.hop(1)
		expect(first.kind == "star" and is_equal_approx(first.lane, 1.0),
			"first Slipstream conversion leaves its star on the destination ring")
		expect(is_equal_approx(sim.invulnerable, 0.4) and is_equal_approx(sim.slip_cooldown, 0.8),
			"first successful Slipstream hop grants the source grace and cooldown")
		sim.step(0.16)
		var second = sim.spawn_hazard("single", sim.angle + 0.10, 2, 0.0)
		expect(second != null, "second Slipstream fixture has a hazard")
		if second != null:
			var grace_before: float = sim.invulnerable
			var cooldown_before: float = sim.slip_cooldown
			expect(cooldown_before > 0.0 and sim.hop_progress >= 1.0,
				"second hop is legal while its grace cooldown is still active")
			sim.hop(1)
			expect(second.kind == "star" and is_equal_approx(second.lane, 2.0),
				"second Slipstream hop clears red onto its destination during cooldown")
			expect(is_equal_approx(sim.invulnerable, grace_before)
				and is_equal_approx(sim.slip_cooldown, cooldown_before),
				"second Slipstream hop does not renew metered grace or cooldown")

	# runtime.js:6132 excludes lab starts; 4578,4588 retain 13s rookie grace.
	sim = Simulation.new()
	for unused in 3:
		sim.begin(0, true)
	expect(sim.runs == 0, "three lab starts do not count as real runs")
	sim.begin(0)
	expect(sim.runs == 1, "the first real run remains the first after lab visits")
	for obj in sim.objects:
		obj.active = false
	sim.hazard_timer = 0.0
	sim.star_timer = 10000.0
	sim.power_timer = 10000.0
	sim.teach_next = 10000.0
	sim.step(5.0)
	expect(sim.count_kind("hazard") == 0,
		"lab visits cannot shorten the first real run's 13-second danger grace to 4.5s")

	if failures.is_empty():
		print("Simulation fidelity regressions passed.")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
