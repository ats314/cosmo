/* @lane full */
/* Headless smoke test: stub enough DOM/canvas to LOAD the game script, run
   frames, and drive input through the real handlers. Catches TDZ, load-order,
   null-deref and typo errors that a parse check cannot. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { seededMath, seedLine } from './lib/rng.mjs';

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
  location: { origin: 'https://x.test', pathname: '/', search: '', replace(u) { this.__replaced = u; } },
  console,
  Math: seededMath(), JSON, Date, Array, Object, Number, String, Boolean, Float32Array, Infinity, NaN,
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
console.log(seedLine('smoke'));

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
const pev = (id, x, y, type) => ({
  pointerId: id, clientX: x, clientY: y, type: type || 'pointerup', preventDefault() {},
});

/* THE FRONT OF THE GAME IS THREE SCREENS, AND EVERY HARNESS HAS TO CROSS ALL
   OF THEM. A fixed tap at (200,400) used to be enough because the menu did
   exactly one thing; it now carries two mode cards that SELECT rather than
   start, and the level picker after it deliberately starts nothing from its
   background. So each screen is crossed by pressing its real control, read
   out of the rects the draw pass publishes — the same technique the swipe
   chooser needed, for the same reason. */
function pressRect(st, frame, fire, pev, pid, expr, what) {
  for (let i = 0; i < 30; i++) frame(16.7);      // a draw pass fills the rects
  const r = JSON.parse(st(expr) || 'null');
  if (!r) throw new Error(`no ${what} control was drawn`);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
  fire('pointerup', { ...pev(pid, x, y, 'pointerup'), type: 'pointerup' });
  return pid + 1;
}
const startRect = 'JSON.stringify(G.menuRects.find(x=>x.id==="start")||null)';
const lvStartRect = 'JSON.stringify(G.lvSelRects.find(x=>x.id==="start")||null)';
/* A FOURTH FRONT SCREEN, reachable only through the title screen's POWERUP
   TESTING bar — so the ordinary route into a run never meets it and this
   helper returns untouched on every existing path. It exists anyway, and in
   all three harnesses, because the last screen added to the front of the game
   broke all four of them by being a screen they did not know to press: a
   harness that taps a fixed point does not fail on an unexpected picker, it
   waits there forever. If the lab ever moves onto the ordinary path, the
   crossing is already written. */
const powStartRect = 'JSON.stringify(G.powSelRects.find(x=>x.id==="start")||null)';
function passPowerSelect(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'powersel') return pid;
  pid = pressRect(st, frame, fire, pev, pid, powStartRect, 'powerup-picker START');
  if (st('G.state') === 'powersel') throw new Error('START did not leave the powerup picker');
  return pid;
}
function passMenu(st, frame, fire, pev, pid) {
  if (st('G.state') !== 'menu') return pid;
  pid = pressRect(st, frame, fire, pev, pid, startRect, 'menu START');
  if (st('G.state') === 'menu') throw new Error('START did not leave the title screen');
  return pid;
}
/* Picks a level and presses START. `level` undefined leaves the selection
   alone, which is what an ordinary pass through the screen does. */
function passLevelSelect(st, frame, fire, pev, pid, level) {
  if (st('G.state') !== 'levelsel') return pid;
  for (let i = 0; i < 30; i++) frame(16.7);
  if (level !== undefined) {
    const r = JSON.parse(st(`JSON.stringify(G.lvSelRects.find(x=>x.lv===${level})||null)`) || 'null');
    if (!r) throw new Error(`the level picker drew no row for level ${level}`);
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    fire('pointerdown', { ...pev(pid, x, y, 'pointerdown'), type: 'pointerdown' });
    fire('pointerup', { ...pev(pid++, x, y, 'pointerup'), type: 'pointerup' });
    if (st('G.lvSel') !== level) throw new Error(`tapping level ${level} did not select it`);
  }
  pid = pressRect(st, frame, fire, pev, pid, lvStartRect, 'level-picker START');
  if (st('G.state') === 'levelsel') throw new Error('START did not leave the level picker');
  return pid;
}

try {
  const st = expr => vm.runInContext(expr, sandbox);
  // menu: run 15s of frames so the demo loop cycles (spawn, reverse, hops)
  for (let i = 0; i < 900; i++) frame(16.7);
  console.log('menu+demo ok');
  // start the game from the title screen's START — a FRESH device passes
  // through the swipe chooser, then the level picker, then the LIFT OFF card
  // (the calm pre-teaching screen), one tap each, once per device
  let mpid = passMenu(st, frame, fire, pev, 900);
  mpid = passSwipeChooser(st, frame, fire, pev, mpid);
  if (st('G.state') !== 'levelsel') throw new Error('the swipe chooser did not hand off to the level picker, state=' + st('G.state'));
  mpid = passPowerSelect(st, frame, fire, pev, mpid);
  mpid = passLevelSelect(st, frame, fire, pev, mpid);
  if (st('G.state') !== 'lvend') throw new Error('fresh device did not get the level-1 card, state=' + st('G.state'));
  for (let i = 0; i < 60; i++) frame(16.7);
  fire('pointerdown', pev(1, 200, 400, 'pointerdown'));
  fire('pointerup', pev(1, 200, 400, 'pointerup'));
  for (let i = 0; i < 60; i++) frame(16.7);
  if (st('G.state') !== 'playing') throw new Error('card tap did not start the run, state=' + st('G.state'));
  console.log('game start ok (through the first-run card)');
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
  // AUTO-REPEAT IS NOT AN INPUT. Hold a key and the OS fires keydown 15-30x a
  // second; every branch of the handler is a discrete action, so a held Space
  // used to call reverse() about twenty times a second and pin the comet
  // inside 0.23 rad for a whole run. Guarded here rather than trusted: this is
  // invisible to every other assertion, because a synthetic keydown carries no
  // `repeat` flag unless the harness sets one -- which is exactly how it
  // survived a keyboard test that has existed the whole time.
  // The burst is an ODD number of presses on purpose. The first version of this
  // test fired twenty and asserted on G.dir, which passed with the guard
  // REMOVED: twenty flips is an even number, so the direction landed exactly
  // where it started and the assertion proved nothing. Both checks below now
  // fail on an unguarded handler -- verified by removing the guard and watching
  // this block go red, which is the only thing that makes a regression test a
  // test rather than a comment.
  {
    const dir0 = st('G.dir'), N = 21;
    let a = st('G.angle'), net = 0;
    for (let i = 0; i < N; i++) {
      fire('win:keydown', { code: 'Space', repeat: true, preventDefault() {} });
      frame(16.7);
      const b = st('G.angle');
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      net += d; a = b;
    }
    if (st('G.dir') !== dir0) throw new Error('a repeated Space reversed the comet');
    // the symptom itself: the comet keeps covering ground instead of vibrating
    // in place. Unguarded, the flips cancel and |net| collapses toward zero.
    const expect = st('G.speed') * N * 0.0167;
    if (Math.abs(net) < expect * 0.5) {
      throw new Error(`a held key pinned the comet: ${net.toFixed(3)} rad travelled, ~${expect.toFixed(3)} expected`);
    }
    // and the first press of a real hold still reverses
    fire('win:keydown', { code: 'Space', repeat: false, preventDefault() {} });
    frame(16.7);
    if (st('G.dir') === dir0) throw new Error('a non-repeat Space did not reverse the comet');
    st(`G.dir=${dir0}`);
  }
  console.log('key auto-repeat ignored ok');
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

  // ---- the two swipe rules ----
  // They must AGREE at the sides of the loop and INVERT at the bottom; that is
  // the entire content of the choice, and a swipeOut() that stopped inverting
  // would leave two identically-behaving options on a screen built to
  // distinguish them.
  const rule = (mode, ang, dx, dy) =>
    st(`(function(){var m=SWIPE_MODE;SWIPE_MODE='${mode}';` +
       `var r=swipeOut(${dx},${dy},${ang});SWIPE_MODE=m;return r;})()`);
  const TOPA = -Math.PI / 2, BOTA = Math.PI / 2;
  if (rule('screen', TOPA, 0, -1) !== true) throw new Error('screen rule: up is not out at the top');
  if (rule('screen', BOTA, 0, -1) !== true) throw new Error('screen rule: up must be out EVERYWHERE');
  if (rule('radial', TOPA, 0, -1) !== true) throw new Error('radial rule: up is not out at the top');
  if (rule('radial', BOTA, 0, -1) !== false) throw new Error('radial rule: up must be IN at the bottom');
  if (rule('screen', BOTA, 0, -1) === rule('radial', BOTA, 0, -1))
    throw new Error('the two swipe rules do not differ at the bottom of the loop — the chooser is meaningless');
  // and the sentence must follow the rule, or the menu describes the other game
  const wS = st("(function(){var m=SWIPE_MODE;SWIPE_MODE='screen';var w=swipeWords();SWIPE_MODE=m;return w;})()");
  const wR = st("(function(){var m=SWIPE_MODE;SWIPE_MODE='radial';var w=swipeWords();SWIPE_MODE=m;return w;})()");
  if (wS === wR) throw new Error('swipeWords() says the same thing for both rules');
  if (!/up or down/.test(wS)) throw new Error('the screen rule is not described as up/down: ' + wS);
  console.log('swipe rules ok: agree up top, invert at the bottom; wording follows');

  // ---- teaching invariants (the mechanic-explanations pass) ----
  // the curriculum rule: every tier is introduced by level 3's finish line,
  // and STORM sits exactly on level 4's floor — the exam teaches nothing.
  // Read by index off LV so moving a level moves the assertion with it.
  // THE BOUNDARY IS THE LAST TEACHING LEVEL, derived rather than indexed. This
  // was LV[2] — level 3's finish line — which stopped being the boundary the
  // day teaching was extended through level 5. LV.length-2 is the last level
  // that HAS a finish line; LV.length-1 is the exam.
  if (!st('TIERS.every(t=>t.at<=LV[LV.length-2].end)')) throw new Error('a tier unlocks inside the exam level');
  if (st('TIERS[TIERS.length-1].at') !== st('LV[LV.length-2].end')) throw new Error('the last tier is not aligned to the exam level\'s floor');
  // every spawnable formation and every reward orb carries a lesson
  if (!st("TIERS.every(t=>!t.type||!!MEET[t.type])")) throw new Error('a tier type has no MEET lesson');
  if (!st("['spot','hyper','lapcost'].every(k=>MEET[k]&&MEET[k].soft)")) throw new Error('a reward lesson lost its no-slow-mo flag');
  // ONE SENTENCE PER IDEA. A tier banner's sub and its formation's lesson are
  // the same rule said twice — when they drifted into paraphrases the player
  // was asked to notice that "every ring blocked", "every ring is blocked" and
  // "gates want you to turn back" were one instruction, not three. They are
  // literally identical strings now, and this is what keeps them that way.
  // (the opening `single` tier has no banner and so no sub — nothing to match)
  const drifted = st("JSON.stringify(TIERS.filter(t=>t.type&&t.sub&&t.sub!==MEET[t.type].t).map(t=>t.name))");
  if (drifted !== '[]') throw new Error('a tier sub drifted from its lesson: ' + drifted);
  // and no channel may go back to claiming red kills outright: it costs a
  // shield, and every run starts with two. The one place that phrase is legal
  // is the popup fired at the moment the bank actually empties.
  const lies = st("JSON.stringify(Object.keys(MEET).filter(k=>/red kills/.test(MEET[k].t)))");
  if (lies !== '[]') throw new Error('a lesson says red kills you outright: ' + lies);
  // FLICKER PAIRS: "only one is solid" has to be true at every instant of the
  // cycle, not 90% of it. Walk a full period at 120 samples and require
  // exactly one armed member throughout — both-armed is the death a player
  // takes while doing precisely what the lesson told them to do.
  const pair = st(
    "(function(){var a={blink:true,bo:0,duty:0.5,bt:0},b={blink:true,bo:BLINK*0.5,duty:0.5,bt:0}," +
    "both=0,none=0;for(var i=0;i<120;i++){a.bt=b.bt=BLINK*i/120;" +
    "var x=armed(a),y=armed(b);if(x&&y)both++;if(!x&&!y)none++;}return both+','+none;})()");
  if (pair !== '0,0') throw new Error('flicker pair is not strictly alternating (both,none = ' + pair + ')');
  console.log('teaching text is one voice ok; flicker pair strictly alternates');
  // a landed hop must not cancel a 'see' lesson (only the hop rehearsal)
  st("G.teach=2;G.teachKind='see';G.teachHint=MEET.single;G.teachType='single';" +
     "G.nRings=Math.max(2,G.nRings);G.hopP=1;G.ringI=0");
  fire('win:keydown', { code: 'ArrowDown', preventDefault() {} });
  if (st('G.teach') <= 0) throw new Error('a landed hop cancelled a see-lesson');
  st("G.teach=0;G.teachHint=null;G.teachType=null");
  console.log('lesson survives a hop ok');
  // a level-2 start is honest: no forged didHop, three rings, tier pre-climbed,
  // and the layer ladder seeded from the carried score (no false NEW LAYER)
  st("G.level=2;G.carryScore=2000");
  st('startGame()');
  if (st('G.didHop') !== false) throw new Error('level-2 start forged didHop');
  if (st('G.nRings') !== 3) throw new Error('level-2 must open with three rings');
  if (st('G.tier') < 3) throw new Error('level-2 tier not pre-climbed');
  if (st('G.layerN') !== 2) throw new Error('layer ladder not seeded from carried score, layerN=' + st('G.layerN'));
  console.log('level-2 start ok');
  // a death to a taught type re-arms its lesson exactly once (seen2 caps it),
  // and every named killer gets a coach line
  st("G.seen.gate=1;delete G.seen2.gate;G.lastHit='gate'");
  st('die()');
  if (st('G.seen.gate')) throw new Error('death did not re-arm the gate lesson');
  if (!st('G.seen2.gate')) throw new Error('re-arm did not spend seen2');
  st("G.state='playing';G.seen.gate=1;G.lastHit='gate'");
  st('die()');
  if (!st('G.seen.gate')) throw new Error('re-arm fired twice for the same type');
  st("G.state='playing';G.didHop=true;G.lastHit='drift'");
  st('die()');
  if (!st('G.coach&&G.coach.t')) throw new Error('a drift death coaches nothing');
  console.log('death re-arm + coach ok');
  // a level-2 retry passes through the level card (the calm re-read),
  // then a card tap restarts the same level
  for (let i = 0; i < 60; i++) frame(16.7);
  fire('pointerdown', pev(11, 200, 400, 'pointerdown'));
  fire('pointerup', pev(11, 200, 400, 'pointerup'));   // fast-forward the reveal
  for (let i = 0; i < 10; i++) frame(16.7);
  fire('pointerdown', pev(12, 200, 400, 'pointerdown'));
  fire('pointerup', pev(12, 200, 400, 'pointerup'));   // retry -> the card
  if (st('G.state') !== 'lvend') throw new Error('level-2 retry skipped the level card, state=' + st('G.state'));
  for (let i = 0; i < 60; i++) frame(16.7);
  fire('pointerdown', pev(13, 200, 400, 'pointerdown'));
  fire('pointerup', pev(13, 200, 400, 'pointerup'));
  if (st('G.state') !== 'playing' || st('G.level') !== 2) throw new Error('card tap did not restart level 2');
  console.log('level-2 retry card ok');

  // ONE LADDER, AND IT IS THE LEVEL LADDER. The death screen prints LEVEL n,
  // draws one pip per level, and decides FURTHEST YET — all three have to be
  // the same ordinal. They were not: the pips and the badge ran on the
  // ten-rung tier ladder under a headline naming the 1-3 level, so a device
  // whose record was level 3 could die on level 2 and be congratulated for
  // getting further. These assertions are what stops that drifting back.
  if (st('LEVEL_MAX') !== st('LV.length')) throw new Error('the drawn ladder is not the level ladder, LEVEL_MAX=' + st('LEVEL_MAX'));
  const dieAt = (level, record) => {
    st(`G.state='playing';G.level=${level};G.lvlMax=${record};G.score=0;G.started=G.t;G.lastHit=null`);
    st('die()');
    return st('G.newLevel');
  };
  if (dieAt(1, 1)) throw new Error('level 1 announced FURTHEST YET — every run starts there');
  if (!dieAt(2, 1)) throw new Error('a first level-2 death did not announce FURTHEST YET');
  if (st('G.lvlMax') !== 2 || store['cometloop:gl'] !== '2') throw new Error('the level record did not move at death');
  if (dieAt(2, 2)) throw new Error('FURTHEST YET fired again at a depth already recorded');
  if (dieAt(2, 3)) throw new Error('a level-2 death beat a level-3 record');
  if (store['cometloop:level'] !== undefined) throw new Error('the retired tier-scale level key was written');
  // the shared bar counts the same ladder the shared headline names
  st("G.level=2;G.tier=5;G.score=1234;G.deadT=G.t");
  const share = st('runSummary()');
  // read the denominator from the table, not from a literal — this assertion
  // hardcoded /3 and failed the moment a fourth level was added, which is the
  // guard working, but the guard should be checking agreement rather than count
  if (!new RegExp('LEVEL 2\\/' + st('LEVEL_MAX')).test(share)
      || (share.match(/[◆◇]/g) || []).length !== st('LEVEL_MAX')) {
    throw new Error('share text and its bar disagree on the ladder: ' + share.split('\n').slice(0, 2).join(' / '));
  }
  console.log('level ladder + FURTHEST YET ok');

  // BLACK HOLE MODE. Nothing else in the gate can reach this: it is a rare orb
  // on level 3+, so a harness that plays honestly will almost never trigger
  // one, and every assertion below would sit unexercised behind that dice roll
  // for as long as the mode exists. Driven directly instead.
  // The thing actually being protected is the ORBITS MOVING. RADII stopped
  // being a constant so the mode could re-space all four rings, and every
  // radius, hit tolerance and clearance in the file now reads a value that can
  // change mid-run. If the warp ever fails to put it back, the arena is
  // silently wrong for the rest of the session and nothing else would notice.
  {
    st("G.state='playing';G.level=3;G.score=0;G.lastHit=null;G.invuln=G.t+1e9");
    st('startGame()');
    for (let i = 0; i < 4; i++) frame(16.7);
    const rings0 = st('G.nRings'), rad0 = JSON.parse(st('JSON.stringify(RADII)'));
    const cap0 = st('shardCap()'), gap0 = st('spawnGap()');
    if (st('bhActive()')) throw new Error('a black hole was already running at level start');
    st('startBlackHole()');
    for (let i = 0; i < 70; i++) frame(16.7);          // past the 0.85s warp
    if (st('BH.phase') !== 2) throw new Error('the black hole never reached full mode, phase=' + st('BH.phase'));
    if (st('G.nRings') !== 4) throw new Error('black hole mode did not open the fourth ring, nRings=' + st('G.nRings'));
    if (st('radiusOf(3)') <= 0) throw new Error('the fourth ring has no radius');
    // it must be REACHABLE, not merely drawn: a ring you cannot hop to is scenery
    /* the score is sampled BEFORE the hop: the horizon bonus fires the frame
       the comet lands on the fourth ring, so a sample taken afterwards is
       already post-payment and the assertion reads as a silent zero */
    const scoreH = st('G.score');
    st('G.ringI=2;G.hopP=1'); st('hop(1)');
    /* 40 frames, not 20: the hop DILATES inside the black hole now, so a 0.14s
       HOP takes 0.14/0.42 = 0.333s of real time against a 20-frame window of
       0.334s. That passed by under one frame, which in a harness this file
       already documents as non-deterministic is a flake waiting to happen. */
    for (let i = 0; i < 40; i++) frame(16.7);
    if (st('G.ringI') !== 3) throw new Error('could not hop onto the fourth ring, ringI=' + st('G.ringI'));
    /* THE HORIZON BONUS. The fourth ring is the mode's one structural
       novelty and arriving on it used to be worth exactly what arriving
       anywhere else was worth. Reaching it pays once per black hole and
       ignites the display; assert both the payment and the flag, because a
       silent zero here is indistinguishable from the feature being absent. */
    if (!st('BH.lit')) throw new Error('reaching the fourth ring did not claim the horizon bonus');
    if (!(st('G.score') >= scoreH + st('BH_HORIZON'))) {
      throw new Error('the horizon bonus paid nothing, score ' + scoreH + ' -> ' + st('G.score'));
    }
    if (!(st('BH.igT') > 0)) throw new Error('the horizon display never ignited');
    /* And it is once per mode, not once per arrival — no farming by hopping.
       The assertion is "less than another BH_HORIZON", not "unchanged": the
       board keeps paying ordinary score while these 40 frames run, so an
       exact-equality check is really asserting that no star was collected,
       which is luck. It passed locally and failed on CI for precisely that
       reason — the harnesses are non-deterministic and this file says so. */
    st('G.stars.length=0');
    const scoreH2 = st('G.score');
    st('G.ringI=2;G.hopP=1'); st('hop(1)');
    for (let i = 0; i < 40; i++) frame(16.7);
    if (st('G.score') >= scoreH2 + st('BH_HORIZON')) {
      throw new Error('the horizon bonus paid twice in one black hole, ' +
                      scoreH2 + ' -> ' + st('G.score'));
    }
    if (!(st('shardCap()') > cap0)) throw new Error('black hole mode did not raise the shard cap');
    if (!(st('spawnGap()') < gap0)) throw new Error('black hole mode did not shorten the spawn gap');
    if (!(st('G.tsCur') < 0.98)) throw new Error('black hole mode is not in slow motion, tsCur=' + st('G.tsCur'));
    /* THE GRAVITY PULL HAS A DIRECTION AND NOTHING WAS WATCHING IT. It shipped
       inverted: RAD_BH is [1.0,0.80,0.62,0.45], so index 0 is the OUTERMOST
       orbit, and `G.ringI--` walked the comet outward to the widest, safest,
       emptiest ring and then stopped there forever because the guard was
       `G.ringI>0`. The code and its comment used "ring 0" to mean opposite
       things, which is exactly the kind of error a reader cannot catch and a
       harness can. Park on the outer ring, wait past one pull interval, and
       require that the singularity dragged the comet TOWARD the centre —
       which, with indices, means the index went UP. */
    /* THE PULL TESTS TAKE LONGER THAN THE MODE DOES. Three BH_PULL intervals
       plus a direction probe is ~19s against a 17s BH_DUR, so the clock is
       rewound between them — this block asserts the PULL, and the duration is
       separately asserted by the ride-out check below. Without the rewind the
       black hole simply ends mid-test and every later assertion in this block
       runs outside the mode, which is how "a power-up was placed inside black
       hole mode" appears as a failure of something that never happened. */
    st('G.ringI=0;G.hopP=1;BH.pullT=0;BH.t=0');
    for (let i = 0; i < 60 * 6; i++) { frame(16.7); st('BH.t=Math.min(BH.t,1)'); }
    if (!(st('G.ringI') > 0)) {
      throw new Error('the gravity pull did not drag the comet inward, ringI=' + st('G.ringI'));
    }
    if (st('radiusOf(G.ringI)') >= st('radiusOf(0)')) {
      throw new Error('the gravity pull moved the comet to a LARGER radius — it is inverted');
    }
    /* AND IT MUST NOT BANK INTERVALS AT THE BOTTOM. Sitting on the innermost
       orbit used to leave pullT accumulating past BH_PULL forever, so the next
       outward swipe was cancelled by a pull that fired on the frame the hop
       landed — the player pinned to the densest ring with no counter. Park at
       the bottom, run three intervals, and require the timer is not overdue. */
    st('G.ringI=G.nRings-1;G.hopP=1;BH.pullT=0;BH.t=0');
    for (let i = 0; i < 60 * 13; i++) { frame(16.7); st('BH.t=Math.min(BH.t,1)'); }
    if (st('BH.pullT') >= st('BH_PULL')) {
      throw new Error('the gravity pull banked intervals at the innermost ring, pullT=' + st('BH.pullT'));
    }
    st('G.ringI=0;G.hopP=1');
    for (let i = 0; i < 6; i++) { frame(16.7); st('BH.t=Math.min(BH.t,1)'); }
    if (st('G.ringI') !== 0) throw new Error('an outward escape was cancelled on the frame it landed');
    st('BH.t=0');   // hand the mode back its full clock for the checks below
    // no orbs inside the mode
    st('G.pows.length=0;G.powT=0');
    for (let i = 0; i < 60; i++) frame(16.7);
    if (st('G.pows.length') !== 0) throw new Error('a power-up was placed inside black hole mode');
    // ride it out from the ring that is about to stop existing
    for (let i = 0; i < 60 * 20; i++) { frame(16.7); if (!st('bhActive()')) break; }
    if (st('bhActive()')) throw new Error('the black hole never ended');
    if (st('G.nRings') !== rings0) throw new Error('the ring count did not come back, nRings=' + st('G.nRings'));
    if (st('G.ringI') >= st('G.nRings')) throw new Error('the player was left on a ring that no longer exists, ringI=' + st('G.ringI'));
    const rad1 = JSON.parse(st('JSON.stringify(RADII)'));
    for (let i = 0; i < rad0.length; i++) {
      if (Math.abs(rad0[i] - rad1[i]) > 1e-6) {
        throw new Error(`the orbits did not return: RADII[${i}] ${rad0[i]} -> ${rad1[i]}`);
      }
    }
    if (st('shardCap()') !== cap0) throw new Error('the shard cap stayed raised after the black hole');
    if (!(st('G.score') > 0)) throw new Error('surviving a black hole paid nothing');
  }
  console.log('black hole: four rings, warped and restored ok');

  // death during a black hole must not award the escape bonus or open the 4th ring
  {
    st("G.state='playing';G.level=3;G.score=0;G.lastHit=null;G.invuln=G.t+1e9");
    st('startGame()');
    for (let i = 0; i < 4; i++) frame(16.7);
    const rings0 = st('G.nRings'), score0 = st('G.score');
    st('startBlackHole()');
    for (let i = 0; i < 70; i++) frame(16.7);          // past the 0.85s warp
    if (st('BH.phase') !== 2) throw new Error('BH death test: never reached full mode');
    if (st('G.nRings') !== 4) throw new Error('BH death test: fourth ring did not open');
    // die in the middle of the mode
    const scoreBefore = st('G.score');
    st('die()');
    if (st('G.state') !== 'dead') throw new Error('BH death test: die() did not kill');
    if (st('BH.phase') !== 3) throw new Error('BH death test: die() did not skip to closing phase, phase=' + st('BH.phase'));
    // run the death screen long enough for the mode to have ended if still ticking
    for (let i = 0; i < 60 * 25; i++) frame(16.7);
    if (st('bhActive()')) throw new Error('BH death test: closing warp never finished');
    // the escape bonus must NOT have been awarded
    if (st('G.score') > scoreBefore) throw new Error('BH death test: escape bonus was awarded to a dead player');
    // the orbits must still come back
    if (st('G.nRings') !== rings0) throw new Error('BH death test: ring count wrong after death, nRings=' + st('G.nRings'));
  }
  console.log('black hole death: no post-mortem escape bonus ok');

  // THE CLEARANCE FOLLOWS TRAVEL, NOT POSITION. This is a placement rule, so
  // nothing that plays the game can assert it directly — a run either meets a
  // shard or does not, and the reason is invisible. Tested at the function.
  // The property is asymmetry: a full reaction-time gap AHEAD along the heading,
  // a short pad behind, and the pad measured in TIME so it cannot quietly shrink
  // as the game speeds up. Symmetric clearance is what let an oscillating player
  // sit in a sanctuary no static shard could ever be placed inside.
  {
    st("G.state='playing';G.level=1");
    st('startGame()');
    for (let i = 0; i < 4; i++) frame(16.7);
    st('G.spikes.length=0;G.stars.length=0;G.pows.length=0');
    st('G.angle=1.0;G.dir=1;G.speed=2.0');
    const at = (off, ring) => st(`farFromAll(1.0+(${off}),${ring === undefined ? 0 : ring},1.1,0.5,0.5,behindPad())`);
    if (at(0.5)) throw new Error('a shard was placed 0.5 rad AHEAD, inside the reaction gap');
    if (at(1.05)) throw new Error('a shard was placed 1.05 rad ahead, inside the reaction gap');
    if (!at(1.6)) throw new Error('a shard could not be placed 1.6 rad ahead, outside the gap');
    // behind: rejected right on top of the comet, allowed a little further back
    if (at(-0.2)) throw new Error('a shard was placed on top of the comet from behind');
    if (!at(-1.0)) throw new Error('the arc behind the comet never fills in — the sanctuary is back');
    // reversing swaps which side is which, because the rule reads the heading
    st('G.dir=-1');
    if (!at(1.0)) throw new Error('after a reversal the abandoned arc did not open up');
    if (at(-1.05)) throw new Error('after a reversal the new forward gap was not protected');
    st('G.dir=1');
    // the pad is a time: faster comet, wider pad
    const padSlow = st('G.speed=1.4,behindPad()'), padFast = st('G.speed=4.2,behindPad()');
    if (!(padFast > padSlow)) throw new Error(`the behind pad did not widen with speed: ${padSlow} -> ${padFast}`);
    // A GATE ON THE BOARD SUSPENDS ALL OF IT. A gate exists to force a reversal
    // and reverseEscape vets that reversal at spawn time; a later spawn behind
    // the player could invalidate it, so the bubble goes symmetric while a wall
    // is live. Without this the one formation that demands a turn becomes the
    // one that punishes it.
    st('G.speed=2.0');
    st("G.spikes.push({a:4.0,ring:0,t:0,phase:0,gate:true,warn:2,life:3,va:0,blink:false,bo:0,bt:0})");
    if (st('behindPad()') !== 0) throw new Error('the behind pad stayed open while a gate was live');
    // 1.0 rad behind was placeable a moment ago; with a wall up it must not be,
    // because that is the arc the forced reversal has to open onto
    if (at(-1.0)) throw new Error('a live gate did not restore symmetric clearance');
    st('G.spikes.length=0');
  }
  console.log('clearance follows travel, not position ok');

  // ---- THE MODE TABLE STILL REACHES THE CURVES ----
  // CHILL IS RETIRED, but the mechanism it proved is not, and this is the
  // test that keeps it honest with no second mode shipped.
  //
  // The static half lives in check.mjs (skill is the identity, no dead knobs).
  // What that cannot see is whether the knobs REACH the curves: a table of
  // multipliers wired to nothing parses, has no dead entries by its own
  // lights, and would let a future mode ship playing identically to skill.
  // Deleting this test with chill would mean discovering that the day someone
  // adds a row — which is the worst possible day to discover it.
  //
  // So it injects a synthetic mode instead: every knob deliberately off
  // neutral, in the direction an easier mode would take them, and measures
  // every curve through the real functions at the same difficulty second.
  // The probe is torn down afterwards and never touches REC or MODE's saved
  // value.
  {
    const probe = `MODES.__probe={id:'__probe',name:'PROBE',tag:'',c:'#fff',` +
      `clock:0.72,speed:0.86,warn:1.3,cap:0.78,gap:1.3,shields:1,demo:0.62}`;
    st(probe);
    const inMode = (m, expr) =>
      st(`(function(){var p=MODE;MODE='${m}';var v=(${expr});MODE=p;return v;})()`);
    // pin the clock: age() feeds dl(), so hold G.t/G.started and compare the
    // curves rather than two runs going for different lengths
    st("G.state='playing';G.level=1;G.started=0;G.t=200;G.diff=0");
    const skill = {
      dl: inMode('skill', 'dl()'), speed: inMode('skill', 'speedAt()'),
      warn: inMode('skill', 'warnTime()'), cap: inMode('skill', 'shardCap()'),
      gap: inMode('skill', 'spawnGap()'),
    };
    const pr = {
      dl: inMode('__probe', 'dl()'), speed: inMode('__probe', 'speedAt()'),
      warn: inMode('__probe', 'warnTime()'), cap: inMode('__probe', 'shardCap()'),
      gap: inMode('__probe', 'spawnGap()'),
    };
    if (!(pr.dl < skill.dl)) throw new Error(`the clock knob does not reach dl(): ${pr.dl} vs ${skill.dl}`);
    if (!(pr.speed < skill.speed)) throw new Error(`the speed knob does not reach speedAt(): ${pr.speed} vs ${skill.speed}`);
    if (!(pr.warn > skill.warn)) throw new Error(`the warn knob does not reach warnTime(): ${pr.warn} vs ${skill.warn}`);
    if (!(pr.cap <= skill.cap)) throw new Error(`the cap knob does not reach shardCap(): ${pr.cap} vs ${skill.cap}`);
    if (!(pr.gap > skill.gap)) throw new Error(`the gap knob does not reach spawnGap(): ${pr.gap} vs ${skill.gap}`);

    // AND AT EQUAL dl, so each trim is proved separately from the clock. Held
    // over from the chill tests for the reason they were written: the clock
    // alone moves every curve, so without this the trims could all be dead and
    // every comparison above would still pass, on the clock's evidence.
    const atDl = (m, expr) => st(
      `(function(){var p=MODE,t=G.t;MODE='${m}';G.t=${'${T}'};var v=(${expr});MODE=p;G.t=t;return v;})()`);
    const eq = (m, expr, T) => st(
      `(function(){var p=MODE,t=G.t,s=G.started;MODE='${m}';G.started=0;G.t=${T};` +
      `var v=(${expr});MODE=p;G.t=t;G.started=s;return v;})()`);
    // solve for the wall time at which the probe's dl matches skill's at t=200
    const target = skill.dl;
    let T = 200;
    for (let i = 0; i < 60; i++) {
      const d = eq('__probe', 'dl()', T);
      if (Math.abs(d - target) < 0.01) break;
      T *= target / Math.max(1e-6, d);
    }
    const dP = eq('__probe', 'dl()', T);
    if (Math.abs(dP - target) > 0.5) throw new Error(`could not match dl across modes (${dP} vs ${target})`);
    if (!(eq('__probe', 'speedAt()', T) < eq('skill', 'speedAt()', 200)))
      throw new Error('at equal dl the speed trim is not wired');
    if (!(eq('__probe', 'warnTime()', T) > eq('skill', 'warnTime()', 200)))
      throw new Error('at equal dl the warn trim is not wired');
    if (!(eq('__probe', 'spawnGap()', T) > eq('skill', 'spawnGap()', 200)))
      throw new Error('at equal dl the gap trim is not wired');

    // the additive shield knob reaches the bank
    st("MODE='skill';G.level=1"); st('startGame()');
    const shS = st('G.shields');
    st("MODE='__probe';G.level=1"); st('startGame()');
    const shP = st('G.shields');
    if (shP !== shS + 1) throw new Error(`the shields knob does not reach the bank: ${shP} vs ${shS}`);

    // AND A MODE MUST NEVER MOVE THE CURRICULUM. Tiers key off dl and orbs off
    // G.level, so a mode changes how many seconds a run takes to reach a rung,
    // never which rung. A knob that reached the tier ladder or a finish line
    // would make a second mode a different game rather than the same one at a
    // different pace.
    // Compared at a fixed DL, not at a fixed wall time. A slower clock reaching
    // a lower dl after the same number of seconds is the entire point of a
    // mode; what must not change is WHICH tiers have unlocked once the clock
    // reads a given value. Asserting the latter at equal wall time would fail
    // on a correct mode, which is a check that punishes the feature working.
    for (const d of [0, 90, 215, 340, 600]) {
      const ti = m => st(`(function(){var p=MODE;MODE='${m}';var v=TIERS.filter(t=>t.at<=${d}).length;MODE=p;return v;})()`);
      if (ti('__probe') !== ti('skill')) throw new Error(`a mode moved the tier ladder at dl ${d}`);
    }
    if (inMode('__probe', 'JSON.stringify(LV.map(l=>l.end))') !== inMode('skill', 'JSON.stringify(LV.map(l=>l.end))'))
      throw new Error('a mode moved a level finish line — it must take longer to reach it, not a shorter one');

    st("MODE='skill';delete MODES.__probe");
    if (st('Object.keys(MODES).length') !== 1) throw new Error('the probe mode was not torn down');
    console.log('mode table ok: every knob reaches its curve (clock, speed, warn, cap, gap, shields);',
      'curriculum untouched; one mode ships');
  }

  // ---- THE TITLE SCREEN AFTER THE MODE CARDS ----
  // The cards are gone with chill. Two things have to stay true: the screen
  // still offers START and the lab door and nothing that looks like a choice,
  // and the record still goes to the UNSUFFIXED key.
  //
  // That second one is the whole reason retiring a mode costs no player their
  // history. Every value ever written to cometloop:best was skill's, because
  // chill's went to a suffixed key precisely so it could never redefine the
  // plain one. If recKey ever starts suffixing skill, every stored record on
  // every device silently changes owner.
  {
    st("G.state='menu';G.t+=1");
    for (let i = 0; i < 30; i++) frame(16.7);
    const ids = JSON.parse(st('JSON.stringify(G.menuRects.map(r=>r.id))'));
    for (const need of ['start', 'lab']) {
      if (!ids.includes(need)) throw new Error(`the title screen drew no ${need} control: ${ids.join(',')}`);
    }
    for (const gone of ['chill', 'skill']) {
      if (ids.includes(gone)) throw new Error(`the title screen still draws a ${gone} mode card`);
    }
    // a tap on the background starts the run again — there is no longer a
    // selection on this screen that a stray tap could cost you
    fire('pointerdown', pev(600, 200, 400, 'pointerdown'));
    fire('pointerup', pev(600, 200, 400, 'pointerup'));
    if (st('G.state') === 'menu') throw new Error('a tap on the title screen did not leave it');

    st("G.state='menu'");
    for (let i = 0; i < 20; i++) frame(16.7);
    delete store['cometloop:best'];
    delete store['cometloop:best:chill'];
    st("G.state='playing';G.level=1;G.startLevel=1;G.score=999999;G.lvlMax=1;G.lastHit=null");
    st('die()');
    if (store['cometloop:best'] !== '999999')
      throw new Error('the record did not reach the unsuffixed key — every historical best is skill\'s');
    if (store['cometloop:best:chill'] !== undefined)
      throw new Error('something is still writing a chill-suffixed record');
    if (store['cometloop:mode'] !== undefined)
      throw new Error('cometloop:mode was written — there is no mode to remember');
    if (st('G.best') !== st('REC.skill.best')) throw new Error('G.best is not the mode\'s record');
    console.log('title screen ok: no mode cards, tap starts, record lands on the unsuffixed key');
  }

  // ---- the level picker, and the record it must not forge ----
  {
    st("G.state='menu';G.swipeAsked=true;G.runs=5;G.lvSel=1;G.t+=1");
    for (let i = 0; i < 30; i++) frame(16.7);
    let lpid = passMenu(st, frame, fire, pev, 700);
    if (st('G.state') !== 'levelsel') throw new Error('START did not reach the level picker, state=' + st('G.state'));
    // every level is selectable, including ones this device has never reached
    st('G.lvlMax=1');
    for (let i = 0; i < 30; i++) frame(16.7);
    const lvs = JSON.parse(st('JSON.stringify(G.lvSelRects.filter(r=>r.lv).map(r=>r.lv))'));
    if (lvs.length !== st('LEVEL_MAX')) throw new Error(`the picker drew ${lvs.length} levels, want ${st('LEVEL_MAX')}`);
    // BACK MUST HAND THE DEMO ITS RINGS BACK. The picker runs on one ring and
    // menuDemo's hop is gated on having more than one, so a menu returned to
    // this way would show the swipe caption over a comet that never changes
    // ring — the one thing the title screen exists to demonstrate, silently
    // gone, and nothing else here would have noticed.
    const back = JSON.parse(st('JSON.stringify(G.lvSelRects.find(r=>r.id==="back"))'));
    if (!back) throw new Error('the level picker drew no back control');
    fire('pointerdown', pev(lpid, back.x + back.w / 2, back.y + back.h / 2, 'pointerdown'));
    fire('pointerup', pev(lpid++, back.x + back.w / 2, back.y + back.h / 2, 'pointerup'));
    if (st('G.state') !== 'menu') throw new Error('back did not return to the title screen');
    if (!(st('G.nRings') > 1)) throw new Error('back left the menu on one ring — the demo can no longer hop');
    // watched across a full 12s demo loop rather than sampled at the end of
    // one: DEMO.hop1 is cleared every cycle, so a single read after the fact
    // says nothing about whether the hop happened
    let hopped = false;
    for (let i = 0; i < 800; i++) { frame(16.7); if (st('G.ringI') !== 0) hopped = true; }
    if (!hopped) throw new Error('the menu demo never hopped after a return from the picker');
    lpid = passMenu(st, frame, fire, pev, lpid);
    // THE PICK IS NOT PERSISTED, ON PURPOSE. The menu used to force level 1 on
    // every tap because borrowed phones inherited a device's unlock and friends
    // thought the game had skipped level 1. A remembered selection would bring
    // that back with the picker as its hiding place, so nothing may write it.
    lpid = passLevelSelect(st, frame, fire, pev, lpid, 3);
    if (st('G.startLevel') !== 3) throw new Error('the picked level was not recorded as the start level');
    for (const k of Object.keys(store)) {
      if (/lvsel|startlevel|:lv$/i.test(k)) throw new Error(`the level pick was persisted as '${k}' — a borrowed phone would inherit it`);
    }
    // level 3 goes through its own card, and the card starts level 3
    if (st('G.state') !== 'lvend') throw new Error('a picked level skipped its card, state=' + st('G.state'));
    for (let i = 0; i < 60; i++) frame(16.7);
    fire('pointerdown', pev(lpid, 200, 400, 'pointerdown'));
    fire('pointerup', pev(lpid++, 200, 400, 'pointerup'));
    if (st('G.state') !== 'playing' || st('G.level') !== 3) throw new Error('the card did not start level 3, level=' + st('G.level'));
    if (st('G.carryScore') !== 0 || st('G.score') !== 0) throw new Error('a picked start carried a previous run\'s score');
    // A PICKED START IS NOT A CLIMB. This is the whole cost of letting any
    // level be chosen, and it is paid here: dying on a level you jumped to
    // must not print FURTHEST YET or write the level record.
    const gl0 = store['cometloop:gl'];
    st("G.lvlMax=1;G.score=10;G.lastHit=null");
    st('die()');
    if (st('G.newLevel')) throw new Error('a picked level-3 start announced FURTHEST YET');
    if (st('G.lvlMax') !== 1) throw new Error('a picked start moved the level record');
    if (store['cometloop:gl'] !== gl0) throw new Error('a picked start wrote the level record to storage');
    // ...while a run that BEGAN at level 1 and climbed still counts, including
    // across the retries that put it on a later level
    st("G.state='playing';G.startLevel=1;G.level=3;G.lvlMax=1;G.score=10;G.lastHit=null");
    st('die()');
    if (!st('G.newLevel')) throw new Error('a run that started at level 1 and reached 3 was denied FURTHEST YET');
    // THE SHARE TEXT CARRIES THE QUALIFIER OR IT IS A CLAIM THE RUN DID NOT
    // EARN. Two things used to change what "LEVEL 4/4" means — the mode and
    // whether the run was picked into — and with chill retired one is left. A
    // text that travels further than the link does cannot leave it unsaid, and
    // the default run still shares the sentence that shipped, which is the
    // other half of the guard.
    st("G.level=2;G.tier=5;G.score=1234;G.deadT=G.t;G.startLevel=1");
    const plain = st('runSummary()').split('\n')[0];
    if (/CHILL|from L/.test(plain)) throw new Error('a default run qualified its share text: ' + plain);
    st("G.startLevel=3");
    if (!/from L3/.test(st('runSummary()'))) throw new Error('a picked start is not named in the share text');
    console.log('level picker ok: any level selectable, none of them forges a record;',
      'share text names a picked start');
  }

  // ---- pause ----
  // Pause is one early return in update(), which is what makes it cheap and
  // also what makes it easy to get subtly wrong: the freeze either covers
  // EVERYTHING keyed off G.t or it is a difficulty change. So the test freezes
  // a live board mid-run and asserts the whole world stopped, not just the
  // clock — and then that it starts again.
  {
    st("G.state='menu';G.swipeAsked=true;G.runs=5;G.lvSel=1;G.t+=1;LAB.on=false");
    for (let i = 0; i < 30; i++) frame(16.7);
    let ppid = passMenu(st, frame, fire, pev, 1600);
    ppid = passLevelSelect(st, frame, fire, pev, ppid, 1);
    if (st('G.state') === 'lvend') {
      for (let i = 0; i < 60; i++) frame(16.7);
      fire('pointerdown', pev(ppid, 200, 400, 'pointerdown'));
      fire('pointerup', pev(ppid++, 200, 400, 'pointerup'));
    }
    if (st('G.state') !== 'playing') throw new Error('pause test could not reach a run, state=' + st('G.state'));
    // Play far enough in that there is a real board to freeze — shards, stars,
    // maybe an orb. The bank is topped up through the warm-up because the point
    // here is the freeze, not survival: without it the run reliably died before
    // the button was ever pressed, and the failure read as "pause is broken".
    // Run until there is actually a shard on the board, rather than for a fixed
    // number of frames and hoping. The harnesses are not deterministic — shards
    // expire and respawn on unseeded rolls, so sampling at one instant found an
    // empty board about half the time and reported it as pause being broken.
    // The bank is topped up because the point here is the freeze, not survival.
    let armed = false;
    for (let i = 0; i < 3600 && !armed; i++) {
      frame(16.7);
      if (i % 30 === 0) st('G.shields=3');
      if (st('G.state') !== 'playing') throw new Error('the run died before pause could be tested');
      if (st('G.spikes.length') > 0 && st('G.t') - st('G.started') > 20) armed = true;
    }
    if (!armed) throw new Error('no shard ever reached the board — the freeze would prove nothing');
    st('PAUSE.cool=0');
    for (let i = 0; i < 5; i++) frame(16.7);
    const btn = JSON.parse(st('JSON.stringify(pauseRect())'));
    const mute = JSON.parse(st('JSON.stringify(muteRect())'));
    if (btn.x < 0 || btn.y < 0 || btn.x + btn.w > vw) throw new Error('the pause button is off screen');
    if (btn.x < mute.x + mute.w && btn.x + btn.w > mute.x
     && btn.y < mute.y + mute.h && btn.y + btn.h > mute.y) throw new Error('the pause button overlaps mute');
    // press it
    const bx = btn.x + btn.w / 2, by = btn.y + btn.h / 2;
    fire('pointerdown', pev(ppid, bx, by, 'pointerdown'));
    fire('pointerup', pev(ppid++, bx, by, 'pointerup'));
    if (!st('PAUSE.on')) throw new Error('pressing the pause button did not pause');
    if (st('G.state') !== 'playing') throw new Error('pause changed G.state — draw() would render the death screen over a live run');

    // THE WHOLE WORLD IS FROZEN, not merely the clock. Each of these is keyed
    // off G.t somewhere and each would be a live difficulty change if the
    // freeze missed it.
    const snap = () => JSON.parse(st(`JSON.stringify({t:G.t,vt:G.vt,dl:dl(),ang:G.angle,tier:G.tier,
      spikes:G.spikes.length,pos:G.spikes.map(s=>s.a+':'+s.t+':'+s.phase).join(','),
      stars:G.stars.length,pows:G.pows.length,score:G.score,shields:G.shields,
      bh:BH.phase,bht:BH.t,spikeT:G.spikeT,powT:G.powT,starT:G.starT})`));
    const a = snap();
    for (let i = 0; i < 600; i++) frame(16.7);      // ten seconds of paused frames
    const b = snap();
    for (const k of Object.keys(a)) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        throw new Error(`pause did not freeze ${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
      }
    }
    if (!(st('pausedSeconds()') > 9)) throw new Error('paused time was not accumulating for telemetry');
    // PAUSED TIME MUST BE WALL-CLOCK, NOT FRAME TIME. frame() clamps dt to
    // 0.05s and requestAnimationFrame does not fire at all while a tab is
    // hidden, so a break taken with the phone locked produces NO frames — and
    // an accumulator built on dt records the one case the field exists to
    // detect as roughly zero. Simulated by advancing the clock without running
    // a single frame, which is exactly what a locked phone does.
    const beforeGap = st('pausedSeconds()');
    nowMs += 600000;                                  // ten minutes, no frames
    const afterGap = st('pausedSeconds()');
    if (afterGap - beforeGap < 590) {
      throw new Error(`ten minutes paused with the tab hidden measured ${(afterGap - beforeGap).toFixed(2)}s `
        + '— paused time is being accumulated from the capped frame delta, not the wall clock');
    }
    // the panel answers RESUME and nothing else: a tap on the background must
    // not resume, and must certainly not fall through to reverse()
    const dir0 = st('G.dir');
    fire('pointerdown', pev(ppid, 5, vh - 5, 'pointerdown'));
    fire('pointerup', pev(ppid++, 5, vh - 5, 'pointerup'));
    if (!st('PAUSE.on')) throw new Error('a tap on the paused background resumed the run');
    if (st('G.dir') !== dir0) throw new Error('a tap while paused reversed the comet');
    // ...and neither does the keyboard play the game through the panel
    fire('doc:keydown', { code: 'ArrowUp', repeat: false, preventDefault() {} });
    if (st('G.dir') !== dir0 || st('G.hopP') < 1) throw new Error('the keyboard hopped while paused');

    const rs = JSON.parse(st('JSON.stringify(G.pauseBtn)') || 'null');
    if (!rs) throw new Error('the paused panel drew no RESUME control');
    fire('pointerdown', pev(ppid, rs.x + rs.w / 2, rs.y + rs.h / 2, 'pointerdown'));
    fire('pointerup', pev(ppid++, rs.x + rs.w / 2, rs.y + rs.h / 2, 'pointerup'));
    if (st('PAUSE.on')) throw new Error('RESUME did not close the panel');
    if (!(st('PAUSE.resumeT') > 0)) throw new Error('RESUME did not start the count-in');
    // the count-in is still frozen, and still takes no input
    const c = snap();
    for (let i = 0; i < 60; i++) frame(16.7);
    if (st('G.t') !== c.t) throw new Error('the world moved during the count-in');
    if (!st('frozen()')) throw new Error('the count-in is not reported as frozen');
    // ...and then it really does start again
    for (let i = 0; i < 200; i++) frame(16.7);
    if (st('frozen()')) throw new Error('the count-in never ended');
    if (!(st('G.t') > c.t)) throw new Error('the clock did not restart after the count-in');
    // re-pausing is on a cooldown, or pause-resume-pause is an unlimited
    // supply of three-second frozen looks at a live board
    if (st('canPause()')) throw new Error('pause re-armed immediately — the count-in can be farmed');
    for (let i = 0; i < 400; i++) frame(16.7);
    if (!st('canPause()')) throw new Error('pause never re-armed after its cooldown');
    // A CLEARED LEVEL'S PAUSES HAVE TO BE REPORTED BY SOMETHING. startGame()
    // re-baselines the counters at every level boundary and run_ended only
    // fires on death, so level_cleared is the one event that can carry them —
    // without it, every pause on a level the player survived is recorded
    // nowhere. Asserted on the payload rather than on the counters, because the
    // counters were never the thing that went missing.
    {
      const sent = [];
      st('G.__trk=[];var __tk=track;track=function(n,p){G.__trk.push(n+":"+JSON.stringify(p||{}));return __tk(n,p);}');
      st("G.state='playing';PAUSE.n=4;PAUSE.total=42;PAUSE.at=0;levelComplete()");
      const rows = JSON.parse(st('JSON.stringify(G.__trk)'));
      const lc = rows.find(r => r.startsWith('level_cleared:'));
      if (!lc) throw new Error('levelComplete did not fire level_cleared');
      const payload = JSON.parse(lc.slice('level_cleared:'.length));
      if (payload.pauses !== 4) throw new Error(`level_cleared reported pauses=${payload.pauses}, want 4 — a cleared level's pauses are lost`);
      if (payload.paused_seconds !== 42) throw new Error(`level_cleared reported paused_seconds=${payload.paused_seconds}, want 42`);
      // same scale as `seconds` beside it: both this level's, not the run's
      if (typeof payload.seconds !== 'number') throw new Error('level_cleared lost its seconds');
      sent.push(payload.pauses);
    }
    // and it is a RUN control: no pausing a menu or a death screen
    st("G.state='playing'");
    st('die()');
    if (st('canPause()')) throw new Error('the death screen offered a pause');
    st('enterMenu()');
    if (st('canPause()')) throw new Error('the title screen offered a pause');
    console.log('pause ok: world frozen for 10s (clock, board, spawns, black hole),',
      'panel answers only RESUME, count-in holds then releases, cooldown blocks farming');
  }

  // ---- the pocket ----
  // Held x8 drives G.pocket, the envelope every pocket visual reads (the
  // shader's crystallized filaments, the beat-locked sky ripples, the trail's
  // last 0.3). smoke has no AC, so judgeTiming can never climb the chain here
  // — the envelope is driven by setting G.groove directly, which is also the
  // point: it must follow G.groove alone. Attack ~a bar (2.31s), x7 sustains
  // (one slip of grace, matching the one rung a miss costs), below that it
  // drains. And these are audio-less frames with GL stubbed off: a full
  // pocket must not cost a single frame its guard.
  {
    st("G.state='menu';G.swipeAsked=true;G.runs=5;G.lvSel=1;G.t+=1;LAB.on=false");
    for (let i = 0; i < 30; i++) frame(16.7);
    let kpid = passMenu(st, frame, fire, pev, 1900);
    kpid = passLevelSelect(st, frame, fire, pev, kpid, 1);
    if (st('G.state') === 'lvend') {
      for (let i = 0; i < 60; i++) frame(16.7);
      fire('pointerdown', pev(kpid, 200, 400, 'pointerdown'));
      fire('pointerup', pev(kpid++, 200, 400, 'pointerup'));
    }
    if (st('G.state') !== 'playing') throw new Error('pocket test could not reach a run, state=' + st('G.state'));
    if (st('G.pocket') !== 0) throw new Error('a fresh run started inside the pocket');
    for (let i = 0; i < 90; i++) { frame(16.7); st('G.shields=3;G.groove=8;G.grooveT=G.t+99'); }
    const p1 = st('G.pocket');
    if (!(p1 > 0.55)) throw new Error(`held x8 for 1.5s and the pocket only reached ${p1} — the attack is broken`);
    for (let i = 0; i < 90; i++) { frame(16.7); st('G.shields=3;G.groove=8;G.grooveT=G.t+99'); }
    if (st('G.pocket') < 0.99) throw new Error('held x8 for 3s and the pocket never filled');
    for (let i = 0; i < 30; i++) { frame(16.7); st('G.shields=3;G.groove=7;G.grooveT=G.t+99'); }
    if (st('G.pocket') < 0.99) throw new Error('x7 released the pocket — one slip must be grace, not a reset');
    for (let i = 0; i < 150; i++) { frame(16.7); st('G.shields=3;G.groove=0'); }
    if (st('G.pocket') > 0.02) throw new Error('the chain let go and the pocket did not drain');
    console.log('pocket ok: fills over ~a bar at x8, x7 sustains, drains on release, audio-less frames survive it full');
  }

  // ---- the powerup lab ----
  // Two claims to prove and they fail in opposite directions. The lab must
  // DO something — hand you the orb you picked, over and over, on a board that
  // stays calm — and it must LEAVE NOTHING BEHIND. The second is the one worth
  // a harness: every guard in it is a `!LAB.on` on a line whose normal job is
  // to write to the device, and any one of them silently omitted looks exactly
  // like the others in a diff.
  {
    st("G.state='menu';G.swipeAsked=true;G.runs=5;G.t+=1;useMode('skill')");
    for (let i = 0; i < 30; i++) frame(16.7);
    let bpid = 1200;
    const bar = JSON.parse(st('JSON.stringify(G.menuRects.find(r=>r.id==="lab")||null)') || 'null');
    if (!bar) throw new Error('the title screen drew no POWERUP TESTING bar');
    // the bar must not overlap either mode card, or selecting a difficulty and
    // opening the lab are the same tap on some viewport
    const cards = JSON.parse(st('JSON.stringify(G.menuRects.filter(r=>r.id==="chill"||r.id==="skill"))'));
    for (const c of cards) {
      if (bar.y < c.y + c.h && bar.y + bar.h > c.y && bar.x < c.x + c.w && bar.x + bar.w > c.x) {
        throw new Error('the lab bar overlaps the ' + c.id + ' card');
      }
    }
    fire('pointerdown', pev(bpid, bar.x + bar.w / 2, bar.y + bar.h / 2, 'pointerdown'));
    fire('pointerup', pev(bpid++, bar.x + bar.w / 2, bar.y + bar.h / 2, 'pointerup'));
    if (st('G.state') !== 'powersel') throw new Error('the lab bar did not open the picker, state=' + st('G.state'));
    if (!st('LAB.on')) throw new Error('the picker did not arm the lab flag');
    for (let i = 0; i < 30; i++) frame(16.7);
    // every orb in the table gets a row, and each row names an orb spawnPow
    // can actually place — a picker offering a type the spawner does not know
    // would start a run that never hands you anything
    const rows = JSON.parse(st('JSON.stringify(G.powSelRects.filter(r=>r.id==="orb").map(r=>r.orb))'));
    const want = JSON.parse(st('JSON.stringify(LAB_ORBS.map(o=>o.id))'));
    if (rows.join(',') !== want.join(',')) throw new Error(`the picker drew rows ${rows} for orbs ${want}`);
    // DERIVED, NOT SIX. This read `!== 6`, which was the roster size on the day
    // it was written and stopped being true the moment THE MIRROR and SCORCH
    // were added — the same stale-literal failure as the level count in
    // musiccheck and the tier ordinals in index.html, and the third one this
    // week. The line above already compares the drawn rows against LAB_ORBS,
    // so the count adds nothing on its own; what it should have been asserting
    // is the sentence in the comment above it, which nothing checked: that
    // every orb the picker offers is one the PICKUP path actually handles. A
    // picker row for a type the game cannot resolve starts a lab run that
    // hands you an orb and then does nothing when you take it.
    if (!rows.length) throw new Error('the lab picker drew no orbs at all');
    // and NOT a hardcoded count. The first attempt at replacing it was a static
    // scan for a `s.type==='<id>'` pickup branch per orb, which fails on nova:
    // nova is the final `else` of that chain and names itself nowhere. The
    // sentence the comment promises is already proved dynamically further down
    // this file, where the lab plays EVERY LAB_ORBS row for 45 seconds and
    // counts the pickups — that test derives its list from the table and needs
    // no maintenance when the roster grows.
    const bhRow = JSON.parse(st('JSON.stringify(G.powSelRects.find(r=>r.orb==="blackhole"))'));
    fire('pointerdown', pev(bpid, bhRow.x + bhRow.w / 2, bhRow.y + bhRow.h / 2, 'pointerdown'));
    fire('pointerup', pev(bpid++, bhRow.x + bhRow.w / 2, bhRow.y + bhRow.h / 2, 'pointerup'));
    if (st('LAB_ORBS[LAB.sel].id') !== 'blackhole') throw new Error('tapping the black hole row did not select it');

    // NOTHING BELOW THIS LINE MAY REACH THE DEVICE. Snapshotted as a whole map
    // rather than key by key: the point is that a lab session is inert, and a
    // named-key check only ever catches the writes somebody remembered.
    //
    // THE STORE IS EMPTIED FIRST, and the first version of this test did not do
    // that — which is exactly how it missed three writes. Everything above has
    // already played the game, so `cometloop:hopped`, `:groove` and `:landed`
    // were all present and set to '1' before the snapshot was taken; the lab
    // then wrote '1' over '1' and a before/after comparison saw nothing. A lab
    // session must be unable to CREATE a key, not merely unable to change one,
    // and only a cleared store can tell those apart. The in-memory lifetime
    // flags are reset with it for the same reason — everHopped gates the
    // once-ever first-hop rehearsal, so leaving it true would hide the write
    // that matters most.
    for (const k of Object.keys(store)) delete store[k];
    st('G.everHopped=false;G.everLanded=false;G.didGroove=false');
    const before = JSON.stringify(store);
    const runs0 = st('G.runs');
    const seen0 = st('JSON.stringify(Object.keys(G.seen).sort())');

    bpid = passPowerSelect(st, frame, fire, pev, bpid);
    if (st('G.state') !== 'playing') throw new Error('the picker did not start a run, state=' + st('G.state'));
    if (st('G.runs') !== runs0) throw new Error('a lab run counted itself as a run');
    // the calm board: the clock is pinned, so no level can finish and no tier
    // can arrive mid-session
    if (st('dl()') !== st('LAB_DL')) throw new Error('the lab did not pin the difficulty clock');
    if (st('G.nRings') !== 3) throw new Error('the lab opened on ' + st('G.nRings') + ' rings — the black hole needs three to add a fourth to');
    const tier0 = st('G.tier');

    // ONE ORB, EVERY TIME. Watched across the placements themselves rather than
    // read off the board at the end: G.pows holds at most one and it expires.
    // Installed ONCE for the whole file — wrapping spawnPow per block chained a
    // new closure over the last one every time and redeclared its binding, and
    // the recorder is the same recorder either way. Reset the two counters to
    // start a fresh window; the sweep below does exactly that.
    st('G.__labSeen={};G.__labN=0');
    st('var __sp=spawnPow;spawnPow=function(){const n=G.pows.length;const r=__sp();' +
       'if(r&&G.pows.length>n){G.__labSeen[G.pows[G.pows.length-1].type]=1;G.__labN++;}return r;}');
    // Two peaks, not one. The interesting number is the CALM peak — sampled
    // only before the first black hole opens, so it is the board the lab
    // actually promises — because after the mode has run once the density
    // multiplier's shards are still decaying and every later sample is mixed.
    // The mode peak is kept as the other half of the same claim: the black
    // hole has to visibly crowd a quiet board or the sandbox is too quiet to
    // be testing the thing it was opened to test.
    // THE LAB IS PLAYED, not just watched. A snapshot only proves what the
    // session actually did, and a session that never touched the screen would
    // have exonerated all three of the writes this block exists to catch —
    // they hang off gameplay verbs, not off menus. So: hops (the lab runs on
    // three rings, which is what makes everHopped reachable at all) and taps
    // through the real handler, which is what calls tryLand().
    let sawBH = false, calmPeak = 0, modePeak = 0, hops = 0, gpid = 1300;
    for (let i = 0; i < 7000; i++) {
      frame(16.7);
      if (i % 120 === 60) { st('hop(' + (hops % 2 ? -1 : 1) + ')'); hops++; }
      if (i % 90 === 0) {
        fire('pointerdown', pev(gpid, 200, 400, 'pointerdown'));
        fire('pointerup', pev(gpid++, 200, 400, 'pointerup'));
      }
      const inMode = st('BH.phase') === 2;
      if (inMode) sawBH = true;
      const n = st('G.spikes.length');
      if (inMode) { if (n > modePeak) modePeak = n; }
      else if (st('G.bhN') === 0 && n > calmPeak) calmPeak = n;
    }
    if (!st('G.didHop')) throw new Error('the lab run never landed a hop — the everHopped guard went untested');
    const seenTypes = Object.keys(JSON.parse(st('JSON.stringify(G.__labSeen)')));
    const placed = st('G.__labN');
    if (placed < 4) throw new Error(`the lab placed ${placed} orbs in two minutes — "frequently" is not happening`);
    if (seenTypes.join(',') !== 'blackhole') throw new Error(`the lab placed ${seenTypes} when the black hole was picked`);
    if (!sawBH) throw new Error('two minutes of a black hole lab never entered the mode');
    if (st('G.tier') !== tier0) throw new Error('a pinned clock still advanced the tier ladder');
    if (st('G.level') !== 1) throw new Error('the lab reached a level boundary — the clock is not pinned');
    // calm, measured rather than asserted from the constant. dl 40 puts
    // shardCap at 4, so anything past 5 means the clock is not where the lab
    // says it is — the check reads the cap back out of the game rather than
    // hardcoding it, so retuning LAB_DL retunes the guard with it.
    // read with the mode neutralised: shardCap() multiplies itself by
    // bhDensity() while phase 2 is live, and the loop above can easily end
    // mid-horizon — sampling it there reported the crowded cap as the calm one
    const calmCap = st('(function(){const p=BH.phase;BH.phase=0;const c=shardCap();BH.phase=p;return c;})()');
    if (calmPeak > calmCap) throw new Error(`the calm board reached ${calmPeak} shards against a cap of ${calmCap}`);
    if (calmCap > 5) throw new Error(`LAB_DL puts the lab's shard cap at ${calmCap} — that is not a quiet board`);
    // Measured against the CAP rather than against the sampled calm peak: the
    // first orb of a lab run arrives around ten seconds in, so the window
    // before the first horizon is short and its peak is often 0 — a comparison
    // against it would pass on nothing. The mode's density multiplier reaches
    // 3.5x, so a board that never gets past twice the calm cap means the
    // crowding half of the black hole is not reaching the player.
    if (modePeak < calmCap * 2) throw new Error(`the black hole peaked at ${modePeak} against a calm cap of ${calmCap} — the mode is not crowding the board`);

    // THE GHOST. Deterministic: a lethal shard placed on the player's own ring
    // at the player's own angle, which the contact test cannot miss — provided
    // the comet is ON that ring: effRing() reads hopFromI through the first
    // half of a hop, and the lab session that just ran ends on its own
    // schedule, occasionally mid-hop. Settle the hop or the shard is placed
    // on a ring the contact test is not reading and this "deterministic"
    // probe flakes on the session before it.
    const hitOne = () => {
      st('G.invuln=0;G.spikes.length=0;BH.phase=0;BH.on=false;G.hyper=0;G.hopP=1');
      st('G.spikes.push({a:G.angle,ring:G.ringI,t:0,phase:1,bt:0,bo:0,va:0,' +
         'gate:false,blink:false,saucer:false,warn:0,life:99})');
      frame(16.7);
    };
    st("G.state='playing';G.shields=2;G.blocks=0;LAB.invuln=true");
    hitOne();
    if (st('G.shields') !== 2 || st('G.blocks') !== 0) throw new Error('the ghost let a shard spend a shield');
    if (st('G.state') !== 'playing') throw new Error('the ghost let a shard end the run');
    // ...and with it off the lab is the real game: the same shard is answered
    // exactly the way it is answered everywhere else
    st('LAB.invuln=false');
    hitOne();
    if (st('G.shields') !== 1 || st('G.blocks') !== 1) throw new Error('with the ghost off a shard did not spend a shield');
    st('LAB.invuln=true');

    // A LAB DEATH IS STILL NOT A RECORD. Forced rather than waited for, and
    // with the numbers set so that every record line WOULD move if it could.
    st("G.state='playing';G.score=999999;G.best=0;G.lvlMax=1;G.level=1;G.startLevel=1;G.lastHit='single';G.struggle=0");
    st('die()');
    if (st('G.newBest')) throw new Error('a lab run announced NEW BEST');
    if (st('G.best') !== 0) throw new Error('a lab score became the best score');
    if (st('G.newLevel')) throw new Error('a lab run announced FURTHEST YET');
    if (st('G.lvlMax') !== 1) throw new Error('a lab run moved the level record');
    if (st('G.struggle') !== 0) throw new Error('a lab death fed the struggle streak — it retunes the real game');
    if (st('inShare(0,0)')) throw new Error('a lab run offered its score to be shared');
    if (st('JSON.stringify(Object.keys(G.seen).sort())') !== seen0) {
      throw new Error('a lab run spent or re-armed a first-encounter lesson: was ' + seen0
        + ' now ' + st('JSON.stringify(Object.keys(G.seen).sort())'));
    }
    if (st('G.runs') !== runs0) throw new Error('a lab session moved the lifetime run count');
    // The lifetime tutorial flags, in memory as well as on disk. everHopped is
    // the one with teeth: it gates the once-ever first-hop rehearsal, so a
    // fresh player who opened the lab and swiped would have met the real
    // second ring with the rehearsal already spent.
    for (const f of ['everHopped', 'everLanded', 'didGroove']) {
      if (st('G.' + f)) throw new Error(`a lab session set the lifetime flag G.${f}`);
    }
    if (JSON.stringify(store) !== before) {
      const now = JSON.parse(JSON.stringify(store)), was = JSON.parse(before);
      const bad = Object.keys(now).filter(k => now[k] !== was[k])
        .concat(Object.keys(was).filter(k => !(k in now)));
      throw new Error(`a lab session wrote to the device: ${bad.join(', ')}`);
    }

    // THE DOOR. A lab run with the ghost on cannot end by itself, so the way
    // back to the picker is the only exit there is — and it has to be live on
    // the death screen too, or a lab death forces a retry to reach it.
    let door = JSON.parse(st('JSON.stringify(G.labRect)') || 'null');
    if (!door) throw new Error('the death screen drew no way out of the lab');
    st("G.state='playing'");
    for (let i = 0; i < 5; i++) frame(16.7);
    door = JSON.parse(st('JSON.stringify(G.labRect)') || 'null');
    if (!door) throw new Error('a lab run drew no way out');
    fire('pointerdown', pev(bpid, door.x + door.w / 2, door.y + door.h / 2, 'pointerdown'));
    fire('pointerup', pev(bpid++, door.x + door.w / 2, door.y + door.h / 2, 'pointerup'));
    if (st('G.state') !== 'powersel') throw new Error('the lab door did not return to the picker, state=' + st('G.state'));
    for (let i = 0; i < 30; i++) frame(16.7);
    const pback = JSON.parse(st('JSON.stringify(G.powSelRects.find(r=>r.id==="back"))'));
    fire('pointerdown', pev(bpid, pback.x + pback.w / 2, pback.y + pback.h / 2, 'pointerdown'));
    fire('pointerup', pev(bpid++, pback.x + pback.w / 2, pback.y + pback.h / 2, 'pointerup'));
    if (st('G.state') !== 'menu') throw new Error('back did not leave the lab picker');
    // THE FLAG HAS ONE OWNER AND THE TITLE SCREEN IS IT. Left set, every guard
    // above stays armed in the real game: no record would ever move again.
    if (st('LAB.on')) throw new Error('leaving the lab left the flag set — the real game would stop recording');
    if (!(st('G.nRings') > 1)) throw new Error('back from the lab left the menu on one ring — the demo can no longer hop');
    for (let i = 0; i < 5; i++) frame(16.7);
    if (st('G.labRect') !== null) throw new Error('the lab door outlived the lab — it would swallow a tap in the real game');
    console.log('powerup lab ok:', placed, 'black holes placed in 2min, calm board peaked at',
      calmPeak, 'shards and the mode at', modePeak + ',',
      'ghost holds both ways, nothing written to the device');
  }

  // ---- all seven, not just the one the run above happened to pick ----
  // The black hole is the interesting case and it is also the atypical one:
  // it is the only orb with its own mode, its own ring count and its own
  // spawn suppression. Six others sit behind curriculum branches that the lab
  // now jumps, and a branch that is jumped wrongly for one type looks exactly
  // like a branch that is jumped rightly for another. So each is run.
  {
    const ids = JSON.parse(st('JSON.stringify(LAB_ORBS.map(o=>o.id))'));
    const counts = [];
    for (let k = 0; k < ids.length; k++) {
      st(`LAB.on=true;LAB.sel=${k};LAB.invuln=true;G.t+=1`);
      st('startLab()');
      if (st('G.state') !== 'playing') throw new Error(`the ${ids[k]} lab did not start`);
      st('G.__labSeen={};G.__labN=0');   // the recorder installed above, rewound
      // 45s: long enough for several placements of a plain orb, and long
      // enough for one full black hole (17s) plus its refill
      for (let i = 0; i < 2700; i++) frame(16.7);
      const got = Object.keys(JSON.parse(st('JSON.stringify(G.__labSeen)')));
      const n = st('G.__labN');
      if (got.join(',') !== ids[k]) throw new Error(`the ${ids[k]} lab placed [${got}]`);
      if (n < 2) throw new Error(`the ${ids[k]} lab placed only ${n} in 45s`);
      if (st('G.state') !== 'playing') throw new Error(`the ${ids[k]} lab ended by itself — the ghost or the clock is not holding`);
      counts.push(`${ids[k]}:${n}`);
    }
    // and the door still works after the last of them, from a live run
    st("LAB.sel=0");
    for (let i = 0; i < 5; i++) frame(16.7);
    const d2 = JSON.parse(st('JSON.stringify(G.labRect)') || 'null');
    fire('pointerdown', pev(1400, d2.x + d2.w / 2, d2.y + d2.h / 2, 'pointerdown'));
    fire('pointerup', pev(1401, d2.x + d2.w / 2, d2.y + d2.h / 2, 'pointerup'));
    if (st('G.state') !== 'powersel') throw new Error('the door failed after a full sweep of the orbs');
    if (st('BH.phase') !== 0) throw new Error('leaving a lab run left the black hole ticking under the picker');
    st('enterMenu()');
    console.log('every lab orb ok in 45s each —', counts.join(' '));
  }

  // ---- a fresh device meets the swipe question on the way into the lab ----
  // The lab is played with the same two gestures the run is, so it cannot skip
  // the once-per-device control question. It also must not ask it twice, and
  // the chooser has to know to hand back to the PICKER rather than to the
  // level list — a third destination for a screen that had two.
  {
    st("G.state='menu';G.swipeAsked=false;G.selFrom=null;LAB.on=false;G.t+=1");
    for (let i = 0; i < 30; i++) frame(16.7);
    let fpid = 1500;
    const bar2 = JSON.parse(st('JSON.stringify(G.menuRects.find(r=>r.id==="lab"))'));
    fire('pointerdown', pev(fpid, bar2.x + bar2.w / 2, bar2.y + bar2.h / 2, 'pointerdown'));
    fire('pointerup', pev(fpid++, bar2.x + bar2.w / 2, bar2.y + bar2.h / 2, 'pointerup'));
    if (st('G.state') !== 'swipesel') throw new Error('a fresh device reached the lab without being asked the swipe rule');
    if (st('G.selFrom') !== 'lab') throw new Error('the chooser was not told it was opened from the lab');
    fpid = passSwipeChooser(st, frame, fire, pev, fpid);
    if (st('G.state') !== 'powersel') throw new Error('the swipe chooser sent the lab to ' + st('G.state'));
    // asked once: a second trip through the bar goes straight to the picker
    st('enterMenu()');
    for (let i = 0; i < 30; i++) frame(16.7);
    fire('pointerdown', pev(fpid, bar2.x + bar2.w / 2, bar2.y + bar2.h / 2, 'pointerdown'));
    fire('pointerup', pev(fpid++, bar2.x + bar2.w / 2, bar2.y + bar2.h / 2, 'pointerup'));
    if (st('G.state') !== 'powersel') throw new Error('the lab asked the swipe question twice');
    st('enterMenu()');
    console.log('lab swipe-question route ok: asked once, handed back to the picker');
  }

  // ---- the two new screens, measured on eight viewports ----
  // The canvas is stubbed, so nothing here can see a pixel — but every control
  // on both screens publishes a rect from its own draw pass, and a rect is
  // geometry the harness CAN check. Written because the first draft of the
  // picker failed exactly this: seven rows plus a toggle plus a pill did not
  // fit a landscape phone, the row height hit a floor the box could not honour,
  // and the last orb was drawn straight through the ghost switch on 844x390 and
  // 740x360. Nothing else here would have noticed — the picker still "worked",
  // it just answered two controls with one tap.
  {
    const VPS = [[390, 844], [360, 640], [320, 568], [430, 932],
                 [844, 390], [740, 360], [768, 1024], [1280, 800]];
    const ov = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x
                              && a.y < b.y + b.h && a.y + a.h > b.y;
    const folded = [];
    for (const [w, h] of VPS) {
      vw = w; vh = h;
      st("G.state='menu';G.swipeAsked=true;G.t+=1");
      for (let i = 0; i < 20; i++) frame(16.7);
      const menu = JSON.parse(st('JSON.stringify(G.menuRects)'));
      const swipeRow = JSON.parse(st('JSON.stringify(G.swipeRect)') || 'null');
      const bar = menu.find(r => r.id === 'lab');
      if (!bar) throw new Error(`${w}x${h}: the title screen drew no POWERUP TESTING bar`);
      if (bar.y < 0 || bar.y + bar.h > h || bar.x < 0 || bar.x + bar.w > w) {
        throw new Error(`${w}x${h}: the lab bar is off screen`);
      }
      for (const other of menu.concat([swipeRow]).filter(r => r && r !== bar)) {
        if (ov(bar, other)) throw new Error(`${w}x${h}: the lab bar overlaps ${other.id || 'the swipe row'}`);
      }
      // The bar's band came out of the CARDS (0.46 -> 0.40 of the box) rather
      // than out of the key, precisely so the four key rows would not be
      // pushed onto their 15u floor and through the bottom of a short
      // landscape phone. That is a claim about a number in another expression
      // entirely, so it is checked here: the swipe row is key row 1, which
      // gives up both the row height and the block origin.
      const start = menu.find(r => r.id === 'start');
      if (swipeRow && start) {
        const rh = swipeRow.h, row4 = (swipeRow.y + rh * 0.62) - rh + 3 * rh;
        if (row4 > start.y) throw new Error(`${w}x${h}: the menu key's last row (${row4.toFixed(0)}) runs into START (${start.y.toFixed(0)})`);
        if (row4 > h) throw new Error(`${w}x${h}: the menu key's last row is off the bottom`);
      }
      st('enterPowerSel();G.t+=1');
      for (let i = 0; i < 20; i++) frame(16.7);
      const pr = JSON.parse(st('JSON.stringify(G.powSelRects)'));
      const orbs = pr.filter(r => r.id === 'orb');
      // read off the table: the count tripwire lives with the lab-session test,
      // one place — this loop only cares that every row the table owns got drawn
      if (orbs.length !== st('LAB_ORBS.length')) throw new Error(`${w}x${h}: the picker drew ${orbs.length} orbs`);
      for (const r of pr) {
        if (r.y < 0 || r.y + r.h > h) throw new Error(`${w}x${h}: the picker's ${r.id} runs off the screen vertically`);
        if (r.x < 0 || r.x + r.w > w) throw new Error(`${w}x${h}: the picker's ${r.id} runs off the screen horizontally`);
        // 18 rather than a round 24: the level picker's own back control is 26u,
        // which is 19.8 on the narrowest phone tested. The lab may be as small
        // as what already ships and no smaller.
        if (r.h < 18) throw new Error(`${w}x${h}: the picker's ${r.id} is ${r.h.toFixed(1)}px tall — too small to press`);
      }
      for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) {
        if (ov(pr[i], pr[j])) {
          throw new Error(`${w}x${h}: the picker's ${pr[i].id}${pr[i].i ?? ''} overlaps ${pr[j].id}${pr[j].i ?? ''}`);
        }
      }
      if (orbs[1].y === orbs[0].y) folded.push(`${w}x${h}`);
      // THE PAUSE ICON TOOK THE LAB DOOR'S CORNER. Both are drawn in the same
      // band at the top of a lab run, and the door is offset by the icon's
      // footprint rather than by a guess — so the pair has to be checked on a
      // narrow screen, where the door's width is what gives way.
      st('LAB.on=true;startLab()');
      for (let i = 0; i < 5; i++) frame(16.7);
      const door = JSON.parse(st('JSON.stringify(G.labRect)') || 'null');
      const pb = JSON.parse(st('JSON.stringify(pauseRect())'));
      if (!door) throw new Error(`${w}x${h}: a lab run drew no door`);
      if (ov(door, pb)) throw new Error(`${w}x${h}: the lab door overlaps the pause button`);
      if (door.x + door.w > w) throw new Error(`${w}x${h}: the lab door runs off the right edge (${(door.x + door.w).toFixed(0)}>${w})`);
      if (door.w < 60) throw new Error(`${w}x${h}: the lab door squeezed to ${door.w.toFixed(0)}px making room for pause`);
      st('enterMenu()');
      for (let i = 0; i < 5; i++) frame(16.7);
    }
    vw = 390; vh = 844;
    for (let i = 0; i < 20; i++) frame(16.7);
    // the fold is the fix, so prove it still happens: a build where the
    // two-column branch stopped firing would pass every check above by
    // silently shrinking the rows instead
    if (!folded.length) throw new Error('no viewport folded the picker to two columns — the short-screen path is dead');
    console.log(`lab layout ok on ${VPS.length} viewports; folded to two columns on ${folded.join(', ')}`);
  }
} catch (e) {
  console.error('RUNTIME FAILED:', e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
  // ---- THE PLAY LINK SELF-HEALS, AND ONLY WHEN IT IS SAFE TO ----
  // The plain URL is the product's front door and GitHub Pages caches it for
  // ten minutes, so a stale copy must detect a newer BUILD stamp and swap to
  // it — but ONLY from the title screen (reloading a live run is vandalism),
  // and only ONE hop (a URL already carrying ?u= must never redirect again,
  // or two mismatched cached copies bounce forever). Both guards are the
  // feature; both are asserted.
  {
    const st = expr => vm.runInContext(expr, sandbox);
    let fetched = null;
    sandbox.fetch = (url) => {
      fetched = url;
      return Promise.resolve({ text: () => Promise.resolve("const BUILD='abc1234'") });
    };
    const tick = () => new Promise(r => setTimeout(r, 0));
    // mid-run: a newer build exists and the game is being PLAYED — no swap
    st("G.state='playing';location.__replaced=undefined;location.search='';freshCheck(true)");
    await tick(); await tick();
    if (st('location.__replaced') !== undefined) throw new Error('the freshness swap reloaded a live run');
    // on the menu: the stale copy swaps to the newer build, exactly one hop
    st("G.state='menu';freshCheck(true)");
    await tick(); await tick();
    const r = st('location.__replaced');
    if (r !== '/?u=abc1234') throw new Error('a stale title screen did not swap to the newer build: ' + r);
    if (!/[?&]chk=\d+/.test(String(fetched))) throw new Error('the freshness fetch does not carry its own cache key: ' + fetched);
    // already swapped once: a ?u= URL must never redirect again, even stale
    st("location.__replaced=undefined;location.search='?u=abc1234';freshCheck(true)");
    await tick(); await tick();
    if (st('location.__replaced') !== undefined) throw new Error('a ?u= URL redirected again — two mismatched caches would loop forever');
    delete sandbox.fetch;
    st("location.search=''");
    console.log('play-link self-heal ok: swaps on the menu, never mid-run, never twice');
  }

  console.log('SMOKE OK');
