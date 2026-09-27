# Eng Forever mobile

The web app remains the source of truth. GitHub Pages continues to serve the root files exactly as before. Android is an additional Capacitor shell built from the same `index.html`, `app.js`, `styles.css` and `data/`.

## Architecture

- Web: root files -> GitHub Pages.
- Android: `npm run build:mobile` copies the same web app to generated `www/`, adds only the native update runtime, then Capacitor packages it.
- Native release: manual **Build Android release** workflow -> signed APK + signed AAB.
- Web-only mobile release: manual **Publish mobile web update** workflow -> immutable ZIP in GitHub Releases + `mobile-updates` branch manifest.
- The Android app checks that manifest before allowing the training UI to start. If a mandatory web update exists, the UI remains blocked until download and activation finish.
- After a successful OTA restart, a top notice says which mobile web version was installed and can show the release note entered in the workflow.

## One-time signing setup

Never commit a keystore to the repository.

Create these repository secrets under **Settings -> Secrets and variables -> Actions -> New repository secret**:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep an offline backup of the original keystore and passwords. Directly distributed APK updates must keep the same application ID (`com.alexaxel.engforever`) and signing key.

## Build a signed APK and Google Play AAB

Open **Actions -> Build Android release -> Run workflow**.

- `version_name`: semantic native/mobile version, initially `1.0.0`.
- `publish_release`: normally off while testing. Turn on to also put the files in GitHub Releases.
- `release_notes`: optional.

The workflow creates:

- `EngForever-<version>.apk` — direct Android installation.
- `EngForever-<version>.aab` — Google Play upload artifact.
- `SHA256SUMS.txt`.

The Android `versionCode` increases automatically from the workflow run number.

## Publish a web-only mobile update without a new APK

Use this only when native dependencies / Android code do not need to change.

Open **Actions -> Publish mobile web update -> Run workflow**.

- `version`: must be a new, higher semver, e.g. `1.0.1`.
- `notes`: short user-facing message, e.g. `Добавлены новые фразы A1`.
- `min_native_version`: normally `1.0.0` until the native shell actually changes.

The workflow builds the current `main`, packages a Capacitor-Updater-compatible ZIP, creates an immutable GitHub Release, calculates SHA-256, and only then moves the `mobile-updates` manifest to the new version.

Installed apps fetch that manifest on launch. If an update is announced, training stays blocked while it downloads and activates. If no update is announced, the last installed bundle starts normally. If the device is offline and no previously announced mandatory update is pending, the installed version remains usable.

## When a new APK is required

Create a new native build when changing Capacitor itself, native plugins, Android permissions/configuration, package/application ID, or other native code. Ordinary changes to phrases, HTML, CSS and application JavaScript can use the web-only mobile update flow.

Google Play-distributed builds should use Google Play's normal native app update mechanism for native changes. OTA is limited to the interpreted web layer.
