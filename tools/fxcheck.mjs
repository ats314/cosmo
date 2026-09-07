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
  if (st('G.intro')) st('finishIntro()');
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
  const menuSize = st('JSON.stringify([GL.vw,GL.vh])');
  for (let i = 0; i < 60 * 8; i++) frame(8);
  if (st('JSON.stringify([GL.vw,GL.vh])') !== menuSize)
    fail.push('the fixed sky resolution changed during menu frames');

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

  /* NOTHING DEGRADES ANY MORE, AND THAT IS THE ASSERTION.
     This block used to pin a degrade ladder: on a slow stretch the glow was
     retired, then the sky's resolution stepped down with the ceiling latching
     permanently, then the shader was switched off and the baked 2D backdrop
     swapped in mid-run. It was tested carefully and in the wrong direction.
     The ladder is deleted. The owner's target is iPhone 12 and up on the web,
     and the instruction is verbatim: "a struggling device should struggle" —
     "if someones phone cant handle my game, they cant fucking play it, end of
     story". A device in trouble drops frames; it does not get a different
     game. The field report the ladder produced — "it looks good for the
     opening and then 5 seconds in, it changes to the old shit" — was this
     mechanism working exactly as designed.
     So the test is inverted: drive a long slow stretch, far past what used to
     trigger every rung, and assert that NOTHING moved. */
  const fxBefore = st('FX.on'), glBefore = st('GL.on');
  const vpBefore = st('JSON.stringify([GL.vw,GL.vh])');
  for (let i = 0; i < 60 * 10; i++) frame(40);      // 25fps for ten seconds
  if (st('FX.on') !== fxBefore) fail.push('a slow stretch retired the GLOW — the degrade ladder is back');
  if (st('GL.on') !== glBefore) fail.push('a slow stretch killed the SKY — the degrade ladder is back');
  if (st('JSON.stringify([GL.vw,GL.vh])') !== vpBefore) {
    fail.push(`a slow stretch changed the backdrop's resolution (${vpBefore} -> ${JSON.stringify(log.vp)}) — the degrade ladder is back`);
  }
  if (/\bglWatch\b/.test(src)) fail.push('glWatch is back — the degrade ladder was deleted on purpose');
  if (/GL\.(scale|cap)\b/.test(src)) fail.push('GL.scale/GL.cap are back — the render scale is a constant now, not a dial');
  note.push(`ten seconds at 25fps changed nothing: glow ${st('FX.on')}, sky ${st('GL.on')}, viewport ${JSON.stringify(log.vp)}`);
}

/* ============ 1a-ii. ONE EARNED EVENT OWNS THE SKY ============
   Drive the real lap integration, then test the observable event contract.
   Ordinary streaks and beats must not move or brighten the entire scene.
   Higher-value events cannot be interrupted by an ordinary orbit. */
{
  const { log, frame, fire, st } = build({ webgl: true });
  let pid = 1;
  for (let i = 0; i < 60; i++) frame(16.7);
  pid = crossFront(st, frame, fire, pid);
  if (st('G.state') !== 'playing') fail.push('the orbit/sky check could not reach a run');
  else {
    st('G.invuln=G.t+100;G.sceneEvent=null;BH.phase=0;G.lapAcc=0');
    const skyW0 = Number(st('G.skyW'));
    st('G.lapAcc=Math.PI*2-0.001;G.lapEmbers=2');
    frame(16.7);
    const skyW1 = Number(st('G.skyW')), per = Number(st('ORB_PER_WORLD'));
    if (!(skyW1 - skyW0 > 0.9 / per))
      fail.push('a completed orbit no longer advances the world journey');
    if (st('G.sceneEvent&&G.sceneEvent.kind') !== 'orbit')
      fail.push('a completed orbit did not create its earned sky cue');
    st('G.t=G.sceneEvent.at+0.18;glRender(0)');
    const lap = log.val.uAccent;
    if (!lap || lap[1] !== 1 || !(lap[0] > 0 && lap[0] <= 0.12))
      fail.push('the orbit cue did not reach the GPU as a small positive event');

    st("scenePulse('drop',3);G.t+=0.18;glRender(0)");
    if (log.val.uAccent[1] !== 2 || log.val.uAccent[0] < 0.99)
      fail.push('an earned drop did not reach the GPU at full attack');
    st("scenePulse('orbit',1.4);scenePulse('spot',3)");
    if (st('G.sceneEvent.kind') !== 'drop')
      fail.push('a lower-priority pickup or orbit interrupted a live drop');
    st('BH.phase=2;BH.warp=0.8;glRender(0)');
    if (log.val.uAccent[1] !== 4 || Math.abs(log.val.uAccent[0]-0.8)>1e-9)
      fail.push('the black hole did not take exclusive visual priority');
    st('BH.phase=0;G.t=G.sceneEvent.at+G.sceneEvent.span;glRender(0)');
    if (log.val.uAccent[0] !== 0 || log.val.uAccent[1] !== 0)
      fail.push('an expired scene event left light behind');

    for (const kind of ['nova','hyper','spot','warp','mirror','scorch','slip','trail']) {
      st(`G.sceneEvent=null;scenePulse('${kind}',2.5);G.t+=0.18;glRender(0)`);
      if (!(log.val.uAccent[0]>0.99))
        fail.push(`the ${kind} pickup cannot own a visible scene event`);
      if (!log.val.uEventTint.every(Number.isFinite))
        fail.push(`the ${kind} pickup has a non-finite event tint`);
    }
    st("G.sceneEvent=null;scenePulse('nova',2);G.t+=0.5;G.state='dead';glRender(0)");
    if (log.val.uAccent[0] !== 0) fail.push('a scene event continued on the death screen');
    st("G.state='playing';G.sceneEvent={kind:'nova',at:G.started-1,span:1000};glRender(0)");
    if (log.val.uAccent[0] !== 0) fail.push('an event from the previous run survived restart');
    st('G.sceneEvent=null;glRender(0)');
    const quiet = JSON.stringify(log.val.uAccent), arc = JSON.stringify(log.val.uArc);
    st('G.beat=1;G.combo=20;G.lapStreak=50;G.pocket=1;G.dir=-1;glRender(0)');
    if (JSON.stringify(log.val.uAccent)!==quiet || JSON.stringify(log.val.uArc)!==arc)
      fail.push('ordinary beat/streak/pocket state changed the sky composition or event gain');
    note.push('scene priority: black hole > earned peak > pickup > orbit; cues expire, quiet play stays quiet');
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

/* ================= 1d. WORLD MORPHS STAY FINITE AND CONTINUOUS =================
   The old sky's cloned CPU noise renderer pinned its exact historical mass.
   That appearance is deliberately replaced. Real pixel brightness, spacing,
   world distinction and closed-orbit coverage are checked in rendercheck;
   this fast test owns interpolation, clock continuity and live arena geometry. */
{
  const { log, st } = build({ webgl: true });
  const worlds = JSON.parse(st('JSON.stringify(WORLDS)'));
  const scalar = ['x','y','lean','width','bend','reach','grain','star','motion','gain'];
  if (worlds.length !== 8 || new Set(worlds.map(w=>w.n)).size !== worlds.length)
    fail.push('the world journey lost a named destination');
  for (const w of worlds) {
    if (!scalar.every(k=>Number.isFinite(w[k])) ||
        ![...w.tint,...w.rim].every(v=>Number.isFinite(v)&&v>=0&&v<=1))
      fail.push(`world ${w.n} contains invalid shader parameters`);
    if (!(w.width>0 && w.reach>0 && w.motion>0 && w.gain>0 && w.star>=0))
      fail.push(`world ${w.n} has a zero or negative field dimension/gain`);
  }
  const readMix = w => JSON.parse(st(`SKY.w=${w};JSON.stringify(skyMix())`));
  const flat = x => [...x.arc,...x.shape,...x.tint,...x.rim,x.motion,x.star];
  let smallest = Infinity, jump = 0;
  for (let i = 0; i < worlds.length; i++) {
    const held = JSON.stringify(readMix(i));
    if (JSON.stringify(readMix(i+0.79)) !== held)
      fail.push(`world ${worlds[i].n} drifts before its final morph interval`);
    for (let k = 0; k <= 100; k++) {
      const w=i+k/100,m=readMix(w);
      if (!flat(m).every(Number.isFinite) || m.arc[3]<=0 || m.shape[1]<=0)
        fail.push(`world morph ${w} sent invalid field dimensions`);
      st(`G.skyW=${w};glRender(0)`);
      smallest=Math.min(smallest,m.arc[3],m.shape[1]);
    }
    const a=flat(readMix(i+1-1e-7)),b=flat(readMix(i+1));
    jump=Math.max(jump,...a.map((v,k)=>Math.abs(v-b[k])));
  }
  if (jump>1e-8) fail.push(`a world boundary jumps by ${jump}`);
  if (log.badVals.length) fail.push('world morphs sent non-finite values to the GPU');

  st('G.vt=1e7;GL.flowVt=G.vt;GL.tw=4;G.skyW=0;glRender(0)');
  const t0=log.val.uTime[0];
  st('G.skyW=1;glRender(0)');
  if (log.val.uTime[0]!==t0) fail.push('changing a world teleports the scenic clock');
  st('G.vt+=0.1;glRender(0)');
  if (!(log.val.uTime[0]>t0 && log.val.uTime[0]-t0<0.1))
    fail.push('the scenic clock stopped or jumped at a long session time');

  for (const count of [2,3,4,5]) {
    st(`G.nRings=${count};glRender(0)`);
    const actual=log.val.uArena;
    const expected=JSON.parse(st('JSON.stringify([radiusOf(0)/H,radiusOf(G.nRings-1)/H,AY])'));
    if (actual.some((v,i)=>Math.abs(v-expected[i])>1e-10) || actual[0]<actual[1])
      fail.push(`the calm arena band lost ring 0 geometry at ${count} rings`);
  }
  note.push(`8 world morphs: finite dimensions (minimum ${smallest.toFixed(3)}), seamless boundaries, continuous clock and live arena geometry`);
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
