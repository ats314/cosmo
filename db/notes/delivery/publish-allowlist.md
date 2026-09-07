# The publish allowlist: what may reach dist/, and what enforces it

*What this answers: exactly which files are allowed to become public URLs, the
two predicates that decide, and which of the two hosts each rule protects.*

## One artifact, two hosts

`dist/` is the whole public product. GitHub Pages uploads it with
`actions/upload-pages-artifact@v3` (pages.yml:41-44, `path: dist`) after the
nine harnesses pass, and the comment above the step is a rule: *"Ship the exact
bundle that passed every check. Do not rebuild in deploy."* The `deploy` job
(pages.yml:46-65) consumes that artifact; nothing is built there.

Netlify publishes the same directory. `netlify.toml:3-6` sets
`command = "node netlify/build.mjs"`, `publish = "dist"`,
`functions = "netlify/functions"`. `netlify/build.mjs` spawns
`node_modules/typescript/bin/tsc --noEmit` then `node_modules/vite/bin/vite.js
build` through `process.execPath` — invoking Node directly so, in its own
words, *"platform-specific npm shims cannot alter the build"* — and then
asserts `dist/index.html` exists before reporting success.

The functions are deployed by Netlify from `netlify/functions`; they are never
part of `dist/`, which is why the same static artifact works on Pages and
inside the native WebView with no functions behind it.

## The two predicates

`tools/check.mjs:489-494` is the entire allowlist, and it is a deny-then-allow
pair applied to both `public/` and `dist/`.

`internalAsset(name)` — always rejected:

- any path segment `.git*`, `.env*`, `node_modules`, `netlify`, `tools`,
  `docs`, `src`
- a file whose basename starts `AGENTS`, `CLAUDE`, `README` or `MECHANICS`
- `package.json`, `package-lock.json`, `netlify.toml`, and any
  `vite*` / `capacitor*` / `tsconfig*` with a `.ts`, `.js` or `.json` extension
- any `.md`, `.map`, `.pem`, `.key`, `.p12`, `.pfx`, `.toml`, `.yml`/`.yaml`

`publicAsset(name)` — the only things allowed through:

- a file named exactly `LICENSE` (in any directory)
- `THIRD_PARTY_LICENSES.txt`
- `.nojekyll`
- these extensions: png, jpe?g, webp, avif, gif, svg, ico, webmanifest, json,
  woff/woff2, ttf, otf, mp3, ogg, wav, m4a, aac, flac, mp4, webm

`dist/` additionally permits `index.html` and `assets/<hash>.js|.css`
(`check.mjs:503`). Nothing else. A symlink anywhere in either tree is a
failure on its own (`check.mjs:483`) — a published asset tree that can point
outside itself is a directory traversal waiting to be served.

`.map` being on the deny list is why `vite.config.ts:17` sets
`sourcemap: false`: the deny rule is the second lock, not the first.

## The completeness half

The guard is not only "nothing extra". `check.mjs:510-511` requires every file
in `public/` to be present in `dist/` — a rebuild that dropped an asset fails
rather than shipping a game missing a sprite. `check.mjs:507-508` requires
`dist/index.html` and at least one `assets/*.js`.

`check.mjs:500` requires `public/LICENSE`. There is no equivalent requirement
for `public/THIRD_PARTY_LICENSES.txt`, even though `CLAUDE.md` and
`docs/engine/native.md` both say it must travel with the game — it is
*permitted* by `publicAsset` but not *required*. As read on 2026-09-07 the file
is there (162 lines, covering the Gemini artwork provenance, Phaser 4.2.1 MIT,
and the Capacitor packages).

## The proprietary notice

`check.mjs:472-477` asserts three things about the app shell:

- it has a `<script type="module" src=…>` entry (there is a Phaser app to boot)
- it does **not** contain an inline `<script>` declaring `const G =` — the
  tripwire against `index.html` regaining a second copy of the canonical game,
  a real prior shape of this project
- it contains both "copyright" and "all rights reserved"

and `check.mjs:512-514` re-checks the notice in the **built** `dist/index.html`,
because Vite could strip an HTML comment. Both files carry it today: the
comment block at `index.html:2-9` survives into `dist/index.html:2-9`.

## What actually ships

`public/` holds 32 files at commit `01a3a25`: 24 sprites plus
`art/manifest.json` under `art/`, three icons, `og.png`,
`manifest.webmanifest`, `LICENSE` and `THIRD_PARTY_LICENSES.txt`. The ten
opaque world plates that used to live in `art/worlds/` were removed in that
commit and the licence file now says they are kept outside the game as
references.

A build adds `index.html` and the hashed bundles under `assets/` to those 32,
and `check.mjs:510-511` requires every one of the 32 to have survived the copy.
`dist/` is gitignored, so its exact contents are whatever the last build
produced — the copy in this checkout was built before the worlds were removed
and still contains them, which is a stale artifact rather than a guard
failure (`.webp` is on the `publicAsset` list either way).

`vite.config.ts:10` sets `base: './'`, which is what lets the same bytes serve
from GitHub Pages' `/cosmo/` subpath and from the Capacitor WebView origins.
The two absolute `href="/…"` links in the source shell
(`index.html:31-32`) are rewritten to `./manifest.webmanifest` and
`./apple-touch-icon.png` in the built page.
