/* Minimal recording host for rendering-isolation checks. No gameplay fixture. */
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { seededMath } from './rng.mjs';

export function flightSandbox(source, seed, { reducedMotion = false, flightEnabled = true } = {}) {
  let now = 0, randomCalls = 0, nodeId = 0, audioCalls = 0;
  const audio = createHash('sha256'), store = {}, listeners = {};
  const record = (...args) => { audio.update(JSON.stringify(args)); audioCalls++; };
  const param = (initial = 0, label = '') => {
    let value = initial;
    const p = {};
    Object.defineProperty(p, 'value', { get: () => value, set: v => { value = v; record(label, 'value', v); } });
    for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      p[method] = (...args) => { value = args[0]; record(label, method, ...args); return p; };
    }
    for (const method of ['cancelScheduledValues', 'cancelAndHoldAtTime']) p[method] = (...args) => { record(label, method, ...args); return p; };
    return p;
  };
  const audioNode = kind => {
    const id = ++nodeId, n = { type: '', buffer: null, loop: false, curve: null, oversample: '' };
    record('create', kind, id);
    for (const key of ['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release', 'playbackRate']) n[key] = param(key === 'gain' ? 1 : 0, `${id}:${key}`);
    for (const method of ['connect', 'disconnect', 'start', 'stop']) n[method] = (...args) => { record(id, method, ...args.map(x => typeof x === 'object' ? 'node' : x)); return n; };
    return n;
  };
  class AudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = audioNode('destination'); }
    get currentTime() { return now / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  }
  for (const kind of ['Gain', 'Oscillator', 'BufferSource', 'BiquadFilter', 'DynamicsCompressor', 'WaveShaper', 'Convolver', 'StereoPanner', 'Delay']) AudioContext.prototype[`create${kind}`] = () => audioNode(kind);
  const ctx = () => new Proxy({}, {
    get(t, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'measureText') return () => ({ width: 50 });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'canvas') return {};
      return t[key] ?? (() => {});
    }, set(t, key, value) { t[key] = value; return true; }
  });
  const canvas = () => ({ width: 390, height: 844, style: {}, getContext: kind => kind === '2d' ? ctx() : null,
    addEventListener: (key, fn) => { (listeners[key] ??= []).push(fn); }, removeEventListener() {} });
  const cv = canvas();
  const math = seededMath(seed);
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [1_800_000_000_000 + now])); }
    static now() { return 1_800_000_000_000 + now; }
  }
  const sandbox = {
    document: { hidden: false, getElementById: id => id === 'c' ? cv : {}, createElement: canvas,
      head: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
    navigator: { userAgent: 'flightcheck', platform: 'X', maxTouchPoints: 0 },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { origin: 'https://flightcheck.test', pathname: '/', search: '' },
    performance: { now: () => now }, matchMedia: () => ({ matches: reducedMotion }),
    getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {},
    Math: new Proxy(math, { get: (m, k) => k === 'random' ? () => { randomCalls++; return m.random(); } : m[k] }),
    console, JSON, Date: ClockDate, Array, Object, Number, String, Boolean, Float32Array,
    Infinity, NaN, isNaN, parseInt, parseFloat,
  };
  sandbox.window = new Proxy(sandbox, { get(t, key) {
    if (key === 'innerWidth') return 390;
    if (key === 'innerHeight') return 844;
    if (key === 'devicePixelRatio') return 1;
    if (key === 'AudioContext') return AudioContext;
    if (key === 'addEventListener' || key === 'removeEventListener') return () => {};
    return t[key];
  } });
  let lastFlightFrame = null, flightFrames = 0;
  sandbox.__HOST = { externalLoop: true, externalLifecycle: true, canvas: cv, context: ctx(), width: 390, height: 844, dpr: 1,
    flightEnabled, renderFlight(frame) { lastFlightFrame = frame; flightFrames++; } };
  vm.createContext(sandbox);
  const start = source.indexOf('// @runtime-body:start'), end = source.indexOf('// @runtime-body:end');
  if (start < 0 || end <= start) throw new Error('Canonical runtime body markers are missing');
  const body = 'const host = __HOST;\n' + source.slice(source.indexOf('\n', start) + 1, end);
  vm.runInContext(body, sandbox, { filename: 'flight-runtime.js' });
  const run = code => vm.runInContext(code, sandbox, { timeout: 5000 });
  return {
    run,
    step(ms = 1000 / 60) { now += ms; run(`runtimeStep(${ms})`); },
    render() { run('runtimeRender()'); const error = run('window.__drawErr ? String(window.__drawErr) : null'); if (error) throw new Error(error); },
    flightFrame() { return run('typeof runtimeFlightFrame === "function" ? runtimeFlightFrame() : null'); },
    get flightFrames() { return flightFrames; },
    get lastFlightFrame() { return lastFlightFrame; },
    state() { return run('JSON.stringify({G,PLAY,MU,BH,FIN,PAUSE,pd,SWIPE_MODE,CH,CHOFF,PENT,RADII,COL,SKY,RINGS,LV,UPG,TIERS,WORLDS})'); },
    fingerprint() { return { state: this.state(), rng: randomCalls, audio: audio.copy().digest('hex'), audioCalls, store: JSON.stringify(store) }; },
    functionHash(name) { return createHash('sha256').update(run(`${name}.toString()`)).digest('hex'); },
  };
}
