import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const photoRoot = path.resolve(process.env.PHOTO_ROOT || root);
const phoneMode = Boolean(process.env.PHOTO_ROOT);
const sortedRoot = path.join(root, 'Sorted');
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif']);
const mime = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
  '.tif': 'image/tiff', '.tiff': 'image/tiff', '.avif': 'image/avif',
  '.heic': 'image/heic', '.heif': 'image/heif'
};
const defaultFolders = ['Keep', 'Family', 'Friends', 'Trips', 'Pets', 'Screenshots', 'Documents', 'Later'];
let folders = defaultFolders;
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);
let photos = new Map();

function isInside(base, file) {
  const relative = path.relative(base, file);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function insideRoot(file) { return isInside(root, file); }
function insidePhotoRoot(file) { return isInside(photoRoot, file); }

function publicPhoto(file) {
  const relative = path.relative(photoRoot, file);
  return {
    id: Buffer.from(relative).toString('base64url'),
    name: path.basename(file),
    location: relative,
    previewable: !['.tif', '.tiff', '.heic', '.heif'].includes(path.extname(file).toLowerCase())
  };
}

async function scan() {
  if (phoneMode) {
    try {
      const entries = await fs.readdir(photoRoot, { withFileTypes: true });
      folders = entries
        .filter(entry => entry.isDirectory() && /^[a-zA-Z0-9 _-]+$/.test(entry.name))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error('Termux cannot read this folder yet. Run termux-setup-storage and grant file access.');
      }
      throw error;
    }
    if (!folders.length) throw new Error('Create destination folders directly inside the selected photo folder, then scan again.');
  } else {
    folders = defaultFolders;
  }
  const found = [];
  const pending = [photoRoot];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'ENOENT') continue;
      throw error;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (!insidePhotoRoot(file)) continue;
      if (entry.isDirectory()) {
        if (!phoneMode && file !== sortedRoot && !['.git', 'node_modules'].includes(entry.name)) pending.push(file);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        found.push(file);
      }
      // Dirent symlinks are deliberately ignored, even when they point inside root.
    }
  }
  found.sort((a, b) => path.relative(photoRoot, a).localeCompare(path.relative(photoRoot, b), undefined, { numeric: true }));
  photos = new Map(found.map(file => [publicPhoto(file).id, file]));
  return list();
}

function list() {
  return { root: path.basename(photoRoot), phoneMode, folders, photos: [...photos.values()].map(publicPhoto) };
}

function json(response, code, value) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 4096) throw new Error('Request is too large');
  }
  return JSON.parse(raw || '{}');
}

async function sortPhoto(id, folder) {
  if (typeof id !== 'string' || !photos.has(id)) return { error: 'Photo is no longer in the queue', status: 404 };
  if (!folders.includes(folder) || path.basename(folder) !== folder) return { error: 'Choose one of the available destination folders', status: 400 };
  const source = photos.get(id);
  if (!insidePhotoRoot(source)) return { error: 'Invalid source', status: 400 };
  const sourceInfo = await fs.lstat(source);
  if (!sourceInfo.isFile()) return { error: 'Source is no longer a regular file', status: 400 };
  let targetDirectory;
  if (phoneMode) {
    targetDirectory = path.join(photoRoot, folder);
    try {
      const info = await fs.lstat(targetDirectory);
      if (!info.isDirectory() || info.isSymbolicLink() || path.dirname(targetDirectory) !== photoRoot) {
        return { error: 'Destination folder is not a safe child folder', status: 400 };
      }
    } catch (error) {
      if (error.code === 'ENOENT') return { error: 'Destination folder no longer exists; scan again', status: 404 };
      throw error;
    }
  } else {
    for (const directory of [sortedRoot, path.join(sortedRoot, folder)]) {
      try {
        const info = await fs.lstat(directory);
        if (!info.isDirectory() || info.isSymbolicLink()) return { error: 'Sorted folder is not a safe directory', status: 400 };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await fs.mkdir(directory);
      }
    }
    targetDirectory = path.join(sortedRoot, folder);
  }
  const original = path.basename(source);
  const extension = path.extname(original);
  const stem = original.slice(0, -extension.length);
  let destination;
  for (let suffix = 0; ; suffix++) {
    destination = path.join(targetDirectory, suffix ? `${stem} (${suffix})${extension}` : original);
    try {
      await fs.stat(destination);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  await fs.rename(source, destination);
  photos.delete(id);
  return { movedTo: path.relative(photoRoot, destination), remaining: photos.size };
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && staticFiles.has(url.pathname)) {
      const [file, type] = staticFiles.get(url.pathname);
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(await fs.readFile(path.join(root, file)));
    } else if (request.method === 'GET' && url.pathname === '/api/photos') {
      json(response, 200, list());
    } else if (request.method === 'POST' && url.pathname === '/api/scan') {
      json(response, 200, await scan());
    } else if (request.method === 'GET' && url.pathname === '/api/photo') {
      const file = photos.get(url.searchParams.get('id'));
      if (!file || !insidePhotoRoot(file)) return json(response, 404, { error: 'Photo not found' });
      const stat = await fs.lstat(file);
      if (!stat.isFile()) return json(response, 404, { error: 'Photo not found' });
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file).toLowerCase()],
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(await fs.readFile(file));
    } else if (request.method === 'POST' && url.pathname === '/api/sort') {
      const { id, folder } = await body(request);
      const result = await sortPhoto(id, folder);
      json(response, result.status || 200, result);
    } else {
      json(response, 404, { error: 'Not found' });
    }
  } catch (error) {
    console.error(error);
    json(response, 500, { error: error.message || 'Unexpected error' });
  }
});

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => console.log(`Pics is ready at http://${host}:${port}`));
