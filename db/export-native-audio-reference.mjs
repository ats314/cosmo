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
function loadFunction(name, target = context) {
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
  vm.runInContext(source.slice(start, end), target, {timeout: 2000});
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

// These are contract assertions, not replacement event generation. The
// reference above still comes exclusively from the executed source functions.
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
    `${label}: expected ${expected}, got ${actual}`);
}
for (const level of music) {
  for (const row of level.movement) {
    const chords = row.section ? level.chorus_chords_hz : level.verse_chords_hz;
    const chord = chords[(row.bar + (row.section ? level.chorus_walk_offset : 0)) % 4];
    const figure = row.kind === 'tap' ? [0, 2, 1, 3, 2, 0, 3, 1] :
      row.direction < 0 ? [2, 1, 0, 1] : [1, 2, 3, 2];
    const voices = row.ring >= 2 ? 3 : 2;
    assert.equal(row.events.length, 8 * voices, 'Eight movement inputs retain every voice');
    for (let input = 0; input < 8; input++) {
      const ci = figure[input % figure.length] + row.ring;
      for (const [voice, offset] of [2, 0, 4].slice(0, voices).entries()) {
        const event = row.events[input * voices + voice], slot = ci + offset;
        near(event.time, 1 + input * values.SPB + 0.012, 'Movement onset');
        near(event.frequency, chord[slot % 4] * 2 ** Math.floor(slot / 4), 'Movement chord frequency');
      }
    }
  }
  for (const release of level.starfall) {
    const leads = Array.from(release.events).filter(event => event.voice === 'lead');
    const expected = [];
    for (let slot = 0; slot < values.PAY * 2; slot++) {
      const bar = slot >> 4, step = slot % 16;
      const degree = bar >= 2 ? values.ANSWERL[level.level - 1][(step + (bar === 3 ? 4 : 0)) % 16] :
        (release.release_number % 2 === 0 ? values.HOOKBL : values.HOOKL)[level.level - 1][slot];
      if (degree >= 0) expected.push({time: slot * values.S16,
        frequency: values.PENT_BASE[degree] * level.original_key_multiplier});
    }
    assert.equal(leads.length, expected.length, 'Starfall retains every authored opening/answer attack');
    for (let i = 0; i < expected.length; i++) {
      near(leads[i].time, expected[i].time, 'Starfall sixteenth onset');
      near(leads[i].frequency, expected[i].frequency, 'Starfall authored frequency');
    }
  }
}

// Record actual WebAudio calls, without evaluating oscillators, filters, noise
// samples or AudioParam interpolation. A separate VM keeps the 450 existing
// high-level scenarios and their recording sinks completely unchanged.
function synthRecorder() {
  const nodes = [], events = [], connections = [], errors = [];
  const ids = new WeakMap();
  function unsupported(label) {
    errors.push(label);
    throw new Error(label);
  }
  function parameter(node, property) {
    let value;
    const param = {
      get value() {
        if (value === undefined) unsupported(`Unmodelled AudioParam default: ${node}.${property}`);
        return value;
      },
      set value(next) {
        value = next;
        events.push({node, property, method: 'value', args: [next]});
      },
    };
    for (const method of ['setValueAtTime', 'linearRampToValueAtTime',
      'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) {
      param[method] = (...args) => {
        events.push({node, property, method, args});
        return param;
      };
    }
    return param;
  }
  function node(kind, properties = {}, parameters = [], label = null) {
    const id = label ? `bus-${label}` : `${kind}-${nodes.length}`;
    const record = {id, kind, properties: {...properties}};
    nodes.push(record);
    const object = {
      connect(target) {
        const to = ids.get(target);
        if (!to) unsupported(`Unknown connection target from ${id}`);
        connections.push({from: id, to});
        return target;
      },
      start(...args) { events.push({node: id, method: 'start', args}); },
      stop(...args) { events.push({node: id, method: 'stop', args}); },
    };
    for (const property of parameters) object[property] = parameter(id, property);
    for (const property of Object.keys(properties)) Object.defineProperty(object, property, {
      get: () => record.properties[property],
      set: value => { record.properties[property] = value; },
    });
    ids.set(object, id);
    return object;
  }
  const buses = Object.fromEntries(['band', 'player', 'reverb', 'delay'].map(label => [label, node('bus', {}, [], label)]));
  const audio = {
    currentTime: 0, state: 'running',
    createOscillator: () => node('oscillator', {type: null}, ['frequency', 'detune']),
    createGain: () => node('gain', {}, ['gain']),
    createBiquadFilter: () => node('filter', {type: null}, ['frequency', 'Q']),
    createStereoPanner: () => node('panner', {}, ['pan']),
    createBufferSource: () => node('buffer-source', {buffer: null, loop: false}),
  };
  return {nodes, events, connections, errors, audio, buses};
}
function synthScenario(id, voice, level, inputs, code) {
  const recorder = synthRecorder();
  const synthContext = vm.createContext({Math, muted: false,
    // A labelled stand-in allows the real hat() graph to be traced. Its random
    // noise samples are intentionally neither generated nor represented here.
    NOISE: {reference: 'runtime-NOISE-buffer; samples not recorded'},
    CH: values.PROG[level - 1], AC: recorder.audio,
    A: {bed: recorder.buses.band, perf: recorder.buses.player,
      send: recorder.buses.reverb, dly: recorder.buses.delay},
  });
  for (const name of ['note', 'hat', 'kick', 'snare', 'bassN']) loadFunction(name, synthContext);
  vm.runInContext(code, synthContext, {timeout: 2000});
  assert.deepEqual(recorder.errors, [], `Unsupported synth recording operation in ${id}`);
  return {id, voice, level, inputs, nodes: recorder.nodes,
    events: recorder.events, connections: recorder.connections};
}
function assertCalls(trace, node, property, expected) {
  const actual = trace.events.filter(event => event.node === node.id && event.property === property);
  assert.equal(actual.length, expected.length, `${trace.id}: ${node.id}.${property || 'lifecycle'} call count`);
  for (let i = 0; i < expected.length; i++) {
    const [method, ...args] = expected[i];
    assert.equal(actual[i].method, method, `${trace.id}: AudioParam method`);
    assert.equal(actual[i].args.length, args.length, `${trace.id}: AudioParam argument count`);
    for (let j = 0; j < args.length; j++) near(actual[i].args[j], args[j], `${trace.id}: ${method} argument ${j}`);
  }
}
function connected(trace, from, kind) {
  const matches = trace.connections.filter(edge => edge.from === from.id)
    .map(edge => trace.nodes.find(node => node.id === edge.to)).filter(node => node.kind === kind);
  assert.equal(matches.length, 1, `${trace.id}: one ${kind} follows ${from.id}`);
  return matches[0];
}
function assertNote(trace, oscillator, {frequency, time, duration, wave, gain, cutoff, bus = 'band'}) {
  assert.equal(oscillator.properties.type, wave, `${trace.id}: oscillator waveform`);
  assertCalls(trace, oscillator, 'frequency', [['setValueAtTime', frequency, time]]);
  assertCalls(trace, oscillator, undefined, [['start', time], ['stop', time + duration + 0.02]]);
  const filter = connected(trace, oscillator, 'filter');
  assert.equal(filter.properties.type, 'lowpass');
  assertCalls(trace, filter, 'frequency', [['setValueAtTime', cutoff, time],
    ['exponentialRampToValueAtTime', Math.max(180, cutoff * 0.35), time + duration]]);
  const envelope = connected(trace, filter, 'gain');
  assertCalls(trace, envelope, 'gain', [['setValueAtTime', 0.0001, time],
    ['exponentialRampToValueAtTime', gain, time + 0.012],
    ['exponentialRampToValueAtTime', 0.0001, time + duration]]);
  assert.ok(trace.connections.some(edge => edge.from === envelope.id && edge.to === `bus-${bus}`),
    `${trace.id}: voice reaches ${bus} bus`);
}
const synthScenarios = [];
const synthTime = 2, synthGain = 0.125, bassDuration = 0.30;
const kickTrace = synthScenario('kick', 'kick', 1, {time: synthTime, gain: synthGain},
  `kick(${synthTime}, ${synthGain})`);
const kickOscillators = kickTrace.nodes.filter(node => node.kind === 'oscillator');
assert.equal(kickOscillators.length, 1);
const kickOscillator = kickOscillators[0];
assert.equal(kickOscillator.properties.type, 'sine');
assertCalls(kickTrace, kickOscillator, 'frequency', [['setValueAtTime', 400, synthTime],
  ['exponentialRampToValueAtTime', 48, synthTime + 0.075]]);
assertCalls(kickTrace, kickOscillator, undefined, [['start', synthTime], ['stop', synthTime + 0.27]]);
const kickGain = connected(kickTrace, kickOscillator, 'gain');
assertCalls(kickTrace, kickGain, 'gain', [['setValueAtTime', 0.0001, synthTime],
  ['exponentialRampToValueAtTime', synthGain, synthTime + 0.006],
  ['exponentialRampToValueAtTime', 0.0001, synthTime + 0.24]]);
assert.ok(kickTrace.connections.some(edge => edge.from === kickGain.id && edge.to === 'bus-band'));
synthScenarios.push(kickTrace);
for (let level = 1; level <= 6; level++) {
  const frequency = values.PROG[level - 1][0][0];
  const snareTrace = synthScenario(`snare-l${level}`, 'snare', level,
    {time: synthTime, gain: synthGain, wet: 0.25, tonic_root_hz: frequency},
    `snare(${synthTime}, ${synthGain}, 0.25)`);
  const oscillators = snareTrace.nodes.filter(node => node.kind === 'oscillator');
  assert.equal(oscillators.length, 1);
  assertNote(snareTrace, oscillators[0], {frequency: frequency * 1.7818,
    time: synthTime, duration: 0.085, wave: 'triangle', gain: synthGain * 0.5, cutoff: 900});
  const noises = snareTrace.nodes.filter(node => node.kind === 'buffer-source');
  assert.equal(noises.length, 1);
  assert.equal(noises[0].properties.loop, true);
  assertCalls(snareTrace, noises[0], undefined, [['start', synthTime], ['stop', synthTime + 0.17 + 0.03]]);
  const highpass = connected(snareTrace, noises[0], 'filter');
  assert.equal(highpass.properties.type, 'highpass');
  assertCalls(snareTrace, highpass, 'frequency', [['value', 1900]]);
  const noiseGain = connected(snareTrace, highpass, 'gain');
  assertCalls(snareTrace, noiseGain, 'gain', [['setValueAtTime', 0.0001, synthTime],
    ['exponentialRampToValueAtTime', synthGain, synthTime + 0.004],
    ['exponentialRampToValueAtTime', 0.0001, synthTime + 0.17]]);
  synthScenarios.push(snareTrace);

  const bassTrace = synthScenario(`bass-l${level}`, 'bassN', level,
    {frequency, time: synthTime, duration: bassDuration, gain: synthGain},
    `bassN(${frequency}, ${synthTime}, ${bassDuration}, ${synthGain})`);
  const components = bassTrace.nodes.filter(node => node.kind === 'oscillator');
  assert.equal(components.length, 3, 'Bass consists of three independent source voices');
  for (const [index, [ratio, wave, weight, length, cutoff]] of [
    [1, 'sawtooth', 0.8, 1, 900], [0.5, 'sine', 1, 1, 320], [2, 'square', 0.30, 0.6, 1600],
  ].entries()) assertNote(bassTrace, components[index], {frequency: frequency * ratio, time: synthTime,
    duration: bassDuration * length, wave, gain: synthGain * weight, cutoff});
  synthScenarios.push(bassTrace);
}
// Reuse an actual movement event as the standalone note() input rather than
// inventing another instrument preset. This additionally captures its dry bus
// and echo send, which would be lost by recording only oscillator frequency.
const playerEvent = firstTap.events[0];
const playerNoteTrace = synthScenario('note-player-first-tap', 'note', 1, {...playerEvent},
  `note(${playerEvent.frequency}, ${playerEvent.time}, ${playerEvent.duration}, ${JSON.stringify(playerEvent.wave)},
    ${playerEvent.gain}, ${playerEvent.cutoff}, ${playerEvent.pan}, A.perf, ${playerEvent.echo})`);
const playerOscillators = playerNoteTrace.nodes.filter(node => node.kind === 'oscillator');
assert.equal(playerOscillators.length, 1);
assertNote(playerNoteTrace, playerOscillators[0], {...playerEvent});
for (const [bus, value] of [['reverb', 0.28], ['delay', playerEvent.echo]]) {
  const sends = playerNoteTrace.connections.filter(edge => edge.to === `bus-${bus}`);
  assert.equal(sends.length, 1);
  const gain = playerNoteTrace.nodes.find(node => node.id === sends[0].from);
  assertCalls(playerNoteTrace, gain, 'gain', [['value', value]]);
}
synthScenarios.push(playerNoteTrace);
const synthReference = {
  format: 'cosmo-original-synth-trace-v1',
  method: 'Actual source note/hat/kick/snare/bassN execute in a separate VM. Nodes, connections, oscillator lifecycle and AudioParam calls are recorded, never synthesized by this exporter.',
  limits: 'Times are seconds in explicit synthetic test scenarios. No PCM, random noise samples, filter transfer function, default AudioParam values, automation interpolation, master effects, live scheduler or native timing is evaluated. The labelled NOISE buffer is a stand-in only.',
  scenarios: synthScenarios,
};
const artifact = {
  format: 'cosmo-original-audio-reference-v1',
  source: {path: 'src/game/runtime.js', sha256: createHash('sha256').update(source).digest('hex')},
  method: 'Authored declarations extracted with an offset-preserving comment/quote scanner and balanced delimiters; actual payoffStep, performerHit, chTone and chI executed in a bounded VM with recording sinks.',
  limits: 'Symbolic pitches, timing and voice parameters, not rendered PCM or an auditory/performance test. Movement uses zero timing bonus and centered pan; Starfall scenario values are recorded per variant. Normal melody tables are exported without simulating the full ordinary arrangement.',
  origins, tables: values, levels: music, synth_reference: synthReference,
};
const output = path.resolve(process.argv[2] || path.join(root, 'work/godot-collaboration/original-audio-reference.json'));
await fs.mkdir(path.dirname(output), {recursive: true});
await fs.writeFile(output, JSON.stringify(artifact, (_key, value) => value === Infinity ? 'Infinity' : value, 2) + '\n');
console.log(JSON.stringify({original_audio_reference: 'passed', output,
  source_sha256: artifact.source.sha256, levels: music.length,
  starfall_scenarios: music.reduce((sum, level) => sum + level.starfall.length, 0),
  movement_scenarios: music.reduce((sum, level) => sum + level.movement.length, 0),
  synth_scenarios: synthScenarios.length}));
