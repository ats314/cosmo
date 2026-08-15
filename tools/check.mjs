/* @lane fast */
/* Sanity check for index.html.
   The whole game is one inline script with no test suite, so the cheapest
   useful guard is: does it still parse, and are the pieces the script needs
   still in the document? vm.Script compiles without executing, so this is a
   pure syntax check — no DOM, no dependencies. */
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
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

/* THE FORMATION HALF of the curriculum rule: every tier unlocks by the LAST
   TEACHING LEVEL's finish line, so the final level — the exam — introduces no
   new shape. See docs/invariants.md and MECHANICS.md. The finish line is read
   from the LV table itself so lengthening a level cannot break the guard.

   This comment said "level 2's finish line, so level 3 introduces nothing"
   for as long as the code below read ends[2], which is level 3's. Level 4
   moved the exam when it was added and the prose never followed; the guard
   was right and its own explanation was a level out, which is worse than no
   explanation — a reader who trusts it goes looking for room to add a shape
   in the wrong place.

   AND THEN THE SAME MISTAKE HAPPENED IN THE CODE. `ends[2]` was written to
   mean "the last teaching level" and spelled as "index 2", which were the
   same thing for exactly as long as there were four levels. Six made them
   different: a guard still reading ends[2] failed the build for DIVERS at
   dl 395 — correctly placed inside level 4 — while quoting a rule nobody had
   broken. The two facts are separate now and both come from the table: every
   level but the last carries a numeric end, so ends.length IS the number of
   teaching levels and its final entry is the boundary. */
const tiers = src.match(/const TIERS=\[([\s\S]*?)\];/);
const lv = src.match(/const LV=\[([\s\S]*?)\];/);
if (!tiers || !lv) fail.push('TIERS or LV table not found');
else {
  const ats = [...tiers[1].matchAll(/at:\s*(\d+)/g)].map(m => +m[1]);
  const ends = [...lv[1].matchAll(/end:\s*(\d+)/g)].map(m => +m[1]);
  /* The last level's end is Infinity and never matches the numeric regex, so
     ends.length is the count of levels that HAVE a finish line — the teaching
     levels — and its last entry is the boundary. Derived, never indexed by a
     literal, because a literal is what went stale last time. */
  const teachEnd = ends[ends.length - 1];
  const lastTeaching = ends.length;
  if (!ats.length || ends.length < 3 || Math.max(...ats) > teachEnd) {
    fail.push(`a tier unlocks after dl ${teachEnd} — nothing may be introduced past level ${lastTeaching} (ats: ${ats})`);
  }
  /* ...and the exam must open on the last rung rather than somewhere inside
     the ladder: the top tier sits exactly on the exam level's floor, which is
     the same number. smoke.mjs asserts this against the live tables; this is
     the static tripwire so a table edit alone cannot slide the exam. */
  if (ats.length && Math.max(...ats) !== teachEnd) {
    fail.push(`the last tier is at dl ${Math.max(...ats)}, not on the exam level's floor (dl ${teachEnd})`);
  }
}

/* `MECHANICS.md` AND THE CODE MOVE TOGETHER — the last load-bearing invariant
   in CLAUDE.md that nothing enforced.

   Every other rule of that weight has a guard; this one was a sentence asking
   people to remember, and the record says remembering does not work. Three
   documents in this repository disagreed with the code at once and each was
   found by a reader who trusted the prose: CLAUDE.md said "five checks" while
   saying six everywhere else, and both it and README said tiers complete at
   level 2's finish line while the code beside them read level 3's. A ledger
   that has quietly stopped listing a mechanic is the same failure with a
   bigger blast radius, because the ledger is what the next session reads to
   learn what the game HAS.

   The check runs one way on purpose. Forward — every mechanic the code ships
   must appear in the ledger — is precise, and it catches the failure that
   actually happens: a formation or an orb is added and the row is written
   "next commit". The reverse direction would have to decide which of the
   ledger's ninety-nine rows are supposed to name a code symbol, and a guard
   that guesses produces false failures, which is how a guard gets deleted.

   Matching is case-insensitive because the code shouts (`'TWIN SHARDS'`) and
   the ledger is prose (`Twin shards`). It is a substring test, not a row
   parse, for the same reason: this asks whether the ledger KNOWS about the
   mechanic, and anything stricter would break every time someone rewords a
   row, which is a thing they should be free to do. */
{
  const ledger = await readFile(new URL('MECHANICS.md', root), 'utf8').catch(() => '');
  if (!ledger) fail.push('MECHANICS.md is missing or unreadable — the ledger-drift guard cannot run');
  else {
    const hay = ledger.toLowerCase();
    const tiersBlock = src.match(/const TIERS=\[([\s\S]*?)\n\];/);
    const orbsBlock = src.match(/const LAB_ORBS=\[([\s\S]*?)\n\];/);
    if (!tiersBlock) fail.push('TIERS table not found — the ledger-drift guard cannot run');
    if (!orbsBlock) fail.push('LAB_ORBS table not found — the ledger-drift guard cannot run');
    const names = [
      ...(tiersBlock ? [...tiersBlock[1].matchAll(/name:\s*'([^']+)'/g)] : []),
      ...(orbsBlock ? [...orbsBlock[1].matchAll(/\bn:\s*'([^']+)'/g)] : []),
    ].map(m => m[1]);
    /* A floor, because a regex that has stopped matching yields zero names and
       an empty loop reports success — the failure mode this whole file is
       written against. Six formations and six orbs ship today. */
    if (names.length < 8) {
      fail.push(`the ledger-drift guard collected only ${names.length} mechanic names from TIERS `
        + 'and LAB_ORBS — the tables have changed shape and it is no longer reading them');
    }
    for (const n of [...new Set(names)]) {
      if (!hay.includes(n.toLowerCase())) {
        fail.push(`'${n}' ships in the game but appears nowhere in MECHANICS.md — the ledger is `
          + 'one row per player-facing mechanic, and a mechanic the ledger does not know about is '
          + 'one the next session will not know the game has. Add the row in this commit.');
      }
    }
  }
}

/* ------------------------------------------------------------------------
   Repository tripwires. Everything above this line asks whether the GAME is
   sound; what follows asks whether the REPOSITORY still tells the truth about
   itself. Both failures ship to players — one as a bug, one as a check that
   silently stopped running or a document that silently became public.
   ------------------------------------------------------------------------ */
const wf = await readFile(new URL('.github/workflows/pages.yml', root), 'utf8');

/* EVERY HARNESS IN tools/ RUNS IN CI. A harness that exists in the tree but is
   not wired into the workflow is the worst kind of dead code: it reads as
   coverage to anyone listing the directory, it passes when someone runs it by
   hand, and it never once runs on a pull request. That is the same failure as
   a guard that cannot fail, which this repository has already been bitten by
   twice — and it arrives most naturally by adding the file and forgetting the
   YAML, because nothing anywhere else notices.
   The complement lives in tools/all.mjs, which runs the workflow's list rather
   than a list of its own: together, a harness cannot be in the tree without
   running in CI, and cannot run in CI without running locally. */
const wired = new Set(
  [...wf.matchAll(/^[ \t]*-[ \t]+run:[ \t]+node[ \t]+tools\/([\w.-]+\.mjs)[ \t]*$/gm)].map(m => m[1]));
const present = (await readdir(new URL('tools/', root)))
  .filter(f => f.endsWith('.mjs') && f !== 'all.mjs');   /* all.mjs is the runner, not a check */
if (!wired.size) {
  fail.push('no `node tools/*.mjs` steps found in pages.yml — the harness-wiring guard cannot run');
}
for (const f of present) {
  if (!wired.has(f)) {
    fail.push(`tools/${f} exists but pages.yml never runs it — add a `
      + `\`- run: node tools/${f}\` step, or delete the harness. A check that does not `
      + 'run on a pull request is not a check.');
  }
}
for (const f of wired) {
  if (!present.includes(f)) fail.push(`pages.yml runs tools/${f}, which is not in tools/`);
}
/* EVERY HARNESS DECLARES ITS LANE. `all.mjs --fast` is only worth having if it
   is honest about what it skipped, and the way it stops being honest is a new
   slow harness that never says so and lands in the fast lane by default. The
   declaration lives in the harness because that is the file whose author knows
   whether it plays a whole game. */
for (const f of present) {
  const body = await readFile(new URL(`tools/${f}`, root), 'utf8');
  if (!/@lane\s+(fast|full)/.test(body)) {
    fail.push(`tools/${f} declares no @lane — add `
      + `\`/* @lane fast */\` (static or targeted, under ~3s) or \`/* @lane full */\` `
      + '(plays a whole game) at the top, so `all.mjs --fast` knows whether it may skip it');
  }
  /* A HARNESS THAT SEEDS ITS RNG MUST PRINT THE SEED, and this guard exists
     because four of them did not. CI rotates the seed per run so coverage
     keeps moving, which is only survivable if each failure carries the seed
     that produced it — otherwise a red CI is a one-off nobody can reproduce.
     curriculum, dropcheck, fxcheck and musiccheck all IMPORTED seedLine and
     never called it, for four sessions, while CLAUDE.md and harnesses.md both
     stated the opposite in as many words. The claim was prose; nothing
     executed it. It is an assertion now. */
  if (/\bseededMath\b/.test(body) && !/console\.log\(\s*seedLine\(/.test(body)) {
    fail.push(`tools/${f} seeds its RNG but never prints the seed — add `
      + '`console.log(seedLine(\'name\'))` near the top, BEFORE any assertion can exit. '
      + 'CI rotates SEED per run, so a failure without it cannot be reproduced');
  }
}
/* EVERY HARNESS IS NAMED IN THE DOCUMENTS THAT ROUTE PEOPLE TO IT, and this
   guard is written because docs/harnesses.md SAID it already existed.

   Its own words were: "Adding a harness is three edits, and `check.mjs` fails
   until all three are made" — write the file, wire it into pages.yml, and list
   it in the table. Only the first two were ever enforced; the two sets being
   compared above are tools/ and the workflow, and nothing in this repository
   had ever read a documentation file looking for a harness name. So the third
   edit was an honour-system step wearing a guard's clothes, which is the one
   arrangement worse than no rule at all — a reader checks whether the build
   enforces it, finds a sentence saying yes, and stops looking.

   It had already failed. rendercheck.mjs — the eighth harness, the only one in
   the repository that looks at a pixel — was absent from the table in
   docs/harnesses.md AND from the list in README.md, and both documents went on
   asserting that fxcheck.mjs was "the only harness that runs the RENDER path".
   A session with a rim, a detached halo or a buried palette to test would have
   read that, filed its new test in the harness that stubs the canvas, and
   proved nothing — with all eight checks green, because nothing was checking.

   Whole-file, not near-the-name: a harness FILENAME cannot appear in prose by
   accident the way a bare number can (the doc-value guard below has to work
   much harder for exactly that reason). The weak version is sufficient here,
   and a guard that cannot cry wolf is a guard that survives.

   ONE ROUTING DOCUMENT, NOT TWO. This guard originally read README.md as well,
   because README.md carried a second copy of the harness list. That copy is
   what rotted — both lists went stale in the same way at the same time, which
   is the argument against keeping two. The harness documentation lives in
   docs/harnesses.md now and README.md links to it. */
{
  const routing = ['docs/harnesses.md'];
  for (const doc of routing) {
    const body = await readFile(new URL(doc, root), 'utf8').catch(() => null);
    if (body === null) {
      fail.push(`${doc} is missing — the guard that keeps every harness named in the `
        + 'documents that route people to it cannot run');
      continue;
    }
    for (const f of present) {
      if (!body.includes(f)) {
        fail.push(`tools/${f} runs in CI but ${doc} never names it — add it, and say what `
          + 'kind of regression belongs in it. A harness the routing documents have never '
          + 'heard of gets its tests filed in some other harness, which is how the only '
          + 'check that looks at a pixel spent its life absent from both lists');
      }
    }
  }
}
/* THE ONE HARNESS WITH A DEPENDENCY MUST HAVE IT INSTALLED IN CI. rendercheck
   skips when no browser is present, which is right on a developer's machine
   and fatal in the build: a guard that can quietly not run is not a guard, and
   this is the only guard in the repo that can see a pixel. If the install step
   is ever dropped from the workflow, the render check would go on reporting
   SKIP and success forever, and the class of bug it exists for — a rim, a
   detached halo, a buried palette — would be invisible again with eight
   checks green. */
if (wired.has('rendercheck.mjs') && !/playwright[^\n]*install/i.test(wf)) {
  fail.push('pages.yml runs tools/rendercheck.mjs but never installs a browser — it will SKIP in CI '
    + 'and report success, which silently removes the only check in this repo that looks at a pixel');
}

/* THE PUBLISHED SITE IS AN ALLOWLIST, AND THIS IS WHAT KEEPS IT ONE.
   The deploy used to upload `path: .`, so every file in the repository was
   served from the Pages URL — CLAUDE.md, README.md, MECHANICS.md and every
   harness among them. Repository visibility never covered that: Pages serves
   the artifact, so turning the repo private would have left the operating doc
   and the design record readable at their public URLs, which is the opposite
   of what anyone would have assumed.

   The workflow now copies a named list into _site. A named list has its own
   failure mode in each direction, and both are silent, so both are checked
   here rather than trusted:
     - a new ASSET that nobody adds to the list 404s on the live site, and
       nothing in this repository loads the live site to notice;
     - a new INTERNAL document is published the moment somebody widens the list
       or reverts to `path: .`, which is exactly the bug being fixed.
   So every entry at the repository root must be classified. A file in neither
   list fails the build with the question attached, which turns "what happens
   to this file" into a decision somebody makes on purpose. */
/* THE STAGING STEP AND THE UPLOAD PATH ARE TWO HALVES, AND CHECKING ONE IS
   CHECKING NEITHER. The first version of this guard only looked for the
   `cp … _site/` command, which reads as sufficient and is not: flip
   `path: _site` back to `path: .` and the staging step still sits there,
   still copying files into a directory nobody uploads, while the deploy
   publishes the entire repository again. Every internal document goes public
   and this file says OK — the precise regression the guard was written to
   prevent, waved through by the guard. Both halves are checked below. */
const up = wf.match(/upload-pages-artifact@[\w.]+\s*\n\s*with:\s*\n\s*path:\s*(\S+)/);
if (!up) {
  fail.push('could not read the upload-pages-artifact `path:` from pages.yml — the guard that '
    + 'keeps the published site down to an allowlist cannot run');
} else if (up[1] !== '_site') {
  fail.push(`the deploy uploads '${up[1]}', not the staged '_site' directory. If this is `
    + '`.`, every file in the repository is published again — CLAUDE.md, README.md, '
    + 'MECHANICS.md and every harness, each at its own public URL, and repository '
    + 'visibility does not cover it because Pages serves the artifact, not the repo.');
}

const cp = wf.match(/\bcp\s+([\s\S]*?)\s+_site\//);
if (!cp) {
  fail.push('the `cp … _site/` staging step is gone from pages.yml — either the deploy '
    + 'publishes something other than an allowlist now, or the guard below cannot run. '
    + 'If the site is back to `path: .`, every internal document is public again.');
} else {
  const published = cp[1].split(/[\s\\]+/).filter(Boolean);
  /* Not published, and each for a stated reason. `docs/` and the three
     markdown files are how this game gets built, not part of it; `tools/` is
     the test suite; the dotfiles are machinery. LICENSE is deliberately on the
     PUBLISHED side instead — the terms of an all-rights-reserved work should be
     reachable from the artifact that carries them. */
  const internal = ['.git', '.github', '.gitignore', 'node_modules', '_site',
                    'AGENTS.md', 'CLAUDE.md', 'MECHANICS.md', 'README.md', 'docs', 'tools'];
  const known = new Set([...published, ...internal]);
  /* WHAT GIT IGNORES, THIS IGNORES. The classifier reads the working directory
     rather than the index, so without this it fails on files that are not part
     of the repository at all — a stray .DS_Store or a *.log at the root turns
     the required local check red for a reason that has nothing to do with the
     change being made, on a machine where the fix is "delete a file macOS will
     recreate". A check that cries wolf on a clean tree is a check people learn
     to run with their eyes closed, which costs more than the guard is worth.
     Ignored files cannot reach the site in any case: the deploy copies named
     files, so an untracked one was never a candidate for publication.
     This understands the two pattern forms this repository's .gitignore uses —
     a plain name and a `*.ext` suffix. Anything more exotic is simply not
     matched, so the classifier stays STRICT and asks about the file rather than
     going quiet, which is the correct direction to fail in. The one accepted
     cost: a tracked file that also matches an ignore pattern is skipped. */
  /* No .gitignore means nothing is ignored, which leaves the classifier asking
     about every file — strict, and the safe direction. Reading it with a throw
     instead crashed the whole check with a stack trace for a missing optional
     file: still a non-zero exit, so CI stayed honest, but the operator is told
     'ENOENT' when the answer is 'that file is optional'. */
  const patterns = (await readFile(new URL('.gitignore', root), 'utf8').catch(() => ''))
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => l.replace(/\/$/, ''));
  const gitIgnored = name => patterns.some(p =>
    p.startsWith('*.') ? name.endsWith(p.slice(1)) : name === p);
  for (const entry of await readdir(root)) {
    if (gitIgnored(entry)) continue;
    if (!known.has(entry)) {
      fail.push(`'${entry}' sits at the repository root and is neither published nor internal — `
        + 'decide which it is: add it to the `cp … _site/` list in pages.yml if the game needs '
        + 'it at runtime, or to `internal` in check.mjs if it does not. An asset left out 404s '
        + 'on the live site; a document left in becomes a public URL.');
    }
  }
  for (const f of published) {
    try {
      await readFile(new URL(f, root));
    } catch {
      fail.push(`pages.yml publishes '${f}', which does not exist — the deploy will fail, `
        + 'or worse, publish a site missing a file the game asks for');
    }
  }
}

/* ================= A DOC THAT NAMES A CONSTANT MUST KNOW ITS VALUE =========
   Two of the numbers in docs/invariants.md and README.md were stale for two
   commits: both described the nebula's coverage gate as floored at
   "0.42 + 0.58*smoothstep" and its drift lap as "~95 minutes", after the
   commit that re-chose the orbit's territory made them 0.10/0.90 and ~24
   minutes. A constraint that disagrees with its own enforcement makes the
   careful reader wrong, which is worse than a missing one — and this file
   already enforces that principle for the mechanics ledger.

   THE CHECK IS FOR STALENESS, NOT FOR AGREEMENT, and that distinction is the
   whole design. These documents are historical: they say "1.0 was the first
   pass and read as distracting", "0.42 was the retreat", "the first cut used
   0.42". Demanding that every number near a constant's name match the source
   would fail on all of that, and a guard that fires on correct prose gets
   deleted within a week. So the rule is weaker and survivable: if a document
   discusses a constant at all, the constant's CURRENT value must appear in
   that document somewhere. History may stay; ignorance may not. */
{
  const src = await readFile(new URL('index.html', root), 'utf8');
  const consts = new Map();
  for (const m of src.matchAll(/\bconst\s+([A-Z][A-Z0-9_]{4,})\s*=\s*(-?\d+\.?\d*)\s*[;,]/g)) {
    consts.set(m[1], m[2]);
  }
  /* THE LIST IS WALKED, NOT WRITTEN DOWN, and that is the whole point after the
     split. This used to be five hard-coded filenames. README.md was then broken
     up into docs/design/ and docs/engine/ — and every constant those 2,300 lines
     discussed (GL_MOTION, SKY_ARENA_CALM, MASTER, LAB_DL …) moved into files
     this guard had never heard of, so the staleness check would have gone on
     passing while covering almost none of the prose it was written for. A guard
     whose scope is a hard-coded list stops covering the thing it guards the
     moment somebody reorganises. Walking the tree means a new document is
     covered the day it is created, by nobody remembering anything. */
  const docs = ['CLAUDE.md', 'README.md', 'MECHANICS.md', 'AGENTS.md'];
  const walk = async (dir) => {
    for (const e of await readdir(new URL(dir, root), { withFileTypes: true })) {
      if (e.isDirectory()) await walk(`${dir}${e.name}/`);
      else if (e.name.endsWith('.md')) docs.push(`${dir}${e.name}`);
    }
  };
  await walk('docs/');
  if (docs.length < 8) {
    fail.push(`the doc-staleness guard found only ${docs.length} documents — the walk over docs/ `
      + 'has stopped matching the tree, and a guard covering nothing reports success');
  }
  for (const doc of docs) {
    let body;
    try { body = await readFile(new URL(doc, root), 'utf8'); } catch { continue; }
    for (const [name, val] of consts) {
      if (!body.includes(name)) continue;
      /* the value as written, and without a trailing zero, since prose says
         0.6 where the source says 0.60. Bounded on both sides so 0.72 cannot
         be satisfied by 10.725, and an integer constant cannot be satisfied
         by a digit inside some unrelated number. */
      /* COMPARED AS NUMBERS, NOT AS STRINGS. The first cut matched the
         literal text with a bounded regex, and README.md's "every row that
         would ever exist read 17.0" failed the guard for BH_DUR=17 — the
         document was correct and the check could not read its own value in a
         different notation. Prose writes 0.6 for 0.60 and 17.0 for 17. */
      const want = Number(val);
      /* NEAR THE NAME, NOT ANYWHERE IN THE FILE. The first cut searched the
         whole document, which any sufficiently long document satisfies by
         accident: README.md discusses both GL_MOTION and SKY_ARENA_CALM, so
         changing GL_MOTION to 0.34 would have been waved through by the 0.34
         sitting beside SKY_ARENA_CALM three hundred lines away — and a
         constant whose value is 1 or 2 matches essentially any prose. The
         window is the paragraph the name appears in, which is where a reader
         looking up that constant would actually be looking. */
      let ok = false;
      for (const m of body.matchAll(new RegExp(`\\b${name}\\b`, 'g'))) {
        const from = body.lastIndexOf('\n\n', m.index) + 1;
        let to = body.indexOf('\n\n', m.index);
        if (to < 0) to = body.length;
        const para = body.slice(from, to);
        const nums = [...para.matchAll(/-?\d+\.?\d*/g)].map(n => Number(n[0]));
        if (nums.some(n => Math.abs(n - want) < 1e-9)) { ok = true; break; }
      }
      if (ok) continue;
      fail.push(`${doc} discusses ${name} but never mentions its current value (${val}) near it — `
        + 'the document has gone stale against the source. Quoting the old value as history is fine; '
        + 'describing the constant without ever naming what it is now is how a reader ends up wrong');
    }
  }
}

if (fail.length) {
  for (const f of fail) console.error(`FAIL  ${f}`);
  process.exit(1);
}
console.log('OK  index.html parses, has the elements the script needs, '
  + 'and the repository still describes itself accurately');
