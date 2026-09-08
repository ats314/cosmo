// Original Cosmo audio. All synthesis, notes and arrangements are project-owned.
// Run from any directory: node native-godot/tools/generate_audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const OUT = fileURLToPath(new URL('../audio/', import.meta.url));
const SR = 31200; // Exactly 18,000 samples per beat at 104 BPM.
const BPM = 104;
const BEAT = 60 / BPM;
const TAU = Math.PI * 2;
const FRAMES = 32 * 18000;
let seed = 0x43534d4f;
const noise = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 2147483648 - 1;
};
let transpose = 0;
const contentSource = fs.readFileSync(new URL('../scripts/cosmo_content.gd', import.meta.url), 'utf8');
const PROFILES = [...contentSource.matchAll(/"tonic_midi":\s*(\d+),[\s\S]*?"chord_degrees":\s*(\[[\d,\s]+\]),\s*"arp":\s*(\[[\d,\s]+\])/g)]
  .map((match) => ({ tonic_midi: Number(match[1]), chord_degrees: JSON.parse(match[2]), arp: JSON.parse(match[3]) }));
if (PROFILES.length !== 6 || new Set(PROFILES.map((profile) => profile.tonic_midi)).size !== 6) throw new Error('Expected six unique source harmony profiles');

// THE AUTHORED HOOKS, READ FROM THE ORIGINAL RATHER THAN REINVENTED.
//
// The first cut of this generator built its melody by walking each world's
// eight-note pentatonic `arp` in a rotating pattern. That produced a tune, but
// it was not COSMO'S tune: the game's actual melodies are the hand-written
// HOOKL tables in the web runtime, six levels of eight bars at sixteenth
// resolution, with deliberate rests and a composed contour. Deriving a melody
// from the chord degrees threw all of that away, which is exactly why the port
// sounded like a different game.
//
// So the hooks are read from src/game/runtime.js, the file that owns them, and
// transcribed nowhere. HOOKL holds indices into PENT (-1 is a rest); PENT is a
// frequency table, and every pitch in the original is an INTERVAL OVER THE
// LEVEL'S TONIC rather than an absolute — which is why converting to a MIDI
// offset here and letting `transpose` place it in the key is the faithful
// reading, not a shortcut.
const RUNTIME = fileURLToPath(new URL('../../src/game/runtime.js', import.meta.url));
function readAuthoredHooks() {
  let source;
  try { source = fs.readFileSync(RUNTIME, 'utf8'); }
  catch { throw new Error(`Cannot read ${RUNTIME}. The authored melodies live in the original runtime; without it these stems would be an invented tune again.`); }

  const table = (name) => {
    const at = source.indexOf(`const ${name}=[`);
    if (at < 0) throw new Error(`${name} is not in the runtime any more — the melody source moved and this generator must be repointed`);
    // Walk brackets so the nested per-level arrays are captured whole, and so a
    // comment containing a bracket cannot end the match early.
    let depth = 0, start = source.indexOf('[', at), i = start;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
    }
    const body = source.slice(start, i + 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const parsed = JSON.parse(body.replace(/,\s*]/g, ']'));
    return parsed;
  };

  const pent = table('PENT');
  const hooks = table('HOOKL');
  if (hooks.length < 6) throw new Error(`HOOKL carries ${hooks.length} levels; six are needed`);
  // PENT is frequencies; the synth speaks MIDI. 440Hz is A4 = 69.
  const toMidi = (hz) => Math.round(69 + 12 * Math.log2(hz / 440));
  return hooks.slice(0, 6).map((hook) => {
    if (hook.length !== 128) throw new Error(`A hook is ${hook.length} slots; expected 128 (8 bars x 16 sixteenths)`);
    return hook.map((degree) => (degree < 0 || degree >= pent.length ? -1 : toMidi(pent[degree])));
  });
}
const HOOKS = readAuthoredHooks();
let MELODY_LEVEL = 0;
const TONICS = PROFILES.map((profile) => profile.tonic_midi);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTATONIC = [0, 3, 5, 7, 10];
const minorDegree = (degree) => MINOR[degree % 7] + 12 * Math.floor(degree / 7);
// Bass octave choices preserve the source PROG rows' descending/climbing lines.
// The content ledger carries pitch classes; the musical voicing remains here.
const ROOT_OCTAVES = { 69: [0, -12, 0, -12], 67: [0, -12, -12, -12],
  65: [0, 0, 0, 0], 63: [0, -12, -12, 0], 61: [0, 0, 0, 0], 59: [0, 0, 0, 0] };
for (const profile of PROFILES) {
  if (profile.chord_degrees.length !== 4 || profile.chord_degrees[0] !== 0
      || profile.arp.length !== 8 || profile.arp.some((degree) => degree < 0 || degree > 4)) throw new Error('Invalid source harmony profile');
  profile.chord_root_semitones = profile.chord_degrees.map((degree) => MINOR[degree]);
}
const hz = (midi) => 440 * 2 ** ((midi + transpose - 69) / 12);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => (x = clamp(x, 0, 1), x * x * (3 - 2 * x));
const create = (seconds, loop = false) => ({ samples: new Float32Array(Math.round(seconds * SR) * 2), loop });
let stems;
const report = { format: '16-bit PCM; stereo bed and releases, mono pulse/drums/answer/cues', sample_rate: SR, bpm: BPM, tonics_midi: TONICS,
  harmony_source: 'scripts/cosmo_content.gd', harmony_source_sha256: createHash('sha256').update(contentSource).digest('hex'),
  harmony_profiles: PROFILES, beats_per_chord: 4, beats_per_loop: 32, frames_per_loop: FRAMES, files: [], arrangement_peaks: {} };

function add(buffer, start, length, voice, gain = 1, pan = 0) {
  const frames = buffer.samples.length / 2;
  const begin = Math.round(start * SR);
  const count = Math.round(length * SR);
  const left = Math.sqrt((1 - pan) * 0.5);
  const right = Math.sqrt((1 + pan) * 0.5);
  for (let i = 0; i < count; i++) {
    let j = begin + i;
    if (buffer.loop) j = ((j % frames) + frames) % frames;
    else if (j < 0 || j >= frames) continue;
    const sample = voice(i / SR, i) * gain;
    buffer.samples[j * 2] += sample * left;
    buffer.samples[j * 2 + 1] += sample * right;
  }
}

function tone(buffer, start, length, midi, gain, kind = 'brass', pan = 0) {
  let f = hz(midi);
  if (kind === 'bass') while (f < 40) f *= 2;
  const attack = kind === 'pad' ? 0.32 : kind === 'bass' ? 0.009 : kind === 'answer' ? 0.055 : 0.012;
  const release = kind === 'pad' ? 0.8 : kind === 'bass' ? 0.09 : Math.min(0.3, length * 0.4);
  add(buffer, start, length, (t) => {
    const env = smooth(t / attack) * smooth((length - t) / release);
    const p = TAU * f * t;
    if (kind === 'pad') {
      return env * (Math.sin(p) * 0.57 + Math.sin(p * 1.0019) * 0.23
        + Math.sin(p * 2 + 0.18 * Math.sin(t * 1.7)) * 0.13 + Math.sin(p * 3) * 0.045);
    }
    if (kind === 'bass') {
      return env * Math.exp(-t * 1.8) * (Math.sin(p) * 0.8 + Math.sin(p * 2) * 0.21 + Math.sin(p * 3) * 0.085);
    }
    if (kind === 'pluck') {
      return env * Math.exp(-t * 6.5) * (Math.sin(p) + Math.sin(p * 2) * 0.24 + Math.sin(p * 3) * 0.06);
    }
    const warm = (kind === 'answer' ? 0.1 : 0.24) * Math.exp(-t * 3) + 0.09;
    return env * (Math.sin(p) * 0.79 + Math.sin(p * 2) * warm + Math.sin(p * 3) * warm * 0.42);
  }, gain, pan);
}

/* ---------- PERCUSSION AND BASS, AT WEBAUDIO PARITY ----------

   These three voices are transcribed from recorded traces of the original
   runtime's own graph, in work/godot-collaboration/original-audio-reference.json
   — not re-invented by ear. The earlier versions here were plausible drum
   synthesis and sounded nothing like Cosmo: the kick was a pitch-modulated sine
   over 430ms where the original is a 400->48Hz sweep in 75, and the snare was a
   fixed 220Hz body where the original's is TUNED TO THE LEVEL.

   WebAudio's primitives are reproduced rather than approximated:
   exponentialRampToValueAtTime is a geometric interpolation (which is why every
   envelope starts at 0.0001 and never at zero — an exponential ramp cannot
   leave or reach zero), and the filters are one-pole sections whose cutoff
   itself rides an exponential ramp. */

/* WebAudio's exponentialRampToValueAtTime, exactly: geometric between the two
   scheduled points, flat outside them. */
function expRamp(t, t0, v0, t1, v1) {
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
}

/* A one-pole low-pass whose cutoff moves per sample. Not a biquad, so it is
   gentler than BiquadFilterNode's 12dB slope; it holds the shape of the
   traced sweeps, which is what carries the character. */
function onePole() {
  let z = 0;
  return (x, cutoffHz) => {
    const a = 1 - Math.exp(-TAU * Math.max(20, cutoffHz) / SR);
    z += (x - z) * a;
    return z;
  };
}

/* THE KICK. 400Hz to 48Hz in 75ms, and the phase is integrated in closed form
   rather than stepped: for f(t) = f0*(f1/f0)^(t/T) the integral is
   f0*T/ln(k) * (k^(t/T) - 1), which stays exact at any sample rate. Stepping it
   accumulates a pitch error that makes the drop land flat. */
function kick(buffer, beat, gain = 1) {
  const F0 = 400, F1 = 48, SWEEP = 0.075, LEN = 0.27;
  const k = F1 / F0;
  const lnk = Math.log(k);
  const sweepPhase = F0 * SWEEP / lnk * (k - 1);
  add(buffer, beat * BEAT, LEN, (t) => {
    const phase = t < SWEEP
      ? F0 * SWEEP / lnk * (Math.pow(k, t / SWEEP) - 1)
      : sweepPhase + F1 * (t - SWEEP);
    const env = t < 0.006
      ? expRamp(t, 0, 0.0001, 0.006, 0.125)
      : expRamp(t, 0.006, 0.125, 0.24, 0.0001);
    return Math.sin(TAU * phase) * env * 8.0;
  }, gain);
}

/* THE SNARE, TUNED TO THE LEVEL. Two voices: high-passed noise for the rattle,
   and a triangle body at the tonic root x 1.7818 whose low-pass falls 900->315
   in 85ms. That ratio is what makes each world's backbeat sit in its own key
   instead of fighting it, and it is the single biggest reason the old fixed
   220Hz snare read as belonging to a different piece of music. */
function snare(buffer, beat, gain = 1, bodyHz = 195.998) {
  const lpBody = onePole();
  let hpPrev = 0, hpOut = 0;
  add(buffer, beat * BEAT, 0.2, (t) => {
    /* Rattle: one-pole high-pass at 1900Hz, x0.25 post-gain. */
    const raw = noise();
    const a = Math.exp(-TAU * 1900 / SR);
    hpOut = a * (hpOut + raw - hpPrev);
    hpPrev = raw;
    const rattleEnv = t < 0.004
      ? expRamp(t, 0, 0.0001, 0.004, 0.125)
      : expRamp(t, 0.004, 0.125, 0.17, 0.0001);
    const rattle = hpOut * rattleEnv * 0.25;

    /* Body: triangle through a low-pass sweeping 900 -> 315 over 85ms. */
    let body = 0;
    if (t < 0.105) {
      const ph = (bodyHz * t) % 1;
      const tri = 4 * Math.abs(ph - 0.5) - 1;
      const bodyEnv = t < 0.012
        ? expRamp(t, 0, 0.0001, 0.012, 0.0625)
        : expRamp(t, 0.012, 0.0625, 0.085, 0.0001);
      body = lpBody(tri, expRamp(t, 0, 900, 0.085, 315)) * bodyEnv * 0.5;
    }
    return (rattle + body) * 9.0;
  }, gain);
}

/* THE BASS, IN THREE VOICES. Saw at the root, sine an octave below, square an
   octave above — each with its own low-pass sweep and its own decay, which is
   why it reads as one fat instrument rather than three stacked notes. The
   square is deliberately the shortest and quietest: it supplies the attack's
   edge and then leaves. */
function bassVoice(buffer, start, rootHz, gain = 1, pan = 0) {
  const lpSaw = onePole(), lpSub = onePole(), lpSq = onePole();
  add(buffer, start, 0.32, (t) => {
    const sawPh = (rootHz * t) % 1;
    const saw = (2 * sawPh - 1)
      * expRamp(t, 0.012, 0.1, 0.3, 0.0001)
      * (t < 0.012 ? t / 0.012 : 1);
    const sub = Math.sin(TAU * (rootHz * 0.5) * t)
      * expRamp(t, 0.012, 0.125, 0.3, 0.0001)
      * (t < 0.012 ? t / 0.012 : 1);
    let sq = 0;
    if (t < 0.2) {
      sq = (((rootHz * 2 * t) % 1) < 0.5 ? 1 : -1)
        * expRamp(t, 0.012, 0.0375, 0.18, 0.0001)
        * (t < 0.012 ? t / 0.012 : 1);
    }
    return (lpSaw(saw, expRamp(t, 0, 900, 0.3, 315)) * 0.5
      + lpSub(sub, expRamp(t, 0, 320, 0.3, 180)) * 0.5
      + lpSq(sq, expRamp(t, 0, 1600, 0.18, 560)) * 0.5) * 6.0;
  }, gain, pan);
}

function hat(buffer, beat, gain = 1, open = false, pan = 0) {
  let low = 0;
  let softened = 0;
  const length = open ? 0.16 : 0.06;
  add(buffer, beat * BEAT, length, (t) => {
    const raw = noise(); low += (raw - low) * 0.35;
    softened += ((raw - low) - softened) * 0.38;
    return softened * Math.exp(-t * (open ? 22 : 65)) * smooth(t / 0.002) * smooth((length - t) / 0.014);
  }, gain, pan);
}

function space(buffer, wet = 0.2) {
  // Sparse dark early reflection network, baked once and wrapped for seamless stems.
  const dry = Float32Array.from(buffer.samples);
  const frames = dry.length / 2;
  for (const [seconds, level, swap] of [[0.031, 0.5, 1], [0.047, 0.39, 0], [0.083, 0.28, 1], [0.131, 0.19, 0], [0.211, 0.11, 1]]) {
    const delay = Math.round(seconds * SR);
    let l = 0, r = 0;
    // Start a loop's filter in settled state to keep the boundary continuous.
    const passes = buffer.loop ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < frames; i++) {
        let src = i - delay;
        if (buffer.loop) src = (src + frames) % frames;
        const a = src >= 0 ? dry[src * 2 + swap] : 0;
        const b = src >= 0 ? dry[src * 2 + 1 - swap] : 0;
        l += (a - l) * 0.19; r += (b - r) * 0.19;
        if (pass === passes - 1) { buffer.samples[i * 2] += l * level * wet; buffer.samples[i * 2 + 1] += r * level * wet; }
      }
    }
  }
}

function write(name, buffer, targetPeak, stereo = true) {
  let peak = 0;
  for (const sample of buffer.samples) peak = Math.max(peak, Math.abs(sample));
  const gain = targetPeak / Math.max(peak, 0.000001);
  let sum = 0;
  const channels = stereo ? 2 : 1;
  const frames = buffer.samples.length / 2;
  const wav = Buffer.alloc(44 + frames * channels * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(frames * channels * 2, 40);
  for (let i = 0; i < buffer.samples.length; i++) {
    const sample = buffer.samples[i] * gain;
    if (!Number.isFinite(sample) || Math.abs(sample) > 1) throw new Error(`Invalid sample in ${name}`);
    buffer.samples[i] = sample;
    sum += sample * sample;
    if (stereo) wav.writeInt16LE(Math.round(clamp(sample, -1, 1) * 32767), 44 + i * 2);
  }
  if (!stereo) for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(clamp((buffer.samples[i * 2] + buffer.samples[i * 2 + 1]) * 0.5, -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), wav);
  const boundary = Math.max(Math.abs(buffer.samples[0] - buffer.samples.at(-2)), Math.abs(buffer.samples[1] - buffer.samples.at(-1)));
  report.files.push({ name: `${name}.wav`, seconds: buffer.samples.length / 2 / SR, bytes: wav.length, channels,
    peak: targetPeak, rms: Math.sqrt(sum / buffer.samples.length), loop: buffer.loop,
    boundary_delta: boundary, sha256: createHash('sha256').update(wav).digest('hex') });
}

fs.mkdirSync(OUT, { recursive: true });
function worldChords(profile) {
  return Array.from({ length: 8 }, (_, bar) => {
    const index = bar % 4;
    const degree = profile.chord_degrees[index];
    const root = 45 + minorDegree(degree) + ROOT_OCTAVES[profile.tonic_midi][index];
    const third = minorDegree(degree + 2) - minorDegree(degree);
    const fifth = minorDegree(degree + 4) - minorDegree(degree);
    return { root, notes: [root + 12, root + 12 + third, root + 12 + fifth] };
  });
}
function worldMelody(profile, bar, release = false) {
  // THE LEVEL'S OWN HOOK, at the sixteenth resolution it was written at.
  //
  // Sixteen slots to the bar, so an offset step is a quarter of a beat. A -1 is
  // a rest and stays a rest: the gaps are the composition. Where the original
  // leaves whole bars empty it is making room for the player's own notes, and
  // filling them in "to keep the melody going" is precisely the instinct that
  // turned this into a different tune the first time.
  //
  // A note runs until the next attack, capped, so the phrase breathes instead
  // of machine-gunning at a fixed length.
  const hook = HOOKS[MELODY_LEVEL];
  const phrase = [];
  const base = bar * 16;
  for (let slot = 0; slot < 16; slot++) {
    const note = hook[base + slot];
    if (note < 0) continue;
    let gap = 1;
    while (slot + gap < 16 && hook[base + slot + gap] < 0) gap++;
    const beats = gap * 0.25;
    phrase.push([slot * 0.25, note, Math.min(release ? 0.9 : 1.4, Math.max(0.22, beats * 0.92))]);
  }
  return phrase;
}
for (const [levelIndex, profile] of PROFILES.entries()) {
// Which level's authored hook this render uses. PROFILES is in level order and
// so is HOOKL, so the index is the pairing — level 1 gets LIFT OFF's melody.
MELODY_LEVEL = levelIndex;
const tonic = profile.tonic_midi;
// The snare body tracks the world. The traced values are the tonic two octaves
// down times 1.7818 — 195.998Hz against A, 110.008 against B — so deriving it
// keeps all six in step instead of hard-coding a table that can drift from the
// keys it is supposed to follow.
const snareBodyHz = hz(tonic - 24) * 1.7818;
const chords = worldChords(profile);
transpose = tonic - 69;
stems = Object.fromEntries(['bed', 'pulse', 'drums', 'answer'].map((name) => [name, create(FRAMES / SR, true)]));
for (let bar = 0; bar < 8; bar++) {
  const chord = chords[bar];
  for (let v = 0; v < chord.notes.length; v++) {
    tone(stems.bed, bar * 4 * BEAT, 4 * BEAT + 0.8, chord.notes[v], 0.24, 'pad', (v - 1) * 0.55);
  }
  // The bed carries a single heartbeat. Full drums add complementary slots.
  kick(stems.bed, bar * 4, 0.33);
  // The traced three-voice bass, at the chord's own root. hz() already folds
  // the pitch class up past the 40Hz floor, and the sub sits an octave under
  // that, exactly as the original's sine leg does.
  for (const [offset, note, amp] of [[0, chord.root, 0.82], [1.5, chord.root, 0.55], [2.75, chord.root + 7, 0.44]]) {
    bassVoice(stems.pulse, (bar * 4 + offset) * BEAT, hz(note), amp);
  }
  kick(stems.drums, bar * 4 + 2, 0.88);
  if (bar % 2) kick(stems.drums, bar * 4 + 3.5, 0.4);
  // Keyed to this world: root x 1.7818, the ratio the original snare uses.
  snare(stems.drums, bar * 4 + 1, 0.49, snareBodyHz);
  snare(stems.drums, bar * 4 + 3, 0.66, snareBodyHz);
  for (let i = 0; i < 8; i++) hat(stems.drums, bar * 4 + i * 0.5, i % 2 ? 0.25 : 0.14, i === 7, i % 2 ? 0.3 : -0.25);
  for (const [offset, note, duration] of worldMelody(profile, bar)) tone(stems.answer, (bar * 4 + offset) * BEAT, duration * BEAT, note, 0.43, 'answer', bar % 2 ? 0.18 : -0.18);
}
space(stems.bed, 0.36); space(stems.pulse, 0.07); space(stems.answer, 0.47);
write(`bed_${tonic}`, stems.bed, 0.31); write(`pulse_${tonic}`, stems.pulse, 0.27, false);
write(`drums_${tonic}`, stems.drums, 0.29, false); write(`answer_${tonic}`, stems.answer, 0.24, false);

// Motion cues contain root/fifth only, permitting exact semitone transposition
// to the current chord without turning a major chord into a minor chord.
if (tonic === 69) {
for (const [name, duration, notes] of [
  ['turn', 0.38, [[0, 57, 0.23, 0.7], [0.025, 64, 0.3, 0.23]]],
  ['hop', 0.52, [[0, 57, 0.23, 0.54], [0.075, 64, 0.36, 0.37]]],
  ['star', 0.55, [[0, 69, 0.32, 0.55], [0.045, 76, 0.35, 0.2]]],
  ['orbit', 1.55, [[0, 45, 0.65, 0.65], [0.02, 57, 0.6, 0.35], [0.15, 64, 0.9, 0.25]]],
  ['magnet', 0.85, [[0, 45, 0.7, 0.36], [0.065, 57, 0.6, 0.43], [0.13, 64, 0.55, 0.28]]],
]) {
  const cue = create(duration);
  for (const [start, note, len, gain] of notes) tone(cue, start, len, note, gain, name === 'star' || name === 'turn' ? 'pluck' : 'brass');
  space(cue, name === 'orbit' ? 0.45 : 0.18);
  write(name, cue, name === 'orbit' ? 0.38 : 0.28, false);
}

const hit = create(0.65);
let hitLow = 0;
add(hit, 0, 0.35, (t) => { hitLow += (noise() - hitLow) * 0.17; return hitLow * Math.exp(-t * 11) * smooth(t / 0.002); }, 0.6);
tone(hit, 0, 0.55, 45, 0.7, 'bass'); tone(hit, 0.005, 0.23, 57, 0.2, 'brass');
write('hit', hit, 0.45, false);
}

const release = create(16 * BEAT + 0.9);
for (let bar = 0; bar < 4; bar++) {
  const chord = chords[bar];
  for (const note of chord.notes) tone(release, bar * 4 * BEAT, 4 * BEAT + 0.55, note, 0.16, 'pad');
  for (let b = 0; b < 4; b++) {
    const beat = bar * 4 + b;
    kick(release, beat, b % 2 ? 0.33 : 0.85);
    tone(release, (beat + 0.5) * BEAT, 0.3, chord.root, 0.53, 'bass');
    if (b === 1 || b === 3) snare(release, beat, 0.52);
    hat(release, beat + 0.5, 0.3, false, b % 2 ? -0.25 : 0.25);
  }
  for (const [offset, note, duration] of worldMelody(profile, bar, true)) tone(release, (bar * 4 + offset) * BEAT, duration * BEAT, note, 0.4, 'answer', bar % 2 ? 0.2 : -0.2);
}
space(release, 0.22); write(`starfall_${tonic}`, release, 0.69);

const finish = create(3.8);
for (const [start, note] of [[0, 57], [0.18, 60], [0.36, 64], [0.72, 69]]) tone(finish, start, 2.9, note, 0.3, 'pad', (note - 63) / 30);
tone(finish, 0, 1.4, 45, 0.55, 'bass'); space(finish, 0.4); write(`finish_${tonic}`, finish, 0.48);

// Verify a whole overlapping loop with the runtime's maximum layer gains.
let mixedPeak = 0;
for (let i = 0; i < FRAMES * 2; i++) mixedPeak = Math.max(mixedPeak, Math.abs(stems.bed.samples[i] * 0.82 + stems.pulse.samples[i] * 0.82 + stems.drums.samples[i] * 0.8 + stems.answer.samples[i] * 0.7));
report.arrangement_peaks[tonic] = mixedPeak;
if (mixedPeak >= 0.9) throw new Error(`Arrangement has insufficient headroom: ${mixedPeak}`);
}
report.total_bytes = report.files.reduce((n, file) => n + file.bytes, 0);
if (report.files.some((file) => file.loop && file.boundary_delta > 0.035)) throw new Error('Audible discontinuity at a loop seam');
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated ${report.files.length} original audio assets, ${(report.total_bytes / 1024 / 1024).toFixed(2)} MiB; maximum layered peak ${Math.max(...Object.values(report.arrangement_peaks)).toFixed(3)}.`);
