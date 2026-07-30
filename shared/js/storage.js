// Namespaced localStorage wrapper with best-effort server file backup.
// localStorage is the primary store; the server copy (data/<key>.json) exists
// so a cleared browser profile doesn't lose the all-night leaderboard.

const PREFIX = 'esfand.';

/** @returns {any|null} */
export function loadLocal(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocal(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full/blocked — nothing sensible to do on a kiosk
  }
}

/** Fire-and-forget POST to the server backup. Never throws, never blocks. */
export function backupToServer(key, value) {
  fetch(`/api/save/${encodeURIComponent(PREFIX + key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).catch(() => {});
}

/** @returns {Promise<any|null>} server backup copy, or null */
export async function loadServerBackup(key) {
  try {
    const res = await fetch(`/api/save/${encodeURIComponent(PREFIX + key)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Save to localStorage and mirror to server backup. */
export function save(key, value) {
  saveLocal(key, value);
  backupToServer(key, value);
}
