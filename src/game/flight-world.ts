import { VOYAGE_SHADER } from './voyage-world.ts';

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
    scorch?: number; release?: number; blackHole?: number; charge?: number; orbit?: number };
  /** A copied level card, never a timer or command owned by this renderer. */
  transition?: { elapsed: number; completed: boolean; nextLevel: number };
  /** A camera route through an authored destination; never a difficulty clock. */
  voyage?: { progress: number; chapter: number };
  nextVoyage?: { progress: number; chapter: number };
  voyageBlend?: number;
  /** Existing reward trajectories, copied in screen pixels for background currents. */
  rewardPaths?: readonly { origin: FlightVec2; control: FlightVec2; target: FlightVec2; progress: number }[];
}
export interface FlightWorld {
  render(frame: FlightFrame): boolean;
  resize(width: number, height: number, dpr: number): void;
  reset(): void;
  dispose(): void;
}
export interface FlightWorldOptions {
  earthTexture?: HTMLImageElement | HTMLCanvasElement;
}

const TAU = Math.PI * 2;
const STRIDE = 11;
const MAX_VERTICES = 12500;
const TRAIL_COUNT = 112;
const DUST_COUNT = 106;
const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, x));
const effectStrength = (x: number | undefined): number => Number.isFinite(x) ? clamp(x!) : 0;
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);
};
const fract = (x: number): number => x - Math.floor(x);
const seed = (x: number): number => fract(Math.sin(x * 127.1 + 311.7) * 43758.5453);
// Fixed material identities: no game RNG and no trigonometric hash work per frame.
const DUST = Array.from({ length: DUST_COUNT }, (_, i) => ({
  phase: seed(i + 8), rate: 0.00042 + seed(i + 42) * 0.00012,
  angle: seed(i + 191) * TAU, radial: 1.26 + seed(i + 612) * 1.3,
  bright: seed(i + 333) > 0.89 ? 0.61 : 0.23,
  width: 0.7 + seed(i + 200), exposure: 0.16 + seed(i + 38) * 0.12,
}));

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
precision highp float;
varying vec4 vColor;
varying vec2 vUv,vStyle;
uniform vec2 uOuterCenter,uRadii,uBufferSize;
uniform highp vec2 uSize;
uniform vec3 uPlanet;
uniform vec3 uVoyage;
uniform vec3 uVoyageNext;
uniform vec3 uVoyagePower,uVoyageForce,uVoyageCue;
uniform sampler2D uVoyageEarth;
uniform float uVoyageEarthReady;
${VOYAGE_SHADER}
void main(){
  vec2 pixel=vec2(gl_FragCoord.x/uBufferSize.x,1.0-gl_FragCoord.y/uBufferSize.y)*uSize;
  float radius=length((pixel-uOuterCenter)/uRadii);
  if(vStyle.x>4.5){
    vec2 materialPixel=voyageResponsePosition(pixel,uSize);
    vec4 scene=paintVoyage(materialPixel,uSize,uVoyage);
    if(uVoyageNext.z>0.0){
      vec4 next=paintVoyage(materialPixel,uSize,vec3(uVoyageNext.xy,uVoyage.z));
      float alpha=mix(scene.a,next.a,uVoyageNext.z);
      scene=vec4(mix(scene.rgb*scene.a,next.rgb*next.a,uVoyageNext.z)/max(alpha,0.0001),alpha);
    }
    vec3 color=scene.rgb;
    color=voyageResponseColor(color,pixel,uSize);
    float arena=smoothstep(0.28,0.48,radius)*(1.0-smoothstep(1.0,1.22,radius));
    color=pow(max(color,vec3(0.0)),vec3(0.86))*(1.0-arena*0.20);
    gl_FragColor=vec4(color,scene.a);return;
  }
  if(vStyle.x>3.5){
    // A passage has depth in front of the departing world. Its indigo interior
    // gently occludes that world; the center remains a dark distant aperture.
    float depth=0.88+0.12*(1.0-smoothstep(0.15,1.7,radius));
    gl_FragColor=vec4(vColor.rgb,vColor.a*depth);return;
  }
  float edge=1.0-smoothstep(0.66,1.0,abs(vUv.x));
  float profile=exp(-vUv.x*vUv.x*4.6)*edge;
  if(vStyle.x>2.5){
    // Broad curved material, with longitudinal strata rather than flashing gain.
    float strata=0.78+0.13*sin(vUv.y*8.0+vUv.x*3.0)
      +0.09*sin(vUv.y*17.0-vUv.x*6.0);
    profile=exp(-vUv.x*vUv.x*1.9)*edge*strata;
  }else if(vStyle.x>0.5&&vStyle.x<1.5){
    profile*=1.0-smoothstep(0.38,1.0,abs(vUv.y));
  }else{
    // Fine material striation, carried down the ribbon rather than flashing.
    float grain=0.86+0.14*sin(vUv.y*17.0+vUv.x*6.0);
    profile*=grain;
  }
  float arena=smoothstep(0.32,0.49,radius)*(1.0-smoothstep(0.98,1.16,radius));
  float calm=1.0-arena*vStyle.y;
  float core=smoothstep(0.115,0.205,radius);
  float planet=1.0;
  if(uPlanet.z>0.0&&uVoyage.y<0.0&&vStyle.x<1.5){
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
 * program/attribute baseline once; restore the shared texture-unit bindings
 * from each draw's entry state when using the optional Earth map.
 * Recreate the module after context restoration or a replacement sky program.
 */
export function createFlightWorld(gl: WebGLRenderingContext, options: FlightWorldOptions = {}): FlightWorld {
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
  const uniforms = Object.fromEntries(['uSize', 'uBufferSize', 'uCenter', 'uFocal', 'uOuterCenter', 'uRadii', 'uPlanet', 'uVoyage',
    'uVoyagePower', 'uVoyageForce', 'uVoyageCue', 'uVoyageNext', 'uVoyageEarth', 'uVoyageEarthReady']
    .map(name => [name, gl.getUniformLocation(program!, name)]));
  let earthTexture: WebGLTexture | null = null, earthReady = false;
  // The optional user-supplied map belongs to this renderer, not Phaser's GPU
  // cache. One complete tiny texture keeps the sampler valid without the map.
  const uploadUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
  gl.activeTexture(gl.TEXTURE3);
  const uploadBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
  const uploadFlip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const uploadPremultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  try {
    earthTexture = gl.createTexture();
    if (earthTexture) {
      gl.bindTexture(gl.TEXTURE_2D, earthTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([24, 48, 88, 255]));
      const source = options.earthTexture;
      const imageWidth = source && ('naturalWidth' in source ? source.naturalWidth : source.width);
      const imageHeight = source && ('naturalHeight' in source ? source.naturalHeight : source.height);
      if (source && imageWidth && imageHeight) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          earthReady = true;
        } catch {
          // A failed image decode/upload cannot remove the procedural world.
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([24, 48, 88, 255]));
        }
      }
    }
  } catch {
    if (earthTexture) gl.deleteTexture(earthTexture);
    earthTexture = null; earthReady = false;
  } finally {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, uploadFlip);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, uploadPremultiply);
    gl.bindTexture(gl.TEXTURE_2D, uploadBinding);
    gl.activeTexture(uploadUnit);
  }
  const data = new Float32Array(MAX_VERTICES * STRIDE);
  const trail: TrailPoint[] = [];
  let cursor = 0, lastTime = -1, lastTravel = 0, sampleTime = -1;
  let width = 0, height = 0, previousReduced = false;
  let decorativeTravel = 0;
  let passage = 0, passageTravel = 0, passageElapsed = -1, destination = 1;
  let focal = 900;
  const dustOrder = DUST.map((grain, index) => ({ grain, index, depth: 0 }));

  function reset(): void {
    trail.length = 0; lastTime = -1; lastTravel = 0; sampleTime = -1;
    decorativeTravel = 0;
    passage = 0; passageTravel = 0; passageElapsed = -1; destination = 1;
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
    // The visible tangent includes perspective. An XY-only normal twists a
    // depth streak sideways, and can collapse it when its endpoints share XY.
    const aw = Math.max(0.20, 1 + a.z / focal), bw = Math.max(0.20, 1 + b.z / focal);
    const dx = b.x / bw - a.x / aw, dy = b.y / bw - a.y / aw;
    const length = Math.hypot(dx, dy);
    if (length < 0.0001) return;
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
    const scale = frame.width / 540;
    focal = 900 * scale;
    const rx = frame.radii[0], ry = frame.radii[1];
    const offsetX = frame.outerCenter[0] - frame.center[0];
    const offsetY = frame.outerCenter[1] - frame.center[1];
    const distance = decorativeTravel * scale;
    const effect = (value: number | undefined): number => frame.active ? effectStrength(value) : 0;
    const release = effect(frame.effects?.release);
    const hole = effect(frame.effects?.blackHole);
    const ordinaryPower = hole > 0.001 ? 0 : 1;
    const charge = effect(frame.effects?.charge) * ordinaryPower;
    const scorch = effect(frame.effects?.scorch) * ordinaryPower;
    const magnet = effect(frame.effects?.magnet) * ordinaryPower;
    const turn = effect(frame.effects?.turn);
    const hop = effect(frame.effects?.hop);
    const time = frame.reducedMotion ? 0 : frame.visualTime;
    const portal = smooth(0, 1, passage);
    const ordinary = 1 - portal * 0.88;
    const voyage = frame.voyage && frame.voyage.chapter >= 0 && frame.voyage.chapter <= 12
      && Number.isFinite(frame.voyage.progress) && (frame.active || !frame.transition?.completed);
    if (voyage) {
      const corner = { x: -frame.center[0], y: -frame.center[1], z: 0 };
      const white = [1, 1, 1] as const;
      vertex(corner, 0, 0, white, 1, 0, 0, 5, 0);
      vertex(corner, frame.width, 0, white, 1, 0, 0, 5, 0);
      vertex(corner, frame.width, frame.height, white, 1, 0, 0, 5, 0);
      vertex(corner, 0, 0, white, 1, 0, 0, 5, 0);
      vertex(corner, frame.width, frame.height, white, 1, 0, 0, 5, 0);
      vertex(corner, 0, frame.height, white, 1, 0, 0, 5, 0);
    }

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
    const ordinarySegments = voyage ? 20 : portal > 0.0001 ? 32 : 64;
    const ordinaryDepthStep = 3264 / Math.max(1, ordinarySegments);
    for (let segment = ordinarySegments - 1; segment >= 0; segment--) {
      const depthA = (100 + segment * ordinaryDepthStep) * scale;
      const depthB = depthA + ordinaryDepthStep * scale;
      for (let strand = 0; strand < (voyage ? 3 : 7); strand++) {
        const base = strand * TAU / (voyage ? 3 : 7) + 0.24;
        const aa = angleAt(depthA, base, strand), ba = angleAt(depthB, base, strand);
        const radial = 1.11 + Math.sin(strand * 2.1) * 0.10;
        const a = route(aa, depthA, radial), b = route(ba, depthB, radial);
        const flowA = depthA / focal * 2.9 - distance / focal * 0.76 + strand * 1.7;
        const flowB = depthB / focal * 2.9 - distance / focal * 0.76 + strand * 1.7;
        const densityA = 0.66 + 0.34 * Math.sin(flowA * 1.1) ** 2;
        const densityB = 0.66 + 0.34 * Math.sin(flowB * 1.1) ** 2;
        const color = strandColors[strand % strandColors.length];
        const wide = (voyage ? 6 : 12 + Math.sin(strand * 1.7) * 4) * scale;
        const density = voyage ? 0.55 : 1;
        ribbon(a, b, wide, wide, color, ordinary * 0.12 * density * fadeAt(depthA) * densityA,
          ordinary * 0.12 * density * fadeAt(depthB) * densityB, flowA, flowB);
        ribbon(a, b, 2.9 * scale, 2.9 * scale, color, ordinary * 0.21 * density * fadeAt(depthA) * densityA,
          ordinary * 0.21 * density * fadeAt(depthB) * densityB, flowA, flowB);
      }
    }

    // A completed world opens one quiet passage through the surrounding space.
    // The ribs approach at a constant speed; illumination never follows a beat.
    // Their near/far fades make wrapping invisible, including on a held card.
    if (portal > 0.0001) {
      const veil = [0.006, 0.009, 0.037] as const;
      const corner = { x: -frame.center[0], y: -frame.center[1], z: 0 };
      // One bounded surface behind the flowing walls replaces a see-through
      // wire cage over the old planet. It never touches the gameplay canvas.
      vertex(corner, 0, 0, veil, portal * 0.95, 0, 0, 4, 0);
      vertex(corner, frame.width, 0, veil, portal * 0.95, 0, 0, 4, 0);
      vertex(corner, frame.width, frame.height, veil, portal * 0.95, 0, 0, 4, 0);
      vertex(corner, 0, 0, veil, portal * 0.95, 0, 0, 4, 0);
      vertex(corner, frame.width, frame.height, veil, portal * 0.95, 0, 0, 4, 0);
      vertex(corner, 0, frame.height, veil, portal * 0.95, 0, 0, 4, 0);
      const far = focal * 3.7, near = -focal * 0.32, span = far - near;
      const drift = frame.reducedMotion ? 0 : passageTravel * scale;
      const cool = mix(frame.palette.rim, [0.10, 0.76, 1.0], 0.74);
      const deep = mix(frame.palette.tint, [0.35, 0.09, 0.63], 0.72);
      const bend = destination * 0.41;
      const point = (angle: number, depth: number): Point => {
        const d = depth / focal;
        const radius = 1.77 + Math.sin(angle * 3 + d * 0.8 + bend) * 0.065;
        return {
          x: offsetX + Math.cos(angle) * rx * radius + Math.sin(d * 0.58 + bend) * 22 * scale * d,
          y: offsetY + Math.sin(angle) * ry * radius + Math.sin(d * 0.39) * 16 * scale * d,
          z: depth,
        };
      };
      const depthFade = (z: number): number => smooth(near, near + focal * 0.40, z)
        * (1 - smooth(far - focal * 0.75, far, z));
      // Far-to-near: translucent ribs share the sky's source-over surface.
      const depths = Array.from({ length: 8 }, (_, i) =>
        near + fract(i / 8 - drift / span) * span).sort((a, b) => b - a);
      for (const depth of depths) {
        const fade = depthFade(depth) * portal;
        const tint = mix(cool, deep, clamp((depth - near) / span));
        for (let segment = 0; segment < 32; segment++) {
          const angle = segment * TAU / 32;
          const a = point(angle, depth), b = point(angle + TAU / 32, depth);
          const width = (5 + 3 * clamp(depth / focal)) * scale;
          ribbon(a, b, width, width, tint, fade * 0.12, fade * 0.12,
            angle, angle + TAU / 32, 2, frame.active ? 0.86 : 0.12);
        }
      }
      // Long axial fibers converge into the distant aperture. Their hue and
      // width stay fixed while soft material knots travel toward the viewer.
      for (let segment = 23; segment >= 0; segment--) {
        const z = near + segment / 24 * span, next = near + (segment + 1) / 24 * span;
        for (let fiber = 0; fiber < 18; fiber++) {
          const angle = fiber * TAU / 18 + 0.30;
          const twistA = angle + z / focal * 0.34, twistB = angle + next / focal * 0.34;
          const a = point(twistA, z);
          const b = point(twistB, next);
          const color = mix(cool, deep, (fiber % 6) / 5);
          const flowA = 0.70 + 0.30 * Math.sin((z + drift) / focal * 2.1 + fiber) ** 2;
          const flowB = 0.70 + 0.30 * Math.sin((next + drift) / focal * 2.1 + fiber) ** 2;
          const wallAngle = fiber % 3 === 0 ? 0.36 : 0.29;
          const al = point(twistA - wallAngle, z);
          const ar = point(twistA + wallAngle, z);
          const bl = point(twistB - wallAngle, next);
          const br = point(twistB + wallAngle, next);
          const aa = depthFade(z) * portal * 0.73, ab = depthFade(next) * portal * 0.73;
          const va = (z + drift) / focal, vb = (next + drift) / focal;
          const calm = frame.active ? 0.86 : 0.04;
          // Shared tube edges join exactly between segments. Independent wide
          // billboard normals left tiny black cracks across the curved walls.
          vertex(al, 0, 0, color, aa, -1, va, 3, calm);
          vertex(ar, 0, 0, color, aa, 1, va, 3, calm);
          vertex(br, 0, 0, color, ab, 1, vb, 3, calm);
          vertex(al, 0, 0, color, aa, -1, va, 3, calm);
          vertex(br, 0, 0, color, ab, 1, vb, 3, calm);
          vertex(bl, 0, 0, color, ab, -1, vb, 3, calm);
          const width = (fiber % 3 === 0 ? 7.2 : 3.8) * scale;
          ribbon(a, b, width, width, color,
            depthFade(z) * portal * 0.90 * flowA, depthFade(next) * portal * 0.90 * flowB,
            z / focal, next / focal, 2, frame.active ? 0.86 : 0.12);
        }
      }
    }

    // A grain and its tail follow the same path at successive travel positions.
    // Near grains continue past the arena toward the viewer; the central masks
    // still protect gameplay. Nothing changes direction when the comet turns.
    if (!frame.reducedMotion) {
      const dustHue = mix(frame.palette.rim, [0.64, 0.84, 0.93], 0.40);
      const near = -0.55 * focal, span = 3550 * scale - near;
      for (const item of dustOrder) {
        item.depth = near + fract(item.grain.phase - decorativeTravel * item.grain.rate) * span;
      }
      // Source-over transparency needs a stable far-to-near order on this sky.
      dustOrder.sort((a, b) => b.depth - a.depth || a.index - b.index);
      for (const { grain, depth, index } of dustOrder) {
        const a = route(grain.angle, depth, grain.radial);
        const exposureTravel = 100 * grain.exposure;
        const tailDepth = depth + exposureTravel * grain.rate * span;
        const b = route(grain.angle, tailDepth, grain.radial);
        // Also rewind the gentle route bend, not only its depth coordinate.
        const tailD = tailDepth / focal;
        b.x = offsetX + Math.cos(grain.angle) * rx * grain.radial
          + Math.sin(tailD * 1.15 + (distance - exposureTravel * scale) / focal * 0.12) * 29 * scale * tailD;
        const pull = (p: Point): void => {
          const w = Math.max(0.20, 1 + p.z / focal);
          const px = p.x/w, py = p.y/w;
          if (hole > 0.001) {
            const strength = hole * 0.38 * Math.exp(-Math.hypot(px-offsetX,py-offsetY)/(rx*1.8));
            const angle = strength*0.65, dx = px-offsetX, dy = py-offsetY;
            p.x = (offsetX+(dx*Math.cos(angle)-dy*Math.sin(angle))*(1-strength))*w;
            p.y = (offsetY+(dx*Math.sin(angle)+dy*Math.cos(angle))*(1-strength))*w;
          } else if (magnet > 0.001) {
            const dx = frame.comet[0]-frame.center[0]-px, dy = frame.comet[1]-frame.center[1]-py;
            const strength = magnet*0.30*Math.exp(-(dx*dx+dy*dy)/(160*160*scale*scale));
            p.x += dx*strength*w; p.y += dy*strength*w;
          }
        };
        pull(a); pull(b);
        const aw = Math.max(0.20, 1 + a.z / focal), bw = Math.max(0.20, 1 + b.z / focal);
        let dx = b.x / bw - a.x / aw, dy = b.y / bw - a.y / aw;
        const projectedLength = Math.hypot(dx, dy);
        // Cap the projected shutter length and width before a nearby grain
        // becomes a bright rail. Preserve its direction while capping length.
        const cap = 16 * scale;
        if (projectedLength > cap) {
          dx *= cap / projectedLength; dy *= cap / projectedLength;
          b.x = (a.x / aw + dx) * bw; b.y = (a.y / aw + dy) * bw;
        }
        const fade = smooth(near, near + 180 * scale, depth)
          * (1 - smooth(2650 * scale, 3450 * scale, depth));
        const fragment = voyage && index % 19 === 0;
        const width = Math.min((fragment ? 3.6 : grain.width) * scale, (fragment ? 3.8 : 1.65) * scale * aw);
        const alpha = (1 - portal * 0.70) * fade * grain.bright / Math.sqrt(Math.max(1, projectedLength / (5 * scale)));
        ribbon(a, b, width, width * (fragment ? 0.68 : 0.45), fragment ? [0.32, 0.39, 0.46] : dustHue,
          alpha, alpha * (fragment ? 0.72 : 0.18), -1, 1, 1, 0.87);
      }
    }

    // These currents trace the actual reward flights rather than inventing
    // another star position or moving a collectible away from its contact test.
    if (frame.active && !frame.reducedMotion && hole < 0.001) {
      for (const path of (frame.rewardPaths ?? []).slice(0, 5)) {
        const progress = effectStrength(path.progress);
        const point = (q: number): Point => {
          const k = 1 - q;
          return { x: k*k*path.origin[0]+2*k*q*path.control[0]+q*q*path.target[0]-frame.center[0],
            y: k*k*path.origin[1]+2*k*q*path.control[1]+q*q*path.target[1]-frame.center[1], z: 0 };
        };
        const head = 1 - (1-progress)*(1-progress);
        for (let i = 0; i < 12; i++) {
          const from = Math.max(0, head-0.38)+(Math.min(head,0.38)*i/12);
          const to = Math.max(0, head-0.38)+(Math.min(head,0.38)*(i+1)/12);
          const alpha = Math.sin(progress*Math.PI)*0.19*(i+1)/12;
          ribbon(point(from), point(to), 5.4*scale, 4.0*scale, [0.90,0.61,0.18],
            alpha, alpha, from, to, 2, 0.45);
        }
      }
    }

    if (frame.reducedMotion || !frame.active || trail.length < 2) return;
    const cyan = frame.cometColor ?? [0.20, 0.86, 1.0];
    let hue = mix(cyan, frame.palette.rim, 0.16);
    hue = mix(hue, [0.34, 0.95, 0.82], charge * 0.24);
    hue = mix(hue, [1.0, 0.40, 0.12], scorch * 0.78);
    hue = mix(hue, [1.0, 0.80, 0.33], release * ordinaryPower * 0.65);
    const toPoint = (p: TrailPoint): Point => {
      const age = frame.visualTime - p.birth;
      const wake = Math.min(focal * 0.55, Math.max(0, decorativeTravel - p.distance) * scale);
      // Existing material follows an eased gesture disturbance, never a light pulse.
      const ripple = Math.sin(age * 2.1 + p.birth * 0.65) * scale * (turn * 2.0 + hop * 1.7);
      const toCometX = frame.comet[0] - frame.center[0] - p.x;
      const toCometY = frame.comet[1] - frame.center[1] - p.y;
      const gathering = magnet * Math.min(0.16, age * 0.05);
      return { x: p.x + ripple + toCometX * gathering, y: p.y + ripple * 0.35 + toCometY * gathering, z: -wake };
    };
    for (let i = trail.length - 2; i >= 0; i--) {
      const newer = trail[i], older = trail[i + 1];
      const a = i === 0 ? { x: frame.comet[0] - frame.center[0], y: frame.comet[1] - frame.center[1], z: 0 } : toPoint(newer);
      const b = toPoint(older);
      const lifeA = clamp(1 - (frame.visualTime - newer.birth) / 3.3);
      const lifeB = clamp(1 - (frame.visualTime - older.birth) / 3.3);
      const phaseA = newer.birth * 0.43 - time * 0.31;
      const phaseB = older.birth * 0.43 - time * 0.31;
      const widening = 1 + charge * 0.24 + scorch * 0.28 + release * ordinaryPower * 0.38;
      if (scorch > 0.001) {
        ribbon(a, b, 12.5 * scale * lifeA, 12.5 * scale * lifeB, [0.76, 0.20, 0.045],
          0.13 * lifeA ** 2 * scorch, 0.13 * lifeB ** 2 * scorch, phaseA, phaseB, 2, 0.40);
      }
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
    if (!frame.active && frame.transition?.completed) {
      const elapsed = Math.max(0, Number.isFinite(frame.transition.elapsed) ? frame.transition.elapsed : 0);
      if (passageElapsed < 0 || elapsed < passageElapsed) passageTravel = 0;
      passageElapsed = elapsed;
      destination = frame.transition.nextLevel;
      passage = frame.reducedMotion ? 0.84 : smooth(0, 1.7, elapsed);
      if (!frame.reducedMotion) passageTravel += dt * 215;
    } else {
      // A wormhole is exclusively a between-worlds passage. The first playable
      // frame has no tunnel, transition debris, or lingering passage overlay.
      passage = 0; passageTravel = 0; passageElapsed = -1;
    }
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
    const priorTextureUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE3);
    const priorTextureBinding = gl.getParameter(gl.TEXTURE_BINDING_2D);
    // A second renderer on this context must not strand the sky's triangle pointer.
    try {
      gl.bindTexture(gl.TEXTURE_2D, earthTexture);
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
      gl.uniform3f(uniforms.uVoyage, frame.reducedMotion ? 0.24 : clamp(frame.voyage?.progress ?? 0),
        frame.voyage?.chapter ?? -1, frame.reducedMotion ? 0 : frame.visualTime);
      const next = frame.nextVoyage;
      const validNext = next && Number.isFinite(next.progress) && next.chapter >= 0 && next.chapter <= 12;
      gl.uniform3f(uniforms.uVoyageNext, validNext ? (frame.reducedMotion ? 0.24 : clamp(next.progress)) : 0,
        validNext ? next.chapter : -1, validNext ? effectStrength(frame.voyageBlend) : 0);
      const strength = (value: number | undefined): number => frame.active ? effectStrength(value) : 0;
      const blackHole = strength(frame.effects?.blackHole);
      const ordinary = blackHole > 0.001 ? 0 : 1;
      gl.uniform3f(uniforms.uVoyagePower, strength(frame.effects?.charge) * ordinary,
        strength(frame.effects?.orbit) * ordinary, strength(frame.effects?.release) * ordinary);
      gl.uniform3f(uniforms.uVoyageForce, strength(frame.effects?.magnet) * ordinary,
        strength(frame.effects?.scorch) * ordinary, blackHole);
      gl.uniform3f(uniforms.uVoyageCue, frame.comet[0], frame.comet[1], frame.reducedMotion ? 0 : 1);
      gl.uniform1i(uniforms.uVoyageEarth, 3);
      gl.uniform1f(uniforms.uVoyageEarthReady, earthReady ? 1 : 0);
      gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, cursor / STRIDE);
    } finally {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, priorTextureBinding);
      gl.activeTexture(priorTextureUnit);
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
      if (earthTexture) gl.deleteTexture(earthTexture);
      earthTexture = null;
    },
  };
}
