import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertEntry, mergeBoards, rankForScore, MAX_ENTRIES } from '../games/onyxia-run/leaderboard.js';

const e = (name, score, at) => ({ name, score, at });

test('insertEntry sorts desc, earlier run wins ties', () => {
  let board = [];
  board = insertEntry(board, e('AAA', 10, 1));
  board = insertEntry(board, e('BBB', 30, 2));
  board = insertEntry(board, e('CCC', 30, 3));
  assert.deepEqual(board.map(x => x.name), ['BBB', 'CCC', 'AAA']);
});

test('insertEntry trims to max', () => {
  let board = [];
  for (let i = 0; i < MAX_ENTRIES + 10; i++) board = insertEntry(board, e('P' + i, i, i));
  assert.equal(board.length, MAX_ENTRIES);
  assert.equal(board[0].score, MAX_ENTRIES + 9);
});

test('mergeBoards unions distinct runs and dedupes identical ones', () => {
  const local = [e('AAA', 50, 100), e('BBB', 20, 200)];
  const backup = [e('AAA', 50, 100), e('AAA', 40, 300), e('CCC', 60, 50)];
  const merged = mergeBoards(local, backup);
  assert.equal(merged.length, 4); // AAA@100 deduped; AAA@300 is a distinct run
  assert.deepEqual(merged.map(x => x.name), ['CCC', 'AAA', 'AAA', 'BBB']);
});

test('mergeBoards drops malformed entries and handles null inputs', () => {
  const merged = mergeBoards([{ bogus: true }, e('AAA', 5, 1), null], null);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, 'AAA');
});

test('rankForScore', () => {
  const board = [e('A', 100, 1), e('B', 50, 2), e('C', 10, 3)];
  assert.equal(rankForScore(board, 200), 1);
  assert.equal(rankForScore(board, 60), 2);
  assert.equal(rankForScore(board, 5), 4);
  assert.equal(rankForScore(board, 100), 2); // tie goes below existing
});
