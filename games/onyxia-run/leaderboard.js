// Leaderboard: pure operations on entry arrays + persistence wiring.
// Entries: {name: "ABC", score: 42, at: 1690000000000}

import { loadLocal, save, loadServerBackup } from '../../shared/js/storage.js';

export const LB_KEY = 'onyxia.leaderboard.v1';
export const MAX_ENTRIES = 50;

/**
 * Insert an entry, sort desc by score (ties: earlier first), trim to max.
 * Pure — returns a new array.
 * @param {Array<{name:string, score:number, at:number}>} entries
 * @param {{name:string, score:number, at:number}} entry
 */
export function insertEntry(entries, entry, max = MAX_ENTRIES) {
  return [...entries, entry]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, max);
}

/**
 * Merge two leaderboard arrays (localStorage + server backup): union keyed by
 * name+at (so distinct runs by the same initials all survive), sorted, trimmed.
 * Pure.
 */
export function mergeBoards(a, b, max = MAX_ENTRIES) {
  const seen = new Map();
  for (const e of [...(a || []), ...(b || [])]) {
    if (!e || typeof e.score !== 'number' || typeof e.name !== 'string') continue;
    const key = `${e.name}|${e.at}|${e.score}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()]
    .sort((x, y) => y.score - x.score || x.at - y.at)
    .slice(0, max);
}

/** @returns {number} rank (1-based) this score would land at, or Infinity if off-board */
export function rankForScore(entries, score, max = MAX_ENTRIES) {
  const idx = entries.findIndex(e => score > e.score);
  const rank = idx === -1 ? entries.length + 1 : idx + 1;
  return rank <= max ? rank : Infinity;
}

// ---------- persistence ----------

/**
 * Load the leaderboard: localStorage merged with the server file backup.
 * If the merge added anything, persist the merged result back.
 * @returns {Promise<Array>}
 */
export async function loadBoard() {
  const local = loadLocal(LB_KEY) || [];
  const backup = await loadServerBackup(LB_KEY);
  const merged = mergeBoards(local, backup || []);
  if (merged.length !== local.length) save(LB_KEY, merged);
  return merged;
}

/**
 * Add a run and persist (localStorage + server backup).
 * @param {Array} entries current board
 * @param {string} name
 * @param {number} score
 * @returns {Array} new board
 */
export function addRun(entries, name, score) {
  const board = insertEntry(entries, { name, score, at: Date.now() });
  save(LB_KEY, board);
  return board;
}
