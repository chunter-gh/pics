const scanButton = document.querySelector('#scan');
const skipButton = document.querySelector('#skip');
const photoCard = document.querySelector('#photoCard');
const photoImage = document.querySelector('#photo');
const empty = document.querySelector('#photoEmpty');
const unavailable = document.querySelector('#unavailable');
const count = document.querySelector('#count');
const rootLabel = document.querySelector('#root');
const filename = document.querySelector('#filename');
const locationLabel = document.querySelector('#location');
const status = document.querySelector('#status');
const folderButtons = [...document.querySelectorAll('.folder')];
const directions = ['Keep', 'Family', 'Friends', 'Trips', 'Pets', 'Screenshots', 'Documents', 'Later'];
let queue = [];
let skipped = new Set();
let current = null;
let busy = false;
let drag = null;

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function message(text) { status.textContent = text; }

function showNext() {
  current = queue.find(item => !skipped.has(item.id)) || null;
  const remaining = queue.length - skipped.size;
  count.textContent = queue.length ? `${remaining} to sort · ${queue.length} found` : 'No photos found';
  filename.textContent = current?.name || '';
  locationLabel.textContent = current?.location || '';
  skipButton.disabled = !current || busy;
  folderButtons.forEach(button => button.disabled = !current || busy);
  photoImage.hidden = true;
  photoImage.removeAttribute('src');
  unavailable.hidden = true;
  empty.hidden = !!current;
  if (!current) {
    empty.querySelector('strong').textContent = queue.length ? 'All caught up for now' : 'No photos found yet';
    empty.querySelector('span').textContent = queue.length ? 'Scan again to revisit skipped photos.' : 'Add pictures below the Pics folder, then scan.';
    return;
  }
  if (!current.previewable) {
    unavailable.hidden = false;
    unavailable.textContent = `${current.name} — preview unavailable here. Tap or flick to sort it.`;
  } else {
    photoImage.alt = current.name;
    photoImage.src = `/api/photo?id=${encodeURIComponent(current.id)}`;
    photoImage.hidden = false;
  }
  const next = queue.find(item => item.id !== current.id && !skipped.has(item.id) && item.previewable);
  if (next) { const preload = new Image(); preload.src = `/api/photo?id=${encodeURIComponent(next.id)}`; }
}

photoImage.addEventListener('error', () => {
  photoImage.hidden = true;
  unavailable.hidden = false;
  unavailable.textContent = `${current?.name || 'Picture'} — preview unavailable here. Tap or flick to sort it.`;
});

async function scan() {
  if (busy) return;
  busy = true;
  scanButton.disabled = true;
  skipButton.disabled = true;
  message('Searching folders below Pics…');
  try {
    const data = await api('/api/scan', { method: 'POST' });
    queue = data.photos;
    skipped = new Set();
    rootLabel.textContent = `Only folders below ${data.root}`;
    message(`Found ${queue.length} picture${queue.length === 1 ? '' : 's'}.`);
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    scanButton.disabled = false;
    showNext();
  }
}

async function sortInto(folder) {
  if (busy || !current) return;
  const chosen = current;
  busy = true;
  skipButton.disabled = true;
  folderButtons.forEach(button => button.disabled = true);
  message(`Moving to ${folder}…`);
  try {
    const data = await api('/api/sort', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: chosen.id, folder })
    });
    queue = queue.filter(item => item.id !== chosen.id);
    skipped.delete(chosen.id);
    message(`Moved ${chosen.name} to ${data.movedTo}`);
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    showNext();
  }
}

function direction(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const index = (Math.round((angle + Math.PI / 2) / (Math.PI / 4)) + 8) % 8;
  return directions[index];
}
function highlight(folder) {
  folderButtons.forEach(button => button.classList.toggle('active', button.dataset.folder === folder));
}

photoCard.addEventListener('pointerdown', event => {
  if (!current || busy) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  photoCard.setPointerCapture(event.pointerId);
  photoCard.classList.add('dragging');
});
photoCard.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const distance = Math.hypot(dx, dy);
  photoCard.style.transform = `translate(${dx * .16}px, ${dy * .16}px) rotate(${dx * .012}deg)`;
  highlight(distance > 28 ? direction(dx, dy) : null);
});
function finishDrag(event, commit) {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag = null;
  photoCard.classList.remove('dragging');
  photoCard.style.transform = '';
  highlight(null);
  if (commit && Math.hypot(dx, dy) > 45) sortInto(direction(dx, dy));
}
photoCard.addEventListener('pointerup', event => finishDrag(event, true));
photoCard.addEventListener('pointercancel', event => finishDrag(event, false));

folderButtons.forEach(button => button.addEventListener('click', () => sortInto(button.dataset.folder)));
skipButton.addEventListener('click', () => {
  if (!current || busy) return;
  skipped.add(current.id);
  message(`Skipped ${current.name}; it stays where it is.`);
  showNext();
});
scanButton.addEventListener('click', scan);
scan();
