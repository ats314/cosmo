shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, depth_draw_never;

// COSMO :: 3D Wormhole Galaxy Transition Tunnel
// Procedural Einstein-Rosen bridge, concentric neon rings, and relativistic warp streaks.
// OpenGL ES 3.0 / GL Compatibility safe.

uniform float wormhole_amount : hint_range(0.0, 1.0) = 0.0;
uniform float tunnel_clock = 0.0;
uniform float warp_speed : hint_range(0.0, 10.0) = 2.5;
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.0);
uniform vec3 world_tint : source_color = vec3(0.20, 0.39, 0.74);
uniform vec3 plasma_color : source_color = vec3(1.0, 0.35, 0.65);
uniform vec3 grid_color : source_color = vec3(0.35, 0.85, 1.0);

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
		mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

void fragment() {
	if (wormhole_amount <= 0.001) {
		discard;
	}

	// UV.x: circumference [0, 1], UV.y: depth along tunnel [0, 1] (0 is near, 1 is far throat)
	vec2 uv = UV;

	// Spacetime curvature: vortex swirl increases toward the throat (UV.y -> 1.0)
	float throat_depth = pow(uv.y, 2.2);
	float twist = throat_depth * 4.5;
	float angle_coord = fract(uv.x + twist - tunnel_clock * 0.12);

	// 1. Spacetime Wireframe Grid (User Ref 1: Einstein-Rosen mesh)
	float longitudinal_lines = abs(sin(angle_coord * TAU * 16.0));
	float grid_long = smoothstep(0.88, 0.98, longitudinal_lines);

	float ring_phase = (uv.y * 28.0 - tunnel_clock * warp_speed);
	float transverse_lines = abs(sin(ring_phase * PI));
	float grid_trans = smoothstep(0.85, 0.97, transverse_lines);

	float wireframe = max(grid_long * 0.65, grid_trans * 0.85);

	// 2. Concentric Glowing Neon Rings (User Ref 3: prominent hyperspace rings)
	float major_ring_phase = (uv.y * 7.0 - tunnel_clock * (warp_speed * 0.75));
	float major_ring = smoothstep(0.92, 0.995, abs(sin(major_ring_phase * PI)));
	float ring_glow = exp(-abs(fract(major_ring_phase) - 0.5) * 6.0) * 0.45;

	// 3. Relativistic Plasma Warp Streaks (User Refs 2 & 4)
	vec2 streak_uv = vec2(angle_coord * 32.0, uv.y * 3.0 - tunnel_clock * (warp_speed * 2.2));
	float streaks = noise2(streak_uv) * noise2(streak_uv * 1.8 + vec2(1.5, -tunnel_clock * warp_speed));
	streaks = pow(streaks, 2.5) * 3.5;

	// 4. Throat Aperture Glow (User Ref 5: swirling event horizon vortex)
	float throat_glow = pow(uv.y, 3.5) * 2.8;

	// Color composition
	vec3 base_grid = mix(grid_color, world_rim, 0.4) * (wireframe * 1.8);
	vec3 neon_rings = mix(plasma_color, vec3(1.0, 0.92, 0.8), 0.3) * (major_ring * 3.2 + ring_glow * 1.2);
	vec3 warp_fire = mix(world_tint, plasma_color, clamp(streaks * 0.5, 0.0, 1.0)) * streaks;
	vec3 vortex = mix(world_rim, vec3(1.0, 1.0, 1.0), 0.6) * throat_glow;

	// Depth attenuation: fade smoothly at near camera clip and enhance inside throat
	float depth_fade = smoothstep(0.02, 0.15, uv.y) * smoothstep(1.0, 0.82, uv.y * 0.8);

	vec3 final_color = (base_grid + neon_rings + warp_fire + vortex) * depth_fade * wormhole_amount;

	ALBEDO = final_color;
	ALPHA = clamp(length(final_color) * 0.8, 0.0, 1.0) * wormhole_amount;
}
