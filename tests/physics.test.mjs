import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD, PHYS, initialPlayer, stepPlayer, flap, tiltDeg, circleRectHit, checkDeath,
} from '../games/onyxia-run/physics.js';
import { rampAt, nextGapY, ObstacleField, RAMP_CAP, GAP_MARGIN, MAX_GAP_JUMP } from '../games/onyxia-run/obstacles.js';

test('flap sets upward velocity', () => {
  const p = initialPlayer();
  flap(p);
  assert.equal(p.vy, PHYS.flapVy);
});

test('gravity accelerates falling, capped at terminal velocity', () => {
  const p = initialPlayer();
  for (let i = 0; i < 600; i++) stepPlayer(p, 1 / 60);
  assert.equal(p.vy, PHYS.terminalVy);
});

test('ceiling clamps instead of killing', () => {
  const p = { y: 5, vy: -600 };
  stepPlayer(p, 1 / 60);
  assert.equal(p.y, 0);
  assert.ok(p.vy >= 0);
  assert.equal(checkDeath(p, 22, [], WORLD.height - 90), false);
});

test('tilt maps rising to -20 and diving to +70', () => {
  assert.equal(tiltDeg(PHYS.flapVy), -20);
  assert.equal(tiltDeg(PHYS.terminalVy), 70);
  assert.ok(tiltDeg(0) > -20 && tiltDeg(0) < 70);
});

test('circleRectHit: inside, grazing, and clear miss', () => {
  const rect = { x: 100, y: 100, w: 50, h: 200 };
  assert.equal(circleRectHit(120, 150, 10, rect), true);   // center inside
  assert.equal(circleRectHit(90, 150, 10, rect), true);    // grazing left edge
  assert.equal(circleRectHit(89, 150, 10, rect), false);   // 1px clear
  assert.equal(circleRectHit(0, 0, 10, rect), false);      // far away
});

test('falling into lava floor kills', () => {
  const floorY = WORLD.height - 90;
  assert.equal(checkDeath({ y: floorY - 23 }, 22, [], floorY), false);
  assert.equal(checkDeath({ y: floorY - 21 }, 22, [], floorY), true);
});

test('pillar collision kills, flying through the gap does not', () => {
  const floorY = WORLD.height - 90;
  const pillar = { x: PHYS.playerX - 55, gapY: 300, gapH: 200, width: 110 };
  assert.equal(checkDeath({ y: 300 }, 22, [pillar], floorY), false);  // centered in gap
  assert.equal(checkDeath({ y: 100 }, 22, [pillar], floorY), true);   // in top pillar
  assert.equal(checkDeath({ y: 500 }, 22, [pillar], floorY), true);   // in bottom pillar
});

test('difficulty ramp lerps and caps', () => {
  const start = rampAt(0);
  const mid = rampAt(RAMP_CAP / 2);
  const max = rampAt(RAMP_CAP);
  assert.equal(start.speed, 260);
  assert.equal(max.speed, 420);
  assert.equal(start.gapH, 260);
  assert.equal(max.gapH, 190);
  assert.ok(mid.speed > start.speed && mid.speed < max.speed);
  assert.deepEqual(rampAt(RAMP_CAP * 10), max); // capped
});

test('nextGapY stays within band and jump limit', () => {
  const floorY = WORLD.height - 90;
  const gapH = 200;
  let prev = null;
  let r = 0;
  const rand = () => { r = (r + 0.37) % 1; return r; };
  for (let i = 0; i < 200; i++) {
    const y = nextGapY(prev, gapH, floorY, rand);
    assert.ok(y >= GAP_MARGIN + gapH / 2 - 1e-9, `too high: ${y}`);
    assert.ok(y <= floorY - GAP_MARGIN - gapH / 2 + 1e-9, `too low: ${y}`);
    if (prev != null) assert.ok(Math.abs(y - prev) <= MAX_GAP_JUMP + 1e-9, 'jump too large');
    prev = y;
  }
});

test('obstacle field spawns, scrolls, counts passes, and culls', () => {
  const field = new ObstacleField(110, WORLD.height - 90, () => 0.5);
  for (let i = 0; i < 60 * 30; i++) field.step(1 / 60, PHYS.playerX); // 30s
  assert.ok(field.passedCount > 5, `expected passes, got ${field.passedCount}`);
  assert.ok(field.pillars.length < 10, 'off-screen pillars should be culled');
  assert.ok(field.pillars.every(p => p.x > -180));
});
