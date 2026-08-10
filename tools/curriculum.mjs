/* The curriculum rule, executed: every mechanic is introduced and explained
   by the end of level 3 — by the start of level 4 the player has met every
   formation, seen every lesson, and had every orb placed. This drives the
   real game headlessly (same scaffold as smoke.mjs) with an invulnerable,
   periodically-hopping player, taps through the level cards, and fails the
   build if level 4 opens with anything left untaught. */
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
  createElement: () => makeCanvasEl(),
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
    if (k === 'innerWidth') return 390;
    if (k === 'innerHeight') return 844;
    if (k === 'devicePixelRatio') return 2;
    if (k === 'addEventListener') return (ev, fn) => { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); };
    if (k === 'AudioContext' || k === 'webkitAudioContext') return undefined; // plain finish lines
    if (k === 'matchMedia') return sandbox.matchMedia;
    if (k === 'localStorage') return sandbox.localStorage;
    if (k === 'navigator') return sandbox.navigator;
    if (k === 'storage') return undefined;
    return t[k];
  },
});
let nowMs = 0;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'index.html' });
const st = expr => vm.runInContext(expr, sandbox);
function frame(ms) {
  nowMs += ms;
  const fns = calls.raf.splice(0);
  if (!fns.length) throw new Error('no rAF pending');
  for (const fn of fns) fn(nowMs);
}
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
const pev = (id, x, y) => ({ pointerId: id, clientX: x ?? 200, clientY: y ?? 400,
  type: 'pointerup', preventDefault() {} });
/* THE TITLE SCREEN AND THE LEVEL PICKER. Both publish their controls as rects
   from the draw pass and neither answers a tap on its background — the mode
   cards select rather than start, and the level picker is a decision. Same
   reason the swipe chooser needs pressing: a harness that taps a fixed point
   simply waits there forever. */
function pressRect(pid, expr, what) {
  for (let i = 0; i < 30; i++) frame(16.7);
  const r = JSON.parse(st(expr) || 'null');
  if (!r) throw new Error(`no ${what} control was drawn`);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y), type: 'pointerdown' });
  fire('pointerup', pev(pid, x, y));
  return pid + 1;
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
/* Taps the centre of the first upgrade tile whenever the card is offering a
   draft, and the ordinary spot otherwise. The draft deliberately makes a tile
   the ONLY thing that starts the next level, so a harness tapping a fixed
   point simply waits on the card forever — which is exactly what this one did
   until it learned to press the real control. */
const tap = id => {
  let x, y;
  const n = st('G.offer && G.offer.length ? G.offer.length : 0');
  if (n > 0) {
    const r = JSON.parse(st('JSON.stringify(G.offerRects[0]||null)') || 'null');
    if (r) { x = r.x + r.w / 2; y = r.y + r.h / 2; }
  }
  fire('pointerdown', { ...pev(id, x, y), type: 'pointerdown' });
  fire('pointerup', pev(id, x, y));
};

const fail = [];
const banners = [];
let lastBanner = null, pid = 100, hopFlip = false;

for (let i = 0; i < 300; i++) frame(16.7);       // menu settles
pid = passMenu(pid);                              // title screen -> swipe chooser
pid = passSwipeChooser(st, frame, fire, pev, pid);
pid = passLevelSelect(pid);                       // ...-> level picker -> level 1
if (st('G.state') !== 'lvend') fail.push('fresh device skipped the level-1 card');
/* THE CURRICULUM IS RUN IN SKILL, DELIBERATELY. Chill scales the difficulty
   clock and nothing else, so every tier and every orb arrives at the same dl
   and in the same order — the run below would prove the identical thing 40%
   slower. What actually needs guarding is that claim itself, and it is
   asserted directly at the bottom of this file rather than by re-driving. */
for (let i = 0; i < 60; i++) frame(16.7);
tap(pid++);                                       // card -> level 1

const levelAt = { 1: 0 };
let guard = 0, placedByEndL2 = null, placedByEndL3 = null;
/* THE EXAM IS LEVEL 4 NOW. Teaching runs through level 3 — the two compound
   shapes moved there so they get room instead of arriving 22 dl-seconds apart
   at the end of level 2 — so the acceptance criterion moved with them. */
while (st('G.level') < 4 || st('age()') < 30) {
  if (++guard > 90000) { fail.push('never reached level 4 + 30s in 25 sim minutes'); break; }
  frame(16.7);
  if (guard % 30 === 0) st('G.invuln=1e12');      // an immortal playtester
  if (guard % 300 === 0 && st("G.state==='playing'") && st('G.nRings') > 1) {
    hopFlip = !hopFlip;                           // a player who uses both verbs
    fire('win:keydown', { code: hopFlip ? 'ArrowDown' : 'ArrowUp', preventDefault() {} });
  }
  const b = st('G.banner&&G.banner.str');
  if (b && b !== lastBanner) banners.push([st('G.level'), b]);
  lastBanner = b || lastBanner;
  if (st("G.state==='lvend'")) {
    for (let i = 0; i < 60; i++) frame(16.7);
    const lv = st('G.lvCard&&G.lvCard.next');
    /* The placed flags reset each startGame, so each level's record is read at
       its completion card, before the next level wipes them.
       THE GUARANTEES ARE NO LONGER ALL ON LEVEL 2. Six of the seven orbs used
       to be met by the end of level 2 while levels 3 and 4 introduced nothing;
       the owner's rebalance spreads them, so SPOTLIGHT's guarantee starts at
       level 3 and the black hole's at level 4.
       HONEST LIMIT ON WHAT THIS PROVES. The placed flags reset at every
       startGame, so a guarantee written as `level >= N` fires on N and every
       level after it. Both the old rule and the new one therefore place a
       spotlight by the end of level 3, and no assertion here can tell them
       apart — this checks that every orb is REACHED by the level its guarantee
       names, which is the thing that matters to a player, not which line
       forced it. The level-2 spot check was removed rather than moved because
       it had started passing on a one-in-eight pool roll, which is the shape
       of assertion that goes green for the wrong reason. */
    if (lv === 3 && st('G.lvCard.done') && !placedByEndL2) {
      placedByEndL2 = { hyper: st('G.hyperPlaced'), bass: st('G.bassPlaced') };
    }
    if (lv === 4 && st('G.lvCard.done') && !placedByEndL3) {
      placedByEndL3 = { spot: st('G.spotPlaced') };
    }
    tap(pid++);
    if (lv && !(lv in levelAt)) levelAt[lv] = guard;
  }
  if (st("G.state==='dead'")) { fail.push('the invulnerable player died'); break; }
}

/* the acceptance criterion: level 4 opens with nothing left to teach —
   every formation AND every musical orb has had its lesson */
const TAUGHT = ['single', 'twin', 'gate', 'drift', 'blink', 'driftgate', 'saucer',
  'blinktwin', 'bass', 'spot', 'hyper'];
const seenAtExam = st('Object.keys(G.seen).join(",")');
for (const f of TAUGHT) {
  if (!st(`G.seen['${f}']||G.seen2['${f}']`)) fail.push(`level 4 started without the ${f} lesson (seen: ${seenAtExam})`);
}
if (!placedByEndL2) fail.push('level 2 completion card never observed');
else for (const [flag, name] of [['hyper', 'hypernova'], ['bass', 'bass bomb']]) {
  if (!placedByEndL2[flag]) fail.push(`level 2 ended without the ${name} ever placed`);
}
if (!placedByEndL3) fail.push('level 3 completion card never observed');
else if (!placedByEndL3.spot) fail.push('level 3 ended without the spotlight ever placed');
/* Read off TIERS rather than written down: this line was a hardcoded 9, which
   meant ADDING A TIER ANYWHERE failed the build with a message about the wrong
   thing. The assertion that matters is that level 4 opens on the LAST rung —
   that every unlock has already happened — not that the ladder is ten long. */
const lastTier = st('TIERS.length') - 1;
if (st('G.tier') !== lastTier) fail.push(`level 4 did not open on the last tier (${lastTier}), tier=` + st('G.tier'));
if (st('G.level') !== 4) fail.push('run is not on level 4, level=' + st('G.level'));

/* banners arrive in ladder order, none of them during level 4 */
const order = banners.filter(([, b]) => b !== 'THE FINALE').map(([, b]) => b);
const ladder = ['SECOND RING', 'TWIN SHARDS', 'THIRD RING', 'GATES', 'DRIFTERS',
  'BLINKERS', 'SLIDING GATES', 'THE SAUCER', 'FLICKER PAIRS'];
const posOf = n => order.indexOf(n);
for (let i = 1; i < ladder.length; i++) {
  if (posOf(ladder[i]) >= 0 && posOf(ladder[i - 1]) >= 0 && posOf(ladder[i]) < posOf(ladder[i - 1])) {
    fail.push(`banner order broken: ${ladder[i]} before ${ladder[i - 1]}`);
  }
}
for (const [lv, b] of banners) {
  if (lv >= 4 && ladder.includes(b)) fail.push(`tier banner "${b}" fired inside level 4 — the exam introduced something`);
}

/* THE CURRICULUM IS THE SAME CURRICULUM IN CHILL, and the run above only
   proves it for skill. It is not re-driven in chill, because that would spend
   twenty simulated minutes re-deriving a property that is structural: every
   unlock is keyed off dl() and every orb guarantee off G.level, and chill
   changes how many real seconds a difficulty-second costs — not which
   difficulty-second anything happens on.
   Structural is not the same as true, so the two things that would break it
   are asserted directly. If a future mode knob ever reached the tier ladder or
   a finish line, chill would become a different game with a different
   syllabus and no other check in this repo would see it: check.mjs reads the
   table statically, smoke.mjs and dropcheck.mjs run in skill, and this file's
   own driven run does too. */
{
  const inMode = (m, expr) =>
    st(`(function(){var p=MODE;MODE='${m}';var v=(${expr});MODE=p;return v;})()`);
  const tiersOf = m => inMode(m, 'JSON.stringify(TIERS.map(t=>t.at))');
  const endsOf = m => inMode(m, 'JSON.stringify(LV.map(l=>String(l.end)))');
  if (tiersOf('chill') !== tiersOf('skill')) {
    fail.push('chill moves the tier ladder — the two modes would teach different syllabuses');
  }
  if (endsOf('chill') !== endsOf('skill')) {
    fail.push('chill moves a level finish line — a mode may change how long a level TAKES, never where it ends');
  }
  /* and the level a given dl belongs to is the same in both, which is what
     makes "the same lesson at the same point" mean anything */
  for (const d of [0, 89, 90, 214, 215, 339, 340, 900]) {
    const lvOf = m => inMode(m, `LV.filter(l=>l.dl0<=${d}).length`);
    if (lvOf('chill') !== lvOf('skill')) fail.push(`chill puts dl ${d} on a different level`);
  }
}

if (fail.length) {
  for (const f of fail) console.error('FAIL ', f);
  process.exit(1);
}
console.log('OK  the curriculum holds: every formation lessoned and every orb placed by level 4');
console.log('    banners:', banners.map(([lv, b]) => `L${lv}:${b}`).join(' · '));
