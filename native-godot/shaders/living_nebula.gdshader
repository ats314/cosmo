shader_type canvas_item;
render_mode unshaded, blend_disabled;

// Original Cosmo material. Presentation coordinates never alter encounter geometry.
// All animation is supplied by LivingBackdrop's pause-aware clock; no engine TIME.
//
// Three volumes at three apparent distances share one flight frame:
//   1. the deep field, which only translates, because real distant nebulosity
//      has no parallax and its stillness is what makes the others read as near;
//   2. a mid curtain and 3. a near wisp shell, both carried on reciprocal ray
//      depth so their structure expands toward the viewer as the run advances.
// The separation between their rates is the depth cue. Everything time-varying
// is multiplied by motion_amount, so reduced motion is a still, complete frame
// rather than a degraded one.
uniform vec2 viewport_size = vec2(540.0, 960.0);
uniform vec2 arena_center = vec2(270.0, 480.0);
uniform vec2 arena_radii = vec2(218.0, 310.0);
// The three unbounded accumulators. LivingBackdrop resets them per run, but
// within a run they only grow, so they are the values that lose precision
// first. GLES3 fragment shaders are highp in the Compatibility renderer;
// stating it here means a future default cannot quietly demote them.
uniform highp float world_clock = 0.0;
uniform highp float travel = 0.0;
uniform highp float wake_phase = 0.0;
uniform float player_angle = 0.0;
uniform float player_radius = 0.76;
uniform float player_direction = 1.0;
uniform float turn_strength = 0.0;
uniform float turn_angle = 0.0;
uniform float hop_strength = 0.0;
uniform float hop_angle = 0.0;
uniform float hop_radius = 0.76;
uniform float reservoir = 0.0;
uniform float release_amount = 0.0;
uniform float magnet_amount = 0.0;
uniform float motion_amount = 1.0;
uniform float tunnel_amount = 1.0;
uniform float singularity_amount = 1.0;
uniform float world_seed = 0.0;
uniform float field_lean = 0.48;
uniform float field_bend = 1.8;
uniform float field_grain = 0.85;
uniform vec3 world_tint : source_color = vec3(0.2, 0.39, 0.74);
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.0);
uniform vec3 world_dust : source_color = vec3(0.53, 0.15, 0.40);

// Added controls. Every default reproduces the material as authored, so it is
// correct with nothing setting them.
//   sky_flow        scales the three layers' drift and the star parallax. At 0
//                   they hold position; the twinkle and the travel-driven field
//                   rotation are separate clocks and keep running.
//   sky_depth       parallax separation between the two near shells.
//   star_brightness starfield master, applied after the nebula's own occlusion.
//   sky_arena_calm  the documented SKY_ARENA_CALM. 0.62 reproduces the shipped
//                   curve (0.441 inside the annulus, 0.94 outside) to within
//                   0.002. Lowering it removes the contrast reserved behind the
//                   lanes and puts hazard readability at risk.
uniform float sky_flow : hint_range(0.0, 2.0) = 1.0;
uniform float sky_depth : hint_range(0.0, 2.0) = 1.0;
uniform float star_brightness : hint_range(0.0, 2.0) = 1.0;
uniform float sky_arena_calm : hint_range(0.0, 1.0) = 0.62;

// Dave Hoskins, "Hash without Sine" (shadertoy.com/view/4djSRW), MIT licence.
// Kept verbatim, constants included: they are what make it decorrelate.
float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
		mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Two octave bands, each normalised to roughly [0,1] so a threshold means the
// same thing whichever band feeds it. Octaves are the fill-rate budget here:
// the warp below buys more apparent structure per lookup than a fourth octave
// ever did, so the deep field spends three and the near shell spends two.
float fbm2(vec2 p) {
	float value = noise2(p) * 0.62;
	p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 9.13;
	value += noise2(p) * 0.31;
	return value * 1.075;
}

float fbm3(vec2 p) {
	float value = noise2(p) * 0.53;
	p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 9.13;
	value += noise2(p) * 0.27;
	p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 4.71;
	value += noise2(p) * 0.14;
	return value * 1.064;
}

mat2 rotate2(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat2(vec2(c, s), vec2(-s, c));
}

// Fold an angle into [0, TAU). sin and cos are exactly TAU-periodic, so this is
// lossless, and it keeps every trigonometric argument in this shader small. The
// run clock and the travel counter both grow without bound inside a run; a
// mobile driver's argument range reduction is the first thing that gives out on
// a large one, and it fails as a crawl or a strobe rather than as an error.
float wrap_tau(float x) {
	return x - TAU * floor(x / TAU);
}

// Shortest signed angle. The old atan(sin, cos) form cost three transcendentals
// and is called three times a fragment; this is the same result for one floor.
float angle_delta(float a, float b) {
	return wrap_tau(a - b + PI) - PI;
}

// Stable sparse points on a lattice. The caller's offset gives parallax; one
// cell hash pays for presence, rank, hue and twinkle phase together, so a
// varied field costs no more lookups than a uniform one did. The twinkle is
// bounded and the caller scales it with motion_amount.
vec3 star_layer(vec2 p, float scale, float size, float threshold, float phase, float flicker) {
	vec2 grid = p * scale;
	vec2 cell = floor(grid);
	float pick = hash21(cell + 1.1);
	if (pick <= threshold) {
		return vec3(0.0);
	}
	vec2 center = vec2(hash21(cell + 13.0), hash21(cell + 97.0)) * 0.64 + 0.18;
	vec2 offset = fract(grid) - center;
	float core = exp(-dot(offset, offset) / max(size, 0.000001));
	float rank = (pick - threshold) / max(1.0 - threshold, 0.001);
	float twinkle = 1.0 - flicker * (0.5 - 0.5 * cos(phase + pick * 43.0));
	// Cool blue through pale warm white. Never the saturated gold a collectible
	// star uses, so a background point can never be mistaken for a pickup.
	vec3 hue = mix(vec3(0.52, 0.68, 1.00), vec3(1.00, 0.90, 0.78), fract(pick * 17.3));
	return hue * core * (0.22 + rank * rank * 1.05) * max(twinkle, 0.0);
}

void fragment() {
	vec2 pixel = UV * viewport_size;
	vec2 orbital = (pixel - arena_center) / max(arena_radii, vec2(1.0));
	float radius = max(length(orbital), 0.001);
	// atan(0, 0) is undefined and a NaN here would poison the whole fragment.
	// Nudging x alone still left the y = 0, x = -epsilon case exactly on it, so
	// both components carry an offset far below the ulp of any real coordinate.
	vec2 facing = orbital + vec2(0.000001, 0.0000001);
	float angle = atan(facing.y, facing.x);
	highp float seconds = world_clock;
	// Not named "distance": that is a GLSL built-in function, and shadowing one
	// is accepted by desktop drivers but rejected by some mobile ES compilers.
	highp float travelled = max(travel, 0.0);
	float seed = world_seed * 13.37;
	float depth = -log(max(radius, 0.115));

	// These are visual current displacements. No ring or hazard is projected here.
	// Squared falloffs are written out rather than raised: pow() of a negative
	// base is undefined, and every one of these bases straddles zero.
	float trail_angle = angle_delta(angle, player_angle);
	float behind = smoothstep(-0.15, 0.30, -trail_angle * player_direction);
	float wake = exp(-trail_angle * trail_angle * 2.0) * behind;
	float wake_band = (radius - player_radius) * 3.2;
	wake *= exp(-wake_band * wake_band);
	float reversal = angle_delta(angle, turn_angle);
	float turning = turn_strength * exp(-reversal * reversal * 3.3);
	float turn_band = (radius - player_radius) * 2.7;
	turning *= exp(-turn_band * turn_band);
	float crossing = angle_delta(angle, hop_angle);
	float braid = hop_strength * exp(-crossing * crossing * 5.5);
	float braid_band = (radius - hop_radius) * 2.6;
	braid *= exp(-braid_band * braid_band);
	float current_twist = wake * (0.19 + magnet_amount * 0.10) * player_direction;
	current_twist += turning * 0.38 + braid * sin(radius * 10.0) * 0.20;
	current_twist *= motion_amount;

	// The run's own heat, saturating and bounded: a filling reservoir and the
	// distance already covered quicken the field, and nothing else does. This is
	// a rate change in the calm state; the peaks still belong to the rewards.
	float run_heat = clamp(reservoir, 0.0, 1.0) * 0.58
		+ (1.0 - exp(-travelled * 0.085)) * 0.42;
	float flow_rate = (1.0 + clamp(run_heat, 0.0, 1.0) * 0.85) * clamp(sky_flow, 0.0, 2.0);
	// Travel is the honest speedometer: hyper and a tidal boost spend it faster,
	// so the sky genuinely quickens with the run and settles when the run does.
	// travel advances at about 0.1 per second, so flow_time reaches roughly 1.7
	// per second once run_heat saturates: about 3000 in a half-hour run, which
	// still leaves four decimal digits inside a unit noise cell at fp32.
	highp float flow_time = (seconds * 0.62 + travelled * 3.1) * motion_amount * flow_rate;

	float passage = tunnel_amount * (depth * (0.38 + reservoir * 0.045) + travelled * 0.055);
	float opening = release_amount * exp(-radius * radius * 0.4356);
	float field_angle = angle + passage + current_twist + wake_phase * 0.032;
	field_angle += opening * sin(angle * 2.0 + depth) * 0.23;
	// wake_phase counts every radian the player has flown and the simulation
	// never wraps its angle, so field_angle is in the hundreds after a long run.
	// Folding it here is exact: every consumer either takes its sine and cosine
	// directly or scales it by a whole number first, and a whole multiple of TAU
	// stays a whole multiple of TAU.
	field_angle = wrap_tau(field_angle);
	vec2 spiral = vec2(cos(field_angle), sin(field_angle));
	float lens = singularity_amount * 0.030 / (radius * radius + 0.055);

	// ---- Layer one: the deep field. Translation only, and the slowest thing
	// on screen. Its stillness is the reference the two shells move against.
	highp vec2 p = spiral * (radius + lens) * 1.65;
	p = rotate2(field_lean) * p;
	p += vec2(seed, -seed * 0.37);
	p += vec2(flow_time * 0.011, -flow_time * 0.017);

	// One shared warp field. Every layer displaces by it at its own strength,
	// which both costs a single pair of lookups and correlates the three into
	// one volume seen at three distances instead of three unrelated skies.
	vec2 warp = vec2(fbm2(p * 1.15 + vec2(3.7, 1.2)), fbm2(p * 1.15 + vec2(8.3, 4.8)));
	vec2 sway = (warp - 0.5) * 2.0;

	float billows = fbm3(p * 2.20 + sway * 1.55);
	float detail = noise2(p * 9.0 + sway * 2.40);
	// The filament rides the cloud's own half-density contour instead of a
	// second noise field: rim-brightened threads for free, and one band cheaper.
	// field_grain stipples the contour, so a glassy world stays clean.
	float veined = clamp(billows + (detail - 0.5) * (0.09 + field_grain * 0.10), 0.0, 1.0);
	float ridged = 1.0 - abs(2.0 * veined - 1.0);
	float sweep = sin(field_angle * 2.0 - radius * field_bend * 1.7 + warp.x * 4.0);
	float cloud_body = smoothstep(0.28, 0.80, billows + sweep * 0.095);
	float dust_lane = smoothstep(0.42, 0.71, billows + detail * 0.14);
	float filament = max(ridged, 0.0);
	filament *= filament;
	filament *= filament;
	filament *= filament;
	filament *= cloud_body;
	float edge = smoothstep(0.57, 0.89, cloud_body);

	// Reserved contrast, the load-bearing rule: SKY_ARENA_CALM moderates the
	// annulus the orbits occupy so a shard stays readable against a hot sky.
	// Hue is free here; contrast behind the lanes is not.
	float lane_reserve = 1.0 - smoothstep(0.91, 1.45, radius);
	float arena_calm = (1.0 - clamp(sky_arena_calm, 0.0, 1.0) * lane_reserve * 0.856) * 0.94;

	vec3 color = vec3(0.009, 0.016, 0.035);
	color += mix(world_tint, world_dust, smoothstep(0.36, 0.72, warp.y)) * cloud_body * 0.20;
	color += world_rim * filament * (0.090 + field_grain * 0.028);
	color += world_dust * edge * 0.105;
	color *= mix(1.0, 0.52, dust_lane * (1.0 - filament));

	// ---- Layers two and three: nearer shells in the flight frame. Reciprocal
	// ray depth means a feature's screen radius grows as passage advances, so
	// the volume expands past the player instead of sliding over glass. The
	// direction vector supplies the across-shell coordinate, so there is no
	// polar seam. Both inherit field_angle, and with it the wake, the reversal
	// curl and the lane change: the shells bend to what the player just did.
	float ray_depth = 1.0 / (radius + 0.16);
	float haze = exp(-ray_depth * 0.38);
	float separation = clamp(sky_depth, 0.0, 2.0);
	// New structure is quietest exactly across the three lane radii.
	float guard_fall = (radius - 0.78) * 1.55;
	float lane_guard = 1.0 - 0.72 * exp(-guard_fall * guard_fall);

	float mid_angle = field_angle + ray_depth * (0.30 + field_bend * 0.055);
	vec2 mid_dir = vec2(cos(mid_angle), sin(mid_angle));
	// Both components of the direction vector, on separate axes, so the sample
	// path is a circle carried along the depth axis: no polar seam, and no fold.
	// Collapsing cos and sin onto one axis (a * cos + b * sin is just one cosine
	// of shifted phase) would have made the entire curtain mirror-symmetric
	// about a single line through the arena, which is not a subtle artefact.
	highp vec2 curtain_p = vec2(mid_dir.x * 3.20 + seed * 0.71,
		mid_dir.y * 3.20 + min(ray_depth, 3.4) * (2.60 * separation)
		+ flow_time * 0.134);
	float curtain = clamp(fbm3(curtain_p + sway * 0.85), 0.0, 1.0);
	float curtain_body = smoothstep(0.40, 0.86, curtain) * haze * lane_guard;
	// The curtain's own filaments, by the same recipe as the deep field's: the
	// half-density contour, stippled by the detail field so it breaks into
	// threads, then raised to sixteen. A mid-value contour is the commonest
	// value an fbm takes, so anything softer than this is a wash, not a thread.
	float curtain_vein = clamp(curtain + (detail - 0.5) * 0.11, 0.0, 1.0);
	float curtain_edge = max(1.0 - abs(2.0 * curtain_vein - 1.0), 0.0);
	curtain_edge *= curtain_edge;
	curtain_edge *= curtain_edge;
	curtain_edge *= curtain_edge;
	curtain_edge *= curtain_edge;
	curtain_edge *= smoothstep(0.34, 0.72, curtain) * haze * lane_guard;
	vec3 curtain_hue = mix(world_tint, world_rim, 0.30 + curtain * 0.34);
	// The curtain occludes what is behind it before it adds its own light.
	color *= 1.0 - curtain_body * 0.17;
	color += curtain_hue * curtain_body * 0.150;
	color += world_rim * curtain_edge * (0.055 + field_grain * 0.045);

	// Narrow streaming fibers, shaded inside the material rather than a wire grid.
	float fiber_phase = wrap_tau(field_angle * 6.0 + radius * 4.0 + warp.y * 5.5
		- flow_time * 0.075);
	float fibers = pow(max(0.0, 1.0 - abs(sin(fiber_phase))), 22.0);
	fibers *= smoothstep(0.32, 0.72, billows) * smoothstep(0.21, 0.68, radius);
	color += mix(world_tint, world_rim, 0.45) * fibers * 0.035 * arena_calm;
	// Wake reveals a small contour and bends the existing volume; it is not a wash.
	color += world_rim * wake * filament * 0.040 * motion_amount;
	color *= arena_calm;

	// ---- Three star planes at three parallax rates. The nebula in front of
	// them takes them away, which is most of why the field reads as deep.
	highp vec2 star_space = (pixel - arena_center) / max(viewport_size.y, 1.0);
	star_space = rotate2(field_lean * 0.10
		+ 0.035 * depth * singularity_amount * exp(-radius * 2.0)) * star_space;
	highp float star_drift = flow_time * 0.30;
	// Each plane's twinkle phase is folded before it is handed over, so the
	// cosine inside star_layer never sees more than a turn plus its cell offset.
	highp float twinkle_clock = seconds * 1.35 * motion_amount;
	float flicker = 0.38 * motion_amount;
	vec3 stars = star_layer(star_space + vec2(seed, star_drift * 0.0022),
		47.0, 0.00145, 0.945, wrap_tau(twinkle_clock), flicker) * 0.38;
	stars += star_layer(star_space + vec2(4.2 - seed, star_drift * 0.0115),
		29.0, 0.00103, 0.949, wrap_tau(twinkle_clock * 0.81) + 1.7, flicker) * 0.54;
	stars += star_layer(star_space + vec2(seed * 0.5 + 8.9, star_drift * 0.0340),
		17.0, 0.00069, 0.962, wrap_tau(twinkle_clock * 0.63) + 3.4, flicker) * 0.68;
	float thickness = clamp(cloud_body * 0.75 + curtain_body * 0.90 + edge * 0.40, 0.0, 1.0);
	float core_void = 1.0 - smoothstep(0.0, 0.22, radius);
	// Points are moderated in the lane band rather than erased by arena_calm:
	// a one-pixel star must not compete with a hazard, or vanish outside it.
	stars *= clamp(star_brightness, 0.0, 2.0) * (1.0 - thickness * 0.88)
		* (1.0 - core_void) * (0.42 + lane_guard * 0.58);
	color += stars;

	// ---- Layer three sits in front of the stars: sparse, thin, and only
	// beyond the outer lane, where it can stream off the edge of the frame
	// without ever crossing the band a hazard has to be read in.
	float shoulder = smoothstep(0.98, 1.44, radius);
	// Everything inside the outer lane has shoulder == 0 exactly, and that is
	// most of the frame, so the two lookups this shell costs are skipped there
	// rather than multiplied away. The boundary is one ring, so the branch is
	// coherent across a warp, and the result is identical either way.
	if (shoulder > 0.0) {
		float near_angle = field_angle + ray_depth * (0.62 - field_bend * 0.070) + 2.14;
		vec2 near_dir = vec2(cos(near_angle), sin(near_angle));
		// Circular sample path, for the same reason as the curtain: no mirror.
		highp vec2 wisp_p = vec2(near_dir.x * 1.90 - seed * 0.43,
			near_dir.y * 1.90 + min(ray_depth, 1.15) * (3.40 * separation)
			+ flow_time * 0.330);
		float wisp = clamp(fbm2(wisp_p + sway * 0.55), 0.0, 1.0);
		float wisp_body = smoothstep(0.55, 0.84, wisp) * shoulder;
		vec3 wisp_hue = mix(world_rim, world_dust, 0.38 + wisp * 0.40);
		color *= 1.0 - wisp_body * 0.20;
		color += wisp_hue * wisp_body * 0.170;
	}

	// A release ignites material that is already lit. A dark part of the cloud
	// stays dark, and there is no full-field gain.
	color += world_rim * (filament + curtain_edge * 0.60)
		* clamp(release_amount, 0.0, 1.0) * 0.055 * arena_calm;

	float vignette = 1.0 - smoothstep(0.36, 0.90, length((UV - 0.5) * vec2(0.78, 1.0)));
	color *= 0.66 + vignette * 0.34;
	// A soft shoulder above the body keeps a bright star core from clipping to
	// a flat white dot; below 0.55 it is the identity, so the tuned cloud body
	// is untouched. Then the gentle toe keeps detail visible on SDR displays.
	color = max(color, vec3(0.0));
	color = color / (1.0 + max(color - vec3(0.55), vec3(0.0)));
	color = pow(color, vec3(0.86));
	// One hash of dither: a sky this dark bands visibly on an 8-bit panel.
	color += vec3(hash21(FRAGCOORD.xy) - 0.5) * 0.0022;
	COLOR = vec4(max(color, vec3(0.004, 0.006, 0.012)), 1.0);
}
