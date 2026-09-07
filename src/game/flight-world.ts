/** Cosmo's visual flight volume. All clocks and positions come from the game.
 * This module owns no input, audio, gameplay state, canvas, or animation loop.
 * Positive depth is away from the viewer; depth zero is the original arena.
 */
export type FlightVec2 = readonly [number, number];
export type FlightColor = readonly [number, number, number];
export interface FlightFrame {
  enabled: boolean;
  width: number;
  height: number;
  dpr: number;
  /** Final CSS positions, including the host's world/camera translation. */
  center: FlightVec2;
  outerCenter: FlightVec2;
  radii: FlightVec2;
  comet: FlightVec2;
  angle: number;
  direction: number;
  visualTime: number;
  /** Monotonic distance in reference-portrait units, approximately 100/second. */
  travel: number;
  active: boolean;
  reducedMotion: boolean;
  palette: { tint: FlightColor; rim: FlightColor; dust: FlightColor };
  cometColor?: FlightColor;
  /** Optional projected planet disc. Deep fibers pass behind its visible body. */
  planet?: { center: FlightVec2; radius: number };
  effects?: { turn?: number; hop?: number; radial?: number; magnet?: number;
    scorch?: number; release?: number; blackHole?: number };
}
export interface FlightWorld {
  render(frame: FlightFrame): boolean;
  resize(width: number, height: number, dpr: number): void;
  reset(): void;
  dispose(): void;
}

const TAU = Math.PI * 2;
const STRIDE = 11;
const MAX_VERTICES = 12500;
const TRAIL_COUNT = 112;
const DUST_COUNT = 106;
const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, x));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);
};
const fract = (x: number): number => x - Math.floor(x);
const seed = (x: number): number => fract(Math.sin(x * 127.1 + 311.7) * 43758.5453);

const VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec4 aColor;
attribute vec2 aUv;
attribute vec2 aStyle;
uniform highp vec2 uSize,uCenter;
uniform float uFocal;
varying vec4 vColor;
varying vec2 vUv,vStyle;
void main(){
  float w=max(0.20,1.0+aPosition.z/uFocal);
  vec2 pixel=uCenter+aPosition.xy/w;
  vec2 clip=vec2(pixel.x/uSize.x*2.0-1.0,1.0-pixel.y/uSize.y*2.0);
  // Keep perspective-correct interpolation, even on a canvas without a depth buffer.
  gl_Position=vec4(clip*w,0.0,w);
  vColor=aColor;vUv=aUv;vStyle=aStyle;
}`;
const FRAGMENT = `
precision mediump float;
varying vec4 vColor;
varying vec2 vUv,vStyle;
uniform vec2 uOuterCenter,uRadii,uBufferSize;
uniform highp vec2 uSize;
uniform vec3 uPlanet;
void main(){
  vec2 pixel=vec2(gl_FragCoord.x/uBufferSize.x,1.0-gl_FragCoord.y/uBufferSize.y)*uSize;
  float edge=1.0-smoothstep(0.66,1.0,abs(vUv.x));
  float profile=exp(-vUv.x*vUv.x*4.6)*edge;
  if(vStyle.x>0.5&&vStyle.x<1.5){
    profile*=1.0-smoothstep(0.38,1.0,abs(vUv.y));
  }else{
    // Fine material striation, carried down the ribbon rather than flashing.
    float grain=0.86+0.14*sin(vUv.y*17.0+vUv.x*6.0);
    profile*=grain;
  }
  float radius=length((pixel-uOuterCenter)/uRadii);
  float arena=smoothstep(0.32,0.49,radius)*(1.0-smoothstep(0.98,1.16,radius));
  float calm=1.0-arena*vStyle.y;
  float core=smoothstep(0.115,0.205,radius);
  float planet=1.0;
  if(uPlanet.z>0.0&&vStyle.x<1.5){
    planet=smoothstep(uPlanet.z*0.985,uPlanet.z*1.025,distance(pixel,uPlanet.xy));
  }
  float alpha=vColor.a*profile*calm*core*planet;
  gl_FragColor=vec4(vColor.rgb,alpha);
}`;

interface Point { x: number; y: number; z: number }
interface TrailPoint extends Point { birth: number; distance: number }
interface AttributeState {
  enabled: boolean; buffer: WebGLBuffer | null; size: number; type: number;
  normalized: boolean; stride: number; offset: number;
}

/** Create after the host's sky program and triangle buffer are initialized.
 * The sky and this pass are the only owners of this context. Capture their fixed
 * baseline once, then restore it without synchronous GPU state queries per frame.
 * Recreate the module after context restoration or a replacement sky program.
 */
export function createFlightWorld(gl: WebGLRenderingContext): FlightWorld {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let disposed = false;
  const compile = (type: number, text: string): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Cosmo flight shader allocation failed.');
    shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Cosmo flight shader: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  };
  try {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    program = gl.createProgram(); buffer = gl.createBuffer();
    if (!program || !buffer) throw new Error('Cosmo flight geometry allocation failed.');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment);
    ['aPosition', 'aColor', 'aUv', 'aStyle'].forEach((name, index) => gl.bindAttribLocation(program!, index, name));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Cosmo flight link: ' + gl.getProgramInfoLog(program));
    }
  } catch (error) {
    shaders.forEach(shader => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    throw error;
  }
  const uniforms = Object.fromEntries(['uSize', 'uBufferSize', 'uCenter', 'uFocal', 'uOuterCenter', 'uRadii', 'uPlanet']
    .map(name => [name, gl.getUniformLocation(program!, name)]));
  const data = new Float32Array(MAX_VERTICES * STRIDE);
  const trail: TrailPoint[] = [];
  let cursor = 0, lastTime = -1, lastTravel = 0, sampleTime = -1;
  let width = 0, height = 0, previousReduced = false;
  let decorativeTravel = 0;

  function reset(): void {
    trail.length = 0; lastTime = -1; lastTravel = 0; sampleTime = -1;
    decorativeTravel = 0;
  }
  function resize(nextWidth: number, nextHeight: number, _dpr: number): void {
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth; height = nextHeight; trail.length = 0; sampleTime = -1;
  }
  function vertex(p: Point, dx: number, dy: number, color: FlightColor, alpha: number,
    u: number, v: number, style: number, calm: number): void {
    data[cursor++] = p.x + dx; data[cursor++] = p.y + dy; data[cursor++] = p.z;
    data[cursor++] = color[0]; data[cursor++] = color[1]; data[cursor++] = color[2];
    data[cursor++] = alpha; data[cursor++] = u; data[cursor++] = v;
    data[cursor++] = style; data[cursor++] = calm;
  }
  function ribbon(a: Point, b: Point, wa: number, wb: number, color: FlightColor,
    aa: number, ab: number, phaseA: number, phaseB: number, style = 0, calm = 0.72): void {
    if (cursor + STRIDE * 6 > data.length || Math.max(aa, ab) < 0.0002) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const sx = -dy / length, sy = dx / length;
    vertex(a, sx * wa, sy * wa, color, aa, -1, phaseA, style, calm);
    vertex(a, -sx * wa, -sy * wa, color, aa, 1, phaseA, style, calm);
    vertex(b, sx * wb, sy * wb, color, ab, -1, phaseB, style, calm);
    vertex(b, sx * wb, sy * wb, color, ab, -1, phaseB, style, calm);
    vertex(a, -sx * wa, -sy * wa, color, aa, 1, phaseA, style, calm);
    vertex(b, -sx * wb, -sy * wb, color, ab, 1, phaseB, style, calm);
  }
  function mix(a: FlightColor, b: FlightColor, t: number): FlightColor {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function build(frame: FlightFrame): void {
    cursor = 0;
    const scale = frame.width / 540, focal = 900 * scale;
    const rx = frame.radii[0], ry = frame.radii[1];
    const offsetX = frame.outerCenter[0] - frame.center[0];
    const offsetY = frame.outerCenter[1] - frame.center[1];
    const distance = decorativeTravel * scale;
    const release = clamp(frame.effects?.release ?? 0);
    const hole = clamp(frame.effects?.blackHole ?? 0);
    const turn = clamp(frame.effects?.turn ?? 0);
    const hop = clamp(frame.effects?.hop ?? 0);
    const time = frame.reducedMotion ? 0 : frame.visualTime;

    // The distant route bends, but the bend is exactly zero at the reference plane.
    const route = (angle: number, depth: number, radius: number): Point => {
      const d = depth / focal;
      return {
        x: offsetX + Math.cos(angle) * rx * radius + Math.sin(d * 1.15 + distance / focal * 0.12) * 29 * scale * d,
        y: offsetY + Math.sin(angle) * ry * radius - Math.sin(d * 0.75) * 36 * scale * d,
        z: depth,
      };
    };
    const strandColors = [mix(frame.palette.tint, frame.palette.rim, 0.60),
      mix(frame.palette.dust, frame.palette.rim, 0.40), mix(frame.palette.tint, frame.palette.rim, 0.35)];
    const angleAt = (depth: number, base: number, strand: number): number => base
      + depth / focal * (1.18 + hole * 0.16) + distance / focal * 0.17
      + Math.sin(depth / focal * 1.45 + strand * 1.9) * 0.11;
    const fadeAt = (depth: number): number => smooth(100 * scale, 360 * scale, depth)
      * (1 - smooth(2500 * scale, 3400 * scale, depth));
    // Broad translucent material and fine nested strands share one curved volume.
    // Far-to-near construction is deliberate: this shared sky has no depth buffer.
    for (let segment = 63; segment >= 0; segment--) {
      const depthA = (100 + segment * 51) * scale;
      const depthB = depthA + 51 * scale;
      for (let strand = 0; strand < 7; strand++) {
        const base = strand * TAU / 7 + 0.24;
        const aa = angleAt(depthA, base, strand), ba = angleAt(depthB, base, strand);
        const radial = 1.11 + Math.sin(strand * 2.1) * 0.10;
        const a = route(aa, depthA, radial), b = route(ba, depthB, radial);
        const flowA = depthA / focal * 2.9 - distance / focal * 0.76 + strand * 1.7;
        const flowB = depthB / focal * 2.9 - distance / focal * 0.76 + strand * 1.7;
        const densityA = 0.66 + 0.34 * Math.sin(flowA * 1.1) ** 2;
        const densityB = 0.66 + 0.34 * Math.sin(flowB * 1.1) ** 2;
        const color = strandColors[strand % strandColors.length];
        const wide = (12 + Math.sin(strand * 1.7) * 4) * scale;
        ribbon(a, b, wide, wide, color, 0.12 * fadeAt(depthA) * densityA,
          0.12 * fadeAt(depthB) * densityB, flowA, flowB);
        ribbon(a, b, 2.9 * scale, 2.9 * scale, color, 0.21 * fadeAt(depthA) * densityA,
          0.21 * fadeAt(depthB) * densityB, flowA, flowB);
      }
    }

    // Long depth streaks become shorter near the plane, where threats need contrast.
    if (!frame.reducedMotion) {
      const dustHue = mix(frame.palette.rim, [0.64, 0.84, 0.93], 0.40);
      for (let i = 0; i < DUST_COUNT; i++) {
        const raw = fract(seed(i + 8) - decorativeTravel * (0.00042 + seed(i + 42) * 0.00012));
        const depth = (-95 + raw * 3550) * scale;
        const angle = seed(i + 191) * TAU;
        const radial = 1.26 + seed(i + 612) * 1.3;
        const a = route(angle, depth, radial);
        const b = route(angle, depth + (17 + seed(i + 38) * 42) * scale, radial);
        // A small world-space tangent prevents a radial segment collapsing in XY.
        b.x += Math.cos(angle + Math.PI / 2) * 1.3 * scale;
        b.y += Math.sin(angle + Math.PI / 2) * 1.3 * scale;
        const fade = smooth(-95 * scale, 140 * scale, depth) * (1 - smooth(2650 * scale, 3450 * scale, depth));
        const bright = seed(i + 333) > 0.89 ? 0.61 : 0.23;
        const width = (0.7 + seed(i + 200) * 1.0) * scale;
        ribbon(a, b, width, width * 0.65, dustHue, fade * bright, fade * bright * 0.25, -1, 1, 1, 0.87);
      }
    }

    if (frame.reducedMotion || !frame.active || trail.length < 2) return;
    const cyan = frame.cometColor ?? [0.20, 0.86, 1.0];
    const hue = mix(cyan, frame.palette.rim, 0.16);
    const toPoint = (p: TrailPoint): Point => {
      const age = frame.visualTime - p.birth;
      const wake = Math.min(focal * 0.55, Math.max(0, decorativeTravel - p.distance) * scale);
      // Existing material follows an eased gesture disturbance, never a light pulse.
      const ripple = Math.sin(age * 2.1 + p.birth * 0.65) * scale * (turn * 2.0 + hop * 1.7);
      return { x: p.x + ripple, y: p.y + ripple * 0.35, z: -wake };
    };
    for (let i = trail.length - 2; i >= 0; i--) {
      const newer = trail[i], older = trail[i + 1];
      const a = i === 0 ? { x: frame.comet[0] - frame.center[0], y: frame.comet[1] - frame.center[1], z: 0 } : toPoint(newer);
      const b = toPoint(older);
      const lifeA = clamp(1 - (frame.visualTime - newer.birth) / 3.3);
      const lifeB = clamp(1 - (frame.visualTime - older.birth) / 3.3);
      const phaseA = newer.birth * 0.43 - time * 0.31;
      const phaseB = older.birth * 0.43 - time * 0.31;
      const widening = 1 + release * 0.24;
      ribbon(a, b, 6.8 * scale * lifeA * widening, 6.8 * scale * lifeB * widening, hue,
        0.16 * lifeA ** 2, 0.16 * lifeB ** 2, phaseA, phaseB, 2, 0.30);
      ribbon(a, b, 1.4 * scale * lifeA, 1.4 * scale * lifeB, mix(hue, [0.84, 0.98, 1], 0.36),
        0.28 * lifeA ** 3, 0.28 * lifeB ** 3, phaseA, phaseB, 2, 0.25);
    }
  }

  function captureAttributes(): AttributeState[] {
    return [0, 1, 2, 3].map(index => ({
      enabled: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
      buffer: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
      size: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_SIZE),
      type: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_TYPE),
      normalized: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
      stride: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
      offset: gl.getVertexAttribOffset(index, gl.VERTEX_ATTRIB_ARRAY_POINTER),
    }));
  }

  const oldProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
  const oldBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
  const oldBlend = gl.isEnabled(gl.BLEND), oldDepth = gl.isEnabled(gl.DEPTH_TEST), oldCull = gl.isEnabled(gl.CULL_FACE);
  const srcRGB = gl.getParameter(gl.BLEND_SRC_RGB), dstRGB = gl.getParameter(gl.BLEND_DST_RGB);
  const srcA = gl.getParameter(gl.BLEND_SRC_ALPHA), dstA = gl.getParameter(gl.BLEND_DST_ALPHA);
  const eqRGB = gl.getParameter(gl.BLEND_EQUATION_RGB), eqA = gl.getParameter(gl.BLEND_EQUATION_ALPHA);
  const attributes = captureAttributes();

  function render(frame: FlightFrame): boolean {
    if (disposed || gl.isContextLost()) return false;
    if (!frame.enabled) return true;
    if (!(frame.width > 0 && frame.height > 0 && frame.radii[0] > 0 && frame.radii[1] > 0)
      || !Number.isFinite(frame.visualTime) || !Number.isFinite(frame.travel)) return false;
    resize(frame.width, frame.height, frame.dpr);
    if (frame.visualTime < lastTime || frame.travel < lastTravel - 0.001) reset();
    const dt = lastTime < 0 ? 0 : Math.max(0, frame.visualTime - lastTime);
    if (frame.reducedMotion !== previousReduced) { trail.length = 0; sampleTime = -1; }
    previousReduced = frame.reducedMotion;
    if (!frame.reducedMotion && dt > 0) decorativeTravel += Math.max(0, frame.travel - lastTravel);
    lastTime = frame.visualTime; lastTravel = frame.travel;
    if (!frame.active) { trail.length = 0; sampleTime = -1; }
    if (frame.active && !frame.reducedMotion && (sampleTime < 0 || frame.visualTime - sampleTime >= 1 / 36)) {
      const x = frame.comet[0] - frame.center[0], y = frame.comet[1] - frame.center[1];
      if (trail.length && Math.hypot(x - trail[0].x, y - trail[0].y) > frame.radii[0] * 0.82) trail.length = 0;
      trail.unshift({ x, y, z: 0, birth: frame.visualTime, distance: decorativeTravel });
      sampleTime = frame.visualTime;
    }
    while (trail.length > TRAIL_COUNT || (trail.length && frame.visualTime - trail[trail.length - 1].birth > 3.3)) trail.pop();
    build(frame);
    if (!cursor) return true;
    // A second renderer on this context must not strand the sky's triangle pointer.
    try {
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, cursor), gl.DYNAMIC_DRAW);
      const sizes = [3, 4, 2, 2], offsets = [0, 3, 7, 9];
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, STRIDE * 4, offsets[i] * 4);
      }
      gl.uniform2f(uniforms.uSize, frame.width, frame.height);
      gl.uniform2f(uniforms.uBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uniforms.uCenter, frame.center[0], frame.center[1]);
      gl.uniform2f(uniforms.uOuterCenter, frame.outerCenter[0], frame.outerCenter[1]);
      gl.uniform2f(uniforms.uRadii, frame.radii[0], frame.radii[1]);
      gl.uniform1f(uniforms.uFocal, 900 * frame.width / 540);
      gl.uniform3f(uniforms.uPlanet, frame.planet?.center[0] ?? 0, frame.planet?.center[1] ?? 0, frame.planet?.radius ?? 0);
      gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, cursor / STRIDE);
    } finally {
      attributes.forEach((attribute, index) => {
        if (attribute.buffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer);
          gl.vertexAttribPointer(index, attribute.size, attribute.type, attribute.normalized, attribute.stride, attribute.offset);
        }
        if (attribute.enabled) gl.enableVertexAttribArray(index); else gl.disableVertexAttribArray(index);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, oldBuffer); gl.useProgram(oldProgram);
      gl.blendFuncSeparate(srcRGB, dstRGB, srcA, dstA); gl.blendEquationSeparate(eqRGB, eqA);
      if (!oldBlend) gl.disable(gl.BLEND);
      if (oldDepth) gl.enable(gl.DEPTH_TEST);
      if (oldCull) gl.enable(gl.CULL_FACE);
    }
    return true;
  }
  return {
    render, resize, reset,
    dispose(): void {
      if (disposed) return;
      disposed = true; trail.length = 0;
      shaders.forEach(shader => gl.deleteShader(shader));
      gl.deleteProgram(program); gl.deleteBuffer(buffer);
    },
  };
}
