shader_type canvas_item;
render_mode unshaded, blend_disabled;

// Original Cosmo material. Presentation coordinates never alter encounter geometry.
// All animation is supplied by LivingBackdrop's pause-aware clock; no engine TIME.
uniform vec2 viewport_size = vec2(540.0, 960.0);
uniform vec2 arena_center = vec2(270.0, 480.0);
uniform vec2 arena_radii = vec2(218.0, 310.0);
uniform float world_clock = 0.0;
uniform float travel = 0.0;
uniform float wake_phase = 0.0;
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

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.53;
	for (int i = 0; i < 4; i++) {
		value += amplitude * noise2(p);
		p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 9.13;
		amplitude *= 0.48;
	}
	return value;
}

mat2 rotate2(float angle) {
	return mat2(vec2(cos(angle), sin(angle)), vec2(-sin(angle), cos(angle)));
}

float angle_delta(float a, float b) {
	return atan(sin(a - b), cos(a - b));
}

// Stable sparse points. Travel gives parallax; brightness never twinkles.
float star_layer(vec2 p, float scale, float size, float threshold) {
	vec2 cell = floor(p * scale);
	vec2 local = fract(p * scale);
	vec2 center = vec2(hash21(cell + 13.0), hash21(cell + 97.0)) * 0.64 + 0.18;
	float presence = step(threshold, hash21(cell + 1.1));
	float radius = length(local - center);
	float star = exp(-radius * radius / size);
	return star * presence;
}

void fragment() {
	vec2 pixel = UV * viewport_size;
	vec2 orbital = (pixel - arena_center) / arena_radii;
	float radius = max(length(orbital), 0.001);
	float angle = atan(orbital.y, orbital.x);
	float seconds = world_clock;
	float distance = travel;
	float seed = world_seed * 13.37;
	float depth = -log(max(radius, 0.115));

	// These are visual current displacements. No ring or hazard is projected here.
	float trail_angle = angle_delta(angle, player_angle);
	float behind = smoothstep(-0.15, 0.30, -trail_angle * player_direction);
	float wake = exp(-trail_angle * trail_angle * 2.0) * behind;
	wake *= exp(-pow((radius - player_radius) * 3.2, 2.0));
	float reversal = angle_delta(angle, turn_angle);
	float turning = turn_strength * exp(-reversal * reversal * 3.3);
	turning *= exp(-pow((radius - player_radius) * 2.7, 2.0));
	float crossing = angle_delta(angle, hop_angle);
	float braid = hop_strength * exp(-crossing * crossing * 5.5);
	braid *= exp(-pow((radius - hop_radius) * 2.6, 2.0));
	float current_twist = wake * (0.19 + magnet_amount * 0.10) * player_direction;
	current_twist += turning * 0.38 + braid * sin(radius * 10.0) * 0.20;
	current_twist *= motion_amount;
	float passage = tunnel_amount * (depth * (0.38 + reservoir * 0.045) + distance * 0.055);
	float opening = release_amount * exp(-pow(radius * 0.66, 2.0));
	float field_angle = angle + passage + current_twist + wake_phase * 0.032;
	field_angle += opening * sin(angle * 2.0 + depth) * 0.23;
	vec2 spiral = vec2(cos(field_angle), sin(field_angle));
	float lens = singularity_amount * 0.030 / (radius * radius + 0.055);
	vec2 p = spiral * (radius + lens) * 1.65;
	p = rotate2(field_lean) * p;
	p += vec2(seed, -seed * 0.37);
	// A translating weather volume keeps non-tunnel worlds alive too.
	p += vec2(seconds * 0.007, -seconds * 0.011);

	vec2 warp = vec2(fbm(p * 1.15 + vec2(3.7, 1.2)), fbm(p * 1.15 + vec2(8.3, 4.8)));
	float billows = fbm(p * 2.20 + warp * 3.1);
	float detail = noise2(p * 9.0 + warp * 4.8);
	float ridged = 1.0 - abs(2.0 * fbm(p * 3.3 + warp * 2.6) - 1.0);
	float sweep = sin(field_angle * 2.0 - radius * field_bend * 1.7 + warp.x * 4.0);
	float cloud_body = smoothstep(0.26, 0.78, billows + sweep * 0.095);
	float dust_lane = smoothstep(0.40, 0.69, billows + detail * 0.14);
	float filament = pow(max(ridged, 0.0), 9.0) * cloud_body;
	float edge = smoothstep(0.57, 0.89, cloud_body);
	float arena_calm = mix(0.44, 0.94, smoothstep(0.91, 1.45, radius));
	vec3 color = vec3(0.009, 0.016, 0.035);
	color += mix(world_tint, world_dust, smoothstep(0.34, 0.70, warp.y)) * cloud_body * 0.20;
	color += world_rim * filament * (0.075 + field_grain * 0.025);
	color += world_dust * edge * 0.105;
	color *= mix(1.0, 0.52, dust_lane * (1.0 - filament));
	color *= arena_calm;
	// Narrow streaming fibers, shaded inside the material rather than a wire grid.
	float fiber_phase = field_angle * 6.0 + radius * 4.0 + warp.y * 5.5 - distance * 0.10;
	float fibers = pow(max(0.0, 1.0 - abs(sin(fiber_phase))), 22.0);
	fibers *= smoothstep(0.30, 0.70, billows) * smoothstep(0.21, 0.68, radius);
	color += mix(world_tint, world_rim, 0.45) * fibers * 0.035 * arena_calm;
	// Wake reveals a small contour and bends the existing volume; it is not a wash.
	color += world_rim * wake * filament * 0.040 * motion_amount;

	vec2 star_space = (pixel - arena_center) / viewport_size.y;
	star_space = rotate2(0.035 * depth * singularity_amount * exp(-radius * 2.0)) * star_space;
	float star1 = star_layer(star_space + vec2(seed, distance * 0.0008), 43.0, 0.00085, 0.946);
	float star2 = star_layer(star_space + vec2(-seed, distance * 0.0019), 24.0, 0.00070, 0.968);
	float distant = 1.0 - smoothstep(0.0, 0.22, radius);
	color += vec3(0.36, 0.48, 0.65) * (star1 * 0.62 + star2 * 0.83) * (1.0 - distant);
	float vignette = 1.0 - smoothstep(0.36, 0.90, length((UV - 0.5) * vec2(0.78, 1.0)));
	color *= 0.66 + vignette * 0.34;
	// A gentle toe keeps cloud detail visible on ordinary SDR displays.
	color = pow(max(color, vec3(0.0)), vec3(0.86));
	COLOR = vec4(color, 1.0);
}
