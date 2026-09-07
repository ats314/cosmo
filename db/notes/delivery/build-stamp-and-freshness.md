# The build stamp and the freshness contract

*What this answers: what `window.COSMO_BUILD` proves and what it cannot, and
why the play-link self-heal is asserted green by a harness while being dead
code in the shipped product.*

## Where the stamp comes from

`vite.config.ts:4-11`:

```ts
function buildId(): string {
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], …).trim(); }
  catch { return (process.env.COMMIT_REF || process.env.GITHUB_SHA || 'dev').slice(0, 7); }
}
…
define: { __COSMO_BUILD__: JSON.stringify(command === 'build' ? buildId() : 'dev') }
```

Three sources in order: the local Git short SHA, then Netlify's `COMMIT_REF`,
then GitHub Actions' `GITHUB_SHA`, then the literal `dev`. `vite dev` is always
`dev` regardless — the ternary keys on `command === 'build'`.

`src/game/runtime.js:73-74` reads it and publishes it:

```js
const BUILD=typeof __COSMO_BUILD__==='string'?__COSMO_BUILD__:'dev';
try{window.COSMO_BUILD=BUILD;}catch(e){}
```

The VM harnesses evaluate the runtime body with no `__COSMO_BUILD__` defined,
so `BUILD` is `'dev'` there. `src/game/contracts.ts:63` declares the global for
TypeScript.

Three surfaces expose it: `window.COSMO_BUILD`, the title screen's faint
bottom-right line `'build '+BUILD` (`src/game/runtime.js:12085` — never drawn
during play), and `runtimeSnapshot()`'s `build` field
(`src/game/runtime.js:12270-12279`), which is what `window.COSMO_APP.snapshot()`
hands a harness or a console.

Read out of a built artifact at commit `8d10559`: `dist/assets/index-*.js`
contained `g=\`8d10559\`;try{window.COSMO_BUILD=g}`, matching HEAD. `dist/` is
gitignored, so the bundle filename is a hash that changes every build — check
the current one rather than that name.

## What it proves and what it does not

It proves *which commit these bytes were built from*. The comment at
`src/game/runtime.js:66-72` records the incident it exists for: a fix deployed
at 1:01:42pm, a screenshot taken at 1:02pm, and no way for either side to say
whether the page was the ten-minute-stale cached copy.

It does not prove the build is deployed. `docs/invariants.md:117-118` states
this as a rule — *"A build stamp identifies source; a successful local build is
not a live deployment. Check the published URL before reporting release
success."* A local `npm run build` stamps the same SHA as a deploy would.

It also does not prove the *artifact* is intact — only `check.mjs`'s dist scan
does that, and only when a build exists (`check.mjs:515-517` tolerates ENOENT so
the fast lane may run before a build).

## The freshness contract, and why it is inert

`src/game/runtime.js:93-107` is `freshCheck(force)`. The design (comment at
lines 75-92) is: fetch the first 8 KiB of `location.pathname` with a
minute-bucketed `?chk=` query as its own CDN cache key, read a `BUILD` stamp out
of the bytes, and if it differs, `location.replace(location.pathname+'?u='+m[1])`
— once, and only from the title screen. Four guards, each load-bearing:

- `BUILD==='dev'` never checks (source, harnesses, local files); `force` is the
  harness's door
- a URL already carrying `?u=` never redirects again, so two mismatched cached
  copies bounce at most one hop and can never loop
- the swap fires only at `G.state==='menu'` — reloading a live run to refresh
  its background would be vandalism
- every failure is silence

**In the shipped Phaser build none of that runs.** Line 94 is the first
statement:

```js
if(runtimeDestroyed||runtimeHost.externalLoop)return;
```

`src/scenes/CosmoScene.ts:38` passes `externalLoop: true`, so `freshCheck`
returns immediately. Its only call site is inside
`if(!runtimeHost.externalLoop){ … }` at `src/game/runtime.js:12324-12327`
anyway. `docs/engine/delivery.md` documents this as intended: *"The old
self-contained-HTML freshness parser is disabled in the Phaser host: searching
for an inline BUILD literal would be incorrect for a module bundle."*

There is a second, independent reason it could not work: the parser is
`/const BUILD='([0-9a-f]{7})'/` (line 103), and the shipped entry page is
the built `dist/index.html` — a shell whose only script is a `<script
type="module" src="./assets/index-*.js">`. The stamp lives in the minified
bundle as a backtick literal assigned to a one-character name. Neither the
identifier nor the quoting survives
minification, so even a page that reached line 103 would never match.

## The harness that keeps it green

`tools/smoke.mjs:1536-1566` asserts the whole feature: no swap mid-run, exactly
one hop from the menu, the fetch carries its own `?chk=` cache key, and a `?u=`
URL never redirects again. It works because the VM harnesses build the runtime
with `host = {}` (`tools/lib/game-source.mjs:20`), so `runtimeHost.externalLoop`
is falsy and the compatibility path is live, and because it calls
`freshCheck(true)` to bypass the `dev` guard.

So the situation is: a documented, tested, carefully-guarded feature that is
correct in the harness, deliberately disabled in production, and whose parser
could not match the production page even if it were enabled. Nothing is wrong
— but a session reading `smoke.mjs` and concluding "the play link self-heals"
would be wrong about the shipped game.

## What replaced it

Cache headers, on Netlify only. `netlify.toml:11-25`: `/` and `/index.html` get
`Cache-Control: no-cache, must-revalidate`; `/assets/*` gets
`public, max-age=31536000, immutable`, which is safe because Vite hashes those
filenames. GitHub Pages has no equivalent configuration in this repository, so
the ten-minute entry-page cache the freshness check was written against is
still the Pages behaviour, now with nothing compensating for it.
`docs/engine/delivery.md` states the release procedure that stands in its
place: *"A release check opens the plain play URL and verifies its build
identity and loaded assets."*
