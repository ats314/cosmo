# Delivery

Cosmo ships a Vite-built web bundle and Capacitor native projects.

## Build boundary

`npm ci` installs the locked versions. `npm run build` checks the TypeScript
scene/platform layer and writes `dist/`. The JavaScript gameplay core remains
behind the typed runtime contract; passing TypeScript does not establish full
type coverage of that core.

Vite includes the module graph and copies intentional release files from
`public/`: art, icons, manifest, LICENSE and THIRD_PARTY_LICENSES.txt.
Production source maps are disabled. Publish **dist only**, never the checkout.
README, CLAUDE, mechanics/docs, tools, package files and native source are
internal project material.

Relative asset URLs support both GitHub Pages' /cosmo/ path and bundled native
origins. Adding an asset means adding it to public/ or importing it through the
build, recording its provenance, and checking that it reaches dist/.

## Web hosts

The public game is available at
[Netlify](https://cosmo-arcade.netlify.app/) and
[GitHub Pages](https://ats314.github.io/cosmo/). The Pages workflow checks the
main revision before publishing its built artifact. Netlify uses the Vite
build and publishes the same dist/ boundary, with netlify/functions providing
the optional account and record service.

The cloud service uses an absolute Netlify origin and an exact CORS allowlist,
so the Pages copy and native apps can use it too. Sign-in failure or an offline
connection must never prevent a local game. Shared game links use a public
address, never a native app's localhost origin.

## Build identity and freshness

vite.config.ts injects `__COSMO_BUILD__` from the local Git commit, falling
back to COMMIT_REF or GITHUB_SHA on a builder. The title screen and
`window.COSMO_BUILD` expose it; development says dev.

The production HTML shell is revalidated while hashed Vite assets identify
their contents. The old self-contained-HTML freshness parser is disabled in
the Phaser host: searching for an inline BUILD literal would be incorrect for
a module bundle. Never reload a live run to refresh it. A release check opens
the plain play URL and verifies its build identity and loaded assets.

## Native packages

`npm run native:sync` rebuilds and copies dist/ into Android and iOS, updating
the App and Haptics plugins. Generated web copies and native build outputs are
ignored by Git; keep platform source, manifests, project files and Gradle's
wrapper. Synchronize again after the final web edit.

The native projects are configured for portrait with branded launcher icons
and local launch screens. No APK or iOS binary was built or signed in the
Windows migration workspace. Android SDK/JDK and macOS/Xcode remain the
respective build requirements. See [native setup](native.md) for exact commands
and the expected APK path.
