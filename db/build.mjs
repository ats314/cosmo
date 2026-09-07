#!/usr/bin/env node
/* Merge the extracted parts into collections, and refuse to publish a lie.

   The parts under db/records/parts/ are written by many hands — agent sessions,
   future extractions, hand edits. This file is the only thing standing between
   them and the collections a later agent will trust without checking. It
   therefore validates rather than concatenates: every record against the
   contract in ONTOLOGY.md, every id for uniqueness, and every anchor against
   the real line count of the real file.

   THE ANCHOR CHECK IS THE POINT. src/game/runtime.js is twelve thousand lines,
   and a record claiming a thing lives at line 4200 when it lives at 6800 costs
   more than a missing record would: the missing one sends you looking, the
   wrong one sends you somewhere else and lets you conclude the thing is not
   there. So an anchor past the end of its file is a build failure, not a
   warning, and `--verify` makes staleness detectable without a rebuild.

   Deliberately not a harness and deliberately not in tools/. tools/check.mjs
   fails on any tools/*.mjs the CI workflow does not run, and this is a
   generator, not a check. Run it after changing the database or the source it
   describes. */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const VERIFY = process.argv.includes('--verify');
const fail = [];
const warn = [];

/* The routing table is the ontology's kind list, in code. A kind that arrives
   without a home fails rather than falling into a default bucket, because a
   record filed under "misc" is a record nobody will ever find again. */
const COLLECTION = {
  system: 'code', symbol: 'code', boundary: 'code',
  tunable: 'tunables',
  level: 'content', mechanic: 'content', orb: 'content',
  upgrade: 'content', formation: 'content', lesson: 'content',
  invariant: 'rules',
  coverage: 'coverage',
  decision: 'decisions',
  asset: 'assets',
  insight: 'research',
  opportunity: 'opportunities',
  source: 'sources',
};

const REQUIRED = ['id', 'kind', 'name', 'summary', 'tags', 'status', 'provenance', 'confidence'];
const NEEDS_ANCHOR = new Set(['system', 'symbol', 'boundary', 'tunable']);
const STATUS = new Set(['current', 'retired', 'proposed']);
const PROVENANCE = new Set(['generated', 'extracted', 'authored']);
const CONFIDENCE = new Set(['verified', 'inferred']);
/* Added when Cosmo committed to a Godot 4 / GDScript rebuild. Optional, because
   the first extraction ran before the decision and its records are still true —
   but an unclassified record is reported, since "does this survive the engine
   change?" is the question the rebuild will ask of every one of them. */
const PORTABILITY = new Set(['spec', 'tuning', 'reference', 'obsolete']);

/* Line counts are read once per file and reused. Anchor validation touches the
   same handful of files thousands of times, and re-reading runtime.js for each
   of them turns a one-second build into a minute of waiting. */
const lineCounts = new Map();
async function linesIn(path) {
  if (lineCounts.has(path)) return lineCounts.get(path);
  let n = null;
  try { n = (await readFile(new URL(path, root), 'utf8')).split('\n').length; }
  catch { n = null; }
  lineCounts.set(path, n);
  return n;
}

async function checkAnchor(anchor, id) {
  if (typeof anchor !== 'string') return `${id}: anchor is not a string`;
  /* A bare path is a legitimate anchor and means the whole file. The first cut
     demanded a line number, and rejected records pointing at things where the
     file IS the unit — docs/harnesses.md, runtime.d.ts, a licence manifest.
     Requiring a line there would have forced writers to invent one, which is
     precisely the confidently-wrong anchor this validation exists to catch. */
  const m = anchor.match(/^([^:]+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!m) return `${id}: anchor "${anchor}" is not a path, path:line, or path:start-end`;
  const [, path, a, b] = m;
  if (a === undefined) {
    return (await linesIn(path)) === null
      ? `${id}: anchor "${anchor}" names a file that does not exist`
      : null;
  }
  const total = await linesIn(path);
  if (total === null) return `${id}: anchor "${anchor}" names a file that does not exist`;
  const start = Number(a), end = b ? Number(b) : Number(a);
  if (start < 1 || end < start) return `${id}: anchor "${anchor}" has an impossible range`;
  if (end > total) return `${id}: anchor "${anchor}" ends past ${path}'s ${total} lines`;
  return null;
}

let partFiles = [];
try {
  partFiles = (await readdir(new URL('db/records/parts/', root))).filter(f => f.endsWith('.jsonl')).sort();
} catch {
  console.error('FAIL  db/records/parts/ does not exist — there is nothing to build from.');
  process.exit(1);
}
if (!partFiles.length) {
  console.error('FAIL  db/records/parts/ holds no .jsonl parts. A build over nothing would report success, so it does not.');
  process.exit(1);
}

const byId = new Map();
const records = [];
for (const file of partFiles) {
  const body = await readFile(new URL(`db/records/parts/${file}`, root), 'utf8');
  for (const [i, line] of body.split('\n').entries()) {
    const text = line.trim();
    if (!text) continue;
    let rec;
    try { rec = JSON.parse(text); }
    catch (e) { fail.push(`${file}:${i + 1} is not valid JSON — ${e.message}`); continue; }
    if (Array.isArray(rec)) { fail.push(`${file}:${i + 1} is an array; JSONL holds one object per line`); continue; }

    for (const f of REQUIRED) {
      if (rec[f] === undefined || rec[f] === null || rec[f] === '') {
        fail.push(`${file}:${i + 1} (${rec.id || 'no id'}) is missing "${f}"`);
      }
    }
    if (!COLLECTION[rec.kind]) {
      fail.push(`${file}:${i + 1} (${rec.id}) has unknown kind "${rec.kind}" — add it to ONTOLOGY.md and this table, or fix the record`);
    }
    if (rec.status && !STATUS.has(rec.status)) fail.push(`${rec.id}: status "${rec.status}" is not current/retired/proposed`);
    if (rec.provenance && !PROVENANCE.has(rec.provenance)) fail.push(`${rec.id}: provenance "${rec.provenance}" is not generated/extracted/authored`);
    if (rec.confidence && !CONFIDENCE.has(rec.confidence)) fail.push(`${rec.id}: confidence "${rec.confidence}" is not verified/inferred`);
    if (rec.tags && !Array.isArray(rec.tags)) fail.push(`${rec.id}: tags must be an array`);
    if (rec.portability && !PORTABILITY.has(rec.portability)) fail.push(`${rec.id}: portability "${rec.portability}" is not spec/tuning/reference/obsolete`);
    if (typeof rec.summary === 'string' && rec.summary.length > 240) {
      warn.push(`${rec.id}: summary is ${rec.summary.length} chars — the contract asks for one sentence under 200`);
    }

    if (byId.has(rec.id)) fail.push(`duplicate id "${rec.id}" in ${file} and ${byId.get(rec.id)} — an id is an address, so two records cannot share one`);
    else byId.set(rec.id, file);

    const anchors = rec.anchors || [];
    if (NEEDS_ANCHOR.has(rec.kind) && !anchors.length) fail.push(`${rec.id}: kind "${rec.kind}" names code and must carry an anchor`);
    for (const a of anchors) {
      const bad = await checkAnchor(a, rec.id);
      if (bad) fail.push(bad);
    }
    if (rec.values && typeof rec.values !== 'object') fail.push(`${rec.id}: values must be an object`);
    rec._part = file;
    records.push(rec);
  }
}

/* Dangling links are reported, never fatal. The ontology says a link to a
   record that does not exist yet marks a gap worth filling — failing the build
   on one would punish exactly the honesty that makes the gap visible. */
for (const rec of records) {
  for (const l of rec.links || []) {
    if (!byId.has(l)) warn.push(`${rec.id} links to "${l}", which no record defines`);
  }
}

if (fail.length) {
  for (const f of fail) console.error(`FAIL  ${f}`);
  console.error(`\n${fail.length} problem(s). Nothing was written — a half-valid database is worse than no database.`);
  process.exit(1);
}

/* Fingerprints, so staleness is detectable. A record's value can only go wrong
   if the source moved under it; hashing the sources this database describes
   turns "is it still current?" from a judgement into a comparison. */
const SOURCES = ['src/game/runtime.js', 'src/game/contracts.ts', 'src/scenes/CosmoScene.ts',
  'MECHANICS.md', 'docs/invariants.md', 'docs/harnesses.md', 'public/art/manifest.json'];
const fingerprints = {};
for (const s of SOURCES) {
  try { fingerprints[s] = createHash('sha256').update(await readFile(new URL(s, root))).digest('hex').slice(0, 16); }
  catch { fingerprints[s] = null; }
}
let commit = null;
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); }
catch { /* a database built outside a checkout is still a database */ }

if (VERIFY) {
  let prior = null;
  try { prior = JSON.parse(await readFile(new URL('db/index.json', root), 'utf8')); } catch { /* handled below */ }
  if (!prior) {
    console.error('FAIL  --verify has no db/index.json to compare against. Run `node db/build.mjs` first.');
    process.exit(1);
  }
  const moved = SOURCES.filter(s => !prior.fingerprints || prior.fingerprints[s] !== fingerprints[s]);
  if (moved.length) {
    console.error('FAIL  the database was built against different sources:\n  ' + moved.join('\n  ')
      + '\n\nRecords describing these files may name values that no longer exist. Run `node db/build.mjs`.');
    process.exit(1);
  }
  console.log(`OK  ${records.length} records valid, built against the current ${SOURCES.length} sources`);
  process.exit(0);
}

const collections = {};
for (const rec of records) (collections[COLLECTION[rec.kind]] ||= []).push(rec);

await mkdir(new URL('db/records/', root), { recursive: true });
const summary = {};
for (const [name, list] of Object.entries(collections)) {
  list.sort((a, b) => a.id.localeCompare(b.id));
  const out = list.map(r => { const { _part, ...clean } = r; return JSON.stringify(clean); }).join('\n') + '\n';
  await writeFile(new URL(`db/records/${name}.jsonl`, root), out);
  summary[name] = list.length;
}

const kinds = {}, tags = {}, areas = {}, portability = { spec: 0, tuning: 0, reference: 0, obsolete: 0, unclassified: 0 };
for (const r of records) {
  kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  for (const t of r.tags || []) tags[t] = (tags[t] || 0) + 1;
  if (r.area) areas[r.area] = (areas[r.area] || 0) + 1;
  portability[r.portability || 'unclassified']++;
}
const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]);

/* The uncovered set is surfaced in the index rather than left to be discovered,
   because "which load-bearing rule has no test?" is the question this database
   most usefully answers and the one nobody thinks to ask. */
/* Kept identical to query.mjs's `uncovered` command on purpose. The first cut
   used a looser pattern here and a tighter one there, and the index reported a
   different number from the tool — which makes a reader distrust both. */
const ABSENT = /(nothing|no harness|no check|no test|nowhere)\s+\w*\s*(asserts?|covers?|checks?|proves?|tests?)|not\s+asserted|unasserted|uncovered|no\s+(harness|coverage)\b/i;
const uncovered = records
  .filter(r => r.kind === 'coverage' && ABSENT.test(`${r.summary} ${r.detail || ''}`))
  .map(r => r.id);

await writeFile(new URL('db/index.json', root), JSON.stringify({
  schema: 'db/ONTOLOGY.md',
  builtFromCommit: commit,
  fingerprints,
  totals: { records: records.length, collections: Object.keys(summary).length, parts: partFiles.length },
  collections: summary,
  kinds,
  areas,
  portability,
  tags: Object.fromEntries(topTags),
  parts: partFiles,
  uncovered,
}, null, 2) + '\n');

const rows = Object.entries(summary).sort().map(([k, v]) => `| \`db/records/${k}.jsonl\` | ${v} |`).join('\n');
await writeFile(new URL('db/INDEX.md', root), `# What is in the database

Generated by \`node db/build.mjs\`${commit ? ` from commit \`${commit}\`` : ''}. Do not edit this
file; edit the parts under \`db/records/parts/\` and rebuild.

**${records.length} records** across ${Object.keys(summary).length} collections, merged from ${partFiles.length} parts.

| Collection | Records |
|---|---|
${rows}

## What survives the Godot rebuild

Cosmo is moving to Godot 4 / GDScript, rebuilt from the design record rather
than transliterated. \`portability\` says what each record is worth on the other
side — \`spec\` is behaviour to reproduce, \`tuning\` is a playtested number to
carry across, \`reference\` is how Phaser did it, \`obsolete\` dies with the stack.

| Portability | Records | |
|---|---|---|
| \`spec\` | ${portability.spec} | reproduce this |
| \`tuning\` | ${portability.tuning} | **carry these numbers across** |
| \`reference\` | ${portability.reference} | read, then solve in Godot idiom |
| \`obsolete\` | ${portability.obsolete} | retires with Phaser/Vite/Capacitor |
| unclassified | ${portability.unclassified} | ${portability.unclassified ? 'not yet judged' : '—'} |

\`\`\`sh
node db/query.mjs list --portability tuning     # the expensive numbers
node db/query.mjs list --portability spec       # the rebuild's acceptance list
\`\`\`

## By kind

${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- \`${k}\` — ${v}`).join('\n')}

## The tags that find things

${topTags.slice(0, 40).map(([t, n]) => `\`${t}\`&nbsp;(${n})`).join(' · ')}

## Reading it

\`\`\`sh
node db/query.mjs search "starfall"
node db/query.mjs get rule.curriculum.tap-turns
node db/query.mjs list --kind orb
\`\`\`
`);

console.log(`OK  ${records.length} records → ${Object.keys(summary).length} collections`);
for (const [k, v] of Object.entries(summary).sort()) console.log(`      ${String(v).padStart(4)}  ${k}`);
console.log(`\n      portability: ${portability.spec} spec · ${portability.tuning} tuning · `
  + `${portability.reference} reference · ${portability.obsolete} obsolete`
  + (portability.unclassified ? ` · ${portability.unclassified} UNCLASSIFIED` : ''));
if (uncovered.length) console.log(`      ${uncovered.length} invariant(s) recorded as having no harness coverage — see db/records/coverage.jsonl`);
if (warn.length) {
  console.log(`\n${warn.length} note(s):`);
  for (const w of warn.slice(0, 25)) console.log(`      ${w}`);
  if (warn.length > 25) console.log(`      … and ${warn.length - 25} more`);
}
