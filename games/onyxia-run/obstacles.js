// Obstacle spawning and difficulty ramp for Onyxia Run.
// The ramp is a pure function of pillars passed — unit-testable.

import { WORLD, clamp01 } from './physics.js';

export const RAMP_CAP = 40;   // pillars-passed count at which the gap stops shrinking
export const SPEED_CAP = 100; // pillars-passed count at which scroll speed stops climbing

/**
 * Difficulty parameters as a function of pillars passed.
 * Phase 1 (0..RAMP_CAP): everything ramps — speed up, gap shrinks, spawns tighten.
 * Phase 2 (RAMP_CAP..SPEED_CAP): the gap holds at minimum but speed keeps
 * climbing, with spawnInterval shrinking in step so pillar spacing stays
 * roughly constant — less reaction time, not more room.
 * @param {number} n pillars passed
 * @returns {{speed:number, gapH:number, spawnInterval:number}}
 */
export function rampAt(n) {
  const t = clamp01(n / RAMP_CAP);
  const t2 = clamp01((n - RAMP_CAP) / (SPEED_CAP - RAMP_CAP));
  const lerp = (a, b, u) => a + (b - a) * u;
  return {
    speed: t2 > 0 ? lerp(420, 560, t2) : lerp(260, 420, t),           // px/s scroll speed
    gapH: lerp(260, 190, t),                                          // gap height px
    spawnInterval: t2 > 0 ? lerp(1.35, 1.01, t2) : lerp(1.9, 1.35, t), // seconds between pillars
  };
}

export const GAP_MARGIN = 90;      // gap center keeps this far from ceiling
export const MAX_GAP_JUMP = 180;   // consecutive gap centers move at most this much

/**
 * Choose the next gap center Y, random within the safe band but no more than
 * MAX_GAP_JUMP from the previous gap so the ramp stays fair.
 * @param {number|null} prevGapY previous pillar's gap center (null for first)
 * @param {number} gapH current gap height
 * @param {number} floorY top of lava floor
 * @param {() => number} [rand] 0..1 source (injectable for tests)
 * @returns {number}
 */
export function nextGapY(prevGapY, gapH, floorY, rand = Math.random) {
  let lo = GAP_MARGIN + gapH / 2;
  let hi = floorY - GAP_MARGIN - gapH / 2;
  if (prevGapY != null) {
    lo = Math.max(lo, prevGapY - MAX_GAP_JUMP);
    hi = Math.min(hi, prevGapY + MAX_GAP_JUMP);
  }
  if (hi < lo) hi = lo;
  return lo + rand() * (hi - lo);
}

/**
 * Obstacle field: owns the pillar list, spawn timing, and pass-counting.
 * step() is deterministic given the injected rand.
 */
export class ObstacleField {
  /**
   * @param {number} pillarWidth
   * @param {number} floorY
   * @param {() => number} [rand]
   */
  constructor(pillarWidth, floorY, rand = Math.random) {
    this.pillarWidth = pillarWidth;
    this.floorY = floorY;
    this.rand = rand;
    /** @type {Array<{x:number, gapY:number, gapH:number, width:number, passed:boolean}>} */
    this.pillars = [];
    this.passedCount = 0;
    this.spawnTimer = 1.2; // first pillar arrives quickly but not instantly
  }

  /**
   * @param {number} dt seconds
   * @param {number} playerX pillars are "passed" when their center crosses this
   */
  step(dt, playerX) {
    const ramp = rampAt(this.passedCount);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += ramp.spawnInterval;
      const prev = this.pillars.length ? this.pillars[this.pillars.length - 1].gapY : null;
      this.pillars.push({
        x: WORLD.width + 40,
        gapY: nextGapY(prev, ramp.gapH, this.floorY, this.rand),
        gapH: ramp.gapH,
        width: this.pillarWidth,
        passed: false,
      });
    }
    for (const p of this.pillars) {
      p.x -= ramp.speed * dt;
      if (!p.passed && p.x + p.width / 2 < playerX) {
        p.passed = true;
        this.passedCount += 1;
      }
    }
    this.pillars = this.pillars.filter(p => p.x + p.width > -60);
    return ramp;
  }
}
