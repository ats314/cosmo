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
/* AN EMBER'S RADIUS HAS ONE OWNER, AND THIS IS WHAT KEEPS IT THAT WAY.
   The magnetar pull gave an ember a free radius in s.pr so it could curve
   between rings, and every pass that draws an ember then had to read it. The
   bloom pass did not, so each ember's glow stayed parked on the ring it started
   from: sixteen detached glows at once, up to 89px apart on a 390px screen.

   The first version of this guard required a starR() accessor and checked that
   star loops used it. That guard passed while the bug came back, because it
   only inspected loops it could recognise as star loops — the WIDE PULL path
   put a free radius on ORBS, and no rule here covered those.

   So the guard is inverted. Rather than police the synchronisation of two
   radii, it fails if a second radius exists at all. There is nothing to keep
   in sync and nothing for a draw pass to disagree about; radiusOf(ring) is the
   only radius an ember or an orb has. If a mechanic ever needs one to leave its
   ring again, this check is the conversation to have first — and whatever
   replaces it must cover every draw pass, which the previous one did not. */
/* Matched on an OPERATOR, not on the bare name: a comment explaining why the
   free radius is gone contains the characters `s.pr`, and a guard that fails
   the build for describing itself is a guard nobody keeps. Requiring an
   assignment or a comparison also keeps GL.pr — the WebGL pixel ratio, an
   unrelated field — out of it. A free radius has to be assigned before it can
   be read, so catching the assignment catches the reintroduction. */
const freeRadius = [
  ...src.matchAll(/\b(?:s|st|sp|ts|pw|nn|st2|st3)\.pr\s*(?:[-+*/]?=[^=]|!==|===|==|!=)/g),
];
if (freeRadius.length) {
  const lines = [...new Set(freeRadius.map(m => src.slice(0, m.index).split('\n').length))];
  fail.push(`an ember or orb has a free radius again (.pr) at script line(s) ${lines.join(', ')} — `
    + 'that is the detached-glow bug returning; see the note in check.mjs');
}
if (/function starR\s*\(/.test(src)) {
  fail.push('starR() is back without the guard that has to come with it — see the note in check.mjs');
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
