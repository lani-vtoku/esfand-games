// Pure scoring for WoW GeoGuessr — unit-testable, no DOM.

/**
 * @param {object} opts
 * @param {number} opts.dist      guess→truth distance in map pixels
 * @param {number} opts.mapW      map natural width
 * @param {number} opts.mapH      map natural height
 * @param {number} [opts.pointsPerRound]
 * @param {number} [opts.fullPointsRadiusPct]  % of map diagonal that scores max
 * @param {number} [opts.decayPct]             exponential decay constant as % of diagonal
 * @returns {number} 0..pointsPerRound
 */
export function scoreGuess({ dist, mapW, mapH, pointsPerRound = 1000, fullPointsRadiusPct = 3, decayPct = 12 }) {
  const diag = Math.hypot(mapW, mapH);
  const rFull = (fullPointsRadiusPct / 100) * diag;
  const tau = (decayPct / 100) * diag;
  if (dist <= rFull) return pointsPerRound;
  return Math.round(pointsPerRound * Math.exp(-(dist - rFull) / tau));
}

/** Euclidean distance between two {x,y} points. */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Full-points radius in map pixels (used by the calibrate page preview ring).
 */
export function fullPointsRadius(mapW, mapH, fullPointsRadiusPct = 3) {
  return (fullPointsRadiusPct / 100) * Math.hypot(mapW, mapH);
}

/**
 * Flavor distance for the reveal screen: map pixels → "leagues".
 * Purely cosmetic; tuned so a cross-map miss is a few hundred leagues.
 */
export function toLeagues(distPx, mapW, mapH) {
  const diag = Math.hypot(mapW, mapH);
  return Math.round((distPx / diag) * 500);
}

/**
 * Rank title for the total screen.
 * @param {number} total @param {number} maxTotal
 */
export function rankTitle(total, maxTotal) {
  const pct = maxTotal > 0 ? total / maxTotal : 0;
  if (pct >= 0.95) return 'Explorer of Azeroth';
  if (pct >= 0.8) return 'Seasoned Cartographer';
  if (pct >= 0.6) return 'Seasoned Traveler';
  if (pct >= 0.4) return 'Wandering Adventurer';
  if (pct >= 0.2) return 'Lost in Barrens Chat';
  return 'Zone Novice';
}

/**
 * Pick n random calibrated locations without repeats.
 * @param {Array<{map?: {x:number,y:number}|null}>} locations
 * @param {number} n
 * @param {() => number} [rand]
 */
export function pickRound(locations, n, rand = Math.random) {
  const pool = locations.filter(l => l.map && typeof l.map.x === 'number' && typeof l.map.y === 'number');
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
