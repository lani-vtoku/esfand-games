// Death Roll — kiosk driver. Two players at the table, physical coins;
// the table runner enters the wager (min 100 each), then players alternate
// hitting ROLL until someone hits the 1.

import { createGame, roll, clampAnte } from './deathroll.js';
import { guardInputs, fullscreenOnFirstInteraction, watchIdle, adminGesture, buildAdminOverlay } from '../../shared/js/kiosk.js';

const $ = id => document.getElementById(id);

const attractEl = $('attract');
const bidEl = $('bid');
const resultEl = $('result');
const potEl = $('pot');
const potAmountEl = $('pot-amount');
const rollNumEl = $('roll-num');
const rollRangeEl = $('roll-range');
const historyEl = $('history');
const rollBtn = $('btn-roll');
const medallionEl = $('medallion');
const deathFlashEl = $('death-flash');
const plates = { 1: $('plate-p1'), 2: $('plate-p2') };
const sides = { 1: $('side-p1'), 2: $('side-p2') };

const BID_PRESETS = [100, 200, 500, 1000];
const HISTORY_SHOWN = 7;

let ante = 100;
let game = null;
let rolling = false;   // scramble animation in progress

// ---------------------------------------------------------------- screens

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function toAttract() {
  game = null;
  rolling = false;
  hide(bidEl); hide(resultEl); hide(rollBtn); hide(potEl);
  deathFlashEl.classList.remove('on');
  rollNumEl.classList.remove('doom');
  rollNumEl.textContent = ante.toLocaleString();
  rollRangeEl.textContent = '';
  historyEl.innerHTML = '';
  clearCoinRain();
  for (const p of [1, 2]) { plates[p].classList.remove('active'); sides[p].classList.remove('active'); }
  plates[1].querySelector('.ante').textContent = '';
  plates[2].querySelector('.ante').textContent = '';
  show(attractEl);
}

function toBid() {
  hide(attractEl); hide(resultEl);
  renderBid();
  show(bidEl);
}

function startMatch() {
  hide(bidEl); hide(resultEl);
  clearCoinRain();
  game = createGame({ ante });
  rollNumEl.classList.remove('doom');
  potAmountEl.textContent = game.pot.toLocaleString();
  plates[1].querySelector('.ante').textContent = `ante ${ante.toLocaleString()}`;
  plates[2].querySelector('.ante').textContent = `ante ${ante.toLocaleString()}`;
  historyEl.innerHTML = '';
  show(potEl); show(rollBtn);
  renderTurn();
}

// ---------------------------------------------------------------- wager

function renderBid() {
  $('bid-amount').textContent = ante.toLocaleString();
  $('bid-pot').innerHTML = `Pot: <b>${(ante * 2).toLocaleString()} coins</b> — first roll 1 – ${ante.toLocaleString()}`;
  $('bid-minus').disabled = ante <= clampAnte(0);
}

$('bid-minus').addEventListener('click', () => { ante = clampAnte(ante - 50); renderBid(); });
$('bid-plus').addEventListener('click', () => { ante = clampAnte(ante + 50); renderBid(); });
for (const preset of BID_PRESETS) {
  const b = document.createElement('button');
  b.className = 'btn btn-ghost';
  b.textContent = preset.toLocaleString();
  b.addEventListener('click', () => { ante = clampAnte(preset); renderBid(); });
  $('bid-presets').appendChild(b);
}

// ---------------------------------------------------------------- play

function renderTurn() {
  const p = game.turn;
  for (const q of [1, 2]) {
    plates[q].classList.toggle('active', q === p);
    sides[q].classList.toggle('active', q === p);
  }
  rollBtn.textContent = `Player ${p} — Roll!`;
  rollBtn.classList.toggle('p1', p === 1);
  rollBtn.classList.toggle('p2', p === 2);
  rollNumEl.textContent = game.ceiling;
  rollRangeEl.textContent = `rolling 1 – ${game.ceiling}`;
}

function renderHistory() {
  historyEl.innerHTML = game.history.slice(-HISTORY_SHOWN).map(h =>
    `<div class="chip p${h.player}">P${h.player} → ${h.roll}</div>`).join('');
}

rollBtn.addEventListener('click', async () => {
  if (!game || game.over || rolling) return;
  rolling = true;
  rollBtn.disabled = true;

  const before = game.ceiling;
  game = roll(game);
  const landed = game.ceiling;

  await scramble(before, landed);
  renderHistory();

  if (game.over) {
    await deathSequence();
    showResult();
  } else {
    renderTurn();
  }
  rollBtn.disabled = false;
  rolling = false;
});

/**
 * Suspense scramble: numbers flicker fast then decelerate onto the result.
 * Longer and slower the closer the ceiling is to 1 — the danger zone.
 */
function scramble(ceiling, landed) {
  return new Promise(resolve => {
    const danger = ceiling <= 10;
    const duration = danger ? 2000 : 1200;
    const start = performance.now();
    let last = 0;
    const tick = now => {
      const t = Math.min(1, (now - start) / duration);
      // update interval stretches from 40ms to ~300ms as t → 1
      const interval = 40 + 280 * t * t;
      if (now - last >= interval && t < 1) {
        last = now;
        rollNumEl.textContent = 1 + Math.floor(Math.random() * ceiling);
      }
      if (t < 1) { requestAnimationFrame(tick); return; }
      rollNumEl.textContent = landed;
      rollRangeEl.textContent = '';
      if (landed === 1) rollNumEl.classList.add('doom');
      resolve();
    };
    rollRangeEl.textContent = `rolling 1 – ${ceiling}`;
    requestAnimationFrame(tick);
  });
}

function deathSequence() {
  return new Promise(resolve => {
    medallionEl.classList.add('shake');
    deathFlashEl.classList.add('on');
    setTimeout(() => deathFlashEl.classList.remove('on'), 500);
    setTimeout(() => { medallionEl.classList.remove('shake'); resolve(); }, 1600);
  });
}

function showResult() {
  hide(rollBtn);
  $('result-winner').textContent = `Player ${game.winner} Wins!`;
  resultEl.querySelector('#result-pot b').textContent = `${game.pot.toLocaleString()} coins`;
  $('result-loser').textContent = `Player ${game.loser} rolled the 1 — pay up.`;
  show(resultEl);
  coinRain();
}

// ---------------------------------------------------------------- coin rain

function coinRain(count = 40) {
  for (let i = 0; i < count; i++) {
    const c = document.createElement('span');
    c.className = 'coin rain-coin';
    const size = 18 + Math.random() * 22;
    c.style.width = c.style.height = `${size}px`;
    c.style.left = `${Math.random() * 100}vw`;
    c.style.animationDuration = `${2.2 + Math.random() * 2.5}s`;
    c.style.animationDelay = `${Math.random() * 1.5}s`;
    document.body.appendChild(c);
  }
}

function clearCoinRain() {
  document.querySelectorAll('.rain-coin').forEach(c => c.remove());
}

// ---------------------------------------------------------------- buttons

$('btn-start').addEventListener('click', toBid);
$('btn-begin').addEventListener('click', startMatch);
$('btn-rematch').addEventListener('click', startMatch);
$('btn-new-wager').addEventListener('click', toBid);

// ---------------------------------------------------------------- kiosk

guardInputs();
fullscreenOnFirstInteraction();

const idleWarnEl = $('idle-warn');
watchIdle({
  idleMs: 90_000,
  isActive: () => !!game && !game.over,
  onWarn: remaining => {
    if (remaining === null) { idleWarnEl.classList.add('hidden'); return; }
    idleWarnEl.textContent = `Still there? Resetting in ${remaining}…`;
    idleWarnEl.classList.remove('hidden');
  },
  onIdle: () => { idleWarnEl.classList.add('hidden'); toAttract(); },
});

adminGesture(() => admin.show());
const admin = buildAdminOverlay([
  { label: 'Reset game', onClick: () => { admin.hide(); toAttract(); } },
  { label: 'Back to hub', onClick: () => { location.href = '/'; } },
]);

toAttract();
