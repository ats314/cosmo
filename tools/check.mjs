/* Sanity check for index.html.
   The whole game is one inline script with no test suite, so the cheapest
   useful guard is: does it still parse, and are the pieces the script needs
   still in the document? vm.Script compiles without executing, so this is a
   pure syntax check — no DOM, no dependencies. */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const fail = [];

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 1) {
  fail.push(`expected exactly 1 <script> block, found ${scripts.length}`);
} else {
  try {
    new vm.Script(scripts[0][1], { filename: 'index.html' });
  } catch (e) {
    fail.push(`script does not parse: ${e.message}`);
  }
}

/* IDs the script looks up by hand — a rename in the markup alone would
   otherwise fail silently at runtime, on load, on every visitor. */
for (const id of ['c', 'safe']) {
  if (!new RegExp(`id=["']${id}["']`).test(html)) fail.push(`missing element #${id}`);
}
if (!/<title>[^<]+<\/title>/.test(html)) fail.push('missing <title>');

/* Teaching-data drift guards. The MEET table once carried two orbs that had
   been cut from the game while missing two that shipped — an enumeration
   nobody re-checks. These are static text checks (the smoke test asserts the
   runtime behavior); they exist so stale teaching DATA fails the build. */
const src = scripts.length === 1 ? scripts[0][1] : '';
for (const dead of ['echo', 'meteor']) {
  if (new RegExp(`(MEET\\s*=|teachSoft\\s*=)[^;]*'${dead}'`).test(src)) {
    fail.push(`teaching data references cut orb '${dead}'`);
  }
}
/* EVERY TILE THE PLAYER CHOOSES MUST DO SOMETHING. All nine upgrades shipped
   with `upgOn` having ZERO call sites in 7,000+ lines: each id appeared exactly
   once, in its own UPG row. The game stopped the player, printed CHOOSE ONE,
   spent their attention on three tiles, recorded the pick in telemetry, and
   then ran identically either way — and `G.picks` rides on every event, so the
   analytics were being filled with a choice that could not correlate with
   anything. A dead tile is a worse lie than a badly worded sentence, because
   the player pays a decision for it. */
const upgIds = [...src.matchAll(/\{id:'(\w+)',n:'/g)].map(m => m[1]);
if (upgIds.length < 2) fail.push('UPG table not found — the draft-wiring guard cannot run');
for (const id of upgIds) {
  if (!new RegExp(`upgOn\\('${id}'\\)`).test(src)) {
    fail.push(`upgrade '${id}' is offered to the player but never read — upgOn('${id}') has no call site`);
  }
}
/* AN EMBER'S RADIUS HAS ONE OWNER. Every other object in the arena sits at
   radiusOf(ring), but the magnetar pull gives an ember a free radius in s.pr so
   it can curve between rings. Two passes draw an ember — the sprite and the
   bloom — and only the sprite was taught about s.pr, so for the whole of every
   pull each ember's glow stayed parked on the ring it started from: sixteen
   detached glows at once, up to 89px apart on a 390px screen.
   starR() is the single accessor now. This fails the build if any star is ever
   positioned from radiusOf() directly again, which is the exact drift that
   produced the bug — the sprite pass was correct and the bloom was not. */
if (!/function starR\(s\)\{return s\.pr!==undefined\?s\.pr:radiusOf\(s\.ring\);\}/.test(src)) {
  fail.push('starR() accessor is missing — an ember\'s radius has one owner');
}
/* Brace-matched loop bodies, not a fixed context window: the bloom pass walks
   G.stars and then G.spikes back to back, and a loose look-behind flagged the
   spike loop, which legitimately uses radiusOf. */
const bodyAt = (from) => {
  let i = src.indexOf('{', from), d = 0;
  if (i < 0) return '';
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(i, j);
  }
  return src.slice(i);
};
/* both shapes the star list is walked in: for..of, and the reverse index loop
   that owns collection */
const starLoops = [
  ...src.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+G\.stars\s*\)/g),
  ...src.matchAll(/for\s*\(\s*let\s+\w+\s*=\s*G\.stars\.length[^)]*\)/g),
];
for (const m of starLoops) {
  const v = m[1] || 's';
  const body = m[1] ? bodyAt(m.index) : bodyAt(m.index);
  const bad = body.match(new RegExp(`posAt\\(${v}\\.a\\s*,\\s*(?!starR\\()[^)]*\\)`));
  if (bad) {
    const line = src.slice(0, m.index).split('\n').length;
    fail.push(`a star is positioned without starR() in the loop at script line ${line}: ${bad[0]}`);
  }
}
/* the curriculum rule: every tier unlocks by level 2's finish line, so
   level 3 introduces nothing — see MECHANICS.md. The finish line is read
   from the LV table itself so lengthening a level cannot break the guard. */
const tiers = src.match(/const TIERS=\[([\s\S]*?)\];/);
const lv = src.match(/const LV=\[([\s\S]*?)\];/);
if (!tiers || !lv) fail.push('TIERS or LV table not found');
else {
  const ats = [...tiers[1].matchAll(/at:\s*(\d+)/g)].map(m => +m[1]);
  const ends = [...lv[1].matchAll(/end:\s*(\d+)/g)].map(m => +m[1]);
  /* THE LAST TEACHING LEVEL's finish line, read positionally — NOT max(ends).
     Teaching now runs through level 3 and level 4 is the exam, so the boundary
     is ends[2]. It is read by index rather than as max() because the final
     level's end is Infinity and never matches the numeric regex: with three
     levels max(ends) happened to equal the right answer, and with four it
     silently became the wrong one. Index it, and adding a fifth level cannot
     quietly move the line. */
  const teachEnd = ends[2];
  if (!ats.length || ends.length < 3 || Math.max(...ats) > teachEnd) {
    fail.push(`a tier unlocks after dl ${teachEnd} — nothing may be introduced past level 3 (ats: ${ats})`);
  }
}

if (fail.length) {
  for (const f of fail) console.error(`FAIL  ${f}`);
  process.exit(1);
}
console.log('OK  index.html parses and has the elements the script needs');
