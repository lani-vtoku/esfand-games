// Location viewers for WoW GeoGuessr.
// PhotoView: flat screenshot with drag-to-look pan + zoom (Ken Burns style).
// PanoView: WebGL equirectangular 360° viewer (GeoGuessr-style look-around)
// for locations flagged "pano": true in the manifest.

import { bust } from '../../shared/js/manifest.js';

// ---------------------------------------------------------------- PhotoView

export class PhotoView {
  /** @param {HTMLElement} container fullscreen positioned element */
  constructor(container) {
    this.c = container;
    this.c.classList.add('photoview');
    this.img = document.createElement('img');
    this.img.className = 'photoview-img';
    this.img.draggable = false;
    this.c.appendChild(this.img);

    this.zoom = 1;
    this.tx = 0; this.ty = 0;
    this._pointers = new Map();
    this._pinch = null;

    this.c.addEventListener('pointerdown', e => this._down(e));
    this.c.addEventListener('pointermove', e => this._move(e));
    this.c.addEventListener('pointerup', e => this._up(e));
    this.c.addEventListener('pointercancel', e => this._up(e));
    this.c.addEventListener('wheel', e => {
      e.preventDefault();
      this._zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    window.addEventListener('resize', () => this._fit(false));
  }

  /** @returns {Promise<boolean>} false if the image failed to load */
  show(src) {
    return new Promise(resolve => {
      this.img.onload = () => { this._fit(true); resolve(true); };
      this.img.onerror = () => resolve(false);
      this.img.src = bust(src);
      this.c.style.display = '';
    });
  }

  hide() { this.c.style.display = 'none'; }

  _cover() {
    const iw = this.img.naturalWidth || 1, ih = this.img.naturalHeight || 1;
    return Math.max(this.c.clientWidth / iw, this.c.clientHeight / ih);
  }

  _fit(reset) {
    if (!this.img.naturalWidth) return;
    if (reset) this.zoom = 1.25; // slight zoom-in so there is room to look around
    const s = this._cover() * this.zoom;
    const iw = this.img.naturalWidth * s, ih = this.img.naturalHeight * s;
    if (reset) {
      this.tx = (this.c.clientWidth - iw) / 2;
      this.ty = (this.c.clientHeight - ih) / 2;
    }
    this._apply();
  }

  _apply() {
    const s = this._cover() * this.zoom;
    const iw = this.img.naturalWidth * s, ih = this.img.naturalHeight * s;
    const cw = this.c.clientWidth, ch = this.c.clientHeight;
    this.tx = iw <= cw ? (cw - iw) / 2 : Math.min(0, Math.max(cw - iw, this.tx));
    this.ty = ih <= ch ? (ch - ih) / 2 : Math.min(0, Math.max(ch - ih, this.ty));
    this.img.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${s})`;
  }

  _zoomAt(cx, cy, factor) {
    const rect = this.c.getBoundingClientRect();
    const px = cx - rect.left, py = cy - rect.top;
    const oldS = this._cover() * this.zoom;
    this.zoom = Math.min(4, Math.max(1, this.zoom * factor));
    const k = (this._cover() * this.zoom) / oldS;
    this.tx = px - k * (px - this.tx);
    this.ty = py - k * (py - this.ty);
    this._apply();
  }

  _down(e) {
    this.c.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 2) {
      const [a, b] = [...this._pointers.values()];
      this._pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
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
    this.tx += e.clientX - p.x;
    this.ty += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this._apply();
  }

  _up(e) {
    this._pointers.delete(e.pointerId);
    this._pinch = null;
  }
}

// ----------------------------------------------------------------- PanoView

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0., 1.); }`;
const FS = `
precision mediump float;
varying vec2 uv;
uniform sampler2D tex;
uniform float yaw, pitch, fov, aspect;
void main(){
  float py = uv.y * tan(fov * .5);
  float px = uv.x * tan(fov * .5) * aspect;
  vec3 dir = normalize(vec3(px, py, 1.));
  float cp = cos(pitch), sp = sin(pitch);
  dir = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  dir = vec3(dir.x * cy + dir.z * sy, dir.y, -dir.x * sy + dir.z * cy);
  float u = atan(dir.x, dir.z) / 6.2831853 + .5;
  float v = .5 - asin(clamp(dir.y, -1., 1.)) / 3.1415926;
  gl_FragColor = texture2D(tex, vec2(u, v));
}`;

export class PanoView {
  /** @param {HTMLCanvasElement} canvas fullscreen canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl');
    this.ok = !!this.gl;
    if (!this.ok) return;
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { this.ok = false; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {
      yaw: gl.getUniformLocation(prog, 'yaw'),
      pitch: gl.getUniformLocation(prog, 'pitch'),
      fov: gl.getUniformLocation(prog, 'fov'),
      aspect: gl.getUniformLocation(prog, 'aspect'),
    };
    this.tex = gl.createTexture();
    this.yaw = 0; this.pitch = 0; this.fov = 75 * Math.PI / 180;
    this.visible = false;
    this._drag = null;

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this._drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', e => {
      if (!this._drag) return;
      const k = this.fov / canvas.clientHeight;
      this.yaw -= (e.clientX - this._drag.x) * k;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + (e.clientY - this._drag.y) * k));
      this._drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { this._drag = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const deg = this.fov * 180 / Math.PI + (e.deltaY > 0 ? 6 : -6);
      this.fov = Math.max(30, Math.min(100, deg)) * Math.PI / 180;
    }, { passive: false });
  }

  /** @returns {Promise<boolean>} */
  show(src) {
    if (!this.ok) return Promise.resolve(false);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.yaw = 0; this.pitch = 0;
        this.visible = true;
        this.canvas.style.display = '';
        this._loop();
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = bust(src);
    });
  }

  hide() {
    this.visible = false;
    this.canvas.style.display = 'none';
  }

  _loop() {
    if (!this.visible) return;
    const gl = this.gl, c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform1f(this.u.yaw, this.yaw);
    gl.uniform1f(this.u.pitch, this.pitch);
    gl.uniform1f(this.u.fov, this.fov);
    gl.uniform1f(this.u.aspect, w / h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(() => this._loop());
  }
}
