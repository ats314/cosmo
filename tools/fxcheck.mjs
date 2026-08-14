/* THE RENDER PATH HAS NO COVERAGE, BY CONSTRUCTION — and this is the harness
   that gives a piece of it some.

   The other five stub the canvas and WebGL away: smoke.mjs's context answers
   every property with a function that returns undefined, which is exactly
   what makes it good at exercising the audio guards and useless at telling
   you whether anything was drawn. That gap is not theoretical. Thirteen black
   hole features shipped, of which a playtester could perceive one — each
   individually correct at its own site and disabled by something elsewhere.

   So this stubs WebGL as a RECORDING FAKE rather than removing it: shaders
   compile, programs link, framebuffers complete, and every call is written
   down. Then it asserts on what was actually issued.

   The single most valuable thing here is the uniform-name check. In real
   WebGL, getUniformLocation returns null for a name the shader does not
   declare, and uniform1f(null, x) is a silent no-op — so one typo in a
   uniform name does not throw, does not warn, and does not fail any other
   check in this repo. It just quietly removes an effect from the game. The
   fake reproduces that exactly: it parses the uniform declarations out of the
   shader source it was handed and returns null for anything else. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1];
const fail = [];
const note = [];

/* ---------------- the recording WebGL fake ---------------- */
let enumN = 0x1000;
const E = {};
for (const k of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS',
  'ARRAY_BUFFER', 'STATIC_DRAW', 'FLOAT', 'TRIANGLES', 'TEXTURE_2D', 'RGBA',
  'UNSIGNED_BYTE', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S',
  'TEXTURE_WRAP_T', 'LINEAR', 'CLAMP_TO_EDGE', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0',
  'FRAMEBUFFER_COMPLETE', 'TEXTURE0', 'TEXTURE1', 'DEPTH_TEST', 'BLEND',
  'UNPACK_FLIP_Y_WEBGL']) E[k] = enumN++;

function makeGL(tag, log) {
  const uniformsOf = s => new Set([...s.matchAll(/\buniform\s+\w+\s+([^;]+);/g)]
    .flatMap(m => m[1].split(',').map(v => v.trim().replace(/\[.*$/, ''))));
  const progSrc = new Map();   // program -> declared uniform names
  let cur = null;
  const g = {
    ...E,
    createShader: ty => ({ ty, src: '' }),
    shaderSource: (o, s) => { o.src = s; },
    compileShader: () => {},
    getShaderParameter: () => true,
    createProgram: () => ({ u: new Set() }),
    attachShader: (pr, sh) => {
      if (sh.ty === E.FRAGMENT_SHADER) progSrc.set(pr, uniformsOf(sh.src));
    },
    bindAttribLocation: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    useProgram: pr => { cur = pr; log.use.push(pr); },
    getUniformLocation: (pr, n) => {
      const declared = progSrc.get(pr);
      if (!declared || !declared.has(n)) { log.missing.push(`${tag}:${n}`); return null; }
      return { pr, n };
    },
    createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
    createTexture: () => ({ id: log.tex++ }),
    bindTexture: (t, o) => { log.bound = o; },
    texParameteri: () => {},
    texImage2D: (...a) => {
      /* the 9-arg form allocates; the 6-arg form uploads a DOM source */
      if (a.length >= 9) log.alloc.push([a[3], a[4]]);
      else log.upload.push({ flip: log.flip });
    },
    pixelStorei: (k, v) => { if (k === E.UNPACK_FLIP_Y_WEBGL) log.flip = !!v; },
    createFramebuffer: () => ({ id: log.fb++ }),
    bindFramebuffer: (t, f) => { log.fbBound = f; },
    framebufferTexture2D: () => {},
    checkFramebufferStatus: () => E.FRAMEBUFFER_COMPLETE,
    deleteTexture: () => {}, deleteFramebuffer: () => {},
    isContextLost: () => log.lost,
    viewport: (x, y, w, h) => { log.vp = [w, h]; },
    activeTexture: () => {},
    disable: () => {}, enable: () => {},
    uniform1f: (l, v) => { if (l) log.set.add(l.n); else log.nullSet.push(tag); },
    uniform2f: (l) => { if (l) log.set.add(l.n); else log.nullSet.push(tag); },
    uniform3f: (l) => { if (l) log.set.add(l.n); else log.nullSet.push(tag); },
    uniform1i: (l) => { if (l) log.set.add(l.n); else log.nullSet.push(tag); },
    drawArrays: () => { log.draws.push({ fb: log.fbBound, vp: log.vp && log.vp.slice() }); },
  };
  return g;
}

/* ---------------- the DOM, with WebGL that works ---------------- */
function build({ webgl }) {
  const log = { use: [], missing: [], set: new Set(), nullSet: [], draws: [], alloc: [], upload: [], tex: 0, fb: 0, flip: false, vp: null, fbBound: null, lost: false };
  const gradient = { addColorStop() {} };
  const ctx2d = () => new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 50 });
      if (k === 'canvas') return {};
      return (typeof k === 'string') ? (t[k] !== undefined ? t[k] : () => {}) : undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const listeners = {};
  const calls = { raf: [] };
  const mkCanvas = tag => ({
    width: 0, height: 0, style: {},
    getContext: kind => (kind === '2d' ? ctx2d() : (webgl ? makeGL(tag, log) : null)),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  });
  const canvasEl = mkCanvas('c'), bgEl = mkCanvas('bg'), safeEl = {};
  const doc = {
    getElementById: id => id === 'c' ? canvasEl : (id === 'bg' ? bgEl : safeEl),
    createElement: () => mkCanvas('off'),
    addEventListener: (ev, fn) => { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
    head: { appendChild() {} },
    hidden: false,
  };
  const store = {};
  let nowMs = 0;
  const sandbox = {
    document: doc, window: null,
    navigator: { userAgent: 'fxcheck', platform: 'X', maxTouchPoints: 0 },
    localStorage: { getItem: k => store[k] === undefined ? null : store[k], setItem: (k, v) => { store[k] = String(v); } },
    performance: { now: () => nowMs },
    requestAnimationFrame: fn => { calls.raf.push(fn); },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
    location: { origin: 'https://x.test', pathname: '/' },
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
    isNaN, parseInt, parseFloat, setTimeout: () => {},
  };
  sandbox.window = new Proxy(sandbox, {
    get(t, k) {
      if (k === 'innerWidth') return 390;
      if (k === 'innerHeight') return 844;
      if (k === 'devicePixelRatio') return 2;
      if (k === 'addEventListener') return (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
      if (k === 'AudioContext' || k === 'webkitAudioContext') return undefined;
      if (k === 'matchMedia') return sandbox.matchMedia;
      if (k === 'localStorage') return sandbox.localStorage;
      if (k === 'navigator') return sandbox.navigator;
      if (k === 'storage') return undefined;
      return t[k];
    },
  });
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'index.html' });
  const frame = ms => {
    nowMs += ms;
    const fns = calls.raf.splice(0);
    if (!fns.length) throw new Error('no rAF pending');
    for (const fn of fns) fn(nowMs);
  };
  const fire = (name, ev) => { for (const fn of (listeners[name] || [])) fn(ev); };
  const st = expr => vm.runInContext(expr, sandbox);
  return { log, frame, fire, st };
}

/* ---------------- the front screens, crossed by their real controls -------
   Carried here for the same reason all the other harnesses carry them: a
   harness that taps a fixed point does not fail on an unexpected front
   screen, it waits there forever, which is how the swipe chooser broke all
   four harnesses the day it arrived. */
const pev = (id, x, y, type) => ({ pointerId: id, clientX: x, clientY: y, type: type || 'pointerup', preventDefault() {} });
function pressRect(st, frame, fire, pid, expr, what) {
  for (let i = 0; i < 30; i++) frame(16.7);
  const r = JSON.parse(st(expr) || 'null');
  if (!r) throw new Error(`no ${what} control was drawn`);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
  fire('pointerup', { ...pev(pid, x, y, 'pointerup'), type: 'pointerup' });
  return pid + 1;
}
function crossFront(st, frame, fire, pid) {
  if (st('G.state') === 'menu') pid = pressRect(st, frame, fire, pid, 'JSON.stringify(G.menuRects.find(x=>x.id==="start")||null)', 'menu START');
  if (st('G.state') === 'swipesel') {
    for (let i = 0; i < 30; i++) frame(16.7);
    pid = pressRect(st, frame, fire, pid, 'JSON.stringify(G.selRects.find(x=>x.id==="play")||null)', 'swipe-chooser PLAY');
  }
  if (st('G.state') === 'levelsel') pid = pressRect(st, frame, fire, pid, 'JSON.stringify(G.lvSelRects.find(x=>x.id==="start")||null)', 'level-picker START');
  if (st('G.state') === 'powersel') pid = pressRect(st, frame, fire, pid, 'JSON.stringify(G.powSelRects.find(x=>x.id==="start")||null)', 'powerup-picker START');
  /* the level card is the one screen that DOES answer a tap anywhere — it is
     a card to dismiss, not a decision to make */
  if (st('G.state') === 'lvend') {
    for (let i = 0; i < 60; i++) frame(16.7);
    fire('pointerdown', pev(pid, 200, 400, 'pointerdown'));
    fire('pointerup', pev(pid++, 200, 400, 'pointerup'));
    for (let i = 0; i < 60; i++) frame(16.7);
  }
  return pid;
}

/* ================= 1. WITH A WORKING GPU ================= */
{
  const { log, frame, fire, st } = build({ webgl: true });
  let pid = 1;
  for (let i = 0; i < 60; i++) frame(16.7);
  pid = crossFront(st, frame, fire, pid);
  if (st('G.state') !== 'playing') fail.push(`could not reach a run (stuck in ${st('G.state')})`);
  const before = log.draws.length;
  for (let i = 0; i < 90; i++) frame(16.7);
  const drew = log.draws.length - before;

  if (st('GL.on') !== true) fail.push('the backdrop shader did not come up against a working GL');
  if (st('FX.on') !== true) fail.push('the glow pass did not come up against a working GL');

  /* THE TYPO CHECK. Any name asked for that the shader does not declare came
     back null, and every uniform written through a null location is an effect
     silently missing from the game. */
  if (log.missing.length) fail.push(`uniform names not declared by their shader: ${[...new Set(log.missing)].join(', ')}`);
  if (log.nullSet.length) fail.push(`${log.nullSet.length} uniform writes went to a null location`);

  /* every location the glow pass looked up must actually be written */
  for (const bag of ['FX.uB', 'FX.uC']) {
    const names = JSON.parse(st(`JSON.stringify(Object.keys(${bag}))`));
    if (!names.length) { fail.push(`${bag} holds no uniform locations at all`); continue; }
    const unset = names.filter(n => !log.set.has(n));
    if (unset.length) fail.push(`${bag}: declared but never written — ${unset.join(', ')}`);
  }

  /* THE Y-FLIP. A 2D canvas counts rows down and a framebuffer counts them
     up, so the source upload must flip and nothing else may. Flip in neither
     place or in both and the glow renders upside down — which no other check
     in this repo could possibly notice. */
  if (!log.upload.length) fail.push('the bright buffer was never uploaded to the GPU');
  else if (!log.upload.every(u => u.flip)) fail.push('the bright buffer was uploaded without UNPACK_FLIP_Y_WEBGL — the glow will be upside down');

  /* SIX BLUR TARGETS AT THREE SCALES. The wide level must reach /16 by way of
     /8: a single 4:1 read undersamples a source only smooth to sigma 2, and
     the halo shimmers as lights orbit across the sampling grid. */
  const bw = Math.ceil(390 / 4), bh = Math.ceil(844 / 4);
  const want = [[bw, bh], [bw, bh], [bw >> 1, bh >> 1], [bw >> 1, bh >> 1], [bw >> 2, bh >> 2], [bw >> 2, bh >> 2]];
  const got = log.alloc.slice(0, 6);
  if (got.length < 6) fail.push(`the glow allocated ${got.length} render targets, expected 6`);
  else {
    const same = want.every((w, i) => w[0] === got[i][0] && w[1] === got[i][1]);
    if (!same) fail.push(`render-target ladder is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }

  /* SEVEN DRAWS PER FRAME FROM THE GLOW — six blurs into framebuffers plus
     one composite to the canvas — on top of the backdrop's single draw. */
  const perFrame = drew / 90;
  if (perFrame < 7.9 || perFrame > 8.1) fail.push(`${perFrame.toFixed(2)} GPU draws per frame, expected 8 (1 backdrop + 6 blur + 1 composite)`);
  const toCanvas = log.draws.slice(before).filter(d => d.fb === null);
  if (!toCanvas.length) fail.push('nothing was ever composited to a default framebuffer');
  else {
    const cw = Math.ceil(390 / 2), ch = Math.ceil(844 / 2);
    if (!toCanvas.some(d => d.vp && d.vp[0] === cw && d.vp[1] === ch))
      fail.push(`the glow composite never ran at the FX canvas size ${cw}x${ch}`);
  }
  note.push(`GPU path: ${perFrame.toFixed(1)} draws/frame, ${got.length} targets, flip on upload`);

  /* THE SCALE DIAL CLIMBS AND ITS CEILING LATCHES. Fast seconds raise it;
     one slow stretch drops it and pins the cap there for the rest of the run. */
  const s0 = Number(st('GL.scale'));
  for (let i = 0; i < 60 * 8; i++) frame(8);       // 125fps: comfortably fast
  const s1 = Number(st('GL.scale'));
  if (!(s1 > s0)) fail.push(`GL.scale did not climb on a fast device (${s0} -> ${s1})`);
  for (let i = 0; i < 40 * 4; i++) frame(40);      // 25fps: slow
  const s2 = Number(st('GL.scale')), cap = Number(st('GL.cap'));
  if (!(s2 < s1)) fail.push(`GL.scale did not fall on a slow device (${s1} -> ${s2})`);
  if (cap > s2 + 1e-9) fail.push(`the ceiling did not latch to the retreat (cap ${cap} > scale ${s2})`);
  for (let i = 0; i < 60 * 12; i++) frame(8);      // fast again: must not exceed the cap
  const s3 = Number(st('GL.scale'));
  if (s3 > cap + 1e-9) fail.push(`GL.scale climbed past its latched ceiling (${s3} > ${cap})`);
  note.push(`scale dial: ${s0} -> ${s1} climbed, -> ${s2} retreated, capped ${cap}, held ${s3}`);
}

/* ================= 1b. THE LENS POINTS THE RIGHT WAY =================
   This is inverse sampling, so the sign of the displacement is the opposite
   of what it looks like: reading from a smaller radius MAGNIFIES, and pushes
   every halo away from the singularity. The first cut of this pass did
   exactly that, at the right magnitude, with a comment above it saying the
   opposite — and it read as correct, because both are true under some
   reading of which way the number counts. It is the third time this precise
   inversion has hit the black hole in this file (the gravity pull that
   "dragged the comet inward" pushed it outward; the "inner ring 2x" bonus
   paid on the outer ring). Reading cannot catch it.
   So this does not read. It takes the real coefficients out of the shader
   source, asks where a light living at a given radius actually lands, and
   fails if the answer is not "closer to the middle". The constants are
   PARSED rather than copied, so retuning the shader retunes the check — and
   if the parse ever stops matching, that is a hard failure and not a silent
   pass. */
{
  const fs = src.match(/const FX_COMP\s*=\s*`([\s\S]*?)`/);
  if (!fs) fail.push('could not find FX_COMP in the source — the lens check cannot run');
  else {
    const body = fs[1];
    const mFall = body.match(/float\s+fall\s*=\s*exp\(-r\*([\d.]+)\)/);
    const mPull = body.match(/float\s+pull\s*=\s*uBH\*([\d.]+)\*r\*fall/);
    const mSign = body.match(/\*\(1\.0([+-])pull\/r\)/);
    if (!mFall || !mPull || !mSign) {
      fail.push('the lens lines in FX_COMP no longer parse — the direction check cannot run');
    } else {
      const K = Number(mPull[1]), FALL = Number(mFall[1]), SIGN = mSign[1] === '+' ? 1 : -1;
      const pull = r => 1.0 * K * r * Math.exp(-FALL * r);
      /* a destination fragment at radius r samples the source at sampled(r);
         a light living at source radius s therefore appears wherever
         sampled(r) === s */
      const sampled = r => r + SIGN * pull(r);
      const landsAt = s => {
        let lo = 0, hi = 3;
        for (let i = 0; i < 200; i++) {
          const mid = (lo + hi) / 2;
          if (sampled(mid) < s) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      };
      const H = 844;
      const moves = [0.10, 0.15, 0.20, 0.30].map(s => (landsAt(s) - s) * H);
      const outward = moves.filter(m => m > 0.05);
      if (outward.length) {
        fail.push(`the black hole lens pushes the glow AWAY from the singularity ` +
          `(${moves.map(m => m.toFixed(1) + 'px').join(', ')} at 0.10/0.15/0.20/0.30 of screen height) ` +
          `— inverse sampling means a smaller sampled radius magnifies`);
      } else if (!moves.some(m => m < -2)) {
        fail.push(`the black hole lens barely moves the glow at all (${moves.map(m => m.toFixed(1) + 'px').join(', ')})`);
      } else {
        note.push(`BH lens: glow moves ${moves.map(m => m.toFixed(1)).join('/')}px (inward) at 0.10/0.15/0.20/0.30 H`);
      }
      /* and it must never fold — a non-monotonic map turns the field inside out */
      let prev = -1, worst = Infinity;
      for (let r = 0.0001; r < 2; r += 0.0001) {
        const cur = sampled(r);
        if (prev >= 0) worst = Math.min(worst, cur - prev);
        prev = cur;
      }
      if (!(worst > 0)) fail.push(`the lens is not monotonic (smallest step ${worst.toExponential(2)}) — the glow field folds through itself`);
    }
  }
}

/* ================= 1c. A LOST CONTEXT HANDS BACK THE DISCS =================
   The failure this guards is silence, not an error. Every call on a lost
   WebGL context is a no-op that does not throw, so without an explicit test
   fxResize sees unchanged sizes and returns true, drawArrays does nothing,
   fxRender returns TRUE, and drawBloom composites an empty canvas. The glow
   does not degrade — it disappears, and it cannot come back, because
   bloomHalo was set false before the dot loop so the discs were never drawn
   either. */
{
  const { log, frame, fire, st } = build({ webgl: true });
  let pid = 1;
  for (let i = 0; i < 60; i++) frame(16.7);
  pid = crossFront(st, frame, fire, pid);
  for (let i = 0; i < 30; i++) frame(16.7);
  if (st('FX.on') !== true) fail.push('lost-context: the glow was not up to begin with');
  log.lost = true;                       // the GPU goes away mid-run
  for (let i = 0; i < 5; i++) frame(16.7);
  if (st('FX.on') !== false) fail.push('lost-context: FX.on stayed true — the glow is now silently empty with no fallback');
  if (st('bloomHalo') !== true) fail.push('lost-context: the disc halo did not take back over');
  const after = log.draws.length;
  for (let i = 0; i < 20; i++) frame(16.7);
  const glowDraws = log.draws.length - after;
  /* the backdrop keeps drawing on its own context; the glow must not */
  if (glowDraws > 20) fail.push(`lost-context: ${glowDraws} draws over 20 frames — the glow is still issuing calls into a dead context`);
  note.push('lost context: glow stood down, discs took over');
}

/* ================= 2. WITH NO GPU AT ALL ================= */
/* The disc halo is not a legacy path, it is the fallback, and a fallback
   nobody runs is a fallback nobody knows is broken. */
{
  const { log, frame, fire, st } = build({ webgl: false });
  let pid = 1;
  for (let i = 0; i < 60; i++) frame(16.7);
  pid = crossFront(st, frame, fire, pid);
  if (st('G.state') !== 'playing') fail.push(`no-GPU: could not reach a run (stuck in ${st('G.state')})`);
  for (let i = 0; i < 60; i++) frame(16.7);
  if (st('GL.on') !== false) fail.push('no-GPU: the backdrop shader claims to be running');
  if (st('FX.on') !== false) fail.push('no-GPU: the glow pass claims to be running');
  if (st('bloomHalo') !== true) fail.push('no-GPU: the disc halo did not take over — the glow has no reach at all');
  if (log.draws.length) fail.push('no-GPU: something issued GPU draws anyway');
  note.push('no-GPU path: disc halo active, no GPU calls issued');
}

if (fail.length) {
  console.error('FXCHECK FAILED');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
for (const n of note) console.log('  ' + n);
console.log('FXCHECK OK  the glow reaches a pixel on a GPU, and the discs take over without one');
