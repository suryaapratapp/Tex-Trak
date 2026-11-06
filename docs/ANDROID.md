# Android app

The Android app is the same Tex-Trak web app, packaged with Capacitor. It talks to the same Supabase project, so curtains installed on a phone appear in the web app and the other way round.

**Install (Synergy):** copy `Tex-Trak-Synergy.apk` to the phone, open it, and allow "install unknown apps" for the app you opened it from (Files, Chrome, etc.). Sign in with the account the administrator gave you. The first time you scan, allow the camera.

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
$BT/apksigner sign --ks <your.jks> --out Tex-Trak-Synergy.apk aligned.apk
```

Keep the same keystore for every release, or phones will refuse to update over the old app.

## Notes

- Needs a connection. There is no offline mode yet.
- Printing label sheets is done from the web app on a computer.
- Support: surya@circai.co.uk
