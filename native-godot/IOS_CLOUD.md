# Cosmo on iPhone and iPad without owning a Mac

You can keep developing on Windows or Linux. GitHub's hosted Mac can perform
the Xcode build; you do not need a personal Mac. Godot's iOS exporter still
requires macOS, Xcode and matching export templates. The prepared workflow uses
the `macos-26` runner and pinned Godot **4.7.2**, retaining bundle identifier
**`app.cosmo.arcade`** for both iPhone and iPad.
[Godot iOS export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html),
[GitHub hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

**Status, 2026-09-07:** workflow and script prepared; shell syntax checked locally.
No macOS export, Xcode archive, signing, Apple upload or device test has run.
This is build preparation, not an installable iPhone release. The Windows native
build and its tests do not establish iOS performance or touch/audio behavior.

## First cloud export

1. Use your actual Apple Developer Team ID, the ten-character identifier from
   your account. Godot requires it even for a project-only export. No team ID or
   signing identity is fabricated in the repository.
2. After you choose to put these changes on GitHub, open **Actions → Godot iOS
   cloud build (manual) → Run workflow**. Select the intended branch, supply the
   Team ID and a positive build number, and leave output as **xcode_project**.
   This workflow has no push or pull-request trigger.
3. Download the resulting artifact. `Cosmo-Xcode-project.zip` contains the
   exported project, game pack and engine framework. Keep them together.
   `BUILD-INFO.txt` records the commit, engine, Xcode and build number. This
   project ZIP cannot be installed on an iPhone.

The script verifies official release checksums and downloads about 1.35 GB on
the cloud runner for the editor and templates. It stages a fresh project copy,
uses the existing approved 1024px Cosmo app icon, and leaves the checkout and
Windows export preset unchanged.
[Pinned Godot release assets](https://github.com/godotengine/godot-builds/releases/expanded_assets/4.7.2-stable).

## Signed archive for TestFlight

TestFlight distribution requires Apple Developer Program membership, an App
Store Connect app record using `app.cosmo.arcade`, an Apple Distribution
certificate with its private key, and an App Store distribution provisioning
profile for that exact app and team. Account registration and certificate/profile
management can be done in a browser. A signing request and `.p12` can also be
created with OpenSSL on Linux or Windows; keep the private key private.
[Membership benefits](https://developer.apple.com/programs/),
[Apple signing certificates](https://developer.apple.com/help/account/certificates/certificates-overview).

Add these repository Actions secrets using **Settings → Secrets and variables →
Actions**. The profile and certificate must be Base64-encoded before saving.

| Secret | Value |
| --- | --- |
| `COSMO_IOS_CERTIFICATE_BASE64` | Distribution `.p12`, including its private key |
| `COSMO_IOS_CERTIFICATE_PASSWORD` | Password protecting that `.p12` |
| `COSMO_IOS_PROFILE_BASE64` | App Store `.mobileprovision` for `app.cosmo.arcade` |

Run the same manual workflow with output **signed_archive**. It checks the
profile's team, exact app ID, distribution type and expiry; imports the signing
material into a temporary keychain; then asks Xcode to archive and verifies the
resulting signature. Missing secrets fail the signed mode before downloading
the engine. Secrets are neither printed nor uploaded as artifacts. The runner
is ephemeral and the script removes its temporary signing files and keychain.
GitHub documents this certificate/profile approach for hosted Mac runners.
[GitHub signing guide](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications).

The additional artifact is `Cosmo-signed-archive.zip`, containing an
`.xcarchive`. **The workflow stops at the archive. It does not export an IPA,
upload to Apple or invite testers.** For the subsequent cloud upload, configure
App Store Connect API credentials and a separately authorized manual upload
step on the hosted Mac. That step must export the archive for App Store Connect
and submit it using Apple's supported upload tooling/API. An archive downloaded
to Windows does not itself appear in TestFlight. This upload step is still to
be implemented and validated with the owner's account.
[Apple build-upload methods](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

After Apple processes the uploaded build, complete the required app/export
compliance information, assign internal testers, and install through TestFlight
on the iPhone/iPad. External testing may require Beta App Review. Increment the
build number for subsequent uploads. Before inviting wider testers, verify real
device touch controls, interruptions/background resume, audio, frame rate and
battery behavior.
[Apple TestFlight workflow](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview).

The implementation is in `../.github/workflows/godot-ios.yml`,
`tools/export_ios.sh` and the **iOS Cloud Project** export preset. The signing
archive path is prepared from official interfaces but remains untested until
the first authorized run with valid account credentials.
