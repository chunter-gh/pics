# Pics

Pics is a browser-only photo sorter. It opens a folder you choose, shows each picture in the middle, and lets you flick it toward a destination folder or tap that folder. Photos are processed in the browser on your device; the page does not upload them.

## Open Pics on your Android phone

The browser folder picker needs a secure web page. Turn on GitHub Pages for this repository:

1. Open the repository's **Settings**, then **Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Set the branch to **main** and the folder to **/(root)**, then save.
4. After GitHub publishes it, open https://chunter-gh.github.io/pics/ in Chrome on your phone.

## Try the safe test folder

1. Keep the five copied pictures directly inside DCIM/__apictest.
2. Keep your five destination folders directly inside DCIM/__apictest.
3. In Pics, tap **Choose test folder**. In Android's folder picker, choose DCIM, then __apictest.
4. Grant the browser read and write access when it asks.
5. Flick a picture toward a folder, or tap a folder. Pics copies it to that folder, then removes the original from the test folder. If the destination already has a file with that name, Pics adds a number to the new copy.
6. Use **Scan again** to reload the folder and revisit pictures you skipped.

The app scans picture files directly inside the folder you selected. Its immediate subfolders become destination buttons and are not scanned as source folders. Supported formats include JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC and HEIF. Some formats may not preview in Chrome, but can still be sorted.

## Files

- index.html — page
- style.css — layout and animation
- app.js — folder access, preview, flicking and sorting
- server.js — optional local web server for testing
