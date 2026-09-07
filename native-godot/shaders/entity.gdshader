shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

// Fixed material light preserves shape on SDR Compatibility renderers.
// Vertex/instance color identifies gameplay meaning, never audio amplitude.
uniform vec4 base_color : source_color = vec4(1.0);
uniform float self_light : hint_range(0.0, 1.0) = 0.28;

void fragment() {
	vec3 pigment = COLOR.rgb * base_color.rgb;
	ALBEDO = pigment;
	METALLIC = 0.24;
	ROUGHNESS = 0.34;
	EMISSION = pigment * self_light;
}
