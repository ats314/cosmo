extends Node2D
## A single composed procedural world. The caller owns the clock and pause state.
## Source palette/planet identities: Cosmo src/game/runtime.js WORLDS, adapted for
## native portrait rendering. All shader code is original; no external artwork.

const NEBULA_SHADER := preload("res://shaders/living_nebula.gdshader")
const PLANET_SHADER := preload("res://shaders/celestial_planet.gdshader")
const LANE_RADII := [1.0, 0.76, 0.545, 0.45]
const NORMAL_LANE_RADII := [1.0, 0.76, 0.545, 0.45]
const BLACK_HOLE_LANE_RADII := [1.0, 0.80, 0.62, 0.45]
const WORLD_NAMES := ["DRIFT", "TIDE", "DUSTLANE", "GLASS", "EMBERFALL", "VEIL", "GRID", "DEEPFIELD"]
const WORLD_TINTS := [Color(0.20, 0.39, 0.74), Color(0.10, 0.52, 0.48), Color(0.58, 0.34, 0.15), Color(0.25, 0.48, 0.68), Color(0.68, 0.18, 0.10), Color(0.44, 0.18, 0.69), Color(0.48, 0.23, 0.36), Color(0.10, 0.25, 0.45)]
const WORLD_RIMS := [Color(0.59, 0.87, 1.00), Color(0.56, 1.00, 0.86), Color(1.00, 0.78, 0.43), Color(0.78, 0.95, 1.00), Color(1.00, 0.65, 0.26), Color(0.90, 0.62, 1.00), Color(1.00, 0.65, 0.77), Color(0.41, 0.69, 0.96)]
const WORLD_DUST := [Color(0.53, 0.15, 0.40), Color(0.10, 0.24, 0.55), Color(0.38, 0.12, 0.24), Color(0.12, 0.25, 0.38), Color(0.45, 0.12, 0.48), Color(0.15, 0.39, 0.59), Color(0.22, 0.16, 0.50), Color(0.21, 0.12, 0.46)]
# lean, bend, grain, tilt, flatten, rock, clouds, sun
const WORLD_SHAPES := [
	[0.48, 1.80, 0.85, -0.38, 0.24, 0.12, 0.88, 0.78],
	[-0.38, -1.70, 0.65, 0.38, 0.18, 0.58, 0.72, 0.68],
	[1.02, 1.90, 1.00, 0.24, 0.22, 0.92, 0.18, 2.18],
	[0.12, 1.15, 0.38, 0.82, 0.34, 0.35, 0.96, 0.15],
	[-0.68, -2.40, 0.90, -0.60, 0.23, 0.84, 0.14, 2.77],
	[0.66, 1.70, 0.90, -0.32, 0.29, 0.12, 0.80, 0.63],
	[1.35, 0.50, 0.28, 0.12, 0.13, 1.00, 0.22, 0.15],
	[-0.22, -1.80, 0.55, 0.50, 0.42, 0.62, 0.60, 2.70],
]
# Monumental limbs leave a quiet near encounter section. Coordinates are fractions
# of viewport width; the authored sides/scale vary with the destination.
const PLANET_PLACEMENTS := [
	Vector3(-0.235, 0.140, 0.725), Vector3(1.22, 0.185, 0.66),
	Vector3(0.20, -0.42, 0.70), Vector3(-0.22, 1.14, 0.66),
	Vector3(1.27, 0.32, 0.73), Vector3(-0.22, -0.03, 0.70),
	Vector3(-0.28, 0.25, 0.71), Vector3(1.20, 1.17, 0.67),
]

var _nebula: ColorRect
var _planet: ColorRect
var _singularity: ColorRect
var _sky_material: ShaderMaterial
var _planet_material: ShaderMaterial
var _singularity_material: ShaderMaterial
var _size := Vector2(540.0, 960.0)
var _center := Vector2(270.0, 480.0)
var _radii := Vector2(218.0, 310.0)
var _world := 0
var _journey := -1.0
var _planet_placement := Vector3(-0.235, 0.140, 0.725)
var _clock := 0.0
var _visual_clock := 0.0
var _visual_travel := 0.0
var _last_forward := 0.0
var _last_angle := 0.0
var _last_lane := 1.0
var _has_sample := false
var _wake_phase := 0.0
var _player_direction := 1.0
var _turn_strength := 0.0
var _turn_angle := 0.0
var _hop_strength := 0.0
var _hop_angle := 0.0
var _hop_radius := 0.76
var _release := 0.0
var _tunnel_enabled := true
var _singularity_strength := 1.0
var _tidal_strength := 0.0
var _tidal_phase := 0.0
var _tidal_last_clock := 0.0


func _ready() -> void:
	_ensure_layers()
	configure(_size, _center, _radii)
	set_world(_world)


func _ensure_layers() -> void:
	if is_instance_valid(_nebula):
		return
	z_index = -100
	_sky_material = ShaderMaterial.new()
	_sky_material.shader = NEBULA_SHADER
	_planet_material = ShaderMaterial.new()
	_planet_material.shader = PLANET_SHADER
	_singularity_material = ShaderMaterial.new()
	_singularity_material.shader = SINGULARITY_SHADER
	_nebula = _make_layer("LivingNebula", _sky_material)
	_planet = _make_layer("CelestialPlanet", _planet_material)
	_singularity = _make_layer("Singularity", _singularity_material)


func _make_layer(layer_name: String, shader_material: ShaderMaterial) -> ColorRect:
	var layer := ColorRect.new()
	layer.name = layer_name
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.material = shader_material
	layer.color = Color.WHITE
	add_child(layer)
	return layer


func configure(size: Vector2, center: Vector2, radii: Vector2) -> void:
	_size = size
	_center = center
	_radii = radii
	_ensure_layers()
	_nebula.size = size
	_planet.size = size
	_singularity.size = Vector2(240.0, 240.0) * size.x / 540.0
	_singularity.position = center - _singularity.size * 0.5
	_sky_material.set_shader_parameter("viewport_size", size)
	_sky_material.set_shader_parameter("arena_center", center)
	_sky_material.set_shader_parameter("arena_radii", radii)
	_planet_material.set_shader_parameter("viewport_size", size)
	_apply_planet_placement()


func set_world(index: int) -> void:
	_world = posmod(index, WORLD_NAMES.size())
	_journey = float(_world)
	_ensure_layers()
	_apply_world_blend(_world, _world, 0.0)


func set_journey(value: float) -> void:
	## Authored portraits blend over the final fifth of each leg. The last world
	## remains a destination; this does not invent an endless gameplay level.
	var journey := clampf(value, 0.0, float(WORLD_NAMES.size() - 1))
	if is_equal_approx(journey, _journey):
		return
	_journey = journey
	_world = floori(journey)
	var next_world := mini(_world + 1, WORLD_NAMES.size() - 1)
	var blend := smoothstep(0.80, 1.0, journey - float(_world))
	_ensure_layers()
	_apply_world_blend(_world, next_world, blend)


func _apply_world_blend(first: int, second: int, blend: float) -> void:
	var tint: Color = WORLD_TINTS[first].lerp(WORLD_TINTS[second], blend)
	var rim: Color = WORLD_RIMS[first].lerp(WORLD_RIMS[second], blend)
	var dust: Color = WORLD_DUST[first].lerp(WORLD_DUST[second], blend)
	for shader_material in [_sky_material, _planet_material]:
		shader_material.set_shader_parameter("world_tint", tint)
		shader_material.set_shader_parameter("world_rim", rim)
		shader_material.set_shader_parameter("world_dust", dust)
		shader_material.set_shader_parameter("world_seed", lerpf(float(first), float(second), blend))
	_singularity_material.set_shader_parameter("world_rim", rim)
	var shape_a: Array = WORLD_SHAPES[first]
	var shape_b: Array = WORLD_SHAPES[second]
	_sky_material.set_shader_parameter("field_lean", lerpf(shape_a[0], shape_b[0], blend))
	_sky_material.set_shader_parameter("field_bend", lerpf(shape_a[1], shape_b[1], blend))
	_sky_material.set_shader_parameter("field_grain", lerpf(shape_a[2], shape_b[2], blend))
	_planet_material.set_shader_parameter("planet_tilt", lerpf(shape_a[3], shape_b[3], blend))
	_planet_material.set_shader_parameter("planet_flatten", lerpf(shape_a[4], shape_b[4], blend))
	_planet_material.set_shader_parameter("rock_amount", lerpf(shape_a[5], shape_b[5], blend))
	_planet_material.set_shader_parameter("cloud_amount", lerpf(shape_a[6], shape_b[6], blend))
	_planet_material.set_shader_parameter("light_angle", lerp_angle(shape_a[7], shape_b[7], blend))
	_planet_placement = PLANET_PLACEMENTS[first].lerp(PLANET_PLACEMENTS[second], blend)
	_apply_planet_placement()


func _apply_planet_placement() -> void:
	var placement: Vector3 = _planet_placement
	_planet_material.set_shader_parameter("planet_center", Vector2(placement.x, placement.y) * _size.x)
	_planet_material.set_shader_parameter("planet_radius", placement.z * _size.x)


func get_tidal_source(geometry) -> Vector3:
	## The current starts on this authored planet's visible rim, then enters the same
	## world space as the comet. Inverse projection preserves the exact source pixel.
	var placement: Vector3 = _planet_placement
	var planet_center := Vector2(placement.x, placement.y) * _size.x
	var planet_radius := placement.z * _size.x
	var toward_arena: Vector2 = (geometry.center - planet_center).normalized()
	var source_pixel: Vector2 = planet_center + toward_arena * (planet_radius * 0.994)
	var depth := 900.0
	var projection_scale: float = (float(geometry.focal_length) + depth) / float(geometry.focal_length)
	var local: Vector2 = (source_pixel - geometry.center) * projection_scale
	return Vector3(local.x, -local.y, -depth)


func update_tidal(tidal, geometry) -> void:
	## Extraction changes only a localized patch's texture flow. The source point
	## and body silhouette stay pinned to the shared physical bridge geometry.
	_ensure_layers()
	if _visual_clock < _tidal_last_clock:
		_tidal_strength = 0.0
		_tidal_phase = 0.0
	var delta := maxf(0.0, _visual_clock - _tidal_last_clock)
	_tidal_last_clock = _visual_clock
	var active: bool = tidal != null and tidal.active and (geometry == null or not bool(geometry.black_hole))
	var target := 0.0
	if active:
		var growing := clampf(1.0 - float(tidal.warning) / 3.0, 0.0, 1.0)
		target = smoothstep(0.0, 1.0, growing)
		var placement: Vector3 = _planet_placement
		var planet_center := Vector2(placement.x, placement.y) * _size.x
		var source_pixel: Vector2 = geometry.project_world(tidal.source)
		var local_point := (source_pixel - planet_center) / (placement.z * _size.x)
		_planet_material.set_shader_parameter("tidal_point", local_point)
	_tidal_strength = move_toward(_tidal_strength, target, delta * (0.70 if active else 0.50))
	if active:
		_tidal_phase += delta * _tidal_strength
	elif _tidal_strength <= 0.001:
		_tidal_phase = 0.0
	_planet_material.set_shader_parameter("tidal_amount", _tidal_strength)
	_planet_material.set_shader_parameter("tidal_phase", _tidal_phase)


func set_tunnel_enabled(enabled: bool) -> void:
	_tunnel_enabled = enabled
	_ensure_layers()
	_sky_material.set_shader_parameter("tunnel_amount", 1.0 if enabled else 0.0)


func set_singularity_strength(strength: float) -> void:
	_singularity_strength = clampf(strength, 0.0, 1.0)
	_ensure_layers()
	_sky_material.set_shader_parameter("singularity_amount", _singularity_strength)
	_singularity_material.set_shader_parameter("singularity_amount", _singularity_strength)
	_singularity.visible = _singularity_strength > 0.001


func _radius_for_lane(lane: float) -> float:
	var lower := clampi(floori(lane), 0, 3)
	var upper := mini(lower + 1, 3)
	var blend := clampf(_singularity_strength, 0.0, 1.0)
	var r_lower := lerpf(NORMAL_LANE_RADII[lower], BLACK_HOLE_LANE_RADII[lower], blend)
	var r_upper := lerpf(NORMAL_LANE_RADII[upper], BLACK_HOLE_LANE_RADII[upper], blend)
	return lerpf(r_lower, r_upper, clampf(lane - float(lower), 0.0, 1.0))


func update_world(time: float, player_angle: float, player_lane: float, forward: float,
		charge: float, release: float, magnet: float, reduced_motion: bool) -> void:
	_ensure_layers()
	if time < _clock:
		reset_effects()
	var delta := maxf(0.0, time - _clock)
	if not reduced_motion:
		_visual_clock += delta
		_visual_travel += maxf(0.0, forward - _last_forward) * 0.001
	if _has_sample and delta > 0.0:
		var angular_step := wrapf(player_angle - _last_angle, -PI, PI)
		if not reduced_motion:
			_wake_phase += angular_step
		if absf(angular_step) > 0.0001:
			_player_direction = signf(angular_step)
	_turn_strength *= exp(-delta * 0.85)
	_hop_strength *= exp(-delta * 0.64)
	# A bounded material release approaches and settles; no single-frame gain jump.
	_release = move_toward(_release, clampf(release, 0.0, 1.0), delta * 0.90)
	_clock = time
	_last_angle = player_angle
	_last_lane = player_lane
	_last_forward = forward
	_has_sample = true
	var motion := 0.0 if reduced_motion else 1.0
	for shader_material in [_sky_material, _planet_material, _singularity_material]:
		shader_material.set_shader_parameter("world_clock", _visual_clock)
		shader_material.set_shader_parameter("motion_amount", motion)
	for shader_material in [_sky_material, _singularity_material]:
		shader_material.set_shader_parameter("reservoir", clampf(charge, 0.0, 1.0))
		shader_material.set_shader_parameter("release_amount", _release)
	_sky_material.set_shader_parameter("travel", _visual_travel)
	_sky_material.set_shader_parameter("wake_phase", _wake_phase)
	_sky_material.set_shader_parameter("player_angle", player_angle)
	_sky_material.set_shader_parameter("player_radius", _radius_for_lane(player_lane))
	_sky_material.set_shader_parameter("player_direction", _player_direction)
	_sky_material.set_shader_parameter("turn_strength", _turn_strength)
	_sky_material.set_shader_parameter("turn_angle", _turn_angle)
	_sky_material.set_shader_parameter("hop_strength", _hop_strength)
	_sky_material.set_shader_parameter("hop_angle", _hop_angle)
	_sky_material.set_shader_parameter("hop_radius", _hop_radius)
	_sky_material.set_shader_parameter("magnet_amount", clampf(magnet, 0.0, 1.0))


func react_turn(direction: float) -> void:
	_turn_strength = clampf(_turn_strength + signf(direction) * 0.75, -1.0, 1.0)
	_turn_angle = _last_angle
	_player_direction = signf(direction) if direction != 0.0 else -_player_direction


func react_hop(direction: float) -> void:
	_hop_strength = clampf(_hop_strength + signf(direction) * 0.85, -1.0, 1.0)
	_hop_angle = _last_angle
	_hop_radius = _radius_for_lane(_last_lane + direction * 0.5)


func reset_effects() -> void:
	_clock = 0.0
	_visual_clock = 0.0
	_visual_travel = 0.0
	_last_forward = 0.0
	_has_sample = false
	_wake_phase = 0.0
	_turn_strength = 0.0
	_hop_strength = 0.0
	_release = 0.0
	_player_direction = 1.0
	_tidal_strength = 0.0
	_tidal_phase = 0.0
	_tidal_last_clock = 0.0
