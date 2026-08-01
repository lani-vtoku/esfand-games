// Zoomable, pannable guess map for WoW GeoGuessr (GeoGuessr/LostGamer style).
// All coordinates exposed to callers are in the map image's natural pixel
// space (manifest coordinates are display-independent).
//
// Interaction: drag pans, wheel/pinch/buttons zoom, a short tap places the
// guess pin (when `interactive`). Pins keep constant on-screen size via
// counter-scaling; the reveal line is SVG with non-scaling stroke.

import { bust } from '../../shared/js/manifest.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_ZOOM = 8;
const TAP_SLOP = 8; // px of movement that still counts as a tap

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

    this.stage = document.createElement('div');
    this.stage.className = 'mapw-stage';
    this.stage.style.width = this.mapW + 'px';
    this.stage.style.height = this.mapH + 'px';

    this.img = document.createElement('img');
    this.img.className = 'mapw-img';
    this.img.src = bust('assets/' + mapCfg.image);
    this.img.draggable = false;

    // SVG overlay for the reveal line + calibrate ring (scales with the map,
    // stroke thickness stays constant via non-scaling-stroke).
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.mapW} ${this.mapH}`);
    this.svg.setAttribute('width', this.mapW);
    this.svg.setAttribute('height', this.mapH);
    this.svg.classList.add('mapw-svg');

    this.layer = document.createElement('div');
    this.layer.className = 'mapw-layer';

    this.stage.append(this.img, this.svg, this.layer);
    container.appendChild(this.stage);

    // Zoom buttons
    this.btns = document.createElement('div');
    this.btns.className = 'mapw-zoombtns';
    for (const [label, fn] of [
      ['+', () => this.zoomCenter(1.5)],
      ['−', () => this.zoomCenter(1 / 1.5)],
      ['⌂', () => this.resetView()],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', e => { e.stopPropagation(); fn(); });
      this.btns.appendChild(b);
    }
    container.appendChild(this.btns);

    this.zoom = 1;
    this.tx = 0; this.ty = 0;
    this.interactive = false;
    this.onGuessMoved = null;
    this.guess = null;
    this.truth = null;
    this.guessPin = null;
    this.truthPin = null;
    this.line = null;
    this.ring = null;
    this._counterScaled = new Set();
    this._pointers = new Map();
    this._pinch = null;
    this._downAt = null;
    this._dragging = false;

    container.addEventListener('pointerdown', e => this._down(e));
    container.addEventListener('pointermove', e => this._move(e));
    container.addEventListener('pointerup', e => this._up(e));
    container.addEventListener('pointercancel', e => this._cancel(e));
    container.addEventListener('wheel', e => {
      e.preventDefault();
      this._zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    }, { passive: false });
    window.addEventListener('resize', () => this.refresh());

    this.resetView();
  }

  // ---------------- view state ----------------

  get baseScale() {
    return Math.min(this.container.clientWidth / this.mapW, this.container.clientHeight / this.mapH) || 1;
  }

  get scale() { return this.baseScale * this.zoom; }

  resetView() {
    this.zoom = 1;
    this._center();
    this._apply();
  }

  _center() {
    this.tx = (this.container.clientWidth - this.mapW * this.scale) / 2;
    this.ty = (this.container.clientHeight - this.mapH * this.scale) / 2;
  }

  _clamp() {
    const cw = this.container.clientWidth, ch = this.container.clientHeight;
    const w = this.mapW * this.scale, h = this.mapH * this.scale;
    this.tx = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, this.tx));
    this.ty = h <= ch ? (ch - h) / 2 : Math.min(0, Math.max(ch - h, this.ty));
  }

  _apply() {
    this._clamp();
    this.stage.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    for (const el of this._counterScaled) {
      el.style.transform = `scale(${1 / this.scale})`;
    }
  }

  _zoomAt(clientX, clientY, factor) {
    const rect = this.container.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const oldScale = this.scale;
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, this.zoom * factor));
    const k = this.scale / oldScale;
    this.tx = px - k * (px - this.tx);
    this.ty = py - k * (py - this.ty);
    this._apply();
  }

  zoomCenter(factor) {
    const rect = this.container.getBoundingClientRect();
    this._zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  /** Animate the view to fit two points (reveal). */
  fitBounds(a, b, marginFrac = 0.35) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const bw = Math.max(80, maxX - minX), bh = Math.max(80, maxY - minY);
    const cw = this.container.clientWidth, ch = this.container.clientHeight;
    const target = Math.min(cw / (bw * (1 + marginFrac)), ch / (bh * (1 + marginFrac)));
    this.zoom = Math.min(MAX_ZOOM, Math.max(1, target / this.baseScale));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this.tx = cw / 2 - cx * this.scale;
    this.ty = ch / 2 - cy * this.scale;
    this.stage.style.transition = 'transform .6s ease';
    setTimeout(() => { this.stage.style.transition = ''; }, 650);
    this._apply();
  }

  /** Convert client coords → natural map coords, or null if outside the map. */
  toMap(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const x = (clientX - rect.left - this.tx) / this.scale;
    const y = (clientY - rect.top - this.ty) / this.scale;
    if (x < 0 || y < 0 || x > this.mapW || y > this.mapH) return null;
    return { x, y };
  }

  // ---------------- input ----------------

  _down(e) {
    this.container.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 1) {
      this._downAt = { x: e.clientX, y: e.clientY };
      this._dragging = false;
    } else if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      this._dragging = true;
    }
  }

  _move(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) return;
    if (this._pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...this._pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinch && this._pinch.dist > 0) {
        this._zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / this._pinch.dist);
      }
      this._pinch = { dist };
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!this._dragging && this._downAt &&
        Math.hypot(e.clientX - this._downAt.x, e.clientY - this._downAt.y) > TAP_SLOP) {
      this._dragging = true;
    }
    if (this._dragging) {
      this.tx += dx;
      this.ty += dy;
      this._apply();
    }
    p.x = e.clientX; p.y = e.clientY;
  }

  _up(e) {
    const wasTap = !this._dragging && this._pointers.size === 1 && this._downAt;
    this._pointers.delete(e.pointerId);
    this._pinch = null;
    if (wasTap && this.interactive) {
      const pt = this.toMap(e.clientX, e.clientY);
      if (pt) {
        this.setGuess(pt);
        this.onGuessMoved?.(this.guess);
      }
    }
    if (this._pointers.size === 0) { this._downAt = null; this._dragging = false; }
  }

  _cancel(e) {
    this._pointers.delete(e.pointerId);
    this._pinch = null;
    if (this._pointers.size === 0) { this._downAt = null; this._dragging = false; }
  }

  // ---------------- pins / overlays ----------------

  /**
   * Place an element at natural coords, keeping constant on-screen size.
   * Returns the wrapper (positioned at the point; el is its child).
   */
  placeEl(el, pt) {
    let wrap = el.parentElement;
    if (!wrap || !wrap.classList.contains('mapw-anchor')) {
      wrap = document.createElement('div');
      wrap.className = 'mapw-anchor';
      wrap.appendChild(el);
      this.layer.appendChild(wrap);
      this._counterScaled.add(wrap);
    }
    wrap.style.left = pt.x + 'px';
    wrap.style.top = pt.y + 'px';
    wrap.style.transform = `scale(${1 / this.scale})`;
    return wrap;
  }

  setGuess(pt) {
    this.guess = pt;
    if (!this.guessPin) {
      this.guessPin = document.createElement('div');
      this.guessPin.className = 'mapw-pin mapw-pin-guess';
    }
    this.placeEl(this.guessPin, pt);
  }

  showTruth(pt) {
    this.truth = pt;
    if (!this.truthPin) {
      this.truthPin = document.createElement('div');
      this.truthPin.className = 'mapw-pin mapw-pin-truth';
    }
    this.placeEl(this.truthPin, pt);
    if (this.guess) {
      if (!this.line) {
        this.line = document.createElementNS(SVG_NS, 'line');
        this.line.classList.add('mapw-line');
        this.svg.appendChild(this.line);
      }
      this.line.setAttribute('x1', this.guess.x);
      this.line.setAttribute('y1', this.guess.y);
      this.line.setAttribute('x2', pt.x);
      this.line.setAttribute('y2', pt.y);
    }
  }

  /** Calibrate helper: dashed circle of `radius` natural px around pt. */
  setRing(pt, radius) {
    if (!this.ring) {
      this.ring = document.createElementNS(SVG_NS, 'circle');
      this.ring.classList.add('mapw-ring');
      this.svg.appendChild(this.ring);
    }
    this.ring.setAttribute('cx', pt.x);
    this.ring.setAttribute('cy', pt.y);
    this.ring.setAttribute('r', radius);
    this.ring.style.display = '';
  }

  hideRing() { if (this.ring) this.ring.style.display = 'none'; }

  /** Re-apply after a container resize/expand. */
  refresh() { this._apply(); }

  reset() {
    this.guess = null;
    this.truth = null;
    for (const pin of [this.guessPin, this.truthPin]) {
      const wrap = pin?.parentElement;
      if (wrap) { this._counterScaled.delete(wrap); wrap.remove(); }
    }
    this.guessPin = this.truthPin = null;
    this.line?.remove();
    this.line = null;
    this.resetView();
  }
}
