extends RefCounted
## A physical material current with shared geometry for the mesh and real stars.
## It never awards score, orbit progress, shields or invulnerability directly.

const WARNING_SECONDS: float = 3.0
const MAX_BOOST: float = 0.35
const SECTOR_HALF_WIDTH: float = 0.40
const STAR_LIMIT: int = 12
const STAR_GAP: float = 0.44
const KNOTS: Array[float] = [0.0, 0.26, 0.50, 0.68, 0.82, 1.0]
const LANE_ANCHORS: Array[float] = [0.50, 0.68, 0.82]

var active: bool = false
var warning: float = 0.0
var age: float = 0.0
var duration: float = 8.0
var angle: float = 0.0
var lane: int = 1
var direction: float = 1.0
var element: String = "nebula"
var source: Vector3 = Vector3(320.0, 160.0, -900.0)
var width: float = 8.0
var entered: bool = false
var stars_issued: int = 0
var _spawn_left: float = 0.0
var _points: PackedVector3Array = PackedVector3Array()
var _path_ready: bool = false
var _last_radii: Vector2 = Vector2.ZERO
var _last_source: Vector3 = Vector3.ZERO
var _last_angle: float = 0.0
var _last_direction: float = 0.0
var _last_black_hole: bool = false
var _last_black_hole_mix: float = -1.0


func _init() -> void:
	_points.resize(KNOTS.size())


func begin(sim, material: String, origin: Vector3) -> bool:
	if active or not sim.running or sim.paused or sim.black_hole or sim.finish_age >= 0.0 or sim.tutorial >= 0 or sim.rings < 2:
		return false
	reset()
	element = material if material in ["nebula", "molten", "ice"] else "nebula"
	source = origin
	if not source.is_finite():
		source = Vector3(320.0, 160.0, -900.0)
	direction = 1.0 if sim.direction >= 0.0 else -1.0
	lane = mini(1, sim.rings - 1)
	# Orient the passage toward the actual world-space stellar source. Elliptical
	# normalization retains the orbital angle used by gameplay and projection.
	var radial: Vector2 = Vector2(source.x / maxf(1.0, sim.geometry.radii.x), -source.y / maxf(1.0, sim.geometry.radii.y))
	angle = atan2(radial.y, radial.x) if radial.length_squared() > 0.0001 else sim.angle + direction * 1.1
	active = true
	warning = WARNING_SECONDS
	_refresh_path(sim)
	sim.event.emit(&"tide_warning")
	return true


func reset() -> void:
	active = false
	warning = 0.0
	age = 0.0
	duration = 8.0
	entered = false
	stars_issued = 0
	_spawn_left = 0.0
	_path_ready = false


func lane_angle(ring: float) -> float:
	# All lane intersections carry the same angular flow direction, with a small
	# inward braid. This function also defines the matching sectors for the boost.
	return angle + direction * (0.18 * ring + 0.04 * ring * ring)


func factor(sim) -> float:
	if not active or warning > 0.0 or sim.paused or not sim.running or sim.black_hole or sim.finish_age >= 0.0:
		return 1.0
	if sim.direction * direction <= 0.0 or sim.lane < -0.05 or sim.lane > minf(2.0, float(sim.rings - 1)) + 0.05:
		return 1.0
	var distance: float = absf(angle_difference(lane_angle(sim.lane), sim.angle))
	if distance >= SECTOR_HALF_WIDTH:
		return 1.0
	var sector: float = 1.0 - smoothstep(0.14, SECTOR_HALF_WIDTH, distance)
	var opening: float = smoothstep(0.0, 0.45, age)
	var closing: float = smoothstep(0.0, 0.9, duration - age)
	return clampf(1.0 + MAX_BOOST * sector * opening * closing, 1.0, 1.0 + MAX_BOOST)


func step(sim, dt: float) -> void:
	if dt <= 0.0 or not sim.running or sim.paused or sim.black_hole or sim.finish_age >= 0.0:
		return
	if not active:
		return
	var live_dt: float = dt
	if warning > 0.0:
		var waiting: float = minf(warning, live_dt)
		warning = maxf(0.0, warning - waiting)
		live_dt -= waiting
		_refresh_path(sim)
		if warning > 0.0:
			return
		sim.event.emit(&"tide")
	age = minf(duration, age + live_dt)
	_refresh_path(sim)
	_update_flights(sim, live_dt)
	# The field gives existing elemental powers once, only after the player rides
	# it in the matching direction. Existing longer powers are never shortened.
	if not entered and factor(sim) > 1.001:
		entered = true
		var power: String = "spot" if element == "nebula" else ("scorch" if element == "molten" else "warp")
		var held: float = float(sim.powers.get(power, 0.0))
		sim.activate_power(power)
		sim.powers[power] = maxf(held, 4.0)
		sim.event.emit(&"tide_enter")
	# Leave the final two seconds for arrivals and a calm geometric recovery.
	if age < duration - 2.1 and sim.starfall_left <= 0.0:
		_spawn_left -= live_dt
		while _spawn_left <= 0.0 and stars_issued < STAR_LIMIT:
			_spawn_left += STAR_GAP
			if sim.count_kind("star") >= 30:
				break
			_spawn_star(sim)
	if age >= duration:
		active = false
		warning = 0.0
		sim.event.emit(&"tide_end")


func _spawn_star(sim) -> void:
	var ring: int = stars_issued % mini(3, sim.rings)
	var star = sim.spawn_star(lane_angle(float(ring)), ring)
	if star == null:
		return
	stars_issued += 1
	star.shape = "tidal"
	star.current_lane = ring
	star.current_t = 0.0
	star.current_flight = true
	star.current_position = point(sim, 0.0)
	star.position = star.current_position
	star.previous = star.position
	star.depth = maxf(0.0, -star.position.z)
	star.lifetime = 7.0
	star.warn = 0.0
	star.velocity = 0.0
	star.bonus = false
	star.starfall = false


func _update_flights(sim, dt: float) -> void:
	for star in sim.objects:
		if not star.active or not star.current_flight or star.shape != "tidal" or star.suspended:
			continue
		if star.captured:
			star.current_flight = false
			continue
		var ring: int = clampi(star.current_lane, 0, 2)
		var anchor: float = LANE_ANCHORS[ring]
		var flight_seconds: float = 1.7 + float(ring) * 0.16
		star.current_t = minf(anchor, star.current_t + dt * anchor / flight_seconds)
		star.current_position = point(sim, star.current_t)
		star.depth = maxf(0.0, -star.current_position.z)
		if star.current_t >= anchor:
			# The last streamed point and the first ordinary orbital point coincide.
			# Encounter.previous remains simulation-owned for its relative sweep.
			star.current_flight = false
			star.angle = lane_angle(float(ring))
			star.lane = float(ring)
			star.target_lane = float(ring)
			star.depth = 0.0
			star.current_position = sim.geometry.world(star.angle, star.lane, 0.0)


func _refresh_path(sim) -> void:
	_last_radii = sim.geometry.radii
	_last_source = source
	_last_angle = angle
	_last_direction = direction
	_last_black_hole = bool(sim.geometry.black_hole)
	_last_black_hole_mix = float(sim.geometry.black_hole_mix)
	_points[0] = source
	_points[2] = sim.geometry.world(lane_angle(0.0), 0.0, 0.0)
	_points[3] = sim.geometry.world(lane_angle(1.0), 1.0, 0.0)
	_points[4] = sim.geometry.world(lane_angle(2.0), 2.0, 0.0)
	var tangent: Vector3 = Vector3(-sin(angle) * _last_radii.x, -cos(angle) * _last_radii.y, 0.0).normalized() * direction
	_points[1] = source.lerp(_points[2], 0.64) - tangent * (55.0 + 9.0 * sin(age * 0.8))
	_points[5] = Vector3(0.0, 0.0, -850.0)
	_path_ready = true


func point(sim, t: float) -> Vector3:
	if not _path_ready or _last_radii != sim.geometry.radii or _last_source != source or _last_angle != angle or _last_direction != direction or _last_black_hole != bool(sim.geometry.black_hole) or _last_black_hole_mix != float(sim.geometry.black_hole_mix):
		_refresh_path(sim)
	var at: float = clampf(t, 0.0, 1.0)
	var segment: int = 0
	while segment < KNOTS.size() - 2 and at > KNOTS[segment + 1]:
		segment += 1
	var span: float = KNOTS[segment + 1] - KNOTS[segment]
	var u: float = (at - KNOTS[segment]) / span
	var u2: float = u * u
	var u3: float = u2 * u
	# Nonuniform cubic Hermite segments share global derivatives at every knot.
	# Thus source/deep-space curvature cannot move the exact orbital anchors.
	return _points[segment] * (2.0 * u3 - 3.0 * u2 + 1.0) + _tangent(segment) * span * (u3 - 2.0 * u2 + u) + _points[segment + 1] * (-2.0 * u3 + 3.0 * u2) + _tangent(segment + 1) * span * (u3 - u2)


func _tangent(index: int) -> Vector3:
	if index == 0:
		return (_points[1] - _points[0]) / (KNOTS[1] - KNOTS[0])
	if index == _points.size() - 1:
		return (_points[index] - _points[index - 1]) / (KNOTS[index] - KNOTS[index - 1])
	return (_points[index + 1] - _points[index - 1]) / (KNOTS[index + 1] - KNOTS[index - 1])
