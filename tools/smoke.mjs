/* Headless smoke test: stub enough DOM/canvas to LOAD the game script, run
   frames, and drive input through the real handlers. Catches TDZ, load-order,
   null-deref and typo errors that a parse check cannot. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1];

const calls = { raf: [] };
function ctx2d() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 50 });
      if (k === 'canvas') return {};
      return (typeof k === 'string') ? (t[k] !== undefined ? t[k] : () => {}) : undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const listeners = {};
function makeCanvasEl() {
  return {
    width: 0, height: 0, style: {},
    getContext: () => ctx2d(),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  };
}
const canvasEl = makeCanvasEl();
const safeEl = {};
const doc = {
  getElementById: id => id === 'c' ? canvasEl : safeEl,
  createElement: tag => makeCanvasEl(),
  addEventListener: (ev, fn) => { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
  head: { appendChild() {} },
  hidden: false,
};
const store = {};
const sandbox = {
  document: doc,
  window: null,
  navigator: { userAgent: 'smoke', platform: 'X', maxTouchPoints: 0 },
  localStorage: {
    getItem: k => store[k] === undefined ? null : store[k],
    setItem: (k, v) => { store[k] = String(v); },
  },
  performance: { now: () => nowMs },
  requestAnimationFrame: fn => { calls.raf.push(fn); },
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
  location: { origin: 'https://x.test', pathname: '/' },
  console,
  Math, JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
  isNaN, parseInt, parseFloat, setTimeout: () => {}, TAU: undefined,
};
sandbox.window = new Proxy(sandbox, {
  get(t, k) {
    if (k === 'innerWidth') return vw;
    if (k === 'innerHeight') return vh;
    if (k === 'devicePixelRatio') return 2;
    if (k === 'addEventListener') return (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
    if (k === 'AudioContext' || k === 'webkitAudioContext') return undefined; // audio off: exercises the guards
    if (k === 'matchMedia') return sandbox.matchMedia;
    if (k === 'localStorage') return sandbox.localStorage;
    if (k === 'navigator') return sandbox.navigator;
    if (k === 'storage') return undefined;
    return t[k];
  },
});
let vw = 390, vh = 844, nowMs = 0;

vm.createContext(sandbox);
try {
  vm.runInContext(src, sandbox, { filename: 'index.html' });
} catch (e) {
  console.error('LOAD FAILED:', e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
console.log('load ok');

function frame(ms) {
  nowMs += ms;
  const fns = calls.raf.splice(0);
  if (!fns.length) throw new Error('no rAF pending');
  for (const fn of fns) fn(nowMs);
}
function fire(name, ev) { for (const fn of (listeners[name] || [])) fn(ev); }
const pev = (id, x, y, type) => ({
  pointerId: id, clientX: x, clientY: y, type: type || 'pointerup', preventDefault() {},
});

try {
  // menu: run 15s of frames so the demo loop cycles (spawn, reverse, hops)
  for (let i = 0; i < 900; i++) frame(16.7);
  console.log('menu+demo ok');
  // start the game with a tap
  fire('pointerdown', pev(1, 200, 400, 'pointerdown'));
  fire('pointerup', pev(1, 200, 400, 'pointerup'));
  for (let i = 0; i < 60; i++) frame(16.7);
  console.log('game start ok');
  // taps (reverse) while playing
  for (let k = 0; k < 5; k++) {
    fire('pointerdown', pev(2, 200, 400, 'pointerdown'));
    for (let i = 0; i < 3; i++) frame(16.7);
    fire('pointerup', pev(2, 200, 400, 'pointerup'));
    for (let i = 0; i < 30; i++) frame(16.7);
  }
  console.log('taps ok');
  // a swipe: down, move 60px radially, lift
  fire('pointerdown', pev(3, 200, 400, 'pointerdown'));
  fire('pointermove', { pointerId: 3, clientX: 200, clientY: 340, type: 'pointermove' });
  fire('pointerup', pev(3, 200, 340, 'pointerup'));
  for (let i = 0; i < 30; i++) frame(16.7);
  // an aborted swipe: out and back, lift near start
  fire('pointerdown', pev(4, 200, 400, 'pointerdown'));
  fire('pointermove', { pointerId: 4, clientX: 200, clientY: 355, type: 'pointermove' });
  fire('pointermove', { pointerId: 4, clientX: 200, clientY: 398, type: 'pointermove' });
  fire('pointerup', pev(4, 200, 398, 'pointerup'));
  console.log('swipes ok');
  // keyboard: hops and reverses
  const kev = c => ({ code: c, preventDefault() {} });
  for (const c of ['ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyS', 'KeyM', 'KeyM']) {
    fire('win:keydown', kev(c));
    for (let i = 0; i < 8; i++) frame(16.7);
  }
  console.log('keyboard ok');
  // run 240s of play at 60fps to cross many tiers (hold releases, sky bands, storm)
  for (let i = 0; i < 14400; i++) frame(16.7);
  console.log('long run ok (4 min simulated)');
  // resize to landscape mid-run, then back
  vw = 844; vh = 390; for (let i = 0; i < 120; i++) frame(16.7);
  vw = 390; vh = 844; for (let i = 0; i < 120; i++) frame(16.7);
  console.log('resize ok');
  // background/foreground the tab
  doc.hidden = true; fire('doc:visibilitychange', {});
  doc.hidden = false; fire('doc:visibilitychange', {});
  for (let i = 0; i < 60; i++) frame(16.7);
  console.log('visibility ok');
  // peek at internal state via the vm
  const st = expr => vm.runInContext(expr, sandbox);
  // the unattended 4-min block already ended in a death; that death's coach:
  console.log('first death; coach =', JSON.stringify(st('G.coach && G.coach.t')),
    'didHop =', st('G.didHop'));
  if (st('G.state') === 'dead') {
    fire('pointerdown', pev(8, 200, 400, 'pointerdown'));  // retry (long past seq)
    fire('pointerup', pev(8, 200, 400, 'pointerup'));
    if (st('G.state') !== 'playing') throw new Error('stale-death retry failed');
  }
  // now drive to a FRESH death and catch it within one frame
  let guard = 0;
  while (st('G.state') !== 'dead' && guard++ < 36000) frame(16.7);
  if (st('G.state') !== 'dead') throw new Error('never died in 10 simulated minutes');
  for (let i = 0; i < 50; i++) frame(16.7);            // 0.83s: inside choreography
  fire('pointerdown', pev(9, 200, 400, 'pointerdown')); // fast-forward tap
  fire('pointerup', pev(9, 200, 400, 'pointerup'));
  if (!st('G.deadSkip')) throw new Error('fast-forward tap did not set deadSkip');
  for (let i = 0; i < 10; i++) frame(16.7);
  fire('pointerdown', pev(10, 200, 400, 'pointerdown')); // retry tap
  fire('pointerup', pev(10, 200, 400, 'pointerup'));
  if (st('G.state') !== 'playing') throw new Error('retry tap did not start a run, state=' + st('G.state'));
  if (st('G.tier') !== 0 || st('skyI') !== 0) throw new Error('tier/sky not reset');
  if (st('pd') !== null) throw new Error('pd leaked into new run');
  for (let i = 0; i < 300; i++) frame(16.7);
  console.log('death->skip->retry ok; struggle =', st('G.struggle'), 'rookie first shard at', st('firstShardAt()').toFixed(1) + 's');
} catch (e) {
  console.error('RUNTIME FAILED:', e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
console.log('SMOKE OK');
