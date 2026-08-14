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
   otherwise fail silently at runtime, on load, on every visitor.

   THE LIST IS DERIVED, NOT WRITTEN DOWN. It used to be the literal
   ['c', 'safe'], and the game had grown a third: #bg, the canvas the WebGL
   backdrop renders into. Renaming or dropping it took the starfield away from
   every visitor with no build failure and no runtime error either — glInit
   swallows its own failure ("if(!cv||typeof cv.getContext!=='function')return
   false" inside a try/catch) and falls back to the 2D sky, which is a
   deliberate and silent degradation. Exactly the failure this guard's own
   comment says it exists to prevent, and it was blind to it for as long as the
   list was maintained by hand.
   Scanning for the lookups means the guard cannot fall behind the code again. */
const idsUsed = [...(scripts.length === 1 ? scripts[0][1] : '')
  .matchAll(/getElementById\(\s*['"]([\w-]+)['"]\s*\)/g)].map(m => m[1]);
if (idsUsed.length < 2) {
  fail.push('could not find the getElementById lookups — the missing-element guard cannot run');
}
for (const id of [...new Set(idsUsed)]) {
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
/* TWO WAYS THIS GUARD WAS BLIND, both found by mutation testing.

   It collected ids with /\{id:'(\w+)',n:'/ — which requires `id` to be written
   before `n`. A row added as {n:'…',id:'…'} is invisible to the collector, so
   the dead tile it is meant to catch walks straight past it, and the
   `length < 2` floor is cleared by the rows that do match. The collector is
   anchored to the UPG literal now and reads ids in any position.

   And the call-site test ran against the raw script, so the literal characters
   upgOn('deepbank') surviving inside a block comment satisfied it. Deleting
   the wiring while mentioning it in the comment that explains the deletion —
   the most natural edit in the world — left DEEP BANK offered, picked, and
   recorded in telemetry while doing nothing. The free-radius guard below hit
   this same failure mode and was hardened to match on an operator; that
   reasoning is applied here by stripping comments instead, because a call site
   is a call site wherever it sits on the line. */
const CODE = src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')          /* block comments */
  .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');    /* line comments, sparing https:// */
const upgBlock = src.match(/const UPG\s*=\s*\[([\s\S]*?)\n\];/);
if (!upgBlock) fail.push('UPG table not found — the draft-wiring guard cannot run');
const upgIds = upgBlock ? [...new Set([...upgBlock[1].matchAll(/\bid:\s*'(\w+)'/g)].map(m => m[1]))] : [];
if (upgBlock && upgIds.length < 2) fail.push('UPG table parsed but yielded no ids — the draft-wiring guard cannot run');
for (const id of upgIds) {
  if (!new RegExp(`upgOn\\(\\s*'${id}'\\s*\\)`).test(CODE)) {
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
/* A SECOND MODE MUST BE A DERIVATIVE, AND THIS IS WHAT WILL KEEP IT ONE.
   CHILL IS RETIRED — one mode until the game is perfected — but these guards
   are NOT retired with it, and that is deliberate. They are the reason the
   table is worth keeping at one row: the rule they encode was arrived at
   rather than obvious, and a future second mode that arrives while nothing is
   watching arrives as a branch on a flag somewhere in the game code, which is
   exactly what MODES exists to prevent.

   Three ways the claim can rot. Two of them can still rot TODAY with one row;
   the third goes quiet until a second row exists and comes back the moment it
   does, which is precisely when it is needed.

   1. SKILL STOPS BEING THE IDENTITY. Every skill knob is 1 (or 0 for the
      additive shield), which is the only reason "every expression reduces to
      what shipped" is a fact rather than a hope. Live today: the moment
      someone tunes the real game by editing this row, the table has quietly
      become the place the game is balanced and this file is the last thing
      that would notice.
   2. A KNOB IS NEVER READ. Exactly the dead-tile failure the upgOn guard
      above exists for, and worse here: a number in this table is a PROMISE
      about how the mode plays, and an unread one is a promise the game does
      not keep. Live today. Read from the stripped source, because a knob
      named in the comment that explains its removal is not a call site.
   3. A MODE GROWS ITS OWN KNOB. If a second row carries a field skill does
      not, something reads a value that exists in one mode only — a second
      code path wearing a table's clothes. Vacuous with one row, and it costs
      nothing to leave armed for the row that comes back. */
const modesBlock = src.match(/const MODES\s*=\s*\{([\s\S]*?)\n\};/);
if (!modesBlock) fail.push('MODES table not found — the mode-derivation guards cannot run');
else {
  const rows = [...modesBlock[1].matchAll(/(\w+)\s*:\s*\{([\s\S]*?)\}\s*(?:,|$)/g)]
    .map(m => [m[1], Object.fromEntries(
      [...m[2].matchAll(/\b(\w+)\s*:\s*(-?[\d.]+)\b/g)].map(k => [k[1], +k[2]]))]);
  const modes = Object.fromEntries(rows);
  if (!modes.skill) fail.push('MODES has no `skill` row — skill is the identity mode, everything else derives from it');
  /* One row is the current shipped state, not a parse failure. Zero rows IS a
     parse failure, and it would silently disarm every guard below it — which
     is the failure mode this line exists to make loud. */
  if (rows.length < 1) fail.push('MODES parsed but yielded no modes at all — the guards below cannot run');
  const knobs = modes.skill ? Object.keys(modes.skill) : [];
  if (modes.skill && knobs.length < 4) {
    fail.push(`MODES.skill parsed only ${knobs.length} numeric knobs — the derivation guards cannot run`);
  }
  for (const k of knobs) {
    /* shields is ADDITIVE (a count of extra shields); everything else is a
       multiplier. Both neutral elements are checked, not assumed. */
    const want = k === 'shields' ? 0 : 1;
    if (modes.skill[k] !== want) {
      fail.push(`MODES.skill.${k} is ${modes.skill[k]}, not ${want} — skill must be the identity mode, `
        + 'or this table quietly becomes the place the real game is balanced');
    }
    if (!new RegExp(`(MD\\(\\)|\\bm)\\.${k}\\b`).test(CODE)) {
      fail.push(`mode knob '${k}' is declared but never read — MD().${k} has no call site, `
        + 'so it promises the player something the game does not do');
    }
  }
  for (const [name, row] of rows) {
    const missing = knobs.filter(k => !(k in row));
    const extra = Object.keys(row).filter(k => !knobs.includes(k));
    if (missing.length || extra.length) {
      fail.push(`MODES.${name} does not have the same knobs as skill `
        + `(missing: ${missing.join(',') || 'none'}; extra: ${extra.join(',') || 'none'}) — `
        + 'one knob set, or a mode has a code path of its own');
    }
  }
}

/* EVERY PERSISTED KEY IS A THING THE POWERUP LAB PROMISES NOT TO WRITE, and
   this is the tripwire that makes adding one a decision rather than an
   oversight. The lab's whole claim is that a session leaves the device exactly
   as it found it, and every guard behind that claim is a `!LAB.on` sitting on a
   line whose ordinary job is to save something — so an omitted one is invisible
   in a diff and looks identical to the fifteen that are there.

   smoke.mjs proves the claim by clearing localStorage and failing on any key
   that reappears, which is the real enforcement. But it can only catch writes
   on paths it reaches, and two of these cannot be reached there by
   construction: tryLand() and judgeTiming() both return immediately without
   AC and MU, and smoke removes WebAudio on purpose to prove the audio guards.
   Their guards were added by reading. A static list is what covers the gap —
   it cannot tell whether a write is guarded, but it can insist that nobody
   adds a new one without being asked the question.

   Three of the four writes the lab originally leaked were found this way after
   the fact: `hopped` (which gates the once-ever first-hop rehearsal, so the
   lab could spend a fresh player's tutorial), `groove` and `landed`. If you are
   here because this check failed: guard the new write with !LAB.on unless a lab
   session genuinely should perform it, then add the key below. */
const persisted = [...new Set([...CODE.matchAll(/savePref\(\s*'cometloop:(\w+)'/g)].map(m => m[1]))].sort();
/* 'mode' left this list with CHILL: the title screen no longer offers a
   choice, so nothing writes cometloop:mode. The KEY is deliberately left on
   the devices that have one, along with the `:chill` records — see the note
   above recKey. Removing a key from this list is as much a decision as adding
   one, which is why the count below is a floor and not a range. */
const persistedKnown = ['groove', 'hopped', 'landed', 'muted', 'runs',
                        'seen', 'seen2', 'struggle', 'swipe'].sort();
if (persisted.length < persistedKnown.length) {
  fail.push(`only ${persisted.length} persisted keys found, expected at least ${persistedKnown.length} `
    + '— the savePref scan has stopped matching and the lab-write tripwire cannot run');
}
for (const k of persisted) {
  if (!persistedKnown.includes(k)) {
    fail.push(`a new persisted key 'cometloop:${k}' has appeared — the powerup lab promises a session `
      + 'writes nothing to the device, so guard the write with !LAB.on (or decide it may run in the lab) '
      + 'and add the key to persistedKnown in check.mjs');
  }
}
/* The two record keys are built by recKey() rather than written literally, so
   the scan above cannot see them. Both sit behind !LAB.on at their call sites
   and smoke.mjs asserts neither record moves in a lab run; named here so the
   list above is not mistaken for the complete set of what this game persists. */
for (const k of ['best', 'gl']) {
  if (!new RegExp(`recKey\\(\\s*'${k}'`).test(CODE)) {
    fail.push(`recKey('${k}') has no call site — the per-mode record it names is no longer written`);
  }
}
/* THE UNSUFFIXED KEY BELONGS TO SKILL, and that is what makes retiring a mode
   free. Every value ever written to cometloop:best and cometloop:gl was
   skill's, because any other mode's went to a suffixed key — so removing a
   mode cannot change what a stored number means on anybody's device. If
   recKey ever starts suffixing skill, every historical record silently
   changes owner, which is the retired-`cometloop:level` failure exactly. */
{
  const rk = src.match(/function recKey\(([\s\S]*?)\n\}/);
  if (!rk) fail.push('recKey() not found — the unsuffixed-key guard cannot run');
  else if (!/'cometloop:'\+k\+\(\(m\|\|MODE\)===\s*'skill'\s*\?\s*''/.test(rk[1].replace(/\s+/g, ''))
        && !/===.skill.\?../.test(rk[1])) {
    fail.push('recKey() no longer maps skill to the UNSUFFIXED key — every historical '
      + 'cometloop:best and cometloop:gl on every device was skill\'s, and suffixing it now '
      + 'silently changes what all of them mean');
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
