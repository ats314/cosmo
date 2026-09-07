/* @lane full */
/* Drive the current content through its frontier with an invulnerable player.
   Every available formation and reward must be encountered and explained.
   The latest level may introduce new content; adding later levels must not
   require satisfying an artificial rule that the final level teaches nothing. */
import { loadGameHtml } from './lib/game-source.mjs';
import vm from 'node:vm';
import { seededMath, seedLine } from './lib/rng.mjs';
/* PRINTED HERE, BEFORE ANY ASSERTION CAN EXIT. This harness imported
   seedLine and never called it, so the seed CI ran on never reached the
   log — and CI rotates it per run, which made every failure here a
   one-off nobody could reproduce. Both docs promised otherwise. */
console.log(seedLine('curriculum'));

const html = await loadGameHtml();
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
  Math: seededMath(), JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
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
/* THE POWERUP PICKER, off the ordinary route: it opens from the title screen's
   POWERUP TESTING bar and nothing here presses that, so this returns untouched
   on every path today. Written anyway — the same was true of the swipe chooser
   right up until the day it stalled all four harnesses. The lab must never be
   reachable from this run for another reason too: it pins the difficulty clock,
   and a curriculum walked at a frozen dl would never unlock a single tier. */
function passPowerSelect(pid) {
  if (st('G.state') !== 'powersel') return pid;
  pid = pressRect(pid, 'JSON.stringify(G.powSelRects.find(x=>x.id==="start")||null)', 'powerup-picker START');
  if (st('G.state') === 'powersel') throw new Error('START did not leave the powerup picker');
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
pid = passPowerSelect(pid);                       // never on this route — see the note
pid = passLevelSelect(pid);                       // ...-> level picker -> level 1
if (!st('G.intro')) fail.push('fresh device skipped the playable introduction');
else st('finishIntro()'); // Intro actions are driven in smoke; this probe owns the later curriculum.
/* THE CURRICULUM IS RUN IN SKILL, DELIBERATELY. Chill scales the difficulty
   clock and nothing else, so every tier and every orb arrives at the same dl
   and in the same order — the run below would prove the identical thing 40%
   slower. What actually needs guarding is that claim itself, and it is
   asserted directly at the bottom of this file rather than by re-driving. */
for (let i = 0; i < 60; i++) frame(16.7);
tap(pid++);                                       // card -> level 1

const levelAt = { 1: 0 };
let guard = 0, placedByEndL2 = null, placedByEndL3 = null;
/* Give the newest rewards enough space to follow the shield pity placements
   and any optional black-hole event during the first ninety seconds. */
const FRONTIER = st('LV.length');
while (st('G.level') < FRONTIER || st('age()') < 90) {
  if (++guard > 260000) { fail.push(`never reached level ${FRONTIER} + 90s in the sim budget`); break; }
  frame(16.7);
  if (guard % 30 === 0) st('G.invuln=1e12;G.shields=shieldMax()'); // includes escape failures
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
       HONEST LIMIT ON WHAT THIS PROVES. The placed flags are per RUN now
       (and pre-spent for any guarantee whose home level is behind a picked
       start), so a guarantee written as `level >= N` fires exactly once, on
       its home level. This harness drives one full climb from level 1, so it
       still meets each orb where its guarantee names — what it checks is that
       every orb is REACHED by that level, which is the thing that matters to
       a player, not which branch forced it. The level-2 spot check was
       removed rather than moved because
       it had started passing on a one-in-eight pool roll, which is the shape
       of assertion that goes green for the wrong reason. */
    if (lv === 3 && st('G.lvCard.done') && !placedByEndL2) {
      placedByEndL2 = { hyper: st('G.hyperPlaced'), slip: st('G.slipPlaced') };
    }
    if (lv === 4 && st('G.lvCard.done') && !placedByEndL3) {
      placedByEndL3 = { spot: st('G.spotPlaced'), trail: st('G.trailPlaced') };
    }
    tap(pid++);
    if (lv && !(lv in levelAt)) levelAt[lv] = guard;
  }
  if (st("G.state==='dead'")) { fail.push('the invulnerable player died'); break; }
}

/* All current content has a reachable lesson, including frontier rewards. */
const TAUGHT = ['single', 'twin', 'gate', 'drift', 'blink', 'driftgate', 'saucer',
  'blinktwin', 'dive', 'funnel', 'spot', 'hyper', 'mirror', 'scorch', 'slip', 'trail'];
const seenAtFrontier = st('Object.keys(G.seen).join(",")');
for (const f of TAUGHT) {
  if (!st(`G.seen['${f}']||G.seen2['${f}']`)) fail.push(`level ${FRONTIER} + 90s missed the ${f} lesson (seen: ${seenAtFrontier})`);
}
if (!placedByEndL2) fail.push('level 2 completion card never observed');
else if (!placedByEndL2.hyper) fail.push('level 2 ended without the hypernova ever placed');
else if (!placedByEndL2.slip) fail.push('level 2 ended without slipstream ever placed');
if (!placedByEndL3) fail.push('level 3 completion card never observed');
else if (!placedByEndL3.spot) fail.push('level 3 ended without the spotlight ever placed');
else if (!placedByEndL3.trail) fail.push('level 3 ended without star trail ever placed');
const reachedTier = st('TIERS.reduce((n,t,i)=>t.at<=dl()?i:n,0)');
if (st('G.tier') !== reachedTier) fail.push(`the tier ladder did not reach its current unlock (${reachedTier})`);
if (st('G.level') !== FRONTIER) fail.push(`run is not on level ${FRONTIER}, level=` + st('G.level'));
if (!st('G.slipPlaced&&G.trailPlaced')) fail.push('the run did not offer both new rewards');

/* Banners arrive in ladder order wherever their unlock is scheduled. */
const order = banners.filter(([, b]) => b !== 'COLLECT THE STARS').map(([, b]) => b);
const ladder = ['SECOND RING', 'TWIN SHARDS', 'THIRD RING', 'GATES', 'DRIFTERS',
  'BLINKERS', 'SLIDING GATES', 'THE SAUCER', 'FLICKER PAIRS', 'DIVERS', 'THE NARROWS'];
const posOf = n => order.indexOf(n);
for (let i = 1; i < ladder.length; i++) {
  if (posOf(ladder[i]) >= 0 && posOf(ladder[i - 1]) >= 0 && posOf(ladder[i]) < posOf(ladder[i - 1])) {
    fail.push(`banner order broken: ${ladder[i]} before ${ladder[i - 1]}`);
  }
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
console.log(`OK  current curriculum reached and explained through level ${FRONTIER}, including slipstream and star trail`);
console.log('    banners:', banners.map(([lv, b]) => `L${lv}:${b}`).join(' · '));
