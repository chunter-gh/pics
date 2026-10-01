# Termux Pics — current Android test

The Chrome directory-picker version is preserved in `archive/chrome-html-picker/`.

## One-time Termux setup

```sh
pkg install nodejs git
termux-setup-storage
```

Grant the Android storage permission when prompted.

## Get/update Pics

```sh
cd ~
git clone https://github.com/chunter-gh/pics.git
cd pics
```

If already cloned:

```sh
cd ~/pics
git pull
```

## Run the test folder

Current test root:

```
/storage/emulated/0/DCIM/__atestpic
```

Start Pics:

```sh
cd ~/pics
PHOTO_ROOT=/storage/emulated/0/DCIM/__atestpic node server.js
```

Then open Chrome on the same phone at:

```
http://127.0.0.1:3000
```

Pics now uses Termux/Node for filesystem access. The browser no longer asks Chrome to choose a directory.

Destination folders are the direct child folders inside `__atestpic`. The scan recursively finds supported pictures below the selected root and the sorter moves a picture into the destination folder you flick/tap.

Stop the server in Termux with **Ctrl+C**.
