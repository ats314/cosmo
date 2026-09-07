shader_type spatial;
render_mode blend_add, cull_disabled, unshaded, shadows_disabled;

// Tidal Accretion Bridge — fluid stellar siphon.
// Renders flowing plasma streams stripped from background stars into the singularity.
//
// NOT CURRENTLY WIRED UP: nothing constructs a material from this shader yet.
// It is kept because the curved bridge mesh exists in assets/models and this is
// the surface intended for it. Wire it from the tidal system when that lands.
//
// THE CLOCK IS SUPPLIED, NOT READ FROM THE ENGINE. Godot's TIME keeps running
// while the game is paused, cannot be slowed by the dilation powers, and loses
// float precision on mobile after long sessions — it is a builtin that quietly
// breaks three of this game's rules at once. Every other shader here is driven
// by LivingBackdrop's pause-aware visual clock, and this one now matches: feed
// world_clock the same value, and scale motion_amount for reduced motion.
// At the defaults (clock 0) the stream renders correctly and simply holds still,
// so this is safe to instance before anything drives it.

uniform sampler2D stream_texture : repeat_enable, filter_linear_mipmap;
uniform vec4 bridge_tint : source_color = vec4(0.35, 0.85, 1.0, 1.0);
uniform vec4 core_tint : source_color = vec4(1.0, 0.95, 0.8, 1.0);
uniform float flow_speed : hint_range(0.1, 10.0) = 2.4;
uniform float flow_distortion : hint_range(0.0, 1.0) = 0.12;
uniform float emission_boost : hint_range(1.0, 10.0) = 3.5;
uniform float pulse_rate : hint_range(0.0, 5.0) = 2.0;
uniform float world_clock = 0.0;
uniform float motion_amount : hint_range(0.0, 1.0) = 1.0;

void vertex() {
	// Slight organic undulation along the stream.
	float wave = sin(world_clock * pulse_rate * 2.0 + UV.y * 8.0) * 0.05 * motion_amount;
	VERTEX += NORMAL * wave * (1.0 - abs(UV.x - 0.5) * 2.0);
}

void fragment() {
	// Dynamic flowing UV coordinates.
	float v_offset = world_clock * flow_speed * motion_amount;
	vec2 flow_uv = vec2(UV.x, UV.y * 2.0 - v_offset);

	// Cross-wave distortion.
	float distort = sin(flow_uv.y * 6.0 + world_clock * 3.0 * motion_amount) * flow_distortion;
	flow_uv.x = clamp(flow_uv.x + distort, 0.0, 1.0);

	vec4 stream_sample = texture(stream_texture, flow_uv);

	// Endpoint fading: fade in near the source, out as it enters the singularity.
	float end_fade = smoothstep(0.0, 0.08, UV.y) * smoothstep(1.0, 0.92, UV.y);

	// Lateral edge falloff (U axis).
	float lateral_fade = pow(sin(UV.x * PI), 1.5);

	// Pulse modulation. Holds at a steady 1.0 when motion is reduced rather than
	// stopping at an arbitrary phase.
	float pulse = 1.0 - 0.15 * motion_amount + 0.15 * sin(world_clock * pulse_rate * PI) * motion_amount;

	// Composite: bridge tint through to a brilliant white-gold core.
	vec3 base_color = mix(bridge_tint.rgb, core_tint.rgb, stream_sample.r * stream_sample.r);

	ALBEDO = base_color * stream_sample.rgb * emission_boost * pulse;
	ALPHA = stream_sample.a * bridge_tint.a * lateral_fade * end_fade;
}
