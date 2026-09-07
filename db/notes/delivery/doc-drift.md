# Where the delivery documents and the source disagree

*What this answers: every place a delivery/native/cloud/telemetry document
makes a claim this session could not confirm in the code, with what the code
actually does.*

Each entry names the document's claim, the source that contradicts it, and
whether the document or the code is the thing that should move.

## 1. `netlify/build.mjs` no longer reads the workflow

**`docs/engine/cloud.md` says:** *"`netlify/build.mjs` stages the site by
**reading the `cp … _site/` line out of `.github/workflows/pages.yml`** rather
than restating it. A second copy of that list is a second thing to forget…
One list, two deploys."*

**The source says:** `netlify/build.mjs` is 18 lines. It spawns
`node_modules/typescript/bin/tsc --noEmit`, then
`node_modules/vite/bin/vite.js build`, then asserts `dist/index.html` exists.
It never opens `pages.yml`. And `pages.yml` has no `cp … _site/` line to read:
the deploy step is `actions/upload-pages-artifact@v3` with `path: dist`
(`.github/workflows/pages.yml:41-44`).

**Why:** the argument was written when the site was assembled by copying named
files into `_site/`. Vite's `dist/` replaced that whole staging step, so the
divergence risk the design guarded against no longer exists — one directory is
the artifact on both hosts. `.gitignore:5` still ignores `_site/`, the last
trace. The **document** should move; the code is right.

**Related:** `docs/engine/cloud.md` also says "the same argument `all.mjs` makes
for parsing the workflow instead of holding its own list of harnesses" — that
half is still true (`tools/all.mjs:25-41`).

## 2. Native share text uses `location.origin`

**`docs/engine/native.md` says:** *"Native share text must use the public game
URL, never `location.origin`, which would produce a private localhost link."*
**`docs/engine/delivery.md` says:** *"Shared game links use a public address,
never a native app's localhost origin."*

**The source says** (`src/game/runtime.js:7086-7087`), the last line of
`runSummary()`:

```js
(location.origin+location.pathname).replace(/index\.html$/,'');
```

On Android that is `https://localhost/` and on iOS `capacitor://localhost/` —
exactly the private link both documents forbid. The runtime knows it is native
(`runtimeHost.native`, used at `:57`) and already holds a public origin
(`CLOUD_ORIGIN = 'https://cosmo-arcade.netlify.app'`, `:3785`), so the
information to fix it is in scope.

**Nothing checks it.** `tools/smoke.mjs` asserts the share text's ladder
(`smoke.mjs:436-444`) and its start-level qualifier (`:840-848`) and that the lab offers
no share (`:1201`), but never inspects the URL line. The **code** should move.

## 3. `docs/engine/cloud.md` still describes a single-file game

`docs/engine/cloud.md:9` opens *"The game is still one self-contained file that
plays with no network at all"*, and `:102-103` argues against server-side replay
validation with *"`index.html` calls `Math.random` 73 times with no generator of
its own"*. The same sentence survives in `netlify/functions/scores.mjs:18-21`.
Since the Phaser migration the canonical runtime is `src/game/runtime.js`
(12,335 lines, 39 literal `Math.random` occurrences at commit `01a3a25`) and `index.html` is a
43-line shell. The underlying point — no seeded generator, so no server-side
replay — is still true; the file and the count are not.

It also says *"Seven of the eight harnesses run this file against a stubbed
DOM"*. There are nine harnesses now, of which `enginecheck.mjs` and
`rendercheck.mjs` use real browsers, so it is seven of nine.

## 4. `docs/engine/telemetry.md` names an event that does not exist, and misses one that does

- **`mode_chosen`** — the document says it "fires when [that screen is]
  answered". No `track('mode_chosen'…)` exists anywhere in
  `src/game/runtime.js`. The difficulty-mode screen retired with CHILL.
- **`blackhole_failed`** (`src/game/runtime.js:2384`) is undocumented, while
  the document claims the black hole "reports all three outcomes now". It is a
  fourth outcome: escape window missed but a shield absorbed it, so the run
  continues.

See `db/notes/delivery/telemetry-inventory.md` for the full event table.

## 5. The record merge table's "last write" row names a helper nothing uses

**`docs/engine/cloud.md` says:** rule `last write` applies to `muted`, `swipe`,
`name`.

**The source says** (`netlify/lib/records.mjs:82-95`): `muted` uses
`oneOf('0','1')`, `swipe` uses `oneOf('radial','screen')`, `name` uses a
bespoke validator. The `last` helper defined at `:65` is referenced nowhere.
The *behaviour* is last-write-wins-if-valid, so the table describes the effect
correctly; the named function is dead code.

## 6. `all.mjs`'s lane prose counts eight harnesses

`tools/all.mjs:44-49` says "four harnesses are ~95% of it" and "`--fast` runs
the quick four and leaves the slow four". There are nine harnesses now: four
fast (check, drawcheck, fxcheck, musiccheck) and **five** full (curriculum,
dropcheck, enginecheck, rendercheck, smoke). `enginecheck.mjs` joined after the
comment was written. The mechanism is unaffected — nothing reads that number.

## 7. The play-link freshness contract is documented as live in one place and dead in another

`docs/engine/delivery.md` correctly says the freshness parser "is disabled in
the Phaser host". `tools/smoke.mjs:1536-1566` nonetheless asserts the whole
feature and prints "play-link self-heal ok". Both are internally honest — the
harness runs the compatibility path, where `externalLoop` is falsy — but a
reader who meets the harness first will believe the shipped play URL heals
itself. It does not. See
`db/notes/delivery/build-stamp-and-freshness.md`.

## 8. `cometloop:landed` is a synced key with no producer

`netlify/lib/records.mjs:89` syncs `landed` under the `sticky` rule and
`docs/engine/cloud.md`'s table lists it as "this human has once done X". No
code in `src/game/runtime.js` ever writes `cometloop:landed`, and `G.everLanded`
is read only to upload it (`:3950`). Contrast `hopped`, written at `:6961` and
gating teaching at `:8216` and `:11528`.

## 9. `setHapticsEnabled` is documented but unreachable

`docs/engine/native.md:98` describes `setHapticsEnabled(false)` as a supported
call. It is exported from `src/platform/native.ts:22` and imported by nothing —
there is no in-game control that disables haptics.

## Things that checked out

For contrast, these were verified and are accurate as written:

- `dist/` upload path, and that Pages does not rebuild in deploy
  (`pages.yml:40-44`).
- The Android CI APK workflow's every detail — Node 24, Java 21, platform 36,
  Build Tools 35.0.0, AGP 8.13.0, Gradle 8.14.3, artifact name
  `cosmo-android-debug-<sha>`, 14-day retention, and the
  `android/app/build/outputs/apk/debug/app-debug.apk` path
  (`.github/workflows/android.yml`, `android/build.gradle`,
  `android/gradle/wrapper/gradle-wrapper.properties`).
- Capacitor origins `https://localhost` / `capacitor://localhost`, no
  `server.url`, and their presence in the CORS allowlist
  (`capacitor.config.ts:11-16`, `netlify/lib/auth.mjs:40-48`).
- The build stamp's three fallbacks and the `dev` value in development
  (`vite.config.ts:4-11`). It was read out of a built artifact at commit
  `8d10559` as `g=\`8d10559\`;try{window.COSMO_BUILD=g}`; `dist/` is a build
  product and is not in Git, so re-read it from a fresh build rather than
  trusting that string.
- Relative asset URLs surviving the build: `index.html:31-32`'s `/…` hrefs
  become `./…` in the built entry page under `base: './'`.
- Production source maps disabled (`vite.config.ts:17`) and `.map` on the
  publish deny list (`tools/check.mjs:492`).
- Every merge rule, bound and constant in `netlify/lib/records.mjs` and
  `netlify/lib/plausible.mjs`.
