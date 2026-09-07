shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

// Cosmo :: entity surface. Original work for this product. No third-party
// shader source, snippet, asset or audio.
//
// Every solid gameplay body in the arena is drawn with this one material: the
// comet and its ice core, the gold stars, the red threats, the violet powers,
// the arrival contours, the shield and magnet fields and the orbit rails. It is
// drawn many times per frame, so the whole thing is a short run of arithmetic
// over one body-space field: no loops, no textures, no noise, no derivatives,
// no screen reads. GL Compatibility / OpenGL ES 3.0 safe.
//
// THE COMET IS THE OBJECT THE PLAYER CONTROLS AND IT HAS TO WIN THE FRAME.
// A flat-shaded diamond twenty pixels across cannot win anything: eight facets
// of constant shade are a shape, not a light, and against a teal planet and the
// cyan rail it rides they read as one more piece of the background. So the
// surface is built from a smooth field over the PROJECTED body instead —
//
//   * a furnace core carried forward of centre, whitened at its heart,
//   * a body that deepens away from that core, so the silhouette has a
//     boundary instead of a wash and stays readable over a bright planet limb,
//   * a rim that rides just inside the edge and doubles down the wake, which is
//     where the original swept the comet's fins,
//   * a bow on the leading edge, so the thing looks like it is travelling.
//
// Proportions follow the tuned original (src/game/runtime.js SPR.comet,
// SPR.cometHot, drawCometFins): nested layers from a deep saturated outside to
// a near-white heart, the hot core carried about a sixth of the body forward,
// and the flanks brightening backwards into the ion ribbon. The original's own
// warning is respected — the head is layered, not stacked additively, because a
// head that saturates to a white smear stops reading as a cyan point.
//
// THE COLOUR VOCABULARY IS NOT RENEGOTIATED HERE. Cyan comet, gold stars, red
// threats, violet powers. Every term below is a scale on the pigment the call
// site chose; the only hue movement is a whitening toward the furnace, which is
// what heat looks like, and it is bounded so a red threat stays red.
//
// NO CLOCK. Godot's TIME keeps running while the game is paused, ignores the
// dilation powers and drifts on mobile — the same three reasons every other
// shader here takes a supplied visual clock instead. This one needs none: the
// original is explicit that the comet's heat never flickers, heat is expressed
// by the moving wake. The only motion here is the heading, which is the
// simulation's own transform, so a reduced-motion setting that stills the world
// stills this with it, and a paused frame is genuinely still.

// Fixed material light preserves shape on SDR Compatibility renderers.
// Vertex/instance color identifies gameplay meaning, never audio amplitude.
uniform vec4 base_color : source_color = vec4(1.0);
uniform float self_light : hint_range(0.0, 1.0) = 0.28;

// Optional taste controls. Every one of them is already correct at its default,
// so the shader stands alone until an integrator chooses to drive it.
// body_gain scales the whole treatment, heading_gain the forward/wake
// asymmetry, and solid_body says whether this material is a filled body (1.0)
// or a thin drawn contour (0.0) that should keep the flat brightness it teaches
// with and take the rim alone.
uniform float body_gain : hint_range(0.0, 2.0) = 1.0;
uniform float heading_gain : hint_range(0.0, 2.0) = 1.0;
uniform float solid_body : hint_range(0.0, 1.0) = 1.0;

// The projected body frame, built once per vertex and interpolated: the offset
// from this body's own origin across the screen, that body's own reach, its
// local +Y on screen (the comet's heading) and whether it is a compact body at
// all. Six floats, no matrices carried into the fragment stage.
varying vec2 v_offset;
varying float v_extent;
varying vec2 v_head;
varying float v_compact;

void vertex() {
	// MODEL_MATRIX already carries the MultiMesh instance transform, so one
	// product serves the pooled stars, threats and powers and the single-mesh
	// comet identically.
	mat4 model_view = VIEW_MATRIX * MODEL_MATRIX;
	vec3 offset = mat3(model_view) * VERTEX;
	v_offset = offset.xy;
	float reach = length(v_offset);
	// A body's own scale, so a vertex that happens to project near the centre
	// (the comet's near shoulder, a star's front apex) cannot masquerade as a
	// silhouette and stamp a hole through the middle of the thing.
	float scale = 0.5 * (length(model_view[0].xy) + length(model_view[1].xy));
	// Never zero: a pool slot can legitimately be scaled to nothing.
	v_extent = max(max(reach, scale * 0.5), 0.0001);
	// Local +Y is the direction of travel for the comet, its ice core, the
	// mirror and the current arrows — the arena's authored heading axis.
	// Pointing it straight at the camera is legal and must not make a NaN.
	vec2 heading = model_view[1].xy;
	float heading_reach = length(heading);
	v_head = heading_reach > 0.00001 ? heading / heading_reach : vec2(0.0, 1.0);
	// Compact gameplay bodies subtend at most about seven percent of the half
	// screen; the orbit rails and the nova front are twenty percent and up.
	// Above the gate this shader collapses to exactly the surface those
	// structural rings have today, which is the calmer ordinary state they are
	// there to hold.
	float depth = max(0.35, -model_view[3].z);
	v_compact = 1.0 - smoothstep(0.10, 0.17, reach * PROJECTION_MATRIX[1][1] / depth);
}

void fragment() {
	vec3 pigment = COLOR.rgb * base_color.rgb;
	float lamp = clamp(self_light, 0.0, 1.5);
	float body = clamp(v_compact, 0.0, 1.0) * clamp(body_gain, 0.0, 2.0);
	// A thin drawn contour takes the rim and nothing else: no core, no furnace,
	// no heading, no deepening. Solid bodies take all of it.
	float shell = clamp(solid_body, 0.0, 1.0);
	float filled = body * shell;

	// The body frame: 0 at the projected centre, 1 at the silhouette, with the
	// heading as a signed coordinate across it. v_extent is interpolated from
	// per-vertex reaches, so this is scale free — the same numbers describe a
	// nine unit star and a fourteen unit threat.
	vec2 place = v_offset / v_extent;
	float radius = min(length(place), 1.0);
	vec2 head = v_head * clamp(heading_gain, 0.0, 2.0);
	float lead = dot(place, head);

	// One offset gaussian does the work of the original's nested teardrop: the
	// furnace sits forward of centre, the body deepens away from it, and the
	// tail falls off first so it hands cleanly to the ion ribbon behind it.
	vec2 furnace = place - head * 0.26;
	float spread = dot(furnace, furnace);
	float core = exp2(-4.2 * spread);
	float heat = exp2(-17.0 * spread);

	// The rim rides just inside the silhouette and brightens down the wake,
	// which is where the original swept its two fins back from the nose.
	float rim = smoothstep(0.52, 0.95, radius) * (1.0 - smoothstep(0.95, 1.12, radius));
	rim *= 1.0 + 0.85 * max(0.0, -lead) * shell;
	// The leading edge takes the light first. This is the heading cue that
	// survives at twenty pixels: pale in front, saturated colour behind.
	float bow = smoothstep(0.30, 0.92, lead) * smoothstep(0.45, 0.95, radius);

	// Only the heart whitens, and only a little: heat looks like that, and a
	// threat that pales all over stops reading as red. The rim and the bow take
	// the body's own colour barely lifted, so the silhouette never argues with
	// what the colour means.
	vec3 icy = mix(pigment, vec3(1.0), 0.66);
	vec3 edge = mix(pigment, vec3(1.0), 0.28);

	vec3 glow = pigment * (lamp * mix(1.0, mix(0.32, 1.00, core), filled));
	glow += pigment * (0.90 * lamp * core * filled);
	glow += icy * (0.45 * lamp * lamp * heat * filled);
	glow += edge * (lamp * (0.50 * rim * body + 0.55 * bow * filled));

	// The lit response follows the same profile at a shallower depth, so a
	// muted, unlit or shadowed frame keeps the identical silhouette.
	ALBEDO = pigment * mix(1.0, mix(0.62, 1.02, core), filled);
	// A furnace is not a metal. Releasing the fixed metallic at the heart is
	// what lets the core out; the flanks keep the tuned response.
	METALLIC = 0.24 * (1.0 - 0.72 * core * filled);
	ROUGHNESS = 0.34;
	EMISSION = glow;
}
