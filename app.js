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
let destinations = [];
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

function renderFolders(folders) {
  destinations = folders;
  const layout = layouts[Math.min(folders.length, folderButtons.length)] || slotClasses;
  folderButtons.forEach((button, index) => {
    const position = layout[index];
    button.hidden = index >= folders.length || !position;
    if (button.hidden) return;
    button.dataset.folder = folders[index];
    button.querySelector('span:last-child').textContent = folders[index];
    button.querySelector('.folder-icon').textContent = '▱';
    slotClasses.forEach(name => button.classList.remove(name));
    button.classList.add('folder', position);
    button.setAttribute('aria-label', `Sort into ${folders[index]}`);
  });
}

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
    empty.querySelector('span').textContent = queue.length ? 'Scan again to revisit skipped photos.' : 'Add pictures to your test folder, then scan again.';
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
  message('Looking for pictures…');
  try {
    const data = await api('/api/scan', { method: 'POST' });
    queue = data.photos;
    skipped = new Set();
    renderFolders(data.folders);
    rootLabel.textContent = `${data.phoneMode ? 'Phone test folder' : 'Photo folder'}: ${data.root}`;
    document.querySelector('footer').innerHTML = data.phoneMode
      ? 'Photos move into the numbered folders you made and stay on your phone.'
      : 'Sorted originals move into the <strong>Sorted</strong> folder inside this project.';
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
  const card = photoCard.getBoundingClientRect();
  const cx = card.left + card.width / 2;
  const cy = card.top + card.height / 2;
  let best = null;
  let smallestGap = Infinity;
  for (const button of folderButtons.filter(item => !item.hidden)) {
    const rect = button.getBoundingClientRect();
    const targetAngle = Math.atan2(rect.top + rect.height / 2 - cy, rect.left + rect.width / 2 - cx);
    const gap = Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle)));
    if (gap < smallestGap) { smallestGap = gap; best = button.dataset.folder; }
  }
  return best;
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
