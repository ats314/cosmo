shader_type spatial;
render_mode blend_add, cull_disabled, unshaded, shadows_disabled;

// Tidal Accretion Bridge — Fluid Stellar Siphon Shader
// Renders flowing plasma streams stripped from background stars into the black hole.

uniform sampler2D stream_texture : repeat_enable, filter_linear_mipmap;
uniform vec4 bridge_tint : source_color = vec4(0.35, 0.85, 1.0, 1.0);
uniform vec4 core_tint : source_color = vec4(1.0, 0.95, 0.8, 1.0);
uniform float flow_speed : hint_range(0.1, 10.0) = 2.4;
uniform float flow_distortion : hint_range(0.0, 1.0) = 0.12;
uniform float emission_boost : hint_range(1.0, 10.0) = 3.5;
uniform float pulse_rate : hint_range(0.0, 5.0) = 2.0;

void vertex() {
	// Slight organic undulation along the stream
	float wave = sin(TIME * pulse_rate * 2.0 + UV.y * 8.0) * 0.05;
	VERTEX += NORMAL * wave * (1.0 - abs(UV.x - 0.5) * 2.0);
}

void fragment() {
	// Dynamic flowing UV coordinates
	float v_offset = TIME * flow_speed;
	vec2 flow_uv = vec2(UV.x, UV.y * 2.0 - v_offset);
	
	// Cross-wave distortion
	float distort = sin(flow_uv.y * 6.0 + TIME * 3.0) * flow_distortion;
	flow_uv.x = clamp(flow_uv.x + distort, 0.0, 1.0);
	
	vec4 stream_sample = texture(stream_texture, flow_uv);
	
	// Endpoint fading: smoothly fade in near source and fade out as it enters singularity
	float end_fade = smoothstep(0.0, 0.08, UV.y) * smoothstep(1.0, 0.92, UV.y);
	
	// Lateral edge falloff (U axis)
	float lateral_fade = pow(sin(UV.x * PI), 1.5);
	
	// Pulse modulation
	float pulse = 0.85 + 0.15 * sin(TIME * pulse_rate * PI);
	
	// Composite color: mix between bridge tint and brilliant white-gold core
	vec3 base_color = mix(bridge_tint.rgb, core_tint.rgb, stream_sample.r * stream_sample.r);
	
	ALBEDO = base_color * stream_sample.rgb * emission_boost * pulse;
	ALPHA = stream_sample.a * bridge_tint.a * lateral_fade * end_fade;
}
