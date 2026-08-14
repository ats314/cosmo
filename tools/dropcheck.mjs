/* @lane full */
/* Drop-pipeline smoke: same DOM stub as tools/smoke.mjs but WITH a stubbed
   AudioContext, so MU/BED/A exist and the full build -> arm -> rise -> fire ->
   payoff -> cooldown cycle runs. Reproduces the "build meter broken" report. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { seededMath, seedLine } from './lib/rng.mjs';
/* PRINTED HERE, BEFORE ANY ASSERTION CAN EXIT. This harness imported
   seedLine and never called it, so the seed CI ran on never reached the
   log — and CI rotates it per run, which made every failure here a
   one-off nobody could reproduce. Both docs promised otherwise. */
console.log(seedLine('dropcheck'));

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1];

let nowMs = 0;
/* ---- WebAudio stub ---- */
function param(v) {
  return { value: v,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {},
    cancelScheduledValues() {} };
}
function node() {
  return { connect() {}, disconnect() {}, start() {}, stop() {},
    gain: param(1), frequency: param(440), detune: param(0), Q: param(1),
    pan: param(0), delayTime: param(0), threshold: param(0), knee: param(0), ratio: param(1),
    attack: param(0), release: param(0), type: '', curve: null, oversample: '',
    buffer: null, loop: false };
}
class FakeAC {
  constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = node(); }
  get currentTime() { return nowMs / 1000; }
  resume() {}
  createGain() { return node(); }
  createOscillator() { return node(); }
  createBufferSource() { return node(); }
  createBiquadFilter() { return node(); }
  createDynamicsCompressor() { return node(); }
  createWaveShaper() { return node(); }
  createConvolver() { return node(); }
  createStereoPanner() { return node(); }
  createDelay() { return node(); }
  createBuffer(ch, len, sr) { return { getChannelData: () => new Float32Array(len) }; }
}

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
  return { width: 0, height: 0, style: {},
    getContext: () => ctx2d(),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); } };
}
const canvasEl = makeCanvasEl();
const doc = {
  getElementById: id => id === 'c' ? canvasEl : {},
  createElement: () => makeCanvasEl(),
  addEventListener: (ev, fn) => { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
  head: { appendChild() {} }, hidden: false,
};
const store = {};
const sandbox = {
  document: doc, window: null,
  navigator: { userAgent: 'smoke', platform: 'X', maxTouchPoints: 0 },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  performance: { now: () => nowMs },
  requestAnimationFrame: fn => { calls.raf.push(fn); },
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
  location: { origin: 'https://x.test', pathname: '/' },
  console, Math: seededMath(), JSON, Date, Array, Object, Number, String, Boolean, Float32Array,
  Infinity, NaN, isNaN, parseInt, parseFloat, setTimeout: () => {},
};
sandbox.window = new Proxy(sandbox, {
  get(t, k) {
    if (k === 'innerWidth') return 390;
    if (k === 'innerHeight') return 844;
    if (k === 'devicePixelRatio') return 2;
    if (k === 'addEventListener') return (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
    if (k === 'AudioContext') return FakeAC;
    if (k === 'webkitAudioContext') return undefined;
    if (k === 'matchMedia') return sandbox.matchMedia;
    if (k === 'localStorage') return sandbox.localStorage;
    if (k === 'navigator') return sandbox.navigator;
    if (k === 'storage') return undefined;
    return t[k];
  },
});
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'index.html' });
const st = e => vm.runInContext(e, sandbox);
function frame(ms) { nowMs += ms; const f = calls.raf.splice(0); for (const fn of f) fn(nowMs); }
function fire(name, ev) { for (const fn of (listeners[name] || [])) fn(ev); }

/* A FRESH DEVICE IS ASKED WHICH SWIPE RULE IT WANTS. Two rules exist now —
   screen-absolute (up is the outer ring) and radial (away from the middle is
   the outer ring) — and they disagree only at the top and bottom of the loop,
   so the choice is made on a live arena rather than described. It sits between
   the menu tap and the level-1 card, once per device. Every harness has to
   press its PLAY control or it simply waits on the screen forever. */
function passSwipeChooser(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'swipesel') return pid;
  for (let i = 0; i < 30; i++) frame(16.7);      // a draw pass fills selRects
  const r = JSON.parse(st('JSON.stringify(G.selRects.find(x=>x.id==="play")||null)') || 'null');
  if (!r) throw new Error('the swipe chooser drew no PLAY control');
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
  fire('pointerup', { ...pev(pid, x, y, 'pointerup'), type: 'pointerup' });
  if (st('G.state') === 'swipesel') throw new Error('PLAY did not leave the swipe chooser');
  return pid + 1;
}
const pev = (id, x, y, type) => ({ pointerId: id, clientX: x, clientY: y, type, preventDefault() {} });

/* THE TITLE SCREEN AND THE LEVEL PICKER, crossed by their real controls. The
   menu's mode cards SELECT rather than start and the level picker starts
   nothing from its background, so a fixed tap now lands on a screen that
   politely does nothing — exactly the way the swipe chooser stalled every
   harness when it arrived. Press the button that is actually drawn. */
function pressRect(st, frame, fire, pev, pid, expr, what) {
  for (let i = 0; i < 30; i++) frame(16.7);
  const r = JSON.parse(st(expr) || 'null');
  if (!r) throw new Error(`no ${what} control was drawn`);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
  fire('pointerup', { ...pev(pid, x, y, 'pointerup'), type: 'pointerup' });
  return pid + 1;
}
function passMenu(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'menu') return pid;
  pid = pressRect(st, frame, fire, pev, pid,
    'JSON.stringify(G.menuRects.find(x=>x.id==="start")||null)', 'menu START');
  if (st('G.state') === 'menu') throw new Error('START did not leave the title screen');
  return pid;
}
function passLevelSelect(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'levelsel') return pid;
  pid = pressRect(st, frame, fire, pev, pid,
    'JSON.stringify(G.lvSelRects.find(x=>x.id==="start")||null)', 'level-picker START');
  if (st('G.state') === 'levelsel') throw new Error('START did not leave the level picker');
  return pid;
}
/* THE POWERUP PICKER. Off the ordinary route — it opens from the title
   screen's POWERUP TESTING bar, which nothing here presses — so this returns
   untouched on every path this harness takes today. It is written anyway,
   because that is exactly what was true of the swipe chooser the day before it
   stalled all four harnesses, and the cost of having it is one function. */
function passPowerSelect(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'powersel') return pid;
  pid = pressRect(st, frame, fire, pev, pid,
    'JSON.stringify(G.powSelRects.find(x=>x.id==="start")||null)', 'powerup-picker START');
  if (st('G.state') === 'powersel') throw new Error('START did not leave the powerup picker');
  return pid;
}

/* boot: menu frame, then cross the front of the game (unlocks audio, builds MU) */
frame(16.7);
let bpid = passMenu(st, frame, fire, pev, 800);
bpid = passSwipeChooser(st, frame, fire, pev, bpid);
bpid = passPowerSelect(st, frame, fire, pev, bpid);
bpid = passLevelSelect(st, frame, fire, pev, bpid);
console.log('MU exists:', !!st('MU'), '| state:', st('G.state'));

/* Deathless drop-cadence regression: feed the meter, hold invulnerability,
   and assert the pipeline actually delivers. Guards the three failure modes
   shipped at one point or another: the frozen meter, the 9-second silent
   latch, and the unreachable second drop. */
let armAt=-1,fireAt=-1,worstLatch=0,fires=0;
let wasArmed=false,wasPay=false;
for (let i = 0; i < 60 * 150; i++) {          /* 150 seconds, no dying */
  if (i % 30 === 0) st('build(0.10,"ember")');
  st('G.invuln=G.t+9');
  /* the level card: an invulnerable 150s run crosses level finish lines —
     tap through so the cadence measurement continues */
  /* the star dive: this invulnerable bot never collects the trail, so
     fast-forward its 45s timeout — cadence, not the dive, is under test */
  if (st('FIN && FIN.on')) st('FIN.t0 = G.t - 51');
  if (st('G.state') === 'lvend') {
    /* the card gates the next level behind an upgrade tile from level 2 on, so
       a fixed tap point simply waits there forever — press the real control */
    let tx = 200, ty = 420;
    if (st('G.offer && G.offer.length ? 1 : 0')) {
      const r = JSON.parse(st('JSON.stringify(G.offerRects[0]||null)') || 'null');
      if (r) { tx = r.x + r.w / 2; ty = r.y + r.h / 2; }
    }
    fire('pointerdown', pev(9, tx, ty, 'pointerdown'));
    fire('pointerup', pev(9, tx, ty, 'pointerup'));
  }
  frame(16.7);
  const armed=st('MU.armed'),pay=st('MU.pay')>0;
  if(armed&&!wasArmed)armAt=nowMs/1000;
  if(pay&&!wasPay){fireAt=nowMs/1000;fires++;
    if(armAt>0)worstLatch=Math.max(worstLatch,fireAt-armAt);armAt=-1;}
  wasArmed=armed;wasPay=pay;
}
const fail=[];
if(st('G.state')!=='playing')fail.push('run ended despite invulnerability: '+st('G.state'));
if(fires<3)fail.push('only '+fires+' drops in 150s of heavy earning (want >=3)');
if(worstLatch>8)fail.push('arm-to-drop latency '+worstLatch.toFixed(1)+'s (want <=8)');
if(st('G.build')<0.2&&st('MU.pay')<=0&&!st('MU.armed')&&!st('MU.rise')&&!st('MU.pend'))
  fail.push('meter empty and idle at end — earnings discarded?');
if(fail.length){for(const f of fail)console.error('FAIL  '+f);process.exit(1);}
console.log('OK  '+fires+' drops in 150s, worst arm-to-drop '+worstLatch.toFixed(1)+'s, meter live');
