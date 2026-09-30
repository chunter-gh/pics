const chooseButton = document.querySelector('#choose');
const scanButton = document.querySelector('#scan');
const skipButton = document.querySelector('#skip');
const photoCard = document.querySelector('#photoCard');
const photoImage = document.querySelector('#photo');
const empty = document.querySelector('#photoEmpty');
const count = document.querySelector('#count');
const rootLabel = document.querySelector('#root');
const filename = document.querySelector('#filename');
const locationLabel = document.querySelector('#location');
const status = document.querySelector('#status');
const folderButtons = [...document.querySelectorAll('.folder')];
const slotClasses = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const layouts = {
  1: ['south'],
  2: ['west', 'east'],
  3: ['north', 'southeast', 'southwest'],
  4: ['north', 'east', 'south', 'west'],
  5: ['north', 'east', 'southeast', 'southwest', 'west'],
  6: ['north', 'northeast', 'east', 'south', 'southwest', 'west'],
  7: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west'],
  8: slotClasses
};
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif']);
let rootHandle = null;
let destinations = new Map();
let queue = [];
let scannedCount = 0;
let skipped = new Set();
let current = null;
let busy = false;
let drag = null;
let previewImageId = null;
let dropPendingId = null;

function message(text) { status.textContent = text; }

function renderFolders(names) {
  const layout = layouts[Math.min(names.length, folderButtons.length)] || slotClasses;
  folderButtons.forEach((button, index) => {
    const position = layout[index];
    button.hidden = index >= names.length || !position;
    if (button.hidden) return;
    button.dataset.folder = names[index];
    button.querySelector('span:last-child').textContent = names[index];
    button.querySelector('.folder-icon').textContent = '▱';
    slotClasses.forEach(name => button.classList.remove(name));
    button.classList.add('folder', position);
    button.setAttribute('aria-label', 'Sort into ' + names[index]);
  });
}

function previewBlob(item) {
  const ext = item.name.slice(item.name.lastIndexOf('.')).toLowerCase();
  const types = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.gif':'image/gif', '.bmp':'image/bmp', '.tif':'image/tiff', '.tiff':'image/tiff', '.avif':'image/avif', '.heic':'image/heic', '.heif':'image/heif' };
  const type = types[ext] || item.file.type || 'application/octet-stream';
  return item.file.type === type ? item.file : new Blob([item.file], { type });
}

function loadPreview(item) {
  previewImageId = item.id;
  const reader = new FileReader();
  reader.onload = () => {
    if (current && current.id === item.id && typeof reader.result === 'string') photoImage.src = reader.result;
  };
  reader.onerror = () => showPreviewFallback(item);
  reader.readAsDataURL(previewBlob(item));
}

function showNext() {
  photoCard.classList.remove('dragging','dropping');
  photoCard.style.transform = '';
  current = queue.find(item => !skipped.has(item.id)) || null;
  const remaining = queue.length - skipped.size;
  count.textContent = queue.length ? remaining + ' to sort · ' + queue.length + ' found' : 'No pictures found';
  filename.textContent = current ? current.name : '';
  locationLabel.textContent = current ? current.name : '';
  skipButton.disabled = !current || busy;
  folderButtons.forEach(button => { button.disabled = !current || busy; });
  photoImage.hidden = true;
  photoImage.removeAttribute('src');
  empty.hidden = !current;

  if (!current) {
    photoCard.classList.remove('dropped');
    dropPendingId = null;
    empty.querySelector('strong').textContent = (queue.length || scannedCount) ? 'All caught up for now' : 'No pictures found';
    empty.querySelector('span').textContent = queue.length ? 'Press Scan again to revisit skipped pictures.' : scannedCount ? 'All pictures are sorted.' : 'Choose DCIM/__apictest to load its pictures.';
      return;
  }

  empty.querySelector('strong').textContent = 'Loading picture preview…';
  empty.querySelector('span').textContent = current.name;
  if (dropPendingId === current.id) {
    photoCard.classList.remove('dropped');
    dropPendingId = null;
  }
  photoImage.alt = current.name;
  loadPreview(current);
  photoImage.hidden = false;

}

async function chooseFolder() {
  if (busy) return;
  if (!window.isSecureContext) {
    message('Open Pics from its HTTPS GitHub Pages address to use phone folder access.');
    return;
  }
  if (!window.showDirectoryPicker) {
    message('This browser does not support folder access. Open this page in Chrome on Android.');
    return;
  }
  try {
    const chosen = await window.showDirectoryPicker({ id: 'pics-test-folder', mode: 'readwrite' });
    const permission = await chosen.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      message('Folder write permission was not granted.');
      return;
    }
    rootHandle = chosen;
    rootLabel.textContent = 'Selected folder: ' + chosen.name;
    scanButton.hidden = false;
    await scan();
  } catch (error) {
    if (error.name === 'AbortError') message('Folder selection cancelled.');
    else message(error.message || 'Could not open that folder.');
  }
}

async function scan() {
  if (busy) return;
  if (!rootHandle) {
    message('Choose DCIM/__apictest first.');
    return;
  }
  busy = true;
  chooseButton.disabled = true;
  scanButton.disabled = true;
  skipButton.disabled = true;
  clearPreviewUrls();
  queue = [];
  scannedCount = 0;
  skipped = new Set();
  destinations = new Map();
  renderFolders([]);
  message('Reading the selected folder…');
  try {
    const permission = await rootHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Chrome needs write permission to sort pictures.');
    const nextQueue = [];
    const nextDestinations = new Map();
    let id = 0;
    for await (const [name, handle] of rootHandle.entries()) {
      if (handle.kind === 'directory') {
        nextDestinations.set(name, handle);
      } else if (handle.kind === 'file') {
        const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
        if (!imageExtensions.has(ext)) continue;
        const file = await handle.getFile();
        nextQueue.push({
          id: String(id++),
          name,
          handle,
          file,
        });
      }
    }
    nextQueue.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    queue = nextQueue;
    scannedCount = nextQueue.length;
    fallbackTried = new Set();
    skipped = new Set();
    destinations = new Map([...nextDestinations.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })));
    renderFolders([...destinations.keys()].slice(0, folderButtons.length));
    rootLabel.textContent = 'Selected folder: ' + rootHandle.name;
    message('Found ' + queue.length + ' picture' + (queue.length === 1 ? '' : 's') + ' and ' + destinations.size + ' destination folders.');
    if (!destinations.size) message('Make destination folders inside this folder, then scan again.');
  } catch (error) {
    message(error.message || 'Could not read the selected folder.');
  } finally {
    busy = false;
    chooseButton.disabled = false;
    scanButton.disabled = !rootHandle;
    showNext();
  }
}

async function unusedName(folderHandle, original) {
  const dot = original.lastIndexOf('.');
  const stem = dot > 0 ? original.slice(0, dot) : original;
  const extension = dot > 0 ? original.slice(dot) : '';
  for (let suffix = 0; suffix < 10000; suffix++) {
    const name = suffix ? stem + ' (' + suffix + ')' + extension : original;
    try {
      await folderHandle.getFileHandle(name);
    } catch (error) {
      if (error.name === 'NotFoundError') return name;
      throw error;
    }
  }
  throw new Error('Too many files with the same name in that folder.');
}

async function sortInto(folderName) {
  if (busy || !current) return;
  const chosen = current;
  const destination = destinations.get(folderName);
  if (!destination) {
    message('That destination folder is no longer available. Scan again.');
    return;
  }
  busy = true;
  skipButton.disabled = true;
  folderButtons.forEach(button => { button.disabled = true; });
  message('Moving ' + chosen.name + ' to folder ' + folderName + '…');

  let targetName = '';
  let targetCreated = false;
  try {
    targetName = await unusedName(destination, chosen.name);
    const target = await destination.getFileHandle(targetName, { create: true });
    targetCreated = true;
    message('Copying ' + chosen.name + ' into folder ' + folderName + '…');
    const writable = await target.createWritable();
    await writable.write(chosen.file);
    await writable.close();

    message('Removing original ' + chosen.name + '…');
    try {
      await rootHandle.removeEntry(chosen.name);
    } catch (error) {
      try { await destination.removeEntry(targetName); targetCreated = false; } catch {}
      if (targetCreated) {
        throw new Error('Chrome copied the picture but could not remove the original. Check both folders before continuing.');
      }
      throw new Error('Chrome could not remove the original, so it was left in place.');
    }

    queue = queue.filter(item => item.id !== chosen.id);
    skipped.delete(chosen.id);
    message('Moved ' + chosen.name + ' into ' + folderName + '.');
  } catch (error) {
    if (targetCreated) {
      try { await destination.removeEntry(targetName); } catch {}
    }
    message('Move failed (' + (error.name || 'error') + '): ' + (error.message || 'Could not move that picture.'));
  } finally {
    busy = false;
    showNext();
  }
}

function direction(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const card = photoCard.getBoundingClientRect();
  const cx = card.left + card.width / 2;
  const cy = card.top + card.height / 2;
  let best = null;
  let smallestGap = Infinity;
  for (const button of folderButtons.filter(item => !item.hidden)) {
    const rect = button.getBoundingClientRect();
    const targetAngle = Math.atan2(rect.top + rect.height / 2 - cy, rect.left + rect.width / 2 - cx);
    const gap = Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle)));
    if (gap < smallestGap) {
      smallestGap = gap;
      best = button.dataset.folder;
    }
  }
  return best;
}

function highlight(folder) {
  folderButtons.forEach(button => button.classList.toggle('active', button.dataset.folder === folder));
}
function folderAtPoint(x,y) {
  const found = folderButtons.find(button => {
    if (button.hidden) return false;
    const rect = button.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  return found ? found.dataset.folder : null;
}

photoImage.addEventListener('load', () => {
  if (!current || current.id !== previewImageId) return;
  photoImage.hidden = false;
  photoCard.classList.remove('dropped');
  dropPendingId = null;
  empty.hidden = true;
});

photoImage.addEventListener('error', () => {
  if (current && current.id === previewImageId) showPreviewFallback(current);
});

function showPreviewFallback(item) {
  if (!current || current.id !== item.id) return;
  photoCard.classList.remove('dropped');
  dropPendingId = null;
  photoImage.hidden = true;
  empty.hidden = false;
  empty.querySelector('strong').textContent = item.name;
  empty.querySelector('span').textContent = 'Chrome could not display this picture. You can still sort it.';
  message('Preview failed for ' + item.name + ' (' + (item.file.type || 'file type not reported') + ').');
}

photoCard.addEventListener('pointerdown', event => {
  if (!current || busy) return;
  const rect = photoCard.getBoundingClientRect();
  drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:rect.left, top:rect.top, width:rect.width, height:rect.height };
  photoCard.setPointerCapture(event.pointerId);
  photoCard.classList.add('dragging');
});

photoCard.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const distance = Math.hypot(dx, dy);
  photoCard.style.transform = 'translate(' + (dx * .64) + 'px, ' + (dy * .64) + 'px) rotate(' + (dx * .012) + 'deg)';
  highlight(folderAtPoint(event.clientX,event.clientY) || (distance > 28 ? direction(dx,dy) : null));
});

function finishDrag(event, commit) {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const distance = Math.hypot(dx,dy);
  const folder = commit ? (folderAtPoint(event.clientX,event.clientY) || (distance > 45 ? direction(dx,dy) : null)) : null;
  const start = drag;
  drag = null;
  highlight(null);
  if (folder) {
    const target = folderButtons.find(button => button.dataset.folder === folder);
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - (start.left + start.width / 2);
    const y = rect.top + rect.height / 2 - (start.top + start.height / 2);
    photoCard.classList.remove('dragging');
    photoCard.classList.add('dropping');
    photoCard.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(.72)';
    window.setTimeout(() => {
      photoCard.classList.remove('dropping');
      photoCard.classList.add('dropped');
      dropPendingId = current ? current.id : null;
      sortInto(folder);
    },180);
  } else {
    photoCard.classList.remove('dragging');
    photoCard.style.transform = '';
  }
}

photoCard.addEventListener('pointerup', event => finishDrag(event, true));
photoCard.addEventListener('pointercancel', event => finishDrag(event, false));

folderButtons.forEach(button => button.addEventListener('click', () => sortInto(button.dataset.folder)));
skipButton.addEventListener('click', () => {
  if (!current || busy) return;
  skipped.add(current.id);
  message('Skipped ' + current.name + '; it stays where it is.');
  showNext();
});
chooseButton.addEventListener('click', chooseFolder);
scanButton.addEventListener('click', scan);
