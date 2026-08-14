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

/* THE FORMATION HALF of the curriculum rule: every tier unlocks by level 3's
   finish line, so level 4 — the exam — introduces no new shape. See
   docs/invariants.md and MECHANICS.md. The finish line is read from the LV
   table itself so lengthening a level cannot break the guard.

   This comment said "level 2's finish line, so level 3 introduces nothing"
   for as long as the code below read ends[2], which is level 3's. Level 4
   moved the exam when it was added and the prose never followed; the guard
   was right and its own explanation was a level out, which is worse than no
   explanation — a reader who trusts it goes looking for room to add a shape
   in the wrong place. The code was already correct and is untouched. */
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

/* THE PUBLISHED SITE IS AN ALLOWLIST, AND THIS IS WHAT KEEPS IT ONE.
   The deploy used to upload `path: .`, so every file in the repository was
   served from the Pages URL — CLAUDE.md, README.md, MECHANICS.md and all six
   harnesses among them. Repository visibility never covered that: Pages serves
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
   prevent, waved through by the guard.
   It was missed because the mutation test that "covered" it changed the
   staging step and the path together, so the two were never separated. Mutate
   one thing at a time, or a mutation test agrees with whatever it is shown. */
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

if (fail.length) {
  for (const f of fail) console.error(`FAIL  ${f}`);
  process.exit(1);
}
console.log('OK  index.html parses, has the elements the script needs, '
  + 'and the repository still describes itself accurately');
