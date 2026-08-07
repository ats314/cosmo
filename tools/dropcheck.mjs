/* Drop-pipeline smoke: same DOM stub as tools/smoke.mjs but WITH a stubbed
   AudioContext, so MU/BED/A exist and the full build -> arm -> rise -> fire ->
   payoff -> cooldown cycle runs. Reproduces the "build meter broken" report. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

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
  console, Math, JSON, Date, Array, Object, Number, String, Boolean, Float32Array,
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
const pev = (id, x, y, type) => ({ pointerId: id, clientX: x, clientY: y, type, preventDefault() {} });

/* boot: menu frame, then tap to start (unlocks audio, builds MU) */
frame(16.7);
fire('pointerdown', pev(1, 200, 420, 'pointerdown'));
fire('pointerup', pev(1, 200, 420, 'pointerup'));
frame(16.7);
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
  if (st('G.state') === 'lvend') {
    fire('pointerdown', pev(9, 200, 420, 'pointerdown'));
    fire('pointerup', pev(9, 200, 420, 'pointerup'));
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
