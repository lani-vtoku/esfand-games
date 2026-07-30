// Pure physics for Onyxia Run. No DOM, no canvas — unit-testable.

export const WORLD = { width: 1280, height: 720 };

export const PHYS = {
  gravity: 2200,       // px/s²
  flapVy: -620,        // flap sets vy directly
  terminalVy: 900,     // max fall speed
  playerX: 320,        // fixed horizontal position
};

/** @returns {{y:number, vy:number}} initial player state */
export function initialPlayer() {
  return { y: WORLD.height / 2, vy: 0 };
}

/**
 * Advance the player one timestep. Ceiling clamps (doesn't kill).
 * @param {{y:number, vy:number}} p mutated in place
 * @param {number} dt seconds
 */
export function stepPlayer(p, dt) {
  p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.terminalVy);
  p.y += p.vy * dt;
  if (p.y < 0) { p.y = 0; p.vy = Math.max(p.vy, 0); }
}

/** @param {{y:number, vy:number}} p */
export function flap(p) {
  p.vy = PHYS.flapVy;
}

/**
 * Player tilt in degrees for rendering: -20° rising → +70° diving.
 * @param {number} vy
 */
export function tiltDeg(vy) {
  const t = clamp01((vy - PHYS.flapVy) / (PHYS.terminalVy - PHYS.flapVy));
  return -20 + t * 90;
}

/**
 * Circle vs axis-aligned rectangle intersection.
 * @param {number} cx @param {number} cy @param {number} r
 * @param {{x:number, y:number, w:number, h:number}} rect
 */
export function circleRectHit(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Did the player hit anything lethal this frame?
 * @param {{y:number}} p player
 * @param {number} radius hitbox radius
 * @param {Array<{x:number, gapY:number, gapH:number, width:number}>} pillars
 * @param {number} floorY top of the lava floor
 * @returns {boolean}
 */
export function checkDeath(p, radius, pillars, floorY) {
  if (p.y + radius >= floorY) return true;
  const cx = PHYS.playerX;
  for (const pl of pillars) {
    if (pl.x > cx + radius + pl.width || pl.x + pl.width < cx - radius - pl.width) continue;
    const topRect = { x: pl.x, y: 0, w: pl.width, h: pl.gapY - pl.gapH / 2 };
    const botRect = { x: pl.x, y: pl.gapY + pl.gapH / 2, w: pl.width, h: WORLD.height - (pl.gapY + pl.gapH / 2) };
    if (circleRectHit(cx, p.y, radius, topRect) || circleRectHit(cx, p.y, radius, botRect)) return true;
  }
  return false;
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function clamp01(v) { return clamp(v, 0, 1); }
