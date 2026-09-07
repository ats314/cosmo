shader_type canvas_item;
render_mode unshaded;

uniform vec2 rect_size = vec2(240.0, 240.0);
uniform float world_clock = 0.0;
uniform float motion_amount = 1.0;
uniform float reservoir = 0.0;
uniform float release_amount = 0.0;
uniform float singularity_amount = 1.0;
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.0);

void fragment() {
	vec2 p = (UV - 0.5) * rect_size;
	float radius = length(p);
	float core_size = 30.0 + reservoir * 2.5;
	float hole = 1.0 - smoothstep(core_size - 0.65, core_size + 0.65, radius);
	float time = world_clock;
	float tilt = -0.29;
	mat2 rot = mat2(vec2(cos(tilt), sin(tilt)), vec2(-sin(tilt), cos(tilt)));
	vec2 disk = rot * p;
	float side = smoothstep(-3.0, 3.0, disk.y);
	float disk_radius = length(disk / vec2(1.0, 0.33));
	float ring = exp(-pow((disk_radius - 53.0) / 26.0, 2.0));
	ring *= smoothstep(32.0, 38.0, disk_radius) * (1.0 - smoothstep(79.0, 99.0, disk_radius));
	float angle = atan(disk.y / 0.33, disk.x);
	float striation = 0.80 + 0.12 * sin(disk_radius * 0.67 + angle * 3.0 - time * 0.55);
	striation += 0.05 * sin(disk_radius * 1.2 - angle * 2.0 + time * 0.23);
	float beaming = 0.47 + 0.43 * smoothstep(-65.0, 65.0, disk.x);
	float disk_alpha = ring * striation * beaming;
	// The far disk is occulted. The near disk traverses the dark silhouette.
	disk_alpha *= mix(1.0 - hole, 1.0, side);
	float photon_ring = exp(-pow((radius - core_size - 1.5) / 1.55, 2.0));
	float lensed_arc = exp(-pow((length(p / vec2(1.0, 0.92)) - 39.0) / 3.0, 2.0));
	lensed_arc *= smoothstep(-2.0, 2.0, -p.y) * 0.20;
	float halo = exp(-pow((radius - core_size - 3.0) / 14.0, 2.0)) * (1.0 - hole);
	vec3 warm = mix(vec3(0.70, 0.56, 0.72), vec3(0.98, 0.72, 0.46), reservoir * 0.65);
	vec3 color = mix(warm * 0.76, vec3(0.001, 0.003, 0.010), hole);
	color = mix(color, warm * 0.90, disk_alpha * hole);
	float alpha = max(hole, disk_alpha * 0.86);
	color += world_rim * photon_ring * 0.60 + warm * lensed_arc;
	color += world_rim * halo * 0.022;
	alpha = max(alpha, photon_ring * 0.85 + halo * 0.14 + lensed_arc);
	// A sustained earned release opens two narrow jets. No screen-wide gain pulse.
	vec2 jet_axis = rot * p;
	float jet_width = 2.7 + abs(jet_axis.y) * 0.060;
	float jet = exp(-pow(jet_axis.x / jet_width, 2.0));
	jet *= smoothstep(33.0, 47.0, abs(jet_axis.y));
	jet *= 1.0 - smoothstep(91.0, 116.0, abs(jet_axis.y));
	jet *= release_amount;
	color = mix(color, mix(world_rim, vec3(0.78, 0.86, 0.97), 0.5), jet * 0.63);
	alpha = max(alpha, jet * 0.74);
	COLOR = vec4(color, alpha * singularity_amount);
}
