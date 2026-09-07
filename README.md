# Cosmo

A portrait space arcade for the web, Android and iOS. Turn a comet, change
orbits, collect stars and escape red hazards inside a luminous cosmic world.

**[Play Cosmo](https://cosmo-arcade.netlify.app/)** ·
[GitHub Pages](https://ats314.github.io/cosmo/)

Cosmo is proprietary commercial software. The game's original code and artwork
remain all rights reserved; see [LICENSE](LICENSE). Third-party dependencies
retain their own licenses, recorded in
[THIRD_PARTY_LICENSES.txt](public/THIRD_PARTY_LICENSES.txt).

## Play

Tap to turn around. Swipe to change rings. New players learn through a safe,
playable introduction; **Learn to play** on the title screen reopens it.

Collecting stars increases their combo value. Completing an orbit without
turning pays for the stars collected along that route. Three star-fed orbits
earn **Starfall**: a clear arena and three waves of double-value stars over
about 9.23 seconds. The upgrade reduces the requirement to two orbits. The
reward starts automatically; taps always turn and never become a music task.

Ten powerups change the route or the risk: Shield, Slow-mo, Nova, Hypernova,
Magnet, Mirror, Scorch, Slipstream, Star Trail and Black Hole. Magnet attracts
nearby stars. The rare black hole opens a fourth ring: charge a reward inside,
then reach the outer ring during its five-second escape window.

Six levels are authored today. More worlds and levels can extend the journey.
See [the current direction](docs/design/direction.md) and the
[mechanics ledger](MECHANICS.md) for the design.

| Action | Touch | Keyboard |
|---|---|---|
| Turn around | Tap | Space / Enter |
| Change ring | Swipe up/down by default; radial controls are available | Arrow keys / WASD |
| Pause | Pause control | P / Escape |
| Mute | Speaker control | M |

Accounts are optional. Local records work offline; the existing name/account-code
flow connects records across devices when online. A native install starts from
bundled game assets and does not need a hosted page to play.

## Develop

Use Node 22 or newer.

```sh
npm ci
npm run dev          # http://localhost:5173
npm run build        # strict TypeScript checks, then Vite output in dist/
npm run test:fast    # focused checks while editing
npm test             # required suite before shipping
```

The render harness needs Chromium; install it with
`npx playwright install chromium` when no supported browser is available.
Open the Vite URL for development. The source entry is a module and is not a
standalone file to open through `file://`.

## Architecture

Phaser **4.2.1** owns boot, scenes, input, resize and the frame loop. Strict
TypeScript defines the scene and platform contracts. The tuned simulation,
WebAudio composition, canvas UI and GPU background remain in
`src/game/runtime.js`, a JavaScript runtime behind that typed interface.
This is an incremental migration; the gameplay core is not fully converted to
TypeScript.

| Path | Responsibility |
|---|---|
| `index.html`, `src/main.ts` | HTML shell and Phaser startup |
| `src/scenes/` | Asset boot, input forwarding, display and lifecycle ownership |
| `src/game/contracts.ts` | Typed runtime/host boundary |
| `src/game/runtime.js` | Existing gameplay, audio, canvas drawing and GPU effects |
| `src/platform/native.ts` | Pause/resume, Android Back and optional haptics |
| `public/` | Files intentionally shipped: art, icons, manifest and licenses |
| `dist/` | Generated web release; the only site directory to publish |
| `capacitor.config.ts`, `android/`, `ios/` | Capacitor 8 native projects |
| `netlify/` | Optional account, record and leaderboard functions |
| `tools/` | Deterministic functional and browser checks |

The asset boot scene reads `public/art/manifest.json`. Original art can be added
as individual PNG/WebP files with recorded provenance. Procedural planets,
atmosphere, rings and nebula form the world; 24 transparent sprites add object
art and material detail. Opaque world plates are archived outside the game and
are absent from the release manifest. See the [current art and motion direction](docs/design/direction.md).

## Native apps

```sh
npm run native:sync
npm run native:android
npm run native:ios
```

Android and iOS projects are generated and synchronized with Capacitor 8.5.1.
They include portrait settings, Cosmo icons, dark launch screens and the App
and Haptics plugins. **No APK or iOS binary has been built or signed in this
Windows workspace.** Android needs its SDK/JDK; iOS builds require macOS and
Xcode. See [native setup](docs/engine/native.md).

## Project guide

Read [CLAUDE.md](CLAUDE.md) before changing the project. Then use
[the invariants](docs/invariants.md), [harness guide](docs/harnesses.md),
[delivery guide](docs/engine/delivery.md), and [document index](docs/README.md).
License questions go to the owner through
[the repository](https://github.com/ats314/cosmo/issues).
