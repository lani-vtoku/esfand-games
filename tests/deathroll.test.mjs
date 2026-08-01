import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, roll, maxRoll, clampAnte } from '../games/deathroll/deathroll.js';

test('new game: pot is double the ante, first roll is 1..ante', () => {
  const g = createGame({ ante: 250 });
  assert.equal(g.pot, 500);
  assert.equal(g.ceiling, 250);
  assert.equal(g.turn, 1);
  assert.equal(g.over, false);
});

test('first roll caps at the ante', () => {
  let g = createGame({ ante: 500 });
  g = roll(g, () => 0.999); // max roll
  assert.equal(g.ceiling, 500);
});

test('roll becomes the new ceiling; later rolls land below the previous roll', () => {
  let g = createGame();
  g = roll(g, () => 0.999); // opening roll can hit the full wager
  assert.equal(g.ceiling, 100);
  g = roll(g, () => 0.5);   // max is now 99
  assert.equal(g.ceiling, 50);
  g = roll(g, () => 0.5);   // max is now 49
  assert.equal(g.ceiling, 25);
});

test('rolls strictly decrease after the first — no 2 → 2 → 2 stall', () => {
  let g = createGame({ ante: 100 });
  g = roll(g, () => 0.999);
  let prev = g.ceiling;
  while (!g.over) {
    g = roll(g, () => 0.999); // always roll the maximum allowed
    assert.ok(g.ceiling < prev, `ceiling did not shrink: ${prev} → ${g.ceiling}`);
    prev = g.ceiling;
  }
  assert.equal(g.history.length, 100); // 100, 99, 98 … 1: guaranteed end
});

test('facing a 2 is the death roll — only a 1 can come next', () => {
  let g = createGame({ ante: 100 });
  g = roll(g, () => 1 / 100);  // P1 rolls a 2 (1 + floor(0.01 * 100))
  assert.equal(g.ceiling, 2);
  assert.equal(maxRoll(g), 1);
  g = roll(g, () => 0.999);    // even the luckiest roll is the 1
  assert.equal(g.over, true);
  assert.equal(g.loser, 2);
});

test('turns alternate and history records each roll', () => {
  let g = createGame();
  g = roll(g, () => 0.7);
  assert.equal(g.turn, 2);
  g = roll(g, () => 0.7);
  assert.equal(g.turn, 1);
  assert.equal(g.history.length, 2);
  assert.deepEqual(g.history.map(h => h.player), [1, 2]);
});

test('rolling a 1 ends the game — roller loses, other player wins', () => {
  let g = createGame({ ante: 100 });
  g = roll(g, () => 0.5);  // P1 rolls 51
  g = roll(g, () => 0);    // P2 rolls 1
  assert.equal(g.over, true);
  assert.equal(g.loser, 2);
  assert.equal(g.winner, 1);
  assert.equal(g.pot, 200);
});

test('rolls after the game is over are ignored', () => {
  let g = createGame();
  g = roll(g, () => 0); // P1 instantly rolls the 1
  const frozen = roll(g, () => 0.5);
  assert.deepEqual(frozen, g);
});

test('roll never mutates the previous state', () => {
  const g = createGame();
  roll(g, () => 0.5);
  assert.equal(g.ceiling, 100);
  assert.equal(g.history.length, 0);
});

test('a full game always terminates', () => {
  for (let i = 0; i < 200; i++) {
    let g = createGame();
    let guard = 10_000;
    while (!g.over && guard-- > 0) g = roll(g);
    assert.ok(g.over, 'game did not end');
    assert.ok([1, 2].includes(g.winner));
    assert.notEqual(g.winner, g.loser);
  }
});

test('clampAnte enforces the 100-coin minimum and snaps to steps', () => {
  assert.equal(clampAnte(0), 100);
  assert.equal(clampAnte(-500), 100);
  assert.equal(clampAnte(100), 100);
  assert.equal(clampAnte(160), 150);
  assert.equal(clampAnte(999_999), 10000);
  assert.equal(clampAnte(NaN), 100);
});
