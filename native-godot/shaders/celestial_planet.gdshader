shader_type canvas_item;
render_mode unshaded;

// Original Cosmo material. One authored world lit by one star: the globe, its
// air and its belt all read the same light vector, so the terminator, the limb
// crescent, the shadow the belt casts on the globe and the shadow the globe
// casts on the belt all agree with each other.
//
// The planet is scenery. It carries structure, depth and a real day/night
// boundary, and it deliberately yields contrast inside the orbit annulus so the
// comet, the gold stars and the red threats keep theirs. Fill rate is spent
// where it shows: noise runs only inside the disc, the belt is analytic, and
// every high frequency fades before it can alias.

uniform vec2 viewport_size = vec2(540.0, 960.0);
uniform vec2 planet_center = vec2(-130.0, 75.0);
uniform float planet_radius = 390.0;
uniform float world_clock = 0.0;
uniform float motion_amount = 1.0;
uniform float world_seed = 0.0;
uniform float planet_tilt = -0.38;
uniform float planet_flatten = 0.24;
uniform float rock_amount = 0.12;
uniform float cloud_amount = 0.88;
uniform float light_angle = 0.8;
uniform vec2 tidal_point = vec2(0.70, 0.70);
uniform float tidal_amount = 0.0;
uniform float tidal_phase = 0.0;
uniform vec3 world_tint : source_color = vec3(0.20, 0.39, 0.74);
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.00);
uniform vec3 world_dust : source_color = vec3(0.53, 0.15, 0.40);
// Optional taste controls. Every one of them is already correct at its default,
// so the shader stands alone until an integrator chooses to drive it.
uniform float arena_calm = 0.56;
uniform float surface_gain = 1.0;
uniform float air_gain = 1.0;
uniform float ring_gain = 1.0;

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
	float amplitude = 0.52;
	for (int i = 0; i < 4; i++) {
		value += noise2(p) * amplitude;
		p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 8.7;
		amplitude *= 0.48;
	}
	return value;
}
// Two octaves are enough for the layer that only ever supplies fine grain; the
// coarse shape below it already comes from the four-octave field.
float fbm2(vec2 p) {
	float value = noise2(p) * 0.62;
	p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 8.7;
	return value + noise2(p) * 0.31;
}

// The belt's radial profile: two shepherded edges, a broad density hump, one
// wide division and one hairline. Analytic and cheap, because it is evaluated a
// second time to work out what the belt shadows on the globe.
float ring_density(float rr) {
	float band = smoothstep(1.150, 1.205, rr) * (1.0 - smoothstep(1.880, 1.985, rr));
	float shape = (rr - 1.505) / 0.415;
	float divide = (rr - 1.545) / 0.030;
	float hair = (rr - 1.760) / 0.013;
	float profile = exp(-shape * shape);
	return band * profile * (1.0 - 0.88 * exp(-divide * divide)) * (1.0 - 0.52 * exp(-hair * hair));
}

// A frequency is only worth drawing while it is still resolvable. Past that it
// is moire, so it is faded out against the local screen-space gradient.
float band_fade(float frequency, float gradient) {
	return 1.0 - smoothstep(1.0, 2.2, frequency * gradient);
}

void fragment() {
	vec2 pixel = UV * viewport_size;
	float radius_px = max(planet_radius, 1.0);
	vec2 p = (pixel - planet_center) / radius_px;
	float r = length(p);
	float aa = 1.6 / radius_px;
	float spin = world_clock * clamp(motion_amount, 0.0, 1.0);

	float tilt_c = cos(planet_tilt);
	float tilt_s = sin(planet_tilt);
	mat2 tilt_m = mat2(vec2(tilt_c, tilt_s), vec2(-tilt_s, tilt_c));
	// The belt's opening angle also fixes the world's pole: rings and equator
	// are the same plane, so the cloud bands run parallel to the belt.
	float flat_f = clamp(planet_flatten, 0.10, 0.80);
	float flat_g = sqrt(max(0.0, 1.0 - flat_f * flat_f));
	vec3 ring_axis = vec3(0.0, -flat_g, flat_f);
	vec3 ring_up = vec3(0.0, flat_f, flat_g);

	vec2 ring_plane = tilt_m * p;
	vec2 ring_ellipse = ring_plane / vec2(1.0, flat_f);
	float ring_r = length(ring_ellipse);
	bool ring_in_front = ring_plane.y > 0.0;

	vec3 sun = normalize(vec3(cos(light_angle), sin(light_angle), 0.36));
	vec3 sun_ring = vec3(tilt_m * sun.xy, sun.z);

	// The backdrop steps back inside the orbit annulus. Same intent as the
	// nebula's arena calm: gameplay owns the contrast there, deliberately.
	float arena_h = min(viewport_size.x * 0.405, max(100.0, (viewport_size.y - 240.0) / 2.826));
	vec2 arena_r = max(vec2(arena_h, arena_h * 1.413), vec2(1.0));
	float arena_d = length((pixel - viewport_size * 0.5) / arena_r);
	float calm = mix(clamp(arena_calm, 0.0, 1.0), 1.0, smoothstep(0.58, 1.46, arena_d));

	vec3 belt = vec3(0.0);
	float belt_alpha = 0.0;
	float base = ring_density(ring_r);
	if (base > 0.0015) {
		// This point lies in the inclined belt plane, so its depth follows from
		// its screen offset; the belt is shaded as real geometry, not a decal.
		vec3 belt_point = vec3(ring_plane.x, ring_plane.y, ring_plane.y * flat_g / flat_f);
		vec3 belt_dir = belt_point / max(ring_r, 0.001);
		// Screen-space rate of change of the orbital radius, used to retire
		// lanes as the belt closes toward edge-on.
		float grad = length(vec2(ring_plane.x, ring_plane.y / (flat_f * flat_f)))
			/ (max(ring_r, 0.001) * radius_px);
		float sweep = ring_r * 46.0 + sin(ring_r * 7.0 + spin * 0.05) * 1.6;
		float lanes = 0.50
			+ 0.21 * sin(sweep) * band_fade(46.0, grad)
			+ 0.14 * sin(ring_r * 121.0 - spin * 0.030) * band_fade(121.0, grad)
			+ 0.09 * sin(ring_r * 268.0 + spin * 0.017) * band_fade(268.0, grad);
		lanes = clamp(lanes, 0.0, 1.0);
		// Lit face, then the globe's own round shadow thrown across the belt:
		// the closest approach of the ray to the sphere decides it exactly.
		float face = dot(belt_dir, sun_ring);
		float lit = 0.52 + 0.48 * smoothstep(-0.85, 0.60, face);
		float toward = dot(belt_point, sun_ring);
		float miss = sqrt(max(0.0, ring_r * ring_r - toward * toward));
		float eclipse = (1.0 - smoothstep(0.92, 1.08, miss)) * smoothstep(0.0, 0.30, -toward);
		float shade = mix(1.0, 0.15, eclipse);
		// Dust in the sparse lanes, brighter ice in the dense ones. The belt
		// takes its minerals from this world, so eight belts stay distinct.
		vec3 dusty = mix(world_dust, world_tint, 0.42);
		vec3 icy = mix(world_rim, vec3(1.0), 0.22);
		vec3 mineral = mix(dusty, icy, clamp(0.26 + lanes * 0.82, 0.0, 1.0));
		float haze = (ring_r - 1.52) / 0.46;
		float glow = base * (0.14 + lanes * 0.54) + exp(-haze * haze) * 0.035;
		belt = mineral * glow * lit * shade * 0.86 * calm * clamp(ring_gain, 0.0, 3.0);
		belt_alpha = clamp(base * (0.30 + lanes * 0.78) * 0.58, 0.0, 0.66);
	}

	// Back to front: far belt, then the air, then the globe, then the near belt.
	// Accumulated premultiplied so each layer both occludes and adds.
	vec3 acc = vec3(0.0);
	float acc_a = 0.0;
	if (!ring_in_front) {
		acc = belt * belt_alpha;
		acc_a = belt_alpha;
	}

	// The atmosphere exists before the surface. Its height is visible against
	// space as a bright shell over a wide corona, both brightest where the star
	// grazes the limb and both nearly gone on the night side.
	if (r > 0.90 && r < 1.56) {
		vec2 edge_n = p / max(r, 0.0001);
		float day_edge = clamp(dot(edge_n, sun.xy) * 0.5 + 0.5, 0.0, 1.0);
		day_edge = pow(day_edge, 2.6);
		float d = abs(r - 1.0);
		float shell = exp(-d / 0.042);
		float corona = exp(-d / 0.125) * (1.0 - smoothstep(0.26, 0.54, d));
		float air = (shell * 0.86 + corona * 0.30) * (0.045 + day_edge * 0.955);
		air *= calm * clamp(air_gain, 0.0, 3.0);
		vec3 air_color = mix(world_rim, vec3(1.0), day_edge * 0.30);
		float air_alpha = clamp(air * 0.72, 0.0, 0.86);
		acc = air_color * air_alpha + acc * (1.0 - air_alpha);
		acc_a = air_alpha + acc_a * (1.0 - air_alpha);
	}

	if (r < 1.0 + aa) {
		float z = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
		vec3 normal = vec3(p, z);
		float lambert = dot(normal, sun);
		// The terminator. A wide, soft day/night boundary is the single thing
		// that makes a disc read as a ball.
		float daylight = smoothstep(-0.10, 0.42, lambert);

		// Sphere mapping about the belt's own axis. Latitude and longitude are
		// taken in that frame, so detail compresses toward the limb and the
		// bands lie in the same plane as the rings. Longitude is scaled by the
		// cosine of latitude, which keeps features their width at the poles
		// instead of pinching them into a knot.
		vec3 sphere = vec3(tilt_m * p, z);
		float pole_h = clamp(dot(sphere, ring_axis), -1.0, 1.0);
		float coslat = sqrt(max(0.0, 1.0 - pole_h * pole_h));
		float lat = asin(pole_h);
		float lon = atan(sphere.x + 1e-5, dot(sphere, ring_up)) * coslat;

		// Body rotation, and a weather layer that shears with latitude, so the
		// bands slide past one another instead of the whole disc sliding.
		float turn = spin * 0.030;
		float shear = spin * 0.034 * (0.35 + 0.65 * cos(lat * 2.0)) * clamp(cloud_amount, 0.0, 1.0);
		vec2 body_map = vec2(lon + turn, lat);
		vec2 air_map = vec2(lon + turn + shear, lat);

		// The source patch is advected toward the extraction point. The sphere,
		// illumination, atmosphere and silhouette remain geometrically unchanged.
		vec2 from_source = p - tidal_point;
		float extraction = exp(-dot(from_source, from_source) * 15.0) * tidal_amount;
		vec2 rolling = vec2(-from_source.y, from_source.x);
		vec2 pull = (from_source * 0.20 + rolling * 0.035) * tidal_phase * extraction;
		body_map += pull;
		air_map += pull;
		air_map.y += sin(from_source.x * 28.0 + tidal_phase * 0.45) * extraction * 0.015;

		// Detail is only trustworthy where the sphere faces us and away from the
		// poles; everywhere else it is retired into haze rather than aliased.
		float facing = clamp(z, 0.0, 1.0);
		float crisp = smoothstep(0.015, 0.30, facing)
			* (1.0 - smoothstep(0.72, 0.995, abs(pole_h)) * 0.80);

		vec2 seed_off = vec2(world_seed * 5.30, world_seed * 3.70);
		// Domain warp first: it buys coastlines and storm curl for two samples,
		// which brute-force octaves never would.
		vec2 warp = vec2(noise2(body_map * 3.0 + seed_off + 1.7),
			noise2(body_map * 3.0 + seed_off + 9.1)) - 0.5;
		float terrain = fbm(body_map * vec2(3.4, 4.6) + warp * 2.6 + seed_off);
		float veil = fbm2(air_map * vec2(11.0, 15.0) + warp * 4.2 + seed_off * 1.7);

		// Broad structure, then fine structure on top, both free of extra noise.
		float bands = 0.5 + 0.5 * sin(lat * 19.0 + warp.x * 5.5 + terrain * 4.2);
		float fine = 0.5 + 0.5 * sin(lat * 47.0 + warp.y * 9.0 + terrain * 3.0);
		float storm = 0.5 + 0.5 * sin(lon * 5.0 + lat * 16.0 + warp.y * 7.0);
		float gas = 0.5 + (bands - 0.5) * 0.62 + (storm - 0.5) * 0.30
			+ (fine - 0.5) * 0.18 * crisp + (veil - 0.465) * 0.55;
		float rock = terrain * 1.05 + (veil - 0.465) * 0.28;
		float ground = clamp(rock_amount, 0.0, 1.0);
		float material = clamp(mix(clamp(gas, 0.0, 1.0), clamp(rock, 0.0, 1.0), ground), 0.0, 1.0);
		material = mix(0.5, material, 0.16 + 0.84 * crisp);

		// A gas world reads as a soft gradient between belts; a rock world reads
		// as hard coastlines between basin and highland. Same field, different
		// contrast, so the eight worlds are different KINDS of world.
		vec3 deep = world_tint * 0.16;
		vec3 mid = world_tint * 0.86 + world_rim * 0.13;
		vec3 high = mix(world_rim, vec3(1.0), 0.22);
		vec3 lowland = mix(world_dust, world_tint, 0.45);
		vec3 surface = mix(deep, mid, smoothstep(mix(0.16, 0.40, ground), mix(0.82, 0.50, ground), material));
		// Written as one minus a rising ramp: smoothstep with edge0 above edge1
		// is undefined in GLSL, however reliably drivers happen to handle it.
		surface = mix(surface, lowland, (1.0 - smoothstep(0.06, 0.34, material)) * 0.55);
		surface = mix(surface, high, smoothstep(0.74, 0.97, material) * 0.55);

		float cover = clamp(cloud_amount, 0.0, 1.0);
		float cloud = smoothstep(0.52 - cover * 0.16, 0.80 - cover * 0.10, veil + terrain * 0.16);
		cloud *= cover * (0.35 + 0.65 * crisp);
		surface = mix(surface, mix(world_rim, vec3(1.0), 0.30), cloud * 0.46);

		float relief = clamp(0.80 + (veil - 0.465) * 0.60 * crisp, 0.40, 1.30);
		vec3 globe = surface * (0.030 + daylight * 0.76) * relief;

		// The belt throws its own shadow across the day side. The ray to the
		// star is intersected with the belt plane and sampled at that radius.
		float denom = dot(sun_ring, ring_axis);
		float sgn = denom < 0.0 ? -1.0 : 1.0;
		float t_hit = -dot(sphere, ring_axis) / (sgn * max(abs(denom), 0.05));
		vec3 hit = sphere + sun_ring * max(t_hit, 0.0);
		float cast = ring_density(length(vec2(hit.x, dot(hit, ring_up))));
		cast *= step(0.0001, t_hit) * smoothstep(0.05, 0.16, abs(denom));
		globe *= mix(1.0, 1.0 - clamp(cast, 0.0, 1.0) * 0.55, daylight);

		// Reflected light gives the night hemisphere volume instead of a hole.
		float shoulder = 1.0 - facing;
		globe += world_tint * (0.013 + 0.046 * shoulder * shoulder) * (0.60 + terrain * 0.40);
		// The luminous limb, and the thin crescent where the star grazes it.
		// It wraps a little past the terminator and dies there.
		float limb = pow(shoulder, 3.8) * pow(max(0.0, lambert + 0.26), 1.4);
		globe += world_rim * limb * 0.72;
		// Polar aurora: night side only, thin worlds only, and it moves.
		float aurora = pow(shoulder, 2.2) * smoothstep(0.55, 0.94, abs(pole_h));
		aurora *= 0.42 + 0.58 * sin(lon * 14.0 + warp.y * 6.0 + spin * 0.55);
		aurora *= (1.0 - daylight * 0.75) * (1.0 - ground * 0.55);
		globe += mix(world_rim, world_dust, 0.35) * max(aurora, 0.0) * 0.20;

		globe *= calm * clamp(surface_gain, 0.0, 3.0);
		float body_alpha = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
		acc = globe * body_alpha + acc * (1.0 - body_alpha);
		acc_a = body_alpha + acc_a * (1.0 - body_alpha);
	}

	// The near half of the belt crosses in front of the globe, dimming it and
	// laying its own lit strands over it. That crossing is what makes the scale
	// of the thing unmistakable.
	if (ring_in_front) {
		acc = belt * belt_alpha + acc * (1.0 - belt_alpha);
		acc_a = belt_alpha + acc_a * (1.0 - belt_alpha);
	}

	// Inside the orbit annulus the backdrop keeps its shadows and gives up its
	// highlights. A hue-preserving soft knee, not a flat dim: the sphere still
	// reads behind the play space, but nothing on it can rival a gold star or a
	// red threat. The divisor is never below one, so this only ever darkens.
	acc /= 1.0 + dot(acc, vec3(0.2126, 0.7152, 0.0722)) * ((1.0 - calm) * 3.2);

	COLOR = vec4(acc / max(acc_a, 0.0001), clamp(acc_a, 0.0, 1.0));
}
