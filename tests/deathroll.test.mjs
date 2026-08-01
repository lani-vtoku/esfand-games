import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, roll, clampAnte } from '../games/deathroll/deathroll.js';

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

test('roll stays within 1..ceiling and becomes the new ceiling', () => {
  let g = createGame();
  g = roll(g, () => 0.999); // max roll
  assert.equal(g.ceiling, 100);
  g = roll(g, () => 0.5);
  assert.equal(g.ceiling, 51);
  g = roll(g, () => 0.5);
  assert.equal(g.ceiling, 26);
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
