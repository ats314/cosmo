/* THE MUSIC HAD NO HARNESS. smoke.mjs deliberately runs with WebAudio absent
   — that is its job, it proves every audio path is guarded — but the
   consequence is that musicTick() never turns over in CI and not one note of
   the arrangement is ever scheduled by any check. The whole per-level song
   system (PROG, the hooks, the basslines, the kit leans) could be reordered,
   truncated or thrown from and all four harnesses would stay green.

   This one stubs WebAudio instead of removing it, then drives the real
   scheduler at every level and asserts what came out: that each level plays
   ITS chords and ITS hook, that no level falls through to another's parts,
   and that nothing in the music path throws. Levels 3 and 4 are the ones that
   matter — nothing else in tools/ reaches level 4's arrangement at all.

   Since the chorus arrived (PROGB) each level is TWO progressions and a
   section machine: cold play must stay on the verse, hot play must lift at a
   four-bar seam into the chorus WALK (the row read through CHOFF), and both
   rows must hold the same law — chord 0 is the i chord, every pitch diatonic
   to the level's natural minor. Order is asserted, not just pitch sets: the
   L2 chorus is the verse's own chords walked the other way, and a set
   comparison cannot see that at all. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1];

/* ---------- the log every assertion below reads ---------- */
/* osc  = one-shot voices, recorded when they start
   tune = every frequency WRITTEN to an oscillator, which is the only way to
          see the bed pad: its eight voices start once at page load and are
          retuned per chord with setTargetAtTime, so a start-only log cannot
          see the progression at all. */
const LOG = { osc: [], buf: [], tune: [], pad: [], errors: [] };
let AUDIO_T = 0;

/* ---------- a WebAudio stub that records instead of sounding ---------- */
const param = (v = 0, onWrite = null) => {
  const w = x => { p.value = x; if (onWrite) onWrite(x, p); return p; };
  const p = {
    value: v,
    setValueAtTime: w,
    linearRampToValueAtTime: w,
    exponentialRampToValueAtTime: w,
    setTargetAtTime: w,
    cancelScheduledValues: () => p,
  };
  return p;
};
const node = (kind, extra = {}) => ({
  __kind: kind,
  connect() {}, disconnect() {},
  ...extra,
});
function stubCtx() {
  const ctx = {
    sampleRate: 48000,
    state: 'running',
    get currentTime() { return AUDIO_T; },
    destination: node('dest'),
    resume: () => Promise.resolve(),
    createGain: () => node('gain', { gain: param(1) }),
    createBiquadFilter: () => node('biquad', { type: '', frequency: param(1000), Q: param(1), gain: param(0), detune: param(0) }),
    createStereoPanner: () => node('pan', { pan: param(0) }),
    createWaveShaper: () => node('shaper', { curve: null, oversample: '' }),
    createConvolver: () => node('conv', { buffer: null }),
    createDelay: () => node('delay', { delayTime: param(0) }),
    createDynamicsCompressor: () => node('comp', {
      threshold: param(-24), knee: param(30), ratio: param(12),
      attack: param(0.003), release: param(0.25),
    }),
    createBuffer: (chs, len) => ({
      length: len, numberOfChannels: chs,
      getChannelData: () => new Float32Array(len),
    }),
    createOscillator: () => {
      const o = node('osc', {
        type: 'sine', detune: param(0),
        frequency: param(0, (f, p) => { LOG.tune.push(f); if (p.__pad) LOG.pad.push(f); }),
        /* dur is recorded so a voice can be identified by its SUSTAIN as
           well as its pitch — the chorus color tone shares a frequency with
           the counter-line by pentatonic arithmetic, and only the length
           tells them apart */
        start(t) { o.__rec = { type: o.type, f: o.frequency.value, t: t ?? AUDIO_T }; LOG.osc.push(o.__rec); },
        stop(t) { if (o.__rec) o.__rec.dur = (t ?? AUDIO_T) - o.__rec.t; },
      });
      return o;
    },
    createBufferSource: () => {
      const s = node('src', {
        buffer: null, loop: false,
        start(t) { LOG.buf.push({ t: t ?? AUDIO_T }); },
        stop() {},
      });
      return s;
    },
  };
  return ctx;
}

/* ---------- DOM stub (same shape smoke.mjs uses) ---------- */
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
const makeCanvasEl = () => ({
  width: 0, height: 0, style: {},
  getContext: () => ctx2d(),
  addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
});
const canvasEl = makeCanvasEl();
let nowMs = 0, vw = 390, vh = 844;
const store = {};
const sandbox = {
  document: {
    getElementById: id => id === 'c' ? canvasEl : {},
    createElement: () => makeCanvasEl(),
    addEventListener: (ev, fn) => { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
    head: { appendChild() {} },
    hidden: false,
  },
  window: null,
  navigator: { userAgent: 'musiccheck', platform: 'X', maxTouchPoints: 0 },
  localStorage: {
    getItem: k => store[k] === undefined ? null : store[k],
    setItem: (k, v) => { store[k] = String(v); },
  },
  performance: { now: () => nowMs },
  requestAnimationFrame: () => {},
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0' }),
  location: { origin: 'https://x.test', pathname: '/' },
  console,
  Math, JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
  isNaN, parseInt, parseFloat, setTimeout: () => {},
};
sandbox.window = new Proxy(sandbox, {
  get(t, k) {
    if (k === 'innerWidth') return vw;
    if (k === 'innerHeight') return vh;
    if (k === 'devicePixelRatio') return 2;
    if (k === 'addEventListener') return (ev, fn) => { (listeners['win:' + k] = listeners['win:' + k] || []).push(fn); };
    if (k === 'AudioContext') return stubCtx;         /* audio ON: the point of this harness */
    if (k === 'webkitAudioContext') return undefined;
    if (k === 'matchMedia') return sandbox.matchMedia;
    if (k === 'localStorage') return sandbox.localStorage;
    if (k === 'navigator') return sandbox.navigator;
    if (k === 'storage') return undefined;
    return t[k];
  },
  set(t, k, v) { t[k] = v; return true; },
});
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const ctx = vm.createContext(sandbox);
vm.runInContext(src, ctx, { filename: 'index.html' });
const $ = name => vm.runInContext(name, ctx);

/* ---------- boot audio the way a first tap does ---------- */
vm.runInContext(`
  AC = new (window.AudioContext)();
  buildBus();
  audioUnlocked = true;
`, ctx);

if (!$('A') || !$('BED') || !$('MU')) fail('the bus did not build under a stubbed AudioContext');

/* Mark the bed pad's eight voices. They are the authoritative statement of the
   progression — started once, retuned per bar — and separating their writes
   from every one-shot voice is what lets the chord assertions below be exact
   instead of a guess about which harmonics belong to whom. */
for (const o of $('BED').oscs) o.frequency.__pad = true;

let failures = 0;
function fail(msg) { console.error('FAIL ' + msg); failures++; }
function ok(msg) { console.log('ok  ' + msg); }

/* ---------- drive one level's arrangement ---------- */
/* `heat` decides which SECTION a run can reach: the chorus eval reads
   PLAY.heat (nothing in these runs drives the other terms — groove, od,
   hyper and the afterglow are zeroed below), and heat never decays here
   because bedTick is not being ticked. 0 pins a run to the verse; 0.9
   lifts it at the first legal seam (bar 8). MU.barN is reset so "the
   first eight bars are the verse" is measured from THIS run's opening
   rather than from however long the previous scenario ran.
   skyI is set to the level's FLOOR (the game pins it to G.level-1 — see
   the ratchet), because the sky bands carry percussion of their own and a
   harness that leaves the sky at band 0 cannot hear the chorus lean stack
   onto it — which is exactly how the doubled level-4 backbeat shipped. */
function startLevel(level, heat = 0.8) {
  LOG.osc.length = 0; LOG.buf.length = 0; LOG.tune.length = 0; LOG.pad.length = 0;
  AUDIO_T = 0;
  vm.runInContext(`
    G.level = ${level};
    applyLevelMusic();
    G.state = 'playing';
    G.score = 5000;          /* every score layer open, including the sub drone */
    G.t = 400; G.dl0 = 0;
    PLAY.heat = ${heat};
    G.groove = 0; G.od = 0; G.hyper = 0;
    MU.next = 0; MU.step = 0; MU.chord = -1; MU.barN = 0; MU.glow = 0;
    FIN.on = false; FIN.pend = false; FIN.step = 0;
    skyI = Math.max(0, ${level} - 1);
  `, ctx);
}
function tick(level, n) {
  const step = $('SPB') / 2;
  for (let i = 0; i < n; i++) {
    AUDIO_T += step;
    try { vm.runInContext('musicTick()', ctx); }
    catch (e) { LOG.errors.push(`level ${level} step ${i}: ${e && e.message}`); throw e; }
  }
}
function runLevel(level, seconds, heat) {
  startLevel(level, heat);
  tick(level, Math.floor(seconds / ($('SPB') / 2)));
  return { osc: LOG.osc.slice(), tune: LOG.tune.slice(), pad: LOG.pad.slice(), noise: LOG.buf.length };
}
/* The pad writes 8 frequencies per bar (4 voices x 2 unison oscs, voice 0
   first — see the retune loop), and it retunes on every bar ordinal, so
   LOG.pad[k*8] is the ROOT the pad was handed for bar k. That makes the
   heard chord SEQUENCE checkable, not just the pitch set — which matters
   because the L2 chorus reuses the verse's chords in a different order,
   and a set comparison cannot see order at all. */
function padRoots(pad) {
  const roots = [];
  for (let k = 0; k + 8 <= pad.length; k += 8) roots.push(pad[k]);
  return roots;
}

/* ---------- the assertions ---------- */
const PROG = $('PROG');
const HOOKL = $('HOOKL');
const LEVELS = [1, 2, 3, 4];

console.log('--- the SFX scale is in the same key as the band ---');
/* THE HALF OF THE INVARIANT NOTHING WAS CHECKING. CLAUDE.md states it as one
   rule: every chord is diatonic to its level's natural minor, because the SFX
   pentatonic is scaled into that key and every sound in the game speaks
   through it. The chord half was enforced below. The other half — that the
   scale and the chords are in the SAME key — was not enforced anywhere.

   Two tables have to agree and nothing made them: LV[].key scales PENT (every
   sound effect), and PROG carries the chords (the band). Change one without
   the other and the entire effects layer plays in a different key from the
   music, with every check green. That is not a hypothetical drift — it is the
   single edit most likely to be made by someone retuning a level, since the
   key value looks like the place a key lives. */
{
  const PENT_BASE = $('PENT_BASE');
  const pc = f => ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
  const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const LV = $('LV');
  for (const L of LEVELS) {
    const key = LV[L - 1].key;
    const tonic = pc(PROG[L - 1][0][0]);
    /* the minor pentatonic degrees, in semitones over the tonic */
    const want = new Set([0, 3, 5, 7, 10].map(d => (tonic + d) % 12));
    const got = new Set(PENT_BASE.map(f => pc(f * key)));
    const extra = [...got].filter(p => !want.has(p));
    const missing = [...want].filter(p => !got.has(p));
    if (extra.length || missing.length) {
      fail(`level ${L}: the SFX pentatonic is not the minor pentatonic of `
        + `${NOTE[tonic]} — LV[${L - 1}].key (${key}) and PROG[${L - 1}] disagree about the key. `
        + `unexpected ${extra.map(p => NOTE[p]).join(',') || 'none'}; `
        + `absent ${missing.map(p => NOTE[p]).join(',') || 'none'}`);
    } else {
      ok(`level ${L}: SFX scale is ${NOTE[tonic]} minor pentatonic, matching its chords`);
    }
  }
}

console.log('--- the verse: cold play voices the level\'s own row and nothing else ---');
/* At heat 0 the song must never lift: the old exact guarantee — the pad
   voices its level's PROG row and not one pitch more — now belongs to the
   verse, and holding it at heat 0 is also what proves the chorus cannot
   trigger itself. */
const heard = {};
for (const L of LEVELS) {
  const r = runLevel(L, 60, 0);
  if (!r.osc.length) { fail(`level ${L} scheduled no notes at all in 60s of music`); continue; }
  heard[L] = r;
  if ($('MU').sect !== 0) { fail(`level ${L}: the chorus engaged at heat 0 — the lift is free`); }

  /* The pad IS the progression: eight voices, retuned to the bar's chord.
     Testing it exactly — the set of pitches the pad was retuned to must equal
     the set in this level's PROG row, with nothing extra — is sound in a way
     that sifting one-shot voices is not. The four keys are a whole step apart,
     so they share a great many pitches by arithmetic; a one-shot voice landing
     on a neighbour's root proves nothing either way. */
  const padSet = [...new Set(r.pad.map(f => Math.round(f * 100) / 100))].sort((a, b) => a - b);
  const want = [...new Set(PROG[L - 1].flat())].sort((a, b) => a - b);
  const missing = want.filter(f => !padSet.some(x => Math.abs(x - f) < 0.02));
  const extra = padSet.filter(f => !want.some(x => Math.abs(x - f) < 0.02));
  if (missing.length) fail(`level ${L}: the pad never voiced ${missing.join(', ')}`);
  else if (extra.length) fail(`level ${L}: the pad voiced pitches outside its progression: ${extra.join(', ')}`);
  else ok(`level ${L}: verse pad voiced its ${want.length} chord tones and nothing else`);
}

console.log('--- the chorus: hot play lifts the song at the seam, and only there ---');
const PROGB = $('PROGB');
const CHOFF = $('CHOFF');
const heardHot = {};
for (const L of LEVELS) {
  const r = runLevel(L, 74, 0.9);
  heardHot[L] = r;
  if ($('MU').sect !== 1) { fail(`level ${L}: 74s at heat 0.9 never reached the chorus`); continue; }

  /* the heard chord sequence: eight verse bars first (the song states its
     home before it leaves — the barN >= 8 guard), then the chorus WALK,
     which is the row read through its rotation (CHOFF), not the row raw.
     Order is the assertion that matters: the L2 chorus is the verse's own
     chords walked the other way, invisible to any set comparison. */
  const roots = padRoots(r.pad);
  const vWalk = b => PROG[L - 1][b % 4][0];
  const bWalk = b => PROGB[L - 1][(b + CHOFF[L - 1]) % 4][0];
  /* A bar can legitimately match BOTH walks — L3's chorus opens on the same
     tonic chord its verse walk would have played — so "first divergence" is
     not the entry. The claim tested instead: there exists ONE seam s (a
     multiple of four, not before bar 8) with pure verse before it and the
     pure chorus walk from it to the end. */
  let seam = -1;
  const near = (a, b) => Math.abs(a - b) < 0.02;
  for (let s = 8; s < roots.length; s += 4) {
    let good = true;
    for (let b = 0; b < s && good; b++) good = near(roots[b], vWalk(b));
    for (let b = s; b < roots.length && good; b++) good = near(roots[b], bWalk(b));
    if (good) { seam = s; break; }
  }
  if (seam < 0) {
    const b0 = roots.findIndex((f, b) => !near(f, vWalk(b)));
    fail(`level ${L}: no clean verse->chorus seam found (first off-verse bar: ${b0}, root ${roots[b0]})`);
  } else ok(`level ${L}: verse for ${seam} bars, then the chorus walk held for ${roots.length - seam} bars`);

  /* the union law: hot play may voice both rows and nothing else */
  const padSet = [...new Set(r.pad.map(f => Math.round(f * 100) / 100))];
  const union = [...new Set([...PROG[L - 1].flat(), ...PROGB[L - 1].flat()])];
  const extra = padSet.filter(f => !union.some(x => Math.abs(x - f) < 0.02));
  if (extra.length) fail(`level ${L}: the hot pad voiced pitches outside both sections: ${extra.join(', ')}`);
  else ok(`level ${L}: every hot pad pitch is in one of the level's two rows`);

  /* the color tone: the chorus schedules its chord's own seventh (SEVB), a
     sustained triangle an octave up, and it must actually fire. Matched on
     pitch AND sustain: the counter-line's triangle lands on the same
     frequency by pentatonic arithmetic (PENT[4]/2 = the i chord's seventh
     doubled, in every key), and a first version of this check counted it —
     which is how deleting the color line entirely stayed green. Only the
     1.6s hold is unambiguous. */
  const SEVB = $('SEVB')[L - 1];
  const sevHits = LOG.osc.filter(o => o.type === 'triangle' && o.dur > 1.55 &&
    SEVB.some(s => Math.abs(o.f - s * 2) < 0.02)).length;
  if (sevHits < 3) fail(`level ${L}: the chorus color tone fired ${sevHits} time(s) in ${roots.length} bars — SEVB is not reaching the schedule`);
  else ok(`level ${L}: the seventh color tone sang ${sevHits} times`);
}
if (Object.keys(heard).length === 4) ok('no level read another level\'s progression row');

console.log('--- the song settles back to the verse when the play cools ---');
{
  startLevel(2, 0.9);
  tick(2, 100);                       /* 12+ bars: chorus by bar 8 */
  if ($('MU').sect !== 1) fail('the exit test never entered the chorus to leave it');
  vm.runInContext('PLAY.heat = 0;', ctx);
  LOG.pad.length = 0;
  tick(2, 72);                        /* across at least one seam, then two loops */
  if ($('MU').sect !== 0) fail('heat gone, and the chorus never handed the song back');
  else {
    /* the last four bars must be the verse walk — some rotation of the row,
       since the window cut into the cycle at an arbitrary bar */
    const tail = padRoots(LOG.pad).slice(-4);
    const verseRoots = PROG[1].map(c => c[0]);
    const settled = [0, 1, 2, 3].some(k => tail.every((f, i2) => Math.abs(f - verseRoots[(i2 + k) % 4]) < 0.02));
    if (!settled) fail(`after cooling, the pad walked ${tail.join(', ')} — not the verse row`);
    else ok('cooling off returns the walk to the verse at the next seam');
  }
}

console.log('--- the star dive opens on the verse, not on the chorus chord ---');
/* The finale latch sits BELOW the bar retune, which has already scheduled
   the chorus chord at the latch's own t — so applySect alone left the
   dive's whole first bar sounding over the chorus. The fix re-retunes at
   the same t; this asserts the LAST pad write group of the latch step is
   the verse chord of that bar. Level 4 is used because its chorus has
   three roots the verse never plays, so a wrong chord cannot hide. */
{
  startLevel(4, 0.9);
  tick(4, 100);
  if ($('MU').sect !== 1) fail('dive-seam test never reached the chorus');
  else {
    vm.runInContext('FIN.on = true; FIN.pend = true;', ctx);
    const cbPre = $('G').chorusBars;
    let latchStep = -1, latchCounted = false;
    for (let s = 0; s < 20 && latchStep < 0; s++) {
      const cbB = $('G').chorusBars;
      AUDIO_T += $('SPB') / 2;
      vm.runInContext('musicTick()', ctx);
      if (!$('FIN').pend) {
        latchStep = ($('MU').step + 31) % 32;
        latchCounted = $('G').chorusBars !== cbB;
      }
    }
    if (latchStep < 0) fail('the finale never latched in 20 steps');
    else {
      const bar = (latchStep / 8) | 0;
      const wantRoot = PROG[3][bar % 4][0];
      const lastRoot = LOG.pad[LOG.pad.length - 8];
      if ($('MU').sect !== 0) fail('the finale latch did not revert the section');
      if (Math.abs(lastRoot - wantRoot) > 0.02)
        fail(`the dive's first bar pad root is ${lastRoot}, expected the verse's ${wantRoot} — the revert did not reach the oscillators`);
      else ok(`the dive's first bar opens on the verse chord (${wantRoot}Hz)`);
      /* the latch bar belongs to the dive, not the chorus — the counter
         runs below the handoff and must not have ticked on that step */
      if (latchCounted) fail(`the dive's latch bar still counted as a chorus bar (${cbPre} -> ${$('G').chorusBars})`);
      else ok('the dive\'s latch bar is not a chorus bar');
    }
    vm.runInContext('FIN.on = false; FIN.pend = false; FIN.step = 0;', ctx);
  }
}

console.log('--- chorus_bars counts only bars the chorus actually sounds ---');
/* The flag stays frozen through a black hole (the band is halted) and a
   payoff (the section owns those bars); the counter must not follow the
   flag there. On level 4 one black hole per run is guaranteed, so the
   uncorrected counter overstated every hot level-4 run. */
{
  startLevel(4, 0.9);
  tick(4, 100);
  if ($('MU').sect !== 1) fail('chorus_bars/bh test never reached the chorus');
  else {
    const cb1 = $('G').chorusBars;
    vm.runInContext('startBlackHole(); BH.phase = 2; BH.t = 0; BH.warp = 1; BH.step = 0;', ctx);
    tick(4, 32);
    if ($('MU').sect !== 1) fail('chorus_bars/bh test is vacuous — the black hole reset the section');
    const cb2 = $('G').chorusBars;
    if (cb2 !== cb1) fail(`chorus_bars advanced ${cb2 - cb1} inside a black hole — the band is halted there`);
    else ok('chorus_bars holds through a black hole');
    vm.runInContext('BH.phase = 0; BH.on = false; BH.warp = 0; BH.t = 0; MU.pend = null; MU.pendSrc = null;', ctx);
  }
  startLevel(2, 0.9);
  tick(2, 100);
  vm.runInContext('MU.armed = true;', ctx);
  let started = false, cbAt = 0, ended = false, landingCounted = false;
  for (let s = 0; s < 400 && !ended; s++) {
    const cbB = $('G').chorusBars;
    AUDIO_T += $('SPB') / 2;
    vm.runInContext('musicTick()', ctx);
    const pay = $('MU').pay;
    if (!started && pay > 0) {
      started = true; cbAt = $('G').chorusBars;
      /* the bar the drop LANDS on is the payoff's first bar — fireDrop runs
         later in the same step, so a counter above the handoff ticks here */
      landingCounted = $('G').chorusBars !== cbB;
    }
    if (started && pay === 0) ended = true;
  }
  if (!started) fail('chorus_bars/payoff test: the payoff never ran');
  else if (landingCounted) fail('the drop\'s landing bar still counted as a chorus bar — the counter runs above the payoff handoff');
  else if ($('G').chorusBars !== cbAt) fail(`chorus_bars advanced ${$('G').chorusBars - cbAt} inside the payoff — the section owns those bars`);
  else ok('chorus_bars holds through the payoff, landing bar included');
}

console.log('--- the chorus lean never doubles a drum already playing ---');
/* The sky floors at G.level-1 (startLevel mirrors that), so level 4 rides
   sky band 3's beat-4 snare from its first bar. The first chorus lean
   added its own snare on the same slot — two 1900Hz bursts and two tonal
   bodies at one timestamp, on the level good players live in. Snare
   BODIES are the countable half (the noise stub records hats anonymously):
   no timestamp may carry two of them. */
{
  const tonic = PROG[3][0][0], body = tonic * 1.7818;
  const bodies = heardHot[4].osc.filter(o => o.type === 'triangle' &&
    Math.abs(o.f - body) < 0.05 && (o.dur || 0) < 0.3);
  if (!bodies.length) fail('level 4 hot run scheduled no snare bodies at all — the doubling guard cannot run');
  const byT = {};
  for (const o of bodies) { const k2 = o.t.toFixed(3); byT[k2] = (byT[k2] || 0) + 1; }
  const dup = Object.entries(byT).filter(([, n]) => n > 1);
  if (dup.length) fail(`level 4: ${dup.length} slot(s) carry a doubled snare body — the chorus backbeat is stacking on the sky kit`);
  else ok(`level 4: ${bodies.length} snare bodies, no slot doubled (the chorus yields to sky band 3)`);
}

/* and the rows really are different progressions, not one transposed:
   normalise each HEARD walk to its own tonic and the shapes must differ —
   across levels within each table, and between a level's two sections */
{
  const shape = row => row.map(c => Math.round(12 * Math.log2(c[0] / row[0][0]))).join(' ');
  const shapes = PROG.map(shape);
  const uniq = new Set(shapes);
  if (uniq.size < 3) fail(`only ${uniq.size} distinct progression shape(s) across four levels: ${shapes.join(' / ')}`);
  else ok(`${uniq.size} distinct verse shapes in semitones from the tonic: ${shapes.map((s, i) => `L${i + 1}[${s}]`).join(' ')}`);

  const walkShape = L => {
    const tonic = PROGB[L][0][0];
    return [0, 1, 2, 3].map(b => Math.round(12 * Math.log2(PROGB[L][(b + CHOFF[L]) % 4][0] / tonic))).join(' ');
  };
  const bShapes = [0, 1, 2, 3].map(walkShape);
  if (new Set(bShapes).size < 4) fail(`the four chorus walks are not four shapes: ${bShapes.join(' / ')}`);
  else ok(`4 distinct chorus walks: ${bShapes.map((s, i) => `L${i + 1}[${s}]`).join(' ')}`);
  for (let L = 0; L < 4; L++) {
    const v = PROG[L].map(c => Math.round(12 * Math.log2(c[0] / PROG[L][0][0]))).join(' ');
    if (bShapes[L] === v) fail(`level ${L + 1}'s chorus walk is its own verse — a section change that changes nothing`);
  }
}

console.log('--- the four hooks are four different tunes ---');
const sig = HOOKL.map(r => r.join(','));
for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
  if (sig[a] === sig[b]) fail(`hook for level ${a + 1} is identical to level ${b + 1}`);
}
if (new Set(sig).size === 4) ok('all four payoff hooks are distinct');

/* the structural grammar every hook must keep: bars 2,3,6 belong to the
   player, and every bar's accents sit on the same 3+3+2 positions */
const accents = row => [0, 1, 4, 5, 7].map(b =>
  row.slice(b * 16, b * 16 + 16).map((v, j) => v >= 0 ? j : -1).filter(j => j >= 0).join(' ')).join(' | ');
const grammar = new Set(HOOKL.map(accents));
if (grammar.size !== 1) fail(`the hooks no longer share one rhythm: ${[...grammar].join('  /  ')}`);
else ok('all four hooks keep one rhythmic signature: ' + [...grammar][0]);

for (let i = 0; i < 4; i++) {
  const yours = [2, 3, 6].every(b => HOOKL[i].slice(b * 16, b * 16 + 16).every(v => v === -1));
  if (!yours) fail(`level ${i + 1}'s hook plays over a response bar — bars 2, 3 and 6 are the player's`);
}
ok('the response bars are silent on every level');

/* every degree must be indexable in PENT, including the crown's +5 clamp */
const PENT = $('PENT');
for (let i = 0; i < 4; i++) {
  const bad = HOOKL[i].concat($('HOOKBL')[i]).filter(d => d >= PENT.length);
  if (bad.length) fail(`level ${i + 1}'s hook uses degree(s) ${[...new Set(bad)].join(',')} beyond PENT`);
}
ok('every hook degree is inside PENT');

console.log('--- level 4 has parts of its own ---');
/* Level 4 used to fall through to level 3's bassline and to no kit at all.
   Its bass alternates root and octave on the eighths, so across a bar it must
   sound BOTH ch[0] and ch[1] as bass fundamentals; level 3's roll does not. */
{
  const osc4 = heard[4].osc, osc3 = heard[3].osc;
  const noise4 = heard[4].noise;
  const root = PROG[3][0][0], oct = PROG[3][0][1];
  const near = (list, f) => list.filter(o => Math.abs(o.f - f) < 0.02).length;
  const r4 = near(osc4, root), o4 = near(osc4, oct);
  if (r4 < 4 || o4 < 4) fail(`level 4's octave bass did not alternate (root x${r4}, octave x${o4})`);
  else ok(`level 4's octave bass alternates (root x${r4}, octave x${o4})`);

  /* the tonic pedal: the sub drone must sit on CH[0][0]/2 every bar, never on
     the bar's own root — no non-tonic root of EITHER section may appear as a
     drone pitch, and the chorus run is checked too: the chorus is where the
     bass finally moves, which is exactly when a drone that secretly follows
     the chord would start following it */
  const tonicHalf = PROG[3][0][0] / 2;
  const offRoots = [...PROG[3], ...$('PROGB')[3]]
    .map(c => c[0] / 2).filter(f => Math.abs(f - tonicHalf) > 0.02);
  for (const [name, list] of [['verse', osc4], ['chorus', heardHot[4].osc]]) {
    const drone = list.filter(o => o.type === 'triangle');
    const onTonic = drone.filter(o => Math.abs(o.f - tonicHalf) < 0.02).length;
    const offTonic = drone.filter(o => offRoots.some(r => Math.abs(o.f - r) < 0.02)).length;
    if (!onTonic) fail(`level 4 never sounded its tonic pedal in the ${name} run`);
    else if (offTonic) fail(`level 4's sub drone followed the chord ${offTonic} times in the ${name} run instead of pedalling`);
    else ok(`level 4's sub drone is a tonic pedal in the ${name} run (${onTonic} bars, 0 chord-following)`);
  }

  if (!noise4) fail('level 4 scheduled no percussion');
  else ok(`level 4's kit fires (${noise4} noise hits in the last run)`);
  if (!osc3.length) fail('level 3 scheduled nothing');
}

console.log('--- the pad glides, so the voice leading is measured ---');
/* The bed retunes with setTargetAtTime rather than restarting, which means
   every chord change is a portamento on eight oscillators: a chord whose
   voices leap is a chord the player hears swoop. Sum-of-squares displacement
   is the standard voice-leading smoothness measure; the hard bound here is
   that no single voice may glide more than an octave, which no reasonable
   voicing does and a mistyped frequency immediately would. */
for (let L = 0; L < 4; L++) {
  const row = PROG[L];
  let worst = 0, worstAt = '', ss = 0;
  for (let i = 0; i < 4; i++) {
    const a = row[i], b = row[(i + 1) % 4];
    for (let v = 0; v < 4; v++) {
      const d = Math.abs(12 * Math.log2(b[v] / a[v]));
      ss += d * d;
      if (d > worst) { worst = d; worstAt = `chord ${i}->${(i + 1) % 4}, voice ${v}`; }
    }
  }
  if (worst > 12) fail(`level ${L + 1}: a pad voice glides ${worst.toFixed(1)} semitones (${worstAt}) — over an octave`);
  else ok(`level ${L + 1}: widest pad glide ${worst.toFixed(1)} semitones, displacement ${ss.toFixed(0)}`);
}
/* ...and the chorus glides are measured over the WALK (the row read through
   CHOFF), including both seams — the section swap itself is a retune the
   player hears, so verse[last] -> chorus[first] and back are glides too */
for (let L = 0; L < 4; L++) {
  const walk = [0, 1, 2, 3].map(b => PROGB[L][(b + CHOFF[L]) % 4]);
  const seq = [PROG[L][3], ...walk, walk[0], PROG[L][0]]; /* seam in, cycle, loop, seam out */
  let worst = 0, worstAt = '';
  for (let i = 0; i < seq.length - 1; i++) {
    for (let v = 0; v < 4; v++) {
      const d = Math.abs(12 * Math.log2(seq[i + 1][v] / seq[i][v]));
      if (d > worst) { worst = d; worstAt = `step ${i}, voice ${v}`; }
    }
  }
  if (worst > 12) fail(`level ${L + 1}: a chorus pad voice glides ${worst.toFixed(1)} semitones (${worstAt}) — over an octave`);
  else ok(`level ${L + 1}: widest chorus glide (walk + both seams) ${worst.toFixed(1)} semitones`);
}

console.log('--- the chorus tables hold the same law as the verse ---');
/* THE TONIC ANCHOR. CH[0][0] is read as "the level's tonic" by the snare
   body, fireDrop, braam, the star dive, the black hole and half the SFX
   layer, at any moment, in either section. The rotation (CHOFF) exists so a
   chorus can OPEN off-tonic while row slot 0 never stops being the i chord
   those readers assume. Both halves are structural; both are pinned here. */
{
  const MIN = new Set([0, 2, 3, 5, 7, 8, 10]);
  for (const L of LEVELS) {
    const vRow = PROG[L - 1], bRow = PROGB[L - 1];
    if (bRow.length !== 4 || bRow.some(c => c.length !== 4)) { fail(`level ${L}: PROGB row is not 4 chords x 4 voices`); continue; }
    if (!vRow[0].every((f, v) => f === bRow[0][v]))
      fail(`level ${L}: PROGB chord 0 is not the verse's i chord — CH[0][0] stops being the tonic in the chorus`);
    const off = CHOFF[L - 1];
    if (!(Number.isInteger(off) && off >= 0 && off <= 3)) fail(`level ${L}: CHOFF ${off} is not a row index`);
    const tonic = vRow[0][0];
    for (const [tn, rows] of [['PROG', vRow], ['PROGB', bRow]]) {
      for (let j = 0; j < 4; j++) {
        if (Math.abs(rows[j][1] / rows[j][0] - 2) > 0.001)
          fail(`level ${L} ${tn} chord ${j}: voice 1 is not the root's octave — the basslines and the L4 alternation read that role`);
        for (const f of rows[j]) {
          const semis = 12 * Math.log2(f / tonic), nearest = Math.round(semis);
          if (Math.abs(semis - nearest) > 0.02) fail(`level ${L} ${tn} chord ${j}: ${f}Hz is off the semitone grid`);
          else if (!MIN.has(((nearest % 12) + 12) % 12)) fail(`level ${L} ${tn} chord ${j}: ${f}Hz is outside the natural minor`);
        }
      }
    }
    /* SEVB: each chorus chord's seventh — diatonic, and genuinely the
       STACKED THIRD (a third above the chord's own fifth), which is what
       makes maj7 land on III and VI and m7 everywhere else without anyone
       choosing wrong by hand */
    const SEVB = $('SEVB')[L - 1];
    for (let j = 0; j < 4; j++) {
      const s = 12 * Math.log2(SEVB[j] / tonic), ns = Math.round(s);
      if (Math.abs(s - ns) > 0.02 || !MIN.has(((ns % 12) + 12) % 12))
        fail(`level ${L}: SEVB[${j}] (${SEVB[j]}Hz) is not diatonic to the key`);
      const fifth = bRow[j][3];
      const up = ((Math.round(12 * Math.log2(SEVB[j] / fifth)) % 12) + 12) % 12;
      if (up !== 3 && up !== 4)
        fail(`level ${L}: SEVB[${j}] is ${up} semitones above the chord's fifth — not the stacked third`);
    }
  }
  ok('both tables: chord 0 is i, voice 1 is the octave, every pitch diatonic, every seventh a stacked third');
}
/* the chorus arps: same ceiling as the verse arp (the band must stop below
   the player's 784Hz floor), and actually different contours */
{
  const ARPL2 = $('ARPL'), ARPBL = $('ARPBL');
  for (let L = 0; L < 4; L++) {
    for (const [tn, row] of [['ARPL', ARPL2[L]], ['ARPBL', ARPBL[L]]]) {
      if (row.length !== 8 || row.some(d => d < 0 || d > 4))
        fail(`level ${L + 1} ${tn}: a degree leaves 0-4 — the arp would cross the player's register floor`);
    }
    if (ARPL2[L].join() === ARPBL[L].join())
      fail(`level ${L + 1}: the chorus arp is the verse arp — the section change loses its melodic surface`);
  }
  ok('both arp tables stay under the player\'s floor and differ per level');
}

console.log('--- the tuned percussion stays in key ---');
/* The snare body used to be a hardcoded 196Hz on all four levels. Assert it is
   the VII of whatever key is playing, and that level 1 is untouched. */
/* Fired directly rather than waited for: every snare in the game sits behind a
   gate (the drum break, the payoff's backbeat, a sky band, a difficulty
   threshold) and whether one lands inside a fixed window is a property of the
   run, not of the pitch. */
for (const L of LEVELS) {
  const tonic = PROG[L - 1][0][0];
  const want = tonic * 1.7818;
  startLevel(L);
  LOG.osc.length = 0;
  vm.runInContext('snare(AC.currentTime, 0.05, 0.3);', ctx);
  const body = LOG.osc.filter(o => o.type === 'triangle');
  if (!body.length) { fail(`level ${L}: snare() scheduled no body at all`); continue; }
  const f = body[0].f;
  const semis = Math.round(12 * Math.log2(f / tonic));
  if (Math.abs(f - want) > 0.05) fail(`level ${L}: snare body at ${f.toFixed(2)}Hz, expected ${want.toFixed(2)}Hz`);
  else if (semis !== 10) fail(`level ${L}: snare body is ${semis} semitones over the tonic, expected 10 (the VII)`);
  else ok(`level ${L}: snare body ${f.toFixed(2)}Hz = tonic + 10 semitones, the VII of its own key`);
}
/* level 1 must be bit-identical to what shipped */
{
  startLevel(1); LOG.osc.length = 0;
  vm.runInContext('snare(AC.currentTime, 0.05, 0.3);', ctx);
  const f = LOG.osc.filter(o => o.type === 'triangle')[0].f;
  if (Math.abs(f - 196) > 0.01) fail(`level 1's snare moved: ${f.toFixed(3)}Hz, was 196`);
  else ok(`level 1's snare body is unchanged at ${f.toFixed(2)}Hz`);
}

console.log('--- the drop lands in the level\'s own key ---');
/* fireDrop's sub boom and braam were absolute literals (55/110 and 41.2/82.4
   and 110/164.81 — A and E), while the PENT stabs beside them transposed
   correctly. Half the loudest event in the game followed the key and half did
   not. Every pitch it schedules must now be a whole number of semitones from
   the level's tonic, and diatonic to the natural minor. */
const MINOR = new Set([0, 2, 3, 5, 7, 8, 10]);
for (const L of LEVELS) {
  startLevel(L);
  tick(L, 4);
  LOG.osc.length = 0;
  vm.runInContext('fireDrop(AC.currentTime);', ctx);
  const tonic = PROG[L - 1][0][0];
  const offKey = [], offGrid = [];
  for (const o of LOG.osc) {
    const semis = 12 * Math.log2(o.f / tonic);
    const nearest = Math.round(semis);
    if (Math.abs(semis - nearest) > 0.02) { offGrid.push(o.f.toFixed(2)); continue; }
    if (!MINOR.has(((nearest % 12) + 12) % 12)) offKey.push(`${o.f.toFixed(2)}Hz (${nearest} semitones)`);
  }
  if (offGrid.length) fail(`level ${L}: drop pitches off the semitone grid: ${offGrid.join(', ')}`);
  else if (offKey.length) fail(`level ${L}: drop pitches outside the natural minor: ${offKey.join(', ')}`);
  else ok(`level ${L}: all ${LOG.osc.length} pitches in the drop are diatonic to its own key`);
}
/* and level 1's drop must still be the drop that shipped. Compared in CENTS,
   not Hz: the old literals 41.2 / 82.4 / 164.81 were themselves rounded, and
   sit up to 0.6 cents off exact equal temperament. Replacing them with exact
   ratios moves level 1 by less than a cent — roughly a tenth of the smallest
   pitch difference a listener can hear — which is the claim worth asserting.
   A Hz-exact test here would only be asserting the old rounding error. */
{
  startLevel(1); tick(1, 4); LOG.osc.length = 0;
  vm.runInContext('fireDrop(AC.currentTime);', ctx);
  const shipped = [55, 110, 41.2, 82.4, 164.81];
  const got = LOG.osc.map(o => o.f);
  let drift = 0, missing = [];
  for (const f of shipped) {
    let best = Infinity;
    for (const g of got) best = Math.min(best, Math.abs(1200 * Math.log2(g / f)));
    if (best > 3) missing.push(`${f}Hz (nearest is ${best.toFixed(1)} cents away)`);
    else drift = Math.max(drift, best);
  }
  if (missing.length) fail(`level 1's drop moved: ${missing.join('; ')}`);
  else ok(`level 1's drop is unchanged to within ${drift.toFixed(2)} cents of what shipped`);
}

console.log('--- the payoff section runs on every level ---');
/* Arm AFTER the clock is running. musicTick()'s first call on a cold MU.next
   goes through endSection(), which clears every field a section owns — arming
   before the first tick simply disarms it again. */
for (const L of LEVELS) {
  startLevel(L);
  tick(L, 8);
  vm.runInContext('MU.armed=true;', ctx);
  let paid = 0, threw = false;
  const step = $('SPB') / 2;
  for (let i = 0; i < 400 && !threw; i++) {
    AUDIO_T += step;
    try { vm.runInContext('musicTick()', ctx); }
    catch (e) { fail(`level ${L} threw inside the payoff: ${e && e.message}`); threw = true; }
    if ($('MU').pay > 0) paid++;
  }
  if (!paid) fail(`level ${L}: the payoff section never ran`);
  else ok(`level ${L}: payoff ran ${paid} eighths, hook intact, nothing thrown`);
}

/* ---------- BLACK HOLE MODE: the preset piece ----------
   This harness is the only one that runs the arrangement, and CLAUDE.md is
   explicit that anything touching a pitch in the audio path belongs here.
   bhStep had no coverage at all, and it shipped with three faults this section
   now makes impossible: every tuned voice at a gain the band drowns (0.011
   against leads at 0.050-0.085), no content above 2 kHz on a device that
   reproduces little below 500 Hz, and a `bar>=8` branch that could never fire
   because 17 seconds is 7.37 bars. The mode is also where the band is supposed
   to STOP — a claim nothing checked, and which was false for the mode's whole
   life because the pad's gain lives in bedTick and bedTick did not know. */
console.log('\n--- black hole mode: the preset piece ---');
for (const L of LEVELS) {
  startLevel(L);
  tick(L, 4);
  const before = LOG.osc.length;
  /* BH.t is pinned at 0 for the pitch assertions: the sub drone's redshift is a
     deliberate glide of up to a minor third (`fall`), so sampling mid-mode
     would flag the one detune the design is built on. The glide's shape is the
     mode's own business; what has to hold at every instant is that the piece
     STARTS from the level's scale. */
  vm.runInContext('startBlackHole();BH.phase=2;BH.t=0;BH.warp=1;BH.step=0;', ctx);
  const steps = Math.floor($('BH_DUR') / ($('SPB') / 2));
  for (let i = 0; i < steps; i++) {
    AUDIO_T += $('SPB') / 2;
    vm.runInContext('BH.t=0;', ctx);
    try { vm.runInContext('musicTick()', ctx); }
    catch (e) { fail(`level ${L}: the black hole threw: ${e && e.message}`); break; }
  }
  const voices = LOG.osc.slice(before);
  if (!voices.length) { fail(`level ${L}: the black hole scheduled nothing at all`); continue; }

  /* 1. EVERY PITCH IS AN INTERVAL OVER THE LEVEL'S OWN TONIC. A bare frequency
        shows up here as a ratio that is in no level's scale but level 1's —
        which is exactly what the gravity-pull tone's hardcoded 340/220 was.
        The kick is exempt: it is a drum, and its 400->48Hz sweep is the same
        on every level by design (it logs as its 48Hz ramp target). */
  const tonic = $('CH')[0][0];
  const MINOR = [1, 1.1225, 1.1892, 1.3348, 1.4983, 1.5874, 1.7818];
  const tuned = voices.filter(v => v.f > 20 && Math.abs(v.f - 48) > 0.5);
  const stray = tuned.filter(v => {
    let r = v.f / tonic;
    while (r > 1.999) r /= 2;
    while (r < 0.999) r *= 2;
    return !MINOR.some(m => Math.abs(r - m) < 0.02);
  });
  if (stray.length) {
    fail(`level ${L}: ${stray.length} black hole voice(s) are not diatonic over the tonic ` +
         `(${stray.slice(0, 3).map(v => v.f.toFixed(1) + 'Hz').join(', ')})`);
  } else ok(`level ${L}: all ${tuned.length} black hole pitches are intervals over the tonic`);

  /* 2. IT REACHES THE SPEAKER THE GAME SHIPS TO. The piece had zero energy
        above 2 kHz and its tuned voices topped out at 139 Hz, on a device that
        reproduces almost nothing below 500 — which is most of why the mode
        read as the game going quiet rather than as somewhere else. */
  const highs = tuned.filter(v => v.f >= 500).length;
  if (!highs) {
    fail(`level ${L}: every black hole voice is below 400Hz — a phone reproduces none of it`);
  } else ok(`level ${L}: ${highs} voice(s) above the phone's floor`);

  /* 3. THE BAND STOPS. bedTick is the pad's only writer; drive it and require
        that it pulls the eight sustaining voices down. */
  vm.runInContext('bedTick(0.05);', ctx);
  const bedLvl = $('BED').g.gain.value;
  if (!(bedLvl <= 0.05)) {
    fail(`level ${L}: the pad is still at ${bedLvl.toFixed(3)} inside the black hole — ` +
         `the arrangement did not stop`);
  } else ok(`level ${L}: the pad is silenced (${bedLvl.toFixed(3)})`);

  vm.runInContext('BH.phase=0;BH.on=false;BH.warp=0;BH.t=0;bedTick(0.05);', ctx);
}

/* EARNED STAYS EARNED, THROUGH A BLACK HOLE TOO. startBlackHole silenced the
   band with `MU.pend=null`, which reached past the audio and confiscated an
   armed-but-unpaid drop — and build() has already zeroed G.build by then, so
   the meter's charge went with it. Silent, and only ever to a player good
   enough to have earned one. endSection has banked this since it was written;
   the black hole is the one entry point that did not. */
{
  startLevel(3);
  tick(3, 8);
  vm.runInContext("MU.armed=true;MU.why='DROP EARNED';MU.flavor='ember';", ctx);
  vm.runInContext('startBlackHole();', ctx);
  const pend = $('MU').pend;
  if (!pend) fail('entering a black hole destroyed an earned drop instead of banking it');
  else ok(`an earned drop survives the black hole (banked as "${pend}")`);
  if ($('MU').armed || $('MU').rise) fail('the black hole left the drop armed as well as banked');
  vm.runInContext('BH.phase=0;BH.on=false;BH.warp=0;BH.t=0;MU.pend=null;MU.pendSrc=null;', ctx);
}

if (LOG.errors.length) LOG.errors.forEach(e => fail(e));

if (failures) {
  console.error(`\nMUSICCHECK FAILED (${failures})`);
  process.exit(1);
}
console.log('\nOK  four levels, eight progressions, four hooks — verse and chorus both walked, none crossed');
