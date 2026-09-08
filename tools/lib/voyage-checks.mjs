/* The route is presentation data. These checks inspect renderer commands and
   real runtime transitions; shader pixels and visual taste need a browser. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { flightSandbox } from './flight-sandbox.mjs';
import { flightGL } from './flight-gl.mjs';
import { createFlightWorld } from '../../src/game/flight-world.ts';

const CHAPTERS = [2, 0, 3, 1, 4, 5];
const baseFrame = {
  enabled: true, width: 390, height: 844, dpr: 1,
  center: [195, 422], outerCenter: [195, 422], radii: [147, 230],
  comet: [310, 422], angle: 0, direction: 1, visualTime: 3, travel: 300,
  active: true, reducedMotion: false,
  palette: { tint: [0.16, 0.30, 0.56], rim: [0.30, 0.79, 0.95], dust: [0.30, 0.37, 0.67] },
  voyage: { progress: 0.24, chapter: 2 },
};
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const picture = gpu => {
  const { geometry, uniforms } = gpu.snapshot();
  return hash({ geometry, uniforms });
};
const vertices = (gpu, style) => {
  const data = gpu.snapshot().geometry, found = [];
  for (let i = 0; i < data.length; i += 11) if (data[i + 9] === style) found.push(data.slice(i, i + 11));
  return found;
};
const noTunnel = (gpu, label) => {
  assert.equal(vertices(gpu, 3).length, 0, `${label}: wormhole walls remain`);
  assert.equal(vertices(gpu, 4).length, 0, `${label}: wormhole veil remains`);
};
const draw = (world, gpu, frame) => {
  const copy = freeze(JSON.parse(JSON.stringify(frame))), before = hash(copy);
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('voyage renderer consumes the gameplay random stream'); };
    assert.equal(world.render(copy), true, 'voyage renderer rejected a valid frame');
  } finally { Math.random = random; }
  assert.equal(hash(copy), before, 'voyage renderer mutated its copied frame');
  return gpu.snapshot();
};
const boundedRoute = (route, label) => {
  assert(route && Number.isFinite(route.progress) && route.progress >= 0 && route.progress <= 1,
    `${label}: voyage progress is absent, non-finite or outside 0..1`);
  assert(Number.isInteger(route.chapter) && route.chapter >= 0 && route.chapter <= 5,
    `${label}: unknown destination chapter`);
};

export function verifyVoyageRendering(source) {
  const gpu = flightGL(), world = createFlightWorld(gpu.gl);
  let routeSamples = 0, exits = 0;
  // A fullscreen voyage must cover the actual resized viewport. Merely finding
  // six vertices would let a portrait-sized background survive in landscape.
  for (const [width, height, dpr] of [[390, 844, 2], [844, 390, 2], [320, 568, 1], [768, 1024, 1]]) {
    gpu.gl.drawingBufferWidth = width * dpr; gpu.gl.drawingBufferHeight = height * dpr;
    for (let chapter = 0; chapter < 6; chapter++) for (const progress of [0, 0.5, 1]) {
      const frame = { ...baseFrame, width, height, dpr, center: [width / 2, height / 2],
        outerCenter: [width / 2, height / 2], voyage: { progress, chapter } };
      const sample = draw(world, gpu, frame), quad = vertices(gpu, 5);
      assert.equal(quad.length, 6, 'voyage did not issue its fullscreen surface');
      const xs = quad.map(v => v[0] + width / 2), ys = quad.map(v => v[1] + height / 2);
      assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
        [0, width, 0, height], 'voyage surface does not cover the resized viewport');
      assert(quad.every(v => v[2] === 0), 'fullscreen voyage surface gained perspective depth');
      assert.deepEqual(sample.uniforms.uSize, [width, height], 'voyage uses a stale viewport');
      assert.deepEqual(sample.uniforms.uBufferSize, [width * dpr, height * dpr], 'voyage uses a stale pixel buffer size');
      assert.deepEqual(sample.uniforms.uVoyage, [progress, chapter, frame.visualTime], 'voyage route did not reach its shader');
      noTunnel(gpu, 'ordinary voyage'); routeSamples++;
    }
  }
  gpu.gl.drawingBufferWidth = 390; gpu.gl.drawingBufferHeight = 844;
  const stationary = { ...baseFrame, visualTime: 12, travel: 1200 };
  draw(world, gpu, stationary); const held = picture(gpu);
  draw(world, gpu, stationary);
  assert.equal(picture(gpu), held, 'voyage changes while its presentation clock is held');
  // Reduced motion holds both the camera's route position and material time,
  // even when gameplay progress changes. It does not freeze the real score.
  world.reset();
  draw(world, gpu, { ...baseFrame, reducedMotion: true, voyage: { progress: 0.1, chapter: 0 } });
  const reduced = picture(gpu), reducedUniform = gpu.snapshot().uniforms.uVoyage;
  draw(world, gpu, { ...baseFrame, reducedMotion: true, visualTime: 30, travel: 3000,
    voyage: { progress: 0.9, chapter: 0 } });
  assert.equal(picture(gpu), reduced, 'reduced-motion voyage sweeps the camera or animates material');
  assert.equal(reducedUniform[0], 0.24, 'reduced-motion voyage does not use its authored static vista');
  assert.equal(reducedUniform[2], 0, 'reduced-motion voyage advances shader time');

  const card = { ...baseFrame, active: false, transition: { elapsed: 2, completed: true, nextLevel: 2 } };
  world.reset(); draw(world, gpu, card);
  const walls = vertices(gpu, 3);
  assert(walls.some(v => v[2] < 0) && walls.some(v => v[2] > 2000), 'wormhole lacks a real depth volume');
  assert.equal(vertices(gpu, 4).length, 6, 'wormhole interior is absent');
  const heldCard = picture(gpu); draw(world, gpu, card);
  assert.equal(picture(gpu), heldCard, 'wormhole moves on a held presentation clock');
  draw(world, gpu, { ...baseFrame, visualTime: 3 + 1 / 60, travel: 300 + 100 / 60 });
  noTunnel(gpu, 'first live frame');
  // Active gameplay wins even if a stale completion field arrives with it.
  draw(world, gpu, { ...card, active: true }); noTunnel(gpu, 'active frame with stale card data');
  draw(world, gpu, card);
  draw(world, gpu, { ...baseFrame, active: false }); noTunnel(gpu, 'menu return');
  draw(world, gpu, { ...card, transition: { ...card.transition, completed: false } });
  noTunnel(gpu, 'selected starting-level card');
  world.reset(); draw(world, gpu, { ...card, reducedMotion: true });
  const reducedCard = picture(gpu);
  draw(world, gpu, { ...card, reducedMotion: true, transition: { ...card.transition, elapsed: 20 } });
  assert.equal(picture(gpu), reducedCard, 'reduced-motion wormhole animates while waiting for a choice');
  world.reset(); draw(world, gpu, card); const resetCard = picture(gpu);
  draw(world, gpu, { ...card, visualTime: 8, travel: 800 });
  draw(world, gpu, card);
  assert.equal(picture(gpu), resetCard, 'clock rollback retains an abandoned passage');
  world.reset(); draw(world, gpu, card);
  assert.equal(picture(gpu), resetCard, 'explicit reset retains old passage state');
  gpu.verify(); world.dispose();

  // Adapter samples include the states absent from the ordinary trajectory
  // fixture, so a route cannot forge gameplay progress or leak live references.
  const rig = flightSandbox(source, 712);
  const readRoute = label => {
    const before = rig.fingerprint(), frame = rig.flightFrame();
    boundedRoute(frame.voyage, label);
    assert.deepEqual(rig.fingerprint(), before, `${label}: reading voyage consumes state, RNG, audio or storage`);
    const route = { ...frame.voyage };
    frame.voyage.progress = 999; frame.voyage.chapter = 999;
    assert.deepEqual(rig.fingerprint(), before, `${label}: voyage exposes live state`);
    assert.deepEqual({ ...rig.flightFrame().voyage }, route, `${label}: copied route mutation leaked`);
    return route;
  };
  for (let level = 1; level <= 6; level++) {
    rig.run(`G.level=${level};G.carryScore=0;startGame();G.started=G.t;G.diff=0`);
    const start = readRoute(`level ${level} start`);
    assert.equal(start.chapter, CHAPTERS[level - 1]); assert.equal(start.progress, 0);
    const samples = [20, 120, 400].map(age => {
      rig.run(`G.started=G.t-${age}`); return readRoute(`level ${level} at ${age}s`).progress;
    });
    assert(samples[0] > 0 && samples[1] > samples[0] && samples[2] >= samples[1], 'voyage camera loops backwards during a level');
    if (level < 6) assert.equal(samples[2], 1, 'finite destination does not reach its passage');
    else assert(samples[2] < 1, 'endless destination claims a completed route');
    rig.run(`G.state='lvend';G.lvCard={done:true,next:${level + 1}}`);
    const completed = readRoute(`level ${level} completed card`);
    assert.equal(completed.chapter, CHAPTERS[level - 1]); assert.equal(completed.progress, 1);
    rig.run(`G.state='lvend';G.lvCard={done:false,next:${level}}`);
    const picked = readRoute(`level ${level} selected card`);
    assert.equal(picked.chapter, CHAPTERS[level - 1]); assert.equal(picked.progress, 0);
    rig.run(`G.state='levelsel';G.lvSel=${level}`);
    const selected = readRoute(`level ${level} picker preview`);
    assert.equal(selected.chapter, CHAPTERS[level - 1]); assert.equal(selected.progress, 0.24);
    // Death has its own timestamp: the retry screen still advances G.t.
    // Sample midway through each route so clamping to 1 cannot hide a leak.
    rig.run("G.state='dead';G.started=G.t-40;G.deadT=G.t;G.diff=7");
    const death = readRoute(`level ${level} death`);
    assert(death.progress > 0 && death.progress < 1, 'death fixture is not inside a route');
    rig.run('G.t+=1200');
    assert.deepEqual(readRoute(`level ${level} held death`), death, 'waiting to retry advances the voyage');
  }
  rig.run('enterMenu()');
  assert.deepEqual(readRoute('menu'), { progress: 0.24, chapter: 2 });
  for (const state of ['powersel', 'swipesel']) {
    rig.run(`G.state='${state}'`);
    assert.equal(rig.flightFrame().voyage, undefined, `${state} inherits the ordinary voyage`);
  }
  rig.run("G.state='playing';LAB.on=true");
  assert.equal(rig.flightFrame().voyage, undefined, 'the lab inherits a normal-run voyage');

  // Use the existing upgrade controls rather than synthesizing active:true.
  // Every level boundary must drop the tunnel before its first playable frame.
  for (const reducedMotion of [false, true]) for (const level of [1, 3, 5]) {
    const live = flightSandbox(source, 800 + level, { reducedMotion }), liveGpu = flightGL();
    const renderer = createFlightWorld(liveGpu.gl);
    live.run(`G.level=${level};G.startLevel=1;startGame();G.score=1250;levelComplete()`);
    for (let i = 0; i < 120; i++) live.step(1000 / 60);
    live.render(); draw(renderer, liveGpu, { ...live.flightFrame(), enabled: true });
    assert(vertices(liveGpu, 3).length > 0, 'real completed level opened no passage');
    const rect = JSON.parse(live.run('JSON.stringify(G.offerRects[0])'));
    assert(rect, 'completed level drew no upgrade control');
    live.run(`pointerDown({pointerId:910,x:${rect.x + rect.w / 2},y:${rect.y + rect.h / 2}});
      pointerUp({pointerId:910,x:${rect.x + rect.w / 2},y:${rect.y + rect.h / 2}})`);
    assert.equal(live.run('G.state'), 'playing'); assert.equal(live.run('G.level'), level + 1);
    assert.equal(live.run('G.picks.length'), 1); assert.equal(live.run('G.score'), 1250);
    live.step(1000 / 60); draw(renderer, liveGpu, { ...live.flightFrame(), enabled: true });
    noTunnel(liveGpu, `level ${level} actual upgrade exit`);
    liveGpu.verify(); renderer.dispose(); exits++;
  }
  return { routeSamples, exits, maxVertices: gpu.snapshot().maxVertices };
}
