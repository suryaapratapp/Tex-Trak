# iPhone and iPad

**Free route (in use):** Tex-Trak installs on iPhone and iPad as a web app, with no Apple account, no App Store and no cost.

1. Open the Tex-Trak website in **Safari** on the iPhone or iPad.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Tex-Trak from the Home Screen. It runs full screen with its own icon.

The sign-in page, Home page and side menu all have a **Download the mobile app** card with separate **Android** and **iPhone and iPad** entries. The iPhone entry opens these steps.

How it works: `app/public/manifest.webmanifest`, the icons in `app/public` (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) and the meta tags in `app/index.html` make the site installable. The card is hidden once the app is already running from the Home Screen.

## What works and what does not on iPhone

| Feature | Home Screen web app |
|---|---|
| Sign in, all pages, maps, Warehouse | Yes |
| QR and barcode scanning with the camera | Yes (iOS 16.4 or newer) |
| Saved scans sent later when signal returns | Yes, while the app is open |
| Location | Only while the app is open on screen |
| Tracking with the screen off | No. Use an Android phone or a hardware tracker |

## Optional later: a store app

A native App Store app is not needed for the above. If one is wanted later (for background location or store listing), the Capacitor project is already prepared in `app/ios` (bundle id `uk.co.circai.textrak`, with camera and location texts). It would need a Mac with Xcode and an Apple Developer account, which is a paid programme. When a TestFlight or App Store link exists, set `IOS_URL` in `app/src/components/DownloadApp.tsx` and the iPhone button opens it instead of the steps.

Support: surya@circai.co.uk
