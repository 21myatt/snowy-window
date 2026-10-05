/* eslint-disable no-bitwise, no-continue -- Integer hashing and tight pixel loops are intentional. */
import { ClampToEdgeWrapping, DataTexture, FloatType, LinearFilter, RGBAFormat } from "three";
import type { Brush } from "./SnowyWindowInteraction";

type Settings = {
  wipeStrength: number; wipeResidue: number; wipeDisplacement: number;
  wipeResidueDrySpeed: number; wipeClearThreshold: number; wipeGrowthDelay: number;
  growthRate: number;
};
const STEP = 1 / 60;
const smooth = (x: number) => x * x * (3 - 2 * x);
const hash = (x: number, y: number, t = 0) => {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(t + 1, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** Eden growth inspired by test.md Buffer A. RGBA = density, water, birth time, ice.
 * Double-buffered fixed steps prevent scan-direction bias and render-FPS dependence.
 */
export class CrystalGrowthSimulation {
  readonly texture: DataTexture;

  private pixels: Float32Array;

  private next: Float32Array;

  private readonly hold: Float32Array;

  private accumulator = 0;

  private time = 0;

  private tick = 0;

  private growing = false;

  private readonly settledDensity: number;

  constructor(initialDensity: number, readonly width = 256, readonly height = 456) {
    this.settledDensity = initialDensity > 0 ? initialDensity : 0.78;
    this.pixels = new Float32Array(width * height * 4);
    this.next = new Float32Array(this.pixels.length);
    this.hold = new Float32Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      this.pixels[i * 4] = initialDensity;
      this.pixels[i * 4 + 2] = -100;
      this.pixels[i * 4 + 3] = initialDensity > 0 ? 1 : 0;
    }
    this.texture = new DataTexture(this.pixels, width, height, RGBAFormat, FloatType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  startAutoRefill(seedCount: number): void {
    if (this.growing) return;
    const candidates: number[] = [];
    for (let i = 0; i < this.hold.length; i += 1) {
      if (this.pixels[i * 4 + 3] < 0.5 && this.hold[i] <= 0) candidates.push(i);
    }
    // Partial wipes still need to thicken again even if no pixel became fully clear.
    if (!candidates.length) {
      this.growing = this.pixels.some((value, index) => index % 4 === 0 && value < this.settledDensity - 0.001);
      return;
    }
    for (let seed = 0; seed < Math.min(seedCount, candidates.length); seed += 1) {
      const i = candidates[Math.floor(hash(seed, this.tick) * candidates.length)] * 4;
      this.pixels[i] = 0.12;
      this.pixels[i + 2] = this.time;
      this.pixels[i + 3] = 1;
    }
    this.growing = true;
  }

  update(deltaSeconds: number, brushes: Brush[], config: Settings): void {
    const dt = Math.min(deltaSeconds, 0.1);
    this.accumulator += dt;
    // Swept capsules cover fast motion without multiplying pressure by stamp count.
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const pixel = y * this.width + x;
        const i = pixel * 4;
        this.hold[pixel] = Math.max(0, this.hold[pixel] - dt);
        this.pixels[i + 1] *= Math.exp(-dt * config.wipeResidueDrySpeed);
        let contact = 0;
        let rim = 0;
        for (let b = 0; b < brushes.length; b += 1) {
          const brush = brushes[b];
          const aspect = this.height / this.width;
          const ax = brush.from?.x ?? brush.x;
          const ay = (brush.from?.y ?? brush.y) * aspect;
          const dx = brush.x - ax;
          const dy = brush.y * aspect - ay;
          const px = (x + 0.5) / this.width - ax;
          const py = (y + 0.5) / this.height * aspect - ay;
          const length2 = dx * dx + dy * dy;
          const t = length2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / length2)) : 0;
          const r = Math.hypot(px - dx * t, py - dy * t) / brush.radius;
          if (r >= 1.15) continue;
          const influence = 1 - smooth(Math.max(0, Math.min(1, (r - 0.48) / 0.52)));
          const travel = Math.sqrt(length2) / Math.max(brush.radius, 0.001);
          contact = Math.max(contact, influence * Math.abs(brush.strength) * (dt + travel * 0.12));
          rim = Math.max(rim, Math.exp(-(((r - 0.93) / 0.12) ** 2)) * Math.min(1, travel));
        }
        if (contact > 0) {
          const removed = Math.min(this.pixels[i], contact * config.wipeStrength);
          this.pixels[i] -= removed;
          this.pixels[i + 1] = Math.min(1, this.pixels[i + 1] + removed * config.wipeResidue);
          this.hold[pixel] = config.wipeGrowthDelay;
          if (this.pixels[i] < config.wipeClearThreshold) this.pixels[i] = 0;
          if (this.pixels[i] < 0.18) {
            this.pixels[i + 3] = 0;
            this.pixels[i + 2] = -100;
          }
        }
        this.pixels[i + 1] = Math.min(1, this.pixels[i + 1] + rim * config.wipeDisplacement * 0.1);
      }
    }
    while (this.accumulator + 1e-8 >= STEP) {
      this.accumulator -= STEP;
      this.time += STEP;
      this.tick += 1;
      if (this.growing) this.grow(config.growthRate);
    }
    this.texture.image.data = this.pixels;
    this.texture.needsUpdate = true;
  }

  private grow(rate: number): void {
    this.next.set(this.pixels);
    let remaining = 0;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const p = y * this.width + x;
        const i = p * 4;
        if (this.hold[p] > 0) { remaining += 1; continue; }
        if (this.pixels[i + 3] > 0.5) {
          // Return to the original film density, so settled strokes cannot turn milkier.
          this.next[i] += (this.settledDensity - this.next[i]) * (1 - Math.exp(-STEP * 1.8));
          if (Math.abs(this.next[i] - this.settledDensity) < 0.001) this.next[i] = this.settledDensity;
          else remaining += 1;
          continue;
        }
        remaining += 1;
        let neighbors = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if ((!ox && !oy) || x + ox < 0 || x + ox >= this.width || y + oy < 0 || y + oy >= this.height) continue;
            neighbors += this.pixels[((y + oy) * this.width + x + ox) * 4 + 3];
          }
        }
        const grain = 0.45 + hash(Math.floor(x / 3), Math.floor(y / 3)) * 0.9;
        const probability = 1 - Math.exp(-rate * (this.width / 128) * STEP * grain * (0.6 + neighbors * 0.3));
        if (neighbors > 0 && hash(x, y, this.tick) < probability) {
          this.next[i] = Math.max(this.next[i], 0.12);
          this.next[i + 2] = this.time;
          this.next[i + 3] = 1;
        }
      }
    }
    [this.pixels, this.next] = [this.next, this.pixels];
    if (remaining === 0) this.growing = false;
  }

  get elapsedTime(): number { return this.time; }

  get isGrowing(): boolean { return this.growing; }

  cancelAutoRefill(): void { this.growing = false; }

  getPixel(x: number, y: number) {
    const i = (Math.max(0, Math.min(this.height - 1, y)) * this.width + Math.max(0, Math.min(this.width - 1, x))) * 4;
    return { condensation: this.pixels[i], residue: this.pixels[i + 1], birthTime: this.pixels[i + 2], frozen: this.pixels[i + 3] };
  }

  dispose(): void { this.texture.dispose(); }
}
