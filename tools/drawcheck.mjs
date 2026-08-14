/* @lane fast */
/* THE 2D DRAW PATH, WHICH EVERY OTHER HARNESS DELETES.

   `fxcheck.mjs` exists because a mistyped uniform name makes WebGL's
   getUniformLocation return null and every write through it a silent no-op —
   one typo, one effect gone, nothing anywhere fails. That reasoning was never
   applied to the 2D canvas, and the 2D canvas is where this game actually
   draws: 852 `ctx.` calls against 107 `GL.` ones. Every harness in this repo
   stubs it as a Proxy that returns a no-op function for every method, so all
   852 vanish into it and `ctx.arc(NaN, NaN, r, 0, TAU)` is indistinguishable
   from a correct draw.

   The canvas is FULL of silent failures, and that is the point — it is
   specified to swallow bad input rather than throw:

     - A non-finite coordinate makes the operation do nothing. No error.
     - An unparseable colour ('rgba(255,0,NaN,1)') leaves fillStyle at its
       PREVIOUS value, so the shape draws in whatever colour the last one used.
       That is the worst of the set: it looks like a styling bug, it reads as
       correct in review, and it is a NaN two hundred lines away.
     - globalAlpha outside 0..1 is ignored, keeping the old alpha.
     - An unbalanced save() leaks clip, transform and alpha into every
       subsequent frame, so the drift builds up over a run and reads as "the
       game slowly goes wrong" rather than as one bad line.

   And a NEGATIVE RADIUS is the opposite trap: `arc()` and
   `createRadialGradient()` THROW IndexSizeError in a real browser, but the
   no-op stub returns undefined happily — so a harness can be green on a build
   that throws on its first frame for every actual player.

   So this stubs the context as a RECORDING FAKE instead of removing it, in
   fxcheck's idiom: it validates arguments the way a browser would, counts what
   was issued, and asserts on it. It does not check that the picture is
   beautiful. It checks that the drawing commands are ones a real canvas would
   honour, which is the part no human review catches and no other check here
   can see. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { seededMath, seedLine } from './lib/rng.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1];

const bad = [];            /* every violation, with the call that caused it */
const seen = new Set();    /* dedupe: one frame can repeat a fault 60 times */
let ops = 0, saveDepth = 0, maxDepth = 0, phase = 'load';
const saveSites = [];
const TRACE = !!process.env.DRAWCHECK_TRACE;
const drawn = new Map();   /* phase -> draw-op count */

/* THE CALL SITE IS THE WHOLE REPORT. "a non-finite coordinate happened" is not
   actionable in an 11,500-line file; "line 7304" is. The stack is walked for
   the first frame inside index.html, and violations are grouped BY SITE rather
   than by value — one bad line runs sixty times a second and would otherwise
   bury every other finding under identical noise. */
/* The vm compiles the SCRIPT BODY, so its line numbers start at 1 inside the
   <script> block and are off by the length of the head. A line number that is
   confidently wrong is worse than none — it sends the reader to an unrelated
   function — so the offset is measured from the file rather than hardcoded. */
const SCRIPT_LINE0 = html.slice(0, html.indexOf(src)).split('\n').length;
function site() {
  const s = new Error().stack || '';
  const m = s.match(/index\.html:(\d+):\d+/);
  return m ? `index.html:${SCRIPT_LINE0 + (+m[1]) - 1}` : 'unknown site';
}
function flag(kind, detail, atOverride) {
  const at = atOverride || site();
  const key = `${kind}|${at}`;
  if (seen.has(key)) { bad.find(b => b.key === key).n++; return; }
  seen.add(key);
  bad.push({ key, kind, detail, phase, at, n: 1 });
}

/* Numeric argument positions per method, and which of them a real canvas
   requires to be non-negative. Anything not listed here is not geometry and
   is not checked — the table is deliberately explicit rather than "every
   number anywhere", so a new method is a decision instead of a silent pass. */
const GEOM = {
  moveTo: [0, 1], lineTo: [0, 1], rect: [0, 1, 2, 3], roundRect: [0, 1, 2, 3],
  fillRect: [0, 1, 2, 3], strokeRect: [0, 1, 2, 3], clearRect: [0, 1, 2, 3],
  arc: [0, 1, 2, 3, 4], arcTo: [0, 1, 2, 3, 4], ellipse: [0, 1, 2, 3, 4, 5, 6],
  quadraticCurveTo: [0, 1, 2, 3], bezierCurveTo: [0, 1, 2, 3, 4, 5],
  translate: [0, 1], rotate: [0], scale: [0, 1],
  transform: [0, 1, 2, 3, 4, 5], setTransform: [0, 1, 2, 3, 4, 5],
  createLinearGradient: [0, 1, 2, 3], createRadialGradient: [0, 1, 2, 3, 4, 5],
  fillText: [1, 2], strokeText: [1, 2],
};
/* Radii. A browser throws IndexSizeError on a negative one; the no-op stub
   every other harness uses returns undefined and the run stays green. */
const RADII = { arc: [2], ellipse: [2, 3], arcTo: [4], createRadialGradient: [2, 5], roundRect: [4] };
const DRAW_OPS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage',
                          'fillText', 'strokeText', 'putImageData']);
/* Numeric state. Assigning a non-finite value to any of these is ignored by a
   real canvas, so the old value silently persists. */
const NUM_PROPS = new Set(['globalAlpha', 'lineWidth', 'shadowBlur', 'shadowOffsetX',
                           'shadowOffsetY', 'miterLimit', 'lineDashOffset']);
const COLOR_PROPS = new Set(['fillStyle', 'strokeStyle', 'shadowColor']);

const badColor = v => typeof v === 'string' && /NaN|undefined|Infinity|null/.test(v);

function ctx2d(canvas) {
  const gradient = {
    addColorStop(off, col) {
      if (!Number.isFinite(off)) flag('gradient-stop-offset', `addColorStop(${off})`);
      if (badColor(col)) flag('gradient-stop-colour', `addColorStop(_, '${col}')`);
    },
  };
  const target = {};
  return new Proxy(target, {
    get(t, k) {
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return () => ({ width: 50 });
      if (typeof k !== 'string') return undefined;
      if (t[k] !== undefined && typeof t[k] !== 'function') return t[k];
      return (...a) => {
        const idx = GEOM[k];
        if (idx) {
          for (const i of idx) {
            if (i < a.length && !Number.isFinite(a[i])) {
              flag('non-finite-coordinate', `${k}(): argument ${i} was ${a[i]}`);
            }
          }
          for (const i of (RADII[k] || [])) {
            if (i < a.length && Number.isFinite(a[i]) && a[i] < 0) {
              flag('negative-radius', `${k}(): radius argument ${i} was ${a[i]} — a real browser throws IndexSizeError here`);
            }
          }
        }
        if (k === 'drawImage') {
          for (let i = 1; i < a.length; i++) {
            if (!Number.isFinite(a[i])) flag('non-finite-coordinate', `drawImage(): argument ${i} was ${a[i]}`);
          }
        }
        if (k === 'setLineDash' && Array.isArray(a[0])) {
          for (const n of a[0]) if (!Number.isFinite(n)) flag('non-finite-coordinate', `setLineDash([… ${n} …])`);
        }
        /* The outstanding save()'s OWN call site is kept, because the
           imbalance is only detectable at the frame boundary and reporting it
           there names frame() — true and useless. What the reader needs is the
           save() that never got its restore(). */
        /* TRACE IS OFF BY DEFAULT AND THAT IS A MEASURED DECISION. Capturing a
           stack on every save() is ~66,000 Error objects per run and took this
           harness from 2.0s to 34.7s — seventeen times slower, which would have
           moved it straight out of the fast lane and defeated its own purpose.
           The imbalance is still DETECTED without tracing; only the exact line
           needs the stack, and the message says how to get it. */
        if (k === 'save') { saveDepth++; if (TRACE) saveSites.push(site()); maxDepth = Math.max(maxDepth, saveDepth); }
        if (k === 'restore') {
          saveDepth--; if (TRACE) saveSites.pop();
          if (saveDepth < 0) {
            flag('restore-without-save', 'ctx.restore() ran with no matching save() — '
              + 'state from before this frame is now live');
            saveDepth = 0;
          }
        }
        if (DRAW_OPS.has(k)) { ops++; drawn.set(phase, (drawn.get(phase) || 0) + 1); }
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return gradient;
        return undefined;
      };
    },
    set(t, k, v) {
      if (NUM_PROPS.has(k)) {
        if (!Number.isFinite(v)) {
          flag('non-finite-state', `ctx.${k} = ${v} — a real canvas ignores this and keeps the previous value`);
        } else if (k === 'globalAlpha' && (v < 0 || v > 1)) {
          flag('alpha-out-of-range', `ctx.globalAlpha = ${v} — ignored by a real canvas, previous alpha persists`);
        } else if (k === 'lineWidth' && v <= 0) {
          flag('non-positive-linewidth', `ctx.lineWidth = ${v} — ignored by a real canvas`);
        }
      }
      if (COLOR_PROPS.has(k) && badColor(v)) {
        flag('unparseable-colour', `ctx.${k} = '${v}' — a real canvas REJECTS this and keeps `
          + 'the previous colour, so the shape draws in whatever was set last');
      }
      t[k] = v;
      return true;
    },
  });
}

/* ---- the rest of the DOM, as smoke.mjs stubs it. Audio stays off: this
   harness is about pixels, and leaving WebAudio out keeps it fast and
   exercises the audio guards on the way past. ---- */
const calls = { raf: [] };
const listeners = {};
function makeCanvasEl() {
  const el = {
    width: 0, height: 0, style: {},
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  };
  el.getContext = kind => (kind === '2d' ? ctx2d(el) : null);   /* no WebGL: the 2D
      fallback path is the one being measured, and it is the path every player
      without a working GPU actually gets */
  return el;
}
const canvasEl = makeCanvasEl();
const safeEl = {};
const doc = {
  getElementById: id => (id === 'c' ? canvasEl : safeEl),
  createElement: () => makeCanvasEl(),
  addEventListener: (ev, fn) => { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
  head: { appendChild() {} },
  hidden: false,
};
const store = {};
let vw = 390, vh = 844, nowMs = 0;
const sandbox = {
  document: doc,
  window: null,
  navigator: { userAgent: 'drawcheck', platform: 'X', maxTouchPoints: 0 },
  localStorage: {
    getItem: k => (store[k] === undefined ? null : store[k]),
    setItem: (k, v) => { store[k] = String(v); },
  },
  performance: { now: () => nowMs },
  requestAnimationFrame: fn => { calls.raf.push(fn); },
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
  location: { origin: 'https://x.test', pathname: '/', search: '', replace() {} },
  console,
  Math: seededMath(), JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
  isNaN, parseInt, parseFloat, setTimeout: () => {},
};
sandbox.window = new Proxy(sandbox, {
  get(t, k) {
    if (k === 'innerWidth') return vw;
    if (k === 'innerHeight') return vh;
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
try {
  vm.runInContext(src, sandbox, { filename: 'index.html' });
} catch (e) {
  console.error('LOAD FAILED:', e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
const st = expr => vm.runInContext(expr, sandbox);
console.log(seedLine('drawcheck'));
function frame(ms) {
  nowMs += ms;
  const fns = calls.raf.splice(0);
  if (!fns.length) throw new Error('no rAF pending');
  for (const fn of fns) fn(nowMs);
  /* SAVE/RESTORE IS CHECKED PER FRAME, not once at the end. A frame that
     leaks one save() and a frame that leaks a thousand look identical in a
     final total, and the leak is what carries clip and transform state into
     the NEXT frame — so the frame boundary is the only place the question
     means anything. */
  if (saveDepth !== 0) {
    const where = saveSites[0] || (TRACE ? 'unknown site'
      : 're-run with DRAWCHECK_TRACE=1 for the exact save() line');
    flag('unbalanced-save', `a frame ended ${saveDepth} save() deep — its clip, transform and `
      + 'alpha leak into every frame after it', where);
    saveDepth = 0; saveSites.length = 0;
  }
}
function fire(name, ev) { for (const fn of (listeners[name] || [])) fn(ev); }
const pev = (id, x, y, type) => ({
  pointerId: id, clientX: x, clientY: y, type: type || 'pointerup', preventDefault() {},
});

/* THE FRONT SCREENS. This is the FIFTH harness on that route, and it presses
   the controls the draw pass publishes rather than tapping a fixed point —
   for the reason the other four record: a harness that taps a coordinate does
   not fail on an unexpected screen, it waits there forever. */
function pressRect(pid, expr, what) {
  for (let i = 0; i < 30; i++) frame(16.7);
  const r = JSON.parse(st(expr) || 'null');
  if (!r) throw new Error(`no ${what} control was drawn`);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
  fire('pointerup', { ...pev(pid, x, y, 'pointerup'), type: 'pointerup' });
  return pid + 1;
}
function passSwipeChooser(pid) {
  if (st('G.state') !== 'swipesel') return pid;
  pid = pressRect(pid, 'JSON.stringify(G.selRects.find(x=>x.id==="play")||null)', 'swipe-chooser PLAY');
  if (st('G.state') === 'swipesel') throw new Error('PLAY did not leave the swipe chooser');
  return pid;
}
function passPowerSelect(pid) {
  if (st('G.state') !== 'powersel') return pid;
  pid = pressRect(pid, 'JSON.stringify(G.powSelRects.find(x=>x.id==="start")||null)', 'powerup-picker START');
  if (st('G.state') === 'powersel') throw new Error('START did not leave the powerup picker');
  return pid;
}
function passMenu(pid) {
  if (st('G.state') !== 'menu') return pid;
  pid = pressRect(pid, 'JSON.stringify(G.menuRects.find(x=>x.id==="start")||null)', 'menu START');
  if (st('G.state') === 'menu') throw new Error('START did not leave the title screen');
  return pid;
}
function passLevelSelect(pid) {
  if (st('G.state') !== 'levelsel') return pid;
  pid = pressRect(pid, 'JSON.stringify(G.lvSelRects.find(x=>x.id==="start")||null)', 'level-picker START');
  if (st('G.state') === 'levelsel') throw new Error('START did not leave the level picker');
  return pid;
}

phase = 'menu';
for (let i = 0; i < 240; i++) frame(16.7);
let pid = passMenu(300);
pid = passSwipeChooser(pid);
pid = passPowerSelect(pid);
pid = passLevelSelect(pid);
phase = 'card';
for (let i = 0; i < 60; i++) frame(16.7);
fire('pointerdown', pev(1, 200, 400, 'pointerdown'));
fire('pointerup', pev(1, 200, 400, 'pointerup'));
for (let i = 0; i < 30; i++) frame(16.7);
if (st('G.state') !== 'playing') throw new Error('never reached a run, state=' + st('G.state'));

/* Play long enough to meet the things that draw rarely: tier banners, orbs,
   the build meter paying out, popups, the trail at length. Input is driven so
   the run is not a comet flying in a straight line past everything. */
phase = 'play';
for (let i = 0; i < 2400; i++) {
  frame(16.7);
  if (i % 90 === 0) {                       /* a tap: reverse */
    fire('pointerdown', pev(100 + i, 200, 400, 'pointerdown'));
    fire('pointerup', pev(100 + i, 200, 400, 'pointerup'));
  }
  if (i % 210 === 0) {                      /* a swipe: change ring */
    fire('pointerdown', pev(900 + i, 200, 400, 'pointerdown'));
    fire('pointermove', { pointerId: 900 + i, clientX: 200, clientY: 340, type: 'pointermove' });
    fire('pointerup', pev(900 + i, 200, 340, 'pointerup'));
  }
}
/* A landscape phone, because the arena is an ellipse and the layout maths
   differs enough that a NaN can live on one orientation only. */
phase = 'landscape';
vw = 844; vh = 390;
fire('win:resize', {});
for (let i = 0; i < 300; i++) frame(16.7);

/* And the death screen, which draws a scrim, the headline and the share row —
   a pass nothing else in this file has exercised. */
phase = 'death';
st('G.shields=0');
for (let i = 0; i < 900 && st('G.state') === "'playing'".slice(1, -1); i++) frame(16.7);
for (let i = 0; i < 240; i++) frame(16.7);

/* ---- report ---- */
const total = [...drawn.values()].reduce((a, b) => a + b, 0);
console.log(`phases drawn: ${[...drawn].map(([p, n]) => `${p}:${n}`).join('  ')}`);
console.log(`${total} draw operations issued, max save() depth ${maxDepth}`);

const fail = [];
/* A FLOOR ON EVERY PHASE, because "no violations" is also what a harness that
   drew nothing at all reports. Each of these screens is a full-screen picture;
   a phase in the low hundreds means the run never got there and the checks
   above were grading an empty canvas. */
for (const p of ['menu', 'play', 'landscape', 'death']) {
  const n = drawn.get(p) || 0;
  if (n < 200) fail.push(`the '${p}' phase issued only ${n} draw operations — nothing was rendered there, `
    + 'so every assertion in this file passed by looking at an empty canvas');
}
for (const b of bad) {
  fail.push(`${b.at}  ${b.kind} (x${b.n}, first seen in '${b.phase}')\n        ${b.detail}`);
}

if (fail.length) {
  for (const f of fail) console.error(`FAIL  ${f}`);
  console.error(`\n${fail.length} problem(s). These are all silent in a browser: the canvas `
    + 'ignores what it cannot parse, so the game keeps running and draws the wrong thing.');
  process.exit(1);
}
console.log('DRAWCHECK OK  every 2D draw call is one a real canvas would honour');
