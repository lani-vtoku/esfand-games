// Pure Death Roll logic — unit-testable, no DOM.
//
// Classic WoW death roll: both players ante up, first roll is 1–100, then each
// player rolls 1–(previous roll) in turn. Whoever rolls the 1 loses the pot.

/**
 * @param {object} [opts]
 * @param {number} [opts.ante]      coins each player puts in
 * @param {number} [opts.startRoll] ceiling of the first roll
 */
export function createGame({ ante = 100, startRoll = 100 } = {}) {
  return {
    ante,
    pot: ante * 2,
    ceiling: startRoll,   // next roll is 1..ceiling
    turn: 1,              // whose roll is next: 1 | 2
    history: [],          // [{ player, roll }]
    over: false,
    winner: null,
    loser: null,
  };
}

/**
 * Roll for the current player. Returns a new state; never mutates.
 * @param {ReturnType<createGame>} state
 * @param {() => number} [rand] 0..1, injectable for tests
 */
export function roll(state, rand = Math.random) {
  if (state.over) return state;
  const value = 1 + Math.floor(rand() * state.ceiling);
  const player = state.turn;
  const next = {
    ...state,
    ceiling: value,
    history: [...state.history, { player, roll: value }],
    turn: player === 1 ? 2 : 1,
  };
  if (value === 1) {
    next.over = true;
    next.loser = player;
    next.winner = player === 1 ? 2 : 1;
  }
  return next;
}

/** Snap an ante to the allowed range/step for the wager stepper (100-coin minimum). */
export function clampAnte(n, { min = 100, max = 10000, step = 50 } = {}) {
  if (!Number.isFinite(n)) return min;
  const snapped = Math.round(n / step) * step;
  return Math.min(max, Math.max(min, snapped));
}
