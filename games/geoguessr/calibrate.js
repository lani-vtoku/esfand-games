// Calibration page: assign map coordinates to screenshots by clicking the map,
// then download an updated manifest.json. Zero coding for organizers.
// The map zooms (wheel/pinch/buttons) for precise placement.

import { MapWidget } from './map.js';
import { fullPointsRadius } from './scoring.js';
import { loadManifest, bust } from '../../shared/js/manifest.js';
import { downloadJson } from '../../shared/js/kiosk.js';

const manifest = await loadManifest('assets/manifest.json');
const locations = manifest.locations ?? [];

const map = new MapWidget(document.getElementById('map-holder'), manifest.map);
map.interactive = true;

const rFull = fullPointsRadius(manifest.map.width, manifest.map.height,
  manifest.game?.fullPointsRadiusPct ?? 3);

let selected = null;

function placeMarker(pt) {
  map.setGuess(pt);
  map.setRing(pt, rFull);
}

map.onGuessMoved = pt => {
  if (!selected) return;
  selected.map = { x: Math.round(pt.x), y: Math.round(pt.y) };
  placeMarker(selected.map);
  renderList();
  renderInfo();
};

document.addEventListener('keydown', e => {
  if (!selected?.map) return;
  const step = e.shiftKey ? 10 : 2;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d) return;
  e.preventDefault();
  selected.map.x = Math.max(0, Math.min(manifest.map.width, selected.map.x + d[0]));
  selected.map.y = Math.max(0, Math.min(manifest.map.height, selected.map.y + d[1]));
  placeMarker(selected.map);
  renderInfo();
});

// ---------- sidebar ----------

const listEl = document.getElementById('loc-list');

function renderList() {
  // uncalibrated first, flagged red
  const sorted = [...locations].sort((a, b) => (a.map ? 1 : 0) - (b.map ? 1 : 0));
  listEl.innerHTML = '';
  for (const loc of sorted) {
    const div = document.createElement('div');
    div.className = 'loc ' + (loc.map ? 'cal' : 'uncal') + (loc === selected ? ' selected' : '');
    div.innerHTML = `<span>${loc.zoneName} <small style="opacity:.6">(${loc.id})</small></span>
      <span class="status">${loc.map ? '✓ set' : 'NEEDS COORDS'}</span>`;
    div.addEventListener('click', () => select(loc));
    listEl.appendChild(div);
  }
}

function renderInfo() {
  document.getElementById('ref-name').textContent = selected ? selected.zoneName : 'Select a location';
  document.getElementById('coords').textContent = selected?.map
    ? `x: ${selected.map.x}, y: ${selected.map.y}` : selected ? 'Click the map to set coordinates' : '';
  const done = locations.filter(l => l.map).length;
  document.getElementById('progress').textContent = `${done} / ${locations.length} calibrated`;
}

function select(loc) {
  selected = loc;
  const img = document.getElementById('ref-img');
  img.src = bust('assets/' + loc.image);
  img.style.display = '';
  if (loc.map) placeMarker(loc.map);
  else { map.reset(); map.hideRing(); }
  renderList();
  renderInfo();
}

document.getElementById('btn-download').addEventListener('click', () => {
  downloadJson(manifest, 'manifest.json');
});

renderList();
renderInfo();
if (locations.length) select(locations.find(l => !l.map) ?? locations[0]);
