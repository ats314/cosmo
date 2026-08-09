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

try {
  const st = expr => vm.runInContext(expr, sandbox);
  // menu: run 15s of frames so the demo loop cycles (spawn, reverse, hops)
  for (let i = 0; i < 900; i++) frame(16.7);
  console.log('menu+demo ok');
  // start the game with a tap — a FRESH device passes through the LIFT OFF
  // card first (the calm pre-teaching screen), one tap, once per device
  fire('pointerdown', pev(1, 200, 400, 'pointerdown'));
  fire('pointerup', pev(1, 200, 400, 'pointerup'));
  passSwipeChooser(st, frame, fire, pev, 900);
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
  if (!st('TIERS.every(t=>t.at<=LV[2].end)')) throw new Error('a tier unlocks after level 3');
  if (st('TIERS[TIERS.length-1].at') !== st('LV[2].end')) throw new Error('STORM is not aligned to the exam level\'s floor');
  // every spawnable formation and every reward orb carries a lesson
  if (!st("TIERS.every(t=>!t.type||!!MEET[t.type])")) throw new Error('a tier type has no MEET lesson');
  if (!st("['bass','spot','hyper','lapcost'].every(k=>MEET[k]&&MEET[k].soft)")) throw new Error('a reward lesson lost its no-slow-mo flag');
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
} catch (e) {
  console.error('RUNTIME FAILED:', e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
console.log('SMOKE OK');
