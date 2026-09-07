/* @lane full */
/* Drop-pipeline smoke: same DOM stub as tools/smoke.mjs but WITH a stubbed
   AudioContext, so MU/BED/A exist and the full build -> arm -> rise -> fire ->
   payoff -> cooldown cycle runs. Reproduces the "build meter broken" report. */
import { loadGameHtml } from './lib/game-source.mjs';
import vm from 'node:vm';
import { seededMath, seedLine } from './lib/rng.mjs';
/* PRINTED HERE, BEFORE ANY ASSERTION CAN EXIT. This harness imported
   seedLine and never called it, so the seed CI ran on never reached the
   log — and CI rotates it per run, which made every failure here a
   one-off nobody could reproduce. Both docs promised otherwise. */
console.log(seedLine('dropcheck'));

const html = await loadGameHtml();
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
if (st('G.intro')) st('finishIntro()');
bpid = passSwipeChooser(st, frame, fire, pev, bpid);
bpid = passPowerSelect(st, frame, fire, pev, bpid);
bpid = passLevelSelect(st, frame, fire, pev, bpid);
console.log('MU exists:', !!st('MU'), '| state:', st('G.state'));

/* Starfall is earned by star-fed orbits, and its reward begins when the
   scheduled music reaches the listener. Drive real frames for collection,
   wave timing, pause/black-hole suspension and repeated releases. */
function check(ok, message) {
  if (!ok) { console.error('FAIL  ' + message); process.exit(1); }
}
const read = expression => JSON.parse(st('JSON.stringify(' + expression + ')') || 'null');
function resetRun() {
  st("startGame();if(G.intro)finishIntro();G.invuln=G.t+1e9;G.stars=[];G.spikes=[];G.pows=[];" +
    "G.starT=1e9;G.powT=1e9;G.lapEmbers=0;G.lapAcc=0;G.upg={};G.build=0;" +
    "G.sceneEvent=null;G.teach=0;G.teachHint=null;G.started=G.t-15;" +
    "MU.cool=0;MU.pend=null;MU.armed=false;MU.rise=false;MU.pay=0;DROPQ.length=0");
  check(st('G.state') === 'playing' && !st('G.starfall'), 'a fresh run retained Starfall state');
}

resetRun();
check(st('dropNeed()') === 3, 'Starfall does not require three fed orbits');
st("for(let i=0;i<80;i++){build(1,'time');build(1,'ember');build(1,'hop');build(1,'tap');build(.006,'orbit');build(.039,'orbit');}");
for (let i = 0; i < 120; i++) frame(16.7);
check(st('G.build') === 0 && !st('MU.armed||MU.pend||G.starfall'),
  'time, stars, taps, hops or near misses charged Starfall');
for (let i = 1; i <= 2; i++) {
  st("build(.043,'orbit')");
  check(st('G.build') === i && !st('MU.armed||MU.pend||G.starfall'),
    'fed orbit ' + i + ' did not add exactly one charge, or released early');
}
st("build(.043,'orbit')");
check(st('MU.armed||MU.pend') && st('G.dropsEarned') === 1 && !st('G.starfall'),
  'the third fed orbit did not arm exactly one future release');
resetRun();
st("G.upg.hairtrig=1;build(.043,'orbit')");
check(st('dropNeed()') === 2 && st('G.build') === 1 && !st('MU.armed||MU.pend'),
  'the faster-charge upgrade does not leave one orbit still to earn');
st("build(.043,'orbit')");
check(st('MU.armed||MU.pend') && st('G.dropsEarned') === 1,
  'the faster-charge upgrade did not arm on its second fed orbit');
console.log('OK  Starfall charge: three fed orbits, two with upgrade; other sources contribute nothing');

resetRun();
st('MU.landT=AC.currentTime;MU.landDone=0');
const landingScore = st('G.score');
st('tryLand()');
check(st('G.score') === landingScore, 'the retired drop-landing timing bonus still awards points');
check(st('PAY') === 32 && st('PAYREST') === 0, 'Starfall is not a four-bar release without a cooldown tax');
st('G.spikes.push(mkSpike(G.angle+1,0,{life:8}));fireDrop(AC.currentTime+.20)');
check(!st('G.starfall'), 'Starfall started at scheduling time instead of audible time');
for (let i = 0; i < 10; i++) frame(16.7);
check(!st('G.starfall'), 'Starfall started before its scheduled audible onset');
for (let i = 0; i < 6 && !st('G.starfall'); i++) frame(16.7);
check(st('G.starfall'), 'the audible release did not start the gameplay reward');
const first = read('G.starfall'), beganAt = st('G.t');
check(Number.isFinite(first.total) && first.total > 8 && first.total < 11 &&
      Number.isFinite(first.left) && first.left > 0 && first.left <= first.total,
  'Starfall has no finite four-bar gameplay duration');
check(st('G.invuln') > st('G.t') + 1, 'Starfall did not protect the opening blast');
for (let i = 0; i < 45 && st('G.spikes.length'); i++) frame(16.7);
check(st('G.spikes.length') === 0, 'Starfall opening blast did not clear existing hazards');
check(st('G.stars.some(s=>s.starfall)') && first.wave === 1, 'Starfall opened without its first gold-star wave');

/* Place one existing reward just ahead of the comet, then let the ordinary
   swept-contact loop collect it. No direct score or pickup helper is used. */
const gotBefore = st('G.embers'), scoreBefore = st('G.score');
st("const reward=G.stars.find(s=>s.starfall);reward.ring=G.ringI;reward.a=G.angle+G.dir*.004;reward.t=1;G.hopP=1;");
frame(16.7);
check(st('G.embers') > gotBefore && st('G.score') > scoreBefore,
  'a physically collected Starfall star did not award its ordinary pickup reward');
frame(16.7); // the live tally samples collected rewards on the following update
check(st('G.starfall.got') > first.got && st('G.starfall.score') > 0,
  'Starfall did not report its collected reward');

let previous = st('G.starfall.left'), lastWave = 1, waveTimes = [0], expiredAt = null;
for (let i = 0; i < 800 && st('starfallActive()'); i++) {
  st('G.invuln=G.t+9;G.spikeT=-1;G.teach=0');
  frame(16.7);
  const current = read('G.starfall');
  if (!st('starfallActive()')) { expiredAt = st('G.t'); break; }
  check(st('G.state') === 'playing', 'the Starfall wave probe left the live run');
  check(Number.isFinite(current.left) && current.left > 0 && current.left <= previous + 1e-8,
    'Starfall duration increased or became non-finite');
  check(st('G.spikes.length') === 0, 'the ordinary spawn loop put hazards into active Starfall');
  if (current.wave !== lastWave) {
    check(current.wave === lastWave + 1, 'Starfall skipped or repeated a wave');
    waveTimes.push(st('G.t') - beganAt); lastWave = current.wave;
    check(st('G.stars.some(s=>s.starfall)'), 'a scheduled wave produced no collectible stars');
  }
  previous = current.left;
}
check(expiredAt !== null, 'Starfall never released the arena');
check(lastWave === 3 && waveTimes.length === 3 &&
      waveTimes[1] > 2 && waveTimes[1] < 4.5 && waveTimes[2] > 5 && waveTimes[2] < 7.5,
  'Starfall did not stage three spaced waves: ' + waveTimes.map(t=>t.toFixed(2)).join(', '));
check(Math.abs(expiredAt - beganAt - first.left) < .15,
  'Starfall gameplay duration drifted from its countdown');
console.log('OK  audible onset, actual star collection, three staged waves and hazard-free countdown');

resetRun();
st('startStarfall()');
check(st('G.starfall'), 'the Starfall reward could not be started for suspension probes');
st('pauseGame()');
check(st('PAUSE.on'), 'the pause control did not enter its real frozen state');
const paused = read('[G.starfall.left,G.starfall.wave,G.t]');
for (let i = 0; i < 90; i++) frame(16.7);
check(JSON.stringify(read('[G.starfall.left,G.starfall.wave,G.t]')) === JSON.stringify(paused),
  'Starfall countdown or waves advanced while paused');
st('unpauseGame()');
for (let i = 0; i < 240 && st('frozen()'); i++) frame(16.7);
check(!st('frozen()') && st('G.starfall.left') === paused[0],
  'the pause resume countdown consumed the Starfall reward');
st('startBlackHole()');
const suspended = read('[G.starfall.left,G.starfall.wave]');
for (let i = 0; i < 100; i++) frame(16.7);
check(st('BH.phase') > 0 &&
      JSON.stringify(read('[G.starfall.left,G.starfall.wave]')) === JSON.stringify(suspended),
  'the black hole consumed Starfall duration or released a wave');
st('G.build=2;startGame()');
check(!st('G.starfall') && st('G.build') === 0 && !st('G.stars.some(s=>s.starfall)'),
  'retry retained an old Starfall or its reward stars');
console.log('OK  Starfall pauses, survives black-hole suspension and resets on retry');

/* A bounded cadence run catches a silent latch or an unreachable successor.
   Feeding still calls the same orbit contribution path; a release must arrive
   on the next unscheduled quarter, with no former eight-bar rise or cooldown.
   The scheduler commits 160ms ahead, so an already queued quarter cannot be
   replaced; allow that look-ahead plus two frame boundaries in the bound. */
resetRun();
st('const dropEvents=[];const observedFireDrop=fireDrop;fireDrop=function(t){dropEvents.push({at:t,step:MU.step});return observedFireDrop(t);};');
let armAt = -1, worstLatch = 0, fires = 0, wasArmed = false, wasReward = false;
for (let i = 0; i < 60 * 40; i++) {
  if (i % 30 === 0) st("build(1,'orbit')");
  st('G.invuln=G.t+9;G.starT=1e9;G.powT=1e9;G.spikes=[];G.lapEmbers=0;G.started=G.t-15;G.diff=0');
  const armedBeforeFrame = !!st('MU.armed');
  if (armedBeforeFrame && !wasArmed) armAt = nowMs / 1000;
  frame(16.7);
  const armed = !!st('MU.armed'), reward = !!st('starfallActive()');
  if (armed && !wasArmed && armAt < 0) armAt = nowMs / 1000;
  if (reward && !wasReward) {
    fires++;
    if (armAt >= 0) worstLatch = Math.max(worstLatch, nowMs / 1000 - armAt);
    armAt = -1;
  }
  wasArmed = armed; wasReward = reward;
}
check(st('G.state') === 'playing', 'cadence run ended despite invulnerability');
check(fires >= 3, 'only ' + fires + ' Starfalls in 40 seconds of repeated fed-orbit earnings');
check(read('dropEvents').every(e => e.step % 2 === 0), 'Starfall released between quarter beats');
check(worstLatch <= st('SPB') + .16 + .0334, 'earned Starfall waited ' + worstLatch.toFixed(2) + 's for its audible onset');
console.log('OK  ' + fires + ' Starfalls in 40s; worst arm-to-reward ' + worstLatch.toFixed(2) + 's');
