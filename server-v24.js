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
let pictureFolders = [];
let selectedDirectory = null;
let destinationFolders = new Map();

async function createDestinationFolder(name) {
  const clean = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
  if (!clean || clean === '.' || clean === '..') throw new Error('Invalid folder name');
  if (clean.length > 80) throw new Error('Folder name is too long');
  const picturesRoot = path.join(photoRoot, 'Pictures');
  await fs.mkdir(picturesRoot, { recursive: true });
  const directory = path.join(picturesRoot, clean);
  if (path.dirname(directory) !== picturesRoot) throw new Error('Invalid folder name');
  try { await fs.mkdir(directory); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Folder name is not available');
  const relative = path.relative(photoRoot, directory);
  return { id: Buffer.from(relative).toString('base64url'), name: clean, location: relative };
}

async function scanDestinationFolders() {
  const picturesRoot = path.join(photoRoot, 'Pictures');
  let entries;
  try { entries = await fs.readdir(picturesRoot, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') return [];
    if (['EACCES','EPERM'].includes(error.code)) throw new Error('Termux cannot read the Pictures folder');
    throw error;
  }
  return entries.filter(e => e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(e => {
    const relative = path.relative(photoRoot, path.join(picturesRoot,e.name));
    return { id: Buffer.from(relative).toString('base64url'), name:e.name, location:relative };
  });
}

async function scanPictureFolders() {
  const results = [], pending = [photoRoot];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) {
      if (['EACCES','EPERM','ENOENT'].includes(error.code)) continue;
      throw error;
    }
    let imageCount = 0;
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (file !== photoRoot && !insidePhotoRoot(file)) continue;
      if (entry.isDirectory()) {
        if (!['.git','node_modules'].includes(entry.name)) pending.push(file);
      } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) imageCount++;
    }
    if (imageCount) {
      const relative = path.relative(photoRoot, directory) || '.';
      results.push({ id: Buffer.from(relative).toString('base64url'), name: path.basename(directory) || path.basename(photoRoot), location: relative, imageCount });
    }
  }
  results.sort((a,b)=>a.location.localeCompare(b.location,undefined,{numeric:true}));
  pictureFolders = results;
  return results;
}

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
    }
  }
  found.sort((a, b) => path.relative(photoRoot, a).localeCompare(path.relative(photoRoot, b), undefined, { numeric: true }));
  photos = new Map(found.map(file => [publicPhoto(file).id, file]));
  return list();
}

async function resolveFolder(id) {
  const relative = Buffer.from(String(id || ''), 'base64url').toString();
  const directory = path.resolve(photoRoot, relative);
  if (directory !== photoRoot && !insidePhotoRoot(directory)) throw new Error('Invalid folder');
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid folder');
  return { relative: relative || '.', directory };
}

async function selectPictureFolder(id) {
  const relative = Buffer.from(String(id || ''), 'base64url').toString();
  const directory = path.resolve(photoRoot, relative);
  if (directory !== photoRoot && !insidePhotoRoot(directory)) throw new Error('Invalid picture folder');
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const found = entries.filter(e => e.isFile() && extensions.has(path.extname(e.name).toLowerCase()))
    .map(e => path.join(directory, e.name))
    .sort((a,b)=>path.basename(a).localeCompare(path.basename(b),undefined,{numeric:true}));
  photos = new Map(found.map(file => [publicPhoto(file).id, file]));
  selectedDirectory = directory;
  return { folder: relative || '.', photos: [...photos.values()].map(publicPhoto) };
}

function list() {
  return { root: path.basename(photoRoot), phoneMode, folders, pictureFolders, photos: [...photos.values()].map(publicPhoto) };
}

function cors(request, response) {
  const origin = request.headers.origin || '';
  if (origin === 'https://chunter-gh.github.io' || origin === 'http://127.0.0.1:3000' || origin === 'http://localhost:3000') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
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

async function setDestination(slot, id) {
  const n = Number(slot);
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error('Destination slot must be 1 through 8');
  const resolved = await resolveFolder(id);
  destinationFolders.set(String(n), resolved);
  return { slot: String(n), folder: resolved.relative, name: path.basename(resolved.directory) || resolved.relative };
}

async function sortPhoto(id, folder) {
  if (typeof id !== 'string' || !photos.has(id)) return { error: 'Photo is no longer in the queue', status: 404 };
  if (!/^[1-8]$/.test(String(folder))) return { error: 'Choose destination slot 1 through 8', status: 400 };
  const source = photos.get(id);
  if (!insidePhotoRoot(source)) return { error: 'Invalid source', status: 400 };
  const sourceInfo = await fs.lstat(source);
  if (!sourceInfo.isFile()) return { error: 'Source is no longer a regular file', status: 400 };
  let targetDirectory;
  if (phoneMode) {
    const chosen = destinationFolders.get(String(folder));
    if (!chosen) return { error: 'Assign a destination folder to slot '+folder+' first', status: 400 };
    targetDirectory = chosen.directory;
    const info = await fs.lstat(targetDirectory);
    if (!info.isDirectory() || info.isSymbolicLink() || (targetDirectory !== photoRoot && !insidePhotoRoot(targetDirectory))) return { error: 'Destination folder is not safe', status: 400 };
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
    cors(request, response);
    if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && staticFiles.has(url.pathname)) {
      const [file, type] = staticFiles.get(url.pathname);
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(await fs.readFile(path.join(root, file)));
    } else if (request.method === 'GET' && url.pathname === '/api/photos') {
      json(response, 200, list());
    } else if (request.method === 'POST' && url.pathname === '/api/scan') {
      json(response, 200, await scan());
    } else if (request.method === 'GET' && url.pathname === '/api/picture-folders') {
      json(response, 200, { root: path.basename(photoRoot), folders: pictureFolders });
    } else if (request.method === 'POST' && url.pathname === '/api/scan-picture-folders') {
      json(response, 200, { root: path.basename(photoRoot), folders: await scanPictureFolders() });
    } else if (request.method === 'GET' && url.pathname === '/api/destination-folders') {
      json(response, 200, { root: 'Pictures', folders: await scanDestinationFolders() });
    } else if (request.method === 'POST' && url.pathname === '/api/create-destination-folder') {
      const { name } = await body(request);
      json(response, 200, await createDestinationFolder(name));
    } else if (request.method === 'POST' && url.pathname === '/api/select-picture-folder') {
      const { id } = await body(request);
      json(response, 200, await selectPictureFolder(id));
    } else if (request.method === 'POST' && url.pathname === '/api/set-destination') {
      const { slot, id } = await body(request);
      json(response, 200, await setDestination(slot, id));
    } else if (request.method === 'GET' && url.pathname === '/api/thumbnail') {
      const wanted = (url.searchParams.get('name') || '1.jpg').toLowerCase();
      let file = [...photos.values()].find(f => path.basename(f).toLowerCase() === wanted);
      if (!file) {
        const direct = path.join(photoRoot, wanted);
        try {
          const stat = await fs.lstat(direct);
          if (stat.isFile() && insidePhotoRoot(direct)) file = direct;
        } catch {}
      }
      if (!file || !insidePhotoRoot(file)) return json(response, 404, { error: 'Thumbnail not found' });
      const stat = await fs.lstat(file);
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(await fs.readFile(file));
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
server.listen(port, host, async () => {
  console.log(`Pic Flip Sorter V24 Termux is ready at http://${host}:${port}`);
  if (phoneMode) {
    try {
      const found = await scanPictureFolders();
      console.log(`V24 found ${found.length} folders containing pictures under ${photoRoot}`);
    } catch (error) { console.error('V24 picture-folder scan failed:', error.message); }
  }
});