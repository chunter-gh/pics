# Termux Pics Test

This is the new Android-first test path.

Goal: serve and display one real file from DCIM/__atestpic through the local Node server before rebuilding sorting.

Termux photo root:
/storage/emulated/0/DCIM/__atestpic

Start command (after Node and repo are available in Termux):
PHOTO_ROOT=/storage/emulated/0/DCIM/__atestpic node server.js

Then open in Chrome:
http://127.0.0.1:3000

The existing server.js already exposes /api/scan, /api/photo, and /api/sort using Node filesystem access.
