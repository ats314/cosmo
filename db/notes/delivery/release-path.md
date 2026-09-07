# The release path, and what is proven at each step

*What this answers: the exact sequence from a local edit to a live game on two
hosts and two app stores, and — at every step — what evidence exists, what
evidence is claimed but does not exist, and which step nothing can check.*

Read this before saying a change is "shipped". Six of the eight steps below
produce evidence; two do not, and they are the two most often reported as done.

## The sequence

### 1. Local — `npm ci`, then `node tools/all.mjs`

`all.mjs` reads `.github/workflows/pages.yml` and runs exactly the nine
`node tools/*.mjs` steps CI runs, in CI's order. Without `--fast` it first runs
`tsc --noEmit` and `vite build` through `process.execPath`, because
`rendercheck` and `enginecheck` need a real `dist/`.

**Proves:** the same checks CI will run, on the same artifact shape.
**Does not prove:** anything about how the game feels, or that a visual change
is right — the harnesses use a fake canvas (`drawcheck`), a fake GPU
(`fxcheck`), a real browser on a virtual document (`rendercheck`) and a real
browser on the built bundle (`enginecheck`). Only the last two see a real GL
context, and only `rendercheck` reads a pixel.

### 2. Push to `main`

The established workflow is a direct push after checks when shipping is
authorized (`CLAUDE.md`). Two workflows fire on that push.

### 3. `pages.yml` — check

Ubuntu, Node 24, `SEED: ${{ github.run_number }}`. `npm ci`, `npm run build`,
`npx playwright install --with-deps chromium`, then the nine harnesses as
literal steps.

**Proves:** the checks pass on a clean machine with a rotated seed. The seed
rotation is why `check.mjs:390-403` insists every seeded harness prints its
seed — a red CI without one is a failure nobody can reproduce.

### 4. `pages.yml` — upload, then deploy

`actions/upload-pages-artifact@v3` with `path: dist`, gated on
`refs/heads/main` and not a pull request. The `deploy` job consumes that
artifact through `actions/deploy-pages@v4` and contains **no build step**:
*"Ship the exact bundle that passed every check. Do not rebuild in deploy."*

**Proves:** the bytes served by Pages are the bytes the harnesses ran against.
This is the one guarantee that would be silently lost by adding a convenient
`npm run build` to the deploy job — the stamp would still name the same commit.

### 5. Netlify — a parallel, independent build

`netlify.toml` runs `node netlify/build.mjs`, publishes `dist`, and deploys
`netlify/functions` separately. The functions are never inside `dist/`, which
is exactly why the same static artifact runs on Pages, on Netlify, and inside
a Capacitor WebView with no functions behind it.

**Proves:** a second host has the same artifact. **Note the asymmetry:** only
Netlify has cache headers (`netlify.toml:11-25`). Pages has none, and the
in-page freshness check that used to compensate is inert (see
`build-stamp-and-freshness.md`).

### 6. Check the deployed URL — the step with no automation

`docs/invariants.md:117-118`: *"A build stamp identifies source; a successful
local build is not a live deployment. Check the published URL before reporting
release success."*

Nothing in `tools/` can observe this, and nothing ever will — it is an
obligation on whoever reports the release. The mechanism that makes it a
*one-second* check rather than an argument is the build stamp:

```js
// in a console on the live page
window.COSMO_BUILD            // → the seven-character commit sha
window.COSMO_APP.snapshot().build
```

and, without a console, the faint `build <sha>` line at the bottom right of the
title screen. Compare it to `git rev-parse --short=7 HEAD`. If they differ you
are looking at a cached copy, not at the fix.

`docs/engine/delivery.md:45-46` states the same procedure: *"A release check
opens the plain play URL and verifies its build identity and loaded assets."*

### 7. `android.yml` — the only native compilation evidence

Fires on the same push. Ubuntu, Node 24, Temurin JDK 21, platform 36, Build
Tools 35.0.0, `npm ci`, `npm run build`,
`node node_modules/@capacitor/cli/bin/capacitor sync android`, then
`bash ./gradlew --no-daemon --stacktrace :app:assembleDebug`. Uploads
`app-debug.apk` as `cosmo-android-debug-<sha>`, 14-day retention,
`if-no-files-found: error`.

**Proves:** the Android project compiles and produces an installable APK.
**Does not prove:** a release build, a signed build, a store upload, or that
anyone ran it on a device. Android's ordinary debug key signs it; independent
runs may use different debug keys, so an older test install may need removing
first.

### 8. iOS — no evidence exists

There is no iOS workflow. `docs/engine/native.md:81-83` is explicit: Windows
can prepare project files and bundled assets, and *"Generated project files are
not evidence of a successful native build."* Signing needs the owner's
development team in Xcode 26+ on macOS.

## The four claims to refuse to make

Each one is contradicted by something in this repository:

| Claim | What actually happened |
|---|---|
| "It's deployed" after a green local build | A local build stamps the same sha a deploy would. Only the live URL can say. |
| "The APK is built" after `npm run native:sync` | `cap sync` copies `dist/` and refreshes plugin references. CI's `assembleDebug` is what builds an APK. |
| "iOS is ready" after `cap sync ios` | Nothing in this repository has ever compiled iOS. |
| "The play link self-heals, so testers get the fix" | `freshCheck` returns at its first line in the Phaser host. See `build-stamp-and-freshness.md`. |

## What a re-checkable release note looks like

The stamp exists because a day was lost to a screenshot nobody could date — a
fix deployed at 1:01:42pm, a screenshot at 1:02pm, and no way for either side
to say whether the page was the ten-minute-stale cached copy
(`src/game/runtime.js:66-72`). So a release report that costs nothing to verify
names three things:

1. the commit sha that was pushed,
2. the sha read back from the live page (`window.COSMO_BUILD`),
3. which host was checked — the two are deployed independently and can differ.
