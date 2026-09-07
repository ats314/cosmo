# Native packaging: what `native:sync` produces, and what it does not

*What this answers: exactly what Capacitor generates, what evidence exists that
the Android app compiles, and which claims about a "native release" are not
supported by anything in this repository.*

## The configuration

`capacitor.config.ts` (29 lines):

| Key | Value |
|---|---|
| `appId` | `app.cosmo.arcade` |
| `appName` | `Cosmo` |
| `webDir` | `dist` |
| `backgroundColor` | `#030712` (repeated for `android` and `ios`) |
| `loggingBehavior` | `debug` |
| `server.hostname` | `localhost` |
| `server.androidScheme` | `https` → the Android WebView origin is `https://localhost` |
| `server.iosScheme` | `capacitor` → the iOS WebView origin is `capacitor://localhost` |
| `server.cleartext` | `false` |
| `android.allowMixedContent` | `false` |
| `ios` | `contentInset: 'never'`, `scrollEnabled: false`, `preferredContentMode: 'mobile'` |

There is **no `server.url`**. `docs/invariants.md:119-120` makes that a rule,
and the file's own comment says why the two origins must stay stable: local
records (`localStorage`, `cometloop:` keys) and the stored account key are
scoped to the WebView origin, so changing a scheme signs every native player
out and loses their local records.

Those same two origins are two of the seven entries in the server's CORS
allowlist (`netlify/lib/auth.mjs:40-48`), which is what lets a bundled native
app reach the optional account service at all.

## The command

`package.json:14`: `"native:sync": "npm run build && cap sync"` — build first,
then copy. `cap sync` copies `dist/` into both platforms and refreshes plugin
references for `@capacitor/app` 8.1.1 and `@capacitor/haptics` 8.0.2.
`docs/engine/native.md` says to repeat it after changing the game, assets,
configuration or plugins, and `docs/invariants.md:121-122` makes "synchronize
after the final web build" a rule.

The copied web output is **not** in Git: `android/.gitignore` ignores
`app/src/main/assets/public`, `app/src/main/assets/capacitor.config.json`,
`app/src/main/assets/capacitor.plugins.json` and `app/src/main/res/xml/config.xml`;
`ios/.gitignore` ignores `App/App/public`, `App/App/capacitor.config.json` and
`App/App/config.xml`. Build outputs, `local.properties`, `*.jks`/`*.keystore`
and `keystore.properties` are ignored too. Gradle's wrapper (`gradlew`,
`gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar` and `.properties`) **is**
checked in.

## Android

Checked-in project shape: `android/variables.gradle` sets `minSdkVersion 24`,
`compileSdkVersion 36`, `targetSdkVersion 36`. `android/build.gradle` pins AGP
`com.android.tools.build:gradle:8.13.0`. The wrapper is Gradle `8.14.3`
(`gradle-wrapper.properties`). `android/app/build.gradle` sets namespace and
`applicationId` to `app.cosmo.arcade`, `versionCode 1`, `versionName "1.0"`,
and `minifyEnabled false` on release.

`AndroidManifest.xml` declares one activity, `android:screenOrientation="portrait"`,
`launchMode="singleTask"`, a `configChanges` list that includes `orientation`
and `screenSize`, an `androidx.core.content.FileProvider`, and exactly one
permission: `android.permission.INTERNET`. `docs/engine/native.md` warns that
large-screen Android can override the orientation restriction, so the layout
must still fit a wide window.

**There is real compilation evidence, and it comes from CI, not from this
checkout.** `.github/workflows/android.yml` runs on every push to `main` and on
manual dispatch: Ubuntu runner, Node 24, Temurin JDK 21,
`sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0"`,
`npm ci`, `npm run build`,
`node node_modules/@capacitor/cli/bin/capacitor sync android`, then
`bash ./gradlew --no-daemon --stacktrace :app:assembleDebug` from `android/`.
It uploads `android/app/build/outputs/apk/debug/app-debug.apk` as artifact
`cosmo-android-debug-<github.sha>` with `if-no-files-found: error` and
`retention-days: 14`, under a 30-minute timeout.

That artifact is signed by Android's ordinary debug key. It is not a release
build, carries no owner signing secrets, and is not a store upload. Because
independent CI runs may use different debug keys, an older test install may
have to be removed before a later artifact will install.

Two details worth keeping: the workflow invokes the Capacitor CLI as
`node node_modules/@capacitor/cli/bin/capacitor` rather than `npx cap`, and it
runs the wrapper as `bash ./gradlew` — the comment says why: *"bash also works
when a Windows checkout committed the wrapper as 0644"*, i.e. the executable
bit did not survive this repository's Windows origin.

## iOS

Capacitor 8 uses Swift Package Manager. `ios/App/CapApp-SPM/Package.swift`
targets `.iOS(.v15)` and pins `capacitor-swift-pm` to exactly `8.5.1`, with
`CapacitorApp` and `CapacitorHaptics` resolved from `node_modules` by relative
path — so the iOS project cannot resolve without an `npm ci` first.

`ios/App/App/Info.plist` sets `CFBundleDisplayName` to `Cosmo`,
`UISupportedInterfaceOrientations` and `UISupportedInterfaceOrientations~ipad`
to portrait only, and `UIRequiresFullScreen` true — iPad honours an orientation
lock only in full screen.

**No iOS binary evidence exists anywhere in this repository.** There is no iOS
workflow. `docs/engine/native.md` is explicit: Windows can prepare project files
and bundled assets, and *"Generated project files are not evidence of a
successful native build."* Signing requires the owner's development team set in
Xcode 26 or newer on macOS.

## The runtime side of "native"

`src/platform/native.ts` (94 lines) has no dependency on scenes or gameplay —
it takes three callbacks. `installNativeBridge({pause, resume, back})` combines
`document.visibilitychange` with Capacitor's `appStateChange`, `pause` and
`resume` listeners into one `publish()` that deduplicates transitions
(`active === wasActive` returns early), and binds `backButton` to
`callbacks.back()` falling through to `App.minimizeApp()`. It returns a disposer
that removes only the listeners it registered. Plugin bindings go through
`Promise.allSettled`, so a missing plugin cannot break startup.

`CosmoScene` installs it in `create()` and disposes it in `shutdown()`
(`src/scenes/CosmoScene.ts:63-68`, `:108`), with a race guard: if the scene was
already disposed when the promise resolves, the disposer is called immediately.

`haptic(kind)` accepts `tap | hop | pickup | impact | reward | death`, maps
`reward`/`death` to `Haptics.notification` and everything else to
`Haptics.impact` (Heavy for `impact`, Medium for `hop`, Light otherwise), and
rate-limits to one pulse per 65 ms unless the new pulse outranks the last
(`death` 3 > `impact`/`reward` 2 > everything 1). The web fallback is
`navigator.vibrate` with per-kind durations of 55/35/24/12/7 ms. It is skipped
entirely when the app is backgrounded or the document is hidden.

`setHapticsEnabled(enabled)` is exported and documented
(`docs/engine/native.md:98`) but **called from nowhere in this repository** —
the game has no control that turns haptics off.

## Summary of what native sync does not give you

- not an APK (CI's `assembleDebug` gives you one; `cap sync` does not)
- not a signed or release-keyed build of either platform
- not an iOS binary, and no evidence one has ever compiled
- not a device test
- not a hosted game: the shell loads bundled assets and must open its title
  screen with no network, with sign-in and leaderboards allowed to report
  offline status but never to block a local run
