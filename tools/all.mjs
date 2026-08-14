/* One command for every check — and deliberately not a list of them.

   The six harnesses were six things to remember, in an order nobody wrote
   down, and the failure that costs a session is not running one of them: the
   pull request goes up, CI finds it, and the fix costs a round trip that a
   local run of two seconds would have saved. So there is one command now.

   IT HOLDS NO LIST. It reads .github/workflows/pages.yml and runs exactly the
   `node tools/*.mjs` steps CI runs, in CI's order. A list here would be a
   second copy of the CI list, and a second copy is the thing that rots — the
   local runner drifting from the build is precisely the bug where "all checks
   passed locally" and the pull request goes red anyway. There is one list, it
   lives in the workflow, and this file obeys it.

   The complement of this guard lives in check.mjs: this file proves the local
   run matches CI, and check.mjs proves every harness in tools/ is wired into
   CI in the first place. Together they close the loop — a harness cannot be
   added to the tree without running, and cannot run in CI without running
   here. Either one alone leaves the other half open. */
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const wf = await readFile(new URL('.github/workflows/pages.yml', root), 'utf8');

/* Anchored to a `run:` step so the harness names in this file's own comments,
   and the ones in the workflow's comments, cannot be mistaken for steps. */
const steps = [...wf.matchAll(/^[ \t]*-[ \t]+run:[ \t]+node[ \t]+(tools\/[\w.-]+\.mjs)[ \t]*$/gm)]
  .map(m => m[1]);

/* A floor, not an exact count: adding a seventh check should not have to edit
   this file. Zero or one means the parse has stopped matching the workflow's
   shape, and a runner that silently runs nothing reports success — which is
   the worst possible answer from a thing whose whole job is to say no. */
if (steps.length < 2) {
  console.error(`FAIL  parsed only ${steps.length} harness step(s) out of pages.yml — `
    + 'the workflow\'s shape has changed and this runner cannot see what CI runs. '
    + 'Fix the pattern in tools/all.mjs rather than listing the harnesses here.');
  process.exit(1);
}

/* TWO LANES, AND THE HARNESS DECIDES WHICH IT IS IN.

   The full run is ~50 seconds and three harnesses are 90% of it, because they
   play whole games; the other four are static or targeted and finish together
   in under four. Paying fifty seconds to find out you left a typo in a shader
   is the loop that makes an editing session slow, so `--fast` runs the quick
   four and leaves the game-playing three for the run before you push.

   The lane is declared IN each harness (`@lane fast` / `@lane full`) rather
   than listed here, for the same reason this file parses the workflow instead
   of holding its own list: a list here would be a second place to update, and
   the update everybody forgets is the one that silently puts a slow harness in
   the fast lane and makes `--fast` a lie. check.mjs fails if a harness
   declares no lane at all. */
const FAST = process.argv.includes('--fast');
const lanes = new Map();
for (const step of steps) {
  const body = await readFile(new URL(step, root), 'utf8');
  lanes.set(step, (body.match(/@lane\s+(fast|full)/) || [, 'full'])[1]);
}
const run = FAST ? steps.filter(s => lanes.get(s) === 'fast') : steps;
if (FAST && !run.length) {
  console.error('FAIL  --fast selected no harnesses — every one of them declares @lane full, '
    + 'so the fast lane is empty and would report success without checking anything.');
  process.exit(1);
}
if (FAST) {
  console.log(`fast lane: ${run.length} of ${steps.length} harnesses. `
    + `Skipping ${steps.filter(s => lanes.get(s) !== 'fast').map(s => s.replace('tools/', '')).join(', ')} `
    + '— run without --fast before you push.');
}

const t0 = Date.now();
for (const [i, step] of run.entries()) {
  process.stdout.write(`\n--- [${i + 1}/${run.length}] ${step}\n`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [step], {
    cwd: fileURLToPath(root),
    stdio: 'inherit',
  });
  /* Stop at the first failure. The harnesses are not independent — smoke,
     dropcheck and curriculum all drive the same front screens, so one broken
     screen fails all three with the same message three times over, and the
     first report is the only informative one. */
  if (r.status !== 0) {
    console.error(`\nFAIL  ${step} exited ${r.status ?? `on signal ${r.signal}`} `
      + `after ${((Date.now() - started) / 1000).toFixed(1)}s — stopping here.`);
    process.exit(r.status || 1);
  }
}
console.log(`\nOK  ${FAST ? `fast lane (${run.length} of ${steps.length})` : `all ${run.length}`}`
  + ` checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
