# Pics

A local photo sorter. It can run on a computer or on an Android phone with Termux. Photos stay on the device running the server.

## Android phone test with Termux

This mode scans only picture files directly inside your chosen test folder. Its direct child folders become the destination buttons. Sorting moves a picture into the chosen child folder. Use copied test pictures first.

1. In Termux, allow shared-storage access:
   `termux-setup-storage`
   Accept Android's permission prompt.
2. Install Node.js and Git:
   `pkg update`
   `pkg install nodejs-lts git`
3. Download the PICS project:
   `cd ~`
   `git clone https://github.com/chunter-gh/pics.git`
   `cd pics`
4. Start the sorter pointed at the test folder:
   `PHOTO_ROOT="$HOME/storage/shared/DCIM/__apictest" npm start`
5. Open Chrome on the same phone and visit `http://127.0.0.1:3000`.

If Termux says it cannot read the folder, run `termux-setup-storage` again and make sure Android granted Termux file access. Keep the server running in Termux while using the page. Stop it with Ctrl+C.

For this test, put copied pictures directly inside `DCIM/__apictest` and make the five destination folders directly inside it. The app ignores files already inside those destination folders, so each sorted picture drops out of the queue.

## Computer mode

1. Put photos in this project folder or its subfolders. Do not put personal photos into this public GitHub repository. Keep them only in your local copy.
2. Install Node.js 20 or newer.
3. In this folder, run `npm start`.
4. Open `http://localhost:3000` on that computer. To use a phone on the same trusted Wi-Fi, set `HOST=0.0.0.0` before starting, then open the computer's local IP address on port 3000.

Computer mode scans JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC and HEIF. The default destinations live in `Sorted/`. Flick the centered picture toward a folder or tap it. Sorting moves the original file, and if a name already exists the app adds a number.

## Files

- `index.html` — screen
- `style.css` — layout and animation
- `app.js` — gestures and queue
- `server.js` — local scan, preview and moves
