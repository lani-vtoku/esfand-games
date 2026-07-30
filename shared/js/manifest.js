// Manifest loader with friendly, non-dev-readable error screens.
// Organizers edit manifest.json by hand; when they break it, the game should
// say exactly what is wrong instead of showing a blank page.

/**
 * Fetch and parse a manifest.json. On failure shows a full-screen error
 * naming the file and the problem, and returns a promise that never resolves
 * (the game simply doesn't start).
 * @param {string} url e.g. 'assets/manifest.json'
 * @returns {Promise<any>}
 */
export async function loadManifest(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    showError(`Could not reach the server while loading <code>${url}</code>.`,
      'Is start-server.bat running?');
    return neverResolve();
  }
  if (!res.ok) {
    showError(`Missing file: <code>${url}</code>`,
      'The manifest.json file for this game was not found. Check the assets folder.');
    return neverResolve();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    showError(`<code>${url}</code> is not valid JSON.`,
      `Error: ${err.message}.<br>Tip: check for a missing comma or quote near the location mentioned above. ` +
      'You can paste the file into an online JSON checker to find the exact spot.');
    return neverResolve();
  }
}

/**
 * Preload an image; resolves with the HTMLImageElement or null if it fails
 * (callers use built-in fallback rendering when null).
 * @param {string} src
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Show a friendly full-screen error. Used for manifest problems that a
 * non-dev organizer needs to fix.
 * @param {string} headline HTML
 * @param {string} detail HTML
 */
export function showError(headline, detail) {
  let el = document.querySelector('.manifest-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'manifest-error';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <h1>Asset problem</h1>
    <p style="font-size:1.4rem">${headline}</p>
    <p>${detail}</p>
    <p style="opacity:.7">Fix the file, then refresh this page (F5).</p>`;
}

function neverResolve() {
  return new Promise(() => {});
}
