/* @lane fast */
/* The flight renderer must change only presentation. The original runtime's
   nonvisual functions and seeded trajectories are held by a compact fixture;
   the full pre-change source is a local audit artifact, never a shipped copy. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { flightSandbox } from './lib/flight-sandbox.mjs';
import { flightScenarios } from './lib/flight-scenarios.mjs';
import { flightGL } from './lib/flight-gl.mjs';
import { createFlightWorld } from '../src/game/flight-world.ts';

const root = new URL('../', import.meta.url);
const fixtureURL = new URL('tools/lib/flight-baseline.json', root);
const record = process.argv.includes('--record-baseline');
const sourceURL = new URL(record ? 'work/web-flight-baseline/runtime.js' : 'src/game/runtime.js', root);
const source = await readFile(sourceURL, 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const summarize = fp => ({ state: sha(fp.state), rng: fp.rng, audio: fp.audio, audioCalls: fp.audioCalls, store: sha(fp.store) });
const constantNames = ['RAD_OFF', 'RAD_BH', 'RINGS', 'LV', 'MODES', 'TIERS', 'UPG', 'PROG', 'PROGB', 'HOOKL', 'HOOKBL'];
let fixture;
if (record) {
  // V8 parses each function; Function.toString returns its exact executable
  // source extent, so shader strings cannot confuse a brace-counting parser.
  const names = [...source.matchAll(/^function\s+(\w+)\s*\(/gm)].filter(match => {
    const line = source.slice(0, match.index).split('\n').length;
    return (line >= 740 && line <= 3600) || (line >= 4360 && line <= 8900) ||
      ['angDist', 'radiusOf', 'posAt', 'ecx', 'ecy', 'runtimeStep', 'runtimePause', 'runtimeResume', 'runtimeBack'].includes(match[1]);
  }).map(match => match[1]);
  const rig = flightSandbox(source, 311);
  fixture = { version: 1, sourceSHA256: sha(source), functions: Object.fromEntries(names.map(name => [name, rig.functionHash(name)])),
    constants: Object.fromEntries(constantNames.map(name => [name, sha(rig.run(`JSON.stringify(${name})`))])), trajectories: {} };
} else {
  fixture = JSON.parse(await readFile(fixtureURL, 'utf8'));
  const rig = flightSandbox(source, 311);
  for (const [name, hash] of Object.entries(fixture.functions)) assert.equal(rig.functionHash(name), hash, `nonvisual function changed: ${name}`);
  for (const [name, hash] of Object.entries(fixture.constants)) assert.equal(sha(rig.run(`JSON.stringify(${name})`)), hash, `tuned content changed: ${name}`);
}

function corrupt(value, visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  for (const key of Object.keys(value)) {
    const leaf = value[key];
    assert.notEqual(typeof leaf, 'function', 'flight frame exposes behavior instead of data');
    if (leaf && typeof leaf === 'object') corrupt(leaf, visited);
    else Reflect.set(value, key, typeof leaf === 'number' ? 987654321 : typeof leaf === 'boolean' ? !leaf : '__renderer_mutation__');
  }
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}

let frames = 0, purityChecks = 0, callbacks = 0;
let geometryDraws = 0;
for (const [seed, reducedMotion] of [[311, false], [1907, true]]) {
  const key = `${seed}:${reducedMotion ? 'reduced' : 'normal'}`;
  const rig = flightSandbox(source, seed, { reducedMotion });
  const gpu = record ? null : flightGL();
  const renderer = gpu ? createFlightWorld(gpu.gl) : null;
  const trajectory = {};
  let sampled = 0;
  frames += flightScenarios(rig, (label, fp) => {
    trajectory[label] = summarize(fp);
    if (!record) assert.deepEqual(trajectory[label], fixture.trajectories[key][label], `${key} ${label}: flight changed gameplay, input, RNG, save or audio schedule`);
  }, () => {
    if (record) return;
    const before = rig.fingerprint();
    const frame = rig.flightFrame();
    assert(frame && typeof frame.enabled === 'boolean', 'the runtime has no flight frame');
    assert.deepEqual(rig.fingerprint(), before, 'reading a flight frame mutates live state or consumes RNG/audio');
    purityChecks++;
    if (sampled++ % 120 === 0) {
      // The VM deliberately has no GPU. Probe the production gate without
      // pretending a recording canvas can validate real shader pixels.
      rig.run('GL.on=true');
      assert.equal(rig.flightFrame().enabled, true, 'flight mode remains disabled with a ready GPU');
      rig.run('GL.on=false');
      const original = JSON.stringify(frame);
      const immutable = freezeDeep({ ...JSON.parse(original), enabled: true });
      const random = Math.random;
      try {
        Math.random = () => { throw new Error('flight renderer consumes the gameplay random stream'); };
        assert.equal(renderer.render(immutable), true, 'actual flight module rejected its frame');
      } finally { Math.random = random; }
      assert.deepEqual(rig.fingerprint(), before, 'actual flight renderer changed the original runtime');
      corrupt(frame);
      assert.deepEqual(rig.fingerprint(), before, 'renderer can mutate game state through its returned frame');
      assert.equal(JSON.stringify(rig.flightFrame()), original, 'a renderer mutation leaks into the next frame');
      if (rig.lastFlightFrame) {
        corrupt(rig.lastFlightFrame);
        assert.deepEqual(rig.fingerprint(), before, 'renderFlight callback received live gameplay references');
      }
    }
  });
  if (record) fixture.trajectories[key] = trajectory;
  else {
    assert(rig.flightFrames > 100, 'runtime.render never dispatches the flight adapter');
    callbacks += rig.flightFrames;
    geometryDraws += gpu.verify();
    gpu.contextLost(true);
    assert.equal(renderer.render(rig.flightFrame()), false, 'lost context was treated as usable');
    gpu.contextLost(false);
    renderer.dispose();
    assert.equal(renderer.render(rig.flightFrame()), false, 'disposed renderer still runs');
  }
}
if (record) {
  await writeFile(fixtureURL, JSON.stringify(fixture, null, 2) + '\n');
  await writeFile(new URL('work/web-flight-baseline/nonvisual-hashes.json', root), JSON.stringify({ sourceSHA256: fixture.sourceSHA256, functions: fixture.functions, constants: fixture.constants }, null, 2) + '\n');
  console.log(`FLIGHT BASELINE RECORDED: ${Object.keys(fixture.functions).length} functions, ${constantNames.length} tuning tables, ${frames} original frames`);
} else {
  console.log(`FLIGHTCHECK OK  ${Object.keys(fixture.functions).length} nonvisual functions and ${constantNames.length} tuning tables unchanged; ${frames} original trajectory frames, ${purityChecks} pure reads, ${callbacks} adapter calls, ${geometryDraws} actual renderer draws; tap/swipe/pause/powers/audio/RNG/save equivalent`);
}
