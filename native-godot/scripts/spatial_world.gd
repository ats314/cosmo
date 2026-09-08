extends Node3D
## Native meshes share the simulation's authoritative world coordinates.
## The fixed camera exactly matches OrbitGeometry.project_world at focal length 900.
## No independent process loop, physics state, collision adjustment, or camera roll.

const ENTITY_SHADER := preload("res://shaders/entity.gdshader")
const POOL_SIZE := 160
const TRAIL_SAMPLES := 136
const DUST_COUNT := 80
# THE COLOUR VOCABULARY IS TAUGHT, SO IT IS COPIED FROM COL IN
# src/game/runtime.js RATHER THAN CHOSEN HERE.
#
# That block of the original is a constraint with its reasoning attached: every
# hue on the board is spoken for — gold collects, pink-red kills, cyan is the
# comet, mint is a shield, violet is slow-mo — and a colour landing in an
# occupied family "inherits a meaning it does not have".
#
# RED is the one that mattered. This read #ff1f3d, a pure saturated red, where
# canon is #ff5d73, a PINK-red. The original states outright that scorch was
# made warm-orange rather than warm-red because "the invariant that red belongs
# to death alone is not negotiable and #ff5d73 is a pink, so the two do not sit
# in the same family at a glance." A pure red walks death toward scorch and
# spends the separation that decision bought.
const CYAN := Color(0.365, 0.941, 1.0)   # COL.comet  #5df0ff
const GOLD := Color(1.0, 0.784, 0.341)   # COL.ember  #ffc857
const RED := Color(1.0, 0.365, 0.451)    # COL.shard  #ff5d73 — pink-red, deliberately
const VIOLET := Color(0.706, 0.545, 1.0) # COL.warp   #b48bff
const POWER_COLORS := {
	"shield": Color(0.48, 1.0, 0.78), "warp": Color(0.71, 0.55, 1.0),
	"spot": Color(0.88, 0.84, 1.0), "nova": Color(0.91, 0.97, 1.0),
	# Aligned to COL in src/game/runtime.js. Blue for the mirror and orange for
	# scorch are the two the original argues hardest for: blue was free and reads
	# as "another one of you", and scorch is warm-ORANGE rather than warm-red
	# precisely so it cannot be mistaken for the pink-red that means death.
	"hyper": Color(1.0, 0.310, 0.847), "mirror": Color(0.302, 0.549, 1.0),
	"scorch": Color(1.0, 0.541, 0.169), "slip": Color(0.24, 0.86, 0.88),
	"trail": Color(1.0, 0.77, 0.29), "bh": Color(0.561, 0.361, 1.0),
	"starfall": Color(1.0, 0.84, 0.39),
}
# All ten standardised sprites now live in assets/sprites/. The legacy root
# .webp files this used to read are superseded and can be retired.
#
# "spot" is Magnet. The historic id is deliberately preserved (PORT_STATUS), and
# it previously loaded power-spotlight.webp, whose name reads like a different
# power entirely — power-magnet.png now says what it is.
const POWER_TEXTURES := {
	"shield": preload("res://assets/sprites/power-shield.png"),
	"warp": preload("res://assets/sprites/power-slow.png"),
	"spot": preload("res://assets/sprites/power-magnet.png"),
	"nova": preload("res://assets/sprites/power-nova.png"),
	"hyper": preload("res://assets/sprites/power-hyper.png"),
	"mirror": preload("res://assets/sprites/power-mirror.png"),
	"scorch": preload("res://assets/sprites/power-scorch.png"),
	"slip": preload("res://assets/sprites/power-slip.png"),
	"trail": preload("res://assets/sprites/power-trail.png"),
	"bh": preload("res://assets/sprites/power-blackhole.png"),
}

var camera: Camera3D
var _size := Vector2(540.0, 960.0)
var _center := Vector2(270.0, 480.0)
var _radii := Vector2(218.0, 308.0)
var _built := false
var _reduced_motion := false
var _last_time := -1.0
var _last_travel := 0.0
var _decorative_clock := 0.0
var _decorative_travel := 0.0
var _sample_left := 0.0
var _last_ring_count := -1
var _last_lane := -1
var _rail_ratios := [-1.0, -1.0, -1.0, -1.0]
var _entity_material: ShaderMaterial
var _comet_material: ShaderMaterial
var _ribbon_material: StandardMaterial3D
var _hazards: MultiMesh
var _stars: MultiMesh
var _star_cores: MultiMesh
var _powers: MultiMesh
var _cages: MultiMesh
var _targets: MultiMesh
var _power_hoops: MultiMesh
var _dust: MultiMesh
var _dust_seeds: Array[Vector3] = []
var _comet: MeshInstance3D
var _comet_core: MeshInstance3D
var _comet_halo: Sprite3D
var _power_icons: Array[Sprite3D] = []
var _mirror: MeshInstance3D
var _shield_ring: MeshInstance3D
var _magnet_ring: MeshInstance3D
var _magnet_ring_b: MeshInstance3D
var _nova: MeshInstance3D
var _rails: Array[MeshInstance3D] = []
var _rail_materials: Array[ShaderMaterial] = []
var _trail_points: Array[Vector3] = []
var _trail_ages: Array[float] = []
var _trail_mesh: ImmediateMesh
var _flow_mesh: ImmediateMesh
var _burn_mesh: ImmediateMesh
var _beam_mesh: ImmediateMesh
var _tidal_mesh: ImmediateMesh
var _tidal_particles: MultiMesh
var _tidal_arrows: MultiMesh
const WORMHOLE_SHADER := preload("res://shaders/wormhole.gdshader")
var _wormhole_material: ShaderMaterial
var _wormhole_node: MeshInstance3D
var _wormhole_rings: MultiMesh
var _wormhole_weight := 0.0
var _wormhole_clock := 0.0
var _wormhole_boost := 0.0
var _saucers: MultiMesh
var _saucer_material: StandardMaterial3D


func _ready() -> void:
	_ensure_world()
	configure(_size, _center, _radii)


func configure(size: Vector2, center: Vector2, radii: Vector2) -> void:
	_size = size
	_center = center
	_radii = radii
	_ensure_world()
	camera.position = Vector3(0.0, 0.0, 900.0)
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	camera.fov = rad_to_deg(2.0 * atan(size.y / 1800.0))
	camera.near = 2.0
	camera.far = 6500.0
	# Scene root uses center == size / 2; offsets also support a deliberately shifted arena.
	camera.h_offset = size.x * 0.5 - center.x
	camera.v_offset = center.y - size.y * 0.5
	var ratios := [1.0, 0.76, 0.545, 0.45]
	var rail_mesh := _ellipse_tube(radii, 0.95, 192, 6)
	for index in range(_rails.size()):
		_rails[index].mesh = rail_mesh
		_rails[index].scale = Vector3(ratios[index], ratios[index], 1.0)
		_rail_ratios[index] = ratios[index]
	_last_ring_count = -1
	_last_lane = -1


func _ensure_world() -> void:
	if _built:
		return
	_built = true
	camera = Camera3D.new()
	camera.name = "StablePortraitCamera"
	camera.current = true
	add_child(camera)
	var environment := Environment.new()
	environment.background_mode = Environment.BG_CANVAS
	environment.background_canvas_max_layer = -1
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.59, 0.70, 0.88)
	environment.ambient_light_energy = 0.65
	environment.ambient_light_sky_contribution = 0.0
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	# Canvas-background ordering is resolved from the viewport's world environment.
	# A camera-only override renders the 3D correctly but can leave the canvas above it.
	var world_environment := WorldEnvironment.new()
	world_environment.name = "CosmicEnvironment"
	world_environment.environment = environment
	add_child(world_environment)
	var key := DirectionalLight3D.new()
	key.name = "CelestialKeyLight"
	key.rotation_degrees = Vector3(-25.0, -32.0, 0.0)
	key.light_color = Color(0.70, 0.86, 1.0)
	key.light_energy = 1.10
	key.shadow_enabled = false
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.name = "SoftWarmRim"
	rim.rotation_degrees = Vector3(30.0, 130.0, 0.0)
	rim.light_color = Color(0.77, 0.56, 0.82)
	rim.light_energy = 0.45
	rim.shadow_enabled = false
	add_child(rim)
	_entity_material = _solid_material(Color.WHITE, 0.65)
	_comet_material = _solid_material(CYAN, 0.78)
	_ribbon_material = StandardMaterial3D.new()
	_ribbon_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_ribbon_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_ribbon_material.vertex_color_use_as_albedo = true
	_ribbon_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_ribbon_material.no_depth_test = false
	var octahedron := _octahedron_mesh()
	var open_cage := _cage_mesh()
	var hoop := _ellipse_tube(Vector2.ONE, 0.055, 32, 4)
	_hazards = _pool("CrimsonDebris", octahedron, POOL_SIZE)
	_stars = _pool("GoldStars", _star_mesh(), POOL_SIZE)
	_star_cores = _pool("StarHotFacets", octahedron, POOL_SIZE, _solid_material(Color(1.0, 0.95, 0.67), 1.30))
	_powers = _pool("PowerCrystals", octahedron, POOL_SIZE)
	_cages = _pool("OpenShutters", open_cage, POOL_SIZE)
	_targets = _pool("ArrivalContours", hoop, POOL_SIZE)
	_power_hoops = _pool("PowerOrbits", hoop, POOL_SIZE)
	var dust_mesh := BoxMesh.new()
	dust_mesh.size = Vector3(0.6, 0.6, 11.0)
	_dust = _pool("TravelDust", dust_mesh, DUST_COUNT)
	var rng := RandomNumberGenerator.new()
	rng.seed = 314159
	for index in range(DUST_COUNT):
		_dust_seeds.append(Vector3(rng.randf_range(0.0, TAU), rng.randf_range(1.05, 2.10), rng.randf_range(0.0, 2800.0)))
	var comet_mesh := _comet_mesh()
	_comet = _mesh_node("Comet", comet_mesh, _comet_material)
	_comet_core = _mesh_node("CometIceCore", comet_mesh, _solid_material(Color(0.84, 0.99, 1.0), 1.40))
	_comet_halo = Sprite3D.new()
	_comet_halo.name = "CometLocalHalo"
	_comet_halo.texture = preload("res://assets/particles/fx-soft-glow.png")
	_comet_halo.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_comet_halo.pixel_size = 54.0 / 256.0
	_comet_halo.modulate = Color(0.15, 0.64, 1.0, 0.22)
	_comet_halo.shaded = false
	_comet_halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_comet_halo)
	_mirror = _mesh_node("MirrorComet", comet_mesh, _solid_material(Color(0.68, 0.51, 1.0), 0.52))
	_mirror.visible = false
	for index in range(POOL_SIZE):
		var icon := Sprite3D.new()
		icon.name = "PowerIcon%d" % index
		icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		icon.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		icon.shaded = false
		icon.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		icon.visible = false
		add_child(icon)
		_power_icons.append(icon)
	_shield_ring = _mesh_node("ShieldContour", _ellipse_tube(Vector2(20.0, 20.0), 0.60, 48, 4), _solid_material(Color(0.22, 0.65, 0.83), 0.14))
	_magnet_ring = _mesh_node("MagnetField", _ellipse_tube(Vector2(34.0, 34.0), 0.46, 56, 4), _solid_material(Color(0.12, 0.48, 0.38), 0.12))
	_magnet_ring_b = _mesh_node("MagnetFieldCrossing", _ellipse_tube(Vector2(34.0, 34.0), 0.46, 56, 4), _solid_material(Color(0.12, 0.48, 0.38), 0.12))
	_nova = _mesh_node("NovaConversionFront", _ellipse_tube(Vector2.ONE, 0.006, 160, 4), _solid_material(Color(0.63, 0.42, 0.18), 0.22))
	_nova.visible = false
	for index in range(4):
		var material := _solid_material(Color(0.12, 0.33, 0.44), 0.65)
		_rail_materials.append(material)
		var rail := _mesh_node("OrbitRail%d" % index, _ellipse_tube(_radii, 0.95, 192, 6), material)
		rail.position.z = -1.8
		_rails.append(rail)
	_trail_mesh = ImmediateMesh.new()
	_mesh_node("CometIonRibbon", _trail_mesh, _ribbon_material)
	_flow_mesh = ImmediateMesh.new()
	_mesh_node("DistantHelixCurrents", _flow_mesh, _ribbon_material)
	_burn_mesh = ImmediateMesh.new()
	_mesh_node("ScorchRoute", _burn_mesh, _ribbon_material)
	_beam_mesh = ImmediateMesh.new()
	_mesh_node("SaucerRingBeam", _beam_mesh, _ribbon_material)
	_tidal_mesh = ImmediateMesh.new()
	_mesh_node("TidalAccretionBridge", _tidal_mesh, _ribbon_material)
	_tidal_particles = _pool("TidalMaterialGrains", octahedron, 96)
	_tidal_arrows = _pool("TidalCurrentDirection", comet_mesh, 14)
	var saucer_mesh = preload("res://assets/models/ufo-saucer.obj")
	var saucer_tex = preload("res://assets/textures/tex-ufo-hull.png")
	_saucer_material = StandardMaterial3D.new()
	_saucer_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_saucer_material.albedo_texture = saucer_tex
	_saucers = _pool("UFOSaucers", saucer_mesh, 8, _saucer_material)
	_wormhole_material = ShaderMaterial.new()
	_wormhole_material.shader = WORMHOLE_SHADER
	_wormhole_material.set_shader_parameter("wormhole_amount", 0.0)
	var tunnel_mesh := _tunnel_mesh(420.0, 4200.0, 32, 24)
	_wormhole_node = _mesh_node("WormholeTunnel", tunnel_mesh, _wormhole_material)
	_wormhole_node.position = Vector3(0.0, 0.0, -1100.0)
	_wormhole_node.visible = false
	var ring_torus := _ellipse_tube(Vector2(320.0, 320.0), 4.2, 48, 4)
	_wormhole_rings = _pool("WormholeConcentricRings", ring_torus, 24, _solid_material(Color(0.4, 0.85, 1.0), 2.2))


# THE PASSAGE BETWEEN LEVELS, DRIVEN ENTIRELY FROM OUTSIDE.
#
# This owns no clock of its own. The host advances the passage and hands the
# state down, for the same reason every other visual here reads a supplied
# world_clock rather than the engine's TIME: the transition has to freeze with
# pause, slow with dilation, and stop dead under reduced motion. A tunnel that
# kept spinning behind a paused game would be the one thing on screen still
# moving.
#
# weight 0 retires the tunnel completely — the node is hidden rather than drawn
# transparent, because a full-screen 4200-unit mesh at zero alpha is still fill
# rate a phone pays for on every ordinary frame of the game.
func set_wormhole_state(weight: float, clock: float, boost: float) -> void:
	_ensure_world()
	_wormhole_weight = clampf(weight, 0.0, 1.0)
	_wormhole_clock = clock
	_wormhole_boost = maxf(0.0, boost)
	var live := _wormhole_weight > 0.001
	_wormhole_node.visible = live
	if not live:
		_wormhole_rings.visible_instance_count = 0
		return
	# HELD WELL BACK FROM FULL. At weight 1.0 the tunnel wall accumulates to
	# near-white and the card sits on a glare; a test play showed the summary
	# floating on what looked like a blown-out photograph. Cosmo is a deep-space
	# game and its brightest object is supposed to be a reward, not a corridor.
	_wormhole_material.set_shader_parameter("wormhole_amount", _wormhole_weight * 0.58)
	_wormhole_material.set_shader_parameter("tunnel_clock", _wormhole_clock)
	# The shader's default palette is a bright cyan/magenta that belongs to no
	# world in this game. These pull it into the register the rest of the scene
	# occupies, so the passage reads as somewhere Cosmo could actually be.
	_wormhole_material.set_shader_parameter("grid_color", Vector3(0.16, 0.46, 0.66))
	_wormhole_material.set_shader_parameter("plasma_color", Vector3(0.46, 0.17, 0.38))
	_wormhole_material.set_shader_parameter("world_rim", Vector3(0.28, 0.52, 0.70))
	_wormhole_material.set_shader_parameter("world_tint", Vector3(0.06, 0.13, 0.30))
	# Reduced motion keeps the destination and drops the rush toward it.
	var speed := 0.0 if _reduced_motion else 2.5 + _wormhole_boost * 5.0
	_wormhole_material.set_shader_parameter("warp_speed", speed)

	# Concentric rings streaming toward the viewer read as distance covered in a
	# way the tunnel wall alone does not. They are placed on a repeating ramp so
	# the throat never empties and never visibly pops a ring into existence.
	# TWELVE RINGS, NOT TWENTY-FOUR, AND DIM.
	#
	# The first pass drew every ring in the pool at full weight on an additively
	# emissive material. A test play showed what that actually looks like: the
	# throat blew out to near-white and the closely spaced rings beat against
	# each other into heavy moire, so the passage read as visual noise rather
	# than depth — and the summary card's own text stopped being legible against
	# it. Fewer rings, spaced further apart, at roughly a third of the alpha,
	# reads as more distance and less interference. The tunnel wall carries the
	# structure; these only need to mark the rate of travel.
	var count := _wormhole_rings.instance_count
	var stride := 2
	var shown := 0
	for index in range(0, count, stride):
		var phase: float = fposmod(float(index) / float(count) + (0.0 if _reduced_motion else _wormhole_clock * 0.22), 1.0)
		var depth := -3600.0 + phase * 4300.0
		var reach: float = clampf((depth + 1200.0) / 2600.0, 0.0, 1.0)
		var scale: float = (0.35 + 0.95 * (1.0 - reach)) * (0.55 + 0.45 * _wormhole_weight)
		var basis := Basis().scaled(Vector3(scale, scale, scale))
		_wormhole_rings.set_instance_transform(shown, Transform3D(basis, Vector3(0.0, 0.0, depth)))
		# Fade at both ends so rings arrive and leave rather than blinking, and
		# hold the near ones back hardest — those are the ones that sit under the
		# card and wash the text out.
		var fade: float = sin(clampf(phase, 0.0, 1.0) * PI)
		var near_hold: float = 0.35 + 0.65 * reach
		_wormhole_rings.set_instance_color(shown, Color(0.32, 0.72, 0.92, fade * _wormhole_weight * 0.34 * near_hold))
		shown += 1
	_wormhole_rings.visible_instance_count = shown


# The moment of emergence. A short outward shove that the host resolves back to
# zero; it does not decay on its own, because the host owns the clock.
func wormhole_exit(strength: float) -> void:
	_ensure_world()
	_wormhole_boost = maxf(_wormhole_boost, maxf(0.0, strength))
	if _wormhole_node.visible:
		_wormhole_material.set_shader_parameter("warp_speed", 0.0 if _reduced_motion else 2.5 + _wormhole_boost * 9.0)


func _solid_material(color: Color, emission: float) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = ENTITY_SHADER
	material.set_shader_parameter("base_color", color)
	material.set_shader_parameter("self_light", emission)
	return material


func _mesh_node(node_name: String, mesh: Mesh, material: Material) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.name = node_name
	node.mesh = mesh
	node.material_override = material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(node)
	return node


func _pool(node_name: String, mesh: Mesh, capacity: int, material: Material = null) -> MultiMesh:
	var multi := MultiMesh.new()
	multi.transform_format = MultiMesh.TRANSFORM_3D
	multi.use_colors = true
	multi.mesh = mesh
	multi.instance_count = capacity
	multi.visible_instance_count = 0
	multi.custom_aabb = AABB(Vector3(-1700, -2100, -4200), Vector3(3400, 4200, 4800))
	var node := MultiMeshInstance3D.new()
	node.name = node_name
	node.multimesh = multi
	node.material_override = _entity_material if material == null else material
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(node)
	return multi


func _place(pool: MultiMesh, index: int, position: Vector3, basis: Basis, color: Color) -> void:
	pool.set_instance_transform(index, Transform3D(basis, position))
	pool.set_instance_color(index, color)


func set_reduced_motion(enabled: bool) -> void:
	_reduced_motion = enabled
	if enabled:
		clear_trail()


func update_simulation(sim, delta: float) -> void:
	_ensure_world()
	if float(sim.visual_time) < _last_time:
		clear_trail()
	var presentation_delta := maxf(0.0, float(sim.visual_time) - maxf(0.0, _last_time))
	if not sim.running or sim.paused:
		presentation_delta = 0.0
	var travel_delta := maxf(0.0, float(sim.travel) - _last_travel)
	if presentation_delta == 0.0:
		travel_delta = 0.0
	_last_time = float(sim.visual_time)
	_last_travel = float(sim.travel)
	if not _reduced_motion:
		_decorative_clock += presentation_delta
		_decorative_travel += travel_delta
	var clock: float = _decorative_clock
	var player: Vector3 = sim.player_position()
	var movement: Vector2 = Vector2(-sin(float(sim.angle)) * _radii.x, -cos(float(sim.angle)) * _radii.y) * float(sim.direction)
	var movement_angle := movement.angle() - PI * 0.5
	_comet.position = player
	_comet.basis = Basis(Vector3.BACK, movement_angle) * Basis.from_scale(Vector3(10.0, 12.0, 9.0))
	_comet.visible = bool(sim.running) or not bool(sim.paused)
	_comet_core.position = player + (camera.position - player).normalized() * 5.0
	_comet_core.basis = Basis(Vector3.BACK, movement_angle) * Basis.from_scale(Vector3(3.6, 6.8, 3.0))
	_comet_core.visible = _comet.visible
	_comet_halo.position = player - (camera.position - player).normalized() * 6.0
	_comet_halo.visible = _comet.visible
	var comet_color := CYAN
	if sim.has_power("hyper"):
		comet_color = Color(0.75, 0.77, 1.0)
	elif sim.has_power("scorch"):
		comet_color = Color(0.42, 0.90, 1.0)
	_comet_material.set_shader_parameter("base_color", comet_color)
	_shield_ring.position = player
	_shield_ring.visible = float(sim.invulnerable) > 0.0
	_shield_ring.rotation = Vector3(0.20, 0.35, 0.0)
	_mirror.visible = sim.has_power("mirror")
	if _mirror.visible:
		_mirror.position = sim.geometry.world(float(sim.angle) + PI, float(sim.lane), 0.0)
		_mirror.basis = Basis(Vector3.BACK, movement_angle + PI) * Basis.from_scale(Vector3(7.0, 10.0, 7.0))
	var magnet: bool = sim.has_power("spot")
	_magnet_ring.visible = magnet
	_magnet_ring_b.visible = magnet
	_magnet_ring.position = player
	_magnet_ring_b.position = player
	_magnet_ring.rotation = Vector3(0.65, 0.2, 0.45)
	_magnet_ring_b.rotation = Vector3(-0.45, 0.5, -0.5)
	_nova.visible = float(sim.nova_age) >= 0.0
	if _nova.visible:
		_nova.position = sim.nova_origin
		_nova.scale = Vector3.ONE * maxf(1.0, float(sim.nova_age) * 560.0)
	_update_rails(sim)
	_update_encounters(sim, clock)
	_update_trail(sim, player, presentation_delta, travel_delta)
	_update_currents(sim)
	_update_scorch(sim)
	_update_beams(sim)
	_update_tidal(sim)
	_update_dust(sim)
	# Caller delta is intentionally not an animation source: frozen simulation stays frozen.
	if delta < 0.0:
		clear_trail()


func _update_rails(sim) -> void:
	var rings: int = int(sim.rings)
	var selected: int = int(sim.target_lane)
	for index in range(4):
		var radius: float = float(sim.geometry.radius(float(index)))
		if absf(radius - float(_rail_ratios[index])) > 0.00001:
			_rail_ratios[index] = radius
			_rails[index].scale = Vector3(radius, radius, 1.0)
	if rings == _last_ring_count and selected == _last_lane:
		return
	_last_ring_count = rings
	_last_lane = selected
	for index in range(4):
		_rails[index].visible = index < rings
		var color := Color(0.12, 0.33, 0.44)
		if index == selected:
			color = Color(0.22, 0.58, 0.67)
		if index == 3:
			color = Color(0.35, 0.19, 0.48)
		if _wormhole_weight > 0.001:
			color = color.lerp(Color(0.04, 0.08, 0.12, 0.0), _wormhole_weight)
		_rail_materials[index].set_shader_parameter("base_color", color)


func _update_encounters(sim, clock: float) -> void:
	var hazards := 0
	var saucers := 0
	var stars := 0
	var powers := 0
	var cages := 0
	var targets := 0
	var hoops := 0
	for icon in _power_icons:
		icon.visible = false
	# THE FINALE IS A CHAIN, AND THE PLAYER HAS TO SEE WHICH LINK IS NEXT.
	#
	# begin_finale() lays a numbered run of stars ahead of the comet, meant to be
	# taken in order. Drawn identically they read as a scattered handful, and the
	# player picks whichever is nearest rather than the one the run is asking for
	# — the shape of the sequence is invisible precisely when it matters most.
	# The lowest surviving index is the next one owed; it leads, and the rest of
	# the chain stands back so the order reads at a glance.
	var next_finale := -1
	for obj in sim.objects:
		if obj.active and not obj.hit and not obj.suspended and obj.kind == "star" and obj.finale_index >= 0:
			if next_finale < 0 or int(obj.finale_index) < next_finale:
				next_finale = int(obj.finale_index)

	for obj in sim.objects:
		if not obj.active or obj.hit or obj.suspended:
			continue
		var position: Vector3 = obj.position
		var phase: float = clock * 0.50 + float(obj.serial) * 0.27
		var angle: float = float(obj.angle)
		var diamond_basis := Basis.from_euler(Vector3(0.30, phase + float(obj.serial) * 1.1, -angle))
		if obj.kind == "star":
			var star_basis := Basis.from_euler(Vector3(0.16, sin(phase) * 0.25, -phase * 0.48))
			var star_size := 11.0 if obj.bonus or obj.starfall else 9.0
			var star_color := GOLD if not obj.bonus and not obj.starfall else Color(1.0, 0.80, 0.32)
			if obj.finale_index >= 0:
				if int(obj.finale_index) == next_finale:
					# The one owed next: larger and at full gold, with a slow
					# breath so it separates from a static field without adding
					# a new effect vocabulary the player has to learn.
					star_size = 15.0 + 1.1 * sin(clock * 4.2)
					star_color = Color(1.0, 0.86, 0.46)
				else:
					# Still coming, and deliberately quieter. Dimmed rather than
					# hidden — the chain's shape is the information.
					star_size = 10.0
					star_color = star_color.darkened(0.42)
			if obj.exit_sun:
				star_size = 26.0 if sim.finish_bloomed else 19.0
				star_color = Color(1.0, 0.82, 0.41) if sim.finish_bloomed else Color(0.36, 0.32, 0.23)
			_place(_stars, stars, position, star_basis.scaled(Vector3.ONE * star_size), star_color)
			var core_size := 2.4 if not obj.exit_sun else (7.0 if sim.finish_bloomed else 0.0)
			_place(_star_cores, stars, position + (camera.position - position).normalized() * (star_size * 0.40), star_basis.scaled(Vector3.ONE * core_size), Color.WHITE)
			stars += 1
		elif obj.kind == "power":
			var power_color: Color = POWER_COLORS.get(str(obj.shape), CYAN)
			_place(_powers, powers, position, diamond_basis.scaled(Vector3(11.0, 13.0, 11.0)), power_color)
			_place(_power_hoops, hoops, position, Basis.from_euler(Vector3(0.4, 0.6, phase * 0.35)).scaled(Vector3.ONE * 18.0), power_color * 0.55)
			var icon := _power_icons[powers]
			var texture: Texture2D = POWER_TEXTURES.get(str(obj.shape), POWER_TEXTURES["trail"])
			icon.texture = texture
			icon.pixel_size = 43.0 / float(texture.get_width())
			# Move toward the camera on the same ray: icon and solid contact body project
			# to the exact same screen center, with no independent icon displacement.
			icon.position = position + (camera.position - position).normalized() * 15.0
			icon.visible = true
			powers += 1
			hoops += 1
		elif obj.kind == "hazard":
			if obj.shape == "saucer":
				var saucer_phase := clock * 2.5 + float(obj.serial) * 0.4
				var saucer_basis := Basis.from_euler(Vector3(0.35, saucer_phase, -angle))
				_place(_saucers, saucers, position, saucer_basis.scaled(Vector3.ONE * 14.0), Color.WHITE)
				saucers += 1
			elif obj.lethal():
				var shape_scale := Vector3(12.0, 14.0, 12.0)
				if obj.shape in ["gate", "driftgate", "funnel"]:
					shape_scale = Vector3(13.0, 16.0, 11.0)
				elif obj.shape == "shot":
					shape_scale = Vector3(7.0, 16.0, 8.0)
				_place(_hazards, hazards, position, diamond_basis.scaled(shape_scale), RED)
				hazards += 1
			else:
				_place(_cages, cages, position, diamond_basis.scaled(Vector3(12.0, 14.0, 12.0)), Color(0.61, 0.26, 0.35))
				cages += 1
			if float(obj.age) < float(obj.warn):
				var target_lane: float = float(obj.target_lane) if obj.shape == "dive" else float(obj.lane)
				var target: Vector3 = sim.geometry.world(angle, target_lane, 0.0)
				target.z = 0.6
				_place(_targets, targets, target, Basis(Vector3.BACK, PI * 0.25).scaled(Vector3(9.0, 9.0, 9.0)), Color(0.68, 0.27, 0.35))
				targets += 1
	_hazards.visible_instance_count = hazards
	_saucers.visible_instance_count = saucers
	_stars.visible_instance_count = stars
	_star_cores.visible_instance_count = stars
	_powers.visible_instance_count = powers
	_cages.visible_instance_count = cages
	_targets.visible_instance_count = targets
	_power_hoops.visible_instance_count = hoops
	# Clock is already reflected in object ages; it never modulates brightness.
	if clock < 0.0:
		_stars.visible_instance_count = 0


func clear_trail() -> void:
	_trail_points.clear()
	_trail_ages.clear()
	_sample_left = 0.0
	_last_time = -1.0
	_last_travel = 0.0
	if _trail_mesh != null:
		_trail_mesh.clear_surfaces()


func _update_trail(sim, player: Vector3, dt: float, travel_delta: float) -> void:
	if _reduced_motion:
		return
	for index in range(_trail_points.size()):
		_trail_points[index].z = minf(600.0, _trail_points[index].z + travel_delta)
		_trail_ages[index] += dt
	while not _trail_ages.is_empty() and (_trail_ages.back() > 4.0 or _trail_points.size() >= TRAIL_SAMPLES):
		_trail_points.pop_back()
		_trail_ages.pop_back()
	_sample_left -= dt
	if dt > 0.0 and (_sample_left <= 0.0 or _trail_points.is_empty()):
		_trail_points.push_front(player)
		_trail_ages.push_front(0.0)
		_sample_left = 1.0 / 30.0
	if _trail_points.size() < 2:
		return
	_trail_mesh.clear_surfaces()
	_trail_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var hue := Color(0.16, 0.73, 0.97)
	if sim.has_power("warp"):
		hue = Color(0.43, 0.33, 0.88)
	elif sim.has_power("hyper"):
		hue = Color(0.61, 0.53, 1.0)
	elif sim.has_power("scorch"):
		hue = Color(0.98, 0.50, 0.18)
	for index in range(_trail_points.size() - 1):
		var a := player if index == 0 else _trail_points[index]
		var b := _trail_points[index + 1]
		var life_a := clampf(1.0 - _trail_ages[index] / 4.0, 0.0, 1.0)
		var life_b := clampf(1.0 - _trail_ages[index + 1] / 4.0, 0.0, 1.0)
		var color_a := Color(hue, pow(life_a, 2.0) * 0.22)
		var color_b := Color(hue, pow(life_b, 2.0) * 0.22)
		var previous := player if index <= 1 else _trail_points[index - 1]
		var following := _trail_points[mini(index + 2, _trail_points.size() - 1)]
		var tangent_a := b - previous
		var tangent_b := following - a
		var side_a := Vector3(-tangent_a.y, tangent_a.x, 0.0).normalized()
		var side_b := Vector3(-tangent_b.y, tangent_b.x, 0.0).normalized()
		_ribbon_quad(_trail_mesh, a, b, side_a, side_b, 8.0 * life_a, 8.0 * life_b, color_a, color_b)
		_ribbon_quad(_trail_mesh, a, b, side_a, side_b, 2.0 * life_a, 2.0 * life_b, Color(0.57, 0.94, 1.0, pow(life_a, 3.0) * 0.68), Color(0.57, 0.94, 1.0, pow(life_b, 3.0) * 0.68))
	_trail_mesh.surface_end()


func _update_currents(sim) -> void:
	_flow_mesh.clear_surfaces()
	_flow_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var travel: float = _decorative_travel
	for strand in range(6):
		var base_angle := float(strand) * TAU / 6.0
		for index in range(44):
			var depth_a := 90.0 + float(index) * 60.0
			var depth_b := depth_a + 60.0
			var angle_a := base_angle + depth_a * 0.0016 + travel * 0.00018
			var angle_b := base_angle + depth_b * 0.0016 + travel * 0.00018
			var a: Vector3 = sim.geometry.world(angle_a, 0.0, depth_a, travel)
			var b: Vector3 = sim.geometry.world(angle_b, 0.0, depth_b, travel)
			var fade := smoothstep(90.0, 370.0, depth_a) * (1.0 - smoothstep(1800.0, 2800.0, depth_a))
			var hue := Color(0.22, 0.47, 0.60, 0.090 * fade)
			if strand % 2 == 0:
				hue = Color(0.42, 0.24, 0.56, 0.085 * fade)
			_ribbon_segment(_flow_mesh, a, b, 3.5, 3.5, hue, hue)
	_flow_mesh.surface_end()


func _update_scorch(sim) -> void:
	_burn_mesh.clear_surfaces()
	var has_burn := false
	for amount in sim.burn:
		if amount > 0.0:
			has_burn = true
			break
	if not has_burn:
		return
	_burn_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in range(sim.burn.size()):
		var amount: float = float(sim.burn[index])
		if amount <= 0.0:
			continue
		var ring := int(index / 72)
		var sector := index % 72
		var a: Vector3 = sim.geometry.world(float(sector) * TAU / 72.0, float(ring), 0.0)
		var b: Vector3 = sim.geometry.world(float(sector + 1) * TAU / 72.0, float(ring), 0.0)
		a.z = 0.4
		b.z = 0.4
		var color := Color(0.98, 0.40, 0.12, minf(0.58, amount * 0.28))
		_ribbon_segment(_burn_mesh, a, b, 3.2, 3.2, color, color)
	_burn_mesh.surface_end()


func _update_dust(sim) -> void:
	if _reduced_motion:
		_dust.visible_instance_count = 0
		return
	var speed_boost := 1.0 + _wormhole_weight * 3.5
	for index in range(DUST_COUNT):
		var seed := _dust_seeds[index]
		var travel_val: float = float(sim.travel) * speed_boost
		var depth := fposmod(seed.z - travel_val * 1.4, 2800.0) + 90.0
		var p: Vector3 = sim.geometry.world(seed.x, 0.0, depth, travel_val)
		p.x *= seed.y
		p.y *= seed.y
		var fade := smoothstep(90.0, 290.0, depth) * (1.0 - smoothstep(2100.0, 2890.0, depth))
		var dust_scale := Vector3(1.2, 1.2, 18.0 + _wormhole_weight * 35.0)
		var dust_color := Color(0.65, 0.88, 1.0) * (0.35 + 0.65 * fade)
		if _wormhole_weight > 0.01:
			dust_color = dust_color.lerp(Color(1.0, 0.60, 0.85), _wormhole_weight)
		_place(_dust, index, p, Basis.IDENTITY.scaled(dust_scale), dust_color)
	_dust.visible_instance_count = DUST_COUNT


func _update_beams(sim) -> void:
	_beam_mesh.clear_surfaces()
	var begun := false
	for obj in sim.objects:
		if not obj.active or obj.suspended or obj.shape != "saucer":
			continue
		var firing: bool = float(obj.beam_left) > 0.0
		var charging: bool = float(obj.fire_time) >= 0.0
		if not firing and not charging:
			continue
		if not begun:
			_beam_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
			begun = true
		for segment in range(96):
			if charging and not firing and segment % 3 == 2:
				continue
			var a: Vector3 = sim.geometry.world(float(segment) * TAU / 96.0, float(obj.lane), 0.0)
			var b: Vector3 = sim.geometry.world(float(segment + 1) * TAU / 96.0, float(obj.lane), 0.0)
			a.z = 1.0
			b.z = 1.0
			var width := 3.0 if firing else 1.25
			var color := Color(0.95, 0.16, 0.30, 0.66) if firing else Color(0.69, 0.30, 0.60, 0.45)
			_ribbon_segment(_beam_mesh, a, b, width, width, color, color)
	if begun:
		_beam_mesh.surface_end()


func _update_tidal(sim) -> void:
	_tidal_mesh.clear_surfaces()
	_tidal_particles.visible_instance_count = 0
	_tidal_arrows.visible_instance_count = 0
	var tidal = sim.get("tidal")
	if tidal == null or not tidal.active:
		return
	var warning: bool = float(tidal.warning) > 0.0
	var growth := clampf(1.0 - float(tidal.warning) / 3.0, 0.0, 1.0) if warning else 1.0
	var hue := Color(0.52, 0.51, 0.91)
	if str(tidal.element) in ["scorch", "fire", "molten"]:
		hue = Color(0.94, 0.52, 0.23)
	elif str(tidal.element) in ["shield", "tide", "water", "ice"]:
		hue = Color(0.32, 0.76, 0.91)
	_tidal_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in range(112):
		var t_a := float(index) / 112.0
		var t_b := float(index + 1) / 112.0
		var a: Vector3 = tidal.point(sim, t_a)
		var b: Vector3 = tidal.point(sim, t_b)
		var before: Vector3 = tidal.point(sim, maxf(0.0, t_a - 1.0 / 112.0))
		var after: Vector3 = tidal.point(sim, minf(1.0, t_b + 1.0 / 112.0))
		var tangent_a := b - before
		var tangent_b := after - a
		var side_a := Vector3(-tangent_a.y, tangent_a.x, 0.0).normalized()
		var side_b := Vector3(-tangent_b.y, tangent_b.x, 0.0).normalized()
		var end_fade := smoothstep(0.0, 0.07, t_a) * (1.0 - smoothstep(0.89, 1.0, t_b))
		var arrival := 1.0 - smoothstep(growth - 0.06, growth + 0.03, t_a)
		var width := lerpf(5.5, 12.0, sin(t_a * PI))
		var body_alpha := end_fade * (0.045 + arrival * (0.045 if warning else 0.10))
		_ribbon_quad(_tidal_mesh, a, b, side_a, side_b, width, width, Color(hue, body_alpha), Color(hue, body_alpha))
		var core_alpha := end_fade * (0.10 if warning else 0.29) * arrival
		_ribbon_quad(_tidal_mesh, a, b, side_a, side_b, 1.2, 1.2, Color(hue.lightened(0.18), core_alpha), Color(hue.lightened(0.18), core_alpha))
	_tidal_mesh.surface_end()
	var flow_clock := _decorative_clock
	var grain_count := 0
	for index in range(96):
		var t := fposmod(float(index) / 96.0 + flow_clock * 0.19, 1.0)
		if t > growth or t < 0.02 or t > 0.97:
			continue
		var position: Vector3 = tidal.point(sim, t)
		var neighbor: Vector3 = tidal.point(sim, minf(1.0, t + 0.008))
		var tangent := (neighbor - position).normalized()
		var side := Vector3(-tangent.y, tangent.x, 0.0).normalized()
		var lane_offset := sin(float(index) * 8.32) * (2.0 + sin(t * PI) * 4.0)
		position += side * lane_offset
		var scale := 1.2 if warning else 2.0
		var color := hue * (0.46 if warning else 0.76)
		_place(_tidal_particles, grain_count, position, Basis.IDENTITY.scaled(Vector3(scale, scale, scale * 1.6)), color)
		grain_count += 1
	_tidal_particles.visible_instance_count = grain_count
	var arrow_count := 0
	for index in range(14):
		var t := (float(index) + 0.5) / 14.0
		if t > growth or t < 0.18 or t > 0.91:
			continue
		var position: Vector3 = tidal.point(sim, t)
		var next: Vector3 = tidal.point(sim, minf(1.0, t + 0.01))
		var from_screen := camera.unproject_position(position)
		var to_screen := camera.unproject_position(next)
		var screen_tangent := Vector2(to_screen.x - from_screen.x, from_screen.y - to_screen.y)
		var angle := screen_tangent.angle() - PI * 0.5
		var basis := Basis(Vector3.BACK, angle) * Basis.from_scale(Vector3(2.6, 4.5, 2.0))
		_place(_tidal_arrows, arrow_count, position, basis, hue * (0.65 if warning else 0.94))
		arrow_count += 1
	_tidal_arrows.visible_instance_count = arrow_count


func _ribbon_segment(mesh: ImmediateMesh, a: Vector3, b: Vector3, width_a: float, width_b: float, color_a: Color, color_b: Color) -> void:
	var tangent := b - a
	var side := Vector3(-tangent.y, tangent.x, 0.0).normalized()
	if side.length_squared() < 0.1:
		side = Vector3.RIGHT
	_ribbon_quad(mesh, a, b, side, side, width_a, width_b, color_a, color_b)


func _ribbon_quad(mesh: ImmediateMesh, a: Vector3, b: Vector3, side_a: Vector3, side_b: Vector3, width_a: float, width_b: float, color_a: Color, color_b: Color) -> void:
	var aa := a + side_a * width_a
	var ab := a - side_a * width_a
	var ba := b + side_b * width_b
	var bb := b - side_b * width_b
	mesh.surface_set_color(color_a)
	mesh.surface_add_vertex(aa)
	mesh.surface_add_vertex(ab)
	mesh.surface_set_color(color_b)
	mesh.surface_add_vertex(ba)
	mesh.surface_set_color(color_a)
	mesh.surface_add_vertex(ab)
	mesh.surface_set_color(color_b)
	mesh.surface_add_vertex(bb)
	mesh.surface_add_vertex(ba)


func _triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	var normal := (b - a).cross(c - a).normalized()
	surface.set_normal(normal)
	surface.set_color(Color.WHITE)
	surface.add_vertex(a)
	surface.add_vertex(b)
	surface.add_vertex(c)


func _octahedron_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var equator := [Vector3.RIGHT, Vector3.UP, Vector3.LEFT, Vector3.DOWN]
	for index in range(4):
		_triangle(surface, Vector3.BACK, equator[index], equator[(index + 1) % 4])
		_triangle(surface, Vector3.FORWARD, equator[(index + 1) % 4], equator[index])
	return surface.commit()


func _comet_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var shoulder := [Vector3(0.67, -0.16, 0.0), Vector3(0.0, -0.16, 0.50), Vector3(-0.67, -0.16, 0.0), Vector3(0.0, -0.16, -0.50)]
	for index in range(4):
		_triangle(surface, Vector3(0.0, 1.25, 0.0), shoulder[index], shoulder[(index + 1) % 4])
		_triangle(surface, Vector3(0.0, -0.85, 0.0), shoulder[(index + 1) % 4], shoulder[index])
	return surface.commit()


func _star_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var points: Array[Vector3] = []
	for index in range(10):
		var angle := float(index) * TAU / 10.0 + PI * 0.5
		var radius := 1.0 if index % 2 == 0 else 0.43
		points.append(Vector3(cos(angle) * radius, sin(angle) * radius, 0.0))
	for index in range(10):
		_triangle(surface, Vector3(0.0, 0.0, 0.38), points[index], points[(index + 1) % 10])
		_triangle(surface, Vector3(0.0, 0.0, -0.28), points[(index + 1) % 10], points[index])
	return surface.commit()


func _cage_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var equator := [Vector3.RIGHT, Vector3.UP, Vector3.LEFT, Vector3.DOWN]
	for index in range(4):
		_tube_segment(surface, equator[index], equator[(index + 1) % 4], 0.035)
		_tube_segment(surface, Vector3.BACK, equator[index], 0.035)
		_tube_segment(surface, Vector3.FORWARD, equator[index], 0.035)
	return surface.commit()


func _tube_segment(surface: SurfaceTool, a: Vector3, b: Vector3, radius: float) -> void:
	var direction := (b - a).normalized()
	var cross_axis := Vector3.UP if absf(direction.dot(Vector3.UP)) < 0.9 else Vector3.RIGHT
	var x := direction.cross(cross_axis).normalized() * radius
	var y := direction.cross(x).normalized() * radius
	for side in range(4):
		var theta := float(side) * TAU / 4.0
		var next_theta := float(side + 1) * TAU / 4.0
		var offset := x * cos(theta) + y * sin(theta)
		var next_offset := x * cos(next_theta) + y * sin(next_theta)
		_triangle(surface, a + offset, b + offset, a + next_offset)
		_triangle(surface, a + next_offset, b + offset, b + next_offset)


func _ellipse_tube(radii: Vector2, width: float, segments: int, sides: int) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for segment in range(segments):
		var angle_a := float(segment) * TAU / float(segments)
		var angle_b := float(segment + 1) * TAU / float(segments)
		var a := Vector3(cos(angle_a) * radii.x, sin(angle_a) * radii.y, 0.0)
		var b := Vector3(cos(angle_b) * radii.x, sin(angle_b) * radii.y, 0.0)
		var normal_a := Vector3(cos(angle_a) / radii.x, sin(angle_a) / radii.y, 0.0).normalized()
		var normal_b := Vector3(cos(angle_b) / radii.x, sin(angle_b) / radii.y, 0.0).normalized()
		for side in range(sides):
			var theta_a := float(side) * TAU / float(sides)
			var theta_b := float(side + 1) * TAU / float(sides)
			var aa := a + (normal_a * cos(theta_a) + Vector3.BACK * sin(theta_a)) * width
			var ab := a + (normal_a * cos(theta_b) + Vector3.BACK * sin(theta_b)) * width
			var ba := b + (normal_b * cos(theta_a) + Vector3.BACK * sin(theta_a)) * width
			var bb := b + (normal_b * cos(theta_b) + Vector3.BACK * sin(theta_b)) * width
			_triangle(surface, aa, ba, ab)
			_triangle(surface, ab, ba, bb)
	return surface.commit()


func _tunnel_mesh(radius: float, length: float, segments: int, slices: int) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half_len := length * 0.5
	for j in range(slices):
		var v_a := float(j) / float(slices)
		var v_b := float(j + 1) / float(slices)
		var z_a := half_len - v_a * length
		var z_b := half_len - v_b * length
		var r_a := radius * (1.1 - 0.45 * pow(v_a, 2.0))
		var r_b := radius * (1.1 - 0.45 * pow(v_b, 2.0))
		for i in range(segments):
			var u_a := float(i) / float(segments)
			var u_b := float(i + 1) / float(segments)
			var theta_a := u_a * TAU
			var theta_b := u_b * TAU
			var p0 := Vector3(cos(theta_a) * r_a, sin(theta_a) * r_a, z_a)
			var p1 := Vector3(cos(theta_b) * r_a, sin(theta_b) * r_a, z_a)
			var p2 := Vector3(cos(theta_b) * r_b, sin(theta_b) * r_b, z_b)
			var p3 := Vector3(cos(theta_a) * r_b, sin(theta_a) * r_b, z_b)
			surface.set_uv(Vector2(u_a, v_a))
			surface.add_vertex(p0)
			surface.set_uv(Vector2(u_b, v_a))
			surface.add_vertex(p1)
			surface.set_uv(Vector2(u_b, v_b))
			surface.add_vertex(p2)
			surface.set_uv(Vector2(u_a, v_a))
			surface.add_vertex(p0)
			surface.set_uv(Vector2(u_b, v_b))
			surface.add_vertex(p2)
			surface.set_uv(Vector2(u_a, v_b))
			surface.add_vertex(p3)
	return surface.commit()
