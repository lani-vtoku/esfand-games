// WoW GeoGuessr — LostGamer/GeoGuessr-style round flow.
// Look around the location (pan/zoom photo, or 360° pano for locations with
// "pano": true), expand the corner map, drop a pin, lock it in before the
// timer runs out. 5 rounds, 5000 points each.

import { MapWidget } from './map.js';
import { PhotoView, PanoView } from './view.js';
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
  points: manifest.game?.pointsPerRound ?? 5000,
  fullPct: manifest.game?.fullPointsRadiusPct ?? 3,
  decayPct: manifest.game?.decayPct ?? 12,
  roundSeconds: manifest.game?.roundSeconds ?? 60, // 0 disables the timer
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
const roundLabel = el('round-label');
const scoreLabel = el('score-label');
const mapInset = el('map-inset');
const btnCollapse = el('btn-collapse');
const btnLock = el('btn-lock');
const btnNext = el('btn-next');
const revealBanner = el('reveal-banner');
const attract = el('attract');
const totalScreen = el('total');
const lookHint = el('look-hint');
const timerWrap = el('timer-wrap');
const timerBar = el('timer-bar');

el('attract-sub').textContent =
  `Where in Azeroth is this? ${GAME.rounds} rounds, ${(GAME.rounds * GAME.points).toLocaleString()} points.`;

const photoView = new PhotoView(el('photo'));
const panoView = new PanoView(el('pano'));
const map = new MapWidget(el('map-holder'), manifest.map);
map.onGuessMoved = () => {
  btnLock.disabled = false;
  btnLock.textContent = 'Lock In Guess';
};

// ---------- state ----------

let round = [];
let roundIdx = 0;
let totalScore = 0;
let phase = 'attract'; // attract | guess | reveal | total
let totalTimer = null;
let timeLeft = 0;
let timerTick = null;

function setExpanded(on) {
  mapInset.classList.toggle('expanded', on);
  el('expand-hint').style.display = on ? 'none' : '';
  btnCollapse.classList.toggle('hidden', !on || phase !== 'guess');
  map.interactive = on && phase === 'guess';
  // let the CSS transition settle before re-fitting the map
  setTimeout(() => map.refresh(), 280);
}

function startGame() {
  round = pickRound(locations, GAME.rounds);
  roundIdx = 0;
  totalScore = 0;
  attract.classList.add('hidden');
  totalScreen.classList.add('hidden');
  startRound();
}

async function startRound() {
  phase = 'guess';
  const loc = round[roundIdx];
  roundLabel.textContent = `Round ${roundIdx + 1} / ${GAME.rounds}`;
  scoreLabel.textContent = `Score: ${totalScore.toLocaleString()}`;

  // viewer: 360 pano if flagged, else pan/zoom photo
  panoView.hide();
  photoView.hide();
  let shown = false;
  if (loc.pano) shown = await panoView.show('assets/' + loc.image);
  if (!shown) { await photoView.show('assets/' + loc.image); }
  lookHint.style.opacity = '1';
  setTimeout(() => { lookHint.style.opacity = '0'; }, 4000);

  map.reset();
  setExpanded(false);
  btnLock.disabled = true;
  btnLock.textContent = 'Place your pin';
  btnLock.classList.remove('hidden');
  btnNext.classList.add('hidden');
  revealBanner.classList.add('hidden');

  startTimer();

  // test hook: #autoreveal places a center-map guess and locks it immediately
  if (location.hash === '#autoreveal' && roundIdx === 0) {
    setExpanded(true);
    map.setGuess({ x: manifest.map.width / 2, y: manifest.map.height / 2 });
    lockGuess();
  }
}

// ---------- timer ----------

function startTimer() {
  stopTimer();
  if (!GAME.roundSeconds) return;
  timeLeft = GAME.roundSeconds;
  timerWrap.style.display = 'block';
  renderTimer();
  timerTick = setInterval(() => {
    timeLeft -= 0.25;
    renderTimer();
    if (timeLeft <= 0) {
      stopTimer();
      if (map.guess) lockGuess();
      else timeUp();
    }
  }, 250);
}

function stopTimer() {
  if (timerTick) { clearInterval(timerTick); timerTick = null; }
  timerWrap.style.display = 'none';
}

function renderTimer() {
  const frac = Math.max(0, timeLeft / GAME.roundSeconds);
  timerBar.style.width = (frac * 100) + '%';
  timerBar.classList.toggle('low', timeLeft <= 10);
}

// ---------- guess / reveal ----------

function timeUp() {
  // no pin placed in time → zero points, show the answer
  phase = 'reveal';
  lookHint.style.opacity = '0';
  map.interactive = false;
  const loc = round[roundIdx];
  setExpanded(true);
  btnCollapse.classList.add('hidden');
  btnLock.classList.add('hidden');
  map.showTruth(loc.map);
  map.fitBounds(loc.map, loc.map);
  revealBanner.classList.remove('hidden');
  el('reveal-zone').textContent = loc.zoneName;
  el('reveal-detail').textContent = "Time's up!";
  el('reveal-points').textContent = '+0 points';
  btnNext.textContent = roundIdx + 1 < GAME.rounds ? 'Next' : 'See Total';
  btnNext.classList.remove('hidden');
}

async function lockGuess() {
  if (!map.guess || phase !== 'guess') return;
  phase = 'reveal';
  lookHint.style.opacity = '0';
  stopTimer();
  map.interactive = false;
  btnLock.classList.add('hidden');
  btnCollapse.classList.add('hidden');
  if (!mapInset.classList.contains('expanded')) setExpanded(true);

  const loc = round[roundIdx];
  const dist = distance(map.guess, loc.map);
  const pts = scoreGuess({
    dist, mapW: manifest.map.width, mapH: manifest.map.height,
    pointsPerRound: GAME.points, fullPointsRadiusPct: GAME.fullPct, decayPct: GAME.decayPct,
  });
  totalScore += pts;

  map.showTruth(loc.map);
  map.fitBounds(map.guess, loc.map);
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
  stopTimer();
  setExpanded(false);
  revealBanner.classList.add('hidden');
  btnNext.classList.add('hidden');
  totalScreen.classList.remove('hidden');
  const max = GAME.rounds * GAME.points;
  el('total-rank').textContent = rankTitle(totalScore, max);
  await countUp(el('total-score'), totalScore, 1400);
  el('total-score').textContent = `${totalScore.toLocaleString()} / ${max.toLocaleString()}`;
  clearTimeout(totalTimer);
  totalTimer = setTimeout(toAttract, 15000);
}

function toAttract() {
  clearTimeout(totalTimer);
  stopTimer();
  phase = 'attract';
  photoView.hide();
  panoView.hide();
  map.reset();
  setExpanded(false);
  totalScreen.classList.add('hidden');
  revealBanner.classList.add('hidden');
  btnNext.classList.add('hidden');
  btnLock.classList.remove('hidden');
  roundLabel.textContent = '';
  scoreLabel.textContent = '';
  attract.classList.remove('hidden');
}

// ---------- wiring ----------

el('btn-start').addEventListener('click', startGame);
attract.addEventListener('click', e => { if (e.target === attract) startGame(); });
el('btn-again').addEventListener('click', () => { clearTimeout(totalTimer); startGame(); });
btnLock.addEventListener('click', lockGuess);
btnNext.addEventListener('click', nextRound);
btnCollapse.addEventListener('click', () => setExpanded(false));

// collapsed inset: any tap on the mini-map expands it (doesn't place a pin);
// mouse users get hover-expand like GeoGuessr
el('map-holder').addEventListener('click', () => {
  if (phase === 'guess' && !mapInset.classList.contains('expanded')) setExpanded(true);
});
mapInset.addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && phase === 'guess' && !mapInset.classList.contains('expanded')) {
    setExpanded(true);
  }
});

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

// test hooks: #autostart jumps straight into a round; #autoreveal also locks
// a center-map guess (used by headless checks)
if (location.hash === '#autostart' || location.hash === '#autoreveal') startGame();
