extends RefCounted
## Shared world space. Camera, rails, telegraphs, stars and collision use this model.
const RADII = [1.0, 0.76, 0.545, 0.0]
const BLACK_HOLE_RADII = [1.0, 0.80, 0.62, 0.45]
var black_hole = false
var black_hole_mix = 1.0
var center = Vector2(270, 480)
var radii = Vector2(218, 308)
var focal_length = 900.0

func radius(lane: float) -> float:
	var i = clampi(int(floor(lane)), 0, 3)
	var blend = clampf(black_hole_mix, 0.0, 1.0) if black_hole else 0.0
	var a = lerpf(RADII[i], BLACK_HOLE_RADII[i], blend)
	var j = mini(i + 1, 3)
	var b = lerpf(RADII[j], BLACK_HOLE_RADII[j], blend)
	return lerpf(a, b, clampf(lane - i, 0.0, 1.0))

func orbit(angle: float, lane: float) -> Vector2:
	return center + Vector2(cos(angle) * radii.x, sin(angle) * radii.y) * radius(lane)

func bend(depth: float, travel: float) -> Vector2:
	# Exactly zero at the encounter plane. Decorative curvature never moves a hitbox.
	var d = maxf(0.0, depth) / 900.0
	return Vector2(sin(d * 1.7 + travel * 0.0003) * 90.0, sin(d * 0.8) * -95.0) * d

func world(angle: float, lane: float, depth: float, travel: float = 0.0) -> Vector3:
	var p = orbit(angle, lane) - center + bend(depth, travel)
	return Vector3(p.x, -p.y, -depth)

func project_world(p: Vector3) -> Vector2:
	var scale_factor = focal_length / maxf(10.0, focal_length - p.z)
	return center + Vector2(p.x, -p.y) * scale_factor

func project(angle: float, lane: float, depth: float, travel: float = 0.0) -> Vector2:
	return project_world(world(angle, lane, depth, travel))

static func swept_distance(relative_start: Vector3, relative_end: Vector3) -> float:
	var segment = relative_end - relative_start
	var t = clampf(-relative_start.dot(segment) / maxf(segment.length_squared(), 0.000001), 0.0, 1.0)
	return (relative_start + segment * t).length()
