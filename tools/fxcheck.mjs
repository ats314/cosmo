/* @lane fast */
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
import { seededMath, seedLine } from './lib/rng.mjs';
/* PRINTED HERE, BEFORE ANY ASSERTION CAN EXIT. This harness imported
   seedLine and never called it, so the seed CI ran on never reached the
   log — and CI rotates it per run, which made every failure here a
   one-off nobody could reproduce. Both docs promised otherwise. */
console.log(seedLine('fxcheck'));

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
    /* every component of every uniform write is checked FINITE. A NaN or
       undefined reaching a uniform does not throw anywhere — it propagates
       through the shader as NaN and renders as black or garbage on a real
       GPU, silently. Nothing else in this repo can see that class. */
    uniform1f: (l, v) => { if (l) { log.set.add(l.n); log.val[l.n] = [v]; if (!Number.isFinite(v)) log.badVals.push(`${l.n}=${v}`); } else log.nullSet.push(tag); },
    uniform2f: (l, a, b) => { if (l) { log.set.add(l.n); log.val[l.n] = [a, b]; if (![a, b].every(Number.isFinite)) log.badVals.push(`${l.n}=${a},${b}`); } else log.nullSet.push(tag); },
    uniform3f: (l, a, b, c) => { if (l) { log.set.add(l.n); log.val[l.n] = [a, b, c]; if (![a, b, c].every(Number.isFinite)) log.badVals.push(`${l.n}=${a},${b},${c}`); } else log.nullSet.push(tag); },
    /* THE FAKE HAD NO uniform4f, AND ITS ABSENCE FAILED IN THE WORST SHAPE.
       The backdrop's first vec4 write threw a TypeError, glRender's own
       catch swallowed it into GL.on=false, and the harness reported "the
       backdrop shader did not come up against a working GL" — a message
       about the shader, for a hole in the harness. A fake that is missing a
       call does not fail the check it is missing; it fails a different one,
       somewhere else, with a plausible-sounding reason. */
    uniform4f: (l, a, b, c, d) => { if (l) { log.set.add(l.n); log.val[l.n] = [a, b, c, d]; if (![a, b, c, d].every(Number.isFinite)) log.badVals.push(`${l.n}=${a},${b},${c},${d}`); } else log.nullSet.push(tag); },
    uniform1i: (l, v) => { if (l) { log.set.add(l.n); if (!Number.isFinite(v)) log.badVals.push(`${l.n}=${v}`); } else log.nullSet.push(tag); },
    drawArrays: () => { log.draws.push({ fb: log.fbBound, vp: log.vp && log.vp.slice() }); },
  };
  return g;
}

/* ---------------- the DOM, with WebGL that works ---------------- */
function build({ webgl }) {
  const log = { use: [], missing: [], set: new Set(), nullSet: [], draws: [], alloc: [], upload: [], badVals: [], val: {}, tex: 0, fb: 0, flip: false, vp: null, fbBound: null, lost: false };
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
    Math: seededMath(), JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
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
  /* THE RAISE MUST NOT COUNT MENU FRAMES. The title screen is nothing but
     fast seconds — an empty board, no glow work, no simulation — so a raise
     that listens here bids the resolution up to a price the RUN cannot pay,
     and hands the ladder a guaranteed walk-down that ends with the 2D
     backdrop swapping in mid-run. That is the shipped bug, verbatim from the
     field: "looks good for the opening and then 5 seconds in, it changes". */
  const sMenu0 = Number(st('GL.scale'));
  for (let i = 0; i < 60 * 8; i++) frame(8);       // 125fps on the title screen
  const sMenu1 = Number(st('GL.scale'));
  if (sMenu1 > sMenu0 + 1e-9) {
    fail.push(`the render scale climbed on the MENU (${sMenu0} -> ${sMenu1}) — menu frames are `
      + 'unrepresentative, and a menu-bid resolution is a debt the run inherits');
  }
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
  if (log.badVals.length) fail.push(`non-finite uniform values reached the GPU: ${[...new Set(log.badVals)].slice(0, 4).join('; ')}`);

  /* Every location that was looked up must actually be written.
     GL.u WAS NOT IN THIS LIST, and the backdrop is the one program where a
     looked-up-but-never-written uniform is most likely: its uniform set grew
     from 16 to 29 with the world table, and a name added to glInit's lookup
     list but forgotten in glRender is a whole feature that silently renders
     as zero. The check cost nothing to extend and covers the sky now. */
  for (const bag of ['GL.u', 'FX.uB', 'FX.uC']) {
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

  /* THE SCALE DIAL CLIMBS IN PLAY, AND THE LADDER SHEDS IN ORDER OF
     IDENTITY: glow first, resolution second, the sky itself dead last. The
     watch measures the whole frame and cannot tell whose cost it is, so what
     it retires first has to be the thing whose loss a player is least likely
     to notice — and the glow is tuned to carry the same light as the disc
     fallback, so retiring it is nearly invisible AND refunds the cost most
     likely to be the problem. The sky swapping to the 2D backdrop mid-run is
     the single worst degrade the game can perform, and it must be the last
     resort, not the first response. */
  const s0 = Number(st('GL.scale'));
  for (let i = 0; i < 60 * 8; i++) frame(8);       // 125fps, in play: climbs
  const s1 = Number(st('GL.scale'));
  if (!(s1 > s0)) fail.push(`GL.scale did not climb on a fast device in play (${s0} -> ${s1})`);
  if (st('FX.on') !== true) fail.push('the glow should still be running before any slow stretch');
  /* one action window of slow frames: the glow dies, the sky is untouched */
  for (let i = 0; i < 75; i++) frame(40);          // 25fps for ~3s: one ladder action
  if (st('FX.on') !== false) fail.push('slow frames did not retire the GLOW first — the ladder is billing the sky for costs it can shed cheaper');
  const sAfterFx = Number(st('GL.scale'));
  if (Math.abs(sAfterFx - s1) > 1e-9) {
    fail.push(`the sky's resolution moved (${s1} -> ${sAfterFx}) before the glow was retired — the ladder is out of order`);
  }
  /* continued slow: NOW the resolution steps, and the cap latches */
  for (let i = 0; i < 40 * 4; i++) frame(40);
  const s2 = Number(st('GL.scale')), cap = Number(st('GL.cap'));
  if (!(s2 < s1)) fail.push(`GL.scale did not fall once the glow was gone (${s1} -> ${s2})`);
  if (cap > s2 + 1e-9) fail.push(`the ceiling did not latch to the retreat (cap ${cap} > scale ${s2})`);
  if (st('GL.on') !== true) fail.push('the slow stretch killed the sky entirely — it must be the last resort');
  for (let i = 0; i < 60 * 12; i++) frame(8);      // fast again: must not exceed the cap
  const s3 = Number(st('GL.scale'));
  if (s3 > cap + 1e-9) fail.push(`GL.scale climbed past its latched ceiling (${s3} > ${cap})`);
  note.push(`ladder: climbed ${s0} -> ${s1} in play, glow retired first, then ${s2}, capped ${cap}, held ${s3}`);
}

/* ============ 1a-ii. THE ORBIT ACTUALLY REACHES THE SKY ============
   "A visual feature is not shipped until something proves it reaches a
   pixel." Thirteen black hole features shipped with exactly one of them
   perceivable, each correct at its own site and disabled by something
   elsewhere — so the sky's orbit coupling is driven through the real game
   and read at the uniform, not at the variable that feeds it.
   The mechanic under test is the owner's brief, verbatim: "players should
   want to get orbits, and they should be rewarded with a cool background
   change ... an effect that considered consecutive orbits would be cool."
   Three claims, three assertions: consecutive orbits wind the sky up, a lap
   closing sends a wave, and turning around takes the winding away. */
{
  const { log, frame, fire, st } = build({ webgl: true });
  let pid = 1;
  for (let i = 0; i < 60; i++) frame(16.7);
  pid = crossFront(st, frame, fire, pid);
  if (st('G.state') !== 'playing') fail.push('the orbit/sky check could not reach a run');
  else {
    for (let i = 0; i < 30; i++) frame(16.7);
    /* ---- consecutive orbits wind the sky up ---- */
    const c0 = Number(st('SKY.charge'));
    st('G.lapStreak=5');
    for (let i = 0; i < 150; i++) frame(16.7);
    const c1 = Number(st('SKY.charge'));
    const uOrb = log.val.uOrb;
    if (!(c1 > c0 + 0.5)) fail.push(`a lap streak does not wind the sky up: charge ${c0.toFixed(3)} -> ${c1.toFixed(3)} over 2.5s at streak 5`);
    if (!uOrb) fail.push('uOrb never reached the GPU — the whole orbit coupling is missing');
    else if (Math.abs(uOrb[0] - c1) > 1e-6) fail.push(`uOrb.x (${uOrb[0]}) is not the charge the CPU computed (${c1}) — the sky is being told something else`);
    /* THE SPIN FOLLOWS TRAVEL, and the sign is the y-flip again: uv counts y
       up, the game's angle counts it down, so the rate must oppose G.dir. */
    const dir = Number(st('G.dir')), rate = Number(st('SKY.rate'));
    if (!(Math.abs(rate) > 0.02)) fail.push(`the sky is not turning at streak 5 (rate ${rate.toFixed(4)})`);
    else if (Math.sign(rate) !== -Math.sign(dir)) fail.push(`the sky spins the wrong way for travel: G.dir ${dir}, SKY.rate ${rate.toFixed(4)} — uv is y-up and the game's angle is y-down, so these must have opposite signs`);
    /* ---- a lap closing sends a wave ---- */
    const skyW0 = Number(st('G.skyW'));
    st(`G.lapAcc=Math.PI*2-0.001;G.lapEmbers=2`);
    for (let i = 0; i < 4; i++) frame(16.7);
    const wake = Number(st('SKY.wake')), skyW1 = Number(st('G.skyW'));
    if (!(wake >= 0)) fail.push('a completed orbit did not fire the sky wake — the payoff the owner asked for never leaves the CPU');
    /* ---- and orbits are what buys the journey ---- */
    const per = Number(st('ORB_PER_WORLD'));
    if (!(skyW1 - skyW0 > 0.9 / per)) fail.push(`a completed orbit did not advance the journey (skyW ${skyW0.toFixed(4)} -> ${skyW1.toFixed(4)}, wanted +${(1 / per).toFixed(4)})`);
    /* ---- turning around takes it away ---- */
    st('G.lapStreak=0');
    for (let i = 0; i < 240; i++) frame(16.7);
    const c2 = Number(st('SKY.charge'));
    if (!(c2 < c1 * 0.35)) fail.push(`losing the streak does not unwind the sky: charge held at ${c2.toFixed(3)} from ${c1.toFixed(3)} — the cost of turning around is what makes the reward mean anything`);
    else note.push(`orbit -> sky: streak 5 winds charge ${c0.toFixed(2)}->${c1.toFixed(2)} (spin ${rate.toFixed(3)} rad/s against dir ${dir}), a lap fires the wave and buys ${(1 / per).toFixed(3)} of a world, losing it unwinds to ${c2.toFixed(2)}`);
  }
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

/* ================= 1c2. THE GLOW FALLS OFF THE SCREEN EDGE =================
   WebGL1 has no CLAMP_TO_BORDER: a blur tap past the texture edge reads the
   edge texel back, so light that should slide off-screen is REFLECTED into
   the outermost band — a thin bright frame at the screen border whenever a
   light passes near it, compounded by every pass of the chain. Measured with
   the shipped kernel: 1.82x at the border against the physical level. The
   fix zero-weights out-of-bounds taps (the inb() factor in FX_BLUR).
   Checked BEHAVIORALLY: the kernel constants are parsed from the shader and
   the 1-D chain is simulated with the sampling semantics the source actually
   has — guarded if inb() is applied to the taps, clamped if not — and the
   border gain must stay at or under the physical level. Removing the guard
   flips the simulation to clamped sampling and fails at 1.8x. */
{
  const fsB = src.match(/const FX_BLUR=`([\s\S]*?)`;/);
  if (!fsB) fail.push('FX_BLUR not found — the edge-pileup check cannot run');
  else {
    const body = fsB[1];
    const kc = body.match(/texture2D\(uTex,vUv\)\*([\d.]+)/);
    const k1 = body.match(/\)\)\*([\d.]+);\s*\n\s*s\+=/);
    const k2 = body.match(/\)\)\*([\d.]+);\s*\n\s*gl_FragColor/);
    const o1 = body.match(/o1=uStep\*([\d.]+)/), o2 = body.match(/o2=uStep\*([\d.]+)/);
    const guarded = /texture2D\(uTex,vUv\+o1\)\*inb\(vUv\+o1\)/.test(body) &&
                    /texture2D\(uTex,vUv-o2\)\*inb\(vUv-o2\)/.test(body);
    const spread = src.match(/const FX_SPREAD=([\d.]+)/);
    if (!(kc && k1 && k2 && o1 && o2 && spread)) {
      fail.push('FX_BLUR kernel no longer parses — the edge-pileup check cannot run; update it with the shader');
    } else {
      const KC = +kc[1], K1 = +k1[1], K2 = +k2[1], O1 = +o1[1] * +spread[1], O2 = +o2[1] * +spread[1];
      const clamp1 = (a, x) => { const n = a.length, xx = Math.min(n - 1, Math.max(0, x)); const i = Math.floor(xx), f = xx - i, j = Math.min(n - 1, i + 1); return a[i] * (1 - f) + a[j] * f; };
      const S = guarded ? (a, x) => (x < -0.5 || x > a.length - 0.5) ? 0 : clamp1(a, x)
                        : clamp1;
      const blur = a => a.map((_, i) => S(a, i) * KC + (S(a, i + O1) + S(a, i - O1)) * K1 + (S(a, i + O2) + S(a, i - O2)) * K2);
      const down2 = a => Array.from({ length: a.length >> 1 }, (_, i) => S(a, i * 2 + 0.5));
      const N = 98;
      const run = pos => {
        let a = new Array(N).fill(0);
        for (let k = -2; k <= 2; k++) { const i = pos + k; if (i >= 0 && i < N) a[i] = 1 - Math.abs(k) * 0.3; }
        let b = blur(blur(a)); let c = blur(blur(down2(b))); let d = blur(blur(down2(c)));
        const upv = (arr, i) => clamp1(arr, (i + 0.5) * arr.length / N - 0.5);
        return i => 0.62 * upv(b, i) + 0.85 * upv(d, i);
      };
      const border = run(1)(0);
      const physical = run(49)(48);
      const gain = border / physical;
      if (gain > 1.05) {
        fail.push(`the glow piles up at the screen border: ${gain.toFixed(2)}x the physical level `
          + '— out-of-bounds blur taps are reading the clamped edge texel back instead of contributing nothing');
      } else {
        note.push(`glow at the screen border: ${gain.toFixed(2)}x physical — light falls off the edge, no rim`);
      }
    }
  }
}

/* ================= 1d. THE SKY CAN NEVER GO BLACK =================
   Field failure, measured after the fact: the nebula's coverage gate rode a
   SINGLE sample of a noise field (the screen spans a quarter of one coverage
   cell), and the drift walked a straight line through unsurveyed territory
   forever, because G.vt never resets. Result: whole-screen nebula blackouts
   lasting 10+ minutes — the first inside the first quarter hour of page
   life — with the stars alive, which reads not as weather but as the game
   being broken. It shipped that way from the shader's first day, and it was
   found from two same-build screenshots taken four hours apart.
   The fix made the reachable skies a CLOSED SET: the drift is an ellipse, so
   one lap is every sky the game can ever show, and the gate is floored so a
   barren stretch reads quiet rather than black. A closed set can be verified
   END TO END, so this does: a line-for-line port of the nebula chain, swept
   over the full orbit, with a hard floor on the darkest point. The port must
   move with GL_FS — the constants are PARSED from the shader source so a
   retune retunes the check, and a parse failure is a loud failure. */
{
  const fs = src.match(/const GL_FS=`([\s\S]*?)`;/);
  if (!fs) { fail.push('GL_FS not found — the sky-luminance sweep cannot run'); }
  else {
    const body = fs[1];
    const mOrbit = body.match(/float drA=uFlow\*([\d.]+);\s*\n\s*vec2 dr=vec2\(([\d.-]+)\+sin\(drA\)\*([\d.]+),([\d.-]+)\+cos\(drA\)\*([\d.]+)\)/);
    const mGate = body.match(/float gate=\(([\d.]+)\+([\d.]+)\*smoothstep\(uCov,uCov\+0\.20,covA-0\.18\*\(covB-0\.5\)\)\);/);
    /* THE FLOOR IS ONLY A FLOOR IF THE GATE ENTERS THROUGH A MIX TOWARD IT.
       The world's `cov` weight could otherwise be wired as a multiplier on
       the gate, which would let a world scale the floor to zero and bring the
       blackout back through the one door that was bolted shut. Pinned as a
       shape, not a value: mix(1.0, gate, w) can only ever RAISE the floor. */
    const mGateMix = body.match(/band\*=mix\(1\.0,gate,uWC\.y\);/);
    /* the structure blend — the port has to know which fields a world is made
       of, and this is the line that says so */
    const mStruct = body.match(/float band=bill\*uWA\.x\+broad\*uWA\.y\+cont\*uWA\.z\+fil\*uWA\.w;/);
    /* THE ROTATION'S SIGN, PARSED RATHER THAN TRUSTED. See the assertion
       below for why this is a captured group and not a literal match. */
    const mSpin = body.match(/float spinC=cos\((-?)uOrb\.y\),spinS=sin\((-?)uOrb\.y\);/);
    const mSpinUse = body.match(/vec2 nuv=uCtr\+vec2\(sv\.x\*spinC-sv\.y\*spinS,sv\.x\*spinS\+sv\.y\*spinC\);/);
    const mStarSpin = body.match(/vec2 sfrag=fc\+vec2\(dv0\.x\*spinC-dv0\.y\*spinS,dv0\.x\*spinS\+dv0\.y\*spinC\);/);
    const mCov = src.match(/const GL_COV=([\d.]+), GL_EXP=([\d.]+)/);
    const mMot = src.match(/const GL_MOTION=([\d.]+)/);
    const mWorlds = src.match(/const WORLDS=(\[[\s\S]*?\]);/);
    let WORLDS = null;
    if (mWorlds) { try { WORLDS = new Function('return ' + mWorlds[1])(); } catch (e) { WORLDS = null; } }
    if (!mOrbit) fail.push('the drift is not the bounded orbit — a linear drift walks into multi-minute nebula blackouts (or the port desynced: update it with GL_FS)');
    if (!mGate) fail.push('the coverage gate has no floor — a barren coverage sample blacks out the whole sky (or the port desynced: update it with GL_FS)');
    if (!mGateMix) fail.push('the world no longer applies the coverage gate through mix(1.0,gate,uWC.y) — a multiplied gate lets a world scale the never-black floor to zero');
    if (!mStruct) fail.push('the world structure blend is not the four weighted terms the port models (or the port desynced: update it with GL_FS)');
    if (!WORLDS || !WORLDS.length) fail.push('the WORLDS table could not be parsed — the sky sweep cannot cover the set of skies');

    /* ---- THE SET OF SKIES IS STILL CLOSED, AND THE TABLE IS HOW ----
       "one lap is every sky the game can ever show" was true when there was
       one structure. There are six now, and the reachable set is (drift
       orbit) x (adjacent world pair), so these are the properties that keep
       it finite and safe to sweep:
         - the four structure weights SUM TO 1 in every row, so a world is a
           blend and never a gain. A lerp between two rows that each sum to 1
           also sums to 1, which is what makes sweeping the pure rows enough
           to bound the morphs between them.
         - cov is a mix factor in 0..1, so no world can lower the gate floor.
         - the exponents are >= 1: pow() with a base of 0 and an exponent of
           0 is undefined, and every one of these bases can reach 0. */
    if (WORLDS) for (const w of WORLDS) {
      const sum = w.bill + w.broad + w.cont + w.fil;
      if (Math.abs(sum - 1) > 0.001) fail.push(`world ${w.n}: structure weights sum to ${sum.toFixed(3)}, not 1 — a world must be a blend of the four structures, never a gain on them`);
      if (!(w.cov >= 0 && w.cov <= 1)) fail.push(`world ${w.n}: cov ${w.cov} is outside 0..1 — the coverage mix must not be able to reach past the never-black floor`);
      if (!(w.contK >= 1) || !(w.filK >= 1)) fail.push(`world ${w.n}: contK/filK must be >= 1 — pow(0.0,0.0) is undefined in GLSL ES and both bases reach 0`);
      if (!(w.gain > 0) || !(w.motion > 0) || !(w.star >= 0)) fail.push(`world ${w.n}: gain/motion/star must be positive`);
    }

    /* ---- WHERE A THING ENDS UP, IN RADIANS ----
       The invariant this exists for has been paid for three times on the
       black hole: a screen-space warp is INVERSE SAMPLING, so its sign is the
       opposite of what it reads like, and code and comment are each true
       under a different reading of which way the number counts. Reading it
       does not work. So this asks the only question that does — where does a
       feature END UP — by running the parsed transform.
       The shader rotates the SAMPLE by spinC/spinS. A field feature sitting
       at P is therefore drawn at whichever fragment samples P, and the test
       is whether that fragment's angle is P's angle PLUS uOrb.y (the sky
       turning the way the comet travels) or MINUS it (the sky turning
       backwards, which is the bug that has shipped three times). */
    if (mSpin && mSpinUse && mStarSpin) {
      const neg = mSpin[1] === '-' && mSpin[2] === '-';
      const s = 0.5;                       /* a half-radian of apparent turn */
      const sc = Math.cos(neg ? -s : s), ss2 = Math.sin(neg ? -s : s);
      /* invert the sample rotation to find the fragment that shows P */
      const P = [Math.cos(0.3), Math.sin(0.3)];
      const det = sc * sc + ss2 * ss2;
      const fx = (sc * P[0] + ss2 * P[1]) / det, fy = (-ss2 * P[0] + sc * P[1]) / det;
      let d = Math.atan2(fy, fx) - 0.3;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d - s) > 1e-6) {
        fail.push(`the sky's orbit spin turns BACKWARDS: with uOrb.y=+${s}, a feature at 0.300 rad ends up at ${(0.3 + d).toFixed(3)} rad `
          + `(a turn of ${d.toFixed(3)}, wanted +${s}) — a screen-space warp is inverse sampling and its sign reads the opposite of its intent`);
      } else {
        note.push(`orbit spin: uOrb.y=+${s} moves a feature +${d.toFixed(3)} rad, and the stars ride the same transform`);
      }
    } else fail.push('the orbit spin transform did not parse — its sign cannot be verified, and this exact inversion has shipped backwards three times');

    /* ---- WHICH HALF OF THE SKY THE LAP SECTOR LIGHTS ----
       The same question as the spin, asked of the other frame conversion.
       uOrb2.x/.y carry the comet's angle and travel direction translated from
       the game's y-DOWN frame into the shader's y-UP one, and getting that
       pair wrong lights the half of the sky the comet has NOT swept — which
       looks like a working feature, animates convincingly, and teaches the
       player the opposite of the mechanic. Neither reading the shader nor
       reading glRender catches it; only following a point through both. */
    const mSector = body.match(/float rel=mod\(\(uOrb2\.x-fa\)\*uOrb2\.y,6\.28318\);/);
    const mFeed = src.match(/GL\.u\.uOrb2,\s*(-?)\(G\.angle\|\|0\),\s*(-?)\(G\.dir\|\|1\)/);
    if (mSector && mFeed) {
      const TAU2 = Math.PI * 2;
      const sA = mFeed[1] === '-' ? -1 : 1, sD = mFeed[2] === '-' ? -1 : 1;
      const A = 0.7, D = 1, e = 0.25;             /* a comet mid-lap */
      const head = sA * A, dsign = sD * D;
      const rel = fa => { const x = (head - fa) * dsign; return ((x % TAU2) + TAU2) % TAU2; };
      /* where it WAS a moment ago, and where it is ABOUT to be, both carried
         into uv space by the same y-flip the uniform feed applies */
      const behind = rel(sA * (A - D * e)), ahead = rel(sA * (A + D * e));
      if (!(behind > 0 && behind < 0.5)) {
        fail.push(`the lap sector lights the wrong half of the sky: the arc the comet has just SWEPT measures ${behind.toFixed(3)} rad into the sector `
          + '(wanted just inside it) — the y-down to y-up conversion of G.angle/G.dir is inverted');
      } else if (!(ahead > TAU2 - 0.5)) {
        fail.push(`the lap sector lights the wrong half of the sky: the arc the comet has NOT reached measures ${ahead.toFixed(3)} rad into the sector `
          + '(wanted the far end of it) — the y-down to y-up conversion of G.angle/G.dir is inverted');
      } else {
        note.push(`lap sector: swept arc at ${behind.toFixed(2)} rad, unswept at ${ahead.toFixed(2)} rad — it lights the sky behind the comet`);
      }
    } else fail.push('the lap sector or its uOrb2 feed did not parse — which half of the sky it lights cannot be verified');

    if (mOrbit && mGate && mGateMix && mStruct && mCov && mMot && WORLDS) {
      const [OMEGA, CX2, AX, CY2, AY] = [+mOrbit[1], +mOrbit[2], +mOrbit[3], +mOrbit[4], +mOrbit[5]];
      const [GF0, GF1] = [+mGate[1], +mGate[2]];
      const [COV, EXP] = [+mCov[1], +mCov[2]];
      const MOT = +mMot[1];
      const fract = x => x - Math.floor(x);
      const h21 = (px, py) => { let x = fract(px * 123.34), y = fract(py * 345.45); const d = x * (x + 34.345) + y * (y + 34.345); x += d; y += d; return fract(x * y); };
      const vn = (px, py) => { const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy; const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1); return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy; };
      const wrp = (px, py) => [1.62 * px + 1.18 * py, -1.18 * px + 1.62 * py];
      const fbmN = (px, py, n) => { let v = 0, a = 0.5; for (let i = 0; i < n; i++) { v += a * vn(px, py); [px, py] = wrp(px, py); a *= 0.5; } return v; };
      const rid = (px, py) => { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { const n2 = 1 - Math.abs(vn(px, py) * 2 - 1); v += a * n2 * n2; [px, py] = wrp(px, py); a *= 0.5; } return v; };
      const ss = (a, b, x) => { const t2 = Math.min(1, Math.max(0, (x - a) / (b - a))); return t2 * t2 * (3 - 2 * t2); };
      /* THE PORT NOW TAKES THE WORLD AS AN ARGUMENT, exactly as the shader
         takes it as uniforms. Everything below the structure blend is
         unchanged from the chain that was calibrated against the historical
         look; what is new is that `bill` is no longer the only thing the mass
         can be made of. At WORLDS[0] (DRIFT) with its 0.70/0.30/0/0 weights
         this reduces to very nearly the old expression, which is deliberate:
         the opening sky had to survive the overhaul unchanged. */
      const lumAt = (u, v, drx, dry, W) => {
        const px = u * 1.35, py = v * 1.35;
        const q = [fbmN(px + drx, py + dry, 6), fbmN(px + 5.2 - drx, py + 1.3 - dry, 6)];
        const r = [fbmN(px + 3.2 * q[0] + 1.7 + drx * 1.7, py + 3.2 * q[1] + 9.2 + dry * 1.7, 6),
                   fbmN(px + 3.2 * q[0] + 8.3 - drx * 1.3, py + 3.2 * q[1] + 2.8 - dry * 1.3, 6)];
        const f = fbmN(px + 3.0 * r[0] + drx * 0.6, py + 3.0 * r[1] + dry * 0.6, 6);
        const p2x = u * 0.62 + 3.7, p2y = v * 0.62 + 1.1;
        const q2x = fbmN(p2x - drx * 0.5, p2y - dry * 0.5, 4), q2y = fbmN(p2x + 2.1 + drx * 0.4, p2y + 7.4 + dry * 0.4, 4);
        const f2 = fbmN(p2x + 2.4 * q2x, p2y + 2.4 * q2y, 4);
        const rg = rid(px * 1.6 + r[0] * 1.2 + drx, py * 1.6 + r[1] * 1.2 + dry);
        const dust = Math.pow(rg, 2.2);
        /* the four structures — cont is a LEVEL SET of the two fBm fields and
           costs no evaluation, which is the whole reason a world can be
           curtains instead of clouds for free */
        const bill = ss(0.32, 0.68, f) * 0.82 + ss(0.26, 0.97, f) * 0.18;
        const broad = ss(0.36, 0.76, f2);
        const cont = Math.pow(Math.abs(Math.sin((f * 2.4 + f2 * 1.1) * Math.PI * W.contF + v * W.contY)), W.contK);
        const fil = Math.pow(rg, W.filK);
        let band = bill * W.bill + broad * W.broad + cont * W.cont + fil * W.fil;
        band *= W.gain;
        band *= (1 - W.lane * dust);
        const covA = fbmN(u * 0.75 + 9.1 + drx * 0.35, v * 0.75 + 4.4 + dry * 0.35, 4);
        const covB = fbmN(u * 1.9 + 2.7 - drx * 0.5, v * 1.9 + 8.8 - dry * 0.5, 4);
        const gate = GF0 + GF1 * ss(COV, COV + 0.20, covA - 0.18 * (covB - 0.5));
        band *= 1 + (gate - 1) * W.cov;                       /* mix(1,gate,cov) */
        return Math.pow(Math.min(1, Math.max(0, band)), EXP);
      };
      /* one sweep of the drift orbit for one world */
      const sweep = (W, steps, gx0, gy0) => {
        let worst = 1e9, worstTh = 0, best = 0, msum = 0;
        for (let i = 0; i < steps; i++) {
          const th = (i / steps) * 2 * Math.PI;
          const drx = CX2 + Math.sin(th) * AX, dry = CY2 + Math.cos(th) * AY;
          let lum = 0;
          for (let gy = 0; gy < gy0; gy++) for (let gx = 0; gx < gx0; gx++) {
            lum += lumAt((-0.5 + (gx + 0.5) / gx0) * (390 / 844), -0.5 + (gy + 0.5) / gy0, drx, dry, W);
          }
          lum /= gx0 * gy0;
          msum += lum;
          if (lum < worst) { worst = lum; worstTh = th; }
          if (lum > best) best = lum;
        }
        return { worst, worstTh, best, mean: msum / steps };
      };
      /* THE OPENING SKY KEEPS THE FULL-FIDELITY SWEEP it was calibrated with
         — 96 stations x 128 samples — because its bands are the historical
         measurements and changing the sampling would change what they mean.
         Every other world is swept coarser, which is the right trade: those
         bands are new, and what they are guarding is "no world in the table
         blacks out or floods", not a specific remembered look. */
      const drift = sweep(WORLDS[0], 96, 8, 16);
      const worst = drift.worst, worstTh = drift.worstTh, mean = drift.mean;
      /* EVERY WORLD IS SWEPT, and so is the midpoint of every morph between
         adjacent worlds — the sky spends a fifth of its life in those, and a
         blend of two safe worlds is not automatically a safe world. */
      const states = [];
      for (let i = 0; i < WORLDS.length; i++) {
        states.push({ n: WORLDS[i].n, W: WORLDS[i] });
        const A = WORLDS[i], B = WORLDS[(i + 1) % WORLDS.length];
        /* NOT JUST THE MIDPOINT. The first cut of this sampled t=0.5 only,
           and the transition it was built to catch does not peak there: the
           TIDE>EMBERFALL morph measured 0.238 mean against 0.166 and 0.164 at
           its two ends, because the structure weights and the gain cross over
           at different rates. A blend of two safe worlds is not a safe world,
           and a blend sampled at one point is not a swept blend. */
        for (const t of [0.25, 0.5, 0.75]) {
          const M = {};
          for (const k of Object.keys(A)) M[k] = (typeof A[k] === 'number') ? A[k] + (B[k] - A[k]) * t : A[k];
          states.push({ n: `${A.n}>${B.n}@${t}`, W: M });
        }
      }
      const bad = [];
      for (const s of states) {
        const r2 = sweep(s.W, 24, 6, 12);
        s.r = r2;
        /* THE SAME THREE FAILURES, FOR EVERY SKY IN THE SET, AND THE BANDS
           ARE SET FROM THE MEASUREMENT — the lesson from the ceiling that was
           tuned by feel at 0.20 and waved through the exact 0.1918 bug it
           existed to catch. Swept range at the time of writing: mean
           0.140-0.199, darkest 0.047-0.100.
           These are LOOSER than the anchor's, on purpose, and the split is
           the point. DRIFT is checked below against the historical numbers to
           four decimals because it is the sky that shipped and is not allowed
           to drift. These bands guard a different property for the other
           five: no world in the table, and no morph between two of them,
           blacks out or floods. A world that is brighter or fuller than DRIFT
           is a world, not a regression — that is what the owner asked for. */
        if (r2.worst < 0.020) bad.push(`${s.n} goes dark (darkest ${r2.worst.toFixed(4)})`);
        else if (r2.mean > 0.235 || r2.mean < 0.105) bad.push(`${s.n} left the band (mean ${r2.mean.toFixed(4)})`);
        else if (r2.worst > 0.125) bad.push(`${s.n} never rests (darkest ${r2.worst.toFixed(4)})`);
      }
      if (bad.length) {
        fail.push(`the set of skies is not safe end to end: ${bad.join('; ')} — every world and every morph between two worlds is swept over the full drift orbit, and both directions are pinned because each has shipped broken once`);
      } else {
        const means = states.map(s => s.r.mean), wors = states.map(s => s.r.worst);
        note.push(`${states.length} skies swept over the full drift orbit (${WORLDS.length} worlds x 3 morph samples): `
          + `mean ${Math.min(...means).toFixed(3)}-${Math.max(...means).toFixed(3)}, darkest ${Math.min(...wors).toFixed(3)}-${Math.max(...wors).toFixed(3)}`);
      }
      /* BOTH DIRECTIONS ARE PINNED, because each has now shipped broken once.
         Too dark: the blackout epochs, 0.0000 for ten minutes. Too bright:
         the first orbit swept lush territory under a 0.42 gate floor and the
         sky came out ~3x the historical look — a glowing frame around the
         arena, which a one-sided floor check waved through. The bands are the
         historical healthy statistics (mean 0.142, dips 0.028, peaks 0.268)
         with margin either side. */
      if (worst < 0.03) {
        fail.push(`the sky goes dark: darkest point of the drift orbit has mean nebula luminance ${worst.toFixed(4)} `
          + `(orbit mean ${mean.toFixed(4)}) — the old blackouts read 0.0000 for 10+ minutes; the historical look never dipped under 0.028`);
      } else if (mean > 0.17 || mean < 0.10) {
        /* 0.17, not 0.20: the first cut of this ceiling was tuned by feel and
           the exact bug it existed to catch — the 0.42 gate floor — produced
           mean 0.1918 and sailed under it. Bands must be set from the failure
           they guard against, measured, not from a round number. */
        fail.push(`the sky's brightness left the historical band: orbit mean ${mean.toFixed(4)} against the look's 0.142 `
          + '— "never black" must not be bought by flooding the sky with light, nor the reverse');
      } else if (worst > 0.07) {
        /* the beloved look RESTS: its healthy epochs dip to 0.028-0.05, and
           real darkness is part of the composition. An orbit whose darkest
           point is still bright means a floor or territory change abolished
           the quiet stretches — the milky-sky failure from the other side. */
        fail.push(`the sky never rests: the darkest point of the orbit is ${worst.toFixed(4)}, `
          + 'but the historical look dips to 0.028-0.05 — its darkness is part of the composition');
      } else {
        note.push(`sky over the full orbit: darkest ${worst.toFixed(4)}, mean ${mean.toFixed(4)} — matches the historical look (lap ${Math.round(2 * Math.PI / (OMEGA * MOT))}s)`);
      }
    } else if (mOrbit && mGate && mGateMix && mStruct && WORLDS) {
      /* narrowed: every other way in here already pushed its own precise
         message, and adding this one on top of them reported a constants
         problem for a structural change */
      fail.push('GL_COV/GL_EXP/GL_MOTION constants no longer parse — the sky sweep cannot run');
    }
  }
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
