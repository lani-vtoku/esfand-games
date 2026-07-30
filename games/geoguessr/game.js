// WoW GeoGuessr — round flow.
// ATTRACT → GUESS (screenshot + expandable map) → REVEAL → next … → TOTAL → ATTRACT

import { MapWidget } from './map.js';
import { scoreGuess, distance, toLeagues, rankTitle, pickRound } from './scoring.js';
import { loadManifest, showError } from '../../shared/js/manifest.js';
import { guardInputs, fullscreenOnFirstInteraction, watchIdle, adminGesture, buildAdminOverlay } from '../../shared/js/kiosk.js';
import { countUp } from '../../shared/js/ui.js';

guardInputs();
fullscreenOnFirstInteraction();

const manifest = await loadManifest('assets/manifest.json');
if (!manifest.map?.image || !manifest.map?.width || !manifest.map?.height) {
  showError('The manifest is missing the <code>map</code> section.',
    'It must contain <code>image</code>, <code>width</code> and <code>height</code>.');
  throw new Error('bad manifest');
}
const GAME = {
  rounds: manifest.game?.roundsPerGame ?? 5,
  points: manifest.game?.pointsPerRound ?? 1000,
  fullPct: manifest.game?.fullPointsRadiusPct ?? 3,
  decayPct: manifest.game?.decayPct ?? 12,
};
const locations = manifest.locations ?? [];
const calibrated = locations.filter(l => l.map);
if (calibrated.length < GAME.rounds) {
  showError(`Only ${calibrated.length} calibrated location(s) — need at least ${GAME.rounds}.`,
    'Add screenshots to the manifest and set their map coordinates with ' +
    '<code>calibrate.html</code> (link on the hub page).');
  throw new Error('not enough locations');
}

// ---------- elements ----------

const el = id => document.getElementById(id);
const screenshot = el('screenshot');
const roundLabel = el('round-label');
const scoreLabel = el('score-label');
const mapThumb = el('map-thumb');
const mapPanel = el('map-panel');
const btnCloseMap = el('btn-close-map');
const btnLock = el('btn-lock');
const btnNext = el('btn-next');
const revealBanner = el('reveal-banner');
const attract = el('attract');
const totalScreen = el('total');

el('map-thumb-img').src = 'assets/' + manifest.map.image;
const map = new MapWidget(el('map-holder'), manifest.map);
map.onGuessMoved = () => { btnLock.disabled = false; btnLock.style.opacity = '1'; };

// ---------- state ----------

let round = [];       // locations for this game
let roundIdx = 0;
let totalScore = 0;
let phase = 'attract'; // attract | guess | reveal | total
let totalTimer = null;

function startGame() {
  round = pickRound(locations, GAME.rounds);
  roundIdx = 0;
  totalScore = 0;
  attract.classList.add('hidden');
  totalScreen.classList.add('hidden');
  startRound();
}

function startRound() {
  phase = 'guess';
  const loc = round[roundIdx];
  screenshot.src = 'assets/' + loc.image;
  roundLabel.textContent = `Round ${roundIdx + 1} / ${GAME.rounds}`;
  scoreLabel.textContent = `Score: ${totalScore.toLocaleString()}`;
  map.reset();
  map.interactive = true;
  btnLock.disabled = true;
  btnLock.style.opacity = '.4';
  btnLock.classList.remove('hidden');
  btnNext.classList.add('hidden');
  btnCloseMap.classList.remove('hidden');
  revealBanner.classList.add('hidden');
  mapPanel.classList.add('hidden');
  mapThumb.classList.remove('hidden');
}

function openMap() {
  mapPanel.classList.remove('hidden');
  mapThumb.classList.add('hidden');
  map.refresh();
}

function closeMap() {
  if (phase !== 'guess') return;
  mapPanel.classList.add('hidden');
  mapThumb.classList.remove('hidden');
}

async function lockGuess() {
  if (!map.guess || phase !== 'guess') return;
  phase = 'reveal';
  map.interactive = false;
  btnLock.classList.add('hidden');
  btnCloseMap.classList.add('hidden');

  const loc = round[roundIdx];
  const dist = distance(map.guess, loc.map);
  const pts = scoreGuess({
    dist, mapW: manifest.map.width, mapH: manifest.map.height,
    pointsPerRound: GAME.points, fullPointsRadiusPct: GAME.fullPct, decayPct: GAME.decayPct,
  });
  totalScore += pts;

  map.showTruth(loc.map);
  revealBanner.classList.remove('hidden');
  el('reveal-zone').textContent = loc.zoneName;
  el('reveal-detail').textContent = pts === GAME.points
    ? 'Perfect! Right on target.'
    : `~${toLeagues(dist, manifest.map.width, manifest.map.height)} leagues off`;
  const ptsEl = el('reveal-points');
  await countUp(ptsEl, pts, 900);
  ptsEl.textContent = `+${pts.toLocaleString()} points`;
  scoreLabel.textContent = `Score: ${totalScore.toLocaleString()}`;

  btnNext.textContent = roundIdx + 1 < GAME.rounds ? 'Next' : 'See Total';
  btnNext.classList.remove('hidden');
}

function nextRound() {
  if (phase !== 'reveal') return;
  roundIdx += 1;
  if (roundIdx < GAME.rounds) startRound();
  else showTotal();
}

async function showTotal() {
  phase = 'total';
  mapPanel.classList.add('hidden');
  mapThumb.classList.add('hidden');
  totalScreen.classList.remove('hidden');
  const max = GAME.rounds * GAME.points;
  el('total-rank').textContent = rankTitle(totalScore, max);
  await countUp(el('total-score'), totalScore, 1400);
  el('total-score').textContent = `${totalScore.toLocaleString()} / ${max.toLocaleString()}`;
  // Auto-return to attract after 15s
  clearTimeout(totalTimer);
  totalTimer = setTimeout(toAttract, 15000);
}

function toAttract() {
  clearTimeout(totalTimer);
  phase = 'attract';
  screenshot.src = '';
  map.reset();
  mapPanel.classList.add('hidden');
  mapThumb.classList.add('hidden');
  totalScreen.classList.add('hidden');
  revealBanner.classList.add('hidden');
  roundLabel.textContent = '';
  scoreLabel.textContent = '';
  attract.classList.remove('hidden');
}

// ---------- wiring ----------

el('btn-start').addEventListener('click', startGame);
attract.addEventListener('click', e => { if (e.target === attract) startGame(); });
mapThumb.addEventListener('click', openMap);
btnCloseMap.addEventListener('click', closeMap);
btnLock.addEventListener('click', lockGuess);
btnNext.addEventListener('click', nextRound);
el('btn-again').addEventListener('click', () => { clearTimeout(totalTimer); startGame(); });

// ---------- kiosk ----------

const idleWarn = el('idle-warn');
watchIdle({
  idleMs: 75000,
  isActive: () => phase === 'guess' || phase === 'reveal',
  onWarn: s => {
    if (s == null) idleWarn.classList.add('hidden');
    else {
      idleWarn.classList.remove('hidden');
      idleWarn.textContent = `Still playing? Resetting in ${s}...`;
    }
  },
  onIdle: () => {
    idleWarn.classList.add('hidden');
    if (phase !== 'attract') toAttract();
  },
});

const admin = buildAdminOverlay([
  { label: 'Reset game', onClick: () => { admin.hide(); toAttract(); } },
  { label: 'Open calibrate page', onClick: () => { location.href = 'calibrate.html'; } },
  { label: 'Exit fullscreen', onClick: () => document.exitFullscreen?.() },
]);
adminGesture(() => admin.show());
