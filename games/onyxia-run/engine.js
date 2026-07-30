// Canvas engine: fixed logical resolution with letterboxing, fixed-timestep loop.

import { WORLD } from './physics.js';

const STEP = 1 / 60;
const MAX_STEPS = 3; // a hitching tab never teleports the player

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(dt:number) => void} update fixed-timestep logic
   * @param {(ctx:CanvasRenderingContext2D) => void} render draws in 1280x720 logical space
   */
  constructor(canvas, update, render) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.last = null;
    this.running = false;
    this._frame = this._frame.bind(this);
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    const scale = Math.min(this.canvas.width / WORLD.width, this.canvas.height / WORLD.height);
    this.offsetX = (this.canvas.width - WORLD.width * scale) / 2;
    this.offsetY = (this.canvas.height - WORLD.height * scale) / 2;
    this.scale = scale;
  }

  /** Convert a client (CSS px) coordinate to logical world coords. */
  toWorld(clientX, clientY) {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (clientX * dpr - this.offsetX) / this.scale,
      y: (clientY * dpr - this.offsetY) / this.scale,
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = null;
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  _frame(now) {
    if (!this.running) return;
    if (this.last == null) this.last = now;
    this.accumulator += Math.min((now - this.last) / 1000, 0.25);
    this.last = now;

    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.update(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    // Clip to the logical viewport so letterbox bars stay clean.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.width, WORLD.height);
    ctx.clip();
    this.render(ctx);
    ctx.restore();

    requestAnimationFrame(this._frame);
  }
}
