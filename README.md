# A-Pic Test

A-Pic Test is a native Android photo sorter. The Android app is in `android/`; it asks you to select a folder with Android's system folder picker, previews each image, and sorts it into one of the selected folder's immediate subfolders. It copies first, then removes the original only after the copy finishes. **Try it with copies of photos first.**

## Get the Android app

Every change to the Android project starts a GitHub Actions build. When the **Build A-Pic Test Android APK** workflow finishes:

1. Open this repository on GitHub and tap **Actions**.
2. Open the latest successful **Build A-Pic Test Android APK** run.
3. Under **Artifacts**, download **A-Pic-Test-debug-apk** and unzip it.
4. On your Android phone, open `app-debug.apk`. If Android asks, allow installation from the browser or file manager you used to open it, then tap **Install**.
5. Launch **A-Pic Test**, tap **Choose test folder**, select `DCIM/__apictest`, and grant the folder access prompt.

The APK is a debug build for direct testing. It is not signed for Play Store release.

## Test folder

Use `DCIM/__apictest` with copied images directly inside and destination folders `1` through `5` beside them. The app reads only images directly inside the selected folder; its immediate child folders are destination buttons. A successful sort copies the image into the selected folder, then deletes its original from the selected test folder. If a name already exists, it chooses a numbered copy name. The app includes Skip and Undo last move.

Supported filename extensions: JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC, and HEIF. Preview support depends on the Android version and image decoder; the app reports when Android cannot decode a preview.

## Build locally

Install JDK 17 and Android SDK platform 35, then run `gradle assembleDebug` from the repository root. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

The repository also retains the earlier browser prototype in the root `index.html`, `app.js`, and `style.css` files.
