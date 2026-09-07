# Native Cosmo

Cosmo's Capacitor shell packages the built game for Android and iOS. Its app
identifier is `app.cosmo.arcade`, its display name is **Cosmo**, and its bundled
web directory is `dist`. The shell loads those local assets; it does not point
at a hosted game or a development server. Online accounts remain optional.

## Build and synchronize

Use Node 22 or newer. Install the versions in the package lock, build the web
game, then synchronize its output into the native projects:

```sh
npm ci
npm run build
npx cap sync android
npx cap sync ios
```

`cap sync` copies the current `dist` files and updates native plugin references.
Repeat it after changing the game, assets, Capacitor configuration or plugins.
Never set `server.url` for a release. A native install must open its bundled
title screen without a network connection. Sign-in and leaderboards may report
offline status, but must not prevent starting a local game.

Native launcher assets are deterministic size conversions of the existing
`icon-512.png`. Android has density-specific icons and padded adaptive
foregrounds; iOS has an opaque 1024-pixel export. Both launch backgrounds use
the game's dark color. Bundled web assets include `THIRD_PARTY_LICENSES.txt`.

The game uses edge-to-edge WebViews. Layout must respect `env(safe-area-inset-*)`
so notches, status bars and navigation gestures do not cover controls.

## Android

Open the project with `npx cap open android`. Capacitor 8 requires Android
Studio 2025.2.1 or newer. The generated project targets Android SDK 36 and
supports API 24 and newer; install the SDK requested by its Gradle files.
Android Studio supplies a compatible JDK.

For an installable debug APK, use Android Studio's Build APK command, or run
`gradlew.bat assembleDebug` inside `android` after configuring the SDK/JDK. The
result is `android/app/build/outputs/apk/debug/app-debug.apk`. A connected test
device can install it with `adb install -r <apk-path>`.

The **Android debug APK** workflow (`.github/workflows/android.yml`) runs on
every main push or manual workflow dispatch. Its Ubuntu runner installs Node
24, Java 21, Android platform 36 and Build Tools 35.0.0, builds the web bundle,
synchronizes Capacitor and runs `bash ./gradlew --no-daemon --stacktrace
:app:assembleDebug` from `android/`. The project uses AGP 8.13.0 and its
checked-in Gradle 8.14.3 wrapper.

After a successful run, download artifact `cosmo-android-debug-<full-commit-sha>`
from the run's Artifacts section. It contains `app-debug.apk`, retained for
14 days. With GitHub CLI, use
`gh run download <run-id> --name cosmo-android-debug-<full-commit-sha> --dir apk`.
Install with `adb install -r apk/app-debug.apk`. Android's normal debug key
signs this test build automatically; no owner signing secrets or store upload
are involved. Independent CI runs may use different debug keys, so an older
test install may need removal before installing a later artifact.

This is separate from the Pages validation/deployment workflow. A successful
CI APK build is the native compilation evidence; this Windows checkout still
does not compile Android locally.

Portrait is declared on the main activity. Large-screen Android versions can
override orientation restrictions, so the game's layout must still fit a wide
window. Keep Gradle's wrapper files in source control; keep build output,
`local.properties`, keystores and signing passwords out of it. Release signing
belongs to the owner's Android credentials, entered locally in Android Studio
or a protected build environment.

## iOS

Capacitor 8 uses Swift Package Manager by default. Open the generated project
with `npx cap open ios` on macOS with Xcode 26 or newer. The deployment target
is iOS 15. Set the owner's development team in Xcode before building on a
device or archiving for TestFlight. iPhone and iPad supported orientations are
portrait; iPad requires full screen to honor the orientation lock.

Windows can prepare project files and bundled assets. It cannot run Xcode,
produce a verified iOS binary, or validate signing. Generated project files are
not evidence of a successful native build.

## Game integration

`src/platform/native.ts` has no dependency on the game's scenes or runtime.
Call `installNativeBridge({ pause, resume, back })` once when starting the game
and keep the returned disposer. Use it during shutdown or a development reload.

- `pause()` freezes simulation, clears held input and silences audio.
- `resume()` restores foreground UI. It must not silently resume an interrupted
  run; the game owns its resume control/countdown and audio unlock.
- `back()` returns `true` after closing a panel, pausing or returning to the
  title. Return `false` at the root title to minimize the Android app.
- `haptic(kind)` accepts `tap`, `hop`, `pickup`, `impact`, `reward` or `death`.
  Small pulses are rate-limited, and missing hardware is harmless.
- `setHapticsEnabled(false)` disables physical feedback without changing play.

The bridge combines document visibility with native lifecycle events and
deduplicates transitions. It removes only listeners it registered. The web
fallback uses visibility events and optional `navigator.vibrate`.

## Accounts and shared links

Keep Capacitor's configured origins stable: Android uses `https://localhost`,
and iOS uses `capacitor://localhost`. Local records and the existing account key
are scoped to that origin. A web install's local records do not automatically
move into a native app; the existing account code can connect those devices.

`netlify/lib/auth.mjs` admits those two exact origins and the Vite origin
`http://localhost:5173`, alongside the existing hosted origins. Authentication
still validates the bearer credential on the server. CORS matching remains
exact; no wildcard is added. The current account-code flow does not require an
OAuth redirect or deep link. Native share text must use the public game URL,
never `location.origin`, which would produce a private localhost link.

## Provenance and references

Native project templates are generated by the installed Capacitor CLI and
platform packages. Capacitor is MIT-licensed; preserve its dependency license
notices. Cosmo's own source and assets remain proprietary.

- [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor configuration](https://capacitorjs.com/docs/config)
- [Orientation configuration](https://capacitorjs.com/docs/guides/screen-orientation)
- [Lifecycle and Android Back API](https://capacitorjs.com/docs/apis/app)
- [Haptics API](https://capacitorjs.com/docs/apis/haptics)
- [Capacitor license](https://github.com/ionic-team/capacitor/blob/main/LICENSE)
