import { bust } from '../../shared/js/manifest.js';

// Map widget for WoW GeoGuessr: renders the world map in a container,
// converts clicks/drags to natural-pixel map coords, shows pins and the
// reveal line. All coordinates exposed to callers are in the map image's
// natural pixel space (manifest coordinates are display-independent).

export class MapWidget {
  /**
   * @param {HTMLElement} container positioned element the map fills
   * @param {{image:string, width:number, height:number}} mapCfg from manifest
   */
  constructor(container, mapCfg) {
    this.container = container;
    this.mapW = mapCfg.width;
    this.mapH = mapCfg.height;

    container.classList.add('mapw');
    this.img = document.createElement('img');
    this.img.src = bust('assets/' + mapCfg.image);
    this.img.className = 'mapw-img';
    this.img.draggable = false;

    this.layer = document.createElement('div'); // pin/line layer, same box as img
    this.layer.className = 'mapw-layer';

    container.append(this.img, this.layer);

    this.guessPin = null;
    this.truthPin = null;
    this.line = null;
    this.onGuessMoved = null; // callback({x,y} natural coords)

    this._dragging = false;
    container.addEventListener('pointerdown', e => this._pointer(e, true));
    container.addEventListener('pointermove', e => { if (this._dragging) this._pointer(e, false); });
    window.addEventListener('pointerup', () => { this._dragging = false; });
    this.interactive = false;
  }

  /** Displayed geometry of the map image inside the container (letterboxed). */
  _viewBox() {
    const cw = this.container.clientWidth, ch = this.container.clientHeight;
    const scale = Math.min(cw / this.mapW, ch / this.mapH);
    const w = this.mapW * scale, h = this.mapH * scale;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scale };
  }

  _pointer(e, isDown) {
    if (!this.interactive) return;
    const rect = this.container.getBoundingClientRect();
    const vb = this._viewBox();
    const nx = (e.clientX - rect.left - vb.x) / vb.scale;
    const ny = (e.clientY - rect.top - vb.y) / vb.scale;
    if (nx < 0 || ny < 0 || nx > this.mapW || ny > this.mapH) return;
    if (isDown) this._dragging = true;
    this.setGuess({ x: nx, y: ny });
    this.onGuessMoved?.(this.guess);
  }

  /** Convert natural coords → CSS position inside the container. */
  _toCss(pt) {
    const vb = this._viewBox();
    return { left: vb.x + pt.x * vb.scale, top: vb.y + pt.y * vb.scale };
  }

  _makePin(cls) {
    const el = document.createElement('div');
    el.className = 'mapw-pin ' + cls;
    this.layer.appendChild(el);
    return el;
  }

  setGuess(pt) {
    this.guess = pt;
    if (!this.guessPin) this.guessPin = this._makePin('mapw-pin-guess');
    this._place(this.guessPin, pt);
  }

  showTruth(pt) {
    this.truth = pt;
    if (!this.truthPin) this.truthPin = this._makePin('mapw-pin-truth');
    this._place(this.truthPin, pt);
    if (this.guess) this._drawLine(this.guess, pt);
  }

  _place(pin, pt) {
    const css = this._toCss(pt);
    pin.style.left = css.left + 'px';
    pin.style.top = css.top + 'px';
  }

  _drawLine(a, b) {
    if (!this.line) {
      this.line = document.createElement('div');
      this.line.className = 'mapw-line';
      this.layer.appendChild(this.line);
    }
    const ca = this._toCss(a), cb = this._toCss(b);
    const dx = cb.left - ca.left, dy = cb.top - ca.top;
    const len = Math.hypot(dx, dy);
    this.line.style.left = ca.left + 'px';
    this.line.style.top = ca.top + 'px';
    this.line.style.width = '0px';
    this.line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    // animate the line growing out to the truth pin
    requestAnimationFrame(() => { this.line.style.width = len + 'px'; });
  }

  /** Re-place pins after a container resize/expand. */
  refresh() {
    if (this.guess && this.guessPin) this._place(this.guessPin, this.guess);
    if (this.truth && this.truthPin) this._place(this.truthPin, this.truth);
    if (this.guess && this.truth && this.line) {
      this.line.remove();
      this.line = null;
      this._drawLine(this.guess, this.truth);
    }
  }

  reset() {
    this.guess = null;
    this.truth = null;
    for (const el of [this.guessPin, this.truthPin, this.line]) el?.remove();
    this.guessPin = this.truthPin = this.line = null;
  }
}
