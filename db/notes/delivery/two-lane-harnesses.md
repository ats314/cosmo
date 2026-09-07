# The two-lane harness system

*What this answers: how `npm test` decides what to run, why no file holds a
list of harnesses, and what each of the three guards that keep the loop closed
actually asserts.*

## There is exactly one list, and it lives in the CI workflow

`.github/workflows/pages.yml` lines 30-39 are nine literal
`- run: node tools/<name>.mjs` steps, in CI's order, preceded by a comment that
says why they must stay literal: *"Keep explicit harness steps: tools/all.mjs
reads this list."*

`tools/all.mjs` holds no list. It reads that workflow file and extracts the
steps with an anchored regex (`tools/all.mjs:29`):

```js
/^[ \t]*-[ \t]+run:[ \t]+node[ \t]+(tools\/[\w.-]+\.mjs)[ \t]*$/gm
```

Anchoring to `run:` is deliberate — harness filenames appear in this file's own
comments and in the workflow's comments, and an unanchored match would run
those. A floor of two parsed steps (`tools/all.mjs:36-41`) fails the runner
outright rather than letting a changed workflow shape silently reduce the local
suite to nothing: *"a runner that silently runs nothing reports success."*

## The lane is declared in the harness, not in the runner

Every harness's first line is `/* @lane fast */` or `/* @lane full */`.
`all.mjs` reads each file and defaults an undeclared harness to `full`
(`tools/all.mjs:61`), and `check.mjs:385-388` fails the build if any harness in
`tools/` declares no lane at all — so the default is a safety net, never a
resting place.

As read on 2026-09-07:

| Lane | Harnesses |
|---|---|
| `fast` | check.mjs, drawcheck.mjs, fxcheck.mjs, musiccheck.mjs |
| `full` | curriculum.mjs, dropcheck.mjs, enginecheck.mjs, rendercheck.mjs, smoke.mjs |

Four fast, five full. `all.mjs`'s own comment describes the split as "the quick
four" against "the slow four", which was written when there were eight; the
count is now nine because `enginecheck.mjs` joined the full lane. The lane
assignment itself is still correct — the prose beside it has drifted by one.

`--fast` skips the build entirely. Without `--fast`, `all.mjs:76-83` runs
`tsc --noEmit` and `vite build` before the first harness, because
`rendercheck` and `enginecheck` need a real `dist/`.

## Stop at the first failure, on purpose

`tools/all.mjs:91-99` exits on the first non-zero harness rather than
continuing, and says why: smoke, dropcheck and curriculum all drive the same
front screens, so one broken screen fails all three with the same message and
only the first report is informative.

## Three guards close the loop

These are complements; each one alone leaves the other half open.

1. **Every harness in `tools/` runs in CI.** `tools/check.mjs:351-377` builds
   the set of `node tools/*.mjs` steps in the workflow and the set of `*.mjs`
   files in `tools/` (excluding `all.mjs`, which is the runner, not a check),
   and fails on either difference. A harness in the tree that CI never runs
   "reads as coverage to anyone listing the directory" and never once runs on a
   pull request.
2. **Every harness runs locally.** `all.mjs` obeying the workflow is the
   converse: a check cannot run in CI without running under `npm test`.
3. **Every harness is named in the routing document.** `check.mjs:404-450`
   requires each harness filename to appear somewhere in `docs/harnesses.md`.
   The comment records why: the doc *claimed* this guard existed ("three edits,
   and `check.mjs` fails until all three are made") while only two were
   enforced, and `rendercheck.mjs` — the only harness in the repository that
   reads a pixel — was missing from both `docs/harnesses.md` and `README.md`
   while both documents asserted that `fxcheck` was the only render-path check.
   The guard is whole-file rather than near-the-name, deliberately: a filename
   cannot appear in prose by accident the way a bare number can.

`README.md` was removed from that routing list after both copies of the harness
table went stale in the same way at the same time. There is one routing
document now and `README.md` links to it.

## Two more tripwires in the same block

- **A seeded harness must print its seed** (`check.mjs:390-403`). CI sets
  `SEED: ${{ github.run_number }}`, so coverage rotates per run — survivable
  only if each failure carries the seed that produced it. The guard exists
  because curriculum, dropcheck, fxcheck and musiccheck all imported `seedLine`
  and never called it, for four sessions, while `CLAUDE.md` and
  `docs/harnesses.md` both stated the opposite.
- **`rendercheck` must have a browser installed in CI** (`check.mjs:453-464`).
  It skips when Chromium is absent, which is right locally and fatal in the
  build: without the `npx playwright install --with-deps chromium` step
  (pages.yml:29) it would report SKIP and success forever, removing the only
  check that looks at a pixel while eight others stayed green.

## Where the lanes actually run

`enginecheck.mjs` is the only harness that exercises the shipped artifact. It
asserts `dist/index.html` exists (line 39), starts `vite preview` on
127.0.0.1:4173, and blocks every request that is not a GET to that origin
(lines 70-76) — so no account call and no telemetry POST can leave the check,
and rejected external requests must leave play functional. It observes only
`window.COSMO_APP.snapshot()` and browser errors, then drives real pointer and
CDP touch input. Everything else runs the extracted runtime body in a VM (see
`tools/lib/game-source.mjs`), which is a different surface with a different
host — and that difference matters: see
`db/notes/delivery/build-stamp-and-freshness.md`.
