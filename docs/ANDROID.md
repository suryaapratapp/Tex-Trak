# Android app

The Android app is the same Tex-Trak web app, packaged with Capacitor. It talks to the same Supabase project, so curtains installed on a phone appear in the web app and the other way round.

**Install:** on the phone, open the web app and tap **Download the mobile app** (sign-in page, Home page and the side menu), or copy `Tex-Trak.apk` across. Then open it, open it, and allow "install unknown apps" for the app you opened it from (Files, Chrome, etc.). Sign in with the account the administrator gave you. The first time you scan, allow the camera.

## Rebuild

Needs JDK 21 and the Android SDK (platform 36, build-tools 36).

```bash
cd app && npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```

The release build is unsigned. Sign it with your own keystore (kept outside the repository, never committed):

```bash
BT=$ANDROID_HOME/build-tools/36.0.0
$BT/zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
$BT/apksigner sign --ks <your.jks> --out app/public/downloads/Tex-Trak.apk aligned.apk
```

The signed file goes in `app/public/downloads/Tex-Trak.apk`, which is what the download link serves. Raise `versionCode` and `versionName` in `app/android/app/build.gradle` and `APK_VERSION` in `app/src/components/DownloadApp.tsx` for each release.

Keep the same keystore for every release, or phones will refuse to update over the old app.

## Offline

- **Scanning offline:** Install, Take down and Register work with no signal. The phone checks each scan against the curtain list it last downloaded, shows the result at once, saves it, and sends it when the connection returns (every 20 seconds, when the network comes back, and when the app is reopened). Each saved scan carries its own id and the time it happened, so nothing is counted twice and the history keeps the true time.
- **Strip at the top:** shows "You are offline" or "Sending N scans", and turns red if the server refused a scan (for example the curtain was installed elsewhere in the meantime). Tap it to see every scan, with Try again / Remove.
- **Signing in offline:** a phone that has signed in once stays signed in, so it opens with no signal. The first sign-in on a phone needs a connection. A quick PIN (optional) locks the app and unlocks it offline; five wrong tries require a full sign-in.
- **Needs a connection:** generating labels, importing locations and changing the label format.

## Location

On first sign-in the app asks permission, then records the phone's location, including with the screen off, and shows a persistent notification while it does. The phone appears in **Super Admin → Trackers** (kind "Phone") named after the signed-in username; if someone else signs in on the same phone it is renamed. Movement shows on **Live map**. Points are saved on the phone and sent when there is signal.

For reliable background tracking set the app's battery use to "Unrestricted" in Android settings. Tracking starts when the app is opened and runs until sign-out; if Android closes the app, it resumes the next time it is opened.

## Notes

- Printing label sheets is done from the web app on a computer.
- Support: surya@circai.co.uk
