// Kiosk utilities: input guards, fullscreen, idle→attract timing, admin gesture.

/**
 * Lock down the page for kiosk use: no context menu, selection, drag,
 * pinch zoom, scroll keys, or accidental Back navigation.
 */
export function guardInputs() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  // Block scroll/zoom keys; leave F11/F12 alone for dev.
  document.addEventListener('keydown', e => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)
        && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  // Back-button trap: push a state so Back stays on the page.
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));
}

/**
 * Request fullscreen on first user interaction unless already fullscreen
 * (kiosk-mode browsers launch fullscreen; this is the fallback path).
 */
export function fullscreenOnFirstInteraction() {
  const tryFs = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    document.removeEventListener('pointerdown', tryFs);
  };
  document.addEventListener('pointerdown', tryFs);
}

/**
 * Idle watcher. Any pointer/key activity resets the timer.
 * @param {object} opts
 * @param {number} opts.idleMs        ms of inactivity before firing
 * @param {() => boolean} [opts.isActive]  return true if a game is in progress
 *        (idle then shows a countdown warning instead of resetting instantly)
 * @param {number} [opts.warnMs]      countdown length for mid-game idle (default 10s)
 * @param {(remaining:number|null) => void} [opts.onWarn] called each second with
 *        seconds remaining, and with null when the warning is cancelled
 * @param {() => void} opts.onIdle    called when the reset should happen
 */
export function watchIdle({ idleMs, isActive = () => false, warnMs = 10000, onWarn = () => {}, onIdle }) {
  let idleTimer = null;
  let warnTimer = null;
  let warnTick = null;

  const cancelWarn = () => {
    if (warnTimer) { clearTimeout(warnTimer); warnTimer = null; }
    if (warnTick) { clearInterval(warnTick); warnTick = null; onWarn(null); }
  };

  const fire = () => {
    if (isActive()) {
      let remaining = Math.round(warnMs / 1000);
      onWarn(remaining);
      warnTick = setInterval(() => { remaining -= 1; if (remaining > 0) onWarn(remaining); }, 1000);
      warnTimer = setTimeout(() => { cancelWarn(); onIdle(); }, warnMs);
    } else {
      onIdle();
    }
  };

  const reset = () => {
    cancelWarn();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(fire, idleMs);
  };

  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'touchstart']) {
    document.addEventListener(ev, reset, { passive: true });
  }
  reset();
  return { reset };
}

/**
 * Hidden admin gesture: 5 taps in the top-left 100x100 corner within 3s,
 * or Ctrl+Shift+A. Calls onTrigger.
 */
export function adminGesture(onTrigger) {
  let taps = [];
  document.addEventListener('pointerdown', e => {
    if (e.clientX <= 100 && e.clientY <= 100) {
      const now = performance.now();
      taps = taps.filter(t => now - t < 3000);
      taps.push(now);
      if (taps.length >= 5) { taps = []; onTrigger(); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); onTrigger(); }
  });
}

/**
 * Build a standard admin overlay with custom action buttons.
 * @param {Array<{label:string, danger?:boolean, confirm?:string, onClick:() => void}>} actions
 *        confirm: if set, user must type this word in a prompt-style input first.
 * @returns {{show:() => void, hide:() => void, el:HTMLElement}}
 */
export function buildAdminOverlay(actions) {
  const el = document.createElement('div');
  el.className = 'overlay admin-overlay hidden';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.className = 'wow-title';
  title.textContent = 'Admin';
  panel.appendChild(title);

  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (a.danger ? ' btn-danger' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      if (a.confirm) {
        const typed = window.prompt(`Type "${a.confirm}" to confirm:`);
        if (typed !== a.confirm) return;
      }
      a.onClick();
    });
    panel.appendChild(btn);
  }

  const close = document.createElement('button');
  close.className = 'btn btn-ghost';
  close.textContent = 'Close';
  close.addEventListener('click', () => hide());
  panel.appendChild(close);

  el.appendChild(panel);
  document.body.appendChild(el);
  const show = () => el.classList.remove('hidden');
  const hide = () => el.classList.add('hidden');
  return { show, hide, el };
}

/** Download a JS value as a JSON file (leaderboard export). */
export function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
