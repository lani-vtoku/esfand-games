import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreGuess, distance, fullPointsRadius, rankTitle, pickRound } from '../games/geoguessr/scoring.js';

const MAP = { mapW: 2048, mapH: 1536 };
const DIAG = Math.hypot(MAP.mapW, MAP.mapH); // 2560

test('perfect guess scores max', () => {
  assert.equal(scoreGuess({ dist: 0, ...MAP }), 1000);
});

test('anywhere inside full-points radius scores max', () => {
  const rFull = fullPointsRadius(MAP.mapW, MAP.mapH, 3);
  assert.equal(scoreGuess({ dist: rFull, ...MAP }), 1000);
  assert.equal(scoreGuess({ dist: rFull - 1, ...MAP }), 1000);
});

test('score decays monotonically with distance', () => {
  let prev = Infinity;
  for (let d = 0; d <= DIAG; d += 50) {
    const s = scoreGuess({ dist: d, ...MAP });
    assert.ok(s <= prev, `score increased at d=${d}`);
    assert.ok(s >= 0 && s <= 1000);
    prev = s;
  }
});

test('cross-map miss scores near zero', () => {
  assert.ok(scoreGuess({ dist: DIAG, ...MAP }) <= 50);
});

test('distance is euclidean', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('rank titles cover the range', () => {
  assert.equal(rankTitle(5000, 5000), 'Explorer of Azeroth');
  assert.equal(rankTitle(0, 5000), 'Zone Novice');
  assert.notEqual(rankTitle(3000, 5000), 'Explorer of Azeroth');
});

test('pickRound skips uncalibrated and never repeats', () => {
  const locs = [
    { id: 'a', map: { x: 1, y: 1 } },
    { id: 'b', map: null },
    { id: 'c', map: { x: 2, y: 2 } },
    { id: 'd', map: { x: 3, y: 3 } },
    { id: 'e' },
  ];
  for (let i = 0; i < 20; i++) {
    const picked = pickRound(locs, 3);
    assert.equal(picked.length, 3);
    assert.equal(new Set(picked.map(l => l.id)).size, 3);
    assert.ok(picked.every(l => l.map));
  }
});

test('pickRound returns what exists when pool is short', () => {
  const locs = [{ id: 'a', map: { x: 1, y: 1 } }];
  assert.equal(pickRound(locs, 5).length, 1);
});
