# iPhone and iPad app

The iOS app is the same Tex-Trak web app packaged with Capacitor (project in `app/ios`), with the same camera scanning, offline queue and background location as Android. Bundle id: `uk.co.circai.textrak`.

**Status:** the project is set up and the permission texts (camera, location, background location) are in place. It has **not yet been built or tested on a device**, because that needs a Mac with full Xcode and an Apple Developer account (paid, about £79 a year). Until then the website shows the iPhone button as "Coming soon".

## Build and publish

1. Install Xcode from the App Store, then `sudo xcode-select -s /Applications/Xcode.app`.
2. `cd app && npm run build && npx cap sync ios && npx cap open ios`.
3. In Xcode: select the **App** target, **Signing and Capabilities**, choose your Apple team. Under **Background Modes** tick *Location updates*.
4. Choose **Any iOS Device**, then **Product, Archive, Distribute App, App Store Connect**.
5. In App Store Connect, add the build to **TestFlight** (quickest, no review for internal testers) or submit it for the App Store.
6. Put the public TestFlight or App Store link in `IOS_URL` in `app/src/components/DownloadApp.tsx`. The website button then becomes active.

Raise the version and build number in Xcode for every upload.

## Notes

- Android and iPhone downloads are separate entries on the sign-in page, Home page and side menu. Phones show their own platform in the side-menu link.
- iOS can pause background location if the user chooses "While using the app". Ask users to choose **Always**.
- Support: surya@circai.co.uk
