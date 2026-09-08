extends RefCounted
## Native simulation; source behavior and tuning: src/game/runtime.js + db/query.mjs.
const Content = preload("res://scripts/cosmo_content.gd")
const Geometry = preload("res://scripts/orbit_geometry.gd")
const BEAT = 60.0 / 104.0
const POOL_SIZE = 160
signal event(kind: StringName)
signal message(text: String, seconds: float)
signal ended(won: bool)

class Encounter extends RefCounted:
	var active = false
	var kind = "star"
	var shape = "single"
	var angle = 0.0
	var lane = 0.0
	var target_lane = 0.0
	var depth = 0.0
	var age = 0.0
	var warn = 0.0
	var lifetime = 8.0
	var velocity = 0.0
	var blink_offset = 0.0
	var blink_duty = 0.55
	var hit = false
	var resolved = false
	var closest = INF
	var captured = false
	var flight_age = 0.0
	var flight_from = Vector3.ZERO
	var position = Vector3.ZERO
	var previous = Vector3.ZERO
	var bonus = false
	var serial = 0
	var fire_time = -1.0
	var suspended = false
	var starfall = false
	var finale_index = -1
	var exit_sun = false
	var beam_left = 0.0
	var follow_wait = 0.0
	var heading = 1.0
	var arrival_delay = 0.0
	var current_t = 0.0
	var current_lane = 0
	var current_flight = false
	var current_position = Vector3.ZERO
	func reset(id: int) -> void:
		active = true
		kind = "star"
		shape = "single"
		angle = 0.0
		lane = 0.0
		target_lane = 0.0
		depth = 0.0
		age = 0.0
		warn = 0.0
		lifetime = 8.0
		velocity = 0.0
		blink_offset = 0.0
		blink_duty = 0.55
		hit = false
		resolved = false
		closest = INF
		captured = false
		flight_age = 0.0
		flight_from = Vector3.ZERO
		position = Vector3.ZERO
		previous = Vector3.ZERO
		bonus = false
		serial = id
		fire_time = -1.0
		suspended = false
		starfall = false
		finale_index = -1
		exit_sun = false
		beam_left = 0.0
		follow_wait = 0.0
		heading = 1.0
		arrival_delay = 0.0
		current_t = 0.0
		current_lane = 0
		current_flight = false
		current_position = Vector3.ZERO
	func lethal() -> bool:
		if kind != "hazard" or suspended or age < warn or hit:
			return false
		if shape == "saucer":
			return beam_left > 0.0
		if shape in ["blink", "blinktwin"]:
			return fposmod(age - warn + blink_offset, BEAT * 2.0) < BEAT * 2.0 * blink_duty
		return age < warn + lifetime

var geometry = Geometry.new()
var tidal = null
var rng = RandomNumberGenerator.new()
var objects: Array[Encounter] = []
var serial = 0
var running = false
var paused = false
var lab = false
var lab_power = "spot"
var tutorial = -1
var level_index = 0
var start_level = 0
var time = 0.0
var visual_time = 0.0
var level_time = 0.0
var travel = 0.0
var world_progress = 0.0
var difficulty = 0.0
var difficulty_reward = 0.0
var score = 0
var combo = 0
var combo_time = 0.0
var angle = -PI / 2.0
var previous_angle = angle
var previous_lane = 0.0
var direction = 1.0
var lane = 0.0
var target_lane = 0
var hop_from = 0.0
var hop_progress = 1.0
var rings = 1
var shields = 2
var invulnerable = 0.0
var speed = 1.3
var lap = 0.0
var lap_stars = 0
var streak = 0
var orbits = 0
var charge = 0
var starfall_left = 0.0
var starfall_wait = -1.0
var wave_index = 0
var powers: Dictionary = {}
var upgrades: Array[String] = []
var hazard_timer = 2.2
var star_timer = 0.0
var power_timer = 13.0
var power_count = 0
var since_shield = 0
var seen: Dictionary = {}
var black_hole = false
var bh_time = 0.0
var bh_charge = 0.0
var bh_stars = 0
var bh_spent = 0
var bh_pull = 4.0
var previous_rings = 3
var nova_age = -1.0
var nova_origin = Vector3.ZERO
var nova_serial = 0
var burn: PackedFloat32Array = PackedFloat32Array()
var trail: Array[Vector3] = []
var flow = 0.0
var heat = 0.0
var overdrive_left = 0.0
var overdrive_eighths = 0
var overdrive_cooldown = 0.0
var hot_time = 0.0
var external_music_clock = false
var music_release_active = false
var music_release_pending = false
var music_rising = false
var _external_eighth = -1
var _fallback_eighth = 0
var slip_cooldown = 0.0
var finish_age = -1.0
var finish_got = 0
var finish_bloomed = false
var finish_last_at = -9.0
var finish_score = 0
var finish_sun: Encounter = null
var bh_phase = 0
var bh_warp = 0.0
var bh_close_age = 0.0
var bh_cooldown = 0.0
var intro_power_count = 0
var guaranteed_powers: Dictionary = {}
var power_collected: Dictionary = {}
var saucer_cooldown = 0.0
var runs = 0
var did_hop = false
var teach_left = 0.0
var teach_next = 0.0
var groove = 0
var groove_until = 0.0
var timing_bias = 0.0
var timing_samples = 0
var timing_last_slot = -999999
var pointer_turn_pending = false
var _pointer_lap = 0.0
var _pointer_streak = 0
var hyper_duration = 0.0
var nova_speed = 560.0
var current_level: Dictionary = {}
var tier_rows: Array[Dictionary] = []
var power_rows: Array[Dictionary] = []
var finale_rules: Dictionary = {}
var difficulty_floor = 0.0
var shape_rank = {"single":0,"twin":1,"gate":2,"drift":2,"blink":2,"dive":3,"driftgate":4,"blinktwin":4,"saucer":4,"funnel":4}
var last_hit = ""

func _init() -> void:
	rng.seed = 311
	for i in POOL_SIZE:
		objects.append(Encounter.new())
	burn.resize(4 * 72)
	burn.fill(0.0)
	tier_rows = Content.tiers()
	power_rows = Content.powers()
	finale_rules = Content.finale()

func begin(index: int = 0, practice: bool = false, teach: bool = false, carry: bool = false) -> void:
	if tidal != null:
		tidal.reset()
	level_index = clampi(index, 0, 5)
	current_level = Content.level_at(level_index)
	difficulty_floor = float(current_level.dl_start)
	world_progress = maxf(world_progress, float(current_level.world)) if carry else float(current_level.world)
	if not carry:
		score = 0
		start_level = level_index
		upgrades.clear()
		orbits = 0
		seen.clear()
		intro_power_count = 0
		guaranteed_powers.clear()
		power_collected.clear()
		for pair in [["hyper",2],["slip",2],["spot",3],["trail",3],["mirror",4],["scorch",5]]:
			guaranteed_powers[pair[0]] = level_index + 1 > int(pair[1])
		guaranteed_powers["blackhole"] = false
		# Lab visits must not spend the real run's newcomer grace.
		if not practice:
			runs += 1
	lab = practice
	tutorial = 0 if teach and index == 0 else -1
	time = 0.0
	visual_time = 0.0
	level_time = 0.0
	travel = 0.0
	difficulty_reward = 0.0
	difficulty = 40.0 if practice else difficulty_floor
	angle = -PI / 2.0
	previous_angle = angle
	previous_lane = 0.0
	direction = 1.0
	lane = 0.0
	target_lane = 0
	hop_from = 0.0
	hop_progress = 1.0
	rings = 3 if practice or index > 0 else 1
	lap = 0.0
	lap_stars = 0
	streak = 0
	charge = 0
	combo = 0
	combo_time = 0.0
	starfall_left = 0.0
	starfall_wait = -1.0
	wave_index = 0
	powers.clear()
	black_hole = false
	geometry.black_hole = false
	geometry.black_hole_mix = 0.0
	bh_phase = 0
	bh_warp = 0.0
	bh_cooldown = 0.0
	bh_charge = 0.0
	nova_age = -1.0
	finish_age = -1.0
	finish_got = 0
	finish_bloomed = false
	finish_score = 0
	finish_sun = null
	finish_last_at = -9.0
	shields = 3 if "deepbank" in upgrades else 2
	invulnerable = 0.0
	hazard_timer = 1.2
	star_timer = 0.0
	power_timer = 4.0
	power_count = 0
	since_shield = 0
	flow = 0.0
	heat = 0.0
	hot_time = 0.0
	overdrive_left = 0.0
	overdrive_eighths = 0
	overdrive_cooldown = 0.0
	external_music_clock = false
	music_release_active = false
	music_release_pending = false
	music_rising = false
	_external_eighth = -1
	_fallback_eighth = 0
	slip_cooldown = 0.0
	saucer_cooldown = 0.0
	teach_left = 0.0
	teach_next = 0.0
	groove = 0
	groove_until = 0.0
	timing_last_slot = -999999
	pointer_turn_pending = false
	did_hop = false
	trail.clear()
	burn.fill(0.0)
	for obj in objects:
		obj.active = false
	running = true
	paused = false
	if tutorial >= 0:
		message.emit("Tap to turn", 100.0)
	elif lab and lab_power != "tidal":
		activate_power(lab_power)
	elif not lab:
		message.emit(str(current_level.name), 2.0)
	spawn_star(angle + direction * 0.65, 0)

func player_position() -> Vector3:
	return geometry.world(angle, lane, 0.0)

func has_power(id: String) -> bool:
	return not black_hole and float(powers.get(id, 0.0)) > 0.0

func turn() -> void:
	if not running or paused:
		return
	_flip_turn()
	_commit_turn_effects()

func _flip_turn() -> void:
	direction *= -1.0
	# A reversal banks the travelled fraction before the scoring lap resets.
	world_progress += (lap / TAU) / 7.0
	lap = 0.0
	streak = 0

func begin_pointer_turn() -> void:
	if not running or paused or pointer_turn_pending:
		return
	_pointer_lap = lap
	_pointer_streak = streak
	pointer_turn_pending = true
	# The comet responds at press. Sound, timing heat, teaching and saucer
	# commitment wait until a tap is confirmed at lift.
	_flip_turn()

func rollback_pointer_turn() -> void:
	if not pointer_turn_pending:
		return
	pointer_turn_pending = false
	direction *= -1.0
	lap = _pointer_lap
	streak = _pointer_streak

func commit_pointer_turn() -> void:
	if not pointer_turn_pending or not running or paused:
		return
	pointer_turn_pending = false
	_commit_turn_effects()

func cancel_pointer_turn() -> void:
	# Focus loss and menus drop the held contact. Its immediate movement has
	# already happened; no delayed sound or input survives the abandoned press.
	pointer_turn_pending = false

func _commit_turn_effects() -> void:
	flow = minf(1.0, flow + 0.13)
	judge_timing()
	event.emit(&"turn")
	for obj in objects:
		if obj.active and obj.shape == "saucer" and obj.age >= obj.warn and obj.fire_time < 0.0 and obj.beam_left <= 0.0:
			obj.fire_time = obj.age + BEAT
			obj.heading = direction
	if tutorial == 0:
		tutorial = 1
		message.emit("Collect the gold star", 100.0)
		for obj in objects:
			obj.active = false
		spawn_star(angle + direction * 0.65, 0)

func hop(delta: int, forced: bool = false) -> void:
	if not running or paused:
		return
	if hop_progress < 1.0 and not forced:
		return
	var destination = clampi(target_lane + delta, 0, rings - 1)
	if destination == target_lane:
		if not forced:
			unresolved_swipe()
			judge_timing()
		return
	hop_from = lane
	target_lane = destination
	hop_progress = 0.0
	if not forced:
		did_hop = true
		judge_timing()
		event.emit(&"hop")
		flow = minf(1.0, flow + 0.18)
		if has_power("slip"):
			for obj in objects:
				if obj.active and obj.kind == "hazard" and obj.shape != "saucer" and int(obj.lane) == destination and absf(angle_difference(angle, obj.angle)) < 0.48:
					self.convert(obj, destination)
			# Every successful hop clears; only the extra grace is metered.
			if slip_cooldown <= 0.0:
				invulnerable = maxf(invulnerable, 0.4)
				slip_cooldown = 0.8
		if tutorial == 3:
			tutorial = 4

func unresolved_swipe() -> void:
	if running and not paused:
		event.emit(&"bump")

func step(dt: float) -> void:
	if not running or paused:
		return
	# Bound angular curvature during swept contact. Hop paths use the same continuous lane.
	var remaining = dt
	while remaining > 0.00001 and running:
		var h = minf(remaining, 1.0 / 240.0)
		_tick(h)
		remaining -= h

func _tick(dt: float) -> void:
	time += dt
	heat = maxf(0.0, heat - dt * 0.34)
	overdrive_cooldown = maxf(0.0, overdrive_cooldown - dt)
	if not external_music_clock:
		var eighth = floori(time / (BEAT * 0.5))
		while _fallback_eighth < eighth:
			_fallback_eighth += 1
			_advance_overdrive_eighth()
	if tutorial < 0:
		level_time += dt
	var adjusted_age = level_time + minf(difficulty_reward * 0.22, 40.0)
	difficulty = 40.0 if lab else difficulty_floor + (adjusted_age * 0.55 if adjusted_age < 80.0 else adjusted_age - 36.0)
	if tutorial >= 0:
		difficulty = 0.0
	speed = 1.4 if tutorial >= 0 else Content.speed_at(difficulty)
	var slow = lerpf(1.0, 0.6, bh_warp) if black_hole else (0.55 if has_power("warp") else 1.0)
	# Source hop clock: presentation time in the black hole, raw time elsewhere.
	# Capture it before a teaching veil further dilates ordinary world movement.
	var hop_dt = dt * slow if black_hole else dt
	if teach_left > 0.0 and not black_hole and finish_age < 0.0:
		slow *= 0.35
	teach_left = maxf(0.0, teach_left - dt)
	if has_power("hyper"):
		var hv = clampf(minf((hyper_duration - float(powers.hyper)) / 0.35, float(powers.hyper) / 1.4), 0.0, 1.0)
		speed *= 1.0 + 0.9 * hv
	if finish_age >= 0.0:
		speed *= 1.0 + 0.06 * finish_got
	elif tidal != null and not black_hole:
		speed *= float(tidal.factor(self))
	var sd = dt * slow
	visual_time += sd
	travel += sd * 100.0
	world_progress += sd / 150.0
	previous_angle = angle
	previous_lane = lane
	var player_before = player_position()
	if black_hole:
		_update_black_hole(dt)
		if not running:
			return
	angle += speed * sd * direction
	if hop_progress < 1.0:
		hop_progress = minf(1.0, hop_progress + hop_dt / 0.14)
		var eased = 1.0 - pow(1.0 - hop_progress, 3.0)
		lane = lerpf(hop_from, float(target_lane), eased)
		if hop_progress >= 1.0 and tutorial == 4:
			finish_tutorial()
	else:
		lane = float(target_lane)
	lap += speed * sd
	if lap >= TAU:
		lap -= TAU
		complete_orbit()
	var player_after = player_position()
	invulnerable = maxf(0.0, invulnerable - dt)
	slip_cooldown = maxf(0.0, slip_cooldown - dt)
	combo_time -= sd
	if combo_time <= 0.0:
		combo = 0
	flow = maxf(0.0, flow - dt * 0.023)
	if groove > 0 and time > groove_until:
		groove -= 1
		groove_until = time + 0.7
	if not black_hole:
		for id in powers:
			var old = float(powers[id])
			powers[id] = maxf(0.0, old - dt)
			if id == "hyper" and old > 0.0 and float(powers[id]) <= 0.0:
				invulnerable = maxf(invulnerable, 1.2)
		_update_starfall(dt)
		if nova_age >= 0.0:
			nova_age += sd
			for obj in objects:
				if obj.active and obj.kind == "hazard" and obj.serial <= nova_serial and geometry.world(obj.angle, obj.lane, 0.0).distance_to(nova_origin) <= 34.0 + nova_age * nova_speed:
					self.convert(obj)
			if nova_age > 2.0:
				nova_age = -1.0
	if not black_hole:
		for i in burn.size():
			burn[i] = maxf(0.0, burn[i] - sd)
	if has_power("scorch"):
		var sector = int(fposmod(angle, TAU) / TAU * 72.0)
		burn[clampi(roundi(lane), 0, rings - 1) * 72 + sector] = maxf(2.6, TAU / speed + 0.2)
	_update_overdrive(dt)
	if tidal != null and not black_hole and finish_age < 0.0:
		tidal.step(self, dt)
	_update_objects(sd, dt, player_before, player_after)
	if not running:
		return
	if tutorial >= 0:
		return
	if finish_age >= 0.0:
		finish_age += dt
		if not finish_bloomed and (finish_got >= 8 or finish_age > 30.0):
			finish_bloomed = true
			message.emit("Collect the sun to finish this level", 4.0)
		if finish_age > 50.0:
			finish_level()
		return
	if not black_hole:
		rings = maxi(rings, Content.ring_count(difficulty))
		if not lab and starfall_left <= 0.0 and starfall_wait < 0.0 and difficulty >= float(current_level.dl_end) - 10.0:
			begin_finale()
			return
	if black_hole and (bh_phase != 2 or bh_time >= 12.0):
		return
	var spawn_dt = dt if black_hole else sd
	var density = 1.25 + 0.75 * minf(1.0, bh_time / 12.0) if black_hole else 1.0
	hazard_timer -= spawn_dt
	star_timer -= spawn_dt
	power_timer -= sd
	var first_at = 4.5 + 8.5 * clampf((4.0 - runs) / 3.0, 0.0, 1.0)
	if hazard_timer <= 0.0 and teach_left <= 0.0 and (lab or level_time >= first_at) and count_kind("hazard") < roundi(Content.hazard_cap(difficulty) * density) and (black_hole or starfall_left <= 0.0):
		spawn_formation()
		hazard_timer = Content.spawn_gap(difficulty) * rng.randf_range(0.85, 1.15) / density
	if star_timer <= 0.0 and (black_hole or starfall_left <= 0.0) and count_kind("star") < Content.star_cap(difficulty, rings):
		spawn_random_star()
		star_timer = Content.star_gap(difficulty, rings) * rng.randf_range(0.75, 1.4)
	if power_timer <= 0.0 and not black_hole and starfall_left <= 0.0 and count_kind("power") < 1 and difficulty >= 6.0:
		spawn_power()
		power_timer = rng.randf_range(2.2,3.6) if lab else maxf(6.0, rng.randf_range(10.0,15.0) - difficulty * 0.02)

func _update_overdrive(dt: float) -> void:
	# runtime8079: the code uses SPB*8 (eight quarter notes), despite the
	# older nearby comment describing one bar. Released/armed Starfall wins.
	var release_live = starfall_left > 0.0 or music_release_active
	var eligible_heat = tutorial < 0 and not black_hole and not release_live and not music_rising and overdrive_eighths <= 0 and heat > 0.75
	hot_time = hot_time + dt if eligible_heat else 0.0
	if hot_time > BEAT * 8.0 and overdrive_cooldown <= 0.0 and starfall_wait < 0.0 and not music_release_pending and difficulty > 18.0 and finish_age < 0.0:
		overdrive_eighths = 64
		overdrive_left = float(overdrive_eighths) * BEAT * 0.5
		hot_time = 0.0
		overdrive_cooldown = 45.0
		event.emit(&"overdrive")
		message.emit("Overdrive · stars and on-time taps pay more", 2.0)

func music_eighth_step(step_index: int) -> void:
	# The audio transport publishes crossed eighths. Muting does not stop it;
	# a simulation without an audio node uses the fixed-tempo fallback above.
	external_music_clock = true
	if _external_eighth < 0 or step_index < _external_eighth:
		_external_eighth = step_index
		return
	if step_index == _external_eighth:
		return
	_external_eighth = step_index
	_advance_overdrive_eighth()

func _advance_overdrive_eighth() -> void:
	if not running or paused or black_hole or finish_age >= 0.0 or starfall_left > 0.0 or music_release_active or music_rising or overdrive_eighths <= 0:
		return
	overdrive_eighths -= 1
	overdrive_left = float(overdrive_eighths) * BEAT * 0.5
	if overdrive_eighths == 0:
		event.emit(&"overdrive_end")

func _cancel_overdrive() -> void:
	if overdrive_eighths > 0 or overdrive_left > 0.0:
		event.emit(&"overdrive_stop")
	overdrive_eighths = 0
	overdrive_left = 0.0
	hot_time = 0.0

func complete_orbit() -> void:
	var fed = lap_stars > 0
	streak = streak + 1 if fed else 0
	score += Content.orbit_score(lap_stars, streak)
	orbits += 1
	world_progress += 1.0 / 7.0
	difficulty_reward += 1.0
	lap_stars = 0
	event.emit(&"orbit")
	flow = minf(1.0, flow + 0.15)
	if fed and tutorial < 0 and not lab and finish_age < 0.0 and not black_hole and starfall_left <= 0.0 and starfall_wait < 0.0:
		charge += 1
		if charge >= (2 if "hairtrig" in upgrades else 3):
			starfall_wait = BEAT - fposmod(time, BEAT)
	if tutorial == 2:
		tutorial = 3
		rings = 2
		message.emit("Swipe down to change rings", 100.0)

func finish_tutorial() -> void:
	tutorial = -1
	level_time = 0.0
	invulnerable = 2.0
	message.emit("Collect stars. Complete orbits to earn Starfall.", 3.0)
	event.emit(&"tutorial_done")

func judge_timing() -> int:
	if tutorial >= 0 or black_hole or not running or paused:
		return 0
	var slot = roundi(time / (BEAT * 0.25))
	if slot == timing_last_slot:
		return groove
	timing_last_slot = slot
	heat = minf(1.0, heat + 0.26)
	var off4 = fposmod(time + BEAT * 0.5, BEAT) - BEAT * 0.5
	var off16 = fposmod(time + BEAT * 0.125, BEAT * 0.25) - BEAT * 0.125
	var window = 0.045 if "steadyhand" in upgrades else 0.032
	var dev4 = absf(off4 - timing_bias)
	var dev16 = absf(off16 - timing_bias)
	if minf(dev4, dev16) < window * 2.5:
		var delta = ((off4 if dev4 <= dev16 else off16) - timing_bias) * 0.18
		if timing_samples < 12 and dev4 < window * 2.5:
			timing_samples += 1
			timing_bias += delta
		else:
			timing_bias += clampf(delta, -0.003, 0.003)
		timing_bias = clampf(timing_bias, -0.12, 0.12)
	if dev16 < window:
		if starfall_left > 0.0 or overdrive_left > 0.0 or has_power("hyper") or shields >= Content.shield_max(difficulty):
			score += 8
		if dev4 >= window:
			if groove > 0:
				groove_until = time + 2.8
			return groove
		var previous = groove
		groove = mini(8, groove + 1)
		groove_until = time + 2.8
		if groove > previous:
			score += groove
		if groove == 2:
			message.emit("On time · movement plays with the music", 1.7)
		return groove
	groove = maxi(0, groove - 1)
	return 0

func begin_finale() -> void:
	if tidal != null:
		tidal.reset()
	finish_age = 0.0
	finish_got = 0
	finish_score = 0
	finish_last_at = -9.0
	finish_bloomed = false
	teach_left = 0.0
	powers["hyper"] = minf(float(powers.get("hyper", 0.0)), 1.0)
	for obj in objects:
		obj.active = false
	var a0 = angle + direction * float(finale_rules.angle_lead)
	for j in 11:
		var obj = spawn_star(a0 + direction * j * float(finale_rules.angle_step), mini(int(finale_rules.star_rings[j]), rings - 1))
		if obj != null:
			obj.finale_index = j
			obj.lifetime = 100.0
	finish_sun = spawn_star(a0 + direction * 11.0 * float(finale_rules.angle_step), mini(2, rings - 1))
	if finish_sun != null:
		finish_sun.exit_sun = true
		finish_sun.lifetime = 100.0
	message.emit("Collect the stars · swipe between rings", 4.0)
	event.emit(&"finale")

func _update_starfall(dt: float) -> void:
	if starfall_wait >= 0.0:
		starfall_wait -= dt
		if starfall_wait < 0.0:
			starfall_left = BEAT * 16.0
			wave_index = 0
			charge = 0
			_cancel_overdrive()
			nova_age = 0.0
			nova_origin = player_position()
			nova_serial = serial
			nova_speed = maxf(560.0, (geometry.radii.y * 2.0 + 60.0) / 0.62)
			event.emit(&"starfall")
			message.emit("Starfall · collect the gold", 1.6)
	if starfall_left <= 0.0:
		return
	invulnerable = maxf(invulnerable, starfall_left + 0.6)
	var elapsed = BEAT * 16.0 - starfall_left
	if wave_index < 3 and elapsed >= float(wave_index) * (BEAT * 16.0 / 3.0):
		var base = clampi(roundi(lane), 0, rings - 1)
		var near = base - 1 if base == rings - 1 else base + 1
		for j in 5:
			if count_kind("star") >= 30:
				break
			var star = spawn_star(angle + direction * (0.55 + j * 0.42), near if j % 3 == 2 else base)
			if star != null:
				star.starfall = true
				star.arrival_delay = j * 0.065
				star.warn = 0.68 + j * 0.045 + star.arrival_delay
				star.lifetime = 5.0 - star.warn
				star.depth = 1100.0
				star.position = geometry.world(star.angle, star.lane, star.depth, travel)
				star.previous = star.position
		wave_index += 1
	starfall_left = maxf(0.0, starfall_left - dt)
	if starfall_left <= 0.0:
		hazard_timer = maxf(hazard_timer, 1.2)

func activate_power(id: String) -> void:
	if id == "bh":
		id = "blackhole"
	if black_hole:
		return
	if not lab:
		power_collected[id] = true
	event.emit(&"magnet" if id == "spot" else &"power")
	match id:
		"shield":
			var cap = Content.shield_max(difficulty)
			if shields >= cap:
				score += 50
			else:
				shields += 1
		"warp": powers[id] = 9.0 if "slowworld" in upgrades else 6.0
		"spot": powers[id] = 16.0 if "stagelight" in upgrades else 10.0
		"hyper":
			hyper_duration = BEAT * (24.0 if "longstar" in upgrades else 16.0)
			powers[id] = hyper_duration
		"mirror": powers[id] = BEAT * (24.0 if "longmirror" in upgrades else 16.0)
		"scorch": powers[id] = 13.0 if "deepburn" in upgrades else 8.0
		"slip": powers[id] = 18.0 if "longslip" in upgrades else 12.0
		"nova":
			nova_age = 0.0
			nova_origin = player_position()
			nova_serial = serial
			nova_speed = maxf(560.0, (geometry.radii.y * 2.0 + 60.0) / 0.62)
			invulnerable = maxf(invulnerable, 0.95)
		"trail":
			for obj in objects:
				if obj.active and obj.kind == "star" and obj.bonus:
					obj.active = false
			var base = clampi(roundi(lane), 0, rings - 1)
			var other = base - 1 if base == rings - 1 else base + 1
			for j in 9:
				var star = spawn_star(angle + direction * (0.62 + j * 0.62), other if j % 2 else base, true)
				if star != null:
					star.lifetime = 24.0 if "longtrail" in upgrades else 16.0
		"blackhole":
			black_hole = true
			geometry.black_hole = true
			geometry.black_hole_mix = 0.0
			bh_phase = 1
			bh_warp = 0.0
			bh_close_age = 0.0
			bh_cooldown = time + 55.0
			teach_left = 0.0
			bh_time = 0.0
			bh_charge = 0.0
			bh_stars = 0
			bh_spent = 0
			bh_pull = 4.0
			previous_rings = rings
			rings = 4
			for obj in objects:
				if not obj.active:
					continue
				if obj.kind == "hazard":
					obj.active = false
				else:
					obj.suspended = true
			invulnerable = maxf(invulnerable, 1.15)
			message.emit("Inner ring builds charge. Escape when the route opens.", 3.5)
			return
		"starfall":
			starfall_wait = 0.0
			return
	var names = {"shield":"Shield", "warp":"Slow-mo", "spot":"Magnet", "hyper":"Hypernova", "mirror":"The Mirror", "scorch":"Scorch", "slip":"Slipstream", "nova":"Nova", "trail":"Star Trail"}
	message.emit(str(names.get(id, id)), 1.7)

func _update_black_hole(dt: float) -> void:
	if bh_phase == 1:
		bh_warp = minf(1.0, bh_warp + dt / 0.85)
		geometry.black_hole_mix = bh_warp
		if bh_warp >= 1.0:
			bh_phase = 2
		return
	if bh_phase == 3:
		bh_close_age += dt
		bh_warp = maxf(0.0, 1.0 - bh_close_age / 0.85)
		geometry.black_hole_mix = bh_warp
		if bh_warp <= 0.0:
			end_black_hole()
		return
	bh_time += dt
	if bh_time < 12.0:
		if target_lane == 3 and hop_progress >= 1.0:
			bh_charge = minf(1.0, bh_charge + dt / 8.0)
		if bh_time >= bh_pull:
			bh_pull += 4.0
			hop(1, true)
			invulnerable = maxf(invulnerable, 0.45)
	elif bh_time - dt < 12.0:
		message.emit("Escape · swipe out to the outer ring", 5.0)
	if bh_time >= 12.0 and target_lane == 0 and hop_progress >= 1.0:
		score += Content.black_hole_reward(bh_charge, bh_stars, bh_spent)
		_close_black_hole()
		event.emit(&"orbit")
		message.emit("Escaped · charge banked", 2.0)
	elif bh_time >= 17.0:
		_close_black_hole()
		_hit("black hole")
		invulnerable = maxf(invulnerable, 1.5)

func _close_black_hole() -> void:
	bh_phase = 3
	bh_close_age = 0.0
	rings = previous_rings
	for obj in objects:
		if obj.active and not obj.suspended and obj.lane >= rings:
			obj.active = false
	target_lane = mini(target_lane, rings - 1)
	lane = minf(lane, float(rings - 1))
	hop_from = lane
	hop_progress = 1.0
	invulnerable = maxf(invulnerable, 1.5)

func end_black_hole() -> void:
	black_hole = false
	bh_phase = 0
	bh_warp = 0.0
	geometry.black_hole = false
	geometry.black_hole_mix = 0.0
	rings = previous_rings
	target_lane = mini(target_lane, rings - 1)
	lane = float(target_lane)
	hop_progress = 1.0
	for obj in objects:
		if not obj.active:
			continue
		if obj.lane >= rings:
			obj.active = false
			continue
		obj.suspended = false
		if obj.current_flight:
			obj.position = obj.current_position
		elif not obj.captured:
			obj.position = geometry.world(obj.angle, obj.lane, obj.depth, travel)
		obj.previous = obj.position
	trail.clear()

func _update_objects(sd: float, dt: float, player_before: Vector3, player_after: Vector3) -> void:
	for obj in objects:
		if not obj.active:
			continue
		# Ordinary rewards and their lifetimes suspend during the voluntary black-hole event.
		if obj.suspended:
			continue
		obj.previous = obj.position
		obj.age += dt if obj.bonus or obj.starfall or obj.captured or obj.current_flight else sd
		if obj.age < obj.arrival_delay:
			continue
		obj.angle += obj.velocity * sd
		if obj.shape == "dive" and obj.age >= obj.warn * 0.55:
			obj.lane = obj.target_lane
		if obj.shape == "saucer":
			_update_saucer(obj, sd)
		if obj.warn > 0.0 and obj.age < obj.warn:
			obj.depth = 1100.0 * pow(1.0 - (obj.age - obj.arrival_delay) / maxf(0.001, obj.warn - obj.arrival_delay), 2.0)
		else:
			obj.depth = 0.0
		if obj.age > obj.warn + obj.lifetime:
			obj.active = false
			if obj.kind == "power" and not power_collected.has(obj.shape) and guaranteed_powers.has(obj.shape):
				guaranteed_powers[obj.shape] = false
			continue
		obj.position = obj.current_position if obj.current_flight else geometry.world(obj.angle, obj.lane, obj.depth, travel)
		if obj.kind == "star":
			if obj.finale_index < 0 and not obj.exit_sun and has_power("spot") and not obj.captured and absf(obj.lane - roundi(lane)) <= 1.0 and obj.position.distance_to(player_after) <= 110.0:
				obj.captured = true
				obj.current_flight = false
				obj.flight_from = obj.position
				obj.flight_age = 0.0
			if obj.captured:
				obj.flight_age = minf(0.38, obj.flight_age + dt)
				var t = obj.flight_age / 0.38
				var q = t * t * (3.0 - 2.0 * t)
				obj.position = obj.flight_from.lerp(player_after, q) + Vector3(0, 25.0 * sin(t * PI), 0)
				obj.age = minf(obj.age, obj.warn + obj.lifetime - 1.0)
		var distance = Geometry.swept_distance(obj.previous - player_before, obj.position - player_after)
		if obj.kind == "hazard":
			if obj.shape != "saucer" and has_power("mirror") and obj.lethal() and _mirror_contact(obj, sd):
				self.convert(obj)
				continue
			var sector = int(fposmod(obj.angle, TAU) / TAU * 72.0)
			if not black_hole and obj.shape != "saucer" and burn[clampi(roundi(obj.lane), 0, 3) * 72 + sector] > 0.0:
				self.convert(obj)
				continue
			if not obj.lethal():
				continue
			if obj.shape == "saucer":
				var shot_before = geometry.world(previous_angle, obj.lane, 0.0)
				var shot_after = geometry.world(angle, obj.lane, 0.0)
				distance = Geometry.swept_distance(shot_before - player_before, shot_after - player_after)
			obj.closest = minf(obj.closest, distance)
			if distance < 18.5:
				if has_power("hyper"):
					self.convert(obj)
				elif not lab and invulnerable <= 0.0:
					obj.hit = true
					obj.active = false
					_hit(obj.shape)
				if not running:
					return
			elif obj.shape != "saucer" and not obj.resolved and invulnerable <= 0.0 and distance < 28.5:
				var relevant_lane = roundi(obj.lane) == roundi(lane) or (hop_progress < 1.0 and roundi(obj.lane) == roundi(hop_from))
				if relevant_lane:
					obj.resolved = true
					score += 3
					flow = minf(1.0, flow + 0.1)
					heat = minf(1.0, heat + 0.1)
					event.emit(&"graze")
		elif distance < 22.0:
			if obj.kind == "star":
				collect(obj)
				if not running:
					return
			elif obj.kind == "power":
				obj.active = false
				activate_power(obj.shape)
		elif obj.kind == "star" and obj.finale_index < 0 and not obj.exit_sun and has_power("mirror") and not obj.bonus and not obj.captured and _mirror_contact(obj, sd):
			score += maxi(1, combo)
			difficulty_reward += 1.0
			obj.active = false

func _update_saucer(obj: Encounter, sd: float) -> void:
	if obj.age < obj.warn:
		obj.angle = angle - direction * 0.55
		obj.lane = float(roundi(lane))
		obj.heading = direction
	elif obj.beam_left > 0.0:
		obj.beam_left = maxf(0.0, obj.beam_left - sd)
		if obj.beam_left <= 0.0:
			obj.heading = direction
	elif obj.fire_time >= 0.0:
		if obj.age >= obj.fire_time:
			obj.beam_left = 0.42
			obj.fire_time = -1.0
	elif obj.heading != direction:
		obj.heading = direction
		obj.fire_time = obj.age + BEAT
	else:
		obj.angle = angle - direction * 0.55
		if roundi(obj.lane) != roundi(lane):
			obj.follow_wait += sd
			if obj.follow_wait >= 0.42:
				obj.lane = float(roundi(lane))
				obj.follow_wait = 0.0
		else:
			obj.follow_wait = 0.0

func _mirror_contact(obj: Encounter, sd: float) -> bool:
	var before = geometry.world(previous_angle + PI, previous_lane, 0.0)
	var after = geometry.world(angle + PI, lane, 0.0)
	return Geometry.swept_distance(obj.previous - before, obj.position - after) < 22.0 and sd >= 0.0

func collect(obj: Encounter) -> void:
	if not obj.active or obj.suspended:
		return
	if obj.exit_sun:
		if not finish_bloomed:
			return
		obj.active = false
		var bonus = 200 if finish_got >= 11 else 100
		score += bonus
		finish_score += bonus
		finish_level()
		return
	if obj.finale_index >= 0:
		obj.active = false
		finish_got += 1
		var paid = 60 if finish_age - finish_last_at < 1.3 else 30
		finish_last_at = finish_age
		score += paid
		finish_score += paid
		event.emit(&"star")
		return
	obj.active = false
	combo = mini(6, combo + 1)
	combo_time = 2.5
	lap_stars += 1
	difficulty_reward += 1.0
	var full = shields >= Content.shield_max(difficulty)
	score += Content.star_score(combo, obj.bonus, black_hole and bh_phase == 2 and roundi(obj.lane) == rings - 1, starfall_left > 0.0, overdrive_left > 0.0, has_power("hyper"), full, black_hole)
	flow = minf(1.0, flow + 0.09)
	if black_hole:
		bh_stars += 1
	event.emit(&"star")
	if tutorial == 1:
		tutorial = 2
		lap = 0.0
		message.emit("Go all the way around without turning", 100.0)

func _hit(cause: String) -> void:
	last_hit = cause
	event.emit(&"hit")
	if lab:
		return
	if shields > 0:
		shields -= 1
		bh_spent += 1 if black_hole else 0
		invulnerable = 0.9
		message.emit("Shield saved you · %d left" % shields, 1.5)
	else:
		running = false
		ended.emit(false)

func finish_level() -> void:
	if not running:
		return
	running = false
	event.emit(&"finish")
	ended.emit(true)

func _take() -> Encounter:
	for obj in objects:
		if not obj.active:
			serial += 1
			obj.reset(serial)
			return obj
	return null

func spawn_star(a: float, ring: int, bonus: bool = false) -> Encounter:
	var obj = _take()
	if obj == null:
		return null
	obj.angle = a
	obj.lane = float(ring)
	obj.bonus = bonus
	obj.warn = 0.0
	obj.lifetime = rng.randf_range(7.0, 10.0)
	obj.depth = 0.0
	obj.position = geometry.world(a, ring, obj.depth, travel)
	obj.previous = obj.position
	return obj

func spawn_random_star() -> void:
	for attempt in 14:
		var a = rng.randf_range(-PI, PI)
		var ring = rng.randi_range(0, rings - 1)
		var width = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(ring)))
		if clear_place(a, ring, 0.45, width * 2.8, width * 3.9):
			spawn_star(a, ring)
			return

func clear_place(a: float, ring: int, player_margin: float, hazard_spacing: float = -1.0, reward_spacing: float = -1.0, behind: float = 0.0) -> bool:
	if ring < 0 or ring >= rings:
		return false
	if behind > 0.0:
		var along = fposmod((a - angle) * direction, TAU)
		if along < player_margin or along > TAU - behind:
			return false
	elif absf(angle_difference(angle, a)) < player_margin:
		return false
	var width = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(ring)))
	var red_space = width * 3.5 if hazard_spacing < 0.0 else hazard_spacing
	var gold_space = width * 2.5 if reward_spacing < 0.0 else reward_spacing
	for obj in objects:
		if not obj.active or obj.suspended or obj.hit:
			continue
		var reserves_lane = roundi(obj.lane) == ring or (obj.shape == "dive" and roundi(obj.target_lane) == ring)
		if reserves_lane and absf(angle_difference(obj.angle, a)) < (red_space if obj.kind == "hazard" else gold_space):
			return false
	return true

func _wall_present() -> bool:
	for obj in objects:
		if obj.active and obj.kind == "hazard" and not obj.hit and obj.shape in ["gate", "driftgate", "funnel"]:
			return true
	return false

func _reverse_escape(min_arc: float = 1.1) -> bool:
	for ring in rings:
		var clear = true
		for obj in objects:
			if obj.active and obj.kind == "hazard" and not obj.hit and roundi(obj.lane) == ring:
				if fposmod((obj.angle - angle) * -direction, TAU) < min_arc:
					clear = false
					break
		if clear:
			return true
	return false

func _shape_allowed(shape: String) -> bool:
	if rings < 2 and shape in ["twin", "blinktwin", "dive", "funnel", "saucer"]:
		return false
	if not did_hop and difficulty < 30.0 and shape in ["twin", "blinktwin"]:
		return false
	var pairs = 0
	var saucer_present = false
	for obj in objects:
		if obj.active and obj.kind == "hazard":
			pairs += 1 if obj.shape in ["twin", "blinktwin"] else 0
			saucer_present = saucer_present or obj.shape == "saucer"
	if difficulty >= 340.0 and pairs >= 4 and shape in ["twin", "blinktwin"]:
		return false
	if shape in ["gate", "driftgate", "funnel", "saucer"] and (_wall_present() or saucer_present):
		return false
	return shape != "saucer" or time >= saucer_cooldown

func spawn_hazard(shape: String, a: float, ring: int, warning: float = -1.0) -> Encounter:
	if ring < 0 or ring >= rings:
		return null
	var obj = _take()
	if obj == null:
		return null
	obj.kind = "hazard"
	obj.shape = shape
	obj.angle = a
	obj.lane = float(ring)
	obj.target_lane = float(ring)
	obj.heading = direction
	obj.warn = Content.warning_time(difficulty) if warning < 0.0 else warning
	var offset = fposmod(time + obj.warn, BEAT * 0.5)
	if offset > 0.001:
		obj.warn += BEAT * 0.5 - offset
	obj.lifetime = rng.randf_range(2.6, 4.4) * (0.7 if level_time < 30.0 else 1.0)
	obj.depth = 1100.0
	obj.position = geometry.world(a, ring, obj.depth, travel)
	obj.previous = obj.position
	return obj

func _teach_shape(shape: String) -> void:
	if seen.has(shape) or lab or black_hole or finish_age >= 0.0 or time < teach_next:
		return
	for id in powers:
		if has_power(str(id)):
			return
	for obj in objects:
		if obj.active and ((obj.kind == "hazard" and obj.lethal() and roundi(obj.lane) == roundi(lane) and absf(angle_difference(obj.angle, angle)) < 1.2) or obj.bonus):
			return
	for tier in tier_rows:
		if str(tier.type) == shape:
			seen[shape] = true
			teach_next = time + 9.0
			teach_left = 2.8
			message.emit(str(tier.lesson), 2.8)
			return

func spawn_formation() -> void:
	if black_hole and (bh_phase != 2 or bh_time >= 12.0):
		return
	var available: Array[String] = []
	var unseen = ""
	for tier in tier_rows:
		var shape_id = str(tier.type)
		if shape_id.is_empty() or float(tier.at) > difficulty or not _shape_allowed(shape_id):
			continue
		if unseen.is_empty() and not seen.has(shape_id):
			unseen = shape_id
		var weight = 1 + roundi(clampf((difficulty - 340.0) / 560.0, 0.0, 1.0) * int(shape_rank.get(shape_id, 0)) * 1.5)
		for unused in weight:
			available.append(shape_id)
	var shape = unseen if not unseen.is_empty() else (available[rng.randi_range(0, available.size() - 1)] if not available.is_empty() else "single")
	if black_hole:
		shape = "drift" if rng.randf() < 0.25 else "single"
	if shape in ["gate", "driftgate"] and not _reverse_escape():
		shape = "single"
	if shape == "saucer":
		var saucer = spawn_hazard(shape, angle - direction * 0.55, clampi(roundi(lane), 0, rings - 1), Content.warning_time(difficulty) * (1.0 if seen.has(shape) else 1.6))
		if saucer != null:
			saucer.lifetime = rng.randf_range(5.0, 7.5)
			saucer_cooldown = time + rng.randf_range(9.0, 15.0)
			_teach_shape(shape)
		return
	var clear_arc = 1.5 if level_time < 26.0 else 1.1
	var behind = 0.0 if _wall_present() else maxf(0.45, speed * 0.16)
	for attempt in 18:
		var relax = 1.0 - 0.45 * (float(attempt) / 17.0)
		var a = rng.randf_range(-PI, PI)
		var ring = rng.randi_range(0, rings - 1)
		if black_hole and rng.randf() < 0.45:
			ring = mini(rings - 1, ring + 1)
		var width = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(ring)))
		var warning = Content.warning_time(difficulty) * (1.6 if not seen.has(shape) and shape in ["gate","driftgate","funnel","drift","blink","dive"] else 1.0)
		if shape in ["gate", "driftgate", "funnel"]:
			var current = clampi(roundi(lane), 0, rings - 1)
			var gap = current + (1 if current == 0 else (-1 if current == rings - 1 else (1 if rng.randf() < 0.5 else -1)))
			var valid = true
			for r in rings:
				var spacing = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(r)))
				if not clear_place(a, r, 2.2 if shape == "funnel" and r == gap else 1.7, spacing * 3.5 * relax, spacing * 2.5 * relax):
					valid = false
			if not valid:
				continue
			var lifetime = rng.randf_range(2.0, 3.0) if shape == "funnel" else rng.randf_range(1.9, 2.9)
			var velocity = rng.randf_range(0.18, 0.34) * (-1.0 if rng.randf() < 0.5 else 1.0) if shape == "driftgate" else 0.0
			for r in rings:
				if shape == "funnel" and r == gap:
					continue
				var wall = spawn_hazard(shape, a, r, warning)
				if wall != null:
					wall.lifetime = lifetime
					wall.velocity = velocity
					wall.target_lane = float(gap) if shape == "funnel" else float(r)
			_teach_shape(shape)
			return
		if not clear_place(a, ring, clear_arc, width * 3.5 * relax, width * 2.5 * relax, behind):
			continue
		if shape in ["twin", "blinktwin"]:
			var offset = rng.randf_range(0.30, 0.40) * (-1.0 if rng.randf() < 0.5 else 1.0)
			if not clear_place(a + offset, ring, clear_arc, width * 3.5 * relax, width * 2.5 * relax, behind):
				continue
			var first = spawn_hazard(shape, a, ring, warning)
			if first == null:
				return
			var second = spawn_hazard(shape, a + offset, ring, first.warn)
			if second == null:
				first.active = false
				return
			first.lifetime = rng.randf_range(4.4, 6.2) if shape == "blinktwin" else rng.randf_range(2.4, 3.6)
			second.lifetime = first.lifetime
			second.warn = first.warn
			if shape == "blinktwin":
				first.blink_duty = 0.5
				second.blink_duty = 0.5
				second.blink_offset = BEAT
			_teach_shape(shape)
			return
		var destination = ring
		if shape == "dive":
			destination = ring + (1 if ring == 0 else (-1 if ring == rings - 1 else (1 if rng.randf() < 0.5 else -1)))
			var to_width = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(destination)))
			if not clear_place(a, destination, clear_arc, to_width * 3.5 * relax, to_width * 2.5 * relax, behind):
				continue
		var obj = spawn_hazard(shape, a, ring, warning)
		if obj == null:
			return
		if shape == "drift":
			obj.velocity = rng.randf_range(0.24, 0.5) * (-1.0 if rng.randf() < 0.5 else 1.0)
			obj.lifetime = rng.randf_range(3.4, 5.2)
		elif shape == "blink":
			obj.lifetime = rng.randf_range(4.0, 6.0)
		elif shape == "dive":
			obj.target_lane = float(destination)
			obj.lifetime = rng.randf_range(3.0, 4.6)
		_teach_shape(shape)
		return
func spawn_power() -> void:
	if lab and lab_power == "tidal":
		return
	var id = "shield"
	var level = level_index + 1
	if lab:
		id = "blackhole" if lab_power == "bh" else lab_power
	elif intro_power_count < 3:
		id = ["shield", "warp", "nova"][intro_power_count]
	elif since_shield >= 3:
		id = "shield"
	elif level >= 4 and not bool(guaranteed_powers.get("blackhole", false)) and time >= bh_cooldown:
		id = "blackhole"
	elif level >= 3 and time >= bh_cooldown and rng.randf() < 0.05:
		id = "blackhole"
	else:
		var guarantee = ""
		for pair in [["hyper",2],["mirror",4],["scorch",5],["spot",3],["slip",2],["trail",3]]:
			if level >= int(pair[1]) and not bool(guaranteed_powers.get(pair[0], false)):
				guarantee = str(pair[0])
				break
		if not guarantee.is_empty():
			id = guarantee
		else:
			var total = 0.0
			for power in power_rows:
				if str(power.id) != "blackhole" and int(power.min_level) <= level:
					total += float(power.weight)
			var pick = rng.randf() * total
			for power in power_rows:
				if str(power.id) == "blackhole" or int(power.min_level) > level:
					continue
				pick -= float(power.weight)
				if pick <= 0.0:
					id = str(power.id)
					break
	for attempt in 24:
		var a = rng.randf_range(-PI, PI)
		var ring = rng.randi_range(0, rings - 1)
		var width = 18.5 / maxf(1.0, geometry.radii.x * geometry.radius(float(ring)))
		if not clear_place(a, ring, 0.6, width * 3.2, width * 3.0):
			continue
		var obj = _take()
		if obj == null:
			return
		obj.kind = "power"
		obj.shape = id
		obj.angle = a
		obj.lane = float(ring)
		obj.warn = 0.0
		obj.lifetime = 7.0
		obj.depth = 0.0
		obj.position = geometry.world(a, ring, 0.0)
		obj.previous = obj.position
		power_count += 1
		if not lab:
			if intro_power_count < 3 and id == ["shield", "warp", "nova"][intro_power_count]:
				intro_power_count += 1
			if guaranteed_powers.has(id):
				guaranteed_powers[id] = true
			if id == "blackhole":
				bh_cooldown = time + 20.0
			since_shield = 0 if id == "shield" else since_shield + 1
		return
	power_timer = 0.5

func convert(obj: Encounter, to_ring: int = -1) -> void:
	if not obj.active or obj.kind != "hazard":
		return
	var destination = clampi(roundi(lane) if to_ring < 0 else to_ring, 0, rings - 1)
	var source_angle = obj.angle
	var amount = 2 if "richnova" in upgrades else 1
	for i in amount:
		var star = obj if i == 0 else _take()
		if star == null:
			return
		for attempt in 8:
			var overlap = false
			for other in objects:
				if other != star and other.active and other.kind == "star" and roundi(other.lane) == destination and absf(angle_difference(source_angle, other.angle)) < 0.30:
					overlap = true
					break
			if not overlap:
				break
			source_angle += 0.36 * direction
		star.active = true
		star.kind = "star"
		star.shape = "single"
		star.hit = false
		star.resolved = true
		star.age = 0.0
		star.warn = 0.0
		star.lifetime = rng.randf_range(6.0, 8.0)
		star.angle = source_angle
		star.lane = float(destination)
		star.target_lane = float(destination)
		star.velocity = 0.0
		star.bonus = false
		star.captured = false
		star.starfall = false
		star.suspended = false
		star.depth = 0.0
		star.position = geometry.world(star.angle, star.lane, 0.0)
		star.previous = star.position
func count_kind(kind: String) -> int:
	var count = 0
	for obj in objects:
		if obj.active and not obj.suspended and obj.kind == kind:
			count += 1
	return count
