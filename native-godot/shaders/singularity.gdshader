shader_type canvas_item;
render_mode unshaded;

// Cosmo :: singularity. Original work for this product. No third-party shader
// source, snippet, asset or audio.
//
// Palette and proportions follow the tuned original (src/game/runtime.js
// drawSingularity): 0.33 projected flattening, a pale cream inner disc, a warm
// peach body, a violet lensing haze, and the same photographic shoulder
//   col = 1.0 - exp(-col * 1.35)
// the sky already uses, so highlights roll off instead of clipping to a patch.
//
// One canvas_item pass, GL Compatibility / OpenGL ES 3.0 safe: no compute, no
// RenderingDevice, no screen reads, no dependent texture fetches, no derivatives.
//
//   * a crisp, genuinely black event horizon
//   * an accretion disc with Keplerian differential rotation, so inner material
//     visibly laps the outer, with spiral banding and one domain-warped noise
//     pair instead of a stack of octaves
//   * relativistic Doppler beaming: the limb turning toward the viewer reads
//     bright and pale, the receding limb dim and red. That asymmetry is the
//     whole difference between a black hole and a donut
//   * a thin photon ring hugging the shadow, beamed the same way
//   * gravitational lensing: the far half of the disc lifted into an arch over
//     the top of the shadow. The lens is an inverse map -- the projected
//     flattening opens toward 1.0 near the hole -- so it costs one smoothstep
//     and one divide per pixel instead of a ray march, which is the part a
//     phone can actually afford.
//
// Every animated term is scaled by motion_amount, so reduced motion is real and
// distinct. event_amount defaults to 0.0: with nothing wired up this renders the
// calm ordinary state, and the timed black-hole event drives one bounded envelope.

// --- Existing contract. Names and meanings unchanged. ---
uniform vec2 rect_size = vec2(240.0, 240.0);
uniform float world_clock = 0.0;
uniform float motion_amount = 1.0;
uniform float reservoir = 0.0;
uniform float release_amount = 0.0;
uniform float singularity_amount = 1.0;
uniform vec3 world_rim : source_color = vec3(0.59, 0.87, 1.0);

// --- Added. Every default reproduces the calm look with nothing wired up. ---
// The gameplay black hole drives event_amount 0 -> 1, and may swing event_tint
// from peach to the escape mint. Nothing else needs to be set, ever.
uniform float event_amount : hint_range(0.0, 1.0) = 0.0;
uniform vec3 event_tint : source_color = vec3(1.000, 0.729, 0.522);
uniform vec3 halo_tint : source_color = vec3(0.533, 0.396, 0.855);
uniform float disk_tilt : hint_range(-1.6, 1.6) = -0.29;
uniform float disk_flatten : hint_range(0.10, 0.90) = 0.33;
uniform float spin_rate : hint_range(0.0, 4.0) = 0.62;
uniform float beam_strength : hint_range(0.0, 1.0) = 1.0;
uniform float lens_amount : hint_range(0.0, 1.0) = 1.0;
uniform float disk_gain : hint_range(0.0, 3.0) = 1.0;
uniform float photon_gain : hint_range(0.0, 3.0) = 1.0;

float hash12(vec2 p) {
	vec3 k = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
	k += dot(k, k.yzx + 19.19);
	return fract((k.x + k.y) * k.z);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash12(i);
	float b = hash12(i + vec2(1.0, 0.0));
	float c = hash12(i + vec2(0.0, 1.0));
	float d = hash12(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
	// One shader unit is 1/240 of the rect's width, so the silhouette keeps its
	// proportions whether rect_size stays at its default or is set to real pixels.
	float unit = max(rect_size.x, 1.0) / 240.0;
	vec2 p = (UV - 0.5) * rect_size;
	float radius = length(p);

	float event = clamp(event_amount, 0.0, 1.0);
	float charge = clamp(reservoir, 0.0, 1.0);
	float motion = clamp(motion_amount, 0.0, 1.0);
	float time = world_clock * motion;

	// The event horizon. Its edge is the crispest thing in the frame.
	float horizon = (30.0 + charge * 2.5) * unit;
	float aa = 0.75 * unit;
	float hole = 1.0 - smoothstep(horizon - aa, horizon + aa, radius);

	vec3 emit = vec3(0.0);

	// Everything this object draws lives inside that footprint, so the rect
	// corners cost one compare instead of a disc evaluation. No early return:
	// Godot inlines fragment() into main(), and returning would skip the write.
	if (radius < 119.0 * unit) {
		float ct = cos(disk_tilt);
		float st = sin(disk_tilt);
		mat2 rot = mat2(vec2(ct, st), vec2(-st, ct));
		vec2 q = rot * p;

		// --- Gravitational lensing, as an inverse map ---
		// Near the hole, the far half of the disc is bent up over the shadow, so
		// its image loses the projected flattening and opens toward a circle.
		// Read backwards: divide the far half's vertical coordinate by a
		// flattening that relaxes to 1.0 as we approach the horizon. The far rim,
		// a thin sliver hidden behind the shadow in flat projection, becomes a
		// tall arch that rejoins the band at the left and right extremes.
		// The near half is untouched. It passes in front, and it stays flat.
		float flat_base = clamp(disk_flatten, 0.10, 0.90);
		float lens_open = 1.0 - smoothstep(horizon * 0.85, horizon * 3.45, radius);
		float far_half = 1.0 - smoothstep(-4.0 * unit, 4.0 * unit, q.y);
		float lift = lens_open * far_half * clamp(lens_amount, 0.0, 1.0);
		float flat_eff = mix(flat_base, 0.99, lift);
		vec2 d = vec2(q.x, q.y / flat_eff);
		float r_disc = length(d);
		// atan(0.0, 0.0) is undefined. Nudge x only when d is exactly degenerate.
		float degen = step(abs(d.x) + abs(d.y), 0.0001);
		float phi = atan(d.y, d.x + degen);

		// --- Keplerian shear ---
		// Angular rate falls as r^-1.5, so the inner disc laps the outer while
		// you watch. inversesqrt keeps that to two cheap instructions.
		float r_in = horizon * 1.22;
		float r_out = horizon * 3.20;
		float rn = clamp(r_disc / max(r_in, 0.001), 0.55, 6.0);
		float inv_rn = 1.0 / rn;
		float omega = inv_rn * sqrt(inv_rn);
		float orbit = time * spin_rate * (1.0 + event * 0.85) * omega;
		float swirl = phi + orbit;

		// Azimuthal harmonics use integer multiples of phi, so the pattern stays
		// single valued across the atan seam at +/- pi.
		float h1 = sin(swirl * 3.0 + rn * 6.1);
		float h2 = sin(swirl * 2.0 - rn * 13.4 + 1.7);
		float h3 = sin(swirl * 5.0 + rn * 24.0);
		float band = 0.58 + 0.20 * h1 + 0.11 * h2 + 0.06 * h3;

		// --- Turbulence: one domain-warped pair, gated to the disc annulus ---
		// Sampling in a frame rotated by the local orbital angle makes the noise
		// shear with the differential rotation and leaves no azimuthal seam.
		float in_disc = step(r_in * 0.88, r_disc) * step(r_disc, r_out * 1.04);
		float turb = 0.5;
		if (in_disc > 0.5) {
			float ca = cos(orbit);
			float sa = sin(orbit);
			vec2 dt = mat2(vec2(ca, sa), vec2(-sa, ca)) * (d / max(unit, 0.001));
			float n1 = vnoise(dt * 0.052 + 11.3);
			float n2 = vnoise(dt * 0.128 + n1 * 1.9 - 4.7);
			turb = n1 * 0.60 + n2 * 0.40;
		}
		band = max(band * (0.42 + 1.10 * turb), 0.0);

		// --- Radial profile, plus the hot inner lip at the last stable orbit ---
		float edge_in = smoothstep(r_in, r_in * 1.13, r_disc);
		float edge_out = 1.0 - smoothstep(r_out * 0.74, r_out, r_disc);
		float peak = (r_disc - r_in * 1.38) / (r_in * 1.10);
		float profile = edge_in * edge_out * exp(-peak * peak);
		float lipx = (r_disc - r_in * 1.05) / (r_in * 0.055);
		float lip = exp(-lipx * lipx) * (0.72 + 0.28 * (0.5 + 0.5 * h2));
		float body = profile * band + lip * 0.52;

		// --- Relativistic beaming ---
		// Orbital speed falls as r^-0.5, and the line-of-sight component is the
		// cosine of the azimuth measured from the disc's major axis. Intensity
		// goes as the cube of the Doppler factor, clamped so it stays bounded.
		float beta = clamp(0.56 * inversesqrt(max(rn, 0.30)), 0.0, 0.78)
			* clamp(beam_strength, 0.0, 1.0);
		float los = d.x / max(r_disc, 0.001);
		float dopp = 1.0 / max(1.0 - beta * los, 0.22);
		float boost = clamp(dopp * dopp * dopp, 0.06, 7.0);

		// --- Colour: the world palette when calm, the tuned black-hole palette
		// on the event, so the mode is a transformation and not just a gain. ---
		float heat = 1.0 - smoothstep(1.0, 2.9, rn);
		vec3 cool_col = mix(mix(world_rim, vec3(0.72, 0.88, 1.00), 0.40),
			vec3(1.000, 0.945, 0.820), event * 0.80);
		vec3 warm_col = mix(vec3(0.88, 0.25, 0.08), event_tint, event * 0.80);
		warm_col = mix(warm_col, vec3(1.00, 0.58, 0.22),
			clamp(heat * 0.55 + charge * 0.20, 0.0, 1.0) * 0.5);
		vec3 disc_col = mix(warm_col, cool_col, smoothstep(0.84, 1.80, dopp) * 0.94);
		disc_col = mix(disc_col, cool_col, heat * 0.32);
		// A violet cast across part of the banding, as the tuned original has.
		disc_col = mix(disc_col, halo_tint, max(h3, 0.0) * 0.18 * (0.40 + event * 0.60));

		// The near half traverses the dark silhouette; the far half is occulted
		// by it. The lensed arch already sits outside the shadow, so this costs
		// it nothing and guards against any sample leaking inside the horizon.
		float near_half = smoothstep(-3.0 * unit, 3.0 * unit, q.y);
		float occ = mix(1.0 - hole, 1.0, near_half);
		// A lens magnifies as well as bends. The arch is brighter than the flat
		// band it is an image of, and that is what sells it as light rather than
		// paint, so lift carries through to the emission and not just the shape.
		float disc_e = body * boost * (1.0 + lift * 0.90)
			* (0.60 + event * 0.55) * clamp(disk_gain, 0.0, 3.0);
		emit += disc_col * (disc_e * occ);

		// --- Photon ring, and the secondary image outside it ---
		float inv_radius = 1.0 / max(radius, 0.001);
		float cs = q.x * inv_radius;
		float sn = q.y * inv_radius;
		float ring_dopp = 1.0 / max(1.0 - 0.52 * clamp(beam_strength, 0.0, 1.0) * cs, 0.30);
		float ring_beam = clamp(ring_dopp * ring_dopp, 0.20, 5.0);
		float pr = (radius - horizon * 1.038) / (horizon * 0.048);
		float pr_soft = (radius - horizon * 1.085) / (horizon * 0.135);
		float photon = exp(-pr * pr) * 1.55 + exp(-pr_soft * pr_soft) * 0.30;
		vec3 photon_col = mix(cool_col, vec3(1.00, 0.98, 0.93), 0.50);
		emit += photon_col * (photon * ring_beam * (0.55 + event * 0.85)
			* clamp(photon_gain, 0.0, 3.0) * (1.0 - hole));

		// A higher-order image: a thinner ring that closes under the shadow where
		// the direct band cannot reach. Its structure comes from screen-angle
		// harmonics built with two products, cheaper than a second atan.
		float c2 = cs * cs - sn * sn;
		float s2 = 2.0 * cs * sn;
		float c4 = c2 * c2 - s2 * s2;
		float s4 = 2.0 * s2 * c2;
		float wt = time * spin_rate * 1.85;
		float arc_struct = 0.60 + 0.26 * (s4 * cos(wt) - c4 * sin(wt)) + 0.14 * s2;
		float sr = (radius - horizon * 1.30) / (horizon * 0.13);
		float arc = exp(-sr * sr) * mix(0.22, 1.0, sn * sn) * arc_struct;
		emit += mix(disc_col, cool_col, 0.45) * (arc * ring_beam
			* (0.34 + event * 0.52) * (1.0 - hole));

		// --- Violet lensing haze outside the disc, kept quiet in the calm state ---
		float halo_x = (radius - horizon * 1.10) / (horizon * 0.62);
		float halo = exp(-halo_x * halo_x) * (1.0 - hole);
		vec3 haze = mix(mix(cool_col, halo_tint, 0.55), halo_tint, event * 0.35);
		emit += haze * (halo * (0.052 + charge * 0.028 + event * 0.155));

		// --- An earned release opens two narrow polar jets along the disc's
		// normal. A sustained envelope, not a screen-wide gain pulse. ---
		float jet_len = abs(q.y);
		float jet_width = 2.6 * unit + jet_len * 0.058;
		float jx = q.x / max(jet_width, 0.001);
		float jet = exp(-jx * jx);
		jet *= smoothstep(33.0 * unit, 48.0 * unit, jet_len);
		jet *= 1.0 - smoothstep(88.0 * unit, 116.0 * unit, jet_len);
		jet *= 0.72 + 0.28 * sin(jet_len / max(unit, 0.001) * 0.30 - time * 4.2);
		jet *= clamp(release_amount, 0.0, 1.0) * mix(1.0, 0.72, near_half);
		emit += mix(cool_col, vec3(0.92, 0.96, 1.00), 0.45) * (jet * (0.95 + event * 0.55));
	}

	// The same photographic shoulder the sky uses: highlights roll off instead
	// of clipping. Then rebuild straight alpha, so emission composites additively
	// over the nebula while the horizon stays fully opaque and fully black.
	vec3 tone = vec3(1.0) - exp(-max(emit, vec3(0.0)) * 1.35);
	float glow = clamp(max(max(tone.r, tone.g), tone.b), 0.0, 1.0);
	float cover = clamp(max(hole, glow), 0.0, 1.0);
	vec3 color = clamp(tone / max(cover, 0.0015), 0.0, 1.0);
	// The horizon is not a light. It is the one object in this game that takes.
	// A trace of blue seats it in the sky instead of reading as a punched hole.
	color = max(color, vec3(0.004, 0.006, 0.018) * hole);
	// A whisper of dither; eight-bit gradients band badly on a phone panel.
	color = clamp(color + (hash12(FRAGCOORD.xy) - 0.5) * 0.0035 * step(0.004, cover),
		vec3(0.0), vec3(1.0));
	COLOR = vec4(color, cover * clamp(singularity_amount, 0.0, 1.0));
}
