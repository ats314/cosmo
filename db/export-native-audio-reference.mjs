// Extract the existing game's authored data and execute its actual musical
// functions to produce a port reference. No Godot process or source mutation.
// Usage: node db/export-native-audio-reference.mjs [output.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = path.join(root, 'src/game/runtime.js');
const source = await fs.readFile(sourcePath, 'utf8');
const origins = {};
// Mask comments and quoted text without changing offsets. The selected source
// declarations/functions contain no regex literals or template interpolation.
// This is a bounded extractor, not a general JavaScript parser.
const masked = source.split('');
for (let i = 0; i < source.length;) {
  const start = i, quote = source[i];
  if (quote === '"' || quote === "'" || quote === '`') {
    i++;
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i++] === quote) break;
    }
  } else if (source.startsWith('//', i)) {
    while (i < source.length && source[i] !== '\n') i++;
  } else if (source.startsWith('/*', i)) {
    const end = source.indexOf('*/', i + 2);
    assert.ok(end >= 0, 'Unclosed source comment'); i = end + 2;
  } else { i++; continue; }
  for (let j = start; j < i; j++) if (masked[j] !== '\n' && masked[j] !== '\r') masked[j] = ' ';
}
const codeMask = masked.join('');
function unique(pattern, label) {
  const matches = Array.from(codeMask.matchAll(pattern));
  assert.equal(matches.length, 1, `Expected one source ${label}`);
  return matches[0];
}
function endOfExpression(start) {
  let depth = 0;
  for (let i = start; i < codeMask.length; i++) {
    const c = codeMask[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && (c === ',' || c === ';')) return i;
  }
  throw new Error(`Unterminated source expression at ${start}`);
}
function origin(name, start, end) {
  origins[name] = {
    path: 'src/game/runtime.js', line: source.slice(0, start).split('\n').length,
    sha256: createHash('sha256').update(source.slice(start, end)).digest('hex'),
  };
}
const context = vm.createContext({ Math, Infinity });
const run = (code) => vm.runInContext(code, context, { timeout: 2000 });
function loadValue(name) {
  const match = unique(new RegExp(`\\b${name}\\s*=(?!=)`, 'g'), `initializer of ${name}`);
  const start = match.index + match[0].length, end = endOfExpression(start);
  origin(name, match.index, end);
  run(`globalThis.${name} = (${source.slice(start, end)});`);
}
function loadFunction(name) {
  const match = unique(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'), `function ${name}`);
  const start = match.index, body = codeMask.indexOf('{', start);
  let depth = 1, end = body + 1;
  while (end < codeMask.length && depth > 0) {
    if (codeMask[end] === '{') depth++;
    else if (codeMask[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0, `Unclosed source function ${name}`);
  origin(name, start, end);
  run(source.slice(start, end));
}
const names = [
  'BPM', 'SPB', 'STEPS', 'PAY', 'S16', 'PAYLEN', 'LAYER_AT', 'LAYER_NAME',
  'RINGS', 'LV', 'PROG', 'PROGB', 'CHOFF', 'ARPL', 'ARPBL', 'RIFFL', 'SOLOL',
  'PENT', 'PENT_BASE', 'HOOKL', 'HOOKBL', 'hookGaps', 'HOOKGL', 'HOOKBGL', 'ANSWERL',
];
for (const name of names) loadValue(name);
for (const name of ['subF', 'chI', 'chTone', 'payoffStep', 'performerHit']) loadFunction(name);
run(`
  globalThis.events = [];
  globalThis.G = {level: 1, state: 'playing', secScore: 0, groove: 0, dir: 1};
  globalThis.PLAY = {heat: 0, idx: 0, last: -9, slot: -1};
  globalThis.MU = {step: 0, sect: 0};
  globalThis.CH = PROG[0];
  globalThis.A = {perf: 'player', pump: {gain: {
    setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}
  }}};
  globalThis.AC = {currentTime: 1, state: 'running'};
  globalThis.BEATQ = [];
  globalThis.note = (frequency, time, duration, wave, gain, cutoff, pan, bus, echo) =>
    events.push({voice: 'note', frequency, time, duration, wave, gain, cutoff,
      pan: pan || 0, bus: bus || 'band', echo: echo || 0});
  globalThis.lead = (frequency, time, duration, gain, cutoff, pan) =>
    events.push({voice: 'lead', frequency, time, duration, gain, cutoff, pan});
  for (const kind of ['kick', 'snare', 'hat']) globalThis[kind] = (time, ...parameters) =>
    events.push({voice: kind, time, parameters});
  globalThis.frozen = () => false;
  globalThis.bhActive = () => false;
  globalThis.gridNear = () => AC.currentTime;
  globalThis.posPlayer = () => [0, 0];
  globalThis.judgeTiming = () => 0;
  globalThis.effRing = () => 0;
  globalThis.panAt = () => 0;
`);

const values = {};
for (const name of names.filter(name => name !== 'hookGaps')) values[name] = run(name);
assert.equal(values.LV.length, 6);
assert.equal(values.PAY, 32);
assert.equal(values.LV[5].end, Infinity);
assert.equal(run('chTone(0)'), 110);
const music = [];
for (let level = 1; level <= 6; level++) {
  const variants = [];
  for (const payN of [1, 2, 3]) {
    run(`
      G = {level: ${level}, state: 'playing', secScore: 0};
      CH = PROG[G.level - 1];
      PENT = PENT_BASE.map(f => f * LV[G.level - 1].key);
      PLAY = {heat: 0.5};
      MU = {step: 0, sect: 0, pay: PAY, payN: ${payN}, flavor: 'orbit', crown: 0};
      events = []; BEATQ = [];
      for (let step = 0; step < PAY; step++) {
        MU.step = step;
        payoffStep(step * SPB / 2, CH[chI(step >> 3)], 0.5);
      }
    `);
    assert.equal(run('MU.pay'), 0);
    variants.push({ release_number: payN, scenario: {heat: 0.5, intensity: 0.5, flavor: 'orbit', crown: 0},
      events: run('events'), beats: run('BEATQ') });
  }
  const movement = [];
  for (const section of [0, 1]) for (let bar = 0; bar < 4; bar++) {
    for (let ring = 0; ring < 3; ring++) for (const [kind, direction] of [['tap', 1], ['hop', -1], ['hop', 1]]) {
      run(`
        G = {level: ${level}, state: 'playing', groove: 0, dir: 1};
        CH = (${section} ? PROGB : PROG)[G.level - 1];
        MU = {step: ${bar * 8}, sect: ${section}, pay: 0};
        PLAY = {heat: 0, idx: 0, last: -9, slot: -1};
        events = [];
        for (let input = 0; input < 8; input++) {
          AC.currentTime = 1 + input * SPB;
          performerHit(${JSON.stringify(kind)}, ${direction}, ${ring});
        }
      `);
      movement.push({section, bar, ring, kind, direction, events: run('events')});
    }
  }
  music.push({level, name: values.LV[level - 1].name,
    original_key_multiplier: values.LV[level - 1].key,
    snare_body_hz: values.PROG[level - 1][0][0] * 1.7818,
    verse_chords_hz: values.PROG[level - 1], chorus_chords_hz: values.PROGB[level - 1],
    chorus_walk_offset: values.CHOFF[level - 1], starfall: variants, movement});
}
// The source's first L1 outer-ring tap voices the third plus the low root.
const firstTap = music[0].movement.find(row => row.section === 0 && row.bar === 0 && row.ring === 0 && row.kind === 'tap');
assert.deepEqual(Array.from(firstTap.events.slice(0, 2), event => event.frequency), [261.63, 110]);
for (const level of music) for (const release of level.starfall) {
  assert.ok(release.events.some(event => event.voice === 'lead' && event.time >= 8 * values.SPB),
    `${level.name} release ${release.release_number} must contain the authored answer`);
}
const artifact = {
  format: 'cosmo-original-audio-reference-v1',
  source: {path: 'src/game/runtime.js', sha256: createHash('sha256').update(source).digest('hex')},
  method: 'Authored declarations extracted with an offset-preserving comment/quote scanner and balanced delimiters; actual payoffStep, performerHit, chTone and chI executed in a bounded VM with recording sinks.',
  limits: 'Symbolic pitches, timing and voice parameters, not rendered PCM or an auditory/performance test. Movement uses zero timing bonus and centered pan; Starfall scenario values are recorded per variant. Normal melody tables are exported without simulating the full ordinary arrangement.',
  origins, tables: values, levels: music,
};
const output = path.resolve(process.argv[2] || path.join(root, 'work/godot-collaboration/original-audio-reference.json'));
await fs.mkdir(path.dirname(output), {recursive: true});
await fs.writeFile(output, JSON.stringify(artifact, (_key, value) => value === Infinity ? 'Infinity' : value, 2) + '\n');
console.log(JSON.stringify({original_audio_reference: 'passed', output,
  source_sha256: artifact.source.sha256, levels: music.length,
  starfall_scenarios: music.reduce((sum, level) => sum + level.starfall.length, 0),
  movement_scenarios: music.reduce((sum, level) => sum + level.movement.length, 0)}));
