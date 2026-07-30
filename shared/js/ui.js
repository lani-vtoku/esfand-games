// Shared UI helpers: score count-up animation, arcade initials keyboard.

/**
 * Animate a number counting up inside an element.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} [durationMs]
 * @returns {Promise<void>} resolves when the count finishes
 */
export function countUp(el, target, durationMs = 900) {
  return new Promise(resolve => {
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Arcade-style 3-initial entry with a big touch A–Z grid.
 * Physical keyboard also works (letters, Backspace, Enter).
 * @param {object} opts
 * @param {HTMLElement} opts.container  emptied and filled with the UI
 * @param {number} [opts.timeoutMs]     auto-submit "???" after inactivity (default 20s)
 * @param {string} [opts.prompt]
 * @returns {Promise<string>} 3-char initials (may be "???" on timeout)
 */
export function initialsEntry({ container, timeoutMs = 20000, prompt = 'ENTER YOUR INITIALS' }) {
  return new Promise(resolve => {
    let initials = [];
    let done = false;
    let timeout;

    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };

    const bump = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => finish('???'), timeoutMs);
    };

    container.innerHTML = '';
    const title = document.createElement('h2');
    title.className = 'wow-title';
    title.textContent = prompt;

    const slots = document.createElement('div');
    slots.className = 'osk-slots';
    const slotEls = [0, 1, 2].map(() => {
      const s = document.createElement('div');
      s.className = 'slot';
      slots.appendChild(s);
      return s;
    });

    const render = () => {
      slotEls.forEach((s, i) => {
        s.textContent = initials[i] || '';
        s.classList.toggle('active', i === initials.length);
      });
      okBtn.disabled = initials.length !== 3;
      okBtn.style.opacity = initials.length === 3 ? '1' : '.4';
    };

    const grid = document.createElement('div');
    grid.className = 'osk';
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = ch;
      b.addEventListener('click', () => { addChar(ch); });
      grid.appendChild(b);
    }
    const back = document.createElement('button');
    back.className = 'btn btn-ghost';
    back.textContent = '⌫';
    back.addEventListener('click', () => { initials.pop(); render(); bump(); });
    grid.appendChild(back);

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-huge';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => { if (initials.length === 3) finish(initials.join('')); });

    const addChar = ch => {
      if (initials.length < 3) initials.push(ch);
      render();
      bump();
    };

    const onKey = e => {
      if (/^[a-zA-Z]$/.test(e.key)) addChar(e.key.toUpperCase());
      else if (e.key === 'Backspace') { initials.pop(); render(); bump(); }
      else if (e.key === 'Enter' && initials.length === 3) finish(initials.join(''));
    };
    document.addEventListener('keydown', onKey);

    container.append(title, slots, grid, okBtn);
    render();
    bump();
  });
}

/**
 * Render a leaderboard table into a container.
 * @param {HTMLElement} container
 * @param {Array<{name:string, score:number}>} entries sorted desc
 * @param {number} [limit]
 */
export function renderLeaderboard(container, entries, limit = 10) {
  const rows = entries.slice(0, limit).map((e, i) => `
    <tr class="lb-${i + 1}">
      <td class="lb-rank">${i + 1}.</td>
      <td class="lb-name">${escapeHtml(e.name)}</td>
      <td class="lb-score">${e.score.toLocaleString()}</td>
    </tr>`).join('');
  container.innerHTML = `<table class="lb-table">${rows || '<tr><td>No scores yet — be the first!</td></tr>'}</table>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
