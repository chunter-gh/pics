# Pics

A local photo sorter. Run it on the computer or device that holds your photos. It scans **only this project folder and its descendants**; it does not search parent folders, follow directory symlinks, or read outside the project.

## Start

1. Put photos in this folder or in subfolders below it (for example, `Inbox/2024`). Do not put personal photos into this public GitHub repository. Keep them only in your local copy.
2. Install Node.js 20 or newer.
3. In this folder, run `npm start`.
4. Open `http://localhost:3000` on that computer. To use a phone on the same trusted Wi-Fi, in PowerShell run `$env:HOST='0.0.0.0'; npm start` (or on macOS/Linux run `HOST=0.0.0.0 npm start`), then open the computer's local IP address on port 3000. Keep the server on a trusted private network.

Press **Scan photos** to search below this folder. The app scans JPG, JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC and HEIF. Most browsers preview JPG, PNG, WebP, GIF and AVIF; TIFF and HEIC/HEIF may show a file-name placeholder, but you can still sort them. The default destinations live in `Sorted/`. Scan skips files already inside `Sorted/` so they do not reappear in the queue.

Flick the centered picture toward one of eight folders or tap a folder. Sorting **moves** the original file into `Sorted/<folder>/`; it is not deleted. If a name already exists there, Pics adds a number to the new name. Use **Skip** to leave a file where it is. The browser alone cannot silently read your phone's photo library; this first version works with files available under the local project's folder.

## Files

- `index.html` — screen
- `style.css` — layout and animation
- `app.js` — gestures and queue
- `server.js` — local scan, preview and moves
