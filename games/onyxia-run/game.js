// Onyxia Run — state machine and rendering.
// States: ATTRACT (cycles title/leaderboard/prize) → READY → PLAY → DEAD → NAME_ENTRY → ATTRACT

import { Engine } from './engine.js';
import { WORLD, PHYS, initialPlayer, stepPlayer, flap, tiltDeg, checkDeath } from './physics.js';
import { ObstacleField } from './obstacles.js';
import { loadBoard, addRun, rankForScore } from './leaderboard.js';
import { loadManifest, loadImage } from '../../shared/js/manifest.js';
import { guardInputs, fullscreenOnFirstInteraction, watchIdle, adminGesture, buildAdminOverlay, downloadJson } from '../../shared/js/kiosk.js';
import { initialsEntry, renderLeaderboard } from '../../shared/js/ui.js';
import { saveLocal, backupToServer } from '../../shared/js/storage.js';
import { LB_KEY } from './leaderboard.js';

// ---------- boot ----------

guardInputs();
fullscreenOnFirstInteraction();

const manifest = await loadManifest('assets/manifest.json');
const cfg = {
  frames: manifest.player?.frames ?? [],
  frameMs: manifest.player?.frameMs ?? 120,
  hitboxRadius: manifest.player?.hitboxRadius ?? 22,
  pillarWidth: manifest.obstacles?.width ?? 110,
  floorHeight: manifest.floor?.height ?? 90,
  title: manifest.text?.title ?? 'ONYXIA RUN',
  prizeLine: manifest.text?.prizeLine ?? 'Top score wins!',
  deathLines: manifest.text?.deathLines?.length ? manifest.text.deathLines : ['DEEP BREATH...'],
};
const FLOOR_Y = WORLD.height - cfg.floorHeight;

// Sprites (null → canvas-drawn fallbacks)
const sprites = {
  frames: await Promise.all(cfg.frames.map(f => loadImage('assets/' + f))),
  pillarTop: await loadImage(manifest.obstacles?.top ? 'assets/' + manifest.obstacles.top : null),
  pillarBottom: await loadImage(manifest.obstacles?.bottom ? 'assets/' + manifest.obstacles.bottom : null),
  bgLayers: await Promise.all((manifest.background?.layers ?? []).map(async l => ({
    img: await loadImage('assets/' + l.image),
    speedFactor: l.speedFactor ?? 0.2,
  }))),
  floor: await loadImage(manifest.floor?.image ? 'assets/' + manifest.floor.image : null),
};

let board = await loadBoard();

// ---------- state ----------

const S = { ATTRACT: 'attract', READY: 'ready', PLAY: 'play', DEAD: 'dead', NAME: 'name' };
let state = S.ATTRACT;

let player = initialPlayer();
let field = null;
let score = 0;
let animTime = 0;       // for sprite frame + attract animations
let stateTime = 0;      // seconds in current state
let scrollX = 0;        // world scroll for parallax
let deathLine = '';

// Scenery stages: the Steppes darken and burn as the run goes deeper.
// Each stage is a top/bottom gradient tint [r,g,b,a] laid over the background,
// crossfaded smoothly so the shift reads as weather turning, not a hard cut.
const SCENERY_STAGES = [
  { at: 0,  top: [0, 0, 0, 0],         bottom: [0, 0, 0, 0] },          // clear skies
  { at: 10, top: [255, 120, 40, 0.16], bottom: [130, 30, 60, 0.22] },   // smoldering dusk
  { at: 20, top: [170, 25, 15, 0.30],  bottom: [70, 0, 35, 0.38] },     // firestorm
  { at: 30, top: [45, 0, 70, 0.44],    bottom: [10, 0, 25, 0.52] },     // the lair's shadow
];
const sceneryTint = { top: [0, 0, 0, 0], bottom: [0, 0, 0, 0] };

function sceneryTargetFor(n) {
  let s = SCENERY_STAGES[0];
  for (const st of SCENERY_STAGES) if (n >= st.at) s = st;
  return s;
}

function lerpTint(cur, tgt, k) {
  for (let i = 0; i < 4; i++) cur[i] += (tgt[i] - cur[i]) * k;
}

// Embers drift up through the later stages; fixed set so motion is stable.
const EMBERS = Array.from({ length: 36 }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * WORLD.height,
  drift: 30 + Math.random() * 60,   // px/s leftward
  rise: 20 + Math.random() * 45,    // px/s upward
  r: 1.5 + Math.random() * 2.5,
  phase: Math.random() * Math.PI * 2,
}));

// "DEEP BREATH" beat: every 10th pillar, warning then a flame band up top.
const BREATH = { BAND_H: 240, WARN: 0.9, FLAME: 1.3 };
let breathTimer = 0;    // counts down through WARN + FLAME
let lastBreathAt = 0;   // passedCount when last breath triggered

// Attract cycle: title 6s → leaderboard 8s → prize 4s
const ATTRACT_CYCLE = [
  { name: 'title', dur: 6 },
  { name: 'leaderboard', dur: 8 },
  { name: 'prize', dur: 4 },
];

function attractPhase() {
  const total = ATTRACT_CYCLE.reduce((s, p) => s + p.dur, 0);
  let t = stateTime % total;
  for (const p of ATTRACT_CYCLE) {
    if (t < p.dur) return p.name;
    t -= p.dur;
  }
  return 'title';
}

function enter(next) {
  state = next;
  stateTime = 0;
  if (next === S.READY) {
    player = initialPlayer();
    field = new ObstacleField(cfg.pillarWidth, FLOOR_Y);
    score = 0;
    breathTimer = 0;
    lastBreathAt = 0;
  } else if (next === S.NAME) {
    showNameEntry();
  }
}

// ---------- input ----------

function onAction() {
  if (state === S.ATTRACT) enter(S.READY);
  else if (state === S.READY) { enter(S.PLAY); flap(player); }
  else if (state === S.PLAY) flap(player);
  else if (state === S.DEAD && stateTime > 0.8) {
    // score > 0 goes to initials; zero-score runs skip straight back
    if (score > 0) enter(S.NAME);
    else enter(S.ATTRACT);
  }
}

document.addEventListener('pointerdown', e => {
  if (nameEntryActive || adminOpen()) return;
  if (e.clientX <= 100 && e.clientY <= 100) return; // reserve admin corner
  onAction();
});
document.addEventListener('keydown', e => {
  if (nameEntryActive || adminOpen()) return;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') onAction();
});

// ---------- update ----------

function update(dt) {
  animTime += dt;
  stateTime += dt;

  // Ease the scenery toward the current stage (~2.5s crossfade).
  const tintTarget = sceneryTargetFor(state === S.PLAY || state === S.DEAD ? score : 0);
  const tintK = Math.min(1, dt / 2.5);
  lerpTint(sceneryTint.top, tintTarget.top, tintK);
  lerpTint(sceneryTint.bottom, tintTarget.bottom, tintK);

  if (state === S.READY) {
    // bob gently while waiting
    player.y = WORLD.height / 2 + Math.sin(animTime * 3) * 14;
    player.vy = 0;
  } else if (state === S.PLAY) {
    stepPlayer(player, dt);
    const ramp = field.step(dt, PHYS.playerX);
    scrollX += ramp.speed * dt;
    score = field.passedCount;

    // Trigger breath every 10 pillars
    if (score > 0 && score % 10 === 0 && score !== lastBreathAt) {
      lastBreathAt = score;
      breathTimer = BREATH.WARN + BREATH.FLAME;
    }
    if (breathTimer > 0) {
      breathTimer -= dt;
      const inFlame = breathTimer > 0 && breathTimer <= BREATH.FLAME;
      if (inFlame && player.y - cfg.hitboxRadius <= BREATH.BAND_H) {
        die();
        return;
      }
    }

    if (checkDeath(player, cfg.hitboxRadius, field.pillars, FLOOR_Y)) die();
  } else if (state === S.DEAD) {
    // corpse falls into the lava
    if (player.y < FLOOR_Y + 40) {
      player.vy = Math.min(player.vy + PHYS.gravity * dt, PHYS.terminalVy);
      player.y += player.vy * dt;
    }
  }
}

function die() {
  deathLine = cfg.deathLines[Math.floor(Math.random() * cfg.deathLines.length)];
  enter(S.DEAD);
}

// ---------- name entry (DOM overlay) ----------

const nameOverlay = document.getElementById('name-overlay');
const nameContainer = document.getElementById('name-container');
let nameEntryActive = false;

async function showNameEntry() {
  nameEntryActive = true;
  nameOverlay.classList.remove('hidden');
  const rank = rankForScore(board, score);
  const rankLine = document.getElementById('name-rank');
  rankLine.textContent = rank === 1 ? 'NEW TOP SCORE!' :
    Number.isFinite(rank) ? `Rank #${rank} — score ${score}` : `Score ${score}`;
  const initials = await initialsEntry({ container: nameContainer });
  board = addRun(board, initials, score);
  nameOverlay.classList.add('hidden');
  nameEntryActive = false;
  enter(S.ATTRACT);
}

// ---------- render ----------

/**
 * Draw an image scrolling left, mirror-tiled: every second copy is flipped
 * horizontally so ANY image (including real WoW screenshots) loops seamlessly.
 */
function drawMirrorTiled(ctx, img, scrolled, tileW, y, tileH) {
  const off = -(((scrolled % (tileW * 2)) + tileW * 2) % (tileW * 2)); // (-2w, 0]
  for (let i = 0; ; i++) {
    const x = off + i * tileW;
    if (x >= WORLD.width) break;
    if (x + tileW <= 0) continue;
    if (i % 2 === 0) {
      ctx.drawImage(img, x, y, tileW, tileH);
    } else {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(img, -x - tileW, y, tileW, tileH);
      ctx.restore();
    }
  }
}

function drawBackground(ctx) {
  ctx.fillStyle = '#14091c';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const layer of sprites.bgLayers) {
    if (!layer.img) continue;
    drawMirrorTiled(ctx, layer.img, scrollX * layer.speedFactor, WORLD.width, 0, WORLD.height);
  }

  // Stage tint over the background, under pillars/player so they stay readable.
  const [tr, tg, tb, ta] = sceneryTint.top;
  const [br, bg, bb, ba] = sceneryTint.bottom;
  if (ta > 0.01 || ba > 0.01) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    grad.addColorStop(0, `rgba(${tr | 0}, ${tg | 0}, ${tb | 0}, ${ta})`);
    grad.addColorStop(1, `rgba(${br | 0}, ${bg | 0}, ${bb | 0}, ${ba})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  // Embers fade in with the tint from stage 2 (score 20) onward.
  const emberAlpha = Math.max(0, (ta - SCENERY_STAGES[1].top[3]) / 0.15);
  if (emberAlpha > 0.02) {
    for (const e of EMBERS) {
      const x = ((e.x - animTime * e.drift) % WORLD.width + WORLD.width) % WORLD.width;
      const y = ((e.y - animTime * e.rise) % WORLD.height + WORLD.height) % WORLD.height;
      const flicker = 0.5 + 0.5 * Math.sin(animTime * 6 + e.phase);
      ctx.fillStyle = `rgba(255, 170, 70, ${Math.min(1, emberAlpha) * (0.35 + 0.45 * flicker)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(animTime * 2 + e.phase) * 10, y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFloor(ctx) {
  if (sprites.floor) {
    drawMirrorTiled(ctx, sprites.floor, scrollX, 256, FLOOR_Y, cfg.floorHeight);
  } else {
    ctx.fillStyle = '#a3300d';
    ctx.fillRect(0, FLOOR_Y, WORLD.width, cfg.floorHeight);
  }
}

function drawPillars(ctx) {
  if (!field) return;
  for (const p of field.pillars) {
    const topH = p.gapY - p.gapH / 2;
    const botY = p.gapY + p.gapH / 2;
    if (sprites.pillarTop) {
      // anchor image bottom to the gap top edge
      const drawH = 800 * (p.width / 110);
      ctx.drawImage(sprites.pillarTop, p.x, topH - drawH, p.width, drawH);
    } else {
      ctx.fillStyle = '#3b3247';
      ctx.fillRect(p.x, 0, p.width, topH);
    }
    if (sprites.pillarBottom) {
      const drawH = 800 * (p.width / 110);
      ctx.drawImage(sprites.pillarBottom, p.x, botY, p.width, drawH);
    } else {
      ctx.fillStyle = '#3b3247';
      ctx.fillRect(p.x, botY, p.width, WORLD.height - botY);
    }
  }
}

function drawPlayer(ctx) {
  // Sprite drawn well beyond the hitbox: wings/tail can overlap pillars
  // without killing — felt forgiveness, standard for the genre.
  const drawR = cfg.hitboxRadius * 2.6;
  ctx.save();
  ctx.translate(PHYS.playerX, player.y);
  ctx.rotate((state === S.PLAY || state === S.DEAD ? tiltDeg(player.vy) : 0) * Math.PI / 180);
  const frameIdx = Math.floor(animTime * 1000 / cfg.frameMs) % Math.max(1, sprites.frames.length);
  const img = sprites.frames[frameIdx];
  if (img) {
    // warm rim glow so the dark drake stays readable on dark backgrounds
    ctx.shadowColor = 'rgba(255, 154, 43, 0.75)';
    ctx.shadowBlur = 16;
    ctx.drawImage(img, -drawR, -drawR, drawR * 2, drawR * 2);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#8a3fb5';
    ctx.beginPath();
    ctx.arc(0, 0, cfg.hitboxRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBreath(ctx) {
  if (breathTimer <= 0) return;
  const inWarn = breathTimer > BREATH.FLAME;
  if (inWarn) {
    const alpha = 0.4 + 0.3 * Math.sin(animTime * 20);
    ctx.fillStyle = `rgba(255, 106, 43, ${alpha * 0.35})`;
    ctx.fillRect(0, 0, WORLD.width, BREATH.BAND_H);
    ctx.fillStyle = '#ffd25e';
    ctx.font = 'bold 64px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('DEEP BREATH...', WORLD.width / 2, 150);
  } else {
    ctx.fillStyle = 'rgba(255, 80, 20, 0.75)';
    ctx.fillRect(0, 0, WORLD.width, BREATH.BAND_H);
    ctx.fillStyle = 'rgba(255, 200, 90, 0.5)';
    for (let x = 0; x < WORLD.width; x += 90) {
      const fy = BREATH.BAND_H - 24 + Math.sin(animTime * 14 + x) * 18;
      ctx.beginPath();
      ctx.arc(x + 45, fy, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHud(ctx) {
  if (state === S.PLAY || state === S.DEAD) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.font = 'bold 110px Georgia';
    ctx.textAlign = 'center';
    ctx.strokeText(String(score), WORLD.width / 2, 130);
    ctx.fillText(String(score), WORLD.width / 2, 130);
  }
}

function centerText(ctx, text, y, size, color = '#f8b700') {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(4, size / 12);
  ctx.font = `bold ${size}px Georgia`;
  ctx.textAlign = 'center';
  ctx.strokeText(text, WORLD.width / 2, y);
  ctx.fillText(text, WORLD.width / 2, y);
}

function drawAttract(ctx) {
  const phase = attractPhase();
  ctx.fillStyle = 'rgba(8, 6, 3, 0.55)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  if (phase === 'title') {
    centerText(ctx, cfg.title, 280, 120);
    const pulse = 1 + Math.sin(animTime * 4) * 0.05;
    ctx.save();
    ctx.translate(WORLD.width / 2, 460);
    ctx.scale(pulse, pulse);
    ctx.translate(-WORLD.width / 2, -460);
    centerText(ctx, 'TAP OR PRESS SPACE TO PLAY', 460, 44, '#e8dcc3');
    ctx.restore();
  } else if (phase === 'leaderboard') {
    centerText(ctx, 'TOP WHELPS', 140, 72);
    ctx.font = 'bold 42px Georgia';
    ctx.textAlign = 'left';
    const top = board.slice(0, 10);
    if (!top.length) {
      centerText(ctx, 'No scores yet — be the first!', 380, 44, '#e8dcc3');
    }
    top.forEach((e, i) => {
      const y = 230 + i * 52;
      ctx.fillStyle = i === 0 ? '#f8b700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#e8dcc3';
      ctx.fillText(`${i + 1}.`, 470, y);
      ctx.fillText(e.name, 560, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(e.score), 810, y);
      ctx.textAlign = 'left';
    });
  } else {
    centerText(ctx, 'ONE BUTTON.', 260, 76);
    centerText(ctx, 'DODGE THE PILLARS.', 360, 76);
    centerText(ctx, cfg.prizeLine, 480, 48, '#e8dcc3');
  }
}

function render(ctx) {
  drawBackground(ctx);
  drawPillars(ctx);
  drawFloor(ctx);
  drawBreath(ctx);
  drawPlayer(ctx);
  drawHud(ctx);

  if (state === S.ATTRACT) {
    drawAttract(ctx);
  } else if (state === S.READY) {
    centerText(ctx, 'GET READY', 260, 90);
    centerText(ctx, 'TAP TO FLAP', 360, 48, '#e8dcc3');
  } else if (state === S.DEAD) {
    centerText(ctx, deathLine, 280, 72, '#ff8a5e');
    centerText(ctx, `SCORE: ${score}`, 380, 60);
    if (stateTime > 0.8) centerText(ctx, 'TAP TO CONTINUE', 470, 40, '#e8dcc3');
  }

  if (idleWarnSeconds != null) {
    centerText(ctx, `Still playing? Resetting in ${idleWarnSeconds}...`, 620, 40, '#ffd9d0');
  }
}

// ---------- kiosk wiring ----------

let idleWarnSeconds = null;
watchIdle({
  idleMs: 75000,
  isActive: () => state === S.PLAY || state === S.NAME,
  onWarn: s => { idleWarnSeconds = s; },
  onIdle: () => {
    idleWarnSeconds = null;
    if (nameEntryActive) return; // initials entry has its own 20s timeout
    if (state !== S.ATTRACT) enter(S.ATTRACT);
  },
});

const admin = buildAdminOverlay([
  { label: 'Reset game', onClick: () => { admin.hide(); enter(S.ATTRACT); } },
  { label: 'Export leaderboard', onClick: () => downloadJson(board, 'onyxia-leaderboard.json') },
  {
    label: 'Clear leaderboard', danger: true, confirm: 'CLEAR',
    onClick: () => { board = []; saveLocal(LB_KEY, []); backupToServer(LB_KEY, []); admin.hide(); },
  },
  { label: 'Exit fullscreen', onClick: () => document.exitFullscreen?.() },
]);
adminGesture(() => admin.show());
const adminOpen = () => !admin.el.classList.contains('hidden');

// ---------- go ----------

const engine = new Engine(document.getElementById('game'), update, render);
engine.start();
