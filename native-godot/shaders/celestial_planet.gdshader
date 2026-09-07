shader_type canvas_item;
render_mode unshaded;

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
uniform vec3 world_tint : source_color = vec3(0.20, 0.39, 0.74);
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.00);
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
	float amplitude = 0.52;
	for (int i = 0; i < 4; i++) {
		value += noise2(p) * amplitude;
		p = mat2(vec2(1.62, 1.18), vec2(-1.18, 1.62)) * p + 8.7;
		amplitude *= 0.48;
	}
	return value;
}

void fragment() {
	vec2 p = (UV * viewport_size - planet_center) / planet_radius;
	float r = length(p);
	float aa = 1.2 / planet_radius;
	float time = world_clock;
	float c = cos(planet_tilt);
	float s = sin(planet_tilt);
	vec2 ring_plane = mat2(vec2(c, s), vec2(-s, c)) * p;
	vec2 ring_ellipse = ring_plane / vec2(1.0, max(planet_flatten, 0.13));
	float ring_r = length(ring_ellipse);
	float ring_mask = smoothstep(1.14, 1.22, ring_r) * (1.0 - smoothstep(1.86, 1.97, ring_r));
	float gap_inner = 1.0 - smoothstep(0.006, 0.024, abs(ring_r - 1.54));
	float gap_outer = 1.0 - smoothstep(0.003, 0.011, abs(ring_r - 1.75));
	float ring_grain = 0.62 + 0.11 * sin(ring_r * 91.0) + 0.035 * sin(ring_r * 183.0);
	ring_grain *= 0.65 + 0.35 * noise2(ring_ellipse * 9.0);
	float ring_profile = exp(-pow((ring_r - 1.47) / 0.36, 2.0));
	float ring_alpha = ring_mask * ring_grain * ring_profile;
	ring_alpha *= (1.0 - gap_inner * 0.77) * (1.0 - gap_outer * 0.66) * 0.40;
	vec3 ring_color = mix(world_tint, world_rim, 0.68) * 0.38;
	// Near-side rings cross in front of the sphere; far side is naturally hidden.
	bool ring_in_front = ring_plane.y > 0.0;
	vec3 color = ring_color;
	float alpha = ring_alpha;

	if (r < 1.055) {
		float z = sqrt(max(0.0, 1.0 - min(r * r, 1.0)));
		vec3 normal = vec3(p, z);
		vec3 light_dir = normalize(vec3(cos(light_angle), sin(light_angle), 0.36));
		float lighting = max(dot(normal, light_dir), 0.0);
		vec2 surface = vec2(atan(p.x, max(z, 0.012)), asin(clamp(p.y, -1.0, 1.0)));
		surface.x += time * 0.009;
		surface += vec2(world_seed * 3.17, world_seed * 1.37);
		float weather = fbm(surface * vec2(4.5, 7.0));
		float terrain = fbm(surface * 12.0 + weather * 2.1);
		float bands = sin(surface.y * 53.0 + weather * 8.0 + sin(surface.x * 4.0));
		float thin_bands = sin(surface.y * 146.0 + weather * 16.0);
		float gas = 0.42 + bands * 0.18 + thin_bands * 0.055 + terrain * 0.20;
		float stone = smoothstep(0.29, 0.68, terrain);
		float material = mix(gas, stone, rock_amount);
		vec3 surface_color = mix(world_tint * 0.36, mix(world_rim, world_dust, 0.27), material * 0.64);
		float clouds = smoothstep(0.53, 0.76, weather + terrain * 0.12) * cloud_amount;
		surface_color = mix(surface_color, world_rim * 0.73, clouds * 0.38);
		vec3 body = surface_color * (0.075 + pow(lighting, 0.70) * 0.64);
		// A colored atmosphere emerges through a narrow, continuously shaded limb.
		float inner_air = pow(max(0.0, 1.0 - z), 3.5) * (0.14 + lighting * 0.58);
		body += world_rim * inner_air * 0.40;
		float body_alpha = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
		float outer_air = exp(-abs(r - 1.006) * 95.0) * (0.12 + lighting * 0.75);
		vec3 air_color = world_rim * 0.55;
		float air_alpha = outer_air * (1.0 - body_alpha) * 0.70;
		color = mix(color, air_color, air_alpha);
		alpha = max(alpha, air_alpha);
		color = mix(color, body, body_alpha);
		alpha = max(alpha, body_alpha);
		if (ring_in_front) {
			color = mix(color, ring_color, ring_alpha * 0.90);
		}
	}
	COLOR = vec4(color, alpha);
}
